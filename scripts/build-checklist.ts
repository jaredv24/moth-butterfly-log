/**
 * Builds data/checklist.json — the master list of North American moths and
 * butterflies the app checks sightings off against.
 *
 * Source: the public iNaturalist API (no auth). We pull the most-observed
 * Lepidoptera species recorded in the US + Canada, keep butterflies (superfamily
 * Papilionoidea, taxon 47224) that clear a modest observation threshold plus the
 * most commonly observed moths, then enrich each with its family name.
 *
 * Scope is US + Canada (not the "North America" continent, which folds in
 * Mexico and ~1,000 rare tropical strays).
 *
 * Run: npm run build:checklist
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";

const INAT = "https://api.inaturalist.org/v1";
const PLACE_IDS = "1,6571"; // 1 = United States, 6571 = Canada
const LEPIDOPTERA = 47157;
const PAPILIONOIDEA = 47224; // butterflies (incl. skippers under modern taxonomy)

const PAGES = 16; // 16 * 500 = 8000 most-observed species scanned
const PER_PAGE = 500;
const MAX_MOTHS = 900;
const MIN_BUTTERFLY_COUNT = 3;

type SpeciesCount = {
  count: number;
  taxon: {
    id: number;
    name: string;
    rank: string;
    ancestor_ids: number[];
    preferred_common_name?: string;
    default_photo?: { square_url?: string } | null;
  };
};

type ChecklistSpecies = {
  inatTaxonId: number;
  commonName: string;
  scientificName: string;
  group: "butterfly" | "moth";
  family: string;
  thumbUrl: string | null;
  obsRank: number;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getJSON(url: string, attempt = 1): Promise<any> {
  const res = await fetch(url, {
    headers: { "User-Agent": "moth-butterfly-log/1.0 (checklist builder)" },
  });
  if (res.status === 429 && attempt <= 5) {
    await sleep(2000 * attempt);
    return getJSON(url, attempt + 1);
  }
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.json();
}

async function fetchSpeciesCounts(): Promise<SpeciesCount[]> {
  const all: SpeciesCount[] = [];
  for (let page = 1; page <= PAGES; page++) {
    const url =
      `${INAT}/observations/species_counts?place_id=${PLACE_IDS}` +
      `&taxon_id=${LEPIDOPTERA}&quality_grade=research&hrank=species` +
      `&per_page=${PER_PAGE}&page=${page}`;
    const json = await getJSON(url);
    const results: SpeciesCount[] = json.results ?? [];
    all.push(...results);
    process.stdout.write(
      `  page ${page}/${PAGES} — ${results.length} rows (total ${all.length})\n`,
    );
    if (results.length < PER_PAGE) break;
    await sleep(700);
  }
  return all;
}

/** Look up family names for a batch of taxon ids via /taxa/{ids}. */
async function fetchFamilies(ids: number[]): Promise<Map<number, string>> {
  const out = new Map<number, string>();
  for (let i = 0; i < ids.length; i += 30) {
    const batch = ids.slice(i, i + 30);
    const json = await getJSON(`${INAT}/taxa/${batch.join(",")}`);
    for (const taxon of json.results ?? []) {
      const fam = (taxon.ancestors ?? []).find(
        (a: { rank: string; name: string }) => a.rank === "family",
      );
      out.set(taxon.id, fam?.name ?? "Other");
    }
    process.stdout.write(
      `  families ${Math.min(i + 30, ids.length)}/${ids.length}\n`,
    );
    await sleep(700);
  }
  return out;
}

async function main() {
  console.log("Fetching North American Lepidoptera species counts…");
  const counts = await fetchSpeciesCounts();

  // Dedupe by taxon id, remember best (highest) observation count + rank order.
  const seen = new Map<number, { row: SpeciesCount; rank: number }>();
  counts.forEach((row, idx) => {
    if (row.taxon.rank !== "species") return;
    if (!seen.has(row.taxon.id)) seen.set(row.taxon.id, { row, rank: idx });
  });

  const butterflies: SpeciesCount[] = [];
  const moths: SpeciesCount[] = [];
  for (const { row } of seen.values()) {
    const isButterfly = row.taxon.ancestor_ids.includes(PAPILIONOIDEA);
    if (isButterfly) {
      if (row.count >= MIN_BUTTERFLY_COUNT) butterflies.push(row);
    } else {
      moths.push(row);
    }
  }
  moths.sort((a, b) => b.count - a.count);
  const keptMoths = moths.slice(0, MAX_MOTHS);

  console.log(
    `Kept ${butterflies.length} butterflies + ${keptMoths.length} moths.`,
  );

  const kept = [...butterflies, ...keptMoths];
  console.log("Resolving family names…");
  const families = await fetchFamilies(kept.map((r) => r.taxon.id));

  const species: ChecklistSpecies[] = kept
    .map((row) => ({
      inatTaxonId: row.taxon.id,
      commonName:
        row.taxon.preferred_common_name ?? row.taxon.name,
      scientificName: row.taxon.name,
      group: (row.taxon.ancestor_ids.includes(PAPILIONOIDEA)
        ? "butterfly"
        : "moth") as "butterfly" | "moth",
      family: families.get(row.taxon.id) ?? "Other",
      thumbUrl: row.taxon.default_photo?.square_url ?? null,
      obsRank: row.count,
    }))
    .sort((a, b) => {
      if (a.group !== b.group) return a.group === "butterfly" ? -1 : 1;
      if (a.family !== b.family) return a.family.localeCompare(b.family);
      return a.commonName.localeCompare(b.commonName);
    });

  const outPath = path.join(process.cwd(), "data", "checklist.json");
  await writeFile(
    outPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        source: "iNaturalist API — observations/species_counts, place 97394",
        count: species.length,
        species,
      },
      null,
      2,
    ),
  );
  console.log(`Wrote ${species.length} species → ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
