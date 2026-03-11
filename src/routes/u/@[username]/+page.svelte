<script lang="ts">
	import { Card } from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Avatar, AvatarFallback, AvatarImage } from '$lib/components/ui/avatar';
	import {
		Copy,
		LayoutGrid,
		Info,
		Activity as ActivityIcon,
		UserPlus,
		Settings,
		UserCheck,
		Loader2,
		Clock,
		UserMinus
	} from 'lucide-svelte';
	import { goto, invalidateAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import Post from '$lib/components/Post.svelte';
	import RightSidebar from '$lib/components/RightSidebar.svelte';
	import { onMount } from 'svelte';
	import type { PageData } from './$types';

	/* =========================================
	   Backend Integration Complete
	========================================= */

	// Svelte 5: Receive SSR data via props
	let { data }: { data: PageData } = $props();

	let profile = $derived(data.profile);
	let isOwner = $derived(data.isOwner);

	// Local state for posts and pagination
	let posts = $state(data.activities || []);
	let nextCursor = $state(data.nextCursor);
	let hasMore = $state(data.hasMore);
	let isLoadingMore = $state(false);
	let activeTab = $state('posts');

	// Sync posts when data changes (e.g. navigation)
	$effect(() => {
		posts = data.activities || [];
		nextCursor = data.nextCursor;
		hasMore = data.hasMore;
	});

	// Follow state
	let followStatus = $state<'none' | 'pending' | 'accepted'>(data.followStatus || 'none');
	let isFollowLoading = $state(false);

	$effect(() => {
		followStatus = data.followStatus || 'none';
	});

	async function handleFollow() {
		if (isFollowLoading) return;
		isFollowLoading = true;
		try {
			const res = await fetch('/api/follow', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ targetUsername: profile.username })
			});
			if (res.ok) {
				followStatus = 'pending';
				toast.success('Follow request sent!');
			} else {
				const err = await res.json();
				toast.error(err.message || 'Failed to send follow request');
			}
		} catch {
			toast.error('Network error');
		} finally {
			isFollowLoading = false;
		}
	}

	async function handleUnfollow() {
		if (isFollowLoading) return;
		isFollowLoading = true;
		try {
			const res = await fetch('/api/follow', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ targetUsername: profile.username })
			});
			if (res.ok) {
				followStatus = 'none';
				toast.success('Unfollowed');
				invalidateAll();
			} else {
				const err = await res.json();
				toast.error(err.message || 'Failed to unfollow');
			}
		} catch {
			toast.error('Network error');
		} finally {
			isFollowLoading = false;
		}
	}

	// Get initials for avatar fallback
	function getInitials(name: string | null, username: string): string {
		if (name) {
			return name
				.split(' ')
				.map((n) => n[0])
				.join('')
				.toUpperCase()
				.slice(0, 2);
		}
		return username.slice(0, 2).toUpperCase();
	}

	// Share Profile Link
	async function copyProfile() {
		await navigator.clipboard.writeText(window.location.href);
		toast.success('Profile link copied!');
	}

	// Copy DID
	async function copyDID() {
		if (profile.id) {
			await navigator.clipboard.writeText(profile.id);
			toast.success('DID copied to clipboard');
		}
	}

	// Load more posts
	async function loadMore() {
		if (isLoadingMore || !nextCursor) return;

		isLoadingMore = true;
		try {
			const res = await fetch(`/api/users/posts?username=${profile.username}&cursor=${nextCursor}`);
			if (res.ok) {
				const newData = await res.json();
				posts = [...posts, ...newData.activities];
				nextCursor = newData.nextCursor;
				hasMore = newData.hasMore;
			}
		} catch (err) {
			console.error('Failed to load more posts:', err);
			toast.error('Failed to load more posts');
		} finally {
			isLoadingMore = false;
		}
	}

	function handleDeletePost(id: string) {
		posts = posts.filter((p: any) => {
			const pActivity = p.activity || p;
			const pId = pActivity.object?.id || pActivity.id;
			return pId !== id;
		});
		invalidateAll();
	}

	function handleUpdatePost(updatedActivity: any) {
		posts = posts.map((p: any) => {
			const pActivity = (p as any).activity || p;
			const pId = (pActivity as any).object?.id || (pActivity as any).id;
			const uId = updatedActivity.object?.id || updatedActivity.id;
			return pId === uId ? updatedActivity : p;
		});
	}

	// Handle layout constraints for full-height scrolling on desktop vs mobile
	onMount(() => {
		const mainEl = document.querySelector<HTMLElement>('main.flex-1');

		const updateLayoutStyles = () => {
			if (!mainEl) return;
			const isDesktop = window.innerWidth > 1023;

			if (isDesktop) {
				mainEl.style.setProperty('padding-bottom', '0', 'important');
				mainEl.style.setProperty('overflow', 'hidden', 'important');
				mainEl.style.setProperty('height', '100vh', 'important');
			} else {
				mainEl.style.removeProperty('padding-bottom');
				mainEl.style.removeProperty('overflow');
				mainEl.style.removeProperty('height');
			}
		};

		// Initial update
		updateLayoutStyles();

		// Update on resize
		window.addEventListener('resize', updateLayoutStyles);

		return () => {
			window.removeEventListener('resize', updateLayoutStyles);
			if (mainEl) {
				mainEl.style.removeProperty('padding-bottom');
				mainEl.style.removeProperty('overflow');
				mainEl.style.removeProperty('height');
			}
		};
	});
</script>

<svelte:head>
	<title>{profile.displayName} (@{profile.username}) - Polyverse</title>
	<meta
		name="description"
		content={profile.bio || `${profile.displayName}'s profile on Polyverse`}
	/>
</svelte:head>

<div class="pv-profile">
	<!-- ══════════════════════════════════════════
	     COL 1 — Profile cards
	     ══════════════════════════════════════════ -->
	<aside class="pv-col-left border-r border-white/10">
		<div class="pv-left-scroll space-y-4 p-4 pb-24 lg:pb-4">
			<!-- Main Profile Card -->
			<div
				class="glass-card overflow-hidden rounded-2xl border border-white/10 bg-card/70 shadow-xl ring-1 ring-white/5 backdrop-blur-md"
			>
				<!-- Subtle banner background -->
				<div class="relative h-24 overflow-hidden bg-zinc-800/10">
					<div class="absolute inset-0 bg-linear-to-b from-transparent to-black/20"></div>
				</div>

				<div class="-mt-10 flex flex-col items-center px-4 pb-5">
					<!-- Avatar -->
					<div class="relative mb-2.5">
						<Avatar class="relative h-20 w-20 border-4 border-card shadow-xl">
							{#if profile.avatarUrl}
								<AvatarImage
									src={profile.avatarUrl}
									alt={profile.displayName || profile.username}
								/>
							{/if}
							<AvatarFallback
								class="bg-linear-to-br from-violet-500/80 to-fuchsia-500/80 text-lg font-bold text-white"
							>
								{getInitials(profile.displayName, profile.username)}
							</AvatarFallback>
						</Avatar>
					</div>

					<!-- Identity -->
					<h2 class="text-center text-lg leading-tight font-extrabold text-foreground">
						{profile.displayName || profile.username}
					</h2>
					<p
						class="mt-1 text-center text-[10px] font-bold tracking-widest text-foreground/40 uppercase"
					>
						{profile.handle}
					</p>

					<!-- Bio -->
					{#if profile.bio}
						<p class="mt-3 px-2 text-center text-xs leading-relaxed text-foreground/60">
							{profile.bio}
						</p>
					{/if}

					<!-- Action Buttons -->
					<div class="mt-4 flex w-full flex-col gap-2">
						{#if isOwner}
							<Button
								onclick={() => goto('/profile/settings')}
								class="w-full bg-violet-600 text-white shadow-lg shadow-violet-500/20 transition-all hover:scale-[1.02] hover:bg-violet-700 dark:border-0 dark:bg-linear-to-r dark:from-violet-600 dark:to-indigo-600 dark:ring-0 dark:hover:from-violet-500 dark:hover:to-indigo-500"
							>
								<Settings class="mr-2 h-4 w-4" />
								Edit Profile
							</Button>
						{:else if followStatus === 'accepted'}
							<Button
								onclick={handleUnfollow}
								disabled={isFollowLoading}
								class="w-full bg-zinc-700 text-white shadow-lg transition-all hover:scale-[1.02] hover:bg-red-600 dark:border-0 dark:ring-0"
							>
								{#if isFollowLoading}
									<Loader2 class="mr-2 h-4 w-4 animate-spin" />
								{:else}
									<UserMinus class="mr-2 h-4 w-4" />
								{/if}
								Following
							</Button>
						{:else if followStatus === 'pending'}
							<Button
								disabled
								class="w-full cursor-not-allowed bg-amber-600/20 text-amber-400 shadow-lg transition-all dark:border-0 dark:ring-0"
							>
								<Clock class="mr-2 h-4 w-4" />
								Requested
							</Button>
						{:else}
							<Button
								onclick={handleFollow}
								disabled={isFollowLoading}
								class="w-full bg-violet-600 text-white shadow-lg shadow-violet-500/20 transition-all hover:scale-[1.02] hover:bg-violet-700 dark:border-0 dark:bg-linear-to-r dark:from-violet-600 dark:to-indigo-600 dark:ring-0 dark:hover:from-violet-500 dark:hover:to-indigo-500"
							>
								{#if isFollowLoading}
									<Loader2 class="mr-2 h-4 w-4 animate-spin" />
								{:else}
									<UserPlus class="mr-2 h-4 w-4" />
								{/if}
								Follow
							</Button>
						{/if}
						<Button
							variant="outline"
							onclick={copyProfile}
							class="glass-card w-full border-white/10 text-xs hover:bg-white/5"
						>
							<Copy class="mr-1.5 h-3.5 w-3.5" />Share Profile
						</Button>
					</div>
				</div>
			</div>

			<!-- Stats Card -->
			<div
				class="glass-card overflow-hidden rounded-2xl border border-white/10 bg-card/70 shadow-xl ring-1 ring-white/5 backdrop-blur-md"
			>
				<div class="grid grid-cols-3 divide-x divide-white/10 py-4">
					<a href="/u/@{profile.username}/followers" class="flex flex-col items-center gap-0.5 rounded-lg py-1 transition-colors hover:bg-white/5">
						<span class="text-base font-black text-foreground">{profile.followersCount || 0}</span>
						<span class="text-[8px] font-bold tracking-widest text-foreground/35 uppercase"
							>Followers</span
						>
					</a>
					<a href="/u/@{profile.username}/following" class="flex flex-col items-center gap-0.5 rounded-lg py-1 transition-colors hover:bg-white/5">
						<span class="text-base font-black text-foreground">{profile.followingCount || 0}</span>
						<span class="text-[8px] font-bold tracking-widest text-foreground/35 uppercase"
							>Following</span
						>
					</a>
					<div class="flex flex-col items-center gap-0.5">
						<span class="text-base font-black text-foreground">{profile.postsCount}</span>
						<span class="text-[8px] font-bold tracking-widest text-foreground/35 uppercase"
							>Posts</span
						>
					</div>
				</div>
			</div>

			<!-- Identity Card (Updated to match Image 2) -->
			<div
				class="glass-card rounded-2xl border border-white/10 bg-card/70 p-6 shadow-xl ring-1 ring-white/5 backdrop-blur-md"
			>
				<h3 class="mb-5 flex items-center text-lg font-bold tracking-tight">
					<div
						class="mr-2 flex h-6 w-6 items-center justify-center rounded-full bg-violet-500/10 text-violet-500 ring-1 ring-violet-500/20"
					>
						<Info class="h-4 w-4" />
					</div>
					Account Details
				</h3>
				<div class="space-y-6">
					<div>
						<p class="mb-1 text-sm font-bold text-foreground">Member Since</p>
						<p class="text-[13px] text-foreground/60">
							{new Date(profile.createdAt).toLocaleDateString('en-US', {
								month: 'long',
								year: 'numeric'
							})}
						</p>
					</div>
					<div>
						<p class="mb-2 text-[10px] font-bold tracking-widest text-foreground/40 uppercase">
							Privacy Status
						</p>
						<div class="flex items-center gap-2 text-[13px] font-medium text-emerald-500">
							<UserCheck class="h-4 w-4" />
							Federated & Secure
						</div>
					</div>
				</div>
			</div>
		</div>
	</aside>

	<!-- ══════════════════════════════════════════
	     COL 2 — Tabs + posts
	     ══════════════════════════════════════════ -->
	<main class="pv-col-center">
		<!-- Sticky tabs bar (Updated to match Image 1 gradient) -->
		<div class="pv-profile-header border-b border-white/10 px-5 py-3">
			<div
				class="pv-tabs-bar glass-card grid h-14 w-full grid-cols-3 rounded-xl border border-white/10 p-1 shadow-xl ring-1 ring-violet-500/10"
			>
				<button
					type="button"
					onclick={() => (activeTab = 'posts')}
					class="pv-tab {activeTab === 'posts' ? 'pv-tab-active' : ''}"
				>
					<LayoutGrid class="mr-2 h-4 w-4" />
					Posts
				</button>
				<button
					type="button"
					onclick={() => (activeTab = 'activity')}
					class="pv-tab {activeTab === 'activity' ? 'pv-tab-active' : ''}"
				>
					<ActivityIcon class="mr-2 h-4 w-4" />
					Activity
				</button>
				<button
					type="button"
					onclick={() => (activeTab = 'about')}
					class="pv-tab {activeTab === 'about' ? 'pv-tab-active' : ''}"
				>
					<Info class="mr-2 h-4 w-4" />
					About
				</button>
			</div>
		</div>

		<!-- Scrollable content area -->
		<div class="pv-feed-scroll">
			<div class="space-y-4 px-5 py-4 pb-24">
				<!-- Posts tab -->
				{#if activeTab === 'posts'}
					<div class="flex items-center justify-between">
						<h2 class="text-xl font-bold">{isOwner ? 'Your Feed' : 'Posts'}</h2>
						{#if isOwner}
							<Button
								onclick={() => goto('/create')}
								class="bg-linear-to-r from-violet-500 to-fuchsia-500 text-white shadow-lg transition-all hover:scale-[1.05]"
							>
								Create New Post
							</Button>
						{/if}
					</div>

					{#if posts && posts.length > 0}
						{#each posts as activity (activity.id || (activity as any).object?.id)}
							<Post
								{activity}
								{isOwner}
								username={profile.username}
								onDelete={handleDeletePost}
								onUpdate={handleUpdatePost}
							/>
						{/each}

						{#if hasMore}
							<div class="flex justify-center pt-4">
								<Button
									variant="outline"
									onclick={loadMore}
									disabled={isLoadingMore}
									class="glass-card min-w-[140px] border-white/10 transition-all hover:bg-white/5 active:scale-95"
								>
									{#if isLoadingMore}
										<Loader2 class="mr-2 h-4 w-4 animate-spin" />
										Loading...
									{:else}
										Load More
									{/if}
								</Button>
							</div>
						{:else if posts.length > 5}
							<p
								class="py-8 text-center text-xs font-medium tracking-widest text-foreground/30 uppercase"
							>
								End of posts
							</p>
						{/if}
					{:else}
						<Card
							class="glass-card flex flex-col items-center border border-white/10 py-16 text-center ring-1 ring-violet-500/10"
						>
							<div
								class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-violet-500/10"
							>
								<LayoutGrid class="h-8 w-8 text-violet-500" />
							</div>
							<h3 class="mb-2 text-lg font-semibold">No posts yet</h3>
							<p class="mx-auto max-w-xs text-sm text-foreground/50">
								{isOwner
									? 'Share your first post with the federation and start owning your identity.'
									: `Check back later to see what ${profile.displayName} shares.`}
							</p>
							{#if isOwner}
								<Button
									onclick={() => goto('/create')}
									class="mt-6 bg-linear-to-r from-violet-500 to-fuchsia-500 text-white shadow-lg transition-all hover:scale-[1.05]"
								>
									Create First Post
								</Button>
							{/if}
						</Card>
					{/if}
				{/if}

				<!-- Activity tab -->
				{#if activeTab === 'activity'}
					<Card
						class="glass-card flex flex-col items-center border border-white/10 py-16 text-center ring-1 ring-violet-500/10"
					>
						<div
							class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-fuchsia-500/10"
						>
							<ActivityIcon class="h-8 w-8 text-fuchsia-500" />
						</div>
						<h3 class="mb-2 text-lg font-semibold">Activity Timeline</h3>
						<p class="mx-auto max-w-xs text-sm text-foreground/50">
							Interactions across the federation will appear here soon.
						</p>
					</Card>
				{/if}

				<!-- About / Details tab (Updated to match Image 1) -->
				{#if activeTab === 'about'}
					<Card
						class="glass-card relative overflow-hidden border border-white/10 p-10 ring-1 ring-violet-500/10"
					>
						<div class="relative z-10 space-y-12">
							<div class="space-y-4">
								<h3 class="text-2xl font-black text-foreground">Biography</h3>
								<p class="text-base leading-relaxed font-medium text-foreground/60">
									{profile.bio || 'No biography provided.'}
								</p>
							</div>

							<div class="grid grid-cols-1 gap-12 lg:grid-cols-2">
								<div class="space-y-4">
									<label
										class="text-[10px] font-black tracking-widest text-foreground/40 uppercase"
									>
										Account Handle
									</label>
									<div
										class="group flex items-center justify-between rounded-xl bg-zinc-500/5 p-4 ring-1 ring-white/5 transition-all hover:bg-zinc-500/10"
									>
										<code class="text-sm font-bold text-foreground/80">{profile.handle}</code>
										<button
											onclick={() => {
												navigator.clipboard.writeText(profile.handle);
												toast.success('Handle copied!');
											}}
											class="text-foreground/40 transition-colors hover:text-foreground"
										>
											<Copy class="h-5 w-5" />
										</button>
									</div>
								</div>

								<div class="space-y-4">
									<label
										class="text-[10px] font-black tracking-widest text-foreground/40 uppercase"
									>
										Member Since
									</label>
									<p class="text-lg font-black text-foreground">
										{new Date(profile.createdAt).toLocaleDateString('en-IN', {
											day: 'numeric',
											month: 'long',
											year: 'numeric'
										})}
									</p>
								</div>
							</div>
						</div>
					</Card>
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
	   ROOT GRID — 3 columns, full viewport height, no page scroll
	   ───────────────────────────────────────────────────────────────── */
	.pv-profile {
		display: grid;
		grid-template-columns: 320px minmax(0, 680px) 290px;
		justify-content: center;
		height: 100vh;
		overflow: hidden;
	}

	/* Shared frosted-glass panel */
	.pv-panel {
		background: color-mix(in oklch, var(--background) 88%, transparent);
		backdrop-filter: blur(20px);
	}

	/* ── LEFT column ── */
	.pv-col-left {
		display: flex;
		flex-direction: column;
		height: 100vh;
		min-height: 0;
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

	/* ── CENTER column ── */
	.pv-col-center {
		display: flex;
		flex-direction: column;
		height: 100vh;
		min-height: 0;
		overflow: hidden;
	}

	.pv-profile-header {
		flex-shrink: 0;
		background: color-mix(in oklch, var(--background) 88%, transparent);
		backdrop-filter: blur(20px);
	}

	.pv-feed-scroll {
		flex: 1 1 0;
		min-height: 0;
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
		min-height: 0;
		overflow: hidden;
	}

	.pv-right-scroll {
		flex: 1 1 0;
		overflow-y: auto;
		scrollbar-width: thin;
		scrollbar-color: color-mix(in oklch, var(--foreground) 15%, transparent) transparent;
	}
	.pv-right-scroll::-webkit-scrollbar {
		width: 4px;
	}
	.pv-right-scroll::-webkit-scrollbar-thumb {
		background: color-mix(in oklch, var(--foreground) 15%, transparent);
		border-radius: 9999px;
	}

	/* ─────────────────────────────────────────────────────────────────
	   MANUAL TAB BAR
	   ───────────────────────────────────────────────────────────────── */
	.pv-tab {
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 8px;
		font-size: 0.9375rem;
		font-weight: 600;
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
		box-shadow: 0 4px 15px -1px rgb(139 92 246 / 0.3);
	}

	/* ─────────────────────────────────────────────────────────────────
	   MOBILE — single column
	   ───────────────────────────────────────────────────────────────── */
	@media (max-width: 1023px) {
		.pv-profile {
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

		.pv-profile-header {
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
	:root:not(.dark) .pv-profile-header,
	:root:not(.dark) .pv-col-left,
	:root:not(.dark) .pv-col-right {
		background: color-mix(in oklch, var(--background) 95%, transparent);
		border-color: oklch(0 0 0 / 10%) !important;
		box-shadow: 0 1px 0 oklch(0 0 0 / 8%);
	}

	:root:not(.dark) .glass-card {
		background: white !important;
		border-color: oklch(0 0 0 / 10%) !important;
		box-shadow: 0 2px 12px -2px oklch(0 0 0 / 8%) !important;
	}
</style>
