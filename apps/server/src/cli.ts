#!/usr/bin/env node
import { serve } from "@hono/node-server";

import { HOST, PORT } from "./config.js";
import { initDb } from "./db/index.js";
import { loadLocalEmbedder } from "./embeddings/local.js";
import { buildApp } from "./server.js";

const db = initDb();

console.log("loading embedder…");
try {
  await loadLocalEmbedder();
  console.log("embedder ready");
} catch (err) {
  console.error("[embedder] preload failed:", err);
}

serve({ fetch: buildApp(db).fetch, hostname: HOST, port: PORT }, ({ address, port }) => {
  console.log(`tavern running at http://${address}:${port}`);
});
