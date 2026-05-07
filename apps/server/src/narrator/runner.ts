import { query } from "@anthropic-ai/claude-agent-sdk";
import type { BeatEvent, SearchCallRecord, SetupData } from "@tavern/shared";

import type { Db } from "../db/client.js";
import { buildNarratorMcpServer } from "./mcp.js";
import { composeSystemPrompt } from "./system-prompt.js";

export type RunNarratorArgs = {
  storyId: string;
  sceneId: string | null;
  setup: SetupData;
  systemPrompt: string;
  history: { role: "user" | "assistant"; content: string }[];
  playerInput: string;
  abort: AbortController;
  onEvent: (event: BeatEvent) => void | Promise<void>;
};

export type RunResult = {
  narratorOutput: string;
  durationMs: number;
  searchCalls: SearchCallRecord[];
  events: BeatEvent[];
  requestBody: unknown;
  status: "complete" | "cancelled" | "error";
  errorMessage?: string;
};

const NARRATOR_MCP_PREFIX = "mcp__tavern-catalog__";

const TOOL_NAME_BY_FLAG: Record<keyof SetupData["tools"], string> = {
  search_world: `${NARRATOR_MCP_PREFIX}search_world`,
  get_entry: `${NARRATOR_MCP_PREFIX}get_entry`,
  list_active_directions: `${NARRATOR_MCP_PREFIX}list_active_directions`,
  list_pinned: `${NARRATOR_MCP_PREFIX}list_pinned`,
};

const FILE_AND_BASH_TOOLS = ["Bash", "Read", "Write", "Edit", "Glob", "Grep", "WebFetch", "WebSearch"];

const allowedToolsFromSetup = (setup: SetupData): string[] =>
  (Object.keys(TOOL_NAME_BY_FLAG) as (keyof SetupData["tools"])[])
    .filter((flag) => setup.tools[flag])
    .map((flag) => TOOL_NAME_BY_FLAG[flag]);

const renderHistoryAsPrompt = (history: RunNarratorArgs["history"], playerInput: string): string => {
  const lines = history.map((m) => `${m.role === "user" ? "Player" : "Narrator"}: ${m.content}`);
  lines.push(`Player: ${playerInput}`);
  return lines.join("\n\n");
};

export const runNarrator = async (db: Db, args: RunNarratorArgs): Promise<RunResult> => {
  const startTs = Date.now();
  const events: BeatEvent[] = [];
  const searchCalls: SearchCallRecord[] = [];
  const recorder = {
    pushSearchCall: (rec: SearchCallRecord) => {
      searchCalls.push(rec);
    },
  };

  let doneSent = false;
  const emit = async (e: BeatEvent) => {
    if (e.type === "done") {
      if (doneSent) return;
      doneSent = true;
    }
    events.push(e);
    try {
      await args.onEvent(e);
    } catch {
      // SSE stream closed; swallow so cleanup keeps running.
    }
  };

  const mcp = buildNarratorMcpServer(db, {
    storyId: args.storyId,
    sceneId: args.sceneId,
    setup: args.setup,
    recorder,
  });

  const promptString = renderHistoryAsPrompt(args.history, args.playerInput);
  const allowedTools = allowedToolsFromSetup(args.setup);
  const requestBody = {
    model: args.setup.model.id,
    systemPrompt: args.systemPrompt,
    history: args.history,
    playerInput: args.playerInput,
    allowedTools,
    disallowedTools: FILE_AND_BASH_TOOLS,
  };
  await emit({ type: "request_built", body: requestBody, ts: Date.now() });

  let narratorOutput = "";
  let status: RunResult["status"] = "complete";
  let errorMessage: string | undefined;
  const seenToolUse = new Set<string>();
  const pendingTool = new Map<string, { name: string; input: Record<string, unknown> }>();

  try {
    const q = query({
      prompt: promptString,
      options: {
        model: args.setup.model.id,
        systemPrompt: args.systemPrompt,
        mcpServers: { "tavern-catalog": mcp },
        allowedTools,
        disallowedTools: FILE_AND_BASH_TOOLS,
        permissionMode: "bypassPermissions",
        allowDangerouslySkipPermissions: true,
        includePartialMessages: true,
        maxThinkingTokens: args.setup.model.thinking_budget,
        abortController: args.abort,
        settingSources: [],
      },
    });

    for await (const message of q) {
      if (args.abort.signal.aborted) break;

      if (message.type === "stream_event") {
        const ev = message.event;
        if (ev.type === "content_block_delta") {
          const delta = ev.delta as { type: string; text?: string; thinking?: string };
          if (delta.type === "text_delta" && delta.text) {
            narratorOutput += delta.text;
            await emit({ type: "text_delta", text: delta.text, ts: Date.now() });
          } else if (delta.type === "thinking_delta" && delta.thinking) {
            await emit({ type: "thinking_delta", text: delta.thinking, ts: Date.now() });
          }
        }
      } else if (message.type === "assistant") {
        for (const block of message.message.content) {
          if (block.type === "tool_use" && !seenToolUse.has(block.id)) {
            seenToolUse.add(block.id);
            pendingTool.set(block.id, {
              name: block.name,
              input: block.input as Record<string, unknown>,
            });
            await emit({
              type: "tool_use",
              id: block.id,
              name: block.name,
              input: block.input as Record<string, unknown>,
              ts: Date.now(),
            });
          }
        }
      } else if (message.type === "user") {
        const content = message.message.content;
        if (typeof content === "string") continue;
        for (const block of content) {
          if (typeof block === "object" && block !== null && (block as { type?: string }).type === "tool_result") {
            const tr = block as { tool_use_id: string; content: unknown };
            const matched = pendingTool.get(tr.tool_use_id);
            const lastSearch =
              matched?.name === `${NARRATOR_MCP_PREFIX}search_world` ? searchCalls[searchCalls.length - 1] : undefined;
            await emit({
              type: "tool_result",
              id: tr.tool_use_id,
              output: tr.content,
              ...(lastSearch ? { searchCall: lastSearch } : {}),
              ts: Date.now(),
            });
          }
        }
      } else if (message.type === "result") {
        if (message.subtype !== "success") {
          status = "error";
          errorMessage = message.subtype;
        } else if (message.is_error) {
          status = "error";
          errorMessage = message.result || "result error";
        }
      }
    }

    if (args.abort.signal.aborted) {
      status = "cancelled";
      narratorOutput = "";
    }
  } catch (e) {
    if (args.abort.signal.aborted) {
      status = "cancelled";
      narratorOutput = "";
    } else {
      status = "error";
      errorMessage = e instanceof Error ? e.message : String(e);
      await emit({ type: "error", message: errorMessage, ts: Date.now() });
    }
  }

  const durationMs = Date.now() - startTs;
  await emit({ type: "done", durationMs, ts: Date.now() });

  return {
    narratorOutput,
    durationMs,
    searchCalls,
    events,
    requestBody,
    status,
    ...(errorMessage ? { errorMessage } : {}),
  };
};

export { composeSystemPrompt };
