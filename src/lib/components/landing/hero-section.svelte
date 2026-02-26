<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { ChevronDown } from 'lucide-svelte';

	type User = {
		username: string;
		displayName: string | null;
		avatarUrl: string | null;
	};

	type Props = {
		user?: User | null;
	};

	let { user = null }: Props = $props();
</script>

<section class="relative flex min-h-screen items-center justify-center overflow-hidden pt-26">
	<!-- Animated Gradient Background -->
	<div
		class="animate-gradient absolute inset-0 bg-linear-to-br from-violet-500/20 via-purple-500/20 to-fuchsia-500/20 dark:from-violet-900/30 dark:via-purple-900/30 dark:to-fuchsia-900/30"
	></div>

	<!-- Floating Particles -->
	<div class="pointer-events-none absolute inset-0 overflow-hidden">
		{#each Array(20) as _, i}
			<div
				class="animate-float absolute h-2 w-2 rounded-full bg-violet-500/30"
				style="left: {Math.random() * 100}%; top: {Math.random() * 100}%; animation-delay: {i *
					0.3}s; animation-duration: {6 + Math.random() * 4}s;"
			></div>
		{/each}
	</div>

	<!-- Content -->
	<div class="relative z-10 container mx-auto px-4 text-center sm:px-6 lg:px-8">
		<div class="animate-fade-in-up mx-auto max-w-4xl space-y-8">
			<!-- Badge -->
			<div class="inline-flex">
				<span
					class="glass-card rounded-full px-4 py-2 text-sm font-medium text-foreground/90 shadow-lg"
				>
					🌐 Federated Social Networking
				</span>
			</div>

			<!-- Main Headline -->
			<h1 class="xs:text-4xl text-3xl leading-tight font-bold sm:text-5xl md:text-6xl lg:text-7xl">
				Own Your Digital Identity in the
				<span class="gradient-text mt-2 block">"POLYVERSE"</span>
			</h1>

			<!-- Subtitle -->
			<p
				class="mx-auto max-w-2xl text-lg leading-relaxed text-foreground/70 sm:text-xl md:text-2xl"
			>
				A decentralized social network where privacy, security, and user autonomy come first. Join
				the federation and take control of your data.
			</p>

			<!-- CTA Buttons -->
			<div class="flex flex-col items-center justify-center gap-4 pt-4 sm:flex-row">
				<a href={user ? '/profile' : '/register'}>
					<Button
						size="lg"
						class="bg-linear-to-r from-violet-500 to-fuchsia-500 px-8 py-6 text-lg text-white shadow-2xl transition-all duration-300 hover:scale-105 hover:from-violet-600 hover:to-fuchsia-600 hover:shadow-violet-500/50"
					>
						{user ? 'Go to Profile' : 'Get Started Free'}
					</Button>
				</a>
				<a href="#features">
					<Button
						size="lg"
						variant="outline"
						class="glass-card px-8 py-6 text-lg transition-all duration-300 hover:scale-105"
					>
						Learn More
					</Button>
				</a>
			</div>

			<!-- Stats -->
			<div class="grid grid-cols-2 gap-4 pt-12 pb-16 md:grid-cols-4 md:gap-8 md:pb-16">
				{#each [{ value: '100%', label: 'You Own Your Data' }, { value: 'Federated', label: 'Network' }, { value: 'E2E', label: 'Encrypted' }, { value: 'Open', label: 'Source' }] as stat}
					<div class="space-y-1">
						<div class="gradient-text text-2xl font-bold md:text-3xl">
							{stat.value}
						</div>
						<div class="text-sm text-foreground/60">{stat.label}</div>
					</div>
				{/each}
			</div>
		</div>
	</div>

	<!-- Scroll Indicator -->
	<a
		href="#features"
		class="animate-float absolute bottom-8 left-1/2 -translate-x-1/2"
		aria-label="Scroll to features"
	>
		<ChevronDown class="h-8 w-8 text-foreground/40" />
	</a>
</section>
