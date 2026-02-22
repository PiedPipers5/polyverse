<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import { cn } from '$lib/utils';

	export let className: string | undefined = undefined;

	// Animation stores from svelte-motion
	import { useMotionValue, useTransform, useSpring, Motion, type MotionValue } from 'svelte-motion';

	const ctx = getContext<{ mouseX: MotionValue<number>; magnification: number; distance: number }>(
		'dockContext'
	);

	let ref: HTMLDivElement;
	let isHovered = false;

	const widthTransform = useTransform(ctx.mouseX, (val: number) => {
		if (val === Infinity || !ref) return 40;
		const bounds = ref.getBoundingClientRect();
		const elementX = bounds.x + bounds.width / 2;
		const dist = val - elementX;

		// Calculate magnification based on distance
		if (Math.abs(dist) < ctx.distance) {
			// Linear interpolation for simpler bell curve
			const factor = 1 - Math.abs(dist) / ctx.distance;
			return 40 + (ctx.magnification - 40) * factor;
		}
		return 40;
	});

	// Apply spring physics to width
	const width = useSpring(widthTransform, {
		mass: 0.1,
		stiffness: 150,
		damping: 12
	});
</script>

<div
	bind:this={ref}
	role="presentation"
	on:mouseenter={() => (isHovered = true)}
	on:mouseleave={() => (isHovered = false)}
	class="relative flex aspect-square cursor-pointer items-center justify-center rounded-full transition-colors"
>
	<Motion let:motion style={{ width, height: width } as any}>
		<div
			use:motion
			class={cn(
				'flex items-center justify-center rounded-full bg-neutral-200/50 hover:bg-neutral-200 dark:bg-neutral-800/50 dark:hover:bg-neutral-800',
				className
			)}
		>
			<!-- Slot for icon -->
			<slot name="icon"></slot>
		</div>
	</Motion>

	<!-- Slot for label -->
	{#if isHovered}
		<div
			class="absolute -top-10 left-1/2 -translate-x-1/2 rounded-md bg-black/80 px-2 py-1 text-xs whitespace-nowrap text-white backdrop-blur-md dark:bg-white/80 dark:text-black"
		>
			<slot name="label"></slot>
		</div>
	{/if}
</div>
