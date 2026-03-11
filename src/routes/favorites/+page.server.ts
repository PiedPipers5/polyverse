import { redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { favorites, users, interactions } from '$lib/server/db/schema';
import { eq, desc, inArray } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) throw redirect(302, '/login');

	const userId = locals.user.userId;

	// Fetch all favorites for this user, newest first
	const rows = await db.query.favorites.findMany({
		where: eq(favorites.userId, userId),
		orderBy: [desc(favorites.createdAt)]
	});

	// Extract post IDs for enrichment (isFavorited is always true here)
	const postIds = rows.map((r) => r.postId);

	// Fetch the user's votes on these posts
	const userInteractions =
		postIds.length > 0
			? await db.query.interactions.findMany({
					where: inArray(interactions.postId, postIds)
				})
			: [];

	// Build enriched activity list
	const enrichedFavorites = rows.map((row) => {
		const snapshot = row.activitySnapshot as any;
		const apActivity = snapshot.activity || snapshot;
		const postId = apActivity.object?.id || apActivity.id;

		const postInteractions = userInteractions.filter((i) => i.postId === postId);
		const upvotes = postInteractions.filter((i) => i.type === 'upvote').length;
		const downvotes = postInteractions.filter((i) => i.type === 'downvote').length;
		const userVote = postInteractions.find((i) => i.actorId === userId)?.type || null;

		return {
			...snapshot,
			netScore: upvotes - downvotes,
			userVote,
			isFavorited: true,
			favoritedAt: row.createdAt.toISOString()
		};
	});

	return { favorites: enrichedFavorites };
};
