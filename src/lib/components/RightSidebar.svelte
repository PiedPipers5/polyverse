<script lang="ts">
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Avatar, AvatarFallback, AvatarImage } from '$lib/components/ui/avatar';
	import { TrendingUp, UserPlus, Info, ExternalLink, Loader2, Hash } from 'lucide-svelte';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';

	let suggestions = $derived($page.data.suggestions || []);

	// ── Live trending tags from the fediverse ────────────────────
	let trendingTags = $state<
		Array<{ name: string; url: string; totalUses?: number; totalAccounts?: number }>
	>([]);
	let loadingTrends = $state(true);

	onMount(async () => {
		try {
			const res = await fetch('/api/trending?type=tags');
			if (res.ok) {
				const data = await res.json();
				trendingTags = (data.tags ?? []).slice(0, 5);
			}
		} catch (err) {
			console.warn('Failed to load trending tags:', err);
		} finally {
			loadingTrends = false;
		}
	});

	function formatNumber(n: number): string {
		if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
		if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
		return n.toString();
	}

	function getInitials(name: string): string {
		return name
			.split(' ')
			.map((n) => n[0])
			.join('')
			.toUpperCase();
	}
</script>

<div class="sticky top-20 flex flex-col gap-6">
	<!-- Trending Section -->
	<Card class="glass-card overflow-hidden border-none shadow-xl">
		<CardHeader class="pt-5 pb-3">
			<CardTitle class="flex items-center gap-2 text-lg font-bold">
				<TrendingUp class="h-5 w-5 text-violet-500" />
				Trending Topics
			</CardTitle>
		</CardHeader>
		<CardContent class="grid gap-4">
			{#if loadingTrends}
				<div class="flex items-center justify-center py-4">
					<Loader2 class="h-5 w-5 animate-spin text-foreground/30" />
				</div>
			{:else if trendingTags.length > 0}
				{#each trendingTags as tag}
					<a
						href={tag.url}
						target="_blank"
						rel="noopener noreferrer"
						class="group cursor-pointer"
					>
						<p class="text-sm font-bold text-violet-500 group-hover:underline">
							#{tag.name}
						</p>
						<p class="text-[10px] font-medium tracking-tighter text-foreground/40 uppercase">
							{formatNumber(tag.totalUses || 0)} posts · {formatNumber(tag.totalAccounts || 0)} people
						</p>
					</a>
				{/each}
			{:else}
				<p class="py-2 text-center text-xs text-foreground/30">No trends available</p>
			{/if}
			<Button
				variant="ghost"
				class="mt-2 w-full text-xs text-sky-500 hover:bg-sky-500/5 hover:text-sky-600"
				href="/trending"
			>
				Show More
			</Button>
		</CardContent>
	</Card>

	<!-- Suggested Users -->
	<Card class="glass-card overflow-hidden border-none shadow-xl">
		<CardHeader class="pt-5 pb-3">
			<CardTitle class="flex items-center gap-2 text-lg font-bold">
				<UserPlus class="h-5 w-5 text-emerald-500" />
				Who to follow
			</CardTitle>
		</CardHeader>
		<CardContent class="grid gap-4">
			<div class="scrollbar-hide flex max-h-[400px] flex-col gap-4 overflow-y-auto pr-1">
				{#each suggestions as user}
					<div class="flex items-center justify-between gap-3">
						<div class="flex min-w-0 items-center gap-2">
							<Avatar class="h-9 w-9 border-2 border-background shadow-md">
								<AvatarImage src={user.avatarUrl} alt={user.displayName || user.username} />
								<AvatarFallback class="bg-muted text-[10px] font-bold">
									{getInitials(user.displayName || user.username)}
								</AvatarFallback>
							</Avatar>
							<div class="min-w-0">
								<p class="mb-1 truncate text-sm leading-none font-bold">
									{user.displayName || user.username}
								</p>
								<p class="truncate text-xs leading-none text-foreground/40">@{user.username}</p>
							</div>
						</div>
						<Button
							size="sm"
							variant="outline"
							class="glass-card h-8 border-white/10 px-3 text-xs hover:bg-white/5"
							href={`/u/@${user.username}`}
						>
							View
						</Button>
					</div>
				{/each}
			</div>
			<Button
				variant="ghost"
				class="mt-2 w-full text-xs text-emerald-500 hover:bg-emerald-500/5 hover:text-emerald-600"
				href="/search"
			>
				Find People
			</Button>
		</CardContent>
	</Card>

	<!-- Footer Links -->
	<div class="flex flex-wrap gap-x-4 gap-y-2 px-4">
		<a
			href="/docs"
			class="text-[10px] text-foreground/30 transition-colors hover:text-foreground/60"
			>Terms of Service</a
		>
		<a
			href="/docs"
			class="text-[10px] text-foreground/30 transition-colors hover:text-foreground/60"
			>Privacy Policy</a
		>
		<a
			href="/docs"
			class="text-[10px] text-foreground/30 transition-colors hover:text-foreground/60"
			>Federation Status</a
		>
		<p class="mt-2 w-full text-[10px] text-foreground/20">© 2026 Piedpipers.</p>
	</div>
</div>
