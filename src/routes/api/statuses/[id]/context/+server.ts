/**
 * GET /api/statuses/[id]/context (Task 4.1.4)
 *
 * Returns the conversation context for a post:
 * - ancestors: parent chain (walking inReplyTo upward)
 * - descendants: all replies (recursive children)
 *
 * Uses the existing activities_in_reply_to_idx index for efficient lookups.
 */

import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { activities, users, remoteActors } from '$lib/server/db/schema';
import { eq, sql, inArray } from 'drizzle-orm';
import { fetchContextPost } from '$lib/server/contextFetcher';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ params, locals }) => {
    const { id: postId } = params;

    if (!postId) {
        throw error(400, 'Post ID is required');
    }

    // 1. Find the focus post
    const focusRecord = await db.query.activities.findFirst({
        where: sql`${activities.activity}->'object'->>'id' = ${postId} AND ${activities.type} = 'Create'`
    });

    if (!focusRecord) {
        throw error(404, 'Post not found');
    }

    const focusActivity = focusRecord.activity as any;
    const focusObject = focusActivity.object;

    // 2. Build ancestors (walk inReplyTo chain upward)
    const ancestors: any[] = [];
    let currentInReplyTo = focusObject?.inReplyTo;
    const visitedAncestors = new Set<string>();

    while (currentInReplyTo && !visitedAncestors.has(currentInReplyTo)) {
        visitedAncestors.add(currentInReplyTo);

        const parentRecord = await db.query.activities.findFirst({
            where: sql`${activities.activity}->'object'->>'id' = ${currentInReplyTo} AND ${activities.type} = 'Create'`
        });

        if (parentRecord) {
            const parentAct = parentRecord.activity as any;
            ancestors.unshift({
                id: parentAct.object?.id,
                activityId: parentRecord.id,
                content: parentAct.object?.content || '',
                publishedAt: parentRecord.createdAt.toISOString(),
                actorId: parentRecord.actorId,
                remoteActorId: parentRecord.remoteActorId,
                inReplyTo: parentAct.object?.inReplyTo || null,
                tag: parentAct.object?.tag || []
            });
            currentInReplyTo = parentAct.object?.inReplyTo;
        } else {
            // Task 3.5.4: Try to fetch the missing parent from remote
            const fetched = await fetchContextPost(currentInReplyTo);
            if (fetched) {
                ancestors.unshift({
                    id: fetched.id,
                    activityId: null,
                    content: (fetched as any).content || '',
                    publishedAt: (fetched as any).published || new Date().toISOString(),
                    actorId: null,
                    remoteActorId: null,
                    inReplyTo: (fetched as any).inReplyTo || null,
                    tag: (fetched as any).tag || [],
                    isFetched: true
                });
                currentInReplyTo = (fetched as any).inReplyTo;
            } else {
                break;
            }
        }
    }

    // 3. Build descendants (find all replies recursively using BFS)
    const descendants: any[] = [];
    const queue = [postId];
    const visitedDescendants = new Set<string>();

    while (queue.length > 0) {
        const parentId = queue.shift()!;
        if (visitedDescendants.has(parentId)) continue;
        visitedDescendants.add(parentId);

        // Find all activities where object.inReplyTo = parentId
        const childRecords = await db.query.activities.findMany({
            where: sql`${activities.activity}->'object'->>'inReplyTo' = ${parentId} AND ${activities.type} = 'Create'`
        });

        for (const childRecord of childRecords) {
            const childAct = childRecord.activity as any;
            const childId = childAct.object?.id;

            if (childId && !visitedDescendants.has(childId)) {
                descendants.push({
                    id: childId,
                    activityId: childRecord.id,
                    content: childAct.object?.content || '',
                    publishedAt: childRecord.createdAt.toISOString(),
                    actorId: childRecord.actorId,
                    remoteActorId: childRecord.remoteActorId,
                    inReplyTo: childAct.object?.inReplyTo || null,
                    tag: childAct.object?.tag || []
                });
                queue.push(childId);
            }
        }
    }

    // 4. Hydrate author info for all posts
    const allPosts = [...ancestors, ...descendants];
    const localActorIds = [...new Set(allPosts.map((p) => p.actorId).filter(Boolean))] as string[];
    const remoteActorIdsList = [
        ...new Set(allPosts.map((p) => p.remoteActorId).filter(Boolean))
    ] as string[];

    const [localUsers, remoteActorRows] = await Promise.all([
        localActorIds.length > 0
            ? db.query.users.findMany({
                where: inArray(users.id, localActorIds),
                columns: { id: true, username: true, displayName: true, avatarUrl: true }
            })
            : Promise.resolve([]),
        remoteActorIdsList.length > 0
            ? db.query.remoteActors.findMany({
                where: inArray(remoteActors.id, remoteActorIdsList)
            })
            : Promise.resolve([])
    ]);

    const userMap = new Map(localUsers.map((u) => [u.id, u]));
    const remoteActorMap = new Map(remoteActorRows.map((a) => [a.id, a]));

    function hydrateAuthor(post: any) {
        const localUser = post.actorId ? userMap.get(post.actorId) : null;
        const remoteActor = post.remoteActorId ? remoteActorMap.get(post.remoteActorId) : null;

        if (remoteActor) {
            const actorJson = remoteActor.actorJson as any;
            post.author = {
                username: remoteActor.handle,
                displayName: actorJson?.name || remoteActor.handle,
                avatarUrl: actorJson?.icon?.url || null,
                profileUrl: remoteActor.actorUri,
                isRemote: true
            };
        } else if (localUser) {
            post.author = {
                username: localUser.username,
                displayName: localUser.displayName,
                avatarUrl: localUser.avatarUrl,
                profileUrl: `/u/@${localUser.username}`,
                isRemote: false
            };
        } else {
            post.author = null;
        }

        // Clean up internal fields
        delete post.actorId;
        delete post.remoteActorId;

        return post;
    }

    return json({
        ancestors: ancestors.map(hydrateAuthor),
        descendants: descendants.map(hydrateAuthor)
    });
};
