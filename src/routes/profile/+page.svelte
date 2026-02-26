<script lang="ts">
	import { Card } from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Avatar, AvatarFallback, AvatarImage } from '$lib/components/ui/avatar';
	import { Tabs, TabsList, TabsTrigger, TabsContent } from '$lib/components/ui/tabs';
	import { Copy, Settings, LogOut } from 'lucide-svelte';
	import { goto, invalidateAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { enhance } from '$app/forms';
	import Composer from '$lib/components/Composer.svelte';
	import Post from '$lib/components/Post.svelte';
	import LogoutConfirmModal from '$lib/components/LogoutConfirmModal.svelte';

	import { untrack } from 'svelte';

	// Get data from server load function (Svelte 5 syntax)
	let { data } = $props();

	// User data from server
	// Use $derived.by to create reactive values that only update when we navigate/refresh
	let user = $derived(data.user);

	// Local state for posts to allow optimistic updates
	// Initialize from data but don't sync on every change (prevents resetting optimistic updates)
	let posts = $state(untrack(() => data.activities || []));
	let postsCount = $state(untrack(() => data.user.postsCount || 0));

	let showingLogoutConfirm = $state(false);

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

	// Share Profile Link
	async function copyProfile() {
		await navigator.clipboard.writeText(window.location.href);
		toast.success('Profile link copied!');
	}

	// Copy handle
	async function copyHandle() {
		await navigator.clipboard.writeText(user.handle);
		toast.success('Handle copied!');
	}

	function handleDeletePost(id: string) {
		console.log('[Profile] handleDeletePost called with id:', id);
		posts = posts.filter((p) => {
			const apActivity = (p as any).activity || p;
			const objectId = (apActivity as any).object?.id || (apActivity as any).id;
			return objectId !== id;
		});

		postsCount -= 1;
		// UI SYNC: Refresh all data from server (including postsCount)
		// This ensures the post counter on the profile reflects the latest DB state.
		invalidateAll();
	}

	function handleUpdatePost(updatedActivity: any) {
		posts = posts.map((p) => {
			const pActivity = (p as any).activity || p;
			const pId = (pActivity as any).object?.id || (pActivity as any).id;
			const uId = updatedActivity.object?.id || updatedActivity.id;
			return pId === uId ? updatedActivity : p;
		});
	}
</script>

<div class="flex min-h-screen justify-center bg-muted p-3 sm:p-6">
	<Card class="w-full max-w-xl overflow-hidden shadow-lg">
		<!-- Banner -->
		<div class="h-32 bg-linear-to-r from-indigo-500 to-purple-600"></div>

		<div class="-mt-12 flex flex-col items-center px-4">
			<!-- Avatar -->
			<Avatar class="h-24 w-24 border-4 border-background">
				{#if user.avatarUrl}
					<AvatarImage src={user.avatarUrl} alt={user.displayName || user.username} />
				{/if}
				<AvatarFallback>{getInitials(user.displayName, user.username)}</AvatarFallback>
			</Avatar>

			<!-- User Identity -->
			<h2 class="mt-3 text-center text-2xl font-semibold">{user.displayName || user.username}</h2>
			<p class="text-center text-muted-foreground">{user.handle}</p>

			<!-- Profile Action Buttons -->
			<div class="mt-4 flex flex-wrap justify-center gap-2">
				<Button onclick={() => goto('/profile/settings')} class="flex-1 sm:flex-none">
					<Settings class="mr-1 h-4 w-4" />
					Edit
				</Button>

				<Button variant="secondary" onclick={copyProfile} class="flex-1 sm:flex-none">
					<Copy class="mr-1 h-4 w-4" />
					Share
				</Button>

				<!-- Logout Button -->
				<Button
					variant="outline"
					onclick={() => (showingLogoutConfirm = true)}
					class="flex-1 sm:flex-none"
				>
					<LogOut class="mr-1 h-4 w-4" />
					Logout
				</Button>
			</div>
		</div>

		<!-- Bio -->
		<div class="px-6 pt-6 text-center">
			<p class="text-sm text-muted-foreground">
				{user.bio || 'No bio yet. Edit your profile to add one!'}
			</p>
		</div>

		<!-- Stats Section (placeholder for now - will be implemented in later epics) -->
		<div class="mt-6 grid grid-cols-3 border-t py-6 text-center select-none">
			<div>
				<p class="text-lg font-semibold sm:text-xl">{user.followersCount || 0}</p>
				<p class="text-xs text-muted-foreground sm:text-sm">Followers</p>
			</div>

			<div>
				<p class="text-lg font-semibold sm:text-xl">{user.followingCount || 0}</p>
				<p class="text-xs text-muted-foreground sm:text-sm">Following</p>
			</div>

			<div>
				<p class="text-lg font-semibold sm:text-xl">{postsCount}</p>
				<p class="text-xs text-muted-foreground sm:text-sm">Posts</p>
			</div>
		</div>

		<!-- Tabs Section -->
		<Tabs value="posts" class="px-4 pb-6">
			<TabsList class="grid grid-cols-3">
				<TabsTrigger value="posts">Posts</TabsTrigger>
				<TabsTrigger value="about">About</TabsTrigger>
				<TabsTrigger value="activity">Activity</TabsTrigger>
			</TabsList>

			<TabsContent value="posts">
				<div class="mt-4 space-y-3">
					<div class="mb-4 text-center">
						<Button onclick={() => goto('/create')} variant="outline" class="w-full">
							Create New Post
						</Button>
					</div>

					{#if posts && posts.length > 0}
						{#each posts as activity (activity.id || (activity as any).object?.id)}
							<Post
								{activity}
								isOwner={true}
								username={user.username}
								onDelete={handleDeletePost}
								onUpdate={handleUpdatePost}
							/>
						{/each}
					{:else}
						<Card class="p-4 text-center text-muted-foreground">
							No posts yet. Start sharing on the Fediverse!
						</Card>
					{/if}
				</div>
			</TabsContent>

			<TabsContent value="about">
				<div class="mt-4 space-y-4 p-4">
					<div>
						<p class="text-sm font-medium text-muted-foreground">Handle</p>
						<div class="flex items-center gap-2">
							<p class="font-mono">{user.handle}</p>
							<Button size="icon" variant="ghost" onclick={copyHandle}>
								<Copy class="h-4 w-4" />
							</Button>
						</div>
					</div>
					<div>
						<p class="text-sm font-medium text-muted-foreground">Decentralized Identity</p>
						<p class="font-mono text-sm break-all">{user.did}</p>
					</div>
					<div>
						<p class="text-sm font-medium text-muted-foreground">Member since</p>
						<p>{new Date(user.createdAt).toLocaleDateString('en-IN')}</p>
					</div>
				</div>
			</TabsContent>

			<TabsContent value="activity">
				<div class="p-4 text-center text-sm text-muted-foreground">
					Activity timeline coming soon.
				</div>
			</TabsContent>
		</Tabs>
	</Card>
</div>

<LogoutConfirmModal bind:open={showingLogoutConfirm} />
