// mcpRuntimeCore.ts — extracted runtime initialization logic from mcpTools.ts
//
// Provides three factory functions:
//   createDomainLedgers       — all domain ledgers (tickets, lore, progression, factions, community, experience, outbox)
//   createEpochRuntimeStack   — epoch runtime + companion + world clock + simulation + journey offer runtime
//   createAgentWorldRuntime   — full agent world runtime with all tool handlers

import { DatabaseSync } from "node:sqlite";
import { MCP_PROTOCOL_VERSION, MCP_SERVER_INFO } from "./mcpConstants.ts";
import { adjudicateRun } from "./adjudicator.ts";
import {
  buildLegacyMultiAgentReservation,
  buildLegacyRunCapabilityEnvelope,
  createContextPackage,
  LEGACY_AGENT_WORLD_LOOP,
} from "./contextPackage.ts";
import { createDigest, createFeedbackEvents, createRepairTicket, createRunFeedback } from "./feedback.ts";
import { resolveEpochFrontstageStatus } from "./frontstageStatus.ts";
import { listMirrorConsequences } from "./epoch/journeyMirrorLedger.ts";
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
  type InfiniteWorldCommandV1,
} from "./epoch/infiniteWorldRuntime.ts";
import {
  causalPlayerPanel,
  causalPlayerTenRunAudit,
  type CausalPlayerIdentityReadModel,
  type CausalPlayerReadCaller,
} from "./epoch/causalPlayerReadModel.ts";
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
import type { EpochJourney } from "./epoch/journeyRules.ts";
import { journeyMetricsView } from "./epoch/journeyMetricsReadModel.ts";
import {
  type JourneyRunReceipt,
} from "./epoch/journeyRunReceiptRules.ts";
import {
  buildServerJourneyEpisodeFacts,
} from "./epoch/journeyNarrativeRules.ts";
import { createNarrativeAgent } from "./epoch/narrativeAgent.ts";
import type { ModelAdapter } from "./modelAdapter.ts";
import {
  PHASE6_MCP_CONTRACT_RULESET_VERSION,
  validatePhase6McpPhase6ResultRead,
  validatePhase6McpRunReceiptInput,
  validatePhase6McpRunReceiptRead,
  type Phase6McpErrorCode,
} from "./epoch/phase6McpContractRules.ts";
import {
  PHASE6_EXPERIMENT_MCP_CONTRACT_RULESET_VERSION,
  validatePhase6BeginExperimentInput,
  validatePhase6BeginRunInput,
  validatePhase6ExperimentStatusInput,
  type Phase6ExperimentMcpErrorCode,
} from "./epoch/phase6ExperimentMcpContractRules.ts";
import {
  currentMcpRequestContext,
  isMcpResultAlreadyPersisted,
  markMcpResultAlreadyPersisted,
} from "./mcpRequestContext.ts";
import { currentMcpRequestAuthContext } from "./mcpRequestAuthContext.ts";
import {
  EPOCH_ACTIVE_IDENTITY_TOOL_NAMES,
} from "./epoch/actionEligibilityReadModel.ts";
import {
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
import { assertPublicSafe } from "./safety.ts";
import { createTransparencyLedger, publicVerificationRecord } from "./transparency.ts";
import {
  serializeCompact,
  deriveDecisionEffect,
  assertPublicActionZeroBonus,
  type PublicActionOption,
} from "./epoch/journeyActionPublicSerializer.ts";
import {
  type ContextSnapshotRecord,
  type McpToolDefinition,
  type McpToolResult,
  EPOCH_OWNER_RECOVERY_NON_ACTIVE_IDENTITY_TOOLS,
  EPOCH_OPERATOR_TARGET_ACTIVE_IDENTITY_TOOLS,
  EPOCH_NON_RECOVERY_TARGET_ACTIVE_IDENTITY_TOOLS,
  EPOCH_CORE_ACTIVE_IDENTITY_EXCLUDED_METHODS,
  EPOCH_CORE_ACTIVE_IDENTITY_METHOD_TOOL_COVERAGE,
  REMOVED_LEGACY_AGENT_WORLD_TOOLS,
  APPROACH_LABEL_CN,
  LEGACY_RISK_ORDER,
  recordArray,
  cloneRecords,
  requireObject,
  stringValue,
  stringRecord,
  numberFrom,
  numberValue,
  nonNegativeIntegerValue,
  rarityTierNumeric,
  normalizeLegacyActionType,
  legacyRunRiskLevel,
  legacyRunOperationDimensions,
  operationDimensionsFromInput,
  operationSwitchActionValue,
  legacyPublicClaimGate,
  legacyFailurePublication,
  legacyFailureClaimPreview,
  legacyFailurePublicFields,
  legacyPublicIndexIdentityFields,
  buildStrategyPromptNarrative,
  buildLifePatternPromptNarrative,
  publicWorldView,
  uniqueCommunityExplorerIds,
  communityTargetExplorerIds,
  runtimeCommunityAbuseContext,
} from "./mcpToolsHelpers.ts";
// mcpRuntimeCore.ts — extracted runtime initialization logic from mcpTools.ts
//
// Provides two factory functions:
//   createDomainLedgers     — all domain ledgers (tickets, lore, progression, factions, community, experience, outbox)
//   createEpochRuntimeStack — epoch runtime + companion + world clock + simulation + journey offer runtime

import {
  buildPublicWorldView,
  createCommunityLedger,
  publicCommunityMutationResult,
  type CommunityAbuseContext,
  type CommunityAbuseContextInput,
  type CommunityAbuseContextResolver,
} from "./community.ts";
import { createExperienceLedger, ratingRevealFor, settlementEffectFor } from "./experience.ts";
import { createFactionLedger } from "./factions.ts";
import { createLoreLedger } from "./lore.ts";
import { createEpochOperationSwitchRegistry, type EpochOperationGateInput } from "./operationSwitches.ts";
import { createLegacyOutboxLedger, graphSyncFromOutboxEntries, type LegacyOutboxCreateInput } from "./outbox.ts";
import {
  createEpochRuntime,
  publicIntentCommandResult,
  type EpochSharedResultPage,
} from "./epoch/runtime.ts";
import { projectEpochEvents } from "./epoch/gameCore.ts";
import { createAgentCompanionRuntime } from "./epoch/agentCompanionRuntime.ts";
import { createJourneyOfferRepository, type ReplenishStrategy } from "./epoch/journeyOfferStore.ts";
import { createJourneyOfferRuntime } from "./epoch/journeyOfferRuntime.ts";
import type { EpochEvent } from "./epoch/events.ts";
import type { MirrorConsequenceLedgerEntry } from "./epoch/journeySettlementRules.ts";
import {
  createInfiniteWorldRuntime,
} from "./epoch/infiniteWorldRuntime.ts";
import {
  createEpochWorldClockRuntime,
  type CreateEpochWorldClockRuntimeOptions,
  type EpochWorldClockState,
} from "./epoch/worldClockRules.ts";
import {
  createEpochWorldSimulationRuntime,
  worldSimulationHistoricalSlice,
  worldSimulationView,
  type CreateEpochWorldSimulationRuntimeOptions,
  type EpochWorldConflictEvidence,
  type EpochWorldSimulationFlowSummary,
  type EpochWorldSimulationRegionSignal,
  type EpochWorldSimulationSnapshot,
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
  normalizeJourneyCompletionTier,
  nextJourneyTaskObjective,
  deriveJourneyHiddenTask,
  journeyRewardBundleForPlan,
  type JourneyTaskEvidenceEpisode,
  type JourneyGeneratedTaskPlan,
  type JourneyHiddenTaskSeal,
  type JourneyHiddenTaskSealResolver,
} from "./epoch/journeyGeneratedTaskRules.ts";
import { createProgressionLedger } from "./progression.ts";
import { createTicketRegistry, hashRunPayload } from "./tickets.ts";
import { createEpochResultPageReadModel } from "./epoch/resultPageReadModel.ts";
import {
  attachEpochEventsForPersistence,
} from "./epoch/runtimePublicProjectionRules.ts";
import {
  causalWorldEventFromEpochEvent,
} from "./epoch/causalEpochAdapter.ts";
import {
  type RuntimeOptions,
  recordValue,
  optionalString,
  positiveNumberValue,
  isRecord,
} from "./mcpToolsHelpers.ts";

type AnyRecord = Record<string, unknown>;

// ─── Missing Constants ──────────────────────────────────────────────────

const LEGACY_UNSPECIFIED_REGION_ID = "legacy_region_unspecified";
const LEGACY_MUTATION_DISABLED_ERROR = "legacy_mutation_disabled_in_production";

const LOCAL_ARCHIVE_LOOP = {
  loopMode: "local_trial_archive",
  channelClass: "local_trial",
  deliveryTrust: "untrusted_client",
} as const;
const LEGACY_EVENT_RISKS = new Set(["low", "medium", "high"]);
const LEGACY_REVIEW_STAGES = [
  { stage: "queued", label: "排队中" },
  { stage: "rule_check", label: "规则校验" },
  { stage: "light_review", label: "轻审" },
  { stage: "heavy_review", label: "重审" },
  { stage: "manual_review", label: "人工" },
  { stage: "completed", label: "完成" },
] as const;

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

function positiveIntegerValue(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}


// ─── MCP Server Info (re-exported from mcpConstants.ts) ───────────────────

export { MCP_PROTOCOL_VERSION, MCP_SERVER_INFO } from "./mcpConstants.ts";

// ─── Phase 6 Helpers ─────────────────────────────────────────────────────

type Phase6ReceiptSqliteRow = {
  readonly receipt_id: string;
  readonly journey_id: string;
  readonly receipt_json: string;
};
const PHASE6_EXPERIMENT_SCENARIO_MATRIX = PHASE6_AUTHORITATIVE_SCENARIO_MATRIX;
const PHASE6_EXPERIMENT_VERSION_BINDING = {
  rulesVersion: PHASE6_MCP_CONTRACT_RULESET_VERSION,
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

// ─── Domain Ledgers ──────────────────────────────────────────────────────────

// ─── Domain Ledgers ──────────────────────────────────────────────────────────

export type DomainLedgers = {
  readonly registry: ReturnType<typeof createTicketRegistry>;
  readonly operationSwitches: ReturnType<typeof createEpochOperationSwitchRegistry>;
  readonly loreLedger: ReturnType<typeof createLoreLedger>;
  readonly progressionLedger: ReturnType<typeof createProgressionLedger>;
  readonly factionLedger: ReturnType<typeof createFactionLedger>;
  readonly communityLedger: ReturnType<typeof createCommunityLedger>;
  readonly experienceLedger: ReturnType<typeof createExperienceLedger>;
  readonly outboxLedger: ReturnType<typeof createLegacyOutboxLedger>;
  readonly configuredCommunityAbuseResolver: CommunityAbuseContextResolver | undefined;
  /** Assign the real abuse-context resolver after the epoch runtime is wired. */
  readonly setResolveCommunityAbuseContext: (fn: CommunityAbuseContextResolver | undefined) => void;
};

export function createDomainLedgers(options: RuntimeOptions): DomainLedgers {
  const registry = createTicketRegistry(recordValue(options.tickets));
  const operationSwitches = createEpochOperationSwitchRegistry(options.operationSwitches);
  const loreLedger = createLoreLedger(recordValue(options.loreState), { operationSwitches });
  const progressionLedger = createProgressionLedger(recordValue(options.progression));
  const factionLedger = createFactionLedger(recordValue(options.factions));
  const communityOptions = recordValue(options.community);
  const configuredCommunityAbuseResolver = typeof communityOptions.resolveAbuseContext === "function"
    ? communityOptions.resolveAbuseContext as CommunityAbuseContextResolver
    : undefined;
  let resolveCommunityAbuseContext: CommunityAbuseContextResolver | undefined;
  const communityLedger = createCommunityLedger({
    ...communityOptions,
    resolveAbuseContext: (input: CommunityAbuseContextInput) => resolveCommunityAbuseContext?.(input),
  });
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
  return {
    registry,
    operationSwitches,
    loreLedger,
    progressionLedger,
    factionLedger,
    communityLedger,
    experienceLedger,
    outboxLedger,
    configuredCommunityAbuseResolver,
    setResolveCommunityAbuseContext: (fn: CommunityAbuseContextResolver | undefined) => {
      resolveCommunityAbuseContext = fn;
    },
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function clockIso(clock: (() => Date | string) | undefined): string {
  const value = clock?.() ?? new Date();
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

// ─── World Simulation Stack ─────────────────────────────────────────────────

export type WorldSimulationStack = {
  readonly worldClockRuntime: ReturnType<typeof createEpochWorldClockRuntime>;
  readonly worldSimulationRuntime: ReturnType<typeof createEpochWorldSimulationRuntime>;
  readonly currentWorldSimulationSignals: () => { readonly regions: readonly EpochWorldSimulationRegionSignal[] };
  readonly advanceCanonicalWorld: (input: Parameters<ReturnType<typeof createEpochWorldClockRuntime>["sync"]>[0] & { readonly elapsedWorldMinutes?: number }) => {
    readonly clock: EpochWorldClockState;
    readonly worldSimulation: EpochWorldSimulationSnapshot;
    readonly events: readonly EpochEvent[];
    readonly duplicate: boolean;
    readonly worldFlows?: EpochWorldSimulationFlowSummary;
  };
  readonly migrateCanonicalWorldContent: (input: MigrateEpochWorldSimulationContentInput) => ReturnType<ReturnType<typeof createEpochWorldSimulationRuntime>["migrateContent"]>;
};

export type WorldSimulationStackInput = {
  readonly epochRuntime: ReturnType<typeof createEpochRuntime>;
  readonly worldContentRegistry: ReturnType<typeof validateWorldContentRegistry>;
  readonly worldClockOptions: AnyRecord;
  readonly worldSimulationOptions: AnyRecord;
  readonly initialEpochEvents: readonly EpochEvent[];
};

export function createWorldSimulationStack(input: WorldSimulationStackInput): WorldSimulationStack {
  const {
    epochRuntime,
    worldContentRegistry,
    worldClockOptions,
    worldSimulationOptions,
    initialEpochEvents,
  } = input;

  // ── World clock + simulation runtimes ──

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

  // ── World simulation signal aggregation ──

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

  // ── Canonical world advance (clock + simulation) ──

  function advanceCanonicalWorld(input: Parameters<typeof worldClockRuntime.sync>[0] & { readonly elapsedWorldMinutes?: number }) {
    const clockCheckpoint = worldClockRuntime.checkpoint();
    const simulationCheckpoint = worldSimulationRuntime.checkpoint();
    try {
      const clockAdvance = input.elapsedWorldMinutes !== undefined
        ? worldClockRuntime.advance({ ...input, elapsedWorldMinutes: input.elapsedWorldMinutes })
        : worldClockRuntime.sync(input);
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

  // ── World simulation content migration ──

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

  return {
    worldClockRuntime,
    worldSimulationRuntime,
    currentWorldSimulationSignals,
    advanceCanonicalWorld,
    migrateCanonicalWorldContent,
  };
}

// ─── Journey Stack ──────────────────────────────────────────────────────────

// ─── Journey Stack ──────────────────────────────────────────────────────────

export type JourneyStack = {
  readonly companionRuntime: ReturnType<typeof createAgentCompanionRuntime>;
  readonly journeyOfferRuntime: ReturnType<typeof createJourneyOfferRuntime>;
  readonly drainPendingMirrorConsequences: (journeyId: string) => readonly JourneyRuntimeEvent[];
  readonly companionRuntimeRef: { current: ReturnType<typeof createAgentCompanionRuntime> | undefined };
  readonly pendingMirrorConsequences: Map<string, MirrorConsequenceLedgerEntry[]>;
  readonly configuredJourneyClock: (() => Date | string) | undefined;
  readonly configuredWorldClock: () => Date | string;
  readonly journeyIdSequence: number;
  readonly resolveJourneyHiddenTaskSeal: JourneyHiddenTaskSealResolver;
};

export type JourneyStackInput = {
  readonly epochRuntime: ReturnType<typeof createEpochRuntime>;
  readonly worldSimulationRuntime: ReturnType<typeof createEpochWorldSimulationRuntime>;
  readonly worldContentRegistry: ReturnType<typeof validateWorldContentRegistry>;
  readonly journeyOptions: AnyRecord;
  readonly initialJourneyEvents: readonly JourneyRuntimeEvent[];
  readonly initialJourneyProjection: ReturnType<typeof projectJourneyRuntimeEvents>;
  /** Shared map that the epoch runtime's journeyMirrorLedgerSink writes into. */
  readonly pendingMirrorConsequences: Map<string, MirrorConsequenceLedgerEntry[]>;
};

export function createJourneyStack(input: JourneyStackInput): JourneyStack {
  const {
    epochRuntime,
    worldSimulationRuntime,
    worldContentRegistry,
    journeyOptions,
    initialJourneyEvents,
    initialJourneyProjection,
    pendingMirrorConsequences,
  } = input;

  // ── Seal resolver (initially projection-based, reassigned after companion creation) ──

  const sealFromProjection = (
    projection: typeof initialJourneyProjection,
    journeyId: string,
    plan: JourneyGeneratedTaskPlan,
  ): JourneyHiddenTaskSeal => {
    if (projection.journeys[journeyId]?.journey.taskPlan?.hiddenTaskCommitment !== plan.hiddenTaskCommitment) {
      throw new Error("journey_hidden_task_plan_mismatch");
    }
    const seal = projection.hiddenTaskSeals[journeyId];
    if (!seal) throw new Error("journey_hidden_task_seal_missing");
    return seal;
  };
  let resolveJourneyHiddenTaskSeal: JourneyHiddenTaskSealResolver = (journeyId, plan) =>
    sealFromProjection(initialJourneyProjection, journeyId, plan);

  // ── PR2 mirror-consequence ledger bridge ──

  const companionRuntimeRef: {
    current: ReturnType<typeof createAgentCompanionRuntime> | undefined;
  } = { current: undefined };
  const drainPendingMirrorConsequences = (journeyId: string): readonly JourneyRuntimeEvent[] => {
    const pending = pendingMirrorConsequences.get(journeyId);
    if (!pending || pending.length === 0) return [];
    pendingMirrorConsequences.delete(journeyId);
    const companion = companionRuntimeRef.current;
    if (!companion) return [];
    const journeyRuntime = companion.journeyRuntime();
    const before = new Set(journeyRuntime.projection().events.map((event) => event.eventId));
    const live = journeyRuntime.status(journeyId);
    journeyRuntime.recordMirrorConsequences({
      journeyId,
      expectedVersion: live.journey.version,
      entries: pending,
    });
    return journeyRuntime.projection().events.filter((event) => !before.has(event.eventId));
  };

  // ── Journey clocks and ID sequence ──

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

  // ── Journey offer runtime ──

  const configuredReplenishStrategy = typeof journeyOptions.replenishStrategy === "function"
    ? journeyOptions.replenishStrategy as ReplenishStrategy
    : undefined;
  const journeyOfferRuntime = createJourneyOfferRuntime({
    repository: createJourneyOfferRepository(),
    replenishStrategy: configuredReplenishStrategy,
    now: () => clockIso(configuredJourneyClock),
  });

  // ── Companion runtime ──

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
      economyActions: epochRuntime.economyActions,
      publicIdentity: epochRuntime.agentPublicIdentity,
      events: epochRuntime.events,
      getResultPage: epochRuntime.getResultPage,
      interactionEvents: epochRuntime.interactionEvents,
      worldObjectStates: epochRuntime.worldObjectStates,
      hiddenPrerequisiteLinks: epochRuntime.hiddenPrerequisiteLinks,
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
    offerRuntime: journeyOfferRuntime,
  });

  // Wire the companion runtime ref and upgrade the seal resolver.
  companionRuntimeRef.current = companionRuntime;
  resolveJourneyHiddenTaskSeal = (journeyId, plan) =>
    sealFromProjection(companionRuntime.journeyRuntime().projection(), journeyId, plan);

  return {
    companionRuntime,
    journeyOfferRuntime,
    drainPendingMirrorConsequences,
    companionRuntimeRef,
    pendingMirrorConsequences,
    configuredJourneyClock,
    configuredWorldClock,
    journeyIdSequence,
    resolveJourneyHiddenTaskSeal,
  };
}

// ─── Epoch Runtime Stack ─────────────────────────────────────────────────────

// ─── Epoch Runtime Stack ─────────────────────────────────────────────────────

export type EpochRuntimeStackInput = {
  readonly options: RuntimeOptions;
  readonly epochOptions: AnyRecord;
  readonly initialEpochEvents: readonly EpochEvent[];
  readonly initialResultPages: readonly object[];
  readonly journeyOptions: AnyRecord;
  readonly initialJourneyEvents: readonly JourneyRuntimeEvent[];
  readonly worldClockOptions: AnyRecord;
  readonly worldSimulationOptions: AnyRecord;
  readonly worldContentRegistry: ReturnType<typeof validateWorldContentRegistry>;
  readonly initialJourneyProjection: ReturnType<typeof projectJourneyRuntimeEvents>;
};

export type EpochRuntimeStack = {
  readonly epochRuntime: ReturnType<typeof createEpochRuntime>;
  readonly worldClockRuntime: ReturnType<typeof createEpochWorldClockRuntime>;
  readonly worldSimulationRuntime: ReturnType<typeof createEpochWorldSimulationRuntime>;
  readonly companionRuntime: ReturnType<typeof createAgentCompanionRuntime>;
  readonly journeyOfferRuntime: ReturnType<typeof createJourneyOfferRuntime>;
  readonly phase6ResultPages: ReturnType<typeof createEpochResultPageReadModel>;
  readonly drainPendingMirrorConsequences: (journeyId: string) => readonly JourneyRuntimeEvent[];
  readonly companionRuntimeRef: { current: ReturnType<typeof createAgentCompanionRuntime> | undefined };
  readonly pendingMirrorConsequences: Map<string, MirrorConsequenceLedgerEntry[]>;
  readonly currentWorldSimulationSignals: () => { readonly regions: readonly EpochWorldSimulationRegionSignal[] };
  readonly advanceCanonicalWorld: (input: Parameters<ReturnType<typeof createEpochWorldClockRuntime>["sync"]>[0] & { readonly elapsedWorldMinutes?: number }) => {
    readonly clock: EpochWorldClockState;
    readonly worldSimulation: EpochWorldSimulationSnapshot;
    readonly events: readonly EpochEvent[];
    readonly duplicate: boolean;
    readonly worldFlows?: EpochWorldSimulationFlowSummary;
  };
  readonly migrateCanonicalWorldContent: (input: MigrateEpochWorldSimulationContentInput) => ReturnType<ReturnType<typeof createEpochWorldSimulationRuntime>["migrateContent"]>;
  readonly configuredJourneyClock: (() => Date | string) | undefined;
  readonly configuredWorldClock: () => Date | string;
  readonly journeyIdSequence: number;
  readonly resolveJourneyHiddenTaskSeal: JourneyHiddenTaskSealResolver;
};

export function createEpochRuntimeStack(stackInput: EpochRuntimeStackInput): EpochRuntimeStack {
  const {
    epochOptions,
    initialEpochEvents,
    initialResultPages,
    journeyOptions,
    initialJourneyEvents,
    worldClockOptions,
    worldSimulationOptions,
    worldContentRegistry,
    initialJourneyProjection,
  } = stackInput;

  // ── PR2 mirror-consequence ledger bridge (created early so epoch runtime can sink into it) ──

  const pendingMirrorConsequences = new Map<string, MirrorConsequenceLedgerEntry[]>();

  // ── Epoch runtime ──

  const initialEpochResultPages = initialResultPages.filter((page) =>
    optionalString(recordValue(page).createdBy) !== "obsidian_epoch.phase6");

  // Temporary seal resolver; upgraded after journey stack creation.
  let resolveJourneyHiddenTaskSeal: JourneyHiddenTaskSealResolver = () => {
    throw new Error("journey_hidden_task_seal_not_yet_initialized");
  };
  const epochRuntime = createEpochRuntime({
    ...epochOptions,
    initialEvents: initialEpochEvents,
    initialResultPages: initialEpochResultPages as readonly EpochSharedResultPage[],
    resolveJourneyHiddenTaskSeal: (journeyId, plan) => resolveJourneyHiddenTaskSeal(journeyId, plan),
    journeyMirrorLedgerSink: (input) => {
      const existing = pendingMirrorConsequences.get(input.journeyId) ?? [];
      pendingMirrorConsequences.set(input.journeyId, [...existing, ...input.entries]);
    },
  });

  // ── Phase 6 result pages read model ──

  const phase6ResultPages = createEpochResultPageReadModel(initialResultPages as readonly EpochSharedResultPage[]);

  // ── World simulation stack ──

  const worldSim = createWorldSimulationStack({
    epochRuntime,
    worldContentRegistry,
    worldClockOptions,
    worldSimulationOptions,
    initialEpochEvents,
  });

  // ── Journey stack ──

  const journey = createJourneyStack({
    epochRuntime,
    worldSimulationRuntime: worldSim.worldSimulationRuntime,
    worldContentRegistry,
    journeyOptions,
    initialJourneyEvents,
    initialJourneyProjection,
    pendingMirrorConsequences,
  });

  // Replace the placeholder seal resolver with the journey stack's real one.
  resolveJourneyHiddenTaskSeal = journey.resolveJourneyHiddenTaskSeal;

  return {
    epochRuntime,
    worldClockRuntime: worldSim.worldClockRuntime,
    worldSimulationRuntime: worldSim.worldSimulationRuntime,
    companionRuntime: journey.companionRuntime,
    journeyOfferRuntime: journey.journeyOfferRuntime,
    phase6ResultPages,
    drainPendingMirrorConsequences: journey.drainPendingMirrorConsequences,
    companionRuntimeRef: journey.companionRuntimeRef,
    pendingMirrorConsequences: journey.pendingMirrorConsequences,
    currentWorldSimulationSignals: worldSim.currentWorldSimulationSignals,
    advanceCanonicalWorld: worldSim.advanceCanonicalWorld,
    migrateCanonicalWorldContent: worldSim.migrateCanonicalWorldContent,
    configuredJourneyClock: journey.configuredJourneyClock,
    configuredWorldClock: journey.configuredWorldClock,
    journeyIdSequence: journey.journeyIdSequence,
    resolveJourneyHiddenTaskSeal: journey.resolveJourneyHiddenTaskSeal,
  };
}


// ─── Phase 6 Receipt Helpers ──────────────────────────────────────────────

export function phase6ReceiptSqlitePath(options: AnyRecord) {
  return optionalString(options.sqlitePath)
    || optionalString(recordValue(options.persistence).sqlitePath)
    || optionalString(recordValue(options.store).sqlitePath)
    || optionalString(recordValue(options.health).sqlitePath)
    || process.env.AGENT_SERVER_SQLITE_PATH;
}

// ─── PR6: Prompt narrative helpers ──────────────────────────────────────────

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

// ─── Infinite World Helpers ────────────────────────────────────────────────

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

export function createAgentWorldRuntime(options: RuntimeOptions = {}) {
  const registry = createTicketRegistry(recordValue(options.tickets));
  const operationSwitches = createEpochOperationSwitchRegistry(options.operationSwitches);
  const epochOptions = recordValue(options.epoch);
  const modelAdapter = epochOptions.modelAdapter as ModelAdapter | undefined;
  const narrativeAgent = createNarrativeAgent(modelAdapter);
  const loreLedger = createLoreLedger(recordValue(options.loreState), { operationSwitches });
  const progressionLedger = createProgressionLedger(recordValue(options.progression));
  const factionLedger = createFactionLedger(recordValue(options.factions));
  const communityOptions = recordValue(options.community);
  const configuredCommunityAbuseResolver = typeof communityOptions.resolveAbuseContext === "function"
    ? communityOptions.resolveAbuseContext as CommunityAbuseContextResolver
    : undefined;
  let resolveCommunityAbuseContext: CommunityAbuseContextResolver | undefined;
  const communityLedger = createCommunityLedger({
    ...communityOptions,
    resolveAbuseContext: (input: CommunityAbuseContextInput) => resolveCommunityAbuseContext?.(input),
  });
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
  const journeyOptions = recordValue(options.journey);
  const worldClockOptions = recordValue(options.worldClock);
  const worldSimulationOptions = recordValue(options.worldSimulation);
  const phase6ReadinessBindingForJourney = (journeyId: string) => {
    const store = recordValue(epochOptions).phase6ExperimentStore as
      | { loadRunByJourneyId?: (value: string) => unknown }
      | undefined;
    if (typeof store?.loadRunByJourneyId !== "function") return undefined;
    const run = recordValue(store.loadRunByJourneyId(journeyId));
    if (Object.keys(run).length === 0) return undefined;
    if (optionalString(run.journeyId) !== journeyId) {
      throw new Error("phase6_journey_readiness_binding_mismatch");
    }
    const runIndex = Number(run.runIndex);
    if (!Number.isInteger(runIndex)
      || !PHASE6_RUN_INDEXES.includes(runIndex as (typeof PHASE6_RUN_INDEXES)[number])) {
      throw new Error("phase6_journey_readiness_run_index_invalid");
    }
    return {
      runIndex,
      scenarioTag: phase6ScenarioForRun(runIndex).tag,
    };
  };
  const worldContentRegistry = options.worldContentRegistry
    ? validateWorldContentRegistry(options.worldContentRegistry)
    : loadDefaultWorldContentRegistry();
  const initialEpochEvents = (Array.isArray(options.epochEvents)
    ? options.epochEvents
    : Array.isArray(epochOptions.initialEvents)
      ? epochOptions.initialEvents
      : []) as readonly EpochEvent[];
  const infiniteWorldOptions = recordValue(options.infiniteWorld);
  const infiniteWorldId = optionalString(infiniteWorldOptions.worldId)
    || process.env.OBSIDIAN_EPOCH_WORLD_ID
    || process.env.AGENT_WORLD_ID
    || "obsidian_epoch_world_default";
  const infiniteWorld = createInfiniteWorldRuntime({
    ...infiniteWorldOptions,
    worldId: infiniteWorldId,
    initialEvents: causalEventsFromEpochEvents(initialEpochEvents, infiniteWorldId),
  });
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
  ): JourneyHiddenTaskSeal => {
    if (projection.journeys[journeyId]?.journey.taskPlan?.hiddenTaskCommitment !== plan.hiddenTaskCommitment) {
      throw new Error("journey_hidden_task_plan_mismatch");
    }
    const seal = projection.hiddenTaskSeals[journeyId];
    if (!seal) throw new Error("journey_hidden_task_seal_missing");
    return seal;
  };
  let resolveJourneyHiddenTaskSeal: JourneyHiddenTaskSealResolver = (journeyId, plan) =>
    sealFromProjection(initialJourneyProjection, journeyId, plan);
  const initialResultPages = Array.isArray(options.resultPages)
    ? options.resultPages
    : Array.isArray(epochOptions.initialResultPages)
      ? epochOptions.initialResultPages
      : [];
  // Phase 6 pages share the SQLite result_pages index but have their own public read contract.
  const initialEpochResultPages = initialResultPages.filter((page) =>
    optionalString(recordValue(page).createdBy) !== "obsidian_epoch.phase6");
  // PR2 mirror-consequence ledger bridge.
  //
  // The gameCore `submitHostedAction` emits mirror-world consequence
  // blueprints through `journeyMirrorLedgerSink` (gameCore.ts:9856). The
  // integrator must forward those blueprints to the companion runtime so the
  // journey projection's `mirrorLedgers[journeyId]` fills in at action time.
  //
  // Synchronous forwarding inside the sink would bump `journey.version` via
  // `recordMirrorConsequences`, but `commitSingleJourneyStepRuntime` runs
  // `submitHostedAction` → `commitEpisodes` in sequence with a single
  // `expectedVersion` (mcpTools.ts:2478-2484); a version bump between the two
  // throws `journey_version_conflict`. To preserve that contract the sink
  // buffers blueprints per journey and `drainPendingMirrorConsequences`
  // flushes them at safe points (after `commitEpisodes`, before ledger reads,
  // and before `solidifyJourneyWorld`). Effect matches the plan: by the time
  // the integrator reads the ledger for solidify, every submitted mirror
  // action's collateral entries are present and idempotent under replay.
  const companionRuntimeRef: {
    current: ReturnType<typeof createAgentCompanionRuntime> | undefined;
  } = { current: undefined };
  const pendingMirrorConsequences = new Map<string, MirrorConsequenceLedgerEntry[]>();
  const drainPendingMirrorConsequences = (journeyId: string): readonly JourneyRuntimeEvent[] => {
    const pending = pendingMirrorConsequences.get(journeyId);
    if (!pending || pending.length === 0) return [];
    pendingMirrorConsequences.delete(journeyId);
    const companion = companionRuntimeRef.current;
    if (!companion) return [];
    const journeyRuntime = companion.journeyRuntime();
    const before = new Set(journeyRuntime.projection().events.map((event) => event.eventId));
    const live = journeyRuntime.status(journeyId);
    journeyRuntime.recordMirrorConsequences({
      journeyId,
      expectedVersion: live.journey.version,
      entries: pending,
    });
    return journeyRuntime.projection().events.filter((event) => !before.has(event.eventId));
  };
  const epochRuntime = createEpochRuntime({
    ...epochOptions,
    initialEvents: initialEpochEvents,
    initialResultPages: initialEpochResultPages,
    resolveJourneyHiddenTaskSeal: (journeyId, plan) => resolveJourneyHiddenTaskSeal(journeyId, plan),
    journeyMirrorLedgerSink: (input) => {
      // Buffer per journey. Drain happens after the surrounding
      // submit→commitEpisodes flow completes, not here. The gameCore passes
      // `expectedVersion: -1` (gameCore.ts:9859) precisely because it cannot
      // see the companion runtime's journey version; the drain resolves the
      // real version from `journeyRuntime.status(journeyId)`.
      const existing = pendingMirrorConsequences.get(input.journeyId) ?? [];
      pendingMirrorConsequences.set(input.journeyId, [...existing, ...input.entries]);
    },
  });
  const phase6ReceiptSqlite = phase6ReceiptSqlitePath(options);
  const phase6ResultPages = createEpochResultPageReadModel(initialResultPages as readonly EpochSharedResultPage[]);
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

  function advanceCanonicalWorld(input: Parameters<typeof worldClockRuntime.sync>[0] & { readonly elapsedWorldMinutes?: number }) {
    const clockCheckpoint = worldClockRuntime.checkpoint();
    const simulationCheckpoint = worldSimulationRuntime.checkpoint();
    try {
      const clockAdvance = input.elapsedWorldMinutes !== undefined
        ? worldClockRuntime.advance({ ...input, elapsedWorldMinutes: input.elapsedWorldMinutes })
        : worldClockRuntime.sync(input);
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
  // PR3: wire the quest-offer runtime so prepare_journey can run in
  // offer-driven mode (claim + resolve + delegate). Backed by the same
  // append-only JSONL repository as the rest of the epoch engine.
  // PR10: inject AI-backed replenish strategy when provided via journey options.
  const configuredReplenishStrategy = typeof journeyOptions.replenishStrategy === "function"
    ? journeyOptions.replenishStrategy as ReplenishStrategy
    : undefined;
  const journeyOfferRuntime = createJourneyOfferRuntime({
    repository: createJourneyOfferRepository(),
    replenishStrategy: configuredReplenishStrategy,
    now: () => clockIso(configuredJourneyClock),
  });
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
      economyActions: epochRuntime.economyActions,
      publicIdentity: epochRuntime.agentPublicIdentity,
      events: epochRuntime.events,
      getResultPage: epochRuntime.getResultPage,
      interactionEvents: epochRuntime.interactionEvents,
      worldObjectStates: epochRuntime.worldObjectStates,
      hiddenPrerequisiteLinks: epochRuntime.hiddenPrerequisiteLinks,
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
    offerRuntime: journeyOfferRuntime,
  });
  companionRuntimeRef.current = companionRuntime;
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
  resolveCommunityAbuseContext = (input) => runtimeCommunityAbuseContext({
    input,
    loreState: recordValue(loreLedger.state()),
    factionState: recordValue(factionLedger.state()),
    submittedRuns,
    communityState: recordValue(communityLedger.state()),
    relationshipGraph: recordValue(epochRuntime.relationships()),
    configuredResolver: configuredCommunityAbuseResolver,
  });
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

  function proposeJourneyStepRuntime(
    input: AnyRecord = {},
    options: { readonly recallOnly?: boolean } = {},
  ) {
    assertPublicSafe(input);
    const proposed = companionRuntime.proposeStep(input);
    const episode = proposed.episode;
    const phase6Readiness = phase6ReadinessBindingForJourney(proposed.journey.journeyId);
    let hostedSession;
    let hostedEvents: readonly ReturnType<typeof epochEventsForPersistence>[number][] = [];
    if (!options.recallOnly) {
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
      }
    }
    if (!hostedSession) {
      const hosted = epochRuntime.startJourneyHostedSession({
        ...input,
        correlationId: proposed.journey.correlationId,
        causationId: proposed.journey.journeyId,
        agentId: proposed.journey.agentId,
        regionId: proposed.journey.destinationRegionId,
        mandate: options.recallOnly ? `服务器召回：${episode.title}` : episode.title,
        journeyScene: {
          seed: `${proposed.journey.journeyId}:${episode.episodeId}`,
          journeyId: proposed.journey.journeyId,
          episodeId: episode.episodeId,
          sceneType: episode.type,
          phase: episode.phase ?? "main",
          ...(proposed.journey.worldMode ? { worldMode: proposed.journey.worldMode } : {}),
          title: episode.title,
          mandate: proposed.journey.mandate,
          ...(options.recallOnly ? { recallOnly: true } : {}),
          worldObjects: episode.worldObjectRefs.map((worldObject) => ({
            ...worldObject,
            regionId: proposed.journey.destinationRegionId,
            sourceFactIds: episode.sourceFactIds,
          })),
          sourceFactIds: episode.sourceFactIds,
          expectedVersion: proposed.journey.version,
          ...(phase6Readiness ? { phase6Readiness } : {}),
          ...(!options.recallOnly && episode.generatedTaskObjective
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
      },
    };
    return attachEpochEventsForPersistence(result, hostedEvents);
  }

  function commitSingleJourneyStepRuntime(
    input: AnyRecord = {},
    precommittedAction?: ReturnType<typeof epochRuntime.commitJourneyHostedAction>,
  ) {
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
    const action = precommittedAction ?? epochRuntime.commitJourneyHostedAction({
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
    const authoritativeCompletionKind = action.value.journeyResolution?.completionKind;
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
    const narrative = recordedEpisode?.narrative ?? narrativeAgent.render({
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
    // PR2: flush mirror-consequence blueprints buffered by the sink during
    // `commitJourneyHostedAction`. Must run AFTER `commitEpisodes` so the
    // journey version consumed above is the propose-time value; the drain
    // then appends `journey_mirror_consequence_recorded` at the new version.
    // The drained events are returned so the caller can persist them —
    // bypassing this would leave a version gap on restart.
    const drainedMirrorEvents = drainPendingMirrorConsequences(contract.journeyId);
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
    // Merge journey events from status, commitEpisodes result, and the
    // drain (which bypassed #captureEvents). Attach in-place to preserve
    // the plain-return type inference — mergeJourneyEventsForPersistence is
    // generic and would narrow the inferred return type.
    const baseJourneyEvents = [
      ...journeyEventsForPersistence(status),
      ...journeyEventsForPersistence(committed),
    ];
    const baseJourneyEventIds = new Set(baseJourneyEvents.map((event) => event.eventId));
    const allJourneyEvents = [
      ...baseJourneyEvents,
      ...drainedMirrorEvents.filter((event) => !baseJourneyEventIds.has(event.eventId)),
    ];
    attachJourneyEventsForPersistence(result, allJourneyEvents);
    return result;
  }

  /**
   * PR4: Map a {@link SettlementTier} (5-tier scale, includes 未及格) into the
   * 4-tier solidify contract enum (及格/良好/优秀/惊世). 未及格 never reaches
   * here because the solidify path is only invoked when canonEligible=true,
   * which requires main line success + score above threshold.
   *
   * The solidify event payload uses the four eligible tiers; the
   * authoritative five-tier value is the {@link SettlementDecision.tier} carried
   * on the {@link settlementDecision} field of finalizeSettledMirrorWorld's
   * return value.
   */
  function pr4CompletionTierForSolidify(
    tier: SettlementDecision["tier"],
  ): "及格" | "良好" | "优秀" | "惊世" {
    switch (tier) {
      case "及格": return "及格";
      case "良好": return "良好";
      case "优秀": return "优秀";
      case "惊世": return "惊世";
      case "未及格":
        throw new Error("journey_world_commit_tier_ineligible");
      default: {
        const _exhaustive: never = tier;
        throw new Error(`unhandled_settlement_tier:${String(_exhaustive)}`);
      }
    }
  }

  /**
   * Build the SettlementContext from the post-settle final status and call
   * deriveSettlementDecision. This is the single point at which tier, reward,
   * and worldCommit are computed; downstream code only reads that decision.
   */
  function computeSettlementDecisionForFinalize(params: {
    readonly journeyId: string;
    readonly taskPlan: NonNullable<EpochJourney["taskPlan"]>;
    readonly evidenceEpisodes: readonly JourneyTaskEvidenceEpisode[];
    readonly taskAdjudication: AnyRecord;
    readonly completedObjectiveIds: readonly string[];
    readonly requiredMainObjectiveIds: readonly string[];
    readonly bonusMainObjectiveIds: readonly string[];
    readonly relevantSideObjectiveIds: readonly string[];
    readonly mainLineSucceeded: boolean;
    readonly hiddenComplete: boolean;
  }): SettlementDecision {
    const journeyId = params.journeyId;
    const taskAdjudication = params.taskAdjudication;
    const performance = isRecord(taskAdjudication.performance)
      ? taskAdjudication.performance
      : undefined;
    // PR4: re-derive the four result-component inputs from the adjudication
    // performance components. The composite `scoreBps` on performance is NOT
    // used — only the four physical-adjudication components plus the failed
    // / failed-action penalty.
    const mainCompletionBps = numberFrom(performance?.mainCompletionBps, 0);
    const bonusMainCompletionBps = numberFrom(performance?.bonusMainCompletionBps, 0);
    const sideCompletionBps = numberFrom(performance?.sideCompletionBps, 0);
    const executionQualityBps = numberFrom(performance?.executionQualityBps, 0);
    const failedActions = numberFrom(performance?.failedActions, 0);
    const penaltyBps = failedActions * 750;
    const resultComponentInputs: ResultComponentInputs = {
      mainCompletionBps,
      bonusMainCompletionBps,
      sideCompletionBps,
      executionQualityBps,
      penaltyBps,
    };
    const actionEvidence = buildJourneySettlementActionEvidence({
      episodes: params.evidenceEpisodes,
      canonicalEvents: epochRuntime.interactionEvents(0),
    });
    // PR4: scan the journey projection's mirror ledger for live entries to
    // feed the collateral bucket. The solidify caller drains pending
    // blueprints before this; this snapshot is the pre-drain view. The
    // Settlement reads the fully drained mirror ledger, so the decision and
    // the later promotion operate on the same snapshot.
    const journeyProjection = companionRuntime.journeyRuntime().projection();
    const mirrorLedger = journeyProjection.mirrorLedgers[journeyId];
    const mirrorLedgerEntries = mirrorLedger
      ? listMirrorConsequences(mirrorLedger, { includeDiscarded: true, includePromoted: true })
      : ([] as readonly MirrorConsequenceLedgerEntry[]);
    const roleplayScore = roleplayScoreFromMirrorLedger({
      entries: mirrorLedgerEntries,
      journeyId,
      recordedAt: mirrorLedgerEntries.at(-1)?.recordedAt ?? "1970-01-01T00:00:00.000Z",
    });
    const hiddenObjectiveIds = deriveHiddenObjectiveIdsForJourney(params.taskPlan, journeyId);
    const baseRewardBundle = deriveBaseRewardBundleForJourney(params.taskPlan, journeyId);
    const ctx: SettlementContext = {
      journeyId,
      mainObjectiveIds: params.requiredMainObjectiveIds,
      sideObjectiveIds: params.relevantSideObjectiveIds,
      hiddenObjectiveIds,
      mainLineSucceeded: params.mainLineSucceeded,
      hiddenComplete: params.hiddenComplete,
      actionResolutions: actionEvidence.actionResolutions,
      selfLossSourceEventsByKind: actionEvidence.selfLossSourceEventsByKind,
      mirrorLedgerEntries,
      canonicalActionEventIds: actionEvidence.canonicalActionEventIds,
      resultComponentInputs,
      selfLossContributions: actionEvidence.selfLossContributions,
      baseRewardBundle,
      roleplayScore,
      policyVersion: SETTLEMENT_POLICY_VERSION,
    };
    void params.bonusMainObjectiveIds;
    void params.completedObjectiveIds;
    const score = buildConsequenceScore(ctx);
    return deriveSettlementDecision(ctx, score);
  }

  /**
   * PR4 helper: derive the hidden-objective IDs for the SettlementContext
   * from the journey's task plan + hidden task seal. Used as the input to
   * the HiddenClamp's `sourceHiddenObjectiveIds`.
   */
  function deriveHiddenObjectiveIdsForJourney(
    taskPlan: NonNullable<EpochJourney["taskPlan"]>,
    journeyId: string,
  ): readonly string[] {
    const seal = resolveJourneyHiddenTaskSeal(journeyId, taskPlan);
    const hidden = deriveJourneyHiddenTask(taskPlan, seal);
    return hidden.requiredActions.map((action) => action.objectiveId);
  }

  /**
   * PR4 helper: build a {@link BaseRewardBundle} from the journey's task
   * plan. Resources come from the JOURNEY_TIER_REWARDS coin reward; items
   * come from journeyRewardBundleForPlan for the tier 惊世 (the highest
   * tier). This is a conservative bundle — the actual tier-specific scaling
   * happens inside deriveRewardGrant, which applies the multiplier on top
   * of these base amounts.
   */
  function deriveBaseRewardBundleForJourney(
    taskPlan: NonNullable<EpochJourney["taskPlan"]>,
    journeyId: string,
  ): { readonly baseBundleRef: string; readonly resources: Readonly<Record<string, number>>; readonly items: readonly { readonly itemId: string; readonly quantity: number; readonly baseRarityTier: 0 | 1 | 2 | 3 }[] } {
    // Use the canonical plan-based bundle builder to source base resources
    // and items. The tier parameter to journeyRewardBundleForPlan affects
    // only item rarity; we pass 惊世 so the base items are available at
    // their highest tier, then deriveRewardGrant clamps them down per the
    // actual settled tier.
    const bundle = journeyRewardBundleForPlan(taskPlan, "惊世");
    const coinReward = bundle.resources.find((reward) => reward.resourceId === "coin");
    return {
      baseBundleRef: `journey:${journeyId}:base`,
      resources: coinReward ? { coin: coinReward.amount } : {},
      items: bundle.items.map((item) => ({
        itemId: item.itemKey,
        quantity: 1,
        baseRarityTier: rarityTierNumeric(item.rarity),
      })),
    };
  }

  function finalizeSettledMirrorWorld(
    status: ReturnType<typeof companionRuntime.status>,
    input: AnyRecord,
  ) {
    if (status.journey.status !== "settled"
      || status.journey.worldMode !== "mirror") {
      return {
        status,
        worldSynchronization: undefined,
        worldSolidification: undefined,
        viabilityProjection: undefined as ReturnType<typeof epochRuntime.projectJourneySettlementViability> | undefined,
        worldCommitRecord: undefined,
        settlementDecision: undefined as SettlementDecision | undefined,
        feedbackSignals: undefined as readonly WorldFeedbackSignal[] | undefined,
        mirrorLedgerEntries: [] as readonly MirrorConsequenceLedgerEntry[],
      };
    }
    const settledAtWorldTime = status.journey.settledAtWorldTime;
    const startedAtWorldTime = status.journey.startedAtWorldTime;
    if (!settledAtWorldTime || !startedAtWorldTime) throw new Error("journey_mirror_time_window_missing");
    const statusRecord = recordValue(status);
    const taskAdjudication = recordValue(statusRecord.taskAdjudication);
    const evidenceEpisodes = (Array.isArray(statusRecord.episodes)
      ? statusRecord.episodes
      : []) as readonly JourneyTaskEvidenceEpisode[];
    const taskPlan = status.journey.taskPlan;
    if (!taskPlan) throw new Error("journey_task_plan_required_for_settlement");
    const existingWorldCommit = status.journey.worldCommit;
    let completedObjectiveIds: readonly string[] = [];
    let requiredMainObjectiveIds: readonly string[] = [];
    let bonusMainObjectiveIds: readonly string[] = [];
    let relevantSideObjectiveIds: readonly string[] = [];
    let mainLineSucceeded = false;
    let hiddenComplete = false;
    const graphState = journeyTaskGraphState(taskPlan, evidenceEpisodes);
    // Canonical completion is derived from the signed task graph, not from
    // a projected count. Only signed complete evidence can satisfy a
    // required main objective.
    completedObjectiveIds = graphState.completedObjectiveIds;
    requiredMainObjectiveIds = graphState.requiredMainObjectiveIds;
    bonusMainObjectiveIds = graphState.bonusMainObjectiveIds;
    relevantSideObjectiveIds = graphState.relevantSideObjectiveIds;
    const completed = new Set(completedObjectiveIds);
    mainLineSucceeded = requiredMainObjectiveIds.length > 0
      && requiredMainObjectiveIds.every((objectiveId) => completed.has(objectiveId));
    hiddenComplete = isRecord(taskAdjudication.hiddenTask)
      ? Boolean(taskAdjudication.hiddenTask.completed)
      : false;
    const journeyEventsBeforeFinalize = new Set(
      companionRuntime.journeyRuntime().projection().events.map((event) => event.eventId),
    );
    drainPendingMirrorConsequences(status.journey.journeyId);
    // Derive SettlementDecision once. This is the single point at which
    // tier / reward / worldCommit are computed. Downstream code reads but
    // never re-derives them.
    const settlementDecision = computeSettlementDecisionForFinalize({
      journeyId: status.journey.journeyId,
      taskPlan,
      evidenceEpisodes,
      taskAdjudication,
      completedObjectiveIds,
      requiredMainObjectiveIds,
      bonusMainObjectiveIds,
      relevantSideObjectiveIds,
      mainLineSucceeded,
      hiddenComplete,
    });
    const completionScoreBps = settlementDecision.score.breakdown.totalBps;
    // canonEligible is derived from the same inequality the authority guard
    // enforces.
    const canonEligible = mainLineSucceeded
      && completionScoreBps >= settlementDecision.worldCommit.thresholdBps;
    // Canonical settlement id = `settlement:${journeyId}:v${SETTLEMENT_POLICY_VERSION}`.
    // Read it from the authority (deriveSettlementId) rather than parsing the
    // reward idempotencyKey — the key layout is `${journeyId}:${settlementId}:reward`,
    // so a naive split/slice(0,2) yields `${journeyId}:settlement`, not the id.
    const settlementId = deriveSettlementId(settlementDecision.journeyId);
    const worldSynchronization = !existingWorldCommit && authoritativeWorldClockEnabled
      ? advanceCanonicalWorld({
          reason: "journey_canon_commit_materialization",
          processedDomains: ["economy", "resources", "factions", "conflicts", "world_events"],
          sourceEventIds: [],
          idempotencyKey: `${String(input.idempotencyKey || status.journey.journeyId).trim()}:canon-sync`,
          causationId: status.journey.journeyId,
          correlationId: status.journey.correlationId,
        })
      : undefined;
    if (status.journey.mirrorTimeRuleVersion !== 2) {
      throw new Error("journey_mirror_time_rule_unsupported");
    }
    const committedAtWorldTime = existingWorldCommit?.committedAtWorldTime ?? clockIso(configuredWorldClock);
    // Read live mirror-ledger entries from the journey projection. The
    // companion runtime's `mirrorLedgers[journeyId]` is the single in-memory
    // truth; `listMirrorConsequences` excludes discarded and promoted entries
    // by default, returning only the live collateral candidates.
    const journeyProjection = companionRuntime.journeyRuntime().projection();
    const mirrorLedger = journeyProjection.mirrorLedgers[status.journey.journeyId];
    const liveMirrorEntries = mirrorLedger
      ? listMirrorConsequences(mirrorLedger)
      : ([] as readonly MirrorConsequenceLedgerEntry[]);
    const allMirrorEntries = mirrorLedger
      ? listMirrorConsequences(mirrorLedger, { includeDiscarded: true, includePromoted: true })
      : ([] as readonly MirrorConsequenceLedgerEntry[]);
    if (existingWorldCommit
      && existingWorldCommit.status !== (canonEligible ? "solidified" : "discarded")) {
      throw new Error("journey_world_commit_replay_conflict");
    }
    let worldSolidification: ReturnType<typeof epochRuntime.solidifyJourneyWorld> | undefined;
    // PR4: pass the decision's totalBps + threshold + policyVersion +
    // settlementId through to solidifyJourneyWorld. The authority in
    // gameCore.solidifyJourneyWorld independently re-validates the threshold
    // so a low-score completed main cannot solidify.
    let worldCommit: NonNullable<EpochJourney["worldCommit"]>;
    if (existingWorldCommit) {
      worldCommit = existingWorldCommit;
      if (existingWorldCommit.status === "solidified") {
        worldSolidification = epochRuntime.solidifyJourneyWorld({
          journeyId: status.journey.journeyId,
          agentId: status.journey.agentId,
          regionId: status.journey.destinationRegionId,
          completedObjectiveIds,
          requiredMainObjectiveIds,
          mirrorStartedAtWorldTime: startedAtWorldTime,
          mirrorEndedAtWorldTime: settledAtWorldTime,
          committedAtWorldTime: existingWorldCommit.committedAtWorldTime,
          completionTier: pr4CompletionTierForSolidify(settlementDecision.tier),
          completionScoreBps,
          worldSliceHash: status.journey.worldSlice?.sliceHash,
          correlationId: status.journey.correlationId,
          causationId: status.journey.journeyId,
          mirrorLedgerEntries: liveMirrorEntries,
          canonThresholdBps: CANON_THRESHOLD_BPS,
          settlementPolicyVersion: SETTLEMENT_POLICY_VERSION,
          consequenceScorePolicyVersion: CONSEQUENCE_SCORE_POLICY_VERSION,
          settlementId,
          consequenceScoreBreakdown: {
            resultScoreBps: settlementDecision.score.breakdown.resultScoreBps,
            selfLossScoreBps: settlementDecision.score.breakdown.selfLossScoreBps,
            collateralScoreBps: settlementDecision.score.breakdown.collateralScoreBps,
          },
        });
      }
    } else if (canonEligible) {
      worldSolidification = epochRuntime.solidifyJourneyWorld({
          journeyId: status.journey.journeyId,
          agentId: status.journey.agentId,
          regionId: status.journey.destinationRegionId,
          completedObjectiveIds,
          requiredMainObjectiveIds,
          mirrorStartedAtWorldTime: startedAtWorldTime,
          mirrorEndedAtWorldTime: settledAtWorldTime,
          committedAtWorldTime,
          completionTier: pr4CompletionTierForSolidify(settlementDecision.tier),
          completionScoreBps,
          worldSliceHash: status.journey.worldSlice?.sliceHash,
          correlationId: status.journey.correlationId,
          causationId: status.journey.journeyId,
          mirrorLedgerEntries: liveMirrorEntries,
          canonThresholdBps: CANON_THRESHOLD_BPS,
          settlementPolicyVersion: SETTLEMENT_POLICY_VERSION,
          consequenceScorePolicyVersion: CONSEQUENCE_SCORE_POLICY_VERSION,
          settlementId,
          consequenceScoreBreakdown: {
            resultScoreBps: settlementDecision.score.breakdown.resultScoreBps,
            selfLossScoreBps: settlementDecision.score.breakdown.selfLossScoreBps,
            collateralScoreBps: settlementDecision.score.breakdown.collateralScoreBps,
          },
        });
      worldCommit = worldSolidification.value;
    } else {
      worldCommit = {
          mode: "mirror" as const,
          status: "discarded" as const,
          completionTier: settlementDecision.tier,
          // The reason is copied directly from the canonical settlement
          // decision; no alternate reason vocabulary is accepted here.
          reason: settlementDecision.worldCommit.reason,
          regionId: status.journey.destinationRegionId,
          committedAtWorldTime,
          influenceDelta: 0,
          factionStandings: [],
          npcRelationships: [],
          sourceEventIds: [],
          // PR4 additive receipt-audit fields on the discarded commit.
          completionScoreBps,
          canonThresholdBps: CANON_THRESHOLD_BPS,
          settlementPolicyVersion: SETTLEMENT_POLICY_VERSION,
          consequenceScorePolicyVersion: CONSEQUENCE_SCORE_POLICY_VERSION,
          settlementId,
          consequenceScoreBreakdown: {
            resultScoreBps: settlementDecision.score.breakdown.resultScoreBps,
            selfLossScoreBps: settlementDecision.score.breakdown.selfLossScoreBps,
            collateralScoreBps: settlementDecision.score.breakdown.collateralScoreBps,
          },
      };
    }
    const viabilityEntries = existingWorldCommit?.status === "discarded"
      ? allMirrorEntries
      : liveMirrorEntries;
    const discardRoleplayScore = !canonEligible
      ? roleplayScoreFromMirrorLedger({
          entries: viabilityEntries,
          journeyId: status.journey.journeyId,
          recordedAt: committedAtWorldTime,
        })
      : undefined;
    const viabilityProjection = !canonEligible
      ? epochRuntime.projectJourneySettlementViability({
          journeyId: status.journey.journeyId,
          agentId: status.journey.agentId,
          settlementId,
          doubtEvents: discardRoleplayScore?.npcDoubtEvents ?? [],
          projectedAt: committedAtWorldTime,
        })
      : undefined;
    // PR2: synchronise the runtime projection's mirror ledger with the
    // solidify/discard decision. gameCore's internal ledger is ephemeral; the
    // projection's `mirrorLedgers[journeyId]` is the persistent truth read on
    // restart. Without this sync, a restart would see live entries where the
    // gameCore had already promoted or discarded them, and replay would
    // double-count.
    if (canonEligible && worldSolidification) {
      const marker = [
        ...worldSolidification.events,
        ...epochRuntime.interactionEvents(0),
      ].find((event): event is Extract<EpochEvent,
        { readonly eventType: "journey_world_solidified" }> =>
        event.eventType === "journey_world_solidified"
        && event.payload.journeyId === status.journey.journeyId);
      if (!marker) throw new Error("journey_world_solidified_marker_missing");
      const promotions = marker.payload.mirrorLedgerPromotions;
      if (promotions.length > 0) {
        const postLedger = companionRuntime.status({
          ...input,
          journeyId: status.journey.journeyId,
        });
        companionRuntime.journeyRuntime().promoteMirrorConsequences({
          journeyId: status.journey.journeyId,
          expectedVersion: postLedger.journey.version,
          promotions,
        });
      }
    } else {
      // canonEligible=false: discard every non-promoted entry. Reads the
      // fresh version after any prior recovery event.
      const postLedger = companionRuntime.status({
        ...input,
        journeyId: status.journey.journeyId,
      });
      companionRuntime.journeyRuntime().discardMirrorConsequences({
        journeyId: status.journey.journeyId,
        expectedVersion: postLedger.journey.version,
      });
    }
    const worldCommitRecord = existingWorldCommit
      ? companionRuntime.status({ ...input, journeyId: status.journey.journeyId })
      : companionRuntime.recordWorldCommit({
          ...input,
          journeyId: status.journey.journeyId,
          expectedVersion: companionRuntime.status({
            ...input,
            journeyId: status.journey.journeyId,
          }).journey.version,
          worldCommit,
          idempotencyKey: `${String(input.idempotencyKey || status.journey.journeyId).trim()}:world-commit`,
        });
    const finalizeStatus = companionRuntime.status({ ...input, journeyId: status.journey.journeyId });
    // Capture journey events emitted by the drain + promote/discard calls
    // above. recordWorldCommit's events are already attached to
    // worldCommitRecord; the diff below covers everything else so the
    // persistence pipeline sees one monotonic event stream on restart.
    const finalizeMirrorEvents = companionRuntime.journeyRuntime()
      .projection().events
      .filter((event) => !journeyEventsBeforeFinalize.has(event.eventId));
    // PR6: project world-feedback signals from settled state. These signals
    // are injected into the NEXT prompt as narrative context (no numeric values).
    let feedbackSignals: readonly WorldFeedbackSignal[] | undefined;
    if (settlementDecision) {
      const doubtEntries = (existingWorldCommit ? allMirrorEntries : liveMirrorEntries)
        .filter((entry) => entry.effectKind === "identity_doubt")
        .map((entry) => ({
          npcId: typeof entry.effectBlueprint.npcId === "string"
            ? entry.effectBlueprint.npcId
            : "unknown",
          doubtStrength: entry.effectBlueprint.doubtStrength as "low" | "moderate" | "high" | "severe",
          sourceActionEventId: entry.actionEventId,
          regionId: status.journey.destinationRegionId,
        }));
      const identityProgress = epochRuntime.progress({ agentId: status.journey.agentId });
      const identityRecord = recordValue(identityProgress.identity);
      const viability = identityRecord.identityViability as
        | { readonly flaggedWanted?: unknown; readonly identityExposed?: boolean }
        | undefined;
      const rawFlaggedWanted = viability?.flaggedWanted;
      const flaggedWanted = rawFlaggedWanted instanceof Set
        ? rawFlaggedWanted as ReadonlySet<string>
        : new Set<string>(
            Array.isArray(rawFlaggedWanted)
              ? rawFlaggedWanted.filter((v: unknown): v is string => typeof v === "string")
              : [],
          );
      const factionStandingDeltas = worldCommit && worldCommit.status === "solidified"
        ? (worldCommit.factionStandings ?? []).map((standing: { readonly factionId?: string; readonly delta?: number; readonly sourceEventId?: string }) => ({
            factionId: standing.factionId ?? "",
            delta: standing.delta ?? 0,
            sourceEventId: standing.sourceEventId ?? "",
          }))
        : [];
      feedbackSignals = projectFeedbackSignals({
        identityId: status.journey.agentId,
        doubtEntries,
        viability: {
          flaggedWanted,
          identityExposed: Boolean(viability?.identityExposed),
        },
        factionStandingDeltas,
        projectedAt: new Date().toISOString(),
      });
    }
    const finalizeResult = {
      status: finalizeStatus,
      worldSynchronization,
      worldSolidification,
      viabilityProjection,
      worldCommitRecord,
      settlementDecision,
      feedbackSignals,
      mirrorLedgerEntries: allMirrorEntries,
    };
    // Attach in-place (attachJourneyEventsForPersistence mutates via
    // Object.defineProperty) to preserve the plain-return type inference.
    // Merging worldCommitRecord's events + the drain/promote/discard events
    // ensures the persistence pipeline receives one monotonic event stream.
    const worldCommitJourneyEvents = journeyEventsForPersistence(worldCommitRecord);
    const worldCommitEventIds = new Set(worldCommitJourneyEvents.map((event) => event.eventId));
    const allFinalizeJourneyEvents = [
      ...worldCommitJourneyEvents,
      ...finalizeMirrorEvents.filter((event) => !worldCommitEventIds.has(event.eventId)),
    ];
    attachJourneyEventsForPersistence(finalizeResult, allFinalizeJourneyEvents);
    attachEpochEventsForPersistence(finalizeResult, [
      ...(worldSynchronization ? epochEventsForPersistence(worldSynchronization) : []),
      ...(worldSolidification ? epochEventsForPersistence(worldSolidification) : []),
      ...(viabilityProjection ? epochEventsForPersistence(viabilityProjection) : []),
    ]);
    return finalizeResult;
  }

  function commitJourneyActionRuntime(input: AnyRecord = {}) {
    const session = epochRuntime.journeyHostedSession(input);
    if (!session.sceneContract) {
      throw new Error("journey_scene_contract_not_found");
    }
    return finalizeJourneyActionRuntime(input);
  }

  async function commitJourneyIntentRuntime(input: AnyRecord = {}) {
    const current = companionRuntime.status(input);
    const action = await epochRuntime.commitJourneyHostedIntentWithServerModelInternal({
      ...input,
      correlationId: current.journey.correlationId,
      causationId: input.sceneId,
    });
    const journeyResult = finalizeJourneyActionRuntime(input, action);
    const publicIntent = publicIntentCommandResult(action);
    const journeyRecord = recordValue(journeyResult);
    const journeyView = { ...journeyResult } as AnyRecord;
    delete journeyView.sceneContract;
    delete journeyView.settledAction;
    delete journeyView.returnAction;
    const result = {
      ...journeyView,
      episode: journeyRecord.episode ?? journeyRecord.objectiveEpisode ?? journeyRecord.mainEpisode,
      value: publicIntent.value,
      events: publicIntent.events,
      projection: publicIntent.projection,
    };
    Object.defineProperty(result, "projection", {
      value: publicIntent.projection,
      enumerable: false,
    });
    attachEpochEventsForPersistence(result, [
      ...epochEventsForPersistence(journeyResult),
      ...epochEventsForPersistence(publicIntent),
    ]);
    attachJourneyEventsForPersistence(result, journeyEventsForPersistence(journeyResult));
    return result;
  }

  function finalizeJourneyActionRuntime(
    input: AnyRecord = {},
    action?: ReturnType<typeof epochRuntime.commitJourneyHostedAction>,
  ) {
    const session = epochRuntime.journeyHostedSession(input);
    if (!session.sceneContract) {
      throw new Error("journey_scene_contract_not_found");
    }
    const main = commitSingleJourneyStepRuntime(input, action);
    const current = companionRuntime.status(input);
    const recallOnlyMain = Boolean(current.journey.taskPlan
      && main.episode.phase === "main"
      && main.episode.serverFacts?.storyBeat?.selectedAction.optionKey === "recall_without_objective"
      && main.episode.serverFacts.storyBeat.selectedAction.taskObjectiveId === undefined);
    const nextTaskObjective = current.journey.taskPlan && !recallOnlyMain
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
    const returnedTaskPlan = returned.journey.taskPlan;
    if (!returnedTaskPlan) throw new Error("journey_task_plan_required_for_settlement");
    const settled = companionRuntime.settleCompleted({
      ...input,
      journeyId: returned.journey.journeyId,
      expectedVersion: returned.journey.version,
      idempotencyKey: `${String(input.idempotencyKey || "").trim()}:settle-completed`,
    });
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
    const settlementDecision = mirrorFinalization.settlementDecision;
    // PR4: tier is the authority-derived tier from SettlementDecision when the
    // journey actually reached the mirror-finalize path (settled + mirror +
    // no prior worldCommit). For all other cases finalizeSettledMirrorWorld
    // early-returns with settlementDecision=undefined; no reward is granted,
    // and completionTier=undefined correctly skips the grant branch below.
    //
    // taskAdjudication.tier is intentionally NOT read — adjudicateJourneyTask
    // no longer computes tier (spec: "adjudicateJourneyTask 不再算 tier"); the
    // no alternate tier projection exists here.
    const completionTier = settlementDecision
      ? settlementDecision.tier
      : undefined;
    if (completionTier && !settlementDecision) {
      throw new Error("journey_settlement_decision_missing");
    }
    const rewardSourceEventIds = [...new Set((Array.isArray(finalStatusRecord.episodes)
      ? finalStatusRecord.episodes
      : []).flatMap((episodeValue) => {
        const episode = recordValue(episodeValue);
        const serverFacts = recordValue(episode.serverFacts);
        return Array.isArray(serverFacts.sourceEventIds)
          ? serverFacts.sourceEventIds.filter((eventId): eventId is string => typeof eventId === "string" && Boolean(eventId.trim()))
          : [];
      }))];
    // A Phase 6 journey's task family is authoritative experiment state.  The
    // public journey view deliberately omits taskRequest.taskFamilyId, so
    // reading only that view silently drops material rewards at settlement.
    // Resolve the family from the server-owned run binding first; the public
    // journey value remains only the legacy, non-Phase-6 fallback.
    const phase6RunStore = recordValue(epochOptions).phase6ExperimentStore as
      | { loadRunByJourneyId?: (journeyId: string) => unknown }
      | undefined;
    const phase6Run = typeof phase6RunStore?.loadRunByJourneyId === "function"
      ? recordValue(phase6RunStore.loadRunByJourneyId(returned.journey.journeyId))
      : {};
    const phase6RunIndex = Number(phase6Run.runIndex);
    const phase6TaskFamilyId = Number.isInteger(phase6RunIndex)
      && PHASE6_RUN_INDEXES.includes(phase6RunIndex as (typeof PHASE6_RUN_INDEXES)[number])
      ? phase6ScenarioForRun(phase6RunIndex).taskFamilyId
      : undefined;
    const rewardGrant = completionTier && completionTier !== "未及格"
      ? epochRuntime.grantJourneyReward({
          journeyId: returned.journey.journeyId,
          agentId: returned.journey.agentId,
          tier: completionTier,
          taskPlan: returnedTaskPlan,
          hiddenTaskSeal: resolveJourneyHiddenTaskSeal(
            returned.journey.journeyId,
            returnedTaskPlan,
          ),
          sourceEventIds: rewardSourceEventIds,
          taskFamilyId: phase6TaskFamilyId ?? returned.journey.taskRequest?.taskFamilyId,
          correlationId: returned.journey.correlationId,
          causationId: returned.journey.journeyId,
          // PR4: scope the idempotency reason to the settlementId so a
          // policy bump re-grants under a new key and a duplicate call
          // collapses.
          settlementId: deriveSettlementId(settlementDecision!.journeyId),
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
      // PR6: feedback signals projected from settled state.
      ...(mirrorFinalization.feedbackSignals ? { feedbackSignals: mirrorFinalization.feedbackSignals } : {}),
    };
    attachEpochEventsForPersistence(result, [
      ...epochEventsForPersistence(main),
      ...epochEventsForPersistence(returnProposal),
      ...epochEventsForPersistence(returned),
      ...(mirrorFinalization.worldSynchronization
        ? epochEventsForPersistence(mirrorFinalization.worldSynchronization)
        : []),
      ...(worldSolidification ? epochEventsForPersistence(worldSolidification) : []),
      ...(mirrorFinalization.viabilityProjection
        ? epochEventsForPersistence(mirrorFinalization.viabilityProjection)
        : []),
      ...(rewardGrant ? epochEventsForPersistence(rewardGrant) : []),
    ]);
    return mergeJourneyEventsForPersistence(
      result,
      main,
      returning,
      returned,
      settled,
      mirrorFinalization,
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
      }, { recallOnly: true });
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
      // The recall creates a server-hosted main-scene proposal before it
      // commits the signed withdrawal.  Both records are canonical evidence:
      // persisting only the commit leaves receipts referring to a proposal
      // event that SQLite cannot replay or verify.
      attachEpochEventsForPersistence(result, [
        ...epochEventsForPersistence(proposal),
        ...epochEventsForPersistence(recalled),
      ]);
      return mergeJourneyEventsForPersistence(result, proposal, recalled);
    }
    return companionRuntime.recall(input);
  }

  function parseLLMJson(text: string, context: string): AnyRecord {
    // Try to extract JSON from the response (may be wrapped in markdown code blocks)
    const jsonMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/) || [null, text];
    const jsonStr = (jsonMatch[1] ?? text).trim();
    try {
      const parsed = JSON.parse(jsonStr);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        throw new Error(`gm_${context}_response_not_object`);
      }
      return parsed;
    } catch {
      throw new Error(`gm_${context}_response_invalid_json`);
    }
  }

  function requireString(value: unknown, field: string): string {
    if (typeof value !== "string" || !value.trim()) throw new Error(`${field}_required`);
    return value.trim();
  }

  async function journeyGMActRuntime(input: AnyRecord = {}): Promise<AnyRecord> {
    const journeyId = requireString(input.journeyId, "journey_id");
    const narrative = requireString(input.narrative, "narrative");
    const idempotencyKey = requireString(input.idempotencyKey, "idempotency_key");

    if (!modelAdapter) throw new Error("model_adapter_required");

    // Read current world state
    const statusValue = companionRuntime.status({ journeyId, ...input });
    const status = recordValue(statusValue);
    const journeyStatus = (status as AnyRecord).journey as AnyRecord | undefined;
    if (!journeyStatus || journeyStatus.status !== "gm_active") throw new Error("journey_gm_status_invalid");

    // Build world state snapshot
    const { buildWorldState, buildKnownFacts, applyDataBoundaries, buildGMEpisode, DEFAULT_HARD_RULES, buildAdjudicatorSystemPrompt, buildAdjudicatorUserPrompt, buildNarratorSystemPrompt, buildNarratorUserPrompt } = await import("./epoch/gmModeRules.ts");
    const snapshot = buildWorldState(companionRuntime, journeyId);
    const knownFacts = buildKnownFacts(snapshot.episodes);

    // Get recent episode summaries for context
    const recentHistory = snapshot.episodes.slice(-3).map((ep) =>
      ep.serverFacts?.storyBeat?.outcomeSummary ?? ""
    ).filter(Boolean);

    // Hard rule pre-check (code-level, no LLM)
    const { hardRulePreCheck } = await import("./epoch/gmModeRules.ts");
    const preCheck = hardRulePreCheck(narrative, snapshot, DEFAULT_HARD_RULES);
    if (preCheck.blocked) {
      return {
        ...statusValue,
        actionValid: false,
        narrative: preCheck.reason,
        npcDialogue: {},
        atmosphere: "无法行动",
        sensoryDetails: {},
        discoveredInfo: [],
        agentState: {
          money: snapshot.agent.resources.money,
          stamina: snapshot.agent.resources.stamina,
          health: snapshot.agent.resources.health,
          location: snapshot.agent.location,
        },
      };
    }

    // Call LLM for adjudication
    const adjudicatorPrompt = buildAdjudicatorSystemPrompt({ hardRules: DEFAULT_HARD_RULES, snapshot, knownFacts });
    const adjudicatorUserPrompt = buildAdjudicatorUserPrompt({ playerNarrative: narrative, snapshot, recentHistory });
    const adjudicatorResponse = await modelAdapter.complete({
      systemPrompt: adjudicatorPrompt,
      messages: [{ role: "user", content: adjudicatorUserPrompt }],
      responseFormat: "json_object",
      maxTokens: 2000,
    });
    const judgment = parseLLMJson(adjudicatorResponse.text, "adjudicator") as unknown as import("./epoch/gmModeRules.ts").AdjudicatorOutput;

    // Apply data boundaries
    const validatedChanges = applyDataBoundaries(judgment, snapshot, DEFAULT_HARD_RULES);

    // Call LLM for narration
    const narratorPrompt = buildNarratorSystemPrompt();
    const narratorUserPrompt = buildNarratorUserPrompt({ judgment, playerNarrative: narrative, agentName: snapshot.agent.name });
    const narratorResponse = await modelAdapter.complete({
      systemPrompt: narratorPrompt,
      messages: [{ role: "user", content: narratorUserPrompt }],
      responseFormat: "json_object",
      maxTokens: 3000,
    });
    const narration = parseLLMJson(narratorResponse.text, "narrator") as unknown as import("./epoch/gmModeRules.ts").NarratorOutput;

    // Build episode
    const episodeIndex = snapshot.episodes.filter((ep) => ep.candidateId === "scene:gm:free_action").length + 1;
    const episode = buildGMEpisode({
      journeyId,
      index: episodeIndex,
      playerNarrative: narrative,
      snapshot,
      judgment,
      narration,
      validatedChanges,
    });

    // Commit episode
    const committed = companionRuntime.commitGMEpisode({
      journeyId,
      expectedVersion: snapshot.journey.version,
      episode,
      idempotencyKey,
    });

    return {
      ...committed,
      narrative: narration.narrative,
      npcDialogue: narration.npcDialogue,
      atmosphere: narration.atmosphere,
      innerThoughts: narration.innerThoughts,
      sensoryDetails: narration.sensoryDetails,
      discoveredInfo: judgment.informationConsequences.discovered,
      agentState: {
        money: validatedChanges.agent.money,
        stamina: validatedChanges.agent.stamina,
        health: validatedChanges.agent.health,
        location: validatedChanges.agent.location,
      },
      availableReactions: judgment.availableReactions,
    };
  }

  async function phase6ExperimentStatusView(experimentId: string): Promise<AnyRecord> {
    const statusMethod = (epochRuntime as AnyRecord).phase6ExperimentStatus;
    const runMethod = (epochRuntime as AnyRecord).phase6ExperimentRun;
    if (typeof statusMethod !== "function" || typeof runMethod !== "function") {
      throw new Error("phase6_experiment_runtime_unavailable");
    }
    const summary = recordValue(await statusMethod.call(epochRuntime, { experimentId }));
    const identityId = optionalString(summary.identityId);
    if (!identityId) throw new Error("phase6_experiment_identity_missing");
    const explorer = phase6ExperimentExplorerForStatus(summary);
    const runs: AnyRecord[] = [];
    for (const runIndex of PHASE6_RUN_INDEXES) {
      const candidate = await runMethod.call(epochRuntime, { experimentId, runIndex });
      if (!candidate) continue;
      const run = recordValue(candidate);
      const state = optionalString(run.state);
      const runReceipt = recordValue(run.runReceipt);
      const receiptId = optionalString(runReceipt.receiptId);
      if (!state || !receiptId) {
        throw new Error("phase6_experiment_run_status_invalid");
      }
      runs.push({
        runIndex,
        scenarioTag: phase6ScenarioForRun(runIndex).tag,
        state,
        receipt: {
          receiptId,
          ...(optionalString(runReceipt.receiptVersion)
            ? { receiptVersion: optionalString(runReceipt.receiptVersion) }
            : {}),
        },
      });
    }
    return {
      experimentId: optionalString(summary.experimentId) || experimentId,
      state: optionalString(summary.state) || "planned",
      identity: { identityId },
      explorer,
      scenarioMatrix: PHASE6_EXPERIMENT_SCENARIO_MATRIX,
      versions: PHASE6_EXPERIMENT_VERSION_BINDING,
      runs,
    };
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
      return publicCommunityMutationResult(communityLedger.react(input));
    },
    communityComment: (input: AnyRecord) => {
      assertPublicSafe(input);
      return communityLedger.comment(input);
    },
    communityFlag: (input: AnyRecord) => {
      assertPublicSafe(input);
      return communityLedger.flag(input);
    },
    communityModerate: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      // Reuse the canonical operator-key check so the legacy community queue
      // has the same fail-closed boundary as Epoch moderation endpoints.
      epochRuntime.operatorOverview({
        operatorKey: input.operatorKey,
        limit: 1,
      });
      return communityLedger.moderate(input);
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
    epochEconomyActions: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.economyActions(input);
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
    epochPrepareJourney: async (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      // PR3: route offer-driven prepares through the async claim+resolve
      // path. questOfferId presence (and the offer-runtime wiring) is what
      // flips the journey into offer-driven mode; the sync prepare path
      // handles the non-offer case.
      if (typeof input.questOfferId === "string" && input.questOfferId.trim()) {
        return await companionRuntime.prepareWithOffer(input);
      }
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
    epochTransitionToGM: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return companionRuntime.transitionJourneyToGM(input);
    },
    epochJourneyGMAct: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return journeyGMActRuntime(input);
    },
    epochSettleGMJourney: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      const result = companionRuntime.settleGMJourney(input);
      // Grant reward if tier is not 未及格
      if (result.completionTier !== "未及格" && result.reward.amount > 0) {
        const statusValue = companionRuntime.status({ journeyId: result.journeyId, ...input });
        const status = recordValue(statusValue);
        const agentId = ((status as AnyRecord).journey as AnyRecord | undefined)?.agentId;
        if (typeof agentId === "string" && agentId.trim()) {
          epochRuntime.grantGMSettlementReward({
            journeyId: result.journeyId,
            agentId,
            tier: result.completionTier,
            resourceId: result.reward.resourceId,
            amount: result.reward.amount,
            ...(typeof input.idempotencyKey === "string" ? { idempotencyKey: input.idempotencyKey } : {}),
          });
        }
      }
      return result;
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
    epochAdvanceWorldClockInternal: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return advanceCanonicalWorld({
        reason: optionalString(input.reason) || "server_world_tick",
        processedDomains: Array.isArray(input.processedDomains)
          ? input.processedDomains.filter((value): value is string => typeof value === "string")
          : ["world_simulation"],
        sourceEventIds: Array.isArray(input.sourceEventIds)
          ? input.sourceEventIds.filter((value): value is string => typeof value === "string")
          : [],
        idempotencyKey: stringValue(input.idempotencyKey),
        causationId: optionalString(input.causationId),
        correlationId: optionalString(input.correlationId),
        ...(typeof input.elapsedWorldMinutes === "number" && Number.isFinite(input.elapsedWorldMinutes)
          ? { elapsedWorldMinutes: input.elapsedWorldMinutes }
          : {}),
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
    epochResolveTurnIntent: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      assertOperationSwitchOpen({
        action: "settlement",
        ...operationDimensionsFromInput(input),
      });
      return epochRuntime.resolveTurnCardIntentWithServerModel(input);
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
    epochSubmitHostedIntent: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.submitHostedIntentWithServerModel(input);
    },
    epochCommitJourneyIntent: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return commitJourneyIntentRuntime(input);
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
    epochSubmitWebBridgeIntent: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return epochRuntime.submitWebBridgeIntent(input);
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
    epochBeginPhase6Experiment: async (input: AnyRecord = {}) => {
      const readInput = phase6ExperimentMcpValue(validatePhase6BeginExperimentInput(input));
      assertPublicSafe(readInput);
      const boundInput = {
        ...readInput,
        experimentId: phase6ExperimentId(readInput),
        scenarioMatrix: PHASE6_EXPERIMENT_SCENARIO_MATRIX,
        versions: PHASE6_EXPERIMENT_VERSION_BINDING,
      };
      try {
        const method = (epochRuntime as AnyRecord).createPhase6Experiment;
        if (typeof method !== "function") throw new Error("phase6_experiment_runtime_unavailable");
        const result = recordValue(await method.call(epochRuntime, boundInput));
        phase6ExperimentExplorerBindings.set(boundInput.experimentId, readInput.explorer as unknown as AnyRecord);
        return {
          ...result,
          experimentId: boundInput.experimentId,
          state: "planned",
          identity: readInput.identity,
          explorer: readInput.explorer,
          scenarioMatrix: PHASE6_EXPERIMENT_SCENARIO_MATRIX,
          versions: PHASE6_EXPERIMENT_VERSION_BINDING,
        };
      } catch (error) {
        phase6ExperimentRuntimeError(error);
      }
    },
    epochBeginPhase6Run: async (input: AnyRecord = {}) => {
      try {
      const readInput = phase6ExperimentMcpValue(validatePhase6BeginRunInput(input));
      assertPublicSafe(readInput);
        const status = await phase6ExperimentStatusView(readInput.experimentId);
        const experimentIdentityId = optionalString(recordValue(status.identity).identityId);
        if (!experimentIdentityId) throw new Error("phase6_experiment_identity_missing");
        const explorer = phase6ExperimentExplorerForStatus(status);

        // Auto-determine runIndex from existing runs if not provided
        const existingRuns = Array.isArray(status.runs) ? status.runs : [];
        const usedRunIndexes = new Set(
          existingRuns
            .map((r) => Number(recordValue(r).runIndex))
            .filter((n) => Number.isInteger(n)),
        );
        const runIndex = readInput.runIndex
          ?? PHASE6_RUN_INDEXES.find((idx) => !usedRunIndexes.has(idx));
        if (runIndex === undefined) throw new Error("phase6_experiment_no_available_run_index");

        // Auto-determine scenarioTag from the scenario matrix if not provided
        const scenario = phase6ScenarioForRun(runIndex);
        const scenarioTag = readInput.scenarioTag ?? scenario.tag;
        assertPhase6ScenarioBinding(runIndex, scenarioTag, scenario.taskFamilyId);

        // Idempotency: if this run already exists, return the existing binding
        const existingRun = existingRuns.find((r) => Number(recordValue(r).runIndex) === runIndex);
        if (existingRun) {
          const existingRunData = recordValue(existingRun);
          return {
            ...existingRunData,
            experimentId: readInput.experimentId,
            runIndex,
            scenarioTag: optionalString(existingRunData.scenarioTag) || scenario.tag,
            state: optionalString(existingRunData.state) || "running",
            identity: recordValue(existingRunData.identity),
            explorer,
            scenarioMatrix: PHASE6_EXPERIMENT_SCENARIO_MATRIX,
            versions: PHASE6_EXPERIMENT_VERSION_BINDING,
            seed: recordValue(existingRunData.seed),
            runReceipt: recordValue(existingRunData.runReceipt),
            startJourneyBinding: recordValue(existingRunData.startJourneyBinding),
          };
        }

        // Auto-resolve journeyId from the most recent prepared journey for this identity
        let journeyId = readInput.journeyId;
        if (!journeyId) {
          const projection = companionRuntime.journeyRuntime().projection();
          const candidateIds = projection.journeyIdsByAgent[experimentIdentityId] ?? [];
          for (let i = candidateIds.length - 1; i >= 0; i--) {
            const candidateId = candidateIds[i];
            if (typeof candidateId !== "string") continue;
            const record = projection.journeys[candidateId];
            if (record && record.journey.status === "prepared") {
              journeyId = candidateId;
              break;
            }
          }
        }
        if (!journeyId) throw new Error("phase6_experiment_journey_binding_missing");

        // Auto-generate commandId from experimentId + runIndex if not provided
        const commandId = readInput.commandId
          ?? `phase6_cmd_${phase6ExperimentHash("begin_phase6_run_command", { experimentId: readInput.experimentId, runIndex })}`;

        const resolvedInput = { commandId, experimentId: readInput.experimentId, runIndex, scenarioTag, journeyId };
        const seed = phase6RunSeed(resolvedInput);
        const runReceipt = phase6RunReceipt(resolvedInput);
        const journeyBinding = phase6JourneyBinding(resolvedInput as unknown as AnyRecord);
        const boundJourneyId = optionalString(journeyBinding.journeyId);
        if (!boundJourneyId || !optionalString(journeyBinding.runId)) {
          throw new Error("phase6_experiment_journey_binding_missing");
        }
        const boundInput = {
          commandId,
          experimentId: readInput.experimentId,
          run: {
            runIndex,
            scenarioTag: scenario.tag,
            identity: {},
            scenarioMatrix: PHASE6_EXPERIMENT_SCENARIO_MATRIX,
            versions: PHASE6_EXPERIMENT_VERSION_BINDING,
            seed,
            runReceipt,
            journeyId: boundJourneyId,
          },
        };
        const preparedStatus = companionRuntime.journeyRuntime().status(boundJourneyId);
        const preparedJourney = recordValue(preparedStatus.journey);
        if (optionalString(preparedJourney.status) !== "prepared") {
          throw new Error("phase6_experiment_journey_not_prepared");
        }
        const preparedIdentityId = optionalString(preparedJourney.agentId);
        if (!preparedIdentityId) throw new Error("phase6_experiment_journey_identity_missing");
        if (optionalString(preparedJourney.explorerId) !== optionalString(explorer.explorerId)) {
          throw new Error("phase6_experiment_journey_explorer_mismatch");
        }
        const preparedIdentityArchive = recordValue(epochRuntime.identityArchive({ agentId: preparedIdentityId }));
        const lineage = Array.isArray(preparedIdentityArchive.lineage)
          ? preparedIdentityArchive.lineage.filter((entry): entry is string => typeof entry === "string")
          : [];
        if (preparedIdentityId !== experimentIdentityId && !lineage.includes(experimentIdentityId)) {
          throw new Error("phase6_experiment_journey_identity_lineage_mismatch");
        }
        const identity = { identityId: preparedIdentityId };
        assertPhase6ScenarioBinding(runIndex, scenarioTag, scenario.taskFamilyId);
        const expectedVersion = Number(preparedJourney.version);
        if (!Number.isInteger(expectedVersion) || expectedVersion < 0) {
          throw new Error("phase6_experiment_journey_version_invalid");
        }
        const method = (epochRuntime as AnyRecord).beginPhase6ExperimentRun;
        if (typeof method !== "function") throw new Error("phase6_experiment_runtime_unavailable");
        const result = recordValue(await method.call(epochRuntime, {
          ...boundInput,
          explorer,
          run: {
            ...boundInput.run,
            identity,
            explorer,
          },
        }));
        const metadata = {
          ...result,
          experimentId: readInput.experimentId,
          runIndex,
          scenarioTag: scenario.tag,
          journeyId: boundJourneyId,
          runId: optionalString(journeyBinding.runId),
          expectedVersion,
          identity,
          explorer,
          scenarioMatrix: PHASE6_EXPERIMENT_SCENARIO_MATRIX,
          versions: PHASE6_EXPERIMENT_VERSION_BINDING,
          seed,
          runReceipt,
        };
        if (optionalString(recordValue(metadata.explorer).explorerId) !== optionalString(explorer.explorerId)) {
          throw new Error("phase6_experiment_explorer_mismatch");
        }
        return {
          ...metadata,
          startJourneyBinding: phase6ExperimentStartJourneyBinding(metadata, scenario.tag),
        };
      } catch (error) {
        phase6ExperimentRuntimeError(error);
      }
    },
      epochPhase6ExperimentStatus: async (input: AnyRecord = {}) => {
      const readInput = phase6ExperimentMcpValue(validatePhase6ExperimentStatusInput(input));
      assertPublicSafe(readInput);
      try {
        return phase6ExperimentStatusView(readInput.experimentId);
      } catch (error) {
        phase6ExperimentRuntimeError(error);
      }
      },
      epochPhase6ExperimentRun: (input: AnyRecord = {}) => {
        assertPublicSafe(input);
        const method = (epochRuntime as AnyRecord).phase6ExperimentRun;
        if (typeof method !== "function") throw new Error("phase6_experiment_runtime_unavailable");
        return method.call(epochRuntime, input);
      },
      epochPhase6ExperimentRunByJourneyId: (input: AnyRecord = {}) => {
        assertPublicSafe(input);
        const store = recordValue(epochOptions).phase6ExperimentStore as
          | { loadRunByJourneyId?: (journeyId: string) => unknown }
          | undefined;
        if (typeof store?.loadRunByJourneyId !== "function") throw new Error("phase6_experiment_runtime_unavailable");
        const journeyId = optionalString(input.journeyId);
        if (!journeyId) throw new Error("phase6_journey_id_required");
        return store.loadRunByJourneyId(journeyId);
      },
      epochCapturePhase6JourneyStart: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      const method = (epochRuntime as AnyRecord).capturePhase6JourneyStart;
      if (typeof method !== "function") throw new Error("phase6_experiment_runtime_unavailable");
      return method.call(epochRuntime, input);
    },
    epochLoadPhase6JourneyContext: (journeyId: string) => {
      assertPublicSafe({ journeyId });
      const method = (epochRuntime as AnyRecord).loadPhase6JourneyContext;
      if (typeof method !== "function") throw new Error("phase6_experiment_runtime_unavailable");
      return method.call(epochRuntime, journeyId);
    },
    epochCapturePhase6RagTrace: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      const method = (epochRuntime as AnyRecord).capturePhase6RagTrace;
      if (typeof method !== "function") throw new Error("phase6_experiment_runtime_unavailable");
      return method.call(epochRuntime, input);
    },
    epochLoadPhase6RagTraceByBinding: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      const method = (epochRuntime as AnyRecord).loadPhase6RagTraceByBinding;
      if (typeof method !== "function") throw new Error("phase6_experiment_runtime_unavailable");
      return method.call(epochRuntime, input);
    },
    epochListPhase6RagTraces: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      const method = (epochRuntime as AnyRecord).listPhase6RagTraces;
      if (typeof method !== "function") throw new Error("phase6_experiment_runtime_unavailable");
      return method.call(epochRuntime, input);
    },
    epochFinalizePhase6Journey: async (journeyId: string, completion: AnyRecord = {}) => {
      assertPublicSafe({ journeyId, completion });
      const method = (epochRuntime as AnyRecord).finalizePhase6Journey;
      if (typeof method !== "function") throw new Error("phase6_experiment_runtime_unavailable");
      return method.call(epochRuntime, journeyId, completion);
    },
    epochCompletePhase6ExperimentRun: async (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      try {
        const method = (epochRuntime as AnyRecord).completePhase6ExperimentRun;
        if (typeof method !== "function") throw new Error("phase6_experiment_runtime_unavailable");
        return method.call(epochRuntime, input);
      } catch (error) {
        phase6ExperimentRuntimeError(error);
      }
    },
    epochFailPhase6ExperimentRun: async (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      try {
        const method = (epochRuntime as AnyRecord).failPhase6ExperimentRun;
        if (typeof method !== "function") throw new Error("phase6_experiment_runtime_unavailable");
        return method.call(epochRuntime, input);
      } catch (error) {
        phase6ExperimentRuntimeError(error);
      }
    },
    epochPhase6RunReceipt: (input: AnyRecord = {}) => {
      const readInput = phase6McpValue(validatePhase6McpRunReceiptInput(input));
      if (!readInput.receiptId) phase6McpError("not_found");
      assertPublicSafe(readInput);
      const receipt = loadPhase6ReceiptFromSqlite(phase6ReceiptSqlite, readInput.receiptId) as JourneyRunReceipt | undefined;
      if (readInput.journeyId && receipt && receipt.journeyId !== readInput.journeyId) {
        phase6McpError("invalid_receipt");
      }
      return {
        rulesetVersion: PHASE6_MCP_CONTRACT_RULESET_VERSION,
        ...phase6McpValue(validatePhase6McpRunReceiptRead({ receipt })),
      };
    },
    epochPhase6Result: (input: AnyRecord = {}) => {
      const { pageId } = validatePhase6McpPageIdInput(input);
      assertPublicSafe({ pageId });
      const page = phase6ResultPages.get(pageId);
      if (!page) phase6McpError("not_found");
      const sidecar = phase6ResultPages.phase6Sidecar(pageId);
      if (!sidecar || sidecar.ok !== true || !sidecar.page) phase6McpError("settlement_pending");
      const receiptId = sidecar?.page?.receipt.receiptId;
      const receipt = receiptId
        ? loadPhase6ReceiptFromSqlite(phase6ReceiptSqlite, receiptId) as JourneyRunReceipt | undefined
        : undefined;
      return {
        rulesetVersion: PHASE6_MCP_CONTRACT_RULESET_VERSION,
        ...phase6McpValue(validatePhase6McpPhase6ResultRead({
          pageId,
          receiptId: receiptId || pageId,
          receipt,
          result: sidecar?.page,
          verified: true,
        })),
        pageId,
        verified: true,
      };
    },
    epochStorePhase6ResultPage: (page: EpochSharedResultPage) => {
      assertPublicSafe(page);
      phase6ResultPages.set(page.pageId, page);
      return { pageId: page.pageId, stored: true };
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
    infiniteWorldId: () => infiniteWorldId,
    infiniteWorldCommand: async (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      assertInfiniteWorldOwnerOrOperator(input, epochRuntime);
      const command = normalizeInfiniteWorldToolCommand(input, infiniteWorldId);
      const result = await infiniteWorld.execute(command);
      const response = {
        ok: true,
        worldId: result.event.worldId,
        event: result.event,
        manifest: result.manifest,
        replayed: result.replayed,
        duplicate: result.replayed,
        warnings: result.manifest.warnings,
        projectionStatus: result.manifest.projectionStatus,
        health: result.manifest.projectionStatus === "degraded" ? infiniteWorld.health() : undefined,
        epochEvents: result.epochEvents,
      };
      return attachEpochEventsForPersistence(response, result.replayed ? [] : result.epochEvents);
    },
    infiniteWorldSnapshot: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      epochRuntime.operatorOverview({ operatorKey: input.operatorKey, limit: 1 });
      return {
        ok: true,
        worldId: infiniteWorldId,
        snapshot: infiniteWorld.snapshot(),
        checkpoint: infiniteWorld.checkpoint(),
      };
    },
    infiniteWorldPlayerPanel: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      const caller = infiniteWorldReadCaller(input, epochRuntime);
      return {
        ok: true,
        worldId: infiniteWorldId,
        panel: causalPlayerPanel({
          snapshot: infiniteWorld.snapshot(),
          caller,
          identity: infiniteWorldPlayerIdentity(caller, epochRuntime),
          ragQuery: optionalString(input.ragQuery),
          ragPage: {
            cursor: optionalString(input.ragCursor),
            limit: typeof input.ragLimit === "number" ? input.ragLimit : undefined,
          },
          runPage: {
            cursor: optionalString(input.runCursor),
            limit: typeof input.runLimit === "number" ? input.runLimit : undefined,
          },
        }),
      };
    },
    infiniteWorldTenRunAudit: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      const caller = infiniteWorldReadCaller(input, epochRuntime);
      const panel = causalPlayerPanel({
        snapshot: infiniteWorld.snapshot(),
        caller,
        identity: infiniteWorldPlayerIdentity(caller, epochRuntime),
        ragQuery: optionalString(input.ragQuery),
        ragPage: {
          cursor: optionalString(input.ragCursor),
          limit: typeof input.ragLimit === "number" ? input.ragLimit : undefined,
        },
        runPage: { limit: 10 },
      });
      const available = panel.recentRuns.page.total;
      const required = 10;
      if (available < required) {
        return {
          ok: false,
          worldId: infiniteWorldId,
          available,
          required,
          reason: "ten_run_audit_requires_exactly_ten_recent_runs",
          audit: undefined,
        };
      }
      return {
        ok: true,
        worldId: infiniteWorldId,
        available,
        required,
        audit: causalPlayerTenRunAudit(panel),
      };
    },
    infiniteWorldHealth: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      return {
        ok: true,
        worldId: infiniteWorldId,
        health: infiniteWorld.health(),
      };
    },
    infiniteWorldMigrate: (input: AnyRecord = {}) => {
      assertPublicSafe(input);
      epochRuntime.operatorOverview({ operatorKey: input.operatorKey, limit: 1 });
      if (input.dryRun === false) throw new Error("infinite_world_migrate_dry_run_required");
      return {
        ok: true,
        worldId: infiniteWorldId,
        migration: infiniteWorld.migrate(input.snapshot, true),
      };
    },
  };
}
