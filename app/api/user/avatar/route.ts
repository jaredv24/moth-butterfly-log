import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import sharp from "sharp";
import { db } from "@/db";
import { users } from "@/db/schema";
import { isValidUserCode, normalizeUserCode } from "@/lib/code";
import { findUser } from "@/lib/data";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { deletePhoto, storePhoto } from "@/lib/storage";

export const runtime = "nodejs";

const MAX_BYTES = 12 * 1024 * 1024;

async function requireUser(code: string | null) {
  const c = normalizeUserCode(code ?? "");
  if (!isValidUserCode(c)) return null;
  return findUser(c);
}

export async function POST(req: Request) {
  const rl = await rateLimit("avatar", clientIp(req), 20, 3600);
  if (!rl.ok) return NextResponse.json({ error: "Too many requests." }, { status: 429 });

  const form = await req.formData().catch(() => null);
  const photo = form?.get("photo");
  const user = await requireUser(
    typeof form?.get("code") === "string" ? (form.get("code") as string) : null,
  );
  if (!user) return NextResponse.json({ error: "unknown code" }, { status: 404 });
  if (!(photo instanceof File)) {
    return NextResponse.json({ error: "photo is required" }, { status: 400 });
  }
  if (photo.size > MAX_BYTES) {
    return NextResponse.json({ error: "photo too large" }, { status: 413 });
  }

  const jpg = await sharp(Buffer.from(await photo.arrayBuffer()))
    .rotate()
    .resize(256, 256, { fit: "cover" })
    .jpeg({ quality: 82 })
    .toBuffer();

  const avatarUrl = await storePhoto(jpg, "image/jpeg");
  const old = user.avatarUrl;
  await db.update(users).set({ avatarUrl }).where(eq(users.id, user.id));
  if (old) await deletePhoto(old);

  return NextResponse.json({ avatarUrl });
}

export async function DELETE(req: Request) {
  const body = await req.json().catch(() => ({}));
  const user = await requireUser(typeof body.code === "string" ? body.code : null);
  if (!user) return NextResponse.json({ error: "unknown code" }, { status: 404 });

  if (user.avatarUrl) await deletePhoto(user.avatarUrl);
  await db.update(users).set({ avatarUrl: null }).where(eq(users.id, user.id));
  return NextResponse.json({ ok: true });
}
