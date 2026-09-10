import { NextResponse } from "next/server";
import { getChecklist } from "@/lib/data";
import { getIdProvider } from "@/lib/id-provider";
import { bugGroupFor } from "@/lib/bug-groups";
import { matchCandidate } from "@/lib/checklist-match";
import { resolveTaxa } from "@/lib/inat-taxa";
import { assessPlausibility } from "@/lib/plausibility";
import { reverseGeocode } from "@/lib/geocode";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_BYTES = 12 * 1024 * 1024;

/**
 * Identify a photo. The photo is NOT stored here — it is only sent to the
 * identification provider. It is persisted later by /api/log, once the user
 * confirms a species, so abandoned identifications leave nothing behind.
 */
export async function POST(req: Request) {
  const limit = await rateLimit("identify", clientIp(req), 60, 3600);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many identifications in the last hour. Try again later." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } },
    );
  }

  const form = await req.formData().catch(() => null);
  const photo = form?.get("photo");
  if (!(photo instanceof File)) {
    return NextResponse.json({ error: "photo file is required" }, { status: 400 });
  }
  if (photo.size > MAX_BYTES) {
    return NextResponse.json({ error: "photo too large (max 12MB)" }, { status: 413 });
  }

  const lat = numeric(form?.get("lat"));
  const lng = numeric(form?.get("lng"));
  const observedAt = str(form?.get("observedAt"));
  const observedDate = observedAt ? new Date(observedAt) : new Date();
  const bytes = Buffer.from(await photo.arrayBuffer());
  const [checklist, placeLabel] = await Promise.all([
    getChecklist(),
    lat != null && lng != null ? reverseGeocode(lat, lng) : Promise.resolve(null),
  ]);

  try {
    const provider = getIdProvider();
    const { candidates: raw, croppedImage } = await provider.identify(bytes, {
      lat,
      lng,
      observedOn: observedDate.toISOString().slice(0, 10),
    });

    const mapped = raw.map((c) => {
      const m = matchCandidate(c, checklist);
      const offList = m.species == null;
      return {
        name: c.name,
        scientificName: c.scientificName,
        inatTaxonId: m.species?.inatTaxonId ?? c.inatTaxonId ?? null,
        confidence: c.confidence,
        // for off-checklist critters: the provider's photo + a friendly group label
        otherGroup: offList ? bugGroupFor(c.order, c.taxonClass) : null,
        match: {
          speciesId: m.species?.id ?? null,
          matchLevel: m.matchLevel,
          commonName: m.species?.commonName ?? c.name,
          scientificName: m.species?.scientificName ?? c.scientificName,
          group: m.species?.taxonGroup ?? null,
          family: m.species?.family ?? null,
          thumbUrl: m.species?.thumbUrl ?? (offList ? c.imageUrl ?? null : null),
        },
        plausibility: null as { verdict: string; note: string } | null,
      };
    });

    // Collapse candidates that resolve to the same species (e.g. several
    // same-genus guesses that all genus-match one checklist entry), pooling
    // their confidence, then drop the long tail of near-zero guesses.
    type Cand = (typeof mapped)[number];
    const byIdentity = new Map<string, Cand>();
    for (const c of mapped) {
      const key =
        c.match.speciesId != null
          ? `sp:${c.match.speciesId}`
          : `sci:${c.scientificName.toLowerCase()}`;
      const existing = byIdentity.get(key);
      if (existing) {
        existing.confidence = Math.min(0.99, existing.confidence + c.confidence);
      } else {
        byIdentity.set(key, { ...c });
      }
    }
    const pooled = [...byIdentity.values()].sort(
      (a, b) => b.confidence - a.confidence,
    );
    const top = pooled[0]?.confidence ?? 0;
    let candidates = pooled
      .filter(
        (c, i) => i === 0 || (c.confidence >= 0.04 && c.confidence >= top * 0.15),
      )
      .slice(0, 5);

    // Off-checklist critters (turtles, frogs, …) come from the provider with no
    // reference photo, and sometimes no common name. Fill both from iNaturalist,
    // and grab the real taxon id while we're there (tightens plausibility too).
    const needsLookup = candidates.filter(
      (c) =>
        c.match.thumbUrl == null ||
        c.inatTaxonId == null ||
        c.name.toLowerCase() === c.scientificName.toLowerCase(),
    );
    if (needsLookup.length > 0) {
      try {
        const taxa = await resolveTaxa(needsLookup.map((c) => c.scientificName));
        for (const c of candidates) {
          const info = taxa.get(c.scientificName.trim().toLowerCase());
          if (!info) continue;
          if (c.match.thumbUrl == null && info.thumbUrl) {
            c.match.thumbUrl = info.thumbUrl;
          }
          if (c.inatTaxonId == null && info.inatTaxonId != null) {
            c.inatTaxonId = info.inatTaxonId;
          }
          // no common name from the provider → use iNaturalist's
          if (
            info.commonName &&
            c.name.toLowerCase() === c.scientificName.toLowerCase()
          ) {
            c.name = info.commonName;
            if (c.match.speciesId == null) c.match.commonName = info.commonName;
          }
        }
      } catch {
        /* enrichment is a nice-to-have */
      }
    }

    // Location-aware sanity check: how often is each candidate actually
    // recorded near here, this month? Annotates + re-ranks gently. Fails soft.
    if (lat != null && lng != null && candidates.length > 0) {
      try {
        const scores = await assessPlausibility(
          candidates.map((c, i) => ({
            key: String(i),
            inatTaxonId: c.inatTaxonId,
            scientificName: c.scientificName,
          })),
          lat,
          lng,
          observedDate.getMonth() + 1,
        );
        candidates = candidates
          .map((c, i) => ({ c, p: scores.get(String(i)) }))
          .sort(
            (a, b) =>
              b.c.confidence * (b.p?.weight ?? 1) -
              a.c.confidence * (a.p?.weight ?? 1),
          )
          .map(({ c, p }) => ({
            ...c,
            plausibility: p?.note ? { verdict: p.verdict, note: p.note } : null,
          }));
      } catch (err) {
        console.error("plausibility check failed (ignored):", err);
      }
    }

    return NextResponse.json({
      candidates,
      placeLabel,
      observedAt: observedDate.toISOString(),
      croppedPhoto: croppedImage
        ? `data:image/jpeg;base64,${croppedImage.toString("base64")}`
        : null,
    });
  } catch (err) {
    console.error("identify failed:", err);
    return NextResponse.json(
      { error: "Identification service is unavailable right now." },
      { status: 502 },
    );
  }
}

function numeric(v: FormDataEntryValue | null | undefined): number | undefined {
  if (typeof v !== "string" || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function str(v: FormDataEntryValue | null | undefined): string | null {
  return typeof v === "string" && v ? v : null;
}
