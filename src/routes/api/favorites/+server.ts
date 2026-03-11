/**
 * Favorites API
 *
 * POST   /api/favorites  — Save a post to favorites
 * DELETE /api/favorites  — Remove a post from favorites
 * GET    /api/favorites  — List the current user's favorites (newest first)
 */

import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { favorites } from '$lib/server/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import type { RequestHandler } from '@sveltejs/kit';

/** POST /api/favorites — add a post to favorites */
export const POST: RequestHandler = async ({ request, locals }) => {
    const user = locals.user;
    if (!user) throw error(401, 'Unauthorized');

    const body = await request.json();
    const { postId, activitySnapshot } = body;

    if (!postId || typeof postId !== 'string') {
        throw error(400, '"postId" is required');
    }
    if (!activitySnapshot || typeof activitySnapshot !== 'object') {
        throw error(400, '"activitySnapshot" (the full activity JSON) is required');
    }

    // Check for existing favorite (idempotent)
    const existing = await db.query.favorites.findFirst({
        where: and(eq(favorites.postId, postId), eq(favorites.userId, user.userId))
    });

    if (existing) {
        return json({ success: true, alreadyFavorited: true }, { status: 200 });
    }

    await db.insert(favorites).values({
        postId,
        userId: user.userId,
        activitySnapshot,
        createdAt: new Date()
    });

    return json({ success: true }, { status: 201 });
};

/** DELETE /api/favorites — remove a post from favorites */
export const DELETE: RequestHandler = async ({ request, locals }) => {
    const user = locals.user;
    if (!user) throw error(401, 'Unauthorized');

    const body = await request.json();
    const { postId } = body;

    if (!postId || typeof postId !== 'string') {
        throw error(400, '"postId" is required');
    }

    await db
        .delete(favorites)
        .where(and(eq(favorites.postId, postId), eq(favorites.userId, user.userId)));

    return json({ success: true });
};

/** GET /api/favorites — list the user's favorites */
export const GET: RequestHandler = async ({ locals }) => {
    const user = locals.user;
    if (!user) throw error(401, 'Unauthorized');

    const rows = await db.query.favorites.findMany({
        where: eq(favorites.userId, user.userId),
        orderBy: [desc(favorites.createdAt)]
    });

    return json({ favorites: rows });
};
