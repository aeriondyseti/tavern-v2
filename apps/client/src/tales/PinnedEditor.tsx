import { useMemo, useState } from "react";

import { useCatalog } from "../catalog/store.js";
import type { PinnedEntry } from "./types.js";

type Props = {
  pinned: PinnedEntry[];
  onChange: (entryIds: string[]) => Promise<void>;
};

export const PinnedEditor = ({ pinned, onChange }: Props) => {
  const { entries, types } = useCatalog();
  const [saving, setSaving] = useState(false);

  const ids = useMemo(() => pinned.map((p) => p.entryId), [pinned]);
  const idSet = useMemo(() => new Set(ids), [ids]);
  const candidates = useMemo(
    () =>
      entries
        .filter((e) => !idSet.has(e.id))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [entries, idSet],
  );

  const apply = async (next: string[]) => {
    setSaving(true);
    try {
      await onChange(next);
    } finally {
      setSaving(false);
    }
  };

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    const next = [...ids];
    [next[i], next[j]] = [next[j]!, next[i]!];
    void apply(next);
  };

  return (
    <div className="space-y-2">
      <ul className="space-y-1">
        {pinned.length === 0 && (
          <li className="text-[11px] italic text-zinc-700">no pins</li>
        )}
        {pinned.map((p, i) => {
          const t = types.find((x) => x.id === p.typeId);
          return (
            <li
              key={p.id}
              className="flex items-center gap-1 border border-zinc-800 px-2 py-1 text-sm"
            >
              <span className="flex flex-1 flex-col">
                <span className="text-zinc-200">{p.entryName}</span>
                <span className="text-[10px] text-zinc-500">{t?.name ?? "—"}</span>
              </span>
              <button
                className="text-xs text-zinc-500 hover:text-zinc-200 disabled:opacity-30"
                disabled={i === 0 || saving}
                onClick={() => move(i, -1)}
              >
                ↑
              </button>
              <button
                className="text-xs text-zinc-500 hover:text-zinc-200 disabled:opacity-30"
                disabled={i === pinned.length - 1 || saving}
                onClick={() => move(i, 1)}
              >
                ↓
              </button>
              <button
                className="text-xs text-zinc-500 hover:text-rose-400"
                disabled={saving}
                onClick={() => apply(ids.filter((x) => x !== p.entryId))}
              >
                ×
              </button>
            </li>
          );
        })}
      </ul>
      <select
        className="bg-zinc-900 px-2 py-1 text-sm disabled:opacity-50"
        disabled={saving || candidates.length === 0}
        value=""
        onChange={(e) => {
          const id = e.target.value;
          if (id) void apply([...ids, id]);
        }}
      >
        <option value="">+ pin entry…</option>
        {candidates.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name}
          </option>
        ))}
      </select>
    </div>
  );
};
