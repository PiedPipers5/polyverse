import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '../../routes/api/comments/[postId]/+server';
import { db } from '$lib/server/db';

// Mock the database
vi.mock('$lib/server/db', () => ({
    db: {
        query: {
            activities: { findMany: vi.fn() },
            users: { findMany: vi.fn() },
            interactions: { findMany: vi.fn() }
        }
    }
}));

// Mock SvelteKit error locally
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

// Helper mock generator
function createMockEvent(postId: string, userId: string | null = 'test-user') {
    return {
        params: { postId },
        locals: {
            user: userId ? { userId, username: 'tester', did: 'did:web:test' } : null
        }
    } as any;
}

describe('Epic 4 - Comments API Service (/api/comments/[postId])', () => {

    beforeEach(() => {
        vi.clearAllMocks();

        // Default: No Users
        (db.query.users.findMany as vi.Mock).mockResolvedValue([
            { id: 'u1', username: 'alice', displayName: 'Alice A.', avatarUrl: '/alice.png' },
            { id: 'u2', username: 'bob', displayName: 'Bob B.', avatarUrl: '/bob.png' }
        ]);

        // Default: No Interactions
        (db.query.interactions.findMany as vi.Mock).mockResolvedValue([]);
    });

    it('should return an empty array and total 0 for a post with no comments', async () => {
        (db.query.activities.findMany as vi.Mock).mockResolvedValue([]); // No activities

        const event = createMockEvent('post-123');
        const res = await GET(event);
        const data = await res.json();

        expect(data.comments).toEqual([]);
        expect(data.total).toBe(0);
        expect(db.query.activities.findMany).toHaveBeenCalled();
    });

    it('should build a nested threaded comment tree correctly', async () => {
        const mockDate = new Date();
        const mockActivities = [
            // Top level comment
            {
                id: 'act-1',
                actorId: 'u1',
                createdAt: mockDate,
                activity: {
                    object: {
                        id: 'comment-1',
                        type: 'Note',
                        content: 'First comment!',
                        inReplyTo: 'post-123',
                        tag: []
                    }
                }
            },
            // Reply to the top-level comment
            {
                id: 'act-2',
                actorId: 'u2',
                createdAt: new Date(mockDate.getTime() - 1000), // Slightly older logic sorting
                activity: {
                    object: {
                        id: 'comment-2',
                        type: 'Note',
                        content: 'A thoughtful reply to comment 1',
                        inReplyTo: 'comment-1',
                        tag: []
                    }
                }
            }
        ];

        (db.query.activities.findMany as vi.Mock).mockResolvedValue(mockActivities);
        (db.query.interactions.findMany as vi.Mock).mockResolvedValue([]);

        const event = createMockEvent('post-123');
        const res = await GET(event);
        const data = await res.json();

        expect(data.total).toBe(2);

        // Assert Top Level
        expect(data.comments.length).toBe(1);
        expect(data.comments[0].id).toBe('comment-1');
        expect(data.comments[0].author.username).toBe('alice');

        // Assert Reply Thread nesting
        expect(data.comments[0].replies.length).toBe(1);
        expect(data.comments[0].replies[0].id).toBe('comment-2');
        expect(data.comments[0].replies[0].author.username).toBe('bob');
        expect(data.comments[0].replies[0].content).toBe('A thoughtful reply to comment 1');
    });

    it('should aggregate votes (net score) correctly on comments', async () => {
        const mockActivities = [{
            id: 'act-1',
            actorId: 'u1',
            createdAt: new Date(),
            activity: {
                object: {
                    id: 'comment-1',
                    inReplyTo: 'post-123',
                }
            }
        }];

        const mockInteractions = [
            { postId: 'comment-1', actorId: 'ux1', type: 'upvote' },
            { postId: 'comment-1', actorId: 'uy2', type: 'upvote' },
            { postId: 'comment-1', actorId: 'uz3', type: 'downvote' },
        ]; // Net should be 1. User vote should be null because current user is 'test-user'

        (db.query.activities.findMany as vi.Mock).mockResolvedValue(mockActivities);
        (db.query.interactions.findMany as vi.Mock).mockResolvedValue(mockInteractions);

        const event = createMockEvent('post-123');
        const res = await GET(event);
        const data = await res.json();

        expect(data.comments[0].netScore).toBe(1); // 2 up - 1 down
        expect(data.comments[0].userVote).toBeNull(); // Hasn't voted
    });

    it('should identify the current users vote on a comment', async () => {
        const mockActivities = [{
            id: 'act-1',
            actorId: 'u1',
            createdAt: new Date(),
            activity: {
                object: {
                    id: 'comment-1',
                    inReplyTo: 'post-123',
                }
            }
        }];

        const mockInteractions = [
            { postId: 'comment-1', actorId: 'test-user', type: 'downvote' }
        ];

        (db.query.activities.findMany as vi.Mock).mockResolvedValue(mockActivities);
        (db.query.interactions.findMany as vi.Mock).mockResolvedValue(mockInteractions);

        const event = createMockEvent('post-123', 'test-user'); // Signed in as 'test-user'
        const res = await GET(event);
        const data = await res.json();

        expect(data.comments[0].userVote).toBe('downvote');
        expect(data.comments[0].netScore).toBe(-1);
    });
});
