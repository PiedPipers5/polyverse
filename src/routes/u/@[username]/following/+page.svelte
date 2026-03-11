<script lang="ts">
	import { Card } from '$lib/components/ui/card';
	import { Avatar, AvatarFallback, AvatarImage } from '$lib/components/ui/avatar';
	import { User, Globe, ExternalLink, ArrowLeft } from 'lucide-svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let profile = $derived(data.profile);
	let following = $derived(data.following);

	function getInitials(name: string) {
		return name
			.split(' ')
			.map((n) => n[0])
			.join('')
			.toUpperCase()
			.slice(0, 2);
	}
</script>

<svelte:head>
	<title>People {profile.displayName} Follows - Polyverse</title>
</svelte:head>

<div class="flex min-h-screen flex-col items-center bg-muted px-4 py-16">
	<!-- Header -->
	<div class="mb-8 w-full max-w-lg">
		<a href="/u/@{profile.username}" class="mb-6 inline-flex items-center text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
			<ArrowLeft class="mr-2 h-4 w-4" />
			Back to Profile
		</a>
		<h1 class="text-3xl font-bold tracking-tight">Following</h1>
		<p class="mt-2 text-sm text-muted-foreground">
			{profile.displayName || profile.username} follows {following.length} people
		</p>
	</div>

	<!-- List of Following -->
	<div class="w-full max-w-lg space-y-3">
		{#if following.length === 0}
			<Card class="p-8 text-center text-muted-foreground">
				<p>Not following anyone yet.</p>
			</Card>
		{:else}
			{#each following as user}
				<a href={user.profileUrl} class="block rounded-xl transition-transform hover:scale-[1.01]">
					<Card class="flex items-center gap-4 p-4 transition-colors {user.type === 'local' ? 'hover:border-violet-400' : 'hover:border-sky-400'}">
						<Avatar class="h-12 w-12 shrink-0">
							{#if user.avatarUrl}
								<AvatarImage src={user.avatarUrl} alt={user.displayName} />
							{/if}
							<AvatarFallback class="bg-gradient-to-br {user.type === 'local' ? 'from-violet-500 to-fuchsia-500' : 'from-sky-500 to-indigo-500'} text-sm font-bold text-white">
								{getInitials(user.displayName)}
							</AvatarFallback>
						</Avatar>

						<div class="min-w-0 flex-1">
							<p class="truncate font-semibold">{user.displayName}</p>
							<p class="truncate text-sm text-muted-foreground">{user.handle}</p>
						</div>

						{#if user.type === 'local'}
							<span class="flex shrink-0 items-center gap-1.5 rounded-full border border-violet-400/30 bg-violet-500/10 px-2.5 py-1 text-xs font-medium text-violet-500">
								<User class="h-3 w-3" /> Local
							</span>
						{:else}
							<span class="flex shrink-0 items-center gap-1.5 rounded-full border border-sky-400/30 bg-sky-500/10 px-2.5 py-1 text-xs font-medium text-sky-500">
								<Globe class="h-3 w-3" /> Remote
							</span>
						{/if}
					</Card>
				</a>
			{/each}
		{/if}
	</div>
</div>
