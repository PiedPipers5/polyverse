<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Alert from '$lib/components/ui/alert/index.js';
	import { fade, fly } from 'svelte/transition';
	import { Eye, EyeOff } from 'lucide-svelte';

	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
	let showPassword = $state(false);
	let showConfirmPassword = $state(false);
</script>

<div class="starfield">
	<div class="hero-overlay absolute inset-0"></div>
	{#each Array(50) as _, i}
		<div
			class="star"
			style="
				top: {Math.random() * 100}%; 
				left: {Math.random() * 100}%; 
				width: {Math.random() * 3}px; 
				height: {Math.random() * 3}px; 
				--duration: {2 + Math.random() * 4}s
			"
		></div>
	{/each}
</div>

<section
	class="relative flex min-h-screen w-full items-center justify-center p-6 selection:bg-purple-500/30"
>
	<!-- Status Modals -->
	{#if form?.errors || form?.success}
		<div
			transition:fade={{ duration: 300 }}
			class="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md"
		>
			<div
				in:fly={{ y: 20, duration: 400 }}
				class="w-full max-w-md rounded-3xl bg-gradient-to-br from-purple-500 to-blue-500 p-1 shadow-2xl"
			>
				<div class="rounded-[calc(1.5rem-1px)] bg-zinc-950 p-8">
					<div class="flex flex-col items-center space-y-4 text-center">
						{#if form?.success}
							<div
								class="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20 text-green-500"
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="32"
									height="32"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg
								>
							</div>
							<h2 class="text-2xl font-bold text-white">Identity Forged</h2>
							<p class="text-zinc-400">
								Your decentralized identity has been generated successfully.
							</p>
							<div class="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-left">
								<p class="mb-2 text-xs font-bold tracking-widest text-zinc-500 uppercase">
									Your DID Web
								</p>
								<p class="font-mono text-sm break-all text-purple-400 select-all">{form.did}</p>
							</div>
						{:else}
							<div
								class="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/20 text-red-500"
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="32"
									height="32"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
									><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"
									></line></svg
								>
							</div>
							<h2 class="text-2xl font-bold text-white">Sync Failure</h2>
							<p class="text-zinc-400">{form.errors}</p>
						{/if}

						<a
							href="/login"
							class="mt-6 flex h-12 w-full items-center justify-center rounded-xl bg-white font-bold text-black transition-all hover:bg-zinc-200"
						>
							{#if form?.success}Proceed to Login{:else}Try Again{/if}
						</a>

						{#if !form?.success}
							<button
								onclick={() => window.location.reload()}
								class="text-sm text-zinc-500 underline underline-offset-4 hover:text-white"
							>
								Dismiss
							</button>
						{/if}
					</div>
				</div>
			</div>
		</div>
	{/if}

	<!-- Registration Card -->
	<div in:fly={{ y: 40, duration: 800, delay: 200 }} class="w-full max-w-md">
		<div
			class="floating-card relative z-10 w-full overflow-hidden rounded-[2.5rem] border border-white/20 border-t-white/30 border-l-white/30 bg-zinc-950/40 p-1 backdrop-blur-3xl lg:p-1.5"
		>
			<div class="rounded-[2.4rem] bg-zinc-950/80 px-8 py-10 lg:px-10">
				<div class="mb-10 text-center">
					<div
						class="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-blue-500 text-white shadow-lg shadow-purple-500/20"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="24"
							height="24"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2.1"
							stroke-linecap="round"
							stroke-linejoin="round"
							><path d="M12 2a10 10 0 1 0 10 10H12V2z" /><path d="M12 12L2.1 12.1" /><path
								d="M12 12L12.1 21.9"
							/><path d="M12 12L21.9 12" /><path d="M12 12L12 2.1" /></svg
						>
					</div>
					<h1 class="mb-2 text-3xl font-black tracking-tight text-white">
						Join the <span
							class="bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500 bg-clip-text text-transparent"
							>PolyVerse</span
						>
					</h1>
					<p class="text-sm font-light text-zinc-400">
						Forge your decentralized identity in the new internet.
					</p>
				</div>

				<form id="register-form" method="POST" class="space-y-6">
					<div class="group space-y-2">
						<Label for="username" class="ml-1 text-sm font-medium text-zinc-300"
							>Universal Username</Label
						>
						<div class="relative">
							<Input
								id="username"
								name="username"
								type="text"
								placeholder="e.g. wanderer_01"
								required
								class="h-14 rounded-2xl border-zinc-800 bg-white/5 pl-12 text-white transition-all placeholder:text-zinc-600 focus:border-purple-500/50 focus:ring-purple-500/20"
							/>
							<div
								class="absolute top-1/2 left-4 -translate-y-1/2 text-zinc-500 transition-colors group-focus-within:text-purple-400"
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

					<div class="group space-y-2">
						<Label for="password" class="ml-1 text-sm font-medium text-zinc-300"
							>Secure Keyphrase</Label
						>
						<div class="relative">
							<Input
								id="password"
								name="password"
								type={showPassword ? 'text' : 'password'}
								placeholder="••••••••"
								required
								class="h-14 rounded-2xl border-zinc-800 bg-white/5 pr-12 pl-12 text-white transition-all placeholder:text-zinc-600 focus:border-purple-500/50 focus:ring-purple-500/20"
							/>
							<div
								class="absolute top-1/2 left-4 -translate-y-1/2 text-zinc-500 transition-colors group-focus-within:text-purple-400"
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
								class="absolute top-1/2 right-4 -translate-y-1/2 text-zinc-500 transition-colors hover:text-purple-400"
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

					<div class="group space-y-2">
						<Label for="confirmPassword" class="ml-1 text-sm font-medium text-zinc-300"
							>Confirm Keyphrase</Label
						>
						<div class="relative">
							<Input
								id="confirmPassword"
								name="confirmPassword"
								type={showConfirmPassword ? 'text' : 'password'}
								placeholder="••••••••"
								required
								class="h-14 rounded-2xl border-zinc-800 bg-white/5 pr-12 pl-12 text-white transition-all placeholder:text-zinc-600 focus:border-purple-500/50 focus:ring-purple-500/20"
							/>
							<div
								class="absolute top-1/2 left-4 -translate-y-1/2 text-zinc-500 transition-colors group-focus-within:text-purple-400"
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
								class="absolute top-1/2 right-4 -translate-y-1/2 text-zinc-500 transition-colors hover:text-purple-400"
								onclick={() => (showConfirmPassword = !showConfirmPassword)}
							>
								{#if showConfirmPassword}
									<EyeOff size={20} />
								{:else}
									<Eye size={20} />
								{/if}
							</button>
						</div>
					</div>

					<div class="pt-4">
						<Button
							type="submit"
							class="h-14 w-full rounded-2xl border-none bg-gradient-to-r from-purple-600 to-blue-600 text-lg font-bold text-primary-foreground shadow-lg shadow-purple-500/25 transition-all hover:from-purple-500 hover:to-blue-500 active:scale-[0.98]"
						>
							Generate Identity
						</Button>
					</div>
				</form>

				<div class="mt-8 flex flex-col items-center gap-4">
					<div class="flex w-full items-center gap-2">
						<div class="h-[1px] flex-1 bg-zinc-800"></div>
						<span class="text-[10px] font-bold tracking-[0.2em] text-zinc-600 uppercase"
							>Secure Protocol</span
						>
						<div class="h-[1px] flex-1 bg-zinc-800"></div>
					</div>

					<p class="text-center text-xs leading-relaxed font-light text-zinc-500">
						By joining, you create a <span class="font-medium text-purple-400">W3C DID</span>. Your
						data remains yours, always encrypted and decentralized.
					</p>

					<p class="text-sm text-muted-foreground">
						Already part of the Verse?
						<a
							href="/login"
							class="ml-1 font-bold text-foreground underline underline-offset-4 transition-colors hover:text-purple-500"
						>
							Sign In
						</a>
					</p>
				</div>
			</div>
		</div>
	</div>
</section>

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
			opacity: 0.3;
			transform: scale(1);
		}
		50% {
			opacity: 1;
			transform: scale(1.2);
		}
	}

	.hero-overlay {
		background: url('/polyverse_hero_bg.png');
		background-size: cover;
		background-position: center;
		opacity: 0.25;
	}

	.floating-card {
		transform: perspective(1000px) rotateX(2deg);
		transition: all 0.6s cubic-bezier(0.23, 1, 0.32, 1);
		box-shadow: 0 40px 100px -20px rgba(0, 0, 0, 0.8);
	}

	.floating-card:hover {
		transform: perspective(1000px) rotateX(0deg) translateY(-8px) scale(1.005);
		box-shadow: 0 60px 120px -30px rgba(0, 0, 0, 0.9);
	}
</style>
