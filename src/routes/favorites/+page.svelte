<script lang="ts">
	import Post from '$lib/components/Post.svelte';
	import RightSidebar from '$lib/components/RightSidebar.svelte';
	import { Card } from '$lib/components/ui/card';
	import { Star, Sparkles } from 'lucide-svelte';
	import { onMount } from 'svelte';

	let { data } = $props();
	let favorites = $state(data.favorites || []);

	function handleRemoveFavorite(postId: string) {
		// Remove the post from the local list after un-favoriting
		favorites = favorites.filter((f: any) => {
			const apAct = f.activity || f;
			return (apAct.object?.id || apAct.id) !== postId;
		});
	}

	// Handle layout constraints for full-height scrolling
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
	<title>Favorites – Polyverse</title>
	<meta name="description" content="Your saved favorite posts on Polyverse." />
</svelte:head>

<div class="pv-favs">
	<!-- ══════════ COL 1 — Left sidebar ══════════ -->
	<aside class="pv-col-left border-r border-white/10">
		<div class="pv-left-scroll flex flex-col items-center px-4 py-8">
			<!-- Icon -->
			<div
				class="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 ring-1 ring-amber-500/20"
			>
				<Star class="h-8 w-8 text-amber-400" />
			</div>
			<h2 class="text-center text-lg font-extrabold text-foreground">Favorites</h2>
			<p class="mt-1 text-center text-xs text-foreground/40">
				{favorites.length}
				{favorites.length === 1 ? 'post' : 'posts'} saved
			</p>

			<!-- Divider -->
			<div class="my-6 h-px w-full bg-white/8"></div>

			<p class="text-center text-xs leading-relaxed text-foreground/40">
				Posts you favorited appear here. They're private — only you can see them.
			</p>
		</div>
	</aside>

	<!-- ══════════ COL 2 — Favorites feed ══════════ -->
	<main class="pv-col-center">
		<!-- Sticky header -->
		<div class="pv-favs-header border-b border-white/10 px-5 py-3.5">
			<div class="flex items-center gap-3">
				<div
					class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 shadow-md ring-1 shadow-amber-500/10 ring-amber-500/20"
				>
					<Star class="h-4 w-4 text-amber-400" />
				</div>
				<div>
					<h1 class="text-base leading-tight font-bold">Your Favorites</h1>
					<p class="text-[11px] text-muted-foreground">
						{favorites.length}
						{favorites.length === 1 ? 'saved post' : 'saved posts'}
					</p>
				</div>
			</div>
		</div>

		<!-- Scrollable feed -->
		<div class="pv-feed-scroll">
			<div class="space-y-4 px-5 py-4 pb-24">
				{#if favorites.length === 0}
					<!-- Empty state -->
					<Card
						class="glass-card flex flex-col items-center border border-white/10 py-20 text-center ring-1 ring-amber-500/10"
					>
						<div
							class="mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-amber-500/10 ring-1 ring-amber-500/20"
						>
							<Star class="h-10 w-10 text-amber-400/60" />
						</div>
						<h3 class="mb-2 text-xl font-bold">No favorites yet</h3>
						<p class="mx-auto max-w-xs text-sm text-foreground/50">
							Tap the <Star class="inline h-4 w-4 text-amber-400" /> star icon on any post to save it
							here for later.
						</p>
					</Card>
				{:else}
					{#each favorites as favPost (favPost.id || favPost.favoritedAt)}
						<!-- Saved post -->
						<div
							class="overflow-hidden rounded-2xl border border-amber-500/10 bg-card/80 shadow-xl ring-1 ring-amber-500/5 backdrop-blur-sm"
						>
							<!-- Favorited badge -->
							<div
								class="flex items-center gap-1.5 border-b border-amber-500/10 px-4 py-2 text-[10px] font-semibold tracking-wider text-amber-400/60 uppercase"
							>
								<Star class="h-3 w-3 fill-current" />
								Saved
							</div>
							<div class="px-1 py-1">
								<Post
									activity={favPost}
									isOwner={false}
									username=""
									isFavorited={true}
									onDelete={() => {}}
									onUpdate={() => {}}
								/>
							</div>
						</div>
					{/each}
				{/if}
			</div>
		</div>
	</main>

	<!-- ══════════ COL 3 — Right sidebar ══════════ -->
	<aside class="pv-col-right pv-panel border-l border-white/10">
		<div class="pv-right-scroll">
			<RightSidebar />
		</div>
	</aside>
</div>

<style>
	.pv-favs {
		display: grid;
		grid-template-columns: 280px minmax(0, 600px) 285px;
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

	.pv-col-center {
		display: flex;
		flex-direction: column;
		height: 100vh;
		min-height: 0;
		overflow: hidden;
	}

	.pv-favs-header {
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

	/* Mobile */
	@media (max-width: 1023px) {
		.pv-favs {
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
		.pv-favs-header {
			position: sticky;
			top: 0;
			z-index: 30;
		}
		.pv-feed-scroll {
			overflow: visible !important;
			flex: none !important;
		}
		.pv-col-right {
			display: none !important;
		}
	}

	/* Light mode */
	:root:not(.dark) .pv-panel,
	:root:not(.dark) .pv-favs-header,
	:root:not(.dark) .pv-col-left,
	:root:not(.dark) .pv-col-right {
		background: color-mix(in oklch, var(--background) 95%, transparent);
		border-color: oklch(0 0 0 / 10%) !important;
	}
	:root:not(.dark) .glass-card {
		background: white !important;
		border-color: oklch(0 0 0 / 10%) !important;
		box-shadow: 0 2px 12px -2px oklch(0 0 0 / 8%) !important;
	}
</style>
