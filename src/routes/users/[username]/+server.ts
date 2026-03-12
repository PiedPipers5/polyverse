import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { env } from '$env/dynamic/private';
import * as jose from 'jose';
import type { RequestHandler } from './$types';

/**
 * ActivityPub Actor endpoint with content negotiation.
 * 
 * If Accept header requests application/activity+json or application/ld+json,
 * returns the Actor JSON-LD object.
 * 
 * Otherwise, redirects to the HTML profile page.
 */
export const GET: RequestHandler = async ({ params, request }) => {
    const { username } = params;
    const domain = env.DOMAIN!;
    const acceptHeader = request.headers.get('accept') || '';

    // Check if requesting ActivityPub JSON
    const wantsActivityPub =
        acceptHeader.includes('application/activity+json') ||
        acceptHeader.includes('application/ld+json');

    // Fetch user from database
    const user = await db.query.users.findFirst({
        where: eq(users.username, username),
        columns: {
            id: true,
            username: true,
            displayName: true,
            bio: true,
            avatarUrl: true,
            didDocument: true,
        }
    });

    if (!user) {
        throw error(404, 'User not found');
    }

    // If browser request, redirect to profile page
    if (!wantsActivityPub) {
        return new Response(null, {
            status: 302,
            headers: {
                'Location': `/u/${username}`
            }
        });
    }

    // Extract public key from DID Document
    const didDocument = user.didDocument as {
        id: string;
        verificationMethod?: Array<{
            id: string;
            publicKeyJwk?: object;
        }>;
    };

    // Construct the Actor URL
    const actorUrl = `https://${domain}/users/${username}`;

    // Build public key for ActivityPub (using the DID verification method)
    const verificationMethod = didDocument.verificationMethod?.[0];

    // Construct the Actor JSON-LD object
    const actor: Record<string, unknown> = {
        '@context': [
            'https://www.w3.org/ns/activitystreams',
            'https://w3id.org/security/v1'
        ],
        id: actorUrl,
        type: 'Person',
        preferredUsername: user.username,
        inbox: `${actorUrl}/inbox`,
        outbox: `${actorUrl}/outbox`,
        followers: `${actorUrl}/followers`,
        following: `${actorUrl}/following`,
        endpoints: {
            sharedInbox: `https://${domain}/inbox`
        }
    };

    // Add optional profile fields
    if (user.displayName) {
        actor.name = user.displayName;
    }

    if (user.bio) {
        actor.summary = user.bio;
    }

    // Add avatar as ActivityPub Image object
    if (user.avatarUrl) {
        actor.icon = {
            type: 'Image',
            mediaType: 'image/jpeg', // Default to jpeg, could be detected
            url: user.avatarUrl
        };
    }

    // Add public key for HTTP Signatures
    if (verificationMethod) {
        let publicKeyPem: string | undefined;
        try {
            if (verificationMethod.publicKeyJwk) {
                const key = await jose.importJWK(verificationMethod.publicKeyJwk as jose.JWK, 'EdDSA');
                publicKeyPem = await jose.exportSPKI(key as CryptoKey);
            }
        } catch (err) {
            console.error('Failed to convert JWK to PEM for Actor public key:', err);
        }

        actor.publicKey = {
            id: `${actorUrl}#main-key`,
            owner: actorUrl,
            publicKeyJwk: verificationMethod.publicKeyJwk,
            ...(publicKeyPem ? { publicKeyPem } : {})
        };
    }

    // Link to DID Document
    actor.alsoKnownAs = [didDocument.id];

    // Shared Inbox for federation optimization (US 3.4)
    actor.endpoints = { sharedInbox: `https://${domain}/inbox` };

    return json(actor, {
        headers: {
            'Content-Type': 'application/activity+json; charset=utf-8'
        }
    });
};
