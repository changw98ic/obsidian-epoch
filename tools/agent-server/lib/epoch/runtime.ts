import { type EpochActivityMedia } from "../activityAssets.ts";
import { resolveEpochCanonicalRegionId } from "../regionAliases.ts";
import { type EpochWorldContextVersions } from "../worldContextVersions.ts";
import {
  assertNonEmptyString,
  createSequentialEpochIdFactory,
  type EpochResourceId,
  type EpochRelationshipKind,
  type EpochDiplomacyResponse,
  type EpochEventType,
  type EpochMessageScope,
  type EpochNpcRelationshipKind,
  type EpochPartyRole,
  type EpochServerReward,
  type EpochChannelClass,
  type EpochCommandContext,
  type EpochTrustClass,
  serverIsoTime,
} from "./protocol.ts";
import {
  createEpochEvent,
  type EpochEvent,
  type ExperimentMainRuleReview,
  type OrganizationTreasuryChangedPayload,
} from "./events.ts";
import {
  type EpochAgentIdentity,
  type EpochAbuseScoreRelease,
  type EpochAbuseScoreDecay,
  type EpochConflictTrace,
  type EpochDirectTrade,
  type EpochGameCoreOptions,
  type EpochHostedActionRecord,
  type EpochHostedSession,
  type EpochInventoryItem,
  type EpochLoreContributionRecord,
  type EpochLoreTargetAdjudication,
  type EpochLegendAward,
  type EpochMarketOrder,
  type EpochMarketRiskRestrictionRelease,
  type EpochMarketRiskRestriction,
  type EpochMessageRecord,
  type EpochModerationItem,
  type EpochNpcCandidate,
  type EpochNpcRecord,
  type EpochOrganization,
  type EpochOrganizationBudget,
  type EpochOrganizationMembership,
  type EpochOrganizationMembershipStatus,
  type EpochOrganizationUpgrade,
  type EpochProjection,
  type EpochRaidResult,
  type EpochRetaliationOpportunity,
  type EpochRegionControl,
  type EpochRegionControlDecay,
  type EpochRegionActivity,
  type EpochRegionInfluenceChange,
  type EpochRegionNews,
  type EpochRiskReview,
  type EpochServerHostedJob,
  type EpochTurnCard,
  type EpochTurnResolution,
  type TraceConflictDeployment,
  type TraceConflictMemoryView,
  type TraceConflictOwnerDeploymentView,
  type TraceConflictRegionView,
  type TickDirectTradeExpiryResult,
  type TickMarketExpiryResult,
  type TickOrganizationPoliticsResult,
  createEpochGameCore,
  sourceEventsMentionAgent,
  traceConflictTemplateCatalog,
} from "./gameCore.ts";
import type { JourneySceneContractSeed } from "./journeySceneContractRules.ts";
import { JOURNEY_FIRST_ENTRY_RESERVE } from "./journeyActionResolutionRules.ts";
import {
  JOURNEY_TIER_REWARDS,
  deriveJourneyHiddenTask,
  journeyRewardBundleForPlan,
  normalizeJourneyCompletionTier,
  type JourneyCompletionTier,
  type JourneyGeneratedTaskPlan,
  type JourneyHiddenTaskSeal,
  type JourneyHiddenTaskSealResolver,
  type JourneyRewardBundle,
} from "./journeyGeneratedTaskRules.ts";
import {
  anomalyEventInputFromOperatorInput,
  anomalyEventInputFromTemplate,
} from "./anomalyEventTemplateRules.ts";
export { anomalyEventTemplateCatalog } from "./anomalyEventTemplateRules.ts";
import {
  contextFromInput,
  maintenanceContext,
  ownerVerifiedContextFromInput,
  untrustedClientContext,
} from "./runtimeCommandContextRules.ts";
import {
  assertNoRequestSecretMaterialInPublicText,
  summarizeRejectedInput,
} from "./runtimeInputSafetyRules.ts";
import {
  createAttestationRuntime,
  type EpochAttestedRunnerConfig,
} from "./attestationRuntime.ts";
import { createExplorationRuntime } from "./explorationRuntime.ts";
import { createDowntimeRuntime } from "./downtimeRuntime.ts";
import { createNpcCandidateRuntime } from "./npcCandidateRuntime.ts";
import { createNpcLifecycleRuntime } from "./npcLifecycleRuntime.ts";
import {
  constantTimeTextEqual,
  createServerIssuedExplorerCredential,
  sha256Hex,
} from "./runtimeAuth.ts";
import {
  type EpochResultPageRunSummary,
} from "./resultRunSummary.ts";
import { createResultPageRuntimeStore } from "./resultPageRuntimeStore.ts";
import { buildEpochResultPagePayload } from "./resultPagePayloadRules.ts";
import {
  type EpochResultPageRegionalContext,
} from "./resultPageContextRules.ts";
import {
  serverHostedContext,
} from "./serverHostedRuntimeRules.ts";
import { createServerHostedRuntime } from "./serverHostedRuntime.ts";
import {
  createMaintenanceRuntime,
  maintenanceIdSegment,
} from "./maintenanceRuntime.ts";
import { auditPageForEventId } from "./sourceEventRules.ts";
import {
  type EpochLoreContributionsInfo,
  type EpochLoreTargetsInfo,
} from "./loreReadModel.ts";
import { webBridgeTurnView, type EpochWebBridgeTurn } from "./webBridgeReadModel.ts";
import { type EpochDirectTradeInfo, type EpochMarketInfo, type EpochRegionMarketSummary } from "./marketReadModel.ts";
import { maintenanceView } from "./maintenanceReadModel.ts";
import { npcCandidatesView } from "./npcCandidateReadModel.ts";
import {
  confirmationActionForAuthScope,
  highValueConfirmationSubjectHash,
  turnCardResponseEnvelope,
} from "./highValueConfirmationRules.ts";
import { createHighValueConfirmationRuntime } from "./highValueConfirmationRuntime.ts";
import {
  attachEpochEventsForPersistence,
  commandResult,
  epochEventsForPersistence,
  publicProjection,
  withInternalEvents,
  type EpochRuntimeResult,
} from "./runtimePublicProjectionRules.ts";
export type { EpochRuntimeResult } from "./runtimePublicProjectionRules.ts";
import { createRuntimeIdempotencyRuntime } from "./runtimeIdempotencyRuntime.ts";
import {
  abuseProfilesInfoView,
  auditInfoView,
  moderationInfoView,
  operatorOverviewInfoView,
  type EpochAbuseProfilesView,
  type EpochAuditInfo,
  type EpochModerationInfo,
  type EpochOperatorOverview,
} from "./operatorRuntimeReadModel.ts";
import {
  anomaliesInfoView,
  objectivesInfoView,
  resourceNodesInfoView,
  type EpochAnomalyInfo,
  type EpochObjectivesInfo,
  type EpochResourceNodeInfo,
} from "./encounterRuntimeReadModel.ts";
import {
  regionFactionPressureView,
  regionFrontlinesView,
  regionRaidHeatView,
  regionRaidTargetsView,
  tracesView,
  type EpochRegionFactionPressure,
  type EpochRegionFactionPressureStatus,
  type EpochRegionFrontline,
  type EpochRegionFrontlineStatus,
  type EpochRegionRaidHeat,
  type EpochRegionRaidHeatStatus,
  type EpochRegionRaidTarget,
  type EpochRegionRaidTargetRecommendationReason,
} from "./regionConflictReadModel.ts";
import {
  locationMotifQuotasView,
  regionCommissionsView,
  type EpochLocationMotif,
  type EpochLocationMotifQuota,
  type EpochRegionCommission,
  type EpochRegionCommissionSourceType,
} from "./regionCommissionReadModel.ts";
import { createRegionNewsRuntime } from "./regionNewsRuntime.ts";
import { npcInfoView, regionInfoView, type EpochNpcInfo, type EpochRegionInfo } from "./regionInfoReadModel.ts";
import {
  agentNpcBondsInfoView,
  householdsInfoView,
  npcAssetsInfoView,
  npcCareersInfoView,
  npcHealthInfoView,
  npcLocationsInfoView,
  npcMemoriesInfoView,
  npcRelationshipsInfoView,
  organizationInfoView,
  organizationPoliticsInfoView,
  socialHooksInfoView,
  type EpochAgentNpcBondInfo,
  type EpochHouseholdInfo,
  type EpochNpcAssetInfo,
  type EpochNpcCareerInfo,
  type EpochNpcHealthInfo,
  type EpochNpcLocationInfo,
  type EpochNpcMemoryInfo,
  type EpochNpcRelationshipInfo,
  type EpochOrganizationInfo,
  type EpochOrganizationPoliticsInfo,
  type EpochSocialHookInfo,
} from "./organizationNpcReadModel.ts";
import {
  createPublicWorldReadModelRuntime,
  type EpochAgentBriefingView,
  type EpochAgentPublicRegionalContextView,
  type EpochHostedSessionWatchInfo,
  type EpochWorldOverviewInfo,
} from "./publicWorldReadModel.ts";
import {
  seasonArchiveInfoView,
  seasonCampaignRuntimeView,
  seasonRuntimeResultView,
  seasonsInfoView,
  type EpochSeasonArchiveInfo,
  type EpochSeasonCampaignInfo,
} from "./seasonRuntimeReadModel.ts";
import {
  diplomacyInfoView,
  relationshipsInfoView,
  type EpochDiplomacyInfo,
  type EpochRelationshipGraphInfo,
} from "./socialRuntimeReadModel.ts";
import {
  directTradesInfoView,
  inventoryInfoView,
  marketInfoView,
  shopInfoView,
  type EpochInventoryInfo,
  type EpochShopInfo,
} from "./economyRuntimeReadModel.ts";
import {
  bountiesInfoView,
  partyRunsInfoView,
  raidsInfoView,
  type EpochBountyInfo,
  type EpochPartyRunInfo,
  type EpochRaidInfo,
} from "./combatRuntimeReadModel.ts";
import {
  eventsInfoView,
  messagesInfoView,
  progressInfoView,
  type EpochClaimableLegendNewsInfo,
  type EpochEquipmentEffectInfo,
  type EpochInventoryItemInfo,
  type EpochMessagesInfo,
  type EpochPendingDowntimePreviewInfo,
  type EpochProgressView,
  type EpochRegionActiveAgent,
} from "./activityRuntimeReadModel.ts";
import { hostedSessionsInfoView, type EpochHostedSessionInfo } from "./hostedSessionRuntimeReadModel.ts";
import {
  agentMemoryInfoView,
  explorerProfileInfoView,
  identityArchiveInfoView,
  personalMigrationInfoView,
  type EpochAgentMemoryInfo,
  type EpochExplorerProfileInfo,
  type EpochIdentityArchiveInfo,
  type EpochPersonalMigrationSummary,
} from "./identityRuntimeReadModel.ts";
import { createExplorerAuthRuntime } from "./explorerAuthRuntime.ts";
import {
  playerDataExportView,
  type EpochPlayerDataExport,
} from "./playerDataExportReadModel.ts";
import {
  competitiveLadderView,
  type EpochCompetitiveLadderDimension,
  type EpochCompetitiveLadderMode,
  type EpochCompetitiveLadderView,
} from "./competitiveLadderReadModel.ts";
import {
  createRuntimeAbuseRuntime,
  type EpochRuntimeAbuseLimits,
} from "./runtimeAbuseRuntime.ts";
export type { EpochAbuseStatus } from "./runtimeAbuseRuntime.ts";
import {
  canonicalRegionIdFromInput,
  canonicalRegionIdOrDefault,
  runtimeAbuseActorKey,
  runtimeObjectiveTemplate,
  runtimeSeasonTemplate,
} from "./runtimeInputRules.ts";
export {
  EPOCH_ACTIVE_IDENTITY_RECOMMENDED_TOOLS,
  EPOCH_ACTIVE_IDENTITY_TOOL_NAMES,
  EPOCH_ARCHIVED_IDENTITY_RECOMMENDED_TOOLS,
} from "./actionEligibilityReadModel.ts";
export type { EpochActionEligibilityInfo, EpochActionEligibilityStatus } from "./actionEligibilityReadModel.ts";
export type {
  EpochAttestationChallenge,
  EpochAttestationChallengeResult,
  EpochAttestedRunnerConfig,
  EpochAttestedRunnerTrustClass,
} from "./attestationRuntime.ts";
export type { EpochHighValueConfirmationAction } from "./highValueConfirmationRules.ts";
export type {
  EpochHighValueConfirmation,
  EpochHighValueConfirmationConfirmResult,
  EpochHighValueConfirmationListResult,
  EpochHighValueConfirmationRequestResult,
  EpochHighValueConfirmationStatus,
} from "./highValueConfirmationRuntime.ts";
export type { EpochAgentMemoryInfo, EpochAgentMemoryItem, EpochAgentMemoryLayer } from "./identityRuntimeReadModel.ts";
export type {
  EpochAuditEventSummary,
  EpochAuditInfo,
  EpochAuditRiskAgentProfile,
  EpochAuditRiskProfile,
  EpochAuditRiskReviewSummary,
} from "./operatorRuntimeReadModel.ts";
export type { EpochExplorerProfileInfo, EpochExplorerProfileSummary } from "./identityRuntimeReadModel.ts";
export type {
  EpochDirectTradeInfo,
  EpochDirectTradeView,
  EpochMarketInfo,
  EpochRegionMarketResourceSummary,
  EpochRegionMarketSummary,
} from "./marketReadModel.ts";
export type {
  EpochMaintenanceEventSummary,
  EpochMaintenanceEventType,
  EpochMaintenanceHealthInfo,
  EpochMaintenanceInfo,
  EpochMaintenanceWorkerHealth,
  EpochMaintenanceWorkerHealthStatus,
  EpochMaintenanceWorkerKey,
  EpochOperatorHealthStatus,
} from "./maintenanceReadModel.ts";
export type {
  EpochAbuseProfileView,
  EpochAbuseProfilesView,
  EpochAttestedRunnerOverviewItem,
  EpochAttestedRunnersOverview,
  EpochGrowthMetric,
  EpochGrowthMetricKey,
  EpochGrowthQualityGuardrailKey,
  EpochGrowthQualityGuardrailMetric,
  EpochGrowthQualityOverview,
  EpochModerationInfo,
  EpochNpcCandidateReviewOverview,
  EpochOperatorHealthInfo,
  EpochOperatorOverview,
  EpochOperatorOverviewSummary,
} from "./operatorRuntimeReadModel.ts";
export type {
  EpochDisputeArchiveGate,
  EpochDisputeArchiveGateStatus,
  EpochLoreAdjudicationOverview,
  EpochLoreContributionInfo,
  EpochLoreContributionsInfo,
  EpochLoreTargetAdjudicationInfo,
  EpochLoreTargetLineageDisplay,
  EpochLoreTargetStatus,
  EpochLoreTargetStatusCounts,
  EpochLoreTargetStatusInfo,
  EpochLoreTargetStatusSource,
  EpochLoreTargetsInfo,
  EpochWorldHonorBoard,
  EpochWorldHonorBoardEntry,
  EpochWorldHonorCategory,
  EpochWorldviewGate,
  EpochWorldviewGateCheck,
  EpochWorldviewGateCheckKey,
  EpochWorldviewGateCheckStatus,
  EpochWorldviewGateDeferredRuleSet,
  EpochWorldviewGateScope,
} from "./loreReadModel.ts";
export type {
  EpochAgentBriefingView,
  EpochAgentBriefingWorldSummary,
  EpochAgentPublicRegionalContextView,
  EpochHostedSessionWatchIdentity,
  EpochHostedSessionWatchInfo,
  EpochWorldOverviewInfo,
  EpochWorldOverviewLegendaryDeath,
  EpochWorldOverviewRecentResult,
  EpochWorldOverviewRegionHighlight,
} from "./publicWorldReadModel.ts";
export type {
  EpochPersonalMigrationDisposition,
  EpochPersonalMigrationSummary,
  EpochPersonalMigrationSummaryItem,
} from "./identityRuntimeReadModel.ts";
export type { EpochNpcInfo, EpochNpcPublicRecord, EpochRegionInfo } from "./regionInfoReadModel.ts";
export type {
  EpochAgentNpcBondInfo,
  EpochHouseholdInfo,
  EpochNpcAssetInfo,
  EpochNpcCareerInfo,
  EpochNpcHealthInfo,
  EpochNpcLocationInfo,
  EpochNpcMemoryInfo,
  EpochNpcRelationshipInfo,
  EpochOrganizationInfo,
  EpochOrganizationPoliticsInfo,
  EpochSocialHookInfo,
} from "./organizationNpcReadModel.ts";
export type {
  EpochInventoryInfo,
  EpochShopInfo,
} from "./economyRuntimeReadModel.ts";
export type { EpochBountyInfo, EpochPartyRunInfo, EpochPartyRunView, EpochRaidInfo } from "./combatRuntimeReadModel.ts";
export type { EpochDiplomacyInfo, EpochRelationshipGraphInfo } from "./socialRuntimeReadModel.ts";
export type {
  EpochAnomalyInfo,
  EpochObjectivesInfo,
  EpochResourceNodeInfo,
} from "./encounterRuntimeReadModel.ts";
export type {
  EpochClaimableLegendNewsInfo,
  EpochEquipmentEffectInfo,
  EpochInventoryItemInfo,
  EpochPendingDowntimePreviewInfo,
  EpochProgressView,
} from "./activityRuntimeReadModel.ts";
export type { EpochResultPageRegionalContext } from "./resultPageContextRules.ts";
export type {
  EpochRegionFactionPressure,
  EpochRegionFactionPressureStatus,
  EpochRegionFrontline,
  EpochRegionFrontlineStatus,
  EpochRegionRaidHeat,
  EpochRegionRaidHeatStatus,
  EpochRegionRaidTarget,
  EpochRegionRaidTargetRecommendationReason,
} from "./regionConflictReadModel.ts";
export type {
  EpochLocationMotif,
  EpochLocationMotifBias,
  EpochLocationMotifDensityStatus,
  EpochLocationMotifDisplayMode,
  EpochLocationMotifQuota,
  EpochPrefileIsolation,
  EpochPrefileIsolationLayer,
  EpochPrefileIsolationReason,
  EpochRegionCommission,
  EpochRegionCommissionSourceType,
  EpochSecretExposureTier,
  EpochSecretRevealBudget,
} from "./regionCommissionReadModel.ts";
export type { EpochMessagesInfo, EpochRegionActiveAgent } from "./activityRuntimeReadModel.ts";
export type { EpochRegionLeaderboardEntry } from "./regionLeaderboardReadModel.ts";
export type {
  EpochSeasonArchiveInfo,
  EpochSeasonCampaignInfo,
  EpochSeasonCampaignView,
  EpochSeasonContributionAudit,
  EpochSeasonContributionAuditGroup,
  EpochSeasonContributionDailyTotal,
  EpochSeasonFactionStandingView,
} from "./seasonRuntimeReadModel.ts";
export type { EpochHostedSessionWatchAction } from "./hostedSessionReadModel.ts";
export type { EpochIdentityArchiveInfo } from "./identityRuntimeReadModel.ts";
export type { EpochWebBridgeActionOption, EpochWebBridgeTurn } from "./webBridgeReadModel.ts";

type AnyRecord = Record<string, unknown>;

function isRecord(value: unknown): value is AnyRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function recordValue(value: unknown): AnyRecord {
  return isRecord(value) ? value : {};
}

function optionalString(value: unknown) {
  return typeof value === "string" && value ? value : undefined;
}

function optionalNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function traceConflictTargetFromInput(input: AnyRecord) {
  const targetKind = optionalString(input.targetKind);
  const targetId = optionalString(input.targetId);
  if (!targetKind && !targetId) return undefined;
  if (targetKind !== "agent" && targetKind !== "npc") {
    throw new Error("trace_conflict_target_kind_invalid");
  }
  return {
    kind: targetKind,
    id: assertNonEmptyString(targetId, "trace_conflict_target_id_required"),
  } as const;
}

export interface EpochRuntimeOptions extends EpochGameCoreOptions {
  readonly initialResultPages?: readonly EpochSharedResultPage[];
  readonly resolveJourneyHiddenTaskSeal?: JourneyHiddenTaskSealResolver;
  readonly attestedRunners?: readonly EpochAttestedRunnerConfig[];
  readonly abuseLimits?: EpochRuntimeAbuseLimits;
  readonly operatorKey?: string;
  readonly registrationSecret?: string;
}

export interface EpochMaintenanceRunSummary {
  readonly tickId: string;
  readonly ranAt: string;
  readonly npc: {
    readonly events: number;
  };
  readonly organizationPolitics: {
    readonly events: number;
  };
  readonly market: {
    readonly events: number;
  };
  readonly resourceNodes: {
    readonly events: number;
    readonly spawned: number;
    readonly settled: number;
    readonly skipped: number;
  };
  readonly anomalies: {
    readonly events: number;
    readonly spawned: number;
    readonly skipped: number;
  };
  readonly seasons: {
    readonly events: number;
    readonly started: number;
    readonly settled: number;
    readonly skipped: number;
  };
  readonly serverHostedJobs: {
    readonly events: number;
    readonly completed: number;
    readonly skipped: number;
  };
  readonly abuse: {
    readonly events: number;
    readonly decayed: number;
  };
  readonly regionControls: {
    readonly events: number;
    readonly decayed: number;
  };
  readonly persistedEvents: number;
}

export interface EpochServerHostedActionRun {
  readonly session: EpochHostedSession;
  readonly action: EpochHostedActionRecord;
}

export interface EpochRegisterExplorerResult extends EpochRuntimeResult<EpochAgentIdentity> {
  readonly explorerId: string;
  readonly recoveryCode: string;
}

export interface EpochExplorerAuthVerification {
  readonly explorerId: string;
  readonly verified: true;
}

export interface EpochExplorationRun {
  readonly agentId: string;
  readonly explorerId: string;
  readonly regionId: string;
  readonly mandate: string;
  readonly stepCount: number;
  readonly sessions: readonly EpochHostedSession[];
  readonly actions: readonly EpochHostedActionRecord[];
  readonly resultPage: EpochSharedResultPage;
}

export interface EpochServerHostedJobsInfo {
  readonly agentId?: string;
  readonly status?: string;
  readonly jobs: readonly EpochServerHostedJob[];
}

export interface EpochServerHostedJobRun {
  readonly job: EpochServerHostedJob;
  readonly run?: EpochServerHostedActionRun;
}

export interface EpochWebBridgeActionResult {
  readonly channelClass: "browser_copy_paste";
  readonly deliveryTrust: "untrusted_client";
  readonly action: EpochHostedActionRecord;
}

export type EpochResultPageNextActionKind = "continue_turn" | "open_commission" | "resolve_retaliation" | "set_downtime" | "view_archive" | "reincarnate";
export type EpochResultPageNextActionSourceType = EpochRegionCommissionSourceType | "retaliation";

export interface EpochResultPageNextAction {
  readonly actionId: string;
  readonly kind: EpochResultPageNextActionKind;
  readonly label: string;
  readonly reason: string;
  readonly toolName: string;
  readonly regionId?: string;
  readonly sourceType?: EpochResultPageNextActionSourceType;
  readonly sourceId?: string;
  readonly media?: EpochActivityMedia;
  readonly requiresRecoveryCode?: boolean;
}

export type EpochResultPageReceiptFocusKind = "turn_card" | "hosted_session" | "agent_snapshot" | "explorer_snapshot";
export type EpochResultPlayMode = "ranked" | "casual" | "sandbox" | "verified";
export type EpochResultTrustTier = "server_settled" | "untrusted_capped" | "private_sandbox" | "verified_autonomous";

export interface EpochResultPageReceiptEvent {
  readonly eventId: string;
  readonly eventType: EpochEventType;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly trustClass: EpochTrustClass | string;
  readonly createdAt: string;
  readonly auditUrl: string;
}

export interface EpochTrustedExecutionReceipt {
  readonly receiptType: "trusted_execution_receipt";
  readonly attestationId: string;
  readonly runnerId: string;
  readonly runnerKeyId?: string;
  readonly challengeId: string;
  readonly sessionId: string;
  readonly actionId: string;
  readonly actionOptionId: string;
  readonly optionLabel: string;
  readonly transcriptHash: string;
  readonly signatureBase: string;
  readonly signatureHash: string;
  readonly signatureBaseHash: string;
  readonly resultPagePayloadHash: string;
  readonly attestationAuditUrl?: string;
  readonly actionAuditUrl?: string;
}

export interface EpochResultPageReceipt {
  readonly receiptType: "server_result_receipt";
  readonly payloadHash: string;
  readonly generatedAt: string;
  readonly channelClass: EpochChannelClass | EpochTrustClass | string;
  readonly deliveryTrust: EpochTrustClass | string;
  readonly playMode: EpochResultPlayMode;
  readonly trustTier: EpochResultTrustTier;
  readonly agentId?: string;
  readonly explorerId?: string;
  readonly focus: {
    readonly kind: EpochResultPageReceiptFocusKind;
    readonly id: string;
  };
  readonly trustClasses: readonly (EpochTrustClass | string)[];
  readonly trustedExecution: readonly EpochTrustedExecutionReceipt[];
  readonly canonicalEvents: readonly EpochResultPageReceiptEvent[];
}

export interface EpochResultPagePayload {
  readonly pageType: "agent_result";
  readonly generatedAt: string;
  readonly publicSafeSummary: EpochPublicSafeSummary;
  readonly progress: EpochProgressView;
  readonly runSummary?: EpochResultPageRunSummary;
  readonly publicPages?: {
    readonly world: string;
    readonly console: string;
    readonly agent?: string;
    readonly explorer?: string;
  };
  readonly nextActions: readonly EpochResultPageNextAction[];
  readonly receipt: EpochResultPageReceipt;
  readonly regionalContext?: EpochResultPageRegionalContext;
  readonly focusTurnCard?: EpochTurnCard;
  readonly focusHostedSession?: EpochHostedSession;
  readonly journey?: EpochResultPageJourney;
}

export interface EpochResultPageJourneyEpisode {
  readonly episodeId: string;
  readonly title: string;
  readonly outcomeKey: string;
  readonly phase?: "arrival" | "main" | "side" | "return";
  readonly participants: readonly { readonly id: string; readonly type: string; readonly label: string }[];
  readonly sourceEventIds: readonly string[];
  readonly serverFacts?: import("./journeyNarrativeRules.ts").ServerJourneyEpisodeFacts;
  readonly narrative?: import("./journeyNarrativeRules.ts").PersistedJourneyNarrative;
  readonly generatedTaskObjective?: import("./journeyGeneratedTaskRules.ts").JourneyGeneratedTaskObjective;
  readonly settlement?: {
    readonly reward?: {
      readonly resourceId: import("./protocol.ts").EpochResourceId;
      readonly amount: number;
    };
  };
}

export interface EpochResultPageJourney {
  readonly journeyId: string;
  readonly correlationId: string;
  readonly status: string;
  readonly objective: string;
  readonly regionId: string;
  readonly worldMode?: import("./journeyRules.ts").JourneyWorldMode;
  readonly worldCommit?: import("./journeyRules.ts").JourneyWorldCommit;
  readonly startedAtWorldTime?: string;
  readonly dueAtWorldTime?: string;
  readonly episodes: readonly EpochResultPageJourneyEpisode[];
  readonly canonicalEventIds: readonly string[];
  readonly taskPlan?: import("./journeyGeneratedTaskRules.ts").JourneyGeneratedTaskPlan;
  readonly mission?: import("./journeyMissionReadModel.ts").JourneyMission;
  readonly storyReport?: import("./journeyStoryReport.ts").GroundedJourneyStoryReport;
  readonly stateDelta?: {
    readonly outcomeSummary?: string;
    readonly reward?: {
      readonly resourceId?: string;
      readonly amount?: number;
    };
    readonly rewardBundle?: import("./journeyGeneratedTaskRules.ts").JourneyRewardBundle;
  };
}

export interface EpochResultPageDraft extends EpochResultPagePayload {
  readonly publishToken: string;
}

export type EpochSharedResultPageStatus = "active" | "revoked" | "deleted";
export type EpochPublicSafeSummaryExcludedSourceClass =
  | "adjudication_verdict"
  | "review_reason"
  | "hidden_constraint_prompt"
  | "event_payload_body";

export interface EpochPublicSafeSummary {
  readonly summaryType: "public_safe_summary";
  readonly source: "server_public_summary";
  readonly text: string;
  readonly excludedSourceClasses: readonly EpochPublicSafeSummaryExcludedSourceClass[];
}

export type EpochDeletionRequestCategory =
  | "hide_body"
  | "anonymize_source"
  | "withdraw_unadmitted_candidate"
  | "request_de_admission_review";
export type EpochDeletionRequestCategoryStatus = "completed" | "available" | "not_applicable" | "review_required";

export interface EpochDeletionRequestCategoryInfo {
  readonly category: EpochDeletionRequestCategory;
  readonly label: string;
  readonly status: EpochDeletionRequestCategoryStatus;
  readonly summary: string;
}

export interface EpochDeletionRequestClassification {
  readonly selectedCategory: EpochDeletionRequestCategory;
  readonly selectedLabel: string;
  readonly categories: readonly EpochDeletionRequestCategoryInfo[];
  readonly sharedSettingRule: {
    readonly referencedByMultiple: "request_de_admission_review_only";
    readonly summary: string;
  };
}

export interface EpochDeletedResultPageReferenceFact {
  readonly key: "pageId" | "focusKind" | "focusIdHash" | "canonicalEventCount";
  readonly value: string | number;
}

export interface EpochDeletedResultPageMinimalReference {
  readonly referenceType: "deleted_result_page_minimal_reference";
  readonly anonymousSourceHash: string;
  readonly claimFacts: readonly EpochDeletedResultPageReferenceFact[];
  readonly removedBodyClasses: readonly string[];
}

export interface EpochResultPageDeletionSummary {
  readonly pageId: string;
  readonly createdAt: string;
  readonly expiresAt?: string;
  readonly createdBy: string;
  readonly ownerExplorerId: string;
  readonly agentId?: string;
  readonly explorerId?: string;
  readonly receiptFocus: EpochResultPageReceipt["focus"];
  readonly receiptPayloadHash: string;
  readonly fullPayloadHash: string;
  readonly canonicalEventIds: readonly string[];
  readonly minimalReference: EpochDeletedResultPageMinimalReference;
  readonly deletedAt: string;
  readonly deletedBy: string;
  readonly deleteReason: string;
  readonly deletionRequest?: EpochDeletionRequestClassification;
  readonly retainedFacts: readonly string[];
}

export interface EpochSharedResultPage {
  readonly pageId: string;
  readonly createdAt: string;
  readonly expiresAt?: string;
  readonly urlPath: string;
  readonly payload?: EpochResultPagePayload;
  readonly publicSafeSummary?: EpochPublicSafeSummary;
  readonly createdBy: string;
  readonly idempotencyKey: string;
  readonly idempotencySubjectHash?: string;
  /** Persisted on lifecycle revisions so restart replay can return that exact revision. */
  readonly lifecycleIdempotencyKey?: string;
  readonly status?: EpochSharedResultPageStatus;
  readonly shareVersion?: number;
  readonly shareTokenHash?: string;
  readonly revokedAt?: string;
  readonly revokedBy?: string;
  readonly revokeReason?: string;
  readonly deletedAt?: string;
  readonly deletedBy?: string;
  readonly deleteReason?: string;
  readonly deletionSummary?: EpochResultPageDeletionSummary;
}

export interface CreateEpochResultPageResult {
  readonly page: EpochSharedResultPage;
  readonly duplicate?: boolean;
}

export interface EpochResultPageAccessResult {
  readonly status:
    | "available"
    | "missing"
    | "share_token_required"
    | "share_token_mismatch"
    | "share_version_required"
    | "share_version_mismatch"
    | "revoked"
    | "deleted"
    | "expired";
  readonly statusCode: number;
  readonly page?: EpochSharedResultPage;
}

const DEFAULT_ATTESTATION_CHALLENGE_TTL_MS = 5 * 60_000;
const DEFAULT_HIGH_VALUE_CONFIRMATION_TTL_MS = 10 * 60_000;
const ANOMALY_SKIP_ERRORS = new Set(["anomaly_event_region_open"]);
const SYSTEM_IDENTITY_ORIGINS = [
  "雾钟站", "黑石码头", "镜湖工坊", "赤砂哨所", "北墙温室", "星槎坞",
  "旧渠", "风蚀塔", "浮桥集市", "月井营地", "灰烬观测站", "回声仓城",
] as const;
const SYSTEM_IDENTITY_UNITS = [
  "第七采样组", "夜航班", "边界测绘队", "临时实验组", "外勤救援队", "遗迹勘探组",
  "生态观察班", "城外猎行队", "补给调度组", "设备检修班", "入门试炼营", "数据校准所",
] as const;
const SYSTEM_IDENTITY_ROLES = [
  "见习记录员", "样本护送员", "设备检修员", "外勤助理", "试炼候补", "变异兽猎手",
  "数据校准员", "药圃照料员", "补给联络员", "遗迹勘探员", "安全观察员", "生态采样员",
] as const;

function systemAssignedIdentityName(input: { readonly explorerId: string; readonly generation: number }) {
  const digest = sha256Hex(`${input.explorerId}:${input.generation}`);
  const origin = SYSTEM_IDENTITY_ORIGINS[Number.parseInt(digest.slice(0, 8), 16) % SYSTEM_IDENTITY_ORIGINS.length]!;
  const unit = SYSTEM_IDENTITY_UNITS[Number.parseInt(digest.slice(8, 16), 16) % SYSTEM_IDENTITY_UNITS.length]!;
  const role = SYSTEM_IDENTITY_ROLES[Number.parseInt(digest.slice(16, 24), 16) % SYSTEM_IDENTITY_ROLES.length]!;
  return `${origin}${unit}${role} · 第${input.generation}世`;
}

export function createEpochRuntime(options: EpochRuntimeOptions = {}) {
  const core = createEpochGameCore({
    ...options,
    identityNameFactory: options.identityNameFactory || systemAssignedIdentityName,
  });
  const clock = options.clock || (() => new Date());
  const runtimeIdFactory = options.idFactory || createSequentialEpochIdFactory();
  const abuseRuntime = createRuntimeAbuseRuntime({
    abuseLimits: options.abuseLimits,
    clock,
    project: () => core.project(),
  });
  const assertAbuseAllowed = abuseRuntime.assertAllowed;
  const operatorKey = typeof options.operatorKey === "string" ? options.operatorKey.trim() : "";
  const explorerAuthRuntime = createExplorerAuthRuntime({
    project: () => core.project(),
    publicProjection,
    assertAbuseAllowed,
    ownerVerifiedContextFromInput,
    rotateExplorerRecovery: (input, context) => commandResult(core.rotateExplorerRecovery(input, context)),
  });
  const resultPageRuntime = createResultPageRuntimeStore({
    clock,
    idFactory: options.idFactory,
    initialPages: options.initialResultPages || [],
    canonicalEpochEvents: () => core.project().events,
    resolveJourneyHiddenTaskSeal: options.resolveJourneyHiddenTaskSeal,
    assertExplorerAuth: explorerAuthRuntime.assertExplorerAuth,
    assertOperatorKey,
    assertCreateAllowed: (input) => assertAbuseAllowed(input, { allowRestrictedScore: true }),
  });
  const publicWorldReadModel = createPublicWorldReadModelRuntime({
    clock,
    maxDowntimeSeconds: options.maxDowntimeSeconds,
    project: () => core.project(),
    resultPages: resultPageRuntime,
  });

  const highValueConfirmationRuntime = createHighValueConfirmationRuntime({
    clock,
    confirmationTtlMs: DEFAULT_HIGH_VALUE_CONFIRMATION_TTL_MS,
    idFactory: runtimeIdFactory,
    project: () => core.project(),
    assertAbuseAllowed,
    assertExplorerAuth: explorerAuthRuntime.assertExplorerAuth,
    untrustedClientContext,
    ownerVerifiedContextFromInput,
  });

  const idempotencyRuntime = createRuntimeIdempotencyRuntime({
    project: () => core.project(),
    publicProjection,
    assertAbuseAllowed,
    authorizeExplorerAction: (scope, input, explorerId) => {
      if (typeof input.confirmationToken === "string" && input.confirmationToken.trim().length > 0) {
        const confirmationAction = confirmationActionForAuthScope(scope);
        if (!confirmationAction) throw new Error("high_value_confirmation_action_invalid");
        return highValueConfirmationRuntime.consume(input, confirmationAction, highValueConfirmationSubjectHash({
          action: confirmationAction,
          request: input,
          turnCard: confirmationAction === "resolve_turn"
            ? core.project().turnCards[String(input.turnCardId || "")]
            : undefined,
        }));
      }
      explorerAuthRuntime.assertExplorerAuth(input, explorerId);
      return [];
    },
  });
  const idempotently = idempotencyRuntime.idempotently;
  const idempotentlyWithSubject = idempotencyRuntime.idempotentlyWithSubject;
  const idempotentlyForExplorerRegistration = idempotencyRuntime.idempotentlyForExplorerRegistration;
  const idempotentlyAfterExplorerAuth = idempotencyRuntime.idempotentlyAfterExplorerAuth;
  const explorerRegistrationResults = new Map<string, EpochRegisterExplorerResult>();
  const explorerRegistrationSubjectHashes = new Map<string, string>();

  const attestationRuntime = createAttestationRuntime({
    clock,
    defaultChallengeTtlMs: DEFAULT_ATTESTATION_CHALLENGE_TTL_MS,
    idFactory: runtimeIdFactory,
    runners: options.attestedRunners || [],
    project: () => core.project(),
    assertAbuseAllowed,
    requireActiveIdentity: requireRuntimeActiveIdentity,
    submitHostedAction: (input, context) => commandResult(core.submitHostedAction(input, context)),
  });

  const serverHostedRuntime = createServerHostedRuntime({
    assertOperatorKey,
    assertPublicTextSafe: assertNoRequestSecretMaterialInPublicText,
    idempotently,
    requireIdentity: requireRuntimeIdentity,
    project: () => core.project(),
    startHostedSession: (input, context) => commandResult(core.startHostedSession(input, context)),
    submitHostedAction: (input, context) => commandResult(core.submitHostedAction(input, context)),
    queueServerHostedJob: (input, context) => commandResult(core.queueServerHostedJob(input, context)),
    canRunServerHostedJobOption: (input, context) => core.canRunServerHostedJobOption(input, context),
    completeServerHostedJob: (input, context) => commandResult(core.completeServerHostedJob(input, context)),
    skipServerHostedJob: (input, context) => commandResult(core.skipServerHostedJob(input, context)),
  });

  const explorationRuntime = createExplorationRuntime({
    assertPublicTextSafe: assertNoRequestSecretMaterialInPublicText,
    idempotently: idempotentlyAfterExplorerAuth,
    requireIdentity: requireRuntimeIdentity,
    project: () => core.project(),
    publicProjection: () => publicProjection(core.project()),
    now: () => serverIsoTime(clock),
    maxDowntimeSeconds: options.maxDowntimeSeconds,
    ownerVerifiedContext: ownerVerifiedContextFromInput,
    startHostedSession: (input, context) => commandResult(core.startHostedSession(input, context)),
    submitHostedAction: (input, context) => commandResult(core.submitHostedAction(input, context)),
    createResultPageFromPayload: resultPageRuntime.createFromPayload,
  });

  const regionNewsRuntime = createRegionNewsRuntime({
    project: () => core.project(),
    generateRegionNews: (input, context) => commandResult(core.generateRegionNews(input, context)),
  });

  const appendRegionNewsForServerEvent = regionNewsRuntime.appendRegionNewsForServerEvent;

  const maintenanceRuntime = createMaintenanceRuntime({
    assertOperatorKey,
    idempotentlyWithSubject,
    clock,
    project: () => core.project(),
    publicProjection,
    maintenanceContext,
    appendRegionNewsForServerEvent,
    anomalyEventInputFromTemplate,
    seasonTemplate: runtimeSeasonTemplate,
    toRuntimeResult: commandResult,
    tickNpcLifecycle: (input, context) => core.tickNpcLifecycle(input, context),
    tickOrganizationPolitics: (input, context) => core.tickOrganizationPolitics(input, context),
    tickMarketExpiry: (input, context) => core.tickMarketExpiry(input, context),
    tickDirectTradeExpiry: (input, context) => core.tickDirectTradeExpiry(input, context),
    createResourceNode: (input, context) => core.createResourceNode(input, context),
    settleResourceNode: (input, context) => core.settleResourceNode(input, context),
    createAnomalyEvent: (input, context) => core.createAnomalyEvent(input, context),
    createSeasonCampaign: (input, context) => core.createSeasonCampaign(input, context),
    settleSeasonCampaign: (input, context) => core.settleSeasonCampaign(input, context),
    settlePartyRun: (input, context) => core.settlePartyRun(input, context),
    decayRegionControls: (input, context) => core.decayRegionControls(input, context),
    decayAbuseScores: (input, context) => core.decayAbuseScores(input, context),
    runServerHostedJob: serverHostedRuntime.runJob,
  });

  const downtimeRuntime = createDowntimeRuntime({
    requireIdentity: requireRuntimeIdentity,
    ownerVerifiedContext: ownerVerifiedContextFromInput,
    idempotently,
    idempotentlyAfterExplorerAuth,
    setDowntime: (input, context) => core.setDowntime(input, context),
    claimDowntime: (input, context) => core.claimDowntime(input, context),
    tickDowntime: (input, context) => core.tickDowntime(input, context),
  });

  const npcCandidateRuntime = createNpcCandidateRuntime({
    assertOperatorKey,
    requireIdentity: requireRuntimeIdentity,
    requireActiveIdentity: requireRuntimeActiveIdentity,
    ownerVerifiedContext: ownerVerifiedContextFromInput,
    idempotentlyWithSubject,
    idempotentlyAfterExplorerAuth,
    idempotently,
    canonicalizeNpc: (input, context) => core.canonicalizeNpc(input, context),
    submitNpcCandidate: (input, context) => core.submitNpcCandidate(input, context),
    reviewNpcCandidate: (input, context) => core.reviewNpcCandidate(input, context),
  });

  const npcLifecycleRuntime = createNpcLifecycleRuntime({
    contextFromInput,
    idempotentlyWithSubject,
    recordNpcLifecycle: (input, context) => core.recordNpcLifecycle(input, context),
    tickNpcLifecycle: (input, context) => core.tickNpcLifecycle(input, context),
  });

  for (const event of options.initialEvents || []) {
    explorerAuthRuntime.hydrateEvent(event);
    highValueConfirmationRuntime.hydrateEvent(event);
  }

  function assertOperatorKey(input: AnyRecord) {
    if (
      !operatorKey
      || typeof input.operatorKey !== "string"
      || !constantTimeTextEqual(input.operatorKey, operatorKey)
    ) {
      throw new Error("operator_key_required");
    }
  }

  function runMaintenance(input: AnyRecord = {}): EpochRuntimeResult<EpochMaintenanceRunSummary> {
    return maintenanceRuntime.run(input);
  }

  function identityOwner(agentId: string) {
    return core.project().identities[agentId]?.explorerId || "system";
  }

  function requireRuntimeIdentity(agentId: string): EpochAgentIdentity {
    const identity = core.project().identities[agentId];
    if (!identity) throw new Error("agent_identity_not_found");
    return identity;
  }

  function requireRuntimeActiveIdentity(agentId: string): EpochAgentIdentity {
    const identity = requireRuntimeIdentity(agentId);
    if (identity.status !== "active") throw new Error("agent_identity_archived");
    return identity;
  }

  function serverIdentityTitle(identity: EpochAgentIdentity) {
    return `终局档案：${identity.identityName}`;
  }

  function publicRegistrationInput(input: AnyRecord) {
    return {
      actorExplorerId: "system-registration",
      idempotencyKey: assertNonEmptyString(input.idempotencyKey, "idempotency_key"),
    };
  }

  function registrationSubjectHash(input: ReturnType<typeof publicRegistrationInput>) {
    return sha256Hex(JSON.stringify(input));
  }

  function duplicateExplorerRegistrationResult(cached: EpochRegisterExplorerResult): EpochRegisterExplorerResult {
    return {
      ...cached,
      events: [],
      projection: publicProjection(core.project()),
      duplicate: true,
    };
  }

  function registerExplorer(input: AnyRecord = {}): EpochRegisterExplorerResult {
    const registrationInput = publicRegistrationInput(input);
    const key = `register_explorer:${registrationInput.idempotencyKey}`;
    const subjectHash = registrationSubjectHash(registrationInput);
    const cached = explorerRegistrationResults.get(key);
    if (cached) {
      if (explorerRegistrationSubjectHashes.get(key) !== subjectHash) {
        throw new Error("idempotency_key_conflict");
      }
      return duplicateExplorerRegistrationResult(cached);
    }
    const credential = createServerIssuedExplorerCredential({
      registrationSecret: options.registrationSecret,
      idempotencyKey: registrationInput.idempotencyKey,
    });
    const existingIdentity = Object.values(core.project().identities)
      .find((identity) => identity.explorerId === credential.explorerId && identity.generation === 1);
    if (existingIdentity) {
      const issueEvent = core.project().events.find((event) => (
        event.eventType === "identity_issued"
        && recordValue(event.payload).agentId === existingIdentity.agentId
      ));
      if (
        !issueEvent
        || issueEvent.idempotencyKey !== registrationInput.idempotencyKey
        || issueEvent.correlationId !== subjectHash
      ) {
        throw new Error("idempotency_key_conflict");
      }
      explorerAuthRuntime.registerExplorerAuth({ recoveryCode: credential.recoveryCode }, credential.explorerId);
      return {
        events: [],
        projection: publicProjection(core.project()),
        value: existingIdentity,
        explorerId: credential.explorerId,
        recoveryCode: credential.recoveryCode,
        duplicate: true,
      };
    }
    assertAbuseAllowed(registrationInput, { allowRestrictedScore: true });
    const identityResult = commandResult(core.issueIdentity({
      explorerId: credential.explorerId,
      explorerSecretHash: credential.explorerSecretHash,
    }, {
      actorExplorerId: "system-registration",
      trustClass: "system_worker",
      idempotencyKey: registrationInput.idempotencyKey,
      correlationId: subjectHash,
    }));
    explorerAuthRuntime.registerExplorerAuth({ recoveryCode: credential.recoveryCode }, credential.explorerId);
    const result = attachEpochEventsForPersistence<EpochRegisterExplorerResult>({
      ...identityResult,
      explorerId: credential.explorerId,
      recoveryCode: credential.recoveryCode,
    }, epochEventsForPersistence(identityResult));
    explorerRegistrationResults.set(key, result);
    explorerRegistrationSubjectHashes.set(key, subjectHash);
    return result;
  }

  function verifyExplorerAuth(input: AnyRecord = {}): EpochExplorerAuthVerification {
    const explorerId = assertNonEmptyString(input.explorerId, "explorer_id");
    explorerAuthRuntime.assertExplorerAuth(input, explorerId);
    return { explorerId, verified: true };
  }

  function submitAttestedAction(input: AnyRecord = {}): EpochRuntimeResult<EpochHostedActionRecord> {
    return idempotentlyWithSubject("submit_attested_action", input, "attestation", () =>
      attestationRuntime.submitAction(input));
  }

  function agentBriefing(input: AnyRecord = {}): EpochAgentBriefingView {
    return publicWorldReadModel.agentBriefing(input);
  }

  function agentPublicIdentity(input: AnyRecord = {}) {
    return publicWorldReadModel.agentPublicIdentity(input);
  }

  function hostedSessionWatch(input: AnyRecord = {}): EpochHostedSessionWatchInfo {
    return publicWorldReadModel.hostedSessionWatch(input);
  }

  function worldOverview(input: AnyRecord = {}): EpochWorldOverviewInfo {
    return publicWorldReadModel.worldOverview(input);
  }

  function loreContributions(input: AnyRecord = {}): EpochLoreContributionsInfo {
    return publicWorldReadModel.loreContributions(input);
  }

  function loreTargets(input: AnyRecord = {}): EpochLoreTargetsInfo {
    return publicWorldReadModel.loreTargets(input);
  }

  return {
    requestConfirmation: highValueConfirmationRuntime.request,
    confirmAction: highValueConfirmationRuntime.confirm,
    confirmations: highValueConfirmationRuntime.list,
    ingestCanonicalEvents: core.ingestCanonicalEvents,
    events: (input: AnyRecord = {}) => eventsInfoView(core.project(), input),
    interactionEvents: (offset = 0) => core.project().events.slice(offset),
    worldContextVersions: (): EpochWorldContextVersions => publicWorldReadModel.worldContextVersions(),
    worldOverview,
    loreContributions,
    loreTargets,
    audit: (input: AnyRecord = {}): EpochAuditInfo => auditInfoView(core.project(), input),
    recordRejectedCommand: (input: AnyRecord = {}): EpochRuntimeResult<EpochEvent> => {
      const sourceInput = recordValue(input.input);
      return commandResult(core.recordCommandRejected({
        surface: input.surface === "mcp" ? "mcp" : "http",
        command: optionalString(input.command) || "unknown_command",
        errorCode: optionalString(input.errorCode) || "internal_error",
        statusCode: typeof input.statusCode === "number" ? input.statusCode : undefined,
        actorKey: typeof input.actorKey === "string" && input.actorKey.trim()
          ? input.actorKey.trim()
          : runtimeAbuseActorKey(sourceInput),
        agentId: typeof sourceInput.agentId === "string" ? sourceInput.agentId : typeof input.agentId === "string" ? input.agentId : undefined,
        explorerId: typeof sourceInput.explorerId === "string" ? sourceInput.explorerId : typeof input.explorerId === "string" ? input.explorerId : undefined,
        inputSummary: summarizeRejectedInput(sourceInput),
      }, {
        actorExplorerId: "system",
        trustClass: "system_worker",
        idempotencyKey: typeof sourceInput.idempotencyKey === "string"
          ? sourceInput.idempotencyKey
          : typeof input.idempotencyKey === "string"
            ? input.idempotencyKey
            : undefined,
        causationId: typeof input.causationId === "string" ? input.causationId : undefined,
        correlationId: typeof input.correlationId === "string" ? input.correlationId : undefined,
      }));
    },
    issueIdentity: (input: AnyRecord = {}) => {
      const explorerId = assertNonEmptyString(input.explorerId, "explorer_id");
      if (explorerAuthRuntime.hasExplorerAuth(explorerId)) {
        return idempotentlyAfterExplorerAuth("issue_identity", input, explorerId, () => commandResult(core.issueIdentity({
          explorerId,
          explorerSecretHash: explorerAuthRuntime.registerExplorerAuth(input, explorerId),
          identityName: optionalString(input.identityName),
          maxLifetime: optionalNumber(input.maxLifetime),
        }, ownerVerifiedContextFromInput(input, explorerId))));
      }
      return idempotentlyForExplorerRegistration("issue_identity", input, explorerId, () => commandResult(core.issueIdentity({
        explorerId,
        explorerSecretHash: explorerAuthRuntime.registerExplorerAuth(input, explorerId),
        identityName: optionalString(input.identityName),
        maxLifetime: optionalNumber(input.maxLifetime),
      }, untrustedClientContext(input, explorerId || "system"))));
    },
    registerExplorer,
    verifyExplorerAuth,
    rotateExplorerRecovery: explorerAuthRuntime.rotateExplorerRecovery,
    progress: (input: AnyRecord = {}) => progressInfoView(core.project(), input, {
      now: serverIsoTime(clock),
      maxDowntimeSeconds: options.maxDowntimeSeconds,
    }),
    grantJourneyEntryReserve: (input: AnyRecord = {}) => {
      const journeyId = assertNonEmptyString(input.journeyId, "journey_id");
      const agentId = assertNonEmptyString(input.agentId, "agent_id");
      const grants = JOURNEY_FIRST_ENTRY_RESERVE.flatMap((resource) => {
        const reason = `journey_entry_reserve:${agentId}:${resource.resourceId}`;
        const existing = core.project().events.some((event) => event.eventType === "resource_granted"
          && event.agentId === agentId
          && event.payload.reason === reason);
        if (existing) return [];
        return [commandResult(core.grantResource({
          agentId,
          resourceId: resource.resourceId,
          amount: resource.amount,
          reason,
        }, maintenanceContext(input, `${reason}:${journeyId}`)))];
      });
      const persistenceEvents = grants.flatMap((grant) => epochEventsForPersistence(grant));
      const publicEvents = grants.flatMap((grant) => grant.events);
      return attachEpochEventsForPersistence({
        value: core.project().resourceBalances[agentId] ?? {},
        events: publicEvents,
        projection: grants.at(-1)?.projection ?? publicProjection(core.project()),
        reserve: JOURNEY_FIRST_ENTRY_RESERVE,
        duplicate: grants.length === 0,
      }, persistenceEvents);
    },
    solidifyJourneyWorld: (input: AnyRecord = {}) => commandResult(core.solidifyJourneyWorld({
      journeyId: assertNonEmptyString(input.journeyId, "journey_id"),
      agentId: assertNonEmptyString(input.agentId, "agent_id"),
      regionId: assertNonEmptyString(input.regionId, "region_id"),
      completedObjectiveIds: Array.isArray(input.completedObjectiveIds)
        ? input.completedObjectiveIds.map((value) => assertNonEmptyString(value, "journey_completed_objective_id"))
        : [],
      requiredMainObjectiveIds: Array.isArray(input.requiredMainObjectiveIds)
        ? input.requiredMainObjectiveIds.map((value) => assertNonEmptyString(value, "journey_required_main_objective_id"))
        : [],
      mirrorStartedAtWorldTime: assertNonEmptyString(
        input.mirrorStartedAtWorldTime,
        "journey_mirror_started_at_world_time",
      ),
      mirrorEndedAtWorldTime: assertNonEmptyString(
        input.mirrorEndedAtWorldTime,
        "journey_mirror_ended_at_world_time",
      ),
      committedAtWorldTime: assertNonEmptyString(
        input.committedAtWorldTime,
        "journey_committed_at_world_time",
      ),
      completionTier: (() => {
        const tier = normalizeJourneyCompletionTier(assertNonEmptyString(
          input.completionTier,
          "journey_completion_tier",
        ));
        if (tier !== "及格" && tier !== "良好" && tier !== "优秀" && tier !== "惊世") {
          throw new Error("journey_completion_tier_invalid");
        }
        return tier;
      })(),
      completionScoreBps: Number(input.completionScoreBps),
      ...(typeof input.worldSliceHash === "string"
        ? { worldSliceHash: input.worldSliceHash as `sha256:${string}` }
        : {}),
    }, maintenanceContext(input, `journey_world_solidified:${String(input.journeyId || "").trim()}`))),
    grantJourneyReward: (input: AnyRecord = {}) => {
      const journeyId = assertNonEmptyString(input.journeyId, "journey_id");
      const agentId = assertNonEmptyString(input.agentId, "agent_id");
      const tier = normalizeJourneyCompletionTier(assertNonEmptyString(input.tier, "journey_completion_tier"));
      if (!tier || tier === "未及格" || !(tier in JOURNEY_TIER_REWARDS)) {
        throw new Error("journey_reward_tier_invalid");
      }
      const reward = JOURNEY_TIER_REWARDS[tier as keyof typeof JOURNEY_TIER_REWARDS];
      const taskPlan = isRecord(input.taskPlan)
        ? input.taskPlan as unknown as JourneyGeneratedTaskPlan
        : undefined;
      const hiddenTaskSeal = isRecord(input.hiddenTaskSeal)
        ? input.hiddenTaskSeal as unknown as JourneyHiddenTaskSeal
        : undefined;
      if (taskPlan) deriveJourneyHiddenTask(taskPlan, hiddenTaskSeal);
      const rewardBundle: JourneyRewardBundle = taskPlan
        ? journeyRewardBundleForPlan(taskPlan, tier as Exclude<JourneyCompletionTier, "未及格">)
        : { resources: [reward], items: [], attributes: [] };
      const reason = `journey_grade:${journeyId}:${tier}`;
      const existing = core.project().events.find((event) => event.eventType === "resource_granted"
        && event.agentId === agentId
        && event.payload.reason === reason);
      const resourceGrant = existing
        ? attachEpochEventsForPersistence({
            value: core.project().resourceBalances[agentId] ?? {},
            events: [],
            projection: publicProjection(core.project()),
          }, [])
        : commandResult(core.grantResource({
            agentId,
            resourceId: reward.resourceId,
            amount: reward.amount,
            reason,
          }, maintenanceContext(input, reason)));
      const sourceEventIds = Array.isArray(input.sourceEventIds)
        ? [...new Set(input.sourceEventIds.filter((value): value is string => typeof value === "string" && Boolean(value.trim())))]
        : [];
      if (rewardBundle.items.length > 0 && sourceEventIds.length === 0) {
        throw new Error("journey_reward_source_event_required");
      }
      const itemGrants = rewardBundle.items.map((item) => commandResult(core.createInventoryItem({
        agentId,
        itemKey: item.itemKey,
        displayName: item.displayName,
        rarity: item.rarity,
        sourceEventIds,
      }, maintenanceContext(input, `${reason}:item:${item.itemKey}`))));
      const attributeGrants = existing ? [] : rewardBundle.attributes.map((attribute) => commandResult(core.grantAttribute({
        agentId,
        attributeId: attribute.attributeId,
        amount: attribute.amount,
        reason,
        sourceEventIds,
      }, maintenanceContext(input, `${reason}:attribute:${attribute.attributeId}`))));
      const persistenceEvents = [
        ...epochEventsForPersistence(resourceGrant),
        ...itemGrants.flatMap((grant) => epochEventsForPersistence(grant)),
        ...attributeGrants.flatMap((grant) => epochEventsForPersistence(grant)),
      ];
      const publicEvents = [resourceGrant, ...itemGrants, ...attributeGrants].flatMap((grant) => grant.events);
      const projection = attributeGrants.at(-1)?.projection ?? itemGrants.at(-1)?.projection ?? resourceGrant.projection;
      return attachEpochEventsForPersistence({
        ...resourceGrant,
        events: publicEvents,
        projection,
        reward,
        rewardBundle,
        grantedItems: itemGrants.map((grant) => grant.value),
        grantedAttributes: attributeGrants.map((grant) => grant.value),
        reason,
        duplicate: Boolean(existing)
          && itemGrants.every((grant) => grant.events.length === 0)
          && attributeGrants.every((grant) => grant.events.length === 0),
      }, persistenceEvents);
    },
    agentBriefing,
    agentPublicIdentity,
    hostedSessionWatch,
    agentMemory: (input: AnyRecord = {}): EpochAgentMemoryInfo => agentMemoryInfoView(core.project(), input),
    personalMigrationSummary: (input: AnyRecord = {}): EpochPersonalMigrationSummary =>
      personalMigrationInfoView(core.project(), input),
    confirmPersonalityDrift: (input: AnyRecord = {}) => {
      const driftId = assertNonEmptyString(input.driftId, "personality_drift_id");
      const drift = core.project().personalityDrifts[driftId];
      if (!drift) throw new Error("personality_drift_not_found");
      const identity = requireRuntimeIdentity(drift.agentId);
      return idempotentlyAfterExplorerAuth("confirm_personality_drift", input, identity.explorerId, () => commandResult(core.confirmPersonalityDrift({
        driftId,
      }, ownerVerifiedContextFromInput(input, identity.explorerId))));
    },
    abuseStatus: abuseRuntime.status,
    abuseProfiles: (input: AnyRecord = {}): EpochAbuseProfilesView => {
      assertOperatorKey(input);
      return abuseProfilesInfoView(core.project(), input);
    },
    operatorOverview: (input: AnyRecord = {}): EpochOperatorOverview => {
      assertOperatorKey(input);
      return operatorOverviewInfoView({
        projection: core.project(),
        request: input,
        checkedAt: clock(),
        attestedRunners: attestationRuntime.runners(),
      });
    },
    runMaintenance,
    archiveIdentity: (input: AnyRecord = {}) => {
      const agentId = assertNonEmptyString(input.agentId, "agent_id");
      const identity = core.project().identities[agentId];
      if (!identity) throw new Error("agent_identity_not_found");
      return idempotentlyAfterExplorerAuth("archive_identity", input, identity.explorerId, () => commandResult(core.archiveIdentity({
        agentId,
        archiveReason: typeof input.archiveReason === "string" && input.archiveReason.trim()
          ? input.archiveReason.trim()
          : "identity_archived",
        finalTitle: serverIdentityTitle(identity),
      }, {
        actorExplorerId: "system",
        trustClass: "system_worker",
        idempotencyKey: optionalString(input.idempotencyKey),
        causationId: typeof input.causationId === "string" ? input.causationId : undefined,
        correlationId: typeof input.correlationId === "string" ? input.correlationId : undefined,
      })));
    },
    reincarnate: (input: AnyRecord = {}) => {
      const previousAgentId = assertNonEmptyString(input.previousAgentId, "previous_agent_id");
      const previousIdentity = core.project().identities[previousAgentId];
      if (!previousIdentity) throw new Error("agent_identity_not_found");
      return idempotentlyAfterExplorerAuth("reincarnate", input, previousIdentity.explorerId, () => commandResult(core.reincarnate({
        previousAgentId,
      }, {
        actorExplorerId: "system",
        trustClass: "system_worker",
        idempotencyKey: optionalString(input.idempotencyKey),
        causationId: typeof input.causationId === "string" ? input.causationId : undefined,
        correlationId: typeof input.correlationId === "string" ? input.correlationId : undefined,
      })));
    },
    identityArchive: (input: AnyRecord = {}): EpochIdentityArchiveInfo => identityArchiveInfoView(core.project(), input),
    explorerProfile: (input: AnyRecord = {}): EpochExplorerProfileInfo => explorerProfileInfoView(core.project(), input),
    playerDataExport: (input: AnyRecord = {}): EpochPlayerDataExport => {
      const explorerId = assertNonEmptyString(input.explorerId, "explorer_id");
      explorerAuthRuntime.assertExplorerAuth(input, explorerId);
      return playerDataExportView(core.project(), {
        explorerId,
        limit: optionalNumber(input.limit),
        exportedAt: serverIsoTime(clock),
      });
    },
    changeAgentCustody: (input: AnyRecord = {}) => {
      assertOperatorKey(input);
      const agentId = assertNonEmptyString(input.agentId, "agent_id");
      const custodyStatus = input.custodyStatus === "free" ? "free" : input.custodyStatus === "imprisoned" ? "imprisoned" : undefined;
      if (!custodyStatus) throw new Error("agent_custody_status_invalid");
      return idempotentlyWithSubject("change_agent_custody", input, agentId, () => commandResult(core.changeAgentCustody({
        agentId,
        custodyStatus,
        reason: optionalString(input.reason),
      }, {
        actorExplorerId: "operator",
        trustClass: "system_worker",
        idempotencyKey: optionalString(input.idempotencyKey),
        causationId: optionalString(input.causationId),
        correlationId: optionalString(input.correlationId),
      })), { allowRestrictedScore: true });
    },
    competitiveLadder: (input: AnyRecord = {}): EpochCompetitiveLadderView => {
      const mode: EpochCompetitiveLadderMode = input.mode === "verified"
        ? "verified"
        : input.mode === "casual"
          ? "casual"
          : "ranked";
      let dimension: EpochCompetitiveLadderDimension;
      if (typeof input.tournamentId === "string" && input.tournamentId.trim()) {
        dimension = { kind: "tournament", tournamentId: input.tournamentId.trim() };
      } else if (typeof input.seasonId === "string" && input.seasonId.trim()) {
        dimension = { kind: "season", seasonId: input.seasonId.trim() };
      } else {
        dimension = {
          kind: "region",
          regionId: canonicalRegionIdFromInput(input.regionId)
            || assertNonEmptyString(input.regionId, "region_id"),
        };
      }
      return competitiveLadderView(core.project(), {
        mode,
        dimension,
        limit: optionalNumber(input.limit),
      });
    },
    setDowntime: downtimeRuntime.setDowntime,
    claimDowntime: downtimeRuntime.claimDowntime,
    tickDowntime: (input: AnyRecord = {}) => {
      assertOperatorKey(input);
      return downtimeRuntime.tickDowntime(input);
    },
    npcNote: npcCandidateRuntime.npcNote,
    submitNpcCandidate: npcCandidateRuntime.submitNpcCandidate,
    reviewNpcCandidate: npcCandidateRuntime.reviewNpcCandidate,
    recordNpcLifecycle: npcLifecycleRuntime.recordNpcLifecycle,
    tickNpcLifecycle: (input: AnyRecord = {}) => {
      assertOperatorKey(input);
      return npcLifecycleRuntime.tickNpcLifecycle(input);
    },
    tickOrganizationPolitics: (input: AnyRecord = {}): EpochRuntimeResult<TickOrganizationPoliticsResult> => {
      assertOperatorKey(input);
      return idempotently("tick_organization_politics", input, () => commandResult(core.tickOrganizationPolitics({
        regionId: canonicalRegionIdFromInput(input.regionId),
        limit: optionalNumber(input.limit),
      }, {
        actorExplorerId: "system",
        trustClass: "system_worker",
        idempotencyKey: optionalString(input.idempotencyKey),
        causationId: typeof input.causationId === "string" ? input.causationId : undefined,
        correlationId: typeof input.correlationId === "string" ? input.correlationId : undefined,
      })), { allowRestrictedScore: true });
    },
    regionInfo: (input: AnyRecord = {}): EpochRegionInfo => regionInfoView(core.project(), input, {
      nowIso: serverIsoTime(clock),
    }),
    organizations: (input: AnyRecord = {}): EpochOrganizationInfo => organizationInfoView(core.project(), input),
    createOrganization: (input: AnyRecord = {}): EpochRuntimeResult<EpochOrganization> => {
      assertOperatorKey(input);
      const regionId = canonicalRegionIdFromInput(input.regionId) || assertNonEmptyString(input.regionId, "region_id");
      const displayName = assertNonEmptyString(input.displayName, "organization_name");
      return idempotentlyWithSubject("create_organization", input, `${regionId}:${displayName}`, () => commandResult(core.createOrganization({
        regionId,
        displayName,
        reason: typeof input.reason === "string" ? input.reason : undefined,
      }, {
        actorExplorerId: "operator",
        trustClass: "system_worker",
        idempotencyKey: optionalString(input.idempotencyKey),
        causationId: typeof input.causationId === "string" ? input.causationId : undefined,
        correlationId: typeof input.correlationId === "string" ? input.correlationId : undefined,
      })), { allowRestrictedScore: true });
    },
    updateOrganizationMembership: (input: AnyRecord = {}): EpochRuntimeResult<EpochOrganizationMembership> => {
      const agentId = assertNonEmptyString(input.agentId, "agent_id");
      const identity = requireRuntimeIdentity(agentId);
      return idempotentlyAfterExplorerAuth("update_organization_membership", input, identity.explorerId, () => commandResult(core.updateOrganizationMembership({
        agentId,
        organizationId: assertNonEmptyString(input.organizationId, "organization_id"),
        role: typeof input.role === "string" ? input.role : undefined,
        status: typeof input.status === "string" ? input.status as EpochOrganizationMembershipStatus : undefined,
      }, ownerVerifiedContextFromInput(input, identity.explorerId))));
    },
    purchaseOrganizationUpgrade: (input: AnyRecord = {}): EpochRuntimeResult<EpochOrganizationUpgrade> => {
      const agentId = assertNonEmptyString(input.agentId, "agent_id");
      const identity = requireRuntimeIdentity(agentId);
      return idempotentlyAfterExplorerAuth("purchase_organization_upgrade", input, identity.explorerId, () => commandResult(core.purchaseOrganizationUpgrade({
        agentId,
        organizationId: assertNonEmptyString(input.organizationId, "organization_id"),
        upgradeKey: assertNonEmptyString(input.upgradeKey, "organization_upgrade_key"),
      }, ownerVerifiedContextFromInput(input, identity.explorerId))));
    },
    contributeOrganizationTreasury: (input: AnyRecord = {}): EpochRuntimeResult<OrganizationTreasuryChangedPayload> => {
      const agentId = assertNonEmptyString(input.agentId, "agent_id");
      const identity = requireRuntimeIdentity(agentId);
      return idempotentlyAfterExplorerAuth("contribute_organization_treasury", input, identity.explorerId, () => commandResult(core.contributeOrganizationTreasury({
        agentId,
        organizationId: assertNonEmptyString(input.organizationId, "organization_id"),
        resourceId: assertNonEmptyString(input.resourceId, "resource_id") as EpochResourceId,
        amount: typeof input.amount === "number" ? input.amount : Number(input.amount),
      }, ownerVerifiedContextFromInput(input, identity.explorerId))));
    },
    proposeOrganizationBudget: (input: AnyRecord = {}): EpochRuntimeResult<EpochOrganizationBudget> => {
      const agentId = assertNonEmptyString(input.agentId, "agent_id");
      const identity = requireRuntimeIdentity(agentId);
      return idempotentlyAfterExplorerAuth("propose_organization_budget", input, identity.explorerId, () => commandResult(core.proposeOrganizationBudget({
        agentId,
        organizationId: assertNonEmptyString(input.organizationId, "organization_id"),
        title: assertNonEmptyString(input.title, "organization_budget_title"),
        description: typeof input.description === "string" ? input.description : undefined,
        resourceId: assertNonEmptyString(input.resourceId, "resource_id") as EpochResourceId,
        amount: typeof input.amount === "number" ? input.amount : Number(input.amount),
      }, ownerVerifiedContextFromInput(input, identity.explorerId))));
    },
    resolveOrganizationBudget: (input: AnyRecord = {}): EpochRuntimeResult<EpochOrganizationBudget> => {
      const agentId = assertNonEmptyString(input.agentId, "agent_id");
      const identity = requireRuntimeIdentity(agentId);
      return idempotentlyAfterExplorerAuth("resolve_organization_budget", input, identity.explorerId, () => commandResult(core.resolveOrganizationBudget({
        agentId,
        budgetId: assertNonEmptyString(input.budgetId, "organization_budget_id"),
        resolution: assertNonEmptyString(input.resolution, "organization_budget_resolution"),
        note: typeof input.note === "string" ? input.note : undefined,
      }, ownerVerifiedContextFromInput(input, identity.explorerId))));
    },
    organizationPolitics: (input: AnyRecord = {}): EpochOrganizationPoliticsInfo =>
      organizationPoliticsInfoView(core.project(), input),
    npcCareers: (input: AnyRecord = {}): EpochNpcCareerInfo => npcCareersInfoView(core.project(), input),
    npcLocations: (input: AnyRecord = {}): EpochNpcLocationInfo => npcLocationsInfoView(core.project(), input),
    npcAssets: (input: AnyRecord = {}): EpochNpcAssetInfo => npcAssetsInfoView(core.project(), input),
    npcHealth: (input: AnyRecord = {}): EpochNpcHealthInfo => npcHealthInfoView(core.project(), input),
    socialHooks: (input: AnyRecord = {}): EpochSocialHookInfo => socialHooksInfoView(core.project(), input),
    households: (input: AnyRecord = {}): EpochHouseholdInfo => householdsInfoView(core.project(), input),
    npcMemories: (input: AnyRecord = {}): EpochNpcMemoryInfo => npcMemoriesInfoView(core.project(), input),
    npcRelationships: (input: AnyRecord = {}): EpochNpcRelationshipInfo =>
      npcRelationshipsInfoView(core.project(), input),
    agentNpcBonds: (input: AnyRecord = {}): EpochAgentNpcBondInfo => agentNpcBondsInfoView(core.project(), input),
    npcInfo: (input: AnyRecord = {}): EpochNpcInfo => npcInfoView(core.project(), input),
    messages: (input: AnyRecord = {}): EpochMessagesInfo => messagesInfoView(core.project(), input),
    moderationQueue: (input: AnyRecord = {}): EpochModerationInfo => {
      assertOperatorKey(input);
      return moderationInfoView(core.project(), input);
    },
    resolveModeration: (input: AnyRecord = {}): EpochRuntimeResult<EpochModerationItem> => {
      assertOperatorKey(input);
      return idempotently("resolve_moderation", input, () => commandResult(core.resolveModerationItem({
        moderationId: assertNonEmptyString(input.moderationId, "moderation_id"),
        resolution: assertNonEmptyString(input.resolution, "moderation_resolution") as "approved" | "rejected" | "hidden" | "converted_to_rumor",
        note: typeof input.note === "string" ? input.note : undefined,
      }, {
        actorExplorerId: "operator",
        trustClass: "system_worker",
        idempotencyKey: optionalString(input.idempotencyKey),
        causationId: typeof input.causationId === "string" ? input.causationId : undefined,
        correlationId: typeof input.correlationId === "string" ? input.correlationId : undefined,
      })), { allowRestrictedScore: true });
    },
    recordRiskReview: (input: AnyRecord = {}): EpochRuntimeResult<EpochRiskReview> => {
      assertOperatorKey(input);
      return idempotentlyWithSubject("record_risk_review", input, optionalString(input.sourceEventId) || "risk_review", () => commandResult(core.recordRiskReview({
        sourceEventId: assertNonEmptyString(input.sourceEventId, "source_event_id"),
        resolution: assertNonEmptyString(input.resolution, "risk_review_resolution") as "cleared" | "watchlisted" | "escalated",
        note: typeof input.note === "string" ? input.note : undefined,
      }, {
        actorExplorerId: "operator",
        trustClass: "system_worker",
        idempotencyKey: optionalString(input.idempotencyKey),
        causationId: typeof input.causationId === "string" ? input.causationId : undefined,
        correlationId: typeof input.correlationId === "string" ? input.correlationId : undefined,
      })), { allowRestrictedScore: true });
    },
    releaseMarketRiskRestriction: (input: AnyRecord = {}): EpochRuntimeResult<EpochMarketRiskRestrictionRelease> => {
      assertOperatorKey(input);
      return idempotentlyWithSubject("release_market_risk_restriction", input, optionalString(input.agentId) || "market_risk_release", () => commandResult(core.releaseMarketRiskRestriction({
        agentId: assertNonEmptyString(input.agentId, "agent_id"),
        note: typeof input.note === "string" ? input.note : undefined,
      }, {
        actorExplorerId: "operator",
        trustClass: "system_worker",
        idempotencyKey: optionalString(input.idempotencyKey),
        causationId: typeof input.causationId === "string" ? input.causationId : undefined,
        correlationId: typeof input.correlationId === "string" ? input.correlationId : undefined,
      })), { allowRestrictedScore: true });
    },
    releaseAbuseRestriction: (input: AnyRecord = {}): EpochRuntimeResult<EpochAbuseScoreRelease> => {
      assertOperatorKey(input);
      return idempotently("release_abuse_restriction", input, () => commandResult(core.releaseAbuseRestriction({
        actorKey: typeof input.actorKey === "string" ? input.actorKey : undefined,
        agentId: typeof input.agentId === "string" ? input.agentId : undefined,
        explorerId: typeof input.explorerId === "string" ? input.explorerId : undefined,
        scoreAfter: typeof input.scoreAfter === "number" ? input.scoreAfter : undefined,
        note: typeof input.note === "string" ? input.note : undefined,
      }, {
        actorExplorerId: "operator",
        trustClass: "system_worker",
        idempotencyKey: optionalString(input.idempotencyKey),
        causationId: typeof input.causationId === "string" ? input.causationId : undefined,
        correlationId: typeof input.correlationId === "string" ? input.correlationId : undefined,
      })), { allowRestrictedScore: true });
    },
    decayAbuseScores: (input: AnyRecord = {}): EpochRuntimeResult<readonly EpochAbuseScoreDecay[]> => {
      assertOperatorKey(input);
      return idempotently("decay_abuse_scores", input, () => commandResult(core.decayAbuseScores({
        limit: optionalNumber(input.limit),
        amount: optionalNumber(input.amount),
        minScore: optionalNumber(input.minScore),
      }, {
        actorExplorerId: "system",
        trustClass: "system_worker",
        idempotencyKey: optionalString(input.idempotencyKey),
        causationId: typeof input.causationId === "string" ? input.causationId : undefined,
        correlationId: typeof input.correlationId === "string" ? input.correlationId : undefined,
      })), { allowRestrictedScore: true });
    },
    decayRegionControls: (input: AnyRecord = {}): EpochRuntimeResult<readonly EpochRegionControlDecay[]> => {
      assertOperatorKey(input);
      return idempotently("decay_region_controls", input, () => commandResult(core.decayRegionControls({
        limit: optionalNumber(input.limit),
        amount: optionalNumber(input.amount),
        minAgeSeconds: optionalNumber(input.minAgeSeconds),
        minScore: optionalNumber(input.minScore),
      }, {
        actorExplorerId: "system",
        trustClass: "system_worker",
        idempotencyKey: optionalString(input.idempotencyKey),
        causationId: typeof input.causationId === "string" ? input.causationId : undefined,
        correlationId: typeof input.correlationId === "string" ? input.correlationId : undefined,
      })), { allowRestrictedScore: true });
    },
    claimReleasedRegionControl: (input: AnyRecord = {}): EpochRuntimeResult<EpochRegionControl> => {
      assertOperatorKey(input);
      return idempotently("claim_region_control", input, () => commandResult(core.claimReleasedRegionControl({
        regionId: assertNonEmptyString(input.regionId, "region_id"),
        seasonId: assertNonEmptyString(input.seasonId, "season_id"),
        factionId: assertNonEmptyString(input.factionId, "faction_id"),
        agentId: typeof input.agentId === "string" ? input.agentId : undefined,
      }, {
        actorExplorerId: "system",
        trustClass: "system_worker",
        idempotencyKey: optionalString(input.idempotencyKey),
        causationId: typeof input.causationId === "string" ? input.causationId : undefined,
        correlationId: typeof input.correlationId === "string" ? input.correlationId : undefined,
      })), { allowRestrictedScore: true });
    },
    postMessage: (input: AnyRecord = {}): EpochRuntimeResult<EpochMessageRecord> => {
      const isServerHostedSpeech = typeof input.operatorKey === "string" && input.operatorKey.trim().length > 0;
      if (isServerHostedSpeech) assertOperatorKey(input);
      const agentId = assertNonEmptyString(input.agentId, "agent_id");
      const identity = requireRuntimeActiveIdentity(agentId);
      const scope = assertNonEmptyString(input.scope, "message_scope") as EpochMessageScope;
      const body = assertNonEmptyString(input.body, "message_body");
      const post = (context: EpochCommandContext, confirmationEvents: readonly EpochEvent[] = []) => {
        const result = commandResult(core.postMessage({
          agentId,
          scope,
          regionId: canonicalRegionIdFromInput(input.regionId),
          body,
        }, context));
        return confirmationEvents.length
          ? { ...result, events: [...confirmationEvents, ...result.events] }
          : result;
      };
      if (isServerHostedSpeech) {
        return idempotently("post_message", input, () => {
          const baseKey = String(input.idempotencyKey).trim();
          return post(serverHostedContext(input, `post_message:${baseKey}:message`));
        }, { allowRestrictedScore: true });
      }
      if (scope === "world") {
        return idempotently("post_message", input, () => {
          const confirmationEvents = highValueConfirmationRuntime.consume(input, "world_message", highValueConfirmationSubjectHash({
            action: "world_message",
            request: input,
          }));
          return post(ownerVerifiedContextFromInput(input, identity.explorerId), confirmationEvents);
        });
      }
      return idempotentlyAfterExplorerAuth("post_message", input, identity.explorerId, () =>
        post(ownerVerifiedContextFromInput(input, identity.explorerId)));
    },
    generateRegionNews: (input: AnyRecord = {}): EpochRuntimeResult<EpochRegionNews> => {
      if (operatorKey && input.operatorKey === operatorKey) {
        return idempotently("generate_region_news", input, () => regionNewsRuntime.generateRegionNews(input), {
          allowRestrictedScore: true,
        });
      }
      const agentId = assertNonEmptyString(input.agentId, "agent_id");
      const identity = requireRuntimeActiveIdentity(agentId);
      return idempotentlyAfterExplorerAuth("generate_region_news", input, identity.explorerId, () => {
        const sourceEventId = assertNonEmptyString(input.sourceEventId, "source_event_id");
        if (!sourceEventsMentionAgent(core.project(), [sourceEventId], agentId)) {
          throw new Error("region_news_source_agent_not_mentioned");
        }
        return regionNewsRuntime.generateRegionNews(input);
      });
    },
    claimNewsLegend: (input: AnyRecord = {}): EpochRuntimeResult<EpochLegendAward> => {
      const agentId = assertNonEmptyString(input.agentId, "agent_id");
      const identity = requireRuntimeIdentity(agentId);
      return idempotentlyAfterExplorerAuth("claim_news_legend", input, identity.explorerId, () => commandResult(core.claimNewsLegend({
        newsId: assertNonEmptyString(input.newsId, "news_id"),
        agentId,
      }, ownerVerifiedContextFromInput(input, identity.explorerId))));
    },
    recordLoreContribution: (input: AnyRecord = {}): EpochRuntimeResult<EpochLoreContributionRecord> => {
      const agentId = assertNonEmptyString(input.agentId, "agent_id");
      const identity = requireRuntimeIdentity(agentId);
      return idempotentlyAfterExplorerAuth("record_lore_contribution", input, identity.explorerId, () => commandResult(core.recordLoreContribution({
        agentId,
        category: assertNonEmptyString(input.category, "lore_category") as "confirmation" | "refutation" | "revision",
        targetId: assertNonEmptyString(input.targetId, "lore_target_id"),
        summary: assertNonEmptyString(input.summary, "lore_summary"),
        revisionMode: typeof input.revisionMode === "string"
          ? input.revisionMode as "suggestion" | "derived" | "merge" | "downgrade" | "direct_edit"
          : undefined,
        revisedClaimText: typeof input.revisedClaimText === "string" ? input.revisedClaimText : undefined,
        originalClaimExplorerId: typeof input.originalClaimExplorerId === "string" ? input.originalClaimExplorerId : undefined,
        parentClaimId: typeof input.parentClaimId === "string" ? input.parentClaimId : undefined,
        mergeTargetIds: Array.isArray(input.mergeTargetIds)
          ? input.mergeTargetIds.filter((item): item is string => typeof item === "string")
          : undefined,
        downgradeReason: typeof input.downgradeReason === "string" ? input.downgradeReason : undefined,
        sourceEventIds: Array.isArray(input.sourceEventIds) ? input.sourceEventIds : undefined,
        experimentId: typeof input.experimentId === "string" ? input.experimentId : undefined,
        mainRuleReview: isRecord(input.mainRuleReview)
          ? input.mainRuleReview as unknown as ExperimentMainRuleReview
          : undefined,
      }, ownerVerifiedContextFromInput(input, identity.explorerId))));
    },
    adjudicateLoreTarget: (input: AnyRecord = {}): EpochRuntimeResult<EpochLoreTargetAdjudication> => {
      assertOperatorKey(input);
      return idempotently("adjudicate_lore_target", input, () => commandResult(core.adjudicateLoreTarget({
        targetId: assertNonEmptyString(input.targetId, "lore_target_id"),
        status: assertNonEmptyString(input.status, "lore_status") as "confirmed" | "refuted" | "revised" | "contested",
        summary: assertNonEmptyString(input.summary, "lore_summary"),
        sourceContributionEventIds: Array.isArray(input.sourceContributionEventIds) ? input.sourceContributionEventIds : undefined,
        canonCandidate: isRecord(input.canonCandidate)
          ? {
            requested: input.canonCandidate.requested === true,
            chapterReviewId: typeof input.canonCandidate.chapterReviewId === "string" ? input.canonCandidate.chapterReviewId : undefined,
            curatorApprovedBy: typeof input.canonCandidate.curatorApprovedBy === "string" ? input.canonCandidate.curatorApprovedBy : undefined,
            migrationSummary: typeof input.canonCandidate.migrationSummary === "string" ? input.canonCandidate.migrationSummary : undefined,
            adoptedText: typeof input.canonCandidate.adoptedText === "string" ? input.canonCandidate.adoptedText : undefined,
            boundaryNote: typeof input.canonCandidate.boundaryNote === "string" ? input.canonCandidate.boundaryNote : undefined,
          }
          : undefined,
      }, {
        actorExplorerId: "system",
        trustClass: "system_worker",
        idempotencyKey: optionalString(input.idempotencyKey),
        causationId: typeof input.causationId === "string" ? input.causationId : undefined,
        correlationId: typeof input.correlationId === "string" ? input.correlationId : undefined,
      })), { allowRestrictedScore: true });
    },
    objectives: (input: AnyRecord = {}): EpochObjectivesInfo => objectivesInfoView(core.project(), input),
    seedObjective: (input: AnyRecord = {}) => {
      assertOperatorKey(input);
      return idempotently("seed_objective", input, () => {
      const regionId = canonicalRegionIdOrDefault(input.regionId, "region_gray_harbor");
      const { template } = runtimeObjectiveTemplate(input);
      return commandResult(core.createContestedObjective({
        regionId,
        title: template.title,
        description: template.description,
        resourceId: template.resourceId,
        targetScore: template.targetScore,
        mode: template.mode,
        reward: template.reward,
        consolationReward: template.consolationReward,
      }, {
        actorExplorerId: "system",
        trustClass: "system_worker",
        idempotencyKey: optionalString(input.idempotencyKey),
        causationId: typeof input.causationId === "string" ? input.causationId : undefined,
        correlationId: typeof input.correlationId === "string" ? input.correlationId : undefined,
      }));
      });
    },
    contributeObjective: (input: AnyRecord = {}) => {
      const agentId = assertNonEmptyString(input.agentId, "agent_id");
      const identity = requireRuntimeIdentity(agentId);
      return idempotentlyAfterExplorerAuth("contribute_objective", input, identity.explorerId, () => commandResult(core.contributeContestedObjective({
        objectiveId: assertNonEmptyString(input.objectiveId, "objective_id"),
        agentId,
        amount: Number(input.amount),
      }, ownerVerifiedContextFromInput(input, identity.explorerId))));
    },
    settleObjective: (input: AnyRecord = {}) => {
      assertOperatorKey(input);
      return idempotently("settle_objective", input, () => {
        const result = commandResult(core.settleContestedObjective({
          objectiveId: assertNonEmptyString(input.objectiveId, "objective_id"),
        }, {
          actorExplorerId: "system",
          trustClass: "system_worker",
          idempotencyKey: optionalString(input.idempotencyKey),
          causationId: typeof input.causationId === "string" ? input.causationId : undefined,
          correlationId: typeof input.correlationId === "string" ? input.correlationId : undefined,
        }));
        return appendRegionNewsForServerEvent(
          result,
          input,
          "contested_objective_settled",
          `settle_objective_news:${String(input.idempotencyKey)}`,
        );
      }, { allowRestrictedScore: true });
    },
    resourceNodes: (input: AnyRecord = {}): EpochResourceNodeInfo => resourceNodesInfoView(core.project(), input),
    spawnResourceNode: (input: AnyRecord = {}) => {
      assertOperatorKey(input);
      return idempotently("spawn_resource_node", input, () => {
      const regionId = canonicalRegionIdOrDefault(input.regionId, "region_gray_harbor");
      const resourceId = typeof input.resourceId === "string" ? input.resourceId as EpochResourceId : "aether";
      return commandResult(core.createResourceNode({
        regionId,
        title: typeof input.title === "string" ? input.title : "灰港灵质露点",
        description: typeof input.description === "string" ? input.description : "潮线退去后短暂浮现的灵质矿脉，所有争抢都按服务器体力消耗结算。",
        resourceId,
        rewardAmount: typeof input.rewardAmount === "number" ? input.rewardAmount : 2,
        rewardReason: typeof input.rewardReason === "string" ? input.rewardReason : "resource_node_aether_winner",
      }, {
        actorExplorerId: "system",
        trustClass: "system_worker",
        idempotencyKey: optionalString(input.idempotencyKey),
        causationId: typeof input.causationId === "string" ? input.causationId : undefined,
        correlationId: typeof input.correlationId === "string" ? input.correlationId : undefined,
      }));
      });
    },
    contestResourceNode: (input: AnyRecord = {}) => {
      const agentId = assertNonEmptyString(input.agentId, "agent_id");
      const identity = requireRuntimeIdentity(agentId);
      return idempotentlyAfterExplorerAuth("contest_resource_node", input, identity.explorerId, () => commandResult(core.contestResourceNode({
        nodeId: assertNonEmptyString(input.nodeId, "resource_node_id"),
        agentId,
        staminaSpent: Number(input.staminaSpent),
      }, ownerVerifiedContextFromInput(input, identity.explorerId))));
    },
    settleResourceNode: (input: AnyRecord = {}) => {
      assertOperatorKey(input);
      return idempotently("settle_resource_node", input, () => {
        const result = commandResult(core.settleResourceNode({
          nodeId: assertNonEmptyString(input.nodeId, "resource_node_id"),
        }, {
          actorExplorerId: "system",
          trustClass: "system_worker",
          idempotencyKey: optionalString(input.idempotencyKey),
          causationId: typeof input.causationId === "string" ? input.causationId : undefined,
          correlationId: typeof input.correlationId === "string" ? input.correlationId : undefined,
        }));
        return appendRegionNewsForServerEvent(
          result,
          input,
          "resource_node_settled",
          `settle_resource_node_news:${String(input.idempotencyKey)}`,
        );
      });
    },
    anomalies: (input: AnyRecord = {}): EpochAnomalyInfo => anomaliesInfoView(core.project(), input),
    spawnAnomaly: (input: AnyRecord = {}) => {
      assertOperatorKey(input);
      return idempotently("spawn_anomaly", input, () => {
        const regionId = canonicalRegionIdOrDefault(input.regionId, "region_gray_harbor");
        const result = commandResult(core.createAnomalyEvent(anomalyEventInputFromOperatorInput(input, regionId), {
          actorExplorerId: "system",
          trustClass: "system_worker",
          idempotencyKey: optionalString(input.idempotencyKey),
          causationId: typeof input.causationId === "string" ? input.causationId : undefined,
          correlationId: typeof input.correlationId === "string" ? input.correlationId : undefined,
        }));
        return appendRegionNewsForServerEvent(
          result,
          input,
          "anomaly_event_spawned",
          `spawn_anomaly_news:${String(input.idempotencyKey)}`,
        );
      });
    },
    contestAnomaly: (input: AnyRecord = {}) => {
      const agentId = assertNonEmptyString(input.agentId, "agent_id");
      const identity = requireRuntimeIdentity(agentId);
      return idempotentlyAfterExplorerAuth("contest_anomaly", input, identity.explorerId, () => commandResult(core.contestAnomalyEvent({
        anomalyId: assertNonEmptyString(input.anomalyId, "anomaly_id"),
        agentId,
        focusSpent: Number(input.focusSpent),
      }, ownerVerifiedContextFromInput(input, identity.explorerId))));
    },
    resolveAnomaly: (input: AnyRecord = {}) => {
      assertOperatorKey(input);
      return idempotently("resolve_anomaly", input, () => {
        const result = commandResult(core.resolveAnomalyEvent({
          anomalyId: assertNonEmptyString(input.anomalyId, "anomaly_id"),
        }, {
          actorExplorerId: "system",
          trustClass: "system_worker",
          idempotencyKey: optionalString(input.idempotencyKey),
          causationId: typeof input.causationId === "string" ? input.causationId : undefined,
          correlationId: typeof input.correlationId === "string" ? input.correlationId : undefined,
        }));
        return appendRegionNewsForServerEvent(
          result,
          input,
          "anomaly_event_resolved",
          `resolve_anomaly_news:${String(input.idempotencyKey)}`,
        );
      });
    },
    inventory: (input: AnyRecord = {}): EpochInventoryInfo => inventoryInfoView(core.project(), input),
    shop: (input: AnyRecord = {}): EpochShopInfo => shopInfoView(input),
    createInventoryItem: (input: AnyRecord = {}): EpochRuntimeResult<EpochInventoryItem> => {
      assertOperatorKey(input);
      return idempotently("create_item", input, () => commandResult(core.createInventoryItem({
        agentId: assertNonEmptyString(input.agentId, "agent_id"),
        itemKey: assertNonEmptyString(input.itemKey, "item_key"),
        displayName: assertNonEmptyString(input.displayName, "item_display_name"),
        rarity: typeof input.rarity === "string" ? input.rarity : undefined,
        sourceEventIds: Array.isArray(input.sourceEventIds) ? input.sourceEventIds : [],
      }, {
        actorExplorerId: "system",
        trustClass: "system_worker",
        idempotencyKey: optionalString(input.idempotencyKey),
        causationId: typeof input.causationId === "string" ? input.causationId : undefined,
        correlationId: typeof input.correlationId === "string" ? input.correlationId : undefined,
      })), { allowRestrictedScore: true });
    },
    craftInventoryItem: (input: AnyRecord = {}): EpochRuntimeResult<EpochInventoryItem> => {
      const agentId = assertNonEmptyString(input.agentId, "agent_id");
      const identity = requireRuntimeIdentity(agentId);
      return idempotentlyAfterExplorerAuth("craft_item", input, identity.explorerId, () => commandResult(core.craftInventoryItem({
        agentId,
        recipeId: assertNonEmptyString(input.recipeId, "recipe_id"),
      }, ownerVerifiedContextFromInput(input, identity.explorerId))));
    },
    purchaseShopOffer: (input: AnyRecord = {}): EpochRuntimeResult<EpochInventoryItem> => {
      const agentId = assertNonEmptyString(input.agentId, "agent_id");
      const identity = requireRuntimeIdentity(agentId);
      return idempotentlyAfterExplorerAuth("purchase_shop_offer", input, identity.explorerId, () => commandResult(core.purchaseShopOffer({
        agentId,
        offerId: assertNonEmptyString(input.offerId, "offer_id"),
        regionId: canonicalRegionIdFromInput(input.regionId),
      }, ownerVerifiedContextFromInput(input, identity.explorerId))));
    },
    bindInventoryItem: (input: AnyRecord = {}): EpochRuntimeResult<EpochInventoryItem> => {
      const itemId = assertNonEmptyString(input.itemId, "item_id");
      const item = core.project().inventoryItems[itemId];
      if (!item) throw new Error("inventory_item_not_found");
      const agentId = assertNonEmptyString(input.agentId || item.agentId, "agent_id");
      const identity = requireRuntimeIdentity(agentId);
      return idempotentlyAfterExplorerAuth("bind_item", input, identity.explorerId, () => commandResult(core.bindInventoryItem({
        itemId,
        agentId,
        reason: typeof input.reason === "string" ? input.reason : undefined,
      }, ownerVerifiedContextFromInput(input, identity.explorerId))));
    },
    seasons: (input: AnyRecord = {}): EpochSeasonCampaignInfo => seasonsInfoView(core.project(), input),
    seasonArchive: (input: AnyRecord = {}): EpochSeasonArchiveInfo => seasonArchiveInfoView(core.project(), input),
    seedSeason: (input: AnyRecord = {}) => {
      assertOperatorKey(input);
      return idempotently("seed_season", input, () => {
        const regionId = canonicalRegionIdOrDefault(input.regionId, "region_gray_harbor");
        const { seasonKey, template } = runtimeSeasonTemplate(input);
        const factionIds = Array.isArray(input.factionIds)
          ? [...new Set(input.factionIds.map((factionId) => assertNonEmptyString(factionId, "season_faction_id")))]
          : template.factionIds;
        if (factionIds.length < 2) throw new Error("season_factions_required");
        const seasonInstanceKey = typeof input.seasonInstanceKey === "string" && input.seasonInstanceKey.trim()
          ? input.seasonInstanceKey.trim()
          : `${seasonKey}:${regionId}`;
        const seasonResult = commandResult(core.createSeasonCampaign({
          seasonKey: seasonInstanceKey,
          title: template.title,
          description: template.description,
          regionIds: [regionId],
          factionIds,
          resourceId: template.resourceId,
          targetScore: template.targetScore,
          reward: template.reward,
          objectives: template.objectives || [],
        }, {
          actorExplorerId: "system",
          trustClass: "system_worker",
          idempotencyKey: optionalString(input.idempotencyKey),
          causationId: typeof input.causationId === "string" ? input.causationId : undefined,
          correlationId: typeof input.correlationId === "string" ? input.correlationId : undefined,
        }));
        const events: EpochEvent[] = [...seasonResult.events];
        let projection = seasonResult.projection;
        const createdSeason = seasonResult.value;
        if (seasonResult.events.some((event) => event.eventType === "season_campaign_created")) {
          try {
            const encounterInput = anomalyEventInputFromTemplate(regionId, {
              ...input,
              templateKey: typeof input.encounterTemplateKey === "string" ? input.encounterTemplateKey : "obsidian_wyrm_boss",
              anomalyNarrativeVariantSeed: `${createdSeason.seasonId}:${regionId}:opening_encounter`,
            });
            const encounterResult = appendRegionNewsForServerEvent(
              commandResult(core.createAnomalyEvent({
                ...encounterInput,
                sourceSeasonId: createdSeason.seasonId,
              }, maintenanceContext(input, `season:${createdSeason.seasonId}:encounter:${maintenanceIdSegment(regionId)}`))),
              input,
              "anomaly_event_spawned",
              `season:${createdSeason.seasonId}:encounter-news:${maintenanceIdSegment(regionId)}`,
            );
            events.push(...encounterResult.events);
            projection = encounterResult.projection;
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (!ANOMALY_SKIP_ERRORS.has(message)) throw error;
          }
        }
        return {
          value: seasonCampaignRuntimeView(projection, createdSeason),
          events,
          projection,
        };
      });
    },
    contributeSeason: (input: AnyRecord = {}) => {
      const agentId = assertNonEmptyString(input.agentId, "agent_id");
      const identity = requireRuntimeIdentity(agentId);
      return idempotentlyAfterExplorerAuth("contribute_season", input, identity.explorerId, () => seasonRuntimeResultView(commandResult(core.contributeSeasonCampaign({
        seasonId: assertNonEmptyString(input.seasonId, "season_id"),
        agentId,
        factionId: assertNonEmptyString(input.factionId, "faction_id"),
        amount: Number(input.amount),
      }, ownerVerifiedContextFromInput(input, identity.explorerId)))));
    },
    settleSeason: (input: AnyRecord = {}) => {
      assertOperatorKey(input);
      return idempotently("settle_season", input, () => seasonRuntimeResultView(commandResult(core.settleSeasonCampaign({
        seasonId: assertNonEmptyString(input.seasonId, "season_id"),
      }, {
        actorExplorerId: "system",
        trustClass: "system_worker",
        idempotencyKey: optionalString(input.idempotencyKey),
        causationId: typeof input.causationId === "string" ? input.causationId : undefined,
        correlationId: typeof input.correlationId === "string" ? input.correlationId : undefined,
      }))));
    },
    market: (input: AnyRecord = {}): EpochMarketInfo => marketInfoView(core.project(), input),
    directTrades: (input: AnyRecord = {}): EpochDirectTradeInfo => directTradesInfoView(core.project(), input),
    bounties: (input: AnyRecord = {}): EpochBountyInfo => bountiesInfoView(core.project(), input),
    createMarketOrder: (input: AnyRecord = {}) => {
      const sellerAgentId = assertNonEmptyString(input.sellerAgentId || input.agentId, "seller_agent_id");
      const seller = requireRuntimeIdentity(sellerAgentId);
      return idempotentlyAfterExplorerAuth("create_market_order", input, seller.explorerId, () => commandResult(core.createMarketOrder({
        sellerAgentId,
        regionId: canonicalRegionIdFromInput(input.regionId),
        sellResourceId: optionalString(input.sellResourceId) as EpochResourceId | undefined,
        sellAmount: optionalNumber(input.sellAmount),
        sellItemId: optionalString(input.sellItemId),
        priceResourceId: assertNonEmptyString(input.priceResourceId, "price_resource_id") as EpochResourceId,
        priceAmount: Number(input.priceAmount),
      }, ownerVerifiedContextFromInput(input, seller.explorerId))));
    },
    fillMarketOrder: (input: AnyRecord = {}) => {
      const buyerAgentId = assertNonEmptyString(input.buyerAgentId || input.agentId, "buyer_agent_id");
      const buyer = requireRuntimeIdentity(buyerAgentId);
      return idempotentlyAfterExplorerAuth("fill_market_order", input, buyer.explorerId, () => commandResult(core.fillMarketOrder({
        orderId: assertNonEmptyString(input.orderId, "order_id"),
        buyerAgentId,
      }, ownerVerifiedContextFromInput(input, buyer.explorerId))));
    },
    cancelMarketOrder: (input: AnyRecord = {}) => {
      const orderId = assertNonEmptyString(input.orderId, "order_id");
      const order = core.project().marketOrders[orderId];
      if (!order) throw new Error("market_order_not_found");
      const sellerAgentId = order.sellerAgentId;
      const seller = requireRuntimeIdentity(sellerAgentId);
      return idempotentlyAfterExplorerAuth("cancel_market_order", input, seller.explorerId, () => commandResult(core.cancelMarketOrder({
        orderId,
        sellerAgentId,
      }, ownerVerifiedContextFromInput(input, seller.explorerId))));
    },
    createDirectTrade: (input: AnyRecord = {}) => {
      const proposerAgentId = assertNonEmptyString(input.proposerAgentId || input.agentId, "proposer_agent_id");
      const proposer = requireRuntimeIdentity(proposerAgentId);
      return idempotentlyAfterExplorerAuth("create_direct_trade", input, proposer.explorerId, () => commandResult(core.createDirectTrade({
        proposerAgentId,
        counterpartyAgentId: assertNonEmptyString(input.counterpartyAgentId, "counterparty_agent_id"),
        regionId: canonicalRegionIdFromInput(input.regionId),
        offerResourceId: optionalString(input.offerResourceId) as EpochResourceId | undefined,
        offerAmount: optionalNumber(input.offerAmount),
        offerItemId: optionalString(input.offerItemId),
        requestResourceId: optionalString(input.requestResourceId) as EpochResourceId | undefined,
        requestAmount: optionalNumber(input.requestAmount),
        requestItemId: optionalString(input.requestItemId),
      }, ownerVerifiedContextFromInput(input, proposer.explorerId))));
    },
    acceptDirectTrade: (input: AnyRecord = {}) => {
      const counterpartyAgentId = assertNonEmptyString(input.counterpartyAgentId || input.agentId, "counterparty_agent_id");
      const counterparty = requireRuntimeIdentity(counterpartyAgentId);
      return idempotentlyAfterExplorerAuth("accept_direct_trade", input, counterparty.explorerId, () => commandResult(core.acceptDirectTrade({
        tradeId: assertNonEmptyString(input.tradeId, "trade_id"),
        counterpartyAgentId,
      }, ownerVerifiedContextFromInput(input, counterparty.explorerId))));
    },
    cancelDirectTrade: (input: AnyRecord = {}) => {
      const tradeId = assertNonEmptyString(input.tradeId, "trade_id");
      const trade = core.project().directTrades[tradeId];
      if (!trade) throw new Error("direct_trade_not_found");
      const proposer = requireRuntimeIdentity(trade.proposerAgentId);
      return idempotentlyAfterExplorerAuth("cancel_direct_trade", input, proposer.explorerId, () => commandResult(core.cancelDirectTrade({
        tradeId,
        proposerAgentId: trade.proposerAgentId,
      }, ownerVerifiedContextFromInput(input, proposer.explorerId))));
    },
    tickMarketExpiry: (input: AnyRecord = {}): EpochRuntimeResult<TickMarketExpiryResult> => {
      assertOperatorKey(input);
      return idempotently("tick_market_expiry", input, () => commandResult(core.tickMarketExpiry({
        maxAgeSeconds: optionalNumber(input.maxAgeSeconds),
        limit: optionalNumber(input.limit),
      }, {
        actorExplorerId: "system",
        trustClass: "system_worker",
        idempotencyKey: optionalString(input.idempotencyKey),
        causationId: typeof input.causationId === "string" ? input.causationId : undefined,
        correlationId: typeof input.correlationId === "string" ? input.correlationId : undefined,
      })));
    },
    tickDirectTradeExpiry: (input: AnyRecord = {}): EpochRuntimeResult<TickDirectTradeExpiryResult> => {
      assertOperatorKey(input);
      return idempotently("tick_direct_trade_expiry", input, () => commandResult(core.tickDirectTradeExpiry({
        maxAgeSeconds: optionalNumber(input.maxAgeSeconds),
        limit: optionalNumber(input.limit),
      }, {
        actorExplorerId: "system",
        trustClass: "system_worker",
        idempotencyKey: optionalString(input.idempotencyKey),
        causationId: typeof input.causationId === "string" ? input.causationId : undefined,
        correlationId: typeof input.correlationId === "string" ? input.correlationId : undefined,
      })));
    },
    createBounty: (input: AnyRecord = {}) => {
      const sponsorAgentId = assertNonEmptyString(input.sponsorAgentId || input.agentId, "sponsor_agent_id");
      const sponsor = requireRuntimeIdentity(sponsorAgentId);
      return idempotentlyAfterExplorerAuth("create_bounty", input, sponsor.explorerId, () => commandResult(core.createBounty({
        sponsorAgentId,
        regionId: resolveEpochCanonicalRegionId(assertNonEmptyString(input.regionId, "region_id")),
        title: assertNonEmptyString(input.title, "bounty_title"),
        description: typeof input.description === "string" ? input.description : undefined,
        rewardResourceId: assertNonEmptyString(input.rewardResourceId, "reward_resource_id") as EpochResourceId,
        rewardAmount: Number(input.rewardAmount),
        requiredItemKey: typeof input.requiredItemKey === "string" ? input.requiredItemKey : undefined,
      }, ownerVerifiedContextFromInput(input, sponsor.explorerId))));
    },
    claimBounty: (input: AnyRecord = {}) => {
      const claimantAgentId = assertNonEmptyString(input.claimantAgentId || input.agentId, "claimant_agent_id");
      const claimant = requireRuntimeIdentity(claimantAgentId);
      return idempotentlyAfterExplorerAuth("claim_bounty", input, claimant.explorerId, () => commandResult(core.claimBounty({
        bountyId: assertNonEmptyString(input.bountyId, "bounty_id"),
        claimantAgentId,
        fulfillmentItemId: typeof input.fulfillmentItemId === "string" ? input.fulfillmentItemId : undefined,
        evidence: typeof input.evidence === "string" ? input.evidence : undefined,
      }, ownerVerifiedContextFromInput(input, claimant.explorerId))));
    },
    partyRuns: (input: AnyRecord = {}): EpochPartyRunInfo => partyRunsInfoView(core.project(), input),
    createPartyRun: (input: AnyRecord = {}) => {
      const leaderAgentId = assertNonEmptyString(input.leaderAgentId || input.agentId, "leader_agent_id");
      const leader = requireRuntimeIdentity(leaderAgentId);
      return idempotentlyAfterExplorerAuth("create_party_run", input, leader.explorerId, () => commandResult(core.createPartyRun({
        leaderAgentId,
        regionId: resolveEpochCanonicalRegionId(assertNonEmptyString(input.regionId, "region_id")),
        title: assertNonEmptyString(input.title, "party_title"),
        objective: assertNonEmptyString(input.objective, "party_objective"),
        joinPolicy: optionalString(input.joinPolicy) as undefined | "open" | "invite_only",
        inviteToken: optionalString(input.inviteToken),
        inviteTokenExpiresAt: optionalString(input.inviteTokenExpiresAt),
        inviteTokenUseLimit: input.inviteTokenUseLimit === undefined ? undefined : Number(input.inviteTokenUseLimit),
        inviteRecipientAgentId: optionalString(input.inviteRecipientAgentId),
      }, ownerVerifiedContextFromInput(input, leader.explorerId))));
    },
    updatePartyInvite: (input: AnyRecord = {}) => {
      const leaderAgentId = assertNonEmptyString(input.leaderAgentId || input.agentId, "leader_agent_id");
      const leader = requireRuntimeIdentity(leaderAgentId);
      return idempotentlyAfterExplorerAuth("update_party_invite", input, leader.explorerId, () => commandResult(core.updatePartyInvite({
        partyRunId: assertNonEmptyString(input.partyRunId, "party_run_id"),
        leaderAgentId,
        inviteToken: optionalString(input.inviteToken),
        inviteTokenExpiresAt: optionalString(input.inviteTokenExpiresAt),
        inviteTokenUseLimit: input.inviteTokenUseLimit === undefined ? undefined : Number(input.inviteTokenUseLimit),
        inviteRecipientAgentId: optionalString(input.inviteRecipientAgentId),
        revoke: input.revoke === true,
      }, ownerVerifiedContextFromInput(input, leader.explorerId))));
    },
    joinPartyRun: (input: AnyRecord = {}) => {
      const agentId = assertNonEmptyString(input.agentId, "agent_id");
      const identity = requireRuntimeIdentity(agentId);
      return idempotentlyAfterExplorerAuth("join_party_run", input, identity.explorerId, () => commandResult(core.joinPartyRun({
        partyRunId: assertNonEmptyString(input.partyRunId, "party_run_id"),
        agentId,
        participantRole: assertNonEmptyString(input.participantRole, "participant_role") as EpochPartyRole,
        inviteToken: optionalString(input.inviteToken),
      }, ownerVerifiedContextFromInput(input, identity.explorerId))));
    },
    requestPartyJoin: (input: AnyRecord = {}) => {
      const agentId = assertNonEmptyString(input.agentId, "agent_id");
      const identity = requireRuntimeIdentity(agentId);
      return idempotentlyAfterExplorerAuth("request_party_join", input, identity.explorerId, () => commandResult(core.requestPartyJoin({
        partyRunId: assertNonEmptyString(input.partyRunId, "party_run_id"),
        agentId,
        participantRole: assertNonEmptyString(input.participantRole, "participant_role") as EpochPartyRole,
        requestNote: optionalString(input.requestNote),
      }, ownerVerifiedContextFromInput(input, identity.explorerId))));
    },
    resolvePartyJoinRequest: (input: AnyRecord = {}) => {
      const leaderAgentId = assertNonEmptyString(input.leaderAgentId || input.agentId, "leader_agent_id");
      const leader = requireRuntimeIdentity(leaderAgentId);
      return idempotentlyAfterExplorerAuth("resolve_party_join_request", input, leader.explorerId, () => commandResult(core.resolvePartyJoinRequest({
        partyRunId: assertNonEmptyString(input.partyRunId, "party_run_id"),
        leaderAgentId,
        requestId: assertNonEmptyString(input.requestId, "party_join_request_id"),
        resolution: assertNonEmptyString(input.resolution, "party_join_request_resolution") as "approved" | "rejected",
        resolutionNote: optionalString(input.resolutionNote),
      }, ownerVerifiedContextFromInput(input, leader.explorerId))));
    },
    settlePartyRun: (input: AnyRecord = {}) => {
      assertOperatorKey(input);
      return idempotently("settle_party_run", input, () => commandResult(core.settlePartyRun({
        partyRunId: assertNonEmptyString(input.partyRunId, "party_run_id"),
      }, {
        actorExplorerId: "system",
        trustClass: "system_worker",
        idempotencyKey: optionalString(input.idempotencyKey),
        causationId: typeof input.causationId === "string" ? input.causationId : undefined,
        correlationId: typeof input.correlationId === "string" ? input.correlationId : undefined,
      })));
    },
    raids: (input: AnyRecord = {}): EpochRaidInfo => raidsInfoView(core.project(), input),
    resolveRaid: (input: AnyRecord = {}) => {
      const attackerAgentId = assertNonEmptyString(input.attackerAgentId || input.agentId, "attacker_agent_id");
      const attacker = requireRuntimeIdentity(attackerAgentId);
      return idempotentlyAfterExplorerAuth("resolve_raid", input, attacker.explorerId, () => commandResult(core.resolveRaid({
        regionId: resolveEpochCanonicalRegionId(assertNonEmptyString(input.regionId, "region_id")),
        attackerAgentId,
        defenderAgentId: assertNonEmptyString(input.defenderAgentId, "defender_agent_id"),
        staminaSpent: Number(input.staminaSpent),
      }, ownerVerifiedContextFromInput(input, attacker.explorerId))));
    },
    resolveRegionRevolt: (input: AnyRecord = {}) => {
      const agentId = assertNonEmptyString(input.agentId, "agent_id");
      const identity = requireRuntimeIdentity(agentId);
      return idempotentlyAfterExplorerAuth("resolve_region_revolt", input, identity.explorerId, () => commandResult(core.resolveRegionRevolt({
        regionId: resolveEpochCanonicalRegionId(assertNonEmptyString(input.regionId, "region_id")),
        seasonId: assertNonEmptyString(input.seasonId, "season_id"),
        factionId: assertNonEmptyString(input.factionId, "faction_id"),
        agentId,
        staminaSpent: Number(input.staminaSpent),
      }, ownerVerifiedContextFromInput(input, identity.explorerId))));
    },
    resolveRetaliation: (input: AnyRecord = {}) => {
      const opportunityAgentId = assertNonEmptyString(input.opportunityAgentId || input.agentId, "opportunity_agent_id");
      const opportunityAgent = requireRuntimeIdentity(opportunityAgentId);
      return idempotentlyAfterExplorerAuth("resolve_retaliation", input, opportunityAgent.explorerId, () => commandResult(core.resolveRetaliation({
        retaliationId: assertNonEmptyString(input.retaliationId, "retaliation_id"),
        opportunityAgentId,
        staminaSpent: Number(input.staminaSpent),
      }, ownerVerifiedContextFromInput(input, opportunityAgent.explorerId))));
    },
    relationships: (input: AnyRecord = {}): EpochRelationshipGraphInfo => relationshipsInfoView(core.project(), input),
    diplomacy: (input: AnyRecord = {}): EpochDiplomacyInfo => diplomacyInfoView(core.project(), input),
    proposeDiplomacy: (input: AnyRecord = {}) => {
      const sourceAgentId = assertNonEmptyString(input.sourceAgentId || input.agentId, "source_agent_id");
      const source = requireRuntimeIdentity(sourceAgentId);
      return idempotentlyAfterExplorerAuth("propose_diplomacy", input, source.explorerId, () => commandResult(core.proposeDiplomacy({
        regionId: resolveEpochCanonicalRegionId(assertNonEmptyString(input.regionId, "region_id")),
        sourceAgentId,
        targetAgentId: assertNonEmptyString(input.targetAgentId, "target_agent_id"),
        kind: assertNonEmptyString(input.kind, "relationship_kind") as EpochRelationshipKind,
        focusSpent: Number(input.focusSpent),
        terms: typeof input.terms === "string" ? input.terms : undefined,
      }, ownerVerifiedContextFromInput(input, source.explorerId))));
    },
    respondDiplomacy: (input: AnyRecord = {}) => {
      const diplomacyId = assertNonEmptyString(input.diplomacyId, "diplomacy_id");
      const proposal = core.project().diplomacyRecords[diplomacyId];
      if (!proposal) throw new Error("diplomacy_not_found");
      const responderAgentId = assertNonEmptyString(input.responderAgentId || input.agentId, "responder_agent_id");
      const responder = requireRuntimeIdentity(responderAgentId);
      return idempotentlyAfterExplorerAuth("respond_diplomacy", input, responder.explorerId, () => commandResult(core.respondDiplomacy({
        diplomacyId,
        responderAgentId,
        response: assertNonEmptyString(input.response, "diplomacy_response") as EpochDiplomacyResponse,
        focusSpent: optionalNumber(input.focusSpent),
        note: typeof input.note === "string" ? input.note : undefined,
      }, ownerVerifiedContextFromInput(input, responder.explorerId))));
    },
    updateRelationship: (input: AnyRecord = {}) => {
      const sourceAgentId = assertNonEmptyString(input.sourceAgentId || input.agentId, "source_agent_id");
      const source = requireRuntimeIdentity(sourceAgentId);
      return idempotentlyAfterExplorerAuth("update_relationship", input, source.explorerId, () => commandResult(core.updateRelationship({
        sourceAgentId,
        targetAgentId: assertNonEmptyString(input.targetAgentId, "target_agent_id"),
        kind: assertNonEmptyString(input.kind, "relationship_kind") as EpochRelationshipKind,
        focusSpent: Number(input.focusSpent),
        reason: typeof input.reason === "string" ? input.reason : undefined,
      }, ownerVerifiedContextFromInput(input, source.explorerId))));
    },
    updateAgentNpcBond: (input: AnyRecord = {}) => {
      const agentId = assertNonEmptyString(input.agentId, "agent_id");
      const identity = requireRuntimeIdentity(agentId);
      return idempotentlyAfterExplorerAuth("update_agent_npc_bond", input, identity.explorerId, () => commandResult(core.updateAgentNpcBond({
        agentId,
        npcId: assertNonEmptyString(input.npcId, "npc_id"),
        kind: assertNonEmptyString(input.kind, "agent_npc_bond_kind") as EpochNpcRelationshipKind,
        focusSpent: Number(input.focusSpent),
        reason: typeof input.reason === "string" ? input.reason : undefined,
        clientDeclaredScoreAfter: typeof input.clientDeclaredScoreAfter === "number" ? input.clientDeclaredScoreAfter : undefined,
      }, ownerVerifiedContextFromInput(input, identity.explorerId))));
    },
    traceConflictTemplates: () => ({ templates: traceConflictTemplateCatalog() }),
    deployTraceConflict: (input: AnyRecord = {}): EpochRuntimeResult<TraceConflictDeployment> => {
      const agentId = assertNonEmptyString(input.agentId, "agent_id");
      const identity = requireRuntimeIdentity(agentId);
      return idempotentlyAfterExplorerAuth("deploy_trace_conflict", input, identity.explorerId, () => commandResult(
        core.deployTraceConflict({
          agentId,
          templateKey: assertNonEmptyString(input.templateKey, "trace_conflict_template_key_required"),
          regionId: canonicalRegionIdFromInput(input.regionId),
          target: traceConflictTargetFromInput(input),
          sourceEventIds: Array.isArray(input.sourceEventIds)
            ? input.sourceEventIds.filter((value): value is string => typeof value === "string")
            : undefined,
        }, ownerVerifiedContextFromInput(input, identity.explorerId)),
      ));
    },
    ownerTraceConflicts: (input: AnyRecord = {}): readonly TraceConflictOwnerDeploymentView[] => {
      const agentId = assertNonEmptyString(input.agentId, "agent_id");
      const identity = requireRuntimeIdentity(agentId);
      explorerAuthRuntime.assertExplorerAuth(input, identity.explorerId);
      return core.ownerTraceConflicts({
        agentId,
        status: typeof input.status === "string" ? input.status as "active" | "triggered" | "countered" | "expired" : undefined,
        limit: optionalNumber(input.limit),
      }, ownerVerifiedContextFromInput(input, identity.explorerId));
    },
    ownerTraceConflictMemories: (input: AnyRecord = {}): readonly TraceConflictMemoryView[] => {
      const agentId = assertNonEmptyString(input.agentId, "agent_id");
      const identity = requireRuntimeIdentity(agentId);
      explorerAuthRuntime.assertExplorerAuth(input, identity.explorerId);
      return core.ownerTraceConflictMemories({
        agentId,
        limit: optionalNumber(input.limit),
      }, ownerVerifiedContextFromInput(input, identity.explorerId));
    },
    regionTraceConflicts: (input: AnyRecord = {}): TraceConflictRegionView => {
      const regionId = canonicalRegionIdFromInput(input.regionId)
        || assertNonEmptyString(input.regionId, "region_id");
      const agentId = optionalString(input.agentId);
      if (!agentId) {
        return core.regionTraceConflicts({ regionId, limit: optionalNumber(input.limit) }, {
          actorExplorerId: "anonymous",
          trustClass: "untrusted_client",
        });
      }
      const identity = requireRuntimeIdentity(agentId);
      explorerAuthRuntime.assertExplorerAuth(input, identity.explorerId);
      return core.regionTraceConflicts({ regionId, limit: optionalNumber(input.limit) },
        ownerVerifiedContextFromInput(input, identity.explorerId));
    },
    createTurnCard: (input: AnyRecord = {}): EpochRuntimeResult<EpochTurnCard> => {
      const agentId = assertNonEmptyString(input.agentId, "agent_id");
      const identity = requireRuntimeIdentity(agentId);
      return idempotentlyAfterExplorerAuth("turn_card", input, identity.explorerId, () => commandResult(core.createTurnCard({
        agentId,
        regionId: resolveEpochCanonicalRegionId(assertNonEmptyString(input.regionId, "region_id")),
        prompt: typeof input.prompt === "string" ? input.prompt : undefined,
        target: traceConflictTargetFromInput(input),
      }, ownerVerifiedContextFromInput(input, identity.explorerId))));
    },
    resolveTurnCard: (input: AnyRecord = {}): EpochRuntimeResult<EpochTurnResolution> => {
      const turnCardId = assertNonEmptyString(input.turnCardId, "turn_card_id");
      const card = core.project().turnCards[turnCardId];
      if (!card) throw new Error("turn_card_not_found");
      const authInput = { ...input, agentId: card.agentId };
      return idempotentlyAfterExplorerAuth("resolve_turn", authInput, card.explorerId, () => commandResult(core.resolveTurnCard({
        turnCardId,
        actionOptionId: assertNonEmptyString(input.actionOptionId, "action_option_id"),
        ...turnCardResponseEnvelope(input, card),
        visibleText: typeof input.visibleText === "string" ? input.visibleText : undefined,
      }, ownerVerifiedContextFromInput(authInput, card.explorerId))));
    },
    hostedSessions: (input: AnyRecord = {}): EpochHostedSessionInfo => hostedSessionsInfoView(core.project(), input),
    startHostedSession: (input: AnyRecord = {}): EpochRuntimeResult<EpochHostedSession> => {
      const agentId = assertNonEmptyString(input.agentId, "agent_id");
      const identity = requireRuntimeIdentity(agentId);
      return idempotentlyAfterExplorerAuth("start_hosted_session", input, identity.explorerId, () => {
        assertNoRequestSecretMaterialInPublicText(input, input.mandate);
        return commandResult(core.startHostedSession({
          agentId,
          regionId: resolveEpochCanonicalRegionId(assertNonEmptyString(input.regionId, "region_id")),
          mandate: typeof input.mandate === "string" ? input.mandate : undefined,
        }, ownerVerifiedContextFromInput(input, identity.explorerId)));
      });
    },
    startJourneyHostedSession: (input: AnyRecord = {}): EpochRuntimeResult<EpochHostedSession> => {
      const agentId = assertNonEmptyString(input.agentId, "agent_id");
      const identity = requireRuntimeIdentity(agentId);
      const journeyScene = input.journeyScene;
      if (!journeyScene || typeof journeyScene !== "object" || Array.isArray(journeyScene)) {
        throw new Error("journey_scene_contract_seed_required");
      }
      return idempotentlyAfterExplorerAuth("start_hosted_session", input, identity.explorerId, () => {
        assertNoRequestSecretMaterialInPublicText(input, input.mandate);
        return commandResult(core.startHostedSession({
          agentId,
          regionId: resolveEpochCanonicalRegionId(assertNonEmptyString(input.regionId, "region_id")),
          mandate: typeof input.mandate === "string" ? input.mandate : undefined,
          journeyScene: journeyScene as JourneySceneContractSeed,
        }, ownerVerifiedContextFromInput(input, identity.explorerId)));
      });
    },
    journeyHostedSession: (input: AnyRecord = {}): EpochHostedSession => {
      const sessionId = typeof input.sessionId === "string" ? input.sessionId.trim() : "";
      const journeyId = typeof input.journeyId === "string" ? input.journeyId.trim() : "";
      const sceneId = typeof input.sceneId === "string" ? input.sceneId.trim() : "";
      const episodeId = typeof input.episodeId === "string" ? input.episodeId.trim() : "";
      const expectedVersion = Number(input.expectedVersion);
      const session = sessionId
        ? core.project().hostedSessions[sessionId]
        : Object.values(core.project().hostedSessions).find((candidate) =>
            candidate.sceneContract?.journeyId === journeyId
            && (sceneId
              ? candidate.sceneContract.sceneId === sceneId
              : candidate.sceneContract.episodeId === episodeId
                && candidate.sceneContract.expectedVersion === expectedVersion
                && clock().getTime() <= Date.parse(candidate.sceneContract.expiresAt)));
      if (!session?.sceneContract) throw new Error("journey_scene_contract_not_found");
      explorerAuthRuntime.assertExplorerAuth(input, session.explorerId);
      return session;
    },
    commitJourneyHostedAction: (input: AnyRecord = {}): EpochRuntimeResult<EpochHostedActionRecord> => {
      const journeyId = assertNonEmptyString(input.journeyId, "journey_id");
      const sceneId = assertNonEmptyString(input.sceneId, "journey_scene_id");
      const session = Object.values(core.project().hostedSessions).find((candidate) =>
        candidate.sceneContract?.journeyId === journeyId
        && candidate.sceneContract.sceneId === sceneId);
      if (!session?.sceneContract) throw new Error("journey_scene_contract_not_found");
      const sessionId = session.sessionId;
      const expectedVersion = Number(input.expectedVersion);
      if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 0) {
        throw new Error("journey_expected_version_invalid");
      }
      const episodeId = assertNonEmptyString(input.episodeId, "journey_episode_id");
      if (journeyId !== session.sceneContract.journeyId
        || episodeId !== session.sceneContract.episodeId
        || expectedVersion !== session.sceneContract.expectedVersion) {
        throw new Error("journey_scene_commit_binding_invalid");
      }
      const actionOptionId = assertNonEmptyString(input.actionOptionId, "action_option_id");
      const signedAction = session.sceneContract.actionOptions.find((action) => action.actionOptionId === actionOptionId);
      if (!signedAction) throw new Error("journey_scene_action_not_found");
      if (assertNonEmptyString(input.signature, "journey_scene_action_signature") !== signedAction.signature) {
        throw new Error("journey_scene_action_signature_invalid");
      }
      return idempotentlyAfterExplorerAuth("commit_journey_action", input, session.explorerId, () => {
        assertNoRequestSecretMaterialInPublicText(input, input.visibleText);
        return commandResult(core.submitHostedAction({
          sessionId,
          actionOptionId,
          visibleText: typeof input.visibleText === "string" ? input.visibleText : undefined,
          journeyValidation: { journeyId, episodeId, expectedVersion },
        }, ownerVerifiedContextFromInput({ ...input, agentId: session.agentId }, session.explorerId)));
      });
    },
    submitHostedAction: (input: AnyRecord = {}): EpochRuntimeResult<EpochHostedActionRecord> => {
      const sessionId = assertNonEmptyString(input.sessionId, "hosted_session_id");
      const session = core.project().hostedSessions[sessionId];
      if (!session) throw new Error("hosted_session_not_found");
      return idempotentlyAfterExplorerAuth("submit_hosted_action", input, session.explorerId, () => {
        assertNoRequestSecretMaterialInPublicText(input, input.visibleText);
        return commandResult(core.submitHostedAction({
          sessionId,
          actionOptionId: assertNonEmptyString(input.actionOptionId, "action_option_id"),
          visibleText: typeof input.visibleText === "string" ? input.visibleText : undefined,
        }, ownerVerifiedContextFromInput(input, session.explorerId)));
      });
    },
    webBridgeTurn: (input: AnyRecord = {}): EpochRuntimeResult<EpochWebBridgeTurn> => {
      const agentId = assertNonEmptyString(input.agentId, "agent_id");
      const identity = requireRuntimeIdentity(agentId);
      return idempotentlyAfterExplorerAuth("web_bridge_turn", input, identity.explorerId, () => {
        assertNoRequestSecretMaterialInPublicText(input, input.mandate);
        const result = commandResult(core.startHostedSession({
          agentId,
          regionId: resolveEpochCanonicalRegionId(assertNonEmptyString(input.regionId, "region_id")),
          mandate: typeof input.mandate === "string" ? input.mandate : undefined,
          channelClass: "browser_copy_paste",
        }, ownerVerifiedContextFromInput(input, identity.explorerId)));
        return {
          ...result,
          value: webBridgeTurnView(
            result.value,
            typeof input.additionalInstruction === "string" ? input.additionalInstruction : undefined,
          ),
        };
      });
    },
    submitWebBridgeAction: (input: AnyRecord = {}): EpochRuntimeResult<EpochWebBridgeActionResult> => {
      const sessionId = assertNonEmptyString(input.sessionId, "hosted_session_id");
      const session = core.project().hostedSessions[sessionId];
      if (!session) throw new Error("hosted_session_not_found");
      if (session.channelClass !== "browser_copy_paste") throw new Error("web_bridge_session_required");
      return idempotentlyAfterExplorerAuth("submit_web_bridge_action", input, session.explorerId, () => {
        assertNoRequestSecretMaterialInPublicText(input, input.visibleText);
        const result = commandResult(core.submitHostedAction({
          sessionId,
          actionOptionId: assertNonEmptyString(input.actionOptionId, "action_option_id"),
          visibleText: typeof input.visibleText === "string" ? input.visibleText : undefined,
        }, ownerVerifiedContextFromInput(input, session.explorerId)));
        return {
          ...result,
          value: {
            channelClass: "browser_copy_paste",
            deliveryTrust: "untrusted_client",
            action: result.value,
          },
        };
      });
    },
    attestationChallenge: attestationRuntime.issueChallenge,
    submitAttestedAction,
    runServerHostedAction: serverHostedRuntime.runAction,
    runExploration: explorationRuntime.runExploration,
    queueServerHostedAction: serverHostedRuntime.queueAction,
    serverHostedJobs: serverHostedRuntime.jobs,
    runServerHostedJob: serverHostedRuntime.runJob,
    resultPage: (input: AnyRecord = {}): EpochResultPageDraft => {
      const payload = buildEpochResultPagePayload({
        projection: core.project(),
        input,
        generatedAt: serverIsoTime(clock),
        maxDowntimeSeconds: options.maxDowntimeSeconds,
        resolveJourneyHiddenTaskSeal: options.resolveJourneyHiddenTaskSeal,
      });
      return {
        ...payload,
        publishToken: resultPageRuntime.issuePublishToken(input, payload),
      };
    },
    createResultPage: resultPageRuntime.createFromPublishToken,
    revokeResultPage: resultPageRuntime.revoke,
    deleteResultPage: resultPageRuntime.delete,
    getResultPage: ({ pageId }: AnyRecord = {}) => resultPageRuntime.get(String(pageId || "")) || null,
    getPublicResultPage: resultPageRuntime.getPublic,
    resultPages: () => ({ pages: resultPageRuntime.values() }),
  };
}
