import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

import { DB_PATH } from "../config.js";

export type Db = BetterSQLite3Database;

export const openDb = (path: string = DB_PATH): { db: Db; sqlite: Database.Database } => {
  const sqlite = new Database(path);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  return { db: drizzle(sqlite), sqlite };
};
