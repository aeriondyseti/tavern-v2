import { sqliteTable, text } from "drizzle-orm/sqlite-core";

export const _bootstrap = sqliteTable("_bootstrap", {
  id: text("id").primaryKey(),
});
