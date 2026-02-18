<script lang="ts">
	import bgImage from '$lib/assets/back_login.avif';
	import ppLogo from '$lib/assets/pp.png';

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
</script>

<div class="relative flex min-h-screen w-full items-center justify-center overflow-hidden">
	<!-- Background Image -->
	<div class="absolute inset-0 z-0">
		<img src={bgImage} alt="Polyverse Background" class="h-full w-full object-cover" />
		<div class="absolute inset-0 bg-background/60 backdrop-blur-[2px]"></div>
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
					<Input
						id="password"
						name="password"
						type="password"
						placeholder="Enter your password"
						required
						class="bg-background"
					/>
				</div>

				<Button type="submit" class="w-full">Sign In</Button>
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
