/**
 * @file cacheService.ts
 * @description Generic, typed Redis cache service. Composes the client, key
 * builder, and serializer to provide a clean `CacheService<T>` implementation.
 */

import type { Redis } from 'ioredis';
import type { CacheEntry, CacheService } from './types.js';
import type { TypeGuard } from './serializer.js';
import { DeserializationError } from './types.js';
import { serialize, deserialize } from './serializer.js';

/** Number of keys to scan per SCAN iteration. */
const SCAN_COUNT = 100;

/**
 * Redis-backed implementation of {@link CacheService}.
 *
 * Values are stored as JSON-serialised {@link CacheEntry} envelopes, giving
 * every cached item a consistent structure with metadata (`storedAt`, optional
 * `ttlSeconds`).
 *
 * **Key scheme:** `<keyPrefix>:<key>` — the prefix is set per-instance so
 * multiple services can share one Redis connection without key collisions.
 *
 * @typeParam T - The domain type stored and retrieved from the cache.
 *
 * @example
 * ```ts
 * const actorService = new RedisCacheService<Actor>(
 *   redisFactory.getClient(),
 *   'polyverse:actor',
 *   isActor,
 * );
 *
 * await actorService.set('gargron@mastodon.social', actorData, 3600);
 * const actor = await actorService.get('gargron@mastodon.social');
 * ```
 */
export class RedisCacheService<T> implements CacheService<T> {
    private readonly client: Redis;
    private readonly keyPrefix: string;
    private readonly guard: TypeGuard<T>;
    /** Cached composite guard for `CacheEntry<T>` to avoid recreating it on every `get`. */
    private readonly entryGuard: TypeGuard<CacheEntry<T>>;

    /**
     * @param client - An ioredis `Redis` instance (typically from `RedisClientFactory.getClient()`).
     * @param keyPrefix - Namespace prefix prepended to all keys (e.g. `"polyverse:actor"`).
     * @param guard - Type guard applied to every deserialised value. Returns `null` on guard failure.
     */
    constructor(client: Redis, keyPrefix: string, guard: TypeGuard<T>) {
        if (keyPrefix.trim().length === 0) {
            throw new Error('[RedisCacheService] keyPrefix must not be empty');
        }
        this.client = client;
        this.keyPrefix = keyPrefix;
        this.guard = guard;
        // Build the composite CacheEntry guard once at construction time.
        this.entryGuard = makeCacheEntryGuard(guard);
    }

    // Public API

    /**
     * Retrieve a value from the cache.
     * Returns `null` on a cache miss, invalid JSON, or type guard failure —
     * never throws for expected cache scenarios.
     *
     * @param key - Sub-key (without prefix).
     * @returns The stored value or `null`.
     */
    async get(key: string): Promise<T | null> {
        const raw = await this.client.get(this.fullKey(key));
        if (raw === null) return null;

        try {
            const entry = deserialize<CacheEntry<T>>(raw, this.entryGuard);
            return entry.value;
        } catch (err) {
            if (err instanceof DeserializationError) return null;
            throw err;
        }
    }

    /**
     * Store a value in the cache.
     *
     * @param key - Sub-key (without prefix).
     * @param value - Domain value to cache.
     * @param ttlSeconds - Optional TTL. If omitted the key persists indefinitely.
     */
    async set(key: string, value: T, ttlSeconds?: number): Promise<void> {
        const entry: CacheEntry<T> = {
            value,
            storedAt: new Date().toISOString(),
            ...(ttlSeconds !== undefined ? { ttlSeconds } : {}),
        };

        const serialised = serialize(entry);

        if (ttlSeconds !== undefined) {
            await this.client.set(this.fullKey(key), serialised, 'EX', ttlSeconds);
        } else {
            await this.client.set(this.fullKey(key), serialised);
        }
    }

    /**
     * Delete a single key from the cache.
     *
     * @param key - Sub-key (without prefix).
     */
    async del(key: string): Promise<void> {
        await this.client.del(this.fullKey(key));
    }

    /**
     * Check whether a key exists in the cache.
     *
     * @param key - Sub-key (without prefix).
     * @returns `true` if the key exists, `false` otherwise.
     */
    async exists(key: string): Promise<boolean> {
        const count = await this.client.exists(this.fullKey(key));
        return count > 0;
    }

    /**
     * Delete all keys matching a glob pattern within this service's namespace.
     * Uses a SCAN loop to avoid blocking the Redis server on large keyspaces.
     *
     * @param pattern - Glob pattern relative to this service's prefix
     *   (e.g. `"*"` deletes everything, `"user:*"` scopes to user keys).
     * @returns The total number of keys deleted.
     */
    async flush(pattern: string): Promise<number> {
        const fullPattern = `${this.keyPrefix}:${pattern}`;
        let cursor = '0';
        let deletedCount = 0;

        do {
            const [nextCursor, keys] = await this.client.scan(
                cursor,
                'MATCH',
                fullPattern,
                'COUNT',
                SCAN_COUNT,
            );
            cursor = nextCursor;

            if (keys.length > 0) {
                await this.client.del(...keys);
                deletedCount += keys.length;
            }
        } while (cursor !== '0');

        return deletedCount;
    }

    // Private helpers

    /**
     * Prepend the service's key prefix to a caller-supplied sub-key.
     *
     * @param key - Sub-key provided by the caller.
     * @returns The fully-qualified Redis key.
     */
    private fullKey(key: string): string {
        return `${this.keyPrefix}:${key}`;
    }
}

// Internal CacheEntry type guard factory

/**
 * Returns a type guard that validates the parsed JSON structure is a
 * {@link CacheEntry} and that the inner `.value` satisfies the given domain guard.
 *
 * @typeParam T - The expected domain type of `CacheEntry.value`.
 * @param domainGuard - Type guard to apply to the inner `value` field.
 * @returns A composite `TypeGuard<CacheEntry<T>>`.
 */
function makeCacheEntryGuard<T>(domainGuard: TypeGuard<T>): TypeGuard<CacheEntry<T>> {
    return (v: unknown): v is CacheEntry<T> => {
        if (
            typeof v !== 'object' ||
            v === null ||
            !('value' in v) ||
            !('storedAt' in v) ||
            typeof (v as Record<string, unknown>)['storedAt'] !== 'string'
        ) {
            return false;
        }
        return domainGuard((v as Record<string, unknown>)['value']);
    };
}
