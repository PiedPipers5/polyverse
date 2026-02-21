<script lang="ts">
	import { Avatar, AvatarFallback, AvatarImage } from '$lib/components/ui/avatar';
	import { Button } from '$lib/components/ui/button';
	import { Card } from '$lib/components/ui/card';
	import Post from '$lib/components/Post.svelte';
	import { Loader2, Rss } from 'lucide-svelte';

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
		activity: any;
		content: string;
		publishedAt: string;
		createdAt: string;
	};

	// ── Props from server load ─────────────────────────────────────────────────
	let { data } = $props();

	// ── State ──────────────────────────────────────────────────────────────────
	let posts = $state<FeedPost[]>(data.posts ?? []);
	let nextCursor = $state<string | null>(data.nextCursor ?? null);
	let loadingMore = $state(false);

	// ── Helpers ────────────────────────────────────────────────────────────────
	function getInitials(name: string) {
		return name
			.split(' ')
			.map((n) => n[0])
			.join('')
			.toUpperCase()
			.slice(0, 2);
	}

	// ── Load more ──────────────────────────────────────────────────────────────
	async function loadMore() {
		if (!nextCursor || loadingMore) return;
		loadingMore = true;

		try {
			const res = await fetch(`/api/feed?before=${encodeURIComponent(nextCursor)}`);
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const data = await res.json();
			posts = [...posts, ...(data.posts ?? [])];
			nextCursor = data.nextCursor ?? null;
		} catch (err) {
			console.error('Failed to load more posts:', err);
		} finally {
			loadingMore = false;
		}
	}

	// No-op handlers — read-only feed, owner actions are not available here
	function noop() {}
</script>

<svelte:head>
	<title>Local Feed – Polyverse</title>
	<meta name="description" content="Public timeline of all posts on this Polyverse instance." />
</svelte:head>

<div class="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 bg-muted px-4 py-10">
	<!-- Page Header -->
	<div class="flex items-center gap-3">
		<div
			class="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-md shadow-violet-500/30"
		>
			<Rss class="h-5 w-5 text-white" />
		</div>
		<div>
			<h1 class="text-xl leading-tight font-bold">Local Feed</h1>
			<p class="text-xs text-muted-foreground">Public posts from everyone on this server</p>
		</div>
	</div>

	<!-- Feed -->
	{#if posts.length === 0}
		<Card class="p-10 text-center">
			<Rss class="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
			<p class="font-medium">No public posts yet</p>
			<p class="mt-1 text-sm text-muted-foreground">
				Be the first — head to your <a href="/profile" class="underline underline-offset-2"
					>profile</a
				> and share something!
			</p>
		</Card>
	{:else}
		<div class="space-y-4">
			{#each posts as post (post.id)}
				<div class="overflow-hidden rounded-xl border border-border bg-background shadow-sm">
					<!-- Author header -->
					{#if post.author}
						<a
							href={post.author.profileUrl}
							class="flex items-center gap-3 border-b border-border/60 px-4 py-3 transition-colors hover:bg-accent/40"
						>
							<Avatar class="h-8 w-8 shrink-0">
								{#if post.author.avatarUrl}
									<AvatarImage
										src={post.author.avatarUrl}
										alt={post.author.displayName || post.author.username}
									/>
								{/if}
								<AvatarFallback
									class="bg-gradient-to-br from-violet-500 to-fuchsia-500 text-xs font-bold text-white"
								>
									{getInitials(post.author.displayName || post.author.username)}
								</AvatarFallback>
							</Avatar>
							<div class="min-w-0">
								<p class="truncate text-sm leading-tight font-semibold">
									{post.author.displayName || post.author.username}
								</p>
								<p class="truncate text-xs text-muted-foreground">@{post.author.username}</p>
							</div>
						</a>
					{/if}

					<!-- Post body — re-using the existing Post component in read-only mode -->
					<div class="px-1 py-1">
						<Post
							activity={post}
							isOwner={false}
							username={post.author?.username ?? ''}
							onDelete={noop}
							onUpdate={noop}
						/>
					</div>
				</div>
			{/each}
		</div>

		<!-- Load more -->
		{#if nextCursor}
			<div class="flex justify-center pb-6">
				<Button variant="outline" onclick={loadMore} disabled={loadingMore}>
					{#if loadingMore}
						<Loader2 class="mr-2 h-4 w-4 animate-spin" />
						Loading…
					{:else}
						Load more
					{/if}
				</Button>
			</div>
		{:else}
			<p class="pb-6 text-center text-xs text-muted-foreground">
				You've reached the beginning of the feed.
			</p>
		{/if}
	{/if}
</div>
