import type { IdOptions, IdProvider, IdResult } from "./types";

const OAUTH_TOKEN_URL = "https://www.inaturalist.org/oauth/token";
const API_TOKEN_URL = "https://www.inaturalist.org/users/api_token";
const SCORE_IMAGE_URL =
  "https://api.inaturalist.org/v1/computervision/score_image";

type Cached = { jwt: string; expiresAt: number };
let cache: Cached | null = null;

function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`${key} is required for ID_PROVIDER=inaturalist`);
  return v;
}

/** Obtain (and cache ~23h) a JWT api_token via the OAuth password grant. */
async function getJwt(): Promise<string> {
  if (cache && cache.expiresAt > Date.now()) return cache.jwt;

  const oauthRes = await fetch(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: requireEnv("INAT_APP_ID"),
      client_secret: requireEnv("INAT_APP_SECRET"),
      grant_type: "password",
      username: requireEnv("INAT_USERNAME"),
      password: requireEnv("INAT_PASSWORD"),
    }),
  });
  if (!oauthRes.ok) {
    throw new Error(`iNat OAuth failed: ${oauthRes.status} ${await oauthRes.text()}`);
  }
  const { access_token } = (await oauthRes.json()) as { access_token: string };

  const jwtRes = await fetch(API_TOKEN_URL, {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  if (!jwtRes.ok) {
    throw new Error(`iNat api_token failed: ${jwtRes.status} ${await jwtRes.text()}`);
  }
  const { api_token } = (await jwtRes.json()) as { api_token: string };

  cache = { jwt: api_token, expiresAt: Date.now() + 23 * 60 * 60 * 1000 };
  return api_token;
}

type ScoreResult = {
  combined_score?: number;
  vision_score?: number;
  taxon?: {
    id: number;
    name: string;
    rank: string;
    preferred_common_name?: string;
  };
};

export class INaturalistProvider implements IdProvider {
  readonly name = "inaturalist";

  async identify(image: Buffer, opts: IdOptions): Promise<IdResult> {
    const jwt = await getJwt();

    const form = new FormData();
    form.append(
      "image",
      new Blob([new Uint8Array(image)], { type: "image/jpeg" }),
      "photo.jpg",
    );
    if (opts.lat != null) form.append("lat", String(opts.lat));
    if (opts.lng != null) form.append("lng", String(opts.lng));
    if (opts.observedOn) form.append("observed_on", opts.observedOn);

    const res = await fetch(SCORE_IMAGE_URL, {
      method: "POST",
      headers: { Authorization: jwt },
      body: form,
    });
    if (res.status === 401) {
      cache = null; // force refresh next call
      throw new Error("iNat vision API returned 401 — token rejected");
    }
    if (!res.ok) {
      throw new Error(`iNat vision API failed: ${res.status} ${await res.text()}`);
    }

    const json = (await res.json()) as { results?: ScoreResult[] };
    return {
      candidates: (json.results ?? [])
        .filter((r) => r.taxon && r.taxon.rank === "species")
        .slice(0, 5)
        .map((r) => ({
          name: r.taxon!.preferred_common_name ?? r.taxon!.name,
          scientificName: r.taxon!.name,
          inatTaxonId: r.taxon!.id,
          confidence:
            r.combined_score != null
              ? r.combined_score / 100
              : (r.vision_score ?? 0),
        })),
    };
  }
}
