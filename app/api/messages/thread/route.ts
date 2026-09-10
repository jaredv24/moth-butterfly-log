import { NextResponse } from "next/server";
import { and, asc, eq, inArray, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { messages, sightings, users } from "@/db/schema";
import { isValidUserCode, normalizeUserCode } from "@/lib/code";
import { areMutual, findUser } from "@/lib/data";
import { displayName } from "@/lib/display-name";
import type { ChatMessage, SharedSighting } from "@/lib/types";

export const runtime = "nodejs";

/** GET /api/messages/thread?code=&friend= — the full conversation, oldest first.
 *  Marks the caller's incoming messages in this thread as read. */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const code = normalizeUserCode(sp.get("code") ?? "");
  const friendId = sp.get("friend") ?? "";
  if (!isValidUserCode(code)) {
    return NextResponse.json({ error: "valid ?code= is required" }, { status: 400 });
  }
  const me = await findUser(code);
  if (!me) return NextResponse.json({ error: "unknown code" }, { status: 404 });

  if (!(await areMutual(me.id, friendId))) {
    return NextResponse.json({ error: "not a mutual follow" }, { status: 403 });
  }

  const [friend, rows] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, friendId) }),
    db
      .select()
      .from(messages)
      .where(
        or(
          and(
            eq(messages.senderUserId, me.id),
            eq(messages.recipientUserId, friendId),
          ),
          and(
            eq(messages.senderUserId, friendId),
            eq(messages.recipientUserId, me.id),
          ),
        ),
      )
      .orderBy(asc(messages.createdAt))
      .limit(500),
  ]);

  const sightingIds = rows
    .map((r) => r.sightingId)
    .filter((id): id is string => !!id);
  const sightMap = new Map<string, SharedSighting>();
  if (sightingIds.length) {
    const ss = await db
      .select()
      .from(sightings)
      .where(inArray(sightings.id, sightingIds));
    for (const s of ss) {
      sightMap.set(s.id, {
        id: s.id,
        identifiedName: s.identifiedName,
        identifiedScientific: s.identifiedScientific,
        photoUrl: s.photoUrl,
        placeLabel: s.placeLabel,
        observedAt: s.observedAt.toISOString(),
        ownerUserId: s.userId,
      });
    }
  }

  // mark incoming as read
  await db
    .update(messages)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(messages.recipientUserId, me.id),
        eq(messages.senderUserId, friendId),
        isNull(messages.readAt),
      ),
    );

  const out: ChatMessage[] = rows.map((r) => ({
    id: r.id,
    body: r.body,
    sighting: r.sightingId ? (sightMap.get(r.sightingId) ?? null) : null,
    at: r.createdAt.toISOString(),
    mine: r.senderUserId === me.id,
  }));

  return NextResponse.json({
    friend: {
      userId: friendId,
      name: displayName(friend?.username, friend?.nickname, friend?.inatUsername),
      avatarUrl: friend?.avatarUrl ?? null,
    },
    messages: out,
  });
}
