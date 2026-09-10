import { describe, expect, it } from "vitest";
import { MockProvider } from "@/lib/id-provider/mock";

describe("MockProvider", () => {
  const provider = new MockProvider();

  it("returns deterministic candidates for the same image bytes", async () => {
    const img = Buffer.from("a fake jpeg payload for testing");
    const a = await provider.identify(img);
    const b = await provider.identify(img);
    expect(a).toEqual(b);
  });

  it("returns up to 3 candidates with descending confidence", async () => {
    const { candidates } = await provider.identify(Buffer.from("another payload"));
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.length).toBeLessThanOrEqual(3);
    for (let i = 1; i < candidates.length; i++) {
      expect(candidates[i].confidence).toBeLessThanOrEqual(
        candidates[i - 1].confidence,
      );
    }
    expect(candidates[0].scientificName).toBeTruthy();
  });

  it("differs for different images", async () => {
    const { candidates: a } = await provider.identify(Buffer.from("image-one"));
    const { candidates: b } = await provider.identify(
      Buffer.from("image-two-totally-different"),
    );
    expect(a[0].scientificName).not.toBe(b[0].scientificName);
  });
});
