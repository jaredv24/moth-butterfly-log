import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { del, put } from "@vercel/blob";

const blobEnabled = () => !!process.env.BLOB_READ_WRITE_TOKEN;

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

  if (blobEnabled()) {
    const blob = await put(key, bytes, { access: "public", contentType });
    return blob.url;
  }

  const dir = path.join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });
  const filename = key.replace("sightings/", "");
  await writeFile(path.join(dir, filename), bytes);
  return `/uploads/${filename}`;
}

/** Best-effort delete of a photo previously stored by storePhoto(). */
export async function deletePhoto(url: string): Promise<void> {
  try {
    if (blobEnabled() && url.startsWith("http")) {
      await del(url);
      return;
    }
    if (url.startsWith("/uploads/")) {
      await rm(path.join(process.cwd(), "public", url.replace(/^\//, "")), {
        force: true,
      });
    }
  } catch (err) {
    console.error("deletePhoto failed:", err);
  }
}
