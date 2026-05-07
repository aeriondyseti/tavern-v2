import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { z } from "zod";

const xdgData = process.env.XDG_DATA_HOME ?? join(homedir(), ".local", "share");

export const DATA_DIR = process.env.TALES_DATA_DIR ?? join(xdgData, "tales");
export const DB_PATH = join(DATA_DIR, "tales.sqlite");
export const TRANSFORMERS_CACHE = join(DATA_DIR, "transformers-cache");

export const HOST = process.env.TALES_HOST ?? "127.0.0.1";
export const PORT = z.coerce.number().int().min(1).max(65535).default(5174).parse(process.env.TALES_PORT);

export const ensureDataDir = () => mkdirSync(DATA_DIR, { recursive: true });
