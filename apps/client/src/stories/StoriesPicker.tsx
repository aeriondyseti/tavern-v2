import { useEffect, useState } from "react";

import { NewButton } from "../ui.js";
import { useStories } from "./store.js";

export const StoriesPicker = () => {
  const stories = useStories((s) => s.stories);
  const activeStoryId = useStories((s) => s.activeStoryId);
  const selectStory = useStories((s) => s.selectStory);
  const createStory = useStories((s) => s.createStory);
  const deleteStory = useStories((s) => s.deleteStory);
  const loadList = useStories((s) => s.loadList);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) return setCreating(false);
    const story = await createStory({ name: trimmed });
    setName("");
    setCreating(false);
    void selectStory(story.id);
  };

  return (
    <aside className="flex h-full w-60 flex-col border-r border-zinc-800">
      <header className="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
        <span className="font-serif text-sm text-zinc-300">Stories</span>
        <NewButton label="new story" onClick={() => setCreating(true)} />
      </header>
      <ul className="flex-1 overflow-y-auto">
        {creating && (
          <li className="border-b border-zinc-900 p-2">
            <input
              autoFocus
              className="w-full border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm outline-none transition-colors duration-200 focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600"
              placeholder="story name"
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
        {stories.map((t) => (
          <li
            key={t.id}
            className={`group flex items-center justify-between border-b border-zinc-900 transition-colors duration-200 hover:bg-zinc-900 ${
              activeStoryId === t.id ? "bg-zinc-900 text-zinc-50" : "text-zinc-300"
            }`}
          >
            <button
              type="button"
              onClick={() => selectStory(t.id)}
              className="flex flex-1 cursor-pointer flex-col px-3 py-2 text-left focus:outline-none focus:ring-1 focus:ring-inset focus:ring-zinc-600"
            >
              <span className="text-sm">{t.name}</span>
              <span className="text-[11px] text-zinc-500">
                {t.sceneCount} scene{t.sceneCount === 1 ? "" : "s"}
              </span>
            </button>
            <button
              type="button"
              aria-label={`delete story ${t.name}`}
              className="invisible cursor-pointer pr-3 text-xs text-zinc-500 transition-colors duration-200 hover:text-rose-400 group-hover:visible focus:visible"
              onClick={() => {
                if (confirm(`Delete story "${t.name}"? Scenes and beats will be lost.`)) deleteStory(t.id);
              }}
            >
              ×
            </button>
          </li>
        ))}
        {stories.length === 0 && !creating && (
          <li className="flex flex-col items-center gap-3 p-6 text-center">
            <p className="text-xs text-zinc-500">No stories yet.</p>
            <NewButton label="new story" text="new story" onClick={() => setCreating(true)} />
          </li>
        )}
      </ul>
    </aside>
  );
};
