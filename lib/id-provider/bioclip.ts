import type { IdCandidate, IdProvider } from "./types";

type BioclipCandidate = {
  scientificName: string;
  commonName: string | null;
  order: string | null;
  class: string | null;
  score: number;
};

/**
 * BioCLIP 2 (Tree of Life) via a Modal-hosted GPU service — see bioclip/.
 * Covers all of life, so it identifies herps, other critters, and insects,
 * not just Lepidoptera. Location/date are not used (BioCLIP is image-only);
 * the downstream plausibility layer still re-ranks by where + when.
 *
 * Requires BIOCLIP_ENDPOINT and BIOCLIP_TOKEN.
 */
export class BioclipProvider implements IdProvider {
  readonly name = "bioclip";

  async identify(image: Buffer): Promise<IdCandidate[]> {
    const endpoint = process.env.BIOCLIP_ENDPOINT;
    const token = process.env.BIOCLIP_TOKEN;
    if (!endpoint || !token) {
      throw new Error(
        "BIOCLIP_ENDPOINT and BIOCLIP_TOKEN are required for ID_PROVIDER=bioclip",
      );
    }

    const res = await fetch(`${endpoint.replace(/\/$/, "")}/identify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ image: image.toString("base64"), k: 5 }),
      signal: AbortSignal.timeout(60_000), // first call after idle is a cold start
    });

    if (res.status === 401) throw new Error("BioCLIP service rejected the token");
    if (!res.ok) {
      throw new Error(`BioCLIP service failed: ${res.status} ${await res.text()}`);
    }

    const json = (await res.json()) as { candidates?: BioclipCandidate[] };
    return (json.candidates ?? []).map((c) => ({
      name: c.commonName ?? c.scientificName,
      scientificName: c.scientificName,
      confidence: c.score,
      order: c.order,
      taxonClass: c.class,
      imageUrl: null,
    }));
  }
}
