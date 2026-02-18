// src/tests/test-utils.ts
import type { RequestEvent } from '@sveltejs/kit';
import { vi } from 'vitest';

interface MockRequestEventOptions {
    method?: string;
    url?: string;
    params?: Record<string, string>;
    json?: Record<string, any>;
    formData?: FormData;
    locals?: App.Locals;
    headers?: Record<string, string>;
    request?: Partial<Request>;
}

export function createMockRequestEvent(options: MockRequestEventOptions = {}): RequestEvent {
    const {
        method = 'GET',
        url = '/',
        params = {},
        json,
        formData,
        locals = { user: null },
        headers = {},
        request: customRequest = {}
    } = options;

    const mockUrl = new URL(`http://localhost:3000${url}`);

    const mockRequest: Request = {
        method,
        headers: new Headers(headers),
        json: json ? vi.fn(() => Promise.resolve(json)) : vi.fn(() => Promise.resolve({})),
        formData: formData ? vi.fn(() => Promise.resolve(formData)) : vi.fn(() => Promise.resolve(new FormData())),
        text: vi.fn(),
        arrayBuffer: vi.fn(),
        blob: vi.fn(),
        clone: vi.fn(() => ({ ...mockRequest })), // Basic clone implementation
        body: null,
        bodyUsed: false,
        cache: 'default',
        credentials: 'omit',
        destination: 'document',
        integrity: '',
        mode: 'no-cors',
        redirect: 'follow',
        referrer: '',
        referrerPolicy: 'no-referrer',
        url: mockUrl.toString(),
        // Add any other properties of Request that might be accessed
        ...customRequest
    };

    const event: RequestEvent = {
        request: mockRequest,
        url: mockUrl,
        params,
        locals,
        route: { id: null }, // Mock route
        platform: {}, // Mock platform
        getClientAddress: vi.fn(() => '127.0.0.1'),
        isDataRequest: false,
        isSubRequest: false,
        // @ts-ignore - SvelteKit's RequestEvent type is complex, mock what's needed
        fetch: vi.fn(),
        setHeaders: vi.fn(),
        cookies: {
            get: vi.fn(),
            getAll: vi.fn(),
            set: vi.fn(),
            delete: vi.fn(),
            // @ts-ignore
            serialize: vi.fn()
        },
        // @ts-ignore
        cancel: false,
        // @ts-ignore
        requestContext: {},
        // @ts-ignore
        response: {
            headers: new Headers(),
            status: 200,
            webSocket: vi.fn(),
            // @ts-ignore
            cookies: {
                get: vi.fn(),
                getAll: vi.fn(),
                set: vi.fn(),
                delete: vi.fn(),
                // @ts-ignore
                serialize: vi.fn()
            }
        },
        // @ts-ignore
        parent: vi.fn(),
        // @ts-ignore
        depends: vi.fn(),
        // @ts-ignore
        status: 200,
        // @ts-ignore
        error: undefined,
        // @ts-ignore
        text: vi.fn(),
        // @ts-ignore
        json: vi.fn(),
        // @ts-ignore
        html: vi.fn()
    };

    return event;
}
