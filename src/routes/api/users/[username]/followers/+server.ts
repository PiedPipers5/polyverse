import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { users, followers } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import type { RequestHandler } from '@sveltejs/kit';

/**
 * GET /api/users/[username]/followers
 *
 * Returns the followers list AND the following list for a given user.
 * Only 'accepted' follow relationships are returned.
 *
 * Query params:
 *   ?type=followers  (default) — people who follow this user
 *   ?type=following             — people this user follows
 */
export const GET: RequestHandler = async ({ params, url }) => {
    const { username } = params;
    const listType = url.searchParams.get('type') || 'followers';

    // Resolve user
    const targetUser = await db.query.users.findFirst({
        where: eq(users.username, username!),
        columns: { id: true, username: true }
    });

    if (!targetUser) {
        throw error(404, `User @${username} not found`);
    }

    if (listType === 'following') {
        // People this user follows (followerId = targetUser.id)
        const followingRows = await db.query.followers.findMany({
            where: and(
                eq(followers.followerId, targetUser.id),
                eq(followers.status, 'accepted')
            )
        });

        // Hydrate with user info
        const followedUserIds = followingRows
            .map((r) => r.userId)
            .filter((id): id is string => id !== null);

        let followedUsers: { id: string; username: string; displayName: string | null; avatarUrl: string | null }[] = [];
        if (followedUserIds.length > 0) {
            followedUsers = await db.query.users.findMany({
                columns: { id: true, username: true, displayName: true, avatarUrl: true }
            });
            followedUsers = followedUsers.filter((u) => followedUserIds.includes(u.id));
        }

        const userMap = new Map(followedUsers.map((u) => [u.id, u]));

        return json({
            type: 'following',
            users: followingRows.map((r) => {
                const u = r.userId ? userMap.get(r.userId) : null;
                return u
                    ? {
                        username: u.username,
                        displayName: u.displayName,
                        avatarUrl: u.avatarUrl,
                        followedAt: r.createdAt
                    }
                    : null;
            }).filter(Boolean)
        });
    }

    // Default: followers — people who follow this user (userId = targetUser.id)
    const followerRows = await db.query.followers.findMany({
        where: and(
            eq(followers.userId, targetUser.id),
            eq(followers.status, 'accepted')
        )
    });

    const followerUserIds = followerRows
        .map((r) => r.followerId)
        .filter((id): id is string => id !== null);

    let followerUsers: { id: string; username: string; displayName: string | null; avatarUrl: string | null }[] = [];
    if (followerUserIds.length > 0) {
        followerUsers = await db.query.users.findMany({
            columns: { id: true, username: true, displayName: true, avatarUrl: true }
        });
        followerUsers = followerUsers.filter((u) => followerUserIds.includes(u.id));
    }

    const userMap = new Map(followerUsers.map((u) => [u.id, u]));

    return json({
        type: 'followers',
        users: followerRows.map((r) => {
            const u = r.followerId ? userMap.get(r.followerId) : null;
            return u
                ? {
                    username: u.username,
                    displayName: u.displayName,
                    avatarUrl: u.avatarUrl,
                    followedAt: r.createdAt
                }
                : null;
        }).filter(Boolean)
    });
};
