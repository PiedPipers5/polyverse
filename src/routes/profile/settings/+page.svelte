<script lang="ts">
	import { Card, CardHeader, CardTitle, CardContent } from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Avatar, AvatarFallback, AvatarImage } from '$lib/components/ui/avatar';
	import { toast } from 'svelte-sonner';
	import {
		Copy,
		LogOut,
		ArrowLeft,
		User,
		ShieldCheck,
		Globe,
		Camera,
		Trash2,
		CheckCircle2,
		Loader2,
		Fingerprint
	} from 'lucide-svelte';
	import { goto } from '$app/navigation';
	import { enhance } from '$app/forms';
	import LogoutConfirmModal from '$lib/components/LogoutConfirmModal.svelte';
	import ConfirmRemoveAvatarModal from '$lib/components/ConfirmRemoveAvatarModal.svelte';
	import { fly, fade } from 'svelte/transition';

	// Get data from server load function (Svelte 5 syntax)
	let { data } = $props();

	// Editable fields from server data
	let displayName = $state(data.user.displayName || '');
	let bio = $state(data.user.bio || '');
	let avatarUrl = $state(data.user.avatarUrl);

	// Derived from server data (readonly)
	const username = data.user.username;
	const domain = data.user.domain;
	const did = data.user.did;
	const handle = data.user.handle;

	// UI State
	let activeTab = $state<'profile' | 'account' | 'privacy'>('profile');
	let uploading = $state(false);
	let saving = $state(false);
	let fileInput: HTMLInputElement;
	let showingLogoutConfirm = $state(false);
	let showingRemoveAvatarConfirm = $state(false);

	// Get initials for avatar fallback
	function getInitials(name: string | null, username: string): string {
		if (name) {
			return name
				.split(' ')
				.map((n) => n[0])
				.join('')
				.slice(0, 2)
				.toUpperCase();
		}
		return username.slice(0, 2).toUpperCase();
	}

	/* Copy to clipboard helper */
	async function copy(text: string) {
		await navigator.clipboard.writeText(text);
		toast.success('Copied to clipboard!');
	}

	/* Handle avatar upload */
	async function handleAvatarUpload(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];

		if (!file) return;

		// Validate file type
		if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)) {
			toast.error('Please select a valid image file');
			input.value = '';
			return;
		}

		// Validate file size (5MB max)
		if (file.size > 5 * 1024 * 1024) {
			toast.error('Image too large. Maximum size is 5MB.');
			input.value = '';
			return;
		}

		uploading = true;
		try {
			const formData = new FormData();
			formData.append('avatar', file);

			const response = await fetch('/api/upload/avatar', {
				method: 'POST',
				body: formData
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.message || 'Failed to upload');
			}

			const data = await response.json();
			avatarUrl = data.url;
			toast.success('Avatar updated!');
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Failed to upload avatar');
		} finally {
			uploading = false;
			input.value = '';
		}
	}

	/* Remove avatar */
	async function removeAvatar() {
		uploading = true;
		try {
			const response = await fetch('/api/users/me', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ avatarUrl: null })
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.message || 'Failed to remove avatar');
			}

			avatarUrl = null;
			toast.success('Avatar removed');
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Failed to remove avatar');
		} finally {
			uploading = false;
		}
	}

	/* Save profile changes */
	async function saveProfile() {
		saving = true;
		try {
			const response = await fetch('/api/users/me', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					displayName: displayName || null,
					bio: bio || null
				})
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.message || 'Failed to save');
			}

			toast.success('Profile saved successfully');
			// Subtle delay for better feedback
			setTimeout(() => goto('/profile'), 1000);
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Failed to save profile');
		} finally {
			saving = false;
		}
	}
</script>

<div class="flex min-h-screen flex-col bg-background/95">
	<!-- Header Navigation -->
	<header
		class="sticky top-0 z-30 flex h-16 items-center border-b border-white/10 bg-background/50 px-6 backdrop-blur-md"
	>
		<div class="mx-auto flex w-full max-w-5xl items-center justify-between">
			<div class="flex items-center gap-4">
				<Button
					variant="ghost"
					size="icon"
					onclick={() => goto('/profile')}
					class="rounded-full hover:bg-white/10"
				>
					<ArrowLeft class="h-5 w-5" />
				</Button>
				<h1 class="text-xl font-bold tracking-tight">Settings</h1>
			</div>

			<div class="flex items-center gap-3">
				<Button
					variant="ghost"
					size="sm"
					onclick={() => (showingLogoutConfirm = true)}
					class="text-destructive hover:bg-destructive/10 hover:text-destructive"
				>
					<LogOut class="mr-2 h-4 w-4" />
					LogOut
				</Button>
				<Button
					onclick={saveProfile}
					disabled={saving}
					class="bg-linear-to-r from-violet-600 to-indigo-600 shadow-lg shadow-violet-500/20 hover:from-violet-500 hover:to-indigo-500"
				>
					{#if saving}
						<Loader2 class="mr-2 h-4 w-4 animate-spin" />
						Saving...
					{:else}
						<CheckCircle2 class="mr-2 h-4 w-4" />
						Save Changes
					{/if}
				</Button>
			</div>
		</div>
	</header>

	<main class="mx-auto grid w-full max-w-5xl flex-1 gap-8 p-6 md:grid-cols-[240px_1fr]">
		<!-- Sidebar Navigation -->
		<aside class="flex flex-col gap-2">
			<button
				onclick={() => (activeTab = 'profile')}
				class="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all {activeTab ===
				'profile'
					? 'bg-violet-500/10 text-violet-400 ring-1 ring-violet-500/20'
					: 'text-muted-foreground hover:bg-white/5 hover:text-foreground'}"
			>
				<User class="h-4.5 w-4.5" />
				Public Profile
			</button>
			<button
				onclick={() => (activeTab = 'account')}
				class="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all {activeTab ===
				'account'
					? 'bg-violet-500/10 text-violet-400 ring-1 ring-violet-500/20'
					: 'text-muted-foreground hover:bg-white/5 hover:text-foreground'}"
			>
				<Globe class="h-4.5 w-4.5" />
				Account Identity
			</button>
			<button
				onclick={() => (activeTab = 'privacy')}
				class="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all {activeTab ===
				'privacy'
					? 'bg-violet-500/10 text-violet-400 ring-1 ring-violet-500/20'
					: 'text-muted-foreground hover:bg-white/5 hover:text-foreground'}"
			>
				<ShieldCheck class="h-4.5 w-4.5" />
				Privacy & Security
			</button>
		</aside>

		<!-- Content Area -->
		<div class="space-y-6">
			{#if activeTab === 'profile'}
				<div in:fly={{ y: 20, duration: 400 }} class="space-y-6">
					<Card class="glass-card overflow-hidden border-white/10 shadow-xl">
						<CardHeader>
							<CardTitle class="text-lg font-bold">Public Profile</CardTitle>
							<p class="text-sm text-muted-foreground">
								Manage how you appear to others on the federation.
							</p>
						</CardHeader>
						<CardContent class="space-y-8">
							<!-- Avatar Redesign -->
							<div class="flex flex-col gap-6 sm:flex-row sm:items-center">
								<div class="group relative">
									<Avatar
										class="h-24 w-24 shadow-2xl ring-4 ring-background transition-transform group-hover:scale-105"
									>
										{#if avatarUrl}
											<AvatarImage src={avatarUrl} alt={displayName || username} />
										{/if}
										<AvatarFallback
											class="bg-linear-to-br from-violet-500 to-indigo-500 text-2xl font-bold text-white"
										>
											{getInitials(displayName, username)}
										</AvatarFallback>
									</Avatar>
									<button
										onclick={() => fileInput?.click()}
										class="absolute right-0 bottom-0 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-110 active:scale-95"
										title="Change Avatar"
									>
										{#if uploading}
											<Loader2 class="h-4 w-4 animate-spin" />
										{:else}
											<Camera class="h-4 w-4" />
										{/if}
									</button>
									<input
										type="file"
										accept="image/*"
										bind:this={fileInput}
										onchange={handleAvatarUpload}
										class="hidden"
									/>
								</div>
								<div class="flex-1 space-y-1">
									<h3 class="px-1 font-semibold">Avatar</h3>
									<p class="px-1 text-xs text-muted-foreground">
										JPG, GIF or PNG. Max size of 5MB.
									</p>
									<div class="flex gap-2 pt-2">
										<Button
											variant="outline"
											size="sm"
											onclick={() => fileInput?.click()}
											disabled={uploading}
											class="cursor-pointer"
										>
											Upload New
										</Button>

										{#if avatarUrl}
											<Button
												variant="ghost"
												size="sm"
												onclick={() => (showingRemoveAvatarConfirm = true)}
												disabled={uploading}
												class="cursor-pointer text-destructive hover:bg-destructive/10 hover:text-destructive"
											>
												<Trash2 class="mr-1.5 h-3.5 w-3.5" />
												Remove
											</Button>
										{/if}
									</div>
								</div>
							</div>

							<!-- Names Section -->
							<div class="grid gap-6 sm:grid-cols-2">
								<div class="space-y-2">
									<label for="display-name" class="text-sm font-semibold text-foreground/80"
										>Display Name</label
									>
									<Input
										id="display-name"
										bind:value={displayName}
										placeholder="e.g. Alice Smith"
										class="border-white/10 bg-white/5 focus-visible:ring-violet-500"
									/>
								</div>
								<div class="space-y-2">
									<label for="username-display" class="text-sm font-semibold text-foreground/80"
										>Username</label
									>
									<div class="relative">
										<Input
											id="username-display"
											value={username}
											readonly
											class="cursor-not-allowed bg-muted opacity-70"
										/>
										<div class="absolute top-2.5 right-3">
											<span
												class="text-[10px] font-bold tracking-widest text-muted-foreground uppercase"
												>Locked</span
											>
										</div>
									</div>
								</div>
							</div>

							<!-- Bio Section -->
							<div class="space-y-2">
								<label for="bio" class="text-sm font-semibold text-foreground/80">About Me</label>
								<Textarea
									id="bio"
									rows={4}
									bind:value={bio}
									placeholder="Share a little about yourself with the fediverse..."
									class="resize-none border-white/10 bg-white/5 focus-visible:ring-violet-500"
								/>
								<p class="text-right text-[10px] text-muted-foreground">{bio.length}/500</p>
							</div>
						</CardContent>
					</Card>
				</div>
			{/if}

			{#if activeTab === 'account'}
				<div in:fly={{ y: 20, duration: 400 }} class="space-y-6">
					<Card class="glass-card border-white/10 shadow-xl">
						<CardHeader>
							<CardTitle class="text-lg font-bold">Federated Identity</CardTitle>
							<p class="text-sm text-muted-foreground">
								This information is used to connect with others across the fediverse.
							</p>
						</CardHeader>
						<CardContent class="space-y-6">
							<!-- Handle Display -->
							<div class="space-y-2">
								<div class="flex items-center justify-between">
									<label class="text-sm font-semibold text-foreground/80"
										>Your Fediverse Handle</label
									>
									<Button
										variant="ghost"
										size="sm"
										onclick={() => copy(handle)}
										class="h-7 px-2 text-[10px] tracking-widest uppercase hover:bg-white/10"
									>
										<Copy class="mr-1.5 h-3 w-3" /> Copy
									</Button>
								</div>
								<div
									class="flex items-center gap-3 rounded-xl bg-violet-500/5 p-4 ring-1 ring-violet-500/10"
								>
									<div
										class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-500/20"
									>
										<Globe class="h-5 w-5 text-violet-400" />
									</div>
									<code class="font-mono text-sm text-violet-300">{handle}</code>
								</div>
								<p class="text-xs text-muted-foreground">
									Anyone on Mastodon, Pleroma, or Pixelfed can follow you using this handle.
								</p>
							</div>

							<!-- DID Identity Section -->
							<div class="space-y-2">
								<div class="flex items-center justify-between">
									<label class="text-sm font-semibold text-foreground/80"
										>Decentralized Identifier (DID)</label
									>
									<Button
										variant="ghost"
										size="sm"
										onclick={() => copy(did)}
										class="h-7 px-2 text-[10px] tracking-widest uppercase hover:bg-white/10"
									>
										<Copy class="mr-1.5 h-3 w-3" /> Copy
									</Button>
								</div>
								<div
									class="flex items-center gap-3 rounded-xl bg-indigo-500/5 p-4 ring-1 ring-indigo-500/10"
								>
									<div
										class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-500/20"
									>
										<Fingerprint class="h-5 w-5 text-indigo-400" />
									</div>
									<code class="font-mono text-[10px] leading-relaxed break-all text-indigo-300"
										>{did}</code
									>
								</div>
								<p class="text-xs text-muted-foreground">
									Your permanent, verifiable identity within the network.
								</p>
							</div>
						</CardContent>
					</Card>
				</div>
			{/if}

			{#if activeTab === 'privacy'}
				<div in:fly={{ y: 20, duration: 400 }} class="space-y-6">
					<Card class="glass-card border-white/10 shadow-xl">
						<CardHeader>
							<CardTitle class="text-lg font-bold">Privacy & Security</CardTitle>
							<p class="text-sm text-muted-foreground">
								Manage your account security and authentication credentials.
							</p>
						</CardHeader>
						<CardContent class="space-y-8">
							<div class="space-y-4">
								<div class="flex items-center gap-3">
									<div
										class="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10"
									>
										<ShieldCheck class="h-5 w-5 text-violet-500" />
									</div>
									<div>
										<h3 class="font-semibold">Security Protocol</h3>
										<p class="text-xs text-muted-foreground">
											Update your access key to stay secure.
										</p>
									</div>
								</div>

								<form
									method="POST"
									action="?/changePassword"
									use:enhance={() => {
										saving = true;
										return async ({ result, update }) => {
											await update();
											saving = false;
											if (result.type === 'success' && result.data?.passwordSuccess) {
												toast.success('Access key updated successfully');
											} else if (result.type === 'failure' && result.data?.passwordError) {
												toast.error(result.data.passwordError);
											}
										};
									}}
									class="mt-6 space-y-6 rounded-2xl border border-white/5 bg-white/5 p-6"
								>
									<div class="grid gap-6 sm:grid-cols-1">
										<div class="space-y-2">
											<label for="currentPassword" class="text-sm font-semibold text-foreground/80"
												>Current Keyphrase</label
											>
											<Input
												id="currentPassword"
												name="currentPassword"
												type="password"
												placeholder="••••••••"
												required
												class="border-white/10 bg-white/5 focus-visible:ring-violet-500"
											/>
										</div>

										<div class="grid gap-6 sm:grid-cols-2">
											<div class="space-y-2">
												<label for="newPassword" class="text-sm font-semibold text-foreground/80"
													>New Keyphrase</label
												>
												<Input
													id="newPassword"
													name="newPassword"
													type="password"
													placeholder="••••••••"
													required
													class="border-white/10 bg-white/5 focus-visible:ring-violet-500"
												/>
											</div>

											<div class="space-y-2">
												<label
													for="confirmPassword"
													class="text-sm font-semibold text-foreground/80"
													>Confirm New Keyphrase</label
												>
												<Input
													id="confirmPassword"
													name="confirmPassword"
													type="password"
													placeholder="••••••••"
													required
													class="border-white/10 bg-white/5 focus-visible:ring-violet-500"
												/>
											</div>
										</div>
									</div>

									<div class="flex justify-start">
										<Button
											type="submit"
											disabled={saving}
											class="bg-violet-600 hover:bg-violet-500"
										>
											{#if saving}
												<Loader2 class="mr-2 h-4 w-4 animate-spin" />
												Updating...
											{:else}
												Update Access Key
											{/if}
										</Button>
									</div>
								</form>
							</div>

							<div class="rounded-2xl border border-amber-500/10 bg-amber-500/5 p-6">
								<h4 class="mb-2 text-sm font-bold tracking-widest text-amber-500 uppercase">
									Notice
								</h4>
								<p class="text-xs leading-relaxed text-amber-500/80">
									Changing your access key will encrypt your DID identity with the new protocol.
									Ensure you remember your new keyphrase as it cannot be recovered without a
									recovery email.
								</p>
							</div>
						</CardContent>
					</Card>
				</div>
			{/if}
		</div>
	</main>
</div>

<LogoutConfirmModal bind:open={showingLogoutConfirm} />
<ConfirmRemoveAvatarModal bind:open={showingRemoveAvatarConfirm} onConfirm={removeAvatar} />

<style>
	/* Custom animations and overrides if needed */
	:global(.glass-card) {
		background: color-mix(in oklch, var(--card) 60%, transparent) !important;
		backdrop-filter: blur(20px) !important;
	}

	.cursor-pointer {
		cursor: pointer;
	}
</style>
