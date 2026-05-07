import { useState } from "react";

import { useTales } from "./store.js";

export const ScenesPanel = () => {
  const { activeTale, activeScene, selectScene, createScene, deleteScene, updateScene, updateTale } = useTales();

  const [creating, setCreating] = useState(false);
  const [draftName, setDraftName] = useState("");

  if (!activeTale) return null;

  const submit = async () => {
    const trimmed = draftName.trim();
    if (!trimmed) return setCreating(false);
    const scene = await createScene(activeTale.id, { name: trimmed });
    setDraftName("");
    setCreating(false);
    await updateTale(activeTale.id, { activeSceneId: scene.id });
  };

  return (
    <div className="space-y-2">
      <header className="flex items-center justify-between">
        <h4 className="text-xs uppercase tracking-wide text-zinc-500">Scenes</h4>
        <button className="text-xs text-zinc-400 hover:text-zinc-100" onClick={() => setCreating(true)}>
          + new scene
        </button>
      </header>
      <ul className="space-y-1">
        {creating && (
          <li>
            <input
              className="w-full bg-zinc-900 px-2 py-1 text-sm"
              placeholder="scene name"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onBlur={submit}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
                else if (e.key === "Escape") {
                  setDraftName("");
                  setCreating(false);
                }
              }}
            />
          </li>
        )}
        {activeTale.scenes.map((s) => {
          const isActive = activeTale.activeSceneId === s.id;
          const isOpen = activeScene?.id === s.id;
          return (
            <li
              key={s.id}
              className={`group flex items-center gap-2 border px-2 py-1 text-sm ${
                isOpen ? "border-zinc-500 bg-zinc-900" : "border-zinc-800"
              }`}
            >
              <button
                className={`flex-1 text-left ${isActive ? "text-zinc-100" : "text-zinc-300"}`}
                onClick={() => selectScene(s.id)}
              >
                {s.name}
                {isActive && <span className="ml-2 text-[10px] text-emerald-400">active</span>}
                {s.hasAdjustments && <span className="ml-2 text-[10px] text-amber-400">adj.</span>}
              </button>
              {!isActive && (
                <button
                  className="text-[10px] text-zinc-500 hover:text-zinc-100"
                  onClick={() => updateTale(activeTale.id, { activeSceneId: s.id })}
                >
                  set active
                </button>
              )}
              <button
                className="invisible text-xs text-zinc-500 hover:text-zinc-200 group-hover:visible"
                onClick={() => {
                  const nm = prompt("Rename scene", s.name);
                  if (nm && nm !== s.name) updateScene(s.id, { name: nm });
                }}
              >
                ✎
              </button>
              <button
                className="invisible text-xs text-zinc-500 hover:text-rose-400 group-hover:visible"
                onClick={() => {
                  if (confirm(`Delete scene "${s.name}"?`)) deleteScene(s.id);
                }}
              >
                ×
              </button>
            </li>
          );
        })}
        {activeTale.scenes.length === 0 && !creating && (
          <li className="text-[11px] italic text-zinc-700">No scenes yet.</li>
        )}
      </ul>
    </div>
  );
};
