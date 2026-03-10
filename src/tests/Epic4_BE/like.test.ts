// src/tests/Epic4_BE/like.test.ts
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
const mockFindFirstLikes = vi.fn();
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
            likes: { findFirst: (...args: unknown[]) => mockFindFirstLikes(...args) },
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
import { POST, DELETE } from '../../routes/api/like/+server';

// ── Test Data ───────────────────────────────────────────────────
const DOMAIN = 'polyverse-pp.vercel.app';
const LOCAL_USER = { userId: 'user-uuid-123', username: 'alice', did: 'did:web:polyverse-pp.vercel.app:users:alice' };
const POST_URI = `https://${DOMAIN}/users/bob/statuses/post-123`;

function createMockEvent(body: Record<string, unknown>, user = LOCAL_USER) {
    const request = new Request(`https://${DOMAIN}/api/like`, {
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

// ═══════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════
describe('Epic 4.2 Backend Tasks: Like/Unlike', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockFindFirstLikes.mockResolvedValue(undefined);
        mockFindFirstActivities.mockResolvedValue(undefined);
    });

    // ── Task 4.2.2: POST /api/like ─────────────────────────────
    describe('Task 4.2.2: Generate Like activity', () => {
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

        it('should return 409 if already liked', async () => {
            mockFindFirstLikes.mockResolvedValue({ id: 'like-1', postId: POST_URI, actorId: LOCAL_USER.userId });

            const event = createMockEvent({ postId: POST_URI });
            try {
                await POST(event);
                expect.unreachable('Should have thrown');
            } catch (err: any) {
                expect(err.status).toBe(409);
            }
        });

        it('should create a like and increment likes_count', async () => {
            mockFindFirstLikes.mockResolvedValue(undefined);

            const event = createMockEvent({ postId: POST_URI });
            const response = await POST(event);

            expect(response.status).toBe(201);
            const body = await response.json();
            expect(body.success).toBe(true);
            expect(body.postId).toBe(POST_URI);
            expect(body.likeId).toBeDefined();

            // Should have inserted a like record
            expect(mockInsert).toHaveBeenCalled();
            // Should have updated likes_count
            expect(mockUpdate).toHaveBeenCalled();
        });
    });

    // ── Task 4.2.4: DELETE /api/like (Undo Like) ────────────────
    describe('Task 4.2.4: Undo Like', () => {
        it('should return 404 if not liked', async () => {
            mockFindFirstLikes.mockResolvedValue(undefined);

            const event = createMockEvent({ postId: POST_URI });
            try {
                await DELETE(event);
                expect.unreachable('Should have thrown');
            } catch (err: any) {
                expect(err.status).toBe(404);
            }
        });

        it('should remove like and decrement likes_count', async () => {
            mockFindFirstLikes.mockResolvedValue({
                id: 'like-1',
                postId: POST_URI,
                actorId: LOCAL_USER.userId,
                likeActivityId: `https://${DOMAIN}/users/alice/likes/abc-123`
            });

            const event = createMockEvent({ postId: POST_URI });
            const response = await DELETE(event);

            expect(response.status).toBe(200);
            const body = await response.json();
            expect(body.success).toBe(true);

            // Should have deleted the like
            expect(mockDelete).toHaveBeenCalled();
            // Should have decremented likes_count
            expect(mockUpdate).toHaveBeenCalled();
        });
    });
});
