<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Alert from '$lib/components/ui/alert/index.js';

	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
</script>

<section class="flex h-screen w-screen items-center justify-center overflow-hidden select-none">
	{#if form?.errors || form?.success}
		<section
			class="absolute flex h-screen w-screen flex-col items-center justify-center bg-background/20 backdrop-blur select-none"
		>
			<Alert.Root class={`w-1/3 shadow-[0px_0px_50px_0px_#80000000]`}>
				<Alert.Title class={`${form?.errors && 'text-red-400'}`}
					>{form?.success ? 'Error Occurred' : 'Yayy!'}</Alert.Title
				>

				{#if form?.success}
					<Alert.Description class="font-bold">Your DID Web Token is:</Alert.Description>
				{/if}

				<Alert.Description>{form?.errors ? form.errors : form.did}</Alert.Description>
				<Alert.Description
					><p class="w-full py-3 text-center text-balance">
						Refresh page to try again
					</p></Alert.Description
				>
			</Alert.Root>
		</section>
	{/if}

	<!-- User Registration Card -->
	<Card.Root class="-my-4 w-full max-w-sm">
		<Card.Header>
			<Card.Title>Register on PolyVerse</Card.Title>
			<Card.Description
				>Hello there! Your journey to the future of social media starts here</Card.Description
			>
		</Card.Header>
		<Card.Content>
			<form id="register-form" method="POST">
				<div class="flex flex-col gap-6">
					<div class="grid gap-2">
						<Label for="username">Username</Label>
						<Input
							id="username"
							name="username"
							type="text"
							placeholder="victor_von_doom"
							required
						/>
					</div>
					<div class="grid gap-2">
						<div class="flex items-center">
							<Label for="password">Create a Password</Label>
						</div>
						<Input id="password" name="password" type="password" required />
					</div>
				</div>
			</form>
		</Card.Content>
		<Card.Footer class="flex-col gap-2">
			<Button type="submit" form="register-form" class="w-full cursor-pointer"
				>Join the PolyVerse</Button
			>
		</Card.Footer>
	</Card.Root>
</section>
