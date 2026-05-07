import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { Hono } from "hono";
import { serveStatic } from "hono/bun";

import { buildCatalogRoutes } from "./catalog/routes.js";
import { buildSearchRoutes } from "./catalog/search-routes.js";
import type { Db } from "./db/client.js";
import { buildNarratorRoutes } from "./narrator/routes.js";
import { buildSettingsRoutes } from "./settings/routes.js";
import { buildTalesRoutes } from "./tales/routes.js";

export type AppOptions = { staticRoot?: string | null };

export const buildApp = (db: Db, opts: AppOptions = {}) => {
  const app = new Hono();

  app.get("/api/health", (c) => c.json({ ok: true, name: "tavern", version: 0 }));
  app.route("/api", buildCatalogRoutes(db));
  app.route("/api", buildSearchRoutes(db));
  app.route("/api", buildTalesRoutes(db));
  app.route("/api", buildNarratorRoutes(db));
  app.route("/api", buildSettingsRoutes(db));

  const staticRoot = opts.staticRoot ?? null;
  if (staticRoot && existsSync(staticRoot)) {
    const indexPath = join(staticRoot, "index.html");
    const indexHtml = existsSync(indexPath) ? readFileSync(indexPath, "utf8") : null;
    app.use("/*", serveStatic({ root: staticRoot }));
    if (indexHtml) {
      // SPA fallback: any non-API path that didn't resolve to a static asset
      // gets the bundled index.html so client-side routing works on reload.
      app.notFound((c) => {
        if (c.req.path.startsWith("/api/")) return c.json({ error: "not found" }, 404);
        return c.html(indexHtml);
      });
    }
  }

  return app;
};
