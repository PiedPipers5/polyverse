<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { Toaster } from 'svelte-sonner';
	import { auth } from '$lib/stores/auth';
	import { page } from '$app/stores';

	import AppleStyleDock from '$lib/components/ui/apple-style-dock.svelte';

	let { children } = $props();

	$effect(() => {
		if ($page.data.user) {
			auth.setUser({
				id: $page.data.user.userId,
				name: $page.data.user.username, // Using username as name for now
				username: $page.data.user.username,
				email: '' // Not in locals yet
			});
		} else {
			auth.setUser(null);
		}
	});
</script>

<svelte:head>
	<link rel="icon" type="image/svg" href="/pied-piper.svg" />
</svelte:head>

{#if $auth.loading}
	<div class="flex min-h-screen items-center justify-center">Loading...</div>
{:else}
	<div class="flex min-h-screen bg-background text-foreground">
		{#if $auth.user && $page.url.pathname !== '/' && $page.url.pathname !== '/login' && $page.url.pathname !== '/register'}
			<AppleStyleDock currentPath={$page.url.pathname} />
			<main class="flex-1 pb-20">
				{@render children()}
			</main>
		{:else}
			<main class="flex-1">
				{@render children()}
			</main>
		{/if}
	</div>
{/if}

<Toaster richColors position="top-right" />
