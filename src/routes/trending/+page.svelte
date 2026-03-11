<script lang="ts">
	import { onMount } from 'svelte';
	import { Avatar, AvatarFallback, AvatarImage } from '$lib/components/ui/avatar';
	import { Button } from '$lib/components/ui/button';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import {
		TrendingUp,
		Globe,
		Heart,
		Repeat2,
		MessageCircle,
		ExternalLink,
		Loader2,
		Hash,
		Users,
		BarChart3,
		RefreshCw,
		Flame
	} from 'lucide-svelte';
	import RightSidebar from '$lib/components/RightSidebar.svelte';

	// ── Props ───────────────────────────────────────────────────────
	let { data } = $props();

	// ── State ───────────────────────────────────────────────────────
	type Tab = 'statuses' | 'tags';
	let activeTab = $state<Tab>('statuses');
	let statuses = $state<any[]>([]);
	let tags = $state<any[]>([]);
	let fetchedAt = $state<string | null>(null);
	let instances = $state<string[]>([]);
	let loading = $state(false);
	let selectedInstance = $state<string | null>(null);

	// Initialize from server data
	$effect(() => {
		if (data.trendingStatuses?.statuses) statuses = data.trendingStatuses.statuses;
		if (data.trendingTags?.tags) tags = data.trendingTags.tags;
		if (data.trendingStatuses?.fetchedAt) fetchedAt = data.trendingStatuses.fetchedAt;
		if (data.trendingStatuses?.instances) instances = data.trendingStatuses.instances;
	});

	// ── Derived ─────────────────────────────────────────────────────
	let filteredStatuses = $derived(
		selectedInstance
			? statuses.filter((s: any) => s.instance === selectedInstance)
			: statuses
	);

	// ── Helpers ─────────────────────────────────────────────────────
	function getInitials(name: string | null, fallback = '') {
		const n = name || fallback;
		if (!n) return '??';
		return n
			.split(' ')
			.map((w) => w[0])
			.join('')
			.toUpperCase()
			.slice(0, 2);
	}

	function relativeTime(dateStr: string): string {
		const diff = Date.now() - new Date(dateStr).getTime();
		const s = Math.floor(diff / 1000);
		if (s < 60) return `${s}s`;
		const m = Math.floor(s / 60);
		if (m < 60) return `${m}m`;
		const h = Math.floor(m / 60);
		if (h < 24) return `${h}h`;
		return `${Math.floor(h / 24)}d`;
	}

	function formatNumber(n: number): string {
		if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
		if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
		return n.toString();
	}

	function stripHtml(html: string): string {
		return html.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
	}

	// ── Refresh ─────────────────────────────────────────────────────
	async function refresh() {
		loading = true;
		try {
			const [sRes, tRes] = await Promise.all([
				fetch('/api/trending?type=statuses'),
				fetch('/api/trending?type=tags')
			]);
			if (sRes.ok) {
				const d = await sRes.json();
				statuses = d.statuses ?? [];
				fetchedAt = d.fetchedAt;
				instances = d.instances ?? [];
			}
			if (tRes.ok) {
				const d = await tRes.json();
				tags = d.tags ?? [];
			}
		} catch (err) {
			console.error('Failed to refresh trending:', err);
		} finally {
			loading = false;
		}
	}

	// Auto-refresh every 5 minutes
	onMount(() => {
		const iv = setInterval(refresh, 5 * 60 * 1000);
		return () => clearInterval(iv);
	});

	// ── Override global dock padding so 100vh grid works ────────────
	onMount(() => {
		const mainEl = document.querySelector<HTMLElement>('main.flex-1');
		const isDesktop = window.matchMedia('(min-width: 1024px)');
		function applyDesktopOverride(matches: boolean) {
			if (!mainEl) return;
			if (matches) {
				mainEl.style.setProperty('padding-bottom', '0', 'important');
				mainEl.style.setProperty('overflow', 'hidden', 'important');
			} else {
				mainEl.style.removeProperty('padding-bottom');
				mainEl.style.removeProperty('overflow');
			}
		}
		applyDesktopOverride(isDesktop.matches);
		isDesktop.addEventListener('change', (e) => applyDesktopOverride(e.matches));
		return () => {
			if (mainEl) {
				mainEl.style.removeProperty('padding-bottom');
				mainEl.style.removeProperty('overflow');
			}
			isDesktop.removeEventListener('change', (e: MediaQueryListEvent) =>
				applyDesktopOverride(e.matches)
			);
		};
	});
</script>

<svelte:head>
	<title>Trending – Polyverse</title>
	<meta
		name="description"
		content="Discover trending posts and hashtags from across the fediverse."
	/>
</svelte:head>

<div class="pv-trending">
	<!-- ══════════════════════════════════════════
	     COL 1 — Filters & Instance selector
	     ══════════════════════════════════════════ -->
	<aside class="pv-col-left pv-panel border-r border-white/10">
		<div class="pv-left-scroll space-y-4 p-4">
			<!-- Header -->
			<div class="flex items-center gap-3 px-1 pt-1 pb-2">
				<div
					class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-orange-500 to-rose-500 shadow-md shadow-orange-500/30"
				>
					<Flame class="h-5 w-5 text-white" />
				</div>
				<div>
					<h1 class="text-base leading-tight font-bold">Trending</h1>
					<p class="text-[11px] text-muted-foreground">Across the fediverse</p>
				</div>
			</div>

			<!-- Instance Filters -->
			<div
				class="glass-card overflow-hidden rounded-2xl border border-white/10 bg-card/70 shadow-xl ring-1 ring-white/5 backdrop-blur-md"
			>
				<div class="border-b border-white/8 px-4 py-3">
					<h3
						class="flex items-center text-[10px] font-bold tracking-widest text-foreground/40 uppercase"
					>
						<Globe class="mr-1.5 h-3.5 w-3.5 text-teal-400" />
						Source Instances
					</h3>
				</div>
				<div class="space-y-0.5 p-2">
					<button
						type="button"
						onclick={() => (selectedInstance = null)}
						class="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all
							   {selectedInstance === null
							? 'bg-violet-500/15 text-violet-300 ring-1 ring-violet-500/25'
							: 'text-foreground/60 hover:bg-white/5 hover:text-foreground'}"
					>
						<div
							class="flex h-7 w-7 items-center justify-center rounded-lg bg-linear-to-br from-violet-500/20 to-fuchsia-500/20"
						>
							<Globe class="h-3.5 w-3.5 text-violet-400" />
						</div>
						All Instances
					</button>
					{#each instances as inst}
						<button
							type="button"
							onclick={() => (selectedInstance = selectedInstance === inst ? null : inst)}
							class="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all
								   {selectedInstance === inst
								? 'bg-teal-500/15 text-teal-300 ring-1 ring-teal-500/25'
								: 'text-foreground/60 hover:bg-white/5 hover:text-foreground'}"
						>
							<div
								class="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-500/10"
							>
								<Globe class="h-3.5 w-3.5 text-teal-400/60" />
							</div>
							{inst}
						</button>
					{/each}
				</div>
			</div>

			<!-- Refresh button -->
			<Button
				variant="outline"
				onclick={refresh}
				disabled={loading}
				class="glass-card w-full border-white/10 text-sm hover:bg-white/5"
			>
				{#if loading}
					<Loader2 class="mr-2 h-4 w-4 animate-spin" />
					Refreshing…
				{:else}
					<RefreshCw class="mr-2 h-4 w-4" />
					Refresh Trends
				{/if}
			</Button>

			{#if fetchedAt}
				<p class="text-center text-[10px] text-foreground/25">
					Updated {relativeTime(fetchedAt)} ago
				</p>
			{/if}
		</div>
	</aside>

	<!-- ══════════════════════════════════════════
	     COL 2 — Main Content
	     ══════════════════════════════════════════ -->
	<main class="pv-col-center">
		<!-- Sticky tab header -->
		<div class="pv-trending-header pv-panel border-b border-white/10 px-5 py-3">
			<div
				class="pv-tabs-bar glass-card grid h-12 w-full grid-cols-2 rounded-xl border border-white/10 p-1 shadow-xl ring-1 ring-violet-500/10"
			>
				<button
					type="button"
					onclick={() => (activeTab = 'statuses')}
					class="pv-tab {activeTab === 'statuses' ? 'pv-tab-active' : ''}"
				>
					<TrendingUp class="mr-2 h-4 w-4" />
					Trending Posts
				</button>
				<button
					type="button"
					onclick={() => (activeTab = 'tags')}
					class="pv-tab {activeTab === 'tags' ? 'pv-tab-active' : ''}"
				>
					<Hash class="mr-2 h-4 w-4" />
					Trending Tags
				</button>
			</div>
		</div>

		<!-- Scrollable content -->
		<div class="pv-feed-scroll">
			<div class="space-y-4 px-4 py-4 pb-24">
				<!-- ── STATUSES TAB ──────────────────────────────────────── -->
				{#if activeTab === 'statuses'}
					{#if filteredStatuses.length === 0}
						<div class="flex flex-col items-center justify-center py-20 text-center">
							<div
								class="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-500/10 ring-1 ring-orange-500/20"
							>
								<TrendingUp class="h-7 w-7 text-orange-400/60" />
							</div>
							<p class="font-semibold text-foreground/50">No trending posts found</p>
							<p class="mt-1 text-sm text-muted-foreground">
								Try refreshing or selecting a different instance.
							</p>
						</div>
					{:else}
						{#each filteredStatuses as status (status.url)}
							<div
								class="trending-card overflow-hidden rounded-2xl border border-white/10 bg-card/80 shadow-xl ring-1 ring-white/5 backdrop-blur-sm transition-all hover:border-white/20 hover:shadow-2xl"
							>
								<!-- Author header -->
								<a
									href={status.account?.url || status.url}
									target="_blank"
									rel="noopener noreferrer"
									class="flex items-center gap-3 border-b border-white/8 px-4 py-3 transition-colors hover:bg-white/5"
								>
									<Avatar
										class="h-10 w-10 shrink-0 ring-2 ring-teal-400/30"
									>
										{#if status.account?.avatar}
											<AvatarImage
												src={status.account.avatar}
												alt={status.account.display_name || status.account.username}
											/>
										{/if}
										<AvatarFallback
											class="bg-linear-to-br from-teal-500 to-cyan-500 text-xs font-bold text-white"
										>
											{getInitials(
												status.account?.display_name,
												status.account?.username
											)}
										</AvatarFallback>
									</Avatar>
									<div class="min-w-0 flex-1">
										<div class="flex items-center gap-2">
											<p class="truncate text-sm leading-tight font-bold">
												{status.account?.display_name || status.account?.username}
											</p>
											<span class="remote-badge">
												<Globe class="h-2.5 w-2.5" />
												{status.instance}
											</span>
										</div>
										<p class="truncate text-xs text-muted-foreground">
											@{status.account?.acct}
										</p>
									</div>
									<span class="ml-auto shrink-0 text-xs text-foreground/30 tabular-nums"
										>{relativeTime(status.created_at)}</span
									>
								</a>

								<!-- Content -->
								<div class="px-4 py-3">
									<div class="prose-sm prose-invert text-sm leading-relaxed text-foreground/80">
										{@html status.content}
									</div>

									<!-- Media preview -->
									{#if status.media_attachments?.length > 0}
										<div
											class="mt-3 grid gap-2 {status.media_attachments.length > 1
												? 'grid-cols-2'
												: 'grid-cols-1'}"
										>
											{#each status.media_attachments.slice(0, 4) as media}
												{#if media.type === 'image'}
													<img
														src={media.preview_url || media.url}
														alt={media.description || 'Post image'}
														class="w-full rounded-xl border border-white/10 object-cover"
														style="max-height: 200px"
														loading="lazy"
													/>
												{/if}
											{/each}
										</div>
									{/if}
								</div>

								<!-- Engagement bar -->
								<div
									class="flex items-center gap-6 border-t border-white/8 px-4 py-2.5 text-xs text-foreground/40"
								>
									<span class="flex items-center gap-1.5">
										<MessageCircle class="h-3.5 w-3.5" />
										{formatNumber(status.replies_count || 0)}
									</span>
									<span class="flex items-center gap-1.5 text-emerald-400/60">
										<Repeat2 class="h-3.5 w-3.5" />
										{formatNumber(status.reblogs_count || 0)}
									</span>
									<span class="flex items-center gap-1.5 text-rose-400/60">
										<Heart class="h-3.5 w-3.5" />
										{formatNumber(status.favourites_count || 0)}
									</span>
									<a
										href={status.url}
										target="_blank"
										rel="noopener noreferrer"
										class="ml-auto flex items-center gap-1 text-teal-400 transition-colors hover:text-teal-300"
									>
										<ExternalLink class="h-3 w-3" />
										View on {status.instance}
									</a>
								</div>
							</div>
						{/each}
					{/if}
				{/if}

				<!-- ── TAGS TAB ──────────────────────────────────────────── -->
				{#if activeTab === 'tags'}
					{#if tags.length === 0}
						<div class="flex flex-col items-center justify-center py-20 text-center">
							<div
								class="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-500/10 ring-1 ring-violet-500/20"
							>
								<Hash class="h-7 w-7 text-violet-400/60" />
							</div>
							<p class="font-semibold text-foreground/50">No trending tags found</p>
							<p class="mt-1 text-sm text-muted-foreground">
								Try refreshing or come back later.
							</p>
						</div>
					{:else}
						<div class="space-y-3">
							{#each tags as tag, i (tag.name)}
								<a
									href={tag.url}
									target="_blank"
									rel="noopener noreferrer"
									class="trending-card group flex items-center gap-4 rounded-2xl border border-white/10 bg-card/80 px-5 py-4 shadow-xl ring-1 ring-white/5 backdrop-blur-sm transition-all hover:border-violet-500/30 hover:shadow-2xl"
								>
									<!-- Rank -->
									<span
										class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg font-black
											   {i < 3
											? 'bg-linear-to-br from-orange-500/20 to-rose-500/20 text-orange-400 ring-1 ring-orange-500/20'
											: 'bg-white/5 text-foreground/25'}"
									>
										{i + 1}
									</span>

									<!-- Tag info -->
									<div class="min-w-0 flex-1">
										<p
											class="text-base font-bold text-violet-400 group-hover:underline"
										>
											#{tag.name}
										</p>
										<div class="mt-1 flex items-center gap-4 text-xs text-foreground/40">
											<span class="flex items-center gap-1">
												<BarChart3 class="h-3 w-3" />
												{formatNumber(tag.totalUses || 0)} posts
											</span>
											<span class="flex items-center gap-1">
												<Users class="h-3 w-3" />
												{formatNumber(tag.totalAccounts || 0)} people
											</span>
										</div>
									</div>

									<!-- Sparkline-style mini bar chart -->
									{#if tag.history?.length}
										<div class="flex items-end gap-0.5">
											{#each tag.history.slice(0, 7).reverse() as day}
												{@const uses = parseInt(day.uses || '0')}
												{@const maxUses = Math.max(
													...tag.history.map(
														(h: { uses: string }) => parseInt(h.uses || '0')
													),
													1
												)}
												<div
													class="w-1.5 rounded-full bg-violet-500/40"
													style="height: {Math.max(4, (uses / maxUses) * 28)}px"
												></div>
											{/each}
										</div>
									{/if}

									<ExternalLink
										class="h-4 w-4 shrink-0 text-foreground/20 transition-colors group-hover:text-teal-400"
									/>
								</a>
							{/each}
						</div>
					{/if}
				{/if}
			</div>
		</div>
	</main>

	<!-- ══════════════════════════════════════════
	     COL 3 — Right sidebar
	     ══════════════════════════════════════════ -->
	<aside class="pv-col-right pv-panel border-l border-white/10">
		<div class="pv-right-scroll">
			<RightSidebar />
		</div>
	</aside>
</div>

<style>
	/* ─────────────────────────────────────────────────────────────────
	   ROOT GRID
	   ───────────────────────────────────────────────────────────────── */
	.pv-trending {
		display: grid;
		grid-template-columns: 285px minmax(0, 600px) 285px;
		justify-content: center;
		height: 100vh;
		overflow: hidden;
	}

	.pv-panel {
		background: color-mix(in oklch, var(--background) 88%, transparent);
		backdrop-filter: blur(20px);
	}

	.pv-col-left {
		display: flex;
		flex-direction: column;
		height: 100vh;
		overflow: hidden;
	}

	.pv-left-scroll {
		flex: 1 1 0;
		overflow-y: auto;
		scrollbar-width: thin;
		scrollbar-color: color-mix(in oklch, var(--foreground) 15%, transparent) transparent;
	}
	.pv-left-scroll::-webkit-scrollbar {
		width: 4px;
	}
	.pv-left-scroll::-webkit-scrollbar-thumb {
		background: color-mix(in oklch, var(--foreground) 15%, transparent);
		border-radius: 9999px;
	}

	.pv-col-center {
		display: flex;
		flex-direction: column;
		height: 100vh;
		overflow: hidden;
	}

	.pv-trending-header {
		flex-shrink: 0;
	}

	.pv-feed-scroll {
		flex: 1 1 0;
		overflow-y: auto;
		scrollbar-width: thin;
		scrollbar-color: color-mix(in oklch, var(--foreground) 15%, transparent) transparent;
	}
	.pv-feed-scroll::-webkit-scrollbar {
		width: 4px;
	}
	.pv-feed-scroll::-webkit-scrollbar-thumb {
		background: color-mix(in oklch, var(--foreground) 15%, transparent);
		border-radius: 9999px;
	}

	.pv-col-right {
		display: flex;
		flex-direction: column;
		height: 100vh;
		overflow: hidden;
	}

	.pv-right-scroll {
		flex: 1 1 0;
		overflow-y: auto;
		scrollbar-width: thin;
		scrollbar-color: color-mix(in oklch, var(--foreground) 15%, transparent) transparent;
	}

	/* ─────────────────────────────────────────────────────────────────
	   TABS
	   ───────────────────────────────────────────────────────────────── */
	.pv-tab {
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 8px;
		font-size: 0.875rem;
		font-weight: 500;
		color: color-mix(in oklch, var(--foreground) 55%, transparent);
		transition:
			background 0.15s ease,
			color 0.15s ease;
		cursor: pointer;
		border: none;
		background: transparent;
	}
	.pv-tab:hover {
		background: color-mix(in oklch, var(--foreground) 6%, transparent);
		color: var(--foreground);
	}
	.pv-tab-active {
		background: linear-gradient(to right, #8b5cf6, #d946ef) !important;
		color: white !important;
	}

	/* ─────────────────────────────────────────────────────────────────
	   TRENDING CARDS
	   ───────────────────────────────────────────────────────────────── */
	.trending-card {
		transition:
			box-shadow 0.25s ease,
			border-color 0.25s ease,
			transform 0.15s ease;
	}
	.trending-card:hover {
		transform: translateY(-1px);
	}

	/* Remote badge — same as feed */
	:global(.remote-badge) {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		padding: 1px 7px;
		border-radius: 9999px;
		background: color-mix(in oklch, #14b8a6 15%, transparent);
		color: #5eead4;
		font-size: 0.625rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		border: 1px solid color-mix(in oklch, #14b8a6 25%, transparent);
		white-space: nowrap;
	}

	/* ─────────────────────────────────────────────────────────────────
	   MOBILE
	   ───────────────────────────────────────────────────────────────── */
	@media (max-width: 1023px) {
		.pv-trending {
			display: flex;
			flex-direction: column;
			height: auto !important;
			min-height: 0 !important;
			overflow: visible !important;
			max-width: 100vw;
		}

		.pv-col-left {
			height: auto !important;
			min-height: auto !important;
			overflow: visible !important;
		}

		.pv-left-scroll {
			overflow: visible !important;
			flex: none !important;
		}

		.pv-col-center {
			height: auto !important;
			min-height: auto !important;
			overflow: visible !important;
			max-width: 100vw;
		}

		.pv-trending-header {
			position: sticky;
			top: 0;
			z-index: 30;
			padding-top: env(safe-area-inset-top, 0px);
		}

		.pv-feed-scroll {
			overflow: visible !important;
			flex: none !important;
			padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 1rem);
		}

		.pv-col-right {
			display: none !important;
		}
	}

	/* ─────────────────────────────────────────────────────────────────
	   LIGHT MODE
	   ───────────────────────────────────────────────────────────────── */
	:root:not(.dark) .pv-panel,
	:root:not(.dark) .pv-trending-header {
		background: color-mix(in oklch, var(--background) 95%, transparent);
		border-color: oklch(0 0 0 / 10%) !important;
		box-shadow: 0 1px 0 oklch(0 0 0 / 8%);
	}

	:root:not(.dark) .trending-card {
		background: white !important;
		border-color: oklch(0 0 0 / 10%) !important;
		box-shadow: 0 2px 12px -2px oklch(0 0 0 / 8%) !important;
	}
</style>
