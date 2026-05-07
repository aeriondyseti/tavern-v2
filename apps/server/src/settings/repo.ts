import type { Settings, SettingsPatch } from "@tavern/shared";
import { eq } from "drizzle-orm";

import type { Db } from "../db/client.js";
import { settings } from "../db/schema.js";

const SINGLETON_ID = 1;

const rowToDto = (row: typeof settings.$inferSelect): Settings => ({
  defaultModel: row.defaultModel as Settings["defaultModel"],
  defaultTemperature: row.defaultTemperature,
  defaultMaxTokens: row.defaultMaxTokens,
  defaultThinkingBudget: row.defaultThinkingBudget,
  embeddingProvider: row.embeddingProvider,
  embeddingModelLocal: row.embeddingModelLocal,
  embeddingApiUrl: row.embeddingApiUrl,
  embeddingApiKey: row.embeddingApiKey,
  embeddingApiModel: row.embeddingApiModel,
});

export const ensureSettings = (db: Db): Settings => {
  const existing = db.select().from(settings).where(eq(settings.id, SINGLETON_ID)).get();
  if (existing) return rowToDto(existing);
  const seeded = db.insert(settings).values({ id: SINGLETON_ID }).returning().get();
  return rowToDto(seeded!);
};

// initDb runs ensureSettings at boot, so the singleton row is guaranteed to
// exist on every code path that ever reaches the routes.
export const updateSettings = (db: Db, patch: SettingsPatch): Settings => {
  const updates: Partial<typeof settings.$inferInsert> = {};
  for (const key of Object.keys(patch) as (keyof SettingsPatch)[]) {
    const v = patch[key];
    if (v !== undefined) (updates as Record<string, unknown>)[key] = v;
  }
  if (Object.keys(updates).length === 0) return ensureSettings(db);
  const row = db.update(settings).set(updates).where(eq(settings.id, SINGLETON_ID)).returning().get();
  return rowToDto(row!);
};
