#!/usr/bin/env node
import { serve } from "@hono/node-server";

import { HOST, PORT } from "./config.js";
import { initDb } from "./db/index.js";
import { buildApp } from "./server.js";

const db = initDb();

serve({ fetch: buildApp(db).fetch, hostname: HOST, port: PORT }, ({ address, port }) => {
  console.log(`tavern running at http://${address}:${port}`);
});
