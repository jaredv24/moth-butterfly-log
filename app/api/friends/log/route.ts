import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { friendships, users } from "@/db/schema";
import { isValidUserCode, normalizeUserCode } from "@/lib/code";
import { findUser, getLogWithStats } from "@/lib/data";

export const runtime = "nodejs";

/** A friend's log — read-only. Requires that the caller follows `friend`. */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const code = normalizeUserCode(sp.get("code") ?? "");
  const friendUserId = sp.get("friend") ?? "";
  if (!isValidUserCode(code)) {
    return NextResponse.json({ error: "valid ?code= is required" }, { status: 400 });
  }
  const me = await findUser(code);
  if (!me) return NextResponse.json({ error: "unknown code" }, { status: 404 });

  const link = await db.query.friendships.findFirst({
    where: and(
      eq(friendships.ownerUserId, me.id),
      eq(friendships.friendUserId, friendUserId),
    ),
  });
  if (!link) {
    return NextResponse.json({ error: "not your friend" }, { status: 403 });
  }

  const friend = await db.query.users.findFirst({
    where: eq(users.id, friendUserId),
  });

  const data = await getLogWithStats(friendUserId);
  return NextResponse.json({
    ...data,
    friend: {
      userId: friendUserId,
      name:
        friend?.username ?? link.nickname ?? friend?.inatUsername ?? "Friend",
    },
  });
}
