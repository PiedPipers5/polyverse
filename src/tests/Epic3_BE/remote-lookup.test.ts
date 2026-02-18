// src/tests/Epic3_BE/remote-lookup.test.ts
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import nock from 'nock';
import { resolveRemoteActor, parseHandle, lookupWebFinger, fetchRemoteActor } from '$lib/server/federation';
import { db } from '$lib/server/db';
import { remoteActors } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { error } from '@sveltejs/kit'; // For error testing

// Mock environment variables
vi.mock('$env/dynamic/private', () => ({
    env: {
        DOMAIN: 'test.com'
    }
}));

// Mock database
vi.mock('$lib/server/db', () => ({
    db: {
        query: {
            remoteActors: { findFirst: vi.fn() }
        },
        insert: vi.fn(() => ({
            values: vi.fn(() => ({
                returning: vi.fn(() => Promise.resolve([{ id: 'mock-cache-id' }]))
            }))
        })),
        update: vi.fn(() => ({
            set: vi.fn(() => ({
                where: vi.fn(() => ({
                    returning: vi.fn(() => Promise.resolve([{ id: 'mock-cache-id' }]))
                }))
            }))
        }))
    }
}));

const TEST_USERNAME = 'gargron';
const TEST_DOMAIN = 'mastodon.social';
const TEST_HANDLE = `${TEST_USERNAME}@${TEST_DOMAIN}`;
const TEST_ACTOR_URL = `https://${TEST_DOMAIN}/users/${TEST_USERNAME}`;

const MOCK_WEBFINGER_JRD = {
    subject: `acct:${TEST_HANDLE}`,
    links: [
        {
            rel: 'self',
            type: 'application/activity+json',
            href: TEST_ACTOR_URL
        },
        {
            rel: 'http://webfinger.net/rel/profile-page',
            type: 'text/html',
            href: `https://${TEST_DOMAIN}/@${TEST_USERNAME}`
        }
    ]
};

const MOCK_ACTOR_JSON = {
    '@context': ['https://www.w3.org/ns/activitystreams', 'https://w3id.org/security/v1'],
    id: TEST_ACTOR_URL,
    type: 'Person',
    preferredUsername: TEST_USERNAME,
    name: 'Eugen Rochko',
    summary: 'Developer of Mastodon.',
    inbox: `${TEST_ACTOR_URL}/inbox`,
    outbox: `${TEST_ACTOR_URL}/outbox`,
    followers: `${TEST_ACTOR_URL}/followers`,
    following: `${TEST_ACTOR_URL}/following`,
    publicKey: {
        id: `${TEST_ACTOR_URL}#main-key`,
        owner: TEST_ACTOR_URL,
        publicKeyPem: '-----BEGIN PUBLIC KEY-----...'
    }
};

describe('Epic 3.1 Backend Tasks: Remote User Lookup', () => {
    beforeAll(() => {
        nock.activate(); // Activate nock before all tests
    });

    afterAll(() => {
        nock.restore(); // Restore original http capabilities after all tests
    });

    beforeEach(() => {
        vi.clearAllMocks();
        nock.cleanAll(); // Clean up all active mocks before each test
        // Set up default mock for db.query.remoteActors.findFirst to simulate no cache
        (db.query.remoteActors.findFirst as vi.Mock).mockResolvedValue(undefined);
    });

    afterEach(() => {
        nock.cleanAll(); // Ensure no pending mocks affect other tests
    });

    // --- Task 3.1.2 (BE): Implement the lookup service (WebFinger) ---
    describe('lookupWebFinger', () => {
        it('should successfully retrieve actor URL from WebFinger', async () => {
            nock(`https://${TEST_DOMAIN}`)
                .get('/.well-known/webfinger')
                .query({ resource: `acct:${TEST_HANDLE}` })
                .reply(200, MOCK_WEBFINGER_JRD, { 'Content-Type': 'application/jrd+json' });

            const actorUrl = await lookupWebFinger(TEST_USERNAME, TEST_DOMAIN);
            expect(actorUrl).toBe(TEST_ACTOR_URL);
            expect(nock.isDone()).toBe(true); // Ensure the mock was consumed
        });

        it('should return null if WebFinger lookup fails (e.g., 404)', async () => {
            nock(`https://${TEST_DOMAIN}`)
                .get('/.well-known/webfinger')
                .query({ resource: `acct:${TEST_HANDLE}` })
                .reply(404, 'Not Found');

            const actorUrl = await lookupWebFinger(TEST_USERNAME, TEST_DOMAIN);
            expect(actorUrl).toBeNull();
            expect(nock.isDone()).toBe(true);
        });

        it('should return null if no ActivityPub link is found', async () => {
            nock(`https://${TEST_DOMAIN}`)
                .get('/.well-known/webfinger')
                .query({ resource: `acct:${TEST_HANDLE}` })
                .reply(200, {
                    subject: `acct:${TEST_HANDLE}`,
                    links: [{ rel: 'profile', type: 'text/html', href: 'some-url' }]
                }, { 'Content-Type': 'application/jrd+json' });

            const actorUrl = await lookupWebFinger(TEST_USERNAME, TEST_DOMAIN);
            expect(actorUrl).toBeNull();
            expect(nock.isDone()).toBe(true);
        });

        it('should handle network errors during WebFinger lookup', async () => {
            nock(`https://${TEST_DOMAIN}`)
                .get('/.well-known/webfinger')
                .query({ resource: `acct:${TEST_HANDLE}` })
                .delay(10000) // Simulate timeout
                .reply(200, MOCK_WEBFINGER_JRD, { 'Content-Type': 'application/jrd+json' });

            const actorUrl = await lookupWebFinger(TEST_USERNAME, TEST_DOMAIN);
            expect(actorUrl).toBeNull(); // Because of the 10s AbortSignal timeout
        }, 15000); // Increase Vitest timeout for this test
    });

    // --- Task 3.1.3 (BE): Fetch the remote Actor ---
    describe('fetchRemoteActor', () => {
        it('should successfully fetch the remote Actor JSON', async () => {
            nock(`https://${TEST_DOMAIN}`)
                .get(`/users/${TEST_USERNAME}`)
                .reply(200, MOCK_ACTOR_JSON, { 'Content-Type': 'application/activity+json' });

            const actor = await fetchRemoteActor(TEST_ACTOR_URL);
            expect(actor).toEqual(MOCK_ACTOR_JSON);
            expect(nock.isDone()).toBe(true);
        });

        it('should return null if fetching Actor fails (e.g., 404)', async () => {
            nock(`https://${TEST_DOMAIN}`)
                .get(`/users/${TEST_USERNAME}`)
                .reply(404, 'Not Found');

            const actor = await fetchRemoteActor(TEST_ACTOR_URL);
            expect(actor).toBeNull();
            expect(nock.isDone()).toBe(true);
        });

        it('should return null if fetched Actor is invalid/missing fields', async () => {
            nock(`https://${TEST_DOMAIN}`)
                .get(`/users/${TEST_USERNAME}`)
                .reply(200, { id: 'test', type: 'Person' }, { 'Content-Type': 'application/activity+json' }); // Missing inbox

            const actor = await fetchRemoteActor(TEST_ACTOR_URL);
            expect(actor).toBeNull();
            expect(nock.isDone()).toBe(true);
        });
    });

    // --- Task 3.1.4 (BE): Cache the remote Actor (via resolveRemoteActor) ---
    describe('resolveRemoteActor with caching', () => {
        const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // From federation.ts

        it('should fetch and cache if no entry exists', async () => {
            nock(`https://${TEST_DOMAIN}`)
                .get('/.well-known/webfinger')
                .query({ resource: `acct:${TEST_HANDLE}` })
                .reply(200, MOCK_WEBFINGER_JRD, { 'Content-Type': 'application/jrd+json' });

            nock(`https://${TEST_DOMAIN}`)
                .get(`/users/${TEST_USERNAME}`)
                .reply(200, MOCK_ACTOR_JSON, { 'Content-Type': 'application/activity+json' });

            // Ensure insert is called
            (db.insert as vi.Mock).mockReturnValue({
                values: vi.fn().mockReturnValue({
                    returning: vi.fn().mockResolvedValue([{ id: 'new-cache-id' }])
                })
            });

            const result = await resolveRemoteActor(TEST_HANDLE);

            expect(result?.actor).toEqual(MOCK_ACTOR_JSON);
            expect(result?.cached).toBe(false);
            expect(db.insert).toHaveBeenCalledWith(remoteActors);
            expect((db.insert as vi.Mock).mock.calls[0][0]).toEqual(remoteActors);
            expect((db.insert as vi.Mock).mock.calls[0][1].values.mock.calls[0][0]).toEqual({
                handle: TEST_HANDLE,
                actorUri: TEST_ACTOR_URL,
                domain: TEST_DOMAIN,
                actorJson: MOCK_ACTOR_JSON,
                fetchedAt: expect.any(Date)
            });
            expect(nock.isDone()).toBe(true);
        });

        it('should return cached actor if fresh', async () => {
            const cachedActor = {
                handle: TEST_HANDLE,
                actorUri: TEST_ACTOR_URL,
                domain: TEST_DOMAIN,
                actorJson: MOCK_ACTOR_JSON,
                fetchedAt: new Date(Date.now() - CACHE_TTL_MS + 1000) // 1 second before expiry
            };
            (db.query.remoteActors.findFirst as vi.Mock).mockResolvedValue(cachedActor);

            const result = await resolveRemoteActor(TEST_HANDLE);

            expect(result?.actor).toEqual(MOCK_ACTOR_JSON);
            expect(result?.cached).toBe(true);
            expect(db.insert).not.toHaveBeenCalled(); // No insert/update
            expect(db.update).not.toHaveBeenCalled(); // No insert/update
            expect(nock.pendingMocks().length).toBe(0); // No network requests
        });

        it('should refetch and update cache if stale', async () => {
            const cachedActor = {
                handle: TEST_HANDLE,
                actorUri: TEST_ACTOR_URL,
                domain: TEST_DOMAIN,
                actorJson: { ...MOCK_ACTOR_JSON, name: 'Stale Eugen' },
                fetchedAt: new Date(Date.now() - CACHE_TTL_MS - 1000) // 1 second after expiry
            };
            (db.query.remoteActors.findFirst as vi.Mock).mockResolvedValue(cachedActor);

            nock(`https://${TEST_DOMAIN}`)
                .get('/.well-known/webfinger')
                .query({ resource: `acct:${TEST_HANDLE}` })
                .reply(200, MOCK_WEBFINGER_JRD, { 'Content-Type': 'application/jrd+json' });

            nock(`https://${TEST_DOMAIN}`)
                .get(`/users/${TEST_USERNAME}`)
                .reply(200, MOCK_ACTOR_JSON, { 'Content-Type': 'application/activity+json' });

            // Ensure update is called
            (db.update as vi.Mock).mockReturnValue({
                set: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        returning: vi.fn().mockResolvedValue([{ id: 'updated-cache-id' }])
                    })
                })
            });

            const result = await resolveRemoteActor(TEST_HANDLE);

            expect(result?.actor).toEqual(MOCK_ACTOR_JSON); // Should be fresh data
            expect(result?.cached).toBe(false);
            expect(db.update).toHaveBeenCalledWith(remoteActors);
            expect((db.update as vi.Mock).mock.calls[0][0]).toEqual(remoteActors);
            expect((db.update as vi.Mock).mock.calls[0][1].set.mock.calls[0][0]).toEqual({
                actorJson: MOCK_ACTOR_JSON,
                actorUri: TEST_ACTOR_URL,
                fetchedAt: expect.any(Date)
            });
            expect(nock.isDone()).toBe(true);
        });

        it('should return null if webfinger fails during resolve', async () => {
            (db.query.remoteActors.findFirst as vi.Mock).mockResolvedValue(undefined); // No cache

            nock(`https://${TEST_DOMAIN}`)
                .get('/.well-known/webfinger')
                .query({ resource: `acct:${TEST_HANDLE}` })
                .reply(404, 'Not Found');

            const result = await resolveRemoteActor(TEST_HANDLE);
            expect(result).toBeNull();
            expect(nock.isDone()).toBe(true);
        });

        it('should return null if actor fetch fails during resolve', async () => {
            (db.query.remoteActors.findFirst as vi.Mock).mockResolvedValue(undefined); // No cache

            nock(`https://${TEST_DOMAIN}`)
                .get('/.well-known/webfinger')
                .query({ resource: `acct:${TEST_HANDLE}` })
                .reply(200, MOCK_WEBFINGER_JRD, { 'Content-Type': 'application/jrd+json' });

            nock(`https://${TEST_DOMAIN}`)
                .get(`/users/${TEST_USERNAME}`)
                .reply(500, 'Server Error'); // Actor fetch fails

            const result = await resolveRemoteActor(TEST_HANDLE);
            expect(result).toBeNull();
            expect(nock.isDone()).toBe(true);
        });
    });
});
