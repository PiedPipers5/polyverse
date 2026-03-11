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
		nsfwWords?: string[];
	}

	let { content, tags = [], nsfwWords = [] }: Props = $props();

	// Extract emoji mappings from tags
	let emojiMap = $derived(
		new Map(tags.filter((t) => t.type === 'Emoji').map((t: EmojiTag) => [t.name, t.icon.url]))
	);

	// Split content into segments (text, emojis, and redacted words)
	let segments = $derived.by(() => {
		let currentSegments: any[] = [{ type: 'text', value: content }];

		// 1. Process Emojis first
		if (emojiMap.size > 0) {
			const emojiRegex = /(:[a-zA-Z0-9_]+:)/g;
			const newSegments: any[] = [];

			for (const seg of currentSegments) {
				if (seg.type !== 'text') {
					newSegments.push(seg);
					continue;
				}

				const parts = seg.value.split(emojiRegex);
				for (const part of parts) {
					if (!part) continue;
					if (emojiMap.has(part)) {
						newSegments.push({ type: 'emoji', value: part, url: emojiMap.get(part) });
					} else {
						newSegments.push({ type: 'text', value: part });
					}
				}
			}
			currentSegments = newSegments;
		}

		// 2. Process NSFW Words
		if (nsfwWords && nsfwWords.length > 0) {
			// Escape regex characters in nsfwWords and create a combined regex
			const escapedWords = nsfwWords.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
			// We use \b boundary but also allow hyphenated variations if needed, simple approach first
			const wordRegex = new RegExp(`\\b(${escapedWords.join('|')})\\b`, 'gi');

			const finalSegments: any[] = [];

			for (const seg of currentSegments) {
				if (seg.type !== 'text') {
					finalSegments.push(seg);
					continue;
				}

				const parts = seg.value.split(wordRegex);
				// The split with capture group returns: [non-match, match, non-match, match, ...]
				for (let i = 0; i < parts.length; i++) {
					const part = parts[i];
					if (!part) continue;

					// Every odd index is a matched NSFW word due to the capture group `()`
					if (i % 2 !== 0) {
						finalSegments.push({ type: 'redacted', value: part });
					} else {
						finalSegments.push({ type: 'text', value: part });
					}
				}
			}
			currentSegments = finalSegments;
		}

		return currentSegments;
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
		{:else if segment.type === 'redacted'}
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<span
				class="-my-1 inline-block cursor-pointer rounded bg-foreground px-1 py-0.5 text-transparent transition-colors selection:bg-black selection:text-transparent hover:opacity-80"
				title="Click to reveal/hide"
				onclick={(e) => {
					const el = e.currentTarget;
					el.classList.toggle('bg-foreground');
					el.classList.toggle('text-transparent');
					el.classList.toggle('selection:bg-black');
					el.classList.toggle('selection:text-transparent');
					el.classList.toggle('bg-rose-500/20');
					el.classList.toggle('text-rose-600');
					el.classList.toggle('dark:text-rose-400');
				}}>{segment.value}</span
			>
		{:else}
			{@html segment.value}
		{/if}
	{/each}
</div>

<style>
	.rich-content {
		white-space: pre-wrap;
		word-break: break-word;
	}

	/* Style HTML injected from remote ActivityPub posts */
	.rich-content :global(a) {
		color: var(--color-violet-500); /* Or text-sky-400 if you prefer */
		text-decoration: none;
		font-weight: 500;
	}
	:global(.dark) .rich-content :global(a) {
		color: var(--color-violet-400);
	}
	.rich-content :global(a:hover) {
		text-decoration: underline;
		text-underline-offset: 2px;
	}
	.rich-content :global(p) {
		margin-bottom: 0.75rem;
	}
	.rich-content :global(p:last-child) {
		margin-bottom: 0;
	}
	/* Ensure mentions look distinct if they have classes */
	.rich-content :global(.mention) {
		color: var(--color-violet-500);
	}
	:global(.dark) .rich-content :global(.mention) {
		color: var(--color-violet-400);
	}
</style>
