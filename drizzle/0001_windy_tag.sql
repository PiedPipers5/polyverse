CREATE TABLE "followers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"remote_user_id" uuid,
	"follower_id" uuid,
	"remote_follower_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "remote_actors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"handle" text NOT NULL,
	"actor_uri" text NOT NULL,
	"domain" text NOT NULL,
	"actor_json" jsonb NOT NULL,
	"fetched_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "remote_actors_handle_unique" UNIQUE("handle"),
	CONSTRAINT "remote_actors_actor_uri_unique" UNIQUE("actor_uri")
);
--> statement-breakpoint
ALTER TABLE "activities" ALTER COLUMN "actor_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "activities" ADD COLUMN "remote_actor_id" uuid;--> statement-breakpoint
ALTER TABLE "activities" ADD COLUMN "activity" jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "activities" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "activities" ADD COLUMN "type" text NOT NULL;--> statement-breakpoint
ALTER TABLE "followers" ADD CONSTRAINT "followers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "followers" ADD CONSTRAINT "followers_remote_user_id_remote_actors_id_fk" FOREIGN KEY ("remote_user_id") REFERENCES "public"."remote_actors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "followers" ADD CONSTRAINT "followers_follower_id_users_id_fk" FOREIGN KEY ("follower_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "followers" ADD CONSTRAINT "followers_remote_follower_id_remote_actors_id_fk" FOREIGN KEY ("remote_follower_id") REFERENCES "public"."remote_actors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_remote_actor_id_remote_actors_id_fk" FOREIGN KEY ("remote_actor_id") REFERENCES "public"."remote_actors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activities_actor_created_at_idx" ON "activities" USING btree ("actor_id","created_at");--> statement-breakpoint
CREATE INDEX "activities_remote_actor_created_at_idx" ON "activities" USING btree ("remote_actor_id","created_at");--> statement-breakpoint
ALTER TABLE "activities" DROP COLUMN "activity_json";--> statement-breakpoint
ALTER TABLE "activities" DROP COLUMN "published_at";