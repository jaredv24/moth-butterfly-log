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
  otherGroup: string | null;
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
  placeLabel: string | null;
  observedAt: string;
  /** subject-cropped photo (data URL) the identifier analysed, if it cropped */
  croppedPhoto: string | null;
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
  inatTaxonId: number | null;
  refPhotoUrl: string | null;
  otherGroup: string | null;
};

export type NearbyResponse = {
  month: number;
  monthName: string;
  radiusKm: number;
  species: (ChecklistItem & { nearbyCount: number })[];
};

export type InatStatus = {
  configured: boolean;
  connected: boolean;
  username: string | null;
  syncEnabled: boolean;
  unsyncedCount: number;
};

/** A sighting summary as embedded in a chat message. */
export type SharedSighting = {
  id: string;
  identifiedName: string;
  identifiedScientific: string;
  photoUrl: string;
  placeLabel: string | null;
  observedAt: string;
  ownerUserId: string;
};

export type ChatMessage = {
  id: string;
  body: string | null;
  sighting: SharedSighting | null;
  at: string;
  mine: boolean;
};

export type ChatThreadSummary = {
  userId: string;
  name: string | null;
  avatarUrl: string | null;
  lastMessage: { preview: string; at: string; mine: boolean } | null;
  unread: number;
};

export type ThreadsResponse = {
  threads: ChatThreadSummary[];
  totalUnread: number;
};

export type ThreadResponse = {
  friend: { userId: string; name: string | null; avatarUrl: string | null };
  messages: ChatMessage[];
};

export type CritterKind = "arthropod" | "critter";

export type LogResponse = {
  log: LogItem[];
  stats: {
    totalButterflies: number;
    totalMoths: number;
    butterfliesSeen: number;
    mothsSeen: number;
    otherSpecies: number;
    otherGroups: { group: string; species: number; kind: CritterKind }[];
  };
};
