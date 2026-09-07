import { NextResponse } from "next/server";
import { getChecklist } from "@/lib/data";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const LEPIDOPTERA = 47157;
const RADIUS_KM = 50;
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// tiny in-memory cache: key = rounded lat,lng,month
const cache = new Map<string, { at: number; body: unknown }>();
const TTL = 60 * 60 * 1000;

export async function GET(req: Request) {
  const rl = await rateLimit("nearby", clientIp(req), 60, 3600);
  if (!rl.ok) return NextResponse.json({ error: "Too many requests." }, { status: 429 });

  const sp = new URL(req.url).searchParams;
  const lat = Number(sp.get("lat"));
  const lng = Number(sp.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "lat and lng required" }, { status: 400 });
  }

  const month = new Date().getMonth() + 1;
  const key = `${lat.toFixed(2)},${lng.toFixed(2)},${month}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return NextResponse.json(hit.body);

  const monthWindow = [((month + 10) % 12) + 1, month, (month % 12) + 1].join(",");
  const url =
    `https://api.inaturalist.org/v1/observations/species_counts` +
    `?lat=${lat}&lng=${lng}&radius=${RADIUS_KM}&taxon_id=${LEPIDOPTERA}` +
    `&month=${monthWindow}&quality_grade=research&hrank=species&per_page=200`;

  let counts: { taxonId: number; count: number }[] = [];
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "moth-butterfly-log/1.0" },
    });
    if (res.ok) {
      const json = (await res.json()) as {
        results?: { count: number; taxon: { id: number } }[];
      };
      counts = (json.results ?? []).map((r) => ({ taxonId: r.taxon.id, count: r.count }));
    }
  } catch {
    /* fall through with empty list */
  }

  const checklist = await getChecklist();
  const byTaxon = new Map(checklist.map((s) => [s.inatTaxonId, s]));
  const species = counts
    .map((c) => {
      const s = byTaxon.get(c.taxonId);
      return s ? { s, count: c.count } : null;
    })
    .filter((x): x is { s: (typeof checklist)[number]; count: number } => x != null)
    .map(({ s, count }) => ({
      id: s.id,
      inatTaxonId: s.inatTaxonId,
      commonName: s.commonName,
      scientificName: s.scientificName,
      group: s.taxonGroup,
      family: s.family,
      thumbUrl: s.thumbUrl,
      nearbyCount: count,
    }));

  const body = { month, monthName: MONTHS[month - 1], radiusKm: RADIUS_KM, species };
  cache.set(key, { at: Date.now(), body });
  return NextResponse.json(body);
}
