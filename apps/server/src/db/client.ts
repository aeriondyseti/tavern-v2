import { Database } from "bun:sqlite";
import { type BunSQLiteDatabase, drizzle } from "drizzle-orm/bun-sqlite";

import { DB_PATH } from "../config.js";

export type Db = BunSQLiteDatabase;

export const openDb = (path: string = DB_PATH): { db: Db; sqlite: Database } => {
  const sqlite = new Database(path);
  sqlite.exec("PRAGMA journal_mode = WAL;");
  sqlite.exec("PRAGMA foreign_keys = ON;");
  return { db: drizzle(sqlite), sqlite };
};
