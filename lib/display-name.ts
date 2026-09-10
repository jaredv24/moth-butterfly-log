/**
 * How a person is shown to friends: "profileName (nickname)" when both are set,
 * otherwise whichever exists, then the optional fallback (e.g. iNat username).
 */
export function displayName(
  username: string | null | undefined,
  nickname: string | null | undefined,
  fallback: string | null | undefined = null,
): string | null {
  const u = username?.trim() || null;
  const n = nickname?.trim() || null;
  if (u && n) return `${u} (${n})`;
  return u ?? n ?? fallback?.trim() ?? null;
}
