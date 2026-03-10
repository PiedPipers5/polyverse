import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../../routes/api/follow/+server';
import { db } from '$lib/server/db';
import { federatedFollows } from '$lib/server/db/schema';
import { resolveRemoteActor } from '$lib/server/federation';
import { enqueueDelivery } from '$lib/server/redis';

// Mock DB
vi.mock('$lib/server/db', () => ({
    db: {
        query: {
            users: { findFirst: vi.fn() },
            followers: { findFirst: vi.fn() },
            federatedFollows: { findFirst: vi.fn() }
        },
        insert: vi.fn(() => ({
            values: vi.fn(() => Promise.resolve({}))
        }))
    }
}));

// Mock Federation
vi.mock('$lib/server/federation', () => ({
    resolveRemoteActor: vi.fn()
}));

// Mock Redis
vi.mock('$lib/server/redis', () => ({
    enqueueDelivery: vi.fn()
}));

// Mock env
vi.mock('$env/dynamic/private', () => ({
    env: {
        DOMAIN: 'polyverse.test'
    }
}));

const LOCAL_USER = { userId: 'user-1', username: 'alice', did: 'did:web:alice' };

describe('Epic 3.2: Following Remote Users (Handshake)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should successfully initiate a federated follow', async () => {
        const handle = '@bob@remote.social';
        const remoteActor = {
            id: 'https://remote.social/users/bob',
            inbox: 'https://remote.social/users/bob/inbox'
        };

        (resolveRemoteActor as vi.Mock).mockResolvedValue({ actor: remoteActor });
        (db.query.federatedFollows.findFirst as vi.Mock).mockResolvedValue(null);

        const request = new Request('http://localhost/api/follow', {
            method: 'POST',
            body: JSON.stringify({ handle })
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
        expect(data.status).toBe('pending');

        // Verify DB update - Task 3.2.4
        expect(db.insert).toHaveBeenCalledWith(federatedFollows);

        // Verify Redis queueing - Task 3.2.2
        expect(enqueueDelivery).toHaveBeenCalledWith(expect.objectContaining({
            inbox: remoteActor.inbox,
            actorUsername: LOCAL_USER.username
        }));
    });

    it('should return 409 if follow is already pending', async () => {
        const handle = '@bob@remote.social';
        (resolveRemoteActor as vi.Mock).mockResolvedValue({ actor: { id: 'uri', inbox: 'inbox' } });
        (db.query.federatedFollows.findFirst as vi.Mock).mockResolvedValue({ status: 'pending' });

        const event = {
            request: new Request('http://localhost/api/follow', {
                method: 'POST',
                body: JSON.stringify({ handle })
            }),
            locals: { user: LOCAL_USER }
        } as any;

        try {
            await POST(event);
        } catch (e: any) {
            expect(e.status).toBe(409);
            expect(e.body.message).toContain('already pending');
        }
    });

    it('should return 404 if remote actor cannot be resolved', async () => {
        const handle = '@missing@remote.social';
        (resolveRemoteActor as vi.Mock).mockResolvedValue(null);

        const event = {
            request: new Request('http://localhost/api/follow', {
                method: 'POST',
                body: JSON.stringify({ handle })
            }),
            locals: { user: LOCAL_USER }
        } as any;

        try {
            await POST(event);
        } catch (e: any) {
            expect(e.status).toBe(404);
        }
    });
});
