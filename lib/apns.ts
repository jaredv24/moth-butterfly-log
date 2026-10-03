import { createPrivateKey, sign, type KeyObject } from "node:crypto";
import { connect, type ClientHttp2Session } from "node:http2";

// Native push for the iOS app. Token-based APNs auth: one .p8 key per Apple team
// (the same key wego uses works here). Set APPLE_PRIVATE_KEY, APPLE_KEY_ID, APPLE_TEAM_ID.
const privateKey = (process.env.APPLE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n").trim();
const keyId = process.env.APPLE_KEY_ID?.trim() ?? "";
const teamId = process.env.APPLE_TEAM_ID?.trim() ?? "";
const bundleId = process.env.APPLE_BUNDLE_ID?.trim() || "com.jaredv24.leplog";

export const apnsConfigured = !!(privateKey && keyId && teamId);

const HOSTS = {
  production: "https://api.push.apple.com",
  sandbox: "https://api.sandbox.push.apple.com",
} as const;

let key: KeyObject | null = null;
let jwt: { token: string; at: number } | null = null;

/** APNs wants a fresh token at most hourly and at least every 20 minutes of reuse; 40 is safe. */
function authToken(): string {
  if (jwt && Date.now() - jwt.at < 40 * 60 * 1000) return jwt.token;
  key ??= createPrivateKey(privateKey);
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const body = `${b64({ alg: "ES256", kid: keyId })}.${b64({ iss: teamId, iat: Math.floor(Date.now() / 1000) })}`;
  const sig = sign("sha256", Buffer.from(body), { key, dsaEncoding: "ieee-p1363" }).toString("base64url");
  jwt = { token: `${body}.${sig}`, at: Date.now() };
  return jwt.token;
}

export type ApnsMessage = {
  body: string;
  title?: string;
  badge?: number;
  /** Same id = groups/replaces earlier notifications from the same thread. */
  threadId?: string;
  /** Extra top-level keys the app reads on tap, e.g. { url: "/chat/<id>" }. */
  data?: Record<string, string>;
};

/**
 * Sends one notification to each device. Returns the tokens Apple says are dead
 * (app removed, token changed) so the caller can forget them. Never throws.
 */
export async function sendApns(
  devices: { token: string; environment: string }[],
  m: ApnsMessage,
): Promise<string[]> {
  if (!apnsConfigured || !devices.length) return [];
  let auth: string;
  try {
    auth = authToken();
  } catch (err) {
    console.error("apns: bad APPLE_PRIVATE_KEY", err);
    return [];
  }
  const payload = JSON.stringify({
    aps: {
      alert: m.title ? { title: m.title, body: m.body } : { body: m.body },
      sound: "default",
      ...(m.badge != null ? { badge: m.badge } : {}),
      ...(m.threadId ? { "thread-id": m.threadId } : {}),
    },
    ...m.data,
  });

  const dead: string[] = [];
  const byEnv = new Map<string, string[]>();
  for (const d of devices) byEnv.set(d.environment, [...(byEnv.get(d.environment) ?? []), d.token]);

  for (const [environment, tokens] of byEnv) {
    let session: ClientHttp2Session | null = null;
    try {
      session = connect(environment === "sandbox" ? HOSTS.sandbox : HOSTS.production);
      session.on("error", () => {});
      await Promise.all(
        tokens.map(
          (token) =>
            new Promise<void>((resolve) => {
              const req = session!.request({
                ":method": "POST",
                ":path": `/3/device/${token}`,
                authorization: `bearer ${auth}`,
                "apns-topic": bundleId,
                "apns-push-type": "alert",
                "apns-priority": "10",
              });
              let status = 0;
              let body = "";
              req.setEncoding("utf8");
              req.on("response", (h) => (status = Number(h[":status"])));
              req.on("data", (c) => (body += c));
              req.on("end", () => {
                if (status === 410 || (status === 400 && /BadDeviceToken|DeviceTokenNotForTopic/.test(body))) {
                  dead.push(token);
                } else if (status !== 200) {
                  console.error("apns", status, body.slice(0, 200));
                }
                resolve();
              });
              req.on("error", () => resolve());
              req.setTimeout(10_000, () => req.close());
              req.end(payload);
            }),
        ),
      );
    } catch (err) {
      console.error("apns connect failed", err instanceof Error ? err.message : err);
    } finally {
      session?.close();
    }
  }
  return dead;
}
