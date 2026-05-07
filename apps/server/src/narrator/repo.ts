import { and, asc, desc, eq } from "drizzle-orm";
import { max } from "drizzle-orm";
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
