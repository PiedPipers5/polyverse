// src/tests/Epic3_BE/redis/serializer.test.ts
import { describe, it, expect } from 'vitest';
import { serialize, deserialize } from '$lib/server/redis/serializer';
import { SerializationError, DeserializationError } from '$lib/server/redis/types';

interface TestUser {
    id: string;
    handle: string;
}

const isTestUser = (v: unknown): v is TestUser =>
    typeof v === 'object' &&
    v !== null &&
    typeof (v as Record<string, unknown>)['id'] === 'string' &&
    typeof (v as Record<string, unknown>)['handle'] === 'string';

describe('serialize', () => {
    it('serialises a plain object to a JSON string', () => {
        const result = serialize({ id: '1', handle: 'alice' });
        expect(result).toBe('{"id":"1","handle":"alice"}');
    });

    it('serialises primitive values', () => {
        expect(serialize(42)).toBe('42');
        expect(serialize(true)).toBe('true');
        expect(serialize(null)).toBe('null');
    });

    it('serialises nested objects', () => {
        const obj = { a: { b: { c: 'deep' } } };
        expect(JSON.parse(serialize(obj))).toEqual(obj);
    });

    it('throws SerializationError for circular references', () => {
        const circular: Record<string, unknown> = {};
        circular['self'] = circular;
        expect(() => serialize(circular)).toThrow(SerializationError);
    });

    it('thrown error has the correct name', () => {
        const circular: Record<string, unknown> = {};
        circular['self'] = circular;
        try {
            serialize(circular);
        } catch (err) {
            expect(err).toBeInstanceOf(SerializationError);
            expect((err as SerializationError).name).toBe('SerializationError');
        }
        expect.assertions(2);
    });
});

describe('deserialize', () => {
    it('round-trips an object through serialize then deserialize', () => {
        const original: TestUser = { id: 'u-1', handle: 'bob@example.com' };
        const raw = serialize(original);
        const result = deserialize(raw, isTestUser);
        expect(result).toEqual(original);
    });

    it('returns the correct typed value on a valid JSON + passing guard', () => {
        const raw = '{"id":"abc","handle":"carol@test.com"}';
        const user = deserialize(raw, isTestUser);
        expect(user.id).toBe('abc');
        expect(user.handle).toBe('carol@test.com');
    });

    it('throws DeserializationError when the raw string is invalid JSON', () => {
        expect(() => deserialize('not-json', isTestUser)).toThrow(DeserializationError);
    });

    it('throws DeserializationError when the type guard fails', () => {
        const raw = '{"wrong":"shape"}';
        expect(() => deserialize(raw, isTestUser)).toThrow(DeserializationError);
    });

    it('thrown error has the correct name', () => {
        try {
            deserialize('bad json!!!', isTestUser);
        } catch (err) {
            expect(err).toBeInstanceOf(DeserializationError);
            expect((err as DeserializationError).name).toBe('DeserializationError');
        }
        expect.assertions(2);
    });

    it('handles arrays round-trip correctly', () => {
        const isStringArray = (v: unknown): v is string[] =>
            Array.isArray(v) && v.every((i) => typeof i === 'string');
        const arr = ['a', 'b', 'c'];
        expect(deserialize(serialize(arr), isStringArray)).toEqual(arr);
    });
});
