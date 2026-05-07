import type { EntryCreate, EntryUpdate, KindId } from "@tales/shared";

import { json, send } from "../api/util.js";
import type { Entry, Kind, Type } from "./types.js";

export const api = {
  listKinds: () => send("/api/kinds").then((r) => json<Kind[]>(r)),

  listTypes: (kindId?: KindId) => send(`/api/types${kindId ? `?kindId=${kindId}` : ""}`).then((r) => json<Type[]>(r)),
  createType: (kindId: KindId, name: string) =>
    send("/api/types", { method: "POST", body: JSON.stringify({ kindId, name }) }).then((r) => json<Type>(r)),
  updateType: (id: string, patch: { name?: string; position?: number }) =>
    send(`/api/types/${id}`, { method: "PATCH", body: JSON.stringify(patch) }).then((r) => json<Type>(r)),
  deleteType: (id: string) => send(`/api/types/${id}`, { method: "DELETE" }).then((r) => json<void>(r)),

  listEntries: (opts: { typeId?: string; kindId?: KindId; q?: string } = {}) => {
    const qs = new URLSearchParams();
    if (opts.typeId) qs.set("typeId", opts.typeId);
    if (opts.kindId) qs.set("kindId", opts.kindId);
    if (opts.q) qs.set("q", opts.q);
    return send(`/api/entries${qs.size ? `?${qs}` : ""}`).then((r) => json<Entry[]>(r));
  },
  getEntry: (id: string) => send(`/api/entries/${id}`).then((r) => json<Entry>(r)),
  createEntry: (input: EntryCreate) =>
    send("/api/entries", { method: "POST", body: JSON.stringify(input) }).then((r) => json<Entry>(r)),
  updateEntry: (id: string, patch: EntryUpdate) =>
    send(`/api/entries/${id}`, { method: "PATCH", body: JSON.stringify(patch) }).then((r) => json<Entry>(r)),
  deleteEntry: (id: string) => send(`/api/entries/${id}`, { method: "DELETE" }).then((r) => json<void>(r)),
};
