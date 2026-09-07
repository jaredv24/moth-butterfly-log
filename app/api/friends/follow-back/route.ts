import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { friendships } from "@/db/schema";
import { isValidUserCode, normalizeUserCode } from "@/lib/code";
import { findUser } from "@/lib/data";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

/**
 * Follow someone who already follows you. No friend code needed — the fact
 * that they follow you means they've already connected to you.
 */
export async function POST(req: Request) {
  const rl = await rateLimit("friends", clientIp(req), 30, 3600);
  if (!rl.ok) return NextResponse.json({ error: "Too many requests." }, { status: 429 });

  const parsed = z
    .object({ code: z.string(), followerUserId: z.string().uuid() })
    .safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const code = normalizeUserCode(parsed.data.code);
  if (!isValidUserCode(code)) {
    return NextResponse.json({ error: "invalid code" }, { status: 400 });
  }
  const me = await findUser(code);
  if (!me) return NextResponse.json({ error: "unknown code" }, { status: 404 });

  // verify they actually follow me
  const theyFollowMe = await db.query.friendships.findFirst({
    where: and(
      eq(friendships.ownerUserId, parsed.data.followerUserId),
      eq(friendships.friendUserId, me.id),
    ),
  });
  if (!theyFollowMe) {
    return NextResponse.json({ error: "That person doesn't follow you." }, { status: 400 });
  }

  await db
    .insert(friendships)
    .values({ ownerUserId: me.id, friendUserId: parsed.data.followerUserId })
    .onConflictDoNothing();

  return NextResponse.json({ ok: true });
}
