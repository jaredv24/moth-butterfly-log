import { NextResponse } from "next/server";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { messages } from "@/db/schema";
import { isValidUserCode, normalizeUserCode } from "@/lib/code";
import { findUser, listMutualIds } from "@/lib/data";

export const runtime = "nodejs";

/** GET /api/messages/unread?code= — total unread count, for the nav badge. */
export async function GET(req: Request) {
  const code = normalizeUserCode(
    new URL(req.url).searchParams.get("code") ?? "",
  );
  if (!isValidUserCode(code)) return NextResponse.json({ count: 0 });
  const me = await findUser(code);
  if (!me) return NextResponse.json({ count: 0 });

  const mutualIds = await listMutualIds(me.id);
  if (!mutualIds.length) return NextResponse.json({ count: 0 });

  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(messages)
    .where(
      and(
        eq(messages.recipientUserId, me.id),
        inArray(messages.senderUserId, mutualIds),
        isNull(messages.readAt),
      ),
    );
  return NextResponse.json({ count: row?.n ?? 0 });
}
