import { z } from "zod";

export const KindId = z.enum(["direction", "world"]);
export type KindId = z.infer<typeof KindId>;
export const KIND_DIRECTION: KindId = "direction";
export const KIND_WORLD: KindId = "world";

export const FacetMode = z.enum(["always", "cue"]);
export type FacetMode = z.infer<typeof FacetMode>;

export const ConnectionKind = z.enum(["brings"]);
export type ConnectionKind = z.infer<typeof ConnectionKind>;

export const DirectionTier = z.enum(["absolute", "strong", "normal", "background"]);
export type DirectionTier = z.infer<typeof DirectionTier>;

export const FacetInput = z.object({
  id: z.string().optional(),
  label: z.string().min(1),
  body: z.string().default(""),
  mode: FacetMode.default("always"),
  position: z.number().int().nonnegative().optional(),
});
export type FacetInput = z.infer<typeof FacetInput>;

export const ConnectionInput = z.object({
  toEntryId: z.string().min(1),
  kind: ConnectionKind.default("brings"),
});
export type ConnectionInput = z.infer<typeof ConnectionInput>;

export const EntryCreate = z.object({
  typeId: z.string().min(1),
  name: z.string().min(1),
  facets: z.array(FacetInput).default([]),
  cues: z.array(z.string()).default([]),
  connections: z.array(ConnectionInput).default([]),
  tier: DirectionTier.optional(),
});
export type EntryCreate = z.infer<typeof EntryCreate>;

export const EntryUpdate = EntryCreate.partial();
export type EntryUpdate = z.infer<typeof EntryUpdate>;
