<script lang="ts">
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

<div
	class="flex min-h-screen items-center justify-center bg-background p-4 select-none"
	style="background: linear-gradient(135deg, var(--background) 0%, var(--primary) 50%, var(--background) 100%)"
>
	<Card class="w-full max-w-md border-border/50 bg-card backdrop-blur-xl">
		<CardHeader class="text-center">
			<CardTitle class="text-2xl font-bold text-card-foreground">Welcome Back</CardTitle>
			<CardDescription class="text-muted-foreground"
				>Sign in to your Polyverse account</CardDescription
			>
		</CardHeader>

		<form method="POST" use:enhance>
			<CardContent class="space-y-4">
				{#if form?.error}
					<div
						class="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
					>
						{form.error}
					</div>
				{/if}

				<div class="space-y-2">
					<Label for="username" class="text-muted-foreground">Username</Label>
					<Input
						id="username"
						name="username"
						type="text"
						required
						class="border-input bg-input py-5 text-foreground placeholder:text-muted-foreground"
						placeholder="Enter your username"
					/>
				</div>

				<div class="my-5 space-y-2">
					<Label for="password" class="text-muted-foreground">Password</Label>
					<Input
						id="password"
						name="password"
						type="password"
						required
						class="border-input bg-input py-5 text-foreground placeholder:text-muted-foreground"
						placeholder="Enter your password"
					/>
				</div>
			</CardContent>

			<CardFooter class="my-8 flex flex-col gap-4">
				<Button
					type="submit"
					class="w-full bg-primary py-5 text-balance text-primary-foreground hover:opacity-90"
					>Sign In</Button
				>
				<p class="text-center text-sm text-muted-foreground">
					Don't have an account?
					<a href="/register" class="text-primary underline hover:opacity-80"> Register </a>
				</p>
			</CardFooter>
		</form>
	</Card>
</div>
