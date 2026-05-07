import { useEffect, useMemo, useState } from "react";

import { type EntryDraft, useCatalog } from "./store.js";
import type { Entry } from "./types.js";
import { NEW_ENTRY_SENTINEL } from "./types.js";

const draftFromEntry = (e: Entry): EntryDraft => ({
  id: e.id,
  typeId: e.typeId,
  name: e.name,
  body: e.body,
  cues: [...e.cues],
});

const blankDraft = (typeId: string): EntryDraft => ({
  id: null,
  typeId,
  name: "",
  body: "",
  cues: [],
});

export const EntryEditor = () => {
  const types = useCatalog((s) => s.types);
  const entries = useCatalog((s) => s.entries);
  const selectedTypeId = useCatalog((s) => s.selectedTypeId);
  const selectedEntryId = useCatalog((s) => s.selectedEntryId);
  const saveEntry = useCatalog((s) => s.saveEntry);
  const deleteEntry = useCatalog((s) => s.deleteEntry);
  const selectEntry = useCatalog((s) => s.selectEntry);

  const selectedType = useMemo(
    () => (selectedTypeId ? (types.find((t) => t.id === selectedTypeId) ?? null) : null),
    [selectedTypeId, types],
  );

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

  const onSave = async () => {
    if (!draft.name.trim()) {
      setError("Name is required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await saveEntry({ ...draft, name: draft.name.trim() });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

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
              type="button"
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
            type="button"
            className="bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-900 hover:bg-white disabled:opacity-50"
            onClick={onSave}
            disabled={saving}
          >
            {saving ? "saving…" : draft.id ? "save" : "create"}
          </button>
        </div>
      </header>

      <div className="space-y-6 p-4">
        <div>
          <label className="mb-2 block text-xs uppercase tracking-wide text-zinc-500">Body</label>
          <textarea
            className="w-full resize-y bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-zinc-600"
            rows={12}
            placeholder="Describe this entry. Free-form text is the source of truth; future templating will parse it."
            value={draft.body}
            onChange={(e) => update({ body: e.target.value })}
          />
        </div>

        <div>
          <label className="mb-2 block text-xs uppercase tracking-wide text-zinc-500">Cues (synonyms / aliases)</label>
          <div className="flex flex-wrap gap-1">
            {draft.cues.map((c) => (
              <span key={c} className="flex items-center gap-1 bg-zinc-800 px-2 py-1 text-xs">
                {c}
                <button
                  type="button"
                  aria-label={`remove cue ${c}`}
                  className="text-zinc-500 hover:text-rose-400"
                  onClick={() => update({ cues: draft.cues.filter((x) => x !== c) })}
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
      </div>
    </section>
  );
};
