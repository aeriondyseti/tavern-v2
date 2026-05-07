import { Hono } from "hono";

import { buildCatalogRoutes } from "./catalog/routes.js";
import { buildSearchRoutes } from "./catalog/search-routes.js";
import { type Db } from "./db/client.js";
import { buildNarratorRoutes } from "./narrator/routes.js";
import { buildTalesRoutes } from "./tales/routes.js";

export const buildApp = (db: Db) => {
  const app = new Hono();

  app.get("/api/health", (c) => c.json({ ok: true, name: "tavern", version: 0 }));
  app.route("/api", buildCatalogRoutes(db));
  app.route("/api", buildSearchRoutes(db));
  app.route("/api", buildTalesRoutes(db));
  app.route("/api", buildNarratorRoutes(db));

  return app;
};
