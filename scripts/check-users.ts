import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
    console.error('DATABASE_URL environment variable is not set');
    process.exit(1);
}

const sql = neon(DATABASE_URL);

async function checkUsers() {
    try {
        const users = await sql`SELECT username, id FROM users LIMIT 5`;
        console.log('Existing users:');
        console.log(users);
        
        const activities = await sql`SELECT COUNT(*) as count FROM activities`;
        console.log('\nTotal activities:', activities[0].count);
    } catch (error) {
        console.error('Error:', error);
    }
}

checkUsers();
