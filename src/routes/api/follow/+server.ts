import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { users, followers, federatedFollows } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { env } from '$env/dynamic/private';
import { resolveRemoteActor } from '$lib/server/federation';
import type { RequestHandler } from '@sveltejs/kit';

/**
 * POST /api/follow
 *
 * Handles both local and remote follow requests.
 *
 * Body: { "targetUsername": "alice" }        → local follow
 *   or: { "handle": "@user@remote.domain" }  → remote (federated) follow
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	const user = locals.user;
	if (!user) {
		throw error(401, 'Unauthorized');
	}

	const body = await request.json();
	const { targetUsername, handle } = body;

	// ─── Local follow (targetUsername provided) ──────────────────────────
	if (targetUsername && typeof targetUsername === 'string') {
		// Can't follow yourself
		if (targetUsername === user.username) {
			throw error(400, 'You cannot follow yourself');
		}

		// Find the target user
		const targetUser = await db.query.users.findFirst({
			where: eq(users.username, targetUsername),
			columns: { id: true, username: true }
		});

		if (!targetUser) {
			throw error(404, `User @${targetUsername} not found`);
		}

		// Check for existing follow relationship
		const existing = await db.query.followers.findFirst({
			where: and(
				eq(followers.userId, targetUser.id),
				eq(followers.followerId, user.userId)
			)
		});

		if (existing) {
			if (existing.status === 'accepted') {
				throw error(409, `You are already following @${targetUsername}`);
			}
			if (existing.status === 'pending') {
				throw error(409, `Follow request to @${targetUsername} is already pending`);
			}
		}

		// Insert follow with status 'pending'
		await db.insert(followers).values({
			userId: targetUser.id,
			followerId: user.userId,
			status: 'pending',
			createdAt: new Date()
		});

		return json(
			{ success: true, status: 'pending', message: `Follow request sent to @${targetUsername}` },
			{ status: 201 }
		);
	}

	// ─── Remote / federated follow (handle provided) ────────────────────
	if (handle && typeof handle === 'string') {
		const domain = env.DOMAIN!;

		const result = await resolveRemoteActor(handle);
		if (!result) {
			throw error(404, `Could not find remote actor: ${handle}`);
		}

		const remoteActorUri = result.actor.id as string;
		const remoteInbox = result.actor.inbox as string;

		if (!remoteActorUri || !remoteInbox) {
			throw error(502, 'Remote actor is missing required fields (id, inbox)');
		}

		const existingFollow = await db.query.federatedFollows.findFirst({
			where: and(
				eq(federatedFollows.localUserId, user.userId),
				eq(federatedFollows.remoteActorUri, remoteActorUri)
			)
		});

		if (existingFollow) {
			if (existingFollow.status === 'accepted') {
				throw error(409, `You are already following ${handle}`);
			}
			if (existingFollow.status === 'pending') {
				throw error(409, `Follow request for ${handle} is already pending`);
			}
		}

		const actorUri = `https://${domain}/users/${user.username}`;
		const followId = `https://${domain}/users/${user.username}/follows/${crypto.randomUUID()}`;

		const followActivity = {
			'@context': 'https://www.w3.org/ns/activitystreams',
			id: followId,
			type: 'Follow',
			actor: actorUri,
			object: remoteActorUri
		};

		await db.insert(federatedFollows).values({
			localUserId: user.userId,
			remoteActorUri: remoteActorUri,
			status: 'pending',
			followActivityId: followId,
			createdAt: new Date(),
			updatedAt: new Date()
		});

		return json(
			{
				success: true,
				followActivity,
				status: 'pending',
				message: `Follow request recorded for ${handle}.`,
				remoteInbox
			},
			{ status: 201 }
		);
	}

	throw error(400, 'Either "targetUsername" (local) or "handle" (remote) is required.');
};

/**
 * DELETE /api/follow
 *
 * Unfollow a local user.
 * Body: { "targetUsername": "alice" }
 */
export const DELETE: RequestHandler = async ({ request, locals }) => {
	const user = locals.user;
	if (!user) {
		throw error(401, 'Unauthorized');
	}

	const body = await request.json();
	const { targetUsername } = body;

	if (!targetUsername) {
		throw error(400, '"targetUsername" is required');
	}

	const targetUser = await db.query.users.findFirst({
		where: eq(users.username, targetUsername),
		columns: { id: true }
	});

	if (!targetUser) {
		throw error(404, `User @${targetUsername} not found`);
	}

	await db.delete(followers).where(
		and(
			eq(followers.userId, targetUser.id),
			eq(followers.followerId, user.userId)
		)
	);

	return json({ success: true, message: `Unfollowed @${targetUsername}` });
};

/**
 * GET /api/follow
 *
 * Returns the current user's federated follow list.
 * Query params:
 *   ?status=pending|accepted|rejected (optional filter)
 */
export const GET: RequestHandler = async ({ url, locals }) => {
	const user = locals.user;
	if (!user) {
		throw error(401, 'Unauthorized');
	}

	const statusFilter = url.searchParams.get('status');

	let whereClause;
	if (statusFilter && ['pending', 'accepted', 'rejected'].includes(statusFilter)) {
		whereClause = and(
			eq(federatedFollows.localUserId, user.userId),
			eq(federatedFollows.status, statusFilter)
		);
	} else {
		whereClause = eq(federatedFollows.localUserId, user.userId);
	}

	const follows = await db.query.federatedFollows.findMany({
		where: whereClause,
		orderBy: (table, { desc }) => [desc(table.createdAt)]
	});

	return json({
		follows: follows.map((f) => ({
			id: f.id,
			remoteActorUri: f.remoteActorUri,
			status: f.status,
			followActivityId: f.followActivityId,
			createdAt: f.createdAt,
			updatedAt: f.updatedAt
		}))
	});
};
