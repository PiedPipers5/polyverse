<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { Avatar, AvatarFallback, AvatarImage } from '$lib/components/ui/avatar';
	import { Button } from '$lib/components/ui/button';
	import {
		ArrowLeft,
		Send,
		Loader2,
		MessageCircle
	} from 'lucide-svelte';
	import { goto } from '$app/navigation';

	let { data } = $props();

	let messages = $state<any[]>([]);
	let otherParticipant = $state<any>(null);
	let loading = $state(true);
	let sending = $state(false);
	let messageInput = $state('');
	let messagesContainer: HTMLDivElement;
	const conversationId = $derived(data.conversationId);

	onMount(() => {
		loadMessages();
		// Poll for new messages every 5 seconds
		const iv = setInterval(pollMessages, 5000);
		return () => clearInterval(iv);
	});

	async function loadMessages() {
		loading = true;
		try {
			const res = await fetch(`/api/dm/conversations/${conversationId}`);
			if (res.ok) {
				const data = await res.json();
				messages = data.messages ?? [];
				otherParticipant = data.conversation?.otherParticipant ?? null;
				await tick();
				scrollToBottom();
			} else if (res.status === 404) {
				goto('/messages');
			}
		} catch (err) {
			console.error('Failed to load messages:', err);
		} finally {
			loading = false;
		}
	}

	async function pollMessages() {
		try {
			const res = await fetch(`/api/dm/conversations/${conversationId}`);
			if (res.ok) {
				const data = await res.json();
				const newMessages = data.messages ?? [];
				if (newMessages.length !== messages.length) {
					messages = newMessages;
					await tick();
					scrollToBottom();
				}
			}
		} catch {
			// Silent fail for polling
		}
	}

	async function sendMessage() {
		if (!messageInput.trim() || sending) return;
		sending = true;

		const content = messageInput.trim();
		messageInput = '';

		// Optimistic add
		const tempMsg = {
			id: 'temp-' + Date.now(),
			content,
			isOwn: true,
			read: false,
			createdAt: new Date().toISOString(),
			_sending: true
		};
		messages = [...messages, tempMsg];
		await tick();
		scrollToBottom();

		try {
			const res = await fetch(`/api/dm/conversations/${conversationId}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ content })
			});

			if (res.ok) {
				const data = await res.json();
				// Replace temp message with real one
				messages = messages.map((m) =>
					m.id === tempMsg.id ? { ...data.message, _sending: false } : m
				);
			} else {
				// Remove failed message
				messages = messages.filter((m) => m.id !== tempMsg.id);
				messageInput = content; // Restore input
			}
		} catch (err) {
			console.error('Failed to send message:', err);
			messages = messages.filter((m) => m.id !== tempMsg.id);
			messageInput = content;
		} finally {
			sending = false;
		}
	}

	function scrollToBottom() {
		if (messagesContainer) {
			messagesContainer.scrollTop = messagesContainer.scrollHeight;
		}
	}

	function relativeTime(dateStr: string): string {
		const diff = Date.now() - new Date(dateStr).getTime();
		const s = Math.floor(diff / 1000);
		if (s < 60) return 'just now';
		const m = Math.floor(s / 60);
		if (m < 60) return `${m}m ago`;
		const h = Math.floor(m / 60);
		if (h < 24) return `${h}h ago`;
		return `${Math.floor(h / 24)}d ago`;
	}

	function formatTime(dateStr: string): string {
		const d = new Date(dateStr);
		return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
</script>

<svelte:head>
	<title>{otherParticipant?.name || 'Chat'} – Messages – Polyverse</title>
	<meta name="description" content="Direct message conversation on Polyverse." />
</svelte:head>

<div class="pv-chat">
	<!-- ═══ Header ═══ -->
	<header class="pv-chat-header pv-panel border-b border-white/10">
		<div class="flex items-center gap-3 px-4 py-3">
			<a
				href="/messages"
				class="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-white/10"
			>
				<ArrowLeft class="h-4 w-4" />
			</a>

			{#if otherParticipant}
				<Avatar class="h-9 w-9 ring-2 ring-white/5">
					{#if otherParticipant.avatar}
						<AvatarImage src={otherParticipant.avatar} alt={otherParticipant.name || 'User'} />
					{/if}
					<AvatarFallback class="bg-linear-to-br from-blue-500/20 to-cyan-500/20 text-xs font-bold">
						{getInitials(otherParticipant.name)}
					</AvatarFallback>
				</Avatar>

				<div class="min-w-0 flex-1">
					<p class="truncate text-sm font-semibold">{otherParticipant.name || 'User'}</p>
					<p class="truncate text-[11px] text-foreground/40">{otherParticipant.handle}</p>
				</div>
			{:else if loading}
				<div class="flex items-center gap-2">
					<Loader2 class="h-4 w-4 animate-spin text-foreground/30" />
					<span class="text-sm text-foreground/40">Loading…</span>
				</div>
			{/if}
		</div>
	</header>

	<!-- ═══ Messages ═══ -->
	<div class="pv-chat-messages" bind:this={messagesContainer}>
		{#if loading}
			<div class="flex flex-col items-center justify-center py-20">
				<Loader2 class="h-8 w-8 animate-spin text-blue-400/60" />
			</div>
		{:else if messages.length === 0}
			<div class="flex flex-col items-center justify-center py-20 text-center">
				<div
					class="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-500/10 ring-1 ring-blue-500/20"
				>
					<MessageCircle class="h-7 w-7 text-blue-400/60" />
				</div>
				<p class="font-semibold text-foreground/50">No messages yet</p>
				<p class="mt-1 text-sm text-muted-foreground">
					Send a message to start the conversation!
				</p>
			</div>
		{:else}
			<div class="space-y-2 px-4 py-4 pb-4">
				{#each messages as msg (msg.id)}
					<div class="flex {msg.isOwn ? 'justify-end' : 'justify-start'}">
						<div
							class="max-w-[75%] rounded-2xl px-4 py-2.5
								{msg.isOwn
									? 'bg-blue-600 text-white rounded-br-md'
									: 'bg-white/8 text-foreground rounded-bl-md'}
								{msg._sending ? 'opacity-60' : ''}"
						>
							<p class="text-sm leading-relaxed whitespace-pre-wrap break-words">{@html msg.content}</p>
							<p class="mt-1 text-[10px] {msg.isOwn ? 'text-white/50' : 'text-foreground/30'} text-right tabular-nums">
								{formatTime(msg.createdAt)}
							</p>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<!-- ═══ Composer ═══ -->
	<div class="pv-chat-composer pv-panel border-t border-white/10">
		<div class="flex items-end gap-2 px-4 py-3">
			<textarea
				bind:value={messageInput}
				placeholder="Write a message…"
				rows="1"
				class="flex-1 resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm outline-none placeholder:text-foreground/30 focus:border-blue-500/50"
				onkeydown={(e) => {
					if (e.key === 'Enter' && !e.shiftKey) {
						e.preventDefault();
						sendMessage();
					}
				}}
				oninput={(e) => {
					const target = e.target as HTMLTextAreaElement;
					target.style.height = 'auto';
					target.style.height = Math.min(target.scrollHeight, 120) + 'px';
				}}
			></textarea>
			<Button
				onclick={sendMessage}
				disabled={sending || !messageInput.trim()}
				class="h-10 w-10 shrink-0 rounded-xl bg-blue-600 p-0 hover:bg-blue-700 disabled:opacity-30"
			>
				{#if sending}
					<Loader2 class="h-4 w-4 animate-spin" />
				{:else}
					<Send class="h-4 w-4" />
				{/if}
			</Button>
		</div>
	</div>
</div>

<style>
	.pv-chat {
		display: flex;
		flex-direction: column;
		max-width: 700px;
		margin: 0 auto;
		height: 100vh;
		overflow: hidden;
	}

	.pv-panel {
		background: color-mix(in oklch, var(--background) 88%, transparent);
		backdrop-filter: blur(20px);
	}

	.pv-chat-header {
		flex-shrink: 0;
	}

	.pv-chat-messages {
		flex: 1 1 0;
		overflow-y: auto;
		scrollbar-width: thin;
		scrollbar-color: color-mix(in oklch, var(--foreground) 15%, transparent) transparent;
	}

	.pv-chat-composer {
		flex-shrink: 0;
		padding-bottom: max(0.75rem, calc(env(safe-area-inset-bottom, 0px) + 0.5rem));
	}

	@media (max-width: 1023px) {
		.pv-chat {
			height: calc(100vh - 5rem);
		}
	}
</style>
