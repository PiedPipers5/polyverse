// src/tests/Epic2_BE/outbox.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { POST, GET } from '../../routes/users/[username]/outbox/+server';
import { GET as getStatus } from '../../routes/users/[username]/statuses/[uuid]/+server';
import { db } from '$lib/server/db';
import { activities, users, followers } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { createMockRequestEvent } from '../test-utils'; // Assuming a test-utils.ts for mock event creation

// Mock environment variables
vi.mock('$env/dynamic/private', () => ({
    env: {
        DOMAIN: 'test.com',
        BLOB_READ_WRITE_TOKEN: 'test_blob_token'
    }
}));

// Mock database
vi.mock('$lib/server/db', () => ({
    db: {
        query: {
            users: { findFirst: vi.fn() },
            activities: { findMany: vi.fn() },
            followers: { findFirst: vi.fn() }
        },
        insert: vi.fn(() => ({
            values: vi.fn(() => ({
                returning: vi.fn(() => Promise.resolve([{ id: 'mock-id' }])) // Default mock for returning
            }))
        })),
        update: vi.fn(() => ({
            set: vi.fn(() => ({
                where: vi.fn(() => ({
                    returning: vi.fn(() => Promise.resolve([{ id: 'mock-id' }])) // Default mock for returning
                }))
            }))
        }))
    }
}));

// Mock $lib/server/blob for media uploads
vi.mock('$lib/server/blob', () => ({
    uploadFile: vi.fn(() => Promise.resolve('https://test.com/media/uploaded.jpg'))
}));

// Mock $lib/server/validation for media uploads
vi.mock('$lib/server/validation', () => ({
    validateFile: vi.fn(() => true)
}));

// Correct import for the media upload handler
import { POST as mediaUploadPostHandler } from '../../routes/api/media/upload/+server';

beforeEach(() => {
    vi.clearAllMocks();

    (db.query.users.findFirst as vi.Mock).mockImplementation(({ where }) => {
        if (typeof where === 'function' && where(users.username) === MOCK_USERNAME) {
            return Promise.resolve({
                id: MOCK_USER_ID,
                username: MOCK_USERNAME,
                didDocument: { id: MOCK_DID }
            });
        }
        if (typeof where === 'function' && where(users.username) === MOCK_FOLLOWER_USERNAME) {
            return Promise.resolve({
                id: MOCK_FOLLOWER_ID,
                username: MOCK_FOLLOWER_USERNAME,
                didDocument: { id: `did:web:test.com:u:${MOCK_FOLLOWER_USERNAME}` }
            });
        }
        return Promise.resolve(undefined);
    });

    // Mock for auth in createMockRequestEvent
    vi.spyOn(db.query.users, 'findFirst').mockResolvedValue({
        id: MOCK_USER_ID,
        username: MOCK_USERNAME,
        didDocument: { id: MOCK_DID },
        passwordHash: 'hashed_password' // Required by some auth checks
    });
});

describe('Epic 2 Backend Tasks', () => {

    // --- User Story 2.1: Publishing a Note (Task 2.1.2, 2.1.3, 2.5.3) ---
    describe('POST /users/[username]/outbox - Create Note', () => {
        it('should create a public Note activity without media', async () => {
            const content = 'Hello, ActivityPub!';
            const event = createMockRequestEvent({
                method: 'POST',
                url: `/users/${MOCK_USERNAME}/outbox`,
                params: { username: MOCK_USERNAME },
                json: { content, privacy: 'public' },
                locals: { user: { userId: MOCK_USER_ID, username: MOCK_USERNAME, did: MOCK_DID } }
            });

            // Mock insert activity to return something if needed
            (db.insert as vi.Mock).mockReturnValue({
                values: vi.fn().mockReturnValue({
                    returning: vi.fn().mockResolvedValue([{ id: 'new-activity-id' }])
                })
            });

            const response = await POST(event);
            const body = await response.json();

            expect(response.status).toBe(201);
            expect(response.headers.get('Content-Type')).toContain('application/json');
            expect(body.type).toBe('Create');
            expect(body.actor).toBe(MOCK_ACTOR_URI);
            expect(body.object.type).toBe('Note');
            expect(body.object.content).toBe(content);
            expect(body.object.to).toContain('https://www.w3.org/ns/activitystreams#Public');
            expect(body.object.cc).toContain(`${MOCK_ACTOR_URI}/followers`);
            expect(db.insert).toHaveBeenCalledWith(activities);
            expect(db.insert.mock.calls[0][0]).toEqual(activities); // Ensure activities table is used
            expect(db.insert.mock.calls[0][1].values.activity.type).toBe('Create');
            expect(db.insert.mock.calls[0][1].values.activity.object.type).toBe('Note');
            expect(db.insert.mock.calls[0][1].values.actorId).toBe(MOCK_USER_ID);
        });

        it('should create a Note with media attachment (Task 2.5.3)', async () => {
            const content = 'Check out this pic!';
            const media = [{ type: 'Image', url: 'https://test.com/media/uploaded.jpg', mediaType: 'image/jpeg' }];
            const event = createMockRequestEvent({
                method: 'POST',
                url: `/users/${MOCK_USERNAME}/outbox`,
                params: { username: MOCK_USERNAME },
                json: { content, media, privacy: 'public' },
                locals: { user: { userId: MOCK_USER_ID, username: MOCK_USERNAME, did: MOCK_DID } }
            });

            const response = await POST(event);
            const body = await response.json();

            expect(response.status).toBe(201);
            expect(body.object.attachment).toEqual(media);
        });

        it('should return 401 if user is not authenticated', async () => {
            const event = createMockRequestEvent({
                method: 'POST',
                url: `/users/${MOCK_USERNAME}/outbox`,
                params: { username: MOCK_USERNAME },
                json: { content: 'test', privacy: 'public' },
                locals: { user: null }
            });
            const response = await POST(event);
            expect(response.status).toBe(401);
        });

        it(`should return 403 if authenticated user tries to post to another user's outbox`, async () => {
            const event = createMockRequestEvent({
                method: 'POST',
                url: `/users/otheruser/outbox`,
                params: { username: 'otheruser' },
                json: { content: 'test', privacy: 'public' },
                locals: { user: { userId: MOCK_USER_ID, username: MOCK_USERNAME, did: MOCK_DID } }
            });
            const response = await POST(event);
            expect(response.status).toBe(403);
        });

        it('should return 400 if content and media are missing', async () => {
            const event = createMockRequestEvent({
                method: 'POST',
                url: `/users/${MOCK_USERNAME}/outbox`,
                params: { username: MOCK_USERNAME },
                json: { privacy: 'public' },
                locals: { user: { userId: MOCK_USER_ID, username: MOCK_USERNAME, did: MOCK_DID } }
            });
            const response = await POST(event);
            expect(response.status).toBe(400);
        });
    });

    // --- User Story 2.2: Viewing the Outbox (Task 2.2.1, 2.2.2) ---
    describe('GET /users/[username]/outbox', () => {
        const mockActivities = [
            { id: 'act1', actorId: MOCK_USER_ID, activity: { type: 'Create', object: { id: 'note1', content: 'First post', to: ['https://www.w3.org/ns/activitystreams#Public'] } }, createdAt: new Date() },
            { id: 'act2', actorId: MOCK_USER_ID, activity: { type: 'Create', object: { id: 'note2', content: 'Second post', to: ['https://www.w3.org/ns/activitystreams#Public'] } }, createdAt: new Date() },
        ];

        beforeEach(() => {
            (db.query.activities.findMany as vi.Mock).mockResolvedValue(mockActivities);
        });

        it('should return an OrderedCollection for the root outbox (Task 2.2.1)', async () => {
            const event = createMockRequestEvent({
                method: 'GET',
                url: `/users/${MOCK_USERNAME}/outbox`,
                params: { username: MOCK_USERNAME },
                locals: { user: { userId: MOCK_USER_ID, username: MOCK_USERNAME, did: MOCK_DID } }
            });

            const response = await GET(event);
            const body = await response.json();

            expect(response.status).toBe(200);
            expect(body.type).toBe('OrderedCollection');
            expect(body.totalItems).toBe(mockActivities.length);
            expect(body.first).toBe(`${MOCK_ACTOR_URI}/outbox?page=1`);
        });

        it('should return an OrderedCollectionPage for paginated outbox (Task 2.2.2)', async () => {
            const event = createMockRequestEvent({
                method: 'GET',
                url: `/users/${MOCK_USERNAME}/outbox?page=1&limit=1`,
                params: { username: MOCK_USERNAME },
                locals: { user: { userId: MOCK_USER_ID, username: MOCK_USERNAME, did: MOCK_DID } }
            });

            const response = await GET(event);
            const body = await response.json();

            expect(response.status).toBe(200);
            expect(body.type).toBe('OrderedCollectionPage');
            expect(body.orderedItems.length).toBe(1);
            expect(body.partOf).toBe(`${MOCK_ACTOR_URI}/outbox`);
            expect(body.next).toBe(`${MOCK_ACTOR_URI}/outbox?page=2`); // Assuming more items than limit
        });

        it('should return 404 if user not found', async () => {
            (db.query.users.findFirst as vi.Mock).mockResolvedValueOnce(undefined); // First call for target user
            const event = createMockRequestEvent({
                method: 'GET',
                url: `/users/nonexistent/outbox`,
                params: { username: 'nonexistent' },
                locals: { user: { userId: MOCK_USER_ID, username: MOCK_USERNAME, did: MOCK_DID } }
            });
            const response = await GET(event);
            expect(response.status).toBe(404);
        });
    });

    // --- User Story 2.3: Audience Scoping (Task 2.3.2, 2.3.3) ---
    describe('Audience Scoping', () => {
        const PUBLIC_URI = 'https://www.w3.org/ns/activitystreams#Public';
        const FOLLOWERS_URI = `${MOCK_ACTOR_URI}/followers`;
        const mockPublicNote = { id: 'public-note-id', actorId: MOCK_USER_ID, activity: { type: 'Create', object: { id: 'note-public', content: 'Public post', to: [PUBLIC_URI], attributedTo: MOCK_ACTOR_URI } }, createdAt: new Date() };
        const mockFollowersNote = { id: 'followers-note-id', actorId: MOCK_USER_ID, activity: { type: 'Create', object: { id: 'note-followers', content: 'Followers-only post', to: [FOLLOWERS_URI], attributedTo: MOCK_ACTOR_URI } }, createdAt: new Date() };
        const mockUnlistedNote = { id: 'unlisted-note-id', actorId: MOCK_USER_ID, activity: { type: 'Create', object: { id: 'note-unlisted', content: 'Unlisted post', to: [FOLLOWERS_URI], cc: [PUBLIC_URI], attributedTo: MOCK_ACTOR_URI } }, createdAt: new Date() };

        it('should map privacy "public" correctly (Task 2.3.2)', async () => {
            const content = 'A new public post';
            const event = createMockRequestEvent({
                method: 'POST',
                url: `/users/${MOCK_USERNAME}/outbox`,
                params: { username: MOCK_USERNAME },
                json: { content, privacy: 'public' },
                locals: { user: { userId: MOCK_USER_ID, username: MOCK_USERNAME, did: MOCK_DID } }
            });
            await POST(event);
            const insertedActivity = (db.insert as vi.Mock).mock.calls[0][1].values.activity;
            expect(insertedActivity.object.to).toContain(PUBLIC_URI);
            expect(insertedActivity.object.cc).toContain(FOLLOWERS_URI);
        });

        it('should map privacy "followers" correctly (Task 2.3.2)', async () => {
            const content = 'A new followers-only post';
            const event = createMockRequestEvent({
                method: 'POST',
                url: `/users/${MOCK_USERNAME}/outbox`,
                params: { username: MOCK_USERNAME },
                json: { content, privacy: 'followers' },
                locals: { user: { userId: MOCK_USER_ID, username: MOCK_USERNAME, did: MOCK_DID } }
            });
            await POST(event);
            const insertedActivity = (db.insert as vi.Mock).mock.calls[0][1].values.activity;
            expect(insertedActivity.object.to).toContain(FOLLOWERS_URI);
            expect(insertedActivity.object.cc).not.toContain(PUBLIC_URI);
        });

        it('should map privacy "unlisted" correctly (Task 2.3.2)', async () => {
            const content = 'A new unlisted post';
            const event = createMockRequestEvent({
                method: 'POST',
                url: `/users/${MOCK_USERNAME}/outbox`,
                params: { username: MOCK_USERNAME },
                json: { content, privacy: 'unlisted' },
                locals: { user: { userId: MOCK_USER_ID, username: MOCK_USERNAME, did: MOCK_DID } }
            });
            await POST(event);
            const insertedActivity = (db.insert as vi.Mock).mock.calls[0][1].values.activity;
            expect(insertedActivity.object.to).toContain(FOLLOWERS_URI);
            expect(insertedActivity.object.cc).toContain(PUBLIC_URI);
        });

        it('owner should see all posts in outbox (Task 2.3.3)', async () => {
            (db.query.activities.findMany as vi.Mock).mockResolvedValue([mockPublicNote, mockFollowersNote]);
            const event = createMockRequestEvent({
                method: 'GET',
                url: `/users/${MOCK_USERNAME}/outbox?page=1&limit=5`,
                params: { username: MOCK_USERNAME },
                locals: { user: { userId: MOCK_USER_ID, username: MOCK_USERNAME, did: MOCK_DID } }
            });
            const response = await GET(event);
            const body = await response.json();
            expect(body.orderedItems.length).toBe(2);
            expect(body.orderedItems.map((item: any) => item.object.id)).toEqual(['note-public', 'note-followers']);
        });

        it('non-follower should only see public posts (Task 2.3.3)', async () => {
            (db.query.users.findFirst as vi.Mock).mockResolvedValueOnce({ id: MOCK_USER_ID, username: MOCK_USERNAME, didDocument: { id: MOCK_DID } }); // Target user
            (db.query.users.findFirst as vi.Mock).mockResolvedValueOnce({ id: 'non-follower-id', username: 'nonfollower', didDocument: { id: 'did:web:test.com:u:nonfollower' } }); // Requestor
            (db.query.activities.findMany as vi.Mock).mockResolvedValue([mockPublicNote, mockFollowersNote, mockUnlistedNote]);
            (db.query.followers.findFirst as vi.Mock).mockResolvedValue(undefined); // Non-follower
            const event = createMockRequestEvent({
                method: 'GET',
                url: `/users/${MOCK_USERNAME}/outbox?page=1&limit=5`,
                params: { username: MOCK_USERNAME },
                locals: { user: { userId: 'non-follower-id', username: 'nonfollower', did: 'did:web:test.com:u:nonfollower' } }
            });
            const response = await GET(event);
            const body = await response.json();
            expect(body.orderedItems.length).toBe(2);
            expect(body.orderedItems.map((item: any) => item.object.id)).toEqual(['note-public', 'note-unlisted']); // Unlisted is public via cc
        });

        it('follower should see public, unlisted and followers-only posts (Task 2.3.3)', async () => {
            (db.query.users.findFirst as vi.Mock).mockResolvedValueOnce({ id: MOCK_USER_ID, username: MOCK_USERNAME, didDocument: { id: MOCK_DID } }); // Target user
            (db.query.users.findFirst as vi.Mock).mockResolvedValueOnce({ id: MOCK_FOLLOWER_ID, username: MOCK_FOLLOWER_USERNAME, didDocument: { id: `did:web:test.com:u:${MOCK_FOLLOWER_USERNAME}` } }); // Requestor
            (db.query.activities.findMany as vi.Mock).mockResolvedValue([mockPublicNote, mockFollowersNote, mockUnlistedNote]);
            (db.query.followers.findFirst as vi.Mock).mockResolvedValueOnce({ userId: MOCK_USER_ID, followerId: MOCK_FOLLOWER_ID }); // Follower
            const event = createMockRequestEvent({
                method: 'GET',
                url: `/users/${MOCK_USERNAME}/outbox?page=1&limit=5`,
                params: { username: MOCK_USERNAME },
                locals: { user: { userId: MOCK_FOLLOWER_ID, username: MOCK_FOLLOWER_USERNAME, did: `did:web:test.com:u:${MOCK_FOLLOWER_USERNAME}` } }
            });
            const response = await GET(event);
            const body = await response.json();
            expect(body.orderedItems.length).toBe(3);
            expect(body.orderedItems.map((item: any) => item.object.id)).toEqual(['note-public', 'note-followers', 'note-unlisted']);
        });
    });

    // --- User Story 2.4: Editing and Deleting (Task 2.4.2, 2.4.3, 2.4.4) ---
    describe('POST /users/[username]/outbox - Edit & Delete', () => {
        const NOTE_UUID = 'note-uuid-123';
        const NOTE_ID = `https://test.com/users/${MOCK_USERNAME}/statuses/${NOTE_UUID}`;
        const mockOriginalActivity = {
            id: 'original-activity-id',
            actorId: MOCK_USER_ID,
            activity: {
                type: 'Create',
                actor: MOCK_ACTOR_URI,
                published: new Date().toISOString(),
                object: {
                    id: NOTE_ID,
                    type: 'Note',
                    content: 'Original content',
                    attributedTo: MOCK_ACTOR_URI,
                    to: ['https://www.w3.org/ns/activitystreams#Public'],
                    cc: [`${MOCK_ACTOR_URI}/followers`]
                }
            },
            createdAt: new Date()
        };

        beforeEach(() => {
            (db.query.activities.findMany as vi.Mock).mockResolvedValue([mockOriginalActivity]);
            (db.update as vi.Mock).mockReturnValue({
                set: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        returning: vi.fn().mockResolvedValue([{ id: 'updated-activity-id' }])
                    })
                })
            });
            (db.insert as vi.Mock).mockReturnValue({ values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) }) });
        });

        it('should handle "edit" action correctly (Task 2.4.2)', async () => {
            const updatedContent = 'Updated content here!';
            const event = createMockRequestEvent({
                method: 'POST',
                url: `/users/${MOCK_USERNAME}/outbox`,
                params: { username: MOCK_USERNAME },
                json: { action: 'edit', objectId: NOTE_ID, content: updatedContent },
                locals: { user: { userId: MOCK_USER_ID, username: MOCK_USERNAME, did: MOCK_DID } }
            });

            const response = await POST(event);
            const body = await response.json();

            expect(response.status).toBe(201);
            expect(body.type).toBe('Update');
            expect(body.object.id).toBe(NOTE_ID);
            expect(body.object.content).toBe(updatedContent);

            // Verify db.update was called for the original activity
            expect(db.update).toHaveBeenCalledWith(activities);
            expect((db.update as vi.Mock).mock.calls[0][1].set.mock.calls[0][0].activity.object.content).toBe(updatedContent);
            expect((db.update as vi.Mock).mock.calls[0][1].set.mock.calls[0][0].activity.object.updated).toBeDefined();

            // Verify db.insert was called for the Update activity
            expect(db.insert).toHaveBeenCalledWith(activities);
            expect(db.insert.mock.calls[0][1].values.activity.type).toBe('Update');
        });

        it('should handle "delete" action correctly (Task 2.4.3)', async () => {
            const event = createMockRequestEvent({
                method: 'POST',
                url: `/users/${MOCK_USERNAME}/outbox`,
                params: { username: MOCK_USERNAME },
                json: { action: 'delete', objectId: NOTE_ID },
                locals: { user: { userId: MOCK_USER_ID, username: MOCK_USERNAME, did: MOCK_DID } }
            });

            const response = await POST(event);
            const body = await response.json();

            expect(response.status).toBe(200);
            expect(body.type).toBe('Delete');
            expect(body.object.id).toBe(NOTE_ID);
            expect(body.object.type).toBe('Tombstone');

            // Verify db.update was called for the original activity to replace with Tombstone
            expect(db.update).toHaveBeenCalledWith(activities);
            expect((db.update as vi.Mock).mock.calls[0][1].set.mock.calls[0][0].activity.object.type).toBe('Tombstone');

            // Verify db.insert was called for the Delete activity
            expect(db.insert).toHaveBeenCalledWith(activities);
            expect(db.insert.mock.calls[0][1].values.activity.type).toBe('Delete');
        });
    });

    describe('GET /users/[username]/statuses/[uuid] - Tombstone check (Task 2.4.4)', () => {
        const NOTE_UUID = 'tombstone-uuid';
        const NOTE_ID = `https://test.com/users/${MOCK_USERNAME}/statuses/${NOTE_UUID}`;
        const mockTombstoneActivity = {
            id: 'tombstone-activity-id',
            actorId: MOCK_USER_ID,
            activity: {
                type: 'Create', // Tombstone is wrapped in original Create
                actor: MOCK_ACTOR_URI,
                published: new Date().toISOString(),
                object: {
                    id: NOTE_ID,
                    type: 'Tombstone',
                    formerType: 'Note',
                    deleted: new Date().toISOString()
                }
            },
            createdAt: new Date()
        };

        it('should return 410 Gone for a Tombstoned object (Task 2.4.4)', async () => {
            (db.query.activities.findFirst as vi.Mock).mockResolvedValueOnce(mockTombstoneActivity); // First call for target user
            (db.query.users.findFirst as vi.Mock).mockResolvedValueOnce({ id: MOCK_USER_ID, username: MOCK_USERNAME, didDocument: { id: MOCK_DID } }); // Mock user for internal checks
            const event = createMockRequestEvent({
                method: 'GET',
                url: `/users/${MOCK_USERNAME}/statuses/${NOTE_UUID}`,
                params: { username: MOCK_USERNAME, uuid: NOTE_UUID },
                locals: { user: { userId: MOCK_USER_ID, username: MOCK_USERNAME, did: MOCK_DID } }
            });
            const response = await getStatus(event);
            expect(response.status).toBe(410);
        });

        it('should return 200 for a non-Tombstoned object', async () => {
            const mockLiveActivity = {
                ...mockTombstoneActivity,
                activity: {
                    ...mockTombstoneActivity.activity,
                    object: {
                        ...mockTombstoneActivity.activity.object,
                        type: 'Note',
                        content: 'This is a live note'
                    }
                }
            };
            (db.query.activities.findFirst as vi.Mock).mockResolvedValueOnce(mockLiveActivity);
            (db.query.users.findFirst as vi.Mock).mockResolvedValueOnce({ id: MOCK_USER_ID, username: MOCK_USERNAME, didDocument: { id: MOCK_DID } }); // Mock user for internal checks

            const event = createMockRequestEvent({
                method: 'GET',
                url: `/users/${MOCK_USERNAME}/statuses/${NOTE_UUID}`,
                params: { username: MOCK_USERNAME, uuid: NOTE_UUID },
                locals: { user: { userId: MOCK_USER_ID, username: MOCK_USERNAME, did: MOCK_DID } }
            });
            const response = await getStatus(event);
            expect(response.status).toBe(200);
            const body = await response.json();
            expect(body.type).toBe('Note');
        });
    });

    // --- User Story 2.5: Media Attachments (Task 2.5.1) ---
    describe('POST /api/media/upload - Upload Media', () => {
        it('should upload a file and return its URL (Task 2.5.1)', async () => {
            const mockFile = new File(['test content'], 'image.jpg', { type: 'image/jpeg' });
            const formData = new FormData();
            formData.append('file', mockFile);

            const event = createMockRequestEvent({
                method: 'POST',
                url: '/api/media/upload',
                formData: formData,
                locals: { user: { userId: MOCK_USER_ID, username: MOCK_USERNAME, did: MOCK_DID } }
            });

            // Mock the request.formData() call
            Object.defineProperty(event.request, 'formData', {
                value: vi.fn().mockResolvedValue(formData)
            });

            const response = await mediaUploadPostHandler(event);
            const body = await response.json();

            expect(response.status).toBe(201);
            expect(body.url).toBe('https://test.com/media/uploaded.jpg');
            expect(body.type).toBe('Image');
            expect(body.mediaType).toBe('image/jpeg');
            expect(vi.mocked(db.query.users.findFirst)).toHaveBeenCalled(); // Ensure auth check
            expect(vi.mocked($lib.server.blob.uploadFile)).toHaveBeenCalledWith(mockFile);
            expect(vi.mocked($lib.server.validation.validateFile)).toHaveBeenCalledWith(mockFile);
        });

        it('should return 401 if not authenticated', async () => {
            const event = createMockRequestEvent({
                method: 'POST',
                url: '/api/media/upload',
                formData: new FormData(),
                locals: { user: null }
            });
            Object.defineProperty(event.request, 'formData', {
                value: vi.fn().mockResolvedValue(new FormData())
            });

            const response = await mediaUploadPostHandler(event);
            expect(response.status).toBe(401);
        });

        it('should return 400 if no file is uploaded', async () => {
            const event = createMockRequestEvent({
                method: 'POST',
                url: '/api/media/upload',
                formData: new FormData(),
                locals: { user: { userId: MOCK_USER_ID, username: MOCK_USERNAME, did: MOCK_DID } }
            });
            Object.defineProperty(event.request, 'formData', {
                value: vi.fn().mockResolvedValue(new FormData())
            });

            const response = await mediaUploadPostHandler(event);
            expect(response.status).toBe(400);
        });
    });
});
