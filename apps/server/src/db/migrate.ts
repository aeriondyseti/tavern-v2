import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { join } from "node:path";

import { ensureDataDir } from "../config.js";
import { openDb } from "./client.js";

ensureDataDir();
const { db } = openDb();
const migrationsFolder = join(import.meta.dirname, "..", "..", "drizzle");

migrate(db, { migrationsFolder });
console.log("migrations applied");
