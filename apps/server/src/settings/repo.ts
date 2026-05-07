import { eq } from "drizzle-orm";
import type { Settings, SettingsPatch } from "@tavern/shared";

import { type Db } from "../db/client.js";
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
  const row = db.select().from(settings).where(eq(settings.id, SINGLETON_ID)).get();
  if (row) return rowToDto(row);
  db.insert(settings).values({ id: SINGLETON_ID }).run();
  const seeded = db.select().from(settings).where(eq(settings.id, SINGLETON_ID)).get();
  return rowToDto(seeded!);
};

export const getSettings = ensureSettings;

export const updateSettings = (db: Db, patch: SettingsPatch): Settings => {
  ensureSettings(db);
  const updates: Partial<typeof settings.$inferInsert> = {};
  if (patch.defaultModel !== undefined) updates.defaultModel = patch.defaultModel;
  if (patch.defaultTemperature !== undefined) updates.defaultTemperature = patch.defaultTemperature;
  if (patch.defaultMaxTokens !== undefined) updates.defaultMaxTokens = patch.defaultMaxTokens;
  if (patch.defaultThinkingBudget !== undefined)
    updates.defaultThinkingBudget = patch.defaultThinkingBudget;
  if (patch.embeddingProvider !== undefined) updates.embeddingProvider = patch.embeddingProvider;
  if (patch.embeddingModelLocal !== undefined)
    updates.embeddingModelLocal = patch.embeddingModelLocal;
  if (patch.embeddingApiUrl !== undefined) updates.embeddingApiUrl = patch.embeddingApiUrl;
  if (patch.embeddingApiKey !== undefined) updates.embeddingApiKey = patch.embeddingApiKey;
  if (patch.embeddingApiModel !== undefined) updates.embeddingApiModel = patch.embeddingApiModel;
  if (Object.keys(updates).length > 0) {
    const rows = db
      .update(settings)
      .set(updates)
      .where(eq(settings.id, SINGLETON_ID))
      .returning()
      .all();
    return rowToDto(rows[0]!);
  }
  return ensureSettings(db);
};
