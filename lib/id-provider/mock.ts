import { createHash } from "node:crypto";
import checklist from "@/data/checklist.json";
import type { IdCandidate, IdProvider, IdResult } from "./types";

type Row = (typeof checklist.species)[number];
const SPECIES = checklist.species as Row[];

// A few off-checklist bugs so the "other bugs" path is exercisable with the mock.
const OFF_LIST_BUGS: IdCandidate[] = [
  {
    name: "Seven-spotted Lady Beetle",
    scientificName: "Coccinella septempunctata",
    confidence: 0.8,
    order: "Coleoptera",
    imageUrl:
      "https://inaturalist-open-data.s3.amazonaws.com/photos/267168450/square.jpg",
  },
  {
    name: "Common Green Darner",
    scientificName: "Anax junius",
    confidence: 0.77,
    order: "Odonata",
    imageUrl:
      "https://inaturalist-open-data.s3.amazonaws.com/photos/10604112/square.jpg",
  },
  {
    name: "Western Honey Bee",
    scientificName: "Apis mellifera",
    confidence: 0.74,
    order: "Hymenoptera",
    imageUrl: "https://static.inaturalist.org/photos/2369526/square.jpg",
  },
];

/**
 * Deterministic stand-in for a real vision model: hashes the image bytes to
 * pick a stable set of plausible candidates from the checklist. Lets the whole
 * identify → confirm → log flow be exercised without any API credentials.
 */
export class MockProvider implements IdProvider {
  readonly name = "mock";

  async identify(image: Buffer): Promise<IdResult> {
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
    const candidates: IdCandidate[] = chosen.map((row, idx) => ({
      name: row.commonName,
      scientificName: row.scientificName,
      inatTaxonId: row.inatTaxonId,
      confidence: Math.max(0.05, base - idx * 0.22),
    }));

    // ~1 in 4 images: it's actually an off-checklist bug
    if (hash[1] % 4 === 0) {
      return { candidates: [OFF_LIST_BUGS[hash[2] % OFF_LIST_BUGS.length]] };
    }
    return { candidates };
  }
}
