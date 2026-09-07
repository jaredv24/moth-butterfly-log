CREATE TABLE "checklist_species" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "checklist_species_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"inat_taxon_id" integer NOT NULL,
	"common_name" text NOT NULL,
	"scientific_name" text NOT NULL,
	"taxon_group" text NOT NULL,
	"family" text DEFAULT 'Other' NOT NULL,
	"thumb_url" text,
	"obs_rank" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "checklist_species_inat_taxon_id_unique" UNIQUE("inat_taxon_id")
);
--> statement-breakpoint
CREATE TABLE "sightings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"species_id" integer,
	"identified_name" text NOT NULL,
	"identified_scientific" text NOT NULL,
	"confidence" real,
	"match_level" text DEFAULT 'species' NOT NULL,
	"photo_url" text NOT NULL,
	"lat" real,
	"lng" real,
	"place_label" text,
	"observed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "sightings" ADD CONSTRAINT "sightings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sightings" ADD CONSTRAINT "sightings_species_id_checklist_species_id_fk" FOREIGN KEY ("species_id") REFERENCES "public"."checklist_species"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "checklist_species_scientific_idx" ON "checklist_species" USING btree ("scientific_name");--> statement-breakpoint
CREATE INDEX "checklist_species_group_idx" ON "checklist_species" USING btree ("taxon_group");--> statement-breakpoint
CREATE INDEX "sightings_user_idx" ON "sightings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sightings_user_species_idx" ON "sightings" USING btree ("user_id","species_id");