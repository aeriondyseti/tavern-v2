import { useState } from "react";

import { useCatalog } from "./store.js";
import type { KindId } from "./types.js";

export const TypeTree = () => {
  const { kinds, types, selectedTypeId, selectType, createType, deleteType, renameType } = useCatalog();
  const [adding, setAdding] = useState<KindId | null>(null);
  const [draftName, setDraftName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");

  const submitNew = async (kindId: KindId) => {
    const name = draftName.trim();
    if (!name) return setAdding(null);
    try {
      const t = await createType(kindId, name);
      await selectType(t.id);
    } finally {
      setAdding(null);
      setDraftName("");
    }
  };

  const submitRename = async (id: string) => {
    const name = renameDraft.trim();
    if (name) await renameType(id, name);
    setRenamingId(null);
    setRenameDraft("");
  };

  return (
    <aside className="flex h-full w-64 flex-col border-r border-zinc-800 text-sm">
      {kinds.map((k) => {
        const kindTypes = types.filter((t) => t.kindId === k.id);
        return (
          <div key={k.id} className="border-b border-zinc-800">
            <header className="flex items-center justify-between px-3 py-2">
              <span className="font-serif text-zinc-300">{k.label}</span>
              <button className="text-xs text-zinc-500 hover:text-zinc-200" onClick={() => setAdding(k.id as KindId)}>
                + new
              </button>
            </header>
            <ul>
              <li>
                <button
                  className={`flex w-full items-center gap-2 px-3 py-1 text-left text-zinc-500 hover:bg-zinc-900 ${
                    selectedTypeId === null ? "bg-zinc-900 text-zinc-200" : ""
                  }`}
                  onClick={() => selectType(null)}
                >
                  <span className="opacity-50">all {k.label.toLowerCase()}</span>
                </button>
              </li>
              {kindTypes.map((t) => (
                <li key={t.id}>
                  {renamingId === t.id ? (
                    <input
                      className="m-1 w-[calc(100%-0.5rem)] bg-zinc-900 px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-zinc-600"
                      value={renameDraft}
                      onChange={(e) => setRenameDraft(e.target.value)}
                      onBlur={() => submitRename(t.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.currentTarget.blur();
                        } else if (e.key === "Escape") {
                          setRenamingId(null);
                          setRenameDraft("");
                        }
                      }}
                    />
                  ) : (
                    <button
                      className={`group flex w-full items-center justify-between px-3 py-1 text-left hover:bg-zinc-900 ${
                        selectedTypeId === t.id ? "bg-zinc-900 text-zinc-50" : "text-zinc-300"
                      }`}
                      onClick={() => selectType(t.id)}
                      onDoubleClick={() => {
                        setRenamingId(t.id);
                        setRenameDraft(t.name);
                      }}
                    >
                      <span>{t.name}</span>
                      <button
                        className="invisible text-xs text-zinc-500 hover:text-rose-400 group-hover:visible"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Delete type "${t.name}" and all its entries?`)) deleteType(t.id);
                        }}
                      >
                        ×
                      </button>
                    </button>
                  )}
                </li>
              ))}
              {adding === k.id && (
                <li>
                  <input
                    placeholder="type name"
                    className="m-1 w-[calc(100%-0.5rem)] bg-zinc-900 px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-zinc-600"
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    onBlur={() => submitNew(k.id as KindId)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.currentTarget.blur();
                      } else if (e.key === "Escape") {
                        setAdding(null);
                        setDraftName("");
                      }
                    }}
                  />
                </li>
              )}
            </ul>
          </div>
        );
      })}
    </aside>
  );
};
