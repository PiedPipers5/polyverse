// src/tests/Epic3_BE/redis/client.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.mock hoisting: ioredis replaced with a bare vi.fn() before any imports.
vi.mock('ioredis', () => ({ Redis: vi.fn() }));

// Imports must come AFTER vi.mock so they receive the mocked module.
import { Redis } from 'ioredis';
import { RedisClientFactory } from '$lib/server/redis/client';
import type { RedisConfig } from '$lib/server/redis/types';

// vi.mocked gives us the typed mock class — same reference as the mock above.
const MockedRedis = vi.mocked(Redis);

const baseConfig: RedisConfig = {
    host: '127.0.0.1',
    port: 6379,
    db: 0,
    tls: false,
    connectTimeout: 5000,
    maxRetriesPerRequest: 3,
};

/** Build a fresh mockOn + mockQuit per test to avoid state leaking between tests. */
function makeInstanceMocks() {
    const mockOn = vi.fn().mockReturnThis();
    const mockQuit = vi.fn().mockResolvedValue('OK');
    return { mockOn, mockQuit };
}

describe('RedisClientFactory', () => {
    let mockOn: ReturnType<typeof vi.fn>;
    let mockQuit: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        const inst = makeInstanceMocks();
        mockOn = inst.mockOn;
        mockQuit = inst.mockQuit;

        MockedRedis.mockClear();
        // Use a regular function (not arrow) so it behaves as a constructor.
        MockedRedis.mockImplementation(function (this: unknown) {
            return { on: mockOn, quit: mockQuit };
        });
    });

    describe('getClient()', () => {
        it('instantiates ioredis Redis with the correct host and port', () => {
            const factory = new RedisClientFactory(baseConfig);
            factory.getClient();

            expect(MockedRedis).toHaveBeenCalledOnce();
            const [opts] = MockedRedis.mock.calls[0] as unknown as [Record<string, unknown>];
            expect(opts['host']).toBe('127.0.0.1');
            expect(opts['port']).toBe(6379);
            expect(opts['db']).toBe(0);
        });

        it('returns the same instance on repeated calls (lazy singleton per factory)', () => {
            const factory = new RedisClientFactory(baseConfig);
            const first = factory.getClient();
            const second = factory.getClient();

            expect(first).toBe(second);
            expect(MockedRedis).toHaveBeenCalledOnce();
        });

        it('wires event listeners on the ioredis instance', () => {
            const factory = new RedisClientFactory(baseConfig);
            factory.getClient();

            const events = (mockOn.mock.calls as [string, unknown][]).map(([evt]) => evt);
            expect(events).toContain('error');
            expect(events).toContain('connect');
            expect(events).toContain('reconnecting');
        });

        it('passes password when present in config', () => {
            const config: RedisConfig = { ...baseConfig, password: 'secret' };
            new RedisClientFactory(config).getClient();

            const [opts] = MockedRedis.mock.calls[0] as unknown as [Record<string, unknown>];
            expect(opts['password']).toBe('secret');
        });

        it('omits password field when not set in config', () => {
            new RedisClientFactory(baseConfig).getClient();

            const [opts] = MockedRedis.mock.calls[0] as unknown as [Record<string, unknown>];
            expect(opts).not.toHaveProperty('password');
        });

        it('passes tls option when tls is true in config', () => {
            new RedisClientFactory({ ...baseConfig, tls: true }).getClient();

            const [opts] = MockedRedis.mock.calls[0] as unknown as [Record<string, unknown>];
            expect(opts).toHaveProperty('tls');
        });

        it('omits tls option when tls is false in config', () => {
            new RedisClientFactory(baseConfig).getClient();

            const [opts] = MockedRedis.mock.calls[0] as unknown as [Record<string, unknown>];
            expect(opts).not.toHaveProperty('tls');
        });

        it('two different factories create two separate ioredis instances', () => {
            new RedisClientFactory(baseConfig).getClient();
            new RedisClientFactory(baseConfig).getClient();

            expect(MockedRedis).toHaveBeenCalledTimes(2);
        });
    });

    describe('disconnect()', () => {
        it('calls quit() on the underlying Redis instance', async () => {
            const factory = new RedisClientFactory(baseConfig);
            factory.getClient();
            await factory.disconnect();

            expect(mockQuit).toHaveBeenCalledOnce();
        });

        it('is safe to call before getClient() has been invoked', async () => {
            const factory = new RedisClientFactory(baseConfig);
            await expect(factory.disconnect()).resolves.toBeUndefined();
            expect(mockQuit).not.toHaveBeenCalled();
        });

        it('nulls the internal client so a subsequent getClient() creates a fresh one', async () => {
            // Set up two distinct instances for the two getClient() calls.
            const inst1 = makeInstanceMocks();
            const inst2 = makeInstanceMocks();
            MockedRedis.mockImplementationOnce(function (this: unknown) {
                return { on: inst1.mockOn, quit: inst1.mockQuit };
            }).mockImplementationOnce(function (this: unknown) {
                return { on: inst2.mockOn, quit: inst2.mockQuit };
            });

            const factory = new RedisClientFactory(baseConfig);
            const first = factory.getClient();
            await factory.disconnect();
            const second = factory.getClient();

            // Should be distinct objects returned by the two mock implementations.
            expect(first).not.toBe(second);
            expect(MockedRedis).toHaveBeenCalledTimes(2);
        });
    });

    describe('logger injection', () => {
        it('calls logger.error when the error event fires', () => {
            const mockLogger = { error: vi.fn(), info: vi.fn(), warn: vi.fn() };
            new RedisClientFactory(baseConfig, mockLogger).getClient();

            const errorHandler = (mockOn.mock.calls as [string, (...args: unknown[]) => void][]).find(
                ([evt]) => evt === 'error',
            )?.[1];
            errorHandler?.(new Error('connection refused'));

            expect(mockLogger.error).toHaveBeenCalledOnce();
        });

        it('calls logger.info when the connect event fires', () => {
            const mockLogger = { error: vi.fn(), info: vi.fn(), warn: vi.fn() };
            new RedisClientFactory(baseConfig, mockLogger).getClient();

            const connectHandler = (mockOn.mock.calls as [string, (...args: unknown[]) => void][]).find(
                ([evt]) => evt === 'connect',
            )?.[1];
            connectHandler?.();

            expect(mockLogger.info).toHaveBeenCalled();
        });
    });
});
