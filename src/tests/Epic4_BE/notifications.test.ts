// src/tests/Epic4_BE/notifications.test.ts
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
const mockFindManyNotifications = vi.fn();
const mockFindManyUsers = vi.fn();
const mockUpdate = vi.fn().mockReturnValue({
    set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined)
    })
});

vi.mock('$lib/server/db', () => ({
    db: {
        query: {
            notifications: { findMany: (...args: unknown[]) => mockFindManyNotifications(...args) },
            users: { findMany: (...args: unknown[]) => mockFindManyUsers(...args) }
        },
        update: (...args: unknown[]) => mockUpdate(...args)
    }
}));

vi.mock('$lib/server/redis/instance', () => ({
    getActorCache: vi.fn().mockReturnValue(null),
    getActorCacheTtlSeconds: vi.fn().mockReturnValue(86400)
}));

// ── Import handler AFTER mocks ──────────────────────────────────
import { GET, POST } from '../../routes/api/notifications/+server';

const DOMAIN = 'polyverse-pp.vercel.app';
const LOCAL_USER = { userId: 'user-uuid-123', username: 'alice', did: 'did:web:polyverse-pp.vercel.app:users:alice' };

function createMockEvent(method: string, body?: Record<string, unknown>, query = '') {
    const url = `https://${DOMAIN}/api/notifications${query}`;
    const request = new Request(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        ...(body ? { body: JSON.stringify(body) } : {})
    });
    return {
        request,
        locals: { user: LOCAL_USER },
        url: new URL(url),
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

describe('Epic 4.4 Backend Tasks: Notifications', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockFindManyNotifications.mockResolvedValue([]);
        mockFindManyUsers.mockResolvedValue([]);
    });

    // ── GET /api/notifications ──────────────────────────────────
    describe('Task 4.4.2: GET notifications', () => {
        it('should return 401 if not authenticated', async () => {
            const event = createMockEvent('GET');
            event.locals.user = null;
            try {
                await GET(event);
                expect.unreachable('Should have thrown');
            } catch (err: any) {
                expect(err.status).toBe(401);
            }
        });

        it('should return empty notifications list', async () => {
            mockFindManyNotifications.mockResolvedValue([]);

            const event = createMockEvent('GET');
            const response = await GET(event);

            expect(response.status).toBe(200);
            const body = await response.json();
            expect(body.notifications).toEqual([]);
            expect(body.unreadCount).toBe(0);
        });

        it('should return notifications with actor info', async () => {
            const now = new Date();
            mockFindManyNotifications
                .mockResolvedValueOnce([
                    {
                        id: 'notif-1',
                        recipientId: LOCAL_USER.userId,
                        actorId: 'bob-uuid',
                        remoteActorUri: null,
                        type: 'like',
                        objectId: 'post-123',
                        read: false,
                        createdAt: now
                    }
                ])
                .mockResolvedValueOnce([ // unread count query
                    { id: 'notif-1' }
                ]);

            mockFindManyUsers.mockResolvedValue([
                { id: 'bob-uuid', username: 'bob', displayName: 'Bob', avatarUrl: null }
            ]);

            const event = createMockEvent('GET');
            const response = await GET(event);

            expect(response.status).toBe(200);
            const body = await response.json();
            expect(body.notifications).toHaveLength(1);
            expect(body.notifications[0].type).toBe('like');
            expect(body.notifications[0].actor.username).toBe('bob');
            expect(body.unreadCount).toBe(1);
        });
    });

    // ── Task 4.4.4: POST /api/notifications (mark as read) ─────
    describe('Task 4.4.4: Mark as read', () => {
        it('should return 401 if not authenticated', async () => {
            const event = createMockEvent('POST', { all: true });
            event.locals.user = null;
            try {
                await POST(event);
                expect.unreachable('Should have thrown');
            } catch (err: any) {
                expect(err.status).toBe(401);
            }
        });

        it('should mark all notifications as read', async () => {
            const event = createMockEvent('POST', { all: true });
            const response = await POST(event);

            expect(response.status).toBe(200);
            const body = await response.json();
            expect(body.success).toBe(true);
            expect(mockUpdate).toHaveBeenCalled();
        });

        it('should mark specific notifications as read by IDs', async () => {
            const event = createMockEvent('POST', { ids: ['notif-1', 'notif-2'] });
            const response = await POST(event);

            expect(response.status).toBe(200);
            const body = await response.json();
            expect(body.success).toBe(true);
            expect(mockUpdate).toHaveBeenCalled();
        });

        it('should return 400 if neither ids nor all is provided', async () => {
            const event = createMockEvent('POST', {});
            try {
                await POST(event);
                expect.unreachable('Should have thrown');
            } catch (err: any) {
                expect(err.status).toBe(400);
            }
        });
    });
});
