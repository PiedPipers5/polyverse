// scripts/redis-smoke.ts
import { loadRedisConfig, RedisClientFactory, RedisCacheService } from '../src/lib/server/redis/index.js';

const isString = (v: unknown): v is string => typeof v === 'string';

async function main() {
  const config = loadRedisConfig(process.env);
  const factory = new RedisClientFactory(config, {
    error: (msg, meta) => console.error(msg, meta),
    info:  (msg, meta) => console.log(msg, meta),
    warn:  (msg, meta) => console.warn(msg, meta),
  });

  const cache = new RedisCacheService<string>(factory.getClient(), 'smoke-test', isString);

  await cache.set('hello', 'world', 60);
  console.log('SET hello = world (TTL 60s)');

  const value = await cache.get('hello');
  console.log('GET hello =', value); // should print "world"

  console.log('EXISTS hello =', await cache.exists('hello')); // true

  await cache.del('hello');
  console.log('DEL hello — EXISTS =', await cache.exists('hello')); // false

  await factory.disconnect();
  console.log('Disconnected. Smoke test passed!');
}

main().catch(console.error);