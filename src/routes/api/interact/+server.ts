import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { interactions } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
    // Require authentication
    const user = locals.user;
    if (!user) {
        throw error(401, 'Unauthorized');
    }

    let body;
    try {
        body = await request.json();
    } catch (e) {
        throw error(400, 'Invalid JSON body');
    }

    const { postId, action } = body;

    if (!postId || !action) {
        throw error(400, 'postId and action are required');
    }

    if (!['upvote', 'downvote', 'remove'].includes(action)) {
        throw error(400, 'Invalid action. Must be upvote, downvote, or remove.');
    }

    try {
        if (action === 'remove') {
            await db.delete(interactions).where(
                and(
                    eq(interactions.postId, postId),
                    eq(interactions.actorId, user.userId)
                )
            );
        } else {
            // Upsert the interaction using Drizzle's onConflictDoUpdate
            await db.insert(interactions)
                .values({
                    postId: postId,
                    actorId: user.userId,
                    type: action,
                    createdAt: new Date()
                })
                .onConflictDoUpdate({
                    target: [interactions.postId, interactions.actorId],
                    set: {
                        type: action,
                        createdAt: new Date()
                    }
                });
        }

        return json({ success: true, action, postId });
    } catch (e: any) {
        console.error('[API Interact] Error processing interaction:', e);
        throw error(500, 'Internal server error');
    }
};
