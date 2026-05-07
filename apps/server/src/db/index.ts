import { existsSync } from "node:fs";
import { join } from "node:path";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";

import { ensureDataDir } from "../config.js";
import { applyEmbeddingProvider } from "../embeddings/index.js";
import { ensureSettings } from "../settings/repo.js";
import { type Db, openDb } from "./client.js";
import { seedKinds } from "./seed.js";

// Resolve the migrations folder for both layouts:
// - source:    apps/server/src/db/index.ts  → ../../drizzle
// - bundled:   apps/server/dist/cli.js      → ../drizzle
const findMigrationsFolder = (): string => {
  const here = import.meta.dirname;
  const candidates = [join(here, "..", "..", "drizzle"), join(here, "..", "drizzle"), join(here, "drizzle")];
  return candidates.find((p) => existsSync(p)) ?? candidates[0]!;
};

const migrationsFolder = findMigrationsFolder();

export const initDb = (): Db => {
  ensureDataDir();
  const { db } = openDb();
  migrate(db, { migrationsFolder });
  seedKinds(db);
  applyEmbeddingProvider(ensureSettings(db));
  return db;
};

export type { Db } from "./client.js";
