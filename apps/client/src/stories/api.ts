import type { SetupData } from "@tales/shared";

import { json, send } from "../api/util.js";
import type { AnchorFacet, PinnedEntry, Scene, Story, StorySummary } from "./types.js";

export const storiesApi = {
  list: () => send("/api/stories").then((r) => json<StorySummary[]>(r)),
  get: (id: string) => send(`/api/stories/${id}`).then((r) => json<Story>(r)),
  create: (input: { name: string; description?: string; anchorProse?: string }) =>
    send("/api/stories", { method: "POST", body: JSON.stringify(input) }).then((r) => json<Story>(r)),
  update: (
    id: string,
    patch: { name?: string; description?: string; anchorProse?: string; activeSceneId?: string | null },
  ) => send(`/api/stories/${id}`, { method: "PATCH", body: JSON.stringify(patch) }).then((r) => json<Story>(r)),
  delete: (id: string) => send(`/api/stories/${id}`, { method: "DELETE" }).then((r) => json<void>(r)),

  putSetup: (id: string, data: SetupData) =>
    send(`/api/stories/${id}/setup`, { method: "PUT", body: JSON.stringify(data) }).then((r) => json<SetupData>(r)),
  putPinned: (id: string, entryIds: string[]) =>
    send(`/api/stories/${id}/pinned`, { method: "PUT", body: JSON.stringify({ entryIds }) }).then((r) =>
      json<PinnedEntry[]>(r),
    ),
  putAnchorFacets: (id: string, facets: { label: string; body?: string }[]) =>
    send(`/api/stories/${id}/anchor-facets`, {
      method: "PUT",
      body: JSON.stringify({ facets }),
    }).then((r) => json<AnchorFacet[]>(r)),

  createScene: (storyId: string, input: { name: string; anchorProse?: string }) =>
    send(`/api/stories/${storyId}/scenes`, { method: "POST", body: JSON.stringify(input) }).then((r) => json<Scene>(r)),
  getScene: (id: string) => send(`/api/scenes/${id}`).then((r) => json<Scene>(r)),
  updateScene: (id: string, patch: { name?: string; anchorProse?: string; position?: number }) =>
    send(`/api/scenes/${id}`, { method: "PATCH", body: JSON.stringify(patch) }).then((r) => json<Scene>(r)),
  deleteScene: (id: string) => send(`/api/scenes/${id}`, { method: "DELETE" }).then((r) => json<void>(r)),

  putSceneAdjustments: (sceneId: string, data: SetupData) =>
    send(`/api/scenes/${sceneId}/adjustments`, { method: "PUT", body: JSON.stringify(data) }).then((r) =>
      json<SetupData>(r),
    ),
  dropSceneAdjustments: (sceneId: string) =>
    send(`/api/scenes/${sceneId}/adjustments`, { method: "DELETE" }).then((r) => json<void>(r)),

  putScenePinned: (sceneId: string, entryIds: string[]) =>
    send(`/api/scenes/${sceneId}/pinned`, {
      method: "PUT",
      body: JSON.stringify({ entryIds }),
    }).then((r) => json<PinnedEntry[]>(r)),
  putSceneAnchorFacets: (sceneId: string, facets: { label: string; body?: string }[]) =>
    send(`/api/scenes/${sceneId}/anchor-facets`, {
      method: "PUT",
      body: JSON.stringify({ facets }),
    }).then((r) => json<AnchorFacet[]>(r)),
};
