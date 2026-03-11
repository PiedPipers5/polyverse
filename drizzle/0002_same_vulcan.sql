CREATE TABLE "custom_emojis" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shortcode" text NOT NULL,
	"image_url" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "custom_emojis_shortcode_unique" UNIQUE("shortcode")
);
--> statement-breakpoint
CREATE TABLE "federated_follows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"local_user_id" uuid NOT NULL,
	"remote_actor_uri" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"follow_activity_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" text NOT NULL,
	"actor_id" uuid NOT NULL,
	"type" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "followers" ADD COLUMN "status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "federated_follows" ADD CONSTRAINT "federated_follows_local_user_id_users_id_fk" FOREIGN KEY ("local_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "interactions_post_actor_idx" ON "interactions" USING btree ("post_id","actor_id");--> statement-breakpoint
CREATE INDEX "activities_in_reply_to_idx" ON "activities" USING btree ((("activity"->'object'->>'inReplyTo')));--> statement-breakpoint
CREATE UNIQUE INDEX "followers_user_follower_idx" ON "followers" USING btree ("user_id","follower_id");