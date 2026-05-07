import type { EmbedderStatus } from "@tavern/shared";

import { consumeSseStream } from "../api/util.js";

export type { EmbedderStatus };

// Server pushes a status frame on the initial connection, then again each
// time the embedder transitions state. Returns a disposer that aborts the
// underlying fetch.
export const streamEmbedderStatus = (onStatus: (s: EmbedderStatus) => void): (() => void) =>
  consumeSseStream("/api/embeddings/status/stream", { method: "GET" }, (event, data) => {
    if (event !== "status") return;
    try {
      onStatus(JSON.parse(data) as EmbedderStatus);
    } catch (e) {
      console.error("[streamEmbedderStatus] failed to parse SSE frame:", data, e);
    }
  });

export type ReindexEvent =
  | {
      type: "progress";
      total: number;
      done: number;
      current?: { id: string; name: string };
      errors: { id: string; name: string; message: string }[];
    }
  | { type: "done" }
  | { type: "error"; message: string };

export const streamReindex = (onEvent: (e: ReindexEvent) => void): (() => void) =>
  consumeSseStream("/api/reindex", { method: "POST" }, (event, data) => {
    let parsed: { message?: string; total?: number; done?: number } = {};
    try {
      parsed = JSON.parse(data);
    } catch (e) {
      console.error("[streamReindex] failed to parse SSE frame:", data, e);
      return;
    }
    if (event === "progress") onEvent({ type: "progress", ...(parsed as object) } as ReindexEvent);
    else if (event === "done") onEvent({ type: "done" });
    else if (event === "error") onEvent({ type: "error", message: parsed.message ?? "error" });
  });
