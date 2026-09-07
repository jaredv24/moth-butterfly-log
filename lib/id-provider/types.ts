export type IdCandidate = {
  /** Common name, e.g. "Monarch". Falls back to the scientific name. */
  name: string;
  scientificName: string;
  inatTaxonId?: number;
  /** 0..1 */
  confidence: number;
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
