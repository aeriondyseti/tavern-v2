#!/usr/bin/env node
import { serve } from "@hono/node-server";

import { ensureDataDir, HOST, PORT } from "./config.js";
import { buildApp } from "./server.js";

ensureDataDir();

serve({ fetch: buildApp().fetch, hostname: HOST, port: PORT }, ({ address, port }) => {
  console.log(`tavern running at http://${address}:${port}`);
});
