/**
 * Context Fetcher (Task 3.5.4)
 *
 * When a remote post references a parent (inReplyTo) that we don't have locally,
 * this module attempts to fetch the parent post from the remote server and cache it.
 */

import { db } from '$lib/server/db';
import { activities, remoteActors } from '$lib/server/db/schema';
import { eq, sql } from 'drizzle-orm';

/**
 * Fetch and cache a remote post if we don't have it locally.
 *
 * @param postUri - The ActivityPub URI of the post to fetch
 * @returns The post object if found/fetched, or null
 */
export async function fetchContextPost(
    postUri: string
): Promise<Record<string, unknown> | null> {
    if (!postUri || typeof postUri !== 'string') return null;

    // 1. Check if we already have it locally
    const existing = await db.query.activities.findFirst({
        where: sql`${activities.activity}->'object'->>'id' = ${postUri} AND ${activities.type} = 'Create'`
    });

    if (existing) {
        return (existing.activity as any).object || null;
    }

    // 2. Attempt to fetch from the remote server
    try {
        const response = await fetch(postUri, {
            headers: {
                'Accept':
                    'application/activity+json, application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
            },
            signal: AbortSignal.timeout(10_000)
        });

        if (!response.ok) {
            console.warn(`Context fetch failed for ${postUri}: HTTP ${response.status}`);
            return null;
        }

        const remoteObject = await response.json();

        // Basic validation
        if (!remoteObject.id || !remoteObject.type) {
            console.warn(`Invalid object received from ${postUri}`);
            return null;
        }

        // 3. Resolve the remote actor (attributedTo)
        const actorUri = remoteObject.attributedTo;
        let remoteActorId: string | null = null;

        if (actorUri && typeof actorUri === 'string') {
            const existingActor = await db.query.remoteActors.findFirst({
                where: eq(remoteActors.actorUri, actorUri)
            });
            if (existingActor) {
                remoteActorId = existingActor.id;
            }
        }

        // 4. Store as a Create activity so it's available in the activities table
        const createActivity = {
            '@context': 'https://www.w3.org/ns/activitystreams',
            id: `${postUri}#create`,
            type: 'Create',
            actor: actorUri,
            published: remoteObject.published || new Date().toISOString(),
            object: remoteObject
        };

        await db.insert(activities).values({
            remoteActorId: remoteActorId,
            activity: createActivity,
            type: 'Create',
            createdAt: remoteObject.published ? new Date(remoteObject.published) : new Date()
        });

        console.log(`Successfully fetched and cached context post: ${postUri}`);
        return remoteObject;
    } catch (err) {
        console.error(`Error fetching context for ${postUri}:`, err);
        return null;
    }
}
