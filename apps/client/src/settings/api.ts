import type { OauthStatus, Settings, SettingsPatch } from "@tavern/shared";

import { json, send } from "../api/util.js";

export type StorageInfo = { dbPath: string; oauth: OauthStatus };

export const settingsApi = {
  get: () => send("/api/settings").then((r) => json<Settings>(r)),
  patch: (patch: SettingsPatch) =>
    send("/api/settings", { method: "PATCH", body: JSON.stringify(patch) }).then((r) => json<Settings>(r)),
  oauthStatus: () => send("/api/oauth/status").then((r) => json<OauthStatus>(r)),
  storageInfo: () => send("/api/storage/info").then((r) => json<StorageInfo>(r)),
};

export const downloadBackup = async () => {
  const r = await fetch("/api/backup");
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  const blob = await r.blob();
  const cd = r.headers.get("content-disposition") ?? "";
  const m = /filename="?([^";]+)"?/.exec(cd);
  const filename = m?.[1] ?? `tavern-catalog-${Date.now()}.json`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

export const uploadRestore = async (file: File, mode: "merge" | "replace") => {
  const text = await file.text();
  const r = await fetch(`/api/restore?mode=${mode}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: text,
  });
  return json<{
    mode: string;
    types: { inserted: number; updated: number };
    entries: { inserted: number; updated: number };
    facets: number;
    cues: number;
    connections: number;
    directionTiers: number;
  }>(r);
};
