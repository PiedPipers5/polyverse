// src/tests/epic_2_be_tests/2.5_media_upload.test.ts
//
// Unit Tests for User Story 2.5: Media Attachments
// Covers Tasks:
//   2.5.1 - POST /api/media/upload endpoint: accepts multipart/form-data,
//            validates file type (MIME check), uploads to storage, returns URL

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST as mediaUpload } from '../../routes/api/media/upload/+server';
import { createMockRequestEvent } from '../test-utils';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const MOCK_USER_ID = 'user-uuid-001';
const MOCK_USERNAME = 'alice';
const MOCK_DID = 'did:web:test.com:u:alice';
const MOCK_UPLOAD_URL = 'https://blob.vercel-storage.com/1234567890-photo.jpg';

// ---------------------------------------------------------------------------
// Module Mocks (inline literals to avoid hoisting issues)
// ---------------------------------------------------------------------------
vi.mock('$env/dynamic/private', () => ({
	env: { DOMAIN: 'test.com', BLOB_READ_WRITE_TOKEN: 'test_blob_rw_token' }
}));

vi.mock('$lib/server/blob', () => ({
	uploadFile: vi.fn(() => Promise.resolve('https://blob.vercel-storage.com/1234567890-photo.jpg'))
}));

vi.mock('$lib/server/validation', () => ({
	validateFile: vi.fn(() => undefined) // passes by default (no throw)
}));

import { uploadFile } from '$lib/server/blob';
import { validateFile } from '$lib/server/validation';

// ---------------------------------------------------------------------------
// Helper: call a handler and return {status, body} even when it throws
// ---------------------------------------------------------------------------
async function callHandler(fn: () => Promise<Response>): Promise<{ status: number; body: unknown }> {
	try {
		const res = await fn();
		let body: unknown;
		try { body = await res.json(); } catch { body = null; }
		return { status: res.status, body };
	} catch (err: unknown) {
		const httpErr = err as { status?: number; body?: unknown };
		return { status: httpErr.status ?? 500, body: httpErr.body ?? null };
	}
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeUploadEvent(file: File | null, authenticated = true) {
	const formData = new FormData();
	if (file) {
		formData.append('file', file);
	}

	const event = createMockRequestEvent({
		method: 'POST',
		url: '/api/media/upload',
		formData,
		locals: authenticated
			? { user: { userId: MOCK_USER_ID, username: MOCK_USERNAME, did: MOCK_DID } }
			: { user: null }
	});

	// Override formData() to return our controlled FormData
	Object.defineProperty(event.request, 'formData', {
		value: vi.fn().mockResolvedValue(formData),
		writable: true,
		configurable: true
	});

	return event;
}

function makeFile(name: string, type: string, sizeBytes = 1024): File {
	const content = new Uint8Array(sizeBytes).fill(0);
	return new File([content], name, { type });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('User Story 2.5 – Media Attachments', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		(uploadFile as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_UPLOAD_URL);
		(validateFile as ReturnType<typeof vi.fn>).mockReturnValue(undefined);
	});

	// -----------------------------------------------------------------------
	// Task 2.5.1 – POST /api/media/upload endpoint
	// -----------------------------------------------------------------------
	describe('Task 2.5.1 – POST /api/media/upload', () => {
		// --- Authentication ---
		it('returns 401 when user is not authenticated', async () => {
			const file = makeFile('photo.jpg', 'image/jpeg');
			const { status } = await callHandler(() => mediaUpload(makeUploadEvent(file, false)));
			expect(status).toBe(401);
		});

		it('does not call uploadFile when unauthenticated', async () => {
			const file = makeFile('photo.jpg', 'image/jpeg');
			await callHandler(() => mediaUpload(makeUploadEvent(file, false)));
			expect(uploadFile).not.toHaveBeenCalled();
		});

		// --- Input Validation ---
		it('returns 400 when no file is provided in the form data', async () => {
			const { status } = await callHandler(() => mediaUpload(makeUploadEvent(null)));
			expect(status).toBe(400);
		});

		it('calls validateFile with the uploaded file', async () => {
			const file = makeFile('photo.jpg', 'image/jpeg');
			await callHandler(() => mediaUpload(makeUploadEvent(file)));
			expect(validateFile).toHaveBeenCalledWith(file);
		});

		it('returns 400 when validateFile throws (invalid MIME type)', async () => {
			(validateFile as ReturnType<typeof vi.fn>).mockImplementation(() => {
				// Simulate SvelteKit error() object (has .status property)
				const err = Object.assign(new Error('Unsupported file type'), { status: 400 });
				throw err;
			});
			const file = makeFile('script.exe', 'application/x-msdownload');
			const { status } = await callHandler(() => mediaUpload(makeUploadEvent(file)));
			expect(status).toBe(400);
		});

		it('returns 400 when validateFile throws (file too large)', async () => {
			(validateFile as ReturnType<typeof vi.fn>).mockImplementation(() => {
				const err = Object.assign(new Error('File size exceeds limit'), { status: 400 });
				throw err;
			});
			const file = makeFile('huge.jpg', 'image/jpeg', 10 * 1024 * 1024);
			const { status } = await callHandler(() => mediaUpload(makeUploadEvent(file)));
			expect(status).toBe(400);
		});

		// --- Successful Upload ---
		it('returns HTTP 201 on successful upload', async () => {
			const file = makeFile('photo.jpg', 'image/jpeg');
			const { status } = await callHandler(() => mediaUpload(makeUploadEvent(file)));
			expect(status).toBe(201);
		});

		it('calls uploadFile with the file', async () => {
			const file = makeFile('photo.jpg', 'image/jpeg');
			await callHandler(() => mediaUpload(makeUploadEvent(file)));
			expect(uploadFile).toHaveBeenCalledWith(file);
		});

		it('response body contains the uploaded file URL', async () => {
			const file = makeFile('photo.jpg', 'image/jpeg');
			const { body } = await callHandler(() => mediaUpload(makeUploadEvent(file)));
			expect((body as Record<string, unknown>).url).toBe(MOCK_UPLOAD_URL);
		});

		it('response body has type "Image"', async () => {
			const file = makeFile('photo.jpg', 'image/jpeg');
			const { body } = await callHandler(() => mediaUpload(makeUploadEvent(file)));
			expect((body as Record<string, unknown>).type).toBe('Image');
		});

		it('response body mediaType matches the uploaded file MIME type (jpeg)', async () => {
			const file = makeFile('photo.jpg', 'image/jpeg');
			const { body } = await callHandler(() => mediaUpload(makeUploadEvent(file)));
			expect((body as Record<string, unknown>).mediaType).toBe('image/jpeg');
		});

		it('response body mediaType reflects PNG when PNG is uploaded', async () => {
			const file = makeFile('image.png', 'image/png');
			const { body } = await callHandler(() => mediaUpload(makeUploadEvent(file)));
			expect((body as Record<string, unknown>).mediaType).toBe('image/png');
		});

		it('response body mediaType reflects GIF when GIF is uploaded', async () => {
			const file = makeFile('animation.gif', 'image/gif');
			const { body } = await callHandler(() => mediaUpload(makeUploadEvent(file)));
			expect((body as Record<string, unknown>).mediaType).toBe('image/gif');
		});

		// --- Storage Error Handling ---
		it('returns 500 when uploadFile throws an unexpected error', async () => {
			(uploadFile as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Storage unavailable'));
			const file = makeFile('photo.jpg', 'image/jpeg');
			const { status } = await callHandler(() => mediaUpload(makeUploadEvent(file)));
			expect(status).toBe(500);
		});

		it('propagates SvelteKit errors from uploadFile (e.g. 500 from blob.ts)', async () => {
			// Simulate what blob.ts does: throw error(500, '...')
			const svelteKitError = Object.assign(new Error('Failed to upload media'), {
				status: 500,
				body: { message: 'Failed to upload media' }
			});
			(uploadFile as ReturnType<typeof vi.fn>).mockRejectedValue(svelteKitError);
			const file = makeFile('photo.jpg', 'image/jpeg');
			const { status } = await callHandler(() => mediaUpload(makeUploadEvent(file)));
			expect(status).toBeGreaterThanOrEqual(500);
		});

		// --- Integration with Note creation (Task 2.5.3 reference) ---
		it('returned URL can be used as attachment url in a Note', async () => {
			const file = makeFile('photo.jpg', 'image/jpeg');
			const { body } = await callHandler(() => mediaUpload(makeUploadEvent(file)));
			const b = body as Record<string, unknown>;
			// The returned object should be directly usable as a Note attachment
			const attachment = { type: b.type, url: b.url, mediaType: b.mediaType };
			expect(attachment.type).toBe('Image');
			expect(attachment.url as string).toMatch(/^https:\/\//);
			expect(attachment.mediaType).toBeTruthy();
		});
	});
});
