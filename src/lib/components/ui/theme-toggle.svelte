<script lang="ts">
	import { Sun, Moon } from 'lucide-svelte';

	import { browser } from '$app/environment';

	import { onMount } from 'svelte';

	type Theme = 'light' | 'dark';

	let currentTheme = $state<Theme>('dark');

	// Run once when component mounts (client only)

	onMount(() => {
		if (!browser) return;

		const stored = localStorage.getItem('theme') as Theme | null;

		if (stored === 'light' || stored === 'dark') {
			currentTheme = stored;
		}

		// Apply theme to <html>

		document.documentElement.classList.toggle(
			'dark',

			currentTheme === 'dark'
		);
	});

	function handleClick() {
		const newTheme: Theme = currentTheme === 'dark' ? 'light' : 'dark';

		currentTheme = newTheme;

		if (!browser) return;

		localStorage.setItem('theme', newTheme);

		// document.documentElement.classList.toggle(
		// 	'dark',

		// 	newTheme === 'dark'
		// );
		document.getElementById('BODY')?.classList.toggle('dark', newTheme === 'dark');
	}
</script>

<button
	onclick={handleClick}
	type="button"
	class="glass-card relative cursor-pointer rounded-lg border-2 border-violet-500 px-3 py-2 hover:bg-violet-500/20"
	aria-label="Toggle theme"
	aria-pressed={currentTheme === 'dark'}
>
	{#if currentTheme === 'dark'}
		<Moon class="h-5 w-5 text-violet-400" />
	{:else}
		<Sun class="h-5 w-5 text-amber-500" />
	{/if}
</button>
