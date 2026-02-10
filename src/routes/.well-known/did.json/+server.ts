import type { RequestHandler } from './$types';
import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

/**
 * DID Resolution Endpoint
 * 
 * Handles requests for DID Documents.
 * Supports query parameter ?id=<did> or standard path-based resolution if needed.
 * 
 * For did:web:domain:u:username, we expect this endpoint to be called as:
 * /.well-known/did.json?id=did:web:domain:u:username
 * OR
 * the standard path /u/username/did.json should be mapped (which we can alias or support via URL rewriting).
 * 
 * This file handles the centralized resolution strategy requested in Epic 1.
 */
export const GET: RequestHandler = async ({ url }) => {
    const did = url.searchParams.get('id');

    if (!did) {
        throw error(400, 'Missing "id" query parameter.');
    }

    // Verify DID format and extract username
    // Expected format: did:web:<domain>:u:<username>
    const parts = did.split(':');
    if (parts.length < 5 || parts[0] !== 'did' || parts[1] !== 'web' || parts[3] !== 'u') {
        // If it's just did:web:domain, we might validly return server DID if we had one.
        // For now, only user DIDs are implemented.
        throw error(400, 'Invalid DID format. Expected did:web:<domain>:u:<username>');
    }

    const username = parts[4];

    // Find user by username
    const user = await db.query.users.findFirst({
        where: eq(users.username, username),
        columns: {
            didDocument: true
        }
    });

    if (!user) {
        throw error(404, 'DID not found (User does not exist).');
    }

    // Return the DID Document
    return json(user.didDocument, {
        headers: {
            // Standard Content-Type for DID Documents
            'Content-Type': 'application/did+ld+json' 
        }
    });
};
