<script lang="ts">
	import { cn } from '$lib/utils';
	export let className: string | undefined = undefined;
</script>

<div class={cn('text-xs font-medium text-white', className)}>
	<slot />
</div>
