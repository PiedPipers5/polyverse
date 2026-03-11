import { fail } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { eq, and, gt } from 'drizzle-orm';
import * as argon2 from 'argon2';
import type { Actions } from './$types';

export const actions: Actions = {
    default: async ({ params, request }) => {
        const { token } = params;
        const formData = await request.formData();
        const password = formData.get('password')?.toString();
        const confirmPassword = formData.get('confirmPassword')?.toString();

        if (!password || !confirmPassword) {
            return fail(400, { error: 'All fields are required' });
        }

        if (password !== confirmPassword) {
            return fail(400, { error: 'Passwords do not match' });
        }

        // Validate password strength (matching registration rules)
        if (password.length < 8) {
            return fail(400, { error: 'Password must be at least 8 characters' });
        }
        if (!/[A-Z]/.test(password)) {
            return fail(400, { error: 'Password must contain at least one uppercase letter' });
        }
        if (!/[0-9]/.test(password)) {
            return fail(400, { error: 'Password must contain at least one number' });
        }
        if (!/[!@#$%^&*\-+]/.test(password)) {
            return fail(400, { error: 'Password must contain at least one special character' });
        }

        try {
            // Find user with valid token
            const user = await db.query.users.findFirst({
                where: and(
                    eq(users.resetPasswordToken, token),
                    gt(users.resetPasswordExpires, new Date())
                )
            });

            if (!user) {
                return fail(400, { error: 'Invalid or expired reset link' });
            }

            // Hash new password
            const passwordHash = await argon2.hash(password);

            // Update user and clear reset token
            await db.update(users)
                .set({
                    passwordHash,
                    resetPasswordToken: null,
                    resetPasswordExpires: null
                })
                .where(eq(users.id, user.id));

            return { success: true };

        } catch (error) {
            console.error('Reset password error:', error);
            return fail(500, { error: 'An unexpected error occurred. Please try again later.' });
        }
    }
};
