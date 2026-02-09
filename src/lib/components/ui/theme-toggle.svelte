<script lang="ts">
	import { Sun, Moon } from 'lucide-svelte';
	import { browser } from '$app/environment';

	type Theme = 'light' | 'dark';

	let currentTheme = $state<Theme>('dark');
	let mounted = $state(false);

	// Initialize on mount
	$effect(() => {
		if (browser && !mounted) {
			mounted = true;
			const stored = localStorage.getItem('theme') as Theme;
			if (stored === 'light' || stored === 'dark') {
				currentTheme = stored;
			}

			// Apply dark mode to html element
			if (currentTheme === 'dark') {
				document.documentElement.classList.add('dark');
			} else {
				document.documentElement.classList.remove('dark');
			}
			console.log('Theme initialized:', currentTheme);
		}
	});

	function handleClick() {
		console.log('BUTTON CLICKED! Current theme:', currentTheme);

		const newTheme: Theme = currentTheme === 'dark' ? 'light' : 'dark';
		currentTheme = newTheme;

		if (browser) {
			localStorage.setItem('theme', newTheme);

			// Properly set dark class
			if (newTheme === 'dark') {
				document.documentElement.classList.add('dark');
			} else {
				document.documentElement.classList.remove('dark');
			}

			console.log('Theme changed to:', newTheme);
			console.log('HTML has dark class:', document.documentElement.classList.contains('dark'));
		}
	}
</script>

<button
	onclick={handleClick}
	type="button"
	class="glass-card relative cursor-pointer rounded-lg border-2 border-violet-500 px-3 py-2 hover:bg-violet-500/20"
	aria-label="Toggle theme"
>
	{#if currentTheme === 'dark'}
		<Moon class="h-5 w-5 text-violet-400" />
	{:else}
		<Sun class="h-5 w-5 text-amber-500" />
	{/if}
</button>
