// mcpToolsMcpRuntime.ts — extracted from mcpTools.ts
// Contains createAgentWorldMcpRuntime() and its directly-adjacent helpers.

import { DatabaseSync } from "node:sqlite";
import { validateToolInput } from "./mcpInputValidation.ts";
import type { EpochEvent } from "./epoch/events.ts";
import type { EpochResultPageJourney, EpochSharedResultPage } from "./epoch/runtime.ts";
import {
  PHASE6_EXPERIMENT_MCP_CONTRACT_RULESET_VERSION,
} from "./epoch/phase6ExperimentMcpContractRules.ts";
import {
  currentMcpRequestContext,
  isMcpResultAlreadyPersisted,
  markMcpResultAlreadyPersisted,
} from "./mcpRequestContext.ts";
import { currentMcpRequestAuthContext } from "./mcpRequestAuthContext.ts";
import {
  attachEpochEventsForPersistence,
  boundedEpochTransportValue,
  epochEventsForPersistence,
  publicEpochEvent,
} from "./epoch/runtimePublicProjectionRules.ts";
import {
  journeyEventsForPersistence,
  mergeJourneyEventsForPersistence,
} from "./epoch/journeyPersistence.ts";
import { PHASE6_ECONOMY_SNAPSHOT_VERSION } from "./epoch/phase6EconomyAuditRules.ts";
import {
  buildPhase6ProjectionDelta,
  phase6CanonicalCursor,
} from "./epoch/phase6ProjectionDeltaRules.ts";
import { phase6JourneyMaterialRewardForResource } from "./epoch/phase6MaterialRewardRules.ts";
import { projectPhase6PersistentRagPanel } from "./epoch/phase6PersistentMemoryRules.ts";
import { phase6EventsAfterCursor } from "./epoch/phase6EventWindowRules.ts";
import { buildPhase6PanelSnapshotDocument } from "./epoch/phase6PanelSnapshotAdapter.ts";
import { buildPhase6ServerPreSettlement } from "./epoch/phase6ServerPreSettlementRules.ts";
import { buildPhase6ServerOutcomeEvidence } from "./epoch/phase6ServerOutcomeRules.ts";
import { phase6RagRunAnchorEventIds } from "./epoch/phase6RagRunBindingRules.ts";
import {
  PHASE6_MATRIX_VERSION,
  assertPhase6ScenarioBinding,
  phase6ScenarioForRun,
} from "./epoch/phase6ScenarioMatrixRules.ts";
import { buildPhase6RagServerEvaluation } from "./epoch/phase6RagEvaluationPolicy.ts";
import {
  attachPhase6CommittedResultForPersistence,
  type Phase6CommittedResultRecord,
} from "./epoch/phase6CommittedResultStore.ts";
import { hashRunPayload } from "./tickets.ts";
import {
  serializeCompact,
  deriveDecisionEffect,
  assertPublicActionZeroBonus,
} from "./epoch/journeyActionPublicSerializer.ts";
import {
  type RuntimeOptions,
  type McpToolDefinition,
  type McpToolResult,
  isRecord,
  recordValue,
  recordArray,
  optionalString,
  numberValue,
  buildStrategyPromptNarrative,
  buildLifePatternPromptNarrative,
  compactJourneyDecisionWorldSlice,
} from "./mcpToolsHelpers.ts";
import {
  isApproachTag,
  scoreStrategyConsistency,
  snapshotJourneyStrategy,
  type IdentityStrategyDisposition,
  type StrategyConsistencyScore,
} from "./epoch/journeyStrategyRules.ts";
import {
  roleplayScoreFromMirrorLedger,
} from "./epoch/journeyMirrorConsequenceIntegration.ts";
import type { ExpectedLifePattern, RoleplayScore } from "./epoch/journeyRoleplayRules.ts";
import type { MirrorConsequenceLedgerEntry } from "./epoch/journeySettlementRules.ts";
import { AGENT_WORLD_TOOLS } from "./mcpToolDefinitions.ts";
import { registerWorldHandlers } from "./mcpToolsWorld.ts";
import { registerEconomyHandlers } from "./mcpToolsEconomy.ts";
import { registerWorldEventsHandlers } from "./mcpToolsWorldEvents.ts";
import { registerNpcHandlers } from "./mcpToolsNpc.ts";
import { registerCombatHandlers } from "./mcpToolsCombat.ts";
import { registerIdentityHandlers } from "./mcpToolsIdentity.ts";
import { registerJourneyHandlers } from "./mcpToolsJourney.ts";
import {
  registerPhase6Handlers,
  buildCompactPhase6RunReceiptForTransport,
  buildCompactPhase6ResultForTransport,
} from "./mcpToolsPhase6.ts";
import { epochWorldTimeFromMinute } from "./epoch/worldCalendar.ts";
import { MCP_PROTOCOL_VERSION, MCP_SERVER_INFO } from "./mcpConstants.ts";
import { createAgentWorldRuntime } from "./mcpRuntimeCore.ts";
import {
  type AgentWorldMcpRuntime,
  LEGACY_MUTATION_DISABLED_ERROR,
  assertLegacyAgentWorldToolRemoved,
  phase6CommittedResultStoreForOptions,
  phase6ReceiptSqlitePath,
  phase6ExperimentExplorerForStatus,
  loadPhase6ReceiptFromSqlite,
} from "./mcpTools.ts";

type AnyRecord = Record<string, unknown>;
type AgentWorldRuntime = ReturnType<typeof createAgentWorldRuntime>;
type ResultPageRoleplay = NonNullable<EpochResultPageJourney["roleplay"]>;
type ResultPageStrategyConsistency = NonNullable<EpochResultPageJourney["strategyConsistency"]>;
type ResultPageViability = NonNullable<EpochResultPageJourney["viability"]>;
type ResultPageHiddenPrerequisite = NonNullable<EpochResultPageJourney["hiddenPrerequisites"]>[number];
type ResultPageWorldImpact = NonNullable<EpochResultPageJourney["worldImpact"]>;

function roleplayResultPageProjection(
  entries: readonly MirrorConsequenceLedgerEntry[],
  journeyId: string,
  recordedAt: string,
): { readonly score: RoleplayScore; readonly page: ResultPageRoleplay } {
  const score = roleplayScoreFromMirrorLedger({ entries, journeyId, recordedAt });
  return {
    score,
    page: {
      deviationBps: score.deviationBps,
      classification: score.classification,
      ...(score.npcDoubtEvents.length > 0
        ? {
            npcDoubtEvents: score.npcDoubtEvents.map((event) => ({
              npcId: event.npcId,
              ...(event.factionId ? { factionId: event.factionId } : {}),
              doubtStrength: event.doubtStrength,
              reason: event.reason,
            })),
          }
        : {}),
      exposed: score.exposed,
      patternVersion: score.patternVersion,
    },
  };
}

function strategyResultPageProjection(input: {
  readonly journeyId: string;
  readonly disposition?: IdentityStrategyDisposition;
  readonly episodes: readonly AnyRecord[];
  readonly canonicalEvents: readonly EpochEvent[];
  readonly computedAt: string;
}): { readonly score: StrategyConsistencyScore; readonly page: ResultPageStrategyConsistency } | undefined {
  if (!input.disposition) return undefined;
  const observedEntries = input.episodes.flatMap((episode) => {
    const taskObjective = recordValue(episode.generatedTaskObjective);
    const selectedAction = recordValue(recordValue(recordValue(episode.serverFacts).storyBeat).selectedAction);
    const optionKey = optionalString(selectedAction.optionKey);
    const action = recordArray(taskObjective.actions)
      .find((candidate) => optionalString(candidate.optionKey) === optionKey);
    if (!action || !Array.isArray(action.approachTags)) return [];
    const approachTags = action.approachTags.filter(
      (tag): tag is NonNullable<StrategyConsistencyScore["snapshot"]["entries"][number]["approachTags"]>[number] =>
        typeof tag === "string" && isApproachTag(tag),
    );
    if (approachTags.length === 0) return [];
    const sourceFactIds = Array.isArray(episode.sourceFactIds)
      ? episode.sourceFactIds.filter((id): id is string => typeof id === "string")
      : [];
    const actionEvent = input.canonicalEvents.find((event) =>
      event.eventType === "hosted_action_recorded" && sourceFactIds.includes(event.eventId));
    if (!actionEvent) return [];
    return [{
      source: "action" as const,
      sourceId: actionEvent.eventId,
      approachTags,
      recordedAt: actionEvent.createdAt,
    }];
  });
  const snapshot = snapshotJourneyStrategy(input.journeyId, input.disposition);
  const score = scoreStrategyConsistency(snapshot, observedEntries, input.computedAt);
  return {
    score,
    page: {
      matchBps: score.matchBps,
      classification: score.classification.kind,
      snapshot: {
        journeyId: score.snapshot.journeyId,
        entries: score.snapshot.entries,
        snapshotVersion: score.snapshot.snapshotVersion,
      },
      strategyPolicyVersion: score.strategyPolicyVersion,
    },
  };
}

function viabilityResultPageProjection(
  events: readonly EpochEvent[],
  fallback?: { readonly viabilityScoreBps: number; readonly status: string },
): ResultPageViability | undefined {
  const viabilityEvent = events.find((event): event is Extract<EpochEvent, {
    readonly eventType: "identity_viability_projected";
  }> => event.eventType === "identity_viability_projected");
  if (!viabilityEvent) {
    if (!fallback
      || !Number.isSafeInteger(fallback.viabilityScoreBps)
      || fallback.viabilityScoreBps < 0
      || fallback.viabilityScoreBps > 10_000
      || !fallback.status.trim()) return undefined;
    return {
      before: { viabilityScoreBps: fallback.viabilityScoreBps },
      after: { viabilityScoreBps: fallback.viabilityScoreBps },
      deltaBps: 0,
      status: fallback.status,
    };
  }
  const lifetimeEvent = events.find((event): event is Extract<EpochEvent, {
    readonly eventType: "lifetime_adjusted";
  }> => event.eventType === "lifetime_adjusted");
  return {
    before: { viabilityScoreBps: viabilityEvent.payload.before.viabilityScoreBps },
    after: { viabilityScoreBps: viabilityEvent.payload.after.viabilityScoreBps },
    deltaBps: viabilityEvent.payload.deltaBps,
    status: viabilityEvent.payload.after.status,
    ...(lifetimeEvent ? { lifetimeConsequence: lifetimeEvent.payload.reason } : {}),
  };
}

function hiddenPrerequisiteResultPageProjection(
  events: readonly EpochEvent[],
): readonly ResultPageHiddenPrerequisite[] | undefined {
  const latestByLink = new Map<string, ResultPageHiddenPrerequisite>();
  for (const event of events) {
    if (event.eventType !== "hidden_prerequisite_link_changed") continue;
    const key = `${event.payload.objectiveId}:${event.payload.prerequisiteObjectId}`;
    latestByLink.set(key, {
      objectiveId: event.payload.objectiveId,
      prerequisiteObjectId: event.payload.prerequisiteObjectId,
      status: event.payload.statusAfter,
      destroyedAtActionEventId: event.payload.statusAfter === "destroyed"
        ? event.payload.sourceActionEventId
        : undefined,
      sourceLedgerEntryId: event.payload.sourceLedgerEntryId,
      observedAt: event.payload.changedAt,
    });
  }
  const links = [...latestByLink.values()].sort((left, right) =>
    `${left.objectiveId}:${left.prerequisiteObjectId}`.localeCompare(
      `${right.objectiveId}:${right.prerequisiteObjectId}`,
    ));
  return links.length > 0 ? links : undefined;
}

function worldImpactResultPageProjection(
  events: readonly EpochEvent[],
  hiddenPrerequisiteLinks?: readonly ResultPageHiddenPrerequisite[],
): ResultPageWorldImpact | undefined {
  const objectChanges = events.flatMap((event) => event.eventType === "world_object_state_changed"
    ? [{
        objectId: event.payload.objectId,
        regionId: event.payload.regionId,
        status: event.payload.statusAfter,
        degree: event.payload.degree,
        sourceActionEventId: event.payload.sourceActionEventId,
        observedAt: event.payload.changedAt,
      }]
    : []);
  const npcRelationships = events.flatMap((event) => event.eventType === "agent_npc_bond_updated"
    ? [{
        npcId: event.payload.npcId,
        scoreDelta: event.payload.scoreDelta,
        scoreAfter: event.payload.scoreAfter,
        sourceEventIds: [event.eventId],
        observedAt: event.payload.updatedAt,
      }]
    : []);
  if (objectChanges.length === 0 && npcRelationships.length === 0 && !hiddenPrerequisiteLinks) {
    return undefined;
  }
  return {
    ...(objectChanges.length > 0 ? { objectChanges } : {}),
    ...(npcRelationships.length > 0 ? { npcRelationships } : {}),
    ...(hiddenPrerequisiteLinks ? { hiddenPrerequisiteLinks } : {}),
  };
}

// ─── Extracted helpers (only used by createAgentWorldMcpRuntime) ─────────────

function toolResult(value: unknown) {
  const transportValue = boundedEpochTransportValue(value);
  const result = {
    content: [
      {
        type: "text",
        text: JSON.stringify(transportValue, null, 2),
      },
    ],
  };
  const events = epochEventsForPersistence(value);
  if (events.length) {
    Object.defineProperty(result, "events", {
      value: events,
      enumerable: false,
    });
  }
  const journeyEvents = journeyEventsForPersistence(value);
  if (journeyEvents.length) {
    Object.defineProperty(result, "journeyEvents", {
      value: journeyEvents,
      enumerable: false,
    });
  }
  if (isMcpResultAlreadyPersisted(value)) markMcpResultAlreadyPersisted(result);
  return result as McpToolResult;
}

const REJECTED_COMMAND_AUDIT_TOOLS = new Set([
  "obsidian_epoch.command",
  "obsidian_epoch.world_migrate",
  "obsidian_epoch.identity",
  "obsidian_epoch.rotate_recovery",
  "obsidian_epoch.archive_identity",
  "obsidian_epoch.reincarnate",
  "obsidian_epoch.run_maintenance",
  "obsidian_epoch.advance_world_clock",
  "obsidian_epoch.migrate_world_content",
  "obsidian_epoch.set_downtime",
  "obsidian_epoch.claim_downtime",
  "obsidian_epoch.tick_downtime",
  "obsidian_epoch.resolve_moderation",
  "obsidian_epoch.record_risk_review",
  "obsidian_epoch.release_market_risk_restriction",
  "obsidian_epoch.release_abuse_restriction",
  "obsidian_epoch.request_confirmation",
  "obsidian_epoch.post_message",
  "obsidian_epoch.generate_region_news",
  "obsidian_epoch.claim_news_legend",
  "obsidian_epoch.record_lore_contribution",
  "obsidian_epoch.adjudicate_lore_target",
  "obsidian_epoch.seed_objective",
  "obsidian_epoch.contribute_objective",
  "obsidian_epoch.settle_objective",
  "obsidian_epoch.spawn_resource_node",
  "obsidian_epoch.contest_resource_node",
  "obsidian_epoch.settle_resource_node",
  "obsidian_epoch.spawn_anomaly",
  "obsidian_epoch.contest_anomaly",
  "obsidian_epoch.resolve_anomaly",
  "obsidian_epoch.create_item",
  "obsidian_epoch.craft_item",
  "obsidian_epoch.purchase_shop_offer",
  "obsidian_epoch.bind_item",
  "obsidian_epoch.seed_season",
  "obsidian_epoch.contribute_season",
  "obsidian_epoch.settle_season",
  "obsidian_epoch.claim_region_control",
  "obsidian_epoch.direct_trades",
  "obsidian_epoch.create_market_order",
  "obsidian_epoch.fill_market_order",
  "obsidian_epoch.cancel_market_order",
  "obsidian_epoch.create_direct_trade",
  "obsidian_epoch.accept_direct_trade",
  "obsidian_epoch.cancel_direct_trade",
  "obsidian_epoch.tick_market_expiry",
  "obsidian_epoch.tick_direct_trade_expiry",
  "obsidian_epoch.create_bounty",
  "obsidian_epoch.claim_bounty",
  "obsidian_epoch.create_party_run",
  "obsidian_epoch.update_party_invite",
  "obsidian_epoch.join_party_run",
  "obsidian_epoch.request_party_join",
  "obsidian_epoch.resolve_party_join_request",
  "obsidian_epoch.resolve_raid",
  "obsidian_epoch.resolve_region_revolt",
  "obsidian_epoch.resolve_retaliation",
  "obsidian_epoch.update_organization_membership",
  "obsidian_epoch.purchase_organization_upgrade",
  "obsidian_epoch.contribute_organization_treasury",
  "obsidian_epoch.propose_organization_budget",
  "obsidian_epoch.resolve_organization_budget",
  "obsidian_epoch.propose_diplomacy",
  "obsidian_epoch.respond_diplomacy",
  "obsidian_epoch.update_relationship",
  "obsidian_epoch.deploy_trace_conflict",
  "obsidian_epoch.turn_card",
  "obsidian_epoch.resolve_turn",
  "obsidian_epoch.resolve_turn_intent",
  "obsidian_epoch.start_hosted_session",
  "obsidian_epoch.submit_hosted_action",
  "obsidian_epoch.submit_hosted_intent",
  "obsidian_epoch.run_server_hosted_action",
  "obsidian_epoch.queue_server_hosted_action",
  "obsidian_epoch.run_server_hosted_job",
  "obsidian_epoch.web_bridge_turn",
  "obsidian_epoch.submit_web_bridge_action",
  "obsidian_epoch.submit_web_bridge_intent",
  "obsidian_epoch.attestation_challenge",
  "obsidian_epoch.submit_attested_action",
  "obsidian_epoch.confirm_personality_drift",
  "obsidian_epoch.npc_note",
  "obsidian_epoch.submit_npc_candidate",
  "obsidian_epoch.review_npc_candidate",
  "obsidian_epoch.tick_npc_lifecycle",
  "obsidian_epoch.update_agent_npc_bond",
  "obsidian_epoch.create_result_page",
  "obsidian_epoch.prepare_journey",
  "obsidian_epoch.start_journey",
  "obsidian_epoch.propose_journey_step",
  "obsidian_epoch.commit_journey_action",
  "obsidian_epoch.recall_journey",
]);

function errorCodeForRejectedCommand(error: unknown) {
  return error instanceof Error && error.message ? error.message : "internal_error";
}

type McpRuntimeOptions = RuntimeOptions & {
  readonly runtime?: unknown;
  readonly recordRejectedCommands?: boolean;
  readonly authoritativeIdentityIssuance?: boolean;
  readonly worldMemorySearch?: (input: AnyRecord) => Promise<unknown>;
  readonly worldKnowledgeSearch?: (input: AnyRecord) => Promise<unknown>;
};

function serverAssignedIdentityInput(input: AnyRecord) {
  const sanitized = { ...input };
  delete sanitized.identityName;
  delete sanitized.maxLifetime;
  return sanitized;
}

// ─── Main extracted function ────────────────────────────────────────────────
export function createAgentWorldMcpRuntime(options: McpRuntimeOptions = {}): AgentWorldMcpRuntime {
  const runtime = (options.runtime ?? createAgentWorldRuntime(options)) as AgentWorldRuntime;
  const epochOptions = recordValue(options.epoch);
  const phase6CommittedResults = phase6CommittedResultStoreForOptions(options, epochOptions);
  const phase6ReceiptSqlite = phase6ReceiptSqlitePath(options);
  const recordRejectedCommands = options.recordRejectedCommands !== false;
  const authoritativeIdentityIssuance = options.authoritativeIdentityIssuance === true;
  const worldMemorySearch = options.worldMemorySearch;
  const worldKnowledgeSearch = options.worldKnowledgeSearch;
  const assertLegacyMutationEnabled = () => {
    if (process.env.NODE_ENV === "production") throw new Error(LEGACY_MUTATION_DISABLED_ERROR);
  };
  const authenticatedCommunityInput = (args: AnyRecord) => {
    const requestAuth = currentMcpRequestAuthContext();
    if (requestAuth?.kind !== "player") throw new Error("community_auth_player_required");
    const sanitized: AnyRecord = { ...args, explorerId: requestAuth.explorerId, tokenId: requestAuth.tokenId };
    // Abuse-detector relationship fields are server-owned.  A client may not
    // self-assert a target or group in order to manufacture or suppress flags.
    delete sanitized.againstExplorerId;
    delete sanitized.groupId;
    return sanitized;
  };
  const phase6BindingFromStartJourneyArgs = (args: AnyRecord) => {
    const binding = recordValue(args.startJourneyBinding || args.phase6StartJourneyBinding);
    const experimentId = optionalString(binding.experimentId);
    if (!experimentId) return undefined;
    const runIndex = Number(binding.runIndex);
    const seed = optionalString(binding.seed);
    const receiptId = optionalString(binding.receiptId)
      || optionalString(recordValue(binding.runReceipt).receiptId);
    const identity = recordValue(binding.identity);
    const explorer = recordValue(binding.explorer);
    const versions = recordValue(binding.versions);
    const scenarioMatrix = recordValue(binding.scenarioMatrix);
    const normalized = {
      experimentId,
      runIndex,
      scenarioTag: optionalString(binding.scenarioTag),
      seed,
      receiptId,
      journeyId: optionalString(binding.journeyId),
      runId: optionalString(binding.runId),
      retrievalExpected: binding.retrievalExpected === true && binding.retrievalExpectedSource === "server_policy",
      receiptVersion: optionalString(binding.receiptVersion)
        || optionalString(recordValue(binding.runReceipt).receiptVersion),
      identity,
      explorer,
      scenarioMatrix: {
        id: optionalString(scenarioMatrix.id) || optionalString(binding.scenarioMatrixId),
        version: optionalString(scenarioMatrix.version) || optionalString(binding.scenarioMatrixVersion),
      },
      versions: {
        rulesVersion: optionalString(versions.rulesVersion) || optionalString(binding.rulesVersion),
        catalogVersion: optionalString(versions.catalogVersion) || optionalString(binding.catalogVersion),
        codeVersion: optionalString(versions.codeVersion) || optionalString(binding.codeVersion),
      },
    };
    if (!Number.isInteger(normalized.runIndex) || normalized.runIndex < 1 || normalized.runIndex > 10) {
      throw new Error("phase6_settlement_binding_invalid:runIndex");
    }
    for (const [path, value] of [
      ["seed", normalized.seed],
      ["scenarioTag", normalized.scenarioTag],
      ["receiptId", normalized.receiptId],
      ["journeyId", normalized.journeyId],
      ["runId", normalized.runId],
      ["identity.identityId", optionalString(identity.identityId)],
      ["explorer.explorerId", optionalString(explorer.explorerId)],
      ["scenarioMatrix.id", normalized.scenarioMatrix.id],
      ["scenarioMatrix.version", normalized.scenarioMatrix.version],
      ["versions.rulesVersion", normalized.versions.rulesVersion],
      ["versions.catalogVersion", normalized.versions.catalogVersion],
      ["versions.codeVersion", normalized.versions.codeVersion],
    ] as const) {
      if (!value) throw new Error(`phase6_settlement_binding_invalid:${path}`);
    }
    const scenario = phase6ScenarioForRun(normalized.runIndex);
    assertPhase6ScenarioBinding(normalized.runIndex, normalized.scenarioTag as string, scenario.taskFamilyId);
    return { ...normalized, scenario };
  };
  const phase6BindingFromRagArgs = (args: AnyRecord) => phase6BindingFromStartJourneyArgs(args);
  const phase6TraceBinding = (
    binding: NonNullable<ReturnType<typeof phase6BindingFromStartJourneyArgs>>,
    args: AnyRecord,
  ) => {
    const worldClock = recordValue(runtime.epochWorldClock({}));
    const regionId = optionalString(args.regionId);
    const worldState = recordValue(runtime.epochWorldState({
      ...args,
      regionId,
      includeShipments: true,
    }));
    const worldId = optionalString(worldState.worldId) || optionalString(worldClock.worldId) || "obsidian_epoch";
    return {
      world: {
        worldId,
        ...(regionId ? { regionId } : {}),
        ...(optionalString(worldClock.worldTime) ? { worldTime: optionalString(worldClock.worldTime) } : {}),
        ...(typeof worldState.version === "number" ? { simulationVersion: worldState.version } : {}),
      },
        identity: {
          agentId: optionalString(binding.identity.identityId),
          explorerId: optionalString(binding.explorer.explorerId),
          requestedAgentId: optionalString(args.agentId) || optionalString(binding.identity.identityId),
          resolvedAgentId: optionalString(binding.identity.identityId),
        },
      experiment: {
        experimentId: binding.experimentId,
        runIndex: binding.runIndex,
        seed: binding.seed,
      },
      run: {
        runId: binding.runId,
        journeyId: binding.journeyId,
        receiptId: binding.receiptId,
      },
    };
  };
  const phase6Sha256 = (value: unknown) => `sha256:${hashRunPayload(value)}`;
  const phase6ChunkContent = (chunk: AnyRecord) =>
    optionalString(chunk.content)
    || optionalString(chunk.text)
    || optionalString(chunk.body)
    || optionalString(chunk.excerpt)
    || optionalString(chunk.summary)
    || JSON.stringify({
      id: optionalString(chunk.chunkId) || optionalString(chunk.id),
      title: optionalString(chunk.title),
      path: optionalString(chunk.path) || optionalString(chunk.sourcePath),
      entityId: optionalString(chunk.entityId),
    });
  const phase6RetrievalConfig = (source: "world_knowledge" | "world_memory", args: AnyRecord) => ({
    retrieverName: source,
    retrieverVersion: "obsidian-epoch-mcp-server-retriever-v1",
    corpusVersion: source === "world_knowledge"
      ? "canonical-world-content-registry-v1"
      : "solidified-world-memory-v1",
    rankingVersion: "mcp-result-order-v1",
    retrievalMode: "hybrid",
    limit: typeof args.limit === "number" ? Math.max(1, Math.min(30, Math.trunc(args.limit))) : 10,
    filters: {
      ...(optionalString(args.collection) ? { collection: optionalString(args.collection) } : {}),
      ...(optionalString(args.entityId) ? { entityId: optionalString(args.entityId) } : {}),
      ...(optionalString(args.regionId) ? { regionId: optionalString(args.regionId) } : {}),
      ...(optionalString(args.fromWorldTime) ? { fromWorldTime: optionalString(args.fromWorldTime) } : {}),
      ...(optionalString(args.toWorldTime) ? { toWorldTime: optionalString(args.toWorldTime) } : {}),
    },
  });
  const phase6RetrievedChunks = (result: AnyRecord) => {
    const chunks = [
      ...recordArray(result.retrievedChunks),
      ...recordArray(recordValue(result.retrieval).chunks),
      ...recordArray(result.chunks),
      ...recordArray(result.hits),
    ];
    return chunks.flatMap((chunk, index) => {
      const chunkId = optionalString(chunk.chunkId) || optionalString(chunk.id);
      const documentId = optionalString(chunk.documentId) || optionalString(chunk.docId) || optionalString(chunk.entityId) || chunkId;
      const sourceId = optionalString(chunk.sourceId)
        || optionalString(chunk.source)
        || optionalString(chunk.sourcePath)
        || optionalString(chunk.path)
        || documentId;
      const rank = Number(chunk.rank ?? index + 1);
      if (!chunkId || !documentId || !sourceId || !Number.isInteger(rank)) return [];
      const content = phase6ChunkContent(chunk);
      return [{
        chunkId,
        documentId,
        sourceId,
        sourceHash: phase6Sha256({ sourceId, documentId, content }),
        rank,
        ...(typeof chunk.score === "number" ? { score: chunk.score } : {}),
        ...(typeof chunk.relevance === "number" ? { relevance: chunk.relevance } : {}),
        quoteHash: phase6Sha256({ chunkId, content }),
        ...(isRecord(chunk.metadata) ? { metadata: chunk.metadata } : {}),
      }];
    });
  };
  const phase6InjectedChunkIds = (retrievedChunks: readonly AnyRecord[]) =>
    retrievedChunks.map((chunk) => optionalString(chunk.chunkId)).filter((id): id is string => Boolean(id));
  const phase6GroundingHits = (
    chunks: readonly AnyRecord[],
    retrievedChunkIds: ReadonlySet<string>,
    sourceEventIds: readonly string[],
  ) => {
    return chunks.flatMap((chunk, index) => {
      const chunkId = optionalString(chunk.chunkId);
      const documentId = optionalString(chunk.documentId);
      const sourceId = optionalString(chunk.sourceId);
      if (!chunkId || !documentId || !sourceId || !retrievedChunkIds.has(chunkId)) return [];
      return [{
        hitId: `server-grounding-${index + 1}:${chunkId}`,
        chunkId,
        documentId,
        sourceId,
        citationId: `mcp:${chunkId}`,
        quoteHash: optionalString(chunk.quoteHash),
        eventIds: sourceEventIds,
      }];
    });
  };
  const capturePhase6RagTraceForResult = async (
    source: "world_knowledge" | "world_memory",
    args: AnyRecord,
    resultValue: unknown,
  ) => {
    const binding = phase6BindingFromRagArgs(args);
    if (!binding) return undefined;
    const result = recordValue(resultValue);
    await validatePhase6ExperimentBinding(binding);
    const retrievedChunks = phase6RetrievedChunks(result);
    const retrievedChunkIds = new Set(retrievedChunks.map((chunk) => chunk.chunkId));
    const serverObservedUsedChunkIds = phase6InjectedChunkIds(retrievedChunks)
      .filter((chunkId) => retrievedChunkIds.has(chunkId));
    const journeyId = optionalString(binding.journeyId);
    if (!journeyId) throw new Error("phase6_rag_trace_journey_binding_missing");
    const sourceEventIds = phase6RagRunAnchorEventIds(phase6EventsFromView({
      ...args,
      agentId: optionalString(binding.identity.identityId),
      limit: 100,
    }), journeyId);
    if (sourceEventIds.length === 0) {
      throw new Error("phase6_rag_trace_run_anchor_missing");
    }
    const groundingHits = phase6GroundingHits(retrievedChunks, retrievedChunkIds, sourceEventIds);
    const retrievalConfig = phase6RetrievalConfig(source, args);
    const retrievalExpected = Boolean(optionalString(args.query));
    const serverNoRetrievalReason = optionalString(result.noRetrievalReason)
      || optionalString(result.retrievalPolicyReason)
      || optionalString(recordValue(result.retrieval).noRetrievalReason);
    const allowedNoRetrievalReason = (
      serverNoRetrievalReason === "not_needed"
      || serverNoRetrievalReason === "policy_skipped"
      || serverNoRetrievalReason === "empty_query"
      || serverNoRetrievalReason === "upstream_disabled"
    ) ? serverNoRetrievalReason : undefined;
    if (!retrievalExpected && !allowedNoRetrievalReason) {
      throw new Error("phase6_rag_trace_no_retrieval_policy_reason_missing");
    }
    if (retrievalExpected && retrievedChunks.length === 0) {
      throw new Error("phase6_rag_trace_source_missing");
    }
    const serverEvaluation = retrievalExpected
      ? buildPhase6RagServerEvaluation({
        runIndex: binding.runIndex,
        retrievedChunks: retrievedChunks.map((chunk) => ({
          sourceId: optionalString(chunk.sourceId) || "",
          rank: Number(chunk.rank),
        })),
        sourceEventIds,
      })
      : undefined;
    return runtime.epochCapturePhase6RagTrace({
      binding: phase6TraceBinding(binding, args),
      query: optionalString(args.query),
      source,
      ...(Object.keys(retrievalConfig).length > 0 ? { retrievalConfig } : {}),
      retrievedChunks,
      serverObservedUsedChunkIds,
      serverObservedGroundingHits: groundingHits,
      retrievalExpected,
      ...(allowedNoRetrievalReason ? { noRetrievalReason: allowedNoRetrievalReason } : {}),
      ...(serverEvaluation ? { serverEvaluation } : {}),
      recordedAt: new Date().toISOString(),
      sourceEventIds,
    });
  };
    const requirePhase6AuthoritativeRecord = (value: unknown, path: string) => {
      const record = recordValue(value);
      if (Object.keys(record).length === 0) throw new Error(`phase6_settlement_context_missing:${path}`);
      return record;
    };
    const phase6ContextPrivateField = /(?:api[_-]?key|secret|token|password|credential|private[_-]?key|signature|recovery[_-]?code|authorization)/iu;
    const phase6DefinedValue = (value: unknown): unknown => {
      if (Array.isArray(value)) {
        return value.flatMap((entry) => entry === undefined ? [] : [phase6DefinedValue(entry)]);
      }
      if (!isRecord(value)) return value;
      return Object.fromEntries(Object.entries(value)
        .filter(([key, entry]) => entry !== undefined && !phase6ContextPrivateField.test(key))
        .map(([key, entry]) => [key, phase6DefinedValue(entry)]));
    };
    const phase6DefinedRecord = (value: unknown, path: string) =>
      requirePhase6AuthoritativeRecord(phase6DefinedValue(value), path);
  const phase6EventsFromView = (input: AnyRecord) => {
    const events = recordValue(runtime.epochEvents(input)).events;
    return Array.isArray(events)
      ? events.filter((event): event is EpochEvent => isRecord(event))
      : [];
  };
  const phase6EconomySnapshot = (label: string, agentId: string, progress: AnyRecord, inventory: AnyRecord, worldMinute: unknown) => {
    const resources = recordValue(progress.resources);
    const resourceEntries = Object.entries(resources)
      .filter((entry): entry is [string, number] => typeof entry[1] === "number" && Number.isFinite(entry[1]))
      .map(([resourceId, amount]) => ({
        accountRef: `agent:${agentId}`,
        assetKey: `resource:${resourceId}`,
        unit: "unit",
        bucket: "available",
        quantityMinor: String(Math.trunc(amount * 100)),
      }));
    const inventoryItems = Array.isArray(inventory.items)
      ? inventory.items
      : Array.isArray(progress.inventoryItems)
        ? progress.inventoryItems
        : [];
    const itemEntries = inventoryItems
      .filter((item): item is AnyRecord => isRecord(item))
      .map((item) => ({
        accountRef: `agent:${agentId}`,
        assetKey: `item:${optionalString(item.itemKey) || optionalString(item.itemId) || "unknown"}`,
        unit: "item",
        bucket: "available",
        quantityMinor: "1",
      }));
    const minute = Number(worldMinute);
    return {
      snapshotVersion: PHASE6_ECONOMY_SNAPSHOT_VERSION,
      snapshotId: `phase6:${label}:${hashRunPayload({ agentId, resources, inventoryItems })}`,
      ...(Number.isSafeInteger(minute) ? { asOfWorldMinute: minute } : {}),
      entries: [...resourceEntries, ...itemEntries],
    };
  };
  const phase6ResourcePresentation = (
    agentId: string,
    walletValue: unknown,
    progressionValue: unknown,
    canonicalEvents: readonly EpochEvent[],
  ) => {
    const wallet = requirePhase6AuthoritativeRecord(walletValue, "player.wallet");
    const progression = requirePhase6AuthoritativeRecord(progressionValue, "player.progression");
    const resourceIdForRow = (row: AnyRecord): string | undefined => {
      const direct = optionalString(row.resourceId)
        || optionalString(row.resourceKey)
        || optionalString(row.currencyId)
        || optionalString(row.materialId);
      if (direct) return direct;
      const assetKey = optionalString(row.assetKey);
      return assetKey?.startsWith("resource:") ? assetKey.slice("resource:".length) : undefined;
    };
    const rowsFromWallet = (field: string) => Array.isArray(wallet[field])
      ? wallet[field].filter((row): row is AnyRecord => isRecord(row))
      : [];
    const rowsByResource = (rows: readonly AnyRecord[]) => {
      const result = new Map<string, AnyRecord>();
      for (const row of rows) {
        const resourceId = resourceIdForRow(row);
        if (resourceId) result.set(resourceId, row);
      }
      return result;
    };
    const currencyRows = rowsByResource(rowsFromWallet("currencies"));
    const resourceRows = rowsByResource(rowsFromWallet("resources"));
    const materialRows = rowsByResource(rowsFromWallet("materials"));

    // The causal player-panel wallet can omit the resource ledger. Rebuild
    // every displayed balance from canonical grant/spend events, retaining
    // both the server's latest balance and the source event ids.
    const activityByResource = new Map<string, Extract<EpochEvent, {
      readonly eventType: "resource_granted" | "resource_spent";
    }>[]>();
    for (const event of canonicalEvents) {
      if ((event.eventType !== "resource_granted" && event.eventType !== "resource_spent")
        || event.agentId !== agentId) continue;
      const activity = activityByResource.get(event.payload.resourceId) ?? [];
      activity.push(event);
      activityByResource.set(event.payload.resourceId, activity);
    }
    for (const [resourceId, activity] of activityByResource) {
      const reward = phase6JourneyMaterialRewardForResource(resourceId);
      const ordered = [...activity].sort((left, right) =>
        left.createdAt.localeCompare(right.createdAt) || left.eventId.localeCompare(right.eventId));
      const latest = ordered.at(-1);
      if (!latest) continue;
      const sourceEventIds = ordered
        .filter((event) => event.eventType === "resource_granted")
        .map((event) => event.eventId);
      const resourceClass = reward
        ? "material"
        : resourceId === "coin" || resourceId === "legend"
          ? "currency"
          : "resource";
      const targetRows = resourceClass === "material"
        ? materialRows
        : resourceClass === "currency"
          ? currencyRows
          : resourceRows;
      const existing = targetRows.get(resourceId);
      targetRows.set(resourceId, {
        ...existing,
        accountRef: optionalString(existing?.accountRef) || latest.payload.accountRef,
        assetKey: optionalString(existing?.assetKey) || latest.payload.assetKey,
        resourceKey: resourceId,
        resourceId,
        resourceClass,
        unit: optionalString(existing?.unit) || latest.payload.unit,
        quantityMinor: String(Math.trunc(latest.payload.balanceAfter * 100)),
        sourceEventIds,
        ...(reward ? {
          materialId: reward.materialId,
          materialClass: reward.materialClass,
          usageRefs: reward.usageRefs,
        } : {}),
      });
    }
    const sortedRows = (rows: ReadonlyMap<string, AnyRecord>) => [...rows.values()].sort((left, right) =>
      (resourceIdForRow(left) || "").localeCompare(resourceIdForRow(right) || ""));
    const materialRowsList = sortedRows(materialRows);
    const resources = recordValue(progression.resources);
    const existingMaterials = Array.isArray(resources.materials)
      ? resources.materials.filter((row): row is AnyRecord => isRecord(row))
      : [];
    const materials = new Map<string, AnyRecord>();
    for (const row of [...existingMaterials, ...materialRowsList]) {
      const materialId = optionalString(row.materialId)
        || optionalString(row.resourceId)
        || optionalString(row.resourceKey);
      if (materialId) materials.set(materialId, row);
    }
    return {
      wallet: {
        ...wallet,
        currencies: sortedRows(currencyRows),
        resources: sortedRows(resourceRows),
        materials: materialRowsList,
      },
      progression: {
        ...progression,
        resources: {
          ...resources,
          materials: [...materials.values()].sort((left, right) =>
            (optionalString(left.materialId) || optionalString(left.resourceId) || "")
              .localeCompare(optionalString(right.materialId) || optionalString(right.resourceId) || "")),
        },
      },
    };
  };
  const phase6PanelProjection = (
    phase: "before" | "after",
    args: AnyRecord,
    journey: AnyRecord,
    canonicalEvents: readonly EpochEvent[],
  ) => {
    const agentId = optionalString(journey.agentId) || optionalString(args.agentId);
    if (!agentId) throw new Error("phase6_settlement_context_missing:agentId");
    const rawProgress = recordValue(runtime.epochProgress({ ...args, agentId }));
      const progress = phase6DefinedRecord({
        ...rawProgress,
      ...(Array.isArray(rawProgress.latestEvents)
        ? {
            latestEvents: rawProgress.latestEvents.map((event) =>
              isRecord(event) ? publicEpochEvent(event as unknown as EpochEvent) : event),
          }
        : {}),
      }, "progress");
      const inventory = phase6DefinedRecord(runtime.epochInventory({ ...args, agentId }), "inventory");
    const playerPanelResult = recordValue(runtime.infiniteWorldPlayerPanel({
      ...args,
      agentId,
      explorerId: optionalString(progress.explorerId) || optionalString(args.explorerId),
      ragLimit: typeof args.ragLimit === "number" ? args.ragLimit : 20,
    }));
      const panel = phase6DefinedRecord(playerPanelResult.panel, "playerPanel");
      const worldClock = phase6DefinedRecord(runtime.epochWorldClock({}), "worldClock");
      const worldState = phase6DefinedRecord(runtime.epochWorldState({
        ...args,
        regionId: optionalString(journey.destinationRegionId) || optionalString(args.regionId),
        includeShipments: true,
      }), "worldState");
    const worldMinute = worldClock.worldMinute || recordValue(worldClock.time).minute;
    const productionSource = recordValue(worldState.production || recordValue(worldState.economy).production);
    const production = Object.keys(productionSource).length > 0
      ? productionSource
      : {
          status: "legitimate_no_production",
          reason: "world_state_has_no_materialized_production",
          regionId: optionalString(worldState.regionId)
            || optionalString(recordValue(worldState.region).regionId)
            || optionalString(journey.destinationRegionId)
            || "epoch:runtime-region",
          ...(Number.isSafeInteger(Number(worldMinute)) ? { asOfWorldMinute: Number(worldMinute) } : {}),
          entries: [],
        };
    const worldTime = optionalString(worldClock.worldTime)
      || optionalString(recordValue(worldClock.time).worldTime)
      || (Number.isSafeInteger(Number(worldMinute)) ? epochWorldTimeFromMinute(Number(worldMinute)) : undefined);
    const economy = {
      inventory,
      inventoryInfo: inventory,
      production,
      snapshot: phase6EconomySnapshot(phase, agentId, progress, inventory, worldMinute),
    };
    const resourcePresentation = phase6ResourcePresentation(
      agentId,
      panel.wallet,
      panel.progression,
      canonicalEvents,
    );
    const ragPanel = projectPhase6PersistentRagPanel({
      ragPanel: requirePhase6AuthoritativeRecord(panel.rag, "ragPanel"),
      canonicalEvents,
      agentId,
    });
    const canonicalCursor = phase6CanonicalCursor(canonicalEvents as Parameters<typeof phase6CanonicalCursor>[0]);
    const worldCursor = {
      ...canonicalCursor,
      worldId: optionalString(worldState.worldId)
        || optionalString(recordValue(worldState.snapshot).worldId)
        || optionalString(args.worldId)
          || "obsidian_epoch",
      regionId: optionalString(worldState.regionId)
        || optionalString(recordValue(worldState.region).regionId)
        || optionalString(journey.destinationRegionId)
        || optionalString(args.regionId)
        || "epoch:runtime-region",
      worldTime: worldTime || canonicalCursor.lastCreatedAt || canonicalCursor.value,
      ...(Number.isSafeInteger(Number(recordValue(worldState.snapshot).simulationVersion))
        ? { simulationVersion: Number(recordValue(worldState.snapshot).simulationVersion) }
        : Number.isSafeInteger(Number(worldState.simulationVersion))
          ? { simulationVersion: Number(worldState.simulationVersion) }
          : {}),
    };
    return {
      panel: {
        phase,
        player: {
          playerId: optionalString(panel.playerId),
          agentId,
          explorerId: optionalString(progress.explorerId) || optionalString(args.explorerId),
          identityId: optionalString(recordValue(progress.identity).identityId) || agentId,
          identity: progress.identity,
          progression: resourcePresentation.progression,
          combatReadiness: requirePhase6AuthoritativeRecord(panel.combat, "player.combatReadiness"),
          wallet: resourcePresentation.wallet,
          injuries: progress.injuries,
          injuryStates: progress.injuryStates,
          production,
        },
        progress,
        economy,
        ragPanel,
        worldCursor,
      },
      projection: {
        events: canonicalEvents,
        rag: ragPanel,
        world: worldState,
        worldClock,
        worldSimulation: worldState,
        inventory,
        resources: progress.resources,
      },
      canonicalCursor: worldCursor,
    };
  };
    const validatePhase6ExperimentBinding = async (binding: NonNullable<ReturnType<typeof phase6BindingFromStartJourneyArgs>>) => {
    const status = recordValue(await runtime.epochPhase6ExperimentStatus({ experimentId: binding.experimentId }));
    if (optionalString(status.experimentId) !== binding.experimentId) {
      throw new Error("phase6_settlement_binding_conflict:experimentId");
    }
    const persistedExplorer = phase6ExperimentExplorerForStatus(status);
    if (optionalString(persistedExplorer.explorerId) !== optionalString(binding.explorer.explorerId)) {
      throw new Error("phase6_settlement_binding_conflict:explorer");
    }
    const statusIdentity = recordValue(status.identity);
    const statusIdentityId = optionalString(statusIdentity.identityId);
    if (statusIdentityId !== optionalString(binding.identity.identityId)) {
      const archive = recordValue(runtime.epochIdentityArchive({ agentId: optionalString(binding.identity.identityId) || "" }));
      const lineage = Array.isArray(archive.lineage) ? archive.lineage : [];
      if (!lineage.includes(statusIdentityId || "")) {
        throw new Error("phase6_settlement_binding_conflict:identity");
      }
    }
    const statusVersions = recordValue(status.versions);
    for (const key of ["rulesVersion", "catalogVersion", "codeVersion"] as const) {
      if (optionalString(statusVersions[key]) !== binding.versions[key]) {
        throw new Error(`phase6_settlement_binding_conflict:${key}`);
      }
    }
    const statusScenarioMatrix = recordValue(status.scenarioMatrix);
    if (optionalString(statusScenarioMatrix.version) !== binding.scenarioMatrix.version) {
      throw new Error("phase6_settlement_binding_conflict:scenarioMatrixVersion");
    }
      return status;
    };
    const phase6BindingFromStoredJourney = (journeyId: string) => {
      let storedContext: AnyRecord;
      try {
        storedContext = recordValue(runtime.epochLoadPhase6JourneyContext(journeyId));
      } catch (error) {
        if (error instanceof Error && error.message === "phase6_journey_context_runtime_required") return undefined;
        throw error;
      }
      if (Object.keys(storedContext).length === 0) return undefined;
      const metadata = recordValue(storedContext.metadata);
      const experimentId = optionalString(metadata.experimentId);
      const runIndex = Number(metadata.runIndex);
      if (!experimentId || !Number.isInteger(runIndex)) {
        throw new Error("phase6_settlement_context_missing:metadata");
      }
      const run = recordValue(runtime.epochPhase6ExperimentRunByJourneyId({ journeyId })
        || runtime.epochPhase6ExperimentRun({ experimentId, runIndex }));
      if (Object.keys(run).length === 0) {
        throw new Error("phase6_settlement_context_missing:experiment_run");
      }
      const runReceipt = recordValue(run.runReceipt);
      const runSeed = recordValue(run.seed);
      const metadataSeed = recordValue(metadata.seed);
      const runIdentity = recordValue(run.identity);
      const runExplorer = recordValue(run.explorer);
      const runScenarioMatrix = recordValue(run.scenarioMatrix);
      const runVersions = recordValue(run.versions);
      const binding = phase6BindingFromStartJourneyArgs({
        startJourneyBinding: {
          experimentId,
          runIndex,
          scenarioTag: phase6ScenarioForRun(runIndex).tag,
          seed: optionalString(runSeed.seed) || optionalString(metadataSeed.seed),
          receiptId: optionalString(runReceipt.receiptId),
          receiptVersion: optionalString(runReceipt.receiptVersion),
          journeyId,
          runId: optionalString(metadata.runId),
          identity: Object.keys(runIdentity).length > 0 ? runIdentity : recordValue(metadata.identity),
          explorer: runExplorer,
          scenarioMatrix: Object.keys(runScenarioMatrix).length > 0
            ? runScenarioMatrix
            : recordValue(metadata.scenarioMatrix),
          versions: Object.keys(runVersions).length > 0 ? runVersions : recordValue(metadata.versions),
          runReceipt,
        },
      });
      if (!binding) throw new Error("phase6_settlement_context_missing:binding");
      return { binding, storedContext };
    };
  const completePhase6Run = async (
    binding: NonNullable<ReturnType<typeof phase6BindingFromStartJourneyArgs>>,
    journey: AnyRecord,
    receipt: AnyRecord,
  ) => {
    const receiptExplorerId = optionalString(receipt.explorerId);
    if (receiptExplorerId && receiptExplorerId !== optionalString(binding.explorer.explorerId)) {
      throw new Error("phase6_settlement_binding_conflict:receipt.explorerId");
    }
    return runtime.epochCompletePhase6ExperimentRun({
      commandId: `phase6-start-journey:${optionalString(journey.journeyId)}:complete:${optionalString(receipt.receiptId)}`,
      experimentId: binding.experimentId,
      runIndex: binding.runIndex,
      receipt: {
        receiptVersion: "journey_run_receipt.v2",
        experimentId: binding.experimentId,
        runIndex: binding.runIndex,
        identity: binding.identity,
        explorer: binding.explorer,
        explorerId: binding.explorer.explorerId,
        versions: binding.versions,
        seed: { seed: binding.seed },
        receiptId: optionalString(receipt.receiptId),
        scenarioTag: optionalString(binding.scenarioTag) || phase6ScenarioForRun(binding.runIndex).tag,
        matrixSnapshot: binding.scenarioMatrix,
        matrixVersion: PHASE6_MATRIX_VERSION,
      },
    });
  };
  const phase6StoredFailureReason = (reason: string) => {
    const normalized = reason.trim();
    return normalized.length > 0
      && normalized.length <= 160
      && /^[a-z0-9_.:-]+$/iu.test(normalized)
      && !/(?:api[_-]?key|secret|token|password|credential|private[_-]?key|signature)/iu.test(normalized)
      ? normalized
      : "phase6_run_failed";
  };
  const failPhase6Run = async (
    binding: NonNullable<ReturnType<typeof phase6BindingFromStartJourneyArgs>>,
    journeyId: string,
    reason: string,
  ) => runtime.epochFailPhase6ExperimentRun({
    commandId: `phase6-start-journey:${journeyId || binding.experimentId}:fail:${hashRunPayload(reason).slice(0, 16)}`,
    experimentId: binding.experimentId,
    runIndex: binding.runIndex,
    reason: phase6StoredFailureReason(reason),
  });
    const phase6RagTracePayload = (value: unknown) => {
      const record = recordValue(value);
      const trace = recordValue(record.trace);
      return Object.keys(trace).length > 0 ? trace : record;
    };
    const phase6RagTraceForBinding = (
      binding: NonNullable<ReturnType<typeof phase6BindingFromStartJourneyArgs>>,
    ) => {
      const traces = runtime.epochListPhase6RagTraces({
      experimentId: binding.experimentId,
      runIndex: binding.runIndex,
      journeyId: binding.journeyId,
      limit: 20,
    });
      const stored = Array.isArray(traces)
        ? traces.find((trace) => recordValue(trace).status === "ok")
          ?? traces.find((trace) => recordValue(trace).status === "legitimate_no_retrieval")
        : undefined;
      return stored ? phase6RagTracePayload(stored) : undefined;
  };
  const phase6SourceMissingFinding = (path: string, source: string, message: string) => ({
    code: "source_missing",
    severity: "error",
    path,
    source,
    message,
  });
  const phase6CanonicalEventIds = (events: readonly EpochEvent[]) => [
    ...new Set(events.map((event) => optionalString((event as unknown as AnyRecord).eventId) || optionalString((event as unknown as AnyRecord).id)).filter(Boolean)),
  ];
  const phase6SettlementEventIds = (committedResults: readonly ReturnType<typeof runtime.epochCommitJourneyAction>[]) =>
    phase6CanonicalEventIds(committedResults.flatMap((committed) => epochEventsForPersistence(committed)));
    const phase6SnapshotReceipt = (panel: unknown, path: string) => {
      const snapshot = buildPhase6PanelSnapshotDocument(panel as Parameters<typeof buildPhase6PanelSnapshotDocument>[0]);
      if (snapshot.ok !== true) {
        const findings = snapshot.errors
          .slice(0, 8)
          .map((entry) => `${entry.code}@${entry.path}:${entry.message.slice(0, 180)}`)
          .join(",");
        throw new Error(`phase6_settlement_snapshot_invalid:${path}:${findings || "unknown"}`);
      }
      return {
      body: snapshot.value.snapshot,
      hash: snapshot.value.hash,
    };
  };
  const phase6StructuredDeltas = (
    beforeProjection: unknown,
    afterProjection: unknown,
    canonicalEvents: readonly EpochEvent[],
  ) => {
    const projectionDelta = buildPhase6ProjectionDelta({
      before: beforeProjection as Parameters<typeof buildPhase6ProjectionDelta>[0]["before"],
      after: afterProjection as Parameters<typeof buildPhase6ProjectionDelta>[0]["after"],
      canonicalEvents: canonicalEvents as Parameters<typeof buildPhase6ProjectionDelta>[0]["canonicalEvents"],
    });
    const eventIds = phase6CanonicalEventIds(canonicalEvents);
    if (eventIds.length === 0) return [];
    return [{
      op: projectionDelta.worldDelta.changed || projectionDelta.ragDelta.changed ? "set" : "link",
      target: {
        kind: "phase6_projection_delta",
        id: projectionDelta.cursor.value,
      },
      path: ["phase6", "projectionDelta"],
      after: phase6DefinedValue(projectionDelta.receipt),
      reason: "server_canonical_projection_delta",
      eventIds,
    }];
  };
  const phase6EventWithCursorEvidence = (
    event: EpochEvent,
    beforeCursor: AnyRecord,
    afterCursor: AnyRecord,
  ): EpochEvent => {
    const record = event as unknown as AnyRecord;
    return {
      ...record,
      beforeWorldCursor: record.beforeWorldCursor || record.worldCursorBefore || beforeCursor,
      afterWorldCursor: record.afterWorldCursor || record.worldCursorAfter || record.worldCursor || afterCursor,
    } as unknown as EpochEvent;
  };
    const phase6FinalizedSidecar = (
    binding: NonNullable<ReturnType<typeof phase6BindingFromStartJourneyArgs>>,
    journey: AnyRecord,
    finalized: AnyRecord,
    canonicalEvents: readonly EpochEvent[],
    worldCursor: AnyRecord,
  ) => {
    const assembly = recordValue(recordValue(finalized.assembly).assembly);
    const artifacts = recordValue(assembly.artifacts);
    const resultPageOutput = recordValue(artifacts.resultPageOutput);
    const settledReceipt = recordValue(artifacts.receipt);
    if (resultPageOutput.ok !== true || resultPageOutput.verified !== true || optionalString(settledReceipt.version) !== "journey_run_receipt.v2") {
      throw new Error("phase6_settlement_finalized_v2_sidecar_missing");
    }
    const resultPageReceipt = recordValue(recordValue(resultPageOutput.page).receipt);
    if (optionalString(settledReceipt.receiptId) !== optionalString(resultPageReceipt.receiptId)) {
      throw new Error("phase6_settlement_finalized_v2_sidecar_receipt_mismatch");
    }
    const expectedReceiptHash = optionalString(recordValue(settledReceipt.integrity).payloadHash);
    const pageAudit = recordValue(recordValue(recordValue(resultPageOutput.page).sections).audit);
    const pageIntegrity = recordValue(pageAudit.integrity);
    const pageReceiptHash = optionalString(pageIntegrity.receiptPayloadHash);
    const receiptIntegrityHash = optionalString(recordValue(settledReceipt.integrity).payloadHash);
    if (pageReceiptHash !== expectedReceiptHash || receiptIntegrityHash !== expectedReceiptHash) {
      throw new Error("phase6_settlement_finalized_v2_receipt_hash_mismatch");
    }
    const receiptEventGroups = recordValue(settledReceipt.eventIds);
    const receiptEventIds = [
      ...(Array.isArray(receiptEventGroups.source) ? receiptEventGroups.source : []),
      ...(Array.isArray(receiptEventGroups.settlement) ? receiptEventGroups.settlement : []),
      ...(Array.isArray(receiptEventGroups.derived) ? receiptEventGroups.derived : []),
    ].map(optionalString).filter(Boolean);
    const canonicalIds = new Set(phase6CanonicalEventIds(canonicalEvents));
    for (const [path, expected, actual] of [
      ["receipt.experimentId", binding.experimentId, optionalString(settledReceipt.experimentId)],
      ["receipt.runIndex", String(binding.runIndex), String(settledReceipt.runIndex ?? "")],
      ["receipt.seed", binding.seed, optionalString(settledReceipt.seed)],
      ["receipt.journeyId", binding.journeyId, optionalString(settledReceipt.journeyId)],
      ["receipt.journeyId.current", optionalString(journey.journeyId), optionalString(settledReceipt.journeyId)],
      ["receipt.explorerId", binding.explorer.explorerId, optionalString(settledReceipt.explorerId)],
      ["receipt.rulesetVersion", binding.versions.rulesVersion, optionalString(settledReceipt.rulesetVersion)],
      ["receipt.catalogVersion", binding.versions.catalogVersion, optionalString(settledReceipt.catalogVersion)],
      ["receipt.codeVersion", binding.versions.codeVersion, optionalString(settledReceipt.codeVersion)],
      ["receipt.scenarioMatrixVersion", binding.scenarioMatrix.version, optionalString(settledReceipt.scenarioMatrixVersion)],
      ["receipt.world.worldId", optionalString(worldCursor.worldId), optionalString(recordValue(settledReceipt.world).worldId)],
      ["receipt.world.regionId", optionalString(worldCursor.regionId), optionalString(recordValue(settledReceipt.world).regionId)],
      ["receipt.world.worldTimeAfter", optionalString(worldCursor.worldTime), optionalString(recordValue(settledReceipt.world).worldTimeAfter)],
    ] as const) {
      if (!expected || expected !== actual) throw new Error(`phase6_settlement_finalized_v2_binding_mismatch:${path}`);
    }
    if (receiptEventIds.length === 0 || receiptEventIds.some((eventId) => !canonicalIds.has(eventId))) {
      throw new Error("phase6_settlement_finalized_v2_event_binding_mismatch");
    }
    const sidecar = {
      ok: true,
      verified: true,
      findings: [],
      page: resultPageOutput.page,
    };
    const pageId = optionalString(recordValue(resultPageOutput.page).pageId)
      || `phase6_result_${optionalString(settledReceipt.receiptId)}`;
    const storedResultPage = {
      pageId,
      createdAt: optionalString(settledReceipt.generatedAt) || new Date().toISOString(),
      urlPath: `/phase6/result/${encodeURIComponent(pageId)}`,
      createdBy: "obsidian_epoch.phase6",
      idempotencyKey: `phase6-result:${optionalString(settledReceipt.receiptId)}`,
      status: "active",
      shareVersion: 1,
      payload: {
        receipt: { phase6: sidecar },
      },
    } as unknown as EpochSharedResultPage;
    runtime.epochStorePhase6ResultPage(storedResultPage);
      return { pageId, sidecar, receipt: settledReceipt, resultPageOutput, storedResultPage };
    };
    const phase6SettlementCache = new Map<string, AnyRecord>();
    const finalizePhase6JourneyFromPersistedState = async (input: {
      readonly args: AnyRecord;
      readonly binding: NonNullable<ReturnType<typeof phase6BindingFromStartJourneyArgs>>;
      readonly current: AnyRecord;
      readonly committedResults?: readonly ReturnType<typeof runtime.epochCommitJourneyAction>[];
      readonly experimentStatus?: unknown;
      readonly capture?: unknown;
      readonly ragTrace?: unknown;
      readonly storedContext?: AnyRecord;
      readonly journeyRuntime?: unknown;
    }) => {
      const journey = recordValue(input.current.journey);
      if (optionalString(journey.status) !== "settled") {
        return {
          ok: true,
          status: "captured",
          experimentStatus: input.experimentStatus,
          capture: input.capture,
          startJourneyBinding: input.binding,
        };
      }
      const journeyId = optionalString(journey.journeyId);
      if (!journeyId) throw new Error("phase6_settlement_context_missing:journeyId");
      const cached = phase6SettlementCache.get(journeyId);
      if (cached) return cached;
      const storedContext = input.storedContext
        || recordValue(runtime.epochLoadPhase6JourneyContext(journeyId));
      if (Object.keys(storedContext).length === 0) {
        throw new Error("phase6_settlement_context_missing:stored_before_context");
      }
      const settledReceiptId = optionalString(storedContext.settledReceiptId);
      if (settledReceiptId) {
        const receipt = recordValue(loadPhase6ReceiptFromSqlite(phase6ReceiptSqlite, settledReceiptId));
        if (Object.keys(receipt).length === 0) {
          throw new Error("phase6_settlement_context_missing:settled_receipt");
        }
        const restored = {
          ok: true,
          status: "settled",
          restored: true,
          experimentStatus: input.experimentStatus,
          receiptId: settledReceiptId,
          receipt,
        };
        phase6SettlementCache.set(journeyId, restored);
        return restored;
      }

      const failSettlement = async (status: string, reason: string, details: AnyRecord = {}) => {
        const experimentRun = await failPhase6Run(input.binding, journeyId, reason);
        return {
          ok: false,
          status,
          experimentStatus: input.experimentStatus,
          capture: input.capture,
          ...details,
          experimentRun,
        };
      };

      try {
        const beforeSnapshot = requirePhase6AuthoritativeRecord(
          storedContext.beforeSnapshot,
          "stored.beforeSnapshot",
        );
        const storedMetadata = requirePhase6AuthoritativeRecord(
          storedContext.metadata,
          "stored.metadata",
        );
        const storedVersions = requirePhase6AuthoritativeRecord(
          storedMetadata.versions,
          "stored.metadata.versions",
        );
        const storedSeed = requirePhase6AuthoritativeRecord(
          storedMetadata.seed,
          "stored.metadata.seed",
        );
        const storedScenarioMatrix = requirePhase6AuthoritativeRecord(
          storedMetadata.scenarioMatrix,
          "stored.metadata.scenarioMatrix",
        );
        const beforeEconomy = requirePhase6AuthoritativeRecord(
          beforeSnapshot.economy,
          "stored.beforeSnapshot.economy",
        );
        const economyBefore = requirePhase6AuthoritativeRecord(
          beforeEconomy.snapshot,
          "stored.beforeSnapshot.economy.snapshot",
        );
        const afterEvents = phase6EventsFromView({ ...input.args, limit: 1_000 });
        const storedCanonicalCursor = requirePhase6AuthoritativeRecord(
          storedContext.canonicalCursor,
          "stored.canonicalCursor",
        );
        const runEvents = phase6EventsAfterCursor(afterEvents, {
          eventCount: Number(storedCanonicalCursor.eventCount),
          lastEventId: optionalString(storedCanonicalCursor.lastEventId),
          lastCreatedAt: optionalString(storedCanonicalCursor.lastCreatedAt),
        });
        const explicitCommittedResults = input.committedResults && input.committedResults.length > 0
          ? input.committedResults
          : undefined;
        const committedResults = explicitCommittedResults
          ?? phase6CommittedResults?.listByJourneyId(journeyId).map((record: Phase6CommittedResultRecord) => record.result)
          ?? [];
        if (committedResults.length === 0) {
          throw new Error("phase6_settlement_context_missing:committed_results_sidecar");
        }
        const rawCanonicalEvents = [...new Map([
          ...runEvents,
          ...committedResults.flatMap((committed: Record<string, unknown>) => epochEventsForPersistence(committed)),
        ].map((event) => [event.eventId, event])).values()];
        const globalEvents = [...new Map([
          ...afterEvents,
          ...committedResults.flatMap((committed: Record<string, unknown>) => epochEventsForPersistence(committed)),
        ].map((event) => [event.eventId, event])).values()];
        const initialAfter = phase6PanelProjection("after", input.args, journey, globalEvents);
        const beforeWorldCursor = recordValue(beforeSnapshot.worldCursor);
        const afterWorldCursor = recordValue(initialAfter.panel.worldCursor);
        let previousWorldCursor = beforeWorldCursor;
        const canonicalEvents = rawCanonicalEvents.map((event) => {
          const withCursor = phase6EventWithCursorEvidence(event, previousWorldCursor, afterWorldCursor);
          previousWorldCursor = afterWorldCursor;
          return withCursor;
        });
        const after = phase6PanelProjection("after", input.args, journey, globalEvents);
        const persistedRagTrace = phase6RagTracePayload(
          input.ragTrace || phase6RagTraceForBinding(input.binding),
        );
        if (!persistedRagTrace) {
          return failSettlement(
            "pre_settlement_failed",
            "phase6_rag_trace_required_missing",
            {
              findings: [phase6SourceMissingFinding(
                "$.persistedRagTrace",
                "phase6_rag_trace_store",
                "Strict Phase 6 settlement requires a server-persisted RAG trace or explicit legitimate_no_retrieval trace for the run/journey binding.",
              )],
            },
          );
        }
        const outcomeEvidence = buildPhase6ServerOutcomeEvidence({
          canonicalEvents,
          committedResults,
          journeyBinding: {
            runId: optionalString(storedMetadata.runId),
            journeyId,
            agentId: optionalString(journey.agentId) || optionalString(input.args.agentId) || "",
            explorerId: optionalString(input.binding.explorer.explorerId),
            receiptId: input.binding.receiptId,
            status: optionalString(journey.status),
            settledAt: optionalString(journey.settledAt),
            updatedAt: optionalString(journey.updatedAt),
          },
          worldCursor: afterWorldCursor as unknown as Parameters<typeof buildPhase6ServerOutcomeEvidence>[0]["worldCursor"],
          journeyEndState: journey,
        });
        if (outcomeEvidence.ok !== true) {
          return failSettlement("outcome_evidence_failed", "phase6_outcome_evidence_failed", {
            findings: outcomeEvidence.findings,
          });
        }
        const sourceEventIds = phase6CanonicalEventIds(canonicalEvents);
        const settlementEventIds = phase6SettlementEventIds(committedResults as Parameters<typeof phase6SettlementEventIds>[0]);
        // RAG retrieval cites run-start anchor events (e.g. identity_issued) that fall
        // before the run cursor and are therefore absent from canonicalEvents. Accept
        // them as binding anchors only when they really exist in the persisted event
        // stream, so the trace still cannot fabricate ids.
        const ragTraceRecord = recordValue(persistedRagTrace);
        const readStringArray = (value: unknown): readonly string[] => {
          if (!Array.isArray(value)) return [];
          return value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
        };
        const ragReferencedEventIds = new Set<string>();
        for (const id of readStringArray(ragTraceRecord.sourceEventIds)) {
          ragReferencedEventIds.add(id);
        }
        const groundingHits: readonly unknown[] = Array.isArray(ragTraceRecord.groundingHits)
          ? ragTraceRecord.groundingHits
          : [];
        for (const hit of groundingHits) {
          for (const id of readStringArray(recordValue(hit).eventIds)) {
            ragReferencedEventIds.add(id);
          }
        }
        const persistedEventIds = new Set(afterEvents.map((event) => event.eventId));
        const bindingAnchorEventIds = [...ragReferencedEventIds].filter((id) => persistedEventIds.has(id));
        const now = new Date().toISOString();
        const preSettlementStores = {
          beforePanel: beforeSnapshot,
          beforeProjection: beforeSnapshot,
          economyBefore,
          experiment: {
            experimentId: optionalString(storedMetadata.experimentId),
            runIndex: Number(storedMetadata.runIndex),
            seed: optionalString(storedSeed.seed),
          },
          version: {
            rulesetVersion: optionalString(storedVersions.rulesVersion),
            catalogVersion: optionalString(storedVersions.catalogVersion),
            codeVersion: optionalString(storedVersions.codeVersion),
            scenarioMatrixVersion: optionalString(storedScenarioMatrix.version),
          },
          beforeWorldCursor,
        } as unknown as Parameters<typeof buildPhase6ServerPreSettlement>[0]["stores"];
        const preSettlement = buildPhase6ServerPreSettlement({
          stores: preSettlementStores,
          runtime: {
            metadata: {
              runId: optionalString(storedMetadata.runId) || "",
              journeyId,
              agentId: optionalString(journey.agentId) || optionalString(input.args.agentId) || "",
              explorerId: optionalString(input.binding.explorer.explorerId) || "",
              receiptId: input.binding.receiptId || "",
              generatedAt: now,
              startedAt: optionalString(journey.startedAt) || now,
              settledAt: optionalString(journey.settledAt) || optionalString(journey.updatedAt) || now,
              world: {
                worldId: optionalString(afterWorldCursor.worldId) || "",
                regionId: optionalString(afterWorldCursor.regionId) || "",
                worldTimeBefore: optionalString(beforeWorldCursor.worldTime) || "",
                worldTimeAfter: optionalString(afterWorldCursor.worldTime) || "",
                ...(Number.isSafeInteger(Number(afterWorldCursor.simulationVersion))
                  ? { simulationVersion: Number(afterWorldCursor.simulationVersion) }
                  : {}),
              },
            },
            afterPanel: after.panel as unknown as Parameters<typeof buildPhase6ServerPreSettlement>[0]["runtime"]["afterPanel"],
            afterProjection: after.projection,
            canonicalEvents,
            bindingAnchorEventIds,
            economy: {
              next: requirePhase6AuthoritativeRecord(after.panel.economy.snapshot, "after.economy.snapshot") as unknown as Parameters<typeof buildPhase6ServerPreSettlement>[0]["runtime"]["economy"]["next"],
              sourceEvents: canonicalEvents,
            },
            worldCursor: afterWorldCursor as unknown as Parameters<typeof buildPhase6ServerPreSettlement>[0]["runtime"]["worldCursor"],
            now,
            journeyRuntime: (input.journeyRuntime || input.current) as Parameters<typeof buildPhase6ServerPreSettlement>[0]["runtime"]["journeyRuntime"],
          },
          serverOutcomeResolution: outcomeEvidence.value.serverOutcomeResolution,
          serverActionResolutions: outcomeEvidence.value.serverActionResolutions as unknown as Parameters<typeof buildPhase6ServerPreSettlement>[0]["serverActionResolutions"],
          receiptBasis: {
            deltas: phase6StructuredDeltas(beforeSnapshot, after.projection, canonicalEvents) as Parameters<typeof buildPhase6ServerPreSettlement>[0]["receiptBasis"]["deltas"],
            eventIds: { source: sourceEventIds.filter((x): x is string => x !== undefined), settlement: settlementEventIds.filter((x): x is string => x !== undefined), derived: [] },
            snapshots: {
              before: phase6SnapshotReceipt(beforeSnapshot, "before.snapshot") as unknown as Parameters<typeof buildPhase6ServerPreSettlement>[0]["receiptBasis"]["snapshots"]["before"],
              after: phase6SnapshotReceipt(after.panel, "after.snapshot") as unknown as Parameters<typeof buildPhase6ServerPreSettlement>[0]["receiptBasis"]["snapshots"]["after"],
            },
            outcome: outcomeEvidence.value.receiptBasisOutcome as unknown as Parameters<typeof buildPhase6ServerPreSettlement>[0]["receiptBasis"]["outcome"],
          },
          persistedRagTrace: persistedRagTrace as unknown as Parameters<typeof buildPhase6ServerPreSettlement>[0]["persistedRagTrace"],
        });
        if (preSettlement.ok !== true) {
          return failSettlement("pre_settlement_failed", "phase6_pre_settlement_failed", {
            findings: preSettlement.findings,
            scoringEvidence: recordValue(preSettlement).scoringEvidence,
            ragEvidence: recordValue(preSettlement).ragEvidence,
          });
        }
        const finalized = recordValue(await runtime.epochFinalizePhase6Journey(
          journeyId,
          preSettlement.value.authoritativeInput,
        ));
        if (finalized.ok !== true) {
          return failSettlement(
            "finalize_failed",
            `phase6_journey_finalize_failed:${optionalString(finalized.status) || "unknown"}`,
            { finalize: finalized },
          );
        }
        const finalizedSidecar = phase6FinalizedSidecar(
          input.binding,
          journey,
          finalized,
          canonicalEvents,
          afterWorldCursor,
        );
        const resultPagePersistence = currentMcpRequestContext()?.persistPartial;
        if (resultPagePersistence) {
          await resultPagePersistence(
            "obsidian_epoch.phase6_result_page",
            { page: finalizedSidecar.storedResultPage },
          );
        } else if (phase6CommittedResults && journey?.journeyId) {
          phase6CommittedResults.append(String(journey.journeyId), finalizedSidecar.storedResultPage);
        }
        const experimentRun = await completePhase6Run(input.binding, journey, finalizedSidecar.receipt);
        const settlement = {
          ok: true,
          status: optionalString(finalized.status) || "settled",
          experimentStatus: input.experimentStatus,
          capture: input.capture,
          preSettlement: {
            ok: true,
            rulesetVersion: preSettlement.rulesetVersion,
            scoringEvidence: preSettlement.value.scoringEvidence,
            ragEvidence: preSettlement.value.ragEvidence,
            finalizeContract: preSettlement.value.finalizeContract,
          },
          finalize: finalized,
          resultPage: finalizedSidecar.sidecar.page,
          resultPageOutput: finalizedSidecar.resultPageOutput,
          pageId: finalizedSidecar.pageId,
          receiptId: optionalString(finalizedSidecar.receipt.receiptId),
          receipt: finalizedSidecar.receipt,
          experimentRun,
        };
        phase6SettlementCache.set(journeyId, settlement);
        return settlement;
      } catch (error) {
        return failSettlement(
          "finalize_failed",
          error instanceof Error ? error.message : "phase6_journey_finalize_failed",
          { error: errorCodeForRejectedCommand(error) },
        );
      }
    };
    const commitJourneyActionWithPersistence = async (
      args: AnyRecord,
      options: { readonly externalTransport?: boolean } = {},
    ): Promise<ReturnType<typeof runtime.epochCommitJourneyAction>> => {
      const result = runtime.epochCommitJourneyAction(args);
      const partialPersistence = phase6CommittedResults
        ? currentMcpRequestContext()?.persistPartial
        : undefined;
      if (phase6CommittedResults) {
        const committedJourneyId = optionalString(recordValue(result.journey).journeyId)
          || optionalString(args.journeyId);
        if (!committedJourneyId) throw new Error("phase6_committed_result_journey_id_missing");
        if (recordValue(result).duplicate === true || epochEventsForPersistence(result).length === 0) {
          const settledActionId = optionalString(recordValue(result.settledAction).actionId);
          const journeyVersion = Number(recordValue(result.journey).version);
          const alreadyPersisted = settledActionId && Number.isSafeInteger(journeyVersion)
            && phase6CommittedResults.listByJourneyId(committedJourneyId).some((entry: Phase6CommittedResultRecord) => {
              const storedResult = recordValue(entry.result);
              return optionalString(recordValue(storedResult.settledAction).actionId) === settledActionId
                && Number(recordValue(storedResult.journey).version) === journeyVersion;
            });
          if (!alreadyPersisted) {
            throw new Error("phase6_committed_result_duplicate_sidecar_missing");
          }
          markMcpResultAlreadyPersisted(result);
        } else if (partialPersistence) {
          if (partialPersistence.supportsPhase6CommittedResultAtomicWrite !== true) {
            throw new Error("phase6_committed_result_atomic_persistence_unavailable");
          }
          attachPhase6CommittedResultForPersistence(result, {
            journeyId: committedJourneyId,
            result,
          });
          await partialPersistence("obsidian_epoch.commit_journey_action", result);
        } else {
          phase6CommittedResults.append(committedJourneyId, result);
        }
      }
      if (options.externalTransport && partialPersistence) {
        const externalResult = { ...result };
        if (isMcpResultAlreadyPersisted(result)) markMcpResultAlreadyPersisted(externalResult);
        return externalResult;
      }
      return result;
    };
  async function startJourneyWithSampling(args: AnyRecord) {
    const requestContext = currentMcpRequestContext();
    const samplingRequested = args.decisionMode === "host_sampling";
    const baseIdempotencyKey = String(args.idempotencyKey || "").trim();
    const partialPersistence = requestContext?.persistPartial as (((toolName: string, result: unknown) => Promise<void>) & {
      readonly runMutation?: <T>(operation: () => Promise<T> | T) => Promise<T>;
    }) | undefined;
    const returnWithPartialPersistenceOwnership = <TResult extends object>(result: TResult): TResult =>
      partialPersistence ? markMcpResultAlreadyPersisted(result) : result;
    const runStage = samplingRequested && partialPersistence?.runMutation
      ? partialPersistence.runMutation
      : async <T>(operation: () => Promise<T> | T) => operation();
    const phase6Binding = phase6BindingFromStartJourneyArgs(args);
    const explicitJourneyId = optionalString(args.journeyId);
    if (phase6Binding && explicitJourneyId && explicitJourneyId !== phase6Binding.journeyId) {
      throw new Error("phase6_start_journey_binding_journey_mismatch");
    }
    const phase6ExperimentStatus = phase6Binding
      ? await validatePhase6ExperimentBinding(phase6Binding)
      : undefined;
    let phase6RagTrace = phase6Binding ? phase6RagTraceForBinding(phase6Binding) : undefined;
    if (phase6Binding?.retrievalExpected && !phase6RagTrace) {
      const failedRun = await failPhase6Run(
        phase6Binding,
        phase6Binding.journeyId || "",
        "phase6_rag_trace_required_missing",
      );
      return {
        phase6Settlement: {
          ok: false,
          status: "rag_trace_missing",
          finding: phase6SourceMissingFinding(
            "$.ragTrace",
            "phase6_rag_trace_store",
            "retrievalExpected=true but no valid server-observed RAG trace was recorded for the Phase 6 run/journey binding.",
          ),
          experimentRun: failedRun,
        },
      };
    }
    const worldWindow = await runStage(async () => {
      const result = runtime.epochReserveJourneyWorldWindow(args);
      await partialPersistence?.("obsidian_epoch.start_journey", result);
      return result;
    });
    const phase6BeforeEvents = phase6Binding ? phase6EventsFromView({ ...args, limit: 1_000 }) : [];
    if (phase6Binding && !phase6RagTrace && !phase6Binding.retrievalExpected) {
      const preparedJourney = recordValue(worldWindow.journey);
      const traceArgs = {
        ...args,
        regionId: optionalString(preparedJourney.destinationRegionId),
      };
      phase6RagTrace = phase6RagTracePayload(runtime.epochCapturePhase6RagTrace({
        binding: phase6TraceBinding(phase6Binding, traceArgs),
        source: "world_knowledge",
        retrievalConfig: phase6RetrievalConfig("world_knowledge", traceArgs),
        retrievedChunks: [],
        serverObservedUsedChunkIds: [],
        serverObservedGroundingHits: [],
        retrievalExpected: false,
        noRetrievalReason: !worldKnowledgeSearch && !worldMemorySearch
          ? "upstream_disabled"
          : "not_needed",
        recordedAt: new Date().toISOString(),
        sourceEventIds: [],
      }));
    }
    let phase6Before: ReturnType<typeof phase6PanelProjection> | undefined;
    if (phase6Binding) {
      phase6Before = phase6PanelProjection(
        "before",
        args,
        recordValue(worldWindow.journey),
        phase6BeforeEvents,
      );
    }
    const boundArgs = {
      ...args,
      expectedVersion: worldWindow.journey.mirrorWindow?.startExpectedVersion
        ?? worldWindow.journey.version,
      ...(phase6Binding ? { phase6Scenario: { intensity: phase6Binding.scenario.intensity } } : {}),
    };
    const taskContext = runtime.epochJourneyTaskGenerationContext(boundArgs);
    if (process.env.EPOCH_DIAG) console.error("[region-taskctx]", JSON.stringify({
      scenarioMapId: taskContext?.scenarioMapId,
      availableCount: taskContext?.availableWorldObjects?.length,
      generationRequested: taskContext?.generationRequested,
    }));
    const generatedPlanRequested = args.taskGenerationMode === "model_sampling"
      || args.taskGenerationMode === "server_fallback"
      || taskContext.generationRequested === true;
    let taskProposal: unknown;
    let taskGeneration: unknown = {
      ok: false,
      source: "task_plan_sampling",
      trust: "untrusted_client",
      fallback: !generatedPlanRequested
        ? "server_fallback_default"
        : args.taskGenerationMode === "server_fallback"
          ? "server_fallback_requested"
          : "capability_absent",
    };
    const allowedObjectIds = (taskContext.availableWorldObjects || [])
      .map((object) => object.id)
      .filter((id): id is string => typeof id === "string" && id.length > 0);
    const samplingClient = requestContext?.sampling;
    const taskSamplingCapable = generatedPlanRequested
      && args.taskGenerationMode !== "server_fallback"
      && Boolean(samplingClient)
      && typeof samplingClient?.createTaskPlanMessage === "function";
    const sampleTaskPlan = taskSamplingCapable && samplingClient
      ? (feedback?: string) => samplingClient.createTaskPlanMessage({
          systemPrompt: [
            "Generate one coherent playable quest route from the supplied task type and exact server map.",
            "The supplied mirrorWindow and worldSlice are signed historical constraints. Keep the route inside that region and interval, and do not contradict its controller, conflict phase, shortages, prices, security, unrest, or macro direction.",
            "Treat identityName as the protagonist's server-issued identity. Make the route plausible for that identity without renaming or replacing it.",
            "Use identityTraits, identityNeeds, lifeGoal, resources, attributes, and carriedInventoryItems to create genuine tradeoffs rather than two equivalent success buttons. A cautious, exhausted, hungry, poor, ambitious, vengeful, strong, clever, spiritual, equipped, or curious identity should face different sensible choices.",
            "Return strict JSON only. Use only supplied object ids. Create a task graph with 4-9 main objectives, 2-4 side objectives, and one route-choice objective.",
            "Include two mutually exclusive choice routes. Each choice route must contain at least two main objectives and be selected by exactly one distinct action on the route-choice objective. If map organizations or factions are available, ground each route with factionObjectId and target that object in its selecting action.",
            "Include at least one unlock route whose unlockedByObjectiveIds names a side objective; completing that side objective must open one additional main objective. Locked and unselected route objectives are not executed or counted as required by the server.",
            "Give every objective a global integer stage and prerequisiteObjectiveIds. Every prerequisite, route selection, and side unlock must point from a lower stage to a higher stage.",
            "Every objective must contain exactly two distinct executable actions grounded in its worldObjectIds.",
            "Use at least one supplied npc, and vary which supplied cast members appear according to the objective instead of repeating one npc mechanically.",
            "Describe the achieved result with completionResult.kind (item,knowledge,world_state,service,relationship) and completionResult.returnMode (carry,report,none). Only physical items may use carry; reports, experiments, repairs, trials and relationships normally remain on site or are reported.",
            "If a supplied object has type agent, it may be involved only through an explicit action target; describe the observable cooperative or competitive effect without inventing consent, resource loss or identity changes.",
            "Risk labels are non-authoritative hints; the server recomputes risk from task semantics, scene type, action wording, and targeted map objects. Never include completion state, grade/tier, reward, hidden task, hidden condition, or claims that an action already happened.",
            "When phase6Scenario is present, its taskType and intensity are server policy. Keep the route on that objective and make the two action options express materially different costs at the requested low, medium, high, or dynamic intensity.",
            "Top-level fields: title,premise,primaryObjective,successResult,completionResult,objectives,routes.",
            "CompletionResult fields: kind,returnMode,summary.",
            "Route fields: routeId,kind,title,factionObjectId(optional),objectiveIds,unlockedByObjectiveIds. Route kind is choice or unlock.",
            "Objective fields: objectiveId,kind,sequence,stage,prerequisiteObjectiveIds,title,objective,completionCriteria,sceneType,locationId,worldObjectIds,actions. Objective kind is main,side,choice.",
            "Action fields: optionKey,label,intent,risk,allowedEffectKinds,targetObjectIds,outcomeSummary,selectsRouteId(optional and allowed only on choice objectives).",
            "Allowed sceneType: livelihood,commission,world_event,discovery,health,conflict.",
            "Allowed risk: low,medium,high. Allowed effects: commission_offer,journey_progress,resource_delta,clue_created,relationship_signal,world_reference.",
            "GROUNDING (critical): every locationId, worldObjectIds entry, targetObjectIds entry, and factionObjectId MUST be verbatim from the allowedObjectIds flat list in the user message. Do not invent, abbreviate, paraphrase, or reuse ids from anywhere else. Invalid ids cause rejection and a forced regeneration.",
          ].join(" "),
          messages: [{
            role: "user",
            text: JSON.stringify({
              taskType: taskContext.taskType,
              identityName: taskContext.identityName,
              identityTraits: taskContext.identityTraits,
              identityNeeds: taskContext.identityNeeds,
              lifeGoal: taskContext.lifeGoal,
              resources: taskContext.resources,
              attributes: taskContext.attributes,
              carriedInventoryItems: taskContext.carriedInventoryItems,
              ...(phase6Binding ? { phase6Scenario: phase6Binding.scenario } : {}),
              scenarioMapId: taskContext.scenarioMapId,
              mirrorWindow: taskContext.mirrorWindow,
              worldSlice: taskContext.worldSlice,
              availableWorldObjects: taskContext.availableWorldObjects.map((object) => ({
                id: object.id,
                type: object.type,
                label: object.label,
                tags: object.tags,
              })),
              allowedObjectIds,
              ...(feedback ? { groundingFeedback: feedback } : {}),
            }),
          }],
          maxTokens: 6_000,
          temperature: feedback ? 0.5 : 0.7,
        }, {
          activeClientRequest: true,
          absoluteTimeoutMs: 90_000,
          softTimeoutMs: 60_000,
        })
      : undefined;
    if (sampleTaskPlan) {
      await requestContext?.notifyProgress?.(0, "正在根据任务类型与场景地图生成完整任务路线。");
      const sampledTask = await sampleTaskPlan();
      taskGeneration = sampledTask;
      if (sampledTask.ok) taskProposal = sampledTask.proposal;
    }
    const startOnce = (startArgs: AnyRecord) => runStage(async () => {
      const result = phase6Binding && samplingRequested
        ? runtime.epochStartJourney(startArgs)
        : runtime.epochStartJourneyAgentNative(startArgs);
      await partialPersistence?.("obsidian_epoch.start_journey", result);
      return result;
    });
    let started: Awaited<ReturnType<typeof startOnce>> | undefined;
    if (taskProposal === undefined) {
      started = await startOnce(boundArgs);
    } else {
      let lastValidationError: string | undefined;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          started = await startOnce({ ...boundArgs, taskProposal });
          break;
        } catch (error: unknown) {
          const code = errorCodeForRejectedCommand(error);
          if (!code.startsWith("journey_task_")) throw error;
          lastValidationError = code;
          if (attempt === 2 || !sampleTaskPlan) break;
          const invalidIds = code.includes(":") ? code.slice(code.indexOf(":") + 1) : "";
          const feedback = `Previous task plan was rejected (${code}). These ids are NOT in the allowlist: ${invalidIds || "(unspecified)"}. Regenerate the route using ONLY ids from allowedObjectIds: ${allowedObjectIds.join(", ")}.`;
          const retry = await sampleTaskPlan(feedback);
          taskGeneration = retry;
          taskProposal = retry.ok ? retry.proposal : undefined;
          if (taskProposal === undefined) break;
        }
      }
      if (started === undefined) {
        taskGeneration = {
          ok: false,
          source: "task_plan_sampling",
          trust: "untrusted_client",
          fallback: "invalid_result",
          ...(lastValidationError ? { validationError: lastValidationError } : {}),
        };
        started = await startOnce(boundArgs);
      }
    }
    let phase6Capture: unknown;
    if (phase6Binding) {
      try {
        phase6Before = phase6Before ?? phase6PanelProjection(
          "before",
          args,
          recordValue(started.journey),
          phase6BeforeEvents,
        );
        phase6Capture = runtime.epochCapturePhase6JourneyStart({
          journeyId: started.journey.journeyId,
            runId: phase6Binding.runId,
          identity: phase6Binding.identity,
          canonicalCursor: phase6Before.canonicalCursor,
          context: {
            player: phase6Before.panel.player,
            progress: phase6Before.panel.progress,
            economy: phase6Before.panel.economy,
            ragPanel: {
              ...phase6Before.panel.ragPanel,
              ...(phase6RagTrace ? { phase6Trace: {
                traceHash: optionalString(recordValue(phase6RagTrace).traceHash),
                payloadHash: optionalString(recordValue(phase6RagTrace).payloadHash),
                status: optionalString(recordValue(phase6RagTrace).status),
                source: optionalString(recordValue(phase6RagTrace).source),
                recordedAt: optionalString(recordValue(phase6RagTrace).recordedAt),
              } } : {}),
            },
            worldCursor: phase6Before.panel.worldCursor,
            experiment: {
              experimentId: phase6Binding.experimentId,
              runIndex: phase6Binding.runIndex,
              seed: phase6Binding.seed,
            },
            version: {
              rulesetVersion: phase6Binding.versions.rulesVersion,
              catalogVersion: phase6Binding.versions.catalogVersion,
              codeVersion: phase6Binding.versions.codeVersion,
              scenarioMatrixVersion: phase6Binding.scenarioMatrix.version,
            },
          },
          scenarioMatrix: phase6Binding.scenarioMatrix,
        });
        if (recordValue(phase6Capture).ok !== true) {
          const failedRun = await failPhase6Run(
            phase6Binding,
            started.journey.journeyId,
            "phase6_journey_start_capture_failed",
          );
          const result = {
            ...started,
            phase6Settlement: {
              ok: false,
              status: "capture_failed",
              experimentStatus: phase6ExperimentStatus,
              capture: phase6Capture,
              experimentRun: failedRun,
            },
          };
          attachEpochEventsForPersistence(result, [
            ...epochEventsForPersistence(worldWindow),
            ...epochEventsForPersistence(started),
          ]);
          return returnWithPartialPersistenceOwnership(
            mergeJourneyEventsForPersistence(result, worldWindow, started),
          );
        }
      } catch (error) {
        const failedRun = await failPhase6Run(
          phase6Binding,
          optionalString(recordValue(started.journey).journeyId) || phase6Binding.experimentId,
          error instanceof Error ? error.message : "phase6_journey_start_capture_failed",
        );
        const result = {
          ...started,
          phase6Settlement: {
            ok: false,
            status: "capture_failed",
            experimentStatus: phase6ExperimentStatus,
            error: errorCodeForRejectedCommand(error),
            experimentRun: failedRun,
          },
        };
        attachEpochEventsForPersistence(result, [
          ...epochEventsForPersistence(worldWindow),
          ...epochEventsForPersistence(started),
        ]);
        return returnWithPartialPersistenceOwnership(
          mergeJourneyEventsForPersistence(result, worldWindow, started),
        );
      }
    }
    if (!samplingRequested || !requestContext?.sampling) {
      const result = {
        ...started,
        taskGeneration,
        sampling: {
          ok: false,
          source: "sampling_advice",
          trust: "untrusted_client",
          fallback: samplingRequested ? "capability_absent" : "agent_native",
        },
        ...(phase6Binding ? { phase6Settlement: {
          ok: true,
          status: "captured",
          experimentStatus: phase6ExperimentStatus,
          capture: phase6Capture,
          startJourneyBinding: phase6Binding,
        } } : {}),
      };
      attachEpochEventsForPersistence(result, [
        ...epochEventsForPersistence(worldWindow),
        ...epochEventsForPersistence(started),
      ]);
      return returnWithPartialPersistenceOwnership(
        mergeJourneyEventsForPersistence(result, worldWindow, started),
      );
    }

    let current: { readonly journey: typeof started.journey; readonly [key: string]: unknown } = started;
    let lastProposal: ReturnType<typeof runtime.epochProposeJourneyStep> | undefined;
    let lastSampling: Awaited<ReturnType<typeof requestContext.sampling.createMessage>> | undefined;
    const samplingDecisions: unknown[] = [];
    const committedResults: ReturnType<typeof runtime.epochCommitJourneyAction>[] = [];
    const maxObjectiveSteps = Number(started.journey.taskPlan?.objectives.length ?? 1);
    for (let stepIndex = 0; stepIndex < maxObjectiveSteps; stepIndex += 1) {
      const proposal = await runStage(async () => {
        const result = runtime.epochProposeJourneyStep({
          ...args,
          journeyId: started.journey.journeyId,
          expectedVersion: current.journey.version,
          idempotencyKey: `${baseIdempotencyKey}:objective-${stepIndex + 1}-proposal`,
        });
        await partialPersistence?.("obsidian_epoch.propose_journey_step", result);
        return result;
      });
      lastProposal = proposal;
      const contract = proposal.proposal.sceneContract;
      if (!contract) throw new Error("journey_scene_contract_not_found");
      // PR8: public-only action options for sampling — no riskTerms leak.
      const RISK_LABELS: Readonly<Record<string, string>> = {
        low: "低风险：消耗少量集中力，面临轻度对抗",
        medium: "中风险：消耗专注力，可能获得额外报酬",
        high: "高风险：消耗体力，面临较强对抗，携带资源与装备可能改善判定",
      };
      const actionOptions = contract.actionOptions.map((option) => ({
        actionOptionId: option.actionOptionId,
        optionKey: option.optionKey,
        label: option.label,
        intent: option.intent,
        risk: option.risk,
        riskLabel: RISK_LABELS[option.risk] ?? option.risk,
        available: true,
        decisionEffect: deriveDecisionEffect(contract.taskObjective?.kind),
      }));
      const progress = recordValue(runtime.epochProgress({ agentId: started.journey.agentId }));
      const identity = recordValue(progress.identity);
      const personality = recordValue(identity.personality);
      const needs = recordValue(identity.needs);
      const lifeGoal = recordValue(identity.lifeGoal);
      const resourceBalances = recordValue(progress.resources);
      const attributeScores = recordValue(progress.attributes);
      const carriedInventoryItems = Array.isArray(progress.inventoryItems)
        ? progress.inventoryItems
            .filter((item): item is AnyRecord => Boolean(item) && typeof item === "object" && !Array.isArray(item))
            .map((item) => ({
              itemId: typeof item.itemId === "string" ? item.itemId : "",
              itemKey: typeof item.itemKey === "string" ? item.itemKey : "",
              displayName: typeof item.displayName === "string" ? item.displayName : "",
              rarity: typeof item.rarity === "string" ? item.rarity : "common",
              bound: item.bound === true,
            }))
            .filter((item) => item.itemId && item.displayName)
            .slice(0, 20)
        : [];
      const needLevels = recordValue(needs.levels);
      const strongestNeeds = Object.entries(needLevels)
        .filter((entry): entry is [string, number] => typeof entry[1] === "number" && Number.isFinite(entry[1]))
        .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
        .slice(0, 6)
        .map(([need, pressureBps]) => ({ need, pressureBps }));
      // PR6: build narrative context from identity strategy/life pattern/feedback.
      // No numeric values (score/fitBps/affinity/tps) are leaked.
      const strategyNarrative = buildStrategyPromptNarrative(
        identity.strategyDisposition as IdentityStrategyDisposition | undefined,
      );
      const lifePatternNarrative = buildLifePatternPromptNarrative(
        identity.expectedLifePattern as ExpectedLifePattern | undefined,
      );
      await requestContext.notifyProgress?.(
        stepIndex / Math.max(1, maxObjectiveSteps),
        `正在请求 Host 选择第 ${stepIndex + 1}/${maxObjectiveSteps} 个服务器签发行动。`,
      );
      const sampling = await requestContext.sampling.createMessage({
        systemPrompt: [
          "Choose exactly one server-issued actionOptionId as the server-issued identity, not as a quest-grade optimizer.",
          "Use the identity's traits, strongest needs, life goal, remaining resources, carried inventory, riskLabel (narrative only), mandate, prior route, and current objective.",
          "Optional side objectives may remain incomplete when survival pressure, fatigue, resources, personality, or long-term priorities make a real action fail or the journey be recalled.",
          "Do not assume that the highest-risk option is best and do not optimize for a hidden grade.",
          "Return strict JSON with actionOptionId, rationale, confidence, and optional userFacingMessage. Do not invent completion, outcomes, rewards, hidden tasks, people, or world facts.",
          // PR6: inject strategy tendency narrative (no numeric leakage).
          ...(strategyNarrative ? [strategyNarrative] : []),
          // PR6: inject expected life pattern narrative (no numeric leakage).
          ...(lifePatternNarrative ? [lifePatternNarrative] : []),
        ].join(" "),
        messages: [{
          role: "user",
          text: JSON.stringify({
            journeyId: started.journey.journeyId,
            episodeId: proposal.proposal.episode.episodeId,
            episodeTitle: proposal.proposal.episode.title,
            scene: {
              phase: contract.phase,
              premise: contract.premise,
              location: contract.location,
              participants: contract.participants,
              confirmedFactIds: contract.confirmedFactIds,
              taskObjective: contract.taskObjective,
            },
            decisionContext: {
              identity: {
                identityName: identity.identityName,
                traits: Array.isArray(personality.traits) ? personality.traits : [],
                strongestNeeds,
                lifeGoal: {
                  category: lifeGoal.category,
                  description: lifeGoal.description,
                  motivation: lifeGoal.motivation,
                  progressBps: lifeGoal.progressBps,
                },
              },
              resources: resourceBalances,
              attributes: attributeScores,
              carriedInventoryItems,
              mandate: started.journey.mandate,
              mirrorWindow: started.journey.mirrorWindow,
              worldSlice: compactJourneyDecisionWorldSlice(started.journey.worldSlice),
            },
            actionOptions,
          }),
        }],
        maxTokens: 384,
      }, {
        activeClientRequest: true,
        absoluteTimeoutMs: 60_000,
        softTimeoutMs: 30_000,
      });
      lastSampling = sampling;
      const selected = sampling.ok
        ? contract.actionOptions.find((option) => option.actionOptionId === sampling.decision.actionOptionId)
        : undefined;
      if (!selected) {
        await requestContext.notifyProgress?.(
          stepIndex / Math.max(1, maxObjectiveSteps),
          "Host 选择不可用；当前签名提案保持开放，不产生完成结果或奖励。",
        );
        const result = {
          ...current,
          proposal: proposal.proposal,
          taskGeneration,
          sampling: sampling.ok ? {
            ok: false,
            source: "sampling_advice",
            trust: "untrusted_client",
            fallback: "invalid_action_option",
          } : sampling,
          samplingDecisions,
        };
        attachEpochEventsForPersistence(result, [
          ...epochEventsForPersistence(worldWindow),
          ...epochEventsForPersistence(started),
          ...epochEventsForPersistence(proposal),
        ]);
        return returnWithPartialPersistenceOwnership(
          mergeJourneyEventsForPersistence(result, worldWindow, started, proposal),
        );
      }
      samplingDecisions.push(sampling);
      const committed = await runStage(() =>
        commitJourneyActionWithPersistence({
          ...args,
          journeyId: started.journey.journeyId,
          sceneId: contract.sceneId,
          episodeId: contract.episodeId,
          expectedVersion: contract.expectedVersion,
          actionOptionId: selected.actionOptionId,
          signature: selected.signature,
          visibleText: sampling.ok && sampling.decision.userFacingMessage
            ? sampling.decision.userFacingMessage
            : `旅程行动：${proposal.proposal.episode.title}`,
          idempotencyKey: `${baseIdempotencyKey}:objective-${stepIndex + 1}-commit`,
        }));
      committedResults.push(committed);
      current = committed;
      if (committed.journey.status !== "awaiting_agent") break;
    }
    await requestContext.notifyProgress?.(1, "Host 行动选择已逐项校验并提交服务端结算。");
    const result: AnyRecord = {
      ...started,
      ...current,
      ...(lastProposal ? { proposal: lastProposal.proposal } : {}),
      taskGeneration,
      sampling: lastSampling,
      samplingDecisions,
    };
    let finalizedJourneyVerification: ReturnType<typeof ensureSettledJourneyVerification> | undefined;
    if (phase6Binding) {
      result.phase6Settlement = {
        ok: true,
        status: "captured",
        experimentStatus: phase6ExperimentStatus,
        capture: phase6Capture,
        startJourneyBinding: phase6Binding,
      };
        if (recordValue(current.journey).status === "settled") {
          const settledJourneyId = optionalString(recordValue(current.journey).journeyId);
          if (!settledJourneyId) throw new Error("phase6_settlement_context_missing:journeyId");
          finalizedJourneyVerification = ensureSettledJourneyVerification(
            runtime.epochJourneyStatus({ ...args, journeyId: settledJourneyId }),
            args,
          );
          // Host-sampled Phase 6 runs persist the world window and every
          // committed action incrementally.  The final mirror settlement is
          // produced after those stages; persist its canonical events before
          // returning an already-persisted aggregate result, otherwise a
          // receipt can cite a viability/solidification event that never
          // reaches the SQLite event authority.
          await partialPersistence?.(
            "obsidian_epoch.start_journey",
            finalizedJourneyVerification.status,
          );
          Object.assign(result, finalizedJourneyVerification.status);
          if (finalizedJourneyVerification.finalVerification) {
            result.finalVerification = finalizedJourneyVerification.finalVerification;
          }
          result.phase6Settlement = await finalizePhase6JourneyFromPersistedState({
            args,
            binding: phase6Binding,
            current: recordValue(finalizedJourneyVerification.status),
            committedResults,
            experimentStatus: phase6ExperimentStatus,
            capture: phase6Capture,
            ragTrace: phase6RagTrace,
            journeyRuntime: result,
          });
        }
    }
    attachEpochEventsForPersistence(result, [
      ...epochEventsForPersistence(worldWindow),
      ...epochEventsForPersistence(started),
      ...(partialPersistence
        ? []
        : committedResults.flatMap((committed) => epochEventsForPersistence(committed))),
      ...(finalizedJourneyVerification
        ? epochEventsForPersistence(finalizedJourneyVerification.status)
        : []),
    ]);
    return returnWithPartialPersistenceOwnership(partialPersistence
      ? mergeJourneyEventsForPersistence(result)
      : mergeJourneyEventsForPersistence(
          result,
          worldWindow,
          started,
          ...committedResults,
          ...(finalizedJourneyVerification ? [finalizedJourneyVerification.status] : []),
        ));
  }

  function ensureSettledJourneyVerification(
    status: ReturnType<typeof runtime.epochJourneyStatus>,
    args: AnyRecord,
  ) {
    if (status.journey.status !== "settled") return { status };
    const mirrorFinalization = runtime.epochFinalizeSettledMirrorWorld(status, args);
    status = mirrorFinalization.status;
    const existingPage = status.journey.verification
      ? runtime.epochGetResultPage({ pageId: status.journey.verification.pageId })
      : undefined;
    if ((existingPage?.payload?.journey?.status === "settled"
      || existingPage?.payload?.journey?.status === "completed")
      && existingPage.payload.journey.settlement
      && existingPage.payload.journey.roleplay
      && existingPage.payload.journey.viability) {
      const existingResult = { status, finalVerification: { page: existingPage, duplicate: true } };
      attachEpochEventsForPersistence(
        existingResult,
        [
          ...epochEventsForPersistence(mirrorFinalization),
        ],
      );
      return mergeJourneyEventsForPersistence(existingResult, mirrorFinalization.worldCommitRecord, status);
    }
    const canonicalEventIds = [...new Set(status.episodes.flatMap((episode) => episode.settlement?.canonicalEventIds || []))];
    const latestSettlement = status.episodes.map((episode) => episode.settlement).filter(Boolean).at(-1);
    const journeyReward = latestSettlement?.reward;
    const journeyRewardBundle = undefined;
    const finalizationEvents = epochEventsForPersistence(mirrorFinalization);
    const canonicalEvents = phase6EventsFromView({
      agentId: status.journey.agentId,
      correlationId: status.journey.correlationId,
      limit: 100,
    });
    const solidificationMarker = [...finalizationEvents, ...canonicalEvents].find((event): event is Extract<EpochEvent, {
      readonly eventType: "journey_world_solidified";
    }> => event.eventType === "journey_world_solidified");
    const solidificationEffectEventIds = solidificationMarker?.payload.effectEventIds ?? [];
    const persistedDiscardViabilityEvents = canonicalEvents.filter((event): event is Extract<EpochEvent, {
      readonly eventType: "identity_viability_projected";
    }> => event.eventType === "identity_viability_projected"
      && event.payload.identityId === status.journey.agentId
      && event.payload.sourceSettlementId === status.journey.worldCommit?.settlementId);
    const finalizationEffectEvents = solidificationEffectEventIds.length > 0
      ? canonicalEvents.filter((event) => solidificationEffectEventIds.includes(event.eventId))
      : [...finalizationEvents, ...persistedDiscardViabilityEvents];
    const roleplayProjection = roleplayResultPageProjection(
      mirrorFinalization.mirrorLedgerEntries ?? [],
      status.journey.journeyId,
      status.journey.settledAtWorldTime ?? new Date().toISOString(),
    );
    const identityProgress = runtime.epochProgress({ agentId: status.journey.agentId });
    const strategyProjection = strategyResultPageProjection({
      journeyId: status.journey.journeyId,
      disposition: identityProgress.identity?.strategyDisposition,
      episodes: status.episodes.map((episode) => recordValue(episode)),
      canonicalEvents,
      computedAt: status.journey.settledAtWorldTime ?? new Date().toISOString(),
    });
    const fallbackViability = identityProgress.identity?.identityViability;
    const viabilityProjection = viabilityResultPageProjection(
      finalizationEffectEvents,
      fallbackViability
        ? {
            viabilityScoreBps: fallbackViability.viabilityScoreBps,
            status: fallbackViability.status,
          }
        : undefined,
    );
    // A discarded mirror settlement never reaches the shared world. Keep its
    // viability and settlement evidence, but do not project provisional
    // effects as world impact on the final result page.
    const discardedMirrorCommit = status.journey.worldMode === "mirror"
      && status.journey.worldCommit?.status === "discarded";
    const hiddenPrerequisites = discardedMirrorCommit
      ? undefined
      : hiddenPrerequisiteResultPageProjection(finalizationEffectEvents);
    const worldImpact = discardedMirrorCommit
      ? undefined
      : worldImpactResultPageProjection(finalizationEffectEvents, hiddenPrerequisites);
    const settlementPage = mirrorFinalization.settlementDecision
      ? {
          score: {
            breakdown: mirrorFinalization.settlementDecision.score.breakdown,
            mainLineSucceeded: mirrorFinalization.settlementDecision.score.mainLineSucceeded,
            hiddenComplete: mirrorFinalization.settlementDecision.score.hiddenComplete,
            hiddenClamp: mirrorFinalization.settlementDecision.hiddenClamp,
            roleplaySummary: mirrorFinalization.settlementDecision.score.roleplaySummary ?? {
              deviationBps: roleplayProjection.score.deviationBps,
              doubtEventCount: roleplayProjection.score.npcDoubtEvents.length,
              exposed: roleplayProjection.score.exposed,
            },
            ...(viabilityProjection
              ? {
                  viabilitySummary: {
                    viabilityScoreBpsBefore: viabilityProjection.before?.viabilityScoreBps ?? 0,
                    viabilityScoreBpsAfter: viabilityProjection.after?.viabilityScoreBps ?? 0,
                    status: viabilityProjection.status,
                  },
                }
              : {}),
            policyVersion: mirrorFinalization.settlementDecision.score.policyVersion,
            computedAt: mirrorFinalization.settlementDecision.score.computedAt,
          },
          tier: mirrorFinalization.settlementDecision.tier,
          ...(mirrorFinalization.settlementDecision.tier !== "未及格"
            ? { reward: mirrorFinalization.settlementDecision.reward }
            : {}),
          worldCommitDecision: mirrorFinalization.settlementDecision.worldCommit,
          policyVersion: mirrorFinalization.settlementDecision.policyVersion,
        }
      : undefined;
    const pageInput = {
      ...args,
      correlationId: status.journey.correlationId,
      agentId: status.journey.agentId,
      regionId: status.journey.destinationRegionId,
      journeyVerification: {
        journeyId: status.journey.journeyId,
        correlationId: status.journey.correlationId,
        status: status.journey.status,
        objective: status.journey.mandate.objective,
        regionId: status.journey.destinationRegionId,
        ...(status.journey.worldMode ? { worldMode: status.journey.worldMode } : {}),
        ...(status.journey.worldCommit ? { worldCommit: status.journey.worldCommit } : {}),
        startedAtWorldTime: status.journey.startedAtWorldTime,
        dueAtWorldTime: status.journey.dueAtWorldTime,
        ...(status.journey.taskPlan ? { taskPlan: status.journey.taskPlan } : {}),
        episodes: status.episodes.map((episode) => ({
          episodeId: episode.episodeId,
          title: episode.title,
          outcomeKey: episode.outcomeKey,
          ...(episode.phase ? { phase: episode.phase } : {}),
          participants: episode.worldObjectRefs
            .filter((ref) => ref.type === "agent" || ref.type === "npc")
            .map((ref) => ({ id: ref.id, type: ref.type, label: ref.label })),
          sourceEventIds: [...new Set([...episode.sourceFactIds, ...(episode.settlement?.canonicalEventIds || [])])],
          ...(episode.serverFacts ? { serverFacts: episode.serverFacts } : {}),
          ...(episode.narrative ? { narrative: episode.narrative } : {}),
          ...(episode.generatedTaskObjective
            ? { generatedTaskObjective: episode.generatedTaskObjective }
            : {}),
          ...(episode.settlement?.reward?.resourceId && episode.settlement.reward.amount
            ? { settlement: { reward: {
                resourceId: episode.settlement.reward.resourceId,
                amount: episode.settlement.reward.amount,
              } } }
            : {}),
        })),
        canonicalEventIds,
        ...(latestSettlement || journeyReward || journeyRewardBundle ? { stateDelta: {
          ...(latestSettlement?.outcomeSummary ? { outcomeSummary: latestSettlement.outcomeSummary } : {}),
          ...(journeyReward ? { reward: journeyReward } : {}),
          ...(journeyRewardBundle ? { rewardBundle: journeyRewardBundle } : {}),
        } } : {}),
        ...(settlementPage ? { settlement: settlementPage } : {}),
        ...(roleplayProjection ? { roleplay: roleplayProjection.page } : {}),
        ...(viabilityProjection ? { viability: viabilityProjection } : {}),
        ...(strategyProjection ? { strategyConsistency: strategyProjection.page } : {}),
        ...(hiddenPrerequisites ? { hiddenPrerequisites } : {}),
        ...(worldImpact ? { worldImpact } : {}),
      },
    };
    const draft = runtime.epochResultPage(pageInput);
    const finalVerification = runtime.epochCreateResultPage({
      ...pageInput,
      publishToken: draft.publishToken,
      idempotencyKey: `${status.journey.journeyId}:final-verification:identity-eval-v3`,
    });
    const linked = runtime.epochLinkJourneyVerification({
      journeyId: status.journey.journeyId,
      expectedVersion: status.journey.version,
      explorerId: status.journey.explorerId,
      ...(typeof args.recoveryCode === "string" ? { recoveryCode: args.recoveryCode } : {}),
      ...(typeof args.localSecret === "string" ? { localSecret: args.localSecret } : {}),
      ...(typeof args.tokenId === "string" ? { tokenId: args.tokenId } : {}),
      pageId: finalVerification.page.pageId,
      urlPath: finalVerification.page.urlPath,
      createdAt: finalVerification.page.createdAt,
      idempotencyKey: `${status.journey.journeyId}:link-final-verification:v${status.journey.version}:${finalVerification.page.pageId}`,
    });
    const linkedStatus = { ...status, ...linked, episodes: status.episodes };
    attachEpochEventsForPersistence(
      linkedStatus,
      [
        ...epochEventsForPersistence(mirrorFinalization),
      ],
    );
    return {
      status: mergeJourneyEventsForPersistence(
        linkedStatus,
        mirrorFinalization.worldCommitRecord,
        status,
        linked,
      ),
      finalVerification,
    };
  }

  /**
   * Settlement can grant resources after the companion first builds its read
   * model. Re-read the server economy after finalization so an Agent sees the
   * balance it can actually spend, never the pre-settlement snapshot.
   */
  function withCurrentEconomyActions<TValue extends object>(
    result: TValue,
    args: AnyRecord,
    requireExistingEconomyActions = false,
  ): TValue {
    const value = recordValue(result);
    if (requireExistingEconomyActions && !Object.hasOwn(value, "economyActions")) return result;
    const journey = recordValue(value.journey);
    const agentId = optionalString(journey.agentId)
      || optionalString(value.canonicalAgentId)
      || optionalString(value.agentId)
      || optionalString(args.agentId);
    if (!agentId) return result;
    const regionId = optionalString(journey.destinationRegionId)
      || optionalString(value.regionId)
      || optionalString(args.regionId);
    const economyActions = runtime.epochEconomyActions({
      ...args,
      agentId,
      ...(regionId ? { regionId } : {}),
    });
    return mergeJourneyEventsForPersistence({
      ...result,
      economyActions,
    }, result);
  }

  async function journeyStatusWithFinalVerification(args: AnyRecord) {
    const initial = runtime.epochJourneyStatus(args);
    const finalized = ensureSettledJourneyVerification(initial, args);
    const finalVerification = finalized.finalVerification;
    const finalizedJourney = recordValue(finalized.status.journey);
    let phase6Settlement: AnyRecord | undefined;
    if (optionalString(finalizedJourney.status) === "settled") {
      const restored = phase6BindingFromStoredJourney(optionalString(finalizedJourney.journeyId) || "");
      if (restored) {
        const experimentStatus = await validatePhase6ExperimentBinding(restored.binding);
        phase6Settlement = await finalizePhase6JourneyFromPersistedState({
          args,
          binding: restored.binding,
          current: recordValue(finalized.status),
          experimentStatus,
          capture: {
            ok: true,
            status: "restored",
            journeyId: restored.binding.journeyId,
          },
          ragTrace: phase6RagTraceForBinding(restored.binding),
          storedContext: restored.storedContext,
          journeyRuntime: finalized.status,
        });
      }
    }
    const baseResult = finalVerification
      ? {
          ...finalized.status,
          finalVerification,
        }
      : initial;
    if (!phase6Settlement && !finalVerification) {
      return withCurrentEconomyActions(finalized.status, args);
    }
    const result = {
      ...baseResult,
      ...(phase6Settlement ? { phase6Settlement } : {}),
    };
    attachEpochEventsForPersistence(result, epochEventsForPersistence(finalized.status));
    return withCurrentEconomyActions(
      mergeJourneyEventsForPersistence(result, initial, finalized.status),
      args,
    );
  }


  function agentBriefingWithFinalVerification(args: AnyRecord) {
    const briefing = runtime.epochAgentBriefing({ ...args, deferReturnDelivery: true });
    const finalizations = briefing.returnedJourneys.map((journeyValue) => {
      const journey = recordValue(journeyValue);
      return ensureSettledJourneyVerification(runtime.epochJourneyStatus({ ...args, journeyId: journey.journeyId }), args);
    });
    const result = {
      ...briefing,
      returnedJourneys: finalizations.map((finalized) => finalized.status.journey),
      returnedJourneyVerifications: finalizations.flatMap((finalized) =>
        finalized.finalVerification ? [finalized.finalVerification] : []),
    };
    attachEpochEventsForPersistence(
      result,
      finalizations.flatMap((finalized) => epochEventsForPersistence(finalized.status)),
    );
    return withCurrentEconomyActions(
      mergeJourneyEventsForPersistence(result, briefing, ...finalizations.map((finalized) => finalized.status)),
      args,
      true,
    );
  }

  const compactTransportArray = (value: unknown): readonly unknown[] => Array.isArray(value) ? value : [];
  const compactJourneyForTransport = (value: unknown) => {
    const journey = recordValue(value);
    const taskPlan = recordValue(journey.taskPlan);
    return {
      journeyId: journey.journeyId,
      agentId: journey.agentId,
      explorerId: journey.explorerId,
      correlationId: journey.correlationId,
      status: journey.status,
      originRegionId: journey.originRegionId,
      destinationRegionId: journey.destinationRegionId,
      worldMode: journey.worldMode,
      episodeIds: compactTransportArray(journey.episodeIds),
      sourceEventIds: compactTransportArray(journey.sourceEventIds),
      version: journey.version,
      ...(Object.keys(taskPlan).length ? { taskPlan: {
        version: taskPlan.version,
        source: taskPlan.source,
        taskType: taskPlan.taskType,
        scenarioMapId: taskPlan.scenarioMapId,
        title: taskPlan.title,
        primaryObjective: taskPlan.primaryObjective,
        objectiveCount: compactTransportArray(taskPlan.objectives).length,
        routeCount: compactTransportArray(taskPlan.routes).length,
      } } : {}),
      startedAtWorldTime: journey.startedAtWorldTime,
      dueAtWorldTime: journey.dueAtWorldTime,
      dueAtRealTime: journey.dueAtRealTime,
      nextPollAt: journey.nextPollAt,
    };
  };
  const compactMissionForTransport = (value: unknown) => {
    const mission = recordValue(value);
    if (Object.keys(mission).length === 0) return undefined;
    return {
      kind: mission.kind,
      version: mission.version,
      missionId: mission.missionId,
      journeyId: mission.journeyId,
      title: mission.title,
      playerObjective: mission.playerObjective,
      primaryObjective: mission.primaryObjective,
      status: mission.status,
      currentTaskId: mission.currentTaskId,
      tasks: compactTransportArray(mission.tasks).map((value) => {
        const task = recordValue(value);
        return {
          taskId: task.taskId,
          sequence: task.sequence,
          title: task.title,
          objective: task.objective,
          completionCriteria: task.completionCriteria,
          status: task.status,
        };
      }),
      outcome: mission.outcome,
      adjudication: mission.adjudication,
    };
  };
  const compactEpisodeForTransport = (value: unknown) => {
    const episode = recordValue(value);
    if (Object.keys(episode).length === 0) return undefined;
    const serverFacts = recordValue(episode.serverFacts);
    const narrative = recordValue(episode.narrative);
    return {
      episodeId: episode.episodeId,
      phase: episode.phase,
      type: episode.type,
      title: episode.title,
      generatedTaskObjective: episode.generatedTaskObjective,
      settlement: episode.settlement,
      ...(Object.keys(serverFacts).length ? { serverFacts: {
        sourceEventIds: serverFacts.sourceEventIds,
        action: serverFacts.action,
        sharedWorldImpact: serverFacts.sharedWorldImpact,
        factionAlignment: serverFacts.factionAlignment,
      } } : {}),
      ...(Object.keys(narrative).length ? { narrative: {
        kind: narrative.kind,
        sourceEventIds: narrative.sourceEventIds,
        postcard: narrative.postcard,
      } } : {}),
    };
  };
  const preserveCompactTransportEvents = <T extends AnyRecord>(compact: T, result: unknown): T => {
    attachEpochEventsForPersistence(compact, epochEventsForPersistence(result));
    const merged = mergeJourneyEventsForPersistence(compact, result) as T;
    if (isMcpResultAlreadyPersisted(result)) markMcpResultAlreadyPersisted(merged);
    return merged;
  };
  const persistCompleteJourneyVerificationBeforeCompactTransport = async (result: unknown) => {
    const finalVerification = recordValue(recordValue(result).finalVerification);
    const page = recordValue(finalVerification.page);
    const partialPersistence = currentMcpRequestContext()?.persistPartial;
    if (!partialPersistence || Object.keys(page).length === 0) return;
    // The compact response intentionally exposes only a small public link.
    // Persist the complete server-authored page before that projection discards
    // its story and shared-world evidence.
    await partialPersistence("obsidian_epoch.journey_final_verification", { page });
  };
  const compactJourneyStartForTransport = (result: unknown) => {
    const value = recordValue(result);
    const journey = recordValue(value.journey);
    const taskGeneration = recordValue(value.taskGeneration);
    const sampling = recordValue(value.sampling);
    const phase6Settlement = recordValue(value.phase6Settlement);
    const startBinding = recordValue(phase6Settlement.startJourneyBinding);
    return preserveCompactTransportEvents({
      authority: "server_started_journey",
      transportVersion: "journey_start.compact.v1",
      journey: compactJourneyForTransport(journey),
      mission: compactMissionForTransport(value.mission),
      episode: compactEpisodeForTransport(
        value.episode ?? value.arrivalEpisode ?? value.objectiveEpisode,
      ),
      taskGeneration: {
        mode: taskGeneration.mode,
        status: taskGeneration.status,
        source: taskGeneration.source,
        fallbackReason: taskGeneration.fallbackReason,
        taskType: taskGeneration.taskType,
        scenarioMapId: taskGeneration.scenarioMapId,
      },
      sampling: {
        ok: sampling.ok,
        status: sampling.status,
        source: sampling.source,
        fallbackReason: sampling.fallbackReason,
      },
      ...(Object.keys(phase6Settlement).length ? { phase6Settlement: {
        ok: phase6Settlement.ok,
        status: phase6Settlement.status,
        experimentId: startBinding.experimentId,
        runId: startBinding.runId,
        runIndex: startBinding.runIndex,
        journeyId: startBinding.journeyId,
        receiptId: startBinding.receiptId,
      } } : {}),
      expectedVersion: journey.version,
      compactStateTool: "obsidian_epoch.journey_status_compact",
    }, result);
  };
  const compactJourneyProposalForTransport = (
    result: ReturnType<typeof runtime.epochProposeJourneyStep>,
  ) => {
    const contract = result.proposal.sceneContract;
    const firstSignedAction = contract?.actionOptions[0];
    // PR8: use public-only serializer — no internal fields leak to compact transport.
    const compactActionOptions = (contract?.actionOptions ?? []).map((action) => {
      const serialized = serializeCompact(
        action,
        contract?.journeyId ?? "",
        contract?.sceneId ?? "",
        contract?.expectedVersion ?? 0,
        contract?.taskObjective?.kind,
        contract?.expiresAt ?? "",
      );
      assertPublicActionZeroBonus(serialized);
      return serialized;
    });
    return preserveCompactTransportEvents({
      authority: "server_signed_scene_contract",
      transportVersion: "journey_proposal.compact.v1",
      journey: compactJourneyForTransport(result.journey),
      policySelection: result.policySelection,
      preview: result.preview,
      mission: compactMissionForTransport(result.mission),
      episode: compactEpisodeForTransport(result.episode),
      scenePlan: {
        status: result.scenePlan.status,
        candidateCount: result.scenePlan.candidates.length,
        episodeCount: result.scenePlan.episodes.length,
        usedRoutineFallback: result.scenePlan.usedRoutineFallback,
      },
      stepNumber: result.stepNumber,
      totalSteps: result.totalSteps,
      proposal: {
        journeyId: result.proposal.journeyId,
        episode: compactEpisodeForTransport(result.proposal.episode),
        stepNumber: result.proposal.stepNumber,
        totalSteps: result.proposal.totalSteps,
        sceneContract: contract ? {
          sceneId: contract.sceneId,
          journeyId: contract.journeyId,
          episodeId: contract.episodeId,
          sceneType: contract.sceneType,
          phase: contract.phase,
          worldMode: contract.worldMode,
          title: contract.title,
          premise: contract.premise,
          location: contract.location,
          participants: contract.participants,
          confirmedFactIds: contract.confirmedFactIds,
          actionOptions: compactActionOptions,
          safeFallbackActionOptionId: contract.safeFallbackActionOptionId,
          expectedVersion: contract.expectedVersion,
          expiresAt: contract.expiresAt,
          ruleVersion: contract.ruleVersion,
          taskObjective: contract.taskObjective,
          ...(firstSignedAction ? { verification: {
            signatureAlgorithm: firstSignedAction.signatureAlgorithm,
            signatureVersion: firstSignedAction.signatureVersion,
            signingPurpose: firstSignedAction.signingPurpose,
            signingKeyId: firstSignedAction.signingKeyId,
            serverPublicKey: firstSignedAction.serverPublicKey,
          } } : {}),
        } : null,
        actionOptions: result.proposal.actionOptions,
        expectedVersion: result.proposal.expectedVersion,
      },
      fullStateTool: "obsidian_epoch.journey_status",
      compactStateTool: "obsidian_epoch.journey_status_compact",
    }, result);
  };
  const compactJourneyCommitForTransport = (
    result: ReturnType<typeof runtime.epochCommitJourneyAction>,
  ) => {
    const value = recordValue(result);
    const journey = recordValue(value.journey);
    const settledAction = recordValue(value.settledAction);
    const worldCommit = recordValue(value.worldCommit ?? journey.worldCommit);
    return preserveCompactTransportEvents({
      authority: "server_committed_journey_action",
      transportVersion: "journey_commit.compact.v1",
      journey: compactJourneyForTransport(journey),
      mission: compactMissionForTransport(value.mission),
      episode: compactEpisodeForTransport(
        value.episode ?? value.objectiveEpisode ?? value.mainEpisode ?? value.returnEpisode,
      ),
      settledAction: {
        actionId: settledAction.actionId,
        actionOptionId: settledAction.actionOptionId,
        optionLabel: settledAction.optionLabel,
        risk: settledAction.risk,
        explanation: settledAction.explanation,
        visibleText: settledAction.visibleText,
        outcomeSummary: settledAction.outcomeSummary,
        journeyResolution: settledAction.journeyResolution,
        reward: settledAction.reward,
        recordedAt: settledAction.recordedAt,
      },
      taskAdjudication: value.taskAdjudication,
      rewardGrant: value.rewardGrant,
      ...(Object.keys(worldCommit).length ? { worldCommit: {
        status: worldCommit.status,
        reason: worldCommit.reason,
        commitEventId: worldCommit.commitEventId,
        sourceEventIds: worldCommit.sourceEventIds,
        npcRelationshipCount: compactTransportArray(worldCommit.npcRelationships).length,
        factionStandingCount: compactTransportArray(worldCommit.factionStandings).length,
      } } : {}),
      expectedVersion: journey.version,
      compactStateTool: "obsidian_epoch.journey_status_compact",
    }, result);
  };
  const compactJourneyIntentForTransport = (result: Awaited<ReturnType<typeof runtime.epochCommitJourneyIntent>>) => {
    const resultRecord = recordValue(result);
    const value = recordValue(resultRecord.value);
    const journey = recordValue(resultRecord.journey);
    const action = recordValue(value.action);
    const match = recordValue(value.match);
    return preserveCompactTransportEvents({
      authority: "server_intent_agent_and_game_core",
      transportVersion: "journey_intent.compact.v1",
      journey: compactJourneyForTransport(journey),
      episode: compactEpisodeForTransport(
        resultRecord.episode ?? resultRecord.objectiveEpisode ?? resultRecord.mainEpisode,
      ),
      expectedVersion: journey.version,
      intent: value.intent,
      match: {
        status: match.status,
        optionLabel: match.optionLabel,
        confidence: match.confidence,
        reason: match.reason,
        preparationSteps: match.preparationSteps,
      },
      action: {
        actionId: action.actionId,
        optionLabel: action.optionLabel,
        risk: action.risk,
        outcomeSummary: action.outcomeSummary,
        journeyResolution: action.journeyResolution,
        reward: action.reward,
        lifetimeDelta: action.lifetimeDelta,
        nonEvidence: action.nonEvidence,
        recordedAt: action.recordedAt,
      },
    }, result);
  };
  const compactEconomyActionsForTransport = (value: unknown) => {
    const economy = recordValue(value);
    if (!Object.hasOwn(economy, "authority")) return undefined;
    return {
      authority: economy.authority,
      version: economy.version,
      ownerAccess: economy.ownerAccess,
      balances: economy.balances,
      actions: recordArray(economy.actions).slice(0, 12).map((candidate) => {
        const action = recordValue(candidate);
        const item = recordValue(action.item);
        const availability = recordValue(action.availability);
        const execution = recordValue(action.execution);
        const impact = recordValue(action.nextJourneyImpact);
        return {
          actionId: action.actionId,
          kind: action.kind,
          item: {
            itemKey: item.itemKey,
            displayName: item.displayName,
            rarity: item.rarity,
            boundOnAcquire: item.boundOnAcquire,
          },
          costs: action.costs,
          availability: {
            status: availability.status,
            missingResources: availability.missingResources,
            balancesAfter: availability.balancesAfter,
          },
          execution: {
            tool: execution.tool,
            arguments: execution.arguments,
            idempotencyKeyRequired: execution.idempotencyKeyRequired,
          },
          nextJourneyImpact: impact,
        };
      }),
    };
  };
  const compactJourneyStatusForTransport = async (result: unknown) => {
    await persistCompleteJourneyVerificationBeforeCompactTransport(result);
    const value = recordValue(result);
    const journey = recordValue(value.journey);
    const storyReport = recordValue(value.storyReport);
    const evaluation = recordValue(storyReport.evaluation);
    const phase6Settlement = recordValue(value.phase6Settlement);
    const receipt = recordValue(phase6Settlement.receipt);
    const resultPage = recordValue(phase6Settlement.resultPage);
    const experimentRun = recordValue(phase6Settlement.experimentRun);
    const experimentFailure = recordValue(experimentRun.failure);
    const settlementFindings: AnyRecord[] = [];
    const settlementFindingKeys = new Set<string>();
    const settlementFindingObjects = new WeakSet<object>();
    const collectSettlementFindings = (candidate: unknown): void => {
      if (!candidate || typeof candidate !== "object" || settlementFindings.length >= 8) return;
      if (settlementFindingObjects.has(candidate as object)) return;
      settlementFindingObjects.add(candidate as object);
      if (Array.isArray(candidate)) {
        candidate.forEach(collectSettlementFindings);
        return;
      }
      const record = recordValue(candidate);
      compactTransportArray(record.findings).forEach((entry) => {
        if (settlementFindings.length >= 8) return;
        const finding = recordValue(entry);
        const key = [finding.code, finding.path, finding.message].join("\u0000");
        if (settlementFindingKeys.has(key)) return;
        settlementFindingKeys.add(key);
        const details = Object.fromEntries(Object.entries(recordValue(finding.details))
          .filter(([, detail]) => detail === null || ["string", "number", "boolean"].includes(typeof detail))
          .slice(0, 10));
        settlementFindings.push({
          code: finding.code,
          severity: finding.severity,
          path: finding.path,
          message: finding.message,
          ...(Object.keys(details).length > 0 ? { details } : {}),
        });
      });
      Object.entries(record).forEach(([key, entry]) => {
        if (key !== "findings") collectSettlementFindings(entry);
      });
    };
    collectSettlementFindings(phase6Settlement);
    const finalVerification = recordValue(value.finalVerification);
    const verificationPage = recordValue(finalVerification.page);
    const economyActions = compactEconomyActionsForTransport(value.economyActions);
    return preserveCompactTransportEvents({
      authority: "server_journey_status",
      transportVersion: "journey_status.compact.v1",
      journey: compactJourneyForTransport(journey),
      mission: compactMissionForTransport(value.mission),
      episodeSummaries: compactTransportArray(value.episodes).slice(-6).map((entry) => {
        const episode = recordValue(entry);
        const settlement = recordValue(episode.settlement);
        const objective = recordValue(episode.generatedTaskObjective);
        const taskObjective = recordValue(settlement.taskObjective);
        return {
          episodeId: episode.episodeId,
          phase: episode.phase,
          type: episode.type,
          title: episode.title,
          objectiveId: objective.objectiveId ?? taskObjective.objectiveId,
          completionKind: taskObjective.completionKind,
          outcomeSummary: settlement.outcomeSummary,
          canonicalEventIds: settlement.canonicalEventIds,
        };
      }),
      taskAdjudication: value.taskAdjudication,
      rewardGrant: value.rewardGrant,
      ...(Object.keys(storyReport).length ? { storyReport: {
        kind: storyReport.kind,
        version: storyReport.version,
        journeyId: storyReport.journeyId,
        profile: storyReport.profile,
        resolution: storyReport.resolution,
        evaluation: {
          taskCompletionGrade: evaluation.taskCompletionGrade,
          identityFidelityPercent: evaluation.identityFidelityPercent,
          rewards: evaluation.rewards,
          rewardConversion: evaluation.rewardConversion,
          playerImpact: evaluation.playerImpact,
        },
        sourceEventIds: storyReport.sourceEventIds,
      } } : {}),
      ...(Object.keys(phase6Settlement).length ? { phase6Settlement: {
        ok: phase6Settlement.ok,
        status: phase6Settlement.status,
        restored: phase6Settlement.restored,
        pageId: phase6Settlement.pageId,
        receiptId: phase6Settlement.receiptId,
        error: phase6Settlement.error,
        findings: settlementFindings,
        experimentRun: {
          experimentId: experimentRun.experimentId,
          runId: experimentRun.runId,
          runIndex: experimentRun.runIndex,
          state: experimentRun.state,
          journeyId: experimentRun.journeyId,
          receiptId: experimentRun.receiptId,
          failureReason: experimentFailure.reason,
        },
        receipt: {
          version: receipt.version,
          receiptId: receipt.receiptId,
          experimentId: receipt.experimentId,
          runIndex: receipt.runIndex,
          journeyId: receipt.journeyId,
          resultVerified: receipt.resultVerified,
          integrity: receipt.integrity,
        },
        resultPage: {
          pageId: resultPage.pageId,
          receiptId: resultPage.receiptId,
          journeyId: resultPage.journeyId,
          resultVerified: resultPage.resultVerified,
        },
      } } : {}),
      ...(Object.keys(verificationPage).length ? { finalVerification: {
        pageId: verificationPage.pageId,
        urlPath: verificationPage.urlPath,
        createdAt: verificationPage.createdAt,
      } } : {}),
      ...(economyActions ? { economyActions } : {}),
      expectedVersion: journey.version,
    }, result);
  };

  const compactPhase6RunReceiptForTransport = buildCompactPhase6RunReceiptForTransport({
    compactTransportArray,
    preserveCompactTransportEvents,
  });
  const compactPhase6ResultForTransport = buildCompactPhase6ResultForTransport({
    compactTransportArray,
    preserveCompactTransportEvents,
  });

  const handlers = new Map<string, (args: AnyRecord) => unknown>([
    ["agent_world.context_package", (args) => runtime.getContext(args)],
    ["agent_world.context_snapshots", (args) => runtime.contextSnapshots(args)],
    ["agent_world.start_run", (args) => {
      assertLegacyMutationEnabled();
      return runtime.startRun(args);
    }],
    ["agent_world.run_heartbeat", (args) => runtime.runHeartbeat(args)],
    ["agent_world.submit_battle_report", (args) => {
      assertLegacyMutationEnabled();
      return runtime.submitBattleReport(args);
    }],
    ["agent_world.archive_local_report", (args) => runtime.archiveLocalReport(args)],
    ["agent_world.outbox", (args) => runtime.outbox(args)],
    ["agent_world.replay_outbox", (args) => runtime.replayOutbox(args)],
    ["agent_world.review_queue", (args) => runtime.reviewQueue(args)],
    ["agent_world.public_world", () => runtime.publicWorld()],
    ["agent_world.progression_state", (args) => runtime.progressionState(args)],
    ["agent_world.operation_check", (args) => runtime.operationCheck(args)],
    ["agent_world.community_react", (args) => runtime.communityReact(authenticatedCommunityInput(args))],
    ["agent_world.community_comment", (args) => runtime.communityComment(authenticatedCommunityInput(args))],
    ["agent_world.community_flag", (args) => runtime.communityFlag(authenticatedCommunityInput(args))],
    ["agent_world.community_moderation", (args) => {
      runtime.epochOperatorOverview({ operatorKey: args.operatorKey, limit: 1 });
      return runtime.communityModeration();
    }],
    ["agent_world.community_moderate", (args) => runtime.communityModerate(args)],
    ["agent_world.community_thread", (args) => runtime.communityThread(args)],
    ["agent_world.transparency_verify", () => runtime.transparencyVerify()],
    // Identity handlers registered below via registerIdentityHandlers().
    // Journey handlers registered below via registerJourneyHandlers().
    ["obsidian_epoch.abuse_status", (args) => runtime.epochAbuseStatus(args)],
    ["obsidian_epoch.abuse_profiles", (args) => runtime.epochAbuseProfiles(args)],
    ["obsidian_epoch.operator_overview", (args) => runtime.epochOperatorOverview(args)],
    ["obsidian_epoch.run_maintenance", (args) => runtime.epochRunMaintenance(args)],
    // World-events handlers registered below via registerWorldEventsHandlers().
    // Economy / trade / bounty / party-run handlers registered below via registerEconomyHandlers().
    // Combat / raid / diplomacy handlers registered below via registerCombatHandlers().
    ["obsidian_epoch.trace_conflict_templates", (args) => runtime.epochTraceConflictTemplates(args)],
    ["obsidian_epoch.deploy_trace_conflict", (args) => runtime.epochDeployTraceConflict(args)],
    ["obsidian_epoch.owner_trace_conflicts", (args) => runtime.epochOwnerTraceConflicts(args)],
    ["obsidian_epoch.owner_trace_conflict_memories", (args) => runtime.epochOwnerTraceConflictMemories(args)],
    ["obsidian_epoch.region_trace_conflicts", (args) => runtime.epochRegionTraceConflicts(args)],
    ["obsidian_epoch.hosted_sessions", (args) => runtime.epochHostedSessions(args)],
    ["obsidian_epoch.hosted_watch", (args) => runtime.epochHostedSessionWatch(args)],
    ["obsidian_epoch.start_hosted_session", (args) => runtime.epochStartHostedSession(args)],
    ["obsidian_epoch.submit_hosted_action", (args) => runtime.epochSubmitHostedAction(args)],
    ["obsidian_epoch.submit_hosted_intent", (args) => runtime.epochSubmitHostedIntent(args)],
    ["obsidian_epoch.run_server_hosted_action", (args) => runtime.epochRunServerHostedAction(args)],
    ["obsidian_epoch.queue_server_hosted_action", (args) => runtime.epochQueueServerHostedAction(args)],
    ["obsidian_epoch.server_hosted_jobs", (args) => runtime.epochServerHostedJobs(args)],
    ["obsidian_epoch.run_server_hosted_job", (args) => runtime.epochRunServerHostedJob(args)],
    ["obsidian_epoch.web_bridge_turn", (args) => runtime.epochWebBridgeTurn(args)],
    ["obsidian_epoch.submit_web_bridge_action", (args) => runtime.epochSubmitWebBridgeAction(args)],
    ["obsidian_epoch.submit_web_bridge_intent", (args) => runtime.epochSubmitWebBridgeIntent(args)],
    ["obsidian_epoch.attestation_challenge", (args) => runtime.epochAttestationChallenge(args)],
    ["obsidian_epoch.submit_attested_action", (args) => runtime.epochSubmitAttestedAction(args)],
    ["obsidian_epoch.events", (args) => runtime.epochEvents(args)],
    ["obsidian_epoch.audit", (args) => runtime.epochAudit(args)],
  ]);

  // World / simulation handlers — extracted to mcpToolsWorld.ts.
  registerWorldHandlers(handlers, runtime, {
    worldKnowledgeSearch,
    worldMemorySearch,
    capturePhase6RagTraceForResult,
  });

  // Economy / trade / bounty / party-run handlers — extracted to mcpToolsEconomy.ts.
  registerEconomyHandlers(handlers, runtime);

  // World-events handlers — extracted to mcpToolsWorldEvents.ts.
  registerWorldEventsHandlers(handlers, runtime);

  // NPC / organization / household / social-hook handlers — extracted to mcpToolsNpc.ts.
  registerNpcHandlers(handlers, runtime);

  // Combat / raid / diplomacy / turn-card handlers — extracted to mcpToolsCombat.ts.
  registerCombatHandlers(handlers, runtime);

  // Identity handlers — extracted to mcpToolsIdentity.ts.
  registerIdentityHandlers(handlers, runtime, {
    authoritativeIdentityIssuance,
    serverAssignedIdentityInput,
    agentBriefingWithFinalVerification,
  });

  // Journey handlers — extracted to mcpToolsJourney.ts.
  registerJourneyHandlers(handlers, runtime, {
    startJourneyWithSampling,
    compactJourneyStartForTransport,
    compactJourneyProposalForTransport: compactJourneyProposalForTransport as (result: unknown) => unknown,
    commitJourneyActionWithPersistence,
    commitJourneyIntentWithPersistence: async (
      args: AnyRecord,
      options: { readonly externalTransport?: boolean } = {},
    ) => {
      const result = await runtime.epochCommitJourneyIntent(args);
      if (options.externalTransport && currentMcpRequestContext()?.persistPartial) {
        const externalResult = { ...result };
        if (isMcpResultAlreadyPersisted(result)) markMcpResultAlreadyPersisted(externalResult);
        return externalResult;
      }
      return result;
    },
    compactJourneyCommitForTransport: compactJourneyCommitForTransport as (result: unknown) => unknown,
    compactJourneyIntentForTransport: compactJourneyIntentForTransport as (result: unknown) => unknown,
    journeyStatusWithFinalVerification,
    compactJourneyStatusForTransport,
    recallJourneyHandler: async (args: AnyRecord) => {
      const result = runtime.epochRecallJourney(args);
      const journeyId = optionalString(recordValue(recordValue(result).journey).journeyId);
      if (phase6CommittedResults && journeyId && phase6BindingFromStoredJourney(journeyId)) {
        const committed = { journeyId, result };
        const partialPersistence = currentMcpRequestContext()?.persistPartial;
        if (partialPersistence) {
          if (partialPersistence.supportsPhase6CommittedResultAtomicWrite !== true) {
            throw new Error("phase6_committed_result_atomic_persistence_unavailable");
          }
          attachPhase6CommittedResultForPersistence(result, committed);
          await partialPersistence("obsidian_epoch.recall_journey", result);
          markMcpResultAlreadyPersisted(result);
        } else {
          phase6CommittedResults.append(journeyId, result);
        }
      }
      return result;
    },
  });

  // Phase 6 handlers — extracted to mcpToolsPhase6.ts.
  registerPhase6Handlers(handlers, runtime, {
    compactPhase6RunReceiptForTransport,
    compactPhase6ResultForTransport,
    compactTransportArray,
    preserveCompactTransportEvents,
  });

  return {
    protocolVersion: MCP_PROTOCOL_VERSION,
    serverInfo: MCP_SERVER_INFO,
    capabilities: { tools: {}, prompts: {} },
    runtime,
    listTools: () => AGENT_WORLD_TOOLS.map((tool) => ({ ...tool, inputSchema: { ...tool.inputSchema } })),
    callTool: async (name: string, args: AnyRecord = {}) => {
      assertLegacyAgentWorldToolRemoved(name);
      const handler = handlers.get(name);
      if (!handler) throw new Error(`unknown_tool:${name}`);
      // Validate input against tool schema
      const toolDef = AGENT_WORLD_TOOLS.find((t) => t.name === name);
      if (toolDef?.inputSchema) {
        validateToolInput(name, args || {}, toolDef.inputSchema as Record<string, unknown>);
      }
      try {
        return toolResult(await handler(args || {}));
      } catch (error) {
        if (recordRejectedCommands && REJECTED_COMMAND_AUDIT_TOOLS.has(name)) {
          try {
            runtime.epochRecordRejectedCommand({
              surface: "mcp",
              command: name,
              errorCode: errorCodeForRejectedCommand(error),
              input: args || {},
            });
          } catch {
            // Preserve the original tool error; audit failure must not change command semantics.
          }
        }
        throw error;
      }
    },
  };
}
