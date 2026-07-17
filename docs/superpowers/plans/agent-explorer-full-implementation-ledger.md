# Agent Explorer Full Implementation Ledger

## Current Phase

Completed local core implementation; agent-facing MCP correction recorded.

## Source Of Truth

- `docs/superpowers/specs/2026-06-23-agent-explorer-shared-world-spec.md`
- `docs/superpowers/specs/2026-06-23-agent-explorer-shared-world-strict-serial-validation.md`
- `docs/superpowers/plans/2026-06-24-agent-explorer-mvp-implementation.md`

## Non-Negotiable Constraints

- No login requirement.
- Model credentials belong to the user's own agent host/MCP client; the world server must not ask for, proxy, receive, or persist them.
- The server must reject or redact API-key-looking text before persistence.
- Client-provided scores, rewards, claim slots, and world-impact flags are not trusted.
- Demo/private runs must not create public world records.
- Public lore changes require server adjudication, source attribution, dedupe, and conflict handling.

## Completed Modules

- Branch isolation: implementation work is on `codex/agent-explorer-full`.
- Phase 1 server skeleton:
  - `tools/agent-server/server.mjs`
  - `tools/agent-server/lib/store.mjs`
  - `tools/agent-server/lib/tickets.mjs`
  - `tools/agent-server/lib/adjudicator.mjs`
  - `tools/agent-server/lib/safety.mjs`
- Phase 1 server tests:
  - `tools/agent-server/test/tickets.test.mjs`
  - `tools/agent-server/test/adjudicator.test.mjs`
- Phase 1 frontend shell:
  - `tools/graph-react-app/src/agent/AgentExplorer.jsx`
  - `tools/graph-react-app/src/agent/agentTypes.js`
  - `tools/graph-react-app/src/agent/localIdentity.js`
  - `tools/graph-react-app/src/agent/demoRun.js`
  - `tools/graph-react-app/src/agent/api.js`
  - `tools/graph-react-app/src/agent/AgentExplorer.css`
- Existing map shell now has an `Agent 探索` entry button and can return to the map.
- Runtime JSONL data is ignored via `.gitignore`.
- Phase 2 public context package:
  - `tools/agent-server/lib/contextPackage.mjs`
  - `tools/agent-server/test/context.test.mjs`
  - `POST /api/context/package`
  - Context package exposes only public world context, mandate boundaries, authorization constraints, and output contract.
  - Context package states `modelAccess: external_agent_hosted` and `credentialHandling: not_collected_by_world_server`.
  - The world server never brokers model calls; external agents call their own model stack and submit redacted battle reports.
- Phase 3 lore claim pipeline:
  - `tools/agent-server/lib/lore.mjs`
  - `tools/agent-server/test/lore.test.mjs`
  - `POST /api/runs/submit` now admits public review-candidate claims into a server-side lore ledger.
  - `GET /api/lore/public` exposes canonical/disputed claims, conflicts, and source rewards.
  - Exact duplicate claims merge into the original claim instead of duplicating public lore.
  - Conflicting same-subject/same-predicate claims become disputed and create an open conflict edge.
  - Claims beyond server-awarded slots become `shadow`.
  - Incomplete claims are rejected before consuming slots.
  - Source attribution is stored per claim source.
  - Reuse of another explorer's exact claim creates a source reward event.
- Phase 4 progression controls:
  - `tools/agent-server/lib/progression.mjs`
  - `tools/agent-server/test/progression.test.mjs`
  - Public review-candidate runs can award faction reputation.
  - Private/demo and failed runs do not advance public progression.
  - Daily faction reputation is capped at 25 points per explorer/faction.
  - Rank thresholds: outsider, field_agent, operator, high_clearance.
  - External item limits are rank-gated.
  - High-rank operations such as `create_faction` and `core_lore_claim` are rank-gated.
  - Different factions unlock different traits.
  - `GET /api/progression/state` returns explorer progression state.
  - `GET /api/progression/check` evaluates operation gates.
- Phase 5 player-created faction path:
  - `tools/agent-server/lib/factions.mjs`
  - `tools/agent-server/test/factions.test.mjs`
  - Faction proposals require operator rank before proposal legality is evaluated.
  - Valid proposals enter `trial` with a deterministic legitimacy score.
  - Proposals must include name, setting, goal, conflict boundary, evidence run tickets, and origin claim ids.
  - Trial factions become `accepted` after the supporter threshold is met.
  - Duplicate faction proposals merge into the existing faction rather than creating another faction.
  - Accepted factions can be referenced by later runs.
  - `POST /api/factions/propose`, `POST /api/factions/support`, `POST /api/factions/reference`, and `GET /api/factions/public` are available.
- Phase 6 feedback and repair loop:
  - `tools/agent-server/lib/feedback.mjs`
  - `tools/agent-server/test/feedback.test.mjs`
  - Submit responses now include server-generated feedback.
  - Failed runs receive repair guidance and a resubmission path.
  - Repair tickets are created for repairable failed runs.
  - Successful runs surface concrete rewards.
  - Claim reuse and faction status changes can generate feedback events.
  - `GET /api/feedback/repair`, `GET /api/feedback/events`, and `GET /api/feedback/digest` are available.
- Phase 7 public world browser and community hooks:
  - `tools/agent-server/lib/community.mjs`
  - `tools/agent-server/test/community.test.mjs`
  - Public world browser index with summaries, public run archive, claim details, conflict details, faction details, and source graph.
  - Private/demo runs are filtered out of the public archive.
  - Source graph exposes run/claim/conflict/faction nodes and typed edges.
  - Reactions update per explorer/target rather than duplicating votes.
  - Comments and moderation flags create reviewable discussion hooks.
  - `GET /api/world/browser`, `GET /api/world/runs`, `GET /api/world/source-graph`, `GET /api/world/claims/:id`, `GET /api/world/conflicts/:id`, and `GET /api/world/factions/:id` are available.
  - `POST /api/community/reaction`, `POST /api/community/comment`, and `POST /api/community/flag` require `Authorization: Bearer <player-token>`; their actor is derived from that token and any request-body `explorerId` is ignored. Missing bearer credentials return `401 community_auth_required`; malformed, expired, or revoked credentials return `403 community_auth_invalid`. `GET /api/community/thread` remains public and read-only, but omits `hidden_pending_review` reactions from its returned reactions, counts, and attention score. `GET /api/community/moderation` requires `x-epoch-operator-key` and returns `403 operator_key_required` without a valid configured operator key.
  - Frontend Agent Explorer can load public world index and source graph counts.
- Phase 8 gated audio/TTS experience:
  - `tools/agent-server/lib/experience.mjs`
  - `tools/agent-server/test/experience.test.mjs`
  - Custom TTS unlocks only after completed-story threshold.
  - Voice profile selection is blocked before unlock and allowed after unlock.
  - New users receive quiet audio defaults.
  - Faction-specific sound styles are deterministic.
  - Settlement and rating reveal effects vary by score band.
  - `GET /api/experience/state`, `POST /api/experience/voice`, and `GET /api/experience/sound-style` are available.
- Phase 9 transparency and optional anchoring:
  - `tools/agent-server/lib/transparency.mjs`
  - `tools/agent-server/test/transparency.test.mjs`
  - Deterministic record hashing.
  - Public verification records exclude API keys and transcript text.
  - Append-only hash chain verifies.
  - Export bundle includes entries, proof, and anchors without private payloads.
  - Optional manual anchor records root hash without requiring a blockchain.
  - `GET /api/transparency/verify`, `GET /api/transparency/export`, and `POST /api/transparency/anchor` are available.
- Phase 10 agent-facing MCP correction:
  - `tools/agent-server/lib/mcpTools.mjs`
  - `tools/agent-server/mcp.mjs`
  - `tools/agent-server/test/mcp.test.mjs`
  - Stdio MCP server handles `initialize`, `tools/list`, and `tools/call`.
  - MCP tool registry exposes `agent_world.context_package`, `agent_world.start_run`, `agent_world.submit_battle_report`, `agent_world.public_world`, `agent_world.progression_state`, `agent_world.operation_check`, community tools, and transparency verification.
  - MCP input schemas do not expose `apiKey` or BYOK fields.
  - MCP submit path rejects secret-shaped text before adjudication.
  - Frontend Agent Explorer is now a world-service/MCP status panel, not a browser model-calling tool.
  - Removed browser provider adapter, transcript parser, browser delegation code, and their tests.

## In Progress

No active implementation phase.

## Pending Modules

- No remaining core phase module is pending in the local implementation.
- Production hardening remains outside this local implementation pass: database persistence, deployment, authless abuse limits, hosted MCP transport, and live MCP-host integration testing.

## Acceptance Evidence

- Phase 1 server tests:
  - Command: `rtk npm --prefix tools/graph-react-app run agent:test`
  - Result: 8 tests passed, 0 failed.
- Phase 1 frontend build:
  - Command: `rtk npm --prefix tools/graph-react-app run build`
  - Result: Vite build succeeded; world-map data was regenerated and copied to `dist/data/world-map-data.json`.
  - Note: Vite reported a large chunk warning for the existing bundled app.
- Phase 1 HTTP run loop:
  - Health: `GET /api/health` returned `200 {"ok":true,"service":"agent-server"}`.
  - Start/submit: `POST /api/runs/start` issued a run ticket; `POST /api/runs/submit` returned score `73`, `trustedClientScore: false`, and `worldImpact: private_demo`.
  - Secret rejection: submitting an `sk-proj-...` shaped value returned HTTP 400 with `api_key_detected`.
- Superseded browser-provider check:
  - The earlier browser model-calling flow was removed after the architecture correction.
  - Current acceptance must rely on MCP tools and world-server adjudication, not a webpage provider call.
- Phase 2 context package tests:
  - Command: `rtk npm --prefix tools/graph-react-app run agent:test`
  - Result: 10 tests passed, 0 failed.
- Phase 2 context HTTP check:
  - `POST /api/context/package` returned `contextVersion: agent-context-mvp-2026-06-24`, `modelAccess: external_agent_hosted`, `credentialHandling: not_collected_by_world_server`, and `highRisk: user_confirm_required`.
  - A request containing an `sk-proj-...` shaped value returned HTTP 400 with `api_key_detected`.
  - Serialized context did not contain `hiddenTruthRef`, `coreSecret`, or `server_only`.
- Phase 2 external model call:
  - Not applicable after correction; external model execution is owned by the user's agent host, not the world server or browser UI.
- Phase 3 lore unit tests:
  - Command: `rtk npm --prefix tools/graph-react-app run agent:test`
  - Result: 15 tests passed, 0 failed.
- Phase 3 frontend build:
  - Command: `rtk npm --prefix tools/graph-react-app run build`
  - Result: Vite build succeeded; world-map data generation and export succeeded.
  - Note: Vite still reports the existing large chunk warning.
- Phase 3 HTTP lore check:
  - Submitted three public runs through `/api/runs/start` and `/api/runs/submit`.
  - First claim decision: `canonical`.
  - Exact duplicate decision: `duplicate`.
  - Conflicting same subject/predicate decision: `disputed`.
  - `GET /api/lore/public` returned `claimCount: 2`, `conflictCount: 1`, and `rewardCount: 1`.
- Phase 4 progression unit tests:
  - Command: `rtk npm --prefix tools/graph-react-app run agent:test`
  - Result: 20 tests passed, 0 failed.
- Phase 4 frontend build:
  - Command: `rtk npm --prefix tools/graph-react-app run build`
  - Result: Vite build succeeded; world-map data generation and export succeeded.
  - Note: Vite still reports the existing large chunk warning.
- Phase 4 HTTP progression check:
  - Before progression, `create_faction` returned `allowed: false`, `rank: outsider`, `reason: rank_too_low`.
  - Public review-candidate runs awarded faction reputation and unlocked `腐林追踪 I`.
  - Third same-day run was capped to `pointsAwarded: 5`, leaving daily cap at `25/25`.
  - At `field_agent`, `create_faction` still returned `allowed: false` because required rank is `operator`.
- Phase 5 faction unit tests:
  - Command: `rtk npm --prefix tools/graph-react-app run agent:test`
  - Result: 26 tests passed, 0 failed.
- Phase 5 frontend build:
  - Command: `rtk npm --prefix tools/graph-react-app run build`
  - Result: Vite build succeeded; world-map data generation and export succeeded.
  - Note: Vite still reports the existing large chunk warning.
- Phase 5 HTTP faction gate check:
  - `POST /api/factions/propose` with an outsider explorer returned HTTP 403.
  - Response reason was `rank_too_low` and `requiredRank: operator`.
  - `GET /api/factions/public` returned an empty faction list and `supporterThreshold: 3`.
- Phase 6 feedback unit tests:
  - Command: `rtk npm --prefix tools/graph-react-app run agent:test`
  - Result: 32 tests passed, 0 failed.
- Phase 6 frontend build:
  - Command: `rtk npm --prefix tools/graph-react-app run build`
  - Result: Vite build succeeded; world-map data generation and export succeeded.
  - Note: Vite still reports the existing large chunk warning.
- Phase 6 HTTP feedback check:
  - Submitted an intentionally weak public run.
  - Server ignored `clientScore: 100` and returned score `5`.
  - Feedback tone was `repairable_failure`.
  - Resubmission mode was `new_run_ticket_required`.
  - Repair endpoint returned `repairTicketCount: 1`.
  - Digest endpoint summarized current run/lore/faction counts.
- Phase 7-9 unit tests:
  - Command: `rtk npm --prefix tools/graph-react-app run agent:test`
  - Result: 47 tests passed, 0 failed.
- Phase 7-9 frontend build:
  - Command: `rtk npm --prefix tools/graph-react-app run build`
  - Result: Vite build succeeded; world-map data generation and export succeeded.
  - Note: Vite still reports the existing large chunk warning.
- Phase 7-9 HTTP end-to-end check:
  - Submitted public runs through `/api/runs/start` and `/api/runs/submit`.
  - `GET /api/world/browser` returned `claimCount: 1` and `archiveRuns: 1`.
  - Claim detail exposed source run ticket.
  - Source graph returned `graphNodes: 2` and `graphEdges: 1`.
  - Community reaction/comment endpoints produced `reactionStatus: recorded`, `commentStatus: visible`, and a thread with `useful: 1`.
  - TTS unlock was false after one completed run and true after three completed runs.
  - Voice profile selection returned `selected`.
  - Faction sound style for `云脑族` returned `dream_index`.
  - Transparency verification returned `ok: true`, `entryCount: 3`.
  - Transparency export returned 3 entries.
  - Manual transparency anchor returned `prepared` and a 64-character root hash.
- Final expanded test suite:
  - Command: `rtk npm --prefix tools/graph-react-app run agent:test`
  - Result: 51 tests passed, 0 failed.
  - Added MCP registry/runtime tests for tool schemas, external-agent world loop, secret-shaped text rejection, and real stdio `initialize` / `tools/list` / `tools/call`.
- Final frontend build:
  - Command: `rtk npm --prefix tools/graph-react-app run build`
  - Result: Vite build succeeded; world-map data generation and export succeeded.
  - Note: one transient `EIO` occurred while copying `睡眠裂梦缝合鸦_档案卡.png`; the file was readable on inspection and a retry succeeded without code changes.
- Final MCP correction build:
  - Command: `rtk npm --prefix tools/graph-react-app run build`
  - Result: Vite build succeeded; world-map data generation and export succeeded.
  - Note: Vite still reports the existing large chunk warning.
- Final MCP stdio check:
  - Covered by `tools/agent-server/test/mcp.test.mjs`.
  - Result: spawned `node tools/agent-server/mcp.mjs`, completed `initialize`, `tools/list`, and `tools/call`, and parsed the returned context package.

## 2026-06-26 NPC Health Read Model Slice

- Added server-authoritative `npc_health_recorded` events from bounded NPC lifecycle ticks when a lifecycle change contains `health_status`.
- Added `npcHealthStates`, NPC indexes and region indexes to the core projection, then exposed the read model through `region_info`, `npc_info`, `obsidian_epoch.npc_health`, `/api/epoch/npc/health`, region public pages, NPC public pages and the Agent console region panel.
- Kept the trust boundary narrow: clients and local MCP adapters can read health state, but cannot submit illness, recovery or severity as canonical facts.
- Fixed brittle NPC social tests to locate career/health records by `npcId` instead of assuming the first region record belongs to the test NPC.
- Focused verification:
  - `npm run typecheck`: passed, including `check:no-js`.
  - `node --import tsx --test --test-name-pattern "NPC lifecycle tick records canonical health state" ../agent-server/test/epoch-game-core.test.ts`: passed.
  - `node --import tsx --test --test-name-pattern "HTTP exposes server-created NPC organizations careers and locations" ../agent-server/test/server.test.ts`: passed.
  - `node --import tsx --test --test-name-pattern "MCP exposes server-created NPC organizations careers and locations" ../agent-server/test/mcp.test.ts`: passed.
  - `node --import tsx --test src/agent/AgentExplorer.layout.test.ts`: passed.
- Full verification:
  - `npm test`: passed with 163 agent/server tests, 11 batch tests and 40 UI/API tests.
  - `npm run build`: passed; exported `00_总览/黑曜纪元3D世界地图.html` and removed transient Vite `dist`.
  - `git diff --check`: passed.
  - Strict `find tools ... (*.js|*.mjs|*.jsx)` source scan: no output.

## 2026-06-26 NPC Asset Read Model Slice

- Added server-authoritative `npc_asset_changed` events from bounded NPC lifecycle ticks when a lifecycle change contains `assets_delta`.
- Added `npcAssetStates`, NPC indexes, region indexes and current `npcAssetBalancesByNpc` to the core projection; current alpha asset key is `wealth`.
- Exposed asset records through `region_info`, `npc_info`, `obsidian_epoch.npc_assets`, `/api/epoch/npc/assets`, region public pages, NPC public pages and the Agent console region panel.
- Kept the trust boundary narrow: clients and local MCP adapters can read NPC asset state, but cannot grant, deduct, trade or seize NPC assets by prompt text.
- Updated maintenance verification because scheduled lifecycle ticks now persist the additional canonical asset event.
- Focused verification:
  - `npm run typecheck`: passed, including `check:no-js`.
  - `node --import tsx --test --test-name-pattern "NPC lifecycle tick records canonical asset state" ../agent-server/test/epoch-game-core.test.ts`: passed.
  - `node --import tsx --test --test-name-pattern "HTTP exposes server-created NPC organizations careers and locations" ../agent-server/test/server.test.ts`: passed.
  - `node --import tsx --test --test-name-pattern "MCP exposes server-created NPC organizations careers and locations" ../agent-server/test/mcp.test.ts`: passed.
  - `node --import tsx --test --test-name-pattern "epoch maintenance tick advances NPC lifecycle and expires stale market orders through canonical events" ../agent-server/test/maintenance.test.ts`: passed.
  - `node --import tsx --test src/agent/AgentExplorer.layout.test.ts`: passed.
- Full verification:
  - `npm test`: passed with 164 agent/server tests, 11 batch tests and 41 UI/API tests.
  - `npm run build`: passed; exported `00_总览/黑曜纪元3D世界地图.html` and removed transient Vite `dist`.
  - `git diff --check`: passed.
  - Strict `find tools ... (*.js|*.mjs|*.jsx)` source scan: no output.

## 2026-06-26 NPC Rich Relationship Slice

- Expanded server-owned NPC lifecycle relationships beyond spouse and parent/child.
- Work-state lifecycle ticks now canonicalize workplace contacts and record `subordinate`, `superior` and `friend` relationships.
- Relocation/illness lifecycle ticks now canonicalize a rival and record an `enemy` relationship.
- Existing HTTP/MCP relationship tests now locate spouse records by kind instead of assuming relationship order, keeping region relationship views robust as the graph grows.
- Maintenance verification now expects the additional server-owned relationship events and asserts `npc_relationship_recorded` persistence.
- Focused verification:
  - `npm run typecheck`: passed, including `check:no-js`.
  - `node --import tsx --test --test-name-pattern "NPC lifecycle tick creates richer social relationship records" ../agent-server/test/epoch-game-core.test.ts`: passed.
  - `node --import tsx --test --test-name-pattern "NPC lifecycle tick creates canonical relationship records" ../agent-server/test/epoch-game-core.test.ts`: passed.
  - `node --import tsx --test --test-name-pattern "HTTP exposes server-created NPC relationships through region routes" ../agent-server/test/server.test.ts`: passed.
  - `node --import tsx --test --test-name-pattern "MCP exposes server-created NPC relationships through region views" ../agent-server/test/mcp.test.ts`: passed.
  - `node --import tsx --test --test-name-pattern "epoch maintenance tick advances NPC lifecycle and expires stale market orders through canonical events" ../agent-server/test/maintenance.test.ts`: passed.
- Full verification:
  - `npm test`: passed with 165 agent/server tests, 11 batch tests and 41 UI/API tests.
  - `npm run build`: passed; exported `00_总览/黑曜纪元3D世界地图.html` and removed transient Vite `dist`.
  - `git diff --check`: passed.
  - Strict `find tools ... (*.js|*.mjs|*.jsx)` source scan: no output.

## Known Risks

- The current world-map frontend is a compact single-file shell, so Agent Explorer must be wired in with minimal surface area to avoid destabilizing the existing map.
- MVP deterministic adjudication is intentionally simple; it must be replaced or extended before it can carry real public-world authority.
- JSONL persistence is acceptable for local MVP proof, but later phases will need stronger indexing and migration strategy.

## Deferred From MVP

- Remote hosted MCP deployment and durable backing store.
- Semantic dedupe.
- Community dispute court.
- Full production TTS/audio asset pipeline.
- Blockchain anchoring.
- Abuse controls for anonymous public submissions.

## Change Log

- 2026-06-24: Created ledger and started Phase 1 implementation.
- 2026-06-24: Implemented Phase 1 server, deterministic adjudication, ticket idempotency, API-key leak rejection, frontend Agent Explorer shell, and package scripts.
- 2026-06-24: Added Phase 2 public context package route and context safety tests.
- 2026-06-24: Implemented Phase 3 lore claim extraction, exact duplicate merge, conflict graph, source attribution, slot limiting, source reward events, public lore endpoint, and UI result summary.
- 2026-06-24: Implemented Phase 4 faction reputation, rank gates, daily cap, external-item limits, faction traits, progression endpoint, and operation-check endpoint.
- 2026-06-24: Implemented Phase 5 faction proposal ledger, legitimacy scoring, trial/accepted/merged/rejected states, supporter threshold, accepted-faction references, and faction endpoints.
- 2026-06-24: Implemented Phase 6 feedback cards, repair tickets, resubmission guidance, reward summaries, feedback events, digest generation, and feedback endpoints.
- 2026-06-24: Implemented Phase 7 public world browser, source graph, archive/detail endpoints, reactions, comments, flags, moderation queue, and frontend public-world index panel.
- 2026-06-24: Implemented Phase 8 TTS unlock gate, voice profile selection, faction sound styles, settlement effects, rating reveal effects, and experience endpoints.
- 2026-06-24: Implemented Phase 9 deterministic transparency hashes, append-only verification ledger, public export bundle, optional manual anchor, and transparency endpoints.
- 2026-06-24: Corrected architecture from browser BYOK to agent-facing MCP; added stdio MCP server, MCP tool runtime/tests, removed browser provider/delegation files, and rebuilt Agent Explorer as a world-service status panel.
- 2026-06-26: Implemented server-authoritative NPC health read model across core events, projections, HTTP, MCP, public pages, Agent console, package docs and Skill guardrails.
- 2026-06-26: Implemented server-authoritative NPC asset read model across lifecycle events, projections, maintenance persistence, HTTP, MCP, public pages, Agent console, package docs and Skill guardrails.
- 2026-06-26: Expanded server-authoritative NPC lifecycle relationships to include friend, enemy, superior and subordinate links in addition to spouse and parent/child relationships.
