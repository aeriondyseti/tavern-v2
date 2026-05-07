export const KIND_DIRECTION = "direction";
export const KIND_WORLD = "world";
export type KindId = "direction" | "world";

export const FACET_MODES = ["always", "cue"] as const;
export type FacetMode = (typeof FACET_MODES)[number];

export const DIRECTION_TIERS = ["absolute", "strong", "normal", "background"] as const;
export type DirectionTier = (typeof DIRECTION_TIERS)[number];

export type Kind = { id: KindId; label: string };

export type Type = {
  id: string;
  kindId: KindId;
  name: string;
  position: number;
};

export type Facet = {
  id: string;
  entryId: string;
  label: string;
  body: string;
  mode: FacetMode;
  position: number;
};

export type Connection = {
  id: string;
  toEntryId: string;
  kind: "brings";
};

export type Entry = {
  id: string;
  typeId: string;
  name: string;
  facets: Facet[];
  cues: string[];
  connections: Connection[];
  tier: DirectionTier | null;
  embeddingModel: string | null;
  hasEmbedding: boolean;
  createdAt: number;
  updatedAt: number;
};

export type FacetInput = {
  id?: string;
  label: string;
  body?: string;
  mode?: FacetMode;
  position?: number;
};

export type EntryInput = {
  typeId: string;
  name: string;
  facets?: FacetInput[];
  cues?: string[];
  connections?: { toEntryId: string; kind?: "brings" }[];
  tier?: DirectionTier;
};
