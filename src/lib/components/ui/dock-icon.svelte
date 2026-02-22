<script lang="ts">
	import { cn } from '$lib/utils';
	export let className: string | undefined = undefined;
</script>

<div class={cn('flex flex-col items-center justify-center', className)}>
	<slot />
</div>
