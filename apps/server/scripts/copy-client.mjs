#!/usr/bin/env node
import { cpSync, existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const here = import.meta.dirname;
const clientDist = resolve(here, "..", "..", "client", "dist");
const target = resolve(here, "..", "dist", "public");

if (!existsSync(clientDist)) {
  console.warn(`[copy-client] no client dist at ${clientDist}; skipping`);
  process.exit(0);
}

rmSync(target, { recursive: true, force: true });
cpSync(clientDist, target, { recursive: true });
console.log(`[copy-client] copied ${clientDist} → ${target}`);
