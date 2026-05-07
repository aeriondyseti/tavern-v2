import { Hono } from "hono";

import { buildCatalogRoutes } from "./catalog/routes.js";
import { type Db } from "./db/client.js";

export const buildApp = (db: Db) => {
  const app = new Hono();

  app.get("/api/health", (c) => c.json({ ok: true, name: "tavern", version: 0 }));
  app.route("/api", buildCatalogRoutes(db));

  return app;
};
