<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import { Avatar, AvatarFallback, AvatarImage } from '$lib/components/ui/avatar';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import { toast } from 'svelte-sonner';
	import { fly, fade, scale } from 'svelte/transition';
	import EmojiPicker from './EmojiPicker.svelte';
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
		inReplyTo?: string; // For replies/comments
		compact?: boolean; // Compact mode for comment sections
		placeholder?: string;
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
		inReplyTo,
		compact = false,
		placeholder = "What's on your mind?",
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
	let textarea = $state<HTMLTextAreaElement | null>(null);

	function handleEmojiSelect(emoji: string) {
		if (!textarea) return;
		const start = textarea.selectionStart ?? 0;
		const end = textarea.selectionEnd ?? 0;
		const text = content;
		content = text.substring(0, start) + emoji + text.substring(end);

		// Set cursor position after emoji (requires tick/effect)
		setTimeout(() => {
			if (textarea) {
				textarea.focus();
				textarea.selectionStart = textarea.selectionEnd = start + emoji.length;
			}
		}, 0);
	}

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
			const body: Record<string, unknown> = {
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

			if (inReplyTo) {
				body.inReplyTo = inReplyTo;
			}

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

<div
	class="glass-card mx-auto w-full max-w-2xl border border-white/10 p-5 shadow-2xl ring-1 ring-white/5 transition-all"
>
	<div class="space-y-4">
		<!-- Main Input Area -->
		<div
			class="relative rounded-2xl bg-black/20 p-4 transition-all focus-within:ring-1 focus-within:ring-violet-500/30"
		>
			<Textarea
				{placeholder}
				bind:value={content}
				bind:ref={textarea}
				class="min-h-[160px] w-full border-none bg-transparent p-0 text-lg leading-relaxed shadow-none placeholder:text-muted-foreground/30 focus-visible:ring-0 {compact
					? 'min-h-[60px]'
					: ''}"
				maxlength={charLimit}
				disabled={isSubmitting}
			/>

			<!-- Media Preview Grid -->
			{#if media.length > 0}
				<div class="mt-4 grid grid-cols-2 gap-3">
					{#each media as item, index}
						<div
							class="relative aspect-video overflow-hidden rounded-xl border border-white/10 bg-muted/20"
						>
							{#if item.uploading}
								<div
									class="absolute inset-0 z-10 flex items-center justify-center bg-black/60 backdrop-blur-sm"
								>
									<Loader2 class="h-6 w-6 animate-spin text-violet-400" />
								</div>
							{:else if item.error}
								<div
									class="absolute inset-0 z-10 flex items-center justify-center bg-rose-500/20 backdrop-blur-sm"
								>
									<span class="text-xs font-medium text-rose-400">Upload Failed</span>
								</div>
							{/if}
							<img src={item.url} alt="Upload preview" class="h-full w-full object-cover" />
							<button
								type="button"
								onclick={() => removeMedia(index)}
								disabled={isSubmitting}
								class="absolute top-2 right-2 z-20 rounded-full bg-black/60 p-1.5 text-white/80 transition-all hover:scale-110 hover:bg-rose-500 hover:text-white disabled:opacity-50"
							>
								<X class="h-3.5 w-3.5" />
							</button>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Bottom Action Bar -->
		<div class="flex items-center justify-between pt-2">
			<div
				class="flex flex-col text-[10px] leading-[1.1] font-semibold tracking-tight text-muted-foreground/50 {charsRemaining <
				0
					? 'text-destructive'
					: ''}"
			>
				<span>{charsRemaining}</span>
				<span>characters</span>
				<span>remaining</span>
			</div>

			<div class="flex items-center gap-1.5 sm:gap-2">
				<!-- Media Button -->
				<Button
					variant="ghost"
					size="icon"
					onclick={triggerFileInput}
					disabled={isSubmitting || !canAddMore}
					class="h-9 w-9 rounded-full text-muted-foreground transition-all hover:bg-violet-500/10 hover:text-violet-400"
					title="Add media"
				>
					<ImageIcon class="h-4.5 w-4.5" />
				</Button>

				<!-- Emoji Picker -->
				<EmojiPicker onSelect={handleEmojiSelect} disabled={isSubmitting} />

				<div class="relative">
					<Button
						variant="ghost"
						size="sm"
						onclick={() => (privacyDropdownOpen = !privacyDropdownOpen)}
						disabled={isSubmitting}
						class="flex h-9 items-center gap-1.5 rounded-lg px-2 text-muted-foreground transition-all hover:bg-white/5 hover:text-foreground active:bg-white/10"
					>
						{#if privacy === 'public'}
							<Globe class="h-3.5 w-3.5" />
						{:else if privacy === 'unlisted'}
							<Lock class="h-3.5 w-3.5" />
						{:else}
							<Users class="h-3.5 w-3.5" />
						{/if}
						<span class="text-[11px] font-bold"
							>{privacyOptions.find((o) => o.value === privacy)?.label}</span
						>
						<ChevronDown
							class="h-3 w-3 opacity-30 transition-transform {privacyDropdownOpen
								? 'rotate-180'
								: ''}"
						/>
					</Button>

					{#if privacyDropdownOpen}
						<button
							class="fixed inset-0 z-60 h-full w-full cursor-default"
							onclick={() => (privacyDropdownOpen = false)}
							type="button"
							aria-label="Close privacy menu"
						></button>

						<div
							class="absolute bottom-full left-0 z-70 mb-2 w-40 overflow-hidden rounded-xl border border-white/10 bg-slate-950 p-1 shadow-2xl ring-1 ring-white/10"
							in:scale={{ duration: 150, start: 0.95 }}
						>
							{#each privacyOptions as option}
								<button
									type="button"
									class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-all hover:bg-violet-500/10 hover:text-violet-400 {privacy ===
									option.value
										? 'bg-violet-500/20 font-medium text-violet-400'
										: 'text-muted-foreground'}"
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
				<div class="block">
					<LanguagePicker
						selected={selectedLanguage}
						onSelect={(code) => (selectedLanguage = code)}
						disabled={isSubmitting}
					/>
				</div>

				{#if mode === 'edit'}
					<Button
						variant="ghost"
						size="sm"
						onclick={onCancel}
						disabled={isSubmitting}
						class="h-9 rounded-full px-4 text-muted-foreground hover:text-foreground"
					>
						Cancel
					</Button>
				{/if}

				<Button
					onclick={handleSubmit}
					disabled={isSubmitting || (!content.trim() && media.length === 0) || charsRemaining < 0}
					class="h-9 min-w-[100px] rounded-lg bg-violet-600 px-6 font-bold text-white shadow-lg shadow-violet-500/10 transition-all hover:bg-violet-500 hover:shadow-violet-500/20 active:scale-95 disabled:opacity-50 disabled:shadow-none"
				>
					{#if isSubmitting}
						<Loader2 class="h-4 w-4 animate-spin" />
					{:else}
						{mode === 'create' ? 'Publish' : 'Update'}
					{/if}
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
