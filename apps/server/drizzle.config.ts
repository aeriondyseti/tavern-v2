import { defineConfig } from "drizzle-kit";

import { DB_PATH } from "./src/config.js";

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: DB_PATH },
});
