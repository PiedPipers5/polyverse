<script lang="ts">
	import { Card, CardContent } from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Avatar, AvatarFallback, AvatarImage } from '$lib/components/ui/avatar';
	import {
		Copy,
		Settings,
		LogOut,
		UserCheck,
		LayoutGrid,
		Info,
		Activity as ActivityIcon,
		Bell,
		UserPlus,
		Loader2,
		Check,
		X
	} from 'lucide-svelte';
	import { goto, invalidateAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import Post from '$lib/components/Post.svelte';
	import LogoutConfirmModal from '$lib/components/LogoutConfirmModal.svelte';
	import RightSidebar from '$lib/components/RightSidebar.svelte';
	import { untrack, onMount } from 'svelte';
	import { fade, scale } from 'svelte/transition';

	type Tab = 'posts' | 'activity' | 'about';
	let activeTab = $state<Tab>('posts');

	// Get data from server load function (Svelte 5 syntax)
	let { data } = $props();

	// User data from server
	let user = $derived(data.user);

	// Local state for posts to allow optimistic updates
	let posts = $state(untrack(() => data.activities || []));
	let postsCount = $state(untrack(() => data.user.postsCount || 0));

	let showingLogoutConfirm = $state(false);
	let avatarLightboxOpen = $state(false);

	// Pending follow requests
	type PendingRequest = {
		id: string;
		follower: { username: string; displayName: string | null; avatarUrl: string | null } | null;
		createdAt: Date;
	};
	let pendingRequests = $state<PendingRequest[]>(untrack(() => data.pendingRequests || []));
	let processingIds = $state<Set<string>>(new Set());

	async function handleFollowAction(followerUsername: string, action: 'accept' | 'reject') {
		processingIds = new Set([...processingIds, followerUsername]);
		try {
			const res = await fetch('/api/follow/accept', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ followerUsername, action })
			});
			if (res.ok) {
				pendingRequests = pendingRequests.filter((r) => r.follower?.username !== followerUsername);
				toast.success(
					action === 'accept' ? `Accepted @${followerUsername}` : `Rejected @${followerUsername}`
				);
				if (action === 'accept') invalidateAll();
			} else {
				const err = await res.json();
				toast.error(err.message || 'Failed');
			}
		} catch {
			toast.error('Network error');
		} finally {
			const next = new Set(processingIds);
			next.delete(followerUsername);
			processingIds = next;
		}
	}

	// Get initials for avatar fallback
	function getInitials(name: string | null, username: string): string {
		if (name) {
			return name
				.split(' ')
				.map((n) => n[0])
				.join('')
				.slice(0, 2)
				.toUpperCase();
		}
		return username.slice(0, 2).toUpperCase();
	}

	// Share Profile Link..
	async function copyProfile() {
		await navigator.clipboard.writeText(window.location.href);
		toast.success('Profile link copied!');
	}

	// Copy handle
	async function copyHandle() {
		await navigator.clipboard.writeText(user.handle);
		toast.success('Handle copied!');
	}

	// Copy DID
	async function copyDID() {
		await navigator.clipboard.writeText(user.did);
		toast.success('DID copied!');
	}

	function handleDeletePost(id: string) {
		posts = posts.filter((p) => {
			const apActivity = (p as any).activity || p;
			const objectId = (apActivity as any).object?.id || (apActivity as any).id;
			return objectId !== id;
		});

		postsCount -= 1;
		invalidateAll();
	}

	function handleUpdatePost(updatedActivity: any) {
		posts = posts.map((p) => {
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
	<title>Profile – Polyverse</title>
	<meta name="description" content="Your Polyverse profile." />
</svelte:head>

<div class="pv-profile">
	<!-- ══════════════════════════════════════════
	     COL 1 — Profile card (fixed, feed-style)
	     ══════════════════════════════════════════ -->
	<aside class="pv-col-left border-r border-white/10">
		<!-- Content scrollable within col 1 -->
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
						<!-- svelte-ignore a11y_interactive_supports_focus -->
						<!-- svelte-ignore a11y_click_events_have_key_events -->
						<div
							role="button"
							onclick={() => { if (user.avatarUrl) avatarLightboxOpen = true; }}
							class="{user.avatarUrl ? 'cursor-pointer' : ''} group relative"
						>
							<Avatar class="relative h-20 w-20 border-4 border-card shadow-xl transition-transform duration-200 {user.avatarUrl ? 'group-hover:scale-105' : ''}">
								{#if user.avatarUrl}
									<AvatarImage src={user.avatarUrl} alt={user.displayName || user.username} />
								{/if}
								<AvatarFallback
									class="bg-linear-to-br from-violet-500/80 to-fuchsia-500/80 text-lg font-bold text-white"
								>
									{getInitials(user.displayName, user.username)}
								</AvatarFallback>
							</Avatar>
							{#if user.avatarUrl}
								<div class="pointer-events-none absolute inset-0 flex items-center justify-center rounded-full bg-black/0 opacity-0 transition-all duration-200 group-hover:bg-black/30 group-hover:opacity-100">
									<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0zm-6-3v6m-3-3h6" /></svg>
								</div>
							{/if}
						</div>
					</div>

					<!-- Identity -->
					<h2 class="text-center text-lg leading-tight font-extrabold text-foreground">
						{user.displayName || user.username}
					</h2>
					<p
						class="mt-1 text-center text-[10px] font-bold tracking-widest text-foreground/40 uppercase"
					>
						{user.handle}
					</p>

					<!-- Bio -->
					{#if user.bio}
						<p class="mt-3 px-2 text-center text-xs leading-relaxed text-foreground/60">
							{user.bio}
						</p>
					{/if}

					<!-- Action Buttons -->
					<div class="mt-4 flex w-full flex-col gap-2">
						<Button
							onclick={() => goto('/profile/settings')}
							class="w-full bg-violet-600 text-white shadow-lg shadow-violet-500/20 transition-all hover:scale-[1.02] hover:bg-violet-700 dark:border-0 dark:bg-linear-to-r dark:from-violet-600 dark:to-indigo-600 dark:ring-0 dark:hover:from-violet-500 dark:hover:to-indigo-500"
						>
							<Settings class="mr-2 h-4 w-4" />
							Edit Profile
						</Button>
						<div class="flex gap-2">
							<Button
								variant="outline"
								onclick={copyProfile}
								class="glass-card flex-1 border-white/10 text-xs hover:bg-white/5"
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

			<!-- Stats Card -->
			<div
				class="glass-card overflow-hidden rounded-2xl border border-white/10 bg-card/70 shadow-xl ring-1 ring-white/5 backdrop-blur-md"
			>
				<div class="grid grid-cols-3 divide-x divide-white/10 py-4">
					<div class="flex flex-col items-center gap-0.5">
						<span class="text-base font-black text-foreground">{user.followersCount || 0}</span>
						<span class="text-[8px] font-bold tracking-widest text-foreground/35 uppercase"
							>Followers</span
						>
					</div>
					<div class="flex flex-col items-center gap-0.5">
						<span class="text-base font-black text-foreground">{user.followingCount || 0}</span>
						<span class="text-[8px] font-bold tracking-widest text-foreground/35 uppercase"
							>Following</span
						>
					</div>
					<div class="flex flex-col items-center gap-0.5">
						<span class="text-base font-black text-foreground">{postsCount}</span>
						<span class="text-[8px] font-bold tracking-widest text-foreground/35 uppercase"
							>Posts</span
						>
					</div>
				</div>
			</div>

			<!-- Identity Card -->
			<div
				class="glass-card rounded-2xl border border-white/10 bg-card/70 p-4 shadow-xl ring-1 ring-white/5 backdrop-blur-md"
			>
				<h3
					class="mb-3 flex items-center text-[10px] font-bold tracking-widest text-foreground/40 uppercase"
				>
					<Info class="mr-1.5 h-3.5 w-3.5 text-violet-400" />
					Federated Identity
				</h3>
				<div class="space-y-4 text-xs text-foreground/60">
					<div>
						<p class="mb-1.5 text-[10px] font-medium text-foreground/40 uppercase">
							DID Identifier
						</p>
						<div
							class="flex items-center justify-between rounded-lg bg-zinc-500/10 p-2.5 ring-1 ring-black/5 dark:bg-black/20 dark:ring-white/5"
						>
							<code class="font-mono text-[9px] break-all opacity-75">{user.did}</code>
							<Button size="icon" variant="ghost" onclick={copyDID} class="ml-1 h-5 w-5 shrink-0">
								<Copy class="h-3 w-3" />
							</Button>
						</div>
					</div>
					<div
						class="flex items-center justify-between border-t border-black/5 pt-3 dark:border-white/5"
					>
						<p class="text-[10px] font-medium text-foreground/40">Joined</p>

						<p class="text-[11px] font-bold text-foreground/80">
							{new Date(user.createdAt).toLocaleDateString('en-IN', {
								month: 'long',
								year: 'numeric'
							})}
						</p>
					</div>
				</div>
			</div>
		</div>
	</aside>

	<!-- ══════════════════════════════════════════
	     COL 2 — Tabs + posts
	     Sticky tab bar + separate scrollable body
	     ══════════════════════════════════════════ -->
	<main class="pv-col-center">
		<!-- Sticky tabs bar - shrinks to its own height -->
		<div class="pv-profile-header border-b border-white/10 px-5 py-3">
			<div
				class="pv-tabs-bar glass-card grid h-12 w-full grid-cols-3 rounded-xl border border-white/10 p-1 shadow-xl ring-1 ring-violet-500/10"
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
					class="pv-tab relative {activeTab === 'activity' ? 'pv-tab-active' : ''}"
				>
					<Bell class="mr-2 h-4 w-4" />
					Requests
					{#if pendingRequests.length > 0}
						<span
							class="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-lg"
						>
							{pendingRequests.length}
						</span>
					{/if}
				</button>
				<button
					type="button"
					onclick={() => (activeTab = 'about')}
					class="pv-tab {activeTab === 'about' ? 'pv-tab-active' : ''}"
				>
					<Info class="mr-2 h-4 w-4" />
					Details
				</button>
			</div>
		</div>

		<!-- Scrollable content area — same pattern as feed's pv-feed-scroll -->
		<div class="pv-feed-scroll">
			<div class="space-y-4 px-5 py-4 pb-24">
				<!-- Posts tab -->
				{#if activeTab === 'posts'}
					<div class="flex items-center justify-between">
						<h2 class="text-xl font-bold">Your Feed</h2>
						<Button
							onclick={() => goto('/create')}
							class="bg-linear-to-r from-violet-500 to-fuchsia-500 text-white shadow-lg transition-all hover:scale-[1.05]"
						>
							Create New Post
						</Button>
					</div>

					{#if posts && posts.length > 0}
						{#each posts as activity (activity.id || (activity as any).object?.id)}
							<Post
								{activity}
								isOwner={true}
								username={user.username}
								isFavorited={(activity as any).isFavorited ?? false}
								onDelete={handleDeletePost}
								onUpdate={handleUpdatePost}
							/>
						{/each}
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
								Share your first post with the federation and start owning your identity.
							</p>
							<Button
								onclick={() => goto('/create')}
								class="mt-6 bg-linear-to-r from-violet-500 to-fuchsia-500 text-white shadow-lg transition-all hover:scale-[1.05]"
							>
								Create First Post
							</Button>
						</Card>
					{/if}
				{/if}

				<!-- Activity tab -->
				{#if activeTab === 'activity'}
					<div class="space-y-3">
						<h2 class="text-xl font-bold">Follow Requests</h2>
						{#if pendingRequests.length === 0}
							<Card
								class="glass-card flex flex-col items-center border border-white/10 py-16 text-center ring-1 ring-violet-500/10"
							>
								<div
									class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10"
								>
									<UserCheck class="h-8 w-8 text-emerald-500" />
								</div>
								<h3 class="mb-2 text-lg font-semibold">All caught up!</h3>
								<p class="mx-auto max-w-xs text-sm text-foreground/50">
									You have no pending follow requests.
								</p>
							</Card>
						{:else}
							{#each pendingRequests as req (req.id)}
								<div
									class="glass-card flex items-center gap-4 rounded-2xl border border-white/10 p-4 shadow-lg ring-1 ring-violet-500/10 transition-all"
								>
									<!-- Avatar -->
									<Avatar class="h-12 w-12 shrink-0 ring-2 ring-violet-500/20">
										{#if req.follower?.avatarUrl}
											<AvatarImage
												src={req.follower.avatarUrl}
												alt={req.follower.displayName || req.follower.username}
											/>
										{/if}
										<AvatarFallback
											class="bg-linear-to-br from-violet-500 to-fuchsia-500 text-sm font-bold text-white"
										>
											{getInitials(
												req.follower?.displayName || null,
												req.follower?.username || '??'
											)}
										</AvatarFallback>
									</Avatar>

									<!-- Info -->
									<div class="min-w-0 flex-1">
										<a
											href="/u/@{req.follower?.username}"
											class="text-sm font-bold hover:underline"
										>
											{req.follower?.displayName || req.follower?.username}
										</a>
										<p class="text-xs text-foreground/40">
											@{req.follower?.username} wants to follow you
										</p>
									</div>

									<!-- Actions -->
									<div class="flex gap-2">
										<Button
											size="sm"
											onclick={() => handleFollowAction(req.follower!.username, 'accept')}
											disabled={processingIds.has(req.follower?.username || '')}
											class="bg-emerald-600 text-white hover:bg-emerald-700"
										>
											{#if processingIds.has(req.follower?.username || '')}
												<Loader2 class="h-4 w-4 animate-spin" />
											{:else}
												<Check class="mr-1 h-4 w-4" /> Accept
											{/if}
										</Button>
										<Button
											size="sm"
											variant="outline"
											onclick={() => handleFollowAction(req.follower!.username, 'reject')}
											disabled={processingIds.has(req.follower?.username || '')}
											class="border-white/10 text-red-400 hover:bg-red-500/10"
										>
											<X class="mr-1 h-4 w-4" /> Reject
										</Button>
									</div>
								</div>
							{/each}
						{/if}
					</div>
				{/if}

				<!-- About / Details tab -->
				{#if activeTab === 'about'}
					<Card class="glass-card border border-white/10 p-8 ring-1 ring-violet-500/10">
						<div class="grid grid-cols-1 gap-8 md:grid-cols-2">
							<div class="space-y-6">
								<div>
									<label
										class="mb-2 block text-xs font-semibold tracking-wider text-foreground/50 uppercase"
										>Account Handle</label
									>
									<div class="flex items-center justify-between rounded-lg bg-white/5 p-3">
										<code class="text-sm font-medium">{user.handle}</code>
										<Button size="icon" variant="ghost" onclick={copyHandle} class="h-8 w-8">
											<Copy class="h-4 w-4" />
										</Button>
									</div>
								</div>
								<div>
									<label
										class="mb-2 block text-xs font-semibold tracking-wider text-foreground/50 uppercase"
										>Decentralized ID</label
									>
									<div class="flex items-center justify-between rounded-lg bg-white/5 p-3">
										<code class="text-xs break-all opacity-80">{user.did}</code>
										<Button size="icon" variant="ghost" onclick={copyDID} class="h-8 w-8">
											<Copy class="h-4 w-4" />
										</Button>
									</div>
								</div>
							</div>
							<div class="space-y-6">
								<div>
									<label
										class="mb-2 block text-xs font-semibold tracking-wider text-foreground/50 uppercase"
										>Privacy Network</label
									>
									<div class="flex items-center gap-2 rounded-lg bg-white/5 p-3">
										<UserCheck class="h-5 w-5 text-emerald-500" />
										<span class="text-sm font-medium">Fully Federated & Encrypted</span>
									</div>
								</div>
								<div>
									<label
										class="mb-2 block text-xs font-semibold tracking-wider text-foreground/50 uppercase"
										>Member Since</label
									>
									<p class="p-3 text-sm font-medium">
										{new Date(user.createdAt).toLocaleDateString('en-IN', {
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
	     COL 3 — Right sidebar (scrolls)
	     ══════════════════════════════════════════ -->
	<aside class="pv-col-right pv-panel border-l border-white/10">
		<div class="pv-right-scroll">
			<RightSidebar />
		</div>
	</aside>
</div>

<LogoutConfirmModal bind:open={showingLogoutConfirm} />

<!-- Avatar Lightbox -->
{#if avatarLightboxOpen && user.avatarUrl}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-sm"
		onclick={() => (avatarLightboxOpen = false)}
		transition:fade={{ duration: 200 }}
	>
		<!-- Close button -->
		<button
			class="absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md transition-colors hover:bg-white/20"
			onclick={() => (avatarLightboxOpen = false)}
			aria-label="Close"
		>
			<X class="h-5 w-5" />
		</button>

		<!-- Avatar image -->
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<div transition:scale={{ duration: 200, start: 0.85 }} onclick={(e) => e.stopPropagation()}>
			<img
				src={user.avatarUrl}
				alt={user.displayName || user.username}
				class="max-h-[80vh] max-w-[80vw] rounded-2xl object-contain shadow-2xl ring-4 ring-white/10"
			/>
			<p class="mt-3 text-center text-sm font-semibold text-white/70">{user.displayName || user.username}</p>
		</div>
	</div>
{/if}

<style>
	/* ─────────────────────────────────────────────────────────────────
	   ROOT GRID — 3 columns, full viewport height, no page scroll
	   ───────────────────────────────────────────────────────────────── */
	.pv-profile {
		display: grid;
		grid-template-columns: 300px minmax(0, 600px) 285px;
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

	/* The scrollable part inside left col (everything below the banner) */
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

	/* Sticky tabs bar — pinned to top of center col */
	.pv-profile-header {
		flex-shrink: 0;
		background: color-mix(in oklch, var(--background) 88%, transparent);
		backdrop-filter: blur(20px);
	}

	/* Scrollable posts region — mirrors feed's pv-feed-scroll exactly */
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
	   MOBILE — single column, profile first then scrollable content
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
