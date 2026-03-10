import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { POST as blockPOST } from '../../routes/api/moderation/block/+server';
import { POST as reportPOST } from '../../routes/api/moderation/report/+server';
import { db } from '$lib/server/db';
import { activities } from '$lib/server/db/schema';

// Mock DB
vi.mock('$lib/server/db', () => ({
    db: {
        query: {
            users: { findFirst: vi.fn() }
        },
        insert: vi.fn(() => ({
            values: vi.fn(() => Promise.resolve({}))
        })),
        update: vi.fn(() => ({
            set: vi.fn(() => ({
                where: vi.fn(() => Promise.resolve({}))
            }))
        }))
    }
}));

const LOCAL_USER = { userId: 'user-1', username: 'alice' };

describe('Epic 5.2 & 5.3: Moderation (Blocking & Reporting)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Blocking', () => {
        it('should successfully block a user', async () => {
            const targetUsername = 'spammer';
            (db.query.users.findFirst as Mock).mockResolvedValue({ id: 'user-spammer' });

            const request = new Request('http://localhost/api/moderation/block', {
                method: 'POST',
                body: JSON.stringify({ targetUsername })
            });

            const event = {
                request,
                locals: { user: LOCAL_USER },
                json: () => request.json()
            } as any;

            const response = await blockPOST(event);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(db.insert).toHaveBeenCalledWith(activities);
        });
    });

    describe('Reporting', () => {
        it('should successfully report a post', async () => {
            const postId = 'post-123';
            const reason = 'Harassment';

            const request = new Request('http://localhost/api/moderation/report', {
                method: 'POST',
                body: JSON.stringify({ postId, reason })
            });

            const event = {
                request,
                locals: { user: LOCAL_USER },
                json: () => request.json()
            } as any;

            const response = await reportPOST(event);
            const data = await response.json();

            expect(response.status).toBe(201);
            expect(data.success).toBe(true);
            expect(db.insert).toHaveBeenCalledWith(activities);
        });
    });
});
