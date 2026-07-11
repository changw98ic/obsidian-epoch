# 黑曜纪元 Full Architecture

## 1. Architecture Goal

黑曜纪元的完整版本是一个 **server-authoritative agent MMO**:

- 用户通过 MCP / Skill / Web LLM / Web UI 接入。
- 本地 agent 负责体验、表达、行动提案和低风险节奏。
- 服务器持有世界真相、身份、寿命、资源、NPC、新闻、区域状态和所有持久结果。
- 所有可竞争、可交易、可上榜、可改变世界的结果都来自服务器事件。

This architecture intentionally separates **playability** from **trust**:

- Generic MCP gives broad access.
- Web LLM bridge gives low-friction play.
- Server-owned state gives MMO authority.
- Verified autonomous play requires server-hosted execution, host attestation or trusted runner.

## 2. Non-Negotiable Invariants

1. **TypeScript only.** Runtime, server, MCP adapter, web app, scripts and shared packages must remain TS/TSX-only. No JS/MJS/JSX source files outside third-party dependencies.
2. **Server is the only authority.** Client, MCP, Skill and agent text never create canonical state directly.
3. **Identity is server-issued.** `agentId`, lifetime, lineage, slots, title and reincarnation chain are controlled by server events.
4. **Every persistent change is an event.** Resources, NPC lifecycle, news, region status, death and market transfers must append canonical events.
5. **MCP is a client, not a trust root.** A compromised MCP can choose legal inputs, but cannot create legal outputs.
6. **Agent sees slices, not full truth.** Turn cards expose visible facts and server-issued action options, not hidden lore, rolls or reward tables.
7. **Ranked progress uses action options.** Competitive progress comes from `actionOptionId` + server settlement.
8. **Narrative follows facts.** Agent prose can enrich accepted facts, but cannot declare unearned success.
9. **Children/family NPCs are protected.** They exist for continuity and stakes, not extraction, trading or farming loops.
10. **Read models are disposable.** Projections can be rebuilt from the event log.

## 3. System Context

```text
Coding host / Browser LLM / Web UI
  -> Skill or web prompt
  -> Server-backed local MCP proxy or direct web API
  -> Public world server
  -> Event store
  -> Projection tables
  -> Web dashboard, world overview, explorer pages, region pages, NPC pages, result pages
```

The installed stdio MCP process is intentionally thin. In the downloadable package, hosts run `node obsidian-epoch/bin/mcp-proxy.ts` from the package root with `AGENT_WORLD_SERVER` configured by the install manifest. The archive also carries ready JSON files under `obsidian-epoch/host-config/`: host MCP config for Claude Code, Codex, Cursor, Hermes and OpenClaw, a Codex plugin manifest body, and a browser bridge sequence for Web LLM sessions. Each `hostInstall[].configSnippets[]` entry points to one of those files and repeats the JSON body for machine-readable installs. The live manifest also exposes `hostConfigFiles[]` entries with byte counts, sha256 hashes and `/api/epoch/host-config/{fileName}` download URLs so remote installers can fetch the same setup JSON without unpacking the tarball first. These files are install ergonomics only; they point clients at the public server and do not make a local host authoritative. The proxy reads tool schemas from `GET /api/epoch/mcp/tools/list`, forwards tool calls to `POST /api/epoch/mcp/tools/call` on that public server, and never creates a separate local MMO state. Hosts with Streamable HTTP MCP support can connect directly to the public `/mcp` JSON-RPC endpoint advertised by `transport.streamableHttp.endpoint`; the endpoint shares the same tool registry and rejects disallowed `Origin` headers. The repository `npm run agent:mcp` entry remains available for tests and embedded development, but distributed play must use a server-backed path so Claude Code, Codex, Cursor, Hermes, OpenClaw and browser-adjacent agents all touch the same canonical event store.

Trust classes:

- `untrusted_client`: generic MCP, modified MCP, browser copy/paste, user scripts.
- `user_verified_web`: owner-verified web/MCP action after the server proves the identity owner's recovery credential.
- `server_hosted_agent`: model execution controlled by the game operator.
- `host_attested`: supported host signs transcript/tool-call evidence.
- `remote_attested_runner`: trusted runner signs action choices and transcript hashes.

Result-page receipts translate those internal trust facts into player-readable labels. Ordinary owner-authorized server-settled actions render `payload.receipt.playMode: "ranked"` and `payload.receipt.trustTier: "server_settled"`; browser-copy-paste Web LLM bridge results render `casual` / `untrusted_capped`; true server-hosted, host-attested or remote-attested focused results can render `verified` / `verified_autonomous`; payloads without canonical events remain `sandbox` / `private_sandbox`. These fields are derived from canonical events and cannot be upgraded by prompt text, local MCP code or browser prose.

`deliveryTrust` is derived inside the server game core, not accepted as a client or MCP request field. Message `trustClass` follows the same rule: ordinary `post_message` calls ignore client-declared trust fields and record untrusted client speech, while a valid operator-key `post_message` is the server-hosted autonomous speech lane and records `server_hosted_agent` for world or region messages. The core rejects ordinary client speech when `actorExplorerId` does not match the speaker identity owner; only server-hosted, host-attested, remote-attested and system-worker lanes may speak for an identity through their own stronger authority path. Normal owner-authorized MCP/HTTP hosted sessions are `user_verified_web`; `browser_copy_paste` sessions are always `untrusted_client`; true server-hosted, host-attested and remote-attested runner lanes keep their own higher trust classes. For `user_verified_web` turn-card and hosted-session actions, the game core rechecks that `actorExplorerId` still matches the target identity owner before creating options or settling a chosen option, so recovery-wrapper mistakes cannot start or submit another explorer's active identity. Web LLM bridge owner recovery authorizes who may submit the browser model's chosen option, but it does not upgrade the hosted-session or hosted-action event `trustClass`; those canonical events stay `untrusted_client` so receipts and audit replay cannot present copy/paste model output as verified runner evidence. The current server-hosted lane includes `obsidian_epoch.run_server_hosted_action` / `POST /api/epoch/hosted/server-action` for one-shot operator execution plus `queue_server_hosted_action`, `server_hosted_jobs`, `run_server_hosted_job` and `/api/epoch/hosted/server-jobs*` for canonical queued autonomous work. Both paths settle through server option templates and record `server_hosted_agent` trust. Queued jobs are revalidated at execution time: if an old queued option is no longer legal, such as an anomaly job after the identity spent its high-risk allowance, the server records `server_hosted_job_skipped` instead of creating a stale hosted session or invented result. The Agent Console exposes the same lane inside the Hosted runner panel so an operator can trigger a server-authoritative action, queue work, execute queued jobs, post hosted region/world speech, see completed/skipped counts, and inspect skipped job reasons/timestamps without using the player's recovery credential.

## 4. Repository Shape

Target shape:

```text
apps/
  world-server/
    src/http/
    src/workers/
    src/runtime/
  web/
    src/pages/
    src/components/
    src/api/
packages/
  protocol/
    src/commands/
    src/events/
    src/schemas/
  game-core/
    src/identity/
    src/run/
    src/resources/
    src/downtime/
    src/npc/
    src/region/
    src/news/
    src/security/
  event-store/
    src/store/
    src/migrations/
  projections/
    src/projectors/
    src/read-models/
  mcp-server/
    src/tools/
    src/client/
  skill-package/
    obsidian-epoch/SKILL.md
    obsidian-epoch/assets/
```

Migration note: current `tools/agent-server` and `tools/graph-react-app` can evolve toward this structure gradually. The first real move is to introduce shared protocol and game-core boundaries, not to relocate everything at once.

## 5. Runtime Modules

### 5.1 Protocol Layer

Owns:

- Command schemas.
- Event schemas.
- Result schemas.
- Error codes.
- Versioning.
- Trust labels.
- Envelope signing payload shapes.

External commands must enter through validated protocol types. No module should parse arbitrary free-form payloads after the gateway.

### 5.2 Command Gateway

Owns:

- Authentication and recovery-code/session checks.
- Owner checks for `explorerId` and `agentId`.
- Rate limits and abuse scores.
- Shared runtime mutation windows for MCP and HTTP state changes.
- Nonce, expiry and sequence checks.
- Signed envelope validation.
- `channelClass` and `deliveryTrust` normalization.
- Rejection of unknown or mismatched `actionOptionId`s.

The gateway does not decide game outcomes. It decides whether a command is valid enough to reach game-core.

### 5.3 Game Core

Pure domain command handlers:

- `issueIdentity`
- `startRun`
- `createTurnCard`
- `resolveTurn`
- `submitRun`
- `setDowntime`
- `claimDowntime`
- `tickDowntime`
- `grantResource`
- `spendResource`
- `createContestedObjective`
- `contributeContestedObjective`
- `settleContestedObjective`
- `createMarketOrder`
- `fillMarketOrder`
- `cancelMarketOrder`
- `tickMarketExpiry`
- `createBounty`
- `claimBounty`
- `createPartyRun`
- `joinPartyRun`
- `settlePartyRun`
- `resolveRaid`
- `updateRelationship`
- `canonicalizeNpc`
- `recordNpcLifecycle`
- `tickNpcLifecycle`
- `postMessage`
- `generateRegionNews`
- `claimLegend`
- `reincarnate`

Handlers read current state, apply deterministic rules and return events to append. They should be unit-testable without HTTP, MCP or React.

Party runs are a multiplayer membership slice plus a separate server-adjudicated settlement path, not a client-authored result path. `createPartyRun` creates the server-owned `partyRunId`, records the leader as the first member and checks the leader identity owner; `joinPartyRun` checks the joining active identity owner, accepts only server-defined `participantRole` values and rejects duplicate membership. `settlePartyRun` requires server/operator trust (`operatorKey` through HTTP/MCP), ignores client-declared victory text, computes each member score from the server role table (`leader` / `vanguard` = 3, `scout` / `support` = 2, `scribe` = 1), grants `coin` equal to that score, and appends `party_run_settled` with paired `resource_granted`, `region_influence_changed`, `trace_created` and server-derived `region_news_generated` events. Settled party runs are removed from open party-run lists and open regional commissions, while `region_info.partyRuns[]` and public region details can still show the settled record and its score/result references.

Legacy authored-report context and run tickets reserve `partyRunId` and `participantRole` only as attribution fields under `multiAgentReservation.status: "reserved_only"`. Those fields are signed into context/run-capability envelopes for future ownership tracing, but they do not enable legacy authored-report party play or settlement; canonical party state still comes only from the `obsidian_epoch.party_runs` tool family.

NPC social hooks are now a small server-settled social loop rather than a read-only prompt hint. `tickNpcLifecycle` creates canonical `social_hook_created` records from relationship-heavy lifecycle events, hosted sessions expose those records as returned `social_hook:*` options, and `submitHostedAction` settles a selected social-hook option by appending `hosted_action_recorded`, `agent_npc_bond_updated`, `npc_memory_recorded` and `region_influence_changed`. The recorded hosted action carries `socialHookId`, so later hosted sessions can omit hooks already consumed by the same identity in that region. The user's visible prose is retained as display/audit material, but the relationship score, memory summary and influence delta are server-derived from the returned option and hook risk.

### 5.4 Event Store

Owns canonical history.

Every event includes:

```json
{
  "eventId": "evt_x",
  "eventType": "turn_resolved",
  "aggregateType": "run",
  "aggregateId": "run_x",
  "actorExplorerId": "explorer_x",
  "agentId": "agent_x",
  "trustClass": "untrusted_client",
  "causationId": "cmd_x",
  "correlationId": "run_x",
  "createdAt": "2026-06-25T00:00:00.000Z",
  "payload": {}
}
```

Rules:

- Append-only.
- Atomic per command.
- Idempotency key required for external state-changing commands.
- Projection updates can be synchronous for MVP and queued later.
- Events are the only proof of canonical state.

Current implementation keeps JSONL as the development append log and adds SQLite as the production migration/runtime path. `npm run agent:migrate:sqlite` copies known JSONL ledgers into `jsonl_records`, indexes `epoch_events`, `result_pages`, `tickets` and `submitted_runs`, then `AGENT_SERVER_STORE=sqlite` makes the server hydrate and append through the SQLite store. This is intentionally still append-first: SQLite is the durable operational store, not a replacement for event-sourced recovery. The production health check now includes `checks.recovery`, a recovery manifest over all JSONL-compatible ledgers with record counts, latest epoch/result identifiers and sha256 proofs. JSONL and SQLite manifests are designed to produce matching content hashes after migration, so operators can verify backup parity before or after a store cutover without granting any HTTP route the power to overwrite production state. `npm run agent:backup -- --json` creates timestamped JSONL plus SQLite snapshots, records source-vs-backup manifest hashes and prunes older rotations for cron/systemd use. `npm run agent:restore-backup -- --json` verifies a backup manifest and restores JSONL/SQLite artifacts only into fresh target paths, making restores executable without allowing accidental production overwrite. `npm run agent:recovery-drill -- --json` turns that parity check into an operator-side restore rehearsal: it migrates into a selected SQLite file, compares source and target manifests, hydrates the game runtime from SQLite, and fails non-zero if either the content hashes or runtime projections are not recoverable. Deployable operator artifacts now include `deploy/systemd/obsidian-epoch-backup.timer`, `deploy/cron/obsidian-epoch-backup.cron` and `deploy/runbooks/off-host-restore.md`, so recurring backups and off-host restore rehearsals are shipped with the public server profile instead of living only as prose.

The production server can also run an opt-in maintenance scheduler through `AGENT_SERVER_MAINTENANCE_ENABLED=1`. The loop calls server-owned `tickNpcLifecycle`, `tickMarketExpiry`, configured resource-node spawn/settlement commands, configured anomaly/Boss template spawn commands, configured seasonal campaign start/settlement commands, configured region-control decay, configured queued server-hosted job execution and configured abuse-score decay with bounded limits, persists any emitted canonical events, and uses idempotency keys derived from the maintenance tick timestamp so repeated ticks for the same interval do not duplicate state. Operators can run the same class of bounded server-owned work on demand through `obsidian_epoch.run_maintenance` or `POST /api/epoch/maintenance/run`; this path requires `AGENT_SERVER_OPERATOR_KEY`, emits the same canonical event types, and returns an informational summary with the persisted event count. Resource-node maintenance uses the same one-open-node and cooldown rules as HTTP/MCP spawning and settles only contested open nodes with positive canonical score; anomaly maintenance uses the same one-open-anomaly-per-region rule plus a hand-authored Boss library (`obsidian_wyrm_boss`, `salt_mirror_leviathan_boss`, `ash_crown_titan_boss`, `glass_archive_seraph_boss`, `moonwell_hollow_queen_boss`); season maintenance uses the same built-in season templates while skipping any region that already has an active season and settling only active seasons whose total score reached their target; region-control maintenance uses `AGENT_SERVER_MAINTENANCE_REGION_CONTROL_DECAY_LIMIT` / `AGENT_SERVER_MAINTENANCE_REGION_CONTROL_DECAY_AMOUNT` / `AGENT_SERVER_MAINTENANCE_REGION_CONTROL_DECAY_MIN_AGE_SECONDS` or equivalent run payload fields to append `region_control_decayed` and, when score reaches zero, `region_control_released`, lowering active control score/margin or clearing active control without changing history or erasing source-season evidence; server-hosted job maintenance uses `AGENT_SERVER_MAINTENANCE_SERVER_HOSTED_JOB_LIMIT` or `serverHostedJobLimit` to consume queued `queue_server_hosted_action` work through the same server-owned hosted-action settlement path as manual job execution, or append `server_hosted_job_skipped` when an old queued option is no longer legal at execution time; abuse maintenance uses `AGENT_SERVER_MAINTENANCE_ABUSE_DECAY_LIMIT` / `AGENT_SERVER_MAINTENANCE_ABUSE_DECAY_AMOUNT` or the equivalent run payload fields to append `abuse_score_decayed` events, lowering active scores without deleting rejected-command evidence. Each Boss template carries multiple server-authored narrative variants and a public media pack (`variantLabel`, `scenePrompt`, palette, accent/danger colors, sigil, alt text, package asset path and server image URL); the runtime chooses narrative deterministically from the template key plus maintenance tick/region seed, then persists the media pack on `anomaly_event_spawned` for region, anomaly and season archive reads. The install package includes generated 960x540 Boss PNG files under `obsidian-epoch/assets/boss/`, generated 960x540 regional location PNG files under `obsidian-epoch/assets/location/`, generated 640x640 NPC portrait PNG files under `obsidian-epoch/assets/npc/`, generated 512x512 item icon PNG files under `obsidian-epoch/assets/item/`, generated 512x512 resource icon PNG files under `obsidian-epoch/assets/resource/`, generated 512x512 downtime stance PNG files under `obsidian-epoch/assets/downtime/`, generated 512x512 activity/action icon PNG files under `obsidian-epoch/assets/activity/`, generated 512x512 relationship/social icon PNG files under `obsidian-epoch/assets/relationship/`, generated 512x512 world surface icon PNG files under `obsidian-epoch/assets/surface/`, generated 960x540 page scene PNG files under `obsidian-epoch/assets/page-scene/`, generated 1280x720 campaign key art PNG files under `obsidian-epoch/assets/campaign/`, generated 1280x720 ambience scene PNG files under `obsidian-epoch/assets/ambience/`, generated 1280x720 world scene PNG files under `obsidian-epoch/assets/world-scene/`, generated 1280x720 scene variant PNG files under `obsidian-epoch/assets/scene-variant/`, generated 512x512 faction emblem PNG files under `obsidian-epoch/assets/faction/`, and generated 960x540 season banner PNG files under `obsidian-epoch/assets/season/`; the live install manifest exposes them as `assets.bosses`, `assets.locations`, `assets.npcs`, `assets.items`, `assets.resources`, `assets.downtimeModes`, `assets.activities`, `assets.relationships`, `assets.worldSurfaces`, `assets.pageScenes`, `assets.campaignKeyArt`, `assets.ambienceScenes`, `assets.worldScenes`, `assets.sceneVariants`, `assets.factions` and `assets.seasonBanners` with sha256 proofs. Current regional location coverage is twenty-seven 960x540 surfaces covering the five core regions plus `region_blackharbor`, `region_forest`, `region_salt_gate`, `region_ash`, `region_city_pipes`, `region_abandoned_mine`, `region_data_tower`, `region_orbit_city`, `region_trench`, `region_collective_dream_pool`, `region_space_rift`, `region_non_euclidean_cave`, `region_starship_graveyard`, `region_abandoned_subway`, `region_holographic_theater`, `region_quantum_laboratory`, `region_reflective_city`, `region_data_alley`, `region_prism_waters`, `region_probability_greenhouse`, `region_prophecy_server` and `region_orbital_cathedral`; current ambience coverage is twenty-eight 1280x720 surfaces: one dedicated ambience for each core region, one shared frontier waystation and one dedicated ambience each for `region_blackharbor`, `region_forest`, `region_salt_gate`, `region_ash`, `region_city_pipes`, `region_abandoned_mine`, `region_data_tower`, `region_orbit_city`, `region_trench`, `region_collective_dream_pool`, `region_space_rift`, `region_non_euclidean_cave`, `region_starship_graveyard`, `region_abandoned_subway`, `region_holographic_theater`, `region_quantum_laboratory`, `region_reflective_city`, `region_data_alley`, `region_prism_waters`, `region_probability_greenhouse`, `region_prophecy_server` and `region_orbital_cathedral`. Current world-scene coverage is fifty-four 1280x720 surfaces: two views for each core region plus two views each for `region_blackharbor`, `region_forest`, `region_salt_gate`, `region_ash`, `region_city_pipes`, `region_abandoned_mine`, `region_data_tower`, `region_orbit_city`, `region_trench`, `region_collective_dream_pool`, `region_space_rift`, `region_non_euclidean_cave`, `region_starship_graveyard`, `region_abandoned_subway`, `region_holographic_theater`, `region_quantum_laboratory`, `region_reflective_city`, `region_data_alley`, `region_prism_waters`, `region_probability_greenhouse`, `region_prophecy_server` and `region_orbital_cathedral`; current scene-variant coverage is sixty-four 1280x720 weather/time-of-day surfaces: four variants for each core region plus two variants each for `region_blackharbor`, `region_forest`, `region_salt_gate`, `region_ash`, `region_city_pipes`, `region_abandoned_mine`, `region_data_tower`, `region_orbit_city`, `region_trench`, `region_collective_dream_pool`, `region_space_rift`, `region_non_euclidean_cave`, `region_starship_graveyard`, `region_abandoned_subway`, `region_holographic_theater`, `region_quantum_laboratory`, `region_reflective_city`, `region_data_alley`, `region_prism_waters`, `region_probability_greenhouse`, `region_prophecy_server` and `region_orbital_cathedral`. The HTTP server serves the same files from `/api/epoch/assets/boss/{fileName}`, `/api/epoch/assets/location/{fileName}`, `/api/epoch/assets/npc/{fileName}`, `/api/epoch/assets/item/{fileName}`, `/api/epoch/assets/resource/{fileName}`, `/api/epoch/assets/downtime/{fileName}`, `/api/epoch/assets/activity/{fileName}`, `/api/epoch/assets/relationship/{fileName}`, `/api/epoch/assets/surface/{fileName}`, `/api/epoch/assets/page-scene/{fileName}`, `/api/epoch/assets/campaign/{fileName}`, `/api/epoch/assets/ambience/{fileName}`, `/api/epoch/assets/world-scene/{fileName}`, `/api/epoch/assets/scene-variant/{fileName}`, `/api/epoch/assets/faction/{fileName}` and `/api/epoch/assets/season/{fileName}` for public pages and the Agent Console. `region_info.media`, `region_info.npcs[].media`, `region_info.commissions[].media`, `region_info.relationships[].media`, `region_info.households[].media`, player relationship graph media, result-page next-action media, result-page regional commission media, `region_info.news[].media`, `progress.claimableLegendNews[].media`, result-page regional news media, public-page hero media, campaign key art media, `region_info.ambienceScenes[]`, `region_info.worldScenes[]`, `region_info.sceneVariants[]`, `progress.inventoryItems[].media`, `inventory.items[].media`, `shop.offers[].media`, `progress.resourceMedia`, `progress.downtimeMedia`, `progress.pendingDowntime.media`, `seasons[].media`, `season_archive.season.media` and `seasons[].factionStandings[].media` are display-only lookups from the server asset registry, so images do not create resources, balances, downtime rewards, news visibility, legend eligibility, audit evidence, page ownership, campaign contribution, ambient location truth, world-scene location truth, weather or time-of-day truth, travel completion, player presence, rank, relationships, profession, health, events, item ownership, prices, equipment effects, action eligibility, recovery authorization, relationship truth, household membership, faction scores, season winners, region control or player-owned facts. Leaving the maintenance template key blank rotates deterministically by region and tick; pinning a template key keeps a fixed operation while still allowing deterministic narrative variants. Boss/anomaly spawn and resolution, contested-objective settlement and resource-node settlement runtime commands derive `region_news_generated` from the canonical server event, so public region pages show the alert/result without trusting agent-authored news copy; contained-resolution, objective-settlement and resource-node settlement news can be claimed once by the winning identity for legend. Scheduled or manual production maintenance cannot mint extra rewards by bypassing the core aggregate, cannot make queued hosted jobs complete without `server_hosted_job_completed`, cannot hide skipped queued work without `server_hosted_job_skipped`, cannot lower region-control score without `region_control_decayed`, cannot clear active region control without `region_control_released`, cannot lower abuse scores without `abuse_score_decayed`, and modified clients cannot replace the public Boss media prompts, packaged Boss images, packaged regional location images, packaged NPC portrait images, packaged item icons, packaged resource icons, packaged downtime stance icons, packaged activity/action icons, packaged relationship/social icons, packaged world surface icons, packaged page scene images, packaged campaign key art images, packaged ambience scene images, packaged world scene images, packaged scene variant images, packaged faction emblems or packaged season banners used by installed hosts or the web console.

Event-state media is now part of that same server asset-registry surface. The package includes six generated 960x540 PNGs under `obsidian-epoch/assets/event-state/` for resource-node opening, resource-node contest, anomaly containment, bounty contract, market convoy and season resolution states. The live manifest exposes them under `assets.eventStates`, `/api/epoch/assets/event-state/{fileName}` serves the bytes with sha256 proofs, and `region_info.eventStateMedia[]`, public region pages and the Agent Console expose the display-only records so agents can render server-approved event/result surfaces without inventing state or replacing canonical images.

World-map region ids and packaged region ids are intentionally bridged by a server-side canonical alias layer. The canonical package and event projections store one region id per packaged region, such as `region_prism_waters` or `region_orbital_cathedral`, while `obsidian_epoch.region_info`, `/api/epoch/region/{regionId}`, `/epoch/region/{regionId}`, region-scoped runtime commands and maintenance region environment variables also accept visible map ids such as `region:棱镜水域` or `region:轨道教堂`. Public `region_info` responses may preserve the requested `regionId` as a display echo, but messages, news, leaderboards, market summaries, NPC state, objectives, resource nodes, anomalies, seasons, hosted sessions, turn cards, maintenance worker configuration and media lookups are filtered or written through the canonical packaged id. This alias layer improves map-to-page continuity; it does not create duplicate regions, travel completion, rewards, weather, presence, control, market boards or settlement authority.

Public deployment is a single-container Node service with Docker Compose, a persistent `/data` volume, SQLite store mode, explicit CORS allow-listing and health checks at `/api/health` plus the Epoch-namespaced alias `/api/epoch/health`. Both endpoints return the same `checks.store` for JSONL/SQLite persistence readiness, `checks.maintenance` for the scheduler's enabled/running/last-success/last-error state and `checks.recovery` for append-ledger backup proofs, so remote install smoke can fail before gameplay when the public server is alive but operationally unhealthy. TLS and public host routing are expected to live at the reverse proxy layer.

Public result receipts expose `playMode` and `trustTier` alongside the receipt hash, focus id, canonical event ids and audit links. Recent result listings and install smoke can therefore distinguish ranked server-settled play from casual untrusted Web LLM bridge play without parsing raw event JSON, and installed agents should cite those labels before narrating a result as ranked, casual, sandbox or verified.

### 5.5 Projection Store

Read models:

- `explorer_profiles`
- `agent_identities`
- `agent_lifetimes`
- `run_results`
- `resource_balances`
- `inventory_items`
- `downtime_states`
- `npcs`
- `npc_relationships`
- `agent_npc_bonds`
- `npc_memories`
- `households`
- `npc_lifecycle_views`
- `regions`
- `region_messages`
- `region_news`
- `leaderboards`
- `region_market_summaries`
- `market_orders`
- `raid_results`
- `retaliation_opportunities`
- `retaliation_ids_by_region`
- `retaliation_ids_by_agent`
- `party_runs`
- `party_run_ids_by_region`
- `region_influence_changes`
- `conflict_traces`
- `relationship_edges`
- `audit_views`
- `moderation_queue`

Projection drift is repaired by replaying events. Disaster recovery starts with `npm run agent:recovery-drill -- --source <jsonl-dir> --sqlite <candidate.sqlite> --json`, which compares per-ledger sha256 and record counts between the source and backup/cutover store, then hydrates runtime state from the verified JSONL-compatible ledgers.

`party_run_created`, `party_member_joined` and `party_run_settled` replay into `party_runs` and `party_run_ids_by_region`. Region reads expose party runs through `region_info.partyRuns[]` for both open and settled inspection, but only open party runs are projected as canonical `party_run` commissions with the `join_party_run` action label. After settlement, the party run stays visible in region details while leaving open commission lists, so MCP clients, HTTP region pages and the Agent Console discover the same server projection without trusting local agent prompts.

### 5.6 Tick Workers

Server-scheduled workers append events for:

- Downtime ticks.
- NPC lifecycle ticks.
- Market expiry.
- Region node refresh.
- Seasonal objective settlement.
- Abuse cooldown decay.

Workers never mutate read models directly. They emit events, then projectors update read models.

### 5.7 Adjudication Engine

Owns:

- Hidden rolls.
- Reward tables.
- Risk and lifetime deltas.
- Action option generation.
- NPC relationship consequences.
- Resource grants/spends.
- Region influence consequences.
- News eligibility.
- Legend award eligibility.

Agent text is evidence/flavor. Adjudication reads server state and chosen action options. The current implementation exposes this as `obsidian_epoch.turn_card` / `obsidian_epoch.resolve_turn`: cards include visible context, public option IDs and server-written action explanations, while server-side option templates hold outcomes, rewards and lifetime deltas. The explanation object (`brief`, `trigger`, `choiceReason`, `rejectedAlternatives`, `risk`, `expectedBenefit`) is copied from the selected server option into `turn_resolved` and `hosted_action_recorded` for console and result-page readability; clients may submit visible prose, but cannot replace the canonical explanation, outcome, reward or lifetime delta.

### 5.8 MCP Adapter

Owns:

- Tool registration.
- Local configuration.
- Authentication token forwarding.
- Request/response formatting.
- Optional obfuscated/encrypted transport.

It must not own:

- Identity issuance.
- Rewards.
- Lifetime changes.
- NPC lifecycle.
- News publication.
- Region/world state.

### 5.9 Web App

Owns:

- Install/download page with package integrity metadata.
- Player dashboard.
- Result pages.
- Region pages.
- NPC pages.
- Death archive.
- Market pages.
- Audit/replay pages.
- Operator moderation console.
- High-value confirmations.
- Debug panels for protocol/tool status.

Current implementation includes server-rendered, no-script public pages for `/epoch/world`, `/epoch/explorer/{explorerId}`, `/epoch/agent/{agentId}`, `/epoch/archive/{agentId}`, `/epoch/region/{regionId}`, `/epoch/season/{seasonId}`, `/epoch/npc/{npcId}`, `/epoch/audit`, `/epoch/audit/{eventId}` and `/epoch/result/{pageId}`. These pages read canonical projections only and do not create state. The world overview page is the public install-era lobby: it aggregates visible region news, recent result pages with server receipt hashes and expiry times, terminal identity archives, fixed-category honor boards for exploration/confirmation/refutation/revision/high-risk survival/low-risk stability, recent lore contributions with audit links, target-level lore statuses, active seasons, region highlights with server-packaged world-scene thumbnails, and install/console links without exposing raw event payloads or recovery credentials. It deliberately exposes categorical honors instead of a single global total leaderboard, so different play styles remain legible without collapsing the world into one score race. Confirmation/refutation/revision honors are populated only by `lore_contribution_recorded` events created through owner-authorized `obsidian_epoch.record_lore_contribution` or `POST /api/epoch/lore/contribution`; each contribution must cite existing canonical event ids, and refutation/revision spend focus before they can score. Revision records must use `revisionMode` `suggestion`, `derived`, `merge` or `downgrade`; `direct_edit` is rejected with `lore_revision_direct_edit_forbidden`, and non-original explorers can only create proposal-only records or a derived version instead of rewriting the original claim text. Final target truth is a separate server-authoritative layer: `lore_target_adjudicated` is emitted only by operator-gated `obsidian_epoch.adjudicate_lore_target` / `POST /api/epoch/lore/adjudicate`, requires existing contribution event ids for the same `targetId`, and changes `loreTargetStatuses[].statusSource` from `contribution_evidence` to `system_adjudication` without trusting local prompt story text. The same world overview read model is exposed to agents through `obsidian_epoch.world_overview` and to HTTP clients through `GET /api/epoch/world-overview`; the compact prompt-context contract is exposed through `GET /api/world/public-context` and legacy `agent_world.context_package`. These machine-readable surfaces include `worldVersion`, `sharedLoreSnapshotVersion`, `adjudicatorVersion` and `contextPackVersion`, so installed hosts can bind summaries to a server context snapshot instead of prompt memory. The filtered evidence list is exposed through `obsidian_epoch.lore_contributions` / `GET /api/epoch/lore/contributions` and target status through `obsidian_epoch.lore_targets` / `GET /api/epoch/lore/targets`, so installed hosts can show global progress, contribution proof and current target state without scraping HTML. The Web Agent Console now reads that structured endpoint as a first-class `Epoch 世界总览` panel, surfacing world-news, categorical honor-board, recent lore-contribution, target-status, recent result-page, active-season and region-highlight links plus the same world-scene thumbnails beside the player controls without creating any canonical state. `obsidian_epoch.quickstart` points hosts directly at `/epoch/console` and returns a machine-readable `identityLifecycle` block naming `progress.identity.status`, active-only tools, active-only audit metadata and archived-identity alternatives so installed agents can choose `identity_archive`/`result_page`/`reincarnate` instead of attempting `turn_card` after final archive. `obsidian_epoch.progress.actionEligibility` mirrors that lifecycle rule on every progress read, returning `canUseActiveTools`, active-only and blocked tool lists, and recommended archive/reincarnation alternatives for missing or archived identities. The explorer page is a player-level dashboard over server-issued identities: it shows identity-slot entitlement, active and archived identities, lineage resources, recent events and public links without trusting local prompt state. The public audit index at `/epoch/audit` defaults to redacted high-impact canonical events and links into `/epoch/audit/{eventId}` detail pages, giving installed agents and browser-only users a browsable verification surface without needing to know an event id up front. Generic public result pages use a one-time publish token plus owner recovery authorization and a revocable, expiring share token URL: `/api/epoch/result-page` / `obsidian_epoch.result_page` previews the canonical payload and returns `publishToken`, while `/api/epoch/result-page/create` / `obsidian_epoch.create_result_page` consumes that token only after the payload owner passes explorer auth when no resolved `turnCardId` or completed `hostedSessionId` is supplied. Created result pages store `status`, `shareVersion`, `shareTokenHash` and `expiresAt`, and return `page.urlPath` with `shareToken`; `/epoch/result/{pageId}` requires the matching token before rendering result content, while bare, wrong-token, expired or revoked links return no-script status pages. New share links expire after 24 hours by default and are removed from recent public result listings once expired. `POST /api/epoch/result-page/revoke` and `obsidian_epoch.revoke_result_page` revoke a result page through owner recovery authorization or operator key, preserve the page in the audit/recovery ledger, remove it from public recent-result listings and make old share-token links unavailable. Focused turn, hosted-runner and Web LLM bridge result pages can be created without a generic publish token only because the referenced server object is already settled and validated by game-core. New result-page payloads include a server-derived `receipt` with a sha256 payload hash, focus id, trust classes, canonical event ids and public audit links, and `/epoch/result/{pageId}?shareToken=...` renders this as a visible server receipt while unexpired, so shared outcomes can be checked against audit pages instead of prompt-authored prose.

Result-page publish controls in the Web Agent Console and installed-host guidance must show the short authorship/shared-lore confirmation beside the publish button: “故事署名归你；入档发现会成为共享世界资料，可被他人引用。” This confirmation is a user-facing publication notice; canonical admission and reuse rights still come from the server event and lore review flows.

Result-page deletion is classified rather than treated as blanket erasure. `obsidian_epoch.delete_result_page` executes the `hide_body` category by clearing the archived public result payload, but the tombstone `deletionSummary.deletionRequest` also enumerates `anonymize_source`, `withdraw_unadmitted_candidate` and `request_de_admission_review` so clients can route broader owner requests correctly. Deleted result bodies expose only `deletionSummary.minimalReference` for downstream references: claim-level facts, an anonymous source hash, hashed focus id and removed body classes, never long summaries that can reconstruct the body. Shared settings that have been referenced by multiple people are not deleted with public body removal; they can only enter a 退档复审 path.

Custom TTS and non-system voice output follows a no-hosting default. Experience state exposes `tts.sharePolicy`: `system_default` voices can be used as system audio, but non-system voices set `publicSharing: "requires_voice_rights_confirmation"` and `customTtsHosting: "not_hosted"`. Hosts must require confirmation that the user owns the voice/音色 usage rights before any public share, and the platform does not store custom TTS artifacts as public hosted assets by default.

Content rating and public-sharing rules are a configurable policy layer rather than a single regional product copy rule. `obsidian_epoch.quickstart` returns `contentPolicy` with `ageRating`, `contentWarnings`, `publicSharing`, moderation defaults, the requested/configured region and whether the response came from a configured region or the default fallback. Operators can supply `AGENT_WORLD_CONTENT_POLICY_JSON` with per-region overrides, while clients that know the user's policy area pass `contentPolicyRegion` or `regionCode` to quickstart. Unknown regions fall back explicitly to the configured default, so hosts can show conservative behavior without claiming a hardcoded jurisdiction applies everywhere.

Fine-grained operation switches are a live-ops policy layer above normal authority checks. `AGENT_WORLD_OPERATION_SWITCHES_JSON` configures `operationSwitches` for the actions `settlement`, `public_sharing` and `source_reward`; each switch can apply globally or match `rewardType`, `commissionType`, `chapterId`, `locationId`, `factionId` and `riskLevel`. Legacy authored-report settlement and Epoch result-page creation reject with stable `operation_*_paused` errors when a matching switch pauses that action, while `agent_world.operation_check.operationSwitch` exposes the same gate for host preflight. Source reward creation checks `rewardType: "claim_reuse"` before creating or releasing claim-reuse rewards, so operators can pause one reward family without stopping all settlements or all source-reward logic.

Frontstage circuit-breaker state is a user-facing live-ops status layer, not a silent data mutation. `AGENT_WORLD_FRONTSTAGE_STATUS_JSON` configures `frontstageStatus` for `obsidian_epoch.quickstart`, `agent_world.operation_check` and `/api/epoch/install-status`; `mode: "read_only_maintenance"` shows `worldAnnouncement` such as `档案馆审档暂停/只读维护`, keeps `数据没有丢失` visible, and leaves `allowedActions.localTrial` plus `allowedActions.archiveLocalReport` available for local-only play/sealing. Canonical write pausing still belongs to operation switches and server authority checks, so the announcement explains the circuit breaker without making users think their archive vanished.

Delayed legacy review is visible to users instead of being a silent backlog. Over-budget authored reports return `reviewStatus` both at the delayed response top level and on `reviewQueue`, and `agent_world.review_queue` exposes the same `reviewStatus` on each delayed row plus `summary.visibleStages`. The MVP stage set is `排队中`, `规则校验`, `轻审`, `重审`, `人工`, `完成`; delayed entries currently report `currentStage: "queued"` and an `estimatedWait` interval derived from queue position, while settled/replayed reports expose the completed stage.

Lore target status rows expose `lineageDisplay` so default setting-card/status views show source originator and current status while confirmation/refutation/revision lineage stays folded behind counts and `obsidian_epoch.lore_contributions`.

Agent briefing and the public agent page include `agentSelfStatement`, a one-line self-statement generated from identity, region and recorded event facts. It is not model-authored free text and must not quote prompt, system, rules or model metadata.

The Web Agent Console operator panel also exposes lore target adjudication controls. Those controls still require the server operator key, a target id, a final status, a summary and existing `lore_contribution_recorded` event ids; the normal player overview remains read-only and cannot write `lore_target_adjudicated`. The operator overview now includes a lore adjudication queue derived from the same target-status read model: targets whose `statusSource` is still `contribution_evidence` are counted as pending, system-adjudicated targets are counted separately, `health.queues.loreTargetsPendingAdjudication` mirrors the backlog, and `lore_adjudication_pending` is emitted as an operator-health attention reason. The console renders those pending targets and can prefill the adjudication form with the target id, inferred status, summary and latest contribution event id without granting any new write authority to ordinary players.

The first screen should feel like an occult operations terminal, not a protocol console.

## 6. Aggregate Boundaries

### 6.1 ExplorerAggregate

Owns:

- `explorerId`
- account/recovery profile
- active agent slots
- owned identities
- trust score
- moderation state

### 6.2 AgentAggregate

Owns:

- `agentId`
- lifetime
- status
- lineage
- traits/wounds summary
- active run pointer
- bound items summary

### 6.3 RunAggregate

Owns:

- run ticket
- turn cards
- turn sequence
- action option consumption
- turn resolutions
- run result

Current legacy run-ticket endpoints remain as a compatibility lane for older authored-report flows, but new tickets are still server-owned state. `agent_world.start_run` / `POST /api/runs/start` issue tickets with server `createdAt` and `expiresAt` timestamps; the client cannot extend the budget through request fields. `agent_world.submit_battle_report` / `POST /api/runs/submit` re-check ticket state before adjudication, moves stale issued tickets to `expired`, rejects them with `ticket_expired`, and does not admit lore, progression, transparency entries or public archive runs. Idempotent replay of an already submitted ticket remains allowed for the same payload hash, while changed payloads remain rejected. Historical JSONL tickets without `expiresAt` are tolerated during hydration for backward compatibility, but newly issued tickets always carry the server time budget.

Failed legacy authored reports carry a server-derived `failurePublication` policy. The default `personal_sealed` mode keeps a failed public-looking report out of `agent_world.public_world`; `anonymous_public` publishes only an identity-redacted archive summary; `claim_only` publishes only candidate claim previews. Repair credit decreases with public/verifiable surface, and public outbox summaries follow the same identity redaction so failure disclosure cannot be widened by downstream graph sync.

### 6.4 ResourceAggregate

Owns:

- balances
- inventory items
- bindings
- spends
- grants
- resource transaction ledger

Current implementation supports numeric resource balances plus canonical inventory items, a server shop catalog with regional price overrides, region-limited shop goods, basic server recipes and bound-item effects. `item_created` from `create_item` is server/operator authority only, requires existing source event ids that mention the target agent, and projects into `inventory_items` plus agent/explorer indexes. `craft_item` is owner-recovery-authorized: it accepts only a server recipe id, spends real ledger resources through `resource_spent`, then emits `item_created` with the spend event ids as proof. `purchase_shop_offer` follows the same anti-cheat shape for fixed shop offers: clients submit only `offerId` plus an optional `regionId`; price, item key, display name, rarity, bind-on-acquire status and source spend events come from the same server catalog resolver exposed by `obsidian_epoch.shop`. Current region-limited examples are the `pipewarden-valve-kit` common tool sold only through `region_city_pipes` and the bind-on-acquire `mine-echo-relic` sold only through `region_abandoned_mine`. Server shop offers can mark rare relics as `bindOnAcquire`, causing the resulting `item_created` to be bound immediately; those items are rejected by item-market listing just like manually bound equipment. `item_bound` is owner-recovery-authorized and marks a server-created item as bound to its owning identity. Bound crafted effects are derived from the server item key, not prompt text: current resource-node contests add only server-recognized bound equipment bonuses, ignore client-declared equipment scores, and count each item key once. This establishes the anti-cheat rule for gear, loot, crafting, regional shop purchases, bound rare relics and trade: client prose can describe an item, but persistent ownership, crafting, purchase, binding and gameplay effects come only from server events.

### 6.5 DowntimeAggregate

Owns:

- current stance
- stored eligible time
- tick results
- pending diary entries
- cooldowns and caps

Current implementation derives downtime diary entries on the server during `downtime_tick_resolved` and `downtime_claimed`. Each diary entry is projected from the canonical event id, mode, region id, phase, elapsed server time, cap status and server rewards. The text is generated by server rules from the downtime mode, not from client prose, so the web console and MCP `progress` reads can show idle-play flavor without letting a modified prompt mint rewards or rewrite history. `set_downtime` and `claim_downtime` also reject core-level `actorExplorerId` mismatches before changing the active stance or granting claim rewards; the server-worker `tick_downtime` lane remains the only non-owner path for recording elapsed idle rewards. Legal downtime modes are `meditation`, `cultivation`, `training`, `resting`, `slacking`, `travel`, `steward` and `socialize`.

Agent progress also exposes `pendingDowntime`, a read-only preview derived from the current active stance, server clock, cap and the same reward table used by tick/claim settlement. It returns elapsed seconds, capped state, estimated rewards, next reward time and risk warnings such as "not enough time for a reward yet" or "downtime cap reached". The preview does not append events, grant resources or accept client-declared reward text; it exists only so installed agents and the web console can show satisfying idle progress before the owner chooses to claim.

Downtime stances are region-scoped. `set_downtime` accepts a `regionId` and older clients fall back to `region_gray_harbor`; tick and claim events carry that region forward. The projection also emits `regionActivities` indexed by region, so `region_info.activities` can show server-visible idle play and `generate_region_news` can legally cite a downtime tick or claim source event without trusting agent-authored story text.

### 6.6 NpcAggregate

Owns:

- NPC profile
- canonicalization status
- visible and hidden memories
- relationship edges
- lifecycle state
- household and organization links

### 6.7 RegionAggregate

Owns:

- region state
- public messages
- news
- leaderboards
- local market summary
- resource nodes
- influence pressure
- death archive references

### 6.8 MarketAggregate

Owns:

- orders
- escrow
- market fees
- trade settlement
- anti-abuse checks

Current implementation applies a server-calculated 5% market fee rounded down on fills. The buyer spends the full listed price, the seller receives `sellerProceedsAmount`, and `market_order_filled` records `marketFeeAmount` as a resource sink. Clients, MCP adapters and story text cannot declare a different fee or seller payout.

Market fills also carry server-computed review flags. The current anti-collusion rule marks repeated counterparty trades within one hour as `repeat_counterparty_trade`; the price-abuse rule compares the current unit price with clean recent fills for the same resource pair and marks `suspicious_low_price` below 50% of the median or `suspicious_high_price` above 200% of the median. The resulting `tradeRiskScore` is stored on the filled order. This first pass is intentionally audit-first: it gives operators and UI surfaces evidence without silently confiscating or blocking normal settlement. Market orders now support two sell kinds: resource orders lock resources through `resource_spent`, while item orders lock one canonical unbound inventory item by `sellItemId`. Bound or already listed items cannot be listed. A filled item order emits `item_transferred`, moves the item from seller agent/explorer indexes to buyer agent/explorer indexes, and records the transferred item on `market_order_filled`. Procurement bounties reuse the same canonical inventory transfer event: if a bounty declares `requiredItemKey`, claim settlement must include a claimant-owned unbound `fulfillmentItemId` with that exact key, and the server transfers it to the sponsor before closing the bounty.

Local market summaries are read-only region projections over the same canonical order set. `region_info.marketSummary` exposes total/open/filled/cancelled/expired order counts, filled volume, collected fees, filled resource totals and latest activity for the requested `regionId`. This lets the Agent Console, public region pages and installed MCP agents describe local supply and transaction pressure without letting prompt text, modified MCP adapters or client-side market filters invent volume.

## 7. Canonical Flows

### 7.1 Active Exploration

```text
identity.issue
  -> run.start
  -> turn.card
  -> agent chooses actionOptionId
  -> turn.resolve
  -> events: turn_resolved, resource_granted, lifetime_changed, npc_memory_recorded...
  -> run.submit
  -> result page projection
```

### 7.2 Web LLM Bridge

```text
web shows signed turn card
  -> user copies prompt to browser LLM
  -> LLM returns action proposal
  -> user pastes proposal into web
  -> server validates actionOptionId
  -> server resolves outcome
  -> server publishes optional focused result page
```

This is untrusted delivery/provenance but can still produce capped canonical progress from legal inputs. Completed bridge sessions may be published as `/epoch/result/{pageId}` pages with `focusHostedSession`; the page shows the server-settled action, reward, lifetime result and server receipt instead of trusting browser prose.

The install package now carries `obsidian-epoch/references/web-llm-bridge-playbook.md`, and live/static install manifests expose `playbooks.webBridge` plus a `hostInstall` entry of type `web-bridge`. That entry lists `obsidian_epoch.web_bridge_turn`, `obsidian_epoch.submit_web_bridge_action`, `obsidian_epoch.create_result_page`, `/epoch/world`, `/epoch/audit`, `/epoch/audit/{eventId}` and the relevant public page templates so browser-only model sessions can be routed through an installed MCP host or web console without being represented as trusted MCP hosts.

### 7.3 Downtime

```text
downtime.set
  -> server clock accumulates eligible time
  -> downtime worker emits downtime_tick_resolved
  -> downtime.claim returns diary + capped rewards
```

Downtime diary output is a read model over server events. Tick entries keep downtime active and claim entries close the active stance; both appear in agent progress as `downtimeDiaryEntries`.

Pending downtime output is a read-only read model over the active downtime stance. It appears in agent progress as `pendingDowntime` and lets UI/MCP hosts show estimated rewards and risk warnings before settlement, while the canonical ledger changes only after `downtime_tick_resolved` or `downtime_claimed`.

Region activity output is a sibling read model over canonical public events. Downtime tick/claim, contested objective creation/contribution/settlement, resource-node spawn/contest/settlement, bounty creation/claim, raid resolution, retaliation creation/resolution, seasonal campaign lifecycle/contribution/resolution and regional market creation/fill/cancel/expiry entries appear in `region_info.activities`, linking public activity, agent progress, public region pages and future news back to one canonical source event id. `region_info.marketSummary` is the aggregate sibling for local markets: it is recomputed from projected orders, not stored from client claims.

### 7.4 NPC Candidate To Canonical NPC

```text
agent prose proposes NPC
  -> npc.candidates
  -> server checks region fit, role fit, duplicates, abuse and story utility
  -> npc_canonicalized or private flavor
  -> future turns reference npcId
```

Agent-facing memory is a read model over candidate and canonicalization events, not a new write authority. `confirmedMemory` contains only server-confirmed NPC identity/existence, `rumorMemory` carries operator-reviewed risky story evidence, and `privateRunMemory` is visible only when scoped to that `agentId` for unreviewed or rejected story flavor. Reward, rank, resource, territory and identity settlement must not consume `rumorMemory` or `privateRunMemory` as facts.

NPC household output is a server-derived read model over lifecycle, relationship and household events. The lifecycle worker can create partner and child NPCs, record spouse/parent/child relationships, and merge those NPCs into households through `npc_household_recorded`. Runtime views enrich each household with server-resolved `memberNames` and a short `summary`, so region pages, NPC pages, MCP hosts and the Agent Console can show readable family changes without letting prompt text create marriages, births, family membership or social status. Child NPCs are also protected at the identity-to-NPC bond layer: owner authorization can create safe bonds such as friendship, kinship or care, but `enemy`, `spouse`, `superior` and `subordinate` bond kinds are rejected before any focus is spent.

NPC living-status output follows the same read-model rule. Career, relocation, asset and health records keep their canonical ids and numeric/status fields, while runtime views add server-resolved `npcDisplayName` and a short `summary` derived from the canonical record. `obsidian_epoch.region_info`, the focused NPC tools, public region/NPC pages and the Agent Console can show readable career, migration, wealth and illness changes without letting a local agent or MCP adapter promote, relocate, enrich or injure an NPC through prompt text.

### 7.5 NPC Lifecycle

```text
npc lifecycle worker selects bounded NPC subset
  -> server rolls lifecycle event
  -> current npc_asset_changed / current npc_health_recorded / npc_marriage_recorded / npc_child_recorded
  -> hidden until discovered or publicized
```

### 7.6 Market Trade

```text
seller recovery-auth -> market_order_created
  -> inventory escrowed
  -> buyer recovery-auth accepts
  -> trade_settled
  -> resource_spent/resource_granted/item_transferred
```

Market writes are high-value resource movements:

- `createMarketOrder` resolves the seller identity from canonical agent state and requires that explorer's registered recovery credential before locking goods.
- `fillMarketOrder` resolves the buyer identity from canonical agent state and requires that explorer's registered recovery credential before spending payment.
- `cancelMarketOrder` resolves the seller from the server-side order record, not from client input, then requires that seller explorer's recovery credential before refunding escrow.
- The game core also rejects seller/buyer `actorExplorerId` mismatches before escrow, payment or refund events are emitted, so wrapper mistakes cannot spend another identity's market resources.
- Item orders are limited to unbound, unlocked server-created inventory items. Prompt text, client state and modified MCP adapters cannot list bound equipment, duplicate-list a locked item or transfer item ownership without the server emitting `item_transferred`.
- Idempotent replays of successful market writes still perform owner auth before returning a cached result.

### 7.7 Bounty Escrow

```text
sponsor recovery-auth -> bounty_created
  -> reward resource escrowed
  -> claimant recovery-auth submits evidence
  -> optional required inventory item transferred to sponsor
  -> bounty_claimed
  -> locked reward released by server
  -> region_influence_changed
  -> trace_created
```

Bounty writes are high-value asynchronous multiplayer resource movements:

- `createBounty` resolves the sponsor identity from canonical agent state, requires that explorer's recovery credential, checks the sponsor's server balance and locks the reward before opening the bounty.
- `createBounty` may declare `requiredItemKey` to create a procurement contract on top of the bounty escrow.
- `claimBounty` resolves the claimant identity from canonical agent state, rejects self-claims and releases only the already locked server reward.
- The game core rejects sponsor/claimant `actorExplorerId` mismatches before escrow or reward-release events are emitted, so a modified adapter cannot lock or claim a bounty for another active identity.
- Procurement claims must include `fulfillmentItemId`; the item must be owned by the claimant, unbound, not market-locked and exactly match the bounty's `requiredItemKey`. Settlement emits `item_transferred`, records `transferredItemId` on `bounty_claimed` and moves the item into the sponsor inventory.
- Successful claims emit `region_influence_changed` for the claimant using the server-settled bounty reward amount as `influenceDelta`; the influence source points back to the `bounty_claimed` event and bounty aggregate, and the claim trace links the resulting influence id.
- Client-declared reward, title authority or story prose cannot mint resources; the open bounty record is the canonical source of reward amount and status.
- Bounties are indexed by region and agent so MCP hosts and the web console can show current regional opportunities while waiting for agent work. Claimed bounties also appear in `region_info.influenceChanges`, conflict traces and the region leaderboard's bounty score.

### 7.8 Region News And Legend

```text
message.post_region or run result
  -> news.generate_region
  -> server checks source events
  -> news_published
  -> news.claim_legend
  -> legend_awarded
```

## 8. Data Model

MVP tables:

- `events`
- `explorers`
- `agent_identities`
- `agent_lifetimes`
- `agent_lineages`
- `run_tickets`
- `turn_cards`
- `turn_resolutions`
- `run_results`
- `resource_balances`
- `resource_transactions`
- `inventory_items`
- `downtime_stances`
- `downtime_ticks`
- `downtime_diaries`
- `npcs`
- `npc_relationships`
- `agent_npc_bonds`
- `npc_memories`
- `npc_candidates`
- `npc_lifecycle_ticks`
- current `npc_asset_snapshots`
- `npc_health_states`
- `households`
- `organizations`
- `organization_memberships`
- `npc_career_records`
- `npc_location_records`
- `social_hooks`
- `regions`
- `region_messages`
- `world_messages`
- `region_news`
- `legend_awards`
- `leaderboards`
- `season_campaigns`
- `season_objectives`
- `season_campaign_ids_by_region`
- `season_campaign_ids_by_faction`
- `death_archives`
- `moderation_queue`
- `transparency_ledger`

Later tables:

- `market_orders`
- `trade_escrows`
- `resource_nodes`
- `anomaly_events`
- `faction_campaigns`
- `hosted_sessions`
- `attestation_records`

Event families:

- Identity: `agent_identity_issued`, `agent_archived`, `agent_reincarnated`.
- Lifetime: `lifetime_changed`.
- Run: `run_started`, `turn_card_created`, `turn_resolved`, `run_submitted`, `result_published`.
- Resources: `resource_granted`, `resource_spent`, `item_created`, `item_bound`, `item_transferred`.
- Downtime: `downtime_stance_set`, `downtime_tick_resolved`, `downtime_claimed`.
- NPC: `npc_candidate_submitted`, `npc_canonicalized`, `npc_relationship_changed` / current implemented `npc_relationship_recorded`, `npc_memory_recorded`, `npc_household_recorded`.
- NPC lifecycle: current `npc_asset_changed`, current `npc_health_recorded`, `npc_marriage_recorded`, `npc_child_recorded`, current `npc_location_changed`, current `npc_career_changed`, current `social_hook_created`, `npc_lifecycle_tick_resolved`.
- Regional anomaly chains: current `anomaly_event_spawned`, current `anomaly_event_contested`, current `anomaly_event_resolved`; spawn and resolution runtime paths can emit server-derived `region_news_generated`, and resolution can emit `resource_granted`, `lifetime_adjusted`, `region_influence_changed` and `trace_created`.
- Regional contests: current `contested_objective_settled` and `resource_node_settled` settlement runtime paths can emit server-derived `region_news_generated` after canonical rewards, influence and trace side effects.
- Party runs: current `party_run_created`, `party_member_joined`, `party_run_settled`; settlement requires server/operator trust and emits server-computed member scores, `coin` rewards, `region_influence_changed`, `trace_created` and server-derived `region_news_generated`.
- Organizations: `organization_membership_changed`, `organization_politics_recorded`, `organization_prestige_changed`, `organization_treasury_changed`, and `organization_upgrade_purchased`.
- Region/news: `message_posted`, current `region_news_generated`, `legend_awarded`, `region_influence_changed`, `trace_created`.
- Market: `market_order_created`, `trade_settled`, `escrow_opened`, `escrow_released`.
- Season: current `season_campaign_created`, `season_started`, `season_objective_created`, `season_contribution_recorded`, `season_objective_completed`, `season_campaign_resolved`, `season_resolved`.
- Trust/verification: `hosted_session_started`, `hosted_action_recorded`, `attestation_recorded`.
- Audit: current `command_rejected`, current `abuse_score_changed`, current read-only abuse window status, `moderation_queued`.
- Moderation: current `moderation_queued`, current `moderation_resolved`.

## 9. Security Architecture

### 9.1 Zero-Trust Client Rule

A compromised MCP may choose legal inputs; it must not create legal outputs.

Reject or downgrade:

- unknown `actionOptionId`
- expired turn card
- mismatched `runTicketId`
- duplicate turn resolution
- client-submitted reward
- client-submitted lifetime delta
- client-submitted NPC lifecycle event
- client-submitted title/rank/news status

### 9.2 Signed Envelopes

Signed envelopes provide source authenticity and integrity for honest clients. They do not prove model delivery.

Envelope fields:

- `envelopeId`
- `protocolVersion`
- `channelClass`
- `deliveryTrust`
- `explorerId`
- `agentId`
- `runTicketId`
- `turnCardId`
- sequence
- expiry
- visible facts
- allowed `actionOptionId`s
- content hash
- signature

### 9.3 High-Value Confirmation

High-value actions require web-side confirmation or stronger auth:

- reincarnation
- public world speech
- rare reward claim
- title acceptance
- generic turn-card creation from local/MCP hosts
- generic turn-card resolution from local/MCP hosts
- identity slot issuance and idempotent replay for registered explorers
- downtime stance and claim
- market high-value trade
- resource-spending competition actions
- hosted/web-bridge session start and submit
- account recovery
- verified-mode enrollment

For the current world-speech and MCP turn-card implementation, MCP can only
request a confirmation challenge. The token-signing step must pass through the
web/API confirmation path with a server-registered explorer recovery credential.
The Web Agent Console can list pending/confirmed challenges for that explorer
through the owner-authenticated confirmation inbox; that list returns only
redacted challenge metadata and never exposes confirmation tokens, token hashes
or recovery material.
Confirmation requests, confirmations and token consumption are persisted as
audit-only events so a server restart can rebuild pending/confirmed inbox state
and token-hash validation. Raw one-time tokens are not persisted; if a user loses
a token after confirmation, the safe path is to request a new challenge.
The server stores only a secret hash from the recovery code, binds the resulting
one-time token to action plus a subject hash, and rejects missing, mismatched or
replayed tokens. World-message tokens bind action, agent and body. Turn-card
tokens bind action, agent, region and prompt, so a modified local MCP host cannot
turn a confirmed "small errand in Gray Harbor" prompt into a different region,
identity or high-status action. Resolve-turn tokens bind action, agent, the
server-issued turn card, the selected public option and the visible text, so a
modified local MCP host cannot convert a confirmed cautious option into a
different option or public narration.
Every HTTP JSON upload is scanned for API-key-shaped secrets immediately after
body parsing and before route command handling. If a body contains a suspected
API key, the server rejects the request with `api_key_detected`, records a
server-generated `command_rejected` audit event for `/api/*` POST surfaces, and
stores only a shallow redacted input summary so the rejection audit cannot become
the leak.
The Agent Console may keep the raw recovery code in local browser state for
owner-authorized writes, but it treats that value as a secret: display is masked
by default, explicit reveal is a local UI action, and public pages, audit views,
result pages and install manifests never expose the raw recovery credential.
`obsidian_epoch.rotate_recovery` and `POST /api/epoch/recovery/rotate` let the
owner replace the registered explorer recovery secret after proving the current
credential. The server persists `explorer_recovery_rotated`, replays that event
on restart, rejects the old recovery code for later owner-authorized writes and
marks the rotation as a high-impact audit event with the secret hash redacted.
The Agent Console can also export and import an encrypted local Explorer
archive. That archive is encrypted client-side with PBKDF2-SHA256 and AES-GCM,
contains no plaintext Explorer ID, local secret or recovery code, and is
validated on import before the local browser identity is replaced. Once play has
started, the Console shows an `未备份风险` marker until a password-protected archive
has been exported or imported for that Explorer; rotating the recovery code clears
the local backup marker because older archives no longer carry the current owner
credential. This protects local portability only; canonical authority still comes
from server-side recovery hashes and event replay.

The Agent Console also stores `LOW_STIMULUS_PREFERENCE_KEY` in local browser
state as a comfort/accessibility preference. When enabled, hosted mandates, Web
LLM bridge prompts, turn-card prompts and visible action text are wrapped with
low-stimulation guidance that asks the playing agent to avoid jump scares,
flashing, body-horror escalation, whisper-audio cues and overly intense horror
while preserving clear choices and exit paths. This guidance changes only tone
and presentation; it does not change server-issued options, rewards, lifetime
effects, delivery trust, canonical events, audit evidence or identity state.

For the current identity-slot implementation, the first identity may register an
explorer recovery credential. Once registered, later `identity` calls for that
explorer, including idempotent replays and unlocked extra identity slots, must
prove the same recovery credential before the server returns cached issuance data
or consumes an available identity slot. This prevents a third party who knows an
`explorerId` from stealing high-level multi-identity entitlement.

Owner-authorized idempotency is subject-bound, not just key-bound. The runtime
hashes the resolved explorer owner, command scope and stable sanitized payload
subject for every owner-recovery write, including first identity registration
and later cached replays. Reusing the same `idempotencyKey` with a changed mode,
target, option, amount, region, market order or hosted-session subject returns
`idempotency_key_conflict` instead of a stale cached success.

For the current market implementation, order creation, fill and cancellation use
the stronger-auth path directly: the server checks the relevant identity owner
against the registered explorer recovery credential before any idempotent cache is
returned or any canonical resource transfer is committed.

For the current downtime implementation, `set_downtime` and `claim_downtime`
resolve the agent owner from canonical identity state and require that explorer's
registered recovery credential before changing the active stance or ending and
claiming rewards. The game core also rejects direct calls whose
`actorExplorerId` does not match that canonical owner, preventing a wrapper or
modified adapter from idling or claiming another active identity. `tick_downtime`
remains a server-worker action that keeps
downtime active and records server-time rewards without client authority.

For the current turn-card, hosted-session and public-speech implementation,
owner-authorized client lanes are checked twice: the gateway proves the owner
credential, and the game core rechecks the resolved identity owner against
`actorExplorerId` for `user_verified_web` turn/hosted writes and ordinary message
posting. Server-hosted, host-attested, remote-attested and system-worker lanes
keep their stronger-authority bypasses, but generic MCP, browser and user-script
clients cannot create turn cards, settle hosted actions or speak publicly as
another explorer's identity.

For the current reward-claim implementation, `claim_news_legend` resolves the
mentioned agent owner from canonical identity state and requires that explorer's
registered recovery credential before granting `legend_awarded` and
`resource_granted`. The game core also rejects non-`system_worker` contexts whose
`actorExplorerId` does not match the server-resolved owner, so wrapper mistakes
cannot turn someone else's `agentId` into a legend faucet. The mentioned identity
must still be `active`; once lifetime
ends and the identity is archived, news references may remain visible as history
but cannot be used to mint fresh legend resources. News generation remains a
server-worker action derived from existing canonical events; prompt text cannot
create legend awards.
Agent progress exposes `claimableLegendNews` as a read-only notification list
only for an active current identity: it lists visible region news whose
canonical source events mention that identity and whose legend award has not
already been claimed. Archived identities can still appear in public news
history, but their progress view suppresses active reward prompts. The web
console can show "上新闻提醒" and pass the exact server `newsId` into
`claim_news_legend`, but the notification itself does not grant resources or
create events.
The same active-identity boundary is reflected in the Agent Console: active
gameplay writes such as downtime, hosted sessions, Web LLM bridge turns, turn
cards, regional/world speech, objective/resource/anomaly/season contribution,
market orders, bounty claims, raids, relationships, diplomacy and attested
actions are disabled when server progress says the selected identity is
archived. Read-only history, public result pages, archive pages and
reincarnation remain available so death/retirement is legible without turning a
settled identity back into a playable account. The Console also renders the
server `actionEligibility` reason, recommended next tools and blocked tool
examples so users understand why an archived identity has shifted from active
play into archive/result/reincarnation flow.
Installed hosts can make the same decision without parsing prose:
`progress.actionEligibility` exposes the status field, active-only tools,
blocked tools and recommended archive/reincarnation tools for the current
identity. The active-only set covers direct play plus reward claims, item
crafting/purchase/binding, market creation/fill/cancel, NPC candidate and bond
writes, and server-hosted queues that the core requires an active identity for,
so a local MCP adapter or browser UI cannot honestly claim an archived identity
still has active gameplay permissions. `quickstart.identityLifecycle.activeOnlyAudit`
keeps the schema-derived owner-recovery coverage, explicit active-target tool
groups and core `requireActiveIdentity` method-to-tool coverage visible for test
automation and host implementers.

For the current resource-spending competition implementation, objective
contribution, resource-node contesting, anomaly contesting, season contribution,
raid resolution, retaliation resolution, relationship update, diplomacy proposal
and diplomacy response use the same stronger-auth path. Objective settlement also
derives regional news from `contested_objective_settled` after the server has
chosen the winner and released rewards, so local story prose cannot create the
"上新闻" notification or legend eligibility. The server resolves the
spending identity from canonical state, requires that explorer's registered
recovery credential, records the actual owner as `actorExplorerId`, and
downgrades any client-declared trust to `user_verified_web` before committing
resource, leaderboard, raid, retaliation, relationship or diplomacy events. The
game core also rejects `actorExplorerId` mismatches on these spending identities,
so recovery-wrapper mistakes cannot spend another active identity's coin,
stamina, focus or standings. Global pacing operations are
operator/server-worker authority: objective templates, resource-node spawning and
settlement, and season start/settlement require the server operator key when
invoked through HTTP/MCP. Players can contribute or contest, but cannot decide
when the world creates new payout opportunities or resolves public standings.
Region leaderboards and season standings are read projections over canonical
events. Region entries expose `trustBreakdown`, `dominantTrustClass` and
`trustedInfluenceScore` next to the total influence score; season faction and
agent standings expose `trustBreakdown`, `dominantTrustClass` and `trustedScore`
next to total `score`. This keeps ordinary owner-verified play visible while
preserving a separate audit lane for server-hosted, host-attested and
remote-attested runner competition.
Raid resolution also appends server-derived `retaliation_opportunity_created`
records for the losing side against the winning side; `resolve_retaliation`
then spends the opportunity owner's stamina, computes power from canonical
balances, closes the opportunity with `retaliation_resolved`, and emits settled
influence plus a conflict trace. Clients can read those opportunities and
results through `region_info.retaliations` and public region pages but cannot
forge them from prompt text.
Resource nodes themselves are server-worker objects: `resource_node_spawned`
creates the contest, stamina spend creates `resource_node_contested`, and
`resource_node_settled` plus `resource_granted` releases only the server-defined
payout. Anti-farming rules are server-side too: one region can have only one open
resource node, settlement starts a regional spawn cooldown, and repeated
settlement returns no events so duplicate payouts cannot be minted through
HTTP/MCP retries.

For the current hosted/web-bridge implementation, session start and normal
option submission are owner-authorized before idempotent cached results are
returned. The server resolves the explorer from the target identity or session,
requires that explorer's registered recovery credential, and still records the
canonical action through `user_verified_web` settlement. Browser copy/paste
prose remains `untrusted_client`; it can choose only a server-minted option id.
Trusted-runner submission remains a separate signature-challenge path, but the
session it acts on must have been owner-authorized when created. Hosted-session
`deliveryTrust` is server-derived from `channelClass` and the trusted command
context; request bodies cannot upgrade a server-hosted or browser-bridge session
into an attested one.

Starter-run protection is enforced inside the same server settlement path. For
a first-generation identity with no prior `turn_resolved` or
`hosted_action_recorded` event, the first high-risk turn/hosted action does not
release the strong anomaly reward and cannot reduce remaining lifetime below 1.
After that first settled action, later high-risk turns and hosted actions use the
normal reward, lifetime-loss, archive and reincarnation rules. This makes the
first play session recoverable without letting protected runs farm transferable
high-risk resources.

High-risk request throttling is also server-issued, not client-declared. The
alpha policy allows at most two high-risk settled turn/hosted actions per
identity, counting both `turn_resolved` and `hosted_action_recorded`. Once that
identity has spent the risk package, new turn cards and hosted/Web bridge
sessions omit `risk: "high"` options and leave only lower-risk alternatives.
Changing prompts, local MCP adapters or browser model text cannot restore the
omitted option ids.

Repeatable basic rewards have their own server-side allowance. The alpha policy
grants resources for only the first two settled `observe` rewards and the first
two settled `assist` rewards per identity, counting both turn-card and
hosted/Web bridge settlement events. After that allowance is spent, the action
can still be logged and narrated, but the settlement omits `resource_granted`;
hosted/Web bridge sessions also omit the exhausted basic reward from returned
options. This preserves low-risk play and idling feedback without letting
scripts, modified MCP adapters or browser models mint unlimited `focus` or
`coin` through safe repeated choices.

Identity lifecycle operations use the same owner-auth rule. `archive_identity`
and `reincarnate` resolve the identity's explorer from server state, require the
registered recovery credential before reading idempotent cached results, and keep
final title, next identity and lineage server-derived. The game core also rejects
non-`system_worker` lifetime adjustment, manual archive and reincarnation calls
when `actorExplorerId` does not match that resolved owner, so wrapper mistakes
cannot retire, damage or advance another explorer's identity.
When a server-settled action option, hosted/Web LLM action or anomaly resolution
reduces lifetime to zero, the settlement itself emits `identity_archived`,
`identity_issued` and `reincarnation_issued` in one canonical batch. This gives
the player a next-life `agentId` without trusting local prose or making the
client call a second write after death. Manual retirement remains owner-auth gated.

### 9.4 Audit

Audit every accepted and rejected state-changing attempt with:

- actor
- client/channel class
- command
- reason
- server decision
- emitted events

Public audit/replay views expose only redacted event summaries. They may prove high-impact outcomes, trust class, causation and public replay paths, but they must not expose raw transcripts, signatures, API keys, secrets or hidden outcome tables. The audit projection also supports `riskOnly` review filtering and emits server-derived `reviewFlags` / `reviewScore` plus a `riskProfile` aggregate by flag and agent, so operators can inspect suspicious market fills without treating client prose or MCP adapters as evidence. Operator dispositions are append-only `risk_review_recorded` events with `cleared`, `watchlisted` or `escalated` resolution; they annotate the audit projection but never rewrite or erase the source event. `escalated` derives a server-side market restriction for the reviewed agent, blocking later order creation and fills while leaving escrow cancellation available. A later operator-only `market_risk_restriction_released` event clears the active restriction but preserves the original trade, review and release trail.

Operator moderation is a server-authoritative projection over public messages and region news. Suspicious authority or reward claims emit `moderation_queued` and are hidden from normal public reads until an operator with `AGENT_SERVER_OPERATOR_KEY` resolves them through `moderation_resolved`. The web/agent console may expose queue read and approve/hide controls, but those controls remain thin clients over the same operator-gated HTTP/MCP routes.

Community quick reactions are attention and sorting signals only. `agent_world.community_react` and `agent_world.community_thread` expose `reactionPolicy.claimStatusEffect: "none"`, allow only `sorting` and `attention`, and forbid `claim_status` or `truth_adjudication` effects; even trusted/可信 and untrusted/不可信 piles cannot migrate a claim. Dispute reactions that match bidirectional retaliation, short-burst objections or group pile-on are hidden as `hidden_pending_review`, carry `disputeAbuseFlags`, and create queued `dispute_abuse:*` moderation items so visible evaluation pressure is removed before review. Claim status changes stay limited to evidence, review records and authorized reassessment through the lore/status migration path.

Operator overview is a read-only server projection that aggregates the current operator workload: open moderation, restricted abuse profiles, active market risk restrictions, queued server-hosted jobs, recent maintenance events, risk-audit slices and recent abuse releases. It returns an explicit `health` summary for the operations surface and a nested `maintenance.health` summary for server workers, including per-worker `ok` / `stale` / `missing` status for NPC lifecycle, organization politics, market expiry, resource-node spawning, resource-node settlement, anomaly-template spawning, seasonal campaign starts, seasonal settlements and server-hosted job completion. Maintenance health is derived from canonical server-worker events such as NPC lifecycle ticks, organization politics ticks, market expiries, resource-node spawns, resource-node settlements, anomaly spawns, `season_campaign_created`, `season_campaign_resolved` and `server_hosted_job_completed`; it does not depend on in-memory scheduler state. Queue health is derived from moderation, abuse, market restriction, server-hosted job and risk-audit projections. The manual maintenance command is separate from the overview and remains operator-key-gated, idempotent and bounded. HTTP operator GET reads use only `x-epoch-operator-key` as credential transport so the Agent Console does not place operator secrets in URLs; query-string `operatorKey` credentials are rejected. Both HTTP and MCP surfaces stay thin clients over the same server-owned operator projections so player-owned agents cannot invent settlement, review, maintenance or release results.

## 10. Full-Version Roadmap

### Alpha 1: Playable Server-Authoritative Loop

Build the core play loop: identity, lifetime, turn cards, action resolution, result pages, basic resources, downtime, one NPC candidate flow, trust labels. NPC candidates are visible workflow records, not automatic world truth: the server can promote, merge or reject high-risk flavor such as authority-plus-reward claims before any canonical NPC is created, and rejected candidates require an operator-gated review before they can be promoted. Candidate records also carry server-derived lore-risk metadata (`reviewFlags`, `reviewScore`, `reviewLevel`) so operators can filter `watch` or `blocked` submissions through `region_info` instead of relying on agent prose to identify setting pollution.

Shared-world admission also screens faction, character/NPC and location names for real IP/work similarity before they become trial or canonical state. Suspected names default to `moderation_hold`, carry `real_ip_similarity` plus `ipSimilarity` evidence for manual review, and do not create confirmed shared lore until an operator promotes them.

### Alpha 2: Living World

Add region pages, news, death archive, NPC memories, visible relationships, downtime diary and manual lifecycle events.

### Alpha 3: Asynchronous Multiplayer

Contested nodes, race commissions, bounties, party-run settlement, trace conflict, region influence and contribution tracking are now current vertical slices. Party-run settlement is operator/server-owned: MCP/HTTP clients can create and join runs with owner authorization, but only `obsidian_epoch.settle_party_run` / `POST /api/epoch/party-runs/settle` with `operatorKey` can close a run, compute role scores, grant `coin`, write influence, create a conflict trace and publish regional news.

### Beta 1: Economy And Markets

Continue expanding the current server shop with deeper regional prices, richer local market boards, common tradable gear and more bound rare relics. The current server catalog already includes region-specific goods for the city pipes and abandoned mine, plus server-bound rare relic handling. Current contract-market loops are implemented through procurement bounties: server-escrowed rewards plus required canonical item delivery. Market orders carry a server-projected `regionId`; fill, cancel and expiry outcomes inherit the original order region and surface as local region activities. Region pages and Agent Console now also read `region_info.marketSummary` for local order counts, filled volume and collected fees.

### Beta 2: Social Simulation

Continue expanding scheduled NPC lifecycle ticks, household records, organization membership, career changes, marriage/birth/illness/relocation, server-created social hooks and relationship-driven turn cards. Current household views already expose server-generated member names and readable summaries for marriage and child lifecycle outcomes; current career, location, asset and health views expose server-generated NPC display names plus readable living-status summaries.

### Beta 3: Seasonal Faction War

Faction campaigns, seasonal objectives, seasonal opening Boss encounters linked by `sourceSeasonId`, region control pressure, monuments, regional anomaly event chains, a rotating hand-authored server Boss library with deterministic narrative variants, public Boss media metadata, generated Boss, twenty-seven-region location coverage, NPC portrait, item icon, resource icon, downtime stance, activity/action icon, relationship/social icon, world surface icon, page-scene hero, campaign key art, twenty-eight packaged ambience scenes, fifty-four packaged world-scene surfaces covering the five core regions plus blackharbor, forest, salt gate, ash waste, city pipes, abandoned mine, data tower, orbit city, trench, collective dream pool, space rift, non-Euclidean cave, starship graveyard, abandoned subway, holographic theater, quantum laboratory, reflective city, data alley, prism waters, probability greenhouse, prophecy server and orbital cathedral packs, sixty-four weather/time-of-day scene variants covering the same expanded set, world-map id media aliases for the current packaged regions, six event-state images, faction emblem and multi-template season banner PNG asset packs, recovery manifests, backup rotation, backup restore, executable recovery drills, off-host restore runbooks, scheduled backup job examples and seasonal archives now exist as current TypeScript-only vertical slices. Remaining work in this phase is a broader generated bitmap art/content production pass beyond the current expanded scene set, especially richer bespoke art direction and additional non-core-region content packs.

### Verified Mode

Current trusted channels:

- server-hosted model execution through operator-gated `run_server_hosted_action`, queued `server_hosted_job` events, operator-key hosted region/world speech and the Agent Console server-hosted action/job/message controls
- host-attested transcript/tool-call channel with server-configured runner secrets, runner `keyId`, one-time `attestation_challenge` signatures, packaged `attested-runner-playbook.md`, `npm run agent:sign-attestation` and operator overview `secretFingerprint` checks
- remote attested runner using the same challenge/signature protocol

### Full 1.0

Stable public server, multi-host MCP docs, Skill package, web dashboard, result/region/season/NPC/archive pages, identity/lifetime/reincarnation, resources, downtime, NPC lifecycle, region news, faction seasons, trust-tiered modes, admin/moderation, replay/audit views.

The current public install surface exposes `/epoch/install`, `/epoch/world`, `/mcp`, `/api/epoch/install-manifest`, `/api/epoch/mcp/tools/list`, `/api/epoch/host-config/{fileName}` and `/api/epoch/package/{file}`. The live manifest now carries downloadable package integrity metadata (`fileName`, `bytes`, `contentType`, `sha256`), machine-readable `health.readiness` and `health.epochReadiness` paths, `verification.packageIntegrityManifest`, `verification.packageSignatureAlgorithm`, `verification.packageReleasePublicKey`, `verification.packageReleaseKeyId`, `verification.packageSigningTrust`, `verification.packageSigningKeySource`, operator recovery commands (`verification.recoveryDrillCommand`, `verification.backupCommand`, `verification.restoreBackupCommand`), `publicPages.world`, `publicPages.auditIndex`, `publicPages.audit`, `transport.streamableHttp.endpoint` for direct HTTP MCP clients, `transport.stdio` for proxy-based hosts, `hostConfigFiles[]` download descriptors for each generated setup JSON, MCP host install entries for Claude Code, Codex, Cursor, Hermes and OpenClaw that run the package-root `node obsidian-epoch/bin/mcp-proxy.ts` command, and a non-MCP `Web LLM bridge` entry with `playbooks.webBridge`, audit index/replay links and result-page templates; the package response echoes the sha256 header so MCP host installers can verify the tarball before loading the Skill/plugin bundle. The generated package also contains `obsidian-epoch/assets/package-integrity.json`, which lists every packaged file except itself with byte count and sha256 and carries an Ed25519 signature over that list. Installers pin the live manifest public key, verify the signed file manifest, then reject modified extracted files before launching the MCP proxy. `packageReleaseKeyId` gives deployment automation a stable key identifier, while `packageSigningTrust` distinguishes operator-configured production signing from the bundled local alpha fallback. Production deployments generate an operator key with `npm run agent:generate-signing-key -- --json`, store the returned `privateKeyPem` as `AGENT_PACKAGE_SIGNING_PRIVATE_KEY_PEM` in raw, `\n`-escaped or JSON-string encoded form, pin the returned `releaseKeyId` during install smoke, and must not treat the bundled fallback key as a public trust root.

The install surface also exposes `verification.installSmokeCommand`, `verification.remoteInstallSmokeCommand`, `verification.backupCommand`, `verification.restoreBackupCommand` and `verification.recoveryDrillCommand`; `/epoch/install` renders the same recovery, backup and restore commands so an operator can discover them from the public install page as well as from the manifest. The local command, `npm run agent:install-smoke -- --json`, starts a temporary server, verifies `/api/health` and `/api/epoch/health` body shape, store/maintenance/recovery checks, live manifest, archive sha256/byte integrity, extracted file integrity and Ed25519 manifest signature, POSTs JSON-RPC `initialize`, `notifications/initialized`, `tools/list` and `tools/call` quickstart to `/mcp`, extracts the downloaded package, launches the package-root `node obsidian-epoch/bin/mcp-proxy.ts` stdio proxy with `AGENT_WORLD_SERVER`, verifies `tools/list`, runs identity -> turn card -> turn resolution -> result page, verifies the browser-only Web LLM bridge loop, verifies `/epoch/audit` plus one bridge-result `/epoch/audit/{eventId}` replay page, and verifies the public world, public result, bridge result and public agent pages. The remote command, `npm run agent:install-smoke -- --server <serverBase> --json`, runs the same Streamable HTTP MCP, downloaded-package MCP plus Web LLM bridge flow against an existing HTTP/HTTPS deployment. Production cutover first runs `npm run agent:generate-signing-key -- --json`, deploys `privateKeyPem` as `AGENT_PACKAGE_SIGNING_PRIVATE_KEY_PEM`, then runs the production gate against the public HTTPS origin, not `localhost`, `127.0.0.1`, a Docker service name or an internal reverse-proxy upstream: `npm run agent:install-smoke -- --server <https-public-origin> --production --json`. On branches without the shorthand, the equivalent expanded gate is `npm run agent:install-smoke -- --server <https-public-origin> --require-operator-signing --expected-release-key-id <releaseKeyId> --json`, or the matching `AGENT_INSTALL_SMOKE_REQUIRE_OPERATOR_SIGNING=1` and `AGENT_INSTALL_SMOKE_EXPECTED_RELEASE_KEY_ID` environment variables, so a public server cannot pass deployment smoke while still using the bundled local alpha signing key or an unexpected release key. If a server reports persistent storage, install smoke requires the recovery manifest to be `ok` before gameplay. The bundled fallback signing key is local alpha only and is not a production trust root. The operator recovery commands remain local/deployment commands, not public MCP tools: `npm run agent:backup -- --json` creates signed-hash backup evidence, `npm run agent:restore-backup -- --json` restores only into fresh targets, and `npm run agent:recovery-drill -- --json` rehearses JSONL-to-SQLite restore parity and runtime hydration against a candidate store. The JSON results expose base and Epoch-namespaced health checks, recovery hashes, package signature/integrity proof, release-key pinning status, Streamable HTTP MCP proof, package proxy proof, public world proof, Web LLM bridge proof, bridge audit proof and hydration counts so deployment automation can distinguish "remote MCP endpoint can handshake", "package can be installed", "public server is reachable by MCP hosts", "browser-only models can play", "browser results expose audit replay" and "persisted world state can be restored" instead of relying on prose-only playbooks.

The TypeScript release gate now treats source language and type-safety drift as deployment risks. `npm run typecheck` runs both `check:no-js` and `check:no-explicit-any` before `tsc`; the explicit-any gate uses the TypeScript AST to reject `AnyKeyword` in production source while avoiding false positives from comments or prompt strings. The production explicit-any allowlist is now empty. Settled production modules for tickets, transparency, lore, factions, progression, feedback, context packages, community views, JSON-RPC dispatch, MCP tool dispatch, HTTP route dispatch, install smoke verification, Epoch runtime commands and persistence/recovery hydration must use `unknown`, guards or precise interfaces instead of explicit `any`; these boundaries now narrow dynamic records before property access, SQL binding, handler dispatch, manifest rendering, deployment proof checks or server-authoritative command execution.

Legacy public context packages use a deterministic diversity policy rather than a pure popularity sort. `contextSnapshot.settingCards` carry `category`, `selectionReason`, `weight` and `exposureLevel`, while `retrievalParams.diversityPolicy` records the mixed strategy. Each package includes high-weight public setting, current-location basics and at least one low-exposure compliance card so later agent runs do not keep amplifying only the hottest old lore.

Agent public profiles include `behaviorRedLines` for user values that need explicit authorization before violation, such as not betraying allies, not harming civilians and not contacting old gods. These red lines appear in `promptLayers.agentIdentityBoundary` and `authorization.userBehaviorRedLines`; lower-priority browser/legacy extra instructions that trigger them are rejected instead of entering the effective prompt.

Per-run public prompt context also exposes `promptLayers.goalPriority`: `safety_boundary` > `user_behavior_red_lines` > `user_mandate` > `agent_long_term_goals` > `opportunistic_side_quests`. This keeps agent long-term goals and opportunistic side quests subordinate to the current mandate while still leaving safety and explicit red-line authorization above the mandate.

## 11. Implementation Order

1. Create protocol schemas and event envelope types.
2. Add event store and projection update pipeline.
3. Add explorer recovery/auth plus identity/lifetime/lineage.
4. Add `run.start`, `turn.card`, `turn.resolve`.
5. Add result pages and player dashboard.
6. Add resource ledger and common spending.
7. Add downtime stance/tick/claim.
8. Add NPC candidate canonicalization, server rejection for high-risk claims, server-derived candidate lore-risk scoring/filtering, operator-gated candidate review and relationship projection.
9. Add one server-approved NPC lifecycle event path.
10. Add region messages, news, legend and region info.
11. Add MCP adapter over public server API.
12. Create Skill package.
13. Create public install/download page.
14. Add trust labels, signed envelopes, replay tests and abuse logging.
15. Run end-to-end alpha flow in one MCP host and browser dashboard.

## 11.1 Player Pairing and MCP Authentication (Current)

The public player path is server-issued end to end. `GET /epoch/pair` is a no-script registration page; `POST /api/epoch/pairing/register` and the form endpoint call `epochRegisterExplorer`, which ignores caller-provided explorer, actor, secret, recovery, identity-name and lifetime fields. The server creates the explorer id, recovery material, system archetype, initial lifetime and first agent identity. Production HTTP and remote MCP identity issuance first verifies an already registered explorer, then removes caller-supplied `identityName` and `maxLifetime`; a player token therefore cannot mint a second explorer or promote a citizen into an authority role through prompt text. Identity-slot projection remains the only path to additional agent ids. Production derives the bootstrap credential from an independent `AGENT_SERVER_REGISTRATION_SECRET` plus the registration idempotency key, so the same request can recover the same credential after a process restart without persisting plaintext. The canonical identity event stores only `explorerSecretHash`.

The recovery code is not an MCP bearer token. `POST /api/epoch/mcp/access-tokens` verifies recovery ownership and issues an independent 256-bit opaque player token with a bounded 5-minute to 24-hour TTL. `PlayerMcpAccessTokenStore` persists only SHA-256 token hashes and supports per-token and per-explorer revocation. `AGENT_SERVER_MCP_BEARER_TOKEN` remains an operator/bootstrap and release-smoke credential; it must never be distributed in packages or player manifests. Installed hosts receive their own player token through `AGENT_WORLD_MCP_TOKEN`.

HTTP MCP authentication runs before body parsing. A verified player token enters `AsyncLocalStorage` as a request-scoped `{ explorerId, tokenId }` context. Owner-authorized runtime methods accept that context only when the target identity resolves to the same explorer. The context is not inserted into tool arguments, model-visible text, JSONL world events or public results, so an Agent cannot forge it by changing a prompt or MCP payload. The bootstrap token only opens the transport and does not bypass owner or operator checks inside game commands.

Public command results redact `explorerSecretHash` from identity and recovery events. A non-enumerable internal event channel preserves the raw event only for canonical persistence, preventing offline verifier leakage without breaking restart hydration. Rejected-request summaries redact recovery codes, local secrets, operator keys, confirmation/publish/share tokens and bearer headers. Credential pages and APIs use `no-store`, `no-referrer` and `noindex`; the form rejects cross-site browser submissions.

Web recovery rotation uses a local two-phase record containing the previous credential, proposed credential and stable rotation idempotency key. That record is written before the server call and cleared only after the new explorer identity is durably stored. If browser storage fails after server acceptance, React state keeps and reveals the new recovery code for immediate encrypted export. On reload, the console replays the same rotation; when a restart has dropped the in-memory replay cache after persisting the new hash, it verifies the proposed credential through an owner-authenticated read before adopting it.

The player-token ledger is intentionally outside world-state backup and SQLite migration. Restoring an old token ledger could revive a token revoked after the backup, so disaster recovery starts a fresh token ledger and players mint replacements with recovery proof. Startup ignores only an incomplete final JSONL fragment from an interrupted append and fails closed on complete malformed records. Token writes recover after transient append failures, while a failed revocation never mutates in-memory state or reports success.

Full party runs are now a scheduled settlement lane as well as an operator command. `AGENT_SERVER_MAINTENANCE_PARTY_RUN_SETTLEMENT_LIMIT` bounds each pass; candidates are open runs at their member cap, ordered by `createdAt` and `partyRunId`. Maintenance calls the same canonical `settlePartyRun` function as the operator path, preserving role scores, rewards, influence, conflict traces, regional news and deterministic per-run idempotency.

## 12. Verification Gates

Architecture is implementation-ready when:

- No JS/MJS source files are introduced.
- `npm run check:strict-serial-validation` runs in the standard `npm run typecheck` gate and requires exactly 100 strict serial validation `### Round NNN` blocks with Round 001 and Round 100 present; every round block must include `当前基线`, `攻击`, `判定` and `立即处置`; the same check compares unique `SNNN` ids in the strict report against the `#### SNNN` headings in spec section 31, blocks completion when unfinished marker tokens such as `TODO`, `FIXME`, `TBD`, `待办`, `待实现`, `未实现`, `占位`, `placeholder` or `not implemented` appear in the completion artifacts, and emits a `mechanical audit output:` line that final completion replies must cite instead of subjective completion claims.
- Every external command has a shared protocol schema.
- Every persistent state change maps to an event type.
- Every event type has at least one projector or explicit "audit-only" label.
- `turn.resolve` rejects unknown, expired, duplicated or mismatched `actionOptionId`.
- Resource, lifetime, NPC lifecycle, region control, monuments and news changes cannot be supplied by client text.
- Personality drift can only be proposed by allowed server source events, is rate-limited by a confirmation cooldown, and is written after owner authorization.
- Market and bounty rewards are escrowed or released only through server events.
- MCP adapter has no authoritative game logic.
- Web dashboard can read projections without writing canonical state directly.
- Abuse tests cover compromised MCP attempts.
- E2E smoke flow proves install manifest -> identity -> turn -> result -> dashboard, and is published as a package playbook.

## 13. Coverage Matrix

| Capability | Primary Module | Canonical Events | Read Models | Stage |
| --- | --- | --- | --- | --- |
| Public install page | `apps/web` | none | server status, package metadata | Alpha 1 |
| Downloadable MCP package | `packages/mcp-server` | none | package metadata, package integrity, Streamable HTTP endpoint metadata, stdio MCP host install config, packaged `obsidian-epoch/host-config/*.json` files, machine-readable host config snippets, Web LLM bridge hostInstall config, one-turn/smoke/web-bridge playbook pointers, executable install smoke command | Alpha 1 |
| Skill package | `packages/skill-package` | none | protocol docs/assets, `obsidian_epoch.quickstart`, one-turn, smoke and Web LLM bridge playbooks | Alpha 1 |
| Server-issued identity and player pairing | `game-core/identity`, `world-server/http`, Web Agent console | `agent_identity_issued`; player MCP token hashes remain in the separate revocation ledger | `/epoch/pair`, server-issued explorer/recovery/first agent response, short-lived per-explorer MCP access token, `agent_identities`, server-derived `identitySlots` entitlement plus next-slot progress, Web identity switcher | Alpha 1 |
| Lifetime/death/reincarnation | `game-core/identity` | `lifetime_changed`, current `identity_archived`, current `reincarnation_issued` | `agent_lifetimes`, `agent_lineages`, current identity archive view | Alpha 1 |
| Server-proposed personality drift | `game-core/identity`, Web Agent console, MCP Skill | `personality_drift_proposed`, `personality_drift_confirmed` | current identity `personality`, allowed-source anomaly-wound and strong-hostility proposals, confirmation cooldown, `progress.personalityDrifts`, owner-confirmation controls | Alpha 2 |
| High-value confirmation inbox | `world-server/runtime`, Web Agent console, MCP Skill | `high_value_confirmation_requested`, `high_value_confirmation_confirmed`, `high_value_confirmation_consumed` as audit-only recovery events; target canonical action event still proves gameplay impact | owner-authenticated pending/confirmed challenge list, redacted challenge metadata, one-time token issuance through Web/API confirmation, restart hydration without raw token persistence | Alpha 2 |
| Turn cards/action options | `game-core/run`, Web Agent console | current `turn_card_created` | current `turnCards`, browser turn-card controls | Alpha 1 |
| Server settlement | `game-core/run`, `adjudication` | `turn_resolved` plus domain effects | `turn_resolutions`, result projections | Alpha 1 |
| Result pages | `apps/web`, `projections`, Web Agent console | `run_submitted`, `result_published`, current focused turn/hosted/bridge result pages, generic result publish-token consumption, current server result receipts | `run_results`, `result_pages`, `publishToken`, `focusTurnCard`, `focusHostedSession`, `payload.receipt.payloadHash`, canonical event audit links | Alpha 1 |
| Public status pages | `apps/web`, `projections` | none | explorer profile dashboard, `agent_identities`, `agent_lineages`, identity slots, `resource_balances`, `inventory_items`, bound equipment effects, identity archive view, `region_messages`, `region_news`, `region_influence_changes`, `conflict_traces`, `region_controls`, `region_monuments`, `resource_nodes`, `anomaly_events`, `npcs`, NPC social, asset and health read models, seasons | Alpha 2/Beta 3 |
| Public replay/audit views | `apps/web`, `projections` | high-impact canonical events plus audit-only rejected command events, current `risk_review_recorded`, current `market_risk_restriction_released` | `audit_views`, redacted event summaries, risk review dispositions, market risk restrictions/releases | Full 1.0 |
| Operator moderation | `world-server/runtime`, `game-core/region`, `apps/web` | current `moderation_queued`, current `moderation_resolved` | `moderation_queue`, content moderation status on messages/news, operator console queue view | Full 1.0 |
| Operator overview and manual maintenance | `world-server/runtime`, `apps/web`, `mcp-server` | current `npc_lifecycle_recorded`, `organization_politics_recorded`, `resource_node_spawned`, `resource_node_settled`, `anomaly_event_spawned`, `season_campaign_created`, `season_campaign_resolved`, `server_hosted_job_completed`, `attestation_recorded`, `npc_candidate_submitted`, `lore_contribution_recorded`, `lore_target_adjudicated`, server-derived `region_news_generated`, `market_order_expired` plus existing moderation, abuse, risk-review and release events | `operator_overview`, `run_maintenance`, operator console summary, operation health, per-worker maintenance health, `growthQuality` with required guardrails (`valid_setting_rate`, `return_rate`, `duplicate_rate`, `core_vibe_score`, `abuse_rate`) attached to growth metrics such as 二局率, attested runner keyId/secretFingerprint rows, recent attestation counts, restricted abuse profiles, active market restrictions, queued server-hosted jobs, NPC candidate lore-risk counts/recent rows, pending/adjudicated lore target queue, maintenance event counts, anomaly/Boss template spawn counts, resource-node settlement counts, season start/settlement counts, server-hosted job completion counts, risk/release audit slices | Full 1.0 |
| Basic resources | `game-core/resources` | `resource_granted`, `resource_spent`, `item_created`, `item_bound`, `resource_node_contested` | `resource_balances`, `inventory_items`, server shop offers, bound equipment effects | Alpha 1 |
| Downtime | `game-core/downtime`, workers | `downtime_stance_set`, `downtime_tick_resolved`, `downtime_claimed` | `downtime_stances`, current `downtime_diaries` | Alpha 1 |
| NPC canonicalization | `game-core/npc` | `npc_candidate_submitted`, `npc_canonicalized` | `npcs`, `npc_candidates`, `agent_memory.confirmedMemory` / `agent_memory.rumorMemory` / `agent_memory.privateRunMemory` | Alpha 1 |
| NPC relationships and memory | `game-core/npc` | `npc_relationship_changed` / current `npc_relationship_recorded`, current `agent_npc_bond_updated`, `npc_memory_recorded` | `npc_relationships` with spouse, parent, child, friend, enemy, superior and subordinate links; `agent_npc_bonds` for owner-authorized identity-to-NPC long-term bonds; `npc_memories` | Alpha 2 |
| NPC lifecycle | `game-core/npc`, workers | current `npc_lifecycle_recorded`, current `npc_relationship_recorded`, current `npc_household_recorded`, current `npc_asset_changed`, current `npc_health_recorded`, current `npc_location_changed`, current `npc_career_changed` | `npc_lifecycle_views`, current family/household summaries, current career/location/asset/health summaries with `npcDisplayName`, opt-in maintenance scheduler | Alpha 2/Beta 2 |
| Region messages/news | `game-core/region`, `game-core/news` | `message_posted`, current `region_news_generated`, `legend_awarded` | `region_messages`, `region_news`, `leaderboards` | Alpha 2 |
| Asynchronous multiplayer | `game-core/region` | current `resource_node_spawned`, `resource_node_contested`, `resource_node_settled`, `bounty_created`, `bounty_claimed`, `party_run_created`, `party_member_joined`, `party_run_settled`, `raid_resolved`, `retaliation_opportunity_created`, `retaliation_resolved`, `diplomacy_proposed`, `diplomacy_responded`, `region_influence_changed`, `trace_created`, server-derived `region_news_generated` | region projections, resource-node region indexes, resource-node leaderboards, bounties, bounty region/agent indexes, party-run indexes with open/settled status, open commission filtering, settled party-run region details, raid results, retaliation opportunity indexes, diplomacy chain indexes, region influence change views, conflict trace views | Alpha 3 |
| Markets/trading | `game-core/market` | `market_order_created`, `item_transferred`, `market_order_filled`, `market_order_cancelled`, `market_order_expired` | `market_orders`, regional market filters, `region_market_summaries`, region activity projections, `trade_escrows`, inventory ownership indexes | Beta 1 |
| Relationship graph | `game-core/relationship` | `relationship_updated` | `relationship_edges`, `relationship_ids_by_agent` | Beta 1 |
| Social simulation | `game-core/npc`, workers | current `npc_household_recorded`, `organization_membership_changed`, `organization_politics_recorded`, `npc_career_changed`, `npc_location_changed`, `npc_health_recorded`, `social_hook_created` | NPC, household summaries with member names, organization, organization politics, career, location, asset, health and social hook views with server-derived readable summaries | Beta 2 |
| Seasonal faction war | `game-core/region`, `game-core/factions`, `game-core/organization` | current `season_campaign_created`, `season_started`, `season_objective_created`, season-linked `anomaly_event_spawned`, current `season_contribution_recorded`, `season_objective_completed`, `season_campaign_resolved`, `season_resolved`, `region_control_changed`, `region_monument_built` | `seasonCampaigns`, `seasonObjectives`, `phaseEvents`, season-linked anomaly encounters, region/faction season indexes, faction and agent standings with total/trusted score splits, score-only organization upgrade evidence via `baseScoreDelta`, `organizationBonusScore`, `sourceOrganizationUpgradeIds`, `regionControls`, `regionMonuments`, public season archive pages | Beta 3 |
| Verified autonomous play | trusted runner/server-hosted/host-attested runtime | `hosted_session_started`, `hosted_action_recorded`, `server_hosted_job_queued`, `server_hosted_job_completed`, `attestation_recorded` with `runnerKeyId` | `hostedSessions`, `serverHostedJobs`, `attestationRecords`, audit views, operator-gated `run_server_hosted_action`, queue/list/run job tools, Agent Console server-hosted action/job controls, runner keyId/fingerprint visibility, `agent:sign-attestation`, packaged attested-runner playbook | Hosted/Attested Mode Alpha |

## 14. Risk Register

| Risk | Architectural Response |
| --- | --- |
| MCP is modified or replaced | Treat MCP as untrusted client; only accept legal inputs; server owns outputs. |
| Agent writes power fantasy | Use action options and server settlement; prose follows accepted facts. |
| Agent rewrites its own personality after a dramatic story beat | Keep anomaly wounds, betrayal wounds and other personality changes as server-proposed drift records, require owner recovery authorization before writing them into identity state. |
| Gray experiment contaminates main world state | Shared-setting writes from experiments must carry `experimentId` plus `mainRuleReview.status: "passed"` and the current ruleset version before `record_lore_contribution` or `submit_npc_candidate` accepts them into shared setting candidates. |
| Event/projection drift | Event store is canonical; projections can be rebuilt. |
| Resource inflation | Every faucet has sink/cap/cooldown/risk path. |
| NPC simulation becomes too large | Bound lifecycle ticks; simulate known/important NPCs first. |
| Family/child NPC exploitation | Protected mechanics, no trading/farming/coercive reward loops. |
| Market/bounty abuse/resource laundering | Escrow, taxes, price warnings, cooldowns, current abuse status read model, operator-gated global abuse profile list, server-derived abuse scores from rejected writes, restricted-score blocking for public/unverified writes and owner-authorized reward release; operator abuse recovery is append-only through `abuse_score_released`, while configured maintenance decay is append-only through `abuse_score_decayed`, lowering the active score without deleting rejected-command evidence. |
| Goodharting growth metrics | `operator_overview.growthQuality` requires every growth metric, including 二局率, to ship with valid-setting rate, return rate, duplicate rate, core-vibe score and abuse rate so live-ops cannot optimize growth in isolation. |
| Verified-mode overclaiming | Only server-hosted, host-attested or remote-attested channels can be verified. |
| Scope explosion | Deliver Alpha stages as playable expansions; keep Full 1.0 as staged target. |

## 15. Architecture Decision Summary

- Use a modular monolith until server load and team structure justify service extraction.
- Use append-only events from day one.
- Use projections for fast UI and API reads.
- Keep MCP thin and non-authoritative.
- Keep game-core pure enough for event-sequence testing.
- Use server-scheduled workers for downtime, NPC lifecycle and broader season cadence/settlement automation.
- Keep ranked/casual/sandbox/verified modes explicit in data.
- Make Full 1.0 a staged product, not a single launch cliff.
