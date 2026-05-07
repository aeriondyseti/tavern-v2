import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { Hono } from "hono";
import { SettingsPatch, type OauthStatus } from "@tavern/shared";

import { DB_PATH } from "../config.js";
import { type Db } from "../db/client.js";
import { setProvider } from "../embeddings/index.js";
import { applyRestore, buildBackup, type Backup, type RestoreMode } from "./backup.js";
import { getSettings, updateSettings } from "./repo.js";

const CREDENTIALS_PATH = join(homedir(), ".claude", ".credentials.json");

const oauthStatus = (): OauthStatus => ({
  state: existsSync(CREDENTIALS_PATH) ? "present" : "missing",
  credentialsPath: CREDENTIALS_PATH,
});

const applySettingsToProvider = (s: ReturnType<typeof getSettings>) => {
  if (s.embeddingProvider === "api" && s.embeddingApiUrl && s.embeddingApiModel) {
    setProvider({
      kind: "api",
      url: s.embeddingApiUrl,
      model: s.embeddingApiModel,
      ...(s.embeddingApiKey ? { apiKey: s.embeddingApiKey } : {}),
    });
  } else {
    setProvider({ kind: "local", model: s.embeddingModelLocal });
  }
};

export const buildSettingsRoutes = (db: Db) => {
  const r = new Hono();

  r.get("/settings", (c) => c.json(getSettings(db)));

  r.patch("/settings", async (c) => {
    const body = SettingsPatch.safeParse(await c.req.json());
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);
    const next = updateSettings(db, body.data);
    applySettingsToProvider(next);
    return c.json(next);
  });

  r.get("/oauth/status", (c) => c.json(oauthStatus()));

  r.get("/storage/info", (c) =>
    c.json({ dbPath: DB_PATH, oauth: oauthStatus() }),
  );

  r.get("/backup", (c) => {
    const backup = buildBackup(db);
    const filename = `tavern-catalog-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    return c.json(backup, 200, {
      "content-disposition": `attachment; filename="${filename}"`,
    });
  });

  r.post("/restore", async (c) => {
    const mode = (c.req.query("mode") ?? "merge") as RestoreMode;
    if (mode !== "merge" && mode !== "replace") {
      return c.json({ error: "mode must be merge or replace" }, 400);
    }
    let body: Backup;
    try {
      body = (await c.req.json()) as Backup;
    } catch {
      return c.json({ error: "invalid JSON body" }, 400);
    }
    try {
      const result = applyRestore(db, body, mode);
      return c.json(result);
    } catch (e) {
      return c.json(
        { error: e instanceof Error ? e.message : String(e) },
        400,
      );
    }
  });

  return r;
};
