// src/tests/epic_2_be_tests/2.4_edit_delete.test.ts
//
// Unit Tests for User Story 2.4: Editing and Deleting
// Covers Tasks:
//   2.4.2 - Update handler: creates Update activity, updates DB content
//   2.4.3 - Delete handler: creates Delete activity, replaces Note with Tombstone
//   2.4.4 - GET /users/:username/statuses/:uuid returns 410 Gone for Tombstoned objects

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../../routes/users/[username]/outbox/+server';
import { GET as getStatus } from '../../routes/users/[username]/statuses/[uuid]/+server';
import { db } from '$lib/server/db';
import { activities } from '$lib/server/db/schema';
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

const NOTE_UUID = 'note-uuid-abc123';
const NOTE_ID = `https://test.com/users/alice/statuses/${NOTE_UUID}`;

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
const mockOriginalActivity = {
	id: 'original-activity-db-id',
	actorId: MOCK_USER_ID,
	activity: {
		id: `https://test.com/users/alice/statuses/create-uuid`,
		type: 'Create',
		actor: MOCK_ACTOR_URI,
		published: new Date('2024-01-01').toISOString(),
		to: [PUBLIC_URI],
		cc: [FOLLOWERS_URI],
		object: {
			id: NOTE_ID,
			type: 'Note',
			content: 'Original content',
			attributedTo: MOCK_ACTOR_URI,
			to: [PUBLIC_URI],
			cc: [FOLLOWERS_URI],
			published: new Date('2024-01-01').toISOString()
		}
	},
	createdAt: new Date('2024-01-01')
};

function makeAuthEvent(json: Record<string, unknown>) {
	return createMockRequestEvent({
		method: 'POST',
		url: `/users/${MOCK_USERNAME}/outbox`,
		params: { username: MOCK_USERNAME },
		json,
		locals: { user: { userId: MOCK_USER_ID, username: MOCK_USERNAME, did: MOCK_DID } }
	});
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('User Story 2.4 – Editing and Deleting', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		(db.query.activities.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockOriginalActivity]);
		(db.update as ReturnType<typeof vi.fn>).mockReturnValue({
			set: vi.fn().mockReturnValue({
				where: vi.fn().mockReturnValue({
					returning: vi.fn().mockResolvedValue([{ id: 'updated-id' }])
				})
			})
		});
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
	// Task 2.4.2 – Update handler
	// -----------------------------------------------------------------------
	describe('Task 2.4.2 – Update handler (Edit action)', () => {
		it('returns HTTP 201 on successful edit', async () => {
			const { status } = await callHandler(() =>
				POST(makeAuthEvent({ action: 'edit', objectId: NOTE_ID, content: 'Updated content' }))
			);
			expect(status).toBe(201);
		});

		it('response body has type "Update"', async () => {
			const { body } = await callHandler(() =>
				POST(makeAuthEvent({ action: 'edit', objectId: NOTE_ID, content: 'Updated content' }))
			);
			expect((body as Record<string, unknown>).type).toBe('Update');
		});

		it('Update activity object id matches the original Note id', async () => {
			const { body } = await callHandler(() =>
				POST(makeAuthEvent({ action: 'edit', objectId: NOTE_ID, content: 'Updated content' }))
			);
			const b = body as Record<string, unknown>;
			expect((b.object as Record<string, unknown>).id).toBe(NOTE_ID);
		});

		it('Update activity object content reflects the new content', async () => {
			const updatedContent = 'This is the updated text!';
			const { body } = await callHandler(() =>
				POST(makeAuthEvent({ action: 'edit', objectId: NOTE_ID, content: updatedContent }))
			);
			const b = body as Record<string, unknown>;
			expect((b.object as Record<string, unknown>).content).toBe(updatedContent);
		});

		it('Update activity object has an "updated" timestamp', async () => {
			const { body } = await callHandler(() =>
				POST(makeAuthEvent({ action: 'edit', objectId: NOTE_ID, content: 'Updated content' }))
			);
			const b = body as Record<string, unknown>;
			const updated = (b.object as Record<string, unknown>).updated as string;
			expect(updated).toBeDefined();
			expect(new Date(updated).toString()).not.toBe('Invalid Date');
		});

		it('Update activity actor matches the user URI', async () => {
			const { body } = await callHandler(() =>
				POST(makeAuthEvent({ action: 'edit', objectId: NOTE_ID, content: 'Updated content' }))
			);
			expect((body as Record<string, unknown>).actor).toBe(MOCK_ACTOR_URI);
		});

		it('inserts a new Update activity record into the database', async () => {
			await callHandler(() =>
				POST(makeAuthEvent({ action: 'edit', objectId: NOTE_ID, content: 'Updated content' }))
			);
			expect(db.insert).toHaveBeenCalledWith(activities);
		});

		it('updates the original Create activity record in the database', async () => {
			await callHandler(() =>
				POST(makeAuthEvent({ action: 'edit', objectId: NOTE_ID, content: 'Updated content' }))
			);
			expect(db.update).toHaveBeenCalledWith(activities);
		});

		it('preserves original audience (to/cc) on the updated object', async () => {
			const { body } = await callHandler(() =>
				POST(makeAuthEvent({ action: 'edit', objectId: NOTE_ID, content: 'Updated content' }))
			);
			const b = body as Record<string, unknown>;
			const obj = b.object as Record<string, unknown>;
			expect(obj.to as string[]).toContain(PUBLIC_URI);
			expect(obj.cc as string[]).toContain(FOLLOWERS_URI);
		});

		it('returns 400 when objectId is missing for edit', async () => {
			const { status } = await callHandler(() =>
				POST(makeAuthEvent({ action: 'edit', content: 'Updated content' }))
			);
			expect(status).toBe(400);
		});

		it('returns 400 when content is missing for edit', async () => {
			const { status } = await callHandler(() =>
				POST(makeAuthEvent({ action: 'edit', objectId: NOTE_ID }))
			);
			expect(status).toBe(400);
		});

		it('returns 404 when trying to edit a non-existent post', async () => {
			(db.query.activities.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
			const { status } = await callHandler(() =>
				POST(makeAuthEvent({ action: 'edit', objectId: 'https://test.com/nonexistent', content: 'Updated' }))
			);
			expect(status).toBe(404);
		});

		it('returns 401 when unauthenticated user tries to edit', async () => {
			const event = createMockRequestEvent({
				method: 'POST',
				url: `/users/${MOCK_USERNAME}/outbox`,
				params: { username: MOCK_USERNAME },
				json: { action: 'edit', objectId: NOTE_ID, content: 'Updated' },
				locals: { user: null }
			});
			const { status } = await callHandler(() => POST(event));
			expect(status).toBe(401);
		});
	});

	// -----------------------------------------------------------------------
	// Task 2.4.3 – Delete handler (Tombstone)
	// -----------------------------------------------------------------------
	describe('Task 2.4.3 – Delete handler (Tombstone)', () => {
		it('returns HTTP 200 on successful delete', async () => {
			const { status } = await callHandler(() =>
				POST(makeAuthEvent({ action: 'delete', objectId: NOTE_ID }))
			);
			expect(status).toBe(200);
		});

		it('response body has type "Delete"', async () => {
			const { body } = await callHandler(() =>
				POST(makeAuthEvent({ action: 'delete', objectId: NOTE_ID }))
			);
			expect((body as Record<string, unknown>).type).toBe('Delete');
		});

		it('Delete activity object is a Tombstone', async () => {
			const { body } = await callHandler(() =>
				POST(makeAuthEvent({ action: 'delete', objectId: NOTE_ID }))
			);
			const b = body as Record<string, unknown>;
			expect((b.object as Record<string, unknown>).type).toBe('Tombstone');
		});

		it('Tombstone id matches the original Note id', async () => {
			const { body } = await callHandler(() =>
				POST(makeAuthEvent({ action: 'delete', objectId: NOTE_ID }))
			);
			const b = body as Record<string, unknown>;
			expect((b.object as Record<string, unknown>).id).toBe(NOTE_ID);
		});

		it('Tombstone has formerType "Note"', async () => {
			const { body } = await callHandler(() =>
				POST(makeAuthEvent({ action: 'delete', objectId: NOTE_ID }))
			);
			const b = body as Record<string, unknown>;
			expect((b.object as Record<string, unknown>).formerType).toBe('Note');
		});

		it('Tombstone has a deleted timestamp', async () => {
			const { body } = await callHandler(() =>
				POST(makeAuthEvent({ action: 'delete', objectId: NOTE_ID }))
			);
			const b = body as Record<string, unknown>;
			const deleted = (b.object as Record<string, unknown>).deleted as string;
			expect(deleted).toBeDefined();
			expect(new Date(deleted).toString()).not.toBe('Invalid Date');
		});

		it('Delete activity actor matches the user URI', async () => {
			const { body } = await callHandler(() =>
				POST(makeAuthEvent({ action: 'delete', objectId: NOTE_ID }))
			);
			expect((body as Record<string, unknown>).actor).toBe(MOCK_ACTOR_URI);
		});

		it('inserts a new Delete activity record into the database', async () => {
			await callHandler(() =>
				POST(makeAuthEvent({ action: 'delete', objectId: NOTE_ID }))
			);
			expect(db.insert).toHaveBeenCalledWith(activities);
		});

		it('updates the original Create activity to contain Tombstone in the database', async () => {
			await callHandler(() =>
				POST(makeAuthEvent({ action: 'delete', objectId: NOTE_ID }))
			);
			expect(db.update).toHaveBeenCalledWith(activities);
		});

		it('returns 400 when objectId is missing for delete', async () => {
			const { status } = await callHandler(() =>
				POST(makeAuthEvent({ action: 'delete' }))
			);
			expect(status).toBe(400);
		});

		it('returns 404 when trying to delete a non-existent post', async () => {
			(db.query.activities.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
			const { status } = await callHandler(() =>
				POST(makeAuthEvent({ action: 'delete', objectId: 'https://test.com/nonexistent' }))
			);
			expect(status).toBe(404);
		});

		it('returns 401 when unauthenticated user tries to delete', async () => {
			const event = createMockRequestEvent({
				method: 'POST',
				url: `/users/${MOCK_USERNAME}/outbox`,
				params: { username: MOCK_USERNAME },
				json: { action: 'delete', objectId: NOTE_ID },
				locals: { user: null }
			});
			const { status } = await callHandler(() => POST(event));
			expect(status).toBe(401);
		});
	});

	// -----------------------------------------------------------------------
	// Task 2.4.4 – GET /statuses/:uuid returns 410 Gone for Tombstoned objects
	// -----------------------------------------------------------------------
	describe('Task 2.4.4 – GET /users/:username/statuses/:uuid returns 410 for Tombstone', () => {
		const tombstoneActivity = {
			id: 'tombstone-db-id',
			actorId: MOCK_USER_ID,
			activity: {
				id: `https://test.com/users/alice/statuses/create-uuid`,
				type: 'Create',
				actor: MOCK_ACTOR_URI,
				published: new Date('2024-01-01').toISOString(),
				object: {
					id: NOTE_ID,
					type: 'Tombstone',
					formerType: 'Note',
					deleted: new Date().toISOString()
				}
			},
			createdAt: new Date('2024-01-01')
		};

		const liveActivity = {
			id: 'live-db-id',
			actorId: MOCK_USER_ID,
			activity: {
				id: `https://test.com/users/alice/statuses/create-uuid`,
				type: 'Create',
				actor: MOCK_ACTOR_URI,
				published: new Date('2024-01-01').toISOString(),
				object: {
					id: NOTE_ID,
					type: 'Note',
					content: 'Live note content',
					to: [PUBLIC_URI],
					cc: [FOLLOWERS_URI],
					attributedTo: MOCK_ACTOR_URI
				}
			},
			createdAt: new Date('2024-01-01')
		};

		it('returns HTTP 410 Gone for a Tombstoned object', async () => {
			(db.query.activities.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce(tombstoneActivity);
			const event = createMockRequestEvent({
				method: 'GET',
				url: `/users/${MOCK_USERNAME}/statuses/${NOTE_UUID}`,
				params: { username: MOCK_USERNAME, uuid: NOTE_UUID },
				locals: { user: { userId: MOCK_USER_ID, username: MOCK_USERNAME, did: MOCK_DID } }
			});
			const { status } = await callHandler(() => getStatus(event));
			expect(status).toBe(410);
		});

		it('returns HTTP 200 for a live (non-Tombstoned) Note', async () => {
			(db.query.activities.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce(liveActivity);
			const event = createMockRequestEvent({
				method: 'GET',
				url: `/users/${MOCK_USERNAME}/statuses/${NOTE_UUID}`,
				params: { username: MOCK_USERNAME, uuid: NOTE_UUID },
				locals: { user: { userId: MOCK_USER_ID, username: MOCK_USERNAME, did: MOCK_DID } }
			});
			const { status } = await callHandler(() => getStatus(event));
			expect(status).toBe(200);
		});

		it('live Note response body has type "Note"', async () => {
			(db.query.activities.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce(liveActivity);
			const event = createMockRequestEvent({
				method: 'GET',
				url: `/users/${MOCK_USERNAME}/statuses/${NOTE_UUID}`,
				params: { username: MOCK_USERNAME, uuid: NOTE_UUID },
				locals: { user: { userId: MOCK_USER_ID, username: MOCK_USERNAME, did: MOCK_DID } }
			});
			const { body } = await callHandler(() => getStatus(event));
			expect((body as Record<string, unknown>).type).toBe('Note');
		});

		it('returns HTTP 404 when the status UUID does not exist', async () => {
			(db.query.activities.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);
			const event = createMockRequestEvent({
				method: 'GET',
				url: `/users/${MOCK_USERNAME}/statuses/nonexistent-uuid`,
				params: { username: MOCK_USERNAME, uuid: 'nonexistent-uuid' },
				locals: { user: { userId: MOCK_USER_ID, username: MOCK_USERNAME, did: MOCK_DID } }
			});
			const { status } = await callHandler(() => getStatus(event));
			expect(status).toBe(404);
		});

		it('returns 403 for a private note accessed by a non-follower', async () => {
			const privateActivity = {
				...liveActivity,
				activity: {
					...liveActivity.activity,
					object: { ...liveActivity.activity.object, to: [FOLLOWERS_URI], cc: [] }
				}
			};
			(db.query.activities.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce(privateActivity);
			(db.query.users.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
				id: MOCK_USER_ID, username: MOCK_USERNAME, didDocument: { id: MOCK_DID }
			});
			(db.query.followers.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);

			const event = createMockRequestEvent({
				method: 'GET',
				url: `/users/${MOCK_USERNAME}/statuses/${NOTE_UUID}`,
				params: { username: MOCK_USERNAME, uuid: NOTE_UUID },
				locals: { user: { userId: 'stranger-id', username: 'stranger', did: 'did:web:test.com:u:stranger' } }
			});
			const { status } = await callHandler(() => getStatus(event));
			expect(status).toBe(403);
		});

		it('returns 200 for a followers-only note accessed by a follower', async () => {
			const followersActivity = {
				...liveActivity,
				activity: {
					...liveActivity.activity,
					object: { ...liveActivity.activity.object, to: [FOLLOWERS_URI], cc: [] }
				}
			};
			(db.query.activities.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce(followersActivity);
			(db.query.users.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
				id: MOCK_USER_ID, username: MOCK_USERNAME, didDocument: { id: MOCK_DID }
			});
			(db.query.followers.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
				userId: MOCK_USER_ID, followerId: 'follower-id'
			});

			const event = createMockRequestEvent({
				method: 'GET',
				url: `/users/${MOCK_USERNAME}/statuses/${NOTE_UUID}`,
				params: { username: MOCK_USERNAME, uuid: NOTE_UUID },
				locals: { user: { userId: 'follower-id', username: 'bob', did: 'did:web:test.com:u:bob' } }
			});
			const { status } = await callHandler(() => getStatus(event));
			expect(status).toBe(200);
		});
	});
});
