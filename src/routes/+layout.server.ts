import type { LayoutServerLoad } from './$types';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { eq, sql } from 'drizzle-orm';

/**
 * Root layout server load - makes user data available to all pages
 */
export const load: LayoutServerLoad = async ({ locals }) => {
    // Fetch suggestions (real users)
    const suggestedUsers = await db.query.users.findMany({
        where: locals.user ? sql`${users.id} != ${locals.user.userId}` : undefined,
        orderBy: (users, { desc }) => [desc(users.createdAt)],
        limit: 15,
        columns: {
            username: true,
            displayName: true,
            avatarUrl: true,
        }
    });

    // If user is authenticated, fetch minimal user data for UI
    if (locals.user) {
        const user = await db.query.users.findFirst({
            where: eq(users.id, locals.user.userId),
            columns: {
                username: true,
                displayName: true,
                avatarUrl: true,
            }
        });

        if (user) {
            return {
                user: {
                    username: user.username,
                    displayName: user.displayName,
                    avatarUrl: user.avatarUrl,
                },
                suggestions: suggestedUsers
            };
        }
    }

    // Return no user data if not authenticated
    return {
        user: null,
        suggestions: suggestedUsers
    };
};
