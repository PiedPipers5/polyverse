<script lang="ts">
	import { LogOut, X } from 'lucide-svelte';
	import { Button } from './ui/button';
	import { enhance } from '$app/forms';

	let { open = $bindable(false) } = $props();

	let dialog: HTMLDialogElement;

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
</script>

{#if open}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<dialog
		bind:this={dialog}
		onclose={handleClose}
		onclick={handleOutsideClick}
		class="animate-fade-in-up fixed inset-0 z-50 m-auto flex h-fit w-full max-w-sm flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
	>
		<div class="flex flex-col items-center p-8 text-center">
			<div
				class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-50 ring-4 ring-red-100 dark:bg-red-900/20 dark:ring-red-900/30"
			>
				<LogOut class="h-8 w-8 text-red-500 dark:text-red-400" />
			</div>

			<h2 class="mb-2 text-xl font-bold">Logout Confirmation</h2>
			<p class="text-sm text-muted-foreground">
				Are you sure you want to log out? You'll need to log back in to access your account.
			</p>
		</div>

		<div class="flex border-t border-border">
			<button
				type="button"
				class="flex-1 border-r border-border/50 px-4 py-4 text-sm font-medium transition-colors hover:bg-muted/50"
				onclick={handleClose}
			>
				Cancel
			</button>

			<form method="POST" action="/logout" use:enhance class="flex-1">
				<button
					type="submit"
					class="w-full px-4 py-4 text-sm font-bold text-red-600 transition-colors hover:bg-red-50/50 dark:hover:bg-red-900/20"
				>
					Logout
				</button>
			</form>
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
