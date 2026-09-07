import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import {
  cleanUsername,
  isValidUserCode,
  normalizeUserCode,
} from "@/lib/code";
import { findUser, getOrCreateUser } from "@/lib/data";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const limit = await rateLimit("user", clientIp(req), 60, 3600);
  if (!limit.ok) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  const parsed = z
    .object({ code: z.string().optional() })
    .safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const code = parsed.data.code ? normalizeUserCode(parsed.data.code) : undefined;
  if (code && !isValidUserCode(code)) {
    return NextResponse.json(
      { error: "That doesn't look like a MOTH-XXXXXX code." },
      { status: 400 },
    );
  }

  const user = await getOrCreateUser(code);
  const full = await findUser(user.code);
  return NextResponse.json({
    code: user.code,
    created: user.created,
    username: full?.username ?? null,
  });
}

/** Update the profile — currently just the display username. */
export async function PATCH(req: Request) {
  const parsed = z
    .object({ code: z.string(), username: z.string() })
    .safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const code = normalizeUserCode(parsed.data.code);
  if (!isValidUserCode(code)) {
    return NextResponse.json({ error: "invalid code" }, { status: 400 });
  }
  const user = await findUser(code);
  if (!user) return NextResponse.json({ error: "unknown code" }, { status: 404 });

  const raw = parsed.data.username.trim();
  const username = raw === "" ? null : cleanUsername(raw);
  if (raw !== "" && !username) {
    return NextResponse.json(
      { error: "2–24 characters: letters, numbers, spaces, . _ -" },
      { status: 400 },
    );
  }

  await db.update(users).set({ username }).where(eq(users.id, user.id));
  return NextResponse.json({ username });
}
