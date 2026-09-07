const INAT = "https://api.inaturalist.org/v1";
const RADIUS_KM = 75;

export type Verdict = "expected" | "possible" | "unusual" | "out-of-area" | "unknown";

export type Plausibility = {
  verdict: Verdict;
  note: string;
  /** Multiplier applied to the raw confidence when re-ranking. */
  weight: number;
};

type Item = { key: string; inatTaxonId?: number | null; scientificName: string };

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** month window m-1 .. m+1, wrapped to 1-12 */
function seasonMonths(month: number): string {
  return [((month + 10) % 12) + 1, month, (month % 12) + 1].join(",");
}

async function obsCount(
  params: Record<string, string>,
  attempt = 1,
): Promise<number | null> {
  const qs = new URLSearchParams({ ...params, verifiable: "true", per_page: "0" });
  try {
    const res = await fetch(`${INAT}/observations?${qs}`, {
      signal: AbortSignal.timeout(7000),
      headers: { "User-Agent": "moth-butterfly-log/1.0 (github.com/jaredv24/moth-butterfly-log)" },
    });
    if (res.status === 429 && attempt <= 2) {
      await new Promise((r) => setTimeout(r, 500 * attempt));
      return obsCount(params, attempt + 1);
    }
    if (!res.ok) return null;
    const json = (await res.json()) as { total_results?: number };
    return json.total_results ?? null;
  } catch {
    return null;
  }
}

function verdictFor(region: number | null, season: number | null, monthName: string): Plausibility {
  if (region == null) return { verdict: "unknown", note: "", weight: 1 };
  if (region === 0) {
    return {
      verdict: "out-of-area",
      note: `No records within ${RADIUS_KM} km — double-check`,
      weight: 0.55,
    };
  }
  if (season != null && season === 0) {
    return {
      verdict: "unusual",
      note: `Recorded in this area, but rarely around ${monthName}`,
      weight: 0.75,
    };
  }
  if (season != null && season < 5) {
    return { verdict: "possible", note: `A few ${monthName} records near here`, weight: 1 };
  }
  return { verdict: "expected", note: `Regularly seen here in ${monthName}`, weight: 1.12 };
}

/**
 * For each candidate, check iNaturalist for how often that species is actually
 * recorded near (lat,lng) and in the sighting's month. Read-only, free, and
 * fails soft — a candidate with no answer just gets verdict "unknown".
 */
export async function assessPlausibility(
  items: Item[],
  lat: number,
  lng: number,
  month: number,
): Promise<Map<string, Plausibility>> {
  const monthName = MONTHS[month - 1] ?? "this time of year";
  const loc = { lat: String(lat), lng: String(lng), radius: String(RADIUS_KM) };

  const entries = await Promise.all(
    items.map(async (it) => {
      // Prefer the taxon id; fall back to the scientific name if the id is
      // unknown to iNaturalist (Kindwise and iNat taxonomies can differ).
      let taxon: Record<string, string> | null = it.inatTaxonId
        ? { taxon_id: String(it.inatTaxonId) }
        : it.scientificName
          ? { taxon_name: it.scientificName }
          : null;
      if (!taxon) return [it.key, verdictFor(null, null, monthName)] as const;

      let region = await obsCount({ ...loc, ...taxon });
      if (region == null && "taxon_id" in taxon && it.scientificName) {
        taxon = { taxon_name: it.scientificName };
        region = await obsCount({ ...loc, ...taxon });
      }
      const season =
        region && region > 0
          ? await obsCount({ ...loc, ...taxon, month: seasonMonths(month) })
          : null;
      return [it.key, verdictFor(region, season, monthName)] as const;
    }),
  );

  return new Map(entries);
}
