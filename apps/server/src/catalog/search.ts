import { inArray, sql } from "drizzle-orm";

import { type Db } from "../db/client.js";
import { connections, entries, types } from "../db/schema.js";
import { bufferToF32, cosine, embed } from "../embeddings/index.js";
import { type Entry, getEntry } from "./repo.js";

export type SearchOptions = {
  query: string;
  types?: string[];
  kindId?: "direction" | "world";
  maxResults: number;
  threshold: number;
  keywordWeight: number;
  embeddingWeight: number;
  bringsDepth: number;
};

export type SearchCandidate = {
  entryId: string;
  name: string;
  bm25: number;
  embeddingSim: number;
  blended: number;
  selected: boolean;
  fromBrings: boolean;
};

export type SearchResult = {
  entries: Entry[];
  candidates: SearchCandidate[];
  bringsAdded: string[];
};

const sanitizeFtsQuery = (q: string): string =>
  q
    .replace(/["']/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
    .map((t) => `"${t}"*`)
    .join(" OR ");

export const searchWorld = async (db: Db, opts: SearchOptions): Promise<SearchResult> => {
  const queryText = opts.query.trim();
  if (!queryText) return { entries: [], candidates: [], bringsAdded: [] };

  const allowedTypeIds = resolveAllowedTypes(db, opts);

  const ftsQuery = sanitizeFtsQuery(queryText);
  const ftsRows: { entry_id: string; bm25: number }[] = ftsQuery
    ? (db
        .all(
          sql`SELECT entry_id, bm25(entries_fts) AS bm25 FROM entries_fts WHERE entries_fts MATCH ${ftsQuery}`,
        ) as { entry_id: string; bm25: number }[])
    : [];

  const queryEmbedding = await embed(queryText)
    .then((r) => r.vec)
    .catch(() => null);

  const candidateSet = new Set<string>(ftsRows.map((r) => r.entry_id));
  if (queryEmbedding && candidateSet.size < opts.maxResults * 4) {
    const embRows = db
      .select({ id: entries.id })
      .from(entries)
      .where(sql`${entries.embeddingVec} IS NOT NULL`)
      .all();
    for (const r of embRows) candidateSet.add(r.id);
  }
  if (candidateSet.size === 0) {
    return { entries: [], candidates: [], bringsAdded: [] };
  }

  const candidateIds = [...candidateSet];
  let entryRows = db.select().from(entries).where(inArray(entries.id, candidateIds)).all();
  if (allowedTypeIds) {
    entryRows = entryRows.filter((r) => allowedTypeIds.has(r.typeId));
  }

  const bm25ByEntry = new Map(ftsRows.map((r) => [r.entry_id, r.bm25]));
  const maxBm25Magnitude =
    [...bm25ByEntry.values()].reduce((m, v) => Math.max(m, Math.abs(v)), 0) || 1;

  const candidates: SearchCandidate[] = entryRows.map((row) => {
    const rawBm25 = bm25ByEntry.get(row.id);
    const bm25 = rawBm25 === undefined ? 0 : Math.abs(rawBm25) / maxBm25Magnitude;
    const sim =
      queryEmbedding && row.embeddingVec
        ? cosine(queryEmbedding, bufferToF32(row.embeddingVec))
        : 0;
    const blended = opts.keywordWeight * bm25 + opts.embeddingWeight * sim;
    return {
      entryId: row.id,
      name: row.name,
      bm25,
      embeddingSim: sim,
      blended,
      selected: false,
      fromBrings: false,
    };
  });

  candidates.sort((a, b) => b.blended - a.blended);

  const selectedIds = new Set<string>();
  for (const c of candidates) {
    if (c.blended < opts.threshold) break;
    if (selectedIds.size >= opts.maxResults) break;
    c.selected = true;
    selectedIds.add(c.entryId);
  }

  const bringsAdded = expandBrings(db, selectedIds, opts.bringsDepth);

  const finalIds = [...selectedIds, ...bringsAdded];
  const hydrated = finalIds
    .map((id) => getEntry(db, id))
    .filter((e): e is Entry => e !== null);

  for (const id of bringsAdded) {
    const c = candidates.find((x) => x.entryId === id);
    if (c) c.fromBrings = true;
    else
      candidates.push({
        entryId: id,
        name: hydrated.find((e) => e.id === id)?.name ?? id,
        bm25: 0,
        embeddingSim: 0,
        blended: 0,
        selected: true,
        fromBrings: true,
      });
  }

  return { entries: hydrated, candidates, bringsAdded };
};

const resolveAllowedTypes = (db: Db, opts: SearchOptions): Set<string> | null => {
  if (opts.types && opts.types.length > 0) return new Set(opts.types);
  if (opts.kindId) {
    const ids = db
      .select({ id: types.id })
      .from(types)
      .where(sql`${types.kindId} = ${opts.kindId}`)
      .all()
      .map((t) => t.id);
    return new Set(ids);
  }
  return null;
};

const expandBrings = (db: Db, seedIds: Set<string>, depth: number): string[] => {
  if (depth <= 0 || seedIds.size === 0) return [];
  const visited = new Set(seedIds);
  const added: string[] = [];
  let frontier = [...seedIds];
  for (let d = 0; d < depth && frontier.length > 0; d++) {
    const next = db
      .select({ to: connections.toEntryId })
      .from(connections)
      .where(inArray(connections.fromEntryId, frontier))
      .all()
      .map((r) => r.to);
    const newFrontier: string[] = [];
    for (const id of next) {
      if (visited.has(id)) continue;
      visited.add(id);
      added.push(id);
      newFrontier.push(id);
    }
    frontier = newFrontier;
  }
  return added;
};
