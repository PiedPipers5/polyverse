// src/tests/Epic3_BE/trending.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mock environment ────────────────────────────────────────────
vi.mock('$env/dynamic/private', () => ({
	env: {
		DOMAIN: 'polyverse-pp.vercel.app'
	}
}));

// ── Mock Redis ──────────────────────────────────────────────────
const mockGet = vi.fn().mockResolvedValue(null);
const mockSet = vi.fn().mockResolvedValue('OK');

vi.mock('$lib/server/redis/instance', () => ({
	getFactory: vi.fn().mockReturnValue({
		getClient: () => ({
			get: (...args: unknown[]) => mockGet(...args),
			set: (...args: unknown[]) => mockSet(...args)
		})
	}),
	isRedisConfigured: vi.fn().mockReturnValue(true),
	getActorCache: vi.fn().mockReturnValue(null),
	getActorCacheTtlSeconds: vi.fn().mockReturnValue(86400)
}));

// ── Mock global fetch for Mastodon API calls ────────────────────
const mockMastodonFetch = vi.fn();
const originalFetch = globalThis.fetch;

// ── Import handler AFTER mocks ──────────────────────────────────
import { GET } from '../../routes/api/trending/+server';

function createMockEvent(query = '') {
	const url = `https://polyverse-pp.vercel.app/api/trending${query}`;
	return {
		url: new URL(url),
		request: new Request(url),
		params: {},
		locals: {},
		route: { id: null },
		platform: {},
		getClientAddress: () => '127.0.0.1',
		isDataRequest: false,
		isSubRequest: false,
		fetch: vi.fn(),
		setHeaders: vi.fn(),
		cookies: { get: vi.fn(), getAll: vi.fn(), set: vi.fn(), delete: vi.fn(), serialize: vi.fn() }
	} as any;
}

describe('Federated Trending API', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockGet.mockResolvedValue(null);

		// Mock global fetch to simulate Mastodon API responses
		globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
			if (typeof url === 'string' && url.includes('/api/v1/trends/statuses')) {
				return new Response(
					JSON.stringify([
						{
							id: '123',
							url: 'https://mastodon.social/@user/123',
							content: '<p>Trending post!</p>',
							created_at: new Date().toISOString(),
							favourites_count: 100,
							reblogs_count: 50,
							replies_count: 25,
							language: 'en',
							account: {
								id: 'acc-1',
								username: 'testuser',
								display_name: 'Test User',
								url: 'https://mastodon.social/@testuser',
								avatar: 'https://mastodon.social/avatars/test.png',
								acct: 'testuser'
							},
							media_attachments: []
						}
					]),
					{ status: 200, headers: { 'Content-Type': 'application/json' } }
				);
			}

			if (typeof url === 'string' && url.includes('/api/v1/trends/tags')) {
				return new Response(
					JSON.stringify([
						{
							name: 'federation',
							url: 'https://mastodon.social/tags/federation',
							history: [
								{ day: '1710000000', uses: '500', accounts: '200' },
								{ day: '1709913600', uses: '300', accounts: '150' }
							]
						}
					]),
					{ status: 200, headers: { 'Content-Type': 'application/json' } }
				);
			}

			return new Response('Not Found', { status: 404 });
		});
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	it('should return 400 for invalid type parameter', async () => {
		const event = createMockEvent('?type=invalid');
		const response = await GET(event);
		expect(response.status).toBe(400);
	});

	it('should return trending statuses from Mastodon instances', async () => {
		const event = createMockEvent('?type=statuses');
		const response = await GET(event);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.type).toBe('statuses');
		expect(body.statuses).toBeDefined();
		expect(Array.isArray(body.statuses)).toBe(true);
		expect(body.instances).toBeDefined();
		expect(body.fetchedAt).toBeDefined();

		// Should have cached the result
		expect(mockSet).toHaveBeenCalled();
	});

	it('should return trending tags from Mastodon instances', async () => {
		const event = createMockEvent('?type=tags');
		const response = await GET(event);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.type).toBe('tags');
		expect(body.tags).toBeDefined();
		expect(Array.isArray(body.tags)).toBe(true);
	});

	it('should return cached data if available', async () => {
		const cachedData = {
			type: 'statuses',
			statuses: [{ id: 'cached-1', url: 'https://example.com/1' }],
			instances: ['mastodon.social'],
			fetchedAt: new Date().toISOString()
		};
		mockGet.mockResolvedValue(JSON.stringify(cachedData));

		const event = createMockEvent('?type=statuses');
		const response = await GET(event);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.cached).toBe(true);
		expect(body.statuses).toEqual(cachedData.statuses);
	});

	it('should default to statuses type when no type specified', async () => {
		const event = createMockEvent('');
		const response = await GET(event);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.type).toBe('statuses');
	});

	it('should handle Mastodon API failures gracefully', async () => {
		// All instances return errors
		globalThis.fetch = vi.fn().mockImplementation(async () => {
			return new Response('Server Error', { status: 500 });
		});

		const event = createMockEvent('?type=statuses');
		const response = await GET(event);

		// Should still return 200 with empty array
		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.statuses).toEqual([]);
	});

	it('should deduplicate statuses by URL', async () => {
		// Two instances return the same post
		globalThis.fetch = vi.fn().mockImplementation(async () => {
			return new Response(
				JSON.stringify([
					{
						id: '123',
						url: 'https://mastodon.social/@user/123',
						content: '<p>Same post</p>',
						created_at: new Date().toISOString(),
						favourites_count: 50,
						reblogs_count: 20,
						replies_count: 10,
						account: {
							id: 'acc-1',
							username: 'user',
							display_name: 'User',
							url: 'https://mastodon.social/@user',
							avatar: '',
							acct: 'user'
						},
						media_attachments: []
					}
				]),
				{ status: 200, headers: { 'Content-Type': 'application/json' } }
			);
		});

		const event = createMockEvent('?type=statuses');
		const response = await GET(event);
		const body = await response.json();

		// Even though 5 instances returned the same post, it should only appear once
		expect(body.statuses).toHaveLength(1);
	});

	it('should aggregate same tags from different instances', async () => {
		globalThis.fetch = vi.fn().mockImplementation(async () => {
			return new Response(
				JSON.stringify([
					{
						name: 'federation',
						url: 'https://example.com/tags/federation',
						history: [{ day: '1710000000', uses: '100', accounts: '50' }]
					}
				]),
				{ status: 200, headers: { 'Content-Type': 'application/json' } }
			);
		});

		const event = createMockEvent('?type=tags');
		const response = await GET(event);
		const body = await response.json();

		// Same tag from 5 instances should merge into 1
		expect(body.tags).toHaveLength(1);
		// Total uses should be aggregated: 100 * 5 = 500
		expect(body.tags[0].totalUses).toBe(500);
		expect(body.tags[0].totalAccounts).toBe(250);
	});
});
