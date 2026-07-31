# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

黑曜纪元 (Obsidian Epoch) is a server-authoritative agent MMO combining:
- **Obsidian worldbuilding vault** — Markdown lore (races, factions, creatures, locations, events, relationships)
- **React 3D frontend** — Vite + React 19 + Three.js world map and Agent Console
- **Agent MMO server** — Node.js HTTP/MCP server with SQLite persistence, event-sourced architecture
- **Distributable MCP/Skill packages** for Claude Code, Codex, Cursor, Hermes, OpenClaw
- **Python tooling** — data generation, import, and rendering scripts

All runnable code lives under `tools/`. The repo root is an Obsidian vault.

## Commands (run from `tools/graph-react-app`)

```bash
npm ci                        # install (lockfile-only)
npm run typecheck             # full gate: import audit, asset manifest, no-JS, no-any, strict-serial, tsc x4
npm test                      # agent + batch + UI tests (node:test via tsx)
npm run agent:server          # local world service on :8787
npm run dev                   # Vite dev server on :5173 (proxies /api /epoch /mcp to :8787)
npm run build:container       # CI-safe build (no media copy); prefer this over `npm run build`
npm run world-map-data:check  # fails if world-map-data.json is stale vs source Markdown
npm run world-map-data:generate  # regenerate map data after editing vault Markdown
npm run agent:world-content:check  # fails if Skill-package registry JSON is stale
npm run agent:world-content:compile  # regenerate registry after editing world docs
```

### Running tests

```bash
# All tests (from tools/graph-react-app)
npm test

# Agent server tests only
node --import tsx --test --test-concurrency=1 ../agent-server/test/*.test.ts

# Single test file
node --import tsx --test ../agent-server/test/<name>.test.ts

# UI/script tests only
node --import tsx --test src/agent/*.test.ts scripts/*.test.ts
```

Tests use **Node.js built-in test runner** (`node:test` + `node:assert/strict`), not Jest/Vitest. Tests import `.ts` source directly via tsx loader — no build step needed. CI runs serially (`--test-concurrency=1`); match that when debugging flaky ordering.

## Architecture

### Three-tier structure

```
tools/
├── graph-react-app/     # React frontend + package.json (all npm scripts live here)
│   ├── src/             # React app source (App.tsx, GraphScene.tsx, WorldMapScene.tsx)
│   ├── src/agent/       # Agent Console UI (controllers, components, tests)
│   └── scripts/         # Build/QA scripts (import checks, asset validation, visual QA)
├── agent-server/        # Authoritative MMO server (runs via tsx, no separate package.json)
│   ├── server.ts        # HTTP server entry point
│   ├── mcp.ts           # MCP stdio adapter entry
│   ├── lib/             # Core modules (78+ files)
│   │   ├── epoch/       # Game engine: event sourcing, combat, bounties, world simulation (212 files)
│   │   ├── http/        # HTTP route handlers (25 files)
│   │   └── *.ts         # Domain modules (community, factions, lore, attestation, maintenance)
│   ├── test/            # 213 test files (node:test)
│   ├── data/            # SQLite runtime state (gitignored, append-only)
│   ├── deploy/          # Docker Compose, Dockerfile, Caddyfile, systemd units
│   └── package/         # Distributable MCP/Skill packages
└── *.py                 # Python vault tooling (world map builder, biology library, creature rendering)
```

### Key architectural patterns

- **Server-authoritative**: Server holds world truth, identity, resources, NPC state. Clients (MCP, Web UI) are untrusted by default.
- **Event-sourced**: Core engine in `lib/epoch/` uses causal contracts, event store, invariant validation, snapshot migration.
- **Trust classes**: `untrusted_client`, `user_verified_web`, `server_hosted_agent`, `host_attested`, `remote_attested_runner`.
- **Strict TypeScript**: `tsconfig.json` enforces strict mode, noImplicitAny, noUncheckedIndexedAccess. Separate configs for agent-server (`tsconfig.agent-server.json`) and tests.

### Frontend

- React 19 + Vite 7 + Three.js — 3D force-directed graph and world map visualization
- Vite dev server proxies `/api`, `/epoch`, `/mcp` to agent server on `:8787`
- Start `agent:server` before `npm run dev`

## Hard Rules (CI-enforced gates)

- **TypeScript only.** No `.js`/`.jsx`/`.mjs`/`.cjs` source files. Python is allowed for vault tooling.
- **No explicit `any`.** Use `unknown` + narrowing or a proper type.
- **Strict serial validation.** World-content registry and map-data JSON must be regenerated and committed when source Markdown changes.
- **No files >10 MiB.** Run `npm run check:repository-import` before first commit or PR.
- **Asset manifest authority.** `09_素材与图片/ChatGPT批量生成/object-storage-manifest.json` is the Git-truth for media. Don't commit raw media outside the manifest workflow.

## Commit Style

Imperative mood, no prefix/scope convention:
- "Implement authoritative Phase 6 runtime and acceptance gates"
- "Update agent explorer inventory/resource panels and shared types"

## Gotchas

- `npm run build` calls Python (`build_world_map_data.py`) and copies multi-GB media — prefer `build:container` for verification.
- `world-map-data.json` uses a fixed `generatedAt` of `1970-01-01T00:00:00Z` for determinism; pass `--generated-at` for release tagging.
- The repo root is an Obsidian vault; `00_总览/` is both vault content and web build output target. Don't commit generated HTML/assets there.
- `tools/agent-server/data/` is append-only runtime state — never commit it.


<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:6cd5cc61 -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

**Architecture in one line:** issues live in a local Dolt DB; sync uses `refs/dolt/data` on your git remote; `.beads/issues.jsonl` is a passive export. See https://github.com/gastownhall/beads/blob/main/docs/SYNC_CONCEPTS.md for details and anti-patterns.

## Agent Context Profiles

The managed Beads block is task-tracking guidance, not permission to override repository, user, or orchestrator instructions.

- **Conservative (default)**: Use `bd` for task tracking. Do not run git commits, git pushes, or Dolt remote sync unless explicitly asked. At handoff, report changed files, validation, and suggested next commands.
- **Minimal**: Keep tool instruction files as pointers to `bd prime`; use the same conservative git policy unless active instructions say otherwise.
- **Team-maintainer**: Only when the repository explicitly opts in, agents may close beads, run quality gates, commit, and push as part of session close. A current "do not commit" or "do not push" instruction still wins.

## Session Completion

This protocol applies when ending a Beads implementation workflow. It is subordinate to explicit user, repository, and orchestrator instructions.

1. **File issues for remaining work** - Create beads for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **Handle git/sync by active profile**:
   ```bash
   # Conservative/minimal/default: report status and proposed commands; wait for approval.
   git status

   # Team-maintainer opt-in only, unless current instructions forbid it:
   git pull --rebase
   git push
   git status
   ```
5. **Hand off** - Summarize changes, validation, issue status, and any blocked sync/commit/push step

**Critical rules:**
- Explicit user or orchestrator instructions override this Beads block.
- Do not commit or push without clear authority from the active profile or the current user request.
- If a required sync or push is blocked, stop and report the exact command and error.
<!-- END BEADS INTEGRATION -->
