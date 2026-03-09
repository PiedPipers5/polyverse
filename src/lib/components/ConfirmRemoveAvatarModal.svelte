<script lang="ts">
	import { Trash2, X } from 'lucide-svelte';
	import { Button } from './ui/button';

	let { open = $bindable(false), onConfirm } = $props();
	let isSubmitting = $state(false);

	let dialog = $state<HTMLDialogElement>();

	$effect(() => {
		if (open) {
			dialog?.showModal();
		} else {
			dialog?.close();
		}
	});

	function handleClose() {
		open = false;
	}

	function handleOutsideClick(e: MouseEvent) {
		if (e.target === dialog) {
			handleClose();
		}
	}

	async function handleConfirm() {
		isSubmitting = true;
		try {
			await onConfirm();
			handleClose();
		} finally {
			isSubmitting = false;
		}
	}
</script>

{#if open}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<dialog
		bind:this={dialog}
		onclose={handleClose}
		onclick={handleOutsideClick}
		class="animate-fade-in-up fixed inset-0 z-50 m-auto flex h-fit w-full max-w-sm flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm dark:border-white/10 dark:bg-zinc-950/90"
	>
		<div class="flex flex-col items-center p-8 text-center">
			<div
				class="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-red-500/10 ring-8 ring-red-500/5 dark:bg-red-500/20 dark:ring-red-500/10"
			>
				<div
					class="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/20 dark:bg-red-500/30"
				>
					<Trash2 class="h-6 w-6 text-red-600 dark:text-red-400" />
				</div>
			</div>

			<h2 class="mb-2 text-xl font-bold tracking-tight text-foreground">Remove Avatar?</h2>
			<p class="text-sm leading-relaxed text-muted-foreground">
				Are you sure you want to remove your profile picture? This action cannot be undone.
			</p>
		</div>

		<div class="flex border-t border-border/50 dark:border-white/5">
			<button
				type="button"
				class="flex-1 cursor-pointer border-r border-border/50 px-4 py-4 text-sm font-semibold transition-all hover:bg-muted/50 dark:border-white/5 dark:text-zinc-400 dark:hover:bg-white/5"
				onclick={handleClose}
				disabled={isSubmitting}
			>
				Cancel
			</button>

			<Button
				variant="ghost"
				class="h-full flex-1 rounded-none px-4 py-4 text-sm font-bold text-red-600 transition-all hover:bg-red-50/50 dark:text-red-500 dark:hover:bg-red-500/10"
				onclick={handleConfirm}
				loading={isSubmitting}
			>
				Remove
			</Button>
		</div>
	</dialog>
{/if}

<style>
	dialog::backdrop {
		animation: fade-in 200ms ease-out forwards;
	}

	@keyframes fade-in {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
</style>
