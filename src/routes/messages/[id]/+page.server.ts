import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	return {
		user: locals.user,
		conversationId: params.id
	};
};
