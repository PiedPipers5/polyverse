<script lang="ts">
	import Comment from './Comment.svelte';
	import Composer from './Composer.svelte';
	import { Loader2, MessageSquare } from 'lucide-svelte';
	import { toast } from 'svelte-sonner';

	interface Props {
		postId: string;
		username: string;
		totalComments?: number;
	}

	let { postId, username, totalComments = $bindable(0) }: Props = $props();
	let comments = $state<any[]>([]);
	let loading = $state(true);
	let error = $state(false);

	async function fetchComments() {
		loading = true;
		error = false;
		try {
			const res = await fetch(`/api/comments/${encodeURIComponent(postId)}`);
			if (!res.ok) throw new Error();
			const data = await res.json();
			comments = data.comments || [];
			totalComments = data.total || 0;
		} catch {
			error = true;
		} finally {
			loading = false;
		}
	}

	// Initial fetch
	$effect(() => {
		fetchComments();
	});

	function handleReplyCreated(newActivity: any) {
		// After posting a top-level reply, re-fetch the full tree
		fetchComments();
	}
</script>

<div class="comment-section">
	<!-- Header -->
	<div class="flex items-center gap-2 border-b border-white/8 px-4 py-3">
		<MessageSquare class="h-4 w-4 text-violet-400" />
		<span class="text-sm font-bold text-foreground/80">
			{totalComments}
			{totalComments === 1 ? 'Comment' : 'Comments'}
		</span>
	</div>

	<!-- Top-level reply composer -->
	<div class="border-b border-white/8 px-4 py-3">
		<div class="space-y-2">
			<Composer
				{username}
				onPostCreated={handleReplyCreated}
				placeholder="Add a comment…"
				inReplyTo={postId}
				compact={true}
			/>
		</div>
	</div>

	<!-- Comments -->
	<div class="px-4 py-2">
		{#if loading}
			<div class="flex items-center justify-center py-8">
				<Loader2 class="h-5 w-5 animate-spin text-violet-400" />
			</div>
		{:else if error}
			<div class="py-6 text-center">
				<p class="text-sm text-foreground/40">Failed to load comments.</p>
				<button
					class="mt-2 text-xs font-medium text-violet-400 hover:text-violet-300"
					onclick={fetchComments}
				>
					Try again
				</button>
			</div>
		{:else if comments.length === 0}
			<div class="py-8 text-center">
				<p class="text-sm text-foreground/40">No comments yet. Be the first to reply!</p>
			</div>
		{:else}
			{#each comments as comment (comment.id)}
				<Comment {comment} {username} onReplySubmitted={fetchComments} />
			{/each}
		{/if}
	</div>
</div>

<style>
	.comment-section {
		border-radius: 16px;
		border: 1px solid color-mix(in oklch, var(--foreground) 10%, transparent);
		background: color-mix(in oklch, var(--background) 80%, transparent);
		backdrop-filter: blur(12px);
		overflow: hidden;
	}
</style>
