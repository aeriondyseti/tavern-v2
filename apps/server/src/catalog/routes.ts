import { EntryCreate, EntryUpdate, KindId } from "@tales/shared";
import { Hono } from "hono";
import { z } from "zod";

import type { Db } from "../db/client.js";
import * as repo from "./repo.js";

const TypeCreate = z.object({ kindId: KindId, name: z.string().min(1) });
const TypeUpdate = z.object({
  name: z.string().min(1).optional(),
  position: z.number().int().optional(),
});

const ListEntriesQuery = z.object({
  typeId: z.string().optional(),
  kindId: KindId.optional(),
  q: z.string().optional(),
});

const isUniqueError = (e: unknown): boolean =>
  typeof e === "object" && e !== null && "code" in e && (e as { code: string }).code === "SQLITE_CONSTRAINT_UNIQUE";

export const buildCatalogRoutes = (db: Db) => {
  const r = new Hono();

  r.get("/kinds", (c) => c.json(repo.listKinds(db)));

  r.get("/types", (c) => {
    const kindId = c.req.query("kindId");
    const parsed = kindId ? KindId.safeParse(kindId) : null;
    if (parsed && !parsed.success) return c.json({ error: "invalid kindId" }, 400);
    return c.json(repo.listTypes(db, parsed?.data));
  });

  r.post("/types", async (c) => {
    const body = TypeCreate.safeParse(await c.req.json());
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);
    return c.json(repo.createType(db, body.data.kindId, body.data.name), 201);
  });

  r.patch("/types/:id", async (c) => {
    const body = TypeUpdate.safeParse(await c.req.json());
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);
    const updated = repo.updateType(db, c.req.param("id"), body.data);
    return updated ? c.json(updated) : c.json({ error: "not found" }, 404);
  });

  r.delete("/types/:id", (c) =>
    repo.deleteType(db, c.req.param("id")) ? c.body(null, 204) : c.json({ error: "not found" }, 404),
  );

  r.get("/entries", (c) => {
    const parsed = ListEntriesQuery.safeParse(c.req.query());
    if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
    return c.json(repo.listEntries(db, parsed.data));
  });

  r.get("/entries/:id", (c) => {
    const e = repo.getEntry(db, c.req.param("id"));
    return e ? c.json(e) : c.json({ error: "not found" }, 404);
  });

  r.post("/entries", async (c) => {
    const body = EntryCreate.safeParse(await c.req.json());
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);
    try {
      return c.json(repo.createEntry(db, body.data), 201);
    } catch (e) {
      if (isUniqueError(e)) return c.json({ error: "duplicate name in type" }, 409);
      throw e;
    }
  });

  r.patch("/entries/:id", async (c) => {
    const body = EntryUpdate.safeParse(await c.req.json());
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);
    try {
      const updated = repo.updateEntry(db, c.req.param("id"), body.data);
      return updated ? c.json(updated) : c.json({ error: "not found" }, 404);
    } catch (e) {
      if (isUniqueError(e)) return c.json({ error: "duplicate name in type" }, 409);
      throw e;
    }
  });

  r.delete("/entries/:id", (c) =>
    repo.deleteEntry(db, c.req.param("id")) ? c.body(null, 204) : c.json({ error: "not found" }, 404),
  );

  return r;
};
