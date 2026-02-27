<script lang="ts">
	import { Card, CardContent } from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Avatar, AvatarFallback, AvatarImage } from '$lib/components/ui/avatar';
	import { Tabs, TabsList, TabsTrigger, TabsContent } from '$lib/components/ui/tabs';
	import {
		Copy,
		Users,
		UserCheck,
		LayoutGrid,
		Info,
		Activity as ActivityIcon,
		UserPlus
	} from 'lucide-svelte';
	import { goto, invalidateAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import Post from '$lib/components/Post.svelte';
	import RightSidebar from '$lib/components/RightSidebar.svelte';
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
	function getInitials(name: string | null, username: string): string {
		if (name) {
			return name
				.split(' ')
				.map((n) => n[0])
				.join('')
				.toUpperCase()
				.slice(0, 2);
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
		await navigator.clipboard.writeText(profile.handle);
		toast.success('Handle copied!');
	}

	function handleDeletePost(id: string) {
		posts = posts.filter((p) => {
			const pId = p.object?.id || p.id;
			return pId !== id;
		});
		invalidateAll();
	}

	function handleUpdatePost(updatedPost: any) {
		posts = posts.map((p) => {
			const pId = p.object?.id || p.id;
			const uId = updatedPost.object?.id || updatedPost.id;
			return pId === uId ? updatedPost : p;
		});
	}
</script>

<svelte:head>
	<title>{profile.displayName} (@{profile.username}) - Polyverse</title>
	<meta
		name="description"
		content={profile.bio || `${profile.displayName}'s profile on Polyverse`}
	/>
</svelte:head>

<div class="relative min-h-screen overflow-hidden bg-background">
	<!-- Subtle Background Pattern -->
	<div
		class="pointer-events-none absolute inset-0 opacity-[0.05]"
		style="background-image: radial-gradient(circle at 1px 1px, rgb(139 92 246) 1px, transparent 0); background-size: 32px 32px;"
	></div>

	<!-- Hero Banner Section -->
	<div class="relative h-16 w-full overflow-hidden md:h-24">
		<div
			class="animate-gradient absolute inset-0 bg-linear-to-br from-violet-500/40 via-purple-500/40 to-fuchsia-500/40 dark:from-violet-900/50 dark:via-purple-900/50 dark:to-fuchsia-900/50"
		></div>
		<div class="absolute inset-0 bg-linear-to-b from-transparent to-background/95"></div>
	</div>

	<div class="relative z-10 container mx-auto -mt-8 px-4 pb-12 sm:px-6 md:-mt-12 lg:px-8">
		<div class="grid grid-cols-1 gap-6 lg:grid-cols-12">
			<!-- Left Sidebar: User Profile Card -->
			<div class="lg:col-span-3">
				<div class="sticky top-20 space-y-6">
					<Card
						class="glass-card group animate-fade-in-up overflow-hidden border border-white/10 shadow-2xl ring-1 ring-violet-500/10"
					>
						<CardContent class="p-0">
							<div class="flex flex-col items-center px-6 pt-6 pb-6 text-center">
								<!-- Avatar -->
								<div class="relative mb-6">
									<div
										class="absolute -inset-1.5 animate-pulse rounded-full bg-linear-to-r from-violet-500 to-fuchsia-500 opacity-60 blur-md"
									></div>
									<Avatar
										class="relative h-32 w-32 border-4 border-background shadow-2xl transition-transform duration-300 group-hover:scale-[1.02]"
									>
										{#if profile.avatarUrl}
											<AvatarImage src={profile.avatarUrl} alt={profile.displayName} />
										{/if}
										<AvatarFallback class="bg-muted text-3xl font-bold"
											>{getInitials(profile.displayName, profile.username)}</AvatarFallback
										>
									</Avatar>
								</div>

								<!-- Identity -->
								<h1 class="gradient-text mb-1 text-3xl font-extrabold tracking-tight">
									{profile.displayName}
								</h1>
								<p class="text-sm font-bold tracking-widest text-foreground/40 uppercase">
									{profile.handle}
								</p>

								<!-- Bio Section -->
								{#if profile.bio}
									<p class="mt-4 px-2 text-sm leading-relaxed text-foreground/70 italic">
										"{profile.bio}"
									</p>
								{/if}

								<!-- Action Buttons -->
								<div class="mt-6 flex w-full flex-col gap-3">
									{#if data.isOwner}
										<Button
											variant="default"
											class="w-full bg-linear-to-r from-violet-500 to-fuchsia-500 text-white shadow-lg transition-all hover:scale-[1.02]"
											href="/profile/settings"
										>
											Edit Profile
										</Button>
									{:else}
										<Button
											class="w-full bg-linear-to-r from-violet-500 to-fuchsia-500 text-white shadow-lg transition-all hover:scale-[1.02]"
										>
											<UserPlus class="mr-2 h-4 w-4" />
											Follow
										</Button>
									{/if}

									<Button
										variant="outline"
										onclick={copyProfile}
										class="glass-card w-full border-white/10 hover:bg-white/5"
									>
										<Copy class="mr-2 h-4 w-4" />
										Share Profile
									</Button>
								</div>
							</div>

							<!-- Stats Grid -->
							<div
								class="grid grid-cols-3 border-t border-white/10 bg-white/5 py-5 backdrop-blur-md"
							>
								<div class="flex flex-col items-center px-2">
									<span class="text-2xl font-black">{profile.followersCount}</span>
									<span class="text-[9px] font-black tracking-widest text-foreground/30 uppercase"
										>Followers</span
									>
								</div>
								<div class="flex flex-col items-center border-x border-white/10 px-2">
									<span class="text-2xl font-black">{profile.followingCount}</span>
									<span class="text-[9px] font-black tracking-widest text-foreground/30 uppercase"
										>Following</span
									>
								</div>
								<div class="flex flex-col items-center px-2">
									<span class="text-2xl font-black">{profile.postsCount}</span>
									<span class="text-[9px] font-black tracking-widest text-foreground/30 uppercase"
										>Posts</span
									>
								</div>
							</div>
						</CardContent>
					</Card>

					<!-- Additional Info Card -->
					<Card
						class="glass-card animate-fade-in-up hidden border border-white/10 p-6 ring-1 ring-violet-500/10 lg:block"
						style="animation-delay: 0.1s;"
					>
						<h3 class="mb-4 flex items-center font-semibold">
							<Info class="mr-2 h-4 w-4 text-violet-500" />
							Account Details
						</h3>
						<div class="space-y-4 text-xs text-foreground/60">
							<div>
								<p class="mb-1 font-medium text-foreground/80">Member Since</p>
								<p>
									{new Date(profile.createdAt).toLocaleDateString('en-IN', {
										month: 'long',
										year: 'numeric'
									})}
								</p>
							</div>
							<div class="pt-2">
								<p class="mb-2 text-[10px] font-bold tracking-widest text-foreground/40 uppercase">
									Privacy Status
								</p>
								<div class="flex items-center gap-2 text-emerald-500">
									<UserCheck class="h-3 w-3" />
									<span class="font-medium">Federated & Secure</span>
								</div>
							</div>
						</div>
					</Card>
				</div>
			</div>

			<!-- Right Content: Tabs and Posts -->
			<div class="lg:col-span-6">
				<div class="animate-fade-in-up" style="animation-delay: 0.2s;">
					<Tabs value="posts" class="w-full">
						<TabsList
							class="glass-card mb-6 grid h-14 w-full grid-cols-3 border border-white/10 p-1.5 shadow-xl ring-1 ring-violet-500/10"
						>
							<TabsTrigger
								value="posts"
								class="data-[state=active]:bg-linear-to-r data-[state=active]:from-violet-500 data-[state=active]:to-fuchsia-500 data-[state=active]:text-white"
							>
								<LayoutGrid class="mr-2 h-4 w-4" />
								Posts
							</TabsTrigger>
							<TabsTrigger
								value="activity"
								class="data-[state=active]:bg-linear-to-r data-[state=active]:from-violet-500 data-[state=active]:to-fuchsia-500 data-[state=active]:text-white"
							>
								<ActivityIcon class="mr-2 h-4 w-4" />
								Activity
							</TabsTrigger>
							<TabsTrigger
								value="about"
								class="data-[state=active]:bg-linear-to-r data-[state=active]:from-violet-500 data-[state=active]:to-fuchsia-500 data-[state=active]:text-white"
							>
								<Info class="mr-2 h-4 w-4" />
								About
							</TabsTrigger>
						</TabsList>

						<TabsContent value="posts" class="mt-0 space-y-4">
							{#if data.isOwner}
								<div class="flex items-center justify-between">
									<h2 class="text-xl font-bold">Your Feed</h2>
									<Button
										onclick={() => goto('/create')}
										class="bg-linear-to-r from-violet-500 to-fuchsia-500 text-white shadow-lg transition-all hover:scale-[1.05] hover:shadow-violet-500/25"
									>
										Create New Post
									</Button>
								</div>
							{/if}

							{#if posts && posts.length > 0}
								{#each posts as activity (activity.id || activity.object?.id)}
									<Post
										{activity}
										isOwner={data.isOwner}
										username={profile.username}
										onDelete={handleDeletePost}
										onUpdate={handleUpdatePost}
									/>
								{/each}
							{:else}
								<Card
									class="glass-card flex flex-col items-center border border-white/10 py-16 text-center ring-1 ring-violet-500/10"
								>
									<div
										class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-violet-500/10"
									>
										<LayoutGrid class="h-8 w-8 text-violet-500" />
									</div>
									<h3 class="mb-2 text-lg font-semibold">No posts yet</h3>
									<p class="mx-auto max-w-xs text-sm text-foreground/50">
										Check back later to see what {profile.displayName} shares with the federation.
									</p>
								</Card>
							{/if}
						</TabsContent>

						<TabsContent value="activity">
							<Card
								class="glass-card flex flex-col items-center border border-white/10 py-16 text-center ring-1 ring-violet-500/10"
							>
								<div
									class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-fuchsia-500/10"
								>
									<ActivityIcon class="h-8 w-8 text-fuchsia-500" />
								</div>
								<h3 class="mb-2 text-lg font-semibold">Activity Timeline</h3>
								<p class="mx-auto max-w-xs text-sm text-foreground/50">
									Interaction history will appear here soon.
								</p>
							</Card>
						</TabsContent>

						<TabsContent value="about">
							<Card class="glass-card border border-white/10 p-8 ring-1 ring-violet-500/10">
								<div class="space-y-8">
									<div>
										<h3 class="mb-4 text-xl font-bold">Biography</h3>
										<p class="text-sm leading-relaxed text-foreground/70">
											{profile.bio || 'No biography provided.'}
										</p>
									</div>

									<div class="grid grid-cols-1 gap-8 md:grid-cols-2">
										<div class="space-y-6">
											<div>
												<label
													class="mb-2 block text-xs font-semibold tracking-wider text-foreground/50 uppercase"
													>Account Handle</label
												>
												<div class="flex items-center justify-between rounded-lg bg-white/5 p-3">
													<code class="text-xs break-all opacity-80">{profile.handle}</code>
													<Button size="icon" variant="ghost" onclick={copyHandle} class="h-8 w-8">
														<Copy class="h-4 w-4" />
													</Button>
												</div>
											</div>
										</div>
										<div class="space-y-6">
											<div>
												<label
													class="mb-2 block text-xs font-semibold tracking-wider text-foreground/50 uppercase"
													>Member Since</label
												>
												<p class="p-3 text-sm font-medium">
													{new Date(profile.createdAt).toLocaleDateString('en-IN', {
														day: 'numeric',
														month: 'long',
														year: 'numeric'
													})}
												</p>
											</div>
										</div>
									</div>
								</div>
							</Card>
						</TabsContent>
					</Tabs>
				</div>
			</div>

			<!-- Right Sidebar -->
			<div class="hidden lg:col-span-3 lg:block">
				<div class="animate-fade-in-up" style="animation-delay: 0.3s;">
					<RightSidebar />
				</div>
			</div>
		</div>
	</div>
</div>
