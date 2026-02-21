// src/tests/epic_2_be_tests/2.2_view_outbox.test.ts
//
// Unit Tests for User Story 2.2: Viewing the Outbox (My Feed)
// Covers Tasks:
//   2.2.1 - GET /users/:username/outbox returns OrderedCollection
//   2.2.2 - Pagination logic (OrderedCollectionPage with next/prev links)

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '../../routes/users/[username]/outbox/+server';
import { db } from '$lib/server/db';
import { createMockRequestEvent } from '../test-utils';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const MOCK_USER_ID = 'user-uuid-001';
const MOCK_USERNAME = 'alice';
const MOCK_DID = `did:web:test.com:u:alice`;
const MOCK_ACTOR_URI = `https://test.com/users/alice`;
const PUBLIC_URI = 'https://www.w3.org/ns/activitystreams#Public';

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
function makeActivity(id: string, noteId: string, content: string) {
	return {
		id,
		actorId: MOCK_USER_ID,
		activity: {
			type: 'Create',
			actor: MOCK_ACTOR_URI,
			published: new Date().toISOString(),
			to: [PUBLIC_URI],
			cc: [`${MOCK_ACTOR_URI}/followers`],
			object: {
				id: noteId,
				type: 'Note',
				content,
				to: [PUBLIC_URI],
				cc: [`${MOCK_ACTOR_URI}/followers`],
				attributedTo: MOCK_ACTOR_URI
			}
		},
		createdAt: new Date()
	};
}

const MOCK_ACTIVITIES = [
	makeActivity('act-1', 'note-1', 'First post'),
	makeActivity('act-2', 'note-2', 'Second post'),
	makeActivity('act-3', 'note-3', 'Third post')
];

function makeGetEvent(urlSuffix = '') {
	return createMockRequestEvent({
		method: 'GET',
		url: `/users/${MOCK_USERNAME}/outbox${urlSuffix}`,
		params: { username: MOCK_USERNAME },
		locals: { user: { userId: MOCK_USER_ID, username: MOCK_USERNAME, did: MOCK_DID } }
	});
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('User Story 2.2 – Viewing the Outbox', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		(db.query.users.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
			id: MOCK_USER_ID,
			username: MOCK_USERNAME,
			didDocument: { id: MOCK_DID }
		});
		(db.query.activities.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_ACTIVITIES);
	});

	// -----------------------------------------------------------------------
	// Task 2.2.1 – Root OrderedCollection
	// -----------------------------------------------------------------------
	describe('Task 2.2.1 – GET /users/:username/outbox (root collection)', () => {
		it('returns HTTP 200', async () => {
			const { status } = await callHandler(() => GET(makeGetEvent()));
			expect(status).toBe(200);
		});

		it('returns type "OrderedCollection"', async () => {
			const { body } = await callHandler(() => GET(makeGetEvent()));
			expect((body as Record<string, unknown>).type).toBe('OrderedCollection');
		});

		it('includes totalItems count', async () => {
			const { body } = await callHandler(() => GET(makeGetEvent()));
			expect((body as Record<string, unknown>).totalItems).toBe(MOCK_ACTIVITIES.length);
		});

		it('includes a "first" link pointing to page 1', async () => {
			const { body } = await callHandler(() => GET(makeGetEvent()));
			expect((body as Record<string, unknown>).first).toBe(`${MOCK_ACTOR_URI}/outbox?page=1`);
		});

		it('includes the @context field', async () => {
			const { body } = await callHandler(() => GET(makeGetEvent()));
			expect((body as Record<string, unknown>)['@context']).toBe('https://www.w3.org/ns/activitystreams');
		});

		it('includes the collection id URI', async () => {
			const { body } = await callHandler(() => GET(makeGetEvent()));
			expect((body as Record<string, unknown>).id).toBe(`${MOCK_ACTOR_URI}/outbox`);
		});

		it('returns 404 when user does not exist', async () => {
			(db.query.users.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);
			const event = createMockRequestEvent({
				method: 'GET',
				url: `/users/nonexistent/outbox`,
				params: { username: 'nonexistent' },
				locals: { user: null }
			});
			const { status } = await callHandler(() => GET(event));
			expect(status).toBe(404);
		});

		it('returns totalItems = 0 when user has no activities', async () => {
			(db.query.activities.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
			const { body } = await callHandler(() => GET(makeGetEvent()));
			expect((body as Record<string, unknown>).totalItems).toBe(0);
		});

		it('does not include orderedItems in root collection (only in pages)', async () => {
			const { body } = await callHandler(() => GET(makeGetEvent()));
			expect((body as Record<string, unknown>).orderedItems).toBeUndefined();
		});
	});

	// -----------------------------------------------------------------------
	// Task 2.2.2 – Paginated OrderedCollectionPage
	// -----------------------------------------------------------------------
	describe('Task 2.2.2 – Pagination (OrderedCollectionPage)', () => {
		it('returns type "OrderedCollectionPage" when page param is provided', async () => {
			const { body } = await callHandler(() => GET(makeGetEvent('?page=1')));
			expect((body as Record<string, unknown>).type).toBe('OrderedCollectionPage');
		});

		it('includes partOf link pointing to root collection', async () => {
			const { body } = await callHandler(() => GET(makeGetEvent('?page=1')));
			expect((body as Record<string, unknown>).partOf).toBe(`${MOCK_ACTOR_URI}/outbox`);
		});

		it('includes orderedItems array', async () => {
			const { body } = await callHandler(() => GET(makeGetEvent('?page=1')));
			expect(Array.isArray((body as Record<string, unknown>).orderedItems)).toBe(true);
		});

		it('respects the limit parameter', async () => {
			const { body } = await callHandler(() => GET(makeGetEvent('?page=1&limit=2')));
			const items = (body as Record<string, unknown>).orderedItems as unknown[];
			expect(items.length).toBeLessThanOrEqual(2);
		});

		it('includes "next" link when more items exist', async () => {
			const { body } = await callHandler(() => GET(makeGetEvent('?page=1&limit=1')));
			expect((body as Record<string, unknown>).next).toBe(`${MOCK_ACTOR_URI}/outbox?page=2`);
		});

		it('does not include "next" link on last page', async () => {
			const { body } = await callHandler(() => GET(makeGetEvent('?page=1&limit=10')));
			expect((body as Record<string, unknown>).next).toBeUndefined();
		});

		it('does not include "prev" link on first page', async () => {
			const { body } = await callHandler(() => GET(makeGetEvent('?page=1')));
			expect((body as Record<string, unknown>).prev).toBeUndefined();
		});

		it('includes "prev" link on pages after the first', async () => {
			const { body } = await callHandler(() => GET(makeGetEvent('?page=2&limit=1')));
			expect((body as Record<string, unknown>).prev).toBe(`${MOCK_ACTOR_URI}/outbox?page=1`);
		});

		it('includes the page id URI', async () => {
			const { body } = await callHandler(() => GET(makeGetEvent('?page=1')));
			expect((body as Record<string, unknown>).id).toBe(`${MOCK_ACTOR_URI}/outbox?page=1`);
		});

		it('returns 400 for invalid page number (page=0)', async () => {
			const { status } = await callHandler(() => GET(makeGetEvent('?page=0')));
			expect(status).toBe(400);
		});

		it('returns 400 for non-numeric page parameter', async () => {
			const { status } = await callHandler(() => GET(makeGetEvent('?page=abc')));
			expect(status).toBe(400);
		});

		it('returns empty orderedItems on a page beyond available data', async () => {
			(db.query.activities.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
			const { body } = await callHandler(() => GET(makeGetEvent('?page=100&limit=5')));
			expect((body as Record<string, unknown>).orderedItems).toEqual([]);
		});

		it('orderedItems contain the activity objects (not DB row wrappers)', async () => {
			const { body } = await callHandler(() => GET(makeGetEvent('?page=1&limit=5')));
			const items = (body as Record<string, unknown>).orderedItems as Array<Record<string, unknown>>;
			items.forEach((item) => {
				expect(item.type).toBeDefined();
			});
		});
	});
});
