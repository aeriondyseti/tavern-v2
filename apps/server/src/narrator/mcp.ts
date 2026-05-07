import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import type { SearchCallRecord, SetupData } from "@tales/shared";
import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import * as repo from "../catalog/repo.js";
import { searchWorld } from "../catalog/search.js";
import type { Db } from "../db/client.js";
import { entries } from "../db/schema.js";
import { effectivePinned } from "../stories/repo.js";

export type ToolRecorder = {
  pushSearchCall: (rec: SearchCallRecord) => void;
};

export type NarratorContext = {
  storyId: string;
  sceneId: string | null;
  setup: SetupData;
  recorder: ToolRecorder;
};

const textResult = (data: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(data) }],
});

export const buildNarratorMcpServer = (db: Db, ctx: NarratorContext) =>
  createSdkMcpServer({
    name: "tales-catalog",
    version: "0.1.0",
    tools: [
      tool(
        "search_world",
        "Search the World catalog for entries relevant to a query. Returns ranked results with names, types, and entry bodies.",
        {
          query: z.string().describe("free-text query to search the catalog"),
          types: z.array(z.string()).optional().describe("filter to these type IDs"),
          maxResults: z.number().int().positive().optional(),
        },
        async (args) => {
          const result = await searchWorld(db, {
            query: args.query,
            types: args.types,
            maxResults: args.maxResults ?? ctx.setup.retrieval.max_results,
            threshold: ctx.setup.retrieval.threshold,
            keywordWeight: ctx.setup.retrieval.keyword_weight,
            embeddingWeight: ctx.setup.retrieval.embedding_weight,
          });
          ctx.recorder.pushSearchCall({
            query: args.query,
            candidates: result.candidates,
          });
          return textResult({
            results: result.entries.map((e) => ({
              id: e.id,
              name: e.name,
              type: e.typeId,
              body: e.body,
            })),
          });
        },
      ),
      tool(
        "get_entry",
        "Fetch a specific entry by id or by name (case-insensitive). When passing name, optionally constrain by type id.",
        {
          id: z.string().optional(),
          name: z.string().optional(),
          type: z.string().optional().describe("type id to constrain a name lookup"),
        },
        async (args) => {
          let entry = null as ReturnType<typeof repo.getEntry>;
          if (args.id) {
            entry = repo.getEntry(db, args.id);
          } else if (args.name) {
            const nameMatch = sql`lower(${entries.name}) = lower(${args.name})`;
            const where = args.type ? and(nameMatch, eq(entries.typeId, args.type)) : nameMatch;
            const row = db.select().from(entries).where(where).get();
            if (row) entry = repo.getEntry(db, row.id);
          }
          if (!entry) return textResult({ error: "not found" });
          return textResult({
            id: entry.id,
            name: entry.name,
            type: entry.typeId,
            body: entry.body,
            cues: entry.cues,
          });
        },
      ),
      tool(
        "list_active_directions",
        "List the active Direction entries the Narrator has been configured with.",
        {},
        async () => {
          const ids = ctx.setup.directions;
          if (ids.length === 0) return textResult({ directions: [] });
          const entryRows = db.select().from(entries).where(inArray(entries.id, ids)).all();
          const byId = new Map(entryRows.map((r) => [r.id, r]));
          return textResult({
            directions: ids
              .map((id) => byId.get(id))
              .filter((r): r is NonNullable<typeof r> => r !== undefined)
              .map((r) => ({ id: r.id, name: r.name, body: r.body })),
          });
        },
      ),
      tool(
        "list_pinned",
        "List the entries pinned for this Story (or this Scene, if Scene-level pins are set).",
        {},
        async () => {
          const list = effectivePinned(db, ctx.storyId, ctx.sceneId);
          return textResult({
            pinned: list.map((p) => ({
              id: p.entryId,
              name: p.entryName,
              type: p.typeId,
            })),
          });
        },
      ),
    ],
  });
