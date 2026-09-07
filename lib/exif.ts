"use client";

import exifr from "exifr";

export type PhotoMeta = {
  lat?: number;
  lng?: number;
  /** ISO string of when the photo was taken, if the camera recorded it. */
  takenAt?: string;
  /** Whether the coordinates came from the photo's own GPS tags. */
  gpsFromPhoto: boolean;
};

/**
 * Pull capture GPS + timestamp from a photo's EXIF, before we downscale it
 * (canvas re-encoding drops all metadata). Everything here is optional — most
 * shared/screenshotted images carry nothing, and that's fine.
 */
export async function readPhotoMeta(file: File): Promise<PhotoMeta> {
  const meta: PhotoMeta = { gpsFromPhoto: false };

  try {
    const gps = await exifr.gps(file);
    if (
      gps &&
      typeof gps.latitude === "number" &&
      typeof gps.longitude === "number" &&
      Number.isFinite(gps.latitude) &&
      Number.isFinite(gps.longitude)
    ) {
      meta.lat = gps.latitude;
      meta.lng = gps.longitude;
      meta.gpsFromPhoto = true;
    }
  } catch {
    /* no GPS block */
  }

  try {
    const data = await exifr.parse(file, { pick: ["DateTimeOriginal", "CreateDate"] });
    const when: Date | undefined = data?.DateTimeOriginal ?? data?.CreateDate;
    if (when instanceof Date && !Number.isNaN(when.getTime())) {
      meta.takenAt = when.toISOString();
    }
  } catch {
    /* no datetime */
  }

  return meta;
}
