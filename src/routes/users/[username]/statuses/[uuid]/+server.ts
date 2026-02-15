import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { activities, users, followers } from '$lib/server/db/schema';
import { eq, sql, and } from 'drizzle-orm';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

// Standard ActivityStreams Public URI
const PUBLIC_URI = 'https://www.w3.org/ns/activitystreams#Public';

/**
 * GET /users/[username]/statuses/[uuid]
 * 
 * Retrieves a single Note or Tombstone by its ID.
 * Handles 410 Gone for deleted items.
 * Enforces privacy/visibility checks.
 */
export const GET: RequestHandler = async ({ params, locals }) => {
    const { username, uuid } = params;
    const domain = env.DOMAIN!;
    const requestor = locals.user;

    // Construct the full object ID we are looking for
    const noteId = `https://${domain}/users/${username}/statuses/${uuid}`;

    // Find the activity that holds this object (in our schema, we update the Create activity)
    // We search for type='Create' because that's where the definitive copy of the object lives
    // (Edit/Delete update this record in our implementation)
    const record = await db.query.activities.findFirst({
        where: sql`${activities.activity}->'object'->>'id' = ${noteId} AND ${activities.type} = 'Create'`
    });

    if (!record) {
        throw error(404, 'Post not found');
    }

    const activity = record.activity as any;
    const object = activity.object;

    // 1. Handle Deleted Posts (Tombstones)
    if (object.type === 'Tombstone') {
        throw error(410, 'Gone');
    }

    // 2. Security / Visibility Check
    const to = object.to || [];
    const cc = object.cc || [];
    const audience = [...to, ...cc];

    const isPublic = audience.includes(PUBLIC_URI);
    const isOwner = requestor?.username === username;

    // Public or Owner -> Allow
    if (isOwner || isPublic) {
        return json(object, {
            headers: { 'Content-Type': 'application/activity+json' }
        });
    }

    // Authenticated checks (Direct Mention & Followers)
    if (requestor) {
        const userUri = `https://${domain}/users/${requestor.username}`;

        // 1. Is the post directly addressed to the requestor? (Direct Message / Mention)
        if (audience.includes(userUri)) {
            return json(object, {
                headers: { 'Content-Type': 'application/activity+json' }
            });
        }

        // 2. Followers-only check
        const followersUri = `https://${domain}/users/${username}/followers`;
        const isFollowersOnly = audience.includes(followersUri);

        if (isFollowersOnly) {
            // Check if requestor is actually a follower
            const targetUser = await db.query.users.findFirst({
                where: eq(users.username, username),
                columns: { id: true }
            });

            if (targetUser) {
                const followRecord = await db.query.followers.findFirst({
                    where: and(
                        eq(followers.userId, targetUser.id),
                        eq(followers.followerId, requestor.userId)
                    )
                });

                if (followRecord) {
                    return json(object, {
                        headers: { 'Content-Type': 'application/activity+json' }
                    });
                }
            }
        }
    }

    // If we got here, user is not authorized to see this post
    // Return 404 to avoid leaking existence of private posts, or 403
    // Standard practice for private resources is often 404 to hide existence,
    // but 403 is more semantically correct if we acknowledge existence.
    // Let's use 403 for now as it's clearer for debugging, or 404 if strictly private?
    // User Story 2.3.3 says "exclude the activity from the response" for outbox.
    // For direct specific access, 403 is fine.
    throw error(403, 'Forbidden');
};
