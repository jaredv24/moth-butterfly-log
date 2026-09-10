export type IdCandidate = {
  /** Common name, e.g. "Monarch". Falls back to the scientific name. */
  name: string;
  scientificName: string;
  inatTaxonId?: number;
  /** 0..1 */
  confidence: number;
  /** Taxonomic order from the provider, e.g. "Coleoptera" (used for grouping non-Lep critters). */
  order?: string | null;
  /** Taxonomic class, e.g. "Reptilia" — a coarser fallback for grouping. */
  taxonClass?: string | null;
  /** A representative photo of the species from the provider, if any. */
  imageUrl?: string | null;
};

export type IdOptions = {
  lat?: number;
  lng?: number;
  /** ISO date (YYYY-MM-DD) the photo was taken. */
  observedOn?: string;
};

export interface IdProvider {
  readonly name: string;
  identify(image: Buffer, opts: IdOptions): Promise<IdCandidate[]>;
}
