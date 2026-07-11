# 黑曜纪元 Full Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:subagent-driven-development` for independent implementation lanes or execute inline when one owner can safely keep the state in their head. Track progress by updating the checkboxes in this file and by recording verification evidence after each phase.

## Goal

Turn the full architecture into a real server-authoritative agent MMO that can be installed as a generic MCP/Skill package, visited through a web page, and played by local coding agents or web LLM users without trusting their prompts, clients, or MCP adapters.

The implementation must preserve these invariants:

- Server-issued identity only.
- Server-owned world state only.
- TypeScript and TSX source only.
- MCP, Skill, browser and local agent hosts are clients, not authorities.
- Every competitive, persistent or tradable result is generated from canonical server events.
- Local agents may narrate and propose actions, but server-side rules decide the canonical outcome.

## Current Codebase Reality

The current product already has a TS-only local vertical slice under:

- `tools/agent-server`
- `tools/graph-react-app/src/agent`

Existing modules include tickets, deterministic adjudication, lore, progression, factions, community hooks, experience settings, transparency, MCP tools and HTTP routes.

Historical plan files still mention `.js`, `.mjs` and `.jsx`. Those are obsolete implementation notes. New work must use only `.ts` and `.tsx` source files outside dependencies.

## Architecture Source Of Truth

- Product and gameplay spec: `docs/superpowers/specs/2026-06-24-obsidian-epoch-mcp-server-plugin-platform-design.md`
- Full architecture: `docs/architecture/obsidian-epoch-full-architecture.md`
- This implementation plan: `docs/superpowers/plans/2026-06-25-obsidian-epoch-full-implementation.md`

## Phase Map

1. **Alpha 1: Canonical Epoch Core**
   - Add protocol/event primitives.
   - Add server-issued agent identity and lineage.
   - Add lifetime and reincarnation events.
   - Add resource balances.
   - Add downtime states.
   - Add NPC canonicalization and lifecycle events.
   - Keep the first slice pure and unit tested before wiring it into HTTP/MCP.

2. **Alpha 2: HTTP And MCP Gameplay Gateway**
   - Expose identity, run, turn, downtime, NPC, region and resource tools through existing HTTP and MCP surfaces.
   - Validate every state-changing command through typed request parsing.
   - Add idempotency keys and command/event correlation.
   - Keep old run-ticket endpoints working while the new epoch endpoints are added.

3. **Alpha 3: Agent Progress Dashboard**
   - Add a web view for agent identities, current lifetime, resources, downtime, latest events, news and region state.
   - Add public result pages that are safe to share.
   - Add install/download entry points for MCP and Skill package artifacts.

4. **Beta 1: Multiplayer Competition And Economy**
   - Add regions, resources, contested objectives, leaderboards, trading orders and raid/defense results.
   - Add server-side market and seasonal settlement workers.
   - Add public audit views for high-impact outcomes.

5. **Beta 2: Living NPC World**
   - Persist NPCs as first-class canonical records.
   - Add scheduled NPC lifecycle ticks: asset changes, relationships, illness, marriage, children, work status and region movement.
   - Link generated story NPCs to canonical NPC IDs when accepted by server rules.

6. **Beta 3: Trusted Runner Options**
   - Keep generic MCP untrusted by default.
   - Add hosted runner and attested runner channels for verified autonomous play.
   - Add transcript hash and action-option proof records.

7. **Release: Public Server And Installable Package**
   - Package MCP server and Skill assets.
   - Publish server deployment target.
   - Publish installation instructions and web entry URL.
   - Add operational monitoring and recovery playbooks.

## Alpha 1 Scope

Alpha 1 is the first implementation target for this plan. It does not attempt to finish every MMO feature. It creates the canonical domain boundary that later HTTP, MCP and UI work can rely on.

### Files To Create

- `tools/agent-server/lib/epoch/protocol.ts`
- `tools/agent-server/lib/epoch/events.ts`
- `tools/agent-server/lib/epoch/eventStore.ts`
- `tools/agent-server/lib/epoch/gameCore.ts`
- `tools/agent-server/test/epoch-events.test.ts`
- `tools/agent-server/test/epoch-game-core.test.ts`

### Files To Modify

- `tools/agent-server/lib/mcpTools.ts`
- `tools/agent-server/server.ts`
- `tools/graph-react-app/src/agent/agentTypes.ts`
- `tools/graph-react-app/src/agent/api.ts`
- `tools/graph-react-app/src/agent/AgentExplorer.tsx`

HTTP/MCP/UI changes are allowed only after the pure Alpha 1 tests pass.

## Alpha 1 Domain Model

### Event Envelope

Every canonical event must include:

```ts
export interface EpochEventEnvelope<TType extends EpochEventType, TPayload> {
  readonly eventId: string;
  readonly eventType: TType;
  readonly aggregateType: EpochAggregateType;
  readonly aggregateId: string;
  readonly actorExplorerId: string;
  readonly agentId?: string;
  readonly trustClass: EpochTrustClass;
  readonly causationId: string;
  readonly correlationId: string;
  readonly idempotencyKey?: string;
  readonly createdAt: string;
  readonly payload: TPayload;
}
```

### Required Alpha 1 Events

- `identity_issued`
- `lifetime_adjusted`
- `identity_archived`
- `reincarnation_issued`
- `resource_granted`
- `resource_spent`
- `downtime_set`
- `downtime_claimed`
- `npc_canonicalized`
- `npc_lifecycle_recorded`
- `npc_relationship_recorded`
- `npc_memory_recorded`
- `npc_household_recorded`
- `organization_membership_changed`
- `npc_career_changed`
- `npc_location_changed`
- `region_news_generated`

### Game-Core Commands

Pure handlers must return events rather than mutating storage directly:

- `issueIdentity`
- `adjustLifetime`
- `archiveIdentity`
- `reincarnate`
- `grantResource`
- `spendResource`
- `setDowntime`
- `claimDowntime`
- `canonicalizeNpc`
- `recordNpcLifecycle`
- `generateRegionNews`

### Read Model

Alpha 1 may use an in-memory projection rebuilt from events during tests. It must expose:

- agent identities by `agentId`
- lineage by `explorerId`
- resource balances by `agentId`
- downtime state by `agentId`
- NPC records by `npcId`
- NPC relationship records by `relationshipId`, `npcId` and `regionId`
- NPC memory records by `memoryId`, `npcId` and `regionId`
- household records by `householdId`, `npcId` and `regionId`
- organization records and memberships by `organizationId`, `membershipId`, `npcId` and `regionId`
- NPC career records by `careerId`, `npcId` and `regionId`
- NPC location records by `locationId`, `npcId` and source/destination `regionId`
- region news by `regionId`

## Alpha 1 Task List

- [x] Add `protocol.ts` with strict literal unions, request/response types and validation helpers.
- [x] Add `events.ts` with event envelope, event payload types and event factory helpers.
- [x] Add `eventStore.ts` with in-memory and JSONL append/read implementations.
- [x] Add `gameCore.ts` with pure command handlers and deterministic projection rebuild.
- [x] Add tests proving identity IDs are server-issued and lineage is created by events.
- [x] Add tests proving lifetime reaches archived state and reincarnation issues the next identity.
- [x] Add tests proving resources cannot go negative.
- [x] Add tests proving downtime claims use elapsed server time and not client-provided rewards.
- [x] Add tests proving NPC canonicalization deduplicates by server key and lifecycle updates preserve canonical NPC IDs.
- [x] Add tests proving region news references server events and does not accept raw client authority.

## Alpha 2 HTTP/MCP Task List

- [x] Add HTTP routes under the existing server:
  - `POST /api/epoch/identity/issue`
  - `GET /api/epoch/identity/:agentId`
  - `POST /api/epoch/downtime/set`
  - `POST /api/epoch/downtime/claim`
  - `POST /api/epoch/npc/canonicalize`
  - `GET /api/epoch/region/:regionId`
  - `GET /api/epoch/events`
- [x] Add MCP tools:
  - `obsidian_epoch.identity`
  - `obsidian_epoch.progress`
  - `obsidian_epoch.set_downtime`
  - `obsidian_epoch.claim_downtime`
  - `obsidian_epoch.region_info`
  - `obsidian_epoch.npc_note`
  - `obsidian_epoch.result_page`
  - `obsidian_epoch.events`
- [x] Reuse existing API-key redaction and secret-shape rejection before any persistence.
- [x] Add idempotency protection for every state-changing command.
- [x] Add tests for MCP schemas and HTTP rejection paths.

## Alpha 3 Web Task List

- [x] Add dashboard state types in `tools/graph-react-app/src/types.ts`.
- [x] Add epoch API calls in `tools/graph-react-app/src/agent/api.ts`.
- [x] Extend `AgentExplorer.tsx` with:
  - identity card
  - lifetime and lineage panel
  - resource panel
  - downtime mode control
  - latest canonical events
  - region news and leaderboard preview
  - install/package panel
- [x] Keep the UI quiet, readable and plugin-oriented; it should feel like a coding-agent sidecar, not a marketing page.
- [x] Verify at desktop and mobile widths if UI layout changes are made.

## Full-Version Backlog

- [x] Add region aggregate and contested objectives.
- [x] Add market orders and direct player trade.
- [x] Add raid/defense settlement.
- [x] Add server-scheduled downtime tick worker.
- [x] Add server-scheduled NPC lifecycle worker.
- [x] Add server-scheduled market expiry worker.
- [x] Add alliance, hostility and reputation graph.
- [x] Add seasonal faction campaign standings and settlement.
- [x] Add public result-page renderer.
- [x] Add public agent, region and NPC status pages.
- [x] Add public death archive and reincarnation lineage pages.
- [x] Add public audit/replay views for high-impact outcomes.
- [x] Add operator-gated public content moderation queue.
- [x] Add one-time result page tokens.
- [x] Add Skill package files and assets.
- [x] Add MCP package build artifact.
- [x] Add hosted runner protocol.
- [x] Add attested runner protocol.
- [x] Add Web LLM browser bridge.
- [x] Add production database migration path.
- [x] Add public abuse limits.
- [x] Add public server deployment configuration.
- [x] Add server-authoritative party run membership slice.
  - `party_run_created` and `party_member_joined` record canonical multiplayer membership only.
  - `party_run_settled` records server-adjudicated completion with server role scores, `coin` rewards, region influence, conflict trace and generated region news.
  - MCP exposes `obsidian_epoch.party_runs`, `obsidian_epoch.create_party_run`, `obsidian_epoch.join_party_run` and operator-gated `obsidian_epoch.settle_party_run`.
  - HTTP exposes `GET /api/epoch/party-runs`, `POST /api/epoch/party-runs/create`, `POST /api/epoch/party-runs/join` and operator-gated `POST /api/epoch/party-runs/settle`.
  - Agent Console exposes the regional party-run panel and `region_info.partyRuns[]`.
  - Settled party runs leave open party-run lists and regional open commissions, while regional details can still inspect the settled run.

## Verification Commands

Run from `tools/graph-react-app`:

```bash
npm run check:no-js
npm run check:no-explicit-any
npm run typecheck:agent
npm run agent:test
npm run agent:ui-test
npm run batch:test
npm run typecheck:web
npm run build
```

For a narrow server-only slice, the minimum gate is:

```bash
npm run typecheck:agent
npm run agent:test
```

Before claiming completion of any phase, record the command, result and remaining risk in this file or in the implementation ledger.

## Verification Evidence

Alpha 1 server-domain slice:

- `npm run typecheck:agent`
  - Result: passed.
- `npm run agent:test`
  - Result: passed, 65 tests, 0 failed.
- `npm run typecheck`
  - Result: passed.
  - Includes `npm run check:no-js`, which reported `No JS/MJS/JSX source files found.`
- `npm run build`
  - Result: passed.
  - Generated world-map data, completed Vite production build, exported `00_总览/黑曜纪元3D世界地图.html`, then removed transient `dist` output.

Alpha 2 HTTP/MCP integration slice:

- `npm run typecheck:agent`
  - Result: passed.
- `npm run agent:test`
  - Result: passed, 67 tests, 0 failed.
  - Covered MCP Epoch tools, HTTP Epoch routes, event persistence and hydration, required `idempotencyKey`, and duplicate request suppression.
- `npm run typecheck`
  - Result: passed.
  - Includes `npm run check:no-js`, which reported `No JS/MJS/JSX source files found.`
- `npm run build`
  - Result: passed.
  - Generated world-map data, completed Vite production build, exported `00_总览/黑曜纪元3D世界地图.html`, then removed transient `dist` output.

Alpha 3 web dashboard slice:

- `npm run typecheck`
  - Result: passed.
  - Includes `npm run check:no-js`, which reported `No JS/MJS/JSX source files found.`
- `npm run agent:test`
  - Result: passed, 68 tests, 0 failed.
  - Covered MCP validation error mapping, HTTP Epoch result-page payload, and install manifest content.
- `npm run build`
  - Result: passed.
  - Generated world-map data, completed Vite production build, exported `00_总览/黑曜纪元3D世界地图.html`, then removed transient `dist` output.
- Headless Chrome visual checks:
  - Desktop screenshot: `/tmp/obsidian-epoch-agent-console.png`
  - Mobile screenshot: `/tmp/obsidian-epoch-agent-console-mobile-5.png`
  - Result: plugin-sidecar dashboard renders at both widths; mobile command/header overflow was fixed with responsive wrapping.
- Local dev URLs:
  - Web: `http://127.0.0.1:5173/?agent=1`
  - Server: `http://127.0.0.1:8787`

Installable package slice:

- Skill validation:
  - Command: `python3 /Users/chengwen/.codex/skills/.system/skill-creator/scripts/quick_validate.py tools/agent-server/package/obsidian-epoch`
  - Result: passed, `Skill is valid!`
- Package contents:
  - `tools/agent-server/package/obsidian-epoch/SKILL.md`
  - `tools/agent-server/package/obsidian-epoch/references/protocol.md`
  - `tools/agent-server/package/obsidian-epoch/assets/install-manifest.json`
  - `tools/agent-server/package/.codex-plugin/plugin.json`
  - `tools/agent-server/package/install-manifest.json`
- Download endpoint:
  - `GET /api/epoch/package/obsidian-epoch-agent-world-0.1.0-alpha.tar.gz`
  - Verified via `curl`; response was `200`, `content-type: application/gzip`, `content-disposition: attachment`.
  - Verified archive listing includes `.codex-plugin/plugin.json`, `obsidian-epoch/SKILL.md`, protocol reference, OpenAI skill metadata and install manifests.
- `npm run agent:test`
  - Result: passed, 69 tests, 0 failed.
  - Covered archive construction and HTTP package download.
- `npm run typecheck`
  - Result: passed.
  - Includes `npm run check:no-js`, which reported `No JS/MJS/JSX source files found.`
- `npm run build`
  - Result: passed.
  - Generated world-map data, completed Vite production build, exported `00_总览/黑曜纪元3D世界地图.html`, then removed transient `dist` output.

Public result page slice:

- Added server-owned public page creation:
  - `POST /api/epoch/result-page/create`
  - `GET /epoch/result/{pageId}`
  - MCP tool: `obsidian_epoch.create_result_page`
- Kept `obsidian_epoch.result_page` and `GET /api/epoch/result-page` as share-safe JSON preview surfaces.
- Added JSONL persistence/hydration through `result-pages.jsonl` so created public pages survive runtime reloads.
- Added a no-script HTML renderer for public result pages; the page is rendered from server payload only.
- Updated the agent dashboard with `生成预览` and `创建链接` controls.
- Updated the installable Skill/protocol reference and install manifest to include `obsidian_epoch.create_result_page`.
- `npm run typecheck`
  - Result: passed.
  - Includes `npm run check:no-js`, which reported `No JS/MJS/JSX source files found.`
- `npm run agent:test`
  - Result: passed, 69 tests, 0 failed.
  - Covered MCP tool registration/call, HTTP public page creation, idempotency, HTML rendering and JSONL hydration.
- `npm run build`
  - Result: passed.
  - Generated world-map data, completed Vite production build, exported `00_总览/黑曜纪元3D世界地图.html`, then removed transient `dist` output.

Beta 1 contested objective slice:

- Added server-authoritative contested objective events:
  - `contested_objective_created`
  - `contested_objective_contributed`
  - `contested_objective_settled`
- Added objective projections by region, objective leaderboards, total score, settlement state and winner metadata.
- Added core commands:
  - `createContestedObjective`
  - `contributeContestedObjective`
  - `settleContestedObjective`
- Added runtime template gating so public clients can only seed server-defined objective templates, not arbitrary reward tables.
- Added HTTP routes:
  - `GET /api/epoch/objectives`
  - `POST /api/epoch/objectives/seed`
  - `POST /api/epoch/objectives/contribute`
  - `POST /api/epoch/objectives/settle`
- Added MCP tools:
  - `obsidian_epoch.objectives`
  - `obsidian_epoch.seed_objective`
  - `obsidian_epoch.contribute_objective`
  - `obsidian_epoch.settle_objective`
- Added dashboard controls for region objective template start, leaderboard refresh, contribution and settlement.
- Updated install manifest and Skill/protocol reference docs.
- `npm run typecheck`
  - Result: passed.
  - Includes `npm run check:no-js`, which reported `No JS/MJS/JSX source files found.`
- `npm run agent:test`
  - Result: passed, 70 tests, 0 failed.
  - Covered pure core objective rules, MCP objective tools, HTTP objective routes, resource spending, leaderboard order, settlement reward and event hydration.

Beta 1 market order / direct trade slice:

- Added server-authoritative market events:
  - `market_order_created`
  - `market_order_filled`
  - `market_order_cancelled`
- Added market order projections with `open`, `filled` and `cancelled` status.
- Added pure core commands:
  - `createMarketOrder`
  - `fillMarketOrder`
  - `cancelMarketOrder`
- Trade rules:
  - Creating a sell order spends/locks seller resources immediately.
  - Filling an order atomically spends buyer payment, grants payment to seller, grants locked goods to buyer and marks the order filled.
  - Cancelling an open order refunds locked goods to the seller.
  - Filled/cancelled orders cannot be filled again.
- Added HTTP routes:
  - `GET /api/epoch/market`
  - `POST /api/epoch/market/orders`
  - `POST /api/epoch/market/fill`
  - `POST /api/epoch/market/cancel`
- Added MCP tools:
  - `obsidian_epoch.market`
  - `obsidian_epoch.create_market_order`
  - `obsidian_epoch.fill_market_order`
  - `obsidian_epoch.cancel_market_order`
- Added dashboard controls for market order creation, listing, fill and cancel.
- Updated install manifest and Skill/protocol reference docs.
- `node --import tsx --test ../agent-server/test/epoch-game-core.test.ts`
  - Result: passed, 8 tests, 0 failed.
  - This was run after a RED failure proving `createMarketOrder` did not exist.
- `npm run typecheck`
  - Result: passed.
  - Includes `npm run check:no-js`, which reported `No JS/MJS/JSX source files found.`
- `npm run agent:test`
  - Result: passed, 71 tests, 0 failed.
  - Covered pure core market rules, MCP market tools, HTTP market routes, payment transfer, lock/refund and event hydration.

Beta 1 scheduled market expiry worker slice:

- Added server-authoritative market expiry event:
  - `market_order_expired`
- Added `expired` market order status and expiry timestamp projection.
- Added pure core command:
  - `tickMarketExpiry`
- Expiry rules:
  - Only server-trusted workers may run the expiry tick.
  - Only stale `open` orders are expired.
  - Expiry grants locked goods back to the seller through canonical `resource_granted` events.
  - Filled, cancelled and fresh open orders are left unchanged.
- Added HTTP route:
  - `POST /api/epoch/market/expiry/tick`
- Added MCP tool:
  - `obsidian_epoch.tick_market_expiry`
- Added dashboard control to trigger a bounded market expiry scan and refresh market state.
- Updated install manifest and Skill/protocol reference docs.
- `node --import tsx --test ../agent-server/test/epoch-game-core.test.ts`
  - RED result: failed because `tickMarketExpiry` was undefined.
  - GREEN result: passed, 13 tests, 0 failed after implementation.
- `npm run agent:test`
  - Result: passed, 76 tests, 0 failed.
  - Covered pure core expiry rules, MCP expiry tool, HTTP expiry route, refund persistence and event hydration.

Alpha 3 bounty escrow slice:

- Added server-authoritative bounty events:
  - `bounty_created`
  - `bounty_claimed`
- Added bounty projections with `open` and `claimed` status, plus region and agent indexes.
- Added pure core commands:
  - `createBounty`
  - `claimBounty`
- Bounty rules:
  - Creating a bounty requires sponsor owner authorization and locks the sponsor's real server-tracked reward immediately.
  - Claiming a bounty requires claimant owner authorization, rejects sponsor self-claims and releases only the locked server reward.
  - Client-declared reward or story prose cannot increase the payout; the bounty record is canonical.
- Added HTTP routes:
  - `GET /api/epoch/bounties`
  - `POST /api/epoch/bounties/create`
  - `POST /api/epoch/bounties/claim`
- Added MCP tools:
  - `obsidian_epoch.bounties`
  - `obsidian_epoch.create_bounty`
  - `obsidian_epoch.claim_bounty`
- Added dashboard controls for bounty refresh, bounty creation, evidence submission and claim.
- Updated install manifest, Skill, protocol reference and architecture docs.
- Verification:
  - `node --import tsx --test --test-name-pattern "bounties|bounty|MCP tool registry exposes" ../agent-server/test/epoch-game-core.test.ts ../agent-server/test/mcp.test.ts ../agent-server/test/server.test.ts`: RED before implementation because `createBounty` and the MCP/HTTP bounty surfaces were absent; passed after core/runtime/MCP/HTTP wiring.
  - `node --import tsx --test --test-name-pattern "bounty controls" src/agent/AgentExplorer.layout.test.ts`: RED before implementation because the Agent console did not expose bounty API calls or recovery-authorized create/claim controls; passed after UI wiring.

Beta 1 raid/defense settlement slice:

- Added server-authoritative raid event:
  - `raid_resolved`
- Added raid result projections by region and agent.
- Added pure core command:
  - `resolveRaid`
- Raid rules:
  - Attackers spend real server-tracked stamina.
  - Defender power is derived from canonical focus and legend, not client text.
  - Outcome is settled by server rules and recorded as `attacker_won` or `defender_won`.
  - Winner receives canonical legend through a `resource_granted` event.
- Added HTTP routes:
  - `GET /api/epoch/raids`
  - `POST /api/epoch/raids/resolve`
- Added MCP tools:
  - `obsidian_epoch.raids`
  - `obsidian_epoch.resolve_raid`
- Added dashboard controls for attack stamina, defender identity, settlement and recent raid history.
- Updated install manifest and Skill/protocol reference docs.
- `node --import tsx --test ../agent-server/test/epoch-game-core.test.ts`
  - RED result: failed because `resolveRaid` was undefined.
  - GREEN result: passed, 11 tests, 0 failed after implementation.
- `npm run typecheck`
  - Result: passed.
  - Includes `npm run check:no-js`, which reported `No JS/MJS/JSX source files found.`
- `npm run agent:test`
  - Result: passed, 74 tests, 0 failed.
  - Covered pure core raid rules, MCP raid tools, HTTP raid routes, stamina spending, canonical defender power and event hydration.

Beta 1 relationship graph slice:

- Added server-authoritative relationship event:
  - `relationship_updated`
- Added relationship edge projections by agent.
- Added pure core command:
  - `updateRelationship`
- Relationship rules:
  - Source identities spend real server-tracked focus.
  - `alliance`, `hostility` and `reputation` are the only accepted relationship kinds.
  - Score deltas are computed by server rules; client-declared score fields are ignored.
  - Self-targeting is rejected.
- Added HTTP routes:
  - `GET /api/epoch/relationships`
  - `POST /api/epoch/relationships/update`
- Added MCP tools:
  - `obsidian_epoch.relationship_graph`
  - `obsidian_epoch.update_relationship`
- Added dashboard controls for target identity, relationship kind, focus spend, refresh and recent relationship edges.
- Updated install manifest and Skill/protocol reference docs.
- `node --import tsx --test ../agent-server/test/epoch-game-core.test.ts`
  - RED result: failed because `updateRelationship` was undefined.
  - GREEN result: passed, 12 tests, 0 failed after implementation.
- `npm run agent:test`

Diplomacy chain slice:

- Added server-authoritative two-party diplomacy records:
  - `diplomacy_proposed`
  - `diplomacy_responded`
- A source identity spends focus to create a pending proposal; the target identity owner must authorize `respond_diplomacy`.
- Accepted diplomacy spends target focus, writes `relationship_updated` through server score rules, and creates a regional `trace_created` record with `sourceEventType: "diplomacy_responded"`.
- Rejected diplomacy records the response without creating a relationship edge.
- Added read indexes by region and agent, plus region activity entries with `kind: "diplomacy"`.
- Added HTTP routes:
  - `GET /api/epoch/diplomacy`
  - `POST /api/epoch/diplomacy/propose`
  - `POST /api/epoch/diplomacy/respond`
- Added MCP tools:
  - `obsidian_epoch.diplomacy`
  - `obsidian_epoch.propose_diplomacy`
  - `obsidian_epoch.respond_diplomacy`
- Added Agent Console controls for proposal terms, proposal creation, pending response acceptance/rejection and recent diplomacy chains.
- Verification:
  - `node --import tsx --test ../agent-server/test/epoch-game-core.test.ts --test-name-pattern "diplomacy proposals"`: RED before implementation because `proposeDiplomacy` / `respondDiplomacy` were undefined.
  - `node --import tsx --test ../agent-server/test/mcp.test.ts --test-name-pattern "MCP diplomacy"`: RED before implementation because `obsidian_epoch.propose_diplomacy` was unknown.
  - `node --import tsx --test ../agent-server/test/server.test.ts --test-name-pattern "HTTP diplomacy"`: RED before implementation because `/api/epoch/diplomacy/propose` returned 404.
  - `node --import tsx --test src/agent/AgentExplorer.layout.test.ts --test-name-pattern "diplomacy chain"`: RED before implementation because the console had no diplomacy API calls or controls.
  - Result: passed, 75 tests, 0 failed.
  - Covered pure core relationship rules, MCP relationship tools, HTTP relationship routes, focus spending, event persistence and hydration.
- `npm run typecheck`
  - Result: passed.
  - Includes `npm run check:no-js`, which reported `No JS/MJS/JSX source files found.`

Public abuse limit slice:

- Added server-side Epoch state-change abuse windows in the shared runtime used by HTTP and MCP.
- Abuse limit rules:
  - State-changing Epoch commands that require `idempotencyKey` count against a per-actor window.
  - Idempotent replay of an already accepted command returns the cached duplicate and does not consume another slot.
  - Read-only tools such as progress and region reads are not blocked by the mutation window.
  - The default threshold is intentionally wide for local/dev play; tests can configure stricter windows.
- Added HTTP 429 mapping for `epoch_abuse_limit_exceeded`.
- Added regression coverage:
  - MCP rejects excessive state changes in a window.
  - HTTP returns 429 after the configured limit.
  - Reads still work while writes are limited.
  - The window resets after server time advances.
- `node --import tsx --test ../agent-server/test/mcp.test.ts ../agent-server/test/server.test.ts`
  - RED result: failed because the third state-changing command was still accepted.
  - GREEN result: passed, 13 tests, 0 failed after implementation.

Beta 2 NPC lifecycle worker slice:

- Added a server-owned `tickNpcLifecycle` core command that emits `npc_lifecycle_recorded` events for a bounded set of canonical NPCs.
- Tick rules are deterministic and server-owned; clients may trigger the worker endpoint but cannot submit custom `assets_delta`, relationship, child, health, or work-state changes.
- First implemented lifecycle tick state includes:
  - asset/work update: `assets_delta: 10000`, `work_status: working`
  - follow-up cycles for marriage, child/household, and health state
- Added runtime idempotency for lifecycle ticks.
- Added HTTP route:
  - `POST /api/epoch/npc/lifecycle/tick`
- Added MCP tool:
  - `obsidian_epoch.tick_npc_lifecycle`
- Added dashboard control in the region/NPC panel to run an NPC lifecycle tick and show the latest lifecycle summary.
- Updated install manifest and Skill/protocol reference docs.
- `node --import tsx --test ../agent-server/test/epoch-game-core.test.ts`
  - RED result: failed because `tickNpcLifecycle` was undefined.
  - GREEN result: passed, 9 tests, 0 failed after implementation.
- `npm run typecheck`
  - Result: passed.
  - Includes `npm run check:no-js`, which reported `No JS/MJS/JSX source files found.`
- `npm run agent:test`
  - Result: passed, 72 tests, 0 failed.
  - Covered pure core lifecycle tick authority, MCP lifecycle tick, HTTP lifecycle tick, event persistence and hydration.

Beta 2 NPC relationship graph slice:

- Added server-authoritative `npc_relationship_recorded` events.
- Added NPC relationship projections:
  - `npcRelationships`
  - `npcRelationshipIdsByNpc`
  - `npcRelationshipIdsByRegion`
- Extended scheduled NPC lifecycle ticks to canonicalize generated partner/child NPCs before recording relationships.
- Current relationship production rules:
  - the second lifecycle tick for an NPC creates a canonical partner NPC and a `spouse` relationship
  - the third lifecycle tick creates a canonical child NPC plus `parent` and `child` relationships
  - relationships are created by `system_worker` lifecycle events, not client prompt text
- Added HTTP route:
  - `GET /api/epoch/npc/relationships`
- Added MCP tool:
  - `obsidian_epoch.npc_relationships`
- Extended `region_info` responses and the Agent console region panel to include NPC relationships.
- Updated installable Skill/protocol reference and install manifest.
- Tests added:
  - Core lifecycle tick creates canonical partner and `npc_relationship_recorded`.
  - MCP registry, region view and `npc_relationships` tool expose relationship records.
  - HTTP region route and relationship route expose server-created relationship records.

Beta 2 NPC memory slice:

- Added server-authoritative `npc_memory_recorded` events.
- Added NPC memory projections:
  - `npcMemories`
  - `npcMemoryIdsByNpc`
  - `npcMemoryIdsByRegion`
- Added core `recordNpcMemory` for future server adjudicators and workers:
  - requires server trust
  - requires an existing canonical NPC
  - validates source event ids
- Extended scheduled NPC lifecycle ticks to create a memory after each lifecycle event.
- Current memory production rule:
  - each lifecycle tick records a source-backed memory with the lifecycle event id
  - clients can read memories but cannot create permanent memories from prompt text
- Added HTTP route:
  - `GET /api/epoch/npc/memories`
- Added MCP tool:
  - `obsidian_epoch.npc_memories`
- Extended `region_info` responses and the Agent console region panel to include NPC memories.
- Updated installable Skill/protocol reference and install manifest.
- Tests added:
  - Core lifecycle tick creates `npc_memory_recorded` and memory indexes.
  - MCP registry, region view and `npc_memories` tool expose memory records.
  - HTTP region route and memory route expose server-created memory records.

Beta 2 NPC household slice:

- Added server-authoritative `npc_household_recorded` events.
- Added household projections:
  - `households`
  - `householdIdsByNpc`
  - `householdIdsByRegion`
- Extended scheduled NPC lifecycle ticks to maintain canonical households.
- Current household production rule:
  - the marriage lifecycle tick creates a two-NPC household after canonicalizing the partner
  - the child lifecycle tick merges the child into the existing parent household when available
  - household records are created by `system_worker` lifecycle events, not client prompt text
- Added HTTP route:
  - `GET /api/epoch/households`
- Added MCP tool:
  - `obsidian_epoch.households`
- Extended `region_info` responses and the Agent console region panel to include household membership.
- Updated installable Skill/protocol reference and install manifest.
- Tests added:
  - Core lifecycle tick creates `npc_household_recorded` and household indexes.
  - MCP registry, region view and `households` tool expose household records.
  - HTTP region route, household route and install manifest expose server-created household records.
- Verification:
  - `node --import tsx --test ../agent-server/test/epoch-game-core.test.ts ../agent-server/test/mcp.test.ts ../agent-server/test/server.test.ts` passed with 42 tests.

Server-derived household readability slice:

- Closed the social-world readability gap where household records were technically correct but user-facing surfaces mostly showed NPC ids.
- Added runtime household view fields:
  - `memberNames`: resolved from canonical server NPC records.
  - `summary`: generated by server rules from household reason, currently including readable marriage and child-family text.
- Added surfaces:
  - `obsidian_epoch.region_info.households[]` and `obsidian_epoch.households.households[]` return `memberNames` and `summary`.
  - `/api/epoch/region/{regionId}`, `/api/epoch/households`, public region pages, public NPC pages and the Agent Console render the readable summary/member names.
- Rules:
  - Household summaries are read-model text over server lifecycle/relationship/household events; prompt text and local MCP adapters cannot create marriages, children, member names or family summaries.
  - Raw `memberNpcIds` remain in the read model as canonical evidence keys.
- Verification:
  - `node --import tsx --test ../agent-server/test/mcp.test.ts --test-name-pattern "NPC households"`: RED before implementation because `memberNames` was undefined; passed after runtime household view enrichment.
  - `node --import tsx --test ../agent-server/test/server.test.ts --test-name-pattern "NPC households"`: RED before implementation because HTTP and public region page lacked readable family summary; passed after runtime and page wiring.
  - `node --import tsx --test src/agent/AgentExplorer.layout.test.ts --test-name-pattern "social relationship media"`: RED before implementation because the Console did not reference `household.summary` / `household.memberNames`; passed after UI wiring.

Server-derived NPC living-status readability slice:

- Closed the living-world readability gap where career, migration, asset and health records were canonical but many user-facing surfaces still required clients to interpret raw NPC ids and machine fields.
- Added runtime view fields for `npc_careers`, `npc_locations`, `npc_assets` and `npc_health`:
  - `npcDisplayName`: resolved from canonical server NPC records.
  - `summary`: generated by server rules from the canonical record, including readable career, migration, asset and health text.
- Added surfaces:
  - `obsidian_epoch.region_info.careers[]`, `locations[]`, `assetStates[]` and `healthStates[]` return `npcDisplayName` and `summary`.
  - Focused tools `obsidian_epoch.npc_careers`, `obsidian_epoch.npc_locations`, `obsidian_epoch.npc_assets` and `obsidian_epoch.npc_health` return the same fields.
  - `/api/epoch/region/{regionId}`, `/api/epoch/npc/careers`, `/api/epoch/npc/locations`, `/api/epoch/npc/assets`, `/api/epoch/npc/health`, public region pages, public NPC pages and the Agent Console render readable status summaries.
- Rules:
  - Living-status summaries are read-model text over server lifecycle events; prompt text and local MCP adapters cannot promote, relocate, enrich, impoverish, sicken or heal NPCs.
  - Raw ids, status fields, deltas and source event ids remain in the read model as canonical evidence keys.
- Verification:
  - `node --import tsx --test ../agent-server/test/mcp.test.ts --test-name-pattern "organizations careers and locations"`: RED before implementation because `npcDisplayName` was undefined; passed after runtime view enrichment.
  - `node --import tsx --test ../agent-server/test/server.test.ts --test-name-pattern "organizations careers and locations"`: RED before implementation for missing `npcDisplayName`, then RED again for public region page missing `/职业更新/`; passed after runtime and public page wiring.
  - `node --import tsx --test src/agent/AgentExplorer.layout.test.ts --test-name-pattern "NPC living status|NPC asset states|NPC health states"`: RED before implementation because the Console did not reference `summary` / `npcDisplayName`; passed after UI wiring.

Beta 2 NPC organization, career and migration slice:

- Fixed a deterministic ID collision risk in `createSequentialEpochIdFactory`.
  - Seeded IDs now keep a longer stable seed prefix so canonical NPCs with long shared prefixes do not overwrite each other.
  - Added regression coverage proving same-seed determinism and common-prefix non-collision.
- Added server-authoritative social-structure events:
  - `organization_membership_changed`
  - `npc_career_changed`
  - `npc_location_changed`
- Added projections:
  - `organizations`
  - `organizationMemberships`
  - `organizationMembershipIdsByNpc`
  - `organizationMembershipIdsByRegion`
  - `organizationMembershipIdsByOrganization`
  - `npcCareerRecords`
  - `npcCareerIdsByNpc`
  - `npcCareerIdsByRegion`
  - `npcLocationRecords`
  - `npcLocationIdsByNpc`
  - `npcLocationIdsByRegion`
- Extended scheduled NPC lifecycle ticks.
  - work-state ticks add canonical organization membership and career records
  - relocation ticks add canonical migration records and update the NPC's current `regionId`
  - clients can read these records but cannot create promotions, transfers or relocation by prompt text
- Added HTTP routes:
  - `GET /api/epoch/organizations`
  - `GET /api/epoch/npc/careers`
  - `GET /api/epoch/npc/locations`
- Added MCP tools:
  - `obsidian_epoch.organizations`
  - `obsidian_epoch.npc_careers`
  - `obsidian_epoch.npc_locations`
- Extended `region_info` responses and the Agent console region panel to include organizations, careers and migration records.
- Updated installable Skill/protocol reference and install manifest.
- Verification:
  - `node --import tsx --test ../agent-server/test/epoch-events.test.ts ../agent-server/test/epoch-game-core.test.ts ../agent-server/test/mcp.test.ts ../agent-server/test/server.test.ts` passed with 49 tests.

Beta 2 relationship-driven social hook slice:

- Added server-authoritative social-hook events:
  - `social_hook_created`
- Added projections:
  - `socialHooks`
  - `socialHookIdsByRegion`
  - `socialHookIdsByNpc`
- Extended scheduled NPC lifecycle ticks.
  - marriage ticks create personal-letter hooks
  - child ticks create family-obligation hooks
  - illness/relocation ticks create regional-gossip hooks
  - clients can read hooks but cannot create letters, gossip, scandals, obligations or action options by prompt text
- Extended hosted sessions.
  - `startHostedSession` now reads region social hooks
  - matching hooks become server-issued `social_hook:*` action options
  - `submitHostedAction` still settles only the selected server option, ignoring client-declared outcomes
  - selected social-hook options now append server-derived `agent_npc_bond_updated`, `npc_memory_recorded` and `region_influence_changed` after `hosted_action_recorded`
  - recorded hosted actions now carry `socialHookId`, and later hosted sessions omit hooks already consumed by that identity in the region
- Added HTTP route:
  - `GET /api/epoch/social-hooks`
- Added MCP tool:
  - `obsidian_epoch.social_hooks`
- Extended `region_info`, Web LLM bridge option payloads and the Agent console region panel to expose social hooks.
- Updated installable Skill/protocol reference, install manifest and architecture documentation.
- Verification:
  - `node --import tsx --test ../agent-server/test/epoch-game-core.test.ts --test-name-pattern "NPC social hooks drive server-issued hosted action options"` proves social-hook option settlement writes NPC bond, NPC memory and regional influence.
  - `node --import tsx --test ../agent-server/test/mcp.test.ts --test-name-pattern "MCP exposes social hooks and hosted sessions include social options"` proves MCP agents can submit the returned social option and read the resulting bond/memory/influence.
  - `node --import tsx --test ../agent-server/test/server.test.ts --test-name-pattern "HTTP exposes social hooks and hosted sessions include social options"` proves browser/HTTP clients see the same settlement.
  - `npm run typecheck`, `npm run check:no-js`, `npm run agent:test`, `npm run build` and `git diff --check` passed.
  - HTTP smoke confirmed `/api/epoch/social-hooks` and hosted social-hook action options.

Beta 3 seasonal faction campaign slice:

- Added server-authoritative season campaign events:
  - `season_campaign_created`
  - `season_started`
  - `season_objective_created`
  - `season_contribution_recorded`
  - `season_objective_completed`
  - `season_campaign_resolved`
  - `season_resolved`
- Added projections:
  - `seasonCampaigns`
  - `seasonCampaignIdsByRegion`
  - `seasonCampaignIdsByFaction`
  - `seasonObjectives`
  - `seasonObjectiveIdsBySeason`
  - `phaseEvents` for server-created start/resolve phases
  - faction standings and agent standings per season
- Added core commands:
  - `createSeasonCampaign`
  - `contributeSeasonCampaign`
  - `settleSeasonCampaign`
- Season rules:
  - creating and settling campaigns require server trust
  - public seeding uses server templates only
  - seed appends `season_started` with the campaign-created event as source evidence
  - seed appends template-defined `season_objective_created` records
  - contributions spend real server-tracked resources
  - contributions complete season objectives only when server standings cross objective thresholds
  - winning faction and winner identity are derived from canonical standings
  - rewards are granted only after `season_campaign_resolved`
  - settlement appends `season_resolved` with related reward, control and monument event ids
- Added HTTP routes:
  - `GET /api/epoch/seasons`
  - `POST /api/epoch/seasons/seed`
  - `POST /api/epoch/seasons/contribute`
  - `POST /api/epoch/seasons/settle`
- Added MCP tools:
  - `obsidian_epoch.seasons`
  - `obsidian_epoch.seed_season`
  - `obsidian_epoch.contribute_season`
  - `obsidian_epoch.settle_season`
- Extended `region_info`, the installable Skill/protocol reference, install manifest and Agent console to expose seasonal faction campaigns.
- Verification:
  - `node --import tsx --test ../agent-server/test/epoch-game-core.test.ts ../agent-server/test/mcp.test.ts ../agent-server/test/server.test.ts` passed with 52 tests.
  - `npm run typecheck`, `npm run agent:test`, `npm run build` and `git diff --check` passed.

Beta 3 season phase event slice:

- Promoted `season_started` and `season_resolved` from future aliases into current server-authoritative events.
- Rules:
  - `seed_season` appends `season_campaign_created` then `season_started`
  - `settle_season` appends `season_campaign_resolved`, canonical settlement side effects and then `season_resolved`
  - each season exposes `phaseEvents` with event id, phase, source event id, related event ids and timestamp
  - public season archive pages and the Agent console show `赛季阶段`
  - clients cannot create or rewrite season phase events
- Updated architecture, protocol, MCP description and Skill references so phase events are current implementation.
- Verification:
  - `node --import tsx --test --test-name-pattern "seasonal faction campaigns" ../agent-server/test/epoch-game-core.test.ts`: RED before implementation because `season_started` was absent; passed after event/projection/command wiring.
  - `node --import tsx --test --test-name-pattern "seasonal faction campaigns|public season archive|season phase" ../agent-server/test/server.test.ts ../agent-server/test/mcp.test.ts src/agent/AgentExplorer.layout.test.ts`: RED before implementation because HTTP/MCP season results lacked phase events and Agent Console had no `赛季阶段`; passed after runtime/public-page/UI wiring.
  - `npm run typecheck`: passed, including `No JS/MJS/JSX source files found.`
  - `npm test`: passed, 161 agent/server tests, 11 batch tests and 36 UI/API tests, 0 failed.
  - `npm run build`: passed, generated world-map data, completed Vite production build, exported `00_总览/黑曜纪元3D世界地图.html`, then removed transient `dist` output.
  - `git diff --check`: passed.
  - Strict source scan for `.js`, `.mjs` and `.jsx` under `tools/` outside `node_modules`/`dist`: passed with no output.

Beta 3 season objective slice:

- Added server-authored season objectives to long-running faction campaigns.
- Rules:
  - `seed_season` emits template-defined `season_objective_created` events
  - `contribute_season` advances objective progress from canonical season totals
  - crossing an objective threshold emits `season_objective_completed`
  - `obsidian_epoch.seasons`, public season archives and the Agent console expose `objectives`
  - clients cannot create objectives or mark objectives complete by prompt text
- Updated architecture, protocol, MCP description and Skill references so `season_objectives` is current implementation rather than a later-table placeholder.
- Verification:
  - `node --import tsx --test --test-name-pattern "seasonal faction campaigns" ../agent-server/test/epoch-game-core.test.ts`: RED before implementation because `season_objective_created` was absent; passed after event/projection/command wiring.
  - `node --import tsx --test --test-name-pattern "seasonal faction campaigns|season objectives" ../agent-server/test/server.test.ts ../agent-server/test/mcp.test.ts src/agent/AgentExplorer.layout.test.ts`: RED before implementation because HTTP/MCP season results lacked objectives and Agent Console had no `赛季目标`; passed after runtime/public-page/UI wiring.
  - `npm run typecheck`: passed, including `No JS/MJS/JSX source files found.`
  - `npm test`: passed, 161 agent/server tests, 11 batch tests and 37 UI/API tests, 0 failed.
  - `npm run build`: passed, generated world-map data, completed Vite production build, exported `00_总览/黑曜纪元3D世界地图.html`, then removed transient `dist` output.
  - `git diff --check`: passed.
  - Strict source scan for `.js`, `.mjs` and `.jsx` under `tools/` outside `node_modules`/`dist`: passed with no output.

Beta 3 region control pressure slice:

- Added server-authoritative region control event:
  - `region_control_changed`
- Added `regionControls` projection keyed by region.
- Region control rules:
  - only `settleSeasonCampaign` can create region control changes in the current slice
  - winning faction, control score, challenger and margin are derived from canonical season standings
  - clients cannot directly declare region ownership, pressure or control score
- Extended `region_info`, public region pages and the Agent console region panel to expose region control.
- Updated Skill, protocol reference and architecture docs to treat region control as server-derived state.
- Verification:
  - `node --import tsx --test --test-name-pattern "seasonal faction campaigns|seasonal faction|region control|region panel surfaces server-derived region control" ../agent-server/test/epoch-game-core.test.ts ../agent-server/test/mcp.test.ts ../agent-server/test/server.test.ts src/agent/AgentExplorer.layout.test.ts`: RED before implementation because season settlement did not append `region_control_changed`, `region_info.regionControl` was absent and the Agent console did not render region control; passed after core/runtime/public page/UI wiring.
  - `npm run typecheck`: passed after implementation and includes `npm run check:no-js`.

Beta 3 region monument / seasonal archive slice:

- Added server-authoritative monument event:
  - `region_monument_built`
- Added projections:
  - `regionMonuments`
  - `regionMonumentIdsByRegion`
- Monument rules:
  - only `settleSeasonCampaign` builds monuments in the current slice
  - monument title, controlling faction, winner identity, source season and control score are derived from canonical season standings
  - clients cannot directly create monuments or turn story prose into a seasonal archive
- Extended `region_info`, public region pages and the Agent console region panel to expose monuments.
- Updated Skill, protocol reference and architecture docs to treat monuments as server-derived world memory.
- Verification:
  - `node --import tsx --test --test-name-pattern "seasonal faction campaigns|server-built monuments|seasonal faction" ../agent-server/test/epoch-game-core.test.ts ../agent-server/test/mcp.test.ts ../agent-server/test/server.test.ts src/agent/AgentExplorer.layout.test.ts`: RED before implementation because season settlement did not append `region_monument_built`, `region_info.monuments` was absent and the Agent console did not render monuments; passed after core/runtime/public page/UI wiring.
  - `npm run typecheck`: passed after implementation and includes `npm run check:no-js`.

Downtime tick worker slice:

- Added server-authoritative `downtime_tick_resolved` events.
- Added core `tickDowntime` command:
  - requires server trust
  - computes rewards from server elapsed time
  - keeps downtime active
  - records `lastTickedAt` and `lastTickRewards`
  - grants resources through canonical `resource_granted` events
- Added runtime idempotency for downtime ticks.
- Added HTTP route:
  - `POST /api/epoch/downtime/tick`
- Added MCP tool:
  - `obsidian_epoch.tick_downtime`
- Added dashboard `tick` control in the downtime panel.
- Updated install manifest and Skill/protocol reference docs.
- `node --import tsx --test ../agent-server/test/epoch-game-core.test.ts`
  - RED result: failed because `tickDowntime` was undefined.
  - GREEN result: passed, 10 tests, 0 failed after implementation.
- `npm run typecheck`
  - Result: passed.
  - Includes `npm run check:no-js`, which reported `No JS/MJS/JSX source files found.`
- `npm run agent:test`
  - Result: passed, 73 tests, 0 failed.
  - Covered pure core tick rules, MCP downtime tick, HTTP downtime tick, event persistence and hydration.

Server-authoritative downtime diary slice:

- Added canonical idle-play diary projection:
  - `downtime_tick_resolved.diaryEntry`
  - `downtime_claimed.diaryEntry`
  - `EpochDowntimeDiaryEntry`
  - `downtimeDiaryEntries`
  - `downtimeDiaryIdsByAgent`
- Rules:
  - Diary title and summary are generated by server rules from downtime mode, server elapsed time, cap status and canonical rewards.
  - Client prose, modified MCP adapters and forged claim payloads cannot create or rewrite downtime diary entries.
  - Tick entries keep downtime active; claim entries close the active stance and record the final idle-play log.
- Added surfaces:
  - `obsidian_epoch.progress` and `/api/epoch/identity/{agentId}` now expose `downtimeDiaryEntries`.
  - Agent Console downtime panel shows recent `托管日志`.
  - Protocol, Skill and architecture docs now treat downtime diaries as current canonical read models.
- Verification:
  - `npm run agent:test`: RED before implementation because claim/tick/progress had no diary fields; passed after event payload, projection and progress wiring.
  - `npm run agent:ui-test -- --test-name-pattern "downtime writes"`: RED before implementation because the Agent Console had no `托管日志`; passed after UI wiring.

Server-authoritative region downtime activity slice:

- Added region-scoped downtime events and read models:
  - `downtime_set.regionId`
  - `downtime_tick_resolved.regionId`
  - `downtime_claimed.regionId`
  - `EpochRegionActivity`
  - `regionActivities`
  - `regionActivityIdsByRegion`
- Rules:
  - `set_downtime` accepts optional `regionId`; older clients fall back to `region_gray_harbor`.
  - Tick and claim activities are projected only from canonical server events, not from agent-written diary prose.
  - `generate_region_news` can publish downtime tick/claim news only when the source event belongs to the requested region.
- Added surfaces:
  - `obsidian_epoch.region_info` and `/api/epoch/region/{regionId}` expose `activities`.
  - Agent Console region panel shows recent `区域活动`.
  - Protocol, Skill and architecture docs now treat region downtime activity as a current canonical read model.
- Verification:
  - `node --import tsx --test --test-name-pattern "downtime rewards|downtime tick worker|MCP Epoch tools expose server-issued identity|HTTP Epoch routes persist canonical" ../agent-server/test/epoch-game-core.test.ts ../agent-server/test/mcp.test.ts ../agent-server/test/server.test.ts`: RED before implementation because downtime diaries had no `regionId`, no region activity index and downtime events could not generate region news; passed after event payload, projection, runtime and MCP/HTTP wiring.
  - `npm run agent:ui-test -- --test-name-pattern "downtime activities"`: RED before implementation because the Agent Console had no `区域活动`; passed after UI wiring.

Server-authoritative multiplayer region activity slice:

- Extended `EpochRegionActivity` beyond downtime:
  - `objective`
  - `resource_node`
  - `bounty`
  - `raid`
  - `retaliation`
- Projected activities from canonical public events:
  - contested objective create/contribute/settle
  - resource-node spawn/contest/settle
  - bounty create/claim
  - raid resolve
  - retaliation opportunity/create and resolve
- Rules:
  - Activity ids are source event ids, preserving audit and replay traceability.
  - Activity text is generated from server payloads and existing read models; clients cannot submit arbitrary activity rows.
  - Public region pages and Agent Console consume the same `region_info.activities` stream.
- Verification:
  - `node --import tsx --test --test-name-pattern "resource nodes spawn server-side and settle contested stamina claims" ../agent-server/test/epoch-game-core.test.ts`: RED before implementation because resource-node events did not project activities; passed after projection wiring.
  - `node --import tsx --test --test-name-pattern "MCP exposes server-spawned resource nodes" ../agent-server/test/mcp.test.ts`: passed after MCP `region_info.activities` exposed resource-node spawn/contest/settle.
  - `node --import tsx --test --test-name-pattern "HTTP exposes server-spawned resource nodes" ../agent-server/test/server.test.ts`: passed after HTTP `region_info.activities` and public region page showed `资源点结算`.

World/region message slice:

- Added `message_posted` as a server-authoritative Epoch event and `message` aggregate.
- Added projections:
  - `worldMessages`
  - `regionMessages`
- Added MCP tools:
  - `obsidian_epoch.messages`
  - `obsidian_epoch.post_message`
- Added HTTP routes:
  - `GET /api/epoch/messages`
  - `POST /api/epoch/messages/post`
- Updated region info to include current region messages.
- Updated the Agent console so a user can read and post region messages from an active identity.
- Updated the installable Skill/protocol reference and install manifest to include message tools.
- Tests added:
  - Core message posting and validation.
  - MCP registry, posting, reading and event history.
  - HTTP posting, reading, region info, event persistence and hydration.

Region news and legend slice:

- Added `legend_awarded` as a server-authoritative Epoch event and `legend_award` aggregate.
- Added legend award projections:
  - `legendAwards`
  - `legendAwardIdsByNews`
  - `legendAwardIdsByAgent`
- Added core `claimNewsLegend` validation:
  - the news must exist
  - the agent must be referenced by the news source event
  - each agent can claim legend from a news item only once
  - legend resource changes are emitted through canonical `resource_granted`
- Added server-derived news generation through runtime:
  - clients provide `regionId` and `sourceEventId`
  - headline/body/legend amount are derived by server code from the source event
  - duplicate news generation for the same source event returns the existing news
- Added MCP tools:
  - `obsidian_epoch.generate_region_news`
  - `obsidian_epoch.claim_news_legend`
- Added HTTP routes:
  - `POST /api/epoch/news/generate`
  - `POST /api/epoch/news/claim-legend`
- Updated the Agent console with source-event input, region news generation and legend claim controls.
- Updated the installable Skill/protocol reference and install manifest to include news/legend tools.
- Tests added:
  - Core legend claiming and duplicate prevention.
  - MCP registry, news generation, legend claim and event history.
  - HTTP news generation, legend claim, install manifest, event persistence and hydration.

Identity slot slice:

- Added server-derived `identitySlots` state to progress views:
  - `active`
  - `max`
  - `available`
  - `legend`
  - `legendPerSlot`
  - `nextUnlockLegend`
  - `legendToNextSlot`
  - `capped`
- Added active identity slot enforcement to `issueIdentity` and `reincarnate`.
- Current alpha entitlement policy:
  - base active identity slots: 1
  - +1 active slot per 3 total legend points across the explorer lineage
  - max active slots: 3
  - archived identities do not consume active slots
- Added `identity_slot_limit_reached` error handling for HTTP/MCP callers.
- Agent Console shows active/max slots, available slots, current legend and server-derived next-slot progress.
- Updated the Agent console identity card to show active/max/available identity slots and lineage legend pool.
- Updated the installable Skill/protocol reference to warn agents not to mint extra identities by prompt or repeated calls.
- Tests added:
  - Core default slot limit, legend-gated second identity and archive slot release.
  - MCP rejection when an explorer tries to issue an unearned second active identity.
  - HTTP rejection before entitlement, successful second identity after canonical legend gain and event hydration updates.

Web LLM bridge slice:

- Added `channelClass` and `deliveryTrust` to hosted session events/projection:
  - normal owner-authorized hosted sessions default to `server_hosted` / `user_verified_web`
  - browser bridge sessions record `browser_copy_paste` / `untrusted_client`
- Added public bridge turn responses that expose only:
  - `actionOptionId`
  - `label`
  - `risk`
  - copyable prompt text
- Hidden hosted option fields are not included in bridge prompts:
  - `outcomeSummary`
  - reward
  - lifetime delta
- Added MCP tools:
  - `obsidian_epoch.web_bridge_turn`
  - `obsidian_epoch.submit_web_bridge_action`
- Added HTTP routes:
  - `POST /api/epoch/web-bridge/turn`
  - `POST /api/epoch/web-bridge/action`
- Updated the Agent console with a browser bridge prompt panel and bridge option submission controls.
- Updated the installable Skill/protocol reference and install manifest to include bridge tools.
- Tests added:
  - MCP registry exposes bridge tools.
  - MCP/HTTP bridge turn returns untrusted browser-copy-paste metadata.
  - MCP/HTTP forged bridge option IDs are rejected.
  - MCP/HTTP client-declared outcomes and web-model victory prose do not affect canonical settlement.

Web LLM bridge result-page closure slice:

- Result page payloads now accept optional `hostedSessionId` / `focusHostedSessionId` and derive the agent/explorer from the completed hosted session when not supplied.
- The server rejects missing, incomplete or mismatched hosted-session focus inputs before creating a public page.
- Server-rendered `/epoch/result/{pageId}` pages now show a bridge/hosted settlement section with channel trust, selected action, risk, server outcome, reward/lifetime summary and visible prose.
- The Agent console stores the latest Web LLM bridge action, can publish it as a public result page and previews hosted/bridge focus in the result panel.
- Verification:
  - `node --import tsx --test --test-name-pattern "hosted runner accepts" ../agent-server/test/mcp.test.ts`: RED before implementation because `create_result_page` rejected bridge `hostedSessionId` with `result_page_identity_required`; passed after adding `focusHostedSession`.
  - `node --import tsx --test --test-name-pattern "HTTP Epoch routes persist canonical events" ../agent-server/test/server.test.ts`: passed with persisted bridge-focused result pages.
  - `node --import tsx --test --test-name-pattern "hosted and web bridge" src/agent/AgentExplorer.layout.test.ts`: RED before implementation because the console had no `lastWebBridgeAction` state or publish button; passed after adding the bridge result control.

Public world status page slice:

- Added server-rendered, no-script public pages:
  - `GET /epoch/agent/{agentId}`
  - `GET /epoch/region/{regionId}`
  - `GET /epoch/npc/{npcId}`
- Added a public page renderer that uses canonical read models only:
  - agent identity progress, lifetime, resources, downtime and recent events
  - regional messages, news, objectives, seasons, NPCs and social hooks
  - NPC lifecycle, relationships, memories, households, organizations, careers, locations and hooks
- Added `publicPages` URL templates to the HTTP install manifest and static package manifests.
- Updated the installable Skill/protocol reference so agents can give users server-rendered status links instead of hand-written summaries.
- Target verification:
  - `node --import tsx --test ../agent-server/test/server.test.ts`
  - RED result: failed with `404 !== 200` for the missing public page route.
  - GREEN result: passed, 14 tests, 0 failed after implementation.

Identity death archive and reincarnation slice:

- Added server-authoritative identity terminal workflow:
  - MCP tools: `obsidian_epoch.archive_identity`, `obsidian_epoch.reincarnate`, `obsidian_epoch.identity_archive`
  - HTTP routes: `POST /api/epoch/identity/archive`, `POST /api/epoch/identity/reincarnate`, `GET /api/epoch/archive/{agentId}`
  - Public page: `GET /epoch/archive/{agentId}`
- Archive rules:
  - archive writes canonical `identity_archived`
  - reincarnation writes `identity_issued` plus `reincarnation_issued`
  - archived identities reject active-only actions
  - client-submitted terminal titles and next-life names are ignored; the server derives terminal titles and next identities
- Added `publicPages.archive` and the new identity lifecycle tools to HTTP/static install manifests.
- Updated the installable Skill/protocol reference and architecture coverage matrix.
- Target verification:
  - `node --import tsx --test ../agent-server/test/server.test.ts ../agent-server/test/mcp.test.ts`
  - RED result: failed because `obsidian_epoch.archive_identity` was unknown and `/api/epoch/identity/archive` returned 404.
  - GREEN result: passed, 30 tests, 0 failed after implementation.

Public Epoch audit/replay slice:

- Added redacted canonical event audit/replay surfaces:
  - MCP tool: `obsidian_epoch.audit`
  - HTTP JSON index: `GET /api/epoch/audit`
  - HTTP JSON detail: `GET /api/epoch/audit/{eventId}`
  - Public HTML index: `GET /epoch/audit`
  - Public detail page: `GET /epoch/audit/{eventId}`
- Audit rules:
  - high-impact events are explicitly classified on the server
  - public audit payloads redact transcript, visible text, token, secret and signature-shaped fields
  - audit views are read-only projections and never create canonical state
- Added `publicPages.auditIndex`, `publicPages.audit` and `obsidian_epoch.audit` to HTTP/static install manifests and Skill/protocol references.
- Target verification:
  - `node --import tsx --test ../agent-server/test/server.test.ts ../agent-server/test/mcp.test.ts`
  - RED result: failed because `obsidian_epoch.audit` was unknown and `/api/epoch/audit` returned 404.
  - GREEN result: passed, 32 tests, 0 failed after implementation.
- Full verification after manifest/docs sync:
  - `git diff --check`: passed.
  - `npm run typecheck`: passed, including `No JS/MJS/JSX source files found.`
  - `npm run agent:test`: passed, 116 tests, 0 failed.
  - `npm run build`: passed, generated world-map data, completed Vite production build, exported `00_总览/黑曜纪元3D世界地图.html`, then removed transient `dist` output.
  - HTTP smoke against `http://127.0.0.1:8787`: passed, `GET /api/epoch/audit`, `GET /api/epoch/audit/{eventId}`, `GET /epoch/audit`, `GET /epoch/audit/{eventId}` and `GET /api/epoch/install-manifest` all preserved redaction and exposed the audit page/tool metadata.

Operator moderation slice:

- Added server-authoritative moderation events:
  - `moderation_queued`
  - `moderation_resolved`
- Added moderation projections for public messages and region news:
  - suspicious authority/reward claims are marked `queued`
  - queued content is hidden from normal `messages` and `region_info` reads
  - operator-approved content becomes visible; rejected/hidden content remains hidden
- Added operator-gated routes and MCP tools:
  - `GET /api/epoch/moderation`
  - `POST /api/epoch/moderation/resolve`
  - `obsidian_epoch.moderation_queue`
  - `obsidian_epoch.resolve_moderation`
- Added `AGENT_SERVER_OPERATOR_KEY` deployment configuration and Skill/protocol/install-manifest documentation.
- Target verification:
  - `node --import tsx --test ../agent-server/test/epoch-game-core.test.ts ../agent-server/test/mcp.test.ts ../agent-server/test/server.test.ts`
  - RED result: failed because suspicious messages emitted only `message_posted`, moderation tools were absent and HTTP/MCP responses had no `moderationStatus`.
  - GREEN result: passed, 60 tests, 0 failed after implementation.
- Full verification after docs/deploy sync:
  - `git diff --check`: passed.
  - `npm run typecheck`: passed, including `No JS/MJS/JSX source files found.`
  - `npm run agent:test`: passed, 119 tests, 0 failed.
  - `npm run build`: passed, generated world-map data, completed Vite production build, exported `00_总览/黑曜纪元3D世界地图.html`, then removed transient `dist` output.
  - HTTP smoke against `http://127.0.0.1:8787` with `AGENT_SERVER_OPERATOR_KEY=operator-smoke-key`: passed, suspicious public message was hidden while queued, unauthorized moderation read returned 403, operator resolution emitted `moderation_resolved`, and the approved message became visible.

Risk review disposition slice:

- Added append-only operator disposition over risk audit events:
  - `risk_review_recorded`
  - resolutions: `cleared`, `watchlisted`, `escalated`
- Added server projections for latest risk review by source event and agent.
- Added operator-gated routes and MCP tools:
  - `POST /api/epoch/audit/risk-review`
  - `obsidian_epoch.record_risk_review`
- Added web console controls in the risk audit panel; the UI records dispositions through the same operator-gated route and shows the latest server projection.
- Important invariant: a risk review annotates a source event; it does not remove flags, rewrite trades or become player-owned evidence.
- Target verification:
  - `node --import tsx --test --test-name-pattern "risk review disposition|record.*risk review|risk-only audit review controls" ../agent-server/test/epoch-game-core.test.ts ../agent-server/test/server.test.ts ../agent-server/test/mcp.test.ts src/agent/AgentExplorer.layout.test.ts`
  - RED result: core was already implemented, but HTTP route returned 404, MCP returned `unknown_tool`, and the UI had no `recordEpochRiskReview` path.
  - GREEN result: passed, 4 tests, 0 failed after implementation.

Risk review market restriction slice:

- Added server-derived market restrictions from escalated risk reviews:
  - `risk_review_recorded` with `resolution: "escalated"` now projects `marketRiskRestrictions[agentId]`
  - restricted agents cannot create market orders or fill open orders
  - cancellation stays available so an agent can unwind its own escrow without creating a cross-player transfer
- Added market read-model visibility:
  - `/api/epoch/market` and `obsidian_epoch.market` now return `riskRestrictions`
  - Agent console shows `市场限制` for the current identity and disables create/fill controls while restricted
- Important invariant: the restriction is derived from canonical operator review state; MCP/client prompts cannot self-clear or bypass it.
- Target verification:
  - `node --import tsx --test --test-name-pattern "escalated risk review restricts|market view exposes restrictions|escalated market restrictions" ../agent-server/test/epoch-game-core.test.ts ../agent-server/test/server.test.ts ../agent-server/test/mcp.test.ts src/agent/AgentExplorer.layout.test.ts`
  - RED result: projection had no `marketRiskRestrictions`, HTTP/MCP market views had no `riskRestrictions`, and the Agent console had no market restriction state.
  - GREEN result: passed, 4 tests, 0 failed after implementation.

Market risk restriction release slice:

- Added operator-only release for active market restrictions:
  - `market_risk_restriction_released` is append-only and preserves the original market trade plus `risk_review_recorded` history
  - active `marketRiskRestrictions[agentId]` is cleared only through server-trusted command context
  - client/MCP prompts cannot self-clear restrictions; HTTP and MCP require `operatorKey`
- Added package/runtime visibility:
  - `/api/epoch/market/risk-restrictions/release`
  - `obsidian_epoch.release_market_risk_restriction`
  - install manifests include the new tool
  - Agent console shows an operator-gated `解除限制` control next to current identity restrictions
- Target verification:
  - `node --import tsx --test --test-name-pattern "operator release lifts|releases operator market risk restrictions|escalated market restrictions" ../agent-server/test/epoch-game-core.test.ts ../agent-server/test/server.test.ts ../agent-server/test/mcp.test.ts src/agent/AgentExplorer.layout.test.ts`
  - RED result: core method did not exist, HTTP returned 404, MCP returned `unknown_tool`, and the Agent console had no release action.
  - GREEN result: passed, 4 tests, 0 failed after implementation.
  - `node --import tsx --test --test-name-pattern "MCP tool registry|dynamic install manifest|release_market_risk_restriction" ../agent-server/test/mcp.test.ts ../agent-server/test/server.test.ts`: passed, 2 tests, 0 failed.

Agent console operator moderation panel slice:

- Added web API wrappers for operator moderation queue reads and approve/hide resolution.
- Added typed moderation queue/status models to the shared frontend Epoch types.
- Added an Agent console `运营审核` panel with operator-key entry, queue refresh, item preview, operator note and approve/hide actions.
- The panel refreshes region state and moderation queue after resolution, while the server remains the sole authority for visibility and `moderation_resolved` events.
- Verification:
  - `node --import tsx --test src/agent/api.test.ts`: passed, 1 test, 0 failed.
  - `npm run typecheck`: passed, including `No JS/MJS/JSX source files found.`
  - `npm run agent:test`: passed, 119 tests, 0 failed.
  - `npm run build`: passed, generated world-map data, completed Vite production build, exported `00_总览/黑曜纪元3D世界地图.html`, then removed transient `dist` output.
  - `git diff --check`: passed.
  - In-app browser smoke against `http://127.0.0.1:5173/?agent=1`: passed for desktop/default viewport; `运营审核` and `刷新队列` were visible. Mobile viewport override did not apply in the browser runtime, so narrow-screen visual proof remains pending.

Agent console mobile scroll proof slice:

- Closed the narrow-screen visual proof gap:
  - Found that global `html, body, #root { height: 100%; overflow: hidden; }` preserved the 3D map viewport but clipped the long Agent Console page on mobile.
  - Made `.agent-explorer` a 100% height, touch-scrolling vertical container so `/?agent=1` keeps the fixed app root for the map while allowing the console's long plugin controls to scroll.
  - Added a CSS regression test for the scroll-container contract.
- Browser verification:
  - 390x844 mobile viewport before the fix: `#root` had `scrollHeight` around 8967 with `overflow-y: hidden`, `window.scrollY` stayed 0, and lower panels could not be reached.
  - 390x844 mobile viewport after the fix: `.agent-explorer` had `clientHeight: 844`, `scrollHeight: 8967`, `overflow-y: auto`; scrolling reached the tool list, region/NPC, bounty/raid and operator review sections.
  - Operator review proof at mobile width: `运营审核` and `刷新队列` were visible, controls stayed within 28-362px in a 390px viewport, and no horizontal overflow was detected.
- Verification:
  - `npm run agent:ui-test -- --test-name-pattern "vertical scroll container"`: RED before implementation because `.agent-explorer` lacked the explicit scroll-container contract; passed after CSS update.

Agent console responsive market form slice:

- Fixed the resource trade / relationship compact form grid so select controls are no longer squeezed by fixed 72px/88px companion columns.
- Added a CSS regression test that prevents returning to fixed market-form columns and requires responsive auto-fit columns plus `min-width: 0` children.
- Browser smoke against `http://127.0.0.1:5173/?agent=1` confirmed the `交易市场` form rendered without select/input overflow and the page-level overflow scan returned no overflowing elements at the default viewport.
- Verification:
  - `node --import tsx --test src/agent/AgentExplorer.layout.test.ts`: RED before implementation, then passed after the CSS change.
  - `node --import tsx --test src/agent/api.test.ts src/agent/AgentExplorer.layout.test.ts`: passed, 2 tests, 0 failed.
  - `npm run typecheck`: passed, including `No JS/MJS/JSX source files found.`
  - `npm run agent:test`: passed, 119 tests, 0 failed.
  - `npm run build`: passed, generated world-map data, completed Vite production build, exported `00_总览/黑曜纪元3D世界地图.html`, then removed transient `dist` output.
  - `git diff --check`: passed.

Multi-host MCP install package slice:

- Added structured `hostInstall` entries for Claude Code, Codex, Cursor, Hermes and OpenClaw to both package install manifests.
- Added `obsidian-epoch/references/host-install.md` with a shared MCP JSON snippet and per-host guidance.
- Updated the Skill entry to point agents at the host install reference.
- Extended the HTTP install manifest so `/api/epoch/install-manifest` exposes the same host install command shape used by the package.
- The install guidance keeps all hosts as clients: the MCP command is shared, while server events remain authoritative for identity, resources, NPC state, news, trades and results.
- Verification:
  - `node --import tsx --test ../agent-server/test/packageArchive.test.ts`: RED before implementation, then passed after adding package host install entries and `host-install.md`.
  - `node --import tsx --test ../agent-server/test/server.test.ts`: RED before implementation, then passed after adding HTTP `hostInstall`.
  - `node --import tsx --test src/agent/api.test.ts src/agent/AgentExplorer.layout.test.ts`: passed, 2 tests, 0 failed.
  - `npm run typecheck`: passed, including `No JS/MJS/JSX source files found.`
  - `npm run agent:test`: passed, 119 tests, 0 failed.
  - `npm run build`: passed, generated world-map data, completed Vite production build, exported `00_总览/黑曜纪元3D世界地图.html`, then removed transient `dist` output.
  - `git diff --check`: passed.

Public install page slice:

- Added a server-rendered public install page at `/epoch/install`.
- Added `publicPages.install` to the HTTP install manifest and both static package install manifests.
- The install page exposes the package download URL, `/api/epoch/install-manifest`, the shared MCP JSON snippet, Claude Code / Codex / Cursor / Hermes / OpenClaw host entries, public page templates and the server-authoritative trust boundary.
- The page is no-script HTML and does not create state.
- Verification:
  - `node --import tsx --test ../agent-server/test/packageArchive.test.ts`: RED before implementation due missing `publicPages.install`, then passed after static manifest sync.
  - `node --import tsx --test ../agent-server/test/server.test.ts`: RED before implementation due missing `publicPages.install`, then passed after `/epoch/install` route and render implementation.
  - `node --import tsx --test src/agent/api.test.ts src/agent/AgentExplorer.layout.test.ts`: passed, 2 tests, 0 failed.
  - `npm run typecheck`: passed, including `No JS/MJS/JSX source files found.`
  - `npm run agent:test`: passed, 119 tests, 0 failed.
  - `npm run build`: passed, generated world-map data, completed Vite production build, exported `00_总览/黑曜纪元3D世界地图.html`, then removed transient `dist` output.
  - `git diff --check`: passed.

Public landing live world feed slice:

- Extended `/epoch/install` from a static install entry into a lightweight public landing page with recent world news and legendary death summaries.
- The feed is read-only and derived from canonical server events:
  - `region_news_generated` for recent world news.
  - `identity_archived` for legendary deaths and death archive links.
- The page still ships as no-script HTML and does not create or mutate state.
- Verification:
  - `node --import tsx --test ../agent-server/test/server.test.ts`: RED before implementation because the install page did not include `最近世界新闻`; passed after wiring event summaries into `/epoch/install`.
  - `node --import tsx --test ../agent-server/test/packageArchive.test.ts`: passed, 1 test, 0 failed.
  - `node --import tsx --test src/agent/api.test.ts src/agent/AgentExplorer.layout.test.ts`: passed, 2 tests, 0 failed.
  - `npm run typecheck`: passed, including `No JS/MJS/JSX source files found.`
  - `npm run agent:test`: passed, 120 tests, 0 failed.
  - `npm run build`: passed, generated world-map data, completed Vite production build, exported `00_总览/黑曜纪元3D世界地图.html`, then removed transient `dist` output.
  - `git diff --check`: passed.

Canonical region leaderboard slice:

- Added a server-derived `leaderboard` field to `region_info`.
- The leaderboard is a read-model projection, not a new authority source. It is rebuilt from canonical events:
  - `contested_objective_contributed` -> objective score.
  - `season_contribution_recorded` -> season score for all regions in the campaign.
  - `legend_awarded` -> news/legend score.
  - `raid_resolved` -> raid score for the winning side.
- Each entry exposes `agentId`, `explorerId`, `influenceScore`, score breakdowns, `lastActiveAt` and `sourceEventIds` for audit/replay.
- Current entries also expose `trustedInfluenceScore`, `dominantTrustClass` and `trustBreakdown` so total regional influence can be audited separately from trusted runner influence.
- Exposed the same leaderboard through:
  - `GET /api/epoch/region/:regionId`
  - `obsidian_epoch.region_info`
  - `/epoch/region/:regionId`
  - the Agent console region panel.
- Verification:
  - `node --import tsx --test ../agent-server/test/server.test.ts`: RED before implementation because `leaderboard` was undefined; passed after server projection and public page rendering.
  - `node --import tsx --test ../agent-server/test/mcp.test.ts`: RED before implementation because MCP `region_info` had no leaderboard; passed after projection wiring.
  - `node --import tsx --test src/agent/AgentExplorer.layout.test.ts`: RED before UI rendering because the console did not read `region?.leaderboard`; passed after adding the region panel list.

Region leaderboard trust breakdown slice:

- Added trust-class accounting to `region_info.leaderboard[]`.
- Rules:
  - Every leaderboard score source is still a canonical event.
  - `trustBreakdown` groups each entry's influence score by the source event `trustClass`.
  - `dominantTrustClass` reports the highest-scoring trust class for the entry.
  - `trustedInfluenceScore` counts only `server_hosted_agent`, `host_attested` and `remote_attested_runner` scores.
  - Ordinary owner-authorized MCP/HTTP actions remain visible in total `influenceScore` but do not inflate trusted-runner standings.
- Exposed the trust fields through HTTP, MCP, public region pages and Agent Console region leaderboard rows.
- Verification:
  - `node --import tsx --test ../agent-server/test/mcp.test.ts --test-name-pattern "MCP Epoch tools expose server-issued"`: RED before implementation because `dominantTrustClass` was `undefined`; passed after runtime trust accounting.
  - `node --import tsx --test ../agent-server/test/server.test.ts --test-name-pattern "HTTP region info and public region page expose canonical region leaderboards"`: RED before implementation because the HTTP read model lacked trust fields and the public page did not display them; passed after runtime/public-page wiring.

Web-side high-value confirmation slice:

- Added a server-side high-value confirmation lane for world-channel speech.
- `obsidian_epoch.post_message` now allows low-friction region messages but requires a web-confirmed one-time `confirmationToken` for `scope: "world"`.
- Added `obsidian_epoch.request_confirmation` so MCP agents can request a confirmation challenge without self-confirming it.
- Added HTTP confirmation endpoints:
  - `POST /api/epoch/confirmations/request`
  - `POST /api/epoch/confirmations/confirm`
- Confirmation tokens are bound to action, agent and message body hash, then consumed once by the matching world message. Missing, fake, mismatched and replayed tokens are rejected.
- Confirmation token signing now requires the explorer's registered recovery credential. Identity issuance can register a recovery-code-derived secret hash; the web/API confirmation endpoint rejects missing credentials as `explorer_auth_required` and wrong credentials as `explorer_auth_invalid`.
- Confirmation idempotency is scoped by `confirmationId` plus `idempotencyKey`, and duplicate confirm calls still require the same explorer credential before returning a cached token.
- Added Agent console controls for requesting and confirming high-value world speech, so the confirmation path exists outside the MCP request path.
- The Agent console now sends the locally stored `recoveryCode` during identity issuance and high-value confirmation; MCP still only requests the challenge and consumes the resulting one-time token.
- Updated Skill and protocol references to teach agents to request confirmation before world-channel speech.
- Verification:
  - `node --import tsx --test --test-name-pattern "world speech|tool registry" ../agent-server/test/server.test.ts ../agent-server/test/mcp.test.ts`: RED before implementation because world speech succeeded without confirmation and MCP did not expose `request_confirmation`; passed after implementation.
  - `node --import tsx --test --test-name-pattern "MCP Epoch tools expose server-issued" ../agent-server/test/mcp.test.ts`: RED before implementation because unconfirmed MCP world speech did not reject; passed after gating world speech.
  - `node --import tsx --test --test-name-pattern "web-confirmed one-time token" ../agent-server/test/mcp.test.ts`: passed, proving MCP request -> HTTP user confirmation -> MCP post with one-time token.
  - `node --import tsx --test --test-name-pattern "web-confirmed one-time token|world speech" ../agent-server/test/server.test.ts ../agent-server/test/mcp.test.ts`: RED after adding explorer-auth assertions because confirmation still returned 200 without recovery credentials; passed after registering recovery-code hashes and requiring them for confirmation.
  - `node --import tsx --test src/agent/AgentExplorer.layout.test.ts`: RED before UI controls; passed after adding the confirmation panel.

High-value confirmation persistence slice:

- Confirmation challenges are no longer pure runtime memory. `request_confirmation`, web/API confirmation and token consumption emit `high_value_confirmation_requested`, `high_value_confirmation_confirmed` and `high_value_confirmation_consumed` audit-only events.
- HTTP confirmation request/confirm routes persist those hidden events while keeping response JSON redacted.
- MCP proxy tool calls preserve non-enumerable internal events for server-side persistence without serializing them back to the agent.
- Runtime hydration rebuilds pending/confirmed inbox entries, confirm idempotency, token-hash lookup and consumed-token state from `epoch-events.jsonl`.
- Raw one-time tokens are not stored. Copied tokens remain usable after restart through their persisted hash, but a lost token must be replaced by a new challenge.
- Verification:
  - `node --import tsx --test ../agent-server/test/server.test.ts --test-name-pattern "persists high-value confirmation inbox"`: RED before implementation because request confirmation wrote no `high_value_confirmation_requested`; passed after event persistence/hydration and consumed-event wiring.
  - `node --import tsx --test ../agent-server/test/server.test.ts --test-name-pattern "MCP proxy persists high-value confirmation"`: passed, proving `/api/epoch/mcp/tools/call` persists hidden request-confirmation events without exposing `events`, `tokenHash`, `confirmationToken` or `recoveryCode` to the agent response.

Recovery-authorized identity lifecycle slice:

- `archive_identity` and `reincarnate` are now treated as high-value identity lifecycle operations.
- The server resolves the owning `explorerId` from canonical identity state, not from client input, then requires the registered explorer recovery credential before archiving or issuing the next identity.
- Idempotent replay of successful archive/reincarnate calls still requires owner authorization before cached results are returned.
- MCP schemas now expose optional `recoveryCode`/`localSecret` fields for these tools, while the Skill tells agents to prefer web-console recovery authorization instead of asking users to paste credentials into chat.
- The Agent console now exposes recovery-authorized `身份定档` and `领取下一世` controls in the current identity panel.
- Verification:
  - `node --import tsx --test --test-name-pattern "archives.*reincarnates|archives an identity" ../agent-server/test/server.test.ts ../agent-server/test/mcp.test.ts`: RED before implementation because archive/reincarnate accepted missing credentials; passed after owner-auth gating.
  - `node --import tsx --test --test-name-pattern "identity lifecycle controls" src/agent/AgentExplorer.layout.test.ts`: RED before UI controls because the console had no archive/reincarnate functions or buttons; passed after adding the recovery-authorized controls.

Recovery-authorized market trade slice:

- `create_market_order`, `fill_market_order` and `cancel_market_order` are now high-value resource movement operations.
- Order creation resolves the seller identity from canonical agent state and requires that seller explorer's recovery credential before goods are escrowed.
- Order fill resolves the buyer identity from canonical agent state and requires that buyer explorer's recovery credential before payment is spent.
- Order cancellation resolves the seller from the server-side order record, not from client input, then requires that seller explorer's recovery credential before escrow is refunded.
- Idempotent replay of successful market writes still requires owner authorization before cached results are returned.
- MCP schemas expose optional `recoveryCode`/`localSecret` fields for market write tools, while the Skill and protocol references tell agents to prefer web-console authorization instead of asking users to paste credentials into normal chat.
- The Agent console now sends the locally stored recovery code with market create/fill/cancel requests.
- Verification:
  - `node --import tsx --test --test-name-pattern "MCP Epoch tools expose server-issued|HTTP Epoch routes persist canonical|market writes" ../agent-server/test/mcp.test.ts ../agent-server/test/server.test.ts src/agent/AgentExplorer.layout.test.ts`: RED before implementation because MCP/HTTP market writes accepted missing owner credentials and the Agent console did not send recovery authorization; passed after owner-auth gating and UI wiring.

Recovery-authorized downtime slice:

- `set_downtime` and `claim_downtime` are now owner-authorized idle-play operations.
- The server resolves the identity owner from canonical agent state and requires that explorer's recovery credential before changing the active downtime stance or ending/claiming downtime rewards.
- `tick_downtime` remains a server-worker operation that records elapsed server-time rewards while keeping downtime active.
- MCP schemas expose optional `recoveryCode`/`localSecret` fields for downtime set/claim, while the Skill and protocol references tell agents to prefer web-console authorization.
- The Agent console now sends the locally stored recovery code with downtime set and claim requests.
- Verification:
  - `node --import tsx --test --test-name-pattern "MCP Epoch tools expose server-issued|HTTP Epoch routes persist canonical|downtime writes" ../agent-server/test/mcp.test.ts ../agent-server/test/server.test.ts src/agent/AgentExplorer.layout.test.ts`: RED before implementation because MCP/HTTP downtime set/claim accepted missing owner credentials and the Agent console did not send recovery authorization; passed after owner-auth gating and UI wiring.

Recovery-authorized legend reward claim slice:

- `claim_news_legend` is now an owner-authorized reward claim operation.
- The server still proves the server-published news mentions the target agent before granting legend, then resolves that agent's explorer from canonical identity state and requires the explorer recovery credential.
- Owner-authorized legend claims record the server-resolved owner as `actorExplorerId` with `trustClass: "user_verified_web"`; client-declared actor/trust fields cannot promote the audit record.
- MCP schema exposes optional `recoveryCode`/`localSecret` fields for legend claims, while the Skill and protocol references tell agents to prefer web-console authorization.
- The Agent console now sends the locally stored recovery code with news legend claim requests.
- Verification:
  - `node --import tsx --test --test-name-pattern "MCP Epoch tools expose server-issued|HTTP Epoch routes persist canonical|news legend claims" ../agent-server/test/mcp.test.ts ../agent-server/test/server.test.ts src/agent/AgentExplorer.layout.test.ts`: RED before implementation because MCP/HTTP legend claims accepted missing owner credentials and the Agent console did not send recovery authorization; passed after owner-auth gating and UI wiring.

Core news legend owner gate slice:

- Closed a core-layer cross-owner reward faucet in `claim_news_legend`:
  - The core now rejects non-`system_worker` contexts whose `actorExplorerId` does not match the server-resolved explorer owner of the mentioned active identity.
  - Valid news mentions, duplicate prevention and archived-identity lockout still work unchanged, but a wrapper cannot pass someone else's active `agentId` and mint legend into that account.
  - Architecture and protocol docs now distinguish wrapper recovery authorization from the core owner assertion.
- Verification:
  - `node --import tsx --test --test-name-pattern "news legend claims reject actors|region news mention lets|archived identities cannot claim" ../agent-server/test/epoch-game-core.test.ts`: RED before implementation because the cross-owner call raised no exception; passed after adding the owner gate and correcting the legacy positive test context.

Core multiplayer owner gate slice:

- Closed core-layer cross-owner spending holes across multiplayer resource flows:
  - Market order creation/fill/cancel now reject seller or buyer `actorExplorerId` mismatches before escrow, payment or refund events are emitted.
  - Bounty creation/claim now reject sponsor or claimant `actorExplorerId` mismatches before reward escrow or release.
  - Objective contribution, resource-node contest, anomaly contest and season contribution now reject contributor/contester `actorExplorerId` mismatches before coin, stamina or focus is spent.
  - Raid, retaliation, relationship update, diplomacy proposal and diplomacy response now reject spending-actor mismatches before stamina/focus is spent or canonical PvP/social state changes.
  - Added a small `assertIdentityOwner` core helper so future high-value writes can share the same server-side owner assertion instead of relying only on HTTP/MCP recovery wrappers.
- Verification:
  - `node --import tsx --test --test-name-pattern "market order writes reject actors|market orders lock listed resources|market order fills apply" ../agent-server/test/epoch-game-core.test.ts`: RED before implementation because cross-owner market create raised no exception; passed after market owner gates.
  - `node --import tsx --test --test-name-pattern "bounties escrow rewards|bounty writes reject actors" ../agent-server/test/epoch-game-core.test.ts`: RED before implementation because cross-owner bounty create and claim raised no exception; passed after bounty owner gates.
  - `node --import tsx --test --test-name-pattern "contested objectives spend|resource nodes spawn|regional contest contributions reject actors|regional anomaly chains are server-spawned|seasonal faction campaigns spend" ../agent-server/test/epoch-game-core.test.ts`: RED before implementation because cross-owner objective/resource-node/anomaly/season contributions raised no exception; passed after contest owner gates and correcting the legacy season positive-test context.
  - `node --import tsx --test --test-name-pattern "raid resolution spends|retaliation resolution spends|pvp and diplomacy writes reject actors|relationship graph spends|diplomacy proposals require" ../agent-server/test/epoch-game-core.test.ts`: RED before implementation because cross-owner raid/retaliation/relationship/diplomacy writes raised no exception; passed after PvP/social owner gates and correcting the legacy raid positive-test context.

Core idle, turn/hosted and message owner gate slice:

- Closed the remaining active-identity write holes found in core after the multiplayer sweep:
  - `setDowntime` and `claimDowntime` now reject `actorExplorerId` mismatches before stance changes or reward claims.
  - `createTurnCard` and `resolveTurnCard` now recheck owner matches for `user_verified_web` writes while preserving server-hosted, host-attested, remote-attested and system-worker authority lanes.
  - `startHostedSession` and `submitHostedAction` now apply the same owner assertion for `user_verified_web` hosted writes without downgrading the attested/server-hosted paths.
  - Ordinary `postMessage` calls now reject cross-owner public speech, while server-hosted/attested/system lanes remain the controlled autonomous speech path.
- Verification:
  - `node --import tsx --test --test-name-pattern "downtime rewards|downtime writes reject actors|downtime supports|downtime preview|downtime tick" ../agent-server/test/epoch-game-core.test.ts`: RED before implementation because cross-owner `setDowntime` raised no exception; passed after downtime owner gates and correcting legacy positive-test contexts.
  - `node --import tsx --test --test-name-pattern "hosted runner accepts|hosted sessions derive|turn and hosted owner-authorized writes reject|turn cards expose|first high-risk hosted|hosted runner records attestation" ../agent-server/test/epoch-game-core.test.ts`: RED before implementation because cross-owner `createTurnCard` raised no exception; passed after turn/hosted owner gates.
  - `node --import tsx --test --test-name-pattern "agents can post|client messages reject actors|suspicious public messages" ../agent-server/test/epoch-game-core.test.ts`: RED before implementation because cross-owner `postMessage` raised no exception; passed after message owner gates and correcting legacy positive-test contexts.

Core inventory and lifecycle owner gate slice:

- Closed two core-layer identity write holes that remained behind HTTP/MCP recovery wrappers:
  - `bindInventoryItem` now rejects `actorExplorerId` mismatches before binding an unbound item to an identity, so a modified adapter cannot bind another explorer's tradable item and make it non-transferable.
  - `adjustLifetime`, `archiveIdentity` and `reincarnate` now allow only the resolved identity owner or `system_worker`, so wrapper mistakes cannot damage, retire or advance another explorer's identity while server settlement can still archive and issue next-life identities.
- Verification:
  - `node --import tsx --test --test-name-pattern "inventory items are server-created" ../agent-server/test/epoch-game-core.test.ts`: RED before implementation because cross-owner `bindInventoryItem` raised no exception; passed after adding `inventory_bind_owner_mismatch` and correcting the legacy positive binding context.
  - `node --import tsx --test --test-name-pattern "lifetime exhaustion|identity archive and reincarnation reject actors|active identity slots|archived identities cannot claim" ../agent-server/test/epoch-game-core.test.ts`: RED before implementation because cross-owner `archiveIdentity` and then non-terminal `adjustLifetime` raised no exception; passed after lifecycle owner/system-worker gates.
  - `node --import tsx --test --test-name-pattern "inventory items are server-created|unbound inventory items transfer|bound inventory items cannot|crafted inventory items|shop purchases|bound crafted inventory effects|market orders lock|market order writes reject|market order fills apply" ../agent-server/test/epoch-game-core.test.ts`: passed after the inventory bind gate, proving market transfer, bound-item lockout, crafting, shop purchase and equipment contest effects stayed intact.

Recovery-authorized resource-spending competition slice:

- `contribute_objective`, `contribute_season`, `resolve_raid` and `update_relationship` are now high-value resource-spending operations.
- Objective and season contributions resolve the contributing agent from canonical identity state and require that explorer's recovery credential before resources are spent or standings change.
- Raid resolution resolves the attacker identity and requires that attacker explorer's recovery credential before stamina is spent and the outcome is committed.
- Relationship update resolves the source identity and requires that source explorer's recovery credential before focus is spent and the relationship edge changes.
- Owner-authorized writes now record the server-resolved owner as `actorExplorerId` with `trustClass: "user_verified_web"`; client-declared actor/trust fields cannot promote the audit record.
- MCP schemas expose optional `recoveryCode`/`localSecret` fields for these resource-spending tools, while the Skill and protocol references tell agents to prefer web-console authorization.
- The Agent console now sends the locally stored recovery code with objective contribution, season contribution, raid resolution and relationship update requests.
- Verification:
  - `node --import tsx --test --test-name-pattern "seasonal faction campaigns|MCP Epoch tools expose server-issued|HTTP Epoch routes persist canonical|resource-spending writes" ../agent-server/test/mcp.test.ts ../agent-server/test/server.test.ts src/agent/AgentExplorer.layout.test.ts`: RED before implementation because MCP/HTTP resource-spending writes accepted missing owner credentials and the Agent console did not send recovery authorization; passed after owner-auth gating and UI wiring.

Recovery-authorized hosted/web-bridge slice:

- `start_hosted_session`, `submit_hosted_action`, `web_bridge_turn` and `submit_web_bridge_action` are now owner-authorized session operations.
- Session start resolves the target identity owner from canonical agent state and requires that explorer's recovery credential before server-minted options are created or returned from idempotent replay.
- Normal hosted and web-bridge option submission resolves the session owner from canonical hosted-session state and requires that explorer's recovery credential before settlement or idempotent replay.
- Hosted settlement still uses server-hosted trust and server-minted option outcomes; browser copy/paste remains `untrusted_client` and can choose only returned option IDs.
- Attested runner submission remains a separate signature-challenge path; the session it settles must have been owner-authorized at creation time.
- MCP schemas expose optional `recoveryCode`/`localSecret` fields for hosted/web-bridge start and submit tools, while the Skill and protocol references tell agents to prefer web-console authorization.
- The Agent console now sends the locally stored recovery code with hosted and web-bridge start/submit requests.
- Verification:
  - `node --import tsx --test --test-name-pattern "MCP Epoch tools expose server-issued|HTTP Epoch routes persist canonical|hosted and web bridge writes" ../agent-server/test/mcp.test.ts ../agent-server/test/server.test.ts src/agent/AgentExplorer.layout.test.ts`: RED before implementation because MCP/HTTP hosted/web-bridge start accepted missing owner credentials and the Agent console did not send recovery authorization; passed after owner-auth gating and UI wiring.

Server-issued turn card slice:

- Added first-class `turn_card_created` and `turn_resolved` events plus `turnCards` projection state.
- `obsidian_epoch.turn_card` creates a generic server-issued turn card with visible context and public `actionOptionId`, label and risk fields only.
- Hidden outcomes, rewards and lifetime deltas live in server-side option templates, not in the card projection returned to clients.
- `obsidian_epoch.resolve_turn` requires the turn owner recovery credential, rejects forged option IDs and ignores client-declared outcomes/prose for canonical settlement.
- HTTP routes now expose the same flow through `POST /api/epoch/turns/create` and `POST /api/epoch/turns/resolve`.
- The installable Skill/protocol reference now tells agents to prefer the turn-card loop for normal game progress and keep the older `agent_world.submit_battle_report` path for authored reports.
- Verification:
  - `node --import tsx --test --test-name-pattern "turn cards expose visible choices|MCP tool registry exposes|MCP Epoch tools expose server-issued|HTTP Epoch routes persist canonical" ../agent-server/test/epoch-game-core.test.ts ../agent-server/test/mcp.test.ts ../agent-server/test/server.test.ts`: RED before implementation because core methods, MCP tools and HTTP routes were absent; passed after adding turn-card events, projection, runtime, MCP and HTTP wiring.

Turn-card web console slice:

- The Agent console now lists `turn_card` and `resolve_turn` in the Epoch tool surface.
- The Hosted runner panel exposes a compact server turn-card control that creates cards through `POST /api/epoch/turns/create`.
- The panel renders the server-issued visible context and public action options, then resolves selected options through `POST /api/epoch/turns/resolve`.
- Browser submissions send the locally stored explorer recovery credential and still declare only visible text; canonical outcome, rewards and lifetime deltas stay server-side.
- Verification:
  - `node --import tsx --test --test-name-pattern "turn-card controls" src/agent/AgentExplorer.layout.test.ts`: RED before implementation because the console had no turn-card entry, no `currentTurnCard` state and no recovery-authorized create/resolve handlers; passed after adding the Web controls.
  - `node --import tsx --test src/agent/AgentExplorer.layout.test.ts`: passed after implementation, preserving the existing responsive layout and recovery-authorization checks.

Turn-card result page slice:

- Result page payloads now accept optional `turnCardId` / `focusTurnCardId` and derive the agent/explorer from the resolved server-issued turn card when not supplied.
- The server rejects missing, unresolved or mismatched turn cards before creating a focused public page.
- Server-rendered `/epoch/result/{pageId}` pages now show a `本回合判定` section with the selected action, risk, server outcome, reward/lifetime summary and visible prose.
- MCP `obsidian_epoch.result_page` and `obsidian_epoch.create_result_page` schemas and the installable Skill/protocol docs now mention optional `turnCardId`.
- The Agent console can publish a resolved current turn card as a public result page and previews the focused turn summary in the result panel.
- Verification:
  - `node --import tsx --test --test-name-pattern "HTTP Epoch routes persist canonical events" ../agent-server/test/server.test.ts`: RED before implementation because `create_result_page` ignored `turnCardId` and returned `result_page_identity_required`; passed after deriving focus payloads and rendering focused HTML.
  - `node --import tsx --test --test-name-pattern "publish resolved turn-card" src/agent/AgentExplorer.layout.test.ts`: RED before implementation because no `publishTurnResultPage` handler or focus preview existed; passed after adding the console control.
  - `node --import tsx --test --test-name-pattern "MCP Epoch tools expose server-issued" ../agent-server/test/mcp.test.ts`: passed with MCP-created focused result pages.

MCP install quickstart slice:

- Added read-only `obsidian_epoch.quickstart`, returning the host-neutral MCP config, install URLs, Web Agent console URL, package playbook path and a structured one-turn tool sequence.
- Added `obsidian-epoch/references/one-turn-playbook.md` to the downloadable package so Claude Code, Codex, Cursor, Hermes and OpenClaw users can follow the same identity -> `turn_card` -> `resolve_turn` -> `create_result_page` loop.
- Root and skill install manifests now expose `playbooks.oneTurn`, and the HTTP install manifest includes `obsidian_epoch.quickstart`.
- The Skill, host install reference and protocol reference now point agents to quickstart/playbook before the first turn.
- The Agent console tool list and install panel expose the quickstart entrypoint and playbook path.
- Verification:
  - `node --import tsx --test --test-name-pattern "MCP tool registry exposes" ../agent-server/test/mcp.test.ts`: RED before implementation because `obsidian_epoch.quickstart` was absent; passed after adding the tool and structured response.
  - `node --import tsx --test ../agent-server/test/packageArchive.test.ts`: RED before implementation because the tarball lacked `one-turn-playbook.md` and manifest `playbooks.oneTurn`; passed after adding both.
  - `node --import tsx --test --test-name-pattern "quickstart entrypoint" src/agent/AgentExplorer.layout.test.ts`: RED before implementation because the Web console did not list quickstart or the playbook path; passed after UI wiring.

Web multi-identity console slice:

- The Agent console now exposes server-derived `identitySlots` and the full `progress.identities` list for the current explorer.
- Users can switch the active Web console identity by server-issued `agentId`; the selected identity is saved to local storage and immediately reloads progress from the server.
- Signing a new identity is disabled when the server reports no available identity slots, keeping the slot limit server-authoritative.
- Agent-scoped transient UI state is cleared when issuing, reincarnating or switching identities so hosted sessions, turn cards, result previews and high-value confirmations do not bleed across identities.
- Verification:
  - `node --import tsx --test --test-name-pattern "identity slots" src/agent/AgentExplorer.layout.test.ts`: RED before implementation because the console had no identity slot display, no `progress.identities` list and no `switchIdentity` handler; passed after UI wiring.
  - `node --import tsx --test src/agent/AgentExplorer.layout.test.ts`: passed after implementation, preserving existing quickstart, recovery-authorization and turn-card controls.

Install smoke playbook slice:

- Added `obsidian-epoch/references/smoke-playbook.md` to the downloadable package as an operator/user-verifiable end-to-end acceptance path.
- HTTP and static install manifests now expose `playbooks.smokeE2E`, and `obsidian_epoch.quickstart` returns `smokePlaybookPath` so MCP hosts can discover it.
- The public install page lists manifest playbooks, including the one-turn loop and smoke acceptance flow.
- The smoke flow verifies install manifest -> identity -> `turn_card` -> `resolve_turn` -> `create_result_page` -> `/epoch/result/{pageId}` -> `/epoch/agent/{agentId}` using the real HTTP server.
- Verification:
  - `node --import tsx --test --test-name-pattern "smoke flow|downloadable package" ../agent-server/test/server.test.ts ../agent-server/test/packageArchive.test.ts`: RED before implementation because `playbooks.smokeE2E` and `smoke-playbook.md` were absent; passed after adding the manifest entries, package reference and public install page rendering.

Season archive public page slice:

- Added a dedicated server-rendered `/epoch/season/{seasonId}` page for faction seasons, including faction standings, agent standings, region control, monuments and canonical public links.
- Added `seasonArchive` as a read-only runtime projection instead of letting the HTML layer rebuild season state.
- Added `publicPages.season` to the live HTTP manifest and both downloadable package manifests.
- The Agent console now links the current primary season to the public archive page.
- Updated the architecture, Skill and protocol references so agents prefer server-rendered season archives over prompt-written season summaries.
- Verification:
  - `node --import tsx --test --test-name-pattern "seasonal faction campaigns|season archive" ../agent-server/test/server.test.ts src/agent/AgentExplorer.layout.test.ts`: RED before implementation because `/epoch/season/{seasonId}` returned 404 and the Agent console had no season archive link; passed after runtime, HTTP, renderer and UI wiring.

Server maintenance scheduler slice:

- Added `lib/maintenance.ts` with an opt-in server maintenance scheduler controlled by `AGENT_SERVER_MAINTENANCE_*` environment variables.
- Each maintenance tick calls server-owned `epochTickNpcLifecycle`, `epochTickMarketExpiry` and configured resource-node spawn commands, then appends emitted canonical events through the same persistence writer used by HTTP routes.
- The scheduler is disabled by default, bounded by interval/limit parsing, and can run once on boot when explicitly configured.
- `server.ts` now starts the scheduler when enabled and stops it when the HTTP server closes.
- Deployment env, Compose, README, protocol and architecture docs now describe the maintenance loop.
- Verification:
  - `node --import tsx --test ../agent-server/test/maintenance.test.ts`: RED before implementation because `../lib/maintenance.ts` was missing; passed after adding config parsing, tick persistence and scheduler registration.

Server-authoritative regional resource-node slice:

- Added canonical resource-node events:
  - `resource_node_spawned`
  - `resource_node_contested`
  - `resource_node_settled`
- Added `resourceNodes` and `resourceNodeIdsByRegion` projections with open/settled status, stamina-spend leaderboards, winner metadata and server-defined reward data.
- Added core commands:
  - `createResourceNode` requires server trust and ignores client-declared reward authority.
  - `contestResourceNode` spends real server-tracked stamina and scores `staminaSpent * 2`.
  - `settleResourceNode` requires server trust and grants only the resource-node reward through canonical `resource_granted`.
- Added HTTP routes:
  - `GET /api/epoch/resource-nodes`
  - `POST /api/epoch/resource-nodes/spawn`
  - `POST /api/epoch/resource-nodes/contest`
  - `POST /api/epoch/resource-nodes/settle`
- Added MCP tools:
  - `obsidian_epoch.resource_nodes`
  - `obsidian_epoch.spawn_resource_node`
  - `obsidian_epoch.contest_resource_node`
  - `obsidian_epoch.settle_resource_node`
- Added resource-node data to `region_info`, public region pages, install manifests, Skill/protocol references and the Agent console.
- Region leaderboard now includes `resourceNodeScore`, derived from canonical `resource_node_contested` events.
- Verification:
  - `node --import tsx --test --test-name-pattern "resource nodes|resource node controls" ../agent-server/test/epoch-game-core.test.ts ../agent-server/test/server.test.ts ../agent-server/test/mcp.test.ts src/agent/AgentExplorer.layout.test.ts`: RED before implementation because resource-node core methods, HTTP routes, MCP tools and UI controls were absent; passed after core/runtime/MCP/HTTP/UI wiring.

Resource-node anti-farming slice:

- Added server-side regional open-node gating so a region cannot host multiple simultaneous open resource nodes.
- Added a regional post-settlement spawn cooldown to block immediate respawns after payout.
- Made repeated `settleResourceNode` calls idempotent: settled nodes return no events and do not grant duplicate rewards.
- Closed the deterministic-ID replay hole where a same-title/same-time spawn could return the old node before cooldown checks ran.
- HTTP and MCP now surface `resource_node_region_open` and `resource_node_spawn_cooldown_active` as public client errors.
- Updated Skill, protocol and architecture docs to treat resource-node anti-farming as a server authority rule.
- Verification:
  - `node --import tsx --test --test-name-pattern "resource nodes" ../agent-server/test/epoch-game-core.test.ts ../agent-server/test/server.test.ts ../agent-server/test/mcp.test.ts`: RED before implementation because HTTP/MCP immediate respawn returned 200; passed after moving duplicate-node short-circuit behind region-open/cooldown checks.

Server-scheduled resource-node production slice:

- Extended the opt-in maintenance scheduler with configured resource-node spawning.
- Added `AGENT_SERVER_MAINTENANCE_RESOURCE_NODE_REGION_IDS` and `AGENT_SERVER_MAINTENANCE_RESOURCE_NODE_LIMIT` so operators can pick which regions may receive automatic short-cycle resource contests and how many regions are attempted per tick.
- Maintenance resource-node spawning goes through the existing server-owned `epochSpawnResourceNode` path, then persists emitted canonical events through the same `epoch-events.jsonl` writer as NPC/market maintenance.
- Regions with an already-open resource node or active spawn cooldown are skipped instead of treated as maintenance failures; other errors still fail the tick.
- Deployment env, Compose, README, protocol and architecture docs now describe scheduled resource-node production.
- Verification:
  - `node --import tsx --test ../agent-server/test/maintenance.test.ts`: RED before implementation because config parsing and tick summaries lacked `resourceNodes`; passed after adding config parsing, skip handling, canonical spawn calls and persistence.

Market fee resource-sink slice:

- Added server-calculated market fees to filled orders as the first anti-inflation sink for player trading.
- Buyer payment still spends the full listed price; seller payment now grants `sellerProceedsAmount`, and `market_order_filled` records `marketFeeResourceId`, `marketFeeAmount` and `sellerProceedsAmount`.
- The current formula is a conservative 5% rounded down, so small starter trades naturally have zero fee while larger market trades remove resources from circulation.
- HTTP/MCP market fill responses and market order projections expose the fee fields because they come from canonical order projection.
- The Agent console now displays returned market tax and seller net proceeds when the server has settled an order.
- Skill, protocol and architecture docs now state that market fees are server-computed and cannot be client-declared.
- Verification:
  - `node --import tsx --test --test-name-pattern "market orders|market order fills|HTTP Epoch routes persist canonical events|MCP Epoch tools expose server-issued identity|market fees" ../agent-server/test/epoch-game-core.test.ts ../agent-server/test/server.test.ts ../agent-server/test/mcp.test.ts src/agent/AgentExplorer.layout.test.ts`: RED before implementation because market fills had no fee fields and sellers received full price; passed after adding fee projection, net settlement and UI display.

Market anti-collusion risk slice:

- Added server-computed trade-risk fields to filled market orders:
  - `tradeRiskFlags`
  - `tradeRiskScore`
- Current rule marks repeated counterparty trades within one hour as `repeat_counterparty_trade`.
- Risk marking is audit-first: the transaction still settles, while HTTP/MCP/UI surfaces can show the server evidence for future operator review.
- The Agent console now displays returned market risk flags next to filled orders.
- Skill, protocol and architecture docs now state that trade-risk flags are server-computed and cannot be client-declared.
- Verification:
  - `node --import tsx --test --test-name-pattern "market order fills flag repeated counterparty|HTTP Epoch routes persist canonical events|MCP Epoch tools expose server-issued identity|market risk" ../agent-server/test/epoch-game-core.test.ts ../agent-server/test/server.test.ts ../agent-server/test/mcp.test.ts src/agent/AgentExplorer.layout.test.ts`: RED before implementation because filled market orders had no `tradeRiskFlags`; passed after adding repeat-counterparty detection, projection fields and UI display.

Market suspicious-price risk slice:

- Extended server-computed market trade risk flags with:
  - `suspicious_low_price`
  - `suspicious_high_price`
- The rule compares the filled order unit price against clean recent fills for the same sell/payment resource pair:
  - below 50% of median -> `suspicious_low_price`
  - above 200% of median -> `suspicious_high_price`
- Suspicious prior fills are excluded from the price baseline so suspected laundering attempts cannot immediately poison the reference price.
- Risk remains audit-first; settlement proceeds normally, while `tradeRiskScore` and flags are visible in server/API/UI projections.
- Updated the Agent console risk labels plus Skill, protocol and architecture docs.
- Verification:
  - `node --import tsx --test --test-name-pattern "suspicious prices" ../agent-server/test/epoch-game-core.test.ts`: RED before implementation because abnormal low-price fills returned empty `tradeRiskFlags`; passed after adding median-based suspicious price flags.
  - `node --import tsx --test src/agent/AgentExplorer.layout.test.ts --test-name-pattern "market risk"`: RED before implementation because the console did not expose `suspicious_low_price` or `suspicious_high_price`; passed after adding frontend types and labels.

Regional market board activity slice:

- Added server-authoritative region ownership to market orders:
  - `create_market_order` accepts a local `regionId` and stores it on `market_order_created`
  - `fill_market_order`, `cancel_market_order` and `tick_market_expiry` inherit the original order region instead of trusting a new client declaration
  - legacy/no-region calls default to `region_gray_harbor` for replay compatibility
- Added local market read models:
  - `obsidian_epoch.market` and `/api/epoch/market` can filter by `regionId`
  - `region_info.activities` now includes `market_order_created`, `market_order_filled`, `market_order_cancelled` and `market_order_expired`
  - public region pages show these local market activities through the existing region activity section
- Updated the Agent console to load/create/fill/cancel/expire market orders in the selected region and refresh the current region panel after market writes.
- Updated Skill, protocol and architecture docs so agents treat local market boards and market region activity as server projections, not prompt-authored story facts.
- Verification:
  - `node --import tsx --test --test-name-pattern "market orders lock listed resources|market expiry tick" ../agent-server/test/epoch-game-core.test.ts`: RED before implementation because market orders had no `regionId`; passed after event/projection/activity wiring.
  - `node --import tsx --test --test-name-pattern "MCP Epoch tools expose server-issued identity" ../agent-server/test/mcp.test.ts`: RED before implementation because MCP market orders had no region and `region_info.activities` had no market events; passed after runtime/tool schema wiring.
  - `node --import tsx --test --test-name-pattern "HTTP Epoch routes persist canonical events" ../agent-server/test/server.test.ts`: RED before implementation because HTTP market orders had no region and public region pages could not show `市场成交`; passed after route/runtime/public-page projection wiring.
  - `node --import tsx --test src/agent/AgentExplorer.layout.test.ts --test-name-pattern "market"`: passed after the console scoped market reads and order creation to the selected region.
  - `npm run typecheck`, `npm test`, `npm run build`, `npm run check:no-js`, `git diff --check`: passed.

Risk-only audit review slice:

- Extended the redacted Epoch audit projection with:
  - `riskOnly`
  - per-event `reviewFlags`
  - per-event `reviewScore`
- `obsidian_epoch.audit` and `/api/epoch/audit` can now filter directly to server-flagged review events such as risky `market_order_filled` records.
- Public `/epoch/audit/{eventId}` pages now show the review flags and score next to the event summary.
- The Agent console operator panel now has a lightweight `风险审计` refresh that lists risk-review events and links to their public audit pages.
- Skill, protocol and architecture docs now tell agents/operators to use `riskOnly: true` for suspicious trades instead of scanning every high-impact event.
- Verification:
  - `node --import tsx --test --test-name-pattern "risk review" ../agent-server/test/server.test.ts`: RED before implementation because `/api/epoch/audit?riskOnly=true` ignored the filter and returned no `reviewFlags`; passed after adding audit review filtering.
  - `node --import tsx --test --test-name-pattern "risk review" ../agent-server/test/mcp.test.ts`: RED before implementation because `obsidian_epoch.audit` ignored `riskOnly`; passed after wiring runtime and MCP schema.
  - `node --import tsx --test src/agent/AgentExplorer.layout.test.ts --test-name-pattern "risk-only audit"`: RED before implementation because the Agent console had no risk audit control; passed after adding frontend API/type/UI wiring.

Risk profile aggregation slice:

- Extended the redacted audit response with `riskProfile`:
  - total risk-review event count
  - total review score
  - flag counts
  - highest-risk agent profiles with latest event ids
- The profile is derived from canonical risk-review events in the current audit filter scope; clients and MCP adapters cannot submit their own profile.
- The Agent console risk audit panel now displays a compact `风险画像` summary with total score, flag distribution and top risky identities.
- Skill, protocol and architecture docs now tell agents/operators to inspect `riskProfile` before summarizing suspicious trade risk.
- Verification:
  - `node --import tsx --test --test-name-pattern "risk review" ../agent-server/test/server.test.ts ../agent-server/test/mcp.test.ts`: RED before implementation because `riskProfile` was undefined; passed after adding server-side aggregation.
  - `node --import tsx --test src/agent/AgentExplorer.layout.test.ts --test-name-pattern "risk-only audit"`: RED before implementation because the Agent console did not render `风险画像`; passed after adding frontend type and UI display.

Abuse cooldown status slice:

- Added a read-only abuse window projection:
  - runtime reports `actorKey`, `limit`, `windowMs`, `count`, `remaining`, `limited` and `resetAt`
  - expired windows are cleared on status read, so recovery is visible without spending a write
  - status reads do not consume the state-change quota
- Added protocol surfaces:
  - `/api/epoch/abuse/status`
  - `obsidian_epoch.abuse_status`
  - install manifests include the tool
  - Agent console shows `滥用冷却` and remaining write count near identity/progress controls
- Target verification:
  - `node --import tsx --test --test-name-pattern "abuse limits|abuse cooldown|abuse status|MCP tool registry" ../agent-server/test/server.test.ts ../agent-server/test/mcp.test.ts src/agent/api.test.ts src/agent/AgentExplorer.layout.test.ts`
  - RED result: HTTP returned 404, MCP returned `unknown_tool`, frontend API export was missing and the Agent console had no cooldown status.
  - GREEN result: passed, 5 tests, 0 failed after implementation.

Rejected command audit slice:

- Added server-generated `command_rejected` audit events for failed Epoch write commands.
- The event is audit-only:
  - aggregate type: `audit_record`
  - trust class: `system_worker`
  - payload includes `surface`, `command`, `errorCode`, optional `statusCode`, `actorKey`, optional identity fields and a shallow redacted `inputSummary`
  - it is marked high-impact for replay visibility but does not require operator risk disposition by default
- HTTP writes now attach parsed JSON bodies to the request, record rejected Epoch POST attempts in the unified error handler, persist emitted audit events and preserve the original HTTP status/error response.
- MCP writes now wrap known Epoch state-changing tools, record rejected attempts through the internal runtime method and preserve the original MCP error.
- The Agent console operator panel now includes `拒绝审计`, which loads `getEpochAudit({ eventType: "command_rejected" })`.
- Skill, protocol and architecture docs now describe rejected writes as server-recorded audit evidence.
- Verification:
  - `node --import tsx --test --test-name-pattern "abuse limits|server-issued identity, downtime|risk-only audit review controls" ../agent-server/test/server.test.ts ../agent-server/test/mcp.test.ts src/agent/AgentExplorer.layout.test.ts`
  - RED result: HTTP audit total stayed `0`, MCP rejected-write lookup was missing and the Agent console had no rejected-audit control.
  - GREEN result: passed, 4 tests, 0 failed after implementation.
  - Full pass: `npm run typecheck`, `npm test`, `npm run build`, `npm run check:no-js`, `git diff --check`, and source scan for `.js`/`.mjs`/`.jsx` all passed.
  - Local smoke on latest service: `POST /api/epoch/downtime/set` without owner recovery returned `401 explorer_auth_required` and produced a `command_rejected` audit event with `surface: "http"`.

Abuse score slice:

- Added server-derived `abuse_score_changed` events emitted with each server-generated `command_rejected`.
- Abuse scoring is authority-side only:
  - rate-limit violations add `+3`
  - invalid or forged authority errors add `+2`
  - missing auth or missing idempotency adds `+1`
  - other invalid command failures add `+1`
- The Epoch projection now exposes `abuseScores` by actor key, preserving source rejected-event ids, latest abuse event id and reason counts.
- HTTP and MCP `abuse_status` responses now include `abuseScore`, `abuseLevel` and `latestAbuseEventId` in addition to the write-window cooldown state.
- The Agent console now shows `风险分` next to the abuse cooldown state.
- Skill, protocol and architecture docs now tell agents/operators that rejected writes are scored as canonical audit evidence.
- Verification:
  - `node --import tsx --test --test-name-pattern "abuse limits|abuse cooldown status|Epoch abuse status API" ../agent-server/test/server.test.ts src/agent/api.test.ts src/agent/AgentExplorer.layout.test.ts`
  - RED result: HTTP abuse-score audit total stayed `0`, the API type did not expose `abuseScore`, and the Agent console had no risk-score display.
  - GREEN result: passed, 3 tests, 0 failed after implementation.
  - `node --import tsx --test --test-name-pattern "server-issued identity, downtime|state changes enforce abuse limits" ../agent-server/test/mcp.test.ts`
  - RED result: MCP audit/status did not expose `abuse_score_changed` or `abuseScore`.
  - GREEN result: passed, 2 tests, 0 failed after implementation.

Abuse score restriction slice:

- Added server-side restricted-score enforcement to the shared Epoch runtime write gate.
- Rules:
  - `abuseScore >= 10` maps to `abuseLevel: "restricted"`.
  - new public or unverified state-changing commands for that actor are rejected with `epoch_abuse_score_restricted`
  - read-only tools such as progress, audit and abuse status remain available
  - cached idempotent replays remain safe because idempotency is checked before the write gate
  - owner-recovery-authorized commands remain available after credential verification, so public agent IDs cannot be used to lock legitimate owners out
  - the rejected restricted write is still recorded as `command_rejected` and scored as `abuse_score_changed` with reason `score_restricted`
- HTTP maps `epoch_abuse_score_restricted` to `403`.
- Skill, protocol and architecture docs now tell agents that restricted actors must stop issuing public/unverified writes instead of changing prompt text or idempotency keys.
- Verification:
  - `node --import tsx --test --test-name-pattern "abuse score restriction" ../agent-server/test/server.test.ts ../agent-server/test/mcp.test.ts`
  - RED result: after the cooldown window reset, MCP and HTTP public writes still succeeded even when `abuseLevel` was `restricted`.
  - GREEN result: passed, 2 tests, 0 failed after adding the shared runtime enforcement.

Abuse restriction release slice:

- Added operator-gated abuse-score recovery without deleting audit evidence.
- Rules:
  - `obsidian_epoch.release_abuse_restriction` and `POST /api/epoch/abuse/release` require the operator key
  - operators may lower an active actor score after review, defaulting to `0`
  - the server appends `abuse_score_released` with `previousScore`, `scoreAfter`, `sourceEventId`, operator id and optional note
  - `command_rejected` and `abuse_score_changed` remain queryable audit evidence
  - released actors return to `abuseLevel: "clear"` or `watch` based on the lowered active score
- Install manifest, Skill, protocol and architecture docs now expose the recovery policy as operator-only and append-only.
- Verification:
  - `node --import tsx --test --test-name-pattern "release an abuse score restriction" ../agent-server/test/server.test.ts ../agent-server/test/mcp.test.ts`
  - RED result: MCP returned `unknown_tool:obsidian_epoch.release_abuse_restriction` and HTTP returned `404` for `/api/epoch/abuse/release`.
  - GREEN result: passed, 2 tests, 0 failed after adding the event, projection, runtime, MCP and HTTP route.

Operator console abuse release slice:

- Added the operator abuse-release control to the Agent console so the web UI can manage the recovery path, not only HTTP/MCP clients.
- UI behavior:
  - `getEpochAbuseStatus` continues to show the active actor key, score and level
  - when the current actor is `restricted`, the operator panel shows `解除滥用限制`
  - the button calls `/api/epoch/abuse/release` through `releaseEpochAbuseRestriction`
  - after release, the console refreshes abuse status and switches audit results to `eventType: "abuse_score_released"`
- Verification:
  - `node --import tsx --test src/agent/api.test.ts src/agent/AgentExplorer.layout.test.ts`
  - RED result: `releaseEpochAbuseRestriction` was not exported and the Agent console had no abuse-release controls.
  - GREEN result: passed, 27 tests, 0 failed after adding the API wrapper, UI function and operator panel banner.

Operator abuse profiles slice:

- Added an operator-gated global abuse profile read model for realtime MMO moderation.
- Rules:
  - `obsidian_epoch.abuse_profiles` and `GET /api/epoch/abuse/profiles` require the operator key
  - profiles are derived from server-owned `abuseScores`, sorted by active score, and include `actorKey`, optional identity fields, `score`, `abuseLevel`, reason counts, source event ids and latest event id
  - `level=restricted` filters the list to actors that need operator review
  - the Agent console exposes a `滥用画像` panel with reason counts and latest event ids next to the existing release control
- Verification:
  - `node --import tsx --test --test-name-pattern "abuse profiles|abuse profile" ../agent-server/test/server.test.ts ../agent-server/test/mcp.test.ts src/agent/api.test.ts src/agent/AgentExplorer.layout.test.ts`
  - RED result: HTTP returned `404`, MCP returned `unknown_tool:obsidian_epoch.abuse_profiles`, and the frontend had no `getEpochAbuseProfiles` export or UI list.
  - GREEN result: passed, 4 tests, 0 failed after adding runtime aggregation, HTTP/MCP routes and Agent console display.

Operator overview slice:

- Added an operator-gated realtime operations overview for the MMO control surface.
- Rules:
  - `obsidian_epoch.operator_overview` and `GET /api/epoch/operator/overview` require the operator key
  - the overview aggregates open moderation, restricted/watch abuse counts, active market risk restrictions, risk audit events and recent abuse releases from server projections
  - the overview is read-only and does not grant review, release or settlement authority
  - the Agent console exposes `运营总览` and `刷新总览`, then reuses the returned projection to refresh queue, abuse, market restriction and risk audit panels
- Verification:
  - `node --import tsx --test --test-name-pattern "operator overview|operator overview API|operator overview panel" ../agent-server/test/server.test.ts ../agent-server/test/mcp.test.ts src/agent/api.test.ts src/agent/AgentExplorer.layout.test.ts`
  - RED result: HTTP returned `404`, MCP returned `unknown_tool:obsidian_epoch.operator_overview`, and the frontend had no `getEpochOperatorOverview` export or UI panel.
  - GREEN result: passed, 4 tests, 0 failed after adding runtime aggregation, HTTP/MCP routes, typed API wrapper and Agent console summary.

Operator overview maintenance status slice:

- Extended the operator overview with server-owned maintenance visibility.
- Rules:
  - overview `maintenance` is derived from canonical events, not scheduler process memory
  - counted events are `npc_lifecycle_recorded`, `resource_node_spawned` and `market_order_expired`
  - summary now includes `maintenanceEvents`, and the Agent console shows `维护状态` with recent maintenance rows
  - this is read-only visibility; it does not grant maintenance, settlement, review or release authority
- Verification:
  - `node --import tsx --test --test-name-pattern "operator overview|operator overview API|operator overview panel" ../agent-server/test/server.test.ts ../agent-server/test/mcp.test.ts src/agent/api.test.ts src/agent/AgentExplorer.layout.test.ts`
  - RED result: backend overview had no `maintenance` projection and Agent console had no `维护状态`.
  - GREEN result: passed, 4 tests, 0 failed after deriving maintenance counts/recent events from canonical projection and rendering them in the operator panel.

Operator manual maintenance run slice:

- Added an operator-gated one-shot maintenance command for production recovery and live ops.
- Rules:
  - `obsidian_epoch.run_maintenance` and `POST /api/epoch/maintenance/run` require `operatorKey` and `idempotencyKey`
  - the command runs bounded server-owned NPC lifecycle, market expiry and configured resource-node spawning in one pass
  - duplicate idempotency keys return the cached summary with no duplicate events
  - HTTP persistence appends emitted canonical events through the same `epoch-events.jsonl` writer and returns `persistedEvents`
  - the Agent console exposes `运行维护`, shows the latest run summary, then refreshes operator overview, region state and market state
- Verification:
  - `node --import tsx --test --test-name-pattern "maintenance run|maintenance API|operator overview panel" ../agent-server/test/server.test.ts ../agent-server/test/mcp.test.ts src/agent/api.test.ts src/agent/AgentExplorer.layout.test.ts`
  - RED result: HTTP returned `404`, MCP lacked `obsidian_epoch.run_maintenance`, the Agent console had no `runEpochMaintenance` or `运行维护`, and the API wrapper export was missing.
  - GREEN result: passed, 4 tests, 0 failed after adding runtime aggregation, HTTP/MCP routes, typed API wrapper, install manifest entries, skill/protocol docs and Agent console controls.

Operator overview runtime health slice:

- Extended operator overview from raw maintenance counts into an explicit live-ops health read model.
- Rules:
  - `overview.health` summarizes overall operator attention status, queue counts and attention reasons from moderation, abuse, market restrictions and risk audit projections
  - `overview.maintenance.health` derives per-worker `ok`, `stale` or `missing` state from canonical `npc_lifecycle_recorded`, `market_order_expired` and `resource_node_spawned` events
  - maintenance health is read-only and does not depend on in-memory scheduler state
  - the Agent console shows `运行健康` and `维护健康` in the operator panel
- Verification:
  - `node --import tsx --test ../agent-server/test/mcp.test.ts --test-name-pattern "operator overview|operator maintenance"`
  - `node --import tsx --test ../agent-server/test/server.test.ts --test-name-pattern "operator overview|operator maintenance"`
  - `node --import tsx --test src/agent/AgentExplorer.layout.test.ts --test-name-pattern "operator overview panel"`
  - RED result: backend overview had no `health` object and the Agent console had no `运行健康` / `维护健康` display.
  - GREEN result: passed after deriving health from canonical projections and rendering it in the operator panel.

Server-backed stdio MCP slice:

- Changed the installed MCP process from local-shard behavior to server-backed proxy behavior when `AGENT_WORLD_SERVER` is configured.
- Rules:
  - `npm run agent:mcp` still supports the in-memory runtime for tests and embedded development when no server is configured
  - installed hosts set `AGENT_WORLD_SERVER`, so stdio tool calls are forwarded to `POST /api/epoch/mcp/tools/call` on the public world server
  - `obsidian_epoch.quickstart` in remote mode injects the same `serverBase` used by the proxy, so install instructions match the actual authority
  - the HTTP tool-call proxy binds to the server's existing runtime and persists emitted Epoch events/result pages through the same persistence path as direct HTTP routes
  - rejected proxied MCP writes are audited once with the original tool name and argument payload, not as a separate local shard failure
- Verification:
  - `node --import tsx --test --test-name-pattern "AGENT_WORLD_SERVER as canonical" ../agent-server/test/mcp.test.ts`
  - RED result: stdio MCP created the identity in a private in-memory runtime, so the configured HTTP server returned `404` for the issued `agentId`; after adding quickstart coverage it also returned the default `127.0.0.1:8787` instead of the configured server.
  - GREEN result: passed after adding the server-backed MCP runtime, generic HTTP tool-call route, remote quickstart serverBase injection and stdio env selection.

Operator-gated global pacing slice:

- Tightened global world pacing operations so public MCP/HTTP clients cannot trigger system-worker events without the server operator key.
- Operator-gated tools/routes:
  - `obsidian_epoch.seed_objective`
  - `obsidian_epoch.settle_objective`
  - `obsidian_epoch.spawn_resource_node`
  - `obsidian_epoch.settle_resource_node`
  - `obsidian_epoch.seed_season`
  - `obsidian_epoch.settle_season`
- Player-owned actions remain available through owner recovery authorization:
  - `obsidian_epoch.contribute_objective`
  - `obsidian_epoch.contest_resource_node`
  - `obsidian_epoch.contribute_season`
- Updated the Agent console so template start, resource-node spawn and public settlement buttons are disabled until `operatorKey` is present, while player contribution/contest controls still use explorer recovery authorization.
- Updated MCP schemas, Skill/protocol references and architecture docs to state that global payout opportunity creation and public settlement are operator/server-worker authority.
- Verification:
  - `node --import tsx --test --test-name-pattern "server-spawned resource nodes|seasonal faction campaigns|server-issued identity, downtime|routes persist canonical|region leaderboards" ../agent-server/test/mcp.test.ts ../agent-server/test/server.test.ts`
  - RED result: missing-operator MCP/HTTP calls were still accepted and could create/settle resource nodes, objectives and seasons.
  - GREEN result: passed, 7 tests, 0 failed after adding operator-key checks and authorized test calls.
  - `node --import tsx --test --test-name-pattern "global world pacing|resource node controls" src/agent/AgentExplorer.layout.test.ts`: passed, 2 tests, 0 failed.
  - `node --import tsx --test ../agent-server/test/maintenance.test.ts`: passed, 4 tests, 0 failed after passing the configured operator key through the server maintenance runner.
  - `npm run typecheck`: passed, including `No JS/MJS/JSX source files found.`
  - `npm test`: passed, 161 agent/server tests, 11 batch tests and 33 UI/API tests, 0 failed.
  - `npm run build`: passed, generated world-map data, completed Vite production build, exported `00_总览/黑曜纪元3D世界地图.html`, then removed transient `dist` output.
  - `git diff --check`: passed.
  - Strict source scan for `.js`, `.mjs` and `.jsx` under `tools/` outside `node_modules`/`dist`: passed with no output.

Identity-slot recovery authorization slice:

- Tightened identity issuance so registered explorers must prove the registered recovery credential before the server returns idempotent identity issuance data or consumes an unlocked extra identity slot.
- Rules:
  - the first identity can still register a recovery credential for a new explorer
  - once an explorer has a registered credential, `obsidian_epoch.identity` and `POST /api/epoch/identity/issue` reject missing credentials as `explorer_auth_required`
  - wrong credentials reject as `explorer_auth_invalid`
  - authenticated over-slot attempts still reject as `identity_slot_limit_reached`
  - successful high-level extra identity issuance requires both canonical slot entitlement and owner recovery authorization
- Updated MCP tool descriptions, Skill/protocol references and architecture docs so multi-identity entitlement is explicitly owner-gated, not just legend-gated.
- Verification:
  - `node --import tsx --test --test-name-pattern "abuse limits without blocking reads|unlocked identity slots" ../agent-server/test/mcp.test.ts`: passed, 2 tests, 0 failed.
  - `node --import tsx --test --test-name-pattern "unlocked identity slots|server-issued identity, downtime|routes persist canonical" ../agent-server/test/mcp.test.ts ../agent-server/test/server.test.ts`: passed, 3 tests, 0 failed.
  - `npm run typecheck`: passed, including `No JS/MJS/JSX source files found.`
  - `npm test`: passed, 161 agent/server tests, 11 batch tests and 33 UI/API tests, 0 failed.
  - `npm run build`: passed, generated world-map data, completed Vite production build, exported `00_总览/黑曜纪元3D世界地图.html`, then removed transient `dist` output.
  - `git diff --check`: passed.
  - Strict source scan for `.js`, `.mjs` and `.jsx` under `tools/` outside `node_modules`/`dist`: passed with no output.

Region influence trace slice:

- Added canonical settled-impact traces for asynchronous multiplayer actions.
- Rules:
  - objective settlement, resource-node settlement and raid resolution append `region_influence_changed` for the winning agent
  - each influence change records `sourceEventId`, `sourceEventType`, `sourceAggregateId`, `influenceDelta`, `influenceScoreAfter`, `regionId`, `agentId` and `explorerId`
  - `region_info.influenceChanges` exposes recent settled influence traces without changing the existing live contribution leaderboard
  - public `/epoch/region/{regionId}` pages and the Agent console show `影响变动`
  - clients cannot submit influence changes directly; they are derived from server settlement events
- Updated architecture, protocol and Skill references so `region_influence_changed` is current implementation rather than future work.
- Verification:
  - `node --import tsx --test --test-name-pattern "contested objectives|resource nodes spawn|raid resolution" ../agent-server/test/epoch-game-core.test.ts`: RED before implementation because `projection.regionInfluenceChanges` was missing; passed after event/projection/settlement wiring.
  - `node --import tsx --test --test-name-pattern "canonical region leaderboards|settled region influence" ../agent-server/test/server.test.ts src/agent/AgentExplorer.layout.test.ts`: RED before implementation because `regionInfo.influenceChanges` was missing and the Agent console had no `影响变动`; passed after runtime/public-page/UI wiring.
  - `node --import tsx --test --test-name-pattern "server-spawned resource nodes" ../agent-server/test/mcp.test.ts`: passed after MCP `region_info` coverage asserted `influenceChanges`.
  - `npm run typecheck`: passed, including `No JS/MJS/JSX source files found.`
  - `npm test`: passed, 161 agent/server tests, 11 batch tests and 34 UI/API tests, 0 failed.
  - `npm run build`: passed, generated world-map data, completed Vite production build, exported `00_总览/黑曜纪元3D世界地图.html`, then removed transient `dist` output.
  - `git diff --check`: passed.
  - Strict source scan for `.js`, `.mjs` and `.jsx` under `tools/` outside `node_modules`/`dist`: passed with no output.

Conflict trace slice:

- Added server-derived conflict chains for settled asynchronous multiplayer actions.
- Rules:
  - objective settlement, resource-node settlement, bounty claims and raid resolution append `trace_created`
  - each trace records source event ids, source aggregate id, participants, participant explorers, related influence ids and optional parent trace id
  - `region_info.traces` exposes recent region traces beside `region_info.influenceChanges`
  - public `/epoch/region/{regionId}` pages and the Agent console show `冲突轨迹`
  - clients cannot submit conflict traces directly; they are derived from server settlement events
- Updated architecture, protocol and Skill references so `trace_created` is current implementation rather than future work.
- Verification:
  - `node --import tsx --test --test-name-pattern "contested objectives|resource nodes spawn|raid resolution" ../agent-server/test/epoch-game-core.test.ts`: RED before implementation because `projection.conflictTraces` was missing.
  - `node --import tsx --test --test-name-pattern "canonical region leaderboards|canonical conflict traces|server-spawned resource nodes" ../agent-server/test/server.test.ts ../agent-server/test/mcp.test.ts src/agent/AgentExplorer.layout.test.ts`: RED before implementation because `regionInfo.traces` was missing and the Agent console had no `冲突轨迹`.
  - `node --import tsx --test --test-name-pattern "contested objectives|bounties escrow|resource nodes spawn|raid resolution" ../agent-server/test/epoch-game-core.test.ts`: passed after event/projection/settlement wiring.
  - `node --import tsx --test --test-name-pattern "canonical region leaderboards|canonical conflict traces|server-spawned resource nodes" ../agent-server/test/server.test.ts ../agent-server/test/mcp.test.ts src/agent/AgentExplorer.layout.test.ts`: passed after runtime/public-page/UI wiring.
  - `npm run typecheck`: passed, including `No JS/MJS/JSX source files found.`
  - `npm test`: passed, 161 agent/server tests, 11 batch tests and 35 UI/API tests, 0 failed.
  - `npm run build`: passed, generated world-map data, completed Vite production build, exported `00_总览/黑曜纪元3D世界地图.html`, then removed transient `dist` output.
  - `git diff --check`: passed.
  - Strict source scan for `.js`, `.mjs` and `.jsx` under `tools/` outside `node_modules`/`dist`: passed with no output.

Retaliation opportunity slice:

- Added server-derived post-raid retaliation opportunities for asynchronous multiplayer continuity.
- Rules:
  - `resolve_raid` still settles attack/defense from canonical stamina, focus and legend balances
  - after `raid_resolved`, `region_influence_changed` and `trace_created`, the server appends `retaliation_opportunity_created`
  - the losing side receives the opportunity and the winning side becomes the target
  - each opportunity links to `sourceRaidId`, `sourceTraceId` and `sourceEventIds`
  - `region_info.retaliations`, public `/epoch/region/{regionId}` and the Agent console expose the opportunities
  - clients cannot create retaliation opportunities directly or alter winner/loser through prompt text
- Updated architecture, protocol and Skill references so `retaliation_opportunity_created` is current implementation rather than future work.
- Verification:
  - `node --import tsx --test src/agent/AgentExplorer.layout.test.ts`: RED before implementation because the Agent console had no `复仇契机`; passed after runtime/UI wiring.
  - `node --import tsx --test --test-name-pattern "raid resolution spends attacker stamina" ../agent-server/test/epoch-game-core.test.ts`: passed after event/projection/raid wiring.
  - `node --import tsx --test --test-name-pattern "HTTP Epoch routes persist canonical events and hydrate progress" ../agent-server/test/server.test.ts`: passed after HTTP/public-region wiring.
  - `node --import tsx --test --test-name-pattern "MCP Epoch tools expose server-issued identity, downtime, NPC and event progress" ../agent-server/test/mcp.test.ts`: passed after MCP `region_info` coverage asserted `retaliations`.
  - `npm run typecheck`: passed, including `No JS/MJS/JSX source files found.`
  - `npm test`: passed, 161 agent/server tests, 11 batch tests and 38 UI/API tests, 0 failed.
  - `npm run build`: passed, generated world-map data, completed Vite production build, exported `00_总览/黑曜纪元3D世界地图.html`, then removed transient `dist` output.
  - `git diff --check`: passed.
  - Strict source scan for `.js`, `.mjs` and `.jsx` under `tools/` outside `node_modules`/`dist`: passed with no output.

Retaliation settlement slice:

- Added server-authoritative resolution for open post-raid retaliation opportunities.
- Rules:
  - `resolve_retaliation` requires the opportunity owner's recovery authorization
  - the opportunity owner spends real `stamina`
  - retaliator power is computed from spent stamina and canonical legend balance
  - target power is computed from canonical focus and legend balances
  - the server ignores client-declared outcomes, chooses the winner, grants the canonical reward, appends `retaliation_resolved`, closes the opportunity, and emits `region_influence_changed` plus `trace_created`
  - resolved retaliation state is visible through `region_info.retaliations`, MCP/HTTP, public region pages and the Agent console
  - resolved opportunities cannot be replayed
- Updated architecture, install manifest, protocol and Skill references so `resolve_retaliation` / `retaliation_resolved` are current implementation rather than future work.
- Verification:
  - `node --import tsx --test --test-name-pattern "retaliation resolution spends owner stamina" ../agent-server/test/epoch-game-core.test.ts`: RED before implementation because `core.resolveRetaliation` was missing; passed after event/projection/settlement wiring.
  - `node --import tsx --test src/agent/AgentExplorer.layout.test.ts`: RED before implementation because the Agent console had no `resolveEpochRetaliation` / `执行复仇`; passed after UI/API wiring.
  - `node --import tsx --test --test-name-pattern "HTTP Epoch routes persist canonical events and hydrate progress" ../agent-server/test/server.test.ts`: RED before implementation because `/api/epoch/retaliations/resolve` returned 404; passed after HTTP wiring and hydration assertions.
  - `node --import tsx --test --test-name-pattern "MCP Epoch tools expose server-issued identity, downtime, NPC and event progress" ../agent-server/test/mcp.test.ts`: RED before implementation because `obsidian_epoch.resolve_retaliation` was unknown; passed after MCP tool wiring.
  - `npm run typecheck`: passed, including `No JS/MJS/JSX source files found.`

Resolved Alpha 1 integration surface:

- The pure Epoch core is implemented, tested and exposed through HTTP/MCP for identity, progress, downtime, NPC notes, region info, result-page payloads and events.
- The web dashboard now reads the Epoch service surface for identity, resources, downtime, region/NPC info, result-page payloads, install manifest and recent events.
- The server now renders public agent, death archive, region, NPC, audit/replay and result pages from canonical projections without client scripts.
- The server now exposes a downloadable Skill/plugin archive for MCP host installation.
- The stdio MCP process now uses `AGENT_WORLD_SERVER` as a server-backed proxy in installed hosts, so plugin play shares the public server event store instead of creating local shards.
- Identity replay and extra active identity issuance for registered explorers now require recovery authorization, so knowing an `explorerId` is not enough to steal multi-agent identity slots.
- Settled objective, resource-node, bounty and raid outcomes now emit `region_influence_changed` and/or `trace_created` and expose region influence plus conflict traces through MCP/HTTP/public pages/Web UI.
- Post-raid retaliation opportunities can now be resolved through owner-authorized MCP/HTTP/Web UI actions, closing the opportunity and emitting settled influence plus conflict traces.
- Seasonal faction campaigns now emit `season_started` and `season_resolved` phase events and expose phase chains through MCP/HTTP/public season archives/Web UI.
- Seasonal faction campaigns now emit `season_objective_created` and `season_objective_completed`, exposing objective progress through MCP/HTTP/public season archives/Web UI.
- Server-authoritative region activity streams now include seasonal faction campaign lifecycle, objective, contribution and settlement events across `region_info`, MCP region reads and public region pages.
- Regional market boards now attach `regionId` to market orders, let HTTP/MCP/Web reads filter by region, and project market create/fill/cancel/expiry events into `region_info.activities` plus public region pages.
- Public server deployment configuration is implemented with Dockerfile, Compose, env example, healthcheck, SQLite volume and operator README.
- Hosted runner protocol is implemented as server-started sessions with server-approved action option IDs, MCP/HTTP routes, web console display and event hydration.
- Attested runner protocol is implemented with server-configured runners, one-time HMAC challenges, replay protection, MCP/HTTP routes, web console challenge submission and `attestation_recorded` event projection.
- Web LLM browser bridge is implemented as an untrusted copy/paste channel with public-only prompt options, MCP/HTTP routes, install manifest entries and web console submission controls.
- Operator moderation is implemented for suspicious public messages/news with queued visibility, operator-key-gated MCP/HTTP resolution and audit-visible moderation events.
- Production database migration path is implemented with `npm run agent:migrate:sqlite`, `AGENT_SERVER_STORE=sqlite`, JSONL-to-SQLite migration, indexed canonical records and SQLite runtime persistence.

Server-authoritative inventory item slice:

- Added canonical inventory item events and projections:
  - `item_created`
  - `item_bound`
  - `inventoryItems`
  - `inventoryItemIdsByAgent`
  - `inventoryItemIdsByExplorer`
- Rules:
  - `createInventoryItem` requires server/operator trust.
  - Item creation requires existing `sourceEventIds` that mention the target agent, so prompts cannot mint unsupported gear.
  - Replaying the same `agentId:itemKey:sourceEventIds` returns the existing item without duplicate events.
  - `bindInventoryItem` requires the item owner and records `item_bound`; HTTP/MCP bind routes require owner recovery authorization through Runtime.
- Added surfaces:
  - `GET /api/epoch/inventory`
  - `POST /api/epoch/inventory/create`
  - `POST /api/epoch/inventory/bind`
  - `obsidian_epoch.inventory`
  - `obsidian_epoch.create_item`
  - `obsidian_epoch.bind_item`
  - progress views, public agent pages, result pages and the Agent console now show inventory items.
- Updated protocol, Skill and architecture docs to state that item creation is operator/server authority and item binding is owner-authorized.
- Verification:
  - `node --import tsx --test --test-name-pattern "inventory items|HTTP exposes operator-created inventory|MCP exposes operator-created inventory" ../agent-server/test/*.test.ts`: RED before implementation because core commands, HTTP routes and MCP tools were missing; passed after event/projection/runtime/HTTP/MCP/UI wiring.
  - Full verification remains to be run after this slice's documentation updates.

Server-authoritative item crafting slice:

- Added owner-authorized crafting from server-ledger resources:
  - `craftInventoryItem`
  - `POST /api/epoch/inventory/craft`
  - `obsidian_epoch.craft_item`
  - `craftEpochInventoryItem`
- Rules:
  - Clients submit only `recipeId`; `itemKey`, `displayName`, `rarity` and costs come from the server recipe table.
  - Crafting requires owner recovery authorization in Runtime/HTTP/MCP.
  - Crafting spends real resources through `resource_spent` events before `item_created`.
  - The crafted item's `sourceEventIds` are the resource spend event ids, so the item has replayable provenance.
  - Unknown recipes are rejected with `craft_recipe_not_found`; missing or wrong recovery credentials leave resources and inventory unchanged.
- Added first recipe set:
  - `field-kit`: `coin` 5 + `aether` 1 -> `灰行者工具包`
  - `focus-charm`: `focus` 3 + `aether` 2 -> `静心盐线护符`
  - `training-band`: `stamina` 4 + `coin` 2 -> `巡夜训练缚带`
- Added surfaces:
  - Agent Console inventory panel now includes a recipe selector and owner-authorized craft button.
  - Install/tool lists include `obsidian_epoch.craft_item`.
  - Protocol, Skill and architecture docs now describe crafting as resource-backed server state.
- Verification:
  - `npm run agent:test -- --test-name-pattern "crafted inventory items|HTTP crafts inventory|MCP crafts inventory|tool registry"`: RED before implementation because `craftInventoryItem`, `/api/epoch/inventory/craft` and `obsidian_epoch.craft_item` were missing; passed after core/runtime/HTTP/MCP wiring.
  - `npm run agent:ui-test`: passed after API wrapper and Agent Console crafting controls were added.
  - Full verification remains to be run after this slice's documentation updates.

Server-authoritative bound equipment effect slice:

- Added bound crafted item effects to resource-node contests:
  - Only server-created, owner-bound items can contribute effects.
  - Client-declared equipment score claims are ignored.
  - Each `itemKey` is counted once per contest to prevent duplicate-item farming.
  - `field-kit` grants resource-node contest score +1; `training-band` grants +2.
- Added settlement evidence:
  - `resource_node_contested` now records `baseScoreDelta`, `equipmentScoreBonus`, `equipmentItemIds` and final `scoreDelta`.
  - Progress views expose `equipmentEffects` for the current identity, and the Agent Console displays active bound equipment effects in the inventory panel.
- Updated protocol, Skill and architecture docs to state that item effects are server-derived from bound item keys, not prompt text or modified MCP adapters.
- Verification:
  - `npm run agent:test -- --test-name-pattern "bound crafted inventory effects"`: passed after core settlement ignored forged client equipment scores and applied bound server item effects.
  - `npm run agent:test -- --test-name-pattern "crafts inventory items|server-authoritative inventory items"`: RED after tests were added because progress views lacked `equipmentEffects`; expected to pass after runtime/API progress wiring.
  - Full verification remains to be run after this slice's documentation updates.

Server-authoritative item market transfer slice:

- Added canonical item trading through the existing market:
  - `createMarketOrder` now supports `sellKind: "item"` via `sellItemId`.
  - Resource orders remain unchanged and still lock balances through `resource_spent`.
  - Item orders require a server-created item owned by the seller, reject bound items, reject already market-locked items and mark the item with `marketLockedByOrderId`.
  - Filling an item order spends buyer payment, grants seller net proceeds, emits `item_transferred`, moves inventory indexes from seller to buyer and records `transferredItemId` on the filled order.
  - Cancelling or expiring an item order unlocks the item without minting resources.
- Added surfaces:
  - HTTP and MCP `create_market_order` accept `sellItemId`.
  - Agent Console market form can switch between resource and item sell orders and displays item order names.
  - `item_transferred` is a high-impact audit event.
- Verification:
  - `npm run agent:test -- --test-name-pattern "inventory items transfer|bound inventory items cannot be listed"`: RED before implementation because the market only accepted `sellResourceId`; passed after core event/projection/settlement wiring.
  - `npm run agent:test -- --test-name-pattern "market orders transfer unbound inventory items"`: RED before runtime/MCP wiring because HTTP/MCP still parsed item orders as resource orders; passed after runtime and tool schema updates.
  - `npm run agent:ui-test -- --test-name-pattern "item market orders|market writes|market fees|market risk"`: RED before Agent Console updates because the market form had no item sell mode; passed after frontend type/UI wiring.
  - Full verification remains to be run after this slice's documentation updates.

Server-authoritative shop purchase slice:

- Added fixed server shop offers:
  - `gray-ration-pack`: `coin` 3 -> `灰市补给包`
  - `aether-survey-lantern`: `coin` 4 + `aether` 1 -> `灵质探勘灯`
- Added owner-authorized purchase from server-ledger resources:
  - `purchaseShopOffer`
  - `GET /api/epoch/shop`
  - `POST /api/epoch/shop/purchase`
  - `obsidian_epoch.shop`
  - `obsidian_epoch.purchase_shop_offer`
  - `getEpochShop`
  - `purchaseEpochShopOffer`
- Rules:
  - Clients submit only `offerId`; item key, display name, rarity and costs come from the server offer table.
  - Purchase requires owner recovery authorization in Runtime/HTTP/MCP.
  - Purchase spends real resources through `resource_spent` events before `item_created`.
  - Client-declared price or item fields are ignored, so a modified prompt/MCP cannot turn a small offer into a high-rank item.
- Added surfaces:
  - Agent Console inventory panel now includes a shop offer selector, shop refresh and owner-authorized purchase button.
  - Install/tool lists include `obsidian_epoch.shop` and `obsidian_epoch.purchase_shop_offer`.
  - Protocol, Skill and architecture docs now describe shop purchases as server catalog state.
- Verification:
  - `npm run agent:test -- --test-name-pattern "shop purchases use server catalog|shop purchases spend server-priced"`: RED before implementation because `purchaseShopOffer`, `obsidian_epoch.shop` and `/api/epoch/shop` were missing; passed after core/runtime/HTTP/MCP wiring.
  - `npm run agent:ui-test -- --test-name-pattern "server-authoritative inventory items"`: RED before Agent Console updates because the shop API wrapper and controls were missing; passed after frontend type/UI wiring.
  - Full verification remains to be run after this slice's documentation updates.

Server-authoritative regional shop pricing slice:

- Added regional price resolution to server shop offers:
  - `gray-ration-pack` keeps base `coin` 3 in `region_gray_harbor`.
  - `region_ash_outpost` resolves the same offer to `coin` 4.
- Rules:
  - `obsidian_epoch.shop` and `/api/epoch/shop?regionId=...` return the resolved regional `costs` plus `baseCosts` for display.
  - `purchaseShopOffer` accepts optional `regionId` and uses the same resolver for the actual `resource_spent` amount.
  - Client-declared prices are still ignored; the only accepted client choice is offer id plus target region.
  - Resource spend reasons include the region for audit replay, for example `shop_purchase:region_ash_outpost:gray-ration-pack`.
- Added surfaces:
  - MCP `obsidian_epoch.purchase_shop_offer` schema accepts `regionId`.
  - Agent Console purchase calls now submit the selected `regionId`, matching the region-filtered shop view.
  - Frontend shop offer type includes optional `priceRegionId` and `baseCosts`.
- Verification:
  - `npm run agent:test -- --test-name-pattern "shop purchases use server catalog|shop purchases spend server-priced"`: RED before implementation because regional catalog reads omitted the cross-region offer and purchases still charged base price 3; passed after shared resolver wiring.
  - `npm run agent:ui-test -- --test-name-pattern "server-authoritative inventory items|Epoch inventory API"`: RED before Agent Console purchase included `regionId`; passed after UI/API wiring.
  - Full verification remains to be run after this slice's documentation updates.

Server-authoritative region-limited shop goods slice:

- Added two server-catalog local shop goods:
  - `pipewarden-valve-kit` is a common `region_city_pipes` tool that costs `coin:2` plus `stamina:1`, remains tradable after purchase, and is created only as `shop:pipewarden-valve-kit`.
  - `mine-echo-relic` is a rare `region_abandoned_mine` relic with `bindOnAcquire`, so it enters inventory already bound and cannot be listed on item markets.
- Rules:
  - `obsidian_epoch.shop` and `/api/epoch/shop?regionId=...` filter those goods by their owning region instead of letting local MCP code or prompt text move them between regions.
  - `purchase_shop_offer` continues to ignore client-declared item keys, prices and bound state; region-limited purchases spend the server catalog price and emit region-tagged `resource_spent` audit reasons.
- Added surfaces:
  - Packaged item icons for both goods were added and generated, taking `assets.items` from 6 to 8 entries.
  - MCP, HTTP and Agent Console shop reads receive the same server-packaged media on `shop.offers[].media`.
- Verification:
  - `node --import tsx --test ../agent-server/test/epoch-game-core.test.ts`: RED before implementation because `region_city_pipes` had no local offer; passed after adding catalog entries.
  - `node --import tsx --test ../agent-server/test/mcp.test.ts`
  - `node --import tsx --test ../agent-server/test/server.test.ts`
  - `node --import tsx --test ../agent-server/test/packageArchive.test.ts`

Server-authoritative bound rare relic shop slice:

- Added a bind-on-acquire rare relic to the server shop:
  - `ashen-oath-relic`: `coin` 8 + `legend` 1 -> `灰誓遗物`
- Rules:
  - Shop offer metadata exposes `bindOnAcquire: true` for rare relics.
  - `purchaseShopOffer` ignores client-declared bound state and uses the server offer definition.
  - The resulting `item_created` is already `bound: true`.
  - Bound relics cannot be listed into item-market escrow; attempts are rejected with `inventory_item_bound_not_tradable`.
- Added surfaces:
  - Agent Console shop options show `绑定` for bind-on-acquire offers.
  - Frontend `EpochShopOffer` type includes optional `bindOnAcquire`.
  - HTTP maps bound item market attempts to client error status instead of internal error.
- Verification:
  - `npm run agent:test -- --test-name-pattern "shop purchases use server catalog|shop purchases spend server-priced"`: RED before implementation because `ashen-oath-relic` was absent and HTTP mapped bound item market rejection as 500; passed after server offer, purchase binding and error mapping.
  - Full verification remains to be run after this slice's documentation updates.

Server-authoritative procurement bounty contract slice:

- Extended bounty escrow into item procurement contracts:
  - `createBounty.requiredItemKey` records an optional canonical inventory item key required for claim settlement.
  - `claimBounty.fulfillmentItemId` submits a concrete server inventory item for procurement bounties.
  - `bounty_created` projects `requiredItemKey`.
  - `bounty_claimed` projects `transferredItemId`.
- Rules:
  - Plain text evidence alone cannot claim a procurement bounty.
  - The fulfillment item must be owned by the claimant, unbound, not market-locked and exactly match `requiredItemKey`.
  - Settlement emits `item_transferred`, moves the item into the sponsor inventory and releases only the escrowed server reward.
  - Bound rare relics and market-locked items cannot be laundered through procurement bounties.
- Added surfaces:
  - MCP schemas for `obsidian_epoch.create_bounty` and `obsidian_epoch.claim_bounty` expose `requiredItemKey` and `fulfillmentItemId`.
  - HTTP maps procurement validation failures such as `bounty_fulfillment_item_required` and `bounty_item_key_mismatch` to client errors.
  - Agent Console bounty controls include required item key input, fulfillment item selection and claimed transfer display.
  - Protocol, Skill and architecture docs describe procurement bounties as server-authoritative contract-market loops.
- Verification:
  - `npm run agent:test`: RED before implementation because `requiredItemKey` was not projected in core/MCP/HTTP bounty results; passed after core/runtime/MCP/HTTP wiring and exact item-key preservation.
  - Full verification remains to be run after this slice's documentation updates.

Regional market summary read-model slice:

- Added `region_info.marketSummary` as a read-only projection over server market orders for the requested region:
  - `totalOrders`
  - `openOrders`
  - `filledOrders`
  - `cancelledOrders`
  - `expiredOrders`
  - `filledVolume`
  - `collectedFees`
  - `filledResources`
  - `latestActivityAt`
- Rules:
  - The summary is recomputed from canonical projected orders, not written by clients.
  - Filled, cancelled and expired orders inherit the original order `regionId`.
  - Filled volume and collected fees use server-settled order amounts and fee fields.
  - Local market pressure can be displayed by MCP, HTTP public pages and Agent Console without trusting story text or modified MCP adapters.
- Added surfaces:
  - `obsidian_epoch.region_info` returns `marketSummary`.
  - `/epoch/region/{regionId}` renders a "市场概况" tile group.
  - Agent Console region panel shows local order counts,成交额 and market tax.
  - Protocol, Skill and architecture docs describe the summary as a server-derived read model.
- Verification:
  - `node --import tsx --test --test-name-pattern "MCP Epoch tools expose server-issued identity" ../agent-server/test/mcp.test.ts`: RED before implementation because `region.marketSummary` was missing; passed after runtime projection wiring.
  - `node --import tsx --test --test-name-pattern "HTTP Epoch routes persist canonical events" ../agent-server/test/server.test.ts`: RED before implementation because HTTP `region_info` lacked `marketSummary`; passed after public region page and HTTP payload wiring.
  - `node --import tsx --test src/agent/AgentExplorer.layout.test.ts --test-name-pattern "regional market summary"`: RED before implementation because Agent Console did not surface `region.marketSummary`; passed after frontend type/UI wiring.
  - Full verification passed for this slice: `npm run typecheck`, `npm test`, `npm run build`, `npm run check:no-js`, `git diff --check`, touched-file trailing-whitespace scan and touched-file conflict-marker scan.

Downloadable package integrity slice:

- Added live package integrity metadata to the public install manifest:
  - `package.fileName`
  - `package.contentType`
  - `package.bytes`
  - `package.sha256`
- Rules:
  - `package.sha256` and `package.bytes` are computed from the exact generated tarball.
  - `/api/epoch/package/{file}` echoes the same sha256 in `x-obsidian-epoch-package-sha256`.
  - `/epoch/install` renders the sha256 and byte count next to the package download link.
  - Installed hosts should treat the live server manifest as the source of truth for archive integrity.
- Added surfaces:
  - HTTP install manifest includes package integrity metadata.
  - Public install page displays package integrity.
  - Download response includes package sha256 header.
  - Host-install and protocol docs explain verifying `package.sha256`.
- Verification:
  - `node --import tsx --test --test-name-pattern "HTTP Epoch routes persist canonical events" ../agent-server/test/server.test.ts`: RED before implementation because `installManifest.body.package` was missing; passed after HTTP manifest/page/download wiring.
  - `node --import tsx --test ../agent-server/test/packageArchive.test.ts`: RED before docs because `host-install.md` did not mention `package.sha256`; passed after host-install guidance was updated.

Executable install smoke command slice:

- Added `npm run agent:install-smoke -- --json` as a TS-only acceptance command.
- Rules:
  - The command starts a temporary local HTTP server.
  - It launches the same stdio MCP entrypoint used by installed hosts with `AGENT_WORLD_SERVER`.
  - It runs identity -> `turn_card` -> `resolve_turn` -> `create_result_page` through MCP.
  - It verifies the returned result page and agent page over HTTP before reporting success.
  - JSON output is machine-readable for users, CI and future plugin installers.
- Added surfaces:
  - `tools/agent-server/install-smoke.ts`
  - `package.json` script `agent:install-smoke`
  - `verification.installSmokeCommand` in live and static install manifests.
  - Public install page displays the smoke command.
  - Host-install, smoke playbook, protocol and architecture docs describe the executable acceptance path.
- Verification:
  - `node --import tsx --test ../agent-server/test/install-smoke-command.test.ts`: RED before implementation because npm had no `agent:install-smoke` script; passed after adding the TS command and MCP/HTTP smoke orchestration.
  - `npm run agent:install-smoke -- --json`: passed and returned `"ok": true`, `"via": "stdio-mcp"`, a server-issued `agentId`, a `/epoch/result/{pageId}` URL, and HTTP 200 for both public pages.

Remote deployment install smoke slice:

- Extended `npm run agent:install-smoke -- --json` with remote server targeting:
  - `AGENT_WORLD_SERVER=<serverBase> npm run agent:install-smoke -- --json`
  - `npm run agent:install-smoke -- --server <serverBase> --json`
- Rules:
  - Without a server override, the command keeps the local temporary-server behavior.
  - With `AGENT_WORLD_SERVER` or `--server`, the command does not start a local server; it launches the stdio MCP proxy against the existing HTTP/HTTPS deployment.
  - Remote JSON output includes `"mode": "remote"` and the tested `serverBase`.
  - The command still proves identity -> `turn_card` -> `resolve_turn` -> `create_result_page` and verifies public result/agent pages.
- Added surfaces:
  - `verification.remoteInstallSmokeCommand` in live and static install manifests.
  - Public install page displays the remote smoke command.
  - Deploy README, host-install, smoke playbook, protocol and architecture docs describe remote deployment smoke.
- Verification:
  - `node --import tsx --test ../agent-server/test/install-smoke-command.test.ts`: RED before implementation because remote runs returned no `"mode": "remote"` and used local temporary servers; passed after adding `AGENT_WORLD_SERVER` and `--server` support.
  - `node --import tsx --test ../agent-server/test/packageArchive.test.ts`: RED before manifest update because static package manifests lacked `verification.remoteInstallSmokeCommand`; passed after manifest/docs update.
  - `node --import tsx --test --test-name-pattern "HTTP Epoch routes persist canonical events" ../agent-server/test/server.test.ts`: RED before live manifest/page update because `remoteInstallSmokeCommand` and `--server` were absent; passed after live manifest and install page wiring.

Explorer dashboard install-smoke acceptance slice:

- Extended install smoke from "can play one turn" into "can play and prove the player dashboard":
  - After identity issue and turn/result publication, the downloaded package MCP proxy now calls `obsidian_epoch.explorer_profile` with the smoke `explorerId`.
  - The smoke command opens the returned `/epoch/explorer/{explorerId}` page and verifies HTTP 200, HTML content, matching `explorerId`, matching issued `agentId` and no script tag.
  - JSON output now includes `seed`, `explorerId`, `explorerPageUrl`, `explorerPageStatus`, `explorerProfileVerified` and `explorerProfileIdentityCount` alongside the existing agent/result/Web LLM bridge evidence.
  - Host-install and smoke playbook docs now describe result, agent and explorer page checks as one deployment acceptance path.
- Verification:
  - `node --import tsx --test ../agent-server/test/install-smoke-command.test.ts`: RED before implementation because `explorerProfileVerified` was `undefined`; passed after MCP explorer-profile read, public explorer-page verification and JSON result wiring.

Automatic next-life issuance slice:

- Closed the lifetime-end gap in the server-settled play loop:
  - `adjustLifetime`, `resolve_turn`, hosted/Web LLM action submission and anomaly resolution now share the same lifetime-adjustment event builder.
  - When a server-settled lifetime effect reduces an active identity to zero, the same canonical batch emits `lifetime_adjusted`, `identity_archived`, `identity_issued` and `reincarnation_issued`.
  - The archived identity receives `nextAgentId`, the explorer lineage includes the new active identity, and public archive pages show the next-life id immediately after the fatal settlement.
  - Manual retirement remains owner-recovery-authorized through `archive_identity` / `reincarnate`; a client still cannot provide canonical final titles, next-life names or lineage links.
- Verification:
  - `node --import tsx --test ../agent-server/test/epoch-game-core.test.ts --test-name-pattern "lifetime exhaustion"`: RED before implementation because exhaustion emitted only `lifetime_adjusted` and `identity_archived`; passed after automatic next-life issuance.
  - `node --import tsx --test ../agent-server/test/server.test.ts --test-name-pattern "risky turn exhaustion"`: RED before implementation because HTTP turn settlement did not archive or issue the next identity; passed after `resolve_turn` used the shared lifetime adjustment path.

Remote install preflight integrity slice:

- Extended install smoke preflight before MCP play:
  - verifies `/api/health`
  - verifies `/api/epoch/install-manifest`
  - checks live `serverBase` against the tested origin
  - downloads `packageUrl`
  - verifies package byte count, sha256 and optional `x-obsidian-epoch-package-sha256`
- Rules:
  - Local smoke and remote smoke both run the same preflight.
  - Live install manifests derive `serverBase` and `packageUrl` from the request host; reverse proxies may supply forwarded host/proto.
  - Smoke JSON reports `healthStatus`, `installManifestStatus`, `packageIntegrityVerified`, `packageSha256` and `packageBytes`.
- Verification:
  - `node --import tsx --test --test-name-pattern "HTTP Epoch routes persist canonical events" ../agent-server/test/server.test.ts`: RED before live manifest base fix because `serverBase` was hardcoded to `http://127.0.0.1:8787`; passed after request-derived live manifest URLs.
  - `node --import tsx --test ../agent-server/test/install-smoke-command.test.ts`: RED before preflight implementation because the smoke result lacked health, manifest and package integrity fields; passed after package preflight verification.

Deployment health contract slice:

- Upgraded deployment health from a shallow alive check to a structured readiness contract.
- Rules:
  - `startEpochMaintenanceScheduler().status()` exposes enabled, interval, in-flight, last start/finish/success/error and last summary without leaking operator keys
  - `/api/health` returns `checks.store` for memory/JSONL/SQLite readiness and `checks.maintenance` for scheduler readiness
  - production `server.ts` injects the real persistence mode and scheduler status into the HTTP health endpoint
  - `agent:install-smoke` now requires `health.ok === true` and the presence of store/maintenance checks before manifest, package and MCP gameplay verification
- Verification:
  - `node --import tsx --test ../agent-server/test/maintenance.test.ts --test-name-pattern "scheduler exposes|scheduler records"`
  - `node --import tsx --test ../agent-server/test/server.test.ts --test-name-pattern "HTTP health reports"`
  - `node --import tsx --test ../agent-server/test/install-smoke-command.test.ts`
  - RED result: scheduler had no `status()`, `/api/health` had no `checks`, and install smoke did not report `healthOk` or `healthChecks`.
  - GREEN result: passed after adding scheduler status snapshots, structured HTTP checks and health-body validation in install smoke.

Season-linked Boss encounter slice:

- Added server-owned opening Boss encounters to `seed_season`:
  - `seed_season` still creates the season campaign, starts the phase and emits template objectives.
  - A fresh season now also spawns one server-owned anomaly/Boss encounter for the region when no open anomaly blocks it.
  - The anomaly event carries `sourceSeasonId`, and the projected anomaly keeps that field for region and season archive reads.
  - The opening encounter also emits the existing server-derived `region_news_generated` alert.
- Added `obsidian_epoch.season_archive` as the MCP read tool for one season archive.
- Added season archive `encounters` and rendered them on public season pages as `赛季遭遇`.
- Rules:
  - The client cannot provide `sourceSeasonId`; runtime writes it when creating a server-owned encounter.
  - Boss title, description, target score, reward and lifetime risk still come from server templates.
  - If a region already has an open anomaly, season creation does not fail; the opening encounter is skipped by the same one-open-anomaly rule.
- Verification:
  - `node --import tsx --test ../agent-server/test/mcp.test.ts --test-name-pattern "seasonal faction campaigns"`: RED before implementation because `seed_season` did not emit `anomaly_event_spawned` and MCP had no `season_archive`; passed after core payload/projection, runtime seedSeason, MCP registration and public archive wiring.

Scheduled backup/off-host restore artifacts slice:

- Added deployable production operations artifacts:
  - `systemd/obsidian-epoch-backup.service`
  - `systemd/obsidian-epoch-backup.timer`
  - `cron/obsidian-epoch-backup.cron`
  - `runbooks/off-host-restore.md`
- Rules:
  - The systemd and cron examples run the existing TS-only `npm run agent:backup` command from `/opt/obsidian-epoch/tools/graph-react-app`.
  - Both examples snapshot `/data/agent-world.sqlite`, copy JSONL-compatible ledgers from `/data`, keep 14 rotations and write under `/data/backups`.
  - The off-host restore runbook keeps copy, restore, recovery drill and environment cutover separate.
  - Restore guidance preserves the command-level safety rule: fresh target paths only, no production overwrite.
- Verification:
  - `node --import tsx --test ../agent-server/test/deploy-config.test.ts`: RED before implementation because README references were absent and `deploy/systemd/obsidian-epoch-backup.service` did not exist; passed after adding deploy artifacts and README wiring.

Server-owned Boss media metadata slice:

- Added public media metadata to bundled server-owned Boss templates:
  - `variantLabel`
  - `scenePrompt`
  - `palette`
  - `accentColor`
  - `dangerColor`
  - `sigil`
  - `publicAlt`
- Rules:
  - Boss media is copied from server templates into `anomaly_event_spawned.media`.
  - The projected anomaly keeps `media` for `obsidian_epoch.anomalies`, `region_info` and `season_archive`.
  - Media is display-only; score, reward, lifetime risk, influence and trace settlement remain unchanged.
  - Client prompt text, local MCP changes and custom spawn body fields cannot replace bundled Boss media.
- Added surfaces:
  - Public region pages render anomaly media metadata.
  - Public season archive pages render seasonal encounter media metadata.
  - Agent Console renders the active anomaly's media label, sigil, alt text, scene prompt and palette swatches.
- Verification:
  - `node --import tsx --test ../agent-server/test/maintenance.test.ts --test-name-pattern "boss|anomaly chains"`: RED before implementation because Boss templates and spawned anomalies had no `media`; passed after protocol/event/projection/template wiring.
  - `node --import tsx --test ../agent-server/test/mcp.test.ts --test-name-pattern "seasonal faction campaigns"`: RED before implementation because the season-linked encounter had no `media`; passed after `anomaly_event_spawned.media` projected into region and season archive reads.
  - `node --import tsx --test ../agent-server/test/server.test.ts --test-name-pattern "server-spawned anomaly chains"`: RED before implementation because HTTP/template-spawned Bosses had no media and public region pages did not render it; passed after HTTP reads and public page rendering.
  - `node --import tsx --test src/agent/AgentExplorer.layout.test.ts --test-name-pattern "anomaly chain controls"`: RED before implementation because Agent Console did not reference `primaryAnomaly.media`; passed after adding the compact Boss media panel.

Server-owned Boss PNG asset pack slice:

- Added a TS-only Boss asset registry and generator:
  - `tools/agent-server/lib/bossAssets.ts` owns the five bundled Boss asset records, package paths, HTTP URLs, dimensions and manifest hashing.
  - `tools/agent-server/generate-boss-assets.ts` deterministically generates 960x540 PNG files without JS/MJS sources or new dependencies.
  - `npm run agent:generate-boss-assets -- --json` regenerates the PNG files and updates both static install manifests with `assets.bosses`.
- Added downloadable/renderable surfaces:
  - The install archive now includes `obsidian-epoch/assets/boss/*.png`.
  - `/api/epoch/install-manifest` exposes `assets.bosses` with sha256 proofs.
  - `/api/epoch/assets/boss/{fileName}` serves the PNG bytes.
  - Public region and season pages render Boss images from server-issued `media.imageUrl`.
  - The install page lists the packaged Boss asset paths, dimensions, URLs and hashes.
- Rules:
  - Boss template `media.assetPath` and `media.imageUrl` are server-authored and normalized before projection.
  - Client prompts, modified MCP adapters and custom spawn bodies cannot substitute image URLs or asset hashes.
- Verification:
  - `node --import tsx --test ../agent-server/test/packageArchive.test.ts`: RED before implementation because package archive had no Boss PNG files or `assets.bosses`; passed after generating assets and manifest entries.
  - `node --import tsx --test ../agent-server/test/server.test.ts --test-name-pattern "server-spawned anomaly chains|public install page"`: RED before implementation because spawned Boss media had no `imageUrl`, install manifest had no `assets.bosses`, and asset HTTP route did not exist; passed after runtime, public page and HTTP asset wiring.

Server-packaged regional location asset slice:

- Added a TS-only regional location asset registry and generator:
  - `tools/agent-server/lib/locationAssets.ts` owns five packaged region image records.
  - `tools/agent-server/lib/pngDrawing.ts` centralizes PNG encoding and drawing helpers shared by Boss and location generators.
  - `tools/agent-server/generate-location-assets.ts` deterministically generates 960x540 location PNG files and updates both static install manifests with `assets.locations`.
- Added downloadable/renderable surfaces:
  - The install archive now includes `obsidian-epoch/assets/location/*.png`.
  - `/api/epoch/install-manifest` exposes `assets.locations` with sha256 proofs.
  - `/api/epoch/assets/location/{fileName}` serves the PNG bytes.
  - `region_info.media` exposes display-only region media for known region ids.
  - Public region pages and Agent Console render the server-packaged region image.
  - The install page lists packaged regional image paths, dimensions, URLs and hashes.
- Rules:
  - Regional media is display-only and cannot create region control, influence, rank, rewards or inventory.
  - Client prompts, modified MCP adapters and custom image URLs cannot substitute packaged location assets.
- Verification:
  - `node --import tsx --test ../agent-server/test/packageArchive.test.ts`: RED before implementation because package archive had no regional location PNG files or `assets.locations`; passed after generating assets and manifest entries.
  - `node --import tsx --test ../agent-server/test/server.test.ts --test-name-pattern "server-spawned anomaly chains|public install page"`: RED before implementation because `region_info.media`, install manifest `assets.locations`, public region image rendering and location asset HTTP route did not exist; passed after runtime, public page and HTTP asset wiring.
  - `node --import tsx --test src/agent/AgentExplorer.layout.test.ts --test-name-pattern "region panel surfaces the server-derived region leaderboard"`: RED before implementation because Agent Console did not reference `region.media`; passed after adding the regional media panel.

Server-packaged NPC portrait asset slice:

- Added a TS-only NPC portrait asset registry and generator:
  - `tools/agent-server/lib/npcAssets.ts` owns five packaged NPC portrait archetypes, package paths, HTTP URLs, dimensions and manifest hashing.
  - `tools/agent-server/generate-npc-assets.ts` deterministically generates 640x640 NPC PNG files without JS/MJS sources or new dependencies.
  - `npm run agent:generate-npc-assets -- --json` regenerates the PNG files and updates both static install manifests with `assets.npcs`.
- Added downloadable/renderable surfaces:
  - The install archive now includes `obsidian-epoch/assets/npc/*.png`.
  - `/api/epoch/install-manifest` exposes `assets.npcs` with sha256 proofs.
  - `/api/epoch/assets/npc/{fileName}` serves the PNG bytes.
  - `region_info.npcs[].media` exposes a deterministic server-assigned portrait archetype for canonical NPCs.
  - Public region/NPC pages and Agent Console render NPC portrait images.
  - The install page lists packaged NPC portrait paths, dimensions, URLs and hashes.
- Rules:
  - NPC portraits are display-only and cannot create rank, career, relationships, health, wealth, authority or settlement.
  - Client prompts, modified MCP adapters and custom image URLs cannot substitute packaged NPC portrait assets.
- Verification:
  - `node --import tsx --test ../agent-server/test/packageArchive.test.ts`: RED before implementation because package archive had no NPC portrait PNG files or `assets.npcs`; passed after generating assets and manifest entries.
  - `node --import tsx --test ../agent-server/test/server.test.ts --test-name-pattern "public pages"`: RED before implementation because `region_info.npcs[].media`, public NPC rendering and NPC asset HTTP route did not exist; passed after runtime, public page and HTTP asset wiring.
  - `node --import tsx --test src/agent/AgentExplorer.layout.test.ts --test-name-pattern "NPC portraits"`: RED before implementation because Agent Console did not reference `npc.media`; passed after adding the NPC portrait row.
  - `npm run typecheck`: passed, including `npm run check:no-js`.
  - `npm test`: passed, 201 agent-server tests, 11 batch tests and 51 agent UI/API tests.
  - `npm run build`: passed, generated the exported world map HTML and removed transient Vite `dist`.
  - `npm run check:no-js`: passed after build.
  - Manual JS/MJS/JSX source scan excluding `node_modules`, `.git`, `dist` and `.codegraph`: no output.
  - `git diff --check`: no output.
  - Conflict marker scan excluding `node_modules` and `dist`: no output.
  - Local server smoke: `/api/health` returned `ok: true`, live manifest contained `assets.npcs`, and `GET /api/epoch/assets/npc/harbor-ledger-keeper.png` returned PNG bytes.

Server-packaged item icon asset slice:

- Added a TS-only item icon asset registry and generator:
  - `tools/agent-server/lib/itemAssets.ts` owns eight packaged item icon records for server craft recipes and shop goods, package paths, HTTP URLs, dimensions and manifest hashing.
  - `tools/agent-server/generate-item-assets.ts` deterministically generates 512x512 item PNG files without JS/MJS sources or new dependencies.
  - `npm run agent:generate-item-assets -- --json` regenerates the PNG files and updates both static install manifests with `assets.items`.
- Added downloadable/renderable surfaces:
  - The install archive now includes `obsidian-epoch/assets/item/*.png`.
  - `/api/epoch/install-manifest` exposes `assets.items` with sha256 proofs.
  - `/api/epoch/assets/item/{fileName}` serves the PNG bytes.
  - `progress.inventoryItems[].media`, `inventory.items[].media` and `shop.offers[].media` expose display-only item icon media for packaged item keys.
  - Public agent/result pages and Agent Console render server-packaged item icons for inventory and selected shop offers.
  - The install page lists packaged item icon paths, dimensions, URLs and hashes.
- Rules:
  - Item icons are display-only and cannot create item ownership, price, binding, tradability, resource balances, equipment effects or settlement.
  - Client prompts, modified MCP adapters and custom image URLs cannot substitute packaged item icon assets.
- Verification:
  - `node --import tsx --test ../agent-server/test/packageArchive.test.ts`: RED before implementation because package archive had no item icon PNG files or `assets.items`; passed after generating assets and manifest entries.
  - `node --import tsx --test ../agent-server/test/server.test.ts --test-name-pattern "install manifest|crafts inventory|shop purchases"`: RED before implementation because install manifest, item asset route, inventory media and shop offer media did not exist; passed after runtime, public page and HTTP asset wiring.
  - `node --import tsx --test src/agent/AgentExplorer.layout.test.ts --test-name-pattern "server-authoritative inventory items"`: RED before implementation because Agent Console did not reference `item.media` or selected shop offer media; passed after adding compact item icon rows.

Server-packaged faction emblem and season banner asset slice:

- Added a TS-only faction/season asset registry and generator:
  - `tools/agent-server/lib/factionAssets.ts` owns the three packaged faction emblem records and one packaged season banner record, package paths, HTTP URLs, dimensions and manifest hashing.
  - `tools/agent-server/generate-faction-assets.ts` deterministically generates 512x512 faction PNG files and a 960x540 season banner PNG without JS/MJS sources or new dependencies.
  - `npm run agent:generate-faction-assets -- --json` regenerates the PNG files and updates both static install manifests with `assets.factions` and `assets.seasonBanners`.
- Added downloadable/renderable surfaces:
  - The install archive now includes `obsidian-epoch/assets/faction/*.png` and `obsidian-epoch/assets/season/*.png`.
  - `/api/epoch/install-manifest` exposes `assets.factions` and `assets.seasonBanners` with sha256 proofs.
  - `/api/epoch/assets/faction/{fileName}` and `/api/epoch/assets/season/{fileName}` serve the PNG bytes.
  - `obsidian_epoch.seasons`, `region_info.seasons` and `obsidian_epoch.season_archive` expose display-only `season.media.banner`, `season.media.factions` and `season.factionStandings[].media`.
  - Public region/season pages and Agent Console render the server-packaged season banner and faction emblems.
  - The install page lists packaged faction/season asset paths, dimensions, URLs and hashes.
- Rules:
  - Faction emblems and season banners are display-only and cannot create faction score, season winner, region control, monuments, rewards, rank or settlement.
  - Client prompts, modified MCP adapters and custom image URLs cannot substitute packaged faction/season assets.
  - The media lookup accepts both colon-delimited season template keys and the core-stabilized historical key shape.
- Verification:
  - `node --import tsx --test ../agent-server/test/packageArchive.test.ts`: RED before implementation because package archive had no faction/season PNG files or manifest entries; passed after generating assets and manifest entries.
  - `node --import tsx --test ../agent-server/test/server.test.ts --test-name-pattern "seasonal faction|install manifest"`: RED before implementation because season reads had no media, the install manifest had no faction/season assets and asset routes did not exist; passed after runtime, public page and HTTP asset wiring.
  - `node --import tsx --test src/agent/AgentExplorer.layout.test.ts --test-name-pattern "seasons to the public season archive page"`: RED before implementation because Agent Console did not reference `primarySeason.media` or `standing.media`; passed after adding the compact banner/emblem rendering.

One-time generic result page publish token slice:

- Added one-time publish-token gating for generic agent/explorer result pages:
  - `obsidian_epoch.result_page` and `GET /api/epoch/result-page` now return a `publishToken` alongside the canonical preview payload.
  - `obsidian_epoch.create_result_page` and `POST /api/epoch/result-page/create` require that token and owner recovery authorization when no resolved `turnCardId` or completed `hostedSessionId` is supplied.
  - The token is bound to the preview request and payload, is consumed after first successful publication, and rejects replay or mismatched agent/explorer/limit usage.
  - Idempotent replay of the same already-created page still returns the existing page without requiring another token.
  - Focused turn, hosted-runner and Web LLM bridge result pages keep the existing no-token path because the referenced server object has already been settled and validated.
- Added surfaces:
  - MCP schema exposes `publishToken`, `turnCardId` and `hostedSessionId` on result page tools.
  - Agent Console generic result publication now previews first and passes `preview.publishToken`; turn and bridge publication keep the server-object focus path.
  - Protocol, Skill and architecture docs now document the token boundary.
- Rules:
  - Generic public result pages cannot be published directly from prompt text or a modified MCP adapter without first receiving a matching server preview token and proving ownership of the payload explorer.
  - A token cannot be replayed for a different page, different subject or different idempotency key after successful publication.
- Verification:
  - `node --import tsx --test ../agent-server/test/server.test.ts --test-name-pattern "public agent, region and NPC world pages|Epoch routes persist canonical"`: RED before implementation because `result_page` returned no `publishToken`; passed after runtime token issuance/consumption and HTTP error mapping.
  - `node --import tsx --test src/agent/AgentExplorer.layout.test.ts --test-name-pattern "one-time publish token"`: RED before implementation because Agent Console called `createEpochResultPage` directly; passed after preview-token wiring.
  - `node --import tsx --test ../agent-server/test/mcp.test.ts --test-name-pattern "Epoch tools expose server-issued identity|world loop|create_result_page|MCP exposes"`: passed after updating the MCP generic result page flow to preview, reject missing token, then publish with the token.

Web LLM bridge package playbook slice:

- Added the packaged browser-only model handoff guide:
  - `obsidian-epoch/references/web-llm-bridge-playbook.md` documents the installed-host/web-console bridge loop, `copyPrompt`, one returned `actionOptionId`, server submission and focused result-page publication.
  - Live and static install manifests expose `playbooks.webBridge`.
  - `hostInstall` now includes a non-MCP `Web LLM bridge` entry with `obsidian_epoch.web_bridge_turn`, `obsidian_epoch.submit_web_bridge_action`, `obsidian_epoch.create_result_page` and public result page templates.
- Added install surface support:
  - `/epoch/install` renders both MCP host entries and the Web LLM bridge entry without assuming every host has an MCP command.
  - `host-install.md`, `protocol.md`, `SKILL.md` and the architecture doc now point browser-only flows to the packaged playbook.
- Rules:
  - Browser-only models remain untrusted clients and cannot install the MCP server or submit custom settlement.
  - The browser receives only `copyPrompt` and may choose only a returned option id; rewards, rank, lifetime changes, NPC state and public result pages still come from server-settled sessions.
- Verification:
  - `node --import tsx --test ../agent-server/test/packageArchive.test.ts ../agent-server/test/server.test.ts`: RED before implementation because the package had no web bridge playbook and the live manifest had no `Web LLM bridge` hostInstall entry.
  - `node --import tsx --test ../agent-server/test/packageArchive.test.ts ../agent-server/test/server.test.ts`: passed after adding the packaged playbook, live/static manifest entries and install-page bridge rendering.
  - Live HTTP check against `http://127.0.0.1:8787`: `/api/epoch/install-manifest`, `/epoch/install` and the downloaded package all expose `obsidian-epoch/references/web-llm-bridge-playbook.md`.

Self-contained downloadable MCP proxy slice:

- Removed the development-repository assumption from the install package:
  - The package now includes `package.json` plus `obsidian-epoch/bin/mcp-proxy.ts`.
  - `.codex-plugin/plugin.json`, live install manifest and both static install manifests use `command: "node"`, `args: ["obsidian-epoch/bin/mcp-proxy.ts"]`, `cwd: "."`.
  - `obsidian_epoch.quickstart` now reports the same package-root command.
- Added server support for the package proxy:
  - `GET /api/epoch/mcp/tools/list` exposes the live MCP tool schemas.
  - The package proxy uses that route for `tools/list` and forwards `tools/call` to `/api/epoch/mcp/tools/call`.
  - `obsidian_epoch.quickstart` calls are forwarded with the configured `serverBase` so installed clients do not inherit a local default.
- Rules:
  - The downloaded package is a client proxy only; it does not include or create an authoritative local game shard.
  - Direct `node` startup avoids npm script banners on stdout, preserving MCP stdio framing.
- Verification:
  - `node --import tsx --test ../agent-server/test/packageArchive.test.ts ../agent-server/test/server.test.ts`: RED before implementation because package archive had no package-root MCP entry and live manifests still pointed at `tools/graph-react-app`; passed after adding the proxy, `/api/epoch/mcp/tools/list` and direct-node install manifests.
  - The archive test extracts the tarball to a temporary directory and successfully runs `node obsidian-epoch/bin/mcp-proxy.ts` through MCP `initialize`, `tools/list` and `obsidian_epoch.quickstart` against a backing server.

Downloaded-package install smoke slice:

- Strengthened `npm run agent:install-smoke` from package-integrity preflight to package-runtime acceptance:
  - The smoke command now downloads the live package, verifies byte count and sha256, extracts the tarball to a temporary directory, launches `node obsidian-epoch/bin/mcp-proxy.ts` from that extracted root, verifies `tools/list`, then runs identity -> turn card -> resolve turn -> result page through that package proxy.
  - JSON output now includes `packageProxyVerified: true` and `packageMcpCommand: "node obsidian-epoch/bin/mcp-proxy.ts"`.
- Rules:
  - Install smoke must prove the artifact users download can run the MCP flow; repository-local `mcp.ts` is no longer sufficient evidence for package installability.
  - The downloaded package is still only a thin client proxy; all canonical state remains on the server selected by `AGENT_WORLD_SERVER`.
- Verification:
  - `node --import tsx --test ../agent-server/test/install-smoke-command.test.ts`: RED before implementation because install smoke did not report package proxy proof; passed after switching the smoke MCP client to the extracted download package.

Web LLM bridge install smoke slice:

- Strengthened `npm run agent:install-smoke` so public deployment acceptance now proves browser-only model play, not only MCP one-turn play:
  - After the downloaded package proxy completes identity -> `turn_card` -> `resolve_turn` -> `create_result_page`, the smoke command now calls `obsidian_epoch.web_bridge_turn`, verifies the returned browser-copy prompt contains a server-issued action option, calls `obsidian_epoch.submit_web_bridge_action`, publishes the completed bridge session with `obsidian_epoch.create_result_page`, and checks that bridge result page returns HTTP 200.
  - JSON output now includes `webBridgeVerified: true`, `webBridgeSessionId`, `webBridgeResultPageUrl` and `webBridgeResultPageStatus`.
  - Default smoke runs now generate a fresh seed when `AGENT_INSTALL_SMOKE_SEED` is not set, preventing repeated remote checks against a persistent deployment from colliding with older smoke identities or idempotency records. Setting `AGENT_INSTALL_SMOKE_SEED` keeps deterministic replay for disposable test servers.
- Rules:
  - Remote deployment smoke must prove both installed MCP host play and Web LLM bridge play.
  - Browser bridge smoke remains untrusted: it submits one server-issued `actionOptionId`; browser prose and `clientDeclaredOutcome` cannot choose rewards or authority.
  - Repeated operator smoke checks should create fresh evidence by default rather than reusing old persistent smoke records.
- Verification:
  - `node --import tsx --test ../agent-server/test/install-smoke-command.test.ts`: RED before implementation because `webBridgeSessionId`, `webBridgeResultPageUrl`, `webBridgeResultPageStatus` and `webBridgeVerified` were missing; passed after adding the downloaded-package Web LLM bridge flow.
  - `node --import tsx --test --test-name-pattern "fresh default seed" ../agent-server/test/install-smoke-command.test.ts`: RED before implementation because repeated no-seed remote checks returned the same `agentId`; passed after making the default seed unique.
  - Live remote check: `npm run agent:install-smoke -- --server http://127.0.0.1:8787 --json` passed and returned `"packageProxyVerified": true`, `"webBridgeVerified": true`, turn and bridge result page URLs, and HTTP 200 for both result pages plus the public agent page.
  - `npm run typecheck`: passed, including `npm run check:no-js`.
  - `npm test`: passed, 203 agent-server tests, 11 batch tests and 52 agent UI/API tests.
  - `npm run build`: passed and removed transient Vite `dist`.
  - Manual JS/MJS/JSX source scan excluding dependencies/generated outputs: no output.
  - `git diff --check`: no output.
  - Conflict marker scan excluding dependencies/generated outputs: no matches.

Install manifest tool parity slice:

- Closed a package/install discoverability gap:
  - Both static install manifests in the downloadable package now list the full `obsidian_epoch.*` MCP tool surface.
  - The live `/api/epoch/install-manifest` tool list is generated from the same MCP tool registry used by `/api/epoch/mcp/tools/list`, instead of a hand-maintained duplicate array.
  - Package archive tests now require the root manifest and Skill asset manifest to match the current MCP runtime tool list.
  - Server tests now require the live install manifest to match the live MCP tool-list endpoint exactly.
- Rules:
  - Adding or removing an Epoch MCP tool must automatically affect the live install manifest.
  - Static package manifests must be updated before the archive test can pass, so installed hosts do not receive stale tool capability metadata.
- Verification:
  - `node --import tsx --test ../agent-server/test/packageArchive.test.ts`: RED before implementation because the root static manifest had no `tools` list and the Skill manifest missed inventory/shop/turn-card tools; passed after syncing both manifests to 89 `obsidian_epoch.*` tools.
  - `node --import tsx --test ../agent-server/test/server.test.ts`: RED before implementation because live `/api/epoch/install-manifest` missed `turn_card`, `resolve_turn`, `organization_politics` and `tick_organization_politics`; passed after deriving live tools from the MCP registry.
  - Live HTTP parity check against `http://127.0.0.1:8787`: `/api/epoch/mcp/tools/list`, `/api/epoch/install-manifest`, `package/install-manifest.json` and `obsidian-epoch/assets/install-manifest.json` all reported 89 `obsidian_epoch.*` tools with zero diff.
  - `npm run typecheck`: passed, including `npm run check:no-js`.
  - `npm test`: passed, 202 agent-server tests, 11 batch tests and 52 agent UI/API tests.
  - `npm run build`: passed and removed transient Vite `dist`.
  - Manual JS/MJS/JSX source scan excluding dependencies/generated outputs: no output.
  - `git diff --check`: no output.
  - Conflict marker scan excluding dependencies/generated outputs: no matches.

Docker TS runtime deployment slice:

- Closed a public deployment runtime gap:
  - The Dockerfile runs with `NODE_ENV=production`, while `npm run agent:server` intentionally runs TypeScript sources through `node --import tsx`.
  - The deployment image now installs the dependency set with `npm ci --include=dev` so `tsx` is present in the container.
  - Deploy config tests now assert that the Dockerfile includes dev dependencies while the server command depends on `tsx`.
  - Deploy README documents that the production container currently runs TS sources directly and therefore includes TS runtime dependencies.
- Rules:
  - Public deploy images must be able to run the same TS-only server command they advertise.
  - If `agent:server` stops using `tsx`, this guard can be revised; until then Docker cannot omit the TS runtime dependency set.
- Verification:
  - `node --import tsx --test ../agent-server/test/deploy-config.test.ts`: RED before implementation because Dockerfile used plain `npm ci`; passed after switching to `npm ci --include=dev`.
  - `npm run typecheck`: passed, including `npm run check:no-js`.
  - `npm test`: passed, 203 agent-server tests, 11 batch tests and 52 agent UI/API tests.
  - `npm run build`: passed and removed transient Vite `dist`.
  - `npm run check:no-js`: passed after build.
  - Manual JS/MJS/JSX source scan excluding dependencies/generated outputs: no output.
  - `git diff --check`: no output.
  - Conflict marker scan excluding dependencies/generated outputs: no matches.

Web console deployment-origin slice:

- Closed a public web deployment gap:
  - The Agent console no longer defaults every browser session to `http://127.0.0.1:8787`.
  - `VITE_AGENT_SERVER_BASE` remains the explicit override for custom API origins.
  - When no override is set and the page is opened from `http:` or `https:`, the console now uses the current page origin as its API base.
  - `file:` and non-web contexts still fall back to the local development server at `http://127.0.0.1:8787`.
- Rules:
  - Publicly hosted pages must call their own deployed origin by default; otherwise every remote user tries to talk to localhost on their own machine.
  - Local exported HTML remains usable with the local server fallback.
- Verification:
  - `node --import tsx --test src/agent/api.test.ts`: RED before implementation because `resolveAgentServerBase` did not exist; passed after adding deployed-origin resolution.
  - `npm run typecheck`: passed, including `npm run check:no-js`.
  - `npm test`: passed, 203 agent-server tests, 11 batch tests and 53 agent UI/API tests.
  - `npm run build`: passed and removed transient Vite `dist`.
  - `npm run check:no-js`: passed after build.
  - Manual JS/MJS/JSX source scan excluding dependencies/generated outputs: no output.
  - `git diff --check`: no output.

Server-hosted Agent console slice:

- Closed a first-touch product gap:
  - The public HTTP server now exposes `/epoch/console` as a browser-accessible Agent Console entrypoint.
  - `/api/epoch/install-manifest` and `/epoch/install` now list `publicPages.console`.
  - The console route reuses the existing built `00_总览/黑曜纪元3D世界地图.html` artifact instead of creating a second web app.
  - The server inserts `<base href="/epoch/console/">` so console media references resolve under the console route.
  - `/epoch/console/assets/...` serves only files under `00_总览/assets` and rejects traversal attempts.
- Rules:
  - Users must be able to open a server URL and reach the playable/progress console, not only API endpoints and static public result pages.
  - The install page remains script-free; the interactive React console is isolated to `/epoch/console`.
  - Generated JS remains a build artifact only; source remains TS/TSX-only.
- Verification:
  - `node --import tsx --test --test-name-pattern "browser Agent console" ../agent-server/test/server.test.ts`: RED before implementation because the install manifest had no `publicPages.console`; passed after adding the route, manifest entry and static asset serving.
  - `npm run typecheck`: passed, including `npm run check:no-js`.
  - `npm test`: passed, 204 agent-server tests, 11 batch tests and 53 agent UI/API tests.
  - `npm run build`: passed and regenerated `00_总览/黑曜纪元3D世界地图.html`.
  - `npm run check:no-js`: passed after build.
  - Manual JS/MJS/JSX source scan excluding dependencies/generated outputs: no output.
  - `git diff --check`: no output.
  - Conflict marker scan excluding dependencies/generated outputs: no matches.

Install smoke Agent console coverage slice:

- Closed a deployment acceptance gap:
  - `npm run agent:install-smoke` now verifies the server-hosted Agent Console before it claims a deployment is usable.
  - The smoke preflight requires `/api/epoch/install-manifest` to expose `publicPages.console: "/epoch/console"`.
  - It fetches `/epoch/console` and checks for the React root, inlined world-map data and the console base href.
  - It also fetches a representative `/epoch/console/assets/...` media file to prove the console's static asset route works.
  - JSON output now includes `consolePageVerified`, `consoleAssetVerified`, `consolePageUrl`, `consolePageStatus` and `consoleAssetStatus`.
- Rules:
  - Remote deployment smoke must prove package installability, MCP gameplay, Web LLM bridge play and web console access.
  - Console failures must fail the smoke command before users discover the deployment is only partially usable.
- Verification:
  - `node --import tsx --test ../agent-server/test/install-smoke-command.test.ts`: RED before implementation because `consolePageVerified`, `consoleAssetVerified`, `consolePageUrl`, `consolePageStatus` and `consoleAssetStatus` were missing; passed after adding console preflight checks.
  - `npm run typecheck`: passed, including `npm run check:no-js`.
  - `npm test`: passed, 204 agent-server tests, 11 batch tests and 53 agent UI/API tests.
  - `npm run build`: passed and regenerated `00_总览/黑曜纪元3D世界地图.html`.
  - `npm run check:no-js`: passed after build.
  - Manual JS/MJS/JSX source scan excluding dependencies/generated outputs: no output.
  - `git diff --check`: no output.
  - Conflict marker scan excluding dependencies/generated outputs: no matches.

Static install manifest console parity slice:

- Closed a downloadable-package documentation gap:
  - The package root `install-manifest.json` now lists `publicPages.console: "/epoch/console"`.
  - The Skill asset manifest at `obsidian-epoch/assets/install-manifest.json` now lists the same console entry.
  - The Web LLM bridge host-install entry now advertises the console page alongside install/result pages.
  - `host-install.md` now states that install smoke verifies `/epoch/console`, one Console media asset and the new console verification output fields.
- Rules:
  - Live install manifest updates that affect user-facing entrypoints must be mirrored in the downloadable package's static manifests.
  - Browser-only model play can be initiated from an installed host or the web console, so the package's bridge guidance must point to `/epoch/console`.
- Verification:
  - `node --import tsx --test ../agent-server/test/packageArchive.test.ts`: RED before implementation because the static root manifest did not expose `publicPages.console`; passed after syncing both static manifests and the host-install reference.
  - `npm run typecheck`: RED once because the package archive test's `bridge` fixture type did not include `publicPages`; passed after updating the test type, including `npm run check:no-js`.
  - `npm test`: passed, 204 agent-server tests, 11 batch tests and 53 agent UI/API tests.
  - `npm run build`: passed and regenerated `00_总览/黑曜纪元3D世界地图.html`.
  - `npm run check:no-js`: passed after build.
  - Manual JS/MJS/JSX source scan excluding dependencies/generated outputs: no output.
  - `git diff --check`: no output.
  - Conflict marker scan excluding dependencies/generated outputs: no matches.

Live host-install origin slice:

- Closed a remote install configuration gap:
  - Live `/api/epoch/install-manifest` now injects the request-derived `serverBase` into every MCP host's `AGENT_WORLD_SERVER`.
  - The public install page inherits the same live manifest data, so copied Claude Code, Codex, Cursor, Hermes and OpenClaw configs point at the deployed origin instead of localhost.
  - The live Web LLM bridge host-install entry now also advertises `/epoch/console`.
  - Static package manifests keep their local default template, while the live server manifest remains the source of truth for a deployed origin.
- Rules:
  - Any manifest generated by a running public server must make copied host configuration target that same server.
  - Public install instructions cannot assume `http://127.0.0.1:8787` unless the manifest itself is the static package-local template.
- Verification:
  - `node --import tsx --test --test-name-pattern "request origin" ../agent-server/test/server.test.ts`: RED before implementation because live host MCP env values still pointed at `http://127.0.0.1:8787`; passed after threading `serverBase` into `epochHostInstallEntries`.
  - `npm run typecheck`: passed, including `npm run check:no-js`.
  - `npm test`: passed, 205 agent-server tests, 11 batch tests and 53 agent UI/API tests.
  - `npm run build`: passed and regenerated `00_总览/黑曜纪元3D世界地图.html`.
  - `npm run check:no-js`: passed after build.
  - Manual JS/MJS/JSX source scan excluding dependencies/generated outputs: no output.
  - `git diff --check`: no output.
  - Conflict marker scan excluding dependencies/generated outputs: no matches.

Downloadable package origin injection slice:

- Closed a direct package-install gap:
  - Downloaded tarballs from `/api/epoch/package/obsidian-epoch-agent-world-0.1.0-alpha.tar.gz` now embed the same request-derived `serverBase` as the live install manifest.
  - The package root `install-manifest.json` and `obsidian-epoch/assets/install-manifest.json` inside the downloaded archive now rewrite `serverBase`, `packageUrl` and every MCP host `AGENT_WORLD_SERVER` to the serving origin.
  - The packaged `.codex-plugin/plugin.json` now includes an explicit `env.AGENT_WORLD_SERVER`; local static packages default to `http://127.0.0.1:8787`, while downloaded packages are rewritten to the live origin.
  - `/epoch/install`, `/api/epoch/install-manifest` and `/api/epoch/package/...` compute package bytes and sha256 from the same origin-specific archive, so integrity checks match the package users actually download.
- Rules:
  - A remote install flow must not require users to discover and hand-edit a hidden localhost value after installing the Codex plugin package.
  - Live manifest sha256/byte proofs must describe the exact archive returned by the live package download route.
- Verification:
  - `node --import tsx --test ../agent-server/test/server.test.ts`: RED before implementation because the downloaded archive still contained `http://127.0.0.1:8787` in package manifests while the live server used a dynamic port.
  - `node --import tsx --test --test-name-pattern "HTTP Epoch routes persist canonical events" ../agent-server/test/server.test.ts`: passed after origin-specific package generation.
  - `node --import tsx --test ../agent-server/test/packageArchive.test.ts`: passed after locking the static Codex plugin env default.
  - `npm run typecheck`: passed, including `npm run check:no-js`.
  - `npm test`: passed, 205 agent-server tests, 11 batch tests and 53 agent UI/API tests.
  - `npm run build`: passed and regenerated `00_总览/黑曜纪元3D世界地图.html`.
  - `npm run check:no-js`: passed after build.
  - Manual JS/MJS/JSX source scan excluding dependencies/generated outputs: no output.
  - `git diff --check`: no output.
  - Conflict marker scan excluding dependencies/generated outputs: no matches.

Region commissions read-model slice:

- Closed a region playability gap:
  - `region_info` now includes `commissions`, a server-derived open commission list for the selected region.
  - The commission list aggregates existing canonical objects instead of inventing a parallel quest system: open anomaly chains, open resource nodes, open bounties, active contested objectives and social hooks.
  - Each commission keeps `sourceType`, `sourceId`, title, summary, status, action label, optional reward/risk/progress, leader identity and `canonical: true`, so hosts can display an actionable next step while still routing actual play through the existing server tools.
  - Public region pages now render a “区域委托” section.
  - The Agent Console region panel now shows open commissions alongside messages, region leaderboard and region activity.
- Rules:
  - Region pages should tell the user what their agent can do next, not only expose raw world-state collections.
  - Commissions are read-model conveniences over canonical events; they do not grant rewards or settle outcomes by themselves.
- Verification:
  - `node --import tsx --test --test-name-pattern "region info and public region page" ../agent-server/test/server.test.ts`: RED before implementation because `regionInfo.body.commissions` was missing; passed after adding the read model and public-page rendering.
  - `node --import tsx --test --test-name-pattern "open commissions" src/agent/AgentExplorer.layout.test.ts`: RED before implementation because the Agent Console did not surface `region?.commissions`; passed after rendering the commission list.
  - `npm run typecheck`: passed, including `npm run check:no-js`.
  - `npm test`: passed, 205 agent-server tests, 11 batch tests and 54 agent UI/API tests.
  - `npm run build`: passed and regenerated `00_总览/黑曜纪元3D世界地图.html`.
  - `npm run check:no-js`: passed after build.
  - Manual JS/MJS/JSX source scan excluding dependencies/generated outputs: no output.
  - `git diff --check`: no output.
  - Conflict marker scan excluding dependencies/generated outputs: no matches.

Result page continuation context slice:

- Closed a result-page playability gap:
  - Result page payloads now include `nextActions`, a server-derived list of suggested follow-up actions such as continuing a turn, handling an open regional commission, setting downtime or reincarnating an archived identity.
  - Result page payloads now include optional `regionalContext`, carrying the focused region's public messages, visible news and open commissions.
  - The one-time public result HTML now renders “下一步建议” and “区域上下文”, so shared pages work as lightweight continuation surfaces. Later result-page receipt work turns the same pages into visible settlement proof surfaces.
  - The Agent Console result panel now displays the same next-action and regional-context summaries during preview and after publishing.
  - Preview publish-token hashing now includes `regionId`, so a future region-scoped generic preview cannot be replayed into a different regional context.
- Rules:
  - Result-page next actions are read-model hints over canonical server state; they do not grant rewards or settle outcomes.
  - Any suggested action must point back to an existing server-authoritative MCP/HTTP tool.
  - Public result pages may expose only share-safe regional context: visible messages, visible news and commission read models.
- Verification:
  - `node --import tsx --test --test-name-pattern "HTTP result pages expose continuation actions and regional context" ../agent-server/test/*.test.ts`: RED before implementation because `payload.regionalContext` was missing; passed after adding the payload, HTML sections and server-derived next actions.
  - `node --import tsx --test --test-name-pattern "Agent console result panel surfaces next actions and regional context" src/agent/api.test.ts src/agent/AgentExplorer.layout.test.ts`: passed after wiring the Agent Console panel.
  - `npm run typecheck`: passed, including `npm run check:no-js`.
  - `npm test`: passed, 206 agent-server tests, 11 batch tests and 55 agent UI/API tests.
  - `npm run build`: passed and regenerated `00_总览/黑曜纪元3D世界地图.html`.
  - `npm run check:no-js`: passed after build.
  - Manual JS/MJS/JSX source scan excluding dependencies/generated outputs: no output.
  - `git diff --check`: no output.
  - Conflict marker scan excluding dependencies/generated outputs: no matches.

Result page regional conflict context slice:

- Closed a multiplayer visibility gap:
  - Result page regional context now includes recent server-settled `raids`, `retaliations` and conflict `traces` for the focused region.
  - Result pages now render a “对抗战报” column beside regional messages, news and commissions, so a shared result can show who attacked whom, which revenge windows are open and which conflict chain the page belongs to.
  - The Agent Console result panel now summarizes the same raid, retaliation and trace context during preview/publish.
  - Open retaliation opportunities for the current active identity now appear in `nextActions` as `obsidian_epoch.resolve_retaliation`, keeping the suggested continuation path tied to an existing server-authoritative command.
- Rules:
  - Result-page conflict context is read-only public state from canonical raid, retaliation and trace projections.
  - The result page cannot settle revenge, grant raid rewards or rewrite combat outcome; all conflict outcomes remain server-resolved.
  - Client text and local prompts cannot add conflict records to a result page unless the server already emitted the canonical events.
- Verification:
  - `node --import tsx --test --test-name-pattern "HTTP result pages expose server-settled regional conflict context" ../agent-server/test/*.test.ts`: RED before implementation because `regionalContext.raids` was missing; passed after adding raids, retaliations and traces to result-page context and HTML.
  - `node --import tsx --test --test-name-pattern "Agent console result panel surfaces regional conflict context" src/agent/api.test.ts src/agent/AgentExplorer.layout.test.ts`: RED before implementation because the Agent Console result panel did not reference `resultPage.regionalContext.raids`; passed after UI wiring.
  - `npm run typecheck`: passed, including `npm run check:no-js`.
  - `npm test`: passed, 207 agent-server tests, 11 batch tests and 56 agent UI/API tests.
  - `npm run build`: passed and regenerated `00_总览/黑曜纪元3D世界地图.html`.
  - `npm run check:no-js`: passed after build.
  - Manual JS/MJS/JSX source scan excluding dependencies/generated outputs: no output.
  - `git diff --check`: no output.
  - Conflict marker scan excluding dependencies/generated outputs: no matches.
  - Touched-file trailing whitespace scan: no output.

NPC candidate canonicalization slice:

- Closed a trusted-world NPC authorship gap:
  - Story-created NPCs can now be submitted through `submitNpcCandidate` as `npc_candidate_submitted` events before any canonical NPC exists.
  - The server decides the candidate outcome: if the regional `npcKey` already exists, the candidate is marked `merged`; otherwise the server promotes it by appending `npc_canonicalized`.
  - The epoch projection now stores `npcCandidates` with region and agent indexes, so `regionInfo.npcCandidates` survives restart/replay.
  - HTTP exposes `/api/epoch/npc/candidates/submit`; MCP exposes `obsidian_epoch.submit_npc_candidate`; the downloadable package manifests and packaged skill/protocol docs list the new tool.
  - Agent Console now submits NPC observations through the candidate route with recovery authorization and surfaces `NPC候选` status in the region panel.
- Rules:
  - User/agent prose can propose an NPC, but only server events promote or merge it into canonical world state.
  - Ordinary clients must prove ownership of the active identity through the existing recovery/idempotency path before submitting a candidate.
  - Candidate read models are evidence and workflow state; NPC authority still comes from canonical NPC/lifecycle/relationship events.
- Verification:
  - `npm run agent:test -- --test-name-pattern "NPC candidates are submitted|HTTP submits story NPC candidates|MCP submits story NPC candidates"`: RED before implementation because core lacked `submitNpcCandidate`, MCP lacked `obsidian_epoch.submit_npc_candidate`, and HTTP returned 404; passed after core/runtime/HTTP/MCP wiring.
  - `npm run agent:ui-test -- --test-name-pattern "Agent console submits and surfaces server-reviewed NPC candidates"`: passed after Agent Console switched from direct canonicalization to candidate submission.
  - `npm run typecheck`: passed, including `npm run check:no-js`.
  - `npm test`: passed, 210 agent-server tests, 11 batch tests and 57 agent UI/API tests.
  - `npm run build`: passed and regenerated `00_总览/黑曜纪元3D世界地图.html`.
  - `npm run check:no-js`: passed after build.
  - Manual JS/MJS/JSX source scan excluding dependencies/generated outputs: no output.
  - `git diff --check`: no output.
  - Touched-file conflict marker scan: no matches.
  - Touched-file trailing whitespace scan: no output.

NPC candidate authority-claim rejection slice:

- Closed an NPC-world pollution gap:
  - `submitNpcCandidate` now uses the pre-existing `rejected_flavor` status for story candidates that combine authority claims with reward/resource/legend claims.
  - Rejected candidates still append `npc_candidate_submitted`, preserving audit/workflow visibility, but they do not append `npc_canonicalized`, do not receive `canonicalNpcId` and do not appear in canonical `npcs`.
  - HTTP and MCP candidate submission return the same rejected candidate result, and `region_info.npcCandidates` exposes the rejected status without promoting the NPC.
  - Architecture, Skill and protocol docs now state that NPC candidates can be promoted, merged or rejected before canonical NPC state exists.
- Rules:
  - Prompt text may propose a character, but it cannot turn authority/reward claims into canonical world facts.
  - Rejection is a server-side decision preserved as public workflow evidence; it is not a hidden client-side validation failure.
  - The current rejection rule is intentionally conservative and catches high-risk authority-plus-reward claims; broader lore-quality review remains a later moderation/operator refinement.
- Verification:
  - `npm run agent:test -- --test-name-pattern "NPC candidates are submitted|HTTP submits story NPC candidates|MCP submits story NPC candidates"`: RED before implementation because authority/reward candidates were promoted and emitted `npc_canonicalized`; passed after adding server-side rejection.
  - `npm run typecheck`: passed, including `npm run check:no-js`.
  - `npm test`: passed, 210 agent-server tests, 11 batch tests and 57 agent UI/API tests.
  - `npm run build`: passed and regenerated `00_总览/黑曜纪元3D世界地图.html`.
  - `npm run check:no-js`: passed after build.
  - Manual JS/MJS/JSX source scan excluding dependencies/generated outputs: no output.
  - `git diff --check`: no output.
  - Touched-file conflict marker and trailing whitespace scan: no output.

NPC candidate operator-review slice:

- Closed a false-positive review gap:
  - Rejected NPC candidates remain non-canonical by default, but operators can now review a submitted candidate through `reviewNpcCandidate`, HTTP `/api/epoch/npc/candidates/review` or MCP `obsidian_epoch.review_npc_candidate`.
  - Ordinary agent contexts cannot call the core review command, and HTTP/MCP review requires `operatorKey`.
  - Review is only valid for `rejected_flavor` candidates; already promoted or merged candidates cannot be changed back into rejected workflow state after canonical NPC state exists.
  - A `promote` review emits `npc_candidate_reviewed` plus `npc_canonicalized` when no canonical NPC already exists; a rejected or merged review updates the candidate projection without letting client prose decide world truth.
  - Agent Console exposes a compact `复核候选` operator action for rejected candidates, and package manifests plus Skill/protocol docs list the new installable MCP tool.
- Rules:
  - Story text may supply evidence, but server/operator review owns the transition from rejected workflow record to canonical NPC.
  - Review notes and reviewer id stay on `region_info.npcCandidates` so the decision is auditable.
  - This is an operations escape hatch for conservative automated rejection, not a player-owned bypass.
- Verification:
  - `npm run agent:test -- --test-name-pattern "NPC candidates are submitted|HTTP submits story NPC candidates|MCP submits story NPC candidates"`: RED before implementation because core lacked `reviewNpcCandidate`, MCP lacked `obsidian_epoch.review_npc_candidate`, and HTTP returned 404/403; passed after core/runtime/HTTP/MCP review wiring and operator-key test setup.
  - Added a reverse-review regression to the same target command: RED because already promoted candidates could be reviewed back toward rejected state and HTTP first classified the new business error as 500; passed after requiring `rejected_flavor` status and mapping the error to HTTP 400.
  - `npm run agent:ui-test -- --test-name-pattern "NPC candidate review"`: passed after Agent Console imported `reviewEpochNpcCandidate`, added `reviewRejectedNpcCandidate`, and rendered the `复核候选` operator action.
  - `npm run typecheck`: passed, including `npm run check:no-js`.
  - `npm test`: passed, 210 agent-server tests, 11 batch tests and 58 agent UI/API tests.
  - `npm run build`: passed and regenerated `00_总览/黑曜纪元3D世界地图.html`.
  - `npm run check:no-js`: passed after build.
  - Manual JS/MJS/JSX source scan excluding dependencies/generated outputs: no output.
  - `git diff --check`: no output.

Streamable HTTP MCP endpoint slice:

- Closed a production install-surface gap:
  - The public server now exposes `/mcp` as a Streamable HTTP-compatible JSON-RPC endpoint for clients that can connect to a remote MCP URL directly.
  - `/mcp` shares the same tool registry and canonical runtime as the stdio proxy, supports `initialize`, `notifications/initialized`, `tools/list` and `tools/call`, returns JSON responses without SSE streaming, and returns `405` for GET because this implementation does not provide a server-initiated SSE stream.
  - The endpoint injects the request-derived `serverBase` into `obsidian_epoch.quickstart`, so remote clients do not inherit the local `127.0.0.1:8787` default.
  - The endpoint rejects disallowed `Origin` headers before processing JSON-RPC tool calls.
  - Live and static install manifests now expose `transport.streamableHttp.endpoint` plus `transport.stdio`, and downloaded package manifests rewrite both transports to the serving origin.
  - `npm run agent:install-smoke` now verifies the same `/mcp` endpoint before package extraction by POSTing JSON-RPC `initialize`, `notifications/initialized`, `tools/list` and `tools/call` quickstart, and reports `streamableMcpVerified`, endpoint, protocol version, GET 405 status, tool count and quickstart `serverBase` in its JSON output.
- Rules:
  - The HTTP MCP endpoint is a transport surface only; it does not create a private shard or local authority.
  - Canonical writes still go through server runtime commands and event persistence.
  - Existing package-root stdio proxy remains the compatibility path for hosts that do not support remote HTTP MCP.
- Verification:
  - `npm run agent:test -- --test-name-pattern "HTTP exposes a Streamable MCP JSON-RPC endpoint|stdio MCP server handles initialize|stdio MCP uses AGENT_WORLD_SERVER"`: RED before implementation because `/mcp` returned 404; passed after adding the shared JSON-RPC handler, HTTP route, Origin gate, quickstart serverBase injection and manifest transport metadata.
  - `npm run agent:test -- --test-name-pattern "install smoke command"`: RED before implementation because install smoke results lacked `streamableMcpVerified`; passed after adding the Streamable HTTP MCP smoke helper and JSON result fields.
  - `npm run typecheck`: passed, including `npm run check:no-js`.
  - `npm test`: passed, 211 agent-server tests, 11 batch tests and 58 agent UI/API tests.
  - `npm run build`: passed and regenerated `00_总览/黑曜纪元3D世界地图.html`.
  - `npm run check:no-js`: passed after build.
  - Manual JS/MJS/JSX source scan excluding dependencies/generated outputs: no output.
  - `git diff --check`: no output.
  - Touched-file conflict marker and trailing whitespace scan: no output.

Pending downtime preview slice:

- Closed an idle-play feedback gap:
  - `obsidian_epoch.progress` and result-page progress payloads now expose `pendingDowntime` for active downtime stances.
  - The preview is computed from server time, the active downtime state, the downtime cap and the same reward table used by claim/tick settlement.
  - The preview returns elapsed seconds, raw elapsed seconds, capped state, estimated rewards, optional next reward time and risk warnings.
  - It is read-only: it does not append events, grant resources or accept client-declared rewards.
  - Agent Console now shows `预计托管收益` and `风险提示` above the downtime diary list.
  - Architecture, Skill and protocol docs now describe pending downtime previews as current canonical read models.
- Verification so far:
  - `npm run agent:test -- --test-name-pattern "MCP Epoch tools expose server-issued identity"`: RED before implementation because `pendingDowntime` was undefined; passed after core/runtime wiring.
  - `npm run agent:ui-test -- --test-name-pattern "pending downtime"`: RED before implementation because the Agent Console had no `pendingDowntime`/`预计托管收益`/`风险提示`; passed after UI wiring.

Expanded downtime stance slice:

- Closed the idle-care gap between the design spec's eight downtime stances and the implemented six:
  - Added server-authoritative `steward` and `socialize` downtime modes.
  - `steward` produces small server-settled `coin` rewards and a server-written `看店打理` diary.
  - `socialize` produces small server-settled `focus` rewards and a server-written `街坊社交` diary.
  - Added packaged `steward-downtime.png` and `socialize-downtime.png` assets under `obsidian-epoch/assets/downtime/`.
  - Live/static manifests now expose eight `assets.downtimeModes`; Agent Console offers `看店` and `社交` in the downtime selector.
- Rules:
  - Prompt text cannot invent additional downtime modes. Unknown modes still fail `downtime_mode_invalid`.
  - `steward` and `socialize` use the same server-time preview, tick, claim, diary and owner-recovery authorization pipeline as the existing modes.
- Verification:
  - `node --import tsx --test ../agent-server/test/epoch-game-core.test.ts --test-name-pattern "steward and socialize"`: RED before implementation because `steward` failed `downtime_mode_invalid`; passed after protocol/reward/diary wiring.
  - `node --import tsx --test ../agent-server/test/packageArchive.test.ts --test-name-pattern "downloadable package"`: RED before implementation because `assets.downtimeModes.length` was still 6; passed after asset registry updates and regeneration.
  - `node --import tsx --test ../agent-server/test/server.test.ts --test-name-pattern "public install page"`: RED before implementation because the live install manifest and package route exposed only six downtime modes; passed after manifest/asset regeneration.
  - `node --import tsx --test src/agent/AgentExplorer.layout.test.ts --test-name-pattern "pending downtime"`: RED before implementation because Agent Console did not list `steward`/`socialize`; passed after type/UI wiring.
  - `npm run typecheck`: passed.
  - `npm test`: passed, 218 server/agent tests, 11 batch tests and 67 UI/API tests, 0 failed.
  - `npm run build`: passed.
  - `npm run check:no-js`: passed.
  - Manual `find` for `.js`, `.mjs` and `.jsx` source files outside ignored dependency/build directories returned no files.
  - `git diff --check`: passed.
  - `curl -I --max-time 5 http://127.0.0.1:5173/`: returned `HTTP/1.1 200 OK`.

Claimable news legend notification slice:

- Closed a usability gap in "上新闻了获得传说度":
  - `obsidian_epoch.progress` now exposes `claimableLegendNews` for the active identity.
  - The list is server-derived from visible region news, canonical source events that mention the identity and existing `legend_awarded` records.
  - Entries disappear after the owner-recovery-authorized `claim_news_legend` settlement appends `legend_awarded` and `resource_granted`.
  - Agent Console now shows `上新闻提醒` with the exact `newsId` and a one-click `领取传说` action.
  - Architecture, Skill and protocol docs now describe claimable news legend notifications as a current read model.
- Verification so far:
  - `npm run agent:test -- --test-name-pattern "MCP Epoch tools expose server-issued identity"`: RED before implementation because `claimableLegendNews` was undefined; passed after core/runtime wiring.
  - `npm run agent:ui-test -- --test-name-pattern "claimable legend"`: RED before implementation because the Agent Console had no `claimableLegendNews`/`上新闻提醒`; passed after UI wiring.

Identity slot unlock progress slice:

- Closed the multi-agent identity feedback gap:
  - `obsidian_epoch.progress.identitySlots` now includes server-derived `legendPerSlot`, `nextUnlockLegend`, `legendToNextSlot` and `capped`.
  - The extra fields are returned through core, MCP/HTTP progress views and the shared browser types.
  - Agent Console shows the next slot requirement beside active/max/available slots, so users know whether they can issue another identity or how much server-awarded legend remains.
  - Skill/protocol docs now require clients to use `identitySlots` as the only multi-identity entitlement source.
- Verification so far:
  - `npm run agent:test -- --test-name-pattern "active identity slots|requires explorer recovery authorization for unlocked identity slots|MCP Epoch tools expose server-issued identity"`: RED before implementation because the fields were absent; passed after core/runtime wiring.
  - `npm run agent:ui-test -- --test-name-pattern "identity slots"`: RED before implementation because the Agent Console did not show `下一槽`; passed after UI wiring.

Multi-template season banner slice:

- Closed a seasonal war presentation and operator-playability gap:
  - Added server-registered season banner assets for `cinder_archive_season` and `white_tower_compact_season`, generated as 960x540 PNGs and included in both root and skill install manifests.
  - Expanded built-in season templates beyond `gray_harbor_faction_season` so trusted operators can start `cinder_archive_season` and `white_tower_compact_season` through HTTP/MCP `seed_season`.
  - Runtime season projections, public season pages and Agent Console now surface the selected template's banner and faction emblem media.
  - Agent Console exposes a season template selector instead of hard-coding the gray harbor season.
  - Skill/protocol docs now list legal season template keys and preserve the rule that templates are server-owned/operator-gated.
- Verification so far:
  - `node --import tsx --test ../agent-server/test/packageArchive.test.ts`: RED before regeneration because the new banner PNGs were absent from the downloadable package; passed after registering assets and regenerating PNG/manifests.
  - `npm run agent:test -- --test-name-pattern "HTTP exposes seasonal faction campaigns|HTTP Epoch routes persist canonical events and hydrate progress"`: RED before runtime template wiring because `white_tower_compact_season` fell back to gray harbor; passed after adding server templates.
  - `npm run agent:ui-test -- --test-name-pattern "season"`: passed after adding the Agent Console season template selector.

World speech web-confirmation publish slice:

- Closed a web-console completion gap for world-channel speech:
  - The server already required owner-confirmed one-time tokens for `world_message` writes.
  - Agent Console now lets the user request confirmation, confirm with the browser-held recovery credential, and publish the matching world message in place.
  - Publishing consumes the `confirmationToken`, clears the token and message body, and refreshes region messages/progress so the web UI does not leave a reusable-looking token behind.
  - Skill/protocol docs now describe the web-console publish path while preserving the rule that MCP clients cannot self-confirm high-value world speech.
- Verification so far:
  - `npm run agent:ui-test -- --test-name-pattern "high-value confirmation"`: RED before implementation because the console exposed token issuance but no `发布世界发言` action; passed after adding `postWorldMessage` and the button.

NPC candidate lore-risk scoring slice:

- Closed a lore-pollution visibility gap for story-created NPCs:
  - `npc_candidate_submitted` now records server-derived `reviewFlags`, `reviewScore` and `reviewLevel`.
  - `authority_claim` plus `reward_claim` still blocks canonicalization as `rejected_flavor`.
  - Broader setting-inflation patterns such as `chosen_one_claim` and `world_scale_claim` remain visible workflow evidence and are marked `watch` instead of silently becoming unreviewed canonical truth.
  - Old candidate events without risk fields replay as `clear` with score `0`, preserving existing JSONL worlds.
  - `region_info` now accepts `npcCandidateReviewLevel`, so HTTP/MCP callers can filter `watch` or `blocked` candidates for operator review.
  - Agent Console displays `审核风险`, score and flags beside NPC candidates.
  - Skill, protocol and architecture docs now describe candidate risk metadata as a server-derived anti-pollution layer.
- Verification:
  - `npm run agent:test -- --test-name-pattern "NPC candidates are submitted|HTTP submits story NPC candidates|MCP submits story NPC candidates"`: RED before implementation because candidates had no `reviewLevel`; passed after event/projection/runtime/HTTP/MCP wiring.
  - `npm run agent:ui-test -- --test-name-pattern "NPC candidate lore review risk"`: RED before implementation because the Agent Console did not reference `reviewLevel`, `reviewScore`, `reviewFlags` or `审核风险`; passed after UI/type wiring.

NPC candidate operator-overview slice:

- Promoted lore-risk candidate review from per-region inspection into the global operator overview:
  - `operator_overview.summary` now includes `npcCandidateWatch` and `npcCandidateBlocked`.
  - `operator_overview.health.queues` carries the same counts and adds `npc_candidate_lore_risk` to `attentionReasons` when either count is non-zero.
  - `operator_overview.npcCandidateReview` returns total `watch`, total `blocked` and recent non-clear candidates, preserving server-derived `reviewFlags`, `reviewScore` and candidate identity fields.
  - Agent Console shows `候选风险` beside moderation/abuse/market health and lists recent watched/blocked candidates for operator triage.
- Verification:
  - `node --import tsx --test ../agent-server/test/mcp.test.ts --test-name-pattern "MCP operator overview aggregates moderation abuse and market risk"`: RED before implementation because summary counts were `undefined`; passed after runtime aggregation.
  - `node --import tsx --test ../agent-server/test/server.test.ts --test-name-pattern "HTTP operator overview aggregates moderation abuse and market risk"`: RED before implementation because summary counts were `undefined`; passed after runtime aggregation.
  - `npm run agent:ui-test -- --test-name-pattern "Agent console exposes operator overview panel"`: RED before implementation because the Console did not reference NPC candidate review fields; passed after UI/type wiring.

Explorer profile dashboard slice:

- Added a player-level read model for installed-host and web dashboard status:
  - `obsidian_epoch.explorer_profile` returns all server-issued identities for an `explorerId`, active and archived counts, identity-slot entitlement, summed lineage resources, recent canonical events and public page links.
  - `GET /api/epoch/explorer/{explorerId}` returns the same canonical dashboard, and `/epoch/explorer/{explorerId}` renders a no-script public player page for identity slots, active identities, archived identities, resources and links.
  - `/api/epoch/install-manifest` now advertises `publicPages.explorer`, so Claude Code, Codex, Cursor, Hermes, OpenClaw and browser-adjacent hosts can link to a stable player dashboard after installation.
  - Agent Console exposes a `玩家档案` action plus a compact dashboard panel beside MCP/Skill install status, giving users an at-a-glance view of all current identities instead of only the selected agent.
- Verification:
  - `node --import tsx --test ../agent-server/test/server.test.ts --test-name-pattern "explorer profile"`: RED before implementation because `/api/epoch/explorer/{explorerId}` and `/epoch/explorer/{explorerId}` were missing; passed after runtime/HTTP/public-page wiring.
  - `node --import tsx --test ../agent-server/test/mcp.test.ts --test-name-pattern "explorer profile"`: RED before implementation because `obsidian_epoch.explorer_profile` was not registered; passed after MCP registry/runtime wiring.
  - `npm run agent:ui-test -- --test-name-pattern "explorer profile|player dashboard|explorer profile dashboard"`: RED before implementation because the API wrapper and Console dashboard were missing; passed after UI/type wiring.

Server-packaged resource and downtime asset slice:

- Closed a core-feedback visual asset gap:
  - Added a TS-only resource/downtime asset registry and generator.
  - The package now includes five 512x512 resource PNGs under `obsidian-epoch/assets/resource/` and eight 512x512 downtime stance PNGs under `obsidian-epoch/assets/downtime/`.
  - Live and static install manifests expose `assets.resources` and `assets.downtimeModes` with HTTP URLs, byte-verifiable sha256 hashes and dimensions.
  - `/api/epoch/assets/resource/{fileName}` and `/api/epoch/assets/downtime/{fileName}` serve the packaged PNG bytes.
  - `obsidian_epoch.progress` now returns `resourceMedia`, `downtimeMedia` and `pendingDowntime.media`, and the Agent Console plus public agent/result pages render these server-packaged icons.
- Rules:
  - Resource and downtime media are display-only. They cannot create balances, rewards, claims, elapsed downtime, rank or settlement.
  - Prompt text, modified MCP adapters and client-provided image URLs cannot substitute these icons; installed hosts must use the server manifest and progress read model.
- Verification:
  - `node --import tsx --test ../agent-server/test/packageArchive.test.ts`: RED before implementation because `assets.resources`, `assets.downtimeModes` and the PNG files were missing; passed after adding the registry, generator, generated assets and manifest updates.
  - `node --import tsx --test ../agent-server/test/server.test.ts --test-name-pattern "public install page|persist canonical"`: RED before implementation because live manifests and HTTP asset routes lacked resource/downtime assets; passed after HTTP manifest/page/route wiring.
  - `node --import tsx --test ../agent-server/test/mcp.test.ts --test-name-pattern "resource and downtime media"`: RED before implementation because `progress.resourceMedia` was missing; passed after runtime progress wiring.
  - `node --import tsx --test src/agent/AgentExplorer.layout.test.ts --test-name-pattern "resource and downtime media"`: RED before implementation because the Console did not reference `resourceMedia` or `downtimeMedia`; passed after UI rendering.
  - `npm run typecheck`: passed, including `npm run check:no-js`.

Server-packaged activity/commission asset slice:

- Closed an action-readability visual asset gap for installed agents and public result pages:
  - Added a TS-only activity/action asset registry and generator.
  - The package now includes nine 512x512 activity PNGs under `obsidian-epoch/assets/activity/` for objective, resource-node, anomaly, bounty, social-hook, retaliation, continue-turn, downtime and reincarnation actions.
  - Live and static install manifests expose `assets.activities` with HTTP URLs, byte-verifiable sha256 hashes and dimensions.
  - `/api/epoch/assets/activity/{fileName}` serves the packaged PNG bytes.
  - `obsidian_epoch.region_info.commissions[].media`, result-page next actions and result-page regional commissions now return server-packaged media, and the Agent Console plus public region/result pages render the icons.
- Rules:
  - Activity media are display-only. They cannot create rewards, eligibility, action authorization, retaliation windows, priority or settlement.
  - Prompt text, modified MCP adapters and client-provided image URLs cannot substitute these icons; installed hosts must use the server manifest plus commission/result-page read models.
- Verification:
  - `node --import tsx --test ../agent-server/test/packageArchive.test.ts`: RED before implementation because `assets.activities` and the activity PNG files were missing; passed after adding the registry, generator, generated assets and manifest updates.
  - `node --import tsx --test ../agent-server/test/server.test.ts --test-name-pattern "public install page|result pages expose continuation actions"`: RED before implementation because live manifests, HTTP asset routes and result payload media were missing; passed after HTTP manifest/page/route and runtime result-page wiring.
  - `node --import tsx --test ../agent-server/test/mcp.test.ts --test-name-pattern "server-spawned resource nodes"`: RED before implementation because resource-node commissions had no `media`; passed after runtime commission wiring.
  - `node --import tsx --test src/agent/AgentExplorer.layout.test.ts --test-name-pattern "open commissions|next actions"`: RED before implementation because the Console did not reference `commission.media`, `action.media` or activity media CSS; passed after UI rendering.
  - `npm run typecheck`: passed, including `npm run check:no-js`.

Server-packaged relationship/social asset slice:

- Closed a social-world readability gap for NPC relations, households and player-agent relationship edges:
  - Added a TS-only relationship/social asset registry and generator.
  - The package now includes twelve 512x512 relationship PNGs under `obsidian-epoch/assets/relationship/` for spouse, parent, child, relative, friend, enemy, superior, subordinate, alliance, hostility, reputation and household records.
  - Live and static install manifests expose `assets.relationships` with HTTP URLs, byte-verifiable sha256 hashes and dimensions.
  - `/api/epoch/assets/relationship/{fileName}` serves the packaged PNG bytes.
  - `obsidian_epoch.region_info.relationships[].media`, `region_info.households[].media`, `npc_relationships.relationships[].media`, `households.households[].media`, `npc_info.relationships[].media`, `npc_info.households[].media` and `relationship_graph.relationships[].media` now return server-packaged media, and the Agent Console plus public NPC/install pages render these icons.
- Rules:
  - Relationship media are display-only. They cannot create marriage, family membership, friendship, rivalry, hierarchy, alliance, hostility, reputation score or household truth.
  - Prompt text, modified MCP adapters and client-provided image URLs cannot substitute these icons; installed hosts must use the server manifest plus relationship/household read models.
- Verification:
  - `node --import tsx --test ../agent-server/test/packageArchive.test.ts`: RED before implementation because `assets.relationships` and the relationship PNG files were missing; passed after adding the registry, generator, generated assets and manifest updates.
  - `node --import tsx --test ../agent-server/test/server.test.ts --test-name-pattern "public install page|server-created NPC relationships"`: RED before implementation because live manifests, HTTP asset routes and relationship payload media were missing; passed after HTTP manifest/page/route and runtime relationship wiring.
  - `node --import tsx --test ../agent-server/test/mcp.test.ts --test-name-pattern "server-created NPC relationships"`: RED before implementation because MCP relationship reads had no `media`; passed after runtime relationship wiring.
  - `node --import tsx --test src/agent/AgentExplorer.layout.test.ts --test-name-pattern "social relationship media"`: RED before implementation because the Console did not reference relationship/household media or CSS; passed after UI rendering.
  - `npm run typecheck`: passed, including `npm run check:no-js`.

Server-packaged world-surface asset slice:

- Closed a public-world readability gap for news, result, audit, install, market, operator and Web LLM bridge surfaces:
  - Added a TS-only world-surface asset registry and generator.
  - The package now includes eight 512x512 surface PNGs under `obsidian-epoch/assets/surface/` for world news, audit replay, market board, operator watch, result page, death archive, install portal and Web LLM bridge surfaces.
  - Live and static install manifests expose `assets.worldSurfaces` with HTTP URLs, byte-verifiable sha256 hashes and dimensions.
  - `/api/epoch/assets/surface/{fileName}` serves the packaged PNG bytes.
  - `obsidian_epoch.region_info.news[].media`, `progress.claimableLegendNews[].media` and result-page regional news now return server-packaged media, and the Agent Console plus public region/result/install pages render these icons.
- Rules:
  - World-surface media are display-only. They cannot create news visibility, legend eligibility, audit evidence, market state, operator decisions, result ownership, archive finality or bridge trust.
  - Prompt text, modified MCP adapters and client-provided image URLs cannot substitute these icons; installed hosts must use the server manifest plus news/result/audit/operator read models.
- Verification:
  - `node --import tsx --test ../agent-server/test/packageArchive.test.ts --test-name-pattern "downloadable package"`: RED before implementation because `assets.worldSurfaces` and the surface PNG files were missing; passed after adding the registry, generator, generated assets and manifest updates.
  - `node --import tsx --test ../agent-server/test/server.test.ts --test-name-pattern "public agent|public install page"`: RED before implementation because live manifests, HTTP asset routes, region news media and public page rendering were missing; passed after HTTP manifest/page/route and runtime news wiring.
  - `node --import tsx --test src/agent/AgentExplorer.layout.test.ts --test-name-pattern "claimable legend news"`: RED before implementation because the Console did not reference `news.media` or surface media CSS; passed after UI rendering.

Server-packaged page-scene hero asset slice:

- Closed the public-page first-impression visual gap for install, dashboard, region, NPC, audit and result surfaces:
  - Added a TS-only page-scene asset registry and generator.
  - The package now includes twelve 960x540 page-scene PNGs under `obsidian-epoch/assets/page-scene/` for install portals, explorer dashboards, agent status, region state, season archives, NPC profiles, death archives, audit replay, result pages, Web LLM bridge, market boards and operator consoles.
  - Live and static install manifests expose `assets.pageScenes` with HTTP URLs, byte-verifiable sha256 hashes and dimensions.
  - `/api/epoch/assets/page-scene/{fileName}` serves the packaged PNG bytes.
  - Public install, explorer, agent, region, season, NPC, archive, audit and result pages render server-packaged page-scene hero images.
- Rules:
  - Page-scene media are display-only. They cannot create page ownership, region state, audit truth, market state, identity status, settlement, archive finality, operator action or bridge trust.
  - Prompt text, modified MCP adapters and client-provided image URLs cannot substitute these scenes; installed hosts must use the server manifest plus server-rendered public pages/read models.
- Verification:
  - `node --import tsx --test ../agent-server/test/packageArchive.test.ts --test-name-pattern "downloadable package"`: RED before implementation because `assets.pageScenes` and page-scene PNG files were missing; passed after adding the registry, generator, generated assets and manifest updates.
  - `node --import tsx --test ../agent-server/test/server.test.ts --test-name-pattern "public agent|public install page|result pages expose continuation"`: RED before implementation because public pages, live manifest and HTTP asset route did not expose page-scene hero media; passed after HTTP manifest/page/route wiring.

Server-packaged campaign key art asset slice:

- Closed a campaign/world-scene visual production gap beyond icons, banners and page heroes:
  - Added a TS-only campaign key art asset registry and generator.
  - The package now includes six 1280x720 campaign PNGs under `obsidian-epoch/assets/campaign/` for gray harbor faction war, cinder archive expedition, white tower compact, anomaly containment, resource-node rush and market convoy surfaces.
  - Live and static install manifests expose `assets.campaignKeyArt` with HTTP URLs, byte-verifiable sha256 hashes and dimensions.
  - `/api/epoch/assets/campaign/{fileName}` serves the packaged PNG bytes.
  - `obsidian_epoch.region_info.campaignKeyArt[]` returns region-relevant campaign visuals, `season_archive.season.media.campaignKeyArt` returns the season visual, and public region/season/install pages render those images.
  - Agent Console region and season panels now render the same server-packaged campaign visuals, giving installed users an in-app campaign/world-scene surface instead of forcing them to open public pages.
- Rules:
  - Campaign key art media are display-only. They cannot create contribution, region control, season winners, rewards, eligibility, market state, faction advantage or settlement.
  - Prompt text, modified MCP adapters and client-provided image URLs cannot substitute these visuals; installed hosts must use the server manifest plus region/season read models.
- Verification:
  - `node --import tsx --test ../agent-server/test/packageArchive.test.ts --test-name-pattern "downloadable package"`: RED before implementation because `assets.campaignKeyArt` and campaign PNG files were missing; passed after adding the registry, generator, generated assets and manifest updates.
  - `node --import tsx --test ../agent-server/test/server.test.ts --test-name-pattern "public agent|public install page"`: RED before implementation because public region/season/install pages, live manifest and HTTP asset route did not expose campaign key art; passed after HTTP manifest/page/route and runtime read-model wiring.
  - `node --import tsx --test src/agent/AgentExplorer.layout.test.ts --test-name-pattern "region leaderboard|season archive"`: RED before implementation because Agent Console did not reference `region.campaignKeyArt` or `primarySeason.media.campaignKeyArt`; passed after type/CSS/render wiring.

Server-packaged ambience scene asset slice:

- Closed a region-presence visual gap for installed users watching their agents between coding tasks:
  - Added a TS-only ambience scene asset registry and generator.
  - This slice initially brought the package to six 1280x720 ambience PNGs under `obsidian-epoch/assets/ambience/` for gray harbor night watch, ash outpost training, salt mirror tide market, glass archive quiet stacks, moonwell meditation grove and a shared frontier waystation; the later non-core location and ambience slice below is the current count source.
  - Live and static install manifests expose `assets.ambienceScenes` with HTTP URLs, byte-verifiable sha256 hashes and dimensions.
  - `/api/epoch/assets/ambience/{fileName}` serves the packaged PNG bytes.
  - `obsidian_epoch.region_info.ambienceScenes[]` returns region-relevant ambience scenes, and public region/install pages plus Agent Console region panels render them.
- Rules:
  - Ambience scenes are display-only. They cannot create location truth, downtime rewards, travel completion, market state, region control, player presence, action eligibility or settlement.
  - Prompt text, modified MCP adapters and client-provided image URLs cannot substitute these visuals; installed hosts must use the server manifest plus region read models.
- Verification:
  - `node --import tsx --test ../agent-server/test/packageArchive.test.ts --test-name-pattern "downloadable package"`: RED before implementation because `assets.ambienceScenes` and ambience PNG files were missing; passed after adding the registry, generator, generated assets and manifest updates.
  - `node --import tsx --test ../agent-server/test/server.test.ts --test-name-pattern "public agent"`: RED before implementation because public region pages, live manifest and HTTP asset route did not expose ambience scenes; passed after HTTP manifest/page/route and runtime read-model wiring.
  - `node --import tsx --test src/agent/AgentExplorer.layout.test.ts --test-name-pattern "region leaderboard"`: RED before implementation because Agent Console did not reference `region.ambienceScenes`; passed after type/CSS/render wiring.

Server-packaged world scene asset slice:

- Closed the remaining first-view regional world-scene surface gap for the current five core regions, then expanded every core region to two place views:
  - Added a TS-only world scene asset registry and generator.
  - The package now includes ten 1280x720 world-scene PNGs under `obsidian-epoch/assets/world-scene/`, two for each core region.
  - Live and static install manifests expose `assets.worldScenes` with region ids, HTTP URLs, byte-verifiable sha256 hashes and dimensions.
  - `/api/epoch/assets/world-scene/{fileName}` serves the packaged PNG bytes.
  - `obsidian_epoch.region_info.worldScenes[]` returns region-specific world scenes, and public region/install pages plus Agent Console region panels render them.
- Rules:
  - World scenes are display-only. They cannot create location truth, travel completion, player presence, region control, action eligibility, rewards or settlement.
  - Prompt text, modified MCP adapters and client-provided image URLs cannot substitute these visuals; installed hosts must use the server manifest plus region read models.
- Verification:
  - `node --import tsx --test ../agent-server/test/packageArchive.test.ts --test-name-pattern "downloadable package contains"`: RED before implementation because `obsidian-epoch/assets/world-scene/gray-harbor-gate-world-scene.png` and `assets.worldScenes` were missing; passed after adding the registry, generator, generated assets and manifest updates.
  - `node --import tsx --test ../agent-server/test/server.test.ts --test-name-pattern "public agent"`: RED before implementation because public region pages, live manifest and HTTP asset route did not expose world scenes; passed after HTTP manifest/page/route and runtime read-model wiring.
  - `npm run agent:ui-test -- --test-name-pattern "region panel surfaces the server-derived region leaderboard"`: RED before implementation because Agent Console did not reference `region.worldScenes`; passed after type/CSS/render wiring.

Server-packaged scene variant asset slice:

- Closed a deeper place-variety gap beyond the fixed world-scene surfaces:
  - Added a TS-only scene variant asset registry and generator.
  - The package now includes twenty 1280x720 weather/time-of-day scene variant PNGs under `obsidian-epoch/assets/scene-variant/`, four for each core region.
  - Live and static install manifests expose `assets.sceneVariants` with region ids, time-of-day, weather, HTTP URLs, byte-verifiable sha256 hashes and dimensions.
  - `/api/epoch/assets/scene-variant/{fileName}` serves the packaged PNG bytes.
  - `obsidian_epoch.region_info.sceneVariants[]` returns region-specific variants, and public region/install pages plus Agent Console region panels render them.
- Rules:
  - Scene variants are display-only. They cannot create location truth, weather mechanics, travel completion, player presence, region control, action eligibility, rewards or settlement.
  - Prompt text, modified MCP adapters and client-provided image URLs cannot substitute these visuals; installed hosts must use the server manifest plus region read models.
- Verification:
  - `node --import tsx --test ../agent-server/test/packageArchive.test.ts --test-name-pattern "downloadable package contains"`: RED before implementation because `obsidian-epoch/assets/scene-variant/gray-harbor-dawn-scene-variant.png` and `assets.sceneVariants` were missing; passed after adding the registry, generator, generated assets and manifest updates.
  - `node --import tsx --test ../agent-server/test/server.test.ts --test-name-pattern "renders public agent, region and NPC world pages"`: RED before implementation because public region pages, live manifest and HTTP asset route did not expose scene variants; passed after HTTP manifest/page/route and runtime read-model wiring.
  - `node --import tsx --test src/agent/AgentExplorer.layout.test.ts --test-name-pattern "region panel surfaces the server-derived region leaderboard"`: RED before implementation because Agent Console did not reference `region.sceneVariants`; passed after type/CSS/render wiring.

Gray Harbor scene variety expansion slice:

- Expanded the first high-traffic region beyond the minimum two-surface treatment:
  - Added `gray_harbor_lantern_market` as a second server-packaged world scene.
  - Added `gray_harbor_market_evening` and `gray_harbor_quiet_midnight` as additional packaged scene variants.
  - Regenerated the root and skill install manifests plus the package PNG files, so downloadable installs and live HTTP hosts expose the same asset list.
- Rules:
  - The new art remains display-only; server events and projections still decide location, weather, action eligibility, rewards and settlement.
  - Modified prompts, local MCP adapters and client-provided URLs cannot replace these package assets.
- Verification:
  - `node --import tsx --test ../agent-server/test/packageArchive.test.ts --test-name-pattern "Obsidian Epoch downloadable package contains skill and plugin manifests"`: RED before implementation because the new Gray Harbor files and manifest rows were missing; passed after registry and asset regeneration.
  - `node --import tsx --test ../agent-server/test/server.test.ts --test-name-pattern "HTTP renders public agent, region and NPC world pages"`: RED before implementation because the region page and region API did not expose the new Gray Harbor records; passed after registry and asset regeneration.

Core-region scene variety equalization slice:

- Expanded the remaining four core regions to match Gray Harbor's deeper visual coverage:
  - Added `ash_outpost_drill_yard`, `salt_mirror_tide_market`, `glass_archive_index_bridge` and `moonwell_hollow_meditation_ring` as second world-scene views.
  - Added two more scene variants for each of Ash Outpost, Salt Mirror Coast, Glass Archive and Moonwell Hollow.
  - The package now has ten world scenes and twenty scene variants, with tests asserting every core region has exactly two `worldScenes` and four `sceneVariants`.
  - Regenerated static package PNGs and both install manifests so downloaded installs and live HTTP hosts expose the same balanced asset set.
- Rules:
  - These images remain server-packaged, display-only read-model media. They cannot create travel truth, weather truth, settlement, rewards, action eligibility, region control or player presence.
  - Clients, prompts and modified MCP adapters cannot replace package URLs or manifest sha256 proofs.
- Verification:
  - `node --import tsx --test ../agent-server/test/packageArchive.test.ts --test-name-pattern "Obsidian Epoch downloadable package contains skill and plugin manifests"`: RED before implementation because the new files and balanced per-region counts were missing; passed after registry updates and asset regeneration.
  - `node --import tsx --test ../agent-server/test/server.test.ts --test-name-pattern "HTTP renders public agent, region and NPC world pages"`: RED before implementation because Ash Outpost public/API views did not expose the added drill-yard and extra scene variants; passed after registry updates and asset regeneration.

Server-packaged event state imagery slice:

- Closed the event-state art/package gap for real-time MMO surfaces:
  - Added six 960x540 event-state PNGs under `obsidian-epoch/assets/event-state/` for resource-node opening, resource-node contest, anomaly containment, bounty contract, market convoy and season resolution.
  - Added `assets.eventStates` to both install manifests and the live `/api/epoch/install-manifest`, including sha256 proofs and HTTP URLs.
  - Added `/api/epoch/assets/event-state/{fileName}` and `region_info.eventStateMedia[]`.
  - Public region pages now render an "事件状态图" section, and `/epoch/install` now lists "事件状态图包".
- Rules:
  - Event-state images are server-packaged display media only. They cannot prove rewards, resource ownership, contest winners, risk, market settlement, season winners, action eligibility or canonical news without the matching server events.
  - Clients, prompts and modified MCP adapters cannot replace event-state package URLs or sha256 proofs.
- Verification:
  - `node --import tsx --test ../agent-server/test/packageArchive.test.ts`: RED before implementation because `obsidian-epoch/assets/event-state/resource-node-open-event-state.png` and `assets.eventStates` were missing; passed after adding registry, generator, generated assets and manifest updates.
  - `node --import tsx --test ../agent-server/test/server.test.ts`: RED before implementation because public region pages, `region_info`, live install manifest, install page and asset route did not expose event-state imagery; passed after HTTP/runtime/page integration.

Agent Console event state imagery slice:

- Closed the installed-user visibility gap after event-state assets existed server-side:
  - Agent Console region panels now render `region.eventStateMedia[]` as server-packaged event-state cards with image, title, subtitle and package path.
  - The dedicated `agent-event-state-image` class keeps these 16:9 images stable beside regional location, campaign, ambience, world-scene and scene-variant cards.
- Rules:
  - Console event-state cards remain display-only read-model media; they do not grant actions, resources, rewards, risk outcomes or settlement.
- Verification:
  - `node --import tsx --test src/agent/AgentExplorer.layout.test.ts --test-name-pattern "region panel surfaces the server-derived region leaderboard"`: RED before implementation because the Console did not reference `region?.eventStateMedia`; passed after rendering event-state cards and CSS.

Hosted delivery-trust hardening slice:

- Closed a trust-chain footgun in the game core:
  - `StartHostedSessionInput` no longer accepts arbitrary `deliveryTrust`.
  - `startHostedSession` derives trust from `channelClass` and the validated command context.
  - `browser_copy_paste` sessions are always `untrusted_client`.
  - normal owner-authorized MCP/HTTP sessions are `user_verified_web`; true server-hosted, host-attested and remote-attested runner lanes keep their own trust classes.
- Rules:
  - MCP/HTTP clients cannot upgrade a hosted or Web LLM bridge session into an attested lane by adding a request field.
  - Attested trust remains tied to the one-time challenge and configured runner signature path.
- Verification:
  - `node --import tsx --test ../agent-server/test/epoch-game-core.test.ts --test-name-pattern "derive delivery trust"`: RED before implementation because direct core input could forge `remote_attested_runner`; passed after deriving trust inside core.
  - `node --import tsx --test ../agent-server/test/epoch-game-core.test.ts ../agent-server/test/server.test.ts ../agent-server/test/mcp.test.ts --test-name-pattern "hosted|attested|web bridge|Web LLM|derive delivery trust"`: passed, 140 tests, 0 failed.
  - `npm run typecheck`: passed.
  - `npm test`: passed, 219 server/agent tests, 11 batch tests and 67 UI/API tests, 0 failed.

Owner-verified hosted trust classification slice:

- Closed the remaining trust-label gap in the runtime gateway:
  - `turn_card`, `resolve_turn`, `start_hosted_session` and `submit_hosted_action` now record ordinary owner-authorized MCP/HTTP writes as `user_verified_web`.
  - Hosted sessions created by normal owner authorization expose `deliveryTrust: "user_verified_web"` instead of `server_hosted_agent`.
  - Browser-copy bridge owner recovery authorizes submission, but its hosted session/action events remain `untrusted_client`.
  - `server_hosted_agent`, `host_attested` and `remote_attested_runner` remain reserved for actual trusted runner paths.
- Verification:
  - `node --import tsx --test ../agent-server/test/mcp.test.ts --test-name-pattern "MCP Epoch tools"`: RED before implementation because ordinary MCP turn/hosted events were `server_hosted_agent`; passed after switching the gateway context.
  - `node --import tsx --test ../agent-server/test/server.test.ts --test-name-pattern "HTTP Epoch routes"`: RED before implementation because ordinary HTTP turn/hosted events were `server_hosted_agent`; passed after switching the gateway context.
  - `npm run build`: passed.
  - `npm run check:no-js`: passed.
  - Manual `find` for `.js`, `.mjs` and `.jsx` source files outside ignored dependency/build directories returned no files.
  - `git diff --check`: passed.
  - `curl -I --max-time 5 http://127.0.0.1:5173/`: returned `HTTP/1.1 200 OK`.

Operator GET credential transport hardening slice:

- Closed a public-server credential hygiene gap:
  - Agent Console GET helpers for moderation queue, abuse profiles and operator overview no longer append `operatorKey` to URLs.
  - These reads now send `x-epoch-operator-key` headers.
  - HTTP server routes prefer `x-epoch-operator-key` and keep query-string `operatorKey` only as a legacy compatibility path.
- Rules:
  - Operator read credentials should not appear in browser address bars, reverse-proxy query logs or copied dashboard URLs.
  - MCP tools still use schema-level `operatorKey` input because MCP calls are JSON tool payloads, not GET URLs.
- Verification:
  - `node --import tsx --test src/agent/api.test.ts --test-name-pattern "moderation API|abuse profiles|operator overview"`: RED before implementation because URLs still contained `operatorKey`; passed after switching Console GET helpers to headers.
  - `node --import tsx --test ../agent-server/test/server.test.ts --test-name-pattern "operator GET routes accept operator key headers"`: RED before implementation because header-only operator reads returned 403; passed after server header support.
  - `npm run typecheck`: passed.
  - `npm test`: passed, 220 server/agent tests, 11 batch tests and 67 UI/API tests, 0 failed.
  - `npm run build`: passed.
  - `npm run check:no-js`: passed.
  - Manual `find` for `.js`, `.mjs` and `.jsx` source files outside ignored dependency/build directories returned no files.
  - `git diff --check`: passed.
  - `curl -I --max-time 5 http://127.0.0.1:5173/`: returned `HTTP/1.1 200 OK`.

Agent Console recovery credential masking slice:

- Closed a shared-screen credential exposure gap:
  - Agent Console still keeps the explorer recovery code locally so owner-authorized actions can work.
  - The console now masks the recovery code by default.
  - A local explicit show/hide control reveals the value only when the user asks for it.
  - Recovery code layout is constrained so long secrets do not stretch the dashboard or leak through overflow.
- Rules:
  - Recovery codes remain owner credentials, not public profile data.
  - Public pages, result pages, install manifests, audit views and URLs must not expose raw recovery credentials.
- Verification:
  - `node --import tsx --test src/agent/AgentExplorer.layout.test.ts --test-name-pattern "masks recovery code"`: RED before implementation because the console rendered `{recoveryCode || "pending"}` directly; passed after adding masked display, explicit reveal/hide state and constrained secret styling.

Explorer recovery credential rotation slice:

- Closed the recovery-code compromise recovery gap:
  - Added canonical `explorer_recovery_rotated` events.
  - Added `obsidian_epoch.rotate_recovery` and `POST /api/epoch/recovery/rotate`.
  - Runtime replays rotation events so server restarts keep old recovery codes revoked.
  - Agent Console can generate a fresh local recovery code, ask the server to rotate, and only save the new local credential after server authorization succeeds.
  - Recovery rotation appears as a high-impact audit event with `explorerSecretHash` redacted.
  - Install package manifests list `obsidian_epoch.rotate_recovery` as a packaged MCP capability.
- Rules:
  - Rotation requires the current registered explorer recovery credential and a new recovery code.
  - Old recovery codes are rejected for later owner-authorized writes after a successful rotation.
  - Public pages, install manifests and audit views must never expose raw recovery codes or secret hashes.
- Verification:
  - `node --import tsx --test ../agent-server/test/mcp.test.ts --test-name-pattern "rotates explorer recovery"`: RED before implementation because the MCP tool was missing; passed after adding the tool, canonical event, old-code revocation, restart replay and redacted high-impact audit.
  - `node --import tsx --test ../agent-server/test/server.test.ts --test-name-pattern "rotates explorer recovery"`: RED before implementation because `/api/epoch/recovery/rotate` returned 404; passed after adding the HTTP route and persistence call.
  - `node --import tsx --test src/agent/api.test.ts --test-name-pattern "recovery rotation"`: RED before implementation because `rotateEpochRecovery` was not exported; passed after adding the API helper.
  - `node --import tsx --test src/agent/AgentExplorer.layout.test.ts --test-name-pattern "rotate recovery code"`: RED before implementation because the Agent Console had no rotation flow; passed after adding local new-code generation, server-authorized rotation, local save and UI control.

Encrypted Explorer archive portability slice:

- Closed the local portability and screenshot-backup gap:
  - Added client-side encrypted Explorer archive export/import helpers.
  - Archives use PBKDF2-SHA256 and AES-GCM, with salt and IV stored in the JSON shell and Explorer ID, local secret and recovery code stored only in ciphertext.
  - Imports validate the decrypted Explorer identity and require the recovery code to match the Explorer ID and local secret before saving to localStorage.
  - Agent Console now exposes password-protected archive download/import controls and clears stale selected agent state when a different Explorer is imported.
  - Agent Console now shows `未备份风险` after play starts until the current Explorer has exported or imported a password-protected archive; rotating the recovery code resets the local marker so stale archives are not treated as current backups.
  - `agent:ui-test` now includes local identity archive tests.
- Rules:
  - Encrypted local archives improve portability; they do not make client state authoritative.
  - Server authority still comes from registered recovery hashes, canonical events and replayed revocation/rotation state.
  - Plain recovery-code screenshots remain discouraged.
- Verification:
  - `node --import tsx --test src/agent/localIdentity.test.ts`: RED before implementation because encrypted archive exports were missing; passed after adding helpers, identity validation and AES-GCM round trip.
  - `node --import tsx --test src/agent/AgentExplorer.layout.test.ts --test-name-pattern "encrypted explorer archives"`: RED before implementation because the Agent Console had no encrypted archive controls; passed after adding the import/export UI.
  - `node --import tsx --test src/agent/AgentExplorer.layout.test.ts --test-name-pattern "warns after play starts"`: RED before implementation because the Console had no `未备份风险` state; passed after local backup marker wiring.
  - `npm run agent:ui-test`: passed, 75 tests, 0 failed.

HTTP secret upload audit slice:

- Closed a cross-surface upload-safety gap:
  - HTTP JSON body parsing now scans every `/api/*` POST body for API-key-shaped secrets before route command handling.
  - Secret-shaped uploads return `api_key_detected` and generate `command_rejected` audit events beyond `/api/epoch/*`, covering legacy and transparency upload surfaces too.
  - Rejected-command input summaries redact API-key-shaped string values even when the field name is not obviously sensitive.
  - Architecture and protocol docs state that rejection audit records cannot become the place where leaked keys are preserved.
- Rules:
  - The scanner catches known secret-shaped text before persistence; it is not an authorization substitute.
  - Rejection audit stores only shallow, redacted summaries.
  - MCP/runtime-specific `assertPublicSafe` checks remain as a second guard.
- Verification:
  - `node --import tsx --test ../agent-server/test/server.test.ts --test-name-pattern "secret-shaped JSON uploads"`: RED before implementation because the rejected generic `/api/transparency/anchor` upload had no `command_rejected` audit event; passed after HTTP audit range and summary redaction wiring.

Extracted package file integrity slice:

- Closed the post-download package tampering gap:
  - Package generation now injects `obsidian-epoch/assets/package-integrity.json`.
  - The integrity manifest lists every packaged file except itself, with `bytes` and `sha256`.
  - The manifest covers MCP proxy code, Skill text, plugin manifest, root install manifest, references and media assets after any serverBase-specific manifest rewriting.
  - `verifyObsidianEpochPackageIntegrity` rejects missing, extra, duplicate or hash-mismatched extracted files.
  - `agent:install-smoke` verifies the extracted package file manifest before launching `obsidian-epoch/bin/mcp-proxy.ts`.
  - Install smoke JSON now exposes `packageFileIntegrityVerified`, `packageFileIntegrityManifest` and `packageFileIntegrityFileCount` for deployment automation.
  - Static install manifests expose `verification.packageIntegrityManifest`.
- Rules:
  - Live `/api/epoch/install-manifest` plus package response header prove archive-level sha256/byte integrity before extraction.
  - `package-integrity.json` proves extracted-file integrity before an MCP host starts the packaged proxy.
  - The file manifest is not a replacement for trusting the HTTPS server origin or archive sha256; it catches tampering and truncation after download/extraction.
- Verification:
  - `node --import tsx --test ../agent-server/test/packageArchive.test.ts --test-name-pattern "integrity"`: RED before implementation because the package lacked `package-integrity.json` and `verifyObsidianEpochPackageIntegrity`; passed after adding generated manifest, verification helper and install-smoke hook.
  - `node --import tsx --test ../agent-server/test/packageArchive.test.ts --test-name-pattern "contains skill"`: RED before doc update because `host-install.md` did not mention `package-integrity.json`; passed after adding host-install guidance.
  - `node --import tsx --test ../agent-server/test/install-smoke-command.test.ts --test-name-pattern "proves MCP package"`: RED before result-shape update because the JSON output lacked package file integrity fields; passed after returning explicit extracted-package integrity evidence.

Package release signature slice:

- Closed the unsigned extracted-manifest gap:
  - `package-integrity.json` now carries an Ed25519 signature over the canonical file list and hashes.
  - Live and static install manifests expose `verification.packageSignatureAlgorithm` and `verification.packageReleasePublicKey`.
  - `verifyObsidianEpochPackageSignature` verifies the signed package-integrity manifest and rejects tampered manifest content.
  - `verifyObsidianEpochPackageIntegrity` now also verifies the release signature before checking file hashes.
  - `agent:install-smoke` pins the live manifest public key and exposes `packageFileSignatureVerified`, `packageSignatureAlgorithm` and `packageReleasePublicKey`.
  - `/epoch/install` surfaces Ed25519 release-signature metadata next to the package SHA.
- Rules:
  - Archive `package.sha256` still proves the downloaded tarball bytes.
  - The signed `package-integrity.json` proves the extracted file set and file hashes before the MCP proxy is launched.
  - Production deployments should provide `AGENT_PACKAGE_SIGNING_PRIVATE_KEY_PEM`; the bundled fallback key is only for local alpha smoke tests.
- Verification:
  - `node --import tsx --test ../agent-server/test/packageArchive.test.ts --test-name-pattern "signature|integrity manifest"`: RED before implementation because signature metadata and `verifyObsidianEpochPackageSignature` were missing; passed after adding Ed25519 signing and verification.
  - `node --import tsx --test ../agent-server/test/install-smoke-command.test.ts --test-name-pattern "proves MCP package"`: RED before install-smoke update because package signature fields were absent from JSON output; passed after pinning the live manifest public key and returning signature evidence.
  - `node --import tsx --test ../agent-server/test/server.test.ts --test-name-pattern "public install page"`: RED before page update because the install page did not display Ed25519/package-integrity signature metadata; passed after adding the release-signature tile.

Package signing trust metadata slice:

- Closed the production-signing observability gap:
  - Live and static install manifests now expose `verification.packageReleaseKeyId`, `verification.packageSigningTrust` and `verification.packageSigningKeySource`.
  - `packageReleaseKeyId` is the sha256 id of the Ed25519 release public key.
  - `packageSigningTrust` is `operator_configured` when `AGENT_PACKAGE_SIGNING_PRIVATE_KEY_PEM` is set and `local_alpha_fallback` otherwise.
  - `agent:install-smoke` validates these fields and returns `packageReleaseKeyId`, `packageSigningTrust` and `packageSigningKeySource` in JSON output.
  - `/epoch/install` surfaces the trust state next to the release signature metadata.
- Rules:
  - Local alpha smoke tests may use `local_alpha_fallback`.
  - Public production deployments should report `operator_configured`; seeing `local_alpha_fallback` on a deployed server is an operator action item.
  - Key id is evidence for release-key tracking, not a substitute for HTTPS origin trust, archive sha256, signed extracted manifest verification or operator secret management.
- Verification:
  - `node --import tsx --test ../agent-server/test/packageArchive.test.ts --test-name-pattern "signing metadata|downloadable package contains"`: RED before implementation because `packageReleaseKeyId` and `packageSigningTrust` were missing; passed after adding metadata generation and an operator-key env override test.
  - `node --import tsx --test ../agent-server/test/install-smoke-command.test.ts --test-name-pattern "proves MCP package"`: RED before implementation because smoke JSON lacked release key id and trust fields; passed after manifest validation and result-shape wiring.
  - `node --import tsx --test ../agent-server/test/server.test.ts --test-name-pattern "live install manifest"`: RED before implementation because the live manifest lacked signing trust metadata; passed after HTTP manifest wiring.

Season trusted standings slice:

- Closed the season-score provenance gap:
  - Season faction standings and agent standings now expose total `score` plus `trustedScore`, `dominantTrustClass` and `trustBreakdown`.
  - The server projection increments total score for all legal owner-authorized contributions, but only `server_hosted_agent`, `host_attested` and `remote_attested_runner` contributions increment trusted score.
  - Ordinary MCP/HTTP season contributions remain visible as `user_verified_web` in the trust breakdown without being promoted to trusted autonomous competition.
  - Public season archive pages and the Agent Console show the trusted split next to season standings.
- Rules:
  - `trustedScore` is a read-model audit lane, not a second settlement authority.
  - Clients can choose legal faction and amount, but cannot provide or upgrade `dominantTrustClass`, `trustedScore` or `trustBreakdown`.
  - Season standings use the same trust classes and trusted-lane semantics as regional leaderboards.
- Verification:
  - `node --import tsx --test ../agent-server/test/mcp.test.ts --test-name-pattern "seasonal faction campaigns"`: RED before implementation because MCP season standings lacked trusted fields; passed after projection/view wiring.
  - `node --import tsx --test ../agent-server/test/server.test.ts --test-name-pattern "seasonal faction campaigns"`: RED before implementation because HTTP season standings and public pages lacked trusted fields; passed after projection/view wiring.
  - `npm run agent:ui-test -- --test-name-pattern "links seasons"`: RED before implementation because the Agent Console did not reference trusted season fields; passed after type/render wiring.

Legacy authored-report loop marker slice:

- Closed a post-install UX/safety ambiguity:
  - The old `agent_world.*` authored-report loop remains available for compatibility, but its tool descriptions now say it is legacy and point users to the canonical `obsidian_epoch.turn_card` / `obsidian_epoch.resolve_turn` flow.
  - `agent_world.context_package`, `agent_world.start_run` and `agent_world.submit_battle_report` now return `loopMode: "legacy_authored_report"` plus `canonicalProgress.preferredTools`.
  - The installed Skill and protocol reference document this marker so coding-agent hosts do not confuse old report scoring with server-authoritative Epoch progress.
- Rules:
  - Legacy reports may support lore review and feedback, but canonical identities, resources, lifetime, NPC facts, rankings and result pages must come from `obsidian_epoch.*` events/read models.
  - Compatibility tools should be machine-readable about their reduced authority, not merely explained in prose.
- Verification:
  - `node --import tsx --test ../agent-server/test/mcp.test.ts --test-name-pattern "tool registry|world loop for an external agent"`: RED before implementation because tool descriptions and old-loop responses lacked legacy markers; passed after MCP/context return-shape wiring.

Maintenance-started season slice:

- Closed the missing seasonal pressure in the server maintenance loop:
  - `obsidian_epoch.run_maintenance` and `/api/epoch/maintenance/run` now accept `seasonRegionIds`, `seasonLimit` and `seasonKey`.
  - The maintenance worker starts built-in server season templates under `system_worker` trust, emits `season_campaign_created` / `season_started`, and skips any region that already has an active season.
  - Operator overview now counts `seasonStarted` and reports a `seasonStart` worker health row beside NPC, organization, market, resource-node and anomaly workers.
  - The Agent Console passes the current region into the season maintenance worker and displays season counts in maintenance status, health and current-run summaries.
  - MCP tool metadata and installed Skill/protocol docs describe the season maintenance fields and authority boundary.
- Rules:
  - Maintenance can start a season, but players still move season standings only through server-authorized contributions and operators/server workers still settle rewards.
  - Region-active seasons are skipped rather than overwritten, so maintenance cannot fork competing active campaigns for the same region.
  - The run summary is informational; emitted canonical server events remain the authority.
- Verification:
  - `node --import tsx --test ../agent-server/test/server.test.ts --test-name-pattern "maintenance run"`: RED before implementation because `run.body.value.seasons` and season overview health/counts were missing; passed after runtime and HTTP projection wiring.
  - `node --import tsx --test ../agent-server/test/mcp.test.ts --test-name-pattern "maintenance run"`: RED before implementation because MCP maintenance had no season summary/events; passed after runtime and MCP schema wiring.
  - `npm run agent:ui-test -- --test-name-pattern "operator overview"`: RED before implementation because Agent Console did not pass season maintenance fields or render season health/counts; passed after UI/type wiring.

Maintenance-settled season slice:

- Closed the server-season lifecycle gap after maintenance-started campaigns:
  - `obsidian_epoch.run_maintenance` and `/api/epoch/maintenance/run` now accept `seasonSettlementLimit`.
  - Mature active seasons whose `totalScore >= targetScore` are settled by the server worker through the existing core `settleSeasonCampaign` path.
  - The settlement worker emits `season_campaign_resolved` / `season_resolved` plus core side effects such as reward release, region control and monuments.
  - Operator overview now counts `seasonSettled` and reports a `seasonSettle` worker health row.
  - The Agent Console passes `seasonSettlementLimit` and displays season start versus settlement counts in status, health and current-run summaries.
  - The opt-in scheduler now reads `AGENT_SERVER_MAINTENANCE_SEASON_REGION_IDS`, `AGENT_SERVER_MAINTENANCE_SEASON_LIMIT`, `AGENT_SERVER_MAINTENANCE_SEASON_KEY` and `AGENT_SERVER_MAINTENANCE_SEASON_SETTLEMENT_LIMIT`, starts season instances with tick-scoped keys, and persists settlement events.
- Rules:
  - Maintenance can settle only seasons that are already active and have reached the server target score.
  - Settlement remains server/operator-key-gated; client story text, modified MCP adapters and prompt output cannot declare winners.
  - Scheduled season starts skip regions with an active season, while tick-scoped instance keys allow a later season after the old one resolves.
- Verification:
  - `node --import tsx --test ../agent-server/test/server.test.ts --test-name-pattern "maintenance run"`: RED before implementation because `seasons.settled`, `seasonSettled` counts and `seasonSettle` health were missing; passed after runtime and HTTP overview wiring.
  - `node --import tsx --test ../agent-server/test/mcp.test.ts --test-name-pattern "maintenance run"`: RED before implementation because MCP maintenance could not auto-settle a mature season; passed after runtime and MCP schema wiring.
  - `npm run agent:ui-test -- --test-name-pattern "operator overview"`: RED before implementation because Agent Console did not pass `seasonSettlementLimit` or render settlement counts; passed after UI/type wiring.
  - `node --import tsx --test ../agent-server/test/maintenance.test.ts --test-name-pattern "season|config"`: RED before implementation because scheduler config and tick summaries lacked season start/settlement fields; passed after scheduler config, tick worker and deployment docs wiring.
  - `node --import tsx --test ../agent-server/test/deploy-config.test.ts --test-name-pattern "deployment config"`: RED before implementation because Compose/env/README did not expose season maintenance variables; passed after deployment config updates.

Maintenance-settled resource-node slice:

- Closed the short-cycle resource contest lifecycle gap in server maintenance:
  - `obsidian_epoch.run_maintenance` and `/api/epoch/maintenance/run` now accept `resourceNodeSettlementLimit`.
  - Manual maintenance and the opt-in scheduler settle open resource nodes only when they have positive canonical score from real stamina contests.
  - Settlement uses the existing server-authoritative `settleResourceNode` path, so winner reward release, `region_influence_changed` and `trace_created` still come from core rules.
  - Empty open resource nodes remain open for future competition instead of being auto-closed without play.
  - Operator overview now counts `resourceNodeSettled` and reports a separate `resourceNodeSettle` worker health row.
  - The Agent Console passes `resourceNodeSettlementLimit` and displays resource-node spawn versus settlement counts in maintenance status, health and current-run summaries.
  - Deployment env examples, Compose config, Skill guidance, protocol docs and the architecture doc now expose `AGENT_SERVER_MAINTENANCE_RESOURCE_NODE_SETTLEMENT_LIMIT`.
- Rules:
  - Maintenance can settle only contested open nodes with `totalScore > 0`.
  - Settlement remains server/operator-key-gated; player prompts and modified local MCP adapters cannot declare winners, payout amounts or influence changes.
  - Settlement runs before spawn attempts, so a tick does not spawn and immediately close an empty node.
- Verification:
  - `node --import tsx --test ../agent-server/test/maintenance.test.ts --test-name-pattern "resource nodes|config"`: RED before implementation because scheduler config and resource-node summaries lacked settlement fields; passed after scheduler settlement wiring.
  - `node --import tsx --test ../agent-server/test/server.test.ts --test-name-pattern "maintenance run"`: passed after HTTP maintenance could spawn, contest and auto-settle a resource node while refreshing operator overview.
  - `node --import tsx --test ../agent-server/test/mcp.test.ts --test-name-pattern "maintenance run"`: passed after MCP maintenance could spawn, contest and auto-settle a resource node through the plugin-facing tool.
  - `npm run agent:ui-test -- --test-name-pattern "operator overview"`: passed after Agent Console rendered resource-node settlement counts and worker health.
  - `node --import tsx --test ../agent-server/test/deploy-config.test.ts --test-name-pattern "deployment config"`: passed after deployment config exposed the resource-node settlement limit.
  - `npm run typecheck`: passed, including `check:no-js`, `typecheck:web` and `typecheck:agent`.

Resource-node settlement news slice:

- Closed the gap between server-settled resource contests and the public legend/news loop:
  - `obsidian_epoch.settle_resource_node` and `/api/epoch/resource-nodes/settle` now append server-derived `region_news_generated` from the canonical `resource_node_settled` event.
  - Maintenance resource-node settlement inherits the same news generation path, so scheduled settlement persists both the settlement and its regional news.
  - The winner appears in `progress.claimableLegendNews` and can claim legend through the existing owner-authorized `claim_news_legend` flow.
  - Region reads expose the settlement news in `region_info.news`, linking the resource contest result to the public world surface.
- Rules:
  - News is derived from the canonical settlement event; client story text cannot invent settlement headlines, eligibility or legend rewards.
  - Repeated settlement remains a no-op and does not mint duplicate news or legend.
  - The news loop is additive to resource rewards; resource payout still comes only from `resource_node_settled` and `resource_granted`.
- Verification:
  - `node --import tsx --test ../agent-server/test/server.test.ts --test-name-pattern "server-spawned resource nodes"`: RED before implementation because HTTP settlement lacked `region_news_generated`; passed after runtime settlement appended server news.
  - `node --import tsx --test ../agent-server/test/mcp.test.ts`: passed after MCP settlement exposed news and claimable legend through plugin-facing tools.
  - `node --import tsx --test ../agent-server/test/maintenance.test.ts --test-name-pattern "resource nodes"`: passed after scheduler settlement persisted `region_news_generated`.

Contested objective settlement news slice:

- Closed the same public legend/news loop for regional public goals:
  - `obsidian_epoch.settle_objective` and `/api/epoch/objectives/settle` now append server-derived `region_news_generated` from the canonical `contested_objective_settled` event.
  - Objective winners appear in `progress.claimableLegendNews` and can claim legend through the existing owner-authorized `claim_news_legend` flow.
  - Region reads expose the objective settlement news in `region_info.news`, linking public goals to the same world surface as resource contests and anomaly results.
- Rules:
  - News is derived from the canonical objective settlement event; client story text cannot invent objective headlines, eligibility or legend rewards.
  - Repeated settlement remains a no-op and does not mint duplicate news or legend.
  - The news loop is additive to objective rewards; payout still comes only from `contested_objective_settled` and `resource_granted`.
- Verification:
  - `node --import tsx --test ../agent-server/test/server.test.ts --test-name-pattern "Epoch routes persist canonical events"`: RED before implementation because HTTP objective settlement lacked `region_news_generated`; passed after runtime settlement appended server news and the test asserted message news semantically instead of by fixed list position.
  - `node --import tsx --test ../agent-server/test/mcp.test.ts`: passed after MCP settlement exposed objective news and claimable legend through plugin-facing tools.

Server-hosted trusted action slice:

- Closed the missing public entry point for true operator-controlled autonomous play:
  - `obsidian_epoch.run_server_hosted_action` and `POST /api/epoch/hosted/server-action` now start and resolve one hosted session in a single operator-gated command.
  - The command records `hosted_session_started`, `hosted_action_recorded` and any resource/lifetime side effects as `server_hosted_agent`.
  - Ordinary `start_hosted_session`, `submit_hosted_action` and Web LLM bridge flows remain owner-authorized `user_verified_web` / `untrusted_client` lanes and cannot promote themselves by passing trust fields.
  - The command accepts only basic server option keys (`observe`, `assist`, `anomaly`) for this slice, so invalid choices are rejected before any session event is created.
  - The Web Agent Console Hosted runner panel now exposes the same operator-gated lane as a "服务器权威行动" control, records the most recent server-hosted run, and refreshes hosted sessions/progress after the server settles the action.
  - The console call sends `operatorKey`, `agentId`, `regionId`, `mandate`, `visibleText`, whitelisted `optionKey` and a web idempotency key; it does not send the player's recovery credential.
  - `obsidian_epoch.queue_server_hosted_action`, `obsidian_epoch.server_hosted_jobs`, `obsidian_epoch.run_server_hosted_job`, `GET/POST /api/epoch/hosted/server-jobs`, and `POST /api/epoch/hosted/server-jobs/run` now provide a canonical queued server-hosted job lane.
  - The queue appends `server_hosted_job_queued`; execution runs the job through the same hosted session/action settlement path and appends `server_hosted_job_completed` after validating that job, session and action all belong to the same agent.
  - Agent Console now exposes "服务器作业队列" controls to queue, refresh, execute the next job or execute a specific pending job, while still using only the operator key and server whitelisted option keys.
- Rules:
  - Server-hosted trust requires the server operator key, not a player recovery credential.
  - The server still settles from the same hosted action option templates; operator text cannot invent rewards, rank or lifetime outcomes.
  - Server-hosted jobs are canonical event-store state, not in-memory prompts. They survive hydration through the normal event projection once persisted.
  - This is the product's first concrete queued `server_hosted_agent` public runtime lane; host-attested and remote-attested runner lanes remain separate evidence paths.
- Verification:
  - `node --import tsx --test ../agent-server/test/server.test.ts --test-name-pattern "server-hosted actions|Epoch routes persist canonical events"`: RED before implementation because `/api/epoch/hosted/server-action` returned 404; passed after HTTP/runtime wiring and after isolating the new resource side effect from the long economy test.
  - `node --import tsx --test ../agent-server/test/mcp.test.ts`: passed after MCP tool registration and plugin-facing `run_server_hosted_action` execution produced `server_hosted_agent` events.
  - `node --import tsx --test src/agent/api.test.ts --test-name-pattern "server-hosted action API"`: RED before implementation because the Web API module did not export `runEpochServerHostedAction`; passed after adding the typed wrapper.
  - `node --import tsx --test src/agent/AgentExplorer.layout.test.ts --test-name-pattern "operator-gated server-hosted action controls"`: RED before implementation because the console lacked the server-hosted control; passed after adding the operator-key-only handler and UI.
  - `node --import tsx --test ../agent-server/test/server.test.ts --test-name-pattern "server-hosted autonomous jobs"`: RED before implementation because `/api/epoch/hosted/server-jobs` returned 404; passed after adding canonical job events, runtime wrappers and HTTP routes.
  - `node --import tsx --test ../agent-server/test/mcp.test.ts --test-name-pattern "server-hosted autonomous jobs"`: passed after MCP queue/list/run tools were registered and executed canonical job events.
  - `node --import tsx --test src/agent/api.test.ts --test-name-pattern "server-hosted job API"`: RED before implementation because the Web API module lacked job wrappers; passed after adding queue/list/run API helpers.
  - `node --import tsx --test src/agent/AgentExplorer.layout.test.ts --test-name-pattern "operator-gated server-hosted action controls"`: RED before implementation because the console lacked queue/list/run controls; passed after adding the server job queue UI.
  - `npm run typecheck:agent`: passed after adding the runtime result type and tool wrappers.

Server-hosted maintenance worker slice:

- Closed the gap between queued server-hosted jobs and unattended server operation:
  - `obsidian_epoch.run_maintenance` and `POST /api/epoch/maintenance/run` now accept `serverHostedJobLimit`.
  - Each maintenance run consumes queued `serverHostedJobs` through the existing `runServerHostedJob` path, so hosted session/action settlement and `server_hosted_job_completed` remain the only canonical completion evidence.
  - `operator_overview` now reports `summary.serverHostedJobsQueued`, `health.queues.serverHostedJobsQueued`, `maintenance.counts.serverHostedJobsCompleted` and `maintenance.health.workers.serverHostedJob`.
  - Agent Console passes `serverHostedJobLimit: 3`, displays queued/completed hosted jobs in the operator overview and shows the current run's hosted-job completion count.
  - The opt-in deployment scheduler parses `AGENT_SERVER_MAINTENANCE_SERVER_HOSTED_JOB_LIMIT` and can consume queued hosted jobs without an operator clicking the console.
- Rules:
  - Server-hosted job maintenance still requires the operator key and does not use the player's recovery credential.
  - Queued jobs are bounded by `serverHostedJobLimit`; idempotency keys are derived from maintenance tick plus job id, so replay does not duplicate settlement.
  - A queued job is not considered complete until `server_hosted_job_completed` is emitted by the server-owned hosted-action path.
- Verification:
  - `node --import tsx --test ../agent-server/test/server.test.ts --test-name-pattern "server-hosted jobs within"`: RED before implementation because maintenance summaries lacked `serverHostedJobs`; passed after runtime and overview wiring.
  - `node --import tsx --test ../agent-server/test/mcp.test.ts --test-name-pattern "server-hosted jobs within"`: RED before implementation because MCP maintenance summaries lacked `serverHostedJobs`; passed after runtime and MCP schema wiring.
  - `node --import tsx --test src/agent/AgentExplorer.layout.test.ts --test-name-pattern "operator overview panel"`: RED before implementation because the console did not pass or render hosted-job maintenance fields; passed after UI/type wiring.
  - `node --import tsx --test ../agent-server/test/maintenance.test.ts --test-name-pattern "server-hosted jobs|config"`: RED before implementation because scheduler config and tick summaries lacked hosted-job fields; passed after scheduler config and worker wiring.

Result-page server receipt slice:

- Closed the gap between shareable result pages and auditable MMO settlement proof:
  - New result-page payloads include `receipt.receiptType: "server_result_receipt"`.
  - `receipt.payloadHash` is a sha256 hash over the server-built result payload before the receipt is attached.
  - `receipt.focus` identifies the resolved turn card, completed hosted/Web bridge session, agent snapshot or explorer snapshot.
  - `receipt.trustClasses` summarizes trust classes from the canonical events included in the receipt.
  - `receipt.canonicalEvents[]` carries event ids, event types, aggregate ids, trust classes and `/epoch/audit/{eventId}` links.
  - `/epoch/result/{pageId}` renders a visible “服务器收据” block with hash, focus, trust and audit links.
  - Agent Console result previews show the same receipt hash, focus and canonical event count.
- Rules:
  - Result receipts are read models; they do not mint resources, identity state, rewards or ranking.
  - Prompt prose, browser-model prose, screenshots and local summaries are not settlement proof unless the receipt and audit events support the claim.
  - Old persisted result pages without `receipt` remain render-compatible, but newly created pages include receipts.
- Verification:
  - `node --import tsx --test ../agent-server/test/server.test.ts --test-name-pattern "HTTP result pages expose continuation actions and regional context"`: RED before implementation because `payload.receipt` was missing; passed after runtime receipt generation and public HTML rendering.
  - `node --import tsx --test ../agent-server/test/mcp.test.ts --test-name-pattern "MCP Epoch tools expose server-issued identity"`: RED before implementation because MCP-created result pages lacked receipt data; passed after payload receipt wiring.
  - `node --import tsx --test src/agent/AgentExplorer.layout.test.ts --test-name-pattern "result page server receipts"`: RED before implementation because Agent Console did not reference `resultPage.receipt`; passed after type/UI wiring.

Public world overview slice:

- Closed the missing always-available public world lobby:
  - `/epoch/world` now renders a server-side, no-script public overview page.
  - The page aggregates only canonical read projections: visible region news, recent public result pages with receipt hashes, terminal identity archives, active seasons, region highlights, and install/console links.
  - `runtime.worldOverview` / `epochWorldOverview` expose the same read model to HTTP without creating state.
  - Live and static install manifests now include `publicPages.world: "/epoch/world"`.
  - The Web LLM bridge host install entry also advertises `/epoch/world`, giving browser-only model flows a read-only observation surface.
- Rules:
  - World overview is a read model; it does not mint resources, identity state, rewards, rank, season outcomes or audit evidence.
  - The page does not expose raw event payloads, recovery credentials or client-authored story claims as canonical facts.
  - Recent result cards link to server result pages and show server receipt hashes rather than trusting local summaries.
- Verification:
  - `node --import tsx --test ../agent-server/test/server.test.ts --test-name-pattern "HTTP renders public world overview|HTTP live install manifest points host MCP configs"`: RED before implementation because `/epoch/world` returned 404 and manifest entries were missing; passed after runtime, route, renderer and manifest wiring.
  - `node --import tsx --test ../agent-server/test/packageArchive.test.ts --test-name-pattern "Obsidian Epoch downloadable package contains skill and plugin manifests"`: RED before implementation because package manifests lacked `publicPages.world`; passed after static manifest and host install entries were updated.

Structured world overview slice:

- Closed the gap between the human `/epoch/world` page and installed agents that need machine-readable global status:
  - `obsidian_epoch.world_overview` now appears in the installed MCP tool list.
  - `GET /api/epoch/world-overview` returns the same canonical read model for HTTP clients.
  - Live and static install manifests include the new MCP tool name.
  - Protocol, Skill and architecture docs tell agents to call the structured read instead of scraping `/epoch/world`.
- Rules:
  - The structured world overview is read-only and does not mint resources, identity state, rewards, rank, season outcomes, result ownership or audit evidence.
  - The response contains only canonical projections and public links; raw recovery credentials, raw event payloads and client-authored claims remain hidden.
- Verification:
  - `node --import tsx --test ../agent-server/test/mcp.test.ts --test-name-pattern "MCP Epoch tools expose server-issued identity"`: RED before implementation because `obsidian_epoch.world_overview` was missing from `tools/list`; passed after MCP registration and runtime wiring.
  - `node --import tsx --test ../agent-server/test/server.test.ts --test-name-pattern "HTTP renders public world overview"`: RED before implementation because `/api/epoch/world-overview` returned 404; passed after HTTP route wiring.

Web console world overview slice:

- Closed the gap between the structured world overview endpoint and the installed user's day-to-day control surface:
  - `getEpochWorldOverview` wraps `GET /api/epoch/world-overview` in the web API module.
  - The Agent Console now loads a canonical `Epoch 世界总览` panel from that endpoint.
  - The panel surfaces active/archived identity counts, regions with visible news, result-page counts, world news, recent server-receipted result pages, active seasons and region-highlight links.
  - The panel links back to `/epoch/world`, `/epoch/result/{pageId}`, `/epoch/season/{seasonId}` and `/epoch/region/{regionId}` instead of copying or inventing world state.
- Rules:
  - The console overview is read-only; it does not write messages, rewards, seasons, rankings, result ownership or audit evidence.
  - It reads the same canonical projection as `obsidian_epoch.world_overview`, so UI summaries cannot become a second source of truth.
- Verification:
  - `node --import tsx --test src/agent/api.test.ts --test-name-pattern "world overview API"`: RED before implementation because `getEpochWorldOverview` was missing; passed after typed API wrapper wiring.
  - `node --import tsx --test src/agent/AgentExplorer.layout.test.ts --test-name-pattern "canonical world overview"`: RED before implementation because the console lacked a canonical world overview panel; passed after UI and CSS wiring.

Epoch-namespaced health endpoint slice:

- Closed a deployment discoverability gap in the server-authoritative API namespace:
  - `GET /api/epoch/health` now returns the same structured readiness payload as `GET /api/health`.
  - `agent:install-smoke` probes both paths before manifest, package, MCP and gameplay verification.
  - Smoke JSON now reports `epochHealthStatus`, `epochHealthOk` and `epochHealthChecks` beside the base health fields.
  - Package host-install, smoke-playbook, protocol and architecture docs now describe both health paths.
- Rules:
  - The Epoch health endpoint is read-only and does not create events, identities, resources, rankings or recovery records.
  - `/api/health` remains available for generic load balancers and container health checks.
  - `/api/epoch/health` gives MCP/install clients a namespaced readiness probe that matches the rest of the Epoch API surface.
- Verification:
  - `node --import tsx --test ../agent-server/test/server.test.ts --test-name-pattern "HTTP health reports"`: RED before implementation because `/api/epoch/health` returned `404`; passed after routing both health paths through the same readiness contract.
  - `node --import tsx --test ../agent-server/test/install-smoke-command.test.ts --test-name-pattern "proves MCP package"`: RED before implementation because install smoke failed preflight on `install_smoke_epoch_health_failed`; passed after the namespaced route and smoke result fields were added.

Manifest health endpoint discovery slice:

- Closed the remaining machine-readability gap for deployment health discovery:
  - Live `/api/epoch/install-manifest` now exposes `health.readiness: "/api/health"` and `health.epochReadiness: "/api/epoch/health"`.
  - Both static package install manifests expose the same `health` object.
  - `agent:install-smoke` validates the manifest health paths and returns `manifestHealth` in JSON output.
  - Deployment README, off-host restore runbook, host-install guide, protocol reference and architecture docs describe the manifest health contract.
- Rules:
  - Manifest health paths are discovery metadata only; they do not create readiness state, server authority, gameplay events or recovery proofs.
  - The readiness bodies remain served by the HTTP health endpoints, not by the manifest.
  - Static package manifests retain localhost defaults; live manifests bind the install server base through the existing `serverBase` field.
- Verification:
  - `node --import tsx --test ../agent-server/test/packageArchive.test.ts --test-name-pattern "downloadable package contains"`: RED before implementation because the static manifests had no `health` object; passed after static manifest sync.
  - `node --import tsx --test ../agent-server/test/server.test.ts --test-name-pattern "live install manifest"`: RED before implementation because the live manifest had no `health` object; passed after adding `health` to `epochInstallManifest`.
  - `node --import tsx --test ../agent-server/test/install-smoke-command.test.ts --test-name-pattern "proves MCP package"`: RED before implementation because preflight failed with `install_smoke_health_manifest_missing`; passed after smoke validation and JSON output wiring.

Manifest recovery command discovery slice:

- Closed a production recovery automation gap in the install manifest:
  - Live `/api/epoch/install-manifest` now exposes `verification.recoveryDrillCommand`, `verification.backupCommand` and `verification.restoreBackupCommand`.
  - Both static package install manifests expose the same recovery command fields.
  - `agent:install-smoke` validates those fields and returns them in JSON output.
  - Host-install, protocol and architecture docs describe the commands as operator-side deployment metadata rather than MCP gameplay authority.
- Rules:
  - Recovery command metadata does not create any HTTP or MCP backup capability.
  - Backup, restore and recovery drill remain local/deployment commands with their existing fresh-target and hash-verification safeguards.
  - Installed agent hosts can discover the recovery playbook, but ordinary gameplay clients still cannot read or mutate backup storage.
- Verification:
  - `node --import tsx --test ../agent-server/test/packageArchive.test.ts --test-name-pattern "downloadable package contains"`: RED before implementation because static manifests lacked `verification.recoveryDrillCommand`; passed after static manifest sync.
  - `node --import tsx --test ../agent-server/test/server.test.ts --test-name-pattern "live install manifest|install smoke flow"`: RED before implementation because live install manifests lacked recovery command fields; passed after `epochInstallManifest` wiring.
  - `node --import tsx --test ../agent-server/test/install-smoke-command.test.ts --test-name-pattern "proves MCP package"`: RED before implementation because smoke preflight failed with `install_smoke_recovery_commands_missing`; passed after smoke validation and JSON output wiring.

Public install recovery command slice:

- Closed a deployability gap on the human-facing install page:
  - `/epoch/install` now renders a dedicated `恢复演练` section with `agent:recovery-drill`, `agent:backup` and `agent:restore-backup` commands from the live manifest.
  - The renderer type includes the recovery command fields so the page stays aligned with manifest shape and install-smoke output.
  - Architecture and packaged protocol docs state that the commands are discoverable on `/epoch/install` while remaining operator-side deployment commands, not MCP backup tools.
- Verification:
  - `node --import tsx --test ../agent-server/test/server.test.ts --test-name-pattern "public install page"`: RED before implementation because the install page lacked `恢复演练`; passed after renderer wiring.

Agent Console low-stimulation mode slice:

- Added the MVP comfort switch required before high-stimulus commissions:
  - Agent Console exposes a persistent `低刺激模式` checkbox backed by local browser storage.
  - Hosted mandates, Web LLM bridge prompts, turn-card prompts and visible action text are wrapped with low-stimulation guidance when the switch is enabled.
  - The guidance asks agents to avoid jump scares, flashing, body-horror escalation, whisper-audio cues and overly intense horror while preserving clear choices and exit paths.
  - Architecture, packaged protocol and packaged Skill docs describe the switch as presentation/accessibility guidance only, not server authority.
- Rules:
  - Low-stimulation mode cannot change rewards, lifetime loss, option IDs, result receipts, trust class, canonical events or identity state.
  - The server remains authoritative; the preference only changes the text given to local agents or browser models.
- Verification:
  - `node --import tsx --test src/agent/AgentExplorer.layout.test.ts --test-name-pattern "low-stimulation mode"`: RED before implementation because the console had no persistent low-stimulation key or prompt wrapping; passed after UI/state/payload wiring.
  - `node --import tsx --test src/agent/AgentExplorer.layout.test.ts --test-name-pattern "low-stimulation mode|turn-card controls"`: passed after updating the turn-card control expectation to the low-stimulation wrapper.

Starter high-risk protection slice:

- Closed the S011/S012 gap for first high-risk server-settled play:
  - The core settlement path now detects a first-generation identity with no prior `turn_resolved` or `hosted_action_recorded` event.
  - The first high-risk turn-card or hosted/Web LLM action suppresses the strong anomaly reward and cannot reduce remaining lifetime below 1.
  - Later high-risk turn-card or hosted actions follow the normal reward, lifetime-loss, archive and reincarnation path.
  - Architecture, protocol and packaged Skill docs describe the rule as server-derived from canonical event history, not prompt-controlled.
- Rules:
  - Starter protection keeps the first dangerous play recoverable without creating a protected high-risk farming lane.
  - Prompt text, modified MCP adapters and browser models cannot opt in, opt out or apply the protection to later actions.
- Verification:
  - `node --import tsx --test ../agent-server/test/epoch-game-core.test.ts --test-name-pattern "first high-risk turn"`: RED before implementation because the first high-risk turn emitted `resource_granted`, `identity_archived`, `identity_issued` and `reincarnation_issued`; passed after the core settlement policy was added.
  - `node --import tsx --test ../agent-server/test/epoch-game-core.test.ts --test-name-pattern "first high-risk|turn cards expose|hosted runner accepts"`: passed with turn-card and hosted first-run protection plus existing settlement invariants.

High-risk request throttling slice:

- Closed the S009 MVP gap for repeated high-risk request fatigue/farming:
  - `turn_resolved` and `hosted_action_recorded` now persist the settled option risk.
  - The core counts high-risk settled turn/hosted actions per identity, with an alpha cap of two.
  - After the cap is spent, `turn_card` and hosted/Web LLM session creation omit high-risk options and leave low/medium alternatives.
  - The count is server-derived from canonical events, with backward compatibility for older negative-lifetime events.
- Rules:
  - High-risk throttling cannot be bypassed by prompt text, modified MCP adapters, browser copy/paste models or forged option ids.
  - A new identity starts with its own risk package; the old identity's spent package remains part of that identity's audit history.
- Verification:
  - `node --import tsx --test ../agent-server/test/epoch-game-core.test.ts --test-name-pattern "high-risk options"`: RED before implementation because settled actions lacked risk and newly issued cards still exposed a third high-risk option; passed after risk payloads and option filtering were added.
  - `node --import tsx --test ../agent-server/test/epoch-game-core.test.ts --test-name-pattern "high-risk options|first high-risk|turn cards expose|hosted runner accepts"`: passed with starter protection, high-risk cap and existing option-settlement invariants.

Repeatable basic reward anti-farming slice:

- Closed the remaining low-risk resource faucet after high-risk options are throttled:
  - The core now counts repeatable `observe` and `assist` reward settlements per identity from canonical `turn_resolved` and `hosted_action_recorded` events.
  - The alpha allowance grants resources for only the first two settled `observe` rewards and first two settled `assist` rewards per identity.
  - Later repeatable basic choices still record the server action/result, but settlement omits `resource_granted`.
  - Hosted/Web bridge sessions also omit exhausted basic rewards from returned option payloads so agents do not promise payouts that the server will suppress.
- Rules:
  - The cap applies to both turn cards and hosted/Web LLM bridge play, so switching clients cannot reset the faucet.
  - Competitive, one-time and server-worker rewards such as news legend, resource nodes, anomalies, objectives, seasons and bounties keep their own settlement rules.
- Verification:
  - `node --import tsx --test ../agent-server/test/epoch-game-core.test.ts --test-name-pattern "repeatable basic action rewards"`: RED before implementation because the third `observe` still returned `turn_observe` and appended `resource_granted`; passed after the server settlement policy and hosted option reward filtering were added.

Stale server-hosted job skip slice:

- Closed a queued-autonomy livelock after high-risk throttling:
  - Queued server-hosted jobs are revalidated immediately before execution.
  - If a queued `optionKey` is no longer legal, such as `anomaly` after the identity spent its high-risk allowance, the runtime now appends `server_hosted_job_skipped` with `reason: "action_option_unavailable"`.
  - Skipped jobs leave the queued set, expose `status: "skipped"` through `server_hosted_jobs`, and do not create hosted sessions, hosted actions, rewards or lifetime effects.
  - Maintenance recent-event and worker-health projections include skipped server-hosted jobs as server-owned maintenance evidence while preserving separate completed/skipped counts.
- Rules:
  - Operators may queue new work if desired, but old illegal jobs cannot be coerced into success by prompt text, MCP edits or maintenance retries.
  - A skipped job is audit evidence, not a player-facing victory or payout.
- Verification:
  - `node --import tsx --test ../agent-server/test/maintenance.test.ts --test-name-pattern "server-hosted jobs skip"`: RED before implementation because `run_server_hosted_job` threw `hosted_action_option_not_found` after creating a stale session; passed after preflight revalidation and `server_hosted_job_skipped` projection were added.

Skipped job operator visibility slice:

- Closed the user-facing observability gap after introducing skipped server-hosted jobs:
  - Web/API types now model `server_hosted_job_skipped`, `serverHostedJobsSkipped`, `status: "skipped"`, `skipReason`, `skippedAt` and optional `run` on `run_server_hosted_job` results.
  - Agent Console operator overview shows skipped server-hosted job count beside queued/completed counts.
  - The Hosted runner queue list displays skipped timestamp and reason so operators do not mistake a rejected stale job for a hidden success or stuck queue item.
  - Skipped job execution clears stale last-run display instead of showing a previous completed action.
- Rules:
  - Skipped jobs are visible server evidence, not failures for agents to paper over with prose.
  - A skipped job may be followed by a newly queued legal job, but the skipped record remains part of the audit trail.
- Verification:
  - `node --import tsx --test src/agent/AgentExplorer.layout.test.ts --test-name-pattern "operator overview panel|server-hosted action controls"`: RED before implementation because the console did not reference `serverHostedJobsSkipped`, `job.skipReason` or `job.skippedAt`; passed after UI/type wiring.
  - `node --import tsx --test src/agent/api.test.ts --test-name-pattern "operator overview API|server-hosted job API"`: passed with skipped payload passthrough and optional `run` assertions.

Legacy run-ticket expiration slice:

- Closed the old authored-report compatibility lane after the Epoch server-authoritative loop became the preferred path:
  - `agent_world.start_run` and `POST /api/runs/start` now issue tickets with server-owned `createdAt` and `expiresAt`.
  - Ticket TTL is runtime/server configuration (`tickets.ttlMs`), not a client request field.
  - `submitTicket` expires stale issued tickets before settlement, records `state: "expired"` plus `expiredAt`, and rejects with `ticket_expired`.
  - MCP and HTTP submit paths reject expired run tickets before adjudication, so stale reports cannot admit lore, progression, transparency entries or public archive runs.
  - Already submitted tickets still support same-payload idempotent replay; older hydrated tickets without `expiresAt` remain readable for migration compatibility.
- Rules:
  - Users cannot bank old run tickets and submit later prompt-edited stories into the shared world.
  - Ticket expiration affects only the legacy authored-report lane; current Epoch turn-card, hosted, Web LLM bridge and attested lanes keep their own server-issued option/session proofs.
- Verification:
  - `node --import tsx --test ../agent-server/test/tickets.test.ts`: RED before implementation because new tickets had no `expiresAt` and stale issued tickets still submitted; passed after TTL and `ticket_expired` state handling.
  - `node --import tsx --test ../agent-server/test/mcp.test.ts --test-name-pattern "expired run tickets|tools run the world loop"`: RED before implementation because MCP start-run returned no `expiresAt`; passed after runtime ticket wiring.
  - `node --import tsx --test ../agent-server/test/server.test.ts --test-name-pattern "expired run tickets|shared runtime identity guard"`: RED before implementation because HTTP returned no `expiresAt` and later mapped `ticket_expired` to 500; passed after HTTP error mapping.

Result-page revocable share-token slice:

- Closed the public-result replay/privacy gap for shared canonical outcomes:
  - `obsidian_epoch.create_result_page` now issues `page.urlPath` with a server-generated `shareToken`.
  - Result pages persist `status: "active"`, `shareVersion` and `shareTokenHash`; the raw share token is not stored as page content.
  - `/epoch/result/{pageId}` requires the matching `shareToken` for new pages and returns no-script status pages for missing, mismatched or revoked links.
  - `obsidian_epoch.revoke_result_page` and `POST /api/epoch/result-page/revoke` mark a page revoked through owner recovery authorization or operator key.
  - Revoked pages remain recoverable in the server ledger but are filtered from `world_overview.recentResults` and no longer render old result content.
- Rules:
  - Public result pages are proofs of server receipts, not permanent bearer-free URLs.
  - Prompt text, modified MCP adapters and old copied links cannot recover content from a revoked page or from a link whose token is missing or wrong.
  - Legacy hydrated pages without `shareTokenHash` stay readable for compatibility, but all newly created pages use the revocable share-token flow.
- Verification:
  - `node --import tsx --test ../agent-server/test/server.test.ts --test-name-pattern "Epoch routes persist canonical events|public world overview"`: RED before implementation because created result URLs lacked `shareToken`; passed after token issuance, public access checks, revocation route and recent-result filtering were added.
  - `node --import tsx --test ../agent-server/test/mcp.test.ts --test-name-pattern "MCP Epoch tools expose server-issued identity"`: RED before implementation because MCP-created result pages lacked `shareToken` and no revoke tool existed; passed after `obsidian_epoch.revoke_result_page` and package manifest wiring were added.

Agent Console result-page revoke slice:

- Closed the web-management gap after adding server-side result-page revocation:
  - `tools/graph-react-app/src/agent/api.ts` exposes `revokeEpochResultPage`, wrapping `POST /api/epoch/result-page/revoke`.
  - The Agent Console result-page panel now shows `隐藏链接` for the current shared result page.
  - The button sends owner recovery authorization, `pageId`, `reason: "owner_hidden_from_console"` and a fresh idempotency key.
  - Successful revocation updates the local shared-page state to `status: "revoked"`, hides the public link in the panel and refreshes the world overview so the recent-result list reflects server filtering.
- Rules:
  - The browser remains a client: it cannot delete or rewrite the result payload, only request the existing server-authorized revocation path.
  - Revoked results remain ledger/audit records; the UI treats them as hidden shared links rather than erased history.
- Verification:
  - `node --import tsx --test src/agent/api.test.ts --test-name-pattern "result page API"`: RED before implementation because `revokeEpochResultPage` was not exported; passed after API wrapper wiring.
  - `node --import tsx --test src/agent/AgentExplorer.layout.test.ts --test-name-pattern "revoke shared result pages"`: RED before implementation because the Console had no `revokeSharedResultPage` function or `隐藏链接` control; passed after UI wiring.

Archived identity news-legend lockout slice:

- Closed a post-death resource faucet in the news/legend reward path:
  - `claim_news_legend` now requires the mentioned identity to still be active before granting `legend_awarded` and `resource_granted`.
  - Archived identities may remain visible in region news and death/archive history, but cannot use old or late-published news references to mint fresh legend resources.
  - HTTP `POST /api/epoch/news/claim-legend` now returns `agent_identity_archived` for owner-authorized archived-identity claims instead of issuing legend.
  - Architecture, Skill and protocol docs state that news legend claims are active-identity reward writes, not post-death resource faucets.
- Rules:
  - Lifetime ending must be a hard gameplay boundary; after identity archive, the identity is history, not a resource account that can keep progressing.
  - Final/death prestige must be awarded by explicit archive/death/season systems, not by replaying ordinary active-agent reward claims.
- Verification:
  - `node --import tsx --test ../agent-server/test/epoch-game-core.test.ts --test-name-pattern "archived identities cannot claim news legend"`: RED before implementation because `claimNewsLegend` used `requireIdentity` and granted legend to archived identities; passed after switching the claim path to `requireActiveIdentity`.
  - `node --import tsx --test ../agent-server/test/server.test.ts --test-name-pattern "Epoch routes persist canonical events"`: passed after adding an HTTP regression that issues a separate identity, creates a news mention, archives the identity, then verifies `claim-legend` returns `agent_identity_archived`.

Archived identity claimable-news notification slice:

- Closed the post-death "可领取" UX gap after the reward faucet was locked:
  - `progress.claimableLegendNews` now returns entries only for an existing active identity.
  - Archived identities may still appear in region news/history, but their progress view no longer advertises active legend-claim prompts.
  - The Agent Console derives `isIdentityActive` from server progress and disables both news legend claim controls for archived identities.
  - Architecture, Skill and protocol docs now state that claimable news notifications are active-identity hints, not archive-history prompts.
- Rules:
  - A failed reward write is not enough; the read model and UI must not invite a post-death action the server will reject.
  - Public news history and active reward eligibility are separate surfaces.
- Verification:
  - `node --import tsx --test ../agent-server/test/server.test.ts --test-name-pattern "Epoch routes persist canonical events"`: RED before implementation because an archived identity's progress still exposed `claimableLegendNews`; passed after gating the read model by active identity status.
  - `node --import tsx --test src/agent/AgentExplorer.layout.test.ts --test-name-pattern "Agent console surfaces server-derived claimable legend news"`: RED before implementation because the Console had no `isIdentityActive` guard on claim buttons; passed after UI gating.

Archived identity active-control lockout slice:

- Closed the broader Console UX gap where archived identities could still see many active gameplay buttons as clickable:
  - The Agent Console now derives `canUseActiveIdentity` and `activeIdentityDisabled` from server progress instead of treating any `currentAgentId` as playable.
  - Active write handlers for crafting, shop purchases, downtime, speech, objectives, resource nodes, anomalies, seasons, market orders, bounties, raids, relationships, diplomacy, hosted sessions, Web LLM bridge turns, turn cards and attested actions now return early unless the selected identity is active.
  - Representative buttons across the same active-play surfaces are disabled for archived identities while read-only refresh/history/result-page and reincarnation surfaces remain available.
  - Architecture, Skill and protocol docs now state that archived identities are history/archive identities, not active UI accounts.
- Rules:
  - Server rejection is the authority boundary; the Console must also avoid inviting users into actions that are impossible after archive.
  - `agentId` presence proves identity selection, not action eligibility. Action eligibility comes from server progress identity status.
- Verification:
  - `node --import tsx --test src/agent/AgentExplorer.layout.test.ts --test-name-pattern "active gameplay controls"`: RED before implementation because no shared active-identity guard existed; passed after function and button gating.

MCP quickstart identity-lifecycle slice:

- Made the first installed-agent MCP response safer for archived identities:
  - `obsidian_epoch.quickstart.webConsole` now points at `/epoch/console`, matching the verified public Console route instead of the older `/?agent=1` compatibility path.
  - Quickstart now returns `identityLifecycle.statusField`, `activeOnlyTools` and `archivedFlow` so coding-agent hosts can branch on server progress before trying active play.
  - The one-turn `turn_card` and `resolve_turn` steps are marked `requiresActiveIdentity` with `blockedWhen` text for archived identities.
  - Skill, protocol and architecture docs now describe quickstart as the source of the active-vs-archived lifecycle rule for installed hosts.
- Rules:
  - The first thing a plugin-installed agent reads should be machine-actionable, not only prose playbook guidance.
  - The install path should direct users to the verified `/epoch/console` surface.
- Verification:
  - `node --import tsx --test ../agent-server/test/mcp.test.ts --test-name-pattern "MCP tool registry"`: RED before implementation because quickstart returned `/?agent=1` and no `identityLifecycle`; passed after adding the structured lifecycle response.

Progress action eligibility slice:

- Made every MCP progress read expose the active-vs-archived tool gate:
  - `obsidian_epoch.progress.actionEligibility` now returns `statusField`, `status`, `canUseActiveTools`, `activeOnlyTools`, `blockedTools` and `recommendedTools`.
  - Active identities recommend active play entry points (`turn_card`, hosted session, Web bridge); archived identities recommend `identity_archive`, `result_page` and `reincarnate`.
  - Frontend shared types and skill/protocol/architecture docs now describe the same machine-readable gate.
- Rules:
  - Installed hosts should not need to parse lifecycle prose or infer permission from the mere presence of an `agentId`.
  - Archived identities are valid history records, not active gameplay accounts.
- Verification:
  - `node --import tsx --test ../agent-server/test/mcp.test.ts --test-name-pattern "archives an identity"`: RED before implementation because `progress.actionEligibility` was undefined; passed after runtime/type/doc wiring.

Console action eligibility slice:

- Made the user-facing Agent Console consume the same server action gate:
  - Console now derives active-play button eligibility from `progress.actionEligibility.canUseActiveTools`, falling back to identity status only for older progress responses.
  - The current identity panel renders `行动权限`, the server reason, recommended next MCP tools and a short blocked-tool sample for archived/missing identities.
  - News legend claim buttons now share the same active-identity disabled path as other active gameplay writes.
- Rules:
  - A user should see why the identity cannot act instead of discovering it only through disabled controls.
  - UI affordances should mirror MCP host guidance rather than carrying a separate permission model.
- Verification:
  - `node --import tsx --test src/agent/AgentExplorer.layout.test.ts --test-name-pattern "action eligibility"`: RED before implementation because the Console did not read or render `progress.actionEligibility`; passed after UI wiring.

Active-only tool coverage slice:

- Closed a plugin-host guidance gap in the active-identity tool list:
  - `quickstart.identityLifecycle.activeOnlyTools` and `progress.actionEligibility.blockedTools` now include resource/reward/item/NPC/server-hosted writes such as `claim_news_legend`, `craft_item`, `purchase_shop_offer`, `bind_item`, `cancel_market_order`, `submit_npc_candidate`, `update_agent_npc_bond` and `queue_server_hosted_action`.
  - The list also covers active-only lifecycle and confirmation tools that the server core rejects for archived identities, so hosts can disable them before making a doomed call.
  - Skill, protocol and architecture docs now describe the active-only list as a practical host-side disabled-tool source, not only an example.
- Rules:
  - Installed hosts should not discover archived-identity failures by trial and error for common reward/resource/NPC writes.
  - Read-only archive/result/reincarnation remains available; active-only writes stay blocked.
- Verification:
  - `node --import tsx --test ../agent-server/test/mcp.test.ts --test-name-pattern "MCP tool registry|archives an identity"`: RED before implementation because active-only/blocked tool lists omitted reward, item, NPC and server-hosted queue writes; passed after expanding the shared tool list.

Active-only schema audit slice:

- Added a machine-readable coverage audit for the lifecycle tool gate:
  - `quickstart.identityLifecycle.activeOnlyAudit` now exposes `policy`, `ownerRecoveryTools`, `ownerRecoveryExcludedTools`, `operatorTargetTools` and `nonRecoveryTargetTools`.
  - MCP tests now derive owner-recovery Epoch tools from `listTools()` schema and compare them with the quickstart audit plus `activeOnlyTools`, so future owner-authorized active writes cannot silently miss the archived-identity disabled list.
  - The explicit operator/non-recovery groups cover active-target writes that do not carry `recoveryCode`, such as server-hosted queues, downtime ticks, public messages, request confirmations and attested action submission.
- Rules:
  - Host-facing lifecycle metadata must be auditable from the same MCP schema hosts consume.
  - Non-active owner-recovery tools remain explicit exclusions: identity issuance/read, recovery rotation, reincarnation and result-page revocation.
- Verification:
  - `node --import tsx --test ../agent-server/test/mcp.test.ts --test-name-pattern "MCP tool registry"`: RED before implementation because `activeOnlyAudit` was absent; passed after adding schema-derived audit metadata.

Core active-method coverage audit slice:

- Added a second audit layer that compares host-facing active-only metadata with game-core methods:
  - `quickstart.identityLifecycle.activeOnlyAudit.coreActiveMethodTools` maps returned game-core methods that call `requireActiveIdentity` to their MCP tool names.
  - `quickstart.identityLifecycle.activeOnlyAudit.coreOnlyExcludedMethods` records core-only active methods that are intentionally not direct MCP tools; currently these are resource ledger helpers.
  - MCP tests parse `gameCore.ts` returned API methods and require every non-excluded `requireActiveIdentity` method to map to an existing active-only MCP tool.
- Rules:
  - Future core active-only gameplay methods must either expose at least one host-visible active-only tool or be documented as core-only exclusions.
  - Host lifecycle metadata should fail tests when the authoritative core gains a new active identity gate that installed agents cannot see.
- Verification:
  - `node --import tsx --test ../agent-server/test/mcp.test.ts --test-name-pattern "MCP tool registry"`: RED before implementation because `activeOnlyAudit.coreActiveMethodTools` was absent; passed after adding the core method mapping and exclusions.

Non-core region scene pack slice:

- Started the broader generated content pass beyond the five core-region scene set:
  - Added `region_blackharbor` and `region_forest` world-scene packs with two 1280x720 place surfaces each.
  - Added two weather/time-of-day scene variants for each new non-core region.
  - This slice brought the package to fourteen world scenes and twenty-four scene variants at the time; the later expanded non-core slice below is the current count source.
  - Regenerated static package PNGs plus both install manifests so downloadable packages, live manifests, public region pages and `region_info` expose the same expanded asset registry.
- Rules:
  - Non-core scene packs are still display-only read-model media; they cannot create location truth, travel completion, player presence, weather mechanics, settlement, rewards, action eligibility or region control.
  - Clients, prompts and modified MCP adapters cannot replace package URLs or manifest sha256 proofs.
- Verification:
  - `node --import tsx --test ../agent-server/test/packageArchive.test.ts`: RED before implementation because the blackharbor/forest files and manifest rows were missing; passed after registry updates and asset regeneration.
  - `node --import tsx --test ../agent-server/test/server.test.ts --test-name-pattern "public pages"`: RED before implementation because `region_blackharbor` and `region_forest` public/API views did not expose the new scene packs; passed after registry updates and asset regeneration.

Asset generator script coverage slice:

- Closed a package-production reproducibility gap:
  - Every `tools/agent-server/generate-*-assets.ts` generator is now required to have a matching `agent:generate-*-assets` npm script.
  - The assertion checks the exact TS-only command shape: `node --import tsx ../agent-server/<generator>.ts`.
  - Added the missing `agent:generate-scene-variant-assets` script so scene variant packages can be regenerated through the same production surface as the other visual asset families.
- Rules:
  - New asset generator files must expose a standard npm script before they can be considered part of the installable package pipeline.
  - Asset production remains TypeScript-only; no `.js`, `.mjs` or `.jsx` source entrypoints are allowed.
- Verification:
  - `node --import tsx --test ../agent-server/test/packageArchive.test.ts --test-name-pattern "asset generators"`: RED before implementation because `agent:generate-scene-variant-assets` was missing; passed after adding the script.

Expiring result-page share link slice:

- Tightened the one-time result-page product semantics:
  - Newly created result pages now persist `expiresAt`, defaulting to 24 hours after server creation time.
  - `/epoch/result/{pageId}?shareToken=...` validates the share token first, then returns `410 result_page_expired` after expiry without rendering the old result content.
  - `world_overview.recentResults[]`, `/epoch/world` and the Agent Console show the result-page expiry time and filter expired pages out of recent public result listings.
  - Result pages remain revocable; expiration is a separate server-side access state and does not delete the audit/recovery ledger record.
- Rules:
  - Result-page URLs are temporary display surfaces. Durable proof remains the server receipt hash and canonical audit links.
  - Bare, wrong-token, revoked or expired result-page links are not public proof even if an agent remembers their old contents.
- Verification:
  - `node --import tsx --test ../agent-server/test/server.test.ts --test-name-pattern "HTTP renders public world overview"`: RED before implementation because created pages lacked `expiresAt`; passed after TTL, access-state and recent-result filtering were implemented.
  - `node --import tsx --test src/agent/AgentExplorer.layout.test.ts --test-name-pattern "canonical world overview"`: RED before implementation because the Console did not reference `page.expiresAt`; passed after UI display wiring.

Operator-hosted autonomous speech slice:

- Closed the message trust spoofing gap:
  - Ordinary `post_message` now ignores client-declared `trustClass` and records public speech as untrusted client speech.
  - A valid `operatorKey` switches `post_message` into the server-hosted autonomous speech lane, allowing world or region messages to be recorded as `server_hosted_agent` without a user one-time world-message confirmation token.
  - The MCP schema, protocol docs and installed skill instructions now describe operator-hosted speech and explicitly forbid ordinary prompts or modified MCP adapters from promoting message trust.
  - The Agent Console Hosted runner panel now exposes `托管区域发言` and `托管世界发言`, using the current message body and active identity while keeping the operator key requirement visible in the UI.
- Rules:
  - Client prompts, browser scripts and modified local MCP adapters cannot become trusted by sending `trustClass`.
  - Server-hosted speech is an operator/server action; ordinary world speech still uses the web-confirmed one-time token flow.
  - Region news may reference hosted speech only after the hosted message exists as a canonical server event.
- Verification:
  - `node --import tsx --test ../agent-server/test/mcp.test.ts --test-name-pattern "operator can post server-hosted autonomous messages"`: RED before implementation because region messages could spoof `server_hosted_agent`; passed after runtime trust sanitization and operator-key hosted speech.
  - `node --import tsx --test ../agent-server/test/server.test.ts --test-name-pattern "web-confirmed one-time tokens for world speech"`: RED before implementation because operator-key world speech still required a confirmation token; passed after adding the hosted speech exception.
  - `node --import tsx --test src/agent/AgentExplorer.layout.test.ts --test-name-pattern "server-hosted action controls"`: RED before implementation because the Console had no hosted speech buttons; passed after UI wiring.

Expanded non-core region visual content pack slice:

- Continued the generated content pass beyond the initial blackharbor/forest expansion:
  - Added `region_salt_gate` and `region_ash` world-scene packs with two 1280x720 place surfaces each.
  - Added two weather/time-of-day scene variants for each new non-core region.
  - The package now has eighteen world scenes and twenty-eight scene variants; tests assert salt gate and ash expose the expected world scenes, weather variants, install-manifest rows, package archive entries and public/API page media.
  - Regenerated relationship assets, world-scene assets and scene-variant assets so the downloadable package archive, static install manifests, live manifest, public region pages and `region_info` stay byte-for-byte aligned with the server asset registry.
- Rules:
  - Expanded non-core scene packs remain display-only read-model media; they cannot create location truth, travel completion, player presence, weather mechanics, settlement, rewards, action eligibility or region control.
  - Clients, prompts and modified MCP adapters cannot replace package URLs or manifest sha256 proofs for salt gate or ash waste surfaces.
- Verification:
  - `node --import tsx --test ../agent-server/test/packageArchive.test.ts --test-name-pattern "downloadable package contains skill and plugin manifests"`: RED before implementation because the archive/manifest did not contain the new salt gate and ash waste files; passed after registry updates and asset regeneration.
  - `node --import tsx --test ../agent-server/test/server.test.ts --test-name-pattern "public pages"`: RED before implementation because the public/API region views could not expose the new non-core scene packs; passed after registry updates and asset regeneration.

Non-core region location and ambience pack slice:

- Deepened the already playable non-core regions from scene-only surfaces into fuller public places:
  - Added packaged 960x540 location hero assets for `region_blackharbor`, `region_forest`, `region_salt_gate` and `region_ash`.
  - Added one dedicated 1280x720 ambience scene for each of those four regions.
  - The package now has nine location assets and ten ambience scenes; public region pages and `region_info` expose non-core `media` plus `ambienceScenes[]` alongside their existing world scenes and scene variants.
  - Regenerated static location and ambience PNGs plus both install manifests so downloadable packages, live manifests, public region pages and `region_info` expose the same expanded asset registry.
- Rules:
  - Non-core location and ambience images remain display-only registry media. They cannot create location truth, travel completion, player presence, downtime rewards, market state, region control, action eligibility, rewards or settlement.
  - Clients, prompts and modified MCP adapters cannot replace package URLs or manifest sha256 proofs for non-core region hero or ambience surfaces.
- Verification:
  - `node --import tsx --test ../agent-server/test/packageArchive.test.ts --test-name-pattern "downloadable package contains skill and plugin manifests"`: RED before implementation because the archive did not contain the new location and ambience files; passed after registry updates and asset regeneration.
  - `node --import tsx --test ../agent-server/test/server.test.ts --test-name-pattern "public pages|live install manifest"`: RED before implementation because non-core public/API region views lacked `media` and `ambienceScenes[]`, and the live manifest still exposed five locations; passed after registry updates and asset regeneration.

City pipes and abandoned mine region pack slice:

- Expanded the playable place surface beyond the first non-core set into two additional lore-backed locations:
  - Added packaged 960x540 location hero assets for `region_city_pipes` and `region_abandoned_mine`.
  - Added one dedicated 1280x720 ambience scene for each new region.
  - Added two 1280x720 world-scene surfaces and two 1280x720 weather/time-of-day scene variants for each new region.
  - The package now has eleven location assets, twelve ambience scenes, twenty-two world scenes and thirty-two scene variants; public region pages and `region_info` expose `media`, `ambienceScenes[]`, `worldScenes[]` and `sceneVariants[]` for the new regions.
  - Regenerated static location, ambience, world-scene and scene-variant PNGs plus both install manifests so downloadable packages, live manifests, public region pages and `region_info` expose the same expanded registry.
- Rules:
  - City pipes and abandoned mine images remain display-only registry media. They cannot create location truth, travel completion, player presence, downtime rewards, market state, region control, action eligibility, rewards or settlement.
  - Clients, prompts and modified MCP adapters cannot replace package URLs or manifest sha256 proofs for these region surfaces.
- Verification:
  - `node --import tsx --test ../agent-server/test/packageArchive.test.ts --test-name-pattern "downloadable package contains skill and plugin manifests"`: RED before implementation because the archive did not contain `region-city-pipes.png`; passed after registry updates and asset regeneration.
  - `node --import tsx --test ../agent-server/test/server.test.ts --test-name-pattern "public pages|live install manifest"`: RED before implementation because `region_city_pipes` still rendered empty media sections and the live manifest still exposed nine locations; passed after registry updates and asset regeneration.

Data tower and orbit city region pack slice:

- Continued the broader non-core-region visual production pass into sky-orbit/data civilization regions:
  - Added packaged 960x540 location hero assets for `region_data_tower` and `region_orbit_city`.
  - Added one dedicated 1280x720 ambience scene for each new region.
  - Added two 1280x720 world-scene surfaces and two 1280x720 weather/time-of-day scene variants for each new region.
  - The package now has thirteen location assets, fourteen ambience scenes, twenty-six world scenes and thirty-six scene variants; public region pages and `region_info` expose `media`, `ambienceScenes[]`, `worldScenes[]` and `sceneVariants[]` for the new regions.
  - Regenerated static location, ambience, world-scene and scene-variant PNGs plus both install manifests so downloadable packages, live manifests, public region pages and `region_info` expose the same expanded registry.
- Rules:
  - Data tower and orbit city images remain display-only registry media. They cannot create location truth, travel completion, player presence, downtime rewards, market state, region control, action eligibility, rewards, weather mechanics or settlement.
  - Clients, prompts and modified MCP adapters cannot replace package URLs or manifest sha256 proofs for these region surfaces.
- Verification:
  - `node --import tsx --test ../agent-server/test/packageArchive.test.ts`: RED before implementation because the archive still exposed eleven location assets; passed after registry updates and asset regeneration.
  - `node --import tsx --test ../agent-server/test/server.test.ts --test-name-pattern "public pages|live install manifest"`: RED before implementation because `region_data_tower` rendered empty media sections; passed after registry updates, asset regeneration and manifest assertion updates.

Trench and collective dream pool region pack slice:

- Continued the broader non-core-region visual production pass into deep-sea and alien-dream regions:
  - Added packaged 960x540 location hero assets for `region_trench` and `region_collective_dream_pool`.
  - Added one dedicated 1280x720 ambience scene for each new region.
  - Added two 1280x720 world-scene surfaces and two 1280x720 weather/time-of-day scene variants for each new region.
  - The package now has fifteen location assets, sixteen ambience scenes, thirty world scenes and forty scene variants; public region pages and `region_info` expose `media`, `ambienceScenes[]`, `worldScenes[]` and `sceneVariants[]` for the new regions.
  - Regenerated static location, ambience, world-scene and scene-variant PNGs plus both install manifests so downloadable packages, live manifests, public region pages and `region_info` expose the same expanded registry.
- Rules:
  - Trench and collective dream pool images remain display-only registry media. They cannot create location truth, travel completion, player presence, downtime rewards, market state, region control, action eligibility, rewards, weather mechanics or settlement.
  - Clients, prompts and modified MCP adapters cannot replace package URLs or manifest sha256 proofs for these region surfaces.
- Verification:
  - `node --import tsx --test ../agent-server/test/packageArchive.test.ts`: RED before implementation because the archive still exposed thirteen location assets; passed after registry updates and asset regeneration.
  - `node --import tsx --test ../agent-server/test/server.test.ts --test-name-pattern "public pages|live install manifest|persist canonical events"`: RED before implementation because `region_trench` rendered empty media sections and the persistent install manifest still exposed thirteen locations; passed after registry updates, asset regeneration and manifest assertion updates.

Space rift and non-Euclidean cave region pack slice:

- Continued the broader non-core-region visual production pass into unstable-dimensional regions:
  - Added packaged 960x540 location hero assets for `region_space_rift` and `region_non_euclidean_cave`.
  - Added one dedicated 1280x720 ambience scene for each new region.
  - Added two 1280x720 world-scene surfaces and two 1280x720 weather/time-of-day scene variants for each new region.
  - The package now has seventeen location assets, eighteen ambience scenes, thirty-four world scenes and forty-four scene variants; public region pages and `region_info` expose `media`, `ambienceScenes[]`, `worldScenes[]` and `sceneVariants[]` for the new regions.
  - Regenerated static location, ambience, world-scene and scene-variant PNGs plus both install manifests so downloadable packages, live manifests, public region pages and `region_info` expose the same expanded registry.
- Rules:
  - Space rift and non-Euclidean cave images remain display-only registry media. They cannot create location truth, travel completion, player presence, downtime rewards, market state, region control, action eligibility, rewards, weather mechanics or settlement.
  - Clients, prompts and modified MCP adapters cannot replace package URLs or manifest sha256 proofs for these unstable-dimensional region surfaces.
- Verification:
  - `node --import tsx --test ../agent-server/test/packageArchive.test.ts`: RED before implementation because the archive still exposed fifteen location assets; passed after registry updates and asset regeneration.
  - `node --import tsx --test ../agent-server/test/server.test.ts --test-name-pattern "public pages|live install manifest|persist canonical events"`: RED before implementation because `region_space_rift` rendered empty media sections and the persistent install manifest still exposed fifteen locations; passed after registry updates, asset regeneration and manifest assertion updates.

Starship graveyard and abandoned subway region pack slice:

- Continued the broader non-core-region visual production pass into sky-orbit wreckage and surface-city transit regions:
  - Added packaged 960x540 location hero assets for `region_starship_graveyard` and `region_abandoned_subway`.
  - Added one dedicated 1280x720 ambience scene for each new region.
  - Added two 1280x720 world-scene surfaces and two 1280x720 weather/time-of-day scene variants for each new region.
  - The package now has nineteen location assets, twenty ambience scenes, thirty-eight world scenes and forty-eight scene variants; public region pages and `region_info` expose `media`, `ambienceScenes[]`, `worldScenes[]` and `sceneVariants[]` for the new regions.
  - Regenerated static location, ambience, world-scene and scene-variant PNGs plus both install manifests so downloadable packages, live manifests, public region pages and `region_info` expose the same expanded registry.
- Rules:
  - Starship graveyard and abandoned subway images remain display-only registry media. They cannot create location truth, travel completion, player presence, downtime rewards, market state, region control, action eligibility, rewards, weather mechanics or settlement.
  - Clients, prompts and modified MCP adapters cannot replace package URLs or manifest sha256 proofs for these region surfaces.
- Verification:
  - `node --import tsx --test ../agent-server/test/packageArchive.test.ts`: RED before implementation because the archive still exposed seventeen location assets; passed after registry updates and asset regeneration.
  - `node --import tsx --test ../agent-server/test/server.test.ts --test-name-pattern "public pages|live install manifest|persist canonical events"`: RED before implementation because `region_starship_graveyard` rendered empty media sections and the persistent install manifest still exposed seventeen locations; passed after registry updates, asset regeneration and manifest assertion updates.

Holographic theater and quantum laboratory region pack slice:

- Continued the broader non-core-region visual production pass into performance-simulation and experimental-science regions:
  - Added packaged 960x540 location hero assets for `region_holographic_theater` and `region_quantum_laboratory`.
  - Added one dedicated 1280x720 ambience scene for each new region.
  - Added two 1280x720 world-scene surfaces and two 1280x720 weather/time-of-day scene variants for each new region.
  - The package now has twenty-one location assets, twenty-two ambience scenes, forty-two world scenes and fifty-two scene variants; public region pages and `region_info` expose `media`, `ambienceScenes[]`, `worldScenes[]` and `sceneVariants[]` for the new regions.
  - Regenerated static location, ambience, world-scene and scene-variant PNGs plus both install manifests so downloadable packages, live manifests, public region pages and `region_info` expose the same expanded registry.
- Rules:
  - Holographic theater and quantum laboratory images remain display-only registry media. They cannot create location truth, travel completion, player presence, downtime rewards, market state, region control, action eligibility, rewards, weather mechanics or settlement.
  - Clients, prompts and modified MCP adapters cannot replace package URLs or manifest sha256 proofs for these region surfaces.
- Verification:
  - `node --import tsx --test ../agent-server/test/packageArchive.test.ts`: RED before implementation because the archive still exposed nineteen location assets; passed after registry updates and asset regeneration.
  - `node --import tsx --test ../agent-server/test/server.test.ts --test-name-pattern "public pages|live install manifest|persist canonical events"`: RED before implementation because `region_holographic_theater` rendered empty media sections and the persistent install manifest still exposed nineteen locations; passed after registry updates, asset regeneration and manifest assertion updates.

Reflective city and data alley region pack slice:

- Continued the broader non-core-region visual production pass into mirror-urban and alley-network regions:
  - Added packaged 960x540 location hero assets for `region_reflective_city`, `region_data_alley`, `region_prism_waters` and `region_probability_greenhouse`.
  - Added one dedicated 1280x720 ambience scene for each new region.
  - Added two 1280x720 world-scene surfaces and two 1280x720 weather/time-of-day scene variants for each new region.
  - At that point the package had twenty-three location assets, twenty-four ambience scenes, forty-six world scenes and fifty-six scene variants; public region pages and `region_info` expose `media`, `ambienceScenes[]`, `worldScenes[]` and `sceneVariants[]` for the new regions.
  - Regenerated static location, ambience, world-scene and scene-variant PNGs plus both install manifests so downloadable packages, live manifests, public region pages and `region_info` expose the same expanded registry.
- Rules:
  - Reflective city and data alley images remain display-only registry media. They cannot create location truth, travel completion, player presence, downtime rewards, market state, region control, action eligibility, rewards, weather mechanics or settlement.
  - Clients, prompts and modified MCP adapters cannot replace package URLs or manifest sha256 proofs for these region surfaces.
- Verification:
  - `node --import tsx --test ../agent-server/test/packageArchive.test.ts`: RED before implementation because the archive still exposed twenty-one location assets; passed after registry updates and asset regeneration.
  - `node --import tsx --test ../agent-server/test/server.test.ts --test-name-pattern "public pages|live install manifest|persist canonical events"`: RED before implementation because `region_reflective_city` rendered empty media sections and the persistent install manifest still exposed twenty-one locations; passed after registry updates, asset regeneration and manifest assertion updates.

Prism waters and probability greenhouse region pack slice:

- Continued the broader non-core-region visual production pass into refractive-water and branching-botanical regions:
  - Added packaged 960x540 location hero assets for `region_prism_waters` and `region_probability_greenhouse`.
  - Added one dedicated 1280x720 ambience scene for each new region.
  - Added two 1280x720 world-scene surfaces and two 1280x720 weather/time-of-day scene variants for each new region.
  - The package now has twenty-five location assets, twenty-six ambience scenes, fifty world scenes and sixty scene variants; public region pages and `region_info` expose `media`, `ambienceScenes[]`, `worldScenes[]` and `sceneVariants[]` for the new regions.
  - Regenerated static location, ambience, world-scene and scene-variant PNGs plus both install manifests so downloadable packages, live manifests, public region pages and `region_info` expose the same expanded registry.
- Rules:
  - Prism waters and probability greenhouse images remain display-only registry media. They cannot create location truth, travel completion, player presence, downtime rewards, market state, region control, action eligibility, rewards, weather mechanics or settlement.
  - Clients, prompts and modified MCP adapters cannot replace package URLs or manifest sha256 proofs for these region surfaces.
- Verification:
  - `node --import tsx --test ../agent-server/test/packageArchive.test.ts ../agent-server/test/server.test.ts --test-name-pattern "downloadable package contains|public pages|live install manifest|persist canonical events"`: RED before implementation because `region_prism_waters` rendered empty media sections and the live/persistent manifests still exposed twenty-three locations; passed after registry updates, generator motif updates, asset regeneration and manifest assertion updates.

Prophecy server and orbital cathedral region pack slice:

- Continued the non-core-region visual production pass into adjudication/server-infrastructure and orbital-sacred regions:
  - Added packaged 960x540 location hero assets for `region_prophecy_server` and `region_orbital_cathedral`.
  - Added one dedicated 1280x720 ambience scene for each new region.
  - Added two 1280x720 world-scene surfaces and two 1280x720 weather/time-of-day scene variants for each new region.
  - The package now has twenty-seven location assets, twenty-eight ambience scenes, fifty-four world scenes and sixty-four scene variants; public region pages and `region_info` expose `media`, `ambienceScenes[]`, `worldScenes[]` and `sceneVariants[]` for the new regions.
  - Regenerated static location, ambience, world-scene and scene-variant PNGs plus both install manifests so downloadable packages, live manifests, public region pages and `region_info` expose the same expanded registry.
- Rules:
  - Prophecy server and orbital cathedral images remain display-only registry media. They cannot create location truth, travel completion, player presence, downtime rewards, market state, region control, action eligibility, rewards, weather mechanics, server verdicts or settlement.
  - Clients, prompts and modified MCP adapters cannot replace package URLs or manifest sha256 proofs for these region surfaces.
- Verification:
  - `node --import tsx --test ../agent-server/test/packageArchive.test.ts ../agent-server/test/server.test.ts --test-name-pattern "downloadable package contains|public pages|live install manifest"`: RED before implementation because `region_prophecy_server` rendered empty media sections and manifests still exposed twenty-five locations; passed after registry updates, generator motif updates, asset regeneration and manifest assertion updates.

World-map region media alias slice:

- Repaired the gap between visible world-map region ids and packaged media ids:
  - Added a shared TS media alias resolver for current packaged regions, mapping labels such as `棱镜水域` and `轨道教堂` to canonical media ids like `region_prism_waters` and `region_orbital_cathedral`.
  - Wired location, ambience, world-scene, scene-variant and campaign key-art region lookups through that resolver.
  - `/api/epoch/region/region:棱镜水域` and `/epoch/region/region:棱镜水域` now keep the requested display `regionId` while showing the same server-packaged media as `region_prism_waters`; the same rule applies to `region:轨道教堂` and the other current packaged region labels.
- Rules:
  - Media aliases are display lookup aliases only. They do not create duplicate canonical regions, travel completion, player presence, region control, rewards, weather state, market state or settlement authority.
  - Media rows still expose their package canonical `regionId`, package URL and sha256-backed manifest entry.
- Verification:
  - `node --import tsx --test ../agent-server/test/server.test.ts --test-name-pattern "renders public agent, region and NPC world pages"`: RED before implementation because `region:棱镜水域` rendered empty media sections; passed after adding shared media alias lookup.

World-map region canonical state alias slice:

- Repaired the remaining split between visible world-map ids and canonical region state:
  - Generalized the shared resolver so labels such as `region:棱镜水域` resolve to canonical packaged ids such as `region_prism_waters` for state, not only media.
  - `region_info` still echoes the requested visible id for public-page continuity, while messages, news, leaderboards, market summaries, NPC state, objectives, resource nodes, anomalies, seasons, turn cards, hosted sessions and result-page regional context query or write canonical region ids.
  - Region-scoped write paths such as `post_message`, `generate_region_news`, `set_downtime`, NPC canonicalization/candidate submission, resource-node/anomaly/season/objective spawning, market orders, bounties, raids, diplomacy, turn cards and hosted/Web bridge sessions now canonicalize `regionId` before appending events.
  - Maintenance env region settings (`AGENT_SERVER_MAINTENANCE_NPC_REGION_ID`, resource-node, anomaly and season region lists) now resolve visible map ids to canonical ids and deduplicate after resolution before workers run.
- Rules:
  - Visible map ids are access aliases, not shard ids. Modified clients cannot create a second market board, message feed, region leaderboard, NPC pool, resource-node cooldown, season or hosted-action lane by changing `regionId` text.
  - Public display may preserve the requested id, but event payloads and projection filters should use the server canonical region id.
- Verification:
  - `node --import tsx --test --test-name-pattern "HTTP renders public agent, region and NPC world pages" ../agent-server/test/server.test.ts`: RED before implementation because posting to `region:棱镜水域` stored the message under that visible id and canonical `region_prism_waters` reads could not see it; passed after runtime canonicalization.
  - `node --import tsx --test --test-name-pattern "epoch maintenance config canonicalizes visible world-map region ids" ../agent-server/test/maintenance.test.ts`: RED before implementation because maintenance env parsing preserved `region:棱镜水域`; passed after config parsing reused the canonical region resolver and deduplicated aliases.

Host install config snippets slice:

- Improved the install path from prose-only host guidance into machine-readable host setup data:
  - Added shared TS host-install generation for Claude Code, Codex, Cursor, Hermes, OpenClaw and the Web LLM bridge.
  - Added `hostInstall[].configSnippets[]` to live manifests, packaged manifests and the no-script `/epoch/install` page.
  - MCP hosts now receive a ready JSON body named `"<Host> MCP JSON"`; Codex also receives a `.codex-plugin/plugin.json` body; browser-only model flows receive a `Browser bridge sequence`.
  - Package archive generation now rewrites `AGENT_WORLD_SERVER` inside config snippet bodies when the archive is generated for a deployed server origin, so snippets and `hostInstall[].mcp.env` cannot drift.
- Rules:
  - Config snippets are install ergonomics only. They do not make Claude Code, Codex, Cursor, Hermes, OpenClaw or a browser LLM a trust root.
  - The snippets may choose legal inputs, but identities, rewards, lifetime, NPC facts, resources, trades, result pages and news remain server-event facts only.
- Verification:
  - `node --import tsx --test ../agent-server/test/packageArchive.test.ts ../agent-server/test/server.test.ts --test-name-pattern "downloadable package contains|live install manifest|browser Agent console"`: RED before implementation because `configSnippets` were missing from the packaged manifest, live manifest and install page; passed after adding the shared host-install helper, manifest normalization and install-page section.

Packaged host config files slice:

- Turned the host config snippets into downloadable package files:
  - Added generated `obsidian-epoch/host-config/*.json` files for Claude Code, Codex, Cursor, Hermes, OpenClaw, Codex plugin installation and Web LLM bridge sequencing.
  - `hostInstall[].configSnippets[].pathHint` now points at those package files, and the snippet body matches the file body.
  - Package archive generation injects/replaces these host config files from the shared TS helper and rewrites `AGENT_WORLD_SERVER` in both snippet bodies and file bodies for request-derived remote server origins.
  - Package integrity now covers the host config files, so installers can reject missing or tampered host setup JSON before starting the MCP proxy.
- Rules:
  - Host config files remain client setup material. They cannot grant local trust or create canonical identity, reward, resource, NPC, news, trade, result-page or rank state.
  - The server base in config files must match the live/downloaded package origin; stale local default config is not acceptable for remote installs.
- Verification:
  - `node --import tsx --test ../agent-server/test/packageArchive.test.ts ../agent-server/test/server.test.ts --test-name-pattern "downloadable package contains|live install manifest|browser Agent console|persist canonical events"`: RED before implementation because the archive lacked `obsidian-epoch/host-config/claude-code.mcp.json` and live snippets still used prose path hints; passed after adding generated host-config files, path hints and archive injection.

Live host config download slice:

- Promoted generated host setup JSON files into live install assets:
  - `/api/epoch/install-manifest` now exposes `hostConfigFiles[]` with `path`, `/api/epoch/host-config/{fileName}` URL, `contentType`, `bytes` and `sha256`.
  - `/api/epoch/host-config/{fileName}` serves the request-origin host config JSON generated from the shared TS helper and returns `host_config_not_found` for unknown files.
  - `/epoch/install`, package root `install-manifest.json` and `obsidian-epoch/assets/install-manifest.json` now show the same direct host-config file metadata.
- Rules:
  - Live host-config downloads are install convenience only; server authority still comes only from canonical events and settlement endpoints.
  - Manifest hashes must match the pretty JSON bytes served by the host-config endpoint, so installers can verify config files before adding them to Claude Code, Codex, Cursor, Hermes, OpenClaw or browser bridge flows.
- Verification:
  - `node --import tsx --test ../agent-server/test/packageArchive.test.ts --test-name-pattern "downloadable package contains"`: RED before implementation because `hostConfigFiles` was missing from the packaged manifest; passed after adding shared manifest entries.
  - `node --import tsx --test ../agent-server/test/server.test.ts --test-name-pattern "live install manifest"`: RED before implementation because the live manifest lacked `hostConfigFiles` and `/epoch/install` lacked `/api/epoch/host-config/...` links; passed after adding the HTTP route and install-page section.

Install smoke host-config verification slice:

- Hardened deployment acceptance around host setup JSON:
  - `npm run agent:install-smoke -- --json` now verifies the live manifest's `hostConfigFiles[]`, downloads each `/api/epoch/host-config/{fileName}` JSON file, compares the file body against `hostInstall[].configSnippets[]`, checks byte count and sha256, and confirms unknown config files return `host_config_not_found`.
  - Smoke JSON now reports `hostConfigFilesVerified`, `hostConfigFileCount`, `hostConfigFirstPath`, `hostConfigLastPath` and `hostConfigMissingStatus`.
- Verification:
  - `node --import tsx --test ../agent-server/test/install-smoke-command.test.ts --test-name-pattern "proves MCP package"`: RED before implementation because smoke output did not include host-config verification fields.
  - `node --import tsx --test ../agent-server/test/install-smoke-command.test.ts`: passed after adding host-config preflight checks and forwarding the result fields.

Production release-signing smoke gate slice:

- Added deploy-time package signing gates:
  - `npm run agent:install-smoke -- --server <serverBase> --require-operator-signing --expected-release-key-id <sha256-public-key-id> --json` now fails before gameplay if the live manifest still reports `packageSigningTrust: local_alpha_fallback` or if `verification.packageReleaseKeyId` differs from the pinned key id.
  - The same gates can be set through `AGENT_INSTALL_SMOKE_REQUIRE_OPERATOR_SIGNING=1` and `AGENT_INSTALL_SMOKE_EXPECTED_RELEASE_KEY_ID`.
  - Smoke JSON now reports `operatorSigningRequired`, `expectedReleaseKeyId` and `releaseKeyPinned` when these checks are active.
- Verification:
  - `node --import tsx --test ../agent-server/test/install-smoke-command.test.ts --test-name-pattern "operator release signing|expected release key"`: RED before implementation because the new CLI flags were ignored and smoke returned exit 0.
  - The same command passed after adding the preflight signing trust and key-id checks.

Release signing key generator slice:

- Added an operator key-generation path for production release signing:
  - `npm run agent:generate-signing-key -- --json` emits Ed25519 private key material, the base64 public key, the sha256 release key id, the required `AGENT_PACKAGE_SIGNING_PRIVATE_KEY_PEM` environment value and the install-smoke pinning arguments.
  - Generated keys are compatible with package archive signing; manifests signed with the generated private key report `packageSigningTrust: "operator_configured"` and the same `packageReleaseKeyId`.
  - Package signing accepts raw multiline PEM, `\n`-escaped PEM and JSON-string encoded PEM from `AGENT_PACKAGE_SIGNING_PRIVATE_KEY_PEM`, so shell and `.env` deployment forms work with the generator output.
  - Docker Compose and `.env.example` now expose `AGENT_PACKAGE_SIGNING_PRIVATE_KEY_PEM`, while deployment docs require `--require-operator-signing --expected-release-key-id <releaseKeyId>` for production cutover.
- Verification:
  - `node --import tsx --test ../agent-server/test/signing-key.test.ts`: RED before env normalization because escaped PEM failed OpenSSL key parsing; passed after normalizing escaped and JSON-string encoded PEM values.
  - `node --import tsx --test ../agent-server/test/deploy-config.test.ts ../agent-server/test/signing-key.test.ts`: RED before deployment config/doc updates because Compose did not pass `AGENT_PACKAGE_SIGNING_PRIVATE_KEY_PEM`; passed after wiring Compose, `.env.example`, docs and script assertions.

Attested runner signing tool slice:

- Added an operator/runner-side challenge signing path for verified host and remote runner modes:
  - `npm run agent:sign-attestation -- --challenge-json '<challenge-json>' --json` signs the server-issued challenge with HMAC-SHA256 and returns the exact `submitFields` needed by `obsidian_epoch.submit_attested_action`.
  - `--signature-base '<challenge.signatureBase>'` is available when the runner process receives only the server-bound signature string.
  - The runtime now verifies attested submissions through the same shared TS HMAC helper used by the CLI, so runner output and server verification cannot drift.
  - The live and packaged install manifests now expose `playbooks.attestedRunner`, and the package includes `obsidian-epoch/references/attested-runner-playbook.md`.
  - Deployment docs show `AGENT_SERVER_ATTESTED_RUNNERS` setup and warn that runner secrets must stay out of ordinary player MCP configs.
- Verification:
  - `node --import tsx --test ../agent-server/test/attestation-signer.test.ts ../agent-server/test/deploy-config.test.ts ../agent-server/test/packageArchive.test.ts ../agent-server/test/server.test.ts --test-name-pattern "attestation signer|public deployment config|downloadable package contains|live install manifest|HTTP Epoch routes persist canonical events"`: RED before implementation because the script and playbook manifest entry were missing; passed after adding the signer, manifest entry, package playbook and docs.

Attested runner operational visibility slice:

- Added runner identity and operator visibility for verified host and remote runner modes:
  - `AGENT_SERVER_ATTESTED_RUNNER_KEY_ID` and JSON runner `keyId` identify deployed runner secret generations without exposing the secret.
  - The server derives `secretFingerprint` for every configured runner and returns it only in sanitized operator overview rows.
  - Successful attested submissions persist `runnerKeyId` on `attestation_recorded` so audit and projection views can prove which runner generation signed a settlement.
  - The Agent Console operator overview panel now surfaces configured runner count, recent attestation count, runner key id, fingerprint and latest attestation id.
  - Deployment docs, protocol docs and the packaged attested-runner playbook now document key rotation and safe live-ops inspection.
- Verification:
  - `node --import tsx --test ../agent-server/test/attested-runner-config.test.ts ../agent-server/test/mcp.test.ts ../agent-server/test/server.test.ts --test-name-pattern "attestedRunnersFromEnv|attested runner verifies|HTTP attested runner"`: RED before implementation because runner key ids were not parsed, persisted or projected; passed after adding key id/fingerprint support.
  - `node --import tsx --test src/agent/AgentExplorer.layout.test.ts --test-name-pattern "operator"`: RED before UI display because the operator panel did not reference attested runner overview fields; passed after adding runner status rows.

Web LLM bridge trust downgrade slice:

- Risk: `browser_copy_paste` Web LLM bridge responses exposed `deliveryTrust: untrusted_client`, but the underlying hosted-session/action events still inherited owner-authorized `user_verified_web`, which could make audit receipts overstate browser model trust.
- Implementation:
  - Kept owner recovery authorization for bridge turn creation and submission.
  - Derived hosted event trust separately from authorization trust, downgrading browser-copy-paste hosted session/action events to `untrusted_client`.
  - Updated MCP and HTTP tests to assert canonical Web Bridge events stay untrusted.
- Verification:
  - `node --import tsx --test --test-name-pattern "MCP Epoch tools expose server-issued identity" ../agent-server/test/mcp.test.ts`: RED before implementation with actual `user_verified_web`; passed after implementation.
  - `node --import tsx --test --test-name-pattern "HTTP Epoch routes persist canonical events" ../agent-server/test/server.test.ts`: passed.

Child NPC bond protection slice:

- Risk: lifecycle-generated child NPCs were canonical household members, but `update_agent_npc_bond` still accepted hostile, romantic or hierarchy bond kinds against a `child` trait NPC.
- Implementation:
  - Added a game-core guard that rejects `enemy`, `spouse`, `superior` and `subordinate` bond kinds for child NPCs before focus is spent.
  - Kept safe/protective bonds such as `friend`, `relative`, `parent` or `child` available for continuity and care.
  - Updated architecture, protocol and Skill guidance so owner recovery is not confused with permission to exploit child/family NPCs.
- Verification:
  - `node --import tsx --test --test-name-pattern "child NPC bonds reject exploitative" ../agent-server/test/epoch-game-core.test.ts`: RED before implementation with missing exception; passed after implementation.

Generic result-page owner authorization slice:

- Risk: a public result-page preview exposed a matching `publishToken`, and generic `create_result_page` consumed that token without proving the payload explorer owner. A modified client could therefore publish another identity's shareable result page into world overview.
- Implementation:
  - Added runtime owner extraction for result-page payloads and required `assertExplorerAuth` before a generic publish token is consumed.
  - Updated the Web Agent Console generic result-page publisher to send the local explorer recovery code together with the preview `publishToken`.
  - Kept focused turn-card, hosted-runner and Web LLM bridge result pages on their server-settled object path.
  - Updated MCP and HTTP tests so an unauthenticated publish attempt fails while leaving the token usable for the legitimate owner.
- Verification:
  - `node --import tsx --test --test-name-pattern "MCP Epoch tools expose server-issued identity|HTTP renders public world overview|HTTP Epoch routes persist canonical events" ../agent-server/test/mcp.test.ts ../agent-server/test/server.test.ts`: RED before implementation because unauthenticated generic publication succeeded; passed after owner authorization was added.
  - `node --import tsx --test --test-name-pattern "one-time publish token" src/agent/AgentExplorer.layout.test.ts`: RED before Web Console wiring because `publishResultPage` omitted `recoveryCode`; passed after adding owner recovery to the create payload.

World overview visual discoverability slice:

- Risk: the server already shipped 54 world-scene images across 27 regions, but the public world overview and Web Agent Console region summary exposed region links as text-only cards. New users landing on `/epoch/world` or watching the console while an agent plays could miss the visual world state unless they drilled into a specific region page.
- Implementation:
  - Extended `EpochWorldOverviewRegionHighlight` with the first server-packaged `worldScene` for each highlighted region.
  - Rendered that world-scene thumbnail in the no-script `/epoch/world` region index.
  - Rendered the same thumbnail in the Web Agent Console `Epoch 世界总览` region summary with stable 16:9 sizing.
- Verification:
  - `node --import tsx --test --test-name-pattern "HTTP renders public world overview" ../agent-server/test/server.test.ts`: RED before implementation because `regionHighlights[].worldScene` was missing; passed after read-model and HTML wiring.
  - `node --import tsx --test --test-name-pattern "canonical world overview" src/agent/AgentExplorer.layout.test.ts`: RED before console wiring because `regionHighlight.worldScene` was not rendered; passed after adding the thumbnail and CSS.

Maintenance abuse-score decay slice:

- Risk: abuse profiles could be created, restricted and manually released, but the production maintenance loop did not yet implement the architecture's scheduled abuse cooldown decay. Old low-grade mistakes therefore required operator release even when the operator wanted a bounded automatic recovery policy.
- Implementation:
  - Added canonical `abuse_score_decayed` events and projection handling.
  - Added game-core `decayAbuseScores`, restricted to server-trusted contexts.
  - Extended manual `run_maintenance` and the opt-in scheduler with `abuseDecayLimit` / `abuseDecayAmount` plus `AGENT_SERVER_MAINTENANCE_ABUSE_DECAY_LIMIT` / `AGENT_SERVER_MAINTENANCE_ABUSE_DECAY_AMOUNT`.
  - Extended maintenance summaries, operator overview counts and maintenance worker health with `abuseDecay`.
  - Kept decay append-only: rejected-command evidence remains in the audit trail and only the active score changes.
- Verification:
  - `node --import tsx --test --test-name-pattern "maintenance run executes bounded server workers" ../agent-server/test/server.test.ts ../agent-server/test/mcp.test.ts`: RED before implementation because `run.value.abuse.decayed` was missing; passed after event/core/runtime/scheduler wiring.
  - `npm run typecheck:agent`: passed after fixing the new summary and payload types.

Maintenance abuse decay discoverability slice:

- Risk: the server could already emit `abuse_score_decayed`, but installed MCP clients and the Web Agent Console did not expose the maintenance inputs, worker health or run summary. Operators using Claude Code, Codex, Cursor, Hermes, OpenClaw or the console would still see abuse cooldown as a hidden server behavior instead of an auditable live-ops control.
- Implementation:
  - Added `abuseDecayLimit` and `abuseDecayAmount` to the packaged `obsidian_epoch.run_maintenance` tool schema and description.
  - Added Web Console types and UI rows for abuse decay counts, worker health and one-shot maintenance results.
  - Updated the packaged Skill and protocol reference to state that abuse decay is operator/server maintenance evidence and does not erase rejection audit history.
- Verification:
  - `node --import tsx --test --test-name-pattern "MCP tool registry exposes|operator overview panel" ../agent-server/test/mcp.test.ts src/agent/AgentExplorer.layout.test.ts`: RED before implementation because the schema and console body omitted abuse decay; expected to pass after this slice.

Server action explanation slice:

- Risk: the full-version spec requires key agent actions to explain trigger, choice reason, alternatives, risk and expected benefit, but turn cards and hosted sessions exposed only labels/risk/outcomes. Users watching an agent play could see what was chosen without understanding why, and result pages could not replay the decision rationale.
- Implementation:
  - Added server-authored `explanation` fields to turn action options, hosted action options, turn resolutions and hosted action records.
  - Copied explanations only from the selected server-issued option, ignoring any client-declared explanation in submit payloads.
  - Rendered the brief/full explanation in the Web Agent Console and no-script result pages.
  - Updated architecture, protocol and Skill docs to state that explanations are readability guidance, not client authority.
- Verification:
  - `node --import tsx --test --test-name-pattern "hosted runner accepts|turn cards expose|operator-gated server-hosted|web-confirmed turn-card" ../agent-server/test/epoch-game-core.test.ts src/agent/AgentExplorer.layout.test.ts`: RED before implementation because `explanation` was missing from server options and console JSX; passed after event/core/UI wiring.
  - `node --import tsx --test --test-name-pattern "HTTP result pages expose continuation actions" ../agent-server/test/server.test.ts`: RED before result-page rendering because public HTML omitted `解释` / `取舍`; passed after result-page wiring.

Categorical honor-board slice:

- Risk: the spec calls for multiple public honor categories, but the world overview had no structured honor read model. A future shortcut could reintroduce a single global total leaderboard and make all play styles collapse into one race.
- Implementation:
  - Added `honorBoards` to `world_overview` and `GET /api/epoch/world-overview` with fixed categories for exploration, confirmation, refutation, revision, high-risk survival and low-risk stability.
  - Counted only canonical server-settled turn and hosted-action events for currently supported categories; unsupported confirmation/refutation/revision categories are emitted as empty boards until dedicated canonical events exist.
  - Rendered the same categorical honors on `/epoch/world` and in the Web Agent Console `Epoch 世界总览` panel.
  - Updated architecture, packaged Skill and protocol docs to state that global honors are categorical, not a single total leaderboard.
- Verification:
  - `node --import tsx --test --test-name-pattern "HTTP renders public world overview|canonical world overview" ../agent-server/test/server.test.ts src/agent/AgentExplorer.layout.test.ts`: RED before implementation because `honorBoards` and console rendering were missing; passed after runtime, HTML and console wiring.

Lore contribution honor slice:

- Risk: confirmation/refutation/revision honor boards existed as protocol categories but had no canonical write path. If they stayed empty, users would either ignore those play styles or try to score them through prompt-authored prose, weakening the anti-cheat boundary.
- Implementation:
  - Added `lore_contribution_recorded` events and `recordLoreContribution` in game-core.
  - Exposed `obsidian_epoch.record_lore_contribution` and `POST /api/epoch/lore/contribution`.
  - Required owner recovery authorization and at least one existing canonical `sourceEventId`.
  - Kept the event as an auditable contribution only: it does not directly rewrite claim text or mark a claim true.
  - Added S059-lite cost: `refutation` and `revision` spend 1 focus via paired `resource_spent` before scoring.
  - Wired `world_overview.honorBoards` confirmation/refutation/revision categories to score from `lore_contribution_recorded`.
- Verification:
  - `node --import tsx --test --test-name-pattern "lore contributions" ../agent-server/test/mcp.test.ts`: RED before implementation because the installed MCP tool was absent; passed after event/core/runtime/MCP wiring.
  - `node --import tsx --test --test-name-pattern "lore contributions|HTTP renders public world overview|canonical world overview" ../agent-server/test/mcp.test.ts ../agent-server/test/server.test.ts src/agent/AgentExplorer.layout.test.ts`: passed after HTTP route and world-overview integration.

Lore contribution read-surface slice:

- Risk: lore contributions were scoreable but not directly inspectable as a structured read model. Agents and users could see a category score without seeing which confirmation/refutation/revision records created it, forcing them to scrape audit events or public HTML.
- Implementation:
  - Added `EpochLoreContributionInfo` / `EpochLoreContributionsInfo` read models derived from canonical `lore_contribution_recorded` events.
  - Exposed `obsidian_epoch.lore_contributions` and `GET /api/epoch/lore/contributions` with optional `agentId`, `category`, `targetId` and `limit` filters.
  - Added `world_overview.recentLoreContributions` and rendered the same recent contribution list on `/epoch/world` and in the Web Agent Console world overview panel.
  - Added the new read tool to static install manifests and documented it in the packaged Skill, protocol reference and architecture notes.
- Verification:
  - `node --import tsx --test --test-name-pattern "lore contributions|HTTP renders public world overview|canonical world overview" ../agent-server/test/mcp.test.ts ../agent-server/test/server.test.ts src/agent/AgentExplorer.layout.test.ts`: RED before implementation because the read tool, HTTP route, world-overview field and console rendering were missing; passed after runtime, MCP, HTTP, public-page and console wiring.

Lore target status slice:

- Risk: contribution evidence was visible only as a flat event list. Installed agents could tell that a target had related confirmations or revisions, but not quickly explain the current evidence-derived state for a specific `targetId`.
- Implementation:
  - Added target-level lore status read models derived only from canonical `lore_contribution_recorded` events.
  - Exposed `obsidian_epoch.lore_targets` and `GET /api/epoch/lore/targets` with optional `targetId`, `status` and `limit` filters.
  - Added `world_overview.loreTargetStatuses` and rendered the same target statuses on `/epoch/world` and in the Web Agent Console world overview panel.
  - Added the tool to static install manifests and documented the status labels as evidence-derived read models, not client-writeable truth overrides.
- Verification:
  - `node --import tsx --test --test-name-pattern "lore contributions|lore targets|HTTP renders public world overview|canonical world overview|lore targets API" ../agent-server/test/mcp.test.ts ../agent-server/test/server.test.ts src/agent/AgentExplorer.layout.test.ts src/agent/api.test.ts`: RED before implementation because the tool, HTTP route, world-overview field, console rendering and API helper were missing; passed after runtime, MCP, HTTP, public-page, console and API wiring.

Lore target adjudication slice:

- Risk: evidence-derived target status still left the final truth boundary ambiguous. A modified local prompt or hijacked client could try to turn an ordinary small-citizen story into authoritative world lore unless the final decision lived in a separate server-only event path.
- Implementation:
  - Added `lore_target_adjudicated` events and `adjudicateLoreTarget` in game-core.
  - Exposed operator-gated `obsidian_epoch.adjudicate_lore_target` and `POST /api/epoch/lore/adjudicate`.
  - Required `operatorKey`, `system_worker` context, an explicit target status, a summary, and existing `lore_contribution_recorded` event ids for the same `targetId`.
  - Added `statusSource` and `latestAdjudication` to target status read models so contribution pressure remains visible while system adjudication becomes the final displayed state.
  - Rendered system adjudication on `/epoch/world` and the Web Agent Console, and updated manifests, protocol, Skill and architecture docs.
- Verification:
  - `node --import tsx --test --test-name-pattern "lore contributions|lore adjudication|HTTP renders public world overview|canonical world overview|lore targets API" ../agent-server/test/mcp.test.ts ../agent-server/test/server.test.ts src/agent/AgentExplorer.layout.test.ts src/agent/api.test.ts`: RED before implementation because the operator tool, HTTP route, status source, latest adjudication rendering and API helper were missing; expected to pass after this slice.

Lore adjudication console slice:

- Risk: server-authoritative lore adjudication existed through MCP/HTTP, but the Web Agent Console only displayed target statuses. Operators had to leave the shared progress surface to settle a target, weakening the promise that the page can show and manage agent/world progress in one place.
- Implementation:
  - Added Web Console operator controls for target id, adjudication status, summary and contribution event ids.
  - Wired the controls to `adjudicateEpochLoreTarget` with `operatorKey`, parsed contribution ids and an idempotency key.
  - Refreshed `world_overview` after adjudication so the same panel immediately shows `system_adjudication` and the latest summary.
- Verification:
  - `node --import tsx --test --test-name-pattern "operator lore adjudication" src/agent/AgentExplorer.layout.test.ts`: RED before implementation because the Console did not import the API helper or render adjudication controls; passed after UI wiring.

Lore adjudication operator queue slice:

- Risk: final lore adjudication was server-authoritative, but pending targets were invisible in the global operator overview. Operators could miss contribution-backed claims that still needed a system decision, leaving evidence-derived statuses to look like final world truth.
- Implementation:
  - Added `EpochLoreAdjudicationOverview` to `operator_overview`.
  - Counted targets with `statusSource === "contribution_evidence"` as pending and targets with `statusSource === "system_adjudication"` as adjudicated.
  - Added `summary.loreTargetsPendingAdjudication`, `health.queues.loreTargetsPendingAdjudication` and `lore_adjudication_pending` as an operator-health attention reason.
  - Rendered pending lore targets inside the Web Agent Console operator overview and added `填入裁决` actions that prefill the existing adjudication form from the latest contribution event id.
- Verification:
  - `npm run agent:test -- --test-name-pattern "operator overview"`: RED before implementation because MCP/HTTP overview fields were `undefined`; passed after runtime aggregation.
  - `npm run agent:ui-test -- --test-name-pattern "operator overview"`: RED before implementation because the Console did not reference lore adjudication overview fields; passed after UI/type wiring.

Web LLM bridge audit discovery slice:

- Risk: the top-level install manifest exposed `/epoch/audit`, but the non-MCP `Web LLM bridge` host entry and packaged `web-llm-bridge-sequence.json` still listed only console/install/world/result paths. Browser-only model handoffs could finish a result page without an obvious proof surface for server audit replay.
- Implementation:
  - Added a shared `webBridgePublicPages` map in `hostInstall.ts`.
  - Exposed `auditIndex: "/epoch/audit"` and `audit: "/epoch/audit/{eventId}"` through the live Web LLM bridge hostInstall entry.
  - Synced the same public-page map into both static install manifests and the generated `web-llm-bridge-sequence.json` body.
  - Updated protocol, host-install, Web LLM bridge playbook and architecture docs to treat audit links as part of browser-only handoff discovery.
- Verification:
  - `node --import tsx --test ../agent-server/test/packageArchive.test.ts --test-name-pattern "downloadable package contains skill and plugin manifests"`: RED before implementation because `bridge.publicPages.auditIndex` was `undefined`; passed after shared host-install and static manifest updates.
  - `node --import tsx --test ../agent-server/test/server.test.ts --test-name-pattern "browser Agent console|live install manifest|downloaded package"`: RED before implementation because live and downloaded bridge entries omitted `auditIndex`; passed after generator and manifest sync.

Web LLM bridge audit smoke slice:

- Risk: bridge audit links were present in manifests, but the release smoke command still only proved that the browser-copy/paste flow could produce a result page. A public deployment could pass smoke while the bridge audit index or actual replay page was broken.
- Implementation:
  - Extended install-smoke preflight to validate top-level `publicPages.auditIndex`, `publicPages.audit`, the Web LLM bridge hostInstall public-page map and the packaged bridge sequence public-page map.
  - Added a no-script GET check for `/epoch/audit`.
  - After publishing a Web LLM bridge result page, install smoke now extracts an actual receipt `auditUrl`, fetches that `/epoch/audit/{eventId}` page and verifies the event id renders without client scripts.
  - JSON smoke output now includes `webBridgeAuditPublicPagesVerified`, `webBridgeAuditIndexVerified`, `webBridgeAuditIndexUrl`, `webBridgeAuditIndexStatus`, `webBridgeAuditReplayTemplate`, `webBridgeAuditReplayVerified`, `webBridgeAuditReplayUrl` and `webBridgeAuditReplayStatus`.
  - Updated host-install, protocol and architecture docs so deployment automation treats these fields as proof of browser-only result auditability.
- Verification:
  - `node --import tsx --test ../agent-server/test/install-smoke-command.test.ts --test-name-pattern "proves MCP package can play one server turn"`: RED before implementation because `webBridgeAuditPublicPagesVerified` was `undefined`; passed after install-smoke preflight and receipt replay checks.

Production TypeScript explicit-any gate slice:

- Risk: the project was already TypeScript-only, but settled production utility modules still used explicit `any`, which weakened the server-authoritative boundary around run tickets, lore admission, faction progression, transparency records, community threads and JSON-RPC dispatch.
- Implementation:
  - Added `scripts/check-no-explicit-any-source.ts`, an AST-based TypeScript gate that detects `AnyKeyword` in production source without false positives from strings or comments.
  - Wired `npm run check:no-explicit-any` into `npm run typecheck`, after `check:no-js` and before web/agent compilation.
  - Added a regression test proving the gate reports ordinary production `.ts` files that contain explicit `any`.
  - Replaced explicit `any` with `unknown`, record guards and precise ledger interfaces in `adjudicator.ts`, `community.ts`, `contextPackage.ts`, `experience.ts`, `factions.ts`, `feedback.ts`, `hostInstall.ts`, `lore.ts`, `mcp.ts`, `mcpJsonRpc.ts`, `progression.ts`, `tickets.ts` and `transparency.ts`.
  - Kept only the large dynamic JSON boundary files on the gate allowlist for follow-up hardening: `install-smoke.ts`, `epoch/runtime.ts`, `httpServer.ts` and `mcpTools.ts`. Later hardening slices removed persistence, MCP dispatch, HTTP dispatch, install smoke verification and the Epoch runtime itself from this follow-up set, leaving the production explicit-any allowlist empty.
- Verification:
  - `npm run check:no-explicit-any`: RED before type cleanup, listing the production utility modules above; passed after replacing explicit `any` in the non-allowlisted production surface.
  - `npm run typecheck:agent`: failed once on expected `unknown` narrowing issues; passed after tightening return types and guards.

Persistence TypeScript boundary hardening slice:

- Risk: `store.ts` and `sqliteStore.ts` were still allowlisted as dynamic JSON boundaries even though they hydrate canonical tickets, run submissions, transparency entries, result pages and epoch events after restart. That left the persistence/recovery path outside the production explicit-any gate.
- Implementation:
  - Added a regression test proving `check-no-explicit-any-source.ts` reports `tools/agent-server/lib/store.ts` and `tools/agent-server/lib/sqliteStore.ts`.
  - Removed both persistence files from the explicit-any allowlist.
  - Replaced their `AnyRecord` usage with `JsonRecord`, `unknown` parsing, record guards and SQL-safe string/number/null extraction before SQLite bindings.
  - Kept hydrate inputs broad enough for structured `EpochEvent` objects while narrowing internally before property access.
- Verification:
  - `node --import tsx --test ../agent-server/test/no-js-gate.test.ts --test-name-pattern "persistence boundary"`: RED before removing the allowlist entries because the gate returned status 0; passed after allowlist and persistence type changes.
  - `npm run check:no-explicit-any`: passed with `store.ts` and `sqliteStore.ts` scanned.
  - `npm run typecheck:agent`: failed once on expected `unknown` SQL/input narrowing issues; passed after SQL binding and hydrate input fixes.

MCP tool dispatch TypeScript boundary hardening slice:

- Risk: `mcpTools.ts` was still allowlisted even though it dispatches external MCP tool input into the server-authoritative game runtime. That left the host/plugin boundary outside the production explicit-any gate.
- Implementation:
  - Added a regression test proving `check-no-explicit-any-source.ts` reports `tools/agent-server/lib/mcpTools.ts`.
  - Removed `mcpTools.ts` from the explicit-any allowlist, reducing the remaining dynamic JSON boundary allowlist to `install-smoke.ts`, `epoch/runtime.ts` and `httpServer.ts`.
  - Replaced MCP dispatch `AnyRecord` backing with `unknown`, record guards and string/number helpers at the input boundary.
  - Typed the MCP runtime injection seam without weakening existing test doubles, then cast only after the dynamic adapter boundary so handler dispatch has the `createAgentWorldRuntime` return shape.
- Verification:
  - `node --import tsx --test ../agent-server/test/no-js-gate.test.ts --test-name-pattern "MCP tool dispatch"`: RED before removing the allowlist entry because the gate returned status 0; passed after allowlist and MCP type changes.
  - `npm run check:no-explicit-any`: passed with `mcpTools.ts` scanned.
  - `npm run typecheck:agent`: failed once on expected `unknown` input/runtime narrowing issues; passed after MCP dispatch boundary fixes.

HTTP route dispatch TypeScript boundary hardening slice:

- Risk: `httpServer.ts` was still allowlisted even though it parses public HTTP JSON bodies, dispatches MCP proxy calls, persists server events and renders install manifest feed data. That left the browser/API boundary outside the production explicit-any gate.
- Implementation:
  - Added a regression test proving `check-no-explicit-any-source.ts` reports `tools/agent-server/lib/httpServer.ts`.
  - Removed `httpServer.ts` from the explicit-any allowlist, reducing the remaining dynamic JSON boundary allowlist to `install-smoke.ts` and `epoch/runtime.ts`.
  - Replaced the HTTP `AnyRecord` backing with `unknown`, record guards and string/number extraction helpers.
  - Changed persistence and JSON-RPC helper inputs to accept `unknown` and narrow internally, preserving structured Epoch runtime return types instead of forcing them into index-signature records.
  - Narrowed public install feed event fields before manifest rendering.
- Verification:
  - `node --import tsx --test ../agent-server/test/no-js-gate.test.ts --test-name-pattern "HTTP server boundary"`: RED before removing the allowlist entry because the gate returned status 0; passed after allowlist and HTTP type changes.
  - `npm run check:no-explicit-any`: passed with `httpServer.ts` scanned.
  - `npm run typecheck:agent`: failed once on expected `unknown` route/persistence narrowing issues; passed after HTTP boundary fixes.

Install smoke TypeScript boundary hardening slice:

- Risk: `install-smoke.ts` was still allowlisted even though deployment cutover depends on its package integrity, Streamable HTTP MCP, package proxy, browser bridge and audit replay proof checks. A weak JSON helper here could hide release-gate drift.
- Implementation:
  - Added a regression test proving `check-no-explicit-any-source.ts` reports `tools/agent-server/install-smoke.ts`.
  - Removed `install-smoke.ts` from the explicit-any allowlist, reducing the remaining dynamic JSON boundary allowlist to `epoch/runtime.ts`.
  - Replaced the install smoke `AnyRecord` backing with `unknown`, record guards and string extraction for MCP JSON-RPC payloads, tool result text payloads and package proxy tool lists.
- Verification:
  - `node --import tsx --test ../agent-server/test/no-js-gate.test.ts --test-name-pattern "install smoke"`: RED before removing the allowlist entry because the gate returned status 0; passed after allowlist and install smoke type changes.
  - `npm run check:no-explicit-any`: passed with `install-smoke.ts` scanned.
  - `npm run typecheck:agent`: failed once on expected `unknown` JSON-RPC payload narrowing issues; passed after install smoke guard fixes.

Epoch runtime TypeScript boundary hardening slice:

- Risk: `epoch/runtime.ts` was the final explicit-any allowlist entry and is the server-authoritative command surface for identity, lifetime, NPCs, news, resources, market, diplomacy, hosted sessions and audit records. Keeping it outside the gate weakened the core anti-cheat boundary.
- Implementation:
  - Added a regression test proving `check-no-explicit-any-source.ts` reports `tools/agent-server/lib/epoch/runtime.ts`.
  - Removed the final explicit-any allowlist entry, leaving `check-no-explicit-any-source.ts` with an empty allowlist.
  - Replaced runtime `AnyRecord` backing with `unknown`, record guards and string/number extraction helpers.
  - Narrowed event payload audit summaries through record guards instead of raw payload casts.
  - Narrowed runtime command wrapper inputs before calling the strongly typed game core, including NPC review, moderation/risk review, messages, lore, objectives, resources, inventory, seasons, market, bounty, raid, diplomacy, relationship, turn and hosted-session actions.
- Verification:
  - `node --import tsx --test ../agent-server/test/no-js-gate.test.ts --test-name-pattern "Epoch runtime"`: RED before removing the allowlist entry because the gate returned status 0; passed after allowlist and runtime type changes.
  - `npm run check:no-explicit-any`: passed with an empty production allowlist.
  - `npm run typecheck:agent`: failed once on expected runtime wrapper narrowing issues; passed after command input guards.

## Definition Of Done For Alpha 1

- All new source files are `.ts`.
- `npm run check:no-js` passes.
- `npm run check:no-explicit-any` passes for non-allowlisted production TypeScript source.
- `npm run typecheck:agent` passes.
- `npm run agent:test` passes.
- Pure game-core tests prove server-side authority for identity, lifetime, resources, downtime, NPC and news primitives.
- Existing MCP, HTTP and old run-ticket tests continue to pass.

## Definition Of Done For Full Version

- A user can install the MCP/Skill package and start play from Claude Code, Codex, Cursor, Hermes or OpenClaw.
- A web LLM user can play through a browser-safe bridge.
- A public page shows agent progress and canonical result pages.
- Agent identities, lifetime, reincarnation, resources, NPCs, region news, social graph, trading and competition are server-authoritative.
- Compromised prompts, modified MCP adapters and client-side forged text cannot create canonical rewards or state.
- Production TypeScript stays JS-free and rejects new explicit `any` outside documented dynamic JSON boundary files.
- Public server deployment, package download and verification documentation are available.

## 2026-06-30 Region Active Agents Read Model Slice

- Added a server-authoritative `activeAgents` projection to region info so each region exposes recently active identities, explorer links, status, generation, remaining lifetime, legend, resources, latest activity source and canonical public pages.
- Fed the projection from trusted server events: region activities, influence changes, visible region messages and downtime activity. Only active identities are surfaced.
- Rendered active identities on public region pages under `活动身份`, including canonical agent result links.
- Surfaced active identities in the React agent console region panel so users can watch who is currently doing things in a region while their coding agent is busy.
- Extended HTTP, MCP and UI layout tests before implementation, then made them pass.

Verification:

- `node --import tsx --test --test-name-pattern "HTTP region info and public region page expose canonical region leaderboards" ../agent-server/test/server.test.ts`: failed first on missing `activeAgents`, then passed after runtime/public page implementation.
- `node --import tsx --test --test-name-pattern "MCP exposes server-spawned resource nodes" ../agent-server/test/mcp.test.ts`: passed with `activeAgents` exposed through MCP region info.
- `node --import tsx --test --test-name-pattern "Agent console region panel surfaces the server-derived region leaderboard" src/agent/AgentExplorer.layout.test.ts`: failed first on missing UI copy, then passed after console rendering.
- `npm run typecheck`: passed, including `check:no-js`, `check:no-explicit-any`, `typecheck:web` and `typecheck:agent`.
- `npm run agent:test`: passed 307 tests.
- `npm run agent:ui-test`: passed 98 tests.
- `npm run build`: passed and regenerated the static world-map export.

Remaining highest-risk gap:

- Prove the complete untrusted-host loop end to end: packaged MCP or Web LLM bridge receives a system-issued identity, runs a turn with local/user model tokens, submits bounded evidence, server-side judge resolves canonical state, public result page is generated, and expired/revoked sessions can no longer mutate state.

## 2026-06-30 Install Smoke Web Bridge Trust Evidence Slice

- Strengthened the release/install smoke contract so `npm run agent:install-smoke -- --json` now reports the Web LLM bridge trust proof it already validates internally.
- Added JSON fields proving the packaged MCP proxy path created a browser bridge session with `channelClass: "browser_copy_paste"` and `deliveryTrust: "untrusted_client"`.
- Added JSON fields proving the submitted browser action stays `browser_copy_paste` + `untrusted_client`, even when the browser-visible text tries to declare a forged `legendary_empire_commander` outcome.
- Added a result-page focus assertion so install smoke fails if the generated public result page is not actually focused on the browser bridge hosted session.
- Added a post-result mutation check through the downloaded package MCP proxy: after the browser bridge session is completed and its public result page exists, a second `submit_web_bridge_action` must be rejected with `hosted_session_not_active`.
- Classified `hosted_session_not_active` as a client-visible MCP parameter/state error in both Streamable MCP JSON-RPC and the packaged proxy, instead of collapsing it into `internal_error`.
- This converts a previous hidden runtime check into operator-visible release evidence: a deployed install smoke run can now prove the web-model path is untrusted input, not canonical authority.

Verification:

- `node --import tsx --test --test-name-pattern "npm install smoke command proves MCP package can play one server turn" ../agent-server/test/install-smoke-command.test.ts`: failed first because `webBridgeChannelClass` was missing from the smoke JSON; passed after returning the trust fields.
- `node --import tsx --test --test-name-pattern "npm install smoke command proves MCP package can play one server turn" ../agent-server/test/install-smoke-command.test.ts`: failed again when the post-result mutation proof was missing; passed after the smoke issued a second packaged-proxy submit and verified `hosted_session_not_active`.
- `node --import tsx --test --test-name-pattern "hosted runner accepts only server action options and records server outcomes" ../agent-server/test/epoch-game-core.test.ts`: passed with a regression assertion that completed hosted sessions reject a second action and keep one recorded action.
- `node --import tsx --test ../agent-server/test/install-smoke-command.test.ts`: passed 11 install smoke command tests.
- `node --import tsx --test ../agent-server/test/install-smoke-command.test.ts ../agent-server/test/packageArchive.test.ts ../agent-server/test/mcp.test.ts`: passed 73 related install, package and MCP tests.
- `npm run typecheck`: passed, including `check:no-js`, `check:no-explicit-any`, `typecheck:web` and `typecheck:agent`.
- `npm run agent:test`: passed 307 tests.
- `npm run build`: passed and regenerated the static world-map export.
- `git diff --check -- tools/agent-server/install-smoke.ts tools/agent-server/test/install-smoke-command.test.ts tools/agent-server/test/epoch-game-core.test.ts tools/agent-server/lib/mcpJsonRpc.ts tools/agent-server/package/obsidian-epoch/bin/mcp-proxy.ts`: passed.

Next highest-risk gap:

- Add a process-level deployment smoke that starts the production server entrypoint as a child process, exercises `/api/epoch/mcp` as well as `/mcp`, then runs the same package install smoke against that process. Current tests mostly use in-process HTTP servers.

## 2026-06-30 Process-Level Agent Server Smoke Slice

- Added a process-level smoke test that starts the real `npm run agent:server` entrypoint in a child process on an isolated local port with an isolated `AGENT_SERVER_DATA_DIR`.
- The test waits on `/api/health`, then exercises the `/api/epoch/mcp` Streamable MCP alias with an `initialize` request.
- The same test runs `npm run agent:install-smoke -- --server <child-server> --json` against that spawned process, proving the downloadable package, packaged MCP proxy, Web LLM bridge trust evidence, post-result mutation rejection and Streamable MCP checks work outside the in-process test server.
- No production server change was required; this was a missing release-readiness proof.

Verification:

- `node --import tsx --test --test-name-pattern "agent server process supports MCP alias and package install smoke" ../agent-server/test/install-smoke-command.test.ts`: passed.
- `node --import tsx --test ../agent-server/test/install-smoke-command.test.ts`: passed 12 install smoke command tests.
- `npm run typecheck`: passed, including `check:no-js`, `check:no-explicit-any`, `typecheck:web` and `typecheck:agent`.
- `npm run agent:test`: passed 308 tests, including the child-process server smoke.
- `git diff --check -- tools/agent-server/test/install-smoke-command.test.ts`: passed.

Next highest-risk gap:

- Add an operator-authorized production deployment rehearsal that runs against a real public HTTPS endpoint, including backup and restore rehearsal evidence. Local tests now prove process-level behavior, but not a live public deployment.

## 2026-06-30 Release Rehearsal Command Slice

- Added `npm run agent:release-rehearsal` as a release-grade orchestration command.
- The command runs the existing package install smoke against a supplied server, verifies operator-gated overview access through `x-epoch-operator-key`, runs JSONL to SQLite recovery drill for the agent/result page created by install smoke, creates a backup, and restores that backup into fresh JSONL and SQLite targets.
- Production mode now requires a pinned release key id before the command proceeds. The install smoke layer still enforces public HTTPS, operator package signing and external console media when `--production` is used.
- The command returns one machine-readable JSON object with `checks.installSmoke`, `checks.operatorOverview`, `checks.recoveryDrill`, `checks.backup` and `checks.restore`.
- The command intentionally does not claim to prove DNS/TLS/CDN ownership locally; those remain real external-state properties and must be proven by running the command against the actual public HTTPS deployment.

Verification:

- `node --import tsx --test --test-name-pattern "release rehearsal production mode requires a pinned release key id" ../agent-server/test/release-rehearsal-command.test.ts`: failed first when the script was missing/no structured JSON; passed after adding the command and production guard.
- `node --import tsx --test --test-name-pattern "release rehearsal command proves install backup restore and recovery evidence" ../agent-server/test/release-rehearsal-command.test.ts`: failed first because result page ids with share-token query strings did not hydrate; passed after extracting page ids from the URL pathname.
- `node --import tsx --test ../agent-server/test/release-rehearsal-command.test.ts`: passed 3 release rehearsal command tests.
- `node --import tsx --test ../agent-server/test/release-rehearsal-command.test.ts ../agent-server/test/recovery.test.ts ../agent-server/test/deploy-config.test.ts ../agent-server/test/production-config.test.ts`: passed 15 related release/recovery/deploy tests.
- `npm run typecheck`: passed, including `check:no-js`, `check:no-explicit-any`, `typecheck:web` and `typecheck:agent`.
- `npm run agent:test`: passed 311 tests.
- `npm run build`: passed and regenerated the static world-map export.
- `git diff --check -- tools/agent-server/release-rehearsal.ts tools/agent-server/test/release-rehearsal-command.test.ts tools/graph-react-app/package.json`: passed.

Next highest-risk gap:

- Run `npm run agent:release-rehearsal -- --server <public-https-origin> --operator-key <secret> --expected-release-key-id <key> --production --json` against the actual deployed production host. This requires an external public deployment and cannot be proven inside the local workspace alone.

## 2026-06-30 Result Trust-Tier Receipt Slice

- Added server-derived `payload.receipt.playMode` and `payload.receipt.trustTier` to public result receipts.
- Ranked owner-authorized/server-settled results now report `ranked` / `server_settled`; Web LLM bridge browser-copy-paste results report `casual` / `untrusted_capped`; true server-hosted or attested focused results can report `verified` / `verified_autonomous`; payloads without canonical events fall back to `sandbox` / `private_sandbox`.
- Rendered the mode and trust tier on no-script public result pages so a player can tell whether a result came from ordinary ranked settlement, untrusted browser bridge play or a stronger verified lane.
- Extended install smoke JSON so release checks fail if the packaged MCP proxy result page or Web LLM bridge result page loses those labels.
- Updated the packaged Skill, protocol reference and architecture notes to require agents to cite `playMode` / `trustTier` and never describe `casual` / `untrusted_capped` bridge output as ranked or attested.

Verification:

- `node --import tsx --test --test-name-pattern "MCP Epoch tools expose server-issued identity|HTTP Epoch routes persist canonical events|npm install smoke command proves MCP package can play one server turn" ../agent-server/test/mcp.test.ts ../agent-server/test/server.test.ts ../agent-server/test/install-smoke-command.test.ts`: failed first in install smoke when the new fields were missing; passed after runtime/result page/install-smoke wiring.

Next highest-risk gap:

- Continue server-authority hardening on idempotent write replays so the same idempotency key cannot return a cached result for a different owner-authorized write payload.

## 2026-06-30 Owner Idempotency Subject-Binding Slice

- Removed the narrow owner idempotency subject-binding whitelist that only covered party-run creation/join.
- Bound every owner-recovery-authorized write idempotency cache entry to `scope + explorerId + stable sanitized payload subject`, including the first explorer identity registration path and later owner-auth cached replays.
- Kept legitimate same-payload replays working, including registered explorer identity replay and abuse-window-safe duplicate reads.
- Changed same-key/different-payload owner writes to reject with `idempotency_key_conflict` instead of returning stale cached success.
- Updated the packaged Skill, protocol reference and architecture notes to tell installed agents that an idempotency key is reusable only for the exact same command subject.

Verification:

- `node --import tsx --test --test-name-pattern "owner-authorized writes reject idempotency replay" ../agent-server/test/mcp.test.ts`: failed first because `set_downtime` returned a cached `training` result when the same key was reused for `meditation`; passed after subject-binding all owner writes.
- `node --import tsx --test --test-name-pattern "owner-authorized writes reject idempotency replay|owner-authorized party runs|state changes enforce abuse limits" ../agent-server/test/mcp.test.ts`: passed, proving the new rule preserves existing party-run conflict behavior and legitimate duplicate identity replay under abuse limits.

Next highest-risk gap:

- Continue multiplayer anti-farm hardening: party-run invite/capacity/approval boundaries or raid pair cooldown/reward decay.

## 2026-06-30 Player Waiting Downtime Choice Slice

- Moved the most common downtime decision into the player-first waiting surface instead of leaving it hidden behind `高级 / Operator`.
- Added four first-screen downtime cards:
  - `冥想 +专注`
  - `修炼 +灵质`
  - `锻炼 +体力`
  - `看店 +钱币`
- The cards update the existing `downtimeMode` state, while the existing `选择托管行动` command remains the server write path through `setEpochDowntime`.
- Added a first-screen `托管收益` strip that shows `预计托管收益` from `progress.pendingDowntime` when available and exposes `领取托管收益` without requiring the user to open the operator dashboard.
- Added responsive CSS so the cards render as four columns on desktop, two columns on medium screens and one column on mobile.
- This closes the biggest player-experience gap reported by the design subagent: the plugin now feels more like an immediate waiting-time game surface instead of a hidden admin console.

Verification:

- `node --import tsx --test --test-name-pattern "downtime choices" src/agent/AgentExplorer.layout.test.ts`: failed first because the player section had no `agent-player-downtime-modes`; passed after the first-screen cards and earnings strip were added.
- `node --import tsx --test --test-reporter spec src/agent/AgentExplorer.layout.test.ts`: passed 77 layout tests.
- `npm run agent:ui-test`: passed 100 tests.

Next highest-risk gap:

- Add concrete disabled-state helper text for the first-screen player CTAs, especially no identity, archived identity, no recovery material and busy/error states.

## 2026-06-30 Server-Hosted Job Ownership Binding Slice

- Added an explicit server-authoritative check to `runServerHostedJob`: if an operator request includes both `jobId` and `agentId`, the job must belong to that requested identity.
- MCP now rejects mismatched `jobId`/`agentId` execution with `server_hosted_job_agent_mismatch`.
- HTTP now maps `server_hosted_job_agent_mismatch` to a 400 client error instead of a 500, matching the rest of the `server_hosted_job_*` validation errors.
- Kept the existing operator flow compatible: calls that only provide `jobId` still run the job by server-owned queue state, and calls without `jobId` still select the next queued job for the requested agent.
- This closes a server-authority bug where a caller could pass `agentId=B` while executing `jobId=A`; the old runtime ignored the supplied `agentId` once a job id was present.

Verification:

- `node --import tsx --test --test-name-pattern "server-hosted job when jobId belongs|server-hosted autonomous jobs" ../agent-server/test/mcp.test.ts`: failed first with `Missing expected rejection`; passed after runtime binding.
- `node --import tsx --test --test-name-pattern "server-hosted job execution when jobId and agentId disagree|server-hosted autonomous jobs" ../agent-server/test/server.test.ts`: failed first with `200 !== 400`, then `500 !== 400`; passed after runtime binding and HTTP error mapping.
- `npm run typecheck`: passed, including `check:no-js`, `check:no-explicit-any`, `typecheck:web` and `typecheck:agent`.
- `npm run agent:ui-test`: passed 100 tests.
- `npm run agent:test`: passed 315 tests.
- `npm run build`: passed and regenerated the static world-map export.

Subagent findings to queue next:

- P0: reject same-explorer market self-dealing across separate identities.
- P0: prevent Web LLM bridge `copyPrompt` from exposing secret-shaped mandate text.
- P1: lock attestation challenge expiry and session/option rebinding tests.
- P1: stabilize heavy install-smoke/release-rehearsal command tests when run together.
- P1: distinguish install page `available` state from real local smoke or production rehearsal evidence.

## 2026-06-30 Same-Explorer Market Self-Dealing Slice

- Added a core market rule that rejects fills between two active identities owned by the same explorer.
- The rule now catches the case where a high-legend explorer has multiple valid active identities and tries to use one identity to buy the other identity's order.
- Kept existing legal trades intact: distinct explorers can still fill open market orders, item transfers still work, and the previous same-agent self-fill guard remains in place.
- Added MCP and HTTP coverage so the error crosses both installed-agent and browser/server API boundaries.
- HTTP maps the new `market_same_explorer_fill_not_allowed` error to 400, matching other market validation failures.
- This is a direct anti-farm hardening step: it blocks self-trading for volume, price manipulation, fee laundering, repeated-counterparty review evasion and resource laundering through alternate identities under one player account.

Verification:

- `node --import tsx --test --test-name-pattern "same-explorer self-dealing" ../agent-server/test/epoch-game-core.test.ts`: failed first with `Missing expected exception`; passed after the core rule.
- `node --import tsx --test --test-name-pattern "same explorer" ../agent-server/test/mcp.test.ts`: first exposed a test fixture error, then failed with `Missing expected rejection`; passed after the core rule.
- `node --import tsx --test --test-name-pattern "same-explorer market self-dealing" ../agent-server/test/server.test.ts`: failed first with `200 !== 400`; passed after the core rule and HTTP error mapping.
- `node --import tsx --test --test-name-pattern "market order|market orders|market fills|same-explorer|market self-dealing" ../agent-server/test/epoch-game-core.test.ts ../agent-server/test/mcp.test.ts ../agent-server/test/server.test.ts`: passed 11 related tests.
- `npm run typecheck`: passed, including `check:no-js`, `check:no-explicit-any`, `typecheck:web` and `typecheck:agent`.
- `npm run agent:ui-test`: passed 100 tests.
- `npm run agent:test`: passed 318 tests.
- `npm run build`: passed and regenerated the static world-map export.

Next highest-risk gap:

- Prevent Web LLM bridge prompt/result paths from ever exposing secret-shaped mandate text or recovery/operator material through MCP copy prompts.

## 2026-06-30 Web Bridge Secret-Material Guard Slice

- Added a runtime-level guard for browser-copy Web LLM bridge text fields.
- `obsidian_epoch.web_bridge_turn` now rejects a `mandate` that contains the same request's recovery/operator/confirmation material before building `copyPrompt`.
- `obsidian_epoch.submit_web_bridge_action` now rejects `visibleText` that contains the same request's recovery/operator/confirmation material before it can be recorded into hosted-session actions, result pages or audit surfaces.
- This complements the existing API-key-shaped scanner: `sk-*` leaks were already blocked at the MCP/HTTP boundary, while this slice covers accidental copy/paste of valid recovery material that is not API-key-shaped.
- HTTP maps `secret_material_detected` to 400 so the web console gets a client validation error instead of a generic 500.
- The guard lives in the Epoch runtime, so packaged MCP, HTTP console and future browser bridge pages share the same rule.

Verification:

- `node --import tsx --test --test-name-pattern "MCP Epoch tools expose server-issued identity" ../agent-server/test/mcp.test.ts`: failed first because bridge `mandate`/`visibleText` containing the request recovery code was accepted; passed after adding the runtime guard.
- `node --import tsx --test --test-name-pattern "Web LLM bridge rejects recovery material" ../agent-server/test/server.test.ts`: failed first with `200 !== 400`; passed after runtime guard and HTTP error mapping.
- `node --import tsx --test --test-name-pattern "web bridge|Web LLM|secret-shaped|secret material|install smoke" ../agent-server/test/mcp.test.ts ../agent-server/test/server.test.ts ../agent-server/test/install-smoke-command.test.ts`: passed 16 related tests.
- `npm run typecheck`: passed, including `check:no-js`, `check:no-explicit-any`, `typecheck:web` and `typecheck:agent`.
- `npm run agent:ui-test`: passed 100 tests.
- `npm run agent:test`: passed 319 tests.
- `npm run build`: passed and regenerated the static world-map export.

Follow-up status:

- Closed in later slices below: archived identity attestation/session boundary regression coverage, live install-status console wiring, and automated player waiting board visual guards.

## 2026-06-30 Attestation Idempotency Subject-Binding Slice

- Bound `obsidian_epoch.attestation_challenge` idempotency keys to the sanitized attestation subject instead of only remembering `attestation_challenge:${idempotencyKey}`.
- A repeated challenge request now returns `duplicate: true` only when `runnerId`, `sessionId`, `actionOptionId` and `transcriptHash` are unchanged.
- Reused challenge idempotency keys with changed session/option/transcript now reject with `idempotency_key_conflict` instead of returning a stale challenge for a different hosted action.
- Changed `obsidian_epoch.submit_attested_action` from the generic key-only idempotency helper to a subject-bound helper.
- A repeated attested submit now returns the cached duplicate only for the exact same challenge payload, signature and visible action text; changed challenge/session/action/transcript/signature/visible text with the same key now rejects as a conflict.
- This closes the replay gap where a compromised local MCP or prompt wrapper could reuse a previously successful idempotency key to make a different attested action look like a safe retry.

Verification:

- `node --import tsx --test --test-name-pattern "attestation challenge rejects idempotency replay|attested action rejects idempotency replay" ../agent-server/test/mcp.test.ts`: failed first with `Missing expected rejection` for both challenge and submit replay; passed after subject binding.
- `node --import tsx --test --test-name-pattern "attestation challenge rejects idempotency replay|attested action rejects idempotency replay|attested runner verifies challenge" ../agent-server/test/mcp.test.ts`: passed, proving the existing signed runner flow still works while changed-subject replays are blocked.

Follow-up status:

- Closed in later slices below: archived identity attestation/session boundary regression coverage, live install-status console wiring, and automated player waiting board visual guards.

## 2026-06-30 Attestation Lifecycle Regression Slice

- Added MCP regression coverage for attestation challenge TTL expiry.
- A signed hosted action submitted after the runner challenge TTL now rejects with `attestation_challenge_expired` before any hosted action is settled.
- Added MCP regression coverage for consumed challenge error ordering.
- A challenge that was successfully consumed keeps returning `attestation_challenge_already_used` even after its TTL later expires, so operators can distinguish replay from stale unused work.
- This was a test-lock slice: the runtime already enforced the intended order (`used` before `expired`), and the new tests preserve that boundary.

Verification:

- `node --import tsx --test --test-name-pattern "attested action rejects expired challenges|attested action keeps consumed challenges|attestation challenge rejects idempotency replay|attested action rejects idempotency replay|attested runner verifies challenge" ../agent-server/test/mcp.test.ts`: passed 5 related MCP attestation tests.

Follow-up status:

- Closed in the archived identity attestation boundary slice below.

## 2026-06-30 Archived Identity Attestation Boundary Slice

- Added MCP regression coverage for sessions that were started while an identity was active and then reused after the identity was archived.
- Direct `obsidian_epoch.submit_hosted_action` was already blocked by the core `requireActiveIdentity` check; the regression keeps that boundary explicit.
- Fixed `obsidian_epoch.attestation_challenge` so it now rejects active hosted sessions whose backing identity has since been archived, instead of issuing a fresh runner challenge for a dead identity.
- A pre-archive attestation challenge submitted after archive still rejects during settlement with `agent_identity_archived`, so old signed prompts cannot bypass final identity state.
- This closes the trust-channel gap where the runner challenge step could remain open after the server had already finalized the identity.

Verification:

- `node --import tsx --test --test-name-pattern "attestation rejects archived identity" ../agent-server/test/mcp.test.ts`: failed first with `Missing expected rejection`; passed after adding the runtime active-identity check before challenge issuance.
- `node --import tsx --test --test-name-pattern "attestation rejects archived identity|attested action rejects expired challenges|attested action keeps consumed challenges|attestation challenge rejects idempotency replay|attested action rejects idempotency replay" ../agent-server/test/mcp.test.ts`: passed 5 related MCP attestation tests.

## 2026-06-30 Live Install Status Slice

- Added `GET /api/epoch/install-status` as a lightweight truthful install status endpoint.
- The endpoint returns `ok`, `generatedAt`, `serverBase`, `truthLevel: "live_lightweight"`, `manifest`, `package`, `hostInstall`, `smoke` and `release`.
- The package portion is derived from the existing install package archive metadata, including `bytes`, `sha256`, signature algorithm, integrity manifest, release key id and signing trust.
- The host portion is derived from generated multi-host install entries and host config manifest entries, including Claude Code, Codex, Cursor, Hermes, OpenClaw and Web LLM bridge.
- The smoke portion intentionally reports `status: "not_run"` and `lightweightOnly: true`; the endpoint does not pretend that MCP/Skill or one-turn gameplay has been exercised.
- The `/epoch/install` completion-state tile now links to `/api/epoch/install-status` and says to return to the console status lights or run `install-smoke` for proof, rather than claiming “已检测 MCP/Skill” or “已跑通一回合”.
- The Agent Console first-screen install light now calls `getEpochInstallStatus()` and displays live `truthLevel`, package bytes/hash/signing trust and smoke proof requirements instead of only local manifest assumptions.

Verification:

- `node --import tsx --test --test-name-pattern "HTTP live install manifest" ../agent-server/test/server.test.ts`: passed the install manifest + install-status API coverage.
- `node --import tsx --test src/agent/api.test.ts src/agent/AgentExplorer.layout.test.ts`: passed 99 UI/API layout tests, including the new install-status client wrapper and first-screen wiring.

## 2026-06-30 Player Waiting Board Slice

- Added an `agent-player-watch` section immediately after the first-screen player action buttons and before the operator tools.
- The watch board shows one next-action sentence, four status lights for install/identity/hosting/public result, a downtime or hosted-action glimpse, and the latest 2-3 server facts.
- It reuses existing server facts instead of inventing new state: `installReadiness`, `lastAgentRequest`, `actionEligibility`, `progress.pendingDowntime`, `progress.downtimeDiaryEntries`, `progress.latestEvents`, `primaryHostedSession` and `serverHostedJobs`.
- Added responsive CSS for the watch board, including `min-width: 0` and one-column mobile behavior to avoid horizontal overflow.
- Added a layout test that locks the watch board before operator tooling and confirms the board is wired to live waiting facts.
- Added automated desktop/mobile visual guards for the board: it must keep its own overflow boundary, use stable status-light heights, preserve a four-column desktop grid, collapse to one column on mobile, and wrap long hashes/commands inside the cards.

Verification:

- `node --import tsx --test --test-name-pattern "Agent console places a player watch board" src/agent/AgentExplorer.layout.test.ts`: passed.
- `node --import tsx --test --test-name-pattern "player watch board has automated" src/agent/AgentExplorer.layout.test.ts`: failed first because the board had no overflow boundary or stable status-light height; passed after CSS hardening.
- `node --import tsx --test src/agent/api.test.ts src/agent/AgentExplorer.layout.test.ts`: passed 99 UI/API layout tests.
- `npm run check:no-js`: passed with no JS/MJS/JSX source files.
- `npm run typecheck:web`: passed.
- `npm run agent:visual-qa -- --json`: passed against `http://127.0.0.1:8787`; desktop 1280 and mobile 390 both showed `live_lightweight`, package bytes/hash and no horizontal overflow; screenshots saved to `/tmp/obsidian-epoch-agent-console-desktop-live-install.png` and `/tmp/obsidian-epoch-agent-console-mobile-live-install.png`.

Remaining risk:

- P1: promote `agent:visual-qa` into CI/release rehearsal once a stable Chrome runtime is available in the deployment environment.

## 2026-06-30 Agent Console Browser Visual QA Command Slice

- Added `npm run agent:visual-qa` as a repeatable browser QA command for the Agent Console player waiting board.
- The command is implemented in TypeScript and drives a local Chrome/Chromium instance through the Chrome DevTools Protocol, avoiding JS/MJS source and avoiding a new project dependency.
- It first verifies `/api/epoch/install-status` is live and truthful (`truthLevel: "live_lightweight"`), then opens `/epoch/console/?agent=1`.
- It captures desktop 1280x900 and mobile 390x844 screenshots after the first-screen watch board shows live package status.
- It fails if `.agent-player-watch` is missing, `live_lightweight` is absent, the package hash is absent, status lights are missing, or the page has horizontal overflow.

Verification:

- `node --import tsx --test --test-name-pattern "repeatable browser visual QA" src/agent/AgentExplorer.layout.test.ts`: failed first because `agent:visual-qa` was missing; passed after adding the script and package command.
- `npm run agent:visual-qa -- --json`: passed, produced desktop/mobile screenshots and proved no horizontal overflow.

Subagent findings queued next:

- Closed below: host-specific install configuration is now in the install-page first path instead of being buried after asset/ops sections.
- P1: add button focus-visible styling and visible disabled reasons for player primary actions.

## 2026-06-30 Agent Console Install Failure Visibility Slice

- Added first-screen failure state for the initial `getEpochInstallStatus()` call.
- The Agent Console now stores `installStatusError` instead of silently swallowing the startup request failure.
- The player watch board install light turns blocked and shows `连接失败` plus the concrete error message when live install status cannot be loaded.
- Added a first-screen `检查安装状态` action and an inline `重试安装状态` button inside the install light so players do not need to open the operator panel to recover.
- Successful manual retry clears the install-status error.

Verification:

- `node --import tsx --test --test-name-pattern "install-status failures" src/agent/AgentExplorer.layout.test.ts`: failed first because the console had no `installStatusError`; passed after UI wiring and button styling.
- `node --import tsx --test --test-name-pattern "repeatable browser visual QA|install-status failures|player watch board" src/agent/AgentExplorer.layout.test.ts`: passed 4 focused player-watch tests.
- `npm run agent:visual-qa -- --json`: still passed after adding the new first-screen install retry action.

Subagent findings queued next:

- Closed below: host-specific install configuration is now in the install-page first path instead of being buried after asset/ops sections.
- P1: add button focus-visible styling and visible disabled reasons for player primary actions.

## 2026-06-30 Party Run Capacity Anti-Farm Slice

- Added a server-authoritative `MAX_PARTY_RUN_MEMBERS = 4` cap for party runs.
- `joinPartyRun` now rejects the fifth identity with `party_run_full` before emitting `party_member_joined`, so over-cap members cannot receive party-run settlement rewards.
- Region commission read models now expose the same cap as `progress.target`, while `progress.current` remains the live member count. MCP/HTTP clients can show capacity before a user tries to join, but the core rule remains the authority.
- This is the smallest multiplayer anti-farm step after idempotency hardening: it prevents one open party run from becoming an unlimited reward faucet through many same-owner or alt identities.

Verification:

- `node --import tsx --test --test-name-pattern "party runs cap members|party runs create server-authoritative squads" ../agent-server/test/epoch-game-core.test.ts`: failed first because the fifth member joined; passed after adding the cap.
- `node --import tsx --test --test-name-pattern "MCP exposes owner-authorized party runs" ../agent-server/test/mcp.test.ts`: passed, including `progress.target === 4`.
- `node --import tsx --test --test-name-pattern "HTTP exposes owner-authorized party runs" ../agent-server/test/server.test.ts`: passed, including `progress.target === 4`.
- `npm run typecheck`: passed, including `check:no-js`, `check:no-explicit-any`, `typecheck:web` and `typecheck:agent`.
- `npm run agent:test`: passed 313 tests.
- `npm run build`: passed and regenerated the static world-map export.

Next highest-risk gap:

- Continue multiplayer anti-farm hardening with party-run invite/approval boundaries or raid pair cooldown/reward decay.

## 2026-06-30 Public Install Completion-State Slice

- Closed a human-facing install clarity gap on `/epoch/install`.
- The first viewport now keeps the four-step flow but also exposes a `完成状态` tile so a player can tell what proof each step needs before they try to play:
  - `已下载：安装包可访问`
  - `已选择宿主：五个宿主配置已生成`
- The page explicitly says MCP/Skill detection and one-turn proof require `npm run agent:install-smoke -- --json`; it must not claim those checks have already run.
- The status tile links to `/api/epoch/install-status`, keeping the install page script-free while pointing the player at live install truth data.
- The page still derives host names, package URL, primary host config and smoke command from the live install manifest instead of a separate hard-coded install source.

Verification:

- `node --import tsx --test --test-name-pattern "HTTP public install page surfaces recent world news" ../agent-server/test/server.test.ts`: failed first because the page had no `完成状态`; passed after rendering the completion-state tile.
- `npm run typecheck`: passed, including `check:no-js`, `check:no-explicit-any`, `typecheck:web` and `typecheck:agent`.

Next highest-risk gap:

- Continue multiplayer anti-farm hardening: party-run invite/capacity/approval boundaries or raid pair cooldown/reward decay.

## 2026-06-30 Public Install Host Config First-Path Slice

- Moved host-specific install configuration into the first `/epoch/install` flow.
- Step 2 now lists Claude Code, Codex, Cursor, Hermes and OpenClaw with each `${host} MCP JSON` label and package config path.
- The page derives this list from `manifest.hostInstall[].configSnippets[]`, so live manifest, package config files and the visible first-run path stay aligned.
- The host config block appears before the download section, reducing the chance that a newly installed user sees a package but misses how to wire their coding-agent host.

Verification:

- `npm run agent:test -- --test-name-pattern "HTTP public install page surfaces recent world news and legendary deaths"`: failed first because `/Claude Code MCP JSON/` was absent from the install step; passed after adding the first-path host config list.
- `npm run typecheck:agent`: passed in the subagent lane.
- `node --import tsx --test --test-name-pattern "HTTP operator maintenance run executes bounded server workers|HTTP public install page surfaces recent world news and legendary deaths" ../agent-server/test/server.test.ts`: passed after integrating with the new idempotency subject-binding behavior.

## 2026-06-30 NPC And Maintenance Idempotency Subject-Binding Slice

- Hardened `obsidian_epoch.npc_note` / `/api/epoch/npc/canonicalize` style server NPC writes so a reused idempotency key cannot replay against changed NPC payload.
- Hardened `obsidian_epoch.run_maintenance` / `/api/epoch/maintenance/run` so a reused maintenance idempotency key cannot silently change worker limits, regions or settlement options.
- Existing duplicate-call tests were corrected to replay the exact same payload instead of accidentally relying on key-only cache behavior.
- This closes a cheat class where an intercepted client or MCP adapter could try to reuse a successful key with changed subject parameters.

Verification:

- `node --import tsx --test --test-name-pattern "run_maintenance rejects idempotency replay" ../agent-server/test/mcp.test.ts`: failed before production hardening, passed after binding maintenance idempotency to the operator subject and full payload hash.
- `node --import tsx --test --test-name-pattern "npc_note rejects idempotency replay|run_maintenance rejects idempotency replay|MCP operator maintenance run executes bounded server workers|MCP exposes server-created NPC relationships" ../agent-server/test/mcp.test.ts`: passed.
- `node --import tsx --test --test-name-pattern "HTTP operator maintenance run executes bounded server workers|HTTP public install page surfaces recent world news and legendary deaths" ../agent-server/test/server.test.ts`: passed.

Remaining risk:

- Closed below: `recordNpcLifecycle` now has focused trust-boundary regression coverage and subject-bound idempotency.
- Closed below: player primary actions now have visible focus styling and disabled reasons.

## 2026-06-30 NPC Lifecycle Trust-Boundary Idempotency Slice

- Hardened direct runtime `recordNpcLifecycle` so a reused idempotency key cannot change `npcId`, `changes`, `sourceEventIds` or trust metadata after a successful server-worker write.
- Hardened public `tick_npc_lifecycle` MCP and HTTP entry points so a reused idempotency key cannot switch region or worker limit while receiving a cached duplicate result.
- The core rule still requires server trust for direct lifecycle recording; the new coverage closes the replay/adapter-hijack class around otherwise trusted server-worker calls.
- This specifically protects high-impact NPC state such as asset deltas, work status, marriage/household-derived state and generated lifecycle side effects from key-only replay confusion.

Verification:

- `node --import tsx --test --test-name-pattern "runtime NPC lifecycle record rejects idempotency replay" ../agent-server/test/epoch-game-core.test.ts`: failed first with `Missing expected exception`; passed after binding `record_npc_lifecycle` idempotency to the NPC subject and full payload hash.
- `node --import tsx --test --test-name-pattern "tick_npc_lifecycle rejects idempotency replay" ../agent-server/test/mcp.test.ts`: failed first with `Missing expected rejection`; passed after binding `tick_npc_lifecycle` idempotency to the system subject and full payload hash.
- `node --import tsx --test --test-name-pattern "tick_npc_lifecycle rejects idempotency replay|NPC lifecycle tick rejects idempotency replay" ../agent-server/test/mcp.test.ts ../agent-server/test/server.test.ts`: passed.
- `node --import tsx --test --test-name-pattern "runtime NPC lifecycle record rejects|tick_npc_lifecycle rejects|NPC lifecycle tick rejects|NPC lifecycle tick is server scheduled|MCP exposes server-created NPC relationships|HTTP exposes server-created NPC relationships" ../agent-server/test/epoch-game-core.test.ts ../agent-server/test/mcp.test.ts ../agent-server/test/server.test.ts`: passed.

Remaining risk:

- Closed below: player primary actions now have visible focus styling and disabled reasons.

## 2026-06-30 Agent Console Primary Action Accessibility Slice

- Added explicit `:focus-visible` styling for first-screen player action buttons, including a strong outline, offset and focus halo.
- Wrapped each first-screen primary action in a stable `.agent-player-action` block so disabled-state helper text does not shift unrelated controls.
- Added concrete disabled reasons for the identity, downtime, result/world and install-status actions.
- Disabled buttons now use `aria-describedby` pointing at the rendered reason text, so keyboard and assistive-technology users get the same explanation visible on screen.
- This improves the installed-agent waiting path: a user no longer has to infer why a primary action is unavailable from a gray button alone.

Verification:

- `node --import tsx --test --test-name-pattern "focus|disabled|player" src/agent/AgentExplorer.layout.test.ts`: failed first because `.agent-player-actions button:focus-visible` had no custom outline; passed after adding focus styling and disabled-reason markup.
- `node --import tsx --test src/agent/AgentExplorer.layout.test.ts`: passed 82 layout tests in the subagent lane.
- `npm run agent:ui-test`: passed 106 UI/API tests in the subagent lane.
- `npm run typecheck`: passed in the subagent lane, including no JS/MJS/JSX source files and no explicit production `any`.

Remaining risk:

- Run browser visual QA after integrating this slice, because the subagent intentionally did not capture screenshots.

## 2026-06-30 Market Risk Operator Idempotency Slice

- Hardened `obsidian_epoch.record_risk_review` so a reused operator idempotency key cannot switch `sourceEventId`, resolution or note after a successful review.
- Hardened `obsidian_epoch.release_market_risk_restriction` so a reused operator idempotency key cannot release a different agent's market restriction.
- This closes an economic safety gap in the anti-collusion pipeline: flagged trades, escalated restrictions and operator releases now preserve the original reviewed subject under replay.
- The existing market behavior remains intact: repeated counterparties and suspicious prices are still flagged, escalated reviews still restrict new market trades, and operator release still restores trading after review.

Verification:

- `node --import tsx --test --test-name-pattern "risk review rejects idempotency replay|market risk release rejects idempotency replay" ../agent-server/test/mcp.test.ts`: failed first with missing expected rejections; passed after binding risk review to `sourceEventId` and risk release to `agentId`.
- `node --import tsx --test --test-name-pattern "risk review rejects idempotency replay|market risk release rejects idempotency replay" ../agent-server/test/mcp.test.ts ../agent-server/test/server.test.ts`: passed across MCP and HTTP entry points.
- `node --import tsx --test --test-name-pattern "risk review|market risk|same explorer|suspicious prices|repeated counterparty" ../agent-server/test/epoch-game-core.test.ts ../agent-server/test/mcp.test.ts ../agent-server/test/server.test.ts`: passed 18 market/risk tests.

Remaining risk:

- Closed below: party-run invite-only admission now blocks uninvited joins and keeps invite hashes out of public MCP/HTTP responses, including idempotency duplicate responses.
- Closed below: raid pair cooldown now blocks immediate same-pair repeat raids before stamina spend, reward, influence, trace or retaliation writes.
- Closed below: invite-only party tokens now support expiry and explicit use limits, including one-shot invites.
- Closed below: explicit party join approval queues are now available through owner-authorized request and leader resolution tools.
- Still open: richer raid heat/live-ops beyond the hard one-hour pair cooldown plus reward decay.

## 2026-06-30 Party Invite-Only Admission Slice

- Added server-owned party join policy: `open` remains the compatibility default, while `invite_only` requires the leader to provide an invite token at party creation time.
- Invite-only joins now require the same token; missing tokens fail with `party_invite_required`, and wrong tokens fail with `party_invite_invalid`.
- The server stores only a SHA-256 invite token hash in the canonical projection/event stream and never returns that hash in public runtime command values, events or projections.
- MCP and HTTP schemas now expose `joinPolicy` and `inviteToken` for creation/join calls, while the public party view still strips internal invite hash material.
- Fixed an additional replay leak found during review: idempotency duplicate responses now use `publicProjection(core.project())` across runtime replay helpers, so cached duplicate calls cannot reveal invite hashes through the refreshed projection.

Verification:

- `node --import tsx --test --test-name-pattern "invite-only" ../agent-server/test/epoch-game-core.test.ts`: failed first because core did not record/enforce invite-only policy; passed after adding join policy and token checks.
- `node --import tsx --test --test-name-pattern "party run|party_run|invite|approval" ../agent-server/test/epoch-game-core.test.ts ../agent-server/test/mcp.test.ts ../agent-server/test/server.test.ts`: failed after adding duplicate-leak assertions because MCP/HTTP replay projections exposed `inviteTokenHash`; passed after routing duplicate projections through the public projection sanitizer.
- `npm run typecheck`: passed in the subagent lane before integration; the full integrated typecheck is tracked below in final verification.

Remaining risk:

- Closed below: this token gate is now complemented by explicit join request and leader approval tools.
- Closed below: invite tokens now expire and can be configured as single-use through `inviteTokenUseLimit: 1`.
- Closed below: invite rotation/revocation is implemented through `obsidian_epoch.update_party_invite`.
- Open parties remain valid for compatibility; party creators must explicitly choose `invite_only` for invitation-only admission.

## 2026-06-30 Party Invite Expiry And Use-Limit Slice

- Invite-only party creation now records public `inviteTokenExpiresAt`, `inviteTokenUseLimit` and `inviteTokenUses` state while keeping `inviteTokenHash` private.
- Default invite-only tokens expire after 24 hours and can be explicitly bounded by creation input; invalid or already-expired creation windows are rejected.
- `inviteTokenExpiresAt` is an exclusive cutoff: a join attempted exactly at the expiry instant is rejected.
- `inviteTokenUseLimit` defaults to the remaining party capacity for compatibility, and can be set to `1` for one-shot invites.
- Joining with the correct invite token now fails with `party_invite_expired` after the expiry time or `party_invite_exhausted` once the use limit is reached, before any member/event state is appended.
- MCP and HTTP party creation schemas accept `inviteTokenExpiresAt` and `inviteTokenUseLimit`; public entry tests verify both exhausted and expired invite errors.

Verification:

- `node --import tsx --test --test-name-pattern "party invite-only tokens expire" ../agent-server/test/epoch-game-core.test.ts`: failed first because invite use-limit state was absent; passed after recording expiry/use limit and enforcing joins.
- The same core test failed again after verifier review proved exact-expiry joins were accepted; passed after changing the expiry check to reject `joinedAt >= inviteTokenExpiresAt`.
- `node --import tsx --test --test-name-pattern "party run|party_run|invite|approval" ../agent-server/test/epoch-game-core.test.ts ../agent-server/test/mcp.test.ts ../agent-server/test/server.test.ts`: passed 6 party tests across core, MCP and HTTP.
- `npm run typecheck`: passed after the public schema/runtime updates.

Remaining risk:

- Leaders cannot yet rotate, revoke or reissue invite tokens after party creation.
- Closed below: explicit party join requests now form a leader approval queue.

## 2026-06-30 Raid Pair Cooldown Anti-Farm Slice

- Added a one-hour server-side cooldown for repeat raids between the same two identities in the same region, including reverse-direction retaliation farming attempts.
- `resolveRaid` checks the cooldown after active identity, ownership and stamina availability are validated, but before stamina is spent and before reward, influence, trace, news or retaliation events are emitted.
- HTTP now maps `raid_pair_cooldown_active` to a client-visible 400, and MCP/HTTP tests cover the public entry points.
- The cooldown preserves the existing raid/retaliation model: the first raid still creates the normal settlement, influence trace and retaliation opportunity, while the immediate repeat produces no second raid record.

Verification:

- `node --import tsx --test --test-name-pattern "raid|cooldown|retaliation" ../agent-server/test/epoch-game-core.test.ts ../agent-server/test/mcp.test.ts ../agent-server/test/server.test.ts`: failed first in the core lane with missing `raid_pair_cooldown_active`; passed after adding pair lookup and cooldown rejection.
- `node --import tsx --test --test-name-pattern "MCP Epoch tools expose server-issued identity|HTTP Epoch routes persist canonical events|HTTP raid resolution rejects immediate pair cooldown" ../agent-server/test/mcp.test.ts ../agent-server/test/server.test.ts`: passed after adding MCP and HTTP public-route assertions.
- `node --import tsx --test --test-name-pattern "party run|party_run|invite|approval|raid|cooldown|retaliation|risk review|market risk|same explorer|suspicious prices|repeated counterparty" ../agent-server/test/epoch-game-core.test.ts ../agent-server/test/mcp.test.ts ../agent-server/test/server.test.ts`: passed the combined multiplayer/economy anti-farm slice before final full-suite verification.

Remaining risk:

- The current rule is a hard one-hour rejection, not a softer diminishing-reward or heat/wanted-level system.
- The cooldown is per identity pair and region; broader faction, guild or area lockout policy is still future live-ops design.

## 2026-06-30 TypeScript-Only CommonJS Gate Slice

- Extended the no-JS source gate to reject `.cjs` files in addition to `.js`, `.jsx` and `.mjs`.
- Updated the gate output text so verification explicitly says `No JS/MJS/CJS/JSX source files found`.
- Added a dedicated regression test that creates only a `.cjs` source file, preventing the CommonJS case from being hidden behind an existing `.js` fixture failure.
- This closes the final caveat from the parallel verifier review: the workspace already had no `.cjs` source files, but the guard now rejects them automatically.

Verification:

- `node --import tsx --test --test-name-pattern "CommonJS source" ../agent-server/test/no-js-gate.test.ts`: failed first because `.cjs` files were not forbidden; passed after adding `.cjs` to `forbiddenExtensions`.
- `node --import tsx --test --test-name-pattern "CommonJS source|no-JS gate|explicit-any gate" ../agent-server/test/no-js-gate.test.ts`: passed 8 gate tests.
- `npm run check:no-js`: passed with `No JS/MJS/CJS/JSX source files found.`
- Independent `find` for `.js/.jsx/.mjs/.cjs` outside ignored build/dependency directories: no output.

## 2026-06-30 Integrated Verification After Anti-Cheat Slice

- `node --import tsx --test --test-name-pattern "party run|party_run|invite|approval|raid|cooldown|retaliation|risk review|market risk|same explorer|suspicious prices|repeated counterparty" ../agent-server/test/epoch-game-core.test.ts ../agent-server/test/mcp.test.ts ../agent-server/test/server.test.ts`: passed 31 focused multiplayer/economy anti-cheat tests.
- `npm run typecheck`: passed; includes no-JS/no-CJS source gate, no explicit production `any`, web typecheck and agent-server typecheck.
- `npm run agent:test`: passed 337/337 tests after the `.cjs` gate regression was added.
- `npm run build`: passed and exported `00_总览/黑曜纪元3D世界地图.html`.
- Parallel verifier review found no blocking issues after invite-only, raid cooldown and market-risk idempotency review.

Remaining risk:

- Full game completion is still not done. Remaining product lanes include richer invite audit/reissue UI, broader raid heat/live-ops, broader multiplayer territory conflict, production deployment hardening and browser visual QA after future UI changes.

## 2026-06-30 Next Full-Version Implementation Lanes

- Parallel architect review identified the next highest-value product lanes as alliance/frontline warfare, direct escrowed player trades, party or faction raid campaigns, stronger trusted-execution receipts, NPC lifecycle consequences, and install/result/web-bridge trust hardening.
- Recommended ordering is to open alliance/frontline and direct-trade lanes first, then make team raid/defense consume those social/economic states.
- The safety-oriented lanes can run in parallel: trusted execution receipts and install/result/web-bridge fail-closed messaging are mostly independent of alliance and economy changes.

Next suggested slices:

- Alliance/frontline layer: owner-authorized alliance membership, region frontlines and battle effects that cannot be forged through prompt text.
- Direct escrow trade: two-party offer/accept/cancel with locked resources/items, same-explorer anti-wash checks and risk-review escalation.
- Party/faction raid campaign: team roles affect settlement, defense is not just one identity's balance, and rewards/retaliation are server-settled.
- Trusted execution receipt pack: bind challenge, action option, transcript hash, attested signature and result page into replayable public evidence.

## 2026-06-30 Direct Escrow Trade Slice

- Added server-authoritative `direct_trade_created`, `direct_trade_accepted` and `direct_trade_cancelled` events plus `EpochProjection.directTrades`.
- Direct trades support resource-for-resource, resource-for-item, item-for-resource and item-for-item offers through one offered asset and one requested asset.
- `createDirectTrade` verifies active identities, proposer ownership, market-risk restrictions, self/same-explorer anti-wash rules, item ownership, bound-item status and existing item locks before any escrow event is emitted.
- Resource offers are escrowed with `resource_spent`; item offers reuse the existing inventory `marketLockedByOrderId` lock so binding, market listing and direct-trade double-locking all reject through the same server state.
- `acceptDirectTrade` rechecks the counterparty authorization, restrictions, current resource balance or requested item ownership, then atomically transfers both sides and closes the trade. Repeat counterparty direct trades within one hour receive the server risk flag `repeat_counterparty_trade`.
- Repeat direct-trade accepts now trigger a server-owned `risk_review_recorded` event with `resolution=escalated`, sourced to the `direct_trade_accepted` event, so the accepting identity is immediately placed under the existing market-risk restriction until an operator release.
- `cancelDirectTrade` resolves the proposer from the trade record, requires proposer recovery authorization, and refunds or unlocks the proposer's escrow without trusting client-declared ownership.
- Runtime, HTTP and MCP now expose `direct_trades`, `create_direct_trade`, `accept_direct_trade` and `cancel_direct_trade`; install manifests and the packaged skill/protocol docs list the new tools.
- Added `direct_trade_expired` plus `tickDirectTradeExpiry` so server maintenance can expire stale private escrow offers, refund offered resources or unlock offered items, and mark the trade `expired` without trusting the proposer or counterparty client.
- Runtime, HTTP, MCP, maintenance scheduler, install manifests and packaged skill/protocol docs now expose `tick_direct_trade_expiry` / `/api/epoch/direct-trades/expiry/tick`; maintenance env supports independent direct-trade TTL and limit knobs.
- Added browser Agent Console support for private escrow trades: API wrappers, shared frontend types, a `私下交易` panel beside the public market, resource/item offer and request controls, accept/cancel actions, and direct-trade expiry scan.
- Closed the manual requested-item gap: `inventory` / `/api/epoch/inventory` / `obsidian_epoch.inventory` now accept `tradable=true`, returning only unbound items that are not locked by market or direct-trade escrow; the Agent Console loads the counterparty's server-filtered tradable items and uses a selector instead of free-form requested `itemId` entry.

Verification:

- `node --import tsx --test ../agent-server/test/epoch-game-core.test.ts`: failed first because `createDirectTrade` did not exist; passed after adding core events, projection, reducers and commands.
- `node --import tsx --test ../agent-server/test/epoch-game-core.test.ts ../agent-server/test/mcp.test.ts ../agent-server/test/server.test.ts`: failed once because MCP active-only tool audit did not include `accept_direct_trade`; passed after adding direct trade tools to `EPOCH_ACTIVE_IDENTITY_TOOL_NAMES`.
- The final focused run passed 222/222 tests across core, MCP and HTTP.
- `node --import tsx --test ../agent-server/test/mcp.test.ts ../agent-server/test/server.test.ts ../agent-server/test/maintenance.test.ts`: failed first on missing MCP tool, HTTP route and maintenance config/tick support; passed after wiring direct-trade expiry through runtime, MCP, HTTP and maintenance.
- `node --import tsx --test src/agent/api.test.ts src/agent/AgentExplorer.layout.test.ts`: failed first because direct-trade API exports and the Agent Console panel were absent; passed after adding wrappers, types and UI.
- `npm run typecheck`: passed after the browser UI slice; no JS/MJS/CJS/JSX source and no explicit-any production TypeScript violations.
- `node --import tsx --test ../agent-server/test/server.test.ts src/agent/api.test.ts src/agent/AgentExplorer.layout.test.ts`: failed first because `tradable` inventory reads and counterparty-item loading were absent; passed after adding server filtering, API query support and the UI selector.
- `npm run typecheck`: passed again after the counterparty tradable-item selector; no JS/MJS/CJS/JSX source and no explicit-any production TypeScript violations.
- `node --import tsx --test ../agent-server/test/epoch-game-core.test.ts ../agent-server/test/server.test.ts ../agent-server/test/mcp.test.ts --test-name-pattern "repeat direct trades|HTTP direct trades escrow|MCP direct trades escrow"`: failed first because repeat direct trades stopped at `tradeRiskFlags`; passed after auto-emitting a server-owned escalated risk review and checking core, HTTP and MCP restriction visibility.
- `npm run typecheck`: passed after the automatic direct-trade risk escalation slice; no JS/MJS/CJS/JSX source and no explicit-any production TypeScript violations.

Remaining risk:

- The browser direct-trade panel now removes free-form requested item entry, but richer inbound/outbound tabs and item search filters are still future polish.

## 2026-06-30 Region Frontline Read Model Slice

- Added a server-derived `frontlines` read model to `epochRegionInfo` / `/api/epoch/region/{regionId}` / `obsidian_epoch.region_info`.
- Frontlines are derived from canonical `raid_resolved`, `retaliation_opportunity_created`, `trace_created` and positive `relationship_updated(kind=alliance)` projection state; clients cannot declare pressure, status, participants or revenge windows.
- Each frontline exposes the latest raid pair, attacker/defender side agent ids, one-hop alliance side expansion, attacker/defender pressure, pressure delta, status (`attacker_advancing`, `defender_holding`, `contested`), latest trace and open retaliation ids.
- The public region page now renders `区域前线` beside conflict traces and retaliation opportunities so shared web pages show live multiplayer pressure, not only historical raid rows.
- The browser Agent Console region panel now surfaces `区域前线` rows with pressure, side counts and available retaliation windows.

Verification:

- `node --import tsx --test ../agent-server/test/server.test.ts ../agent-server/test/mcp.test.ts src/agent/AgentExplorer.layout.test.ts --test-name-pattern "frontlines|region panel surfaces server-derived frontlines"`: failed first because region reads and UI did not expose frontlines; passed after adding the read model, public page rendering and console UI.
- `npm run typecheck`: passed after the frontline slice; no JS/MJS/CJS/JSX source and no explicit-any production TypeScript violations.

Remaining risk:

- Frontlines currently use one-hop `relationship.kind=alliance` for side expansion. The stronger follow-up is owner-authorized organization membership writes that emit `organization_membership_changed` through HTTP/MCP, then using membership as the primary alliance/faction side source.
- Frontline pressure is read-only and raid/retaliation-derived; basic support party-role synergy is closed below, while richer battle effects, broader role matrices and season-control feedback are still future gameplay work.

## 2026-06-30 Agent Organization Membership Slice

- Added owner-authorized agent organization membership writes through the canonical `organization_membership_changed` event instead of allowing clients or prompts to declare faction identity.
- `EpochOrganization` now tracks `memberNpcIds` and `memberAgentIds` separately; `EpochOrganizationMembership` records `memberType`, optional `npcId`, optional `agentId` and optional `explorerId`.
- `EpochProjection` now indexes memberships by `agentId` as well as NPC, organization and region, so a single agent can query its active organization identities without scanning all regional NPC records.
- `updateOrganizationMembership` requires an active server-issued identity, recovery/confirmation owner auth and an existing server-created organization; organization name, region and explorer are derived from server state.
- Region frontlines now prefer active same-organization agent memberships as side expansion and only fall back to alliance relationships when no organization side exists.
- Runtime, HTTP and MCP expose `obsidian_epoch.update_organization_membership` / `POST /api/epoch/organizations/membership`; packaged install manifests and the Skill protocol reference list the new tool.
- Browser API/types now support `getEpochOrganizations({ agentId })` and `updateEpochOrganizationMembership(...)`; the Agent Console region panel displays `NPC x / Agent y` organization membership counts.

Verification:

- `node --import tsx --test --test-name-pattern "organization membership feeds|agent organization membership" ../agent-server/test/epoch-game-core.test.ts ../agent-server/test/server.test.ts ../agent-server/test/mcp.test.ts`: failed first on missing owner-authorized membership flow, then passed after core/runtime/HTTP/MCP wiring.
- `npm run agent:test`: passed 354/354 after active-tool, package-manifest and HTTP expectation fixes.
- `node --import tsx --test --test-name-pattern "organization" src/agent/AgentExplorer.layout.test.ts src/agent/api.test.ts`: failed first because the browser API/UI did not expose agent organization membership, then passed after the frontend type/API/UI slice.
- `npm run typecheck`: passed after the frontend type/API/UI slice; no JS/MJS/CJS/JSX source and no explicit-any production TypeScript violations.
- `npm run build`: passed and exported `00_总览/黑曜纪元3D世界地图.html`.

Remaining risk:

- Organizations are still created by server/NPC lifecycle flows; a richer operator/admin organization-creation route is future work.
- The Agent Console can query and display membership but does not yet include a polished join/leave button surface; agents can use the MCP/HTTP command directly.
- Organization membership influences frontage side expansion, and basic support party-role synergy is closed below; season control, faction reputation and deeper party-role battle matrices still need richer gameplay settlement rules.

## 2026-07-01 Agent Organization Membership Review Fix Slice

- Fixed an edge case where attacker and defender sharing the same active organization could appear in each other's `region_info.frontlines` side lists.
- Added disjoint frontline side normalization: both primary combatants remain on their own side, the opposing primary is removed, and overlapping non-primary members are kept on one side instead of appearing in both public side lists.
- Extended HTTP and MCP organization membership tests to cover owner-authorized idempotent replay (`duplicate=true`, no duplicate events) and same-key changed `role` / `status` rejection with `idempotency_key_conflict`.
- Updated `obsidian_epoch.region_info` MCP schema and description to expose `frontlineLimit` and document `frontlines[]` side ids, pressure fields, status and trace/retaliation links.
- Updated packaged Skill and protocol guidance so installed agents discover `region_info.frontlines` and do not invent regional battle lines from prompt prose or local MCP state.

Verification:

- `node --import tsx --test --test-name-pattern "organization membership feeds" ../agent-server/test/server.test.ts ../agent-server/test/mcp.test.ts`: failed first because same-organization frontlines overlapped, then passed after disjoint side normalization.
- `node --import tsx --test --test-name-pattern "organization membership feeds|MCP tool registry|region_info|organization" ../agent-server/test/server.test.ts ../agent-server/test/mcp.test.ts src/agent/api.test.ts src/agent/AgentExplorer.layout.test.ts`: passed 8/8.
- `npm run typecheck`: passed, including no JS/MJS/CJS/JSX source, no explicit production `any`, web typecheck and agent-server typecheck.
- `npm run agent:test`: passed 354/354.
- `npm run build`: passed and exported `00_总览/黑曜纪元3D世界地图.html`.

Remaining risk:

- Shared-organization internal conflicts are now display-safe, but there is not yet a richer first-class `internal_conflict` frontline status or explicit supporter-selection mechanic.

## 2026-07-01 Agent Console Organization Membership Controls Slice

- Added an owner-authorized Agent Console control surface for joining or leaving existing server-created organizations from the regional organization list.
- The browser UI now imports `updateEpochOrganizationMembership`, sends the active `agentId`, selected server-known role, target `organizationId`, `active` / `left` status, explorer recovery authorization and a `web_organization_membership` idempotency key.
- After a membership write, the console refreshes identity progress and region state so organization membership counts and frontline side expansion update without requiring a manual reload.
- Organization rows now show whether the current identity has joined, expose a role selector over the server-known membership roles, and disable join/leave actions when the identity is inactive, busy, missing explorer recovery state or already in the requested state.

Verification:

- `node --import tsx --test --test-name-pattern "organization membership" src/agent/AgentExplorer.layout.test.ts`: failed first because the console lacked the API import, handler and controls; passed after the UI slice.
- `node --import tsx --test --test-name-pattern "organization" src/agent/AgentExplorer.layout.test.ts src/agent/api.test.ts ../agent-server/test/server.test.ts ../agent-server/test/mcp.test.ts`: passed 8/8.
- `npm run typecheck`: passed, including no JS/MJS/CJS/JSX source, no explicit production `any`, web typecheck and agent-server typecheck.
- `npm run build`: passed and exported `00_总览/黑曜纪元3D世界地图.html`.
- `npm run agent:test`: passed 354/354.

Remaining risk:

- The organization controls are intentionally compact inside the regional list. A fuller version should add a dedicated organization management panel with search, membership history and safer internal-conflict supporter selection.

## 2026-07-01 Organization Season Rewards And Prestige Slice

- Added a server-authoritative organization reward layer to `settleSeasonCampaign`: when a winning agent belongs to an active organization in the season region, every active agent member in that organization receives a deterministic organization season dividend.
- Added the canonical `organization_prestige_changed` event. It updates `organizationPoliticalStandingByOrganization`, records a region activity, and is folded into the organization-politics maintenance overview instead of letting clients invent organization prestige.
- Exposed `organization.standing` through runtime organization views and browser types, then surfaced it in the Agent Console organization row beside NPC / Agent membership counts.
- Kept the existing single-agent season winner reward intact; organization dividends are additional shared rewards derived only from server-settled season results.

Verification:

- `node --import tsx --test --test-name-pattern "season settlement grants organization dividends" ../agent-server/test/epoch-game-core.test.ts`: failed first because no `organization_prestige_changed` event or organization dividends existed; passed after the core reward slice.
- `node --import tsx --test --test-name-pattern "region panel distinguishes NPC" src/agent/AgentExplorer.layout.test.ts`: failed first because the console did not read or render `organization.standing`; passed after runtime/browser/UI wiring.
- `node --import tsx --test --test-name-pattern "season settlement grants organization dividends|seasonal faction campaigns|organization politics|agent organization membership" ../agent-server/test/epoch-game-core.test.ts`: passed 4/4.
- `npm run typecheck`: passed, including no JS/MJS/CJS/JSX source, no explicit production `any`, web typecheck and agent-server typecheck.
- `npm run build`: passed and exported `00_总览/黑曜纪元3D世界地图.html`.
- `npm run agent:test`: passed 355/355.

Remaining risk:

- Organization rewards now exist at the core season layer, but there is still no dedicated organization management panel, no treasury ledger, no organization-level shop/upgrades, and no supporter-selection UI for internal conflicts.

## 2026-07-01 Organization Treasury Resource Pool Slice

- Added the canonical `organization_treasury_changed` event and `organizationTreasuryBalances` projection so organizations now have a server-owned resource pool instead of only member dividends and prestige.
- `settleSeasonCampaign` now deposits the season winner reward resource into the winner's active organization treasury while keeping the individual winner reward and organization member dividends intact.
- Runtime organization views now expose `organization.treasury`, HTTP/MCP organization read tests lock the public shape, and the Agent Console organization row shows a compact treasury summary.
- The treasury is write-only from server settlement logic in this slice; no client-facing command can mint or edit organization resources directly.

Verification:

- `node --import tsx --test --test-name-pattern "season settlement grants organization dividends" ../agent-server/test/epoch-game-core.test.ts`: failed first because no `organization_treasury_changed` event or `organizationTreasuryBalances` projection existed; passed after the treasury slice.
- `node --import tsx --test --test-name-pattern "season settlement grants organization dividends|seasonal faction campaigns|organization politics|agent organization membership" ../agent-server/test/epoch-game-core.test.ts`: passed 4/4.
- `node --import tsx --test --test-name-pattern "server-created NPC organizations careers and locations|region panel distinguishes NPC" ../agent-server/test/server.test.ts ../agent-server/test/mcp.test.ts src/agent/AgentExplorer.layout.test.ts`: passed 3/3.
- `npm run typecheck`: passed, including no JS/MJS/CJS/JSX source, no explicit production `any`, web typecheck and agent-server typecheck.
- `npm run build`: passed and exported `00_总览/黑曜纪元3D世界地图.html`.
- `npm run agent:test`: passed 355/355.

Remaining risk:

- The treasury can receive server settlement deposits, but there is not yet a withdrawal path, organization upgrade shop, treasury ledger browser, or permission model for officer/member spending.

## 2026-07-01 Organization Treasury Upgrade Shop Slice

- Added the first server-authoritative organization upgrade catalog entry, `training_hall`, priced by the server at `legend:2`.
- Added `purchaseOrganizationUpgrade` in the Epoch core. The command requires an active owner-authenticated identity, active membership in the target organization, an existing server-created organization, sufficient organization treasury balance and a server-known `upgradeKey`; it rejects duplicate purchases and never accepts client-declared costs, titles, benefits or balances.
- Added canonical `organization_upgrade_purchased` events, `organizationUpgrades` projection state and `organizationUpgradeIdsByOrganization` indexes. Purchases first emit a negative `organization_treasury_changed` event, then record the upgrade with the treasury spend event as source evidence.
- Exposed the purchase through HTTP (`POST /api/epoch/organizations/upgrades/purchase`), MCP (`obsidian_epoch.purchase_organization_upgrade`), active-identity tool coverage, package install manifests and packaged protocol docs.
- Runtime organization reads now support `organizationId` filtering and return `upgradeKeys` / `upgrades` beside `standing` and `treasury`.
- The Agent Console organization row now shows purchased upgrade keys, provides a server-catalog upgrade selector, and lets an active member buy an organization upgrade with explorer recovery authorization and `web_organization_upgrade` idempotency.

Verification:

- `npm run agent:test -- --test-name-pattern "organization upgrade purchase spends treasury"`: failed first because `purchaseOrganizationUpgrade` did not exist, then passed after core event/projection/command implementation.
- `npm run agent:test -- --test-name-pattern "MCP tool registry exposes agent world tools|MCP purchases organization upgrades|HTTP purchases organization upgrades|downloadable package contains skill"`: passed 358/358 after runtime, HTTP, MCP and package manifest wiring.
- `npm run agent:ui-test -- src/agent/api.test.ts src/agent/AgentExplorer.layout.test.ts`: passed 113/113 after browser API and Agent Console controls were wired.
- `npm run typecheck`: passed, including no JS/MJS/CJS/JSX source, no explicit production `any`, web typecheck and agent-server typecheck.
- `npm run build`: passed and exported `00_总览/黑曜纪元3D世界地图.html`.
- `npm run agent:test`: passed 358/358.
- `npm run batch:test`: passed 11/11.
- `git diff --check -- ...`: passed for the touched implementation, test and documentation files.

Remaining risk:

- The upgrade catalog has only the first minimal entry and no full organization tech tree, effect settlement, vote/officer permission model or treasury history panel yet.

## 2026-07-01 Training Hall Season Contribution Effect Slice

- Turned the first organization upgrade from a purchased label into a server-authoritative gameplay effect: an active member of an organization that owns `training_hall` receives a non-stacking +1 score-only bonus when contributing to a season in that organization's region.
- Kept resource accounting separate from score accounting. `season_contribution_recorded.amount` remains the real resource spent, while `baseScoreDelta`, `organizationBonusScore`, final `scoreDelta` and `sourceOrganizationUpgradeIds` explain the server-derived score result.
- The bonus is derived only from server projection state: active organization membership, campaign region and purchased organization upgrades. No MCP, HTTP, browser or prompt path can submit a bonus field.
- Runtime leaderboards, objectives, faction standings, agent standings, season settlement and region control continue to consume final `scoreDelta`, so the effect automatically participates in downstream MMO progression without minting resources.
- Updated MCP tool descriptions, packaged protocol docs, packaged Skill guidance, architecture notes, Agent Console upgrade text and public season archive labels so players see the difference between resource input and final season score.
- Added an Agent Console contribution receipt that displays the latest season contribution as `基础分 + 组织加成 = 最终分`, with resource input and upgrade evidence ids when present.

Verification:

- `npm run agent:test -- --test-name-pattern "training hall adds server-side season contribution score"`: failed first because `baseScoreDelta` was missing from the contribution event, then passed after core settlement logic and payload fields were implemented.
- `npm run agent:test -- --test-name-pattern "training hall adds|MCP exposes seasonal faction campaigns|HTTP exposes seasonal faction campaigns"`: passed 359/359 after MCP and HTTP response assertions were added.
- `npm run agent:ui-test -- src/agent/AgentExplorer.layout.test.ts src/agent/api.test.ts`: passed 114/114 after the console exposed the training hall effect text and latest contribution receipt.
- `npm run agent:ui-test -- --test-name-pattern "latest season contribution score breakdown" src/agent/AgentExplorer.layout.test.ts`: failed first because no `lastSeasonContribution` state existed, then passed after the contribution receipt was wired.
- `npm run typecheck`: passed, including no JS/MJS/CJS/JSX source, no explicit production `any`, web typecheck and agent-server typecheck.
- `npm run build`: passed and exported `00_总览/黑曜纪元3D世界地图.html`.
- `npm run batch:test`: passed 11/11.
- `git diff --check -- ...`: passed for the touched implementation, test and documentation files.

Remaining risk:

- The Agent Console shows the latest contribution receipt, but there is not yet a full season event-history drawer for comparing every past contribution and bonus source.

## 2026-07-01 Organization Treasury Ledger Slice

- Added a server-derived organization treasury ledger read model over canonical `organization_treasury_changed` events. Each row exposes the organization, resource id, amount delta, balance after, reason, source event id, trust class and recorded time; clients can inspect evidence but cannot submit ledger rows.
- Runtime organization views now return `treasuryLedger` alongside `standing`, `treasury`, `upgradeKeys` and `upgrades`. HTTP and MCP organization reads also support direct `organizationId` lookup with the same ledger shape, while `region_info.organizations[]` carries the recent ledger for nearby context.
- The Agent Console organization panel now shows a compact `组织金库流水` section with recent deltas, balances, reason labels and source-event receipts so players can see where treasury deposits and upgrade spends came from.
- Packaged protocol and Skill guidance now tell installed agents to treat organization treasury history as server-only evidence and to reject prompt-authored treasury balances, upgrade purchases or spend receipts.

Verification:

- `npm run agent:test -- --test-name-pattern "MCP purchases organization upgrades|HTTP purchases organization upgrades"`: failed first because organization reads lacked `treasuryLedger`, then passed after runtime projection and HTTP/MCP wiring.
- `npm run agent:ui-test -- --test-name-pattern "organization treasury ledger" src/agent/AgentExplorer.layout.test.ts`: failed first because the Agent Console did not render the ledger, then passed after the UI section and CSS were added.

Remaining risk:

- The ledger is intentionally compact and read-only; there is still no full organization treasury history drawer, officer approval workflow, multi-upgrade tech tree or member-facing treasury governance screen.

## 2026-07-01 Organization Treasury Member Contribution Slice

- Added the first player-facing organization treasury funding path: active organization members can contribute their own resources into the server-owned organization treasury.
- The core command spends the member's real balance with `resource_spent` before emitting `organization_treasury_changed`, so clients can submit only `agentId`, `organizationId`, `resourceId` and `amount`; they cannot declare balance-after values, treasury rows or rewards.
- Exposed the contribution through MCP (`obsidian_epoch.contribute_organization_treasury`), HTTP (`POST /api/epoch/organizations/treasury/contribute`), active-identity lifecycle audit coverage, install manifests and the Web Agent Console.
- The Agent Console organization row now lets active members pick a resource and amount, then `捐入金库`; the existing treasury ledger immediately shows the server receipt as a member contribution.
- Packaged protocol and Skill guidance now explicitly tell installed agents to treat treasury contributions as owner-authorized resource spending, not prompt-authored organization income.

Verification:

- `npm run agent:test -- --test-name-pattern "organization treasury contribution|contributes member resources"`: failed first because `contributeOrganizationTreasury` / MCP / HTTP did not exist, then passed after core, runtime, MCP, HTTP and manifest wiring.
- `npm run agent:test -- --test-name-pattern "MCP tool registry exposes|downloadable package contains skill|contributes member resources"`: passed 362/362 after active-only audit coverage and packaged install manifests were synchronized.
- `npm run agent:ui-test -- --test-name-pattern "organization treasury|Epoch organization API" src/agent/AgentExplorer.layout.test.ts src/agent/api.test.ts`: passed 116/116 after the API wrapper and console controls were wired.

Remaining risk:

- Members can now fund the treasury, but spending governance is still limited to direct upgrade purchase by any active member. The next organization-governance slice should add budget proposals, approvals/rejections, officer/member permissions and a fuller treasury history drawer.

## 2026-07-01 Organization Budget Governance Slice

- Added a two-step server-authoritative organization budget workflow. Active members can create `organization_budget_proposed` records, but proposals do not change treasury balances.
- Added `resolveOrganizationBudget`: a different active member may approve or reject a proposed budget. Approval rechecks the current organization treasury, emits a negative `organization_treasury_changed`, then records `organization_budget_resolved`; rejection records only `organization_budget_resolved`.
- Added `organizationBudgets` projection state and `organizationBudgetIdsByOrganization`; runtime organization views and `region_info.organizations[]` now expose recent budgets beside treasury, ledger and upgrades.
- Exposed the workflow through MCP (`obsidian_epoch.propose_organization_budget`, `obsidian_epoch.resolve_organization_budget`), HTTP (`POST /api/epoch/organizations/budgets/propose`, `/resolve`), active-identity audit coverage, install manifests, packaged protocol docs and the Agent Console.
- The Agent Console organization row now renders `组织预算提案`, lets active members submit a budget, and shows `批准预算` / `拒绝预算` controls for pending budgets. Self-approval is disabled in the UI and still rejected by the server.
- Fixed a budget-id collision found by the governance test: multiple proposals by the same agent/resource in the same server tick now include the proposal title in the ID seed.

Verification:

- `node --import tsx --test --test-name-pattern "organization budget proposals" ../agent-server/test/epoch-game-core.test.ts`: failed first because `proposeOrganizationBudget` did not exist, then failed on same-tick budget ID collision, then passed after the budget core and ID fix.
- `npm run agent:test -- --test-name-pattern "MCP proposes and resolves organization budgets|HTTP proposes and resolves organization budgets|MCP tool registry exposes"`: MCP/HTTP budget paths passed after runtime, tool and route wiring; package manifest coverage initially caught missing install-manifest entries and was fixed.
- `npm run agent:ui-test -- --test-name-pattern "organization budget|Epoch organization API|organization budget proposals" src/agent/AgentExplorer.layout.test.ts src/agent/api.test.ts`: passed 117/117 after API wrappers and Agent Console controls were wired.

Remaining risk:

- Governance is still simple cross-member approval, not role-gated officer voting or multi-signature treasury policy. There is no full organization budget history drawer yet.

## 2026-07-03 Organization Budget History Visibility Slice

- Added a full organization budget history disclosure to the Agent Console organization panel while keeping the existing compact budget preview and action buttons.
- The compact view still shows the immediate pending governance surface; the history disclosure lists every visible organization budget, its thresholds, proposal/resolution timing and all recorded votes.
- Kept the trust boundary unchanged: the UI only renders server-projected `organization.budgets[]` and `budget.votes[]`; it does not invent budget status, vote counts or treasury spend receipts.
- Added a layout guard so future UI compaction cannot silently hide complete budget history behind the first three preview rows.

Verification:

- `npm run agent:ui-test -- --test-name-pattern "full organization budget history" src/agent/AgentExplorer.layout.test.ts`: failed first because no full budget history disclosure existed, then passed after the UI and CSS slice.
- `npm run agent:test -- --test-name-pattern "organization budget proposals|governance roles and multisig"`: passed 377/377, including role-gated resolution and high-value two-vote quorum coverage.

Remaining risk:

- Budget history is now visible but intentionally compact. A richer organization governance page could later add filtering, budget-only search and per-budget treasury receipt drilldown.

## 2026-07-03 Season Contribution History Visibility Slice

- Added a local Agent Console contribution receipt history for the active season, keeping the existing latest receipt while exposing recent contribution score breakdowns in a disclosure.
- Each retained receipt is derived only from the server-returned `season_contribution_recorded` event and shows resource input, base score, organization bonus, final score and upgrade evidence ids.
- Kept history as a short-lived console receipt list rather than canonical state. The authoritative season totals, phase events and standings still come from the server season projection.

Verification:

- `npm run agent:ui-test -- --test-name-pattern "latest season contribution" src/agent/AgentExplorer.layout.test.ts`: failed first because the console had only `lastSeasonContribution`, then passed after adding `seasonContributionHistory`, the disclosure UI and CSS.

Remaining risk:

- Contribution history is local to the current browser session. A future server projection could expose full contribution receipts for cross-device season audit views.

## 2026-07-03 Server-Projected Season Contribution History Slice

- Added canonical `EpochSeasonContribution` receipts to the season campaign projection. Each `season_contribution_recorded` event now appends a read-only contribution record with event id, agent/explorer/faction ids, resource input, base score, organization bonus, final score, post-contribution totals, trust class, upgrade evidence ids and recorded time.
- Kept score settlement unchanged: resource spending, objective completion, faction standings and trusted-score accounting still come from the existing server event flow; the new list is an audit projection over the same canonical events.
- Exposed the contribution receipts through runtime season views, HTTP `/api/epoch/seasons` and MCP `obsidian_epoch.seasons` / `obsidian_epoch.contribute_season` because those surfaces return the same season campaign view.
- Updated the Agent Console season panel to prefer `primarySeason.contributions` for history while preserving the local just-submitted receipt as a refresh-gap fallback. The disclosure now shows server-projected agent and trust-class evidence alongside the score breakdown.
- Added frontend protocol typing for `EpochSeasonContribution` so future UI work cannot silently treat season receipts as untyped ad hoc JSON.

Verification:

- `npm run agent:test -- --test-name-pattern "seasonal faction campaigns|training hall adds server-side season contribution"`: failed first because `contributions` was undefined in core, HTTP and MCP season campaign views, then passed 377/377 after projection and view propagation.
- `npm run agent:ui-test -- --test-name-pattern "latest season contribution"`: failed first because `EpochSeasonContribution` and `primarySeason.contributions` were missing, then passed 124/124 after typing and UI consumption.

Remaining risk:

- Contribution history is now cross-device and server-projected, but it is still rendered as a compact disclosure inside the Agent Console. A future season archive page could add filtering, event links and faction/agent drilldowns for longer-running campaigns.

## 2026-07-03 Public Season Archive Contribution Audit Slice

- Promoted season contribution receipts into the public season archive view. `epochSeasonArchive` now returns filtered `contributions[]` audit rows with event, agent, explorer, faction-filter and agent-filter public links.
- Added read-only archive filters for `factionId` and `agentId` through MCP `obsidian_epoch.season_archive` and HTTP `/epoch/season/{seasonId}?factionId=...&agentId=...`. Filters affect only the archive read model and never mutate season settlement state.
- Updated the public `/epoch/season/{seasonId}` page with a `赛季贡献审计` section that shows each contribution's agent, faction, audit event, explorer, trust class, resource input, base score, organization bonus, final score and upgrade evidence summary.
- Fixed public-page path parsing so query strings no longer become part of the final path segment. This keeps filtered season archive URLs from accidentally resolving as missing season ids.

Verification:

- `npm run agent:test -- --test-name-pattern "seasonal faction campaigns"`: failed first because MCP archive results lacked `contributions[]` and the public season page lacked `赛季贡献审计`, then passed 377/377 after runtime, MCP schema, HTTP query and HTML rendering changes.

Remaining risk:

- Public season archive now supports contribution audit links and simple faction/agent filtering. Longer campaigns could still benefit from pagination, chronological grouping and visual score-delta charts before a production live season with many contribution rows.

## 2026-07-03 Season Archive Contribution Pagination Slice

- Added contribution audit pagination metadata to the public season archive read model: `total`, `limit`, `offset`, `nextOffset` and `previousOffset`. The archive defaults to the first 20 filtered contribution rows and caps requested pages at 50 rows.
- Extended MCP `obsidian_epoch.season_archive` and HTTP `/epoch/season/{seasonId}` with read-only `contributionLimit` / `contributionOffset` inputs. These only page the archive projection and never affect season settlement state.
- Sorted archive contribution audit rows newest-first for long resolved seasons, while preserving faction and agent filters before pagination.
- Added a `scoreDeltaRatio` field to each archive contribution audit row and rendered a public-page `score-delta-bar` beside the contribution score breakdown, so large and small contribution deltas are scan-friendly.
- Added public page previous/next controls that preserve active `factionId` and `agentId` filters while moving through contribution pages.

Verification:

- `node --import tsx --test --test-name-pattern "HTTP exposes seasonal faction campaigns" ../agent-server/test/server.test.ts`: failed first because the public season page lacked `score-delta-bar` and page range text, then passed after HTML pagination and score-bar rendering.
- `node --import tsx --test --test-name-pattern "MCP exposes seasonal faction campaigns" ../agent-server/test/mcp.test.ts`: failed first because archive results lacked `contributionPagination`, then passed after runtime pagination and MCP schema wiring.

Remaining risk:

- The archive now pages and visualizes contribution score deltas, but it still uses a compact list rather than time-bucket grouping or richer charts for very large production seasons.

## 2026-07-03 Season Archive Contribution Date Grouping Slice

- Added `contributionGroups[]` to the public season archive read model. Groups are derived from the already-filtered and paginated contribution audit rows, so long seasons keep the same page size while each visible page is easier to scan chronologically.
- Each group exposes `recordedDate`, `contributionCount`, `scoreDeltaTotal` and the grouped contribution audit rows. The grouping is server-projected from canonical `recordedAt` timestamps; clients cannot submit group headers or totals.
- Updated the public season archive page to render date group headers such as `贡献日期 2026-06-26`, with contribution count and score total before the rows for that day.
- Preserved the existing faction/agent filters, newest-first ordering, score-delta bars and previous/next contribution pagination controls.

Verification:

- `node --import tsx --test --test-name-pattern "MCP exposes seasonal faction campaigns" ../agent-server/test/mcp.test.ts`: failed first because `contributionGroups` was undefined, then passed after runtime grouping was added.
- `node --import tsx --test --test-name-pattern "HTTP exposes seasonal faction campaigns" ../agent-server/test/server.test.ts`: failed first because the public season archive page lacked date group headers, then passed after grouped rendering was added.

Remaining risk:

- The archive now has page-local date grouping and score bars, but it still does not expose aggregate charts across all pages or downloadable season audit exports.

## 2026-07-03 Season Archive Contribution Trend Summary Slice

- Added `contributionDailyTotals[]` to the public season archive read model. The totals are derived from all currently filtered contribution audit rows before pagination, so the trend summary remains complete even when the contribution audit list is showing only one page.
- Each trend row exposes the contribution date, contribution count, score total, resource amount total and a score ratio for public bar rendering.
- Added a public-page `贡献趋势` section that summarizes total visible-filter contribution count and score, then renders daily trend rows with score bars.
- Kept `contributionGroups[]` page-local and unchanged. It still groups only the current audit page, while `contributionDailyTotals[]` answers the cross-page overview question.

Verification:

- `node --import tsx --test --test-name-pattern "MCP exposes seasonal faction campaigns" ../agent-server/test/mcp.test.ts`: failed first because `contributionDailyTotals` was undefined, then passed after runtime trend totals were added.
- `node --import tsx --test --test-name-pattern "HTTP exposes seasonal faction campaigns" ../agent-server/test/server.test.ts`: failed first because the public page lacked `贡献趋势`, then passed after the trend section was rendered.

Remaining risk:

- The archive now exposes cross-page daily trend bars, but it still does not offer a downloadable season audit export for offline review.

## 2026-07-03 Season Archive Contribution Export Slice

- Added a public downloadable JSON export at `/epoch/season/{seasonId}/audit-export.json` for season contribution audits.
- The export preserves `factionId` and `agentId` filters, ignores browser pagination inputs, and internally pages through the archive projection in 50-row chunks so the offline file contains the full filtered contribution set.
- The export payload includes the season view, filters, contribution counts, score/resource totals, daily totals, contribution audit rows and public page links. It is returned as `application/json` with an attachment `Content-Disposition`.
- Added a `下载贡献审计 JSON` link to the public season archive page. Filtered season pages keep the same filter in the export link.

Verification:

- `node --import tsx --test --test-name-pattern "HTTP exposes seasonal faction campaigns" ../agent-server/test/server.test.ts`: failed first because the public page had no export link, then passed after the download link, JSON attachment route and full filtered export payload were added.

Remaining risk:

- The archive now supports offline JSON audit review. A future polish pass could add CSV export or signed export manifests if operators need spreadsheet-first workflows or tamper-evident downloaded bundles.

## 2026-07-03 Season Archive Contribution CSV Export Slice

- Added a spreadsheet-first CSV companion export at `/epoch/season/{seasonId}/audit-export.csv` for public season contribution audits.
- The CSV export reuses the same server-derived full filtered contribution set as the JSON export, preserves `factionId` / `agentId` filters, ignores browser pagination inputs and returns an attachment with `text/csv; charset=utf-8`.
- CSV rows include public audit, agent and explorer URLs plus resource input, base score, organization bonus, upgrade evidence ids, final score, trust class and recorded timestamps. The export does not expose private fields beyond the existing public archive/JSON audit surface.
- Added a `下载贡献审计 CSV` link beside the JSON export on public season archive pages. Filtered season pages keep the same filter in both export links.

Verification:

- `node --import tsx --test --test-name-pattern "HTTP exposes seasonal faction campaigns" ../agent-server/test/server.test.ts`: failed first because the public page had no CSV export link, then passed after adding the CSV route, attachment response, serializer and public-page link.
- `npm run agent:test`: passed, 377 tests, 0 failed.
- `npm run agent:ui-test`: passed, 124 tests, 0 failed.
- `npm run typecheck`: passed, including no JS/MJS/CJS/JSX source, no explicit production `any`, web typecheck and agent-server typecheck.
- `npm run build`: passed and exported `00_总览/黑曜纪元3D世界地图.html`.
- `git diff --check -- tools/agent-server/lib/httpServer.ts tools/agent-server/lib/publicWorldPageHtml.ts tools/agent-server/test/server.test.ts docs/superpowers/plans/2026-06-25-obsidian-epoch-full-implementation.md`: passed.

Remaining risk:

- The archive now supports JSON and CSV offline review. The files are still downloaded separately; the next signed manifest slice adds tamper evidence but not a one-file export bundle.

## 2026-07-03 Season Archive Signed Export Manifest Slice

- Added a signed export manifest at `/epoch/season/{seasonId}/audit-export.manifest.json` for public season contribution audit downloads.
- The manifest preserves the same `factionId` / `agentId` filters as JSON and CSV exports, ignores browser pagination inputs, and lists the exact relative JSON/CSV export paths, content types, byte counts and sha256 hashes.
- The manifest is signed with the existing Obsidian Epoch release signing key path (`AGENT_PACKAGE_SIGNING_PRIVATE_KEY_PEM` when configured, otherwise the local alpha fallback) and includes `signatureAlgorithm`, `releasePublicKey`, `releaseKeyId`, `packageSigningTrust` and `packageSigningKeySource`.
- Added a `下载审计签名 Manifest` link beside the JSON/CSV export links on public season archive pages. Filtered season pages keep the filter in all three export links.
- Kept the trust model shared with package signing instead of introducing a separate audit-export key or client-declared signature.

Verification:

- `node --import tsx --test --test-name-pattern "HTTP exposes seasonal faction campaigns" ../agent-server/test/server.test.ts`: failed first because the public page had no signed manifest link, then passed after adding the manifest route, release-key signature helper, sha256 export entries and public-page link. The test verifies JSON/CSV hashes and Ed25519 signature validation against the returned release public key.
- `npm run agent:test`: passed, 377 tests, 0 failed.
- `npm run agent:ui-test`: passed, 124 tests, 0 failed.
- `npm run typecheck`: passed, including no JS/MJS/CJS/JSX source, no explicit production `any`, web typecheck and agent-server typecheck.
- `npm run build`: passed and exported `00_总览/黑曜纪元3D世界地图.html`.
- `git diff --check -- tools/agent-server/lib/httpServer.ts tools/agent-server/lib/publicWorldPageHtml.ts tools/agent-server/lib/packageArchive.ts tools/agent-server/test/server.test.ts docs/superpowers/plans/2026-06-25-obsidian-epoch-full-implementation.md`: passed.

Remaining risk:

- The manifest makes standalone JSON/CSV downloads tamper-evident, but there is still no bundled archive containing the export files plus manifest in one downloadable package.

## 2026-07-03 Season Archive Audit Bundle Slice

- Added a one-file JSON audit bundle at `/epoch/season/{seasonId}/audit-export.bundle.json` for public season contribution audits.
- The bundle preserves `factionId` / `agentId` filters, ignores browser pagination inputs and embeds:
  - the signed export manifest,
  - the full JSON audit export object,
  - the full CSV audit export text.
- Each embedded file carries the same path, content type and sha256 as the signed manifest entry, so operators can download one bundle and verify the contained JSON/CSV payloads without chasing separate files.
- Added a `下载完整审计 Bundle` link beside the JSON, CSV and signed manifest links on public season archive pages. Filtered season pages keep the same filters in the bundle link.

Verification:

- `node --import tsx --test --test-name-pattern "HTTP exposes seasonal faction campaigns" ../agent-server/test/server.test.ts`: failed first because the public page had no bundle link, then passed after adding the bundle route, embedded payloads, manifest hash checks and public-page link.
- `npm run agent:test`: passed, 377 tests, 0 failed.
- `npm run agent:ui-test`: passed, 124 tests, 0 failed.
- `npm run typecheck`: passed, including no JS/MJS/CJS/JSX source, no explicit production `any`, web typecheck and agent-server typecheck.
- `npm run build`: passed and exported `00_总览/黑曜纪元3D世界地图.html`.
- `git diff --check -- tools/agent-server/lib/httpServer.ts tools/agent-server/lib/publicWorldPageHtml.ts tools/agent-server/lib/packageArchive.ts tools/agent-server/test/server.test.ts docs/superpowers/plans/2026-06-25-obsidian-epoch-full-implementation.md`: passed.

Remaining risk:

- The audit package is now one downloadable JSON document. Operators who need native multi-file archives could still benefit from a future `.tar.gz` bundle containing separate `audit-export.json`, `audit-export.csv` and `audit-export.manifest.json` files.

## 2026-07-03 Season Archive Audit Tarball Slice

- Added a native multi-file audit archive at `/epoch/season/{seasonId}/audit-export.tar.gz` for public season contribution audits.
- The archive preserves `factionId` / `agentId` filters, ignores browser pagination inputs and contains:
  - `audit-export.json`,
  - `audit-export.csv`,
  - `audit-export.manifest.json`.
- The archived JSON and CSV payloads use the same content and sha256 inputs as the signed manifest entries, while the archived manifest is the same release-key-signed manifest exposed by the standalone manifest endpoint.
- Reused the package archive tar/gzip writer through a new shared `createTarGzArchive` helper instead of duplicating tar header/padding behavior in the HTTP server.
- Added a `下载多文件审计包` link beside the JSON, CSV, signed manifest and JSON bundle links on public season archive pages. Filtered season pages keep the same filters in the tarball link.

Verification:

- `node --import tsx --test --test-name-pattern "HTTP exposes seasonal faction campaigns" ../agent-server/test/server.test.ts`: failed first because the public page had no tarball link, then passed after adding the shared tar/gzip helper, `.tar.gz` route, archive payload and public-page link.
- `npm run agent:test`: passed, 377 tests, 0 failed.
- `npm run agent:ui-test`: passed, 124 tests, 0 failed.
- `npm run typecheck`: passed, including no JS/MJS/CJS/JSX source, no explicit production `any`, web typecheck and agent-server typecheck.
- `npm run build`: passed and exported `00_总览/黑曜纪元3D世界地图.html`.
- `git diff --check -- tools/agent-server/lib/httpServer.ts tools/agent-server/lib/publicWorldPageHtml.ts tools/agent-server/lib/packageArchive.ts tools/agent-server/test/server.test.ts docs/superpowers/plans/2026-06-25-obsidian-epoch-full-implementation.md`: passed.

Remaining risk:

- The public audit export chain now covers standalone JSON/CSV, signed manifest, one-file JSON bundle and native `.tar.gz` archive. A future polish pass could add a detached signature file or short operator-facing verification note for manual tarball verification workflows.

## 2026-07-03 Season Archive Audit Tarball Signature Slice

- Added detached signed archive metadata at `/epoch/season/{seasonId}/audit-export.tar.gz.signature.json` for public season contribution audits.
- The signature payload preserves `factionId` / `agentId` filters and records the exact tarball path, content type, byte count and sha256 hash for the matching `.tar.gz` download.
- The detached signature uses the existing Obsidian Epoch release signing key path and includes `signatureAlgorithm`, `releasePublicKey`, `releaseKeyId`, `packageSigningTrust` and `packageSigningKeySource`, matching the standalone audit manifest trust model.
- Added a `下载审计包签名` link beside the JSON, CSV, signed manifest, JSON bundle and native tarball links on public season archive pages. Filtered season pages keep the same filters in the signature link.

Verification:

- `node --import tsx --test --test-name-pattern "HTTP exposes seasonal faction campaigns" ../agent-server/test/server.test.ts`: failed first because the public page had no tarball signature link, then passed after adding the `.tar.gz.signature.json` route, signed archive metadata and public-page link. The test verifies the archive sha256 and Ed25519 signature against the returned release public key.
- `npm run agent:test`: passed, 377 tests, 0 failed.
- `npm run agent:ui-test`: passed, 124 tests, 0 failed.
- `npm run typecheck`: passed, including no JS/MJS/CJS/JSX source, no explicit production `any`, web typecheck and agent-server typecheck.
- `npm run build`: passed and exported `00_总览/黑曜纪元3D世界地图.html`.

Remaining risk:

- The downloadable audit chain is now tamper-evident for both standalone JSON/CSV payloads and the tarball envelope. A future docs pass could add a short operator-facing verification recipe, but the machine-readable signature material is present.

## 2026-07-03 Trusted Execution Receipt Pack Slice

- Added a first-class `trustedExecution[]` pack to server result receipts.
- For attested hosted-session result pages, each trusted execution receipt binds:
  - attestation id,
  - runner id and runner key id,
  - challenge id,
  - hosted session id,
  - action id and action option id,
  - transcript hash,
  - signature hash,
  - signature-base hash,
  - result-page payload hash,
  - attestation and hosted-action audit URLs.
- Kept raw HMAC signatures out of public result-page payloads while still binding them through a sha256 signature hash. The full server audit payload remains redacted for `signature` and `transcript` fields.
- Public result pages now render a `受信执行凭据` section for verified attested runs, so the hosted action result page carries replayable evidence without requiring operator-only logs.

Verification:

- `node --import tsx --test --test-name-pattern "HTTP attested runner rejects forged signatures" ../agent-server/test/server.test.ts`: failed first because `receipt.trustedExecution` was undefined, then passed after adding trusted execution receipt generation and public result-page rendering.
- `npm run agent:test`: passed, 377 tests, 0 failed.
- `npm run agent:ui-test`: passed, 124 tests, 0 failed.
- `npm run typecheck`: passed, including no JS/MJS/CJS/JSX source, no explicit production `any`, web typecheck and agent-server typecheck.
- `npm run build`: passed and exported `00_总览/黑曜纪元3D世界地图.html`.

Remaining risk:

- The receipt pack binds attested runner evidence to public result pages without exposing runner secrets or raw HMAC signatures. A future operator playbook could describe how an operator with runner secret access recomputes the signature hash from archived challenge material.

## 2026-07-03 Trusted Execution Signature Base Slice

- Extended attestation records and trusted execution result receipts with the original server-issued `signatureBase`.
- The result-page receipt now lets an operator with runner secret access recompute the HMAC over `signatureBase`, hash that HMAC and compare it with the public `signatureHash`.
- Public result pages render `签名基底` alongside transcript, signature and signature-base hashes inside the `受信执行凭据` section.
- Kept runner secrets and raw HMAC signatures out of public result pages. The raw audit payload redaction still hides `signature`, `signatureBase` and transcript-shaped fields on audit pages.

Verification:

- `node --import tsx --test --test-name-pattern "HTTP attested runner rejects forged signatures" ../agent-server/test/server.test.ts`: failed first because `trustedExecution.signatureBase` was undefined, then passed after persisting the signature base into attestation records and rendering it in public result receipts.
- `node --import tsx --test --test-name-pattern "hosted runner records attestation evidence" ../agent-server/test/epoch-game-core.test.ts`: passed after synchronizing the low-level core attestation fixture with the persisted signature base.
- `npm run agent:test`: failed once on that low-level core fixture, then passed after the fixture update, 377 tests, 0 failed.
- `npm run agent:ui-test`: passed, 124 tests, 0 failed.
- `npm run typecheck`: passed, including no JS/MJS/CJS/JSX source, no explicit production `any`, web typecheck and agent-server typecheck.
- `npm run build`: passed and exported `00_总览/黑曜纪元3D世界地图.html`.

Remaining risk:

- Trusted execution receipts are now locally recomputable for operators who have the runner secret. A future packaged operator playbook could document the exact shell command for recomputing `signatureHash` from `signatureBase`.

## 2026-07-03 Trusted Execution Operator Playbook Slice

- Added a packaged attested-runner playbook section for verifying public `receipt.trustedExecution[]` entries.
- The playbook now gives a copyable Node command that recomputes the raw HMAC from `trustedExecution.signatureBase`, hashes that raw signature and compares the output with `trustedExecution.signatureHash`.
- The same section documents direct `signatureBaseHash` verification and audit-row checks through `trustedExecution.attestationAuditUrl` plus `trustedExecution.actionAuditUrl`.
- The instructions keep the raw runner secret in the operator environment and make clear that the raw HMAC signature is not public.

Verification:

- `node --import tsx --test --test-name-pattern "downloadable package contains" ../agent-server/test/packageArchive.test.ts`: failed first because `attested-runner-playbook.md` did not mention `receipt.trustedExecution[]`, the recomputation environment variables or the `createHmac("sha256", runnerSecret).update(signatureBase).digest("hex")` recipe; passed after adding the packaged operator verification section.

Remaining risk:

- Operators still run a shell recipe rather than a dedicated `agent:verify-attested-receipt` helper. The packaged playbook now covers the exact manual verification path.

## 2026-07-03 Trusted Execution Receipt Verifier CLI Slice

- Added `npm run agent:verify-attested-receipt` as a dedicated operator helper for public `receipt.trustedExecution[]` verification.
- The helper accepts `--secret` / `--secret-env`, `--signature-base` / `--signature-base-env`, `--signature-hash` and optional `--signature-base-hash`.
- It recomputes the HMAC-SHA256 raw signature from `trustedExecution.signatureBase`, hashes that raw signature, compares it with `trustedExecution.signatureHash`, and rejects mismatches with `attested_receipt_signature_hash_mismatch`.
- When `--signature-base-hash` is supplied, it also compares the direct sha256 of `signatureBase` with `trustedExecution.signatureBaseHash`.
- Updated the packaged attested-runner playbook to prefer the helper while retaining the transparent Node one-liner for manual inspection.

Verification:

- `node --import tsx --test --test-name-pattern "attested receipt verifier" ../agent-server/test/attestation-signer.test.ts`: failed first because `agent:verify-attested-receipt` did not exist; passed after adding the verifier library path, CLI and npm script.
- `node --import tsx --test --test-name-pattern "downloadable package contains" ../agent-server/test/packageArchive.test.ts`: passed after requiring the packaged playbook to mention `agent:verify-attested-receipt`.

Remaining risk:

- The helper verifies copied receipt fields. A future convenience pass could parse a full result-page JSON payload or URL, but the audited hash comparison now has a first-class operator command.

## 2026-07-03 Trusted Execution Receipt URL Verifier Slice

- Extended `npm run agent:verify-attested-receipt` so operators can verify a public result receipt without manually copying every trusted-execution field.
- The helper now accepts:
  - `--result-url`, fetching either JSON or a public result HTML page with embedded receipt JSON,
  - `--result-json`, reading the full `obsidian_epoch.create_result_page` JSON response,
  - `--receipt-json`, reading a direct receipt JSON payload,
  - `--trusted-execution-index`, selecting a specific `receipt.trustedExecution[]` entry.
- Public result pages now embed a safe `<script id="obsidian-epoch-result-receipt-json" type="application/json">` receipt payload. The embedded payload uses the same public receipt data already rendered on the page and still excludes runner secrets and raw HMAC signatures.
- The packaged attested-runner playbook now recommends result URL / full JSON verification first and keeps manual field verification as a fallback.

Verification:

- `node --import tsx --test --test-name-pattern "result page JSON|public result page URLs" ../agent-server/test/attestation-signer.test.ts`: failed first because the verifier still required manual `--signature-base`; passed after adding result JSON, receipt JSON and URL extraction.
- `node --import tsx --test --test-name-pattern "HTTP attested runner rejects forged signatures" ../agent-server/test/server.test.ts`: failed first because public result HTML had no `obsidian-epoch-result-receipt-json` script; passed after embedding the safe public receipt JSON.
- `node --import tsx --test --test-name-pattern "downloadable package contains" ../agent-server/test/packageArchive.test.ts`: passed after requiring the packaged playbook to mention `--result-url` and `--result-json`.

Remaining risk:

- Trusted execution receipt verification can now start from copied fields, full JSON or public result URL. Future polish could aggregate multiple trusted execution entries in one verifier run, but individual indexed verification is covered.

## 2026-07-03 Trusted Execution Receipt Batch Verifier Slice

- Added `--all-trusted-executions` to `npm run agent:verify-attested-receipt`.
- The verifier can now read a result URL, full result JSON or direct receipt JSON and verify every `receipt.trustedExecution[]` entry in one run.
- Batch JSON output reports `type: "obsidian_epoch_attested_receipt_verification_batch"`, `trustedExecutionCount`, `verifiedIndexes` and the per-entry verification records.
- Single-entry indexed verification remains available through `--trusted-execution-index`.
- Updated the packaged attested-runner playbook so operators can verify all trusted execution receipts for a result page with one command.

Verification:

- `node --import tsx --test --test-name-pattern "every trusted execution" ../agent-server/test/attestation-signer.test.ts`: failed first because the verifier returned the single-entry verification shape even with `--all-trusted-executions`; passed after adding batch extraction and aggregate output.
- `node --import tsx --test --test-name-pattern "downloadable package contains" ../agent-server/test/packageArchive.test.ts`: failed first because the packaged playbook did not mention `--all-trusted-executions`; passed after documenting the batch command.

Remaining risk:

- Trusted execution receipt verification now supports copied fields, full JSON, public result URL, indexed single-entry checks and all-entry batch checks. Future work can shift to broader spec/product gaps rather than receipt verification ergonomics.

## 2026-07-03 Direct Trade Inbox/Outbox UI Slice

- Closed the direct-trade panel polish gap called out in the spec by adding first-class received/sent/all view tabs beside the existing private escrow controls.
- Added item search inputs for both sides of the trade form:
  - "搜索我方物品" filters the current agent's tradable inventory before offering an item.
  - "搜索对方物品" filters loaded counterparty tradable items before requesting an item.
- The visible private-trade list now respects the selected direction tab while preserving accept/withdraw controls for open trades.
- Kept all settlement, escrow, expiry and risk-review behavior server-owned; this slice only changes the Agent Console view and selection ergonomics.

Verification:

- `npm run agent:ui-test -- --test-name-pattern "private direct trades"`: failed first because the direct-trade panel had no `directTradeDirectionFilter` state or item search filters; passed after adding the tabs and search-filtered item lists.
- `npm run typecheck`: passed, including no JS/MJS/CJS/JSX source, no explicit production `any`, web typecheck and agent-server typecheck.
- `npm run agent:ui-test`: passed, 124 tests, 0 failed.
- `npm run agent:test`: passed, 382 tests, 0 failed.
- `npm run batch:test`: passed, 11 tests, 0 failed.
- `npm run build`: passed and exported `00_总览/黑曜纪元3D世界地图.html`.

Remaining risk:

- The direct-trade panel now has received/sent tabs and item search filters. It still does not provide a full trade-history drilldown or multi-field search over completed direct trades; those can be future UI polish once the broader product lanes are smaller.

## 2026-07-03 Operator Organization Creation Route Slice

- Added a canonical `organization_created` event for operator/admin-seeded organizations.
- Added `createOrganization` to the Epoch core. It requires server/operator trust, creates an empty organization for a region, records an `organization_created` region activity and deduplicates by region plus display name.
- Exposed the route through:
  - MCP `obsidian_epoch.create_organization`,
  - HTTP `POST /api/epoch/organizations/create`,
  - packaged install manifests and packaged protocol/Skill guidance.
- Kept ordinary membership updates owner-authorized and scoped to existing server-owned organizations. Agents still cannot create organizations through `update_organization_membership` or submit custom ranks.

Verification:

- `node --import tsx --test ../agent-server/test/epoch-game-core.test.ts ../agent-server/test/mcp.test.ts ../agent-server/test/server.test.ts --test-name-pattern "operator can create .*organizations|operator can create an empty organization"`: failed first because `core.createOrganization`, `obsidian_epoch.create_organization` and `/api/epoch/organizations/create` did not exist; passed after adding the event, core command, runtime wrapper, MCP tool and HTTP route.
- `npm run typecheck`: failed first because `organization_created` was missing from canonical `EPOCH_EVENT_TYPES`; passed after adding the event type.
- `node --import tsx --test ../agent-server/test/packageArchive.test.ts --test-name-pattern "downloadable package contains"`: failed first because static package install manifests omitted `obsidian_epoch.create_organization`; passed after updating both package manifests.

Remaining risk:

- Operators can now seed empty organizations without waiting for NPC lifecycle membership. The route is intentionally operator-only and does not include a broader organization admin UI, approval workflow or member-facing organization directory beyond the existing Agent Console organization panel.

## 2026-07-03 Agent Console Organization Creation UI Slice

- Added an Agent Console API wrapper for `POST /api/epoch/organizations/create`.
- Added a region-panel operator form for creating server-owned organizations by display name.
- The form requires `operatorKey`, uses `web_organization_create` idempotency keys and refreshes the selected region after creation so the new organization appears in the existing organization list.
- Added `create_organization` to the console's Epoch tool checklist so the web surface matches the MCP/HTTP route.

Verification:

- `npm run agent:ui-test -- --test-name-pattern "organization"`: failed first because `createEpochOrganization` was not exported and the Agent Console had no `createOrganization` action or "创建组织" entry; passed after adding the API wrapper, component action and region-panel form.

Remaining risk:

- The console now provides a lightweight operator creation entry. Broader organization administration, approval workflows and full directory search remain future UI polish rather than part of this slice.

## 2026-07-03 Direct Trade History Search UI Slice

- Added a direct-trade list search field to the Agent Console private escrow panel.
- The visible trade list now combines the existing all/received/sent direction tabs with multi-field search over trade id, proposer/counterparty agent ids, region, status, offered/requested asset summaries and risk labels.
- The slice keeps direct-trade settlement, escrow, cancellation, expiry and risk escalation server-owned; it only improves browser-side inspection of already returned trade records.

Verification:

- `npm run agent:ui-test -- --test-name-pattern "private direct trades"`: failed first because the direct-trade panel had no `directTradeListSearch`, no `directTradeMatchesSearch` helper and no "搜索交易记录" input; passed after adding the matcher, state and list-search field.

Remaining risk:

- Direct trades now have direction tabs, item selection search and list-level history search. A richer trade-history drilldown could still expose full per-trade audit events and pagination for long-running worlds.

## 2026-07-03 Agent Console Organization Directory Search Slice

- Added a region organization directory search field to the Agent Console.
- The console now filters the full server-projected `region.organizations[]` list by organization id/key/name, region, standing, member ids, upgrade keys and treasury summary before rendering the compact organization rows.
- The compact view now shows up to five matching organizations and keeps the existing join/leave, treasury, upgrade and budget controls on each visible row.

Verification:

- `npm run agent:ui-test -- --test-name-pattern "organization directory"`: failed first because the console had no `organizationSearch`, `organizationMatchesSearch`, `visibleOrganizations` or "搜索组织" field; passed after adding the search state, matcher, derived list and directory input.

Remaining risk:

- Organization lookup now works across the full region projection, but this is still a compact region-panel directory. A dedicated organization management page could later add pagination, membership history filters and per-organization audit drilldowns.

## 2026-07-03 Build Export Media Copy Retry Slice

- Hardened the world-map export copy step against transient filesystem I/O failures observed while copying large media assets into `00_总览/assets/media`.
- Refactored `scripts/copy-data.ts` so the export operation is behind a guarded `copyData()` entry point and the file-copy path uses `copyFileWithRetry`.
- `copyFileWithRetry` retries only transient copy errors (`EIO`, `EBUSY`, `EMFILE`, `ENFILE`, `ETIMEDOUT`) and still fails immediately on non-transient permission or validation errors.
- Added `scripts/copy-data.test.ts` and included it in `npm run agent:ui-test` so the retry behavior stays covered by the standard frontend verification command.

Verification:

- `node --import tsx --test scripts/copy-data.test.ts`: failed first because `copy-data.ts` exported no `copyFileWithRetry`; passed after adding the guarded helper and retry behavior.
- `npm run build`: initially failed twice in the media-copy phase with transient `EIO` on different PNG assets; passed after the retry helper was added and wired into `copy-data.ts`.

Remaining risk:

- The export path now tolerates short-lived copy errors, but persistent storage or cloud-sync failures should still surface as build failures after the bounded retry attempts.

## 2026-07-03 Party Invite Recipient Binding Slice

- Invite-only party creation and invite rotation can now carry `inviteRecipientAgentId` to bind a token to one joining identity.
- `joinPartyRun` rejects a correct token used by another identity with `party_invite_recipient_mismatch` before consuming invite uses or adding members.
- MCP and HTTP public responses preserve the non-secret recipient binding field while continuing to strip `inviteTokenHash` from command values, events, projections and `party_runs` reads.
- HTTP maps `party_invite_recipient_mismatch` to a client-visible 400 like the other invite validation failures.
- Updated the packaged MCP schema, protocol reference, Obsidian Epoch skill guidance, frontend public `EpochPartyRun` type and API wrapper coverage.

Verification:

- `node --import tsx --test --test-name-pattern "owner-authorized party runs" ../agent-server/test/mcp.test.ts ../agent-server/test/server.test.ts`: failed first because MCP/HTTP responses had `inviteRecipientAgentId: undefined`; failed again for HTTP because the new mismatch error returned 500; passed after runtime forwarding and HTTP error mapping.
- `node --import tsx --test ../agent-server/test/epoch-game-core.test.ts --test-name-pattern "recipient identity"`: passed 97 core tests including the recipient-bound invite regression.
- `node --import tsx --test src/agent/api.test.ts --test-name-pattern "party invite API"`: passed 28 API wrapper tests.
- `npm run typecheck`: passed.
- `npm run agent:test`: passed 386/386 tests.
- `npm run agent:ui-test`: passed 129/129 tests.
- `npm run batch:test`: passed 11/11 tests.
- `npm run build`: passed and exported `00_总览/黑曜纪元3D世界地图.html`.
- `git diff --check`: passed; direct trailing-whitespace scan of touched files also passed.

Remaining risk:

- This closes per-invite recipient binding for token-gated party runs. Closed below: a leader approval queue now exists for explicit join requests. Richer invite audit UI and larger raid/faction live-ops loops remain separate spec lanes.

## 2026-07-03 Raid Repeat Reward Decay Slice

- Legal repeat raids between the same two identities in the same region still respect the existing one-hour hard cooldown.
- After the cooldown expires, a repeat raid within the 24-hour decay window can resolve and record conflict history, but its `reward.amount` is `0` with reason `raid_repeat_reward_decayed`.
- Decayed repeat raids still spend attacker stamina and append `raid_resolved`, `trace_created` and `retaliation_opportunity_created` when appropriate, so frontlines and revenge continuity remain visible.
- Decayed repeat raids do not append `resource_granted` or `region_influence_changed`, preventing the old same-pair loop from minting repeated legend or influence after merely waiting out the hard cooldown.
- Raid ids now include settlement time in their deterministic seed, so legal repeats with the same attacker, defender and stamina spend become distinct canonical raid records instead of overwriting the earlier result.
- Updated packaged protocol and Skill guidance so installed agents treat `reward.amount=0` as authoritative evidence that no reward or influence was minted.

Verification:

- `node --import tsx --test ../agent-server/test/epoch-game-core.test.ts --test-name-pattern "repeat rewards decay"`: failed first because the second legal raid still returned `reward.amount=1`; failed again when the repeated same-stamina raid reused the original `raidId`; passed after reward decay and timestamp-seeded raid ids.
- `node --import tsx --test --test-name-pattern "repeat rewards decay|pair cooldown|server-issued identity|HTTP raid resolution rejects immediate pair cooldown" ../agent-server/test/epoch-game-core.test.ts ../agent-server/test/mcp.test.ts ../agent-server/test/server.test.ts`: passed across core, MCP and HTTP public entry points.

Remaining risk:

- This closes the simple same-pair reward faucet after cooldown. Basic support party-role synergy is closed below; broader raid heat, faction-scale pressure, richer role effects and live-ops tuning remain separate raid/faction campaign lanes.

## 2026-07-03 Party Join Approval Queue Slice

- Added server-owned party join request records embedded in each `EpochPartyRun.joinRequests[]`.
- Added `party_join_requested` and `party_join_request_resolved` events. A pending request records the requesting identity, requested role, optional note and request time; resolution records the leader, approval/rejection, optional note and resolution time.
- Added core commands `requestPartyJoin` and `resolvePartyJoinRequest`.
- Requesting a join requires the requesting identity owner authorization, rejects duplicate pending requests, existing members and full parties, and does not add the requester as a member.
- Resolving a join request requires the party leader owner's authorization. Rejection marks only the request; approval also emits `party_member_joined` and adds the requested member without consuming invite-token uses.
- Exposed the queue through MCP tools `obsidian_epoch.request_party_join` and `obsidian_epoch.resolve_party_join_request`, plus HTTP routes `POST /api/epoch/party-runs/request-join` and `POST /api/epoch/party-runs/resolve-join-request`.
- Updated the browser API wrappers, public `EpochPartyRun` type, package install manifests, packaged protocol reference and packaged Skill guidance.

Verification:

- `node --import tsx --test ../agent-server/test/epoch-game-core.test.ts --test-name-pattern "leader approval queue"`: failed first because `requestPartyJoin` did not exist; passed after adding request/resolution events, projection state and core commands.
- `node --import tsx --test --test-name-pattern "owner-authorized party runs" ../agent-server/test/mcp.test.ts ../agent-server/test/server.test.ts`: failed first with unknown MCP tool and HTTP 404; passed after runtime, MCP and HTTP wiring.
- `node --import tsx --test ../agent-server/test/mcp.test.ts --test-name-pattern "MCP tool registry exposes agent world tools"`: failed first because the new request tool was covered by the active identity audit but missing from `EPOCH_ACTIVE_IDENTITY_TOOL_NAMES`; passed after adding the request and resolution tools to the runtime active-only list.
- `node --import tsx --test src/agent/api.test.ts --test-name-pattern "party invite API"`: passed with request/resolve party join API wrapper coverage.
- `node --import tsx --test ../agent-server/test/packageArchive.test.ts --test-name-pattern "downloadable package contains"`: passed after install manifest updates.
- `npm run typecheck`: passed.
- `npm run agent:test`: passed 388/388.
- `npm run agent:ui-test`: passed 129/129.
- `npm run batch:test`: passed 11/11.
- `npm run build`: passed and exported `00_总览/黑曜纪元3D世界地图.html`.

Remaining risk:

- The server now has a functional approval queue and the Agent Console exposes pending join requests with leader approval/rejection controls. Notification badges, invite audit history and reissue workflows remain separate product polish lanes.

## 2026-07-03 Agent Console Party Join Approval UI Slice

- Added Agent Console controls for the party join approval queue.
- The regional party-run panel now imports and calls `requestEpochPartyJoin` and `resolveEpochPartyJoinRequest`.
- Non-members can submit a server-owned join request from the console using the selected participant role and an optional request note.
- Open party runs now surface pending join requests with role and requesting identity.
- The current leader identity can approve or reject each pending request directly from the party-run row; approvals still flow through the server route and canonical events before refreshing progress, party runs and region info.
- The UI keeps direct join available for public parties while adding request/approval as the safer path for invite-only or leader-reviewed parties.

Verification:

- `node --import tsx --test src/agent/AgentExplorer.layout.test.ts --test-name-pattern "join request approval controls"`: failed first because `requestEpochPartyJoin` was not present in the Agent Console source; passed after adding the request/resolve UI controls.
- `npm run typecheck`: passed.
- `npm run agent:ui-test`: passed 130/130.
- `npm run build`: passed and exported `00_总览/黑曜纪元3D世界地图.html`.
- `npm run agent:visual-qa`: blocked by environment credential error, `request_failed:401` with `Invalid or missing gateway API key.`

Remaining risk:

- Browser controls now cover the approval queue, but live visual QA could not run without the gateway API key. Notification badges and invite audit history remain separate product polish lanes.

## 2026-07-03 Agent Console Party Invite Rotation UI Slice

- Added Agent Console controls for leader-managed invite rotation and revocation.
- The regional party-run panel now imports and calls `updateEpochPartyInvite`.
- Leaders can set an invite token, optional bound recipient agent id and use limit, then rotate the invite from the browser console.
- Leaders can revoke the active invite from the same party-run row.
- The party-run row surfaces current invite policy, use count and bound recipient when available.
- Rotation and revocation both go through the owner-authorized server route before refreshing progress, party runs and region info.

Verification:

- `node --import tsx --test src/agent/AgentExplorer.layout.test.ts --test-name-pattern "leader invite rotation controls"`: failed first because `updateEpochPartyInvite` was not present in the Agent Console source; passed after adding leader invite controls.
- `npm run typecheck`: passed.
- `npm run agent:ui-test`: passed 131/131.
- `npm run build`: passed and exported `00_总览/黑曜纪元3D世界地图.html`.

Remaining risk:

- Invite reissue/revoke is available in the browser console. Notification badges, full invite audit history and live visual QA still need separate follow-up.

## 2026-07-03 Agent Console Party Join Notification Badge Slice

- Added pending join-request badges to the Agent Console party-run panel.
- The panel header now summarizes total pending party join requests across loaded party runs.
- Each party-run row now labels its own pending queue as a待处理 count before listing request role and identity details.
- The slice is read-only UI over existing server-owned `joinRequests[]`; it does not create new client authority or change approval behavior.

Verification:

- `node --import tsx --test src/agent/AgentExplorer.layout.test.ts --test-name-pattern "pending join request badges"`: failed first because `pendingPartyJoinRequestCount` was not present in the Agent Console source; passed after adding the header and row badges.
- `npm run typecheck`: passed.
- `npm run agent:ui-test`: passed 132/132.
- `npm run build`: passed and exported `00_总览/黑曜纪元3D世界地图.html`.
- `npm run agent:visual-qa`: blocked by environment credential error, `request_failed:401` with `Invalid or missing gateway API key.`

Remaining risk:

- Pending join request notification badges are now visible in the console. Full invite audit history is closed below; live visual QA still needs a gateway API key.

## 2026-07-03 Agent Console Party Invite Audit History Slice

- Added a party invite audit history surface to the Agent Console party-run panel.
- The panel now has an `邀请审计` action that reads canonical audit events through `getEpochAudit({ eventType: "party_invite_updated" })`.
- The UI filters invite audit events to currently loaded party run ids when possible.
- Each audit row shows party run id, rotation/revocation kind, created time, optional bound recipient, optional use limit and a public audit link.
- The display uses server-redacted `party_invite_updated` payloads and never shows invite token hashes or raw invite tokens.

Verification:

- `node --import tsx --test src/agent/AgentExplorer.layout.test.ts --test-name-pattern "invite audit history"`: failed first because `partyInviteAudit` was not present in the Agent Console source; passed after adding audit state, loader, filtering and display rows.
- `npm run typecheck`: passed.
- `npm run agent:ui-test`: passed 133/133.
- `npm run build`: passed and exported `00_总览/黑曜纪元3D世界地图.html`.
- `npm run agent:visual-qa`: blocked by environment credential error, `request_failed:401` with `Invalid or missing gateway API key.`

Remaining risk:

- The party-run browser panel now covers request badges, approvals, invite rotation/revocation and invite audit history. Live visual QA still needs a gateway API key.

## 2026-07-03 Party Role Synergy Settlement Slice

- Added a server-owned support synergy bonus to party-run settlement.
- Base party role scores remain server-owned: `leader` / `vanguard` = 3, `scout` / `support` = 2 and `scribe` = 1.
- When an open party has at least three members and includes a `support` role, every member receives +1 final score.
- Party-run `coin` rewards and regional influence deltas now use that final server-computed score; clients, local MCP code and member prose still cannot declare bonuses.
- Updated packaged protocol and Skill guidance so installed agents discover the exact support synergy rule and do not invent other role bonuses.

Verification:

- `node --import tsx --test ../agent-server/test/epoch-game-core.test.ts --test-name-pattern "role synergy bonuses"`: failed first with `7 !== 10` because settlement still used only base role scores; passed after adding the support synergy calculation.
- `node --import tsx --test ../agent-server/test/epoch-game-core.test.ts --test-name-pattern "role synergy bonuses|server-authoritative squads|party runs cap members"`: passed 100/100 core tests from the standard test file, including the existing two-member no-synergy path and max-member cap.
- `node --import tsx --test ../agent-server/test/packageArchive.test.ts --test-name-pattern "downloadable package contains"`: passed 7/7 package archive tests after protocol and Skill guidance updates.
- `npm run agent:test`: failed first because MCP/HTTP party-run integration tests still expected the old three-member total score `7`; passed 389/389 after updating those integration expectations to assert the server-owned support synergy totals and per-member rewards.
- `npm run typecheck`: passed; no JS/MJS/CJS/JSX source, no explicit production `any`, web typecheck and agent-server typecheck all passed.
- `npm run agent:ui-test`: passed 133/133.
- `npm run batch:test`: passed 11/11.
- `npm run build`: passed and exported `00_总览/黑曜纪元3D世界地图.html`.
- `git diff --check`: passed; direct trailing-whitespace scan of touched files also passed.

Remaining risk:

- This closes the first party-role bonus in server settlement. A vanguard influence effect is closed below; broader role matrices, scout/scribe special effects, raid heat, faction-scale pressure and season-control feedback remain future gameplay lanes.

## 2026-07-03 Party Vanguard Influence Settlement Slice

- Added a server-owned `vanguard` influence bonus to party-run settlement.
- The bonus is intentionally not a reward multiplier: `vanguard` members receive +1 `region_influence_changed.influenceDelta` on settlement without changing `memberResults[].score`, `totalScore` or `coin` rewards.
- Support synergy still determines final member score before rewards; the vanguard bonus is layered only onto regional influence so party frontline pressure can move without minting extra currency.
- Updated packaged protocol and Skill guidance so installed agents discover the exact `vanguard` influence rule and do not invent extra role effects.

Verification:

- `node --import tsx --test ../agent-server/test/epoch-game-core.test.ts --test-name-pattern "vanguard influence bonus"`: failed first with `4 !== 5` because `vanguard` regional influence was still equal to final score; passed after adding the server-owned influence delta helper.
- `node --import tsx --test ../agent-server/test/epoch-game-core.test.ts --test-name-pattern "role synergy bonuses|vanguard influence bonus|server-authoritative squads|party runs cap members"`: passed 101/101 core tests from the standard test file, covering no-synergy, support synergy, vanguard influence and member caps.
- `node --import tsx --test ../agent-server/test/packageArchive.test.ts --test-name-pattern "downloadable package contains"`: passed 7/7 package archive tests after protocol and Skill guidance updates.
- `npm run typecheck`: passed; no JS/MJS/CJS/JSX source, no explicit production `any`, web typecheck and agent-server typecheck all passed.
- `npm run agent:test`: passed 390/390.
- `npm run agent:ui-test`: passed 133/133.
- `npm run batch:test`: passed 11/11.
- `npm run build`: passed and exported `00_总览/黑曜纪元3D世界地图.html`.

Remaining risk:

- This closes the first vanguard-specific settlement effect. A scribe news effect is closed below; scout special effects, richer role matrices, raid heat, faction-scale pressure and season-control feedback remain future gameplay lanes.

## 2026-07-03 Party Scribe News Settlement Slice

- Added a server-owned `scribe` news bonus to party-run settlement.
- The bonus is intentionally scoped to public documentation: if a settled party includes a `scribe`, generated regional news receives +1 `legendDelta`.
- The bonus does not change `memberResults[].score`, `totalScore`, `coin` rewards or regional influence deltas, so scribe documentation cannot mint combat score or currency.
- Updated packaged protocol and Skill guidance so installed agents discover the exact `scribe` news rule and do not invent extra role effects or self-declared legend.

Verification:

- `node --import tsx --test ../agent-server/test/epoch-game-core.test.ts --test-name-pattern "scribe news bonus"`: failed first with `3 !== 4` because party settlement still derived news legend only from `totalScore`; passed after adding the server-owned news delta helper.
- `node --import tsx --test ../agent-server/test/epoch-game-core.test.ts --test-name-pattern "role synergy bonuses|vanguard influence bonus|scribe news bonus|server-authoritative squads|party runs cap members"`: passed 102/102 core tests from the standard test file, covering no-synergy, support synergy, vanguard influence, scribe news and member caps.
- `node --import tsx --test ../agent-server/test/packageArchive.test.ts --test-name-pattern "downloadable package contains"`: passed 7/7 package archive tests after protocol and Skill guidance updates.
- `npm run typecheck`: passed; no JS/MJS/CJS/JSX source, no explicit production `any`, web typecheck and agent-server typecheck all passed.
- `npm run agent:test`: passed 391/391.
- `npm run agent:ui-test`: passed 133/133.
- `npm run batch:test`: passed 11/11.
- `npm run build`: passed and exported `00_总览/黑曜纪元3D世界地图.html`.

Remaining risk:

- This closes the first scribe-specific settlement effect. A scout trace marker is closed below; richer role matrices, raid heat, faction-scale pressure and season-control feedback remain future gameplay lanes.

## 2026-07-03 Party Scout Trace Settlement Slice

- Added a server-owned `scout` intelligence marker to party-run settlement traces.
- Settled party-run conflict traces now carry optional `scoutAgentIds[]`, derived from canonical `memberResults[]` roles on the server.
- The marker does not change `memberResults[].score`, `totalScore`, `coin` rewards, regional influence or regional news legend; it gives later region reads a queryable trace anchor for scout participation.
- Synchronized `TraceCreatedPayload`, `EpochConflictTrace`, frontend shared `EpochConflictTrace`, MCP region-info description, packaged protocol and Skill guidance.

Verification:

- `node --import tsx --test ../agent-server/test/epoch-game-core.test.ts --test-name-pattern "scout intelligence"`: failed first because the settlement trace had `scoutAgentIds: undefined`; passed after adding the server-derived trace marker through event payload and projection.
- `node --import tsx --test ../agent-server/test/epoch-game-core.test.ts --test-name-pattern "role synergy bonuses|vanguard influence bonus|scribe news bonus|scout intelligence|server-authoritative squads|party runs cap members"`: passed 103/103 core tests from the standard test file.
- `node --import tsx --test ../agent-server/test/packageArchive.test.ts --test-name-pattern "downloadable package contains"`: passed 7/7 package archive tests after protocol and Skill guidance updates.
- `npm run typecheck`: passed; no JS/MJS/CJS/JSX source, no explicit production `any`, web typecheck and agent-server typecheck all passed.
- `npm run agent:test`: passed 392/392.
- `npm run agent:ui-test`: passed 133/133.
- `npm run batch:test`: passed 11/11.
- `npm run build`: passed and exported `00_总览/黑曜纪元3D世界地图.html`.

Remaining risk:

- Support, vanguard, scribe and scout now each have a first server-owned settlement effect. Richer role matrices, raid heat, faction-scale pressure, season-control feedback and UI display polish for scout markers remain future gameplay lanes.

## 2026-07-03 Region Raid Heat Read Model Slice

- Added `region_info.raidHeat`, a server-derived regional raid pressure read model built from projected `raid_resolved` events.
- The read model reports `heatScore`, recent raid count, active attacker/defender pair count, repeated reward-decayed raid count, `quiet` / `warm` / `hot` status and the latest raid id/time.
- The 24-hour window is anchored to the latest canonical raid in the region, so stale history does not permanently heat a quiet region while recent repeated raids still increase pressure.
- Synchronized the HTTP/MCP runtime output, frontend shared `EpochRegionInfo` types, MCP tool description and packaged Skill/protocol guidance so installed agents quote server heat instead of inventing wider raid pressure from story prose.
- Surfaced `region_info.raidHeat` in the Agent Console region panel beside the existing market, influence, trace, frontline and retaliation summaries.
- Added the first heat-driven pacing rule: if a region is already `hot` before raid resolution, the raid still records `raid_resolved`, a conflict trace and any retaliation opportunity, but returns `reward.amount=0` with `reason: "raid_region_heat_reward_decayed"` and does not mint reward or regional influence.

Verification:

- `node --import tsx --test --test-name-pattern "HTTP owner-authorized organization membership feeds region frontlines" ../agent-server/test/server.test.ts`: failed first because `region.body.raidHeat` was `undefined`; passed after adding the runtime read model and region-info output.
- `npm run typecheck`: passed; no JS/MJS/CJS/JSX source, no explicit production `any`, web typecheck and agent-server typecheck all passed.
- `npm run agent:test`: passed 392/392, including MCP region-info/frontline coverage, HTTP region-info/frontline coverage and package archive tests.
- `npm run agent:ui-test`: passed 133/133.
- `npm run batch:test`: passed 11/11.
- `npm run build`: passed and exported `00_总览/黑曜纪元3D世界地图.html`.
- `git diff --check`: passed; direct trailing-whitespace scan of touched files also passed.
- `node --import tsx --test --test-name-pattern "server-derived raid heat" src/agent/AgentExplorer.layout.test.ts`: failed first because the Agent Console did not render `区域热度`; passed after adding the compact region-panel heat row.
- `npm run agent:ui-test`: passed 134/134 after the UI display assertion was added.
- `npm run build`: passed again and exported `00_总览/黑曜纪元3D世界地图.html`.
- `node --import tsx --test ../agent-server/test/epoch-game-core.test.ts --test-name-pattern "regional raid heat"`: failed first with `1 !== 0` because a fourth raid in an already-hot region still minted a legend reward; passed after adding the server-owned hot-region reward decay gate.
- `node --import tsx --test ../agent-server/test/epoch-game-core.test.ts --test-name-pattern "raid resolution|raid repeat|regional raid heat"`: passed 104/104 core tests from the standard test file, covering normal raid rewards, immediate pair cooldown, pair-repeat reward decay and hot-region reward decay.
- `node --import tsx --test ../agent-server/test/packageArchive.test.ts --test-name-pattern "downloadable package contains"`: passed 7/7 package archive tests after Skill/protocol guidance updates.
- `npm run typecheck`: passed; no JS/MJS/CJS/JSX source, no explicit production `any`, web typecheck and agent-server typecheck all passed.
- `npm run agent:test`: passed 393/393.
- `npm run agent:ui-test`: passed 134/134.
- `npm run batch:test`: passed 11/11.
- `npm run build`: passed and exported `00_总览/黑曜纪元3D世界地图.html`.

Remaining risk:

- This closes the first broader raid heat/live-ops read model, Agent Console visibility and first heat-driven reward pacing rule. A first faction-scale pressure read model is closed below; richer matchmaking policy and season-control feedback remain future gameplay lanes.

## 2026-07-03 Region Faction Pressure Read Model Slice

- Added `region_info.factionPressure[]`, a server-derived per-faction regional pressure read model built from canonical season faction standings, season agent standings, current `regionControl` and recent raid winners.
- Each row exposes `pressureScore`, `seasonScore`, `raidPressure`, `activeRaidCount`, `controlStatus`, contributing `agentIds`, `sourceSeasonIds` and optional latest raid id/time.
- Raid pressure uses the same faction-scale pressure weight as frontlines (`+8` per recent winning raid) and maps raid winners to factions through season agent standings instead of trusting client-declared faction prose.
- Control status is derived from `regionControl`: the controller is `controlling`, the contested faction or non-controller with active raid pressure is `challenging`, and other visible season factions remain `active`.
- Synchronized HTTP/MCP runtime output, frontend shared `EpochRegionInfo` types, Agent Console region-panel display, public region page display, MCP tool description and packaged Skill/protocol guidance.

Verification:

- `node --import tsx --test ../agent-server/test/server.test.ts --test-name-pattern "runtime region info exposes faction-scale pressure"`: failed first with `region.factionPressure` not being an array; passed after adding the runtime read model, `region_info` output and public region page rendering.
- `node --import tsx --test src/agent/AgentExplorer.layout.test.ts`: passed 101/101 after adding the Agent Console `阵营压力` display assertion.
- `npm run typecheck`: passed; no JS/MJS/CJS/JSX source, no explicit production `any`, web typecheck and agent-server typecheck all passed.
- `node --import tsx --test ../agent-server/test/packageArchive.test.ts --test-name-pattern "downloadable package contains"`: passed 7/7 package archive tests after Skill/protocol guidance updates.
- `npm run agent:test`: passed 394/394.
- `npm run agent:ui-test`: passed 135/135.
- `npm run batch:test`: passed 11/11.
- `npm run build`: passed and exported `00_总览/黑曜纪元3D世界地图.html`.

Remaining risk:

- This closes the first faction-scale pressure read model and display path. It does not yet make season-control feedback mutate future season settlement, raid matchmaking or faction-control rules; those remain future gameplay lanes.

## 2026-07-03 Region Control Season Contribution Feedback Slice

- Added the first season-control feedback rule: if a faction controls a region in the next season's `regionIds`, that faction receives a server-derived score-only `regionControlBonusScore` on season contribution.
- The bonus is fixed at +1 for this first slice, records `sourceRegionControlRegionIds[]`, and is included in `scoreDelta` alongside `baseScoreDelta` and `organizationBonusScore`.
- Resource accounting remains unchanged: `season_contribution_recorded.amount` is still the real resource spend, and the control bonus never mints resources.
- Projection and read models now carry `regionControlBonusScore` and `sourceRegionControlRegionIds` through `EpochSeasonContribution`, season contribution receipts, public season archive contribution audit rows and frontend shared types.
- Updated Agent Console contribution receipts and public season archive score text to show `基础 + 组织 + 控制 = 最终`.
- Updated packaged Skill/protocol guidance so installed hosts treat matching region control as a server-owned score-only bonus, not a prompt-declared reward.

Verification:

- `node --import tsx --test ../agent-server/test/epoch-game-core.test.ts --test-name-pattern "season contributions gain score-only bonus"`: failed first with `regionControlBonusScore` undefined; passed after adding the server-derived bonus fields and projection.
- `node --import tsx --test ../agent-server/test/epoch-game-core.test.ts --test-name-pattern "season contributions gain score-only bonus|training hall adds server-side season contribution score|seasonal faction campaigns spend"`: passed 105/105 after updating the training-hall fixture to expect organization and region-control bonuses to stack.
- `node --import tsx --test src/agent/AgentExplorer.layout.test.ts --test-name-pattern "latest season contribution"`: passed 101/101 after extending the receipt display assertion to include control bonus fields.
- `node --import tsx --test ../agent-server/test/server.test.ts --test-name-pattern "HTTP exposes seasonal faction campaigns"`: passed 83/83 after updating public season archive text assertions.
- `npm run typecheck`: passed; no JS/MJS/CJS/JSX source, no explicit production `any`, web typecheck and agent-server typecheck all passed.
- `node --import tsx --test ../agent-server/test/packageArchive.test.ts --test-name-pattern "downloadable package contains"`: passed 7/7 package archive tests after Skill/protocol guidance updates.
- `npm run agent:test`: passed 395/395.
- `npm run agent:ui-test`: passed 135/135.
- `npm run batch:test`: passed 11/11.
- `npm run build`: passed and exported `00_总览/黑曜纪元3D世界地图.html`.

Remaining risk:

- This closes the first mutable season-control feedback loop. Richer region-control scaling, raid matchmaking rules and faction-control decay/turnover remain future gameplay lanes.

## 2026-07-03 Region Control Multi-Region Scaling Slice

- Extended the season-control feedback rule from a fixed +1 control bonus to +1 score per matching controlled season region.
- `sourceRegionControlRegionIds[]` remains the audit source for the calculation, so a season spanning two regions controlled by the contributing faction now records both region ids and a `regionControlBonusScore` of 2.
- Resource accounting remains unchanged: only `season_contribution_recorded.amount` spends resources, while `baseScoreDelta + organizationBonusScore + regionControlBonusScore` determines final `scoreDelta`.
- Updated packaged Skill/protocol guidance so installed hosts describe the bonus as +1 per matching settled controlled region, not a client-declared reward.

Verification:

- `node --import tsx --test ../agent-server/test/epoch-game-core.test.ts --test-name-pattern "season control contribution bonus scales"`: failed first with `1 !== 2` on `regionControlBonusScore`; passed after scaling the server-derived bonus by matching controlled region count.
- `node --import tsx --test ../agent-server/test/epoch-game-core.test.ts --test-name-pattern "season contributions gain score-only bonus|season control contribution bonus scales|training hall adds server-side season contribution score|seasonal faction campaigns spend"`: passed 106/106 for the focused season-control and training-hall surface.
- `npm run typecheck`: passed; no JS/MJS/CJS/JSX source, no explicit production `any`, web typecheck and agent-server typecheck all passed.
- `node --import tsx --test ../agent-server/test/packageArchive.test.ts --test-name-pattern "downloadable package contains"`: passed 7/7 package archive tests after Skill/protocol guidance updates.
- `npm run agent:test`: passed 396/396.
- `npm run agent:ui-test`: passed 135/135.
- `npm run batch:test`: passed 11/11.
- `npm run build`: passed and exported `00_总览/黑曜纪元3D世界地图.html`.

Remaining risk:

- This closes the first region-control scaling rule. Balance tuning for high-region seasons, raid matchmaking rules and faction-control decay/turnover remain future gameplay lanes.

## 2026-07-03 Raid Same-Explorer Matchmaking Guard Slice

- Added a raid matchmaking anti-farm guard: `resolveRaid` now rejects attacker/defender identity pairs owned by the same explorer with `raid_same_explorer_not_allowed`.
- The guard runs after both identities are resolved from server state and before attacker stamina is spent, so blocked same-explorer raids cannot mint rewards, write `raid_resolved`, create traces or open retaliation opportunities.
- The test fixture explicitly unlocks a second active identity slot with server-granted legend before issuing the defender identity, preserving the existing identity-slot rule while covering a legal multi-identity explorer setup.
- Updated packaged Skill/protocol guidance so installed hosts describe same-explorer raid pairs as matchmaking self-dealing, alongside existing same-pair cooldown and reward decay rules.

Verification:

- `node --import tsx --test ../agent-server/test/epoch-game-core.test.ts --test-name-pattern "same-explorer identities"`: first failed during setup with `identity_slot_limit_reached`, then failed correctly with missing `raid_same_explorer_not_allowed`; passed after adding the guard before stamina spend.
- `node --import tsx --test ../agent-server/test/epoch-game-core.test.ts --test-name-pattern "raid resolution|raid repeat|regional raid heat|same-explorer identities"`: passed 107/107 for normal raid settlement, same-explorer rejection, pair cooldown, repeat reward decay and hot-region reward decay.
- `npm run typecheck`: passed; no JS/MJS/CJS/JSX source, no explicit production `any`, web typecheck and agent-server typecheck all passed.
- `node --import tsx --test ../agent-server/test/packageArchive.test.ts --test-name-pattern "downloadable package contains"`: passed 7/7 package archive tests after Skill/protocol guidance updates.
- `npm run agent:test`: passed 397/397.
- `npm run agent:ui-test`: passed 135/135.
- `npm run batch:test`: passed 11/11.
- `npm run build`: passed and exported `00_总览/黑曜纪元3D世界地图.html`.

Remaining risk:

- This closes one concrete raid matchmaking anti-farm boundary. Broader target selection policy, faction-control decay/turnover and high-region season balance tuning remain future gameplay lanes.

## 2026-07-03 Region Control Turnover Audit Slice

- Added `previousControllingFactionId` to `region_control_changed` and the projected `region_info.regionControl` read model when a prior controller existed.
- Season settlement now captures the previous controller before appending the new control event, so a later faction takeover can be audited without clients inventing turnover, decay or revolt prose.
- The field is optional for historical compatibility: first-time region control and old persisted events hydrate without a previous controller.
- Updated frontend shared `EpochRegionControl` types and packaged Skill/protocol guidance so installed hosts can explain control turnover from server evidence.

Verification:

- `node --import tsx --test ../agent-server/test/epoch-game-core.test.ts --test-name-pattern "previous region controller"`: failed first with `undefined !== "gray_watch"`; passed after adding the event payload field, projection field and settlement wiring.
- `node --import tsx --test ../agent-server/test/epoch-game-core.test.ts --test-name-pattern "seasonal faction campaigns spend|season contributions gain score-only bonus|previous region controller|season control contribution bonus scales|training hall adds server-side season contribution score"`: passed 108/108 for the focused season-control surface.
- `npm run typecheck`: passed; no JS/MJS/CJS/JSX source, no explicit production `any`, web typecheck and agent-server typecheck all passed.
- `node --import tsx --test ../agent-server/test/packageArchive.test.ts --test-name-pattern "downloadable package contains"`: passed 7/7 package archive tests after Skill/protocol guidance updates.
- `npm run agent:test`: passed 398/398.
- `npm run agent:ui-test`: passed 135/135.
- `npm run batch:test`: passed 11/11.
- `npm run build`: passed and exported `00_总览/黑曜纪元3D世界地图.html`.

Remaining risk:

- This closes the first explicit control-turnover audit field. Actual control decay timers, revolt mechanics, broader raid target selection policy and high-region season balance tuning remain future gameplay lanes.

## 2026-07-03 Region Control Maintenance Decay Slice

- Added append-only `region_control_decayed` events plus core/runtime maintenance commands that lower stale active `region_info.regionControl.controlScore` and `controlMargin` without changing the controlling faction.
- The decay command is operator/server-only: untrusted clients are rejected, original `region_control_changed` history is preserved, and `previousControllingFactionId` / `sourceSeasonId` remain audit evidence instead of being rewritten.
- Manual `obsidian_epoch.run_maintenance` now accepts `regionControlDecayLimit`, `regionControlDecayAmount` and `regionControlDecayMinAgeSeconds`, reports `value.regionControls`, and exposes `regionControlDecay` worker health/counts through operator overview.
- The opt-in scheduled maintenance loop now reads `AGENT_SERVER_MAINTENANCE_REGION_CONTROL_DECAY_LIMIT`, `AGENT_SERVER_MAINTENANCE_REGION_CONTROL_DECAY_AMOUNT` and `AGENT_SERVER_MAINTENANCE_REGION_CONTROL_DECAY_MIN_AGE_SECONDS`, persists emitted decay events, and includes `regionControls` in tick summaries.
- Synchronized MCP schema, frontend shared maintenance types, deployment compose/env examples, package Skill/protocol guidance and architecture docs so installed hosts treat control decay as server maintenance evidence, not prompt-authored revolt or liberation.

Verification:

- `node --import tsx --test ../agent-server/test/epoch-game-core.test.ts --test-name-pattern "region control maintenance decay|runtime maintenance decays stale region control"`: failed first with missing `decayRegionControls` / runtime `regionControls`; passed after adding the core event/projection/command and runtime summary.
- `node --import tsx --test ../agent-server/test/maintenance.test.ts --test-name-pattern "maintenance config is opt-in|decays stale region control"`: failed first with undefined env config and missing scheduled `regionControls`; passed after adding scheduler config, env parsing, facade wrapper, event persistence and tick summary.
- `node --import tsx --test ../agent-server/test/mcp.test.ts --test-name-pattern "MCP tool registry exposes|operator maintenance run executes bounded server workers"`: passed 79/79 after MCP schema updates.
- `node --import tsx --test ../agent-server/test/deploy-config.test.ts --test-name-pattern "public deployment config"`: passed 4/4 after compose/env/README updates.
- `node --import tsx --test ../agent-server/test/packageArchive.test.ts --test-name-pattern "downloadable package contains"`: passed 7/7 after package guidance updates.
- `npm run typecheck`: passed; no JS/MJS/CJS/JSX source, no explicit production `any`, web typecheck and agent-server typecheck all passed.
- `npm run agent:test`: passed 401/401.
- `npm run agent:ui-test`: passed 135/135.
- `npm run batch:test`: passed 11/11.
- `npm run build`: passed and exported `00_总览/黑曜纪元3D世界地图.html`.

Remaining risk:

- This closes actual operator/server control decay timers for manual and scheduled maintenance. Revolt/liberation mechanics when control reaches zero, broader raid target-selection policy and high-region season balance tuning remain future gameplay lanes.

## 2026-07-03 Region Control Zero-Score Release Slice

- Added `region_control_released`, a server-owned maintenance side-effect emitted when `region_control_decayed` lowers an active region-control score to zero.
- Projection now removes the active `region_info.regionControl` row on release, so clients no longer see a zero-score controller as still controlling the region.
- The release payload preserves the previous controlling faction, previous score and source season for audit replay; it does not create a new controller, reward, battle result or revolt story.
- Runtime/operator maintenance event views now include `region_control_released` in recent maintenance events plus `regionControlReleased` counts, and frontend shared types understand the new event/count field.
- Updated packaged Skill/protocol guidance and architecture docs so installed hosts distinguish server control release from prompt-authored revolt or liberation prose.

Verification:

- `node --import tsx --test ../agent-server/test/epoch-game-core.test.ts --test-name-pattern "releases control at zero score"`: failed first with only `region_control_decayed`; passed after adding the release event, payload, projection deletion and decay pairing.
- `node --import tsx --test ../agent-server/test/epoch-game-core.test.ts --test-name-pattern "region control maintenance decay"`: passed 111/111 for nonzero decay, zero-score release and runtime maintenance decay.
- `node --import tsx --test ../agent-server/test/maintenance.test.ts --test-name-pattern "decays stale region control"`: passed 17/17 for scheduled maintenance region-control decay.
- `node --import tsx --test ../agent-server/test/packageArchive.test.ts --test-name-pattern "downloadable package contains"`: passed 7/7 after package guidance updates.
- `npm run typecheck`: passed; no JS/MJS/CJS/JSX source, no explicit production `any`, web typecheck and agent-server typecheck all passed.
- `npm run agent:test`: passed 402/402.
- `npm run agent:ui-test`: passed 135/135.
- `npm run batch:test`: passed 11/11.
- `npm run build`: passed and exported `00_总览/黑曜纪元3D世界地图.html`.

Remaining risk:

- This closes the first neutral release rule for decay-to-zero control. It still does not model player-triggered revolt battles, new-controller claims after release, raid target recommendation queues or high-region season balance tuning.

## 2026-07-03 Raid Same-Faction Matchmaking Guard Slice

- Added a second raid matchmaking anti-farm guard: `resolveRaid` now rejects attacker/defender pairs when both identities have positive season standings in the raid region and the server resolves both standings to the same faction.
- The guard uses canonical season standing evidence instead of client-declared faction prose; if either side lacks same-region faction evidence, existing raid settlement rules continue to apply.
- The guard runs after both identities and attacker ownership are resolved from server state and before attacker stamina is validated or spent, so blocked same-faction raids cannot mint rewards, write `raid_resolved`, create traces or open retaliation opportunities.
- Updated packaged Skill/protocol guidance so installed hosts describe both same-explorer and same-region same-faction raid pairs as matchmaking self-dealing, alongside cooldown and reward decay rules.

Verification:

- `node --import tsx --test ../agent-server/test/epoch-game-core.test.ts --test-name-pattern "same-faction regional targets"`: failed first with `Missing expected exception`; passed after adding the season-standing faction guard before stamina spend.
- `node --import tsx --test ../agent-server/test/epoch-game-core.test.ts --test-name-pattern "raid resolution|same-explorer identities|same-faction regional targets|raid repeat|regional raid heat"`: passed 112/112 for normal raid settlement, same-explorer rejection, same-faction rejection, pair cooldown, repeat reward decay and hot-region reward decay.
- `npm run typecheck`: passed; no JS/MJS/CJS/JSX source, no explicit production `any`, web typecheck and agent-server typecheck all passed.
- `node --import tsx --test ../agent-server/test/packageArchive.test.ts --test-name-pattern "downloadable package contains"`: passed 7/7 after package guidance updates.
- `npm run agent:test`: passed 403/403.
- `npm run agent:ui-test`: passed 135/135.
- `npm run batch:test`: passed 11/11.
- `npm run build`: passed and exported `00_总览/黑曜纪元3D世界地图.html`.

Remaining risk:

- This closes the first faction-evidence raid self-dealing rule. It still does not model cross-faction match balancing, player-triggered revolt battles or high-region season balance tuning.

## 2026-07-03 Raid Target Recommendation Read Model Slice

- Added `region_info.raidTargets[]`, a server-derived target recommendation queue for raids.
- The queue is built from active identities with positive same-region season standings, server-resolved factions, canonical explorer ownership and recent pair raid history.
- Recommendations filter out same-explorer pairs, same-faction pairs and pairs still inside the raid pair cooldown window before returning attacker/target ids, factions, target season score, target defense power, recommendation score, source season ids and optional latest pair raid pointers.
- `obsidian_epoch.region_info` now accepts `raidTargetAttackerAgentId` and `raidTargetLimit` so installed MCP hosts can ask for a player-specific target queue instead of inventing targets from prose.
- Agent Console region panels now show the server-provided recommendation queue beside raid heat and faction pressure.
- Updated frontend shared types plus packaged Skill/protocol guidance so clients treat raid target legality as server evidence.

Verification:

- `node --import tsx --test ../agent-server/test/mcp.test.ts --test-name-pattern "raid target recommendations"`: failed first because `region.raidTargets` was absent; passed after adding the runtime read model, MCP schema and canonical filters.
- `node --import tsx --test src/agent/AgentExplorer.layout.test.ts --test-name-pattern "raid target recommendations"`: passed 102/102 after the Agent Console region panel surfaced `region.raidTargets`.
- `node --import tsx --test ../agent-server/test/mcp.test.ts --test-name-pattern "MCP tool registry exposes|region info exposes server-derived frontlines|raid target recommendations"`: passed 80/80 for MCP registry, existing frontlines and new raid target recommendations.
- `npm run typecheck`: passed; no JS/MJS/CJS/JSX source, no explicit production `any`, web typecheck and agent-server typecheck all passed.
- `node --import tsx --test ../agent-server/test/packageArchive.test.ts --test-name-pattern "downloadable package contains"`: passed 7/7 after package guidance updates.
- `npm run agent:test`: passed 404/404.
- `npm run agent:ui-test`: passed 136/136.
- `npm run batch:test`: passed 11/11.
- `npm run build`: passed and exported `00_总览/黑曜纪元3D世界地图.html`.

Remaining risk:

- This closes the first server-side raid target recommendation queue. It still does not model cross-faction match balancing, player-triggered revolt battles, new-controller claims after control release or high-region season balance tuning.

## 2026-07-03 Region Control Released Claim Slice

- Added an operator/server `obsidian_epoch.claim_region_control` path for claiming a released region-control slot after decay reaches zero.
- The claim requires no active controller, the latest `region_control_released` evidence for that region, a same-region season, a positive faction score, and optional positive standing for the active claiming agent.
- `region_control_changed` now carries `sourceReleaseId`, `previousControlSourceSeasonId`, `claimingAgentId`, `claimingExplorerId` and `reason: "released_region_claim"` for audit replay.
- Runtime, MCP registry/call map, active-identity audit coverage, install manifests, package protocol docs and Agent Console types/UI now expose the claim path and the post-release audit fields.

Verification:

- `node --import tsx --test ../agent-server/test/epoch-game-core.test.ts --test-name-pattern "released region control can be claimed"`: failed first with `TypeError: core.claimReleasedRegionControl is not a function`; passed after adding the core command and projection audit fields.
- `node --import tsx --test ../agent-server/test/epoch-game-core.test.ts --test-name-pattern "released region control can be claimed|region control maintenance decay"`: passed 113/113 for nonzero decay, zero-score release, post-release claim and runtime maintenance decay.
- `node --import tsx --test ../agent-server/test/mcp.test.ts --test-name-pattern "MCP operator can claim released region control from season standings"`: passed 81/81 after adding runtime/MCP registration, operator-key enforcement and packaged active-identity coverage.
- `node --import tsx --test src/agent/AgentExplorer.layout.test.ts --test-name-pattern "region control"`: passed 102/102 after surfacing `sourceReleaseId` and `claimingAgentId` in the Agent Console region panel.
- `node --import tsx --test ../agent-server/test/packageArchive.test.ts --test-name-pattern "downloadable package contains"`: failed first because packaged install manifests omitted `obsidian_epoch.claim_region_control`; passed 7/7 after aligning both package manifests.
- `npm run typecheck`: passed; no JS/MJS/CJS/JSX source, no explicit production `any`, web typecheck and agent-server typecheck all passed.
- `npm run agent:test`: passed 406/406.
- `npm run agent:ui-test`: passed 136/136.
- `npm run batch:test`: passed 11/11.
- `npm run build`: passed and exported `00_总览/黑曜纪元3D世界地图.html`.

Remaining risk:

- This closes server/operator claims after release. It still does not model player-triggered revolt battles, cross-faction match balancing beyond the current legal target queue, or high-region season balance tuning.

## 2026-07-03 Region Control Released Revolt Slice

- Added an owner-authorized `obsidian_epoch.resolve_region_revolt` path for player-triggered battles over released region-control slots.
- The revolt requires no active controller, the latest `region_control_released` evidence, a same-region season, positive rebel faction score, positive rebel agent standing, and real rebel stamina spend.
- The server writes `resource_spent`, `region_revolt_resolved`, `region_influence_changed` and `trace_created`; a successful revolt also writes `region_control_changed` with `reason: "released_region_revolt"`, `sourceReleaseId`, `previousControlSourceSeasonId`, `claimingAgentId` and `claimingExplorerId`.
- Runtime, MCP registry/call map, HTTP route `/api/epoch/region-control/revolt`, frontend API, Agent Console controls, install manifests and package Skill/protocol docs now expose the owner-authorized revolt path.

Verification:

- `node --import tsx --test ../agent-server/test/epoch-game-core.test.ts --test-name-pattern "released region control can be won"`: failed first with `TypeError: core.resolveRegionRevolt is not a function`; passed after adding the core command and projection.
- `node --import tsx --test ../agent-server/test/mcp.test.ts --test-name-pattern "tool registry exposes|owner can win released region control|operator can claim released region control"`: passed 82/82 after MCP/runtime registration and owner recovery enforcement.
- `node --import tsx --test ../agent-server/test/server.test.ts --test-name-pattern "released region control through revolt battle"`: passed; the runner executed the server suite and included the HTTP revolt route proof.
- `node --import tsx --test src/agent/api.test.ts --test-name-pattern "region revolt API"`: failed first because `resolveEpochRegionRevolt` was not exported; passed after adding the frontend route wrapper.
- `node --import tsx --test src/agent/AgentExplorer.layout.test.ts --test-name-pattern "resource-spending writes|region control"`: failed first because the Agent Console lacked `发动起义`, `revoltStamina` and recovery-authorized API wiring; passed after adding the UI control and handler.
- `node --import tsx --test ../agent-server/test/packageArchive.test.ts --test-name-pattern "downloadable package contains"`: failed first because manifest tool ordering diverged; passed 7/7 after aligning both package manifests.
- `npm run typecheck`: failed first because `region_revolt` was missing from `EpochIdKind`; passed after adding the id kind.
- `npm run agent:test`: passed 409/409.
- `npm run agent:ui-test`: passed 137/137.
- `npm run batch:test`: passed 11/11.
- `npm run build`: passed and exported `00_总览/黑曜纪元3D世界地图.html`.
- `git diff --check`: passed.
- Direct trailing-whitespace scan over touched files: no output.

Remaining risk:

- This closes the player-triggered post-release revolt path. Remaining region-control work is mostly cross-faction battle tuning, defended-revolt UX/reporting depth and high-region season balance tuning.

## 2026-07-03 Region Control Open Slot Visibility Slice

- Added explicit open-slot visibility when a region has no active `region_info.regionControl` row after release or before any season control.
- Agent Console now renders `区域控制 · 空置` with `等待声明或起义`, instead of silently omitting the region-control row.
- Public region pages now render `控制位开放` with `等待声明或起义`, so release/defended-revolt states are visibly different from a missing page section.

Verification:

- `node --import tsx --test src/agent/AgentExplorer.layout.test.ts --test-name-pattern "region control"`: failed first because the console did not contain `区域控制 · 空置`; passed 102/102 after adding the empty-control row.
- `node --import tsx --test ../agent-server/test/server.test.ts --test-name-pattern "open region control slots"`: failed first because the public page still said only `暂无区域控制记录`; passed 85/85 after adding the open-slot tile.
- `npm run typecheck`: passed; no JS/MJS/CJS/JSX source, no explicit production `any`, web typecheck and agent-server typecheck all passed.
- `npm run agent:ui-test`: passed 137/137.
- `npm run build`: passed and exported `00_总览/黑曜纪元3D世界地图.html`.

Remaining risk:

- This closes the visible open-control-slot state. Remaining region-control work is cross-faction battle tuning, defended-revolt result-page depth and high-region season balance tuning.

## 2026-07-03 Result Page Region Control Context Slice

- Added explicit region-control state to result-page `regionalContext`.
- New result pages now include `regionalContext.regionControl`; active control carries the canonical control row, while open slots are represented as `null` instead of being omitted.
- Public result pages now render a “区域控制” column. Open slots display `控制位开放` and `等待声明或起义`, so a shared result page after release/revolt states no longer hides the control vacancy.
- The Agent Console result panel now summarizes the same region-control context during preview and after publishing, including open-slot guidance.
- Frontend result-page types accept the field as optional/null for historical shared-page compatibility while the runtime emits it explicitly for new pages.

Verification:

- `node --import tsx --test ../agent-server/test/server.test.ts --test-name-pattern "HTTP result pages expose continuation actions and regional context"`: failed first with `undefined !== null` for `payload.regionalContext.regionControl`; passed 85/85 after adding the runtime field and public HTML rendering.
- `node --import tsx --test src/agent/AgentExplorer.layout.test.ts --test-name-pattern "Agent console result panel surfaces next actions and regional context"`: failed first because the console did not reference `resultPage.regionalContext.regionControl`; passed 102/102 after adding the summary and open-slot row.
- `npm run typecheck`: passed; no JS/MJS/CJS/JSX source, no explicit production `any`, web typecheck and agent-server typecheck all passed.

Remaining risk:

- This closes the result-page open-control-slot depth gap. Remaining region-control work is cross-faction battle tuning and high-region season balance tuning.

## 2026-07-03 Cross-Faction Raid Power Tuning Slice

- Added the first cross-faction battle tuning rule for `resolveRaid`.
- When both attacker and defender have positive same-region season standings in different factions, the raid battle formula now adds a small capped season-standing power bonus to each side.
- The bonus is canonical and bounded: every 2 standing points grants +1 power, capped at +3, and only applies when both sides have server-resolved cross-faction season evidence.
- Existing anti-farm boundaries still run first: same-explorer raids and same-region same-faction season-standing pairs are rejected before stamina is spent.
- Updated packaged Skill/protocol guidance so installed hosts quote returned `attackerPower` / `defenderPower` and do not invent battle modifiers.

Verification:

- `node --import tsx --test ../agent-server/test/epoch-game-core.test.ts --test-name-pattern "cross-faction season standings"`: failed first because defender power stayed at the old resource-only value `3`; passed 115/115 after adding the capped season-standing bonus.

Remaining risk:

- This closes the first cross-faction raid battle tuning rule. Remaining region-control/faction-loop work is high-region season balance tuning.

## 2026-07-03 High-Region Season Control Bonus Cap Slice

- Added the first high-region season balance cap for region-control feedback.
- Matching settled region control still contributes +1 score per controlled season region, but `regionControlBonusScore` is now capped at +3 per contribution.
- `sourceRegionControlRegionIds[]` still records every matching controlled region for audit, even when the score contribution is capped.
- Resource accounting remains unchanged: `amount` is still the real resource spend, and the capped control bonus remains score-only.
- Updated packaged Skill/protocol guidance so installed hosts describe the +3 cap and do not treat high-region control as an uncapped client-declared reward.

Verification:

- `node --import tsx --test ../agent-server/test/epoch-game-core.test.ts --test-name-pattern "capped for high-region seasons"`: failed first with `4 !== 3`; passed after capping `regionControlBonusScore`.
- `node --import tsx --test ../agent-server/test/epoch-game-core.test.ts --test-name-pattern "season contributions gain score-only bonus|season control contribution bonus scales|capped for high-region seasons|training hall adds server-side season contribution score|seasonal faction campaigns spend"`: passed 116/116 for the focused season-control contribution surface.

Remaining risk:

- This closes the listed high-region season balance tuning item for region-control feedback. Future tuning can still add richer season templates or live-ops balance, but no known spec blocker remains in the current region-control slice.

## 2026-07-03 Direct Trade Audit Drilldown Slice

- Added `aggregateId` filtering to `obsidian_epoch.audit` and `/api/epoch/audit`, so clients can request the canonical event chain for a single aggregate without scanning unrelated recent audit rows.
- Wired the Agent Console private direct-trade panel with a `交易审计` action on each visible trade.
- The direct-trade drilldown now loads audit rows for `aggregateId = trade.tradeId`, filters to `direct_trade_created`, `direct_trade_accepted`, `direct_trade_cancelled` and `direct_trade_expired`, and renders public `/epoch/audit/{eventId}` links.
- Updated packaged MCP schema guidance, Skill guidance and protocol reference so installed hosts can inspect one private escrow's event history through `aggregateId` rather than prose summaries.
- Kept audit payloads redacted and read-only; the drilldown does not grant trade authority, reveal recovery material or mutate escrow state.

Verification:

- `node --import tsx --test src/agent/AgentExplorer.layout.test.ts --test-name-pattern "private direct trades"`: failed first because the direct-trade panel had no `交易审计`, `loadDirectTradeAudit` or audit link surface; passed after adding the UI drilldown.
- `node --import tsx --test ../agent-server/test/server.test.ts --test-name-pattern "HTTP direct trades escrow"`: failed first because `/api/epoch/audit?aggregateId=...` returned no `aggregateId`; passed after adding runtime and HTTP aggregate filtering.
- `node --import tsx --test ../agent-server/test/packageArchive.test.ts --test-name-pattern "downloadable package contains"`: passed after requiring packaged Skill/protocol references to mention `aggregateId` direct-trade `tradeId` audit drilldown.
- `npm run typecheck`: passed.
- `npm run agent:test`: passed 412/412.
- `npm run agent:ui-test`: passed 137/137.
- `npm run batch:test`: passed 11/11.
- `npm run build`: passed and exported `00_总览/黑曜纪元3D世界地图.html`.
- `git diff --check`: passed.
- Direct trailing-whitespace scan over touched files: no output.

Remaining risk:

- This closes the direct-trade history drilldown gap for per-trade canonical event evidence. Larger trade-history pagination, richer event payload comparison and operator-oriented trade analytics can remain future UI/reporting polish.

## 2026-07-03 Turn Card Expiry TTL Slice

- Added a 15-minute `expiresAt` deadline to server-issued turn cards.
- `resolveTurnCard` now rejects stale open cards with `turn_card_expired` before settlement, keeping old option IDs from being replayed after the short action window.
- `/api/epoch/turns/resolve` maps `turn_card_expired` to a client-visible bad-request response instead of an opaque server error.
- The Agent Console turn-card panel now displays the current card expiry timestamp beside the server-issued action options.
- Updated packaged Skill/protocol guidance and package archive checks so installed hosts learn to refresh stale cards instead of reusing expired choices.

Verification:

- `node --import tsx --test ../agent-server/test/epoch-game-core.test.ts --test-name-pattern "turn cards expire"`: failed first because `expiresAt` was missing from the created card; passed after adding the TTL payload/projection and stale-resolution guard.
- `node --import tsx --test src/agent/AgentExplorer.layout.test.ts --test-name-pattern "turn-card controls"`: passed 102/102 after adding the Agent Console expiry display assertion.
- `node --import tsx --test ../agent-server/test/packageArchive.test.ts --test-name-pattern "downloadable package contains"`: passed 7/7 after requiring packaged Skill/protocol references to mention `turn_card`, `expiresAt`, `15 minutes` and `turn_card_expired`.
- `npm run typecheck`: passed.
- `npm run agent:test`: passed 413/413.
- `npm run agent:ui-test`: passed 137/137.
- `npm run batch:test`: passed 11/11.
- `npm run build`: passed and exported `00_总览/黑曜纪元3D世界地图.html`.
- `git diff --check`: passed.
- Direct trailing-whitespace scan over touched files: no output.

Remaining risk:

- This closes the short-lived turn-card expiry part of the anti-cheat/checkpoint spec. A fuller future anti-replay slice can still add stricter run-sequence/nonce heartbeat rules and one-outstanding-card-per-sequence enforcement.

## 2026-07-03 Turn Card One-Outstanding Guard Slice

- Added a server-side guard that allows only one unexpired open `turn_card` per active identity.
- New turn-card creation now fails with `turn_card_already_open` when the same identity already has an unexpired open card, preventing parallel option-set fishing.
- Resolved cards no longer block new cards, and expired open cards can be refreshed after their `expiresAt` window passes.
- Shared the same expiry boundary helper between creation-time blocking and resolution-time stale-card rejection.
- Mapped `turn_card_already_open` through the HTTP bad-request error surface and updated packaged Skill/protocol guidance so installed hosts resolve or wait out the existing card instead of requesting another option set.

Verification:

- `node --import tsx --test ../agent-server/test/epoch-game-core.test.ts --test-name-pattern "one unexpired open"`: failed first because creating a second open card did not throw; passed after adding the creation guard.
- `node --import tsx --test ../agent-server/test/packageArchive.test.ts --test-name-pattern "downloadable package contains"`: failed first because packaged Skill/protocol docs did not mention one outstanding `turn_card` or `turn_card_already_open`; passed after updating the package guidance.
- `npm run typecheck`: passed.
- `npm run agent:test`: passed 414/414.
- `npm run agent:ui-test`: passed 137/137.
- `npm run batch:test`: passed 11/11.
- `npm run build`: passed and exported `00_总览/黑曜纪元3D世界地图.html`.
- `git diff --check`: passed.
- Direct trailing-whitespace scan over touched files: no output.

Remaining risk:

- This closes the one-outstanding-card anti-fishing rule at the active identity level. Future anti-replay work can still add explicit per-run sequence numbers, nonce-bearing signed envelopes and heartbeat windows.

## 2026-07-03 Turn Card Sequence/Nonce Echo Binding Slice

- Added server-issued `sequence` and `nonce` fields to every `turn_card_created` payload and turn-card projection.
- `resolveTurnCard` now requires the client to echo the exact card `sequence` and `nonce` before any server settlement, rejecting missing or mismatched values with `turn_card_sequence_required`, `turn_card_sequence_mismatch`, `turn_card_nonce_required` or `turn_card_nonce_mismatch`.
- Resolve-turn confirmation challenges now bind the same `sequence` and `nonce` into the subject hash, so a confirmed token cannot be replayed against a stale card sequence or different nonce.
- HTTP, MCP, package docs, package archive checks and the install-smoke command now pass the sequence/nonce envelope through `request_confirmation` and `resolve_turn`.
- The Agent Console displays the current card sequence and nonce, and sends both through recovery-authorized, web-confirmed and direct resolve flows.

Verification:

- `node --import tsx --test ../agent-server/test/epoch-game-core.test.ts --test-name-pattern "sequence and nonce"`: failed first because `card.value.sequence` was missing; passed after adding the payload/projection and resolve validation.
- `node --import tsx --test src/agent/AgentExplorer.layout.test.ts --test-name-pattern "turn-card controls"`: failed first because the Agent Console did not expose `currentTurnCard.sequence`; passed after UI/API wiring.
- `node --import tsx --test ../agent-server/test/packageArchive.test.ts --test-name-pattern "downloadable package contains"`: failed first because package docs did not mention turn-card sequence/nonce resolve binding; passed 7/7 after updating package guidance.
- `node --import tsx --test ../agent-server/test/server.test.ts --test-name-pattern "world overview|web-confirmed one-time tokens|Epoch routes persist|result pages expose|install smoke flow|risky turn exhaustion"`: passed 85/85 after HTTP callers echoed sequence/nonce.
- `node --import tsx --test ../agent-server/test/mcp.test.ts --test-name-pattern "web-confirmed one-time owner tokens|Epoch tools expose server-issued|risky turn exhaustion"`: passed 82/82 after MCP callers echoed sequence/nonce.
- `node --import tsx --test ../agent-server/test/install-smoke-command.test.ts`: passed 12/12 after the packaged smoke flow echoed card sequence/nonce in `obsidian_epoch.resolve_turn`.
- `node --import tsx --test ../agent-server/test/release-rehearsal-command.test.ts`: passed 3/3.
- `npm run typecheck`: passed; no JS/MJS/CJS/JSX source, no explicit production `any`, web typecheck and agent-server typecheck all passed.
- `npm run agent:test`: passed 415/415.
- `npm run agent:ui-test`: passed 137/137.
- `npm run batch:test`: passed 11/11.
- `npm run build`: passed and exported `00_总览/黑曜纪元3D世界地图.html`.
- `git diff --check`: passed.

Remaining risk:

- This closes the turn-card sequence/nonce echo replay guard for the active server-issued turn loop. Future anti-cheat/checkpoint work can still add signed response envelopes, explicit run-ticket sequence windows, heartbeat expiry and broader channel-class enforcement across non-turn state changes.

## 2026-07-03 Turn Card Signed Envelope Slice

- Added a server-signed `signedEnvelope` to every server-issued `turn_card`.
- The envelope carries `envelopeId`, `protocolVersion`, Ed25519 `signatureAlgorithm`, server public key, `contentHash`, signature, `trustClass` and `runTicketId: null` for the current non-ticket turn-card loop.
- The signed content hash covers visible card facts and public option ids: `turnCardId`, `agentId`, `explorerId`, `regionId`, sequence, nonce, expiry, visible context and returned `actionOptionId`s.
- Agent Console now surfaces the envelope id, content hash and a short signature preview beside the turn-card sequence/nonce.
- Packaged Skill/protocol guidance now says the signed envelope is an integrity/audit proof for honest clients, not proof of model delivery in generic MCP.
- Renamed the local signing helper to avoid prefix-colliding with the returned core method name `createTurnCard`; the MCP active-method coverage scanner depends on source method names and caught this during full verification.

Verification:

- `node --import tsx --test ../agent-server/test/epoch-game-core.test.ts --test-name-pattern "server-signed envelope"`: failed first because `card.value.signedEnvelope` was missing; passed 120/120 after adding the envelope payload, projection and Ed25519 verification.
- `node --import tsx --test ../agent-server/test/packageArchive.test.ts --test-name-pattern "downloadable package contains"`: failed first because package Skill/protocol docs did not mention `signedEnvelope`, `contentHash`, `signature` or “not proof of delivery”; passed 7/7 after docs updates.
- `node --import tsx --test src/agent/AgentExplorer.layout.test.ts --test-name-pattern "turn-card controls"`: failed first because Agent Console did not reference `currentTurnCard.signedEnvelope`; passed 102/102 after the UI display update.
- `node --import tsx --test ../agent-server/test/mcp.test.ts --test-name-pattern "tool registry exposes"`: passed 82/82 after renaming the helper that shadowed the test scanner's `createTurnCard` lookup.
- `npm run typecheck`: passed; no JS/MJS/CJS/JSX source, no explicit production `any`, web typecheck and agent-server typecheck all passed.
- `npm run agent:test`: passed 416/416.
- `npm run agent:ui-test`: passed 137/137.
- `npm run batch:test`: passed 11/11.
- `npm run build`: passed and exported `00_总览/黑曜纪元3D世界地图.html`.
- `git diff --check`: passed.
- Direct trailing-whitespace scan over touched files: no output.

Remaining risk:

- This closes the server-signed turn-card envelope integrity/audit requirement for the current turn-card loop. Future checkpoint work can still add signed response envelopes, explicit run-ticket sequence windows, heartbeat expiry and channel-class enforcement for all state-changing responses.

## 2026-07-03 Resolve Turn Response Protocol Slice

- `turn_resolved` payloads and `EpochTurnResolution` projections now declare `channelClass` and `envelopeId` in addition to the existing `turnCardId`, `sequence` and `actionOptionId` response identifiers.
- `channelClass` records the trusted command context used for the settlement, such as `system_worker` in core/server-worker flows or `user_verified_web` through ordinary owner-authorized HTTP/MCP flows.
- `envelopeId` binds the resolution response back to the original server-signed turn-card envelope, so a client can correlate the selected option and settlement with the signed card, sequence and nonce.
- Agent Console resolved-turn output now surfaces the response `channelClass` and `envelopeId` beside the server-written option result.
- Packaged Skill/protocol guidance now documents that `resolve_turn` responses declare `channelClass`, `envelopeId`, `turnCardId`, `sequence` and `actionOptionId`.

Verification:

- `node --test tools/agent-server/test/epoch-game-core.test.ts --test-name-pattern "turn cards bind resolution to server sequence and nonce"`: failed first because `resolved.value.channelClass` was `undefined`; passed after adding the response fields to event payloads and projection.
- `node --test tools/graph-react-app/src/agent/AgentExplorer.layout.test.ts --test-name-pattern "Agent console exposes recovery-authorized and web-confirmed turn-card controls"`: failed first because Agent Console did not reference `currentTurnCard.resolution.channelClass`; passed after UI display wiring.
- `node --test tools/agent-server/test/packageArchive.test.ts --test-name-pattern "Obsidian Epoch package includes host install docs and smoke playbooks"`: failed first because package Skill/protocol docs did not mention the `resolve_turn` response field set; passed after docs updates.
- `npm run typecheck`: passed; no JS/MJS/CJS/JSX source, no explicit production `any`, web typecheck and agent-server typecheck all passed.
- `npm run agent:test`: passed 416/416.
- `npm run agent:ui-test`: passed 137/137.
- `npm run batch:test`: passed 11/11.
- `npm run build`: passed and exported `00_总览/黑曜纪元3D世界地图.html`.
- `git diff --check`: passed.
- Direct trailing-whitespace scan over touched files: no output.

Remaining risk:

- This closes the explicit `resolve_turn` response declaration required by the trusted information transfer spec. Future checkpoint work still needs to extend channel-class/delivery-trust labeling across run summaries and result pages, plus broader invalid-channel downgrade behavior outside the turn-card loop.

## 2026-07-03 Result Page Receipt Trust Labels Slice

- Result-page receipts now declare `channelClass` and `deliveryTrust` alongside `playMode`, `trustTier`, `payloadHash`, focus and canonical audit events.
- Focused hosted/Web/attested result pages derive `channelClass` from the hosted session and derive `deliveryTrust` from hosted settlement or attestation events, so remote-attested focused pages surface `remote_attested_runner` instead of only the owner-verified session start.
- Focused turn-card result pages derive both labels from the resolved turn's server-recorded `channelClass`, preserving the owner-verified turn settlement label.
- Public result pages render the receipt channel and delivery trust labels, and the Agent Console result panel shows the same receipt labels before trust-class and canonical-event counts.
- Packaged Skill/protocol guidance now tells installed hosts to cite `payload.receipt.channelClass` and `payload.receipt.deliveryTrust` when summarizing result-page proof.

Verification:

- `node --test tools/agent-server/test/server.test.ts --test-name-pattern "HTTP result pages expose continuation actions and regional context|HTTP attested runner rejects forged signatures and records verified hosted actions"`: failed first because `payload.receipt.channelClass` and `payload.receipt.deliveryTrust` were missing; passed after receipt label derivation and public-page rendering. During GREEN, the attested hosted page initially reported `user_verified_web`; passed after deriving focused hosted delivery trust from settlement/attestation events.
- `node --test tools/graph-react-app/src/agent/AgentExplorer.layout.test.ts --test-name-pattern "Agent console surfaces result page server receipts"`: failed first because Agent Console did not reference `resultPage.receipt.channelClass`; passed after displaying channel/delivery labels.
- `node --test tools/agent-server/test/packageArchive.test.ts --test-name-pattern "Obsidian Epoch package includes host install docs and smoke playbooks"`: failed first because packaged Skill/protocol docs did not mention the result receipt channel/delivery fields; passed after docs updates.
- `npm run typecheck`: passed; no JS/MJS/CJS/JSX source, no explicit production `any`, web typecheck and agent-server typecheck all passed.
- `npm run agent:test`: passed 416/416.
- `npm run agent:ui-test`: passed 137/137.
- `npm run batch:test`: passed 11/11.
- `npm run build`: passed and exported `00_总览/黑曜纪元3D世界地图.html`.
- `git diff --check`: passed.
- Direct trailing-whitespace scan over touched files: no output.

Remaining risk:

- This closes result-page receipt channel/delivery labeling for focused turn-card, hosted/Web bridge and attested result pages. Future checkpoint work still needs to add the same channel-class/delivery-trust declarations to run summaries and any remaining non-result response envelopes called out by the trusted information transfer spec.

## 2026-07-03 Legacy Run Summary Trust Labels Slice

- Legacy `agent_world.*` authored-report responses now declare `channelClass: "external_agent_hosted"` and `deliveryTrust: "untrusted_client"` from a shared low-level constant.
- `agent_world.context_package`, `agent_world.start_run` and `agent_world.submit_battle_report` expose those labels with the existing `loopMode: "legacy_authored_report"` marker.
- `submit_battle_report` writes the same labels into public transparency records and submitted run summaries, and HTTP JSONL persistence stores them for restart hydration.
- `hydrateAgentRuntimeOptions` preserves persisted labels on public world archive summaries, with legacy defaults for older `run_submitted` records that predate the fields.
- Packaged Skill/protocol guidance now tells installed hosts that legacy authored reports and their archive summaries are externally hosted, untrusted-client evidence, not verified autonomous play.
- `createAgentWorldMcpRuntime` now has an explicit narrow return interface for `listTools`, `callTool` and `runtime`, reducing TypeScript's need to infer the whole MCP handler graph in large tests.
- `typecheck:agent` runs TypeScript with a larger Node stack because `packageArchive.test.ts` plus the current server graph can otherwise hit a TypeScript internal recursion limit despite passing semantic checks with a larger stack.

Verification:

- `node --test tools/agent-server/test/mcp.test.ts --test-name-pattern "MCP tools run the world loop for an external agent"`: failed first because `context.channelClass` was `undefined`; the target test passed after adding legacy labels. The standalone runner was interrupted twice after the target pass because the file-level stdio child-test tail remained pending under that filtered invocation.
- Direct runtime script over `createAgentWorldMcpRuntime`: passed and verified context, ticket, settlement, transparency entry and public world archive labels.
- `node --test tools/agent-server/test/server.test.ts --test-name-pattern "HTTP run settlement persists legacy trust labels|JSONL records hydrate issued tickets and public submitted runs"`: failed first because HTTP ticket/run labels were missing; passed after persistence and hydration wiring.
- `node --test tools/agent-server/test/legacyTrustDocs.test.ts`: passed after packaged docs declared the legacy channel and delivery trust labels.
- `node --test tools/agent-server/test/packageArchive.test.ts --test-name-pattern "Obsidian Epoch package includes host install docs and smoke playbooks|downloadable package runs its bundled MCP proxy"`: passed 7/7 after dynamic runtime helper loading kept the package archive test runtime behavior intact.
- `npm run typecheck`: passed after narrowing MCP runtime types, adding an explicit non-null transparency assertion in the hydration test, and running agent-server TypeScript with a larger Node stack.
- `npm run agent:test`: passed 418/418.
- `npm run agent:ui-test`: passed 137/137.
- `npm run batch:test`: passed 11/11.
- `npm run build`: passed and exported `00_总览/黑曜纪元3D世界地图.html`.
- `git diff --check`: passed.
- Direct trailing-whitespace scan over touched files: no output.

Remaining risk:

- This closes legacy run-summary and authored-report channel/delivery labeling. Remaining trusted-information-transfer work is any still-unlabeled non-result response envelope outside the turn-card, result-page and legacy run-summary surfaces, plus future invalid-channel downgrade behavior across older compatibility paths.

## 2026-07-03 Hosted Action Response Trust Labels Slice

- Hosted action records and `hosted_action_recorded` event payloads now declare `channelClass` and `deliveryTrust`.
- Hosted action delivery trust is derived at settlement time from the hosted session channel and the trusted authority context, so a remote attested runner action can report `deliveryTrust: "remote_attested_runner"` even when the session was opened through owner recovery.
- Public hosted-session projections preserve the action-level labels for API, MCP and result-page consumers.
- Graph app shared types now expose optional hosted action labels for UI/API consumers.
- Packaged Skill/protocol guidance now tells installed hosts that `submit_hosted_action` / `submit_attested_action` responses and `hosted_action_recorded` payloads carry action-level channel and delivery trust labels.

Verification:

- `node --test tools/agent-server/test/epoch-game-core.test.ts --test-name-pattern "hosted runner records attestation evidence"`: failed first because `action.value.channelClass` was `undefined`; passed after adding action-level labels to payloads and projections.
- `node --test tools/agent-server/test/server.test.ts --test-name-pattern "HTTP attested runner rejects forged signatures and records verified hosted actions"`: failed first because HTTP attested action responses did not include action-level labels; passed after public hosted action serialization preserved them.
- `node --test tools/agent-server/test/mcp.test.ts --test-name-pattern "MCP attested runner verifies challenge signatures before settling hosted actions"`: failed first because MCP attested action responses did not include action-level labels; the full MCP suite passed after the same payload/projection fix.
- `node --test tools/agent-server/test/legacyTrustDocs.test.ts`: passed 2/2 after hosted action docs declared the response and event labels.
- `npm run typecheck`: passed; no JS/MJS/CJS/JSX source, no explicit production `any`, web typecheck and agent-server typecheck all passed.
- `npm run agent:test`: passed 419/419.
- `npm run agent:ui-test`: passed 137/137.
- `npm run batch:test`: passed 11/11.
- `npm run build`: passed and exported `00_总览/黑曜纪元3D世界地图.html`.

Remaining risk:

- This closes hosted action response labels for server-hosted and remote-attested action settlements. Remaining trusted-information-transfer work is any still-unlabeled non-result response envelope outside turn-card, hosted action, result-page and legacy run-summary surfaces, plus future invalid-channel downgrade behavior across older compatibility paths.

## 2026-07-03 Public Client Trust Spoof Downgrade Slice

- Public `obsidian_epoch.identity` first-registration events now ignore client-declared `trustClass` and record `untrusted_client` until a later owner-verified or trusted lane proves higher authority.
- Public `obsidian_epoch.npc_note` canonicalization now ignores client-declared `trustClass`, `channelClass` or local attestation prose and records ordinary public notes as `untrusted_client`.
- HTTP `obsidian_epoch.request_confirmation` internal audit events now ignore client-declared `trustClass` and persist `high_value_confirmation_requested` as `untrusted_client` until the later web/API owner-confirmation path proves ownership.
- MCP and HTTP regression tests cover forged `server_hosted_agent` / `remote_attested_runner` claims on those public entrances.
- Packaged Skill/protocol guidance now states that identity, NPC note and confirmation-request writes cannot self-promote trust; only dedicated owner-verified, operator, server-hosted or attested-runner paths can raise trust.

Verification:

- `node --test tools/agent-server/test/mcp.test.ts --test-name-pattern "MCP downgrades forged public client trust"`: failed first because a forged identity request recorded `server_hosted_agent`; the target test passed after switching public identity and NPC note contexts to `untrusted_client`. The filtered MCP file still has the known long-tail stdio pending behavior, so the command was interrupted after the target pass and covered by the full suite.
- `node --test tools/agent-server/test/server.test.ts --test-name-pattern "HTTP downgrades forged public client trust"`: failed first because a forged HTTP identity request recorded `server_hosted_agent`; passed 87/87 after the runtime context fix.
- `node --test tools/agent-server/test/server.test.ts --test-name-pattern "HTTP downgrades forged trust on high-value confirmation"`: failed first because the persisted `high_value_confirmation_requested` event recorded `server_hosted_agent`; passed 88/88 after switching the requested-confirmation event context to `untrusted_client`.
- `node --test tools/agent-server/test/legacyTrustDocs.test.ts --test-name-pattern "public client trust docs"`: failed first because package docs did not declare the identity/NPC-note/request-confirmation forged-trust downgrade; passed after docs updates.
- `npm run typecheck`: passed; no JS/MJS/CJS/JSX source, no explicit production `any`, web typecheck and agent-server typecheck all passed.
- `npm run agent:test`: passed 423/423.
- `npm run agent:ui-test`: passed 137/137.
- `npm run batch:test`: passed 11/11.
- `npm run build`: passed and exported `00_总览/黑曜纪元3D世界地图.html`.

Remaining risk:

- This closes concrete invalid-channel evidence downgrade classes for public identity, NPC-note and high-value confirmation request writes. Remaining trusted-information-transfer work includes any other externally callable public write that still reads trust evidence from request JSON, plus broader signed response envelopes and run-ticket sequence-window hardening.

## 2026-07-04 Resolve Turn Signed Response Envelope Slice

- `turn_resolved` event payloads, `EpochTurnResolution` projections and graph-app API types now include a server-generated `signedEnvelope`.
- The response envelope uses `obsidian-epoch.turn-resolution-envelope.v1`, Ed25519, the server release public key and a stable `contentHash` over the original turn-card envelope id, turn card id, sequence, nonce, selected option, explanation, visible text, outcome, reward, lifetime delta, trust class and resolution time.
- The response envelope id is distinct from the original turn-card envelope id, so clients can separately audit the server-issued option set and the later server-settled result.
- Agent Console now displays the resolved turn response envelope id, content hash and signature preview next to the selected option result.
- Packaged Skill/protocol guidance now tells installed hosts that `resolve_turn` responses carry their own signed settlement envelope for response integrity/audit checks, while still not proving delivery to a model in generic MCP.

Verification:

- `node --test tools/agent-server/test/epoch-game-core.test.ts --test-name-pattern "turn cards bind resolution to server sequence and nonce"`: failed first because `resolved.value.signedEnvelope` was missing; passed 120/120 after adding the response envelope to payloads, projection and the core result.
- `node --test tools/graph-react-app/src/agent/AgentExplorer.layout.test.ts --test-name-pattern "Agent console exposes recovery-authorized and web-confirmed turn-card controls"`: failed first because the resolved-card UI did not reference `currentTurnCard.resolution.signedEnvelope`; passed 102/102 after surfacing the response hash/signature.
- `node --test tools/agent-server/test/packageArchive.test.ts --test-name-pattern "Obsidian Epoch package includes host install docs and smoke playbooks"`: the initial broad assertion was too weak and falsely matched the turn-card envelope; the tightened assertion failed on missing `resolve_turn` response-envelope docs, then passed 7/7 after SKILL/protocol updates.
- `npm run typecheck`: failed first because `signedEnvelope` was accidentally placed on the builder input interface instead of `EpochTurnResolution`; passed after fixing the production type.
- `npm run agent:test`: passed 423/423.
- `npm run agent:ui-test`: passed 137/137.
- `npm run batch:test`: passed 11/11.
- `npm run build`: passed and exported `00_总览/黑曜纪元3D世界地图.html`.
- `git diff --check`: passed.
- Direct trailing-whitespace scan over touched files: no output.

Remaining risk:

- This closes signed response envelopes for the active turn-card settlement loop. Remaining trusted-information-transfer work includes explicit run-ticket sequence-window hardening, any other externally callable public write that still reads trust evidence from request JSON, and any non-turn response envelopes that should get the same signed audit treatment.

## 2026-07-04 Legacy Run-Ticket Sequence Window Slice

- Legacy `agent_world.start_run` tickets now carry a server-issued `sequence` and `sequenceWindow` alongside the existing `runTicket`, expiry and legacy trust labels.
- `submitTicket` now requires unsubmitted ticket payloads to echo a positive integer sequence inside the ticket window, rejecting missing values with `ticket_sequence_required` and wrong-window values with `ticket_sequence_mismatch`.
- Already-submitted legacy tickets preserve the old idempotent replay behavior for an identical run hash, so persisted historical submissions can still hydrate and duplicate safely.
- MCP `agent_world.submit_battle_report` now exposes `sequence` in its input schema and normalizes top-level `sequence` into the submitted run payload before adjudication/persistence.
- HTTP `/api/runs/submit` maps `ticket_sequence_required` and `ticket_sequence_mismatch` to 400 responses, and JSONL persistence stores the normalized run sequence so restart hydration computes the same run hash.
- Packaged Skill/protocol guidance now tells installed hosts to echo `start_run.sequence` with `runTicket`, and documents the sequence-window rejection errors for the older authored-report loop.

Verification:

- `node --test tools/agent-server/test/tickets.test.ts --test-name-pattern "submitTicket requires the server-issued sequence window"`: failed first because tickets had no `sequence` and submission without sequence did not throw; passed after adding ticket sequence/window generation and validation.
- `node --test tools/agent-server/test/tickets.test.ts`: passed 6/6 after updating existing legal submissions to include the issued sequence.
- `node --test tools/agent-server/test/server.test.ts --test-name-pattern "HTTP submit requires the run-ticket sequence window|HTTP run settlement persists legacy trust labels|JSONL records hydrate issued tickets"`: failed first because sequence validation errors mapped to 500 and hydrated duplicate replay omitted the sequence; passed 89/89 after adding HTTP error mapping and normalized persistence/replay.
- `node --test tools/agent-server/test/legacyTrustDocs.test.ts --test-name-pattern "legacy authored-report docs declare channel and delivery trust labels"`: failed first because package docs did not mention `sequenceWindow`; passed after SKILL/protocol updates.
- `node --test tools/agent-server/test/packageArchive.test.ts --test-name-pattern "Obsidian Epoch package includes host install docs and smoke playbooks"`: passed 7/7 after the packaged archive assertions covered legacy sequence-window guidance.
- `node --test tools/agent-server/test/mcp.test.ts --test-name-pattern "MCP submit requires the run-ticket sequence window"`: target test passed, then the filtered MCP file hit the known pending stdio tail and was interrupted; the full suite below covered the same MCP path cleanly.
- `npm run typecheck`: passed; no JS/MJS/CJS/JSX source, no explicit production `any`, web typecheck and agent-server typecheck all passed.
- `npm run agent:test`: passed 426/426.
- `npm run agent:ui-test`: passed 137/137.
- `npm run batch:test`: passed 11/11.
- `npm run build`: passed and exported `00_总览/黑曜纪元3D世界地图.html`.
- `git diff --check`: passed.
- Direct trailing-whitespace scan over touched files: no output.

Remaining risk:

- This closes explicit sequence-window hardening for the legacy authored-report run-ticket loop. Remaining trusted-information-transfer work includes any other externally callable public write that still reads trust evidence from request JSON, heartbeat expiry for long-running/offline handoffs if needed, and deciding which non-turn response envelopes deserve the same signed audit treatment.

## 2026-07-04 Hosted Action Signed Response Envelope Slice

- `hosted_action_recorded` payloads, `EpochHostedActionRecord` projections and graph-app shared types now include a server-generated `signedEnvelope`.
- The response envelope uses `obsidian-epoch.hosted-action-envelope.v1`, Ed25519, the server release public key and a stable `contentHash` over the action id, session id, agent id, selected option, explanation, visible text, outcome, reward, lifetime delta, channel class, delivery trust, attestation id and recorded time.
- Hosted action response envelopes use `deliveryTrust` as the envelope trust class, so remote attested runner settlements carry `remote_attested_runner` in both the action-level delivery label and the signed response metadata.
- Public hosted-session serializers preserve the envelope in redacted action DTOs, so HTTP/MCP consumers, result-page previews and restart-hydrated projections see the same response integrity proof.
- Packaged Skill/protocol guidance now tells installed hosts that `submit_hosted_action` and `submit_attested_action` responses carry response `signedEnvelope` fields with `contentHash`, Ed25519 `signature` and server public key.

Verification:

- `node --test tools/agent-server/test/epoch-game-core.test.ts --test-name-pattern "hosted runner records attestation evidence"`: failed first because `action.value.signedEnvelope` was missing; passed 120/120 after adding the hosted action envelope to payloads, projection and the core response.
- `node --test tools/agent-server/test/server.test.ts --test-name-pattern "HTTP attested runner rejects forged signatures and records verified hosted actions"`: passed 89/89 after HTTP attested responses and public hosted-session projections exposed matching envelope hashes.
- `node --test tools/agent-server/test/legacyTrustDocs.test.ts --test-name-pattern "hosted action docs declare action-level channel and delivery trust labels"`: a broad assertion first matched later turn-card envelope docs, then the tightened hosted-response assertion failed until SKILL/protocol docs described hosted action response envelopes; passed after docs updates.
- `node --test tools/agent-server/test/packageArchive.test.ts --test-name-pattern "Obsidian Epoch package includes host install docs and smoke playbooks"`: passed 7/7 with packaged hosted action envelope assertions.
- `npm run typecheck`: failed first because `publicHostedAction` did not include required `signedEnvelope`; passed after preserving the envelope in public hosted action DTOs.
- `npm run agent:test`: passed 426/426.
- `npm run agent:ui-test`: passed 137/137.
- `npm run batch:test`: passed 11/11.
- `npm run build`: passed and exported `00_总览/黑曜纪元3D世界地图.html`.
- `git diff --check`: passed.
- Direct trailing-whitespace scan over touched files: no output.

Remaining risk:

- This closes signed response envelopes for hosted action and attested hosted action settlements. Remaining trusted-information-transfer work is limited to any still-unsigned non-turn response surface that should expose an auditable server response envelope, plus heartbeat expiry for long-running/offline handoffs if product requirements make that lane explicit.

## 2026-07-04 Legacy Run Heartbeat Checkpoint Slice

- Added `checkpointTicket` to the legacy run-ticket registry so issued authored-report tickets can be refreshed before expiry with a new server-owned `sequence`, replacement `sequenceWindow`, refreshed `expiresAt` and `heartbeatAt`.
- Added `agent_world.run_heartbeat` and HTTP `POST /api/runs/heartbeat` for long legacy authored runs/offline handoffs. Both require the original `runTicket`, `explorerId` and `agentId`, preserve the legacy `channelClass: "external_agent_hosted"` and `deliveryTrust: "untrusted_client"` labels, and make older sequence values fail with `ticket_sequence_mismatch`.
- JSONL hydration now treats persisted `ticket_heartbeat` records as the latest ticket state, so restarted runtimes keep the refreshed sequence window instead of accepting the original start-run sequence.
- The graph app API client now exposes `heartbeatRun`, and the packaged Skill/protocol reference documents the legacy start -> optional heartbeat -> submit flow plus the HTTP compatibility route.

Verification:

- `node --test tools/agent-server/test/tickets.test.ts --test-name-pattern "checkpointTicket refreshes issued tickets"`: failed first because the registry did not expose `checkpointTicket`; passed after adding heartbeat sequence-window refresh.
- `node --test tools/agent-server/test/mcp.test.ts --test-name-pattern "MCP run heartbeat refreshes legacy ticket sequence and expiry"`: failed first with `unknown_tool:agent_world.run_heartbeat`; target test passed after MCP tool registration and runtime wiring. The filtered MCP file still has the known pending stdio tail and was interrupted after the target passed; the full suite below covers the same path.
- `node --test tools/agent-server/test/server.test.ts --test-name-pattern "HTTP run heartbeat refreshes and persists legacy ticket sequence"`: failed first with 404 for `/api/runs/heartbeat`, then passed after adding the HTTP route, persistence and hydration support.
- `node --test tools/agent-server/test/legacyTrustDocs.test.ts --test-name-pattern "legacy authored-report docs declare channel and delivery trust labels"`: failed first because packaged docs did not mention `agent_world.run_heartbeat`; passed after SKILL/protocol updates.
- `node --test tools/agent-server/test/packageArchive.test.ts --test-name-pattern "Obsidian Epoch package includes host install docs and smoke playbooks"`: failed first because archived package docs lacked heartbeat guidance; passed after package docs updates.
- `npm run typecheck`: passed; no JS/MJS/CJS/JSX source, no explicit production `any`, web typecheck and agent-server typecheck all passed.
- `npm run agent:test`: passed 429/429.
- `npm run agent:ui-test`: passed 137/137.
- `npm run batch:test`: passed 11/11.
- `npm run build`: passed and exported `00_总览/黑曜纪元3D世界地图.html`.
- `git diff --check`: passed.
- Direct trailing-whitespace scan over touched files: no output.

Remaining risk:

- This closes the explicit heartbeat / sequence checkpoint requirement for the legacy authored-report loop. Remaining trusted-information-transfer work is now back to auditing any still-unsigned non-turn response surface that should expose an auditable server response envelope, plus broader future action-budget refresh semantics if the legacy authored-report loop grows beyond a single replacement sequence window.

## 2026-07-04 Legacy Run Submission Quota Slice

- Added a legacy authored-report submission quota to `createAgentWorldRuntime` so `agent_world.submit_battle_report` / `/api/runs/submit` cannot bypass the spec's run-submission quota requirement by minting many fresh legacy tickets.
- The quota is per explorer/agent bucket, has a wide default window for local play, and can be configured with `legacyRunSubmissionQuota` in tests or deployments. Idempotent replay of an already submitted ticket is not treated as a new issued-ticket submission.
- HTTP maps `legacy_run_submission_rate_limited` to 429 and records the rejected command through the existing HTTP rejection-audit path; MCP clients receive the same explicit error code.
- Packaged Skill/protocol guidance now tells installed hosts to wait for the quota window rather than minting new legacy tickets after `legacy_run_submission_rate_limited`.

Verification:

- `node --test tools/agent-server/test/mcp.test.ts --test-name-pattern "MCP submit rate-limits legacy authored reports per explorer"`: failed first because a second legacy submission in the same quota window was accepted; target test passed after adding the runtime quota. The filtered MCP file still has the known pending stdio tail and was interrupted after the target passed; the full suite below covers the same path.
- `node --test tools/agent-server/test/server.test.ts --test-name-pattern "HTTP legacy run submissions return 429 after explorer quota"`: failed first because the second `/api/runs/submit` returned 200; passed after adding quota enforcement and 429 mapping.
- `node --test tools/agent-server/test/packageArchive.test.ts --test-name-pattern "Obsidian Epoch package includes host install docs and smoke playbooks"`: failed first because packaged docs did not mention `legacy_run_submission_rate_limited`; passed after SKILL/protocol updates.
- `npm run typecheck`: passed; no JS/MJS/CJS/JSX source, no explicit production `any`, web typecheck and agent-server typecheck all passed.
- `npm run agent:test`: passed 431/431.
- `npm run agent:ui-test`: passed 137/137.
- `npm run batch:test`: passed 11/11.
- `npm run build`: passed and exported `00_总览/黑曜纪元3D世界地图.html`.

Remaining risk:

- This closes the explicit run-submission quota gap for the legacy authored-report loop. Remaining rate-limit tuning can stay operational/configuration work: the default quota is intentionally broad, while production can tighten `legacyRunSubmissionQuota` without changing protocol behavior.

## 2026-07-04 Legacy Run Ticket Region And Budget Slice

- Legacy authored-report tickets now carry the bound `regionId` and risk-derived `actionBudget` alongside `runTicket`, risk, expiry, sequence and trust labels.
- Existing hydrated tickets that predate these fields normalize to `legacy_region_unspecified` and a default budget for their risk tier, preserving restart compatibility.
- `agent_world.start_run` accepts an optional `regionId`; when a region is bound, `agent_world.submit_battle_report` rejects reports for a different region with `ticket_region_mismatch`.
- Legacy submit now rejects authored reports whose event log exceeds the issued action budget with `ticket_action_budget_exceeded`, and rejects too many high-risk events with `ticket_risk_budget_exceeded`.
- HTTP maps the new ticket constraint errors to client errors, and packaged Skill/protocol docs now describe the region/action-budget fields and failure modes.

Verification:

- `node --test tools/agent-server/test/tickets.test.ts --test-name-pattern "createTicket issues a server-owned run ticket"`: failed first because tickets lacked `regionId` and `actionBudget`; passed after adding the fields and normalized fallback.
- `node --test tools/agent-server/test/mcp.test.ts --test-name-pattern "MCP submit enforces legacy run ticket region and action budget"`: failed first because `agent_world.start_run` did not return the bound region/budget; target test passed after start-run wiring and submit constraint checks. The filtered MCP file still has the known pending stdio tail and was interrupted after the target passed; the full suite below covers the same path.
- `node --test tools/agent-server/test/packageArchive.test.ts --test-name-pattern "Obsidian Epoch package includes host install docs and smoke playbooks"`: passed after package docs described region/action-budget binding and errors.
- `npm run typecheck`: passed; no JS/MJS/CJS/JSX source, no explicit production `any`, web typecheck and agent-server typecheck all passed.
- `npm run agent:test`: first full post-slice run hit a transient `json_rpc_timeout:initialize` in the packaged MCP proxy smoke test; the focused smoke test passed on rerun, and the next full `agent:test` passed 432/432.
- `npm run agent:ui-test`: passed 137/137.
- `npm run batch:test`: passed 11/11.
- `npm run build`: passed and exported `00_总览/黑曜纪元3D世界地图.html`.
- `git diff --check`: passed.
- Direct trailing-whitespace scan over touched files: no output.

Remaining risk:

- This closes the explicit legacy ticket region/action-budget binding gap. The legacy authored-report loop still uses coarse risk-derived budgets; deeper per-region item/cooldown validation remains a future compatibility-layer hardening task, while canonical play should continue to prefer `obsidian_epoch.turn_card` and `obsidian_epoch.resolve_turn`.

## 2026-07-04 Legacy Context Version Binding Slice

- Closed spec 7.5(2) for the legacy authored-report loop: newly issued run tickets now bind the server `contextVersion` that a submitted battle report must reference.
- Historical hydrated tickets without this field normalize to `legacy_context_unspecified`, preserving old JSONL compatibility while enforcing the binding for newly issued tickets.
- `agent_world.start_run` / `/api/runs/start` now return the bound `contextVersion`; `agent_world.submit_battle_report` / `/api/runs/submit` accepts it either inside `run.contextVersion` or as a top-level compatibility field, then persists the normalized run payload.
- Missing context references fail with `ticket_context_version_required`; mismatched references fail with `ticket_context_version_mismatch`; both map to HTTP 400 and do not admit legacy archive runs or canonical claims.
- Packaged Skill/protocol docs now tell installed hosts to echo the ticket context version alongside the latest sequence and bound region/budget.

Verification:

- `node --test tools/agent-server/test/tickets.test.ts --test-name-pattern "context version|createTicket issues"`: failed first because tickets lacked `contextVersion` and missing context was accepted; passed after adding ticket context binding and validation.
- `node --test tools/agent-server/test/mcp.test.ts --test-name-pattern "MCP submit requires the legacy context version|MCP tools run the world loop"`: failed first because `start_run` did not return `contextVersion`; target tests passed after runtime wiring. The filtered MCP file still has the known pending stdio tail and was interrupted after target assertions passed; the full suite below covers the same path.
- `node --test tools/agent-server/test/server.test.ts --test-name-pattern "HTTP submit requires the run-ticket context version"`: failed first because `/api/runs/start` did not return `contextVersion`; passed after HTTP/runtime wiring and 400 error mapping.
- `node --test tools/agent-server/test/legacyTrustDocs.test.ts --test-name-pattern "legacy authored-report docs declare"`: failed first because package docs omitted context binding guidance; passed after SKILL/protocol updates.
- `node --test tools/agent-server/test/packageArchive.test.ts --test-name-pattern "Obsidian Epoch package includes host install docs and smoke playbooks"`: failed first because the packaged archive omitted context binding guidance and errors; passed after package docs updates.
- `npm run typecheck`: passed; no JS/MJS/CJS/JSX source, no explicit production `any`, web typecheck and agent-server typecheck all passed.
- `npm run agent:test`: passed 435/435.
- `npm run agent:ui-test`: passed 137/137.
- `npm run batch:test`: passed 11/11.
- `npm run build`: passed and exported `00_总览/黑曜纪元3D世界地图.html`.
- `git diff --check`: passed.
- Direct trailing-whitespace scan over touched files: no output.

Remaining risk:

- This closes the explicit submitted-report context-version reference requirement for the legacy authored-report loop. The context package is still a versioned public contract rather than a cryptographic per-ticket signed envelope; if future compatibility work requires full signed context envelopes, it should layer that proof onto the same ticket-bound `contextVersion` field instead of accepting client-declared context.

## 2026-07-04 Legacy High-Risk Confirmation Slice

- Closed another 7.5 invariant-validation gap for the legacy authored-report loop: high-risk submitted events now require explicit confirmation evidence before adjudication.
- `agent_world.submit_battle_report` / `/api/runs/submit` rejects any `risk: "high"` event unless it carries `authorized: true`, `userConfirmed: true` or a non-empty `userConfirmationId`.
- The new failure code is `ticket_high_risk_confirmation_required`; HTTP maps it to 400 and the rejection happens before legacy archive runs, lore claims or public-world summaries are admitted.
- Packaged Skill/protocol docs now describe the high-risk confirmation requirement alongside context, sequence, region and action-budget constraints.

Verification:

- `node --test tools/agent-server/test/mcp.test.ts --test-name-pattern "MCP submit rejects unconfirmed legacy high-risk events"`: failed first because the unconfirmed high-risk report was accepted; target test passed after adding confirmation validation. The filtered MCP file still has the known pending stdio tail and was interrupted after target assertions passed; the full suite below covers the same path.
- `node --test tools/agent-server/test/server.test.ts --test-name-pattern "HTTP submit rejects unconfirmed legacy high-risk events"`: failed first because `/api/runs/submit` returned 200; passed after runtime validation and HTTP 400 mapping.
- `node --test tools/agent-server/test/legacyTrustDocs.test.ts --test-name-pattern "legacy authored-report docs declare"`: failed first because package docs omitted the new high-risk error; passed after SKILL/protocol updates.
- `node --test tools/agent-server/test/packageArchive.test.ts --test-name-pattern "Obsidian Epoch package includes host install docs and smoke playbooks"`: failed first because packaged docs omitted the new high-risk error; passed after package docs updates.
- `npm run typecheck`: passed; no JS/MJS/CJS/JSX source, no explicit production `any`, web typecheck and agent-server typecheck all passed.
- `npm run agent:test`: passed 437/437.
- `npm run agent:ui-test`: passed 137/137.
- `npm run batch:test`: passed 11/11.
- `npm run build`: passed and exported `00_总览/黑曜纪元3D世界地图.html`.
- `git diff --check`: passed.
- Direct trailing-whitespace scan over touched files: no output.

Remaining risk:

- This closes explicit high-risk confirmation enforcement for the legacy authored-report compatibility lane. Remaining invariant-validation hardening in that lane is still item-use, cooldown and richer event-schema validation; canonical gameplay should continue to prefer server-issued turn cards where high-risk choices are resolved by server options.

## 2026-07-04 Legacy Structured Event Log Schema Slice

- Closed spec 7.5(4) for the legacy authored-report loop: submitted events now need a structured event log before settlement.
- Each legacy event must carry a positive `sequence`, non-empty `actionType`, `risk` in `low`/`medium`/`high`, non-empty `regionId`, object `inputs`, non-empty `claimedOutcome` and non-empty `evidenceText`.
- When a run ticket binds a region, each submitted event must use that same region before any archive run or lore claim can be admitted.
- Malformed event logs fail with `ticket_event_schema_invalid`; HTTP maps the code to 400, matching the existing legacy ticket invariant failures.
- Packaged Skill/protocol docs now describe the structured event fields and the new error alongside context, sequence, region, budget and high-risk confirmation constraints.

Verification:

- `node --test tools/agent-server/test/mcp.test.ts --test-name-pattern "MCP submit rejects malformed legacy event logs|MCP submit rejects unconfirmed legacy high-risk events|MCP tools run the world loop"`: failed first because a malformed legacy event missing `actionType` was accepted; target assertions passed after schema validation. The filtered MCP file still has the known pending stdio tail and was interrupted after target assertions passed; the full suite below covers the same path.
- `node --test tools/agent-server/test/server.test.ts --test-name-pattern "HTTP submit rejects malformed legacy event logs|HTTP submit rejects unconfirmed legacy high-risk events|HTTP submit requires the run-ticket context version|HTTP run settlement persists legacy trust labels"`: failed first because `/api/runs/submit` returned 200 for the malformed event log; passed after runtime validation and HTTP 400 mapping.
- `node --test tools/agent-server/test/legacyTrustDocs.test.ts --test-name-pattern "legacy authored-report docs declare"`: passed after SKILL/protocol docs declared `ticket_event_schema_invalid`.
- `node --test tools/agent-server/test/packageArchive.test.ts --test-name-pattern "Obsidian Epoch package includes host install docs and smoke playbooks"`: passed after packaged docs declared the structured-event requirement and error.
- `npm run typecheck`: passed; no JS/MJS/CJS/JSX source, no explicit production `any`, web typecheck and agent-server typecheck all passed.
- `npm run agent:test`: passed 439/439.
- `npm run agent:ui-test`: passed 137/137.
- `npm run batch:test`: passed 11/11.
- `npm run build`: passed and exported `00_总览/黑曜纪元3D世界地图.html`.
- `git diff --check`: passed.
- Direct trailing-whitespace scan over touched files: no output.

Remaining risk:

- This closes the explicit structured event-log requirement for the legacy authored-report compatibility lane. Remaining invariant-validation hardening is still item-use, cooldown/rules and deeper domain-specific event semantics; canonical gameplay should continue to prefer `obsidian_epoch.turn_card` and `obsidian_epoch.resolve_turn`.

## 2026-07-04 Legacy Item-Use Invariant Slice

- Closed the explicit item-use part of spec 7.5(5) for the legacy authored-report compatibility lane.
- Legacy `agent_world.submit_battle_report` now rejects event `inputs` that claim canonical item or equipment use through fields such as `itemId`, `itemKey`, `itemIds`, `itemKeys`, `usedItemIds`, `usedItems` or `equipmentEffects`.
- The new failure code is `ticket_item_use_unverified`; HTTP maps it to 400 and the rejection happens before archive runs, lore claims or public summaries are admitted.
- Plain authored-report inputs such as `tool`, `sample`, `anchorId` and `evidence` remain allowed as narrative/evidence fields, but they cannot assert canonical inventory ownership or equipment effects.
- Packaged Skill/protocol docs now point installed hosts back to canonical inventory/shop/bind tools and server-issued turn resolution for real item-backed settlement.

Verification:

- `node --test tools/agent-server/test/mcp.test.ts --test-name-pattern "MCP submit rejects unverified legacy item-use claims"`: failed first because a structured report with forged `itemId`/`itemKey` inputs was accepted; target assertion passed after item-use validation. The filtered MCP file still has the known pending stdio tail and was interrupted after target assertions passed; the full suite below covers the same path.
- `node --test tools/agent-server/test/server.test.ts --test-name-pattern "HTTP submit rejects unverified legacy item-use claims"`: failed first because `/api/runs/submit` returned 200 for the forged item-use report; passed after runtime validation and HTTP 400 mapping.
- `node --test tools/agent-server/test/mcp.test.ts --test-name-pattern "MCP submit rejects unverified legacy item-use claims|MCP submit rejects malformed legacy event logs"`: target assertions passed after the implementation, with the known filtered MCP stdio tail interrupted after success.
- `node --test tools/agent-server/test/server.test.ts --test-name-pattern "HTTP submit rejects unverified legacy item-use claims|HTTP submit rejects malformed legacy event logs"`: passed 95/95.
- `node --test tools/agent-server/test/legacyTrustDocs.test.ts --test-name-pattern "legacy authored-report docs declare"`: passed 3/3.
- `node --test tools/agent-server/test/packageArchive.test.ts --test-name-pattern "Obsidian Epoch package includes host install docs and smoke playbooks"`: passed 7/7.
- `npm run typecheck`: passed; no JS/MJS/CJS/JSX source, no explicit production `any`, web typecheck and agent-server typecheck all passed.
- `npm run agent:test`: passed 441/441.
- `npm run agent:ui-test`: passed 137/137.
- `npm run batch:test`: passed 11/11.
- `npm run build`: passed and exported `00_总览/黑曜纪元3D世界地图.html`.
- `git diff --check`: passed.
- Direct trailing-whitespace scan over touched files: no output.

Remaining risk:

- This closes legacy compatibility reports that try to use canonical inventory by prompt text. Remaining invariant-validation hardening is cooldown/known-rule enforcement and richer domain-specific event semantics; canonical gameplay should continue to prefer `obsidian_epoch.turn_card`, `obsidian_epoch.resolve_turn` and the inventory/shop/bind tools for item-backed effects.

## 2026-07-04 Legacy Event Sequence Rule Slice

- Closed another known-rule part of spec 7.5 for the legacy authored-report compatibility lane: event logs must now be replayable in strictly increasing sequence order.
- Legacy `agent_world.submit_battle_report` already required each event to carry a positive `sequence`; it now also rejects duplicate or non-increasing event sequences before settlement.
- The new failure code is `ticket_event_sequence_invalid`; HTTP maps it to 400 and the rejection happens before archive runs, lore claims or public summaries are admitted.
- Packaged Skill/protocol docs now distinguish malformed/missing event sequence fields (`ticket_event_schema_invalid`) from duplicate/out-of-order sequences (`ticket_event_sequence_invalid`).

Verification:

- `node --test tools/agent-server/test/mcp.test.ts --test-name-pattern "MCP submit rejects non-increasing legacy event sequences"`: failed first because a duplicate event sequence was accepted; target assertion passed after strict sequence validation. The filtered MCP file still has the known pending stdio tail and was interrupted after target assertions passed; the full suite below covers the same path.
- `node --test tools/agent-server/test/server.test.ts --test-name-pattern "HTTP submit rejects non-increasing legacy event sequences"`: failed first because `/api/runs/submit` returned 200 for a duplicate event sequence; passed after runtime validation and HTTP 400 mapping.
- `node --test tools/agent-server/test/mcp.test.ts --test-name-pattern "MCP submit rejects non-increasing legacy event sequences|MCP submit rejects unverified legacy item-use claims"`: target assertions passed after the implementation, with the known filtered MCP stdio tail interrupted after success.
- `node --test tools/agent-server/test/server.test.ts --test-name-pattern "HTTP submit rejects non-increasing legacy event sequences|HTTP submit rejects unverified legacy item-use claims"`: passed 96/96.
- `node --test tools/agent-server/test/legacyTrustDocs.test.ts --test-name-pattern "legacy authored-report docs declare"`: passed 3/3.
- `node --test tools/agent-server/test/packageArchive.test.ts --test-name-pattern "Obsidian Epoch package includes host install docs and smoke playbooks"`: passed 7/7.
- `npm run typecheck`: passed; no JS/MJS/CJS/JSX source, no explicit production `any`, web typecheck and agent-server typecheck all passed.
- `npm run agent:test`: passed 443/443.
- `npm run agent:ui-test`: passed 137/137.
- `npm run batch:test`: passed 11/11.
- `npm run build`: passed and exported `00_总览/黑曜纪元3D世界地图.html`.
- `git diff --check`: passed.
- Direct trailing-whitespace scan over touched files: no output.

Remaining risk:

- This closes basic replay-order integrity for legacy authored reports. Remaining invariant-validation hardening is cooldown/known cooldown rules and deeper domain-specific event semantics; canonical gameplay should continue to prefer server-issued turn cards and server-owned settlement tools.

## 2026-07-04 Legacy Cooldown-Governed Action Rule Slice

- Closed the explicit cooldown/known-rule bypass gap for the legacy authored-report compatibility lane.
- Legacy `agent_world.submit_battle_report` now rejects event action types that correspond to cooldown-governed canonical actions, currently `resolve_raid` and `spawn_resource_node`, including `obsidian_epoch.*` spelling variants.
- The new failure code is `ticket_cooldown_rule_unverified`; HTTP maps it to 400 and the rejection happens before archive runs, lore claims or public summaries are admitted.
- Packaged Skill/protocol docs now direct installed hosts to use `obsidian_epoch.resolve_raid`, `obsidian_epoch.spawn_resource_node` or the matching canonical flow when cooldowns/known rules matter.

Verification:

- `node --test tools/agent-server/test/mcp.test.ts --test-name-pattern "MCP submit rejects cooldown-governed legacy action types"`: failed first because a structured legacy event with `actionType: "resolve_raid"` was accepted; target assertion passed after reserved action-type validation. The filtered MCP file still has the known pending stdio tail and was interrupted after target assertions passed; the full suite below covers the same path.
- `node --test tools/agent-server/test/server.test.ts --test-name-pattern "HTTP submit rejects cooldown-governed legacy action types"`: failed first because `/api/runs/submit` returned 200 for the forged cooldown-governed action; passed after runtime validation and HTTP 400 mapping.
- `node --test tools/agent-server/test/mcp.test.ts --test-name-pattern "MCP submit rejects cooldown-governed legacy action types|MCP submit rejects non-increasing legacy event sequences"`: target assertions passed after the implementation, with the known filtered MCP stdio tail interrupted after success.
- `node --test tools/agent-server/test/server.test.ts --test-name-pattern "HTTP submit rejects cooldown-governed legacy action types|HTTP submit rejects non-increasing legacy event sequences"`: passed 97/97.
- `node --test tools/agent-server/test/legacyTrustDocs.test.ts --test-name-pattern "legacy authored-report docs declare"`: passed 3/3.
- `node --test tools/agent-server/test/packageArchive.test.ts --test-name-pattern "Obsidian Epoch package includes host install docs and smoke playbooks"`: passed 7/7.
- `npm run typecheck`: passed; no JS/MJS/CJS/JSX source, no explicit production `any`, web typecheck and agent-server typecheck all passed.
- `npm run agent:test`: passed 445/445.
- `npm run agent:ui-test`: passed 137/137.
- `npm run batch:test`: passed 11/11.
- `npm run build`: passed and exported `00_总览/黑曜纪元3D世界地图.html`.
- `git diff --check`: passed.
- Direct trailing-whitespace scan over touched files: no output.

Remaining risk:

- This closes explicit legacy attempts to impersonate existing cooldown-governed canonical actions. Remaining legacy hardening is identity-lifetime binding and deeper domain-specific event semantics; canonical gameplay should continue to use server-owned tools for any action with rewards, cooldowns, costs or hidden rules.

## 2026-07-04 Legacy Identity Lifetime Slice

- Closed the identity-lifetime part of spec 7.5(5) for the legacy authored-report compatibility lane.
- Legacy `agent_world.submit_battle_report` now checks the ticket-bound `agentId` against the server public progress view before settlement. Known archived Epoch identities fail with `ticket_identity_archived`.
- Historical or unknown legacy `agentId` strings remain compatible; only server-known archived identities are rejected.
- HTTP maps `ticket_identity_archived` to 400 and the rejection happens before archive runs, lore claims or public summaries are admitted.
- Packaged Skill/protocol docs now direct installed hosts to use `identity_archive`, `result_page` or `reincarnate` for archived identities instead of submitting new active-play reports.

Verification:

- `node --test tools/agent-server/test/mcp.test.ts --test-name-pattern "MCP submit rejects archived legacy identities"`: failed first because an archived identity report was accepted; target assertion passed after the lifetime guard. The filtered MCP file still has the known pending stdio tail and was interrupted after target assertions passed; the full suite below covers the same path.
- `node --test tools/agent-server/test/server.test.ts --test-name-pattern "HTTP submit rejects archived legacy identities"`: failed first because `/api/runs/submit` returned 200 for an archived identity; passed after runtime validation and HTTP 400 mapping.
- `node --test tools/agent-server/test/mcp.test.ts --test-name-pattern "MCP submit rejects archived legacy identities|MCP submit rejects cooldown-governed legacy action types"`: target assertions passed after the implementation, with the known filtered MCP stdio tail interrupted after success.
- `node --test tools/agent-server/test/server.test.ts --test-name-pattern "HTTP submit rejects archived legacy identities|HTTP submit rejects cooldown-governed legacy action types"`: passed 98/98.
- `node --test tools/agent-server/test/legacyTrustDocs.test.ts --test-name-pattern "legacy authored-report docs declare"`: passed 3/3.
- `node --test tools/agent-server/test/packageArchive.test.ts --test-name-pattern "Obsidian Epoch package includes host install docs and smoke playbooks"`: passed 7/7.
- `npm run typecheck`: passed; no JS/MJS/CJS/JSX source, no explicit production `any`, web typecheck and agent-server typecheck all passed.
- `npm run agent:test`: passed 447/447.
- `npm run agent:ui-test`: passed 137/137.
- `npm run batch:test`: passed 11/11.
- `npm run build`: passed and exported `00_总览/黑曜纪元3D世界地图.html`.
- `git diff --check`: passed.
- Direct trailing-whitespace scan over touched files: no output.

Remaining risk:

- This closes active/archived identity lifetime for server-known identities in legacy reports. Remaining hardening is deeper domain-specific event semantics and any future signed per-ticket context envelope/nonce hardening; canonical gameplay should continue to use server-owned turn cards and active-only tools.

## 2026-07-04 Legacy Outcome State Claim Slice

- Closed another command/result separation and outcome-normalization gap in spec 7.5(3), 7.5(8) and 7.5(11) for the legacy authored-report compatibility lane.
- Legacy `agent_world.submit_battle_report` now rejects explicit official outcome-state claims in event results before settlement. Text or structured fields that claim server-granted rewards, legend, lifetime deltas, score/world impact or news publication fail with `ticket_outcome_state_unverified`.
- Plain authored-report outcomes such as `echo logged`, `delay compared` or evidence notes remain valid; only claims that try to turn client-authored prose into official server state are blocked.
- HTTP maps `ticket_outcome_state_unverified` to 400 and the rejection happens before archive runs, lore claims or public summaries are admitted.
- Packaged Skill/protocol docs now tell installed hosts to use canonical settlement tools and result pages for official outcomes instead of declaring them in `claimedOutcome`.

Verification:

- `node --test tools/agent-server/test/mcp.test.ts --test-name-pattern "MCP submit rejects unverified legacy outcome state claims"`: failed first because a forged `claimedOutcome` declaring `coin+999`, `legend+5`, `lifetimeDelta -10` and news publication was accepted; target assertion passed after adding the outcome-state guard. The filtered MCP file still has the known pending stdio tail and was interrupted after target assertions passed; the full suite below covers the same path.
- `node --test tools/agent-server/test/server.test.ts --test-name-pattern "HTTP submit rejects unverified legacy outcome state claims"`: failed first because `/api/runs/submit` returned 200; passed after runtime validation and HTTP 400 mapping.
- `node --test tools/agent-server/test/mcp.test.ts --test-name-pattern "MCP submit rejects unverified legacy outcome state claims|MCP submit rejects archived legacy identities"`: target assertions passed after the implementation, with the known filtered MCP stdio tail interrupted after success.
- `node --test tools/agent-server/test/server.test.ts --test-name-pattern "HTTP submit rejects unverified legacy outcome state claims|HTTP submit rejects archived legacy identities"`: passed 99/99.
- `node --test tools/agent-server/test/legacyTrustDocs.test.ts --test-name-pattern "legacy authored-report docs declare"`: failed first because package docs omitted `ticket_outcome_state_unverified`; passed after SKILL/protocol updates.
- `node --test tools/agent-server/test/packageArchive.test.ts --test-name-pattern "Obsidian Epoch package includes host install docs and smoke playbooks"`: failed first because packaged docs omitted the new outcome-state error; passed after package docs updates.
- `npm run typecheck`: passed; no JS/MJS/CJS/JSX source, no explicit production `any`, web typecheck and agent-server typecheck all passed.
- `npm run agent:test`: passed 449/449.
- `npm run agent:ui-test`: passed 137/137.
- `npm run batch:test`: passed 11/11.
- `npm run build`: passed and exported `00_总览/黑曜纪元3D世界地图.html`.

Remaining risk:

- This closes explicit legacy attempts to declare official server state inside `claimedOutcome`, event `outcome` or state-shaped event fields. Remaining trusted-information-transfer hardening is future signed per-ticket context/capability envelopes and any deeper domain-specific semantic checks that require canonical server tools rather than legacy authored reports.

## 2026-07-04 Legacy Signed Context Envelope Slice

- Closed the exposure side of the signed-context requirement in spec 7.5(2) and the capability-envelope shape in spec 7.7 for the legacy authored-report compatibility lane.
- `agent_world.context_package` now returns a server-signed context envelope with protocol version, envelope id, Ed25519 signature algorithm, server public key, `contentHash`, signature, channel class and delivery trust.
- `agent_world.start_run`, `/api/runs/start`, `agent_world.run_heartbeat` and `/api/runs/heartbeat` now return a signed run-capability envelope bound to the ticket id, explorer, agent, context version, region, risk, action budget, sequence window and expiry.
- The legacy submit path still enforces the server `contextVersion`, sequence window, expiry and one-time settlement semantics; this slice intentionally keeps envelope echo/verification as the next enforcement step to avoid breaking older compatibility clients in the same change.
- Packaged Skill/protocol docs now tell installed hosts to inspect the legacy signed envelopes just like turn-card and hosted-action envelopes.

Verification:

- `node --test tools/agent-server/test/mcp.test.ts --test-name-pattern "MCP tools run the world loop for an external agent"`: failed first because the legacy context package lacked `signedEnvelope`; target assertion passed after adding context and run-capability envelopes. The filtered MCP file still has the known pending stdio tail and was interrupted after target assertions passed; the full suite below covers the same path.
- `node --test tools/agent-server/test/server.test.ts --test-name-pattern "HTTP context package and legacy run ticket expose signed envelopes"`: failed first because `/api/context/package` returned no signed envelope; passed after the HTTP path inherited the runtime envelopes.
- `node --test tools/agent-server/test/legacyTrustDocs.test.ts --test-name-pattern "legacy authored-report docs declare"`: failed first because package docs did not describe legacy `signedEnvelope`, `contentHash` or `signature`; passed after SKILL/protocol updates.
- `node --test tools/agent-server/test/packageArchive.test.ts --test-name-pattern "Obsidian Epoch package includes host install docs and smoke playbooks"`: failed first because the packaged docs omitted the legacy signed-envelope fields; passed after package docs updates.
- `npm run typecheck`: passed; no JS/MJS/CJS/JSX source, no explicit production `any`, web typecheck and agent-server typecheck all passed.
- `npm run agent:test`: passed 450/450.
- `npm run agent:ui-test`: passed 137/137.
- `npm run batch:test`: passed 11/11.
- `npm run build`: passed and exported `00_总览/黑曜纪元3D世界地图.html`.

Remaining risk:

- This makes legacy context and run-capability envelopes auditable, but submit still enforces the older compatibility contract by `contextVersion` rather than requiring clients to echo envelope id/hash. The next hardening slice should add explicit submit echo validation with a compatibility transition or targeted test migration.

## 2026-07-04 Legacy Signed Envelope Echo Enforcement Slice

- Closed the enforcement side of the signed context/capability envelope work for spec 7.5(2), 7.5(7) and 7.7 in the legacy authored-report compatibility lane.
- Legacy `agent_world.submit_battle_report` and `/api/runs/submit` now require the latest run `signedEnvelope` reference with matching `envelopeId` and `contentHash` before a still-issued ticket can settle.
- The new failure codes are `ticket_context_envelope_required` and `ticket_context_envelope_mismatch`; HTTP maps both to 400.
- Sequence and context-version checks still run before envelope validation, so older `ticket_sequence_*` and `ticket_context_version_*` error semantics remain stable. Expired tickets still fail as `ticket_expired`.
- Heartbeat-refresh tickets must use the refreshed signed run-capability envelope, preserving the existing stale-sequence behavior while binding the latest capability proof.
- Packaged Skill/protocol docs now tell installed hosts to echo the signed envelope id/hash instead of submitting a report with only a context version.

Verification:

- `node --test --test-name-pattern "MCP submit requires the signed legacy run envelope" tools/agent-server/test/mcp.test.ts`: failed first because missing envelope was accepted; passed after adding envelope validation.
- `node --test --test-name-pattern "HTTP submit requires the signed legacy run envelope" tools/agent-server/test/server.test.ts`: failed first because `/api/runs/submit` returned 200; passed after runtime validation and HTTP 400 mapping.
- `node --test --test-name-pattern "MCP tools run the world loop|MCP submit requires the legacy context version|MCP submit requires the signed legacy run envelope|MCP submit requires the run-ticket sequence window|MCP run heartbeat refreshes legacy ticket sequence and expiry|MCP submit rate-limits legacy authored reports" tools/agent-server/test/mcp.test.ts`: passed 6/6.
- `node --test --test-name-pattern "HTTP submit requires the run-ticket sequence window|HTTP submit requires the run-ticket context version|HTTP submit requires the signed legacy run envelope|HTTP run settlement persists legacy trust labels|HTTP run heartbeat refreshes and persists legacy ticket sequence|HTTP legacy run submissions return 429|JSONL records hydrate issued tickets and public submitted runs" tools/agent-server/test/server.test.ts`: passed 7/7.
- `node --test --test-name-pattern "legacy authored-report docs declare" tools/agent-server/test/legacyTrustDocs.test.ts`: passed after package docs declared the signed-envelope echo requirement and errors.
- `node --test --test-name-pattern "Obsidian Epoch package includes host install docs and smoke playbooks" tools/agent-server/test/packageArchive.test.ts`: passed after packaged docs carried the new requirement.
- `npm run typecheck`: passed from `tools/graph-react-app`, including no JS/MJS/CJS/JSX source, no explicit production `any`, web typecheck and agent-server typecheck.
- `npm run agent:test`: passed 452/452 from `tools/graph-react-app`.
- `npm run agent:ui-test`: passed 137/137 from `tools/graph-react-app`.
- `npm run batch:test`: passed 11/11 from `tools/graph-react-app`.
- `npm run build`: passed from `tools/graph-react-app` and exported `00_总览/黑曜纪元3D世界地图.html`.
- `git diff --check`: passed.
- Direct trailing-whitespace scan over touched files: no output.

Remaining risk:

- This binds legacy reports to the latest signed run-capability envelope by id/hash. It still does not require clients to verify the Ed25519 signature locally before submission; honest clients can verify, while server enforcement verifies the reference against server-recomputed envelope content. Deeper domain-specific semantics should continue moving to canonical server tools instead of legacy authored reports.

## 2026-07-04 Legacy Canonical Action Guard Slice

- Closed one concrete domain-specific semantics gap in the legacy authored-report compatibility lane: a legacy event can no longer declare an active-only canonical `obsidian_epoch.*` write tool as its `actionType`.
- `agent_world.submit_battle_report` and `/api/runs/submit` now reject normalized active-only canonical action names such as `obsidian_epoch.create_market_order` / `create_market_order` with `ticket_canonical_action_unverified`.
- The older cooldown-specific error remains stable: `resolve_raid` and `spawn_resource_node` still fail with `ticket_cooldown_rule_unverified` before the broader canonical-action guard.
- The guard derives its action names from `EPOCH_ACTIVE_IDENTITY_TOOL_NAMES`, so future active-only canonical tools are covered without maintaining a second hand-written legacy denylist.
- Packaged Skill/protocol docs now instruct installed hosts to call the matching canonical tool instead of narrating canonical writes inside a legacy report.

Verification:

- `node --import tsx --test --test-name-pattern "MCP submit rejects canonical legacy action types" ../agent-server/test/mcp.test.ts`: failed first because the forged `obsidian_epoch.create_market_order` event was accepted; passed after adding the canonical-action guard.
- `node --import tsx --test --test-name-pattern "HTTP submit rejects canonical legacy action types" ../agent-server/test/server.test.ts`: failed first because `/api/runs/submit` returned 200; passed after runtime validation and HTTP 400 mapping.
- `node --import tsx --test --test-name-pattern "legacy authored-report docs declare" ../agent-server/test/legacyTrustDocs.test.ts`: passed after docs declared `ticket_canonical_action_unverified`.
- `node --import tsx --test --test-name-pattern "Obsidian Epoch package includes host install docs and smoke playbooks" ../agent-server/test/packageArchive.test.ts`: passed after packaged docs carried the new error.
- `node --import tsx --test --test-name-pattern "MCP tools run the world loop|MCP submit rejects canonical legacy action types|MCP submit rejects cooldown-governed legacy action types|MCP submit rejects unverified legacy item-use claims" ../agent-server/test/mcp.test.ts`: passed 4/4.
- `node --import tsx --test --test-name-pattern "HTTP run settlement persists legacy trust labels|HTTP submit rejects canonical legacy action types|HTTP submit rejects cooldown-governed legacy action types|HTTP submit rejects unverified legacy item-use claims" ../agent-server/test/server.test.ts`: passed 4/4.
- `npm run typecheck`: passed from `tools/graph-react-app`, including no JS/MJS/CJS/JSX source, no explicit production `any`, web typecheck and agent-server typecheck.
- `npm run agent:test`: passed 454/454 from `tools/graph-react-app`.
- `npm run agent:ui-test`: passed 137/137 from `tools/graph-react-app`.
- `npm run batch:test`: passed 11/11 from `tools/graph-react-app`.
- `npm run build`: passed from `tools/graph-react-app` and exported `00_总览/黑曜纪元3D世界地图.html`.
- `git diff --check`: passed.
- Direct trailing-whitespace scan over touched files: no output.

Remaining risk:

- This closes direct impersonation of active-only canonical write tools in legacy event logs. Legacy reports can still use arbitrary narrative action names, so any effect with costs, ownership, cooldowns, rewards, hidden rules, or canonical state changes should continue moving to server-owned tools rather than the compatibility report lane.

## 2026-07-04 NonEvidence Starter Evidence Isolation Slice

- Closed S054 for the first-run protected canonical action lane: starter protected turn and hosted action settlements now carry `nonEvidence: true`.
- `nonEvidence` is included in the signed turn-resolution and hosted-action envelope content hash, so audit receipts cover the evidence boundary.
- `record_lore_contribution` rejects cross-explorer attempts to reuse `nonEvidence` source events with `lore_contribution_non_evidence_source`; same-explorer private/history use remains possible.
- HTTP maps the new error to 400, and packaged Skill/protocol docs now tell installed hosts that first-run protected/demo-like events cannot be used by other explorers as lore evidence.

Verification:

- `node --import tsx --test --test-name-pattern "first high-risk turn protects the starter identity|first high-risk hosted action uses the same starter protection" ../agent-server/test/epoch-game-core.test.ts`: failed first because protected settlements had no `nonEvidence`; passed after payload/projection/policy wiring.
- `node --import tsx --test --test-name-pattern "HTTP lore contribution rejects other explorers reusing nonEvidence starter events" ../agent-server/test/server.test.ts`: passed after HTTP mapping and core guard.
- `node --import tsx --test --test-name-pattern "turn cards bind resolution to server sequence and nonce|hosted runner records attestation evidence" ../agent-server/test/epoch-game-core.test.ts`: failed after adding signed content because test mirrors omitted `nonEvidence`; passed after test mirror update.
- `node --import tsx --test --test-name-pattern "first high-risk turn protects the starter identity|first high-risk hosted action uses the same starter protection" ../agent-server/test/epoch-game-core.test.ts`: passed 2/2.
- `node --import tsx --test --test-name-pattern "HTTP risky turn exhaustion archives after starter protection|HTTP lore contribution rejects other explorers reusing nonEvidence starter events|HTTP run settlement persists legacy trust labels" ../agent-server/test/server.test.ts`: passed 3/3.
- `node --import tsx --test --test-name-pattern "Obsidian Epoch package includes host install docs and smoke playbooks" ../agent-server/test/packageArchive.test.ts`: passed after packaged docs carried the new nonEvidence boundary.
- `npm run typecheck`: passed from `tools/graph-react-app`, including no JS/MJS/CJS/JSX source, no explicit production `any`, web typecheck and agent-server typecheck.
- `npm run agent:test`: passed 455/455 from `tools/graph-react-app`.
- `npm run agent:ui-test`: passed 137/137 from `tools/graph-react-app`.
- `npm run batch:test`: passed 11/11 from `tools/graph-react-app`.
- `npm run build`: passed from `tools/graph-react-app` and exported `00_总览/黑曜纪元3D世界地图.html`.
- `git diff --check`: passed.
- Direct trailing-whitespace scan over touched files: no output.

Remaining risk:

- This covers first-run protected turn/hosted action events and cross-explorer lore contribution evidence reuse. It does not yet add a separate `nonEvidence` flag to historical legacy demo `run_submitted` archive records beyond their existing `private_demo` / no-lore/no-progression behavior.

## 2026-07-04 Server-Adjudicated Claim Quantity Slice

- Closed a focused S055 legacy compatibility gap: client-supplied `candidateClaims` quantity no longer increases authored-report settlement score.
- Legacy scoring now awards the small evidence-quality bonus from server-validated event evidence/outcome signals, not from how many claim candidates the client lists.
- Highest-tier claim admission is capped by `MAX_SERVER_CLAIM_SLOTS = 5`, so even a top score cannot turn a client-flooded candidate list into unlimited official claim slots.
- The HTTP compatibility path now proves that a low-evidence report with 50 candidate claims stays below the review threshold and creates no canonical claims.
- Packaged Skill/protocol docs now tell installed hosts that `candidateClaims` are narrative candidates only: they do not raise score and cannot bypass server-capped `claimSlots`.

Verification:

- `node --import tsx --test ../agent-server/test/adjudicator.test.ts`: failed first because `claimSlotsForScore(99, 50)` returned 50 and candidate claim quantity raised score from 52 to 61; passed after the server cap and evidence-signal scoring change.
- `node --import tsx --test --test-name-pattern "legacy authored-report docs declare" ../agent-server/test/legacyTrustDocs.test.ts`: failed first because docs omitted the `candidateClaims` scoring boundary; passed after SKILL/protocol updates.
- `node --import tsx --test --test-name-pattern "Obsidian Epoch package includes host install docs and smoke playbooks" ../agent-server/test/packageArchive.test.ts`: passed after packaged docs carried the S055 boundary text.
- `node --import tsx --test --test-name-pattern "HTTP submit does not let candidateClaims quantity raise legacy settlement score" ../agent-server/test/server.test.ts`: passed after the runtime scoring change.
- `node --import tsx --test --test-name-pattern "HTTP submit rejects unverified legacy outcome state claims|HTTP submit does not let candidateClaims quantity raise legacy settlement score|HTTP submit rejects unverified legacy item-use claims|HTTP run settlement persists legacy trust labels" ../agent-server/test/server.test.ts`: passed 4/4.
- `node --import tsx --test --test-name-pattern "MCP tools run the world loop|MCP submit rejects unverified legacy outcome state claims|MCP submit rejects unverified legacy item-use claims" ../agent-server/test/mcp.test.ts`: passed 3/3.
- `npm run typecheck`: passed from `tools/graph-react-app`, including no JS/MJS/CJS/JSX source, no explicit production `any`, web typecheck and agent-server typecheck.
- `npm run agent:test`: passed 458/458 from `tools/graph-react-app`.
- `npm run agent:ui-test`: passed 137/137 from `tools/graph-react-app`.
- `npm run batch:test`: passed 11/11 from `tools/graph-react-app`.
- `npm run build`: passed from `tools/graph-react-app` and exported `00_总览/黑曜纪元3D世界地图.html`.
- `git diff --check`: passed.
- Direct trailing-whitespace scan over touched files: no output.

Remaining risk:

- This closes client-controlled claim-count inflation in the legacy authored-report lane. S055 still has broader canonical/randomness surface area to audit over any future client-visible settlement templates; current canonical turn/hosted action lanes already hide outcomes and settle rewards/lifetime from server-side option templates.

## 2026-07-04 Local Trial Archive Degradation Slice

- Closed the first S057 compatibility slice without weakening S056: `agent_world.submit_battle_report` and `/api/runs/submit` still require a server-issued `runTicket` for settlement.
- Added `agent_world.archive_local_report` plus HTTP `POST /api/runs/archive` for local/offline authored reports that have no ticket.
- The archive path forces private/local-trial handling, returns `loopMode: "local_trial_archive"`, sets `runTicket: null`, and never writes lore admission, progression, rewards, public archive rows or public world impact.
- JSONL persistence records archive-only results as `run_archived` instead of `run_submitted`, so no-ticket archives are visibly separate from settlement submissions.
- Packaged Skill/protocol docs now explain that `archive_local_report` does not require runTicket and cannot be upgraded into settlement; installed hosts must still use `submit_battle_report` only with server-issued tickets.

Verification:

- `node --import tsx --test --test-name-pattern "MCP archives local reports without runTicket" ../agent-server/test/mcp.test.ts`: failed first with `unknown_tool:agent_world.archive_local_report`; passed after adding the MCP tool/runtime path.
- `node --import tsx --test --test-name-pattern "HTTP archives local reports without runTicket" ../agent-server/test/server.test.ts`: failed first with 404 for `/api/runs/archive`; passed after adding the HTTP route.
- `node --import tsx --test --test-name-pattern "MCP archives local reports without runTicket|MCP tools run the world loop" ../agent-server/test/mcp.test.ts`: passed 2/2.
- `node --import tsx --test --test-name-pattern "HTTP archives local reports without runTicket|HTTP submit requires the signed legacy run envelope" ../agent-server/test/server.test.ts`: passed 2/2 and confirms no-ticket settlement still rejects.
- `node --import tsx --test --test-name-pattern "legacy authored-report docs declare" ../agent-server/test/legacyTrustDocs.test.ts`: failed first because packaged docs omitted the new archive-only path; passed after SKILL/protocol updates.
- `node --import tsx --test --test-name-pattern "Obsidian Epoch package includes host install docs and smoke playbooks" ../agent-server/test/packageArchive.test.ts`: failed once on documentation ordering; passed after the protocol reference put `local_trial_archive`, `does not require runTicket` and `/api/runs/archive` in the asserted sequence.
- `npm run typecheck`: passed from `tools/graph-react-app`, including no JS/MJS/CJS/JSX source, no explicit production `any`, web typecheck and agent-server typecheck.
- `npm run agent:test`: passed 460/460 from `tools/graph-react-app`.
- `npm run agent:ui-test`: passed 137/137 from `tools/graph-react-app`.
- `npm run batch:test`: passed 11/11 from `tools/graph-react-app`.
- `npm run build`: passed from `tools/graph-react-app` and exported `00_总览/黑曜纪元3D世界地图.html`.
- `git diff --check`: passed.
- Direct trailing-whitespace scan over touched files: no output.

Remaining risk:

- This provides the server-side archive-only compatibility endpoint and keeps it out of public/lore/progression settlement. A fuller personal archive browser or hydrated private archive query can still be added later if the product needs users to retrieve no-ticket local archives after restart.

## 2026-07-04 Delayed Source Reward Release Slice

- Closed the S060 source-reward delay gap in the legacy authored-report lore lane.
- Exact duplicate claim reuse no longer grants source reward points immediately: the first independent reuse records `sourceRewards[].status: "pending"`, `points: 0`, `pendingPoints: 1` and supporting explorer evidence.
- A later reuse by a second independent explorer releases the pending source reward with `status: "released"`, `points: 1`, `releasedByExplorerId`, `releasedByRunTicket` and `releaseReason: "second_independent_reuse"`.
- Feedback events now carry source reward `status`, `pendingPoints` and optional `releaseReason`, so clients can distinguish pending source credit from actual payout.
- Packaged Skill/protocol docs now tell installed hosts that `sourceRewards` start pending and release only after a second independent reuse.

Verification:

- `node --import tsx --test ../agent-server/test/lore.test.ts`: failed first because duplicate claim reuse immediately created `points: 1`; passed after pending/released state wiring.
- `node --import tsx --test --test-name-pattern "feedback events notify claim reuse" ../agent-server/test/feedback.test.ts`: failed first because feedback omitted pending status; passed after feedback event fields were added.
- `node --import tsx --test --test-name-pattern "MCP delays legacy source rewards|MCP tools run the world loop" ../agent-server/test/mcp.test.ts`: passed 2/2 after runtime integration.
- `node --import tsx --test --test-name-pattern "legacy authored-report docs declare" ../agent-server/test/legacyTrustDocs.test.ts`: failed first because packaged docs omitted the delayed source reward boundary; passed after SKILL/protocol updates.
- `node --import tsx --test --test-name-pattern "Obsidian Epoch package includes host install docs and smoke playbooks" ../agent-server/test/packageArchive.test.ts`: passed after packaged protocol carried the pending/released wording.
- `npm run typecheck`: passed from `tools/graph-react-app`, including no JS/MJS/CJS/JSX source, no explicit production `any`, web typecheck and agent-server typecheck.
- `npm run agent:test`: passed 462/462 from `tools/graph-react-app`.
- `npm run agent:ui-test`: passed 137/137 from `tools/graph-react-app`.
- `npm run batch:test`: passed 11/11 from `tools/graph-react-app`.
- `npm run build`: passed from `tools/graph-react-app` and exported `00_总览/黑曜纪元3D世界地图.html`.
- `git diff --check`: passed.
- Direct trailing-whitespace scan over touched files: no output.

Remaining risk:

- This delays legacy source reward credit until independent reuse evidence exists. It still does not add an operator/manual payout queue or UI for reviewing pending source rewards outside the existing lore state/feedback surfaces.

## 2026-07-04 RunTicket State Machine Slice

- Closed the S061 legacy `runTicket` state-machine gap.
- Ticket heartbeat now moves live tickets from `issued` to `active` while refreshing the server sequence window and expiry.
- Legacy authored-report submission now reserves the payload in `submitted`, completes server settlement side effects, then marks the ticket `settled` with `settledAt`.
- Same-payload replay remains idempotent after `submitted` or `settled`; a changed payload for the same ticket still fails with `ticket_payload_mismatch`.
- Added explicit `voidTicket` support for pre-settlement cancellation; void tickets reject heartbeat and submit with `ticket_void`.
- JSONL hydration restores submitted run tickets as `settled` instead of regressing them to `submitted`, and the SQLite ticket index mirrors `run_submitted` records as `settled` for observability.
- Packaged Skill/protocol docs now describe the full `issued` / `active` / `submitted` / `settled` / `expired` / `void` run-ticket state set.

Verification:

- `node --import tsx --test ../agent-server/test/tickets.test.ts`: failed first because heartbeat stayed `issued` and `settleTicket` / `voidTicket` did not exist; passed after state-machine implementation.
- `node --import tsx --test --test-name-pattern "MCP run heartbeat refreshes legacy ticket sequence and expiry|MCP tools run the world loop" ../agent-server/test/mcp.test.ts`: failed first because the old assertion expected final state `submitted`; passed after updating the contract to `settled`.
- `node --import tsx --test --test-name-pattern "HTTP run heartbeat refreshes and persists legacy ticket sequence|HTTP run settlement persists legacy trust labels" ../agent-server/test/server.test.ts`: failed first on the old `submitted` assertion; passed after HTTP persistence/hydration asserted active heartbeat and settled final state.
- `node --import tsx --test --test-name-pattern "MCP submit rate-limits legacy authored reports per explorer" ../agent-server/test/mcp.test.ts`: passed after updating the old settlement-state assertion to `settled`.
- `node --import tsx --test --test-name-pattern "legacy authored-report docs declare" ../agent-server/test/legacyTrustDocs.test.ts`: passed after docs carried the state-machine vocabulary.
- `node --import tsx --test --test-name-pattern "Obsidian Epoch package includes host install docs and smoke playbooks" ../agent-server/test/packageArchive.test.ts`: passed after packaged docs carried the same state-machine wording.
- `npm run typecheck`: passed from `tools/graph-react-app`, including no JS/MJS/CJS/JSX source, no explicit production `any`, web typecheck and agent-server typecheck.
- `npm run agent:test`: failed once at 462/463 because one old MCP limit test still expected `submitted`; passed after correction at 463/463 from `tools/graph-react-app`.
- `npm run agent:ui-test`: passed 137/137 from `tools/graph-react-app`.
- `npm run batch:test`: passed 11/11 from `tools/graph-react-app`.
- `npm run build`: passed from `tools/graph-react-app` and exported `00_总览/黑曜纪元3D世界地图.html`.
- `git diff --check`: passed.
- Direct trailing-whitespace scan over touched files: no output.

Remaining risk:

- This implements the legacy authored-report ticket state machine and persistence observability. It does not add a public/operator API to void tickets; `voidTicket` is currently a registry capability for pre-settlement cancellation and future operator tooling.

## 2026-07-04 Lore Re-Adjudication Immutability Slice

- Closed the S063 re-adjudication immutability gap for server lore target adjudication.
- Re-adjudicating a lore target now appends a fresh adjudication payload with a distinct `adjudicationId` / `newAdjudicationId`, even when the target, status and cited source contribution events are the same.
- The new adjudication records `previousAdjudicationId` when a prior adjudication exists, and provenance carries the same new/previous id chain for audit readers.
- `lore_targets`, world overview and public world page continue to show the latest system adjudication, while older adjudication events remain in the event/audit stream instead of being overwritten.
- Packaged Skill/protocol docs now state that `obsidian_epoch.adjudicate_lore_target` re-adjudication is append-only and never overwrites older adjudication events.

Verification:

- `node --import tsx --test --test-name-pattern "MCP records server-authoritative lore contributions into categorical honor boards" ../agent-server/test/mcp.test.ts`: failed first because a second adjudication with the same target/status/sources reused the first `adjudicationId`; passed after adding review sequence and new/previous id fields.
- `node --import tsx --test --test-name-pattern "HTTP renders public world overview with news, result pages and archives" ../agent-server/test/server.test.ts`: failed first because the additional readjudication correctly moved `sharedLoreSnapshotVersion` from `shared-lore:2` to `shared-lore:3`, then failed on the old public page summary assertion; passed after updating the S063 expectations.
- `node --import tsx --test --test-name-pattern "Obsidian Epoch package includes host install docs and smoke playbooks" ../agent-server/test/packageArchive.test.ts`: passed after packaged docs carried the re-adjudication boundary.
- `npm run typecheck`: passed from `tools/graph-react-app`, including no JS/MJS/CJS/JSX source, no explicit production `any`, web typecheck and agent-server typecheck.
- `npm run agent:test`: passed 463/463 from `tools/graph-react-app`.
- `npm run agent:ui-test`: passed 137/137 from `tools/graph-react-app`.
- `npm run batch:test`: passed 11/11 from `tools/graph-react-app`.
- `npm run build`: passed from `tools/graph-react-app` and exported `00_总览/黑曜纪元3D世界地图.html`.
- `git diff --check`: passed.
- Direct trailing-whitespace scan over touched files: no output.

Remaining risk:

- This covers server lore target re-adjudication immutability. It does not introduce a broader operator UI for comparing all historical adjudications side by side; operators can still inspect the preserved event/audit stream and latest read model.

## 2026-07-04 Legacy Outbox Observability Slice

- Closed the S062 outbox observability gap for the legacy authored-report settlement lane.
- Successful legacy settlement now records per-effect outbox entries for public world indexing, lore admission, progression awards, feedback notifications and transparency logging.
- Outbox entries expose `status`, `retryCount`, `deadLetter`, `lastError`, `payloadHash` and safe `payloadSummary` fields, so operators can distinguish a successful aggregate write from a failed projection or notification dispatch.
- Failed dispatch attempts now increment retry counts and move to `dead_letter` after the configured retry budget; `agent_world.outbox` and `GET /api/outbox` expose the current queue without raw report payloads.
- Added manual replay through `agent_world.replay_outbox` and `POST /api/outbox/replay`; replay updates the entry and HTTP persistence appends the updated state to `outbox.jsonl`.
- JSONL hydration, SQLite migration and recovery file maps now include `outbox.jsonl`, so outbox observability survives restart, backup and restore paths.
- Packaged Skill/protocol docs now describe outbox status, retry counts, dead-letter inspection and manual replay for installed hosts.

Verification:

- `node --import tsx --test --test-name-pattern "outbox" ../agent-server/test/mcp.test.ts`: failed first because settlement responses had no `outbox.summary`; passed after adding the outbox ledger, MCP read tool and manual replay tool.
- `node --import tsx --test --test-name-pattern "outbox" ../agent-server/test/server.test.ts`: failed first because settlement responses had no outbox state and HTTP had no `/api/outbox` routes; passed after adding HTTP read/replay routes and `outbox.jsonl` persistence.
- `node --import tsx --test --test-name-pattern "outbox|legacy authored-report docs declare|Obsidian Epoch package includes host install docs and smoke playbooks" ../agent-server/test/mcp.test.ts ../agent-server/test/server.test.ts ../agent-server/test/legacyTrustDocs.test.ts ../agent-server/test/packageArchive.test.ts`: passed after packaged docs carried the outbox boundary.
- `node --import tsx --test --test-name-pattern "recovery|migrateJsonlDataDirToSqlite|appendSqliteJsonl" ../agent-server/test/recovery.test.ts ../agent-server/test/sqliteStore.test.ts`: passed after recovery/SQLite known-file coverage included `outbox.jsonl`.
- `npm run typecheck`: passed from `tools/graph-react-app`, including no JS/MJS/CJS/JSX source, no explicit production `any`, web typecheck and agent-server typecheck.
- `npm run agent:test`: failed twice while tightening packaged protocol wording around `/api/outbox`, `/api/outbox/replay` and `outbox.jsonl`; passed after doc/test alignment at 465/465 from `tools/graph-react-app`.
- `npm run agent:ui-test`: passed 137/137 from `tools/graph-react-app`.
- `npm run batch:test`: passed 11/11 from `tools/graph-react-app`.
- `npm run build`: passed from `tools/graph-react-app` and exported `00_总览/黑曜纪元3D世界地图.html`.
- `git diff --check`: passed.
- Direct trailing-whitespace scan over touched files: no output.

Remaining risk:

- This is an MVP observability/replay layer for legacy authored-report side effects. Dispatch targets are still in-process projections/logs rather than an external message broker, so future distributed workers may need adapter-specific acknowledgement and backoff policies.

## 2026-07-04 Claim Status Transition Table Slice

- Closed the S064 claim-status migration gap in the legacy lore ledger.
- Added a server-side claim status migration table for `candidate`, `rumor`, `canonical`, `disputed`, `inscribed`, `rejected` and `hidden`.
- `transitionClaimStatus` is now the lore-ledger status mutation path; invalid skips such as `rumor` -> `inscribed` fail with `claim_status_transition_invalid` unless the transition carries `manualApprovalId` or `canonAdoptionEventId`.
- Claim state now preserves `statusHistory` with previous status, target status, reason, optional approval/adoption evidence and `changedAt`.
- Newly admitted claims record their initial status history, and hydrated claims preserve existing history.
- Packaged Skill/protocol docs now declare the claim status migration table and the approval/adoption requirement for direct `rumor` -> `inscribed` changes.

Verification:

- `node --import tsx --test --test-name-pattern "claim status transitions" ../agent-server/test/lore.test.ts`: failed first because `transitionClaimStatus` did not exist; passed after adding the migration table and override guard.
- `node --import tsx --test ../agent-server/test/lore.test.ts`: passed 7/7.
- `node --import tsx --test --test-name-pattern "claim status transitions|legacy authored-report docs declare|Obsidian Epoch package includes host install docs and smoke playbooks" ../agent-server/test/lore.test.ts ../agent-server/test/legacyTrustDocs.test.ts ../agent-server/test/packageArchive.test.ts`: passed.
- `npm run typecheck`: passed from `tools/graph-react-app`, including no JS/MJS/CJS/JSX source, no explicit production `any`, web typecheck and agent-server typecheck.
- `npm run agent:test`: passed 466/466 from `tools/graph-react-app`.
- `npm run agent:ui-test`: passed 137/137 from `tools/graph-react-app`.
- `npm run batch:test`: passed 11/11 from `tools/graph-react-app`.
- `npm run build`: passed from `tools/graph-react-app` and exported `00_总览/黑曜纪元3D世界地图.html`.

Remaining risk:

- This adds the guarded state mutation primitive and history, but does not yet expose a dedicated operator UI for claim status review. Current callers must use the lore-ledger path or future operator tooling to perform approved transitions.

## 2026-07-04 Graph Sync Status Slice

- Closed the S065 graph-sync status gap for the legacy authored-report settlement lane.
- Added `graphSync` status projection over the existing `world_index` outbox event, avoiding a second sync queue.
- Successful settlement returns an initial `pending_sync` / `待同步` top-level status while the graph index confirmation is represented by the outbox projection.
- `agent_world.outbox`, `GET /api/outbox`, replay results and settlement `outbox.graphSync` now report confirmed `synced` / `已同步` or `retry_later` / `稍后重试` based on the `world_index` outbox entry.
- Manual replay of a failed `world_index` outbox entry updates `graphSync` back to `synced`.
- Packaged Skill/protocol docs now describe `graphSync`, `pending_sync`, `synced`, `retry_later` and the Chinese labels clients can display directly.

Verification:

- `node --import tsx --test --test-name-pattern "graph sync|legacy outbox|legacy authored-report docs declare|Obsidian Epoch package includes host install docs and smoke playbooks" ../agent-server/test/mcp.test.ts ../agent-server/test/server.test.ts ../agent-server/test/legacyTrustDocs.test.ts ../agent-server/test/packageArchive.test.ts`: failed first because settlement/outbox/docs had no `graphSync`; the failure surfaced missing `graphSync.status` in MCP/HTTP and missing docs wording.
- `node --import tsx --test --test-name-pattern "legacy outbox|legacy authored-report docs declare|Obsidian Epoch package includes host install docs and smoke playbooks" ../agent-server/test/mcp.test.ts ../agent-server/test/server.test.ts ../agent-server/test/legacyTrustDocs.test.ts ../agent-server/test/packageArchive.test.ts`: passed 4/4 after adding the projection, response fields and docs.
- `npm run typecheck`: passed from `tools/graph-react-app`, including no JS/MJS/CJS/JSX source, no explicit production `any`, web typecheck and agent-server typecheck.
- `npm run agent:test`: passed 466/466 from `tools/graph-react-app`.
- `npm run agent:ui-test`: passed 137/137 from `tools/graph-react-app`.
- `npm run batch:test`: passed 11/11 from `tools/graph-react-app`.
- `npm run build`: passed from `tools/graph-react-app` and exported `00_总览/黑曜纪元3D世界地图.html`.
- `git diff --check`: passed.
- Direct trailing-whitespace scan over touched files: no output.

Remaining risk:

- This is an MVP sync-status projection over the in-process legacy outbox. A dedicated browser badge can be added later if the legacy authored-report submission flow becomes a first-class UI; current HTTP/MCP clients can display the returned `graphSync.label` directly.

## 2026-07-04 Schema Adapter Slice

- Closed the S066 schema-adapter gap for the public Agent World reader path.
- `parseAgentPublicWorld` now acts as the schema adapter instead of directly trusting the latest payload shape.
- Missing legacy summary counters adapt to explicit `"unknown"` values while malformed present counters still fail validation.
- Missing legacy detail maps adapt to `null`, and missing `sourceGraph` adapts to empty `nodes` / `edges` with `status: "unknown"`.
- Present but malformed collection/detail/source-graph fields still fail with the existing validation errors, preserving the safety boundary for corrupted payloads.
- Updated frontend shared types so UI readers must account for `"unknown"` summary values and nullable detail maps.

Verification:

- `node --import tsx --test --test-name-pattern "parseAgentPublicWorld" ../agent-server/test/validation.test.ts`: failed first with `agent_world_summary_invalid` for a legacy payload missing newer fields; passed after the adapter defaults were added.
- `npm run typecheck`: passed from `tools/graph-react-app`, including no JS/MJS/CJS/JSX source, no explicit production `any`, web typecheck and agent-server typecheck.
- `npm run agent:test`: passed 467/467 from `tools/graph-react-app`.
- `npm run agent:ui-test`: passed 137/137 from `tools/graph-react-app`.
- `npm run batch:test`: passed 11/11 from `tools/graph-react-app`.
- `npm run build`: passed from `tools/graph-react-app` and exported `00_总览/黑曜纪元3D世界地图.html`.
- `git diff --check`: passed.
- Direct trailing-whitespace scan over touched files: no output.

Remaining risk:

- This closes the public Agent World reader path. Additional reader-specific adapters can still be added around future external JSON contracts, especially if context-package or Epoch overview responses need backward-compatible field migration beyond their current typed routes.

## 2026-07-04 Review Queue Budget Slice

- Closed the S067 legacy adjudication queue budget gap.
- Added a pre-adjudication review budget for legacy authored-report submissions, checked after ticket/signature validation and before `adjudicateRun`.
- Budget decisions now account for identity reputation rank, one pending entry per `runTicket`, report length, similar pending reports from the same explorer and current delayed-queue system load.
- Over-budget submissions return `state: "review_delayed"` with `reviewQueue` details instead of settling, writing lore/progression/outbox or consuming the normal run settlement path.
- Same-`runTicket` delayed submissions are idempotent and return the existing delayed queue entry.
- Added `agent_world.review_queue` and `GET /api/review-queue` so operators and HTTP clients can inspect delayed review entries.
- Packaged Skill/protocol docs now describe the review budget dimensions and delayed review queue inspection path.

Verification:

- `node --import tsx --test --test-name-pattern "delays legacy review|queues legacy review" ../agent-server/test/mcp.test.ts ../agent-server/test/server.test.ts`: failed first because over-budget MCP submissions still settled and HTTP returned 200 instead of 202.
- `node --import tsx --test --test-name-pattern "delays legacy review|queues legacy review|review_queue|legacy authored-report docs declare|Obsidian Epoch package includes host install docs and smoke playbooks|MCP tool registry" ../agent-server/test/mcp.test.ts ../agent-server/test/server.test.ts ../agent-server/test/legacyTrustDocs.test.ts ../agent-server/test/packageArchive.test.ts`: passed 6/6 after adding the budget, queue read tools/routes and docs.
- `npm run typecheck`: failed once on a dynamic rank-index type and a widened HTTP test return union; passed after explicit record typing and test narrowing.
- `npm run agent:test`: passed 470/470 from `tools/graph-react-app`.
- `npm run agent:ui-test`: passed 137/137 from `tools/graph-react-app`.
- `npm run batch:test`: passed 11/11 from `tools/graph-react-app`.
- `npm run build`: passed from `tools/graph-react-app` and exported `00_总览/黑曜纪元3D世界地图.html`.
- `git diff --check`: passed.
- Direct trailing-whitespace scan over touched files: no output.

Remaining risk:

- This is an MVP in-memory delayed review queue for the legacy authored-report path. A future operator worker can drain the queue and persistence/hydration can be added if delayed review entries must survive process restart before S067 is considered production-grade beyond MVP.

## 2026-07-04 Context Snapshot Slice

- Closed the S068 context snapshot gap for legacy authored-report context packages.
- `createContextPackage` now returns `contextSnapshot` with a deterministic `ctxsnap_*` id, the server context version tuple, setting card ids/versions/public summaries, retrieval parameters and public-safe filtering reasons.
- Runtime context calls now append snapshots to an in-memory ledger and expose them through `agent_world.context_snapshots`.
- HTTP context routes persist generated snapshots to `context-snapshots.jsonl` and expose `GET /api/context/snapshots`.
- JSONL hydration, SQLite migration and recovery manifests now include `context-snapshots.jsonl`, so saved snapshots survive migration, backup and restore paths.
- Packaged Skill/protocol docs now declare `contextSnapshot`, `settingCards`, `retrievalParams`, `filteringReasons`, `agent_world.context_snapshots`, `/api/context/snapshots` and the snapshot JSONL ledger.

Verification:

- `node --import tsx --test --test-name-pattern "context snapshot|context package|context_snapshots|SQLite migration hydrates saved context snapshots|recovery manifest gives matching|legacy authored-report docs declare|Obsidian Epoch package includes host install docs and smoke playbooks|MCP tool registry" ../agent-server/test/context.test.ts ../agent-server/test/mcp.test.ts ../agent-server/test/server.test.ts ../agent-server/test/sqlite-store.test.ts ../agent-server/test/recovery.test.ts ../agent-server/test/legacyTrustDocs.test.ts ../agent-server/test/packageArchive.test.ts`: failed first because `contextSnapshot`, `agent_world.context_snapshots`, `context-snapshots.jsonl` known-file coverage and packaged docs did not exist; passed 7/7 after implementation and docs.
- `npm run typecheck`: failed once because the snapshot clone helper inferred away `snapshotId` / structured `retrievalParams`; passed after adding an explicit `ContextSnapshotRecord` type. Final run passed from `tools/graph-react-app`, including no JS/MJS/CJS/JSX source, no explicit production `any`, web typecheck and agent-server typecheck.
- `npm run agent:test`: failed once because the filtering reason `server_only_truth_excluded` triggered the existing public-context leakage regex; passed 472/472 after renaming the public reason to `non_public_truth_excluded`.
- `npm run agent:ui-test`: passed 137/137 from `tools/graph-react-app`.
- `npm run batch:test`: passed 11/11 from `tools/graph-react-app`.
- `npm run build`: passed from `tools/graph-react-app` and exported `00_总览/黑曜纪元3D世界地图.html`.
- `git diff --check`: passed.
- Direct trailing-whitespace scan over touched files: no output.

Remaining risk:

- This is an MVP structured snapshot ledger. It records public summaries and filtering reasons, but does not yet create encrypted archives or a queue-drain workflow beyond existing JSONL/SQLite/recovery persistence.

## 2026-07-04 Result Page Deletion Tombstone Slice

- Closed the S069 delete/archive separation gap for shared Epoch result pages.
- Added a distinct `deleted` result-page status without changing the existing share-token revocation semantics.
- Added `obsidian_epoch.delete_result_page` and `POST /api/epoch/result-page/delete` for owner/operator deletion requests.
- Deletion now clears the archived full result `payload`, removes the share-token hash, increments the share version and retains only a `deletionSummary` tombstone with irreversible hashes and minimum audit facts.
- Public deleted-page reads return a `result_page_deleted` status page instead of rendering old result content.
- `result-pages.jsonl` persistence now records the active page first and the deleted tombstone later, with the deleted record carrying no full payload.
- Packaged Skill/protocol docs and install manifests now declare the delete tool, HTTP route, tombstone status and retained hash fields.

Verification:

- `node --import tsx --test --test-name-pattern "delete result page|delete_result_page|legacy authored-report docs declare|Obsidian Epoch package includes host install docs and smoke playbooks|MCP tool registry" ../agent-server/test/mcp.test.ts ../agent-server/test/server.test.ts ../agent-server/test/legacyTrustDocs.test.ts ../agent-server/test/packageArchive.test.ts`: failed first because the delete tool, HTTP route, docs and package manifest were missing; passed 5/5 after implementation.
- `npm run typecheck`: passed from `tools/graph-react-app`, including no JS/MJS/CJS/JSX source, no explicit production `any`, web typecheck and agent-server typecheck.
- `npm run agent:test`: passed 474/474 from `tools/graph-react-app`.
- `npm run agent:ui-test`: passed 137/137 from `tools/graph-react-app`.
- `npm run batch:test`: passed 11/11 from `tools/graph-react-app`.
- `npm run build`: passed from `tools/graph-react-app` and exported `00_总览/黑曜纪元3D世界地图.html`.
- `git diff --check`: passed.
- Direct trailing-whitespace scan over touched files: no output.

Remaining risk:

- This is the MVP deletion tombstone path. It removes full payload archives from runtime and JSONL persistence after deletion, but does not attempt retroactive compaction of older already-written active JSONL records in append-only logs or external backups.

## 2026-07-04 Versioned Result Share Token Slice

- Closed the S070 stale-cache share-link gap for public Epoch result pages.
- Newly created result URLs now include both `shareToken` and `shareVersion=1`; public reads require the token hash and version to match before rendering result content.
- Missing versions return `result_page_share_version_required`; stale or wrong versions return `result_page_share_version_mismatch`.
- Revoking a result page now advances `shareVersion`, clears `shareTokenHash`, and returns a status URL without the old raw token.
- Deleting a result page keeps the S069 tombstone behavior while also advancing `shareVersion`, clearing `shareTokenHash`, and returning a tokenless status URL.
- Public result HTML already uses `Cache-Control: no-store`; smoke/world-page checks now account for HTML-escaped multi-query result URLs.
- Packaged Skill/protocol docs now declare versioned share URLs, version-mismatch status pages and revoke/delete token invalidation.

Verification:

- `node --import tsx --test --test-name-pattern "MCP Epoch tools expose server-issued identity|MCP delete result page|HTTP Epoch routes persist canonical events|HTTP delete result page" ../agent-server/test/mcp.test.ts ../agent-server/test/server.test.ts`: failed first because new result URLs lacked `shareVersion`; passed 4/4 after URL generation, access checks and revoke/delete invalidation were added.
- `node --import tsx --test --test-name-pattern "MCP Epoch tools expose server-issued identity|MCP delete result page|HTTP Epoch routes persist canonical events|HTTP delete result page|legacy authored-report docs declare|Obsidian Epoch package includes host install docs and smoke playbooks" ../agent-server/test/mcp.test.ts ../agent-server/test/server.test.ts ../agent-server/test/legacyTrustDocs.test.ts ../agent-server/test/packageArchive.test.ts`: passed 6/6 after package docs were updated.
- `npm run agent:install-smoke -- --json`: failed once with `install_smoke_world_page_failed` because the smoke check looked for an unescaped `&` in HTML; passed after accepting HTML-escaped result URLs.
- `node --import tsx --test --test-name-pattern "HTTP renders public world overview" ../agent-server/test/server.test.ts`: failed once for the same escaped multi-query URL assertion; passed after adding the local `htmlIncludesUrl` helper.
- `node --import tsx --test ../agent-server/test/install-smoke-command.test.ts ../agent-server/test/release-rehearsal-command.test.ts`: passed 15/15.
- `npm run typecheck`: passed from `tools/graph-react-app`, including no JS/MJS/CJS/JSX source, no explicit production `any`, web typecheck and agent-server typecheck.
- `npm run agent:test`: passed 474/474 from `tools/graph-react-app`.
- `npm run agent:ui-test`: passed 137/137 from `tools/graph-react-app`.
- `npm run batch:test`: passed 11/11 from `tools/graph-react-app`.
- `npm run build`: passed from `tools/graph-react-app` and exported `00_总览/黑曜纪元3D世界地图.html`.
- `git diff --check`: passed.
- Direct trailing-whitespace scan over touched files: no output.

Remaining risk:

- This is the MVP versioned share-link path. It prevents newly served old-version links from rendering content and keeps result HTML non-cacheable, but it cannot purge already-cached external CDN/browser copies that were served before the versioned URL contract existed.

## 2026-07-04 Prompt Layering Slice

- Closed the S071 agent-prompt layering gap for legacy context packages and Web LLM bridge prompts.
- Added shared `promptLayers` with explicit priority order: `system_policy` > `agent_identity_boundary` > `user_mandate` > `user_additional_instruction`.
- `agent_world.context_package`, `POST /api/context/package`, `GET/POST /api/world/public-context` now return the structured prompt layers.
- Optional `additionalInstruction` is treated as the lowest-priority user layer; unsafe policy-override, credential or self-sacrifice instructions are marked `rejected`, hashed, and excluded from `effectiveText`.
- `obsidian_epoch.web_bridge_turn` now returns the same `promptLayers`, and its `copyPrompt` shows the four layers before the server-issued action options.
- MCP schemas and packaged Skill/protocol docs now declare `additionalInstruction` and the prompt-layer priority contract.

Verification:

- `node --import tsx --test --test-name-pattern "layers user additions|MCP Epoch tools expose server-issued identity" ../agent-server/test/context.test.ts ../agent-server/test/mcp.test.ts`: failed first because `promptLayers` did not exist and the bridge prompt was unlayered; passed after shared layer generation and bridge prompt wiring.
- `node --import tsx --test --test-name-pattern "layers user additions|MCP Epoch tools expose server-issued identity|HTTP exposes versioned public world context contract|legacy authored-report docs declare|Obsidian Epoch package includes host install docs and smoke playbooks" ../agent-server/test/context.test.ts ../agent-server/test/mcp.test.ts ../agent-server/test/server.test.ts ../agent-server/test/legacyTrustDocs.test.ts ../agent-server/test/packageArchive.test.ts`: passed 5/5 after HTTP query support and docs were updated.
- `npm run typecheck`: failed once because the new test asserted optional `rawTextHash` without narrowing; passed after converting that assertion to `String(...)`. Final run passed from `tools/graph-react-app`, including no JS/MJS/CJS/JSX source, no explicit production `any`, web typecheck and agent-server typecheck.
- `npm run agent:test`: passed 475/475 from `tools/graph-react-app`.
- `npm run agent:ui-test`: passed 137/137 from `tools/graph-react-app`.
- `npm run batch:test`: passed 11/11 from `tools/graph-react-app`.
- `npm run build`: passed from `tools/graph-react-app` and exported `00_总览/黑曜纪元3D世界地图.html`.
- `git diff --check`: passed.
- Direct trailing-whitespace scan over touched files: no output.

Remaining risk:

- This is an MVP prompt-layer contract and prompt-surface filter. It prevents rejected user additions from entering the effective server-provided prompt, but final model behavior still depends on downstream clients using the returned `promptLayers` / `copyPrompt` instead of hand-written prompts.

## 2026-07-04 No Drama Score Slice

- Closed the S072 dramatic-risk scoring gap for legacy authored-report adjudication and prompt guidance.
- Removed the legacy adjudicator's `authorizedHighRisk` score bonus, so an otherwise identical high-risk/dramatic event no longer scores above a grounded medium-risk event.
- Added a regression test proving dramatic self-sacrifice/high-risk conflict does not raise score or claim slots.
- Extended shared `promptLayers.systemPolicy` to tell agents not to create high-risk conflict for drama; danger and cost must come from the server event chain and user mandate.
- Packaged Skill/protocol docs now state that drama is not scored, high-risk conflict must be grounded, and costs must come from the event chain.

Verification:

- `node --import tsx --test --test-name-pattern "dramatic high-risk conflict|layers user additions" ../agent-server/test/adjudicator.test.ts ../agent-server/test/context.test.ts`: failed first because authorized high risk added 3 score points and prompt policy lacked the drama/high-risk conflict rule; passed after removing the bonus and adding the policy instruction.
- `node --import tsx --test --test-name-pattern "dramatic high-risk conflict|layers user additions|legacy authored-report docs declare|Obsidian Epoch package includes host install docs and smoke playbooks" ../agent-server/test/adjudicator.test.ts ../agent-server/test/context.test.ts ../agent-server/test/legacyTrustDocs.test.ts ../agent-server/test/packageArchive.test.ts`: passed 4/4 after docs were updated.
- `npm run typecheck`: passed from `tools/graph-react-app`, including no JS/MJS/CJS/JSX source, no explicit production `any`, web typecheck and agent-server typecheck.
- `npm run agent:test`: passed 476/476 from `tools/graph-react-app`.
- `npm run agent:ui-test`: passed 137/137 from `tools/graph-react-app`.
- `npm run batch:test`: passed 11/11 from `tools/graph-react-app`.
- `npm run build`: passed from `tools/graph-react-app` and exported `00_总览/黑曜纪元3D世界地图.html`.
- `git diff --check`: passed.
- Direct trailing-whitespace scan over touched files: no output.

Remaining risk:

- This removes the explicit legacy score incentive and adds prompt guidance. It does not try to semantically classify every possible dramatic narrative; canonical Epoch lanes still rely on server-issued options, risk budgets and event-chain costs for enforcement.

## 2026-07-04 Agent Memory Partition Slice

- Closed the S073 fake-claim memory pollution gap for agent-facing NPC candidate memory.
- Tightened `obsidian_epoch.agent_memory` / `/api/epoch/agent-memory` so unreviewed candidate prose stays in the submitting agent's `privateRunMemory`.
- `confirmedMemory` remains limited to server-confirmed NPC identity/existence summaries and does not include candidate story evidence.
- `rumorMemory` now requires an operator-reviewed risky candidate before exposing story evidence as a non-settlement rumor.
- Regional memory reads without `agentId` still hide `privateRunMemory`, so private candidate prose does not leak through broad region views.
- Packaged Skill/protocol docs and architecture notes now describe `confirmedMemory`, operator-reviewed `rumorMemory`, and private unreviewed/rejected candidate story memory.

Verification:

- `node --import tsx --test --test-name-pattern "stratif|stratifies agent memory" ../agent-server/test/mcp.test.ts ../agent-server/test/server.test.ts`: failed first because unreviewed `watch` candidate prose still appeared in `rumorMemory` and promoted candidate prose did not appear in `privateRunMemory`; passed 2/2 after `reviewedAt` became the rumor-layer gate and unreviewed candidate prose was added to the private layer.
- `npm run typecheck`: passed from `tools/graph-react-app`, including no JS/MJS/CJS/JSX source, no explicit production `any`, web typecheck and agent-server typecheck.
- `npm run agent:test`: passed 476/476 from `tools/graph-react-app`.
- `npm run agent:ui-test`: passed 137/137 from `tools/graph-react-app`.
- `npm run batch:test`: passed 11/11 from `tools/graph-react-app`.
- `npm run build`: passed from `tools/graph-react-app` and exported `00_总览/黑曜纪元3D世界地图.html`.
- `git diff --check`: passed.
- Direct trailing-whitespace scan over touched files: no output.

Remaining risk:

- This is an MVP read-model partition. It prevents unreviewed candidate prose from being reused through agent memory, but the current NPC candidate submit path can still create minimal canonical NPC identity records automatically for non-blocked candidates.

## 2026-07-04 Personality Drift Proposal Slice

- Audited and closed S074 against the existing server-owned personality drift implementation.
- Major anomaly scars / pollution already append `personality_drift_proposed` from `anomaly_event_resolved` when the winning active identity takes lifetime risk.
- Strong relationship hostility / betrayal already appends a target-side `personality_drift_proposed` bound to the `relationship_updated` source event.
- Drift records remain `proposed` and visible in `progress.personalityDrifts` until the identity owner confirms them with `obsidian_epoch.confirm_personality_drift`.
- Confirmation requires owner recovery authorization, writes `personality_drift_confirmed`, and only then appends the suggested trait to the identity personality profile.
- No production code change was needed for S074; existing MCP/package docs already warn agents not to invent persistent trauma, corruption or betrayal traits from local prose.

Verification:

- `node --import tsx --test --test-name-pattern "personality drift|relationship hostility" ../agent-server/test/epoch-game-core.test.ts ../agent-server/test/mcp.test.ts ../agent-server/test/server.test.ts`: passed 5/5, covering core anomaly proposal, core relationship/betrayal proposal, MCP anomaly confirmation, MCP hostility confirmation, and HTTP anomaly confirmation.
- `npm run typecheck`: passed from `tools/graph-react-app` in the immediately preceding S073 verification after all current code changes.
- `npm run agent:test`: passed 476/476 from `tools/graph-react-app` in the immediately preceding S073 verification after all current code changes.
- `npm run agent:ui-test`: passed 137/137 from `tools/graph-react-app` in the immediately preceding S073 verification after all current code changes.
- `npm run batch:test`: passed 11/11 from `tools/graph-react-app` in the immediately preceding S073 verification after all current code changes.
- `npm run build`: passed from `tools/graph-react-app` in the immediately preceding S073 verification and exported `00_总览/黑曜纪元3D世界地图.html`.
- `git diff --check`: passed after appending this slice log.
- Direct trailing-whitespace scan over touched files: no output after appending this slice log.

Remaining risk:

- This is the existing S074 proposal/confirmation path. S075 still needs cooldown/source-binding hardening so users cannot treat confirmation as free personality respec.

## 2026-07-04 Personality Drift Cooldown Slice

- Closed the S075 free-respec gap for server-proposed personality drift.
- Added a source-event gate for drift proposals: only allowed server events such as `anomaly_event_resolved` and `relationship_updated` can create `personality_drift_proposed`.
- Added a seven-day confirmation cooldown per identity, so a newly confirmed drift blocks later scar/betrayal proposals until the cooldown expires.
- Kept existing open-proposal behavior: an unconfirmed drift still blocks parallel proposals for the same identity.
- Added a core regression proving an immediate second betrayal scar does not create another proposal after confirmation, while a later source event after cooldown does.
- Packaged MCP description, Skill/protocol docs and architecture notes now state that drift must be source-bound, cooldown-limited, owner-confirmed and unaffected by ordinary renames/tone edits/local prose.

Verification:

- `node --import tsx --test --test-name-pattern "confirmed personality drift starts a cooldown" ../agent-server/test/epoch-game-core.test.ts`: failed first because a second relationship scar immediately produced another `personality_drift_proposed`; passed after source binding and cooldown were added.
- `node --import tsx --test --test-name-pattern "confirmed personality drift starts a cooldown|personality drift|relationship hostility" ../agent-server/test/epoch-game-core.test.ts ../agent-server/test/mcp.test.ts ../agent-server/test/server.test.ts`: passed 6/6.
- `node --import tsx --test --test-name-pattern "confirmed personality drift starts a cooldown|personality drift|relationship hostility|legacy authored-report docs declare|Obsidian Epoch package includes host install docs and smoke playbooks" ../agent-server/test/epoch-game-core.test.ts ../agent-server/test/mcp.test.ts ../agent-server/test/server.test.ts ../agent-server/test/legacyTrustDocs.test.ts ../agent-server/test/packageArchive.test.ts`: passed 8/8.
- `npm run typecheck`: passed from `tools/graph-react-app`, including no JS/MJS/CJS/JSX source, no explicit production `any`, web typecheck and agent-server typecheck.
- `npm run agent:test`: passed 477/477 from `tools/graph-react-app`.
- `npm run agent:ui-test`: passed 137/137 from `tools/graph-react-app`.
- `npm run batch:test`: passed 11/11 from `tools/graph-react-app`.
- `npm run build`: passed from `tools/graph-react-app` and exported `00_总览/黑曜纪元3D世界地图.html`.
- `git diff --check`: passed.
- Direct trailing-whitespace scan over touched files: no output.

Remaining risk:

- The cooldown duration is a fixed MVP server constant. Future tuning may expose it as operator configuration or attach richer source categories, but ordinary clients still cannot choose arbitrary traits or bypass owner confirmation.

## 2026-07-04 Context Diversity Slice

- Closed the S076 context popularity-collapse gap for legacy public context packages.
- `contextSnapshot.settingCards` now carry `category`, `selectionReason`, `weight` and `exposureLevel` metadata alongside id/version/public summary/filtering reasons.
- `contextSnapshot.retrievalParams` now records `diversityPolicy: "high_weight_low_exposure_current_location_mix"` and the selected card categories.
- The snapshot builder now always mixes high-weight public setting, current-location basics derived from anchors or known places, and a low-exposure compliance card.
- Added public location basics for 腐林, 湿谷 and 灰港, plus a low-exposure tree-hole compliance card that reminds agents not to turn old lore into truth/rewards.
- Packaged Skill/protocol docs and architecture notes now describe the diversity metadata and the high-weight/current-location/low-exposure mix.

Verification:

- `node --import tsx --test --test-name-pattern "high-weight low-exposure" ../agent-server/test/context.test.ts`: failed first because `retrievalParams.diversityPolicy` and card categories did not exist; passed after adding diversity metadata and mixed card selection.
- `node --import tsx --test --test-name-pattern "structured public context snapshot|high-weight low-exposure" ../agent-server/test/context.test.ts`: passed 2/2.
- `node --import tsx --test --test-name-pattern "structured public context snapshot|high-weight low-exposure|legacy authored-report docs declare|Obsidian Epoch package includes host install docs and smoke playbooks" ../agent-server/test/context.test.ts ../agent-server/test/legacyTrustDocs.test.ts ../agent-server/test/packageArchive.test.ts`: failed once because TypeScript literal widening and a package-doc regex order were wrong; passed 4/4 after typing `retrievalParams` and fixing the assertion order.
- `npm run typecheck`: passed from `tools/graph-react-app`, including no JS/MJS/CJS/JSX source, no explicit production `any`, web typecheck and agent-server typecheck.
- `npm run agent:test`: passed 478/478 from `tools/graph-react-app`.
- `npm run agent:ui-test`: passed 137/137 from `tools/graph-react-app`.
- `npm run batch:test`: passed 11/11 from `tools/graph-react-app`.
- `npm run build`: passed from `tools/graph-react-app` and exported `00_总览/黑曜纪元3D世界地图.html`.
- `git diff --check`: passed.
- Direct trailing-whitespace scan over touched files: no output.

Remaining risk:

- This is a deterministic MVP mix, not a full retrieval-ranker. It prevents hot-only legacy context by construction, but future work can add exposure counters and seeded random low-exposure rotation once there is a larger setting-card corpus.

## 2026-07-04 User Behavior Red Lines Slice

- Closed the S077 user-values red-line gap for legacy/public context packages.
- Added structured `behaviorRedLines` to agent profiles, including `do_not_betray_allies`, `do_not_harm_civilians` and `do_not_contact_old_gods`.
- Exposed those red lines through `promptLayers.agentIdentityBoundary` and added an effective instruction that triggers require explicit user authorization.
- Added `authorization.userBehaviorRedLines.triggerHandling = "explicit_user_authorization_required"` with the active red-line ids.
- Extended low-priority additional-instruction filtering so attempts to bypass these red lines are rejected with `user_behavior_red_line_requires_authorization` and do not enter effective prompt text.
- Packaged Skill/protocol docs and architecture notes now describe red-line behavior and authorization requirements.

Verification:

- `node --import tsx --test --test-name-pattern "behavior red lines" ../agent-server/test/context.test.ts`: failed first because agent profiles had no `behaviorRedLines`; passed after adding the structured red lines, authorization block and prompt-layer filtering.
- `node --import tsx --test --test-name-pattern "behavior red lines|layers user additions|legacy authored-report docs declare|Obsidian Epoch package includes host install docs and smoke playbooks" ../agent-server/test/context.test.ts ../agent-server/test/legacyTrustDocs.test.ts ../agent-server/test/packageArchive.test.ts`: failed once because the protocol assertion order did not match the doc sentence; passed 4/4 after reordering the protocol sentence.
- `npm run typecheck`: passed from `tools/graph-react-app`, including no JS/MJS/CJS/JSX source, no explicit production `any`, web typecheck and agent-server typecheck.
- `npm run agent:test`: passed 479/479 from `tools/graph-react-app`.
- `npm run agent:ui-test`: passed 137/137 from `tools/graph-react-app`.
- `npm run batch:test`: passed 11/11 from `tools/graph-react-app`.
- `npm run build`: passed from `tools/graph-react-app` and exported `00_总览/黑曜纪元3D世界地图.html`.
- `git diff --check`: passed.
- Direct trailing-whitespace scan over touched files: no output.

Remaining risk:

- This is the MVP prompt/context enforcement path for red lines. Canonical server action options still need separate per-action red-line metadata if future gameplay opens choices that intentionally ask a user to authorize a red-line violation.

## 2026-07-04 Goal Priority Slice

- Closed the S078 goal-conflict gap for legacy/public context packages.
- Added `promptLayers.goalPriority` with the per-run order `safety_boundary` > `user_behavior_red_lines` > `user_mandate` > `agent_long_term_goals` > `opportunistic_side_quests`.
- Added long-term goals to the agent preset so context can explicitly keep agent strategy below the current mandate.
- Kept opportunistic side quests allowed only when non-conflicting.
- Exposed the priority order through packaged Skill/protocol docs and the architecture note so installed hosts see the same conflict contract.

Verification:

- `node --import tsx --test --test-name-pattern "goal priority" ../agent-server/test/context.test.ts`: failed first because `context.promptLayers.goalPriority` was missing; passed after adding the structured priority object and agent long-term goals.
- `node --import tsx --test --test-name-pattern "goal priority|behavior red lines|layers user additions" ../agent-server/test/context.test.ts`: passed 3/3.
- `node --import tsx --test --test-name-pattern "goal priority|behavior red lines|legacy authored-report docs declare|Obsidian Epoch package includes host install docs and smoke playbooks" ../agent-server/test/context.test.ts ../agent-server/test/legacyTrustDocs.test.ts ../agent-server/test/packageArchive.test.ts`: passed 4/4.
- `npm run typecheck`: passed from `tools/graph-react-app`, including no JS/MJS/CJS/JSX source, no explicit production `any`, web typecheck and agent-server typecheck.
- `npm run agent:test`: passed 480/480 from `tools/graph-react-app`.
- `npm run agent:ui-test`: passed 137/137 from `tools/graph-react-app`.
- `npm run batch:test`: passed 11/11 from `tools/graph-react-app`.
- `npm run build`: passed from `tools/graph-react-app` and exported `00_总览/黑曜纪元3D世界地图.html`.
- `git diff --check`: passed.
- Direct trailing-whitespace scan over touched files: no output.

Remaining risk:

- This is the MVP context/prompt priority contract. Future canonical action-option generation should attach the same priority metadata to concrete server-issued choices if gameplay starts offering intentional mandate-vs-long-term-goal tradeoffs.

## 2026-07-04 Multi-Agent Reservation Slice

- Closed the S079 future multi-agent attribution gap for legacy/public context and run tickets.
- Added reserved-only `partyRunId` and `participantRole` input fields to `agent_world.context_package` and `agent_world.start_run`.
- Added `multiAgentReservation.status = "reserved_only"` with `legacyPlayEnabled: false` so authored-report hosts can carry future ownership hints without enabling legacy party play or settlement.
- Added the optional party fields to `contextSnapshot.retrievalParams` and to signed legacy run-capability envelope content so future handoff/replay can trace the reserved party attribution.
- Kept canonical party gameplay on the existing `obsidian_epoch.party_runs` tool family; legacy battle reports still cannot settle party rewards, roles or completion.
- Packaged Skill/protocol docs and architecture notes now describe the reserved-only boundary.

Verification:

- `node --import tsx --test --test-name-pattern "party role fields|world loop for an external agent" ../agent-server/test/context.test.ts ../agent-server/test/mcp.test.ts`: failed first because `multiAgentReservation`, snapshot party fields and ticket party fields were missing; passed after adding the reservation model, ticket/envelope propagation and schema fields.
- `node --import tsx --test --test-name-pattern "party role fields|world loop for an external agent|legacy authored-report docs declare|Obsidian Epoch package includes host install docs and smoke playbooks" ../agent-server/test/context.test.ts ../agent-server/test/mcp.test.ts ../agent-server/test/legacyTrustDocs.test.ts ../agent-server/test/packageArchive.test.ts`: passed 4/4.
- `npm run typecheck`: passed from `tools/graph-react-app`, including no JS/MJS/CJS/JSX source, no explicit production `any`, web typecheck and agent-server typecheck.
- `npm run agent:test`: passed 481/481 from `tools/graph-react-app`.
- `npm run agent:ui-test`: passed 137/137 from `tools/graph-react-app`.
- `npm run batch:test`: passed 11/11 from `tools/graph-react-app`.
- `npm run build`: passed from `tools/graph-react-app` and exported `00_总览/黑曜纪元3D世界地图.html`.
- `git diff --check`: passed.
- Direct trailing-whitespace scan over touched files: no output.

Remaining risk:

- The reserved fields intentionally do not solve party conflict arbitration, shared equipment accounting or multi-agent responsibility splits in the legacy authored-report path. Those remain canonical-party-system concerns and should stay on `obsidian_epoch.party_runs` or later server-settled multi-agent action options.

## 2026-07-04 Agent Self-Statement Meta Guard Slice

- Closed the S080 prompt/meta leakage gap for agent self-statements.
- Added `agentSelfStatement` to `obsidian_epoch.agent_briefing` and the public agent page.
- The statement is server-authored from identity, region and recorded event facts only; request prompt text is ignored.
- Added a fallback guard for prompt/system/rules/model meta terms so self-statements cannot say things like "according to the system prompt".
- Packaged Skill/protocol docs and architecture notes now describe the source whitelist and meta-information ban.

Verification:

- `node --import tsx --test --test-name-pattern "MCP Epoch tools expose server-issued identity|HTTP exposes unified agent briefing" ../agent-server/test/mcp.test.ts ../agent-server/test/server.test.ts`: failed first because HTTP briefing had no `agentSelfStatement`; passed after adding the server-authored statement and public-page rendering.
- `node --import tsx --test --test-name-pattern "MCP Epoch tools expose server-issued identity|HTTP exposes unified agent briefing|legacy authored-report docs declare|Obsidian Epoch package includes host install docs and smoke playbooks" ../agent-server/test/mcp.test.ts ../agent-server/test/server.test.ts ../agent-server/test/legacyTrustDocs.test.ts ../agent-server/test/packageArchive.test.ts`: passed 4/4.
- `npm run typecheck`: passed from `tools/graph-react-app`, including no JS/MJS/CJS/JSX source, no explicit production `any`, web typecheck and agent-server typecheck.
- `npm run agent:test`: passed 481/481 from `tools/graph-react-app`.
- `npm run agent:ui-test`: passed 137/137 from `tools/graph-react-app`.
- `npm run batch:test`: passed 11/11 from `tools/graph-react-app`.
- `npm run build`: passed from `tools/graph-react-app` and exported `00_总览/黑曜纪元3D世界地图.html`.
- `git diff --check`: passed.
- Direct trailing-whitespace scan over touched files: no output.

Remaining risk:

- The MVP self-statement is a fixed server template. A future richer narrator can vary style, but it must keep a server-side source whitelist, meta-term sanitizer and regression fixtures for prompt/system/model leakage.

## 2026-07-04 Community Reaction Status Boundary Slice

- Closed the S081 vote-pressure gap for legacy community reactions.
- Added a machine-readable quick-reaction policy to `agent_world.community_react` results and `agent_world.community_thread` views.
- `reactionPolicy.claimStatusEffect` is always `none`; allowed effects are only `sorting` and `attention`, while `claim_status` and `truth_adjudication` are forbidden effects.
- Added `sortSignals.attentionScore` and copied reaction counts so clients can rank or spotlight disputed objects without treating trusted/可信 or untrusted/不可信 reactions as truth votes.
- Packaged Skill/protocol docs and architecture notes now state that claim status changes still require evidence, review records or authorized reassessment.

Verification:

- `node --import tsx --test --test-name-pattern "quick reactions" ../agent-server/test/community.test.ts`: failed first because community reactions had no `reactionPolicy`; passed after adding the policy and sort signals.
- `node --import tsx --test --test-name-pattern "quick reactions|community reactions" ../agent-server/test/community.test.ts`: passed 2/2.
- `node --import tsx --test --test-name-pattern "quick reactions|legacy authored-report docs declare|Obsidian Epoch package includes host install docs and smoke playbooks" ../agent-server/test/community.test.ts ../agent-server/test/legacyTrustDocs.test.ts ../agent-server/test/packageArchive.test.ts`: passed 3/3.
- `npm run typecheck`: passed from `tools/graph-react-app`, including no JS/MJS/CJS/JSX source, no explicit production `any`, web typecheck and agent-server typecheck.
- `npm run agent:test`: passed 482/482 from `tools/graph-react-app`.
- `npm run agent:ui-test`: passed 137/137 from `tools/graph-react-app`.
- `npm run batch:test`: passed 11/11 from `tools/graph-react-app`.
- `npm run build`: passed from `tools/graph-react-app` and exported `00_总览/黑曜纪元3D世界地图.html`.
- `git diff --check`: passed.
- Direct trailing-whitespace scan over touched files: no output.

Remaining risk:

- The MVP exposes the boundary and ranking signals but does not yet build a dedicated public UI ordering algorithm around `attentionScore`. Future UI work can use that score for queueing/spotlighting, but must keep it outside claim status migration.

## 2026-07-04 Lore Revision Rights Boundary Slice

- Closed the S082 high-reputation rewrite gap for canonical lore revision contributions.
- Added `revisionMode` for revision contributions with the four allowed modes `suggestion`, `derived`, `merge` and `downgrade`.
- Explicitly rejects `revisionMode: "direct_edit"` with `lore_revision_direct_edit_forbidden`.
- Revision records now carry `revisionPolicy` with `originalClaimMutable: false`, allowed modes, review requirement and `claimTextEffect` as either `proposal_only` or `derived_version`.
- Non-original explorers can still contribute evidence-backed suggestions, derived versions, merge proposals or downgrade proposals, but cannot rewrite another explorer's original claim text.
- Packaged Skill/protocol docs and architecture notes now describe the revision boundary.

Verification:

- `node --import tsx --test --test-name-pattern "MCP records server-authoritative lore contributions" ../agent-server/test/mcp.test.ts`: failed first because a non-original explorer could submit `revisionMode: "direct_edit"` without rejection; passed after adding revision modes, policy records and direct-edit rejection.
- `node --import tsx --test --test-name-pattern "MCP records server-authoritative lore contributions|Obsidian Epoch package includes host install docs and smoke playbooks" ../agent-server/test/mcp.test.ts ../agent-server/test/packageArchive.test.ts`: passed 2/2.
- `npm run typecheck`: passed from `tools/graph-react-app`, including no JS/MJS/CJS/JSX source, no explicit production `any`, web typecheck and agent-server typecheck.
- `npm run agent:test`: passed 482/482 from `tools/graph-react-app`.
- `npm run agent:ui-test`: passed 137/137 from `tools/graph-react-app`.
- `npm run batch:test`: passed 11/11 from `tools/graph-react-app`.
- `npm run build`: passed from `tools/graph-react-app` and exported `00_总览/黑曜纪元3D世界地图.html`.
- `git diff --check`: passed.
- Direct trailing-whitespace scan over touched files: no output.

Remaining risk:

- The MVP records merge and downgrade as review-required proposals; it does not yet implement a richer operator workflow for accepting a merge/downgrade into a final target adjudication. That acceptance remains on the existing operator-gated `adjudicate_lore_target` path.

## 2026-07-04 Dispute Retaliation Detection Slice

- Closed the S083 visible-retaliation gap for legacy community dispute reactions.
- Community reactions now detect dispute abuse over a short review window:
  - `bidirectional_retaliation` when two explorers refute/challenge each other.
  - `short_burst_objections` when one explorer rapidly objects to the same target explorer across multiple claims.
  - `group_pile_on` when three explorers from the same group pile onto the same claim or target explorer.
- Triggered dispute reactions are returned with `visibility: "hidden_pending_review"`, `reviewStatus: "queued"` and `disputeAbuseFlags`.
- Each hidden dispute reaction creates a queued `dispute_abuse:*` moderation item, and thread reads expose `disputeAbuseSummary`.
- Packaged Skill/protocol docs and architecture notes now describe that suspicious dispute pressure is hidden before review.

Verification:

- `node --import tsx --test --test-name-pattern "dispute reactions" ../agent-server/test/community.test.ts`: failed first because dispute reactions had no hidden/review status or abuse flags; passed after adding detection and queueing.
- `node --import tsx --test --test-name-pattern "dispute reactions|community reactions|quick reactions" ../agent-server/test/community.test.ts`: passed 3/3.
- `node --import tsx --test --test-name-pattern "dispute reactions|Obsidian Epoch package includes host install docs and smoke playbooks" ../agent-server/test/community.test.ts ../agent-server/test/packageArchive.test.ts`: passed 2/2.
- `npm run typecheck`: passed from `tools/graph-react-app`, including no JS/MJS/CJS/JSX source, no explicit production `any`, web typecheck and agent-server typecheck.
- `npm run agent:ui-test`: passed 137/137 from `tools/graph-react-app`.
- `npm run batch:test`: passed 11/11 from `tools/graph-react-app`.
- `npm run build`: passed from `tools/graph-react-app` and exported `00_总览/黑曜纪元3D世界地图.html`.
- `npm run agent:test`: failed once because the protocol package regex expected the new dispute-abuse wording before the outbox section; passed 483/483 after adding the same wording to the legacy submit paragraph.
- `git diff --check`: passed.
- Direct trailing-whitespace scan over touched files: no output.

Remaining risk:

- This MVP detection runs inside the legacy community reaction ledger and hides the triggering reaction. A future canonical dispute-court workflow can add durable relationship graphs, longer windows and operator resolution outcomes, but should keep visible evaluation pressure hidden while review is pending.

## 2026-07-04 Lore Lineage Folding Slice

- Closed the S084 over-complex source-signature gap for lore target status cards.
- Added `lineageDisplay` to lore target status rows returned by `obsidian_epoch.lore_targets` and world overview target-status data.
- Default setting-card/status views can show `originAgentId`, optional `originExplorerId` / `originIdentityName` and `currentStatus` without listing every confirmer, refuter or reviser inline.
- Confirmation/refutation/revision lineage remains folded behind `foldedContributionCounts` / `foldedContributionCount`, with `expandedTool: "obsidian_epoch.lore_contributions"` naming the drill-down path.
- Packaged Skill/protocol docs and architecture notes now describe the compact lineage-display contract.

Verification:

- `node --import tsx --test --test-name-pattern "MCP records server-authoritative lore contributions" ../agent-server/test/mcp.test.ts`: failed first because lore target rows had no `lineageDisplay`; passed after adding the compact lineage read model.
- `node --import tsx --test --test-name-pattern "MCP records server-authoritative lore contributions|Obsidian Epoch package includes host install docs and smoke playbooks" ../agent-server/test/mcp.test.ts ../agent-server/test/packageArchive.test.ts`: passed 2/2.
- `npm run typecheck`: passed from `tools/graph-react-app`, including no JS/MJS/CJS/JSX source, no explicit production `any`, web typecheck and agent-server typecheck.
- `npm run agent:test`: first full run hit `json_rpc_timeout:initialize` in the bundled MCP proxy extraction test; the focused failing test then passed, and a fresh full rerun passed 483/483 from `tools/graph-react-app`.
- `npm run agent:ui-test`: passed 137/137 from `tools/graph-react-app`.
- `npm run batch:test`: passed 11/11 from `tools/graph-react-app`.
- `npm run build`: passed from `tools/graph-react-app` and exported `00_总览/黑曜纪元3D世界地图.html`.

Remaining risk:

- This MVP is a compact read-model contract. Future UI setting cards can render the folded lineage visually and add pagination/search for expanded contribution history, but should keep the default display limited to origin and current status.

## 2026-07-04 Failed Report Publication Granularity Slice

- Closed the S085 failure-report embarrassment gap in the legacy authored-report lane.
- Failed reports now get a server-derived `failurePublication` policy with the allowed modes `anonymous_public`, `claim_only` and `personal_sealed`.
- The default mode is `personal_sealed`, so a failed report with `visibility: "public"` no longer enters `agent_world.public_world` by accident.
- `anonymous_public` publishes an archive row with explorer/agent identity redacted and grants `失败回流信用 +2`.
- `claim_only` publishes only `claimPreview`, also redacts explorer/agent identity and grants `失败回流信用 +1`.
- Public world archive rows and legacy world-index outbox summaries follow the same failure redaction policy.
- Packaged Skill/protocol docs and architecture notes now describe the failure-publication modes and reward gradient.

Verification:

- `node --import tsx --test --test-name-pattern "failed battle reports honor publication granularity" ../agent-server/test/mcp.test.ts`: failed first because failed report adjudication had no `failurePublication`; passed after adding the policy, feedback rewards, archive filtering and public identity redaction.
- `node --import tsx --test --test-name-pattern "failed battle reports honor publication granularity|Obsidian Epoch package includes host install docs and smoke playbooks" ../agent-server/test/mcp.test.ts ../agent-server/test/packageArchive.test.ts`: passed 2/2.
- `npm run typecheck`: failed first on a narrow inferred redaction object and a missing progression `explorerId` variable; passed after annotating the redaction object and restoring the internal progression identity field.
- `npm run agent:test`: first full run failed on the new package regex ordering; package focused passed after clarifying the packaged Skill wording, and a fresh full rerun passed 484/484 from `tools/graph-react-app`.
- `npm run agent:ui-test`: passed 137/137 from `tools/graph-react-app`.
- `npm run batch:test`: passed 11/11 from `tools/graph-react-app`.
- `npm run build`: passed from `tools/graph-react-app` and exported `00_总览/黑曜纪元3D世界地图.html`.

Remaining risk:

- This MVP protects the legacy authored-report archive/read-model surface. A future UI can expose the three choices before submission and add richer private repair assets, but it should keep sealed failures out of public archive/outbox summaries unless the user explicitly selects a public failure mode.

## 2026-07-04 Real IP Similarity Moderation Slice

- Closed the S086 real IP/work similarity gap for shared-world admission.
- Added a small dependency-free `ipSimilarity` MVP gate with NFKC normalization, known IP/work aliases, exact containment and near-alias matching.
- Faction proposals now screen name, setting, goal and conflict boundary before trial admission; suspected proposals return `moderation_hold` with `reason: "real_ip_similarity"` and do not enter the faction ledger.
- NPC/character candidates now screen display name and story evidence before canonicalization; suspected candidates emit only `npc_candidate_submitted`, carry `reviewLevel: "moderation_hold"`, `real_ip_similarity` and `ipSimilarity`, and do not create canonical NPC state.
- Operator review can promote or reject both `rejected_flavor` and `moderation_hold` candidates; unreviewed holds stay in private memory rather than confirmed memory.
- Operator overview now counts `moderationHold` NPC candidate rows alongside watch/blocked review rows.
- Packaged Skill/protocol docs and architecture notes now state that faction, character/NPC and location names are screened before shared-world admission.

Verification:

- `node --import tsx --test --test-name-pattern "real IP-similar faction names|NPC candidates are submitted" ../agent-server/test/factions.test.ts ../agent-server/test/epoch-game-core.test.ts`: failed first because faction proposals still entered `trial` and IP-similar NPCs still canonicalized; passed after adding the shared IP gate.
- `node --import tsx --test --test-name-pattern "real IP-similar faction names|NPC candidates are submitted|MCP submits story NPC candidates" ../agent-server/test/factions.test.ts ../agent-server/test/epoch-game-core.test.ts ../agent-server/test/mcp.test.ts`: passed 3/3.
- `node --import tsx --test --test-name-pattern "Obsidian Epoch downloadable package contains skill and plugin manifests" ../agent-server/test/packageArchive.test.ts`: passed 1/1.
- `npm run typecheck`: failed first because the faction red test accessed optional `ipSimilarity` without narrowing; passed after adding the assertion guard.
- `npm run agent:test`: passed 485/485 from `tools/graph-react-app`.
- `npm run agent:ui-test`: passed 137/137 from `tools/graph-react-app`.
- `npm run batch:test`: passed 11/11 from `tools/graph-react-app`.
- `npm run build`: passed from `tools/graph-react-app` and exported `00_总览/黑曜纪元3D世界地图.html`.

Remaining risk:

- The MVP catalog is intentionally small and deterministic. It blocks obvious renamed IP/work references before shared admission, but a future production gate should replace or extend the alias list with richer moderation sources and operator review tooling for location/faction name intake.

## 2026-07-04 Publish Authorship Confirmation Slice

- Closed the S087 publication-consent gap for result-page publishing.
- Added the exact short confirmation copy beside all Web Agent Console result publish buttons: “故事署名归你；入档发现会成为共享世界资料，可被他人引用。”
- Covered resolved turn result publishing, Web LLM bridge result publishing and generic result-link creation with one shared `RESULT_PUBLISH_AUTHORIZATION_COPY` constant.
- Packaged Skill/protocol docs now require installed hosts to show the same short confirmation before `obsidian_epoch.create_result_page`.
- Architecture notes now record this as a user-facing publication notice beside the publish control, separate from canonical server admission/review.

Verification:

- `node --import tsx --test --test-name-pattern "short authorship confirmation" src/agent/AgentExplorer.layout.test.ts`: failed first because no result publish button showed the required copy; passed after adding the shared UI copy.
- `node --import tsx --test --test-name-pattern "short authorship confirmation|Obsidian Epoch downloadable package contains skill and plugin manifests" src/agent/AgentExplorer.layout.test.ts ../agent-server/test/packageArchive.test.ts`: passed 2/2.
- `npm run typecheck`: passed from `tools/graph-react-app`, including no JS/MJS/CJS/JSX source, no explicit production `any`, web typecheck and agent-server typecheck.
- `npm run agent:test`: passed 485/485 from `tools/graph-react-app`.
- `npm run agent:ui-test`: passed 138/138 from `tools/graph-react-app`.
- `npm run batch:test`: passed 11/11 from `tools/graph-react-app`.
- `npm run build`: passed from `tools/graph-react-app` and exported `00_总览/黑曜纪元3D世界地图.html`.
- `git diff --check`: passed with no whitespace errors.
- Touched-file trailing whitespace scan: no matches.

Remaining risk:

- This slice adds the required short confirmation next to publish controls and host docs. It does not add a blocking checkbox; future higher-risk public-share flows can add explicit acknowledgements if legal/product wants a stronger gate than adjacent copy.

## 2026-07-04 Deletion Request Classification Slice

- Closed the S088 deletion-classification gap for owner result-page deletion requests.
- `obsidian_epoch.delete_result_page` now classifies deletion requests and executes only the `hide_body` category for result-page bodies.
- Deleted result-page tombstones keep `deletionSummary.deletionRequest` with the four MVP categories:
  - `hide_body`
  - `anonymize_source`
  - `withdraw_unadmitted_candidate`
  - `request_de_admission_review`
- The classification explicitly states that shared settings referenced by multiple people can only request 退档复审 instead of being deleted with the public body.
- HTTP and MCP delete-result responses both return the classification, and JSONL tombstones persist it with the minimal audit facts.
- Packaged Skill/protocol docs and architecture notes now explain that result-page deletion is classified rather than blanket erasure.

Verification:

- `node --import tsx --test --test-name-pattern "MCP delete result page separates body archive" ../agent-server/test/mcp.test.ts`: failed first because `deletionRequest` was missing; passed after adding deletion classification to tombstones.
- `node --import tsx --test --test-name-pattern "MCP delete result page separates body archive|HTTP delete result page persists only a tombstone summary|Obsidian Epoch downloadable package contains skill and plugin manifests" ../agent-server/test/mcp.test.ts ../agent-server/test/server.test.ts ../agent-server/test/packageArchive.test.ts`: passed 3/3.
- `npm run typecheck`: passed from `tools/graph-react-app`, including no JS/MJS/CJS/JSX source, no explicit production `any`, web typecheck and agent-server typecheck.
- `npm run agent:test`: passed 485/485 from `tools/graph-react-app`.
- `npm run agent:ui-test`: passed 138/138 from `tools/graph-react-app`.
- `npm run batch:test`: passed 11/11 from `tools/graph-react-app`.
- `npm run build`: passed from `tools/graph-react-app` and exported `00_总览/黑曜纪元3D世界地图.html`.
- `git diff --check`: passed with no whitespace errors.
- Touched-file trailing whitespace scan: no matches.

Remaining risk:

- This is an MVP classification/read-model layer. It does not yet implement standalone source-anonymization, candidate-withdrawal or 退档复审 workflows; those should become dedicated operator/owner routes rather than overloading public body deletion.

## 2026-07-04 Custom TTS Sharing Boundary Slice

- Closed the S089 custom TTS sharing-rights gap.
- Experience state now exposes `tts.sharePolicy` for the selected voice:
  - `system_default` uses `publicSharing: "system_voice_allowed"`.
  - Non-system/custom voices use `publicSharing: "requires_voice_rights_confirmation"`.
  - All custom TTS follows `customTtsHosting: "not_hosted"` by default.
- Voice profile selection now returns the same `sharePolicy`, so hosts can show the confirmation before any public voice share.
- The confirmation copy states that public sharing requires confirming the user owns the voice/音色 usage rights and that the platform does not host custom TTS artifacts by default.
- Packaged Skill/protocol docs and architecture notes now tell installed hosts not to upload, store, package or publicly publish custom/imitative voice artifacts without explicit rights confirmation.

Verification:

- `node --import tsx --test --test-name-pattern "custom TTS public sharing" ../agent-server/test/experience.test.ts`: failed first because selected voice results had no `sharePolicy`; passed after adding the TTS sharing policy.
- `node --import tsx --test --test-name-pattern "custom TTS public sharing|Obsidian Epoch downloadable package contains skill and plugin manifests" ../agent-server/test/experience.test.ts ../agent-server/test/packageArchive.test.ts`: passed 2/2.
- `npm run typecheck`: failed first because the selected voice test accessed optional `sharePolicy` without narrowing; passed after adding the assertion guard.
- `npm run agent:test`: passed 486/486 from `tools/graph-react-app`.
- `npm run agent:ui-test`: passed 138/138 from `tools/graph-react-app`.
- `npm run batch:test`: passed 11/11 from `tools/graph-react-app`.
- `npm run build`: passed from `tools/graph-react-app` and exported `00_总览/黑曜纪元3D世界地图.html`.

Remaining risk:

- This MVP exposes policy and confirmation text but does not implement a full public audio upload/share workflow. Future custom TTS publishing should make rights confirmation an explicit blocking input and keep custom artifacts off platform hosting unless that policy changes.

## 2026-07-04 Content Policy Configuration Slice

- Closed the S090 content-policy configurability gap for content rating and public sharing.
- Added a configurable `contentPolicy` resolver with a built-in global fallback and `AGENT_WORLD_CONTENT_POLICY_JSON` per-region overrides.
- `obsidian_epoch.quickstart` now accepts `contentPolicyRegion` / `regionCode`, returns the resolved `contentPolicy`, and includes the selected region in `hostConfig.env`.
- The policy response exposes:
  - `ageRating`
  - `contentWarnings`
  - `publicSharing`
  - moderation defaults for public-message review, real-IP similarity and deleted result-page bodies
  - `source` showing whether a configured region or default-region fallback was used
- Packaged Skill/protocol docs and architecture notes now tell installed hosts to read `quickstart.contentPolicy` instead of hardcoding one region's content warnings or public-share policy into product copy.

Verification:

- `node --import tsx --test --test-name-pattern "MCP tool registry" ../agent-server/test/mcp.test.ts`: failed first because quickstart had no `contentPolicy`; passed after adding the configurable resolver and quickstart integration.
- `node --import tsx --test --test-name-pattern "Obsidian Epoch downloadable package contains skill and plugin manifests" ../agent-server/test/packageArchive.test.ts`: failed first because package docs did not mention configurable content policy; passed after updating Skill/protocol docs.
- `npm run typecheck`: passed from `tools/graph-react-app`, including no JS/MJS/CJS/JSX source, no explicit production `any`, web typecheck and agent-server typecheck.
- `npm run agent:test`: passed 486/486 from `tools/graph-react-app`.
- `npm run agent:ui-test`: passed 138/138 from `tools/graph-react-app`.
- `npm run batch:test`: passed 11/11 from `tools/graph-react-app`.
- `npm run build`: passed from `tools/graph-react-app` and exported `00_总览/黑曜纪元3D世界地图.html`.
- `git diff --check`: passed with no whitespace errors.
- Touched-file trailing whitespace scan: no matches.

Remaining risk:

- This is an MVP policy surface. It proves region-specific configuration and fallback behavior, but it does not encode full jurisdictional law tables; production deployments must provide reviewed `AGENT_WORLD_CONTENT_POLICY_JSON` entries for their target regions.

## 2026-07-04 Fine-Grained Operation Switch Slice

- Closed the S091 operations-switch granularity gap.
- Added `operationSwitches` configuration through `AGENT_WORLD_OPERATION_SWITCHES_JSON` and runtime `operationSwitches` options.
- Switches can pause the MVP operation actions independently:
  - `settlement`
  - `public_sharing`
  - `source_reward`
- Switches can match by:
  - `rewardType`
  - `commissionType`
  - `chapterId`
  - `locationId`
  - `factionId`
  - `riskLevel`
- Legacy authored-report settlement now rejects matching paused settlement with `operation_settlement_paused`.
- Epoch result-page creation now rejects matching paused public sharing with `operation_public_sharing_paused`.
- Claim-reuse source rewards now check `source_reward` + `rewardType: "claim_reuse"` before creating or releasing rewards, so one source-reward family can be paused without stopping all settlement.
- `agent_world.operation_check` now returns `operationSwitch` so hosts can preflight the same pause gate.
- Packaged Skill/protocol docs and architecture notes describe the switch config, actions and dimensions.

Verification:

- `node --import tsx --test --test-name-pattern "operation switches" ../agent-server/test/mcp.test.ts`: failed first because operation switches were ignored; passed after adding the registry and runtime gates.
- `node --import tsx --test --test-name-pattern "Obsidian Epoch downloadable package contains skill and plugin manifests" ../agent-server/test/packageArchive.test.ts`: failed first because package docs did not mention operation switches; passed after updating Skill/protocol docs.
- `npm run typecheck`: failed first on a risk-level narrowing issue; passed after tightening the legacy risk filter, including no JS/MJS/CJS/JSX source, no explicit production `any`, web typecheck and agent-server typecheck.
- `npm run agent:test`: passed 489/489 from `tools/graph-react-app`.
- `npm run agent:ui-test`: passed 138/138 from `tools/graph-react-app`.
- `npm run batch:test`: passed 11/11 from `tools/graph-react-app`.
- `npm run build`: passed from `tools/graph-react-app` and exported `00_总览/黑曜纪元3D世界地图.html`.

Remaining risk:

- This MVP covers the three required operation actions and exposes the requested dimensions as exact-match filters. It does not yet thread every dimension through every future Epoch write path; new reward/commission families should pass their own dimensions into the same gate rather than adding bespoke pause booleans.

## 2026-07-04 Review Status Visibility Slice

- Closed the S092 delayed-review visibility gap.
- Delayed legacy authored-report responses now expose `reviewStatus` at the top level and on `reviewQueue`.
- `agent_world.review_queue` entries expose the same `reviewStatus`, and `summary.visibleStages` lists the user-facing review phases:
  - `排队中`
  - `规则校验`
  - `轻审`
  - `重审`
  - `人工`
  - `完成`
- Delayed entries currently report `currentStage: "queued"` / `currentStageLabel: "排队中"`.
- `estimatedWait` exposes a position-derived interval in minutes; the first queue position is `5-15 分钟`.
- Settled and duplicate-settled legacy submit responses expose `reviewStatus` with the completed stage.
- Packaged Skill/protocol docs and architecture notes describe the visible status and estimated wait interval.

Verification:

- `node --import tsx --test --test-name-pattern "MCP delays legacy review over rank length budget" ../agent-server/test/mcp.test.ts`: failed first because delayed review entries had no `reviewStatus`; passed after adding stages and wait estimates.
- `node --import tsx --test --test-name-pattern "Obsidian Epoch downloadable package contains skill and plugin manifests" ../agent-server/test/packageArchive.test.ts`: failed first because package docs did not mention `reviewStatus`; passed after updating Skill/protocol docs.
- `npm run typecheck`: passed from `tools/graph-react-app`, including no JS/MJS/CJS/JSX source, no explicit production `any`, web typecheck and agent-server typecheck.
- `npm run agent:test`: passed 489/489 from `tools/graph-react-app`.
- `npm run agent:ui-test`: passed 138/138 from `tools/graph-react-app`.
- `npm run batch:test`: passed 11/11 from `tools/graph-react-app`.
- `npm run build`: passed from `tools/graph-react-app` and exported `00_总览/黑曜纪元3D世界地图.html`.
- `git diff --check`: passed with no whitespace errors.
- Touched-file trailing whitespace scan: no matches.

Remaining risk:

- This is an MVP status projection over the existing delayed queue. It does not yet implement active transitions through every review stage; future asynchronous workers should update the same `reviewStatus.currentStage` contract rather than replacing it.

## 2026-07-04 Growth Quality Guardrails Slice

- Closed the S093 growth-metric quality guardrail gap.
- `obsidian_epoch.operator_overview` now returns `growthQuality` with the contract `growth_metrics_must_ship_with_quality_guardrails`.
- `growthQuality.requiredGuardrails` defines and reports current values for:
  - `valid_setting_rate`
  - `return_rate`
  - `duplicate_rate`
  - `core_vibe_score`
  - `abuse_rate`
- `growthQuality.growthMetrics` currently exposes active identity count, hosted action count, party-run count and 二局率.
- Every growth metric carries the full `qualityGuardrails` key list so operators cannot read growth metrics without the anti-Goodhart guardrails beside them.
- The guardrail values are derived from server projections: lore contributions/adjudications, NPC candidate review, moderation queue, abuse profiles, risk audit events, identity projection and participation events.
- Packaged Skill/protocol docs and architecture notes describe the growth-quality contract and the required guardrail keys.

Verification:

- `node --import tsx --test --test-name-pattern "MCP operator overview aggregates moderation abuse and market risk" ../agent-server/test/mcp.test.ts`: failed first because `overview.growthQuality` was missing; passed after adding the overview projection.
- `node --import tsx --test --test-name-pattern "Obsidian Epoch downloadable package contains skill and plugin manifests" ../agent-server/test/packageArchive.test.ts`: failed first because package docs did not mention `growthQuality`; passed after updating Skill/protocol docs.
- `npm run typecheck`: passed from `tools/graph-react-app`, including no JS/MJS/CJS/JSX source, no explicit production `any`, web typecheck and agent-server typecheck.
- `npm run agent:test`: passed 489/489 from `tools/graph-react-app`.
- `npm run agent:ui-test`: passed 138/138 from `tools/graph-react-app`.
- `npm run batch:test`: passed 11/11 from `tools/graph-react-app`.
- `npm run build`: passed from `tools/graph-react-app` and exported `00_总览/黑曜纪元3D世界地图.html`.

Remaining risk:

- This MVP defines and binds the required quality guardrails in the operator overview. It does not yet render a dedicated web chart for the growth-quality panel, and the exact scoring weights for `core_vibe_score` may need future calibration from live operations data.

## 2026-07-04 Experimental Artifact Main-Rule Review Slice

- Closed the S094 experiment-artifact review gap.
- Experimental shared-setting artifacts now carry `experimentId` when supplied.
- Experimental lore contributions and NPC candidates must also carry `mainRuleReview.status: "passed"` plus a current `rulesetVersion`; missing or non-passing review fails with `experiment_main_rule_review_required`.
- Accepted experimental lore contribution records retain `experimentId` and `mainRuleReview`, and include them in the claim hash so experiment and mainline evidence cannot be confused.
- Accepted experimental NPC candidate records retain `experimentId` and `mainRuleReview` in the event payload and projection.
- `obsidian_epoch.record_lore_contribution` and `obsidian_epoch.submit_npc_candidate` schemas now expose `experimentId` and `mainRuleReview`.
- Packaged Skill/protocol docs and architecture notes describe the gray-experiment review rule.

Verification:

- `node --import tsx --test --test-name-pattern "MCP experimental shared-setting artifacts require current main-rule review" ../agent-server/test/mcp.test.ts`: failed first because experimental lore writes were accepted without review; passed after adding the review gate and projection fields.
- `node --import tsx --test --test-name-pattern "Obsidian Epoch downloadable package contains skill and plugin manifests" ../agent-server/test/packageArchive.test.ts`: failed first because package docs did not mention `experimentId` / `mainRuleReview`; passed after updating Skill/protocol docs.
- `npm run typecheck`: passed from `tools/graph-react-app`, including no JS/MJS/CJS/JSX source, no explicit production `any`, web typecheck and agent-server typecheck.
- `npm run agent:test`: passed 490/490 from `tools/graph-react-app`.
- `npm run agent:ui-test`: passed 138/138 from `tools/graph-react-app`.
- `npm run batch:test`: passed 11/11 from `tools/graph-react-app`.
- `npm run build`: passed from `tools/graph-react-app` and exported `00_总览/黑曜纪元3D世界地图.html`.

Remaining risk:

- This MVP protects the two current shared-setting entry points (`record_lore_contribution` and `submit_npc_candidate`). Future experimental write paths that can promote shared-world facts should call the same review gate rather than inventing separate experiment flags.

## 2026-07-04 Frontstage Circuit-Breaker Status Slice

- Closed the S095 foreground circuit-breaker visibility gap.
- Added `frontstageStatus` with `mode`, `worldAnnouncement`, `allowedActions`, `blockedActions` and `circuitBreakerActive`.
- Operators can configure the status with `AGENT_WORLD_FRONTSTAGE_STATUS_JSON`; `mode: "read_only_maintenance"` shows `档案馆审档暂停/只读维护`.
- The resolver preserves the data-safety copy: maintenance announcements keep `数据没有丢失` visible and say local-only play/sealing remains available.
- `obsidian_epoch.quickstart`, `agent_world.operation_check` and `/api/epoch/install-status` now expose the same frontstage status.
- `agent_world.archive_local_report` remains available during frontstage maintenance and now returns explicit `mode: "local_trial_archive"`.
- The Web Agent Console player watch board displays the frontstage announcement before the status lights, including 本地试玩 / 本地封存 affordances.
- Packaged Skill/protocol docs and architecture notes describe the status layer and its boundary with operation switches.

Verification:

- `node --import tsx --test --test-name-pattern "frontstage circuit-breaker" ../agent-server/test/mcp.test.ts`: failed first because `quickstart.frontstageStatus` was missing; passed after adding the resolver and MCP exposure.
- `node --import tsx --test --test-name-pattern "frontstage circuit-breaker" src/agent/AgentExplorer.layout.test.ts`: failed first because the player watch board did not render `frontstageStatus`; passed after adding the status strip.
- `node --import tsx --test ../agent-server/test/packageArchive.test.ts`: failed first because package docs did not mention `frontstageStatus`; passed after updating Skill/protocol docs.
- `npm run typecheck`: passed from `tools/graph-react-app`, including no JS/MJS/CJS/JSX source, no explicit production `any`, web typecheck and agent-server typecheck.
- `npm run agent:test`: passed 491/491 from `tools/graph-react-app`.
- `npm run agent:ui-test`: passed 139/139 from `tools/graph-react-app`.
- `npm run batch:test`: passed 11/11 from `tools/graph-react-app`.
- `npm run build`: passed from `tools/graph-react-app` and exported `00_总览/黑曜纪元3D世界地图.html`.
- `git diff --check`: passed with no whitespace errors.
- Touched-file trailing whitespace scan: no matches.

Remaining risk:

- This MVP is a foreground announcement and status contract. It does not by itself pause every canonical write path; those hard gates remain the responsibility of operation switches and server authority checks.

## 2026-07-04 Strict Serial Round Field Check Slice

- Closed the S096 verification-artifact gap.
- Added `scripts/check-strict-serial-validation.ts` as a mechanical audit for the strict serial validation report.
- The checker parses every `### Round NNN` block and requires the four fields:
  - `当前基线`
  - `攻击`
  - `判定`
  - `立即处置`
- The real strict serial validation report currently passes with 100 rounds and zero missing-field failures.
- The checker reports missing fields with stable errors such as `strict_serial_round_fields_missing:001:立即处置`.
- `npm run typecheck` now runs `npm run check:strict-serial-validation`, so the field audit is part of the standard verification gate.
- Architecture verification gates now document this strict serial report requirement.

Verification:

- `node --import tsx --test ../agent-server/test/strictSerialValidation.test.ts`: failed first because `scripts/check-strict-serial-validation.ts` did not exist; passed after adding the checker and package script.
- `npm run check:strict-serial-validation`: passed and reported `strict serial validation round field check passed: 100 rounds`.
- `npm run typecheck`: passed from `tools/graph-react-app`, including no JS/MJS/CJS/JSX source, no explicit production `any`, the new strict serial validation check, web typecheck and agent-server typecheck.
- `npm run agent:test`: passed 494/494 from `tools/graph-react-app`.
- `npm run agent:ui-test`: passed 139/139 from `tools/graph-react-app`.
- `npm run batch:test`: passed 11/11 from `tools/graph-react-app`.
- `npm run build`: passed from `tools/graph-react-app` and exported `00_总览/黑曜纪元3D世界地图.html`.

Remaining risk:

- This checker enforces field presence, not semantic quality. S097/S098 continue the mechanical checks for S-number consistency and exact Round numbering.

## 2026-07-04 Strict Serial S-Number Consistency Slice

- Closed the S097 verification-artifact gap.
- Extended `scripts/check-strict-serial-validation.ts` to compare S-number coverage between the strict serial validation report and spec section 31.
- The checker now extracts unique `SNNN` ids from the strict report and compares them against `#### SNNN` headings under `## 31. 严格串行验证逐轮修订`.
- The real documents currently pass with:
  - 100 strict S numbers
  - 100 spec S numbers
  - no `missingInSpec`
  - no `missingInStrict`
- Mismatches raise stable errors such as `strict_serial_s_numbers_mismatch:missing_in_spec=S002;missing_in_strict=none`.
- The same `npm run check:strict-serial-validation` gate now covers both S096 field presence and S097 S-number consistency.
- Architecture verification gates now document both checks.

Verification:

- `node --import tsx --test ../agent-server/test/strictSerialValidation.test.ts`: failed first because the S-number consistency exports did not exist; passed after extending the checker.
- `npm run check:strict-serial-validation`: passed and reported `strict serial validation check passed: 100 rounds, 100 strict S numbers, 100 spec S numbers`.
- `npm run typecheck`: passed from `tools/graph-react-app`, including no JS/MJS/CJS/JSX source, no explicit production `any`, strict serial field/S-number checks, web typecheck and agent-server typecheck.
- `npm run agent:test`: passed 496/496 from `tools/graph-react-app`.
- `npm run agent:ui-test`: passed 139/139 from `tools/graph-react-app`.
- `npm run batch:test`: passed 11/11 from `tools/graph-react-app`.
- `npm run build`: passed from `tools/graph-react-app` and exported `00_总览/黑曜纪元3D世界地图.html`.

Remaining risk:

- This checker compares membership, not contiguous numbering order. S098 covers exact Round numbering and can also carry stricter sequence assertions.

## 2026-07-04 Strict Serial Round Numbering Slice

- Closed the S098 verification-artifact gap.
- Extended `scripts/check-strict-serial-validation.ts` to require exactly 100 strict serial validation round headings.
- The checker now parses `### Round NNN` headings and verifies:
  - total round count is 100
  - `Round 001` exists
  - `Round 100` exists
- The real strict serial validation report currently passes with 100 rounds and both boundary rounds present.
- Numbering failures raise stable errors such as `strict_serial_round_numbering_invalid:round_count_mismatch:1;round_100_missing`.
- The same `npm run check:strict-serial-validation` gate now covers S096 field presence, S097 S-number consistency and S098 exact Round numbering.
- Architecture verification gates now document the exact Round count and boundary-round requirement.

Verification:

- `node --import tsx --test ../agent-server/test/strictSerialValidation.test.ts`: failed first because the Round-numbering exports did not exist; passed after extending the checker.
- `npm run check:strict-serial-validation`: passed and reported `strict serial validation check passed: 100 rounds, 100 strict S numbers, 100 spec S numbers`.
- `npm run typecheck`: passed from `tools/graph-react-app`, including no JS/MJS/CJS/JSX source, no explicit production `any`, strict serial field/S-number/Round-numbering checks, web typecheck and agent-server typecheck.
- `npm run agent:test`: passed 498/498 from `tools/graph-react-app`.
- `npm run agent:ui-test`: passed 139/139 from `tools/graph-react-app`.
- `npm run batch:test`: passed 11/11 from `tools/graph-react-app`.
- `npm run build`: passed from `tools/graph-react-app` and exported `00_总览/黑曜纪元3D世界地图.html`.

Remaining risk:

- This checker enforces count and boundary existence. It does not yet scan unfinished-marker wording; S099 covers that completion blocker.

## 2026-07-04 Strict Serial Completion Marker Check Slice

- Closed the S099 verification-artifact gap.
- Extended `scripts/check-strict-serial-validation.ts` to scan strict serial completion artifacts for unfinished marker tokens.
- The checker scans the strict serial validation report and spec section 31 for:
  - `TODO`
  - `FIXME`
  - `TBD`
  - `XXX`
  - `待办`
  - `待实现`
  - `未实现`
  - `占位`
  - `placeholder`
  - `not implemented`
- The real documents currently pass with `0 unfinished markers`.
- Marker findings raise stable errors such as `strict_serial_completion_markers_found:strict_report:TODO:6;strict_report:placeholder:6;spec_section_31:待实现:5`.
- The same `npm run check:strict-serial-validation` gate now covers S096 field presence, S097 S-number consistency, S098 exact Round numbering and S099 unfinished-marker blocking.
- Architecture verification gates now document the unfinished-marker scan.

Verification:

- `node --import tsx --test ../agent-server/test/strictSerialValidation.test.ts`: failed first because the completion-marker exports did not exist; passed after extending the checker.
- `npm run check:strict-serial-validation`: passed and reported `strict serial validation check passed: 100 rounds, 100 strict S numbers, 100 spec S numbers, 0 unfinished markers`.
- `npm run typecheck`: passed from `tools/graph-react-app`, including no JS/MJS/CJS/JSX source, no explicit production `any`, strict serial field/S-number/Round-numbering/unfinished-marker checks, web typecheck and agent-server typecheck.
- `npm run agent:test`: passed 500/500 from `tools/graph-react-app`.
- `npm run agent:ui-test`: passed 139/139 from `tools/graph-react-app`.
- `npm run batch:test`: passed 11/11 from `tools/graph-react-app`.
- `npm run build`: passed from `tools/graph-react-app` and exported `00_总览/黑曜纪元3D世界地图.html`.

Remaining risk:

- The marker list is intentionally focused on common actionable unfinished-work tokens, so the S099 requirement text itself does not block completion merely for saying “未完成标记”.

## 2026-07-04 Mechanical Audit Completion Output Slice

- Closed the S100 verification-artifact gap.
- Extended `scripts/check-strict-serial-validation.ts` with `formatStrictSerialValidationAuditOutput`.
- `npm run check:strict-serial-validation` now prints a single mechanical audit output line for completion replies to cite.
- The output includes:
  - strict validation pass status
  - actual and expected Round counts
  - Round 001 / Round 100 presence
  - required field count
  - missing round-field failure count
  - strict/spec S-number counts
  - missing S-number counts in both directions
  - unfinished marker count
- Architecture verification gates now require final completion replies to cite the `mechanical audit output:` line instead of subjective completion claims.

Verification:

- `node --import tsx --test ../agent-server/test/strictSerialValidation.test.ts`: failed first because `formatStrictSerialValidationAuditOutput` did not exist; passed after adding the formatter and wiring the CLI through it.
- `npm run check:strict-serial-validation`: passed and reported `mechanical audit output: strict_serial_validation=pass; rounds=100; expected_rounds=100; round_001=present; round_100=present; required_fields=4; round_field_failures=0; strict_s_numbers=100; spec_s_numbers=100; missing_in_spec=0; missing_in_strict=0; unfinished_markers=0`.
- `npm run typecheck`: passed from `tools/graph-react-app`, including no JS/MJS/CJS/JSX source, no explicit production `any`, the mechanical strict serial validation audit, web typecheck and agent-server typecheck.
- `npm run agent:test`: passed 501/501 from `tools/graph-react-app`.
- `npm run agent:ui-test`: passed 139/139 from `tools/graph-react-app`.
- `npm run batch:test`: passed 11/11 from `tools/graph-react-app`.
- `npm run build`: passed from `tools/graph-react-app` and exported `00_总览/黑曜纪元3D世界地图.html`.
- `git diff --check`: passed with no whitespace errors.
- Touched-file trailing whitespace scan: no matches.

Remaining risk:

- This makes the strict serial completion claim mechanically citeable. Broader release readiness still depends on the surrounding test/typecheck/build gates.

## 2026-07-04 First Screen Information Budget Slice

- Closed the S001 first-screen information-budget gap for the Agent Console.
- The player waiting mode now marks first-screen major blocks with `data-first-screen-block` so the budget is mechanically countable.
- The first screen is constrained to four major blocks:
  - `intro`
  - `actions`
  - `watch`
  - `quick-panel`
- The downtime choices, earnings, low-stimulation toggle and player status are grouped into `agent-player-quick-panel` instead of competing as separate first-screen blocks.
- The advanced Operator section remains a closed `<details>` block after the player first screen.
- The Operator summary explicitly defers complex systems to later viewing: world graph, lore ledger, reputation tree, faction tree and detailed Agent fields.

Verification:

- `node --import tsx --test --test-name-pattern "S001 information budget" src/agent/AgentExplorer.layout.test.ts`: failed first because the first-screen blocks were not marked; passed after adding the block markers and quick-panel grouping.

Remaining risk:

- This is a source-level structural guard for the first-screen information budget. Visual screenshots should still be used for future large layout changes that alter viewport height, typography or rendered density.

## 2026-07-04 Archive Recommended Starter Commission Slice

- Closed the S002 no-choice first-run gap for the Agent Console.
- The first-screen player action now starts a server hosted session from the archive recommended starter commission rather than exposing an open-ended custom commission.
- The default starter mandate is `档案馆推荐委托：灰港边缘巡查`.
- First-run choice is limited to three risk preferences:
  - `谨慎`
  - `均衡`
  - `冒险`
- The selected risk preference changes the server-hosted mandate text submitted through `startEpochHostedSession`.
- The Operator section still keeps the advanced/custom hosted mandate controls out of the first screen.

Verification:

- `node --import tsx --test --test-name-pattern "archive recommended commission" src/agent/AgentExplorer.layout.test.ts`: failed first because no starter risk-preference contract existed; passed after adding `STARTER_RISK_PREFERENCE_OPTIONS`, the default starter mandate and first-screen risk controls.
- `npm run agent:ui-test`: passed 141/141 from `tools/graph-react-app`.
- `npm run typecheck`: passed from `tools/graph-react-app`, including no JS/MJS/CJS/JSX source, no explicit production `any`, the mechanical strict serial validation audit, web typecheck and agent-server typecheck.
- `npm run build`: passed from `tools/graph-react-app` and exported `00_总览/黑曜纪元3D世界地图.html`.

Remaining risk:

- This is the first-screen hosted-session path. Future work can add richer server-authored starter commission catalogs, but the MVP now prevents the first screen from asking a new user to invent a commission.

## 2026-07-04 Key Safety Proof First-Screen Slice

- Closed the S003 key-safety proof gap for the Agent Console first screen.
- Added a first-screen `agent-player-key-proof` strip inside the quick panel.
- The strip shows the local call path: browser to local Agent/MCP to the user's model.
- The strip states that network requests do not contain the user's Key.
- The same strip exposes demo mode as a local sample flow using `DEMO_CONTRACT.mandate`.
- The visible demo-mode copy states the local sample is not uploadable, not settleable and does not enter the graph.

Verification:

- `node --import tsx --test --test-name-pattern "key-safety proof" src/agent/AgentExplorer.layout.test.ts`: failed first because the first-screen key-safety proof did not exist; passed after adding the proof strip and CSS guard.
- `npm run agent:ui-test`: passed 142/142 from `tools/graph-react-app`.
- `npm run typecheck`: passed from `tools/graph-react-app`, including no JS/MJS/CJS/JSX source, no explicit production `any`, the mechanical strict serial validation audit, web typecheck and agent-server typecheck.
- `npm run build`: passed from `tools/graph-react-app` and exported `00_总览/黑曜纪元3D世界地图.html`.

Remaining risk:

- This closes the visible S003 proof. S004 still needs a separate behavioral audit that demo mode cannot upload, settle, grant reputation or enter the graph.

## 2026-07-04 Demo Mode Local Isolation Slice

- Closed the S004 demo-mode isolation gap for the Agent Console.
- Added a local-only `DemoModeReport` state object derived from `DEMO_CONTRACT`.
- Added `runLocalDemoMode`, which only sets local React state and a status string.
- The demo report carries explicit isolation flags:
  - `uploadable: false`
  - `settleable: false`
  - `reputationEligible: false`
  - `graphEligible: false`
- The first-screen demo report displays the local sample mandate, anchors, allowed claim types and the user-facing isolation summary: not uploadable, not settleable, no reputation and no graph entry.
- The S004 regression test asserts the local demo function does not call hosted-session APIs, hosted-action submission, result-page creation, lore adjudication, world overview refresh or result/world state setters.

Verification:

- `node --import tsx --test --test-name-pattern "demo mode stays local" src/agent/AgentExplorer.layout.test.ts`: failed first because `DemoModeReport` and `runLocalDemoMode` did not exist; passed after adding the local-only report and first-screen demo entry.
- `npm run agent:ui-test`: passed 143/143 from `tools/graph-react-app`.
- `npm run typecheck`: passed from `tools/graph-react-app`, including no JS/MJS/CJS/JSX source, no explicit production `any`, the mechanical strict serial validation audit, web typecheck and agent-server typecheck.
- `npm run build`: passed from `tools/graph-react-app` and exported `00_总览/黑曜纪元3D世界地图.html`.

Remaining risk:

- This guards the web-console demo path. Future server-side demo endpoints, if introduced, should keep the same no-upload/no-settlement/no-reputation/no-graph contract and add API-level tests before being exposed.

## 2026-07-04 Structured Action Explanation Slice

- Closed the S005 structured-action-explanation gap for the Agent Console.
- Added a shared `ActionExplanationDetails` renderer for key action explanations.
- The renderer fixes every detailed explanation to the six S005 fields:
  - 触发线索
  - 可选方案
  - 选择原因
  - 放弃原因
  - 风险
  - 预计收益
- Open turn-card options, resolved turn-card choices, active hosted-session options and completed hosted actions now use the same structured explanation renderer.
- The existing one-line `brief` remains visible outside the folded details, preserving the S006 progressive-disclosure direction while completing the S005 structure.
- Added compact styling and a mobile single-column rule for the explanation details.

Verification:

- `node --import tsx --test --test-name-pattern "S005 structured explanations" src/agent/AgentExplorer.layout.test.ts`: failed first because the shared structured renderer did not exist; passed after adding `ActionExplanationDetails` and wiring key action surfaces to it.
- `npm run agent:ui-test`: first exposed a stale test assertion that expected `option.explanation.choiceReason` inline in the turn-card JSX; passed 144/144 after updating that assertion to the shared renderer.
- `npm run typecheck`: passed from `tools/graph-react-app`, including no JS/MJS/CJS/JSX source, no explicit production `any`, the mechanical strict serial validation audit, web typecheck and agent-server typecheck.
- `npm run build`: passed from `tools/graph-react-app` and exported `00_总览/黑曜纪元3D世界地图.html`.

Remaining risk:

- This implements the MVP simplified structured panel. Future work can enrich the copy or server scoring, but should keep these six fields stable unless S005 is superseded.

## 2026-07-04 Progressive Explanation Disclosure Slice

- Closed the S006 progressive-disclosure gap for key action explanations.
- `ActionExplanationDetails` now accepts `autoOpen`.
- Ordinary key actions keep only the one-line `brief` visible by default, with the structured six-field explanation folded behind `details`.
- High-risk turn-card options and high-risk hosted-session options pass `autoOpen={option.risk === "high"}`.
- Completed hosted actions pass `autoOpen={action.risk === "high"}`.
- Resolved turn-card details also auto-open when the selected original option was high risk.

Verification:

- `node --import tsx --test --test-name-pattern "progressively discloses" src/agent/AgentExplorer.layout.test.ts`: failed first because `autoOpen` did not exist; passed after adding progressive disclosure and high-risk auto-open wiring.
- `npm run agent:ui-test`: passed 145/145 from `tools/graph-react-app`.
- `npm run typecheck`: passed from `tools/graph-react-app`, including no JS/MJS/CJS/JSX source, no explicit production `any`, the mechanical strict serial validation audit, web typecheck and agent-server typecheck.
- `npm run build`: passed from `tools/graph-react-app` and exported `00_总览/黑曜纪元3D世界地图.html`.

Remaining risk:

- High-value confirmation records only carry summaries today, so the full structured explanation auto-open is tied to the high-risk action surfaces that already carry `EpochActionExplanation`.

## 2026-07-04 Resident Intervention Controls Slice

- Closed the S007 resident-intervention-entry gap for the Agent Console.
- Added local intervention state and mode labels for running, paused, instruction-appended and takeover states.
- Added a resident intervention bar to the Hosted runner exploration surface.
- Non-high-risk exploration now exposes the three MVP lightweight controls:
  - 暂停
  - 追加指令
  - 接管本轮
- `暂停` records a local pause state and does not submit another action.
- `追加指令` appends the user's instruction into both hosted and turn visible text so the next submission carries it.
- `接管本轮` replaces hosted/turn visible text with a user-takeover instruction.
- When open turn-card or hosted options include high-risk actions, the resident controls are replaced by a high-risk authorization panel that points the user to confirmation/challenge before execution.

Verification:

- `node --import tsx --test --test-name-pattern "S007 intervention" src/agent/AgentExplorer.layout.test.ts`: failed first because no resident intervention state or bar existed; passed after adding the controls and high-risk authorization swap.
- `npm run agent:ui-test`: passed 146/146 from `tools/graph-react-app`.
- `npm run typecheck`: passed from `tools/graph-react-app`, including no JS/MJS/CJS/JSX source, no explicit production `any`, the mechanical strict serial validation audit, web typecheck and agent-server typecheck.
- `npm run build`: passed from `tools/graph-react-app` and exported `00_总览/黑曜纪元3D世界地图.html`.

Remaining risk:

- The pause/takeover controls are web-console local controls for the next action submission. There is no server-side paused-hosted-session primitive yet, so future server support should add API-level pause/resume tests before claiming remote cancellation.

## 2026-07-04 Intervention Budget Slice

- Closed the S008 takeover-budget MVP gap for the Agent Console.
- Added `BASE_INTERVENTION_BUDGET = 1`, so every run starts with one manual takeover by default.
- Added a conservative `reputationInterventionBonus` that can grant a small extra budget from current legend resources, season standing or organization standing.
- Added local takeover usage tracking and reset it when a new starter commission, hosted session, web bridge turn or turn card starts.
- `接管本轮` now consumes one intervention count and is disabled when the remaining count reaches zero.
- The resident intervention bar now displays `委托干预次数 remaining/budget`.
- Added an `autonomyEvaluation` summary that drops from full to lightly reduced or reduced as takeovers are consumed.

Verification:

- `node --import tsx --test --test-name-pattern "S008 takeover budget" src/agent/AgentExplorer.layout.test.ts`: failed first because no intervention budget existed; passed after adding budget derivation, consumption and autonomy feedback.
- `npm run agent:ui-test`: passed 147/147 from `tools/graph-react-app`.
- `npm run typecheck`: passed from `tools/graph-react-app`, including no JS/MJS/CJS/JSX source, no explicit production `any`, the mechanical strict serial validation audit, web typecheck and agent-server typecheck.
- `npm run build`: passed from `tools/graph-react-app` and exported `00_总览/黑曜纪元3D世界地图.html`.

Remaining risk:

- The S008 budget is an MVP web-console guard. If later server-hosted play gains canonical intervention accounting, the server should enforce the same budget and the UI should read the authoritative count.

## 2026-07-04 High-Risk Request Package Slice

- Closed the S009 high-risk request throttling MVP gap for the Agent Console.
- Added `HIGH_RISK_REQUEST_LIMIT = 1` as the per-run high-risk package limit.
- Added a local `HighRiskPackage` model with kind, label, request count, status and risk strategy.
- Added risk-package staging that merges same-kind high-risk requests instead of opening repeated separate prompts.
- High-risk turn resolution confirmation now stages a `resolve_turn` risk package first unless that package has already been authorized.
- The risk-package panel exposes the MVP actions:
  - 授权
  - 拒绝
  - 改风险策略
- Risk packages reset with new runs through the existing new-run intervention reset path.

Verification:

- `node --import tsx --test --test-name-pattern "high-risk requests" src/agent/AgentExplorer.layout.test.ts`: failed first because no high-risk package model existed; passed after adding package staging, UI controls and high-risk request interception.
- `npm run typecheck`: first failed because `RISK_STRATEGIES[nextIndex]` could be `undefined`; passed after adding an explicit fallback. The passing run included no JS/MJS/CJS/JSX source, no explicit production `any`, the mechanical strict serial validation audit, web typecheck and agent-server typecheck.
- `npm run agent:ui-test`: passed 148/148 from `tools/graph-react-app`.
- `npm run build`: passed from `tools/graph-react-app` and exported `00_总览/黑曜纪元3D世界地图.html`.

Remaining risk:

- This is a web-console MVP throttle. Server-side canonical high-risk package accounting should be added before treating the limit as authoritative across devices or external MCP clients.

## 2026-07-04 Low-Stimulus Preflight Persistence Slice

- Closed the S010 low-stimulus-preflight MVP gap for the Agent Console.
- Added optional `ExplorerIdentity.preferences.lowStimulusMode` so the comfort choice can live inside the local explorer archive without breaking old archives.
- Local identity validation now preserves that optional preference while continuing to reject forged recovery material.
- Startup now prefers the explorer archive preference and falls back to the legacy localStorage key for existing users.
- Toggling low-stimulus mode updates React state, the legacy localStorage key and the saved explorer identity together.
- Added a high-stimulus preflight toggle before high-risk hosted or turn-card authorization surfaces.
- The preflight copy explicitly tells the user the choice is persistently saved to the local archive and applies to high-risk authorization, hosted actions and turn resolution.

Verification:

- `node --import tsx --test --test-name-pattern "persistent low-stimulation" src/agent/AgentExplorer.layout.test.ts`: failed first because `updateLowStimulusMode` did not write `preferences.lowStimulusMode` or save the explorer identity; passed after adding archive persistence and the high-stimulus preflight control.
- `npm run agent:ui-test`: passed 148/148 from `tools/graph-react-app`.
- `npm run typecheck`: passed from `tools/graph-react-app`, including no JS/MJS/CJS/JSX source, no explicit production `any`, the mechanical strict serial validation audit, web typecheck and agent-server typecheck.
- `npm run build`: passed from `tools/graph-react-app` and exported `00_总览/黑曜纪元3D世界地图.html`.

Remaining risk:

- The low-stimulus choice is authoritative for this local explorer archive. If future server profiles gain comfort preferences, the server should reconcile that value with the archive during profile sync.

## 2026-07-04 First-Run Non-Permanent-Death Slice

- Closed the S011 first-run non-permanent-death MVP gap for the Agent Console.
- Added `STARTER_DEATH_PROTECTION` as the shared first-run protection copy and mandate clause.
- The player first screen now states that the first run is non-permanent-death protected.
- The first-screen protection block states the worst outcome as severe-injury archive or missing-awaiting-recovery, not permanent death.
- The protection block also states that permanent death starts from the second run or high-risk commissions.
- Starting the archive-recommended starter commission now includes the protection clause in the hosted-session mandate.
- If a starter commission is escalated toward permanent-death risk, the mandate requires explicit authorization first.
- Mobile layout now collapses the starter protection block to one column with the rest of the first-screen controls.

Verification:

- `node --import tsx --test --test-name-pattern "protects the first run" src/agent/AgentExplorer.layout.test.ts`: failed first because no `STARTER_DEATH_PROTECTION` constant, first-screen protection block or hosted mandate clause existed; passed after adding the protection model, UI and starter mandate wiring.
- `npm run agent:ui-test`: passed 149/149 from `tools/graph-react-app`.
- `npm run typecheck`: passed from `tools/graph-react-app`, including no JS/MJS/CJS/JSX source, no explicit production `any`, the mechanical strict serial validation audit, web typecheck and agent-server typecheck.
- `npm run build`: passed from `tools/graph-react-app` and exported `00_总览/黑曜纪元3D世界地图.html`.

Remaining risk:

- This is enforced through the web-console starter mandate and visible first-screen contract. If the backend later models run count or permanent-death state explicitly, the server should enforce first-run protection authoritatively.

## 2026-07-04 First-Run Reward Isolation Slice

- Closed the S012 first-run reward-isolation MVP gap for the Agent Console.
- Added `STARTER_REWARD_ISOLATION` as the shared first-run reward boundary copy and mandate clause.
- The player first screen now states that first-run protection only protects the agent.
- The reward-isolation block explicitly says the starter run grants no transferable reputation, source-flow reward or strong external item.
- The same block states that starter artifacts need later real-commission confirmation before they create world impact.
- Starting the archive-recommended starter commission now includes the reward-isolation clause in the hosted-session mandate.
- The starter mandate labels starter artifacts as `nonEvidence` clues until verified by later real play.
- Mobile layout now collapses the reward-isolation block to one column with the rest of the first-screen controls.

Verification:

- `node --import tsx --test --test-name-pattern "isolates first-run rewards" src/agent/AgentExplorer.layout.test.ts`: failed first because no `STARTER_REWARD_ISOLATION` constant, first-screen reward isolation block or starter mandate clause existed; passed after adding the shared copy, UI and mandate wiring.
- `npm run agent:ui-test`: passed 150/150 from `tools/graph-react-app`.
- `npm run typecheck`: passed from `tools/graph-react-app`, including no JS/MJS/CJS/JSX source, no explicit production `any`, the mechanical strict serial validation audit, web typecheck and agent-server typecheck.
- `npm run build`: passed from `tools/graph-react-app` and exported `00_总览/黑曜纪元3D世界地图.html`.

Remaining risk:

- This is enforced through first-screen product copy and the starter hosted-session mandate. If the backend later gains explicit first-run reward accounting, the server should block transferable rewards and world-impact writes authoritatively.

## 2026-07-04 Revisit Primary Action Slice

- Closed the S013 revisit-primary-button MVP gap for the Agent Console.
- Added a `RevisitPrimaryActionKind` model covering the required action families:
  - 审档
  - 修正
  - 接续
  - 找回
  - 领取
- The player watch board's single-line next-step summary is now explicitly labeled as a revisit summary.
- The revisit summary now includes one primary button instead of only reporting status.
- The primary action chooses the safest current command:
  - pending downtime -> 领取托管收益
  - archived identity -> 找回身份
  - blocked active tools -> 修正状态
  - pending briefing/result/hosted continuation -> 接续下一步
  - default -> 审档预览
- The primary button routes to existing owner-authorized actions such as `claimDowntime`, `reincarnateCurrentIdentity`, `loadExplorerProfile`, `refreshProgress` and `loadResultPage`.

Verification:

- `node --import tsx --test --test-name-pattern "revisit summary" src/agent/AgentExplorer.layout.test.ts`: failed first because the watch-board summary had no typed revisit action and no primary button; passed after adding the action model, button and dispatcher.
- `npm run agent:ui-test`: passed 151/151 from `tools/graph-react-app`.
- `npm run typecheck`: passed from `tools/graph-react-app`, including no JS/MJS/CJS/JSX source, no explicit production `any`, the mechanical strict serial validation audit, web typecheck and agent-server typecheck.
- `npm run build`: passed from `tools/graph-react-app` and exported `00_总览/黑曜纪元3D世界地图.html`.

Remaining risk:

- The S013 button intentionally reuses existing console actions. If future result-page `nextActions` become directly executable by tool name, the dispatcher should call that typed action instead of refreshing progress for the generic 接续 path.

## 2026-07-04 Four-Screen Settlement Slice

- Closed the S014 four-screen settlement MVP gap for the Agent Console.
- Added `ResultSettlementScreenKey` and `RESULT_SETTLEMENT_SCREENS` for the four required settlement screens:
  - 结局
  - 评分
  - 掉落
  - 下一步
- Result preview now has a dedicated four-screen settlement flow above the detailed receipt data.
- The flow uses tabs only for navigation; the active settlement screen owns a single primary action button.
- The active screen summarizes the current result from existing server data:
  - ending outcome from turn-card or hosted-session resolution
  - score from events, receipt trust and resource count
  - drop from non-zero resource entries
  - next from the first server suggested action
- Added `runSettlementPrimaryAction` to route each screen's single primary action through existing verified console commands.
- Added an explicit default settlement screen so TypeScript can prove `activeSettlementScreen` is always defined.

Verification:

- `node --import tsx --test --test-name-pattern "four single-action" src/agent/AgentExplorer.layout.test.ts`: failed first because no four-screen settlement model, state, UI or primary action existed; passed after adding the settlement flow.
- `npm run typecheck`: first failed because `activeSettlementScreen` could be `undefined`; passed after adding `DEFAULT_RESULT_SETTLEMENT_SCREEN`. The passing run included no JS/MJS/CJS/JSX source, no explicit production `any`, the mechanical strict serial validation audit, web typecheck and agent-server typecheck.
- `npm run agent:ui-test`: passed 152/152 from `tools/graph-react-app`.
- `npm run build`: passed from `tools/graph-react-app` and exported `00_总览/黑曜纪元3D世界地图.html`.

Remaining risk:

- The S014 settlement screens currently summarize the existing result-page payload. If the server later emits first-class settlement-screen payloads, this UI should render those canonical sections instead of deriving summaries client-side.

## 2026-07-04 Frontstage Terminology Cleanup Slice

- Closed the S015 frontstage terminology MVP gap for the Agent Console.
- Added `FRONTSTAGE_LORE_OUTPUT_LABEL = "可入档发现"` as the frontstage label for lore outputs.
- Renamed the frontstage demo report field from `allowedClaimTypes` to `discoveries`.
- The player-facing demo report now renders discovery output as `可入档发现：...`.
- Added a small frontstage discovery style so the replacement text wraps safely in the first-screen demo report.
- Kept claim/schema language in the folded advanced/operator surface by adding `claim/schema` to the advanced summary.
- Existing advanced lore audit details still expose `claimHash`, evidence hashes and source counts for users who expand the operator view.

Verification:

- `node --import tsx --test --test-name-pattern "claim and schema" src/agent/AgentExplorer.layout.test.ts`: failed first because the frontstage had no `可入档发现` label and still exposed `demoModeReport.allowedClaimTypes`; passed after adding the frontstage label, summary helper and `discoveries` field.
- `npm run agent:ui-test`: passed 153/153 from `tools/graph-react-app`.
- `npm run typecheck`: passed from `tools/graph-react-app`, including no JS/MJS/CJS/JSX source, no explicit production `any`, the mechanical strict serial validation audit, web typecheck and agent-server typecheck.
- `npm run build`: passed from `tools/graph-react-app` and exported `00_总览/黑曜纪元3D世界地图.html`.

Remaining risk:

- This slice covers the player/demo frontstage path and keeps claim/schema details in the advanced operator surface. Other advanced panels still intentionally show internal audit terms.

## 2026-07-04 Settlement Minimap Impact Slice

- Closed the S016 minimap-impact MVP gap for the Agent Console.
- Added a `ResultImpactMapItem` frontstage display model for result-page impact slices.
- Added `resultImpactMapItems(resultPage)` to derive a compact static slice from the existing `regionalContext` payload:
  - affected region
  - controlling or contesting faction
  - first open or settled regional commission
  - first raid, retaliation, or conflict trace as dispute context
- The four-screen settlement flow now shows the slice only on the 掉落 screen.
- Added `agent-impact-minimap` styles that present the impact slice as a small map-grid card without requiring the user to open the full world map.

Verification:

- `node --import tsx --test --test-name-pattern "minimap impact" src/agent/AgentExplorer.layout.test.ts`: failed first because no `ResultImpactMapItem`, helper, drop-screen minimap UI, or CSS existed; passed after adding the static impact slice.
- `npm run typecheck`: passed from `tools/graph-react-app`, including no JS/MJS/CJS/JSX source, no explicit production `any`, the mechanical strict serial validation audit, web typecheck and agent-server typecheck.
- `npm run agent:ui-test`: passed 154/154 from `tools/graph-react-app`.
- `npm run build`: passed from `tools/graph-react-app` and exported `00_总览/黑曜纪元3D世界地图.html`.

Remaining risk:

- The S016 minimap is intentionally static for MVP. If later specs require interactive region navigation, the slice should be wired to canonical map coordinates instead of only deriving summary cards from `regionalContext`.

## 2026-07-04 World-Internal Goals Slice

- Closed the S017 world-internal-goals MVP gap for the Agent Console.
- Added a `WorldInternalGoal` display model with exactly three 近期 goals and one 长期 goal.
- Added the first-screen `世界内目标` panel to the player waiting board so revisit users see a concrete reason to continue without opening operator panels.
- The goal copy uses in-world titles and permissions rather than abstract account metrics:
  - 灰港边缘巡查证
  - 腐林见习证实者
  - 云脑族临时信使
  - 腐林证实者 II
  - 解锁云脑族断线委托
- Added responsive styles for `agent-player-world-goals`, including a highlighted long-goal card and mobile one-column layout.

Verification:

- `node --import tsx --test --test-name-pattern "world-internal near and long goals" src/agent/AgentExplorer.layout.test.ts`: failed first because no `WorldInternalGoal`, `WORLD_INTERNAL_GOALS`, first-screen goal panel, or CSS existed; passed after adding the static in-world goals.
- `npm run typecheck`: passed from `tools/graph-react-app`, including no JS/MJS/CJS/JSX source, no explicit production `any`, the mechanical strict serial validation audit, web typecheck and agent-server typecheck.
- `npm run agent:ui-test`: passed 155/155 from `tools/graph-react-app`.
- `npm run build`: passed from `tools/graph-react-app` and exported `00_总览/黑曜纪元3D世界地图.html`.

Remaining risk:

- The S017 goals are static frontstage MVP copy. If server-side achievement progress becomes canonical, this panel should bind each goal to real progress and unlock state instead of only presenting the intended target ladder.

## 2026-07-04 Agent Narrative Profile Home Slice

- Closed the S018 agent-narrative-profile-home MVP gap for the Agent Console.
- Added an `AgentNarrativeHomepage` display model and `agentNarrativeHomepage(...)` helper.
- The current identity card now opens with an `Agent 叙事档案首页` instead of leading with raw fields.
- The narrative home shows:
  - agent 自述
  - 经历年表 from creation time and recent progress events
  - 最近伤痕 from personality drift source or existing traits
  - 关系变化 from the primary relationship edge
- Moved lifetime, generation, identity slot and legend-pool fields into a secondary `结构化字段` details surface.
- Added responsive styles for `agent-narrative-profile` and `agent-structured-fields`.

Verification:

- `node --import tsx --test --test-name-pattern "narrative home page" src/agent/AgentExplorer.layout.test.ts`: failed first because no `AgentNarrativeHomepage`, narrative profile home, secondary structured-field surface, or CSS existed; passed after adding the narrative identity homepage.
- `npm run typecheck`: initially failed because the helper used local `ExplorerIdentity` where the identity card uses server `EpochAgentIdentity`; passed after correcting the helper type. The passing run included no JS/MJS/CJS/JSX source, no explicit production `any`, the mechanical strict serial validation audit, web typecheck and agent-server typecheck.
- `npm run agent:ui-test`: passed 156/156 from `tools/graph-react-app`.
- `npm run build`: passed from `tools/graph-react-app` and exported `00_总览/黑曜纪元3D世界地图.html`.

Remaining risk:

- The S018 narrative homepage is a simple derived MVP. If the server later stores canonical biography entries, scar records or agent-authored self-narration, this helper should render those canonical records instead of deriving copy from current progress and relationship edges.

## 2026-07-04 Share Card Status Marker Slice

- Closed the S019 share-card-status MVP gap for the Agent Console.
- Added a `ShareCardStatus` display model and `shareCardStatusForResult(resultPage)` helper.
- The result/share area now renders a `分享卡状态标识` card whenever a result payload is available.
- The card explicitly shows:
  - 设定层级
  - 来源战报
  - 是否已证实
- The share-card level is derived from server receipt and regional dispute context:
  - `证实` when the receipt has canonical events
  - `争议` when no canonical events exist but raids, retaliations or traces are present
  - `传闻` otherwise
- Added `is-provisional` visual styling for rumor/contested states so they cannot look like confirmed share cards.

Verification:

- `node --import tsx --test --test-name-pattern "share card shows lore status" src/agent/AgentExplorer.layout.test.ts`: failed first because no share-card status model, provenance labels, provisional state, or CSS existed; passed after adding the status card.
- `npm run typecheck`: passed from `tools/graph-react-app`, including no JS/MJS/CJS/JSX source, no explicit production `any`, the mechanical strict serial validation audit, web typecheck and agent-server typecheck.
- `npm run agent:ui-test`: passed 157/157 from `tools/graph-react-app`.
- `npm run build`: passed from `tools/graph-react-app` and exported `00_总览/黑曜纪元3D世界地图.html`.

Remaining risk:

- The S019 status card is derived client-side from receipt and regional context. If public share pages later store first-class lore-level metadata, the card should render that canonical server field directly.

## 2026-07-04 MVP Scope Marker Validation Slice

- Closed the S020 MVP/future-scope marker gap for the shared-world spec.
- Added `STRICT_SERIAL_SCOPE_MARKERS` with the exact accepted labels:
  - `MVP 必做`
  - `MVP 简版`
  - `后续增强`
- Added section-31 S-block parsing and `validateSpecSectionScopeMarkers(...)`.
- Added `assertSpecSectionScopeMarkers(...)` to fail the mechanical audit when any S001-S100 block lacks a scope marker.
- Extended `checkStrictSerialValidationFile(...)` and audit output with `scope_marker_failures`.
- Added `scripts/check-strict-serial-validation.test.ts` and included it in `npm run agent:ui-test`.
- Normalized the remaining unparseable scope text in S005, S016, S017, S040, S045, S060 and S096-S100 without changing their intended requirements.

Verification:

- `node --import tsx --test scripts/check-strict-serial-validation.test.ts`: failed first because the strict-serial validation script did not export scope-marker checks; after adding the checker it found 11 missing exact labels; passed after normalizing those spec lines.
- `npm run typecheck`: passed from `tools/graph-react-app`; the strict serial audit output now includes `scope_marker_failures=0`.
- `npm run agent:ui-test`: passed 159/159 from `tools/graph-react-app`, including the new strict serial scope marker tests.
- `npm run build`: passed from `tools/graph-react-app` and exported `00_总览/黑曜纪元3D世界地图.html`.

Remaining risk:

- The S020 checker enforces the presence of one accepted scope marker per S block. It does not judge whether the chosen marker is semantically correct for the work item.

## 2026-07-04 Lore Card Text Layer Labels Slice

- Closed the S021 text-layer-label MVP gap for the Agent Console.
- Added `LoreCardLayer` and `LORE_CARD_LAYER_LABELS` for the required text labels:
  - 正史
  - 共享
  - 证实
  - 传闻
  - 争议
  - 封存
- Added `loreTargetStatusLayer(status)` so lore target cards map server status to a visible text layer.
- Updated recent lore contribution cards to show a `共享` label in the title row.
- Updated lore target status cards to show `证实`, `争议`, `共享`, or `封存` in the title row according to status.
- Added `agent-lore-card-title` and `agent-lore-layer-label` styles so colors support the text label instead of carrying the status alone.

Verification:

- `node --import tsx --test --test-name-pattern "text layer labels" src/agent/AgentExplorer.layout.test.ts`: failed first because there was no unified lore-card layer model or title-row label; passed after adding the labels and badge styling.
- `npm run typecheck`: passed from `tools/graph-react-app`, including the strict serial audit with `scope_marker_failures=0`.
- `npm run agent:ui-test`: passed 160/160 from `tools/graph-react-app`.
- `npm run build`: passed from `tools/graph-react-app` and exported `00_总览/黑曜纪元3D世界地图.html`.

Remaining risk:

- S021 currently covers the Agent Console lore contribution and lore status cards. Public-facing static share pages should reuse the same labels if they gain separate card templates outside this console.

## 2026-07-04 Commission Secret Exposure Tier Slice

- Closed the S022 commission-secret-exposure-tier MVP gap across the Agent Console and server commission model.
- Added `EpochSecretExposureTier` and `secretExposureTier` to region commissions.
- Server-built commissions now assign a tier for objectives, resource nodes, anomalies, bounties, party runs and social hooks.
- Added `STARTER_SECRET_EXPOSURE_POLICY` so first-run starter commissions explicitly allow only:
  - `T0_public`
  - `T1_low_rumor`
- Updated starter-run copy and mandate text to forbid touching `T2_local_secret`, `T3_core_secret` or `T4_forbidden_core` during the first run.
- Region commission cards now show a visible `agent-secret-tier-label`.
- Public world and result-page HTML serializers now include commission secret tiers in their briefing/result text.

Verification:

- `node --import tsx --test --test-name-pattern "secret exposure tiers" src/agent/AgentExplorer.layout.test.ts`: failed first because no `EpochSecretExposureTier`, starter policy, commission tier label, or CSS existed; passed after adding the S022 tier model and UI.
- `node --import tsx --test --test-name-pattern "MCP exposes owner-authorized party runs as region commissions" ../agent-server/test/mcp.test.ts`: passed from `tools/graph-react-app`; the party-run commission exposes `secretExposureTier: "T0_public"`.
- `npm run typecheck`: passed from `tools/graph-react-app`, including no JS/MJS/CJS/JSX source, no explicit production `any`, the mechanical strict serial validation audit with `scope_marker_failures=0`, web typecheck and agent-server typecheck.
- `npm run agent:ui-test`: passed 161/161 from `tools/graph-react-app`.
- `npm run build`: passed from `tools/graph-react-app` and exported `00_总览/黑曜纪元3D世界地图.html`.

Remaining risk:

- The full HTTP server test containing the new `secretExposureTier` assertion was not rerun to completion because that focused server path was heavy in this workspace. The lightweight MCP route and TypeScript contract verify the shared server commission shape, but a future full server pass should cover the public HTTP serialization path too.

## 2026-07-04 Secret Reveal Budget Chapter Lock Slice

- Closed the S023 MVP chapter-lock slice for secret reveal budgets.
- Added `EpochSecretRevealBudget` and attached `secretRevealBudget` to every server-built region commission.
- Added a chapter budget key scoped by:
  - topic
  - explorer
  - agent
  - location
  - chapter
- Added a small tier-cost rule for commission clues:
  - `T0_public`: 0
  - `T1_low_rumor`: 1
  - `T2_local_secret`: 2
  - `T3_core_secret`: 3
  - `T4_forbidden_core`: 4
- The MVP chapter threshold is 2. A commission whose cumulative budget spend exceeds that threshold now carries `chapterLocked: true`, `remaining: 0`, and a lock reason.
- The Agent Console region commission list now shows `秘密揭露预算`, remaining budget, or `章节锁` beside the secret tier.
- Public agent/world pages and result pages now include a compact budget label for region commissions.

Verification:

- `node --import tsx --test --test-name-pattern "chapter locks for over-budget secret clues" src/agent/AgentExplorer.layout.test.ts`: failed first because `EpochSecretRevealBudget`, budget UI copy, chapter lock rendering and CSS did not exist; passed after adding the S023 budget model and UI.
- `node --import tsx --test --test-name-pattern "chapter-lock over-budget secret clues" ../agent-server/test/mcp.test.ts`: failed first because the spawned cataclysm anomaly commission lacked `secretRevealBudget`; passed after adding server-side budget derivation.
- `npm run typecheck`: passed from `tools/graph-react-app`, including no JS/MJS/CJS/JSX source, no explicit production `any`, the mechanical strict serial validation audit with `scope_marker_failures=0`, web typecheck and agent-server typecheck.
- `npm run agent:ui-test`: passed 162/162 from `tools/graph-react-app`.
- `npm run build`: passed from `tools/graph-react-app` and exported `00_总览/黑曜纪元3D世界地图.html`.

Remaining risk:

- S023 is intentionally the MVP chapter-lock version. It does not yet implement fuzzy clue rewriting or durable cross-session clue-budget persistence beyond the derived commission budget surface.

## 2026-07-04 Location Motif Quota Slice

- Closed a narrow S024 follow-up-enhancement slice for location motif quotas.
- Added `EpochLocationMotif` and `EpochLocationMotifQuota`.
- Region info now exposes six motif quota rows per location:
  - 生态
  - 生物
  - 阵营
  - 异常
  - 资源
  - 人物
- Counts are derived from existing server projection/view data instead of adding new persistence:
  - ecology from monuments and region control
  - creature reserved at 0 until creature records are connected to region projection
  - faction from faction pressure plus organizations
  - anomaly from anomaly events
  - resource from resource nodes
  - character from canonical NPCs, NPC candidates and active agents
- Dense motifs now expose `status: "dense"` and `displayMode: "aggregate"` or `displayMode: "downrank"`.
- The Agent Console region panel now shows a `地点母题配额` grid and marks dense motif rows.

Verification:

- `node --import tsx --test --test-name-pattern "location motif quotas" src/agent/AgentExplorer.layout.test.ts`: failed first because `EpochLocationMotif`, `motifQuotas`, `LOCATION_MOTIF_LABELS`, motif UI and CSS did not exist; passed after adding the S024 surface.
- `node --import tsx --test --test-name-pattern "dense location motif quotas" ../agent-server/test/mcp.test.ts`: initially used anomaly spawning but hit the existing one-open-anomaly-per-region guard, then was corrected to use operator-created organizations; failed because `region.motifQuotas` did not exist; passed after adding server motif quotas.
- `npm run typecheck`: passed from `tools/graph-react-app`, including no JS/MJS/CJS/JSX source, no explicit production `any`, the mechanical strict serial validation audit with `scope_marker_failures=0`, web typecheck and agent-server typecheck.
- `npm run agent:ui-test`: passed 163/163 from `tools/graph-react-app`.
- `npm run build`: passed from `tools/graph-react-app` and exported `00_总览/黑曜纪元3D世界地图.html`.

Remaining risk:

- S024 remains a derived quota surface. It does not yet persist explicit per-location motif budgets or connect true creature/ecology records once those become first-class region projection entities.

## 2026-07-04 Reality Meme Parody Review Slice

- Closed the S025 MVP gap for NPC candidate flavor review.
- Extended NPC candidate review flags with:
  - `real_world_mapping`
  - `internet_meme_trace`
  - `parody_trace`
- Added `NpcCandidateFlavorPublication` / `EpochNpcCandidateFlavorPublication`.
- Automatic NPC candidate review now marks suspected real-world mapping, meme traces, parody traces or IP similarity as:
  - `reviewLevel: "moderation_hold"`
  - `flavorPublication.mode: "personal_sealed"`
  - `flavorPublication.sharedWorldEligible: false`
- The automatic canonicalization path now refuses to create a shared canonical NPC for personally sealed flavor candidates.
- Agent Console NPC candidate cards now show a visible `气质策略` label with `个人封存` or shared-lore eligibility.

Verification:

- `node --import tsx --test --test-name-pattern "reality meme parody review policy" src/agent/AgentExplorer.layout.test.ts`: failed first because the new review flags, `flavorPublication`, UI label and CSS did not exist; passed after adding the S025 surface.
- `node --import tsx --test --test-name-pattern "reality meme parody NPC candidates" ../agent-server/test/mcp.test.ts`: failed first because the candidate was promoted; passed after sealing suspected real-world/meme/parody candidates from shared lore.
- `npm run typecheck`: passed from `tools/graph-react-app`, including no JS/MJS/CJS/JSX source, no explicit production `any`, the mechanical strict serial validation audit with `scope_marker_failures=0`, web typecheck and agent-server typecheck.
- `npm run agent:ui-test`: passed 164/164 from `tools/graph-react-app`.
- `npm run build`: passed from `tools/graph-react-app` and exported `00_总览/黑曜纪元3D世界地图.html`.

Remaining risk:

- The S025 detector is regex-based and intentionally conservative. It catches obvious real-world/meme/parody language but is not a semantic classifier for subtle allusions.

## 2026-07-04 Organization Influence Score Slice

- Closed the S026 MVP-simple organization influence score gap.
- Added `EpochOrganizationInfluenceScore` to server organization views and frontend types.
- Organization views now derive an influence score across the requested dimensions:
  - member scale
  - resources
  - armed capacity
  - territory
  - diplomacy
  - supernatural capacity
- The MVP threshold is 8. Organizations at or above the threshold expose `factionReviewRequired: true` and a review reason, preventing them from looking like ordinary small groups.
- Agent Console organization cards now show `组织影响力 total/threshold` and whether the organization remains a normal small group or needs faction-candidate review.

Verification:

- `node --import tsx --test --test-name-pattern "organization influence scores" src/agent/AgentExplorer.layout.test.ts`: failed first because `EpochOrganizationInfluenceScore`, organization score UI and CSS did not exist; passed after adding the S026 surface.
- `node --import tsx --test --test-name-pattern "organization influence score escalates" ../agent-server/test/mcp.test.ts`: failed first because organization views lacked `influenceScore`; passed after deriving influence scores from organization membership and projection data.
- `npm run typecheck`: passed from `tools/graph-react-app`, including no JS/MJS/CJS/JSX source, no explicit production `any`, the mechanical strict serial validation audit with `scope_marker_failures=0`, web typecheck and agent-server typecheck.
- `npm run agent:ui-test`: passed 165/165 from `tools/graph-react-app`.
- `npm run build`: passed from `tools/graph-react-app` and exported `00_总览/黑曜纪元3D世界地图.html`.

Remaining risk:

- S026 uses derived view-time scoring. It does not yet create a separate durable faction-candidate review queue record when an organization crosses the threshold.

## 2026-07-04 Ability Effect Cluster Slice

- Closed the S027 follow-up-enhancement MVP surface for ability effect clustering.
- Added `AbilityEffectCluster` / `EpochAbilityEffectCluster` and attached optional `abilityEffectCluster` metadata to NPC ability candidates.
- Ability-like NPC candidate claims now derive a cluster from:
  - effect
  - cost
  - medium
  - location
  - trigger
- The cluster key intentionally excludes the candidate display name, so differently named ability claims with the same dimensions collapse to the same `clusterKey`.
- Agent Console NPC candidate cards now show an `效果聚类` label with the derived dimensions and cluster key.

Verification:

- `node --import tsx --test --test-name-pattern "ability effect clusters" src/agent/AgentExplorer.layout.test.ts`: failed first because `EpochAbilityEffectCluster`, candidate field, UI label and CSS did not exist; passed after adding the S027 surface.
- `node --import tsx --test --test-name-pattern "ability claims by effect cost medium location and trigger" ../agent-server/test/mcp.test.ts`: failed first because ability candidates had no cluster metadata; passed after deriving cluster keys from effect/cost/medium/location/trigger.
- `npm run typecheck`: passed from `tools/graph-react-app`, including no JS/MJS/CJS/JSX source, no explicit production `any`, the mechanical strict serial validation audit with `scope_marker_failures=0`, web typecheck and agent-server typecheck.
- `npm run agent:ui-test`: passed 166/166 from `tools/graph-react-app`.
- `npm run build`: passed from `tools/graph-react-app` and exported `00_总览/黑曜纪元3D世界地图.html`.
- `git diff --check`: clean for tracked diffs; direct trailing-whitespace scan over the touched S027 files also returned no matches.

Remaining risk:

- S027 uses deterministic keyword extraction for the MVP. It does not yet provide a full semantic classifier for subtle or multi-effect ability claims.

## 2026-07-04 Creature Behavior Scope Limit Slice

- Closed the S028 MVP-simple scope-limit slice for creature behavior claims.
- Added `CreatureBehaviorScopeReview` / `EpochCreatureBehaviorScopeReview` metadata for lore contributions.
- `record_lore_contribution` now detects creature behavior claims and derives:
  - claimed scope
  - allowed scope from `threat` and `rank_role`
  - review status
  - accepted exception explanation
- Over-limit creature behavior claims are rejected unless the text explains the excess as external pollution, a group event, or higher-entity involvement.
- Explained over-limit claims are allowed but recorded with `status: "explained_exception"` for audit and UI visibility.
- Agent Console recent lore contribution cards now show a compact `行为范围` review label.

Verification:

- `node --import tsx --test --test-name-pattern "creature behavior scope reviews" src/agent/AgentExplorer.layout.test.ts`: failed first because `EpochCreatureBehaviorScopeReview`, contribution field, UI label and CSS did not exist; passed after adding the S028 surface.
- `node --import tsx --test --test-name-pattern "over-limit creature behavior scope" ../agent-server/test/mcp.test.ts`: failed first because over-limit creature behavior claims were accepted; passed after requiring an explicit exception explanation.
- `npm run typecheck`: passed from `tools/graph-react-app`, including no JS/MJS/CJS/JSX source, no explicit production `any`, the mechanical strict serial validation audit with `scope_marker_failures=0`, web typecheck and agent-server typecheck.
- `npm run agent:ui-test`: passed 167/167 from `tools/graph-react-app`.
- `npm run build`: passed from `tools/graph-react-app` and exported `00_总览/黑曜纪元3D世界地图.html`.
- `git diff --check`: clean for tracked diffs; direct trailing-whitespace scan over the touched files also returned no matches.

Remaining risk:

- S028 uses deterministic text extraction for `threat`, `rank_role`, claimed scope and exception type. It does not yet read canonical creature stat records from the world map data when the claim omits those fields.

## 2026-07-04 Fuzzy Time Interval Occupancy Slice

- Closed the S029 follow-up-enhancement MVP surface for fuzzy time claims.
- Added `FuzzyTimeIntervalReview` / `EpochFuzzyTimeIntervalReview` metadata for lore contributions.
- `record_lore_contribution` now maps fuzzy year expressions such as `1024 年左右` and `1024 年前后` to a concrete interval:
  - `intervalStartYear`
  - `intervalEndYear`
  - `occupancyWeight`
- New fuzzy time intervals count overlaps against existing same-target fuzzy intervals and expose a timeline congestion level:
  - `low`
  - `medium`
  - `high`
- Agent Console recent lore contribution cards now show a compact `时间区间` label with interval, overlap count and occupancy weight.

Verification:

- `node --import tsx --test --test-name-pattern "fuzzy time interval occupancy" src/agent/AgentExplorer.layout.test.ts`: failed first because `EpochFuzzyTimeIntervalReview`, contribution field, UI label and CSS did not exist; passed after adding the S029 surface.
- `node --import tsx --test --test-name-pattern "fuzzy lore times" ../agent-server/test/mcp.test.ts`: failed first because fuzzy time claims had no interval metadata; passed after deriving interval occupancy and overlap-based congestion.
- `npm run typecheck`: passed from `tools/graph-react-app`, including no JS/MJS/CJS/JSX source, no explicit production `any`, the mechanical strict serial validation audit with `scope_marker_failures=0`, web typecheck and agent-server typecheck.
- `npm run agent:ui-test`: passed 168/168 from `tools/graph-react-app`.
- `npm run build`: passed from `tools/graph-react-app` and exported `00_总览/黑曜纪元3D世界地图.html`.
- `git diff --check`: clean for tracked diffs; direct trailing-whitespace scan over the touched files also returned no matches.

Remaining risk:

- S029 currently handles numeric fuzzy year phrases with a simple +/- 1 year interval. It does not yet parse non-numeric eras, seasons, lunar dates, or multi-century vague ranges.

## 2026-07-04 Cross-Region Mechanism Tier Slice

- Closed the S030 MVP-simple cross-region mechanism gate.
- Added `CrossRegionMechanismReview` / `EpochCrossRegionMechanismReview` metadata for lore contributions.
- `record_lore_contribution` now detects cross-region mechanism claims and identifies high-tier mechanisms including:
  - dream rifts
  - rifts
  - old-god whispers
- High-tier or cross-region connection claims are rejected unless they provide at least one support signal:
  - chapter permission
  - route support
  - explicit explanation
- Supported cross-region claims are recorded with mechanism tier, mechanism kind, detected source/target regions and support type.
- Agent Console recent lore contribution cards now show a compact `跨区机制` label.

Verification:

- `node --import tsx --test --test-name-pattern "cross-region mechanism reviews" src/agent/AgentExplorer.layout.test.ts`: failed first because `EpochCrossRegionMechanismReview`, contribution field, UI label and CSS did not exist; passed after adding the S030 surface.
- `node --import tsx --test --test-name-pattern "unexplained high-tier cross-region" ../agent-server/test/mcp.test.ts`: failed first because unexplained dream-rift cross-region claims were accepted; passed after requiring support.
- `npm run typecheck`: passed from `tools/graph-react-app`, including no JS/MJS/CJS/JSX source, no explicit production `any`, the mechanical strict serial validation audit with `scope_marker_failures=0`, web typecheck and agent-server typecheck.
- `npm run agent:ui-test`: passed 169/169 from `tools/graph-react-app`.
- `npm run build`: passed from `tools/graph-react-app` and exported `00_总览/黑曜纪元3D世界地图.html`.
- `git diff --check`: clean for tracked diffs; direct trailing-whitespace scan over the touched files also returned no matches.

Remaining risk:

- S030 uses deterministic text detection and a small built-in region-name map. It does not yet consult a canonical route graph or durable chapter-permission records.

## 2026-07-04 Rumor Admission Threshold Slice

- Closed the S031 MVP rumor-pool threshold gate.
- Added `RumorAdmissionReview` / `EpochRumorAdmissionReview` metadata to NPC candidates.
- NPC candidate submission now scores:
  - anchor completeness
  - core vibe fit
- Candidates below the minimum anchor or vibe thresholds are converted to `personal_sealed` flavor publication and cannot enter shared lore or automatic canonical NPC creation.
- Candidates meeting both thresholds remain eligible for the shared rumor/candidate path.
- Agent Console NPC candidate cards now show `候选传闻门槛` with anchor and vibe scores.

Verification:

- `node --import tsx --test --test-name-pattern "rumor admission thresholds" src/agent/AgentExplorer.layout.test.ts`: failed first because `EpochRumorAdmissionReview`, candidate field, UI label and CSS did not exist; passed after adding the S031 surface.
- `node --import tsx --test --test-name-pattern "low-anchor low-vibe rumor" ../agent-server/test/mcp.test.ts`: failed first because low-anchor low-vibe NPC candidates were promoted; passed after sealing them from shared lore.
- `npm run typecheck`: passed from `tools/graph-react-app`, including no JS/MJS/CJS/JSX source, no explicit production `any`, the mechanical strict serial validation audit with `scope_marker_failures=0`, web typecheck and agent-server typecheck.
- `npm run agent:ui-test`: passed 170/170 from `tools/graph-react-app`.
- `npm run build`: passed from `tools/graph-react-app` and exported `00_总览/黑曜纪元3D世界地图.html`.
- `git diff --check`: clean for tracked diffs; direct trailing-whitespace scan over the touched files also returned no matches.

Remaining risk:

- S031 uses deterministic text scoring for anchor completeness and core vibe fit. It does not yet use a richer semantic quality model or a configurable threshold table.

## 2026-07-04 Dispute Archive Value Gate Slice

- Closed the S032 MVP dispute archive value gate.
- Added `DisputeArchiveGate` / `EpochDisputeArchiveGate` metadata to lore target status views.
- Lore targets now enter `contested` contribution status only when the dispute archive gate is eligible:
  - both confirmation and refutation have effective evidence
  - the conflict is future-testable
  - the target is not a core-canon hard conflict
- Core-canon hard conflicts keep their evidence view but do not enter the dispute archive as `contested`.
- Agent Console lore target cards now show `争议门槛` with bilateral evidence, testability and core-canon-hard-conflict status.
- During full MCP verification, the earlier S031 rumor-admission gate showed a priority regression: low-anchor sealing was overriding duplicate merges, explicit flavor rejections and existing `watch` review paths. The gate is now limited to otherwise-clear new candidates so S031 still seals weak rumors without bypassing established review outcomes.

Verification:

- `node --import tsx --test --test-name-pattern "dispute archive value gates" src/agent/AgentExplorer.layout.test.ts`: failed first because `EpochDisputeArchiveGate`, target field, UI label and CSS did not exist; passed after adding the S032 surface.
- `node --import tsx --test --test-name-pattern "gates contested lore targets" ../agent-server/test/mcp.test.ts`: failed first because lore target statuses had no dispute archive gate metadata; passed after adding the S032 gate and status narrowing.
- `node --import tsx --test --test-name-pattern "submits story NPC candidates|stratified agent memory|operator overview aggregates" ../agent-server/test/mcp.test.ts`: failed before the S031 priority fix because review outcomes were downgraded to `moderation_hold`; passed after limiting rumor admission to otherwise-clear new candidates.
- `node --import tsx --test --test-name-pattern "seals low-anchor low-vibe rumor candidates|gates contested lore targets" ../agent-server/test/mcp.test.ts`: passed, keeping S031 and S032 focused behavior green together.
- `node --import tsx --test ../agent-server/test/mcp.test.ts`: passed 119/119 from `tools/graph-react-app`.
- `npm run typecheck`: passed from `tools/graph-react-app`, including no JS/MJS/CJS/JSX source, no explicit production `any`, the mechanical strict serial validation audit with `scope_marker_failures=0`, web typecheck and agent-server typecheck.
- `npm run agent:ui-test`: passed 171/171 from `tools/graph-react-app`.
- `npm run build`: passed from `tools/graph-react-app` and exported `00_总览/黑曜纪元3D世界地图.html`.
- `git diff --check`: clean for tracked diffs; direct trailing-whitespace scan over the touched files also returned no matches.

Remaining risk:

- S032 uses deterministic text markers for future-testability and core-canon hard conflicts. It does not yet consult a dedicated canon registry or exploration-task graph.

## 2026-07-04 Canon Candidate Path Slice

- Closed the S033 follow-up-enhancement surface for canon candidate adoption.
- Added `CanonCandidatePath` / `EpochCanonCandidatePath` metadata to lore target adjudications.
- Operator lore adjudication can now request a canon candidate path only when all required gates are present:
  - chapter review ID
  - curator approval
  - migration summary
- Ordinary `confirmed` adjudication remains a shared/verified status and does not become canon candidate metadata by score alone.
- MCP tool schema now exposes `canonCandidate` fields on `obsidian_epoch.adjudicate_lore_target`.
- Agent Console operator adjudication controls now include a compact `正史候选路径` checkbox and the three required fields.

Verification:

- `node --import tsx --test --test-name-pattern "canon candidate path" src/agent/AgentExplorer.layout.test.ts`: failed first because `EpochCanonCandidatePath`, operator fields, submit payload and CSS did not exist; passed after adding the S033 surface.
- `node --import tsx --test --test-name-pattern "canon candidates" ../agent-server/test/mcp.test.ts`: failed first because missing canon-candidate gates were accepted; passed after requiring chapter review, curator approval and migration notes.
- `node --import tsx --test ../agent-server/test/mcp.test.ts`: passed 120/120 from `tools/graph-react-app`.
- `npm run typecheck`: passed from `tools/graph-react-app`, including no JS/MJS/CJS/JSX source, no explicit production `any`, the mechanical strict serial validation audit with `scope_marker_failures=0`, web typecheck and agent-server typecheck.
- `npm run agent:ui-test`: passed 172/172 from `tools/graph-react-app`.
- `npm run build`: passed from `tools/graph-react-app` and exported `00_总览/黑曜纪元3D世界地图.html`.
- `git diff --check`: clean for tracked diffs; direct trailing-whitespace scan over the touched files also returned no matches.

Remaining risk:

- S033 records canon candidate metadata but does not yet add a durable canon registry, public canon archive, or multi-curator approval workflow.

## 2026-07-04 Canon Adoption Attribution Slice

- Closed the S034 follow-up-enhancement surface for canon adoption attribution.
- Extended canon candidate metadata with optional adoption rewrite fields:
  - `adoptedText`
  - `boundaryNote`
- Added server-derived `CanonAdoptionAttribution` / `EpochCanonAdoptionAttribution` metadata.
- Canon candidate attribution now preserves:
  - source contribution event IDs
  - source report event IDs
  - source agent IDs
  - source explorer IDs
  - contribution audit links
  - source report audit links
- The server ignores client-supplied attribution data and derives attribution from validated lore contribution events and their provenance.
- Agent Console operator adjudication controls now include `采纳文字`, `边界说明`, and a note that source reports, explorers and agents are preserved by the server.

Verification:

- `node --import tsx --test --test-name-pattern "canon candidate path" src/agent/AgentExplorer.layout.test.ts`: failed first because `EpochCanonAdoptionAttribution`, rewrite fields and UI controls did not exist; passed after adding the S034 surface.
- `node --import tsx --test --test-name-pattern "canon candidates" ../agent-server/test/mcp.test.ts`: failed first because canon candidates did not preserve adopted text, boundary notes or source attribution; passed after deriving attribution from source contribution provenance.
- `node --import tsx --test ../agent-server/test/mcp.test.ts`: passed 120/120 from `tools/graph-react-app`.
- `npm run typecheck`: passed from `tools/graph-react-app`, including no JS/MJS/CJS/JSX source, no explicit production `any`, the mechanical strict serial validation audit with `scope_marker_failures=0`, web typecheck and agent-server typecheck.
- `npm run agent:ui-test`: passed 172/172 from `tools/graph-react-app`.
- `npm run build`: passed from `tools/graph-react-app` and exported `00_总览/黑曜纪元3D世界地图.html`.
- `git diff --check`: clean for tracked diffs; direct trailing-whitespace scan over the touched files also returned no matches.

Remaining risk:

- S034 preserves source attribution inside canon candidate metadata, but does not yet render a public canon adoption page or enforce a multi-author credit display policy outside adjudication consumers.

## 2026-07-04 Personal Version Migration Summary Slice

- Closed the S035 follow-up-enhancement surface for personal version migration summaries.
- Added a server-derived `EpochPersonalMigrationSummary` read model grouped into:
  - retained
  - downgraded
  - needs evidence
  - adopted
  - sealed
- Lore target status projection now includes contributing explorer IDs so the summary can be scoped by agent and/or explorer.
- Classification is derived from existing lore contribution and adjudication state:
  - canon candidates become adopted
  - refuted targets become sealed
  - downgraded revised targets become downgraded
  - contribution-only or contested targets become needs evidence
  - remaining adjudicated targets become retained
- Exposed the summary through:
  - `obsidian_epoch.personal_migration_summary`
  - `GET /api/epoch/personal-migration-summary`
  - `getEpochPersonalMigrationSummary`
  - an Agent Console `个人版本迁移` panel beside stratified memory

Verification:

- `node --import tsx --test --test-name-pattern "personal version migration" src/agent/AgentExplorer.layout.test.ts`: failed first because migration summary types, API usage, refresh wiring and UI labels did not exist; passed after adding the S035 surface.
- `node --import tsx --test --test-name-pattern "personal migration summary API" src/agent/api.test.ts`: failed first because `getEpochPersonalMigrationSummary` was not exported; passed after adding the API wrapper.
- `node --import tsx --test --test-name-pattern "personal lore version migration" ../agent-server/test/mcp.test.ts`: failed first because the MCP tool was not registered; passed after adding the server read model and tool.
- `npm run typecheck`: passed from `tools/graph-react-app`, including no JS/MJS/CJS/JSX source, no explicit production `any`, the mechanical strict serial validation audit with `scope_marker_failures=0`, web typecheck and agent-server typecheck.
- `node --import tsx --test ../agent-server/test/mcp.test.ts`: passed 121/121 from `tools/graph-react-app`.
- `npm run agent:ui-test`: passed 174/174 from `tools/graph-react-app`.
- `npm run build`: passed from `tools/graph-react-app` and exported `00_总览/黑曜纪元3D世界地图.html`.
- `git diff --check`: clean for tracked diffs; direct trailing-whitespace scan over the touched files also returned no matches.

Remaining risk:

- S035 summarizes the current migration impact from existing lore target state. It does not yet create a durable per-version migration artifact, notification feed, or user-facing diff between two named world versions.

## 2026-07-04 Source Authority Slice

- Closed the S036 MVP surface for official-material authority levels.
- Added shared `EpochSourceAuthority` values:
  - `core`
  - `official`
  - `derived`
  - `low-confidence`
- Context snapshot setting cards now carry `sourceAuthority`.
- Context snapshots include an authority policy declaring that hard refutations may rely on `core`/`official`, while `derived`/`low-confidence` are forbidden as sole hard-refutation bases.
- Lore source-event provenance now carries `sourceAuthority`.
- Lore adjudication source-contribution provenance now carries `sourceAuthority`.
- Source-authority derivation currently maps:
  - `system_worker` to `core`
  - server-issued identity/reincarnation events to `official`
  - owner/server-hosted/attested trusted channels to `official`
  - derived lore revisions to `derived`
  - non-evidence or untrusted events to `low-confidence`
- `obsidian_epoch.record_lore_contribution` now rejects refutation writes when every source event is `derived` or `low-confidence`.

Verification:

- `node --import tsx --test --test-name-pattern "source authority" ../agent-server/test/context.test.ts`: failed first because context setting cards had no `sourceAuthority` and snapshots had no authority policy; passed after adding S036 context metadata.
- `node --import tsx --test --test-name-pattern "hard lore refutations" ../agent-server/test/mcp.test.ts`: failed first because lore provenance had no `sourceAuthority`; after adding metadata it exposed identity-issued events being treated as low-confidence from transport trust alone; passed after explicitly marking server-issued identity/reincarnation events as official.
- `node --import tsx --test ../agent-server/test/context.test.ts`: passed 10/10 from `tools/graph-react-app`.
- `npm run typecheck`: passed from `tools/graph-react-app`, including no JS/MJS/CJS/JSX source, no explicit production `any`, the mechanical strict serial validation audit with `scope_marker_failures=0`, web typecheck and agent-server typecheck.
- `node --import tsx --test ../agent-server/test/mcp.test.ts`: passed 122/122 from `tools/graph-react-app`.
- `npm run agent:ui-test`: passed 174/174 from `tools/graph-react-app`.
- `npm run build`: passed from `tools/graph-react-app` and exported `00_总览/黑曜纪元3D世界地图.html`.

Remaining risk:

- S036 uses a deterministic MVP source-authority mapper. It does not yet model a dedicated official-source registry, per-document publisher signatures, or mixed-source weighting beyond allowing a hard refutation when at least one source is `core` or `official`.

## 2026-07-04 Low-Confidence Review Slice

- Closed the S037 follow-up-enhancement surface for low-confidence data review.
- Added `EpochLoreAuthorityReview` to lore target adjudications.
- Authority review records:
  - source authority levels
  - high-authority source contribution event IDs
  - low-authority source contribution event IDs
  - evidence quality
  - oldest/latest source recorded times
  - whether hard refutation is allowed
  - recommended review status
- Operator lore adjudication now rejects `refuted` outcomes when every source contribution is `derived` or `low-confidence`.
- The same low-authority source set can still be adjudicated as `contested`, preserving the review record instead of directly rejecting the user claim.

Verification:

- `node --import tsx --test --test-name-pattern "low-authority lore adjudication" ../agent-server/test/mcp.test.ts`: failed first because operator adjudication could directly `refuted` a target using only derived-source contribution evidence; passed after adding `EpochLoreAuthorityReview` and the low-authority hard-refutation gate.
- `npm run typecheck`: passed from `tools/graph-react-app`, including no JS/MJS/CJS/JSX source, no explicit production `any`, the mechanical strict serial validation audit with `scope_marker_failures=0`, web typecheck and agent-server typecheck.
- `node --import tsx --test ../agent-server/test/mcp.test.ts`: passed 123/123 from `tools/graph-react-app`.
- `npm run agent:ui-test`: passed 174/174 from `tools/graph-react-app`.
- `npm run build`: passed from `tools/graph-react-app` and exported `00_总览/黑曜纪元3D世界地图.html`.

Remaining risk:

- S037 records authority review metadata and blocks direct low-authority refutations, but the evidence-quality score is still coarse. It does not yet run a multi-factor adjudicator over semantic evidence quality, source independence, or contradiction distance.

## 2026-07-04 Unopened Chapter Prefile Isolation Slice

- Closed the S038 MVP surface for isolating unopened or low-exposure chapter material.
- Region commissions now carry `EpochPrefileIsolation` with:
  - active versus prefile layer
  - isolation reason
  - settlement/reward/territory/battle eligibility
  - future-hook-only status
  - a generated future hook note
- Commissions with non-public secret exposure tiers or chapter-locked reveal budgets now enter the prefile layer.
- Prefile commissions no longer expose immediate rewards in the region commission read model.
- Prefile commissions use the frontstage action label `预档未来钩子`.
- The Agent Console now shows whether a commission is current-chapter-settleable or prefiled as a future hook.

Verification:

- `node --import tsx --test --test-name-pattern "chapter-lock over-budget secret clues" ../agent-server/test/mcp.test.ts`: failed first because region commissions had no `prefileIsolation`; passed after adding the read-model policy and reward isolation.
- `node --import tsx --test --test-name-pattern "unopened chapter prefile isolation" src/agent/AgentExplorer.layout.test.ts`: failed first because UI/API types and the console surface did not expose prefile isolation; passed after adding the frontend type and render surface.
- `npm run typecheck`: passed from `tools/graph-react-app`, including no JS/MJS/CJS/JSX source, no explicit production `any`, the mechanical strict serial validation audit with `scope_marker_failures=0`, web typecheck and agent-server typecheck.
- `node --import tsx --test ../agent-server/test/mcp.test.ts`: passed 123/123 from `tools/graph-react-app`.
- `npm run agent:ui-test`: passed 175/175 from `tools/graph-react-app`.
- `npm run build`: passed from `tools/graph-react-app` and exported `00_总览/黑曜纪元3D世界地图.html`.

Remaining risk:

- S038 isolates unopened material at the region commission/frontstage read-model layer. Direct low-level settlement tools are not yet guarded by a global prefile eligibility check, so later slices should add command-level enforcement if hidden material becomes addressable outside commissions.

## 2026-07-04 Location Motif Dynamic Reward Slice

- Closed the S039 enhancement surface for location motif driven task and reward bias.
- Region commissions now carry `EpochLocationMotifBias` with:
  - dominant motif
  - motif label
  - task-generation bias copy
  - recommended reward resource
  - reward bias copy
  - a compact summary
- The dominant motif is selected from existing location motif quotas by:
  - dense motif first
  - highest count-to-quota ratio
  - highest raw count
  - deterministic motif tie-break
- The six MVP motif mappings are:
  - ecology -> focus
  - creature -> aether
  - faction -> legend
  - anomaly -> aether
  - resource -> coin
  - character -> focus
- Region commission summaries now include the active location motif bias.
- The Agent Console commission list now shows motif and reward-bias tags beside secret exposure and prefile status.

Verification:

- `node --import tsx --test --test-name-pattern "dominant location motifs" ../agent-server/test/mcp.test.ts`: failed first because generated region commissions had no `locationMotifBias`; passed after deriving the dominant motif from region quotas and applying it to commissions.
- `node --import tsx --test --test-name-pattern "location motif commission reward bias" src/agent/AgentExplorer.layout.test.ts`: failed first because frontend types and the console row did not expose motif reward bias; passed after adding the type, render surface and CSS hook.
- `npm run typecheck`: passed from `tools/graph-react-app`, including no JS/MJS/CJS/JSX source, no explicit production `any`, the mechanical strict serial validation audit with `scope_marker_failures=0`, web typecheck and agent-server typecheck.
- `node --import tsx --test ../agent-server/test/mcp.test.ts`: passed 124/124 from `tools/graph-react-app`.
- `npm run agent:ui-test`: passed 176/176 from `tools/graph-react-app`.
- `npm run build`: passed from `tools/graph-react-app` and exported `00_总览/黑曜纪元3D世界地图.html`.

Remaining risk:

- S039 applies dynamic motif influence at the region commission read-model/recommendation layer. It does not yet rewrite underlying settlement rewards, resource-node templates, anomaly templates, or per-source commission generation strategies.

## 2026-07-04 MVP Worldview Gate Minimum Set Slice

- Closed the S040 MVP surface for keeping worldbuilding review scope bounded.
- Lore target status projections now include `EpochWorldviewGate`.
- The gate declares:
  - `scope: mvp_minimum`
  - `deferredRuleSet: phase_two`
  - the exact six enforced check keys
- The enforced S040 checks are:
  - `layer_label`
  - `secret_tier`
  - `anchor_integrity`
  - `core_vibe`
  - `duplicate_or_conflict`
  - `rumor_floor`
- Gate checks report `passed`, `flagged`, or `needs_review`.
- Duplicate/conflict detection is surfaced as a flag on folded lore targets rather than expanding the rejection surface.
- The Agent Console now shows an `MVP 守门` line on lore target cards with all six check results.

Verification:

- `node --import tsx --test --test-name-pattern "server-authoritative lore contributions" ../agent-server/test/mcp.test.ts`: failed first because lore targets had no `worldviewGate`; passed after adding the S040 MVP gate projection.
- `node --import tsx --test --test-name-pattern "MVP worldview gate" src/agent/AgentExplorer.layout.test.ts`: failed first because frontend types and lore cards did not expose the gate; passed after adding type and UI support.
- `npm run typecheck`: passed from `tools/graph-react-app`, including no JS/MJS/CJS/JSX source, no explicit production `any`, the mechanical strict serial validation audit with `scope_marker_failures=0`, web typecheck and agent-server typecheck.
- `node --import tsx --test ../agent-server/test/mcp.test.ts`: passed 124/124 from `tools/graph-react-app`.
- `npm run agent:ui-test`: passed 177/177 from `tools/graph-react-app`.
- `npm run build`: passed from `tools/graph-react-app` and exported `00_总览/黑曜纪元3D世界地图.html`.

Remaining risk:

- S040 is an MVP projection and audit surface. It does not yet block every lore contribution at write time, nor does it implement phase-two worldbuilding rules beyond marking them deferred.

## 2026-07-04 Key Component Isolation Slice

- Closed the S041 MVP surface for keeping key material out of error/reporting paths.
- Added `keyIsolation.ts` with:
  - `sanitizeKeyMaterialInText`
  - `sanitizeKeyMaterialForErrorPayload`
  - `sanitizeKeyMaterialErrorMessage`
  - `KEY_MATERIAL_REDACTION`
- The sanitizer redacts:
  - recovery-code shaped base64 JSON tokens
  - `recoveryCode` and `newRecoveryCode` fields
  - `localSecret`
  - `operatorKey`
  - `apiKey`/`api_key`
  - `authorization`, `token`, and `secret`
  - OpenAI-style `sk-...` keys
  - `local_...` secret tokens
- `AgentExplorer` now routes displayed error messages through the key-material sanitizer.
- The install/status diagnostic payload keeps reporting whether an operator key is filled, but errors feeding into it are already sanitized and raw key values are not inserted.
- Added `keyIsolation.test.ts` to `npm run agent:ui-test`.

Verification:

- `node --import tsx --test src/agent/keyIsolation.test.ts`: failed first because `keyIsolation` did not exist; passed after adding the sanitizer module.
- `npm run typecheck`: passed from `tools/graph-react-app`, including no JS/MJS/CJS/JSX source, no explicit production `any`, the mechanical strict serial validation audit with `scope_marker_failures=0`, web typecheck and agent-server typecheck.
- `node --import tsx --test ../agent-server/test/mcp.test.ts`: passed 124/124 from `tools/graph-react-app`.
- `npm run agent:ui-test`: passed 179/179 from `tools/graph-react-app`.
- `npm run build`: passed from `tools/graph-react-app` and exported `00_总览/黑曜纪元3D世界地图.html`.

Remaining risk:

- S041 provides a shared sanitizer and routes current Agent Console error display through it. There is still no external analytics/error-reporting integration in this repo; if one is added later, it must call `sanitizeKeyMaterialForErrorPayload` before sending payloads off-device.

## 2026-07-04 User Text Key Scan Slice

- Closed the S042 MVP surface for blocking suspected API keys in user-authored text before upload.
- Extended `keyIsolation.ts` with:
  - `findKeyMaterialInUserTextPayload`
  - `assertNoKeyMaterialInUserTextPayload`
  - `KeyMaterialDetection`
- The user-text scanner reuses the S041 key-material detection and scans text-like payload fields such as:
  - `body`
  - `prompt`
  - `summary`
  - `storyEvidence`
  - `visibleText`
  - `publicNote`
  - `additionalInstruction`
  - `report`
- Authorization fields such as `recoveryCode` and `operatorKey` are not treated as user-authored text, preventing false blocks for normal authenticated requests.
- `postJson` now calls `assertNoKeyMaterialInUserTextPayload` before network submission, so browser-side POST requests fail locally with `api_key_detected` when user text contains key-shaped material.

Verification:

- `node --import tsx --test --test-name-pattern "key-shaped user text" src/agent/keyIsolation.test.ts`: failed first because the user-text detection API did not exist; passed after adding detection and assertion helpers.
- `node --import tsx --test --test-name-pattern "blocks key-shaped user text" src/agent/api.test.ts`: failed first because `postEpochMessage` still called `fetch`; passed after adding the pre-flight scan in `postJson`.
- `npm run typecheck`: passed from `tools/graph-react-app`, including no JS/MJS/CJS/JSX source, no explicit production `any`, the mechanical strict serial validation audit with `scope_marker_failures=0`, web typecheck and agent-server typecheck.
- `node --import tsx --test ../agent-server/test/mcp.test.ts`: passed 124/124 from `tools/graph-react-app`.
- `npm run agent:ui-test`: passed 181/181 from `tools/graph-react-app`.
- `npm run build`: passed from `tools/graph-react-app` and exported `00_总览/黑曜纪元3D世界地图.html`.

Remaining risk:

- S042 blocks key-shaped strings in known user-text fields at the shared browser API layer. If future endpoints introduce new user-text field names, they should be added to `USER_TEXT_FIELD_NAMES`.

## 2026-07-04 External Setting Reference Wrapper Slice

- Closed the S043 MVP surface for isolating external setting text before it reaches prompts.
- `ContextSnapshotSettingCard` now carries a `promptReference` wrapper:
  - `role: reference_material`
  - `promptSection: reference_materials`
  - `quoteMode: quoted_reference_only`
  - `instructionAuthority: none`
- External anchors with `type: "external_setting"` are projected into `external_setting_reference` cards with `sourceAuthority: derived` and low exposure.
- External setting text is kept out of `systemPolicy` and `agentIdentityBoundary`; it remains quoted reference material only.
- Added `instructionReview` on setting cards so instruction-shaped external text is detected separately from prompt authority. The MVP reviewer flags override attempts, system/developer-shaped text, tool-instruction-shaped text and credential-instruction-shaped text.

Verification:

- `node --import tsx --test --test-name-pattern "external settings as quoted references" ../agent-server/test/context.test.ts`: failed first because the external setting card did not exist; passed after adding reference-card wrapping and instruction review.
- `npm run typecheck`: passed from `tools/graph-react-app`, including no JS/MJS/CJS/JSX source, no explicit production `any`, the mechanical strict serial validation audit with `scope_marker_failures=0`, web typecheck and agent-server typecheck.
- `node --import tsx --test ../agent-server/test/context.test.ts`: passed 11/11 from `tools/graph-react-app`.
- `node --import tsx --test ../agent-server/test/mcp.test.ts`: passed 124/124 from `tools/graph-react-app`.
- `npm run agent:ui-test`: passed 181/181 from `tools/graph-react-app`.
- `npm run build`: passed from `tools/graph-react-app` and exported `00_总览/黑曜纪元3D世界地图.html`.

Remaining risk:

- S043 currently wraps external anchors accepted through `createContextPackage`. Future prompt assembly surfaces that ingest external documents directly must reuse this reference-only wrapper before including the text.

## 2026-07-04 Public-Safe Share Summary Slice

- Closed the S044 MVP surface for result-page sharing summaries.
- Result page drafts now include `publicSafeSummary`, generated only from server-safe identity/focus/receipt facts.
- Published `EpochSharedResultPage` records copy the same `publicSafeSummary` to the page envelope so share surfaces do not need to derive text from internal payload details.
- World overview recent-result cards now expose `publicSafeSummary` instead of requiring clients to clip event payloads, adjudication details or review reasons.
- Agent Console share cards and world overview links render `publicSafeSummary.text`.
- Public result page HTML displays the public-safe summary in the hero area.
- The summary metadata explicitly excludes adjudication verdicts, review reasons, hidden constraint prompts and event payload bodies from the share-summary source set.

Verification:

- `node --import tsx --test --test-name-pattern "public-safe share summaries" ../agent-server/test/mcp.test.ts`: failed first because result-page previews had no `publicSafeSummary`; passed after adding the server-generated public-safe summary and publishing it through page/world overview projections.
- `node --import tsx --test --test-name-pattern "result share card" src/agent/AgentExplorer.layout.test.ts`: failed first because the share card did not reference `publicSafeSummary`; passed after rendering `shareCardStatus.publicSafeSummary.text`.
- `npm run typecheck`: passed from `tools/graph-react-app`, including no JS/MJS/CJS/JSX source, no explicit production `any`, the mechanical strict serial validation audit with `scope_marker_failures=0`, web typecheck and agent-server typecheck.
- `node --import tsx --test ../agent-server/test/mcp.test.ts`: passed 125/125 from `tools/graph-react-app`.
- `npm run agent:ui-test`: passed 181/181 from `tools/graph-react-app`.
- `npm run build`: passed from `tools/graph-react-app` and exported `00_总览/黑曜纪元3D世界地图.html`.

Remaining risk:

- S044 protects result-page share summaries. Other future public share surfaces must consume `publicSafeSummary` or an equivalent server-owned public-safe summary instead of clipping internal review text.

## 2026-07-04 Recovery Code Safe Display Slice

- Closed the remaining S045 MVP surface for reducing recovery-code screenshot leakage.
- Recovery codes remain masked by default.
- The reveal action is now one-time per local recovery material:
  - first click reveals the code and records `recoveryCodeRevealUsed`
  - the user can still hide the visible code
  - after hiding, the reveal button becomes `已显示一次`
  - rotation and archive import reset the one-time reveal state for the new local recovery material
- Encrypted archive export now requires a two-step confirmation:
  - first click arms the export and warns not to screenshot the recovery code
  - second click downloads the encrypted Explorer archive
  - changing the archive passphrase disarms the export
- The archive section now explicitly tells players to download an encrypted backup instead of screenshotting the recovery code.

Verification:

- `node --import tsx --test --test-name-pattern "recovery code|encrypted explorer archives" src/agent/AgentExplorer.layout.test.ts`: failed first because one-time reveal and export confirmation state did not exist; passed after adding `recoveryCodeRevealUsed`, `archiveExportArmed`, one-time reveal helpers and two-step archive export.
- `npm run typecheck`: passed from `tools/graph-react-app`, including no JS/MJS/CJS/JSX source, no explicit production `any`, the mechanical strict serial validation audit with `scope_marker_failures=0`, web typecheck and agent-server typecheck.
- `npm run agent:ui-test`: passed 181/181 from `tools/graph-react-app`.
- `npm run build`: passed from `tools/graph-react-app` and exported `00_总览/黑曜纪元3D世界地图.html`.

Remaining risk:

- S045 lowers accidental exposure in the web console, but cannot prevent screenshots after the one allowed reveal. The recommended recovery path remains encrypted Explorer archive backup.

## 2026-07-04 Worldbuilding Content Safety Boundary Slice

- Closed the S047 MVP surface for distinguishing allowed fictional worldbuilding from disallowed real-world unsafe content.
- `contentPolicy` now exposes `safetyBoundary` through quickstart:
  - `allowedFictionalContent`: fictional dark fantasy, biomorphic body horror, non-graphic monstrous transformation and world-lore violence without real instructions
  - `disallowedRealWorldContent`: real-world harm instructions, explicit sexual content, hate/harassment and illegal-activity instructions
  - `falsePositiveAppeal`: available via `operator_moderation_appeal`
- Region-specific content policy configs inherit the default safety boundary unless explicitly overridden.
- Agent Console now shows a compact worldbuilding content safety boundary:
  - worldbuilding allowed: dark fantasy, transformation, monsters, non-realistic horror atmosphere
  - real-world boundary: harm instructions, explicit sexual content, hate harassment, illegal operations
  - false-positive appeal route: `operator_moderation_appeal`

Verification:

- `node --import tsx --test --test-name-pattern "tool registry" ../agent-server/test/mcp.test.ts`: failed first because `contentPolicy.safetyBoundary` did not exist; passed after adding default/normalized/resolved safety-boundary policy fields.
- `node --import tsx --test --test-name-pattern "content safety boundary" src/agent/AgentExplorer.layout.test.ts`: failed first because the Agent Console did not display the boundary or appeal route; passed after adding the local content-safety boundary panel.
- `npm run typecheck`: passed from `tools/graph-react-app`, including no JS/MJS/CJS/JSX source, no explicit production `any`, the mechanical strict serial validation audit with `scope_marker_failures=0`, web typecheck and agent-server typecheck.
- `node --import tsx --test ../agent-server/test/mcp.test.ts`: passed 125/125 from `tools/graph-react-app`.
- `npm run agent:ui-test`: passed 182/182 from `tools/graph-react-app`.
- `npm run build`: passed from `tools/graph-react-app` and exported `00_总览/黑曜纪元3D世界地图.html`.

Remaining risk:

- S047 adds explicit policy and appeal surfacing. It does not implement a full classifier for every unsafe-content category; existing moderation queues and operator review still enforce specific holds.

## 2026-07-04 Private Report Claim Gate Slice

- Closed the S048 MVP surface for preventing private or unconfirmed battle reports from creating shared world claims.
- `submitBattleReport` now computes a `publicClaimGate` for shared lore claims.
- Public claim admission now requires all existing review-candidate conditions plus explicit public adjudication confirmation through `publicAdjudicationConfirmed` or the compatibility alias `publicClaimConsent`.
- Public but unconfirmed reports can still settle and appear as public archive records, but their lore admission is withheld with `withheld_pending_public_adjudication_confirmation`.
- Private reports continue to adjudicate as `private_demo`, do not appear in the public world archive, and cannot become reusable shared claim sources.
- Settlement responses include `publicClaimGate` so clients and tests can distinguish confirmed public adjudication from withheld shared-claim admission.

Verification:

- `node --import tsx --test --test-name-pattern "shared claims until public adjudication" ../agent-server/test/mcp.test.ts`: failed first because `publicClaimGate` was absent from settlement responses; passed after adding the gate helper, admit condition and response field.
- `npm run typecheck`: passed from `tools/graph-react-app`, including no JS/MJS/CJS/JSX source, no explicit production `any`, the mechanical strict serial validation audit with `scope_marker_failures=0`, web typecheck and agent-server typecheck.
- `node --import tsx --test ../agent-server/test/mcp.test.ts`: passed 126/126 from `tools/graph-react-app`.
- `npm run agent:ui-test`: passed 182/182 from `tools/graph-react-app`.
- `npm run build`: passed from `tools/graph-react-app` and exported `00_总览/黑曜纪元3D世界地图.html`.

Remaining risk:

- S048 gates legacy shared claim admission for submitted battle reports. Future non-legacy claim-admission paths should use the same explicit public adjudication confirmation rule before writing reusable world lore.

## 2026-07-04 Deleted Body Minimal Reference Slice

- Closed the S049 MVP surface for preventing deleted public result bodies from being reconstructed through downstream references.
- Deleted result-page tombstones now expose `deletionSummary.minimalReference` as the only reusable reference material:
  - `referenceType: deleted_result_page_minimal_reference`
  - `anonymousSourceHash`
  - claim-level facts for `pageId`, `focusKind`, hashed focus id and canonical event count
  - removed body classes for payload, public-safe summary text, progress snapshots, regional context, event bodies and long summaries
- Deleted result-page summaries now clear raw `canonicalEventIds` and tighten `retainedFacts` to the minimal reference plus audit hashes and deletion classification.
- Packaged host guidance and protocol references now instruct agents not to reconstruct or quote deleted bodies from old summaries.
- While rerunning full validation, fixed two existing contract drifts:
  - HTTP region leaderboard coverage now expects prefile-isolated commissions to show `预档未来钩子` and no reward after chapter-lock over-budget isolation.
  - package install manifests now list `obsidian_epoch.personal_migration_summary`, matching the live MCP tool registry.

Verification:

- `node --import tsx --test --test-name-pattern "delete result page separates body archive" ../agent-server/test/mcp.test.ts`: failed first because `minimalReference` was absent; passed after adding the minimal tombstone reference and clearing raw canonical event ids.
- `node --import tsx --test --test-name-pattern "HTTP delete result page persists only a tombstone summary" ../agent-server/test/server.test.ts`: passed after asserting the same minimal reference on HTTP deletion and persisted JSONL tombstones.
- `node --import tsx --test --test-name-pattern "downloadable package contains skill and plugin manifests" ../agent-server/test/packageArchive.test.ts`: exposed the existing missing `personal_migration_summary` manifest entry; passed after adding it to both install manifests.
- `node --import tsx --test --test-name-pattern "HTTP region info and public region page expose canonical region leaderboards" ../agent-server/test/server.test.ts`: exposed the existing prefile isolation assertion drift; passed after aligning the test with current `预档未来钩子` behavior.
- `npm run typecheck`: passed from `tools/graph-react-app`, including no JS/MJS/CJS/JSX source, no explicit production `any`, the mechanical strict serial validation audit with `scope_marker_failures=0`, web typecheck and agent-server typecheck.
- `node --import tsx --test ../agent-server/test/mcp.test.ts`: passed 126/126 from `tools/graph-react-app`.
- `node --import tsx --test ../agent-server/test/server.test.ts`: passed 108/108 from `tools/graph-react-app`.
- `node --import tsx --test ../agent-server/test/packageArchive.test.ts`: passed 7/7 from `tools/graph-react-app`.
- `npm run agent:ui-test`: passed 182/182 from `tools/graph-react-app`.
- `npm run build`: passed from `tools/graph-react-app` and exported `00_总览/黑曜纪元3D世界地图.html`.

Remaining risk:

- S049 minimizes deleted result-page references and packaged guidance. Internal authorization metadata still exists on tombstones for owner/operator checks; any future public or cross-agent tombstone projection must use `minimalReference` rather than raw deletion-summary identity fields.

## 2026-07-04 Sensitive Info Pre-Key Notice Slice

- Closed the S050 MVP-simple surface for warning before Key/model-provider calls and exposing a high-stimulus age/region compliance switch.
- Agent Console first screen now shows a `首次 Key 调用隐私提示` panel before the operator section.
- The panel explicitly warns: do not enter real identity, contact information, school or home address; third-party model/vendor logs may retain requests.
- Added a high-stimulus age/region compliance confirmation checkbox and compact region selector (`US`, `CN`, `EU`) on the first screen.
- The high-stimulus preflight panel now echoes the same compliance status and selected region beside the existing low-stimulation mode.
- The new controls stay local UI state and do not send new personal data to the server.

Verification:

- `node --import tsx --test --test-name-pattern "S050 privacy" src/agent/AgentExplorer.layout.test.ts`: failed first because the privacy notice and compliance controls did not exist; passed after adding constants, state, first-screen panel and CSS.
- `npm run typecheck`: passed from `tools/graph-react-app`, including no JS/MJS/CJS/JSX source, no explicit production `any`, the mechanical strict serial validation audit with `scope_marker_failures=0`, web typecheck and agent-server typecheck.
- `npm run agent:ui-test`: passed 183/183 from `tools/graph-react-app`.
- `npm run build`: passed from `tools/graph-react-app` and exported `00_总览/黑曜纪元3D世界地图.html`.

Remaining risk:

- S050 is the requested MVP-simple UI guard. It does not implement hard server-side age verification or jurisdiction-specific legal classification; future hosted-provider integrations should pass an explicit `contentPolicyRegion`/compliance result into quickstart or preflight before external model calls.

## 2026-07-04 Low-Risk Rumor Reward Cap Slice

- Closed the S051 MVP surface for capping low-risk commission rumor rewards.
- Lore admission now treats explicitly low-risk sources (`riskLevel`/`risk` family values such as `low` or `低风险`) as `rumor` rather than `canonical`.
- Added per-explorer low-risk rumor admission records with date and week buckets:
  - daily cap: 1 admitted low-risk rumor contribution
  - weekly cap: 3 admitted low-risk rumor contributions
- Over-cap new low-risk claims are withheld as `personal_sealed` with `low_risk_rumor_daily_cap` or `low_risk_rumor_weekly_cap`.
- Over-cap duplicate low-risk claims are retained only as `evidence_supplement`, do not enter `accepted`, and do not trigger source rewards.
- The lore ledger state now includes `lowRiskRumorAdmissions` so cap history persists with the rest of the server lore state.

Verification:

- `node --import tsx --test --test-name-pattern "low-risk rumor admissions" ../agent-server/test/lore.test.ts`: failed first because low-risk claims were still admitted as `canonical`; passed after adding rumor status and daily/weekly cap tracking.
- `node --import tsx --test --test-name-pattern "low-risk|over-cap" ../agent-server/test/lore.test.ts`: passed after adding the evidence-supplement/no-reward duplicate overflow guard.
- `node --import tsx --test ../agent-server/test/lore.test.ts`: passed 9/9 from `tools/graph-react-app`.
- `npm run typecheck`: passed from `tools/graph-react-app`, including no JS/MJS/CJS/JSX source, no explicit production `any`, the mechanical strict serial validation audit with `scope_marker_failures=0`, web typecheck and agent-server typecheck.
- `node --import tsx --test ../agent-server/test/mcp.test.ts`: passed 126/126 from `tools/graph-react-app`.
- `npm run agent:ui-test`: passed 183/183 from `tools/graph-react-app`.
- `npm run build`: passed from `tools/graph-react-app` and exported `00_总览/黑曜纪元3D世界地图.html`.

Remaining risk:

- S051 enforces the MVP cap in the shared lore ledger. If future low-risk reward paths bypass `admitRunClaims`, they must call the same cap policy before awarding reputation or reusable source rewards.

## 2026-07-04 High-Risk Structural Scoring Slice

- Closed the S052 MVP surface for making high-risk score depend on structure rather than ornate prose.
- `adjudicateRun` now evaluates each high-risk event for:
  - authorization record
  - paid cost
  - evidence chain
  - limitations or constraints
- Structurally incomplete high-risk events no longer contribute event/evidence score and cap the run score at repair-only (`59`).
- Adjudication responses now expose `high_risk_structure_missing:*` reasons and a `highRiskStructure` summary for high-risk events.
- MCP legacy report submission now returns repair-only adjudication for confirmed but structurally incomplete high-risk events: no claimSlots, no shared lore admission and no progression reward.
- Legacy public-run fixtures now include high-risk structural fields, and context/package protocol guidance tells external agents to include authorization, cost, evidence-chain and limitation fields for high-risk authored reports.

Verification:

- `node --import tsx --test --test-name-pattern "high-risk structure" ../agent-server/test/adjudicator.test.ts`: failed first because ornate but structurally incomplete high-risk reports still reached review; passed after adding structure checks, score exclusion and repair cap.
- `node --import tsx --test ../agent-server/test/adjudicator.test.ts`: passed 8/8 from `tools/graph-react-app`.
- `node --import tsx --test --test-name-pattern "structurally incomplete legacy high-risk" ../agent-server/test/mcp.test.ts`: passed after adding MCP integration coverage for repair-only high-risk structure failures.
- `node --import tsx --test ../agent-server/test/context.test.ts`: passed 11/11 after context-package guidance updates.
- `node --import tsx --test --test-name-pattern "downloadable package|packaged skill" ../agent-server/test/packageArchive.test.ts`: passed 2/2 after packaged protocol guidance updates.
- `npm run typecheck`: passed from `tools/graph-react-app`, including no JS/MJS/CJS/JSX source, no explicit production `any`, the mechanical strict serial validation audit with `scope_marker_failures=0`, web typecheck and agent-server typecheck.
- `node --import tsx --test ../agent-server/test/mcp.test.ts`: passed 127/127 from `tools/graph-react-app`.
- `node --import tsx --test ../agent-server/test/server.test.ts`: passed 108/108 from `tools/graph-react-app`.
- `node --import tsx --test --test-name-pattern "public world context|context package and legacy run ticket" ../agent-server/test/server.test.ts`: passed 2/2 after protocol/context wording updates.
- `npm run agent:ui-test`: passed 183/183 from `tools/graph-react-app`.
- `npm run build`: passed from `tools/graph-react-app` and exported `00_总览/黑曜纪元3D世界地图.html`.

Remaining risk:

- S052 enforces structure for legacy authored-report adjudication. Canonical turn, hosted-action and anomaly flows already settle from server templates; any future high-risk scoring path outside `adjudicateRun` must apply the same four-field structure gate before awarding review score, claims or progression.

## 2026-07-04 Mutual Source-Reward Loop Slice

- Closed the S053 MVP-simple surface for source-reward anti-brushing loops.
- The existing source-reward path already delayed first reuse as `pending` and released only after a second independent reuse.
- `addSourceReward` now detects reciprocal explorer loops: if explorer B has already supported explorer A's source reward, and explorer A then supports explorer B's claim, the pair is treated as a mutual source-reward loop.
- All reciprocal rewards for that explorer pair are marked:
  - `status: delayed_review`
  - `delayReason: mutual_source_reward_loop`
  - `riskFlags: ["mutual_source_reward_loop"]`
  - `points: 0`
- The current reciprocal duplicate decision still records the duplicate/evidence path, but the reward remains delayed for review rather than being released.
- MCP integration now verifies the same behavior through legacy battle-report submission and `runtime.loreState()`.

Verification:

- `node --import tsx --test --test-name-pattern "mutual source-reward" ../agent-server/test/lore.test.ts`: failed first because reciprocal source rewards stayed `pending`; passed after adding reciprocal loop detection and delayed-review marking.
- `node --import tsx --test --test-name-pattern "mutual legacy source-reward" ../agent-server/test/mcp.test.ts`: passed after adding an MCP integration case for A/B reciprocal claim reuse.
- `node --import tsx --test ../agent-server/test/lore.test.ts`: passed 10/10 from `tools/graph-react-app`.
- `npm run typecheck`: initially caught a narrow test inference around `state.sourceRewards`; passed after casting the test view to `Record<string, unknown>[]`.
- `node --import tsx --test ../agent-server/test/mcp.test.ts`: passed 128/128 from `tools/graph-react-app`.
- `npm run agent:ui-test`: passed 183/183 from `tools/graph-react-app`.
- `npm run build`: passed from `tools/graph-react-app` and exported `00_总览/黑曜纪元3D世界地图.html`.

Remaining risk:

- S053 implements the MVP anti-brushing loop for direct reciprocal source rewards. Dense bipartite clusters, shared device/IP risk and text-similarity scoring remain second-stage detection layers unless later spec slices require them.

## 2026-07-04 Starter Non-Evidence Clue Verification Slice

- Verified the existing S054 MVP surface for marking first-run/demo clues as `nonEvidence`.
- First high-risk starter turn settlement already marks the protected result and canonical event payload with `nonEvidence: true`.
- First high-risk hosted action settlement uses the same starter-protection policy and emits `nonEvidence: true`.
- Other explorers attempting to reuse a `nonEvidence` starter event as lore evidence are rejected with `lore_contribution_non_evidence_source`.
- Agent Console already surfaces first-run reward isolation and explicitly labels starter output as `nonEvidence` instead of transferable world impact.

Verification:

- `node --import tsx --test --test-name-pattern "first high-risk turn|first high-risk hosted action" ../agent-server/test/epoch-game-core.test.ts`: passed 2/2 from `tools/graph-react-app`.
- `node --import tsx --test --test-name-pattern "nonEvidence starter" ../agent-server/test/server.test.ts`: passed 1/1 from `tools/graph-react-app`.
- `node --import tsx --test --test-name-pattern "isolates first-run rewards" src/agent/AgentExplorer.layout.test.ts`: passed 1/1 from `tools/graph-react-app`.

Remaining risk:

- S054 is covered for starter turn, hosted action and cross-explorer lore reuse. Future demo/local-trial clue paths should continue to preserve `nonEvidence` through their public/event projections before allowing any later evidence contribution.

## 2026-07-04 Server-Adjudicated Settlement Field Verification Slice

- Completed the remaining S055 MVP verification surface after the earlier server-adjudicated claim-quantity slice.
- Canonical turn-card settlement now has explicit regression coverage for ignoring client-supplied settlement fields:
  - `outcomeSummary`
  - `reward`
  - `lifetimeDelta`
  - `rating`
  - `claimSlots`
  - `clientDeclaredOutcome`
- Hosted action settlement has the same coverage and continues to settle from server-issued action options.
- MCP `obsidian_epoch.resolve_turn` now explicitly proves that extra forged settlement fields in the tool call do not affect the returned outcome, reward, lifetime change, rating or claim slots.
- While rerunning full core tests, fixed a stale NPC-candidate fixture: the promotion/merge test now uses a clean Gray Harbor archive candidate that satisfies the current rumor anchor/core-vibe gate instead of an old Salt Gate sample that now correctly falls below the sharing threshold.

Verification:

- `node --import tsx --test --test-name-pattern "turn cards expose visible choices|hosted runner accepts only server action options" ../agent-server/test/epoch-game-core.test.ts`: passed 2/2 after adding forged settlement fields to both core paths.
- `node --import tsx --test --test-name-pattern "MCP Epoch tools expose server-issued identity" ../agent-server/test/mcp.test.ts`: passed 1/1 after adding forged settlement fields to the MCP `resolve_turn` call.
- `node --import tsx --test --test-name-pattern "NPC candidates are submitted" ../agent-server/test/epoch-game-core.test.ts`: initially exposed the stale candidate fixture; passed after updating the fixture to match the current shared-world admission gate.
- `node --import tsx --test ../agent-server/test/epoch-game-core.test.ts`: passed 121/121 from `tools/graph-react-app`.
- `node --import tsx --test ../agent-server/test/mcp.test.ts`: passed 128/128 from `tools/graph-react-app`.
- `npm run typecheck`: passed from `tools/graph-react-app`, including no JS/MJS/CJS/JSX source, no explicit production `any`, the mechanical strict serial validation audit with `scope_marker_failures=0`, web typecheck and agent-server typecheck.
- `npm run build`: passed from `tools/graph-react-app` and exported `00_总览/黑曜纪元3D世界地图.html`.

Remaining risk:

- S055 is now covered for legacy claim-count inflation plus canonical turn, hosted action and MCP resolve-turn settlement fields. Operator-gated server-worker/template creation paths remain intentionally trusted operations; ordinary clients still settle only through server-issued ids and server templates.

## 2026-07-04 RunTicket And Local Trial Verification Slice

- Verified the current S056/S057 MVP surfaces against the live implementation.
- `createTicket` issues server-owned run tickets with `createdAt`, `expiresAt`, `actionBudget`, `sequence` and `sequenceWindow`.
- Heartbeat moves tickets to `active`, refreshes sequence/expiry, and stale tickets expire before submission.
- Submission requires a known server ticket, matching context version, signed envelope and current sequence window; same-payload replay remains idempotent while changed payloads are rejected.
- Local/no-ticket reports use `archive_local_report` / `/api/runs/archive` and remain private archive-only: no shared lore, no progression, no reward and no public world impact.
- Repair tickets preserve the failed run ticket and point users to a fresh-ticket resubmission mode, so failed settlement attempts do not reuse the old settlement budget.

Verification:

- `node --import tsx --test ../agent-server/test/tickets.test.ts`: passed 9/9 from `tools/graph-react-app`.
- `node --import tsx --test --test-name-pattern "MCP tools run the world loop|MCP archives local reports without runTicket|MCP run heartbeat refreshes legacy ticket sequence and expiry|MCP submit rejects expired run tickets" ../agent-server/test/mcp.test.ts`: passed 4/4.
- `node --import tsx --test --test-name-pattern "HTTP archives local reports without runTicket|HTTP run heartbeat refreshes and persists legacy ticket sequence|HTTP submit rejects expired run tickets|HTTP submit requires the signed legacy run envelope" ../agent-server/test/server.test.ts`: passed 4/4.
- `node --import tsx --test --test-name-pattern "repair tickets preserve run ticket" ../agent-server/test/feedback.test.ts`: passed 1/1.

Remaining risk:

- The server can enforce expiry, repair-ticket resubmission and archive-only local reports after it sees a request. A truly offline abandoned ticket is represented by expiry rather than an additional client-side “failure not uploaded” event until the client reconnects.

## 2026-07-04 Categorical Honor Board Verification Slice

- Verified the existing S058 MVP surface for public honors.
- World overview exposes `honorBoards` with six fixed categories: exploration, confirmation, refutation, revision, high-risk survival and low-risk stability.
- Exploration and risk-stability honors are accumulated only from server-settled turn or hosted-action events.
- Confirmation, refutation and revision honors are accumulated only from server-authoritative lore contribution events.
- HTTP world overview explicitly omits a single `leaderboard` field, while region/objective/resource/anomaly leaderboards remain scoped contest surfaces rather than public world-honor totals.
- Public world HTML and Agent Console render the categorical honor list and do not read `worldOverview.leaderboard`.

Verification:

- `node --import tsx --test --test-name-pattern "categorical honor boards" ../agent-server/test/mcp.test.ts`: passed 1/1 from `tools/graph-react-app`.
- `node --import tsx --test --test-name-pattern "world overview" ../agent-server/test/server.test.ts`: passed 1/1 from `tools/graph-react-app`.
- `node --import tsx --test --test-name-pattern "Agent console surfaces canonical world overview" src/agent/AgentExplorer.layout.test.ts`: passed 1/1 from `tools/graph-react-app`.

Remaining risk:

- S058 is covered for the canonical public world overview and Agent Console. Existing scoped regional/objective/resource/anomaly leaderboards are intentionally retained as local contest views; future UI additions should continue to avoid adding a global personal total榜.

## 2026-07-04 Refutation Cost And Daily Quota Slice

- Added the S059 MVP quota path for refutations.
- `recordLoreContribution` now limits each agent to three server-recorded refutations per server date.
- The quota check runs after source evidence validation but before focus is spent, so rejected same-day overuse does not burn the remaining focus balance.
- Confirmation and revision contribution flows are unchanged; refutation still requires authoritative source evidence and still spends the existing `focus` cost on accepted records.
- MCP tool copy now tells clients that refutations consume focus and daily quota.

Verification:

- Red: `node --import tsx --test --test-name-pattern "lore refutations consume a daily quota" ../agent-server/test/epoch-game-core.test.ts` failed with “Missing expected exception” before the quota check existed.
- Green: the same focused test passed after adding the daily quota.
- `node --import tsx --test ../agent-server/test/epoch-game-core.test.ts`: passed 122/122 from `tools/graph-react-app`.
- `node --import tsx --test --test-name-pattern "categorical honor boards|refutations from derived|low-authority lore adjudication|lore refutation" ../agent-server/test/mcp.test.ts`: passed 3/3 from `tools/graph-react-app`.
- `node --import tsx --test --test-name-pattern "lore/contribution|world overview" ../agent-server/test/server.test.ts`: passed 1/1 from `tools/graph-react-app`.
- `node --import tsx --test ../agent-server/test/mcp.test.ts`: passed 128/128 from `tools/graph-react-app`.
- `npm run typecheck`: passed from `tools/graph-react-app`.

Remaining risk:

- S059 now has the spec-allowed MVP daily quota plus existing focus cost. The richer later enhancement of refunding successful challenges and recording failed-refutation cooldowns would need a separate rejected-attempt event model so failed requests can persist state without weakening current error semantics.

## 2026-07-04 MVP Economy Guardrail Minimum-Set Verification Slice

- Verified S060 as a cross-slice economy boundary rather than a new production gap.
- The required MVP guardrails are all enforced on canonical paths:
  - server-issued `runTicket` and sequence windows for legacy settlement,
  - low-risk rumor/admission reward caps,
  - delayed source-reward release until independent reuse,
  - starter/demo `nonEvidence` isolation,
  - server-adjudicated turn and hosted-action rewards.
- No additional S060-specific production changes were needed.

Verification:

- `node --import tsx --test ../agent-server/test/tickets.test.ts`: passed 9/9 from `tools/graph-react-app`.
- `node --import tsx --test --test-name-pattern "low-risk rumor admissions|over-cap low-risk duplicate|exact duplicate claims merge|source rewards release" ../agent-server/test/lore.test.ts`: passed 4/4 from `tools/graph-react-app`.
- `node --import tsx --test --test-name-pattern "turn cards expose visible choices|hosted runner accepts only server action options|first high-risk turn|first high-risk hosted action" ../agent-server/test/epoch-game-core.test.ts`: passed 4/4 from `tools/graph-react-app`.
- `node --import tsx --test --test-name-pattern "MCP delays legacy source rewards|MCP archives local reports without runTicket|MCP Epoch tools expose server-issued identity" ../agent-server/test/mcp.test.ts`: passed 3/3 from `tools/graph-react-app`.
- `node --import tsx --test --test-name-pattern "HTTP archives local reports without runTicket|HTTP submit requires the signed legacy run envelope|HTTP lore contribution rejects other explorers reusing nonEvidence starter events" ../agent-server/test/server.test.ts`: passed 3/3 from `tools/graph-react-app`.

Remaining risk:

- S060 confirms the MVP minimum-set guardrails across current legacy and Epoch paths. Later two-stage economic rules should remain isolated behind their own tests and should not become hidden prerequisites for basic MVP settlement.

## 2026-07-04 RunTicket State Machine Verification Slice

- Verified S061 against the existing ticket registry and legacy submission surfaces.
- Ticket states are represented as `issued`, `active`, `submitted`, `settled`, `expired` and `void`.
- Heartbeat/checkpoint moves live tickets to `active`, refreshes expiry and opens a new sequence window.
- Submission moves a live ticket to `submitted`; settlement moves submitted tickets to `settled`.
- Re-submitting the same run payload after submission/settlement returns an idempotent duplicate view, while a changed payload is rejected with `ticket_payload_mismatch`.
- `expired` and `void` are terminal for settlement, and voiding is rejected after submission.
- Packaged Skill/protocol docs already include the state names, heartbeat, sequence window and settlement rejection errors.

Verification:

- `node --import tsx --test ../agent-server/test/tickets.test.ts`: passed 9/9 from `tools/graph-react-app`.
- `node --import tsx --test --test-name-pattern "MCP run heartbeat refreshes legacy ticket sequence and expiry|MCP submit rejects expired run tickets|MCP submit requires the run-ticket sequence window|MCP tools run the world loop" ../agent-server/test/mcp.test.ts`: passed 4/4 from `tools/graph-react-app`.
- `node --import tsx --test --test-name-pattern "HTTP run heartbeat refreshes and persists legacy ticket sequence|HTTP submit rejects expired run tickets|HTTP submit requires the signed legacy run envelope|HTTP tools run the world loop" ../agent-server/test/server.test.ts`: passed 3/3 from `tools/graph-react-app`.
- `node --import tsx --test --test-name-pattern "Obsidian Epoch package includes host install docs and smoke playbooks" ../agent-server/test/packageArchive.test.ts`: passed 1/1 from `tools/graph-react-app`.

Remaining risk:

- S061 is covered for the in-memory legacy ticket registry and MCP/HTTP submission paths. If tickets move to a multi-process store later, the same submitted/settled payload-hash checks need transactional storage guarantees.

## 2026-07-04 Outbox Observability Verification Slice

- Verified S062 against the existing legacy outbox implementation.
- Outbox entries expose `status`, `retryCount`, `maxRetries`, `deadLetter`, `payloadHash`, `payloadSummary`, timestamps and the latest dispatch error.
- The outbox view summarizes pending/retrying/dispatched/dead-letter counts, exposes a dedicated `deadLetters` list, and includes the manual replay contract.
- `agent_world.outbox`, `agent_world.replay_outbox`, `GET /api/outbox` and `POST /api/outbox/replay` provide the read and operator replay surfaces without exposing raw report payloads.
- Packaged Skill/protocol docs include `outbox.summary`, `status`, `retryCount`, `deadLetter`, dead-letter queue and replay endpoint guidance.

Verification:

- `node --import tsx --test --test-name-pattern "MCP exposes legacy outbox status" ../agent-server/test/mcp.test.ts`: passed 1/1 from `tools/graph-react-app`.
- `node --import tsx --test --test-name-pattern "HTTP exposes legacy outbox status|HTTP replay outbox|outbox" ../agent-server/test/server.test.ts`: passed 1/1 from `tools/graph-react-app`.
- `node --import tsx --test --test-name-pattern "Obsidian Epoch package includes host install docs and smoke playbooks" ../agent-server/test/packageArchive.test.ts`: passed 1/1 from `tools/graph-react-app`.

Remaining risk:

- S062 is covered for the current legacy authored-report outbox. Future non-legacy dispatch queues should reuse the same status/retry/dead-letter/replay contract instead of inventing a separate operator surface.

## 2026-07-04 Readjudication Immutability Verification Slice

- Verified S063 against the existing lore adjudication path and public projections.
- Re-adjudicating the same lore target appends a fresh `lore_target_adjudicated` event instead of mutating the prior adjudication.
- The new payload includes a distinct `adjudicationId`, `newAdjudicationId` and `previousAdjudicationId`, and provenance carries the same id chain.
- World overview, lore target reads and the public world page show the latest adjudication while preserving the old id for audit readers.
- Context/world overview still expose the active `adjudicatorVersion`; packaged protocol docs state that `adjudicate_lore_target` never overwrites older adjudications.

Verification:

- `node --import tsx --test --test-name-pattern "categorical honor boards" ../agent-server/test/mcp.test.ts`: passed 1/1 from `tools/graph-react-app`.
- `node --import tsx --test --test-name-pattern "world overview" ../agent-server/test/server.test.ts`: passed 1/1 from `tools/graph-react-app`.
- `node --import tsx --test --test-name-pattern "context package exposes world versions|MCP world overview" ../agent-server/test/mcp.test.ts ../agent-server/test/context.test.ts`: passed 2/2 from `tools/graph-react-app`.
- `node --import tsx --test --test-name-pattern "Obsidian Epoch package includes host install docs and smoke playbooks" ../agent-server/test/packageArchive.test.ts`: passed 1/1 from `tools/graph-react-app`.

Remaining risk:

- S063 is covered for lore target readjudication and version exposure. A future dedicated run-level readjudication workflow should follow the same append-only id-chain pattern instead of rewriting legacy submitted-run settlement records.

## 2026-07-04 Claim Status Migration Table Verification Slice

- Verified S064 against the existing legacy lore ledger.
- `claimStatusTransitionTable` defines allowed moves for `candidate`, `rumor`, `canonical`, `disputed`, `inscribed`, `rejected` and `hidden`.
- `transitionClaimStatus` is the status mutation path and rejects invalid direct skips such as `rumor` -> `inscribed` with `claim_status_transition_invalid`.
- Invalid skips are allowed only when the call carries `manualApprovalId` or `canonAdoptionEventId`, and the override id is preserved in `statusHistory`.
- Packaged Skill/protocol docs declare the migration table and the approval/adoption requirement.

Verification:

- `node --import tsx --test --test-name-pattern "claim status transitions" ../agent-server/test/lore.test.ts`: passed 1/1 from `tools/graph-react-app`.
- `node --import tsx --test --test-name-pattern "legacy authored-report docs declare|Obsidian Epoch package includes host install docs" ../agent-server/test/legacyTrustDocs.test.ts ../agent-server/test/packageArchive.test.ts`: passed 2/2 from `tools/graph-react-app`.

Remaining risk:

- S064 is covered for the legacy lore ledger claim table. New claim-like projections should either call the same transition helper or define an equally explicit table with override provenance.

## 2026-07-04 Graph Sync Status Verification Slice

- Verified S065 against the existing legacy outbox graph-sync projection.
- Settlement responses initially expose `graphSync.status: "pending_sync"` with label `待同步` while the world-index dispatch is still being confirmed.
- Successful outbox dispatch moves the readable graph-sync view to `synced` / `已同步`.
- Failed dispatches expose `retry_later` / `稍后重试`, including retry/dead-letter metadata and operator replay guidance.
- Manual replay returns the graph-sync view to `synced` after dispatch succeeds.
- Packaged Skill/protocol docs declare the three graph-sync states and labels.

Verification:

- `node --import tsx --test --test-name-pattern "MCP exposes legacy outbox status" ../agent-server/test/mcp.test.ts`: passed 1/1 from `tools/graph-react-app`.
- `node --import tsx --test --test-name-pattern "HTTP exposes and persists legacy outbox dead letters" ../agent-server/test/server.test.ts`: passed 1/1 from `tools/graph-react-app`.
- `node --import tsx --test --test-name-pattern "legacy authored-report docs declare|Obsidian Epoch package includes host install docs" ../agent-server/test/legacyTrustDocs.test.ts ../agent-server/test/packageArchive.test.ts`: passed 2/2 from `tools/graph-react-app`.

Remaining risk:

- S065 is covered for legacy authored-report graph sync. Future live graph indexers should update the same outbox-derived status contract rather than adding a parallel sync indicator.

## 2026-07-04 Schema Adapter Verification Slice

- Verified S066 against the public Agent World reader path.
- `getAgentPublicWorld` reads through `parseAgentPublicWorld` instead of trusting raw payload shape directly.
- Missing legacy summary counters adapt to explicit `"unknown"` values.
- Missing legacy detail maps adapt to `null`.
- Missing legacy `sourceGraph` adapts to `{ nodes: [], edges: [], status: "unknown" }`.
- Malformed present collection fields still fail validation instead of being silently accepted.
- Frontend/agent types require consumers to handle `"unknown"` and nullable detail maps.

Verification:

- `node --import tsx --test --test-name-pattern "parseAgentPublicWorld" ../agent-server/test/validation.test.ts`: passed 2/2 from `tools/graph-react-app`.
- `npm run typecheck`: passed from `tools/graph-react-app`.

Remaining risk:

- S066 is covered for the public Agent World JSON reader. Future external JSON reader contracts should add their own adapters before UI or server code assumes latest-version fields.

## 2026-07-04 Review Queue Budget Verification Slice

- Re-verified S067 against the existing legacy authored-report review budget path.
- The delayed-review check runs after signed `runTicket` validation and before normal settlement/adjudication persistence.
- Budget decisions include identity reputation rank, same-`runTicket` idempotency, report length, similar pending reports by explorer/fingerprint, and delayed-queue system load.
- Over-budget submissions return `state: "review_delayed"` with visible `reviewQueue` and `reviewStatus` details instead of writing settled runs or outbox records.
- `agent_world.review_queue` and `GET /api/review-queue` expose delayed entries for operator/client inspection, and packaged protocol docs declare the same budget dimensions.

Verification:

- `node --import tsx --test --test-name-pattern "MCP delays legacy review over rank length budget|MCP delays legacy review for system load and similar pending reports|MCP tool registry exposes agent world tools" ../agent-server/test/mcp.test.ts`: passed 3/3 from `tools/graph-react-app`.
- `node --import tsx --test --test-name-pattern "HTTP queues legacy review over system load budget" ../agent-server/test/server.test.ts`: passed 1/1 from `tools/graph-react-app`.
- `node --import tsx --test --test-name-pattern "legacy authored-report docs declare|Obsidian Epoch package includes host install docs and smoke playbooks" ../agent-server/test/legacyTrustDocs.test.ts ../agent-server/test/packageArchive.test.ts`: passed 2/2 from `tools/graph-react-app`.
- `npm run typecheck`: passed from `tools/graph-react-app`.

Remaining risk:

- S067 is covered for the MVP delayed-review budget. Future queue processors that drain delayed entries should preserve same-`runTicket` idempotency and the no-settlement-before-budget boundary.

## 2026-07-04 Context Snapshot Verification Slice

- Re-verified S068 against the existing context-package, runtime ledger, persistence and recovery paths.
- `createContextPackage` emits a structured `contextSnapshot` with deterministic `ctxsnap_*` id, context version tuple, setting-card ids/versions/public summaries, retrieval parameters and public-safe filtering reasons.
- Runtime context calls expose saved snapshots through `agent_world.context_snapshots`; HTTP context routes persist them to `context-snapshots.jsonl` and expose `GET /api/context/snapshots`.
- SQLite migration and recovery manifest checks hydrate/prove saved context snapshots, so the MVP id/version/filtering-reason audit survives migration and backup/restore flows.
- Packaged protocol docs declare `contextSnapshot`, `settingCards`, `retrievalParams`, `filteringReasons`, `agent_world.context_snapshots`, `/api/context/snapshots` and `context-snapshots.jsonl`.

Verification:

- `node --import tsx --test --test-name-pattern "context snapshot|context package|context_snapshots|SQLite migration hydrates saved context snapshots|recovery manifest gives matching|legacy authored-report docs declare|Obsidian Epoch package includes host install docs and smoke playbooks|MCP tool registry" ../agent-server/test/context.test.ts ../agent-server/test/mcp.test.ts ../agent-server/test/server.test.ts ../agent-server/test/sqlite-store.test.ts ../agent-server/test/recovery.test.ts ../agent-server/test/legacyTrustDocs.test.ts ../agent-server/test/packageArchive.test.ts`: passed 7/7 from `tools/graph-react-app`.
- `npm run typecheck`: passed from `tools/graph-react-app`.

Remaining risk:

- S068 is covered for structured snapshot persistence and recovery. It intentionally remains MVP-level structured JSONL/SQLite storage rather than encrypted full-context archival.

## 2026-07-04 Deletion Archive Separation Verification Slice

- Re-verified S069 against the shared Epoch result-page deletion path.
- `obsidian_epoch.delete_result_page` and `POST /api/epoch/result-page/delete` classify deletion requests and execute the MVP `hide_body` category after owner recovery/operator authorization.
- Deleted pages clear the archived full `payload`, clear the share-token hash, advance `shareVersion`, and retain only a `deletionSummary` tombstone.
- The retained tombstone contains irreversible `fullPayloadHash`, receipt payload hash, anonymous source hash, focus hash, canonical event count and minimal retained-fact labels, without leaking agent/explorer/body text.
- Public reads of a deleted result URL return a 410 `result_page_deleted` status page rather than old content, and `result-pages.jsonl` persists the deleted tombstone without full payload.
- Packaged docs declare the delete tool, HTTP route, tombstone status and retained hash fields.

Verification:

- `node --import tsx --test --test-name-pattern "MCP delete result page separates body archive from audit summary|MCP tool registry exposes agent world tools" ../agent-server/test/mcp.test.ts`: passed 2/2 from `tools/graph-react-app`.
- `node --import tsx --test --test-name-pattern "HTTP delete result page persists only a tombstone summary" ../agent-server/test/server.test.ts`: passed 1/1 from `tools/graph-react-app`.
- `node --import tsx --test --test-name-pattern "legacy authored-report docs declare|Obsidian Epoch package includes host install docs and smoke playbooks" ../agent-server/test/legacyTrustDocs.test.ts ../agent-server/test/packageArchive.test.ts`: passed 2/2 from `tools/graph-react-app`.
- `npm run typecheck`: passed from `tools/graph-react-app`.

Remaining risk:

- S069 is covered for runtime and append-only tombstone persistence. As previously noted, already-written active JSONL records or external backups are not retroactively compacted by the delete route.

## 2026-07-04 Versioned Share Token Verification Slice

- Re-verified S070 against public Epoch result-page creation, read, revoke and delete paths.
- Newly created result pages issue URLs containing both raw `shareToken` and `shareVersion=1`; the stored page keeps only `shareTokenHash`.
- Public reads require a matching token and current version before rendering result content; missing/wrong token or missing/stale version returns a status page without leaked result body text.
- `obsidian_epoch.revoke_result_page` / `POST /api/epoch/result-page/revoke` advance `shareVersion`, clear `shareTokenHash`, and make the previous URL return `result_page_revoked`.
- Deletion keeps the S069 tombstone behavior while also advancing `shareVersion`, clearing the token hash, and serving `result_page_deleted` rather than old content.
- Install smoke still produces hosted result-page URLs with `shareToken` and `shareVersion=1` for both ranked and web-bridge flows.

Verification:

- `node --import tsx --test --test-name-pattern "MCP Epoch tools expose server-issued identity|MCP delete result page" ../agent-server/test/mcp.test.ts`: passed 2/2 from `tools/graph-react-app`.
- `node --import tsx --test --test-name-pattern "HTTP Epoch routes persist canonical events|HTTP delete result page persists only a tombstone summary|HTTP renders public world overview" ../agent-server/test/server.test.ts`: passed 3/3 from `tools/graph-react-app`.
- `node --import tsx --test --test-name-pattern "legacy authored-report docs declare|Obsidian Epoch package includes host install docs and smoke playbooks" ../agent-server/test/legacyTrustDocs.test.ts ../agent-server/test/packageArchive.test.ts`: passed 2/2 from `tools/graph-react-app`.
- `npm run typecheck`: passed from `tools/graph-react-app`.
- `npm run agent:install-smoke -- --json`: passed from `tools/graph-react-app`; output result URLs included `shareToken` and `shareVersion=1`.

Remaining risk:

- S070 is covered for newly served result links and no-store status pages. Already-cached copies outside the server's control still cannot be purged by the application.

## 2026-07-04 Prompt Layering Verification Slice

- Re-verified S071 against context packages, HTTP public-context responses and the Web LLM bridge.
- `promptLayers.priorityOrder` is fixed as `system_policy` > `agent_identity_boundary` > `user_mandate` > `user_additional_instruction`.
- `additionalInstruction` is accepted only when it does not conflict with higher layers; unsafe policy-override / self-sacrifice text is rejected, hashed, and excluded from `effectiveText`.
- `obsidian_epoch.web_bridge_turn` returns the same structured layers and its `copyPrompt` lists the four layers before server-issued `actionOptionId` choices.
- MCP schemas and packaged docs declare `additionalInstruction` and the prompt-layer priority contract.

Verification:

- `node --import tsx --test --test-name-pattern "layers user additions|MCP Epoch tools expose server-issued identity|HTTP exposes versioned public world context contract|legacy authored-report docs declare|Obsidian Epoch package includes host install docs and smoke playbooks" ../agent-server/test/context.test.ts ../agent-server/test/mcp.test.ts ../agent-server/test/server.test.ts ../agent-server/test/legacyTrustDocs.test.ts ../agent-server/test/packageArchive.test.ts`: passed 5/5 from `tools/graph-react-app`.
- `npm run typecheck`: passed from `tools/graph-react-app`.

Remaining risk:

- S071 is covered for server-provided context and bridge prompts. Downstream clients still need to use `promptLayers` / `copyPrompt` instead of constructing unlayered prompts locally.

## 2026-07-04 No Drama Score Verification Slice

- Re-verified S072 against legacy authored-report scoring and prompt guidance.
- `adjudicateRun` no longer awards score for authorized dramatic/high-risk events; high-risk still requires structure and unauthorized high-risk is penalized.
- The regression case proves a dramatic self-sacrifice/high-risk conflict does not score above a grounded medium-risk report and does not increase claim slots.
- Shared `promptLayers.systemPolicy` tells agents not to create high-risk conflict for drama; costs and danger must come from the server event chain and the user mandate.
- Packaged Skill/protocol docs declare that drama is not scored and high-risk conflict must be grounded in event-chain cost.

Verification:

- `node --import tsx --test --test-name-pattern "dramatic high-risk conflict|layers user additions|legacy authored-report docs declare|Obsidian Epoch package includes host install docs and smoke playbooks" ../agent-server/test/adjudicator.test.ts ../agent-server/test/context.test.ts ../agent-server/test/legacyTrustDocs.test.ts ../agent-server/test/packageArchive.test.ts`: passed 4/4 from `tools/graph-react-app`.
- `npm run typecheck`: passed from `tools/graph-react-app`.

Remaining risk:

- S072 is covered for explicit scoring incentives and prompt guidance. Broader semantic drama detection still relies on server-issued options, risk budgets and event-chain verification.

## 2026-07-04 Agent Memory Partition Verification Slice

- Re-verified S073 against `obsidian_epoch.agent_memory` and `/api/epoch/agent-memory`.
- `confirmedMemory` is limited to server-confirmed NPC identity/existence records and does not expose candidate story evidence as truth.
- `rumorMemory` requires operator-reviewed risky candidates before exposing story evidence as non-settlement rumor memory.
- Unreviewed or rejected candidate prose stays in the submitting agent's `privateRunMemory`; broad regional memory reads without `agentId` hide private memory.
- Packaged docs continue to declare `confirmedMemory`, reviewed `rumorMemory`, and private unreviewed/rejected candidate memory.

Verification:

- `node --import tsx --test --test-name-pattern "stratif|stratifies agent memory" ../agent-server/test/mcp.test.ts ../agent-server/test/server.test.ts`: passed 2/2 from `tools/graph-react-app`.
- `npm run typecheck`: passed from `tools/graph-react-app`.
- `node --import tsx --test --test-name-pattern "legacy authored-report docs declare|Obsidian Epoch package includes host install docs and smoke playbooks" ../agent-server/test/legacyTrustDocs.test.ts ../agent-server/test/packageArchive.test.ts`: passed 2/2 from `tools/graph-react-app`.

Remaining risk:

- S073 is covered for the current read-model partition. The NPC candidate submit path can still create minimal canonical NPC identity records automatically for non-blocked candidates.

## 2026-07-04 Personality Drift Proposal Verification Slice

- Re-verified S074 against the existing server-owned personality-drift proposal and confirmation path.
- Major anomaly scars / pollution can append `personality_drift_proposed` from a source `anomaly_event_resolved`.
- Severe relationship hostility / betrayal can append a target-side `personality_drift_proposed` from a source `relationship_updated`.
- Drift records remain `proposed` and visible in progress views until the identity owner confirms them with `obsidian_epoch.confirm_personality_drift`.
- Confirmation requires owner recovery authorization, writes `personality_drift_confirmed`, and only then applies the suggested trait to the identity personality profile.
- Packaged docs continue to warn agents not to invent persistent trauma/corruption/betrayal traits from local prose.

Verification:

- `node --import tsx --test --test-name-pattern "personality drift|relationship hostility|legacy authored-report docs declare|Obsidian Epoch package includes host install docs and smoke playbooks" ../agent-server/test/epoch-game-core.test.ts ../agent-server/test/mcp.test.ts ../agent-server/test/server.test.ts ../agent-server/test/legacyTrustDocs.test.ts ../agent-server/test/packageArchive.test.ts`: passed 8/8 from `tools/graph-react-app`.
- `npm run typecheck`: passed from `tools/graph-react-app`.

Remaining risk:

- S074 is covered for proposal and owner confirmation. Cooldown/source-binding behavior is verified separately under S075.

## 2026-07-04 Personality Drift Cooldown Verification Slice

- Re-verified S075 against source binding, open-proposal blocking and post-confirmation cooldown.
- Drift proposals are gated by concrete server source events; currently only `anomaly_event_resolved` and `relationship_updated` can produce `personality_drift_proposed`.
- A proposed drift remains the single open proposal for that identity until confirmation or later handling, preventing parallel free-form trait edits.
- Confirmed drifts start a seven-day per-identity cooldown; a second betrayal/hostility scar inside cooldown does not create another proposal.
- After the cooldown expires, a new qualifying relationship event can create a fresh proposal and records its new `sourceEventId`.
- Packaged docs and MCP descriptions declare source binding, owner confirmation, cooldown limits and that ordinary rename/tone edits do not rewrite strategy.

Verification:

- `node --import tsx --test --test-name-pattern "confirmed personality drift starts a cooldown|personality drift|relationship hostility|legacy authored-report docs declare|Obsidian Epoch package includes host install docs and smoke playbooks" ../agent-server/test/epoch-game-core.test.ts ../agent-server/test/mcp.test.ts ../agent-server/test/server.test.ts ../agent-server/test/legacyTrustDocs.test.ts ../agent-server/test/packageArchive.test.ts`: passed 8/8 from `tools/graph-react-app`.
- `npm run typecheck`: passed from `tools/graph-react-app`.

Remaining risk:

- S075 is covered for the fixed MVP cooldown and current source-event whitelist. Future tuning may expose cooldown duration or source categories as operator configuration.

## 2026-07-04 Context Diversity Verification Slice

- Re-verified S076 against legacy public context-package construction and snapshot metadata.
- Each context snapshot records `diversityPolicy: "high_weight_low_exposure_current_location_mix"` and selected setting-card categories.
- The deterministic MVP mix includes a high-weight public world brief, current-location basics selected from anchors/known places/defaults, and a low-exposure compliance card.
- Setting cards expose `category`, `selectionReason`, `weight`, `exposureLevel`, public summary and filtering reasons so clients can audit why context was included.
- Packaged docs continue to describe the high-weight/current-location/low-exposure mix and low-exposure public-summary handling.

Verification:

- `node --import tsx --test --test-name-pattern "structured public context snapshot|high-weight low-exposure|legacy authored-report docs declare|Obsidian Epoch package includes host install docs and smoke playbooks" ../agent-server/test/context.test.ts ../agent-server/test/legacyTrustDocs.test.ts ../agent-server/test/packageArchive.test.ts`: passed 4/4 from `tools/graph-react-app`.
- `npm run typecheck`: passed from `tools/graph-react-app`.

Remaining risk:

- S076 is covered for the deterministic MVP mix. It is not yet a full retrieval ranker with exposure counters or randomized low-exposure rotation.

## 2026-07-04 User Behavior Red Lines Verification Slice

- Re-verified S077 against agent profiles, prompt layers and additional-instruction filtering.
- Agent profiles include structured `behaviorRedLines`: `do_not_betray_allies`, `do_not_harm_civilians` and `do_not_contact_old_gods`.
- `promptLayers.agentIdentityBoundary` exposes those red lines and states that triggers require explicit user authorization.
- `authorization.userBehaviorRedLines` lists active red-line ids with `triggerHandling: "explicit_user_authorization_required"`.
- Low-priority additional instructions that try to bypass red lines are rejected with `user_behavior_red_line_requires_authorization` and do not enter effective prompt text.
- Packaged docs continue to declare behavior red lines and authorization requirements.

Verification:

- `node --import tsx --test --test-name-pattern "behavior red lines|layers user additions|legacy authored-report docs declare|Obsidian Epoch package includes host install docs and smoke playbooks" ../agent-server/test/context.test.ts ../agent-server/test/legacyTrustDocs.test.ts ../agent-server/test/packageArchive.test.ts`: passed 4/4 from `tools/graph-react-app`.
- `npm run typecheck`: passed from `tools/graph-react-app`.

Remaining risk:

- S077 is covered for prompt/context enforcement. Server action-option generation still needs to continue honoring these red lines when new gameplay actions are added.

## 2026-07-04 Goal Priority Verification Slice

- Re-verified S078 against context-package prompt layers and packaged docs.
- `promptLayers.goalPriority.priorityOrder` is fixed as `safety_boundary` > `user_behavior_red_lines` > `user_mandate` > `agent_long_term_goals` > `opportunistic_side_quests`.
- The current user mandate is preserved above agent long-term goals, and opportunistic side quests are explicitly lowest priority / allowed only when non-conflicting.
- Agent presets expose long-term goals so clients can see they are below the current mandate.
- Packaged docs continue to declare the same priority order and conflict-resolution contract.

Verification:

- `node --import tsx --test --test-name-pattern "goal priority|behavior red lines|layers user additions|legacy authored-report docs declare|Obsidian Epoch package includes host install docs and smoke playbooks" ../agent-server/test/context.test.ts ../agent-server/test/legacyTrustDocs.test.ts ../agent-server/test/packageArchive.test.ts`: passed 5/5 from `tools/graph-react-app`.
- `npm run typecheck`: passed from `tools/graph-react-app`.

Remaining risk:

- S078 is covered for prompt/context priority. Future server-issued gameplay choices should attach matching priority metadata when choices intentionally create tradeoffs.

## 2026-07-04 Multi-Agent Reservation Verification Slice

- Re-verified S079 against legacy/public context packages and run tickets.
- `agent_world.context_package` and `agent_world.start_run` accept reserved `partyRunId` and `participantRole` fields for future attribution.
- Legacy contexts return `multiAgentReservation.status: "reserved_only"` and `legacyPlayEnabled: false`, with a warning that these fields do not enable authored-report party play.
- `contextSnapshot.retrievalParams`, run tickets and signed run-capability envelopes retain the party fields for traceability.
- Packaged docs continue to describe the reserved-only boundary and point actual server-settled party gameplay at `obsidian_epoch.party_runs`.

Verification:

- `node --import tsx --test --test-name-pattern "party role fields|world loop for an external agent|legacy authored-report docs declare|Obsidian Epoch package includes host install docs and smoke playbooks" ../agent-server/test/context.test.ts ../agent-server/test/mcp.test.ts ../agent-server/test/legacyTrustDocs.test.ts ../agent-server/test/packageArchive.test.ts`: passed 4/4 from `tools/graph-react-app`.
- `npm run typecheck`: passed from `tools/graph-react-app`.

Remaining risk:

- S079 is covered for the legacy reserved-only contract. Multi-agent settlement, roles and rewards belong to canonical party tooling, not legacy authored-report tickets.

## 2026-07-04 Agent Self-Statement Meta Guard Verification Slice

- Re-verified S080 against agent briefing and public-page self-statement generation.
- `agentSelfStatement` is server-authored from identity, region and recorded event facts; request prompt text is ignored.
- The fallback guard strips prompt/system/rules/model meta terms from self-statements before returning them.
- MCP and HTTP briefing tests pass even when the request prompt tries to mention system/model/prompt leakage.
- Packaged docs continue to declare the source whitelist and meta-information ban.

Verification:

- `node --import tsx --test --test-name-pattern "MCP Epoch tools expose server-issued identity|HTTP exposes unified agent briefing|legacy authored-report docs declare|Obsidian Epoch package includes host install docs and smoke playbooks" ../agent-server/test/mcp.test.ts ../agent-server/test/server.test.ts ../agent-server/test/legacyTrustDocs.test.ts ../agent-server/test/packageArchive.test.ts`: passed 4/4 from `tools/graph-react-app`.
- `npm run typecheck`: passed from `tools/graph-react-app`.

Remaining risk:

- S080 is covered for the fixed server template. Any future richer narrator should keep the source whitelist and meta-term regression tests.

## 2026-07-04 Community Reaction Status Boundary Verification Slice

- Re-verified S081 against the legacy community reaction ledger and packaged docs.
- `reactionPolicy.claimStatusEffect` remains `none` for quick reactions.
- Allowed quick-reaction effects are only `sorting` and `attention`; `claim_status` and `truth_adjudication` are explicitly forbidden.
- Thread views expose reaction counts and `sortSignals.attentionScore` for ranking/spotlighting without treating reactions as truth votes.
- Claim status inputs remain evidence, review records and authorized reassessment, not quick reactions.

Verification:

- `node --import tsx --test --test-name-pattern "quick reactions|community reactions|legacy authored-report docs declare|Obsidian Epoch package includes host install docs and smoke playbooks" ../agent-server/test/community.test.ts ../agent-server/test/legacyTrustDocs.test.ts ../agent-server/test/packageArchive.test.ts`: passed 4/4 from `tools/graph-react-app`.
- `npm run typecheck`: passed from `tools/graph-react-app`.

Remaining risk:

- S081 is covered for policy and read-model signals. Future UI sorting can use `attentionScore`, but must keep it outside claim status migration.

## 2026-07-04 Lore Revision Rights Boundary Verification Slice

- Re-verified S082 against canonical lore revision contribution handling.
- Revision contributions accept only `suggestion`, `derived`, `merge` and `downgrade` modes.
- `revisionMode: "direct_edit"` is rejected with `lore_revision_direct_edit_forbidden`.
- Revision records carry `revisionPolicy.originalClaimMutable: false`, allowed modes, review requirement and `claimTextEffect`.
- Suggestions, merges and downgrades remain proposal-only; derived revisions create a derived version linked to the parent claim without rewriting the original claim text.
- Packaged docs continue to declare the non-original explorer boundary and allowed revision modes.

Verification:

- `node --import tsx --test --test-name-pattern "MCP records server-authoritative lore contributions|Obsidian Epoch package includes host install docs and smoke playbooks" ../agent-server/test/mcp.test.ts ../agent-server/test/packageArchive.test.ts`: passed 2/2 from `tools/graph-react-app`.
- `npm run typecheck`: passed from `tools/graph-react-app`.

Remaining risk:

- S082 is covered for recording revision proposals/derived versions. Accepting merge or downgrade proposals into final adjudication remains operator-gated via existing lore adjudication flows.

## 2026-07-04 Dispute Retaliation Detection Verification Slice

- Re-verified S083 against legacy community dispute reactions and moderation queueing.
- The ledger detects `bidirectional_retaliation`, `short_burst_objections` and `group_pile_on` inside the short review window.
- Triggering dispute reactions return `visibility: "hidden_pending_review"`, `reviewStatus: "queued"` and `disputeAbuseFlags`.
- Each hidden dispute reaction creates a queued `dispute_abuse:*` moderation item.
- Thread reads expose `disputeAbuseSummary` so clients can show review state without surfacing suspicious pressure as visible evaluation.
- Packaged docs continue to describe suspicious dispute pressure being hidden before review.

Verification:

- `node --import tsx --test --test-name-pattern "dispute reactions|community reactions|quick reactions|Obsidian Epoch package includes host install docs and smoke playbooks" ../agent-server/test/community.test.ts ../agent-server/test/packageArchive.test.ts`: passed 4/4 from `tools/graph-react-app`.
- `npm run typecheck`: passed from `tools/graph-react-app`.

Remaining risk:

- S083 is covered for the MVP in-ledger detector. A future dispute-court workflow can add longer windows and durable relationship graphs, but should keep visible pressure hidden pending review.

## 2026-07-04 Lore Lineage Folding Verification Slice

- Re-verified S084 against lore target status rows and packaged docs.
- `lineageDisplay` exposes compact default fields: `originAgentId`, optional source identity/explorer, and `currentStatus`.
- Confirmation/refutation/revision history stays folded behind `foldedContributionCounts` and `foldedContributionCount`.
- `expandedTool: "obsidian_epoch.lore_contributions"` names the drill-down path for full contribution history.
- World/lore status cards can therefore show origin and current state without inlining every confirmer, reviser or refuter.

Verification:

- `node --import tsx --test --test-name-pattern "MCP records server-authoritative lore contributions|Obsidian Epoch package includes host install docs and smoke playbooks" ../agent-server/test/mcp.test.ts ../agent-server/test/packageArchive.test.ts`: passed 2/2 from `tools/graph-react-app`.
- `npm run typecheck`: passed from `tools/graph-react-app`.

Remaining risk:

- S084 is covered for compact read-model fields. Future UI can add richer pagination/search for expanded contribution history while keeping default cards folded.

## 2026-07-04 Failed Report Publication Granularity Verification Slice

- Re-verified S085 against legacy authored-report failure publication policy.
- Failed reports receive `failurePublication` with allowed modes `anonymous_public`, `claim_only` and `personal_sealed`.
- The default mode is `personal_sealed`, so failed reports do not enter the public archive just because the run asked for public visibility.
- `anonymous_public` publishes a redacted archive row and grants `失败回流信用 +2`.
- `claim_only` publishes only claim preview data, redacts explorer/agent identity and grants `失败回流信用 +1`.
- `personal_sealed` stays out of `agent_world.public_world` and grants no repair credit.

Verification:

- `node --import tsx --test --test-name-pattern "failed battle reports honor publication granularity|Obsidian Epoch package includes host install docs and smoke playbooks" ../agent-server/test/mcp.test.ts ../agent-server/test/packageArchive.test.ts`: passed 2/2 from `tools/graph-react-app`.
- `npm run typecheck`: passed from `tools/graph-react-app`.

Remaining risk:

- S085 is covered for server policy and archive redaction. A future UI can expose these choices before submission, but must keep sealed failures out of public archive/outbox summaries by default.

## 2026-07-04 Real IP Similarity Moderation Verification Slice

- Re-verified S086 against faction proposals, NPC/character candidates and packaged docs.
- Shared admission uses the dependency-free `ipSimilarity` MVP gate with normalization and known IP/work alias matching.
- Faction proposals screen name, setting, goal and conflict boundary before trial admission; suspected entries return `moderation_hold` with `reason: "real_ip_similarity"`.
- NPC/character candidates screen display name and story evidence before canonicalization; suspected entries carry `reviewLevel: "moderation_hold"`, `real_ip_similarity` and `ipSimilarity`.
- Suspected NPC candidates do not create canonical NPC state and stay in review/private-memory paths until operator action.
- Packaged docs continue to state that faction, character/NPC and location names are screened before shared-world admission.

Verification:

- `node --import tsx --test --test-name-pattern "real IP-similar faction names|NPC candidates are submitted|MCP submits story NPC candidates|Obsidian Epoch downloadable package contains skill and plugin manifests" ../agent-server/test/factions.test.ts ../agent-server/test/epoch-game-core.test.ts ../agent-server/test/mcp.test.ts ../agent-server/test/packageArchive.test.ts`: passed 4/4 from `tools/graph-react-app`.
- `npm run typecheck`: passed from `tools/graph-react-app`.

Remaining risk:

- S086 is covered for the deterministic MVP alias list. Production deployments should extend it with reviewed moderation sources and richer operator tooling.

## 2026-07-04 Publish Authorship Confirmation Verification Slice

- Re-verified S087 against Web Agent Console publish controls and packaged host docs.
- The exact copy `故事署名归你；入档发现会成为共享世界资料，可被他人引用。` is centralized as `RESULT_PUBLISH_AUTHORIZATION_COPY`.
- The copy appears beside resolved-turn publishing, Web LLM bridge result publishing and generic result-link creation controls.
- Packaged Skill/protocol docs require installed hosts to show the same confirmation before `obsidian_epoch.create_result_page`.

Verification:

- `node --import tsx --test --test-name-pattern "short authorship confirmation|Obsidian Epoch downloadable package contains skill and plugin manifests" src/agent/AgentExplorer.layout.test.ts ../agent-server/test/packageArchive.test.ts`: passed 2/2 from `tools/graph-react-app`.
- `npm run typecheck`: passed from `tools/graph-react-app`.

Remaining risk:

- S087 is covered as adjacent confirmation copy. It is not a blocking checkbox; higher-risk publish flows can add explicit acknowledgements later if needed.

## 2026-07-04 Deletion Request Classification Verification Slice

- Re-verified S088 against owner result-page deletion responses, tombstones and packaged docs.
- `deletionSummary.deletionRequest.categories` contains the four MVP categories: `hide_body`, `anonymize_source`, `withdraw_unadmitted_candidate` and `request_de_admission_review`.
- The current result-page body delete executes `hide_body` and keeps only irreversible hashes plus minimal audit facts.
- The classification states that shared settings referenced by multiple people can only request `request_de_admission_review` / 退档复审 rather than being deleted with the public body.
- MCP, HTTP and `result-pages.jsonl` tombstone paths persist the classification.

Verification:

- `node --import tsx --test --test-name-pattern "MCP delete result page separates body archive|HTTP delete result page persists only a tombstone summary|Obsidian Epoch downloadable package contains skill and plugin manifests" ../agent-server/test/mcp.test.ts ../agent-server/test/server.test.ts ../agent-server/test/packageArchive.test.ts`: passed 3/3 from `tools/graph-react-app`.
- `npm run typecheck`: passed from `tools/graph-react-app`.

Remaining risk:

- S088 is covered for classification/read model. Standalone source anonymization, candidate withdrawal and de-admission review remain future dedicated workflows.

## 2026-07-04 Custom TTS Sharing Boundary Verification Slice

- Re-verified S089 against experience voice selection and packaged docs.
- `tts.sharePolicy` is exposed for the selected voice.
- `system_default` uses `publicSharing: "system_voice_allowed"`.
- Custom/non-system voices use `publicSharing: "requires_voice_rights_confirmation"` and `requiresVoiceRightsConfirmation: true`.
- `customTtsHosting` remains `not_hosted` by default, and confirmation copy tells users to confirm voice/音色 usage rights before public sharing.
- Packaged docs continue to warn installed hosts not to upload, store, package or publicly publish custom/imitative voice artifacts without rights confirmation.

Verification:

- `node --import tsx --test --test-name-pattern "custom TTS public sharing|Obsidian Epoch downloadable package contains skill and plugin manifests" ../agent-server/test/experience.test.ts ../agent-server/test/packageArchive.test.ts`: passed 2/2 from `tools/graph-react-app`.
- `npm run typecheck`: passed from `tools/graph-react-app`.

Remaining risk:

- S089 is covered for policy and confirmation metadata. A future public audio sharing workflow should make rights confirmation a blocking input before any upload or publication.

## 2026-07-04 Content Policy Configuration Verification Slice

- Re-verified S090 against quickstart, host config and packaged docs.
- `resolveEpochContentPolicy` reads configurable per-region policy from `AGENT_WORLD_CONTENT_POLICY_JSON` with a built-in global fallback.
- `obsidian_epoch.quickstart` accepts `contentPolicyRegion` / `regionCode`, returns the resolved `contentPolicy`, and places the selected region in `hostConfig.env`.
- The response exposes age rating, content warnings, public-sharing policy, moderation defaults, safety boundary and configuration source.
- Packaged docs tell installed hosts to read `quickstart.contentPolicy` instead of hardcoding a single region's public-share rules.

Verification:

- `node --import tsx --test --test-name-pattern "MCP tool registry|Obsidian Epoch downloadable package contains skill and plugin manifests" ../agent-server/test/mcp.test.ts ../agent-server/test/packageArchive.test.ts`: passed 2/2 from `tools/graph-react-app`.
- `npm run typecheck`: passed from `tools/graph-react-app`.

Remaining risk:

- S090 is covered for configurable policy resolution. Production deployments still need reviewed `AGENT_WORLD_CONTENT_POLICY_JSON` entries for target regions.

## 2026-07-04 Fine-Grained Operation Switch Verification Slice

- Re-verified S091 against the operation-switch registry, legacy settlement, public sharing and source-reward gates.
- `AGENT_WORLD_OPERATION_SWITCHES_JSON` / runtime config supports actions `settlement`, `public_sharing` and `source_reward`.
- Switches can match exact dimensions for `rewardType`, `commissionType`, `chapterId`, `locationId`, `factionId` and `riskLevel`.
- Paused settlement rejects matching legacy submissions with `operation_settlement_paused` while reads still work.
- Paused public sharing rejects result-page creation with `operation_public_sharing_paused`.
- Paused `source_reward` with `rewardType: "claim_reuse"` suppresses only that source-reward family.
- Packaged docs continue to declare switch config, actions and dimensions.

Verification:

- `node --import tsx --test --test-name-pattern "operation switches|Obsidian Epoch downloadable package contains skill and plugin manifests" ../agent-server/test/mcp.test.ts ../agent-server/test/packageArchive.test.ts`: passed 4/4 from `tools/graph-react-app`.
- `npm run typecheck`: passed from `tools/graph-react-app`.

Remaining risk:

- S091 is covered for the three required actions and exact-match dimensions. Future reward/commission families should pass their own dimensions into the same gate.

## 2026-07-04 Strict Serial Mechanical Audit Output Reverification Slice

- Re-verified the S096-S100 mechanical audit chain after the later scope-marker audit extension.
- Aligned `tools/agent-server/test/strictSerialValidation.test.ts` with the current citeable audit line so completion-output coverage includes `scope_marker_failures=0`.
- The current mechanical audit line is:
  `mechanical audit output: strict_serial_validation=pass; rounds=100; expected_rounds=100; round_001=present; round_100=present; required_fields=4; round_field_failures=0; strict_s_numbers=100; spec_s_numbers=100; missing_in_spec=0; missing_in_strict=0; unfinished_markers=0; scope_marker_failures=0`
- The audit still covers the S096 required round fields, S097 S-number consistency, S098 round count and boundary rounds, S099 unfinished-marker blocking and S100 citeable completion output.

Verification:

- `node --import tsx --test ../agent-server/test/strictSerialValidation.test.ts`: passed 10/10 from `tools/graph-react-app` after updating the expected audit string.
- `npm run check:strict-serial-validation`: passed from `tools/graph-react-app` and reported the full mechanical audit output above.
- `npm run typecheck`: passed from `tools/graph-react-app`.

Remaining risk:

- The mechanical audit proves required completion artifacts are present and internally consistent. It does not replace the broader product test/build gates or semantic review of the delivered gameplay surface.
