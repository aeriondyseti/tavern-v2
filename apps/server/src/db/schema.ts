import { sql } from "drizzle-orm";
import { blob, check, index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

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

export const BEAT_STATUSES = ["streaming", "complete", "cancelled", "error"] as const;
export type BeatStatus = (typeof BEAT_STATUSES)[number];

export const beats = sqliteTable(
  "beats",
  {
    id: text("id").primaryKey(),
    sceneId: text("scene_id")
      .notNull()
      .references(() => scenes.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    playerInput: text("player_input").notNull(),
    narratorOutput: text("narrator_output").notNull().default(""),
    status: text("status", { enum: BEAT_STATUSES }).notNull().default("streaming"),
    alts: text("alts", { mode: "json" })
      .$type<Array<{ narratorOutput: string; transcriptId?: string; createdAt: number }>>()
      .notNull()
      .default([]),
    activeAlt: integer("active_alt").notNull().default(-1),
    createdAt: integer("created_at")
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    completedAt: integer("completed_at"),
  },
  (t) => ({
    sceneIdx: index("beats_scene_idx").on(t.sceneId),
  }),
);

export const beatTranscripts = sqliteTable(
  "beat_transcripts",
  {
    id: text("id").primaryKey(),
    beatId: text("beat_id")
      .notNull()
      .references(() => beats.id, { onDelete: "cascade" }),
    altIndex: integer("alt_index").notNull().default(-1),
    requestBody: text("request_body", { mode: "json" }).$type<unknown>(),
    events: text("events", { mode: "json" }).$type<unknown[]>().notNull().default([]),
    searchCalls: text("search_calls", { mode: "json" })
      .$type<unknown[]>()
      .notNull()
      .default([]),
    model: text("model").notNull(),
    durationMs: integer("duration_ms"),
    createdAt: integer("created_at")
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    beatIdx: index("beat_transcripts_beat_idx").on(t.beatId),
  }),
);

export const EMBEDDING_PROVIDERS = ["local", "api"] as const;
export type EmbeddingProviderKind = (typeof EMBEDDING_PROVIDERS)[number];

export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey(),
  defaultModel: text("default_model").notNull().default("claude-opus-4-7"),
  defaultTemperature: real("default_temperature").notNull().default(1.0),
  defaultMaxTokens: integer("default_max_tokens").notNull().default(4096),
  defaultThinkingBudget: integer("default_thinking_budget"),
  embeddingProvider: text("embedding_provider", { enum: EMBEDDING_PROVIDERS })
    .notNull()
    .default("local"),
  embeddingModelLocal: text("embedding_model_local")
    .notNull()
    .default("Xenova/bge-small-en-v1.5"),
  embeddingApiUrl: text("embedding_api_url"),
  embeddingApiKey: text("embedding_api_key"),
  embeddingApiModel: text("embedding_api_model"),
});

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
export type BeatRow = typeof beats.$inferSelect;
export type BeatTranscriptRow = typeof beatTranscripts.$inferSelect;
export type SettingsRow = typeof settings.$inferSelect;
