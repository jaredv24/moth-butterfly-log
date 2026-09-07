import { NextResponse } from "next/server";
import { getChecklist } from "@/lib/data";
import { getIdProvider } from "@/lib/id-provider";
import { matchCandidate } from "@/lib/checklist-match";
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
  const limit = await rateLimit("identify", clientIp(req), 40, 3600);
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
  const bytes = Buffer.from(await photo.arrayBuffer());
  const checklist = await getChecklist();

  try {
    const provider = getIdProvider();
    const raw = await provider.identify(bytes, {
      lat,
      lng,
      observedOn: new Date().toISOString().slice(0, 10),
    });
    const candidates = raw.map((c) => {
      const m = matchCandidate(c, checklist);
      return {
        name: c.name,
        scientificName: c.scientificName,
        inatTaxonId: c.inatTaxonId ?? null,
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
      };
    });
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
