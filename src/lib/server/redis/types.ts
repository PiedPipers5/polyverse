/**
 * @file types.ts
 * @description Shared TypeScript contracts for the Redis implementation layer (Epic 3.2).
 * All other modules in this directory import from here — never the other way around.
 */

// Redis Connection Configuration

/**
 * Retry strategy callback passed to ioredis.
 * Return a number (milliseconds to wait before retrying) or null/Error to stop retrying.
 *
 * @param times - Number of retry attempts made so far.
 * @returns Milliseconds to wait before the next attempt, or `null` to stop.
 */
export type RetryStrategyFn = (times: number) => number | null;

/**
 * Immutable configuration object used to construct a Redis client.
 */
export interface RedisConfig {
    /** Redis server hostname. @default "127.0.0.1" */
    readonly host: string;
    /** Redis server port. @default 6379 */
    readonly port: number;
    /** Optional authentication password. */
    readonly password?: string;
    /** Redis logical database index. @default 0 */
    readonly db: number;
    /** Whether to use TLS. @default false */
    readonly tls: boolean;
    /** Socket connection timeout in milliseconds. @default 5000 */
    readonly connectTimeout: number;
    /**
     * Maximum number of retries per command before the command is rejected.
     * Set to `null` for unlimited retries (not recommended for production).
     * @default 3
     */
    readonly maxRetriesPerRequest: number | null;
    /**
     * Custom retry strategy for reconnection attempts.
     * Defaults to an exponential back-off capped at 30 seconds.
     */
    readonly retryStrategy?: RetryStrategyFn;
}

// Cache Service Abstraction

/**
 * Generic cache service interface. Implementations must not expose transport
 * details to callers; all interactions go through this contract.
 *
 * @typeParam T - The domain type stored and retrieved from the cache.
 */
export interface CacheService<T> {
    /**
     * Retrieve a value from the cache.
     *
     * @param key - Cache key (without prefix).
     * @returns The stored value, or `null` on a cache miss or deserialisation failure.
     */
    get(key: string): Promise<T | null>;

    /**
     * Store a value in the cache.
     *
     * @param key - Cache key (without prefix).
     * @param value - Value to store.
     * @param ttlSeconds - Optional TTL in seconds. Omit for no expiry.
     */
    set(key: string, value: T, ttlSeconds?: number): Promise<void>;

    /**
     * Delete a single entry from the cache.
     *
     * @param key - Cache key (without prefix).
     */
    del(key: string): Promise<void>;

    /**
     * Check whether a key currently exists in the cache.
     *
     * @param key - Cache key (without prefix).
     * @returns `true` if the key exists, `false` otherwise.
     */
    exists(key: string): Promise<boolean>;

    /**
     * Delete all keys matching a glob pattern within this service's namespace.
     *
     * @param pattern - Glob pattern (e.g. `"user:*"`).
     * @returns The number of keys deleted.
     */
    flush(pattern: string): Promise<number>;
}

// Cache Entry Envelope

/**
 * Typed envelope stored in Redis. Wraps the raw value with optional metadata.
 *
 * @typeParam T - The domain type of the cached value.
 */
export interface CacheEntry<T> {
    /** The actual cached value. */
    readonly value: T;
    /** ISO-8601 timestamp at which this entry was stored. */
    readonly storedAt: string;
    /** TTL in seconds at the time of storage, if provided. */
    readonly ttlSeconds?: number;
}

// Key Builder

/**
 * Options controlling how cache keys are constructed.
 */
export interface KeyBuilderOptions {
    /**
     * Top-level namespace prepended to every key.
     * Example: `"polyverse"`.
     */
    readonly namespace: string;
    /**
     * Character used to join namespace and segments.
     * Must be a single non-empty character.
     * @default ":"
     */
    readonly separator?: string;
}

// Serialisation Errors

/**
 * Thrown when a value cannot be serialised to JSON.
 */
export class SerializationError extends Error {
    /** @param message - Human-readable description of the failure. */
    constructor(message: string) {
        super(message);
        this.name = 'SerializationError';
        // Restore prototype chain broken by transpiled class extension.
        Object.setPrototypeOf(this, new.target.prototype);
    }
}

/**
 * Thrown when a stored string cannot be deserialised back into the expected type.
 */
export class DeserializationError extends Error {
    /** @param message - Human-readable description of the failure. */
    constructor(message: string) {
        super(message);
        this.name = 'DeserializationError';
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
