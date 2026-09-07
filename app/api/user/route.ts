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
import { readDeviceToken, signDeviceToken } from "@/lib/crypto";
import { findUser, getOrCreateUser } from "@/lib/data";
import { hashPassword, verifyPassword } from "@/lib/password";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const DEVICE_COOKIE = "lep_device";
const YEAR = 60 * 60 * 24 * 365;

function trustedFor(req: Request, userId: string): boolean {
  const raw = req.headers
    .get("cookie")
    ?.match(new RegExp(`(?:^|; )${DEVICE_COOKIE}=([^;]+)`))?.[1];
  return !!raw && readDeviceToken(decodeURIComponent(raw)) === userId;
}

function withDeviceCookie(res: NextResponse, userId: string): NextResponse {
  res.cookies.set(DEVICE_COOKIE, signDeviceToken(userId), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: YEAR,
  });
  return res;
}

export async function POST(req: Request) {
  const limit = await rateLimit("user", clientIp(req), 300, 3600);
  if (!limit.ok) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  const parsed = z
    .object({ code: z.string().optional(), password: z.string().optional() })
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

  // password gate: only for a code being adopted on a device that hasn't
  // authenticated for this user before
  if (full?.passwordHash && !trustedFor(req, user.id)) {
    if (!parsed.data.password) {
      return NextResponse.json(
        { needsPassword: true, code: user.code },
        { status: 401 },
      );
    }
    if (!(await verifyPassword(parsed.data.password, full.passwordHash))) {
      return NextResponse.json(
        { error: "Wrong password.", needsPassword: true, code: user.code },
        { status: 401 },
      );
    }
  }

  await db
    .update(users)
    .set({ lastSeenAt: new Date() })
    .where(eq(users.id, user.id));

  return withDeviceCookie(
    NextResponse.json({
      code: user.code,
      created: user.created,
      username: full?.username ?? null,
      hasPassword: !!full?.passwordHash,
    }),
    user.id,
  );
}

/** Update the profile: display name, and set/change/remove the password. */
export async function PATCH(req: Request) {
  const parsed = z
    .object({
      code: z.string(),
      username: z.string().optional(),
      password: z.string().optional(), // "" removes it
      currentPassword: z.string().optional(),
    })
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

  const set: Partial<typeof users.$inferInsert> = {};

  if (parsed.data.username !== undefined) {
    const raw = parsed.data.username.trim();
    const username = raw === "" ? null : cleanUsername(raw);
    if (raw !== "" && !username) {
      return NextResponse.json(
        { error: "2–24 characters: letters, numbers, spaces, . _ -" },
        { status: 400 },
      );
    }
    set.username = username;
  }

  if (parsed.data.password !== undefined) {
    // changing the password needs the current one, unless this device is trusted
    if (
      user.passwordHash &&
      !trustedFor(req, user.id) &&
      !(await verifyPassword(parsed.data.currentPassword ?? "", user.passwordHash))
    ) {
      return NextResponse.json({ error: "Current password required." }, { status: 401 });
    }
    if (parsed.data.password === "") {
      set.passwordHash = null;
    } else if (parsed.data.password.length < 4) {
      return NextResponse.json(
        { error: "Password must be at least 4 characters." },
        { status: 400 },
      );
    } else {
      set.passwordHash = await hashPassword(parsed.data.password);
    }
  }

  if (Object.keys(set).length) {
    await db.update(users).set(set).where(eq(users.id, user.id));
  }

  return withDeviceCookie(
    NextResponse.json({
      username: set.username !== undefined ? set.username : (user.username ?? null),
      hasPassword:
        set.passwordHash !== undefined
          ? set.passwordHash !== null
          : !!user.passwordHash,
    }),
    user.id,
  );
}
