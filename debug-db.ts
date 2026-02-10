
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from './src/lib/server/db/schema';
import { eq } from 'drizzle-orm';

const client = neon(process.env.DATABASE_URL!);
const db = drizzle(client, { schema });

async function main() {
    console.log('Fetching users...');
    const allUsers = await db.select().from(schema.users);
    console.log('Users found:', allUsers.length);
    console.log('Sample user:', allUsers[0]);

    if (allUsers.length > 0) {
        console.log('Fetching activities for first user...');
        const userActivities = await db.query.activities.findMany({
            limit: 5,
        });
        console.log('Activities found:', userActivities.length);
        userActivities.forEach((a, i) => {
            console.log(`Activity ${i}:`, JSON.stringify(a, null, 2));
            try {
                const content = (a.activityJson as any).object.content;
                console.log(`- Parsed content: ${content}`);
            } catch (e) {
                console.error(`- Failed to parse content for activity ${a.id}:`, e);
            }
        });
    }
}

main().catch(console.error);
