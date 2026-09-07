import { beforeAll, describe, expect, it } from "vitest";

beforeAll(() => {
  process.env.TOKEN_SECRET = "test-secret-value-for-vitest-0000";
});

describe("crypto", () => {
  it("encrypts and decrypts a token round-trip", async () => {
    const { encryptSecret, decryptSecret } = await import("@/lib/crypto");
    const enc = encryptSecret("inat-token-abc123");
    expect(enc).not.toBe("inat-token-abc123");
    expect(decryptSecret(enc)).toBe("inat-token-abc123");
  });

  it("produces different ciphertext each time (random IV)", async () => {
    const { encryptSecret } = await import("@/lib/crypto");
    expect(encryptSecret("x")).not.toBe(encryptSecret("x"));
  });

  it("signs and verifies OAuth state", async () => {
    const { signState, verifyState } = await import("@/lib/crypto");
    const s = signState("MOTH-ABC234");
    expect(verifyState(s)).toBe("MOTH-ABC234");
  });

  it("rejects tampered or garbage state", async () => {
    const { signState, verifyState } = await import("@/lib/crypto");
    const s = signState("MOTH-ABC234");
    expect(verifyState(s.slice(0, -2) + "zz")).toBeNull();
    expect(verifyState("not-a-real-token")).toBeNull();
  });

  it("rejects expired state", async () => {
    const { signState, verifyState } = await import("@/lib/crypto");
    expect(verifyState(signState("MOTH-ABC234", -1))).toBeNull();
  });
});
