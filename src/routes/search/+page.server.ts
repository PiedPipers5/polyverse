import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/**
 * GET /search
 *
 * Auth-gated search page. Redirects unauthenticated users to /login.
 */
export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	return {};
};
