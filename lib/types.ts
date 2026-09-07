export type Group = "butterfly" | "moth";
export type MatchLevel = "species" | "genus" | "off-list";

export type ChecklistItem = {
  id: number;
  inatTaxonId: number;
  commonName: string;
  scientificName: string;
  group: Group;
  family: string;
  thumbUrl: string | null;
};

export type PlausibilityVerdict =
  | "expected"
  | "possible"
  | "unusual"
  | "out-of-area"
  | "unknown";

export type Candidate = {
  name: string;
  scientificName: string;
  inatTaxonId: number | null;
  confidence: number;
  match: {
    speciesId: number | null;
    matchLevel: MatchLevel;
    commonName: string;
    scientificName: string;
    group: Group | null;
    family: string | null;
    thumbUrl: string | null;
  };
  plausibility: { verdict: PlausibilityVerdict; note: string } | null;
};

export type IdentifyResponse = {
  candidates: Candidate[];
};

export type LogItem = {
  id: string;
  speciesId: number | null;
  identifiedName: string;
  identifiedScientific: string;
  confidence: number | null;
  matchLevel: MatchLevel;
  photoUrl: string;
  placeLabel: string | null;
  lat: number | null;
  lng: number | null;
  observedAt: string;
  inatObservationId: number | null;
};

export type InatStatus = {
  configured: boolean;
  connected: boolean;
  username: string | null;
  syncEnabled: boolean;
  unsyncedCount: number;
};

export type LogResponse = {
  log: LogItem[];
  stats: {
    totalButterflies: number;
    totalMoths: number;
    butterfliesSeen: number;
    mothsSeen: number;
  };
};
