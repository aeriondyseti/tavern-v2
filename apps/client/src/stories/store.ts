import type { SetupData } from "@tales/shared";
import { create } from "zustand";

import { storiesApi } from "./api.js";
import type { Scene, SceneSummary, Story, StorySummary } from "./types.js";

type State = {
  stories: StorySummary[];
  activeStoryId: string | null;
  activeStory: Story | null;
  activeScene: Scene | null;
  loaded: boolean;
  error: string | null;
};

type Actions = {
  loadList: () => Promise<void>;
  selectStory: (id: string | null) => Promise<void>;
  createStory: (input: { name: string; description?: string; anchorProse?: string }) => Promise<Story>;
  updateStory: (
    id: string,
    patch: { name?: string; description?: string; anchorProse?: string; activeSceneId?: string | null },
  ) => Promise<Story>;
  deleteStory: (id: string) => Promise<void>;
  saveStorySetup: (id: string, data: SetupData) => Promise<void>;
  saveStoryPinned: (id: string, entryIds: string[]) => Promise<void>;
  saveStoryAnchorFacets: (id: string, facets: { label: string; body?: string }[]) => Promise<void>;
  createScene: (storyId: string, input: { name: string; anchorProse?: string }) => Promise<Scene>;
  updateScene: (id: string, patch: { name?: string; anchorProse?: string; position?: number }) => Promise<Scene>;
  deleteScene: (id: string) => Promise<void>;
  selectScene: (id: string | null) => Promise<void>;
  saveSceneAdjustments: (sceneId: string, data: SetupData) => Promise<void>;
  dropSceneAdjustments: (sceneId: string) => Promise<void>;
  saveScenePinned: (sceneId: string, entryIds: string[]) => Promise<void>;
  saveSceneAnchorFacets: (sceneId: string, facets: { label: string; body?: string }[]) => Promise<void>;
};

const summarize = (t: Story): StorySummary => ({
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

export const useStories = create<State & Actions>((set) => ({
  stories: [],
  activeStoryId: null,
  activeStory: null,
  activeScene: null,
  loaded: false,
  error: null,

  loadList: async () => {
    set({ error: null });
    try {
      const stories = await storiesApi.list();
      set({ stories, loaded: true });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) });
    }
  },

  selectStory: async (id) => {
    if (!id) {
      set({ activeStoryId: null, activeStory: null, activeScene: null });
      return;
    }
    set({ activeStoryId: id });
    const story = await storiesApi.get(id);
    const activeScene = story.activeSceneId ? await storiesApi.getScene(story.activeSceneId) : null;
    set({ activeStory: story, activeScene });
  },

  createStory: async (input) => {
    const story = await storiesApi.create(input);
    set((s) => ({ stories: [...s.stories, summarize(story)] }));
    return story;
  },

  updateStory: async (id, patch) => {
    const story = await storiesApi.update(id, patch);
    set((s) => ({
      stories: s.stories.map((t) => (t.id === id ? summarize(story) : t)),
      activeStory: s.activeStoryId === id ? story : s.activeStory,
    }));
    if (patch.activeSceneId !== undefined) {
      const next = patch.activeSceneId ? await storiesApi.getScene(patch.activeSceneId) : null;
      set({ activeScene: next });
    }
    return story;
  },

  deleteStory: async (id) => {
    await storiesApi.delete(id);
    set((s) => ({
      stories: s.stories.filter((t) => t.id !== id),
      activeStoryId: s.activeStoryId === id ? null : s.activeStoryId,
      activeStory: s.activeStoryId === id ? null : s.activeStory,
      activeScene: s.activeStoryId === id ? null : s.activeScene,
    }));
  },

  saveStorySetup: async (id, data) => {
    const setup = await storiesApi.putSetup(id, data);
    set((s) => (s.activeStoryId === id && s.activeStory ? { activeStory: { ...s.activeStory, setup } } : {}));
  },

  saveStoryPinned: async (id, entryIds) => {
    const next = await storiesApi.putPinned(id, entryIds);
    set((s) => (s.activeStoryId === id && s.activeStory ? { activeStory: { ...s.activeStory, pinned: next } } : {}));
  },

  saveStoryAnchorFacets: async (id, facets) => {
    const next = await storiesApi.putAnchorFacets(id, facets);
    set((s) =>
      s.activeStoryId === id && s.activeStory ? { activeStory: { ...s.activeStory, anchorFacets: next } } : {},
    );
  },

  createScene: async (storyId, input) => {
    const scene = await storiesApi.createScene(storyId, input);
    set((s) => {
      if (s.activeStoryId !== storyId || !s.activeStory) return {};
      const summary = summarizeScene(scene);
      const story = { ...s.activeStory, scenes: [...s.activeStory.scenes, summary] };
      return {
        activeStory: story,
        stories: s.stories.map((t) => (t.id === storyId ? summarize(story) : t)),
      };
    });
    return scene;
  },

  updateScene: async (id, patch) => {
    const scene = await storiesApi.updateScene(id, patch);
    set((s) => {
      const story = s.activeStory;
      if (!story || story.id !== scene.storyId) {
        return { activeScene: s.activeScene?.id === id ? scene : s.activeScene };
      }
      const next = {
        ...story,
        scenes: story.scenes.map((sc) => (sc.id === id ? summarizeScene(scene) : sc)),
      };
      return {
        activeStory: next,
        activeScene: s.activeScene?.id === id ? scene : s.activeScene,
      };
    });
    return scene;
  },

  deleteScene: async (id) => {
    await storiesApi.deleteScene(id);
    set((s) => {
      const story = s.activeStory;
      if (!story) return {};
      const scenes = story.scenes.filter((sc) => sc.id !== id);
      const activeSceneId = story.activeSceneId === id ? null : story.activeSceneId;
      const next = { ...story, scenes, activeSceneId };
      return {
        activeStory: next,
        activeScene: s.activeScene?.id === id ? null : s.activeScene,
        stories: s.stories.map((t) => (t.id === story.id ? summarize(next) : t)),
      };
    });
  },

  selectScene: async (id) => {
    if (!id) return set({ activeScene: null });
    const scene = await storiesApi.getScene(id);
    set({ activeScene: scene });
  },

  saveSceneAdjustments: async (sceneId, data) => {
    const adjustments = await storiesApi.putSceneAdjustments(sceneId, data);
    set((s) => spliceSceneAdjustments(s, sceneId, adjustments, true));
  },

  dropSceneAdjustments: async (sceneId) => {
    await storiesApi.dropSceneAdjustments(sceneId);
    set((s) => spliceSceneAdjustments(s, sceneId, null, false));
  },

  saveScenePinned: async (sceneId, entryIds) => {
    const next = await storiesApi.putScenePinned(sceneId, entryIds);
    set((s) => (s.activeScene?.id === sceneId ? { activeScene: { ...s.activeScene, pinned: next } } : {}));
  },

  saveSceneAnchorFacets: async (sceneId, facets) => {
    const next = await storiesApi.putSceneAnchorFacets(sceneId, facets);
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
  if (s.activeStory) {
    const idx = s.activeStory.scenes.findIndex((sc) => sc.id === sceneId);
    if (idx >= 0) {
      const summary = s.activeStory.scenes[idx]!;
      const updated: SceneSummary = { ...summary, hasAdjustments };
      patch.activeStory = {
        ...s.activeStory,
        scenes: s.activeStory.scenes.map((sc, i) => (i === idx ? updated : sc)),
      };
    }
  }
  return patch;
};
