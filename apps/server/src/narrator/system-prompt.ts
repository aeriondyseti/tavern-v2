import { asc, eq, inArray, sql } from "drizzle-orm";
import type { DirectionTier, SetupData } from "@tavern/shared";

import { type Db } from "../db/client.js";
import { anchorFacets, entries, facets, scenes, tales, types } from "../db/schema.js";
import { effectivePinned } from "../tales/repo.js";

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
    .map((row) => {
      const body = (alwaysFacetsByEntry.get(row.id) ?? []).join(" — ");
      return {
        id: row.id,
        name: row.name,
        line: body ? `- ${row.name}: ${body}` : `- ${row.name}`,
      };
    });
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

const renderPinned = (db: Db, taleId: string, sceneId: string | null): PinnedRendered[] => {
  const list = effectivePinned(db, taleId, sceneId);
  if (list.length === 0) return [];
  const typeIds = [...new Set(list.map((p) => p.typeId))];
  const typeRows = db
    .select({ id: types.id, name: types.name })
    .from(types)
    .where(inArray(types.id, typeIds))
    .all();
  const typeNameById = new Map(typeRows.map((t) => [t.id, t.name]));
  return list.map((p) => ({
    entryId: p.entryId,
    name: p.entryName,
    typeName: typeNameById.get(p.typeId) ?? "",
  }));
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
