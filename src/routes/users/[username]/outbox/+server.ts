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
    const { content, privacy = 'public', media = [] } = body;

    if (!content && media.length === 0) {
        throw error(400, 'Content or media is required.');
    }

    // 3. Determine Audience (to/cc)
    const actorUri = getActorUri(domain, username);
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
    const published = new Date().toISOString();

    const note = {
        id: noteId,
        type: 'Note',
        published,
        attributedTo: actorUri,
        content,
        to,
        cc,
        attachment: media
    };

    // 5. Construct Create Activity
    const createId = `https://${domain}/users/${username}/statuses/${crypto.randomUUID()}`; // Using new UUID for activity
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
        actorId: user.userId, // We need the UUID from locals (populated from JWT)
        activity: createActivity,
        type: 'Create',
        createdAt: new Date()
    });

    // 7. Return 201 Created
    return json(createActivity, { 
        status: 201,
        headers: {
            'Location': createId
        }
    });
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
        // Return root OrderedCollection (Task 2.2.1)
        // Get total count of activities for this user
        const allActivities = await db.query.activities.findMany({
            where: eq(activities.actorId, targetUser.id),
            columns: { id: true }
        });
        
        const totalItems = allActivities.length;
        
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
    const limit = parseInt(url.searchParams.get('limit') || '20');
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
