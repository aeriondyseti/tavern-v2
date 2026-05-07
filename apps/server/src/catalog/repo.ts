import { type EntryCreate, type EntryUpdate, type KindId, newId } from "@tales/shared";
import { asc, eq, inArray, max } from "drizzle-orm";

import type { Db } from "../db/client.js";
import { cues, entries, kinds, types } from "../db/schema.js";
import { indexEntry, removeFromIndex } from "./indexer.js";

const scheduleIndex = (db: Db, id: string) => {
  void indexEntry(db, id).catch((err) => {
    console.error("[index] failed for", id, err);
  });
};

export type Kind = { id: string; label: string };
export type Type = { id: string; kindId: string; name: string; position: number };
export type Entry = {
  id: string;
  typeId: string;
  name: string;
  body: string;
  cues: string[];
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
  // cascade handles entries → cues
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

  const cueRows = db.select().from(cues).where(inArray(cues.entryId, ids)).all();
  const cuesByEntry = new Map<string, typeof cueRows>();
  for (const c of cueRows) {
    const arr = cuesByEntry.get(c.entryId);
    if (arr) arr.push(c);
    else cuesByEntry.set(c.entryId, [c]);
  }

  return rows.map((row) => ({
    id: row.id,
    typeId: row.typeId,
    name: row.name,
    body: row.body,
    cues: (cuesByEntry.get(row.id) ?? []).map((c) => c.term),
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

export const createEntry = (db: Db, input: EntryCreate): Entry => {
  const id = newId();
  const ts = now();
  db.transaction((tx) => {
    tx.insert(entries)
      .values({ id, typeId: input.typeId, name: input.name, body: input.body, createdAt: ts, updatedAt: ts })
      .run();
    insertCues(tx, id, input.cues);
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
    if (patch.body !== undefined) updates.body = patch.body;
    tx.update(entries).set(updates).where(eq(entries.id, id)).run();

    if (patch.cues !== undefined) {
      tx.delete(cues).where(eq(cues.entryId, id)).run();
      insertCues(tx, id, patch.cues);
    }
  });
  if (patch.name !== undefined || patch.body !== undefined || patch.cues !== undefined) {
    scheduleIndex(db, id);
  }
  return getEntry(db, id);
};

export const deleteEntry = (db: Db, id: string): boolean => {
  removeFromIndex(db, id);
  const r = db.delete(entries).where(eq(entries.id, id)).returning({ id: entries.id }).all();
  return r.length > 0;
};

const insertCues = (tx: Db, entryId: string, list: string[]) => {
  const rows = list
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
    .map((term) => ({ id: newId(), entryId, term }));
  if (rows.length === 0) return;
  tx.insert(cues).values(rows).run();
};
