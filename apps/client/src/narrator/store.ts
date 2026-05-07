import { create } from "zustand";
import type { Beat, BeatEvent } from "@tavern/shared";

import { beatsApi, streamBeat } from "./api.js";

export type LiveStreamState = {
  beatId: string | null;
  text: string;
  thinking: string;
  events: BeatEvent[];
  systemPrompt: string | null;
  cancel: (() => void) | null;
};

type State = {
  bySceneId: Record<string, Beat[]>;
  live: LiveStreamState;
  error: string | null;
};

type Actions = {
  loadBeats: (sceneId: string) => Promise<void>;
  startBeat: (sceneId: string, playerInput: string) => Promise<void>;
  cancelLive: () => void;
  deleteBeat: (sceneId: string, beatId: string) => Promise<void>;
};

const emptyLive = (): LiveStreamState => ({
  beatId: null,
  text: "",
  thinking: "",
  events: [],
  systemPrompt: null,
  cancel: null,
});

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
    if (get().live.cancel) return;
    set({
      live: { ...emptyLive(), cancel: () => undefined },
      error: null,
    });
    const cancel = streamBeat(sceneId, playerInput, (event) => {
      set((s) => {
        const live = { ...s.live, events: [...s.live.events, event] };
        if (event.type === "beat_started") live.beatId = event.beatId;
        else if (event.type === "system_prompt") live.systemPrompt = event.text;
        else if (event.type === "text_delta") live.text += event.text;
        else if (event.type === "thinking_delta") live.thinking += event.text;
        else if (event.type === "done") {
          void get().loadBeats(sceneId);
          return { live: emptyLive() };
        } else if (event.type === "error") {
          void get().loadBeats(sceneId);
          return { live: emptyLive(), error: event.message };
        }
        return { live };
      });
    });
    set((s) => ({ live: { ...s.live, cancel } }));
  },

  cancelLive: () => {
    const c = get().live.cancel;
    if (c) c();
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
