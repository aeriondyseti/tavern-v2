import { eq, sql } from "drizzle-orm";

import type { Db } from "../db/client.js";
import { cues, entries, facets } from "../db/schema.js";
import { embed, f32ToBuffer } from "../embeddings/index.js";

let _queue: Promise<unknown> = Promise.resolve();
const enqueue = <T>(task: () => Promise<T>): Promise<T> => {
  const next = _queue.then(task);
  _queue = next.catch(() => undefined);
  return next;
};

const buildSearchableText = (
  db: Db,
  entryId: string,
  name: string,
): { name: string; cueText: string; bodyText: string } => {
  const cueRows = db.select({ term: cues.term }).from(cues).where(eq(cues.entryId, entryId)).all();
  const facetRows = db
    .select({ label: facets.label, body: facets.body, mode: facets.mode })
    .from(facets)
    .where(eq(facets.entryId, entryId))
    .all();
  const cueText = cueRows.map((c) => c.term).join(" ");
  const bodyText = facetRows
    .filter((f) => f.mode === "always")
    .map((f) => `${f.label}: ${f.body}`)
    .join("\n");
  return { name, cueText, bodyText };
};

const writeFtsRow = (db: Db, entryId: string, name: string, cueText: string, bodyText: string) => {
  db.run(sql`DELETE FROM entries_fts WHERE entry_id = ${entryId}`);
  db.run(
    sql`INSERT INTO entries_fts (entry_id, name, cue_text, body_text) VALUES (${entryId}, ${name}, ${cueText}, ${bodyText})`,
  );
};

export const removeFromIndex = (db: Db, entryId: string) => {
  db.run(sql`DELETE FROM entries_fts WHERE entry_id = ${entryId}`);
};

export const indexEntry = (db: Db, entryId: string): Promise<void> =>
  enqueue(async () => {
    const row = db.select().from(entries).where(eq(entries.id, entryId)).get();
    if (!row) return;
    const { name, cueText, bodyText } = buildSearchableText(db, entryId, row.name);
    writeFtsRow(db, entryId, name, cueText, bodyText);

    const text = `${name}\n${cueText}\n${bodyText}`.trim();
    if (!text) return;

    const { vec, model } = await embed(text);
    db.update(entries)
      .set({ embeddingVec: f32ToBuffer(vec), embeddingModel: model })
      .where(eq(entries.id, entryId))
      .run();
  });

export type ReindexProgress = {
  total: number;
  done: number;
  current?: { id: string; name: string };
  errors: { id: string; name: string; message: string }[];
};

export const reindexAll = async (db: Db, onProgress?: (p: ReindexProgress) => void): Promise<ReindexProgress> => {
  const all = db.select({ id: entries.id, name: entries.name }).from(entries).all();
  const progress: ReindexProgress = { total: all.length, done: 0, errors: [] };
  onProgress?.(progress);
  for (const row of all) {
    progress.current = row;
    onProgress?.(progress);
    try {
      await indexEntry(db, row.id);
    } catch (e) {
      progress.errors.push({
        id: row.id,
        name: row.name,
        message: e instanceof Error ? e.message : String(e),
      });
    }
    progress.done += 1;
    onProgress?.(progress);
  }
  delete progress.current;
  onProgress?.(progress);
  return progress;
};
