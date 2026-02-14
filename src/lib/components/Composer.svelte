<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import { enhance } from '$app/forms';
	import { toast } from 'svelte-sonner';

	interface Props {
		username: string;
		initialContent?: string;
		mode?: 'create' | 'edit';
		objectId?: string; // Required for edit mode
		onPostCreated?: (post: any) => void;
		onPostUpdated?: (post: any) => void;
		onCancel?: () => void;
	}

	let {
		username,
		initialContent = '',
		mode = 'create',
		objectId,
		onPostCreated,
		onPostUpdated,
		onCancel
	}: Props = $props();

	let content = $state(initialContent);
	let isSubmitting = $state(false);
	const charLimit = 500;

	let charsRemaining = $derived(charLimit - content.length);

	async function handleSubmit() {
		if (!content.trim()) return;
		isSubmitting = true;

		try {
			const body = {
				content,
				action: mode,
				objectId: mode === 'edit' ? objectId : undefined
			};

			const response = await fetch(`/users/${username}/outbox`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(body)
			});

			if (response.ok) {
				const result = await response.json();

				if (mode === 'create') {
					toast.success('Note published!');
					content = '';
					if (onPostCreated) onPostCreated(result);
				} else {
					toast.success('Note updated!');
					if (onPostUpdated) onPostUpdated(result);
				}
			} else {
				const error = await response.text();
				toast.error(`Failed to ${mode}: ${error}`);
			}
		} catch (e) {
			toast.error(`An error occurred while ${mode === 'create' ? 'publishing' : 'updating'}.`);
			console.error(e);
		} finally {
			isSubmitting = false;
		}
	}
</script>

<div class="mx-auto w-full max-w-2xl rounded-lg border bg-card p-4 text-card-foreground shadow-sm">
	<div class="space-y-4">
		<Textarea
			placeholder="What's on your mind?"
			bind:value={content}
			class="min-h-[100px] resize-none"
			maxlength={charLimit}
			disabled={isSubmitting}
		/>
		<div class="flex items-center justify-between">
			<span class="text-sm text-muted-foreground {charsRemaining < 0 ? 'text-destructive' : ''}">
				{charsRemaining} characters remaining
			</span>
			<div class="flex gap-2">
				{#if mode === 'edit'}
					<Button variant="ghost" onclick={onCancel} disabled={isSubmitting}>Cancel</Button>
				{/if}
				<Button
					onclick={handleSubmit}
					disabled={isSubmitting || !content.trim() || charsRemaining < 0}
				>
					{isSubmitting
						? mode === 'create'
							? 'Publishing...'
							: 'Updating...'
						: mode === 'create'
							? 'Publish'
							: 'Update'}
				</Button>
			</div>
		</div>
	</div>
</div>
