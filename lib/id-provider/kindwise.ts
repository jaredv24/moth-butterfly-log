import type { IdOptions, IdProvider, IdResult } from "./types";

const ENDPOINT = "https://insect.kindwise.com/api/v1/identification";

type KindwiseSuggestion = {
  name: string; // scientific name
  probability: number; // 0..1
  similar_images?: { url?: string; url_small?: string }[] | null;
  details?: {
    common_names?: string[] | null;
    gbif_id?: number | null;
    taxonomy?: Record<string, string> | null;
  } | null;
};

type KindwiseResponse = {
  result?: {
    is_insect?: { binary?: boolean; probability?: number };
    classification?: { suggestions?: KindwiseSuggestion[] };
  };
};

/**
 * Kindwise insect.id — a purpose-built insect identification API.
 * https://insect.kindwise.com/docs
 *
 * One credit is spent per call. Requires KINDWISE_API_KEY.
 */
export class KindwiseProvider implements IdProvider {
  readonly name = "kindwise";

  async identify(image: Buffer, opts: IdOptions): Promise<IdResult> {
    const apiKey = process.env.KINDWISE_API_KEY;
    if (!apiKey) throw new Error("KINDWISE_API_KEY is required for ID_PROVIDER=kindwise");

    const body: Record<string, unknown> = {
      images: [image.toString("base64")],
      similar_images: true, // gives us a representative photo per candidate
    };
    if (opts.lat != null && opts.lng != null) {
      body.latitude = opts.lat;
      body.longitude = opts.lng;
    }
    if (opts.observedOn) body.datetime = opts.observedOn;

    const res = await fetch(`${ENDPOINT}?details=common_names,gbif_id,taxonomy&language=en`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Api-Key": apiKey },
      body: JSON.stringify(body),
    });

    if (res.status === 401 || res.status === 403) {
      throw new Error("Kindwise rejected the API key (401/403)");
    }
    if (res.status === 429) {
      throw new Error("Kindwise credits exhausted or rate limited (429)");
    }
    if (!res.ok) {
      throw new Error(`Kindwise API failed: ${res.status} ${await res.text()}`);
    }

    const json = (await res.json()) as KindwiseResponse;
    const suggestions = json.result?.classification?.suggestions ?? [];

    return {
      candidates: suggestions.slice(0, 5).map((s) => {
        const common = s.details?.common_names?.[0];
        return {
          name: common ?? s.name,
          scientificName: s.name,
          confidence: s.probability,
          order: s.details?.taxonomy?.order ?? null,
          imageUrl:
            s.similar_images?.[0]?.url_small ??
            s.similar_images?.[0]?.url ??
            null,
        };
      }),
    };
  }
}
