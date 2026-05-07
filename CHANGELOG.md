# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project follows
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- Migrated stack from pnpm + Hono workspaces (Node) to Bun 1.3.x workspaces.
- Server runtime: `@hono/node-server` → `Bun.serve`; `better-sqlite3` →
  `bun:sqlite` with `drizzle-orm/bun-sqlite`.
- `@huggingface/transformers` 3 → 4. The synchronous embedder preload before
  `serve()` is no longer required under `Bun.serve`.
- `@tavern/shared` is now consumed as TypeScript source via the workspace; the
  prebuild `dist/` step is gone.
- Tooling: biome (lint/format), knip (unused exports), dependency-cruiser
  (architecture rules), husky + lint-staged + commitlint, vitest at the root,
  `.tool-versions` pinning bun.

### Removed
- `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `tsconfig.base.json`, per-package
  `composite`/`references` setups, the `@hono/node-server` dependency,
  `better-sqlite3`, `tsx`, and the unused `@modelcontextprotocol/sdk` runtime
  dependency on the server.

## [0.1.0] - 2026-05-07

### Added
- M0: pnpm workspace skeleton (server + client + shared).
- M1: Catalog (kinds/types/entries/facets/cues/connections/direction tiers) with
  three-pane editor.
- M2: Embeddings (bge-small q8 via `@huggingface/transformers`) + hybrid search
  (FTS5 + cosine) with `brings` expansion.
- M3: Tales / Scenes / Setups with Setup, Pinned, Anchor, and Scenes editors.
- M4: Narrator loop — in-process MCP server with four read-only tools, system
  prompt composer, Claude Agent SDK runner, SSE Beats.
- M5: Beat ops — reroll, edit-narrator, edit-player + regenerate, alt
  navigator.
- M6: Settings + Catalog backup/restore (Zod-validated, child-row ids
  regenerated on merge).
- M7: Polish — Cmd-K Tale switcher, global Esc cancel, single-binary publish
  via `copy-client.mjs`, CI publish workflow.
