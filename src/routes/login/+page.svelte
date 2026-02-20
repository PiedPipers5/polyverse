<script lang="ts">
	import bgImage from '$lib/assets/loginPage.jpg';
	import ppLogo from '$lib/assets/pied-piper-logo.png';
	import { Eye, EyeOff } from 'lucide-svelte';

	import { enhance } from '$app/forms';

	import {
		Card,
		CardHeader,
		CardTitle,
		CardDescription,
		CardContent,
		CardFooter
	} from '$lib/components/ui/card';

	import { Button } from '$lib/components/ui/button';

	import { Input } from '$lib/components/ui/input';

	import { Label } from '$lib/components/ui/label';

	let { form } = $props();

	let showPassword = $state(false);
</script>

<div class="relative flex min-h-screen w-full items-center justify-center overflow-hidden">
	<!-- Background Image -->
	<div class="absolute inset-0 z-0">
		<img src={bgImage} alt="Polyverse Background" class="h-full w-full object-cover" />
		<div class="absolute inset-0 bg-black/25"></div>
	</div>

	<!-- Login Form Card -->
	<Card class="relative z-10 w-full max-w-sm border-2 bg-card/95 shadow-2xl backdrop-blur-sm">
		<CardHeader class="space-y-1 text-center">
			<div class="mb-6 flex justify-center">
				<div
					class="h-20 w-20 overflow-hidden rounded-full border-4 border-primary/20 bg-background shadow-lg"
				>
					<img src={ppLogo} alt="Polyverse Logo" class="h-full w-full object-cover" />
				</div>
			</div>
			<CardTitle class="text-2xl font-bold">Welcome back</CardTitle>
			<CardDescription>Sign in to your Polyverse account</CardDescription>
		</CardHeader>
		<CardContent>
			<form method="POST" use:enhance class="grid gap-4">
				{#if form?.error}
					<div
						class="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-center text-sm font-medium text-destructive"
					>
						{form.error}
					</div>
				{/if}

				<div class="grid gap-2">
					<Label for="username">Username</Label>
					<Input
						id="username"
						name="username"
						type="text"
						placeholder="Enter your username"
						autocomplete="username"
						required
						class="bg-background"
					/>
				</div>

				<div class="grid gap-2">
					<div class="flex items-center justify-between">
						<Label for="password">Password</Label>
						<!-- Add forgot password link here if needed later -->
					</div>
					<div class="relative">
						<Input
							id="password"
							name="password"
							type={showPassword ? 'text' : 'password'}
							placeholder="Enter your password"
							required
							class="bg-background pr-10"
						/>
						<button
							type="button"
							onclick={() => (showPassword = !showPassword)}
							class="absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer text-muted-foreground transition-colors hover:text-foreground"
							aria-label={showPassword ? 'Hide password' : 'Show password'}
						>
							{#if showPassword}
								<EyeOff class="h-4 w-4" />
							{:else}
								<Eye class="h-4 w-4" />
							{/if}
						</button>
					</div>
				</div>

				<Button type="submit" class="w-full cursor-pointer">Sign In</Button>
			</form>
		</CardContent>
		<CardFooter>
			<p class="w-full text-center text-sm text-muted-foreground">
				Don't have an account?{' '}
				<a
					href="/register"
					class="font-medium text-primary underline underline-offset-4 hover:text-primary/80"
				>
					Register
				</a>
			</p>
		</CardFooter>
	</Card>
</div>
