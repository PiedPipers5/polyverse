/**
 * Direct schema push script for interactions table
 */
import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
    console.error('DATABASE_URL not set');
    process.exit(1);
}

const sql = neon(DATABASE_URL);

async function main() {
    try {
        console.log('1. CREATE TABLE interactions...');
        await sql`
      CREATE TABLE IF NOT EXISTS "interactions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "post_id" text NOT NULL,
        "actor_id" uuid NOT NULL,
        "type" text NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL
      )
    `;
        console.log('  ✓');
    } catch (e: any) { console.log(`  ✗ ${e.message}`); }

    try {
        console.log('2. ADD CONSTRAINT actor_id_fk...');
        await sql`
      DO $$ BEGIN
        ALTER TABLE "interactions" ADD CONSTRAINT "interactions_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `;
        console.log('  ✓');
    } catch (e: any) { console.log(`  ✗ ${e.message}`); }

    try {
        console.log('3. CREATE UNIQUE INDEX ON (post_id, actor_id)...');
        await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS "interactions_post_actor_idx" ON "interactions" USING btree ("post_id","actor_id")
    `;
        console.log('  ✓');
    } catch (e: any) { console.log(`  ✗ ${e.message}`); }

    console.log('\n✅ Interactions table synced!');
}

main();
