import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { sightings, users } from "@/db/schema";
import { decryptSecret } from "@/lib/crypto";
import {
  attachPhoto,
  createObservation,
  getJwt,
} from "@/lib/inat";

/** Redirect URI for the OAuth flow — must match what's registered on iNaturalist. */
export function inatRedirectUri(req: Request): string {
  if (process.env.APP_URL) return `${process.env.APP_URL}/api/inat/callback`;
  const url = new URL(req.url);
  const host = req.headers.get("x-forwarded-host") ?? url.host;
  return `https://${host}/api/inat/callback`;
}

type SyncResult = { ok: true; observationId: number } | { ok: false; error: string };

/** Post one sighting to its owner's iNaturalist account. Idempotent + soft-fail. */
export async function syncSighting(sightingId: string): Promise<SyncResult> {
  const sighting = await db.query.sightings.findFirst({
    where: eq(sightings.id, sightingId),
  });
  if (!sighting) return { ok: false, error: "sighting not found" };
  if (sighting.inatObservationId) {
    return { ok: true, observationId: sighting.inatObservationId };
  }

  const user = await db.query.users.findFirst({ where: eq(users.id, sighting.userId) });
  if (!user?.inatAccessToken) return { ok: false, error: "iNaturalist not connected" };

  try {
    const jwt = await getJwt(decryptSecret(user.inatAccessToken));

    const observationId = await createObservation(jwt, {
      speciesGuess: sighting.identifiedScientific,
      taxonId: sighting.speciesId
        ? (
            await db.query.checklistSpecies.findFirst({
              where: (c, { eq: e }) => e(c.id, sighting.speciesId!),
            })
          )?.inatTaxonId ?? null
        : null,
      observedOn: sighting.observedAt.toISOString(),
      latitude: sighting.lat,
      longitude: sighting.lng,
      description: "Logged via Moth & Butterfly Log",
    });

    // attach the stored photo (best-effort — observation still exists without it)
    try {
      const res = await fetch(sighting.photoUrl);
      if (res.ok) {
        const bytes = Buffer.from(await res.arrayBuffer());
        await attachPhoto(
          jwt,
          observationId,
          bytes,
          res.headers.get("content-type") ?? "image/jpeg",
        );
      }
    } catch (err) {
      console.error("iNat photo attach failed (observation kept):", err);
    }

    await db
      .update(sightings)
      .set({ inatObservationId: observationId, inatSyncError: null })
      .where(eq(sightings.id, sightingId));
    return { ok: true, observationId };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "sync failed";
    await db
      .update(sightings)
      .set({ inatSyncError: msg.slice(0, 300) })
      .where(eq(sightings.id, sightingId));
    return { ok: false, error: msg };
  }
}

/** Push up to `limit` of a user's not-yet-synced sightings. Returns counts. */
export async function syncUnsynced(
  userId: string,
  limit = 20,
): Promise<{ synced: number; failed: number; remaining: number }> {
  const pending = await db
    .select({ id: sightings.id })
    .from(sightings)
    .where(and(eq(sightings.userId, userId), isNull(sightings.inatObservationId)))
    .orderBy(sightings.observedAt);

  let synced = 0;
  let failed = 0;
  for (const row of pending.slice(0, limit)) {
    const r = await syncSighting(row.id);
    if (r.ok) synced++;
    else failed++;
    await new Promise((res) => setTimeout(res, 800)); // be polite to iNat
  }
  return { synced, failed, remaining: Math.max(0, pending.length - limit) };
}
