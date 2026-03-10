<script lang="ts">
	import { onMount } from 'svelte';
	import { Avatar, AvatarFallback, AvatarImage } from '$lib/components/ui/avatar';
	import { Button } from '$lib/components/ui/button';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import {
		Bell,
		Heart,
		Repeat2,
		MessageCircle,
		UserPlus,
		CheckCheck,
		Loader2,
		ExternalLink,
		AtSign,
		Flame
	} from 'lucide-svelte';
	import RightSidebar from '$lib/components/RightSidebar.svelte';

	let { data } = $props();

	let notifications = $state<any[]>([]);
	let unreadCount = $state(0);
	let loading = $state(false);
	let markingRead = $state(false);

	$effect(() => {
		if (data.notifications) notifications = data.notifications;
		if (data.unreadCount != null) unreadCount = data.unreadCount;
	});

	// ── Helpers ─────────────────────────────────────────────────────
	function relativeTime(dateStr: string): string {
		const diff = Date.now() - new Date(dateStr).getTime();
		const s = Math.floor(diff / 1000);
		if (s < 60) return `${s}s ago`;
		const m = Math.floor(s / 60);
		if (m < 60) return `${m}m ago`;
		const h = Math.floor(m / 60);
		if (h < 24) return `${h}h ago`;
		return `${Math.floor(h / 24)}d ago`;
	}

	function getNotifIcon(type: string) {
		switch (type) {
			case 'like':
				return Heart;
			case 'boost':
				return Repeat2;
			case 'reply':
				return MessageCircle;
			case 'follow':
				return UserPlus;
			case 'mention':
				return AtSign;
			default:
				return Bell;
		}
	}

	function getNotifColor(type: string) {
		switch (type) {
			case 'like':
				return 'text-rose-400 bg-rose-500/15';
			case 'boost':
				return 'text-emerald-400 bg-emerald-500/15';
			case 'reply':
				return 'text-violet-400 bg-violet-500/15';
			case 'follow':
				return 'text-blue-400 bg-blue-500/15';
			case 'mention':
				return 'text-amber-400 bg-amber-500/15';
			default:
				return 'text-foreground/40 bg-white/10';
		}
	}

	function getNotifLabel(type: string) {
		switch (type) {
			case 'like':
				return 'liked your post';
			case 'boost':
				return 'boosted your post';
			case 'reply':
				return 'replied to your post';
			case 'follow':
				return 'followed you';
			case 'mention':
				return 'mentioned you';
			default:
				return 'interacted with you';
		}
	}

	function getInitials(name: string | null): string {
		if (!name) return '??';
		return name
			.split(' ')
			.map((w) => w[0])
			.join('')
			.toUpperCase()
			.slice(0, 2);
	}

	// ── Actions ─────────────────────────────────────────────────────
	async function markAllRead() {
		markingRead = true;
		try {
			const res = await fetch('/api/notifications', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'mark_read' })
			});
			if (res.ok) {
				notifications = notifications.map((n: any) => ({ ...n, read: true }));
				unreadCount = 0;
			}
		} catch (err) {
			console.error('Failed to mark notifications as read:', err);
		} finally {
			markingRead = false;
		}
	}

	async function refresh() {
		loading = true;
		try {
			const res = await fetch('/api/notifications');
			if (res.ok) {
				const data = await res.json();
				notifications = data.notifications ?? [];
				unreadCount = data.unreadCount ?? 0;
			}
		} catch (err) {
			console.error('Failed to refresh notifications:', err);
		} finally {
			loading = false;
		}
	}

	// Poll every 60s for new notifications
	onMount(() => {
		const iv = setInterval(refresh, 60_000);
		return () => clearInterval(iv);
	});
</script>

<svelte:head>
	<title>Notifications – Polyverse</title>
	<meta name="description" content="Your notifications on Polyverse." />
</svelte:head>

<div class="pv-notifs">
	<!-- ═══ COL 1 — Header & Actions ═══ -->
	<aside class="pv-col-left pv-panel border-r border-white/10">
		<div class="pv-left-scroll space-y-4 p-4">
			<div class="flex items-center gap-3 px-1 pt-1 pb-2">
				<div
					class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-violet-500 to-fuchsia-500 shadow-md shadow-violet-500/30"
				>
					<Bell class="h-5 w-5 text-white" />
				</div>
				<div>
					<h1 class="text-base leading-tight font-bold">Notifications</h1>
					<p class="text-[11px] text-muted-foreground">
						{unreadCount > 0 ? `${unreadCount} unread` : 'All caught up!'}
					</p>
				</div>
			</div>

			{#if unreadCount > 0}
				<Button
					variant="outline"
					onclick={markAllRead}
					disabled={markingRead}
					class="glass-card w-full border-white/10 text-sm hover:bg-white/5"
				>
					{#if markingRead}
						<Loader2 class="mr-2 h-4 w-4 animate-spin" />
						Marking…
					{:else}
						<CheckCheck class="mr-2 h-4 w-4" />
						Mark All Read
					{/if}
				</Button>
			{/if}
		</div>
	</aside>

	<!-- ═══ COL 2 — Notification List ═══ -->
	<main class="pv-col-center">
		<div class="pv-trending-header pv-panel border-b border-white/10 px-5 py-4">
			<div class="flex items-center justify-between">
				<h2 class="text-sm font-bold text-foreground/60">Recent Activity</h2>
				{#if loading}
					<Loader2 class="h-4 w-4 animate-spin text-foreground/30" />
				{/if}
			</div>
		</div>

		<div class="pv-feed-scroll">
			<div class="space-y-1 px-2 py-2 pb-24">
				{#if notifications.length === 0}
					<div class="flex flex-col items-center justify-center py-20 text-center">
						<div
							class="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-500/10 ring-1 ring-violet-500/20"
						>
							<Bell class="h-7 w-7 text-violet-400/60" />
						</div>
						<p class="font-semibold text-foreground/50">No notifications yet</p>
						<p class="mt-1 text-sm text-muted-foreground">
							When people interact with you, it'll show up here.
						</p>
					</div>
				{:else}
					{#each notifications as notif (notif.id)}
						{@const IconComponent = getNotifIcon(notif.type)}
						{@const colorClass = getNotifColor(notif.type)}
						<div
							class="group flex items-start gap-3 rounded-xl px-3 py-3 transition-all hover:bg-white/5
								   {notif.read ? 'opacity-60' : ''}"
						>
							<!-- Icon -->
							<div
								class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl {colorClass}"
							>
								<IconComponent class="h-4 w-4" />
							</div>

							<!-- Content -->
							<div class="min-w-0 flex-1">
								<div class="flex items-center gap-2">
									{#if notif.actorAvatar || notif.actorName}
										<Avatar class="h-6 w-6 shrink-0">
											{#if notif.actorAvatar}
												<AvatarImage
													src={notif.actorAvatar}
													alt={notif.actorName || 'User'}
												/>
											{/if}
											<AvatarFallback
												class="bg-foreground/10 text-[8px] font-bold"
											>
												{getInitials(notif.actorName)}
											</AvatarFallback>
										</Avatar>
									{/if}
									<p class="text-sm">
										<span class="font-bold">{notif.actorName || notif.actorId || 'Someone'}</span>
										<span class="text-foreground/50">{getNotifLabel(notif.type)}</span>
									</p>
								</div>
								{#if notif.objectId}
									<p class="mt-0.5 truncate text-xs text-foreground/30">
										{notif.objectId}
									</p>
								{/if}
							</div>

							<!-- Timestamp -->
							<span class="shrink-0 text-[10px] text-foreground/25 tabular-nums">
								{notif.createdAt ? relativeTime(notif.createdAt) : ''}
							</span>

							<!-- Unread dot -->
							{#if !notif.read}
								<div class="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-violet-500 shadow-md shadow-violet-500/30"></div>
							{/if}
						</div>
					{/each}
				{/if}
			</div>
		</div>
	</main>

	<!-- ═══ COL 3 — Right sidebar ═══ -->
	<aside class="pv-col-right pv-panel border-l border-white/10">
		<div class="pv-right-scroll">
			<RightSidebar />
		</div>
	</aside>
</div>

<style>
	.pv-notifs {
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

	@media (max-width: 1023px) {
		.pv-notifs {
			display: flex;
			flex-direction: column;
			height: auto !important;
			overflow: visible !important;
		}

		.pv-col-left {
			height: auto !important;
			overflow: visible !important;
		}

		.pv-left-scroll {
			overflow: visible !important;
			flex: none !important;
		}

		.pv-col-center {
			height: auto !important;
			overflow: visible !important;
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
</style>
