import { z } from "zod";

export const KindId = z.enum(["direction", "world"]);
export type KindId = z.infer<typeof KindId>;
export const KIND_DIRECTION: KindId = "direction";
export const KIND_WORLD: KindId = "world";

export const EntryCreate = z.object({
  typeId: z.string().min(1),
  name: z.string().min(1),
  body: z.string().default(""),
  cues: z.array(z.string()).default([]),
});
export type EntryCreate = z.infer<typeof EntryCreate>;

export const EntryUpdate = EntryCreate.partial();
export type EntryUpdate = z.infer<typeof EntryUpdate>;
