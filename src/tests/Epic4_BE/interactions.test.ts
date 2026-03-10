import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../../routes/api/interact/+server';
import { db } from '$lib/server/db';
import { error } from '@sveltejs/kit';

// Mock the database and authentication
vi.mock('$lib/server/db', () => ({
    db: {
        insert: vi.fn(),
        delete: vi.fn(),
        query: {
            users: {
                findFirst: vi.fn()
            },
            posts: {
                findFirst: vi.fn()
            }
        }
    }
}));

// Mock SvelteKit error to act like real errors we can catch
vi.mock('@sveltejs/kit', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@sveltejs/kit')>();
    return {
        ...actual,
        error: (status: number, message: string) => {
            return { status, body: { message } };
        }
    };
});

// Helper payload mock generator
function createMockEvent(payload: any, user: any = { userId: '123', username: 'testuser', did: 'did:web:test' }) {
    return {
        request: {
            json: async () => payload
        },
        locals: {
            user
        }
    } as any;
}

describe('Epic 4 - Interactions API Service (/api/interact)', () => {

    beforeEach(() => {
        vi.clearAllMocks();

        // Default target post exists
        (db.query.posts.findFirst as vi.Mock).mockResolvedValue({
            id: 'post-123',
            authorId: 'author-456'
        });

        // Insert mocking to chain .values() and .onConflictDoUpdate()
        const mockInsert: any = {
            values: vi.fn().mockReturnValue({
                onConflictDoUpdate: vi.fn().mockResolvedValue([{
                    postId: 'post-123',
                    userId: '123',
                    action: 'upvote'
                }])
            })
        };
        (db.insert as vi.Mock).mockReturnValue(mockInsert);

        // Delete Mocking
        const mockDelete: any = {
            where: vi.fn().mockResolvedValue([{ deletedId: 'post-123' }])
        };
        (db.delete as vi.Mock).mockReturnValue(mockDelete);
    });

    it('should block unauthenticated requests', async () => {
        const event = createMockEvent({ postId: 'p1', action: 'upvote' }, null); // user is null

        try {
            await POST(event);
            expect.fail('Should have thrown 401');
        } catch (e: any) {
            expect(e.status).toBe(401);
            expect(e.body.message).toContain('Unauthorized');
        }
    });

    it('should reject Invalid action. Must be upvote, downvote, or remove.s', async () => {
        const event = createMockEvent({ postId: 'p1', action: 'super_like' }); // invalid type

        try {
            await POST(event);
            expect.fail('Should have thrown 400');
        } catch (e: any) {
            expect(e.status).toBe(400);
            expect(e.body.message).toContain('Invalid action. Must be upvote, downvote, or remove.');
        }
    });

    it('should reject interaction if target post does not exist', async () => {
        (db.query.posts.findFirst as vi.Mock).mockResolvedValue(null);

        const event = createMockEvent({ postId: 'ghost_post', action: 'upvote' });

        try {
            await POST(event);
            expect.fail('Should have thrown 404');
        } catch (e: any) {
            expect(e.status).toBe(404);
            expect(e.body.message).toContain('Post not found');
        }
    });

    it('should successfully handle an UPVOTE interaction', async () => {
        const event = createMockEvent({ postId: 'post-123', action: 'upvote' });
        const res = await POST(event);
        const data = await res.json();

        expect(data.success).toBe(true);
        expect(data.action).toBe('upvote');
        expect(db.insert).toHaveBeenCalled();
    });

    it('should successfully handle a DOWNVOTE interaction', async () => {
        const event = createMockEvent({ postId: 'post-123', action: 'downvote' });
        const res = await POST(event);
        const data = await res.json();

        expect(data.success).toBe(true);
        expect(data.action).toBe('downvote');
        expect(db.insert).toHaveBeenCalled();
    });

    it('should successfully handle a REMOVE interaction', async () => {
        const event = createMockEvent({ postId: 'post-123', action: 'remove' });
        const res = await POST(event);
        const data = await res.json();

        expect(data.success).toBe(true);
        expect(data.action).toBe('remove');
        expect(db.delete).toHaveBeenCalled();
    });
});
