import { asc, eq, inArray, max } from "drizzle-orm";
import { newId } from "@tavern/shared";

import { type Db } from "../db/client.js";
import {
  connections,
  cues,
  directionTier,
  entries,
  facets,
  kinds,
  types,
  type ConnectionKind,
  type DirectionTier,
  type FacetMode,
  KIND_DIRECTION,
  type KindId,
} from "../db/schema.js";

export type Kind = { id: string; label: string };
export type Type = { id: string; kindId: string; name: string; position: number };
export type FacetInput = {
  id?: string;
  label: string;
  body?: string;
  mode?: FacetMode;
  position?: number;
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
  fromEntryId: string;
  toEntryId: string;
  kind: ConnectionKind;
};
export type Entry = {
  id: string;
  typeId: string;
  name: string;
  facets: Facet[];
  cues: string[];
  connections: { id: string; toEntryId: string; kind: ConnectionKind }[];
  tier: DirectionTier | null;
  embeddingModel: string | null;
  hasEmbedding: boolean;
  createdAt: number;
  updatedAt: number;
};

const now = () => Date.now();

const nextTypePosition = (db: Db, kindId: string): number => {
  const row = db
    .select({ m: max(types.position) })
    .from(types)
    .where(eq(types.kindId, kindId))
    .get();
  return (row?.m ?? -1) + 1;
};

const nextFacetPosition = (db: Db, entryId: string): number => {
  const row = db
    .select({ m: max(facets.position) })
    .from(facets)
    .where(eq(facets.entryId, entryId))
    .get();
  return (row?.m ?? -1) + 1;
};

export const listKinds = (db: Db): Kind[] => db.select().from(kinds).all();

export const listTypes = (db: Db, kindId?: KindId): Type[] => {
  const q = db.select().from(types).orderBy(asc(types.position), asc(types.name));
  return kindId ? q.where(eq(types.kindId, kindId)).all() : q.all();
};

export const createType = (db: Db, kindId: KindId, name: string): Type => {
  const row: Type = {
    id: newId(),
    kindId,
    name,
    position: nextTypePosition(db, kindId),
  };
  db.insert(types).values({ ...row, createdAt: now() }).run();
  return row;
};

export const updateType = (db: Db, id: string, patch: { name?: string; position?: number }): Type | null => {
  const updates: Partial<typeof types.$inferInsert> = {};
  if (patch.name !== undefined) updates.name = patch.name;
  if (patch.position !== undefined) updates.position = patch.position;
  if (Object.keys(updates).length > 0) {
    db.update(types).set(updates).where(eq(types.id, id)).run();
  }
  return db.select().from(types).where(eq(types.id, id)).get() ?? null;
};

export const deleteType = (db: Db, id: string): boolean => {
  const entryRows = db.select({ id: entries.id }).from(entries).where(eq(entries.typeId, id)).all();
  for (const e of entryRows) deleteEntry(db, e.id);
  const r = db.delete(types).where(eq(types.id, id)).run();
  return r.changes > 0;
};

const loadEntry = (db: Db, id: string): Entry | null => {
  const row = db.select().from(entries).where(eq(entries.id, id)).get();
  if (!row) return null;
  return hydrateEntry(db, row);
};

const hydrateEntry = (db: Db, row: typeof entries.$inferSelect): Entry => {
  const facetRows = db
    .select()
    .from(facets)
    .where(eq(facets.entryId, row.id))
    .orderBy(asc(facets.position))
    .all();
  const cueRows = db.select().from(cues).where(eq(cues.entryId, row.id)).all();
  const connRows = db
    .select()
    .from(connections)
    .where(eq(connections.fromEntryId, row.id))
    .all();
  const tierRow = db
    .select()
    .from(directionTier)
    .where(eq(directionTier.entryId, row.id))
    .get();

  return {
    id: row.id,
    typeId: row.typeId,
    name: row.name,
    facets: facetRows,
    cues: cueRows.map((c) => c.term),
    connections: connRows.map((c) => ({
      id: c.id,
      toEntryId: c.toEntryId,
      kind: c.kind,
    })),
    tier: tierRow?.tier ?? null,
    embeddingModel: row.embeddingModel,
    hasEmbedding: row.embeddingVec !== null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
};

export const listEntries = (
  db: Db,
  opts: { typeId?: string; kindId?: KindId; q?: string } = {},
): Entry[] => {
  const base = db.select().from(entries).orderBy(asc(entries.name));
  let rows: (typeof entries.$inferSelect)[];
  if (opts.typeId) {
    rows = base.where(eq(entries.typeId, opts.typeId)).all();
  } else if (opts.kindId) {
    const typeIds = db
      .select({ id: types.id })
      .from(types)
      .where(eq(types.kindId, opts.kindId))
      .all()
      .map((t) => t.id);
    if (typeIds.length === 0) return [];
    rows = base.where(inArray(entries.typeId, typeIds)).all();
  } else {
    rows = base.all();
  }

  const filtered = opts.q
    ? rows.filter((r) => r.name.toLowerCase().includes(opts.q!.toLowerCase()))
    : rows;
  return filtered.map((r) => hydrateEntry(db, r));
};

export type EntryInput = {
  typeId: string;
  name: string;
  facets?: FacetInput[];
  cues?: string[];
  connections?: { toEntryId: string; kind?: ConnectionKind }[];
  tier?: DirectionTier;
};

const isDirectionType = (db: Db, typeId: string): boolean => {
  const t = db.select({ kindId: types.kindId }).from(types).where(eq(types.id, typeId)).get();
  return t?.kindId === KIND_DIRECTION;
};

export const createEntry = (db: Db, input: EntryInput): Entry => {
  const id = newId();
  const ts = now();
  db.transaction((tx) => {
    tx.insert(entries)
      .values({ id, typeId: input.typeId, name: input.name, createdAt: ts, updatedAt: ts })
      .run();
    upsertFacets(tx, id, input.facets ?? []);
    upsertCues(tx, id, input.cues ?? []);
    upsertConnections(tx, id, input.connections ?? []);
    if (isDirectionType(tx, input.typeId)) {
      tx.insert(directionTier)
        .values({ entryId: id, tier: input.tier ?? "normal" })
        .onConflictDoUpdate({ target: directionTier.entryId, set: { tier: input.tier ?? "normal" } })
        .run();
    }
  });
  return loadEntry(db, id)!;
};

export type EntryPatch = Partial<Omit<EntryInput, "typeId">> & { typeId?: string };

export const updateEntry = (db: Db, id: string, patch: EntryPatch): Entry | null => {
  const existing = db.select().from(entries).where(eq(entries.id, id)).get();
  if (!existing) return null;
  const ts = now();
  db.transaction((tx) => {
    const updates: Partial<typeof entries.$inferInsert> = { updatedAt: ts };
    if (patch.name !== undefined) updates.name = patch.name;
    if (patch.typeId !== undefined) updates.typeId = patch.typeId;
    tx.update(entries).set(updates).where(eq(entries.id, id)).run();

    if (patch.facets !== undefined) {
      tx.delete(facets).where(eq(facets.entryId, id)).run();
      upsertFacets(tx, id, patch.facets);
    }
    if (patch.cues !== undefined) {
      tx.delete(cues).where(eq(cues.entryId, id)).run();
      upsertCues(tx, id, patch.cues);
    }
    if (patch.connections !== undefined) {
      tx.delete(connections).where(eq(connections.fromEntryId, id)).run();
      upsertConnections(tx, id, patch.connections);
    }
    const finalTypeId = patch.typeId ?? existing.typeId;
    if (isDirectionType(tx, finalTypeId)) {
      if (patch.tier !== undefined) {
        tx.insert(directionTier)
          .values({ entryId: id, tier: patch.tier })
          .onConflictDoUpdate({ target: directionTier.entryId, set: { tier: patch.tier } })
          .run();
      } else {
        tx.insert(directionTier)
          .values({ entryId: id, tier: "normal" })
          .onConflictDoNothing()
          .run();
      }
    } else {
      tx.delete(directionTier).where(eq(directionTier.entryId, id)).run();
    }
  });
  return loadEntry(db, id);
};

export const deleteEntry = (db: Db, id: string): boolean => {
  const r = db.delete(entries).where(eq(entries.id, id)).run();
  return r.changes > 0;
};

export const getEntry = (db: Db, id: string): Entry | null => loadEntry(db, id);

const upsertFacets = (tx: Db, entryId: string, list: FacetInput[]) => {
  list.forEach((f, i) => {
    tx.insert(facets)
      .values({
        id: f.id ?? newId(),
        entryId,
        label: f.label,
        body: f.body ?? "",
        mode: f.mode ?? "always",
        position: f.position ?? i,
      })
      .run();
  });
};

const upsertCues = (tx: Db, entryId: string, list: string[]) => {
  for (const term of list) {
    if (term.trim().length === 0) continue;
    tx.insert(cues).values({ id: newId(), entryId, term: term.trim() }).run();
  }
};

const upsertConnections = (
  tx: Db,
  fromEntryId: string,
  list: { toEntryId: string; kind?: ConnectionKind }[],
) => {
  for (const c of list) {
    if (c.toEntryId === fromEntryId) continue;
    tx.insert(connections)
      .values({
        id: newId(),
        fromEntryId,
        toEntryId: c.toEntryId,
        kind: c.kind ?? "brings",
      })
      .onConflictDoNothing()
      .run();
  }
};

