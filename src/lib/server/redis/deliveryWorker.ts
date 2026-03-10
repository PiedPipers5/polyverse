/**
 * Delivery Worker (Tasks 3.2.2, 3.2.3)
 *
 * Background worker that processes the `polyverse:delivery_queue`.
 * Each item contains an ActivityPub activity payload and a target inbox URL.
 * The worker signs the request with HTTP Signatures and POSTs it.
 */

import { getFactory } from './instance.js';
import { db } from '../db/index.js';
import { userSecrets, users } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { decrypt } from '../encryption.js';
import { createSign, createHash } from 'node:crypto';
import type { Redis } from 'ioredis';

const QUEUE_KEY = 'polyverse:delivery_queue';
const MAX_RETRIES = 3;
let isRunning = false;

export interface DeliveryJob {
    activity: Record<string, unknown>;
    inbox: string;
    actorUsername: string;
    actorUserId: string;
    retryCount?: number;
}

/**
 * Start the delivery worker. Runs a blocking loop that pops jobs from Redis.
 */
export async function startDeliveryWorker(): Promise<void> {
    if (isRunning) return;
    isRunning = true;

    try {
        const redisFactory = getFactory();
        const redis = redisFactory.getClient();

        console.log('Delivery worker started listening to', QUEUE_KEY);

        while (isRunning) {
            try {
                const result = await redis.brpop(QUEUE_KEY, 5);

                if (result) {
                    const [, value] = result;
                    const job: DeliveryJob = JSON.parse(value);
                    await processDeliveryJob(job, redis);
                }
            } catch (err) {
                console.error('Error in Delivery worker loop:', err);
                await new Promise((res) => setTimeout(res, 5000));
            }
        }
    } catch (err) {
        console.error('Failed to start Delivery worker:', err);
        isRunning = false;
    }
}

export function stopDeliveryWorker(): void {
    isRunning = false;
}

/**
 * Push a delivery job onto the Redis queue.
 */
export async function enqueueDelivery(job: DeliveryJob): Promise<void> {
    const redisFactory = getFactory();
    const redis = redisFactory.getClient();
    await redis.lpush(QUEUE_KEY, JSON.stringify(job));
}

/**
 * Process a single delivery job: sign and POST to the remote inbox.
 */
async function processDeliveryJob(job: DeliveryJob, redis: Redis): Promise<void> {
    const { activity, inbox, actorUsername, actorUserId, retryCount = 0 } = job;

    console.log(`Delivering ${(activity.type as string) || 'unknown'} to ${inbox} (attempt ${retryCount + 1})`);

    try {
        // 1. Get the user's private key for signing
        const secret = await db.query.userSecrets.findFirst({
            where: eq(userSecrets.userId, actorUserId)
        });

        if (!secret) {
            console.error(`No private key found for user ${actorUserId}, cannot sign request`);
            return;
        }

        const privateKeyPem = decrypt(secret.encryptedPrivateKey);

        // 2. Build the HTTP Signature
        const body = JSON.stringify(activity);
        const digest = `SHA-256=${createHash('sha256').update(body).digest('base64')}`;
        const inboxUrl = new URL(inbox);
        const date = new Date().toUTCString();

        const signedHeaders = '(request-target) host date digest content-type';
        const signingString = [
            `(request-target): post ${inboxUrl.pathname}`,
            `host: ${inboxUrl.host}`,
            `date: ${date}`,
            `digest: ${digest}`,
            `content-type: application/activity+json`
        ].join('\n');

        const signer = createSign('RSA-SHA256');
        signer.update(signingString);
        signer.end();
        const signature = signer.sign(privateKeyPem, 'base64');

        const domain = inboxUrl.protocol + '//' + inboxUrl.host;
        const keyId = `https://${process.env.DOMAIN || 'polyverse-pp.vercel.app'}/users/${actorUsername}#main-key`;

        const signatureHeader = `keyId="${keyId}",algorithm="rsa-sha256",headers="${signedHeaders}",signature="${signature}"`;

        // 3. POST to the remote inbox
        const response = await fetch(inbox, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/activity+json',
                'Date': date,
                'Digest': digest,
                'Signature': signatureHeader,
                'Host': inboxUrl.host
            },
            body,
            signal: AbortSignal.timeout(15_000)
        });

        if (response.ok || response.status === 202) {
            console.log(`Successfully delivered to ${inbox}: ${response.status}`);
        } else if (response.status >= 500 && retryCount < MAX_RETRIES) {
            // Server error — retry with exponential backoff
            console.warn(`Remote server error (${response.status}), scheduling retry ${retryCount + 1}/${MAX_RETRIES}`);
            const delay = Math.pow(2, retryCount) * 1000;
            await new Promise((res) => setTimeout(res, delay));
            await redis.lpush(
                QUEUE_KEY,
                JSON.stringify({ ...job, retryCount: retryCount + 1 })
            );
        } else {
            console.error(`Delivery to ${inbox} failed with status ${response.status}`);
        }
    } catch (err) {
        if (retryCount < MAX_RETRIES) {
            console.warn(`Delivery error, scheduling retry ${retryCount + 1}/${MAX_RETRIES}:`, err);
            const delay = Math.pow(2, retryCount) * 1000;
            await new Promise((res) => setTimeout(res, delay));
            await redis.lpush(
                QUEUE_KEY,
                JSON.stringify({ ...job, retryCount: retryCount + 1 })
            );
        } else {
            console.error(`Delivery to ${inbox} permanently failed after ${MAX_RETRIES} retries:`, err);
        }
    }
}
