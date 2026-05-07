import type { Beat, BeatEvent, BeatTranscript } from "@tavern/shared";

import { json, send } from "../api/util.js";

export const beatsApi = {
  listForScene: (sceneId: string) =>
    send(`/api/scenes/${sceneId}/beats`).then((r) => json<Beat[]>(r)),
  transcripts: (beatId: string) =>
    send(`/api/beats/${beatId}/transcripts`).then((r) => json<BeatTranscript[]>(r)),
  delete: (beatId: string) =>
    send(`/api/beats/${beatId}`, { method: "DELETE" }).then((r) => json<void>(r)),
};

export const streamBeat = (
  sceneId: string,
  playerInput: string,
  onEvent: (e: BeatEvent) => void,
): (() => void) => {
  const ac = new AbortController();
  void (async () => {
    try {
      const r = await fetch(`/api/scenes/${sceneId}/beats`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ playerInput }),
        signal: ac.signal,
      });
      if (!r.ok || !r.body) {
        onEvent({
          type: "error",
          message: `${r.status} ${r.statusText}`,
          ts: Date.now(),
        });
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
          let data = "";
          for (const line of lines) {
            if (line.startsWith("data:")) data += line.slice(5).trim();
          }
          if (!data) continue;
          try {
            onEvent(JSON.parse(data) as BeatEvent);
          } catch {
            // ignore malformed
          }
        }
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        onEvent({
          type: "error",
          message: e instanceof Error ? e.message : String(e),
          ts: Date.now(),
        });
      }
    }
  })();
  return () => ac.abort();
};
