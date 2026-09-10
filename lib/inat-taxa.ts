const INAT = "https://api.inaturalist.org/v1";
const UA = "moth-butterfly-log/1.0 (github.com/jaredv24/moth-butterfly-log)";

export type TaxonInfo = {
  inatTaxonId: number | null;
  thumbUrl: string | null;
  commonName: string | null;
};

// Module-level cache — survives across requests within a warm serverless
// instance. Species names repeat a lot, so this saves most of the lookups.
const cache = new Map<string, TaxonInfo>();

async function lookup(name: string): Promise<TaxonInfo> {
  const key = name.trim().toLowerCase();
  const hit = cache.get(key);
  if (hit) return hit;

  const empty: TaxonInfo = {
    inatTaxonId: null,
    thumbUrl: null,
    commonName: null,
  };
  try {
    const qs = new URLSearchParams({
      q: name,
      rank: "species",
      per_page: "5",
      is_active: "true",
    });
    const res = await fetch(`${INAT}/taxa?${qs}`, {
      signal: AbortSignal.timeout(5000),
      headers: { "User-Agent": UA },
    });
    if (!res.ok) return empty;
    const json = (await res.json()) as {
      results?: {
        id: number;
        name: string;
        preferred_common_name?: string | null;
        default_photo?: { square_url?: string; medium_url?: string } | null;
      }[];
    };
    const results = json.results ?? [];
    const match =
      results.find((r) => r.name.toLowerCase() === key) ?? results[0];
    if (!match) return empty;
    const info: TaxonInfo = {
      inatTaxonId: match.id,
      thumbUrl:
        match.default_photo?.square_url ??
        match.default_photo?.medium_url ??
        null,
      commonName: match.preferred_common_name?.trim() || null,
    };
    cache.set(key, info);
    return info;
  } catch {
    return empty;
  }
}

/** Resolve iNaturalist taxon id + a reference photo for a set of species names. */
export async function resolveTaxa(
  names: string[],
): Promise<Map<string, TaxonInfo>> {
  const unique = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  const entries = await Promise.all(
    unique.map(async (n) => [n.toLowerCase(), await lookup(n)] as const),
  );
  return new Map(entries);
}
