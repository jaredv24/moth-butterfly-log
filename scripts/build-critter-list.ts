/**
 * Builds data/na-taxa.json — the set of animal species that actually occur in
 * the US + Canada. The BioCLIP identification service (bioclip/) restricts its
 * predictions to this set, so it can't confidently return a foreign lookalike
 * (e.g. an Asian frog for an American bullfrog).
 *
 * Source: the public iNaturalist API. We take the most-observed species in the
 * US + Canada across the animal groups the app cares about, then union in every
 * species already on the butterfly/moth checklist so those are always valid
 * targets.
 *
 * Run: npm run build:critter-list
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const INAT = "https://api.inaturalist.org/v1";
const PLACE_IDS = "1,6571"; // 1 = United States, 6571 = Canada
const ICONIC_TAXA = [
  "Insecta",
  "Arachnida",
  "Amphibia",
  "Reptilia",
  "Aves",
  "Mammalia",
  "Actinopterygii",
  "Mollusca",
].join(",");

const PAGES = 60; // 60 * 500 = up to 30k most-observed species scanned
const PER_PAGE = 500;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getJSON(url: string, attempt = 1): Promise<any> {
  const res = await fetch(url, {
    headers: { "User-Agent": "moth-butterfly-log/1.0 (critter-list builder)" },
  });
  if (res.status === 429 && attempt <= 5) {
    await sleep(2000 * attempt);
    return getJSON(url, attempt + 1);
  }
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.json();
}

async function main() {
  console.log("Fetching most-observed US + Canada animal species…");
  const names = new Set<string>();

  for (let page = 1; page <= PAGES; page++) {
    const url =
      `${INAT}/observations/species_counts?place_id=${PLACE_IDS}` +
      `&iconic_taxa=${ICONIC_TAXA}&quality_grade=research&hrank=species` +
      `&per_page=${PER_PAGE}&page=${page}`;
    const json = await getJSON(url);
    const results: { taxon: { name: string; rank: string } }[] =
      json.results ?? [];
    for (const r of results) {
      if (r.taxon?.rank === "species" && /^[A-Z][a-z]+ [a-z-]+$/.test(r.taxon.name)) {
        names.add(r.taxon.name);
      }
    }
    process.stdout.write(
      `  page ${page}/${PAGES} — ${results.length} rows (unique so far ${names.size})\n`,
    );
    if (results.length < PER_PAGE) break;
    await sleep(700);
  }

  // union in the butterfly/moth checklist so every checklist species is valid
  const checklist = JSON.parse(
    await readFile(path.join(process.cwd(), "data", "checklist.json"), "utf8"),
  ) as { species: { scientificName: string }[] };
  let added = 0;
  for (const s of checklist.species) {
    if (!names.has(s.scientificName)) {
      names.add(s.scientificName);
      added++;
    }
  }
  console.log(`Unioned ${added} checklist species not already present.`);

  const taxa = [...names].sort();
  const outPath = path.join(process.cwd(), "data", "na-taxa.json");
  await writeFile(
    outPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        source: "iNaturalist API — observations/species_counts, place 1,6571",
        count: taxa.length,
        taxa,
      },
      null,
      1,
    ),
  );
  console.log(`Wrote ${taxa.length} species → ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
