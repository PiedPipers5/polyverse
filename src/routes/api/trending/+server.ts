/**
 * Federated Trending API
 *
 * GET /api/trending?type=statuses|tags
 *
 * Aggregates trending posts and hashtags from popular Mastodon-compatible
 * instances across the fediverse. Results are cached in Redis for 5 minutes.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';

// ── Popular fediverse instances to aggregate from ────────────────
const FEDIVERSE_INSTANCES = [
	'mastodon.social',
	'mastodon.online',
	'fosstodon.org',
	'hachyderm.io',
	'mstdn.social'
];

const CACHE_TTL_SECONDS = 300; // 5 minutes
const FETCH_TIMEOUT_MS = 8_000;

// ── Types ────────────────────────────────────────────────────────
type TrendingStatus = {
	id: string;
	url: string;
	content: string;
	created_at: string;
	favourites_count: number;
	reblogs_count: number;
	replies_count: number;
	language: string | null;
	account: {
		id: string;
		username: string;
		display_name: string;
		url: string;
		avatar: string;
		acct: string;
	};
	media_attachments: Array<{
		type: string;
		url: string;
		preview_url: string;
		description: string | null;
	}>;
	instance?: string;
	engagement?: number;
};

type TrendingTag = {
	name: string;
	url: string;
	history: Array<{
		day: string;
		uses: string;
		accounts: string;
	}>;
	instance?: string;
	totalUses?: number;
	totalAccounts?: number;
};

// ── Redis cache helpers ──────────────────────────────────────────
async function getCachedData(key: string): Promise<any | null> {
	try {
		const { getFactory } = await import('$lib/server/redis/instance');
		const factory = getFactory();
		if (!factory) return null;
		const client = factory.getClient();
		const cached = await client.get(key);
		return cached ? JSON.parse(cached) : null;
	} catch {
		return null;
	}
}

async function setCachedData(key: string, data: any, ttl: number): Promise<void> {
	try {
		const { getFactory } = await import('$lib/server/redis/instance');
		const factory = getFactory();
		if (!factory) return;
		const client = factory.getClient();
		await client.set(key, JSON.stringify(data), 'EX', ttl);
	} catch {
		// Cache write failure is non-fatal
	}
}

// ── Fetch trending from a single instance ────────────────────────
async function fetchTrendingStatuses(instance: string): Promise<TrendingStatus[]> {
	try {
		const url = `https://${instance}/api/v1/trends/statuses?limit=10`;
		const res = await fetch(url, {
			headers: { Accept: 'application/json' },
			signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
		});

		if (!res.ok) {
			console.warn(`[Trending] ${instance} returned ${res.status} for statuses`);
			return [];
		}

		const statuses: TrendingStatus[] = await res.json();
		return statuses.map((s) => ({
			...s,
			instance,
			engagement: (s.favourites_count || 0) + (s.reblogs_count || 0) + (s.replies_count || 0)
		}));
	} catch (err) {
		console.warn(`[Trending] Failed to fetch statuses from ${instance}:`, err);
		return [];
	}
}

async function fetchTrendingTags(instance: string): Promise<TrendingTag[]> {
	try {
		const url = `https://${instance}/api/v1/trends/tags?limit=10`;
		const res = await fetch(url, {
			headers: { Accept: 'application/json' },
			signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
		});

		if (!res.ok) {
			console.warn(`[Trending] ${instance} returned ${res.status} for tags`);
			return [];
		}

		const tags: TrendingTag[] = await res.json();
		return tags.map((t) => {
			const totalUses = t.history?.reduce((sum, h) => sum + parseInt(h.uses || '0'), 0) || 0;
			const totalAccounts = t.history?.reduce((sum, h) => sum + parseInt(h.accounts || '0'), 0) || 0;
			return { ...t, instance, totalUses, totalAccounts };
		});
	} catch (err) {
		console.warn(`[Trending] Failed to fetch tags from ${instance}:`, err);
		return [];
	}
}

// ── Aggregate and deduplicate ────────────────────────────────────
function aggregateStatuses(allStatuses: TrendingStatus[]): TrendingStatus[] {
	// Deduplicate by URL (same post can appear on multiple instances)
	const seen = new Map<string, TrendingStatus>();
	for (const s of allStatuses) {
		const existing = seen.get(s.url);
		if (!existing || (s.engagement || 0) > (existing.engagement || 0)) {
			seen.set(s.url, s);
		}
	}

	// Sort by engagement (descending)
	return [...seen.values()].sort((a, b) => (b.engagement || 0) - (a.engagement || 0));
}

function aggregateTags(allTags: TrendingTag[]): TrendingTag[] {
	// Merge same tags from different instances
	const tagMap = new Map<string, TrendingTag>();
	for (const t of allTags) {
		const key = t.name.toLowerCase();
		const existing = tagMap.get(key);
		if (existing) {
			existing.totalUses = (existing.totalUses || 0) + (t.totalUses || 0);
			existing.totalAccounts = (existing.totalAccounts || 0) + (t.totalAccounts || 0);
		} else {
			tagMap.set(key, { ...t });
		}
	}

	// Sort by total usage
	return [...tagMap.values()].sort((a, b) => (b.totalUses || 0) - (a.totalUses || 0));
}

// ── Handler ──────────────────────────────────────────────────────
export const GET: RequestHandler = async ({ url }) => {
	const type = url.searchParams.get('type') || 'statuses';

	if (type !== 'statuses' && type !== 'tags') {
		return json({ error: 'type must be "statuses" or "tags"' }, { status: 400 });
	}

	const cacheKey = `polyverse:trending:${type}`;

	// Check cache first
	const cached = await getCachedData(cacheKey);
	if (cached) {
		return json({
			...cached,
			cached: true
		});
	}

	// Fetch from all instances in parallel
	if (type === 'statuses') {
		const results = await Promise.all(FEDIVERSE_INSTANCES.map(fetchTrendingStatuses));
		const allStatuses = results.flat();
		const aggregated = aggregateStatuses(allStatuses);

		const response = {
			type: 'statuses',
			statuses: aggregated.slice(0, 30),
			instances: FEDIVERSE_INSTANCES,
			fetchedAt: new Date().toISOString()
		};

		await setCachedData(cacheKey, response, CACHE_TTL_SECONDS);
		return json({ ...response, cached: false });
	} else {
		const results = await Promise.all(FEDIVERSE_INSTANCES.map(fetchTrendingTags));
		const allTags = results.flat();
		const aggregated = aggregateTags(allTags);

		const response = {
			type: 'tags',
			tags: aggregated.slice(0, 20),
			instances: FEDIVERSE_INSTANCES,
			fetchedAt: new Date().toISOString()
		};

		await setCachedData(cacheKey, response, CACHE_TTL_SECONDS);
		return json({ ...response, cached: false });
	}
};
