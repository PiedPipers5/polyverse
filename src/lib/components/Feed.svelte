<script lang="ts">
	import { Card } from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Loader2 } from 'lucide-svelte';

	let { posts = [], next = null } = $props();
	let loading = $state(false);

	async function loadMore() {
		if (!next || loading) return;
		loading = true;

		try {
			const response = await fetch(next);
			if (response.ok) {
				const data = await response.json();

				// Transform and append new items
				const newItems = data.orderedItems.map((item: any) => ({
					...item, // Keep original properties
					content: item.object?.content || item.content || '',
					publishedAt: item.published || new Date().toISOString()
				}));

				posts = [...posts, ...newItems];
				next = data.next || null;
			} else {
				console.error('Failed to load more posts');
			}
		} catch (error) {
			console.error('Error loading more posts:', error);
		} finally {
			loading = false;
		}
	}
</script>

<div class="space-y-3">
	{#if posts && posts.length > 0}
		{#each posts as activity}
			<Card class="p-4">
				<p class="text-base whitespace-pre-wrap">{activity.content}</p>
				<p class="mt-2 text-xs text-muted-foreground">
					{new Date(activity.publishedAt).toLocaleString('en-IN', {
						day: '2-digit',
						month: '2-digit',
						year: 'numeric',
						hour: '2-digit',
						minute: '2-digit',
						hour12: true,
						timeZone: 'Asia/Kolkata'
					})} IST
				</p>
			</Card>
		{/each}

		{#if next}
			<div class="flex justify-center pt-4">
				<Button variant="outline" onclick={loadMore} disabled={loading}>
					{#if loading}
						<Loader2 class="mr-2 h-4 w-4 animate-spin" />
						Loading...
					{:else}
						Load More
					{/if}
				</Button>
			</div>
		{/if}
	{:else}
		<Card class="p-4 text-center text-muted-foreground">
			No posts yet. Start sharing on the Fediverse!
		</Card>
	{/if}
</div>
