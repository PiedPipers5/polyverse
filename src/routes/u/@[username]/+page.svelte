<script lang="ts">
	import { Card } from '$lib/components/ui/card';
	import { Avatar, AvatarFallback, AvatarImage } from '$lib/components/ui/avatar';
	import { Tabs, TabsList, TabsTrigger, TabsContent } from '$lib/components/ui/tabs';
	import Composer from '$lib/components/Composer.svelte';
	import Feed from '$lib/components/Feed.svelte';
	import type { PageData } from './$types';

	/* =========================================
	   Backend Integration Complete
	========================================= */

	// Svelte 5: Receive SSR data via props
	let { data }: { data: PageData } = $props();

	let profile = $derived(data.profile);

	// Local state for posts to allow optimistic updates
	let posts = $state(data.activities || []);

	// Sync posts when data changes (e.g. navigation)
	$effect(() => {
		posts = data.activities || [];
	});

	// Get initials for avatar fallback
	function getInitials(name: string): string {
		return name
			.split(' ')
			.map((n) => n[0])
			.join('')
			.toUpperCase()
			.slice(0, 2);
	}

	function handleNewPost(newActivity: any) {
		// Transform the new activity to match the structure expected by the UI
		const mappedPost = {
			...newActivity,
			content: newActivity.object?.content || '',
			publishedAt: newActivity.published || new Date().toISOString()
		};

		// Optimistically add to the top of the list
		posts = [mappedPost, ...posts];
	}
</script>

<svelte:head>
	<title>{profile.displayName} (@{profile.username}) - Polyverse</title>
	<meta
		name="description"
		content={profile.bio || `${profile.displayName}'s profile on Polyverse`}
	/>
</svelte:head>

<div class="flex min-h-screen justify-center bg-background p-6">
	<Card class="w-full max-w-xl overflow-hidden shadow-lg">
		<!-- Banner -->
		<div class="h-32 bg-linear-to-r from-indigo-500 to-purple-600"></div>

		<div class="-mt-12 flex flex-col items-center">
			<!-- Avatar -->
			<Avatar class="h-24 w-24 border-4 border-background">
				{#if profile.avatarUrl}
					<AvatarImage src={profile.avatarUrl} alt={profile.displayName} />
				{:else}
					<AvatarFallback>{getInitials(profile.displayName)}</AvatarFallback>
				{/if}
			</Avatar>

			<!-- User Identity -->
			<h1 class="mt-3 text-2xl font-semibold">{profile.displayName}</h1>
			<p class="text-muted-foreground">{profile.handle}</p>

			<!-- Member Since -->
			<p class="mt-2 text-sm text-muted-foreground">
				Member since {new Date(profile.createdAt).toLocaleDateString('en-US', {
					month: 'long',
					year: 'numeric'
				})}
			</p>
		</div>

		<!-- Bio Section -->
		{#if profile.bio}
			<div class="px-6 pt-6 text-center">
				<p class="text-sm text-muted-foreground">{profile.bio}</p>
			</div>
		{/if}

		<!-- Stats Section -->
		<div class="mt-6 grid grid-cols-3 border-t py-6 text-center">
			<div>
				<p class="text-xl font-semibold">{profile.followersCount}</p>
				<p class="text-sm text-muted-foreground">Followers</p>
			</div>

			<div>
				<p class="text-xl font-semibold">{profile.followingCount}</p>
				<p class="text-sm text-muted-foreground">Following</p>
			</div>

			<div>
				<p class="text-xl font-semibold">{profile.postsCount}</p>
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
					{#if data.isOwner}
						<Composer username={profile.username} onPostCreated={handleNewPost} />
					{/if}
					<Feed {posts} next={`/users/${profile.username}/outbox?page=2`} />
				</div>
			</TabsContent>

			<TabsContent value="about">
				<div class="p-4 text-sm text-muted-foreground">
					{#if profile.bio}
						<p class="mb-4">{profile.bio}</p>
					{/if}
					<p class="text-xs">
						This is a public profile on Polyverse, a decentralized social network.
					</p>
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
