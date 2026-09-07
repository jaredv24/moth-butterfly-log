import { NextResponse } from "next/server";
import { after } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { isValidUserCode, normalizeUserCode } from "@/lib/code";
import { findUser } from "@/lib/data";
import { syncUnsynced } from "@/lib/inat-sync";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

const schema = z.object({
  code: z.string(),
  action: z.enum(["toggle", "disconnect", "sync"]),
  enabled: z.boolean().optional(),
});

export async function POST(req: Request) {
  const limit = await rateLimit("inat", clientIp(req), 30, 3600);
  if (!limit.ok) return NextResponse.json({ error: "Too many requests." }, { status: 429 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const code = normalizeUserCode(parsed.data.code);
  if (!isValidUserCode(code)) {
    return NextResponse.json({ error: "invalid code" }, { status: 400 });
  }
  const user = await findUser(code);
  if (!user) return NextResponse.json({ error: "unknown code" }, { status: 404 });

  switch (parsed.data.action) {
    case "toggle": {
      if (!user.inatAccessToken) {
        return NextResponse.json({ error: "not connected" }, { status: 400 });
      }
      const enabled = !!parsed.data.enabled;
      await db.update(users).set({ inatSyncEnabled: enabled }).where(eq(users.id, user.id));
      return NextResponse.json({ syncEnabled: enabled });
    }

    case "disconnect": {
      await db
        .update(users)
        .set({
          inatAccessToken: null,
          inatUsername: null,
          inatSyncEnabled: false,
          inatConnectedAt: null,
        })
        .where(eq(users.id, user.id));
      return NextResponse.json({ connected: false });
    }

    case "sync": {
      if (!user.inatAccessToken) {
        return NextResponse.json({ error: "not connected" }, { status: 400 });
      }
      // First batch inline for immediate feedback; keep going after the response.
      const first = await syncUnsynced(user.id, 10);
      if (first.remaining > 0) {
        after(async () => {
          let left = first.remaining;
          while (left > 0) {
            const r = await syncUnsynced(user.id, 15);
            left = r.remaining;
          }
        });
      }
      return NextResponse.json(first);
    }
  }
}
