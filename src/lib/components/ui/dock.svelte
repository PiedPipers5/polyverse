<script lang="ts">
	import { setContext } from 'svelte';
	import { cn } from '$lib/utils';
	import { useMotionValue } from 'svelte-motion';

	export let className: string | undefined = undefined;
	export let magnification: number = 60;
	export let distance: number = 140;
	export let direction: 'top' | 'middle' | 'bottom' = 'middle';

	// Create motion value for mouse tracking
	const mouseX = useMotionValue(Infinity);

	// Provide context for child elements
	setContext('dockContext', {
		mouseX,
		magnification,
		distance
	});

	function handleMouseMove(e: MouseEvent) {
		requestAnimationFrame(() => {
			mouseX.set(e.pageX);
		});
	}

	function handleMouseLeave() {
		mouseX.set(Infinity);
	}

	// Set the direction styles
	const directionClass =
		direction === 'top' ? 'items-start' : direction === 'middle' ? 'items-center' : 'items-end';
</script>

<div
	role="toolbar"
	tabindex="0"
	aria-label="Application dock"
	on:mousemove={handleMouseMove}
	on:mouseleave={handleMouseLeave}
	class={cn(
		'mx-auto flex h-[58px] w-max gap-2 rounded-2xl border p-2 backdrop-blur-md supports-backdrop-blur:bg-white/10 supports-backdrop-blur:dark:bg-black/10',
		directionClass,
		className
	)}
>
	<slot></slot>
</div>
