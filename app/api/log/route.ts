import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { sightings } from "@/db/schema";
import { isValidUserCode, normalizeUserCode } from "@/lib/code";
import { findUser, getChecklist, getSpeciesById, getUserLog } from "@/lib/data";
import { reverseGeocode } from "@/lib/geocode";

export const runtime = "nodejs";

const postSchema = z.object({
  code: z.string(),
  photoUrl: z.string().min(1),
  name: z.string().min(1),
  scientificName: z.string().min(1),
  inatTaxonId: z.number().int().nullable().optional(),
  confidence: z.number().nullable().optional(),
  speciesId: z.number().int().nullable().optional(),
  matchLevel: z.enum(["species", "genus", "off-list"]).default("species"),
  lat: z.number().nullable().optional(),
  lng: z.number().nullable().optional(),
  observedAt: z.string().datetime().optional(),
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = normalizeUserCode(url.searchParams.get("code") ?? "");
  if (!isValidUserCode(code)) {
    return NextResponse.json({ error: "valid ?code= is required" }, { status: 400 });
  }
  const user = await findUser(code);
  if (!user) return NextResponse.json({ error: "unknown code" }, { status: 404 });

  const [log, checklist] = await Promise.all([getUserLog(user.id), getChecklist()]);
  const totals = checklist.reduce(
    (acc, s) => {
      if (s.taxonGroup === "butterfly") acc.totalButterflies++;
      else acc.totalMoths++;
      return acc;
    },
    { totalButterflies: 0, totalMoths: 0 },
  );

  const seen = new Set(log.filter((e) => e.speciesId != null).map((e) => e.speciesId));
  const seenGroups = { butterfliesSeen: 0, mothsSeen: 0 };
  for (const s of checklist) {
    if (!seen.has(s.id)) continue;
    if (s.taxonGroup === "butterfly") seenGroups.butterfliesSeen++;
    else seenGroups.mothsSeen++;
  }

  return NextResponse.json({ log, stats: { ...totals, ...seenGroups } });
}

export async function POST(req: Request) {
  const parsed = postSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const body = parsed.data;
  const code = normalizeUserCode(body.code);
  if (!isValidUserCode(code)) {
    return NextResponse.json({ error: "invalid code" }, { status: 400 });
  }
  const user = await findUser(code);
  if (!user) return NextResponse.json({ error: "unknown code" }, { status: 404 });

  // Validate speciesId if supplied.
  let speciesId: number | null = body.speciesId ?? null;
  if (speciesId != null) {
    const species = await getSpeciesById(speciesId);
    if (!species) speciesId = null;
  }

  const placeLabel =
    body.lat != null && body.lng != null
      ? await reverseGeocode(body.lat, body.lng)
      : null;

  const observedAt = body.observedAt ? new Date(body.observedAt) : new Date();

  // Was this species already on the user's life list?
  const priorLog = await getUserLog(user.id);
  const isNewSpecies =
    speciesId != null && !priorLog.some((e) => e.speciesId === speciesId);

  const [row] = await db
    .insert(sightings)
    .values({
      userId: user.id,
      speciesId,
      identifiedName: body.name,
      identifiedScientific: body.scientificName,
      confidence: body.confidence ?? null,
      matchLevel: body.matchLevel,
      photoUrl: body.photoUrl,
      lat: body.lat ?? null,
      lng: body.lng ?? null,
      placeLabel,
      observedAt,
    })
    .returning();

  return NextResponse.json({ sighting: row, isNewSpecies, placeLabel });
}
