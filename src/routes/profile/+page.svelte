<script lang="ts">
	import { Card, CardContent } from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Avatar, AvatarFallback, AvatarImage } from '$lib/components/ui/avatar';
	import { Tabs, TabsList, TabsTrigger, TabsContent } from '$lib/components/ui/tabs';
	import {
		Copy,
		Settings,
		LogOut,
		Users,
		UserCheck,
		LayoutGrid,
		Info,
		Activity as ActivityIcon
	} from 'lucide-svelte';
	import { goto, invalidateAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import Post from '$lib/components/Post.svelte';
	import LogoutConfirmModal from '$lib/components/LogoutConfirmModal.svelte';
	import { untrack } from 'svelte';

	// Get data from server load function (Svelte 5 syntax)
	let { data } = $props();

	// User data from server
	let user = $derived(data.user);

	// Local state for posts to allow optimistic updates
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
		posts = posts.filter((p) => {
			const apActivity = (p as any).activity || p;
			const objectId = (apActivity as any).object?.id || (apActivity as any).id;
			return objectId !== id;
		});

		postsCount -= 1;
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

<div class="relative min-h-screen overflow-hidden bg-background">
	<!-- Subtle Background Pattern -->
	<div
		class="pointer-events-none absolute inset-0 opacity-[0.05]"
		style="background-image: radial-gradient(circle at 1px 1px, rgb(139 92 246) 1px, transparent 0); background-size: 32px 32px;"
	></div>

	<!-- Hero Banner Section - Reduced height to minimize empty space -->
	<div class="relative h-32 w-full overflow-hidden md:h-48">
		<div
			class="animate-gradient absolute inset-0 bg-linear-to-br from-violet-500/40 via-purple-500/40 to-fuchsia-500/40 dark:from-violet-900/50 dark:via-purple-900/50 dark:to-fuchsia-900/50"
		></div>
		<div class="absolute inset-0 bg-linear-to-b from-transparent to-background/95"></div>
	</div>

	<div class="relative z-10 container mx-auto -mt-16 px-4 pb-12 sm:px-6 md:-mt-24 lg:px-8">
		<div class="grid grid-cols-1 gap-6 lg:grid-cols-12">
			<!-- Left Sidebar: User Profile Card -->
			<div class="lg:col-span-4">
				<div class="sticky top-20 space-y-6">
					<Card class="glass-card group animate-fade-in-up overflow-hidden border-none shadow-2xl">
						<CardContent class="p-0">
							<div class="flex flex-col items-center px-6 pt-8 pb-6 text-center">
								<!-- Larger Avatar for better presence -->
								<div class="relative mb-6">
									<div
										class="absolute -inset-1.5 animate-pulse rounded-full bg-linear-to-r from-violet-500 to-fuchsia-500 opacity-60 blur-md"
									></div>
									<Avatar
										class="relative h-32 w-32 border-4 border-background shadow-2xl transition-transform duration-300 group-hover:scale-[1.02]"
									>
										{#if user.avatarUrl}
											<AvatarImage src={user.avatarUrl} alt={user.displayName || user.username} />
										{/if}
										<AvatarFallback class="bg-muted text-3xl font-bold"
											>{getInitials(user.displayName, user.username)}</AvatarFallback
										>
									</Avatar>
								</div>

								<!-- Identity -->
								<h1 class="gradient-text mb-1 text-3xl font-extrabold tracking-tight">
									{user.displayName || user.username}
								</h1>
								<p class="text-sm font-bold tracking-widest text-foreground/40 uppercase">
									{user.handle}
								</p>

								<!-- Bio Section - Tightened -->
								<p class="mt-4 px-2 text-sm leading-relaxed text-foreground/70 italic">
									"{user.bio ||
										'Digital pioneer in the federation. Own your data, own your identity.'}"
								</p>

								<!-- Action Buttons -->
								<div class="mt-6 flex w-full flex-col gap-3">
									<Button
										onclick={() => goto('/profile/settings')}
										class="w-full bg-linear-to-r from-violet-500 to-fuchsia-500 text-white shadow-lg transition-all hover:scale-[1.02]"
									>
										<Settings class="mr-2 h-4 w-4" />
										Edit Profile
									</Button>

									<div class="flex gap-2">
										<Button
											variant="outline"
											onclick={copyProfile}
											class="glass-card flex-1 border-white/10 hover:bg-white/5"
										>
											<Copy class="mr-2 h-4 w-4" />
											Share
										</Button>
										<Button
											variant="ghost"
											onclick={() => (showingLogoutConfirm = true)}
											class="flex-1 text-destructive hover:bg-destructive/10"
										>
											<LogOut class="mr-2 h-4 w-4" />
											Logout
										</Button>
									</div>
								</div>
							</div>

							<!-- Stats Grid - Refined -->
							<div
								class="grid grid-cols-3 border-t border-white/10 bg-white/5 py-5 backdrop-blur-md"
							>
								<div class="flex flex-col items-center px-2">
									<span class="text-2xl font-black">{user.followersCount || 0}</span>
									<span class="text-[9px] font-black tracking-widest text-foreground/30 uppercase"
										>Followers</span
									>
								</div>
								<div class="flex flex-col items-center border-x border-white/10 px-2">
									<span class="text-2xl font-black">{user.followingCount || 0}</span>
									<span class="text-[9px] font-black tracking-widest text-foreground/30 uppercase"
										>Following</span
									>
								</div>
								<div class="flex flex-col items-center px-2">
									<span class="text-2xl font-black">{postsCount}</span>
									<span class="text-[9px] font-black tracking-widest text-foreground/30 uppercase"
										>Posts</span
									>
								</div>
							</div>
						</CardContent>
					</Card>

					<!-- Additional Info Card (Optional/Coming Soon) -->
					<Card
						class="glass-card animate-fade-in-up hidden border-none p-6 lg:block"
						style="animation-delay: 0.1s;"
					>
						<h3 class="mb-4 flex items-center font-semibold">
							<Info class="mr-2 h-4 w-4 text-violet-500" />
							About Federated Identity
						</h3>
						<div class="space-y-4 text-xs text-foreground/60">
							<div>
								<p class="mb-1 font-medium text-foreground/80">DID (Decentralized ID)</p>
								<p class="font-mono break-all opacity-70">{user.did}</p>
							</div>
							<div>
								<p class="mb-1 font-medium text-foreground/80">Joined</p>
								<p>
									{new Date(user.createdAt).toLocaleDateString('en-IN', {
										month: 'long',
										year: 'numeric'
									})}
								</p>
							</div>
						</div>
					</Card>
				</div>
			</div>

			<!-- Right Content: Tabs and Posts -->
			<div class="lg:col-span-8">
				<div class="animate-fade-in-up" style="animation-delay: 0.2s;">
					<Tabs value="posts" class="w-full">
						<TabsList
							class="glass-card mb-6 grid h-14 w-full grid-cols-3 border-none p-1.5 shadow-xl"
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
								Details
							</TabsTrigger>
						</TabsList>

						<TabsContent value="posts" class="mt-0 space-y-4">
							<div class="flex items-center justify-between">
								<h2 class="text-xl font-bold">Your Feed</h2>
								<Button
									onclick={() => goto('/create')}
									variant="outline"
									size="sm"
									class="glass-card border-white/10 hover:bg-violet-500/10"
								>
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
								<Card class="glass-card flex flex-col items-center border-none py-16 text-center">
									<div
										class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-violet-500/10"
									>
										<LayoutGrid class="h-8 w-8 text-violet-500" />
									</div>
									<h3 class="mb-2 text-lg font-semibold">No posts yet</h3>
									<p class="mx-auto max-w-xs text-sm text-foreground/50">
										Share your first post with the federation and start owning your identity.
									</p>
									<Button
										onclick={() => goto('/create')}
										class="mt-6 bg-violet-500 text-white hover:bg-violet-600"
									>
										Create First Post
									</Button>
								</Card>
							{/if}
						</TabsContent>

						<TabsContent value="activity">
							<Card class="glass-card flex flex-col items-center border-none py-16 text-center">
								<div
									class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-fuchsia-500/10"
								>
									<ActivityIcon class="h-8 w-8 text-fuchsia-500" />
								</div>
								<h3 class="mb-2 text-lg font-semibold">Activity Timeline</h3>
								<p class="mx-auto max-w-xs text-sm text-foreground/50">
									Your interactions across the federation will appear here soon.
								</p>
							</Card>
						</TabsContent>

						<TabsContent value="about">
							<Card class="glass-card border-none p-8">
								<div class="grid grid-cols-1 gap-8 md:grid-cols-2">
									<div class="space-y-6">
										<div>
											<label
												class="mb-2 block text-xs font-semibold tracking-wider text-foreground/50 uppercase"
												>Account Handle</label
											>
											<div class="flex items-center justify-between rounded-lg bg-white/5 p-3">
												<code class="text-sm font-medium">{user.handle}</code>
												<Button size="icon" variant="ghost" onclick={copyHandle} class="h-8 w-8">
													<Copy class="h-4 w-4" />
												</Button>
											</div>
										</div>
										<div>
											<label
												class="mb-2 block text-xs font-semibold tracking-wider text-foreground/50 uppercase"
												>Decentralized ID</label
											>
											<div class="rounded-lg bg-white/5 p-3">
												<code class="text-[10px] break-all opacity-70">{user.did}</code>
											</div>
										</div>
									</div>
									<div class="space-y-6">
										<div>
											<label
												class="mb-2 block text-xs font-semibold tracking-wider text-foreground/50 uppercase"
												>Privacy Network</label
											>
											<div class="flex items-center gap-2 rounded-lg bg-white/5 p-3">
												<UserCheck class="h-5 w-5 text-emerald-500" />
												<span class="text-sm font-medium">Fully Federated & Encrypted</span>
											</div>
										</div>
										<div>
											<label
												class="mb-2 block text-xs font-semibold tracking-wider text-foreground/50 uppercase"
												>Member Since</label
											>
											<p class="p-3 text-sm font-medium">
												{new Date(user.createdAt).toLocaleDateString('en-IN', {
													day: 'numeric',
													month: 'long',
													year: 'numeric'
												})}
											</p>
										</div>
									</div>
								</div>
							</Card>
						</TabsContent>
					</Tabs>
				</div>
			</div>
		</div>
	</div>
</div>

<LogoutConfirmModal bind:open={showingLogoutConfirm} />
