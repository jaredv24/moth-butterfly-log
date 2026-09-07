"use client";

/**
 * Downscale a photo in the browser before upload: caps the long edge at
 * `maxEdge` and re-encodes as JPEG. Keeps identify calls fast and avoids
 * uploading 5–12 MB phone photos twice. Falls back to the original file if
 * anything goes wrong (very old browser, decode failure).
 */
export async function shrinkImage(
  file: File,
  maxEdge = 1600,
  quality = 0.85,
): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 1_500_000) return file;

    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    return blob && blob.size > 0 ? blob : file;
  } catch {
    return file;
  }
}
