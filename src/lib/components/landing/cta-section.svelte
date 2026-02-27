<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { ArrowRight } from 'lucide-svelte';
	import { toast } from 'svelte-sonner';

	type User = {
		username: string;
		displayName: string | null;
		avatarUrl: string | null;
	};

	type Props = {
		user?: User | null;
	};

	let { user = null }: Props = $props();

	let email = $state('');
	let submitted = $state(false);
	let loading = $state(false);
	let error = $state('');

	async function handleSubmit(e: Event) {
		e.preventDefault();
		if (!email || loading) return;

		loading = true;
		error = '';

		try {
			const response = await fetch('/api/newsletter', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ email })
			});

			const data = await response.json();

			if (data.success) {
				submitted = true;
				toast.success("Thanks! We'll be in touch soon. 🎉");
				setTimeout(() => {
					submitted = false;
					email = '';
				}, 5000);
			} else {
				error = data.error || 'Something went wrong. Please try again.';
				toast.error(error);
			}
		} catch (err) {
			error = 'Network error. Please check your connection and try again.';
			toast.error(error);
			console.error('Newsletter signup error:', err);
		} finally {
			loading = false;
		}
	}
</script>

<section id="contact" class="relative overflow-hidden bg-background py-20 md:py-32">
	<!-- Animated Background -->
	<div
		class="animate-gradient absolute inset-0 bg-gradient-to-br from-violet-500/20 via-purple-500/20 to-fuchsia-500/20 dark:from-violet-900/30 dark:via-purple-900/30 dark:to-fuchsia-900/30"
	></div>

	<div class="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8">
		<div class="mx-auto max-w-4xl text-center">
			<!-- Content -->
			<div class="glass-card rounded-3xl p-8 shadow-2xl md:p-12 lg:p-16">
				<h2 class="animate-fade-in-up mb-4 text-3xl font-bold sm:text-4xl md:text-5xl">
					Ready to Join the Federation?
				</h2>
				<p
					class="animate-fade-in-up mb-8 text-lg text-foreground/70 md:text-xl"
					style="animation-delay: 0.1s;"
				>
					Experience true digital freedom. Choose your instance, connect with communities, and take
					control of your social presence in the POLYVERSE.
				</p>

				<!-- CTA Form -->
				{#if !submitted}
					<form
						onsubmit={handleSubmit}
						class="animate-fade-in-up mx-auto flex max-w-xl flex-col gap-4 sm:flex-row"
						style="animation-delay: 0.2s;"
					>
						<Input
							type="email"
							placeholder="Enter your email"
							bind:value={email}
							required
							disabled={loading}
							class="glass-card h-12 flex-1 border-white/20 px-6 text-base disabled:opacity-50"
						/>
						{#if user}
							<!-- User is logged in: Show link to profile -->
							<a href="/profile" class="w-full sm:w-auto">
								<Button
									size="lg"
									class="group h-12 w-full bg-gradient-to-r from-violet-500 to-fuchsia-500 px-8 text-white hover:from-violet-600 hover:to-fuchsia-600"
								>
									Go to Profile
									<ArrowRight class="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
								</Button>
							</a>
						{:else}
							<!-- User is logged out: Show newsletter signup -->
							<Button
								type="submit"
								size="lg"
								disabled={loading}
								class="group h-12 bg-gradient-to-r from-violet-500 to-fuchsia-500 px-8 text-white hover:from-violet-600 hover:to-fuchsia-600 disabled:opacity-50"
							>
								{loading ? 'Subscribing...' : 'Get Started'}
								{#if !loading}
									<ArrowRight class="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
								{/if}
							</Button>
						{/if}
					</form>

					{#if error}
						<div class="animate-fade-in mt-4 text-sm text-red-400">
							{error}
						</div>
					{/if}
				{:else}
					<div class="animate-fade-in py-8 text-center">
						<div
							class="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20"
						>
							<svg
								class="h-8 w-8 text-green-500"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M5 13l4 4L19 7"
								/>
							</svg>
						</div>
						<p class="text-lg font-medium">Thanks! We'll be in touch soon. 🎉</p>
					</div>
				{/if}

				<!-- Trust Indicators -->
				<div
					class="mt-12 flex flex-wrap items-center justify-center gap-8 border-t border-white/10 pt-8"
				>
					<div class="text-sm text-foreground/60">✓ 100% Open Source</div>
					<div class="text-sm text-foreground/60">✓ Your Data, Your Server</div>
					<div class="text-sm text-foreground/60">✓ No Ads, No Tracking</div>
				</div>
			</div>
		</div>
	</div>
</section>
