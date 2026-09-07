ALTER TABLE "sightings" ADD COLUMN "inat_observation_id" integer;--> statement-breakpoint
ALTER TABLE "sightings" ADD COLUMN "inat_sync_error" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "inat_access_token" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "inat_username" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "inat_sync_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "inat_connected_at" timestamp with time zone;