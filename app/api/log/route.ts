import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { sightings } from "@/db/schema";
import { isValidUserCode, normalizeUserCode } from "@/lib/code";
import { findUser, getChecklist, getSpeciesById, getUserLog } from "@/lib/data";
import { reverseGeocode } from "@/lib/geocode";
import { deletePhoto, storePhoto } from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_BYTES = 12 * 1024 * 1024;
const matchLevels = ["species", "genus", "off-list"] as const;

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

/** Create a sighting. Multipart: `photo` file + fields. Stores the photo now. */
export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "expected multipart form" }, { status: 400 });

  const photo = form.get("photo");
  if (!(photo instanceof File)) {
    return NextResponse.json({ error: "photo file is required" }, { status: 400 });
  }
  if (photo.size > MAX_BYTES) {
    return NextResponse.json({ error: "photo too large (max 12MB)" }, { status: 413 });
  }

  const fields = z
    .object({
      code: z.string(),
      name: z.string().min(1),
      scientificName: z.string().min(1),
      inatTaxonId: z.coerce.number().int().optional(),
      confidence: z.coerce.number().optional(),
      speciesId: z.coerce.number().int().optional(),
      matchLevel: z.enum(matchLevels).default("species"),
      lat: z.coerce.number().optional(),
      lng: z.coerce.number().optional(),
      observedAt: z.string().datetime().optional(),
    })
    .safeParse(Object.fromEntries(strings(form)));
  if (!fields.success) {
    return NextResponse.json(
      { error: "invalid fields", details: fields.error.flatten() },
      { status: 400 },
    );
  }
  const body = fields.data;

  const code = normalizeUserCode(body.code);
  if (!isValidUserCode(code)) {
    return NextResponse.json({ error: "invalid code" }, { status: 400 });
  }
  const user = await findUser(code);
  if (!user) return NextResponse.json({ error: "unknown code" }, { status: 404 });

  let speciesId: number | null = body.speciesId ?? null;
  if (speciesId != null && !(await getSpeciesById(speciesId))) speciesId = null;

  const placeLabel =
    body.lat != null && body.lng != null
      ? await reverseGeocode(body.lat, body.lng)
      : null;
  const observedAt = body.observedAt ? new Date(body.observedAt) : new Date();

  const priorLog = await getUserLog(user.id);
  const isNewSpecies =
    speciesId != null && !priorLog.some((e) => e.speciesId === speciesId);

  const photoUrl = await storePhoto(
    Buffer.from(await photo.arrayBuffer()),
    photo.type || "image/jpeg",
  );

  const [row] = await db
    .insert(sightings)
    .values({
      userId: user.id,
      speciesId,
      identifiedName: body.name,
      identifiedScientific: body.scientificName,
      confidence: body.confidence ?? null,
      matchLevel: body.matchLevel,
      photoUrl,
      lat: body.lat ?? null,
      lng: body.lng ?? null,
      placeLabel,
      observedAt,
    })
    .returning();

  return NextResponse.json({ sighting: row, isNewSpecies, placeLabel });
}

/** Re-identify an existing sighting (change the species). JSON body. */
export async function PATCH(req: Request) {
  const parsed = z
    .object({
      code: z.string(),
      sightingId: z.string().uuid(),
      speciesId: z.number().int(),
      name: z.string().min(1),
      scientificName: z.string().min(1),
    })
    .safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const { code: rawCode, sightingId, speciesId, name, scientificName } = parsed.data;

  const user = await requireOwner(rawCode, sightingId);
  if ("error" in user) return user.error;
  if (!(await getSpeciesById(speciesId))) {
    return NextResponse.json({ error: "unknown species" }, { status: 400 });
  }

  const [row] = await db
    .update(sightings)
    .set({ speciesId, identifiedName: name, identifiedScientific: scientificName, matchLevel: "species" })
    .where(eq(sightings.id, sightingId))
    .returning();
  return NextResponse.json({ sighting: row });
}

/** Delete a sighting and its photo. JSON body: { code, sightingId }. */
export async function DELETE(req: Request) {
  const parsed = z
    .object({ code: z.string(), sightingId: z.string().uuid() })
    .safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const owner = await requireOwner(parsed.data.code, parsed.data.sightingId);
  if ("error" in owner) return owner.error;

  await deletePhoto(owner.sighting.photoUrl);
  await db.delete(sightings).where(eq(sightings.id, parsed.data.sightingId));
  return NextResponse.json({ ok: true });
}

async function requireOwner(rawCode: string, sightingId: string) {
  const code = normalizeUserCode(rawCode);
  if (!isValidUserCode(code)) {
    return { error: NextResponse.json({ error: "invalid code" }, { status: 400 }) };
  }
  const user = await findUser(code);
  if (!user) {
    return { error: NextResponse.json({ error: "unknown code" }, { status: 404 }) };
  }
  const sighting = await db.query.sightings.findFirst({
    where: eq(sightings.id, sightingId),
  });
  if (!sighting || sighting.userId !== user.id) {
    return { error: NextResponse.json({ error: "not found" }, { status: 404 }) };
  }
  return { user, sighting };
}

function* strings(form: FormData): Generator<[string, string]> {
  for (const [k, v] of form.entries()) {
    if (typeof v === "string") yield [k, v];
  }
}
