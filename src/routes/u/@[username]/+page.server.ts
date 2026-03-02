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

	// Count followers (users who follow this user)
	const followersResult = await db
		.select({ count: count() })
		.from(followers)
		.where(eq(followers.userId, user.id));
	const followersCount = followersResult[0]?.count || 0;

	// Count following (users this user follows)
	const followingResult = await db
		.select({ count: count() })
		.from(followers)
		.where(eq(followers.followerId, user.id));
	const followingCount = followingResult[0]?.count || 0;

	// BUG FIX: Post count was incorrectly incrementing on edits and deletes.
	// We now only count top-level 'Create' activities and filter out those that
	// have been marked as 'Tombstone' (deleted).
	const allUserActivitiesCount = await db.query.activities.findMany({
		where: and(
			eq(activities.actorId, user.id),
			eq(activities.type, 'Create')
		)
	});

	// Filter out tombstones to get accurate active post count
	const nonDeletedPostsCount = allUserActivitiesCount.filter((a) => {
		const obj = (a.activity as any).object;
		return obj && obj.type !== 'Tombstone';
	});

	const postsCount = nonDeletedPostsCount.length;

	// Fetch recent activities for the feed
	// We'll fetch the last 20 activities for this user
	// Determine requestor's access level
	const requestor = locals.user;
	// Check if the current user is the owner of this profile
	const isOwner = requestor?.username === username;

	// Check if requestor is a follower
	let isFollower = false;
	if (requestor && !isOwner) {
		const followRecord = await db.query.followers.findFirst({
			where: and(
				eq(followers.userId, user.id),
				eq(followers.followerId, requestor.userId)
			)
		});
		isFollower = !!followRecord;
	}

	const PUBLIC_URI = 'https://www.w3.org/ns/activitystreams#Public';
	const followersUri = `https://${env.DOMAIN}/users/${username}/followers`;

	// Fetch recent activities (fetch 6 to check for hasMore)
	const recentActivitiesRaw = await db.query.activities.findMany({
		where: and(
			eq(activities.actorId, user.id),
			eq(activities.type, 'Create')
		),
		orderBy: (activities, { desc }) => [desc(activities.createdAt)],
		limit: 30 // Fetch more than needed to account for filtering
	});

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
		nextCursor,
		hasMore
	};
};
