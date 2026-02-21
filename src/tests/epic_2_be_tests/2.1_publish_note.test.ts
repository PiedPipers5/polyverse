// src/tests/epic_2_be_tests/2.1_publish_note.test.ts
//
// Unit Tests for User Story 2.1: Publishing a Note
// Covers Tasks:
//   2.1.2 - POST /users/:username/outbox endpoint (unique URI generation)
//   2.1.3 - Construct ActivityPub Note + Create activity
//   2.5.3 - Map media URL to attachment field on Note

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../../routes/users/[username]/outbox/+server';
import { db } from '$lib/server/db';
import { activities } from '$lib/server/db/schema';
import { createMockRequestEvent } from '../test-utils';

// ---------------------------------------------------------------------------
// Constants (NOT used inside vi.mock factories due to hoisting)
// ---------------------------------------------------------------------------
const DOMAIN = 'localhost';
const MOCK_USER_ID = 'user-uuid-001';
const MOCK_USERNAME = 'alice';
const MOCK_DID = `did:web:test.com:u:alice`;
const MOCK_ACTOR_URI = `https://test.com/users/alice`;
const PUBLIC_URI = 'https://www.w3.org/ns/activitystreams#Public';
const FOLLOWERS_URI = `https://test.com/users/alice/followers`;

// ---------------------------------------------------------------------------
// Module Mocks (use inline literals – vi.mock is hoisted before const init)
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
		// SvelteKit error() throws an HttpError with a .status property
		const httpErr = err as { status?: number; body?: unknown };
		return { status: httpErr.status ?? 500, body: httpErr.body ?? null };
	}
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeAuthEvent(overrides: Record<string, unknown> = {}) {
	return createMockRequestEvent({
		method: 'POST',
		url: `/users/${MOCK_USERNAME}/outbox`,
		params: { username: MOCK_USERNAME },
		locals: { user: { userId: MOCK_USER_ID, username: MOCK_USERNAME, did: MOCK_DID } },
		...overrides
	});
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('User Story 2.1 – Publishing a Note', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		(db.insert as ReturnType<typeof vi.fn>).mockReturnValue({
			values: vi.fn().mockReturnValue({
				returning: vi.fn().mockResolvedValue([{ id: 'new-activity-id' }])
			})
		});
	});

	// -----------------------------------------------------------------------
	// Task 2.1.2 – Endpoint exists and generates unique URIs
	// -----------------------------------------------------------------------
	describe('Task 2.1.2 – POST /users/:username/outbox endpoint', () => {
		it('returns HTTP 201 on successful note creation', async () => {
			const event = makeAuthEvent({ json: { content: 'Hello world!', privacy: 'public' } });
			const { status } = await callHandler(() => POST(event));
			expect(status).toBe(201);
		});

		it('generates a unique URI for the Note (id field is a valid https URI)', async () => {
			const event = makeAuthEvent({ json: { content: 'Unique URI test', privacy: 'public' } });
			const { body } = await callHandler(() => POST(event));
			const b = body as Record<string, unknown>;
			expect((b.object as Record<string, unknown>).id as string).toMatch(/^https:\/\//);
			expect((b.object as Record<string, unknown>).id as string).toContain(`/users/${MOCK_USERNAME}/statuses/`);
		});

		it('generates a unique URI for the Create activity (distinct from Note id)', async () => {
			const event = makeAuthEvent({ json: { content: 'Activity URI test', privacy: 'public' } });
			const { body } = await callHandler(() => POST(event));
			const b = body as Record<string, unknown>;
			expect(b.id).toMatch(/^https:\/\//);
			expect(b.id).not.toBe((b.object as Record<string, unknown>).id);
		});

		it('sets Location header to the Create activity URI', async () => {
			const event = makeAuthEvent({ json: { content: 'Location header test', privacy: 'public' } });
			const res = await POST(event);
			const body = await res.json();
			expect(res.headers.get('Location')).toBe(body.id);
		});

		it('returns 401 when user is not authenticated', async () => {
			const event = createMockRequestEvent({
				method: 'POST',
				url: `/users/${MOCK_USERNAME}/outbox`,
				params: { username: MOCK_USERNAME },
				json: { content: 'test', privacy: 'public' },
				locals: { user: null }
			});
			const { status } = await callHandler(() => POST(event));
			expect(status).toBe(401);
		});

		it('returns 403 when authenticated user posts to another user\'s outbox', async () => {
			const event = createMockRequestEvent({
				method: 'POST',
				url: `/users/bob/outbox`,
				params: { username: 'bob' },
				json: { content: 'test', privacy: 'public' },
				locals: { user: { userId: MOCK_USER_ID, username: MOCK_USERNAME, did: MOCK_DID } }
			});
			const { status } = await callHandler(() => POST(event));
			expect(status).toBe(403);
		});

		it('returns 400 when both content and media are missing', async () => {
			const event = makeAuthEvent({ json: { privacy: 'public' } });
			const { status } = await callHandler(() => POST(event));
			expect(status).toBe(400);
		});

		it('persists the activity to the database', async () => {
			const event = makeAuthEvent({ json: { content: 'DB persist test', privacy: 'public' } });
			await callHandler(() => POST(event));
			expect(db.insert).toHaveBeenCalledWith(activities);
		});
	});

	// -----------------------------------------------------------------------
	// Task 2.1.3 – Construct ActivityPub Note + Create activity
	// -----------------------------------------------------------------------
	describe('Task 2.1.3 – Construct ActivityPub Note wrapped in Create activity', () => {
		it('response body has type "Create"', async () => {
			const event = makeAuthEvent({ json: { content: 'AP Create test', privacy: 'public' } });
			const { body } = await callHandler(() => POST(event));
			expect((body as Record<string, unknown>).type).toBe('Create');
		});

		it('Create activity actor matches the posting user\'s URI', async () => {
			const event = makeAuthEvent({ json: { content: 'Actor test', privacy: 'public' } });
			const { body } = await callHandler(() => POST(event));
			expect((body as Record<string, unknown>).actor).toBe(MOCK_ACTOR_URI);
		});

		it('Note object has type "Note"', async () => {
			const event = makeAuthEvent({ json: { content: 'Note type test', privacy: 'public' } });
			const { body } = await callHandler(() => POST(event));
			const b = body as Record<string, unknown>;
			expect((b.object as Record<string, unknown>).type).toBe('Note');
		});

		it('Note object content matches submitted content', async () => {
			const content = 'My first ActivityPub post!';
			const event = makeAuthEvent({ json: { content, privacy: 'public' } });
			const { body } = await callHandler(() => POST(event));
			const b = body as Record<string, unknown>;
			expect((b.object as Record<string, unknown>).content).toBe(content);
		});

		it('Note object has a published timestamp', async () => {
			const event = makeAuthEvent({ json: { content: 'Timestamp test', privacy: 'public' } });
			const { body } = await callHandler(() => POST(event));
			const b = body as Record<string, unknown>;
			const published = (b.object as Record<string, unknown>).published as string;
			expect(published).toBeDefined();
			expect(new Date(published).toString()).not.toBe('Invalid Date');
		});

		it('Note object attributedTo matches the actor URI', async () => {
			const event = makeAuthEvent({ json: { content: 'AttributedTo test', privacy: 'public' } });
			const { body } = await callHandler(() => POST(event));
			const b = body as Record<string, unknown>;
			expect((b.object as Record<string, unknown>).attributedTo).toBe(MOCK_ACTOR_URI);
		});

		it('Note object has to and cc fields', async () => {
			const event = makeAuthEvent({ json: { content: 'to/cc test', privacy: 'public' } });
			const { body } = await callHandler(() => POST(event));
			const b = body as Record<string, unknown>;
			expect(Array.isArray((b.object as Record<string, unknown>).to)).toBe(true);
			expect(Array.isArray((b.object as Record<string, unknown>).cc)).toBe(true);
		});

		it('Create activity actor field equals Note attributedTo field (Task 2.1.5 check)', async () => {
			const event = makeAuthEvent({ json: { content: 'Actor == attributedTo', privacy: 'public' } });
			const { body } = await callHandler(() => POST(event));
			const b = body as Record<string, unknown>;
			expect(b.actor).toBe((b.object as Record<string, unknown>).attributedTo);
		});

		it('Create activity id and Note id are distinct valid URIs (Task 2.1.5 check)', async () => {
			const event = makeAuthEvent({ json: { content: 'Distinct IDs', privacy: 'public' } });
			const { body } = await callHandler(() => POST(event));
			const b = body as Record<string, unknown>;
			expect(b.id).not.toBe((b.object as Record<string, unknown>).id);
			expect(b.id as string).toMatch(/^https:\/\//);
			expect((b.object as Record<string, unknown>).id as string).toMatch(/^https:\/\//);
		});

		it('Create activity has a published timestamp', async () => {
			const event = makeAuthEvent({ json: { content: 'Activity timestamp', privacy: 'public' } });
			const { body } = await callHandler(() => POST(event));
			expect((body as Record<string, unknown>).published).toBeDefined();
		});
	});

	// -----------------------------------------------------------------------
	// Task 2.5.3 – Map media URL to attachment field
	// -----------------------------------------------------------------------
	describe('Task 2.5.3 – Map media URL to Note attachment field', () => {
		it('Note attachment is empty array when no media provided', async () => {
			const event = makeAuthEvent({ json: { content: 'No media', privacy: 'public' } });
			const { body } = await callHandler(() => POST(event));
			const b = body as Record<string, unknown>;
			expect((b.object as Record<string, unknown>).attachment).toEqual([]);
		});

		it('Note attachment contains provided media objects', async () => {
			const media = [
				{ type: 'Image', url: 'https://test.com/media/photo.jpg', mediaType: 'image/jpeg' }
			];
			const event = makeAuthEvent({
				json: { content: 'Post with image', privacy: 'public', media }
			});
			const { body } = await callHandler(() => POST(event));
			const b = body as Record<string, unknown>;
			expect((b.object as Record<string, unknown>).attachment).toEqual(media);
		});

		it('Note attachment supports multiple media items', async () => {
			const media = [
				{ type: 'Image', url: 'https://test.com/media/photo1.jpg', mediaType: 'image/jpeg' },
				{ type: 'Image', url: 'https://test.com/media/photo2.png', mediaType: 'image/png' }
			];
			const event = makeAuthEvent({
				json: { content: 'Multiple images', privacy: 'public', media }
			});
			const { body } = await callHandler(() => POST(event));
			const b = body as Record<string, unknown>;
			const attachment = (b.object as Record<string, unknown>).attachment as unknown[];
			expect(attachment).toHaveLength(2);
		});

		it('accepts post with only media and no text content', async () => {
			const media = [
				{ type: 'Image', url: 'https://test.com/media/only-image.jpg', mediaType: 'image/jpeg' }
			];
			const event = makeAuthEvent({ json: { privacy: 'public', media } });
			const { status } = await callHandler(() => POST(event));
			expect(status).toBe(201);
		});

		it('attachment mediaType is preserved from input', async () => {
			const media = [{ type: 'Image', url: 'https://test.com/media/gif.gif', mediaType: 'image/gif' }];
			const event = makeAuthEvent({ json: { content: 'GIF post', privacy: 'public', media } });
			const { body } = await callHandler(() => POST(event));
			const b = body as Record<string, unknown>;
			const attachment = (b.object as Record<string, unknown>).attachment as Array<Record<string, unknown>>;
			expect(attachment[0].mediaType).toBe('image/gif');
		});
	});
});
