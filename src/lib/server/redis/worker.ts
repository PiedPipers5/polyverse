import { getFactory } from './instance.js';
import { db } from '../db/index.js';
import { activities, followers, users } from '../db/schema.js';
import { eq, inArray } from 'drizzle-orm';
import { resolveRemoteActor } from '../federation.js';
import type { Redis } from 'ioredis';

const QUEUE_KEY = 'polyverse:shared_inbox_queue';
let isRunning = false;

/**
 * Background worker that processes the shared inbox queue.
 * In a real production app, you might use BullMQ or a dedicated worker process
 * rather than running this inside the main SvelteKit web process.
 */
export async function startSharedInboxWorker(): Promise<void> {
    if (isRunning) return;
    isRunning = true;

    try {
        const redisFactory = getFactory();
        const redis = redisFactory.getClient();

        console.log('Shared Inbox worker started listening to', QUEUE_KEY);

        // Continuous loop to pop items from the queue
        while (isRunning) {
            try {
                // Block for up to 5 seconds waiting for an item
                const result = await redis.brpop(QUEUE_KEY, 5);

                if (result) {
                    const [_key, value] = result;
                    const activity = JSON.parse(value);
                    await processActivity(activity, redis);
                }
            } catch (err) {
                console.error('Error in Shared Inbox worker loop:', err);
                // Pause briefly on error to avoid tight spin-loop
                await new Promise(res => setTimeout(res, 5000));
            }
        }
    } catch (err) {
        console.error('Failed to start Shared Inbox worker:', err);
        isRunning = false;
    }
}

export function stopSharedInboxWorker(): void {
    isRunning = false;
}

/**
 * Epic 3.4 Fan-Out Logic
 */
async function processActivity(activity: any, redis: Redis): Promise<void> {
    console.log(`Processing Shared Inbox activity: ${activity.type} ${activity.id}`);

    // 1. Identify the sender
    const actorUri = activity.actor || activity.attributedTo;
    if (!actorUri || typeof actorUri !== 'string') {
        console.warn('Activity missing actor or attributedTo URI, dropping.', activity);
        return;
    }

    // We need to resolve the actor. We can assume the actor is remote 
    // since they are hitting our internal shared inbox. 
    // In a full implementation, we'd lookup by URI directly.
    // For Epic 3.4 we just blindly save the activity for now to demonstrate fan-out.

    // First, find or create the remote actor record
    // In a real implementation we'd do WebFinger here. For now we just lookup by URI.
    // Since we don't have a reliable generic URI lookup yet in federation.ts, we'll
    // try to find them if they exist.
    let remoteActorId: string | null = null;

    const existingActor = await db.query.remoteActors.findFirst({
        where: (remoteActors, { eq }) => eq(remoteActors.actorUri, actorUri)
    });

    if (existingActor) {
        remoteActorId = existingActor.id;
    } else {
        // If we don't have the actor stored in our DB yet, we can't properly link it
        // and we cannot easily find followers. We should drop it or fetch them.
        // For Epic 3.4, we'll do a simple best-effort insert if we can parse the handle.
        console.warn(`Received activity from unknown remote actor: ${actorUri}`);
        return;
    }

    // 2. Query the DB for all local users following this sender
    const followingRelationships = await db.query.followers.findMany({
        where: eq(followers.remoteUserId, remoteActorId),
        columns: {
            followerId: true
        }
    });

    // Extract local user IDs
    const followersToNotify = followingRelationships
        .map(f => f.followerId)
        .filter((id): id is string => id !== null);

    if (followersToNotify.length === 0) {
        console.log(`No local followers for ${actorUri}, ignoring activity.`);
        return;
    }

    console.log(`Fanning out activity to ${followersToNotify.length} local followers.`);

    // 3. Insert the activity into the activities table
    // In a fully optimized system with a single activities table,
    // we just store the activity ONCE, pointing to the remote actor.
    // The feed query will find it because it looks for activities from people the user follows.

    // Check if we already have it (deduplication)
    // Note: ActivityPub IDs are URIs, but our activities table ID is a UUID.
    // We should ideally have a unique `uri` column on activities.
    // For now we just insert it.

    await db.insert(activities).values({
        remoteActorId: remoteActorId,
        activity: activity,
        type: activity.type
    });
}
