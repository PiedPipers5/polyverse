<script lang="ts">
	import { Card, CardHeader, CardTitle, CardContent } from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Avatar, AvatarFallback, AvatarImage } from '$lib/components/ui/avatar';
	import { toast } from 'svelte-sonner';
	import { Copy, LogOut, ArrowLeft } from 'lucide-svelte';
	import { goto } from '$app/navigation';
	import { enhance } from '$app/forms';

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

	// Avatar upload state
	let uploading = $state(false);
	let fileInput: HTMLInputElement;

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
		toast.success('Copied!');
	}

	/* Handle avatar upload */
	async function handleAvatarUpload(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];

		if (!file) return;

		// Validate file type
		if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)) {
			toast.error('Please select a valid image file (JPEG, PNG, GIF, or WebP)');
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
			toast.success('Avatar uploaded successfully!');
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Failed to upload avatar');
		} finally {
			uploading = false;
			input.value = '';
		}
	}

	/* Save profile changes */
	let saving = $state(false);

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

			toast.success('Profile saved!');
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Failed to save profile');
		} finally {
			saving = false;
		}
	}
</script>

<div class="flex min-h-screen justify-center bg-muted p-6">
	<Card class="w-full max-w-2xl shadow-lg">
		<CardHeader class="flex flex-row items-center justify-between">
			<div class="flex items-center gap-2">
				<Button variant="ghost" size="icon" onclick={() => goto('/profile')}>
					<ArrowLeft class="h-4 w-4" />
				</Button>
				<CardTitle>Profile Settings</CardTitle>
			</div>

			<!-- Logout Button -->
			<form method="POST" action="/logout" use:enhance>
				<Button type="submit" variant="outline" size="sm">
					<LogOut class="mr-1 h-4 w-4" />
					Logout
				</Button>
			</form>
		</CardHeader>

		<CardContent class="space-y-8">
			<!-- Avatar Section -->
			<div class="space-y-2">
				<p class="font-medium">Profile Picture</p>
				<div class="flex items-center gap-4">
					<Avatar class="h-16 w-16">
						{#if avatarUrl}
							<AvatarImage src={avatarUrl} alt={displayName || username} />
						{/if}
						<AvatarFallback>{getInitials(displayName, username)}</AvatarFallback>
					</Avatar>
					<!-- Hidden file input -->
					<input
						type="file"
						accept="image/*"
						bind:this={fileInput}
						onchange={handleAvatarUpload}
						class="hidden"
					/>
					<Button variant="secondary" onclick={() => fileInput?.click()} disabled={uploading}>
						{uploading ? 'Uploading...' : 'Upload Avatar'}
					</Button>
				</div>
			</div>

			<!-- Display Name Section -->
			<div class="space-y-2">
				<label for="display-name" class="font-medium">Display Name</label>
				<Input id="display-name" bind:value={displayName} placeholder="Your display name" />
			</div>

			<!-- Username Section (readonly) -->
			<div class="space-y-2">
				<label for="username" class="font-medium">Username</label>
				<Input id="username" value={username} readonly class="bg-muted" />
				<p class="text-sm text-muted-foreground">Username cannot be changed.</p>
			</div>

			<!-- Bio Section -->
			<div class="space-y-2">
				<label for="bio" class="font-medium">Bio</label>
				<Textarea
					id="bio"
					rows={3}
					bind:value={bio}
					placeholder="Tell the fediverse about yourself..."
				/>
			</div>

			<!-- Handle Display -->
			<div class="space-y-2">
				<p class="font-medium">Your Handle</p>
				<div class="flex gap-2">
					<Input readonly value={handle} class="bg-muted" />
					<Button size="icon" onclick={() => copy(handle)}>
						<Copy class="h-4 w-4" />
					</Button>
				</div>
				<p class="text-sm text-muted-foreground">
					Share this with friends on other Fediverse platforms.
				</p>
			</div>

			<!-- DID Identity Section -->
			<div class="space-y-2">
				<p class="font-medium">Decentralized Identity (DID)</p>
				<div class="flex gap-2">
					<Input readonly value={did} class="bg-muted font-mono text-sm" />
					<Button size="icon" onclick={() => copy(did)}>
						<Copy class="h-4 w-4" />
					</Button>
				</div>
			</div>

			<!-- Save Button -->
			<div class="flex justify-end border-t pt-4">
				<Button onclick={saveProfile} disabled={saving}>
					{saving ? 'Saving...' : 'Save Changes'}
				</Button>
			</div>
		</CardContent>
	</Card>
</div>
