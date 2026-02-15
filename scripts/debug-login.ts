import { db } from '../src/lib/server/db';
import { users } from '../src/lib/server/db/schema';
import { eq } from 'drizzle-orm';
import * as argon2 from 'argon2';
import { createToken } from '../src/lib/server/auth';

console.log('Testing login components...');

async function run() {
    // Test 1: DB connection
    try {
        console.log('Testing DB...');
        const user = await db.query.users.findFirst();
        console.log('DB Connection: OK', user ? `(Found user: ${user.username})` : '(No users found)');
    } catch (e) {
        console.error('DB Connection: FAIL', e);
    }

    // Test 2: Argon2
    try {
        console.log('Testing Argon2...');
        const hash = await argon2.hash('password');
        console.log('Argon2 Hashing: OK');
        const verify = await argon2.verify(hash, 'password');
        console.log('Argon2 Verification: OK', verify);
    } catch (e) {
        console.error('Argon2: FAIL', e);
    }

    // Test 3: JWT
    try {
        console.log('Testing JWT...');
        const token = await createToken({ userId: 'test', did: 'did:test', username: 'test' });
        console.log('JWT Creation: OK', token ? '(Token generated)' : '(No token)');
    } catch (e) {
        console.error('JWT Creation: FAIL', e);
    }
}

run();
