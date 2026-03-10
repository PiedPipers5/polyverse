import { fail, redirect } from '@sveltejs/kit';
import * as argon2 from 'argon2';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { env } from '$env/dynamic/private';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
    // Require authentication
    if (!locals.user) {
        throw redirect(302, '/login');
    }

    // Fetch full user profile
    const user = await db.query.users.findFirst({
        where: eq(users.id, locals.user.userId),
        columns: {
            id: true,
            username: true,
            displayName: true,
            bio: true,
            avatarUrl: true,
            didDocument: true,
        }
    });

    if (!user) {
        throw redirect(302, '/login');
    }

    // Extract DID from document
    const did = (user.didDocument as { id: string }).id;
    const domain = env.DOMAIN!;

    return {
        user: {
            id: user.id,
            username: user.username,
            displayName: user.displayName,
            bio: user.bio,
            avatarUrl: user.avatarUrl,
            did: did,
            domain: domain,
            handle: `@${user.username}@${domain}`,
        }
    };
};

export const actions = {
    changePassword: async ({ request, locals }) => {
        if (!locals.user) {
            throw redirect(302, '/login');
        }

        const formData = await request.formData();
        const currentPassword = formData.get('currentPassword')?.toString();
        const newPassword = formData.get('newPassword')?.toString();
        const confirmPassword = formData.get('confirmPassword')?.toString();

        if (!currentPassword || !newPassword || !confirmPassword) {
            return fail(400, { passwordError: 'All fields are required' });
        }

        if (newPassword !== confirmPassword) {
            return fail(400, { passwordError: 'New passwords do not match' });
        }

        // Validate password strength
        if (newPassword.length < 8) {
            return fail(400, { passwordError: 'Password must be at least 8 characters' });
        }
        if (!/[A-Z]/.test(newPassword)) {
            return fail(400, { passwordError: 'Password must contain at least one uppercase letter' });
        }
        if (!/[0-9]/.test(newPassword)) {
            return fail(400, { passwordError: 'Password must contain at least one number' });
        }
        if (!/[!@#$%^&*\-+]/.test(newPassword)) {
            return fail(400, { passwordError: 'Password must contain at least one special character' });
        }

        try {
            // Get current user's password hash
            const user = await db.query.users.findFirst({
                where: eq(users.id, locals.user.userId),
                columns: { passwordHash: true }
            });

            if (!user) {
                return fail(404, { passwordError: 'User not found' });
            }

            // Verify current password
            const isValid = await argon2.verify(user.passwordHash, currentPassword);
            if (!isValid) {
                return fail(400, { passwordError: 'Current password is incorrect' });
            }

            // Hash new password
            const newPasswordHash = await argon2.hash(newPassword);

            // Update database
            await db.update(users)
                .set({ passwordHash: newPasswordHash })
                .where(eq(users.id, locals.user.userId));

            return { passwordSuccess: true };
        } catch (error) {
            console.error('Change password error:', error);
            return fail(500, { passwordError: 'An unexpected error occurred' });
        }
    }
};
