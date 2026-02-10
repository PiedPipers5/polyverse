import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { activities, users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';
import { v4 as uuidv4 } from 'uuid';
import { Note, Create, Person, Mention } from '@fedify/fedify';
import { Temporal } from '@js-temporal/polyfill';

/**
 * Handle publishing of new activities (posts).
 * 
 * User Story 2.1: Publishing a Note
 */
export const POST: RequestHandler = async ({ request, locals, params }) => {
    // 1. Authentication Check
    const session = locals.user;
    if (!session) {
        throw error(401, 'Unauthorized');
    }

    // Ensure the logged-in user matches the outbox owner
    if (params.username !== 'me' && session.username !== params.username) {
        throw error(403, 'Forbidden: You can only post to your own outbox.');
    }

    // 2. Input Parsing 
    const content = await request.text();
    if (!content || content.length > 500) {
        throw error(400, 'Content is required and must be under 500 characters.');
    }

    const domain = env.DOMAIN || 'localhost:5173'; // Fallback for dev
    const protocol = env.PROTOCOL || 'http';
    const actorIdUrl = `${protocol}://${domain}/users/${session.username}`;

    // Generate IDs
    const noteId = uuidv4();
    const activityId = uuidv4();
    const noteUrl = `${actorIdUrl}/statuses/${noteId}`;
    const activityUrl = `${actorIdUrl}/statuses/${activityId}/activity`;

    // 3. Construct ActivityPub Objects using Fedify
    const now = Temporal.Now.instant();

    // Create the Note object
    const note = new Note({
        id: new URL(noteUrl),
        attribution: new URL(actorIdUrl),
        to: new URL('https://www.w3.org/ns/activitystreams#Public'),
        cc: new URL(`${actorIdUrl}/followers`),
        content: content,
        published: now,
        url: new URL(noteUrl),
    });

    // Wrap in Create activity
    const create = new Create({
        id: new URL(activityUrl),
        actor: new URL(actorIdUrl),
        to: new URL('https://www.w3.org/ns/activitystreams#Public'),
        cc: new URL(`${actorIdUrl}/followers`),
        object: note,
        published: now,
    });

    // Serialize to JSON-LD
    const activityJson = await create.toJsonLd();

    // 4. Persist to Database
    try {
        await db.insert(activities).values({
            id: activityId,
            actorId: session.userId, // UUID from session
            activityJson: activityJson,
            publishedAt: new Date(now.epochMilliseconds),
        });

        // In a real implementation, we would also:
        // - Push to a job queue for federation (delivering to followers).
        // - Ingest into the local feed.

    } catch (err) {
        console.error('Failed to save activity:', err);
        throw error(500, 'Internal Server Error');
    }

    // 5. Return Success
    // The Location header should point to the created resource
    return new Response(JSON.stringify(activityJson), {
        status: 201,
        headers: {
            'Content-Type': 'application/activity+json',
            'Location': activityUrl
        }
    });
};
