import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { z } from "zod";

const xdgData = process.env.XDG_DATA_HOME ?? join(homedir(), ".local", "share");

export const DATA_DIR = process.env.TAVERN_DATA_DIR ?? join(xdgData, "tavern");
export const DB_PATH = join(DATA_DIR, "tavern.sqlite");
export const TRANSFORMERS_CACHE = join(DATA_DIR, "transformers-cache");

export const HOST = process.env.TAVERN_HOST ?? "127.0.0.1";
export const PORT = z.coerce.number().int().min(1).max(65535).default(5174).parse(process.env.TAVERN_PORT);

export const ensureDataDir = () => mkdirSync(DATA_DIR, { recursive: true });
