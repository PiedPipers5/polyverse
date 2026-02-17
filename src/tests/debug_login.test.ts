import { describe, it, expect } from "bun:test";
import { db } from '../lib/server/db';
import { users } from '../lib/server/db/schema';
import * as argon2 from 'argon2';
import { createToken } from '../lib/server/auth';

describe("Debug Login Components", () => {
    it("should connect to DB", async () => {
        try {
            const user = await db.query.users.findFirst();
            console.log('DB Connection: OK. User found:', user?.username);
            console.log('DID Document:', JSON.stringify(user?.didDocument, null, 2));
            if (user && user.didDocument) {
                const did = (user.didDocument as { id: string }).id;
                console.log('Extracted DID:', did);
            }
            expect(true).toBe(true);
        } catch (e) {
            console.error('DB Connection FAIL:', e);
            throw e;
        }
    });

    it("should hash and verify password", async () => {
        try {
            const hash = await argon2.hash('password');
            const verify = await argon2.verify(hash, 'password');
            console.log('Argon2: OK');
            expect(verify).toBe(true);
        } catch (e) {
            console.error('Argon2 FAIL:', e);
            throw e;
        }
    });

    it("should create JWT", async () => {
        try {
            const token = await createToken({ userId: 'test', did: 'did:test', username: 'test' });
            console.log('JWT: OK. Token:', token);
            expect(token).toBeDefined();
        } catch (e) {
            console.error('JWT FAIL:', e);
            throw e;
        }
    });
});
