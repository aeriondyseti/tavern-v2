import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { Hono } from "hono";
import { serveStatic } from "hono/bun";

import { buildCatalogRoutes } from "./catalog/routes.js";
import { buildSearchRoutes } from "./catalog/search-routes.js";
import type { Db } from "./db/client.js";
import { buildNarratorRoutes } from "./narrator/routes.js";
import { buildSettingsRoutes } from "./settings/routes.js";
import { buildStoriesRoutes } from "./stories/routes.js";

export type AppOptions = { staticRoot?: string | null };

export const buildApp = (db: Db, opts: AppOptions = {}) => {
  const app = new Hono();

  app.get("/api/health", (c) => c.json({ ok: true, name: "tales", version: 0 }));
  app.route("/api", buildCatalogRoutes(db));
  app.route("/api", buildSearchRoutes(db));
  app.route("/api", buildStoriesRoutes(db));
  app.route("/api", buildNarratorRoutes(db));
  app.route("/api", buildSettingsRoutes(db));

  const staticRoot = opts.staticRoot ?? null;
  let indexHtml: string | null = null;
  if (staticRoot && existsSync(staticRoot)) {
    const indexPath = join(staticRoot, "index.html");
    if (existsSync(indexPath)) indexHtml = readFileSync(indexPath, "utf8");
    app.use("/*", serveStatic({ root: staticRoot }));
  }

  // Always JSON-404 for /api/*, regardless of static-serving config. SPA
  // fallback to index.html only when the bundled client is present.
  app.notFound((c) => {
    if (c.req.path.startsWith("/api/")) return c.json({ error: "not found" }, 404);
    if (indexHtml) return c.html(indexHtml);
    return c.text("not found", 404);
  });

  return app;
};
