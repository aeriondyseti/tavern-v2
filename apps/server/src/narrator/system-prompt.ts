import { asc, eq, inArray, sql } from "drizzle-orm";
import type { DirectionTier, SetupData } from "@tavern/shared";

import { type Db } from "../db/client.js";
import {
  anchorFacets,
  entries,
  facets,
  pinned,
  scenes,
  tales,
  types,
} from "../db/schema.js";

const STANCE = `You are the Narrator: a game-master, never a character. The user plays; you tell. Maintain that wall.`;

const TIER_HEADER: Record<DirectionTier, string> = {
  absolute: "Absolute rules:",
  strong: "Strong guidance:",
  normal: "Style:",
  background: "Background:",
};

const TIER_ORDER: DirectionTier[] = ["absolute", "strong", "normal", "background"];

type DirectionRendered = { id: string; name: string; line: string };

const renderDirections = (db: Db, ids: string[]): DirectionRendered[] => {
  if (ids.length === 0) return [];
  const entryRows = db.select().from(entries).where(inArray(entries.id, ids)).all();
  const byId = new Map(entryRows.map((r) => [r.id, r]));
  const facetRows = db
    .select()
    .from(facets)
    .where(inArray(facets.entryId, ids))
    .orderBy(asc(facets.position))
    .all();
  const alwaysFacetsByEntry = new Map<string, string[]>();
  for (const f of facetRows) {
    if (f.mode !== "always") continue;
    const arr = alwaysFacetsByEntry.get(f.entryId) ?? [];
    arr.push(`${f.label}: ${f.body}`);
    alwaysFacetsByEntry.set(f.entryId, arr);
  }
  return ids
    .map((id) => byId.get(id))
    .filter((r): r is NonNullable<typeof r> => r !== undefined)
    .map((row) => ({
      id: row.id,
      name: row.name,
      line: `- ${row.name}: ${(alwaysFacetsByEntry.get(row.id) ?? []).join(" — ") || row.name}`,
    }));
};

const renderAnchor = (
  db: Db,
  taleId: string,
  taleProse: string,
  sceneProse: string | null,
): string[] => {
  const lines: string[] = [];
  if (taleProse.trim()) lines.push(`Tale: ${taleProse.trim()}`);
  const taleFacets = db
    .select()
    .from(anchorFacets)
    .where(sql`${anchorFacets.taleId} = ${taleId} AND ${anchorFacets.sceneId} IS NULL`)
    .orderBy(asc(anchorFacets.position))
    .all();
  for (const f of taleFacets) {
    if (f.body.trim()) lines.push(`  ${f.label}: ${f.body}`);
    else lines.push(`  ${f.label}`);
  }
  if (sceneProse !== null && sceneProse.trim()) {
    lines.push(`Scene: ${sceneProse.trim()}`);
  }
  return lines;
};

type PinnedRendered = { entryId: string; name: string; typeName: string };

const renderPinned = (
  db: Db,
  taleId: string,
  sceneId: string | null,
): PinnedRendered[] => {
  // Scene overrides Tale per spec §7.4: if Scene has any pins, use those; else fallback.
  const condBySceneFirst = sceneId
    ? eq(pinned.sceneId, sceneId)
    : eq(pinned.taleId, taleId);
  let rows = db
    .select({
      entryId: pinned.entryId,
      position: pinned.position,
      name: entries.name,
      typeName: types.name,
    })
    .from(pinned)
    .innerJoin(entries, eq(entries.id, pinned.entryId))
    .innerJoin(types, eq(types.id, entries.typeId))
    .where(condBySceneFirst)
    .orderBy(asc(pinned.position))
    .all();
  if (sceneId && rows.length === 0) {
    rows = db
      .select({
        entryId: pinned.entryId,
        position: pinned.position,
        name: entries.name,
        typeName: types.name,
      })
      .from(pinned)
      .innerJoin(entries, eq(entries.id, pinned.entryId))
      .innerJoin(types, eq(types.id, entries.typeId))
      .where(eq(pinned.taleId, taleId))
      .orderBy(asc(pinned.position))
      .all();
  }
  return rows.map((r) => ({ entryId: r.entryId, name: r.name, typeName: r.typeName }));
};

export type ComposedSystemPrompt = {
  text: string;
  directionsByTier: Record<DirectionTier, DirectionRendered[]>;
  pinned: PinnedRendered[];
  anchorLines: string[];
};

export const composeSystemPrompt = (
  db: Db,
  args: { taleId: string; sceneId: string | null; setup: SetupData },
): ComposedSystemPrompt => {
  const tale = db.select().from(tales).where(eq(tales.id, args.taleId)).get();
  if (!tale) throw new Error(`tale ${args.taleId} not found`);
  const scene = args.sceneId
    ? db.select().from(scenes).where(eq(scenes.id, args.sceneId)).get()
    : null;

  const directionsByTier: Record<DirectionTier, DirectionRendered[]> = {
    absolute: renderDirections(db, args.setup.directions.absolute),
    strong: renderDirections(db, args.setup.directions.strong),
    normal: renderDirections(db, args.setup.directions.normal),
    background: renderDirections(db, args.setup.directions.background),
  };

  const anchorLines = renderAnchor(db, args.taleId, tale.anchorProse, scene?.anchorProse ?? null);
  const pinnedRows = renderPinned(db, args.taleId, args.sceneId);

  const sections: string[] = [STANCE];
  for (const tier of TIER_ORDER) {
    const list = directionsByTier[tier];
    if (list.length === 0) continue;
    sections.push("");
    sections.push(TIER_HEADER[tier]);
    for (const d of list) sections.push(d.line);
  }
  if (anchorLines.length > 0) {
    sections.push("");
    sections.push("Anchor:");
    for (const line of anchorLines) sections.push(line);
  }
  if (pinnedRows.length > 0) {
    sections.push("");
    sections.push(
      "Before this turn, ensure you have these in context. If you don't, call get_entry first:",
    );
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
    directionsByTier,
    pinned: pinnedRows,
    anchorLines,
  };
};
