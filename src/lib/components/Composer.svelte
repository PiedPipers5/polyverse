<script lang="ts">
    import { Button } from '$lib/components/ui/button/index.js';
    import { Textarea } from '$lib/components/ui/textarea/index.js';
    import { enhance } from '$app/forms';
    import { toast } from 'svelte-sonner';

    let content = $state('');
    let isSubmitting = $state(false);
    const charLimit = 500;

    let charsRemaining = $derived(charLimit - content.length);

    async function handleSubmit() {
        if (!content.trim()) return;
        isSubmitting = true;

        try {
            // Optimistic update logic would go here if we had a globally managed store for the feed.
            // For now, we'll just submit to the endpoint.
            const response = await fetch(`/users/me/outbox`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/plain'
                },
                body: content
            });

            if (response.ok) {
                toast.success('Note published!');
                content = '';
                // Emit an event to refresh the feed if parent listens
            } else {
                const error = await response.text();
                toast.error(`Failed to publish: ${error}`);
            }
        } catch (e) {
            toast.error('An error occurred while publishing.');
            console.error(e);
        } finally {
            isSubmitting = false;
        }
    }
</script>

<div class="w-full max-w-2xl mx-auto p-4 border rounded-lg shadow-sm bg-card text-card-foreground">
    <div class="space-y-4">
        <Textarea
            placeholder="What's on your mind?"
            bind:value={content}
            class="min-h-[100px] resize-none"
            maxlength={charLimit}
            disabled={isSubmitting}
        />
        <div class="flex items-center justify-between">
            <span class="text-sm text-muted-foreground {charsRemaining < 0 ? 'text-destructive' : ''}">
                {charsRemaining} characters remaining
            </span>
            <Button 
                onclick={handleSubmit} 
                disabled={isSubmitting || !content.trim() || charsRemaining < 0}
            >
                {isSubmitting ? 'Publishing...' : 'Publish'}
            </Button>
        </div>
    </div>
</div>
