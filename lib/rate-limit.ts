import { and, eq, gt, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { rateHits } from "@/db/schema";

/** Best-effort client IP from Vercel's proxy headers. */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

type Result = { ok: true } | { ok: false; retryAfterSec: number };

/**
 * Postgres-backed sliding window. `name` scopes the limit (e.g. "identify"),
 * `key` is usually the client IP. Fails open on any DB error so a limiter
 * problem never takes down the feature.
 */
export async function rateLimit(
  name: string,
  key: string,
  limit: number,
  windowSec: number,
): Promise<Result> {
  const bucket = `${name}:${key}`;
  const since = new Date(Date.now() - windowSec * 1000);
  try {
    // prune this bucket's expired rows opportunistically
    await db.delete(rateHits).where(and(eq(rateHits.bucket, bucket), lt(rateHits.at, since)));

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(rateHits)
      .where(and(eq(rateHits.bucket, bucket), gt(rateHits.at, since)));

    if (count >= limit) {
      return { ok: false, retryAfterSec: windowSec };
    }
    await db.insert(rateHits).values({ bucket });
    return { ok: true };
  } catch (err) {
    console.error("rateLimit error (failing open):", err);
    return { ok: true };
  }
}
