import { createHash } from "node:crypto";
import checklist from "@/data/checklist.json";
import type { IdCandidate, IdProvider } from "./types";

type Row = (typeof checklist.species)[number];
const SPECIES = checklist.species as Row[];

/**
 * Deterministic stand-in for a real vision model: hashes the image bytes to
 * pick a stable set of plausible candidates from the checklist. Lets the whole
 * identify → confirm → log flow be exercised without any API credentials.
 */
export class MockProvider implements IdProvider {
  readonly name = "mock";

  async identify(image: Buffer): Promise<IdCandidate[]> {
    const hash = createHash("sha256").update(image).digest();
    const pick = (offset: number) =>
      SPECIES[hash.readUInt32BE(offset % 28) % SPECIES.length];

    const chosen: Row[] = [];
    for (let i = 0; i < 12 && chosen.length < 3; i += 4) {
      const row = pick(i);
      if (!chosen.some((c) => c.inatTaxonId === row.inatTaxonId)) {
        chosen.push(row);
      }
    }

    const base = 0.62 + (hash[0] / 255) * 0.3; // 0.62..0.92
    return chosen.map((row, idx) => ({
      name: row.commonName,
      scientificName: row.scientificName,
      inatTaxonId: row.inatTaxonId,
      confidence: Math.max(0.05, base - idx * 0.22),
    }));
  }
}
