// src/tests/Epic3_BE/redis/keyBuilder.test.ts
import { describe, it, expect } from 'vitest';
import { buildKey } from '$lib/server/redis/keyBuilder';

describe('buildKey', () => {
    describe('valid key construction', () => {
        it('joins namespace and a single segment with the default separator', () => {
            expect(buildKey({ namespace: 'pv' }, 'actor')).toBe('pv:actor');
        });

        it('joins namespace and multiple segments with the default separator', () => {
            expect(buildKey({ namespace: 'polyverse' }, 'actor', 'alice@example.com')).toBe(
                'polyverse:actor:alice@example.com',
            );
        });

        it('supports three or more segments', () => {
            expect(buildKey({ namespace: 'ns' }, 'a', 'b', 'c')).toBe('ns:a:b:c');
        });

        it('uses a custom separator when provided', () => {
            expect(buildKey({ namespace: 'pv', separator: '|' }, 'session', 'abc123')).toBe(
                'pv|session|abc123',
            );
        });

        it('prepends the namespace to all segments', () => {
            const key = buildKey({ namespace: 'polyverse' }, 'user', 'profile');
            expect(key.startsWith('polyverse:')).toBe(true);
        });
    });

    describe('validation — rejection cases', () => {
        it('throws when the namespace is empty', () => {
            expect(() => buildKey({ namespace: '' }, 'key')).toThrow(
                '[Redis keyBuilder] namespace must not be empty',
            );
        });

        it('throws when a segment is an empty string', () => {
            expect(() => buildKey({ namespace: 'pv' }, '')).toThrow(
                '[Redis keyBuilder] segment[0] must not be empty',
            );
        });

        it('throws when namespace contains the separator character', () => {
            expect(() => buildKey({ namespace: 'po:ly' }, 'key')).toThrow(
                '[Redis keyBuilder] namespace must not contain the separator',
            );
        });

        it('throws when a segment contains the separator character', () => {
            expect(() => buildKey({ namespace: 'pv' }, 'actor:bad')).toThrow(
                '[Redis keyBuilder] segment[0] must not contain the separator',
            );
        });

        it('throws when no segments are provided', () => {
            expect(() => buildKey({ namespace: 'pv' })).toThrow(
                '[Redis keyBuilder] at least one segment must be provided',
            );
        });

        it('throws when the separator is more than one character', () => {
            expect(() => buildKey({ namespace: 'pv', separator: '::' }, 'key')).toThrow(
                '[Redis keyBuilder] separator must be exactly one character',
            );
        });
    });
});
