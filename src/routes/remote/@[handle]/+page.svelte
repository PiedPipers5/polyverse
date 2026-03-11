<script lang="ts">
	import { Card } from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Avatar, AvatarFallback, AvatarImage } from '$lib/components/ui/avatar';
	import {
		Copy,
		LayoutGrid,
		UserPlus,
		UserCheck,
		Loader2,
		Clock,
		UserMinus,
		Globe,
		ExternalLink
	} from 'lucide-svelte';
	import { invalidateAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import Post from '$lib/components/Post.svelte';
	import RightSidebar from '$lib/components/RightSidebar.svelte';
	import { onMount } from 'svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let profile = $derived(data.profile);
	let posts = $derived(data.activities || []);
	
	let followStatus = $state<'none' | 'pending' | 'accepted'>(data.followStatus || 'none');
	let isFollowLoading = $state(false);

	$effect(() => {
		followStatus = data.followStatus || 'none';
	});

	// Follow remote user using existing API
	async function handleFollow() {
		if (isFollowLoading) return;
		isFollowLoading = true;
		try {
			// We pass the full handle for remote users
			const res = await fetch('/api/follow', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ targetUsername: profile.handle.replace('@', '') })
			});
			if (res.ok) {
				followStatus = 'pending';
				toast.success('Follow request sent seamlessly to remote server!');
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
				body: JSON.stringify({ targetUsername: profile.handle.replace('@', '') })
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

	function getInitials(name: string | null, username: string): string {
		if (name) {
			return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
		}
		return username.slice(0, 2).toUpperCase();
	}

	async function copyProfile() {
		await navigator.clipboard.writeText(profile.id);
		toast.success('Remote profile URL copied!');
	}

	// Layout script
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
		updateLayoutStyles();
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
	<title>{profile.displayName} ({profile.handle}) - Polyverse Federated Profile</title>
</svelte:head>

<div class="pv-profile">
	<!-- COL 1: Profile Card -->
	<aside class="pv-col-left border-r border-white/10">
		<div class="pv-left-scroll space-y-4 p-4 pb-24 lg:pb-4">
			<div class="glass-card overflow-hidden rounded-2xl border border-white/10 bg-card/70 shadow-xl ring-1 ring-sky-500/10 backdrop-blur-md">
				<div class="relative h-24 overflow-hidden bg-sky-900/10">
					<div class="absolute inset-0 bg-gradient-to-b from-transparent to-black/30"></div>
				</div>

				<div class="-mt-10 flex flex-col items-center px-4 pb-5">
					<!-- Avatar -->
					<div class="relative mb-2.5">
						<Avatar class="relative h-20 w-20 border-4 border-card shadow-xl">
							{#if profile.avatarUrl}
								<AvatarImage src={profile.avatarUrl} alt={profile.displayName} />
							{/if}
							<AvatarFallback class="bg-gradient-to-br from-sky-500/80 to-indigo-500/80 text-lg font-bold text-white">
								{getInitials(profile.displayName, profile.username)}
							</AvatarFallback>
						</Avatar>
						<div class="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-card bg-sky-500 text-white">
							<Globe class="h-3 w-3" />
						</div>
					</div>

					<h2 class="text-center text-lg leading-tight font-extrabold text-foreground">
						{profile.displayName}
					</h2>
					<p class="mt-1 text-center text-[10px] font-bold tracking-widest text-sky-500 uppercase">
						{profile.handle}
					</p>

					{#if profile.bio}
						<p class="mt-3 px-2 text-center text-xs leading-relaxed text-foreground/60">
							{profile.bio}
						</p>
					{/if}

					<!-- Federation Badge -->
					<span class="mt-3 inline-flex items-center gap-1.5 rounded-full border border-sky-400/30 bg-sky-500/10 px-2.5 py-1 text-[10px] font-medium text-sky-500 uppercase tracking-wider">
						<Globe class="h-3 w-3" /> External Server ActivityPub
					</span>

					<div class="mt-4 flex w-full flex-col gap-2">
						{#if followStatus === 'accepted'}
							<Button onclick={handleUnfollow} disabled={isFollowLoading} class="w-full bg-zinc-700 text-white shadow-lg transition-all hover:scale-[1.02] hover:bg-red-600 border-0 ring-0">
								{#if isFollowLoading}
									<Loader2 class="mr-2 h-4 w-4 animate-spin" />
								{:else}
									<UserMinus class="mr-2 h-4 w-4" />
								{/if}
								Following remotely
							</Button>
						{:else if followStatus === 'pending'}
							<Button disabled class="w-full cursor-not-allowed bg-amber-600/20 text-amber-400 shadow-lg transition-all border-0 ring-0">
								<Clock class="mr-2 h-4 w-4" />
								Request pending...
							</Button>
						{:else}
							<Button onclick={handleFollow} disabled={isFollowLoading} class="w-full bg-sky-600 text-white shadow-lg shadow-sky-500/20 transition-all hover:scale-[1.02] hover:bg-sky-700 border-0 bg-gradient-to-r from-sky-600 to-indigo-600 ring-0!">
								{#if isFollowLoading}
									<Loader2 class="mr-2 h-4 w-4 animate-spin" />
								{:else}
									<UserPlus class="mr-2 h-4 w-4" />
								{/if}
								Follow from Polyverse
							</Button>
						{/if}
						<div class="flex gap-2">
							<Button variant="outline" onclick={copyProfile} class="glass-card flex-1 border-white/10 text-xs hover:bg-white/5">
								<Copy class="mr-1.5 h-3.5 w-3.5" />Share
							</Button>
							<a href={profile.id} target="_blank" class="flex-1">
								<Button variant="outline" class="glass-card w-full border-white/10 text-xs text-sky-400 hover:bg-white/5 hover:text-sky-300">
									<ExternalLink class="mr-1.5 h-3.5 w-3.5" />Original
								</Button>
							</a>
						</div>
					</div>
				</div>
			</div>
		</div>
	</aside>

	<!-- COL 2: Feed -->
	<main class="pv-col-center">
		<div class="pv-profile-header border-b border-white/10 px-5 py-3">
			<div class="pv-tabs-bar glass-card flex h-14 w-full items-center justify-center rounded-xl border border-white/10 p-1 shadow-xl ring-1 ring-sky-500/10">
				<div class="flex h-full w-full items-center justify-center rounded-lg bg-gradient-to-r from-sky-500 to-indigo-500 text-sm font-semibold text-white shadow-md">
					<LayoutGrid class="mr-2 h-4 w-4" />
					Recent Remote Posts
				</div>
			</div>
		</div>

		<div class="pv-feed-scroll">
			<div class="space-y-4 px-5 py-4 pb-24">
				{#if posts.length > 0}
					<!-- We reuse the Post.svelte component, giving it mock data shaped the same way -->
					{#each posts as activity (activity.id)}
						<Post
							{activity}
							isOwner={false}
							username={profile.username}
						/>
					{/each}
					
					<p class="py-8 text-center text-xs font-medium tracking-widest text-foreground/30 uppercase">
						Remote feed fetched natively
					</p>
				{:else}
					<Card class="glass-card flex flex-col items-center border border-white/10 py-16 text-center ring-1 ring-sky-500/10">
						<div class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-sky-500/10">
							<Globe class="h-8 w-8 text-sky-500" />
						</div>
						<h3 class="mb-2 text-lg font-semibold">No recent posts</h3>
						<p class="mx-auto max-w-xs text-sm text-foreground/50">
							{profile.displayName}'s outbox doesn't contain any recent public posts, or their server doesn't expose them.
						</p>
					</Card>
				{/if}
			</div>
		</div>
	</main>

	<!-- COL 3: Sidebar -->
	<aside class="pv-col-right pv-panel border-l border-white/10">
		<div class="pv-right-scroll">
			<RightSidebar />
		</div>
	</aside>
</div>

<style>
	/* Same exact styles as local profile to maintain Native app feel */
	.pv-profile { display: grid; grid-template-columns: 320px minmax(0, 680px) 290px; justify-content: center; height: 100vh; overflow: hidden; }
	.pv-panel { background: color-mix(in oklch, var(--background) 88%, transparent); backdrop-filter: blur(20px); }
	.pv-col-left { display: flex; flex-direction: column; height: 100vh; min-height: 0; overflow: hidden; }
	.pv-left-scroll { flex: 1 1 0; overflow-y: auto; scrollbar-width: thin; scrollbar-color: color-mix(in oklch, var(--foreground) 15%, transparent) transparent; }
	.pv-col-center { display: flex; flex-direction: column; height: 100vh; min-height: 0; overflow: hidden; }
	.pv-profile-header { flex-shrink: 0; background: color-mix(in oklch, var(--background) 88%, transparent); backdrop-filter: blur(20px); }
	.pv-feed-scroll { flex: 1 1 0; min-height: 0; overflow-y: auto; scrollbar-width: thin; scrollbar-color: color-mix(in oklch, var(--foreground) 15%, transparent) transparent; }
	.pv-col-right { display: flex; flex-direction: column; height: 100vh; min-height: 0; overflow: hidden; }
	.pv-right-scroll { flex: 1 1 0; overflow-y: auto; scrollbar-width: thin; scrollbar-color: color-mix(in oklch, var(--foreground) 15%, transparent) transparent; }
	@media (max-width: 1023px) {
		.pv-profile { display: flex; flex-direction: column; height: auto !important; min-height: 0 !important; overflow: visible !important; max-width: 100vw; }
		.pv-col-left, .pv-col-center { height: auto !important; min-height: auto !important; overflow: visible !important; }
		.pv-left-scroll, .pv-feed-scroll { overflow: visible !important; flex: none !important; }
		.pv-profile-header { position: sticky; top: 0; z-index: 30; padding-top: env(safe-area-inset-top, 0px); }
		.pv-col-right { display: none !important; }
	}
	:root:not(.dark) .pv-panel, :root:not(.dark) .pv-profile-header, :root:not(.dark) .pv-col-left, :root:not(.dark) .pv-col-right {
		background: color-mix(in oklch, var(--background) 95%, transparent); border-color: oklch(0 0 0 / 10%) !important; box-shadow: 0 1px 0 oklch(0 0 0 / 8%);
	}
	:root:not(.dark) .glass-card { background: white !important; border-color: oklch(0 0 0 / 10%) !important; box-shadow: 0 2px 12px -2px oklch(0 0 0 / 8%) !important; }
</style>
