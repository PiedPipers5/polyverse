import { redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { activities, users, followers, interactions, remoteActors } from '$lib/server/db/schema';
import { eq, and, desc, count, inArray } from 'drizzle-orm';
import { env } from '$env/dynamic/private';
import type { PageServerLoad } from './$types';

const PUBLIC_URI = 'https://www.w3.org/ns/activitystreams#Public';
const PAGE_SIZE = 20;

/**
 * SSR load for /feed.
 * Auth-gated. Returns the first page of public local activity
 * so the page renders instantly without a client-side waterfall.
 * Also returns the current user's profile info for the left sidebar.
 */
export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	const domain = env.DOMAIN!;

	// Fetch current user profile for sidebar
	const currentUser = await db.query.users.findFirst({
		where: eq(users.id, locals.user.userId),
		columns: {
			id: true,
			username: true,
			displayName: true,
			bio: true,
			avatarUrl: true,
			didDocument: true,
			createdAt: true
		}
	});

	let followersCount = 0;
	let followingCount = 0;
	let postsCount = 0;
	const followedFollowerUris = new Set<string>();

	if (currentUser) {
		// Run sidebar counts and follow uris in parallel
		const [
			followersResult,
			followingResult,
			allUserActivities,
			acceptedFollows
		] = await Promise.all([
			db.select({ count: count() }).from(followers).where(and(eq(followers.userId, currentUser.id), eq(followers.status, 'accepted'))),
			db.select({ count: count() }).from(followers).where(and(eq(followers.followerId, currentUser.id), eq(followers.status, 'accepted'))),
			db.query.activities.findMany({ where: and(eq(activities.actorId, currentUser.id), eq(activities.type, 'Create')) }),
			db.query.followers.findMany({ where: and(eq(followers.followerId, currentUser.id), eq(followers.status, 'accepted')) })
		]);

		followersCount = followersResult[0]?.count ?? 0;
		followingCount = followingResult[0]?.count ?? 0;
		postsCount = allUserActivities.filter((a) => {
			const obj = (a.activity as any).object;
			return obj && obj.type !== 'Tombstone';
		}).length;

		// Build the set of followers-collection URIs the user has access to
		const followedUserIds = acceptedFollows.map(f => f.userId).filter(Boolean) as string[];

		if (followedUserIds.length > 0) {
			const followedUsersList = await db.query.users.findMany({
				where: inArray(users.id, followedUserIds),
				columns: { username: true }
			});
			for (const fu of followedUsersList) {
				followedFollowerUris.add(`https://${domain}/users/${fu.username}/followers`);
			}
		}
		// The user should also see their own followers-only posts
		followedFollowerUris.add(`https://${domain}/users/${currentUser.username}/followers`);
	}

	// Fetch all 'Create' activities for the feed (still needed to filter by audience)
	// TODO in future: move JSON filtering to raw SQL JSONb operators
	const allCreateActivities = await db.query.activities.findMany({
		where: eq(activities.type, 'Create'),
		orderBy: [desc(activities.createdAt)]
	});

	// Filter: public posts OR followers-only posts the current user has access to
	const allVisiblePosts = allCreateActivities.filter((row) => {
		const act = row.activity as any;
		const obj = act.object;
		if (!obj || obj.type === 'Tombstone') return false;
		if (obj.inReplyTo) return false; // skip comments

		const to: string[] = act.to || obj.to || [];
		const cc: string[] = act.cc || obj.cc || [];
		const audiences = [...to, ...cc];

		if (audiences.includes(PUBLIC_URI)) return true;

		for (const uri of audiences) {
			if (followedFollowerUris.has(uri)) return true;
		}
		return false;
	});

	const totalPublicPosts = allVisiblePosts.length;
	const postsInPage = allVisiblePosts.slice(0, PAGE_SIZE);
	const hasMore = totalPublicPosts > PAGE_SIZE;

	// Hydrate interaction data, local authors, and remote actors
	const postIds = postsInPage.map((p) => (p.activity as any).object?.id || p.id);
	const actorIds = [...new Set(postsInPage.map(p => p.actorId).filter(Boolean))] as string[];
	const remoteActorIds = [...new Set(postsInPage.map(p => p.remoteActorId).filter(Boolean))] as string[];

	const [interactionsData, authors, remoteAuthors, allReplies] = await Promise.all([
		postIds.length > 0
			? db.query.interactions.findMany({ where: inArray(interactions.postId, postIds) })
			: Promise.resolve([]),
		actorIds.length > 0
			? db.query.users.findMany({
				where: inArray(users.id, actorIds),
				columns: { id: true, username: true, displayName: true, avatarUrl: true }
			})
			: Promise.resolve([]),
		remoteActorIds.length > 0
			? db.query.remoteActors.findMany({ where: inArray(remoteActors.id, remoteActorIds) })
			: Promise.resolve([]),
		db.query.activities.findMany({
			where: eq(activities.type, 'Create')
		})
	]);

	// Build a map of Comment Counts
	const commentCountMap = new Map<string, number>();
	for (const row of allReplies) {
		const act = row.activity as any;
		const parentId = act.object?.inReplyTo;
		if (parentId) {
			commentCountMap.set(parentId, (commentCountMap.get(parentId) || 0) + 1);
		}
	}

	const userMap = new Map(authors.map(a => [a.id, a]));
	const remoteActorMap = new Map(remoteAuthors.map(a => [a.id, a]));

	const posts = postsInPage.map((row) => {
		const act = row.activity as any;
		const postId = act.object?.id || row.id;

		// Calculate scores
		const postInteractions = interactionsData.filter(i => i.postId === postId);
		const upvotes = postInteractions.filter(i => i.type === 'upvote').length;
		const downvotes = postInteractions.filter(i => i.type === 'downvote').length;
		const netScore = upvotes - downvotes;

		// Determine current user's vote
		const currentUserVote = postInteractions.find(i => i.actorId === currentUser?.id)?.type || null;

		// Build author — prefer remote actor if present
		const remoteActor = row.remoteActorId ? remoteActorMap.get(row.remoteActorId) : undefined;
		const localAuthor = row.actorId ? userMap.get(row.actorId) : undefined;

		let author: { username: string; displayName: string | null; avatarUrl: string | null; profileUrl: string } | null = null;
		let isRemote = false;
		let remoteHandle: string | null = null;

		if (remoteActor) {
			const actorJson = remoteActor.actorJson as any;
			author = {
				username: remoteActor.handle,
				displayName: actorJson?.name || remoteActor.handle,
				avatarUrl: actorJson?.icon?.url || null,
				profileUrl: remoteActor.actorUri
			};
			isRemote = true;
			remoteHandle = remoteActor.handle; // e.g. "user@mastodon.social"
		} else if (localAuthor) {
			author = {
				username: localAuthor.username,
				displayName: localAuthor.displayName,
				avatarUrl: localAuthor.avatarUrl,
				profileUrl: `/u/@${localAuthor.username}`
			};
		}

		return {
			id: row.id,
			actorId: row.actorId,
			author,
			isRemote,
			remoteHandle,
			activity: act,
			content: act.object?.content || act.content || '',
			publishedAt: row.createdAt.toISOString(),
			createdAt: row.createdAt.toISOString(),
			netScore,
			commentsCount: commentCountMap.get(postId) || 0,
			userVote: currentUserVote
		};
	});

	const nextCursor = hasMore && posts.length > 0 ? posts[posts.length - 1].createdAt : null;


	return {
		posts,
		nextCursor,
		totalPublicPosts,
		currentUser: currentUser
			? {
				id: currentUser.id,
				username: currentUser.username,
				displayName: currentUser.displayName,
				bio: currentUser.bio,
				avatarUrl: currentUser.avatarUrl,
				handle: `@${currentUser.username}@${domain}`,
				followersCount,
				followingCount,
				postsCount
			}
			: null
	};
};
