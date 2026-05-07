import { mkdirSync } from "node:fs";

import { env, type FeatureExtractionPipeline, type ProgressInfo, pipeline } from "@huggingface/transformers";
import type { EmbedderStatus } from "@tavern/shared";

import { TRANSFORMERS_CACHE } from "../config.js";

mkdirSync(TRANSFORMERS_CACHE, { recursive: true });
env.cacheDir = TRANSFORMERS_CACHE;
env.allowLocalModels = false;
env.allowRemoteModels = true;

export const DEFAULT_LOCAL_MODEL = "Xenova/bge-small-en-v1.5";

export type { EmbedderStatus };

let _pipe: FeatureExtractionPipeline | null = null;
let _pendingLoad: Promise<FeatureExtractionPipeline> | null = null;
let _loadingFor: string | null = null;
let _status: EmbedderStatus = { state: "idle" };
const _statusListeners = new Set<(s: EmbedderStatus) => void>();

const setStatus = (s: EmbedderStatus) => {
  _status = s;
  for (const fn of _statusListeners) fn(s);
};

export const getEmbedderStatus = (): EmbedderStatus => _status;

export const onEmbedderStatus = (fn: (s: EmbedderStatus) => void): (() => void) => {
  _statusListeners.add(fn);
  return () => _statusListeners.delete(fn);
};

export const loadLocalEmbedder = (model: string = DEFAULT_LOCAL_MODEL): Promise<FeatureExtractionPipeline> => {
  if (_pipe && _loadingFor === model) return Promise.resolve(_pipe);
  if (_pendingLoad && _loadingFor === model) return _pendingLoad;
  _loadingFor = model;
  _pipe = null;
  setStatus({ state: "loading", model });
  _pendingLoad = (async () => {
    try {
      const p = await pipeline("feature-extraction", model, {
        dtype: "q8",
        progress_callback: (e: ProgressInfo) => {
          if (e.status === "progress") {
            setStatus({
              state: "loading",
              model,
              file: e.file,
              progress: Math.round(e.progress),
            });
          }
        },
      });
      _pipe = p as FeatureExtractionPipeline;
      setStatus({ state: "ready", model });
      return _pipe;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setStatus({ state: "error", model, message });
      throw err;
    } finally {
      _pendingLoad = null;
    }
  })();
  return _pendingLoad;
};

export const embedLocal = async (text: string, model: string = DEFAULT_LOCAL_MODEL): Promise<Float32Array> => {
  const pipe = await loadLocalEmbedder(model);
  const out = await pipe(text, { pooling: "mean", normalize: true });
  return out.data as Float32Array;
};
