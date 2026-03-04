import { redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { activities, users, followers, interactions } from '$lib/server/db/schema';
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

	// Fetch all local users for author info
	const allUsers = await db.query.users.findMany({
		columns: { id: true, username: true, displayName: true, avatarUrl: true }
	});
	const userMap = new Map(allUsers.map((u) => [u.id, u]));

	// Count followers / following for the sidebar profile card
	let followersCount = 0;
	let followingCount = 0;
	let postsCount = 0;

	if (currentUser) {
		const followersResult = await db
			.select({ count: count() })
			.from(followers)
			.where(and(eq(followers.userId, currentUser.id), eq(followers.status, 'accepted')));
		followersCount = followersResult[0]?.count ?? 0;

		const followingResult = await db
			.select({ count: count() })
			.from(followers)
			.where(and(eq(followers.followerId, currentUser.id), eq(followers.status, 'accepted')));
		followingCount = followingResult[0]?.count ?? 0;

		const allUserActivities = await db.query.activities.findMany({
			where: and(eq(activities.actorId, currentUser.id), eq(activities.type, 'Create'))
		});
		postsCount = allUserActivities.filter((a) => {
			const obj = (a.activity as any).object;
			return obj && obj.type !== 'Tombstone';
		}).length;
	}

	// Fetch all 'Create' activities for the feed
	const allCreateActivities = await db.query.activities.findMany({
		where: eq(activities.type, 'Create'),
		orderBy: [desc(activities.createdAt)]
	});

	// Build the set of followers-collection URIs that the current user has access to.
	// If user A follows user B (accepted), then A can see posts addressed to B's followers URI.
	const domain = env.DOMAIN!;
	const followedFollowerUris = new Set<string>();

	if (currentUser) {
		// Get all users the current user follows (accepted only)
		const acceptedFollows = await db.query.followers.findMany({
			where: and(
				eq(followers.followerId, currentUser.id),
				eq(followers.status, 'accepted')
			)
		});

		for (const f of acceptedFollows) {
			if (f.userId) {
				const followedUser = userMap.get(f.userId);
				if (followedUser) {
					followedFollowerUris.add(`https://${domain}/users/${followedUser.username}/followers`);
				}
			}
		}

		// The user should also see their own followers-only posts
		followedFollowerUris.add(`https://${domain}/users/${currentUser.username}/followers`);
	}

	// Filter: public posts OR followers-only posts the current user has access to
	const allVisiblePosts = allCreateActivities.filter((row) => {
		const act = row.activity as any;
		const obj = act.object;
		if (!obj || obj.type === 'Tombstone') return false;
		if (obj.inReplyTo) return false; // skip comments – they belong under their parent post

		const to: string[] = act.to || obj.to || [];
		const cc: string[] = act.cc || obj.cc || [];
		const audiences = [...to, ...cc];

		// Public post
		if (audiences.includes(PUBLIC_URI)) return true;

		// Followers-only post: check if any audience URI is in the set of accessible followers URIs
		for (const uri of audiences) {
			if (followedFollowerUris.has(uri)) return true;
		}

		return false;
	});

	const totalPublicPosts = allVisiblePosts.length;
	const postsInPage = allVisiblePosts.slice(0, PAGE_SIZE);
	const hasMore = totalPublicPosts > PAGE_SIZE;

	// Hydrate interaction data (upvotes/downvotes)
	const postIds = postsInPage.map((p) => (p.activity as any).object?.id || p.id);

	let interactionsData: any[] = [];
	if (postIds.length > 0) {
		interactionsData = await db.query.interactions.findMany({
			where: inArray(interactions.postId, postIds)
		});
	}

	const posts = postsInPage.map((row) => {
		const author = row.actorId ? userMap.get(row.actorId) : undefined;
		const act = row.activity as any;
		const postId = act.object?.id || row.id;

		// Calculate scores
		const postInteractions = interactionsData.filter(i => i.postId === postId);
		const upvotes = postInteractions.filter(i => i.type === 'upvote').length;
		const downvotes = postInteractions.filter(i => i.type === 'downvote').length;
		const netScore = upvotes - downvotes;

		// Determine current user's vote
		const currentUserVote = postInteractions.find(i => i.actorId === currentUser?.id)?.type || null;

		return {
			id: row.id,
			actorId: row.actorId,
			author: author
				? {
					username: author.username,
					displayName: author.displayName,
					avatarUrl: author.avatarUrl,
					profileUrl: `/u/@${author.username}`
				}
				: null,
			activity: act,
			content: act.object?.content || act.content || '',
			publishedAt: row.createdAt.toISOString(),
			createdAt: row.createdAt.toISOString(),
			netScore,
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
