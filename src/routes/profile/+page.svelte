<script lang="ts">
	import { Card } from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Avatar, AvatarFallback, AvatarImage } from '$lib/components/ui/avatar';
	import { Tabs, TabsList, TabsTrigger, TabsContent } from '$lib/components/ui/tabs';
	import { Copy, Settings, LogOut } from 'lucide-svelte';
	import { goto } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { enhance } from '$app/forms';

	// Get data from server load function (Svelte 5 syntax)
	let { data } = $props();

	// User data from server
	const user = data.user;

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
</script>

<div class="flex min-h-screen justify-center bg-muted p-6">
	<Card class="w-full max-w-xl overflow-hidden shadow-lg">
		<!-- Banner -->
		<div class="h-32 bg-gradient-to-r from-indigo-500 to-purple-600"></div>

		<div class="-mt-12 flex flex-col items-center">
			<!-- Avatar -->
			<Avatar class="h-24 w-24 border-4 border-background">
				{#if user.avatarUrl}
					<AvatarImage src={user.avatarUrl} alt={user.displayName || user.username} />
				{/if}
				<AvatarFallback>{getInitials(user.displayName, user.username)}</AvatarFallback>
			</Avatar>

			<!-- User Identity -->
			<h2 class="mt-3 text-2xl font-semibold">{user.displayName || user.username}</h2>
			<p class="text-muted-foreground">{user.handle}</p>

			<!-- Profile Action Buttons -->
			<div class="mt-3 flex gap-2">
				<Button onclick={() => goto('/profile/settings')}>
					<Settings class="mr-1 h-4 w-4" />
					Edit
				</Button>

				<Button variant="secondary" onclick={copyProfile}>
					<Copy class="mr-1 h-4 w-4" />
					Share
				</Button>

				<!-- Logout Button -->
				<form method="POST" action="/logout" use:enhance>
					<Button type="submit" variant="outline">
						<LogOut class="mr-1 h-4 w-4" />
						Logout
					</Button>
				</form>
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
				<p class="text-xl font-semibold">0</p>
				<p class="text-sm text-muted-foreground">Followers</p>
			</div>

			<div>
				<p class="text-xl font-semibold">0</p>
				<p class="text-sm text-muted-foreground">Following</p>
			</div>

			<div>
				<p class="text-xl font-semibold">0</p>
				<p class="text-sm text-muted-foreground">Posts</p>
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
					<Card class="p-4 text-center text-muted-foreground">
						No posts yet. Start sharing on the Fediverse!
					</Card>
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
