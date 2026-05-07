# Tavern: build spec

This spec is the implementation contract for Tavern v2. It assumes the design-brief
(design-brief.md) as context and locks every decision needed to start building. Open
items at the end are explicit; nothing else should be invented at code time.

## 1. Locked decisions

| Concern | Decision |
| --- | --- |
| Frontend stack | React + Vite + TypeScript + Tailwind + Zustand |
| Backend stack | Node + Hono + TypeScript |
| Persistence | Server-side SQLite (single file) |
| ORM / migrations | Drizzle |
| LLM access | Claude Agent SDK, server-side, using existing `claude` OAuth |
| API auth | None — host's `~/.claude` OAuth credentials |
| Embeddings | Server-side; default `transformers.js` (local), optional API endpoint |
| Retrieval | Hybrid: BM25 lexical + embedding cosine similarity |
| Cue role | Searchable boost text (synonyms/aliases), not triggers |
| Connections | `brings` only; transitive with configurable depth cap; cycle-broken |
| Composition model | Agent-native (option B): SDK runs the loop; Tavern composes system prompt + recent Beats |
| Marks | Dropped |
| Pinned | Tale-level and Scene-level; Scene overrides Tale; rendered as system-generated lookup instructions |
| Active Directions ordering | Priority tiers (Absolute / Strong / Normal / Background) + manual order within tier |
| Tale switching | One active Tale; Cmd-K quick-switcher |
| Catalog finder | In-Catalog filter bar only |
| Anchor format | Free-form prose with optional Facets |
| Beat operations | Reroll, edit Narrator response in place, edit player input + regenerate |
| Beat storage | Full transcript |
| Branching beats | Out of scope at MVP |
| Streaming | SSE; cancel discards partial output |
| Default model | `claude-opus-4-7` |
| Model picker | Opus 4.7, Sonnet 4.6, Haiku 4.5 |
| Tags | Out of scope at MVP |
| Auto scene-break | Out of scope at MVP (manual only) |
| Promote action | Out of scope at MVP |
| Agent writes | Out of scope at MVP (read-only tools) |
| Backup scope | Catalog only |
| License | MIT |
| Branching/release | Per global instructions: `dev` integration, `main` protected, single CI; `feature/*` → `dev` → `main` |

## 2. Vision recap (one paragraph)

Tavern is a single-user, local-first, browser+server tool for telling stories with a
Claude Narrator. The user authors a Catalog of Directions (persistent stance) and World
entries (situational lore). When the user writes a Beat, the server composes a system
prompt from active Directions plus a Pinned-lookup block, hands the Agent SDK the recent
Beats as messages, and exposes the Catalog as MCP tools so Claude can fetch World on
demand. The corpus is portable; the loop is replaceable.

## 3. Architecture

```
┌─────────────────────────────────────┐
│ Browser (single user)               │
│                                     │
│  React + Vite + Tailwind + Zustand  │
│  Surfaces: Catalog · Play · Settings│
│  SSE consumer for Narrator stream   │
└──────────────┬──────────────────────┘
               │ HTTP + SSE (loopback)
┌──────────────▼──────────────────────┐
│ Node server (localhost)             │
│                                     │
│  Hono HTTP                          │
│  Drizzle + SQLite                   │
│  transformers.js (Xenova) embedding │
│  In-process MCP server (catalog)    │
│  Claude Agent SDK invocations       │
└─────────────────────────────────────┘
                    │
                    ▼
       ~/.claude (OAuth credentials,
       claude CLI managed)
```

- **Single user, single instance.** No accounts, no auth on the HTTP layer beyond a
  loopback bind. Server defaults to `127.0.0.1:5174`; client dev server proxies API.
- **Process model.** One Node process. The MCP server is in-process (registered to the
  Agent SDK at invocation time). The Agent SDK invocation is per-Beat.
- **OAuth.** The host machine must have `claude login` completed before starting Tavern.
  Settings shows OAuth status and a "re-login" affordance that runs the `claude login`
  flow in a child process.
- **No telemetry, no external sync.**

## 4. Repository layout

```
tavern-v2/
├── apps/
│   ├── client/        # React + Vite
│   └── server/        # Hono + Node
├── packages/
│   └── shared/        # Zod schemas, shared types, constants
├── design-brief.md
├── spec.md
├── package.json       # pnpm workspace
└── .github/workflows/ci.yml
```

- pnpm workspaces. Single `tavern` package published to npm; `apps/server` is the
  bin entry (`tavern serve`), `apps/client` builds into the server's static dir at
  publish time.
- TypeScript everywhere; strict mode.
- Vitest for tests.

## 5. Data model

SQLite. All IDs are ULIDs (lex-sortable, URL-safe). Timestamps are integer epoch ms.

### 5.1 Catalog tables

```
kinds                       -- fixed seed rows
  id           text pk      -- 'direction' | 'world'
  label        text

types                       -- user-defined within a kind
  id           text pk
  kind_id      text fk → kinds.id
  name         text          -- 'Voice', 'Genre', 'Guardrail', 'Character', ...
  position     int           -- ordering within kind
  created_at   int

entries
  id           text pk
  type_id      text fk → types.id
  name         text
  embedding_vec blob          -- f32 vector; null until indexed
  embedding_model text         -- model id used to produce vec; null/blank → reindex
  created_at   int
  updated_at   int
  unique(type_id, name)

facets
  id           text pk
  entry_id     text fk → entries.id (cascade delete)
  label        text          -- 'Description', 'Appearance', 'Secrets', ...
  body         text          -- markdown
  mode         text          -- 'always' | 'cue'
  position     int

cues                        -- per-entry searchable boost text
  id           text pk
  entry_id     text fk → entries.id (cascade)
  term         text          -- alias / synonym / surface form

connections
  id           text pk
  from_entry_id text fk → entries.id
  to_entry_id   text fk → entries.id
  kind         text          -- 'brings' (only kind at MVP)
  unique(from_entry_id, to_entry_id, kind)

direction_tier
  entry_id     text pk fk → entries.id
  tier         text          -- 'absolute' | 'strong' | 'normal' | 'background'
                             -- only meaningful for entries whose type.kind = 'direction'
                             -- default 'normal'
```

Notes:

- `mode` on facets is `always` (returned by `get_entry` unconditionally) or `cue`
  (returned only when the agent passes a matching cue argument; see §8.2).
- `direction_tier` is a side table rather than a column on `entries` because tiers are
  Direction-only.

### 5.2 Tales / Scenes / Beats / Setups

```
tales
  id           text pk
  name         text
  description  text
  anchor_prose text          -- free-form
  setup_id     text fk → setups.id
  active_scene_id text fk → scenes.id   -- null until first scene created
  created_at   int
  updated_at   int

anchor_facets               -- optional structured facets attached to tale anchor
  id           text pk
  tale_id      text fk → tales.id (cascade)
  scene_id     text fk → scenes.id null  -- null = tale anchor; non-null = scene anchor add-on
  label        text
  body         text
  mode         text          -- 'always' | 'cue' (parallels entry facets)
  position     int

scenes
  id           text pk
  tale_id      text fk → tales.id
  name         text
  anchor_prose text          -- appended to tale anchor when this scene is active
  adjustments_id text fk → setups.id null
  position     int
  created_at   int

setups                      -- used as Tale.setup or Scene.adjustments
  id           text pk
  scope        text          -- 'tale' | 'scene'
  data         json          -- see §5.3

pinned                      -- tale-level OR scene-level (mutually exclusive per row)
  id           text pk
  tale_id      text fk → tales.id null
  scene_id     text fk → scenes.id null
  entry_id     text fk → entries.id
  position     int
  check (tale_id is not null or scene_id is not null)

beats
  id           text pk
  scene_id     text fk → scenes.id
  position     int           -- ordering within scene
  player_input text
  narrator_output text        -- final assistant text (streamed result)
  status       text          -- 'streaming' | 'complete' | 'cancelled' | 'error'
  alts         json          -- array of {narrator_output, transcript_id, created_at} for rerolls
  active_alt   int           -- index into alts; -1 means current narrator_output is the live one
  created_at   int
  completed_at int

beat_transcripts            -- full per-Beat agent transcript (see §9)
  id           text pk
  beat_id      text fk → beats.id (cascade)
  alt_index    int           -- which alt this transcript belongs to (-1 = primary)
  request_body json          -- sanitized HTTP request that went to Claude
  events       json          -- ordered event log (system_prompt, tool_use, tool_result, thinking, text, done)
  search_calls json          -- enriched per-tool-call scoring data (see §8.4)
  model        text
  duration_ms  int
```

### 5.3 Setup data shape

`setups.data` (JSON, validated by Zod):

```ts
type SetupData = {
  // Active Directions: ordered within tier, tiers in fixed order
  directions: {
    absolute: string[];   // entry IDs, ordered
    strong: string[];
    normal: string[];
    background: string[];
  };
  model: {
    id: 'claude-opus-4-7' | 'claude-sonnet-4-6' | 'claude-haiku-4-5-20251001';
    temperature: number;       // default 1.0
    max_tokens: number;        // default 4096
    thinking_budget?: number;  // optional, default off
    system_prompt_append?: string;
  };
  retrieval: {
    enabled_types: string[];   // type IDs eligible for search_world
    max_results: number;       // default 8
    threshold: number;         // 0..1; results below excluded; default 0.25
    keyword_weight: number;    // default 0.4
    embedding_weight: number;  // default 0.6
    brings_depth: number;      // transitive cap; default 2; 0 disables expansion
  };
  tools: {
    search_world: boolean;          // default true
    get_entry: boolean;             // default true
    list_active_directions: boolean;// default true
    list_pinned: boolean;           // default true
  };
};
```

Scene adjustments are stored as a full `SetupData` (not a sparse delta). The composition
rule is **Scene replaces Tale**: if the Scene has an `adjustments_id`, that document is
the effective Setup for the Beat. Otherwise the Tale's Setup is used. Rationale: simpler
than diffing, and we already accept Scene-overrides-Tale semantics for Pinned.

### 5.4 Settings table (singleton)

```
settings (id=1 row)
  default_model           text
  default_temperature     real
  default_max_tokens      int
  embedding_provider      text   -- 'local' | 'api'
  embedding_model_local   text   -- e.g. 'Xenova/bge-small-en-v1.5'
  embedding_api_url       text   -- if provider='api'
  embedding_api_key       text   -- stored locally; never logged
  oauth_status            text   -- 'present' | 'missing' (cached; refreshed on Settings open)
```

## 6. Surfaces

Three top-level views; routed via the URL.

### 6.1 Catalog `/catalog`

Two-pane: type tree on the left, entry list / editor on the right. Filter bar atop the
entry list (name, type, with-cue-text). No Cmd-K palette; finder is in-Catalog only.

- Add/rename/delete Types per Kind (Direction, World).
- Entry editor: name; Facets (label, body, always|cue) reorderable; Cues (chip input);
  Connections (brings target picker); for Direction entries, tier selector.
- Embedding state shown per entry: ✓ indexed / pending / reindex needed (model changed).
- Bulk reindex action.

### 6.2 Play `/play`

Single active Tale. Layout:

- **Top**: Tale name, anchor preview, active Scene name, Setup summary (counts by tier,
  pinned count), `Switch Tale` (Cmd-K), `Settings` link.
- **Center**: Beat stream — past Beats rendered as alternating user/Narrator blocks;
  composer at bottom.
- **Right rail (collapsible)**: Setup controls — Direction toggles grouped by tier with
  drag-to-reorder; live changes are session-only until the user clicks "Save to Scene
  Adjustments" (button only enabled when there are unsaved changes). Pinned list editor
  (Tale or Scene, tab toggle). Retrieval/tools/model panels collapsed by default.
- **Bottom rail**: Debug panel (collapsible, off by default).

Cmd-K opens a Tales-only switcher. (No global Catalog palette per decision.)

Beat composer keys: Enter sends; Shift-Enter newline; Esc cancels active stream.

Per-Beat actions in the past-Beat list: reroll, edit Narrator (inline), edit player +
regenerate (inline; replaces all subsequent Beats? — see Open Items §15).

### 6.3 Settings `/settings`

Sections:

- **Provider**: OAuth status (`✓ logged in as <profile>` / `✗ not logged in`). Button:
  "Re-run claude login" — server runs the CLI and surfaces output.
- **Defaults**: default model, default temperature, default max_tokens, default thinking
  budget. New Tales pick these up; existing Tales unaffected.
- **Embeddings**: provider toggle (local | api). Local model picker (`bge-small`,
  `all-MiniLM-L6-v2`, custom). API endpoint URL + key. "Reindex all" action; warns if
  switching models.
- **Storage**: SQLite file path (read-only display). Backup → download `tavern-catalog-<ts>.json`.
  Restore → file picker; merge or replace dialog.
- **About**: version, license, link to design-brief.

## 7. Narrator agent loop

Per-Beat. Ephemeral.

### 7.1 High-level

1. Client POSTs `/api/tales/:id/beats` with `{ player_input }`.
2. Server creates a `beats` row (status `streaming`).
3. Server resolves the effective Setup (Scene adjustments if present, else Tale Setup).
4. Server composes the system prompt (§7.2) and the message list (§7.3).
5. Server constructs the MCP tool surface (§8) honoring `setup.tools.*` flags.
6. Server invokes the Claude Agent SDK with system prompt, messages, tools, model+gen
   params. Streams events over SSE to the client.
7. As Claude emits text deltas, server appends them to a buffer and forwards.
   On done: persist `narrator_output`, mark `complete`, write the `beat_transcripts` row.
8. On client cancel (EventSource close → server detects → SDK abort): `narrator_output`
   is wiped, status set to `cancelled`. (Per "can't keep partial.")

### 7.2 System prompt composition

Regenerated every turn. Layout:

```
<stance preamble — fixed string>
You are the Narrator: a game-master, never a character. The user plays; you tell.
Maintain that wall.

<absolute>
{{for each entry in setup.directions.absolute, in order}}
- {{entry.name}}: {{flatten always-on facets, joined by " — "}}
{{end}}

<strong>
{{same for setup.directions.strong}}

<style>
{{same for setup.directions.normal}}

<background>
{{same for setup.directions.background}}

<anchor>
Tale: {{tale.anchor_prose}}
{{flatten tale anchor_facets where mode='always'}}
{{if scene}}Scene: {{scene.anchor_prose}}{{flatten scene anchor_facets where mode='always'}}{{end}}

<pinned-lookups>
{{compose from §7.4}}

<system_prompt_append (if any)>
```

Direction tier headers are fixed strings (`Absolute rules:`, `Strong guidance:`,
`Style:`, `Background:`) — wired into the composer; not editable. Empty tiers
omit their header entirely.

### 7.3 Message history

The recent Beats from the active Scene are rendered as alternating user/assistant
messages, oldest first. Tool-call blocks from prior Beats are not replayed. A
configurable window (default: last 30 Beats from the active Scene; spills back into
prior Scenes if shorter) caps history; older Beats truncate (hard cut, not summary —
summarization is post-MVP).

The current Beat's `player_input` is the trailing user message.

### 7.4 Pinned lookup block

If the active Scene has any `pinned` rows, **only** those render. Otherwise the Tale's
`pinned` rows render. Format (system-generated, fixed phrasing):

```
Before this turn, ensure you have these in context. If you don't, call get_entry first:
- {{entry.name}} (id: {{entry.id}}) — {{type.name}}
- ...
```

Empty list → block omitted.

### 7.5 Agent invocation

Use `query()` from `@anthropic-ai/claude-agent-sdk`. Pass:

- `systemPrompt: { type: 'preset', preset: 'claude_code' }` — **NO**. Use `customSystemPrompt`
  to fully replace, since Tavern's stance is not Claude Code's.
- `appendSystemPrompt`: empty.
- `mcpServers`: in-process MCP server, registered programmatically.
- `model`: from setup.
- `permissionMode: 'bypassPermissions'` — all tools are read-only and our own; no need to
  prompt the user.
- `disallowedTools`: file/bash tools blocked explicitly. The Narrator must not have
  Read/Write/Bash even if the SDK provides them by default.

### 7.6 Cancellation

Client closes the SSE stream → server closes the SDK iterator → SDK aborts the in-flight
Anthropic call. The `beats` row is marked `cancelled`; partial text is discarded.

## 8. MCP tool surface

In-process MCP server. Read-only at MVP. Each tool definition includes a Zod schema; we
generate the JSON schema for MCP from it.

### 8.1 `search_world`

```ts
input: {
  query: string;             // free text the agent wants to look up
  types?: string[];          // optional filter to type IDs; defaults to setup.retrieval.enabled_types
  max_results?: number;      // defaults to setup.retrieval.max_results
  cue?: string;              // optional context cue to fetch matching `cue`-mode facets
}
output: {
  results: Array<{
    id: string;
    name: string;
    type: string;
    score: number;            // 0..1 final blended score
    facets: Array<{ label: string; body: string; mode: 'always' | 'cue' }>;
                              // 'cue' facets included only if input.cue matched
    brings: string[];         // entry IDs surfaced by transitive `brings` walk
  }>;
}
```

Scoring (server side):

1. **Lexical (BM25)** over the concatenation `name + cues.term[] + always-on facet bodies`.
2. **Embedding cosine** between query embedding and entry embedding.
3. Final = `keyword_weight * normalized_bm25 + embedding_weight * cosine`.
4. Filter by `score >= setup.retrieval.threshold`.
5. Take top `max_results`.
6. **Brings expansion**: transitively walk `brings` from each result up to
   `setup.retrieval.brings_depth`; cycle-broken; expanded entries appended (not
   re-scored) and listed in `brings`.

### 8.2 `get_entry`

```ts
input: {
  id?: string;
  name?: string;     // case-insensitive exact match within an optional type
  type?: string;
  cue?: string;      // returns 'cue'-mode facets matching this cue
}
output: {
  id: string;
  name: string;
  type: string;
  facets: Array<{ label: string; body: string; mode: 'always' | 'cue' }>;
  brings: Array<{ id: string; name: string; type: string }>;
}
```

`cue` matching: a facet with `mode='cue'` is included if the cue argument matches one of
the entry's `cues.term` values (case-insensitive substring), or matches the facet's own
embedded label (server-side semantic fallback). Always-on facets always included.

### 8.3 `list_active_directions` / `list_pinned`

Both straightforward read-throughs of the effective Setup / Pinned. Used by the agent to
introspect; off by default for stricter "discover-style" Tales is configurable in Setup.

### 8.4 Search call provenance

Every `search_world` invocation persists into `beat_transcripts.search_calls`:

```ts
{
  query: string;
  candidates: Array<{
    entry_id: string;
    bm25: number;
    embedding_sim: number;
    blended: number;
    selected: boolean;
  }>;
  brings_added: string[];
}
```

Surfaced verbatim in the Debug panel.

## 9. Streaming protocol (SSE)

`POST /api/tales/:id/beats` with `{ player_input: string, regenerate_of?: string }`.
Returns `text/event-stream`. Events:

| event | data | when |
| --- | --- | --- |
| `beat_started` | `{ beat_id }` | row created |
| `system_prompt` | `{ text }` | composed prompt; debug panel consumes |
| `request_built` | `{ request_body }` | sanitized HTTP body bound for Claude |
| `tool_use` | `{ id, name, input }` | agent invokes a tool |
| `tool_result` | `{ id, output, search_call? }` | tool returns; `search_call` present for `search_world` |
| `thinking_delta` | `{ text }` | thinking content (if model emits it) |
| `text_delta` | `{ text }` | assistant text delta |
| `done` | `{ duration_ms }` | final; row marked `complete` |
| `error` | `{ message, code }` | aborted/failed |

Client reroll/edit endpoints:

- `POST /api/beats/:id/reroll` → same SSE stream; persists new alt.
- `PATCH /api/beats/:id` → `{ narrator_output }` for in-place edit (no SSE).
- `POST /api/beats/:id/regenerate` → `{ player_input }`; SSE; replaces this Beat
  forward (see §15 open item).

## 10. Embeddings

- **Local default**: `transformers.js` (Xenova) running in-process. Default model
  `Xenova/bge-small-en-v1.5` (384-dim). Cached under server data dir on first use.
- **API option**: any OpenAI-compatible `/v1/embeddings` endpoint. URL + key in Settings.
  Stored encrypted-at-rest (libsodium secretbox; key derived from a random per-install
  secret). Logged outputs never include the key.
- **Storage**: vector stored as f32 LE blob; `embedding_model` column is the model id
  used. Changing models invalidates vectors → "Reindex all" action.
- **Indexing**: on entry create/update, recompute. Debounced 1s in the editor.
- **Query embedding**: computed at search time; not cached (queries are open-ended).

## 11. Beat operations

### 11.1 Reroll

- Push current `narrator_output` to `alts`.
- Clear `narrator_output`, status → `streaming`, `active_alt = -1`.
- Re-run §7 with same `player_input`; on done, the new output becomes live; alts grow.
- UI shows `‹ 2 / 3 ›` controls on Beats with alts; switching writes `active_alt`.

### 11.2 Edit Narrator response in place

- `PATCH /api/beats/:id` with new text.
- No regeneration. Replaces `narrator_output`; transcript not altered (alts get a
  marker `edited_at`).

### 11.3 Edit player input + regenerate

- Updates `player_input`.
- All Beats *after* this one in the Scene are deleted (with confirm dialog). Branching is
  out of scope at MVP.
- Re-runs §7 from this Beat.

## 12. Backup / restore (Catalog only)

`GET /api/backup` → JSON file:

```json
{
  "tavern_backup_version": 1,
  "exported_at": 1730000000000,
  "kinds": [...],          // included for resilience; ignored on import (fixed seed)
  "types": [...],
  "entries": [...],
  "facets": [...],
  "cues": [...],
  "connections": [...],
  "direction_tiers": [...]
}
```

`POST /api/restore` accepts the same shape, with a `mode: 'merge' | 'replace'` flag.
- `merge`: types matched by `(kind_id, name)`; entries by `(type_id, name)`.
  Existing rows updated, new rows inserted. Cues/facets/connections re-synced for matched
  entries.
- `replace`: drops all rows in the seven Catalog tables, then inserts.

Tales/Scenes/Beats/Settings are never exported or imported.

## 13. Performance and density targets

- Tens of types per Kind, hundreds of entries per type → ~10⁴ entries worst case.
- Hundreds of Tales; thousands of Beats per long-running Tale → ~10⁶ beats lifetime.
- BM25 over Catalog: sqlite FTS5 virtual table mirroring `entries` searchable columns.
- Embedding ANN: at this scale, brute-force cosine over f32 vectors is fine
  (10⁴ × 384 dims × 4 bytes ≈ 15 MB in memory). Re-load on server start; mutate on
  entry write. No external vector DB.
- Recent-Beats window (default 30) keeps per-turn payload bounded.

## 14. Out of scope (MVP)

- Promote action.
- Tags.
- Auto scene-break suggestion.
- Branching alt timelines (only flat alts per Beat).
- Agent writes to Catalog.
- Multi-character / multiplayer.
- Cross-Tale search.
- History summarization once recent-window overflows.
- PWA / mobile layouts.
- Tauri/Electron desktop wrapper.
- Provider abstraction beyond Claude.

## 15. Open items still requiring a decision

These are not blocking the start of work but should be resolved before the affected
surface is implemented.

1. **Edit-player-input regenerate semantics.** §11.3 currently drops all subsequent Beats
   with a confirm dialog. Alternatives: (a) keep subsequent Beats as a separate alt
   timeline (would require lifting the no-branching constraint just here), (b) hard-block
   regenerate when there are subsequent Beats. Recommend confirming the drop-all behavior.
2. **Embedding model defaults at first run.** First start with `bge-small-en-v1.5`
   (~30 MB download) silently, or surface a one-time "embeddings will download X MB"
   modal? Recommend the modal.
3. **`claude login` UX from server.** Spec says child process with output surfaced; we
   need to confirm whether the server can forward the auth flow's interactive prompt
   into a browser-side panel cleanly, or whether we tell the user to run it in a
   terminal. The latter is simpler for MVP.
4. **Anchor-Facet `cue` mode under composition.** Anchor facets currently support
   `mode='cue'`. They have no analog to entry cues (no `cues` table for anchor facets).
   Either drop `mode='cue'` from anchor facets at MVP, or add an `anchor_facet_cues`
   table. Recommend dropping at MVP.
5. **Inactive-Direction visibility.** The Setup right-rail currently shows tiers and
   active toggles. Should inactive Directions appear in the same view (greyed) for
   one-click toggling, or be hidden behind a "+ Add" picker? Recommend greyed visible.
6. **Recent-Beats window: hard cut vs sliding by token count.** Default is 30 Beats.
   Should this be configurable per Setup? Recommend yes — add `setup.history.max_beats`.
7. **OAuth re-login flow.** If the user's `claude` CLI credentials expire mid-session,
   the SDK call will fail. We need a defined error mapping (server → SSE `error` event)
   and a UI prompt to re-authenticate. Spec calls for a generic error event; the
   re-auth flow should be designed before Settings is shipped.

## 16. Build, CI, publishing

Per global instructions:

- Branches: `main` (protected, PRs review by Gemini Code Assist + Copilot), `dev`
  (integration), `feature/*` from `dev`.
- Single workflow `ci.yml` with `test` → `publish`.
- Push to `dev` → `npm publish --tag dev`, version suffixed `-dev.<run_number>`.
- Push to `main` → `npm publish --tag latest`, git tag, GitHub Release, `dev` reset to
  `main`.
- Test job runs `pnpm typecheck` + `pnpm test` for both `apps/client` and `apps/server`.

Published package: a single binary `tavern` that starts the server with the static
client built in.

## 17. Milestones

A reasonable order to stand this up:

1. **M0 — skeleton.** Repo, pnpm workspace, Hono server with health endpoint, React
   client serving from server in production build, Drizzle migrations harness.
2. **M1 — Catalog surface.** Schema + CRUD + Catalog UI + Cues + Facets + Connections.
   No embeddings yet.
3. **M2 — Embeddings & search.** transformers.js wired in, FTS5, scoring, "Reindex all".
   Search exposed as a debug-only endpoint.
4. **M3 — Tales/Scenes/Setups.** Tale + Scene CRUD, Setup editor (Directions, Pinned,
   model/gen params, retrieval defaults).
5. **M4 — Narrator loop.** MCP tools (`search_world`, `get_entry`,
   `list_active_directions`, `list_pinned`); SDK invocation; SSE; Beat creation + debug
   panel.
6. **M5 — Beat ops.** Reroll, edit Narrator, edit player + regenerate.
7. **M6 — Settings + backup/restore.** OAuth status, embeddings config, defaults,
   Catalog export/import.
8. **M7 — Polish.** Cmd-K Tale switcher, keyboard shortcuts, visual density pass.
