import type { Beat, BeatEvent } from "@tales/shared";
import { create } from "zustand";

import { beatsApi, streamBeat, streamRegenerate, streamReroll } from "./api.js";

export type LiveStreamState = {
  beatId: string | null;
  text: string;
  thinking: string;
  events: BeatEvent[];
  systemPrompt: string | null;
  streaming: boolean;
};

type State = {
  bySceneId: Record<string, Beat[]>;
  live: LiveStreamState;
  error: string | null;
};

type Actions = {
  loadBeats: (sceneId: string) => Promise<void>;
  startBeat: (sceneId: string, playerInput: string) => Promise<void>;
  rerollBeat: (sceneId: string, beatId: string) => Promise<void>;
  regenerateBeat: (sceneId: string, beatId: string, playerInput: string) => Promise<void>;
  editNarratorOutput: (sceneId: string, beatId: string, narratorOutput: string) => Promise<void>;
  selectAlt: (sceneId: string, beatId: string, activeAlt: number) => Promise<void>;
  cancelLive: () => void;
  deleteBeat: (sceneId: string, beatId: string) => Promise<void>;
};

const emptyLive = (): LiveStreamState => ({
  beatId: null,
  text: "",
  thinking: "",
  events: [],
  systemPrompt: null,
  streaming: false,
});

let _liveCancel: (() => void) | null = null;

const consumeStream = (
  set: (fn: (s: State & Actions) => Partial<State>) => void,
  get: () => State & Actions,
  sceneId: string,
  startCancel: (onEvent: (e: BeatEvent) => void) => () => void,
) => {
  set(() => ({ live: { ...emptyLive(), streaming: true }, error: null }));
  _liveCancel = startCancel((event) => {
    set((s) => {
      if (event.type === "regenerated") {
        const sceneBeats = s.bySceneId[sceneId] ?? [];
        const filtered = sceneBeats.filter((b) => !event.deletedBeatIds.includes(b.id));
        return { bySceneId: { ...s.bySceneId, [sceneId]: filtered } };
      }
      const live = { ...s.live, events: [...s.live.events, event] };
      if (event.type === "beat_started") live.beatId = event.beatId;
      else if (event.type === "system_prompt") live.systemPrompt = event.text;
      else if (event.type === "text_delta") live.text += event.text;
      else if (event.type === "thinking_delta") live.thinking += event.text;
      else if (event.type === "done") {
        _liveCancel = null;
        void get().loadBeats(sceneId);
        return { live: emptyLive() };
      } else if (event.type === "error") {
        _liveCancel = null;
        void get().loadBeats(sceneId);
        return { live: emptyLive(), error: event.message };
      }
      return { live };
    });
  });
};

export const useNarrator = create<State & Actions>((set, get) => ({
  bySceneId: {},
  live: emptyLive(),
  error: null,

  loadBeats: async (sceneId) => {
    set({ error: null });
    try {
      const list = await beatsApi.listForScene(sceneId);
      set((s) => ({ bySceneId: { ...s.bySceneId, [sceneId]: list } }));
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) });
    }
  },

  startBeat: async (sceneId, playerInput) => {
    if (get().live.streaming) return;
    consumeStream(set, get, sceneId, (onEvent) => streamBeat(sceneId, playerInput, onEvent));
  },

  rerollBeat: async (sceneId, beatId) => {
    if (get().live.streaming) return;
    consumeStream(set, get, sceneId, (onEvent) => streamReroll(beatId, onEvent));
  },

  regenerateBeat: async (sceneId, beatId, playerInput) => {
    if (get().live.streaming) return;
    consumeStream(set, get, sceneId, (onEvent) => streamRegenerate(beatId, playerInput, onEvent));
  },

  editNarratorOutput: async (sceneId, beatId, narratorOutput) => {
    const updated = await beatsApi.patchNarratorOutput(beatId, narratorOutput);
    set((s) => ({
      bySceneId: {
        ...s.bySceneId,
        [sceneId]: (s.bySceneId[sceneId] ?? []).map((b) => (b.id === beatId ? updated : b)),
      },
    }));
  },

  selectAlt: async (sceneId, beatId, activeAlt) => {
    const updated = await beatsApi.patchActiveAlt(beatId, activeAlt);
    set((s) => ({
      bySceneId: {
        ...s.bySceneId,
        [sceneId]: (s.bySceneId[sceneId] ?? []).map((b) => (b.id === beatId ? updated : b)),
      },
    }));
  },

  cancelLive: () => {
    if (_liveCancel) _liveCancel();
    _liveCancel = null;
    set({ live: emptyLive() });
  },

  deleteBeat: async (sceneId, beatId) => {
    await beatsApi.delete(beatId);
    set((s) => ({
      bySceneId: {
        ...s.bySceneId,
        [sceneId]: (s.bySceneId[sceneId] ?? []).filter((b) => b.id !== beatId),
      },
    }));
  },
}));
