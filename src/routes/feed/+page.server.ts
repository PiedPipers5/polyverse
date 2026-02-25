import { redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { activities, users } from '$lib/server/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

const PUBLIC_URI = 'https://www.w3.org/ns/activitystreams#Public';
const PAGE_SIZE = 20;

/**
 * SSR load for /feed.
 * Auth-gated. Returns the first page of public local activity
 * so the page renders instantly without a client-side waterfall.
 */
export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	// Fetch all local users for author info
	const allUsers = await db.query.users.findMany({
		columns: { id: true, username: true, displayName: true, avatarUrl: true }
	});
	const userMap = new Map(allUsers.map((u) => [u.id, u]));

	// OPTIMIZATION: To get an accurate count and avoid skipping posts,
	// we fetch all 'Create' activities first. For a production app with millions
	// of posts, we would use a more efficient indexed counting method.
	const allCreateActivities = await db.query.activities.findMany({
		where: eq(activities.type, 'Create'),
		orderBy: [desc(activities.createdAt)]
	});

	// Filter public, non-tombstone
	const allPublicPosts = allCreateActivities.filter((row) => {
		const act = row.activity as any;
		const obj = act.object;
		if (!obj || obj.type === 'Tombstone') return false;
		const to: string[] = act.to || obj.to || [];
		const cc: string[] = act.cc || obj.cc || [];
		return [...to, ...cc].includes(PUBLIC_URI);
	});

	const totalPublicPosts = allPublicPosts.length;
	const postsInPage = allPublicPosts.slice(0, PAGE_SIZE);
	const hasMore = totalPublicPosts > PAGE_SIZE;

	const posts = postsInPage.map((row) => {
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

	const nextCursor =
		hasMore && posts.length > 0 ? posts[posts.length - 1].createdAt : null;

	return { posts, nextCursor, totalPublicPosts };
};
