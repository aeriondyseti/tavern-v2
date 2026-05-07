#!/usr/bin/env bun
import { existsSync } from "node:fs";
import { join } from "node:path";

import { HOST, PORT } from "./config.js";
import { initDb } from "./db/index.js";
import { buildApp } from "./server.js";

const findStaticRoot = (): string | null => {
  const here = import.meta.dirname;
  const override = process.env.TALES_STATIC_ROOT;
  const candidates = [
    override,
    // Published layout: dist/public/ next to dist/cli.js, populated by
    // scripts/copy-client.mjs.
    join(here, "public"),
    // Source layout: apps/server/src/cli.ts → apps/client/dist/.
    join(here, "..", "..", "client", "dist"),
    // Built layout: apps/server/dist/cli.js → apps/client/dist/.
    join(here, "..", "..", "..", "client", "dist"),
  ].filter((x): x is string => Boolean(x));
  return candidates.find((p) => existsSync(p)) ?? null;
};

const db = initDb();

const staticRoot = findStaticRoot();
if (staticRoot) console.log(`serving static client from ${staticRoot}`);
else console.log("no bundled client; API only");

const server = Bun.serve({
  hostname: HOST,
  port: PORT,
  fetch: buildApp(db, { staticRoot }).fetch,
});

console.log(`tales running at http://${server.hostname}:${server.port}`);
