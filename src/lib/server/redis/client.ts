/**
 * @file client.ts
 * @description Redis client factory with lazy initialisation, retry strategy,
 * structured event handling, and graceful disconnect.
 * No business logic lives here — this module is purely infrastructure.
 */

import { Redis, type RedisOptions } from 'ioredis';
import type { RedisConfig } from './types.js';

// Logger interface (injectable)

/**
 * Minimal structured logger interface accepted by {@link RedisClientFactory}.
 * Wire this to any logging backend (Sentry, Pino, etc.) without coupling this
 * module to a specific library.
 */
export interface RedisLogger {
    /**
     * Log an error-level event.
     * @param message - Human-readable message.
     * @param meta - Optional structured metadata.
     */
    error(message: string, meta?: Record<string, unknown>): void;

    /**
     * Log an info-level event.
     * @param message - Human-readable message.
     * @param meta - Optional structured metadata.
     */
    info(message: string, meta?: Record<string, unknown>): void;

    /**
     * Log a warn-level event.
     * @param message - Human-readable message.
     * @param meta - Optional structured metadata.
     */
    warn(message: string, meta?: Record<string, unknown>): void;
}

// Default no-op logger

/**
 * Fallback logger that silently discards all messages.
 * Swap for a real logger in production via the factory constructor.
 */
const noopLogger: RedisLogger = {
    error: () => undefined,
    info: () => undefined,
    warn: () => undefined,
};

// Factory

/**
 * Factory that creates and manages the lifecycle of a single ioredis `Redis`
 * instance. One factory instance owns one connection — no global state.
 *
 * @example
 * ```ts
 * const factory = new RedisClientFactory(config, myLogger);
 * const redis   = factory.getClient();     // lazy-init
 * await redis.set('key', 'value');
 * await factory.disconnect();              // graceful quit
 * ```
 */
export class RedisClientFactory {
    private readonly config: RedisConfig;
    private readonly logger: RedisLogger;
    /** Lazily-initialised ioredis instance; `null` before first `getClient()` call. */
    private client: Redis | null = null;

    /**
     * @param config - Validated Redis connection configuration.
     * @param logger - Optional structured logger. Defaults to a silent no-op logger.
     */
    constructor(config: RedisConfig, logger: RedisLogger = noopLogger) {
        this.config = config;
        this.logger = logger;
    }

    // Public API

    /**
     * Return the ioredis client, creating it on the first call (lazy init).
     * Subsequent calls return the same instance — one connection per factory.
     *
     * @returns The ioredis {@link Redis} instance.
     */
    getClient(): Redis {
        if (this.client === null) {
            this.client = this.createClient();
        }
        return this.client;
    }

    /**
     * Gracefully shut down the Redis connection using `QUIT`.
     * Safe to call even if `getClient()` was never invoked.
     *
     * @returns A promise that resolves when the connection is fully closed.
     */
    async disconnect(): Promise<void> {
        if (this.client !== null) {
            await this.client.quit();
            this.client = null;
        }
    }

    // Private helpers

    /**
     * Construct the ioredis `Redis` instance wired with the config, retry
     * strategy, and structured event listeners.
     *
     * @returns A freshly constructed, event-wired ioredis {@link Redis} instance.
     */
    private createClient(): Redis {
        const {
            host,
            port,
            password,
            db,
            tls,
            connectTimeout,
            maxRetriesPerRequest,
            retryStrategy,
        } = this.config;

        const options: RedisOptions = {
            host,
            port,
            db,
            connectTimeout,
            maxRetriesPerRequest,
            // ioredis expects `tls: {}` for TLS with system defaults, or omitted when disabled.
            ...(tls ? { tls: {} } : {}),
            // Only include password when set — ioredis treats empty string as a credential.
            ...(password !== undefined ? { password } : {}),
            // Wrap our typed RetryStrategyFn; returning null stops reconnection.
            retryStrategy:
                retryStrategy !== undefined
                    ? (times: number) => retryStrategy(times)
                    : undefined,
            // Prevent ioredis from throwing unhandled promise rejections on startup.
            lazyConnect: false,
            enableReadyCheck: true,
        };

        const redis = new Redis(options);

        this.wireEvents(redis);

        return redis;
    }

    /**
     * Attach structured event listeners to the ioredis client.
     * Events are forwarded to the injected logger — never to `console`.
     *
     * @param redis - The ioredis instance to wire.
     */
    private wireEvents(redis: Redis): void {
        redis.on('error', (err: Error) => {
            this.logger.error('[Redis] Connection error', {
                message: err.message,
                name: err.name,
            });
        });

        redis.on('connect', () => {
            this.logger.info('[Redis] Connected', {
                host: this.config.host,
                port: this.config.port,
                db: this.config.db,
            });
        });

        redis.on('reconnecting', (delay: number) => {
            this.logger.warn('[Redis] Reconnecting', { delayMs: delay });
        });

        redis.on('close', () => {
            this.logger.info('[Redis] Connection closed');
        });

        redis.on('end', () => {
            this.logger.info('[Redis] Connection ended — no further reconnect attempts');
        });
    }
}
