<script lang="ts">
	import { Avatar, AvatarFallback, AvatarImage } from '$lib/components/ui/avatar';
	import { Card } from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import {
		ArrowLeft,
		MessageCircle,
		Globe,
		CornerDownRight,
		ChevronUp
	} from 'lucide-svelte';
	import RightSidebar from '$lib/components/RightSidebar.svelte';
	import RichContent from '$lib/components/RichContent.svelte';

	let { data } = $props();

	let focusPost = $state<any>(null);
	let ancestors = $state<any[]>([]);
	let descendants = $state<any[]>([]);

	$effect(() => {
		if (data.focusPost) focusPost = data.focusPost;
		if (data.ancestors) ancestors = data.ancestors;
		if (data.descendants) descendants = data.descendants;
	});

	function getInitials(name: string | null, fallback = ''): string {
		const n = name || fallback;
		if (!n) return '??';
		return n.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
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
</script>

<svelte:head>
	<title>Thread – Polyverse</title>
	<meta name="description" content="View a conversation thread on Polyverse." />
</svelte:head>

<div class="pv-thread">
	<!-- ═══ COL 1 — Back navigation ═══ -->
	<aside class="pv-col-left pv-panel border-r border-white/10">
		<div class="space-y-4 p-4">
			<Button
				variant="ghost"
				onclick={() => history.back()}
				class="w-full justify-start gap-2 text-sm text-foreground/60 hover:text-foreground"
			>
				<ArrowLeft class="h-4 w-4" />
				Back
			</Button>

			<div class="glass-card rounded-2xl border border-white/10 bg-card/70 p-4 shadow-xl ring-1 ring-white/5 backdrop-blur-md">
				<h3 class="mb-2 text-[10px] font-bold tracking-widest text-foreground/40 uppercase">Thread</h3>
				<p class="text-sm text-foreground/50">
					{ancestors.length} {ancestors.length === 1 ? 'ancestor' : 'ancestors'},
					{descendants.length} {descendants.length === 1 ? 'reply' : 'replies'}
				</p>
			</div>
		</div>
	</aside>

	<!-- ═══ COL 2 — Thread Content ═══ -->
	<main class="pv-col-center">
		<div class="pv-trending-header pv-panel border-b border-white/10 px-5 py-4">
			<h2 class="flex items-center gap-2 text-sm font-bold text-foreground/60">
				<MessageCircle class="h-4 w-4" />
				Conversation
			</h2>
		</div>

		<div class="pv-feed-scroll">
			<div class="space-y-0 px-4 py-4 pb-24">
				<!-- ── Ancestors ──────────────────────────────────────── -->
				{#if ancestors.length > 0}
					<div class="mb-2 flex items-center gap-2 text-[10px] font-bold tracking-widest text-foreground/30 uppercase">
						<ChevronUp class="h-3 w-3" />
						In reply to
					</div>
					{#each ancestors as post (post.id)}
						<div class="thread-post thread-ancestor relative border-l-2 border-violet-500/20 pl-4">
							<div class="flex items-center gap-2 pb-1">
								<Avatar class="h-7 w-7 shrink-0">
									{#if post.authorAvatar}
										<AvatarImage src={post.authorAvatar} alt={post.authorName || ''} />
									{/if}
									<AvatarFallback class="bg-foreground/10 text-[8px] font-bold">
										{getInitials(post.authorName, post.authorUsername)}
									</AvatarFallback>
								</Avatar>
								<span class="text-sm font-bold">{post.authorName || post.authorUsername || 'Unknown'}</span>
								{#if post.isRemote}
									<span class="remote-badge">
										<Globe class="h-2.5 w-2.5" />
										Remote
									</span>
								{/if}
								<span class="ml-auto text-[10px] text-foreground/25 tabular-nums">
									{relativeTime(post.published || post.createdAt || '')}
								</span>
							</div>
							<div class="pb-3 text-sm leading-relaxed text-foreground/70">
								{#if post.content}
									<RichContent content={post.content} tags={post.tags || []} />
								{:else}
									<p class="italic text-foreground/30">Content unavailable</p>
								{/if}
							</div>
						</div>
					{/each}
				{/if}

				<!-- ── Focus Post ─────────────────────────────────────── -->
				{#if focusPost}
					<Card class="glass-card focus-card my-3 border-2 border-violet-500/40 p-5 shadow-xl ring-2 ring-violet-500/15">
						<div class="flex items-center gap-3 pb-3">
							<Avatar class="h-10 w-10 shrink-0 ring-2 ring-violet-400/30">
								{#if focusPost.authorAvatar}
									<AvatarImage src={focusPost.authorAvatar} alt={focusPost.authorName || ''} />
								{/if}
								<AvatarFallback class="bg-linear-to-br from-violet-500 to-fuchsia-500 text-xs font-bold text-white">
									{getInitials(focusPost.authorName, focusPost.authorUsername)}
								</AvatarFallback>
							</Avatar>
							<div class="min-w-0 flex-1">
								<p class="text-sm font-bold">{focusPost.authorName || focusPost.authorUsername || 'Unknown'}</p>
								{#if focusPost.authorUsername}
									<p class="text-xs text-muted-foreground">@{focusPost.authorUsername}</p>
								{/if}
							</div>
							<span class="text-xs text-foreground/30 tabular-nums">
								{relativeTime(focusPost.published || focusPost.createdAt || '')}
							</span>
						</div>
						<div class="text-sm leading-relaxed text-foreground/90">
							{#if focusPost.content}
								<RichContent content={focusPost.content} tags={focusPost.tags || []} />
							{:else}
								<p class="italic text-foreground/30">Content unavailable</p>
							{/if}
						</div>
					</Card>
				{:else}
					<div class="flex flex-col items-center justify-center py-20 text-center">
						<div class="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-500/10 ring-1 ring-violet-500/20">
							<MessageCircle class="h-7 w-7 text-violet-400/60" />
						</div>
						<p class="font-semibold text-foreground/50">Post not found</p>
					</div>
				{/if}

				<!-- ── Descendants ────────────────────────────────────── -->
				{#if descendants.length > 0}
					<div class="mt-4 mb-2 flex items-center gap-2 text-[10px] font-bold tracking-widest text-foreground/30 uppercase">
						<CornerDownRight class="h-3 w-3" />
						Replies ({descendants.length})
					</div>
					{#each descendants as reply (reply.id)}
						<div class="thread-post thread-reply border-l-2 border-emerald-500/20 pl-4">
							<div class="flex items-center gap-2 pb-1">
								<Avatar class="h-7 w-7 shrink-0">
									{#if reply.authorAvatar}
										<AvatarImage src={reply.authorAvatar} alt={reply.authorName || ''} />
									{/if}
									<AvatarFallback class="bg-foreground/10 text-[8px] font-bold">
										{getInitials(reply.authorName, reply.authorUsername)}
									</AvatarFallback>
								</Avatar>
								<span class="text-sm font-bold">{reply.authorName || reply.authorUsername || 'Unknown'}</span>
								{#if reply.isRemote}
									<span class="remote-badge">
										<Globe class="h-2.5 w-2.5" />
										Remote
									</span>
								{/if}
								<span class="ml-auto text-[10px] text-foreground/25 tabular-nums">
									{relativeTime(reply.published || reply.createdAt || '')}
								</span>
							</div>
							<div class="pb-3 text-sm leading-relaxed text-foreground/70">
								{#if reply.content}
									<RichContent content={reply.content} tags={reply.tags || []} />
								{:else}
									<p class="italic text-foreground/30">Content unavailable</p>
								{/if}
							</div>
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
	.pv-thread {
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

	.pv-col-center {
		display: flex;
		flex-direction: column;
		height: 100vh;
		overflow: hidden;
	}

	.pv-trending-header { flex-shrink: 0; }

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

	/* Thread post items */
	.thread-post {
		padding: 0.5rem 0;
	}

	.focus-card {
		animation: focus-glow 2s ease-in-out infinite alternate;
	}

	@keyframes focus-glow {
		from { box-shadow: 0 0 20px -5px rgba(139, 92, 246, 0.15); }
		to { box-shadow: 0 0 30px -5px rgba(139, 92, 246, 0.25); }
	}

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

	@media (max-width: 1023px) {
		.pv-thread {
			display: flex;
			flex-direction: column;
			height: auto !important;
			overflow: visible !important;
		}

		.pv-col-left { height: auto !important; overflow: visible !important; }
		.pv-col-center { height: auto !important; overflow: visible !important; }
		.pv-feed-scroll { overflow: visible !important; flex: none !important; }
		.pv-col-right { display: none !important; }
	}
</style>
