import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { activities, users, followers } from '$lib/server/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

// Standard ActivityStreams Public URI
const PUBLIC_URI = 'https://www.w3.org/ns/activitystreams#Public';

/**
 * Helper to construct full Actor URI
 */
const getActorUri = (domain: string, username: string) => `https://${domain}/users/${username}`;

/**
 * POST /users/[username]/outbox
 * 
 * User Story 2.1: Publishing a Note
 * Creates a Note and wraps it in a Create activity.
 * 
 * Expected Body:
 * {
 *   "content": "Hello World",
 *   "privacy": "public" | "unlisted" | "followers",
 *   "media": [ { "url": "...", "type": "Image", "mediaType": "image/jpeg" } ]
 * }
 */
export const POST: RequestHandler = async ({ params, request, locals }) => {
    const { username } = params;
    const user = locals.user;

    // 1. Authentication Check
    if (!user) {
        throw error(401, 'Unauthorized');
    }

    // 2. Authorization Check (Can only post to own outbox)
    if (user.username !== username) {
        throw error(403, 'Forbidden: You can only post to your own outbox.');
    }

    const domain = env.DOMAIN!;
    const body = await request.json();
    // Default to 'create' if no action specified
    const { action = 'create', content, privacy = 'public', media = [], language = 'en', objectId } = body;

    const actorUri = getActorUri(domain, username);
    const published = new Date().toISOString();

    if (action === 'create') {
        if (!content && media.length === 0) {
            throw error(400, 'Content or media is required.');
        }

        // 3. Determine Audience (to/cc)
        const followersUri = `${actorUri}/followers`;
        let to: string[] = [];
        let cc: string[] = [];

        switch (privacy) {
            case 'public':
                to = [PUBLIC_URI];
                cc = [followersUri];
                break;
            case 'unlisted':
                to = [followersUri];
                cc = [PUBLIC_URI];
                break;
            case 'followers':
                to = [followersUri];
                cc = [];
                break;
            default:
                to = [PUBLIC_URI];
                cc = [followersUri];
        }

        // 4. Construct Note Object
        const noteId = `https://${domain}/users/${username}/statuses/${crypto.randomUUID()}`;

        const note = {
            id: noteId,
            type: 'Note',
            published,
            attributedTo: actorUri,
            content,
            contentMap: { [language]: content },
            to,
            cc,
            attachment: media
        };

        // 5. Construct Create Activity
        const createId = `https://${domain}/users/${username}/statuses/${crypto.randomUUID()}`;
        const createActivity = {
            id: createId,
            type: 'Create',
            actor: actorUri,
            published,
            to,
            cc,
            object: note
        };

        // 6. Save to Database
        await db.insert(activities).values({
            actorId: user.userId,
            activity: createActivity,
            type: 'Create',
            createdAt: new Date()
        });

        return json(createActivity, {
            status: 201,
            headers: { 'Location': createId }
        });
    }

    if (action === 'edit') {
        if (!objectId) throw error(400, 'objectId is required for editing');
        if (!content && media.length === 0) throw error(400, 'Content or media is required for editing');

        // Find original Create activity for this object
        // We need to fetch it to ensure ownership and get current audience
        // Since we store Activity in jsonb, we search where activity->>'object'->>'id' = objectId
        // But our schema is activities(id, actorId, activity, type, createdAt).
        // A 'Create' activity has the object embedded. 

        // Optimization: In a real app we might have a separate Objects table. 
        // Here we have to query safely.

        const allUserActivities = await db.query.activities.findMany({
            where: and(
                eq(activities.actorId, user.userId),
                eq(activities.type, 'Create')
            ),
            orderBy: [desc(activities.createdAt)],
            limit: 100 // Search recent history or improve query with SQL if needed
        });

        // Find the specific activity that created this object
        const originalRecord = allUserActivities.find(r => (r.activity as any).object?.id === objectId);

        if (!originalRecord) {
            throw error(404, 'Post not found or you do not have permission to edit it.');
        }

        const originalActivity = originalRecord.activity as any;
        const originalObject = originalActivity.object;

        // Construct Update Activity
        const updateId = `https://${domain}/users/${username}/statuses/${crypto.randomUUID()}`;

        // Preserve original audience
        const to = originalObject.to;
        const cc = originalObject.cc;

        const updatedObject = {
            ...originalObject,
            content,
            contentMap: { [language]: content },
            attachment: media, // Replace media
            updated: published // Add updated timestamp
        };

        const updateActivity = {
            id: updateId,
            type: 'Update',
            actor: actorUri,
            published,
            to,
            cc,
            object: updatedObject
        };

        // Transactional update:
        // 1. Insert Update activity
        // 2. Update the original Create activity's object in DB so GET /outbox returns new content

        // Insert Update
        await db.insert(activities).values({
            actorId: user.userId,
            activity: updateActivity,
            type: 'Update',
            createdAt: new Date()
        });

        // Update original Create record
        // We modify the 'activity' JSONB. 
        // Deep merge or replacement of the object field.
        // Simplified: Update the entire activity structure with the new object
        const newCreateActivity = {
            ...originalActivity,
            object: updatedObject
        };

        await db.update(activities)
            .set({ activity: newCreateActivity })
            .where(eq(activities.id, originalRecord.id));

        return json(updateActivity, { status: 201 });
    }

    if (action === 'delete') {
        if (!objectId) throw error(400, 'objectId is required for deletion');

        // Verify ownership same as edit
        const allUserActivities = await db.query.activities.findMany({
            where: and(
                eq(activities.actorId, user.userId),
                eq(activities.type, 'Create')
            ),
            orderBy: [desc(activities.createdAt)],
            limit: 100
        });



        const originalRecord = allUserActivities.find(r => (r.activity as any).object?.id === objectId);

        if (!originalRecord) {
            throw error(404, 'Post not found or you do not have permission to delete it.');
        }

        const originalActivity = originalRecord.activity as any;

        // Create Tombstone
        const tombstone = {
            id: objectId,
            type: 'Tombstone',
            formerType: 'Note',
            deleted: published
        };

        const deleteId = `https://${domain}/users/${username}/statuses/${crypto.randomUUID()}`;
        const deleteActivity = {
            id: deleteId,
            type: 'Delete',
            actor: actorUri,
            published,
            to: originalActivity.to || [PUBLIC_URI], // Notify same audience
            cc: originalActivity.cc || [],
            object: tombstone
        };

        await db.insert(activities).values({
            actorId: user.userId,
            activity: deleteActivity,
            type: 'Delete',
            createdAt: new Date()
        });

        // Update original record to contain Tombstone
        const newCreateActivity = {
            ...originalActivity,
            object: tombstone
        };

        await db.update(activities)
            .set({ activity: newCreateActivity })
            .where(eq(activities.id, originalRecord.id));

        return json(deleteActivity, { status: 200 });
    }

    throw error(400, 'Invalid action');
};

/**
 * GET /users/[username]/outbox
 * 
 * User Story 2.2: Viewing the Outbox
 * User Story 2.3: Audience Scoping
 * 
 * Returns OrderedCollection (root) or OrderedCollectionPage (paginated).
 */
export const GET: RequestHandler = async ({ params, url, locals }) => {
    const { username } = params;
    const domain = env.DOMAIN!;
    const actorUri = getActorUri(domain, username);

    // 1. Find the target user (whose outbox we are viewing)
    const targetUser = await db.query.users.findFirst({
        where: eq(users.username, username),
        columns: { id: true }
    });

    if (!targetUser) {
        throw error(404, 'User not found');
    }

    // 2. Check if this is a request for the root collection or a specific page
    const pageParam = url.searchParams.get('page');

    if (!pageParam) {
        // BUG FIX: Ensure the OrderedCollection totalItems only reflects valid, active posts.
        // We filter for 'Create' activities and exclude those that are tombstones.
        const allCreateActivities = await db.query.activities.findMany({
            where: and(
                eq(activities.actorId, targetUser.id),
                eq(activities.type, 'Create')
            ),
            columns: { id: true, activity: true }
        });

        // Filter out tombstones from count to match profile stats
        const totalItems = allCreateActivities.filter(record => {
            const act = record.activity as any;
            return act.object?.type !== 'Tombstone';
        }).length;

        return json({
            '@context': 'https://www.w3.org/ns/activitystreams',
            id: `${actorUri}/outbox`,
            type: 'OrderedCollection',
            totalItems,
            first: `${actorUri}/outbox?page=1`
        }, {
            headers: {
                'Content-Type': 'application/activity+json; charset=utf-8'
            }
        });
    }

    // 3. Return paginated OrderedCollectionPage (Task 2.2.2)
    const page = parseInt(pageParam);
    const limit = parseInt(url.searchParams.get('limit') || '5');
    const offset = (page - 1) * limit;

    // Validate page number
    if (isNaN(page) || page < 1) {
        throw error(400, 'Invalid page number');
    }

    // 4. Determine requestor's access level (User Story 2.3)
    const requestor = locals.user;
    const isOwner = requestor?.username === username;

    // Check if requestor is a follower
    let isFollower = false;
    if (requestor && !isOwner) {
        const followRecord = await db.query.followers.findFirst({
            where: and(
                eq(followers.userId, targetUser.id), // target is being followed
                eq(followers.followerId, requestor.userId) // requestor is follower
            )
        });
        isFollower = !!followRecord;
    }

    // 5. Fetch activities with extra buffer for filtering
    // We fetch more than needed to account for filtered items
    const fetchLimit = limit * 3; // Fetch 3x to ensure we have enough after filtering
    const allActivities = await db.query.activities.findMany({
        where: eq(activities.actorId, targetUser.id),
        orderBy: [desc(activities.createdAt)],
        limit: fetchLimit,
        offset: offset
    });

    // 6. Filter based on privacy (User Story 2.3.3)
    const followersUri = `${actorUri}/followers`;

    const filteredItems = allActivities.filter(record => {
        const act = record.activity as any;

        // BUG FIX: Filter out Tombstones (deleted posts) so they don't appear in the feed
        if (act.object?.type === 'Tombstone' || act.type === 'Tombstone') {
            return false;
        }

        const to = act.to || [];
        const cc = act.cc || [];
        const audiences = [...to, ...cc];

        const isPublic = audiences.includes(PUBLIC_URI);
        const isFollowersOnly = audiences.includes(followersUri);

        // Owner sees everything
        if (isOwner) return true;

        // Public posts visible to everyone
        if (isPublic) return true;

        // Followers-only posts visible to followers
        if (isFollower && isFollowersOnly) return true;

        return false;
    });

    // Apply limit after filtering
    const items = filteredItems.slice(0, limit);

    // 7. Calculate pagination links
    const hasMore = filteredItems.length > limit;
    const hasPrev = page > 1;

    // 8. Construct OrderedCollectionPage
    const response: Record<string, unknown> = {
        '@context': 'https://www.w3.org/ns/activitystreams',
        id: `${actorUri}/outbox?page=${page}`,
        type: 'OrderedCollectionPage',
        partOf: `${actorUri}/outbox`,
        orderedItems: items.map(i => i.activity)
    };

    // Add next link if there are more items
    if (hasMore) {
        response.next = `${actorUri}/outbox?page=${page + 1}`;
    }

    // Add prev link if not on first page
    if (hasPrev) {
        response.prev = `${actorUri}/outbox?page=${page - 1}`;
    }

    return json(response, {
        headers: {
            'Content-Type': 'application/activity+json; charset=utf-8'
        }
    });
};
