import { error } from '@sveltejs/kit';

const MAX_SIZE = 4.5 * 1024 * 1024; // 4.5MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

/**
 * Validates the uploaded file for size and type.
 * @param file The file object to validate.
 * @throws {Error} Throws 400 error if validation fails.
 */
export const validateFile = (file: File): void => {
    if (!file) {
        throw error(400, 'No file provided.');
    }

    if (file.size > MAX_SIZE) {
        throw error(400, `File size exceeds limit of ${MAX_SIZE / (1024 * 1024)}MB.`);
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        throw error(400, `Unsupported file type: ${file.type}. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}.`);
    }
};
