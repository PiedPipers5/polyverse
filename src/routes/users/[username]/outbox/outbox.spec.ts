import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { POST } from './+server';
import { db } from '$lib/server/db';
import type { RequestEvent } from '@sveltejs/kit';

// Mock the DB module
mock.module('$lib/server/db', () => ({
    db: {
        insert: mock(() => ({
            values: mock(() => Promise.resolve({})),
        })),
    },
}));

// Mock env
mock.module('$env/dynamic/private', () => ({
    env: {
        DOMAIN: 'test.com',
        PROTOCOL: 'https',
    },
}));

function createMockEvent(overrides: Partial<RequestEvent>): RequestEvent {
    // Default mock implementation satisfying RequestEvent interface
    const defaults: RequestEvent = {
        cookies: {
            get: mock(() => undefined),
            getAll: mock(() => []),
            set: mock(),
            delete: mock(),
            serialize: mock(() => ''),
        } as any, // Cookies interface is complex to fully mock without helper, keep minimal any here or use a better mock
        fetch: mock(() => Promise.resolve(new Response())),
        getClientAddress: mock(() => '127.0.0.1'),
        locals: { user: null },
        params: {},
        platform: {},
        request: new Request('http://localhost'),
        route: { id: '/users/[username]/outbox' },
        setHeaders: mock(),
        url: new URL('http://localhost'),
        isDataRequest: false,
        isSubRequest: false,
        isRemoteRequest: false,
        tracing: {} as any, // Mocking tracing is overkill
    };

    // Force cast params to satisfy strict route params
    return { ...defaults, ...overrides } as unknown as RequestEvent;
}

describe('POST /users/[username]/outbox', () => {
    beforeEach(() => {
        mock.restore(); // Or specific restore logic if needed
    });

    it('should create an activity and save to DB', async () => {
        const mockRequest = {
            text: async () => 'Hello World',
        } as unknown as Request;

        const mockLocals: App.Locals = {
            user: {
                userId: 'user-123',
                username: 'alice',
                did: 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK',
            },
        };

        const event = createMockEvent({
            request: mockRequest,
            locals: mockLocals,
            params: { username: 'alice' },
        }) as Parameters<typeof POST>[0];

        const response = await POST(event);

        expect(response.status).toBe(201);
        const json = await response.json();

        expect(json.type).toBe('Create');
        expect(json.actor).toBe('https://test.com/users/alice');
        expect((json.object as any).type).toBe('Note');
        expect((json.object as any).content).toBe('Hello World');

        // Verify DB was called
        expect(db.insert).toHaveBeenCalled();
    });

    it('should reject unauthenticated requests', async () => {
        const event = createMockEvent({
            locals: { user: null },
            params: { username: 'alice' }
        }) as Parameters<typeof POST>[0];

        await expect(POST(event)).rejects.toThrow(); // throws error(401)
    });

    it('should reject posting to another user\'s outbox', async () => {
        const mockLocals: App.Locals = {
            user: {
                username: 'krazy_cat',
                userId: 'u-1',
                did: 'did:test:1'
            }
        };

        const event = createMockEvent({
            locals: mockLocals,
            params: { username: 'dumbcat' }
        }) as Parameters<typeof POST>[0];

        await expect(POST(event)).rejects.toThrow(); // throws error(403)
    });
});

// Mock the DB module
mock.module('$lib/server/db', () => ({
    db: {
        insert: mock(() => ({
            values: mock(() => Promise.resolve({})),
        })),
    },
}));

// Mock env
mock.module('$env/dynamic/private', () => ({
    env: {
        DOMAIN: 'test.com',
        PROTOCOL: 'https',
    },
}));

describe('POST /users/[username]/outbox', () => {
    beforeEach(() => {
        mock.restore(); // Or specific restore logic if needed
    });

    it('should create an activity and save to DB', async () => {
        const mockRequest = {
            text: async () => 'Hello World',
        } as Request;

        const mockLocals = {
            user: {
                userId: 'user-123',
                username: 'alice',
            },
        } as any;

        const mockParams = {
            username: 'alice',
        };

        const response = await POST({
            request: mockRequest,
            locals: mockLocals,
            params: mockParams,
            url: new URL('http://localhost'),
            route: { id: '/users/[username]/outbox' },
            cookies: {} as any,
            setHeaders: mock(),
            platform: {},
            getClientAddress: () => '127.0.0.1',
            isDataRequest: false,
        } as any);

        expect(response.status).toBe(201);
        const json = await response.json();

        expect(json.type).toBe('Create');
        expect(json.actor).toBe('https://test.com/users/alice');
        expect(json.object.type).toBe('Note');
        expect(json.object.content).toBe('Hello World');

        // Verify DB was called
        expect(db.insert).toHaveBeenCalled();
    });

    it('should reject unauthenticated requests', async () => {
        const mockLocals = { user: null } as any;

        await expect(POST({
            request: {} as Request,
            locals: mockLocals,
            params: { username: 'alice' }
        } as any)).rejects.toThrow(); // throws error(401)
    });

    it('should reject posting to another user\'s outbox', async () => {
        const mockLocals = {
            user: { username: 'krazy_cat' }
        } as any;

        await expect(POST({
            request: {} as Request,
            locals: mockLocals,
            params: { username: 'dumbcat' }
        } as any)).rejects.toThrow(); // throws error(403)
    });
});
