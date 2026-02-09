<script lang="ts">
	import { onMount } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import ThemeToggle from '$lib/components/ui/theme-toggle.svelte';

	let scrolled = $state(false);
	let mobileMenuOpen = $state(false);

	onMount(() => {
		const handleScroll = () => {
			scrolled = window.scrollY > 50;
		};

		window.addEventListener('scroll', handleScroll);
		return () => window.removeEventListener('scroll', handleScroll);
	});

	const navLinks = [
		{ label: 'Features', href: '#features' },
		{ label: 'About', href: '#about' },
		{ label: 'Contact', href: '#contact' }
	];
</script>

<nav
	class="fixed top-0 right-0 left-0 z-50 transition-all duration-300 {scrolled
		? 'glass-card bg-background/80 shadow-lg'
		: 'bg-transparent'}"
>
	<div class="container mx-auto px-4 sm:px-6 lg:px-8">
		<div class="flex h-16 items-center justify-between md:h-20">
			<!-- Logo -->
			<a href="/" class="group flex items-center space-x-2">
				<div
					class="flex h-10 w-10 transform items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 transition-transform group-hover:scale-110"
				>
					<span class="text-xl font-bold text-white">Pp</span>
				</div>
				<span class="gradient-text hidden text-xl font-bold sm:inline">POLYVERSE</span>
			</a>

			<!-- Desktop Navigation -->
			<div class="hidden items-center space-x-10 md:flex">
				{#each navLinks as link}
					<a
						href={link.href}
						class="group relative text-sm font-medium text-foreground/80 transition-colors hover:text-foreground"
					>
						{link.label}
						<span
							class="absolute -bottom-1 left-0 h-0.5 w-0 bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all group-hover:w-full"
						></span>
					</a>
				{/each}
			</div>

			<!-- Theme Toggle & CTA Buttons -->
			<div class="hidden items-center space-x-4 md:flex">
				<ThemeToggle />
				<a href="/login">
					<Button variant="ghost" size="sm">Sign In</Button>
				</a>
				<a href="/register">
					<Button
						size="sm"
						class="bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white hover:from-violet-600 hover:to-fuchsia-600"
					>
						Get Started
					</Button>
				</a>
			</div>

			<!-- Mobile Menu Button -->
			<button
				class="rounded-lg p-2 transition-colors hover:bg-muted md:hidden"
				onclick={() => (mobileMenuOpen = !mobileMenuOpen)}
				aria-label="Toggle menu"
			>
				<svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					{#if mobileMenuOpen}
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M6 18L18 6M6 6l12 12"
						/>
					{:else}
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M4 6h16M4 12h16M4 18h16"
						/>
					{/if}
				</svg>
			</button>
		</div>

		<!-- Mobile Menu -->
		{#if mobileMenuOpen}
			<div class="animate-fade-in pb-4 md:hidden">
				<div class="flex flex-col space-y-4">
					{#each navLinks as link}
						<a
							href={link.href}
							class="py-2 text-sm font-medium text-foreground/80 transition-colors hover:text-foreground"
							onclick={() => (mobileMenuOpen = false)}
						>
							{link.label}
						</a>
					{/each}
					<div class="flex flex-col space-y-2 border-t border-border pt-4">
						<a href="/login" onclick={() => (mobileMenuOpen = false)}>
							<Button variant="ghost" class="w-full">Sign In</Button>
						</a>
						<a href="/register" onclick={() => (mobileMenuOpen = false)}>
							<Button
								class="w-full bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white hover:from-violet-600 hover:to-fuchsia-600"
							>
								Get Started
							</Button>
						</a>
					</div>
				</div>
			</div>
		{/if}
	</div>
</nav>
