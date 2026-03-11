import type { ServerLoad } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';

export const load: ServerLoad = async ({ fetch, locals }) => {
	// Redirect to login if not authenticated
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	const res = await fetch('/api/notifications').catch(() => null);

	let notifications: any[] = [];
	let unreadCount = 0;

	if (res?.ok) {
		const data = await res.json();
		notifications = data.notifications ?? [];
		unreadCount = data.unreadCount ?? 0;
	}

	return { notifications, unreadCount };
};
