import type { RequestHandler } from './$types';
import { error, json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { users } from '$lib/server/db/schema';

/**
 * WebFinger endpoint at the standard /.well-known/webfinger path.
 * Allows federated platforms (Mastodon, etc.) to discover users.
 * 
 * Query format: ?resource=acct:username@domain
 */
export const GET: RequestHandler = async (event) => {
    const resource: string | null = event.url.searchParams.get('resource');

    if (!resource || !resource.startsWith('acct:')) {
        throw error(400, 'Bad Request: Missing or invalid "resource" parameter. Format: acct:user@domain');
    }

    // Parse the handle
    const handle = resource.replace('acct:', '');
    const [username, domain] = handle.split('@');

    // Verify domain matches this server
    if (domain !== env.DOMAIN) {
        throw error(400, 'Bad Request: Domain does not match this server.');
    }

    // Find user in database
    const user = await db.query.users.findFirst({
        where: eq(users.username, username)
    });

    if (!user) {
        throw error(404, 'User not found');
    }

    // ActivityPub Actor URL
    const actorUrl = `https://${env.DOMAIN}/users/${username}`;
    
    // HTML profile URL
    const profileUrl = `https://${env.DOMAIN}/u/${username}`;

    // Return JRD (JSON Resource Descriptor)
    return json({
        subject: resource,
        aliases: [
            actorUrl,
            profileUrl
        ],
        links: [
            {
                rel: 'self',
                type: 'application/activity+json',
                href: actorUrl
            },
            {
                rel: 'http://webfinger.net/rel/profile-page',
                type: 'text/html',
                href: profileUrl
            }
        ]
    }, {
        headers: {
            'Content-Type': 'application/jrd+json'
        }
    });
};
