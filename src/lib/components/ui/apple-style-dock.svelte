<script lang="ts">
	import Dock from './dock.svelte';
	import DockItem from './dock-item.svelte';
	import DockIcon from './dock-icon.svelte';
	import DockLabel from './dock-label.svelte';
	import {
		Home,
		Search,
		LogOut,
		User,
		PlusSquare,
		MessageCircle,
		Eye,
		EyeOff
	} from 'lucide-svelte';
	import LogoutConfirmModal from '../LogoutConfirmModal.svelte';

	let { currentPath = '/feed' } = $props();

	let showingLogoutConfirm = $state(false);
	let isDockHidden = $state(false);
</script>

<div
	class="pointer-events-none fixed right-0 bottom-0 left-0 z-50 flex w-full flex-col items-center justify-end pb-2 md:pb-4"
>
	<div class="pointer-events-auto relative flex flex-col items-center">
		<!-- Hidden state button -->
		<button
			type="button"
			onclick={() => (isDockHidden = false)}
			class="absolute bottom-0 flex h-10 items-center justify-center rounded-full border border-white/10 bg-black/50 px-4 text-neutral-400 shadow-[0_8px_30px_rgb(0,0,0,0.5)] backdrop-blur-md transition-all duration-300 hover:text-white {isDockHidden
				? 'z-10 translate-y-0 opacity-100'
				: 'pointer-events-none -z-10 translate-y-8 opacity-0'}"
		>
			<Eye class="mr-2 h-4 w-4" /> <span class="text-sm font-medium">Show Dock</span>
		</button>

		<!-- Main Dock -->
		<div
			class="transition-all duration-300 {isDockHidden
				? 'pointer-events-none translate-y-24 opacity-0'
				: 'translate-y-0 opacity-100'}"
		>
			<Dock>
				<a href="/feed">
					<DockItem>
						<DockIcon slot="icon">
							<Home
								class="h-5 w-5 {currentPath.startsWith('/feed')
									? 'text-purple-500'
									: 'text-neutral-500'}"
							/>
						</DockIcon>
						<DockLabel slot="label">Feed</DockLabel>
					</DockItem>
				</a>

				<a href="/search">
					<DockItem>
						<DockIcon slot="icon">
							<Search
								class="h-5 w-5 {currentPath.startsWith('/search')
									? 'text-purple-500'
									: 'text-neutral-500'}"
							/>
						</DockIcon>
						<DockLabel slot="label">Search</DockLabel>
					</DockItem>
				</a>

				<a href="/create">
					<DockItem>
						<DockIcon slot="icon">
							<PlusSquare
								class="h-5 w-5 {currentPath.startsWith('/create')
									? 'text-purple-500'
									: 'text-neutral-500'}"
							/>
						</DockIcon>
						<DockLabel slot="label">Create</DockLabel>
					</DockItem>
				</a>

				<a href="/messages">
					<DockItem>
						<DockIcon slot="icon">
							<MessageCircle
								class="h-5 w-5 {currentPath.startsWith('/messages')
									? 'text-purple-500'
									: 'text-neutral-500'}"
							/>
						</DockIcon>
						<DockLabel slot="label">Messages</DockLabel>
					</DockItem>
				</a>


				<a href="/profile">
					<DockItem>
						<DockIcon slot="icon">
							<User
								class="h-5 w-5 {currentPath.startsWith('/profile')
									? 'text-purple-500'
									: 'text-neutral-500'}"
							/>
						</DockIcon>
						<DockLabel slot="label">Profile</DockLabel>
					</DockItem>
				</a>

				<div class="mx-2 my-2 h-full w-px self-stretch bg-neutral-200 dark:bg-neutral-800"></div>

				<button type="button" onclick={() => (isDockHidden = true)}>
					<DockItem>
						<DockIcon slot="icon">
							<EyeOff class="h-5 w-5 text-neutral-500 transition-colors hover:text-white" />
						</DockIcon>
						<DockLabel slot="label">Hide</DockLabel>
					</DockItem>
				</button>

				<button type="button" onclick={() => (showingLogoutConfirm = true)}>
					<DockItem>
						<DockIcon slot="icon">
							<LogOut class="h-5 w-5 text-red-500 transition-colors hover:text-red-400" />
						</DockIcon>
						<DockLabel slot="label">Logout</DockLabel>
					</DockItem>
				</button>
			</Dock>
		</div>
	</div>
</div>

<LogoutConfirmModal bind:open={showingLogoutConfirm} />
