import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { join } from "node:path";

import { ensureDataDir } from "../config.js";
import { setProvider } from "../embeddings/index.js";
import { ensureSettings } from "../settings/repo.js";
import { openDb, type Db } from "./client.js";
import { seedKinds } from "./seed.js";

const migrationsFolder = join(import.meta.dirname, "..", "..", "drizzle");

export const initDb = (): Db => {
  ensureDataDir();
  const { db } = openDb();
  migrate(db, { migrationsFolder });
  seedKinds(db);
  const s = ensureSettings(db);
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
  return db;
};

export type { Db } from "./client.js";
