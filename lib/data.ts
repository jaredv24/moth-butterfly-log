import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { checklistSpecies, sightings, users } from "@/db/schema";
import { generateUserCode } from "./code";

export async function getOrCreateUser(
  code?: string,
): Promise<{ id: string; code: string; created: boolean }> {
  if (code) {
    const existing = await db.query.users.findFirst({
      where: eq(users.code, code),
    });
    if (existing) return { ...existing, created: false };
    const [row] = await db.insert(users).values({ code }).returning();
    return { ...row, created: true };
  }

  // generate, retrying on the (astronomically unlikely) collision
  for (let i = 0; i < 5; i++) {
    const fresh = generateUserCode();
    const clash = await db.query.users.findFirst({
      where: eq(users.code, fresh),
    });
    if (clash) continue;
    const [row] = await db.insert(users).values({ code: fresh }).returning();
    return { ...row, created: true };
  }
  throw new Error("could not generate a unique user code");
}

export async function findUser(code: string) {
  return db.query.users.findFirst({ where: eq(users.code, code) });
}

let checklistCache: (typeof checklistSpecies.$inferSelect)[] | null = null;

export async function getChecklist() {
  if (checklistCache) return checklistCache;
  const rows = await db
    .select()
    .from(checklistSpecies)
    .orderBy(
      asc(checklistSpecies.taxonGroup),
      asc(checklistSpecies.family),
      asc(checklistSpecies.commonName),
    );
  checklistCache = rows;
  return rows;
}

export type LogEntry = {
  id: string;
  speciesId: number | null;
  identifiedName: string;
  identifiedScientific: string;
  confidence: number | null;
  matchLevel: string;
  photoUrl: string;
  placeLabel: string | null;
  lat: number | null;
  lng: number | null;
  observedAt: string;
};

export async function getUserLog(userId: string): Promise<LogEntry[]> {
  const rows = await db
    .select()
    .from(sightings)
    .where(eq(sightings.userId, userId))
    .orderBy(asc(sightings.observedAt));
  return rows.map((r) => ({
    id: r.id,
    speciesId: r.speciesId,
    identifiedName: r.identifiedName,
    identifiedScientific: r.identifiedScientific,
    confidence: r.confidence,
    matchLevel: r.matchLevel,
    photoUrl: r.photoUrl,
    placeLabel: r.placeLabel,
    lat: r.lat,
    lng: r.lng,
    observedAt: r.observedAt.toISOString(),
  }));
}

export async function getSpeciesById(id: number) {
  return db.query.checklistSpecies.findFirst({
    where: eq(checklistSpecies.id, id),
  });
}

export { and, eq };
