export const BEAT_STATUSES = ["streaming", "complete", "cancelled", "error"] as const;
export type BeatStatus = (typeof BEAT_STATUSES)[number];

export type BeatAlt = { narratorOutput: string; transcriptId: string; createdAt: number };

export type Beat = {
  id: string;
  sceneId: string;
  position: number;
  playerInput: string;
  narratorOutput: string;
  status: BeatStatus;
  alts: BeatAlt[];
  activeAlt: number;
  createdAt: number;
  completedAt: number | null;
};

export type SearchCallRecord = {
  query: string;
  candidates: Array<{
    entryId: string;
    name: string;
    bm25: number;
    embeddingSim: number;
    blended: number;
    selected: boolean;
    fromBrings: boolean;
  }>;
  bringsAdded: string[];
};

export type BeatEvent =
  | { type: "beat_started"; beatId: string; ts: number }
  | { type: "system_prompt"; text: string; ts: number }
  | { type: "request_built"; body: unknown; ts: number }
  | {
      type: "tool_use";
      id: string;
      name: string;
      input: Record<string, unknown>;
      ts: number;
    }
  | {
      type: "tool_result";
      id: string;
      output: unknown;
      searchCall?: SearchCallRecord;
      ts: number;
    }
  | { type: "thinking_delta"; text: string; ts: number }
  | { type: "text_delta"; text: string; ts: number }
  | { type: "done"; durationMs: number; ts: number }
  | { type: "regenerated"; deletedBeatIds: string[]; ts: number }
  | { type: "error"; message: string; code?: string; ts: number };

export type BeatTranscript = {
  id: string;
  beatId: string;
  altIndex: number;
  requestBody: unknown;
  events: BeatEvent[];
  searchCalls: SearchCallRecord[];
  model: string;
  durationMs: number | null;
  createdAt: number;
};
