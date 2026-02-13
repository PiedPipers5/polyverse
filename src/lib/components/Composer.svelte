<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import { enhance } from '$app/forms';
	import { toast } from 'svelte-sonner';
	import { Globe, Lock, Users, ChevronDown } from 'lucide-svelte';

	let { username, onPostCreated }: { username: string; onPostCreated?: (post: any) => void } =
		$props();

	let content = $state('');
	let privacy = $state('public');
	let isSubmitting = $state(false);
	const charLimit = 500;

	let charsRemaining = $derived(charLimit - content.length);

	const privacyOptions = [
		{ value: 'public', label: 'Public', icon: Globe },
		{ value: 'unlisted', label: 'Unlisted', icon: Lock },
		{ value: 'followers', label: 'Followers', icon: Users }
	];

	async function handleSubmit() {
		if (!content.trim()) return;
		isSubmitting = true;

		try {
			// Optimistic update logic would go here if we had a globally managed store for the feed.
			// For now, we'll just submit to the endpoint.
			const response = await fetch(`/users/${username}/outbox`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ content, privacy })
			});

			if (response.ok) {
				const newActivity = await response.json();
				toast.success('Note published!');
				content = '';
				privacy = 'public'; // Reset privacy

				// Optimistic update: notify parent
				if (onPostCreated) {
					onPostCreated(newActivity);
				}
			} else {
				const error = await response.text();
				toast.error(`Failed to publish: ${error}`);
			}
		} catch (e) {
			toast.error('An error occurred while publishing.');
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
			<div class="flex items-center space-x-4">
				<div class="relative">
					<select
						bind:value={privacy}
						class="h-9 w-[130px] appearance-none rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
						disabled={isSubmitting}
					>
						{#each privacyOptions as option}
							<option value={option.value}>{option.label}</option>
						{/each}
					</select>
					<ChevronDown class="pointer-events-none absolute top-2.5 right-3 h-4 w-4 opacity-50" />
				</div>
				<span class="text-sm text-muted-foreground {charsRemaining < 0 ? 'text-destructive' : ''}">
					{charsRemaining} left
				</span>
			</div>

			<Button
				onclick={handleSubmit}
				disabled={isSubmitting || !content.trim() || charsRemaining < 0}
			>
				{isSubmitting ? 'Publishing...' : 'Publish'}
			</Button>
		</div>
	</div>
</div>
