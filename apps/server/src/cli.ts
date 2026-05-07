#!/usr/bin/env node
import { serve } from "@hono/node-server";

import { HOST, PORT } from "./config.js";
import { buildApp } from "./server.js";

const app = buildApp();

serve({ fetch: app.fetch, hostname: HOST, port: PORT }, ({ address, port }) => {
  console.log(`tavern running at http://${address}:${port}`);
});
