import { Hono } from "hono";

export const buildApp = () => {
  const app = new Hono();

  app.get("/api/health", (c) => c.json({ ok: true, name: "tavern", version: 0 }));

  return app;
};
