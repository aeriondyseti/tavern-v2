// Catalog + Tales schema. Full schema lands in M1; this file is a stub for M0
// so drizzle-kit has a target.
import { sqliteTable, text } from "drizzle-orm/sqlite-core";

export const _bootstrap = sqliteTable("_bootstrap", {
  id: text("id").primaryKey(),
});
