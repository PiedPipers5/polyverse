import { redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { users, activities, followers } from '$lib/server/db/schema';
import { eq, count, and } from 'drizzle-orm';
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
        limit: 20
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

    // Count posts
    const postsResult = await db
        .select({ count: count() })
        .from(activities)
        .where(eq(activities.actorId, user.id));
    const postsCount = postsResult[0]?.count || 0;

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
        activities: recentActivities
            .filter((a) => {
                const obj = (a.activity as any).object;
                // Exclude deleted posts (tombstones)
                return obj && obj.type !== 'Tombstone';
            })
            .map((a) => ({
                ...a,
                content: (a.activity as any).object?.content || (a.activity as any).content || '',
                publishedAt: a.createdAt
            }))
    };
};
