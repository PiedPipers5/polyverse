<script>
	let imageUrl = '';
	let error = '';

	async function handleUpload(e) {
		const file = e.target.files[0];
		if (!file) return;

		const formData = new FormData();
		formData.append('file', file);

		try {
			const res = await fetch('/api/media/upload', {
				method: 'POST',
				body: formData
			});

			const data = await res.json();

			if (!res.ok) {
				throw new Error(data.message || 'Upload failed');
			}

			imageUrl = data.url;
			error = '';
		} catch (err) {
			console.error(err);
			error = err.message;
			imageUrl = '';
		}
	}
</script>

<div style="padding: 20px;">
	<h1>Test Media Upload</h1>

	<input type="file" onchange={handleUpload} accept="image/*" />

	{#if error}
		<p style="color: red; margin-top: 10px;">Error: {error}</p>
	{/if}

	{#if imageUrl}
		<div style="margin-top: 20px;">
			<p style="color: green;">Upload Success!</p>
			<a href={imageUrl} target="_blank" rel="noopener noreferrer">{imageUrl}</a>
			<br />
			<img
				src={imageUrl}
				alt="Uploaded"
				style="max-width: 300px; margin-top: 10px; border: 1px solid #ccc;"
			/>
		</div>
	{/if}
</div>
