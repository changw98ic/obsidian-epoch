# Repository Guidelines

## Project Structure

This repository is an Obsidian worldbuilding vault and an Agent MMO. Source Markdown lives in `00_总览/` through `09_素材与图片/`; architecture and operations notes are under `docs/`. Runnable code is under `tools/`:

- `tools/graph-react-app/` contains the React 19/Vite/Three.js map and Agent Console. UI code is in `src/`, Agent panels/controllers/tests in `src/agent/`, and policy checks in `scripts/`.
- `tools/agent-server/` contains the TypeScript HTTP/MCP server. `lib/epoch/` is the game engine, `test/` holds server tests, `deploy/` holds container/proxy files, and `package/` contains distributable MCP/Skill artifacts.
- `tools/*.py` contains vault import, map-data generation, and rendering utilities.

## Build, Test, and Development

Use Node.js 24 and run npm commands from `tools/graph-react-app`:

```bash
npm ci                         # install locked dependencies
npm run agent:server           # world service on :8787
npm run dev                    # Vite on :5173; proxies /api, /epoch, /mcp
npm test                       # server, batch, UI, and script tests
npm run typecheck              # source-policy and TypeScript gates
npm run build:container        # CI-safe build without media copying
```

Before submitting, run `npm run world-map-data:check` and `npm run agent:world-content:check`. After changing source Markdown, regenerate with `npm run world-map-data:generate` and `npm run agent:world-content:compile`.

## Coding Style and Testing

Use TypeScript/TSX for app, server, MCP, and test code; Python is for vault tooling. Follow the existing two-space, semicolon, double-quote style. Keep strict types, avoid explicit `any`, and narrow `unknown`. Use PascalCase for React components, camelCase for functions and variables, and `*.test.ts` for tests. There is no standalone formatter or linter; `npm run typecheck` runs the enforced source-policy checks. Tests use Node’s built-in `node:test` through `tsx`; server tests are in `tools/agent-server/test/`, with UI/script tests beside their sources. Run targeted tests with `node --import tsx --test <file>`; use `--test-concurrency=1` when reproducing CI ordering.

## Generated Files, Assets, and Safety

Treat source Markdown as authoritative. Commit regenerated map data and the Skill-package registry whenever their inputs change. `09_素材与图片/ChatGPT批量生成/object-storage-manifest.json` is the media authority; do not add raw media outside that workflow. Do not commit `node_modules/`, `dist/`, `tools/agent-server/data/`, `.omc/`, or generated `00_总览` HTML/assets/data. Run `npm run check:repository-import` before a PR; it enforces size, runtime-state, generated-file, and secret checks. Use `.env.example` for deployment configuration and keep secrets local.

## Commits and Pull Requests

Use imperative commit subjects without a prefix or scope, for example `Update agent explorer inventory panels`. PRs should explain intent, list verification commands, identify regenerated artifacts, link related issues when applicable, and include screenshots for UI changes.
