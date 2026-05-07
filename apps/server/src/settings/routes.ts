import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { type OauthStatus, SettingsPatch } from "@tales/shared";
import { Hono } from "hono";
import { z } from "zod";

import { DB_PATH } from "../config.js";
import type { Db } from "../db/client.js";
import { applyEmbeddingProvider } from "../embeddings/index.js";
import { applyRestore, BackupSchema, buildBackup } from "./backup.js";
import { ensureSettings, updateSettings } from "./repo.js";

const CREDENTIALS_PATH = join(homedir(), ".claude", ".credentials.json");
const RestoreMode = z.enum(["merge", "replace"]);

const oauthStatus = (): OauthStatus => ({
  state: existsSync(CREDENTIALS_PATH) ? "present" : "missing",
  credentialsPath: CREDENTIALS_PATH,
});

export const buildSettingsRoutes = (db: Db) => {
  const r = new Hono();

  r.get("/settings", (c) => c.json(ensureSettings(db)));

  r.patch("/settings", async (c) => {
    const body = SettingsPatch.safeParse(await c.req.json());
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);
    const next = updateSettings(db, body.data);
    applyEmbeddingProvider(next);
    return c.json(next);
  });

  r.get("/oauth/status", (c) => c.json(oauthStatus()));

  r.get("/storage/info", (c) => c.json({ dbPath: DB_PATH, oauth: oauthStatus() }));

  r.get("/backup", (c) => {
    const backup = buildBackup(db);
    const filename = `tales-catalog-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    return c.json(backup, 200, {
      "content-disposition": `attachment; filename="${filename}"`,
    });
  });

  r.post("/restore", async (c) => {
    const mode = RestoreMode.safeParse(c.req.query("mode") ?? "merge");
    if (!mode.success) return c.json({ error: "mode must be merge or replace" }, 400);
    let raw: unknown;
    try {
      raw = await c.req.json();
    } catch {
      return c.json({ error: "invalid JSON body" }, 400);
    }
    const parsed = BackupSchema.safeParse(raw);
    if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
    try {
      return c.json(applyRestore(db, parsed.data, mode.data));
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : String(e) }, 400);
    }
  });

  return r;
};
