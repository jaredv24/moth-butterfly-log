/**
 * Reverse-geocode a coordinate to a short human place label like
 * "Austin, Texas". Uses BigDataCloud's keyless client endpoint; on any failure
 * it falls back to rounded coordinates so a sighting is never blocked.
 */
export async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<string> {
  try {
    const url =
      `https://api.bigdatacloud.net/data/reverse-geocode-client` +
      `?latitude=${lat}&longitude=${lng}&localityLanguage=en`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) throw new Error(String(res.status));
    const j = (await res.json()) as {
      city?: string;
      locality?: string;
      principalSubdivision?: string;
      countryName?: string;
    };
    const place = j.city || j.locality;
    const region = j.principalSubdivision || j.countryName;
    const label = [place, region].filter(Boolean).join(", ");
    return label || fallback(lat, lng);
  } catch {
    return fallback(lat, lng);
  }
}

function fallback(lat: number, lng: number): string {
  return `${lat.toFixed(3)}, ${lng.toFixed(3)}`;
}
