CREATE TABLE "apns_devices" (
	"token" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"environment" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "apns_devices" ADD CONSTRAINT "apns_devices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "apns_devices_user_idx" ON "apns_devices" USING btree ("user_id");