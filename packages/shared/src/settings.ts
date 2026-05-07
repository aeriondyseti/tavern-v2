import { z } from "zod";

import { ModelId } from "./setup.js";

export const EmbeddingProviderKind = z.enum(["local", "api"]);
export type EmbeddingProviderKind = z.infer<typeof EmbeddingProviderKind>;

export const Settings = z.object({
  defaultModel: ModelId,
  defaultTemperature: z.number().min(0).max(2),
  defaultMaxTokens: z.number().int().positive(),
  defaultThinkingBudget: z.number().int().nonnegative().nullable(),
  embeddingProvider: EmbeddingProviderKind,
  embeddingModelLocal: z.string(),
  embeddingApiUrl: z.string().nullable(),
  embeddingApiKey: z.string().nullable(),
  embeddingApiModel: z.string().nullable(),
});
export type Settings = z.infer<typeof Settings>;

export const SettingsPatch = Settings.partial();
export type SettingsPatch = z.infer<typeof SettingsPatch>;

export type OauthStatus = {
  state: "present" | "missing";
  credentialsPath: string;
};
