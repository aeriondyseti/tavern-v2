import { useEffect, useState } from "react";

import { useTales } from "./store.js";

export const TalesPicker = () => {
  const { tales, activeTaleId, selectTale, createTale, deleteTale, loadList } = useTales();
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
        <button
          className="text-xs text-zinc-400 hover:text-zinc-100"
          onClick={() => setCreating(true)}
        >
          + new
        </button>
      </header>
      <ul className="flex-1 overflow-y-auto">
        {creating && (
          <li className="border-b border-zinc-900 p-2">
            <input
              autoFocus
              className="w-full bg-zinc-900 px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-zinc-600"
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
          <li key={t.id}>
            <button
              onClick={() => selectTale(t.id)}
              className={`group flex w-full items-center justify-between border-b border-zinc-900 px-3 py-2 text-left hover:bg-zinc-900 ${
                activeTaleId === t.id ? "bg-zinc-900 text-zinc-50" : "text-zinc-300"
              }`}
            >
              <span className="flex flex-col">
                <span className="text-sm">{t.name}</span>
                <span className="text-[11px] text-zinc-500">
                  {t.sceneCount} scene{t.sceneCount === 1 ? "" : "s"}
                </span>
              </span>
              <button
                className="invisible text-xs text-zinc-500 hover:text-rose-400 group-hover:visible"
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`Delete tale "${t.name}"? Scenes and beats will be lost.`))
                    deleteTale(t.id);
                }}
              >
                ×
              </button>
            </button>
          </li>
        ))}
        {tales.length === 0 && !creating && (
          <li className="p-4 text-xs text-zinc-600">No tales yet — start with + new.</li>
        )}
      </ul>
    </aside>
  );
};
