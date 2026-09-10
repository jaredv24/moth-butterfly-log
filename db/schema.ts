import {
  boolean,
  index,
  integer,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/** A logbook owner. Identified only by an auto-generated code (no password). */
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  // profile name for friends — not unique, not used for login
  username: text("username"),
  // optional short nickname, shown in parens after the profile name
  nickname: text("nickname"),
  avatarUrl: text("avatar_url"),
  // shareable read-only follow code, minted on first use
  friendCode: text("friend_code").unique(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  // bumped every time the app loads for this user (for the friends "active" label)
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  // optional — only checked when adopting the code on a new device
  passwordHash: text("password_hash"),
  // iNaturalist connection (optional, opt-in)
  inatAccessToken: text("inat_access_token"), // AES-GCM encrypted
  inatUsername: text("inat_username"),
  inatSyncEnabled: boolean("inat_sync_enabled").notNull().default(false),
  inatConnectedAt: timestamp("inat_connected_at", { withTimezone: true }),
});

/** The master North American checklist. Seeded from data/checklist.json. */
export const checklistSpecies = pgTable(
  "checklist_species",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    inatTaxonId: integer("inat_taxon_id").notNull().unique(),
    commonName: text("common_name").notNull(),
    scientificName: text("scientific_name").notNull(),
    taxonGroup: text("taxon_group", { enum: ["butterfly", "moth"] }).notNull(),
    family: text("family").notNull().default("Other"),
    thumbUrl: text("thumb_url"),
    obsRank: integer("obs_rank").notNull().default(0),
  },
  (t) => [
    index("checklist_species_scientific_idx").on(t.scientificName),
    index("checklist_species_group_idx").on(t.taxonGroup),
  ],
);

/** One logged sighting. */
export const sightings = pgTable(
  "sightings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // null => identified species is not on the North American checklist
    speciesId: integer("species_id").references(() => checklistSpecies.id),
    identifiedName: text("identified_name").notNull(),
    identifiedScientific: text("identified_scientific").notNull(),
    confidence: real("confidence"),
    matchLevel: text("match_level", {
      enum: ["species", "genus", "off-list"],
    })
      .notNull()
      .default("species"),
    photoUrl: text("photo_url").notNull(),
    lat: real("lat"),
    lng: real("lng"),
    placeLabel: text("place_label"),
    observedAt: timestamp("observed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    // set once this sighting has been posted to iNaturalist
    inatObservationId: integer("inat_observation_id"),
    inatSyncError: text("inat_sync_error"),
    // iNaturalist taxon id at ID time (mainly for off-checklist critters — on-list
    // species get it from the checklist)
    inatTaxonId: integer("inat_taxon_id"),
    // a stock reference photo of the species (off-checklist critters; on-list
    // species use the checklist thumb)
    refPhotoUrl: text("ref_photo_url"),
    // friendly group for off-checklist bugs, e.g. "Beetles" (null for moths/butterflies)
    otherGroup: text("other_group"),
  },
  (t) => [
    index("sightings_user_idx").on(t.userId),
    index("sightings_user_species_idx").on(t.userId, t.speciesId),
  ],
);

/** Sliding-window rate limiting: one row per request, pruned as it goes. */
export const rateHits = pgTable(
  "rate_hits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bucket: text("bucket").notNull(), // e.g. "identify:203.0.113.4"
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("rate_hits_bucket_at_idx").on(t.bucket, t.at)],
);

/** `owner` follows `friend` and can view their log read-only. One-directional. */
export const friendships = pgTable(
  "friendships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    friendUserId: uuid("friend_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    nickname: text("nickname"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("friendships_pair_idx").on(t.ownerUserId, t.friendUserId),
    index("friendships_owner_idx").on(t.ownerUserId),
  ],
);

/** A direct message between two users. Only exchanged between mutual follows. */
export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    senderUserId: uuid("sender_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    recipientUserId: uuid("recipient_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // free text (optional when a sighting is attached)
    body: text("body"),
    // an attached sighting the sender shared (belongs to the sender)
    sightingId: uuid("sighting_id").references(() => sightings.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    readAt: timestamp("read_at", { withTimezone: true }),
  },
  (t) => [
    index("messages_pair_idx").on(
      t.senderUserId,
      t.recipientUserId,
      t.createdAt,
    ),
    index("messages_unread_idx").on(t.recipientUserId, t.readAt),
  ],
);

/** A Web Push subscription for one browser/device of a user. */
export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull().unique(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("push_subscriptions_user_idx").on(t.userId)],
);

export type User = typeof users.$inferSelect;
export type ChecklistSpecies = typeof checklistSpecies.$inferSelect;
export type Sighting = typeof sightings.$inferSelect;
export type Message = typeof messages.$inferSelect;
