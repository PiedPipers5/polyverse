<script lang="ts">
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Avatar, AvatarFallback, AvatarImage } from '$lib/components/ui/avatar';
	import { TrendingUp, UserPlus, Info, ExternalLink } from 'lucide-svelte';
	import { page } from '$app/stores';

	let suggestions = $derived($page.data.suggestions || []);

	let trends = [
		{ tag: '#Federation', posts: '2.4k' },
		{ tag: '#PrivacyFirst', posts: '1.8k' },
		{ tag: '#Polyverse', posts: '1.2k' },
		{ tag: '#Web3', posts: '850' },
		{ tag: '#DigitalIdentity', posts: '640' }
	];

	function getInitials(name: string): string {
		return name
			.split(' ')
			.map((n) => n[0])
			.join('')
			.toUpperCase();
	}
</script>

<div class="sticky top-20 flex flex-col gap-6">
	<!-- Trending Section -->
	<Card class="glass-card overflow-hidden border-none shadow-xl">
		<CardHeader class="pt-5 pb-3">
			<CardTitle class="flex items-center gap-2 text-lg font-bold">
				<TrendingUp class="h-5 w-5 text-violet-500" />
				Trending Topics
			</CardTitle>
		</CardHeader>
		<CardContent class="grid gap-4">
			{#each trends as trend}
				<div class="group cursor-pointer">
					<p class="text-sm font-bold text-violet-500 group-hover:underline">{trend.tag}</p>
					<p class="text-[10px] font-medium tracking-tighter text-foreground/40 uppercase">
						{trend.posts} posts
					</p>
				</div>
			{/each}
			<Button
				variant="ghost"
				class="mt-2 w-full text-xs text-sky-500 hover:bg-sky-500/5 hover:text-sky-600"
			>
				Show More
			</Button>
		</CardContent>
	</Card>

	<!-- Suggested Users -->
	<Card class="glass-card overflow-hidden border-none shadow-xl">
		<CardHeader class="pt-5 pb-3">
			<CardTitle class="flex items-center gap-2 text-lg font-bold">
				<UserPlus class="h-5 w-5 text-emerald-500" />
				Who to follow
			</CardTitle>
		</CardHeader>
		<CardContent class="grid gap-4">
			<div class="scrollbar-hide flex max-h-[400px] flex-col gap-4 overflow-y-auto pr-1">
				{#each suggestions as user}
					<div class="flex items-center justify-between gap-3">
						<div class="flex min-w-0 items-center gap-2">
							<Avatar class="h-9 w-9 border-2 border-background shadow-md">
								<AvatarImage src={user.avatarUrl} alt={user.displayName || user.username} />
								<AvatarFallback class="bg-muted text-[10px] font-bold">
									{getInitials(user.displayName || user.username)}
								</AvatarFallback>
							</Avatar>
							<div class="min-w-0">
								<p class="mb-1 truncate text-sm leading-none font-bold">
									{user.displayName || user.username}
								</p>
								<p class="truncate text-xs leading-none text-foreground/40">@{user.username}</p>
							</div>
						</div>
						<Button
							size="sm"
							variant="outline"
							class="glass-card h-8 border-white/10 px-3 text-xs hover:bg-white/5"
							href={`/u/@${user.username}`}
						>
							View
						</Button>
					</div>
				{/each}
			</div>
			<Button
				variant="ghost"
				class="mt-2 w-full text-xs text-emerald-500 hover:bg-emerald-500/5 hover:text-emerald-600"
				href="/search"
			>
				Find People
			</Button>
		</CardContent>
	</Card>

	<!-- Footer Links -->
	<div class="flex flex-wrap gap-x-4 gap-y-2 px-4">
		<a
			href="/docs"
			class="text-[10px] text-foreground/30 transition-colors hover:text-foreground/60"
			>Terms of Service</a
		>
		<a
			href="/docs"
			class="text-[10px] text-foreground/30 transition-colors hover:text-foreground/60"
			>Privacy Policy</a
		>
		<a
			href="/docs"
			class="text-[10px] text-foreground/30 transition-colors hover:text-foreground/60"
			>Federation Status</a
		>
		<p class="mt-2 w-full text-[10px] text-foreground/20">© 2026 Piedpipers.</p>
	</div>
</div>
