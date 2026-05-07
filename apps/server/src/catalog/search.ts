import type { SearchCandidate } from "@tavern/shared";
import { inArray, sql } from "drizzle-orm";

import type { Db } from "../db/client.js";
import { connections, entries, types } from "../db/schema.js";
import { bufferToF32, cosine, embed } from "../embeddings/index.js";
import { type Entry, getEntries } from "./repo.js";

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
  // Cap FTS hits so the inArray() below stays under SQLite's 999 bound-param
  // limit. bm25() is negative (lower = more relevant), so ORDER BY bm25 ASC
  // keeps the most relevant rows.
  const FTS_HIT_LIMIT = 500;
  const ftsRows: { entry_id: string; bm25: number }[] = ftsQuery
    ? (db.all(
        sql`SELECT entry_id, bm25(entries_fts) AS bm25 FROM entries_fts WHERE entries_fts MATCH ${ftsQuery} ORDER BY bm25 LIMIT ${FTS_HIT_LIMIT}`,
      ) as { entry_id: string; bm25: number }[])
    : [];

  const queryEmbedding = await embed(queryText)
    .then((r) => r.vec)
    .catch(() => null);

  const ftsRowsByEntry = new Map(ftsRows.map((r) => [r.entry_id, r.bm25]));
  const candidateRows: (typeof entries.$inferSelect)[] = [];
  const seen = new Set<string>();

  // Track the largest |bm25| we'll see so we can normalize to [0,1]. SQLite
  // FTS5 bm25() returns negative values (lower = more relevant) and the
  // magnitude depends on the corpus + token rarity, so we can't assume a
  // fixed scale.
  let maxBm25Magnitude = 0;
  for (const r of ftsRows) {
    const mag = Math.abs(r.bm25);
    if (mag > maxBm25Magnitude) maxBm25Magnitude = mag;
  }

  if (ftsRows.length > 0) {
    const ftsHitRows = db
      .select()
      .from(entries)
      .where(
        inArray(
          entries.id,
          ftsRows.map((r) => r.entry_id),
        ),
      )
      .all();
    for (const row of ftsHitRows) {
      candidateRows.push(row);
      seen.add(row.id);
    }
  }

  // Embedding-fallback scan: only when FTS alone can't supply enough candidates.
  // Use a streaming scan instead of inArray-on-thousands-of-ids (SQLite's 999
  // bound parameter limit) since we'd otherwise materialize every embedded
  // entry's id just to feed it back as IN (?,?,?,...).
  if (queryEmbedding && candidateRows.length < opts.maxResults) {
    const allEmbedded = db.select().from(entries).where(sql`${entries.embeddingVec} IS NOT NULL`).all();
    for (const row of allEmbedded) {
      if (!seen.has(row.id)) {
        candidateRows.push(row);
        seen.add(row.id);
      }
    }
  }

  if (candidateRows.length === 0) {
    return { entries: [], candidates: [], bringsAdded: [] };
  }

  const candidates: SearchCandidate[] = candidateRows
    .filter((row) => !allowedTypeIds || allowedTypeIds.has(row.typeId))
    .map((row) => {
      const rawBm25 = ftsRowsByEntry.get(row.id);
      const bm25 = rawBm25 === undefined || maxBm25Magnitude === 0 ? 0 : Math.abs(rawBm25) / maxBm25Magnitude;
      const sim = queryEmbedding && row.embeddingVec ? cosine(queryEmbedding, bufferToF32(row.embeddingVec)) : 0;
      return {
        entryId: row.id,
        name: row.name,
        bm25,
        embeddingSim: sim,
        blended: opts.keywordWeight * bm25 + opts.embeddingWeight * sim,
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
  const hydrated = getEntries(db, finalIds);

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
