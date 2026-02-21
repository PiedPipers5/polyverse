/**
 * @file keyBuilder.ts
 * @description Deterministic, collision-safe Redis key construction utility.
 * Zero external dependencies — pure string manipulation only.
 */

import type { KeyBuilderOptions } from './types.js';

/** Default separator character used between key segments. */
const DEFAULT_SEPARATOR = ':';

/**
 * Build a Redis cache key from a namespace and one or more path segments.
 *
 * The resulting key follows the pattern:
 * ```
 * <namespace><separator><segment1><separator><segment2>...
 * ```
 *
 * **Validation rules (enforced on every segment and the namespace):**
 * - Must not be empty.
 * - Must not contain the separator character (prevents key collisions).
 *
 * @param options - Namespace and optional separator configuration.
 * @param segments - One or more path segments that identify the cached resource.
 * @returns A validated, deterministic cache key string.
 *
 * @throws {Error} When the namespace is empty or contains the separator.
 * @throws {Error} When any segment is empty or contains the separator.
 * @throws {Error} When no segments are provided.
 *
 * @example
 * ```ts
 * buildKey({ namespace: 'polyverse' }, 'actor', 'gargron@mastodon.social');
 * // → "polyverse:actor:gargron@mastodon.social"
 *
 * buildKey({ namespace: 'pv', separator: '|' }, 'session', 'abc123');
 * // → "pv|session|abc123"
 * ```
 */
export function buildKey(
    options: KeyBuilderOptions,
    ...segments: readonly string[]
): string {
    const separator = options.separator ?? DEFAULT_SEPARATOR;

    // Validate separator itself: must be a single, non-empty character.
    if (separator.length !== 1) {
        throw new Error(
            `[Redis keyBuilder] separator must be exactly one character, got: "${separator}"`,
        );
    }

    // Validate namespace.
    validateSegment(options.namespace, 'namespace', separator);

    // At least one segment is required.
    if (segments.length === 0) {
        throw new Error('[Redis keyBuilder] at least one segment must be provided');
    }

    // Validate every segment before joining — fail fast on the first violation.
    segments.forEach((segment, index) => {
        validateSegment(segment, `segment[${index}]`, separator);
    });

    return [options.namespace, ...segments].join(separator);
}

// Private helpers

/**
 * Assert that a key part is non-empty and does not contain the separator.
 *
 * @param value - The string to validate.
 * @param label - Human-readable label used in error messages (e.g. `"namespace"`, `"segment[0]"`).
 * @param separator - The separator character to check for.
 * @throws {Error} When `value` is empty or contains `separator`.
 */
function validateSegment(value: string, label: string, separator: string): void {
    if (value.length === 0) {
        throw new Error(`[Redis keyBuilder] ${label} must not be empty`);
    }
    if (value.includes(separator)) {
        throw new Error(
            `[Redis keyBuilder] ${label} must not contain the separator "${separator}", got: "${value}"`,
        );
    }
}
