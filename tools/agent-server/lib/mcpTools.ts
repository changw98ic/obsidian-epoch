import { DatabaseSync } from "node:sqlite";
import { MCP_PROTOCOL_VERSION, MCP_SERVER_INFO } from "./mcpConstants.ts";
import { createAgentWorldRuntime } from "./mcpRuntimeCore.ts";

export { createAgentWorldRuntime };
import { adjudicateRun } from "./adjudicator.ts";
import {
  buildPublicWorldView,
  createCommunityLedger,
  publicCommunityMutationResult,
  type CommunityAbuseContext,
  type CommunityAbuseContextInput,
  type CommunityAbuseContextResolver,
} from "./community.ts";
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
import { createEpochRuntime, type EpochSharedResultPage } from "./epoch/runtime.ts";
import { projectEpochEvents } from "./epoch/gameCore.ts";
import { createAgentCompanionRuntime } from "./epoch/agentCompanionRuntime.ts";
import { createJourneyOfferRepository, type ReplenishStrategy } from "./epoch/journeyOfferStore.ts";
import { createJourneyOfferRuntime } from "./epoch/journeyOfferRuntime.ts";
import type { EpochEvent } from "./epoch/events.ts";
import { listMirrorConsequences } from "./epoch/journeyMirrorLedger.ts";
import type { MirrorConsequenceLedgerEntry } from "./epoch/journeySettlementRules.ts";
import {
  CANON_THRESHOLD_BPS,
  SETTLEMENT_POLICY_VERSION,
  CONSEQUENCE_SCORE_POLICY_VERSION,
} from "./epoch/journeySettlementRules.ts";
import type {
  ResultComponentInputs,
  SelfLossContribution,
  SelfLossCostKind,
  SelfLossSourceKind,
  SettlementContext,
  SettlementDecision,
} from "./epoch/journeySettlementRules.ts";
import { applySelfLossDedupRules, buildConsequenceScore } from "./epoch/journeyConsequenceScoring.ts";
import { buildJourneySettlementActionEvidence } from "./epoch/journeySelfLossRules.ts";
import { roleplayScoreFromMirrorLedger } from "./epoch/journeyMirrorConsequenceIntegration.ts";
import { deriveSettlementDecision, deriveSettlementId } from "./epoch/journeySettlementDecision.ts";
import {
  causalWorldEventFromEpochEvent,
} from "./epoch/causalEpochAdapter.ts";
import {
  createInfiniteWorldRuntime,
  type InfiniteWorldCommandV1,
} from "./epoch/infiniteWorldRuntime.ts";
import {
  causalPlayerPanel,
  causalPlayerTenRunAudit,
  type CausalPlayerIdentityReadModel,
  type CausalPlayerReadCaller,
} from "./epoch/causalPlayerReadModel.ts";
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
  expectedApproachForTask,
  type IdentityStrategyDisposition,
} from "./epoch/journeyStrategyRules.ts";
import {
  compareApproachToLifePattern,
  type ExpectedLifePattern,
} from "./epoch/journeyRoleplayRules.ts";
import {
  projectFeedbackSignals,
  type WorldFeedbackSignal,
} from "./epoch/journeyFeedbackRules.ts";
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
  normalizeJourneyCompletionTier,
  nextJourneyTaskObjective,
  deriveJourneyHiddenTask,
  journeyRewardBundleForPlan,
  type JourneyTaskEvidenceEpisode,
  type JourneyGeneratedTaskPlan,
  type JourneyHiddenTaskSeal,
  type JourneyHiddenTaskSealResolver,
} from "./epoch/journeyGeneratedTaskRules.ts";
import type { EpochJourney } from "./epoch/journeyRules.ts";
import { journeyMetricsView } from "./epoch/journeyMetricsReadModel.ts";
import {
  type JourneyRunReceipt,
} from "./epoch/journeyRunReceiptRules.ts";
import {
  buildPersistedJourneyNarrative,
  buildServerJourneyEpisodeFacts,
} from "./epoch/journeyNarrativeRules.ts";
import {
  PHASE6_MCP_CONTRACT_RULESET_VERSION,
  PHASE6_MCP_TOOL_PHASE6_RESULT,
  PHASE6_MCP_TOOL_RUN_RECEIPT,
  validatePhase6McpPhase6ResultRead,
  validatePhase6McpRunReceiptInput,
  validatePhase6McpRunReceiptRead,
  type Phase6McpErrorCode,
} from "./epoch/phase6McpContractRules.ts";
import {
  PHASE6_EXPERIMENT_MCP_CONTRACT_RULESET_VERSION,
  PHASE6_EXPERIMENT_MCP_TOOL_BEGIN_EXPERIMENT,
  PHASE6_EXPERIMENT_MCP_TOOL_BEGIN_RUN,
  PHASE6_EXPERIMENT_MCP_TOOL_SCHEMAS,
  PHASE6_EXPERIMENT_MCP_TOOL_STATUS,
  validatePhase6BeginExperimentInput,
  validatePhase6BeginRunInput,
  validatePhase6ExperimentStatusInput,
  type Phase6ExperimentMcpErrorCode,
} from "./epoch/phase6ExperimentMcpContractRules.ts";
import { createEpochResultPageReadModel } from "./epoch/resultPageReadModel.ts";
import {
  currentMcpRequestContext,
  isMcpResultAlreadyPersisted,
  markMcpResultAlreadyPersisted,
} from "./mcpRequestContext.ts";
import { currentMcpRequestAuthContext } from "./mcpRequestAuthContext.ts";
import {
  EPOCH_ACTIVE_IDENTITY_TOOL_NAMES,
  EPOCH_ARCHIVED_IDENTITY_LIFECYCLE_TOOL_NAMES,
} from "./epoch/actionEligibilityReadModel.ts";
import {
  attachEpochEventsForPersistence,
  boundedEpochTransportValue,
  epochEventsForPersistence,
  publicEpochEvent,
} from "./epoch/runtimePublicProjectionRules.ts";
import {
  attachJourneyEventsForPersistence,
  journeyEventsForPersistence,
  mergeJourneyEventsForPersistence,
} from "./epoch/journeyPersistence.ts";
import { PHASE6_ECONOMY_SNAPSHOT_VERSION } from "./epoch/phase6EconomyAuditRules.ts";
import {
  buildPhase6ProjectionDelta,
  phase6CanonicalCursor,
} from "./epoch/phase6ProjectionDeltaRules.ts";
import { phase6EventsAfterCursor } from "./epoch/phase6EventWindowRules.ts";
import { buildPhase6PanelSnapshotDocument } from "./epoch/phase6PanelSnapshotAdapter.ts";
import { buildPhase6ServerPreSettlement } from "./epoch/phase6ServerPreSettlementRules.ts";
import { buildPhase6ServerOutcomeEvidence } from "./epoch/phase6ServerOutcomeRules.ts";
import {
  PHASE6_AUTHORITATIVE_SCENARIO_MATRIX,
  PHASE6_MATRIX_VERSION,
  assertPhase6ScenarioBinding,
  phase6ScenarioForRun,
} from "./epoch/phase6ScenarioMatrixRules.ts";
import { PHASE6_RUN_INDEXES } from "./epoch/phase6ExperimentRules.ts";
import {
  attachPhase6CommittedResultForPersistence,
  createPhase6CommittedResultSqliteStore,
  type Phase6CommittedResultSqliteStore,
} from "./epoch/phase6CommittedResultStore.ts";
import { createProgressionLedger } from "./progression.ts";
import { assertPublicSafe } from "./safety.ts";
import { createTicketRegistry, hashRunPayload } from "./tickets.ts";
import { createTransparencyLedger, publicVerificationRecord } from "./transparency.ts";
import {
  serializeCompact,
  deriveDecisionEffect,
  assertPublicActionZeroBonus,
  type PublicActionOption,
} from "./epoch/journeyActionPublicSerializer.ts";

type AnyRecord = Record<string, unknown>;
type ContextSnapshotRecord = AnyRecord & {
  readonly versions: AnyRecord;
  readonly retrievalParams: AnyRecord;
  readonly filteringReasons: string[];
  readonly settingCards: AnyRecord[];
};
const LEGACY_UNSPECIFIED_REGION_ID = "legacy_region_unspecified";
export const LEGACY_MUTATION_DISABLED_ERROR = "legacy_mutation_disabled_in_production";
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
  infiniteWorld?: AnyRecord;
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
  readonly capabilities: { readonly tools: AnyRecord; readonly prompts: AnyRecord };
  readonly runtime: AgentWorldRuntime;
  readonly listTools: () => McpToolDefinition[];
  readonly callTool: (name: string, args?: AnyRecord) => Promise<McpToolResult>;
};
export type AgentWorldRemoteMcpRuntime = Omit<AgentWorldMcpRuntime, "runtime"> & {
  readonly serverBase: string;
};

// MCP_PROTOCOL_VERSION and MCP_SERVER_INFO re-exported via mcpConstants.ts
export { MCP_PROTOCOL_VERSION, MCP_SERVER_INFO } from "./mcpConstants.ts";

const EPOCH_OWNER_RECOVERY_NON_ACTIVE_IDENTITY_TOOLS = [
  "obsidian_epoch.identity",
  "obsidian_epoch.rotate_recovery",
  "obsidian_epoch.reincarnate",
  "obsidian_epoch.player_data_export",
  "obsidian_epoch.player_panel",
  "obsidian_epoch.ten_run_audit",
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
  "grantAttribute",
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
  { coreMethod: "resolveTurnCard", tools: ["obsidian_epoch.resolve_turn", "obsidian_epoch.resolve_turn_intent"] },
  { coreMethod: "startHostedSession", tools: ["obsidian_epoch.start_hosted_session", "obsidian_epoch.run_server_hosted_action", "obsidian_epoch.web_bridge_turn"] },
  { coreMethod: "submitHostedAction", tools: ["obsidian_epoch.submit_hosted_action", "obsidian_epoch.submit_hosted_intent", "obsidian_epoch.run_server_hosted_action", "obsidian_epoch.run_server_hosted_job", "obsidian_epoch.submit_web_bridge_action", "obsidian_epoch.submit_web_bridge_intent", "obsidian_epoch.submit_attested_action"] },
  { coreMethod: "queueServerHostedJob", tools: ["obsidian_epoch.queue_server_hosted_action"] },
  { coreMethod: "canRunServerHostedJobOption", tools: ["obsidian_epoch.run_server_hosted_job"] },
  { coreMethod: "transitionJourneyToGM", tools: ["obsidian_epoch.transition_to_gm"] },
  { coreMethod: "commitGMEpisode", tools: ["obsidian_epoch.journey_gm_act"] },
  { coreMethod: "settleGMJourney", tools: ["obsidian_epoch.settle_gm_journey"] },
] as const;

function isRecord(value: unknown): value is AnyRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * PR4 helper: read a finite number from an unknown value, returning the
 * fallback when the value is not a finite number. Used when reading the
 * adjudication performance components into ResultComponentInputs.
 */
function numberFrom(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/**
 * PR4 helper: map a string item rarity label from a legacy
 * {@link JourneyRewardBundle.items[number].rarity} into the numeric 0..3
 * form expected by {@link BaseRewardBundle.items[number].baseRarityTier}.
 * - 0 = no item
 * - 1 = common
 * - 2 = rare
 * - 3 = legendary
 */
function rarityTierNumeric(rarity: string | undefined | null): 0 | 1 | 2 | 3 {
  switch (rarity) {
    case "common": return 1;
    case "rare": return 2;
    case "legendary": return 3;
    default: return 0;
  }
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

type Phase6ReceiptSqliteRow = {
  readonly receipt_id: string;
  readonly journey_id: string;
  readonly receipt_json: string;
};
const PHASE6_EXPERIMENT_SCENARIO_MATRIX = PHASE6_AUTHORITATIVE_SCENARIO_MATRIX;
const PHASE6_EXPERIMENT_VERSION_BINDING = {
  rulesVersion: PHASE6_EXPERIMENT_MCP_CONTRACT_RULESET_VERSION,
  catalogVersion: "obsidian-epoch-phase6-authoritative-catalog-v0.1.0",
  codeVersion: MCP_SERVER_INFO.version,
} as const;
const phase6ExperimentExplorerBindings = new Map<string, AnyRecord>();
const phase6CommittedResultStoresByPath = new Map<string, {
  readonly db: DatabaseSync;
  readonly store: Phase6CommittedResultSqliteStore;
}>();

function phase6McpError(code: Phase6McpErrorCode): never {
  throw new Error(code);
}

function phase6McpValue<T>(
  result: { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: { readonly code: Phase6McpErrorCode } },
) {
  if (!result.ok) phase6McpError(result.error.code);
  return result.value;
}

function phase6ExperimentMcpError(code: Phase6ExperimentMcpErrorCode): never {
  throw new Error(`phase6_experiment:${code}`);
}

function phase6ExperimentMcpValue<T>(
  result: { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: { readonly code: Phase6ExperimentMcpErrorCode } },
) {
  if (!result.ok) phase6ExperimentMcpError(result.error.code);
  return result.value;
}

function phase6ExperimentRuntimeError(error: unknown): never {
  if (process.env.EPOCH_DIAG) console.error("[phase6-err]", error instanceof Error ? error.stack : error);
  const message = error instanceof Error ? error.message : "";
  if (/invalid_legacy/i.test(message)) throw new Error("phase6_experiment:invalid_legacy");
  if (/not registered|not_found/i.test(message)) phase6ExperimentMcpError("not_found");
  if (/already|conflict|changed|different|duplicate/i.test(message)) phase6ExperimentMcpError("conflict");
  phase6ExperimentMcpError("invalid_input");
}

function phase6ExperimentHash(scope: string, payload: unknown) {
  return hashRunPayload({
    scope,
    rulesetVersion: PHASE6_EXPERIMENT_MCP_CONTRACT_RULESET_VERSION,
    scenarioMatrix: PHASE6_EXPERIMENT_SCENARIO_MATRIX,
    versions: PHASE6_EXPERIMENT_VERSION_BINDING,
    payload,
  }).slice(0, 32);
}

function phase6ExperimentId(input: unknown) {
  return `phase6_exp_${phase6ExperimentHash("begin_phase6_experiment", input)}`;
}

function phase6RunSeed(input: unknown) {
  return { seed: `phase6_seed_${phase6ExperimentHash("begin_phase6_run_seed", input)}` };
}

function phase6RunReceipt(input: unknown) {
  return {
    receiptId: `phase6_run_receipt_${phase6ExperimentHash("begin_phase6_run_receipt", input)}`,
    receiptVersion: "journey_run_receipt.v2",
  };
}

function phase6JourneyBinding(input: AnyRecord) {
  const id = phase6ExperimentHash("begin_phase6_run_journey", input);
  return {
    journeyId: optionalString(input.journeyId),
    runId: `phase6_run_${id}`,
  };
}

function phase6ExperimentStartJourneyBinding(result: AnyRecord, scenarioTag?: string) {
  const versions = recordValue(result.versions);
  const scenarioMatrix = recordValue(result.scenarioMatrix);
  const seed = recordValue(result.seed);
  const runReceipt = recordValue(result.runReceipt);
  return {
    experimentId: optionalString(result.experimentId),
    runIndex: result.runIndex,
    scenarioTag: optionalString(result.scenarioTag) || scenarioTag,
    seed: optionalString(seed.seed),
    receiptId: optionalString(runReceipt.receiptId),
    receiptVersion: optionalString(runReceipt.receiptVersion),
    journeyId: optionalString(result.journeyId),
    runId: optionalString(result.runId),
    expectedVersion: Number(result.expectedVersion),
    rulesVersion: optionalString(versions.rulesVersion),
    catalogVersion: optionalString(versions.catalogVersion),
    codeVersion: optionalString(versions.codeVersion),
    scenarioMatrixId: optionalString(scenarioMatrix.id),
    scenarioMatrixVersion: optionalString(scenarioMatrix.version),
    identity: recordValue(result.identity),
    explorer: recordValue(result.explorer),
    scenarioMatrix,
    versions,
    runReceipt,
  };
}

export function phase6ExperimentExplorerForStatus(status: AnyRecord) {
  const experimentId = optionalString(status.experimentId);
  const persistedExplorer = recordValue(status.explorer);
  if (optionalString(persistedExplorer.explorerId)) return persistedExplorer;
  const explorerId = optionalString(status.explorerId);
  if (explorerId) {
    return {
      explorerId,
      ...(optionalString(status.explorerDisplayName)
        ? { displayName: optionalString(status.explorerDisplayName) }
        : {}),
    };
  }
  const boundExplorer = experimentId ? phase6ExperimentExplorerBindings.get(experimentId) : undefined;
  if (boundExplorer && optionalString(boundExplorer.explorerId)) return boundExplorer;
  throw new Error("phase6_experiment_invalid_legacy:explorer_missing");
}

export function phase6ReceiptSqlitePath(options: AnyRecord) {
  return optionalString(options.sqlitePath)
    || optionalString(recordValue(options.persistence).sqlitePath)
    || optionalString(recordValue(options.store).sqlitePath)
    || optionalString(recordValue(options.health).sqlitePath)
    || process.env.AGENT_SERVER_SQLITE_PATH;
}

function isPhase6ReceiptSqliteRow(value: unknown): value is Phase6ReceiptSqliteRow {
  return isRecord(value)
    && typeof value.receipt_id === "string"
    && typeof value.journey_id === "string"
    && typeof value.receipt_json === "string";
}

export function loadPhase6ReceiptFromSqlite(sqlitePath: string | undefined, receiptId: string) {
  if (!sqlitePath) return undefined;
  let db: DatabaseSync | undefined;
  try {
    db = new DatabaseSync(sqlitePath, { readOnly: true });
    const row = db.prepare(`
      SELECT receipt_id, journey_id, receipt_json
      FROM journey_run_receipts
      WHERE receipt_id = ?
    `).get(receiptId);
    if (!row) return undefined;
    if (!isPhase6ReceiptSqliteRow(row)) phase6McpError("invalid_receipt");
    try {
      return JSON.parse(row.receipt_json);
    } catch {
      phase6McpError("invalid_receipt");
    }
  } catch (error) {
    if (error instanceof Error && /no such table|SQLITE_CANTOPEN|SQLITE_NOTADB/.test(error.message)) {
      return undefined;
    }
    throw error;
  } finally {
    db?.close();
  }
}

export function phase6CommittedResultStoreForOptions(
  options: AnyRecord,
  epochOptions: AnyRecord,
): Phase6CommittedResultSqliteStore | undefined {
  const configured = epochOptions.phase6CommittedResultStore;
  if (configured && typeof configured === "object") {
    const store = configured as Partial<Phase6CommittedResultSqliteStore>;
    if (typeof store.append === "function" && typeof store.listByJourneyId === "function") {
      return configured as Phase6CommittedResultSqliteStore;
    }
  }
  const sqlitePath = phase6ReceiptSqlitePath(options);
  if (!sqlitePath) return undefined;
  const cached = phase6CommittedResultStoresByPath.get(sqlitePath);
  if (cached) return cached.store;
  const db = new DatabaseSync(sqlitePath);
  const store = createPhase6CommittedResultSqliteStore(db);
  phase6CommittedResultStoresByPath.set(sqlitePath, { db, store });
  return store;
}

function validatePhase6McpPageIdInput(input: unknown) {
  const value = requireObject(input, "phase6_result_input");
  const allowed = new Set(["pageId"]);
  if (Object.keys(value).some((key) => !allowed.has(key))) phase6McpError("forbidden");
  const pageId = optionalString(value.pageId);
  if (!pageId) phase6McpError("not_found");
  return { pageId };
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

// ─── PR6: Prompt narrative helpers ──────────────────────────────────────────

/**
 * STRATEGY_APPROACH_LABEL: Chinese label for each approach tag. Used only in
 * prompt narrative injection; never leaks numeric values.
 */
const APPROACH_LABEL_CN: Readonly<Record<string, string>> = Object.freeze({
  combat: "战斗",
  stealth: "潜行",
  diplomacy: "外交",
  support: "支援",
  logistics: "后勤",
  scout: "侦察",
  preservation: "保全",
});

/**
 * Build a strategy-tendency narrative string for prompt injection.
 *
 * Normal case: "你一贯擅长{primary}风格的行动"
 * No disposition: returns no strategy narrative.
 *
 * HARD CONTRACT: no numeric values (score/fitBps/affinity) are exposed.
 * Pure narrative text only.
 */
function buildStrategyPromptNarrative(
  disposition: IdentityStrategyDisposition | undefined,
): string {
  if (!disposition) return "";
  const STRATEGY_LABEL_CN: Readonly<Record<string, string>> = Object.freeze({
    combat: "战斗",
    cunning: "诡计",
    support: "支援",
    logistics: "后勤",
    exploration: "探索",
  });
  const primaryLabel = STRATEGY_LABEL_CN[disposition.primary];
  if (!primaryLabel) return "";
  const secondaryLabel = disposition.secondary
    ? STRATEGY_LABEL_CN[disposition.secondary]
    : undefined;
  // At prompt time we don't know the classification (computed at journey end).
  // Default to the "normal" narrative: primary tendency.
  const parts = [`你一贯擅长${primaryLabel}风格的行动`];
  if (secondaryLabel) {
    parts.push(`你偶尔也会运用${secondaryLabel}的手段`);
  }
  return parts.join("。");
}

/**
 * Build an expected-life-pattern narrative string for prompt injection.
 *
 * Describes expected and forbidden approaches in natural language without
 * exposing the structured ExpectedLifePattern fields or numeric values.
 *
 * HARD CONTRACT: no bps/score/tier/affinity/fit values are exposed.
 * Pure narrative text only.
 */
function buildLifePatternPromptNarrative(
  pattern: ExpectedLifePattern | undefined,
): string {
  if (!pattern) return "";
  const parts: string[] = [];
  if (pattern.expectedApproaches.length > 0) {
    const labels = pattern.expectedApproaches
      .map((tag) => APPROACH_LABEL_CN[tag])
      .filter(Boolean);
    if (labels.length > 0) {
      parts.push(`你的行动风格倾向于${labels.join("与")}`);
    }
  }
  if (pattern.forbiddenApproaches.length > 0) {
    const labels = pattern.forbiddenApproaches
      .map((tag) => APPROACH_LABEL_CN[tag])
      .filter(Boolean);
    if (labels.length > 0) {
      parts.push(`避免${labels.join("与")}类的行为`);
    }
  }
  return parts.join("，");
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

function uniqueCommunityExplorerIds(values: readonly unknown[], excludedExplorerId: string) {
  return [...new Set(values
    .map((value) => stringValue(value))
    .filter((value) => value && value !== excludedExplorerId))];
}

function communityTargetExplorerIds({
  targetType,
  targetId,
  actorExplorerId,
  loreState,
  factionState,
  submittedRuns,
  communityState,
  relationshipGraph,
}: {
  readonly targetType: string;
  readonly targetId: string;
  readonly actorExplorerId: string;
  readonly loreState: AnyRecord;
  readonly factionState: AnyRecord;
  readonly submittedRuns: readonly AnyRecord[];
  readonly communityState: AnyRecord;
  readonly relationshipGraph: AnyRecord;
}) {
  const candidateExplorerIds: unknown[] = [];
  if (targetType === "run") {
    candidateExplorerIds.push(...submittedRuns
      .filter((run) => stringValue(run.runTicket) === targetId)
      .filter((run) => run.visibility === "public"
        || run.worldImpact === "review_candidate"
        || recordValue(run.failurePublication).publicArchive === true)
      .map((run) => run.explorerId));
  }
  const claims = recordArray(loreState.claims);
  if (targetType === "claim") {
    const claim = claims.find((item) => stringValue(item.claimId) === targetId);
    candidateExplorerIds.push(...recordArray(claim?.sources).map((source) => source.explorerId));
  }
  if (targetType === "conflict") {
    const conflict = recordArray(loreState.conflicts)
      .find((item) => stringValue(item.conflictId) === targetId);
    const claimIds = Array.isArray(conflict?.claimIds) ? conflict.claimIds.map(String) : [];
    for (const claim of claims) {
      if (!claimIds.includes(stringValue(claim.claimId))) continue;
      candidateExplorerIds.push(...recordArray(claim.sources).map((source) => source.explorerId));
    }
  }
  if (targetType === "faction") {
    const faction = recordArray(factionState.factions)
      .find((item) => stringValue(item.factionId) === targetId);
    candidateExplorerIds.push(...recordArray(faction?.sources).map((source) => source.explorerId));
  }
  if (targetType === "comment") {
    const comment = recordArray(communityState.comments)
      .find((item) => stringValue(item.commentId) === targetId);
    candidateExplorerIds.push(comment?.explorerId);
  }
  for (const relationship of recordArray(relationshipGraph.relationships)) {
    if (stringValue(relationship.sourceAgentId) === targetId) candidateExplorerIds.push(relationship.sourceExplorerId);
    if (stringValue(relationship.targetAgentId) === targetId) candidateExplorerIds.push(relationship.targetExplorerId);
  }
  return uniqueCommunityExplorerIds(candidateExplorerIds, actorExplorerId);
}

function runtimeCommunityAbuseContext({
  input,
  loreState,
  factionState,
  submittedRuns,
  communityState,
  relationshipGraph,
  configuredResolver,
}: {
  readonly input: CommunityAbuseContextInput;
  readonly loreState: AnyRecord;
  readonly factionState: AnyRecord;
  readonly submittedRuns: readonly AnyRecord[];
  readonly communityState: AnyRecord;
  readonly relationshipGraph: AnyRecord;
  readonly configuredResolver?: CommunityAbuseContextResolver;
}): CommunityAbuseContext | undefined {
  const configured = configuredResolver?.(input) || {};
  const targetExplorerIds = communityTargetExplorerIds({
    targetType: input.targetType,
    targetId: input.targetId,
    actorExplorerId: input.explorerId,
    loreState,
    factionState,
    submittedRuns,
    communityState,
    relationshipGraph,
  });
  const derivedAgainstExplorerId = targetExplorerIds.length === 1
    ? targetExplorerIds[0]
    : undefined;
  if (!derivedAgainstExplorerId && !configured.againstExplorerId && !configured.groupId) return undefined;
  return {
    ...(derivedAgainstExplorerId ? { againstExplorerId: derivedAgainstExplorerId } : {}),
    ...(configured.againstExplorerId ? { againstExplorerId: configured.againstExplorerId } : {}),
    ...(configured.groupId ? { groupId: configured.groupId } : {}),
  };
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
    webConsole: `${serverBase}/epoch/web-play`,
    contentPolicy,
    frontstageStatus: resolveEpochFrontstageStatus(),
    playbookPath: "obsidian-epoch/references/one-turn-playbook.md",
    smokePlaybookPath: "obsidian-epoch/references/smoke-playbook.md",
    identityLifecycle: {
      statusField: "progress.identity.status",
      activeValue: "active",
      archivedValue: "archived",
      rule: "Only identities whose server progress identity status is active may use active gameplay tools. Archived identities cannot use active gameplay tools.",
      activeOnlyTools: EPOCH_ACTIVE_IDENTITY_TOOL_NAMES,
      activeOnlyAudit: epochActiveIdentityToolAudit(),
      archivedLifecycleTools: EPOCH_ARCHIVED_IDENTITY_LIFECYCLE_TOOL_NAMES.map((tool) => ({
        tool,
        availability: "available_when_archived",
        purpose: tool === "obsidian_epoch.identity_archive"
          ? "Returns the terminal archive, lineage and final server-authored identity state."
          : tool === "obsidian_epoch.result_page"
            ? "Returns canonical public history without creating new active play."
            : "Accepts a reincarnation request only when server lifecycle rules allow it.",
      })),
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
        step: "commit_main_intent",
        tool: "obsidian_epoch.commit_journey_intent",
        purpose: "用自然语言表达主事件行动；Intent Agent 只匹配当前服务器签发的 actionOption，Game Core 决定合法性、成败、奖励和世界变化。",
        requires: ["journeyId", "sceneId", "episodeId", "expectedVersion", "intentText", "owner authorization", "idempotencyKey"],
      },
      {
        step: "commit_main_action_signed_compatibility",
        tool: "obsidian_epoch.commit_journey_action",
        purpose: "兼容已经持有服务器签名 actionOption 的客户端；这是保留的显式路径，不是自然语言默认入口。",
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
        purpose: "Read the current identity, resources, lifetime, region context, pending decisions and server action constraints.",
      },
      {
        step: "register_first_identity_if_needed",
        tool: "obsidian_epoch.register_explorer",
        purpose: "When this published proxy has no player identity, ask the server to issue the first server-owned identity and let the proxy retain the short-lived player credential.",
        requires: ["idempotencyKey"],
        anonymousBootstrapOnly: true,
      },
      {
        step: "issue_additional_identity_if_slot_available",
        tool: "obsidian_epoch.identity",
        purpose: "Issue a server-owned additional identity only when the existing explorer has an unlocked identity slot.",
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
        step: "resolve_turn_intent",
        tool: "obsidian_epoch.resolve_turn_intent",
        purpose: "Describe the intended action in natural language; the server matches it to the current action options and Game Core settles the result.",
        requires: ["turnCardId", "sequence", "nonce", "intentText", "owner recovery authorization", "idempotencyKey"],
        requiresActiveIdentity: true,
        blockedWhen: "The turn card belongs to an archived identity or is not open.",
      },
      {
        step: "resolve_turn_signed_compatibility",
        tool: "obsidian_epoch.resolve_turn",
        purpose: "Compatibility path for clients that intentionally submit a server-issued actionOptionId and the matching card envelope.",
        requires: ["turnCardId", "sequence", "nonce", "actionOptionId", "owner recovery authorization", "idempotencyKey"],
        requiresActiveIdentity: true,
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


function causalEventsFromEpochEvents(
  events: readonly EpochEvent[],
  worldId: string,
) {
  return events.flatMap((event, index) => {
    try {
      const causalEvent = causalWorldEventFromEpochEvent(event);
      return causalEvent && causalEvent.worldId === worldId ? [causalEvent] : [];
    } catch (error) {
      if (event?.eventType === "causal_world_event_recorded") {
        const eventId = optionalString((event as unknown as AnyRecord).eventId) || "unknown";
        const cause = error instanceof Error ? error.message : String(error);
        throw new Error(
          `causal_world_event_recovery_failed:index=${index}:id=${eventId}:type=causal_world_event_recorded:cause=${cause}`,
        );
      }
      return [];
    }
  });
}

function normalizeInfiniteWorldToolCommand(input: AnyRecord, worldId: string): InfiniteWorldCommandV1 {
  const commandInput = recordValue(input.command);
  return {
    ...commandInput,
    worldId: optionalString(commandInput.worldId) || worldId,
  } as unknown as InfiniteWorldCommandV1;
}

function assertInfiniteWorldOwnerOrOperator(
  input: AnyRecord,
  epochRuntime: {
    operatorOverview: (input: AnyRecord) => unknown;
    progress: (input: AnyRecord) => unknown;
    playerDataExport: (input: AnyRecord) => unknown;
  },
) {
  if (optionalString(input.operatorKey)) {
    epochRuntime.operatorOverview({ operatorKey: input.operatorKey, limit: 1 });
    return;
  }
  const command = recordValue(input.command);
  const actor = recordValue(command.actor);
  const recoveryCode = optionalString(input.recoveryCode);
  const actorId = optionalString(actor.actorId);
  if (actor.actorType === "player_identity" && actorId && recoveryCode) {
    const progress = recordValue(epochRuntime.progress({ agentId: actorId }));
    const identity = recordValue(progress.identity);
    const explorerId = optionalString(identity.explorerId);
    if (!explorerId) throw new Error("infinite_world_owner_identity_not_found");
    epochRuntime.playerDataExport({ explorerId, recoveryCode, limit: 1 });
    return;
  }
  throw new Error("infinite_world_owner_or_operator_auth_required");
}

function infiniteWorldReadCaller(
  input: AnyRecord,
  epochRuntime: {
    operatorOverview: (input: AnyRecord) => unknown;
    progress: (input: AnyRecord) => unknown;
    playerDataExport: (input: AnyRecord) => unknown;
    organizations: (input: AnyRecord) => unknown;
  },
): CausalPlayerReadCaller {
  const agentId = optionalString(input.agentId) || optionalString(input.identityId);
  const recoveryCode = optionalString(input.recoveryCode);
  if (optionalString(input.operatorKey)) {
    epochRuntime.operatorOverview({ operatorKey: input.operatorKey, limit: 1 });
    return {
      playerId: optionalString(input.playerId),
      identityId: optionalString(input.identityId) || agentId,
      agentId,
      explorerId: optionalString(input.explorerId),
      regionId: optionalString(input.regionId),
      organizationIds: stringArray(input.organizationIds),
      evidenceIds: stringArray(input.evidenceIds),
      accountRefs: accountRefsForIdentity(optionalString(input.identityId) || agentId),
      itemRefs: stringArray(input.itemRefs),
      legalAccess: ["public", "owner", "member", "source-bound", "operator"],
    };
  }
  if (!agentId) throw new Error("infinite_world_owner_or_operator_auth_required");
  const progress = recordValue(epochRuntime.progress({ agentId, limit: 1 }));
  const identity = recordValue(progress.identity);
  const explorerId = optionalString(identity.explorerId) || optionalString(progress.explorerId);
  if (!explorerId) throw new Error("infinite_world_owner_identity_not_found");
  const requestAuth = currentMcpRequestAuthContext();
  const playerRequestAuthorized = requestAuth?.kind === "player"
    && requestAuth.explorerId === explorerId;
  if (!playerRequestAuthorized) {
    if (!recoveryCode) throw new Error("infinite_world_owner_or_operator_auth_required");
    epochRuntime.playerDataExport({ explorerId, recoveryCode, limit: 1 });
  }
  const identityId = optionalString(input.identityId) || optionalString(identity.agentId) || agentId;
  return {
    playerId: optionalString(input.playerId) || explorerId,
    identityId,
    agentId,
    explorerId,
    regionId: optionalString(input.regionId) || optionalString(identity.regionId),
    organizationIds: activeOrganizationIdsForAgent(epochRuntime, agentId),
    evidenceIds: stringArray(input.evidenceIds),
    accountRefs: accountRefsForIdentity(identityId),
    itemRefs: stringArray(input.itemRefs),
    legalAccess: ["public", "owner", "member", "source-bound"],
  };
}

function infiniteWorldPlayerIdentity(
  caller: CausalPlayerReadCaller,
  epochRuntime: { identityArchive: (input: AnyRecord) => unknown },
): CausalPlayerIdentityReadModel {
  const requestedIdentityId = caller.identityId || caller.agentId;
  if (!requestedIdentityId) {
    return {
      explorerId: caller.explorerId,
      status: "unavailable",
      lineage: [],
      canStartJourney: false,
      reincarnationRequired: false,
      source: "caller_fallback",
    };
  }
  const archive = recordValue(epochRuntime.identityArchive({ agentId: requestedIdentityId }));
  const identity = recordValue(archive.identity);
  const status = identity.status === "active" || identity.status === "archived"
    ? identity.status
    : "unavailable";
  const lineage = uniqueStringArray(stringArray(archive.lineage));
  const generation = Number(identity.generation);
  const nextAgentId = optionalString(identity.nextAgentId);
  return {
    identityId: optionalString(identity.agentId) || requestedIdentityId,
    agentId: optionalString(identity.agentId) || requestedIdentityId,
    explorerId: optionalString(identity.explorerId) || caller.explorerId,
    status,
    ...(Number.isSafeInteger(generation) && generation > 0 ? { generation } : {}),
    ...(optionalString(identity.previousAgentId) ? { previousAgentId: optionalString(identity.previousAgentId) } : {}),
    ...(nextAgentId ? { nextAgentId } : {}),
    lineage,
    ...(lineage[0] ? { lineageRootAgentId: lineage[0] } : {}),
    canStartJourney: status === "active",
    reincarnationRequired: status === "archived" && !nextAgentId,
    source: "epoch_identity_archive",
  };
}

function activeOrganizationIdsForAgent(
  epochRuntime: { organizations: (input: AnyRecord) => unknown },
  agentId: string,
): readonly string[] {
  const view = recordValue(epochRuntime.organizations({ agentId }));
  return uniqueStringArray(recordArray(view.memberships)
    .filter((membership) => membership.status === "active")
    .map((membership) => optionalString(membership.organizationId)));
}

function accountRefsForIdentity(identityId: string | undefined): readonly string[] {
  if (!identityId) return [];
  return [
    `identity:${identityId}`,
    `identity:${identityId}:wallet`,
    `identity:${identityId}:inventory`,
    `identity:${identityId}:progression`,
    `identity:${identityId}:skill_tree`,
  ];
}

function stringArray(value: unknown): readonly string[] {
  return Array.isArray(value) ? uniqueStringArray(value.map(optionalString)) : [];
}

function uniqueStringArray(values: readonly (string | undefined)[]): readonly string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))].sort((left, right) => left.localeCompare(right));
}

const objectSchema = (properties: AnyRecord, required: string[] = []) => ({
  type: "object",
  additionalProperties: true,
  properties,
  required,
});

const REMOVED_LEGACY_AGENT_WORLD_TOOLS = new Set([
  "agent_world.context_package",
  "agent_world.context_snapshots",
  "agent_world.start_run",
  "agent_world.run_heartbeat",
  "agent_world.submit_battle_report",
  "agent_world.archive_local_report",
  "agent_world.outbox",
  "agent_world.replay_outbox",
  "agent_world.review_queue",
  "agent_world.public_world",
  "agent_world.progression_state",
  "agent_world.operation_check",
]);

export function assertLegacyAgentWorldToolRemoved(name: string) {
  if (REMOVED_LEGACY_AGENT_WORLD_TOOLS.has(name)) {
    throw new Error("legacy_agent_world_tool_removed");
  }
}

const MCP_TOOL_DEFINITIONS = [
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
    name: "obsidian_epoch.command",
    title: "Infinite world command",
    description: "Submit one canonical Infinite World command. Accepts the 15-command union under command and requires owner recovery authorization or operatorKey.",
    inputSchema: objectSchema({
      command: { type: "object" },
      recoveryCode: { type: "string" },
      operatorKey: { type: "string" },
    }, ["command"]),
  },
  {
    name: "obsidian_epoch.world_snapshot",
    title: "Infinite world snapshot",
    description: "Operator-only read of the canonical Infinite World causal snapshot and checkpoint metadata.",
    inputSchema: objectSchema({
      operatorKey: { type: "string" },
    }, ["operatorKey"]),
  },
  {
    name: "obsidian_epoch.player_panel",
    title: "Infinite world player panel",
    description: "Owner/operator read of the server-derived Infinite World player panel: resources, progression, loadout, scoped RAG, combat readiness and recent run audits.",
    inputSchema: objectSchema({
      agentId: { type: "string" },
      identityId: { type: "string" },
      explorerId: { type: "string" },
      playerId: { type: "string" },
      recoveryCode: { type: "string" },
      operatorKey: { type: "string" },
      regionId: { type: "string" },
      organizationIds: { type: "array", items: { type: "string" } },
      evidenceIds: { type: "array", items: { type: "string" } },
      itemRefs: { type: "array", items: { type: "string" } },
      ragQuery: { type: "string" },
      ragCursor: { type: "string" },
      ragLimit: { type: "number" },
      runCursor: { type: "string" },
      runLimit: { type: "number" },
    }),
  },
  {
    name: "obsidian_epoch.ten_run_audit",
    title: "Infinite world ten run audit",
    description: "Owner/operator read of an exact-ten recent-run audit with descriptive non-causal correlation only. Returns available/required when fewer than ten runs exist.",
    inputSchema: objectSchema({
      agentId: { type: "string" },
      identityId: { type: "string" },
      explorerId: { type: "string" },
      playerId: { type: "string" },
      recoveryCode: { type: "string" },
      operatorKey: { type: "string" },
      regionId: { type: "string" },
      organizationIds: { type: "array", items: { type: "string" } },
      evidenceIds: { type: "array", items: { type: "string" } },
      itemRefs: { type: "array", items: { type: "string" } },
      ragQuery: { type: "string" },
      ragCursor: { type: "string" },
      ragLimit: { type: "number" },
    }),
  },
  {
    name: "obsidian_epoch.world_health",
    title: "Infinite world health",
    description: "Read Infinite World causal runtime health including degraded projection status.",
    inputSchema: objectSchema({}),
  },
  {
    name: "obsidian_epoch.world_migrate",
    title: "Infinite world migration dry run",
    description: "Operator-only dry-run migration for Infinite World causal snapshots. Non-dry-run migration is not exposed through MCP.",
    inputSchema: objectSchema({
      operatorKey: { type: "string" },
      snapshot: { type: "object" },
      dryRun: { type: "boolean" },
    }, ["operatorKey"]),
  },
  {
    name: "agent_world.community_react",
    title: "Community reaction",
    description: "Record a player-authenticated reaction to a public claim, conflict, faction, or run. The explorer is derived from the player bearer token; supplied explorerId values are ignored.",
    inputSchema: objectSchema({
      targetType: { type: "string" },
      targetId: { type: "string" },
      reaction: { type: "string" },
    }, ["targetType", "targetId", "reaction"]),
  },
  {
    name: "agent_world.community_comment",
    title: "Community comment",
    description: "Add a player-authenticated short public discussion comment to a world object. The explorer is derived from the player bearer token; supplied explorerId values are ignored.",
    inputSchema: objectSchema({
      targetType: { type: "string" },
      targetId: { type: "string" },
      body: { type: "string" },
    }, ["targetType", "targetId", "body"]),
  },
  {
    name: "agent_world.community_flag",
    title: "Community flag",
    description: "Queue a player-authenticated moderation flag for a public world object or comment. The explorer is derived from the player bearer token; supplied explorerId values are ignored.",
    inputSchema: objectSchema({
      targetType: { type: "string" },
      targetId: { type: "string" },
      reason: { type: "string" },
      idempotencyKey: { type: "string" },
    }, ["targetType", "targetId", "reason"]),
  },
  {
    name: "agent_world.community_moderation",
    title: "Community moderation queue",
    description: "Read the player-community moderation queue. Requires the server-side operator key.",
    inputSchema: objectSchema({
      operatorKey: { type: "string" },
    }, ["operatorKey"]),
  },
  {
    name: "agent_world.community_moderate",
    title: "Resolve community moderation",
    description: "Operator-gated community moderation disposition. Resolve closes a queue item without changing the subject; hide or restore changes the public subject visibility.",
    inputSchema: objectSchema({
      operatorKey: { type: "string" },
      flagId: { type: "string" },
      action: { type: "string", enum: ["resolve", "restore", "hide"] },
      note: { type: "string" },
      idempotencyKey: { type: "string" },
    }, ["operatorKey", "flagId", "action"]),
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
    name: "obsidian_epoch.register_explorer",
    title: "Register explorer",
    description: "Register a new explorer and issue its first playable identity. Preserve the returned explorerId, recoveryCode and value.agentId for authenticated Journey calls.",
    inputSchema: objectSchema({
      idempotencyKey: { type: "string" },
    }, ["idempotencyKey"]),
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
    description: "Read the owner-authorized companion briefing: identity, current journey, returned journeys with complete server-authored story reports, pending decisions, recent episodes, server world context, and economyActions. economyActions contains server-defined costs, executable MCP calls, post-action balances, next-journey effects and execution limits; the Agent decides whether to act, and no credentials are returned.",
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
    description: "Owner-authorized mission preview. Records the requested task type and destination map; the route is generated from that map at start and is not a fixed client-authored script. When `questOfferId` is supplied, the server re-resolves every internal field (taskFamilyId/expectedApproach/worldSliceHash/taskType/scenarioMapId) from the offer store and IGNORES any client-supplied override for those fields; the public schema intentionally does NOT expose taskFamilyId/expectedApproach/worldSliceHash, and any client attempt to pass them is rejected at the input boundary. Client-supplied `destinationRegionId`/`taskType` MUST equal the offer's region/taskTypeText when both are present.",
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
      questOfferId: { type: "string", description: "Optional. When set, switches the journey into offer-driven mode and the server re-resolves all internal fields from the offer store." },
      offerHash: { type: "string", description: "Echo of `sha256:${hex}` offerHash the client read from the public snapshot; the server rejects on mismatch with the live internal offer." },
      reservationToken: { type: "string", description: "Opaque ownership token returned by `reserve_quest_offer`; the server claims the offer against it before binding the journey." },
      marketSnapshotVersion: { type: "number", description: "Market snapshot version the offer was read under; the server rejects on stale or forward snapshots." },
    }, ["agentId", "idempotencyKey"]),
  },
  {
    name: "obsidian_epoch.start_journey",
    title: "Start journey",
    description: "Owner-authorized departure into a historical mirror. Before Host generation, the server freezes an already-materialized in-game interval and place-specific macro slice, then validates and signs a route grounded in that slice; unavailable or invalid Sampling falls back to a server route seed.",
    inputSchema: objectSchema({
      journeyId: { type: "string" },
      expectedVersion: { type: "number" },
      realDurationMs: { type: "number" },
      episodeCount: { type: "number" },
      decisionMode: { type: "string", enum: ["agent_native", "host_sampling"] },
      taskGenerationMode: { type: "string", enum: ["model_sampling", "server_fallback"] },
      startJourneyBinding: { type: "object" },
      phase6StartJourneyBinding: { type: "object" },
      recoveryCode: { type: "string" },
      localSecret: { type: "string" },
      idempotencyKey: { type: "string" },
    }, ["journeyId", "expectedVersion", "idempotencyKey"]),
  },
  {
    name: "obsidian_epoch.start_journey_compact",
    title: "Start journey compact",
    description: "Owner-authorized Journey start with a bounded transport response. The server executes and persists the same authoritative start flow as start_journey.",
    inputSchema: objectSchema({
      journeyId: { type: "string" },
      expectedVersion: { type: "number" },
      realDurationMs: { type: "number" },
      episodeCount: { type: "number" },
      decisionMode: { type: "string", enum: ["agent_native", "host_sampling"] },
      taskGenerationMode: { type: "string", enum: ["model_sampling", "server_fallback"] },
      startJourneyBinding: { type: "object" },
      phase6StartJourneyBinding: { type: "object" },
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
    name: "obsidian_epoch.propose_journey_step_compact",
    title: "Propose journey step (compact external-agent transport)",
    description: "Return the same server-signed SceneContract through a bounded compact transport that keeps every commit binding and signature inline for external MCP agents.",
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
    name: "obsidian_epoch.commit_journey_action_compact",
    title: "Commit journey action (compact external-agent transport)",
    description: "Commit the same server-signed action and return a bounded authoritative version/status delta suitable for external MCP agents without changing settlement semantics.",
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
    name: "obsidian_epoch.commit_journey_intent",
    title: "Commit journey intent",
    description: "Submit a natural-language journey intention. The Intent Agent maps it only to a current server-issued action option; Game Core alone decides legality, outcome, reward and world changes. The response includes the server-authoritative next Journey version and episode.",
    inputSchema: objectSchema({
      journeyId: { type: "string" },
      sceneId: { type: "string" },
      episodeId: { type: "string" },
      expectedVersion: { type: "number" },
      intentText: { type: "string" },
      visibleText: { type: "string" },
      recoveryCode: { type: "string" },
      localSecret: { type: "string" },
      idempotencyKey: { type: "string" },
    }, ["journeyId", "sceneId", "episodeId", "expectedVersion", "intentText", "idempotencyKey"]),
  },
  {
    name: "obsidian_epoch.commit_journey_intent_compact",
    title: "Commit journey intent (compact external-agent transport)",
    description: "Submit natural-language intent and return the bounded authoritative result plus the next Journey version and episode, without exposing the internal action option ID.",
    inputSchema: objectSchema({
      journeyId: { type: "string" },
      sceneId: { type: "string" },
      episodeId: { type: "string" },
      expectedVersion: { type: "number" },
      intentText: { type: "string" },
      recoveryCode: { type: "string" },
      localSecret: { type: "string" },
      idempotencyKey: { type: "string" },
    }, ["journeyId", "sceneId", "episodeId", "expectedVersion", "intentText", "idempotencyKey"]),
  },
  {
    name: "obsidian_epoch.journey_status",
    title: "Journey status",
    description: "Read an owner-authorized mission, staged task statuses, grounded episodes and next poll time; settled missions resolve explicitly to completed or failed, include a complete grounded story report, and refresh economyActions from the post-settlement server balance.",
    inputSchema: objectSchema({
      journeyId: { type: "string" },
      recoveryCode: { type: "string" },
      localSecret: { type: "string" },
    }, ["journeyId"]),
  },
  {
    name: "obsidian_epoch.journey_status_compact",
    title: "Journey status (compact external-agent transport)",
    description: "Read the same owner-authorized journey and Phase 6 finalization through a bounded status, version, receipt, result-page and economyActions projection for external MCP agents.",
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
      startJourneyBinding: { type: "object" },
      phase6StartJourneyBinding: { type: "object" },
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
      startJourneyBinding: { type: "object" },
      phase6StartJourneyBinding: { type: "object" },
    }, ["query"]),
  },
  {
    name: "obsidian_epoch.advance_world_clock",
    title: "Synchronize world clock",
    description: "Operator-gated server-time synchronization. The server derives game time at one game day per real minute, persists a bounded catch-up tick, advances the macro world simulation and exposes crossed 60-year aggregation boundaries. Clients cannot choose elapsed time.",
    inputSchema: objectSchema({
      operatorKey: { type: "string" },
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
    description: "Read server-known messages, news, leaderboard, open commissions, settled influence changes, conflict traces with optional scoutAgentIds, raidHeat, eligibleRaidTargets, factionPressure, frontlines with side agent ids and pressure, retaliation opportunities, NPCs, NPC candidates, contested objectives, resource nodes, and seasons for a region.",
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
    description: "Owner-authorized crafting from server-ledger resources. Choose a server recipe id such as field-kit, focus-charm or training-band; item properties are server-defined. Prefer the exact execution arguments returned by owner-authorized economyActions, and always supply a fresh idempotencyKey.",
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
    description: "Owner-authorized purchase from the server shop. The client supplies only offerId; price and item output are server-defined. Prefer the exact execution arguments returned by owner-authorized economyActions, and always supply a fresh idempotencyKey.",
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
    name: "obsidian_epoch.resolve_turn_intent",
    title: "Resolve turn intent",
    description: "Submit natural-language intent for a server-issued turn card. The server matches an allowed action, then Game Core determines the formal result.",
    inputSchema: objectSchema({
      turnCardId: { type: "string" },
      sequence: { type: "number" },
      nonce: { type: "string" },
      intentText: { type: "string" },
      visibleText: { type: "string" },
      recoveryCode: { type: "string" },
      localSecret: { type: "string" },
      confirmationToken: { type: "string" },
      idempotencyKey: { type: "string" },
    }, ["turnCardId", "sequence", "nonce", "intentText", "idempotencyKey"]),
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
    name: "obsidian_epoch.submit_hosted_intent",
    title: "Submit hosted intent",
    description: "Submit a natural-language action intention. The server maps it to an allowed actionOption, while Game Core alone decides success, failure, rewards and world effects.",
    inputSchema: objectSchema({
      sessionId: { type: "string" },
      intentText: { type: "string" },
      visibleText: { type: "string" },
      recoveryCode: { type: "string" },
      localSecret: { type: "string" },
      idempotencyKey: { type: "string" },
    }, ["sessionId", "intentText", "idempotencyKey"]),
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
    name: "obsidian_epoch.submit_web_bridge_intent",
    title: "Submit web bridge intent",
    description: "Submit natural-language intent through the browser bridge; the server maps it to an allowed option and returns only the authoritative outcome summary.",
    inputSchema: objectSchema({
      sessionId: { type: "string" },
      intentText: { type: "string" },
      visibleText: { type: "string" },
      recoveryCode: { type: "string" },
      localSecret: { type: "string" },
      idempotencyKey: { type: "string" },
    }, ["sessionId", "intentText", "idempotencyKey"]),
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
  ...PHASE6_EXPERIMENT_MCP_TOOL_SCHEMAS.map((schema) => ({
    name: schema.name,
    title: schema.name.replace(/^obsidian_epoch\./, "").replace(/_/g, " "),
    description: schema.description,
    inputSchema: schema.inputSchema as unknown as AnyRecord & {
      readonly required: string[];
      readonly properties: Record<string, unknown>;
    },
    annotations: {
      readOnlyHint: schema.readonly,
      destructiveHint: !schema.readonly,
      idempotentHint: true,
      openWorldHint: false,
      phase6ExperimentContract: {
        rulesetVersion: PHASE6_EXPERIMENT_MCP_CONTRACT_RULESET_VERSION,
        errorCodes: schema.errorCodes,
      },
    },
  })),
  {
    name: PHASE6_MCP_TOOL_RUN_RECEIPT,
    title: "Phase 6 run receipt",
    description: "Public read-only lookup of a server-settled Journey run receipt from the SQLite append-only receipt store. receiptId is required; journeyId is only an optional consistency check.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        receiptId: { type: "string" },
        journeyId: { type: "string" },
      },
      required: ["receiptId"],
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: PHASE6_MCP_TOOL_PHASE6_RESULT,
    title: "Phase 6 result",
    description: "Public read-only lookup of a verified Phase 6 result sidecar by result page id. Reads only the verified sidecar and matching SQLite receipt.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        pageId: { type: "string" },
      },
      required: ["pageId"],
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: "obsidian_epoch.run_receipt_compact",
    title: "Phase 6 run receipt compact",
    description: "Bounded transport projection of a fully validated server-settled Journey run receipt. The authoritative receipt remains in the append-only SQLite store.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        receiptId: { type: "string" },
        journeyId: { type: "string" },
      },
      required: ["receiptId"],
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: "obsidian_epoch.phase6_result_compact",
    title: "Phase 6 result compact",
    description: "Bounded transport projection of a verified Phase 6 result sidecar. Validation always runs against the complete persisted receipt and result before projection.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        pageId: { type: "string" },
      },
      required: ["pageId"],
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
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

export const AGENT_WORLD_TOOLS = MCP_TOOL_DEFINITIONS
  .filter((tool) => !REMOVED_LEGACY_AGENT_WORLD_TOOLS.has(tool.name));

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

// createAgentWorldMcpRuntime extracted to mcpToolsMcpRuntime.ts
export { createAgentWorldMcpRuntime } from "./mcpToolsMcpRuntime.ts";

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
    capabilities: { tools: {}, prompts: {} },
    serverBase,
    listTools: () => AGENT_WORLD_TOOLS.map((tool) => ({ ...tool, inputSchema: { ...tool.inputSchema } })),
    callTool: async (name: string, args: AnyRecord = {}) => {
      assertLegacyAgentWorldToolRemoved(name);
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
