import {
  type AnchorFacet,
  defaultSetup,
  newId,
  type PinnedEntry,
  type Scene,
  type SceneSummary,
  type SetupData,
  type Story,
  type StorySummary,
} from "@tales/shared";
import { asc, eq, inArray, max, sql } from "drizzle-orm";

import type { Db } from "../db/client.js";
import {
  type AnchorFacetRow,
  anchorFacets,
  entries,
  pinned,
  type SceneRow,
  type SetupScope,
  type StoryRow,
  scenes,
  setups,
  stories,
} from "../db/schema.js";
import { ensureSettings } from "../settings/repo.js";

export type {
  AnchorFacet,
  PinnedEntry,
  Scene,
  SceneSummary,
  Story,
  StorySummary,
} from "@tales/shared";

export type PinnedScope = { kind: "story"; id: string } | { kind: "scene"; id: string };

const pinnedScopeCond = (scope: PinnedScope) =>
  scope.kind === "story" ? eq(pinned.storyId, scope.id) : eq(pinned.sceneId, scope.id);

const now = () => Date.now();

const insertSetup = (db: Db, scope: SetupScope, data: SetupData): string => {
  const id = newId();
  db.insert(setups).values({ id, scope, data }).run();
  return id;
};

export const listStories = (db: Db): StorySummary[] => {
  const rows = db.select().from(stories).orderBy(asc(stories.name)).all();
  if (rows.length === 0) return [];
  const counts = db
    .select({ storyId: scenes.storyId, n: sql<number>`count(*)`.as("n") })
    .from(scenes)
    .groupBy(scenes.storyId)
    .all();
  const countByStory = new Map(counts.map((c) => [c.storyId, Number(c.n)]));
  return rows.map((r) => storySummary(r, countByStory.get(r.id) ?? 0));
};

const storySummary = (row: StoryRow, sceneCount: number): StorySummary => ({
  id: row.id,
  name: row.name,
  description: row.description,
  anchorProse: row.anchorProse,
  activeSceneId: row.activeSceneId,
  sceneCount,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const sceneSummary = (row: SceneRow, hasAdjustments: boolean): SceneSummary => ({
  id: row.id,
  name: row.name,
  anchorProse: row.anchorProse,
  position: row.position,
  hasAdjustments,
  createdAt: row.createdAt,
});

// Spec §7.4: Scene pins override Story pins. If the active Scene has any pins,
// only those render. If the Scene has none (or no Scene is active), fall back
// to the Story's pins.
export const effectivePinned = (db: Db, storyId: string, sceneId: string | null): PinnedEntry[] => {
  if (sceneId) {
    const scenePins = loadPinnedFor(db, { kind: "scene", id: sceneId });
    if (scenePins.length > 0) return scenePins;
  }
  return loadPinnedFor(db, { kind: "story", id: storyId });
};

const loadPinnedFor = (db: Db, scope: PinnedScope): PinnedEntry[] => {
  const rows = db
    .select({
      id: pinned.id,
      entryId: pinned.entryId,
      position: pinned.position,
      entryName: entries.name,
      typeId: entries.typeId,
    })
    .from(pinned)
    .innerJoin(entries, eq(entries.id, pinned.entryId))
    .where(pinnedScopeCond(scope))
    .orderBy(asc(pinned.position))
    .all();
  return rows.map((r) => ({
    id: r.id,
    entryId: r.entryId,
    entryName: r.entryName,
    typeId: r.typeId,
    position: r.position,
  }));
};

const loadAnchorFacetsFor = (db: Db, where: { storyId: string; sceneId: string | null }): AnchorFacet[] => {
  const condSceneSql = where.sceneId
    ? sql`${anchorFacets.sceneId} = ${where.sceneId}`
    : sql`${anchorFacets.sceneId} IS NULL`;
  const rows: AnchorFacetRow[] = db
    .select()
    .from(anchorFacets)
    .where(sql`${anchorFacets.storyId} = ${where.storyId} AND ${condSceneSql}`)
    .orderBy(asc(anchorFacets.position))
    .all();
  return rows.map((r) => ({ id: r.id, label: r.label, body: r.body, position: r.position }));
};

export const getStory = (db: Db, id: string): Story | null => {
  const row = db.select().from(stories).where(eq(stories.id, id)).get();
  if (!row) return null;
  const setupRow = db.select().from(setups).where(eq(setups.id, row.setupId)).get();
  const sceneRows = db
    .select()
    .from(scenes)
    .where(eq(scenes.storyId, id))
    .orderBy(asc(scenes.position), asc(scenes.createdAt))
    .all();
  return {
    ...storySummary(row, sceneRows.length),
    setup: setupRow ? setupRow.data : defaultSetup(),
    scenes: sceneRows.map((s) => sceneSummary(s, s.adjustmentsId !== null)),
    pinned: loadPinnedFor(db, { kind: "story", id }),
    anchorFacets: loadAnchorFacetsFor(db, { storyId: id, sceneId: null }),
  };
};

export const getScene = (db: Db, id: string): Scene | null => {
  const row = db.select().from(scenes).where(eq(scenes.id, id)).get();
  if (!row) return null;
  const adjustments = row.adjustmentsId
    ? (db.select().from(setups).where(eq(setups.id, row.adjustmentsId)).get()?.data ?? null)
    : null;
  return {
    ...sceneSummary(row, row.adjustmentsId !== null),
    storyId: row.storyId,
    adjustments,
    pinned: loadPinnedFor(db, { kind: "scene", id }),
    anchorFacets: loadAnchorFacetsFor(db, { storyId: row.storyId, sceneId: id }),
  };
};

const setupFromDefaults = (db: Db): SetupData => {
  const s = ensureSettings(db);
  const base = defaultSetup();
  base.model.id = s.defaultModel;
  base.model.temperature = s.defaultTemperature;
  base.model.max_tokens = s.defaultMaxTokens;
  if (s.defaultThinkingBudget !== null) base.model.thinking_budget = s.defaultThinkingBudget;
  return base;
};

export const createStory = (db: Db, input: { name: string; description?: string; anchorProse?: string }): Story => {
  const id = newId();
  db.transaction((tx) => {
    const setupId = insertSetup(tx, "story", setupFromDefaults(tx));
    tx.insert(stories)
      .values({
        id,
        name: input.name,
        description: input.description ?? "",
        anchorProse: input.anchorProse ?? "",
        setupId,
        createdAt: now(),
        updatedAt: now(),
      })
      .run();
  });
  return getStory(db, id)!;
};

export const updateStory = (
  db: Db,
  id: string,
  patch: { name?: string; description?: string; anchorProse?: string; activeSceneId?: string | null },
): Story | null => {
  const existing = db.select().from(stories).where(eq(stories.id, id)).get();
  if (!existing) return null;
  const updates: Partial<typeof stories.$inferInsert> = { updatedAt: now() };
  if (patch.name !== undefined) updates.name = patch.name;
  if (patch.description !== undefined) updates.description = patch.description;
  if (patch.anchorProse !== undefined) updates.anchorProse = patch.anchorProse;
  if (patch.activeSceneId !== undefined) updates.activeSceneId = patch.activeSceneId;
  db.update(stories).set(updates).where(eq(stories.id, id)).run();
  return getStory(db, id);
};

export const deleteStory = (db: Db, id: string): boolean => {
  const story = db.select().from(stories).where(eq(stories.id, id)).get();
  if (!story) return false;
  const adjustmentIds = db
    .select({ id: scenes.adjustmentsId })
    .from(scenes)
    .where(eq(scenes.storyId, id))
    .all()
    .map((r) => r.id)
    .filter((x): x is string => x !== null);
  const orphanedSetupIds = [story.setupId, ...adjustmentIds];
  db.transaction((tx) => {
    tx.delete(stories).where(eq(stories.id, id)).run();
    tx.delete(setups).where(inArray(setups.id, orphanedSetupIds)).run();
  });
  return true;
};

export const updateStorySetup = (db: Db, storyId: string, data: SetupData): SetupData | null => {
  const story = db.select().from(stories).where(eq(stories.id, storyId)).get();
  if (!story) return null;
  db.update(setups).set({ data }).where(eq(setups.id, story.setupId)).run();
  db.update(stories).set({ updatedAt: now() }).where(eq(stories.id, storyId)).run();
  return data;
};

const nextScenePosition = (db: Db, storyId: string): number => {
  const r = db
    .select({ m: max(scenes.position) })
    .from(scenes)
    .where(eq(scenes.storyId, storyId))
    .get();
  return (r?.m ?? -1) + 1;
};

export const createScene = (db: Db, storyId: string, input: { name: string; anchorProse?: string }): Scene | null => {
  const story = db.select().from(stories).where(eq(stories.id, storyId)).get();
  if (!story) return null;
  const id = newId();
  db.transaction((tx) => {
    tx.insert(scenes)
      .values({
        id,
        storyId,
        name: input.name,
        anchorProse: input.anchorProse ?? "",
        position: nextScenePosition(tx, storyId),
        createdAt: now(),
      })
      .run();
    tx.update(stories).set({ updatedAt: now() }).where(eq(stories.id, storyId)).run();
  });
  return getScene(db, id);
};

export const updateScene = (
  db: Db,
  id: string,
  patch: { name?: string; anchorProse?: string; position?: number },
): Scene | null => {
  const existing = db.select().from(scenes).where(eq(scenes.id, id)).get();
  if (!existing) return null;
  const updates: Partial<typeof scenes.$inferInsert> = {};
  if (patch.name !== undefined) updates.name = patch.name;
  if (patch.anchorProse !== undefined) updates.anchorProse = patch.anchorProse;
  if (patch.position !== undefined) updates.position = patch.position;
  if (Object.keys(updates).length > 0) {
    db.update(scenes).set(updates).where(eq(scenes.id, id)).run();
    db.update(stories).set({ updatedAt: now() }).where(eq(stories.id, existing.storyId)).run();
  }
  return getScene(db, id);
};

export const deleteScene = (db: Db, id: string): boolean => {
  const existing = db.select().from(scenes).where(eq(scenes.id, id)).get();
  if (!existing) return false;
  db.transaction((tx) => {
    if (existing.adjustmentsId) {
      tx.delete(setups).where(eq(setups.id, existing.adjustmentsId)).run();
    }
    tx.delete(scenes).where(eq(scenes.id, id)).run();
    tx.update(stories)
      .set({
        updatedAt: now(),
        activeSceneId: sql`CASE WHEN active_scene_id = ${id} THEN NULL ELSE active_scene_id END`,
      })
      .where(eq(stories.id, existing.storyId))
      .run();
  });
  return true;
};

export const getEffectiveSetup = (db: Db, storyId: string, sceneId: string | null): SetupData | null => {
  const story = db.select().from(stories).where(eq(stories.id, storyId)).get();
  if (!story) return null;
  if (sceneId) {
    const scene = db.select().from(scenes).where(eq(scenes.id, sceneId)).get();
    if (scene?.adjustmentsId) {
      const adj = db.select().from(setups).where(eq(setups.id, scene.adjustmentsId)).get();
      if (adj) return adj.data;
    }
  }
  const setupRow = db.select().from(setups).where(eq(setups.id, story.setupId)).get();
  return setupRow ? setupRow.data : null;
};

export const upsertSceneAdjustments = (db: Db, sceneId: string, data: SetupData): SetupData | null => {
  const scene = db.select().from(scenes).where(eq(scenes.id, sceneId)).get();
  if (!scene) return null;
  if (scene.adjustmentsId) {
    db.update(setups).set({ data }).where(eq(setups.id, scene.adjustmentsId)).run();
  } else {
    const sid = insertSetup(db, "scene", data);
    db.update(scenes).set({ adjustmentsId: sid }).where(eq(scenes.id, sceneId)).run();
  }
  return data;
};

export const dropSceneAdjustments = (db: Db, sceneId: string): boolean => {
  const scene = db.select().from(scenes).where(eq(scenes.id, sceneId)).get();
  if (!scene?.adjustmentsId) return false;
  db.transaction((tx) => {
    tx.update(scenes).set({ adjustmentsId: null }).where(eq(scenes.id, sceneId)).run();
    tx.delete(setups).where(eq(setups.id, scene.adjustmentsId!)).run();
  });
  return true;
};

export const replacePinned = (db: Db, scope: PinnedScope, entryIds: string[]): PinnedEntry[] => {
  db.transaction((tx) => {
    tx.delete(pinned).where(pinnedScopeCond(scope)).run();
    if (entryIds.length === 0) return;
    tx.insert(pinned)
      .values(
        entryIds.map((entryId, i) => ({
          id: newId(),
          storyId: scope.kind === "story" ? scope.id : null,
          sceneId: scope.kind === "scene" ? scope.id : null,
          entryId,
          position: i,
        })),
      )
      .run();
  });
  return loadPinnedFor(db, scope);
};

export type AnchorFacetInput = { label: string; body?: string };

export const replaceAnchorFacets = (
  db: Db,
  scope: { storyId: string; sceneId: string | null },
  list: AnchorFacetInput[],
): AnchorFacet[] => {
  const cond = scope.sceneId
    ? sql`${anchorFacets.storyId} = ${scope.storyId} AND ${anchorFacets.sceneId} = ${scope.sceneId}`
    : sql`${anchorFacets.storyId} = ${scope.storyId} AND ${anchorFacets.sceneId} IS NULL`;
  db.transaction((tx) => {
    tx.delete(anchorFacets).where(cond).run();
    if (list.length === 0) return;
    tx.insert(anchorFacets)
      .values(
        list.map((f, i) => ({
          id: newId(),
          storyId: scope.storyId,
          sceneId: scope.sceneId,
          label: f.label,
          body: f.body ?? "",
          position: i,
        })),
      )
      .run();
  });
  return loadAnchorFacetsFor(db, scope);
};
