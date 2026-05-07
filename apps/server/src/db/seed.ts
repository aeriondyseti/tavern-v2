import { sql } from "drizzle-orm";

import { type Db } from "./client.js";
import { KIND_DIRECTION, KIND_WORLD, kinds } from "./schema.js";

export const seedKinds = (db: Db) => {
  db.insert(kinds)
    .values([
      { id: KIND_DIRECTION, label: "Direction" },
      { id: KIND_WORLD, label: "World" },
    ])
    .onConflictDoNothing()
    .run();
};

export const _truncateAll = (db: Db) => {
  db.run(sql`PRAGMA foreign_keys = OFF`);
  for (const t of [
    "connections",
    "cues",
    "facets",
    "direction_tier",
    "entries",
    "types",
    "kinds",
  ]) {
    db.run(sql.raw(`DELETE FROM ${t}`));
  }
  db.run(sql`PRAGMA foreign_keys = ON`);
};
