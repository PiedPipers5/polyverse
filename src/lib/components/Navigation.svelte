<script lang="ts">
	import { Home, Search, UserCircle, PlusSquare, Bell, Compass } from 'lucide-svelte';
	import { page } from '$app/stores';

	let currentPath = $derived($page.url.pathname);

	const navItems = [
		{ href: '/feed', icon: Home, label: 'Feed' },
		{ href: '/search', icon: Search, label: 'Search' },
		// { href: '/explore', icon: Compass, label: 'Explore' }, // Placeholder for future
		// { href: '#', icon: PlusSquare, label: 'Create' }, // Placeholder
		// { href: '/notifications', icon: Bell, label: 'Notifications' }, // Placeholder
		{ href: '/profile', icon: UserCircle, label: 'Profile' }
	];

	// Extract active state logic
	function isActive(href: string) {
		return currentPath === href || (href !== '/' && currentPath.startsWith(href));
	}
</script>

<!-- Mobile Bottom Navigation -->
<nav
	class="fixed right-0 bottom-0 left-0 z-50 flex h-16 items-center justify-around border-t border-zinc-800 bg-zinc-950/80 px-4 backdrop-blur-lg md:hidden"
>
	{#each navItems as item}
		{@const Icon = item.icon}
		<a
			href={item.href}
			class="group relative flex flex-col items-center justify-center p-2 text-zinc-400 transition-colors hover:text-white {isActive(
				item.href
			)
				? 'text-white'
				: ''}"
			aria-label={item.label}
		>
			<div
				class="absolute inset-0 scale-50 rounded-full bg-purple-500/0 transition-all duration-300 group-hover:scale-100 group-hover:bg-purple-500/10 {isActive(
					item.href
				)
					? 'scale-100 bg-purple-500/20'
					: ''}"
			></div>
			<Icon
				class="relative z-10 h-6 w-6 transition-transform duration-300 group-hover:-translate-y-1 group-hover:scale-110 {isActive(
					item.href
				)
					? 'text-purple-400'
					: ''}"
				strokeWidth={isActive(item.href) ? 2.5 : 2}
			/>
			<span
				class="mt-1 text-[10px] font-medium opacity-0 transition-opacity duration-300 group-hover:opacity-100 {isActive(
					item.href
				)
					? 'opacity-100'
					: ''}"
			>
				{item.label}
			</span>
		</a>
	{/each}
</nav>

<!-- Desktop Sidebar Navigation -->
<aside
	class="fixed top-0 bottom-0 left-0 z-50 hidden w-20 flex-col items-center border-r border-zinc-800 bg-zinc-950/80 py-8 backdrop-blur-lg md:flex lg:w-64 lg:items-start lg:px-6"
>
	<div class="mb-12 flex w-full justify-center lg:justify-start">
		<a
			href="/feed"
			class="flex items-center gap-3 transition-transform hover:scale-105 active:scale-95"
		>
			<div
				class="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 shadow-lg shadow-purple-500/20"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2.1"
					stroke-linecap="round"
					stroke-linejoin="round"
					class="h-6 w-6 text-white"
				>
					<path d="M12 2a10 10 0 1 0 10 10H12V2z" />
					<path d="M12 12L2.1 12.1" />
					<path d="M12 12L12.1 21.9" />
					<path d="M12 12L21.9 12" />
					<path d="M12 12L12 2.1" />
				</svg>
			</div>
			<span class="hidden text-xl font-black tracking-tight text-white lg:block">
				Poly<span class="text-purple-400">Verse</span>
			</span>
		</a>
	</div>

	<div class="flex w-full flex-col gap-4">
		{#each navItems as item}
			{@const Icon = item.icon}
			<a
				href={item.href}
				class="group relative flex items-center justify-center gap-4 rounded-2xl p-3 text-zinc-400 transition-all hover:bg-white/5 hover:text-white lg:justify-start {isActive(
					item.href
				)
					? 'bg-white/5 text-white'
					: ''}"
			>
				{#if isActive(item.href)}
					<div
						class="absolute inset-0 rounded-2xl border border-purple-500/30 bg-purple-500/10"
					></div>
				{/if}
				<Icon
					class="relative z-10 h-7 w-7 transition-all duration-300 group-hover:scale-110 {isActive(
						item.href
					)
						? 'text-purple-400'
						: ''}"
					strokeWidth={isActive(item.href) ? 2.5 : 2}
				/>
				<span
					class="relative z-10 hidden text-lg font-medium lg:block {isActive(item.href)
						? 'font-bold'
						: ''}"
				>
					{item.label}
				</span>
			</a>
		{/each}
	</div>

	<div class="mt-auto flex w-full flex-col gap-4">
		<a
			href="/logout"
			class="group flex items-center justify-center gap-4 rounded-2xl p-3 text-zinc-500 transition-all hover:bg-white/5 hover:text-red-400 lg:justify-start"
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="24"
				height="24"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				class="h-6 w-6 transition-transform group-hover:-translate-x-1"
			>
				<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
				<polyline points="16 17 21 12 16 7" />
				<line x1="21" y1="12" x2="9" y2="12" />
			</svg>
			<span class="hidden text-lg font-medium lg:block">Logout</span>
		</a>
	</div>
</aside>
