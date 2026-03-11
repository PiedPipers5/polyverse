import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { users, followers, activities } from '$lib/server/db/schema';
import { eq, and, count } from 'drizzle-orm';
import { env } from '$env/dynamic/private';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const username = params.username;

	// Fetch user from database
	const user = await db.query.users.findFirst({
		where: eq(users.username, username),
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

	if (!user) {
		error(404, 'User not found');
	}

	// Extract profile data from DID document (fallback to direct fields)
	const didDoc = user.didDocument as any;
	const displayName = user.displayName || didDoc?.name || username;
	const bio = user.bio || didDoc?.summary || '';
	const avatarUrl = user.avatarUrl || didDoc?.icon?.url || '';

	// Check the follow status between requestor and profile owner
	const requestor = locals.user;
	const isOwner = requestor?.username === username;

	// Run all stats and data queries in parallel
	const [
		followersResult,
		followingResult,
		allUserActivitiesCount,
		followRecord,
		recentActivitiesRaw
	] = await Promise.all([
		db.select({ count: count() }).from(followers).where(and(eq(followers.userId, user.id), eq(followers.status, 'accepted'))),
		db.select({ count: count() }).from(followers).where(and(eq(followers.followerId, user.id), eq(followers.status, 'accepted'))),
		db.query.activities.findMany({ where: and(eq(activities.actorId, user.id), eq(activities.type, 'Create')) }),
		(requestor && !isOwner)
			? db.query.followers.findFirst({ where: and(eq(followers.userId, user.id), eq(followers.followerId, requestor.userId)) })
			: Promise.resolve(null),
		db.query.activities.findMany({
			where: and(eq(activities.actorId, user.id), eq(activities.type, 'Create')),
			orderBy: (activities, { desc }) => [desc(activities.createdAt)],
			limit: 30
		})
	]);

	const followersCount = followersResult[0]?.count || 0;
	const followingCount = followingResult[0]?.count || 0;

	// Filter out tombstones to get accurate active post count
	const postsCount = allUserActivitiesCount.filter((a) => {
		const obj = (a.activity as any).object;
		return obj && obj.type !== 'Tombstone';
	}).length;

	let followStatus: 'none' | 'pending' | 'accepted' = 'none';
	let isFollower = false;

	if (followRecord) {
		followStatus = followRecord.status as 'pending' | 'accepted';
		isFollower = followRecord.status === 'accepted';
	}

	const PUBLIC_URI = 'https://www.w3.org/ns/activitystreams#Public';
	const followersUri = `https://${env.DOMAIN}/users/${username}/followers`;

	// Filter based on privacy and tombstones
	let filteredActivities = recentActivitiesRaw.filter(record => {
		const act = record.activity as any;

		// Filter out Tombstones (deleted posts)
		if (act.object?.type === 'Tombstone' || act.type === 'Tombstone') {
			return false;
		}

		const to = act.to || [];
		const cc = act.cc || [];
		const audiences = [...to, ...cc];

		const isPublic = audiences.includes(PUBLIC_URI);
		const isFollowersOnly = audiences.includes(followersUri);

		// Owner sees everything
		if (isOwner) return true;

		// Public posts visible to everyone
		if (isPublic) return true;

		// Followers-only posts visible to followers
		if (isFollower && isFollowersOnly) return true;

		return false;
	});

	const hasMore = filteredActivities.length > 5;
	const initialSelection = filteredActivities.slice(0, 5);
	const nextCursor = hasMore ? initialSelection[initialSelection.length - 1].createdAt : null;

	return {
		profile: {
			username: user.username,
			displayName,
			bio,
			avatarUrl,
			handle: `@${user.username}`,
			createdAt: user.createdAt,
			followersCount,
			followingCount,
			postsCount
		},
		activities: initialSelection.map((a) => ({
			...a,
			// Simplified content extraction for now - assuming Note type has content
			content: (a.activity as any).object?.content || (a.activity as any).content || '',
			publishedAt: a.createdAt
		})),
		isOwner,
		followStatus,
		nextCursor,
		hasMore
	};
};
