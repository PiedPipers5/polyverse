import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { users, federatedFollows, notifications } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { env } from '$env/dynamic/private';
import { enqueueDelivery } from '$lib/server/redis/deliveryWorker';
import { resolveRemoteActor } from '$lib/server/federation';
import * as crypto from 'node:crypto';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
    const user = locals.user;
    if (!user) {
        throw error(401, 'Unauthorized');
    }

    const { notificationId } = await request.json();

    if (!notificationId) {
        throw error(400, 'notificationId is required');
    }

    // 1. Fetch the notification to get the followActivityId
    const notification = await db.query.notifications.findFirst({
        where: and(
            eq(notifications.id, notificationId),
            eq(notifications.recipientId, user.userId),
            eq(notifications.type, 'follow')
        )
    });

    if (!notification || !notification.objectId) {
        throw error(404, 'Follow notification not found');
    }

    const followActivityId = notification.objectId;

    // 2. Find the pending follow request
    const followRecord = await db.query.federatedFollows.findFirst({
        where: and(
            eq(federatedFollows.localUserId, user.userId),
            eq(federatedFollows.followActivityId, followActivityId),
            eq(federatedFollows.status, 'pending')
        )
    });

    if (!followRecord) {
        // It might already be accepted
        return json({ success: true, message: 'Follow request already accepted or not found' });
    }

    // 3. Resolve the remote actor to get their inbox URL
    const remoteActorResult = await resolveRemoteActor(followRecord.remoteActorUri);
    if (!remoteActorResult) {
        throw error(500, 'Could not resolve remote actor');
    }

    const remoteActor = remoteActorResult.actor;
    const inboxUrl = (remoteActor.inbox as string) || null;
    if (!inboxUrl) {
        throw error(500, 'Remote actor has no inbox');
    }

    // 4. Construct the Accept activity
    const domain = env.DOMAIN || 'polyverse-pp.vercel.app';
    const localUserResult = await db.query.users.findFirst({
        where: eq(users.id, user.userId),
        columns: { username: true }
    });

    if (!localUserResult) {
        throw error(500, 'Local user not found');
    }

    const localActorUri = `https://${domain}/users/${localUserResult.username}`;
    const acceptActivityId = `https://${domain}/activities/${crypto.randomUUID()}`;

    // Reconstruct the Follow activity object to wrap it in the Accept
    const acceptActivity = {
        '@context': 'https://www.w3.org/ns/activitystreams',
        id: acceptActivityId,
        type: 'Accept',
        actor: localActorUri,
        object: remoteActor.id || followRecord.remoteActorUri, // This is incorrect, let me see
        to: [followRecord.remoteActorUri]
    };
    // Wait, the `object` of an Accept(Follow) activity MUST be the exact Follow activity:
    acceptActivity.object = {
        type: 'Follow',
        id: followActivityId,
        actor: followRecord.remoteActorUri,
        object: localActorUri
    } as any;

    // 5. Enqueue the Follow Accept activity
    await enqueueDelivery({
        activity: acceptActivity,
        inbox: inboxUrl,
        actorUsername: localUserResult.username,
        actorUserId: user.userId
    });

    // 6. Update local database state
    await db.update(federatedFollows)
        .set({ status: 'accepted', updatedAt: new Date() })
        .where(eq(federatedFollows.id, followRecord.id));

    // Mark the notification as read
    await db.update(notifications)
        .set({ read: true })
        .where(eq(notifications.id, notificationId));

    return json({ success: true, message: 'Follow request accepted' });
};
