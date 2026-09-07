import { NextResponse } from "next/server";
import { getChecklist } from "@/lib/data";
import { getIdProvider } from "@/lib/id-provider";
import { matchCandidate } from "@/lib/checklist-match";
import { storePhoto } from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_BYTES = 12 * 1024 * 1024;

export async function POST(req: Request) {
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
  const contentType = photo.type || "image/jpeg";

  const [photoUrl, checklist] = await Promise.all([
    storePhoto(bytes, contentType),
    getChecklist(),
  ]);

  let candidates;
  try {
    const provider = getIdProvider();
    const raw = await provider.identify(bytes, {
      lat,
      lng,
      observedOn: new Date().toISOString().slice(0, 10),
    });
    candidates = raw.map((c) => {
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
  } catch (err) {
    console.error("identify failed:", err);
    return NextResponse.json(
      { error: "Identification service is unavailable right now.", photoUrl },
      { status: 502 },
    );
  }

  return NextResponse.json({ photoUrl, candidates });
}

function numeric(v: FormDataEntryValue | null | undefined): number | undefined {
  if (typeof v !== "string" || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}
