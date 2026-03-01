/**
 * Direct schema push script using tagged template literals for neon().
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
        console.log('1. ALTER activities.actor_id DROP NOT NULL...');
        await sql`ALTER TABLE "activities" ALTER COLUMN "actor_id" DROP NOT NULL`;
        console.log('  ✓');
    } catch (e: any) { console.log(`  ✗ ${e.message}`); }

    try {
        console.log('2. ALTER followers.user_id DROP NOT NULL...');
        await sql`ALTER TABLE "followers" ALTER COLUMN "user_id" DROP NOT NULL`;
        console.log('  ✓');
    } catch (e: any) { console.log(`  ✗ ${e.message}`); }

    try {
        console.log('3. ALTER followers.follower_id DROP NOT NULL...');
        await sql`ALTER TABLE "followers" ALTER COLUMN "follower_id" DROP NOT NULL`;
        console.log('  ✓');
    } catch (e: any) { console.log(`  ✗ ${e.message}`); }

    try {
        console.log('4. ADD remote_actor_id to activities...');
        await sql`ALTER TABLE "activities" ADD COLUMN IF NOT EXISTS "remote_actor_id" uuid`;
        console.log('  ✓');
    } catch (e: any) { console.log(`  ✗ ${e.message}`); }

    try {
        console.log('5. ADD remote_user_id to followers...');
        await sql`ALTER TABLE "followers" ADD COLUMN IF NOT EXISTS "remote_user_id" uuid`;
        console.log('  ✓');
    } catch (e: any) { console.log(`  ✗ ${e.message}`); }

    try {
        console.log('6. ADD remote_follower_id to followers...');
        await sql`ALTER TABLE "followers" ADD COLUMN IF NOT EXISTS "remote_follower_id" uuid`;
        console.log('  ✓');
    } catch (e: any) { console.log(`  ✗ ${e.message}`); }

    // Foreign key: activities -> remote_actors
    try {
        console.log('7. FK activities.remote_actor_id -> remote_actors.id...');
        await sql`DO $$ BEGIN
      ALTER TABLE "activities" ADD CONSTRAINT "activities_remote_actor_id_remote_actors_id_fk"
        FOREIGN KEY ("remote_actor_id") REFERENCES "public"."remote_actors"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`;
        console.log('  ✓');
    } catch (e: any) { console.log(`  ✗ ${e.message}`); }

    // Foreign key: followers.remote_user_id -> remote_actors.id
    try {
        console.log('8. FK followers.remote_user_id -> remote_actors.id...');
        await sql`DO $$ BEGIN
      ALTER TABLE "followers" ADD CONSTRAINT "followers_remote_user_id_remote_actors_id_fk"
        FOREIGN KEY ("remote_user_id") REFERENCES "public"."remote_actors"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`;
        console.log('  ✓');
    } catch (e: any) { console.log(`  ✗ ${e.message}`); }

    // Foreign key: followers.remote_follower_id -> remote_actors.id
    try {
        console.log('9. FK followers.remote_follower_id -> remote_actors.id...');
        await sql`DO $$ BEGIN
      ALTER TABLE "followers" ADD CONSTRAINT "followers_remote_follower_id_remote_actors_id_fk"
        FOREIGN KEY ("remote_follower_id") REFERENCES "public"."remote_actors"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`;
        console.log('  ✓');
    } catch (e: any) { console.log(`  ✗ ${e.message}`); }

    // Index
    try {
        console.log('10. CREATE INDEX activities_remote_actor_created_at_idx...');
        await sql`CREATE INDEX IF NOT EXISTS "activities_remote_actor_created_at_idx" ON "activities" USING btree ("remote_actor_id","created_at")`;
        console.log('  ✓');
    } catch (e: any) { console.log(`  ✗ ${e.message}`); }

    // Drop status column
    try {
        console.log('11. DROP status column from followers...');
        await sql`ALTER TABLE "followers" DROP COLUMN IF EXISTS "status"`;
        console.log('  ✓');
    } catch (e: any) { console.log(`  ✗ ${e.message}`); }

    // Check and add id column on followers
    try {
        const result = await sql`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'followers' AND column_name = 'id'
    `;
        if (result.length === 0) {
            console.log('12. Adding id column to followers...');
            await sql`ALTER TABLE "followers" ADD COLUMN "id" uuid PRIMARY KEY DEFAULT gen_random_uuid()`;
            console.log('  ✓');
        } else {
            console.log('12. id column already exists in followers ✓');
        }
    } catch (e: any) { console.log(`  ✗ ${e.message}`); }

    console.log('\n✅ Schema sync complete!');
}

main();
