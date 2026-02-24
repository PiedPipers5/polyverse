<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { fade, fly } from 'svelte/transition';
	import { Eye, EyeOff } from 'lucide-svelte';

	let { form } = $props();
	let showPassword = $state(false);
</script>

<div class="starfield">
	{#each Array(40) as _, i}
		<div
			class="star"
			style="
				top: {Math.random() * 100}%; 
				left: {Math.random() * 100}%; 
				width: {Math.random() * 2}px; 
				height: {Math.random() * 2}px; 
				--duration: {3 + Math.random() * 5}s
			"
		></div>
	{/each}
</div>

<div class="grid min-h-screen w-full overflow-hidden selection:bg-purple-500/30 lg:grid-cols-2">
	<!-- Left Side - Epic Visual -->
	<div class="relative hidden h-full flex-col overflow-hidden p-12 text-white lg:flex">
		<div class="hero-bg absolute inset-0">
			<div class="absolute inset-0 bg-zinc-950/60 backdrop-blur-[2px]"></div>
			<div
				class="absolute inset-0 bg-gradient-to-r from-zinc-950 via-zinc-950/40 to-transparent"
			></div>
		</div>

		<div class="relative z-20 flex items-center text-2xl font-black tracking-tighter">
			<div
				class="mr-3 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 shadow-lg shadow-purple-500/20"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="24"
					height="24"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2.5"
					stroke-linecap="round"
					stroke-linejoin="round"
					><path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3" /></svg
				>
			</div>
			<span class="gradient-text uppercase">Polyverse</span>
		</div>

		<div class="relative z-20 mt-auto max-w-lg" in:fly={{ x: -20, duration: 1000, delay: 400 }}>
			<div class="mb-8 h-1 w-20 rounded-full bg-gradient-to-r from-purple-500 to-blue-500"></div>
			<blockquote class="space-y-6">
				<p class="text-4xl leading-tight font-light tracking-tight">
					&ldquo;<span class="font-medium text-white">The Internet We Deserve.</span>&rdquo;
				</p>
				<footer class="flex items-center gap-4">
					<div
						class="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800 text-xs font-bold tracking-tighter text-zinc-400 uppercase shadow-inner"
					>
						PP
					</div>
					<div>
						<p class="font-bold tracking-tight text-white">PiedPipers</p>
						<p class="text-xs font-bold tracking-widest text-zinc-500 uppercase">
							Decentralized Protocol Team
						</p>
					</div>
				</footer>
			</blockquote>
		</div>
	</div>

	<!-- Right Side - Smooth Login Form -->
	<div class="relative flex items-center justify-center p-8 lg:p-12">
		<div class="flex w-full max-w-[400px] flex-col space-y-10" in:fly={{ y: 20, duration: 800 }}>
			<div class="flex flex-col space-y-4">
				<div class="mb-6 lg:hidden">
					<div
						class="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 shadow-lg shadow-purple-500/20"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="28"
							height="28"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2.5"
							stroke-linecap="round"
							stroke-linejoin="round"
							><path
								d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3"
							/></svg
						>
					</div>
				</div>
				<h1 class="text-center text-4xl font-black tracking-tight text-foreground lg:text-left">
					Welcome <span class="gradient-text">Back</span>
				</h1>
				<p class="text-center text-lg font-light text-muted-foreground lg:text-left">
					Enter your keys to re-enter the Verse.
				</p>
			</div>

			<form method="POST" use:enhance class="grid gap-6">
				{#if form?.error}
					<div
						transition:fade
						class="animate-pulse rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-center text-sm text-red-400 backdrop-blur-sm"
					>
						{form.error}
					</div>
				{/if}

				<div class="group grid gap-2">
					<Label
						for="username"
						class="ml-1 text-sm font-medium text-zinc-400 transition-colors group-focus-within:text-purple-400"
						>Username</Label
					>
					<div class="relative">
						<Input
							id="username"
							name="username"
							type="text"
							placeholder="your_handle"
							autocomplete="username"
							required
							class="h-14 rounded-2xl border-border bg-muted/30 pl-12 text-foreground transition-all placeholder:text-muted-foreground/50 focus:border-purple-500/50 focus:ring-purple-500/10"
						/>

						<div
							class="absolute top-1/2 left-4 -translate-y-1/2 text-zinc-700 transition-colors group-focus-within:text-purple-500"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="20"
								height="20"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
								><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle
									cx="12"
									cy="7"
									r="4"
								></circle></svg
							>
						</div>
					</div>
				</div>

				<div class="group grid gap-2">
					<div class="ml-1 flex items-center justify-between">
						<Label
							for="password"
							class="text-sm font-medium text-zinc-400 transition-colors group-focus-within:text-purple-400"
							>Password</Label
						>
					</div>
					<div class="relative">
						<Input
							id="password"
							name="password"
							type={showPassword ? 'text' : 'password'}
							placeholder="••••••••"
							required
							class="h-14 rounded-2xl border-border bg-muted/30 pr-12 pl-12 text-foreground transition-all placeholder:text-muted-foreground/50 focus:border-purple-500/50 focus:ring-purple-500/10"
						/>
						<div
							class="absolute top-1/2 left-4 -translate-y-1/2 text-zinc-700 transition-colors group-focus-within:text-purple-500"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="20"
								height="20"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
								><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path
									d="M7 11V7a5 5 0 0 1 10 0v4"
								></path></svg
							>
						</div>
						<button
							type="button"
							class="absolute top-1/2 right-4 -translate-y-1/2 text-zinc-700 transition-colors hover:text-purple-500"
							onclick={() => (showPassword = !showPassword)}
						>
							{#if showPassword}
								<EyeOff size={20} />
							{:else}
								<Eye size={20} />
							{/if}
						</button>
					</div>
				</div>

				<Button
					type="submit"
					class="h-14 w-full rounded-2xl bg-primary text-lg font-black text-primary-foreground shadow-xl shadow-primary/5 transition-all hover:bg-primary/90 active:scale-[0.98]"
				>
					Sync Account
				</Button>
			</form>

			<div class="flex flex-col items-center space-y-6">
				<p class="text-center text-muted-foreground">
					New to this dimension?{' '}
					<a
						href="/register"
						class="font-bold text-foreground underline underline-offset-8 transition-colors hover:text-purple-500"
					>
						Forge Identity
					</a>
				</p>

				<div class="flex gap-4">
					{#each Array(3) as _, i}
						<div class="h-1.5 w-1.5 rounded-full bg-zinc-800"></div>
					{/each}
				</div>

				<p class="text-[10px] font-bold tracking-[0.3em] text-muted-foreground/50 uppercase">
					Decentralized Auth v1.0
				</p>
			</div>
		</div>
	</div>
</div>

<style>
	.starfield {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background: radial-gradient(circle at center, var(--background) 0%, oklch(0 0 0 / 10%) 100%);
		overflow: hidden;
		z-index: -1;
	}

	.star {
		position: absolute;
		background: var(--foreground);
		border-radius: 50%;
		opacity: 0.1;
		animation: blink var(--duration) infinite;
	}

	@keyframes blink {
		0%,
		100% {
			opacity: 0.2;
			transform: scale(1);
		}
		50% {
			opacity: 0.8;
			transform: scale(1.2);
		}
	}

	.hero-bg {
		background: url('/polyverse_hero_bg.png');
		background-size: cover;
		background-position: center;
	}

	.gradient-text {
		background: linear-gradient(to right, #8b5cf6, #3b82f6, #d946ef);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
	}
</style>
