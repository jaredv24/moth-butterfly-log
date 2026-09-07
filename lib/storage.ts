import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { put } from "@vercel/blob";

/**
 * Persist an uploaded photo and return a public URL.
 * - Production / when BLOB_READ_WRITE_TOKEN is set: Vercel Blob.
 * - Local dev without a token: write to public/uploads/ and serve statically.
 */
export async function storePhoto(
  bytes: Buffer,
  contentType: string,
): Promise<string> {
  const ext = contentType.includes("png")
    ? "png"
    : contentType.includes("webp")
      ? "webp"
      : "jpg";
  const key = `sightings/${randomUUID()}.${ext}`;

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(key, bytes, {
      access: "public",
      contentType,
    });
    return blob.url;
  }

  const dir = path.join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });
  const filename = key.replace("sightings/", "");
  await writeFile(path.join(dir, filename), bytes);
  return `/uploads/${filename}`;
}
