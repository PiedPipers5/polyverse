import { fail } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { sendPasswordResetEmail } from '$lib/server/email';
import crypto from 'crypto';
import type { Actions } from './$types';

export const actions: Actions = {
    default: async ({ request }) => {
        const formData = await request.formData();
        const email = formData.get('email')?.toString();

        if (!email) {
            return fail(400, { error: 'Email is required' });
        }

        try {
            // Find user by email
            const user = await db.query.users.findFirst({
                where: eq(users.email, email)
            });

            // We return success even if user not found to prevent email enumeration
            if (!user) {
                return { success: true };
            }

            // Generate reset token
            const token = crypto.randomBytes(32).toString('hex');
            const expires = new Date(Date.now() + 3600000); // 1 hour

            // Save token and expiry
            await db.update(users)
                .set({
                    resetPasswordToken: token,
                    resetPasswordExpires: expires
                })
                .where(eq(users.id, user.id));

            // Send email
            await sendPasswordResetEmail(email, token);

            return { success: true };

        } catch (error) {
            console.error('Forgot password error:', error);
            return fail(500, { error: 'An unexpected error occurred. Please try again later.' });
        }
    }
};
