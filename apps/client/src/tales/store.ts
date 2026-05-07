import { create } from "zustand";
import type { SetupData } from "@tavern/shared";

import { talesApi } from "./api.js";
import type { Scene, Tale, TaleSummary } from "./types.js";

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
  updateScene: (
    id: string,
    patch: { name?: string; anchorProse?: string; position?: number },
  ) => Promise<Scene>;
  deleteScene: (id: string) => Promise<void>;
  selectScene: (id: string | null) => Promise<void>;
  saveSceneAdjustments: (sceneId: string, data: SetupData) => Promise<void>;
  dropSceneAdjustments: (sceneId: string) => Promise<void>;
  saveScenePinned: (sceneId: string, entryIds: string[]) => Promise<void>;
  saveSceneAnchorFacets: (
    sceneId: string,
    facets: { label: string; body?: string }[],
  ) => Promise<void>;
};

const refreshTale = async (id: string): Promise<Tale> => talesApi.get(id);

export const useTales = create<State & Actions>((set, get) => ({
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
    const tale = await refreshTale(id);
    let activeScene: Scene | null = null;
    if (tale.activeSceneId) {
      activeScene = await talesApi.getScene(tale.activeSceneId);
    }
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
    await talesApi.putSetup(id, data);
    const tale = await refreshTale(id);
    set((s) => ({ activeTale: s.activeTaleId === id ? tale : s.activeTale }));
  },

  saveTalePinned: async (id, entryIds) => {
    await talesApi.putPinned(id, entryIds);
    const tale = await refreshTale(id);
    set((s) => ({ activeTale: s.activeTaleId === id ? tale : s.activeTale }));
  },

  saveTaleAnchorFacets: async (id, facets) => {
    await talesApi.putAnchorFacets(id, facets);
    const tale = await refreshTale(id);
    set((s) => ({ activeTale: s.activeTaleId === id ? tale : s.activeTale }));
  },

  createScene: async (taleId, input) => {
    const scene = await talesApi.createScene(taleId, input);
    const tale = await refreshTale(taleId);
    set((s) => ({
      activeTale: s.activeTaleId === taleId ? tale : s.activeTale,
      tales: s.tales.map((t) => (t.id === taleId ? summarize(tale) : t)),
    }));
    return scene;
  },

  updateScene: async (id, patch) => {
    const scene = await talesApi.updateScene(id, patch);
    const taleId = scene.taleId;
    const tale = await refreshTale(taleId);
    set((s) => ({
      activeTale: s.activeTaleId === taleId ? tale : s.activeTale,
      activeScene: s.activeScene?.id === id ? scene : s.activeScene,
    }));
    return scene;
  },

  deleteScene: async (id) => {
    const taleId = get().activeTale?.id;
    await talesApi.deleteScene(id);
    if (taleId) {
      const tale = await refreshTale(taleId);
      set((s) => ({
        activeTale: tale,
        activeScene: s.activeScene?.id === id ? null : s.activeScene,
        tales: s.tales.map((t) => (t.id === taleId ? summarize(tale) : t)),
      }));
    }
  },

  selectScene: async (id) => {
    if (!id) {
      set({ activeScene: null });
      return;
    }
    const scene = await talesApi.getScene(id);
    set({ activeScene: scene });
  },

  saveSceneAdjustments: async (sceneId, data) => {
    await talesApi.putSceneAdjustments(sceneId, data);
    const scene = await talesApi.getScene(sceneId);
    set((s) => ({ activeScene: s.activeScene?.id === sceneId ? scene : s.activeScene }));
  },

  dropSceneAdjustments: async (sceneId) => {
    await talesApi.dropSceneAdjustments(sceneId);
    const scene = await talesApi.getScene(sceneId);
    set((s) => ({ activeScene: s.activeScene?.id === sceneId ? scene : s.activeScene }));
  },

  saveScenePinned: async (sceneId, entryIds) => {
    await talesApi.putScenePinned(sceneId, entryIds);
    const scene = await talesApi.getScene(sceneId);
    set((s) => ({ activeScene: s.activeScene?.id === sceneId ? scene : s.activeScene }));
  },

  saveSceneAnchorFacets: async (sceneId, facets) => {
    await talesApi.putSceneAnchorFacets(sceneId, facets);
    const scene = await talesApi.getScene(sceneId);
    set((s) => ({ activeScene: s.activeScene?.id === sceneId ? scene : s.activeScene }));
  },
}));

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
