import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { users, followers, remoteActors } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const username = params.username;

	const user = await db.query.users.findFirst({
		where: eq(users.username, username),
		columns: { id: true, username: true, displayName: true }
	});

	if (!user) throw error(404, 'User not found');

	// Get followers (people who follow this user)
	const followersData = await db
		.select({
			followId: followers.id,
			createdAt: followers.createdAt,
			localUsername: users.username,
			localDisplayName: users.displayName,
			localAvatarUrl: users.avatarUrl,
			remoteActorUri: remoteActors.actorUri,
			remoteHandle: remoteActors.handle,
			remoteActorJson: remoteActors.actorJson
		})
		.from(followers)
		.leftJoin(users, eq(followers.followerId, users.id))
		.leftJoin(remoteActors, eq(followers.remoteFollowerId, remoteActors.id))
		.where(
			and(
				eq(followers.userId, user.id),
				eq(followers.status, 'accepted')
			)
		);

	const mappedFollowers = followersData.map((f) => {
		if (f.localUsername) {
			return {
				type: 'local',
				username: f.localUsername,
				displayName: f.localDisplayName || f.localUsername,
				avatarUrl: f.localAvatarUrl,
				handle: `@${f.localUsername}`,
				profileUrl: `/u/@${f.localUsername}`
			};
		} else if (f.remoteActorUri && f.remoteHandle) {
			const actorJson = (f.remoteActorJson as any) || {};
			const preferredUsername = actorJson.preferredUsername || f.remoteHandle.split('@')[0];
			return {
				type: 'remote',
				username: preferredUsername,
				displayName: actorJson.name || preferredUsername,
				avatarUrl: actorJson.icon?.url || null,
				handle: `@${f.remoteHandle}`,
				profileUrl: `/remote/@${f.remoteHandle}`
			};
		}
		return null;
	}).filter(Boolean);

	return {
		profile: user,
		followers: mappedFollowers
	};
};
