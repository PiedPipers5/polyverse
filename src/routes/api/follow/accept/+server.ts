import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { followers, users } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import type { RequestHandler } from '@sveltejs/kit';

/**
 * POST /api/follow/accept
 *
 * Accept or reject a pending follow request.
 *
 * Body: {
 *   "followerUsername": "bob",   // the user who sent the follow request
 *   "action": "accept" | "reject"
 * }
 *
 * Only the target user (the one being followed) can call this.
 */
export const POST: RequestHandler = async ({ request, locals }) => {
    const user = locals.user;
    if (!user) {
        throw error(401, 'Unauthorized');
    }

    let body;
    try {
        body = await request.json();
    } catch {
        throw error(400, 'Invalid JSON body');
    }

    const { followerUsername, action } = body;

    if (!followerUsername || typeof followerUsername !== 'string') {
        throw error(400, '"followerUsername" is required');
    }

    if (!action || !['accept', 'reject'].includes(action)) {
        throw error(400, '"action" must be "accept" or "reject"');
    }

    // Resolve the follower user
    const followerUser = await db.query.users.findFirst({
        where: eq(users.username, followerUsername),
        columns: { id: true, username: true }
    });

    if (!followerUser) {
        throw error(404, `User @${followerUsername} not found`);
    }

    // Find the pending follow request where current user = target (userId)
    const pendingFollow = await db.query.followers.findFirst({
        where: and(
            eq(followers.userId, user.userId),
            eq(followers.followerId, followerUser.id),
            eq(followers.status, 'pending')
        )
    });

    if (!pendingFollow) {
        throw error(404, `No pending follow request from @${followerUsername}`);
    }

    if (action === 'accept') {
        await db
            .update(followers)
            .set({ status: 'accepted' })
            .where(eq(followers.id, pendingFollow.id));

        return json({ success: true, message: `Accepted follow request from @${followerUsername}` });
    } else {
        // Reject = delete the row
        await db.delete(followers).where(eq(followers.id, pendingFollow.id));

        return json({ success: true, message: `Rejected follow request from @${followerUsername}` });
    }
};

/**
 * GET /api/follow/accept
 *
 * Returns the current user's pending follow requests (people wanting to follow you).
 */
export const GET: RequestHandler = async ({ locals }) => {
    const user = locals.user;
    if (!user) {
        throw error(401, 'Unauthorized');
    }

    // Pending requests where current user is the target
    const pendingRequests = await db.query.followers.findMany({
        where: and(
            eq(followers.userId, user.userId),
            eq(followers.status, 'pending')
        )
    });

    // Hydrate with user info
    const followerIds = pendingRequests
        .map((r) => r.followerId)
        .filter((id): id is string => id !== null);

    let followerUsers: { id: string; username: string; displayName: string | null; avatarUrl: string | null }[] = [];
    if (followerIds.length > 0) {
        followerUsers = await db.query.users.findMany({
            columns: { id: true, username: true, displayName: true, avatarUrl: true }
        });
        followerUsers = followerUsers.filter((u) => followerIds.includes(u.id));
    }

    const userMap = new Map(followerUsers.map((u) => [u.id, u]));

    return json({
        pendingRequests: pendingRequests.map((r) => {
            const follower = r.followerId ? userMap.get(r.followerId) : null;
            return {
                id: r.id,
                follower: follower
                    ? {
                        username: follower.username,
                        displayName: follower.displayName,
                        avatarUrl: follower.avatarUrl
                    }
                    : null,
                createdAt: r.createdAt
            };
        })
    });
};
