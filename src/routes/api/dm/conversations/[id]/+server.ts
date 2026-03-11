import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import {
	conversations,
	directMessages,
	users,
	remoteActors
} from '$lib/server/db/schema';
import { eq, and, desc, sql, or, asc } from 'drizzle-orm';
import { env } from '$env/dynamic/private';
import { enqueueDelivery } from '$lib/server/redis/deliveryWorker';
import type { RequestHandler } from '@sveltejs/kit';

const getActorUri = (username: string) => `https://${env.DOMAIN}/users/${username}`;

/**
 * GET /api/dm/conversations/[id]
 * Fetch messages for a conversation. Marks unread messages as read.
 */
export const GET: RequestHandler = async ({ params, locals, url }) => {
	if (!locals.user) throw error(401, 'Unauthorized');

	const conversationId = params.id!;
	const currentUserUri = getActorUri(locals.user.username);

	// Verify the user is a participant in this conversation
	const convo = await db.query.conversations.findFirst({
		where: and(
			eq(conversations.id, conversationId),
			or(
				eq(conversations.participantOneUri, currentUserUri),
				eq(conversations.participantTwoUri, currentUserUri)
			)
		)
	});

	if (!convo) throw error(404, 'Conversation not found');

	// Pagination
	const limit = parseInt(url.searchParams.get('limit') || '50');
	const before = url.searchParams.get('before'); // cursor-based pagination

	// Fetch messages
	const messages = await db.query.directMessages.findMany({
		where: before
			? and(
				eq(directMessages.conversationId, conversationId),
				sql`${directMessages.createdAt} < ${new Date(before)}`
			)
			: eq(directMessages.conversationId, conversationId),
		orderBy: [asc(directMessages.createdAt)],
		limit
	});

	// Mark unread messages from the other user as read
	await db
		.update(directMessages)
		.set({ read: true })
		.where(
			and(
				eq(directMessages.conversationId, conversationId),
				eq(directMessages.read, false),
				sql`${directMessages.senderUri} != ${currentUserUri}`
			)
		);

	// Get participant info
	const otherUri = convo.participantOneUri === currentUserUri
		? convo.participantTwoUri
		: convo.participantOneUri;
	const otherLocalId = convo.participantOneUri === currentUserUri
		? convo.participantTwoId
		: convo.participantOneId;

	let otherName: string | null = null;
	let otherAvatar: string | null = null;
	let otherHandle: string = otherUri;

	if (otherLocalId) {
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

	return json({
		conversation: {
			id: convo.id,
			otherParticipant: {
				uri: otherUri,
				name: otherName,
				avatar: otherAvatar,
				handle: otherHandle
			}
		},
		messages: messages.map((m) => ({
			id: m.id,
			content: m.content,
			senderUri: m.senderUri,
			isOwn: m.senderUri === currentUserUri,
			read: m.read,
			createdAt: m.createdAt.toISOString()
		}))
	});
};

/**
 * POST /api/dm/conversations/[id]
 * Send a message in a conversation.
 * Body: { content: string }
 */
export const POST: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');

	const conversationId = params.id!;
	const currentUserUri = getActorUri(locals.user.username);
	const body = await request.json();
	const { content } = body;

	if (!content || typeof content !== 'string' || content.trim().length === 0) {
		throw error(400, 'Message content is required');
	}

	// Verify participant
	const convo = await db.query.conversations.findFirst({
		where: and(
			eq(conversations.id, conversationId),
			or(
				eq(conversations.participantOneUri, currentUserUri),
				eq(conversations.participantTwoUri, currentUserUri)
			)
		)
	});

	if (!convo) throw error(404, 'Conversation not found');

	const domain = env.DOMAIN!;
	const otherUri = convo.participantOneUri === currentUserUri
		? convo.participantTwoUri
		: convo.participantOneUri;

	// Construct the ActivityPub Note (DM = to is only the recipient, no Public)
	const noteId = `https://${domain}/users/${locals.user.username}/statuses/${crypto.randomUUID()}`;
	const published = new Date().toISOString();

	const note = {
		id: noteId,
		type: 'Note',
		published,
		attributedTo: currentUserUri,
		content: content.trim(),
		to: [otherUri],
		cc: [],
		tag: []
	};

	const createActivity = {
		'@context': 'https://www.w3.org/ns/activitystreams',
		id: `https://${domain}/users/${locals.user.username}/statuses/${crypto.randomUUID()}`,
		type: 'Create',
		actor: currentUserUri,
		published,
		to: [otherUri],
		cc: [],
		object: note
	};

	// Save to database
	const [message] = await db.insert(directMessages).values({
		conversationId,
		senderUri: currentUserUri,
		senderLocalId: locals.user.userId,
		content: content.trim(),
		activityJson: createActivity,
		read: false,
		createdAt: new Date()
	}).returning();

	// Update conversation's lastMessageAt
	await db
		.update(conversations)
		.set({ lastMessageAt: new Date() })
		.where(eq(conversations.id, conversationId));

	// If the other participant is remote, deliver via federation
	const isRemote = !otherUri.includes(domain);
	if (isRemote) {
		// Resolve the remote actor to get their inbox
		let inbox: string | null = null;
		const remoteActor = await db.query.remoteActors.findFirst({
			where: eq(remoteActors.actorUri, otherUri)
		});

		if (remoteActor) {
			const actorJson = remoteActor.actorJson as Record<string, unknown>;
			inbox = (actorJson.inbox as string) || null;
		}

		if (inbox) {
			await enqueueDelivery({
				activity: createActivity,
				inbox,
				actorUsername: locals.user.username,
				actorUserId: locals.user.userId
			});
		} else {
			console.warn(`[DM] Could not find inbox for remote actor ${otherUri}`);
		}
	}

	return json({
		message: {
			id: message.id,
			content: message.content,
			senderUri: message.senderUri,
			isOwn: true,
			read: false,
			createdAt: message.createdAt.toISOString()
		}
	}, { status: 201 });
};
