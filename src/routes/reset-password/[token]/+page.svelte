<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { fly, fade } from 'svelte/transition';
	import { Eye, EyeOff, Lock, ChevronRight, AlertCircle, CheckCircle2 } from 'lucide-svelte';

	let { form } = $props();
	let showPassword = $state(false);
	let showConfirmPassword = $state(false);
	let isSubmitting = $state(false);
	let password = $state('');

	const requirements = $derived([
		{ label: '8+ chars', met: password.length >= 8 },
		{ label: 'Uppercase', met: /[A-Z]/.test(password) },
		{ label: 'Number', met: /[0-9]/.test(password) },
		{ label: 'Special', met: /[!@#$%^&*\-+]/.test(password) }
	]);
</script>

<div class="starfield">
	{#each Array(40) as _, i}
		<div
			class="star"
			style="
				top: {Math.random() * 100}%; 
				left: {Math.random() * 100}%; 
				width: {Math.random() * 2.5}px; 
				height: {Math.random() * 2.5}px; 
				--duration: {3 + Math.random() * 5}s
			"
		></div>
	{/each}
</div>

<div class="flex min-h-screen w-full items-center justify-center p-6 selection:bg-purple-500/30">
	<div class="w-full max-w-[460px]" in:fly={{ y: 30, duration: 1000 }}>
		<div
			class="relative overflow-hidden rounded-[3rem] border border-white/10 bg-zinc-950/40 p-8 shadow-2xl backdrop-blur-2xl lg:p-14"
		>
			<div class="mb-12 flex flex-col items-center text-center">
				<div
					class="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 text-purple-400 shadow-lg ring-1 shadow-purple-500/10 ring-white/10"
				>
					<Lock size={32} />
				</div>
				<h1 class="mb-3 text-3xl font-black tracking-tight text-white">
					New <span class="gradient-text text-glow">Keyphrase</span>
				</h1>
				<p class="max-w-[280px] text-sm leading-relaxed font-light text-zinc-400">
					Forge a new secure access key for your identity.
				</p>
			</div>

			{#if form?.success}
				<div transition:fade class="flex flex-col items-center py-4 text-center">
					<div
						class="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-500/10 text-green-500"
					>
						<CheckCircle2 size={48} />
					</div>
					<h2 class="mb-2 text-xl font-bold text-white">Reset Successful</h2>
					<p class="mb-8 text-sm text-zinc-400">
						Your access key has been updated across the Verse.
					</p>
					<a
						href="/login"
						class="flex h-14 w-full items-center justify-center rounded-2xl bg-white font-black text-black transition-all hover:bg-zinc-200"
					>
						Re-enter the Verse
					</a>
				</div>
			{:else}
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
							class="flex items-center gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-5 text-sm text-red-400 backdrop-blur-sm"
						>
							<AlertCircle size={18} class="shrink-0" />
							<span>{form.error}</span>
						</div>
					{/if}

					<div class="group space-y-2">
						<Label
							for="password"
							class="ml-1 text-sm font-medium text-zinc-400 transition-colors group-focus-within:text-purple-400"
							>New Keyphrase</Label
						>
						<div class="relative">
							<Input
								id="password"
								name="password"
								type={showPassword ? 'text' : 'password'}
								placeholder="••••••••"
								required
								bind:value={password}
								class="h-14 rounded-2xl border-white/5 bg-white/5 pr-12 pl-12 text-white transition-all placeholder:text-zinc-700 focus:border-purple-500/50 focus:ring-purple-500/10"
							/>
							<div
								class="absolute top-1/2 left-4 -translate-y-1/2 text-zinc-600 transition-colors group-focus-within:text-purple-500"
							>
								<Lock size={18} />
							</div>
							<button
								type="button"
								class="absolute top-1/2 right-4 -translate-y-1/2 text-zinc-600 transition-colors hover:text-purple-400"
								onclick={() => (showPassword = !showPassword)}
							>
								{#if showPassword}
									<EyeOff size={18} />
								{:else}
									<Eye size={18} />
								{/if}
							</button>
						</div>

						<div class="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 px-1">
							{#each requirements as req}
								<div class="flex items-center gap-2">
									<div
										class="flex h-3.5 w-3.5 items-center justify-center rounded-full border transition-all duration-500 {req.met
											? 'border-green-500 bg-green-500/20'
											: 'border-zinc-800 bg-zinc-900/50'}"
									>
										{#if req.met}
											<div class="h-1.5 w-1.5 rounded-full bg-green-500" in:fade></div>
										{/if}
									</div>
									<span
										class="text-[10px] font-bold tracking-tight transition-all duration-300 {req.met
											? 'text-green-500'
											: 'text-zinc-600'}"
									>
										{req.label}
									</span>
								</div>
							{/each}
						</div>
					</div>

					<div class="group space-y-2">
						<Label
							for="confirmPassword"
							class="ml-1 text-sm font-medium text-zinc-400 transition-colors group-focus-within:text-purple-400"
							>Confirm Keyphrase</Label
						>
						<div class="relative">
							<Input
								id="confirmPassword"
								name="confirmPassword"
								type={showConfirmPassword ? 'text' : 'password'}
								placeholder="••••••••"
								required
								class="h-14 rounded-2xl border-white/5 bg-white/5 pr-12 pl-12 text-white transition-all placeholder:text-zinc-700 focus:border-purple-500/50 focus:ring-purple-500/10"
							/>
							<div
								class="absolute top-1/2 left-4 -translate-y-1/2 text-zinc-600 transition-colors group-focus-within:text-purple-500"
							>
								<Lock size={18} />
							</div>
							<button
								type="button"
								class="absolute top-1/2 right-4 -translate-y-1/2 text-zinc-600 transition-colors hover:text-purple-400"
								onclick={() => (showConfirmPassword = !showConfirmPassword)}
							>
								{#if showConfirmPassword}
									<EyeOff size={18} />
								{:else}
									<Eye size={18} />
								{/if}
							</button>
						</div>
					</div>

					<Button
						type="submit"
						class="mt-4 h-15 w-full rounded-2xl bg-gradient-to-r from-purple-600 to-blue-600 text-lg font-black text-white shadow-xl shadow-purple-500/20 transition-all hover:brightness-110 active:scale-[0.98]"
						loading={isSubmitting}
					>
						Update access key
						<ChevronRight size={20} class="ml-2" />
					</Button>
				</form>
			{/if}
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
		background: #000;
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
			transform: scale(1);
		}
		50% {
			opacity: 0.8;
			transform: scale(1.3);
		}
	}

	.gradient-text {
		background: linear-gradient(to right, #a855f7, #3b82f6);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
	}

	.text-glow {
		text-shadow: 0 0 20px rgba(139, 92, 246, 0.3);
	}
</style>
