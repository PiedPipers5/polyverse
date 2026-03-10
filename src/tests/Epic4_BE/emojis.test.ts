import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '../../routes/api/emojis/+server';
import { db } from '$lib/server/db';
import { error } from '@sveltejs/kit';

// Mock DB
vi.mock('$lib/server/db', () => ({
    db: {
        query: {
            customEmojis: {
                findMany: vi.fn()
            }
        }
    }
}));

// Mock SvelteKit json/error
vi.mock('@sveltejs/kit', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@sveltejs/kit')>();
    return {
        ...actual,
        json: (data: any) => ({
            json: async () => data,
            status: 200
        }),
        error: (status: number, message: string) => {
            return { status, body: { message } };
        }
    };
});

describe('Epic 4 - Emojis API Service (/api/emojis)', () => {

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should successfully fetch default emoji pack mappings', async () => {
        const mockEmojis = [
            { id: '1', shortcode: 'pepe_smile', url: '/emojis/pepe_smile.png' },
            { id: '2', shortcode: 'doge', url: '/emojis/doge.png' }
        ];

        (db.query.customEmojis.findMany as vi.Mock).mockResolvedValue(mockEmojis);

        // Fetch without auth (it's a public endpoint)
        const event: any = {};

        const res = await GET(event);
        const data = await res.json();

        expect(data.emojis).toBeDefined();
        // Since we mock Drizzle, we only see mocked db contents 
        // returned mixed with the static system mappings if GET does that.
        // Even if only mocking the DB part, we can assert on the array length/shape.
        expect(Array.isArray(data.emojis)).toBe(true);
        expect(data.emojis.length).toBeGreaterThanOrEqual(2);

        const pepe = data.emojis.find((e: any) => e.shortcode === 'pepe_smile');
        expect(pepe.url).toBe('/emojis/pepe_smile.png');
    });

    it('should return a 500 server error if database lookup fails', async () => {
        (db.query.customEmojis.findMany as vi.Mock).mockRejectedValue(new Error('DB Connection Dropped'));

        // The API returns a json({ error: '...' }, { status: 500 }) instead of throwing SvelteKit error()
        const res = await GET(event);
        const data = await res.json();

        expect(res.status).toBe(500);
        expect(data.error).toContain('Failed to fetch emojis');
    });

});
