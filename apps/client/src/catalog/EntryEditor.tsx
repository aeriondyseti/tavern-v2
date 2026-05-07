import { useEffect, useMemo, useState } from "react";

import { useCatalog, type EntryDraft } from "./store.js";
import {
  DIRECTION_TIERS,
  FACET_MODES,
  KIND_DIRECTION,
  NEW_ENTRY_SENTINEL,
} from "./types.js";
import type { DirectionTier, Entry, FacetMode } from "./types.js";

type FacetField = EntryDraft["facets"][number];

const draftFromEntry = (e: Entry): EntryDraft => ({
  id: e.id,
  typeId: e.typeId,
  name: e.name,
  facets: e.facets.map((f) => ({ id: f.id, label: f.label, body: f.body, mode: f.mode })),
  cues: [...e.cues],
  connections: e.connections.map((c) => ({ toEntryId: c.toEntryId })),
  tier: e.tier,
});

const blankDraft = (typeId: string): EntryDraft => ({
  id: null,
  typeId,
  name: "",
  facets: [{ label: "Description", body: "", mode: "always" }],
  cues: [],
  connections: [],
  tier: "normal",
});

export const EntryEditor = () => {
  const {
    types,
    entries,
    selectedTypeId,
    selectedEntryId,
    saveEntry,
    deleteEntry,
    selectEntry,
  } = useCatalog();

  const selectedType = useMemo(
    () => (selectedTypeId ? types.find((t) => t.id === selectedTypeId) ?? null : null),
    [selectedTypeId, types],
  );
  const isDirection = selectedType?.kindId === KIND_DIRECTION;

  const initial = useMemo<EntryDraft | null>(() => {
    if (selectedEntryId === NEW_ENTRY_SENTINEL && selectedType) return blankDraft(selectedType.id);
    if (selectedEntryId) {
      const e = entries.find((x) => x.id === selectedEntryId);
      if (e) return draftFromEntry(e);
    }
    return null;
  }, [selectedEntryId, selectedType, entries]);

  const [draft, setDraft] = useState<EntryDraft | null>(initial);
  const [cueDraft, setCueDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(initial);
    setError(null);
    setCueDraft("");
  }, [initial]);

  if (!draft) {
    return (
      <section className="flex flex-1 items-center justify-center p-8 text-sm text-zinc-500">
        Select an entry, or create one from the list.
      </section>
    );
  }

  const update = (patch: Partial<EntryDraft>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  const updateFacet = (i: number, patch: Partial<FacetField>) =>
    setDraft((d) =>
      d ? { ...d, facets: d.facets.map((x, j) => (j === i ? { ...x, ...patch } : x)) } : d,
    );

  const onSave = async () => {
    if (!draft.name.trim()) {
      setError("Name is required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await saveEntry({
        ...draft,
        name: draft.name.trim(),
        tier: isDirection ? draft.tier : null,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const allOtherEntries = entries.filter((e) => e.id !== draft.id);

  return (
    <section className="flex flex-1 flex-col overflow-y-auto">
      <header className="sticky top-0 flex items-center justify-between gap-3 border-b border-zinc-800 bg-zinc-950 px-4 py-3">
        <input
          className="flex-1 bg-transparent text-lg outline-none placeholder:text-zinc-600"
          placeholder="entry name"
          value={draft.name}
          onChange={(e) => update({ name: e.target.value })}
        />
        <div className="flex items-center gap-2">
          {error && <span className="text-xs text-rose-400">{error}</span>}
          {draft.id && (
            <button
              className="text-xs text-zinc-500 hover:text-rose-400"
              onClick={() => {
                if (confirm(`Delete "${draft.name}"?`)) {
                  deleteEntry(draft.id!);
                  selectEntry(null);
                }
              }}
            >
              delete
            </button>
          )}
          <button
            className="bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-900 hover:bg-white disabled:opacity-50"
            onClick={onSave}
            disabled={saving}
          >
            {saving ? "saving…" : draft.id ? "save" : "create"}
          </button>
        </div>
      </header>

      <div className="space-y-6 p-4">
        {isDirection && (
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wide text-zinc-500">Tier</label>
            <select
              className="bg-zinc-900 px-2 py-1 text-sm"
              value={draft.tier ?? "normal"}
              onChange={(e) => update({ tier: e.target.value as DirectionTier })}
            >
              {DIRECTION_TIERS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="mb-2 block text-xs uppercase tracking-wide text-zinc-500">Facets</label>
          <ul className="space-y-2">
            {draft.facets.map((f, i) => (
              <li key={i} className="border border-zinc-800 p-3">
                <div className="mb-2 flex items-center gap-2">
                  <input
                    className="flex-1 bg-zinc-900 px-2 py-1 text-sm outline-none"
                    placeholder="label"
                    value={f.label}
                    onChange={(e) => updateFacet(i, { label: e.target.value })}
                  />
                  <select
                    className="bg-zinc-900 px-2 py-1 text-sm"
                    value={f.mode}
                    onChange={(e) => updateFacet(i, { mode: e.target.value as FacetMode })}
                  >
                    {FACET_MODES.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <button
                    className="text-xs text-zinc-500 hover:text-rose-400"
                    onClick={() =>
                      update({ facets: draft.facets.filter((_, j) => j !== i) })
                    }
                  >
                    remove
                  </button>
                </div>
                <textarea
                  className="w-full resize-y bg-zinc-900 px-2 py-1 text-sm outline-none"
                  rows={3}
                  placeholder="body"
                  value={f.body}
                  onChange={(e) => updateFacet(i, { body: e.target.value })}
                />
              </li>
            ))}
          </ul>
          <button
            className="mt-2 text-xs text-zinc-400 hover:text-zinc-200"
            onClick={() =>
              update({
                facets: [...draft.facets, { label: "", body: "", mode: "always" }],
              })
            }
          >
            + add facet
          </button>
        </div>

        <div>
          <label className="mb-2 block text-xs uppercase tracking-wide text-zinc-500">
            Cues (synonyms / aliases)
          </label>
          <div className="flex flex-wrap gap-1">
            {draft.cues.map((c, i) => (
              <span key={i} className="flex items-center gap-1 bg-zinc-800 px-2 py-1 text-xs">
                {c}
                <button
                  className="text-zinc-500 hover:text-rose-400"
                  onClick={() => update({ cues: draft.cues.filter((_, j) => j !== i) })}
                >
                  ×
                </button>
              </span>
            ))}
            <input
              className="bg-zinc-900 px-2 py-1 text-xs outline-none"
              placeholder="add cue + Enter"
              value={cueDraft}
              onChange={(e) => setCueDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const t = cueDraft.trim();
                  if (t && !draft.cues.includes(t)) update({ cues: [...draft.cues, t] });
                  setCueDraft("");
                }
              }}
            />
          </div>
        </div>

        <div>
          <label className="mb-2 block text-xs uppercase tracking-wide text-zinc-500">
            Brings (this entry pulls these in when fetched)
          </label>
          <ul className="space-y-1">
            {draft.connections.map((c, i) => {
              const target = entries.find((e) => e.id === c.toEntryId);
              return (
                <li key={i} className="flex items-center gap-2 text-sm">
                  <span className="flex-1 text-zinc-300">{target?.name ?? c.toEntryId}</span>
                  <button
                    className="text-xs text-zinc-500 hover:text-rose-400"
                    onClick={() =>
                      update({ connections: draft.connections.filter((_, j) => j !== i) })
                    }
                  >
                    remove
                  </button>
                </li>
              );
            })}
          </ul>
          <select
            className="mt-2 bg-zinc-900 px-2 py-1 text-sm"
            value=""
            onChange={(e) => {
              const id = e.target.value;
              if (id && !draft.connections.find((c) => c.toEntryId === id)) {
                update({ connections: [...draft.connections, { toEntryId: id }] });
              }
            }}
          >
            <option value="">+ add brings target</option>
            {allOtherEntries.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </section>
  );
};
