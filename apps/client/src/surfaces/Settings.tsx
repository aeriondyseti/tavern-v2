import {
  MODEL_OPTIONS,
  type ModelId,
  type OauthStatus,
  type Settings as SettingsData,
  type SettingsPatch,
} from "@tavern/shared";
import { useEffect, useRef, useState } from "react";

import { useCatalog } from "../catalog/store.js";
import { downloadBackup, type StorageInfo, settingsApi, uploadRestore } from "../settings/api.js";

export const Settings = () => {
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [storage, setStorage] = useState<StorageInfo | null>(null);
  const [draft, setDraft] = useState<SettingsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const loadCatalog = useCatalog((s) => s.load);

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
          (patch as Record<string, unknown>)[k] = draft[k];
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

  const update = <K extends keyof SettingsData>(key: K, val: SettingsData[K]) => setDraft({ ...draft, [key]: val });

  const onRestore = async (mode: "merge" | "replace") => {
    const file = fileRef.current?.files?.[0];
    if (!file) return setRestoreMessage("Pick a file first.");
    if (
      mode === "replace" &&
      !confirm(
        "Replace mode wipes types, entries, facets, cues, connections, and direction tiers (kinds are preserved) before importing. Continue?",
      )
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
    <div className="mx-auto h-full max-w-3xl space-y-8 overflow-y-auto p-6 text-sm">
      <ProviderSection oauth={storage.oauth} />

      <Section title="Defaults">
        <Field label="default model">
          <select
            className={inputClass}
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
            className={inputClass}
            value={draft.defaultTemperature}
            onChange={(e) => update("defaultTemperature", Number(e.target.value))}
          />
        </Field>
        <Field label="max tokens">
          <input
            type="number"
            min={256}
            step={256}
            className={inputClass}
            value={draft.defaultMaxTokens}
            onChange={(e) => update("defaultMaxTokens", Number(e.target.value))}
          />
        </Field>
        <Field label="thinking budget">
          <input
            type="number"
            min={0}
            step={1024}
            className={inputClass}
            value={draft.defaultThinkingBudget ?? 0}
            onChange={(e) => {
              const v = Number(e.target.value);
              update("defaultThinkingBudget", v > 0 ? v : null);
            }}
          />
        </Field>
        <p className="text-xs text-zinc-500">New Tales pick these up. Existing Tales keep their per-Tale Setup.</p>
      </Section>

      <Section title="Embeddings">
        <Field label="provider">
          <select
            className={inputClass}
            value={draft.embeddingProvider}
            onChange={(e) => update("embeddingProvider", e.target.value as SettingsData["embeddingProvider"])}
          >
            <option value="local">local (transformers.js)</option>
            <option value="api">api (OpenAI-compatible)</option>
          </select>
        </Field>
        {draft.embeddingProvider === "local" ? (
          <Field label="local model">
            <input
              className={inputClass}
              value={draft.embeddingModelLocal}
              onChange={(e) => update("embeddingModelLocal", e.target.value)}
            />
          </Field>
        ) : (
          <>
            <Field label="api url">
              <input
                className={inputClassWide}
                placeholder="https://api.openai.com/v1/embeddings"
                value={draft.embeddingApiUrl ?? ""}
                onChange={(e) => update("embeddingApiUrl", e.target.value || null)}
              />
            </Field>
            <Field label="api model">
              <input
                className={inputClass}
                placeholder="text-embedding-3-small"
                value={draft.embeddingApiModel ?? ""}
                onChange={(e) => update("embeddingApiModel", e.target.value || null)}
              />
            </Field>
            <Field label="api key">
              <input
                type="password"
                className={inputClass}
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
          Switching models invalidates existing embedding vectors. Run "reindex all" from the Catalog after saving.
        </p>
      </Section>

      <Section title="Storage">
        <Field label="db path">
          <code className="text-zinc-400">{storage.dbPath}</code>
        </Field>
        <Field label="backup">
          <button type="button" className={primaryButtonClass} onClick={downloadBackup}>
            download Catalog backup
          </button>
        </Field>
        <Field label="restore">
          <FileChooser fileRef={fileRef} fileName={fileName} onFileChange={(name) => setFileName(name)} />
        </Field>
        <div className="flex flex-wrap items-center gap-2 pl-[8.75rem]">
          <button type="button" className={secondaryButtonClass} onClick={() => onRestore("merge")}>
            restore (merge)
          </button>
          <button type="button" className={secondaryButtonClass} onClick={() => onRestore("replace")}>
            restore (replace)
          </button>
        </div>
        {restoreMessage && <p className="pl-[8.75rem] text-xs text-zinc-400">{restoreMessage}</p>}
        <p className="pl-[8.75rem] text-xs text-zinc-500">
          Catalog only — Tales, Scenes, and Beats stay on this server.
        </p>
      </Section>

      <footer className="sticky bottom-0 -mx-6 flex items-center gap-3 border-t border-zinc-800 bg-zinc-950/95 px-6 py-3 backdrop-blur">
        <button type="button" className={primaryButtonClass} onClick={save} disabled={!dirty || saving}>
          {saving ? "saving…" : "save"}
        </button>
        <button
          type="button"
          className="cursor-pointer text-xs text-zinc-500 transition-colors duration-200 hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
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

const inputBase =
  "border border-zinc-800 bg-zinc-900 px-2 py-1 text-zinc-100 outline-none transition-colors duration-200 focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600";
const inputClass = `w-64 ${inputBase}`;
const inputClassWide = `w-96 ${inputBase}`;
const primaryButtonClass =
  "cursor-pointer whitespace-nowrap bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-900 transition-colors duration-200 hover:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:ring-offset-2 focus:ring-offset-zinc-950 disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButtonClass =
  "cursor-pointer whitespace-nowrap border border-zinc-700 bg-zinc-800 px-3 py-1 text-xs text-zinc-200 transition-colors duration-200 hover:border-zinc-600 hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 focus:ring-offset-zinc-950";

type FileChooserProps = {
  fileRef: React.RefObject<HTMLInputElement>;
  fileName: string | null;
  onFileChange: (name: string | null) => void;
};

const FileChooser = ({ fileRef, fileName, onFileChange }: FileChooserProps) => (
  <div className="flex items-center gap-2">
    <button type="button" className={secondaryButtonClass} onClick={() => fileRef.current?.click()}>
      choose file…
    </button>
    <span className="text-xs text-zinc-500">{fileName ?? "no file selected"}</span>
    <input
      ref={fileRef}
      type="file"
      accept="application/json"
      className="hidden"
      onChange={(e) => onFileChange(e.target.files?.[0]?.name ?? null)}
    />
  </div>
);

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="space-y-2">
    <h2 className="font-serif text-base text-zinc-200">{title}</h2>
    <div className="space-y-3 border border-zinc-800 bg-zinc-900/40 p-4">{children}</div>
  </section>
);

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="flex items-start gap-3">
    <span className="w-32 shrink-0 pt-1 text-xs uppercase tracking-wide text-zinc-400">{label}</span>
    <span className="flex-1">{children}</span>
  </label>
);

const ProviderSection = ({ oauth }: { oauth: OauthStatus }) => (
  <Section title="Provider">
    <Field label="claude oauth">
      <span className={oauth.state === "present" ? "text-emerald-400" : "text-rose-400"}>
        {oauth.state === "present" ? "logged in" : "not logged in"}
      </span>
    </Field>
    <Field label="credentials">
      <code className="text-zinc-400">{oauth.credentialsPath}</code>
    </Field>
    {oauth.state === "missing" && (
      <p className="text-xs text-zinc-500">
        Run <code className="text-zinc-300">claude login</code> in a terminal, then refresh this page.
      </p>
    )}
  </Section>
);
