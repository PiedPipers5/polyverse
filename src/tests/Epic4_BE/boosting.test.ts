import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { POST } from '../../routes/api/boost/+server';
import { db } from '$lib/server/db';
import { activities } from '$lib/server/db/schema';

// Mock DB
vi.mock('$lib/server/db', () => ({
    db: {
        insert: vi.fn(() => ({
            values: vi.fn(() => Promise.resolve({}))
        })),
        update: vi.fn(() => ({
            set: vi.fn(() => ({
                where: vi.fn(() => Promise.resolve({}))
            }))
        })),
        query: {
            activities: { findFirst: vi.fn() }
        }
    }
}));

// Mock Redis
vi.mock('$lib/server/redis', () => ({
    enqueueDelivery: vi.fn()
}));

const LOCAL_USER = { userId: 'user-1', username: 'alice' };

describe('Epic 4.3: Boosting (Re-sharing)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should successfully boost a post', async () => {
        const objectId = 'https://polyverse.test/users/bob/statuses/123';

        // Mock sequence:
        // 1. check if already boosted -> returns null
        // 2. find the original post -> returns the record
        (db.query.activities.findFirst as Mock)
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({
                id: 'original-activity-id',
                activity: {
                    id: objectId,
                    actor: 'https://polyverse.test/users/bob',
                    object: { id: objectId, type: 'Note', content: 'Original content' }
                }
            });

        const request = new Request('http://localhost/api/boost', {
            method: 'POST',
            body: JSON.stringify({ postId: objectId })
        });

        const event = {
            request,
            locals: { user: LOCAL_USER },
            json: () => request.json()
        } as any;

        const response = await POST(event);
        const data = await response.json();

        expect(response.status).toBe(201);
        expect(data.success).toBe(true);
        // Verify Announce activity generation - Story 4.3.1
        expect(db.insert).toHaveBeenCalledWith(activities);
    });

    it('should return 401 if not authenticated', async () => {
        const event = { locals: { user: null } } as any;
        try {
            await POST(event);
        } catch (e: any) {
            expect(e.status).toBe(401);
        }
    });
});
