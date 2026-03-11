/**
 * @file serializer.ts
 * @description Type-safe JSON serialisation and deserialisation layer for Redis values.
 * Uses the typed error classes defined in `types.ts` — no dependency on ioredis.
 */

import { DeserializationError, SerializationError } from './types.js';

/**
 * A type guard function that narrows an `unknown` value to type `T`.
 *
 * @typeParam T - The target domain type.
 */
export type TypeGuard<T> = (value: unknown) => value is T;

/**
 * Serialise a value to a JSON string suitable for storage in Redis.
 *
 * @typeParam T - The domain type being serialised.
 * @param value - The value to serialise. Must be JSON-compatible.
 * @returns A JSON string representation of `value`.
 *
 * @throws {SerializationError} When `value` contains circular references or
 * any value that `JSON.stringify` cannot handle (e.g. `BigInt`).
 *
 * @example
 * ```ts
 * serialize({ id: 'user-1', handle: 'alice@example.com' });
 * // → '{"id":"user-1","handle":"alice@example.com"}'
 * ```
 */
export function serialize<T>(value: T): string {
    try {
        const result = JSON.stringify(value);
        // JSON.stringify returns `undefined` (not a string) for values like functions,
        // symbols, or `undefined` itself — none of which can be stored in Redis.
        if (result === undefined) {
            throw new SerializationError(
                `[Redis serializer] Value of type "${typeof value}" cannot be serialised to JSON`,
            );
        }
        return result;
    } catch (err) {
        // Re-throw our own typed errors directly.
        if (err instanceof SerializationError) throw err;
        // JSON.stringify throws a TypeError for circular references.
        const message = err instanceof Error ? err.message : String(err);
        throw new SerializationError(`[Redis serializer] Serialisation failed: ${message}`);
    }
}

/**
 * Deserialise a JSON string retrieved from Redis back to the expected type `T`.
 *
 * The type guard `guard` is applied after parsing; if it returns `false` the
 * value is considered corrupt and a {@link DeserializationError} is thrown
 * rather than returning an incorrectly typed value.
 *
 * @typeParam T - The expected domain type.
 * @param raw - The raw JSON string from Redis.
 * @param guard - A type guard that validates the parsed value is indeed `T`.
 * @returns The parsed value, guaranteed to satisfy `guard`.
 *
 * @throws {DeserializationError} When `raw` is not valid JSON.
 * @throws {DeserializationError} When the parsed value does not satisfy `guard`.
 *
 * @example
 * ```ts
 * const isActor = (v: unknown): v is Actor =>
 *   typeof v === 'object' && v !== null && 'id' in v;
 *
 * deserialize('{"id":"https://mastodon.social/users/alice"}', isActor);
 * // → { id: 'https://mastodon.social/users/alice' }
 * ```
 */
export function deserialize<T>(raw: string, guard: TypeGuard<T>): T {
    let parsed: unknown;

    try {
        parsed = JSON.parse(raw);
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        throw new DeserializationError(
            `[Redis serializer] Failed to parse JSON: ${message}. Raw value: "${truncate(raw)}"`,
        );
    }

    if (!guard(parsed)) {
        throw new DeserializationError(
            `[Redis serializer] Parsed value did not satisfy the type guard. ` +
            `Raw value: "${truncate(raw)}"`,
        );
    }

    return parsed;
}

// Private helpers

/**
 * Truncate a string for use in error messages to avoid flooding logs
 * with potentially huge cached payloads.
 *
 * @param str - String to truncate.
 * @param maxLength - Maximum character length. @default 120
 * @returns The original string if short enough, otherwise truncated with `…`.
 */
function truncate(str: string, maxLength: number = 120): string {
    return str.length <= maxLength ? str : `${str.slice(0, maxLength)}…`;
}
