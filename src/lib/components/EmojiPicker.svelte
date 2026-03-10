<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Smile, Search, Sparkles } from 'lucide-svelte';
	import { onMount } from 'svelte';
	import { fade, scale } from 'svelte/transition';

	interface CustomEmoji {
		shortcode: string;
		imageUrl: string;
	}

	let { onSelect, disabled = false } = $props();

	let isOpen = $state(false);
	let customEmojis = $state<CustomEmoji[]>([]);
	let searchQuery = $state('');

	const standardEmojis = [
		'😀',
		'😃',
		'😄',
		'😁',
		'😆',
		'😅',
		'😂',
		'🤣',
		'😊',
		'😇',
		'🙂',
		'🙃',
		'😉',
		'😌',
		'😍',
		'🥰',
		'😘',
		'😗',
		'😙',
		'😚',
		'😋',
		'😛',
		'😝',
		'😜',
		'🤪',
		'🤨',
		'🧐',
		'🤓',
		'😎',
		'🤩',
		'🥳',
		'😏',
		'😒',
		'😞',
		'😔',
		'😟',
		'😕',
		'🙁',
		'☹️',
		'😣',
		'😖',
		'😫',
		'😩',
		'🥺',
		'😢',
		'😭',
		'😤',
		'😠',
		'😡',
		'🤬',
		'🤯',
		'😳',
		'🥵',
		'🥶',
		'😱',
		'😨',
		'😰',
		'😥',
		'😓',
		'🤗',
		'🤔',
		'🤭',
		'🤫',
		'🤥',
		'😶',
		'😐',
		'😑',
		'😬',
		'🙄',
		'😯',
		'😦',
		'😧',
		'😮',
		'😲',
		'🥱',
		'😴',
		'🤤',
		'😪',
		'😵',
		'🤐',
		'🥴',
		'🤢',
		'🤮',
		'🤧',
		'😷',
		'🤒',
		'🤕',
		'🤑',
		'🤠',
		'😈',
		'👿',
		'👹',
		'👺',
		'🤡',
		'👻',
		'💀',
		'☠️',
		'👽',
		'👾',
		'🤖',
		'💩',
		'😺',
		'😸',
		'😻',
		'😼',
		'😽',
		'🙀',
		'😿',
		'😾',
		'🙈'
	];

	onMount(async () => {
		try {
			const res = await fetch('/api/emojis');
			if (res.ok) {
				customEmojis = await res.json();
			}
		} catch (e) {
			console.error('Failed to fetch custom emojis:', e);
		}
	});

	let filteredStandard = $derived(
		searchQuery
			? standardEmojis.filter((e) => e.includes(searchQuery)) // Simple match for now
			: standardEmojis
	);

	let filteredCustom = $derived(
		searchQuery
			? customEmojis.filter((e) => e.shortcode.toLowerCase().includes(searchQuery.toLowerCase()))
			: customEmojis
	);

	function handleSelect(emoji: string | CustomEmoji) {
		if (typeof emoji === 'string') {
			onSelect(emoji);
		} else {
			onSelect(emoji.shortcode);
		}
		isOpen = false;
	}
</script>

<div class="relative">
	<Button
		variant="ghost"
		size="icon"
		onclick={() => (isOpen = !isOpen)}
		{disabled}
		class="h-9 w-9 rounded-full text-muted-foreground transition-all hover:bg-violet-500/10 hover:text-violet-400"
		title="Add emoji"
	>
		<Smile class="h-4.5 w-4.5" />
	</Button>

	{#if isOpen}
		<!-- Backdrop -->
		<button
			class="fixed inset-0 z-60 h-full w-full cursor-default"
			onclick={() => (isOpen = false)}
			type="button"
			aria-label="Close emoji picker"
		></button>

		<div
			class="absolute bottom-full left-0 z-70 mb-2 w-72 overflow-hidden rounded-2xl border border-white/10 bg-slate-950 p-4 shadow-2xl ring-1 ring-white/10"
			in:scale={{ duration: 150, start: 0.95 }}
			out:fade={{ duration: 100 }}
		>
			<div
				class="mb-3 flex items-center gap-2 rounded-lg bg-white/5 px-2 py-1.5 ring-1 ring-white/5 focus-within:ring-violet-500/30"
			>
				<Search class="h-4 w-4 text-muted-foreground" />
				<input
					bind:value={searchQuery}
					placeholder="Search emojis..."
					class="w-full bg-transparent text-sm focus:outline-none"
				/>
			</div>

			<div class="custom-scrollbar max-h-60 overflow-y-auto pr-1">
				{#if filteredCustom.length > 0}
					<div class="mb-4">
						<div
							class="mb-2 flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-violet-400/80 uppercase"
						>
							<Sparkles class="h-3 w-3" />
							Custom Emojis
						</div>
						<div class="grid grid-cols-6 gap-2">
							{#each filteredCustom as emoji}
								<button
									type="button"
									class="group relative flex aspect-square items-center justify-center rounded-lg bg-white/5 transition-all hover:scale-110 hover:bg-violet-500/20"
									onclick={() => handleSelect(emoji)}
									title={emoji.shortcode}
								>
									<img
										src={emoji.imageUrl}
										alt={emoji.shortcode}
										class="h-6 w-6 object-contain"
										onerror={(e) => {
											// Fallback for broken images
											e.currentTarget.style.display = 'none';
										}}
									/>
									<span
										class="pointer-events-none absolute inset-0 flex items-center justify-center rounded-lg bg-black/40 text-[8px] opacity-0 transition-opacity group-hover:opacity-100"
									>
										{emoji.shortcode.replace(/:/g, '')}
									</span>
								</button>
							{/each}
						</div>
					</div>
				{/if}

				<div>
					<div class="mb-2 text-[10px] font-bold tracking-wider text-muted-foreground/60 uppercase">
						Standard
					</div>
					<div class="grid grid-cols-6 gap-1">
						{#each filteredStandard as emoji}
							<button
								type="button"
								class="flex aspect-square items-center justify-center rounded-lg text-xl transition-all hover:scale-110 hover:bg-white/10"
								onclick={() => handleSelect(emoji)}
							>
								{emoji}
							</button>
						{/each}
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.custom-scrollbar::-webkit-scrollbar {
		width: 4px;
	}
	.custom-scrollbar::-webkit-scrollbar-track {
		background: transparent;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb {
		background: rgba(255, 255, 255, 0.1);
		border-radius: 10px;
	}
</style>
