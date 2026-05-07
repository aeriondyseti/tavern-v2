import type { Beat, BeatEvent, BeatTranscript } from "@tales/shared";

import { consumeSseStream, json, send } from "../api/util.js";

export const beatsApi = {
  listForScene: (sceneId: string) => send(`/api/scenes/${sceneId}/beats`).then((r) => json<Beat[]>(r)),
  transcripts: (beatId: string) => send(`/api/beats/${beatId}/transcripts`).then((r) => json<BeatTranscript[]>(r)),
  delete: (beatId: string) => send(`/api/beats/${beatId}`, { method: "DELETE" }).then((r) => json<void>(r)),
  patchNarratorOutput: (beatId: string, narratorOutput: string) =>
    send(`/api/beats/${beatId}`, {
      method: "PATCH",
      body: JSON.stringify({ narratorOutput }),
    }).then((r) => json<Beat>(r)),
  patchActiveAlt: (beatId: string, activeAlt: number) =>
    send(`/api/beats/${beatId}`, {
      method: "PATCH",
      body: JSON.stringify({ activeAlt }),
    }).then((r) => json<Beat>(r)),
};

const sseToBeatEvent = (onEvent: (e: BeatEvent) => void) => (_event: string, data: string) => {
  try {
    onEvent(JSON.parse(data) as BeatEvent);
  } catch (e) {
    console.error("[sseToBeatEvent] failed to parse SSE frame:", data, e);
  }
};

export const streamBeat = (sceneId: string, playerInput: string, onEvent: (e: BeatEvent) => void): (() => void) =>
  consumeSseStream(
    `/api/scenes/${sceneId}/beats`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ playerInput }),
    },
    sseToBeatEvent(onEvent),
  );

export const streamReroll = (beatId: string, onEvent: (e: BeatEvent) => void): (() => void) =>
  consumeSseStream(
    `/api/beats/${beatId}/reroll`,
    { method: "POST", headers: { "content-type": "application/json" } },
    sseToBeatEvent(onEvent),
  );

export const streamRegenerate = (beatId: string, playerInput: string, onEvent: (e: BeatEvent) => void): (() => void) =>
  consumeSseStream(
    `/api/beats/${beatId}/regenerate`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ playerInput }),
    },
    sseToBeatEvent(onEvent),
  );
