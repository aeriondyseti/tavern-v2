import { homedir } from "node:os";
import { join } from "node:path";
import { defineConfig } from "drizzle-kit";

const xdgData = process.env.XDG_DATA_HOME ?? join(homedir(), ".local", "share");
const dataDir = process.env.TAVERN_DATA_DIR ?? join(xdgData, "tavern");

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: join(dataDir, "tavern.sqlite") },
});
