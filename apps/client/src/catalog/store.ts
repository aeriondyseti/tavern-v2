import { create } from "zustand";

import { api } from "./api.js";
import type { Entry, Kind, KindId, Type } from "./types.js";

export type EntryDraft = {
  id: string | null;
  typeId: string;
  name: string;
  body: string;
  cues: string[];
};

type State = {
  kinds: Kind[];
  types: Type[];
  entries: Entry[];
  selectedTypeId: string | null;
  selectedEntryId: string | null;
  filter: string;
  loaded: boolean;
  error: string | null;
};

type Actions = {
  load: () => Promise<void>;
  selectType: (typeId: string | null) => Promise<void>;
  selectEntry: (entryId: string | null) => void;
  setFilter: (q: string) => void;
  createType: (kindId: KindId, name: string) => Promise<Type>;
  renameType: (id: string, name: string) => Promise<void>;
  deleteType: (id: string) => Promise<void>;
  reloadEntries: () => Promise<void>;
  saveEntry: (draft: EntryDraft) => Promise<Entry>;
  deleteEntry: (id: string) => Promise<void>;
};

export const useCatalog = create<State & Actions>((set, get) => ({
  kinds: [],
  types: [],
  entries: [],
  selectedTypeId: null,
  selectedEntryId: null,
  filter: "",
  loaded: false,
  error: null,

  load: async () => {
    set({ error: null });
    try {
      const [kinds, types, entries] = await Promise.all([api.listKinds(), api.listTypes(), api.listEntries()]);
      set({ kinds, types, entries, loaded: true });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) });
    }
  },

  selectType: async (typeId) => {
    set({ selectedTypeId: typeId, selectedEntryId: null });
    await get().reloadEntries();
  },

  selectEntry: (entryId) => set({ selectedEntryId: entryId }),

  setFilter: (q) => set({ filter: q }),

  createType: async (kindId, name) => {
    const t = await api.createType(kindId, name);
    set((s) => ({ types: [...s.types, t] }));
    return t;
  },

  renameType: async (id, name) => {
    const updated = await api.updateType(id, { name });
    set((s) => ({ types: s.types.map((t) => (t.id === id ? updated : t)) }));
  },

  deleteType: async (id) => {
    await api.deleteType(id);
    set((s) => ({
      types: s.types.filter((t) => t.id !== id),
      selectedTypeId: s.selectedTypeId === id ? null : s.selectedTypeId,
      entries: s.entries.filter((e) => e.typeId !== id),
    }));
  },

  reloadEntries: async () => {
    const { selectedTypeId, filter } = get();
    const entries = await api.listEntries({
      ...(selectedTypeId ? { typeId: selectedTypeId } : {}),
      ...(filter ? { q: filter } : {}),
    });
    set({ entries });
  },

  saveEntry: async (draft) => {
    const payload = {
      typeId: draft.typeId,
      name: draft.name,
      body: draft.body,
      cues: draft.cues,
    };
    const saved = draft.id ? await api.updateEntry(draft.id, payload) : await api.createEntry(payload);
    set((s) => {
      const others = s.entries.filter((e) => e.id !== saved.id);
      return {
        entries: [...others, saved].sort((a, b) => a.name.localeCompare(b.name)),
        selectedEntryId: saved.id,
      };
    });
    return saved;
  },

  deleteEntry: async (id) => {
    await api.deleteEntry(id);
    set((s) => ({
      entries: s.entries.filter((e) => e.id !== id),
      selectedEntryId: s.selectedEntryId === id ? null : s.selectedEntryId,
    }));
  },
}));
