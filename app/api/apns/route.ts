import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { apnsDevices } from "@/db/schema";
import { isValidUserCode, normalizeUserCode } from "@/lib/code";
import { findUser } from "@/lib/data";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const token = z.string().regex(/^[0-9a-f]{32,200}$/i);

async function requireUser(raw: string) {
  const c = normalizeUserCode(raw);
  return isValidUserCode(c) ? findUser(c) : null;
}

/** Register (or move) this iPhone for message notifications. The token is the device. */
export async function POST(req: Request) {
  const rl = await rateLimit("push", clientIp(req), 60, 3600);
  if (!rl.ok) return NextResponse.json({ error: "Too many requests." }, { status: 429 });

  const parsed = z
    .object({ code: z.string(), token, environment: z.enum(["sandbox", "production"]) })
    .safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid body" }, { status: 400 });

  const me = await requireUser(parsed.data.code);
  if (!me) return NextResponse.json({ error: "unknown code" }, { status: 404 });

  const values = { userId: me.id, environment: parsed.data.environment, updatedAt: new Date() };
  await db
    .insert(apnsDevices)
    .values({ token: parsed.data.token, ...values })
    .onConflictDoUpdate({ target: apnsDevices.token, set: values });

  return NextResponse.json({ ok: true });
}

/** Stop pushing to this iPhone (turned off, or switched to another log). */
export async function DELETE(req: Request) {
  const parsed = z
    .object({ code: z.string(), token })
    .safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: true });

  const me = await requireUser(parsed.data.code);
  if (!me) return NextResponse.json({ ok: true });

  await db
    .delete(apnsDevices)
    .where(and(eq(apnsDevices.token, parsed.data.token), eq(apnsDevices.userId, me.id)));
  return NextResponse.json({ ok: true });
}
