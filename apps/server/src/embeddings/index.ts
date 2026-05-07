import { DEFAULT_LOCAL_MODEL, embedLocal } from "./local.js";

export type EmbeddingProviderConfig =
  | { kind: "local"; model: string }
  | { kind: "api"; url: string; model: string; apiKey?: string };

export const DEFAULT_PROVIDER: EmbeddingProviderConfig = {
  kind: "local",
  model: DEFAULT_LOCAL_MODEL,
};

let _provider: EmbeddingProviderConfig = DEFAULT_PROVIDER;

export const getProvider = (): EmbeddingProviderConfig => _provider;
export const setProvider = (p: EmbeddingProviderConfig) => {
  _provider = p;
};

export const embed = async (text: string): Promise<{ vec: Float32Array; model: string }> => {
  const provider = _provider;
  if (provider.kind === "local") {
    const vec = await embedLocal(text, provider.model);
    return { vec, model: provider.model };
  }
  return embedApi(text, provider);
};

const embedApi = async (
  text: string,
  cfg: Extract<EmbeddingProviderConfig, { kind: "api" }>,
): Promise<{ vec: Float32Array; model: string }> => {
  const r = await fetch(cfg.url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(cfg.apiKey ? { authorization: `Bearer ${cfg.apiKey}` } : {}),
    },
    body: JSON.stringify({ model: cfg.model, input: text }),
  });
  if (!r.ok) throw new Error(`embedding API ${r.status}: ${await r.text()}`);
  const body = (await r.json()) as { data?: Array<{ embedding: number[] }> };
  const arr = body.data?.[0]?.embedding;
  if (!arr) throw new Error("embedding API: malformed response");
  return { vec: Float32Array.from(arr), model: cfg.model };
};

export const f32ToBuffer = (v: Float32Array): Buffer => Buffer.from(v.buffer, v.byteOffset, v.byteLength);

export const bufferToF32 = (b: Buffer): Float32Array =>
  new Float32Array(b.buffer, b.byteOffset, b.byteLength / Float32Array.BYTES_PER_ELEMENT);

export const cosine = (a: Float32Array, b: Float32Array): number => {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let aMag = 0;
  let bMag = 0;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i]!;
    const bi = b[i]!;
    dot += ai * bi;
    aMag += ai * ai;
    bMag += bi * bi;
  }
  const denom = Math.sqrt(aMag) * Math.sqrt(bMag);
  return denom === 0 ? 0 : dot / denom;
};

export { onEmbedderStatus, getEmbedderStatus, type EmbedderStatus } from "./local.js";

export const applyEmbeddingProvider = (s: {
  embeddingProvider: "local" | "api";
  embeddingModelLocal: string;
  embeddingApiUrl: string | null;
  embeddingApiKey: string | null;
  embeddingApiModel: string | null;
}) => {
  if (s.embeddingProvider === "api" && s.embeddingApiUrl && s.embeddingApiModel) {
    setProvider({
      kind: "api",
      url: s.embeddingApiUrl,
      model: s.embeddingApiModel,
      ...(s.embeddingApiKey ? { apiKey: s.embeddingApiKey } : {}),
    });
  } else {
    setProvider({ kind: "local", model: s.embeddingModelLocal });
  }
};
