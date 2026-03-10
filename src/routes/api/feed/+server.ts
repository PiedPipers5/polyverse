import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { activities, users, remoteActors } from '$lib/server/db/schema';
import { eq, and, lt, desc, inArray, or, sql } from 'drizzle-orm';
import type { RequestHandler } from './$types';

const PUBLIC_URI = 'https://www.w3.org/ns/activitystreams#Public';
const PAGE_SIZE = 20;

/**
 * GET /api/feed?before=<ISO timestamp>&limit=20
 *
 * Returns a page of public Create and Announce activities, ordered newest-first,
 * with cursor-based pagination. Each post includes author info plus
 * isRemote/remoteHandle for federation badges.
 *
 * Task 3.5.2: Announce (Boost) activities are included with a `boostedBy` field.
 */
export const GET: RequestHandler = async ({ url, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const before = url.searchParams.get('before');
	const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 50);

	// Build base conditions — include both Create and Announce
	const conditions = [
		or(eq(activities.type, 'Create'), eq(activities.type, 'Announce'))
	];

	// Cursor-based pagination
	if (before) {
		const cursor = new Date(before);
		if (!isNaN(cursor.getTime())) {
			conditions.push(lt(activities.createdAt, cursor));
		}
	}

	// Fetch a larger batch then filter to `limit` public posts
	const fetchLimit = Math.max(limit * 5, 100);

	const rows = await db.query.activities.findMany({
		where: and(...conditions),
		orderBy: [desc(activities.createdAt)],
		limit: fetchLimit
	});

	// Filter to only public posts, exclude tombstones
	const allPublicPosts = rows.filter((row) => {
		const act = row.activity as any;

		// For Announce activities, check if the Announce itself is public
		if (act.type === 'Announce') {
			const to: string[] = act.to || [];
			const cc: string[] = act.cc || [];
			return [...to, ...cc].includes(PUBLIC_URI);
		}

		// For Create activities, check the object
		const obj = act.object;
		if (!obj || obj.type === 'Tombstone') return false;
		const to: string[] = act.to || obj.to || [];
		const cc: string[] = act.cc || obj.cc || [];
		return [...to, ...cc].includes(PUBLIC_URI);
	});

	const publicPosts = allPublicPosts.slice(0, limit);
	const hasMore = allPublicPosts.length > limit;
	const nextCursor =
		hasMore && publicPosts.length > 0
			? publicPosts[publicPosts.length - 1].createdAt.toISOString()
			: null;

	// Collect unique local actor IDs + remote actor IDs
	const localActorIds = [
		...new Set(publicPosts.map((r) => r.actorId).filter(Boolean))
	] as string[];
	const remoteActorIds = [
		...new Set(publicPosts.map((r) => r.remoteActorId).filter(Boolean))
	] as string[];

	// Fetch local users and remote actors in parallel
	const [localAuthors, remoteActorRows] = await Promise.all([
		localActorIds.length > 0
			? db.query.users.findMany({
				where: inArray(users.id, localActorIds),
				columns: { id: true, username: true, displayName: true, avatarUrl: true }
			})
			: Promise.resolve([]),
		remoteActorIds.length > 0
			? db.query.remoteActors.findMany({
				where: inArray(remoteActors.id, remoteActorIds)
			})
			: Promise.resolve([])
	]);

	const userMap = new Map(localAuthors.map((u) => [u.id, u]));
	const remoteActorMap = new Map(remoteActorRows.map((a) => [a.id, a]));

	// For Announce activities, we need to resolve the boosted post content.
	// Collect all boosted object URIs and try to find them among our local activities.
	const boostedUris = publicPosts
		.filter((row) => (row.activity as any).type === 'Announce')
		.map((row) => (row.activity as any).object)
		.filter((obj: unknown): obj is string => typeof obj === 'string');

	let boostedPostMap = new Map<string, any>();
	if (boostedUris.length > 0) {
		// Try to find boosted posts locally by matching activity.object.id
		const allLocalActivities = await db.query.activities.findMany({
			where: eq(activities.type, 'Create'),
			limit: 500
		});

		for (const row of allLocalActivities) {
			const act = row.activity as any;
			const objId = act.object?.id;
			if (objId && boostedUris.includes(objId)) {
				const localAuthor = row.actorId ? userMap.get(row.actorId) : undefined;
				const remoteActor = row.remoteActorId ? remoteActorMap.get(row.remoteActorId) : undefined;
				boostedPostMap.set(objId, {
					object: act.object,
					author: remoteActor
						? {
							username: remoteActor.handle,
							displayName: (remoteActor.actorJson as any)?.name || remoteActor.handle,
							avatarUrl: (remoteActor.actorJson as any)?.icon?.url || null,
							profileUrl: remoteActor.actorUri
						}
						: localAuthor
							? {
								username: localAuthor.username,
								displayName: localAuthor.displayName,
								avatarUrl: localAuthor.avatarUrl,
								profileUrl: `/u/@${localAuthor.username}`
							}
							: null
				});
			}
		}
	}

	const posts = publicPosts.map((row) => {
		const act = row.activity as any;

		// Build author — prefer remote actor if present
		const remoteActor = row.remoteActorId ? remoteActorMap.get(row.remoteActorId) : undefined;
		const localAuthor = row.actorId ? userMap.get(row.actorId) : undefined;

		let author: {
			username: string;
			displayName: string | null;
			avatarUrl: string | null;
			profileUrl: string;
		} | null = null;
		let isRemote = false;
		let remoteHandle: string | null = null;

		if (remoteActor) {
			const actorJson = remoteActor.actorJson as any;
			author = {
				username: remoteActor.handle,
				displayName: actorJson?.name || remoteActor.handle,
				avatarUrl: actorJson?.icon?.url || null,
				profileUrl: remoteActor.actorUri
			};
			isRemote = true;
			remoteHandle = remoteActor.handle;
		} else if (localAuthor) {
			author = {
				username: localAuthor.username,
				displayName: localAuthor.displayName,
				avatarUrl: localAuthor.avatarUrl,
				profileUrl: `/u/@${localAuthor.username}`
			};
		}

		// Task 3.5.2: Handle Announce (Boost) activities
		if (act.type === 'Announce') {
			const boostedUri = typeof act.object === 'string' ? act.object : act.object?.id;
			const boostedData = boostedUri ? boostedPostMap.get(boostedUri) : null;

			return {
				id: row.id,
				actorId: row.actorId,
				author,
				isRemote,
				remoteHandle,
				activity: act,
				content: boostedData?.object?.content || `[Boosted post: ${boostedUri}]`,
				publishedAt: row.createdAt.toISOString(),
				createdAt: row.createdAt.toISOString(),
				likesCount: row.likesCount,
				boostsCount: row.boostsCount,
				// Boost-specific fields
				isBoosted: true,
				boostedBy: author,
				originalAuthor: boostedData?.author || null,
				originalPostUri: boostedUri
			};
		}

		return {
			id: row.id,
			actorId: row.actorId,
			author,
			isRemote,
			remoteHandle,
			activity: act,
			content: act.object?.content || act.content || '',
			publishedAt: row.createdAt.toISOString(),
			createdAt: row.createdAt.toISOString(),
			likesCount: row.likesCount,
			boostsCount: row.boostsCount,
			isBoosted: false,
			boostedBy: null,
			originalAuthor: null,
			originalPostUri: null
		};
	});

	return json({ posts, nextCursor });
};
