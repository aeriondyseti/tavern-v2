import type { EmbedderStatus } from "@tavern/shared";

import { consumeSseStream } from "../api/util.js";

export type { EmbedderStatus };

export const fetchEmbedderStatus = async (): Promise<EmbedderStatus> => {
  const r = await fetch("/api/embeddings/status");
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json();
};

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
    } catch {
      return;
    }
    if (event === "progress") onEvent({ type: "progress", ...(parsed as object) } as ReindexEvent);
    else if (event === "done") onEvent({ type: "done" });
    else if (event === "error") onEvent({ type: "error", message: parsed.message ?? "error" });
  });
