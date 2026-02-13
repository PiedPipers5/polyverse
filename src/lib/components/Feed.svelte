<script lang="ts">
	import { Card } from '$lib/components/ui/card';

	let { posts = [] } = $props();
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
	{:else}
		<Card class="p-4 text-center text-muted-foreground">
			No posts yet. Start sharing on the Fediverse!
		</Card>
	{/if}
</div>
