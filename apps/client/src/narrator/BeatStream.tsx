import { useEffect, useRef, useState } from "react";

import { useNarrator } from "./store.js";

type Props = { sceneId: string; sceneName: string };

export const BeatStream = ({ sceneId, sceneName }: Props) => {
  const { bySceneId, loadBeats, live, startBeat, cancelLive, deleteBeat } = useNarrator();
  const [input, setInput] = useState("");
  const tailRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void loadBeats(sceneId);
  }, [sceneId, loadBeats]);

  const beats = bySceneId[sceneId] ?? [];
  const streaming = live.cancel !== null;

  useEffect(() => {
    tailRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [beats.length, live.text]);

  const submit = async () => {
    const trimmed = input.trim();
    if (!trimmed || streaming) return;
    setInput("");
    await startBeat(sceneId, trimmed);
  };

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-zinc-800 px-4 py-2 text-xs uppercase tracking-wide text-zinc-500">
        Scene — {sceneName}
      </header>
      <div className="flex-1 space-y-4 overflow-y-auto p-4 text-sm leading-relaxed">
        {beats.length === 0 && !streaming && (
          <p className="text-zinc-600">No beats yet. Begin the scene below.</p>
        )}
        {beats.map((b) => (
          <article key={b.id} className="space-y-1">
            <div className="border-l-2 border-zinc-700 pl-3 text-zinc-300">{b.playerInput}</div>
            <div className="whitespace-pre-wrap text-zinc-100">{b.narratorOutput}</div>
            <div className="flex items-center gap-2 text-[10px] text-zinc-600">
              <span>{new Date(b.createdAt).toLocaleTimeString()}</span>
              {b.status !== "complete" && <span>· {b.status}</span>}
              <button
                className="hover:text-rose-400"
                onClick={() => {
                  if (confirm("Delete this beat?")) void deleteBeat(sceneId, b.id);
                }}
              >
                delete
              </button>
            </div>
          </article>
        ))}
        {streaming && (
          <article className="space-y-1">
            <div className="whitespace-pre-wrap text-zinc-100">
              {live.text}
              <span className="ml-1 inline-block h-3 w-2 animate-pulse bg-zinc-400" />
            </div>
            {live.thinking && (
              <details className="text-[11px] text-zinc-500">
                <summary>thinking…</summary>
                <pre className="whitespace-pre-wrap">{live.thinking}</pre>
              </details>
            )}
          </article>
        )}
        <div ref={tailRef} />
      </div>
      <footer className="border-t border-zinc-800 p-3">
        <textarea
          rows={3}
          className="w-full resize-y bg-zinc-900 px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-zinc-600"
          placeholder="What does your character do?"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void submit();
            } else if (e.key === "Escape" && streaming) {
              cancelLive();
            }
          }}
          disabled={streaming}
        />
        <div className="mt-2 flex items-center justify-between text-xs text-zinc-500">
          <span>Enter sends · Shift+Enter newline · Esc cancels</span>
          <div className="flex gap-2">
            {streaming ? (
              <button
                className="bg-rose-500 px-3 py-1 text-xs font-medium text-zinc-50 hover:bg-rose-400"
                onClick={cancelLive}
              >
                cancel
              </button>
            ) : (
              <button
                className="bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-900 hover:bg-white disabled:opacity-50"
                onClick={() => void submit()}
                disabled={!input.trim()}
              >
                send
              </button>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
};
