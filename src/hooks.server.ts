import type { Handle } from '@sveltejs/kit';
import { verifyToken, AUTH_COOKIE_NAME } from '$lib/server/auth';

/**
 * Server hooks for authentication middleware.
 * Extracts and verifies JWT from cookies, attaches user to locals.
 */
export const handle: Handle = async ({ event, resolve }) => {
    // Initialize user as null
    event.locals.user = null;

    // Get auth token from cookies
    const token = event.cookies.get(AUTH_COOKIE_NAME);

    if (token) {
        try {
            // Verify token and attach user to locals
            const payload = await verifyToken(token);
            event.locals.user = {
                userId: payload.userId,
                did: payload.did,
                username: payload.username,
            };
        } catch {
            // Invalid token - clear cookie
            event.cookies.delete(AUTH_COOKIE_NAME, { path: '/' });
        }
    }

    return resolve(event);
};
