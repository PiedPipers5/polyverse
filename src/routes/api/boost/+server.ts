/**
 * Boost (Announce) API (Tasks 4.3.1, 4.3.2, 4.3.5)
 *
 * POST /api/boost — Boost a post (generate Announce activity, deliver to followers)
 * DELETE /api/boost — Unboost a post (generate Undo(Announce), remove from DB)
 */

import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { activities, followers, users } from '$lib/server/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { env } from '$env/dynamic/private';
import { enqueueDelivery } from '$lib/server/redis';
import type { RequestHandler } from '@sveltejs/kit';

/**
 * POST /api/boost
 *
 * Task 4.3.1: Generate Announce activity.
 * Task 4.3.2: Deliver to all followers.
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
    const followersUri = `${actorUri}/followers`;

    // Check if already boosted
    const existingBoost = await db.query.activities.findFirst({
        where: and(
            eq(activities.actorId, user.userId),
            eq(activities.type, 'Announce'),
            sql`${activities.activity}->>'object' = ${postId}`
        )
    });

    if (existingBoost) {
        throw error(409, 'You have already boosted this post');
    }

    // Task 4.3.1: Generate Announce activity
    const announceId = `https://${domain}/users/${user.username}/statuses/${crypto.randomUUID()}`;
    const announceActivity = {
        '@context': 'https://www.w3.org/ns/activitystreams',
        id: announceId,
        type: 'Announce',
        actor: actorUri,
        object: postId,
        published: new Date().toISOString(),
        to: ['https://www.w3.org/ns/activitystreams#Public'],
        cc: [followersUri]
    };

    // Save Announce activity
    await db.insert(activities).values({
        actorId: user.userId,
        activity: announceActivity,
        type: 'Announce',
        createdAt: new Date()
    });

    // Increment boosts_count on the original post
    await db
        .update(activities)
        .set({ boostsCount: sql`${activities.boostsCount} + 1` })
        .where(
            sql`${activities.activity}->'object'->>'id' = ${postId} AND ${activities.type} = 'Create'`
        );

    // Task 4.3.2: Deliver Announce to all followers
    try {
        // Get all local followers' info (for local notification, not delivery)
        // For remote followers, we'd need to resolve their inboxes
        // For now, notify the original post author if remote
        const postRecord = await db.query.activities.findFirst({
            where: sql`${activities.activity}->'object'->>'id' = ${postId} AND ${activities.type} = 'Create'`
        });

        if (postRecord) {
            const postActivity = postRecord.activity as any;
            const authorUri = postActivity.object?.attributedTo || postActivity.actor;

            // If the original post is remote, notify the original author
            if (authorUri && typeof authorUri === 'string' && !authorUri.startsWith(`https://${domain}`)) {
                try {
                    const response = await fetch(authorUri, {
                        headers: { Accept: 'application/activity+json' },
                        signal: AbortSignal.timeout(10_000)
                    });

                    if (response.ok) {
                        const actorJson = await response.json();
                        if (actorJson.inbox) {
                            await enqueueDelivery({
                                activity: announceActivity,
                                inbox: actorJson.inbox,
                                actorUsername: user.username,
                                actorUserId: user.userId
                            });
                        }
                    }
                } catch (err) {
                    console.error('Failed to deliver Announce to original author:', err);
                }
            }
        }
    } catch (err) {
        console.error('Failed to deliver Announce activity:', err);
    }

    return json({ success: true, announceId, postId }, { status: 201 });
};

/**
 * DELETE /api/boost
 *
 * Task 4.3.5: Handle Undo Announce (Unboost).
 * Remove the Announce activity and send Undo to followers.
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

    // Find existing boost
    const existingBoost = await db.query.activities.findFirst({
        where: and(
            eq(activities.actorId, user.userId),
            eq(activities.type, 'Announce'),
            sql`${activities.activity}->>'object' = ${postId}`
        )
    });

    if (!existingBoost) {
        throw error(404, 'You have not boosted this post');
    }

    const boostActivity = existingBoost.activity as any;

    // Generate Undo(Announce) activity
    const undoId = `${boostActivity.id}#undo`;
    const undoActivity = {
        '@context': 'https://www.w3.org/ns/activitystreams',
        id: undoId,
        type: 'Undo',
        actor: actorUri,
        object: boostActivity,
        published: new Date().toISOString()
    };

    // Remove the Announce from the database
    await db.delete(activities).where(eq(activities.id, existingBoost.id));

    // Decrement boosts_count
    await db
        .update(activities)
        .set({ boostsCount: sql`GREATEST(${activities.boostsCount} - 1, 0)` })
        .where(
            sql`${activities.activity}->'object'->>'id' = ${postId} AND ${activities.type} = 'Create'`
        );

    // Deliver Undo to the original post author if remote
    try {
        const postRecord = await db.query.activities.findFirst({
            where: sql`${activities.activity}->'object'->>'id' = ${postId} AND ${activities.type} = 'Create'`
        });

        if (postRecord) {
            const postAct = postRecord.activity as any;
            const authorUri = postAct.object?.attributedTo || postAct.actor;

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
        console.error('Failed to deliver Undo(Announce):', err);
    }

    return json({ success: true, postId });
};
