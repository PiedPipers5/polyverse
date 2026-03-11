import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { conversations, directMessages, users, remoteActors } from '$lib/server/db/schema';
import { eq, or, and, desc, sql } from 'drizzle-orm';
import { env } from '$env/dynamic/private';
import { resolveRemoteActor, parseHandle } from '$lib/server/federation';
import type { RequestHandler } from './$types';

const getActorUri = (username: string) => `https://${env.DOMAIN}/users/${username}`;

/**
 * Helper: find or create a conversation between two participant URIs.
 * We always store participant URIs in sorted order to ensure uniqueness.
 */
async function findOrCreateConversation(
	participantAUri: string,
	participantALocalId: string | null,
	participantBUri: string,
	participantBLocalId: string | null
) {
	// Sort URIs for consistent storage
	const [oneUri, twoUri] = [participantAUri, participantBUri].sort();
	const oneLocalId = oneUri === participantAUri ? participantALocalId : participantBLocalId;
	const twoLocalId = twoUri === participantAUri ? participantALocalId : participantBLocalId;

	// Check both orderings in the DB
	const existing = await db.query.conversations.findFirst({
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

	if (existing) return existing;

	const [created] = await db.insert(conversations).values({
		participantOneUri: oneUri,
		participantOneId: oneLocalId,
		participantTwoUri: twoUri,
		participantTwoId: twoLocalId,
		lastMessageAt: new Date(),
		createdAt: new Date()
	}).returning();

	return created;
}

/**
 * GET /api/dm/conversations
 * List all conversations for the current user, ordered by lastMessageAt DESC.
 */
export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');

	const currentUserUri = getActorUri(locals.user.username);

	// Find all conversations where the current user is a participant
	const convos = await db.query.conversations.findMany({
		where: or(
			eq(conversations.participantOneUri, currentUserUri),
			eq(conversations.participantTwoUri, currentUserUri)
		),
		orderBy: [desc(conversations.lastMessageAt)]
	});

	// Enrich each conversation with participant info and last message
	const enriched = await Promise.all(
		convos.map(async (convo) => {
			// Determine the other participant
			const otherUri = convo.participantOneUri === currentUserUri
				? convo.participantTwoUri
				: convo.participantOneUri;
			const otherLocalId = convo.participantOneUri === currentUserUri
				? convo.participantTwoId
				: convo.participantOneId;

			// Get participant display info
			let otherName: string | null = null;
			let otherAvatar: string | null = null;
			let otherHandle: string = otherUri;

			if (otherLocalId) {
				// Local user
				const localUser = await db.query.users.findFirst({
					where: eq(users.id, otherLocalId),
					columns: { username: true, displayName: true, avatarUrl: true }
				});
				if (localUser) {
					otherName = localUser.displayName || localUser.username;
					otherAvatar = localUser.avatarUrl;
					otherHandle = `@${localUser.username}@${env.DOMAIN}`;
				}
			} else {
				// Remote user - check cached actors
				const remoteActor = await db.query.remoteActors.findFirst({
					where: eq(remoteActors.actorUri, otherUri)
				});
				if (remoteActor) {
					const actorJson = remoteActor.actorJson as Record<string, unknown>;
					otherName = (actorJson.name as string) || (actorJson.preferredUsername as string) || remoteActor.handle;
					otherAvatar = (actorJson.icon as any)?.url || null;
					otherHandle = `@${remoteActor.handle}`;
				}
			}

			// Get last message
			const lastMessage = await db.query.directMessages.findFirst({
				where: eq(directMessages.conversationId, convo.id),
				orderBy: [desc(directMessages.createdAt)],
				columns: { content: true, senderUri: true, createdAt: true }
			});

			// Get unread count (messages sent by the other user that are unread)
			const unreadResult = await db
				.select({ count: sql<number>`count(*)` })
				.from(directMessages)
				.where(
					and(
						eq(directMessages.conversationId, convo.id),
						eq(directMessages.read, false),
						sql`${directMessages.senderUri} != ${currentUserUri}`
					)
				);

			return {
				id: convo.id,
				otherParticipant: {
					uri: otherUri,
					name: otherName,
					avatar: otherAvatar,
					handle: otherHandle
				},
				lastMessage: lastMessage ? {
					content: lastMessage.content.substring(0, 100),
					senderUri: lastMessage.senderUri,
					createdAt: lastMessage.createdAt.toISOString(),
					isOwn: lastMessage.senderUri === currentUserUri
				} : null,
				unreadCount: Number(unreadResult[0]?.count || 0),
				lastMessageAt: convo.lastMessageAt.toISOString(),
				createdAt: convo.createdAt.toISOString()
			};
		})
	);

	return json({ conversations: enriched });
};

/**
 * POST /api/dm/conversations
 * Create (or find existing) conversation with a participant.
 * Body: { participantUri: string } OR { username: string } for local users
 * OR { handle: string } for remote users (e.g., "user@mastodon.social")
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');

	const body = await request.json();
	const { participantUri, username, handle } = body;

	const currentUserUri = getActorUri(locals.user.username);
	let targetUri: string;
	let targetLocalId: string | null = null;

	if (username) {
		// Local user lookup
		const localUser = await db.query.users.findFirst({
			where: eq(users.username, username),
			columns: { id: true, username: true }
		});
		if (!localUser) throw error(404, 'User not found');
		if (localUser.id === locals.user.userId) throw error(400, 'Cannot message yourself');

		targetUri = getActorUri(localUser.username);
		targetLocalId = localUser.id;
	} else if (handle) {
		// Remote user via WebFinger
		const result = await resolveRemoteActor(handle);
		if (!result) throw error(404, 'Remote user not found');

		targetUri = result.actor.id as string;
		targetLocalId = null;
	} else if (participantUri) {
		targetUri = participantUri;
		// Check if it's actually a local user
		const domain = env.DOMAIN!;
		if (targetUri.includes(domain)) {
			const parts = targetUri.split('/');
			const uname = parts[parts.length - 1];
			const localUser = await db.query.users.findFirst({
				where: eq(users.username, uname),
				columns: { id: true }
			});
			targetLocalId = localUser?.id || null;
		}
	} else {
		throw error(400, 'Must provide username, handle, or participantUri');
	}

	const conversation = await findOrCreateConversation(
		currentUserUri,
		locals.user.userId,
		targetUri,
		targetLocalId
	);

	return json({ conversation: { id: conversation.id } }, { status: 201 });
};
