#!/usr/bin/env node
import { cpSync, existsSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const clientDist = resolve(here, "..", "..", "client", "dist");
const target = resolve(here, "..", "dist", "public");

if (!existsSync(clientDist)) {
  console.warn(`[copy-client] no client dist at ${clientDist}; skipping`);
  process.exit(0);
}

rmSync(target, { recursive: true, force: true });
cpSync(clientDist, target, { recursive: true });
console.log(`[copy-client] copied ${clientDist} → ${target}`);
