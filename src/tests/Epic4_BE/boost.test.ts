// src/tests/Epic4_BE/boost.test.ts
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
const mockInsert = vi.fn().mockReturnValue({
    values: vi.fn().mockResolvedValue(undefined)
});
const mockUpdate = vi.fn().mockReturnValue({
    set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined)
    })
});
const mockDelete = vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue(undefined)
});

vi.mock('$lib/server/db', () => ({
    db: {
        query: {
            activities: {
                findFirst: (...args: unknown[]) => mockFindFirstActivities(...args),
                findMany: (...args: unknown[]) => mockFindManyActivities(...args)
            }
        },
        insert: (...args: unknown[]) => mockInsert(...args),
        update: (...args: unknown[]) => mockUpdate(...args),
        delete: (...args: unknown[]) => mockDelete(...args)
    }
}));

// ── Mock Redis ──────────────────────────────────────────────────
vi.mock('$lib/server/redis', () => ({
    enqueueDelivery: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('$lib/server/redis/instance', () => ({
    getActorCache: vi.fn().mockReturnValue(null),
    getActorCacheTtlSeconds: vi.fn().mockReturnValue(86400)
}));

// ── Import handler AFTER mocks ──────────────────────────────────
import { POST, DELETE } from '../../routes/api/boost/+server';

const DOMAIN = 'polyverse-pp.vercel.app';
const LOCAL_USER = { userId: 'user-uuid-123', username: 'alice', did: 'did:web:polyverse-pp.vercel.app:users:alice' };
const POST_URI = `https://${DOMAIN}/users/bob/statuses/post-123`;

function createMockEvent(body: Record<string, unknown>, user = LOCAL_USER) {
    const request = new Request(`https://${DOMAIN}/api/boost`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    return {
        request,
        locals: { user },
        url: new URL(request.url),
        params: {},
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

describe('Epic 4.3 Backend Tasks: Boost/Unboost', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockFindFirstActivities.mockResolvedValue(undefined);
    });

    // ── Task 4.3.1: POST /api/boost ────────────────────────────
    describe('Task 4.3.1: Generate Announce activity', () => {
        it('should return 401 if user is not authenticated', async () => {
            const event = createMockEvent({ postId: POST_URI }, null as any);
            event.locals.user = null;
            try {
                await POST(event);
                expect.unreachable('Should have thrown');
            } catch (err: any) {
                expect(err.status).toBe(401);
            }
        });

        it('should return 400 if postId is missing', async () => {
            const event = createMockEvent({});
            try {
                await POST(event);
                expect.unreachable('Should have thrown');
            } catch (err: any) {
                expect(err.status).toBe(400);
            }
        });

        it('should return 409 if already boosted', async () => {
            mockFindFirstActivities.mockResolvedValue({
                id: 'announce-1',
                type: 'Announce',
                actorId: LOCAL_USER.userId,
                activity: { type: 'Announce', object: POST_URI }
            });

            const event = createMockEvent({ postId: POST_URI });
            try {
                await POST(event);
                expect.unreachable('Should have thrown');
            } catch (err: any) {
                expect(err.status).toBe(409);
            }
        });

        it('should create an Announce activity and increment boosts_count', async () => {
            // First call (existence check): no existing boost
            // Second call (post lookup for delivery): returns the post
            mockFindFirstActivities
                .mockResolvedValueOnce(undefined) // No existing boost
                .mockResolvedValueOnce({
                    id: 'post-record-1',
                    actorId: 'bob-uuid',
                    activity: { object: { id: POST_URI, attributedTo: `https://${DOMAIN}/users/bob` } }
                });

            const event = createMockEvent({ postId: POST_URI });
            const response = await POST(event);

            expect(response.status).toBe(201);
            const body = await response.json();
            expect(body.success).toBe(true);
            expect(body.announceId).toBeDefined();

            expect(mockInsert).toHaveBeenCalled();
            expect(mockUpdate).toHaveBeenCalled();
        });
    });

    // ── Task 4.3.5: DELETE /api/boost (Undo Announce) ───────────
    describe('Task 4.3.5: Undo Announce', () => {
        it('should return 404 if not boosted', async () => {
            mockFindFirstActivities.mockResolvedValue(undefined);

            const event = createMockEvent({ postId: POST_URI });
            try {
                await DELETE(event);
                expect.unreachable('Should have thrown');
            } catch (err: any) {
                expect(err.status).toBe(404);
            }
        });

        it('should remove Announce and decrement boosts_count', async () => {
            mockFindFirstActivities
                .mockResolvedValueOnce({
                    id: 'announce-1',
                    type: 'Announce',
                    actorId: LOCAL_USER.userId,
                    activity: { id: `https://${DOMAIN}/users/alice/statuses/ann-1`, type: 'Announce', object: POST_URI }
                })
                .mockResolvedValueOnce({
                    id: 'post-record-1',
                    actorId: 'bob-uuid',
                    activity: { object: { id: POST_URI, attributedTo: `https://${DOMAIN}/users/bob` } }
                });

            const event = createMockEvent({ postId: POST_URI });
            const response = await DELETE(event);

            expect(response.status).toBe(200);
            const body = await response.json();
            expect(body.success).toBe(true);

            expect(mockDelete).toHaveBeenCalled();
            expect(mockUpdate).toHaveBeenCalled();
        });
    });
});
