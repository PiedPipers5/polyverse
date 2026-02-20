<script lang="ts">
	import { Search, X, Loader2, User, ExternalLink } from 'lucide-svelte';
	import { onMount } from 'svelte';

	// Fediverse handle pattern: @user@domain or user@domain
	const HANDLE_PATTERN = /^@?[\w.-]+@[\w.-]+\.\w+$/;

	type LocalUser = {
		username: string;
		displayName: string | null;
		bio: string | null;
		avatarUrl: string | null;
		profileUrl: string;
	};

	type RemoteActor = {
		id: string;
		type: string;
		preferredUsername: string;
		name: string;
		summary: string | null;
		icon: { url: string } | null;
		url: string;
	};

	type SearchResult =
		| { type: 'local_user'; user: LocalUser }
		| { type: 'remote_actor'; actor: RemoteActor; handle: string; cached: boolean }
		| { type: 'no_results'; query: string; message: string }
		| { type: 'error'; message: string };

	// State
	let query = $state('');
	let result = $state<SearchResult | null>(null);
	let loading = $state(false);
	let open = $state(false);
	let inputEl = $state<HTMLInputElement | null>(null);
	let containerEl = $state<HTMLDivElement | null>(null);

	let debounceTimer: ReturnType<typeof setTimeout>;

	const isHandle = $derived(HANDLE_PATTERN.test(query.trim()));

	// Close on click-outside or Escape
	onMount(() => {
		function onKeyDown(e: KeyboardEvent) {
			if (e.key === 'Escape') {
				open = false;
				inputEl?.blur();
			}
		}
		function onPointerDown(e: PointerEvent) {
			if (containerEl && !containerEl.contains(e.target as Node)) {
				open = false;
			}
		}
		document.addEventListener('keydown', onKeyDown);
		document.addEventListener('pointerdown', onPointerDown);
		return () => {
			document.removeEventListener('keydown', onKeyDown);
			document.removeEventListener('pointerdown', onPointerDown);
		};
	});

	async function doSearch() {
		const q = query.trim();
		if (!q) return;

		loading = true;
		open = true;
		result = null;

		try {
			const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
			const data = await res.json();

			if (!res.ok) {
				result = { type: 'error', message: data.message || `Error ${res.status}` };
			} else {
				result = data as SearchResult;
			}
		} catch (err) {
			result = { type: 'error', message: 'Network error — please try again.' };
		} finally {
			loading = false;
		}
	}

	function handleInput() {
		clearTimeout(debounceTimer);
		result = null;
		if (!query.trim()) {
			open = false;
		}
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			clearTimeout(debounceTimer);
			doSearch();
		}
	}

	function clear() {
		query = '';
		result = null;
		open = false;
		inputEl?.focus();
	}

	function getInitials(name: string) {
		return name
			.split(' ')
			.map((n) => n[0])
			.join('')
			.toUpperCase()
			.slice(0, 2);
	}
</script>

<div bind:this={containerEl} class="search-wrapper relative">
	<!-- Input Row -->
	<div
		class="search-input-row flex items-center gap-2 rounded-xl border border-violet-400/40 bg-background/70 px-3 py-1.5 backdrop-blur-sm transition-all focus-within:border-violet-500 focus-within:ring-2 focus-within:ring-violet-500/20"
	>
		{#if loading}
			<Loader2 class="h-4 w-4 animate-spin text-violet-400" />
		{:else}
			<Search class="h-4 w-4 text-muted-foreground" />
		{/if}

		<input
			bind:this={inputEl}
			bind:value={query}
			oninput={handleInput}
			onkeydown={handleKeyDown}
			onfocus={() => {
				if (result) open = true;
			}}
			type="text"
			placeholder="Search @user@domain…"
			class="w-48 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/60 lg:w-56"
			autocomplete="off"
			spellcheck="false"
		/>

		{#if query}
			<button
				onclick={clear}
				class="text-muted-foreground transition-colors hover:text-foreground"
				aria-label="Clear search"
			>
				<X class="h-3.5 w-3.5" />
			</button>
		{/if}
	</div>

	<!-- Handle badge -->
	{#if isHandle && query && !open}
		<div class="absolute -bottom-6 left-0 flex items-center gap-1 text-xs text-violet-400">
			<span class="inline-block h-1.5 w-1.5 rounded-full bg-violet-400"></span>
			Handle detected · press Enter to search
		</div>
	{/if}

	<!-- Dropdown -->
	{#if open}
		<div
			class="animate-fade-in absolute top-full left-0 z-200 mt-2 w-80 overflow-hidden rounded-xl border border-border bg-background shadow-2xl"
		>
			<!-- Loading -->
			{#if loading}
				<div class="flex items-center gap-3 px-4 py-5">
					<Loader2 class="h-5 w-5 animate-spin text-violet-400" />
					<span class="text-sm text-muted-foreground">Searching…</span>
				</div>

				<!-- Local user result -->
			{:else if result?.type === 'local_user'}
				{@const u = result.user}
				<a
					href={u.profileUrl}
					onclick={() => (open = false)}
					class="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent"
				>
					{#if u.avatarUrl}
						<img
							src={u.avatarUrl}
							alt={u.displayName || u.username}
							class="h-10 w-10 rounded-full object-cover"
						/>
					{:else}
						<div
							class="flex h-10 w-10 items-center justify-center rounded-full bg-linear-to-br from-violet-500 to-fuchsia-500 text-sm font-bold text-white"
						>
							{getInitials(u.displayName || u.username)}
						</div>
					{/if}
					<div class="min-w-0 flex-1">
						<p class="truncate text-sm font-semibold">{u.displayName || u.username}</p>
						<p class="truncate text-xs text-muted-foreground">@{u.username}</p>
					</div>
					<span
						class="shrink-0 rounded-full bg-violet-500/10 px-2 py-0.5 text-xs font-medium text-violet-500"
						>Local</span
					>
				</a>

				<!-- Remote actor result -->
			{:else if result?.type === 'remote_actor'}
				{@const a = result.actor}
				<a
					href={a.url}
					target="_blank"
					rel="noopener noreferrer"
					onclick={() => (open = false)}
					class="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent"
				>
					{#if a.icon?.url}
						<img src={a.icon.url} alt={a.name} class="h-10 w-10 rounded-full object-cover" />
					{:else}
						<div
							class="flex h-10 w-10 items-center justify-center rounded-full bg-linear-to-br from-sky-500 to-indigo-500 text-sm font-bold text-white"
						>
							{getInitials(a.name || a.preferredUsername)}
						</div>
					{/if}
					<div class="min-w-0 flex-1">
						<p class="truncate text-sm font-semibold">{a.name || a.preferredUsername}</p>
						<p class="truncate text-xs text-muted-foreground">@{result.handle}</p>
					</div>
					<ExternalLink class="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
				</a>

				<!-- No handle pattern -->
			{:else if result?.type === 'no_results'}
				<div class="flex flex-col gap-1 px-4 py-4">
					<p class="text-sm font-medium">No match found</p>
					<p class="text-xs text-muted-foreground">
						Try the full Fediverse handle, e.g. <code class="rounded bg-muted px-1"
							>@alice@mastodon.social</code
						>
					</p>
				</div>

				<!-- Error -->
			{:else if result?.type === 'error'}
				<div class="flex items-start gap-3 px-4 py-4">
					<span class="mt-0.5 text-destructive">⚠</span>
					<p class="text-sm text-destructive">{result.message}</p>
				</div>
			{/if}

			<!-- Footer hint -->
			{#if !loading && result}
				<div class="border-t px-4 py-2 text-xs text-muted-foreground">
					Press <kbd class="rounded bg-muted px-1 py-0.5 font-mono">Esc</kbd> to close
				</div>
			{/if}
		</div>
	{/if}
</div>
