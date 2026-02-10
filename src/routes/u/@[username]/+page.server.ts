import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { users, activities } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const load: PageServerLoad = async ({ params, locals }) => {
	const username = params.username;

	// fetch user from database
	const user = await db.query.users.findFirst({
		where: eq(users.username, username),
		columns: {
			id: true,
			username: true,
			displayName: true,
			bio: true,
			avatarUrl: true,
			createdAt: true,
			didDocument: true,
		}
	});

	if (!user) {
		throw error(404, 'User not found');
	}

	// Extract info from DID document if database fields are empty as fallback (or purely rely on DB fields as source of truth for UI)
	// The schema says `displayName`, `bio` are in the table. Let's use them.

	// Fetch recent activities (posts)
	let userActivities: any[] = [];
	let mappedActivities: any[] = [];

	try {
		userActivities = await db.query.activities.findMany({
			where: eq(activities.actorId, user.id),
			orderBy: (activities, { desc }) => [desc(activities.publishedAt)],
			limit: 20,
		});

		mappedActivities = userActivities.map(a => {
			try {
				return {
					id: a.id,
					content: (a.activityJson as any).object.content,
					publishedAt: a.publishedAt,
				};
			} catch (e) {
				console.error('Failed to map activity:', e);
				return null;
			}
		}).filter(a => a !== null);

	} catch (e) {
		console.error('Failed to fetch activities:', e);
		// Fallback to empty array
	}

	return {
		profile: {
			username: user.username,
			displayName: user.displayName || user.username,
			bio: user.bio || '',
			avatarUrl: user.avatarUrl || '',
			handle: `@${user.username}`,
			createdAt: user.createdAt,
			followersCount: 0, // Placeholder
			followingCount: 0, // Placeholder
			postsCount: mappedActivities.length
		},
		activities: mappedActivities,
		isOwner: locals.user?.username === user.username
	};
};
