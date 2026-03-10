// src/tests/Epic4_BE/context.test.ts
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
const mockFindFirstActivities = vi.fn();
const mockFindManyActivities = vi.fn();
const mockFindManyUsers = vi.fn();
const mockFindManyRemoteActors = vi.fn();
const mockInsert = vi.fn().mockReturnValue({
    values: vi.fn().mockResolvedValue(undefined)
});

vi.mock('$lib/server/db', () => ({
    db: {
        query: {
            activities: {
                findFirst: (...args: unknown[]) => mockFindFirstActivities(...args),
                findMany: (...args: unknown[]) => mockFindManyActivities(...args)
            },
            users: { findMany: (...args: unknown[]) => mockFindManyUsers(...args) },
            remoteActors: { findMany: (...args: unknown[]) => mockFindManyRemoteActors(...args) }
        },
        insert: (...args: unknown[]) => mockInsert(...args)
    }
}));

// ── Mock context fetcher ────────────────────────────────────────
vi.mock('$lib/server/contextFetcher', () => ({
    fetchContextPost: vi.fn().mockResolvedValue(null)
}));

vi.mock('$lib/server/redis/instance', () => ({
    getActorCache: vi.fn().mockReturnValue(null),
    getActorCacheTtlSeconds: vi.fn().mockReturnValue(86400)
}));

// ── Import handler AFTER mocks ──────────────────────────────────
import { GET } from '../../routes/api/statuses/[id]/context/+server';

const DOMAIN = 'polyverse-pp.vercel.app';
const POST_ID = `https://${DOMAIN}/users/alice/statuses/post-1`;
const LOCAL_USER = { userId: 'user-uuid-123', username: 'alice', did: 'did:web:polyverse-pp.vercel.app:users:alice' };

function createMockEvent(postId: string) {
    const url = `https://${DOMAIN}/api/statuses/${encodeURIComponent(postId)}/context`;
    return {
        params: { id: postId },
        locals: { user: LOCAL_USER },
        url: new URL(url),
        request: new Request(url),
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

describe('Epic 4.1 Backend Tasks: Thread Context', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockFindFirstActivities.mockResolvedValue(undefined);
        mockFindManyActivities.mockResolvedValue([]);
        mockFindManyUsers.mockResolvedValue([]);
        mockFindManyRemoteActors.mockResolvedValue([]);
    });

    // ── Task 4.1.4: GET /api/statuses/:id/context ──────────────
    describe('Task 4.1.4: GET context endpoint', () => {
        it('should return 404 if post not found', async () => {
            mockFindFirstActivities.mockResolvedValue(undefined);

            const event = createMockEvent('nonexistent-post-id');
            try {
                await GET(event);
                expect.unreachable('Should have thrown');
            } catch (err: any) {
                expect(err.status).toBe(404);
            }
        });

        it('should return empty ancestors and descendants for root post', async () => {
            const now = new Date();
            mockFindFirstActivities.mockResolvedValueOnce({
                id: 'activity-1',
                actorId: 'alice-uuid',
                remoteActorId: null,
                activity: {
                    type: 'Create',
                    object: {
                        id: POST_ID,
                        type: 'Note',
                        content: '<p>Hello world</p>',
                        inReplyTo: null
                    }
                },
                createdAt: now
            });

            // No child replies
            mockFindManyActivities.mockResolvedValue([]);

            const event = createMockEvent(POST_ID);
            const response = await GET(event);

            expect(response.status).toBe(200);
            const body = await response.json();
            expect(body.ancestors).toEqual([]);
            expect(body.descendants).toEqual([]);
        });

        it('should return descendants for a post with replies', async () => {
            const now = new Date();
            const REPLY_ID = `https://${DOMAIN}/users/bob/statuses/reply-1`;

            // Focus post
            mockFindFirstActivities.mockResolvedValueOnce({
                id: 'activity-1',
                actorId: 'alice-uuid',
                remoteActorId: null,
                activity: {
                    type: 'Create',
                    object: {
                        id: POST_ID,
                        type: 'Note',
                        content: '<p>Hello world</p>',
                        inReplyTo: null
                    }
                },
                createdAt: now
            });

            // Replies to POST_ID
            mockFindManyActivities
                .mockResolvedValueOnce([
                    {
                        id: 'activity-2',
                        actorId: 'bob-uuid',
                        remoteActorId: null,
                        activity: {
                            type: 'Create',
                            object: {
                                id: REPLY_ID,
                                type: 'Note',
                                content: '<p>Great post!</p>',
                                inReplyTo: POST_ID
                            }
                        },
                        createdAt: now
                    }
                ])
                .mockResolvedValue([]); // No further replies

            mockFindManyUsers.mockResolvedValue([
                { id: 'bob-uuid', username: 'bob', displayName: 'Bob', avatarUrl: null }
            ]);

            const event = createMockEvent(POST_ID);
            const response = await GET(event);

            expect(response.status).toBe(200);
            const body = await response.json();
            expect(body.ancestors).toEqual([]);
            expect(body.descendants).toHaveLength(1);
            expect(body.descendants[0].id).toBe(REPLY_ID);
            expect(body.descendants[0].content).toBe('<p>Great post!</p>');
        });

        it('should return ancestors for a reply post', async () => {
            const now = new Date();
            const PARENT_ID = `https://${DOMAIN}/users/alice/statuses/parent-1`;
            const REPLY_ID = `https://${DOMAIN}/users/bob/statuses/reply-1`;

            // Focus post (the reply)
            mockFindFirstActivities
                .mockResolvedValueOnce({
                    id: 'activity-reply',
                    actorId: 'bob-uuid',
                    remoteActorId: null,
                    activity: {
                        type: 'Create',
                        object: {
                            id: REPLY_ID,
                            type: 'Note',
                            content: '<p>This is a reply</p>',
                            inReplyTo: PARENT_ID
                        }
                    },
                    createdAt: now
                })
                // Parent post lookup
                .mockResolvedValueOnce({
                    id: 'activity-parent',
                    actorId: 'alice-uuid',
                    remoteActorId: null,
                    activity: {
                        type: 'Create',
                        object: {
                            id: PARENT_ID,
                            type: 'Note',
                            content: '<p>Original post</p>',
                            inReplyTo: null
                        }
                    },
                    createdAt: now
                });

            // No descendants for the reply
            mockFindManyActivities.mockResolvedValue([]);

            mockFindManyUsers.mockResolvedValue([
                { id: 'alice-uuid', username: 'alice', displayName: 'Alice', avatarUrl: null }
            ]);

            const event = createMockEvent(REPLY_ID);
            const response = await GET(event);

            expect(response.status).toBe(200);
            const body = await response.json();
            expect(body.ancestors).toHaveLength(1);
            expect(body.ancestors[0].id).toBe(PARENT_ID);
            expect(body.ancestors[0].content).toBe('<p>Original post</p>');
            expect(body.descendants).toEqual([]);
        });
    });
});
