<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Alert from '$lib/components/ui/alert/index.js';

	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
</script>

<section
	class="relative flex min-h-screen w-full items-center justify-center bg-gradient-to-br from-indigo-500/10 via-background to-purple-500/10 p-6 select-none"
>
	<!-- Overlay Alert -->
	{#if form?.errors || form?.success}
		<div class="absolute inset-0 z-20 flex items-center justify-center bg-background/40 backdrop-blur">
			<Alert.Root class="w-full max-w-md shadow-2xl border">
				<Alert.Title class={form?.errors ? 'text-red-500' : 'text-green-500'}>
					{form?.errors ? 'Error Occurred' : 'Registration Successful'}
				</Alert.Title>

				{#if form?.success}
					<Alert.Description class="font-semibold mt-2">
						Your DID Web Token:
					</Alert.Description>
				{/if}

				<Alert.Description class="mt-2 break-all">
					{form?.errors ? form.errors : form.did}
				</Alert.Description>

				<Alert.Description class="pt-4 text-center text-sm text-muted-foreground">
					Refresh the page to continue
				</Alert.Description>
			</Alert.Root>
		</div>
	{/if}

	<!-- Registration Card -->
	<Card.Root
		class="relative z-10 w-full max-w-md border bg-card/90 backdrop-blur-xl shadow-xl rounded-2xl"
	>
		<Card.Header class="space-y-2 text-center">
			<Card.Title class="text-2xl font-bold tracking-tight">
				Join PolyVerse
			</Card.Title>
			<Card.Description class="text-sm text-muted-foreground">
				Create your decentralized identity and step into the future
			</Card.Description>
		</Card.Header>

		<Card.Content>
			<form id="register-form" method="POST" class="space-y-6">
				<div class="space-y-2">
					<Label for="username">Username</Label>
					<Input
						id="username"
						name="username"
						type="text"
						placeholder="victor_von_doom"
						required
						class="h-11"
					/>
				</div>

				<div class="space-y-2">
					<Label for="password">Create a Password</Label>
					<Input
						id="password"
						name="password"
						type="password"
						required
						class="h-11"
					/>
				</div>
			</form>
		</Card.Content>

		<Card.Footer class="flex flex-col gap-3">
			<Button
				type="submit"
				form="register-form"
				class="w-full h-11 text-base font-semibold"
			>
				Join the PolyVerse
			</Button>

			<p class="text-center text-xs text-muted-foreground">
				By registering, you create a decentralized web identity
			</p>
			<p class="text-center text-xs text-muted-foreground">
	Already have an account?
	<a href="/login" class="ml-1 underline underline-offset-4 hover:text-foreground">
		Sign in
	</a>
</p>

		</Card.Footer>
	</Card.Root>
</section>
