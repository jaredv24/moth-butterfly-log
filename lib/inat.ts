const WWW = "https://www.inaturalist.org";
const API = "https://api.inaturalist.org/v1";

export function inatConfigured(): boolean {
  return !!(process.env.INAT_OAUTH_CLIENT_ID && process.env.INAT_OAUTH_CLIENT_SECRET);
}

export function authorizeUrl(state: string, redirectUri: string): string {
  const p = new URLSearchParams({
    client_id: process.env.INAT_OAUTH_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: "code",
    state,
  });
  return `${WWW}/oauth/authorize?${p}`;
}

/** Exchange an authorization code for a (durable) access token. */
export async function exchangeCode(code: string, redirectUri: string): Promise<string> {
  const res = await fetch(`${WWW}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.INAT_OAUTH_CLIENT_ID,
      client_secret: process.env.INAT_OAUTH_CLIENT_SECRET,
      code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`iNat token exchange failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error("iNat token exchange returned no access_token");
  return json.access_token;
}

// api_token (JWT) is valid ~24h; cache per access token.
const jwtCache = new Map<string, { jwt: string; expiresAt: number }>();

export async function getJwt(accessToken: string): Promise<string> {
  const hit = jwtCache.get(accessToken);
  if (hit && hit.expiresAt > Date.now()) return hit.jwt;

  const res = await fetch(`${WWW}/users/api_token`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`iNat api_token failed: ${res.status}`);
  const { api_token } = (await res.json()) as { api_token: string };
  jwtCache.set(accessToken, { jwt: api_token, expiresAt: Date.now() + 23 * 3600_000 });
  return api_token;
}

export async function getInatUser(jwt: string): Promise<{ id: number; login: string }> {
  const res = await fetch(`${API}/users/me`, { headers: { Authorization: jwt } });
  if (!res.ok) throw new Error(`iNat users/me failed: ${res.status}`);
  const json = (await res.json()) as { results: { id: number; login: string }[] };
  return json.results[0];
}

export type ObservationInput = {
  speciesGuess: string;
  taxonId?: number | null;
  observedOn: string; // ISO
  latitude?: number | null;
  longitude?: number | null;
  description?: string;
};

export async function createObservation(
  jwt: string,
  input: ObservationInput,
): Promise<number> {
  const observation: Record<string, unknown> = {
    species_guess: input.speciesGuess,
    observed_on_string: input.observedOn,
    description: input.description,
  };
  if (input.taxonId) observation.taxon_id = input.taxonId;
  if (input.latitude != null && input.longitude != null) {
    observation.latitude = input.latitude;
    observation.longitude = input.longitude;
  }

  const res = await fetch(`${API}/observations`, {
    method: "POST",
    headers: { Authorization: jwt, "Content-Type": "application/json" },
    body: JSON.stringify({ observation }),
  });
  if (!res.ok) throw new Error(`iNat create observation failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { id?: number };
  if (!json.id) throw new Error("iNat create observation returned no id");
  return json.id;
}

export async function attachPhoto(
  jwt: string,
  observationId: number,
  bytes: Buffer,
  contentType: string,
): Promise<void> {
  const form = new FormData();
  form.append("observation_photo[observation_id]", String(observationId));
  form.append(
    "file",
    new Blob([new Uint8Array(bytes)], { type: contentType }),
    "photo.jpg",
  );
  const res = await fetch(`${API}/observation_photos`, {
    method: "POST",
    headers: { Authorization: jwt },
    body: form,
  });
  if (!res.ok) throw new Error(`iNat attach photo failed: ${res.status} ${await res.text()}`);
}

export async function deleteObservation(jwt: string, id: number): Promise<void> {
  await fetch(`${API}/observations/${id}`, {
    method: "DELETE",
    headers: { Authorization: jwt },
  });
}
