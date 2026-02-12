import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { users, followers, activities } from '$lib/server/db/schema';
import { eq, and, count } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
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

	// Count posts (activities created by this user)
	const postsResult = await db
		.select({ count: count() })
		.from(activities)
		.where(eq(activities.actorId, user.id));
	const postsCount = postsResult[0]?.count || 0;

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
		}
	};
};
