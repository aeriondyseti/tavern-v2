import { useEffect, useRef } from "react";

import { useCatalog } from "./store.js";
import { NEW_ENTRY_SENTINEL } from "./types.js";

export const EntryList = () => {
  const entries = useCatalog((s) => s.entries);
  const types = useCatalog((s) => s.types);
  const selectedTypeId = useCatalog((s) => s.selectedTypeId);
  const selectedEntryId = useCatalog((s) => s.selectedEntryId);
  const selectEntry = useCatalog((s) => s.selectEntry);
  const filter = useCatalog((s) => s.filter);
  const setFilter = useCatalog((s) => s.setFilter);
  const reloadEntries = useCatalog((s) => s.reloadEntries);

  const skipInitial = useRef(true);
  useEffect(() => {
    if (skipInitial.current) {
      skipInitial.current = false;
      return;
    }
    const t = setTimeout(reloadEntries, 150);
    return () => clearTimeout(t);
  }, [reloadEntries]);

  const selectedType = selectedTypeId ? types.find((t) => t.id === selectedTypeId) : null;

  return (
    <div className="flex h-full w-72 flex-col border-r border-zinc-800">
      <header className="flex items-center gap-2 border-b border-zinc-800 px-3 py-2">
        <input
          className="flex-1 bg-zinc-900 px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-zinc-600"
          placeholder={selectedType ? `filter ${selectedType.name}…` : "filter all…"}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <button
          type="button"
          className="shrink-0 whitespace-nowrap bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-900 hover:bg-white disabled:opacity-50"
          disabled={!selectedType}
          title={!selectedType ? "Select a type first" : "Create a new entry"}
          onClick={() => selectEntry(NEW_ENTRY_SENTINEL)}
        >
          + new
        </button>
      </header>
      <ul className="flex-1 overflow-y-auto">
        {entries.map((e) => {
          const t = types.find((x) => x.id === e.typeId);
          return (
            <li key={e.id}>
              <button
                onClick={() => selectEntry(e.id)}
                className={`flex w-full flex-col gap-0.5 border-b border-zinc-900 px-3 py-2 text-left hover:bg-zinc-900 ${
                  selectedEntryId === e.id ? "bg-zinc-900 text-zinc-50" : "text-zinc-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm">{e.name}</span>
                  <span className="text-[10px] text-zinc-600">
                    {e.hasEmbedding ? "✓" : e.embeddingModel ? "↻" : "·"}
                  </span>
                </div>
                <span className="text-[11px] text-zinc-500">
                  {t?.name}
                  {e.tier ? ` · ${e.tier}` : ""}
                </span>
              </button>
            </li>
          );
        })}
        {entries.length === 0 && <li className="p-4 text-xs text-zinc-600">No entries yet.</li>}
      </ul>
    </div>
  );
};
