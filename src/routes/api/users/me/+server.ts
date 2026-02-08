import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

/**
 * GET /api/users/me - Get current authenticated user's profile
 */
export const GET: RequestHandler = async ({ locals }) => {
    // Check authentication
    if (!locals.user) {
        throw error(401, 'Unauthorized');
    }

    // Fetch user profile
    const user = await db.query.users.findFirst({
        where: eq(users.id, locals.user.userId),
        columns: {
            id: true,
            username: true,
            displayName: true,
            bio: true,
            avatarUrl: true,
            didDocument: true,
            createdAt: true,
        }
    });

    if (!user) {
        throw error(404, 'User not found');
    }

    // Extract DID from document
    const did = (user.didDocument as { id: string }).id;

    return json({
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        bio: user.bio,
        avatarUrl: user.avatarUrl,
        did: did,
        createdAt: user.createdAt,
    });
};

/**
 * PATCH /api/users/me - Update current user's profile
 */
export const PATCH: RequestHandler = async ({ locals, request }) => {
    // Check authentication
    if (!locals.user) {
        throw error(401, 'Unauthorized');
    }

    let body: { displayName?: string; bio?: string; avatarUrl?: string };
    
    try {
        body = await request.json();
    } catch {
        throw error(400, 'Invalid JSON body');
    }

    // Validate and sanitize inputs
    const updates: Partial<{
        displayName: string | null;
        bio: string | null;
        avatarUrl: string | null;
    }> = {};

    if ('displayName' in body) {
        // Sanitize display name - max 50 chars, strip HTML
        const displayName = body.displayName?.trim().slice(0, 50) || null;
        updates.displayName = displayName ? stripHtml(displayName) : null;
    }

    if ('bio' in body) {
        // Sanitize bio - max 500 chars, strip HTML
        const bio = body.bio?.trim().slice(0, 500) || null;
        updates.bio = bio ? stripHtml(bio) : null;
    }

    if ('avatarUrl' in body) {
        // Validate URL format if provided
        const avatarUrl = body.avatarUrl?.trim() || null;
        if (avatarUrl && !isValidUrl(avatarUrl)) {
            throw error(400, 'Invalid avatar URL');
        }
        updates.avatarUrl = avatarUrl;
    }

    // If no updates, return current user
    if (Object.keys(updates).length === 0) {
        throw error(400, 'No valid fields to update');
    }

    // Update user in database
    const [updatedUser] = await db.update(users)
        .set(updates)
        .where(eq(users.id, locals.user.userId))
        .returning({
            id: users.id,
            username: users.username,
            displayName: users.displayName,
            bio: users.bio,
            avatarUrl: users.avatarUrl,
        });

    return json({
        success: true,
        user: updatedUser
    });
};

/**
 * Strip HTML tags to prevent XSS (basic sanitization)
 */
function stripHtml(text: string): string {
    return text.replace(/<[^>]*>/g, '');
}

/**
 * Validate URL format
 */
function isValidUrl(urlString: string): boolean {
    try {
        const url = new URL(urlString);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
        return false;
    }
}
