<script lang="ts">
	import { Avatar, AvatarFallback, AvatarImage } from '$lib/components/ui/avatar';
	import { toast } from 'svelte-sonner';
	import { ArrowUp, ArrowDown, MessageSquare, ChevronDown, ChevronUp } from 'lucide-svelte';
	import Comment from './Comment.svelte';

	interface CommentData {
		id: string;
		activityId: string;
		content: string;
		publishedAt: string;
		author: {
			username: string;
			displayName: string | null;
			avatarUrl: string | null;
			profileUrl: string;
		} | null;
		netScore: number;
		userVote: 'upvote' | 'downvote' | null;
		replies: CommentData[];
	}

	interface Props {
		comment: CommentData;
		depth?: number;
		username: string;
		onReplySubmitted?: () => void;
	}

	let { comment, depth = 0, username, onReplySubmitted }: Props = $props();

	let collapsed = $state(false);
	let showReplyBox = $state(false);
	let replyContent = $state('');
	let submittingReply = $state(false);
	let isVoting = $state(false);
	let localNetScore = $state(0);
	let localUserVote = $state<'upvote' | 'downvote' | null>(null);

	$effect(() => {
		localNetScore = comment.netScore;
		localUserVote = comment.userVote;
	});

	const MAX_DEPTH = 8;

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

	async function handleVote(action: 'upvote' | 'downvote') {
		if (isVoting) return;
		isVoting = true;

		const previousVote = localUserVote;
		const previousScore = localNetScore;

		let newVote: 'upvote' | 'downvote' | null = action;
		if (previousVote === action) newVote = null;

		localUserVote = newVote;

		let scoreDiff = 0;
		if (previousVote === 'upvote') scoreDiff -= 1;
		else if (previousVote === 'downvote') scoreDiff += 1;
		if (newVote === 'upvote') scoreDiff += 1;
		else if (newVote === 'downvote') scoreDiff -= 1;

		localNetScore += scoreDiff;

		try {
			const res = await fetch('/api/interact', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					postId: comment.id,
					action: newVote === null ? 'remove' : newVote
				})
			});
			if (!res.ok) throw new Error();
		} catch {
			localUserVote = previousVote;
			localNetScore = previousScore;
			toast.error('Vote failed');
		} finally {
			isVoting = false;
		}
	}

	async function submitReply() {
		if (!replyContent.trim() || submittingReply) return;
		submittingReply = true;
		try {
			const res = await fetch(`/users/${username}/outbox`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					content: replyContent.trim(),
					inReplyTo: comment.id,
					privacy: 'public'
				})
			});
			if (!res.ok) throw new Error();
			replyContent = '';
			showReplyBox = false;
			toast.success('Reply posted');
			onReplySubmitted?.();
		} catch {
			toast.error('Failed to post reply');
		} finally {
			submittingReply = false;
		}
	}
</script>

<div class="comment-node" style="--depth: {depth}">
	<!-- Thread collapse line -->
	{#if depth > 0}
		<button
			class="thread-line"
			onclick={() => (collapsed = !collapsed)}
			aria-label={collapsed ? 'Expand thread' : 'Collapse thread'}
		></button>
	{/if}

	<div class="comment-body">
		<!-- Author row -->
		<div class="flex items-center gap-2">
			{#if comment.author}
				<a href={comment.author.profileUrl} class="shrink-0">
					<Avatar class="h-6 w-6 ring-1 ring-white/10">
						{#if comment.author.avatarUrl}
							<AvatarImage
								src={comment.author.avatarUrl}
								alt={comment.author.displayName || comment.author.username}
							/>
						{/if}
						<AvatarFallback
							class="bg-linear-to-br from-violet-500 to-fuchsia-500 text-[9px] font-bold text-white"
						>
							{getInitials(comment.author.displayName, comment.author.username)}
						</AvatarFallback>
					</Avatar>
				</a>
				<a
					href={comment.author.profileUrl}
					class="text-xs font-bold text-foreground/80 transition-colors hover:text-violet-400"
				>
					{comment.author.displayName || comment.author.username}
				</a>
			{:else}
				<span class="text-xs text-foreground/40 italic">Unknown user</span>
			{/if}
			<span class="text-[10px] text-foreground/30 tabular-nums"
				>· {relativeTime(comment.publishedAt)}</span
			>

			{#if depth > 0}
				<button
					class="ml-auto text-[10px] text-foreground/30 transition-colors hover:text-foreground/60"
					onclick={() => (collapsed = !collapsed)}
				>
					{#if collapsed}
						<ChevronDown class="h-3 w-3" />
					{:else}
						<ChevronUp class="h-3 w-3" />
					{/if}
				</button>
			{/if}
		</div>

		{#if !collapsed}
			<!-- Content -->
			<p class="mt-1.5 text-sm leading-relaxed whitespace-pre-wrap text-foreground/85">
				{comment.content}
			</p>

			<!-- Action bar -->
			<div class="mt-2 flex items-center gap-3">
				<!-- Votes -->
				<div class="flex items-center gap-0.5 rounded-full bg-white/5 p-0.5 ring-1 ring-white/8">
					<button
						class="flex h-5 w-5 items-center justify-center rounded-full transition-colors hover:bg-white/10 {localUserVote ===
						'upvote'
							? 'bg-violet-500/20 text-violet-400'
							: 'text-foreground/40'}"
						onclick={() => handleVote('upvote')}
						disabled={isVoting}
						aria-label="Upvote"
					>
						<ArrowUp class="h-3 w-3" />
					</button>
					<span
						class="min-w-[1rem] text-center text-[10px] font-bold {localUserVote === 'upvote'
							? 'text-violet-400'
							: localUserVote === 'downvote'
								? 'text-rose-400'
								: 'text-foreground/60'}"
					>
						{localNetScore}
					</span>
					<button
						class="flex h-5 w-5 items-center justify-center rounded-full transition-colors hover:bg-white/10 {localUserVote ===
						'downvote'
							? 'bg-rose-500/20 text-rose-400'
							: 'text-foreground/40'}"
						onclick={() => handleVote('downvote')}
						disabled={isVoting}
						aria-label="Downvote"
					>
						<ArrowDown class="h-3 w-3" />
					</button>
				</div>

				{#if depth < MAX_DEPTH}
					<button
						class="flex items-center gap-1 text-[10px] font-medium text-foreground/40 transition-colors hover:text-violet-400"
						onclick={() => (showReplyBox = !showReplyBox)}
					>
						<MessageSquare class="h-3 w-3" />
						Reply
					</button>
				{/if}
			</div>

			<!-- Reply box -->
			{#if showReplyBox}
				<div class="mt-2 space-y-2">
					<textarea
						bind:value={replyContent}
						placeholder="Write a reply…"
						rows="2"
						class="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm
							   text-foreground placeholder:text-foreground/30 focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30 focus:outline-none"
					></textarea>
					<div class="flex gap-2">
						<button
							class="rounded-lg bg-violet-500 px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-violet-600 disabled:opacity-50"
							onclick={submitReply}
							disabled={submittingReply || !replyContent.trim()}
						>
							{submittingReply ? 'Posting…' : 'Reply'}
						</button>
						<button
							class="rounded-lg px-3 py-1 text-xs font-medium text-foreground/50 transition-colors hover:text-foreground/80"
							onclick={() => {
								showReplyBox = false;
								replyContent = '';
							}}
						>
							Cancel
						</button>
					</div>
				</div>
			{/if}

			<!-- Nested replies -->
			{#if comment.replies && comment.replies.length > 0}
				<div class="mt-2">
					{#each comment.replies as reply (reply.id)}
						<Comment comment={reply} depth={depth + 1} {username} {onReplySubmitted} />
					{/each}
				</div>
			{/if}
		{/if}
	</div>
</div>

<style>
	.comment-node {
		display: flex;
		gap: 8px;
		padding-top: 8px;
	}

	.thread-line {
		width: 2px;
		flex-shrink: 0;
		margin-left: 11px;
		background: color-mix(in oklch, var(--foreground) 10%, transparent);
		border: none;
		padding: 0;
		cursor: pointer;
		border-radius: 999px;
		transition: background 0.15s ease;
	}
	.thread-line:hover {
		background: #8b5cf6;
	}

	.comment-body {
		flex: 1;
		min-width: 0;
	}
</style>
