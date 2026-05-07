#!/usr/bin/env node
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { serve } from "@hono/node-server";

import { HOST, PORT } from "./config.js";
import { initDb } from "./db/index.js";
import { loadLocalEmbedder } from "./embeddings/local.js";
import { buildApp } from "./server.js";

const findStaticRoot = (): string | null => {
  const here = dirname(fileURLToPath(import.meta.url));
  const override = process.env["TAVERN_STATIC_ROOT"];
  const candidates = [
    override,
    join(here, "public"),
    join(here, "..", "public"),
    join(here, "..", "..", "client", "dist"),
  ].filter((x): x is string => Boolean(x));
  return candidates.find((p) => existsSync(p)) ?? null;
};

const db = initDb();

// Preload synchronously: lazy-loading after serve() interferes with
// transformers.js's fetch and reliably fails getModelFile on first call.
console.log("loading embedder…");
try {
  await loadLocalEmbedder();
  console.log("embedder ready");
} catch (err) {
  console.error("[embedder] preload failed:", err);
}

const staticRoot = findStaticRoot();
if (staticRoot) console.log(`serving static client from ${staticRoot}`);
else console.log("no bundled client; API only");

serve(
  { fetch: buildApp(db, { staticRoot }).fetch, hostname: HOST, port: PORT },
  ({ address, port }) => {
    console.log(`tavern running at http://${address}:${port}`);
  },
);
