<script lang="ts">
	import { Card, CardHeader, CardTitle, CardContent } from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Avatar, AvatarFallback } from '$lib/components/ui/avatar';
	import { toast } from 'svelte-sonner';
	import { Copy } from 'lucide-svelte';
	import { auth } from '$lib/stores/auth';
	import { goto } from '$app/navigation';
	import ImageUploader from '$lib/components/upload/ImageUploader.svelte';


	/**
	 * USER STATE
	 *
	 * These values currently act as local UI state.
	 * In future, they should be hydrated from:
	 * - authenticated session
	 * - database (Neon via Drizzle)
	 * - decentralized identity service (did:web)
	 */
	let name = $state('sai tejash');
	let username = $state('tejash');
	let domain = $state('example.com');
	let bio = $state('Full stack developer passionate about decentralized web.');
	let did = $state('did:web:example.com:user:veeranji');

	/**
	 * DERIVED HANDLE
	 *
	 * This is a computed value based on username + domain.
	 * Backend should ensure consistency between stored username/domain
	 * and the generated handle format.
	 */
	let handle = $derived(`@${username}@${domain}`);

	/**
	 * CLIPBOARD UTILITY
	 *
	 * Shared helper for copying user identifiers (handle, DID, etc.)
	 * Can later be moved to a shared utilities module.
	 */
	async function copy(text: string) {
		await navigator.clipboard.writeText(text);
		toast.success('Copied to clipboard!');
	}

	/**
	 * SAVE PROFILE ACTION
	 *
	 * Intended future behavior:
	 * - Validate inputs
	 * - Send PATCH/PUT request to profile API
	 * - Handle loading and error states
	 */
	function saveProfile() {
		toast.success('Profile saved (frontend demo)');
	}

/* =========================================
	Task 1.4.2
     Authentication : like needs login for viewing profile
  ========================================= */

	$effect(() => {
	if (!$auth.loading && !$auth.authenticated) {
		goto('/login');
	}
});
</script>

<div class="flex min-h-screen justify-center bg-muted p-6">
	<Card class="w-full max-w-2xl shadow-lg">
		<CardHeader>
			<CardTitle>Profile Settings</CardTitle>
		</CardHeader>

		<CardContent class="space-y-8">
			<!--
				PROFILE IMAGE
				Future implementation:
				- Upload to object storage (Vercel Blob)
				- Persist image URL in user profile table
			-->
			<div class="space-y-2">
				<p class="font-medium">Profile Picture</p>


				<div class="flex items-center gap-6">
	<Avatar class="h-16 w-16">
		<AvatarFallback>VU</AvatarFallback>
	</Avatar>

	<div class="flex-1">
		<ImageUploader />
	</div>
</div>

			</div>

			<!--
				DISPLAY NAME
				User-facing name shown across profile and federation views
			-->
			<div class="space-y-2">
				<label class="font-medium">Display Name</label>
				<Input bind:value={name} />
			</div>

			<!--
				USERNAME
				Constraints to be enforced server-side:
				- uniqueness
				- immutability (optional)
			-->
			<div class="space-y-2">
				<label class="font-medium">Username</label>
				<Input bind:value={username} />
			</div>

			<!--
				BIO
				Free-text profile description.
				May be reused in ActivityPub `summary` field.
			-->
			<div class="space-y-2">
				<label class="font-medium">Bio</label>
				<Textarea rows={3} bind:value={bio} />
			</div>

			<!--
				HANDLE
				Read-only federated identifier derived from username + domain.
				Used for discovery and sharing.
			-->
			<div class="space-y-2">
				<label class="font-medium">Your Handle</label>

				<div class="flex gap-2">
					<Input readonly value={handle} />
					<Button size="icon" onclick={() => copy(handle)}>
						<Copy class="h-4 w-4" />
					</Button>
				</div>
			</div>

			<!--
				DECENTRALIZED IDENTITY
				Represents the user's DID (did:web).
				Should remain immutable after creation.
			-->
			<div class="space-y-2">
				<label class="font-medium">Decentralized Identity (DID)</label>

				<div class="flex gap-2">
					<Input readonly value={did} />
					<Button size="icon" onclick={() => copy(did)}>
						<Copy class="h-4 w-4" />
					</Button>
				</div>
			</div>

			<!--
				PRIMARY ACTION
				Persists all profile changes.
			-->
			<div class="flex justify-end border-t pt-4">
				<Button onclick={saveProfile}>Save Changes</Button>
			</div>
		</CardContent>
	</Card>
</div>