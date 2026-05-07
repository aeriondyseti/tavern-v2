import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useTales } from "./store.js";

export const QuickSwitcher = () => {
  const navigate = useNavigate();
  const tales = useTales((s) => s.tales);
  const loadList = useTales((s) => s.loadList);
  const selectTale = useTales((s) => s.selectTale);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
        if (!open) void loadList();
      } else if (e.key === "Escape" && open) {
        // Stop other window-level Escape handlers (e.g. BeatStream's stream
        // canceller) so closing the palette doesn't cancel the active stream.
        e.stopImmediatePropagation();
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, loadList]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setCursor(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tales;
    return tales.filter((t) => t.name.toLowerCase().includes(q));
  }, [query, tales]);

  if (!open) return null;

  const select = async (id: string) => {
    setOpen(false);
    await selectTale(id);
    navigate("/play");
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, Math.max(filtered.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === "Enter") {
      const target = filtered[cursor];
      if (target) void select(target.id);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-zinc-950/80 pt-32"
      onClick={() => setOpen(false)}
    >
      <div className="w-[32rem] border border-zinc-700 bg-zinc-900 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="w-full bg-zinc-900 px-3 py-2 text-sm outline-none placeholder:text-zinc-600"
          placeholder="Switch to tale…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setCursor(0);
          }}
          onKeyDown={onKeyDown}
        />
        <ul className="max-h-80 overflow-y-auto border-t border-zinc-800">
          {filtered.length === 0 && (
            <li className="px-3 py-2 text-xs text-zinc-600">{tales.length === 0 ? "No tales yet." : "No matches."}</li>
          )}
          {filtered.map((t, i) => (
            <li key={t.id}>
              <button
                onClick={() => void select(t.id)}
                onMouseEnter={() => setCursor(i)}
                className={`flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm ${
                  i === cursor ? "bg-zinc-800 text-zinc-50" : "text-zinc-300"
                }`}
              >
                <span>{t.name}</span>
                <span className="text-[11px] text-zinc-500">
                  {t.sceneCount} scene{t.sceneCount === 1 ? "" : "s"}
                  {t.description ? ` · ${t.description}` : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <footer className="border-t border-zinc-800 px-3 py-1 text-[10px] text-zinc-500">
          ↑↓ navigate · Enter open · Esc close · Cmd/Ctrl-K toggle
        </footer>
      </div>
    </div>
  );
};
