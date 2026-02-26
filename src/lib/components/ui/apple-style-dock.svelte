<script lang="ts">
	import Dock from './dock.svelte';
	import DockItem from './dock-item.svelte';
	import DockIcon from './dock-icon.svelte';
	import DockLabel from './dock-label.svelte';
	import { Home, Search, LogOut, User, PlusSquare } from 'lucide-svelte';
	import LogoutConfirmModal from '../LogoutConfirmModal.svelte';

	let { currentPath = '/feed' } = $props();

	let showingLogoutConfirm = $state(false);
</script>

<div
	class="pointer-events-none fixed right-0 bottom-0 left-0 z-50 flex w-full justify-center pb-2 md:pb-4"
>
	<div class="pointer-events-auto">
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

			<button type="button" onclick={() => (showingLogoutConfirm = true)}>
				<DockItem>
					<DockIcon slot="icon">
						<LogOut class="h-5 w-5 text-red-500" />
					</DockIcon>
					<DockLabel slot="label">Logout</DockLabel>
				</DockItem>
			</button>
		</Dock>
	</div>
</div>

<LogoutConfirmModal bind:open={showingLogoutConfirm} />
