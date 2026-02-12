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
 
<div class="grid min-h-screen w-full lg:grid-cols-2">
<!-- Left Side - Hero Image -->
<div class="relative hidden h-full flex-col bg-muted p-10 text-white lg:flex dark:border-r">
<div class="absolute inset-0 bg-zinc-900">
<!-- svelte-ignore a11y_img_redundant_alt -->
<img

				src="src/lib/assets/pic.jpeg"

				alt="Polyverse Network Illustration"

				class="h-full w-full object-cover opacity-80"

			/>
<div class="absolute inset-0 bg-gradient-to-t from-zinc-900/90 to-zinc-900/20" />
</div>
<div class="relative z-20 flex items-center text-lg font-medium">
<svg

				xmlns="http://www.w3.org/2000/svg"

				viewBox="0 0 24 24"

				fill="none"

				stroke="currentColor"

				stroke-width="2"

				stroke-linecap="round"

				stroke-linejoin="round"

				class="mr-2 h-6 w-6 text-purple-400"
>
<path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3" />
</svg>

			Polyverse
</div>
<div class="relative z-20 mt-auto">
<blockquote class="space-y-2">
<p class="text-lg">
&ldquo;Experience the true freedom of a decentralized social network. Connect, share, and

					thrive in a universe where you own your data.&rdquo;
</p>
<footer class="text-sm">The Polyverse Team</footer>
</blockquote>
</div>
</div>
 
	<!-- Right Side - Login Form -->
<div class="flex items-center justify-center bg-background p-8">
<div class="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
<div class="flex flex-col space-y-2 text-center">
<h1 class="text-2xl font-semibold tracking-tight">Welcome Back</h1>
<p class="text-sm text-muted-foreground">Sign in to your Polyverse account</p>
</div>
 
			<form method="POST" use:enhance class="grid gap-6">

				{#if form?.error}
<div

						class="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-center text-sm text-red-500"
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
<Label for="password">Password</Label>
<Input

						id="password"

						name="password"

						type="password"

						placeholder="Enter your password"

						required

						class="bg-background"

					/>
</div>
 
				<Button type="submit" class="w-full bg-purple-600 text-white hover:bg-purple-700">

					Sign In
</Button>
</form>
 
			<p class="text-center text-sm text-muted-foreground">

				Don't have an account?{' '}
<a

					href="/register"

					class="text-purple-600 underline underline-offset-4 hover:text-purple-500"
>

					Register
</a>
</p>
</div>
</div>
</div>
 