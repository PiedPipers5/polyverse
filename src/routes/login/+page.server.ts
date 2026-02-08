import { fail, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import * as argon2 from 'argon2';
import { createToken, AUTH_COOKIE_NAME, cookieOptions } from '$lib/server/auth';
import type { Actions, PageServerLoad } from './$types';

/**
 * Redirect to profile if already logged in
 */
export const load: PageServerLoad = async ({ locals }) => {
    if (locals.user) {
        throw redirect(302, '/profile');
    }
    return {};
};

export const actions: Actions = {
    default: async ({ request, cookies }) => {
        const formData = await request.formData();
        const username = formData.get('username')?.toString();
        const password = formData.get('password')?.toString();

        // Validate input exists
        if (!username || !password) {
            return fail(400, { 
                error: 'Username and password are required' 
            });
        }

        try {
            // Find user by username
            const user = await db.query.users.findFirst({
                where: eq(users.username, username),
                columns: {
                    id: true,
                    username: true,
                    passwordHash: true,
                    didDocument: true,
                }
            });

            // Generic error message to prevent user enumeration
            if (!user) {
                return fail(401, { 
                    error: 'Invalid username or password' 
                });
            }

            // Verify password against Argon2 hash
            const passwordValid = await argon2.verify(user.passwordHash, password);

            if (!passwordValid) {
                return fail(401, { 
                    error: 'Invalid username or password' 
                });
            }

            // Extract DID from document
            const did = (user.didDocument as { id: string }).id;

            // Create JWT token
            const token = await createToken({
                userId: user.id,
                did: did,
                username: user.username,
            });

            // Set auth cookie
            cookies.set(AUTH_COOKIE_NAME, token, cookieOptions);

            // Redirect to profile page
            throw redirect(302, '/profile');

        } catch (error) {
            // Re-throw redirects (SvelteKit 2 uses Redirect class)
            if (error && typeof error === 'object' && 'status' in error && 'location' in error) {
                throw error;
            }

            console.error('Login error:', error);
            return fail(500, { 
                error: 'An error occurred during login' 
            });
        }
    }
};
