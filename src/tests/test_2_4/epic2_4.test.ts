import { describe, it, expect, mock, beforeEach } from "bun:test";
import type { RequestEvent } from "@sveltejs/kit";

// Define strict types for our test usages
interface RouteParams extends Record<string, string> {
    username: string;
}

// The specific RequestEvent type expected by the handler
type OutboxEvent = RequestEvent<RouteParams, "/users/[username]/outbox">;

interface ActivityObject {
    id: string;
    content: string;
    to: string[];
    cc: string[];
}

interface MockActivity {
    id: string;
    object: ActivityObject;
}

interface DbActivity {
    id: string;
    activity: MockActivity;
    type: string;
}

// Mock DB interactions to prevent real DB writes
// We use mock.module to intercept imports of $lib/server/db
const mockInsert = mock(() => ({ values: mock(() => Promise.resolve()) }));
const mockUpdate = mock(() => ({ set: mock(() => ({ where: mock(() => Promise.resolve()) })) }));
const mockFindMany = mock(() => Promise.resolve<DbActivity[]>([]));
const mockFindFirst = mock(() => Promise.resolve(null));

const mockTx = {
    insert: mockInsert,
    update: mockUpdate
};
const mockTransaction = mock(async (cb: (tx: typeof mockTx) => Promise<void>) => await cb(mockTx));

mock.module("$lib/server/db", () => ({
    db: {
        insert: mockInsert,
        update: mockUpdate,
        query: {
            activities: {
                findMany: mockFindMany,
                findFirst: mockFindFirst
            },
            users: { findFirst: mockFindFirst },
            followers: { findFirst: mockFindFirst }
        },
        transaction: mockTransaction
    }
}));

mock.module("$lib/server/db/schema", () => ({
    activities: { name: 'activities' },
    users: { name: 'users' },
    followers: { name: 'followers' }
}));



// Import the handler dynamically to ensure mocks are applied first
const { POST } = await import("../../routes/users/[username]/outbox/+server");

describe("Epic 2.4: Outbox Actions (Edit/Delete)", () => {
    // Setup request context
    const user = { userId: "user-123", username: "alice" };
    const locals = { user };
    const params: RouteParams = { username: "alice" };

    beforeEach(() => {
        // Clear mocks before each test
        mockInsert.mockClear();
        mockUpdate.mockClear();
        mockFindMany.mockClear();
        mockTransaction.mockClear();
    });

    it("should process 'edit' action correctly", async () => {
        const objectId = "https://polyverse.local/users/alice/statuses/note-1";

        // Mock finding the original post in DB
        const originalActivity: MockActivity = {
            id: "activity-original",
            object: {
                id: objectId,
                content: "Old Content",
                to: ["public"],
                cc: []
            }
        };

        const dbResult: DbActivity[] = [{
            id: "db-id-1",
            activity: originalActivity,
            type: "Create" // Original creation activity
        }];

        mockFindMany.mockResolvedValueOnce(dbResult);

        const request = new Request("http://localhost/users/alice/outbox", {
            method: "POST",
            body: JSON.stringify({
                action: "edit",
                objectId: objectId,
                content: "New Content"
            })
        });

        // Construct event with proper typing
        // We cast to unknown first because RequestEvent is complex to fully mock, 
        // but we ensure params matches RouteParams and the route ID matches expected type
        const event = { request, locals, params } as unknown as OutboxEvent;
        const response = await POST(event);

        expect(response.status).toBe(201);

        // Verify DB update logic
        // 1. Transaction started
        expect(mockTransaction).toHaveBeenCalled();
        // 2. Original activity updated in DB (to reflect new content)
        expect(mockUpdate).toHaveBeenCalled();
        // 3. New 'Update' activity inserted
        expect(mockInsert).toHaveBeenCalled();
    });

    it("should process 'delete' action correctly", async () => {
        const objectId = "https://polyverse.local/users/alice/statuses/note-to-delete";

        const originalActivity: MockActivity = {
            id: "activity-delete-target",
            object: {
                id: objectId,
                content: "Delete me",
                to: ["public"],
                cc: []
            }
        };

        const dbResult: DbActivity[] = [{
            id: "db-id-2",
            activity: originalActivity,
            type: "Create"
        }];

        mockFindMany.mockResolvedValueOnce(dbResult);

        const request = new Request("http://localhost/users/alice/outbox", {
            method: "POST",
            body: JSON.stringify({
                action: "delete",
                objectId: objectId
            })
        });

        const event = { request, locals, params } as unknown as OutboxEvent;
        const response = await POST(event);

        expect(response.status).toBe(200);

        // Verify DB update logic
        expect(mockTransaction).toHaveBeenCalled();
        // 1. Original activity updated to Tombstone
        expect(mockUpdate).toHaveBeenCalled();
        // 2. New 'Delete' activity inserted
        expect(mockInsert).toHaveBeenCalled();
    });

    it("should throw error if trying to edit someone else's post", async () => {
        const objectId = "https://polyverse.local/users/bob/statuses/bob-note";

        // Mock finding NO post for 'alice' that matches this ID
        // (Because the query filters by actor being the current user)
        mockFindMany.mockResolvedValueOnce([]);

        const request = new Request("http://localhost/users/alice/outbox", {
            method: "POST",
            body: JSON.stringify({
                action: "edit",
                objectId: objectId,
                content: "Hacked"
            })
        });

        const event = { request, locals, params } as unknown as OutboxEvent;

        // Expect it to fail (likely 400 or 403, implementation throws error())
        expect(async () => await POST(event)).toThrow();
    });
});
