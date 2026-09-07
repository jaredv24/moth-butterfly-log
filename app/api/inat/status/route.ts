import { NextResponse } from "next/server";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { sightings } from "@/db/schema";
import { isValidUserCode, normalizeUserCode } from "@/lib/code";
import { findUser } from "@/lib/data";
import { inatConfigured } from "@/lib/inat";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const code = normalizeUserCode(new URL(req.url).searchParams.get("code") ?? "");
  if (!isValidUserCode(code)) {
    return NextResponse.json({ error: "valid ?code= is required" }, { status: 400 });
  }
  const user = await findUser(code);
  if (!user) return NextResponse.json({ error: "unknown code" }, { status: 404 });

  const connected = !!user.inatAccessToken;
  let unsyncedCount = 0;
  if (connected) {
    const [{ n }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(sightings)
      .where(and(eq(sightings.userId, user.id), isNull(sightings.inatObservationId)));
    unsyncedCount = n;
  }

  return NextResponse.json({
    configured: inatConfigured(),
    connected,
    username: user.inatUsername ?? null,
    syncEnabled: user.inatSyncEnabled,
    unsyncedCount,
  });
}
