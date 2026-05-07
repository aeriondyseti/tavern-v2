import { SearchRequest } from "@tales/shared";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";

import type { Db } from "../db/client.js";
import { getEmbedderStatus, onEmbedderStatus } from "../embeddings/index.js";
import { type ReindexProgress, reindexAll } from "./indexer.js";
import { searchWorld } from "./search.js";

let _reindexInFlight = false;

export const buildSearchRoutes = (db: Db) => {
  const r = new Hono();

  r.post("/search", async (c) => {
    const body = SearchRequest.safeParse(await c.req.json());
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);
    const result = await searchWorld(db, body.data);
    return c.json(result);
  });

  r.get("/embeddings/status", (c) => c.json(getEmbedderStatus()));

  r.get("/embeddings/status/stream", (c) =>
    streamSSE(c, async (stream) => {
      await stream.writeSSE({ event: "status", data: JSON.stringify(getEmbedderStatus()) });
      await new Promise<void>((resolve) => {
        const off = onEmbedderStatus((s) => {
          void stream.writeSSE({ event: "status", data: JSON.stringify(s) });
        });
        stream.onAbort(() => {
          off();
          resolve();
        });
      });
    }),
  );

  r.post("/reindex", (c) =>
    streamSSE(c, async (stream) => {
      if (_reindexInFlight) {
        await stream.writeSSE({
          event: "error",
          data: JSON.stringify({ message: "reindex already running" }),
        });
        return;
      }
      _reindexInFlight = true;
      try {
        await reindexAll(db, async (p: ReindexProgress) => {
          await stream.writeSSE({ event: "progress", data: JSON.stringify(p) });
        });
        await stream.writeSSE({ event: "done", data: "{}" });
      } catch (e) {
        await stream.writeSSE({
          event: "error",
          data: JSON.stringify({ message: e instanceof Error ? e.message : String(e) }),
        });
      } finally {
        _reindexInFlight = false;
      }
    }),
  );

  return r;
};
