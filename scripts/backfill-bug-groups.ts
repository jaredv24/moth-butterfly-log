/**
 * One-off: fill in sightings.other_group for off-checklist bugs logged before
 * the grouping feature. Resolves each species' taxonomic order via GBIF's
 * name matcher, then applies lib/bug-groups. Idempotent (only touches rows
 * where other_group IS NULL).
 *
 * Run: DATABASE_URL=... npx tsx scripts/backfill-bug-groups.ts
 */
import "dotenv/config";
import { and, eq, isNull, like, or, sql } from "drizzle-orm";
import { db } from "../db";
import { sightings } from "../db/schema";
import { bugGroupFor } from "../lib/bug-groups";

async function orderFor(scientific: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.gbif.org/v1/species/match?name=${encodeURIComponent(scientific)}`,
    );
    if (!res.ok) return null;
    const j = (await res.json()) as { order?: string };
    return j.order ?? null;
  } catch {
    return null;
  }
}

async function main() {
  const rows = await db
    .select({ id: sightings.id, name: sightings.identifiedScientific })
    .from(sightings)
    .where(
      and(
        isNull(sightings.speciesId),
        or(
          isNull(sightings.otherGroup),
          like(sightings.otherGroup, "Other %"),
        ),
      ),
    );

  console.log(`${rows.length} off-list sightings to (re)group.`);

  const cache = new Map<string, string>();
  for (const row of rows) {
    let group = cache.get(row.name);
    if (!group) {
      group = bugGroupFor(await orderFor(row.name));
      cache.set(row.name, group);
      await new Promise((r) => setTimeout(r, 200));
    }
    await db
      .update(sightings)
      .set({ otherGroup: group })
      .where(eq(sightings.id, row.id));
    console.log(`  ${row.name} -> ${group}`);
  }

  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(sightings)
    .where(and(isNull(sightings.speciesId), isNull(sightings.otherGroup)));
  console.log(`Done. ${n} still without a group.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
