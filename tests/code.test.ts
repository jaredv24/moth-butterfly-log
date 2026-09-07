import { describe, expect, it } from "vitest";
import {
  generateUserCode,
  isValidUserCode,
  normalizeUserCode,
} from "@/lib/code";

describe("user code", () => {
  it("generates valid, unambiguous codes", () => {
    for (let i = 0; i < 200; i++) {
      const c = generateUserCode();
      expect(isValidUserCode(c)).toBe(true);
      expect(c.slice(5)).not.toMatch(/[01OIL]/); // suffix only; "MOTH-" has an O
      expect(c.slice(5)).toHaveLength(6);
    }
  });

  it("normalizes casing and whitespace", () => {
    expect(normalizeUserCode("  moth-7x2q4a ")).toBe("MOTH-7X2Q4A");
  });

  it("rejects malformed codes", () => {
    expect(isValidUserCode("MOTH-123")).toBe(false);
    expect(isValidUserCode("7X2Q4A")).toBe(false);
    expect(isValidUserCode("MOTH-7X2Q4O")).toBe(false); // O not allowed
  });
});
