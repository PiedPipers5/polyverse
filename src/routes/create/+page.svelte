<script lang="ts">
	import Composer from '$lib/components/Composer.svelte';
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	function handlePostCreated() {
		// After successfully creating a post, redirect to feed or profile
		goto('/profile');
	}

	function handleCancel() {
		history.back();
	}
</script>

<div class="flex min-h-[calc(100vh-5rem)] items-center justify-center p-4">
	<div class="w-full max-w-2xl">
		<h1 class="mb-6 text-center text-2xl font-bold tracking-tight">Create a New Post</h1>
		<Composer
			username={data.user.username}
			onPostCreated={handlePostCreated}
			onCancel={handleCancel}
		/>
	</div>
</div>
