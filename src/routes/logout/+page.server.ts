import { redirect } from '@sveltejs/kit';
import { AUTH_COOKIE_NAME } from '$lib/server/auth';
import type { Actions } from './$types';

export const actions: Actions = {
    default: async ({ cookies }) => {
        // Clear auth cookie
        cookies.delete(AUTH_COOKIE_NAME, { path: '/' });
        
        // Redirect to home
        throw redirect(302, '/');
    }
};
