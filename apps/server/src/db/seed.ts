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
