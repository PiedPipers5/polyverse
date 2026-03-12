<script lang="ts">
	import { onMount } from 'svelte';
	import { Avatar, AvatarFallback, AvatarImage } from '$lib/components/ui/avatar';
	import { Button } from '$lib/components/ui/button';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import Post from '$lib/components/Post.svelte';
	import Composer from '$lib/components/Composer.svelte';
	import {
		Loader2,
		Rss,
		TrendingUp,
		Settings,
		LogOut,
		Sparkles,
		Bell,
		List,
		Hash,
		Star,
		Bookmark,
		AtSign,
		Home,
		MoreHorizontal,
		Search,
		ChevronDown,
		ChevronUp,
		UserPlus,
		Copy,
		Globe
	} from 'lucide-svelte';
	import LogoutConfirmModal from '$lib/components/LogoutConfirmModal.svelte';
	import { toast } from 'svelte-sonner';

	// ── Types ──────────────────────────────────────────────────────────────────
	type Author = {
		username: string;
		displayName: string | null;
		avatarUrl: string | null;
		profileUrl: string;
	};
	type FeedPost = {
		id: string;
		actorId: string;
		author: Author | null;
		isRemote: boolean;
		remoteHandle: string | null;
		activity: any;
		content: string;
		publishedAt: string;
		createdAt: string;
	};

	// ── Props ──────────────────────────────────────────────────────────────────
	let { data } = $props();

	// ── State ──────────────────────────────────────────────────────────────────
	let posts = $state<FeedPost[]>(data.posts ?? []);
	let nextCursor = $state<string | null>(data.nextCursor ?? null);
	let loadingMore = $state(false);
	let showingLogoutConfirm = $state(false);
	let totalPublicPosts = $state(data.totalPublicPosts ?? 0);
	let moreExpanded = $state(false);
	let searchQuery = $state('');
	let unreadNotifCount = $state(0);

	let user = $derived(data.currentUser);

	// Poll unread notification count every 60 seconds
	onMount(() => {
		async function fetchUnread() {
			try {
				const res = await fetch('/api/notifications');
				if (res.ok) {
					const d = await res.json();
					unreadNotifCount = d.unreadCount ?? 0;
				}
			} catch { /* ignore */ }
		}
		fetchUnread();
		const iv = setInterval(fetchUnread, 60_000);
		return () => clearInterval(iv);
	});

	// ── Search filtering ───────────────────────────────────────────────────────
	let filteredPosts = $derived(
		searchQuery.trim() === ''
			? posts
			: posts.filter((p) => {
					const q = searchQuery.toLowerCase();
					const authorMatch =
						(p.author?.displayName?.toLowerCase().includes(q) ?? false) ||
						(p.author?.username?.toLowerCase().includes(q) ?? false);
					const contentMatch = p.content?.toLowerCase().includes(q) ?? false;
					return authorMatch || contentMatch;
				})
	);

	// ── Trending / suggestions data ────────────────────────────────────────────
	let trends = [
		{ tag: '#Federation', posts: '2.4k', category: 'TECHNOLOGY' },
		{ tag: '#PrivacyFirst', posts: '1.8k', category: 'TRENDING' },
		{ tag: '#Polyverse', posts: '1.2k', category: 'TRENDING' },
		{ tag: '#Web3', posts: '850', category: 'CRYPTO' },
		{ tag: '#DigitalIdentity', posts: '640', category: 'TRENDING' }
	];

	let suggestions = [
		{ name: 'Alice Smith', handle: '@alice' },
		{ name: 'Bob Nexus', handle: '@bob_n' },
		{ name: 'Crystal Clear', handle: '@crystal' }
	];

	// ── Helpers ────────────────────────────────────────────────────────────────
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

	// ── Load more ──────────────────────────────────────────────────────────────
	async function loadMore() {
		if (!nextCursor || loadingMore) return;
		loadingMore = true;
		try {
			const res = await fetch(`/api/feed?before=${encodeURIComponent(nextCursor)}`);
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const d = await res.json();
			posts = [...posts, ...(d.posts ?? [])];
			nextCursor = d.nextCursor ?? null;
		} catch (err) {
			console.error('Failed to load more:', err);
		} finally {
			loadingMore = false;
		}
	}

	// ── Share profile ─────────────────────────────────────────────────────────
	async function copyProfile() {
		try {
			await navigator.clipboard.writeText(window.location.origin + `/u/@${user?.username}`);
			toast.success('Profile link copied to clipboard!');
		} catch {
			toast.error('Could not copy — please copy the URL manually.');
		}
	}

	// ── Post created ───────────────────────────────────────────────────────────
	function handlePostCreated(newPost: any) {
		const wrapped: FeedPost = {
			id: newPost.id || crypto.randomUUID(),
			actorId: user?.id || '',
			author: user
				? {
						username: user.username,
						displayName: user.displayName,
						avatarUrl: user.avatarUrl,
						profileUrl: `/u/@${user.username}`
					}
				: null,
			isRemote: false,
			remoteHandle: null,
			activity: newPost,
			content: newPost.object?.content || newPost.content || '',
			publishedAt: new Date().toISOString(),
			createdAt: new Date().toISOString()
		};
		posts = [wrapped, ...posts];
		totalPublicPosts += 1;
	}

	function noop() {}

	// ── Override global dock padding so the 100vh grid works (DESKTOP ONLY) ───
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
	<title>Feed – Polyverse</title>
	<meta name="description" content="Public timeline of all posts on this Polyverse instance." />
</svelte:head>

<!-- 
  3-column fixed-height grid.
  Only the center column scrolls.
  Left & right are overflow:hidden → completely static.
-->
<div class="pv-feed">
	<!-- ══════════════════════════════════════════
	     COL 1 — Search + profile mini card
	     ══════════════════════════════════════════ -->
	<aside class="pv-col-left pv-panel border-r border-white/10">
		<!-- Search bar -->
		<div class="px-4 pt-5 pb-3">
			<div class="relative">
				<Search
					class="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-foreground/35"
				/>
				<input
					type="search"
					placeholder="Search Polyverse…"
					bind:value={searchQuery}
					class="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pr-4 pl-9 text-sm text-foreground transition-all
					       placeholder:text-foreground/30 focus:border-violet-500/50 focus:bg-white/8 focus:ring-1 focus:ring-violet-500/30 focus:outline-none"
				/>
			</div>
		</div>

		<!-- Profile card below search -->
		{#if user}
			<div
				class="profile-card mx-2 mb-3 overflow-hidden rounded-2xl border border-white/10 shadow-xl"
			>
				<!-- Gradient banner -->
				<div class="relative h-24 overflow-hidden">
					<div
						class="animate-gradient absolute inset-0 bg-linear-to-br from-violet-500/70 via-purple-500/60 to-fuchsia-500/70"
					></div>
					<div class="absolute inset-0 bg-linear-to-b from-transparent to-card/70"></div>
				</div>

				<div class="-mt-10 flex flex-col items-center px-4 pb-5">
					<!-- Avatar -->
					<div class="relative mb-2.5">
						<div
							class="absolute -inset-1 animate-pulse rounded-full bg-linear-to-r from-violet-500 to-fuchsia-500 opacity-50 blur-md"
						></div>
						<Avatar class="relative h-20 w-20 border-4 border-card shadow-xl">
							{#if user.avatarUrl}
								<AvatarImage src={user.avatarUrl} alt={user.displayName || user.username} />
							{/if}
							<AvatarFallback
								class="bg-linear-to-br from-violet-500 to-fuchsia-500 text-lg font-bold text-white"
							>
								{getInitials(user.displayName, user.username)}
							</AvatarFallback>
						</Avatar>
					</div>

					<!-- Name & handle -->
					<h2 class="gradient-text text-center text-lg leading-tight font-extrabold">
						{user.displayName || user.username}
					</h2>
					<p
						class="mt-1 text-center text-[11px] font-bold tracking-wider text-foreground/40 uppercase"
					>
						{user.handle}
					</p>

					<!-- Bio -->
					{#if user.bio}
						<p class="mt-2.5 text-center text-xs leading-relaxed text-foreground/60 italic">
							"{user.bio}"
						</p>
					{/if}

					<!-- Stats -->
					<div class="mt-4 w-full rounded-xl border border-white/10 bg-white/5">
						<div class="grid grid-cols-3 divide-x divide-white/10 py-3">
							<div class="flex flex-col items-center gap-0.5">
								<span class="text-lg font-black">{user.followersCount}</span>
								<span class="text-[9px] font-bold tracking-widest text-foreground/35 uppercase"
									>Followers</span
								>
							</div>
							<div class="flex flex-col items-center gap-0.5">
								<span class="text-lg font-black">{user.followingCount}</span>
								<span class="text-[9px] font-bold tracking-widest text-foreground/35 uppercase"
									>Following</span
								>
							</div>
							<div class="flex flex-col items-center gap-0.5">
								<span class="text-lg font-black">{user.postsCount}</span>
								<span class="text-[9px] font-bold tracking-widest text-foreground/35 uppercase"
									>Posts</span
								>
							</div>
						</div>
					</div>

					<!-- Action buttons -->
					<div class="mt-3 flex w-full flex-col gap-2">
						<a href="/profile" class="w-full">
							<Button
								class="w-full bg-linear-to-r from-violet-500 to-fuchsia-500 text-white shadow-lg shadow-violet-500/20 transition-all hover:scale-[1.02]"
							>
								<Settings class="mr-2 h-4 w-4" />
								My Profile
							</Button>
						</a>
						<div class="flex gap-2">
							<Button
								variant="outline"
								class="glass-card flex-1 border-white/10 text-xs hover:bg-white/5"
								onclick={copyProfile}
							>
								<Copy class="mr-1.5 h-3.5 w-3.5" />Share
							</Button>
							<Button
								variant="ghost"
								onclick={() => (showingLogoutConfirm = true)}
								class="flex-1 text-xs text-destructive hover:bg-destructive/10"
							>
								<LogOut class="mr-1.5 h-3.5 w-3.5" />Logout
							</Button>
						</div>
					</div>
				</div>
			</div>
		{/if}

		<!-- Spacer -->
		<div class="flex-1"></div>

		<!-- Footer links at bottom -->
		<div class="border-t border-white/8 px-4 py-3">
			<div class="flex flex-wrap gap-x-2.5 gap-y-1">
				<a
					href="/docs"
					class="text-[10px] text-foreground/30 transition-colors hover:text-foreground/60">Terms</a
				>
				<a
					href="/docs"
					class="text-[10px] text-foreground/30 transition-colors hover:text-foreground/60"
					>Privacy</a
				>
			</div>
			<p class="mt-1 text-[10px] text-foreground/20">© 2026 Piedpipers.</p>
		</div>
	</aside>

	<!-- ══════════════════════════════════════════
	     COL 2 — Feed (only this column scrolls)
	     ══════════════════════════════════════════ -->
	<main class="pv-col-center">
		<!-- Sticky header — never scrolls -->
		<div class="pv-feed-header pv-panel border-b border-white/10 px-5 py-3.5">
			<div class="flex items-center gap-3">
				<div
					class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-violet-500 to-fuchsia-500 shadow-md shadow-violet-500/30"
				>
					<Rss class="h-4 w-4 text-white" />
				</div>
				<div>
					<h1 class="text-base leading-tight font-bold">Local Feed</h1>
					<p class="text-[11px] text-muted-foreground">
						{totalPublicPosts}
						{totalPublicPosts === 1 ? 'post' : 'posts'} · public timeline
					</p>
				</div>
				<!-- Load more button — always visible in header -->
				{#if nextCursor}
					<button
						type="button"
						onclick={loadMore}
						disabled={loadingMore}
						class="ml-auto flex items-center gap-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1.5 text-xs font-semibold text-violet-400 transition-all hover:border-violet-500/60 hover:bg-violet-500/20 hover:text-violet-300 disabled:opacity-60"
					>
						{#if loadingMore}
							<Loader2 class="h-3 w-3 animate-spin" />
							Loading…
						{:else}
							<Sparkles class="h-3 w-3" />
							Load more
						{/if}
					</button>
				{:else}
					<div
						class="ml-auto flex items-center gap-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-400"
					>
						<Sparkles class="h-3 w-3" />
						Live
					</div>
				{/if}
			</div>
		</div>

		<!-- Scrollable posts area -->
		<div class="pv-feed-scroll">
			<div class="space-y-4 px-4 py-4">
				<!-- Composer -->
				{#if user}
					<div
						class="overflow-hidden rounded-2xl border border-white/10 bg-card/80 shadow-xl ring-1 ring-white/5 backdrop-blur-sm"
					>
						<div class="flex items-center gap-3 border-b border-white/8 px-4 py-3">
							<Avatar class="h-9 w-9 shrink-0 ring-2 ring-violet-500/20">
								{#if user.avatarUrl}
									<AvatarImage src={user.avatarUrl} alt={user.displayName || user.username} />
								{/if}
								<AvatarFallback
									class="bg-linear-to-br from-violet-500 to-fuchsia-500 text-xs font-bold text-white"
								>
									{getInitials(user.displayName, user.username)}
								</AvatarFallback>
							</Avatar>
							<span class="text-sm text-foreground/50">
								What's on your mind, <span class="font-semibold text-foreground/70"
									>{user.displayName || user.username}</span
								>?
							</span>
						</div>
						<Composer username={user.username} onPostCreated={handlePostCreated} />
					</div>
				{/if}

				<!-- Empty state -->
				{#if filteredPosts.length === 0}
					<div class="flex flex-col items-center justify-center py-20 text-center">
						<div
							class="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-500/10 ring-1 ring-violet-500/20"
						>
							<Rss class="h-7 w-7 text-violet-400/60" />
						</div>
						{#if searchQuery.trim()}
							<p class="font-semibold text-foreground/50">No posts match "{searchQuery}"</p>
							<p class="mt-1 text-sm text-muted-foreground">Try a different search term.</p>
						{:else}
							<p class="font-semibold text-foreground/50">No public posts yet</p>
							<p class="mt-1 text-sm text-muted-foreground">Be the first to share something!</p>
						{/if}
					</div>
				{:else}
					{#each filteredPosts as post (post.id)}
						<div
							class="feed-card overflow-hidden rounded-2xl border shadow-xl ring-1 backdrop-blur-sm
							       {post.isRemote
								? 'border-teal-500/20 bg-card/80 ring-teal-500/5'
								: 'border-white/10 bg-card/80 ring-white/5'}"
						>
							{#if post.author}
								<a
									href={post.author.profileUrl}
									target={post.isRemote ? '_blank' : undefined}
									rel={post.isRemote ? 'noopener noreferrer' : undefined}
									class="flex items-center gap-3 border-b border-white/8 px-4 py-3 transition-colors hover:bg-white/5"
								>
									<Avatar
										class="h-10 w-10 shrink-0 ring-2
										       {post.isRemote ? 'ring-teal-400/40' : 'ring-white/10'}"
									>
										{#if post.author.avatarUrl}
											<AvatarImage
												src={post.author.avatarUrl}
												alt={post.author.displayName || post.author.username}
											/>
										{/if}
										<AvatarFallback
											class="{post.isRemote
												? 'bg-linear-to-br from-teal-500 to-cyan-500'
												: 'bg-linear-to-br from-violet-500 to-fuchsia-500'} text-xs font-bold text-white"
										>
											{getInitials(post.author.displayName, post.author.username)}
										</AvatarFallback>
									</Avatar>
									<div class="min-w-0 flex-1">
										<div class="flex items-center gap-2">
											<p class="truncate text-sm leading-tight font-bold">
												{post.author.displayName || post.author.username}
											</p>
											{#if post.isRemote}
												<span class="remote-badge">
													<Globe class="h-2.5 w-2.5" />
													Remote
												</span>
											{/if}
										</div>
										<p class="truncate text-xs text-muted-foreground">
											{#if post.isRemote && post.remoteHandle}
												@{post.remoteHandle}
											{:else}
												@{post.author.username}
											{/if}
										</p>
									</div>
									<span class="ml-auto shrink-0 text-xs text-foreground/30 tabular-nums"
										>{relativeTime(post.publishedAt)}</span
									>
								</a>
							{/if}
							<div class="px-1 py-1">
								<Post
									activity={post}
									isOwner={user?.username === post.author?.username}
									username={user?.username ?? ''}
									isFavorited={post.isFavorited ?? false}
									onDelete={noop}
									onUpdate={noop}
								/>
							</div>
						</div>
					{/each}

					<!-- Load more / end of feed — always visible -->
					<div class="flex flex-col items-center gap-2 py-6">
						{#if nextCursor}
							<Button
								variant="outline"
								onclick={loadMore}
								disabled={loadingMore}
								class="glass-card border-white/10 px-10 py-2.5 text-sm font-semibold transition-all hover:border-violet-500/40 hover:bg-white/5 hover:text-violet-300"
							>
								{#if loadingMore}
									<Loader2 class="mr-2 h-4 w-4 animate-spin" />
									Loading more posts…
								{:else}
									Load more posts
								{/if}
							</Button>
						{:else}
							<div class="flex items-center gap-2 text-xs text-muted-foreground/40">
								<div class="h-px w-16 bg-white/8"></div>
								<span>You're all caught up</span>
								<div class="h-px w-16 bg-white/8"></div>
							</div>
						{/if}
					</div>
				{/if}
			</div>
		</div>
	</main>

	<!-- ══════════════════════════════════════════
	     COL 3 — Mastodon-style navigation sidebar
	     ══════════════════════════════════════════ -->
	<aside class="pv-col-right pv-panel border-l border-white/10">
		<!-- Logo -->
		<div class="flex items-center gap-3 px-6 pt-5 pb-4">
			<img src="/pied-piper.svg" alt="Polyverse" class="h-9 w-9 drop-shadow-xl" />
			<span class="gradient-text text-lg font-extrabold tracking-tight">Polyverse</span>
		</div>

		<!-- Nav items -->
		<nav class="flex flex-col gap-0.5 px-3">
			<!-- Home -->
			<a href="/feed" class="nav-link active">
				<Home class="nav-icon text-violet-400" />
				<span>Home</span>
			</a>

			<!-- Trending -->
			<a href="/trending" class="nav-link">
				<TrendingUp class="nav-icon" />
				<span>Trending</span>
			</a>

			<!-- Notifications -->
			<a href="/notifications" class="nav-link relative">
				<Bell class="nav-icon" />
				<span>Notifications</span>
				{#if unreadNotifCount > 0}
					<span
						class="absolute -top-1 left-3 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow-md shadow-rose-500/30"
					>
						{unreadNotifCount > 99 ? '99+' : unreadNotifCount}
					</span>
				{/if}
			</a>

			<div class="mx-1 my-2 h-px bg-white/8"></div>

			<!-- Lists -->
			<a href="#" class="nav-link">
				<List class="nav-icon" />
				<span>Lists</span>
			</a>

			<!-- Followed hashtags -->
			<a href="#" class="nav-link">
				<Hash class="nav-icon" />
				<span>Followed hashtags</span>
			</a>

			<!-- Favourites -->
			<a href="/favorites" class="nav-link">
				<Star class="nav-icon" />
				<span>Favourites</span>
			</a>

			<!-- Bookmarks -->
			<a href="#" class="nav-link">
				<Bookmark class="nav-icon" />
				<span>Bookmarks</span>
			</a>

			<!-- Private mentions -->
			<a href="#" class="nav-link">
				<AtSign class="nav-icon" />
				<span>Private mentions</span>
			</a>

			<div class="mx-1 my-2 h-px bg-white/8"></div>

			<!-- Preferences -->
			<a href="/profile/settings" class="nav-link">
				<Settings class="nav-icon" />
				<span>Preferences</span>
			</a>

			<!-- More -->
			<button
				type="button"
				onclick={() => (moreExpanded = !moreExpanded)}
				class="nav-link w-full text-left"
			>
				<MoreHorizontal class="nav-icon" />
				<span>More</span>
				<span class="ml-auto">
					{#if moreExpanded}
						<ChevronUp class="h-3.5 w-3.5 text-foreground/30" />
					{:else}
						<ChevronDown class="h-3.5 w-3.5 text-foreground/30" />
					{/if}
				</span>
			</button>

			<!-- More expanded — About + logout -->
			{#if moreExpanded}
				<div
					class="ml-2 overflow-hidden rounded-xl border border-white/10 bg-card/80 shadow-xl backdrop-blur-md"
				>
					<a
						href="/"
						class="flex w-full items-center gap-3 px-4 py-3 text-sm font-medium text-foreground/60 transition-colors hover:bg-white/5 hover:text-foreground"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-4 w-4 shrink-0"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg
						>
						<span>About Polyverse</span>
					</a>
					<div class="mx-3 h-px bg-white/8"></div>
					<button
						type="button"
						onclick={() => (showingLogoutConfirm = true)}
						class="flex w-full items-center gap-3 px-4 py-3 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
					>
						<LogOut class="h-4 w-4 shrink-0" />
						<span>Log out</span>
					</button>
				</div>
			{/if}
		</nav>

		<!-- Footer -->
		<div class="mt-auto border-t border-white/8 px-5 py-4">
			<div class="flex flex-wrap gap-x-3 gap-y-1">
				<a
					href="/docs"
					class="text-[10px] text-foreground/30 transition-colors hover:text-foreground/60">Terms</a
				>
				<a
					href="/docs"
					class="text-[10px] text-foreground/30 transition-colors hover:text-foreground/60"
					>Privacy</a
				>
				<a
					href="/docs"
					class="text-[10px] text-foreground/30 transition-colors hover:text-foreground/60"
					>Federation</a
				>
			</div>
			<p class="mt-1.5 text-[10px] text-foreground/20">© 2026 Piedpipers.</p>
		</div>
	</aside>
</div>

<LogoutConfirmModal bind:open={showingLogoutConfirm} />

<style>
	/* ─────────────────────────────────────────────────────────────────
	   ROOT GRID — 3 columns, full viewport height, no page scroll
	   Only .pv-feed-scroll scrolls.
	   ───────────────────────────────────────────────────────────────── */
	.pv-feed {
		display: grid;
		/* 285px left | capped center | 285px right — centered on wide screens */
		grid-template-columns: 285px minmax(0, 600px) 285px;
		justify-content: center;
		height: 100vh;
		overflow: hidden;
	}

	/* Shared panel base — frosted glass */
	.pv-panel {
		background: color-mix(in oklch, var(--background) 88%, transparent);
		backdrop-filter: blur(20px);
	}

	/* ── LEFT column ── */
	.pv-col-left {
		display: flex;
		flex-direction: column;
		height: 100vh;
		overflow: hidden;
	}

	/* ── CENTER column ── */
	.pv-col-center {
		display: flex;
		flex-direction: column;
		height: 100vh;
		overflow: hidden;
	}

	/* Sticky feed header — pinned to top of center column */
	.pv-feed-header {
		flex-shrink: 0;
	}

	/* The only scrollable region in the entire page */
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

	/* ── RIGHT column ── */
	.pv-col-right {
		display: flex;
		flex-direction: column;
		height: 100vh;
		overflow: hidden;
	}

	/* ─────────────────────────────────────────────────────────────────
	   NAV LINKS (right column)
	   ───────────────────────────────────────────────────────────────── */
	:global(.nav-link) {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 14px;
		border-radius: 12px;
		font-size: 0.9rem;
		font-weight: 500;
		color: color-mix(in oklch, var(--foreground) 60%, transparent);
		transition:
			background 0.15s ease,
			color 0.15s ease,
			transform 0.1s ease;
		text-decoration: none;
	}
	:global(.nav-link:hover) {
		background: color-mix(in oklch, var(--foreground) 6%, transparent);
		color: var(--foreground);
		transform: translateX(2px);
	}
	:global(.nav-link.active) {
		background: color-mix(in oklch, #8b5cf6 12%, transparent);
		color: #c4b5fd;
		box-shadow: inset 0 0 0 1px color-mix(in oklch, #8b5cf6 25%, transparent);
	}
	:global(.nav-icon) {
		width: 1.2rem;
		height: 1.2rem;
		flex-shrink: 0;
		color: color-mix(in oklch, var(--foreground) 40%, transparent);
	}
	:global(.nav-link.active .nav-icon) {
		color: #a78bfa;
	}
	:global(.nav-link:hover .nav-icon) {
		color: color-mix(in oklch, var(--foreground) 70%, transparent);
	}

	/* ─────────────────────────────────────────────────────────────────
	   POST CARDS
	   ───────────────────────────────────────────────────────────────── */
	.feed-card {
		transition:
			box-shadow 0.25s ease,
			transform 0.2s ease;
	}
	.feed-card:hover {
		transform: translateY(-1px);
		box-shadow: 0 8px 32px -4px color-mix(in oklch, #8b5cf6 12%, transparent);
	}

	/* Remote post badge */
	:global(.remote-badge) {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		padding: 1px 6px;
		border-radius: 9999px;
		font-size: 0.6rem;
		font-weight: 700;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: #2dd4bf;
		background: color-mix(in oklch, #14b8a6 15%, transparent);
		border: 1px solid color-mix(in oklch, #14b8a6 30%, transparent);
		flex-shrink: 0;
	}

	/* ─────────────────────────────────────────────────────────────────
	   MOBILE FALLBACK — single scrollable column
	   ───────────────────────────────────────────────────────────────── */
	@media (max-width: 1023px) {
		.pv-feed {
			grid-template-columns: 1fr;
			height: auto;
			overflow: visible;
			max-width: 100vw;
		}
		.pv-col-left,
		.pv-col-right {
			display: none;
		}
		.pv-col-center {
			height: auto;
			overflow: visible;
			max-width: 100vw;
		}
		.pv-feed-header {
			position: sticky;
			top: 0;
			z-index: 30;
			/* Account for notch / status bar */
			padding-top: env(safe-area-inset-top, 0px);
		}
		.pv-feed-scroll {
			overflow: visible;
			/* Extra bottom padding for dock + safe area */
			padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 1rem);
		}
	}

	/* ─────────────────────────────────────────────────────────────────
	   LIGHT MODE OVERRIDES
	   All the `border-white/*` and `bg-white/*` classes are invisible
	   on the white light-mode background — override them here.
	   ───────────────────────────────────────────────────────────────── */
	:root:not(.dark) .pv-panel {
		background: color-mix(in oklch, var(--background) 95%, transparent);
		border-color: oklch(0 0 0 / 8%) !important;
		box-shadow: 0 1px 0 oklch(0 0 0 / 8%);
	}

	/* Sidebar column borders */
	:root:not(.dark) .pv-col-left,
	:root:not(.dark) .pv-col-right {
		background: oklch(0.97 0.005 255);
		border-color: oklch(0 0 0 / 10%) !important;
	}

	/* Feed header border bottom */
	:root:not(.dark) .pv-feed-header {
		background: oklch(0.97 0.005 255 / 92%);
		border-color: oklch(0 0 0 / 10%) !important;
	}

	/* Post cards — replace invisible bg-card/80 + ring-white with visible light card */
	:root:not(.dark) .feed-card {
		background: white;
		border-color: oklch(0 0 0 / 10%) !important;
		box-shadow: 0 2px 12px -2px oklch(0 0 0 / 8%);
	}
	:root:not(.dark) .feed-card:hover {
		border-color: oklch(0.55 0.2 270 / 30%) !important;
		box-shadow: 0 6px 24px -4px oklch(0.55 0.2 270 / 15%);
	}

	/* Nav link active state stays violet in light mode */
	:root:not(.dark) :global(.nav-link.active) {
		background: oklch(0.55 0.2 270 / 10%);
		color: oklch(0.45 0.2 270);
	}
	:root:not(.dark) :global(.nav-link:hover) {
		background: oklch(0 0 0 / 5%);
		color: var(--foreground);
	}
	:root:not(.dark) :global(.nav-icon) {
		color: oklch(0 0 0 / 45%);
	}
	:root:not(.dark) :global(.nav-link.active .nav-icon) {
		color: oklch(0.5 0.22 270);
	}

	/* Profile card banner and card background */
	:root:not(.dark) .profile-card {
		background: white;
		border-color: oklch(0 0 0 / 10%) !important;
		box-shadow: 0 2px 16px -4px oklch(0 0 0 / 10%);
	}

	/* Scrollbar — lighter in light mode */
	:root:not(.dark) .pv-feed-scroll {
		scrollbar-color: oklch(0 0 0 / 15%) transparent;
	}

	/* Composer / post input backdrop */
	:root:not(.dark) .pv-feed-scroll .backdrop-blur-sm {
		background: white !important;
		border-color: oklch(0 0 0 / 10%) !important;
	}
</style>
