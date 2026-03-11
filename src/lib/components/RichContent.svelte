<script lang="ts">
	interface EmojiTag {
		type: 'Emoji';
		name: string;
		icon: {
			url: string;
		};
	}

	interface Props {
		content: string;
		tags?: any[];
	}

	let { content, tags = [] }: Props = $props();

	// Extract emoji mappings from tags
	let emojiMap = $derived(
		new Map(tags.filter((t) => t.type === 'Emoji').map((t: EmojiTag) => [t.name, t.icon.url]))
	);

	// Split content into segments (text and emojis)
	let segments = $derived.by(() => {
		if (emojiMap.size === 0) return [{ type: 'text', value: content }];

		const emojiRegex = /(:[a-zA-Z0-9_]+:)/g;
		return content.split(emojiRegex).map((part) => {
			if (emojiMap.has(part)) {
				return { type: 'emoji', value: part, url: emojiMap.get(part) };
			}
			return { type: 'text', value: part };
		});
	});
</script>

<div class="rich-content">
	{#each segments as segment}
		{#if segment.type === 'emoji'}
			<img
				src={segment.url}
				alt={segment.value}
				title={segment.value}
				class="mx-0.5 inline-block h-[1.2em] w-auto align-text-bottom"
			/>
		{:else}
			{segment.value}
		{/if}
	{/each}
</div>

<style>
	.rich-content {
		white-space: pre-wrap;
		word-break: break-word;
	}
</style>
