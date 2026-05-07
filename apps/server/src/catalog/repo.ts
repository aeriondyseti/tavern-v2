import {
  type ConnectionKind,
  type DirectionTier,
  type EntryCreate,
  type EntryUpdate,
  type FacetInput,
  type FacetMode,
  type KindId,
  newId,
} from "@tavern/shared";
import { asc, eq, inArray, max } from "drizzle-orm";

import type { Db } from "../db/client.js";
import { connections, cues, directionTier, entries, facets, KIND_DIRECTION, kinds, types } from "../db/schema.js";
import { indexEntry, removeFromIndex } from "./indexer.js";

const scheduleIndex = (db: Db, id: string) => {
  void indexEntry(db, id).catch((err) => {
    console.error("[index] failed for", id, err);
  });
};

export type Kind = { id: string; label: string };
export type Type = { id: string; kindId: string; name: string; position: number };
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
  toEntryId: string;
  kind: ConnectionKind;
};
export type Entry = {
  id: string;
  typeId: string;
  name: string;
  facets: Facet[];
  cues: string[];
  connections: Connection[];
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
  db.insert(types)
    .values({ ...row, createdAt: now() })
    .run();
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
  // cascade handles entries → facets/cues/connections/direction_tier
  const r = db.delete(types).where(eq(types.id, id)).returning({ id: types.id }).all();
  return r.length > 0;
};

export const getEntry = (db: Db, id: string): Entry | null => {
  const row = db.select().from(entries).where(eq(entries.id, id)).get();
  if (!row) return null;
  return hydrateEntries(db, [row])[0] ?? null;
};

export const getEntries = (db: Db, ids: string[]): Entry[] => {
  if (ids.length === 0) return [];
  const rows = db.select().from(entries).where(inArray(entries.id, ids)).all();
  const byId = new Map(rows.map((r) => [r.id, r]));
  const ordered = ids.map((id) => byId.get(id)).filter((r): r is (typeof rows)[number] => r !== undefined);
  return hydrateEntries(db, ordered);
};

const hydrateEntries = (db: Db, rows: (typeof entries.$inferSelect)[]): Entry[] => {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);

  const groupBy = <T extends { entryId: string }>(list: T[]): Map<string, T[]> => {
    const m = new Map<string, T[]>();
    for (const x of list) {
      const arr = m.get(x.entryId);
      if (arr) arr.push(x);
      else m.set(x.entryId, [x]);
    }
    return m;
  };

  const facetRows = db.select().from(facets).where(inArray(facets.entryId, ids)).orderBy(asc(facets.position)).all();
  const cueRows = db.select().from(cues).where(inArray(cues.entryId, ids)).all();
  const connRows = db.select().from(connections).where(inArray(connections.fromEntryId, ids)).all();
  const tierRows = db.select().from(directionTier).where(inArray(directionTier.entryId, ids)).all();

  const facetsByEntry = groupBy(facetRows);
  const cuesByEntry = groupBy(cueRows);
  const connsByEntry = new Map<string, typeof connRows>();
  for (const c of connRows) {
    const arr = connsByEntry.get(c.fromEntryId);
    if (arr) arr.push(c);
    else connsByEntry.set(c.fromEntryId, [c]);
  }
  const tierByEntry = new Map(tierRows.map((t) => [t.entryId, t.tier]));

  return rows.map((row) => ({
    id: row.id,
    typeId: row.typeId,
    name: row.name,
    facets: facetsByEntry.get(row.id) ?? [],
    cues: (cuesByEntry.get(row.id) ?? []).map((c) => c.term),
    connections: (connsByEntry.get(row.id) ?? []).map((c) => ({
      id: c.id,
      toEntryId: c.toEntryId,
      kind: c.kind,
    })),
    tier: tierByEntry.get(row.id) ?? null,
    embeddingModel: row.embeddingModel,
    hasEmbedding: row.embeddingVec !== null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));
};

export const listEntries = (db: Db, opts: { typeId?: string; kindId?: KindId; q?: string } = {}): Entry[] => {
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

  const filtered = opts.q ? rows.filter((r) => r.name.toLowerCase().includes(opts.q!.toLowerCase())) : rows;
  return hydrateEntries(db, filtered);
};

const isDirectionType = (db: Db, typeId: string): boolean => {
  const t = db.select({ kindId: types.kindId }).from(types).where(eq(types.id, typeId)).get();
  return t?.kindId === KIND_DIRECTION;
};

export const createEntry = (db: Db, input: EntryCreate): Entry => {
  const id = newId();
  const ts = now();
  db.transaction((tx) => {
    tx.insert(entries).values({ id, typeId: input.typeId, name: input.name, createdAt: ts, updatedAt: ts }).run();
    insertFacets(tx, id, input.facets);
    insertCues(tx, id, input.cues);
    insertConnections(tx, id, input.connections);
    if (isDirectionType(tx, input.typeId)) {
      tx.insert(directionTier)
        .values({ entryId: id, tier: input.tier ?? "normal" })
        .run();
    }
  });
  scheduleIndex(db, id);
  return getEntry(db, id)!;
};

export const updateEntry = (db: Db, id: string, patch: EntryUpdate): Entry | null => {
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
      insertFacets(tx, id, patch.facets);
    }
    if (patch.cues !== undefined) {
      tx.delete(cues).where(eq(cues.entryId, id)).run();
      insertCues(tx, id, patch.cues);
    }
    if (patch.connections !== undefined) {
      tx.delete(connections).where(eq(connections.fromEntryId, id)).run();
      insertConnections(tx, id, patch.connections);
    }
    const finalTypeId = patch.typeId ?? existing.typeId;
    if (isDirectionType(tx, finalTypeId)) {
      if (patch.tier !== undefined) {
        tx.insert(directionTier)
          .values({ entryId: id, tier: patch.tier })
          .onConflictDoUpdate({ target: directionTier.entryId, set: { tier: patch.tier } })
          .run();
      } else {
        tx.insert(directionTier).values({ entryId: id, tier: "normal" }).onConflictDoNothing().run();
      }
    } else {
      tx.delete(directionTier).where(eq(directionTier.entryId, id)).run();
    }
  });
  if (patch.name !== undefined || patch.facets !== undefined || patch.cues !== undefined) {
    scheduleIndex(db, id);
  }
  return getEntry(db, id);
};

export const deleteEntry = (db: Db, id: string): boolean => {
  removeFromIndex(db, id);
  const r = db.delete(entries).where(eq(entries.id, id)).returning({ id: entries.id }).all();
  return r.length > 0;
};

const insertFacets = (tx: Db, entryId: string, list: FacetInput[]) => {
  if (list.length === 0) return;
  tx.insert(facets)
    .values(
      list.map((f, i) => ({
        id: f.id ?? newId(),
        entryId,
        label: f.label,
        body: f.body ?? "",
        mode: f.mode ?? "always",
        position: f.position ?? i,
      })),
    )
    .run();
};

const insertCues = (tx: Db, entryId: string, list: string[]) => {
  const rows = list
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
    .map((term) => ({ id: newId(), entryId, term }));
  if (rows.length === 0) return;
  tx.insert(cues).values(rows).run();
};

const insertConnections = (tx: Db, fromEntryId: string, list: { toEntryId: string; kind?: ConnectionKind }[]) => {
  const rows = list
    .filter((c) => c.toEntryId !== fromEntryId)
    .map((c) => ({
      id: newId(),
      fromEntryId,
      toEntryId: c.toEntryId,
      kind: c.kind ?? ("brings" as const),
    }));
  if (rows.length === 0) return;
  tx.insert(connections).values(rows).onConflictDoNothing().run();
};
