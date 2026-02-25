<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import { toast } from 'svelte-sonner';
	import { Image as ImageIcon, X, Loader2, Globe, Lock, Users, ChevronDown } from 'lucide-svelte';
	import LanguagePicker from './LanguagePicker.svelte';

	interface MediaItem {
		url: string;
		type: string;
		uploading?: boolean;
		error?: string;
	}

	interface Props {
		username: string;
		initialContent?: string;
		initialMedia?: MediaItem[];
		initialPrivacy?: 'public' | 'unlisted' | 'followers';
		initialLanguage?: string;
		mode?: 'create' | 'edit';
		objectId?: string; // Required for edit mode
		onPostCreated?: (post: any) => void;
		onPostUpdated?: (post: any) => void;
		onCancel?: () => void;
	}

	let {
		username,
		initialContent = '',
		initialMedia = [],
		initialPrivacy = 'public',
		initialLanguage = 'en',
		mode = 'create',
		objectId,
		onPostCreated,
		onPostUpdated,
		onCancel
	}: Props = $props();

	let content = $state(initialContent);
	let isSubmitting = $state(false);
	let media = $state<MediaItem[]>(initialMedia);
	let privacy = $state<'public' | 'unlisted' | 'followers'>(initialPrivacy);
	let selectedLanguage = $state(initialLanguage);
	let privacyDropdownOpen = $state(false);
	let fileInput: HTMLInputElement;

	const charLimit = 500;
	const maxImages = 4;
	const maxFileSize = 5 * 1024 * 1024; // 5MB

	let charsRemaining = $derived(charLimit - content.length);
	let canAddMore = $derived(media.length < maxImages);

	function triggerFileInput() {
		fileInput?.click();
	}

	async function handleFileSelect(event: Event) {
		const target = event.target as HTMLInputElement;
		const files = target.files;
		if (!files) return;

		const filesToUpload = Array.from(files).slice(0, maxImages - media.length);

		for (const file of filesToUpload) {
			// Validate file type
			if (!file.type.startsWith('image/')) {
				toast.error(`${file.name} is not an image`);
				continue;
			}

			// Validate file size
			if (file.size > maxFileSize) {
				toast.error(`${file.name} exceeds 5MB limit`);
				continue;
			}

			await uploadFile(file);
		}

		// Reset input
		target.value = '';
	}

	async function uploadFile(file: File) {
		// Add placeholder
		const tempItem: MediaItem = {
			url: URL.createObjectURL(file),
			type: file.type,
			uploading: true
		};
		media.push(tempItem);
		const index = media.length - 1;

		try {
			const formData = new FormData();
			formData.append('file', file);

			const response = await fetch('/api/media/upload', {
				method: 'POST',
				body: formData
			});

			if (!response.ok) {
				const error = await response.text();
				throw new Error(error);
			}

			const result = await response.json();

			// Update with actual URL
			media[index] = {
				url: result.url,
				type: file.type,
				uploading: false
			};
		} catch (error) {
			console.error('Upload failed:', error);
			media[index].uploading = false;
			media[index].error = 'Upload failed';
			toast.error(`Failed to upload ${file.name}`);
		}
	}

	function removeMedia(index: number) {
		media.splice(index, 1);
	}

	const privacyOptions = [
		{ value: 'public', label: 'Public', icon: Globe },
		{ value: 'unlisted', label: 'Unlisted', icon: Lock },
		{ value: 'followers', label: 'Followers', icon: Users }
	];

	async function handleSubmit() {
		if (!content.trim() && media.length === 0) {
			toast.error('Please add some content or media');
			return;
		}

		// Check if any uploads are in progress
		if (media.some((m) => m.uploading)) {
			toast.error('Please wait for uploads to complete');
			return;
		}

		// Check for upload errors
		if (media.some((m) => m.error)) {
			toast.error('Please remove failed uploads');
			return;
		}

		isSubmitting = true;

		try {
			const body = {
				content,
				action: mode,
				privacy,
				language: selectedLanguage,
				objectId: mode === 'edit' ? objectId : undefined,
				media: media.map((m) => ({
					url: m.url,
					type: 'Image',
					mediaType: m.type
				}))
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
					media = [];
					privacy = 'public';
					selectedLanguage = 'en';
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

		<!-- Media Preview Grid -->
		{#if media.length > 0}
			<div class="grid grid-cols-2 gap-2">
				{#each media as item, index}
					<div class="relative aspect-square overflow-hidden rounded-md border bg-muted">
						{#if item.uploading}
							<div class="absolute inset-0 flex items-center justify-center bg-black/50">
								<Loader2 class="h-6 w-6 animate-spin text-white" />
							</div>
						{/if}
						{#if item.error}
							<div class="absolute inset-0 flex items-center justify-center bg-destructive/20">
								<span class="text-xs text-destructive">Failed</span>
							</div>
						{/if}
						<img src={item.url} alt="Upload preview" class="h-full w-full object-cover" />
						<button
							type="button"
							onclick={() => removeMedia(index)}
							disabled={isSubmitting}
							class="absolute top-1 right-1 rounded-full bg-black/70 p-1 text-white transition-colors hover:bg-black disabled:opacity-50"
						>
							<X class="h-4 w-4" />
						</button>
					</div>
				{/each}
			</div>
		{/if}

		<div class="flex items-center justify-between">
			<div class="flex items-center gap-2">
				<span class="text-sm text-muted-foreground {charsRemaining < 0 ? 'text-destructive' : ''}">
					{charsRemaining} characters remaining
				</span>
				{#if media.length > 0}
					<span class="text-sm text-muted-foreground">
						• {media.length}/{maxImages} images
					</span>
				{/if}
			</div>
			<div class="flex items-center gap-2">
				<!-- Media Upload Button -->
				<Button
					variant="ghost"
					size="icon"
					onclick={triggerFileInput}
					disabled={isSubmitting || !canAddMore}
					title={canAddMore ? 'Add images' : `Maximum ${maxImages} images`}
				>
					<ImageIcon class="h-5 w-5" />
				</Button>

				<!-- Privacy Selector -->
				<div class="relative">
					<Button
						variant="ghost"
						size="sm"
						onclick={() => (privacyDropdownOpen = !privacyDropdownOpen)}
						disabled={isSubmitting}
						class="flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
					>
						{#if privacy === 'public'}
							<Globe class="h-4 w-4" />
						{:else if privacy === 'unlisted'}
							<Lock class="h-4 w-4" />
						{:else}
							<Users class="h-4 w-4" />
						{/if}
						<span class="text-xs">{privacyOptions.find((o) => o.value === privacy)?.label}</span>
						<ChevronDown class="h-3 w-3" />
					</Button>

					{#if privacyDropdownOpen}
						<!-- Backdrop -->
						<button
							class="fixed inset-0 z-10 h-full w-full cursor-default"
							onclick={() => (privacyDropdownOpen = false)}
							type="button"
							aria-label="Close privacy menu"
						></button>

						<div
							class="absolute bottom-full left-0 z-20 mb-1 w-44 rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
						>
							{#each privacyOptions as option}
								<button
									type="button"
									class="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm transition-colors hover:bg-accent hover:text-accent-foreground {privacy ===
									option.value
										? 'bg-accent/50 font-medium'
										: ''}"
									onclick={() => {
										privacy = option.value as typeof privacy;
										privacyDropdownOpen = false;
									}}
								>
									<option.icon class="h-4 w-4" />
									<span>{option.label}</span>
								</button>
							{/each}
						</div>
					{/if}
				</div>

				<!-- Language Picker -->
				<LanguagePicker
					selected={selectedLanguage}
					onSelect={(code) => (selectedLanguage = code)}
					disabled={isSubmitting}
				/>

				{#if mode === 'edit'}
					<Button variant="ghost" onclick={onCancel} disabled={isSubmitting}>Cancel</Button>
				{/if}
				<Button
					onclick={handleSubmit}
					disabled={isSubmitting || (!content.trim() && media.length === 0) || charsRemaining < 0}
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

<!-- Hidden File Input -->
<input
	type="file"
	bind:this={fileInput}
	onchange={handleFileSelect}
	accept="image/*"
	multiple
	class="hidden"
/>
