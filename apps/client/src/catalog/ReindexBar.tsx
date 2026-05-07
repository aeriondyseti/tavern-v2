import { useEffect, useState } from "react";

import { type EmbedderStatus, type ReindexEvent, streamEmbedderStatus, streamReindex } from "./search-api.js";
import { useCatalog } from "./store.js";

type Progress = { total: number; done: number; current?: { name: string } };

export const ReindexBar = () => {
  const load = useCatalog((s) => s.load);
  const [embedder, setEmbedder] = useState<EmbedderStatus>({ state: "idle" });
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    // The /api/embeddings/status/stream SSE endpoint pushes a frame on
    // connect and again on each state transition, so polling is unnecessary.
    return streamEmbedderStatus(setEmbedder);
  }, []);

  const start = () => {
    setError(null);
    setRunning(true);
    setProgress(null);
    streamReindex((e: ReindexEvent) => {
      if (e.type === "progress") {
        setProgress({ total: e.total, done: e.done, ...(e.current ? { current: e.current } : {}) });
      } else if (e.type === "done") {
        setRunning(false);
        void load();
      } else if (e.type === "error") {
        setRunning(false);
        setError(e.message);
      }
    });
  };

  const summary = embedderSummary(embedder);

  const dotClass: Record<EmbedderStatus["state"], string> = {
    idle: "bg-zinc-600",
    loading: "bg-amber-400 animate-pulse",
    ready: "bg-emerald-400",
    error: "bg-rose-400",
  };

  return (
    <div className="flex items-center gap-3 border-b border-zinc-800 px-3 py-2 text-xs text-zinc-400">
      <span className="inline-flex items-center gap-2">
        <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${dotClass[embedder.state]}`} />
        <span>{summary}</span>
      </span>
      {progress && (
        <span className="text-zinc-300">
          indexing {progress.done}/{progress.total}
          {progress.current ? ` — ${progress.current.name}` : ""}
        </span>
      )}
      {error && <span className="text-rose-400">error: {error}</span>}
      <span className="flex-1" />
      <button
        type="button"
        className="cursor-pointer whitespace-nowrap bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-900 transition-colors duration-200 hover:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:ring-offset-2 focus:ring-offset-zinc-950 disabled:cursor-not-allowed disabled:opacity-50"
        onClick={start}
        disabled={running}
      >
        {running ? "indexing…" : "reindex all"}
      </button>
    </div>
  );
};

const embedderSummary = (s: EmbedderStatus): string => {
  switch (s.state) {
    case "idle":
      return "embeddings: idle";
    case "loading":
      return s.progress !== undefined ? `loading ${s.model} (${s.progress}%)` : `loading ${s.model}…`;
    case "ready":
      return `model ready: ${s.model}`;
    case "error":
      return `model error: ${s.message}`;
  }
};
