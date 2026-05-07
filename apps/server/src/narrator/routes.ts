import type { BeatEvent } from "@tavern/shared";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { type SSEStreamingApi, streamSSE } from "hono/streaming";
import { z } from "zod";

import type { Db } from "../db/client.js";
import { scenes } from "../db/schema.js";
import { getEffectiveSetup } from "../tales/repo.js";
import {
  completeBeat,
  createStreamingBeat,
  deleteBeat,
  editNarratorOutput,
  getTranscriptsForBeat,
  listBeatsForScene,
  prepareRegenerate,
  prepareReroll,
  recentHistory,
  setActiveAlt,
  writeTranscript,
} from "./repo.js";
import { runNarrator } from "./runner.js";
import { composeSystemPrompt } from "./system-prompt.js";

const BeatPost = z.object({ playerInput: z.string().min(1) });
const NarratorEdit = z
  .object({
    narratorOutput: z.string().optional(),
    activeAlt: z.number().int().min(-1).optional(),
  })
  .refine((d) => d.narratorOutput !== undefined || d.activeAlt !== undefined, {
    message: "must include narratorOutput or activeAlt",
  })
  .refine((d) => !(d.narratorOutput !== undefined && d.activeAlt !== undefined), {
    message: "narratorOutput and activeAlt are mutually exclusive",
  });

type StreamArgs = {
  beatId: string;
  sceneId: string;
  playerInput: string;
  altIndex?: number;
};

const streamBeatGeneration = async (db: Db, stream: SSEStreamingApi, args: StreamArgs) => {
  const sceneRow = db.select().from(scenes).where(eq(scenes.id, args.sceneId)).get();
  if (!sceneRow) {
    await stream.writeSSE({
      event: "error",
      data: JSON.stringify({ message: "scene not found", ts: Date.now() }),
    });
    return;
  }
  const setup = getEffectiveSetup(db, sceneRow.taleId, args.sceneId);
  if (!setup) {
    await stream.writeSSE({
      event: "error",
      data: JSON.stringify({ message: "no effective setup", ts: Date.now() }),
    });
    return;
  }

  const composed = composeSystemPrompt(db, {
    taleId: sceneRow.taleId,
    sceneId: args.sceneId,
    setup,
  });

  const ts = Date.now();
  await stream.writeSSE({
    event: "beat_started",
    data: JSON.stringify({ beatId: args.beatId, ts }),
  });
  await stream.writeSSE({
    event: "system_prompt",
    data: JSON.stringify({ text: composed.text, ts }),
  });

  const history = recentHistory(db, args.sceneId, setup.history.max_beats);

  const abort = new AbortController();
  stream.onAbort(() => abort.abort());

  const result = await runNarrator(db, {
    taleId: sceneRow.taleId,
    sceneId: args.sceneId,
    setup,
    systemPrompt: composed.text,
    history,
    playerInput: args.playerInput,
    abort,
    onEvent: async (e: BeatEvent) => {
      try {
        await stream.writeSSE({ event: e.type, data: JSON.stringify(e) });
      } catch {
        abort.abort();
      }
    },
  });

  completeBeat(db, args.beatId, {
    status: result.status === "cancelled" ? "cancelled" : result.status === "error" ? "error" : "complete",
    narratorOutput: result.narratorOutput,
  });
  writeTranscript(db, {
    beatId: args.beatId,
    ...(args.altIndex !== undefined ? { altIndex: args.altIndex } : {}),
    requestBody: result.requestBody,
    events: result.events,
    searchCalls: result.searchCalls,
    model: setup.model.id,
    durationMs: result.durationMs,
  });
};

export const buildNarratorRoutes = (db: Db) => {
  const r = new Hono();

  r.get("/scenes/:id/beats", (c) => c.json(listBeatsForScene(db, c.req.param("id"))));

  r.get("/beats/:id/transcripts", (c) => c.json(getTranscriptsForBeat(db, c.req.param("id"))));

  r.delete("/beats/:id", (c) =>
    deleteBeat(db, c.req.param("id")) ? c.body(null, 204) : c.json({ error: "not found" }, 404),
  );

  r.patch("/beats/:id", async (c) => {
    const body = NarratorEdit.safeParse(await c.req.json());
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);
    const id = c.req.param("id");
    if (body.data.narratorOutput !== undefined) {
      const updated = editNarratorOutput(db, id, body.data.narratorOutput);
      return updated ? c.json(updated) : c.json({ error: "not found" }, 404);
    }
    const updated = setActiveAlt(db, id, body.data.activeAlt!);
    return updated ? c.json(updated) : c.json({ error: "invalid activeAlt or not found" }, 400);
  });

  r.post("/scenes/:sceneId/beats", async (c) => {
    const sceneId = c.req.param("sceneId");
    const body = BeatPost.safeParse(await c.req.json());
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);
    return streamSSE(c, async (stream) => {
      const beat = createStreamingBeat(db, sceneId, body.data.playerInput);
      await streamBeatGeneration(db, stream, {
        beatId: beat.id,
        sceneId,
        playerInput: body.data.playerInput,
      });
    });
  });

  r.post("/beats/:id/reroll", (c) =>
    streamSSE(c, async (stream) => {
      const prepared = prepareReroll(db, c.req.param("id"));
      if (!prepared) {
        await stream.writeSSE({
          event: "error",
          data: JSON.stringify({ message: "beat not found", ts: Date.now() }),
        });
        return;
      }
      await streamBeatGeneration(db, stream, {
        beatId: c.req.param("id"),
        sceneId: prepared.sceneId,
        playerInput: prepared.playerInput,
        altIndex: prepared.altIndex,
      });
    }),
  );

  r.post("/beats/:id/regenerate", async (c) => {
    const body = BeatPost.safeParse(await c.req.json());
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);
    return streamSSE(c, async (stream) => {
      const prepared = prepareRegenerate(db, c.req.param("id"), body.data.playerInput);
      if (!prepared) {
        await stream.writeSSE({
          event: "error",
          data: JSON.stringify({ message: "beat not found", ts: Date.now() }),
        });
        return;
      }
      await stream.writeSSE({
        event: "regenerated",
        data: JSON.stringify({
          deletedBeatIds: prepared.deletedBeatIds,
          ts: Date.now(),
        }),
      });
      await streamBeatGeneration(db, stream, {
        beatId: c.req.param("id"),
        sceneId: prepared.sceneId,
        playerInput: prepared.playerInput,
        altIndex: prepared.altIndex,
      });
    });
  });

  return r;
};
