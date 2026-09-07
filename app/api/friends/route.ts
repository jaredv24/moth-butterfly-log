import { NextResponse } from "next/server";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { friendships, sightings, users } from "@/db/schema";
import {
  isValidFriendCode,
  isValidUserCode,
  normalizeUserCode,
} from "@/lib/code";
import {
  findUser,
  findUserByFriendCode,
  getOrCreateFriendCode,
} from "@/lib/data";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

async function requireUser(code: string) {
  if (!isValidUserCode(normalizeUserCode(code))) return null;
  return findUser(normalizeUserCode(code));
}

export async function GET(req: Request) {
  const me = await requireUser(new URL(req.url).searchParams.get("code") ?? "");
  if (!me) return NextResponse.json({ error: "unknown code" }, { status: 404 });

  const friendCode = await getOrCreateFriendCode(me.id);

  const rows = await db
    .select({
      friendUserId: friendships.friendUserId,
      nickname: friendships.nickname,
      createdAt: friendships.createdAt,
      inatUsername: users.inatUsername,
    })
    .from(friendships)
    .innerJoin(users, eq(users.id, friendships.friendUserId))
    .where(eq(friendships.ownerUserId, me.id))
    .orderBy(desc(friendships.createdAt));

  const ids = rows.map((r) => r.friendUserId);

  // per-friend: sighting + species counts, last activity
  const counts = ids.length
    ? await db
        .select({
          userId: sightings.userId,
          sightings: sql<number>`count(*)::int`,
          species: sql<number>`count(distinct lower(${sightings.identifiedScientific}))::int`,
          last: sql<string>`max(${sightings.observedAt})`,
        })
        .from(sightings)
        .where(inArray(sightings.userId, ids))
        .groupBy(sightings.userId)
    : [];
  const byId = new Map(counts.map((c) => [c.userId, c]));

  // which of them also follow me back (mutual)
  const backRows = ids.length
    ? await db
        .select({ ownerUserId: friendships.ownerUserId })
        .from(friendships)
        .where(
          and(
            eq(friendships.friendUserId, me.id),
            inArray(friendships.ownerUserId, ids),
          ),
        )
    : [];
  const mutual = new Set(backRows.map((b) => b.ownerUserId));

  return NextResponse.json({
    friendCode,
    friends: rows.map((r) => ({
      userId: r.friendUserId,
      nickname: r.nickname,
      inatUsername: r.inatUsername,
      addedAt: r.createdAt.toISOString(),
      sightingsCount: byId.get(r.friendUserId)?.sightings ?? 0,
      speciesCount: byId.get(r.friendUserId)?.species ?? 0,
      lastSightingAt: byId.get(r.friendUserId)?.last ?? null,
      mutual: mutual.has(r.friendUserId),
    })),
  });
}

const addSchema = z.object({
  code: z.string(),
  friendCode: z.string(),
  nickname: z.string().trim().max(40).optional(),
});

export async function POST(req: Request) {
  const rl = await rateLimit("friends", clientIp(req), 30, 3600);
  if (!rl.ok) return NextResponse.json({ error: "Too many requests." }, { status: 429 });

  const parsed = addSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const me = await requireUser(parsed.data.code);
  if (!me) return NextResponse.json({ error: "unknown code" }, { status: 404 });

  const friendCode = parsed.data.friendCode.trim().toUpperCase();
  if (!isValidFriendCode(friendCode)) {
    return NextResponse.json(
      { error: "That doesn't look like a PAL-XXXXXXXX code." },
      { status: 400 },
    );
  }
  const target = await findUserByFriendCode(friendCode);
  if (!target) {
    return NextResponse.json({ error: "No one has that friend code." }, { status: 404 });
  }
  if (target.id === me.id) {
    return NextResponse.json({ error: "That's your own code." }, { status: 400 });
  }

  await db
    .insert(friendships)
    .values({
      ownerUserId: me.id,
      friendUserId: target.id,
      nickname: parsed.data.nickname || null,
    })
    .onConflictDoUpdate({
      target: [friendships.ownerUserId, friendships.friendUserId],
      set: { nickname: parsed.data.nickname || null },
    });

  return NextResponse.json({ ok: true, friendUserId: target.id });
}

const removeSchema = z.object({
  code: z.string(),
  friendUserId: z.string().uuid(),
});

export async function DELETE(req: Request) {
  const parsed = removeSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const me = await requireUser(parsed.data.code);
  if (!me) return NextResponse.json({ error: "unknown code" }, { status: 404 });

  await db
    .delete(friendships)
    .where(
      and(
        eq(friendships.ownerUserId, me.id),
        eq(friendships.friendUserId, parsed.data.friendUserId),
      ),
    );
  return NextResponse.json({ ok: true });
}
