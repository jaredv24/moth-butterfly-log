/**
 * One-off: for off-checklist sightings logged before reference photos / iNat
 * links, fill in ref_photo_url, inat_taxon_id, and a common name (where the
 * stored "name" is just the scientific name). Resolves each species once via
 * the iNaturalist taxa API. Idempotent — only touches rows missing the data.
 *
 * Run: set -a && . ./.env.vercel-pull && set +a && npx tsx scripts/backfill-critter-details.ts
 */
import "dotenv/config";
import { eq, isNull, sql } from "drizzle-orm";
import { db } from "../db";
import { sightings } from "../db/schema";
import { resolveTaxa } from "../lib/inat-taxa";

async function main() {
  const rows = await db
    .select({
      id: sightings.id,
      name: sightings.identifiedName,
      scientific: sightings.identifiedScientific,
      refPhotoUrl: sightings.refPhotoUrl,
      inatTaxonId: sightings.inatTaxonId,
    })
    .from(sightings)
    .where(isNull(sightings.speciesId)); // off-checklist only

  const todo = rows.filter(
    (r) =>
      !r.refPhotoUrl ||
      r.inatTaxonId == null ||
      r.name.trim().toLowerCase() === r.scientific.trim().toLowerCase(),
  );
  console.log(`${todo.length} of ${rows.length} off-list sightings to backfill.`);

  const info = await resolveTaxa(todo.map((r) => r.scientific));

  let updated = 0;
  for (const r of todo) {
    const t = info.get(r.scientific.trim().toLowerCase());
    if (!t) continue;
    const set: Partial<typeof sightings.$inferInsert> = {};
    if (!r.refPhotoUrl && t.thumbUrl) set.refPhotoUrl = t.thumbUrl;
    if (r.inatTaxonId == null && t.inatTaxonId != null)
      set.inatTaxonId = t.inatTaxonId;
    if (
      t.commonName &&
      r.name.trim().toLowerCase() === r.scientific.trim().toLowerCase()
    )
      set.identifiedName = t.commonName;
    if (Object.keys(set).length === 0) continue;
    await db.update(sightings).set(set).where(eq(sightings.id, r.id));
    updated++;
    console.log(`  ${r.scientific} -> ${JSON.stringify(set)}`);
  }

  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(sightings)
    .where(isNull(sightings.speciesId));
  console.log(`Done. Updated ${updated}. (${n} off-list sightings total.)`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
