import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../../routes/inbox/+server';
import { getFactory } from '$lib/server/redis/instance';

// Mock Redis Instance
vi.mock('$lib/server/redis/instance', () => ({
    getFactory: vi.fn()
}));

const MOCK_CLIENT = {
    lpush: vi.fn().mockResolvedValue(1)
};

const MOCK_REDIS = {
    getClient: vi.fn(() => MOCK_CLIENT)
};

const SHARED_INBOX_ACTIVITY = {
    id: 'https://remote.social/activities/1',
    type: 'Create',
    actor: 'https://remote.social/users/bob',
    object: { type: 'Note', content: 'Hello everyone!' }
};

describe('Epic 3.4: Shared Inbox Optimization', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (getFactory as any).mockReturnValue(MOCK_REDIS);
    });

    it('should successfully enqueue activity to Redis', async () => {
        const request = new Request('http://localhost/inbox', {
            method: 'POST',
            body: JSON.stringify(SHARED_INBOX_ACTIVITY)
        });

        const event = {
            request,
            json: () => request.json()
        } as any;

        const response = await POST(event);
        expect(response.status).toBe(202);

        expect(MOCK_CLIENT.lpush).toHaveBeenCalledWith(
            'polyverse:shared_inbox_queue',
            JSON.stringify(SHARED_INBOX_ACTIVITY)
        );
    });

    it('should return 400 for invalid ActivityPub object', async () => {
        const invalidActivity = { type: 'Create' }; // Missing id
        const request = new Request('http://localhost/inbox', {
            method: 'POST',
            body: JSON.stringify(invalidActivity)
        });

        const event = { request } as any;
        const response = await POST(event);
        expect(response.status).toBe(400);
    });
});
