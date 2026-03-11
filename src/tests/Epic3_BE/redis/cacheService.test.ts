// src/tests/Epic3_BE/redis/cacheService.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RedisCacheService } from '$lib/server/redis/cacheService';
import { serialize } from '$lib/server/redis/serializer';
import type { CacheEntry } from '$lib/server/redis/types';

// Minimal ioredis Redis mock — untyped vi.fn() avoids strict-mode arg conflicts.
const mockGet = vi.fn();
const mockSet = vi.fn();
const mockDel = vi.fn();
const mockExists = vi.fn();
const mockScan = vi.fn();

const mockRedisClient = {
    get: mockGet,
    set: mockSet,
    del: mockDel,
    exists: mockExists,
    scan: mockScan,
} as unknown as import('ioredis').Redis;

interface Actor {
    id: string;
    username: string;
}

const isActor = (v: unknown): v is Actor =>
    typeof v === 'object' &&
    v !== null &&
    typeof (v as Record<string, unknown>)['id'] === 'string' &&
    typeof (v as Record<string, unknown>)['username'] === 'string';

function makeRaw(value: Actor, ttlSeconds?: number): string {
    const entry: CacheEntry<Actor> = {
        value,
        storedAt: new Date().toISOString(),
        ...(ttlSeconds !== undefined ? { ttlSeconds } : {}),
    };
    return serialize(entry);
}

const PREFIX = 'pv:actor';
const TEST_KEY = 'alice@example.com';
const TEST_ACTOR: Actor = { id: 'u-1', username: 'alice' };

describe('RedisCacheService', () => {
    let service: RedisCacheService<Actor>;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new RedisCacheService(mockRedisClient, PREFIX, isActor);
    });

    describe('constructor', () => {
        it('throws when keyPrefix is empty', () => {
            expect(() => new RedisCacheService(mockRedisClient, '', isActor)).toThrow(
                '[RedisCacheService] keyPrefix must not be empty',
            );
        });

        it('throws when keyPrefix is only whitespace', () => {
            expect(() => new RedisCacheService(mockRedisClient, '   ', isActor)).toThrow(
                '[RedisCacheService] keyPrefix must not be empty',
            );
        });
    });

    describe('get()', () => {
        it('returns the deserialised value on a cache hit', async () => {
            mockGet.mockResolvedValueOnce(makeRaw(TEST_ACTOR));
            const result = await service.get(TEST_KEY);
            expect(result).toEqual(TEST_ACTOR);
        });

        it('calls Redis GET with the fully-prefixed key', async () => {
            mockGet.mockResolvedValueOnce(makeRaw(TEST_ACTOR));
            await service.get(TEST_KEY);
            expect(mockGet).toHaveBeenCalledWith(`${PREFIX}:${TEST_KEY}`);
        });

        it('returns null on a cache miss (Redis returns null)', async () => {
            mockGet.mockResolvedValueOnce(null);
            expect(await service.get(TEST_KEY)).toBeNull();
        });

        it('returns null when the stored JSON is malformed', async () => {
            mockGet.mockResolvedValueOnce('not-valid-json');
            expect(await service.get(TEST_KEY)).toBeNull();
        });

        it('returns null when the inner value does not satisfy the type guard', async () => {
            const badEntry: CacheEntry<unknown> = {
                value: { wrong: 'shape' },
                storedAt: new Date().toISOString(),
            };
            mockGet.mockResolvedValueOnce(serialize(badEntry));
            expect(await service.get(TEST_KEY)).toBeNull();
        });
    });

    describe('set()', () => {
        it('calls Redis SET with the prefixed key and serialised value', async () => {
            mockSet.mockResolvedValueOnce('OK');
            await service.set(TEST_KEY, TEST_ACTOR);

            expect(mockSet).toHaveBeenCalledOnce();
            const [calledKey, calledValue] = mockSet.mock.calls[0] as [string, string];
            expect(calledKey).toBe(`${PREFIX}:${TEST_KEY}`);
            const parsed = JSON.parse(calledValue) as CacheEntry<Actor>;
            expect(parsed.value).toEqual(TEST_ACTOR);
        });

        it('includes EX and ttlSeconds when TTL is provided', async () => {
            mockSet.mockResolvedValueOnce('OK');
            await service.set(TEST_KEY, TEST_ACTOR, 3600);
            const args = mockSet.mock.calls[0] as unknown[];
            expect(args).toContain('EX');
            expect(args).toContain(3600);
        });

        it('omits EX when TTL is not provided', async () => {
            mockSet.mockResolvedValueOnce('OK');
            await service.set(TEST_KEY, TEST_ACTOR);
            const args = mockSet.mock.calls[0] as unknown[];
            expect(args).not.toContain('EX');
        });

        it('stores the value with a storedAt ISO timestamp in the envelope', async () => {
            mockSet.mockResolvedValueOnce('OK');
            await service.set(TEST_KEY, TEST_ACTOR);
            const [, raw] = mockSet.mock.calls[0] as [string, string];
            const parsed = JSON.parse(raw) as CacheEntry<Actor>;
            expect(typeof parsed.storedAt).toBe('string');
            expect(() => new Date(parsed.storedAt)).not.toThrow();
        });
    });

    describe('del()', () => {
        it('calls Redis DEL with the fully-prefixed key', async () => {
            mockDel.mockResolvedValueOnce(1);
            await service.del(TEST_KEY);
            expect(mockDel).toHaveBeenCalledWith(`${PREFIX}:${TEST_KEY}`);
        });
    });

    describe('exists()', () => {
        it('returns true when Redis EXISTS returns a count > 0', async () => {
            mockExists.mockResolvedValueOnce(1);
            expect(await service.exists(TEST_KEY)).toBe(true);
        });

        it('returns false when Redis EXISTS returns 0', async () => {
            mockExists.mockResolvedValueOnce(0);
            expect(await service.exists(TEST_KEY)).toBe(false);
        });

        it('calls Redis EXISTS with the fully-prefixed key', async () => {
            mockExists.mockResolvedValueOnce(0);
            await service.exists(TEST_KEY);
            expect(mockExists).toHaveBeenCalledWith(`${PREFIX}:${TEST_KEY}`);
        });
    });

    describe('flush()', () => {
        it('scans with the prefixed pattern and deletes matched keys', async () => {
            const matchedKeys = [`${PREFIX}:key1`, `${PREFIX}:key2`];
            mockScan.mockResolvedValueOnce(['0', matchedKeys]);
            mockDel.mockResolvedValueOnce(2);

            const count = await service.flush('*');

            expect(mockScan).toHaveBeenCalledWith('0', 'MATCH', `${PREFIX}:*`, 'COUNT', 100);
            expect(mockDel).toHaveBeenCalledWith(...matchedKeys);
            expect(count).toBe(2);
        });

        it('iterates multiple SCAN pages until cursor returns "0"', async () => {
            mockScan
                .mockResolvedValueOnce(['42', [`${PREFIX}:k1`]])
                .mockResolvedValueOnce(['0', [`${PREFIX}:k2`, `${PREFIX}:k3`]]);
            mockDel.mockResolvedValue(1);

            expect(await service.flush('*')).toBe(3);
            expect(mockScan).toHaveBeenCalledTimes(2);
        });

        it('returns 0 and skips DEL when no keys match', async () => {
            mockScan.mockResolvedValueOnce(['0', []]);
            expect(await service.flush('nothing:*')).toBe(0);
            expect(mockDel).not.toHaveBeenCalled();
        });

        it('scopes the pattern to the service keyPrefix', async () => {
            mockScan.mockResolvedValueOnce(['0', []]);
            await service.flush('user:*');
            const [, , pattern] = mockScan.mock.calls[0] as unknown[];
            expect(pattern).toBe(`${PREFIX}:user:*`);
        });
    });
});
