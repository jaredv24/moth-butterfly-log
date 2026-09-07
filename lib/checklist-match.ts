import type { IdCandidate } from "./id-provider/types";

export type MatchLevel = "species" | "genus" | "off-list";

export type MatchableSpecies = {
  id: number;
  inatTaxonId: number;
  scientificName: string;
};

export type MatchResult<T extends MatchableSpecies> = {
  species: T | null;
  matchLevel: MatchLevel;
};

const genusOf = (scientific: string) => scientific.trim().split(/\s+/)[0]?.toLowerCase() ?? "";

/**
 * Resolve an ID candidate against the master checklist:
 *   1. exact iNaturalist taxon id
 *   2. exact scientific name (case-insensitive)
 *   3. same genus  -> reported as a "genus" level match
 *   otherwise "off-list" (species not on the North American checklist).
 */
export function matchCandidate<T extends MatchableSpecies>(
  candidate: IdCandidate,
  checklist: T[],
): MatchResult<T> {
  if (candidate.inatTaxonId != null) {
    const byId = checklist.find((s) => s.inatTaxonId === candidate.inatTaxonId);
    if (byId) return { species: byId, matchLevel: "species" };
  }

  const sci = candidate.scientificName.trim().toLowerCase();
  const byName = checklist.find((s) => s.scientificName.toLowerCase() === sci);
  if (byName) return { species: byName, matchLevel: "species" };

  const genus = genusOf(candidate.scientificName);
  if (genus) {
    const byGenus = checklist.find((s) => genusOf(s.scientificName) === genus);
    if (byGenus) return { species: byGenus, matchLevel: "genus" };
  }

  return { species: null, matchLevel: "off-list" };
}
