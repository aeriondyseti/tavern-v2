import { sql } from "drizzle-orm";
import { blob, check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import type {
  ConnectionKind,
  DirectionTier,
  FacetMode,
  KindId,
} from "@tavern/shared";

// Hardcoded here (rather than imported from @tavern/shared) because drizzle-kit's
// CJS loader can't resolve through workspace TS sources. The `satisfies` clauses
// pin them to the shared Zod-derived types so any drift is a typecheck error.
export const KIND_IDS = ["direction", "world"] as const satisfies readonly KindId[];
export const FACET_MODES = ["always", "cue"] as const satisfies readonly FacetMode[];
export const CONNECTION_KINDS = ["brings"] as const satisfies readonly ConnectionKind[];
export const DIRECTION_TIERS = [
  "absolute",
  "strong",
  "normal",
  "background",
] as const satisfies readonly DirectionTier[];

export const KIND_DIRECTION: KindId = "direction";
export const KIND_WORLD: KindId = "world";
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
    embeddingVec: blob("embedding_vec", { mode: "buffer" }),
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

export const SETUP_SCOPES = ["tale", "scene"] as const;
export type SetupScope = (typeof SETUP_SCOPES)[number];

export const setups = sqliteTable("setups", {
  id: text("id").primaryKey(),
  scope: text("scope", { enum: SETUP_SCOPES }).notNull(),
  data: text("data", { mode: "json" }).$type<import("@tavern/shared").SetupData>().notNull(),
});

export const tales = sqliteTable("tales", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  anchorProse: text("anchor_prose").notNull().default(""),
  setupId: text("setup_id")
    .notNull()
    .references(() => setups.id),
  activeSceneId: text("active_scene_id"),
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at")
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const scenes = sqliteTable(
  "scenes",
  {
    id: text("id").primaryKey(),
    taleId: text("tale_id")
      .notNull()
      .references(() => tales.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    anchorProse: text("anchor_prose").notNull().default(""),
    adjustmentsId: text("adjustments_id").references(() => setups.id),
    position: integer("position").notNull().default(0),
    createdAt: integer("created_at")
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    taleIdx: index("scenes_tale_idx").on(t.taleId),
  }),
);

export const pinned = sqliteTable(
  "pinned",
  {
    id: text("id").primaryKey(),
    taleId: text("tale_id").references(() => tales.id, { onDelete: "cascade" }),
    sceneId: text("scene_id").references(() => scenes.id, { onDelete: "cascade" }),
    entryId: text("entry_id")
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
  },
  (t) => ({
    taleIdx: index("pinned_tale_idx").on(t.taleId),
    sceneIdx: index("pinned_scene_idx").on(t.sceneId),
    scopeCheck: check(
      "pinned_scope_check",
      sql`${t.taleId} IS NOT NULL OR ${t.sceneId} IS NOT NULL`,
    ),
  }),
);

export const anchorFacets = sqliteTable(
  "anchor_facets",
  {
    id: text("id").primaryKey(),
    taleId: text("tale_id")
      .notNull()
      .references(() => tales.id, { onDelete: "cascade" }),
    sceneId: text("scene_id").references(() => scenes.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    body: text("body").notNull().default(""),
    position: integer("position").notNull().default(0),
  },
  (t) => ({
    taleIdx: index("anchor_facets_tale_idx").on(t.taleId),
    sceneIdx: index("anchor_facets_scene_idx").on(t.sceneId),
  }),
);

export type EntryRow = typeof entries.$inferSelect;
export type FacetRow = typeof facets.$inferSelect;
export type CueRow = typeof cues.$inferSelect;
export type ConnectionRow = typeof connections.$inferSelect;
export type TypeRow = typeof types.$inferSelect;
export type KindRow = typeof kinds.$inferSelect;
export type TaleRow = typeof tales.$inferSelect;
export type SceneRow = typeof scenes.$inferSelect;
export type SetupRow = typeof setups.$inferSelect;
export type PinnedRow = typeof pinned.$inferSelect;
export type AnchorFacetRow = typeof anchorFacets.$inferSelect;
