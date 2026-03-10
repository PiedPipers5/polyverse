import type { ServerLoad } from '@sveltejs/kit';
import { error } from '@sveltejs/kit';

export const load: ServerLoad = async ({ params, fetch }) => {
	const { id } = params;

	// Fetch thread context from existing API
	const res = await fetch(`/api/statuses/${encodeURIComponent(id)}/context`);

	if (!res.ok) {
		if (res.status === 404) {
			throw error(404, 'Post not found');
		}
		throw error(res.status, 'Failed to load thread');
	}

	const context = await res.json();

	return {
		postId: id,
		focusPost: context.focusPost ?? null,
		ancestors: context.ancestors ?? [],
		descendants: context.descendants ?? []
	};
};
