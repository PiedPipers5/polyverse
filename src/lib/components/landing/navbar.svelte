<script lang="ts">
	import { onMount } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import ThemeToggle from '$lib/components/ui/theme-toggle.svelte';
	import GlobalSearch from '$lib/components/GlobalSearch.svelte';

	type User = {
		username: string;
		displayName: string | null;
		avatarUrl: string | null;
	};

	type Props = {
		user?: User | null;
	};

	let { user = null }: Props = $props();

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
	class="fixed top-0 right-0 left-0 z-50 border-b border-border/60 backdrop-blur-xl transition-all duration-300 {scrolled
		? 'bg-white/90 shadow-sm dark:bg-[#0d0a1a]/92 dark:shadow-lg dark:shadow-violet-950/40'
		: 'bg-white/70 dark:bg-[#0d0a1a]/75'}"
>
	<div class="container mx-auto px-6 sm:px-8 lg:px-12">
		<div class="relative flex h-18 items-center justify-between md:h-20">
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
			<div class="absolute left-1/2 hidden -translate-x-1/2 items-center space-x-14 md:flex">
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
				{#if user}
					<GlobalSearch />
				{/if}
				<ThemeToggle />
				{#if user}
					<!-- Logged in: Show profile avatar -->
					<a href="/profile" class="group flex items-center space-x-2">
						{#if user.avatarUrl}
							<img
								src={user.avatarUrl}
								alt={user.displayName || user.username}
								class="h-10 w-10 rounded-full border-2 border-violet-500 object-cover transition-transform group-hover:scale-110"
							/>
						{:else}
							<div
								class="flex h-10 w-10 items-center justify-center rounded-full border-2 border-violet-500 bg-gradient-to-br from-violet-500 to-fuchsia-500 font-semibold text-white transition-transform group-hover:scale-110"
							>
								{(user.displayName || user.username).charAt(0).toUpperCase()}
							</div>
						{/if}
					</a>
				{:else}
					<!-- Logged out: Show auth buttons -->
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
				{/if}
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
					{#if user}
						<div class="pt-4 pb-2">
							<GlobalSearch />
						</div>
					{/if}
					<div class="flex flex-col space-y-2 border-t border-border pt-4">
						{#if user}
							<!-- Logged in: Show profile link -->
							<a
								href="/profile"
								onclick={() => (mobileMenuOpen = false)}
								class="flex items-center space-x-3 py-2"
							>
								{#if user.avatarUrl}
									<img
										src={user.avatarUrl}
										alt={user.displayName || user.username}
										class="h-10 w-10 rounded-full border-2 border-violet-500 object-cover"
									/>
								{:else}
									<div
										class="flex h-10 w-10 items-center justify-center rounded-full border-2 border-violet-500 bg-gradient-to-br from-violet-500 to-fuchsia-500 font-semibold text-white"
									>
										{(user.displayName || user.username).charAt(0).toUpperCase()}
									</div>
								{/if}
								<span class="text-sm font-medium">View Profile</span>
							</a>
						{:else}
							<!-- Logged out: Show auth buttons -->
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
						{/if}
					</div>
				</div>
			</div>
		{/if}
	</div>
</nav>
