import { useEffect, useState } from "react";

import { NewButton } from "../ui.js";
import { useTales } from "./store.js";

export const TalesPicker = () => {
  const tales = useTales((s) => s.tales);
  const activeTaleId = useTales((s) => s.activeTaleId);
  const selectTale = useTales((s) => s.selectTale);
  const createTale = useTales((s) => s.createTale);
  const deleteTale = useTales((s) => s.deleteTale);
  const loadList = useTales((s) => s.loadList);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) return setCreating(false);
    const tale = await createTale({ name: trimmed });
    setName("");
    setCreating(false);
    void selectTale(tale.id);
  };

  return (
    <aside className="flex h-full w-60 flex-col border-r border-zinc-800">
      <header className="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
        <span className="font-serif text-sm text-zinc-300">Tales</span>
        <NewButton label="new tale" onClick={() => setCreating(true)} />
      </header>
      <ul className="flex-1 overflow-y-auto">
        {creating && (
          <li className="border-b border-zinc-900 p-2">
            <input
              autoFocus
              className="w-full border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm outline-none transition-colors duration-200 focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600"
              placeholder="tale name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={submit}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
                else if (e.key === "Escape") {
                  setName("");
                  setCreating(false);
                }
              }}
            />
          </li>
        )}
        {tales.map((t) => (
          <li
            key={t.id}
            className={`group flex items-center justify-between border-b border-zinc-900 transition-colors duration-200 hover:bg-zinc-900 ${
              activeTaleId === t.id ? "bg-zinc-900 text-zinc-50" : "text-zinc-300"
            }`}
          >
            <button
              type="button"
              onClick={() => selectTale(t.id)}
              className="flex flex-1 cursor-pointer flex-col px-3 py-2 text-left focus:outline-none focus:ring-1 focus:ring-inset focus:ring-zinc-600"
            >
              <span className="text-sm">{t.name}</span>
              <span className="text-[11px] text-zinc-500">
                {t.sceneCount} scene{t.sceneCount === 1 ? "" : "s"}
              </span>
            </button>
            <button
              type="button"
              aria-label={`delete tale ${t.name}`}
              className="invisible cursor-pointer pr-3 text-xs text-zinc-500 transition-colors duration-200 hover:text-rose-400 group-hover:visible focus:visible"
              onClick={() => {
                if (confirm(`Delete tale "${t.name}"? Scenes and beats will be lost.`)) deleteTale(t.id);
              }}
            >
              ×
            </button>
          </li>
        ))}
        {tales.length === 0 && !creating && (
          <li className="flex flex-col items-center gap-3 p-6 text-center">
            <p className="text-xs text-zinc-500">No tales yet.</p>
            <NewButton label="new tale" text="new tale" onClick={() => setCreating(true)} />
          </li>
        )}
      </ul>
    </aside>
  );
};
