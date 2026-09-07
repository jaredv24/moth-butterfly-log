import { NextResponse } from "next/server";
import { getChecklist } from "@/lib/data";
import { getIdProvider } from "@/lib/id-provider";
import { matchCandidate } from "@/lib/checklist-match";
import { assessPlausibility } from "@/lib/plausibility";
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
  const checklist = await getChecklist();

  try {
    const provider = getIdProvider();
    const raw = await provider.identify(bytes, {
      lat,
      lng,
      observedOn: observedDate.toISOString().slice(0, 10),
    });

    let candidates = raw.map((c) => {
      const m = matchCandidate(c, checklist);
      return {
        name: c.name,
        scientificName: c.scientificName,
        inatTaxonId: m.species?.inatTaxonId ?? c.inatTaxonId ?? null,
        confidence: c.confidence,
        match: {
          speciesId: m.species?.id ?? null,
          matchLevel: m.matchLevel,
          commonName: m.species?.commonName ?? c.name,
          scientificName: m.species?.scientificName ?? c.scientificName,
          group: m.species?.taxonGroup ?? null,
          family: m.species?.family ?? null,
          thumbUrl: m.species?.thumbUrl ?? null,
        },
        plausibility: null as { verdict: string; note: string } | null,
      };
    });

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

    return NextResponse.json({ candidates });
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
