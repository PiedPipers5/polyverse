import { json, error } from '@sveltejs/kit';
import { uploadFile } from '$lib/server/blob';
import { validateFile } from '$lib/server/validation';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
    // 1. Authentication Check
    if (!locals.user) {
        throw error(401, 'Unauthorized');
    }

    try {
        const formData = await request.formData();
        const file = formData.get('file');

        // 2. Validate Input
        if (!file || !(file instanceof File)) {
            throw error(400, 'No file uploaded or invalid file format.');
        }

        // 3. Validate File Content (Size, MIME)
        validateFile(file);

        // 4. Upload to Blot Storage
        const url = await uploadFile(file);

        // 5. Return success response
        return json({
            url,
            type: 'Image', // For now we only support images based on validation
            mediaType: file.type
        }, { status: 201 });

    } catch (err) {
        console.error('Media upload error:', err);
        if (err && typeof err === 'object' && 'status' in err) {
            // If it's a SvelteKit error (like the one from blob.ts), re-throw it
            throw err;
        }
        const message = err instanceof Error ? err.message : String(err);
        throw error(500, `Internal Server Error during file upload: ${message}`);
    }
};
