/**
 * @file index.ts
 * @description Public barrel export for the Redis implementation layer (Epic 3.2).
 * Import everything consumers need from this single entry point.
 *
 * @example
 * ```ts
 * import { RedisClientFactory, RedisCacheService, loadRedisConfig, buildKey } from '$lib/server/redis';
 * ```
 */

// Types & contracts
export type {
    RedisConfig,
    RetryStrategyFn,
    CacheService,
    CacheEntry,
    KeyBuilderOptions,
} from './types.js';
export { SerializationError, DeserializationError } from './types.js';

// Configuration loader
export { loadRedisConfig } from './config.js';

// Client factory
export { RedisClientFactory } from './client.js';
export type { RedisLogger } from './client.js';

// Key builder
export { buildKey } from './keyBuilder.js';

// Serializer
export { serialize, deserialize } from './serializer.js';
export type { TypeGuard } from './serializer.js';

// Cache service
export { RedisCacheService } from './cacheService.js';

// Application singleton
export { getActorCache, disconnectRedis, isRedisConfigured, getActorCacheTtlSeconds } from './instance.js';
