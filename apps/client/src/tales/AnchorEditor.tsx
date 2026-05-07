import { useEffect, useState } from "react";

import type { AnchorFacet } from "./types.js";

type Props = {
  prose: string;
  onProseChange: (next: string) => Promise<void>;
  facets: AnchorFacet[];
  onFacetsChange: (facets: { label: string; body?: string }[]) => Promise<void>;
};

export const AnchorEditor = ({ prose, onProseChange, facets, onFacetsChange }: Props) => {
  const [proseDraft, setProseDraft] = useState(prose);
  useEffect(() => setProseDraft(prose), [prose]);

  const [facetDraft, setFacetDraft] = useState(facets.map((f) => ({ label: f.label, body: f.body })));
  useEffect(() => setFacetDraft(facets.map((f) => ({ label: f.label, body: f.body }))), [facets]);

  const proseDirty = proseDraft !== prose;
  const facetsDirty =
    JSON.stringify(facetDraft) !== JSON.stringify(facets.map((f) => ({ label: f.label, body: f.body })));

  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1 block text-xs uppercase tracking-wide text-zinc-500">Prose</label>
        <textarea
          rows={3}
          className="w-full bg-zinc-900 px-2 py-1 text-sm"
          value={proseDraft}
          onChange={(e) => setProseDraft(e.target.value)}
        />
        <button
          className="mt-1 text-xs text-zinc-500 hover:text-zinc-200 disabled:opacity-50"
          disabled={!proseDirty}
          onClick={() => onProseChange(proseDraft)}
        >
          {proseDirty ? "save prose" : "saved"}
        </button>
      </div>
      <div>
        <label className="mb-1 block text-xs uppercase tracking-wide text-zinc-500">Facets</label>
        <ul className="space-y-1">
          {facetDraft.map((f, i) => (
            <li key={i} className="space-y-1 border border-zinc-800 p-2">
              <div className="flex items-center gap-2">
                <input
                  className="flex-1 bg-zinc-900 px-2 py-1 text-sm"
                  placeholder="label"
                  value={f.label}
                  onChange={(e) =>
                    setFacetDraft((d) => d.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))
                  }
                />
                <button
                  className="text-xs text-zinc-500 hover:text-rose-400"
                  onClick={() => setFacetDraft((d) => d.filter((_, j) => j !== i))}
                >
                  remove
                </button>
              </div>
              <textarea
                rows={2}
                className="w-full bg-zinc-900 px-2 py-1 text-sm"
                placeholder="body"
                value={f.body}
                onChange={(e) => setFacetDraft((d) => d.map((x, j) => (j === i ? { ...x, body: e.target.value } : x)))}
              />
            </li>
          ))}
        </ul>
        <div className="mt-1 flex gap-2">
          <button
            className="text-xs text-zinc-400 hover:text-zinc-200"
            onClick={() => setFacetDraft((d) => [...d, { label: "", body: "" }])}
          >
            + add facet
          </button>
          <button
            className="text-xs text-zinc-500 hover:text-zinc-200 disabled:opacity-50"
            disabled={!facetsDirty}
            onClick={() => onFacetsChange(facetDraft.filter((f) => f.label.trim()))}
          >
            {facetsDirty ? "save facets" : "saved"}
          </button>
        </div>
      </div>
    </div>
  );
};
