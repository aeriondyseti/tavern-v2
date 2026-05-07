import { sql } from "drizzle-orm";

import type { Db } from "./client.js";

export const withForeignKeysOff = <T>(db: Db, fn: () => T): T => {
  db.run(sql`PRAGMA foreign_keys = OFF`);
  try {
    return fn();
  } finally {
    db.run(sql`PRAGMA foreign_keys = ON`);
  }
};
