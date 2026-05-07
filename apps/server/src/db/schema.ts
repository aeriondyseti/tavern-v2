import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import {
  ConnectionKind,
  DirectionTier,
  FacetMode,
  KIND_DIRECTION,
  KIND_WORLD,
  KindId,
} from "@tavern/shared";

export const KIND_IDS = KindId.options;
export const FACET_MODES = FacetMode.options;
export const CONNECTION_KINDS = ConnectionKind.options;
export const DIRECTION_TIERS = DirectionTier.options;
export { KIND_DIRECTION, KIND_WORLD };
export type { ConnectionKind, DirectionTier, FacetMode, KindId } from "@tavern/shared";

export const kinds = sqliteTable("kinds", {
  id: text("id").primaryKey(),
  label: text("label").notNull(),
});

export const types = sqliteTable(
  "types",
  {
    id: text("id").primaryKey(),
    kindId: text("kind_id")
      .notNull()
      .references(() => kinds.id),
    name: text("name").notNull(),
    position: integer("position").notNull().default(0),
    createdAt: integer("created_at")
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    kindNameIdx: uniqueIndex("types_kind_name_unique").on(t.kindId, t.name),
  }),
);

export const entries = sqliteTable(
  "entries",
  {
    id: text("id").primaryKey(),
    typeId: text("type_id")
      .notNull()
      .references(() => types.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    embeddingVec: text("embedding_vec"),
    embeddingModel: text("embedding_model"),
    createdAt: integer("created_at")
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at")
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    typeNameIdx: uniqueIndex("entries_type_name_unique").on(t.typeId, t.name),
    typeIdx: index("entries_type_idx").on(t.typeId),
  }),
);

export const facets = sqliteTable(
  "facets",
  {
    id: text("id").primaryKey(),
    entryId: text("entry_id")
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    body: text("body").notNull().default(""),
    mode: text("mode", { enum: FACET_MODES }).notNull().default("always"),
    position: integer("position").notNull().default(0),
  },
  (t) => ({
    entryIdx: index("facets_entry_idx").on(t.entryId),
  }),
);

export const cues = sqliteTable(
  "cues",
  {
    id: text("id").primaryKey(),
    entryId: text("entry_id")
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
    term: text("term").notNull(),
  },
  (t) => ({
    entryIdx: index("cues_entry_idx").on(t.entryId),
  }),
);

export const connections = sqliteTable(
  "connections",
  {
    id: text("id").primaryKey(),
    fromEntryId: text("from_entry_id")
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
    toEntryId: text("to_entry_id")
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: CONNECTION_KINDS }).notNull().default("brings"),
  },
  (t) => ({
    pairIdx: uniqueIndex("connections_pair_unique").on(t.fromEntryId, t.toEntryId, t.kind),
    fromIdx: index("connections_from_idx").on(t.fromEntryId),
  }),
);

export const directionTier = sqliteTable("direction_tier", {
  entryId: text("entry_id")
    .primaryKey()
    .references(() => entries.id, { onDelete: "cascade" }),
  tier: text("tier", { enum: DIRECTION_TIERS }).notNull().default("normal"),
});

export type EntryRow = typeof entries.$inferSelect;
export type FacetRow = typeof facets.$inferSelect;
export type CueRow = typeof cues.$inferSelect;
export type ConnectionRow = typeof connections.$inferSelect;
export type TypeRow = typeof types.$inferSelect;
export type KindRow = typeof kinds.$inferSelect;
