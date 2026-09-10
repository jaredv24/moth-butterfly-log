import { customAlphabet } from "nanoid";

// No 0/O/1/I/L to keep codes easy to read aloud and retype.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const nano6 = customAlphabet(ALPHABET, 6);
const nano8 = customAlphabet(ALPHABET, 8);

/** Secret login code — the key to a log. e.g. "MOTH-7X2Q4A" */
export function generateUserCode(): string {
  return `MOTH-${nano6()}`;
}

/** Shareable follow code — lets others view your log read-only. e.g. "PAL-7X2Q4A8B" */
export function generateFriendCode(): string {
  return `PAL-${nano8()}`;
}

export function normalizeUserCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

export function isValidUserCode(code: string): boolean {
  return new RegExp(`^MOTH-[${ALPHABET}]{6}$`).test(code);
}

export function isValidFriendCode(code: string): boolean {
  return new RegExp(`^PAL-[${ALPHABET}]{8}$`).test(code);
}

/** Trim + collapse inner whitespace; returns null if it isn't a valid username. */
export function cleanUsername(raw: string): string | null {
  const u = raw.trim().replace(/\s+/g, " ");
  return /^[\p{L}\p{N} ._-]{2,24}$/u.test(u) ? u : null;
}

/** Short nickname shown in parens after the profile name. 1–16 chars. */
export function cleanNickname(raw: string): string | null {
  const n = raw.trim().replace(/\s+/g, " ");
  return /^[\p{L}\p{N} ._-]{1,16}$/u.test(n) ? n : null;
}
