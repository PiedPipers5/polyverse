import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from './schema';
import { env } from '$env/dynamic/private';

if (!env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

/**
 * The raw Neon client connection.
 * @see https://orm.drizzle.team/docs/get-started-postgresql#neon
 */
const client = neon(env.DATABASE_URL);


/**
 * The Drizzle ORM instance.
 * This will be imported into the app's endpoints to perofrm queries.
 */
export const db = drizzle(client, { schema });
