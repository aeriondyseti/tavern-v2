export {
  ConnectionKind,
  DirectionTier,
  FacetMode,
  KIND_DIRECTION,
  KIND_WORLD,
  KindId,
} from "@tavern/shared";

import type { ConnectionKind, DirectionTier, FacetMode, KindId } from "@tavern/shared";

export const FACET_MODES = ["always", "cue"] as const satisfies readonly FacetMode[];
export const DIRECTION_TIERS = [
  "absolute",
  "strong",
  "normal",
  "background",
] as const satisfies readonly DirectionTier[];

export const NEW_ENTRY_SENTINEL = "__new__" as const;

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
  kind: ConnectionKind;
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

export type FacetDraft = {
  id?: string;
  label: string;
  body?: string;
  mode?: FacetMode;
  position?: number;
};

export type EntryInput = {
  typeId: string;
  name: string;
  facets?: FacetDraft[];
  cues?: string[];
  connections?: { toEntryId: string; kind?: ConnectionKind }[];
  tier?: DirectionTier;
};
