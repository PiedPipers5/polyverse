<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { Toaster } from 'svelte-sonner';
	import { auth } from '$lib/stores/auth';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{#if $auth.loading}
	<div class="flex min-h-screen items-center justify-center">
		Loading...
	</div>
{:else}
	<div class="min-h-screen bg-background text-foreground">
		{@render children()}
	</div>
{/if}

<Toaster richColors position="top-right" />
