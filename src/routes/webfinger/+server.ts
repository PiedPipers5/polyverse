import type { RequestHandler } from './$types';
import { error, json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { users } from '$lib/server/db/schema';

/**
 * PolyVerse needs to be capable of communicating with other platforms on the fediverse
 * TO do this we expose a webfinger. Another platform like mastadon can query this webfinger to 
 * check if a user exists on  this server or not.
 * @param event THe get event sent by another platform in the fediverse
 */
export const GET: RequestHandler = async (event) => {
    const resource: string | null = event.url.searchParams.get("resource");

    if (!resource || !resource.startsWith("acct:")) {
        throw error(400, "Bad Request: Missing or invalid \"resource\" parameter. Format: acct:user@domain");
    }

    // Get the username
    const handle = resource.replace("acct:", "");
    const [username, domain] = handle.split("@");

    // Verify that the domain matches our server
    if (domain !== env.DOMAIN) {
        throw error(400, "Bad Request: Domain does not match this server.");
    }

    // Find the user in this database
    const user = await db.query.users.findFirst({
        where: eq(users.username, username)
    })

    // If user not found, return error
    if (!user) {
        throw error(404, 'User not found');
    }

    // Return an Activity Pub JRD object

    const profileUrl = `https://${env.DOMAIN}/users/${username}`;

    return json({
        subject: resource,
        links: [
            {
                rel: 'self',
                type: 'application/activity+json',
                href: profileUrl
            },
            // Link to the HTML profile for humans
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
}