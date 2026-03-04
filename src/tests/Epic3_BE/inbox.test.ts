// src/tests/Epic3_BE/inbox.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock environment ────────────────────────────────────────────
vi.mock('$env/dynamic/private', () => ({
	env: {
		DOMAIN: 'polyverse-pp.vercel.app',
		ENCRYPTION_KEY: 'd7ff02dcd435996a6a93a4d2653ffbcdbfaa6e5668c9bb32479749e0cfa48a70',
		JWT_SECRET: 'a8f3b2c1d4e5f6789012345678901234567890abcdef1234567890abcdef1234'
	}
}));

// ── Mock DB ─────────────────────────────────────────────────────
const mockFindFirstUser = vi.fn();
const mockFindFirstFederatedFollows = vi.fn();
const mockFindFirstRemoteActors = vi.fn();
const mockInsert = vi.fn().mockReturnValue({
	values: vi.fn().mockResolvedValue(undefined)
});
const mockUpdate = vi.fn().mockReturnValue({
	set: vi.fn().mockReturnValue({
		where: vi.fn().mockResolvedValue(undefined)
	})
});

vi.mock('$lib/server/db', () => ({
	db: {
		query: {
			users: { findFirst: (...args: unknown[]) => mockFindFirstUser(...args) },
			federatedFollows: { findFirst: (...args: unknown[]) => mockFindFirstFederatedFollows(...args) },
			remoteActors: { findFirst: (...args: unknown[]) => mockFindFirstRemoteActors(...args) }
		},
		insert: (...args: unknown[]) => mockInsert(...args),
		update: (...args: unknown[]) => mockUpdate(...args)
	}
}));

// ── Mock federation (resolveRemoteActor) ────────────────────────
vi.mock('$lib/server/federation', () => ({
	resolveRemoteActor: vi.fn()
}));

// ── Mock httpSignature ──────────────────────────────────────────
vi.mock('$lib/server/httpSignature', () => ({
	verifyHttpSignature: vi.fn().mockResolvedValue({ verified: false, keyId: '', reason: 'No signature' })
}));

// ── Mock Redis ──────────────────────────────────────────────────
vi.mock('$lib/server/redis/instance', () => ({
	getActorCache: vi.fn().mockReturnValue(null),
	getActorCacheTtlSeconds: vi.fn().mockReturnValue(86400)
}));

// ── Import handler AFTER mocks ──────────────────────────────────
import { POST } from '../../routes/users/[username]/inbox/+server';

// ── Test Data ───────────────────────────────────────────────────
const DOMAIN = 'polyverse-pp.vercel.app';
const LOCAL_USER = { id: 'user-uuid-123', username: 'alice' };
const REMOTE_ACTOR_URI = 'https://mastodon.social/users/gargron';

function createMockRequest(body: Record<string, unknown>, headers: Record<string, string> = {}): Request {
	return new Request(`https://${DOMAIN}/users/alice/inbox`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/activity+json',
			...headers
		},
		body: JSON.stringify(body)
	});
}

function createMockEvent(body: Record<string, unknown>, username = 'alice', headers: Record<string, string> = {}) {
	const request = createMockRequest(body, headers);
	return {
		params: { username },
		request,
		locals: { user: null },
		url: new URL(request.url),
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

// ═══════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════
describe('Epic 3.3 Backend Tasks: Processing the Inbox', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockFindFirstUser.mockResolvedValue(undefined);
		mockFindFirstFederatedFollows.mockResolvedValue(undefined);
		mockFindFirstRemoteActors.mockResolvedValue(undefined);
	});

	// ── Task 3.3.1: POST /users/:username/inbox ────────────────
	describe('Task 3.3.1: Inbox endpoint basics', () => {
		it('should return 404 if target user does not exist', async () => {
			mockFindFirstUser.mockResolvedValue(undefined);

			const event = createMockEvent({
				type: 'Create',
				actor: REMOTE_ACTOR_URI,
				object: { type: 'Note', content: 'Hello' }
			});

			try {
				await POST(event);
				expect.unreachable('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(404);
			}
		});

		it('should return 400 if body is missing type', async () => {
			mockFindFirstUser.mockResolvedValue(LOCAL_USER);

			const event = createMockEvent({ actor: REMOTE_ACTOR_URI });

			try {
				await POST(event);
				expect.unreachable('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(400);
			}
		});

		it('should return 400 if body is missing actor', async () => {
			mockFindFirstUser.mockResolvedValue(LOCAL_USER);

			const event = createMockEvent({ type: 'Create' });

			try {
				await POST(event);
				expect.unreachable('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(400);
			}
		});

		it('should return 202 for unknown activity types', async () => {
			mockFindFirstUser.mockResolvedValue(LOCAL_USER);

			const event = createMockEvent({
				type: 'Like',
				actor: REMOTE_ACTOR_URI,
				object: 'https://example.com/note/1'
			});

			const response = await POST(event);
			expect(response.status).toBe(202);
		});
	});

	// ── Task 3.3.3: Create activity handler ────────────────────
	describe('Task 3.3.3: Create activity handler', () => {
		const validCreateActivity = {
			'@context': 'https://www.w3.org/ns/activitystreams',
			id: 'https://mastodon.social/activities/123',
			type: 'Create',
			actor: REMOTE_ACTOR_URI,
			published: '2026-02-22T10:00:00Z',
			object: {
				id: 'https://mastodon.social/notes/456',
				type: 'Note',
				content: '<p>Hello from the fediverse!</p>',
				attributedTo: REMOTE_ACTOR_URI,
				published: '2026-02-22T10:00:00Z'
			}
		};

		it('should save a Create activity when user follows the actor', async () => {
			mockFindFirstUser.mockResolvedValue(LOCAL_USER);
			mockFindFirstFederatedFollows.mockResolvedValue({
				id: 'follow-1',
				localUserId: LOCAL_USER.id,
				remoteActorUri: REMOTE_ACTOR_URI,
				status: 'accepted'
			});

			const event = createMockEvent(validCreateActivity);
			const response = await POST(event);

			expect(response.status).toBe(202);
			expect(mockInsert).toHaveBeenCalled();
		});

		it('should skip Create activity when actor != attributedTo', async () => {
			mockFindFirstUser.mockResolvedValue(LOCAL_USER);

			const mismatchedActivity = {
				...validCreateActivity,
				actor: 'https://evil.example/users/attacker',
				object: {
					...validCreateActivity.object,
					attributedTo: REMOTE_ACTOR_URI  // Different from actor
				}
			};

			const event = createMockEvent(mismatchedActivity);
			const response = await POST(event);

			expect(response.status).toBe(202);
			// Should NOT have saved to DB because of actor mismatch
			expect(mockInsert).not.toHaveBeenCalled();
		});

		it('should skip Create activity when local user does not follow the actor', async () => {
			mockFindFirstUser.mockResolvedValue(LOCAL_USER);
			mockFindFirstFederatedFollows.mockResolvedValue(undefined); // No follow

			const event = createMockEvent(validCreateActivity);
			const response = await POST(event);

			expect(response.status).toBe(202);
			// Should NOT have saved to DB because not followed
			expect(mockInsert).not.toHaveBeenCalled();
		});
	});

	// ── Task 3.3.4: Accept activity handler ────────────────────
	describe('Task 3.3.4: Accept activity handler', () => {
		it('should upgrade pending follow to accepted', async () => {
			mockFindFirstUser.mockResolvedValue(LOCAL_USER);

			const pendingFollow = {
				id: 'follow-pending-1',
				localUserId: LOCAL_USER.id,
				remoteActorUri: REMOTE_ACTOR_URI,
				status: 'pending',
				followActivityId: `https://${DOMAIN}/users/alice/follows/abc-123`
			};
			mockFindFirstFederatedFollows.mockResolvedValue(pendingFollow);

			const acceptActivity = {
				'@context': 'https://www.w3.org/ns/activitystreams',
				id: 'https://mastodon.social/activities/accept-1',
				type: 'Accept',
				actor: REMOTE_ACTOR_URI,
				object: `https://${DOMAIN}/users/alice/follows/abc-123`
			};

			const event = createMockEvent(acceptActivity);
			const response = await POST(event);

			expect(response.status).toBe(202);
			expect(mockUpdate).toHaveBeenCalled();
		});

		it('should handle Accept when object is the full Follow activity', async () => {
			mockFindFirstUser.mockResolvedValue(LOCAL_USER);

			const pendingFollow = {
				id: 'follow-pending-2',
				localUserId: LOCAL_USER.id,
				remoteActorUri: REMOTE_ACTOR_URI,
				status: 'pending',
				followActivityId: `https://${DOMAIN}/users/alice/follows/def-456`
			};
			mockFindFirstFederatedFollows.mockResolvedValue(pendingFollow);

			const acceptActivity = {
				'@context': 'https://www.w3.org/ns/activitystreams',
				id: 'https://mastodon.social/activities/accept-2',
				type: 'Accept',
				actor: REMOTE_ACTOR_URI,
				object: {
					id: `https://${DOMAIN}/users/alice/follows/def-456`,
					type: 'Follow',
					actor: `https://${DOMAIN}/users/alice`,
					object: REMOTE_ACTOR_URI
				}
			};

			const event = createMockEvent(acceptActivity);
			const response = await POST(event);

			expect(response.status).toBe(202);
			expect(mockUpdate).toHaveBeenCalled();
		});

		it('should ignore Accept when no matching pending follow exists', async () => {
			mockFindFirstUser.mockResolvedValue(LOCAL_USER);
			mockFindFirstFederatedFollows.mockResolvedValue(undefined); // No pending

			const acceptActivity = {
				'@context': 'https://www.w3.org/ns/activitystreams',
				id: 'https://mastodon.social/activities/accept-3',
				type: 'Accept',
				actor: REMOTE_ACTOR_URI,
				object: `https://${DOMAIN}/users/alice/follows/nonexistent`
			};

			const event = createMockEvent(acceptActivity);
			const response = await POST(event);

			expect(response.status).toBe(202);
			// Should NOT have called update since there's no matching pending follow
			expect(mockUpdate).not.toHaveBeenCalled();
		});
	});
});
