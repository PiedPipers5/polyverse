import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
    const { username } = params;


    // Select User did document
    const user = await db.query.users.findFirst({
        where: eq(users.username, username),
        columns: {
            didDocument: true,
        }
    });

    if (!user) {
        throw error(404, "User Not Found!");
    }

    // Return user's json did
    return json(user.didDocument, {
        headers: {
            'Content-Type': 'application/did+ld+json'
        }
    });
}