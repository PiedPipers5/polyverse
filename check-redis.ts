import { Redis } from 'ioredis';

async function check() {
    const url = process.env.REDIS_URL;
    if (!url) {
        console.error('No REDIS_URL found in process.env');
        process.exit(1);
    }
    console.log(`Connecting to ${url}`);
    const redis = new Redis(url, {
        maxRetriesPerRequest: 1,
        retryStrategy: () => null // don't retry on failure
    });

    try {
        const res = await redis.ping();
        console.log('Redis connected successfully! Ping response:', res);
        process.exit(0);
    } catch (err) {
        console.error('Redis connection failed:', err);
        process.exit(1);
    }
}

check();
