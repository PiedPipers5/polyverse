import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { activities, users } from '$lib/server/db/schema';
import { eq, and, lt, desc } from 'drizzle-orm';
import type { RequestHandler } from './$types';

const PUBLIC_URI = 'https://www.w3.org/ns/activitystreams#Public';
const PAGE_SIZE = 20;

/**
 * GET /api/feed?before=<ISO timestamp>&limit=20
 *
 * Returns a page of public Create activities from all local users,
 * ordered newest-first, with cursor-based pagination via `before`.
 * Each post includes minimal author info.
 */
export const GET: RequestHandler = async ({ url, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const before = url.searchParams.get('before');
	const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 50);

	// Fetch Create activities from all local users
	const allUsers = await db.query.users.findMany({
		columns: { id: true, username: true, displayName: true, avatarUrl: true }
	});

	const userMap = new Map(allUsers.map((u) => [u.id, u]));

	// Build base conditions
	const conditions = [eq(activities.type, 'Create')];

	// Cursor-based pagination
	if (before) {
		const cursor = new Date(before);
		if (!isNaN(cursor.getTime())) {
			conditions.push(lt(activities.createdAt, cursor));
		}
	}

	// OPTIMIZATION: To ensure we return exactly `limit` public posts,
	// we fetch a larger batch of activities and filter. 
	// For small instances, fetching 100 at a time is safe.
	const fetchLimit = Math.max(limit * 5, 100);

	const rows = await db.query.activities.findMany({
		where: and(...conditions),
		orderBy: [desc(activities.createdAt)],
		limit: fetchLimit
	});

	// Filter to only public posts, exclude tombstones
	const allPublicPosts = rows
		.filter((row) => {
			const act = row.activity as any;
			const obj = act.object;
			if (!obj || obj.type === 'Tombstone') return false;

			const to: string[] = act.to || obj.to || [];
			const cc: string[] = act.cc || obj.cc || [];
			return [...to, ...cc].includes(PUBLIC_URI);
		});

	const publicPosts = allPublicPosts.slice(0, limit);
	const hasMore = allPublicPosts.length > limit;
	const nextCursor = hasMore && publicPosts.length > 0
		? publicPosts[publicPosts.length - 1].createdAt.toISOString()
		: null;

	const posts = publicPosts.map((row) => {
		const author = userMap.get(row.actorId);
		const act = row.activity as any;
		return {
			id: row.id,
			actorId: row.actorId,
			author: author
				? {
					username: author.username,
					displayName: author.displayName,
					avatarUrl: author.avatarUrl,
					profileUrl: `/u/@${author.username}`
				}
				: null,
			activity: act,
			content: act.object?.content || act.content || '',
			publishedAt: row.createdAt.toISOString(),
			createdAt: row.createdAt.toISOString()
		};
	});

	return json({ posts, nextCursor });
};
