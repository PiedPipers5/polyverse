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

    // Fetch recent activities for the logged-in user (only Create activities = actual posts)
    const recentActivities = await db.query.activities.findMany({
        where: and(
            eq(activities.actorId, user.id),
            eq(activities.type, 'Create')
        ),
        orderBy: (activities, { desc }) => [desc(activities.createdAt)],
        limit: 5
    });

    // Count followers
    const followersResult = await db
        .select({ count: count() })
        .from(followers)
        .where(eq(followers.userId, user.id));
    const followersCount = followersResult[0]?.count || 0;

    // Count following
    const followingResult = await db
        .select({ count: count() })
        .from(followers)
        .where(eq(followers.followerId, user.id));
    const followingCount = followingResult[0]?.count || 0;

    // Count posts (only Create activities with non-Tombstone objects)
    const allUserActivities = await db.query.activities.findMany({
        where: and(
            eq(activities.actorId, user.id),
            eq(activities.type, 'Create')
        )
    });

    // Filter out tombstones
    const nonDeletedPosts = allUserActivities.filter((a) => {
        const obj = (a.activity as any).object;
        return obj && obj.type !== 'Tombstone';
    });

    const postsCount = nonDeletedPosts.length;

    const filteredActivities = recentActivities.filter((a) => {
        const obj = (a.activity as any).object;
        // Exclude deleted posts (tombstones)
        return obj && obj.type !== 'Tombstone';
    });

    // Hydrate interaction data
    const postIds = filteredActivities.map(a => (a.activity as any).object?.id || a.id);
    let interactionsData: any[] = [];
    if (postIds.length > 0) {
        interactionsData = await db.query.interactions.findMany({
            where: inArray(interactions.postId, postIds)
        });
    }

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
        activities: hydratedActivities
    };
};
