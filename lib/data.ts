import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { checklistSpecies, friendships, sightings, users } from "@/db/schema";
import { generateFriendCode, generateUserCode } from "./code";

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

export async function findUserByFriendCode(friendCode: string) {
  return db.query.users.findFirst({
    where: eq(users.friendCode, friendCode),
  });
}

/** Mint the user's shareable follow code on first use. */
export async function getOrCreateFriendCode(userId: string): Promise<string> {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (user?.friendCode) return user.friendCode;
  for (let i = 0; i < 5; i++) {
    const fresh = generateFriendCode();
    const clash = await db.query.users.findFirst({
      where: eq(users.friendCode, fresh),
    });
    if (clash) continue;
    await db.update(users).set({ friendCode: fresh }).where(eq(users.id, userId));
    return fresh;
  }
  throw new Error("could not generate a unique friend code");
}

/** User ids that both follow `userId` and are followed by `userId`. */
export async function listMutualIds(userId: string): Promise<string[]> {
  const iFollow = await db
    .select({ id: friendships.friendUserId })
    .from(friendships)
    .where(eq(friendships.ownerUserId, userId));
  if (!iFollow.length) return [];
  const ids = iFollow.map((r) => r.id);
  const back = await db
    .select({ id: friendships.ownerUserId })
    .from(friendships)
    .where(
      and(
        eq(friendships.friendUserId, userId),
        inArray(friendships.ownerUserId, ids),
      ),
    );
  return back.map((r) => r.id);
}

export async function areMutual(a: string, b: string): Promise<boolean> {
  const links = await db
    .select({
      owner: friendships.ownerUserId,
      friend: friendships.friendUserId,
    })
    .from(friendships)
    .where(
      and(
        inArray(friendships.ownerUserId, [a, b]),
        inArray(friendships.friendUserId, [a, b]),
      ),
    );
  const aFollowsB = links.some((l) => l.owner === a && l.friend === b);
  const bFollowsA = links.some((l) => l.owner === b && l.friend === a);
  return aFollowsB && bFollowsA;
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
  inatObservationId: number | null;
  otherGroup: string | null;
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
    inatObservationId: r.inatObservationId,
    otherGroup: r.otherGroup,
  }));
}

export async function getSpeciesById(id: number) {
  return db.query.checklistSpecies.findFirst({
    where: eq(checklistSpecies.id, id),
  });
}

export type LogStats = {
  totalButterflies: number;
  totalMoths: number;
  butterfliesSeen: number;
  mothsSeen: number;
  otherSpecies: number;
  otherGroups: { group: string; species: number }[];
};

/** The full log + life-list stats for a user — shared by the log & friend APIs. */
export async function getLogWithStats(
  userId: string,
): Promise<{ log: LogEntry[]; stats: LogStats }> {
  const [log, checklist] = await Promise.all([getUserLog(userId), getChecklist()]);

  const totals = checklist.reduce(
    (acc, s) => {
      if (s.taxonGroup === "butterfly") acc.totalButterflies++;
      else acc.totalMoths++;
      return acc;
    },
    { totalButterflies: 0, totalMoths: 0 },
  );

  const seen = new Set(log.filter((e) => e.speciesId != null).map((e) => e.speciesId));
  let butterfliesSeen = 0;
  let mothsSeen = 0;
  for (const s of checklist) {
    if (!seen.has(s.id)) continue;
    if (s.taxonGroup === "butterfly") butterfliesSeen++;
    else mothsSeen++;
  }

  const otherByGroup: Record<string, Set<string>> = {};
  for (const e of log) {
    if (e.speciesId != null) continue;
    const g = e.otherGroup ?? "Other bugs";
    (otherByGroup[g] ??= new Set()).add(e.identifiedScientific.toLowerCase());
  }
  const otherGroups = Object.entries(otherByGroup)
    .map(([group, set]) => ({ group, species: set.size }))
    .sort((a, b) => b.species - a.species);
  const otherSpecies = otherGroups.reduce((n, g) => n + g.species, 0);

  return {
    log,
    stats: { ...totals, butterfliesSeen, mothsSeen, otherSpecies, otherGroups },
  };
}

export { and, eq };
