// src/tests/Epic3_BE/delivery-worker.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock environment ────────────────────────────────────────────
vi.mock('$env/dynamic/private', () => ({
    env: {
        DOMAIN: 'polyverse-pp.vercel.app',
        ENCRYPTION_KEY: 'd7ff02dcd435996a6a93a4d2653ffbcdbfaa6e5668c9bb32479749e0cfa48a70',
        JWT_SECRET: 'a8f3b2c1d4e5f6789012345678901234567890abcdef1234567890abcdef1234'
    }
}));

// ── Mock Redis factory ──────────────────────────────────────────
const mockLpush = vi.fn().mockResolvedValue(1);
const mockBrpop = vi.fn().mockResolvedValue(null);
const mockRedisClient = {
    lpush: mockLpush,
    brpop: mockBrpop
};

vi.mock('$lib/server/redis/instance', () => ({
    getFactory: vi.fn().mockReturnValue({
        getClient: () => mockRedisClient
    }),
    getActorCache: vi.fn().mockReturnValue(null),
    getActorCacheTtlSeconds: vi.fn().mockReturnValue(86400),
    isRedisConfigured: vi.fn().mockReturnValue(true)
}));

// ── Mock encryption ─────────────────────────────────────────────
vi.mock('$lib/server/encryption', () => ({
    decrypt: vi.fn().mockReturnValue('mocked-private-key-pem')
}));

// ── Mock DB ─────────────────────────────────────────────────────
vi.mock('$lib/server/db', () => ({
    db: {
        query: {
            userSecrets: {
                findFirst: vi.fn().mockResolvedValue({
                    userId: 'user-uuid-123',
                    encryptedPrivateKey: 'encrypted-key'
                })
            }
        }
    }
}));

// ── Import AFTER mocks ──────────────────────────────────────────
import { enqueueDelivery } from '../../lib/server/redis/deliveryWorker';
import type { DeliveryJob } from '../../lib/server/redis/deliveryWorker';

const DOMAIN = 'polyverse-pp.vercel.app';

describe('Epic 3.2 Backend Tasks: Delivery Worker', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ── Task 3.2.2: enqueueDelivery pushes to Redis ─────────────
    describe('Task 3.2.2: Push Follow activity to Redis', () => {
        it('should push a delivery job to the Redis queue', async () => {
            const job: DeliveryJob = {
                activity: {
                    '@context': 'https://www.w3.org/ns/activitystreams',
                    id: `https://${DOMAIN}/users/alice/follows/abc-123`,
                    type: 'Follow',
                    actor: `https://${DOMAIN}/users/alice`,
                    object: 'https://mastodon.social/users/gargron'
                },
                inbox: 'https://mastodon.social/inbox',
                actorUsername: 'alice',
                actorUserId: 'user-uuid-123'
            };

            await enqueueDelivery(job);

            expect(mockLpush).toHaveBeenCalledTimes(1);
            expect(mockLpush).toHaveBeenCalledWith(
                'polyverse:delivery_queue',
                expect.any(String)
            );

            // Verify the serialized job
            const serialized = mockLpush.mock.calls[0][1];
            const parsed = JSON.parse(serialized);
            expect(parsed.activity.type).toBe('Follow');
            expect(parsed.inbox).toBe('https://mastodon.social/inbox');
            expect(parsed.actorUsername).toBe('alice');
        });

        it('should include retry count in the job', async () => {
            const job: DeliveryJob = {
                activity: { type: 'Follow', actor: 'test', object: 'test' },
                inbox: 'https://example.com/inbox',
                actorUsername: 'alice',
                actorUserId: 'user-uuid-123',
                retryCount: 2
            };

            await enqueueDelivery(job);

            const serialized = mockLpush.mock.calls[0][1];
            const parsed = JSON.parse(serialized);
            expect(parsed.retryCount).toBe(2);
        });
    });
});
