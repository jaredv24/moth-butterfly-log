import { describe, expect, it } from "vitest";
import { matchCandidate, type MatchableSpecies } from "@/lib/checklist-match";
import type { IdCandidate } from "@/lib/id-provider/types";

const checklist: MatchableSpecies[] = [
  { id: 1, inatTaxonId: 48662, scientificName: "Danaus plexippus" },
  { id: 2, inatTaxonId: 60606, scientificName: "Papilio glaucus" },
  { id: 3, inatTaxonId: 12345, scientificName: "Papilio polyxenes" },
];

const cand = (c: Partial<IdCandidate>): IdCandidate => ({
  name: "x",
  scientificName: "x",
  confidence: 0.5,
  ...c,
});

describe("matchCandidate", () => {
  it("matches on iNaturalist taxon id first", () => {
    const r = matchCandidate(
      cand({ inatTaxonId: 48662, scientificName: "wrong name" }),
      checklist,
    );
    expect(r.species?.id).toBe(1);
    expect(r.matchLevel).toBe("species");
  });

  it("matches on scientific name case-insensitively", () => {
    const r = matchCandidate(cand({ scientificName: "papilio GLAUCUS" }), checklist);
    expect(r.species?.id).toBe(2);
    expect(r.matchLevel).toBe("species");
  });

  it("falls back to a genus-level match", () => {
    const r = matchCandidate(cand({ scientificName: "Papilio cresphontes" }), checklist);
    expect(r.species?.scientificName.startsWith("Papilio")).toBe(true);
    expect(r.matchLevel).toBe("genus");
  });

  it("reports off-list when nothing matches", () => {
    const r = matchCandidate(cand({ scientificName: "Attacus atlas" }), checklist);
    expect(r.species).toBeNull();
    expect(r.matchLevel).toBe("off-list");
  });
});
