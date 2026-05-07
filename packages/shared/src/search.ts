import { z } from "zod";

import { KindId } from "./catalog.js";

export const SearchRequest = z.object({
  query: z.string().min(1),
  types: z.array(z.string()).optional(),
  kindId: KindId.optional(),
  maxResults: z.number().int().positive().default(8),
  threshold: z.number().min(0).max(1).default(0.25),
  keywordWeight: z.number().min(0).max(1).default(0.4),
  embeddingWeight: z.number().min(0).max(1).default(0.6),
});
export type SearchRequest = z.infer<typeof SearchRequest>;

export type SearchCandidate = {
  entryId: string;
  name: string;
  bm25: number;
  embeddingSim: number;
  blended: number;
  selected: boolean;
};

export type EmbedderStatus =
  | { state: "idle" }
  | { state: "loading"; model: string; file?: string; progress?: number }
  | { state: "ready"; model: string }
  | { state: "error"; model: string; message: string };
