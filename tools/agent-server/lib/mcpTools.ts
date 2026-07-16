import { adjudicateRun } from "./adjudicator.ts";
import { buildPublicWorldView, createCommunityLedger } from "./community.ts";
import {
  buildLegacyMultiAgentReservation,
  buildLegacyRunCapabilityEnvelope,
  createContextPackage,
  LEGACY_AGENT_WORLD_LOOP,
} from "./contextPackage.ts";
import { EPOCH_CONTENT_POLICY_REGION_ENV_VAR, resolveEpochContentPolicy } from "./contentPolicy.ts";
import { createExperienceLedger, ratingRevealFor, settlementEffectFor } from "./experience.ts";
import { createFactionLedger } from "./factions.ts";
import { createDigest, createFeedbackEvents, createRepairTicket, createRunFeedback } from "./feedback.ts";
import { resolveEpochFrontstageStatus } from "./frontstageStatus.ts";
import { createLoreLedger } from "./lore.ts";
import { createEpochOperationSwitchRegistry, type EpochOperationGateInput } from "./operationSwitches.ts";
import { createLegacyOutboxLedger, graphSyncFromOutboxEntries, type LegacyOutboxCreateInput } from "./outbox.ts";
import { createEpochRuntime } from "./epoch/runtime.ts";
import { projectEpochEvents } from "./epoch/gameCore.ts";
import { createAgentCompanionRuntime } from "./epoch/agentCompanionRuntime.ts";
import type { EpochEvent } from "./epoch/events.ts";
import {
  createEpochWorldClockRuntime,
  type CreateEpochWorldClockRuntimeOptions,
} from "./epoch/worldClockRules.ts";
import {
  createEpochWorldSimulationRuntime,
  worldSimulationHistoricalSlice,
  worldSimulationView,
  type CreateEpochWorldSimulationRuntimeOptions,
  type EpochWorldConflictEvidence,
  type EpochWorldSimulationRegionSignal,
  type MigrateEpochWorldSimulationContentInput,
} from "./epoch/worldSimulationRules.ts";
import { epochWorldMinuteFromTime, epochWorldTimeFromMinute } from "./epoch/worldCalendar.ts";
import {
  canonicalPlaceContext,
  loadDefaultWorldContentRegistry,
  validateWorldContentRegistry,
  worldContentRegistryView,
  type WorldContentRegistryViewInput,
} from "./epoch/worldContentRegistry.ts";
import { projectJourneyRuntimeEvents, type JourneyRuntimeEvent } from "./epoch/journeyReadModel.ts";
import {
  journeyTaskGraphState,
  nextJourneyTaskObjective,
  type JourneyTaskEvidenceEpisode,
  type JourneyGeneratedTaskPlan,
  type JourneyHiddenTaskSealResolver,
} from "./epoch/journeyGeneratedTaskRules.ts";
import { journeyMetricsView } from "./epoch/journeyMetricsReadModel.ts";
import {
  buildPersistedJourneyNarrative,
  buildServerJourneyEpisodeFacts,
} from "./epoch/journeyNarrativeRules.ts";
import { currentMcpRequestContext } from "./mcpRequestContext.ts";
import {
  EPOCH_ACTIVE_IDENTITY_TOOL_NAMES,
  EPOCH_ARCHIVED_IDENTITY_RECOMMENDED_TOOLS,
} from "./epoch/actionEligibilityReadModel.ts";
import {
  attachEpochEventsForPersistence,
  boundedEpochTransportValue,
  epochEventsForPersistence,
} from "./epoch/runtimePublicProjectionRules.ts";
import {
  journeyEventsForPersistence,
  mergeJourneyEventsForPersistence,
} from "./epoch/journeyPersistence.ts";
import { createProgressionLedger } from "./progression.ts";
import { assertPublicSafe } from "./safety.ts";
import { createTicketRegistry, hashRunPayload } from "./tickets.ts";
import { createTransparencyLedger, publicVerificationRecord } from "./transparency.ts";

type AnyRecord = Record<string, unknown>;
type ContextSnapshotRecord = AnyRecord & {
  readonly versions: AnyRecord;
  readonly retrievalParams: AnyRecord;
  readonly filteringReasons: string[];
  readonly settingCards: AnyRecord[];
};
const LEGACY_UNSPECIFIED_REGION_ID = "legacy_region_unspecified";
const LEGACY_MUTATION_DISABLED_ERROR = "legacy_mutation_disabled_in_production";
const LOCAL_ARCHIVE_LOOP = {
  loopMode: "local_trial_archive",
  channelClass: "local_trial",
  deliveryTrust: "untrusted_client",
} as const;
const LEGACY_EVENT_RISKS = new Set(["low", "medium", "high"]);
const LEGACY_RISK_ORDER = ["low", "medium", "high"];
const LEGACY_REVIEW_STAGES = [
  { stage: "queued", label: "排队中" },
  { stage: "rule_check", label: "规则校验" },
  { stage: "light_review", label: "轻审" },
  { stage: "heavy_review", label: "重审" },
  { stage: "manual_review", label: "人工" },
  { stage: "completed", label: "完成" },
] as const;
function normalizeLegacyActionType(actionType: string) {
  return actionType
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/^obsidian_epoch_/, "");
}

const LEGACY_COOLDOWN_GOVERNED_ACTION_TYPES = new Set([
  "resolve_raid",
  "spawn_resource_node",
]);
const LEGACY_CANONICAL_ACTION_TYPES = new Set(
  EPOCH_ACTIVE_IDENTITY_TOOL_NAMES.map(normalizeLegacyActionType),
);
const LEGACY_ITEM_USE_INPUT_KEYS = new Set([
  "equipmenteffect",
  "equipmenteffects",
  "itemid",
  "itemids",
  "itemkey",
  "itemkeys",
  "useditemid",
  "useditemids",
  "useditems",
]);
const LEGACY_OUTCOME_STATE_KEYS = new Set([
  "canonicaloutcome",
  "canonicalreward",
  "clientscore",
  "legendaward",
  "legenddelta",
  "lifetime",
  "lifetimechange",
  "lifetimedelta",
  "newspublished",
  "newsstatus",
  "officialresult",
  "publishnews",
  "resourcegrant",
  "resourcegranted",
  "resourcesgranted",
  "reward",
  "rewardamount",
  "rewardresourceid",
  "rewards",
  "score",
  "worldimpact",
]);

function legacyRunRiskLevel(run: AnyRecord) {
  const eventRisks = recordArray(run.events)
    .map((event) => optionalString(event.risk))
    .filter((risk): risk is string => typeof risk === "string" && LEGACY_EVENT_RISKS.has(risk));
  const highest = eventRisks
    .sort((left, right) => LEGACY_RISK_ORDER.indexOf(right) - LEGACY_RISK_ORDER.indexOf(left))[0];
  return highest || optionalString(run.riskLevel) || optionalString(run.risk);
}

function legacyRunOperationDimensions(run: AnyRecord): Omit<EpochOperationGateInput, "action" | "rewardType"> {
  return {
    commissionType: optionalString(run.commissionType),
    chapterId: optionalString(run.chapterId),
    locationId: optionalString(run.locationId) || optionalString(run.regionId),
    factionId: optionalString(run.factionId),
    riskLevel: legacyRunRiskLevel(run),
  };
}

function operationDimensionsFromInput(input: AnyRecord): Omit<EpochOperationGateInput, "action" | "rewardType"> {
  return {
    commissionType: optionalString(input.commissionType),
    chapterId: optionalString(input.chapterId),
    locationId: optionalString(input.locationId) || optionalString(input.regionId),
    factionId: optionalString(input.factionId),
    riskLevel: optionalString(input.riskLevel) || optionalString(input.risk),
  };
}

function operationSwitchActionValue(value: unknown): EpochOperationGateInput["action"] {
  if (value === "public_sharing" || value === "source_reward") return value;
  return "settlement";
}

function legacyPublicClaimGate(run: AnyRecord, adjudication: AnyRecord) {
  const requiresConfirmation = adjudication.worldImpact === "review_candidate"
    && Number(adjudication.claimSlots || 0) > 0;
  const confirmed = requiresConfirmation
    && (run.publicAdjudicationConfirmed === true || run.publicClaimConsent === true);
  return {
    scope: "shared_lore_claims",
    required: requiresConfirmation,
    confirmed,
    status: requiresConfirmation
      ? confirmed
        ? "confirmed_public_adjudication"
        : "withheld_pending_public_adjudication_confirmation"
      : "not_applicable",
    reason: requiresConfirmation
      ? "shared_claims_require_explicit_public_adjudication_confirmation"
      : "shared_claims_not_eligible_for_public_adjudication",
  };
}

type RuntimeOptions = AnyRecord & {
  submittedRuns?: readonly object[];
  repairTickets?: readonly object[];
  feedbackEvents?: readonly object[];
  transparencyEntries?: readonly object[];
  transparencyAnchors?: readonly object[];
  epochEvents?: readonly object[];
  resultPages?: readonly object[];
  contextSnapshots?: readonly object[];
  outbox?: object;
  outboxEvents?: readonly object[];
  journeyEvents?: readonly object[];
};
type AgentWorldRuntime = ReturnType<typeof createAgentWorldRuntime>;
type McpToolDefinition = {
  readonly name: string;
  readonly description?: string;
  readonly inputSchema: AnyRecord & {
    readonly required: string[];
    readonly properties: Record<string, unknown>;
  };
  readonly annotations?: AnyRecord;
};
type McpToolResult = {
  readonly content: Array<{ readonly type: string; readonly text: string }>;
  readonly events: AnyRecord[];
};
export type AgentWorldMcpRuntime = {
  readonly protocolVersion: string;
  readonly serverInfo: typeof MCP_SERVER_INFO;
  readonly capabilities: { readonly tools: AnyRecord };
  readonly runtime: AgentWorldRuntime;
  readonly listTools: () => McpToolDefinition[];
  readonly callTool: (name: string, args?: AnyRecord) => Promise<McpToolResult>;
};
export type AgentWorldRemoteMcpRuntime = Omit<AgentWorldMcpRuntime, "runtime"> & {
  readonly serverBase: string;
};

export const MCP_PROTOCOL_VERSION = "2025-06-18";
export const MCP_SERVER_INFO = {
  name: "obsidian-epoch-agent-world",
  version: "0.1.0",
};

const EPOCH_OWNER_RECOVERY_NON_ACTIVE_IDENTITY_TOOLS = [
  "obsidian_epoch.identity",
  "obsidian_epoch.rotate_recovery",
  "obsidian_epoch.reincarnate",
  "obsidian_epoch.player_data_export",
  "obsidian_epoch.owner_trace_conflicts",
  "obsidian_epoch.owner_trace_conflict_memories",
  "obsidian_epoch.revoke_result_page",
  "obsidian_epoch.delete_result_page",
  "obsidian_epoch.agent_briefing",
  "obsidian_epoch.journey_status",
  "obsidian_epoch.journey_album",
] as const;

const EPOCH_OPERATOR_TARGET_ACTIVE_IDENTITY_TOOLS = [
  "obsidian_epoch.create_item",
  "obsidian_epoch.claim_region_control",
  "obsidian_epoch.run_server_hosted_action",
  "obsidian_epoch.queue_server_hosted_action",
  "obsidian_epoch.run_server_hosted_job",
] as const;

const EPOCH_NON_RECOVERY_TARGET_ACTIVE_IDENTITY_TOOLS = [
  "obsidian_epoch.post_message",
  "obsidian_epoch.request_confirmation",
  "obsidian_epoch.tick_downtime",
  "obsidian_epoch.submit_attested_action",
] as const;

const EPOCH_CORE_ACTIVE_IDENTITY_EXCLUDED_METHODS = [
  "adjustLifetime",
  "grantResource",
  "spendResource",
] as const;

const EPOCH_CORE_ACTIVE_IDENTITY_METHOD_TOOL_COVERAGE = [
  { coreMethod: "confirmPersonalityDrift", tools: ["obsidian_epoch.confirm_personality_drift"] },
  { coreMethod: "archiveIdentity", tools: ["obsidian_epoch.archive_identity"] },
  { coreMethod: "setDowntime", tools: ["obsidian_epoch.set_downtime"] },
  { coreMethod: "claimDowntime", tools: ["obsidian_epoch.claim_downtime"] },
  { coreMethod: "tickDowntime", tools: ["obsidian_epoch.tick_downtime"] },
  { coreMethod: "submitNpcCandidate", tools: ["obsidian_epoch.submit_npc_candidate"] },
  { coreMethod: "postMessage", tools: ["obsidian_epoch.post_message"] },
  { coreMethod: "claimNewsLegend", tools: ["obsidian_epoch.claim_news_legend"] },
  { coreMethod: "recordLoreContribution", tools: ["obsidian_epoch.record_lore_contribution"] },
  { coreMethod: "contributeContestedObjective", tools: ["obsidian_epoch.contribute_objective"] },
  { coreMethod: "contestResourceNode", tools: ["obsidian_epoch.contest_resource_node"] },
  { coreMethod: "contestAnomalyEvent", tools: ["obsidian_epoch.contest_anomaly"] },
  { coreMethod: "createInventoryItem", tools: ["obsidian_epoch.create_item"] },
  { coreMethod: "craftInventoryItem", tools: ["obsidian_epoch.craft_item"] },
  { coreMethod: "purchaseShopOffer", tools: ["obsidian_epoch.purchase_shop_offer"] },
  { coreMethod: "bindInventoryItem", tools: ["obsidian_epoch.bind_item"] },
  { coreMethod: "contributeSeasonCampaign", tools: ["obsidian_epoch.contribute_season"] },
  { coreMethod: "claimReleasedRegionControl", tools: ["obsidian_epoch.claim_region_control"] },
  { coreMethod: "createMarketOrder", tools: ["obsidian_epoch.create_market_order"] },
  { coreMethod: "fillMarketOrder", tools: ["obsidian_epoch.fill_market_order"] },
  { coreMethod: "cancelMarketOrder", tools: ["obsidian_epoch.cancel_market_order"] },
  { coreMethod: "createDirectTrade", tools: ["obsidian_epoch.create_direct_trade"] },
  { coreMethod: "acceptDirectTrade", tools: ["obsidian_epoch.accept_direct_trade"] },
  { coreMethod: "cancelDirectTrade", tools: ["obsidian_epoch.cancel_direct_trade"] },
  { coreMethod: "createBounty", tools: ["obsidian_epoch.create_bounty"] },
  { coreMethod: "claimBounty", tools: ["obsidian_epoch.claim_bounty"] },
  { coreMethod: "createPartyRun", tools: ["obsidian_epoch.create_party_run"] },
  { coreMethod: "updatePartyInvite", tools: ["obsidian_epoch.update_party_invite"] },
  { coreMethod: "joinPartyRun", tools: ["obsidian_epoch.join_party_run"] },
  { coreMethod: "requestPartyJoin", tools: ["obsidian_epoch.request_party_join"] },
  { coreMethod: "resolvePartyJoinRequest", tools: ["obsidian_epoch.resolve_party_join_request"] },
  { coreMethod: "resolveRaid", tools: ["obsidian_epoch.resolve_raid"] },
  { coreMethod: "resolveRegionRevolt", tools: ["obsidian_epoch.resolve_region_revolt"] },
  { coreMethod: "resolveRetaliation", tools: ["obsidian_epoch.resolve_retaliation"] },
  { coreMethod: "updateOrganizationMembership", tools: ["obsidian_epoch.update_organization_membership"] },
  { coreMethod: "purchaseOrganizationUpgrade", tools: ["obsidian_epoch.purchase_organization_upgrade"] },
  { coreMethod: "contributeOrganizationTreasury", tools: ["obsidian_epoch.contribute_organization_treasury"] },
  { coreMethod: "proposeOrganizationBudget", tools: ["obsidian_epoch.propose_organization_budget"] },
  { coreMethod: "resolveOrganizationBudget", tools: ["obsidian_epoch.resolve_organization_budget"] },
  { coreMethod: "proposeDiplomacy", tools: ["obsidian_epoch.propose_diplomacy"] },
  { coreMethod: "respondDiplomacy", tools: ["obsidian_epoch.respond_diplomacy"] },
  { coreMethod: "updateRelationship", tools: ["obsidian_epoch.update_relationship"] },
  { coreMethod: "updateAgentNpcBond", tools: ["obsidian_epoch.update_agent_npc_bond"] },
  { coreMethod: "deployTraceConflict", tools: ["obsidian_epoch.deploy_trace_conflict"] },
  { coreMethod: "createTurnCard", tools: ["obsidian_epoch.turn_card"] },
  { coreMethod: "resolveTurnCard", tools: ["obsidian_epoch.resolve_turn"] },
  { coreMethod: "startHostedSession", tools: ["obsidian_epoch.start_hosted_session", "obsidian_epoch.run_server_hosted_action", "obsidian_epoch.web_bridge_turn"] },
  { coreMethod: "submitHostedAction", tools: ["obsidian_epoch.submit_hosted_action", "obsidian_epoch.run_server_hosted_action", "obsidian_epoch.run_server_hosted_job", "obsidian_epoch.submit_web_bridge_action", "obsidian_epoch.submit_attested_action"] },
  { coreMethod: "queueServerHostedJob", tools: ["obsidian_epoch.queue_server_hosted_action"] },
  { coreMethod: "canRunServerHostedJobOption", tools: ["obsidian_epoch.run_server_hosted_job"] },
] as const;

function isRecord(value: unknown): value is AnyRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function requireObject(value: unknown, name: string): AnyRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${name}_object_required`);
  }
  return value as AnyRecord;
}

function recordValue(value: unknown): AnyRecord {
  return isRecord(value) ? value : {};
}

function stringRecord(value: unknown, error: string): Record<string, string> {
  const input = recordValue(value);
  const result: Record<string, string> = {};
  for (const [key, item] of Object.entries(input)) {
    if (!key.trim() || typeof item !== "string" || !item.trim()) throw new Error(error);
    result[key.trim()] = item.trim();
  }
  return result;
}

function recordArray(value: unknown): AnyRecord[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function cloneRecords(value: unknown): AnyRecord[] {
  return recordArray(value).map((record) => ({ ...record }));
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" && value ? value : fallback;
}

function optionalString(value: unknown) {
  return typeof value === "string" && value ? value : undefined;
}

function numberValue(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function compactJourneyDecisionWorldSlice(value: unknown) {
  const slice = recordValue(value);
  const sliceHash = optionalString(slice.sliceHash);
  if (!sliceHash) return undefined;
  const start = recordValue(slice.start);
  const end = recordValue(slice.end);
  const direction = recordValue(slice.direction);
  const strongestResourceTrends = (field: "stockDelta" | "priceDeltaMilliCoin") =>
    Object.entries(recordValue(direction[field]))
      .flatMap(([resourceId, amount]) => typeof amount === "number" && Number.isFinite(amount) && amount !== 0
        ? [{ resourceId, amount }]
        : [])
      .sort((left, right) => Math.abs(right.amount) - Math.abs(left.amount)
        || left.resourceId.localeCompare(right.resourceId))
      .slice(0, 6);
  const regionState = (state: AnyRecord) => ({
    controllerFactionId: optionalString(state.controllerFactionId),
    securityBps: numberValue(state.securityBps),
    unrestBps: numberValue(state.unrestBps),
    conflictPressureBps: numberValue(state.conflictPressureBps),
    conflictPhases: Array.isArray(state.conflictPhases)
      ? state.conflictPhases.filter((phase): phase is string => typeof phase === "string").slice(0, 6)
      : [],
  });
  return {
    authority: slice.authority,
    regionId: slice.regionId,
    startedAtWorldTime: slice.startedAtWorldTime,
    endedAtWorldTime: slice.endedAtWorldTime,
    sliceHash,
    start: regionState(start),
    end: regionState(end),
    direction: {
      controllerChanged: direction.controllerChanged === true,
      populationDelta: numberValue(direction.populationDelta),
      treasuryCoinDelta: numberValue(direction.treasuryCoinDelta),
      securityDeltaBps: numberValue(direction.securityDeltaBps),
      unrestDeltaBps: numberValue(direction.unrestDeltaBps),
      conflictPressureDeltaBps: numberValue(direction.conflictPressureDeltaBps),
      strongestStockDeltas: strongestResourceTrends("stockDelta"),
      strongestPriceDeltasMilliCoin: strongestResourceTrends("priceDeltaMilliCoin"),
    },
  };
}

function positiveIntegerValue(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

function nonNegativeIntegerValue(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : fallback;
}

function positiveNumberValue(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function epochActiveIdentityToolAudit() {
  const excluded = new Set<string>(EPOCH_OWNER_RECOVERY_NON_ACTIVE_IDENTITY_TOOLS);
  const ownerRecoveryTools = AGENT_WORLD_TOOLS
    .filter((tool) =>
      tool.name.startsWith("obsidian_epoch.")
      && Boolean((tool.inputSchema.properties as AnyRecord | undefined)?.recoveryCode)
      && !excluded.has(tool.name))
    .map((tool) => tool.name)
    .sort();
  return {
    policy: "schema_derived_active_identity_write_coverage",
    ownerRecoveryTools,
    ownerRecoveryExcludedTools: EPOCH_OWNER_RECOVERY_NON_ACTIVE_IDENTITY_TOOLS,
    operatorTargetTools: EPOCH_OPERATOR_TARGET_ACTIVE_IDENTITY_TOOLS,
    nonRecoveryTargetTools: EPOCH_NON_RECOVERY_TARGET_ACTIVE_IDENTITY_TOOLS,
    coreOnlyExcludedMethods: EPOCH_CORE_ACTIVE_IDENTITY_EXCLUDED_METHODS,
    coreActiveMethodTools: EPOCH_CORE_ACTIVE_IDENTITY_METHOD_TOOL_COVERAGE,
  };
}

function publicWorldView({
  loreLedger,
  factionLedger,
  submittedRuns,
}: {
  readonly loreLedger: ReturnType<typeof createLoreLedger>;
  readonly factionLedger: ReturnType<typeof createFactionLedger>;
  readonly submittedRuns: readonly AnyRecord[];
}) {
  return buildPublicWorldView({
    loreState: recordValue(loreLedger.state()),
    factionState: recordValue(factionLedger.state()),
    runs: submittedRuns,
  });
}

function legacyFailurePublication(adjudication: AnyRecord) {
  const publication = recordValue(adjudication.failurePublication);
  return stringValue(publication.selectedMode) ? publication : null;
}

function legacyFailureClaimPreview(run: AnyRecord) {
  return recordArray(run.candidateClaims).map((claim) => ({
    subject: stringValue(claim.subject),
    predicate: stringValue(claim.predicate),
    object: stringValue(claim.object),
  })).filter((claim) => claim.subject && claim.predicate && claim.object);
}

function legacyFailurePublicFields(run: AnyRecord, adjudication: AnyRecord) {
  const failurePublication = legacyFailurePublication(adjudication);
  if (!failurePublication) return {};
  return {
    failurePublication: { ...failurePublication },
    ...(failurePublication.selectedMode === "claim_only"
      ? { claimPreview: legacyFailureClaimPreview(run) }
      : {}),
  };
}

function legacyPublicIndexIdentityFields(run: AnyRecord, adjudication: AnyRecord) {
  const failurePublication = legacyFailurePublication(adjudication);
  const identityDisclosure = stringValue(failurePublication?.identityDisclosure);
  if (identityDisclosure === "anonymous" || identityDisclosure === "none") return {};
  return {
    explorerId: optionalString(run.explorerId),
    agentId: optionalString(run.agentId),
  };
}

function legacySettlementOutboxEntries({
  runTicket,
  run,
  adjudication,
  lore,
  progression,
  feedbackEvents,
  transparencyEntry,
}: {
  readonly runTicket: string;
  readonly run: AnyRecord;
  readonly adjudication: AnyRecord;
  readonly lore: AnyRecord;
  readonly progression: AnyRecord;
  readonly feedbackEvents: readonly AnyRecord[];
  readonly transparencyEntry: AnyRecord | null;
}): LegacyOutboxCreateInput[] {
  const aggregateId = runTicket;
  const explorerId = optionalString(run.explorerId);
  const identityFields = legacyPublicIndexIdentityFields(run, adjudication);
  const failurePublicFields = legacyFailurePublicFields(run, adjudication);
  const entries: LegacyOutboxCreateInput[] = [{
    kind: "world_index",
    target: "legacy_public_world_index",
    aggregateId,
    payload: {
      runTicket,
      ...identityFields,
      visibility: run.visibility,
      score: adjudication.score,
      worldImpact: adjudication.worldImpact,
      ...failurePublicFields,
    },
    payloadSummary: {
      runTicket,
      ...identityFields,
      visibility: run.visibility,
      worldImpact: adjudication.worldImpact,
      ...failurePublicFields,
    },
  }];
  const loreDecisions = recordArray(lore.decisions);
  if (loreDecisions.length) {
    entries.push({
      kind: "lore_admission",
      target: "legacy_lore_projection",
      aggregateId,
      payload: {
        runTicket,
        decisions: loreDecisions,
        accepted: Array.isArray(lore.accepted) ? lore.accepted : [],
      },
      payloadSummary: {
        runTicket,
        decisions: loreDecisions.length,
        accepted: Array.isArray(lore.accepted) ? lore.accepted.length : 0,
      },
    });
  }
  if (numberValue(progression.pointsAwarded) > 0) {
    entries.push({
      kind: "progression_awarded",
      target: "legacy_progression_projection",
      aggregateId,
      payload: {
        runTicket,
        explorerId,
        pointsAwarded: progression.pointsAwarded,
        reason: progression.reason,
      },
      payloadSummary: {
        runTicket,
        explorerId,
        pointsAwarded: progression.pointsAwarded,
        reason: progression.reason,
      },
    });
  }
  if (feedbackEvents.length) {
    entries.push({
      kind: "feedback_notification",
      target: "legacy_feedback_notifications",
      aggregateId,
      payload: {
        runTicket,
        events: feedbackEvents,
      },
      payloadSummary: {
        runTicket,
        events: feedbackEvents.length,
      },
    });
  }
  if (transparencyEntry) {
    entries.push({
      kind: "transparency_entry",
      target: "legacy_transparency_log",
      aggregateId,
      payload: {
        runTicket,
        entryHash: transparencyEntry.entryHash,
        payloadHash: transparencyEntry.payloadHash,
      },
      payloadSummary: {
        runTicket,
        entryHash: transparencyEntry.entryHash,
      },
    });
  }
  return entries;
}

function epochQuickstart(input: AnyRecord = {}) {
  assertPublicSafe(input);
  const serverBase = typeof input.serverBase === "string" && input.serverBase.trim()
    ? input.serverBase.trim()
    : process.env.AGENT_WORLD_SERVER || "http://127.0.0.1:8787";
  const host = typeof input.host === "string" && input.host.trim() ? input.host.trim() : "generic MCP host";
  const contentPolicy = resolveEpochContentPolicy({
    requestedRegion: optionalString(input.contentPolicyRegion) || optionalString(input.regionCode),
  });
  return {
    serverName: MCP_SERVER_INFO.name,
    host,
    serverBase,
    installManifest: `${serverBase}/api/epoch/install-manifest`,
    installPage: `${serverBase}/epoch/install`,
    webConsole: `${serverBase}/epoch/console`,
    contentPolicy,
    frontstageStatus: resolveEpochFrontstageStatus(),
    playbookPath: "obsidian-epoch/references/one-turn-playbook.md",
    smokePlaybookPath: "obsidian-epoch/references/smoke-playbook.md",
    identityLifecycle: {
      statusField: "progress.identity.status",
      activeValue: "active",
      archivedValue: "archived",
      rule: "Only identities whose server progress identity status is active may use active gameplay tools. Archived identities are history/archive identities; read their archive/result pages or request reincarnation.",
      activeOnlyTools: EPOCH_ACTIVE_IDENTITY_TOOL_NAMES,
      activeOnlyAudit: epochActiveIdentityToolAudit(),
      archivedFlow: EPOCH_ARCHIVED_IDENTITY_RECOMMENDED_TOOLS.map((tool) => ({
        tool,
        step: tool.replace(/^obsidian_epoch\./, ""),
        purpose: tool === "obsidian_epoch.identity_archive"
          ? "Read the terminal archive, lineage and final server-authored identity state."
          : tool === "obsidian_epoch.result_page"
            ? "Preview canonical public history without creating new active play."
            : "Request the server-issued next identity when the archived identity has no nextAgentId.",
      })),
      archivedFlowDetail: [
        {
          step: "read_archive",
          tool: "obsidian_epoch.identity_archive",
          purpose: "Read the terminal archive, lineage and final server-authored identity state.",
        },
        {
          step: "publish_or_read_result",
          tool: "obsidian_epoch.result_page",
          purpose: "Preview canonical public history without creating new active play.",
        },
        {
          step: "reincarnate_if_no_next_identity",
          tool: "obsidian_epoch.reincarnate",
          purpose: "Request the server-issued next identity when the archived identity has no nextAgentId.",
        },
      ],
    },
    hostConfig: {
      serverName: MCP_SERVER_INFO.name,
      command: "node",
      args: ["obsidian-epoch/bin/mcp-proxy.ts"],
      cwd: ".",
      env: {
        AGENT_WORLD_SERVER: serverBase,
        [EPOCH_CONTENT_POLICY_REGION_ENV_VAR]: contentPolicy.regionCode,
      },
    },
    journeyFlow: [
      {
        step: "briefing",
        tool: "obsidian_epoch.agent_briefing",
        purpose: "恢复当前旅程、领取已返程经历并聚合待决事项。",
      },
      {
        step: "prepare",
        tool: "obsidian_epoch.prepare_journey",
        purpose: "把一句自然语言意图转换为谨慎、均衡或探索预设的可读计划。",
        requires: ["agentId", "destinationRegionId", "owner authorization", "idempotencyKey"],
      },
      {
        step: "depart",
        tool: "obsidian_epoch.start_journey",
        purpose: "冻结现实/世界返程时间并记录到达段；默认暂停在 Agent 主事件决策。",
        requires: ["journeyId", "expectedVersion", "owner authorization", "idempotencyKey"],
      },
      {
        step: "propose_main_step",
        tool: "obsidian_epoch.propose_journey_step",
        purpose: "取得当前主事件的服务器签名 SceneContract，不产生结算。",
        requires: ["journeyId", "expectedVersion", "owner authorization", "idempotencyKey"],
      },
      {
        step: "commit_main_action",
        tool: "obsidian_epoch.commit_journey_action",
        purpose: "提交 Agent 选中的签名行动，并记录主事件与基于已确认路线的返程段。",
        requires: ["journeyId", "sceneId", "episodeId", "actionOptionId", "signature", "expectedVersion", "owner authorization", "idempotencyKey"],
      },
      {
        step: "wait_or_reconnect",
        tool: "obsidian_epoch.journey_status",
        purpose: "按 nextPollAt 读取状态；Host 离线不取消旅程，服务器在到期后幂等 catch-up。",
      },
      {
        step: "safe_recall",
        tool: "obsidian_epoch.recall_journey",
        purpose: "请求安全返程，不瞬移且不回滚已经发生的服务器事件。",
      },
      {
        step: "album",
        tool: "obsidian_epoch.journey_album",
        purpose: "读取长期身份的旅程与可验证 episode 收藏。",
      },
    ],
    oneTurnFlow: [
      {
        step: "inspect",
        tool: "obsidian_epoch.agent_briefing",
        purpose: "Read the current identity, resources, lifetime, region context and server-recommended next actions.",
      },
      {
        step: "issue_identity_if_needed",
        tool: "obsidian_epoch.identity",
        purpose: "Issue a server-owned identity when no active identity exists or an identity slot is available.",
        requires: ["explorerId", "idempotencyKey"],
      },
      {
        step: "create_turn_card",
        tool: "obsidian_epoch.turn_card",
        purpose: "Ask the server for visible context and public action options.",
        requires: ["agentId", "regionId", "prompt", "owner recovery authorization", "idempotencyKey"],
        requiresActiveIdentity: true,
        blockedWhen: "progress.identity.status is archived; use identity_archive/result_page/reincarnate instead.",
      },
      {
        step: "resolve_turn",
        tool: "obsidian_epoch.resolve_turn",
        purpose: "Choose exactly one returned actionOptionId; server settlement ignores client-declared outcomes.",
        requires: ["turnCardId", "actionOptionId", "owner recovery authorization", "idempotencyKey"],
        requiresActiveIdentity: true,
        blockedWhen: "The turn card belongs to an archived identity or is not open.",
      },
      {
        step: "publish_result",
        tool: "obsidian_epoch.create_result_page",
        purpose: "Create a fixed public result page after obsidian_epoch.result_page returns a publishToken.",
        requires: ["publishToken", "owner recovery authorization", "idempotencyKey"],
      },
      {
        step: "watch_hosted_session",
        tool: "obsidian_epoch.hosted_watch",
        purpose: "Open the public spectator DTO for one hosted session; active action option IDs stay hidden.",
        requires: ["sessionId"],
      },
    ],
    trustBoundary: [
      "MCP hosts are clients, not authorities.",
      "Do not paste recovery credentials into ordinary chat; prefer the Web Agent console for owner-authorized writes.",
      "Canonical rewards, lifetime changes, rankings, NPC facts and public results come only from server events.",
      "Do not treat an agentId alone as permission to act; progress.identity.status must be active for active gameplay tools.",
    ],
  };
}

export function createAgentWorldRuntime(options: RuntimeOptions = {}) {
  const registry = createTicketRegistry(recordValue(options.tickets));
  const operationSwitches = createEpochOperationSwitchRegistry(options.operationSwitches);
  const loreLedger = createLoreLedger(recordValue(options.loreState), { operationSwitches });
  const progressionLedger = createProgressionLedger(recordValue(options.progression));
  const factionLedger = createFactionLedger(recordValue(options.factions));
  const communityLedger = createCommunityLedger(recordValue(options.community));
  const experienceLedger = createExperienceLedger(recordValue(options.experience));
  const outboxOptions = recordValue(options.outbox);
  const outboxLedger = createLegacyOutboxLedger({
    ...outboxOptions,
    initialEvents: Array.isArray(options.outboxEvents)
      ? options.outboxEvents
      : Array.isArray(outboxOptions.initialEvents)
        ? outboxOptions.initialEvents as readonly object[]
        : [],
  });
  const epochOptions = recordValue(options.epoch);
  const journeyOptions = recordValue(options.journey);
  const worldClockOptions = recordValue(options.worldClock);
  const worldSimulationOptions = recordValue(options.worldSimulation);
  const worldContentRegistry = options.worldContentRegistry
    ? validateWorldContentRegistry(options.worldContentRegistry)
    : loadDefaultWorldContentRegistry();
  const initialEpochEvents = (Array.isArray(options.epochEvents)
    ? options.epochEvents
    : Array.isArray(epochOptions.initialEvents)
      ? epochOptions.initialEvents
      : []) as readonly EpochEvent[];
  const initialJourneyEvents = Array.isArray(options.journeyEvents)
    ? options.journeyEvents as readonly JourneyRuntimeEvent[]
    : Array.isArray(journeyOptions.initialEvents)
      ? journeyOptions.initialEvents as readonly JourneyRuntimeEvent[]
      : [];
  const initialJourneyProjection = projectJourneyRuntimeEvents(initialJourneyEvents);
  const sealFromProjection = (
    projection: typeof initialJourneyProjection,
    journeyId: string,
    plan: JourneyGeneratedTaskPlan,
  ) => projection.journeys[journeyId]?.journey.taskPlan?.hiddenTaskCommitment === plan.hiddenTaskCommitment
    ? projection.hiddenTaskSeals[journeyId]
    : undefined;
  let resolveJourneyHiddenTaskSeal: JourneyHiddenTaskSealResolver = (journeyId, plan) =>
    sealFromProjection(initialJourneyProjection, journeyId, plan);
  const epochRuntime = createEpochRuntime({
    ...epochOptions,
    initialEvents: initialEpochEvents,
    initialResultPages: Array.isArray(options.resultPages)
      ? options.resultPages
      : Array.isArray(epochOptions.initialResultPages)
        ? epochOptions.initialResultPages
        : [],
    resolveJourneyHiddenTaskSeal: (journeyId, plan) => resolveJourneyHiddenTaskSeal(journeyId, plan),
  });
  const worldClockRuntime = createEpochWorldClockRuntime({
    initialEvents: initialEpochEvents,
    ...(typeof worldClockOptions.idFactory === "function"
      ? { idFactory: worldClockOptions.idFactory as CreateEpochWorldClockRuntimeOptions["idFactory"] }
      : {}),
    ...(typeof worldClockOptions.nowReal === "function"
      ? { nowReal: worldClockOptions.nowReal as () => Date | string }
      : {}),
    ...(typeof worldClockOptions.speedRatio === "number"
      ? { speedRatio: worldClockOptions.speedRatio }
      : {}),
  });
  const worldSimulationRuntime = createEpochWorldSimulationRuntime({
    registry: worldContentRegistry,
    initialEvents: initialEpochEvents,
    ...(typeof worldSimulationOptions.idFactory === "function"
      ? {
          idFactory: worldSimulationOptions.idFactory as CreateEpochWorldSimulationRuntimeOptions["idFactory"],
        }
      : {}),
    ...(typeof worldSimulationOptions.nowReal === "function"
      ? { nowReal: worldSimulationOptions.nowReal as () => Date | string }
      : {}),
    ...(typeof worldSimulationOptions.checkpointInterval === "number"
      ? { checkpointInterval: worldSimulationOptions.checkpointInterval }
      : {}),
  });

  function currentWorldSimulationSignals() {
    const projection = projectEpochEvents(epochRuntime.interactionEvents(0));
    const canonicalFactionIds = new Set(worldContentRegistry.factions.map((faction) => faction.id));
    const materialRegionIds = new Set(worldContentRegistry.places.map((place) => place.id));
    type MutableSignal = {
      regionId: string;
      controllerFactionId?: string;
      conflictFactionIds: Set<string>;
      conflictEvidence: Map<string, EpochWorldConflictEvidence>;
      anomalyPressureBps: number;
      contestedResourceNodes: number;
      openMarketOrders: number;
      civicSupportBps: number;
    };
    const byRegion = new Map<string, MutableSignal>();
    const signalFor = (regionId: string) => {
      const existing = byRegion.get(regionId);
      if (existing) return existing;
      const created: MutableSignal = {
        regionId,
        conflictFactionIds: new Set<string>(),
        conflictEvidence: new Map<string, EpochWorldConflictEvidence>(),
        anomalyPressureBps: 0,
        contestedResourceNodes: 0,
        openMarketOrders: 0,
        civicSupportBps: 0,
      };
      byRegion.set(regionId, created);
      return created;
    };
    const factionForAgent = (regionId: string, agentId: string) => {
      const persistent = (projection.factionStandingIdsByAgent[agentId] || [])
        .map((standingId) => projection.agentFactionStandings[standingId])
        .filter((standing) => standing?.score > 0 && canonicalFactionIds.has(standing.factionId))
        .sort((left, right) => right.score - left.score
          || right.updatedAt.localeCompare(left.updatedAt)
          || left.factionId.localeCompare(right.factionId))[0];
      if (persistent) return persistent.factionId;
      const candidates = Object.values(projection.seasonCampaigns)
        .filter((season) => season.regionIds.includes(regionId))
        .flatMap((season) => season.agentStandings
          .filter((standing) => standing.agentId === agentId && standing.score > 0)
          .map((standing) => ({
            factionId: standing.factionId,
            score: standing.score,
            createdAt: season.createdAt,
          })))
        .sort((left, right) =>
          right.score - left.score
          || right.createdAt.localeCompare(left.createdAt)
          || left.factionId.localeCompare(right.factionId));
      return candidates[0]?.factionId;
    };
    const addConflictEvidence = (
      regionId: string,
      evidence: EpochWorldConflictEvidence,
    ) => {
      const factionIds = [...new Set(evidence.factionIds.filter((factionId) =>
        canonicalFactionIds.has(factionId)))].sort();
      if (factionIds.length < 2) return;
      const signal = signalFor(regionId);
      signal.conflictEvidence.set(evidence.evidenceId, { ...evidence, factionIds });
      for (const factionId of factionIds) signal.conflictFactionIds.add(factionId);
    };
    for (const control of Object.values(projection.regionControls)) {
      const signal = signalFor(control.regionId);
      if (canonicalFactionIds.has(control.controllingFactionId)) {
        signal.controllerFactionId = control.controllingFactionId;
      }
      if (control.contestedByFactionId) {
        addConflictEvidence(control.regionId, {
          evidenceId: `region_control:${control.regionId}:${control.sourceSeasonId}`,
          cause: "region_control_contest",
          factionIds: [control.controllingFactionId, control.contestedByFactionId].sort(),
          pressureBps: 6_000,
        });
      }
    }
    for (const node of Object.values(projection.resourceNodes)) {
      if (node.status !== "open" || Number(node.totalScore || 0) <= 0) continue;
      signalFor(node.regionId).contestedResourceNodes += 1;
      const factionIds = [...new Set(node.leaderboard
        .map((standing) => factionForAgent(node.regionId, standing.agentId))
        .filter((factionId): factionId is string => Boolean(factionId)))].sort();
      if (factionIds.length >= 2) {
        addConflictEvidence(node.regionId, {
          evidenceId: `resource_node:${node.nodeId}`,
          cause: "resource_contest",
          factionIds,
          pressureBps: Math.min(3_000, 1_000 + node.leaderboard.length * 250),
        });
      }
    }
    for (const anomaly of Object.values(projection.anomalyEvents)) {
      if (anomaly.status !== "open") continue;
      signalFor(anomaly.regionId).anomalyPressureBps += 1_500;
    }
    for (const order of Object.values(projection.marketOrders)) {
      if (order.status !== "open") continue;
      signalFor(order.regionId).openMarketOrders += 1;
    }
    for (const season of Object.values(projection.seasonCampaigns)) {
      if (season.status !== "active" || season.factionIds.length < 2) continue;
      for (const regionId of season.regionIds) {
        addConflictEvidence(regionId, {
          evidenceId: `faction_campaign:${season.seasonId}`,
          cause: "faction_campaign",
          factionIds: [...season.factionIds].sort(),
          pressureBps: 2_500,
        });
      }
    }
    for (const retaliation of Object.values(projection.retaliationOpportunities)) {
      if (retaliation.status !== "open") continue;
      const factionIds = [
        factionForAgent(retaliation.regionId, retaliation.opportunityAgentId),
        factionForAgent(retaliation.regionId, retaliation.targetAgentId),
      ].filter((factionId): factionId is string => Boolean(factionId));
      const distinctFactionIds = [...new Set(factionIds)].sort();
      if (distinctFactionIds.length >= 2) {
        addConflictEvidence(retaliation.regionId, {
          evidenceId: `retaliation:${retaliation.retaliationId}`,
          cause: "retaliation",
          factionIds: distinctFactionIds,
          pressureBps: 3_000,
        });
      }
    }
    // Canonical signals must be measured against the materialized cursor, not
    // against unpersisted server-time catch-up that the simulation has not replayed yet.
    const currentWorldMinute = worldSimulationRuntime.status().worldMinute;
    for (const change of Object.values(projection.regionInfluenceChanges)) {
      if (!change.reason.startsWith("journey_objective:")
        || change.influenceDelta <= 0
        || change.worldMinute === undefined) continue;
      const ageWorldMinutes = currentWorldMinute - change.worldMinute;
      if (ageWorldMinutes < 0 || ageWorldMinutes > 7 * 24 * 60) continue;
      const signal = signalFor(change.regionId);
      signal.civicSupportBps = Math.min(10_000, signal.civicSupportBps + change.influenceDelta * 250);
    }
    const regions: EpochWorldSimulationRegionSignal[] = [...byRegion.values()]
      .filter((signal) => materialRegionIds.has(signal.regionId))
      .map((signal) => ({
        regionId: signal.regionId,
        ...(signal.controllerFactionId ? { controllerFactionId: signal.controllerFactionId } : {}),
        conflictFactionIds: [...signal.conflictFactionIds].sort(),
        conflictEvidence: [...signal.conflictEvidence.values()]
          .sort((left, right) => left.evidenceId.localeCompare(right.evidenceId)),
        anomalyPressureBps: Math.min(10_000, signal.anomalyPressureBps),
        contestedResourceNodes: signal.contestedResourceNodes,
        openMarketOrders: signal.openMarketOrders,
        civicSupportBps: signal.civicSupportBps,
      }))
      .sort((left, right) => left.regionId.localeCompare(right.regionId));
    return { regions };
  }

  function advanceCanonicalWorld(input: Parameters<typeof worldClockRuntime.sync>[0]) {
    const clockCheckpoint = worldClockRuntime.checkpoint();
    const simulationCheckpoint = worldSimulationRuntime.checkpoint();
    try {
      const clockAdvance = worldClockRuntime.sync(input);
      const simulationIdempotencyKey = `${input.idempotencyKey}:simulation`;
      const clockEvent = clockAdvance.events.find((event) => event.eventType === "world_clock_advanced");
      const simulationAdvance = clockEvent?.eventType === "world_clock_advanced"
        ? worldSimulationRuntime.advance({
            fromWorldMinute: clockEvent.payload.fromWorldMinute,
            toWorldMinute: clockEvent.payload.toWorldMinute,
            sourceClockEventId: clockEvent.eventId,
            sourceEventIds: input.sourceEventIds,
            signals: currentWorldSimulationSignals(),
            idempotencyKey: simulationIdempotencyKey,
            causationId: input.causationId,
            correlationId: input.correlationId,
          })
        : undefined;
      const priorSimulation = simulationAdvance
        ? undefined
        : worldSimulationRuntime.resultForIdempotencyKey(simulationIdempotencyKey);
      const events = [
        ...clockAdvance.events,
        ...(simulationAdvance?.events || []),
      ];
      const result = attachEpochEventsForPersistence({
        clock: clockAdvance.clock,
        worldSimulation: simulationAdvance?.simulation
          ?? priorSimulation?.simulation
          ?? worldSimulationRuntime.status(),
        ...(simulationAdvance?.flows || priorSimulation?.flows
          ? { worldFlows: simulationAdvance?.flows ?? priorSimulation?.flows }
          : {}),
        events,
        duplicate: clockAdvance.duplicate,
      }, events);
      epochRuntime.ingestCanonicalEvents(events);
      return result;
    } catch (error) {
      worldSimulationRuntime.rollback(simulationCheckpoint);
      worldClockRuntime.rollback(clockCheckpoint);
      throw error;
    }
  }

  function migrateCanonicalWorldContent(
    input: MigrateEpochWorldSimulationContentInput,
  ) {
    const simulationCheckpoint = worldSimulationRuntime.checkpoint();
    try {
      const result = worldSimulationRuntime.migrateContent(input);
      epochRuntime.ingestCanonicalEvents(result.events);
      return result;
    } catch (error) {
      worldSimulationRuntime.rollback(simulationCheckpoint);
      throw error;
    }
  }
  let journeyIdSequence = initialJourneyEvents.reduce((highest, event) => {
    const candidates = [event.eventId, event.journeyId];
    for (const candidate of candidates) {
      const suffix = /_(\d+)$/.exec(candidate)?.[1];
      if (suffix) highest = Math.max(highest, Number(suffix));
    }
    return highest;
  }, 0);
  const configuredJourneyIdFactory = typeof journeyOptions.idFactory === "function"
    ? journeyOptions.idFactory as (kind: "journey" | "event") => string
    : undefined;
  const configuredJourneyClock = typeof journeyOptions.now === "function"
    ? journeyOptions.now as () => Date | string
    : undefined;
  const configuredWorldClock = typeof journeyOptions.worldNow === "function"
    ? journeyOptions.worldNow as () => Date | string
    : () => epochWorldTimeFromMinute(worldSimulationRuntime.status().worldMinute);
  const authoritativeWorldClockEnabled = typeof journeyOptions.worldNow !== "function"
    && journeyOptions.authoritativeWorldClock !== false;
  const clockIso = (clock: (() => Date | string) | undefined) => {
    const value = clock?.() ?? new Date();
    return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
  };
  const companionRuntime = createAgentCompanionRuntime({
    epoch: {
      progress: epochRuntime.progress,
      verifyExplorerAuth: epochRuntime.verifyExplorerAuth,
      regionInfo: (input) => {
        const info = epochRuntime.regionInfo(input);
        const regionId = optionalString(recordValue(info).regionId) || optionalString(input?.regionId);
        const canonicalContent = regionId ? canonicalPlaceContext(worldContentRegistry, regionId) : undefined;
        const worldState = regionId
          ? worldSimulationView(worldSimulationRuntime.status(), { regionId }).regions[0]
          : undefined;
        return {
          ...info,
          ...(canonicalContent ? { canonicalContent, worldContentSourceHash: worldContentRegistry.sourceHash } : {}),
          ...(worldState ? { worldState } : {}),
        };
      },
      agentBriefing: epochRuntime.agentBriefing,
      publicIdentity: epochRuntime.agentPublicIdentity,
      events: epochRuntime.events,
      getResultPage: epochRuntime.getResultPage,
      interactionEvents: epochRuntime.interactionEvents,
    },
    journeyOptions: {
      idFactory: configuredJourneyIdFactory ?? ((kind) => `${kind}_${String(++journeyIdSequence).padStart(8, "0")}`),
      nowReal: () => clockIso(configuredJourneyClock),
      nowWorld: () => clockIso(configuredWorldClock),
      initialEvents: initialJourneyEvents,
      canonicalEpochEvents: () => epochRuntime.interactionEvents(0),
      worldSliceForWindow: ({ regionId, startedAtWorldTime, endedAtWorldTime }) => {
        try {
          return worldSimulationHistoricalSlice({
            events: worldSimulationRuntime.events(),
            registry: worldContentRegistry,
            regionId,
            startedAtWorldTime,
            endedAtWorldTime,
            startedAtWorldMinute: epochWorldMinuteFromTime(startedAtWorldTime),
            endedAtWorldMinute: epochWorldMinuteFromTime(endedAtWorldTime),
          });
        } catch (error) {
          if (error instanceof Error && error.message === "world_simulation_slice_region_not_found") {
            return undefined;
          }
          throw error;
        }
      },
      defaultRealDurationMs: positiveNumberValue(journeyOptions.defaultRealDurationMs, 30 * 60 * 1_000),
      defaultWorldDurationMs: positiveNumberValue(journeyOptions.defaultWorldDurationMs, 60 * 60 * 1_000),
      pollIntervalMs: positiveNumberValue(journeyOptions.pollIntervalMs, 5 * 60 * 1_000),
    },
  });
  resolveJourneyHiddenTaskSeal = (journeyId, plan) =>
    sealFromProjection(companionRuntime.journeyRuntime().projection(), journeyId, plan);
  const transparencyLedger = createTransparencyLedger({
    initialEntries: cloneRecords(options.transparencyEntries),
    initialAnchors: cloneRecords(options.transparencyAnchors),
  });
  const submittedRuns = cloneRecords(options.submittedRuns);
  const repairTickets = cloneRecords(options.repairTickets);
  const feedbackEvents = cloneRecords(options.feedbackEvents);
  const contextSnapshotLedger = cloneRecords(options.contextSnapshots);
  const legacyRunSubmissionQuota = recordValue(options.legacyRunSubmissionQuota);
  const ticketOptions = recordValue(options.tickets);
  const legacyRunSubmissionQuotaDisabled = legacyRunSubmissionQuota.disabled === true;
  const legacyRunSubmissionMax = positiveIntegerValue(legacyRunSubmissionQuota.maxSubmissions, 50);
  const legacyRunSubmissionWindowMs = positiveNumberValue(legacyRunSubmissionQuota.windowMs, 60 * 60 * 1000);
  const legacyRunSubmissionClock = typeof legacyRunSubmissionQuota.now === "function"
    ? legacyRunSubmissionQuota.now as () => Date
    : typeof ticketOptions.now === "function"
      ? ticketOptions.now as () => Date
      : () => new Date();
  const legacyRunSubmissionBuckets = new Map<string, { windowStartedAtMs: number; count: number }>();
  const legacyReviewBudget = recordValue(options.legacyReviewBudget);
  const legacyReviewBudgetDisabled = legacyReviewBudget.disabled === true;
  const reviewQueueClock = typeof legacyReviewBudget.now === "function"
    ? legacyReviewBudget.now as () => Date
    : legacyRunSubmissionClock;
  const reviewQueueIdFactory = typeof legacyReviewBudget.idFactory === "function"
    ? legacyReviewBudget.idFactory as () => string
    : (() => {
        let nextReviewQueueId = 0;
        return () => `review_delay_${String(++nextReviewQueueId).padStart(6, "0")}`;
      })();
  const maxPendingReviews = nonNegativeIntegerValue(legacyReviewBudget.maxPendingReviews, 100);
  const maxSimilarPendingPerExplorer = nonNegativeIntegerValue(legacyReviewBudget.maxSimilarPendingPerExplorer, 2);
  const maxReportCharsByRank: Record<string, unknown> = {
    outsider: 20_000,
    field_agent: 40_000,
    operator: 80_000,
    high_clearance: 120_000,
    ...recordValue(legacyReviewBudget.maxReportCharsByRank),
  };
  const delayedReviewQueue = cloneRecords(options.reviewQueue);

  function enforceLegacyRunSubmissionQuota(ticket: AnyRecord) {
    if (legacyRunSubmissionQuotaDisabled) return;
    const actorKey = stringValue(ticket.explorerId, stringValue(ticket.agentId, "legacy_run_submission"));
    const nowMs = legacyRunSubmissionClock().getTime();
    const current = legacyRunSubmissionBuckets.get(actorKey);
    if (!current || nowMs - current.windowStartedAtMs >= legacyRunSubmissionWindowMs) {
      legacyRunSubmissionBuckets.set(actorKey, { windowStartedAtMs: nowMs, count: 1 });
      return;
    }
    if (current.count >= legacyRunSubmissionMax) {
      throw new Error("legacy_run_submission_rate_limited");
    }
    legacyRunSubmissionBuckets.set(actorKey, {
      windowStartedAtMs: current.windowStartedAtMs,
      count: current.count + 1,
    });
  }

  function rankWeight(rank: string) {
    if (rank === "high_clearance") return 3;
    if (rank === "operator") return 2;
    if (rank === "field_agent") return 1;
    return 0;
  }

  function reportTextForBudget(value: unknown): string {
    const parts: string[] = [];
    const visit = (candidate: unknown) => {
      if (typeof candidate === "string") {
        parts.push(candidate);
        return;
      }
      if (Array.isArray(candidate)) {
        candidate.forEach(visit);
        return;
      }
      if (isRecord(candidate)) {
        Object.values(candidate).forEach(visit);
      }
    };
    visit(value);
    return parts.join("\n").trim();
  }

  function reviewFingerprintForRun(run: AnyRecord) {
    return hashRunPayload(reportTextForBudget(run).toLowerCase().normalize("NFKC").replace(/\s+/g, ""));
  }

  function reviewRankFor(explorerId: string, run: AnyRecord) {
    const progression = progressionLedger.getExplorerProgression(explorerId);
    const factions = recordValue(progression.factions);
    const runFactionId = stringValue(run.factionId, "腐林档案会");
    const exactFaction = recordValue(factions[runFactionId]);
    const exactRank = stringValue(exactFaction.rank);
    if (exactRank) return exactRank;
    let bestRank = "outsider";
    for (const value of Object.values(factions)) {
      const rank = stringValue(recordValue(value).rank);
      if (rankWeight(rank) > rankWeight(bestRank)) bestRank = rank;
    }
    return bestRank;
  }

  function maxReportCharsForRank(rank: string) {
    return nonNegativeIntegerValue(maxReportCharsByRank[rank], nonNegativeIntegerValue(maxReportCharsByRank.outsider, 20_000));
  }

  function delayedReviewForRunTicket(runTicket: string) {
    return delayedReviewQueue.find((entry) => entry.runTicket === runTicket && stringValue(entry.status, "delayed") === "delayed");
  }

  function pendingReviewEntries() {
    return delayedReviewQueue.filter((entry) => stringValue(entry.status, "delayed") === "delayed");
  }

  function reviewQueuePosition(entry: AnyRecord) {
    return Math.max(1, pendingReviewEntries().findIndex((candidate) => candidate.queueId === entry.queueId) + 1);
  }

  function reviewWaitEstimate(position: number) {
    const safePosition = Math.max(1, position);
    const minMinutes = safePosition * 5;
    const maxMinutes = safePosition * 15;
    return {
      minMinutes,
      maxMinutes,
      unit: "minutes",
      label: `${minMinutes}-${maxMinutes} 分钟`,
    };
  }

  function legacyReviewStatus(stage: (typeof LEGACY_REVIEW_STAGES)[number]["stage"], position = 1) {
    const current = LEGACY_REVIEW_STAGES.find((item) => item.stage === stage) || LEGACY_REVIEW_STAGES[0];
    return {
      currentStage: current.stage,
      currentStageLabel: current.label,
      stages: LEGACY_REVIEW_STAGES.map((item) => ({
        stage: item.stage,
        label: item.label,
        active: item.stage === current.stage,
        completed: item.stage === "completed" && current.stage === "completed",
      })),
      estimatedWait: stage === "completed"
        ? { minMinutes: 0, maxMinutes: 0, unit: "minutes", label: "已完成" }
        : reviewWaitEstimate(position),
    };
  }

  function cloneReviewQueueEntry(entry: AnyRecord) {
    const position = reviewQueuePosition(entry);
    return {
      ...entry,
      reasons: Array.isArray(entry.reasons) ? [...entry.reasons] : [],
      budget: { ...recordValue(entry.budget) },
      position,
      reviewStatus: legacyReviewStatus("queued", position),
    };
  }

  function reviewQueueView(input: AnyRecord = {}) {
    const limit = positiveIntegerValue(input.limit, 100);
    const delayed = pendingReviewEntries().slice(0, limit).map(cloneReviewQueueEntry);
    return {
      summary: {
        delayed: pendingReviewEntries().length,
        total: delayedReviewQueue.length,
        visibleStages: LEGACY_REVIEW_STAGES.map((stage) => ({ ...stage })),
      },
      delayed,
    };
  }

  function stringArray(value: unknown) {
    return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
  }

  function cloneContextSnapshot(entry: AnyRecord): ContextSnapshotRecord {
    return {
      ...entry,
      versions: { ...recordValue(entry.versions) },
      retrievalParams: { ...recordValue(entry.retrievalParams) },
      filteringReasons: stringArray(entry.filteringReasons),
      settingCards: recordArray(entry.settingCards).map((card) => ({
        ...card,
        filteringReasons: stringArray(card.filteringReasons),
      })),
    };
  }

  function rememberContextSnapshot(contextPackage: unknown) {
    const snapshot = recordValue(recordValue(contextPackage).contextSnapshot);
    const snapshotId = optionalString(snapshot.snapshotId);
    if (!snapshotId) return;
    const cloned = cloneContextSnapshot(snapshot);
    const existingIndex = contextSnapshotLedger.findIndex((entry) => entry.snapshotId === snapshotId);
    if (existingIndex >= 0) {
      contextSnapshotLedger[existingIndex] = cloned;
      return;
    }
    contextSnapshotLedger.push(cloned);
  }

  function contextSnapshotsView(input: AnyRecord = {}) {
    const limit = positiveIntegerValue(input.limit, 100);
    const entries = contextSnapshotLedger.slice(0, limit).map(cloneContextSnapshot);
    const latest = contextSnapshotLedger.at(-1);
    return {
      summary: {
        total: contextSnapshotLedger.length,
        returned: entries.length,
        latestSnapshotId: optionalString(latest?.snapshotId),
      },
      entries,
    };
  }

  function delayedReviewResponse(ticket: AnyRecord, entry: AnyRecord) {
    const reviewQueue = cloneReviewQueueEntry(entry);
    return {
      ...ticket,
      state: "review_delayed",
      duplicate: false,
      ...LEGACY_AGENT_WORLD_LOOP,
      reviewQueue,
      reviewStatus: reviewQueue.reviewStatus,
      reviewQueueSummary: reviewQueueView().summary,
      adjudication: null,
      lore: { decisions: [], accepted: [] },
      progression: { pointsAwarded: 0, reason: "review_delayed" },
      feedback: {
        summary: "审档进入延迟队列，稍后由服务器预算窗口继续处理。",
        resubmission: { allowed: false, reason: "review_delayed" },
      },
      experience: null,
      transparencyEntry: null,
      transparency: transparencyLedger.verify(),
    };
  }

  function maybeDelayLegacyReview(ticket: AnyRecord, run: AnyRecord) {
    if (legacyReviewBudgetDisabled) return null;
    const runTicket = stringValue(ticket.runTicket);
    const existing = delayedReviewForRunTicket(runTicket);
    if (existing) return existing;
    const explorerId = stringValue(ticket.explorerId, stringValue(run.explorerId, "explorer_local"));
    const agentId = stringValue(ticket.agentId, stringValue(run.agentId));
    const identityRank = reviewRankFor(explorerId, run);
    const reportText = reportTextForBudget(run);
    const reportChars = reportText.length;
    const maxReportChars = maxReportCharsForRank(identityRank);
    const reportFingerprint = reviewFingerprintForRun(run);
    const pending = pendingReviewEntries();
    const similarPendingReviews = pending.filter((entry) => (
      entry.explorerId === explorerId
      && entry.reportFingerprint === reportFingerprint
    )).length;
    const reasons: string[] = [];
    if (pending.length >= maxPendingReviews) reasons.push("system_load_budget_exceeded");
    if (reportChars > maxReportChars) reasons.push("report_length_budget_exceeded");
    if (similarPendingReviews > maxSimilarPendingPerExplorer) reasons.push("similar_pending_review_budget_exceeded");
    if (!reasons.length) return null;
    const queuedAt = reviewQueueClock().toISOString();
    const entry = {
      queueId: reviewQueueIdFactory(),
      status: "delayed",
      runTicket,
      explorerId,
      agentId,
      queuedAt,
      reasons,
      reportHash: hashRunPayload(run),
      reportFingerprint,
      budget: {
        identityRank,
        reportChars,
        maxReportChars,
        pendingReviews: pending.length,
        maxPendingReviews,
        similarPendingReviews,
        maxSimilarPendingPerExplorer,
      },
    };
    delayedReviewQueue.push(entry);
    return entry;
  }

  function assertOperationSwitchOpen(input: EpochOperationGateInput) {
    const gate = operationSwitches.gate(input);
    if (gate.paused) throw new Error(`operation_${input.action}_paused`);
    return gate;
  }

  function hasPresentClaimValue(value: unknown): boolean {
    if (typeof value === "string") return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    if (isRecord(value)) return Object.keys(value).length > 0;
    return value !== undefined && value !== null && value !== false;
  }

  function hasLegacyItemUseClaim(value: unknown): boolean {
    if (Array.isArray(value)) return value.some((entry) => hasLegacyItemUseClaim(entry));
    if (!isRecord(value)) return false;
    return Object.entries(value).some(([key, entry]) => {
      if (LEGACY_ITEM_USE_INPUT_KEYS.has(key.toLowerCase()) && hasPresentClaimValue(entry)) return true;
      return hasLegacyItemUseClaim(entry);
    });
  }

  function normalizeLegacyClaimKey(key: string) {
    return key.toLowerCase().replace(/[^a-z0-9]+/g, "");
  }

  function hasLegacyOutcomeStateKeyClaim(value: unknown): boolean {
    if (Array.isArray(value)) return value.some((entry) => hasLegacyOutcomeStateKeyClaim(entry));
    if (!isRecord(value)) return false;
    return Object.entries(value).some(([key, entry]) => {
      if (LEGACY_OUTCOME_STATE_KEYS.has(normalizeLegacyClaimKey(key)) && hasPresentClaimValue(entry)) return true;
      return hasLegacyOutcomeStateKeyClaim(entry);
    });
  }

  function hasLegacyOutcomeStateTextClaim(value: unknown): boolean {
    if (typeof value !== "string") return false;
    const normalized = value.toLowerCase().normalize("NFKC");
    const numericStateGrant = /(?:coin|aether|stamina|focus|legend|金币|灵质|体力|专注|传说)\s*\+\s*\d+|lifetime(?:\s*delta)?\s*[-+]\s*\d+|寿命\s*[-+]\s*\d+/.test(normalized);
    if (numericStateGrant) return true;
    const officialStateVerb = /server|official|canonical|grant(?:ed)?|award(?:ed)?|rewarded|publish(?:ed)?|committed|settled|minted|applied|服务器|官方|已结算|结算|发放|授予|奖励|发布|上新闻|生效/.test(normalized);
    const stateTarget = /coin|aether|stamina|focus|legend|resource|reward|lifetime|lifetime\s*delta|lifetimedelta|news|world\s*impact|worldimpact|rank|title|score|金币|灵质|体力|专注|传说|资源|奖励|寿命|新闻|头衔|排名/.test(normalized);
    return officialStateVerb && stateTarget;
  }

  function hasLegacyOutcomeStateClaim(event: AnyRecord, claimedOutcome: string) {
    return hasLegacyOutcomeStateTextClaim(claimedOutcome)
      || hasLegacyOutcomeStateTextClaim(event.outcome)
      || hasLegacyOutcomeStateKeyClaim(event)
      || hasLegacyOutcomeStateKeyClaim(event.inputs);
  }

  function assertLegacyRunEventSchema(event: AnyRecord, runRegionId?: string) {
    if (positiveIntegerValue(event.sequence, 0) <= 0) throw new Error("ticket_event_schema_invalid");
    const actionType = optionalString(event.actionType);
    if (!actionType) throw new Error("ticket_event_schema_invalid");
    const normalizedActionType = normalizeLegacyActionType(actionType);
    if (LEGACY_COOLDOWN_GOVERNED_ACTION_TYPES.has(normalizedActionType)) {
      throw new Error("ticket_cooldown_rule_unverified");
    }
    if (LEGACY_CANONICAL_ACTION_TYPES.has(normalizedActionType)) {
      throw new Error("ticket_canonical_action_unverified");
    }
    const risk = optionalString(event.risk);
    if (!risk || !LEGACY_EVENT_RISKS.has(risk)) throw new Error("ticket_event_schema_invalid");
    const eventRegionId = optionalString(event.regionId);
    if (!eventRegionId) throw new Error("ticket_event_schema_invalid");
    if (runRegionId && eventRegionId !== runRegionId) throw new Error("ticket_event_schema_invalid");
    if (!isRecord(event.inputs)) throw new Error("ticket_event_schema_invalid");
    if (hasLegacyItemUseClaim(event.inputs)) throw new Error("ticket_item_use_unverified");
    const claimedOutcome = optionalString(event.claimedOutcome);
    if (!claimedOutcome) throw new Error("ticket_event_schema_invalid");
    if (hasLegacyOutcomeStateClaim(event, claimedOutcome)) throw new Error("ticket_outcome_state_unverified");
    if (!optionalString(event.evidenceText)) throw new Error("ticket_event_schema_invalid");
  }

  function assertLegacyRunEventSequences(events: AnyRecord[]) {
    let previousSequence = 0;
    for (const event of events) {
      const sequence = positiveIntegerValue(event.sequence, 0);
      if (sequence <= previousSequence) throw new Error("ticket_event_sequence_invalid");
      previousSequence = sequence;
    }
  }

  function assertLegacyRunIdentityLifetime(ticket: AnyRecord) {
    const agentId = optionalString(ticket.agentId);
    if (!agentId) return;
    const progress = epochRuntime.progress({ agentId });
    if (progress.actionEligibility.status === "archived") throw new Error("ticket_identity_archived");
  }

  function isLegacySubmittableTicketState(ticket: AnyRecord): boolean {
    const state = optionalString(ticket.state);
    return state === "issued" || state === "active";
  }

  function assertLegacyRunSignedEnvelope(ticket: AnyRecord, input: AnyRecord, run: AnyRecord) {
    const expectedEnvelope = buildLegacyRunCapabilityEnvelope({
      runTicket: stringValue(ticket.runTicket),
      explorerId: stringValue(ticket.explorerId),
      agentId: stringValue(ticket.agentId),
      contextVersion: stringValue(ticket.contextVersion),
      regionId: stringValue(ticket.regionId),
      risk: stringValue(ticket.risk),
      partyRunId: optionalString(ticket.partyRunId),
      participantRole: optionalString(ticket.participantRole),
      multiAgentReservation: ticket.multiAgentReservation,
      actionBudget: ticket.actionBudget,
      sequence: positiveIntegerValue(ticket.sequence, 0),
      sequenceWindow: ticket.sequenceWindow,
      expiresAt: stringValue(ticket.expiresAt),
    });
    const envelope = isRecord(input.signedEnvelope)
      ? input.signedEnvelope
      : isRecord(run.signedEnvelope)
        ? run.signedEnvelope
        : {};
    const envelopeId = optionalString(envelope.envelopeId);
    const contentHash = optionalString(envelope.contentHash);
    if (!envelopeId || !contentHash) throw new Error("ticket_context_envelope_required");
    if (envelopeId !== expectedEnvelope.envelopeId || contentHash !== expectedEnvelope.contentHash) {
      throw new Error("ticket_context_envelope_mismatch");
    }
  }

  function assertLegacyRunSubmitBindings(ticket: AnyRecord, run: AnyRecord) {
    const sequence = positiveIntegerValue(run.sequence, 0);
    if (!sequence) throw new Error("ticket_sequence_required");
    const sequenceWindow = recordValue(ticket.sequenceWindow);
    const first = positiveIntegerValue(sequenceWindow.first, sequence);
    const last = positiveIntegerValue(sequenceWindow.last, sequence);
    if (sequence < first || sequence > last) throw new Error("ticket_sequence_mismatch");
    const ticketContextVersion = optionalString(ticket.contextVersion);
    if (ticketContextVersion && ticketContextVersion !== "legacy_context_unspecified") {
      const contextVersion = optionalString(run.contextVersion);
      if (!contextVersion) throw new Error("ticket_context_version_required");
      if (contextVersion !== ticketContextVersion) throw new Error("ticket_context_version_mismatch");
    }
  }

  function assertLegacyRunTicketConstraints(ticket: AnyRecord, run: AnyRecord) {
    const ticketRegionId = optionalString(ticket.regionId);
    const runRegionId = optionalString(run.regionId);
    if (ticketRegionId && ticketRegionId !== LEGACY_UNSPECIFIED_REGION_ID && runRegionId !== ticketRegionId) {
      throw new Error("ticket_region_mismatch");
    }

    const actionBudget = recordValue(ticket.actionBudget);
    const maxEvents = positiveIntegerValue(actionBudget.maxEvents, Number.MAX_SAFE_INTEGER);
    const maxHighRiskActions = positiveIntegerValue(actionBudget.maxHighRiskActions, Number.MAX_SAFE_INTEGER);
    const events = recordArray(run.events);
    if (events.length > maxEvents) throw new Error("ticket_action_budget_exceeded");
    events.forEach((event) => assertLegacyRunEventSchema(event, runRegionId));
    assertLegacyRunEventSequences(events);
    const highRiskActions = events.filter((event) => event.risk === "high");
    if (highRiskActions.length > maxHighRiskActions) throw new Error("ticket_risk_budget_exceeded");
    const unconfirmedHighRiskAction = highRiskActions.find((event) => (
      event.authorized !== true
      && event.userConfirmed !== true
      && !optionalString(event.userConfirmationId)
    ));
    if (unconfirmedHighRiskAction) throw new Error("ticket_high_risk_confirmation_required");
  }

  function getContext(input: AnyRecord = {}) {
    assertPublicSafe(input);
    const contextPackage = createContextPackage(input, { contextVersions: epochRuntime.worldContextVersions() });
    rememberContextSnapshot(contextPackage);
    return contextPackage;
  }

  function startRun(input: AnyRecord = {}) {
    assertPublicSafe(input);
    const contextVersions = epochRuntime.worldContextVersions();
    const partyRunId = optionalString(input.partyRunId);
    const participantRole = optionalString(input.participantRole);
    const multiAgentReservation = buildLegacyMultiAgentReservation({ partyRunId, participantRole });
    const ticket = registry.createTicket({
      explorerId: optionalString(input.explorerId),
      agentId: optionalString(input.agentId),
      contextVersion: contextVersions.contextPackVersion,
      regionId: optionalString(input.regionId),
      risk: optionalString(input.risk),
      partyRunId,
      participantRole,
      multiAgentReservation,
    });
    return {
      ...ticket,
      signedEnvelope: buildLegacyRunCapabilityEnvelope(ticket),
      ...LEGACY_AGENT_WORLD_LOOP,
    };
  }

  function runHeartbeat(input: AnyRecord = {}) {
    assertPublicSafe(input);
    const ticket = registry.checkpointTicket(stringValue(input.runTicket), {
      explorerId: optionalString(input.explorerId),
      agentId: optionalString(input.agentId),
    });
    return {
      ...ticket,
      signedEnvelope: buildLegacyRunCapabilityEnvelope(ticket),
      ...LEGACY_AGENT_WORLD_LOOP,
    };
  }

  function submitBattleReport(input: AnyRecord = {}) {
    assertPublicSafe(input);
    const runTicket = stringValue(input.runTicket);
    const runInput = requireObject(input.run, "run");
    const sequenceNormalizedRun = typeof runInput.sequence === "number"
      ? runInput
      : typeof input.sequence === "number"
        ? { ...runInput, sequence: input.sequence }
        : runInput;
    const run = typeof sequenceNormalizedRun.contextVersion === "string"
      ? sequenceNormalizedRun
      : typeof input.contextVersion === "string"
        ? { ...sequenceNormalizedRun, contextVersion: input.contextVersion }
        : sequenceNormalizedRun;
    const ticket = registry.getTicket(runTicket);
    if (!ticket) throw new Error("ticket_not_found");
    if (run.explorerId && run.explorerId !== ticket.explorerId) throw new Error("ticket_identity_mismatch");
    if (run.agentId && run.agentId !== ticket.agentId) throw new Error("ticket_identity_mismatch");
    assertLegacyRunIdentityLifetime(ticket);
    assertLegacyRunTicketConstraints(ticket, run);
    if (isLegacySubmittableTicketState(ticket)) {
      assertLegacyRunSubmitBindings(ticket, run);
      assertLegacyRunSignedEnvelope(ticket, input, run);
      assertOperationSwitchOpen({
        action: "settlement",
        ...legacyRunOperationDimensions(run),
      });
      const existingDelayedReview = delayedReviewForRunTicket(runTicket);
      if (existingDelayedReview) return delayedReviewResponse(ticket, existingDelayedReview);
      enforceLegacyRunSubmissionQuota(ticket);
      const delayedReview = maybeDelayLegacyReview(ticket, run);
      if (delayedReview) return delayedReviewResponse(ticket, delayedReview);
    }

    const adjudication = adjudicateRun(run);
    const publicClaimGate = legacyPublicClaimGate(run, adjudication);
    const submission = registry.submitTicket(runTicket, run, adjudication);
    let lore: AnyRecord = { decisions: [], accepted: [] };
    let progression: AnyRecord = { pointsAwarded: 0, reason: "not_evaluated" };

    if (
      !submission.duplicate
      && adjudication.worldImpact === "review_candidate"
      && adjudication.claimSlots > 0
      && publicClaimGate.confirmed
    ) {
      lore = loreLedger.admitRunClaims({
        source: {
          runTicket,
          runId: stringValue(run.runId, runTicket),
          explorerId: run.explorerId,
          agentId: run.agentId,
          score: adjudication.score,
          claimSlots: adjudication.claimSlots,
          ...legacyRunOperationDimensions(run),
        },
        run,
      });
    }

    if (!submission.duplicate) {
      progression = progressionLedger.applyRunProgression({
        source: {
          runTicket,
          explorerId: run.explorerId,
        },
        run,
        adjudication,
        lore,
      });
    }

    const feedback = createRunFeedback({ adjudication, lore, progression });
    const experience = !submission.duplicate
      ? {
          state: experienceLedger.recordRunCompletion({
            explorerId: stringValue(run.explorerId, "explorer_local"),
            runTicket,
            score: adjudication.score,
          }),
          settlementEffect: settlementEffectFor({ score: adjudication.score }),
          ratingReveal: ratingRevealFor(adjudication.rating),
          soundStyle: experienceLedger.soundStyleForFaction(stringValue(run.factionId, "腐林档案会")),
        }
      : null;

    if (!submission.duplicate && feedback.resubmission.allowed) {
      repairTickets.push(createRepairTicket({ runTicket, feedback }));
    }
    if (!submission.duplicate) {
      const currentSourceRewards = recordArray(lore.decisions).map((decision) => decision.reward).filter(isRecord);
      const currentFeedbackEvents = createFeedbackEvents({ sourceRewards: currentSourceRewards });
      feedbackEvents.push(...currentFeedbackEvents);
      const transparencyEntry = transparencyLedger.append(publicVerificationRecord({
        runTicket,
        run,
        adjudication,
        lore,
        channelClass: LEGACY_AGENT_WORLD_LOOP.channelClass,
        deliveryTrust: LEGACY_AGENT_WORLD_LOOP.deliveryTrust,
      }));
      const settledSubmission = registry.settleTicket(runTicket);
      submittedRuns.push({
        runTicket,
        explorerId: run.explorerId,
        score: adjudication.score,
        visibility: run.visibility,
        worldImpact: adjudication.worldImpact,
        ...legacyFailurePublicFields(run, adjudication),
        channelClass: LEGACY_AGENT_WORLD_LOOP.channelClass,
        deliveryTrust: LEGACY_AGENT_WORLD_LOOP.deliveryTrust,
        submittedAt: settledSubmission.submittedAt,
      });
      const outbox = outboxLedger.enqueueBatch(legacySettlementOutboxEntries({
        runTicket,
        run,
        adjudication,
        lore,
        progression,
        feedbackEvents: currentFeedbackEvents,
        transparencyEntry,
      }));
      return {
        ...settledSubmission,
        duplicate: false,
        ...LEGACY_AGENT_WORLD_LOOP,
        graphSync: graphSyncFromOutboxEntries(outbox, { initialSettlement: true }),
        reviewStatus: legacyReviewStatus("completed"),
        adjudication,
        publicClaimGate,
        lore,
        progression,
        feedback,
        experience,
        transparencyEntry,
        transparency: transparencyLedger.verify(),
        outbox: {
          entries: outbox,
          summary: outboxLedger.view().summary,
          graphSync: graphSyncFromOutboxEntries(outbox),
          deadLetters: outbox.filter((entry) => entry.status === "dead_letter"),
        },
      };
    }

    return {
      ...submission,
      ...LEGACY_AGENT_WORLD_LOOP,
      adjudication,
      publicClaimGate,
      reviewStatus: legacyReviewStatus("completed"),
      lore,
      progression,
      feedback,
      experience,
      transparencyEntry: null,
      transparency: transparencyLedger.verify(),
    };
  }

  function archiveLocalReport(input: AnyRecord = {}) {
    assertPublicSafe(input);
    const runInput = requireObject(input.run, "run");
    const run: AnyRecord = {
      ...runInput,
      mode: optionalString(runInput.mode) || "local_trial",
      visibility: "private",
    };
    const adjudication = adjudicateRun(run);
    const archiveId = `local_archive_${hashRunPayload(run).slice(0, 16)}`;
    const lore: AnyRecord = { decisions: [], accepted: [] };
    const progression: AnyRecord = { pointsAwarded: 0, reason: "local_archive_only" };
    const feedback = createRunFeedback({ adjudication, lore, progression });
    const submittedAt = new Date().toISOString();

    submittedRuns.push({
      archiveId,
      explorerId: run.explorerId,
      agentId: run.agentId,
      score: adjudication.score,
      visibility: "private",
      worldImpact: adjudication.worldImpact,
      ...LOCAL_ARCHIVE_LOOP,
      submittedAt,
    });

    return {
      state: "archived",
      archiveId,
      runTicket: null,
      mode: LOCAL_ARCHIVE_LOOP.loopMode,
      ...LOCAL_ARCHIVE_LOOP,
      adjudication,
      lore,
      progression,
      feedback,
      experience: null,
      transparencyEntry: null,
      transparency: transparencyLedger.verify(),
      submittedAt,
    };
  }

  function proposeJourneyStepRuntime(input: AnyRecord = {}) {
    assertPublicSafe(input);
    const proposed = companionRuntime.proposeStep(input);
    const episode = proposed.episode;
    let hostedSession;
    let hostedEvents: readonly ReturnType<typeof epochEventsForPersistence>[number][] = [];
    try {
      hostedSession = epochRuntime.journeyHostedSession({
        ...input,
        sessionId: undefined,
        sceneId: undefined,
        journeyId: proposed.journey.journeyId,
        episodeId: episode.episodeId,
        expectedVersion: proposed.journey.version,
      });
    } catch (error) {
      if (!(error instanceof Error) || error.message !== "journey_scene_contract_not_found") throw error;
      const hosted = epochRuntime.startJourneyHostedSession({
        ...input,
        correlationId: proposed.journey.correlationId,
        causationId: proposed.journey.journeyId,
        agentId: proposed.journey.agentId,
        regionId: proposed.journey.destinationRegionId,
        mandate: episode.title,
        journeyScene: {
          seed: `${proposed.journey.journeyId}:${episode.episodeId}`,
          journeyId: proposed.journey.journeyId,
          episodeId: episode.episodeId,
          sceneType: episode.type,
          phase: episode.phase ?? "main",
          ...(proposed.journey.worldMode ? { worldMode: proposed.journey.worldMode } : {}),
          title: episode.title,
          mandate: proposed.journey.mandate,
          worldObjects: episode.worldObjectRefs.map((worldObject) => ({
            ...worldObject,
            regionId: proposed.journey.destinationRegionId,
            sourceFactIds: episode.sourceFactIds,
          })),
          sourceFactIds: episode.sourceFactIds,
          expectedVersion: proposed.journey.version,
          ...(episode.generatedTaskObjective
            ? { generatedTaskObjective: episode.generatedTaskObjective }
            : {}),
          ...(proposed.journey.taskPlan?.routes
            ? { taskRoutes: proposed.journey.taskPlan.routes }
            : {}),
        },
        idempotencyKey: `${String(input.idempotencyKey || "").trim()}:proposal:${episode.episodeId}`,
      });
      hostedSession = hosted.value;
      hostedEvents = epochEventsForPersistence(hosted);
    }
    const result = {
      ...proposed,
      proposal: {
        journeyId: proposed.journey.journeyId,
        episode,
        stepNumber: proposed.stepNumber,
        totalSteps: proposed.totalSteps,
        sceneContract: hostedSession.sceneContract,
        actionOptions: hostedSession.actionOptions,
        expectedVersion: proposed.journey.version,
        nextAction: "obsidian_epoch.commit_journey_action",
      },
    };
    return attachEpochEventsForPersistence(result, hostedEvents);
  }

  function commitSingleJourneyStepRuntime(input: AnyRecord = {}) {
    assertPublicSafe(input);
    const session = epochRuntime.journeyHostedSession(input);
    const contract = session.sceneContract;
    if (!contract) throw new Error("journey_scene_contract_not_found");
    const status = companionRuntime.stepStatus(input);
    const recordedEpisode = status.episodes.find((episode) => episode.episodeId === contract.episodeId);
    const proposed = recordedEpisode ? undefined : companionRuntime.proposeStep({
      ...input,
      expectedVersion: contract.expectedVersion,
    });
    const episode = recordedEpisode ?? proposed?.episode;
    if (!episode || episode.episodeId !== contract.episodeId) {
      throw new Error("journey_scene_episode_binding_invalid");
    }
    const action = epochRuntime.commitJourneyHostedAction({
      ...input,
      correlationId: status.journey.correlationId,
      causationId: contract.sceneId,
      journeyId: contract.journeyId,
      sceneId: contract.sceneId,
      episodeId: contract.episodeId,
      expectedVersion: contract.expectedVersion,
      idempotencyKey: `${String(input.idempotencyKey || "").trim()}:hosted:${contract.episodeId}`,
    });
    const actionEpochEvents = epochEventsForPersistence(action);
    const canonicalEventIds = recordedEpisode?.settlement?.canonicalEventIds
      ?? actionEpochEvents
        .filter((event) => [
          "hosted_action_recorded",
          "agent_faction_standing_changed",
          "region_influence_changed",
          "trace_created",
        ].includes(event.eventType))
        .map((event) => event.eventId);
    const agentProgress = recordValue(epochRuntime.progress({ agentId: status.journey.agentId }));
    const agentIdentity = recordValue(agentProgress.identity);
    const selectedContractAction = contract.actionOptions.find((candidate) =>
      candidate.actionOptionId === action.value.actionOptionId);
    const authoritativeCompletionKind = action.value.journeyResolution?.completionKind
      ?? selectedContractAction?.completionKind;
    if (selectedContractAction?.taskObjectiveId && !authoritativeCompletionKind) {
      throw new Error("journey_action_resolution_missing");
    }
    const journeyInfluenceEvent = actionEpochEvents.find((event) =>
      event.eventType === "region_influence_changed"
      && event.payload.sourceEventType === "hosted_action_recorded"
      && event.payload.sourceAggregateId === session.sessionId);
    const journeyFactionStandingEvent = actionEpochEvents.find((event) =>
      event.eventType === "agent_faction_standing_changed"
      && event.payload.sourceEventId === actionEpochEvents.find((candidate) =>
        candidate.eventType === "hosted_action_recorded")?.eventId
      && event.payload.journeyId === contract.journeyId
      && event.payload.episodeId === contract.episodeId);
    const journeyImpactEventIds = journeyInfluenceEvent?.eventType === "region_influence_changed"
      ? actionEpochEvents.filter((event) => event.eventId === journeyInfluenceEvent.eventId
        || (event.eventType === "trace_created"
          && event.payload.relatedInfluenceIds.includes(journeyInfluenceEvent.payload.influenceId)))
        .map((event) => event.eventId)
      : [];
    const regionLabel = episode.worldObjectRefs.find((worldObject) => worldObject.id === session.regionId)?.label
      || session.regionId;
    const serverFacts = recordedEpisode?.serverFacts ?? buildServerJourneyEpisodeFacts({
      journeyId: contract.journeyId,
      episodeId: episode.episodeId,
      phase: episode.phase ?? "main",
      title: episode.title,
      premise: contract.premise,
      agent: {
        id: status.journey.agentId,
        ...(optionalString(agentIdentity.identityName) ? { displayName: optionalString(agentIdentity.identityName) } : {}),
      },
      worldObjectRefs: episode.worldObjectRefs,
      action: {
        ...(selectedContractAction?.optionKey ? { optionKey: selectedContractAction.optionKey } : {}),
        optionLabel: action.value.optionLabel,
        ...(selectedContractAction?.intent ? { intent: selectedContractAction.intent } : {}),
        ...(selectedContractAction?.risk ? { risk: selectedContractAction.risk } : {}),
        ...(selectedContractAction?.targetEntityIds.length
          ? { targetEntityIds: selectedContractAction.targetEntityIds }
          : {}),
        ...(selectedContractAction?.taskObjectiveId
          ? { taskObjectiveId: selectedContractAction.taskObjectiveId }
          : {}),
        ...(authoritativeCompletionKind
          ? { completionKind: authoritativeCompletionKind }
          : {}),
        ...(action.value.journeyResolution
          ? { resolution: action.value.journeyResolution }
          : {}),
        outcomeSummary: action.value.outcomeSummary,
        ...(action.value.reward ? { reward: action.value.reward } : {}),
      },
      canonicalEventIds,
      ...(journeyInfluenceEvent?.eventType === "region_influence_changed" ? {
        sharedWorldImpact: {
          regionId: journeyInfluenceEvent.payload.regionId,
          regionLabel,
          influenceDelta: journeyInfluenceEvent.payload.influenceDelta,
          sourceEventIds: journeyImpactEventIds,
        },
      } : {}),
      ...(journeyFactionStandingEvent?.eventType === "agent_faction_standing_changed" ? {
        factionAlignment: {
          factionId: journeyFactionStandingEvent.payload.factionId,
          factionLabel: episode.worldObjectRefs.find((worldObject) =>
            worldObject.id === journeyFactionStandingEvent.payload.factionId)?.label
            || journeyFactionStandingEvent.payload.factionId,
          standingDelta: journeyFactionStandingEvent.payload.standingDelta,
          standingAfter: journeyFactionStandingEvent.payload.standingAfter,
          routeId: journeyFactionStandingEvent.payload.routeId,
          sourceEventIds: [journeyFactionStandingEvent.eventId],
        },
      } : {}),
    });
    const narrative = recordedEpisode?.narrative ?? buildPersistedJourneyNarrative({
      serverFacts,
      ...(input.narrativeDraft !== undefined ? { samplingDraft: input.narrativeDraft } : {}),
    }).value;
    const committedEpisode = recordedEpisode ?? {
      ...episode,
      sourceFactIds: [...new Set([...episode.sourceFactIds, ...canonicalEventIds])],
      settlement: {
        canonicalEventIds,
        outcomeSummary: action.value.outcomeSummary,
        ...(selectedContractAction?.taskObjectiveId && authoritativeCompletionKind
          ? { taskObjective: {
              objectiveId: selectedContractAction.taskObjectiveId,
              completionKind: authoritativeCompletionKind,
            } }
          : {}),
        ...(action.value.reward ? { reward: {
          resourceId: action.value.reward.resourceId,
          amount: action.value.reward.amount,
        } } : {}),
      },
      serverFacts,
      narrative,
    };
    const committed = recordedEpisode ? status : companionRuntime.commitEpisodes({
      ...input,
      journeyId: contract.journeyId,
      expectedVersion: contract.expectedVersion,
      episodes: [committedEpisode],
      idempotencyKey: `${String(input.idempotencyKey || "").trim()}:journey:${contract.episodeId}`,
    });
    const worldClockAdvance = authoritativeWorldClockEnabled
      && status.journey.worldMode !== "mirror"
      && actionEpochEvents.some((event) => event.eventType === "hosted_action_recorded")
      ? advanceCanonicalWorld({
          reason: `journey_action:${contract.phase}:${contract.episodeId}`,
          processedDomains: ["journey", "npc_schedule", "identity_needs"],
          sourceEventIds: actionEpochEvents.map((event) => event.eventId),
          idempotencyKey: `${String(input.idempotencyKey || "").trim()}:world-clock:${contract.episodeId}`,
          causationId: contract.sceneId,
          correlationId: status.journey.correlationId,
        })
      : undefined;
    const result = {
      ...committed,
      episode: committedEpisode,
      settledAction: action.value,
      sceneContract: contract,
      ...(worldClockAdvance ? { worldClock: worldClockAdvance.clock } : {}),
      duplicate: Boolean(recordedEpisode),
    };
    attachEpochEventsForPersistence(result, [
      ...actionEpochEvents,
      ...(worldClockAdvance ? epochEventsForPersistence(worldClockAdvance) : []),
    ]);
    return mergeJourneyEventsForPersistence(result, status, committed);
  }

  function finalizeSettledMirrorWorld(
    status: ReturnType<typeof companionRuntime.status>,
    input: AnyRecord,
  ) {
    if (status.journey.status !== "settled"
      || status.journey.worldMode !== "mirror"
      || status.journey.worldCommit) {
      return { status };
    }
    const settledAtWorldTime = status.journey.settledAtWorldTime;
    const startedAtWorldTime = status.journey.startedAtWorldTime;
    if (!settledAtWorldTime || !startedAtWorldTime) throw new Error("journey_mirror_time_window_missing");
    const statusRecord = recordValue(status);
    const taskAdjudication = recordValue(statusRecord.taskAdjudication);
    const completionTier = optionalString(taskAdjudication.tier) || "及格";
    const performance = recordValue(taskAdjudication.performance);
    const reportedScoreBps = Number(performance.scoreBps);
    const completionScoreBps = Number.isSafeInteger(reportedScoreBps)
      ? Math.max(0, Math.min(10_000, reportedScoreBps))
      : completionTier === "惊世"
        ? 10_000
        : completionTier === "完美"
          ? 9_500
          : completionTier === "良好"
            ? 7_500
            : 6_000;
    const evidenceEpisodes = (Array.isArray(statusRecord.episodes)
      ? statusRecord.episodes
      : []) as readonly JourneyTaskEvidenceEpisode[];
    let completedObjectiveIds: readonly string[] = [];
    let requiredMainObjectiveIds: readonly string[] = [];
    let mainLineSucceeded = false;
    if (status.journey.taskPlan) {
      const graphState = journeyTaskGraphState(status.journey.taskPlan, evidenceEpisodes);
      const mainCompleted = Number(taskAdjudication.mainCompleted);
      const mainTotal = Number(taskAdjudication.mainTotal);
      completedObjectiveIds = Array.isArray(taskAdjudication.completedObjectiveIds)
        ? taskAdjudication.completedObjectiveIds.filter((value): value is string =>
            typeof value === "string" && Boolean(value.trim()))
        : [];
      requiredMainObjectiveIds = graphState.requiredMainObjectiveIds;
      mainLineSucceeded = mainTotal > 0 && mainCompleted === mainTotal;
    } else {
      const mission = recordValue(statusRecord.mission);
      mainLineSucceeded = mission.status === "completed"
        && recordValue(mission.outcome).result === "success";
      if (mainLineSucceeded) {
        completedObjectiveIds = ["legacy_main"];
        requiredMainObjectiveIds = ["legacy_main"];
      }
    }
    const canonEligible = mainLineSucceeded && ["良好", "完美", "惊世"].includes(completionTier);
    const worldSynchronization = authoritativeWorldClockEnabled
      ? advanceCanonicalWorld({
          reason: "journey_canon_commit_materialization",
          processedDomains: ["economy", "resources", "factions", "conflicts", "world_events"],
          sourceEventIds: [],
          idempotencyKey: `${String(input.idempotencyKey || status.journey.journeyId).trim()}:canon-sync`,
          causationId: status.journey.journeyId,
          correlationId: status.journey.correlationId,
        })
      : undefined;
    const committedAtWorldTime = status.journey.mirrorTimeRuleVersion === 2
      ? clockIso(configuredWorldClock)
      : settledAtWorldTime;
    let worldSolidification: ReturnType<typeof epochRuntime.solidifyJourneyWorld> | undefined;
    const worldCommit = canonEligible
      ? (worldSolidification = epochRuntime.solidifyJourneyWorld({
          journeyId: status.journey.journeyId,
          agentId: status.journey.agentId,
          regionId: status.journey.destinationRegionId,
          completedObjectiveIds,
          requiredMainObjectiveIds,
          mirrorStartedAtWorldTime: startedAtWorldTime,
          mirrorEndedAtWorldTime: settledAtWorldTime,
          committedAtWorldTime,
          completionTier,
          completionScoreBps,
          worldSliceHash: status.journey.worldSlice?.sliceHash,
          correlationId: status.journey.correlationId,
          causationId: status.journey.journeyId,
        })).value
      : {
          mode: "mirror" as const,
          status: "discarded" as const,
          reason: (mainLineSucceeded
            ? "quality_below_canon_threshold"
            : "main_incomplete_or_return_failed") as "quality_below_canon_threshold" | "main_incomplete_or_return_failed",
          regionId: status.journey.destinationRegionId,
          committedAtWorldTime,
          influenceDelta: 0,
          factionStandings: [],
          npcRelationships: [],
          sourceEventIds: [],
        };
    const worldCommitRecord = companionRuntime.recordWorldCommit({
      ...input,
      journeyId: status.journey.journeyId,
      expectedVersion: status.journey.version,
      worldCommit,
      idempotencyKey: `${String(input.idempotencyKey || status.journey.journeyId).trim()}:world-commit`,
    });
    return {
      status: companionRuntime.status({ ...input, journeyId: status.journey.journeyId }),
      worldSynchronization,
      worldSolidification,
      worldCommitRecord,
    };
  }

  function commitJourneyActionRuntime(input: AnyRecord = {}) {
    const session = epochRuntime.journeyHostedSession(input);
    if (!session.sceneContract || !["main", "side"].includes(session.sceneContract.phase)) {
      throw new Error("journey_task_scene_required");
    }
    const main = commitSingleJourneyStepRuntime(input);
    const current = companionRuntime.status(input);
    const nextTaskObjective = current.journey.taskPlan
      ? nextJourneyTaskObjective(
          current.journey.taskPlan,
          current.episodes as readonly JourneyTaskEvidenceEpisode[],
        )
      : undefined;
    if (current.journey.taskPlan && nextTaskObjective) {
      const result = {
        ...current,
        objectiveEpisode: main.episode,
        settledAction: main.settledAction,
        nextAction: "obsidian_epoch.propose_journey_step",
      };
      attachEpochEventsForPersistence(result, epochEventsForPersistence(main));
      return mergeJourneyEventsForPersistence(result, main, current);
    }
    const existingReturn = current.episodes.find((episode) => episode.phase === "return");
    if (existingReturn) {
      const result = {
        ...current,
        mainEpisode: main.episode,
        returnEpisode: existingReturn,
        settledAction: main.settledAction,
        duplicate: true,
      };
      attachEpochEventsForPersistence(result, epochEventsForPersistence(main));
      return mergeJourneyEventsForPersistence(result, main, current);
    }
    const returning = companionRuntime.beginReturn({
      ...input,
      journeyId: current.journey.journeyId,
      expectedVersion: current.journey.version,
      idempotencyKey: `${String(input.idempotencyKey || "").trim()}:begin-return`,
    });
    const returnProposal = proposeJourneyStepRuntime({
      ...input,
      journeyId: returning.journey.journeyId,
      expectedVersion: returning.journey.version,
      idempotencyKey: `${String(input.idempotencyKey || "").trim()}:return`,
    });
    const returnAction = returnProposal.proposal.sceneContract?.actionOptions.find((action) =>
      action.optionKey === "return_by_known_route");
    if (!returnAction) throw new Error("journey_return_action_missing");
    const returned = commitSingleJourneyStepRuntime({
      ...input,
      journeyId: returning.journey.journeyId,
      sceneId: returnProposal.proposal.sceneContract?.sceneId,
      episodeId: returnProposal.proposal.episode.episodeId,
      expectedVersion: returning.journey.version,
      actionOptionId: returnAction.actionOptionId,
      signature: returnAction.signature,
      visibleText: `沿已确认路线完成${returnProposal.proposal.episode.title}`,
      idempotencyKey: `${String(input.idempotencyKey || "").trim()}:return`,
    });
    const settled = returned.journey.taskPlan
      ? companionRuntime.settleCompleted({
          ...input,
          journeyId: returned.journey.journeyId,
          expectedVersion: returned.journey.version,
          idempotencyKey: `${String(input.idempotencyKey || "").trim()}:settle-completed`,
        })
      : returned;
    const initialFinalStatus = companionRuntime.status({
      ...input,
      journeyId: returned.journey.journeyId,
    });
    const mirrorFinalization = finalizeSettledMirrorWorld(initialFinalStatus, input);
    const finalStatus = mirrorFinalization.status;
    const finalStatusRecord = recordValue(finalStatus);
    const taskAdjudication = recordValue(finalStatusRecord.taskAdjudication);
    const worldSolidification = mirrorFinalization.worldSolidification;
    const worldCommitRecord = mirrorFinalization.worldCommitRecord;
    const completionTier = optionalString(taskAdjudication.tier);
    const rewardSourceEventIds = [...new Set((Array.isArray(finalStatusRecord.episodes)
      ? finalStatusRecord.episodes
      : []).flatMap((episodeValue) => {
        const episode = recordValue(episodeValue);
        const serverFacts = recordValue(episode.serverFacts);
        return Array.isArray(serverFacts.sourceEventIds)
          ? serverFacts.sourceEventIds.filter((eventId): eventId is string => typeof eventId === "string" && Boolean(eventId.trim()))
          : [];
      }))];
    const rewardGrant = completionTier && completionTier !== "未及格"
      ? epochRuntime.grantJourneyReward({
          journeyId: returned.journey.journeyId,
          agentId: returned.journey.agentId,
          tier: completionTier,
          taskPlan: returned.journey.taskPlan,
          hiddenTaskSeal: returned.journey.taskPlan
            ? resolveJourneyHiddenTaskSeal(returned.journey.journeyId, returned.journey.taskPlan)
            : undefined,
          sourceEventIds: rewardSourceEventIds,
          correlationId: returned.journey.correlationId,
          causationId: returned.journey.journeyId,
        })
      : undefined;
    const result = {
      ...finalStatus,
      mainEpisode: main.episode,
      returnEpisode: returned.episode,
      settledAction: main.settledAction,
      returnAction: returned.settledAction,
      ...(rewardGrant ? { rewardGrant: {
        balances: rewardGrant.value,
        reward: rewardGrant.reward,
        rewardBundle: rewardGrant.rewardBundle,
        grantedItems: rewardGrant.grantedItems,
        duplicate: rewardGrant.duplicate,
      } } : {}),
      ...(finalStatus.journey.worldCommit ? { worldCommit: finalStatus.journey.worldCommit } : {}),
      nextAction: "obsidian_epoch.journey_status",
    };
    attachEpochEventsForPersistence(result, [
      ...epochEventsForPersistence(main),
      ...epochEventsForPersistence(returnProposal),
      ...epochEventsForPersistence(returned),
      ...(mirrorFinalization.worldSynchronization
        ? epochEventsForPersistence(mirrorFinalization.worldSynchronization)
        : []),
      ...(worldSolidification ? epochEventsForPersistence(worldSolidification) : []),
      ...(rewardGrant ? epochEventsForPersistence(rewardGrant) : []),
    ]);
    return mergeJourneyEventsForPersistence(
      result,
      main,
      returning,
      returned,
      settled,
      worldCommitRecord,
      finalStatus,
    );
  }

  function synchronizeWorldForJourneyStart(input: AnyRecord) {
    if (!authoritativeWorldClockEnabled) return undefined;
    return advanceCanonicalWorld({
      reason: "journey_world_slice_materialization",
      processedDomains: ["economy", "resources", "factions", "conflicts", "world_events"],
      sourceEventIds: [],
      idempotencyKey: `${String(input.idempotencyKey || "").trim()}:world-slice`,
      causationId: optionalString(input.causationId),
      correlationId: optionalString(input.correlationId),
    });
  }

  function reserveJourneyWorldWindowRuntime(input: AnyRecord = {}) {
    assertPublicSafe(input);
    const worldSynchronization = synchronizeWorldForJourneyStart(input);
    const current = companionRuntime.status(input);
    const expectedVersion = Number(input.expectedVersion);
    const reservation = current.journey.status === "prepared"
      && (!current.journey.mirrorWindow || expectedVersion !== current.journey.version)
      ? companionRuntime.reserveJourneyWorldWindow({
          ...input,
          idempotencyKey: `${String(input.idempotencyKey || "").trim()}:reserve-world-window`,
        })
      : current;
    const result = {
      ...reservation,
      ...(worldSynchronization ? {
        worldClock: worldSynchronization.clock,
        worldSimulation: worldSynchronization.worldSimulation,
      } : {}),
    };
    attachEpochEventsForPersistence(
      result,
      worldSynchronization ? epochEventsForPersistence(worldSynchronization) : [],
    );
    return mergeJourneyEventsForPersistence(result, reservation);
  }

  function startJourneyAgentNativeRuntime(input: AnyRecord = {}) {
    assertPublicSafe(input);
    const worldWindow = reserveJourneyWorldWindowRuntime(input);
    const startInput = {
      ...input,
      expectedVersion: worldWindow.journey.mirrorWindow?.startExpectedVersion
        ?? worldWindow.journey.version,
    };
    const started = companionRuntime.start(startInput);
    let current = companionRuntime.status({ ...input, journeyId: started.journey.journeyId });
    let arrivalProposal: ReturnType<typeof proposeJourneyStepRuntime> | undefined;
    let arrival: ReturnType<typeof commitSingleJourneyStepRuntime> | undefined;
    if (!current.episodes.some((episode) => episode.phase === "arrival")) {
      arrivalProposal = proposeJourneyStepRuntime({
        ...input,
        journeyId: current.journey.journeyId,
        expectedVersion: current.journey.version,
        idempotencyKey: `${String(input.idempotencyKey || "").trim()}:arrival`,
      });
      const arrivalAction = arrivalProposal.proposal.sceneContract?.actionOptions.find((action) =>
        action.optionKey === "enter_gray_harbor" || action.optionKey === "enter_destination");
      if (!arrivalAction) throw new Error("journey_arrival_action_missing");
      arrival = commitSingleJourneyStepRuntime({
        ...input,
        journeyId: current.journey.journeyId,
        sceneId: arrivalProposal.proposal.sceneContract?.sceneId,
        episodeId: arrivalProposal.proposal.episode.episodeId,
        expectedVersion: current.journey.version,
        actionOptionId: arrivalAction.actionOptionId,
        signature: arrivalAction.signature,
        visibleText: `沿登记路线完成${arrivalProposal.proposal.episode.title}`,
        idempotencyKey: `${String(input.idempotencyKey || "").trim()}:arrival`,
      });
      current = companionRuntime.status({ ...input, journeyId: current.journey.journeyId });
    }
    const journeyEntryReserve = epochRuntime.grantJourneyEntryReserve({
      ...input,
      journeyId: started.journey.journeyId,
      agentId: started.journey.agentId,
    });
    const awaiting = current.journey.status === "traveling"
      ? companionRuntime.awaitAgent({
          ...input,
          journeyId: current.journey.journeyId,
          expectedVersion: current.journey.version,
          idempotencyKey: `${String(input.idempotencyKey || "").trim()}:await-agent`,
        })
      : current;
    const result = {
      ...started,
      ...awaiting,
      episodes: companionRuntime.status({ ...input, journeyId: started.journey.journeyId }).episodes,
      arrivalEpisode: arrival?.episode ?? current.episodes.find((episode) => episode.phase === "arrival"),
      journeyEntryReserve: {
        balances: journeyEntryReserve.value,
        reserve: journeyEntryReserve.reserve,
        duplicate: journeyEntryReserve.duplicate,
      },
      nextAction: awaiting.journey.status === "awaiting_agent"
        ? "obsidian_epoch.propose_journey_step"
        : "obsidian_epoch.journey_status",
    };
    attachEpochEventsForPersistence(result, [
      ...epochEventsForPersistence(worldWindow),
      ...(arrivalProposal ? epochEventsForPersistence(arrivalProposal) : []),
      ...(arrival ? epochEventsForPersistence(arrival) : []),
      ...epochEventsForPersistence(journeyEntryReserve),
    ]);
    return mergeJourneyEventsForPersistence(result, worldWindow, started, arrival, awaiting);
  }

  function recallJourneyRuntime(input: AnyRecord = {}) {
    const current = companionRuntime.status(input);
    const phases = new Set(current.episodes.map((episode) => episode.phase));
    if (current.journey.status === "awaiting_agent" && phases.has("arrival") && !phases.has("main")) {
      const proposal = proposeJourneyStepRuntime({
        ...input,
        expectedVersion: current.journey.version,
        idempotencyKey: `${String(input.idempotencyKey || "").trim()}:safe-main`,
      });
      const contract = proposal.proposal.sceneContract;
      const safeAction = contract?.actionOptions.find((action) =>
        action.actionOptionId === contract.safeFallbackActionOptionId);
      if (!contract || !safeAction) throw new Error("journey_safe_recall_action_missing");
      const recalled = commitJourneyActionRuntime({
        ...input,
        sceneId: contract.sceneId,
        episodeId: contract.episodeId,
        expectedVersion: proposal.proposal.expectedVersion,
        actionOptionId: safeAction.actionOptionId,
        signature: safeAction.signature,
        visibleText: `提前召回：${safeAction.label}`,
        idempotencyKey: `${String(input.idempotencyKey || "").trim()}:safe-commit`,
      });
      const result = {
        ...recalled,
        episodes: companionRuntime.status({ ...input, journeyId: recalled.journey.journeyId }).episodes,
        recalled: true,
        recallMode: "server_safe_return",
      };
      attachEpochEventsForPersistence(result, epochEventsForPersistence(recalled));
      return mergeJourneyEventsForPersistence(result, recalled);
    }
    return companionRuntime.recall(input);
  }

  return {
    getContext,
    contextSnapshots: (input: AnyRecord = {}) => contextSnapshotsView(input),
    startRun,
    runHeartbeat,
    submitBattleReport,
    archiveLocalReport,
    publicWorld: () => publicWorldView({ loreLedger, factionLedger, submittedRuns }),
    outbox: (input: AnyRecord = {}) => outboxLedger.view(input),
    replayOutbox: (input: AnyRecord = {}) => outboxLedger.replay(input),
    loreState: () => loreLedger.state(),
    factionState: () => factionLedger.state(),
    progressionState: ({ explorerId }: AnyRecord) => progressionLedger.getExplorerProgression(stringValue(explorerId, "explorer_local")),
    operationCheck: (input: AnyRecord = {}) => ({
      ...progressionLedger.canPerformOperation({
        explorerId: input.explorerId,
        factionId: stringValue(input.factionId, "腐林档案会"),
        operation: stringValue(input.operation, "high_risk_mandate"),
      }),
      frontstageStatus: resolveEpochFrontstageStatus(),
      operationSwitch: operationSwitches.gate({
        action: operationSwitchActionValue(input.action),
        rewardType: optionalString(input.rewardType),
        ...operationDimensionsFromInput(input),
      }),
    }),
    proposeFaction: (input: AnyRecord) => {
      assertPublicSafe(input);
      const factionId = stringValue(input.baseFactionId, "腐林档案会");
      const gate = progressionLedger.canPerformOperation({
          explorerId: stringValue(input.explorerId, "explorer_local"),
          factionId,
          operation: "create_faction",
      });
      if (!gate.allowed) return { status: "rejected", reason: gate.reason, gate };
      const result = factionLedger.proposeFaction({
        source: {
          explorerId: input.explorerId,
          runTicket: input.runTicket,
          score: numberValue(input.score),
          rank: gate.rank,
        },
        proposal: recordValue(input.proposal),
      });
      feedbackEvents.push(...createFeedbackEvents({ factionResult: result }));
      return result;
    },
    supportFaction: (input: AnyRecord) => {
      assertPublicSafe(input);
      const result = factionLedger.supportFaction({
        factionId: input.factionId,
        explorerId: input.explorerId,
        runTicket: input.runTicket,
      });
      feedbackEvents.push(...createFeedbackEvents({ factionResult: result }));
      return result;
    },
    referenceFaction: (input: AnyRecord) => {
      assertPublicSafe(input);
      return factionLedger.referenceFaction({
        name: input.name,
        factionId: input.factionId,
        runTicket: input.runTicket,
        explorerId: input.explorerId,
      });
    },
    communityReact: (input: AnyRecord) => {
      assertPublicSafe(input);
      return communityLedger.react(input);
    },
    communityComment: (input: AnyRecord) => {
      assertPublicSafe(input);
      return communityLedger.comment(input);
    },
    communityFlag: (input: AnyRecord) => {
      assertPublicSafe(input);
      return communityLedger.flag(input);
    },
    communityThread: ({ targetId }: AnyRecord) => communityLedger.threadFor(targetId),
    communityModeration: () => ({ queue: communityLedger.moderationQueue() }),
    communityState: () => communityLedger.state(),
    feedbackEvents: () => ({ events: feedbackEvents.map((event) => ({ ...event })) }),
    reviewQueue: (input: AnyRecord = {}) => reviewQueueView(input),
    repairTickets: () => ({ repairTickets: repairTickets.map((ticket) => ({ ...ticket })) }),
    feedbackDigest: ({ date }: AnyRecord = {}) => createDigest({
      date: stringValue(date, new Date().toISOString().slice(0, 10)),
      runs: submittedRuns,
      loreState: loreLedger.state(),
      factionState: { factions: factionLedger.state().factions },
    }),
    transparencyVerify: () => transparencyLedger.verify(),
    transparencyExport: () => transparencyLedger.exportBundle(),
    transparencyAnchor: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return transparencyLedger.createAnchor({
        provider: input.provider || "manual",
        externalRef: input.externalRef || "",
      });
    },
    experienceState: ({ explorerId }: AnyRecord) => experienceLedger.getExperienceState(stringValue(explorerId, "explorer_local")),
    selectVoiceProfile: (input: AnyRecord) => {
      assertPublicSafe(input);
      return experienceLedger.selectVoiceProfile({
        explorerId: stringValue(input.explorerId, "explorer_local"),
        voiceId: optionalString(input.voiceId),
      });
    },
    soundStyle: ({ factionId = "腐林档案会" }: AnyRecord = {}) => experienceLedger.soundStyleForFaction(stringValue(factionId, "腐林档案会")),
    epochIdentity: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return input.agentId && !input.explorerId
        ? epochRuntime.progress(input)
        : epochRuntime.issueIdentity(input);
    },
    epochRegisterExplorer: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.registerExplorer(input);
    },
    epochVerifyExplorerAuth: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.verifyExplorerAuth(input);
    },
    epochRotateRecovery: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.rotateExplorerRecovery(input);
    },
    epochProgress: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.progress(input);
    },
    epochAgentBriefing: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return companionRuntime.briefing(input) as unknown as ReturnType<typeof epochRuntime.agentBriefing> & {
        readonly identityExists: boolean;
        readonly canonicalAgentId?: string;
        readonly publicIdentity?: { readonly label: string; readonly status?: "active" | "archived" };
        readonly regionLabel?: string;
        readonly currentJourney?: unknown;
        readonly returnedJourneys: readonly unknown[];
        readonly returnedJourneyReports: readonly unknown[];
        readonly recentEpisodes: readonly unknown[];
        readonly pendingDecisions: readonly unknown[];
        readonly interactionInbox: readonly unknown[];
        readonly interactionInboxFeatured?: unknown;
        readonly interactionInboxSummaries?: readonly unknown[];
        readonly interactionInboxTotal?: number;
        readonly agentWishes: readonly string[];
        readonly nextPollAt?: string;
      };
    },
    epochPrepareJourney: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return companionRuntime.prepare(input);
    },
    epochJourneyTaskGenerationContext: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return companionRuntime.taskGenerationContext(input);
    },
    epochReserveJourneyWorldWindow: (input: AnyRecord = {}) => reserveJourneyWorldWindowRuntime(input),
    epochStartJourney: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      const worldWindow = reserveJourneyWorldWindowRuntime(input);
      const started = companionRuntime.start({
        ...input,
        expectedVersion: worldWindow.journey.mirrorWindow?.startExpectedVersion
          ?? worldWindow.journey.version,
      });
      const result = {
        ...started,
        worldClock: worldWindow.worldClock,
        worldSimulation: worldWindow.worldSimulation,
      };
      attachEpochEventsForPersistence(
        result,
        epochEventsForPersistence(worldWindow),
      );
      return mergeJourneyEventsForPersistence(result, worldWindow, started);
    },
    epochStartJourneyAgentNative: (input: AnyRecord = {}) => startJourneyAgentNativeRuntime(input),
    epochProposeJourneyStep: (input: AnyRecord = {}) => proposeJourneyStepRuntime(input),
    epochCommitJourneyAction: (input: AnyRecord = {}) => commitJourneyActionRuntime(input),
    epochFinalizeSettledMirrorWorld: (
      status: ReturnType<typeof companionRuntime.status>,
      input: AnyRecord = {},
    ) => finalizeSettledMirrorWorld(status, input),
    epochCommitJourneyEpisodes: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return companionRuntime.commitEpisodes(input);
    },
    epochJourneyStatus: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return companionRuntime.status(input);
    },
    epochRecallJourney: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return recallJourneyRuntime(input);
    },
    epochLinkJourneyVerification: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return companionRuntime.linkVerification(input);
    },
    epochJourneyAlbum: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return companionRuntime.album(input);
    },
    epochAgentMemory: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.agentMemory(input);
    },
    epochPersonalMigrationSummary: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.personalMigrationSummary(input);
    },
    epochConfirmPersonalityDrift: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.confirmPersonalityDrift(input);
    },
    epochAbuseStatus: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.abuseStatus(input);
    },
    epochAbuseProfiles: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.abuseProfiles(input);
    },
    epochOperatorOverview: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      const overview = epochRuntime.operatorOverview(input);
      const epochEventsValue = epochRuntime.events({ limit: 1_000 });
      const epochEvents = recordValue(epochEventsValue).events;
      return {
        ...overview,
        companion: journeyMetricsView(
          companionRuntime.journeyRuntime().projection(),
          Array.isArray(epochEvents) ? epochEvents : [],
        ),
      };
    },
    epochWorldClock: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return worldClockRuntime.status();
    },
    epochWorldState: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return worldSimulationView(worldSimulationRuntime.status(), {
        regionId: optionalString(input.regionId),
        factionId: optionalString(input.factionId),
        includeShipments: input.includeShipments === true,
        limit: typeof input.limit === "number" ? input.limit : undefined,
      });
    },
    epochWorldContent: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return worldContentRegistryView(worldContentRegistry, {
        collection: typeof input.collection === "string"
          ? input.collection as WorldContentRegistryViewInput["collection"]
          : undefined,
        id: optionalString(input.id),
        query: optionalString(input.query),
        limit: typeof input.limit === "number" ? input.limit : undefined,
      });
    },
    epochAdvanceWorldClock: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      epochRuntime.operatorOverview({ operatorKey: input.operatorKey, limit: 1 });
      return advanceCanonicalWorld({
        reason: optionalString(input.reason) || "operator_world_tick",
        processedDomains: Array.isArray(input.processedDomains)
          ? input.processedDomains.filter((value): value is string => typeof value === "string")
          : ["world_simulation"],
        sourceEventIds: Array.isArray(input.sourceEventIds)
          ? input.sourceEventIds.filter((value): value is string => typeof value === "string")
          : [],
        idempotencyKey: stringValue(input.idempotencyKey),
        causationId: optionalString(input.causationId),
        correlationId: optionalString(input.correlationId),
      });
    },
    epochMigrateWorldContent: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      epochRuntime.operatorOverview({ operatorKey: input.operatorKey, limit: 1 });
      return migrateCanonicalWorldContent({
        regionSuccessors: stringRecord(
          input.regionSuccessors,
          "world_simulation_region_successors_invalid",
        ),
        factionSuccessors: stringRecord(
          input.factionSuccessors,
          "world_simulation_faction_successors_invalid",
        ),
        idempotencyKey: stringValue(input.idempotencyKey),
        causationId: optionalString(input.causationId),
        correlationId: optionalString(input.correlationId),
      });
    },
    epochRunMaintenance: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      const maintenance = epochRuntime.runMaintenance(input);
      const maintenanceEvents = epochEventsForPersistence(maintenance);
      if (maintenance.duplicate) {
        const priorWorldTick = worldClockRuntime.resultForIdempotencyKey(
          `${stringValue(input.idempotencyKey)}:world-clock`,
        );
        const priorSimulation = worldSimulationRuntime.resultForIdempotencyKey(
          `${stringValue(input.idempotencyKey)}:world-clock:simulation`,
        );
        return attachEpochEventsForPersistence({
          ...maintenance,
          worldClock: priorWorldTick?.clock ?? worldClockRuntime.status(),
          worldSimulation: priorSimulation?.simulation ?? worldSimulationRuntime.status(),
        }, maintenanceEvents);
      }
      const worldClockAdvance = advanceCanonicalWorld({
        reason: "maintenance_world_tick",
        processedDomains: [
          "npc_schedule",
          "identity_needs",
          "economy",
          "resources",
          "weather",
          "factions",
          "world_events",
        ],
        sourceEventIds: maintenanceEvents.map((event) => event.eventId),
        idempotencyKey: `${stringValue(input.idempotencyKey)}:world-clock`,
        causationId: optionalString(input.causationId),
        correlationId: optionalString(input.correlationId),
      });
      return attachEpochEventsForPersistence({
        ...maintenance,
        worldClock: worldClockAdvance.clock,
        worldSimulation: worldClockAdvance.worldSimulation,
        worldFlows: worldClockAdvance.worldFlows,
        events: [...maintenance.events, ...worldClockAdvance.events],
      }, [...maintenanceEvents, ...epochEventsForPersistence(worldClockAdvance)]);
    },
    epochArchiveIdentity: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.archiveIdentity(input);
    },
    epochReincarnate: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.reincarnate(input);
    },
    epochIdentityArchive: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.identityArchive(input);
    },
    epochWorldOverview: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return {
        ...epochRuntime.worldOverview(input),
        worldClock: worldClockRuntime.status(),
        worldSimulation: worldSimulationView(worldSimulationRuntime.status()),
        worldContent: worldContentRegistryView(worldContentRegistry),
      };
    },
    epochLoreContributions: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.loreContributions(input);
    },
    epochLoreTargets: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.loreTargets(input);
    },
    epochAdjudicateLoreTarget: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.adjudicateLoreTarget(input);
    },
    epochExplorerProfile: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.explorerProfile(input);
    },
    epochPlayerDataExport: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.playerDataExport(input);
    },
    epochChangeAgentCustody: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.changeAgentCustody(input);
    },
    epochCompetitiveLadder: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.competitiveLadder(input);
    },
    epochSetDowntime: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.setDowntime(input);
    },
    epochClaimDowntime: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.claimDowntime(input);
    },
    epochTickDowntime: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.tickDowntime(input);
    },
    epochRegionInfo: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      const info = epochRuntime.regionInfo(input);
      const regionId = optionalString(recordValue(info).regionId) || optionalString(input.regionId);
      const canonicalContent = regionId ? canonicalPlaceContext(worldContentRegistry, regionId) : undefined;
      const worldState = regionId
        ? worldSimulationView(worldSimulationRuntime.status(), { regionId }).regions[0]
        : undefined;
      return {
        ...info,
        ...(canonicalContent ? { canonicalContent, worldContentSourceHash: worldContentRegistry.sourceHash } : {}),
        ...(worldState ? { worldState } : {}),
      };
    },
    epochNpcRelationships: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.npcRelationships(input);
    },
    epochAgentNpcBonds: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.agentNpcBonds(input);
    },
    epochNpcInfo: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.npcInfo(input);
    },
    epochNpcMemories: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.npcMemories(input);
    },
    epochHouseholds: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.households(input);
    },
    epochOrganizations: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.organizations(input);
    },
    epochCreateOrganization: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.createOrganization(input);
    },
    epochUpdateOrganizationMembership: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.updateOrganizationMembership(input);
    },
    epochPurchaseOrganizationUpgrade: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.purchaseOrganizationUpgrade(input);
    },
    epochContributeOrganizationTreasury: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.contributeOrganizationTreasury(input);
    },
    epochProposeOrganizationBudget: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.proposeOrganizationBudget(input);
    },
    epochResolveOrganizationBudget: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.resolveOrganizationBudget(input);
    },
    epochOrganizationPolitics: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.organizationPolitics(input);
    },
    epochTickOrganizationPolitics: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.tickOrganizationPolitics(input);
    },
    epochNpcCareers: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.npcCareers(input);
    },
    epochNpcLocations: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.npcLocations(input);
    },
    epochNpcAssets: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.npcAssets(input);
    },
    epochNpcHealth: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.npcHealth(input);
    },
    epochSocialHooks: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.socialHooks(input);
    },
    epochSeasons: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.seasons(input);
    },
    epochSeasonArchive: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.seasonArchive(input);
    },
    epochSeedSeason: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      if (Array.isArray(input.factionIds)) {
        const canonicalFactionIds = new Set(worldContentRegistry.factions.map((faction) => faction.id));
        for (const factionId of input.factionIds) {
          if (typeof factionId !== "string" || !canonicalFactionIds.has(factionId)) {
            throw new Error(`world_content_faction_not_found:${String(factionId)}`);
          }
        }
      }
      return epochRuntime.seedSeason(input);
    },
    epochContributeSeason: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.contributeSeason(input);
    },
    epochSettleSeason: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.settleSeason(input);
    },
    epochClaimRegionControl: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.claimReleasedRegionControl(input);
    },
    epochMessages: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.messages(input);
    },
    epochModerationQueue: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.moderationQueue(input);
    },
    epochResolveModeration: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.resolveModeration(input);
    },
    epochRecordRiskReview: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.recordRiskReview(input);
    },
    epochReleaseMarketRiskRestriction: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.releaseMarketRiskRestriction(input);
    },
    epochReleaseAbuseRestriction: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.releaseAbuseRestriction(input);
    },
    epochDecayAbuseScores: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.decayAbuseScores(input);
    },
    epochDecayRegionControls: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.decayRegionControls(input);
    },
    epochRequestConfirmation: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.requestConfirmation(input);
    },
    epochConfirmAction: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.confirmAction(input);
    },
    epochConfirmations: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.confirmations(input);
    },
    epochPostMessage: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.postMessage(input);
    },
    epochGenerateRegionNews: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.generateRegionNews(input);
    },
    epochClaimNewsLegend: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.claimNewsLegend(input);
    },
    epochRecordLoreContribution: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.recordLoreContribution(input);
    },
    epochObjectives: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.objectives(input);
    },
    epochSeedObjective: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.seedObjective(input);
    },
    epochContributeObjective: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.contributeObjective(input);
    },
    epochSettleObjective: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.settleObjective(input);
    },
    epochResourceNodes: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.resourceNodes(input);
    },
    epochSpawnResourceNode: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.spawnResourceNode(input);
    },
    epochContestResourceNode: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.contestResourceNode(input);
    },
    epochSettleResourceNode: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.settleResourceNode(input);
    },
    epochAnomalies: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.anomalies(input);
    },
    epochSpawnAnomaly: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.spawnAnomaly(input);
    },
    epochContestAnomaly: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.contestAnomaly(input);
    },
    epochResolveAnomaly: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.resolveAnomaly(input);
    },
    epochInventory: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.inventory(input);
    },
    epochShop: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.shop(input);
    },
    epochCreateItem: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.createInventoryItem(input);
    },
    epochCraftItem: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.craftInventoryItem(input);
    },
    epochPurchaseShopOffer: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.purchaseShopOffer(input);
    },
    epochBindItem: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.bindInventoryItem(input);
    },
    epochMarket: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.market(input);
    },
    epochDirectTrades: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.directTrades(input);
    },
    epochCreateMarketOrder: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.createMarketOrder(input);
    },
    epochFillMarketOrder: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.fillMarketOrder(input);
    },
    epochCancelMarketOrder: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.cancelMarketOrder(input);
    },
    epochCreateDirectTrade: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.createDirectTrade(input);
    },
    epochAcceptDirectTrade: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.acceptDirectTrade(input);
    },
    epochCancelDirectTrade: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.cancelDirectTrade(input);
    },
    epochTickMarketExpiry: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.tickMarketExpiry(input);
    },
    epochTickDirectTradeExpiry: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.tickDirectTradeExpiry(input);
    },
    epochBounties: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.bounties(input);
    },
    epochCreateBounty: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.createBounty(input);
    },
    epochClaimBounty: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.claimBounty(input);
    },
    epochPartyRuns: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.partyRuns(input);
    },
    epochCreatePartyRun: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.createPartyRun(input);
    },
    epochUpdatePartyInvite: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.updatePartyInvite(input);
    },
    epochJoinPartyRun: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.joinPartyRun(input);
    },
    epochRequestPartyJoin: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.requestPartyJoin(input);
    },
    epochResolvePartyJoinRequest: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.resolvePartyJoinRequest(input);
    },
    epochSettlePartyRun: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.settlePartyRun(input);
    },
    epochRaids: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.raids(input);
    },
    epochResolveRaid: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.resolveRaid(input);
    },
    epochResolveRegionRevolt: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.resolveRegionRevolt(input);
    },
    epochResolveRetaliation: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.resolveRetaliation(input);
    },
    epochRelationships: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.relationships(input);
    },
    epochDiplomacy: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.diplomacy(input);
    },
    epochProposeDiplomacy: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.proposeDiplomacy(input);
    },
    epochRespondDiplomacy: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.respondDiplomacy(input);
    },
    epochUpdateRelationship: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.updateRelationship(input);
    },
    epochUpdateAgentNpcBond: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.updateAgentNpcBond(input);
    },
    epochTraceConflictTemplates: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.traceConflictTemplates();
    },
    epochDeployTraceConflict: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.deployTraceConflict(input);
    },
    epochOwnerTraceConflicts: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.ownerTraceConflicts(input);
    },
    epochOwnerTraceConflictMemories: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.ownerTraceConflictMemories(input);
    },
    epochRegionTraceConflicts: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.regionTraceConflicts({
        regionId: input.regionId,
        limit: input.limit,
      });
    },
    epochTurnCard: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.createTurnCard(input);
    },
    epochResolveTurn: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      assertOperationSwitchOpen({
        action: "settlement",
        ...operationDimensionsFromInput(input),
      });
      return epochRuntime.resolveTurnCard(input);
    },
    epochHostedSessions: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.hostedSessions(input);
    },
    epochHostedSessionWatch: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.hostedSessionWatch(input);
    },
    epochStartHostedSession: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.startHostedSession(input);
    },
    epochStartJourneyHostedSession: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.startJourneyHostedSession(input);
    },
    epochSubmitHostedAction: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.submitHostedAction(input);
    },
    epochRunServerHostedAction: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.runServerHostedAction(input);
    },
    epochRunExploration: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.runExploration(input);
    },
    epochQueueServerHostedAction: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.queueServerHostedAction(input);
    },
    epochServerHostedJobs: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.serverHostedJobs(input);
    },
    epochRunServerHostedJob: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.runServerHostedJob(input);
    },
    epochWebBridgeTurn: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.webBridgeTurn(input);
    },
    epochSubmitWebBridgeAction: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.submitWebBridgeAction(input);
    },
    epochAttestationChallenge: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.attestationChallenge(input);
    },
    epochSubmitAttestedAction: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.submitAttestedAction(input);
    },
    epochNpcNote: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.npcNote(input);
    },
    epochSubmitNpcCandidate: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.submitNpcCandidate(input);
    },
    epochReviewNpcCandidate: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.reviewNpcCandidate(input);
    },
    epochTickNpcLifecycle: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.tickNpcLifecycle(input);
    },
    epochResultPage: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.resultPage(input);
    },
    epochCreateResultPage: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      assertOperationSwitchOpen({
        action: "public_sharing",
        ...operationDimensionsFromInput(input),
      });
      return epochRuntime.createResultPage(input);
    },
    epochRevokeResultPage: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.revokeResultPage(input);
    },
    epochDeleteResultPage: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.deleteResultPage(input);
    },
    epochGetResultPage: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.getResultPage(input);
    },
    epochGetPublicResultPage: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.getPublicResultPage(input);
    },
    epochEvents: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return attachEpochEventsForPersistence(epochRuntime.events(input), []);
    },
    epochAudit: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.audit(input);
    },
    epochRecordRejectedCommand: (input: AnyRecord = {}) => epochRuntime.recordRejectedCommand(input),
  };
}

const objectSchema = (properties: AnyRecord, required: string[] = []) => ({
  type: "object",
  additionalProperties: true,
  properties,
  required,
});

export const AGENT_WORLD_TOOLS = [
  {
    name: "agent_world.context_package",
    title: "Context package",
    description: "Legacy authored-report context only. For canonical game progress prefer obsidian_epoch.identity, obsidian_epoch.turn_card, obsidian_epoch.resolve_turn and obsidian_epoch.create_result_page.",
    inputSchema: objectSchema({
      explorerId: { type: "string" },
      agentId: { type: "string" },
      mandate: { type: "string" },
      additionalInstruction: { type: "string" },
      partyRunId: { type: "string" },
      participantRole: { type: "string" },
      anchors: { type: "array", items: { type: "object" } },
    }, ["explorerId", "agentId"]),
  },
  {
    name: "agent_world.context_snapshots",
    title: "Context snapshots",
    description: "Lists saved legacy authored-report context snapshots with setting card ids, public summaries, retrieval parameters and filtering reasons.",
    inputSchema: objectSchema({
      limit: { type: "number" },
    }),
  },
  {
    name: "agent_world.start_run",
    title: "Start run",
    description: "Legacy authored-report run ticket. For canonical Obsidian Epoch play use obsidian_epoch.turn_card and obsidian_epoch.resolve_turn instead.",
    inputSchema: objectSchema({
      explorerId: { type: "string" },
      agentId: { type: "string" },
      regionId: { type: "string" },
      risk: { type: "string" },
      partyRunId: { type: "string" },
      participantRole: { type: "string" },
    }, ["explorerId", "agentId"]),
  },
  {
    name: "agent_world.run_heartbeat",
    title: "Run heartbeat",
    description: "Legacy authored-report heartbeat/checkpoint. Refreshes an issued run ticket with a new server sequence window and expiry; stale sequence values are no longer accepted.",
    inputSchema: objectSchema({
      runTicket: { type: "string" },
      explorerId: { type: "string" },
      agentId: { type: "string" },
    }, ["runTicket", "explorerId", "agentId"]),
  },
  {
    name: "agent_world.submit_battle_report",
    title: "Submit battle report",
    description: "Legacy authored-report submission for old exploration reports. It is not canonical game progress; prefer obsidian_epoch.turn_card and obsidian_epoch.resolve_turn for server-settled play.",
    inputSchema: objectSchema({
      runTicket: { type: "string" },
      sequence: { type: "number" },
      contextVersion: { type: "string" },
      run: { type: "object" },
    }, ["runTicket", "sequence", "run"]),
  },
  {
    name: "agent_world.archive_local_report",
    title: "Archive local report",
    description: "Archive a local/offline authored report without a run ticket. This never settles world impact, lore, rewards, or progression.",
    inputSchema: objectSchema({
      run: { type: "object" },
    }, ["run"]),
  },
  {
    name: "agent_world.outbox",
    title: "Legacy outbox",
    description: "Read legacy authored-report outbox event status, retry counts and dead-letter queue without exposing raw report payloads.",
    inputSchema: objectSchema({
      status: { type: "string" },
      limit: { type: "number" },
    }),
  },
  {
    name: "agent_world.replay_outbox",
    title: "Replay legacy outbox event",
    description: "Operator manual replay for a pending, retrying or dead-lettered legacy authored-report outbox event.",
    inputSchema: objectSchema({
      outboxId: { type: "string" },
      operatorKey: { type: "string" },
    }, ["outboxId", "operatorKey"]),
  },
  {
    name: "agent_world.review_queue",
    title: "Legacy review queue",
    description: "Read delayed legacy authored-report adjudication queue entries created by review budget limits for reputation, runTicket, length, similarity, and system load.",
    inputSchema: objectSchema({
      limit: { type: "number" },
    }),
  },
  {
    name: "agent_world.public_world",
    title: "Public world",
    description: "Read the legacy authored-report public world index, source graph, claims, conflicts, factions, and archive runs.",
    inputSchema: objectSchema({}),
  },
  {
    name: "agent_world.progression_state",
    title: "Progression state",
    description: "Read legacy authored-report faction reputation, rank, unlocked traits, and external item limits for an explorer.",
    inputSchema: objectSchema({
      explorerId: { type: "string" },
    }, ["explorerId"]),
  },
  {
    name: "agent_world.operation_check",
    title: "Operation check",
    description: "Check whether an explorer's faction rank allows a high-level world operation and whether fine-grained operation switches pause settlement, public sharing or source rewards for the supplied dimensions.",
    inputSchema: objectSchema({
      explorerId: { type: "string" },
      factionId: { type: "string" },
      operation: { type: "string" },
      action: { type: "string" },
      rewardType: { type: "string" },
      commissionType: { type: "string" },
      chapterId: { type: "string" },
      locationId: { type: "string" },
      regionId: { type: "string" },
      riskLevel: { type: "string" },
    }, ["explorerId"]),
  },
  {
    name: "agent_world.community_react",
    title: "Community reaction",
    description: "Record an explorer reaction to a public claim, conflict, faction, or run.",
    inputSchema: objectSchema({
      targetType: { type: "string" },
      targetId: { type: "string" },
      explorerId: { type: "string" },
      reaction: { type: "string" },
    }, ["targetType", "targetId", "explorerId", "reaction"]),
  },
  {
    name: "agent_world.community_comment",
    title: "Community comment",
    description: "Add a short public discussion comment to a world object.",
    inputSchema: objectSchema({
      targetType: { type: "string" },
      targetId: { type: "string" },
      explorerId: { type: "string" },
      body: { type: "string" },
    }, ["targetType", "targetId", "explorerId", "body"]),
  },
  {
    name: "agent_world.community_thread",
    title: "Community thread",
    description: "Read reactions and comments for a public world object.",
    inputSchema: objectSchema({
      targetId: { type: "string" },
    }, ["targetId"]),
  },
  {
    name: "agent_world.transparency_verify",
    title: "Transparency verify",
    description: "Verify the append-only public adjudication record chain.",
    inputSchema: objectSchema({}),
  },
  {
    name: "obsidian_epoch.quickstart",
    title: "Epoch quickstart",
    description: "Return the host-neutral install config and one-turn MCP playbook for starting Obsidian Epoch in a coding-agent host.",
    inputSchema: objectSchema({
      host: { type: "string" },
      serverBase: { type: "string" },
      contentPolicyRegion: { type: "string" },
      regionCode: { type: "string" },
    }),
  },
  {
    name: "obsidian_epoch.identity",
    title: "Epoch identity",
    description: "Issue a server-owned agent identity, or read an existing identity when only agentId is supplied. Registered explorers must provide recovery authorization for later identity issuance or idempotent replay.",
    inputSchema: objectSchema({
      explorerId: { type: "string" },
      agentId: { type: "string" },
      recoveryCode: { type: "string" },
      idempotencyKey: { type: "string" },
    }),
  },
  {
    name: "obsidian_epoch.rotate_recovery",
    title: "Rotate recovery code",
    description: "Replace an explorer recovery credential after proving the current recovery code. The old recovery code is revoked for later owner-authorized writes.",
    inputSchema: objectSchema({
      explorerId: { type: "string" },
      recoveryCode: { type: "string" },
      newRecoveryCode: { type: "string" },
      idempotencyKey: { type: "string" },
    }, ["explorerId", "recoveryCode", "newRecoveryCode", "idempotencyKey"]),
  },
  {
    name: "obsidian_epoch.progress",
    title: "Epoch progress",
    description: "Read an agent identity, lifetime, lineage, resources, downtime and latest canonical events.",
    inputSchema: objectSchema({
      explorerId: { type: "string" },
      agentId: { type: "string" },
      turnCardId: { type: "string" },
      limit: { type: "number" },
    }),
  },
  {
    name: "obsidian_epoch.agent_briefing",
    title: "Agent briefing",
    description: "Read the owner-authorized companion briefing: identity, current journey, returned journeys with complete server-authored story reports, pending decisions, recent episodes and server world context.",
    inputSchema: objectSchema({
      explorerId: { type: "string" },
      agentId: { type: "string" },
      regionId: { type: "string" },
      limit: { type: "number" },
      recoveryCode: { type: "string" },
      localSecret: { type: "string" },
    }),
  },
  {
    name: "obsidian_epoch.prepare_journey",
    title: "Prepare journey",
    description: "Owner-authorized mission preview. Records the requested task type and destination map; the route is generated from that map at start and is not a fixed client-authored script.",
    inputSchema: objectSchema({
      agentId: { type: "string" },
      originRegionId: { type: "string" },
      destinationRegionId: { type: "string" },
      taskType: { type: "string" },
      mandate: { type: "object" },
      presetId: { type: "string", enum: ["cautious", "balanced", "explorer"] },
      policy: { type: "object" },
      expectedReturn: { type: "string" },
      recoveryCode: { type: "string" },
      localSecret: { type: "string" },
      idempotencyKey: { type: "string" },
    }, ["agentId", "destinationRegionId", "idempotencyKey"]),
  },
  {
    name: "obsidian_epoch.start_journey",
    title: "Start journey",
    description: "Owner-authorized departure into a historical mirror. Before Host generation, the server freezes an already-materialized in-game interval and place-specific macro slice, then validates and signs a route grounded in that slice; unavailable or invalid Sampling falls back to a server route seed.",
    inputSchema: objectSchema({
      journeyId: { type: "string" },
      expectedVersion: { type: "number" },
      realDurationMs: { type: "number" },
      worldDurationMs: {
        type: "number",
        description: "Legacy compatibility only. New mirror Journeys ignore this value because the server chooses their in-game end time.",
      },
      episodeCount: { type: "number" },
      decisionMode: { type: "string", enum: ["agent_native", "host_sampling"] },
      taskGenerationMode: { type: "string", enum: ["model_sampling", "server_fallback"] },
      recoveryCode: { type: "string" },
      localSecret: { type: "string" },
      idempotencyKey: { type: "string" },
    }, ["journeyId", "expectedVersion", "idempotencyKey"]),
  },
  {
    name: "obsidian_epoch.propose_journey_step",
    title: "Propose journey step",
    description: "Owner-authorized proposal for the current mission task. Returns the mission state, a server-signed SceneContract and concrete action options without committing an outcome.",
    inputSchema: objectSchema({
      journeyId: { type: "string" },
      expectedVersion: { type: "number" },
      recoveryCode: { type: "string" },
      localSecret: { type: "string" },
      idempotencyKey: { type: "string" },
    }, ["journeyId", "expectedVersion", "idempotencyKey"]),
  },
  {
    name: "obsidian_epoch.commit_journey_action",
    title: "Commit journey action",
    description: "Commit one server-signed main or side objective action. The server validates binding and evidence, advances to the next objective, then adjudicates tier, hidden condition and reward after the final return.",
    inputSchema: objectSchema({
      journeyId: { type: "string" },
      sceneId: { type: "string" },
      episodeId: { type: "string" },
      actionOptionId: { type: "string" },
      expectedVersion: { type: "number" },
      signature: { type: "string" },
      visibleText: { type: "string" },
      recoveryCode: { type: "string" },
      localSecret: { type: "string" },
      idempotencyKey: { type: "string" },
    }, ["journeyId", "sceneId", "episodeId", "actionOptionId", "expectedVersion", "signature", "idempotencyKey"]),
  },
  {
    name: "obsidian_epoch.journey_status",
    title: "Journey status",
    description: "Read an owner-authorized mission, staged task statuses, grounded episodes and next poll time; settled missions resolve explicitly to completed or failed and include a complete grounded story report.",
    inputSchema: objectSchema({
      journeyId: { type: "string" },
      recoveryCode: { type: "string" },
      localSecret: { type: "string" },
    }, ["journeyId"]),
  },
  {
    name: "obsidian_epoch.recall_journey",
    title: "Recall journey",
    description: "Request an owner-authorized safe return. Recall preserves prior events and does not teleport or roll back the journey.",
    inputSchema: objectSchema({
      journeyId: { type: "string" },
      expectedVersion: { type: "number" },
      recoveryCode: { type: "string" },
      localSecret: { type: "string" },
      idempotencyKey: { type: "string" },
    }, ["journeyId", "expectedVersion", "idempotencyKey"]),
  },
  {
    name: "obsidian_epoch.journey_album",
    title: "Journey album",
    description: "Read owner-authorized journey history, complete grounded story reports and episode cards for one persistent identity.",
    inputSchema: objectSchema({
      agentId: { type: "string" },
      recoveryCode: { type: "string" },
      localSecret: { type: "string" },
      year: { type: "number" },
    }, ["agentId"]),
  },
  {
    name: "obsidian_epoch.agent_memory",
    title: "Epoch agent memory",
    description: "Read stratified agent memory: server-confirmed NPC identity facts, operator-reviewed risky rumor claims, and agent-private unreviewed or rejected story memories.",
    inputSchema: objectSchema({
      agentId: { type: "string" },
      regionId: { type: "string" },
      limit: { type: "number" },
    }),
  },
  {
    name: "obsidian_epoch.personal_migration_summary",
    title: "Personal migration summary",
    description: "Read a server-derived personal lore migration summary for an agent or explorer, grouped into retained, downgraded, needs-evidence, adopted and sealed setting buckets.",
    inputSchema: objectSchema({
      agentId: { type: "string" },
      explorerId: { type: "string" },
      limit: { type: "number" },
    }),
  },
  {
    name: "obsidian_epoch.confirm_personality_drift",
    title: "Confirm personality drift",
    description: "Owner-authorized confirmation of a server-proposed personality drift after a concrete scar, pollution, betrayal or other source event; confirmed drift starts a cooldown before later proposals.",
    inputSchema: objectSchema({
      driftId: { type: "string" },
      recoveryCode: { type: "string" },
      localSecret: { type: "string" },
      idempotencyKey: { type: "string" },
    }, ["driftId", "idempotencyKey"]),
  },
  {
    name: "obsidian_epoch.abuse_status",
    title: "Epoch abuse status",
    description: "Read the current state-change window, remaining writes, reset time and server-derived abuse score/restriction level for an explorer or agent actor key.",
    inputSchema: objectSchema({
      explorerId: { type: "string" },
      agentId: { type: "string" },
      actorExplorerId: { type: "string" },
      runnerId: { type: "string" },
      sellerAgentId: { type: "string" },
      buyerAgentId: { type: "string" },
      attackerAgentId: { type: "string" },
      sessionId: { type: "string" },
      challengeId: { type: "string" },
    }),
  },
  {
    name: "obsidian_epoch.abuse_profiles",
    title: "Epoch abuse profiles",
    description: "Operator-gated list of server-derived abuse profiles sorted by active score.",
    inputSchema: objectSchema({
      operatorKey: { type: "string" },
      level: { type: "string" },
      limit: { type: "number" },
    }, ["operatorKey"]),
  },
  {
    name: "obsidian_epoch.operator_overview",
    title: "Epoch operator overview",
    description: "Operator-gated overview of open moderation, restricted abuse profiles, active market restrictions, risk audit items, recent abuse releases and growth metrics paired with quality guardrails.",
    inputSchema: objectSchema({
      operatorKey: { type: "string" },
      limit: { type: "number" },
    }, ["operatorKey"]),
  },
  {
    name: "obsidian_epoch.run_maintenance",
    title: "Run Epoch maintenance",
    description: "Operator-gated one-shot maintenance run for server-owned NPC lifecycle, market expiry, region-control decay, abuse-score decay, resource-node spawn/settlement, anomaly-template spawn, seasonal campaign start, mature-season settlement and queued server-hosted job workers.",
    inputSchema: objectSchema({
      operatorKey: { type: "string" },
      npcRegionId: { type: "string" },
      npcLimit: { type: "number" },
      marketMaxAgeSeconds: { type: "number" },
      marketLimit: { type: "number" },
      resourceNodeRegionIds: { type: "array", items: { type: "string" } },
      resourceNodeLimit: { type: "number" },
      resourceNodeSettlementLimit: { type: "number" },
      anomalyRegionIds: { type: "array", items: { type: "string" } },
      anomalyLimit: { type: "number" },
      anomalyTemplateKey: { type: "string" },
      seasonRegionIds: { type: "array", items: { type: "string" } },
      seasonLimit: { type: "number" },
      seasonKey: { type: "string" },
      seasonSettlementLimit: { type: "number" },
      serverHostedJobLimit: { type: "number" },
      regionControlDecayLimit: { type: "number" },
      regionControlDecayAmount: { type: "number" },
      regionControlDecayMinAgeSeconds: { type: "number" },
      abuseDecayLimit: { type: "number" },
      abuseDecayAmount: { type: "number" },
      worldAdvanceMinutes: {
        type: "number",
        minimum: 1,
        maximum: 43200,
        description: "Deprecated compatibility field; ignored because elapsed time is server-derived.",
      },
      idempotencyKey: { type: "string" },
    }, ["operatorKey", "idempotencyKey"]),
  },
  {
    name: "obsidian_epoch.archive_identity",
    title: "Archive identity",
    description: "Server-archive an identity into a final death record. The server derives the final title.",
    inputSchema: objectSchema({
      agentId: { type: "string" },
      archiveReason: { type: "string" },
      finalTitle: { type: "string" },
      recoveryCode: { type: "string" },
      localSecret: { type: "string" },
      idempotencyKey: { type: "string" },
    }, ["agentId", "idempotencyKey"]),
  },
  {
    name: "obsidian_epoch.reincarnate",
    title: "Reincarnate identity",
    description: "Issue the next server-owned identity for an archived previous identity.",
    inputSchema: objectSchema({
      previousAgentId: { type: "string" },
      identityName: { type: "string" },
      recoveryCode: { type: "string" },
      localSecret: { type: "string" },
      idempotencyKey: { type: "string" },
    }, ["previousAgentId", "idempotencyKey"]),
  },
  {
    name: "obsidian_epoch.identity_archive",
    title: "Identity archive",
    description: "Read an identity death archive, lineage, resources, key events and reincarnation link.",
    inputSchema: objectSchema({
      agentId: { type: "string" },
      limit: { type: "number" },
    }, ["agentId"]),
  },
  {
    name: "obsidian_epoch.explorer_profile",
    title: "Explorer profile",
    description: "Read an explorer-level player dashboard across server-issued identities, lineage resources, identity slots and public pages.",
    inputSchema: objectSchema({
      explorerId: { type: "string" },
      limit: { type: "number" },
    }, ["explorerId"]),
  },
  {
    name: "obsidian_epoch.player_data_export",
    title: "Player data export",
    description: "Export one owner-authenticated explorer lineage as redacted JSON data and public audit replay summaries. Raw event payloads, secrets and other players' private trades are excluded.",
    inputSchema: objectSchema({
      explorerId: { type: "string" },
      recoveryCode: { type: "string" },
      localSecret: { type: "string" },
      limit: { type: "number" },
    }, ["explorerId"]),
  },
  {
    name: "obsidian_epoch.change_agent_custody",
    title: "Change agent custody",
    description: "Operator-gated custody transition. Imprisoned identities cannot enter or settle downtime until a canonical release event is recorded.",
    inputSchema: objectSchema({
      operatorKey: { type: "string" },
      agentId: { type: "string" },
      custodyStatus: { type: "string", enum: ["free", "imprisoned"] },
      reason: { type: "string" },
      idempotencyKey: { type: "string" },
    }, ["operatorKey", "agentId", "custodyStatus", "idempotencyKey"]),
  },
  {
    name: "obsidian_epoch.competitive_ladder",
    title: "Competitive ladder",
    description: "Read server-settled casual, ranked or verified standings for a region, season or server tournament. Verified mode counts only hosted or attested delivery classes.",
    inputSchema: objectSchema({
      mode: { type: "string", enum: ["casual", "ranked", "verified"] },
      regionId: { type: "string" },
      seasonId: { type: "string" },
      tournamentId: { type: "string" },
      limit: { type: "number" },
    }, ["mode"]),
  },
  {
    name: "obsidian_epoch.world_overview",
    title: "World overview",
    description: "Read the canonical public world overview: visible news, recent result pages, terminal archives, categorical honors, recent lore contributions, active seasons, region highlights and public page links.",
    inputSchema: objectSchema({
      limit: { type: "number" },
    }),
  },
  {
    name: "obsidian_epoch.world_clock",
    title: "World clock",
    description: "Read the Year-1 server-authoritative clock derived at one game day per real minute, including the materialized cursor, pending catch-up and current 60-year timeline cycle.",
    inputSchema: objectSchema({}),
  },
  {
    name: "obsidian_epoch.world_state",
    title: "Living world state",
    description: "Read the replayable server-authoritative regional economy, finite reserves, needs coverage, prices, in-transit shipments, faction logistics and conflict pressure produced by WorldTick.",
    inputSchema: objectSchema({
      regionId: { type: "string" },
      factionId: { type: "string" },
      includeShipments: { type: "boolean" },
      limit: { type: "number" },
    }),
  },
  {
    name: "obsidian_epoch.world_content",
    title: "Canonical world content",
    description: "Read the versioned compiled registry for canonical rules, power systems, species, factions, layers, places and permanent routes.",
    inputSchema: objectSchema({
      collection: {
        type: "string",
        enum: ["rules", "systems", "species", "factions", "layers", "places", "routes"],
      },
      id: { type: "string" },
      query: { type: "string" },
      limit: { type: "number" },
    }),
  },
  {
    name: "obsidian_epoch.world_knowledge",
    title: "Canonical world knowledge",
    description: "Hybrid lexical and semantic retrieval over the validated canonical registry of world rules, mystery systems, species, factions, layers, places and permanent routes. Results cite stable entity ids and source paths and never include unadmitted client lore.",
    inputSchema: objectSchema({
      query: { type: "string", minLength: 1, maxLength: 500 },
      collection: {
        type: "string",
        enum: ["rules", "systems", "species", "factions", "layers", "places", "routes"],
      },
      entityId: { type: "string" },
      regionId: { type: "string" },
      limit: { type: "number", minimum: 1, maximum: 30 },
    }, ["query"]),
  },
  {
    name: "obsidian_epoch.world_memory",
    title: "Solidified world memory",
    description: "Hybrid lexical and semantic retrieval over active, unexpired journey stories that passed the main-line canon threshold and were solidified into the shared world. Revoked or deleted sharing revisions are removed. Results are derived memory with source page, journey and canonical event ids; they never mutate or overrule the event ledger.",
    inputSchema: objectSchema({
      query: { type: "string", minLength: 1, maxLength: 500 },
      regionId: { type: "string" },
      fromWorldTime: { type: "string" },
      toWorldTime: { type: "string" },
      limit: { type: "number", minimum: 1, maximum: 30 },
    }, ["query"]),
  },
  {
    name: "obsidian_epoch.advance_world_clock",
    title: "Synchronize world clock",
    description: "Operator-gated server-time synchronization. The server derives game time at one game day per real minute, persists a bounded catch-up tick, advances the macro world simulation and exposes crossed 60-year aggregation boundaries. Clients cannot choose elapsed time.",
    inputSchema: objectSchema({
      operatorKey: { type: "string" },
      elapsedWorldMinutes: {
        type: "number",
        minimum: 1,
        maximum: 43200,
        description: "Deprecated compatibility field; ignored because elapsed time is server-derived.",
      },
      reason: { type: "string" },
      processedDomains: { type: "array", items: { type: "string" } },
      sourceEventIds: { type: "array", items: { type: "string" } },
      causationId: { type: "string" },
      correlationId: { type: "string" },
      idempotencyKey: { type: "string" },
    }, ["operatorKey", "reason", "processedDomains", "idempotencyKey"]),
  },
  {
    name: "obsidian_epoch.migrate_world_content",
    title: "Migrate living world content",
    description: "Operator-gated explicit migration from the persisted living-world content hash to the loaded canonical registry. Removed region and faction IDs require successor mappings; all genesis resources and currency are audited.",
    inputSchema: objectSchema({
      operatorKey: { type: "string" },
      regionSuccessors: { type: "object", additionalProperties: { type: "string" } },
      factionSuccessors: { type: "object", additionalProperties: { type: "string" } },
      causationId: { type: "string" },
      correlationId: { type: "string" },
      idempotencyKey: { type: "string" },
    }, ["operatorKey", "idempotencyKey"]),
  },
  {
    name: "obsidian_epoch.lore_contributions",
    title: "Lore contributions",
    description: "Read server-authoritative confirmation, refutation and revision contributions recorded from canonical event evidence. Supports optional agent, category and target filters.",
    inputSchema: objectSchema({
      agentId: { type: "string" },
      category: { type: "string", enum: ["confirmation", "refutation", "revision"] },
      targetId: { type: "string" },
      limit: { type: "number" },
    }),
  },
  {
    name: "obsidian_epoch.lore_targets",
    title: "Lore targets",
    description: "Read target-level lore status. Without system adjudication, status is derived from canonical confirmation, refutation and revision records.",
    inputSchema: objectSchema({
      targetId: { type: "string" },
      status: { type: "string", enum: ["confirmed", "refuted", "revised", "contested"] },
      limit: { type: "number" },
    }),
  },
  {
    name: "obsidian_epoch.adjudicate_lore_target",
    title: "Adjudicate lore target",
    description: "Operator-gated server adjudication for a lore target. The server accepts only existing contribution event IDs for the same target as evidence. Canon candidates require chapter review, curator approval and migration notes.",
    inputSchema: objectSchema({
      operatorKey: { type: "string" },
      targetId: { type: "string" },
      status: { type: "string", enum: ["confirmed", "refuted", "revised", "contested"] },
      summary: { type: "string" },
      sourceContributionEventIds: { type: "array", items: { type: "string" } },
      canonCandidate: {
        type: "object",
        properties: {
          requested: { type: "boolean" },
          chapterReviewId: { type: "string" },
          curatorApprovedBy: { type: "string" },
          migrationSummary: { type: "string" },
          adoptedText: { type: "string" },
          boundaryNote: { type: "string" },
        },
      },
      idempotencyKey: { type: "string" },
    }, ["operatorKey", "targetId", "status", "summary", "sourceContributionEventIds", "idempotencyKey"]),
  },
  {
    name: "obsidian_epoch.set_downtime",
    title: "Set downtime",
    description: "Set the server-tracked downtime mode for an active agent identity.",
    inputSchema: objectSchema({
      agentId: { type: "string" },
      mode: { type: "string" },
      regionId: { type: "string" },
      recoveryCode: { type: "string" },
      localSecret: { type: "string" },
      idempotencyKey: { type: "string" },
    }, ["agentId", "mode", "idempotencyKey"]),
  },
  {
    name: "obsidian_epoch.claim_downtime",
    title: "Claim downtime",
    description: "Claim downtime rewards calculated from server time and canonical rules.",
    inputSchema: objectSchema({
      agentId: { type: "string" },
      recoveryCode: { type: "string" },
      localSecret: { type: "string" },
      idempotencyKey: { type: "string" },
    }, ["agentId", "idempotencyKey"]),
  },
  {
    name: "obsidian_epoch.tick_downtime",
    title: "Tick downtime",
    description: "Run server-owned downtime ticks for one active agent or a bounded active set without ending downtime.",
    inputSchema: objectSchema({
      operatorKey: { type: "string" },
      agentId: { type: "string" },
      limit: { type: "number" },
      idempotencyKey: { type: "string" },
    }, ["operatorKey", "idempotencyKey"]),
  },
  {
    name: "obsidian_epoch.region_info",
    title: "Region info",
    description: "Read server-known messages, news, leaderboard, open commissions, settled influence changes, conflict traces with optional scoutAgentIds, raidHeat, raidTargets, factionPressure, frontlines with side agent ids and pressure, retaliation opportunities, NPCs, NPC candidates, contested objectives, resource nodes, and seasons for a region.",
    inputSchema: objectSchema({
      regionId: { type: "string" },
      npcCandidateReviewLevel: { type: "string" },
      frontlineLimit: { type: "number" },
      raidTargetAttackerAgentId: { type: "string" },
      raidTargetLimit: { type: "number" },
    }, ["regionId"]),
  },
  {
    name: "obsidian_epoch.messages",
    title: "Messages",
    description: "Read server-recorded world and region messages, optionally filtered by agent or region.",
    inputSchema: objectSchema({
      regionId: { type: "string" },
      agentId: { type: "string" },
      limit: { type: "number" },
    }),
  },
  {
    name: "obsidian_epoch.post_message",
    title: "Post message",
    description: "Post a server-recorded world or region message from an active agent identity. Ordinary world messages require a web-confirmed one-time token; operatorKey enables server-hosted autonomous world or region speech as server_hosted_agent.",
    inputSchema: objectSchema({
      operatorKey: { type: "string" },
      agentId: { type: "string" },
      scope: { type: "string" },
      regionId: { type: "string" },
      body: { type: "string" },
      confirmationToken: { type: "string" },
      recoveryCode: { type: "string" },
      localSecret: { type: "string" },
      idempotencyKey: { type: "string" },
    }, ["agentId", "scope", "body", "idempotencyKey"]),
  },
  {
    name: "obsidian_epoch.request_confirmation",
    title: "Request confirmation",
    description: "Request a server challenge for a high-value action; the user confirms through the web/API path before the MCP host can submit the action token.",
    inputSchema: objectSchema({
      action: { type: "string" },
      agentId: { type: "string" },
      regionId: { type: "string" },
      prompt: { type: "string" },
      turnCardId: { type: "string" },
      sequence: { type: "number" },
      nonce: { type: "string" },
      actionOptionId: { type: "string" },
      visibleText: { type: "string" },
      body: { type: "string" },
      summary: { type: "string" },
      recoveryCode: { type: "string" },
      localSecret: { type: "string" },
      idempotencyKey: { type: "string" },
    }, ["action", "agentId", "idempotencyKey"]),
  },
  {
    name: "obsidian_epoch.moderation_queue",
    title: "Moderation queue",
    description: "Read operator-gated Epoch moderation items for public messages and news.",
    inputSchema: objectSchema({
      operatorKey: { type: "string" },
      status: { type: "string" },
      subjectType: { type: "string" },
    }, ["operatorKey"]),
  },
  {
    name: "obsidian_epoch.resolve_moderation",
    title: "Resolve moderation",
    description: "Resolve an operator-gated Epoch moderation item and publish or hide the subject.",
    inputSchema: objectSchema({
      operatorKey: { type: "string" },
      moderationId: { type: "string" },
      resolution: { type: "string" },
      note: { type: "string" },
      idempotencyKey: { type: "string" },
    }, ["operatorKey", "moderationId", "resolution", "idempotencyKey"]),
  },
  {
    name: "obsidian_epoch.record_risk_review",
    title: "Record risk review",
    description: "Record an operator-gated disposition for a risk-flagged audit event without rewriting the underlying event.",
    inputSchema: objectSchema({
      operatorKey: { type: "string" },
      sourceEventId: { type: "string" },
      resolution: { type: "string" },
      note: { type: "string" },
      idempotencyKey: { type: "string" },
    }, ["operatorKey", "sourceEventId", "resolution", "idempotencyKey"]),
  },
  {
    name: "obsidian_epoch.release_market_risk_restriction",
    title: "Release market risk restriction",
    description: "Release an active operator-gated market restriction while preserving the original audit and risk review history.",
    inputSchema: objectSchema({
      operatorKey: { type: "string" },
      agentId: { type: "string" },
      note: { type: "string" },
      idempotencyKey: { type: "string" },
    }, ["operatorKey", "agentId", "idempotencyKey"]),
  },
  {
    name: "obsidian_epoch.release_abuse_restriction",
    title: "Release abuse restriction",
    description: "Operator-gated release of a server-derived abuse score restriction without erasing rejected-command audit history.",
    inputSchema: objectSchema({
      operatorKey: { type: "string" },
      actorKey: { type: "string" },
      agentId: { type: "string" },
      explorerId: { type: "string" },
      scoreAfter: { type: "number" },
      note: { type: "string" },
      idempotencyKey: { type: "string" },
    }, ["operatorKey", "idempotencyKey"]),
  },
  {
    name: "obsidian_epoch.generate_region_news",
    title: "Generate region news",
    description: "Ask the server worker to publish region news from an existing public region event that mentions an owner-authenticated agent; operators may also publish server events. Title and reward are server-derived.",
    inputSchema: objectSchema({
      operatorKey: { type: "string" },
      agentId: { type: "string" },
      recoveryCode: { type: "string" },
      localSecret: { type: "string" },
      regionId: { type: "string" },
      sourceEventId: { type: "string" },
      idempotencyKey: { type: "string" },
    }, ["regionId", "sourceEventId", "idempotencyKey"]),
  },
  {
    name: "obsidian_epoch.claim_news_legend",
    title: "Claim news legend",
    description: "Claim one-time legend credit for an agent mentioned by a server-published news source event.",
    inputSchema: objectSchema({
      newsId: { type: "string" },
      agentId: { type: "string" },
      recoveryCode: { type: "string" },
      localSecret: { type: "string" },
      idempotencyKey: { type: "string" },
    }, ["newsId", "agentId", "idempotencyKey"]),
  },
  {
    name: "obsidian_epoch.record_lore_contribution",
    title: "Record lore contribution",
    description: "Record a server-authoritative confirmation, refutation or revision contribution from existing canonical event evidence. Refutations consume focus and a daily quota. This does not rewrite truth directly; it creates an auditable contribution event for categorical honors.",
    inputSchema: objectSchema({
      agentId: { type: "string" },
      category: { type: "string", enum: ["confirmation", "refutation", "revision"] },
      revisionMode: { type: "string", enum: ["suggestion", "derived", "merge", "downgrade"] },
      targetId: { type: "string" },
      summary: { type: "string" },
      revisedClaimText: { type: "string" },
      originalClaimExplorerId: { type: "string" },
      parentClaimId: { type: "string" },
      mergeTargetIds: { type: "array", items: { type: "string" } },
      downgradeReason: { type: "string" },
      sourceEventIds: { type: "array", items: { type: "string" } },
      experimentId: { type: "string" },
      mainRuleReview: { type: "object" },
      recoveryCode: { type: "string" },
      localSecret: { type: "string" },
      idempotencyKey: { type: "string" },
    }, ["agentId", "category", "targetId", "summary", "sourceEventIds", "idempotencyKey"]),
  },
  {
    name: "obsidian_epoch.objectives",
    title: "Objectives",
    description: "Read active and settled contested objectives, optionally filtered by region.",
    inputSchema: objectSchema({
      regionId: { type: "string" },
    }),
  },
  {
    name: "obsidian_epoch.seed_objective",
    title: "Seed objective",
    description: "Operator-gated start of a server-template contested objective for a region; client cannot choose arbitrary rewards.",
    inputSchema: objectSchema({
      operatorKey: { type: "string" },
      regionId: { type: "string" },
      objectiveKey: { type: "string" },
      idempotencyKey: { type: "string" },
    }, ["operatorKey", "regionId", "idempotencyKey"]),
  },
  {
    name: "obsidian_epoch.contribute_objective",
    title: "Contribute objective",
    description: "Spend real server-tracked resources to contribute to a contested objective leaderboard.",
    inputSchema: objectSchema({
      objectiveId: { type: "string" },
      agentId: { type: "string" },
      amount: { type: "number" },
      recoveryCode: { type: "string" },
      localSecret: { type: "string" },
      idempotencyKey: { type: "string" },
    }, ["objectiveId", "agentId", "amount", "idempotencyKey"]),
  },
  {
    name: "obsidian_epoch.settle_objective",
    title: "Settle objective",
    description: "Operator-gated settlement of a contested objective through server rules.",
    inputSchema: objectSchema({
      operatorKey: { type: "string" },
      objectiveId: { type: "string" },
      idempotencyKey: { type: "string" },
    }, ["operatorKey", "objectiveId", "idempotencyKey"]),
  },
  {
    name: "obsidian_epoch.resource_nodes",
    title: "Resource nodes",
    description: "Read server-spawned regional resource nodes and their contest leaderboards.",
    inputSchema: objectSchema({
      regionId: { type: "string" },
      agentId: { type: "string" },
      status: { type: "string" },
    }),
  },
  {
    name: "obsidian_epoch.spawn_resource_node",
    title: "Spawn resource node",
    description: "Operator-gated server worker resource-node spawn from server-owned rules.",
    inputSchema: objectSchema({
      operatorKey: { type: "string" },
      regionId: { type: "string" },
      resourceId: { type: "string" },
      rewardAmount: { type: "number" },
      idempotencyKey: { type: "string" },
    }, ["operatorKey", "regionId", "idempotencyKey"]),
  },
  {
    name: "obsidian_epoch.contest_resource_node",
    title: "Contest resource node",
    description: "Spend real server-tracked stamina to compete for a resource node reward.",
    inputSchema: objectSchema({
      nodeId: { type: "string" },
      agentId: { type: "string" },
      staminaSpent: { type: "number" },
      recoveryCode: { type: "string" },
      localSecret: { type: "string" },
      idempotencyKey: { type: "string" },
    }, ["nodeId", "agentId", "staminaSpent", "idempotencyKey"]),
  },
  {
    name: "obsidian_epoch.settle_resource_node",
    title: "Settle resource node",
    description: "Operator-gated settlement of a resource node through server rules.",
    inputSchema: objectSchema({
      operatorKey: { type: "string" },
      nodeId: { type: "string" },
      idempotencyKey: { type: "string" },
    }, ["operatorKey", "nodeId", "idempotencyKey"]),
  },
  {
    name: "obsidian_epoch.anomalies",
    title: "Regional anomalies",
    description: "Read server-spawned regional anomaly chains and their focus contest leaderboards.",
    inputSchema: objectSchema({
      regionId: { type: "string" },
      agentId: { type: "string" },
      status: { type: "string" },
    }),
  },
  {
    name: "obsidian_epoch.spawn_anomaly",
    title: "Spawn anomaly",
    description: "Operator-gated server anomaly-chain spawn. Pass templateKey for server-owned boss templates; clients cannot invent rewards or status.",
    inputSchema: objectSchema({
      operatorKey: { type: "string" },
      regionId: { type: "string" },
      templateKey: { type: "string" },
      title: { type: "string" },
      severity: { type: "string" },
      targetScore: { type: "number" },
      rewardResourceId: { type: "string" },
      rewardAmount: { type: "number" },
      lifetimeRisk: { type: "number" },
      idempotencyKey: { type: "string" },
    }, ["operatorKey", "regionId", "idempotencyKey"]),
  },
  {
    name: "obsidian_epoch.contest_anomaly",
    title: "Contest anomaly",
    description: "Spend real server-tracked focus to suppress a regional anomaly chain.",
    inputSchema: objectSchema({
      anomalyId: { type: "string" },
      agentId: { type: "string" },
      focusSpent: { type: "number" },
      recoveryCode: { type: "string" },
      localSecret: { type: "string" },
      idempotencyKey: { type: "string" },
    }, ["anomalyId", "agentId", "focusSpent", "idempotencyKey"]),
  },
  {
    name: "obsidian_epoch.resolve_anomaly",
    title: "Resolve anomaly",
    description: "Operator-gated settlement of a regional anomaly chain through server rules.",
    inputSchema: objectSchema({
      operatorKey: { type: "string" },
      anomalyId: { type: "string" },
      idempotencyKey: { type: "string" },
    }, ["operatorKey", "anomalyId", "idempotencyKey"]),
  },
  {
    name: "obsidian_epoch.inventory",
    title: "Inventory",
    description: "Read server-created inventory items for an agent identity or explorer.",
    inputSchema: objectSchema({
      agentId: { type: "string" },
      explorerId: { type: "string" },
      bound: { type: "boolean" },
      tradable: { type: "boolean" },
    }),
  },
  {
    name: "obsidian_epoch.shop",
    title: "Shop",
    description: "Read server-defined shop offers. Prices and item identities are server authoritative.",
    inputSchema: objectSchema({
      regionId: { type: "string" },
    }),
  },
  {
    name: "obsidian_epoch.create_item",
    title: "Create item",
    description: "Operator-gated server creation of a canonical inventory item from existing source events.",
    inputSchema: objectSchema({
      operatorKey: { type: "string" },
      agentId: { type: "string" },
      itemKey: { type: "string" },
      displayName: { type: "string" },
      rarity: { type: "string" },
      sourceEventIds: { type: "array", items: { type: "string" } },
      idempotencyKey: { type: "string" },
    }, ["operatorKey", "agentId", "itemKey", "displayName", "sourceEventIds", "idempotencyKey"]),
  },
  {
    name: "obsidian_epoch.craft_item",
    title: "Craft item",
    description: "Owner-authorized crafting from server-ledger resources. Choose a server recipe id such as field-kit, focus-charm or training-band; item properties are server-defined.",
    inputSchema: objectSchema({
      agentId: { type: "string" },
      recipeId: { type: "string" },
      recoveryCode: { type: "string" },
      localSecret: { type: "string" },
      idempotencyKey: { type: "string" },
    }, ["agentId", "recipeId", "idempotencyKey"]),
  },
  {
    name: "obsidian_epoch.purchase_shop_offer",
    title: "Purchase shop offer",
    description: "Owner-authorized purchase from the server shop. The client supplies only offerId; price and item output are server-defined.",
    inputSchema: objectSchema({
      agentId: { type: "string" },
      offerId: { type: "string" },
      regionId: { type: "string" },
      recoveryCode: { type: "string" },
      localSecret: { type: "string" },
      idempotencyKey: { type: "string" },
    }, ["agentId", "offerId", "idempotencyKey"]),
  },
  {
    name: "obsidian_epoch.bind_item",
    title: "Bind item",
    description: "Bind a server-created item to its owning identity with owner recovery authorization.",
    inputSchema: objectSchema({
      itemId: { type: "string" },
      agentId: { type: "string" },
      reason: { type: "string" },
      recoveryCode: { type: "string" },
      localSecret: { type: "string" },
      idempotencyKey: { type: "string" },
    }, ["itemId", "agentId", "idempotencyKey"]),
  },
  {
    name: "obsidian_epoch.market",
    title: "Market",
    description: "Read open, filled, and cancelled server-settled resource or item trade orders.",
    inputSchema: objectSchema({
      agentId: { type: "string" },
      regionId: { type: "string" },
      status: { type: "string" },
    }),
  },
  {
    name: "obsidian_epoch.direct_trades",
    title: "Direct trades",
    description: "Read private server-escrowed direct trades for an agent, region, or status.",
    inputSchema: objectSchema({
      agentId: { type: "string" },
      regionId: { type: "string" },
      status: { type: "string" },
    }),
  },
  {
    name: "obsidian_epoch.create_market_order",
    title: "Create market order",
    description: "Lock seller resources or an unbound inventory item into a server-owned sell order.",
    inputSchema: objectSchema({
      sellerAgentId: { type: "string" },
      agentId: { type: "string" },
      regionId: { type: "string" },
      sellResourceId: { type: "string" },
      sellAmount: { type: "number" },
      sellItemId: { type: "string" },
      priceResourceId: { type: "string" },
      priceAmount: { type: "number" },
      recoveryCode: { type: "string" },
      localSecret: { type: "string" },
      idempotencyKey: { type: "string" },
    }, ["priceResourceId", "priceAmount", "idempotencyKey"]),
  },
  {
    name: "obsidian_epoch.fill_market_order",
    title: "Fill market order",
    description: "Buy an open order; server transfers payment and locked goods atomically.",
    inputSchema: objectSchema({
      orderId: { type: "string" },
      buyerAgentId: { type: "string" },
      agentId: { type: "string" },
      recoveryCode: { type: "string" },
      localSecret: { type: "string" },
      idempotencyKey: { type: "string" },
    }, ["orderId", "idempotencyKey"]),
  },
  {
    name: "obsidian_epoch.cancel_market_order",
    title: "Cancel market order",
    description: "Cancel an open seller order and refund the locked goods.",
    inputSchema: objectSchema({
      orderId: { type: "string" },
      sellerAgentId: { type: "string" },
      agentId: { type: "string" },
      recoveryCode: { type: "string" },
      localSecret: { type: "string" },
      idempotencyKey: { type: "string" },
    }, ["orderId", "idempotencyKey"]),
  },
  {
    name: "obsidian_epoch.create_direct_trade",
    title: "Create direct trade",
    description: "Lock proposer resources or an unbound inventory item into a private server-escrowed trade.",
    inputSchema: objectSchema({
      proposerAgentId: { type: "string" },
      agentId: { type: "string" },
      counterpartyAgentId: { type: "string" },
      regionId: { type: "string" },
      offerResourceId: { type: "string" },
      offerAmount: { type: "number" },
      offerItemId: { type: "string" },
      requestResourceId: { type: "string" },
      requestAmount: { type: "number" },
      requestItemId: { type: "string" },
      recoveryCode: { type: "string" },
      localSecret: { type: "string" },
      idempotencyKey: { type: "string" },
    }, ["counterpartyAgentId", "idempotencyKey"]),
  },
  {
    name: "obsidian_epoch.accept_direct_trade",
    title: "Accept direct trade",
    description: "Accept an open direct trade; server atomically transfers requested and offered assets.",
    inputSchema: objectSchema({
      tradeId: { type: "string" },
      counterpartyAgentId: { type: "string" },
      agentId: { type: "string" },
      recoveryCode: { type: "string" },
      localSecret: { type: "string" },
      idempotencyKey: { type: "string" },
    }, ["tradeId", "idempotencyKey"]),
  },
  {
    name: "obsidian_epoch.cancel_direct_trade",
    title: "Cancel direct trade",
    description: "Cancel an open direct trade and refund or unlock the proposer escrow.",
    inputSchema: objectSchema({
      tradeId: { type: "string" },
      recoveryCode: { type: "string" },
      localSecret: { type: "string" },
      idempotencyKey: { type: "string" },
    }, ["tradeId", "idempotencyKey"]),
  },
  {
    name: "obsidian_epoch.tick_market_expiry",
    title: "Tick market expiry",
    description: "Run a server-owned market expiry worker and refund stale open orders.",
    inputSchema: objectSchema({
      operatorKey: { type: "string" },
      maxAgeSeconds: { type: "number" },
      limit: { type: "number" },
      idempotencyKey: { type: "string" },
    }, ["operatorKey", "idempotencyKey"]),
  },
  {
    name: "obsidian_epoch.tick_direct_trade_expiry",
    title: "Tick direct trade expiry",
    description: "Run a server-owned direct-trade expiry worker and refund or unlock stale private escrow offers.",
    inputSchema: objectSchema({
      operatorKey: { type: "string" },
      maxAgeSeconds: { type: "number" },
      limit: { type: "number" },
      idempotencyKey: { type: "string" },
    }, ["operatorKey", "idempotencyKey"]),
  },
  {
    name: "obsidian_epoch.bounties",
    title: "Bounties",
    description: "Read server-escrowed regional bounties and their claim status.",
    inputSchema: objectSchema({
      regionId: { type: "string" },
      agentId: { type: "string" },
      status: { type: "string" },
    }),
  },
  {
    name: "obsidian_epoch.create_bounty",
    title: "Create bounty",
    description: "Lock sponsor resources into a regional bounty for another agent to claim.",
    inputSchema: objectSchema({
      sponsorAgentId: { type: "string" },
      agentId: { type: "string" },
      regionId: { type: "string" },
      title: { type: "string" },
      description: { type: "string" },
      rewardResourceId: { type: "string" },
      rewardAmount: { type: "number" },
      requiredItemKey: { type: "string" },
      recoveryCode: { type: "string" },
      localSecret: { type: "string" },
      idempotencyKey: { type: "string" },
    }, ["regionId", "title", "rewardResourceId", "rewardAmount", "idempotencyKey"]),
  },
  {
    name: "obsidian_epoch.claim_bounty",
    title: "Claim bounty",
    description: "Claim an open bounty; the server grants the escrowed reward and ignores client-declared rewards.",
    inputSchema: objectSchema({
      bountyId: { type: "string" },
      claimantAgentId: { type: "string" },
      agentId: { type: "string" },
      fulfillmentItemId: { type: "string" },
      evidence: { type: "string" },
      recoveryCode: { type: "string" },
      localSecret: { type: "string" },
      idempotencyKey: { type: "string" },
    }, ["bountyId", "idempotencyKey"]),
  },
  {
    name: "obsidian_epoch.party_runs",
    title: "Party runs",
    description: "Read server-authoritative regional party runs and member roles.",
    inputSchema: objectSchema({
      regionId: { type: "string" },
      agentId: { type: "string" },
      status: { type: "string" },
    }),
  },
  {
    name: "obsidian_epoch.create_party_run",
    title: "Create party run",
    description: "Create an owner-authorized party run. The server records the leader and can require invite tokens, optionally bound to one recipient, for joins.",
    inputSchema: objectSchema({
      leaderAgentId: { type: "string" },
      agentId: { type: "string" },
      regionId: { type: "string" },
      title: { type: "string" },
      objective: { type: "string" },
      joinPolicy: { type: "string" },
      inviteToken: { type: "string" },
      inviteTokenExpiresAt: { type: "string" },
      inviteTokenUseLimit: { type: "number" },
      inviteRecipientAgentId: { type: "string" },
      recoveryCode: { type: "string" },
      localSecret: { type: "string" },
      idempotencyKey: { type: "string" },
    }, ["leaderAgentId", "regionId", "title", "objective", "recoveryCode", "idempotencyKey"]),
  },
  {
    name: "obsidian_epoch.update_party_invite",
    title: "Update party invite",
    description: "Rotate or revoke the invite token for an open party run. Only the party leader owner can update invites; invite token hashes stay private and rotated tokens can be bound to one recipient.",
    inputSchema: objectSchema({
      partyRunId: { type: "string" },
      leaderAgentId: { type: "string" },
      agentId: { type: "string" },
      inviteToken: { type: "string" },
      inviteTokenExpiresAt: { type: "string" },
      inviteTokenUseLimit: { type: "number" },
      inviteRecipientAgentId: { type: "string" },
      revoke: { type: "boolean" },
      recoveryCode: { type: "string" },
      localSecret: { type: "string" },
      idempotencyKey: { type: "string" },
    }, ["partyRunId", "leaderAgentId", "recoveryCode", "idempotencyKey"]),
  },
  {
    name: "obsidian_epoch.join_party_run",
    title: "Join party run",
    description: "Join a party run as the authorized owner of the joining active identity, with an invite token when required.",
    inputSchema: objectSchema({
      partyRunId: { type: "string" },
      agentId: { type: "string" },
      participantRole: { type: "string" },
      inviteToken: { type: "string" },
      recoveryCode: { type: "string" },
      localSecret: { type: "string" },
      idempotencyKey: { type: "string" },
    }, ["partyRunId", "agentId", "participantRole", "recoveryCode", "idempotencyKey"]),
  },
  {
    name: "obsidian_epoch.request_party_join",
    title: "Request party join",
    description: "Submit an owner-authorized pending join request for a party run. This records an approval queue entry without adding the member.",
    inputSchema: objectSchema({
      partyRunId: { type: "string" },
      agentId: { type: "string" },
      participantRole: { type: "string" },
      requestNote: { type: "string" },
      recoveryCode: { type: "string" },
      localSecret: { type: "string" },
      idempotencyKey: { type: "string" },
    }, ["partyRunId", "agentId", "participantRole", "recoveryCode", "idempotencyKey"]),
  },
  {
    name: "obsidian_epoch.resolve_party_join_request",
    title: "Resolve party join request",
    description: "Approve or reject a pending party join request as the party leader owner; approval adds the requested member.",
    inputSchema: objectSchema({
      partyRunId: { type: "string" },
      leaderAgentId: { type: "string" },
      agentId: { type: "string" },
      requestId: { type: "string" },
      resolution: { type: "string" },
      resolutionNote: { type: "string" },
      recoveryCode: { type: "string" },
      localSecret: { type: "string" },
      idempotencyKey: { type: "string" },
    }, ["partyRunId", "leaderAgentId", "requestId", "resolution", "recoveryCode", "idempotencyKey"]),
  },
  {
    name: "obsidian_epoch.settle_party_run",
    title: "Settle party run",
    description: "Operator-gated settlement of an open party run through server rules, rewards, region influence, trace and news.",
    inputSchema: objectSchema({
      operatorKey: { type: "string" },
      partyRunId: { type: "string" },
      idempotencyKey: { type: "string" },
    }, ["operatorKey", "partyRunId", "idempotencyKey"]),
  },
  {
    name: "obsidian_epoch.raids",
    title: "Raids",
    description: "Read server-settled raid and defense results.",
    inputSchema: objectSchema({
      regionId: { type: "string" },
      agentId: { type: "string" },
    }),
  },
  {
    name: "obsidian_epoch.resolve_raid",
    title: "Resolve raid",
    description: "Spend attacker stamina and let the server settle raid/defense outcome from canonical resources.",
    inputSchema: objectSchema({
      regionId: { type: "string" },
      attackerAgentId: { type: "string" },
      agentId: { type: "string" },
      defenderAgentId: { type: "string" },
      staminaSpent: { type: "number" },
      recoveryCode: { type: "string" },
      localSecret: { type: "string" },
      idempotencyKey: { type: "string" },
    }, ["regionId", "defenderAgentId", "staminaSpent", "idempotencyKey"]),
  },
  {
    name: "obsidian_epoch.resolve_retaliation",
    title: "Resolve retaliation",
    description: "Spend the opportunity owner's stamina and let the server settle an open retaliation opportunity.",
    inputSchema: objectSchema({
      retaliationId: { type: "string" },
      opportunityAgentId: { type: "string" },
      agentId: { type: "string" },
      staminaSpent: { type: "number" },
      recoveryCode: { type: "string" },
      localSecret: { type: "string" },
      idempotencyKey: { type: "string" },
    }, ["retaliationId", "staminaSpent", "idempotencyKey"]),
  },
  {
    name: "obsidian_epoch.resolve_region_revolt",
    title: "Resolve region revolt",
    description: "Owner-authorized revolt battle for a released region-control slot. Spends the rebel agent's stamina and lets the server settle control from canonical release and season-standing evidence.",
    inputSchema: objectSchema({
      regionId: { type: "string" },
      seasonId: { type: "string" },
      factionId: { type: "string" },
      agentId: { type: "string" },
      staminaSpent: { type: "number" },
      recoveryCode: { type: "string" },
      localSecret: { type: "string" },
      idempotencyKey: { type: "string" },
    }, ["regionId", "seasonId", "factionId", "agentId", "staminaSpent", "idempotencyKey"]),
  },
  {
    name: "obsidian_epoch.relationship_graph",
    title: "Relationship graph",
    description: "Read server-authoritative alliance, hostility, and reputation edges.",
    inputSchema: objectSchema({
      agentId: { type: "string" },
      kind: { type: "string" },
    }),
  },
  {
    name: "obsidian_epoch.diplomacy",
    title: "Diplomacy chains",
    description: "Read server-authoritative diplomacy proposals and responses by region, agent, or status.",
    inputSchema: objectSchema({
      regionId: { type: "string" },
      agentId: { type: "string" },
      status: { type: "string" },
    }),
  },
  {
    name: "obsidian_epoch.propose_diplomacy",
    title: "Propose diplomacy",
    description: "Spend source-agent focus to create a pending diplomacy proposal for another active identity.",
    inputSchema: objectSchema({
      regionId: { type: "string" },
      sourceAgentId: { type: "string" },
      agentId: { type: "string" },
      targetAgentId: { type: "string" },
      kind: { type: "string" },
      focusSpent: { type: "number" },
      terms: { type: "string" },
      recoveryCode: { type: "string" },
      localSecret: { type: "string" },
      idempotencyKey: { type: "string" },
    }, ["regionId", "targetAgentId", "kind", "focusSpent", "idempotencyKey"]),
  },
  {
    name: "obsidian_epoch.respond_diplomacy",
    title: "Respond diplomacy",
    description: "Accept or reject a pending diplomacy proposal as the target identity owner.",
    inputSchema: objectSchema({
      diplomacyId: { type: "string" },
      responderAgentId: { type: "string" },
      agentId: { type: "string" },
      response: { type: "string" },
      focusSpent: { type: "number" },
      note: { type: "string" },
      recoveryCode: { type: "string" },
      localSecret: { type: "string" },
      idempotencyKey: { type: "string" },
    }, ["diplomacyId", "response", "idempotencyKey"]),
  },
  {
    name: "obsidian_epoch.update_relationship",
    title: "Update relationship",
    description: "Spend source-agent focus and let the server update an alliance, hostility, or reputation edge.",
    inputSchema: objectSchema({
      sourceAgentId: { type: "string" },
      agentId: { type: "string" },
      targetAgentId: { type: "string" },
      kind: { type: "string" },
      focusSpent: { type: "number" },
      reason: { type: "string" },
      recoveryCode: { type: "string" },
      localSecret: { type: "string" },
      idempotencyKey: { type: "string" },
    }, ["targetAgentId", "kind", "focusSpent", "idempotencyKey"]),
  },
  {
    name: "obsidian_epoch.trace_conflict_templates",
    title: "Trace Conflict templates",
    description: "Read the server-owned Trace Conflict catalog, including client-selectable template keys and canonical resource costs.",
    inputSchema: objectSchema({}),
  },
  {
    name: "obsidian_epoch.deploy_trace_conflict",
    title: "Deploy Trace Conflict",
    description: "Owner-authorized deployment of a server-templated trap, rumor, false lead, or ward. Costs and effects are server-authoritative.",
    inputSchema: objectSchema({
      agentId: { type: "string" },
      templateKey: { type: "string" },
      regionId: { type: "string" },
      targetKind: { type: "string", enum: ["agent", "npc"] },
      targetId: { type: "string" },
      sourceEventIds: { type: "array", items: { type: "string" } },
      recoveryCode: { type: "string" },
      localSecret: { type: "string" },
      confirmationToken: { type: "string" },
      idempotencyKey: { type: "string" },
    }, ["agentId", "templateKey", "idempotencyKey"]),
  },
  {
    name: "obsidian_epoch.owner_trace_conflicts",
    title: "Owner Trace Conflicts",
    description: "Read an identity owner's Trace Conflict deployments, including owner-only status and source detail.",
    inputSchema: objectSchema({
      agentId: { type: "string" },
      status: { type: "string", enum: ["active", "triggered", "countered", "expired"] },
      limit: { type: "number" },
      recoveryCode: { type: "string" },
      localSecret: { type: "string" },
    }, ["agentId"]),
  },
  {
    name: "obsidian_epoch.owner_trace_conflict_memories",
    title: "Owner Trace Conflict memories",
    description: "Read the authenticated identity owner's server-recorded Trace Conflict memories.",
    inputSchema: objectSchema({
      agentId: { type: "string" },
      limit: { type: "number" },
      recoveryCode: { type: "string" },
      localSecret: { type: "string" },
    }, ["agentId"]),
  },
  {
    name: "obsidian_epoch.region_trace_conflicts",
    title: "Region Trace Conflicts",
    description: "Read the public, server-redacted Trace Conflict view for one canonical region.",
    inputSchema: objectSchema({
      regionId: { type: "string" },
      limit: { type: "number" },
    }, ["regionId"]),
  },
  {
    name: "obsidian_epoch.turn_card",
    title: "Turn card",
    description: "Create a server-issued turn card with public visible context and server-approved action option IDs.",
    inputSchema: objectSchema({
      agentId: { type: "string" },
      regionId: { type: "string" },
      prompt: { type: "string" },
      recoveryCode: { type: "string" },
      localSecret: { type: "string" },
      confirmationToken: { type: "string" },
      idempotencyKey: { type: "string" },
    }, ["agentId", "regionId", "idempotencyKey"]),
  },
  {
    name: "obsidian_epoch.resolve_turn",
    title: "Resolve turn",
    description: "Resolve one server-issued turn-card action option. Client prose cannot choose the canonical outcome.",
    inputSchema: objectSchema({
      turnCardId: { type: "string" },
      sequence: { type: "number" },
      nonce: { type: "string" },
      actionOptionId: { type: "string" },
      visibleText: { type: "string" },
      recoveryCode: { type: "string" },
      localSecret: { type: "string" },
      confirmationToken: { type: "string" },
      idempotencyKey: { type: "string" },
    }, ["turnCardId", "sequence", "nonce", "actionOptionId", "idempotencyKey"]),
  },
  {
    name: "obsidian_epoch.hosted_sessions",
    title: "Hosted sessions",
    description: "Read public redacted server-hosted play sessions. Active action option IDs are hidden until settlement.",
    inputSchema: objectSchema({
      agentId: { type: "string" },
      status: { type: "string" },
      limit: { type: "number" },
    }),
  },
  {
    name: "obsidian_epoch.hosted_watch",
    title: "Hosted watch",
    description: "Read one public hosted-session spectator page DTO without exposing active action option IDs.",
    inputSchema: objectSchema({
      sessionId: { type: "string" },
    }),
  },
  {
    name: "obsidian_epoch.start_hosted_session",
    title: "Start hosted session",
    description: "Start a server-hosted action session; the server returns canonical option IDs and outcomes.",
    inputSchema: objectSchema({
      agentId: { type: "string" },
      regionId: { type: "string" },
      mandate: { type: "string" },
      additionalInstruction: { type: "string" },
      recoveryCode: { type: "string" },
      localSecret: { type: "string" },
      idempotencyKey: { type: "string" },
    }, ["agentId", "regionId", "idempotencyKey"]),
  },
  {
    name: "obsidian_epoch.submit_hosted_action",
    title: "Submit hosted action",
    description: "Submit one server-issued action option ID; client visible text cannot choose the canonical outcome.",
    inputSchema: objectSchema({
      sessionId: { type: "string" },
      actionOptionId: { type: "string" },
      visibleText: { type: "string" },
      recoveryCode: { type: "string" },
      localSecret: { type: "string" },
      idempotencyKey: { type: "string" },
    }, ["sessionId", "actionOptionId", "idempotencyKey"]),
  },
  {
    name: "obsidian_epoch.run_server_hosted_action",
    title: "Run server-hosted action",
    description: "Operator-gated true server-hosted action lane. The server starts a hosted session, selects a legal basic option key, and records the outcome as server_hosted_agent.",
    inputSchema: objectSchema({
      operatorKey: { type: "string" },
      agentId: { type: "string" },
      regionId: { type: "string" },
      mandate: { type: "string" },
      optionKey: { type: "string" },
      visibleText: { type: "string" },
      idempotencyKey: { type: "string" },
    }, ["operatorKey", "agentId", "regionId", "idempotencyKey"]),
  },
  {
    name: "obsidian_epoch.queue_server_hosted_action",
    title: "Queue server-hosted action",
    description: "Operator-gated server-hosted job queue. The server records a pending autonomous action request without trusting player prose.",
    inputSchema: objectSchema({
      operatorKey: { type: "string" },
      agentId: { type: "string" },
      regionId: { type: "string" },
      mandate: { type: "string" },
      optionKey: { type: "string" },
      visibleText: { type: "string" },
      idempotencyKey: { type: "string" },
    }, ["operatorKey", "agentId", "regionId", "idempotencyKey"]),
  },
  {
    name: "obsidian_epoch.server_hosted_jobs",
    title: "Server-hosted jobs",
    description: "Read queued or completed server-hosted autonomous action jobs.",
    inputSchema: objectSchema({
      operatorKey: { type: "string" },
      agentId: { type: "string" },
      status: { type: "string" },
    }, ["operatorKey"]),
  },
  {
    name: "obsidian_epoch.run_server_hosted_job",
    title: "Run server-hosted job",
    description: "Operator-gated worker action. Runs a queued server-hosted job through canonical hosted session/action settlement and marks the job completed.",
    inputSchema: objectSchema({
      operatorKey: { type: "string" },
      jobId: { type: "string" },
      agentId: { type: "string" },
      visibleText: { type: "string" },
      idempotencyKey: { type: "string" },
    }, ["operatorKey", "idempotencyKey"]),
  },
  {
    name: "obsidian_epoch.web_bridge_turn",
    title: "Web bridge turn",
    description: "Create a browser copy-paste bridge turn for web LLMs; only public action option IDs are exposed.",
    inputSchema: objectSchema({
      agentId: { type: "string" },
      regionId: { type: "string" },
      mandate: { type: "string" },
      recoveryCode: { type: "string" },
      localSecret: { type: "string" },
      idempotencyKey: { type: "string" },
    }, ["agentId", "regionId", "idempotencyKey"]),
  },
  {
    name: "obsidian_epoch.submit_web_bridge_action",
    title: "Submit web bridge action",
    description: "Submit a web LLM bridge choice by server-issued action option ID; client text cannot choose the outcome.",
    inputSchema: objectSchema({
      sessionId: { type: "string" },
      actionOptionId: { type: "string" },
      visibleText: { type: "string" },
      recoveryCode: { type: "string" },
      localSecret: { type: "string" },
      idempotencyKey: { type: "string" },
    }, ["sessionId", "actionOptionId", "idempotencyKey"]),
  },
  {
    name: "obsidian_epoch.attestation_challenge",
    title: "Attestation challenge",
    description: "Issue a one-time server challenge for a configured trusted runner to sign before submitting a hosted action.",
    inputSchema: objectSchema({
      runnerId: { type: "string" },
      sessionId: { type: "string" },
      actionOptionId: { type: "string" },
      transcriptHash: { type: "string" },
      idempotencyKey: { type: "string" },
    }, ["runnerId", "sessionId", "actionOptionId", "transcriptHash", "idempotencyKey"]),
  },
  {
    name: "obsidian_epoch.submit_attested_action",
    title: "Submit attested action",
    description: "Submit a signed trusted-runner hosted action. The signature must match the server challenge.",
    inputSchema: objectSchema({
      runnerId: { type: "string" },
      challengeId: { type: "string" },
      sessionId: { type: "string" },
      actionOptionId: { type: "string" },
      transcriptHash: { type: "string" },
      signature: { type: "string" },
      visibleText: { type: "string" },
      idempotencyKey: { type: "string" },
    }, ["runnerId", "challengeId", "sessionId", "actionOptionId", "transcriptHash", "signature", "idempotencyKey"]),
  },
  {
    name: "obsidian_epoch.npc_note",
    title: "NPC note",
    description: "Submit a visible NPC note for server canonicalization.",
    inputSchema: objectSchema({
      agentId: { type: "string" },
      explorerId: { type: "string" },
      displayName: { type: "string" },
      regionId: { type: "string" },
      traits: { type: "array", items: { type: "string" } },
      sourceEventId: { type: "string" },
      recoveryCode: { type: "string" },
      localSecret: { type: "string" },
      idempotencyKey: { type: "string" },
    }, ["agentId", "displayName", "regionId", "idempotencyKey"]),
  },
  {
    name: "obsidian_epoch.submit_npc_candidate",
    title: "Submit NPC candidate",
    description: "Submit a story-created NPC candidate. The server decides whether to promote it into a canonical NPC or merge it with an existing one.",
    inputSchema: objectSchema({
      agentId: { type: "string" },
      displayName: { type: "string" },
      regionId: { type: "string" },
      traits: { type: "array", items: { type: "string" } },
      storyEvidence: { type: "string" },
      sourceEventId: { type: "string" },
      experimentId: { type: "string" },
      mainRuleReview: { type: "object" },
      recoveryCode: { type: "string" },
      localSecret: { type: "string" },
      idempotencyKey: { type: "string" },
    }, ["agentId", "displayName", "regionId", "storyEvidence", "idempotencyKey"]),
  },
  {
    name: "obsidian_epoch.review_npc_candidate",
    title: "Review NPC candidate",
    description: "Operator-gated review for a submitted NPC candidate. The server may promote it into canonical NPC state, merge it, or keep it rejected.",
    inputSchema: objectSchema({
      operatorKey: { type: "string" },
      candidateId: { type: "string" },
      resolution: { type: "string" },
      note: { type: "string" },
      idempotencyKey: { type: "string" },
    }, ["operatorKey", "candidateId", "resolution", "idempotencyKey"]),
  },
  {
    name: "obsidian_epoch.tick_npc_lifecycle",
    title: "Tick NPC lifecycle",
    description: "Run a server-owned NPC lifecycle tick for a bounded set of canonical NPCs.",
    inputSchema: objectSchema({
      operatorKey: { type: "string" },
      regionId: { type: "string" },
      limit: { type: "number" },
      idempotencyKey: { type: "string" },
    }, ["operatorKey", "idempotencyKey"]),
  },
  {
    name: "obsidian_epoch.npc_relationships",
    title: "NPC relationships",
    description: "Read server-created NPC relationship records by region or NPC.",
    inputSchema: objectSchema({
      regionId: { type: "string" },
      npcId: { type: "string" },
    }),
  },
  {
    name: "obsidian_epoch.agent_npc_bonds",
    title: "Agent NPC bonds",
    description: "Read server-authoritative long-term bonds between an identity and canonical NPCs by agent, NPC, region, or kind.",
    inputSchema: objectSchema({
      agentId: { type: "string" },
      npcId: { type: "string" },
      regionId: { type: "string" },
      kind: { type: "string" },
    }),
  },
  {
    name: "obsidian_epoch.update_agent_npc_bond",
    title: "Update agent NPC bond",
    description: "Spend identity focus to update a server-scored relationship with a canonical NPC. Client-declared scores are ignored.",
    inputSchema: objectSchema({
      agentId: { type: "string" },
      npcId: { type: "string" },
      kind: { type: "string" },
      focusSpent: { type: "number" },
      reason: { type: "string" },
      clientDeclaredScoreAfter: { type: "number" },
      recoveryCode: { type: "string" },
      localSecret: { type: "string" },
      idempotencyKey: { type: "string" },
    }, ["agentId", "npcId", "kind", "focusSpent", "idempotencyKey"]),
  },
  {
    name: "obsidian_epoch.npc_memories",
    title: "NPC memories",
    description: "Read server-created NPC memory records by region or NPC.",
    inputSchema: objectSchema({
      regionId: { type: "string" },
      npcId: { type: "string" },
    }),
  },
  {
    name: "obsidian_epoch.households",
    title: "Households",
    description: "Read server-created NPC household records by region or NPC.",
    inputSchema: objectSchema({
      regionId: { type: "string" },
      npcId: { type: "string" },
    }),
  },
  {
    name: "obsidian_epoch.organizations",
    title: "Organizations",
    description: "Read server-owned organization records, memberships, treasury balances and recent treasury ledger rows by region, organization, NPC, or agent identity.",
    inputSchema: objectSchema({
      regionId: { type: "string" },
      organizationId: { type: "string" },
      npcId: { type: "string" },
      agentId: { type: "string" },
    }),
  },
  {
    name: "obsidian_epoch.create_organization",
    title: "Create organization",
    description: "Operator-gated organization creation for regions that need an admin-seeded organization before NPC lifecycle membership exists.",
    inputSchema: objectSchema({
      operatorKey: { type: "string" },
      regionId: { type: "string" },
      displayName: { type: "string" },
      reason: { type: "string" },
      idempotencyKey: { type: "string" },
    }, ["operatorKey", "regionId", "displayName", "idempotencyKey"]),
  },
  {
    name: "obsidian_epoch.update_organization_membership",
    title: "Update organization membership",
    description: "Owner-authorized agent membership update for an existing server-owned organization.",
    inputSchema: objectSchema({
      agentId: { type: "string" },
      organizationId: { type: "string" },
      role: { type: "string" },
      status: { type: "string" },
      recoveryCode: { type: "string" },
      confirmationToken: { type: "string" },
      idempotencyKey: { type: "string" },
    }, ["agentId", "organizationId", "idempotencyKey"]),
  },
  {
    name: "obsidian_epoch.purchase_organization_upgrade",
    title: "Purchase organization upgrade",
    description: "Owner-authorized organization treasury spending. The client supplies only upgradeKey; cost and upgrade output are server-defined.",
    inputSchema: objectSchema({
      agentId: { type: "string" },
      organizationId: { type: "string" },
      upgradeKey: { type: "string" },
      recoveryCode: { type: "string" },
      localSecret: { type: "string" },
      confirmationToken: { type: "string" },
      idempotencyKey: { type: "string" },
    }, ["agentId", "organizationId", "upgradeKey", "idempotencyKey"]),
  },
  {
    name: "obsidian_epoch.contribute_organization_treasury",
    title: "Contribute organization treasury",
    description: "Owner-authorized member contribution. The server spends real member resources first, then credits the organization treasury and ledger.",
    inputSchema: objectSchema({
      agentId: { type: "string" },
      organizationId: { type: "string" },
      resourceId: { type: "string" },
      amount: { type: "number" },
      recoveryCode: { type: "string" },
      localSecret: { type: "string" },
      confirmationToken: { type: "string" },
      idempotencyKey: { type: "string" },
    }, ["agentId", "organizationId", "resourceId", "amount", "idempotencyKey"]),
  },
  {
    name: "obsidian_epoch.propose_organization_budget",
    title: "Propose organization budget",
    description: "Owner-authorized member budget proposal. The proposal does not spend treasury until a different member approves it.",
    inputSchema: objectSchema({
      agentId: { type: "string" },
      organizationId: { type: "string" },
      title: { type: "string" },
      description: { type: "string" },
      resourceId: { type: "string" },
      amount: { type: "number" },
      recoveryCode: { type: "string" },
      localSecret: { type: "string" },
      confirmationToken: { type: "string" },
      idempotencyKey: { type: "string" },
    }, ["agentId", "organizationId", "title", "resourceId", "amount", "idempotencyKey"]),
  },
  {
    name: "obsidian_epoch.resolve_organization_budget",
    title: "Resolve organization budget",
    description: "Approve or reject a proposed organization budget. Approval rechecks server treasury and spends it; rejection never spends.",
    inputSchema: objectSchema({
      agentId: { type: "string" },
      budgetId: { type: "string" },
      resolution: { type: "string" },
      note: { type: "string" },
      recoveryCode: { type: "string" },
      localSecret: { type: "string" },
      confirmationToken: { type: "string" },
      idempotencyKey: { type: "string" },
    }, ["agentId", "budgetId", "resolution", "idempotencyKey"]),
  },
  {
    name: "obsidian_epoch.organization_politics",
    title: "Organization politics",
    description: "Read server-owned organization politics records by region, organization, or NPC.",
    inputSchema: objectSchema({
      regionId: { type: "string" },
      npcId: { type: "string" },
      organizationId: { type: "string" },
    }),
  },
  {
    name: "obsidian_epoch.tick_organization_politics",
    title: "Tick organization politics",
    description: "Run an operator-authorized server-owned organization politics tick from canonical NPC organization state.",
    inputSchema: objectSchema({
      operatorKey: { type: "string" },
      regionId: { type: "string" },
      limit: { type: "number" },
      idempotencyKey: { type: "string" },
    }, ["operatorKey", "idempotencyKey"]),
  },
  {
    name: "obsidian_epoch.npc_careers",
    title: "NPC careers",
    description: "Read server-created NPC career records by region or NPC.",
    inputSchema: objectSchema({
      regionId: { type: "string" },
      npcId: { type: "string" },
    }),
  },
  {
    name: "obsidian_epoch.npc_locations",
    title: "NPC locations",
    description: "Read server-created NPC location migration records by region or NPC.",
    inputSchema: objectSchema({
      regionId: { type: "string" },
      npcId: { type: "string" },
    }),
  },
  {
    name: "obsidian_epoch.npc_assets",
    title: "NPC assets",
    description: "Read server-created NPC asset state records by region or NPC.",
    inputSchema: objectSchema({
      regionId: { type: "string" },
      npcId: { type: "string" },
    }),
  },
  {
    name: "obsidian_epoch.npc_health",
    title: "NPC health",
    description: "Read server-created NPC health state records by region or NPC.",
    inputSchema: objectSchema({
      regionId: { type: "string" },
      npcId: { type: "string" },
    }),
  },
  {
    name: "obsidian_epoch.social_hooks",
    title: "Social hooks",
    description: "Read server-created NPC social hooks by region or NPC.",
    inputSchema: objectSchema({
      regionId: { type: "string" },
      npcId: { type: "string" },
    }),
  },
  {
    name: "obsidian_epoch.seasons",
    title: "Season campaigns",
    description: "Read server-created faction season campaigns, objectives, and canonical phase events by region, faction, or status.",
    inputSchema: objectSchema({
      regionId: { type: "string" },
      factionId: { type: "string" },
      status: { type: "string" },
    }),
  },
  {
    name: "obsidian_epoch.season_archive",
    title: "Season archive",
    description: "Read one public season archive with contribution audit receipts, controls, monuments, and server-spawned seasonal encounters.",
    inputSchema: objectSchema({
      seasonId: { type: "string" },
      factionId: { type: "string" },
      agentId: { type: "string" },
      contributionLimit: { type: "number" },
      contributionOffset: { type: "number" },
    }, ["seasonId"]),
  },
  {
    name: "obsidian_epoch.seed_season",
    title: "Seed season",
    description: "Operator-gated creation of a server-template faction season campaign for a region.",
    inputSchema: objectSchema({
      operatorKey: { type: "string" },
      regionId: { type: "string" },
      seasonKey: { type: "string" },
      factionIds: { type: "array", items: { type: "string" } },
      idempotencyKey: { type: "string" },
    }, ["operatorKey", "idempotencyKey"]),
  },
  {
    name: "obsidian_epoch.contribute_season",
    title: "Contribute season",
    description: "Spend real agent resources toward a faction in a season campaign. Server-owned organization upgrades may add score-only bonuses; clients never submit bonus fields.",
    inputSchema: objectSchema({
      seasonId: { type: "string" },
      agentId: { type: "string" },
      factionId: { type: "string" },
      amount: { type: "number" },
      recoveryCode: { type: "string" },
      localSecret: { type: "string" },
      idempotencyKey: { type: "string" },
    }, ["seasonId", "agentId", "factionId", "amount", "idempotencyKey"]),
  },
  {
    name: "obsidian_epoch.settle_season",
    title: "Settle season",
    description: "Operator-gated settlement of an active faction season campaign using server standings.",
    inputSchema: objectSchema({
      operatorKey: { type: "string" },
      seasonId: { type: "string" },
      idempotencyKey: { type: "string" },
    }, ["operatorKey", "seasonId", "idempotencyKey"]),
  },
  {
    name: "obsidian_epoch.claim_region_control",
    title: "Claim region control",
    description: "Operator-gated claim of a released region-control slot from canonical same-region season standings.",
    inputSchema: objectSchema({
      operatorKey: { type: "string" },
      regionId: { type: "string" },
      seasonId: { type: "string" },
      factionId: { type: "string" },
      agentId: { type: "string" },
      idempotencyKey: { type: "string" },
    }, ["operatorKey", "regionId", "seasonId", "factionId", "idempotencyKey"]),
  },
  {
    name: "obsidian_epoch.result_page",
    title: "Result page",
    description: "Return a share-safe result-page payload for an agent identity or explorer lineage.",
    inputSchema: objectSchema({
      explorerId: { type: "string" },
      agentId: { type: "string" },
      turnCardId: { type: "string" },
      hostedSessionId: { type: "string" },
      limit: { type: "number" },
    }),
  },
  {
    name: "obsidian_epoch.create_result_page",
    title: "Create result page",
    description: "Create a server-owned public result page URL from a matching obsidian_epoch.result_page publishToken.",
    inputSchema: objectSchema({
      explorerId: { type: "string" },
      agentId: { type: "string" },
      turnCardId: { type: "string" },
      hostedSessionId: { type: "string" },
      publishToken: { type: "string" },
      limit: { type: "number" },
      idempotencyKey: { type: "string" },
    }, ["publishToken", "idempotencyKey"]),
  },
  {
    name: "obsidian_epoch.revoke_result_page",
    title: "Revoke result page",
    description: "Revoke a share-token result page after owner recovery authorization or operator approval.",
    inputSchema: objectSchema({
      pageId: { type: "string" },
      recoveryCode: { type: "string" },
      operatorKey: { type: "string" },
      reason: { type: "string" },
      idempotencyKey: { type: "string" },
    }, ["pageId", "idempotencyKey"]),
  },
  {
    name: "obsidian_epoch.delete_result_page",
    title: "Delete result page",
    description: "Classify an owner deletion request and execute the hide-body category for a result page after owner recovery authorization or operator approval, retaining only irreversible hashes, minimal audit facts and deletionRequest category guidance.",
    inputSchema: objectSchema({
      pageId: { type: "string" },
      recoveryCode: { type: "string" },
      operatorKey: { type: "string" },
      reason: { type: "string" },
      idempotencyKey: { type: "string" },
    }, ["pageId", "idempotencyKey"]),
  },
  {
    name: "obsidian_epoch.events",
    title: "Epoch events",
    description: "Read recent canonical Epoch events for debugging, audit, and agent progress display.",
    inputSchema: objectSchema({
      agentId: { type: "string" },
      eventType: { type: "string" },
      limit: { type: "number" },
    }),
  },
  {
    name: "obsidian_epoch.audit",
    title: "Epoch audit",
    description: "Read redacted high-impact canonical event audit summaries and replay links.",
    inputSchema: objectSchema({
      agentId: { type: "string" },
      eventType: { type: "string" },
      eventId: { type: "string" },
      aggregateId: { type: "string" },
      highImpactOnly: { type: "boolean" },
      riskOnly: { type: "boolean" },
      limit: { type: "number" },
    }),
  },
];

export function epochAgentWorldToolNames() {
  return AGENT_WORLD_TOOLS
    .map((tool) => tool.name)
    .filter((name) => name.startsWith("obsidian_epoch."));
}

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
  return result as McpToolResult;
}

const REJECTED_COMMAND_AUDIT_TOOLS = new Set([
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
  "obsidian_epoch.start_hosted_session",
  "obsidian_epoch.submit_hosted_action",
  "obsidian_epoch.run_server_hosted_action",
  "obsidian_epoch.queue_server_hosted_action",
  "obsidian_epoch.run_server_hosted_job",
  "obsidian_epoch.web_bridge_turn",
  "obsidian_epoch.submit_web_bridge_action",
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

export function createAgentWorldMcpRuntime(options: McpRuntimeOptions = {}): AgentWorldMcpRuntime {
  const runtime = (options.runtime ?? createAgentWorldRuntime(options)) as AgentWorldRuntime;
  const recordRejectedCommands = options.recordRejectedCommands !== false;
  const authoritativeIdentityIssuance = options.authoritativeIdentityIssuance === true;
  const worldMemorySearch = options.worldMemorySearch;
  const worldKnowledgeSearch = options.worldKnowledgeSearch;
  const assertLegacyMutationEnabled = () => {
    if (process.env.NODE_ENV === "production") throw new Error(LEGACY_MUTATION_DISABLED_ERROR);
  };
  async function startJourneyWithSampling(args: AnyRecord) {
    const requestContext = currentMcpRequestContext();
    const samplingRequested = args.decisionMode === "host_sampling";
    const baseIdempotencyKey = String(args.idempotencyKey || "").trim();
    const partialPersistence = requestContext?.persistPartial as (((toolName: string, result: unknown) => Promise<void>) & {
      readonly runMutation?: <T>(operation: () => Promise<T> | T) => Promise<T>;
    }) | undefined;
    const runStage = samplingRequested && partialPersistence?.runMutation
      ? partialPersistence.runMutation
      : async <T>(operation: () => Promise<T> | T) => operation();
    const worldWindow = await runStage(async () => {
      const result = runtime.epochReserveJourneyWorldWindow(args);
      await partialPersistence?.("obsidian_epoch.start_journey", result);
      return result;
    });
    const boundArgs = {
      ...args,
      expectedVersion: worldWindow.journey.mirrorWindow?.startExpectedVersion
        ?? worldWindow.journey.version,
    };
    const taskContext = runtime.epochJourneyTaskGenerationContext(boundArgs);
    const generatedPlanRequested = args.taskGenerationMode === "model_sampling"
      || args.taskGenerationMode === "server_fallback"
      || taskContext.generationRequested === true;
    let taskProposal: unknown;
    let taskGeneration: unknown = {
      ok: false,
      source: "task_plan_sampling",
      trust: "untrusted_client",
      fallback: !generatedPlanRequested
        ? "legacy_compatibility"
        : args.taskGenerationMode === "server_fallback"
          ? "server_fallback_requested"
          : "capability_absent",
    };
    if (generatedPlanRequested && args.taskGenerationMode !== "server_fallback" && requestContext?.sampling
      && typeof requestContext.sampling.createTaskPlanMessage === "function") {
      await requestContext.notifyProgress?.(0, "正在根据任务类型与场景地图生成完整任务路线。");
      const sampledTask = await requestContext.sampling.createTaskPlanMessage({
        systemPrompt: [
          "Generate one coherent playable quest route from the supplied task type and exact server map.",
          "The supplied mirrorWindow and worldSlice are signed historical constraints. Keep the route inside that region and interval, and do not contradict its controller, conflict phase, shortages, prices, security, unrest, or macro direction.",
          "Treat identityName as the protagonist's server-issued identity. Make the route plausible for that identity without renaming or replacing it.",
          "Use identityTraits, identityNeeds, lifeGoal, and resources to create genuine tradeoffs rather than two equivalent success buttons. A cautious, exhausted, hungry, poor, ambitious, vengeful, or curious identity should face different sensible choices.",
          "Return strict JSON only. Use only supplied object ids. Create a task graph with 4-9 main objectives, 2-4 side objectives, and one route-choice objective.",
          "Include two mutually exclusive choice routes. Each choice route must contain at least two main objectives and be selected by exactly one distinct action on the route-choice objective. If map organizations or factions are available, ground each route with factionObjectId and target that object in its selecting action.",
          "Include at least one unlock route whose unlockedByObjectiveIds names a side objective; completing that side objective must open one additional main objective. Locked and unselected route objectives are not executed or counted as required by the server.",
          "Give every objective a global integer stage and prerequisiteObjectiveIds. Every prerequisite, route selection, and side unlock must point from a lower stage to a higher stage.",
          "Every objective must contain exactly two distinct executable actions grounded in its worldObjectIds.",
          "Use at least one supplied npc, and vary which supplied cast members appear according to the objective instead of repeating one npc mechanically.",
          "Describe the achieved result with completionResult.kind (item,knowledge,world_state,service,relationship) and completionResult.returnMode (carry,report,none). Only physical items may use carry; reports, experiments, repairs, trials and relationships normally remain on site or are reported.",
          "If a supplied object has type agent, it may be involved only through an explicit action target; describe the observable cooperative or competitive effect without inventing consent, resource loss or identity changes.",
          "Risk labels are non-authoritative hints; the server recomputes risk from task semantics, scene type, action wording, and targeted map objects. Never include completion state, grade/tier, reward, hidden task, hidden condition, or claims that an action already happened.",
          "Top-level fields: title,premise,primaryObjective,successResult,completionResult,objectives,routes.",
          "CompletionResult fields: kind,returnMode,summary.",
          "Route fields: routeId,kind,title,factionObjectId(optional),objectiveIds,unlockedByObjectiveIds. Route kind is choice or unlock.",
          "Objective fields: objectiveId,kind,sequence,stage,prerequisiteObjectiveIds,title,objective,completionCriteria,sceneType,locationId,worldObjectIds,actions. Objective kind is main,side,choice.",
          "Action fields: optionKey,label,intent,risk,allowedEffectKinds,targetObjectIds,outcomeSummary,selectsRouteId(optional and allowed only on choice objectives).",
          "Allowed sceneType: livelihood,commission,world_event,discovery,health,conflict.",
          "Allowed risk: low,medium,high. Allowed effects: commission_offer,journey_progress,resource_delta,clue_created,relationship_signal,world_reference.",
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
            scenarioMapId: taskContext.scenarioMapId,
            mirrorWindow: taskContext.mirrorWindow,
            worldSlice: taskContext.worldSlice,
            availableWorldObjects: taskContext.availableWorldObjects.map((object) => ({
              id: object.id,
              type: object.type,
              label: object.label,
              tags: object.tags,
            })),
          }),
        }],
        maxTokens: 6_000,
        temperature: 0.7,
      }, {
        activeClientRequest: true,
        absoluteTimeoutMs: 90_000,
        softTimeoutMs: 60_000,
      });
      taskGeneration = sampledTask;
      if (sampledTask.ok) taskProposal = sampledTask.proposal;
    }
    const startOnce = (startArgs: AnyRecord) => runStage(async () => {
      const result = runtime.epochStartJourneyAgentNative(startArgs);
      await partialPersistence?.("obsidian_epoch.start_journey", result);
      return result;
    });
    let started;
    try {
      started = await startOnce({
        ...boundArgs,
        ...(taskProposal === undefined ? {} : { taskProposal }),
      });
    } catch (error: unknown) {
      const code = errorCodeForRejectedCommand(error);
      if (taskProposal === undefined || !code.startsWith("journey_task_")) throw error;
      taskGeneration = {
        ok: false,
        source: "task_plan_sampling",
        trust: "untrusted_client",
        fallback: "invalid_result",
        validationError: code,
      };
      started = await startOnce(boundArgs);
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
        nextAction: "obsidian_epoch.propose_journey_step",
      };
      attachEpochEventsForPersistence(result, [
        ...epochEventsForPersistence(worldWindow),
        ...epochEventsForPersistence(started),
      ]);
      return mergeJourneyEventsForPersistence(result, worldWindow, started);
    }

    let current: { readonly journey: typeof started.journey; readonly nextAction?: string; readonly [key: string]: unknown } = started;
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
      const actionOptions = contract.actionOptions.map((option) => ({
        actionOptionId: option.actionOptionId,
        label: option.label,
        intent: option.intent,
        risk: option.risk,
        riskTerms: option.riskTerms,
        decisionEffect: option.completionKind === "skip"
          ? contract.taskObjective?.kind === "side" ? "skip_optional_side" : "abandon_required_objective"
          : "attempt_objective",
      }));
      const progress = recordValue(runtime.epochProgress({ agentId: started.journey.agentId }));
      const identity = recordValue(progress.identity);
      const personality = recordValue(identity.personality);
      const needs = recordValue(identity.needs);
      const lifeGoal = recordValue(identity.lifeGoal);
      const resourceBalances = recordValue(progress.resources);
      const needLevels = recordValue(needs.levels);
      const strongestNeeds = Object.entries(needLevels)
        .filter((entry): entry is [string, number] => typeof entry[1] === "number" && Number.isFinite(entry[1]))
        .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
        .slice(0, 6)
        .map(([need, pressureBps]) => ({ need, pressureBps }));
      await requestContext.notifyProgress?.(
        stepIndex / Math.max(1, maxObjectiveSteps),
        `正在请求 Host 选择第 ${stepIndex + 1}/${maxObjectiveSteps} 个服务器签发行动。`,
      );
      const sampling = await requestContext.sampling.createMessage({
        systemPrompt: [
          "Choose exactly one server-issued actionOptionId as the server-issued identity, not as a quest-grade optimizer.",
          "Use the identity's traits, strongest needs, life goal, remaining resources, signed riskTerms, mandate, prior route, and current objective.",
          "Optional side objectives may be skipped when survival pressure, fatigue, resources, personality, or long-term priorities make that choice credible.",
          "Do not assume that the highest-risk option is best and do not optimize for a hidden grade.",
          "Return strict JSON with actionOptionId, rationale, confidence, and optional userFacingMessage. Do not invent completion, outcomes, rewards, hidden tasks, people, or world facts.",
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
          nextAction: "obsidian_epoch.commit_journey_action",
        };
        attachEpochEventsForPersistence(result, [
          ...epochEventsForPersistence(worldWindow),
          ...epochEventsForPersistence(started),
          ...epochEventsForPersistence(proposal),
        ]);
        return mergeJourneyEventsForPersistence(result, worldWindow, started, proposal);
      }
      samplingDecisions.push(sampling);
      const committed = await runStage(async () => {
        const result = runtime.epochCommitJourneyAction({
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
        });
        await partialPersistence?.("obsidian_epoch.commit_journey_action", result);
        return result;
      });
      committedResults.push(committed);
      current = committed;
      if (!("nextAction" in committed) || committed.nextAction !== "obsidian_epoch.propose_journey_step") break;
    }
    await requestContext.notifyProgress?.(1, "Host 行动选择已逐项校验并提交服务端结算。");
    const result = {
      ...started,
      ...current,
      ...(lastProposal ? { proposal: lastProposal.proposal } : {}),
      taskGeneration,
      sampling: lastSampling,
      samplingDecisions,
      nextAction: "obsidian_epoch.journey_status",
    };
    attachEpochEventsForPersistence(result, [
      ...epochEventsForPersistence(worldWindow),
      ...epochEventsForPersistence(started),
      ...(partialPersistence
        ? []
        : committedResults.flatMap((committed) => epochEventsForPersistence(committed))),
    ]);
    return partialPersistence
      ? mergeJourneyEventsForPersistence(result)
      : mergeJourneyEventsForPersistence(result, worldWindow, started, ...committedResults);
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
    if (existingPage?.payload?.journey?.status === "settled") {
      const existingResult = { status, finalVerification: { page: existingPage, duplicate: true } };
      attachEpochEventsForPersistence(
        existingResult,
        [
          ...(mirrorFinalization.worldSynchronization
            ? epochEventsForPersistence(mirrorFinalization.worldSynchronization)
            : []),
          ...(mirrorFinalization.worldSolidification
            ? epochEventsForPersistence(mirrorFinalization.worldSolidification)
            : []),
        ],
      );
      return mergeJourneyEventsForPersistence(existingResult, mirrorFinalization.worldCommitRecord, status);
    }
    const canonicalEventIds = [...new Set(status.episodes.flatMap((episode) => episode.settlement?.canonicalEventIds || []))];
    const latestSettlement = status.episodes.map((episode) => episode.settlement).filter(Boolean).at(-1);
    const journeyReward = status.taskAdjudication?.reward ?? latestSettlement?.reward;
    const journeyRewardBundle = status.taskAdjudication?.rewardBundle;
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
      },
    };
    const draft = runtime.epochResultPage(pageInput);
    const finalVerification = runtime.epochCreateResultPage({
      ...pageInput,
      publishToken: draft.publishToken,
      idempotencyKey: `${status.journey.journeyId}:final-verification`,
    });
    const linked = runtime.epochLinkJourneyVerification({
      ...args,
      journeyId: status.journey.journeyId,
      expectedVersion: status.journey.version,
      pageId: finalVerification.page.pageId,
      urlPath: finalVerification.page.urlPath,
      createdAt: finalVerification.page.createdAt,
      idempotencyKey: `${status.journey.journeyId}:link-final-verification`,
    });
    const linkedStatus = { ...status, ...linked, episodes: status.episodes };
    attachEpochEventsForPersistence(
      linkedStatus,
      [
        ...(mirrorFinalization.worldSynchronization
          ? epochEventsForPersistence(mirrorFinalization.worldSynchronization)
          : []),
        ...(mirrorFinalization.worldSolidification
          ? epochEventsForPersistence(mirrorFinalization.worldSolidification)
          : []),
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

  function journeyStatusWithFinalVerification(args: AnyRecord) {
    const initial = runtime.epochJourneyStatus(args);
    const finalized = ensureSettledJourneyVerification(initial, args);
    if (finalized.finalVerification) {
      const result = {
          ...finalized.status,
          finalVerification: finalized.finalVerification,
      };
      attachEpochEventsForPersistence(result, epochEventsForPersistence(finalized.status));
      return mergeJourneyEventsForPersistence(result, initial, finalized.status);
    }
    return initial;
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
    return mergeJourneyEventsForPersistence(result, briefing, ...finalizations.map((finalized) => finalized.status));
  }
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
    ["agent_world.community_react", (args) => runtime.communityReact(args)],
    ["agent_world.community_comment", (args) => runtime.communityComment(args)],
    ["agent_world.community_thread", (args) => runtime.communityThread(args)],
    ["agent_world.transparency_verify", () => runtime.transparencyVerify()],
    ["obsidian_epoch.quickstart", (args) => epochQuickstart(args)],
    ["obsidian_epoch.identity", (args) => {
      if (args.agentId && !args.explorerId) return runtime.epochIdentity(args);
      if (!authoritativeIdentityIssuance) return runtime.epochIdentity(args);
      runtime.epochVerifyExplorerAuth(args);
      return runtime.epochIdentity(serverAssignedIdentityInput(args));
    }],
    ["obsidian_epoch.rotate_recovery", (args) => runtime.epochRotateRecovery(args)],
    ["obsidian_epoch.progress", (args) => runtime.epochProgress(args)],
    ["obsidian_epoch.agent_briefing", (args) => agentBriefingWithFinalVerification(args)],
    ["obsidian_epoch.prepare_journey", (args) => runtime.epochPrepareJourney(args)],
    ["obsidian_epoch.start_journey", startJourneyWithSampling],
    ["obsidian_epoch.propose_journey_step", (args) => runtime.epochProposeJourneyStep(args)],
    ["obsidian_epoch.commit_journey_action", (args) => runtime.epochCommitJourneyAction(args)],
    ["obsidian_epoch.journey_status", (args) => journeyStatusWithFinalVerification(args)],
    ["obsidian_epoch.recall_journey", (args) => runtime.epochRecallJourney(args)],
    ["obsidian_epoch.journey_album", (args) => runtime.epochJourneyAlbum(args)],
    ["obsidian_epoch.agent_memory", (args) => runtime.epochAgentMemory(args)],
    ["obsidian_epoch.personal_migration_summary", (args) => runtime.epochPersonalMigrationSummary(args)],
    ["obsidian_epoch.confirm_personality_drift", (args) => runtime.epochConfirmPersonalityDrift(args)],
    ["obsidian_epoch.abuse_status", (args) => runtime.epochAbuseStatus(args)],
    ["obsidian_epoch.abuse_profiles", (args) => runtime.epochAbuseProfiles(args)],
    ["obsidian_epoch.operator_overview", (args) => runtime.epochOperatorOverview(args)],
    ["obsidian_epoch.run_maintenance", (args) => runtime.epochRunMaintenance(args)],
    ["obsidian_epoch.archive_identity", (args) => runtime.epochArchiveIdentity(args)],
    ["obsidian_epoch.reincarnate", (args) => runtime.epochReincarnate(args)],
    ["obsidian_epoch.identity_archive", (args) => runtime.epochIdentityArchive(args)],
    ["obsidian_epoch.explorer_profile", (args) => runtime.epochExplorerProfile(args)],
    ["obsidian_epoch.player_data_export", (args) => runtime.epochPlayerDataExport(args)],
    ["obsidian_epoch.change_agent_custody", (args) => runtime.epochChangeAgentCustody(args)],
    ["obsidian_epoch.competitive_ladder", (args) => runtime.epochCompetitiveLadder(args)],
    ["obsidian_epoch.world_overview", (args) => runtime.epochWorldOverview(args)],
    ["obsidian_epoch.world_clock", (args) => runtime.epochWorldClock(args)],
    ["obsidian_epoch.world_state", (args) => runtime.epochWorldState(args)],
    ["obsidian_epoch.world_content", (args) => runtime.epochWorldContent(args)],
    ["obsidian_epoch.world_knowledge", async (args) => {
      if (!worldKnowledgeSearch) throw new Error("world_knowledge_unavailable");
      return worldKnowledgeSearch(args);
    }],
    ["obsidian_epoch.world_memory", async (args) => {
      if (!worldMemorySearch) throw new Error("world_memory_unavailable");
      return worldMemorySearch(args);
    }],
    ["obsidian_epoch.advance_world_clock", (args) => runtime.epochAdvanceWorldClock(args)],
    ["obsidian_epoch.migrate_world_content", (args) => runtime.epochMigrateWorldContent(args)],
    ["obsidian_epoch.lore_contributions", (args) => runtime.epochLoreContributions(args)],
    ["obsidian_epoch.lore_targets", (args) => runtime.epochLoreTargets(args)],
    ["obsidian_epoch.adjudicate_lore_target", (args) => runtime.epochAdjudicateLoreTarget(args)],
    ["obsidian_epoch.set_downtime", (args) => runtime.epochSetDowntime(args)],
    ["obsidian_epoch.claim_downtime", (args) => runtime.epochClaimDowntime(args)],
    ["obsidian_epoch.tick_downtime", (args) => runtime.epochTickDowntime(args)],
    ["obsidian_epoch.region_info", (args) => runtime.epochRegionInfo(args)],
    ["obsidian_epoch.npc_relationships", (args) => runtime.epochNpcRelationships(args)],
    ["obsidian_epoch.agent_npc_bonds", (args) => runtime.epochAgentNpcBonds(args)],
    ["obsidian_epoch.update_agent_npc_bond", (args) => runtime.epochUpdateAgentNpcBond(args)],
    ["obsidian_epoch.npc_memories", (args) => runtime.epochNpcMemories(args)],
    ["obsidian_epoch.households", (args) => runtime.epochHouseholds(args)],
    ["obsidian_epoch.organizations", (args) => runtime.epochOrganizations(args)],
    ["obsidian_epoch.create_organization", (args) => runtime.epochCreateOrganization(args)],
    ["obsidian_epoch.update_organization_membership", (args) => runtime.epochUpdateOrganizationMembership(args)],
    ["obsidian_epoch.purchase_organization_upgrade", (args) => runtime.epochPurchaseOrganizationUpgrade(args)],
    ["obsidian_epoch.contribute_organization_treasury", (args) => runtime.epochContributeOrganizationTreasury(args)],
    ["obsidian_epoch.propose_organization_budget", (args) => runtime.epochProposeOrganizationBudget(args)],
    ["obsidian_epoch.resolve_organization_budget", (args) => runtime.epochResolveOrganizationBudget(args)],
    ["obsidian_epoch.organization_politics", (args) => runtime.epochOrganizationPolitics(args)],
    ["obsidian_epoch.tick_organization_politics", (args) => runtime.epochTickOrganizationPolitics(args)],
    ["obsidian_epoch.npc_careers", (args) => runtime.epochNpcCareers(args)],
    ["obsidian_epoch.npc_locations", (args) => runtime.epochNpcLocations(args)],
    ["obsidian_epoch.npc_assets", (args) => runtime.epochNpcAssets(args)],
    ["obsidian_epoch.npc_health", (args) => runtime.epochNpcHealth(args)],
    ["obsidian_epoch.social_hooks", (args) => runtime.epochSocialHooks(args)],
    ["obsidian_epoch.seasons", (args) => runtime.epochSeasons(args)],
    ["obsidian_epoch.season_archive", (args) => runtime.epochSeasonArchive(args)],
    ["obsidian_epoch.seed_season", (args) => runtime.epochSeedSeason(args)],
    ["obsidian_epoch.contribute_season", (args) => runtime.epochContributeSeason(args)],
    ["obsidian_epoch.settle_season", (args) => runtime.epochSettleSeason(args)],
    ["obsidian_epoch.claim_region_control", (args) => runtime.epochClaimRegionControl(args)],
    ["obsidian_epoch.messages", (args) => runtime.epochMessages(args)],
    ["obsidian_epoch.moderation_queue", (args) => runtime.epochModerationQueue(args)],
    ["obsidian_epoch.resolve_moderation", (args) => runtime.epochResolveModeration(args)],
    ["obsidian_epoch.record_risk_review", (args) => runtime.epochRecordRiskReview(args)],
    ["obsidian_epoch.release_market_risk_restriction", (args) => runtime.epochReleaseMarketRiskRestriction(args)],
    ["obsidian_epoch.release_abuse_restriction", (args) => runtime.epochReleaseAbuseRestriction(args)],
    ["obsidian_epoch.request_confirmation", (args) => runtime.epochRequestConfirmation(args)],
    ["obsidian_epoch.post_message", (args) => runtime.epochPostMessage(args)],
    ["obsidian_epoch.generate_region_news", (args) => runtime.epochGenerateRegionNews(args)],
    ["obsidian_epoch.claim_news_legend", (args) => runtime.epochClaimNewsLegend(args)],
    ["obsidian_epoch.record_lore_contribution", (args) => runtime.epochRecordLoreContribution(args)],
    ["obsidian_epoch.objectives", (args) => runtime.epochObjectives(args)],
    ["obsidian_epoch.seed_objective", (args) => runtime.epochSeedObjective(args)],
    ["obsidian_epoch.contribute_objective", (args) => runtime.epochContributeObjective(args)],
    ["obsidian_epoch.settle_objective", (args) => runtime.epochSettleObjective(args)],
    ["obsidian_epoch.resource_nodes", (args) => runtime.epochResourceNodes(args)],
    ["obsidian_epoch.spawn_resource_node", (args) => runtime.epochSpawnResourceNode(args)],
    ["obsidian_epoch.contest_resource_node", (args) => runtime.epochContestResourceNode(args)],
    ["obsidian_epoch.settle_resource_node", (args) => runtime.epochSettleResourceNode(args)],
    ["obsidian_epoch.anomalies", (args) => runtime.epochAnomalies(args)],
    ["obsidian_epoch.spawn_anomaly", (args) => runtime.epochSpawnAnomaly(args)],
    ["obsidian_epoch.contest_anomaly", (args) => runtime.epochContestAnomaly(args)],
    ["obsidian_epoch.resolve_anomaly", (args) => runtime.epochResolveAnomaly(args)],
    ["obsidian_epoch.inventory", (args) => runtime.epochInventory(args)],
    ["obsidian_epoch.shop", (args) => runtime.epochShop(args)],
    ["obsidian_epoch.create_item", (args) => runtime.epochCreateItem(args)],
    ["obsidian_epoch.craft_item", (args) => runtime.epochCraftItem(args)],
    ["obsidian_epoch.purchase_shop_offer", (args) => runtime.epochPurchaseShopOffer(args)],
    ["obsidian_epoch.bind_item", (args) => runtime.epochBindItem(args)],
    ["obsidian_epoch.market", (args) => runtime.epochMarket(args)],
    ["obsidian_epoch.direct_trades", (args) => runtime.epochDirectTrades(args)],
    ["obsidian_epoch.create_market_order", (args) => runtime.epochCreateMarketOrder(args)],
    ["obsidian_epoch.fill_market_order", (args) => runtime.epochFillMarketOrder(args)],
    ["obsidian_epoch.cancel_market_order", (args) => runtime.epochCancelMarketOrder(args)],
    ["obsidian_epoch.create_direct_trade", (args) => runtime.epochCreateDirectTrade(args)],
    ["obsidian_epoch.accept_direct_trade", (args) => runtime.epochAcceptDirectTrade(args)],
    ["obsidian_epoch.cancel_direct_trade", (args) => runtime.epochCancelDirectTrade(args)],
    ["obsidian_epoch.tick_market_expiry", (args) => runtime.epochTickMarketExpiry(args)],
    ["obsidian_epoch.tick_direct_trade_expiry", (args) => runtime.epochTickDirectTradeExpiry(args)],
    ["obsidian_epoch.bounties", (args) => runtime.epochBounties(args)],
    ["obsidian_epoch.create_bounty", (args) => runtime.epochCreateBounty(args)],
    ["obsidian_epoch.claim_bounty", (args) => runtime.epochClaimBounty(args)],
    ["obsidian_epoch.party_runs", (args) => runtime.epochPartyRuns(args)],
    ["obsidian_epoch.create_party_run", (args) => runtime.epochCreatePartyRun(args)],
    ["obsidian_epoch.update_party_invite", (args) => runtime.epochUpdatePartyInvite(args)],
    ["obsidian_epoch.join_party_run", (args) => runtime.epochJoinPartyRun(args)],
    ["obsidian_epoch.request_party_join", (args) => runtime.epochRequestPartyJoin(args)],
    ["obsidian_epoch.resolve_party_join_request", (args) => runtime.epochResolvePartyJoinRequest(args)],
    ["obsidian_epoch.settle_party_run", (args) => runtime.epochSettlePartyRun(args)],
    ["obsidian_epoch.raids", (args) => runtime.epochRaids(args)],
    ["obsidian_epoch.resolve_raid", (args) => runtime.epochResolveRaid(args)],
    ["obsidian_epoch.resolve_region_revolt", (args) => runtime.epochResolveRegionRevolt(args)],
    ["obsidian_epoch.resolve_retaliation", (args) => runtime.epochResolveRetaliation(args)],
    ["obsidian_epoch.relationship_graph", (args) => runtime.epochRelationships(args)],
    ["obsidian_epoch.diplomacy", (args) => runtime.epochDiplomacy(args)],
    ["obsidian_epoch.propose_diplomacy", (args) => runtime.epochProposeDiplomacy(args)],
    ["obsidian_epoch.respond_diplomacy", (args) => runtime.epochRespondDiplomacy(args)],
    ["obsidian_epoch.update_relationship", (args) => runtime.epochUpdateRelationship(args)],
    ["obsidian_epoch.trace_conflict_templates", (args) => runtime.epochTraceConflictTemplates(args)],
    ["obsidian_epoch.deploy_trace_conflict", (args) => runtime.epochDeployTraceConflict(args)],
    ["obsidian_epoch.owner_trace_conflicts", (args) => runtime.epochOwnerTraceConflicts(args)],
    ["obsidian_epoch.owner_trace_conflict_memories", (args) => runtime.epochOwnerTraceConflictMemories(args)],
    ["obsidian_epoch.region_trace_conflicts", (args) => runtime.epochRegionTraceConflicts(args)],
    ["obsidian_epoch.turn_card", (args) => runtime.epochTurnCard(args)],
    ["obsidian_epoch.resolve_turn", (args) => runtime.epochResolveTurn(args)],
    ["obsidian_epoch.hosted_sessions", (args) => runtime.epochHostedSessions(args)],
    ["obsidian_epoch.hosted_watch", (args) => runtime.epochHostedSessionWatch(args)],
    ["obsidian_epoch.start_hosted_session", (args) => runtime.epochStartHostedSession(args)],
    ["obsidian_epoch.submit_hosted_action", (args) => runtime.epochSubmitHostedAction(args)],
    ["obsidian_epoch.run_server_hosted_action", (args) => runtime.epochRunServerHostedAction(args)],
    ["obsidian_epoch.queue_server_hosted_action", (args) => runtime.epochQueueServerHostedAction(args)],
    ["obsidian_epoch.server_hosted_jobs", (args) => runtime.epochServerHostedJobs(args)],
    ["obsidian_epoch.run_server_hosted_job", (args) => runtime.epochRunServerHostedJob(args)],
    ["obsidian_epoch.web_bridge_turn", (args) => runtime.epochWebBridgeTurn(args)],
    ["obsidian_epoch.submit_web_bridge_action", (args) => runtime.epochSubmitWebBridgeAction(args)],
    ["obsidian_epoch.attestation_challenge", (args) => runtime.epochAttestationChallenge(args)],
    ["obsidian_epoch.submit_attested_action", (args) => runtime.epochSubmitAttestedAction(args)],
    ["obsidian_epoch.npc_note", (args) => runtime.epochNpcNote(args)],
    ["obsidian_epoch.submit_npc_candidate", (args) => runtime.epochSubmitNpcCandidate(args)],
    ["obsidian_epoch.review_npc_candidate", (args) => runtime.epochReviewNpcCandidate(args)],
    ["obsidian_epoch.tick_npc_lifecycle", (args) => runtime.epochTickNpcLifecycle(args)],
    ["obsidian_epoch.result_page", (args) => runtime.epochResultPage(args)],
    ["obsidian_epoch.create_result_page", (args) => runtime.epochCreateResultPage(args)],
    ["obsidian_epoch.revoke_result_page", (args) => runtime.epochRevokeResultPage(args)],
    ["obsidian_epoch.delete_result_page", (args) => runtime.epochDeleteResultPage(args)],
    ["obsidian_epoch.events", (args) => runtime.epochEvents(args)],
    ["obsidian_epoch.audit", (args) => runtime.epochAudit(args)],
  ]);

  return {
    protocolVersion: MCP_PROTOCOL_VERSION,
    serverInfo: MCP_SERVER_INFO,
    capabilities: { tools: {} },
    runtime,
    listTools: () => AGENT_WORLD_TOOLS.map((tool) => ({ ...tool, inputSchema: { ...tool.inputSchema } })),
    callTool: async (name: string, args: AnyRecord = {}) => {
      const handler = handlers.get(name);
      if (!handler) throw new Error(`unknown_tool:${name}`);
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

export function createAgentWorldRemoteMcpRuntime(options: {
  readonly serverBase?: string;
  readonly fetchFn?: typeof fetch;
  readonly bearerToken?: string;
} = {}): AgentWorldRemoteMcpRuntime {
  const serverBase = (options.serverBase || process.env.AGENT_WORLD_SERVER || "http://127.0.0.1:8787").replace(/\/+$/, "");
  const fetchFn = options.fetchFn || fetch;
  const bearerToken = (options.bearerToken || process.env.AGENT_WORLD_MCP_TOKEN || "").trim();
  return {
    protocolVersion: MCP_PROTOCOL_VERSION,
    serverInfo: MCP_SERVER_INFO,
    capabilities: { tools: {} },
    serverBase,
    listTools: () => AGENT_WORLD_TOOLS.map((tool) => ({ ...tool, inputSchema: { ...tool.inputSchema } })),
    callTool: async (name: string, args: AnyRecord = {}) => {
      const forwardedArgs = name === "obsidian_epoch.quickstart" ? { serverBase, ...(args || {}) } : (args || {});
      const response = await fetchFn(`${serverBase}/api/epoch/mcp/tools/call`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(bearerToken ? { authorization: `Bearer ${bearerToken}` } : {}),
        },
        body: JSON.stringify({ name, arguments: forwardedArgs }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || payload.message || `remote_mcp_request_failed_${response.status}`);
      }
      return payload;
    },
  };
}
