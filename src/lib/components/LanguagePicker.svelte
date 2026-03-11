<script lang="ts">
	import { languages, type Language } from '$lib/constants/languages';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Search, ChevronDown, Check, Languages } from 'lucide-svelte';
	import { fly } from 'svelte/transition';

	interface Props {
		selected: string;
		onSelect: (code: string) => void;
		disabled?: boolean;
	}

	let { selected, onSelect, disabled = false }: Props = $props();

	let isOpen = $state(false);
	let searchQuery = $state('');

	const filteredLanguages = $derived(
		languages.filter(
			(lang) =>
				lang.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
				lang.nativeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
				lang.code.toLowerCase().includes(searchQuery.toLowerCase())
		)
	);

	const selectedLanguage = $derived(
		languages.find((l) => l.code === selected) || languages.find((l) => l.code === 'en')
	);

	function toggleDropdown() {
		if (disabled) return;
		isOpen = !isOpen;
		if (isOpen) searchQuery = '';
	}

	function handleSelect(code: string) {
		onSelect(code);
		isOpen = false;
	}
</script>

<div class="relative">
	<Button
		variant="ghost"
		size="sm"
		onclick={toggleDropdown}
		{disabled}
		class="flex h-9 items-center gap-1.5 rounded-lg px-2 text-muted-foreground transition-all hover:bg-white/5 hover:text-foreground active:bg-white/10"
	>
		<Languages class="h-3.5 w-3.5" />
		<span class="text-[11px] font-bold">
			{selectedLanguage?.nativeName} ({selectedLanguage?.name})
		</span>
		<ChevronDown class="h-3 w-3 opacity-30 transition-transform {isOpen ? 'rotate-180' : ''}" />
	</Button>

	{#if isOpen}
		<!-- Backdrop -->
		<button
			class="fixed inset-0 z-60 h-full w-full cursor-default"
			onclick={() => (isOpen = false)}
			type="button"
			aria-label="Close language menu"
		></button>

		<div
			transition:fly={{ y: -10, duration: 200 }}
			class="absolute bottom-full left-0 z-70 mb-2 w-72 overflow-hidden rounded-xl border border-white/10 bg-slate-950 text-popover-foreground shadow-2xl ring-1 ring-white/10"
		>
			<div class="border-b bg-muted/30 p-3">
				<div class="relative">
					<Search
						class="absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground"
					/>
					<Input
						type="text"
						placeholder="Search languages..."
						bind:value={searchQuery}
						class="h-9 border-muted-foreground/20 bg-background pl-9 text-sm focus-visible:ring-primary/30"
						autofocus
					/>
				</div>
			</div>

			<div class="custom-scrollbar max-h-[300px] overflow-y-auto p-1">
				{#if filteredLanguages.length === 0}
					<div class="p-4 text-center text-sm text-muted-foreground">No languages found.</div>
				{:else}
					{#each filteredLanguages as lang}
						<button
							type="button"
							class="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition-all hover:bg-accent hover:text-accent-foreground {selected ===
							lang.code
								? 'bg-primary/10 font-semibold text-primary'
								: ''}"
							onclick={() => handleSelect(lang.code)}
						>
							<div class="flex flex-col">
								<span class="font-bold">{lang.nativeName}</span>
								<span
									class="text-xs {selected === lang.code
										? 'text-primary/70'
										: 'text-muted-foreground'}"
								>
									({lang.name})
								</span>
							</div>
							{#if selected === lang.code}
								<Check class="h-4 w-4 text-primary" />
							{/if}
						</button>
					{/each}
				{/if}
			</div>
		</div>
	{/if}
</div>

<style>
	.custom-scrollbar::-webkit-scrollbar {
		width: 6px;
	}
	.custom-scrollbar::-webkit-scrollbar-track {
		background: transparent;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb {
		background: hsl(var(--muted-foreground) / 0.2);
		border-radius: 10px;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb:hover {
		background: hsl(var(--muted-foreground) / 0.3);
	}
</style>
