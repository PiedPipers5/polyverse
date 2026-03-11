import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { activities, users, interactions } from '$lib/server/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import type { RequestHandler } from './$types';

/**
 * GET /api/comments/[postId]
 *
 * Returns the full threaded comment tree for a given post.
 * Each comment includes author info, vote data, and nested replies.
 */
export const GET: RequestHandler = async ({ params, locals }) => {
    const { postId } = params;
    const currentUserId = locals.user?.userId ?? null;

    // 1. Fetch ALL 'Create' activities so we can build the tree in-memory.
    //    This is efficient for moderate comment volumes. For very large threads,
    //    a recursive CTE in SQL would be more optimal.
    const allCreateActivities = await db.query.activities.findMany({
        where: eq(activities.type, 'Create')
    });

    // 2. Build a map of postId -> activity rows for fast lookup
    const replyMap = new Map<string, typeof allCreateActivities>();

    for (const row of allCreateActivities) {
        const act = row.activity as any;
        const obj = act.object;
        if (!obj || obj.type === 'Tombstone') continue;

        const parentId = obj.inReplyTo;
        if (parentId) {
            const existing = replyMap.get(parentId) || [];
            existing.push(row);
            replyMap.set(parentId, existing);
        }
    }

    // 3. Fetch all local users for author info
    const allUsers = await db.query.users.findMany({
        columns: { id: true, username: true, displayName: true, avatarUrl: true }
    });
    const userMap = new Map(allUsers.map((u) => [u.id, u]));

    // 4. Collect all comment IDs in the tree (BFS) to batch-fetch interactions
    const allCommentIds: string[] = [];
    const collectIds = (parentId: string) => {
        const children = replyMap.get(parentId) || [];
        for (const child of children) {
            const childId = (child.activity as any).object?.id;
            if (childId) {
                allCommentIds.push(childId);
                collectIds(childId);
            }
        }
    };
    collectIds(postId);

    // 5. Batch-fetch interactions for all comments in the tree
    let interactionsData: any[] = [];
    if (allCommentIds.length > 0) {
        interactionsData = await db.query.interactions.findMany({
            where: inArray(interactions.postId, allCommentIds)
        });
    }

    // 6. Recursively build the tree
    function buildTree(parentId: string): any[] {
        const children = replyMap.get(parentId) || [];

        return children
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()) // newest first
            .map((row) => {
                const act = row.activity as any;
                const obj = act.object;
                const commentId = obj.id;
                const author = row.actorId ? userMap.get(row.actorId) : undefined;

                // Calculate vote data for this comment
                const commentInteractions = interactionsData.filter((i: any) => i.postId === commentId);
                const upvotes = commentInteractions.filter((i: any) => i.type === 'upvote').length;
                const downvotes = commentInteractions.filter((i: any) => i.type === 'downvote').length;
                const netScore = upvotes - downvotes;
                const userVote = currentUserId
                    ? commentInteractions.find((i: any) => i.actorId === currentUserId)?.type || null
                    : null;

                return {
                    id: commentId,
                    activityId: row.id,
                    content: obj.content || '',
                    publishedAt: row.createdAt.toISOString(),
                    author: author
                        ? {
                            username: author.username,
                            displayName: author.displayName,
                            avatarUrl: author.avatarUrl,
                            profileUrl: `/u/@${author.username}`
                        }
                        : null,
                    netScore,
                    userVote,
                    tag: obj.tag || [],
                    replies: buildTree(commentId)
                };
            });
    }

    const comments = buildTree(postId);

    return json({ comments, total: allCommentIds.length });
};
