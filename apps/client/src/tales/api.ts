import type { SetupData } from "@tavern/shared";

import type { AnchorFacet, PinnedEntry, Scene, Tale, TaleSummary } from "./types.js";

const json = async <T>(r: Response): Promise<T> => {
  if (!r.ok) {
    const body = await r.text();
    throw new Error(`${r.status} ${r.statusText}: ${body}`);
  }
  if (r.status === 204) return undefined as T;
  return (await r.json()) as T;
};

const send = (url: string, init?: RequestInit) =>
  fetch(url, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });

export const talesApi = {
  list: () => send("/api/tales").then((r) => json<TaleSummary[]>(r)),
  get: (id: string) => send(`/api/tales/${id}`).then((r) => json<Tale>(r)),
  create: (input: { name: string; description?: string; anchorProse?: string }) =>
    send("/api/tales", { method: "POST", body: JSON.stringify(input) }).then((r) =>
      json<Tale>(r),
    ),
  update: (
    id: string,
    patch: { name?: string; description?: string; anchorProse?: string; activeSceneId?: string | null },
  ) =>
    send(`/api/tales/${id}`, { method: "PATCH", body: JSON.stringify(patch) }).then((r) =>
      json<Tale>(r),
    ),
  delete: (id: string) =>
    send(`/api/tales/${id}`, { method: "DELETE" }).then((r) => json<void>(r)),

  putSetup: (id: string, data: SetupData) =>
    send(`/api/tales/${id}/setup`, { method: "PUT", body: JSON.stringify(data) }).then((r) =>
      json<SetupData>(r),
    ),
  putPinned: (id: string, entryIds: string[]) =>
    send(`/api/tales/${id}/pinned`, { method: "PUT", body: JSON.stringify({ entryIds }) }).then(
      (r) => json<PinnedEntry[]>(r),
    ),
  putAnchorFacets: (id: string, facets: { label: string; body?: string }[]) =>
    send(`/api/tales/${id}/anchor-facets`, {
      method: "PUT",
      body: JSON.stringify({ facets }),
    }).then((r) => json<AnchorFacet[]>(r)),

  createScene: (taleId: string, input: { name: string; anchorProse?: string }) =>
    send(`/api/tales/${taleId}/scenes`, { method: "POST", body: JSON.stringify(input) }).then(
      (r) => json<Scene>(r),
    ),
  getScene: (id: string) => send(`/api/scenes/${id}`).then((r) => json<Scene>(r)),
  updateScene: (
    id: string,
    patch: { name?: string; anchorProse?: string; position?: number },
  ) =>
    send(`/api/scenes/${id}`, { method: "PATCH", body: JSON.stringify(patch) }).then((r) =>
      json<Scene>(r),
    ),
  deleteScene: (id: string) =>
    send(`/api/scenes/${id}`, { method: "DELETE" }).then((r) => json<void>(r)),

  putSceneAdjustments: (sceneId: string, data: SetupData) =>
    send(`/api/scenes/${sceneId}/adjustments`, { method: "PUT", body: JSON.stringify(data) }).then(
      (r) => json<SetupData>(r),
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
