import "dotenv/config";
import { sql } from "drizzle-orm";
import checklist from "../data/checklist.json";
import { db } from "./index";
import { checklistSpecies } from "./schema";

type Row = (typeof checklist.species)[number];

async function main() {
  const rows = checklist.species as Row[];
  console.log(`Seeding ${rows.length} checklist species…`);

  const batchSize = 500;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize).map((r) => ({
      inatTaxonId: r.inatTaxonId,
      commonName: r.commonName,
      scientificName: r.scientificName,
      taxonGroup: r.group as "butterfly" | "moth",
      family: r.family,
      thumbUrl: r.thumbUrl,
      obsRank: r.obsRank ?? 0,
    }));
    await db
      .insert(checklistSpecies)
      .values(batch)
      .onConflictDoUpdate({
        target: checklistSpecies.inatTaxonId,
        set: {
          commonName: sql`excluded.common_name`,
          scientificName: sql`excluded.scientific_name`,
          taxonGroup: sql`excluded.taxon_group`,
          family: sql`excluded.family`,
          thumbUrl: sql`excluded.thumb_url`,
          obsRank: sql`excluded.obs_rank`,
        },
      });
    console.log(`  ${Math.min(i + batchSize, rows.length)}/${rows.length}`);
  }

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(checklistSpecies);
  console.log(`Done. checklist_species now has ${count} rows.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
