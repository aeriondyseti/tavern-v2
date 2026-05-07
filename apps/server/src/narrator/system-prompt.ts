import type { SetupData } from "@tales/shared";
import { asc, eq, inArray, sql } from "drizzle-orm";

import type { Db } from "../db/client.js";
import { anchorFacets, entries, scenes, stories, types } from "../db/schema.js";
import { effectivePinned } from "../stories/repo.js";

const STANCE = `You are the Narrator: a game-master, never a character. The user plays; you tell. Maintain that wall.`;

type DirectionRendered = { id: string; name: string; line: string };

const renderDirections = (db: Db, ids: string[]): DirectionRendered[] => {
  if (ids.length === 0) return [];
  const entryRows = db.select().from(entries).where(inArray(entries.id, ids)).all();
  const byId = new Map(entryRows.map((r) => [r.id, r]));
  return ids
    .map((id) => byId.get(id))
    .filter((r): r is NonNullable<typeof r> => r !== undefined)
    .map((row) => ({
      id: row.id,
      name: row.name,
      line: row.body.trim() ? `- ${row.name}: ${row.body.trim()}` : `- ${row.name}`,
    }));
};

const renderAnchor = (db: Db, storyId: string, storyProse: string, sceneProse: string | null): string[] => {
  const lines: string[] = [];
  if (storyProse.trim()) lines.push(`Story: ${storyProse.trim()}`);
  const storyFacets = db
    .select()
    .from(anchorFacets)
    .where(sql`${anchorFacets.storyId} = ${storyId} AND ${anchorFacets.sceneId} IS NULL`)
    .orderBy(asc(anchorFacets.position))
    .all();
  for (const f of storyFacets) {
    if (f.body.trim()) lines.push(`  ${f.label}: ${f.body}`);
    else lines.push(`  ${f.label}`);
  }
  if (sceneProse?.trim()) {
    lines.push(`Scene: ${sceneProse.trim()}`);
  }
  return lines;
};

type PinnedRendered = { entryId: string; name: string; typeName: string };

const renderPinned = (db: Db, storyId: string, sceneId: string | null): PinnedRendered[] => {
  const list = effectivePinned(db, storyId, sceneId);
  if (list.length === 0) return [];
  const typeIds = [...new Set(list.map((p) => p.typeId))];
  const typeRows = db.select({ id: types.id, name: types.name }).from(types).where(inArray(types.id, typeIds)).all();
  const typeNameById = new Map(typeRows.map((t) => [t.id, t.name]));
  return list.map((p) => ({
    entryId: p.entryId,
    name: p.entryName,
    typeName: typeNameById.get(p.typeId) ?? "",
  }));
};

export type ComposedSystemPrompt = {
  text: string;
  directions: DirectionRendered[];
  pinned: PinnedRendered[];
  anchorLines: string[];
};

export const composeSystemPrompt = (
  db: Db,
  args: { storyId: string; sceneId: string | null; setup: SetupData },
): ComposedSystemPrompt => {
  const story = db.select().from(stories).where(eq(stories.id, args.storyId)).get();
  if (!story) throw new Error(`story ${args.storyId} not found`);
  const scene = args.sceneId ? db.select().from(scenes).where(eq(scenes.id, args.sceneId)).get() : null;

  const directions = renderDirections(db, args.setup.directions);

  const anchorLines = renderAnchor(db, args.storyId, story.anchorProse, scene?.anchorProse ?? null);
  const pinnedRows = renderPinned(db, args.storyId, args.sceneId);

  const sections: string[] = [STANCE];
  if (directions.length > 0) {
    sections.push("");
    sections.push("Directions:");
    for (const d of directions) sections.push(d.line);
  }
  if (anchorLines.length > 0) {
    sections.push("");
    sections.push("Anchor:");
    for (const line of anchorLines) sections.push(line);
  }
  if (pinnedRows.length > 0) {
    sections.push("");
    sections.push("Before this turn, ensure you have these in context. If you don't, call get_entry first:");
    for (const p of pinnedRows) {
      sections.push(`- ${p.name} (id: ${p.entryId}) — ${p.typeName}`);
    }
  }
  if (args.setup.model.system_prompt_append) {
    sections.push("");
    sections.push(args.setup.model.system_prompt_append);
  }

  return {
    text: sections.join("\n"),
    directions,
    pinned: pinnedRows,
    anchorLines,
  };
};
