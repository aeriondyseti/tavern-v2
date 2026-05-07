import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { z } from "zod";
import type { BeatEvent } from "@tavern/shared";

import { type Db } from "../db/client.js";
import { scenes } from "../db/schema.js";
import { getEffectiveSetup } from "../tales/repo.js";
import {
  completeBeat,
  createStreamingBeat,
  deleteBeat,
  getTranscriptsForBeat,
  listBeatsForScene,
  recentHistory,
  writeTranscript,
} from "./repo.js";
import { runNarrator } from "./runner.js";
import { composeSystemPrompt } from "./system-prompt.js";

const BeatPost = z.object({ playerInput: z.string().min(1) });

export const buildNarratorRoutes = (db: Db) => {
  const r = new Hono();

  r.get("/scenes/:id/beats", (c) => c.json(listBeatsForScene(db, c.req.param("id"))));

  r.get("/beats/:id/transcripts", (c) =>
    c.json(getTranscriptsForBeat(db, c.req.param("id"))),
  );

  r.delete("/beats/:id", (c) =>
    deleteBeat(db, c.req.param("id"))
      ? c.body(null, 204)
      : c.json({ error: "not found" }, 404),
  );

  r.post("/scenes/:sceneId/beats", async (c) => {
    const sceneId = c.req.param("sceneId");
    const body = BeatPost.safeParse(await c.req.json());
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);

    return streamSSE(c, async (stream) => {
      const sceneRow = db.select().from(scenes).where(eq(scenes.id, sceneId)).get();
      if (!sceneRow) {
        await stream.writeSSE({
          event: "error",
          data: JSON.stringify({ message: "scene not found", ts: Date.now() }),
        });
        return;
      }

      const setup = getEffectiveSetup(db, sceneRow.taleId, sceneId);
      if (!setup) {
        await stream.writeSSE({
          event: "error",
          data: JSON.stringify({ message: "no effective setup", ts: Date.now() }),
        });
        return;
      }

      const composed = composeSystemPrompt(db, {
        taleId: sceneRow.taleId,
        sceneId,
        setup,
      });

      const beat = createStreamingBeat(db, sceneId, body.data.playerInput);
      const ts = Date.now();
      await stream.writeSSE({
        event: "beat_started",
        data: JSON.stringify({ beatId: beat.id, ts }),
      });
      await stream.writeSSE({
        event: "system_prompt",
        data: JSON.stringify({ text: composed.text, ts }),
      });

      const history = recentHistory(db, sceneId, setup.history.max_beats);

      const abort = new AbortController();
      stream.onAbort(() => abort.abort());

      const result = await runNarrator(db, {
        taleId: sceneRow.taleId,
        sceneId,
        setup,
        systemPrompt: composed.text,
        history,
        playerInput: body.data.playerInput,
        abort,
        onEvent: async (e: BeatEvent) => {
          try {
            await stream.writeSSE({ event: e.type, data: JSON.stringify(e) });
          } catch {
            abort.abort();
          }
        },
      });

      completeBeat(db, beat.id, {
        status:
          result.status === "cancelled"
            ? "cancelled"
            : result.status === "error"
              ? "error"
              : "complete",
        narratorOutput: result.narratorOutput,
      });
      writeTranscript(db, {
        beatId: beat.id,
        requestBody: result.requestBody,
        events: result.events,
        searchCalls: result.searchCalls,
        model: setup.model.id,
        durationMs: result.durationMs,
      });
    });
  });

  return r;
};
