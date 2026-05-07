import { and, asc, desc, eq, inArray, max, sql } from "drizzle-orm";
import {
  newId,
  type Beat,
  type BeatEvent,
  type BeatStatus,
  type BeatTranscript,
  type SearchCallRecord,
} from "@tavern/shared";

import { type Db } from "../db/client.js";
import { beatTranscripts, beats, scenes } from "../db/schema.js";

const beatToDto = (row: typeof beats.$inferSelect): Beat => ({
  id: row.id,
  sceneId: row.sceneId,
  position: row.position,
  playerInput: row.playerInput,
  narratorOutput: row.narratorOutput,
  status: row.status,
  alts: row.alts,
  activeAlt: row.activeAlt,
  createdAt: row.createdAt,
  completedAt: row.completedAt,
});

const transcriptToDto = (row: typeof beatTranscripts.$inferSelect): BeatTranscript => ({
  id: row.id,
  beatId: row.beatId,
  altIndex: row.altIndex,
  requestBody: row.requestBody,
  events: (row.events as BeatEvent[]) ?? [],
  searchCalls: (row.searchCalls as SearchCallRecord[]) ?? [],
  model: row.model,
  durationMs: row.durationMs,
  createdAt: row.createdAt,
});

export const listBeatsForScene = (db: Db, sceneId: string): Beat[] => {
  const rows = db
    .select()
    .from(beats)
    .where(eq(beats.sceneId, sceneId))
    .orderBy(asc(beats.position), asc(beats.createdAt))
    .all();
  return rows.map(beatToDto);
};

export const getBeat = (db: Db, id: string): Beat | null => {
  const row = db.select().from(beats).where(eq(beats.id, id)).get();
  return row ? beatToDto(row) : null;
};

const nextBeatPosition = (db: Db, sceneId: string): number => {
  const r = db
    .select({ m: max(beats.position) })
    .from(beats)
    .where(eq(beats.sceneId, sceneId))
    .get();
  return (r?.m ?? -1) + 1;
};

export const createStreamingBeat = (
  db: Db,
  sceneId: string,
  playerInput: string,
): Beat => {
  const sceneExists = db.select({ id: scenes.id }).from(scenes).where(eq(scenes.id, sceneId)).get();
  if (!sceneExists) throw new Error(`scene ${sceneId} not found`);
  const id = newId();
  db.insert(beats)
    .values({
      id,
      sceneId,
      position: nextBeatPosition(db, sceneId),
      playerInput,
      narratorOutput: "",
      status: "streaming",
      alts: [],
      activeAlt: -1,
    })
    .run();
  return getBeat(db, id)!;
};

export const completeBeat = (
  db: Db,
  id: string,
  patch: { status: BeatStatus; narratorOutput: string },
): void => {
  db.update(beats)
    .set({
      status: patch.status,
      narratorOutput: patch.narratorOutput,
      completedAt: Date.now(),
    })
    .where(eq(beats.id, id))
    .run();
};

// Snapshot the live narration into beats.alts when it has produced output,
// so reroll/regenerate stack alternates without losing prior runs. Mid-stream
// cancels (no narrator_output yet) leave alts untouched but still bump
// nextAltIndex so the next transcript's altIndex stays monotonically aligned
// with the alts array's eventual size.
const archiveCurrentToAlts = (db: Db, row: typeof beats.$inferSelect): number => {
  const nextAltIndex = row.alts.length;
  if (!row.narratorOutput) return nextAltIndex;
  const latestTranscript = db
    .select({ id: beatTranscripts.id })
    .from(beatTranscripts)
    .where(eq(beatTranscripts.beatId, row.id))
    .orderBy(desc(beatTranscripts.createdAt))
    .limit(1)
    .get();
  db.update(beats)
    .set({
      alts: [
        ...row.alts,
        {
          narratorOutput: row.narratorOutput,
          ...(latestTranscript?.id ? { transcriptId: latestTranscript.id } : {}),
          createdAt: row.completedAt ?? row.createdAt,
        },
      ],
    })
    .where(eq(beats.id, row.id))
    .run();
  return nextAltIndex;
};

export const prepareReroll = (
  db: Db,
  id: string,
): { altIndex: number; sceneId: string; playerInput: string } | null => {
  const row = db.select().from(beats).where(eq(beats.id, id)).get();
  if (!row) return null;
  const altIndex = archiveCurrentToAlts(db, row);
  db.update(beats)
    .set({ narratorOutput: "", status: "streaming", activeAlt: -1, completedAt: null })
    .where(eq(beats.id, id))
    .run();
  return { altIndex, sceneId: row.sceneId, playerInput: row.playerInput };
};

export const editNarratorOutput = (db: Db, id: string, narratorOutput: string): Beat | null => {
  const rows = db
    .update(beats)
    .set({ narratorOutput, status: "complete", completedAt: Date.now() })
    .where(eq(beats.id, id))
    .returning()
    .all();
  return rows[0] ? beatToDto(rows[0]) : null;
};

export const setActiveAlt = (db: Db, id: string, activeAlt: number): Beat | null => {
  const row = db.select().from(beats).where(eq(beats.id, id)).get();
  if (!row) return null;
  if (activeAlt < -1 || activeAlt >= row.alts.length) return null;
  const rows = db
    .update(beats)
    .set({ activeAlt })
    .where(eq(beats.id, id))
    .returning()
    .all();
  return rows[0] ? beatToDto(rows[0]) : null;
};

export const prepareRegenerate = (
  db: Db,
  id: string,
  newPlayerInput: string,
): { altIndex: number; sceneId: string; playerInput: string; deletedBeatIds: string[] } | null => {
  const row = db.select().from(beats).where(eq(beats.id, id)).get();
  if (!row) return null;
  const subsequentRows = db
    .select({ id: beats.id })
    .from(beats)
    .where(and(eq(beats.sceneId, row.sceneId), sql`${beats.position} > ${row.position}`))
    .all();
  const subsequentIds = subsequentRows.map((r) => r.id);
  if (subsequentIds.length > 0) {
    db.delete(beats).where(inArray(beats.id, subsequentIds)).run();
  }
  const altIndex = archiveCurrentToAlts(db, row);
  db.update(beats)
    .set({
      playerInput: newPlayerInput,
      narratorOutput: "",
      status: "streaming",
      activeAlt: -1,
      completedAt: null,
    })
    .where(eq(beats.id, id))
    .run();
  return {
    altIndex,
    sceneId: row.sceneId,
    playerInput: newPlayerInput,
    deletedBeatIds: subsequentIds,
  };
};

export const writeTranscript = (
  db: Db,
  args: {
    beatId: string;
    altIndex?: number;
    requestBody: unknown;
    events: BeatEvent[];
    searchCalls: SearchCallRecord[];
    model: string;
    durationMs: number;
  },
): BeatTranscript => {
  const id = newId();
  const altIndex = args.altIndex ?? -1;
  const createdAt = Date.now();
  db.insert(beatTranscripts)
    .values({
      id,
      beatId: args.beatId,
      altIndex,
      requestBody: args.requestBody,
      events: args.events,
      searchCalls: args.searchCalls,
      model: args.model,
      durationMs: args.durationMs,
      createdAt,
    })
    .run();
  return {
    id,
    beatId: args.beatId,
    altIndex,
    requestBody: args.requestBody,
    events: args.events,
    searchCalls: args.searchCalls,
    model: args.model,
    durationMs: args.durationMs,
    createdAt,
  };
};

export const getTranscriptsForBeat = (db: Db, beatId: string): BeatTranscript[] => {
  const rows = db
    .select()
    .from(beatTranscripts)
    .where(eq(beatTranscripts.beatId, beatId))
    .orderBy(asc(beatTranscripts.createdAt))
    .all();
  return rows.map(transcriptToDto);
};

export const recentHistory = (
  db: Db,
  sceneId: string,
  windowSize: number,
): { role: "user" | "assistant"; content: string }[] => {
  if (windowSize <= 0) return [];
  const rows = db
    .select({ playerInput: beats.playerInput, narratorOutput: beats.narratorOutput })
    .from(beats)
    .where(and(eq(beats.sceneId, sceneId), eq(beats.status, "complete")))
    .orderBy(desc(beats.position), desc(beats.createdAt))
    .limit(windowSize)
    .all()
    .reverse();
  const out: { role: "user" | "assistant"; content: string }[] = [];
  for (const r of rows) {
    out.push({ role: "user", content: r.playerInput });
    if (r.narratorOutput) out.push({ role: "assistant", content: r.narratorOutput });
  }
  return out;
};

export const deleteBeat = (db: Db, id: string): boolean => {
  const r = db.delete(beats).where(eq(beats.id, id)).run();
  return r.changes > 0;
};
