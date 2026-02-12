import { describe, it, expect } from 'bun:test';
import { Note, Create } from '@fedify/fedify';
import { Temporal } from '@js-temporal/polyfill';

describe('ActivityPub Objects', () => {
    it('should construct a valid Note object', () => {
        const note = new Note({
            id: new URL('https://example.com/note/1'),
            content: 'Hello World',
            attribution: new URL('https://example.com/users/alice'),
            published: Temporal.Instant.from('2024-01-01T00:00:00Z'),
            to: new URL('https://www.w3.org/ns/activitystreams#Public'),
        });

        expect(note.id?.toString()).toBe('https://example.com/note/1');
        expect(note.attributionId?.toString()).toBe('https://example.com/users/alice');
    });

    it('should serialize to valid JSON-LD', async () => {
        const note = new Note({
            id: new URL('https://example.com/note/1'),
            content: 'Hello World',
            attribution: new URL('https://example.com/users/alice'),
            published: Temporal.Instant.from('2024-01-01T00:00:00Z'),
        });

        const json = await note.toJsonLd();
        expect(json.type).toBe('Note');
        expect(json.content).toBe('Hello World');
        expect(json.attributedTo).toBe('https://example.com/users/alice');
    });

    it('should wrap Note in Create activity', async () => {
        const note = new Note({
            id: new URL('https://example.com/note/1'),
            content: 'Hello World',
            attribution: new URL('https://example.com/users/alice'),
        });

        const create = new Create({
            id: new URL('https://example.com/activity/1'),
            actor: new URL('https://example.com/users/alice'),
            object: note,
        });

        const json = await create.toJsonLd();
        expect(json.type).toBe('Create');
        expect(json.actor).toBe('https://example.com/users/alice');
        expect((json.object as any).type).toBe('Note');
        expect((json.object as any).content).toBe('Hello World');
    });
});
