import { db } from '$lib/server/db';
import { remoteActors } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { getActorCache, getActorCacheTtlSeconds } from '$lib/server/redis/instance';

// Cache TTL: 24 hours in milliseconds
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Parses a Fediverse handle into username and domain.
 * Accepts formats: "@user@domain", "user@domain"
 * 
 * @returns { username, domain } or null if invalid
 */
export function parseHandle(handle: string): { username: string; domain: string } | null {
	// Strip leading @ if present
	const cleaned = handle.startsWith('@') ? handle.slice(1) : handle;
	const parts = cleaned.split('@');

	if (parts.length !== 2) return null;

	const [username, domain] = parts;

	// Basic validation
	if (!username || !domain || !domain.includes('.')) return null;

	return { username, domain };
}

/**
 * Task 3.1.2: WebFinger Lookup
 * 
 * Queries the remote server's WebFinger endpoint to discover the Actor URL.
 * Follows RFC 7033: https://domain/.well-known/webfinger?resource=acct:user@domain
 * 
 * @param username - Remote username (e.g., "Gargron")
 * @param domain - Remote domain (e.g., "mastodon.social")
 * @returns The Actor URL (application/activity+json link) or null
 */
export async function lookupWebFinger(
	username: string,
	domain: string
): Promise<string | null> {
	const resource = `acct:${username}@${domain}`;
	const webfingerUrl = `https://${domain}/.well-known/webfinger?resource=${encodeURIComponent(resource)}`;

	try {
		const response = await fetch(webfingerUrl, {
			headers: {
				'Accept': 'application/jrd+json, application/json'
			},
			signal: AbortSignal.timeout(10_000) // 10 second timeout
		});

		if (!response.ok) {
			console.error(`WebFinger lookup failed for ${resource}: HTTP ${response.status}`);
			return null;
		}

		const jrd = await response.json();

		// Extract the ActivityPub Actor link from the JRD links array
		// Look for rel="self" with type="application/activity+json"
		const actorLink = jrd.links?.find(
			(link: { rel: string; type?: string; href?: string }) =>
				link.rel === 'self' &&
				(link.type === 'application/activity+json' ||
					link.type === 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"')
		);

		if (!actorLink?.href) {
			console.error(`No ActivityPub actor link found in WebFinger response for ${resource}`);
			return null;
		}

		return actorLink.href;
	} catch (err) {
		console.error(`WebFinger lookup error for ${resource}:`, err);
		return null;
	}
}

/**
 * Task 3.1.3: Fetch Remote Actor
 * 
 * Performs a GET request to the Actor URL with appropriate Accept headers.
 * Returns the full Actor JSON-LD object.
 * 
 * Note: HTTP Signature signing for "Secure Mode" instances will be added
 * in Epic 3.3 when signature infrastructure is implemented.
 * 
 * @param actorUrl - The Actor URL to fetch
 * @returns The Actor JSON-LD object or null
 */
export async function fetchRemoteActor(
	actorUrl: string
): Promise<Record<string, unknown> | null> {
	try {
		const response = await fetch(actorUrl, {
			headers: {
				'Accept': 'application/activity+json, application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
			},
			signal: AbortSignal.timeout(10_000) // 10 second timeout
		});

		if (!response.ok) {
			console.error(`Failed to fetch remote actor at ${actorUrl}: HTTP ${response.status}`);
			return null;
		}

		const actor = await response.json();

		// Basic validation: an Actor must have id, type, and inbox
		if (!actor.id || !actor.type || !actor.inbox) {
			console.error(`Invalid Actor object received from ${actorUrl}: missing required fields`);
			return null;
		}

		return actor;
	} catch (err) {
		console.error(`Error fetching remote actor at ${actorUrl}:`, err);
		return null;
	}
}

/**
 * Task 3.1.4: Resolve Remote Actor (with caching)
 * 
 * Orchestrates the full lookup flow:
 * 1. Check local cache (`remote_actors` table)
 * 2. If cached and fresh (< 24h), return cached version
 * 3. Otherwise, perform WebFinger → Actor fetch → upsert cache
 * 
 * @param handle - Full handle string (e.g., "@gargron@mastodon.social" or "gargron@mastodon.social")
 * @returns { actor, handle, cached } or null if lookup fails
 */
export async function resolveRemoteActor(handle: string): Promise<{
	actor: Record<string, unknown>;
	handle: string;
	cached: boolean;
} | null> {
	const parsed = parseHandle(handle);
	if (!parsed) return null;

	const { username, domain } = parsed;
	const normalizedHandle = `${username}@${domain}`;

	// ── L1: Redis cache (fast, optional) ──────────────────────────
	const redisCache = getActorCache();

	if (redisCache) {
		try {
			const redisHit = await redisCache.get(normalizedHandle);
			if (redisHit) {
				return { actor: redisHit, handle: normalizedHandle, cached: true };
			}
		} catch {
			// Redis error — fall through to DB silently
		}
	}

	// ── L2: Database cache ────────────────────────────────────────
	const cached = await db.query.remoteActors.findFirst({
		where: eq(remoteActors.handle, normalizedHandle)
	});

	if (cached) {
		const age = Date.now() - cached.fetchedAt.getTime();
		if (age < CACHE_TTL_MS) {
			const actorData = cached.actorJson as Record<string, unknown>;

			// Backfill Redis so the next hit is faster
			if (redisCache) {
				redisCache.set(normalizedHandle, actorData, getActorCacheTtlSeconds()).catch(() => { });
			}

			return { actor: actorData, handle: normalizedHandle, cached: true };
		}
		// Cache is stale, will refresh below
	}

	// ── L3: Network — WebFinger + Actor fetch ─────────────────────
	const actorUrl = await lookupWebFinger(username, domain);
	if (!actorUrl) return null;

	const actor = await fetchRemoteActor(actorUrl);
	if (!actor) return null;

	// ── Write-through: store in both DB and Redis ─────────────────
	const now = new Date();

	if (cached) {
		await db.update(remoteActors)
			.set({ actorJson: actor, actorUri: actorUrl, fetchedAt: now })
			.where(eq(remoteActors.handle, normalizedHandle));
	} else {
		await db.insert(remoteActors).values({
			handle: normalizedHandle,
			actorUri: actorUrl,
			domain,
			actorJson: actor,
			fetchedAt: now
		});
	}

	// Write to Redis (fire-and-forget, best-effort)
	if (redisCache) {
		redisCache.set(normalizedHandle, actor, getActorCacheTtlSeconds()).catch(() => { });
	}

	return { actor, handle: normalizedHandle, cached: false };
}
