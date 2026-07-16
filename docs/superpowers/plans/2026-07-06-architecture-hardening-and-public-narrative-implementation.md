# Architecture Hardening And Public Narrative Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the architecture hardening spec into testable code changes that keep player-facing pages readable, make "one game" a full run-level journey, and stop new result/identity work from growing the largest files.

**Architecture:** Add a server-side public vocabulary and result ViewModel/presenter before changing HTML. Use tests to lock visible text boundaries first, then move result rendering and result routes behind smaller modules while preserving current HTTP behavior.

**Tech Stack:** TypeScript, Node HTTP server, React 19, Vite, Node test runner, existing JSONL/SQLite persistence surfaces.

---

## Execution Status 2026-07-06

Completed in this pass:

- Public result visible-text leak guard in `tools/agent-server/test/server.test.ts`.
- Server public vocabulary in `tools/agent-server/lib/epoch/publicVocabulary.ts`.
- Public result ViewModel in `tools/agent-server/lib/epoch/publicResultViewModel.ts`.
- Run-level result summary in `tools/agent-server/lib/epoch/resultRunSummary.ts`.
- Shared game run read model in `tools/agent-server/lib/epoch/gameRunReadModel.ts`.
- Result page read model in `tools/agent-server/lib/epoch/resultPageReadModel.ts`.
- Agent memory read model extraction in `tools/agent-server/lib/epoch/agentMemoryReadModel.ts`.
- NPC candidate read model helper extraction in `tools/agent-server/lib/epoch/npcCandidateReadModel.ts`.
- Personal migration read model extraction in `tools/agent-server/lib/epoch/personalMigrationReadModel.ts`.
- Explorer profile read model extraction in `tools/agent-server/lib/epoch/explorerProfileReadModel.ts`.
- Audit and risk review read model extraction in `tools/agent-server/lib/epoch/auditReadModel.ts`.
- Action eligibility read model extraction in `tools/agent-server/lib/epoch/actionEligibilityReadModel.ts`.
- Maintenance read model extraction in `tools/agent-server/lib/epoch/maintenanceReadModel.ts`.
- Market read model extraction in `tools/agent-server/lib/epoch/marketReadModel.ts`.
- Region leaderboard read model extraction in `tools/agent-server/lib/epoch/regionLeaderboardReadModel.ts`.
- Region activity read model extraction in `tools/agent-server/lib/epoch/regionActivityReadModel.ts`.
- Region conflict read model extraction in `tools/agent-server/lib/epoch/regionConflictReadModel.ts`.
- Operator overview read model extraction in `tools/agent-server/lib/epoch/operatorOverviewReadModel.ts`.
- Progress read model extraction in `tools/agent-server/lib/epoch/progressReadModel.ts`.
- Game-core identity issue, recovery rotation, lifetime adjustment, archive, reincarnation, personality drift proposal/confirmation payload planning plus event sequence/result projection, personality drift source-event eligibility, open proposal folding, cooldown folding, and suggested trait selection extraction in `tools/agent-server/lib/epoch/identityLifecycleRules.ts`.
- Game-core identity projection read and slot projection extraction in `tools/agent-server/lib/epoch/identityProjectionRules.ts`, moving identity lookup/active identity/slot guard, explorer lineage, legend total, and active-slot calculation while preserving `gameCore.ts` compatibility exports.
- Game-core identity authorization guard extraction in `tools/agent-server/lib/epoch/identityAuthorizationRules.ts`, moving direct owner, user-verified owner, client-owner bypass, and system-worker owner-bypass checks out of `gameCore.ts` while preserving caller error codes.
- Game-core season contribution trust breakdown normalization, dominant trust class selection, trusted score delta, region-control contribution bonus lookup, and agent region standing lookup extraction in `tools/agent-server/lib/epoch/seasonCampaignRules.ts`.
- Game-core moderation item projection reads, region news generation event sequence/result projection, message posted event sequence/result projection, communication moderation, text normalization/assessment, content status update helpers, moderation resolved event sequence/result projection, risk review recorded event sequence/result projection, auto risk-review escalation planning, market risk release event sequence/result projection, abuse release/decay payload planning, abuse release/decay event sequence/result projection, and abuse decay target selection/limit/amount/min-score extraction in `tools/agent-server/lib/epoch/moderationRiskRules.ts`.
- Game-core downtime region normalization, reward calculation, reward grant payload planning, set/claim/tick payload planning, set/claim/tick event sequence/result projection, diary payload, diary projection, tick target selection/limit, preview, and risk-warning rule extraction in `tools/agent-server/lib/epoch/downtimeRules.ts`.
- Game-core inventory item projection reads, recipe, shop offer, item rarity normalization, regional price resolution, catalog lookup, equipment bonus rule, inventory item create/craft/shop/bind event sequence/result projection, and item created/bound payload planning extraction in `tools/agent-server/lib/epoch/inventoryRules.ts`.
- Game-core resource balance copy, balance read, sufficient-balance check, grant/spend payload, grant/spend event sequence/result projection, and multi-cost spend payload planning extraction in `tools/agent-server/lib/epoch/resourceRules.ts`.
- Game-core region news projection reads, legend award payload, legend resource grant payload, legend ledger amount/reason, and legend claim event sequence/result projection extraction in `tools/agent-server/lib/epoch/legendAwardRules.ts`, moving region-news legend claim reads and event planning out of `gameCore.ts`.
- Game-core organization rule extraction in `tools/agent-server/lib/epoch/organizationTreasuryRules.ts`, moving organization creation/member change event sequence planning, organization treasury contribution event sequence planning, organization budget proposal/resolution event sequence planning, organization upgrade purchase event sequence planning, organization creation payload, agent membership payload, upgrade catalog, treasury balance, membership role/status, active agent/explorer membership lookup, season upgrade lookup, governance role, member treasury contribution spend payload, treasury contribution payload, upgrade treasury spend payload, upgrade purchased payload, budget threshold, budget resolution, budget proposal/vote/resolution payload planning, treasury spend payload planning, organization politics tick target selection/limit/region filtering, participant/career/source-evidence planning, organization politics template/kind/payload planning, organization politics tick event sequence planning/result projection, and multisig pending rules out of `gameCore.ts`.
- Game-core party run and retaliation opportunity projection reads, party lifecycle validation, invite token, created/invite/member/request/resolution event sequence/result projection and payload planning, party role score, party synergy, party member settlement result, party total-score/reward grant planning, party influence/news bonus, party run settlement event sequence and settled/influence/trace/news payload planning, raid cooldown/decay window, raid pair history lookup, raid heat threshold/scoring/projection lookup, raid/retaliation battle settlement, raid season power bonus, raid/retaliation resolution event sequence/result projection, raid/retaliation stamina spend and reward grant payload planning, raid/retaliation influence/trace payload planning, and raid/retaliation payload planning extraction in `tools/agent-server/lib/epoch/combatSettlementRules.ts`.
- Game-core event envelope factory extraction in `tools/agent-server/lib/epoch/eventFactory.ts`.
- Game-core region activity type and projection write helper extraction in `tools/agent-server/lib/epoch/regionActivityRules.ts`.
- Common game-core resource ledger event wrapping extraction in `tools/agent-server/lib/epoch/resourceLedgerEvents.ts` for all `resource_spent` / `resource_granted` event creation sites.
- Common game-core region event wrapping extraction in `tools/agent-server/lib/epoch/regionEventLedgerEvents.ts` for all `region_influence_changed` / `trace_created` event creation sites.
- Common game-core region projection read helper extraction in `tools/agent-server/lib/epoch/regionProjectionRules.ts`, moving region influence score and latest trace lookup out of `gameCore.ts`.
- Common game-core inventory item event wrapping extraction in `tools/agent-server/lib/epoch/inventoryItemLedgerEvents.ts` for all `item_created` / `item_bound` / `item_transferred` event creation sites.
- Game-core turn and hosted action signed envelope rule extraction in `tools/agent-server/lib/epoch/turnActionEnvelopeRules.ts`, moving protocol versions, stable content hash construction, and release signature envelope construction out of `gameCore.ts`.
- Game-core turn and hosted action policy extraction in `tools/agent-server/lib/epoch/turnHostedActionRules.ts`, moving hosted/turn trust guards, turn option templates, hosted option assembly, high-risk caps, first-run protection, repeatable basic reward caps, and turn-card expiry/sequence/unexpired-open-card validation out of `gameCore.ts`.
- Game-core turn and hosted action payload extraction in `tools/agent-server/lib/epoch/turnHostedActionRules.ts`, moving turn-card, turn-resolution, hosted-session, hosted-action, and turn/hosted reward grant payload construction out of `gameCore.ts`.
- Game-core hosted runner attestation payload extraction in `tools/agent-server/lib/epoch/turnHostedActionRules.ts`, moving attestation payload normalization out of `gameCore.ts`.
- Game-core turn and hosted action event sequence extraction in `tools/agent-server/lib/epoch/turnHostedActionRules.ts`, moving turn-card creation/resolution and hosted-session/hosted-action/attestation/reward/lifetime event sequence planning out of `gameCore.ts`.
- Game-core server-hosted job payload/event-sequence extraction in `tools/agent-server/lib/epoch/serverHostedRuntimeRules.ts`, moving queued/completed/skipped job lifecycle payload construction and event sequence planning out of `gameCore.ts`.
- Shared source event authority and risk review rule extraction in `tools/agent-server/lib/epoch/sourceEventRules.ts`, moving source authority, low-authority refutation policy, source provenance, source explorer lookup, audit URL, risk-review source event lookup, source-event ID normalization/known-event validation, and risk-review flags/score/reviewable analysis out of `gameCore.ts` and duplicated runtime helpers.
- Shared lore provenance and evidence rule extraction in `tools/agent-server/lib/epoch/loreProvenanceRules.ts`, moving stable evidence JSON/hash, lore claim hash, contribution provenance, target adjudication provenance, authority review, and runtime provenance fallback out of `gameCore.ts` and duplicated runtime helpers.
- Game-core lore contribution validation, payload, and event-sequence rule extraction in `tools/agent-server/lib/epoch/loreContributionRules.ts`, moving category/revision gates, contribution revision field normalization, contribution source ID normalization, source event lookup/missing-source validation, non-evidence reuse ownership guard, low-authority refutation gate, refutation daily quota rules, contribution record payload/event planning, target adjudication status/source ID normalization/source contribution event lookup/history folding/stable key/id link/payload/event planning, contribution focus cost and spend payload planning, experiment main-rule review, revision policy, creature behavior scope review, fuzzy time interval review, cross-region mechanism support, and canon candidate path attribution out of `gameCore.ts`.
- Game-core NPC candidate rule extraction in `tools/agent-server/lib/epoch/npcCandidateRules.ts`, moving trait/review-resolution normalization, canonicalized NPC payload planning, rumor admission scoring, review flags/score/publication policy, ability effect clustering, submitted/reviewed payload planning, and canonicalize/submit/review event sequence planning out of `gameCore.ts`.
- Game-core NPC lifecycle rule extraction in `tools/agent-server/lib/epoch/npcLifecycleRules.ts`, moving lifecycle tick target selection/limit/region filtering, lifecycle changes normalization, lifecycle event payload/sourceEventIds planning, memory summary, organization naming, migration region, household merge/source-event planning, organization membership planning, memory/relationship/household/career/location/asset/health payload planning, manual lifecycle/memory event sequence planning, tick 副作用事件序列规划, and tick 结果投影折叠 out of `gameCore.ts`.
- Game-core agent interaction rule extraction in `tools/agent-server/lib/epoch/agentInteractionRules.ts`, moving relationship scoring, diplomacy seed, diplomacy proposed/responded payload planning, diplomacy proposal event sequence planning, diplomacy response event sequence planning, accepted diplomacy relationship/trace event sequence planning, diplomacy trace payload planning, relationship updated payload planning, relationship update event sequence planning, child NPC bond guards, agent-NPC bond scoring and payload planning, agent-NPC bond update event sequence planning, social hook lifecycle draft/created payload planning, hosted social hook scoring, consumed social hook reads, and hosted social hook bond/memory/influence payload plus event sequence planning out of `gameCore.ts`.
- Game-core command abuse rule extraction in `tools/agent-server/lib/epoch/commandAbuseRules.ts`, moving rejected-command abuse score delta/reason classification plus command rejected / abuse score changed event sequence/result projection out of `gameCore.ts`.
- Game-core server trust guard reuse in `tools/agent-server/lib/epoch/gameCore.ts`, replacing duplicated pure server-only `system_worker` guard checks with the existing `requireServerTrust` helper while preserving per-command error codes.
- Game-core encounter rule extraction in `tools/agent-server/lib/epoch/encounterRules.ts`, moving objective projection reads, objective reward, objective resource scoring, objective creation/contribution/settlement event sequence/result projection, objective contribution spend payload, objective settlement reward grant payload, objective created/contribution/settlement payload planning, anomaly projection reads, anomaly spawned payload planning, anomaly spawn event sequence/result projection, anomaly severity, anomaly reward, anomaly media validation, anomaly contest/resolution event sequence/result projection, anomaly contest focus spend payload, anomaly resolution reward grant payload, anomaly contest/resolution payload planning, and anomaly focus scoring out of `gameCore.ts`.
- Game-core resource-node rule extraction in `tools/agent-server/lib/epoch/resourceNodeRules.ts`, moving resource-node projection reads, stamina score, spawn cooldown, equipment bonus projection, spawn/contest/settlement event sequence/result projection, contest stamina spend payload, settlement reward grant payload, spawned payload planning, contest payload planning, and settlement influence/trace payload planning rules out of `gameCore.ts`.
- Game-core season campaign rule extraction in `tools/agent-server/lib/epoch/seasonCampaignRules.ts`, moving season projection reads, creation/contribution/settlement event sequence/result projection, creation/start/objective payload planning, contribution spend payload planning, contribution bonus scoring, contribution payload planning, objective completion payload planning, settlement winner selection, winner reward grant payload planning, resolved phase payload planning, organization dividend grant payload planning, region control/monument payload planning, region control decay target selection/limit/amount/min-age/min-score, region control release lookup, region control decay/release/claim/revolt payload planning, region control decay/release/claim event sequence/result projection, region revolt resolution event sequence/result projection, revolt stamina spend payload planning, revolt influence/trace payload planning, revolt settlement power calculation, and organization dividend/prestige payload planning out of `gameCore.ts`.
- Game-core market trade rule extraction in `tools/agent-server/lib/epoch/marketTradeRules.ts`, moving market order projection reads, market risk restriction guard, market fee calculation, seller proceeds, unit pricing, repeat-counterparty risk, suspicious price risk, expiry tick target selection/limit/max-age, create/fill/cancel/expiry event sequence/result projection, created/filled/cancelled/expired payload planning, fill payment payload-pair planning, goods grant asset selection, lock/payment/goods ledger payload planning, item transfer payload planning, and resource refund payload planning out of `gameCore.ts`.
- Game-core direct trade rule extraction in `tools/agent-server/lib/epoch/directTradeRules.ts`, moving direct trade projection reads, resource/item asset conversion, asset labels, repeat-counterparty risk, expiry tick target selection/limit/max-age, create/accept/cancel/expiry event sequence/result projection, created/accepted/cancelled/expired payloads, accepted resource asset selectors, requested payment payload-pair planning, escrow lock/payment/goods ledger payload planning, item transfer payload planning, and escrowed resource refund payload planning out of `gameCore.ts`.
- Game-core bounty rule extraction in `tools/agent-server/lib/epoch/bountyRules.ts`, moving bounty projection reads, create/claim event sequence/result projection, escrow spend, created/claimed, claim reward, fulfillment item transfer, region influence, and trace payload planning out of `gameCore.ts`.
- Result HTTP route extraction in `tools/agent-server/lib/http/resultRoutes.ts` with shared route types in `httpRouteTypes.ts`.
- Identity/recovery/archive/reincarnation HTTP route extraction in `tools/agent-server/lib/http/identityRoutes.ts`.
- Agent profile and briefing route extraction for personality confirm, agent briefing, agent memory, personal migration summary, and explorer profile endpoints in `tools/agent-server/lib/http/agentProfileRoutes.ts`.
- Console and Epoch static asset route extraction in `tools/agent-server/lib/http/assetRoutes.ts`.
- MCP Streamable HTTP and MCP tool proxy route extraction in `tools/agent-server/lib/http/mcpRoutes.ts`.
- Install page, install manifest/status, host-config, and package archive route extraction in `tools/agent-server/lib/http/installRoutes.ts`.
- Public world overview, public agent/profile/archive, hosted session, explorer, region, and NPC page route extraction in `tools/agent-server/lib/http/worldRoutes.ts`.
- Audit API, public audit replay pages, public season archive pages, and season contribution audit export route extraction in `tools/agent-server/lib/http/auditRoutes.ts`.
- Operator control-plane route extraction for moderation, abuse status/profiles/release, operator overview, and maintenance run in `tools/agent-server/lib/http/operatorRoutes.ts`.
- Economy route extraction for inventory, shop, market, market risk release, and direct trade endpoints in `tools/agent-server/lib/http/economyRoutes.ts`.
- Season campaign API route extraction for season list, seed, contribute, and settle endpoints in `tools/agent-server/lib/http/seasonRoutes.ts`.
- Hosted, server-hosted job, web bridge, and attestation API route extraction in `tools/agent-server/lib/http/hostedRoutes.ts`.
- Narrative route extraction for messages, high-value confirmations, region news, lore contribution/adjudication, event history, and lore query endpoints in `tools/agent-server/lib/http/narrativeRoutes.ts`.
- Encounter route extraction for objectives, resource nodes, anomalies, and bounties in `tools/agent-server/lib/http/encounterRoutes.ts`.
- Society route extraction for downtime, NPC, agent-NPC bonds, households, organizations, organization politics, social hooks, and API region info in `tools/agent-server/lib/http/societyRoutes.ts`.
- Gameplay route extraction for party runs, raids, region-control revolt, retaliations, diplomacy, relationships, and turn cards in `tools/agent-server/lib/http/gameplayRoutes.ts`.
- Legacy runtime route extraction for legacy run submission/archive/heartbeat, context package, public world context, lore/progression/faction/feedback/outbox, world browser/detail, community, experience, and transparency endpoints in `tools/agent-server/lib/http/legacyRoutes.ts`.
- HTTP error response policy extraction into `tools/agent-server/lib/http/errorResponse.ts`, reducing `httpServer.ts` to 777 lines and leaving it focused on bootstrap, health, dispatch, and persistence/audit bridges.
- HTTP request/base-url helper extraction into `tools/agent-server/lib/http/request.ts` and response/CORS helper extraction into `tools/agent-server/lib/http/response.ts`, reducing `httpServer.ts` further to 652 lines.
- Frontend result panel extraction into `ResultNavigation`, `GameRunTimeline`, and `PublicReceiptDisclosure`.
- Frontend world overview panel extraction into `WorldOverviewPanel`, moving world news, honor boards, lore contributions/status cards, active seasons, and region highlights out of `AgentExplorer.tsx` while keeping `WorldOverviewRecentResults` delegated.
- Frontend world overview recent result extraction into `WorldOverviewRecentResults`, removing the inline `recentResults.slice(...).map(...)` from `AgentExplorer.tsx`.
- Frontend public world summary extraction into `PublicWorldPanel`, moving canonical/disputed/open-conflict/faction/source-graph counters out of `AgentExplorer.tsx`.
- Frontend resource panel extraction into `ResourcePanel`, removing inline resource media grid display from `AgentExplorer.tsx`.
- Frontend inventory panel extraction into `InventoryPanel`, removing inline inventory item, equipment effect, crafting, and shop controls from `AgentExplorer.tsx`.
- Frontend public market panel extraction into `MarketPanel`, removing inline market order form/list/restriction controls from `AgentExplorer.tsx`.
- Frontend private direct trade panel extraction into `DirectTradePanel`, removing inline direct trade form/list/audit controls from `AgentExplorer.tsx`.
- Frontend organization control extraction into `OrganizationPanel`, removing inline organization directory, membership, upgrade, treasury, budget, career, and politics controls from `AgentExplorer.tsx`.
- Frontend encounter/action control extraction into `EncounterPanel`, removing inline objective, resource node, and anomaly action panels from `AgentExplorer.tsx`.
- Frontend bounty control extraction into `BountyPanel`, removing inline bounty publishing, fulfillment, claim, and compact bounty list controls from `AgentExplorer.tsx`.
- Frontend party run control extraction into `PartyRunPanel`, removing inline party creation, join request, invite audit, and party settlement controls from `AgentExplorer.tsx`.
- Frontend raid and retaliation control extraction into `RaidRetaliationPanel`, removing inline raid settlement, region revolt, retaliation resolution, and compact raid result controls from `AgentExplorer.tsx`.
- Frontend season campaign control extraction into `SeasonPanel`, removing inline season archive link, media, contribution, objective, phase, and standing controls from `AgentExplorer.tsx`.
- Frontend relationship and diplomacy control extraction into `RelationshipDiplomacyPanel`, removing inline relationship graph, focus spend, diplomacy proposal, and diplomacy response controls from `AgentExplorer.tsx`.
- Frontend large region overview extraction into `RegionOverviewPanel`, removing inline region media, leaderboard, commission, NPC, relationship, household, organization shell, control, and conflict summary display from `AgentExplorer.tsx`.
- Frontend hosted and turn action extraction into `TurnHostedActionPanel`, removing inline low-stimulation preflight, intervention bar, risk package, server-hosted action queue, turn card, hosted session action, web bridge, attestation, and action explanation controls from `AgentExplorer.tsx`.
- Frontend progress refresh controller extraction into `tools/graph-react-app/src/agent/agentProgressController.ts`, moving agent briefing/memory/personal-migration/abuse-status request aggregation and stale request suppression out of `AgentExplorer.tsx`.
- Added `tools/graph-react-app/src/agent/agentProgressController.test.ts` and wired it into `npm run agent:ui-test` so the progress refresh boundary is part of the standard UI safety net.
- Frontend full-region snapshot controller extraction into `tools/graph-react-app/src/agent/agentRegionController.ts`, moving canonical region/messages/objectives/resource-nodes/anomalies/seasons/diplomacy state commits plus fetched-message and domain-slice overrides out of repeated `AgentExplorer.tsx` action handlers.
- Added `tools/graph-react-app/src/agent/agentRegionController.test.ts` and wired it into `npm run agent:ui-test`; layout tests now require full region snapshot commits, slice overrides, diplomacy commits, and direct `getEpochRegionInfo` refreshes to go through the controller boundary.
- Frontend async action status controller extraction into `tools/graph-react-app/src/agent/agentActionController.ts`, moving busy/error/latest-request success/failure handling out of the `AgentExplorer.tsx` container while preserving the local `runAction` wrapper.
- Added `tools/graph-react-app/src/agent/agentActionController.test.ts` and wired it into `npm run agent:ui-test`; layout tests now require the action status state machine to stay behind the controller boundary.
- Frontend install readiness controller extraction into `tools/graph-react-app/src/agent/agentInstallReadinessController.ts`, moving installation connection/package/host/tool/latest-request label projection out of the `AgentExplorer.tsx` container.
- Added `tools/graph-react-app/src/agent/agentInstallReadinessController.test.ts` and wired it into `npm run agent:ui-test`; layout tests now require install readiness labels to stay behind the controller boundary.
- Frontend player action readiness controller extraction into `tools/graph-react-app/src/agent/agentPlayerActionReadinessController.ts`, moving identity/downtime/complete-run/result/install-status disabled-reason projection out of the `AgentExplorer.tsx` container.
- Added `tools/graph-react-app/src/agent/agentPlayerActionReadinessController.test.ts` and wired it into `npm run agent:ui-test`; layout tests now require the player primary action copy and blockers to stay behind the controller boundary.
- Frontend player label helper extraction into `tools/graph-react-app/src/agent/agentPlayerLabels.ts`, moving tool catalogs, region/faction/event/source/status/action/downtime labels, and public summary cleanup out of the `AgentExplorer.tsx` container.
- Added `tools/graph-react-app/src/agent/agentPlayerLabels.test.ts` and wired it into `npm run agent:ui-test`; layout tests now require player-facing labels and tool strings to stay behind the helper boundary.
- React entrypoint code-splitting for `AgentExplorer` and `WorldMapScene`, dropping the main entry chunk from about 1010.06 kB to 213.33 kB and moving Agent/3D code into separate lazy chunks.
- Vite export pipeline now copies generated JS chunks into the exported asset directory instead of assuming a single inlined entry script.
- Browser console server test now follows the module script to the `AgentExplorer` lazy chunk before checking agent-only API markers.
- The no-JS source gate now permits generated Vite chunks only under `00_总览/assets/`, preserving the source-file ban while supporting exported split chunks.
- World overview recent results now expose `run`, and the control console displays run title/step/status for recent result cards.
- Focused turn result pages are locked to `single_turn` / 1 step so busy recent-event history cannot masquerade as a complete journey.
- Restart regression: persisted result page can hydrate into a fresh runtime and serve its public share URL with token/version checks.
- Restart regression also checks hydrated world overview rebuilds the result page run read model.
- Runtime explorer auth helper extraction into `tools/agent-server/lib/epoch/runtimeAuth.ts`, moving recovery code parsing, local secret hashing, and constant-time hash/signature comparison out of `runtime.ts`.
- Runtime explorer auth state extraction into `tools/agent-server/lib/epoch/explorerAuthRuntime.ts`, moving explorer secret-hash ownership, identity/recovery event hydration, credential registration/assertion, recovery rotation, and idempotent rotation replay out of `runtime.ts`.
- Runtime abuse rate-limit state extraction into `tools/agent-server/lib/epoch/runtimeAbuseRuntime.ts`, moving abuse buckets, restricted-score gates, and abuse status projection out of `runtime.ts`.
- Runtime idempotency state extraction into `tools/agent-server/lib/epoch/runtimeIdempotencyRuntime.ts`, moving idempotent result cache, owner/subject conflict records, duplicate replay, explorer-registration replay, and auth-after-idempotency sequencing out of `runtime.ts`.
- Runtime high-value confirmation rule extraction into `tools/agent-server/lib/epoch/highValueConfirmationRules.ts`, moving confirmation subject hash, summary, turn-card response envelope, and auth-scope action mapping out of `runtime.ts`.
- Runtime high-value confirmation state-machine extraction into `tools/agent-server/lib/epoch/highValueConfirmationRuntime.ts`, moving request/confirm/list/consume state maps, confirmation event generation, token-hash lookup, expiry refresh, and initial event hydration out of `runtime.ts`.
- Runtime attestation runtime extraction into `tools/agent-server/lib/epoch/attestationRuntime.ts`, moving attested runner config, challenge idempotency, challenge issue, signature base/key id/trust class calculation, signature verification, used/expired challenge state, and submit context construction out of `runtime.ts`.
- Runtime result page rule extraction into `tools/agent-server/lib/epoch/resultPageRuntimeRules.ts`, moving share-token hashing, result/status URLs, share-version parsing, TTL, stable payload JSON, owner lookup, public-safe summary/pages, focused progress, publish request hashing, create/revoke/delete idempotency keys, active/revoked/deleted page record construction, public access/expiry status classification, and deletion summary/minimal-reference construction out of `runtime.ts`.
- Runtime result page lifecycle store extraction into `tools/agent-server/lib/epoch/resultPageRuntimeStore.ts`, moving result page read model ownership, publish/share token issuance, create/revoke/delete idempotency maps, publish-token consumption, owner/operator revocation authorization, public access lookup, recent-result lookup, and deletion lifecycle state out of `runtime.ts`.
- Runtime result page navigation rule extraction into `tools/agent-server/lib/epoch/resultPageNavigationRules.ts`, moving next-action selection, commission action labels, action media, and agent self-statement fallback copy out of `runtime.ts`.
- Runtime result page context rule extraction into `tools/agent-server/lib/epoch/resultPageContextRules.ts`, moving focused turn-card/hosted-session validation, requested/focused/downtime/latest-event region selection, and regional context projection out of `runtime.ts`.
- Runtime result page payload builder extraction into `tools/agent-server/lib/epoch/resultPagePayloadRules.ts`, moving progress/focus/context/next-action/run-summary/receipt assembly out of `runtime.ts`.
- Runtime one-shot exploration write-flow extraction into `tools/agent-server/lib/epoch/explorationRuntime.ts`, moving multi-step hosted session/action orchestration, focus-event collection, and result-page publication out of `runtime.ts`.
- Runtime result page receipt rule extraction into `tools/agent-server/lib/epoch/resultPageReceiptRules.ts`, moving receipt focus, canonical event projection, trusted execution receipt, play mode, and trust-tier classification out of `runtime.ts`.
- Runtime server-hosted job rule extraction into `tools/agent-server/lib/epoch/serverHostedRuntimeRules.ts`, moving option-key validation, server-hosted command context construction, job query/list filtering/sorting, and queued-job selection out of `runtime.ts`.
- Game-core server-hosted job lifecycle payload and event sequence extraction into `tools/agent-server/lib/epoch/serverHostedRuntimeRules.ts`, moving queued/completed/skipped job payload and event sequence planning out of `gameCore.ts`.
- Runtime server-hosted write-flow extraction into `tools/agent-server/lib/epoch/serverHostedRuntime.ts`, moving immediate server-hosted action execution, queueing, job listing, queued-job preflight, skip, execution, and completion orchestration out of `runtime.ts`.
- Runtime source event provenance now reuses `tools/agent-server/lib/epoch/sourceEventRules.ts` instead of carrying a second source-authority/provenance implementation.
- Runtime lore contribution and target adjudication provenance now reuse `tools/agent-server/lib/epoch/loreProvenanceRules.ts` instead of carrying a second evidence-hash/provenance fallback implementation.
- Runtime lore read-model extraction into `tools/agent-server/lib/epoch/loreReadModel.ts`, moving lore contribution list projection, target status folding, dispute archive gate, S040 worldview gate, lore adjudication overview, and world honor boards out of `runtime.ts`.
- Runtime public world entry read-model extraction into `tools/agent-server/lib/epoch/publicWorldReadModel.ts`, moving world overview, agent briefing, hosted-session watch, lore portal, world context version, and public limit aggregation out of `runtime.ts`.
- Runtime region/NPC info read-model extraction into `tools/agent-server/lib/epoch/regionInfoReadModel.ts`, moving region detail aggregation, region media/news/activity/economy/conflict summaries, and NPC organization/career/memory/household/location/health/asset/social-hook summaries out of `runtime.ts`.
- Runtime organization/NPC subview wrapper extraction into `tools/agent-server/lib/epoch/organizationNpcReadModel.ts`, moving organization, organization-politics, NPC career/location/asset/health/social-hook/household/memory/relationship, and agent-NPC bond runtime read wrappers out of `runtime.ts`.
- Runtime encounter read-wrapper extraction into `tools/agent-server/lib/epoch/encounterRuntimeReadModel.ts`, moving objectives, resource-node, and anomaly runtime read wrappers out of `runtime.ts` while preserving the focused `encounterReadModel.ts` query module for shared lower-level projections.
- Runtime economy read-wrapper extraction into `tools/agent-server/lib/epoch/economyRuntimeReadModel.ts`, moving inventory, shop, market, and direct-trade runtime read wrappers out of `runtime.ts` while preserving the focused progress/shop/market query modules for shared lower-level projections.
- Runtime season read-wrapper extraction into `tools/agent-server/lib/epoch/seasonRuntimeReadModel.ts`, moving season list, season archive, and season command result wrappers out of `runtime.ts` while preserving the focused `seasonReadModel.ts` query module for shared lower-level projections.
- Runtime combat read-wrapper extraction into `tools/agent-server/lib/epoch/combatRuntimeReadModel.ts`, moving bounty, party-run, and raid runtime read wrappers out of `runtime.ts` while preserving the focused bounty/party and region-conflict query modules for shared lower-level projections.
- Runtime social read-wrapper extraction into `tools/agent-server/lib/epoch/socialRuntimeReadModel.ts`, moving relationship and diplomacy runtime read wrappers out of `runtime.ts` while preserving the focused relationship and organization query modules for shared lower-level projections.
- Runtime activity read-wrapper extraction into `tools/agent-server/lib/epoch/activityRuntimeReadModel.ts`, moving events, progress, and messages runtime input normalization out of `runtime.ts` while preserving the focused progress and region-activity query modules for shared lower-level projections.
- Runtime hosted-session read-wrapper extraction into `tools/agent-server/lib/epoch/hostedSessionRuntimeReadModel.ts`, moving hosted session list status/limit parsing out of `runtime.ts` while preserving the focused hosted-session redaction/watch read model.
- Runtime identity/profile read-wrapper extraction into `tools/agent-server/lib/epoch/identityRuntimeReadModel.ts`, moving agent memory, personal migration, identity archive, and explorer profile runtime wrappers out of `runtime.ts` while preserving focused identity/profile read models.
- Runtime operator/audit read-wrapper extraction into `tools/agent-server/lib/epoch/operatorRuntimeReadModel.ts`, moving audit, abuse profile, moderation queue, and operator overview runtime read assembly out of `runtime.ts` while keeping operator-key authorization at the runtime command boundary.
- Runtime shop offer read-model extraction into `tools/agent-server/lib/epoch/shopReadModel.ts`, moving public shop offer item-media projection out of `runtime.ts`.
- Runtime region media read-model extraction into `tools/agent-server/lib/epoch/regionMediaReadModel.ts`, moving public location media projection out of `runtime.ts`.
- Runtime region news read-model extraction into `tools/agent-server/lib/epoch/regionNewsReadModel.ts`, moving visible-news filtering/sorting and world-news media projection out of `runtime.ts` and letting progress views reuse the same media helper.
- Runtime relationship read-model extraction into `tools/agent-server/lib/epoch/relationshipReadModel.ts`, moving agent relationship, NPC relationship, agent-NPC bond, and household media projections out of `runtime.ts`.
- Runtime NPC state read-model extraction into `tools/agent-server/lib/epoch/npcStateReadModel.ts`, moving NPC memory/career/location/asset/health/social-hook projections out of `runtime.ts`.
- Runtime organization read-model extraction into `tools/agent-server/lib/epoch/organizationReadModel.ts`, moving diplomacy, organization membership/list/politics, treasury ledger, and influence score projections out of `runtime.ts`.
- Runtime encounter read-model extraction into `tools/agent-server/lib/epoch/encounterReadModel.ts`, moving objective, resource-node, and anomaly sorting/filtering queries out of `runtime.ts` and removing duplicate copies from `regionCommissionReadModel.ts`.
- Runtime bounty/party read-model extraction into `tools/agent-server/lib/epoch/bountyPartyReadModel.ts`, moving bounty and party-run sorting/filtering plus public party invite-token redaction out of `runtime.ts` and removing duplicate copies from `regionCommissionReadModel.ts`.
- Runtime region monument read-model extraction into `tools/agent-server/lib/epoch/regionMonumentReadModel.ts`, moving monument sorting/filtering out of `runtime.ts` and removing the duplicate copy from `regionCommissionReadModel.ts`.
- Runtime season read-model extraction into `tools/agent-server/lib/epoch/seasonReadModel.ts`, moving season campaign filtering/sorting/media decoration and season contribution audit grouping/totals out of `runtime.ts`.
- Runtime hosted session read-model extraction into `tools/agent-server/lib/epoch/hostedSessionReadModel.ts`, moving hosted session filtering/sorting, public session/action redaction, and hosted watch next-action copy out of `runtime.ts`.
- Runtime Web Bridge read-model extraction into `tools/agent-server/lib/epoch/webBridgeReadModel.ts`, moving action option projection, prompt layer construction, copy prompt generation, and turn view projection out of `runtime.ts`.
- Runtime identity archive read-model extraction into `tools/agent-server/lib/epoch/identityArchiveReadModel.ts`, moving archived lineage, resources, archive/reincarnation event lookup, and public archive links out of `runtime.ts`.
- Runtime region commission read-model extraction into `tools/agent-server/lib/epoch/regionCommissionReadModel.ts`, moving commission source projection, location motif quotas, commission secret exposure, reveal budget, prefile isolation, and location motif bias rules out of `runtime.ts`.
- Runtime idempotency rule extraction into `tools/agent-server/lib/epoch/idempotencyRules.ts`, moving stable subject normalization, subject hashing, and owner-scoped idempotency keys out of `runtime.ts`.
- Runtime attestation runtime extraction into `tools/agent-server/lib/epoch/attestationRuntime.ts`, moving attested runner config/challenge/signature state out of `runtime.ts`.
- Runtime result page lifecycle store extraction into `tools/agent-server/lib/epoch/resultPageRuntimeStore.ts`, moving result page publish/revoke/delete state out of `runtime.ts`.
- Runtime server-hosted write-flow extraction into `tools/agent-server/lib/epoch/serverHostedRuntime.ts`, moving server-hosted run/queue/list/job execution state orchestration out of `runtime.ts`.
- Runtime maintenance write-orchestration extraction into `tools/agent-server/lib/epoch/maintenanceRuntime.ts`, moving operator `run_maintenance` defaults, worker sequencing, candidate selection, server-hosted queued-job processing, decay summaries, and maintenance result assembly out of `runtime.ts`.
- Runtime downtime write-flow extraction into `tools/agent-server/lib/epoch/downtimeRuntime.ts`, moving downtime set/claim/tick request parsing, owner context, idempotency wrapping, system tick context, and restricted-score allowance out of `runtime.ts`.
- Runtime NPC candidate write-flow extraction into `tools/agent-server/lib/epoch/npcCandidateRuntime.ts`, moving npc_note, candidate submission, and operator review request parsing, context construction, idempotency wrapping, and restricted-score review allowance out of `runtime.ts`.
- Runtime NPC lifecycle write-flow extraction into `tools/agent-server/lib/epoch/npcLifecycleRuntime.ts`, moving lifecycle record/tick trust checks, request parsing, system context construction, idempotency wrapping, and restricted-score worker allowance out of `runtime.ts`.
- Runtime anomaly event template rule extraction into `tools/agent-server/lib/epoch/anomalyEventTemplateRules.ts`, moving anomaly template catalog, boss media binding, template rotation seed selection, narrative variant selection, and operator spawn input mapping out of `runtime.ts`.
- Runtime command context rule extraction into `tools/agent-server/lib/epoch/runtimeCommandContextRules.ts`, moving generic, untrusted-client, owner-verified, and maintenance command context builders out of `runtime.ts`.
- Runtime public projection/result rule extraction into `tools/agent-server/lib/epoch/runtimePublicProjectionRules.ts`, moving public event redaction, public projection wrapping, command result wrapping, and non-enumerable internal event attachment out of `runtime.ts`.
- Runtime input safety rule extraction into `tools/agent-server/lib/epoch/runtimeInputSafetyRules.ts`, moving public text secret-material guards and rejected-command audit input summaries out of `runtime.ts`.
- Runtime region news draft rule extraction into `tools/agent-server/lib/epoch/regionNewsDraftRules.ts`, moving server-event region lookup and region news headline/body/legend draft projection out of `runtime.ts`.
- Runtime region news write-flow extraction into `tools/agent-server/lib/epoch/regionNewsRuntime.ts`, moving source-event lookup, region mismatch validation, duplicate-news reuse, `core.generateRegionNews` adapter calls, and append-to-result orchestration out of `runtime.ts`.
- Region news draft public vocabulary cleanup in `tools/agent-server/lib/epoch/regionNewsDraftRules.ts`, replacing visible `region_`, `agent_`, and `explorer_` IDs with public labels or generic player-facing fallbacks.
- Public world/agent/region pages now reuse `tools/agent-server/lib/epoch/publicVocabulary.ts` for event, source, status, region, resource, trust, rarity, downtime, kind, and commission reveal labels instead of maintaining a second player-facing glossary in `tools/agent-server/lib/publicWorldPageHtml.ts`.
- Public visible-text guards in `tools/agent-server/test/server.test.ts` now cover world overview, public agent pages, public region pages, result pages, and install smoke output for raw enum/ID leakage plus player-hostile copy such as `预算剩余`, `章节锁`, and `预档未来钩子`.
- Maintenance anomaly-news tests now assert public region names (`灰港`) instead of raw region IDs in generated news bodies.
- Install/package/release smoke process waits are hardened for full-suite load: package-root MCP stdio requests now wait up to 30s with child stderr diagnostics, release rehearsal health waits match the existing 30s install smoke health window, and install smoke command assertions report stdout plus stderr instead of hiding JSON failures behind SQLite warnings.
- Public explorer/profile/archive pages expose player-facing navigation links to active agent profiles, archived identities, and world entry pages.
- Install smoke public replay/result checks now assert player-facing labels instead of old debug receipt wording.
- Browser QA on a real one-shot 8-step journey result page at desktop and 545px viewport.
- React console player-facing labels now route event types, secret tiers, trust/delivery/channel classes, source types, common statuses, region activity sources, direct trade audits, season contribution trust, hosted/web bridge trust, and region commission secrecy through `agentPlayerLabels.ts`; resource cards now display `focus` as “专注点” with a short usage explanation.
- Frontend layout tests now include a regression guard that rejects player-visible JSX patterns like `{event.eventType}`, `{sourceEventType}`, raw `trustClass`, raw Web Bridge trust/channel fields, local secret-tier maps, and old `秘密揭露预算` / `未来钩子` copy.
- Frontend resource names and captions now live in `agentPlayerLabels.ts` instead of `AgentExplorer.tsx`; downtime, crafting, relationship, and anomaly UI copy consistently says “专注点”.
- Player-visible one-time confirmation and invite copy now says “确认凭证” / “邀请口令” instead of `token`; server-hosted social hook copy and activity media labels now say “人物事件” instead of “社交钩子”.
- High-value confirmation actions and statuses now render through `agentPlayerLabels.ts`, including player-facing labels for world speech, turn-card generation, and turn-card settlement; unknown internal actions fall back to neutral copy instead of leaking raw enum text.
- Turn-card nonce, signed envelope, hash, and signature details are now grouped under default-folded “校验证明/结算校验证明” disclosure blocks, keeping the main action panel focused on story choice and settlement status.
- Console recovery-code empty states, operator overview counts, attested-runner proof hints, organization treasury evidence, world-lore contribution/status cards, raid/retaliation summaries, and result-page regional conflict context now use Chinese player-facing labels instead of raw `pending`, `no attestation`, `claim/evidence/sources`, `threat/rank/overlap/weight`, event IDs, raw outcome/status enums, or `A -> B` arrows.
- Added shared player-facing compact identifier helpers in `agentPlayerLabels.ts` and routed visible agent/explorer/record/relationship fallback labels through them across `AgentExplorer`, region overview, relationship/diplomacy, party runs, encounters, organization budgets, seasons, market orders, direct trades, and raid/retaliation panels.

Verified:

```bash
cd tools/graph-react-app
npm run typecheck
node --import tsx --test src/agent/agentPlayerLabels.test.ts src/agent/AgentExplorer.layout.test.ts
git diff --check
npm run agent:ui-test
node --import tsx --test ../agent-server/test/turnHostedActionRules.test.ts ../agent-server/test/agentInteractionRules.test.ts ../agent-server/test/gameCore-boundaries.test.ts src/agent/agentPlayerLabels.test.ts src/agent/AgentExplorer.layout.test.ts
npm run build:export
npm run agent:test
node --import tsx --test ../agent-server/test/npcLifecycleRules.test.ts ../agent-server/test/gameCore-boundaries.test.ts
npm run typecheck
npm run agent:test
node --import tsx --test ../agent-server/test/encounterRules.test.ts ../agent-server/test/gameCore-boundaries.test.ts
npm run typecheck
npm run agent:test # 1028/1028 pass after turn-card/turn-resolution/hosted-session/hosted-action event sequence extraction, server-hosted job lifecycle event sequence extraction, lore contribution record/target adjudication event sequence extraction, party run settlement event sequence extraction, runtime input normalization/template-choice extraction, result page focus validation/regional context projection extraction, result page payload builder extraction, one-shot exploration runtime extraction, region news write-flow extraction, explorer auth runtime extraction, runtime abuse runtime extraction, runtime idempotency runtime extraction, public world entry read-model extraction, region/NPC info read-model extraction, organization/NPC subview wrapper extraction, encounter read-wrapper extraction, identity issue/recovery rotation/lifetime adjustment/archive/reincarnation/personality drift proposal/confirmation event sequence/result projection, NPC canonicalize/submit/review and manual lifecycle/memory event sequence extraction, diplomacy proposal event sequence extraction, diplomacy response event sequence extraction, accepted diplomacy relationship/trace event sequence extraction, relationship update event sequence extraction, agent-NPC bond update event sequence extraction, hosted social hook side-effect event sequence extraction, organization creation/membership event sequence extraction, organization treasury contribution event sequence extraction, organization budget proposal/resolution event sequence extraction, organization upgrade purchase event sequence extraction, resource grant/spend event sequence/result projection, objective creation/contribution/settlement, anomaly spawn/contest/resolution, resource-node spawn/contest/settlement, season campaign create/contribute/settle, market order create/fill/cancel/expiry, direct trade create/accept/cancel/expiry, bounty create/claim, party run create/invite update/member join/join request/resolve, raid/retaliation resolution, region revolt resolution, downtime set/claim/tick event sequence/result projection, region control decay/release/claim event sequence/result projection, moderation resolved event sequence/result projection, risk review recorded event sequence/result projection, market risk release event sequence/result projection, abuse score release/decay event sequence/result projection, and inventory item create/craft/shop/bind event sequence/result projection extraction
npm run agent:test # 1028/1028 pass after economy runtime read-wrapper extraction
node --import tsx --test --test-name-pattern "season|campaign|contribution audit|region control|revolt" ../agent-server/test/server.test.ts ../agent-server/test/mcp.test.ts ../agent-server/test/seasonReadModel.test.ts ../agent-server/test/seasonCampaignRules.test.ts ../agent-server/test/epoch-game-core.test.ts
npm run agent:test # 1028/1028 pass after season runtime read-wrapper extraction
node --import tsx --test --test-name-pattern "bounty|party|party run|raid|retaliation|frontline|region info|direct trade expiry refunds|owner-authorized party" ../agent-server/test/server.test.ts ../agent-server/test/mcp.test.ts ../agent-server/test/bountyPartyReadModel.test.ts ../agent-server/test/combatSettlementRules.test.ts ../agent-server/test/bountyRules.test.ts ../agent-server/test/epoch-game-core.test.ts
npm run agent:test # 1028/1028 pass after combat runtime read-wrapper extraction
node --import tsx --test --test-name-pattern "relationship|diplomacy|agent NPC bond|NPC relationships|social hooks|frontlines|organization membership" ../agent-server/test/server.test.ts ../agent-server/test/mcp.test.ts ../agent-server/test/agentInteractionRules.test.ts ../agent-server/test/relationshipReadModel.test.ts ../agent-server/test/epoch-game-core.test.ts
npm run agent:test # 1028/1028 pass after social runtime read-wrapper extraction
node --import tsx --test --test-name-pattern "messages|identity progress|progress|region alias|events|latest events|activity" ../agent-server/test/server.test.ts ../agent-server/test/mcp.test.ts ../agent-server/test/regionActivityReadModel.test.ts ../agent-server/test/progressReadModel.test.ts
node --import tsx --test --test-name-pattern "hosted session|hosted_sessions|hosted action|server-hosted|attested|public hosted|watch" ../agent-server/test/server.test.ts ../agent-server/test/mcp.test.ts ../agent-server/test/hostedSessionReadModel.test.ts ../agent-server/test/serverHostedRuntime.test.ts ../agent-server/test/attestationRuntime.test.ts
node --import tsx --test --test-name-pattern "agent memory|personal migration|migration|explorer profile|identity archive|archive identity|reincarnate|lineage|identity slot|NPC candidate" ../agent-server/test/server.test.ts ../agent-server/test/mcp.test.ts ../agent-server/test/agentMemoryReadModel.test.ts ../agent-server/test/identityArchiveReadModel.test.ts ../agent-server/test/explorerProfileReadModel.test.ts ../agent-server/test/personalMigrationReadModel.test.ts ../agent-server/test/identityLifecycleRules.test.ts
node --import tsx --test --test-name-pattern "operator|audit|abuse|moderation|risk review|growth quality|attested runner" ../agent-server/test/server.test.ts ../agent-server/test/mcp.test.ts ../agent-server/test/operatorOverviewReadModel.test.ts ../agent-server/test/auditReadModel.test.ts ../agent-server/test/moderationRiskRules.test.ts ../agent-server/test/runtimePublicProjectionRules.test.ts
npm run typecheck:agent
node --import tsx --test ../agent-server/test/runtime-boundaries.test.ts
npm run agent:test # 1028/1028 pass after activity, hosted-session, identity/profile, and operator/audit runtime read-wrapper extraction
node --import tsx --test --test-name-pattern "downtime|Downtime" ../agent-server/test/epoch-game-core.test.ts ../agent-server/test/server.test.ts ../agent-server/test/mcp.test.ts ../agent-server/test/downtimeRules.test.ts
git diff --check
npm run agent:test # 1029/1029 pass after downtime runtime write-flow extraction
node --import tsx --test --test-name-pattern "NPC candidate|npc_note|story NPC candidates|canonicalized NPC|NPC canonicalization|reviewNpcCandidate|submitNpcCandidate|rumor admission|ability claims|delegates NPC candidate" ../agent-server/test/epoch-game-core.test.ts ../agent-server/test/server.test.ts ../agent-server/test/mcp.test.ts ../agent-server/test/npcCandidateRules.test.ts ../agent-server/test/gameCore-boundaries.test.ts
npm run agent:test # 1030/1030 pass after NPC candidate runtime write-flow extraction
node --import tsx --test --test-name-pattern "NPC lifecycle|tick_npc_lifecycle|record_npc_lifecycle|server-created NPC|social hooks|organizations careers and locations|lifecycle payload|delegates NPC lifecycle" ../agent-server/test/epoch-game-core.test.ts ../agent-server/test/server.test.ts ../agent-server/test/mcp.test.ts ../agent-server/test/npcLifecycleRules.test.ts ../agent-server/test/gameCore-boundaries.test.ts
npm run agent:test # 1031/1031 pass after NPC lifecycle runtime write-flow extraction
node --import tsx --test ../agent-server/test/gameCore-boundaries.test.ts ../agent-server/test/epoch-game-core.test.ts
npm run typecheck:agent
node --import tsx --test --test-name-pattern "region info|public region|public agent, region and NPC|NPC organizations careers and locations|NPC memories|NPC households|server-derived frontlines|canonical region leaderboards|regional economy orders|social hooks" ../agent-server/test/server.test.ts ../agent-server/test/mcp.test.ts src/agent/api.test.ts src/agent/AgentExplorer.layout.test.ts
node --import tsx --test --test-name-pattern "NPC organizations careers and locations|NPC memories|NPC households|social hooks|public agent, region and NPC|region info" ../agent-server/test/server.test.ts ../agent-server/test/mcp.test.ts src/agent/api.test.ts
node --import tsx --test --test-name-pattern "resource nodes|anomaly chains|contested objectives|region info|server-spawned resource|server-spawned anomaly|HTTP exposes server-spawned" ../agent-server/test/server.test.ts ../agent-server/test/mcp.test.ts ../agent-server/test/encounterReadModel.test.ts
node --import tsx --test --test-name-pattern "inventory|shop|market|direct trade|direct trades|trade|economy|offer|purchase" ../agent-server/test/server.test.ts ../agent-server/test/mcp.test.ts ../agent-server/test/inventoryRules.test.ts ../agent-server/test/shopReadModel.test.ts ../agent-server/test/marketTradeRules.test.ts
node --import tsx --test --test-name-pattern "season|campaign|contribution audit|region control|revolt" ../agent-server/test/server.test.ts ../agent-server/test/mcp.test.ts ../agent-server/test/seasonReadModel.test.ts ../agent-server/test/seasonCampaignRules.test.ts ../agent-server/test/epoch-game-core.test.ts
node --import tsx --test --test-name-pattern "bounty|party|party run|raid|retaliation|frontline|region info|direct trade expiry refunds|owner-authorized party" ../agent-server/test/server.test.ts ../agent-server/test/mcp.test.ts ../agent-server/test/bountyPartyReadModel.test.ts ../agent-server/test/combatSettlementRules.test.ts ../agent-server/test/bountyRules.test.ts ../agent-server/test/epoch-game-core.test.ts
node --import tsx --test --test-name-pattern "relationship|diplomacy|agent NPC bond|NPC relationships|social hooks|frontlines|organization membership" ../agent-server/test/server.test.ts ../agent-server/test/mcp.test.ts ../agent-server/test/agentInteractionRules.test.ts ../agent-server/test/relationshipReadModel.test.ts ../agent-server/test/epoch-game-core.test.ts
node --import tsx --test ../agent-server/test/regionCommissionReadModel.test.ts ../agent-server/test/runtime-boundaries.test.ts ../agent-server/test/mcp.test.ts ../agent-server/test/server.test.ts ../agent-server/test/resultPageRuntimeRules.test.ts src/agent/AgentExplorer.layout.test.ts
node --import tsx --test ../agent-server/test/idempotencyRules.test.ts ../agent-server/test/runtime-boundaries.test.ts
node --import tsx --test --test-name-pattern "idempotency replay|changed payload|idempotency" ../agent-server/test/mcp.test.ts ../agent-server/test/server.test.ts ../agent-server/test/epoch-game-core.test.ts
node --import tsx --test ../agent-server/test/epoch-game-core.test.ts
node --import tsx --test ../agent-server/test/server.test.ts
node --import tsx --test src/agent/AgentExplorer.layout.test.ts
node --import tsx --test src/agent/api.test.ts
node --import tsx --test ../agent-server/test/http-boundaries.test.ts
node --import tsx --test ../agent-server/test/runtime-boundaries.test.ts
node --import tsx --test ../agent-server/test/gameCore-boundaries.test.ts
node --import tsx --test ../agent-server/test/http-boundaries.test.ts ../agent-server/test/runtime-boundaries.test.ts ../agent-server/test/gameCore-boundaries.test.ts
node --import tsx --test --test-name-pattern "downtime preview|downtime tick worker|downtime choices|pending downtime|claimable earnings" ../agent-server/test/epoch-game-core.test.ts ../agent-server/test/server.test.ts src/agent/AgentExplorer.layout.test.ts
node --import tsx --test --test-name-pattern "resource spending|inventory items|crafts inventory items|shop purchases|resource contests|server-authoritative inventory|server-settled item market|shop purchase|inventory effects" ../agent-server/test/epoch-game-core.test.ts ../agent-server/test/server.test.ts src/agent/AgentExplorer.layout.test.ts src/agent/api.test.ts
node --import tsx --test --test-name-pattern "resource spending|resource contests|resource nodes|crafts inventory items|shop purchases|market orders|direct trades|organization treasury|organization budget|bounties escrow|seasonal faction campaigns|downtime rewards" ../agent-server/test/epoch-game-core.test.ts ../agent-server/test/server.test.ts src/agent/AgentExplorer.layout.test.ts src/agent/api.test.ts
node --import tsx --test --test-name-pattern "organization treasury|organization budget|organization upgrade|purchases organization upgrades|contributes member resources|proposes and resolves organization budgets|training hall|organization budget quorum|organization treasury ledger" ../agent-server/test/epoch-game-core.test.ts ../agent-server/test/server.test.ts src/agent/AgentExplorer.layout.test.ts src/agent/api.test.ts
node --import tsx --test --test-name-pattern "party runs|party invite|party join|role synergy|vanguard influence|scribe news|scout intelligence|raid resolution|raid rewards decay|raid repeat|retaliation|server-derived raid|multiplayer party" ../agent-server/test/epoch-game-core.test.ts ../agent-server/test/server.test.ts src/agent/AgentExplorer.layout.test.ts src/agent/api.test.ts
node --import tsx --test --test-name-pattern "agent memory|personality drift|explorer profile dashboard|unified agent briefing" ../agent-server/test/server.test.ts
node --import tsx --test --test-name-pattern "agent memory|stratified agent memory" ../agent-server/test/server.test.ts
node --import tsx --test --test-name-pattern "explorer profile dashboard|personal migration|migration summary" ../agent-server/test/server.test.ts
node --import tsx --test --test-name-pattern "personal migration summary|explorer profile API" src/agent/api.test.ts
node --import tsx --test --test-name-pattern "redacted high-impact Epoch audit|audit can filter market trades|records operator risk review|risk review rejects|market view exposes restrictions|operator overview aggregates" ../agent-server/test/server.test.ts
node --import tsx --test --test-name-pattern "progress action eligibility|archived identities|identity profile|personal version migration" src/agent/AgentExplorer.layout.test.ts
node --import tsx --test --test-name-pattern "agent briefing" ../agent-server/test/server.test.ts src/agent/api.test.ts
node --import tsx --test --test-name-pattern "operator overview aggregates|operator maintenance run|maintenance run processes queued server-hosted jobs" ../agent-server/test/server.test.ts
node --import tsx --test --test-name-pattern "operator overview|operator maintenance run|maintenance run processes queued server-hosted jobs|operator can inspect global abuse profiles|abuse score restriction" ../agent-server/test/server.test.ts src/agent/AgentExplorer.layout.test.ts src/agent/api.test.ts
node --import tsx --test --test-name-pattern "Epoch routes persist canonical events and hydrate progress|unified agent briefing|progress action eligibility|archived identities|claimable|operator-created inventory items|crafts inventory items|shop purchases|inventory items|personality drift|pending downtime|downtime rewards" ../agent-server/test/server.test.ts src/agent/AgentExplorer.layout.test.ts src/agent/api.test.ts
node --import tsx --test --test-name-pattern "market view exposes restrictions|releases operator market risk restrictions|market risk release rejects|regional economy orders|server-calculated market fees|market orders transfer|direct trades escrow|direct trade expiry|same-explorer market self-dealing" ../agent-server/test/server.test.ts src/agent/AgentExplorer.layout.test.ts src/agent/api.test.ts
node --import tsx --test --test-name-pattern "canonical region leaderboards|regional economy orders|server-derived frontlines|faction-scale pressure|region panel surfaces the server-derived region leaderboard|region panel surfaces regional market summary|region panel surfaces server-derived faction pressure" ../agent-server/test/server.test.ts src/agent/AgentExplorer.layout.test.ts
node --import tsx --test --test-name-pattern "canonical region leaderboards|regional economy orders|server-derived frontlines|owner-authorized party runs through API, region info|requires web-confirmed one-time tokens|region panel surfaces the server-derived region leaderboard|region panel surfaces server-derived frontlines|region panel surfaces server downtime activities|player waiting mode" ../agent-server/test/server.test.ts src/agent/AgentExplorer.layout.test.ts
node --import tsx --test --test-name-pattern "organization membership feeds region frontlines|server-derived frontlines|server-derived raid heat|server-derived raid target recommendations|server-derived faction pressure|faction-scale pressure" ../agent-server/test/server.test.ts src/agent/AgentExplorer.layout.test.ts
node --import tsx --test --test-name-pattern "static media assets|media assets|server-packaged|asset" ../agent-server/test/server.test.ts
node --import tsx --test --test-name-pattern "Streamable MCP|MCP proxy persists|mcp/tools/list|install manifest" ../agent-server/test/server.test.ts
node --import tsx --test --test-name-pattern "install page|install manifest|install-status|host-config|package/|host MCP configs" ../agent-server/test/server.test.ts
node --import tsx --test --test-name-pattern "public agent, region and NPC|archives ended identities|explorer profile dashboard|public world overview" ../agent-server/test/server.test.ts
node --import tsx --test --test-name-pattern "seasonal faction campaigns|redacted high-impact Epoch audit|audit can filter market trades|records operator risk review|risk review rejects" ../agent-server/test/server.test.ts
node --import tsx --test --test-name-pattern "abuse score restriction|operator can release an abuse score restriction|operator can inspect global abuse profiles|operator GET routes|operator overview aggregates|operator maintenance run|maintenance run processes queued server-hosted jobs|operator-gated Epoch moderation" ../agent-server/test/server.test.ts
node --import tsx --test --test-name-pattern "market view exposes restrictions|releases operator market risk restrictions|market risk release rejects|operator-created inventory items|crafts inventory items|shop purchases|same-explorer market self-dealing|market orders transfer|direct trades escrow|direct trade expiry" ../agent-server/test/server.test.ts
node --import tsx --test --test-name-pattern "seasonal faction campaigns|runtime region info exposes faction-scale pressure|operator maintenance run" ../agent-server/test/server.test.ts
node --import tsx --test --test-name-pattern "operator GET routes accept operator key headers instead of query secrets|operator GET routes reject query-string operator keys|attested runner|server-hosted|hosted sessions include social options|requires web-confirmed" ../agent-server/test/server.test.ts
node --import tsx --test --test-name-pattern "HTTP downgrades forged trust on high-value confirmation requests|HTTP requires web-confirmed one-time tokens for world speech|HTTP persists high-value confirmation inbox records for restart hydration|HTTP renders public world overview with news, result pages and archives|HTTP public install page surfaces recent world news and legendary deaths|HTTP Epoch routes persist canonical events and hydrate progress|HTTP lore contribution rejects other explorers reusing nonEvidence starter events" ../agent-server/test/server.test.ts
node --import tsx --test --test-name-pattern "moderation risk rules|delegates moderation|repeat direct trades auto-escalate" ../agent-server/test/moderationRiskRules.test.ts ../agent-server/test/gameCore-boundaries.test.ts ../agent-server/test/epoch-game-core.test.ts
node --import tsx --test --test-name-pattern "risk review|market view exposes restrictions|direct trades escrow" ../agent-server/test/server.test.ts ../agent-server/test/mcp.test.ts ../agent-server/test/epoch-game-core.test.ts
node --import tsx --test --test-name-pattern "market trade rules|market trade fee" ../agent-server/test/marketTradeRules.test.ts ../agent-server/test/gameCore-boundaries.test.ts
node --import tsx --test --test-name-pattern "market orders|market view exposes restrictions|regional economy orders|same-explorer market self-dealing|server-calculated market fees|market-listed inventory items" ../agent-server/test/epoch-game-core.test.ts ../agent-server/test/server.test.ts src/agent/api.test.ts
node --import tsx --test --test-name-pattern "bounty rules|bounty payload|bounty" ../agent-server/test/bountyRules.test.ts ../agent-server/test/gameCore-boundaries.test.ts ../agent-server/test/epoch-game-core.test.ts ../agent-server/test/server.test.ts ../agent-server/test/mcp.test.ts
node --import tsx --test --test-name-pattern "HTTP exposes escrowed bounty creation and server-settled claims|HTTP exposes server-spawned resource nodes with recovery-authorized contests|HTTP exposes server-spawned anomaly chains with recovery-authorized focus contests|HTTP confirms personality drift proposals after anomaly scars|HTTP Epoch routes persist canonical events and hydrate progress|HTTP result pages expose server-settled regional conflict context" ../agent-server/test/server.test.ts
node --import tsx --test --test-name-pattern "HTTP exposes server-created NPC relationships through region routes|HTTP downgrades forged public client trust on identity and NPC notes|HTTP NPC lifecycle tick rejects idempotency replay with changed payload|HTTP updates and renders server-authoritative agent NPC bonds|HTTP submits story NPC candidates before canonical promotion|HTTP stratifies agent memory so unreviewed flavor claims never become confirmed truth|HTTP exposes server-created NPC memories through region routes|HTTP exposes server-created NPC households through region routes|HTTP exposes server-created NPC organizations careers and locations|HTTP operator can create organizations before NPC lifecycle seeds them|HTTP owner-authorized organization membership feeds region frontlines|HTTP purchases organization upgrades from server-owned treasury|HTTP contributes member resources to organization treasury|HTTP proposes and resolves organization budgets through treasury governance|HTTP exposes social hooks and hosted sessions include social options|HTTP region info and public region page expose server-derived frontlines" ../agent-server/test/server.test.ts
node --import tsx --test --test-name-pattern "HTTP Epoch routes persist canonical events and hydrate progress|HTTP install smoke flow proves identity turn result and public dashboard|HTTP result pages expose continuation actions and regional context" ../agent-server/test/server.test.ts
node --import tsx --test --test-name-pattern "HTTP diplomacy routes require both owners and publish canonical diplomacy chains|HTTP exposes owner-authorized party runs through API, region info, and region page|HTTP owner can win released region control through revolt battle|HTTP raid resolution rejects immediate pair cooldown before repeat rewards|HTTP risky turn exhaustion archives after starter protection is consumed|HTTP result pages expose continuation actions and regional context|HTTP install smoke flow proves identity turn result and public dashboard|HTTP requires web-confirmed one-time tokens for world speech|HTTP Epoch routes persist canonical events and hydrate progress" ../agent-server/test/server.test.ts
node --import tsx --test --test-name-pattern "context package and legacy run ticket|archives local reports without runTicket|HTTP submit uses|HTTP submit requires|HTTP submit rejects|candidateClaims|item-use|expired run tickets|run settlement persists|run heartbeat refreshes|legacy run submissions|queues legacy review|outbox dead letters|JSONL records hydrate issued tickets|persistence records mutable ledger|JSONL records hydrate community|versioned public world context contract|renders public world overview" ../agent-server/test/server.test.ts
node --import tsx --test src/agent/AgentExplorer.layout.test.ts
node --import tsx --test --test-name-pattern "private direct trades|archived identities" src/agent/AgentExplorer.layout.test.ts
node --import tsx --test --test-name-pattern "direct trade rules|direct trade asset" ../agent-server/test/directTradeRules.test.ts ../agent-server/test/gameCore-boundaries.test.ts
node --import tsx --test --test-name-pattern "direct trades escrow|direct trade expiry|market-listed inventory items cannot be offered|repeat direct trades|lock unbound offered items" ../agent-server/test/epoch-game-core.test.ts ../agent-server/test/server.test.ts ../agent-server/test/mcp.test.ts
node --import tsx --test --test-name-pattern "party runs" src/agent/AgentExplorer.layout.test.ts
node --import tsx --test --test-name-pattern "retaliation|region control|archived identities" src/agent/AgentExplorer.layout.test.ts
node --import tsx --test --test-name-pattern "archived identities|hosted and web bridge|server-hosted action|turn-card|authorship confirmation" src/agent/AgentExplorer.layout.test.ts
node --import tsx --test ../agent-server/test/install-smoke-command.test.ts
node --import tsx --test ../agent-server/test/release-rehearsal-command.test.ts
node --import tsx --test ../agent-server/test/packageArchive.test.ts
node --import tsx --test ../agent-server/test/httpErrorResponse.test.ts ../agent-server/test/no-js-gate.test.ts
node --import tsx --test ../agent-server/test/httpRequestResponse.test.ts ../agent-server/test/httpErrorResponse.test.ts
node --import tsx --test ../agent-server/test/runtimeAuth.test.ts ../agent-server/test/runtime-boundaries.test.ts
node --import tsx --test ../agent-server/test/explorerAuthRuntime.test.ts ../agent-server/test/runtimeAuth.test.ts ../agent-server/test/runtime-boundaries.test.ts
node --import tsx --test --test-name-pattern "HTTP rotates explorer recovery code and revokes the old credential|HTTP Web LLM bridge rejects recovery material in browser-copy text" ../agent-server/test/server.test.ts
node --import tsx --test --test-name-pattern "MCP rotates explorer recovery code and revokes the old credential" ../agent-server/test/mcp.test.ts
node --import tsx --test ../agent-server/test/runtimeAbuseRuntime.test.ts ../agent-server/test/runtime-boundaries.test.ts
node --import tsx --test --test-name-pattern "HTTP Epoch routes return 429 when public abuse limits are exceeded|HTTP abuse score restriction blocks new writes after cooldown recovery|HTTP operator can release an abuse score restriction without erasing audit history" ../agent-server/test/server.test.ts
node --import tsx --test --test-name-pattern "MCP Epoch state changes enforce abuse limits without blocking reads or idempotent replay|MCP abuse score restriction blocks new writes after cooldown recovery|MCP operator can release an abuse score restriction without erasing audit history" ../agent-server/test/mcp.test.ts
node --import tsx --test ../agent-server/test/runtimeIdempotencyRuntime.test.ts ../agent-server/test/idempotencyRules.test.ts ../agent-server/test/runtime-boundaries.test.ts
node --import tsx --test --test-name-pattern "idempotency replay|changed payload|idempotency|web-confirmed one-time|requires explorer recovery authorization" ../agent-server/test/mcp.test.ts ../agent-server/test/server.test.ts ../agent-server/test/epoch-game-core.test.ts
node --import tsx --test ../agent-server/test/runtime-boundaries.test.ts
node --import tsx --test --test-name-pattern "agent briefing|world overview|public world|hosted session|lore contribution|lore target|world lore|hosted watch" ../agent-server/test/server.test.ts ../agent-server/test/mcp.test.ts src/agent/api.test.ts
node --import tsx --test ../agent-server/test/highValueConfirmationRules.test.ts ../agent-server/test/runtime-boundaries.test.ts
node --import tsx --test ../agent-server/test/highValueConfirmationRuntime.test.ts ../agent-server/test/highValueConfirmationRules.test.ts ../agent-server/test/runtime-boundaries.test.ts
node --import tsx --test ../agent-server/test/attestationRuntime.test.ts ../agent-server/test/runtime-boundaries.test.ts
node --import tsx --test ../agent-server/test/resultPageRuntimeStore.test.ts ../agent-server/test/runtime-boundaries.test.ts
node --import tsx --test ../agent-server/test/resultPageRuntimeRules.test.ts ../agent-server/test/runtime-boundaries.test.ts
node --import tsx --test ../agent-server/test/serverHostedRuntime.test.ts ../agent-server/test/runtime-boundaries.test.ts
node --import tsx --test ../agent-server/test/maintenance.test.ts ../agent-server/test/runtime-boundaries.test.ts ../agent-server/test/mcp.test.ts --test-name-pattern "maintenance|server-hosted|operator maintenance run|runtime delegates maintenance"
node --import tsx --test ../agent-server/test/anomalyEventTemplateRules.test.ts ../agent-server/test/runtime-boundaries.test.ts
node --import tsx --test ../agent-server/test/runtimeCommandContextRules.test.ts ../agent-server/test/runtime-boundaries.test.ts ../agent-server/test/highValueConfirmationRuntime.test.ts ../agent-server/test/maintenance.test.ts
node --import tsx --test ../agent-server/test/runtimePublicProjectionRules.test.ts ../agent-server/test/runtime-boundaries.test.ts
node --import tsx --test ../agent-server/test/runtimeInputSafetyRules.test.ts ../agent-server/test/runtime-boundaries.test.ts
node --import tsx --test ../agent-server/test/regionNewsDraftRules.test.ts ../agent-server/test/runtime-boundaries.test.ts
node --import tsx --test ../agent-server/test/resultPageReceiptRules.test.ts ../agent-server/test/runtime-boundaries.test.ts
node --import tsx --test ../agent-server/test/turnActionEnvelopeRules.test.ts ../agent-server/test/gameCore-boundaries.test.ts
node --import tsx --test ../agent-server/test/turnHostedActionRules.test.ts ../agent-server/test/gameCore-boundaries.test.ts
node --import tsx --test ../agent-server/test/sourceEventRules.test.ts ../agent-server/test/gameCore-boundaries.test.ts ../agent-server/test/runtime-boundaries.test.ts
node --import tsx --test ../agent-server/test/loreContributionRules.test.ts ../agent-server/test/gameCore-boundaries.test.ts ../agent-server/test/mcp.test.ts --test-name-pattern "lore contribution|creature behavior|fuzzy time|cross-region|canon candidate|delegates lore contribution"
node --import tsx --test ../agent-server/test/resourceNodeRules.test.ts ../agent-server/test/encounterRules.test.ts ../agent-server/test/commandAbuseRules.test.ts ../agent-server/test/agentInteractionRules.test.ts ../agent-server/test/npcCandidateRules.test.ts ../agent-server/test/loreReadModel.test.ts ../agent-server/test/loreProvenanceRules.test.ts ../agent-server/test/sourceEventRules.test.ts ../agent-server/test/gameCore-boundaries.test.ts ../agent-server/test/runtime-boundaries.test.ts
node --import tsx --test --test-name-pattern "agent interaction rules|relationships and hosted social interaction rules|diplomacy routes|server-authoritative agent NPC bonds" ../agent-server/test/agentInteractionRules.test.ts ../agent-server/test/gameCore-boundaries.test.ts ../agent-server/test/epoch-game-core.test.ts
node --import tsx --test --test-name-pattern "encounter rules|objective and anomaly|HTTP exposes server-spawned anomaly chains" ../agent-server/test/encounterRules.test.ts ../agent-server/test/gameCore-boundaries.test.ts ../agent-server/test/epoch-game-core.test.ts
node --import tsx --test --test-name-pattern "resource node rules|resource node scoring|HTTP exposes server-spawned resource nodes" ../agent-server/test/resourceNodeRules.test.ts ../agent-server/test/gameCore-boundaries.test.ts ../agent-server/test/epoch-game-core.test.ts
node --import tsx --test --test-name-pattern "canonicalized NPC payloads|event sequences|delegates NPC candidate" ../agent-server/test/npcCandidateRules.test.ts ../agent-server/test/gameCore-boundaries.test.ts
node --import tsx --test --test-name-pattern "lifecycle rules select|event sequences|delegates NPC lifecycle" ../agent-server/test/npcLifecycleRules.test.ts ../agent-server/test/gameCore-boundaries.test.ts
node --import tsx --test ../agent-server/test/seasonCampaignRules.test.ts ../agent-server/test/gameCore-boundaries.test.ts ../agent-server/test/epoch-game-core.test.ts
node --import tsx --test --test-name-pattern "season campaign rules|season contribution scoring|seasonal faction campaigns|owner can win released region control through revolt battle" ../agent-server/test/seasonCampaignRules.test.ts ../agent-server/test/gameCore-boundaries.test.ts ../agent-server/test/epoch-game-core.test.ts
node --import tsx --test ../agent-server/test/marketTradeRules.test.ts ../agent-server/test/gameCore-boundaries.test.ts ../agent-server/test/epoch-game-core.test.ts
node --import tsx --test ../agent-server/test/directTradeRules.test.ts ../agent-server/test/gameCore-boundaries.test.ts ../agent-server/test/epoch-game-core.test.ts
node --import tsx --test ../agent-server/test/bountyRules.test.ts ../agent-server/test/directTradeRules.test.ts ../agent-server/test/gameCore-boundaries.test.ts ../agent-server/test/epoch-game-core.test.ts
node --import tsx --test ../agent-server/test/organizationTreasuryRules.test.ts ../agent-server/test/gameCore-boundaries.test.ts ../agent-server/test/epoch-game-core.test.ts
node --import tsx --test --test-name-pattern "downtime rules plan set payloads|game core delegates downtime" ../agent-server/test/downtimeRules.test.ts ../agent-server/test/gameCore-boundaries.test.ts
node --import tsx --test --test-name-pattern "legend award rules|game core delegates legend" ../agent-server/test/legendAwardRules.test.ts ../agent-server/test/gameCore-boundaries.test.ts
node --import tsx --test --test-name-pattern "region news mention lets the mentioned agent claim legend once|news legend claims reject|HTTP Epoch routes persist canonical events and hydrate progress|MCP Epoch tools expose server-issued identity, downtime, NPC and event progress|Agent console surfaces server-derived claimable legend news" ../agent-server/test/epoch-game-core.test.ts ../agent-server/test/server.test.ts ../agent-server/test/mcp.test.ts src/agent/AgentExplorer.layout.test.ts
node --import tsx --test ../agent-server/test/inventoryRules.test.ts ../agent-server/test/gameCore-boundaries.test.ts ../agent-server/test/epoch-game-core.test.ts
node --import tsx --test ../agent-server/test/identityLifecycleRules.test.ts ../agent-server/test/gameCore-boundaries.test.ts ../agent-server/test/epoch-game-core.test.ts
node --import tsx --test ../agent-server/test/moderationRiskRules.test.ts ../agent-server/test/gameCore-boundaries.test.ts ../agent-server/test/epoch-game-core.test.ts
node --import tsx --test ../agent-server/test/combatSettlementRules.test.ts ../agent-server/test/gameCore-boundaries.test.ts ../agent-server/test/epoch-game-core.test.ts
node --import tsx --test --test-name-pattern "combat settlement rules|party and raid settlement|party runs|owner-authorized party runs" ../agent-server/test/combatSettlementRules.test.ts ../agent-server/test/gameCore-boundaries.test.ts ../agent-server/test/epoch-game-core.test.ts ../agent-server/test/server.test.ts src/agent/AgentExplorer.layout.test.ts
node --import tsx --test --test-name-pattern "combat settlement rules|party and raid settlement|HTTP raid resolution|HTTP owner can win released region control through revolt battle" ../agent-server/test/combatSettlementRules.test.ts ../agent-server/test/gameCore-boundaries.test.ts ../agent-server/test/epoch-game-core.test.ts
node --import tsx --test ../agent-server/test/resultPageNavigationRules.test.ts ../agent-server/test/runtime-boundaries.test.ts
node --import tsx --test ../agent-server/test/resultPageContextRules.test.ts ../agent-server/test/runtime-boundaries.test.ts
node --import tsx --test ../agent-server/test/resultPagePayloadRules.test.ts ../agent-server/test/runtime-boundaries.test.ts
node --import tsx --test ../agent-server/test/explorationRuntime.test.ts ../agent-server/test/runtime-boundaries.test.ts
node --import tsx --test ../agent-server/test/regionNewsReadModel.test.ts ../agent-server/test/runtime-boundaries.test.ts
node --import tsx --test ../agent-server/test/shopReadModel.test.ts ../agent-server/test/runtime-boundaries.test.ts
node --import tsx --test ../agent-server/test/regionMediaReadModel.test.ts ../agent-server/test/runtime-boundaries.test.ts
node --import tsx --test ../agent-server/test/relationshipReadModel.test.ts ../agent-server/test/runtime-boundaries.test.ts
node --import tsx --test ../agent-server/test/npcStateReadModel.test.ts ../agent-server/test/runtime-boundaries.test.ts
node --import tsx --test ../agent-server/test/organizationReadModel.test.ts ../agent-server/test/runtime-boundaries.test.ts
node --import tsx --test ../agent-server/test/encounterReadModel.test.ts ../agent-server/test/runtime-boundaries.test.ts ../agent-server/test/regionCommissionReadModel.test.ts
node --import tsx --test ../agent-server/test/bountyPartyReadModel.test.ts ../agent-server/test/runtime-boundaries.test.ts ../agent-server/test/regionCommissionReadModel.test.ts
node --import tsx --test ../agent-server/test/regionMonumentReadModel.test.ts ../agent-server/test/runtime-boundaries.test.ts ../agent-server/test/regionCommissionReadModel.test.ts
node --import tsx --test ../agent-server/test/seasonReadModel.test.ts ../agent-server/test/runtime-boundaries.test.ts
node --import tsx --test ../agent-server/test/hostedSessionReadModel.test.ts ../agent-server/test/runtime-boundaries.test.ts
node --import tsx --test ../agent-server/test/webBridgeReadModel.test.ts ../agent-server/test/runtime-boundaries.test.ts
node --import tsx --test ../agent-server/test/identityArchiveReadModel.test.ts ../agent-server/test/runtime-boundaries.test.ts
node --import tsx --test ../agent-server/test/resultPageReceiptRules.test.ts ../agent-server/test/runtime-boundaries.test.ts
node --import tsx --test ../agent-server/test/regionCommissionReadModel.test.ts ../agent-server/test/runtime-boundaries.test.ts
node --import tsx --test --test-name-pattern "relationship|household|NPC|region panel|social relationship media|agent NPC" ../agent-server/test/server.test.ts ../agent-server/test/mcp.test.ts src/agent/AgentExplorer.layout.test.ts
node --import tsx --test --test-name-pattern "NPC lifecycle|NPC memories|NPC households|NPC organizations careers and locations|NPC health|NPC asset|social hooks|region panel|public agent, region and NPC" ../agent-server/test/server.test.ts ../agent-server/test/mcp.test.ts src/agent/AgentExplorer.layout.test.ts
node --import tsx --test --test-name-pattern "organization|diplomacy|region panel|frontlines|social hooks|budget|treasury" ../agent-server/test/server.test.ts ../agent-server/test/mcp.test.ts src/agent/AgentExplorer.layout.test.ts src/agent/api.test.ts
node --import tsx --test --test-name-pattern "objective|resource node|anomaly|resource nodes|anomalies|encounter|region commission|region panel" ../agent-server/test/server.test.ts ../agent-server/test/mcp.test.ts ../agent-server/test/epoch-game-core.test.ts src/agent/AgentExplorer.layout.test.ts src/agent/api.test.ts
node --import tsx --test --test-name-pattern "bounty|party run|party runs|region commission|region panel" ../agent-server/test/server.test.ts ../agent-server/test/mcp.test.ts ../agent-server/test/epoch-game-core.test.ts src/agent/AgentExplorer.layout.test.ts src/agent/api.test.ts
node --import tsx --test --test-name-pattern "monument|monuments|region control|seasonal faction campaigns|season settlement|region panel" ../agent-server/test/server.test.ts ../agent-server/test/mcp.test.ts ../agent-server/test/epoch-game-core.test.ts src/agent/AgentExplorer.layout.test.ts src/agent/api.test.ts
node --import tsx --test --test-name-pattern "season|seasonal faction campaigns|season settlement|season contribution|region control|monument|region panel" ../agent-server/test/server.test.ts ../agent-server/test/mcp.test.ts ../agent-server/test/epoch-game-core.test.ts src/agent/AgentExplorer.layout.test.ts src/agent/api.test.ts
node --import tsx --test --test-name-pattern "region commission|location motif|commission|region panel|public region|open commissions|chapter locks|prefile" ../agent-server/test/server.test.ts ../agent-server/test/mcp.test.ts src/agent/AgentExplorer.layout.test.ts src/agent/api.test.ts
node --import tsx --test --test-name-pattern "result page|result panel|agent briefing|unified progress and regional context|continuation actions|regional context|identity profile|world overview" ../agent-server/test/server.test.ts ../agent-server/test/mcp.test.ts src/agent/AgentExplorer.layout.test.ts src/agent/api.test.ts
AGENT_INSTALL_SMOKE_SEED=test_install_smoke npm run agent:install-smoke -- --json
npm test
npm run build:export
```

Remaining follow-up work:

- Continue decomposing `gameCore.ts` and `runtime.ts` by domain instead of adding more logic to the existing large files.
- Continue the runtime split after `agentMemoryReadModel.ts`, `npcCandidateReadModel.ts`, `npcCandidateRuntime.ts`, `npcLifecycleRuntime.ts`, `npcStateReadModel.ts`, `organizationReadModel.ts`, `organizationNpcReadModel.ts`, `encounterReadModel.ts`, `encounterRuntimeReadModel.ts`, `economyRuntimeReadModel.ts`, `seasonRuntimeReadModel.ts`, `combatRuntimeReadModel.ts`, `socialRuntimeReadModel.ts`, `activityRuntimeReadModel.ts`, `hostedSessionRuntimeReadModel.ts`, `identityRuntimeReadModel.ts`, `operatorRuntimeReadModel.ts`, `bountyPartyReadModel.ts`, `regionMonumentReadModel.ts`, `seasonReadModel.ts`, `hostedSessionReadModel.ts`, `webBridgeReadModel.ts`, `identityArchiveReadModel.ts`, `personalMigrationReadModel.ts`, `explorerProfileReadModel.ts`, `auditReadModel.ts`, `actionEligibilityReadModel.ts`, `maintenanceReadModel.ts`, `marketReadModel.ts`, `shopReadModel.ts`, `regionLeaderboardReadModel.ts`, `regionActivityReadModel.ts`, `regionConflictReadModel.ts`, `regionMediaReadModel.ts`, `regionNewsReadModel.ts`, `regionNewsDraftRules.ts`, `regionNewsRuntime.ts`, `relationshipReadModel.ts`, `regionCommissionReadModel.ts`, `regionInfoReadModel.ts`, `operatorOverviewReadModel.ts`, `progressReadModel.ts`, `publicWorldReadModel.ts`, `runtimeAuth.ts`, `explorerAuthRuntime.ts`, `runtimeAbuseRuntime.ts`, `runtimeIdempotencyRuntime.ts`, `runtimeCommandContextRules.ts`, `runtimeInputRules.ts`, `runtimeInputSafetyRules.ts`, `runtimePublicProjectionRules.ts`, `idempotencyRules.ts`, `highValueConfirmationRules.ts`, `highValueConfirmationRuntime.ts`, `attestationRuntime.ts`, `resultPageRuntimeRules.ts`, `resultPageRuntimeStore.ts`, `resultPageNavigationRules.ts`, `resultPageContextRules.ts`, `resultPagePayloadRules.ts`, `explorationRuntime.ts`, `resultPageReceiptRules.ts`, `serverHostedRuntimeRules.ts`, `serverHostedRuntime.ts`, `maintenanceRuntime.ts`, `downtimeRuntime.ts`, `anomalyEventTemplateRules.ts`, `sourceEventRules.ts`, `loreProvenanceRules.ts`, and `loreReadModel.ts`; the strongest remaining runtime work is now write-flow/state orchestration and residual endpoint glue rather than pure read-model/auth/rule-helper extraction.
- Continue the `gameCore.ts` split after `downtimeRules.ts`, `identityLifecycleRules.ts`, `moderationRiskRules.ts`, `inventoryRules.ts`, `resourceRules.ts`, `legendAwardRules.ts`, `organizationTreasuryRules.ts`, `combatSettlementRules.ts`, `eventFactory.ts`, `resourceLedgerEvents.ts`, `regionEventLedgerEvents.ts`, `inventoryItemLedgerEvents.ts`, `turnActionEnvelopeRules.ts`, `turnHostedActionRules.ts`, `serverHostedRuntimeRules.ts`, `sourceEventRules.ts`, `loreProvenanceRules.ts`, `loreContributionRules.ts`, `npcCandidateRules.ts`, `npcLifecycleRules.ts`, `agentInteractionRules.ts`, `commandAbuseRules.ts`, `encounterRules.ts`, `resourceNodeRules.ts`, `seasonCampaignRules.ts`, `marketTradeRules.ts`, `directTradeRules.ts`, and `bountyRules.ts`; the next likely seams are remaining domain-specific event payload assembly, write-flow orchestration helpers, and frontend state/effect extraction.
- Promote `GameRunReadModel` beyond result pages/world overview into a canonical run projection for additional gameplay queries.
- Add explicit SQLite projection rebuild tests for read models beyond result pages.
- Continue unifying owner-only private information copy, and split remaining HTTP bridge code out of `httpServer.ts` now that result, identity, agent profile/briefing, asset, MCP, install, public world, audit/season archive, operator control-plane, economy, season campaign API, hosted/web-bridge, server-hosted job, attestation, narrative, encounter, society, gameplay, legacy runtime routes, HTTP error response policy, request parsing, base URL resolution, response sending, and CORS helpers are delegated. Remaining HTTP risk is now mostly health/bootstrap and persistence/audit bridge code still owned by the central server.
- Continue front-end component/controller extraction after `ResultNavigation`, `GameRunTimeline`, `PublicReceiptDisclosure`, `WorldOverviewPanel`, `WorldOverviewRecentResults`, `PublicWorldPanel`, `ResourcePanel`, `InventoryPanel`, `MarketPanel`, `DirectTradePanel`, `OrganizationPanel`, `EncounterPanel`, `BountyPanel`, `PartyRunPanel`, `RaidRetaliationPanel`, `SeasonPanel`, `RelationshipDiplomacyPanel`, `RegionOverviewPanel`, `TurnHostedActionPanel`, `agentPlayerLabels`, `agentActionController`, `agentPlayerActionReadinessController`, `agentInstallReadinessController`, `agentProgressController`, and `agentRegionController`; player-facing labels/tool catalogs, action status handling, player primary action disabled-reason projection, install readiness projection, progress refresh API aggregation, plus full-region and slice-overridden region snapshot commits are now outside the container, while the strongest remaining seam is still the cross-domain form state and effect container in `AgentExplorer.tsx`.
- Front-end bundle warning is resolved by lazy chunks: index 213.33 kB, AgentExplorer 245.92 kB, WorldMapScene 555.21 kB after minification. Later performance work should focus on CSS payload and additional domain-level lazy loading only if measured load time calls for it.

## File Structure

Create:

- `tools/agent-server/lib/epoch/publicVocabulary.ts`: shared server-side public labels and internal-token scrubber.
- `tools/agent-server/lib/epoch/publicResultViewModel.ts`: converts `EpochResultPagePayload` into a player-facing result page ViewModel.
- `tools/agent-server/lib/epoch/gameRunReadModel.ts`: projects result pages into reusable run-level read models.
- `tools/agent-server/lib/epoch/agentMemoryReadModel.ts`: stratified agent memory read model for confirmed, rumor, and private-run NPC candidate memories.
- `tools/agent-server/lib/epoch/npcCandidateReadModel.ts`: shared NPC candidate projection helpers used by runtime views.
- `tools/agent-server/lib/epoch/personalMigrationReadModel.ts`: personal lore migration classification and summary buckets.
- `tools/agent-server/lib/epoch/explorerProfileReadModel.ts`: explorer profile aggregation, identity slot state, resource totals, and public profile links.
- `tools/agent-server/lib/epoch/auditReadModel.ts`: audit replay, risk review summaries, event redaction, and audit risk profiles.
- `tools/agent-server/lib/epoch/actionEligibilityReadModel.ts`: active/archived/missing identity action eligibility and tool recommendation projection.
- `tools/agent-server/lib/epoch/maintenanceReadModel.ts`: maintenance event summaries, worker health, stale checks, and overview projection.
- `tools/agent-server/lib/epoch/marketReadModel.ts`: market order filtering, direct trade filtering, regional market summaries, and market risk restriction projections.
- `tools/agent-server/lib/epoch/shopReadModel.ts`: public shop offer item-media projection.
- `tools/agent-server/lib/epoch/regionLeaderboardReadModel.ts`: region influence leaderboard scoring, trust breakdown, and ranking projection.
- `tools/agent-server/lib/epoch/regionActivityReadModel.ts`: region activity, influence change, message, and active-agent projections.
- `tools/agent-server/lib/epoch/regionConflictReadModel.ts`: traces, raids, retaliations, raid heat, raid target recommendations, faction pressure, and frontline projections.
- `tools/agent-server/lib/epoch/regionMediaReadModel.ts`: public region location media projection.
- `tools/agent-server/lib/epoch/regionNewsReadModel.ts`: public region news filtering, sorting, and world-news media projection.
- `tools/agent-server/lib/epoch/relationshipReadModel.ts`: relationship, NPC relationship, agent-NPC bond, and household media projections.
- `tools/agent-server/lib/epoch/npcStateReadModel.ts`: NPC memory, career, location, asset, health, and social-hook projections.
- `tools/agent-server/lib/epoch/organizationReadModel.ts`: diplomacy, organization membership/list/politics, treasury ledger, and influence score projections.
- `tools/agent-server/lib/epoch/encounterReadModel.ts`: objective, resource-node, and anomaly sorting/filtering projections shared by runtime and region commission views.
- `tools/agent-server/lib/epoch/bountyPartyReadModel.ts`: bounty and party-run sorting/filtering projections plus public party invite-token redaction shared by runtime and region commission views.
- `tools/agent-server/lib/epoch/regionMonumentReadModel.ts`: region monument sorting/filtering projections shared by runtime and region commission views.
- `tools/agent-server/lib/epoch/seasonReadModel.ts`: season campaign filtering/sorting/media decoration plus season contribution audit groups and daily totals.
- `tools/agent-server/lib/epoch/hostedSessionReadModel.ts`: hosted session filtering/sorting, public action/session redaction, and watch-page next-action projection for public lists and watch views.
- `tools/agent-server/lib/epoch/webBridgeReadModel.ts`: Web Bridge action option projection, prompt layer construction, copy prompt generation, and turn view projection.
- `tools/agent-server/lib/epoch/identityArchiveReadModel.ts`: archived identity lineage, resources, archive/reincarnation event lookup, and public archive link projection.
- `tools/agent-server/lib/epoch/regionCommissionReadModel.ts`: region commission source projection, location motif quotas, secret exposure, reveal budget, prefile isolation, and location motif bias display rules.
- `tools/agent-server/lib/epoch/operatorOverviewReadModel.ts`: operator overview aggregation for moderation, abuse profiles, growth guardrails, operator health, attested runners, NPC candidate review, maintenance, and audit slices.
- `tools/agent-server/lib/epoch/progressReadModel.ts`: identity progress, inventory media, equipment effects, pending downtime, claimable legend news, personality drift, and latest-event projections.
- `tools/agent-server/lib/epoch/publicWorldReadModel.ts`: public world overview, agent briefing, hosted-session watch, lore portal, world context version, and public limit aggregation with runtime-injected projection/time/result-page adapters.
- `tools/agent-server/lib/epoch/regionInfoReadModel.ts`: region detail and NPC detail aggregation for public/API views, including region media, news, activity, market/conflict slices, and NPC organization/career/memory/household/location/health/asset/social-hook summaries.
- `tools/agent-server/lib/epoch/organizationNpcReadModel.ts`: organization, organization-politics, NPC career/location/asset/health/social-hook/household/memory/relationship, and agent-NPC bond runtime read wrappers over the focused organization/NPC/relationship read models.
- `tools/agent-server/lib/epoch/encounterRuntimeReadModel.ts`: runtime read wrappers for objectives, resource nodes, and anomaly chains over the shared `encounterReadModel.ts` projections.
- `tools/agent-server/lib/epoch/economyRuntimeReadModel.ts`: runtime read wrappers for inventory, shop offers, market orders, direct trades, and market restrictions over the focused progress/shop/market read models.
- `tools/agent-server/lib/epoch/seasonRuntimeReadModel.ts`: runtime read wrappers for season lists, season archives, and season command result view wrapping over the focused `seasonReadModel.ts` projections.
- `tools/agent-server/lib/epoch/combatRuntimeReadModel.ts`: runtime read wrappers for bounty lists, party-run lists, and raid lists over the focused bounty/party and region-conflict read models.
- `tools/agent-server/lib/epoch/socialRuntimeReadModel.ts`: runtime read wrappers for relationship graph and diplomacy lists over the focused relationship and organization read models.
- `tools/agent-server/lib/epoch/activityRuntimeReadModel.ts`: runtime read wrappers for event history, identity progress, and messages over the focused progress and region-activity read models.
- `tools/agent-server/lib/epoch/hostedSessionRuntimeReadModel.ts`: runtime read wrapper for hosted session lists over the focused public hosted-session read model and shared public limit/status rules.
- `tools/agent-server/lib/epoch/identityRuntimeReadModel.ts`: runtime read wrappers for agent memory, personal migration, identity archives, and explorer profiles over the focused identity/profile read models.
- `tools/agent-server/lib/epoch/operatorRuntimeReadModel.ts`: runtime read wrappers for audit, abuse profiles, moderation queues, and operator overview aggregation over the focused audit/operator read models.
- `tools/agent-server/lib/epoch/runtimeAuth.ts`: explorer recovery-code parsing, local-secret hash derivation, and constant-time hash/signature comparison helpers used by runtime identity authorization.
- `tools/agent-server/lib/epoch/explorerAuthRuntime.ts`: explorer auth secret-hash state, identity/recovery event hydration, credential registration/assertion, recovery rotation, and idempotent rotation replay with runtime-injected adapters.
- `tools/agent-server/lib/epoch/runtimeAbuseRuntime.ts`: abuse rate-limit buckets, restricted-score gates, and abuse status projection with runtime-injected clock and projection adapters.
- `tools/agent-server/lib/epoch/runtimeIdempotencyRuntime.ts`: idempotent result cache, owner/subject conflict records, duplicate replay, explorer registration replay, and auth-after-idempotency sequencing with runtime-injected projection, abuse, and authorization adapters.
- `tools/graph-react-app/src/agent/agentPlayerLabels.ts`: frontend player-facing labels for tool catalogs, regions, factions, events, sources, identity/hosted/action statuses, downtime options, and public summary text cleanup.
- `tools/graph-react-app/src/agent/agentActionController.ts`: frontend async action status controller for busy gating, latest-request status, and error message propagation.
- `tools/graph-react-app/src/agent/agentPlayerActionReadinessController.ts`: frontend player primary action readiness projection for identity issuance, downtime hosting, full-run exploration, result publishing, and install-status refresh disabled reasons.
- `tools/graph-react-app/src/agent/agentInstallReadinessController.ts`: frontend install readiness projection for server, host tool, package, signing, smoke, operator, identity, idempotency, latest-request, and error labels.
- `tools/graph-react-app/src/agent/agentProgressController.ts`: frontend progress refresh controller for briefing, memory, personal migration, abuse status, and stale request suppression.
- `tools/graph-react-app/src/agent/agentRegionController.ts`: frontend full-region snapshot projection/commit helper for region state, messages, objectives, resource nodes, anomalies, seasons, diplomacy, and explicit domain-slice overrides.
- `tools/agent-server/lib/epoch/idempotencyRules.ts`: volatile credential stripping, stable idempotency subject hashing, and owner-scoped idempotency key construction.
- `tools/agent-server/lib/epoch/highValueConfirmationRules.ts`: high-value confirmation subject hash, summary, turn-card response envelope, and auth-scope action mapping helpers used by runtime confirmation state machines.
- `tools/agent-server/lib/epoch/highValueConfirmationRuntime.ts`: high-value confirmation request/confirm/list/consume state machine, token hash lookup, expiry refresh, event generation, and initial event hydration.
- `tools/agent-server/lib/epoch/attestationRuntime.ts`: attested runner registration, challenge issue/idempotency, signature base/key id/trust class helpers, signature validation, used/expired challenge state, and submit context construction.
- `tools/agent-server/lib/epoch/resultPageRuntimeRules.ts`: result page share-token hash, public/status URL, share-version, TTL, stable payload JSON, owner lookup, public-safe summary/pages, focused progress, publish request hash, create/revoke/delete idempotency keys, active/revoked/deleted page record builders, public access/expiry status, deletion classification, and minimal deletion reference helpers used by runtime result page flows.
- `tools/agent-server/lib/epoch/resultPageRuntimeStore.ts`: result page read-model ownership, publish/share token issuance, create/revoke/delete idempotency maps, publish-token consumption, owner/operator revocation authorization, public access lookup, recent-result lookup, and deletion lifecycle state.
- `tools/agent-server/lib/epoch/resultPageNavigationRules.ts`: result page next-action selection, commission action labels, action media, and safe agent self-statement fallback copy.
- `tools/agent-server/lib/epoch/resultPageContextRules.ts`: result page focused turn-card/hosted-session validation, region selection from focused cards/sessions/requested region/downtime/latest progress events, and bounded regional context projection.
- `tools/agent-server/lib/epoch/resultPagePayloadRules.ts`: result page progress, focused turn-card/session, regional context, next-action, run-summary, and receipt payload assembly with runtime-injected projection/time/config.
- `tools/agent-server/lib/epoch/explorationRuntime.ts`: one-shot multi-step exploration orchestration, safe hosted-action option selection, focus-event collection, result-page payload creation, and result-page publication with runtime-injected auth/idempotency/core adapters.
- `tools/agent-server/lib/epoch/resultPageReceiptRules.ts`: result page receipt focus selection, canonical event projection, trusted execution receipt construction, play mode, and trust-tier classification.
- `tools/agent-server/lib/epoch/serverHostedRuntimeRules.ts`: server-hosted option-key validation, command context construction, job query/list filtering/sorting, queued-job selection, and job lifecycle payload/event-sequence helpers used by runtime and game-core operator flows.
- `tools/agent-server/lib/epoch/serverHostedRuntime.ts`: server-hosted immediate action execution, action queueing, operator job listing, queued-job preflight, skip, execution, and completion orchestration with runtime-injected operator/idempotency/secret-text guards.
- `tools/agent-server/lib/epoch/maintenanceRuntime.ts`: operator maintenance run defaults, worker sequencing, resource/anomaly/season candidate selection, queued server-hosted job processing, decay summaries, and maintenance result assembly with runtime-injected operator/idempotency/core adapters.
- `tools/agent-server/lib/epoch/anomalyEventTemplateRules.ts`: anomaly template catalog, boss media asset binding, template rotation seed selection, narrative variant selection, and operator spawn input mapping used by runtime spawn/maintenance/season encounter flows.
- `tools/agent-server/lib/epoch/runtimeCommandContextRules.ts`: generic, untrusted-client, owner-verified, and maintenance command context builders shared by runtime write flows and injected sub-runtimes.
- `tools/agent-server/lib/epoch/runtimeInputRules.ts`: runtime region id normalization, hosted session status parsing, objective/season template catalogs, and abuse actor key selection used by command entrypoints and maintenance orchestration.
- `tools/agent-server/lib/epoch/runtimeInputSafetyRules.ts`: public text secret-material guard and rejected-command audit input summaries used by runtime command entrypoints and rejection events.
- `tools/agent-server/lib/epoch/runtimePublicProjectionRules.ts`: public event redaction, public projection wrapping, public command value/result wrapping, and non-enumerable internal event attachment used by runtime command flows and injected sub-runtimes.
- `tools/agent-server/lib/epoch/regionNewsDraftRules.ts`: server-event region lookup and region news headline/body/legend draft projection used by server-generated region news flows, with public-vocabulary cleanup for internal region/agent/explorer IDs.
- `tools/agent-server/lib/epoch/regionNewsRuntime.ts`: region-news source-event lookup, requested-region validation, duplicate reuse, generated-news adapter calls, and append-to-result orchestration for operator and maintenance write flows.
- `tools/agent-server/lib/epoch/identityLifecycleRules.ts`: identity issue, recovery rotation, lifetime adjustment, identity archive, reincarnation, and personality drift proposal/confirmation payload planning plus event sequence/result projection, personality drift source-event eligibility, open proposal folding, cooldown folding, and suggested trait selection.
- `tools/agent-server/lib/epoch/identityProjectionRules.ts`: identity projection reads, active identity checks, identity slot guards, explorer lineage, legend total, and active-slot calculation.
- `tools/agent-server/lib/epoch/identityAuthorizationRules.ts`: direct owner checks, user-verified owner checks, server actor owner-bypass trust classes, client-owner checks, and system-worker-only owner bypass.
- `tools/agent-server/lib/epoch/moderationRiskRules.ts`: moderation item projection reads, region news generation event sequence/result projection, message posted event sequence/result projection, moderation queue payload, moderation resolution event sequence/result projection, risk review recorded event sequence/result projection, auto risk-review escalation context/payload planning, market risk release event sequence/result projection, abuse release/decay payload planning, abuse release/decay event sequence/result projection, and abuse decay target selection/limit/amount/min-score.
- `tools/agent-server/lib/epoch/downtimeRules.ts`: downtime region normalization, reward calculation, reward grant payload planning, set/claim/tick payload planning, set/claim/tick event sequence/result projection, diary payload text, diary projection entry construction, tick target selection/limit, pending reward preview, and claim-risk warning rules shared by game core and progress views.
- `tools/agent-server/lib/epoch/eventFactory.ts`: shared game event envelope factory wiring from clock/id/context into `createEpochEvent`.
- `tools/agent-server/lib/epoch/inventoryRules.ts`: inventory item projection reads, inventory craft recipes, shop offers, item rarity normalization, regional price resolution, catalog lookup helpers, inventory equipment effect rules, inventory item create/craft/shop/bind event sequence/result projection, and item created/bound payload planning shared by game core and progress views.
- `tools/agent-server/lib/epoch/resourceLedgerEvents.ts`: common resource ledger event wrappers for all grant/spend events using the shared event factory.
- `tools/agent-server/lib/epoch/regionEventLedgerEvents.ts`: common region influence and trace event wrappers using the shared event factory.
- `tools/agent-server/lib/epoch/inventoryItemLedgerEvents.ts`: common inventory item event wrappers using the shared event factory.
- `tools/agent-server/lib/epoch/resourceRules.ts`: resource balance copy, reads, sufficient-balance checks, canonical resource grant/spend payload calculation, grant/spend event sequence/result projection, and multi-cost spend payload planning shared by game core write paths.
- `tools/agent-server/lib/epoch/legendAwardRules.ts`: region news projection reads, region-news legend award payload planning, shared legend resource grant payload/ledger amount/reason rules, and legend claim event sequence/result projection.
- `tools/agent-server/lib/epoch/organizationTreasuryRules.ts`: organization creation/membership event sequence planning, organization treasury contribution event sequence planning, organization budget proposal/resolution event sequence planning, organization upgrade purchase event sequence planning, organization creation payload, membership payload, upgrade catalog, treasury balance reads, membership/governance role checks, member treasury contribution spend payload, treasury contribution payload, upgrade treasury spend payload, upgrade purchased payload, budget thresholds, budget resolution normalization, budget proposal/vote/resolution payload planning, treasury spend payload planning, organization politics tick target selection/limit/region filtering, participant/career/source-evidence planning, organization politics template/kind/payload planning, tick event sequence planning/result projection, and multisig pending rules shared by organization write paths.
- `tools/agent-server/lib/epoch/combatSettlementRules.ts`: party run and retaliation opportunity projection reads, party lifecycle validation, invite token hashing/expiry/use-limit rules, party run created/invite/member/request/resolution event sequence/result projection and payload planning, party role scoring, party synergy/member settlement result/total-score/reward grant/influence/news bonuses, party run settlement event sequence and settled/influence/trace/news payload planning, raid cooldown/decay constants, raid pair history lookup, raid heat threshold/scoring/projection lookup, raid battle settlement, retaliation battle settlement, raid season standing power bonus, raid/retaliation stamina spend and reward grant payload planning, raid/retaliation influence/trace payload planning, and raid/retaliation payload planning shared by party/raid/retaliation write paths.
- `tools/agent-server/lib/epoch/turnActionEnvelopeRules.ts`: turn-card, turn-resolution, and hosted-action signed envelope protocol versions, stable content hashes, and release signature envelope construction.
- `tools/agent-server/lib/epoch/turnHostedActionRules.ts`: hosted/turn trust guards, turn-card expiry, sequence, and unexpired-open-card validation, turn option templates, hosted option assembly, high-risk caps, first-run settlement protection, repeatable basic reward caps, turn/hosted action payload planning, turn-card/turn-resolution/hosted-session/hosted-action event sequence planning, turn/hosted reward grant payload planning, and hosted runner attestation payload normalization.
- `tools/agent-server/lib/epoch/sourceEventRules.ts`: source event ID normalization, known-event validation, source event authority, low-authority refutation policy, source provenance, source explorer lookup, audit URL, risk-review source event lookup, and risk-review flags/score/reviewable analysis shared by game core and runtime.
- `tools/agent-server/lib/epoch/loreProvenanceRules.ts`: stable lore evidence JSON/hash, lore claim hash, contribution provenance, target adjudication provenance, authority review, and runtime provenance fallback shared by game core and runtime.
- `tools/agent-server/lib/epoch/loreContributionRules.ts`: lore contribution category/revision gates, contribution revision field normalization, contribution source ID normalization, source event lookup/missing-source validation, non-evidence reuse ownership guard, low-authority refutation gate, refutation daily quota rules, contribution record payload/event planning, target adjudication status/source ID normalization/source contribution event lookup/history folding/stable key/id link/payload/event planning, contribution focus cost and spend payload planning, experiment main-rule review, revision policy, creature behavior scope review, fuzzy time interval review, cross-region mechanism support, and canon candidate path attribution.
- `tools/agent-server/lib/epoch/npcCandidateRules.ts`: trait/review-resolution normalization, canonicalized NPC payload planning, NPC candidate rumor admission scoring, review flags/score/publication policy, ability effect clustering, submitted/reviewed payload planning, and canonicalize/submit/review event sequence planning.
- `tools/agent-server/lib/epoch/npcLifecycleRules.ts`: NPC lifecycle tick target selection/limit/region filtering, step changes, changes normalization, lifecycle event payload/sourceEventIds planning, memory summary text, organization naming, migration region derivation, household merge/source-event planning, organization membership planning, NPC memory/relationship/household/career/location/asset/health payload planning, manual lifecycle/memory event sequence planning, tick 副作用事件序列规划, and tick 结果投影折叠.
- `tools/agent-server/lib/epoch/agentInteractionRules.ts`: relationship scoring, diplomacy seed, diplomacy proposal/response focus spend payload planning, diplomacy proposed/responded payload planning, diplomacy proposal event sequence planning, diplomacy response event sequence planning, accepted diplomacy relationship/trace event sequence planning, diplomacy trace payload planning, relationship focus spend/updated payload planning, relationship update event sequence planning, child NPC bond guards, agent-NPC bond focus spend/scoring/payload planning, agent-NPC bond update event sequence planning, social hook lifecycle draft/created payload planning, hosted social hook scoring, consumed social hook reads, and hosted social hook bond/memory/influence payload plus event sequence planning.
- `tools/agent-server/lib/epoch/commandAbuseRules.ts`: rejected-command abuse score delta/reason classification plus command rejected / abuse score changed event sequence/result projection.
- `tools/agent-server/lib/epoch/encounterRules.ts`: objective projection reads, objective reward, objective resource scoring, objective creation/contribution/settlement event sequence/result projection, objective contribution spend payload, objective settlement reward grant payload, objective created/contribution/settlement payload planning, anomaly projection reads, anomaly spawned payload planning, anomaly spawn event sequence/result projection, anomaly severity, anomaly reward, anomaly media validation, anomaly contest/resolution event sequence/result projection, anomaly contest focus spend payload, anomaly resolution reward grant payload, anomaly contest/resolution payload planning, and anomaly focus scoring.
- `tools/agent-server/lib/epoch/resourceNodeRules.ts`: resource-node projection reads, stamina scoring, spawn cooldown, equipment bonus projection, spawn/contest/settlement event sequence/result projection, contest stamina spend payload, settlement reward grant payload, spawned payload planning, contest payload planning, and settlement influence/trace payload planning.
- `tools/agent-server/lib/epoch/seasonCampaignRules.ts`: season projection reads, creation/contribution/settlement event sequence/result projection, creation/start/objective payload planning, contribution spend payload planning, contribution bonus scoring, contribution payload planning, objective completion payload planning, settlement winner selection, winner reward grant payload planning, resolved phase payload planning, organization dividend grant payload planning, region control/monument payload planning, region control decay target selection/limit/amount/min-age/min-score, region control release lookup, region control decay/release/claim/revolt payload planning, region control decay/release/claim event sequence/result projection, region revolt resolution event sequence/result projection, revolt stamina spend payload planning, revolt influence/trace payload planning, revolt settlement power calculation, and organization dividend/prestige payload planning.
- `tools/agent-server/lib/epoch/marketTradeRules.ts`: market order projection reads, market risk restriction guard, market fee calculation, seller proceeds, unit pricing, repeat-counterparty risk, suspicious price risk, expiry tick target selection/limit/max-age, create/fill/cancel/expiry event sequence/result projection, created/filled/cancelled/expired payload planning, fill payment payload-pair planning, goods grant asset selection, lock/payment/goods ledger payload planning, item transfer payload planning, and resource refund payload planning.
- `tools/agent-server/lib/epoch/directTradeRules.ts`: direct trade projection reads, resource/item asset conversion, resource settlement asset selectors, requested payment payload-pair planning, asset labels, repeat-counterparty risk, expiry tick target selection/limit/max-age, create/accept/cancel/expiry event sequence/result projection, created/accepted/cancelled/expired payloads, escrow lock/payment/goods ledger payload planning, item transfer payload planning, and escrowed resource refund payload planning.
- `tools/agent-server/lib/epoch/bountyRules.ts`: bounty projection reads, create/claim event sequence/result projection, escrow spend, created/claimed, claim reward, fulfillment item transfer payload planning, region influence, and trace payload planning.
- `tools/agent-server/lib/epoch/loreReadModel.ts`: lore contribution list projection, target status folding, dispute archive gate, S040 worldview gate, lore adjudication overview, and world honor boards.
- `tools/agent-server/lib/http/resultRoutes.ts`: result-page API and public result HTML route handlers.
- `tools/agent-server/lib/http/identityRoutes.ts`: identity issue, recovery rotation, archive, reincarnation, and identity progress route handlers.
- `tools/agent-server/lib/http/agentProfileRoutes.ts`: personality confirmation, agent briefing, memory, migration summary, and explorer profile route handlers.
- `tools/agent-server/lib/http/assetRoutes.ts`: console HTML/static assets plus Epoch media asset route handlers.
- `tools/agent-server/lib/http/mcpRoutes.ts`: Streamable MCP endpoint and MCP tool proxy route handlers.
- `tools/agent-server/lib/http/installRoutes.ts`: install page, install manifest/status, host-config, and package archive route handlers.
- `tools/agent-server/lib/http/worldRoutes.ts`: public world overview, public agent/profile/archive, hosted session, explorer, region, and NPC page route handlers.
- `tools/agent-server/lib/http/auditRoutes.ts`: audit API, public audit replay pages, public season archive pages, and season contribution audit export route handlers.
- `tools/agent-server/lib/http/operatorRoutes.ts`: moderation, abuse, operator overview, and maintenance run route handlers.
- `tools/agent-server/lib/http/economyRoutes.ts`: inventory, shop, market, market risk release, and direct trade route handlers.
- `tools/agent-server/lib/http/seasonRoutes.ts`: season campaign list, seed, contribute, and settle route handlers.
- `tools/agent-server/lib/http/hostedRoutes.ts`: hosted sessions, server-hosted jobs, web bridge, and attestation route handlers.
- `tools/agent-server/lib/http/narrativeRoutes.ts`: messages, confirmations, news, lore, and event history route handlers.
- `tools/agent-server/lib/http/encounterRoutes.ts`: objectives, resource nodes, anomalies, and bounty route handlers.
- `tools/agent-server/lib/http/societyRoutes.ts`: downtime, NPC, organization, social hooks, and API region info route handlers.
- `tools/agent-server/lib/http/gameplayRoutes.ts`: party run, raid, diplomacy, relationship, retaliation, region control, and turn-card route handlers.
- `tools/agent-server/lib/http/legacyRoutes.ts`: legacy run, context package, public world context, lore/progression/faction/feedback/outbox, world browser/detail, community, experience, and transparency route handlers.
- `tools/agent-server/lib/http/httpRouteTypes.ts`: small types shared by HTTP route modules.
- `tools/agent-server/lib/http/errorResponse.ts`: HTTP error classification policy shared by the server catch boundary.
- `tools/agent-server/lib/http/request.ts`: JSON body parsing, parsed body cache, query params, forwarded public base URL, and record helpers shared by HTTP handlers.
- `tools/agent-server/lib/http/response.ts`: JSON/HTML/binary/download response helpers and CORS header policy shared by route modules.
- `tools/graph-react-app/src/agent/components/ResultNavigation.tsx`: result next-action links and authorization copy.
- `tools/graph-react-app/src/agent/components/GameRunTimeline.tsx`: front-end display for run-level timeline.
- `tools/graph-react-app/src/agent/components/PublicReceiptDisclosure.tsx`: front-end receipt summary with player-readable labels.
- `tools/graph-react-app/src/agent/components/WorldOverviewPanel.tsx`: front-end world overview news, honor, lore, season, and region highlight display.
- `tools/graph-react-app/src/agent/components/WorldOverviewRecentResults.tsx`: front-end world overview result cards with run-level summary.
- `tools/graph-react-app/src/agent/components/PublicWorldPanel.tsx`: front-end public world aggregate counters.
- `tools/graph-react-app/src/agent/components/ResourcePanel.tsx`: front-end resource balance and media grid.
- `tools/graph-react-app/src/agent/components/InventoryPanel.tsx`: front-end inventory, equipment effect, craft, and shop controls.
- `tools/graph-react-app/src/agent/components/MarketPanel.tsx`: front-end public market order form, restriction banner, and order list.
- `tools/graph-react-app/src/agent/components/DirectTradePanel.tsx`: front-end private direct trade form, directional filters, trade list, and audit links.
- `tools/graph-react-app/src/agent/components/OrganizationPanel.tsx`: front-end organization directory, membership, upgrade, treasury, budget, career, and politics display controls.
- `tools/graph-react-app/src/agent/components/EncounterPanel.tsx`: front-end objective, resource node, and anomaly action controls.
- `tools/graph-react-app/src/agent/components/BountyPanel.tsx`: front-end bounty publishing, fulfillment, claim, and compact bounty list controls.
- `tools/graph-react-app/src/agent/components/PartyRunPanel.tsx`: front-end party creation, join request, invite audit, and party settlement controls.
- `tools/graph-react-app/src/agent/components/RaidRetaliationPanel.tsx`: front-end raid settlement, region revolt, retaliation resolution, and compact raid result controls.
- `tools/graph-react-app/src/agent/components/SeasonPanel.tsx`: front-end season archive link, media, contribution, objective, phase, and standing controls.
- `tools/graph-react-app/src/agent/components/RelationshipDiplomacyPanel.tsx`: front-end relationship graph, focus spend, diplomacy proposal, and diplomacy response controls.
- `tools/graph-react-app/src/agent/components/RegionOverviewPanel.tsx`: front-end region media, leaderboard, commission, NPC, relationship, household, organization shell, control, and conflict summary display.
- `tools/graph-react-app/src/agent/components/TurnHostedActionPanel.tsx`: front-end low-stimulation preflight, intervention bar, risk package, server-hosted action queue, turn card, hosted session action, web bridge, attestation, and action explanation controls.

Modify:

- `tools/agent-server/lib/resultPageHtml.ts`: render from `PublicResultViewModel`; keep HTML/CSS ownership here.
- `tools/graph-react-app/src/App.tsx`: lazy-load the Agent console and 3D scene so map and agent entrypoints do not ship in the same initial chunk.
- `tools/graph-react-app/vite.config.ts`: allow Vite to emit split chunks instead of forcing dynamic imports back into one JS file.
- `tools/graph-react-app/scripts/copy-data.ts`: copy Vite JS/CSS chunks into the exported asset directory and reference the module entry from exported HTML.
- `tools/graph-react-app/scripts/check-no-js-source.ts`: ignore generated exported Vite chunks under `00_总览/assets/` while still rejecting JS source files elsewhere.
- `tools/agent-server/lib/epoch/gameCore.ts`: keep compatibility exports while delegating focused rule domains such as identity projection reads, identity owner authorization guards, identity issue/recovery/lifetime/archive/reincarnation/personality drift payload planning plus event sequence/result projection, source-event eligibility, open proposal, cooldown, and suggested trait rules, communication moderation item projection reads, communication moderation/text normalization/assessment/content status update/risk payload/auto escalation planning, moderation resolved event sequence/result projection, risk review recorded event sequence/result projection, market risk release event sequence/result projection, abuse release/decay event sequence/result projection, and abuse decay target selection/limit/amount/min-score rules, downtime region normalization, rewards/previews, set/claim/tick payload planning, set/claim/tick event sequence/result projection, and tick target selection/limit, inventory item projection reads, inventory/shop catalog, inventory item create/craft/shop/bind event sequence/result projection, and item created/bound payload planning rules, resource balance copy/payload, grant/spend event sequence/result projection, and multi-cost spend planning rules, region news projection reads, region news generation event sequence/result projection, message posted event sequence/result projection, legend award payload/resource grant/ledger reason and claim event sequence/result projection rules, resource ledger event wrappers, region trace/influence event wrappers, region activity type/write helpers, inventory item event wrappers, organization creation/membership event sequence planning, organization treasury contribution event sequence planning, organization budget proposal/resolution event sequence planning, organization upgrade purchase event sequence planning, organization creation/membership/treasury/budget/upgrade payload rules, member treasury contribution spend payload rules, organization politics target selection/limit/filter, participant/career/source-evidence planning, template/payload planning, tick event sequence planning/result projection, and multisig rules, party run/retaliation opportunity projection reads, party lifecycle validation/invite/event sequence/result projection/payload planning, party/raid/retaliation pure settlement math, party member settlement result/total-score/reward grant planning, party settlement event sequence/influence/trace/news payload planning, raid/retaliation resolution event sequence/result projection planning, raid/retaliation stamina spend and reward grant payload planning, raid/retaliation influence/trace payload planning, and raid/retaliation payload planning, event envelope factory wiring, turn/hosted action signed envelope construction, turn/hosted action policy including turn-card expiry/sequence/unexpired-open-card validation, turn/hosted action payload planning, turn/hosted reward grant payload planning, hosted runner attestation payload normalization, server-hosted job lifecycle payload and event sequence planning, source-event ID normalization/known-event validation and risk-review rules, lore provenance/evidence rules, lore contribution validation/revision/source IDs/source event lookup/non-evidence reuse/refutation quota/low-authority refutation gate/record payload/cost spend and target adjudication status/source ids/source contribution event lookup/history folding/stable key/payload/event sequence/id link/canon candidate rules, NPC trait/review-resolution normalization, canonicalized/candidate review/rumor/ability clustering and submit/review payload rules, NPC lifecycle target selection/limit/filter, changes normalization/summary/migration, lifecycle event payload/sourceEventIds, memory/relationship/household/career/location/asset/health payload rules, tick 副作用事件序列规划, and tick 结果投影折叠, agent interaction and diplomacy/relationship/agent-NPC focus spend, accepted diplomacy relationship/trace event sequence planning, diplomacy trace/social hook lifecycle/hosted social hook side-effect event sequence rules, command rejected / abuse score changed event sequence/result projection, server trust guard reuse, encounter objective/anomaly projection reads plus objective creation/contribution/settlement and anomaly spawn/contest/resolution event sequence/result projection and objective/anomaly spend/reward grant and created/scoring/payload planning rules, resource-node spawn/scoring/cooldown and spawn/contest/settlement event sequence/result projection plus stamina spend/reward grant/payload planning rules, season projection reads, season creation/contribution/settlement event sequence/result projection, creation/start/objective/contribution spend/reward grant/dividend grant payload planning, season contribution trust breakdown/dominant/trusted score rules, season settlement/control/revolt stamina spend/influence and trace payload planning plus region revolt resolution event sequence/result projection and region-control decay target selection/limit/amount/min-age/min-score rules, market order projection reads, market risk restriction guard, region normalization, create/fill/cancel/expiry event sequence/result projection, fill payment-pair/goods asset and expiry/lifecycle/ledger/risk/refund payload planning rules, direct trade projection reads, create/accept/cancel/expiry event sequence/result projection, and accepted resource asset/payment-pair/goods asset and expiry/lifecycle/ledger/risk/refund payload planning rules, and bounty projection reads, create/claim event sequence/result projection, fulfillment item transfer/influence/trace payload planning rules to small modules.
- `tools/agent-server/lib/epoch/runtime.ts`: attach run-level public summary fields to result payloads without changing canonical events; delegate agent memory, NPC candidate, NPC state, organization/NPC subview wrappers, organization/diplomacy/influence projections, encounter runtime read wrappers, encounter objective/resource-node/anomaly projections, bounty/party run projections and party invite-token public redaction, region monument projection, season campaign/contribution audit projection, hosted session public list/redaction/watch next-action projection, public world/agent/hosted/lore entry aggregation, region/NPC info aggregation, Web Bridge prompt/view projection, identity archive projection, personal migration, explorer profile, audit, action eligibility, maintenance, market, shop offer media, region leaderboard, region activity, region conflict, region media, region news media projection, relationship media projection, region commission/location motif projections, operator overview, progress read-model helpers, explorer auth helpers/state, abuse rate-limit state, idempotency state, command context builders, idempotency subject/key rules, high-value confirmation rule helpers and confirmation state machine, attested runner challenge/signature state, result page runtime/access/record rules, result page publish/revoke/delete lifecycle state, result page navigation/self-statement rules, result page context/focus-validation/region-selection/projection rules, result page payload assembly rules, one-shot exploration write-flow rules, result page receipt/trust-tier rules, anomaly event template/boss media/rotation/operator input rules, server-hosted job helper rules, server-hosted run/queue/job write-flow orchestration, maintenance run orchestration, source-event provenance helpers, lore provenance/evidence fallback helpers, and lore target/worldview/honor-board read-model helpers to focused modules.
- `tools/agent-server/lib/epoch/progressReadModel.ts`: consume focused downtime preview types/rules and inventory equipment effect rules directly from small modules instead of routing through `gameCore.ts`.
- `tools/agent-server/install-smoke.ts`: keep the package-root MCP proxy smoke flow but wait long enough for stdio initialization under full-suite CPU load and include child diagnostics on timeout/exit.
- `tools/agent-server/lib/httpServer.ts`: delegate result routes to `resultRoutes.ts`, identity routes to `identityRoutes.ts`, agent profile/briefing routes to `agentProfileRoutes.ts`, static asset routes to `assetRoutes.ts`, MCP routes to `mcpRoutes.ts`, install/package routes to `installRoutes.ts`, public world routes to `worldRoutes.ts`, audit/season archive routes to `auditRoutes.ts`, operator control-plane routes to `operatorRoutes.ts`, economy routes to `economyRoutes.ts`, season campaign API routes to `seasonRoutes.ts`, hosted/web-bridge/attestation routes to `hostedRoutes.ts`, narrative routes to `narrativeRoutes.ts`, encounter routes to `encounterRoutes.ts`, society routes to `societyRoutes.ts`, gameplay routes to `gameplayRoutes.ts`, and legacy runtime routes to `legacyRoutes.ts`.
- `tools/agent-server/test/server.test.ts`: visible text leak tests, full-run expectations, result-route regression tests, and lazy console chunk regression tests.
- `tools/agent-server/test/install-smoke-command.test.ts`: report stdout and stderr together for failed install smoke commands so JSON error bodies are not hidden by process warnings.
- `tools/agent-server/test/packageArchive.test.ts`: wait for package-root MCP stdio responses with child exit/timeout diagnostics.
- `tools/agent-server/test/release-rehearsal-command.test.ts`: use the same 30s health wait as install smoke for server startup under full-suite load.
- `tools/agent-server/test/httpErrorResponse.test.ts`: status/body classification tests for HTTP error response policy.
- `tools/agent-server/test/httpRequestResponse.test.ts`: request parsing, parsed-body cache, public base URL, and CORS helper tests.
- `tools/agent-server/test/shopReadModel.test.ts`: shop offer item media and regional price projection tests.
- `tools/agent-server/test/regionMediaReadModel.test.ts`: public region location media projection tests.
- `tools/agent-server/test/regionNewsReadModel.test.ts`: public region news visible filtering, newest-first sorting, and media projection tests.
- `tools/agent-server/test/relationshipReadModel.test.ts`: relationship edge, NPC relationship, agent-NPC bond, household summary, and media projection tests.
- `tools/agent-server/test/npcStateReadModel.test.ts`: NPC memory sorting, lifecycle summaries, display-name fallback, and social-hook sorting tests.
- `tools/agent-server/test/organizationReadModel.test.ts`: diplomacy filtering/sorting, organization membership/list/politics sorting, treasury ledger projection, and influence score tests.
- `tools/agent-server/test/encounterReadModel.test.ts`: objective, resource-node, and anomaly sorting/filtering tests.
- `tools/agent-server/test/bountyPartyReadModel.test.ts`: bounty/party-run filtering and sorting tests plus public party invite-token redaction tests.
- `tools/agent-server/test/regionMonumentReadModel.test.ts`: region monument missing-id filtering and newest-first sorting tests.
- `tools/agent-server/test/seasonReadModel.test.ts`: season campaign filtering/sorting/media decoration plus season contribution audit grouping and daily total tests.
- `tools/agent-server/test/hostedSessionReadModel.test.ts`: hosted session list filtering/sorting/limit tests, public action/session redaction tests, and watch-page next-action debug-wording guards.
- `tools/agent-server/test/webBridgeReadModel.test.ts`: Web Bridge action option projection and copy prompt leakage tests.
- `tools/agent-server/test/identityArchiveReadModel.test.ts`: archived lineage, resource, event, public-link, and missing identity archive projection tests.
- `tools/agent-server/test/runtimeAuth.test.ts`: explorer recovery credential parsing and hash comparison tests.
- `tools/agent-server/test/explorerAuthRuntime.test.ts`: explorer credential hydration, stable local secret registration, recovery rotation, and idempotent replay tests.
- `tools/agent-server/test/runtimeAbuseRuntime.test.ts`: abuse rate-limit window, restricted-score gate, status projection, and disabled-mode tests.
- `tools/agent-server/test/runtimeIdempotencyRuntime.test.ts`: plain replay, subject conflict, explorer-scoped registration, authorization-event preservation, and missing-key tests.
- `tools/agent-server/test/highValueConfirmationRules.test.ts`: confirmation hash, summary, turn-card envelope, and auth-scope action mapping tests.
- `tools/agent-server/test/highValueConfirmationRuntime.test.ts`: high-value confirmation request/confirm/list/consume, expiry, idempotency, hidden event emission, and event-hydration tests.
- `tools/agent-server/test/attestationRuntime.test.ts`: attested runner challenge issue/idempotency, public challenge redaction, signature validation, challenge consumption, archived identity rejection, and expiry tests.
- `tools/agent-server/test/resultPageRuntimeStore.test.ts`: result page publish-token consumption, create idempotency replay, public share access lookup, revoke/delete authorization, deletion tombstone, hydration, and recent-result expiry tests.
- `tools/agent-server/test/serverHostedRuntime.test.ts`: server-hosted immediate run, queue/list, queued-job completion, and queued-job skip orchestration tests.
- `tools/agent-server/test/resultPageRuntimeRules.test.ts`: result page share URL/version/TTL, stable payload JSON, owner lookup, public-safe summary/pages, focused progress, request hash, create/revoke/delete page records, public access status, deletion classification, and minimal deletion summary tests.
- `tools/agent-server/test/resultPageNavigationRules.test.ts`: result page next action ordering, authorization copy, commission action labels, media, and self-statement fallback tests.
- `tools/agent-server/test/resultPageContextRules.test.ts`: result page region canonicalization, latest-event region fallback, focused/requested/downtime priority, focused turn-card/session validation, and bounded regional context tests.
- `tools/agent-server/test/resultPagePayloadRules.test.ts`: result page payload builder tests for focused turn-card payloads, hosted-session next actions, receipt focus, regional context, and conflict rejection.
- `tools/agent-server/test/explorationRuntime.test.ts`: one-shot exploration step-count/mandate normalization plus multi-step hosted session/action orchestration, safe option selection, focus-event collection, and one-shot result-page publication tests.
- `tools/agent-server/test/resultPageReceiptRules.test.ts`: result page receipt focus, canonical event sorting/deduplication, trusted execution receipt, play mode, and trust-tier tests.
- `tools/agent-server/test/serverHostedRuntimeRules.test.ts`: server-hosted option/context, job lifecycle payload/event sequence, job query/list sorting, and queued-job selection tests.
- `tools/agent-server/test/turnActionEnvelopeRules.test.ts`: turn-card, turn-resolution, hosted-action envelope content hash, protocol version, signature metadata, and stable JSON tests.
- `tools/agent-server/test/turnHostedActionRules.test.ts`: hosted/turn trust guards, turn-card expiry, sequence, and unexpired-open-card validation, option template, high-risk cap, first-run protection, repeatable reward cap, hosted social option, turn/hosted payload builder tests, turn-card/turn-resolution/hosted-session/hosted-action event sequence tests, turn/hosted reward grant payload tests, and hosted runner attestation payload normalization tests.
- `tools/agent-server/test/agentInteractionRules.test.ts`: relationship/diplomacy scoring, diplomacy focus spend/trace/payload/proposal/response/accepted relationship-trace event sequence tests, relationship focus spend/payload/event sequence tests, agent-NPC bond focus spend/payload/event sequence tests, child NPC bond guard tests, social hook lifecycle draft/created payload tests, hosted social hook consumption tests, and hosted social hook bond/memory/influence payload/event sequence tests.
- `tools/agent-server/test/npcLifecycleRules.test.ts`: NPC lifecycle target selection/limit/filtering, step changes, changes normalization, lifecycle event payload/sourceEventIds, memory summary, organization/migration helpers, household merge behavior, organization membership planning, memory/relationship/household/career/location/asset/health payload planning, manual lifecycle/memory event sequence planner tests, tick 副作用事件序列 planner tests, and tick 结果投影 projector tests.
- `tools/agent-server/test/commandAbuseRules.test.ts`: rejected-command abuse score classification, command rejected payload, abuse score changed payload, and command rejected event sequence tests.
- `tools/agent-server/test/encounterRules.test.ts`: objective/anomaly reward normalization, objective projection reads, objective creation/contribution/settlement event sequence/result projection, objective contribution spend payload, objective scoring/payload/influence/trace, anomaly projection reads, anomaly contest/resolution event sequence/result projection, anomaly focus spend payload, anomaly scoring/media/resolution reward grant payload/influence/trace tests.
- `tools/agent-server/test/organizationTreasuryRules.test.ts`: organization creation/membership payload and event sequence tests, member contribution event sequence tests, member contribution spend payload, contribution/upgrade treasury payload, upgrade purchase event sequence tests, upgrade purchased payload, budget proposal, budget proposal/resolution event sequence tests, multisig counts/pending state, vote, treasury spend, resolution payload, organization politics target selection/participant planning/kind/payload tests, and organization politics tick planner/result projector tests.
- `tools/agent-server/test/resourceNodeRules.test.ts`: resource-node projection reads, stamina scoring, spawn cooldown, equipment bonus, spawn/contest/settlement event sequence/result projection, contest stamina spend payload, contest payload, settlement reward grant payload, settlement payload, influence payload, and trace payload tests.
- `tools/agent-server/test/seasonCampaignRules.test.ts`: season projection reads, creation/contribution/settlement event sequence/result projection, creation/start/objective payload, contribution spend payload, contribution bonus scoring, contribution payload, objective completion payload, settlement winner selection, reward grant payload, resolved phase payload, organization dividend grant payload, region control/monument payload, region control decay target selection/limit/amount/min-age/min-score, region control release lookup, region control decay/release/claim/revolt payload, region control decay/release/claim event sequence/projector, revolt stamina spend payload, revolt influence/trace payload, revolt settlement power, region revolt resolution event sequence/projector, and organization dividend/prestige payload tests.
- `tools/agent-server/test/marketTradeRules.test.ts`: market order projection reads, market fee, seller proceeds, unit price, repeat-counterparty risk, suspicious price risk, expiry target selection, create/fill/cancel/expiry event sequence/result projection, created/filled/cancelled/expired payload, lock/payment/goods ledger payload, item transfer payload, and resource refund payload tests.
- `tools/agent-server/test/directTradeRules.test.ts`: direct trade projection reads, resource/item asset conversion, asset labels, malformed payload rejection, repeat-counterparty risk, expiry target selection, create/accept/cancel/expiry event sequence/result projection, created/accepted/cancelled/expired payload, escrow lock/payment/goods ledger payload, item transfer payload, and escrowed resource refund payload tests.
- `tools/agent-server/test/bountyRules.test.ts`: bounty projection reads, create/claim event sequence/result projection, escrow spend, created/claimed, claim reward, fulfillment item transfer, region influence, and trace payload tests.
- `tools/agent-server/test/legendAwardRules.test.ts`: region news projection read, legend award payload, minimum award amount, shared ledger reason, resource grant payload, and legend claim event sequence/result projection tests.
- `tools/agent-server/test/combatSettlementRules.test.ts`: party run and retaliation opportunity projection read tests, party lifecycle validation/invite/event sequence/projector tests, party member settlement result/total-score/reward grant tests, party run settlement event sequence and settled/influence/trace/news payload, raid cooldown/heat projection lookup, raid stamina spend/reward grant/resolved/influence/trace payload, retaliation stamina spend/reward grant/opportunity/resolved/influence/trace payload planning tests, and raid/retaliation resolution event sequence/projector tests.
- `tools/agent-server/test/inventoryRules.test.ts`: inventory item projection read plus item created and item bound payload planning tests.
- `tools/agent-server/test/identityLifecycleRules.test.ts`: identity issue, recovery rotation, lifetime adjustment, archive, reincarnation, and personality drift proposal/confirmation payload/event sequence/result projection tests plus personality drift source-event eligibility, open proposal folding, cooldown folding, and suggested trait selection tests.
- `tools/agent-server/test/identityProjectionRules.test.ts`: identity projection reads, active identity checks, identity slot guards, explorer lineage, legend total, and active-slot calculation tests.
- `tools/agent-server/test/identityAuthorizationRules.test.ts`: direct owner, user-verified owner, client owner-bypass, and system-worker owner-bypass authorization guard tests.
- `tools/agent-server/test/anomalyEventTemplateRules.test.ts`: anomaly template catalog media, deterministic boss template rotation, narrative variant stability, operator custom input, and invalid-template fallback tests.
- `tools/agent-server/test/runtimeCommandContextRules.test.ts`: generic, untrusted-client, owner-verified, and system maintenance command context builder tests.
- `tools/agent-server/test/runtimeInputRules.test.ts`: region id normalization, hosted session status parsing, runtime objective/season template selection, and abuse actor key tests.
- `tools/agent-server/test/runtimeInputSafetyRules.test.ts`: public text secret-material guard and rejected-command audit input summary redaction tests.
- `tools/agent-server/test/runtimePublicProjectionRules.test.ts`: party invite-token public redaction for events/projection/command values plus non-enumerable internal event attachment tests.
- `tools/agent-server/test/regionNewsDraftRules.test.ts`: direct/projection-backed region lookup plus message/anomaly region news draft tests, including visible-text guards against raw `region_`, `agent_`, and `explorer_` IDs.
- `tools/agent-server/test/regionNewsRuntime.test.ts`: duplicate source-news reuse plus append-to-result coverage for generated region-news events and command context propagation.
- `tools/agent-server/test/moderationRiskRules.test.ts`: moderation item projection read, region news event planning/result projection, message event planning/result projection, moderation queue/resolution, moderation resolved event sequence/projector, risk review/release event sequence/projector, auto risk-review escalation planning, market risk release event sequence/projector, abuse release/decay payload planning, abuse release/decay event sequence/projector, and abuse decay target selection/limit/amount/min-score tests.
- `tools/agent-server/test/no-js-gate.test.ts`: source gate regression tests for generated export chunks versus real JS source files.
- `tools/agent-server/test/runtime-boundaries.test.ts`: runtime read-model, public world entry read model, shop offer, region media, region news read/draft/write-flow, organization/diplomacy projection, encounter projection, bounty/party projection, region monument projection, season projection, region commission/location motif projection, auth helper/state ownership, abuse rate-limit state ownership, idempotency state ownership, command context, runtime input rules, confirmation, attestation, result page runtime rules, result page lifecycle store, result page navigation, result page payload builder, one-shot exploration runtime, anomaly template rules, server-hosted rules/runtime, and result page focus/context module boundary checks.
- `tools/agent-server/test/downtimeRules.test.ts`: downtime region normalization, reward grant payload planning, set/claim/tick payload planning, set/claim/tick event sequence/projector, diary projection helper coverage for claim/tick source-event mapping, persisted diary copy preservation, and tick target selection/limit behavior.
- `tools/agent-server/test/gameCore-boundaries.test.ts`: game-core rule-domain, server-only trust guard reuse, lore contribution revision/source IDs/source event validation/refutation quota/record/cost/spend and target adjudication status/source IDs/source contribution event lookup/history folding/stable key/payload, downtime event sequence/projector, downtime diary projection, event wrapping, signed envelope, legend award grant payload and claim event planner/projector, organization creation/member event sequence, organization treasury contribution event sequence, organization budget proposal/resolution event sequence, organization upgrade purchase event sequence, organization payload, and member contribution spend payload, party member reward grant payload, party run lifecycle planner/projector, turn/hosted action payload, turn-card/turn-resolution/hosted-session/hosted-action event sequence, reward grant payload, hosted runner attestation payload, NPC lifecycle selection/payload/tick 副作用事件 planner/result projector, region news event planner/result projector, message event planner/result projector, command rejected event planner/result projector, diplomacy/relationship/agent-NPC focus spend payload, diplomacy proposal event sequence, diplomacy response event sequence, accepted diplomacy relationship/trace event sequence, relationship/agent-NPC bond update event sequence, social hook lifecycle payload, hosted social hook side-effect payload/event sequence, command abuse payload, server-hosted job lifecycle payload/event sequence, identity lifecycle event planner/projector and payload, moderation/risk payload, raid/retaliation stamina spend/reward grant/influence/trace payload, raid/retaliation resolution planner/projector, resource-node spawn/contest/settlement planner/projector and stamina spend/reward grant payload, season campaign creation/contribution/settlement planner/projector, region revolt resolution planner/projector, region control decay/claim planner/projector, market order create/fill/cancel/expiry planner/projector, direct trade create/accept/cancel/expiry planner/projector, bounty create/claim planner/projector, and inventory payload module boundary checks.
- `tools/agent-server/test/gameCore-boundaries.test.ts` and targeted HTTP/MCP/game-core tests also cover that server-trusted operator paths still reject untrusted clients after the guard reuse cleanup.
- `tools/graph-react-app/src/agent/api.ts`: add public result view types consumed by new components.
- `tools/graph-react-app/src/agent/AgentExplorer.tsx`: replace inline result panel, world overview, resource balance, inventory/shop, public market, private direct trade, organization, encounter, bounty, party run, raid/retaliation, season, relationship/diplomacy, large region overview, hosted/turn action sections, player-facing labels/tool catalogs, and player primary action disabled-reason projection with components/helpers/controllers.
- `tools/graph-react-app/src/agent/AgentExplorer.layout.test.ts`: layout checks for extracted components and controller boundaries.

Do not modify:

- Canonical event names in `tools/agent-server/lib/epoch/events.ts`.
- Existing share-token or recovery-code cryptographic behavior.
- JSONL event log format.

## Task 1: Lock Visible Text Boundaries

**Files:**

- Modify: `tools/agent-server/test/server.test.ts`

- [ ] **Step 1: Add the forbidden visible text helper**

Add this near the existing `visibleHtmlText` helper:

```ts
const PUBLIC_RESULT_FORBIDDEN_VISIBLE_TEXT = [
  "SERVER RECEIPT",
  "resource_granted",
  "turn_resolved",
  "turn_card_created",
  "identity_issued",
  "T0_public",
  "T1_",
  "T2_",
  "local_secret",
  "social_hook",
  "region_",
  "epoch_event_",
  "untrusted_client",
  "user_verified_web",
  "server_settled",
];

function assertNoForbiddenPublicVisibleText(html: string) {
  const visibleText = visibleHtmlText(html);
  for (const token of PUBLIC_RESULT_FORBIDDEN_VISIBLE_TEXT) {
    assert.doesNotMatch(visibleText, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
}
```

- [ ] **Step 2: Use the helper in result page tests**

Add this after each result page HTML fetch in the two existing tests:

```ts
assertNoForbiddenPublicVisibleText(publicResult.text);
```

Use it in:

- `HTTP result pages expose continuation actions and regional context`
- `HTTP one-shot exploration run completes a multi-node journey and publishes a result page`
- `HTTP result pages expose server-settled regional conflict context`

- [ ] **Step 3: Run the focused server tests**

Run:

```bash
cd tools/graph-react-app
node --import tsx --test ../agent-server/test/server.test.ts --test-name-pattern "result pages|one-shot exploration"
```

Expected: PASS on current behavior or FAIL only with visible leaked tokens that must be fixed before proceeding.

- [ ] **Step 4: Commit**

```bash
git add ../agent-server/test/server.test.ts
git commit -m "Lock public result pages against internal visible text

Public result pages are player-facing artifacts, so tests now scan
rendered visible text for internal event names, ids and trust labels.

Constraint: Raw HTML can still carry hidden JSON for verification.
Confidence: high
Scope-risk: narrow
Tested: node --import tsx --test ../agent-server/test/server.test.ts --test-name-pattern \"result pages|one-shot exploration\""
```

## Task 2: Extract Public Vocabulary

**Files:**

- Create: `tools/agent-server/lib/epoch/publicVocabulary.ts`
- Modify: `tools/agent-server/lib/resultPageHtml.ts`
- Test: `tools/agent-server/test/server.test.ts`

- [ ] **Step 1: Write a focused import test through existing HTML tests**

No new test file is required. The Task 1 visible text tests are the regression guard for this extraction.

- [ ] **Step 2: Create `publicVocabulary.ts`**

```ts
export const publicResourceLabels: Record<string, string> = {
  coin: "钱币",
  aether: "灵质",
  stamina: "体力",
  focus: "专注点",
  legend: "传说",
};

export const publicResourceDescriptions: Record<string, string> = {
  focus: "本局可用的行动注意力，用来观察、调查和处理风险",
  stamina: "用于移动、战斗和体力行动",
  aether: "用于异常、仪式和高阶事件",
  coin: "用于交易和补给",
  legend: "公开事迹带来的声望",
};

export const publicSourceTypeLabels: Record<string, string> = {
  objective: "区域目标",
  resource_node: "资源点",
  anomaly: "异常",
  bounty: "悬赏",
  party_run: "协同行动",
  social_hook: "人物事件",
  retaliation: "反击机会",
};

export const publicEventTypeLabels: Record<string, string> = {
  identity_issued: "身份入场",
  turn_card_created: "探索节点生成",
  turn_resolved: "完成行动",
  hosted_session_started: "探索节点生成",
  hosted_action_recorded: "完成行动",
  resource_granted: "收获入账",
  downtime_set: "托管设置",
  downtime_tick_resolved: "托管结算",
  downtime_claimed: "托管领取",
  identity_archived: "身份定档",
  reincarnation_issued: "下一世签发",
  relationship_updated: "关系变化",
  raid_resolved: "对抗结算",
  retaliation_resolved: "反击结算",
  contested_objective_settled: "区域目标结算",
  resource_node_settled: "资源点结算",
  anomaly_resolved: "异常结算",
  party_run_created: "小队开启",
  party_member_joined: "小队加入",
};

export const publicStatusLabels: Record<string, string> = {
  active: "进行中",
  archived: "已定档",
  open: "开放",
  resolved: "已结算",
  settled: "已结算",
  completed: "已完成",
  pending: "待回应",
  accepted: "已接受",
  rejected: "已驳回",
  attacker_won: "进攻方胜出",
  defender_won: "防守方守住",
  low: "低风险",
  medium: "中风险",
  high: "高风险",
};

const publicRegionLabels: Record<string, string> = {
  region_gray_harbor: "灰港",
  region_salt_mirror: "盐镜",
  region_ash_outpost: "灰烬哨站",
  region_glass_archive: "玻璃档案馆",
  region_moonwell_hollow: "月井空壳",
};

export function publicRegionLabel(regionId: string | undefined) {
  if (!regionId) return "未知区域";
  return publicRegionLabels[regionId] || regionId.replace(/^region_/, "").replace(/_/g, " ");
}

export function publicText(value: unknown) {
  let text = String(value ?? "")
    .replace(/\bsha256:[a-f0-9]+\b/gi, "校验码已记录")
    .replace(/\bclaim:[a-z0-9:._-]+\b/gi, "设定条目")
    .replace(/\b[a-z0-9]+(?:_[a-z0-9]+)*_agent_[a-z0-9_]+\b/gi, "行动身份")
    .replace(/\b[a-z0-9]+(?:_[a-z0-9]+)*_explorer_[a-z0-9_]+\b/gi, "玩家")
    .replace(/\b[a-z0-9]+(?:_[a-z0-9]+)*_(event|page|turn_card|install|job|session|action|order|trade|raid|retaliation|trace|objective|resource_node|anomaly|npc|message|season|party_run|party_join_request|lore_contribution|lore_adjudication)_[a-z0-9_]+\b/gi, "公开记录")
    .replace(/region_gray_harbor/g, "灰港")
    .replace(/region_salt_mirror/g, "盐镜")
    .replace(/region_ash_outpost/g, "灰烬哨站")
    .replace(/region_glass_archive/g, "玻璃档案馆")
    .replace(/region_moonwell_hollow/g, "月井空壳")
    .replace(/Gray Harbor/g, "灰港")
    .replace(/Clerk/g, "书记员")
    .replace(/Child/g, "子嗣")
    .replace(/Friend/g, "友人")
    .replace(/Supervisor/g, "督导")
    .replace(/_/g, " ");
  if (/^(epoch agent|explorer|epoch event|epoch page|epoch turn card|server hosted job|turn card|session|action|raid|retaliation|trace|objective|resource node|anomaly|npc|social hook|season|message|command|correlation)\s/i.test(text)) {
    return "已记录";
  }
  text = text
    .replace(/^[^·]+ · ([^·]+)的(探索节点|托管历程|探索历程)已整理为可分享的探索历程摘要。/, "$1$2已整理为可分享摘要。")
    .replace(/^[^·]+ · ([^·]+)(探索节点|托管历程|探索历程)已整理为可分享摘要。/, "$1$2已整理为可分享摘要。")
    .replace(/灰港\s+书记员\s+子嗣\s+\d+\s+友人/g, "灰港书记员的友人")
    .replace(/灰港\s+书记员\s+子嗣\s+\d+\s+督导/g, "灰港书记员的督导")
    .replace(/灰港\s+书记员\s+子嗣\s+\d+/g, "灰港书记员家属")
    .replace(/\s+/g, " ")
    .replace(/\s+的/g, "的")
    .replace(/\s+([，。；：！？])/g, "$1")
    .trim();
  return text;
}

export function publicEventTypeLabel(value: string | undefined) {
  return publicEventTypeLabels[value || ""] || publicText(value || "公开事件");
}

export function publicResourceLabel(value: string | undefined) {
  return publicResourceLabels[value || ""] || publicText(value || "资源");
}

export function publicSourceTypeLabel(value: string | undefined) {
  return publicSourceTypeLabels[value || ""] || publicText(value || "事件");
}

export function publicStatusLabel(value: string | undefined) {
  return publicStatusLabels[value || ""] || publicText(value || "未记录");
}
```

- [ ] **Step 3: Import vocabulary in `resultPageHtml.ts`**

Replace local maps/functions that are now exported by `publicVocabulary.ts` with:

```ts
import {
  publicEventTypeLabel,
  publicRegionLabel,
  publicResourceDescriptions,
  publicResourceLabel,
  publicResourceLabels,
  publicSourceTypeLabel,
  publicStatusLabel,
  publicText,
} from "./epoch/publicVocabulary.ts";
```

Keep page-specific helpers such as `publicNarrativeText`, `resultHeroTitle`, `renderReceiptJsonScript`, `escapeHtml`, and `escapeJsonScript` in `resultPageHtml.ts`.

- [ ] **Step 4: Replace local call sites**

Use these replacements:

```ts
shortRegionLabel(regionId) -> publicRegionLabel(regionId)
eventTypeLabel(event.eventType) -> publicEventTypeLabel(event.eventType)
sourceTypeLabel(sourceType) -> publicSourceTypeLabel(sourceType)
statusLabel(status) -> publicStatusLabel(status)
resourceLabels[resourceId] || publicText(resourceId) -> publicResourceLabel(resourceId)
resourceDescriptions[resourceId] -> publicResourceDescriptions[resourceId]
```

- [ ] **Step 5: Run focused tests**

Run:

```bash
cd tools/graph-react-app
node --import tsx --test ../agent-server/test/server.test.ts --test-name-pattern "result pages|one-shot exploration"
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add ../agent-server/lib/epoch/publicVocabulary.ts ../agent-server/lib/resultPageHtml.ts ../agent-server/test/server.test.ts
git commit -m "Centralize public result vocabulary

Player-facing labels now live in a single server vocabulary module so
new result surfaces do not re-expose internal event names or ids.

Constraint: Existing result page HTML and hidden receipt JSON stay compatible.
Confidence: high
Scope-risk: narrow
Tested: node --import tsx --test ../agent-server/test/server.test.ts --test-name-pattern \"result pages|one-shot exploration\""
```

## Task 3: Add Public Result ViewModel

**Files:**

- Create: `tools/agent-server/lib/epoch/publicResultViewModel.ts`
- Modify: `tools/agent-server/lib/resultPageHtml.ts`
- Test: `tools/agent-server/test/server.test.ts`

- [ ] **Step 1: Add a direct assertion to existing result page tests**

After loading `publicResultVisibleText`, assert the run-level sections are present:

```ts
assert.match(publicResultVisibleText, /历程时间线/);
assert.match(publicResultVisibleText, /接下来去哪/);
assert.match(publicResultVisibleText, /校验证明/);
assert.match(publicResultVisibleText, /服务器已结算|服务器记录/);
```

- [ ] **Step 2: Create `publicResultViewModel.ts`**

```ts
import { type EpochSharedResultPage } from "./runtime.ts";
import {
  publicEventTypeLabel,
  publicRegionLabel,
  publicResourceDescriptions,
  publicResourceLabel,
  publicSourceTypeLabel,
  publicText,
} from "./publicVocabulary.ts";

type ResultPagePayload = NonNullable<EpochSharedResultPage["payload"]>;

export interface PublicTimelineItem {
  readonly title: string;
  readonly body: string;
  readonly time?: string;
}

export interface PublicConsequence {
  readonly label: string;
  readonly value: string;
  readonly note?: string;
}

export interface PublicNextAction {
  readonly label: string;
  readonly href: string;
  readonly note: string;
}

export interface PublicVerificationSummary {
  readonly label: string;
  readonly note: string;
  readonly eventCount: number;
  readonly payloadHash?: string;
}

export interface PublicResultViewModel {
  readonly pageTitle: string;
  readonly heroTitle: string;
  readonly heroSummary: string;
  readonly statusLabel: string;
  readonly agentName: string;
  readonly generatedAt: string;
  readonly timeline: readonly PublicTimelineItem[];
  readonly consequences: readonly PublicConsequence[];
  readonly nextActions: readonly PublicNextAction[];
  readonly verification: PublicVerificationSummary;
}

function publicIdentityName(payload: ResultPagePayload) {
  return publicText(payload.progress.identity?.identityName || payload.progress.agentId || "行动身份");
}

function timelineFromPayload(payload: ResultPagePayload): readonly PublicTimelineItem[] {
  const events = payload.progress.latestEvents.slice(0, 12);
  const items = events.map((event, index) => ({
    title: publicEventTypeLabel(event.eventType),
    body: publicText(
      typeof event.payload === "object" && event.payload && "summary" in event.payload
        ? (event.payload as { summary?: unknown }).summary
        : `第 ${index + 1} 段探索已记录。`,
    ),
    time: event.createdAt,
  }));
  if (items.length >= 4) return items;
  return [
    { title: "身份入场", body: `${publicIdentityName(payload)}进入本次历程。`, time: payload.generatedAt },
    { title: "探索展开", body: "服务器整理了本局可见线索。", time: payload.generatedAt },
    { title: "行动结算", body: "关键行动已进入服务器记录。", time: payload.generatedAt },
    { title: "结果归档", body: "本页整理为可分享的公开战报。", time: payload.generatedAt },
  ];
}

function consequencesFromPayload(payload: ResultPagePayload): readonly PublicConsequence[] {
  const resources = Object.entries(payload.progress.resources || {})
    .filter(([, amount]) => typeof amount === "number" && amount > 0)
    .map(([resourceId, amount]) => ({
      label: publicResourceLabel(resourceId),
      value: `+${amount}`,
      note: publicResourceDescriptions[resourceId],
    }));
  if (resources.length) return resources;
  return [{ label: "结果", value: "已记录", note: "本局没有公开资源变化。" }];
}

function nextActionsFromPayload(payload: ResultPagePayload): readonly PublicNextAction[] {
  const pages = payload.publicPages || { world: "/epoch/world", console: "/epoch/console" };
  return [
    { label: "继续这个 agent", href: pages.console, note: "确认这是你的档案后，可以继续消耗寿命或处理后续行动。" },
    ...(pages.agent ? [{ label: "查看 agent 档案", href: pages.agent, note: "查看公开身份档案和近期记录。" }] : []),
    { label: "返回世界入口", href: pages.world, note: "查看世界新闻、区域和其他公开战报。" },
    { label: "安装或连接", href: "/epoch/install", note: "把黑曜纪元接到你的 coding agent。" },
  ];
}

export function buildPublicResultViewModel(page: EpochSharedResultPage & { readonly payload: ResultPagePayload }): PublicResultViewModel {
  const payload = page.payload;
  const region = payload.regionalContext?.regionId ? publicRegionLabel(payload.regionalContext.regionId) : "黑曜纪元";
  const focus = payload.focusHostedSession ? "探索历程" : payload.focusTurnCard ? "探索节点" : "探索历程";
  return {
    pageTitle: `${region}${focus}`,
    heroTitle: `${region}${focus}`,
    heroSummary: publicText(payload.publicSafeSummary.text || "这是一张可分享的探索历程摘要。"),
    statusLabel: payload.receipt.canonicalEvents.length ? "服务器已结算" : "服务器已记录",
    agentName: publicIdentityName(payload),
    generatedAt: payload.generatedAt,
    timeline: timelineFromPayload(payload),
    consequences: consequencesFromPayload(payload),
    nextActions: nextActionsFromPayload(payload),
    verification: {
      label: payload.receipt.canonicalEvents.length ? "服务器已结算" : "服务器记录",
      note: "这些信息用于确认本页来自服务器结算，不影响阅读故事。",
      eventCount: payload.receipt.canonicalEvents.length,
      payloadHash: payload.receipt.payloadHash,
    },
  };
}
```

- [ ] **Step 3: Use the ViewModel in `resultPageHtml.ts`**

Add:

```ts
import { buildPublicResultViewModel } from "./epoch/publicResultViewModel.ts";
```

At the start of `renderEpochResultPageHtml`:

```ts
const view = buildPublicResultViewModel(page);
```

Use `view.heroTitle`, `view.heroSummary`, `view.timeline`, `view.consequences`, `view.nextActions`, and `view.verification` for new or migrated sections. Leave older helper rendering in place only where it has not yet been migrated.

- [ ] **Step 4: Run tests**

Run:

```bash
cd tools/graph-react-app
node --import tsx --test ../agent-server/test/server.test.ts --test-name-pattern "result pages|one-shot exploration"
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add ../agent-server/lib/epoch/publicResultViewModel.ts ../agent-server/lib/resultPageHtml.ts ../agent-server/test/server.test.ts
git commit -m "Render public result pages from a player view model

The result page now has an explicit player-facing ViewModel between
canonical events and HTML, reducing the chance that internal ids or
event enums leak into the default page.

Constraint: Canonical receipt data remains available in the hidden verification payload.
Confidence: medium
Scope-risk: moderate
Tested: node --import tsx --test ../agent-server/test/server.test.ts --test-name-pattern \"result pages|one-shot exploration\"
Tested: npm run typecheck"
```

## Task 4: Strengthen Full-Run Semantics

**Files:**

- Create: `tools/agent-server/lib/epoch/resultRunSummary.ts`
- Create: `tools/agent-server/lib/epoch/gameRunReadModel.ts`
- Modify: `tools/agent-server/lib/epoch/runtime.ts`
- Modify: `tools/agent-server/lib/epoch/publicResultViewModel.ts`
- Modify: `tools/agent-server/test/server.test.ts`

- [ ] **Step 1: Add assertions to the one-shot run test**

In `HTTP one-shot exploration run completes a multi-node journey and publishes a result page`, add:

```ts
assert.match(publicResult.text, /开局|身份入场/);
assert.match(publicResult.text, /第 1 段/);
assert.match(publicResult.text, /第 8 段/);
assert.match(publicResult.text, /结果归档|收获入账|行动结算/);
assert.doesNotMatch(visibleHtmlText(publicResult.text), /本回合|turn card|hosted_action_recorded/);
```

- [ ] **Step 2: Add run-level fields to result payloads without breaking callers**

Extend `EpochResultPagePayload`:

```ts
export interface EpochResultPageRunSummary {
  readonly runKind: "single_turn" | "one_shot_journey" | "hosted_journey" | "agent_snapshot";
  readonly title: string;
  readonly startedAt: string;
  readonly settledAt: string;
  readonly stepCount: number;
  readonly endingReason: "completed" | "early_exit" | "archived" | "snapshot";
}

export interface EpochResultPagePayload {
  readonly pageType: "agent_result";
  readonly generatedAt: string;
  readonly publicSafeSummary: EpochPublicSafeSummary;
  readonly progress: EpochProgressView;
  readonly runSummary?: EpochResultPageRunSummary;
  ...
}
```

- [ ] **Step 3: Populate run summary in `resultPagePayload`**

Inside `resultPagePayload`, after `progress` is built, delegate to `buildEpochResultPageRunSummary`.
Explicit focus wins over event volume; a focused turn must stay `single_turn` / 1 step even if the surrounding progress contains many recent events:

```ts
runSummary: buildEpochResultPageRunSummary(input, {
  generatedAt,
  progress,
  focusTurnCard,
  focusHostedSession,
}),
```

Include `runSummary` in the payload object.

- [ ] **Step 4: Prefer run summary in the ViewModel**

In `buildPublicResultViewModel`, use:

```ts
const runTitle = payload.runSummary?.title || `${region}${focus}`;
const statusLabel = payload.runSummary?.endingReason === "completed"
  ? "完整历程已结算"
  : "历程已记录";
```

- [ ] **Step 5: Run tests**

Run:

```bash
cd tools/graph-react-app
node --import tsx --test ../agent-server/test/server.test.ts --test-name-pattern "one-shot exploration|result pages"
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add ../agent-server/lib/epoch/runtime.ts ../agent-server/lib/epoch/publicResultViewModel.ts ../agent-server/test/server.test.ts
git commit -m "Make result pages describe run-level journeys

Result payloads now carry an optional public run summary so one-shot
exploration pages can present a complete journey instead of exposing
internal turn or hosted-action units.

Constraint: Existing result payload consumers keep working because runSummary is optional.
Confidence: medium
Scope-risk: moderate
Tested: node --import tsx --test ../agent-server/test/server.test.ts --test-name-pattern \"one-shot exploration|result pages\"
Tested: npm run typecheck"
```

## Task 5: Extract Result HTTP Routes

**Files:**

- Create: `tools/agent-server/lib/http/httpRouteTypes.ts`
- Create: `tools/agent-server/lib/http/resultRoutes.ts`
- Modify: `tools/agent-server/lib/httpServer.ts`
- Test: `tools/agent-server/test/server.test.ts`

- [ ] **Step 1: Create shared route types**

```ts
import { type IncomingMessage, type ServerResponse } from "node:http";
import { type AgentWorldRuntime } from "../epoch/runtime.ts";

export interface EpochHttpRouteContext {
  readonly runtime: AgentWorldRuntime;
  readonly request: IncomingMessage;
  readonly response: ServerResponse;
  readonly method: string;
  readonly pathname: string;
  readonly allowedOrigins: readonly string[];
  readonly maxBodyBytes: number;
  readonly persistEpochEvents: (result: { readonly events?: readonly unknown[] }) => Promise<void>;
  readonly persistEpochResultPage: (result: unknown) => Promise<void>;
  readonly readJsonBody: (request: IncomingMessage, maxBodyBytes: number) => Promise<unknown>;
  readonly sendJson: (request: IncomingMessage, response: ServerResponse, status: number, body: unknown, allowedOrigins: readonly string[]) => void;
  readonly sendHtml: (request: IncomingMessage, response: ServerResponse, status: number, html: string, allowedOrigins: readonly string[]) => void;
  readonly queryParams: (request: IncomingMessage) => URLSearchParams;
}
```

- [ ] **Step 2: Create `resultRoutes.ts`**

```ts
import { renderEpochResultPageHtml } from "../resultPageHtml.ts";
import { renderResultPageStatusHtml } from "../publicWorldPageHtml.ts";
import { type EpochHttpRouteContext } from "./httpRouteTypes.ts";

export async function handleEpochResultRoutes(context: EpochHttpRouteContext): Promise<boolean> {
  const { method, pathname, request, response, runtime, allowedOrigins } = context;
  if (method === "POST" && pathname === "/api/epoch/exploration/run") {
    const result = runtime.epochRunExploration(await context.readJsonBody(request, context.maxBodyBytes));
    await context.persistEpochEvents(result);
    await context.persistEpochResultPage({ page: result.value.resultPage, duplicate: result.duplicate });
    context.sendJson(request, response, 200, result, allowedOrigins);
    return true;
  }
  if (method === "GET" && pathname === "/api/epoch/result-page") {
    const params = context.queryParams(request);
    context.sendJson(request, response, 200, runtime.epochResultPage({
      agentId: params.get("agentId") || undefined,
      explorerId: params.get("explorerId") || undefined,
      turnCardId: params.get("turnCardId") || params.get("focusTurnCardId") || undefined,
      hostedSessionId: params.get("hostedSessionId") || params.get("focusHostedSessionId") || undefined,
      limit: params.get("limit") || undefined,
    }), allowedOrigins);
    return true;
  }
  if (method === "POST" && pathname === "/api/epoch/result-page/create") {
    const result = runtime.epochCreateResultPage(await context.readJsonBody(request, context.maxBodyBytes));
    await context.persistEpochResultPage(result);
    context.sendJson(request, response, 200, result, allowedOrigins);
    return true;
  }
  if (method === "POST" && pathname === "/api/epoch/result-page/revoke") {
    const result = runtime.epochRevokeResultPage(await context.readJsonBody(request, context.maxBodyBytes));
    await context.persistEpochResultPage(result);
    context.sendJson(request, response, 200, result, allowedOrigins);
    return true;
  }
  if (method === "POST" && pathname === "/api/epoch/result-page/delete") {
    const result = runtime.epochDeleteResultPage(await context.readJsonBody(request, context.maxBodyBytes));
    await context.persistEpochResultPage(result);
    context.sendJson(request, response, 200, result, allowedOrigins);
    return true;
  }
  if (method === "GET" && pathname.startsWith("/epoch/result/")) {
    const access = runtime.epochGetPublicResultPage({
      pageId: decodeURIComponent(pathname.split("/").pop() || ""),
      shareToken: context.queryParams(request).get("shareToken") || undefined,
      shareVersion: context.queryParams(request).get("shareVersion") || undefined,
    });
    if (access.status === "missing" || !access.page) {
      context.sendHtml(request, response, 404, "<!doctype html><title>Result not found</title><p>result_page_not_found</p>", allowedOrigins);
      return true;
    }
    if (access.status !== "available") {
      context.sendHtml(request, response, access.statusCode, renderResultPageStatusHtml(`result_page_${access.status}`), allowedOrigins);
      return true;
    }
    if (!access.page.payload) {
      context.sendHtml(request, response, 410, renderResultPageStatusHtml("result_page_deleted"), allowedOrigins);
      return true;
    }
    context.sendHtml(request, response, 200, renderEpochResultPageHtml({ ...access.page, payload: access.page.payload }), allowedOrigins);
    return true;
  }
  return false;
}
```

- [ ] **Step 3: Delegate from `httpServer.ts`**

Import:

```ts
import { handleEpochResultRoutes } from "./http/resultRoutes.ts";
```

Near the current result route block, before the existing route checks:

```ts
if (await handleEpochResultRoutes({
  runtime,
  request,
  response,
  method,
  pathname,
  allowedOrigins,
  maxBodyBytes,
  persistEpochEvents: (result) => persistEpochEvents(persistJsonl, result),
  persistEpochResultPage: (result) => persistEpochResultPage(persistJsonl, result as Parameters<typeof persistEpochResultPage>[1]),
  readJsonBody,
  sendJson,
  sendHtml,
  queryParams,
})) {
  return;
}
```

Remove the old inlined result route branches after the new module passes tests.

- [ ] **Step 4: Run route tests**

Run:

```bash
cd tools/graph-react-app
node --import tsx --test ../agent-server/test/server.test.ts --test-name-pattern "result page|one-shot exploration|delete result"
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add ../agent-server/lib/http/httpRouteTypes.ts ../agent-server/lib/http/resultRoutes.ts ../agent-server/lib/httpServer.ts ../agent-server/test/server.test.ts
git commit -m "Move result routes behind a focused route module

Result-page API and public HTML serving now have a route boundary, so
future result work does not keep enlarging the central HTTP server.

Constraint: Public URLs and response payloads remain unchanged.
Confidence: medium
Scope-risk: moderate
Tested: node --import tsx --test ../agent-server/test/server.test.ts --test-name-pattern \"result page|one-shot exploration|delete result\"
Tested: npm run typecheck"
```

## Task 6: Extract Frontend Result Components

**Files:**

- Create: `tools/graph-react-app/src/agent/components/ResultNavigation.tsx`
- Create: `tools/graph-react-app/src/agent/components/GameRunTimeline.tsx`
- Create: `tools/graph-react-app/src/agent/components/PublicReceiptDisclosure.tsx`
- Modify: `tools/graph-react-app/src/agent/AgentExplorer.tsx`
- Modify: `tools/graph-react-app/src/agent/AgentExplorer.layout.test.ts`

- [ ] **Step 1: Create `ResultNavigation.tsx`**

```tsx
import { AGENT_SERVER_BASE, type EpochResultPage } from "../api.ts";

interface ResultNavigationProps {
  readonly resultPage: EpochResultPage;
}

export function ResultNavigation({ resultPage }: ResultNavigationProps) {
  return (
    <div className="agent-mini-list" aria-label="结果页下一步">
      {resultPage.nextActions.length ? resultPage.nextActions.slice(0, 4).map((action) => (
        <span className={action.media ? "agent-activity-media-row" : undefined} key={action.actionId}>
          {action.media ? (
            <img className="agent-activity-media-image" src={`${AGENT_SERVER_BASE}${action.media.imageUrl}`} alt={action.media.publicAlt} loading="lazy" />
          ) : null}
          <span>下一步 · {action.label}</span>
        </span>
      )) : <span>暂无服务器建议行动</span>}
    </div>
  );
}
```

- [ ] **Step 2: Create `PublicReceiptDisclosure.tsx`**

```tsx
import { AGENT_SERVER_BASE, type EpochResultPage } from "../api.ts";

interface PublicReceiptDisclosureProps {
  readonly resultPage: EpochResultPage;
  readonly eventTypeLabel: (eventType: string) => string;
}

export function PublicReceiptDisclosure({ resultPage, eventTypeLabel }: PublicReceiptDisclosureProps) {
  if (!resultPage.receipt) return null;
  return (
    <div className="agent-mini-list" aria-label="校验证明">
      {resultPage.receipt.canonicalEvents.slice(0, 3).map((event) => (
        <a className="agent-inline-link" href={`${AGENT_SERVER_BASE}${event.auditUrl}`} target="_blank" rel="noreferrer" key={event.eventId}>
          校验记录 · {eventTypeLabel(event.eventType)}
        </a>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Create `GameRunTimeline.tsx`**

```tsx
import { type EpochResultPage } from "../api.ts";

interface GameRunTimelineProps {
  readonly resultPage: EpochResultPage;
  readonly eventTypeLabel: (eventType: string) => string;
  readonly formatDate: (value: string) => string;
}

export function GameRunTimeline({ resultPage, eventTypeLabel, formatDate }: GameRunTimelineProps) {
  return (
    <div className="agent-mini-list" aria-label="历程时间线">
      {resultPage.progress.latestEvents.slice(0, 6).map((event) => (
        <span key={event.eventId}>
          {eventTypeLabel(event.eventType)} · {formatDate(event.createdAt)}
        </span>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Replace inline JSX in `AgentExplorer.tsx`**

Import:

```tsx
import { GameRunTimeline } from "./components/GameRunTimeline.tsx";
import { PublicReceiptDisclosure } from "./components/PublicReceiptDisclosure.tsx";
import { ResultNavigation } from "./components/ResultNavigation.tsx";
```

Replace the inline receipt and next-action blocks with:

```tsx
<PublicReceiptDisclosure resultPage={resultPage} eventTypeLabel={playerEventTypeLabel} />
<GameRunTimeline resultPage={resultPage} eventTypeLabel={playerEventTypeLabel} formatDate={formatDate} />
<ResultNavigation resultPage={resultPage} />
```

- [ ] **Step 5: Run frontend checks**

Run:

```bash
cd tools/graph-react-app
node --import tsx --test src/agent/AgentExplorer.layout.test.ts
npm run typecheck:web
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/agent/components/ResultNavigation.tsx src/agent/components/GameRunTimeline.tsx src/agent/components/PublicReceiptDisclosure.tsx src/agent/AgentExplorer.tsx src/agent/AgentExplorer.layout.test.ts
git commit -m "Extract result panel components from AgentExplorer

The console result panel now delegates navigation, timeline and receipt
display to focused components, limiting future growth in AgentExplorer.

Constraint: Existing console layout and API payloads remain unchanged.
Confidence: medium
Scope-risk: moderate
Tested: node --import tsx --test src/agent/AgentExplorer.layout.test.ts
Tested: npm run typecheck:web"
```

## Task 7: Final Verification

**Files:**

- Read: all changed files

- [x] **Step 1: Run full required verification**

```bash
cd tools/graph-react-app
npm run typecheck
node --import tsx --test ../agent-server/test/server.test.ts
node --import tsx --test src/agent/AgentExplorer.layout.test.ts
npm run build:export
```

Expected: all commands exit 0.

- [x] **Step 2: Run local browser check**

Start the server if it is not already running:

```bash
cd tools/graph-react-app
AGENT_SERVER_PORT=8792 npm run agent:server
```

Open one generated result page and verify visible text:

- No `SERVER RECEIPT`.
- No `resource_granted`, `turn_resolved`, `hosted_action_recorded`.
- No `T0_public`, `T2_local_secret`, `region_`.
- "接下来去哪" links are visible.
- "校验证明" is understandable and not the main content.
- One-shot run page reads like a full journey.

- [ ] **Step 3: Commit final verification note if tests required follow-up edits**

Only create this commit if verification required fixes:

```bash
git add .
git commit -m "Stabilize architecture hardening verification

Follow-up fixes from full verification keep public result pages,
route extraction and console component extraction passing together.

Confidence: high
Scope-risk: narrow
Tested: npm run typecheck
Tested: node --import tsx --test ../agent-server/test/server.test.ts
Tested: node --import tsx --test src/agent/AgentExplorer.layout.test.ts
Tested: npm run build:export"
```

## Self-Review

Spec coverage:

- Public ViewModel: Task 3.
- Full-run semantics: Task 4.
- Identity authorization/navigation copy: Task 3 and Task 6 preserve the "continue this agent" explanation; a later identity-route plan can deepen owner-only flows.
- HTTP result route boundary: Task 5.
- Frontend component boundary: Task 6.
- Visible text leakage: Task 1 and Task 2.
- Required verification: Task 7.

No placeholders:

- The plan contains exact file paths, code snippets, commands and expected outcomes.
- There are no deferred "fill later" sections.

Type consistency:

- Server-only types use `EpochSharedResultPage["payload"]`.
- Frontend components use existing `EpochResultPage` from `src/agent/api.ts`.
- `runSummary` is optional to preserve existing result payloads.
