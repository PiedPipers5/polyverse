/**
 * Like API (Tasks 4.2.2, 4.2.3, 4.2.4)
 *
 * POST /api/like — Like a post (generate Like activity, increment likes_count)
 * DELETE /api/like — Unlike a post (generate Undo(Like), decrement likes_count)
 */

import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { activities, likes, users } from '$lib/server/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { env } from '$env/dynamic/private';
import { enqueueDelivery } from '$lib/server/redis';
import type { RequestHandler } from '@sveltejs/kit';

/**
 * POST /api/like
 *
 * Generate a Like activity, save it, increment likes_count,
 * and deliver to the post author's inbox.
 *
 * Body: { "postId": "<ActivityPub post URI>" }
 */
export const POST: RequestHandler = async ({ request, locals }) => {
    const user = locals.user;
    if (!user) {
        throw error(401, 'Unauthorized');
    }

    const body = await request.json();
    const { postId } = body;

    if (!postId || typeof postId !== 'string') {
        throw error(400, '"postId" (ActivityPub URI of the post) is required');
    }

    const domain = env.DOMAIN!;
    const actorUri = `https://${domain}/users/${user.username}`;

    // Check for existing like
    const existingLike = await db.query.likes.findFirst({
        where: and(eq(likes.postId, postId), eq(likes.actorId, user.userId))
    });

    if (existingLike) {
        throw error(409, 'You have already liked this post');
    }

    // Generate Like activity
    const likeId = `https://${domain}/users/${user.username}/likes/${crypto.randomUUID()}`;
    const likeActivity = {
        '@context': 'https://www.w3.org/ns/activitystreams',
        id: likeId,
        type: 'Like',
        actor: actorUri,
        object: postId,
        published: new Date().toISOString()
    };

    // Save like record
    await db.insert(likes).values({
        postId,
        actorId: user.userId,
        likeActivityId: likeId,
        createdAt: new Date()
    });

    // Task 4.2.3: Increment likes_count on the local post record
    await db
        .update(activities)
        .set({ likesCount: sql`${activities.likesCount} + 1` })
        .where(
            sql`${activities.activity}->'object'->>'id' = ${postId} AND ${activities.type} = 'Create'`
        );

    // Deliver Like to the post author's inbox
    // Try to resolve the author from the post URI
    try {
        const postRecord = await db.query.activities.findFirst({
            where: sql`${activities.activity}->'object'->>'id' = ${postId} AND ${activities.type} = 'Create'`
        });

        if (postRecord) {
            const postActivity = postRecord.activity as any;
            const authorUri = postActivity.object?.attributedTo || postActivity.actor;

            if (authorUri && typeof authorUri === 'string' && !authorUri.startsWith(`https://${domain}`)) {
                // Remote post — try to resolve the author's inbox
                const { resolveRemoteActor } = await import('$lib/server/federation');
                // The authorUri is a full actor URI, not a handle — fetch directly
                const response = await fetch(authorUri, {
                    headers: {
                        Accept: 'application/activity+json'
                    },
                    signal: AbortSignal.timeout(10_000)
                });

                if (response.ok) {
                    const actorJson = await response.json();
                    if (actorJson.inbox) {
                        await enqueueDelivery({
                            activity: likeActivity,
                            inbox: actorJson.inbox,
                            actorUsername: user.username,
                            actorUserId: user.userId
                        });
                    }
                }
            }
        }
    } catch (err) {
        console.error('Failed to deliver Like activity:', err);
        // Like is saved locally even if delivery fails
    }

    return json({ success: true, likeId, postId }, { status: 201 });
};

/**
 * DELETE /api/like
 *
 * Task 4.2.4: Undo Like.
 * Generate an Undo(Like) activity, remove the like record, decrement likes_count.
 *
 * Body: { "postId": "<ActivityPub post URI>" }
 */
export const DELETE: RequestHandler = async ({ request, locals }) => {
    const user = locals.user;
    if (!user) {
        throw error(401, 'Unauthorized');
    }

    const body = await request.json();
    const { postId } = body;

    if (!postId || typeof postId !== 'string') {
        throw error(400, '"postId" (ActivityPub URI of the post) is required');
    }

    const domain = env.DOMAIN!;
    const actorUri = `https://${domain}/users/${user.username}`;

    // Find existing like
    const existingLike = await db.query.likes.findFirst({
        where: and(eq(likes.postId, postId), eq(likes.actorId, user.userId))
    });

    if (!existingLike) {
        throw error(404, 'You have not liked this post');
    }

    // Generate Undo(Like) activity
    const undoId = `https://${domain}/users/${user.username}/likes/${crypto.randomUUID()}#undo`;
    const undoActivity = {
        '@context': 'https://www.w3.org/ns/activitystreams',
        id: undoId,
        type: 'Undo',
        actor: actorUri,
        object: {
            id: existingLike.likeActivityId,
            type: 'Like',
            actor: actorUri,
            object: postId
        },
        published: new Date().toISOString()
    };

    // Remove like record
    await db.delete(likes).where(eq(likes.id, existingLike.id));

    // Decrement likes_count (ensure it doesn't go below 0)
    await db
        .update(activities)
        .set({ likesCount: sql`GREATEST(${activities.likesCount} - 1, 0)` })
        .where(
            sql`${activities.activity}->'object'->>'id' = ${postId} AND ${activities.type} = 'Create'`
        );

    // Deliver Undo(Like) to the post author's inbox
    try {
        const postRecord = await db.query.activities.findFirst({
            where: sql`${activities.activity}->'object'->>'id' = ${postId} AND ${activities.type} = 'Create'`
        });

        if (postRecord) {
            const postActivity = postRecord.activity as any;
            const authorUri = postActivity.object?.attributedTo || postActivity.actor;

            if (authorUri && typeof authorUri === 'string' && !authorUri.startsWith(`https://${domain}`)) {
                const response = await fetch(authorUri, {
                    headers: { Accept: 'application/activity+json' },
                    signal: AbortSignal.timeout(10_000)
                });

                if (response.ok) {
                    const actorJson = await response.json();
                    if (actorJson.inbox) {
                        await enqueueDelivery({
                            activity: undoActivity,
                            inbox: actorJson.inbox,
                            actorUsername: user.username,
                            actorUserId: user.userId
                        });
                    }
                }
            }
        }
    } catch (err) {
        console.error('Failed to deliver Undo(Like) activity:', err);
    }

    return json({ success: true, postId });
};
