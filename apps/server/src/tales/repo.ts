import { asc, eq, max, sql } from "drizzle-orm";
import { defaultSetup, newId, type SetupData } from "@tavern/shared";

import { type Db } from "../db/client.js";
import {
  anchorFacets,
  entries,
  pinned,
  scenes,
  setups,
  tales,
  type AnchorFacetRow,
  type SceneRow,
  type SetupScope,
  type TaleRow,
} from "../db/schema.js";

export type AnchorFacet = { id: string; label: string; body: string; position: number };

export type PinnedEntry = {
  id: string;
  entryId: string;
  entryName: string;
  typeId: string;
  position: number;
};

export type SceneSummary = {
  id: string;
  name: string;
  anchorProse: string;
  position: number;
  hasAdjustments: boolean;
  createdAt: number;
};

export type Scene = SceneSummary & {
  taleId: string;
  adjustments: SetupData | null;
  pinned: PinnedEntry[];
  anchorFacets: AnchorFacet[];
};

export type TaleSummary = {
  id: string;
  name: string;
  description: string;
  anchorProse: string;
  activeSceneId: string | null;
  sceneCount: number;
  createdAt: number;
  updatedAt: number;
};

export type Tale = TaleSummary & {
  setup: SetupData;
  scenes: SceneSummary[];
  pinned: PinnedEntry[];
  anchorFacets: AnchorFacet[];
};

const now = () => Date.now();
const parseSetup = (raw: string): SetupData => JSON.parse(raw) as SetupData;
const stringifySetup = (data: SetupData): string => JSON.stringify(data);

const insertSetup = (db: Db, scope: SetupScope, data: SetupData): string => {
  const id = newId();
  db.insert(setups).values({ id, scope, data: stringifySetup(data) }).run();
  return id;
};

export const listTales = (db: Db): TaleSummary[] => {
  const rows = db.select().from(tales).orderBy(asc(tales.name)).all();
  if (rows.length === 0) return [];
  const counts = db
    .select({ taleId: scenes.taleId, n: sql<number>`count(*)`.as("n") })
    .from(scenes)
    .groupBy(scenes.taleId)
    .all();
  const countByTale = new Map(counts.map((c) => [c.taleId, Number(c.n)]));
  return rows.map((r) => taleSummary(r, countByTale.get(r.id) ?? 0));
};

const taleSummary = (row: TaleRow, sceneCount: number): TaleSummary => ({
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

const loadPinnedFor = (
  db: Db,
  where: { taleId?: string; sceneId?: string },
): PinnedEntry[] => {
  const cond = where.taleId
    ? eq(pinned.taleId, where.taleId)
    : where.sceneId
      ? eq(pinned.sceneId, where.sceneId)
      : null;
  if (!cond) return [];
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
    .where(cond)
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

const loadAnchorFacetsFor = (
  db: Db,
  where: { taleId: string; sceneId: string | null },
): AnchorFacet[] => {
  const condSceneSql = where.sceneId
    ? sql`${anchorFacets.sceneId} = ${where.sceneId}`
    : sql`${anchorFacets.sceneId} IS NULL`;
  const rows: AnchorFacetRow[] = db
    .select()
    .from(anchorFacets)
    .where(sql`${anchorFacets.taleId} = ${where.taleId} AND ${condSceneSql}`)
    .orderBy(asc(anchorFacets.position))
    .all();
  return rows.map((r) => ({ id: r.id, label: r.label, body: r.body, position: r.position }));
};

export const getTale = (db: Db, id: string): Tale | null => {
  const row = db.select().from(tales).where(eq(tales.id, id)).get();
  if (!row) return null;
  const setupRow = db.select().from(setups).where(eq(setups.id, row.setupId)).get();
  const sceneRows = db
    .select()
    .from(scenes)
    .where(eq(scenes.taleId, id))
    .orderBy(asc(scenes.position), asc(scenes.createdAt))
    .all();
  return {
    ...taleSummary(row, sceneRows.length),
    setup: setupRow ? parseSetup(setupRow.data) : defaultSetup(),
    scenes: sceneRows.map((s) => sceneSummary(s, s.adjustmentsId !== null)),
    pinned: loadPinnedFor(db, { taleId: id }),
    anchorFacets: loadAnchorFacetsFor(db, { taleId: id, sceneId: null }),
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
    taleId: row.taleId,
    adjustments: adjustments ? parseSetup(adjustments) : null,
    pinned: loadPinnedFor(db, { sceneId: id }),
    anchorFacets: loadAnchorFacetsFor(db, { taleId: row.taleId, sceneId: id }),
  };
};

export const createTale = (db: Db, input: { name: string; description?: string; anchorProse?: string }): Tale => {
  const id = newId();
  let setupId = "";
  db.transaction((tx) => {
    setupId = insertSetup(tx, "tale", defaultSetup());
    tx.insert(tales)
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
  return getTale(db, id)!;
};

export const updateTale = (
  db: Db,
  id: string,
  patch: { name?: string; description?: string; anchorProse?: string; activeSceneId?: string | null },
): Tale | null => {
  const existing = db.select().from(tales).where(eq(tales.id, id)).get();
  if (!existing) return null;
  const updates: Partial<typeof tales.$inferInsert> = { updatedAt: now() };
  if (patch.name !== undefined) updates.name = patch.name;
  if (patch.description !== undefined) updates.description = patch.description;
  if (patch.anchorProse !== undefined) updates.anchorProse = patch.anchorProse;
  if (patch.activeSceneId !== undefined) updates.activeSceneId = patch.activeSceneId;
  db.update(tales).set(updates).where(eq(tales.id, id)).run();
  return getTale(db, id);
};

export const deleteTale = (db: Db, id: string): boolean => {
  const tale = db.select().from(tales).where(eq(tales.id, id)).get();
  if (!tale) return false;
  const adjustmentIds = db
    .select({ id: scenes.adjustmentsId })
    .from(scenes)
    .where(eq(scenes.taleId, id))
    .all()
    .map((r) => r.id)
    .filter((x): x is string => x !== null);
  db.transaction((tx) => {
    tx.delete(tales).where(eq(tales.id, id)).run();
    tx.delete(setups).where(eq(setups.id, tale.setupId)).run();
    for (const sid of adjustmentIds) {
      tx.delete(setups).where(eq(setups.id, sid)).run();
    }
  });
  return true;
};

export const updateTaleSetup = (db: Db, taleId: string, data: SetupData): SetupData | null => {
  const tale = db.select().from(tales).where(eq(tales.id, taleId)).get();
  if (!tale) return null;
  db.update(setups)
    .set({ data: stringifySetup(data) })
    .where(eq(setups.id, tale.setupId))
    .run();
  db.update(tales).set({ updatedAt: now() }).where(eq(tales.id, taleId)).run();
  return data;
};

const nextScenePosition = (db: Db, taleId: string): number => {
  const r = db
    .select({ m: max(scenes.position) })
    .from(scenes)
    .where(eq(scenes.taleId, taleId))
    .get();
  return (r?.m ?? -1) + 1;
};

export const createScene = (
  db: Db,
  taleId: string,
  input: { name: string; anchorProse?: string },
): Scene | null => {
  const tale = db.select().from(tales).where(eq(tales.id, taleId)).get();
  if (!tale) return null;
  const id = newId();
  db.transaction((tx) => {
    tx.insert(scenes)
      .values({
        id,
        taleId,
        name: input.name,
        anchorProse: input.anchorProse ?? "",
        position: nextScenePosition(tx, taleId),
        createdAt: now(),
      })
      .run();
    tx.update(tales).set({ updatedAt: now() }).where(eq(tales.id, taleId)).run();
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
    db.update(tales).set({ updatedAt: now() }).where(eq(tales.id, existing.taleId)).run();
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
    tx.update(tales)
      .set({ updatedAt: now(), activeSceneId: sql`CASE WHEN active_scene_id = ${id} THEN NULL ELSE active_scene_id END` })
      .where(eq(tales.id, existing.taleId))
      .run();
  });
  return true;
};

export const upsertSceneAdjustments = (
  db: Db,
  sceneId: string,
  data: SetupData,
): SetupData | null => {
  const scene = db.select().from(scenes).where(eq(scenes.id, sceneId)).get();
  if (!scene) return null;
  if (scene.adjustmentsId) {
    db.update(setups)
      .set({ data: stringifySetup(data) })
      .where(eq(setups.id, scene.adjustmentsId))
      .run();
  } else {
    const sid = insertSetup(db, "scene", data);
    db.update(scenes).set({ adjustmentsId: sid }).where(eq(scenes.id, sceneId)).run();
  }
  return data;
};

export const dropSceneAdjustments = (db: Db, sceneId: string): boolean => {
  const scene = db.select().from(scenes).where(eq(scenes.id, sceneId)).get();
  if (!scene || !scene.adjustmentsId) return false;
  db.transaction((tx) => {
    tx.update(scenes).set({ adjustmentsId: null }).where(eq(scenes.id, sceneId)).run();
    tx.delete(setups).where(eq(setups.id, scene.adjustmentsId!)).run();
  });
  return true;
};

export const replacePinned = (
  db: Db,
  scope: { taleId?: string; sceneId?: string },
  entryIds: string[],
): PinnedEntry[] => {
  const cond = scope.taleId
    ? eq(pinned.taleId, scope.taleId)
    : scope.sceneId
      ? eq(pinned.sceneId, scope.sceneId)
      : null;
  if (!cond) return [];
  db.transaction((tx) => {
    tx.delete(pinned).where(cond).run();
    if (entryIds.length === 0) return;
    tx.insert(pinned)
      .values(
        entryIds.map((entryId, i) => ({
          id: newId(),
          taleId: scope.taleId ?? null,
          sceneId: scope.sceneId ?? null,
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
  scope: { taleId: string; sceneId: string | null },
  list: AnchorFacetInput[],
): AnchorFacet[] => {
  const cond = scope.sceneId
    ? sql`${anchorFacets.taleId} = ${scope.taleId} AND ${anchorFacets.sceneId} = ${scope.sceneId}`
    : sql`${anchorFacets.taleId} = ${scope.taleId} AND ${anchorFacets.sceneId} IS NULL`;
  db.transaction((tx) => {
    tx.delete(anchorFacets).where(cond).run();
    if (list.length === 0) return;
    tx.insert(anchorFacets)
      .values(
        list.map((f, i) => ({
          id: newId(),
          taleId: scope.taleId,
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
