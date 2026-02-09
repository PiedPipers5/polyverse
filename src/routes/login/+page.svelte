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
	class="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4 select-none"
>
	<Card class="w-full max-w-md border-purple-500/20 bg-slate-900/80 backdrop-blur-xl">
		<CardHeader class="text-center">
			<CardTitle class="text-2xl font-bold text-white">Welcome Back</CardTitle>
			<CardDescription class="text-slate-400">Sign in to your Polyverse account</CardDescription>
		</CardHeader>

		<form method="POST" use:enhance>
			<CardContent class="space-y-4">
				{#if form?.error}
					<div class="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
						{form.error}
					</div>
				{/if}

				<div class="space-y-2">
					<Label for="username" class="text-slate-300">Username</Label>
					<Input
						id="username"
						name="username"
						type="text"
						required
						class="border-slate-700 bg-slate-800/50 py-5 text-white placeholder:text-slate-500"
						placeholder="Enter your username"
					/>
				</div>

				<div class="my-5 space-y-2">
					<Label for="password" class="text-slate-300">Password</Label>
					<Input
						id="password"
						name="password"
						type="password"
						required
						class="border-slate-700 bg-slate-800/50 py-5 text-white placeholder:text-slate-500"
						placeholder="Enter your password"
					/>
				</div>
			</CardContent>

			<CardFooter class="my-8 flex flex-col gap-4">
				<Button
					type="submit"
					class="w-full bg-purple-600 py-5 text-balance text-white hover:bg-purple-700"
					>Sign In</Button
				>
				<p class="text-center text-sm text-slate-400">
					Don't have an account?
					<a href="/register" class="text-purple-400 underline hover:text-purple-300"> Register </a>
				</p>
			</CardFooter>
		</form>
	</Card>
</div>
