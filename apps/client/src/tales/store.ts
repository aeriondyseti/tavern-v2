import type { SetupData } from "@tavern/shared";
import { create } from "zustand";

import { talesApi } from "./api.js";
import type { Scene, SceneSummary, Tale, TaleSummary } from "./types.js";

type State = {
  tales: TaleSummary[];
  activeTaleId: string | null;
  activeTale: Tale | null;
  activeScene: Scene | null;
  loaded: boolean;
  error: string | null;
};

type Actions = {
  loadList: () => Promise<void>;
  selectTale: (id: string | null) => Promise<void>;
  createTale: (input: { name: string; description?: string; anchorProse?: string }) => Promise<Tale>;
  updateTale: (
    id: string,
    patch: { name?: string; description?: string; anchorProse?: string; activeSceneId?: string | null },
  ) => Promise<Tale>;
  deleteTale: (id: string) => Promise<void>;
  saveTaleSetup: (id: string, data: SetupData) => Promise<void>;
  saveTalePinned: (id: string, entryIds: string[]) => Promise<void>;
  saveTaleAnchorFacets: (id: string, facets: { label: string; body?: string }[]) => Promise<void>;
  createScene: (taleId: string, input: { name: string; anchorProse?: string }) => Promise<Scene>;
  updateScene: (id: string, patch: { name?: string; anchorProse?: string; position?: number }) => Promise<Scene>;
  deleteScene: (id: string) => Promise<void>;
  selectScene: (id: string | null) => Promise<void>;
  saveSceneAdjustments: (sceneId: string, data: SetupData) => Promise<void>;
  dropSceneAdjustments: (sceneId: string) => Promise<void>;
  saveScenePinned: (sceneId: string, entryIds: string[]) => Promise<void>;
  saveSceneAnchorFacets: (sceneId: string, facets: { label: string; body?: string }[]) => Promise<void>;
};

const summarize = (t: Tale): TaleSummary => ({
  id: t.id,
  name: t.name,
  description: t.description,
  anchorProse: t.anchorProse,
  activeSceneId: t.activeSceneId,
  sceneCount: t.scenes.length,
  createdAt: t.createdAt,
  updatedAt: t.updatedAt,
});

const summarizeScene = (s: Scene): SceneSummary => ({
  id: s.id,
  name: s.name,
  anchorProse: s.anchorProse,
  position: s.position,
  hasAdjustments: s.hasAdjustments,
  createdAt: s.createdAt,
});

export const useTales = create<State & Actions>((set) => ({
  tales: [],
  activeTaleId: null,
  activeTale: null,
  activeScene: null,
  loaded: false,
  error: null,

  loadList: async () => {
    set({ error: null });
    try {
      const tales = await talesApi.list();
      set({ tales, loaded: true });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) });
    }
  },

  selectTale: async (id) => {
    if (!id) {
      set({ activeTaleId: null, activeTale: null, activeScene: null });
      return;
    }
    set({ activeTaleId: id });
    const tale = await talesApi.get(id);
    const activeScene = tale.activeSceneId ? await talesApi.getScene(tale.activeSceneId) : null;
    set({ activeTale: tale, activeScene });
  },

  createTale: async (input) => {
    const tale = await talesApi.create(input);
    set((s) => ({ tales: [...s.tales, summarize(tale)] }));
    return tale;
  },

  updateTale: async (id, patch) => {
    const tale = await talesApi.update(id, patch);
    set((s) => ({
      tales: s.tales.map((t) => (t.id === id ? summarize(tale) : t)),
      activeTale: s.activeTaleId === id ? tale : s.activeTale,
    }));
    if (patch.activeSceneId !== undefined) {
      const next = patch.activeSceneId ? await talesApi.getScene(patch.activeSceneId) : null;
      set({ activeScene: next });
    }
    return tale;
  },

  deleteTale: async (id) => {
    await talesApi.delete(id);
    set((s) => ({
      tales: s.tales.filter((t) => t.id !== id),
      activeTaleId: s.activeTaleId === id ? null : s.activeTaleId,
      activeTale: s.activeTaleId === id ? null : s.activeTale,
      activeScene: s.activeTaleId === id ? null : s.activeScene,
    }));
  },

  saveTaleSetup: async (id, data) => {
    const setup = await talesApi.putSetup(id, data);
    set((s) => (s.activeTaleId === id && s.activeTale ? { activeTale: { ...s.activeTale, setup } } : {}));
  },

  saveTalePinned: async (id, entryIds) => {
    const next = await talesApi.putPinned(id, entryIds);
    set((s) => (s.activeTaleId === id && s.activeTale ? { activeTale: { ...s.activeTale, pinned: next } } : {}));
  },

  saveTaleAnchorFacets: async (id, facets) => {
    const next = await talesApi.putAnchorFacets(id, facets);
    set((s) => (s.activeTaleId === id && s.activeTale ? { activeTale: { ...s.activeTale, anchorFacets: next } } : {}));
  },

  createScene: async (taleId, input) => {
    const scene = await talesApi.createScene(taleId, input);
    set((s) => {
      if (s.activeTaleId !== taleId || !s.activeTale) return {};
      const summary = summarizeScene(scene);
      const tale = { ...s.activeTale, scenes: [...s.activeTale.scenes, summary] };
      return {
        activeTale: tale,
        tales: s.tales.map((t) => (t.id === taleId ? summarize(tale) : t)),
      };
    });
    return scene;
  },

  updateScene: async (id, patch) => {
    const scene = await talesApi.updateScene(id, patch);
    set((s) => {
      const tale = s.activeTale;
      if (!tale || tale.id !== scene.taleId) {
        return { activeScene: s.activeScene?.id === id ? scene : s.activeScene };
      }
      const next = {
        ...tale,
        scenes: tale.scenes.map((sc) => (sc.id === id ? summarizeScene(scene) : sc)),
      };
      return {
        activeTale: next,
        activeScene: s.activeScene?.id === id ? scene : s.activeScene,
      };
    });
    return scene;
  },

  deleteScene: async (id) => {
    await talesApi.deleteScene(id);
    set((s) => {
      const tale = s.activeTale;
      if (!tale) return {};
      const scenes = tale.scenes.filter((sc) => sc.id !== id);
      const activeSceneId = tale.activeSceneId === id ? null : tale.activeSceneId;
      const next = { ...tale, scenes, activeSceneId };
      return {
        activeTale: next,
        activeScene: s.activeScene?.id === id ? null : s.activeScene,
        tales: s.tales.map((t) => (t.id === tale.id ? summarize(next) : t)),
      };
    });
  },

  selectScene: async (id) => {
    if (!id) return set({ activeScene: null });
    const scene = await talesApi.getScene(id);
    set({ activeScene: scene });
  },

  saveSceneAdjustments: async (sceneId, data) => {
    const adjustments = await talesApi.putSceneAdjustments(sceneId, data);
    set((s) => spliceSceneAdjustments(s, sceneId, adjustments, true));
  },

  dropSceneAdjustments: async (sceneId) => {
    await talesApi.dropSceneAdjustments(sceneId);
    set((s) => spliceSceneAdjustments(s, sceneId, null, false));
  },

  saveScenePinned: async (sceneId, entryIds) => {
    const next = await talesApi.putScenePinned(sceneId, entryIds);
    set((s) => (s.activeScene?.id === sceneId ? { activeScene: { ...s.activeScene, pinned: next } } : {}));
  },

  saveSceneAnchorFacets: async (sceneId, facets) => {
    const next = await talesApi.putSceneAnchorFacets(sceneId, facets);
    set((s) => (s.activeScene?.id === sceneId ? { activeScene: { ...s.activeScene, anchorFacets: next } } : {}));
  },
}));

const spliceSceneAdjustments = (
  s: State,
  sceneId: string,
  adjustments: SetupData | null,
  hasAdjustments: boolean,
): Partial<State> => {
  const patch: Partial<State> = {};
  if (s.activeScene?.id === sceneId) {
    patch.activeScene = { ...s.activeScene, adjustments, hasAdjustments };
  }
  if (s.activeTale) {
    const idx = s.activeTale.scenes.findIndex((sc) => sc.id === sceneId);
    if (idx >= 0) {
      const summary = s.activeTale.scenes[idx]!;
      const updated: SceneSummary = { ...summary, hasAdjustments };
      patch.activeTale = {
        ...s.activeTale,
        scenes: s.activeTale.scenes.map((sc, i) => (i === idx ? updated : sc)),
      };
    }
  }
  return patch;
};
