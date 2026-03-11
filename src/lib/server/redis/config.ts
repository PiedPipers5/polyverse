/**
 * @file config.ts
 * @description Parses and validates Redis connection configuration from environment variables.
 * This module has zero runtime dependencies beyond the types it imports.
 */

import type { RedisConfig, RetryStrategyFn } from './types.js';

// Constants

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 6379;
const DEFAULT_DB = 0;
const DEFAULT_CONNECT_TIMEOUT_MS = 5_000;
const DEFAULT_MAX_RETRIES_PER_REQUEST = 3;
/** Cap for the exponential back-off retry strategy (ms). */
const MAX_RETRY_DELAY_MS = 30_000;

// Default retry strategy

/**
 * Exponential back-off retry strategy capped at {@link MAX_RETRY_DELAY_MS}.
 *
 * @param times - Number of reconnection attempts already made.
 * @returns Milliseconds to wait before the next attempt.
 */
const defaultRetryStrategy: RetryStrategyFn = (times: number): number => {
    // 2^(attempt-1) * 100ms, capped at MAX_RETRY_DELAY_MS
    return Math.min(Math.pow(2, times - 1) * 100, MAX_RETRY_DELAY_MS);
};

// Helpers

/**
 * Parse an integer from a string env var. Returns `fallback` when the var is
 * absent; throws when the var is present but not a valid integer.
 *
 * @param raw - Raw environment variable value.
 * @param varName - Variable name, used in error messages.
 * @param fallback - Default value when `raw` is `undefined`.
 * @returns Parsed integer or the provided fallback.
 * @throws {Error} When `raw` is defined but cannot be parsed as an integer.
 */
function parseIntEnv(raw: string | undefined, varName: string, fallback: number): number {
    if (raw === undefined || raw === '') return fallback;
    const parsed = Number(raw);
    if (!Number.isInteger(parsed)) {
        throw new Error(`[Redis config] ${varName} must be an integer, got: "${raw}"`);
    }
    return parsed;
}

/**
 * Parse a boolean from a string env var ("true" / "1" → `true`, everything
 * else → `false`). Returns `fallback` when the var is absent.
 *
 * @param raw - Raw environment variable value.
 * @param fallback - Default value when `raw` is `undefined`.
 * @returns Parsed boolean or the provided fallback.
 */
function parseBoolEnv(raw: string | undefined, fallback: boolean): boolean {
    if (raw === undefined || raw === '') return fallback;
    return raw === 'true' || raw === '1';
}

// Public API

/**
 * Build a {@link RedisConfig} from the supplied environment map.
 *
 * **Precedence:**
 * 1. If `REDIS_URL` is set it takes priority for host/port/password/db/tls;
 *    individual vars can still override `connectTimeout` and
 *    `maxRetriesPerRequest`.
 * 2. Otherwise, individual vars are used with sensible defaults.
 *
 * **Recognised environment variables:**
 * | Variable                     | Default                    |
 * |------------------------------|----------------------------|
 * | `REDIS_URL`                  | —                          |
 * | `REDIS_HOST`                 | `"127.0.0.1"`              |
 * | `REDIS_PORT`                 | `6379`                     |
 * | `REDIS_PASSWORD`             | —                          |
 * | `REDIS_DB`                   | `0`                        |
 * | `REDIS_TLS`                  | `false`                    |
 * | `REDIS_CONNECT_TIMEOUT`      | `5000`                     |
 * | `REDIS_MAX_RETRIES_PER_REQ`  | `3`                        |
 *
 * @param env - Environment variable map (e.g. `process.env`).
 * @param retryStrategy - Optional custom retry strategy. Defaults to exponential back-off.
 * @returns A validated, immutable {@link RedisConfig}.
 * @throws {Error} When required values are missing or cannot be parsed.
 */
export function loadRedisConfig(
    env: Record<string, string | undefined>,
    retryStrategy: RetryStrategyFn = defaultRetryStrategy,
): RedisConfig {
    // Common overrides regardless of whether REDIS_URL is provided.
    const connectTimeout = parseIntEnv(
        env['REDIS_CONNECT_TIMEOUT'],
        'REDIS_CONNECT_TIMEOUT',
        DEFAULT_CONNECT_TIMEOUT_MS,
    );
    const maxRetriesPerRequest = parseIntEnv(
        env['REDIS_MAX_RETRIES_PER_REQ'],
        'REDIS_MAX_RETRIES_PER_REQ',
        DEFAULT_MAX_RETRIES_PER_REQUEST,
    );

    const redisUrl = env['REDIS_URL'];

    if (redisUrl !== undefined && redisUrl !== '') {
        return buildConfigFromUrl(redisUrl, connectTimeout, maxRetriesPerRequest, retryStrategy);
    }

    return buildConfigFromVars(env, connectTimeout, maxRetriesPerRequest, retryStrategy);
}

// Private builders

/**
 * Parse a `RedisConfig` from a Redis connection URL.
 * Supports the `redis://` and `rediss://` (TLS) schemes.
 *
 * @param rawUrl - The full Redis connection URL.
 * @param connectTimeout - Connection timeout in ms.
 * @param maxRetriesPerRequest - Max retries per command.
 * @param retryStrategy - Reconnection back-off function.
 * @returns Parsed {@link RedisConfig}.
 * @throws {Error} When the URL scheme is not `redis://` or `rediss://`, or the URL is malformed.
 */
function buildConfigFromUrl(
    rawUrl: string,
    connectTimeout: number,
    maxRetriesPerRequest: number,
    retryStrategy: RetryStrategyFn,
): RedisConfig {
    let url: URL;
    try {
        url = new URL(rawUrl);
    } catch {
        throw new Error(`[Redis config] REDIS_URL is not a valid URL: "${rawUrl}"`);
    }

    if (url.protocol !== 'redis:' && url.protocol !== 'rediss:') {
        throw new Error(
            `[Redis config] REDIS_URL must use the "redis://" or "rediss://" scheme, got: "${url.protocol}"`,
        );
    }

    const host = url.hostname || DEFAULT_HOST;
    const port = url.port ? Number(url.port) : DEFAULT_PORT;
    const password = url.password ? decodeURIComponent(url.password) : undefined;
    // Redis databases can be encoded as the first path segment: /0, /1, etc.
    const dbSegment = url.pathname.slice(1); // Remove leading "/"
    const db = dbSegment !== '' ? Number(dbSegment) : DEFAULT_DB;

    if (!Number.isInteger(db) || db < 0) {
        throw new Error(`[Redis config] REDIS_URL contains an invalid database index: "${dbSegment}"`);
    }

    return Object.freeze({
        host,
        port,
        password,
        db,
        tls: url.protocol === 'rediss:',
        connectTimeout,
        maxRetriesPerRequest,
        retryStrategy,
    });
}

/**
 * Parse a `RedisConfig` from individual environment variables.
 *
 * @param env - Environment variable map.
 * @param connectTimeout - Connection timeout in ms.
 * @param maxRetriesPerRequest - Max retries per command.
 * @param retryStrategy - Reconnection back-off function.
 * @returns Parsed {@link RedisConfig}.
 * @throws {Error} When any individual variable is present but invalid.
 */
function buildConfigFromVars(
    env: Record<string, string | undefined>,
    connectTimeout: number,
    maxRetriesPerRequest: number,
    retryStrategy: RetryStrategyFn,
): RedisConfig {
    const host = env['REDIS_HOST'] ?? DEFAULT_HOST;
    const port = parseIntEnv(env['REDIS_PORT'], 'REDIS_PORT', DEFAULT_PORT);
    const password = env['REDIS_PASSWORD'] !== '' ? env['REDIS_PASSWORD'] : undefined;
    const db = parseIntEnv(env['REDIS_DB'], 'REDIS_DB', DEFAULT_DB);
    const tls = parseBoolEnv(env['REDIS_TLS'], false);

    if (port < 1 || port > 65535) {
        throw new Error(`[Redis config] REDIS_PORT must be between 1 and 65535, got: ${port}`);
    }

    if (db < 0) {
        throw new Error(`[Redis config] REDIS_DB must be a non-negative integer, got: ${db}`);
    }

    return Object.freeze({
        host,
        port,
        password,
        db,
        tls,
        connectTimeout,
        maxRetriesPerRequest,
        retryStrategy,
    });
}
