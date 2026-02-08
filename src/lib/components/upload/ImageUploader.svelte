<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { Upload, Loader2 } from 'lucide-svelte';

	let dragging = false;
	let file: File | null = null;
	let preview: string | null = null;
	let uploading = false;

	const MAX_SIZE_MB = 5;

	function selectFile(f: File) {
		if (!f.type.startsWith('image/')) {
			toast.error('Only image files are allowed');
			return;
		}

		if (f.size > MAX_SIZE_MB * 1024 * 1024) {
			toast.error('Image must be under 5MB');
			return;
		}

		file = f;
		preview = URL.createObjectURL(f);
	}

	async function upload() {
		if (!file) return;

		uploading = true;

		const form = new FormData();
		form.append('file', file);

		try {
			const res = await fetch('/api/upload/avatar', {
				method: 'POST',
				body: form,
				credentials: 'include'
			});

			if (!res.ok) throw new Error();

			toast.success('Profile image updated');
		} catch {
			toast.error('Upload failed');
		} finally {
			uploading = false;
		}
	}
</script>

<div
	class="relative rounded-xl border border-dashed p-5 transition-all
	       {dragging ? 'border-primary bg-primary/5' : 'border-muted'}"

	ondragover={(e) => {
		e.preventDefault();
		dragging = true;
	}}

	ondragleave={() => {
		dragging = false;
	}}

	ondrop={(e) => {
		e.preventDefault();
		dragging = false;
		const f = e.dataTransfer?.files?.[0];
		if (f) selectFile(f);
	}}
>
	<input
		type="file"
		accept="image/*"
		class="absolute inset-0 cursor-pointer opacity-0"
		onchange={(e) => selectFile(e.currentTarget.files![0])}
	/>

	{#if preview}
		<div class="flex items-center gap-4">
			<img
				src={preview}
				class="h-16 w-16 rounded-full object-cover border"
			/>

			<button
				class="rounded-md bg-black px-4 py-2 text-white text-sm flex items-center gap-2"
				onclick={upload}
				disabled={uploading}
			>
				{#if uploading}
					<Loader2 class="h-4 w-4 animate-spin" />
					Uploading
				{:else}
					Upload
				{/if}
			</button>
		</div>
	{:else}
		<div class="flex items-center gap-2 text-sm text-muted-foreground">
			<Upload class="h-4 w-4" />
			<span>Drop image or click to upload</span>
		</div>
	{/if}
</div>
