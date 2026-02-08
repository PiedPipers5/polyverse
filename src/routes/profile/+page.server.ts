import { redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
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
        }
    };
};
