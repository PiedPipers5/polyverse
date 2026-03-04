<script lang="ts">
	import { Card } from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { toast } from 'svelte-sonner';
	import Composer from './Composer.svelte';
	import {
		EllipsisVertical,
		Trash2,
		Pencil,
		X,
		Globe,
		Lock,
		Users,
		Languages,
		Loader2,
		ArrowUp,
		ArrowDown,
		MessageSquare
	} from 'lucide-svelte';
	import { languages } from '$lib/constants/languages';
	import CommentSection from './CommentSection.svelte';

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
	let lightboxOpen = $state(false);
	let lightboxIndex = $state(0);

	let translatedContent = $state<string | null>(null);
	let isTranslating = $state(false);
	let showTranslated = $state(false);
	let showComments = $state(false);

	// Handle both flat ActivityPub objects and DB-wrapped rows
	let apActivity = $derived(activity.activity || activity);
	let targetObjectId = $derived(apActivity.object?.id || apActivity.id);
	let attachments = $derived(
		(apActivity.object?.attachment || apActivity.attachment || []).filter(
			(a: any) => a.type === 'Image'
		)
	);

	// Derive privacy level from ActivityPub to/cc fields
	const PUBLIC_URI = 'https://www.w3.org/ns/activitystreams#Public';
	let privacyLevel = $derived.by(() => {
		const obj = apActivity.object || apActivity;
		const to: string[] = obj.to || [];
		const cc: string[] = obj.cc || [];
		if (to.includes(PUBLIC_URI)) return 'public';
		if (cc.includes(PUBLIC_URI)) return 'unlisted';
		return 'followers';
	});

	let postLanguage = $derived.by(() => {
		const obj = apActivity.object || apActivity;
		const contentMap = obj.contentMap || {};
		const codes = Object.keys(contentMap);
		return codes[0] || 'en';
	});

	let languageName = $derived(
		languages.find((l) => l.code === postLanguage)?.nativeName || postLanguage
	);

	let isVoting = $state(false);
	let localNetScore = $state(activity.netScore || 0);
	let localUserVote = $state<'upvote' | 'downvote' | null>(activity.userVote || null);

	$effect(() => {
		localNetScore = activity.netScore || 0;
		localUserVote = activity.userVote || null;
	});

	async function handleVote(action: 'upvote' | 'downvote') {
		if (isVoting) return;
		isVoting = true;

		const previousVote = localUserVote;
		const previousScore = localNetScore;

		let newVote: 'upvote' | 'downvote' | null = action;
		if (previousVote === action) {
			newVote = null;
		}

		localUserVote = newVote;

		let scoreDiff = 0;
		if (previousVote === 'upvote') scoreDiff -= 1;
		else if (previousVote === 'downvote') scoreDiff += 1;

		if (newVote === 'upvote') scoreDiff += 1;
		else if (newVote === 'downvote') scoreDiff -= 1;

		localNetScore += scoreDiff;

		try {
			const res = await fetch('/api/interact', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					postId: targetObjectId,
					action: newVote === null ? 'remove' : newVote
				})
			});

			if (!res.ok) {
				throw new Error('Vote failed');
			}
		} catch (e) {
			localUserVote = previousVote;
			localNetScore = previousScore;
			toast.error('Failed to register vote. Please try again.');
		} finally {
			isVoting = false;
		}
	}

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

	function openLightbox(index: number) {
		lightboxIndex = index;
		lightboxOpen = true;
	}

	function closeLightbox() {
		lightboxOpen = false;
	}

	function nextImage() {
		if (lightboxIndex < attachments.length - 1) {
			lightboxIndex++;
		}
	}

	function prevImage() {
		if (lightboxIndex > 0) {
			lightboxIndex--;
		}
	}

	async function translatePost() {
		if (translatedContent) {
			showTranslated = !showTranslated;
			return;
		}

		isTranslating = true;
		try {
			const contentToTranslate = activity.content || activity.object?.content;
			const response = await fetch('/api/ai/translate', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					text: contentToTranslate,
					targetLanguage: 'en' // Default to English for now
				})
			});

			if (response.ok) {
				const result = await response.json();
				translatedContent = result.translatedText;
				showTranslated = true;
			} else {
				const err = await response.json();
				toast.error(err.message || 'Translation failed. Make sure AI is configured.');
			}
		} catch (e) {
			toast.error('Error during translation');
			console.error(e);
		} finally {
			isTranslating = false;
		}
	}
</script>

{#if isEditing}
	<div class="mb-4">
		<Composer
			mode="edit"
			{username}
			initialContent={activity.content || activity.object?.content}
			initialMedia={attachments.map((a: any) => ({ url: a.url, type: a.mediaType }))}
			initialPrivacy={privacyLevel}
			initialLanguage={postLanguage}
			objectId={targetObjectId}
			onCancel={() => (isEditing = false)}
			onPostUpdated={handleUpdate}
		/>
	</div>
{:else}
	<Card
		class="glass-card group relative border border-white/10 p-4 shadow-xl ring-1 ring-violet-500/10 transition-all hover:shadow-2xl"
	>
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

		<div class="space-y-2">
			<p class="pr-8 text-base whitespace-pre-wrap">
				{showTranslated ? translatedContent : activity.content || activity.object?.content}
			</p>

			{#if showTranslated}
				<p class="flex items-center gap-1 text-[10px] text-muted-foreground italic">
					<span class="inline-block h-1 w-1 animate-pulse rounded-full bg-primary"></span>
					Translated by Google Gemini
				</p>
			{/if}
		</div>

		<!-- Media Gallery -->
		{#if attachments.length > 0}
			<div class="mt-3 {attachments.length === 1 ? '' : 'grid grid-cols-2 gap-1.5 md:gap-2'}">
				{#each attachments as attachment, index}
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
					<img
						src={attachment.url}
						alt="Post image {index + 1}"
						class="{attachments.length === 1
							? 'max-h-96 w-full'
							: 'aspect-square'} cursor-pointer rounded-md object-cover transition-opacity hover:opacity-90"
						onclick={() => openLightbox(index)}
					/>
				{/each}
			</div>
		{/if}

		<div class="mt-3 flex items-center justify-between">
			<!-- Vote controls -->
			<div class="flex items-center gap-1 rounded-full bg-white/5 p-1 ring-1 ring-white/10">
				<button
					class="flex h-7 w-7 items-center justify-center rounded-full transition-colors hover:bg-white/10 {localUserVote ===
					'upvote'
						? 'bg-violet-500/20 text-violet-400'
						: 'text-foreground/50'}"
					onclick={() => handleVote('upvote')}
					disabled={isVoting}
					aria-label="Upvote"
				>
					<ArrowUp class="h-4 w-4" />
				</button>
				<span
					class="min-w-[1.5rem] text-center text-xs font-bold {localUserVote === 'upvote'
						? 'text-violet-400'
						: localUserVote === 'downvote'
							? 'text-rose-400'
							: 'text-foreground/70'}"
				>
					{localNetScore}
				</span>
				<button
					class="flex h-7 w-7 items-center justify-center rounded-full transition-colors hover:bg-white/10 {localUserVote ===
					'downvote'
						? 'bg-rose-500/20 text-rose-400'
						: 'text-foreground/50'}"
					onclick={() => handleVote('downvote')}
					disabled={isVoting}
					aria-label="Downvote"
				>
					<ArrowDown class="h-4 w-4" />
				</button>
			</div>

			<!-- Comment toggle -->
			<button
				class="flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1 text-xs font-medium ring-1 ring-white/10 transition-colors hover:bg-white/10 {showComments
					? 'text-violet-400'
					: 'text-foreground/50'}"
				onclick={() => (showComments = !showComments)}
			>
				<MessageSquare class="h-3.5 w-3.5" />
				{showComments ? 'Hide' : 'Comments'}
			</button>

			<p
				class="flex flex-wrap items-center justify-end gap-x-3 gap-y-1.5 text-xs text-muted-foreground"
			>
				{#if privacyLevel === 'public'}
					<span class="flex items-center gap-1"><Globe class="h-3.5 w-3.5" /> Public</span>
				{:else if privacyLevel === 'unlisted'}
					<span class="flex items-center gap-1"><Lock class="h-3.5 w-3.5" /> Unlisted</span>
				{:else}
					<span class="flex items-center gap-1"><Users class="h-3.5 w-3.5" /> Followers</span>
				{/if}
				<span>
					{new Date(activity.publishedAt || activity.published).toLocaleString('en-IN', {
						day: '2-digit',
						month: '2-digit',
						year: 'numeric',
						hour: '2-digit',
						minute: '2-digit',
						hour12: true,
						timeZone: 'Asia/Kolkata'
					})} IST
				</span>
				{#if activity.object?.updated}
					<span class="italic">(edited)</span>
				{/if}
				<span class="flex items-center gap-1">
					<Languages class="h-3 w-3" />
					{languageName}
				</span>
				{#if postLanguage !== 'en'}
					<button
						onclick={translatePost}
						disabled={isTranslating}
						class="group ml-2 flex items-center gap-1 transition-colors hover:text-primary"
					>
						{#if isTranslating}
							<Loader2 class="h-3 w-3 animate-spin" />
							<span>Translating...</span>
						{:else}
							<span>{showTranslated ? 'Show Original' : 'Translate'}</span>
						{/if}
					</button>
				{/if}
			</p>
		</div>
	</Card>

	<!-- Comment section (below the card) -->
	{#if showComments}
		<div class="mt-2">
			<CommentSection postId={targetObjectId} {username} />
		</div>
	{/if}
{/if}

<!-- Lightbox -->
{#if lightboxOpen}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
		onclick={closeLightbox}
	>
		<button
			class="absolute top-4 right-4 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
			onclick={closeLightbox}
			aria-label="Close"
		>
			<X class="h-6 w-6" />
		</button>

		{#if attachments.length > 1}
			<button
				class="absolute left-4 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20 disabled:opacity-50"
				onclick={(e) => {
					e.stopPropagation();
					prevImage();
				}}
				disabled={lightboxIndex === 0}
				aria-label="Previous"
			>
				←
			</button>
			<button
				class="absolute right-4 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20 disabled:opacity-50"
				onclick={(e) => {
					e.stopPropagation();
					nextImage();
				}}
				disabled={lightboxIndex === attachments.length - 1}
				aria-label="Next"
			>
				→
			</button>
		{/if}

		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<img
			src={attachments[lightboxIndex].url}
			alt="Full size image"
			class="max-h-[90vh] max-w-[90vw] object-contain"
			onclick={(e) => e.stopPropagation()}
		/>

		{#if attachments.length > 1}
			<div
				class="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-sm text-white"
			>
				{lightboxIndex + 1} / {attachments.length}
			</div>
		{/if}
	</div>
{/if}
