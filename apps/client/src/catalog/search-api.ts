import type { KindId } from "@tavern/shared";

import type { Entry } from "./types.js";

export type SearchCandidate = {
  entryId: string;
  name: string;
  bm25: number;
  embeddingSim: number;
  blended: number;
  selected: boolean;
  fromBrings: boolean;
};

export type SearchResult = {
  entries: Entry[];
  candidates: SearchCandidate[];
  bringsAdded: string[];
};

export type EmbedderStatus =
  | { state: "idle" }
  | { state: "loading"; model: string; file?: string; progress?: number }
  | { state: "ready"; model: string }
  | { state: "error"; model: string; message: string };

export type SearchRequest = {
  query: string;
  types?: string[];
  kindId?: KindId;
  maxResults?: number;
  threshold?: number;
  keywordWeight?: number;
  embeddingWeight?: number;
  bringsDepth?: number;
};

export const search = async (req: SearchRequest): Promise<SearchResult> => {
  const r = await fetch("/api/search", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}: ${await r.text()}`);
  return r.json();
};

export const fetchEmbedderStatus = async (): Promise<EmbedderStatus> => {
  const r = await fetch("/api/embeddings/status");
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json();
};

export type ReindexEvent =
  | { type: "progress"; total: number; done: number; current?: { id: string; name: string }; errors: { id: string; name: string; message: string }[] }
  | { type: "done" }
  | { type: "error"; message: string };

export const streamReindex = (onEvent: (e: ReindexEvent) => void): (() => void) => {
  const ac = new AbortController();
  void (async () => {
    try {
      const r = await fetch("/api/reindex", { method: "POST", signal: ac.signal });
      if (!r.ok || !r.body) {
        onEvent({ type: "error", message: `${r.status} ${r.statusText}` });
        return;
      }
      const reader = r.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buf.indexOf("\n\n")) !== -1) {
          const chunk = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          const lines = chunk.split("\n");
          let event = "message";
          let data = "";
          for (const line of lines) {
            if (line.startsWith("event:")) event = line.slice(6).trim();
            else if (line.startsWith("data:")) data += line.slice(5).trim();
          }
          if (!data) continue;
          try {
            const parsed = JSON.parse(data);
            if (event === "progress") onEvent({ type: "progress", ...parsed });
            else if (event === "done") onEvent({ type: "done" });
            else if (event === "error") onEvent({ type: "error", message: parsed.message ?? "error" });
          } catch {
            // ignore malformed event
          }
        }
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        onEvent({ type: "error", message: e instanceof Error ? e.message : String(e) });
      }
    }
  })();
  return () => ac.abort();
};
