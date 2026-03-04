import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { users, federatedFollows } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { env } from '$env/dynamic/private';
import { resolveRemoteActor } from '$lib/server/federation';
import type { RequestHandler } from '@sveltejs/kit';

/**
 * POST /api/follow
 *
 * Task 3.2.4 (BE): Record a follow request for a remote actor.
 *
 * Constructs a Follow activity, records it in the `federatedFollows` table
 * with status "pending", and returns the activity for the client.
 *
 * Expected Body:
 * {
 *   "handle": "@gargron@mastodon.social"  // or "gargron@mastodon.social"
 * }
 *
 * Note: Actual delivery to the remote inbox (Task 3.2.2/3.2.3 via queue)
 * is not yet implemented — this records the intent and constructs the activity.
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	// 1. Authentication check
	const user = locals.user;
	if (!user) {
		throw error(401, 'Unauthorized');
	}

	const domain = env.DOMAIN!;
	const body = await request.json();
	const { handle } = body;

	if (!handle || typeof handle !== 'string') {
		throw error(400, 'A "handle" field is required (e.g., "@user@domain.com")');
	}

	// 2. Resolve the remote actor (WebFinger → Actor fetch → cache)
	const result = await resolveRemoteActor(handle);
	if (!result) {
		throw error(404, `Could not find remote actor: ${handle}`);
	}

	const remoteActorUri = result.actor.id as string;
	const remoteInbox = result.actor.inbox as string;

	if (!remoteActorUri || !remoteInbox) {
		throw error(502, 'Remote actor is missing required fields (id, inbox)');
	}

	// 3. Check for existing follow relationship
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

	// 4. Construct the Follow activity
	const actorUri = `https://${domain}/users/${user.username}`;
	const followId = `https://${domain}/users/${user.username}/follows/${crypto.randomUUID()}`;

	const followActivity = {
		'@context': 'https://www.w3.org/ns/activitystreams',
		id: followId,
		type: 'Follow',
		actor: actorUri,
		object: remoteActorUri
	};

	// 5. Record in federatedFollows with status "pending"
	await db.insert(federatedFollows).values({
		localUserId: user.userId,
		remoteActorUri: remoteActorUri,
		status: 'pending',
		followActivityId: followId,
		createdAt: new Date(),
		updatedAt: new Date()
	});

	// 6. Return the constructed activity
	// Note: Actual delivery to remoteInbox via queue (Task 3.2.2/3.2.3) is not yet implemented
	return json(
		{
			success: true,
			followActivity,
			status: 'pending',
			message: `Follow request recorded for ${handle}. Delivery to remote inbox is not yet implemented (see Task 3.2.2/3.2.3).`,
			remoteInbox
		},
		{ status: 201 }
	);
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
