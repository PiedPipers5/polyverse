<script lang="ts">
	import { Card } from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Avatar, AvatarFallback, AvatarImage } from '$lib/components/ui/avatar';
	import { Tabs, TabsList, TabsTrigger, TabsContent } from '$lib/components/ui/tabs';
	import { Copy, Settings } from 'lucide-svelte';
	import { goto } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { auth } from '$lib/stores/auth';
	

	/* =========================================
     TODO (Backend): Replace static user data
     Fetch from:
     - Auth session
     - Neon DB via Drizzle
     - DID identity service
  ========================================= */

	let name = $state('Veeranji Uppara');
	let username = $state('veeranji');
	let domain = $state('example.com');
	let bio = $state('Full stack developer passionate about decentralized web and cybersecurity.');

	/* =========================================
     TODO (Backend):
     Replace with user.profileImage
     URL from Vercel Blob storage
  ========================================= */
	let avatarUrl = $state('');

	/* =========================================
     TODO (Backend):
     Replace with real stats
     Example sources:
     - followers table
     - following table
     - posts table
  ========================================= */
	let followersCount = $state(120);
	let followingCount = $state(85);
	let postsCount = $state(42);

	/* =========================================
     Derived Handle
     Backend should provide username + domain
  ========================================= */
	let handle = $derived(`@${username}@${domain}`);

	/* =========================================
     Share Profile Link
     (Frontend utility only)
  ========================================= */
	async function copyProfile() {
		await navigator.clipboard.writeText(window.location.href);
		toast.success('Profile link copied!');
	}


/* =========================================
	Task 1.4.2
     Authentication :  like needs login for viewing profile
  ========================================= */

	$effect(() => {
		if (!$auth.loading && !$auth.authenticated) {
			goto('/login');
		}
	});
</script>

<div class="flex min-h-screen justify-center bg-muted p-6">
	<Card class="w-full max-w-xl overflow-hidden shadow-lg">
		<!-- =========================================
         TODO (Backend):
         Replace static banner later
         Optional:
         - bannerImageUrl
         - Stored in Vercel Blob
    ========================================= -->
		<div class="h-32 bg-gradient-to-r from-indigo-500 to-purple-600"></div>

		<div class="-mt-12 flex flex-col items-center">
			<!-- =========================================
           Avatar Section
           Backend should provide avatar URL
      ========================================= -->

			<Avatar class="h-24 w-24 border-4 border-background">
				{#if avatarUrl}
					<AvatarImage src={avatarUrl} />
				{:else}
					<AvatarFallback>VU</AvatarFallback>
				{/if}
			</Avatar>

			<!-- =========================================
           User Identity
           Backend should populate fields
      ========================================= -->

			<h2 class="mt-3 text-2xl font-semibold">{name}</h2>
			<p class="text-muted-foreground">{handle}</p>

			<!-- =========================================
           Profile Action Buttons
      ========================================= -->

			<div class="mt-3 flex gap-2">
				<!-- TODO (Frontend + Backend):
             Settings route should verify auth session -->
				<Button onclick={() => goto('profile/settings/')}>
					<Settings class="mr-1 h-4 w-4" />
					Edit
				</Button>

				<!-- Share button purely frontend -->
				<Button variant="secondary" onclick={copyProfile}>
					<Copy class="mr-1 h-4 w-4" />
					Share
				</Button>
			</div>
		</div>

		<!-- =========================================
         TODO (Backend):
         Replace bio with user.bio from DB
    ========================================= -->
		<div class="px-6 pt-6 text-center">
			<p class="text-sm text-muted-foreground">{bio}</p>
		</div>

		<!-- =========================================
         Stats Section
         Backend should return aggregated counts
    ========================================= -->
		<div class="mt-6 grid grid-cols-3 border-t py-6 text-center">
			<div>
				<p class="text-xl font-semibold">{followersCount}</p>
				<p class="text-sm text-muted-foreground">Followers</p>
			</div>

			<div>
				<p class="text-xl font-semibold">{followingCount}</p>
				<p class="text-sm text-muted-foreground">Following</p>
			</div>

			<div>
				<p class="text-xl font-semibold">{postsCount}</p>
				<p class="text-sm text-muted-foreground">Posts</p>
			</div>
		</div>

		<!-- =========================================
         Tabs Section
         Backend will supply tab content later
    ========================================= -->

		<Tabs value="posts" class="px-4 pb-6">
			<TabsList class="grid grid-cols-3">
				<TabsTrigger value="posts">Posts</TabsTrigger>
				<TabsTrigger value="about">About</TabsTrigger>
				<TabsTrigger value="activity">Activity</TabsTrigger>
			</TabsList>

			<!-- =========================================
           TODO (Backend):
           Replace with posts feed API
           Example:
           GET /api/posts?userId=
      ========================================= -->
			<TabsContent value="posts">
				<div class="mt-4 space-y-3">
					<Card class="p-4">Placeholder post (Backend will replace)</Card>
				</div>
			</TabsContent>

			<!-- =========================================
           TODO (Backend):
           Could contain extended profile data
           Example:
           - skills
           - links
           - DID metadata
      ========================================= -->
			<TabsContent value="about">
				<div class="p-4 text-sm text-muted-foreground">
					Extended profile details will load here.
				</div>
			</TabsContent>

			<!-- =========================================
           TODO (Backend):
           Activity log integration
           Example:
           - user interactions
           - federated ActivityPub events
      ========================================= -->
			<TabsContent value="activity">
				<div class="p-4 text-sm text-muted-foreground">Activity timeline will appear here.</div>
			</TabsContent>
		</Tabs>
	</Card>
</div>
