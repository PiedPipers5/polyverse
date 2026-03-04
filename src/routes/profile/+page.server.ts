import { redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { users, activities, followers, interactions } from '$lib/server/db/schema';
import { eq, count, and, inArray } from 'drizzle-orm';
import { env } from '$env/dynamic/private';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
    // Require authentication
    if (!locals.user) {
        throw redirect(302, '/login');
    }

    // Fetch full user profile
    const user = await db.query.users.findFirst({
        where: eq(users.id, locals.user.userId),
        columns: {
            id: true,
            username: true,
            displayName: true,
            bio: true,
            avatarUrl: true,
            didDocument: true,
            createdAt: true,
        }
    });

    if (!user) {
        throw redirect(302, '/login');
    }

    // Extract DID from document
    const did = (user.didDocument as { id: string }).id;
    const domain = env.DOMAIN!;

    // Run parallel queries
    const [
        recentActivities,
        followersResult,
        followingResult,
        postsCountResult,
        pendingFollowRows
    ] = await Promise.all([
        db.query.activities.findMany({
            where: and(eq(activities.actorId, user.id), eq(activities.type, 'Create')),
            orderBy: (activities, { desc }) => [desc(activities.createdAt)],
            limit: 50
        }),
        db.select({ count: count() }).from(followers).where(and(eq(followers.userId, user.id), eq(followers.status, 'accepted'))),
        db.select({ count: count() }).from(followers).where(and(eq(followers.followerId, user.id), eq(followers.status, 'accepted'))),
        db.query.activities.findMany({
            where: and(eq(activities.actorId, user.id), eq(activities.type, 'Create'))
        }),
        db.query.followers.findMany({ where: and(eq(followers.userId, user.id), eq(followers.status, 'pending')) })
    ]);

    const followersCount = followersResult[0]?.count || 0;
    const followingCount = followingResult[0]?.count || 0;

    // Count posts (only Create activities with non-Tombstone objects)
    const postsCount = postsCountResult.filter((a) => {
        const obj = (a.activity as any).object;
        return obj && obj.type !== 'Tombstone';
    }).length;

    const filteredActivities = recentActivities.filter((a) => {
        const obj = (a.activity as any).object;
        return obj && obj.type !== 'Tombstone';
    });

    // Hydrate interaction data and pending follower info in parallel
    const postIds = filteredActivities.map(a => (a.activity as any).object?.id || a.id);
    const pendingFollowerIds = [...new Set(pendingFollowRows.map(r => r.followerId).filter(Boolean))] as string[];

    const [interactionsData, pendingFollowersData] = await Promise.all([
        postIds.length > 0
            ? db.query.interactions.findMany({ where: inArray(interactions.postId, postIds) })
            : Promise.resolve([]),
        pendingFollowerIds.length > 0
            ? db.query.users.findMany({ where: inArray(users.id, pendingFollowerIds), columns: { id: true, username: true, displayName: true, avatarUrl: true } })
            : Promise.resolve([])
    ]);

    const hydratedActivities = filteredActivities.map(a => {
        const act = a.activity as any;
        const postId = act.object?.id || a.id;

        const postInteractions = interactionsData.filter(i => i.postId === postId);
        const upvotes = postInteractions.filter(i => i.type === 'upvote').length;
        const downvotes = postInteractions.filter(i => i.type === 'downvote').length;
        const netScore = upvotes - downvotes;
        const currentUserVote = postInteractions.find(i => i.actorId === user.id)?.type || null;

        return {
            ...a,
            content: act.object?.content || act.content || '',
            publishedAt: a.createdAt,
            netScore,
            userVote: currentUserVote
        };
    });

    const pendingUserMap = new Map(pendingFollowersData.map(u => [u.id, u]));

    const pendingRequests = pendingFollowRows.map(r => {
        const follower = r.followerId ? pendingUserMap.get(r.followerId) : null;
        return {
            id: r.id,
            follower: follower ? {
                username: follower.username,
                displayName: follower.displayName,
                avatarUrl: follower.avatarUrl
            } : null,
            createdAt: r.createdAt
        };
    });

    return {
        user: {
            id: user.id,
            username: user.username,
            displayName: user.displayName,
            bio: user.bio,
            avatarUrl: user.avatarUrl,
            did: did,
            domain: domain,
            handle: `@${user.username}@${domain}`,
            createdAt: user.createdAt,
            followersCount,
            followingCount,
            postsCount
        },
        activities: hydratedActivities,
        pendingRequests
    };
};
