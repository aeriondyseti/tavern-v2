import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { db } from "./client.js";

const here = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = join(here, "..", "..", "drizzle");

migrate(db, { migrationsFolder });
console.log("migrations applied");
