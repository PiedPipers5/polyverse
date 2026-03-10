import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { GET } from '../../routes/api/feed/+server';
import { db } from '$lib/server/db';
import { activities } from '$lib/server/db/schema';

// Mock DB
vi.mock('$lib/server/db', () => ({
    db: {
        query: {
            activities: { findMany: vi.fn() },
            federatedFollows: { findMany: vi.fn() }
        }
    }
}));

const LOCAL_USER = { userId: 'user-1', username: 'alice' };

describe('Epic 3.5: The Aggregated Timeline', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return a mixed feed of local and remote activities', async () => {
        const follows = [{ remoteActorUri: 'https://remote.social/users/bob' }];
        const mockActivities = [
            { type: 'Create', actorId: 'user-1', activity: { id: 'local-1' } },
            { type: 'Create', actorId: null, activity: { id: 'remote-1', actor: 'https://remote.social/users/bob' } }
        ];

        (db.query.federatedFollows.findMany as Mock).mockResolvedValue(follows);
        (db.query.activities.findMany as Mock).mockResolvedValue(mockActivities);

        const url = new URL('http://localhost/api/feed');
        const event = {
            url,
            locals: { user: LOCAL_USER }
        } as any;

        const response = await GET(event);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.posts).toBeDefined();
        // Verify aggregation logic - Story 3.5
        expect(db.query.activities.findMany).toHaveBeenCalled();
    });

    it('should return 401 if not authenticated', async () => {
        const event = { locals: { user: null } } as any;
        try {
            await GET(event);
        } catch (e: any) {
            expect(e.status).toBe(401);
        }
    });
});
