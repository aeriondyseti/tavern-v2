import { useEffect, useRef, useState } from "react";
import type {
  ModelId,
  OauthStatus,
  Settings as SettingsData,
  SettingsPatch,
} from "@tavern/shared";

import { useCatalog } from "../catalog/store.js";
import {
  downloadBackup,
  settingsApi,
  uploadRestore,
  type StorageInfo,
} from "../settings/api.js";

const MODEL_OPTIONS: ModelId[] = [
  "claude-opus-4-7",
  "claude-sonnet-4-6",
  "claude-haiku-4-5-20251001",
];

export const Settings = () => {
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [storage, setStorage] = useState<StorageInfo | null>(null);
  const [draft, setDraft] = useState<SettingsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { load: loadCatalog } = useCatalog();

  useEffect(() => {
    void Promise.all([settingsApi.get(), settingsApi.storageInfo()])
      .then(([s, st]) => {
        setSettings(s);
        setDraft(s);
        setStorage(st);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  if (error) return <div className="p-4 text-sm text-rose-400">Error: {error}</div>;
  if (!settings || !draft || !storage) {
    return <div className="p-4 text-sm text-zinc-500">Loading settings…</div>;
  }

  const dirty = JSON.stringify(draft) !== JSON.stringify(settings);

  const save = async () => {
    setSaving(true);
    try {
      const patch: SettingsPatch = {};
      (Object.keys(draft) as (keyof SettingsData)[]).forEach((k) => {
        if (JSON.stringify(draft[k]) !== JSON.stringify(settings[k])) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (patch as any)[k] = draft[k];
        }
      });
      const next = await settingsApi.patch(patch);
      setSettings(next);
      setDraft(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const update = <K extends keyof SettingsData>(key: K, val: SettingsData[K]) =>
    setDraft({ ...draft, [key]: val });

  const onRestore = async (mode: "merge" | "replace") => {
    const file = fileRef.current?.files?.[0];
    if (!file) return setRestoreMessage("Pick a file first.");
    if (
      mode === "replace" &&
      !confirm("Replace mode wipes all Catalog rows before importing. Continue?")
    ) {
      return;
    }
    try {
      const result = await uploadRestore(file, mode);
      setRestoreMessage(
        `Restored: types ${result.types.inserted} new / ${result.types.updated} matched, entries ${result.entries.inserted} new / ${result.entries.updated} matched.`,
      );
      void loadCatalog();
    } catch (e) {
      setRestoreMessage(`Restore failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8 overflow-y-auto p-6 text-sm">
      <ProviderSection oauth={storage.oauth} />

      <Section title="Defaults">
        <Field label="default model">
          <select
            className="bg-zinc-900 px-2 py-1"
            value={draft.defaultModel}
            onChange={(e) => update("defaultModel", e.target.value as ModelId)}
          >
            {MODEL_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </Field>
        <Field label="temperature">
          <input
            type="number"
            min={0}
            max={2}
            step={0.1}
            className="bg-zinc-900 px-2 py-1"
            value={draft.defaultTemperature}
            onChange={(e) => update("defaultTemperature", Number(e.target.value))}
          />
        </Field>
        <Field label="max tokens">
          <input
            type="number"
            min={256}
            step={256}
            className="bg-zinc-900 px-2 py-1"
            value={draft.defaultMaxTokens}
            onChange={(e) => update("defaultMaxTokens", Number(e.target.value))}
          />
        </Field>
        <Field label="thinking budget">
          <input
            type="number"
            min={0}
            step={1024}
            className="bg-zinc-900 px-2 py-1"
            value={draft.defaultThinkingBudget ?? 0}
            onChange={(e) => {
              const v = Number(e.target.value);
              update("defaultThinkingBudget", v > 0 ? v : null);
            }}
          />
        </Field>
        <p className="text-xs text-zinc-500">
          New Tales pick these up. Existing Tales keep their per-Tale Setup.
        </p>
      </Section>

      <Section title="Embeddings">
        <Field label="provider">
          <select
            className="bg-zinc-900 px-2 py-1"
            value={draft.embeddingProvider}
            onChange={(e) =>
              update("embeddingProvider", e.target.value as SettingsData["embeddingProvider"])
            }
          >
            <option value="local">local (transformers.js)</option>
            <option value="api">api (OpenAI-compatible)</option>
          </select>
        </Field>
        {draft.embeddingProvider === "local" ? (
          <Field label="local model">
            <input
              className="w-72 bg-zinc-900 px-2 py-1"
              value={draft.embeddingModelLocal}
              onChange={(e) => update("embeddingModelLocal", e.target.value)}
            />
          </Field>
        ) : (
          <>
            <Field label="api url">
              <input
                className="w-96 bg-zinc-900 px-2 py-1"
                placeholder="https://api.openai.com/v1/embeddings"
                value={draft.embeddingApiUrl ?? ""}
                onChange={(e) => update("embeddingApiUrl", e.target.value || null)}
              />
            </Field>
            <Field label="api model">
              <input
                className="w-72 bg-zinc-900 px-2 py-1"
                placeholder="text-embedding-3-small"
                value={draft.embeddingApiModel ?? ""}
                onChange={(e) => update("embeddingApiModel", e.target.value || null)}
              />
            </Field>
            <Field label="api key">
              <input
                type="password"
                className="w-72 bg-zinc-900 px-2 py-1"
                placeholder="sk-…"
                value={draft.embeddingApiKey ?? ""}
                onChange={(e) => update("embeddingApiKey", e.target.value || null)}
              />
            </Field>
            <p className="text-xs text-zinc-500">
              Stored in the local SQLite file. Encryption at rest is a deferred item (spec §10).
            </p>
          </>
        )}
        <p className="text-xs text-zinc-500">
          Switching models invalidates existing embedding vectors. Run "reindex all" from the
          Catalog after saving.
        </p>
      </Section>

      <Section title="Storage">
        <Field label="db path">
          <code className="text-zinc-400">{storage.dbPath}</code>
        </Field>
        <div className="flex flex-wrap items-center gap-3">
          <button
            className="bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-900 hover:bg-white"
            onClick={downloadBackup}
          >
            download Catalog backup
          </button>
        </div>
        <div className="space-y-2">
          <input ref={fileRef} type="file" accept="application/json" className="text-xs" />
          <div className="flex gap-2">
            <button
              className="bg-zinc-800 px-3 py-1 text-xs hover:bg-zinc-700"
              onClick={() => onRestore("merge")}
            >
              restore (merge)
            </button>
            <button
              className="bg-zinc-800 px-3 py-1 text-xs hover:bg-zinc-700"
              onClick={() => onRestore("replace")}
            >
              restore (replace)
            </button>
          </div>
          {restoreMessage && (
            <p className="text-xs text-zinc-400">{restoreMessage}</p>
          )}
          <p className="text-xs text-zinc-500">
            Catalog only — Tales, Scenes, and Beats stay on this server.
          </p>
        </div>
      </Section>

      <footer className="sticky bottom-0 flex items-center gap-3 border-t border-zinc-800 bg-zinc-950 py-3">
        <button
          className="bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-900 hover:bg-white disabled:opacity-50"
          onClick={save}
          disabled={!dirty || saving}
        >
          {saving ? "saving…" : "save"}
        </button>
        <button
          className="text-xs text-zinc-500 hover:text-zinc-200 disabled:opacity-50"
          onClick={() => setDraft(settings)}
          disabled={!dirty}
        >
          revert
        </button>
        {!dirty && <span className="text-xs text-zinc-600">no changes</span>}
      </footer>
    </div>
  );
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="space-y-2">
    <h2 className="font-serif text-base text-zinc-200">{title}</h2>
    <div className="space-y-2 border border-zinc-800 p-4">{children}</div>
  </section>
);

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="flex items-center gap-3">
    <span className="w-32 text-xs uppercase tracking-wide text-zinc-500">{label}</span>
    <span className="flex-1">{children}</span>
  </label>
);

const ProviderSection = ({ oauth }: { oauth: OauthStatus }) => (
  <Section title="Provider">
    <Field label="claude oauth">
      <span
        className={
          oauth.state === "present" ? "text-emerald-400" : "text-rose-400"
        }
      >
        {oauth.state === "present" ? "logged in" : "not logged in"}
      </span>
    </Field>
    <Field label="credentials">
      <code className="text-zinc-400">{oauth.credentialsPath}</code>
    </Field>
    {oauth.state === "missing" && (
      <p className="text-xs text-zinc-500">
        Run <code className="text-zinc-300">claude login</code> in a terminal, then refresh this
        page.
      </p>
    )}
  </Section>
);
