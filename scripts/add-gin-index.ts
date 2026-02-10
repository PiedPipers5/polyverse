import { neon } from '@neondatabase/serverless';

// Load environment variables
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
    console.error('DATABASE_URL environment variable is not set');
    process.exit(1);
}

const sql = neon(DATABASE_URL);

async function createGinIndex() {
    try {
        console.log('Creating GIN index on activities.activity column...');
        
        await sql`
            CREATE INDEX IF NOT EXISTS activities_activity_gin_idx 
            ON activities USING gin (activity)
        `;
        
        console.log('✓ GIN index created successfully!');
    } catch (error) {
        console.error('Error creating GIN index:', error);
        process.exit(1);
    }
}

createGinIndex();
