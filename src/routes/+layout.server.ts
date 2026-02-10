import type { LayoutServerLoad } from './$types';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Root layout server load - makes user data available to all pages
 */
export const load: LayoutServerLoad = async ({ locals }) => {
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
                }
            };
        }
    }

    // Return no user data if not authenticated
    return {
        user: null
    };
};
