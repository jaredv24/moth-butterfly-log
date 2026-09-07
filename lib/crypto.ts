import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

/**
 * Signing/encryption key. Uses TOKEN_SECRET when set (recommended); otherwise
 * derives a stable key from DATABASE_URL so device auth and token encryption
 * work out of the box. Set TOKEN_SECRET explicitly to harden.
 */
function key(): Buffer {
  const secret =
    process.env.TOKEN_SECRET ??
    (process.env.DATABASE_URL
      ? `db:${process.env.DATABASE_URL}`
      : "moth-butterfly-log-dev-fallback");
  return createHash("sha256").update(secret).digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]).toString("base64");
}

export function decryptSecret(payload: string): string {
  const buf = Buffer.from(payload, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

/**
 * A device-auth token: HMAC-signed "<userId>.<issuedMs>". Proves this device
 * has already authenticated for that user, so we don't re-prompt for a password.
 */
export function signDeviceToken(userId: string): string {
  const body = `${userId}.${Date.now()}`;
  const sig = createHmac("sha256", key()).update(body).digest("base64url");
  return `${Buffer.from(body).toString("base64url")}.${sig}`;
}

export function readDeviceToken(token: string): string | null {
  const [b64, sig] = token.split(".");
  if (!b64 || !sig) return null;
  const body = Buffer.from(b64, "base64url").toString("utf8");
  const expected = createHmac("sha256", key()).update(body).digest("base64url");
  if (
    sig.length !== expected.length ||
    !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  ) {
    return null;
  }
  return body.split(".")[0] || null; // userId
}

/** Signed, time-limited value for OAuth `state`. */
export function signState(value: string, ttlSec = 600): string {
  const body = `${value}.${Date.now() + ttlSec * 1000}`;
  const sig = createHmac("sha256", key()).update(body).digest("base64url");
  return `${Buffer.from(body).toString("base64url")}.${sig}`;
}

export function verifyState(token: string): string | null {
  const [b64, sig] = token.split(".");
  if (!b64 || !sig) return null;
  const body = Buffer.from(b64, "base64url").toString("utf8");
  const expected = createHmac("sha256", key()).update(body).digest("base64url");
  if (
    sig.length !== expected.length ||
    !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  ) {
    return null;
  }
  const [value, exp] = body.split(".");
  if (Number(exp) < Date.now()) return null;
  return value;
}
