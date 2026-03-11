import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const load: PageServerLoad = async ({ locals }) => {
    if (!locals.user) {
        throw redirect(302, '/login');
    }

    const user = await db.query.users.findFirst({
        where: eq(users.id, locals.user.userId),
        columns: {
            username: true
        }
    });

    if (!user) {
        throw redirect(302, '/login');
    }

    return {
        user: {
            username: user.username
        }
    };
};
