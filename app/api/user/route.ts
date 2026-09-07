import { NextResponse } from "next/server";
import { z } from "zod";
import { isValidUserCode, normalizeUserCode } from "@/lib/code";
import { getOrCreateUser } from "@/lib/data";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const bodySchema = z.object({
  code: z.string().optional(),
});

export async function POST(req: Request) {
  const limit = await rateLimit("user", clientIp(req), 60, 3600);
  if (!limit.ok) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const code = parsed.data.code
    ? normalizeUserCode(parsed.data.code)
    : undefined;
  if (code && !isValidUserCode(code)) {
    return NextResponse.json(
      { error: "That doesn't look like a MOTH-XXXXXX code." },
      { status: 400 },
    );
  }

  const user = await getOrCreateUser(code);
  return NextResponse.json({ code: user.code, created: user.created });
}
