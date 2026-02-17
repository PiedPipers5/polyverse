import { describe, it } from "bun:test";
import { db } from '../lib/server/db';
import { users, activities } from '../lib/server/db/schema';
import { eq } from 'drizzle-orm';

// Mocking needed modules if any deeper imports fail, but relative import of db should work if env is mocked by setup.ts
// setup.ts mocks $env/dynamic/private

describe("Dump DB Data", () => {
    it("should dump user activities", async () => {
        const username = 'kavinraj_95';
        console.log(`Fetching activities for ${username}...`);

        const user = await db.query.users.findFirst({
            where: eq(users.username, username)
        });

        if (!user) {
            console.error('User not found');
            return;
        }

        console.log(`User ID: ${user.id}`);

        const acts = await db.query.activities.findMany({
            where: eq(activities.actorId, user.id),
            limit: 10
        });

        console.log(`Found ${acts.length} activities.`);
        acts.forEach(a => {
            const payload = a.activity as any;
            console.log('------------------------------------------------');
            console.log(`DB ID: ${a.id}`);
            console.log(`Type: ${a.type} (Payload type: ${payload.type})`);
            console.log(`Activity ID: ${payload.id}`);
            if (payload.object) {
                console.log(`Object ID (Note ID): ${payload.object.id}`);
                console.log(`Object Content: ${payload.object.content}`);
            } else {
                console.log('No object property');
            }
        });
    });
});
