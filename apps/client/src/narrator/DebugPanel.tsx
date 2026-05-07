import { useEffect, useState } from "react";
import type { BeatEvent, BeatTranscript } from "@tavern/shared";

import { beatsApi } from "./api.js";
import { useNarrator } from "./store.js";

type Props = { beatId?: string | null };

export const DebugPanel = ({ beatId }: Props) => {
  const live = useNarrator((s) => s.live);
  const [transcripts, setTranscripts] = useState<BeatTranscript[] | null>(null);
  const [tab, setTab] = useState<"prompt" | "events" | "request">("events");

  useEffect(() => {
    if (!beatId) {
      setTranscripts(null);
      return;
    }
    void beatsApi.transcripts(beatId).then(setTranscripts);
  }, [beatId]);

  const liveEvents = live.events;
  const transcript = transcripts?.[0] ?? null;
  const events: BeatEvent[] = live.streaming
    ? liveEvents
    : (transcript?.events ?? liveEvents);
  const systemPrompt = live.systemPrompt ?? findSystemPrompt(events);
  const requestBody = transcript?.requestBody ?? findRequestBuilt(events);

  return (
    <section className="flex h-full flex-col border-t border-zinc-800 bg-zinc-950 text-xs">
      <header className="flex items-center gap-2 border-b border-zinc-800 px-3 py-1">
        <span className="font-serif text-zinc-300">Debug</span>
        <button
          className={`px-2 py-0.5 ${tab === "events" ? "bg-zinc-800 text-zinc-100" : "text-zinc-500"}`}
          onClick={() => setTab("events")}
        >
          events
        </button>
        <button
          className={`px-2 py-0.5 ${tab === "prompt" ? "bg-zinc-800 text-zinc-100" : "text-zinc-500"}`}
          onClick={() => setTab("prompt")}
        >
          system prompt
        </button>
        <button
          className={`px-2 py-0.5 ${tab === "request" ? "bg-zinc-800 text-zinc-100" : "text-zinc-500"}`}
          onClick={() => setTab("request")}
        >
          request
        </button>
      </header>
      <div className="flex-1 overflow-y-auto p-3">
        {tab === "prompt" && (
          <pre className="whitespace-pre-wrap text-zinc-300">
            {systemPrompt ?? "no system prompt yet"}
          </pre>
        )}
        {tab === "request" && (
          <pre className="whitespace-pre-wrap text-zinc-300">
            {requestBody ? JSON.stringify(requestBody, null, 2) : "no request yet"}
          </pre>
        )}
        {tab === "events" && (
          <ul className="space-y-1">
            {events.map((e, i) => (
              <li key={i} className="rounded border border-zinc-800 px-2 py-1">
                <div className="flex items-baseline justify-between">
                  <span className="font-mono text-zinc-100">{e.type}</span>
                  <span className="text-[10px] text-zinc-600">
                    {new Date(e.ts).toLocaleTimeString()}
                  </span>
                </div>
                {summarize(e)}
              </li>
            ))}
            {events.length === 0 && <li className="text-zinc-600">No events yet.</li>}
          </ul>
        )}
      </div>
    </section>
  );
};

const findSystemPrompt = (events: BeatEvent[]): string | null => {
  for (const e of events) if (e.type === "system_prompt") return e.text;
  return null;
};

const findRequestBuilt = (events: BeatEvent[]): unknown => {
  for (const e of events) if (e.type === "request_built") return e.body;
  return null;
};

const summarize = (e: BeatEvent) => {
  if (e.type === "tool_use") {
    return (
      <pre className="mt-1 whitespace-pre-wrap text-[11px] text-zinc-400">
        {e.name}({JSON.stringify(e.input)})
      </pre>
    );
  }
  if (e.type === "tool_result" && e.searchCall) {
    return (
      <details className="mt-1">
        <summary className="cursor-pointer text-zinc-500">
          {e.searchCall.candidates.filter((c) => c.selected).length} selected of{" "}
          {e.searchCall.candidates.length} candidates · query="{e.searchCall.query}"
        </summary>
        <table className="mt-1 w-full text-[10px] text-zinc-400">
          <thead>
            <tr className="text-zinc-600">
              <th className="text-left">name</th>
              <th>bm25</th>
              <th>emb</th>
              <th>blend</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {e.searchCall.candidates.map((c) => (
              <tr key={c.entryId} className={c.selected ? "text-zinc-100" : ""}>
                <td>{c.name}</td>
                <td>{c.bm25.toFixed(2)}</td>
                <td>{c.embeddingSim.toFixed(2)}</td>
                <td>{c.blended.toFixed(2)}</td>
                <td>{c.fromBrings ? "↪" : c.selected ? "✓" : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    );
  }
  if (e.type === "text_delta" || e.type === "thinking_delta") {
    return (
      <pre className="mt-1 whitespace-pre-wrap text-[11px] text-zinc-500">
        {e.text.length > 80 ? `${e.text.slice(0, 80)}…` : e.text}
      </pre>
    );
  }
  if (e.type === "error") {
    return <p className="mt-1 text-rose-400">{e.message}</p>;
  }
  return null;
};
