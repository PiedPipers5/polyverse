<script lang="ts">
	import { onMount } from 'svelte';
	import { Zap, Shield, Rocket, Users, Code, Globe } from 'lucide-svelte';
	import { createIntersectionObserver } from '$lib/utils/intersection-observer.svelte';
	import { calculate3DTilt, reset3DTilt } from '$lib/utils/animations';

	const features = [
		{
			icon: Zap,
			title: 'Decentralized Network',
			description:
				'No single authority controls your data. Join independent servers that interoperate seamlessly across the federation.'
		},
		{
			icon: Shield,
			title: 'Privacy First',
			description:
				'End-to-end encrypted messaging and privacy-preserving visibility controls keep your conversations secure.'
		},
		{
			icon: Rocket,
			title: 'Federation Protocol',
			description:
				'Built on open standards like ActivityPub, enabling cross-instance communication and content exchange.'
		},
		{
			icon: Users,
			title: 'Own Your Identity',
			description:
				'Distributed identity management means you control your digital presence, not a corporation.'
		},
		{
			icon: Code,
			title: 'Interoperable',
			description:
				"Connect with users across different federated platforms. Your friends aren't locked into one service."
		},
		{
			icon: Globe,
			title: 'Open Source',
			description:
				'Transparent, community-driven development. Audit the code, contribute features, and shape the future.'
		}
	];

	const observer = createIntersectionObserver({ threshold: 0.2 });
	let sectionElement: HTMLElement;

	onMount(() => {
		if (sectionElement) {
			observer.observe(sectionElement);
		}
	});

	function handleMouseMove(event: MouseEvent, element: HTMLElement) {
		const rect = element.getBoundingClientRect();
		const transform = calculate3DTilt(event.clientX, event.clientY, rect);
		element.style.transform = transform;
	}

	function handleMouseLeave(element: HTMLElement) {
		element.style.transform = reset3DTilt();
	}
</script>

<section
	id="features"
	class="relative overflow-hidden bg-background py-20 md:py-32"
	bind:this={sectionElement}
>
	<!-- Background Pattern -->
	<div
		class="absolute inset-0 opacity-30"
		style="background-image: radial-gradient(circle at 1px 1px, rgb(168 85 247 / 0.1) 1px, transparent 0); background-size: 40px 40px;"
	></div>

	<div class="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8">
		<!-- Section Header -->
		<div class="mx-auto mb-16 max-w-3xl text-center">
			<h2
				class="mb-4 text-3xl font-bold sm:text-4xl md:text-5xl {observer.isVisible
					? 'animate-fade-in-up'
					: 'opacity-0'}"
			>
				Revolutionary Features for
				<span class="gradient-text">Digital Sovereignty</span>
			</h2>
			<p
				class="text-lg text-foreground/70 {observer.isVisible ? 'animate-fade-in-up' : 'opacity-0'}"
				style="animation-delay: 0.1s;"
			>
				Everything you need to communicate freely, share securely, and build community on your own
				terms.
			</p>
		</div>

		<!-- Features Grid -->
		<div class="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
			{#each features as feature, index}
				<div
					class="feature-card glass-card rounded-2xl p-8 transition-all duration-300 hover:shadow-2xl hover:shadow-violet-500/10 {observer.isVisible
						? 'animate-fade-in-up'
						: 'opacity-0'}"
					style="animation-delay: {index * 0.1}s; will-change: transform;"
					role="presentation"
					onmousemove={(e) => handleMouseMove(e, e.currentTarget)}
					onmouseleave={(e) => handleMouseLeave(e.currentTarget)}
				>
					<!-- Icon -->
					<div
						class="mb-6 flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-lg"
					>
						<svelte:component this={feature.icon} class="h-6 w-6 text-white" />
					</div>

					<!-- Content -->
					<h3 class="mb-3 text-xl font-semibold">{feature.title}</h3>
					<p class="leading-relaxed text-foreground/70">
						{feature.description}
					</p>

					<!-- Gradient Border Effect -->
					<div
						class="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 hover:opacity-100"
						style="background: linear-gradient(135deg, rgba(139, 92, 246, 0.3) 0%, rgba(217, 70, 239, 0.3) 100%); padding: 2px; -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0); -webkit-mask-composite: xor; mask-composite: exclude;"
					></div>
				</div>
			{/each}
		</div>
	</div>
</section>

<style>
	.feature-card {
		position: relative;
		transform-style: preserve-3d;
		transition: transform 0.3s ease;
	}
</style>
