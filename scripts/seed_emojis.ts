import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as dotenv from 'dotenv';
import { customEmojis } from '../src/lib/server/db/schema';

dotenv.config();

if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
}

async function seed() {
    const client = neon(process.env.DATABASE_URL!);
    const db = drizzle(client);

    console.log('Creating custom_emojis table if not exists...');

    // Manually run SQL to ensure table exists (since db:push had issues)
    await client`
        CREATE TABLE IF NOT EXISTS "custom_emojis" (
            "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            "shortcode" text NOT NULL UNIQUE,
            "image_url" text NOT NULL,
            "created_at" timestamp DEFAULT now() NOT NULL
        );
    `;

    console.log('Seeding custom emojis...');

    const emojis = [
        {
            shortcode: ':blobcat:',
            imageUrl: 'https://api.iconify.design/noto:cat-face.svg'
        },
        {
            shortcode: ':meow_party:',
            imageUrl: 'https://raw.githubusercontent.com/Tarik0/Mastodon-Custom-Emoji-Pack/master/Meow/meow_party.gif'
        },
        {
            shortcode: ':polyverse:',
            imageUrl: 'https://raw.githubusercontent.com/Polyverse-Project/assets/main/logo.png'
        }
    ];

    for (const emoji of emojis) {
        try {
            await db.insert(customEmojis).values(emoji).onConflictDoNothing();
            console.log(`- Seeded ${emoji.shortcode}`);
        } catch (e) {
            console.error(`- Failed to seed ${emoji.shortcode}:`, e);
        }
    }

    console.log('Seeding complete!');
    process.exit(0);
}

seed().catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
});
