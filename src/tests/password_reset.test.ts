import { describe, it, expect } from "bun:test";
import { db } from '../lib/server/db';
import { users } from '../lib/server/db/schema';
import { eq, and, gt } from 'drizzle-orm';
import crypto from 'crypto';
import * as argon2 from 'argon2';

describe("Password Reset Logic", () => {
    it("should generate and store a reset token", async () => {
        // Find existing user or create one for test
        let user = await db.query.users.findFirst();
        if (!user) {
            console.log("No user found for test, skipping...");
            return;
        }

        const token = crypto.randomBytes(32).toString('hex');
        const expires = new Date(Date.now() + 3600000);

        await db.update(users)
            .set({ resetPasswordToken: token, resetPasswordExpires: expires })
            .where(eq(users.id, user.id));

        const updatedUser = await db.query.users.findFirst({
            where: eq(users.id, user.id)
        });

        expect(updatedUser?.resetPasswordToken).toBe(token);
        expect(updatedUser?.resetPasswordExpires).toBeDefined();
    });

    it("should validate a token and update password", async () => {
        const user = await db.query.users.findFirst();
        if (!user || !user.resetPasswordToken) return;

        const newPassword = "NewPassword123!";
        const passwordHash = await argon2.hash(newPassword);

        // Simulate reset-password action logic
        const validUser = await db.query.users.findFirst({
            where: and(
                eq(users.resetPasswordToken, user.resetPasswordToken),
                gt(users.resetPasswordExpires, new Date())
            )
        });

        expect(validUser).toBeDefined();

        await db.update(users)
            .set({
                passwordHash,
                resetPasswordToken: null,
                resetPasswordExpires: null
            })
            .where(eq(users.id, user.id));

        const finalUser = await db.query.users.findFirst({
            where: eq(users.id, user.id)
        });

        expect(finalUser?.resetPasswordToken).toBeNull();
        expect(await argon2.verify(finalUser!.passwordHash, newPassword)).toBe(true);
    });
});
