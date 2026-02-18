import { error, json } from '@sveltejs/kit';
import { resolveRemoteActor, parseHandle } from '$lib/server/federation';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

/**
 * GET /api/search?q=@user@domain
 * 
 * Search endpoint for the frontend search bar.
 * Detects if the query matches a Fediverse handle pattern and performs
 * remote user lookup via WebFinger + Actor fetch.
 * 
 * Also checks local users if the domain matches the local instance.
 */
export const GET: RequestHandler = async ({ url, locals }) => {
	// 1. Authentication check
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const query = url.searchParams.get('q')?.trim();

	if (!query) {
		throw error(400, 'Search query is required (use ?q=@user@domain)');
	}

	// 2. Check if the query looks like a Fediverse handle
	const parsed = parseHandle(query);

	if (!parsed) {
		// Not a handle pattern — return empty results for now
		// (local full-text search can be added in a future story)
		return json({
			type: 'no_results',
			query,
			message: 'Search term does not match a Fediverse handle pattern (@user@domain). Try using the full handle.'
		});
	}

	const { username, domain } = parsed;
	const localDomain = env.DOMAIN!;

	// 3. If querying a local user, look up directly
	if (domain === localDomain) {
		const localUser = await db.query.users.findFirst({
			where: eq(users.username, username),
			columns: {
				id: true,
				username: true,
				displayName: true,
				bio: true,
				avatarUrl: true
			}
		});

		if (!localUser) {
			throw error(404, `Local user @${username} not found`);
		}

		return json({
			type: 'local_user',
			user: {
				username: localUser.username,
				displayName: localUser.displayName,
				bio: localUser.bio,
				avatarUrl: localUser.avatarUrl,
				profileUrl: `/u/${localUser.username}`
			}
		});
	}

	// 4. Remote user lookup (Tasks 3.1.2, 3.1.3, 3.1.4)
	try {
		const result = await resolveRemoteActor(query);

		if (!result) {
			throw error(404, `Could not find remote user @${username}@${domain}. The user may not exist or the remote server may be unreachable.`);
		}

		const actor = result.actor;

		return json({
			type: 'remote_actor',
			actor: {
				id: actor.id,
				type: actor.type,
				preferredUsername: actor.preferredUsername,
				name: actor.name || actor.preferredUsername,
				summary: actor.summary || null,
				icon: actor.icon || null,
				url: actor.url || actor.id,
				inbox: actor.inbox,
				outbox: actor.outbox,
				followers: actor.followers,
				following: actor.following,
			},
			handle: result.handle,
			cached: result.cached
		});
	} catch (err) {
		// Re-throw SvelteKit errors
		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}
		console.error('Search error:', err);
		throw error(500, 'An error occurred while searching for the remote user.');
	}
};
