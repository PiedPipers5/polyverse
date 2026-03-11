// src/tests/epic_2_be_tests/2.3_audience_scoping.test.ts
//
// Unit Tests for User Story 2.3: Audience Scoping (Privacy Levels)
// Covers Tasks:
//   2.3.2 - Mapping frontend privacy selection to ActivityStreams URIs
//   2.3.3 - Read-access filtering in GET /users/:username/outbox

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST, GET } from '../../routes/users/[username]/outbox/+server';
import { db } from '$lib/server/db';
import { createMockRequestEvent } from '../test-utils';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const MOCK_USER_ID = 'user-uuid-001';
const MOCK_USERNAME = 'alice';
const MOCK_DID = 'did:web:test.com:u:alice';
const MOCK_ACTOR_URI = 'https://test.com/users/alice';
const PUBLIC_URI = 'https://www.w3.org/ns/activitystreams#Public';
const FOLLOWERS_URI = 'https://test.com/users/alice/followers';

const FOLLOWER_USER_ID = 'user-uuid-002';
const FOLLOWER_USERNAME = 'bob';
const FOLLOWER_DID = 'did:web:test.com:u:bob';

const STRANGER_USER_ID = 'user-uuid-003';
const STRANGER_USERNAME = 'charlie';
const STRANGER_DID = 'did:web:test.com:u:charlie';

// ---------------------------------------------------------------------------
// Module Mocks (inline literals to avoid hoisting issues)
// ---------------------------------------------------------------------------
vi.mock('$env/dynamic/private', () => ({
	env: { DOMAIN: 'test.com', BLOB_READ_WRITE_TOKEN: 'test_blob_token' }
}));

vi.mock('$lib/server/db', () => ({
	db: {
		query: {
			users: { findFirst: vi.fn() },
			activities: { findMany: vi.fn(), findFirst: vi.fn() },
			followers: { findFirst: vi.fn() }
		},
		insert: vi.fn(() => ({
			values: vi.fn(() => ({
				returning: vi.fn(() => Promise.resolve([{ id: 'new-activity-id' }]))
			}))
		})),
		update: vi.fn(() => ({
			set: vi.fn(() => ({
				where: vi.fn(() => ({
					returning: vi.fn(() => Promise.resolve([{ id: 'updated-id' }]))
				}))
			}))
		}))
	}
}));

// ---------------------------------------------------------------------------
// Helper: call a handler and return {status, body} even when it throws
// ---------------------------------------------------------------------------
async function callHandler(fn: () => Promise<Response>): Promise<{ status: number; body: unknown }> {
	try {
		const res = await fn();
		let body: unknown;
		try { body = await res.json(); } catch { body = null; }
		return { status: res.status, body };
	} catch (err: unknown) {
		const httpErr = err as { status?: number; body?: unknown };
		return { status: httpErr.status ?? 500, body: httpErr.body ?? null };
	}
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makePostEvent(privacy: string, content = 'Test post') {
	return createMockRequestEvent({
		method: 'POST',
		url: `/users/${MOCK_USERNAME}/outbox`,
		params: { username: MOCK_USERNAME },
		json: { content, privacy },
		locals: { user: { userId: MOCK_USER_ID, username: MOCK_USERNAME, did: MOCK_DID } }
	});
}

function makeGetEvent(urlSuffix: string, requestorLocals: Record<string, unknown>) {
	return createMockRequestEvent({
		method: 'GET',
		url: `/users/${MOCK_USERNAME}/outbox${urlSuffix}`,
		params: { username: MOCK_USERNAME },
		locals: requestorLocals
	});
}

// Activity factory helpers
const publicNote = {
	id: 'act-public',
	actorId: MOCK_USER_ID,
	activity: {
		type: 'Create',
		actor: MOCK_ACTOR_URI,
		published: new Date().toISOString(),
		to: [PUBLIC_URI],
		cc: [FOLLOWERS_URI],
		object: {
			id: 'note-public',
			type: 'Note',
			content: 'Public post',
			to: [PUBLIC_URI],
			cc: [FOLLOWERS_URI],
			attributedTo: MOCK_ACTOR_URI
		}
	},
	createdAt: new Date()
};

const unlistedNote = {
	id: 'act-unlisted',
	actorId: MOCK_USER_ID,
	activity: {
		type: 'Create',
		actor: MOCK_ACTOR_URI,
		published: new Date().toISOString(),
		to: [FOLLOWERS_URI],
		cc: [PUBLIC_URI],
		object: {
			id: 'note-unlisted',
			type: 'Note',
			content: 'Unlisted post',
			to: [FOLLOWERS_URI],
			cc: [PUBLIC_URI],
			attributedTo: MOCK_ACTOR_URI
		}
	},
	createdAt: new Date()
};

const followersOnlyNote = {
	id: 'act-followers',
	actorId: MOCK_USER_ID,
	activity: {
		type: 'Create',
		actor: MOCK_ACTOR_URI,
		published: new Date().toISOString(),
		to: [FOLLOWERS_URI],
		cc: [],
		object: {
			id: 'note-followers',
			type: 'Note',
			content: 'Followers-only post',
			to: [FOLLOWERS_URI],
			cc: [],
			attributedTo: MOCK_ACTOR_URI
		}
	},
	createdAt: new Date()
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('User Story 2.3 – Audience Scoping (Privacy Levels)', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		(db.insert as ReturnType<typeof vi.fn>).mockReturnValue({
			values: vi.fn().mockReturnValue({
				returning: vi.fn().mockResolvedValue([{ id: 'new-activity-id' }])
			})
		});
		(db.query.users.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
			id: MOCK_USER_ID,
			username: MOCK_USERNAME,
			didDocument: { id: MOCK_DID }
		});
	});

	// -----------------------------------------------------------------------
	// Task 2.3.2 – Privacy mapping to ActivityStreams URIs
	// -----------------------------------------------------------------------
	describe('Task 2.3.2 – Privacy selection → ActivityStreams URI mapping', () => {
		it('public: to=[Public], cc=[Followers]', async () => {
			const { body } = await callHandler(() => POST(makePostEvent('public')));
			const b = body as Record<string, unknown>;
			const obj = b.object as Record<string, unknown>;
			expect(obj.to as string[]).toContain(PUBLIC_URI);
			expect(obj.cc as string[]).toContain(FOLLOWERS_URI);
		});

		it('public: to does NOT contain followers URI', async () => {
			const { body } = await callHandler(() => POST(makePostEvent('public')));
			const b = body as Record<string, unknown>;
			const obj = b.object as Record<string, unknown>;
			expect(obj.to as string[]).not.toContain(FOLLOWERS_URI);
		});

		it('unlisted: to=[Followers], cc=[Public]', async () => {
			const { body } = await callHandler(() => POST(makePostEvent('unlisted')));
			const b = body as Record<string, unknown>;
			const obj = b.object as Record<string, unknown>;
			expect(obj.to as string[]).toContain(FOLLOWERS_URI);
			expect(obj.cc as string[]).toContain(PUBLIC_URI);
		});

		it('unlisted: to does NOT contain Public URI', async () => {
			const { body } = await callHandler(() => POST(makePostEvent('unlisted')));
			const b = body as Record<string, unknown>;
			const obj = b.object as Record<string, unknown>;
			expect(obj.to as string[]).not.toContain(PUBLIC_URI);
		});

		it('followers: to=[Followers], cc=[]', async () => {
			const { body } = await callHandler(() => POST(makePostEvent('followers')));
			const b = body as Record<string, unknown>;
			const obj = b.object as Record<string, unknown>;
			expect(obj.to as string[]).toContain(FOLLOWERS_URI);
			expect(obj.cc as string[]).not.toContain(PUBLIC_URI);
			expect((obj.cc as string[]).length).toBe(0);
		});

		it('followers: to does NOT contain Public URI', async () => {
			const { body } = await callHandler(() => POST(makePostEvent('followers')));
			const b = body as Record<string, unknown>;
			const obj = b.object as Record<string, unknown>;
			expect(obj.to as string[]).not.toContain(PUBLIC_URI);
		});

		it('unknown privacy defaults to public behaviour', async () => {
			const { body } = await callHandler(() => POST(makePostEvent('unknown_value')));
			const b = body as Record<string, unknown>;
			const obj = b.object as Record<string, unknown>;
			expect(obj.to as string[]).toContain(PUBLIC_URI);
		});

		it('Create activity to/cc mirrors the Note to/cc', async () => {
			const { body } = await callHandler(() => POST(makePostEvent('public')));
			const b = body as Record<string, unknown>;
			const obj = b.object as Record<string, unknown>;
			expect(b.to).toEqual(obj.to);
			expect(b.cc).toEqual(obj.cc);
		});

		it('followers URI uses correct format: https://domain/users/username/followers', async () => {
			const { body } = await callHandler(() => POST(makePostEvent('public')));
			const b = body as Record<string, unknown>;
			const obj = b.object as Record<string, unknown>;
			expect((obj.cc as string[])[0]).toBe('https://test.com/users/alice/followers');
		});
	});

	// -----------------------------------------------------------------------
	// Task 2.3.3 – Read-access filtering in GET /outbox
	// -----------------------------------------------------------------------
	describe('Task 2.3.3 – Read-access filtering in GET /users/:username/outbox', () => {
		const allNotes = [publicNote, unlistedNote, followersOnlyNote];

		it('owner sees all posts (public, unlisted, followers-only)', async () => {
			(db.query.activities.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(allNotes);
			const event = makeGetEvent('?page=1&limit=10', {
				user: { userId: MOCK_USER_ID, username: MOCK_USERNAME, did: MOCK_DID }
			});
			const { body } = await callHandler(() => GET(event));
			const items = (body as Record<string, unknown>).orderedItems as unknown[];
			expect(items.length).toBe(3);
		});

		it('unauthenticated user sees only public and unlisted posts (not followers-only)', async () => {
			(db.query.activities.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(allNotes);
			(db.query.followers.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
			const event = makeGetEvent('?page=1&limit=10', { user: null });
			const { body } = await callHandler(() => GET(event));
			const items = (body as Record<string, unknown>).orderedItems as Array<Record<string, unknown>>;
			const ids = items.map((i) => (i.object as Record<string, unknown>)?.id);
			expect(ids).toContain('note-public');
			expect(ids).toContain('note-unlisted'); // unlisted has cc=[Public]
			expect(ids).not.toContain('note-followers');
		});

		it('non-follower sees only public and unlisted posts (Task 2.3.4 scenario)', async () => {
			(db.query.users.findFirst as ReturnType<typeof vi.fn>)
				.mockResolvedValueOnce({ id: MOCK_USER_ID, username: MOCK_USERNAME, didDocument: { id: MOCK_DID } })
				.mockResolvedValueOnce({ id: STRANGER_USER_ID, username: STRANGER_USERNAME, didDocument: { id: STRANGER_DID } });
			(db.query.activities.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(allNotes);
			(db.query.followers.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

			const event = makeGetEvent('?page=1&limit=10', {
				user: { userId: STRANGER_USER_ID, username: STRANGER_USERNAME, did: STRANGER_DID }
			});
			const { body } = await callHandler(() => GET(event));
			const items = (body as Record<string, unknown>).orderedItems as Array<Record<string, unknown>>;
			const ids = items.map((i) => (i.object as Record<string, unknown>)?.id);
			expect(ids).not.toContain('note-followers');
		});

		it('follower sees public, unlisted AND followers-only posts', async () => {
			(db.query.users.findFirst as ReturnType<typeof vi.fn>)
				.mockResolvedValueOnce({ id: MOCK_USER_ID, username: MOCK_USERNAME, didDocument: { id: MOCK_DID } })
				.mockResolvedValueOnce({ id: FOLLOWER_USER_ID, username: FOLLOWER_USERNAME, didDocument: { id: FOLLOWER_DID } });
			(db.query.activities.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(allNotes);
			(db.query.followers.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
				userId: MOCK_USER_ID,
				followerId: FOLLOWER_USER_ID
			});

			const event = makeGetEvent('?page=1&limit=10', {
				user: { userId: FOLLOWER_USER_ID, username: FOLLOWER_USERNAME, did: FOLLOWER_DID }
			});
			const { body } = await callHandler(() => GET(event));
			const items = (body as Record<string, unknown>).orderedItems as Array<Record<string, unknown>>;
			const ids = items.map((i) => (i.object as Record<string, unknown>)?.id);
			expect(ids).toContain('note-public');
			expect(ids).toContain('note-unlisted');
			expect(ids).toContain('note-followers');
		});

		it('followers-only note is excluded from non-follower response (Task 2.3.4)', async () => {
			(db.query.users.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
				id: MOCK_USER_ID, username: MOCK_USERNAME, didDocument: { id: MOCK_DID }
			});
			(db.query.activities.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([followersOnlyNote]);
			(db.query.followers.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

			const event = makeGetEvent('?page=1&limit=10', {
				user: { userId: STRANGER_USER_ID, username: STRANGER_USERNAME, did: STRANGER_DID }
			});
			const { body } = await callHandler(() => GET(event));
			const items = (body as Record<string, unknown>).orderedItems as unknown[];
			expect(items.length).toBe(0);
		});

		it('public post is visible to unauthenticated requests', async () => {
			(db.query.activities.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([publicNote]);
			const event = makeGetEvent('?page=1&limit=10', { user: null });
			const { body } = await callHandler(() => GET(event));
			const items = (body as Record<string, unknown>).orderedItems as unknown[];
			expect(items.length).toBe(1);
		});

		it('owner can see their own followers-only post', async () => {
			(db.query.activities.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([followersOnlyNote]);
			const event = makeGetEvent('?page=1&limit=10', {
				user: { userId: MOCK_USER_ID, username: MOCK_USERNAME, did: MOCK_DID }
			});
			const { body } = await callHandler(() => GET(event));
			const items = (body as Record<string, unknown>).orderedItems as unknown[];
			expect(items.length).toBe(1);
		});
	});
});
