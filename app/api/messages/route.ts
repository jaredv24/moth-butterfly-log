import { NextResponse } from "next/server";
import { and, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { messages, sightings, users } from "@/db/schema";
import { isValidUserCode, normalizeUserCode } from "@/lib/code";
import { areMutual, findUser, listMutualIds } from "@/lib/data";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import type { ChatMessage, SharedSighting } from "@/lib/types";

export const runtime = "nodejs";

async function requireUser(raw: string) {
  const c = normalizeUserCode(raw);
  return isValidUserCode(c) ? findUser(c) : null;
}

function displayName(username: string | null, inat: string | null) {
  return username ?? inat ?? null;
}

/** GET /api/messages?code= — thread list with unread counts. */
export async function GET(req: Request) {
  const me = await requireUser(new URL(req.url).searchParams.get("code") ?? "");
  if (!me) return NextResponse.json({ error: "unknown code" }, { status: 404 });

  const mutualIds = await listMutualIds(me.id);
  if (mutualIds.length === 0) {
    return NextResponse.json({ threads: [], totalUnread: 0 });
  }

  const [people, recent, unreadRows] = await Promise.all([
    db
      .select({
        id: users.id,
        username: users.username,
        inatUsername: users.inatUsername,
        avatarUrl: users.avatarUrl,
      })
      .from(users)
      .where(inArray(users.id, mutualIds)),
    db
      .select({
        senderUserId: messages.senderUserId,
        recipientUserId: messages.recipientUserId,
        body: messages.body,
        sightingId: messages.sightingId,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .where(
        or(
          and(
            eq(messages.senderUserId, me.id),
            inArray(messages.recipientUserId, mutualIds),
          ),
          and(
            eq(messages.recipientUserId, me.id),
            inArray(messages.senderUserId, mutualIds),
          ),
        ),
      )
      .orderBy(desc(messages.createdAt))
      .limit(400),
    db
      .select({
        senderUserId: messages.senderUserId,
        n: sql<number>`count(*)::int`,
      })
      .from(messages)
      .where(
        and(
          eq(messages.recipientUserId, me.id),
          inArray(messages.senderUserId, mutualIds),
          isNull(messages.readAt),
        ),
      )
      .groupBy(messages.senderUserId),
  ]);

  const unread = new Map(unreadRows.map((r) => [r.senderUserId, r.n]));
  const lastByOther = new Map<string, (typeof recent)[number]>();
  for (const m of recent) {
    const other = m.senderUserId === me.id ? m.recipientUserId : m.senderUserId;
    if (!lastByOther.has(other)) lastByOther.set(other, m);
  }

  const threads = people
    .map((p) => {
      const last = lastByOther.get(p.id);
      return {
        userId: p.id,
        name: displayName(p.username, p.inatUsername),
        avatarUrl: p.avatarUrl,
        lastMessage: last
          ? {
              preview:
                last.body?.trim() ||
                (last.sightingId ? "📷 Shared a sighting" : ""),
              at: last.createdAt.toISOString(),
              mine: last.senderUserId === me.id,
            }
          : null,
        unread: unread.get(p.id) ?? 0,
      };
    })
    .sort((a, b) => {
      if (a.lastMessage && b.lastMessage)
        return b.lastMessage.at.localeCompare(a.lastMessage.at);
      if (a.lastMessage) return -1;
      if (b.lastMessage) return 1;
      return (a.name ?? "").localeCompare(b.name ?? "");
    });

  const totalUnread = threads.reduce((n, t) => n + t.unread, 0);
  return NextResponse.json({ threads, totalUnread });
}

const sendSchema = z.object({
  code: z.string(),
  to: z.string().uuid(),
  body: z.string().max(4000).optional(),
  sightingId: z.string().uuid().optional(),
});

/** POST /api/messages — send a message to a mutual follower. */
export async function POST(req: Request) {
  const rl = await rateLimit("messages", clientIp(req), 120, 3600);
  if (!rl.ok)
    return NextResponse.json({ error: "Too many messages." }, { status: 429 });

  const parsed = sendSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const { to, sightingId } = parsed.data;
  const body = parsed.data.body?.trim() || null;
  if (!body && !sightingId) {
    return NextResponse.json({ error: "empty message" }, { status: 400 });
  }

  const me = await requireUser(parsed.data.code);
  if (!me) return NextResponse.json({ error: "unknown code" }, { status: 404 });
  if (to === me.id) {
    return NextResponse.json({ error: "can't message yourself" }, { status: 400 });
  }
  if (!(await areMutual(me.id, to))) {
    return NextResponse.json(
      { error: "You can only message people you both follow." },
      { status: 403 },
    );
  }

  let shared: SharedSighting | null = null;
  if (sightingId) {
    const s = await db.query.sightings.findFirst({
      where: and(eq(sightings.id, sightingId), eq(sightings.userId, me.id)),
    });
    if (!s) {
      return NextResponse.json(
        { error: "That sighting isn't in your log." },
        { status: 400 },
      );
    }
    shared = {
      id: s.id,
      identifiedName: s.identifiedName,
      identifiedScientific: s.identifiedScientific,
      photoUrl: s.photoUrl,
      placeLabel: s.placeLabel,
      observedAt: s.observedAt.toISOString(),
      ownerUserId: me.id,
    };
  }

  const [row] = await db
    .insert(messages)
    .values({
      senderUserId: me.id,
      recipientUserId: to,
      body,
      sightingId: sightingId ?? null,
    })
    .returning();

  const msg: ChatMessage = {
    id: row.id,
    body: row.body,
    sighting: shared,
    at: row.createdAt.toISOString(),
    mine: true,
  };
  return NextResponse.json({ message: msg });
}
