<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { Search, Loader2, ExternalLink, Globe, User, AlertCircle } from 'lucide-svelte';
	import { Card } from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Avatar, AvatarFallback, AvatarImage } from '$lib/components/ui/avatar';

	// ── Types ──────────────────────────────────────────────────────────────────
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

	// ── State ──────────────────────────────────────────────────────────────────
	let query = $state('');
	let result = $state<SearchResult | null>(null);
	let loading = $state(false);
	let searched = $state(false); // whether a search has been triggered

	const HANDLE_PATTERN = /^@?[\w.-]+@[\w.-]+\.\w+$/;
	const isHandle = $derived(HANDLE_PATTERN.test(query.trim()));

	// Pre-fill from ?q= URL param on mount
	onMount(() => {
		const q = $page.url.searchParams.get('q');
		if (q) {
			query = q;
			doSearch();
		}
	});

	// ── Search logic ───────────────────────────────────────────────────────────
	async function doSearch() {
		const q = query.trim();
		if (!q) return;

		loading = true;
		result = null;
		searched = true;

		// Reflect query in URL without navigation
		const url = new URL(window.location.href);
		url.searchParams.set('q', q);
		history.replaceState({}, '', url.toString());

		try {
			const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
			const data = await res.json();

			if (!res.ok) {
				result = { type: 'error', message: data.message || `Error ${res.status}` };
			} else {
				result = data as SearchResult;
			}
		} catch {
			result = { type: 'error', message: 'Network error — please try again.' };
		} finally {
			loading = false;
		}
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Enter') doSearch();
	}

	function handleInput() {
		// Clear result when user starts typing again
		if (result) result = null;
	}

	// ── Helpers ────────────────────────────────────────────────────────────────
	function getInitials(name: string) {
		return name
			.split(' ')
			.map((n) => n[0])
			.join('')
			.toUpperCase()
			.slice(0, 2);
	}

	function stripHtml(html: string | null) {
		if (!html) return null;
		return html.replace(/<[^>]*>/g, '').trim();
	}
</script>

<svelte:head>
	<title>Search - Polyverse</title>
	<meta
		name="description"
		content="Search for local and federated users on Polyverse by Fediverse handle."
	/>
</svelte:head>

<div class="flex min-h-screen flex-col items-center bg-muted px-4 py-16">
	<!-- Header -->
	<div class="mb-10 text-center">
		<div
			class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-lg shadow-violet-500/30"
		>
			<Search class="h-7 w-7 text-white" />
		</div>
		<h1 class="text-3xl font-bold tracking-tight">Find People</h1>
		<p class="mt-2 text-sm text-muted-foreground">
			Search for anyone on Polyverse or across the Fediverse by their handle.
		</p>
	</div>

	<!-- Search Box -->
	<div class="w-full max-w-lg">
		<div
			class="flex items-center gap-2 rounded-xl border border-border bg-background p-1.5 shadow-sm transition-all focus-within:border-violet-500 focus-within:ring-2 focus-within:ring-violet-500/20"
		>
			{#if loading}
				<Loader2 class="ml-2 h-5 w-5 shrink-0 animate-spin text-violet-400" />
			{:else}
				<Search class="ml-2 h-5 w-5 shrink-0 text-muted-foreground" />
			{/if}

			<input
				bind:value={query}
				oninput={handleInput}
				onkeydown={handleKeyDown}
				type="text"
				placeholder="@alice@mastodon.social"
				class="min-w-0 flex-1 bg-transparent py-1.5 text-sm outline-none placeholder:text-muted-foreground/60"
				autocomplete="off"
				spellcheck={false}
				autofocus
			/>

			<Button
				onclick={doSearch}
				disabled={!query.trim() || loading}
				size="sm"
				class="shrink-0 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white hover:from-violet-600 hover:to-fuchsia-600 disabled:opacity-50"
			>
				Search
			</Button>
		</div>

		<!-- Handle hint -->
		{#if query && !isHandle && !loading}
			<p class="mt-2 text-center text-xs text-amber-500">
				Try a full Fediverse handle, e.g. <code class="rounded bg-muted px-1"
					>@alice@mastodon.social</code
				>
			</p>
		{:else if isHandle && !loading}
			<p class="mt-2 text-center text-xs text-violet-400">
				<span class="inline-block h-1.5 w-1.5 rounded-full bg-violet-400 align-middle"></span>
				Handle detected — press <kbd class="rounded bg-muted px-1 py-0.5 font-mono">Enter</kbd> or click
				Search
			</p>
		{/if}
	</div>

	<!-- Results -->
	<div class="mt-8 w-full max-w-lg">
		{#if loading}
			<!-- Loading skeleton -->
			<Card class="flex items-center gap-4 p-5">
				<div class="h-12 w-12 animate-pulse rounded-full bg-muted"></div>
				<div class="flex-1 space-y-2">
					<div class="h-4 w-36 animate-pulse rounded bg-muted"></div>
					<div class="h-3 w-24 animate-pulse rounded bg-muted"></div>
				</div>
			</Card>
		{:else if result?.type === 'local_user'}
			{@const u = result.user}
			<a href={u.profileUrl} class="block rounded-xl transition-transform hover:scale-[1.01]">
				<Card class="flex items-center gap-4 p-5 transition-colors hover:border-violet-400">
					<Avatar class="h-12 w-12 shrink-0">
						{#if u.avatarUrl}
							<AvatarImage src={u.avatarUrl} alt={u.displayName || u.username} />
						{/if}
						<AvatarFallback
							class="bg-gradient-to-br from-violet-500 to-fuchsia-500 text-sm font-bold text-white"
						>
							{getInitials(u.displayName || u.username)}
						</AvatarFallback>
					</Avatar>

					<div class="min-w-0 flex-1">
						<p class="truncate font-semibold">{u.displayName || u.username}</p>
						<p class="truncate text-sm text-muted-foreground">@{u.username}</p>
						{#if u.bio}
							<p class="mt-1 truncate text-xs text-muted-foreground">{u.bio}</p>
						{/if}
					</div>

					<span
						class="flex shrink-0 items-center gap-1.5 rounded-full border border-violet-400/30 bg-violet-500/10 px-2.5 py-1 text-xs font-medium text-violet-500"
					>
						<User class="h-3 w-3" />
						Local
					</span>
				</Card>
			</a>
		{:else if result?.type === 'remote_actor'}
			{@const a = result.actor}
			<a
				href={a.url}
				target="_blank"
				rel="noopener noreferrer"
				class="block rounded-xl transition-transform hover:scale-[1.01]"
			>
				<Card class="flex items-center gap-4 p-5 transition-colors hover:border-sky-400">
					<Avatar class="h-12 w-12 shrink-0">
						{#if a.icon?.url}
							<AvatarImage src={a.icon.url} alt={a.name} />
						{/if}
						<AvatarFallback
							class="bg-gradient-to-br from-sky-500 to-indigo-500 text-sm font-bold text-white"
						>
							{getInitials(a.name || a.preferredUsername)}
						</AvatarFallback>
					</Avatar>

					<div class="min-w-0 flex-1">
						<p class="truncate font-semibold">{a.name || a.preferredUsername}</p>
						<p class="truncate text-sm text-muted-foreground">@{result.handle}</p>
						{#if a.summary}
							<p class="mt-1 line-clamp-2 text-xs text-muted-foreground">{stripHtml(a.summary)}</p>
						{/if}
					</div>

					<span
						class="flex shrink-0 items-center gap-1.5 rounded-full border border-sky-400/30 bg-sky-500/10 px-2.5 py-1 text-xs font-medium text-sky-500"
					>
						<Globe class="h-3 w-3" />
						Remote
						<ExternalLink class="h-2.5 w-2.5" />
					</span>
				</Card>
			</a>
			{#if result.cached}
				<p class="mt-2 text-center text-xs text-muted-foreground">
					Showing cached result · fetched from remote server
				</p>
			{/if}
		{:else if result?.type === 'no_results'}
			<Card class="p-8 text-center">
				<Search class="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
				<p class="font-medium">No match found</p>
				<p class="mt-1 text-sm text-muted-foreground">
					Try the full Fediverse handle, e.g.
					<code class="rounded bg-muted px-1">@alice@mastodon.social</code>
				</p>
			</Card>
		{:else if result?.type === 'error'}
			<Card class="flex items-start gap-3 border-destructive/40 bg-destructive/5 p-5">
				<AlertCircle class="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
				<p class="text-sm text-destructive">{result.message}</p>
			</Card>
		{:else if !searched}
			<!-- Empty / default state -->
			<div class="space-y-3 text-center text-sm text-muted-foreground">
				<div class="grid grid-cols-2 gap-3">
					<Card class="p-4 text-left">
						<User class="mb-2 h-5 w-5 text-violet-400" />
						<p class="font-medium text-foreground">Local users</p>
						<p class="mt-0.5 text-xs">Search people on this Polyverse instance</p>
						<code class="mt-2 block rounded bg-muted px-2 py-1 text-xs"
							>@user@polyverse-pp.vercel.app</code
						>
					</Card>
					<Card class="p-4 text-left">
						<Globe class="mb-2 h-5 w-5 text-sky-400" />
						<p class="font-medium text-foreground">Fediverse</p>
						<p class="mt-0.5 text-xs">Find anyone across Mastodon, Misskey, and more</p>
						<code class="mt-2 block rounded bg-muted px-2 py-1 text-xs">@user@mastodon.social</code>
					</Card>
				</div>
			</div>
		{/if}
	</div>

	<!-- Back link -->
	<div class="mt-10">
		<a href="/" class="text-xs text-muted-foreground underline-offset-4 hover:underline">
			← Back to home
		</a>
	</div>
</div>
