/**
 * Notifications API (Tasks 4.4.2, 4.4.4)
 *
 * GET /api/notifications — list notifications for the authenticated user
 * POST /api/notifications — mark notification(s) as read
 */

import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { notifications, users, remoteActors } from '$lib/server/db/schema';
import { eq, and, desc, lt, inArray } from 'drizzle-orm';
import type { RequestHandler } from '@sveltejs/kit';

/**
 * GET /api/notifications?before=<ISO timestamp>&limit=20
 *
 * Returns notifications for the authenticated user, newest-first.
 */
export const GET: RequestHandler = async ({ url, locals }) => {
    const user = locals.user;
    if (!user) {
        throw error(401, 'Unauthorized');
    }

    const before = url.searchParams.get('before');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 50);
    const unreadOnly = url.searchParams.get('unread') === 'true';

    const conditions = [eq(notifications.recipientId, user.userId)];

    if (before) {
        const cursor = new Date(before);
        if (!isNaN(cursor.getTime())) {
            conditions.push(lt(notifications.createdAt, cursor));
        }
    }

    if (unreadOnly) {
        conditions.push(eq(notifications.read, false));
    }

    const rows = await db.query.notifications.findMany({
        where: and(...conditions),
        orderBy: [desc(notifications.createdAt)],
        limit: limit + 1
    });

    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit);

    // Hydrate actor info
    const localActorIds = [...new Set(items.map((n) => n.actorId).filter(Boolean))] as string[];

    let actorMap = new Map<string, any>();
    if (localActorIds.length > 0) {
        const actorUsers = await db.query.users.findMany({
            where: inArray(users.id, localActorIds),
            columns: { id: true, username: true, displayName: true, avatarUrl: true }
        });
        actorMap = new Map(actorUsers.map((u) => [u.id, u]));
    }

    // Count unread
    const allUnread = await db.query.notifications.findMany({
        where: and(
            eq(notifications.recipientId, user.userId),
            eq(notifications.read, false)
        ),
        columns: { id: true }
    });

    const nextCursor =
        hasMore && items.length > 0
            ? items[items.length - 1].createdAt.toISOString()
            : null;

    return json({
        notifications: items.map((n) => {
            const actor = n.actorId ? actorMap.get(n.actorId) : null;
            return {
                id: n.id,
                type: n.type,
                objectId: n.objectId,
                read: n.read,
                createdAt: n.createdAt.toISOString(),
                remoteActorUri: n.remoteActorUri,
                actor: actor
                    ? {
                        username: actor.username,
                        displayName: actor.displayName,
                        avatarUrl: actor.avatarUrl,
                        profileUrl: `/u/@${actor.username}`
                    }
                    : n.remoteActorUri
                        ? { username: n.remoteActorUri, displayName: null, avatarUrl: null, profileUrl: n.remoteActorUri }
                        : null
            };
        }),
        unreadCount: allUnread.length,
        nextCursor
    });
};

/**
 * POST /api/notifications
 *
 * Task 4.4.4: Mark notification(s) as read.
 *
 * Body: { "ids": ["uuid1", "uuid2", ...] }
 *   or: { "all": true }
 */
export const POST: RequestHandler = async ({ request, locals }) => {
    const user = locals.user;
    if (!user) {
        throw error(401, 'Unauthorized');
    }

    const body = await request.json();
    const { ids, all } = body;

    if (all === true) {
        // Mark all as read
        await db
            .update(notifications)
            .set({ read: true })
            .where(
                and(
                    eq(notifications.recipientId, user.userId),
                    eq(notifications.read, false)
                )
            );

        return json({ success: true, message: 'All notifications marked as read' });
    }

    if (Array.isArray(ids) && ids.length > 0) {
        // Mark specific notifications as read
        await db
            .update(notifications)
            .set({ read: true })
            .where(
                and(
                    eq(notifications.recipientId, user.userId),
                    inArray(notifications.id, ids)
                )
            );

        return json({ success: true, message: `${ids.length} notification(s) marked as read` });
    }

    throw error(400, 'Either "ids" (array) or "all" (true) is required');
};
