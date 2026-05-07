import { z } from "zod";

export const ModelId = z.enum([
  "claude-opus-4-7",
  "claude-sonnet-4-6",
  "claude-haiku-4-5-20251001",
]);
export type ModelId = z.infer<typeof ModelId>;

export const DEFAULT_MODEL: ModelId = "claude-opus-4-7";

export const DirectionTier = z.enum(["absolute", "strong", "normal", "background"]);
export type DirectionTier = z.infer<typeof DirectionTier>;

export const SetupData = z.object({
  directions: z.object({
    absolute: z.array(z.string()).default([]),
    strong: z.array(z.string()).default([]),
    normal: z.array(z.string()).default([]),
    background: z.array(z.string()).default([]),
  }),
  model: z.object({
    id: ModelId.default(DEFAULT_MODEL),
    temperature: z.number().min(0).max(2).default(1.0),
    max_tokens: z.number().int().positive().default(4096),
    thinking_budget: z.number().int().nonnegative().optional(),
    system_prompt_append: z.string().optional(),
  }),
  retrieval: z.object({
    enabled_types: z.array(z.string()).default([]),
    max_results: z.number().int().positive().default(8),
    threshold: z.number().min(0).max(1).default(0.25),
    keyword_weight: z.number().min(0).max(1).default(0.4),
    embedding_weight: z.number().min(0).max(1).default(0.6),
    brings_depth: z.number().int().nonnegative().default(2),
  }),
  tools: z.object({
    search_world: z.boolean().default(true),
    get_entry: z.boolean().default(true),
    list_active_directions: z.boolean().default(true),
    list_pinned: z.boolean().default(true),
  }),
  history: z.object({
    max_beats: z.number().int().positive().default(30),
  }),
});
export type SetupData = z.infer<typeof SetupData>;

export const defaultSetup = (): SetupData => SetupData.parse({
  directions: {},
  model: {},
  retrieval: {},
  tools: {},
  history: {},
});
