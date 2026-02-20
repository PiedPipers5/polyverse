/**
 * @file instance.ts
 * @description Application-level Redis singleton for Polyverse.
 * Initialises the client factory and cache service instances from env vars.
 *
 * Import this from any server-side module:
 * ```ts
 * import { getActorCache, disconnectRedis } from '$lib/server/redis/instance';
 * ```
 */

import { env } from '$env/dynamic/private';
import { loadRedisConfig } from './config.js';
import { RedisClientFactory, type RedisLogger } from './client.js';
import { RedisCacheService } from './cacheService.js';

// ---------------------------------------------------------------------------
// Logger — forwards to Sentry / structured logging (no console.log in prod)
// ---------------------------------------------------------------------------

const redisLogger: RedisLogger = {
    error: (message: string, meta?: Record<string, unknown>) => {
        // In production, this should forward to Sentry or your logging backend.
        // Using console.error here as a fallback for dev since Sentry is
        // already wired in hooks.server.ts for unhandled errors.
        if (typeof process !== 'undefined' && process.env['NODE_ENV'] !== 'production') {
            console.error(message, meta);
        }
    },
    info: () => undefined,
    warn: (message: string, meta?: Record<string, unknown>) => {
        if (typeof process !== 'undefined' && process.env['NODE_ENV'] !== 'production') {
            console.warn(message, meta);
        }
    },
};

// ---------------------------------------------------------------------------
// Lazy singleton — initialised on first access, not at module import time
// ---------------------------------------------------------------------------

let factory: RedisClientFactory | null = null;
let actorCache: RedisCacheService<Record<string, unknown>> | null = null;

/**
 * Check whether a Redis URL is configured. When it's missing, the Redis
 * layer is disabled gracefully — the app falls back to DB-only caching.
 *
 * @returns `true` when `REDIS_URL` (or `REDIS_HOST`) is set in the environment.
 */
export function isRedisConfigured(): boolean {
    return !!(env.REDIS_URL ?? env.REDIS_HOST);
}

/**
 * Return the shared {@link RedisClientFactory}. Creates it on first call.
 *
 * @returns The singleton `RedisClientFactory`.
 * @throws {Error} When Redis is not configured (call {@link isRedisConfigured} first).
 */
function getFactory(): RedisClientFactory {
    if (factory === null) {
        const config = loadRedisConfig(env as Record<string, string | undefined>);
        factory = new RedisClientFactory(config, redisLogger);
    }
    return factory;
}

// ---------------------------------------------------------------------------
// Remote Actor Cache
// ---------------------------------------------------------------------------

/** Cache TTL for remote actors — 24 hours in seconds. */
const ACTOR_CACHE_TTL_SECONDS = 24 * 60 * 60;

/**
 * Type guard for an ActivityPub Actor JSON-LD object.
 * Validates the minimum fields required for the app.
 *
 * @param v - The value to check.
 * @returns `true` when `v` is a `Record<string, unknown>` with at least `id` and `type`.
 */
const isActorRecord = (v: unknown): v is Record<string, unknown> =>
    typeof v === 'object' &&
    v !== null &&
    typeof (v as Record<string, unknown>)['id'] === 'string' &&
    typeof (v as Record<string, unknown>)['type'] === 'string';

/**
 * Return the shared remote-actor cache service. Creates it on first call.
 * Returns `null` when Redis is not configured — callers must handle the fallback.
 *
 * Key scheme: `polyverse:actor:<handle>` with a 24h TTL.
 *
 * @returns The actor `RedisCacheService`, or `null` if Redis is not configured.
 */
export function getActorCache(): RedisCacheService<Record<string, unknown>> | null {
    if (!isRedisConfigured()) return null;

    if (actorCache === null) {
        actorCache = new RedisCacheService(
            getFactory().getClient(),
            'polyverse:actor',
            isActorRecord,
        );
    }
    return actorCache;
}

/**
 * Return the configured actor cache TTL in seconds.
 *
 * @returns TTL in seconds (24 hours).
 */
export function getActorCacheTtlSeconds(): number {
    return ACTOR_CACHE_TTL_SECONDS;
}

/**
 * Gracefully disconnect the Redis client. Call this on app shutdown.
 * Safe to call even if Redis was never initialised.
 */
export async function disconnectRedis(): Promise<void> {
    if (factory !== null) {
        await factory.disconnect();
        factory = null;
        actorCache = null;
    }
}
