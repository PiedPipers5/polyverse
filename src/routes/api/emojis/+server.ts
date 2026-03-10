import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { customEmojis } from '$lib/server/db/schema';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
    try {
        const emojis = await db.query.customEmojis.findMany();
        return json(emojis);
    } catch (e) {
        console.error('Failed to fetch emojis:', e);
        return json({ error: 'Failed to fetch emojis' }, { status: 500 });
    }
};
