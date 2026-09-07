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
    const res = await provider.identify(Buffer.from("another payload"));
    expect(res.length).toBeGreaterThan(0);
    expect(res.length).toBeLessThanOrEqual(3);
    for (let i = 1; i < res.length; i++) {
      expect(res[i].confidence).toBeLessThanOrEqual(res[i - 1].confidence);
    }
    expect(res[0].scientificName).toBeTruthy();
  });

  it("differs for different images", async () => {
    const a = await provider.identify(Buffer.from("image-one"));
    const b = await provider.identify(Buffer.from("image-two-totally-different"));
    expect(a[0].scientificName).not.toBe(b[0].scientificName);
  });
});
