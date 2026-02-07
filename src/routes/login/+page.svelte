<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Label } from '$lib/components/ui/label';
	import { Input } from '$lib/components/ui/input';
	import * as Card from '$lib/components/ui/card';
	import * as Alert from '$lib/components/ui/alert';

    import { auth } from '$lib/stores/auth';


	import { goto } from '$app/navigation';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();

	$effect(() => {
	if (form?.success && form?.user) {
		auth.login(form.user); // ✅ GLOBAL AUTH STATE SET
		goto(`/u/@${form.user.username}`);
	}
});

</script>

<section
	class="relative flex min-h-screen w-full items-center justify-center bg-gradient-to-br from-indigo-500/10 via-background to-purple-500/10 p-6 select-none"
>
	<!-- Error Overlay -->
	{#if form?.errors}
		<div class="absolute inset-0 z-20 flex items-center justify-center bg-background/40 backdrop-blur">
			<Alert.Root class="w-full max-w-md border shadow-2xl">
				<Alert.Title class="text-red-500">
					Login Failed
				</Alert.Title>

				<Alert.Description class="mt-2">
					{form.errors}
				</Alert.Description>

				<Alert.Description class="pt-4 text-center text-sm text-muted-foreground">
					Check your credentials and try again
				</Alert.Description>
			</Alert.Root>
		</div>
	{/if}

	<!-- Login Card -->
	<Card.Root
		class="relative z-10 w-full max-w-md border bg-card/90 backdrop-blur-xl shadow-xl rounded-2xl"
	>
		<Card.Header class="space-y-2 text-center">
			<Card.Title class="text-2xl font-bold tracking-tight">
				Welcome Back
			</Card.Title>
			<Card.Description class="text-sm text-muted-foreground">
				Sign in to your PolyVerse identity
			</Card.Description>
		</Card.Header>

		<Card.Content>
			<form id="login-form" method="POST" class="space-y-6">
				<div class="space-y-2">
					<Label for="username">Username</Label>
					<Input
						id="username"
						name="username" 
                        placeholder="victor_von_doom"
						type="text"
						required
						class="h-11"
					/>
				</div>

				<div class="space-y-2">
					<Label for="password">Password</Label>
					<Input
						id="password"
						name="password"
						type="password"
                        placeholder="Enter your password"
						required
						class="h-11"
					/>
				</div>
			</form>
		</Card.Content>

		<Card.Footer class="flex flex-col gap-3">
			<Button
	type="submit"
	form="login-form"
	class="w-full h-11 text-base font-semibold "
>
	Sign In
</Button>


			<p class="text-center text-xs text-muted-foreground">
				New to PolyVerse? <a href="/register" class="underline">Create an account</a>
			</p>
		</Card.Footer>
	</Card.Root>
</section>
