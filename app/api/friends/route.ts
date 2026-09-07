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
  const c = normalizeUserCode(code);
  return isValidUserCode(c) ? findUser(c) : null;
}

/** species / sighting counts + last activity for a set of users */
async function activity(ids: string[]) {
  if (!ids.length) return new Map<string, { sightings: number; species: number; last: string | null }>();
  const rows = await db
    .select({
      userId: sightings.userId,
      sightings: sql<number>`count(*)::int`,
      species: sql<number>`count(distinct lower(${sightings.identifiedScientific}))::int`,
      last: sql<string>`max(${sightings.observedAt})`,
    })
    .from(sightings)
    .where(inArray(sightings.userId, ids))
    .groupBy(sightings.userId);
  return new Map(rows.map((r) => [r.userId, r]));
}

export async function GET(req: Request) {
  const me = await requireUser(new URL(req.url).searchParams.get("code") ?? "");
  if (!me) return NextResponse.json({ error: "unknown code" }, { status: 404 });

  const friendCode = await getOrCreateFriendCode(me.id);

  const [followingRows, followerRows] = await Promise.all([
    db
      .select({
        userId: friendships.friendUserId,
        nickname: friendships.nickname,
        createdAt: friendships.createdAt,
        username: users.username,
        inatUsername: users.inatUsername,
      })
      .from(friendships)
      .innerJoin(users, eq(users.id, friendships.friendUserId))
      .where(eq(friendships.ownerUserId, me.id))
      .orderBy(desc(friendships.createdAt)),
    db
      .select({
        userId: friendships.ownerUserId,
        createdAt: friendships.createdAt,
        username: users.username,
        inatUsername: users.inatUsername,
      })
      .from(friendships)
      .innerJoin(users, eq(users.id, friendships.ownerUserId))
      .where(eq(friendships.friendUserId, me.id))
      .orderBy(desc(friendships.createdAt)),
  ]);

  const iFollow = new Set(followingRows.map((r) => r.userId));
  const followMe = new Set(followerRows.map((r) => r.userId));
  const act = await activity([
    ...new Set([...iFollow, ...followMe]),
  ]);

  const displayName = (username: string | null, inat: string | null, nick?: string | null) =>
    username ?? nick ?? inat ?? null;

  return NextResponse.json({
    friendCode,
    username: me.username ?? null,
    following: followingRows.map((r) => ({
      userId: r.userId,
      name: displayName(r.username, r.inatUsername, r.nickname),
      addedAt: r.createdAt.toISOString(),
      sightingsCount: act.get(r.userId)?.sightings ?? 0,
      speciesCount: act.get(r.userId)?.species ?? 0,
      lastSightingAt: act.get(r.userId)?.last ?? null,
      mutual: followMe.has(r.userId),
    })),
    followers: followerRows.map((r) => ({
      userId: r.userId,
      name: displayName(r.username, r.inatUsername),
      followedAt: r.createdAt.toISOString(),
      speciesCount: act.get(r.userId)?.species ?? 0,
      lastSightingAt: act.get(r.userId)?.last ?? null,
      youFollowBack: iFollow.has(r.userId),
    })),
  });
}

const addSchema = z.object({
  code: z.string(),
  friendCode: z.string(),
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
    .values({ ownerUserId: me.id, friendUserId: target.id })
    .onConflictDoNothing();

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
