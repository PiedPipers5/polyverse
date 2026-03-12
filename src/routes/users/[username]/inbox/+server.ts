import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { users, activities, federatedFollows, notifications, conversations, directMessages } from '$lib/server/db/schema';
import { eq, and, or, sql } from 'drizzle-orm';
import { env } from '$env/dynamic/private';
import { verifyHttpSignature } from '$lib/server/httpSignature';
import { resolveRemoteActor } from '$lib/server/federation';
import type { RequestHandler } from '@sveltejs/kit';

const PUBLIC_URI = 'https://www.w3.org/ns/activitystreams#Public';

/**
 * POST /users/:username/inbox
 *
 * Task 3.3.1 (BE): ActivityPub Inbox endpoint.
 * Receives incoming federation activities (Create, Accept, etc.) from remote servers.
 *
 * The inbox accepts JSON-LD payloads and dispatches them to the appropriate handler
 * based on the activity type.
 *
 * @see https://www.w3.org/TR/activitypub/#inbox
 */
export const POST: RequestHandler = async ({ params, request }) => {
	const { username } = params;
	const domain = env.DOMAIN!;

	// ── 1. Validate the target user exists ──────────────────────────
	const targetUser = await db.query.users.findFirst({
		where: eq(users.username, username!),
		columns: { id: true, username: true }
	});

	if (!targetUser) {
		throw error(404, 'User not found');
	}

	// ── 2. Parse the JSON-LD body ───────────────────────────────────
	let activity: Record<string, unknown>;
	try {
		activity = await request.json();
	} catch {
		throw error(400, 'Invalid JSON body');
	}

	// Basic validation: must have type and actor
	if (!activity.type || !activity.actor) {
		throw error(400, 'Activity must include "type" and "actor" fields');
	}

	// ── 3. HTTP Signature Verification (Task 3.3.2) ─────────────────
	// Attempt to resolve and verify the remote actor's signature.
	// At this stage, we log failures but do NOT reject — full enforcement is in Epic 5.
	const actorId = typeof activity.actor === 'string'
		? activity.actor
		: (activity.actor as Record<string, unknown>)?.id as string;

	if (actorId) {
		try {
			// Try to resolve the actor for signature verification
			// We need the actor JSON to get the public key
			const actorResult = await resolveActorByUri(actorId);

			if (actorResult) {
				const sigResult = await verifyHttpSignature(request, actorResult);

				if (!sigResult.verified) {
					console.warn(
						`[Inbox] HTTP Signature verification failed for ${actorId}: ${sigResult.reason}`
					);
					// Do NOT reject — basic validation only (Epic 5 will enforce)
				} else {
					console.log(`[Inbox] HTTP Signature verified for ${actorId}`);
				}
			}
		} catch (err) {
			console.warn('[Inbox] Could not verify HTTP Signature:', err);
		}
	}

	// ── 4. Dispatch by activity type ────────────────────────────────
	const activityType = activity.type as string;

	switch (activityType) {
		case 'Create':
			await handleCreateActivity(activity, targetUser, domain);
			break;

		case 'Accept':
			await handleAcceptActivity(activity, targetUser);
			break;

		case 'Follow':
			// Incoming follow requests from remote users
			console.log(`[Inbox] Received Follow activity from ${actorId} for ${username}`);
			try {
				const followId = activity.id as string;
				if (actorId && followId) {
					// Check if a pending follow already exists to avoid duplicates
					const existingFollow = await db.query.federatedFollows.findFirst({
						where: and(
							eq(federatedFollows.localUserId, targetUser.id),
							eq(federatedFollows.remoteActorUri, actorId),
							eq(federatedFollows.status, 'pending')
						)
					});

					if (!existingFollow) {
						await db.insert(federatedFollows).values({
							localUserId: targetUser.id,
							remoteActorUri: actorId,
							status: 'pending',
							followActivityId: followId,
							createdAt: new Date(),
							updatedAt: new Date()
						});
					}
					// Create a notification for the follow
					await insertNotification(targetUser.id, null, actorId, 'follow', followId);
				}
			} catch (err) {
				console.error('[Inbox:Follow] Error saving follow request:', err);
			}
			break;

		case 'Like':
			await handleLikeActivity(activity, targetUser, domain);
			break;

		case 'Announce':
			await handleAnnounceActivity(activity, targetUser, domain);
			break;

		case 'Undo':
			console.log(`[Inbox] Received Undo activity from ${actorId} for ${username}`);
			break;

		default:
			// Unknown activity types are silently accepted per ActivityPub spec
			console.log(`[Inbox] Received unhandled activity type "${activityType}" from ${actorId}`);
			break;
	}

	// Return 202 Accepted (ActivityPub standard response for inbox delivery)
	return new Response(null, { status: 202 });
};


// ═══════════════════════════════════════════════════════════════
// Activity Dispatchers
// ═══════════════════════════════════════════════════════════════

/**
 * Task 3.3.3 (BE - Dispatcher): Handle incoming Create activities.
 *
 * Validates:
 * 1. The actor matches the object's attributedTo (impersonation check)
 * 2. The local user follows the remote actor (spam prevention)
 *
 * Then saves the Note to the activities table.
 */
async function handleCreateActivity(
	activity: Record<string, unknown>,
	targetUser: { id: string; username: string },
	domain: string
): Promise<void> {
	const actorUri = typeof activity.actor === 'string'
		? activity.actor
		: (activity.actor as Record<string, unknown>)?.id as string;

	const object = activity.object as Record<string, unknown> | undefined;

	if (!object) {
		console.warn('[Inbox:Create] Activity has no object, ignoring');
		return;
	}

	// ── Verify actor matches attributedTo ────────────────────────────
	const attributedTo = typeof object.attributedTo === 'string'
		? object.attributedTo
		: (object.attributedTo as Record<string, unknown>)?.id as string;

	if (actorUri !== attributedTo) {
		console.warn(
			`[Inbox:Create] Actor mismatch: actor=${actorUri}, attributedTo=${attributedTo}. Rejecting.`
		);
		return;
	}

	// ── Check if this is a DM (no Public URI in to/cc) ──────────────
	const toField = (object.to || activity.to || []) as string[];
	const ccField = (object.cc || activity.cc || []) as string[];
	const allAudience = [...toField, ...ccField];
	const isDirectMessage = !allAudience.includes(PUBLIC_URI);

	if (isDirectMessage) {
		// Handle as a DM — skip the follow check, Mastodon allows DMs from non-followers
		await handleIncomingDM(activity, object, actorUri, targetUser, domain);
		return;
	}

	// ── Check that the local user follows the remote actor ──────────
	const followRecord = await db.query.federatedFollows.findFirst({
		where: and(
			eq(federatedFollows.localUserId, targetUser.id),
			eq(federatedFollows.remoteActorUri, actorUri),
			eq(federatedFollows.status, 'accepted')
		)
	});

	if (!followRecord) {
		console.log(
			`[Inbox:Create] User ${targetUser.username} does not follow ${actorUri}. Skipping activity.`
		);
		return;
	}

	// ── Save the activity to the database ───────────────────────────
	// Store with reference to the target local user so it appears in their feed
	const activityWithContext = {
		'@context': activity['@context'] || 'https://www.w3.org/ns/activitystreams',
		...activity
	};

	await db.insert(activities).values({
		actorId: targetUser.id,
		activity: activityWithContext,
		type: 'Create',
		createdAt: new Date(activity.published as string || new Date().toISOString())
	});

	// Task 4.4.2: Create a notification if this is a reply to the target user's post
	const inReplyTo = object.inReplyTo as string | undefined;
	if (inReplyTo && inReplyTo.includes(`/users/${targetUser.username}/`)) {
		await insertNotification(targetUser.id, null, actorUri, 'reply', object.id as string);
	}

	console.log(
		`[Inbox:Create] Saved activity from ${actorUri} for user ${targetUser.username}`
	);
}

/**
 * Handle an incoming DM (Create(Note) with no Public URI).
 * Finds or creates a conversation, inserts the message, and creates a notification.
 */
async function handleIncomingDM(
	activity: Record<string, unknown>,
	object: Record<string, unknown>,
	actorUri: string,
	targetUser: { id: string; username: string },
	domain: string
): Promise<void> {
	const targetUserUri = `https://${domain}/users/${targetUser.username}`;

	// Sort URIs for consistent storage
	const [oneUri, twoUri] = [actorUri, targetUserUri].sort();
	const oneLocalId = oneUri === targetUserUri ? targetUser.id : null;
	const twoLocalId = twoUri === targetUserUri ? targetUser.id : null;

	// Find or create conversation
	let convo = await db.query.conversations.findFirst({
		where: or(
			and(
				eq(conversations.participantOneUri, oneUri),
				eq(conversations.participantTwoUri, twoUri)
			),
			and(
				eq(conversations.participantOneUri, twoUri),
				eq(conversations.participantTwoUri, oneUri)
			)
		)
	});

	if (!convo) {
		const [created] = await db.insert(conversations).values({
			participantOneUri: oneUri,
			participantOneId: oneLocalId,
			participantTwoUri: twoUri,
			participantTwoId: twoLocalId,
			lastMessageAt: new Date(),
			createdAt: new Date()
		}).returning();
		convo = created;
	}

	// Insert the message
	const content = (object.content as string) || '';
	await db.insert(directMessages).values({
		conversationId: convo.id,
		senderUri: actorUri,
		senderLocalId: null, // Remote sender
		content,
		activityJson: activity,
		read: false,
		createdAt: new Date(activity.published as string || new Date().toISOString())
	});

	// Update conversation timestamp
	await db
		.update(conversations)
		.set({ lastMessageAt: new Date() })
		.where(eq(conversations.id, convo.id));

	// Create a notification
	await insertNotification(targetUser.id, null, actorUri, 'mention', object.id as string);

	console.log(`[Inbox:DM] Saved DM from ${actorUri} to ${targetUser.username}`);
}

/**
 * Task 3.3.4 (BE - Dispatcher): Handle incoming Accept activities.
 *
 * When a remote server accepts our Follow request, this handler:
 * 1. Extracts the original Follow activity ID from the Accept's object
 * 2. Finds the matching pending follow in federatedFollows
 * 3. Upgrades the status from "pending" to "accepted"
 */
async function handleAcceptActivity(
	activity: Record<string, unknown>,
	targetUser: { id: string; username: string }
): Promise<void> {
	const actorUri = typeof activity.actor === 'string'
		? activity.actor
		: (activity.actor as Record<string, unknown>)?.id as string;

	// The object of an Accept should reference the original Follow activity
	let followActivityId: string | null = null;

	if (typeof activity.object === 'string') {
		// Simple case: the object is just the Follow activity ID
		followActivityId = activity.object;
	} else if (activity.object && typeof activity.object === 'object') {
		// Complex case: the object is the full Follow activity
		const obj = activity.object as Record<string, unknown>;
		followActivityId = (obj.id as string) || null;
	}

	if (!followActivityId) {
		console.warn('[Inbox:Accept] Could not extract Follow activity ID from Accept');
		return;
	}

	// Find the matching pending follow
	const pendingFollow = await db.query.federatedFollows.findFirst({
		where: and(
			eq(federatedFollows.localUserId, targetUser.id),
			eq(federatedFollows.remoteActorUri, actorUri),
			eq(federatedFollows.status, 'pending')
		)
	});

	if (!pendingFollow) {
		console.warn(
			`[Inbox:Accept] No pending follow found for user ${targetUser.username} → ${actorUri}`
		);
		return;
	}

	// Upgrade status to "accepted"
	await db
		.update(federatedFollows)
		.set({
			status: 'accepted',
			updatedAt: new Date()
		})
		.where(eq(federatedFollows.id, pendingFollow.id));

	// Task 4.4.2: Create a notification for the accepted follow
	await insertNotification(targetUser.id, null, actorUri, 'follow', pendingFollow.followActivityId);

	console.log(
		`[Inbox:Accept] Follow accepted: ${targetUser.username} → ${actorUri}`
	);
}

/**
 * Task 4.4.2 (BE): Handle incoming Like activities.
 * Increment likes_count and create a notification.
 */
async function handleLikeActivity(
	activity: Record<string, unknown>,
	targetUser: { id: string; username: string },
	domain: string
): Promise<void> {
	const actorUri = typeof activity.actor === 'string'
		? activity.actor
		: (activity.actor as Record<string, unknown>)?.id as string;

	const objectUri = typeof activity.object === 'string'
		? activity.object
		: (activity.object as Record<string, unknown>)?.id as string;

	if (!objectUri) {
		console.warn('[Inbox:Like] Activity has no object, ignoring');
		return;
	}

	// Increment likes_count on the local post
	await db
		.update(activities)
		.set({ likesCount: sql`${activities.likesCount} + 1` })
		.where(
			sql`${activities.activity}->'object'->>'id' = ${objectUri} AND ${activities.type} = 'Create'`
		);

	// Create notification
	await insertNotification(targetUser.id, null, actorUri, 'like', objectUri);

	console.log(`[Inbox:Like] Like from ${actorUri} on ${objectUri}`);
}

/**
 * Task 4.4.2 (BE): Handle incoming Announce (Boost) activities.
 * Increment boosts_count and create a notification.
 */
async function handleAnnounceActivity(
	activity: Record<string, unknown>,
	targetUser: { id: string; username: string },
	domain: string
): Promise<void> {
	const actorUri = typeof activity.actor === 'string'
		? activity.actor
		: (activity.actor as Record<string, unknown>)?.id as string;

	const objectUri = typeof activity.object === 'string'
		? activity.object
		: (activity.object as Record<string, unknown>)?.id as string;

	if (!objectUri) {
		console.warn('[Inbox:Announce] Activity has no object, ignoring');
		return;
	}

	// Increment boosts_count on the local post
	await db
		.update(activities)
		.set({ boostsCount: sql`${activities.boostsCount} + 1` })
		.where(
			sql`${activities.activity}->'object'->>'id' = ${objectUri} AND ${activities.type} = 'Create'`
		);

	// Create notification
	await insertNotification(targetUser.id, null, actorUri, 'boost', objectUri);

	console.log(`[Inbox:Announce] Boost from ${actorUri} on ${objectUri}`);
}


// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════

/**
 * Task 4.4.2: Insert a notification row.
 */
async function insertNotification(
	recipientId: string,
	localActorId: string | null,
	remoteActorUri: string | null,
	type: string,
	objectId: string | null
): Promise<void> {
	try {
		await db.insert(notifications).values({
			recipientId,
			actorId: localActorId,
			remoteActorUri,
			type,
			objectId,
			read: false,
			createdAt: new Date()
		});
	} catch (err) {
		console.error('[Inbox] Failed to insert notification:', err);
	}
}

/**
 * Resolves a remote actor by their URI, checking the remote_actors cache first.
 * Falls back to attempting a WebFinger lookup if not cached.
 */
async function resolveActorByUri(
	actorUri: string
): Promise<Record<string, unknown> | null> {
	// Check the remote_actors cache by URI
	const { remoteActors } = await import('$lib/server/db/schema');
	const cached = await db.query.remoteActors.findFirst({
		where: eq(remoteActors.actorUri, actorUri)
	});

	if (cached) {
		return cached.actorJson as Record<string, unknown>;
	}

	// Try to parse a handle from the actor URI and do a full resolve
	// Most ActivityPub actor URIs follow the pattern: https://domain/users/username
	try {
		const url = new URL(actorUri);
		const pathParts = url.pathname.split('/').filter(Boolean);

		// Common patterns: /users/username, /@username, /user/username
		let username: string | null = null;
		if (pathParts.length >= 2 && (pathParts[0] === 'users' || pathParts[0] === 'user')) {
			username = pathParts[1];
		} else if (pathParts.length >= 1 && pathParts[0].startsWith('@')) {
			username = pathParts[0].slice(1);
		}

		if (username) {
			const handle = `${username}@${url.hostname}`;
			const result = await resolveRemoteActor(handle);
			if (result) {
				return result.actor;
			}
		}
	} catch {
		// Failed to parse URI, skip
	}

	return null;
}
