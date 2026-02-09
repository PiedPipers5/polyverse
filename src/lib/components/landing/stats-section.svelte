<script lang="ts">
	import { onMount } from 'svelte';
	import { createIntersectionObserver } from '$lib/utils/intersection-observer.svelte';

	const stats = [
		{ label: 'Federated Instances' },
		{ label: 'Active Users' },
		{ label: 'Messages Daily' },
		{ label: 'Communities' }
	];

	const observer = createIntersectionObserver({ threshold: 0.5 });
	let sectionElement: HTMLElement;

	onMount(() => {
		if (sectionElement) {
			observer.observe(sectionElement);
		}
	});
</script>

<section
	id="about"
	class="relative overflow-hidden bg-gradient-to-b from-background to-muted/30 py-20 md:py-32"
	bind:this={sectionElement}
>
	<!-- Background Glow -->
	<div
		class="absolute top-1/2 left-1/2 h-[800px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-500/10 blur-3xl"
	></div>

	<div class="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8">
		<!-- Section Header -->
		<div class="mx-auto mb-16 max-w-3xl text-center">
			<h2
				class="mb-4 text-3xl font-bold sm:text-4xl md:text-5xl {observer.isVisible
					? 'animate-fade-in-up'
					: 'opacity-0'}"
			>
				Growing
				<span class="gradient-text">Federation Network</span>
			</h2>
			<p
				class="text-lg text-foreground/70 {observer.isVisible ? 'animate-fade-in-up' : 'opacity-0'}"
				style="animation-delay: 0.1s;"
			>
				Join a thriving community of users who value privacy, freedom, and decentralized
				communication.
			</p>
		</div>

		<!-- Stats Grid -->
		<div class="grid grid-cols-2 gap-8 md:grid-cols-4 md:gap-12">
			{#each stats as stat, index}
				<div
					class="text-center {observer.isVisible ? 'animate-fade-in-up' : 'opacity-0'}"
					style="animation-delay: {index * 0.1}s;"
				>
					<div class="mb-3">
						<div
							class="glass-card mb-2 inline-flex items-center justify-center rounded-full border border-violet-500/30 px-4 py-2"
						>
							<span class="text-xs font-semibold tracking-wide text-violet-400 uppercase"
								>Coming Soon</span
							>
						</div>
					</div>
					<div class="text-sm font-medium text-foreground/80 md:text-base">
						{stat.label}
					</div>
				</div>
			{/each}
		</div>
	</div>
</section>
