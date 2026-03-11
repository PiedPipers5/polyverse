<script lang="ts">
	import { onMount } from 'svelte';
	import { Avatar, AvatarFallback, AvatarImage } from '$lib/components/ui/avatar';
	import { Button } from '$lib/components/ui/button';
	import {
		MessageCircle,
		Plus,
		Loader2,
		Search,
		ChevronRight
	} from 'lucide-svelte';
	import RightSidebar from '$lib/components/RightSidebar.svelte';
	import { goto } from '$app/navigation';

	let { data } = $props();

	let conversations = $state<any[]>([]);
	let loading = $state(true);
	let searchQuery = $state('');
	let showNewDM = $state(false);
	let newDMTarget = $state('');
	let creating = $state(false);

	onMount(async () => {
		await loadConversations();
	});

	async function loadConversations() {
		loading = true;
		try {
			const res = await fetch('/api/dm/conversations');
			if (res.ok) {
				const data = await res.json();
				conversations = data.conversations ?? [];
			}
		} catch (err) {
			console.error('Failed to load conversations:', err);
		} finally {
			loading = false;
		}
	}

	async function startNewConversation() {
		if (!newDMTarget.trim()) return;
		creating = true;

		try {
			const target = newDMTarget.trim();
			let body: Record<string, string>;

			if (target.includes('@')) {
				// Remote handle or full handle
				const cleaned = target.startsWith('@') ? target.slice(1) : target;
				if (cleaned.includes('@')) {
					body = { handle: cleaned };
				} else {
					body = { username: cleaned };
				}
			} else {
				body = { username: target };
			}

			const res = await fetch('/api/dm/conversations', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});

			if (res.ok) {
				const data = await res.json();
				goto(`/messages/${data.conversation.id}`);
			} else {
				const err = await res.json();
				alert(err.message || 'Could not find user');
			}
		} catch (err) {
			console.error('Failed to start conversation:', err);
		} finally {
			creating = false;
		}
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

	function getInitials(name: string | null): string {
		if (!name) return '??';
		return name
			.split(' ')
			.map((w) => w[0])
			.join('')
			.toUpperCase()
			.slice(0, 2);
	}

	function stripHtml(html: string): string {
		const tmp = document.createElement('div');
		tmp.innerHTML = html;
		return tmp.textContent || tmp.innerText || '';
	}
</script>

<svelte:head>
	<title>Messages – Polyverse</title>
	<meta name="description" content="Your direct messages on Polyverse." />
</svelte:head>

<div class="pv-messages">
	<!-- ═══ COL 1 — Header & New Message ═══ -->
	<aside class="pv-col-left pv-panel border-r border-white/10">
		<div class="pv-left-scroll space-y-4 p-4">
			<div class="flex items-center gap-3 px-1 pt-1 pb-2">
				<div
					class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-blue-500 to-cyan-500 shadow-md shadow-blue-500/30"
				>
					<MessageCircle class="h-5 w-5 text-white" />
				</div>
				<div>
					<h1 class="text-base leading-tight font-bold">Messages</h1>
					<p class="text-[11px] text-muted-foreground">
						{conversations.length > 0 ? `${conversations.length} conversation${conversations.length === 1 ? '' : 's'}` : 'No conversations yet'}
					</p>
				</div>
			</div>

			<Button
				variant="outline"
				onclick={() => (showNewDM = !showNewDM)}
				class="glass-card w-full border-white/10 text-sm hover:bg-white/5"
			>
				<Plus class="mr-2 h-4 w-4" />
				New Message
			</Button>

			{#if showNewDM}
				<div class="glass-card space-y-3 rounded-xl border border-white/10 p-3">
					<p class="text-xs font-medium text-foreground/50">Start a conversation</p>
					<div class="flex w-full gap-2">
						<input
							type="text"
							bind:value={newDMTarget}
							placeholder="username or user@domain"
							class="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none placeholder:text-foreground/30 focus:border-blue-500/50"
							onkeydown={(e) => e.key === 'Enter' && startNewConversation()}
						/>
						<Button
							onclick={startNewConversation}
							disabled={creating || !newDMTarget.trim()}
							class="shrink-0 bg-blue-600 px-4 hover:bg-blue-700"
						>
							{#if creating}
								<Loader2 class="h-4 w-4 animate-spin" />
							{:else}
								Go
							{/if}
						</Button>
					</div>
					<p class="text-[10px] text-foreground/30">
						Enter a local username or full handle (e.g., user@mastodon.social)
					</p>
				</div>
			{/if}
		</div>
	</aside>

	<!-- ═══ COL 2 — Conversation List ═══ -->
	<main class="pv-col-center">
		<div class="pv-trending-header pv-panel border-b border-white/10 px-5 py-4">
			<div class="flex items-center justify-between">
				<h2 class="text-sm font-bold text-foreground/60">Conversations</h2>
				{#if loading}
					<Loader2 class="h-4 w-4 animate-spin text-foreground/30" />
				{/if}
			</div>
		</div>

		<div class="pv-feed-scroll">
			<div class="space-y-1 px-2 py-2 pb-24">
				{#if loading}
					<div class="flex flex-col items-center justify-center py-20">
						<Loader2 class="h-8 w-8 animate-spin text-blue-400/60" />
						<p class="mt-3 text-sm text-muted-foreground">Loading conversations…</p>
					</div>
				{:else if conversations.length === 0}
					<div class="flex flex-col items-center justify-center py-20 text-center">
						<div
							class="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-500/10 ring-1 ring-blue-500/20"
						>
							<MessageCircle class="h-7 w-7 text-blue-400/60" />
						</div>
						<p class="font-semibold text-foreground/50">No messages yet</p>
						<p class="mt-1 text-sm text-muted-foreground">
							Start a conversation by clicking "New Message" above.
						</p>
					</div>
				{:else}
					{#each conversations as convo (convo.id)}
						<a
							href="/messages/{convo.id}"
							class="group flex items-center gap-3 rounded-xl px-3 py-3 transition-all hover:bg-white/5"
						>
							<!-- Avatar -->
							<Avatar class="h-11 w-11 shrink-0 ring-2 ring-white/5">
								{#if convo.otherParticipant.avatar}
									<AvatarImage
										src={convo.otherParticipant.avatar}
										alt={convo.otherParticipant.name || 'User'}
									/>
								{/if}
								<AvatarFallback class="bg-linear-to-br from-blue-500/20 to-cyan-500/20 text-xs font-bold">
									{getInitials(convo.otherParticipant.name)}
								</AvatarFallback>
							</Avatar>

							<!-- Info -->
							<div class="min-w-0 flex-1">
								<div class="flex items-center justify-between">
									<p class="truncate text-sm font-semibold">
										{convo.otherParticipant.name || convo.otherParticipant.handle}
									</p>
									<span class="shrink-0 text-[10px] text-foreground/25 tabular-nums">
										{relativeTime(convo.lastMessageAt)}
									</span>
								</div>
								{#if convo.lastMessage}
									<p class="mt-0.5 truncate text-xs text-foreground/40">
										{#if convo.lastMessage.isOwn}<span class="text-foreground/30">You: </span>{/if}
										{stripHtml(convo.lastMessage.content)}
									</p>
								{/if}
							</div>

							<!-- Unread badge -->
							{#if convo.unreadCount > 0}
								<div
									class="flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-500 px-1.5 text-[10px] font-bold text-white shadow-md shadow-blue-500/30"
								>
									{convo.unreadCount}
								</div>
							{/if}

							<ChevronRight class="h-4 w-4 shrink-0 text-foreground/15 transition-transform group-hover:translate-x-0.5" />
						</a>
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
	.pv-messages {
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

	.glass-card {
		background: color-mix(in oklch, var(--background) 60%, transparent);
		backdrop-filter: blur(12px);
	}

	@media (max-width: 1023px) {
		.pv-messages {
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
