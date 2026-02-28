import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { getFactory } from '$lib/server/redis/instance';

/**
 * Epic 3.4: Global Shared Inbox
 * 
 * Receives ActivityPub messages intended for multiple users on this instance.
 * To optimize performance, we enqueue the activity to Redis for async processing
 * instead of handling all fan-out logic synchronously.
 */
export const POST = async ({ request }: RequestEvent) => {
    try {
        const activity = await request.json();

        // Basic validation
        if (!activity || !activity.type || !activity.id) {
            return json({ error: 'Invalid ActivityPub object' }, { status: 400 });
        }

        const redisFactory = getFactory();
        const redis = redisFactory.getClient();

        // Push to Redis queue for background worker
        await redis.lpush('polyverse:shared_inbox_queue', JSON.stringify(activity));

        // Let the sender know we accepted it
        return new Response(null, { status: 202 });
    } catch (e) {
        console.error('Error in Shared Inbox:', e);
        return json({ error: 'Internal Server Error' }, { status: 500 });
    }
};
