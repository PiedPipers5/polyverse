import { error, json } from '@sveltejs/kit';
import { put, del } from '@vercel/blob';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';

/**
 * POST /api/upload/avatar
 * Uploads a user's avatar image to Vercel Blob storage
 */
export const POST: RequestHandler = async ({ request, locals }) => {
    // Check authentication
    if (!locals.user) {
        throw error(401, 'Unauthorized');
    }

    // Get the form data
    const formData = await request.formData();
    const file = formData.get('avatar');

    // Validate file exists
    if (!file || !(file instanceof File)) {
        throw error(400, 'No file provided');
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
        throw error(400, 'Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.');
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024; // 5MB in bytes
    if (file.size > maxSize) {
        throw error(400, 'File too large. Maximum size is 5MB.');
    }

    // Get user's current avatar URL to delete old one if exists
    const [currentUser] = await db
        .select({ avatarUrl: users.avatarUrl })
        .from(users)
        .where(eq(users.id, locals.user.userId))
        .limit(1);

    // Check if BLOB_READ_WRITE_TOKEN is set
    if (!env.BLOB_READ_WRITE_TOKEN) {
        console.error('BLOB_READ_WRITE_TOKEN is not set!');
        throw error(500, 'Upload failed: Blob storage not configured. Please set BLOB_READ_WRITE_TOKEN in your .env file.');
    }

    try {
        // Generate a unique filename using timestamp and file extension
        const timestamp = Date.now();
        const extension = file.name.split('.').pop() || 'jpg';
        const filename = `avatars/${locals.user.userId}/${timestamp}.${extension}`;

        console.log('Uploading file:', filename, 'Size:', file.size, 'Type:', file.type);

        // Convert File to ArrayBuffer for Vercel Blob
        const arrayBuffer = await file.arrayBuffer();
        console.log('Converted to ArrayBuffer, size:', arrayBuffer.byteLength);

        // Upload to Vercel Blob
        const blob = await put(filename, arrayBuffer, {
            access: 'public',
            addRandomSuffix: false,
            contentType: file.type,
            token: env.BLOB_READ_WRITE_TOKEN
        });

        console.log('Upload successful! URL:', blob.url);

        // Update user's avatar URL in database
        const [updatedUser] = await db
            .update(users)
            .set({ avatarUrl: blob.url })
            .where(eq(users.id, locals.user.userId))
            .returning({ avatarUrl: users.avatarUrl });

        // Delete old avatar from Blob storage if it exists
        // Only delete if it's a Vercel Blob URL and different from the new one
        if (currentUser?.avatarUrl && currentUser.avatarUrl !== blob.url) {
            try {
                // Check if it's a Vercel Blob URL
                if (currentUser.avatarUrl.includes('blob.vercel-storage.com')) {
                    await del(currentUser.avatarUrl, { token: env.BLOB_READ_WRITE_TOKEN });
                }
            } catch (deleteError) {
                // Log but don't fail the request if old avatar deletion fails
                console.error('Failed to delete old avatar:', deleteError);
            }
        }

        return json({
            success: true,
            url: updatedUser.avatarUrl
        });
    } catch (uploadError) {
        console.error('Avatar upload error:', uploadError);

        // Return more detailed error message
        const errorMessage = uploadError instanceof Error
            ? uploadError.message
            : 'Failed to upload avatar';

        throw error(500, `Upload failed: ${errorMessage}`);
    }
};
