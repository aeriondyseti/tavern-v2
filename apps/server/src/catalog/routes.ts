import { Hono } from "hono";
import { z } from "zod";

import { type Db } from "../db/client.js";
import { DIRECTION_TIERS, FACET_MODES, KIND_IDS } from "../db/schema.js";
import * as repo from "./repo.js";

const KindEnum = z.enum(KIND_IDS);
const FacetModeEnum = z.enum(FACET_MODES);
const TierEnum = z.enum(DIRECTION_TIERS);

const TypeCreate = z.object({ kindId: KindEnum, name: z.string().min(1) });
const TypeUpdate = z.object({ name: z.string().min(1).optional(), position: z.number().int().optional() });

const FacetInput = z.object({
  id: z.string().optional(),
  label: z.string().min(1),
  body: z.string().default(""),
  mode: FacetModeEnum.default("always"),
  position: z.number().int().nonnegative().optional(),
});
const ConnectionInput = z.object({
  toEntryId: z.string().min(1),
  kind: z.literal("brings").default("brings"),
});
const EntryCreate = z.object({
  typeId: z.string().min(1),
  name: z.string().min(1),
  facets: z.array(FacetInput).default([]),
  cues: z.array(z.string()).default([]),
  connections: z.array(ConnectionInput).default([]),
  tier: TierEnum.optional(),
});
const EntryUpdate = EntryCreate.partial();

const ListEntriesQuery = z.object({
  typeId: z.string().optional(),
  kindId: KindEnum.optional(),
  q: z.string().optional(),
});

export const buildCatalogRoutes = (db: Db) => {
  const r = new Hono();

  r.get("/kinds", (c) => c.json(repo.listKinds(db)));

  r.get("/types", (c) => {
    const kindId = c.req.query("kindId");
    const parsed = kindId ? KindEnum.safeParse(kindId) : null;
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

  r.delete("/types/:id", (c) => {
    return repo.deleteType(db, c.req.param("id"))
      ? c.body(null, 204)
      : c.json({ error: "not found" }, 404);
  });

  r.get("/entries", (c) => {
    const parsed = ListEntriesQuery.safeParse(Object.fromEntries(new URL(c.req.url).searchParams));
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

  r.delete("/entries/:id", (c) => {
    return repo.deleteEntry(db, c.req.param("id"))
      ? c.body(null, 204)
      : c.json({ error: "not found" }, 404);
  });

  return r;
};

const isUniqueError = (e: unknown): boolean =>
  typeof e === "object" &&
  e !== null &&
  "code" in e &&
  (e as { code: string }).code === "SQLITE_CONSTRAINT_UNIQUE";
