import type { Entry, EntryInput, Kind, KindId, Type } from "./types.js";

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

export const api = {
  listKinds: () => send("/api/kinds").then((r) => json<Kind[]>(r)),

  listTypes: (kindId?: KindId) =>
    send(`/api/types${kindId ? `?kindId=${kindId}` : ""}`).then((r) => json<Type[]>(r)),
  createType: (kindId: KindId, name: string) =>
    send("/api/types", { method: "POST", body: JSON.stringify({ kindId, name }) }).then((r) =>
      json<Type>(r),
    ),
  updateType: (id: string, patch: { name?: string; position?: number }) =>
    send(`/api/types/${id}`, { method: "PATCH", body: JSON.stringify(patch) }).then((r) =>
      json<Type>(r),
    ),
  deleteType: (id: string) => send(`/api/types/${id}`, { method: "DELETE" }).then((r) => json<void>(r)),

  listEntries: (opts: { typeId?: string; kindId?: KindId; q?: string } = {}) => {
    const qs = new URLSearchParams();
    if (opts.typeId) qs.set("typeId", opts.typeId);
    if (opts.kindId) qs.set("kindId", opts.kindId);
    if (opts.q) qs.set("q", opts.q);
    return send(`/api/entries${qs.size ? `?${qs}` : ""}`).then((r) => json<Entry[]>(r));
  },
  getEntry: (id: string) => send(`/api/entries/${id}`).then((r) => json<Entry>(r)),
  createEntry: (input: EntryInput) =>
    send("/api/entries", { method: "POST", body: JSON.stringify(input) }).then((r) =>
      json<Entry>(r),
    ),
  updateEntry: (id: string, patch: Partial<EntryInput>) =>
    send(`/api/entries/${id}`, { method: "PATCH", body: JSON.stringify(patch) }).then((r) =>
      json<Entry>(r),
    ),
  deleteEntry: (id: string) =>
    send(`/api/entries/${id}`, { method: "DELETE" }).then((r) => json<void>(r)),
};
