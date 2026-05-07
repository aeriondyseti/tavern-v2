export { KIND_DIRECTION, KIND_WORLD, KindId } from "@tales/shared";

import type { KindId } from "@tales/shared";

export const NEW_ENTRY_SENTINEL = "__new__" as const;

export type Kind = { id: KindId; label: string };

export type Type = {
  id: string;
  kindId: KindId;
  name: string;
  position: number;
};

export type Entry = {
  id: string;
  typeId: string;
  name: string;
  body: string;
  cues: string[];
  embeddingModel: string | null;
  hasEmbedding: boolean;
  createdAt: number;
  updatedAt: number;
};
