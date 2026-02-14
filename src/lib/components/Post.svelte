<script lang="ts">
	import { Card } from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { toast } from 'svelte-sonner';
	import Composer from './Composer.svelte';
	import { EllipsisVertical, Trash2, Pencil } from 'lucide-svelte';

	interface Props {
		activity: any;
		isOwner: boolean;
		username: string; // Current user's username (for API calls)
		onDelete: (id: string) => void;
		onUpdate: (updatedActivity: any) => void;
	}

	let { activity, isOwner, username, onDelete, onUpdate }: Props = $props();

	let isEditing = $state(false);
	let isMenuOpen = $state(false);
	let isDeleting = $state(false);

	// Handle both flat ActivityPub objects and DB-wrapped rows
	let apActivity = $derived(activity.activity || activity);
	let targetObjectId = $derived(apActivity.object?.id || apActivity.id);

	// Close menu when clicking outside (simple implementation)
	function toggleMenu() {
		isMenuOpen = !isMenuOpen;
	}

	async function handleDelete() {
		if (!confirm('Are you sure you want to delete this post?')) return;

		isDeleting = true;
		try {
			const response = await fetch(`/users/${username}/outbox`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'delete',
					objectId: targetObjectId
				})
			});

			if (response.ok) {
				toast.success('Post deleted');
				onDelete(targetObjectId);
			} else {
				toast.error('Failed to delete post');
			}
		} catch (e) {
			toast.error('Error deleting post');
			console.error(e);
		} finally {
			isDeleting = false;
		}
	}

	function handleUpdate(newActivity: any) {
		// The API returns the Update activity.
		// We need to construct the new state of the post for the UI.
		// The newActivity.object contains the updated data.

		// However, our backend implementation of 'edit' returns the Update activity
		// which contains the FULL updated object in `object` field.
		const updatedObject = newActivity.object;

		// We need to pass the updated structure back up
		// The parent expects the format it uses for the feed.
		// Since we are replacing the Feed's activity item...

		// Construct a UI-compatible activity object
		// We can just reuse the original activity wrapper but replace the object content
		const optimizedUpdate = {
			...activity,
			object: updatedObject,
			// Update the top-level published if we want to sort by update time?
			// Usually feeds sort by original publish time.
			// But we might want to show "Edited at..."
			content: updatedObject.content, // For convenience if we flat mapped it
			publishedAt: activity.publishedAt // Keep original time for sorting
		};

		onUpdate(optimizedUpdate);
		isEditing = false;
	}
</script>

{#if isEditing}
	<div class="mb-4">
		<Composer
			mode="edit"
			{username}
			initialContent={activity.content || activity.object?.content}
			objectId={targetObjectId}
			onCancel={() => (isEditing = false)}
			onPostUpdated={handleUpdate}
		/>
	</div>
{:else}
	<Card class="group relative p-4">
		{#if isOwner}
			<div class="absolute top-2 right-2">
				<Button variant="ghost" size="icon" class="h-8 w-8" onclick={toggleMenu}>
					<EllipsisVertical class="h-4 w-4" />
				</Button>

				{#if isMenuOpen}
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div
						class="absolute right-0 z-10 mt-1 w-32 rounded-md border bg-popover text-popover-foreground shadow-md"
					>
						<div class="p-1">
							<button
								class="flex w-full items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
								onclick={() => {
									isEditing = true;
									isMenuOpen = false;
								}}
							>
								<Pencil class="mr-2 h-4 w-4" />
								Edit
							</button>
							<button
								class="flex w-full items-center rounded-sm px-2 py-1.5 text-sm text-destructive hover:bg-accent hover:text-accent-foreground"
								onclick={() => {
									handleDelete();
									isMenuOpen = false;
								}}
							>
								<Trash2 class="mr-2 h-4 w-4" />
								Delete
							</button>
						</div>
					</div>

					<!-- Backdrop to close menu -->
					<button
						class="fixed inset-0 z-0 h-full w-full cursor-default"
						onclick={() => (isMenuOpen = false)}
						onkeydown={(e) => {
							if (e.key === 'Escape') isMenuOpen = false;
						}}
						aria-label="Close menu"
						type="button"
					></button>
				{/if}
			</div>
		{/if}

		<p class="pr-8 text-base whitespace-pre-wrap">{activity.content || activity.object?.content}</p>

		<div class="mt-2 flex items-center justify-between">
			<p class="text-xs text-muted-foreground">
				{new Date(activity.publishedAt || activity.published).toLocaleString('en-IN', {
					day: '2-digit',
					month: '2-digit',
					year: 'numeric',
					hour: '2-digit',
					minute: '2-digit',
					hour12: true,
					timeZone: 'Asia/Kolkata'
				})} IST
				{#if activity.object?.updated}
					<span class="ml-2 italic">(edited)</span>
				{/if}
			</p>
		</div>
	</Card>
{/if}
