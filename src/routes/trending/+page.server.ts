import type { ServerLoad } from '@sveltejs/kit';

export const load: ServerLoad = async ({ fetch }) => {
	// Pre-fetch both statuses and tags in parallel
	const [statusesRes, tagsRes] = await Promise.all([
		fetch('/api/trending?type=statuses').catch(() => null),
		fetch('/api/trending?type=tags').catch(() => null)
	]);

	let trendingStatuses = { statuses: [], instances: [], fetchedAt: null };
	let trendingTags = { tags: [], instances: [], fetchedAt: null };

	if (statusesRes?.ok) {
		trendingStatuses = await statusesRes.json();
	}
	if (tagsRes?.ok) {
		trendingTags = await tagsRes.json();
	}

	return {
		trendingStatuses,
		trendingTags
	};
};
