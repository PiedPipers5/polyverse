<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { fly, fade } from 'svelte/transition';
	import { ArrowLeft, Mail, ChevronRight } from 'lucide-svelte';

	let { form } = $props();
	let isSubmitting = $state(false);
</script>

<div class="starfield">
	{#each Array(30) as _, i}
		<div
			class="star"
			style="
				top: {Math.random() * 100}%; 
				left: {Math.random() * 100}%; 
				width: {Math.random() * 2}px; 
				height: {Math.random() * 2}px; 
				--duration: {4 + Math.random() * 6}s
			"
		></div>
	{/each}
</div>

<div class="flex min-h-screen w-full items-center justify-center p-6 selection:bg-purple-500/30">
	<div class="w-full max-w-[440px]" in:fly={{ y: 20, duration: 800 }}>
		<div
			class="relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-zinc-950/60 p-8 shadow-2xl backdrop-blur-xl lg:p-12"
		>
			<div class="mb-10 flex flex-col items-center text-center">
				<div
					class="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 text-purple-400 ring-1 ring-white/10"
				>
					<Mail size={32} />
				</div>
				<h1 class="mb-3 text-3xl font-black tracking-tight text-white">
					Recovery <span class="gradient-text">Protocol</span>
				</h1>
				<p class="max-w-[280px] text-sm leading-relaxed font-light text-zinc-400">
					Enter your address to receive a temporary access key.
				</p>
			</div>

			<form
				method="POST"
				use:enhance={() => {
					isSubmitting = true;
					return async ({ update }) => {
						await update();
						isSubmitting = false;
					};
				}}
				class="space-y-8"
			>
				{#if form?.error}
					<div
						transition:fade
						class="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-center text-sm text-red-400 backdrop-blur-sm"
					>
						{form.error}
					</div>
				{/if}

				{#if form?.success}
					<div
						transition:fade
						class="rounded-2xl border border-green-500/20 bg-green-500/10 p-6 text-center backdrop-blur-sm"
					>
						<div class="mb-3 flex justify-center text-green-500">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="32"
								height="32"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2.5"
								stroke-linecap="round"
								stroke-linejoin="round"
								><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline
									points="22 4 12 14.01 9 11.01"
								/></svg
							>
						</div>
						<p class="text-sm font-medium text-green-400">Recovery email dispatched.</p>
						<p class="mt-1 text-xs text-green-400/60">Check your inbox for instructions.</p>
					</div>
				{:else}
					<div class="group space-y-2">
						<Label
							for="email"
							class="ml-1 text-sm font-medium text-zinc-400 transition-colors group-focus-within:text-purple-400"
							>Address</Label
						>
						<div class="relative">
							<Input
								id="email"
								name="email"
								type="email"
								placeholder="you@domain.com"
								required
								class="h-14 rounded-2xl border-white/5 bg-white/5 pl-12 text-white transition-all placeholder:text-zinc-600 focus:border-purple-500/50 focus:ring-purple-500/10"
							/>
							<div
								class="absolute top-1/2 left-4 -translate-y-1/2 text-zinc-500 transition-colors group-focus-within:text-purple-500"
							>
								<Mail size={18} />
							</div>
						</div>
					</div>

					<Button
						type="submit"
						class="h-14 w-full rounded-2xl bg-white text-lg font-black text-black transition-all hover:bg-zinc-200 active:scale-[0.98]"
						loading={isSubmitting}
					>
						<span class="mr-2">Send Reset Link</span>
						<ChevronRight size={18} />
					</Button>
				{/if}
			</form>

			<div class="mt-10 flex flex-col items-center space-y-6">
				<a
					href="/login"
					class="flex items-center gap-2 text-sm font-medium text-zinc-500 transition-colors hover:text-white"
				>
					<ArrowLeft size={16} />
					Back to Login
				</a>

				<div class="flex gap-4">
					{#each Array(3) as _, i}
						<div class="h-1.5 w-1.5 rounded-full bg-zinc-800"></div>
					{/each}
				</div>

				<p class="text-[10px] font-bold tracking-[0.3em] text-zinc-700 uppercase">
					Secure Recovery v1.0
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
		background: radial-gradient(circle at center, #09090b 0%, #000 100%);
		overflow: hidden;
		z-index: -1;
	}

	.star {
		position: absolute;
		background: white;
		border-radius: 50%;
		opacity: 0.1;
		animation: blink var(--duration) infinite;
	}

	@keyframes blink {
		0%,
		100% {
			opacity: 0.2;
		}
		50% {
			opacity: 0.6;
		}
	}

	.gradient-text {
		background: linear-gradient(to right, #8b5cf6, #3b82f6);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
	}
</style>
