import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { join } from "node:path";

import { ensureDataDir } from "../config.js";
import { applyEmbeddingProvider } from "../embeddings/index.js";
import { ensureSettings } from "../settings/repo.js";
import { openDb, type Db } from "./client.js";
import { seedKinds } from "./seed.js";

const migrationsFolder = join(import.meta.dirname, "..", "..", "drizzle");

export const initDb = (): Db => {
  ensureDataDir();
  const { db } = openDb();
  migrate(db, { migrationsFolder });
  seedKinds(db);
  applyEmbeddingProvider(ensureSettings(db));
  return db;
};

export type { Db } from "./client.js";
