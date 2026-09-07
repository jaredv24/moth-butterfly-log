import { customAlphabet } from "nanoid";

// No 0/O/1/I/L to keep codes easy to read aloud and retype.
const nano = customAlphabet("23456789ABCDEFGHJKMNPQRSTUVWXYZ", 6);

/** e.g. "MOTH-7X2Q4A" */
export function generateUserCode(): string {
  return `MOTH-${nano()}`;
}

export function normalizeUserCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

export function isValidUserCode(code: string): boolean {
  return /^MOTH-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/.test(code);
}
