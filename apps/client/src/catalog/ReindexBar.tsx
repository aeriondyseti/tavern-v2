import { useEffect, useState } from "react";

import { type EmbedderStatus, fetchEmbedderStatus, type ReindexEvent, streamReindex } from "./search-api.js";
import { useCatalog } from "./store.js";

type Progress = { total: number; done: number; current?: { name: string } };

export const ReindexBar = () => {
  const { load } = useCatalog();
  const [embedder, setEmbedder] = useState<EmbedderStatus>({ state: "idle" });
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    let alive = true;
    const tick = () => {
      void fetchEmbedderStatus()
        .then((s) => alive && setEmbedder(s))
        .catch(() => {});
    };
    tick();
    const id = setInterval(tick, 2000);
    return () => {
      alive = false;
      clearInterval(id);
    };
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

  return (
    <div className="flex items-center gap-3 border-b border-zinc-800 px-3 py-2 text-xs text-zinc-400">
      <span>{summary}</span>
      {progress && (
        <span className="text-zinc-300">
          indexing {progress.done}/{progress.total}
          {progress.current ? ` — ${progress.current.name}` : ""}
        </span>
      )}
      {error && <span className="text-rose-400">error: {error}</span>}
      <span className="flex-1" />
      <button
        className="bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-900 hover:bg-white disabled:opacity-50"
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
