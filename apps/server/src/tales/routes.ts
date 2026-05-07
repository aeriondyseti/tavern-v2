import { SetupData } from "@tavern/shared";
import { Hono } from "hono";
import { z } from "zod";

import type { Db } from "../db/client.js";
import * as repo from "./repo.js";

const TaleCreate = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  anchorProse: z.string().optional(),
});
const TaleUpdate = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  anchorProse: z.string().optional(),
  activeSceneId: z.string().nullable().optional(),
});

const SceneCreate = z.object({
  name: z.string().min(1),
  anchorProse: z.string().optional(),
});
const SceneUpdate = z.object({
  name: z.string().min(1).optional(),
  anchorProse: z.string().optional(),
  position: z.number().int().nonnegative().optional(),
});

const PinnedReplace = z.object({ entryIds: z.array(z.string()) });
const AnchorFacetsReplace = z.object({
  facets: z.array(z.object({ label: z.string().min(1), body: z.string().optional() })),
});

export const buildTalesRoutes = (db: Db) => {
  const r = new Hono();

  r.get("/tales", (c) => c.json(repo.listTales(db)));

  r.get("/tales/:id", (c) => {
    const t = repo.getTale(db, c.req.param("id"));
    return t ? c.json(t) : c.json({ error: "not found" }, 404);
  });

  r.post("/tales", async (c) => {
    const body = TaleCreate.safeParse(await c.req.json());
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);
    return c.json(repo.createTale(db, body.data), 201);
  });

  r.patch("/tales/:id", async (c) => {
    const body = TaleUpdate.safeParse(await c.req.json());
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);
    const updated = repo.updateTale(db, c.req.param("id"), body.data);
    return updated ? c.json(updated) : c.json({ error: "not found" }, 404);
  });

  r.delete("/tales/:id", (c) =>
    repo.deleteTale(db, c.req.param("id")) ? c.body(null, 204) : c.json({ error: "not found" }, 404),
  );

  r.put("/tales/:id/setup", async (c) => {
    const body = SetupData.safeParse(await c.req.json());
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);
    const updated = repo.updateTaleSetup(db, c.req.param("id"), body.data);
    return updated ? c.json(updated) : c.json({ error: "not found" }, 404);
  });

  r.put("/tales/:id/pinned", async (c) => {
    const body = PinnedReplace.safeParse(await c.req.json());
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);
    return c.json(repo.replacePinned(db, { kind: "tale", id: c.req.param("id") }, body.data.entryIds));
  });

  r.put("/tales/:id/anchor-facets", async (c) => {
    const body = AnchorFacetsReplace.safeParse(await c.req.json());
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);
    return c.json(repo.replaceAnchorFacets(db, { taleId: c.req.param("id"), sceneId: null }, body.data.facets));
  });

  r.post("/tales/:id/scenes", async (c) => {
    const body = SceneCreate.safeParse(await c.req.json());
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);
    const created = repo.createScene(db, c.req.param("id"), body.data);
    return created ? c.json(created, 201) : c.json({ error: "tale not found" }, 404);
  });

  r.get("/scenes/:id", (c) => {
    const s = repo.getScene(db, c.req.param("id"));
    return s ? c.json(s) : c.json({ error: "not found" }, 404);
  });

  r.patch("/scenes/:id", async (c) => {
    const body = SceneUpdate.safeParse(await c.req.json());
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);
    const updated = repo.updateScene(db, c.req.param("id"), body.data);
    return updated ? c.json(updated) : c.json({ error: "not found" }, 404);
  });

  r.delete("/scenes/:id", (c) =>
    repo.deleteScene(db, c.req.param("id")) ? c.body(null, 204) : c.json({ error: "not found" }, 404),
  );

  r.put("/scenes/:id/adjustments", async (c) => {
    const body = SetupData.safeParse(await c.req.json());
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);
    const updated = repo.upsertSceneAdjustments(db, c.req.param("id"), body.data);
    return updated ? c.json(updated) : c.json({ error: "not found" }, 404);
  });

  r.delete("/scenes/:id/adjustments", (c) =>
    repo.dropSceneAdjustments(db, c.req.param("id")) ? c.body(null, 204) : c.json({ error: "no adjustments" }, 404),
  );

  r.put("/scenes/:id/pinned", async (c) => {
    const body = PinnedReplace.safeParse(await c.req.json());
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);
    return c.json(repo.replacePinned(db, { kind: "scene", id: c.req.param("id") }, body.data.entryIds));
  });

  r.put("/scenes/:id/anchor-facets", async (c) => {
    const body = AnchorFacetsReplace.safeParse(await c.req.json());
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);
    const scene = repo.getScene(db, c.req.param("id"));
    if (!scene) return c.json({ error: "not found" }, 404);
    return c.json(repo.replaceAnchorFacets(db, { taleId: scene.taleId, sceneId: c.req.param("id") }, body.data.facets));
  });

  return r;
};
