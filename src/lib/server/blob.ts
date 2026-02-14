import { put, del } from '@vercel/blob';
import type { PutBlobResult } from '@vercel/blob';
import { error } from '@sveltejs/kit';

/**
 * Uploads a file to Vercel Blob storage.
 * @param file The file object to upload.
 * @returns The URL of the uploaded file.
 */
export const uploadFile = async (file: File): Promise<string> => {
    try {
        const filename = `${Date.now()}-${file.name}`;

        const blob = await put(filename, file, {
            access: 'public',
        });

        return blob.url;
    } catch (err) {
        console.error('Blob upload failed:', err);
        throw error(500, 'Failed to upload media');
    }
};

/**
 * Deletes a file from Vercel Blob storage.
 * @param url The URL of the file to delete.
 */
export const deleteFile = async (url: string): Promise<void> => {
    try {
        await del(url);
    } catch (err) {
        console.error('Blob delete failed:', err);
        // We log but don't throw, as deletion failure shouldn't crash the main flow usually
    }
};
