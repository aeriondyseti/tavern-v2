import { MODEL_OPTIONS, type ModelId, type SetupData } from "@tales/shared";
import { useEffect, useMemo, useState } from "react";

import { useCatalog } from "../catalog/store.js";
import type { DirectionTier } from "../catalog/types.js";
import { DIRECTION_TIERS, KIND_DIRECTION } from "../catalog/types.js";

const TIER_LABEL: Record<DirectionTier, string> = {
  absolute: "Absolute",
  strong: "Strong",
  normal: "Style",
  background: "Background",
};

type Props = {
  value: SetupData;
  onChange: (next: SetupData) => void;
  scope: "story" | "scene";
};

export const SetupEditor = ({ value, onChange, scope }: Props) => {
  const { entries, types } = useCatalog();
  const [draft, setDraft] = useState<SetupData>(value);
  useEffect(() => setDraft(value), [value]);

  const directionTypeIds = useMemo(
    () => new Set(types.filter((t) => t.kindId === KIND_DIRECTION).map((t) => t.id)),
    [types],
  );
  const directionEntries = useMemo(
    () => entries.filter((e) => directionTypeIds.has(e.typeId)),
    [entries, directionTypeIds],
  );

  const allActiveIds = useMemo(
    () => new Set(DIRECTION_TIERS.flatMap((t) => draft.directions[t]).filter((id): id is string => Boolean(id))),
    [draft.directions],
  );

  const inactiveDirections = useMemo(
    () => directionEntries.filter((e) => !allActiveIds.has(e.id)).sort((a, b) => a.name.localeCompare(b.name)),
    [directionEntries, allActiveIds],
  );

  const dirty = JSON.stringify(draft) !== JSON.stringify(value);

  const moveToTier = (entryId: string, tier: DirectionTier | null) => {
    const stripped: SetupData["directions"] = {
      absolute: draft.directions.absolute.filter((id) => id !== entryId),
      strong: draft.directions.strong.filter((id) => id !== entryId),
      normal: draft.directions.normal.filter((id) => id !== entryId),
      background: draft.directions.background.filter((id) => id !== entryId),
    };
    const next = tier ? { ...stripped, [tier]: [...stripped[tier], entryId] } : stripped;
    setDraft({ ...draft, directions: next });
  };

  const reorderInTier = (tier: DirectionTier, fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx) return;
    const list = [...draft.directions[tier]];
    const [moved] = list.splice(fromIdx, 1);
    if (!moved) return;
    list.splice(toIdx, 0, moved);
    setDraft({ ...draft, directions: { ...draft.directions, [tier]: list } });
  };

  const updateModel = <K extends keyof SetupData["model"]>(key: K, val: SetupData["model"][K]) =>
    setDraft({ ...draft, model: { ...draft.model, [key]: val } });

  const updateRetrieval = <K extends keyof SetupData["retrieval"]>(key: K, val: SetupData["retrieval"][K]) =>
    setDraft({ ...draft, retrieval: { ...draft.retrieval, [key]: val } });

  const updateTool = (key: keyof SetupData["tools"], val: boolean) =>
    setDraft({ ...draft, tools: { ...draft.tools, [key]: val } });

  return (
    <section className="space-y-6">
      <header className="flex items-center justify-between">
        <h3 className="font-serif text-sm uppercase tracking-wide text-zinc-300">
          {scope === "story" ? "Story setup" : "Scene adjustments"}
        </h3>
        <div className="flex gap-2">
          <button
            className="text-xs text-zinc-500 hover:text-zinc-200 disabled:opacity-50"
            disabled={!dirty}
            onClick={() => setDraft(value)}
          >
            revert
          </button>
          <button
            className="bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-900 hover:bg-white disabled:opacity-50"
            disabled={!dirty}
            onClick={() => onChange(draft)}
          >
            save
          </button>
        </div>
      </header>

      <div>
        <h4 className="mb-2 text-xs uppercase tracking-wide text-zinc-500">Active Directions</h4>
        {DIRECTION_TIERS.map((tier) => (
          <div key={tier} className="mb-3">
            <div className="mb-1 text-[11px] uppercase tracking-wide text-zinc-500">{TIER_LABEL[tier]}</div>
            <ul className="space-y-1">
              {draft.directions[tier].length === 0 && <li className="text-[11px] italic text-zinc-700">empty</li>}
              {draft.directions[tier].map((id, i) => {
                const e = entries.find((x) => x.id === id);
                if (!e) return null;
                return (
                  <li key={id} className="flex items-center gap-1 border border-zinc-800 px-2 py-1 text-sm">
                    <span className="flex-1 text-zinc-200">{e.name}</span>
                    <button
                      className="text-xs text-zinc-500 hover:text-zinc-200 disabled:opacity-30"
                      disabled={i === 0}
                      onClick={() => reorderInTier(tier, i, i - 1)}
                    >
                      ↑
                    </button>
                    <button
                      className="text-xs text-zinc-500 hover:text-zinc-200 disabled:opacity-30"
                      disabled={i === draft.directions[tier].length - 1}
                      onClick={() => reorderInTier(tier, i, i + 1)}
                    >
                      ↓
                    </button>
                    <select
                      className="bg-zinc-900 text-[11px]"
                      value={tier}
                      onChange={(ev) => moveToTier(id, ev.target.value as DirectionTier)}
                    >
                      {DIRECTION_TIERS.map((t) => (
                        <option key={t} value={t}>
                          {TIER_LABEL[t]}
                        </option>
                      ))}
                    </select>
                    <button className="text-xs text-zinc-500 hover:text-rose-400" onClick={() => moveToTier(id, null)}>
                      ×
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        {inactiveDirections.length > 0 && (
          <div>
            <div className="mb-1 text-[11px] uppercase tracking-wide text-zinc-500">
              Inactive (click to activate as Style)
            </div>
            <ul className="flex flex-wrap gap-1">
              {inactiveDirections.map((e) => (
                <li key={e.id}>
                  <button
                    className="bg-zinc-900 px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                    onClick={() => moveToTier(e.id, "normal")}
                  >
                    {e.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <h4 className="col-span-2 text-xs uppercase tracking-wide text-zinc-500">Model</h4>
        <label className="flex flex-col gap-1 text-xs text-zinc-400">
          model
          <select
            className="bg-zinc-900 px-2 py-1 text-sm"
            value={draft.model.id}
            onChange={(e) => updateModel("id", e.target.value as ModelId)}
          >
            {MODEL_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-400">
          temperature
          <input
            type="number"
            className="bg-zinc-900 px-2 py-1 text-sm"
            min={0}
            max={2}
            step={0.1}
            value={draft.model.temperature}
            onChange={(e) => updateModel("temperature", Number(e.target.value))}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-400">
          max tokens
          <input
            type="number"
            className="bg-zinc-900 px-2 py-1 text-sm"
            min={256}
            step={256}
            value={draft.model.max_tokens}
            onChange={(e) => updateModel("max_tokens", Number(e.target.value))}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-400">
          thinking budget
          <input
            type="number"
            className="bg-zinc-900 px-2 py-1 text-sm"
            min={0}
            step={1024}
            value={draft.model.thinking_budget ?? 0}
            onChange={(e) => {
              const v = Number(e.target.value);
              const next = { ...draft.model };
              if (v > 0) next.thinking_budget = v;
              else delete next.thinking_budget;
              setDraft({ ...draft, model: next });
            }}
          />
        </label>
        <label className="col-span-2 flex flex-col gap-1 text-xs text-zinc-400">
          system prompt append
          <textarea
            rows={2}
            className="bg-zinc-900 px-2 py-1 text-sm"
            value={draft.model.system_prompt_append ?? ""}
            onChange={(e) => {
              const next = { ...draft.model };
              if (e.target.value) next.system_prompt_append = e.target.value;
              else delete next.system_prompt_append;
              setDraft({ ...draft, model: next });
            }}
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <h4 className="col-span-2 text-xs uppercase tracking-wide text-zinc-500">Retrieval</h4>
        <label className="flex flex-col gap-1 text-xs text-zinc-400">
          max results
          <input
            type="number"
            className="bg-zinc-900 px-2 py-1 text-sm"
            min={1}
            value={draft.retrieval.max_results}
            onChange={(e) => updateRetrieval("max_results", Number(e.target.value))}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-400">
          threshold
          <input
            type="number"
            className="bg-zinc-900 px-2 py-1 text-sm"
            min={0}
            max={1}
            step={0.05}
            value={draft.retrieval.threshold}
            onChange={(e) => updateRetrieval("threshold", Number(e.target.value))}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-400">
          keyword weight
          <input
            type="number"
            className="bg-zinc-900 px-2 py-1 text-sm"
            min={0}
            max={1}
            step={0.05}
            value={draft.retrieval.keyword_weight}
            onChange={(e) => updateRetrieval("keyword_weight", Number(e.target.value))}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-400">
          embedding weight
          <input
            type="number"
            className="bg-zinc-900 px-2 py-1 text-sm"
            min={0}
            max={1}
            step={0.05}
            value={draft.retrieval.embedding_weight}
            onChange={(e) => updateRetrieval("embedding_weight", Number(e.target.value))}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-400">
          brings depth
          <input
            type="number"
            className="bg-zinc-900 px-2 py-1 text-sm"
            min={0}
            value={draft.retrieval.brings_depth}
            onChange={(e) => updateRetrieval("brings_depth", Number(e.target.value))}
          />
        </label>
      </div>

      <div>
        <h4 className="mb-2 text-xs uppercase tracking-wide text-zinc-500">Tools</h4>
        <ul className="space-y-1">
          {(Object.keys(draft.tools) as (keyof SetupData["tools"])[]).map((k) => (
            <li key={k} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={draft.tools[k]} onChange={(e) => updateTool(k, e.target.checked)} />
              <span className="text-zinc-300">{k}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};
