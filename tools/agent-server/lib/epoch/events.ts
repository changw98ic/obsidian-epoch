import {
  type EpochAnomalyOutcome,
  type EpochAnomalyMedia,
  type EpochAnomalySeverity,
  type EpochAttributeId,
  type EpochAggregateType,
  type EpochChannelClass,
  type EpochCommandContext,
  type EpochDiplomacyResponse,
  type EpochDowntimeMode,
  type EpochEventType,
  type EpochIdFactory,
  type EpochIdentityStatus,
  type EpochLineageInheritance,
  type EpochContentModerationStatus,
  type EpochLoreAdjudicationStatus,
  type EpochLoreAuthorityReview,
  type EpochLoreContributionCategory,
  type EpochLoreContributionProvenance,
  type EpochLoreRevisionMode,
  type EpochLoreRevisionPolicy,
  type EpochLoreTargetAdjudicationProvenance,
  type EpochMessageScope,
  type EpochMarketTradeRiskFlag,
  type EpochModerationResolution,
  type EpochModerationSubjectType,
  type EpochRiskReviewResolution,
  type EpochNpcMemoryImportance,
  type EpochNpcRelationshipKind,
  type EpochOrganizationBudgetResolution,
  type EpochOrganizationBudgetStatus,
  type EpochOrganizationPoliticsKind,
  type EpochObjectiveMode,
  type EpochPartyRunJoinPolicy,
  type EpochPartyRole,
  type EpochRelationshipKind,
  type EpochResourceId,
  type EpochServerReward,
  type EpochTrustClass,
  assertNonEmptyString,
  isEpochEventType,
  normalizeTrustClass,
} from "./protocol.ts";
import type { IpSimilarityAssessment } from "../ipSimilarity.ts";
import type {
  TraceConflictDeployment,
  TraceConflictOutcome,
  TraceConflictRumorMemory,
  TraceConflictServerEffect,
} from "./traceConflictRules.ts";
import type { JourneySceneContract } from "./journeySceneContractRules.ts";
import type { JourneyActionResolution } from "./journeyActionResolutionRules.ts";
import type {
  EpochWorldCommodityLedger,
  EpochWorldSimulationFlowSummary,
  EpochWorldSimulationSignals,
  EpochWorldSimulationSnapshot,
} from "./worldSimulationRules.ts";

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

export interface WorldClockInitializedPayload {
  readonly clockId: string;
  readonly worldMinute: number;
  readonly worldTime: string;
  readonly ruleVersion: string;
  /** Present for server-elapsed clocks; absent on persisted v1 manual clocks. */
  readonly timeBasis?: "server_elapsed";
  readonly speedRatio?: number;
  readonly serverEpochAt?: string;
  readonly timelineCycleYears?: number;
  readonly commandHash?: `sha256:${string}`;
}

export interface WorldClockAdvancedPayload {
  readonly clockId: string;
  readonly fromWorldMinute: number;
  readonly toWorldMinute: number;
  readonly fromWorldTime: string;
  readonly toWorldTime: string;
  readonly elapsedWorldMinutes: number;
  readonly reason: string;
  readonly processedDomains: readonly string[];
  readonly sourceEventIds: readonly string[];
  readonly ruleVersion: string;
  readonly commandHash: `sha256:${string}`;
  /** Present on v2 events so replay does not depend on process-local boot state. */
  readonly timeBasis?: "server_elapsed";
  readonly speedRatio?: number;
  readonly serverEpochAt?: string;
  readonly timelineCycleYears?: number;
  readonly crossedTimelineCycleIds?: readonly string[];
}

export interface WorldSimulationInitializedPayload {
  readonly simulationId: string;
  readonly worldMinute: number;
  readonly worldContentSourceHash: `sha256:${string}`;
  readonly ruleVersion: string;
  readonly snapshot: EpochWorldSimulationSnapshot;
}

export interface WorldSimulationAdvancedPayload {
  readonly simulationId: string;
  readonly fromWorldMinute: number;
  readonly toWorldMinute: number;
  readonly elapsedWorldMinutes: number;
  readonly sourceClockEventId: string;
  readonly sourceEventIds: readonly string[];
  readonly worldContentSourceHash: `sha256:${string}`;
  readonly ruleVersion: string;
  readonly commandHash: `sha256:${string}`;
  readonly previousStateHash: `sha256:${string}`;
  readonly signals?: EpochWorldSimulationSignals;
  readonly nextStateHash?: `sha256:${string}`;
  readonly nextVersion?: number;
  readonly checkpoint?: boolean;
  readonly snapshot?: EpochWorldSimulationSnapshot;
  readonly flows: EpochWorldSimulationFlowSummary;
}

export interface WorldSimulationContentMigratedPayload {
  readonly simulationId: string;
  readonly worldMinute: number;
  readonly fromWorldContentSourceHash: `sha256:${string}`;
  readonly toWorldContentSourceHash: `sha256:${string}`;
  readonly ruleVersion: string;
  readonly commandHash: `sha256:${string}`;
  readonly previousStateHash: `sha256:${string}`;
  readonly nextStateHash: `sha256:${string}`;
  readonly regionSuccessors: Readonly<Record<string, string>>;
  readonly factionSuccessors: Readonly<Record<string, string>>;
  readonly genesisCommodityDelta: EpochWorldCommodityLedger;
  readonly genesisReserveDelta: EpochWorldCommodityLedger;
  readonly genesisCoinDelta: number;
  readonly reroutedShipmentCount: number;
  readonly forcedArrivalCount: number;
  readonly snapshot: EpochWorldSimulationSnapshot;
}

export interface IdentityIssuedPayload {
  readonly agentId: string;
  readonly explorerId: string;
  readonly explorerSecretHash?: string;
  readonly identityName: string;
  readonly generation: number;
  readonly status: EpochIdentityStatus;
  readonly previousAgentId?: string;
  readonly inheritance?: EpochLineageInheritance;
  readonly personalityTraits?: readonly string[];
  readonly lifetime: {
    readonly max: number;
    readonly remaining: number;
    readonly startedAt: string;
  };
}

export interface ExplorerRecoveryRotatedPayload {
  readonly explorerId: string;
  readonly explorerSecretHash: string;
  readonly rotatedAt: string;
}

export interface LifetimeAdjustedPayload {
  readonly delta: number;
  readonly reason: string;
  readonly previousRemaining: number;
  readonly remaining: number;
}

export interface IdentityArchivedPayload {
  readonly archiveReason: string;
  readonly archivedAt: string;
  readonly finalTitle: string;
}

export interface AgentCustodyChangedPayload {
  readonly agentId: string;
  readonly custodyStatus: "free" | "imprisoned";
  readonly reason: string;
  readonly changedAt: string;
}

export interface ReincarnationIssuedPayload {
  readonly explorerId: string;
  readonly previousAgentId: string;
  readonly nextAgentId: string;
  readonly generation: number;
  readonly inheritance: EpochLineageInheritance;
}

export interface PersonalityDriftProposedPayload {
  readonly driftId: string;
  readonly agentId: string;
  readonly explorerId: string;
  readonly sourceEventId: string;
  readonly trigger: string;
  readonly suggestedTrait: string;
  readonly summary: string;
  readonly proposedAt: string;
}

export interface PersonalityDriftConfirmedPayload {
  readonly driftId: string;
  readonly agentId: string;
  readonly confirmedByExplorerId: string;
  readonly confirmedAt: string;
}

export interface ResourceGrantedPayload {
  readonly resourceId: EpochResourceId;
  readonly amount: number;
  readonly reason: string;
  readonly balanceAfter: number;
}

export interface AttributeGainedPayload {
  readonly attributeId: EpochAttributeId;
  readonly amount: number;
  readonly reason: string;
  readonly balanceAfter: number;
  readonly sourceEventIds: readonly string[];
}

export interface ResourceSpentPayload {
  readonly resourceId: EpochResourceId;
  readonly amount: number;
  readonly reason: string;
  readonly balanceAfter: number;
}

export interface DowntimeSetPayload {
  readonly mode: EpochDowntimeMode;
  readonly regionId: string;
  readonly startedAt: string;
}

export interface DowntimeDiaryEntryPayload {
  readonly title: string;
  readonly summary: string;
}

export interface DowntimeClaimedPayload {
  readonly mode: EpochDowntimeMode;
  readonly regionId: string;
  readonly startedAt: string;
  readonly claimedAt: string;
  readonly elapsedSeconds: number;
  readonly capped: boolean;
  readonly rewards: readonly EpochServerReward[];
  readonly diaryEntry: DowntimeDiaryEntryPayload;
}

export interface DowntimeTickResolvedPayload {
  readonly mode: EpochDowntimeMode;
  readonly regionId: string;
  readonly startedAt: string;
  readonly tickedAt: string;
  readonly elapsedSeconds: number;
  readonly capped: boolean;
  readonly rewards: readonly EpochServerReward[];
  readonly diaryEntry: DowntimeDiaryEntryPayload;
}

export type NpcCandidateStatus = "promoted" | "merged" | "rejected_flavor" | "moderation_hold";
export type NpcCandidateDecision = NpcCandidateStatus;
export type NpcCandidateReviewLevel = "clear" | "watch" | "blocked" | "moderation_hold";
export type NpcCandidateReviewFlag =
  | "authority_claim"
  | "reward_claim"
  | "chosen_one_claim"
  | "world_scale_claim"
  | "real_ip_similarity"
  | "real_world_mapping"
  | "internet_meme_trace"
  | "parody_trace";

export type NpcCandidateFlavorPublicationMode = "shared_lore" | "personal_sealed";

export interface NpcCandidateFlavorPublication {
  readonly mode: NpcCandidateFlavorPublicationMode;
  readonly sharedWorldEligible: boolean;
  readonly reason: string;
}

export type RumorAdmissionStatus = "shared_candidate" | "personal_sealed";

export interface RumorAdmissionReview {
  readonly status: RumorAdmissionStatus;
  readonly anchorCompleteness: number;
  readonly anchorThreshold: number;
  readonly coreVibeScore: number;
  readonly coreVibeThreshold: number;
  readonly reason: string;
}

export interface AbilityEffectCluster {
  readonly clusterKey: string;
  readonly effect: string;
  readonly cost: string;
  readonly medium: string;
  readonly location: string;
  readonly trigger: string;
  readonly summary: string;
}

export interface ExperimentMainRuleReview {
  readonly status: "passed";
  readonly rulesetVersion: string;
  readonly reviewedBy?: string;
  readonly reviewedAt?: string;
  readonly note?: string;
}

export interface NpcCandidateSubmittedPayload {
  readonly candidateId: string;
  readonly agentId: string;
  readonly explorerId: string;
  readonly regionId: string;
  readonly displayName: string;
  readonly npcKey: string;
  readonly traits: readonly string[];
  readonly storyEvidence: string;
  readonly decision: NpcCandidateDecision;
  readonly status: NpcCandidateStatus;
  readonly reviewLevel: NpcCandidateReviewLevel;
  readonly reviewScore: number;
  readonly reviewFlags: readonly NpcCandidateReviewFlag[];
  readonly ipSimilarity?: IpSimilarityAssessment;
  readonly flavorPublication: NpcCandidateFlavorPublication;
  readonly rumorAdmissionReview: RumorAdmissionReview;
  readonly abilityEffectCluster?: AbilityEffectCluster;
  readonly canonicalNpcId?: string;
  readonly rejectionReason?: string;
  readonly sourceEventId?: string;
  readonly experimentId?: string;
  readonly mainRuleReview?: ExperimentMainRuleReview;
}

export interface NpcCandidateReviewedPayload {
  readonly candidateId: string;
  readonly decision: NpcCandidateDecision;
  readonly status: NpcCandidateStatus;
  readonly canonicalNpcId?: string;
  readonly rejectionReason?: string;
  readonly reviewedBy: string;
  readonly reviewNote?: string;
}

export interface NpcCanonicalizedPayload {
  readonly npcId: string;
  readonly npcKey: string;
  readonly displayName: string;
  readonly regionId: string;
  readonly traits: readonly string[];
  readonly sourceEventId?: string;
}

export type NpcLifecycleValue = string | number | boolean | null;

export interface NpcLifecycleRecordedPayload {
  readonly npcId: string;
  readonly occurredAt: string;
  readonly changes: Readonly<Record<string, NpcLifecycleValue>>;
  readonly sourceEventIds: readonly string[];
}

export interface NpcRelationshipRecordedPayload {
  readonly relationshipId: string;
  readonly sourceNpcId: string;
  readonly targetNpcId: string;
  readonly sourceRegionId: string;
  readonly targetRegionId: string;
  readonly kind: EpochNpcRelationshipKind;
  readonly score: number;
  readonly reason: string;
  readonly sourceEventIds: readonly string[];
  readonly recordedAt: string;
}

export interface AgentNpcBondUpdatedPayload {
  readonly bondId: string;
  readonly agentId: string;
  readonly explorerId: string;
  readonly npcId: string;
  readonly npcRegionId: string;
  readonly kind: EpochNpcRelationshipKind;
  readonly focusSpent: number;
  readonly previousScore: number;
  readonly scoreDelta: number;
  readonly scoreAfter: number;
  readonly reason: string;
  readonly updatedAt: string;
}

export interface NpcMemoryRecordedPayload {
  readonly memoryId: string;
  readonly npcId: string;
  readonly regionId: string;
  readonly summary: string;
  readonly importance: EpochNpcMemoryImportance;
  readonly sourceEventIds: readonly string[];
  readonly recordedAt: string;
}

export interface NpcHouseholdRecordedPayload {
  readonly householdId: string;
  readonly regionId: string;
  readonly memberNpcIds: readonly string[];
  readonly reason: string;
  readonly sourceEventIds: readonly string[];
  readonly recordedAt: string;
}

export interface OrganizationCreatedPayload {
  readonly organizationId: string;
  readonly organizationName: string;
  readonly regionId: string;
  readonly reason: string;
  readonly sourceEventIds: readonly string[];
  readonly recordedAt: string;
}

export interface OrganizationMembershipChangedPayload {
  readonly membershipId: string;
  readonly organizationId: string;
  readonly organizationName: string;
  readonly memberType?: "npc" | "agent";
  readonly npcId?: string;
  readonly agentId?: string;
  readonly explorerId?: string;
  readonly regionId: string;
  readonly role: string;
  readonly status: string;
  readonly sourceEventIds: readonly string[];
  readonly recordedAt: string;
}

export interface OrganizationPoliticsRecordedPayload {
  readonly politicsId: string;
  readonly organizationId: string;
  readonly organizationName: string;
  readonly regionId: string;
  readonly npcId: string;
  readonly counterpartyNpcId?: string;
  readonly kind: EpochOrganizationPoliticsKind;
  readonly title: string;
  readonly summary: string;
  readonly standingDelta: number;
  readonly standingAfter: number;
  readonly sourceEventIds: readonly string[];
  readonly recordedAt: string;
}

export interface OrganizationPrestigeChangedPayload {
  readonly prestigeId: string;
  readonly organizationId: string;
  readonly organizationName: string;
  readonly regionId: string;
  readonly agentId?: string;
  readonly sourceSeasonId: string;
  readonly standingDelta: number;
  readonly standingAfter: number;
  readonly reason: string;
  readonly sourceEventIds: readonly string[];
  readonly recordedAt: string;
}

export interface OrganizationTreasuryChangedPayload {
  readonly treasuryEventId: string;
  readonly organizationId: string;
  readonly organizationName: string;
  readonly regionId: string;
  readonly resourceId: EpochResourceId;
  readonly amountDelta: number;
  readonly balanceAfter: number;
  readonly reason: string;
  readonly sourceSeasonId?: string;
  readonly sourceEventIds: readonly string[];
  readonly recordedAt: string;
}

export interface OrganizationBudgetProposedPayload {
  readonly budgetId: string;
  readonly organizationId: string;
  readonly organizationName: string;
  readonly regionId: string;
  readonly proposedByAgentId: string;
  readonly proposedByExplorerId: string;
  readonly title: string;
  readonly description?: string;
  readonly resourceId: EpochResourceId;
  readonly amount: number;
  readonly status: EpochOrganizationBudgetStatus;
  readonly approvalThreshold: number;
  readonly rejectionThreshold: number;
  readonly sourceEventIds: readonly string[];
  readonly proposedAt: string;
}

export interface OrganizationBudgetVoteRecordedPayload {
  readonly voteId: string;
  readonly budgetId: string;
  readonly organizationId: string;
  readonly organizationName: string;
  readonly regionId: string;
  readonly resourceId: EpochResourceId;
  readonly amount: number;
  readonly decision: EpochOrganizationBudgetResolution;
  readonly voterAgentId: string;
  readonly voterExplorerId: string;
  readonly voterRole: string;
  readonly approvalCount: number;
  readonly rejectionCount: number;
  readonly approvalThreshold: number;
  readonly rejectionThreshold: number;
  readonly note?: string;
  readonly sourceEventIds: readonly string[];
  readonly votedAt: string;
}

export interface OrganizationBudgetResolvedPayload {
  readonly budgetId: string;
  readonly organizationId: string;
  readonly organizationName: string;
  readonly regionId: string;
  readonly resourceId: EpochResourceId;
  readonly amount: number;
  readonly resolution: EpochOrganizationBudgetResolution;
  readonly resolvedByAgentId: string;
  readonly resolvedByExplorerId: string;
  readonly note?: string;
  readonly treasuryEventId?: string;
  readonly sourceEventIds: readonly string[];
  readonly resolvedAt: string;
}

export interface OrganizationUpgradePurchasedPayload {
  readonly upgradeId: string;
  readonly organizationId: string;
  readonly organizationName: string;
  readonly regionId: string;
  readonly upgradeKey: string;
  readonly title: string;
  readonly description: string;
  readonly purchasedByAgentId: string;
  readonly purchasedByExplorerId: string;
  readonly costResourceId: EpochResourceId;
  readonly costAmount: number;
  readonly sourceEventIds: readonly string[];
  readonly purchasedAt: string;
}

export interface NpcCareerChangedPayload {
  readonly careerId: string;
  readonly npcId: string;
  readonly regionId: string;
  readonly title: string;
  readonly status: string;
  readonly organizationId?: string;
  readonly sourceEventIds: readonly string[];
  readonly recordedAt: string;
}

export interface NpcLocationChangedPayload {
  readonly locationId: string;
  readonly npcId: string;
  readonly fromRegionId: string;
  readonly toRegionId: string;
  readonly reason: string;
  readonly sourceEventIds: readonly string[];
  readonly recordedAt: string;
}

export interface NpcAssetChangedPayload {
  readonly assetId: string;
  readonly npcId: string;
  readonly regionId: string;
  readonly assetKey: string;
  readonly delta: number;
  readonly balanceAfter: number;
  readonly reason: string;
  readonly sourceEventIds: readonly string[];
  readonly recordedAt: string;
}

export interface NpcHealthRecordedPayload {
  readonly healthId: string;
  readonly npcId: string;
  readonly regionId: string;
  readonly status: string;
  readonly severity: string;
  readonly reason: string;
  readonly sourceEventIds: readonly string[];
  readonly recordedAt: string;
}

export interface ItemCreatedPayload {
  readonly itemId: string;
  readonly agentId: string;
  readonly explorerId: string;
  readonly itemKey: string;
  readonly displayName: string;
  readonly rarity: string;
  readonly bound: boolean;
  readonly sourceEventIds: readonly string[];
  readonly createdAt: string;
}

export interface ItemBoundPayload {
  readonly itemId: string;
  readonly agentId: string;
  readonly explorerId: string;
  readonly reason: string;
  readonly boundAt: string;
}

export interface ItemTransferredPayload {
  readonly itemId: string;
  readonly fromAgentId: string;
  readonly fromExplorerId: string;
  readonly toAgentId: string;
  readonly toExplorerId: string;
  readonly sourceOrderId: string;
  readonly transferredAt: string;
}

export type SocialHookKind = "letter" | "gossip" | "scandal" | "obligation";

export interface SocialHookCreatedPayload {
  readonly hookId: string;
  readonly regionId: string;
  readonly npcId?: string;
  readonly kind: SocialHookKind;
  readonly title: string;
  readonly body: string;
  readonly actionLabel: string;
  readonly risk: HostedActionRisk;
  readonly sourceEventIds: readonly string[];
  readonly createdAt: string;
}

export interface RegionNewsGeneratedPayload {
  readonly newsId: string;
  readonly regionId: string;
  readonly headline: string;
  readonly body: string;
  readonly legendDelta: number;
  readonly sourceEventIds: readonly string[];
  readonly moderationStatus?: EpochContentModerationStatus;
}

export interface MessagePostedPayload {
  readonly messageId: string;
  readonly scope: EpochMessageScope;
  readonly agentId: string;
  readonly explorerId: string;
  readonly regionId?: string;
  readonly body: string;
  readonly postedAt: string;
  readonly moderationStatus?: EpochContentModerationStatus;
}

export type EpochModerationSeverity = "low" | "medium" | "high";

export interface ModerationQueuedPayload {
  readonly moderationId: string;
  readonly subjectType: EpochModerationSubjectType;
  readonly subjectId: string;
  readonly sourceEventId: string;
  readonly agentId?: string;
  readonly explorerId?: string;
  readonly regionId?: string;
  readonly reason: string;
  readonly severity: EpochModerationSeverity;
  readonly bodyPreview: string;
  readonly queuedAt: string;
}

export interface ModerationResolvedPayload {
  readonly moderationId: string;
  readonly resolution: EpochModerationResolution;
  readonly resolvedBy: string;
  readonly resolvedAt: string;
  readonly note?: string;
}

export interface RiskReviewRecordedPayload {
  readonly reviewId: string;
  readonly sourceEventId: string;
  readonly sourceEventType: EpochEventType;
  readonly agentId?: string;
  readonly explorerId?: string;
  readonly resolution: EpochRiskReviewResolution;
  readonly reviewFlags: readonly string[];
  readonly reviewScore: number;
  readonly operatorId: string;
  readonly reviewedAt: string;
  readonly note?: string;
}

export interface MarketRiskRestrictionReleasedPayload {
  readonly releaseId: string;
  readonly agentId: string;
  readonly explorerId?: string;
  readonly sourceEventId: string;
  readonly sourceReviewId: string;
  readonly releasedBy: string;
  readonly releasedAt: string;
  readonly note?: string;
}

export interface CommandRejectedPayload {
  readonly rejectionId: string;
  readonly surface: "http" | "mcp";
  readonly command: string;
  readonly errorCode: string;
  readonly statusCode?: number;
  readonly actorKey: string;
  readonly agentId?: string;
  readonly explorerId?: string;
  readonly rejectedAt: string;
  readonly inputSummary: Readonly<Record<string, unknown>>;
}

export interface AbuseScoreChangedPayload {
  readonly scoreChangeId: string;
  readonly actorKey: string;
  readonly agentId?: string;
  readonly explorerId?: string;
  readonly sourceEventId: string;
  readonly sourceErrorCode: string;
  readonly delta: number;
  readonly scoreAfter: number;
  readonly reason: string;
  readonly changedAt: string;
}

export interface AbuseScoreReleasedPayload {
  readonly releaseId: string;
  readonly actorKey: string;
  readonly agentId?: string;
  readonly explorerId?: string;
  readonly previousScore: number;
  readonly scoreAfter: number;
  readonly sourceEventId?: string;
  readonly releasedBy: string;
  readonly releasedAt: string;
  readonly note?: string;
}

export interface AbuseScoreDecayedPayload {
  readonly decayId: string;
  readonly actorKey: string;
  readonly agentId?: string;
  readonly explorerId?: string;
  readonly previousScore: number;
  readonly scoreAfter: number;
  readonly decayAmount: number;
  readonly sourceEventId?: string;
  readonly decayedBy: string;
  readonly decayedAt: string;
  readonly reason: "maintenance_decay";
}

export interface LegendAwardedPayload {
  readonly awardId: string;
  readonly newsId: string;
  readonly regionId: string;
  readonly agentId: string;
  readonly explorerId: string;
  readonly amount: number;
  readonly reason: string;
  readonly awardedAt: string;
}

export interface ContestedObjectiveCreatedPayload {
  readonly objectiveId: string;
  readonly regionId: string;
  readonly title: string;
  readonly description: string;
  readonly resourceId: EpochResourceId;
  readonly targetScore: number;
  readonly mode: EpochObjectiveMode;
  readonly reward: EpochServerReward;
  readonly consolationReward?: EpochServerReward;
  readonly createdAt: string;
}

export interface ContestedObjectiveContributedPayload {
  readonly objectiveId: string;
  readonly agentId: string;
  readonly explorerId: string;
  readonly resourceId: EpochResourceId;
  readonly amount: number;
  readonly scoreDelta: number;
  readonly agentScoreAfter: number;
  readonly totalScoreAfter: number;
}

export interface RaceCommissionCompletedPayload {
  readonly completionId: string;
  readonly objectiveId: string;
  readonly regionId: string;
  readonly agentId: string;
  readonly explorerId: string;
  readonly place: number;
  readonly score: number;
  readonly reward: EpochServerReward;
  readonly completedAt: string;
}

export interface ContestedObjectiveSettledPayload {
  readonly objectiveId: string;
  readonly settledAt: string;
  readonly winnerAgentId?: string;
  readonly winnerExplorerId?: string;
  readonly winningScore: number;
  readonly reward?: EpochServerReward;
}

export interface ResourceNodeSpawnedPayload {
  readonly nodeId: string;
  readonly regionId: string;
  readonly title: string;
  readonly description: string;
  readonly resourceId: EpochResourceId;
  readonly reward: EpochServerReward;
  readonly spawnedAt: string;
}

export interface ResourceNodeContestedPayload {
  readonly nodeId: string;
  readonly agentId: string;
  readonly explorerId: string;
  readonly staminaSpent: number;
  readonly baseScoreDelta?: number;
  readonly equipmentScoreBonus?: number;
  readonly equipmentItemIds?: readonly string[];
  readonly scoreDelta: number;
  readonly agentScoreAfter: number;
  readonly totalScoreAfter: number;
  readonly contestedAt: string;
}

export interface ResourceNodeSettledPayload {
  readonly nodeId: string;
  readonly settledAt: string;
  readonly winnerAgentId?: string;
  readonly winnerExplorerId?: string;
  readonly winningScore: number;
  readonly reward?: EpochServerReward;
}

export interface AnomalyEventSpawnedPayload {
  readonly anomalyId: string;
  readonly regionId: string;
  readonly sourceSeasonId?: string;
  readonly title: string;
  readonly description: string;
  readonly media?: EpochAnomalyMedia;
  readonly severity: EpochAnomalySeverity;
  readonly targetScore: number;
  readonly reward: EpochServerReward;
  readonly lifetimeRisk: number;
  readonly spawnedAt: string;
}

export interface AnomalyEventContestedPayload {
  readonly anomalyId: string;
  readonly agentId: string;
  readonly explorerId: string;
  readonly focusSpent: number;
  readonly scoreDelta: number;
  readonly agentScoreAfter: number;
  readonly totalScoreAfter: number;
  readonly contestedAt: string;
}

export interface AnomalyEventResolvedPayload {
  readonly anomalyId: string;
  readonly resolvedAt: string;
  readonly outcome: EpochAnomalyOutcome;
  readonly winnerAgentId?: string;
  readonly winnerExplorerId?: string;
  readonly winningScore: number;
  readonly reward?: EpochServerReward;
  readonly lifetimeRisk: number;
}

export interface SeasonCampaignCreatedPayload {
  readonly seasonId: string;
  readonly seasonKey: string;
  readonly title: string;
  readonly description: string;
  readonly regionIds: readonly string[];
  readonly factionIds: readonly string[];
  readonly resourceId: EpochResourceId;
  readonly targetScore: number;
  readonly reward: EpochServerReward;
  readonly createdAt: string;
}

export interface SeasonStartedPayload {
  readonly seasonId: string;
  readonly seasonKey: string;
  readonly title: string;
  readonly regionIds: readonly string[];
  readonly factionIds: readonly string[];
  readonly targetScore: number;
  readonly phase: "active";
  readonly sourceEventId: string;
  readonly startedAt: string;
}

export interface SeasonObjectiveCreatedPayload {
  readonly objectiveId: string;
  readonly seasonId: string;
  readonly objectiveKey: string;
  readonly title: string;
  readonly description: string;
  readonly targetScore: number;
  readonly createdAt: string;
}

export interface SeasonContributionRecordedPayload {
  readonly seasonId: string;
  readonly agentId: string;
  readonly explorerId: string;
  readonly factionId: string;
  readonly resourceId: EpochResourceId;
  readonly amount: number;
  readonly baseScoreDelta: number;
  readonly organizationBonusScore: number;
  readonly regionControlBonusScore: number;
  readonly scoreDelta: number;
  readonly sourceOrganizationUpgradeIds: readonly string[];
  readonly sourceRegionControlRegionIds: readonly string[];
  readonly agentScoreAfter: number;
  readonly factionScoreAfter: number;
  readonly totalScoreAfter: number;
  readonly recordedAt: string;
}

export interface SeasonObjectiveCompletedPayload {
  readonly objectiveId: string;
  readonly seasonId: string;
  readonly completedByAgentId: string;
  readonly completedByExplorerId: string;
  readonly completedByFactionId: string;
  readonly progressScore: number;
  readonly targetScore: number;
  readonly sourceEventId: string;
  readonly completedAt: string;
}

export interface SeasonCampaignResolvedPayload {
  readonly seasonId: string;
  readonly resolvedAt: string;
  readonly winningFactionId?: string;
  readonly winnerAgentId?: string;
  readonly winnerExplorerId?: string;
  readonly winningScore: number;
  readonly reward?: EpochServerReward;
}

export interface SeasonResolvedPayload {
  readonly seasonId: string;
  readonly phase: "resolved";
  readonly sourceEventId: string;
  readonly relatedEventIds: readonly string[];
  readonly winningFactionId?: string;
  readonly winnerAgentId?: string;
  readonly winnerExplorerId?: string;
  readonly winningScore: number;
  readonly resolvedAt: string;
}

export interface RegionControlChangedPayload {
  readonly regionId: string;
  readonly controllingFactionId: string;
  readonly previousControllingFactionId?: string;
  readonly controlScore: number;
  readonly contestedByFactionId?: string;
  readonly controlMargin: number;
  readonly sourceSeasonId: string;
  readonly sourceReleaseId?: string;
  readonly previousControlSourceSeasonId?: string;
  readonly claimingAgentId?: string;
  readonly claimingExplorerId?: string;
  readonly reason?: "season_settlement" | "released_region_claim" | "released_region_revolt";
  readonly changedAt: string;
}

export interface RegionControlDecayedPayload {
  readonly decayId: string;
  readonly regionId: string;
  readonly controllingFactionId: string;
  readonly previousScore: number;
  readonly scoreAfter: number;
  readonly decayAmount: number;
  readonly previousControlMargin: number;
  readonly controlMarginAfter: number;
  readonly sourceSeasonId: string;
  readonly decayedBy: string;
  readonly decayedAt: string;
  readonly reason: "maintenance_decay";
}

export interface RegionControlReleasedPayload {
  readonly releaseId: string;
  readonly regionId: string;
  readonly previousControllingFactionId: string;
  readonly previousScore: number;
  readonly sourceSeasonId: string;
  readonly releasedBy: string;
  readonly releasedAt: string;
  readonly reason: "maintenance_decay_zero";
}

export type RegionRevoltOutcome = "revolt_succeeded" | "revolt_defended";

export interface RegionRevoltResolvedPayload {
  readonly revoltId: string;
  readonly regionId: string;
  readonly sourceReleaseId: string;
  readonly previousControllingFactionId: string;
  readonly previousControlSourceSeasonId: string;
  readonly rebelAgentId: string;
  readonly rebelExplorerId: string;
  readonly rebelFactionId: string;
  readonly sourceSeasonId: string;
  readonly factionScore: number;
  readonly staminaSpent: number;
  readonly rebelPower: number;
  readonly defenderPower: number;
  readonly outcome: RegionRevoltOutcome;
  readonly resolvedAt: string;
}

export type RegionInfluenceSourceEventType =
  | "contested_objective_settled"
  | "resource_node_settled"
  | "anomaly_event_resolved"
  | "party_run_settled"
  | "bounty_claimed"
  | "hosted_action_recorded"
  | "raid_resolved"
  | "retaliation_resolved"
  | "region_revolt_resolved";

export interface RegionInfluenceChangedPayload {
  readonly influenceId: string;
  readonly regionId: string;
  readonly agentId: string;
  readonly explorerId: string;
  readonly influenceDelta: number;
  readonly influenceScoreAfter: number;
  readonly reason: string;
  readonly sourceEventId: string;
  readonly sourceEventType: RegionInfluenceSourceEventType;
  readonly sourceAggregateId: string;
  readonly changedAt: string;
  /** Canonical game time when available; legacy events may omit it. */
  readonly worldMinute?: number;
}

export interface AgentFactionStandingChangedPayload {
  readonly standingId: string;
  readonly agentId: string;
  readonly explorerId: string;
  readonly factionId: string;
  readonly standingDelta: number;
  readonly standingAfter: number;
  readonly journeyId: string;
  readonly episodeId: string;
  readonly objectiveId: string;
  readonly routeId: string;
  readonly sourceEventId: string;
  readonly changedAt: string;
  readonly worldMinute: number;
}

export interface JourneyWorldSolidifiedPayload {
  readonly journeyId: string;
  readonly agentId: string;
  readonly explorerId: string;
  readonly regionId: string;
  readonly completedObjectiveIds: readonly string[];
  readonly requiredMainObjectiveIds: readonly string[];
  readonly mirrorStartedAtWorldTime: string;
  readonly mirrorEndedAtWorldTime: string;
  /** Canonical shared-world time when this historical mirror was accepted. */
  readonly committedAtWorldTime?: string;
  readonly completionTier?: "及格" | "良好" | "优秀" | "惊世";
  readonly completionScoreBps?: number;
  readonly worldSliceHash?: `sha256:${string}`;
  readonly influenceDelta: number;
  readonly factionStandings: readonly {
    readonly factionId: string;
    readonly routeId: string;
    readonly standingDelta: number;
    readonly standingAfter: number;
  }[];
  readonly npcRelationships: readonly {
    readonly npcId: string;
    readonly displayName: string;
    readonly bondId: string;
    readonly scoreDelta: number;
    readonly scoreAfter: number;
    readonly memoryId: string;
  }[];
  readonly sourceEventIds: readonly string[];
  readonly effectEventIds: readonly string[];
  readonly solidifiedAt: string;
}

export type TraceSourceEventType = RegionInfluenceSourceEventType | "bounty_claimed" | "diplomacy_responded";

export interface TraceCreatedPayload {
  readonly traceId: string;
  readonly regionId: string;
  readonly title: string;
  readonly summary: string;
  readonly sourceEventType: TraceSourceEventType;
  readonly sourceEventIds: readonly string[];
  readonly sourceAggregateId: string;
  readonly relatedInfluenceIds: readonly string[];
  readonly participantAgentIds: readonly string[];
  readonly participantExplorerIds: readonly string[];
  readonly scoutAgentIds?: readonly string[];
  readonly parentTraceId?: string;
  readonly createdAt: string;
}

export interface TraceConflictDeployedPayload {
  readonly deployment: TraceConflictDeployment;
}

export interface TraceConflictOutcomePayload {
  readonly traceId: string;
  readonly outcome: TraceConflictOutcome;
  readonly triggeredByTurnCardId?: string;
  readonly counteredByTraceId?: string;
  readonly sourceEventIds: readonly string[];
  readonly auditIds: readonly string[];
  readonly resolvedAt: string;
}

export interface TraceConflictEffectAppliedPayload {
  readonly traceId: string;
  readonly turnCardId: string;
  readonly targetAgentId: string;
  readonly effect: TraceConflictServerEffect;
  readonly sourceEventIds: readonly string[];
  readonly auditIds: readonly string[];
  readonly appliedAt: string;
}

export interface TraceConflictMemoryRecordedPayload {
  readonly memory: TraceConflictRumorMemory;
}

export interface RegionMonumentBuiltPayload {
  readonly monumentId: string;
  readonly regionId: string;
  readonly title: string;
  readonly description: string;
  readonly controllingFactionId: string;
  readonly winnerAgentId: string;
  readonly winnerExplorerId: string;
  readonly sourceSeasonId: string;
  readonly controlScore: number;
  readonly builtAt: string;
}

export interface MarketOrderCreatedPayload {
  readonly orderId: string;
  readonly regionId: string;
  readonly sellerAgentId: string;
  readonly sellerExplorerId: string;
  readonly sellKind?: "resource" | "item";
  readonly sellResourceId?: EpochResourceId;
  readonly sellAmount: number;
  readonly sellItemId?: string;
  readonly sellItemKey?: string;
  readonly sellItemDisplayName?: string;
  readonly sellItemRarity?: string;
  readonly priceResourceId: EpochResourceId;
  readonly priceAmount: number;
  readonly createdAt: string;
}

export interface MarketOrderFilledPayload {
  readonly orderId: string;
  readonly regionId: string;
  readonly buyerAgentId: string;
  readonly buyerExplorerId: string;
  readonly marketFeeResourceId?: EpochResourceId;
  readonly marketFeeAmount?: number;
  readonly sellerProceedsAmount?: number;
  readonly transferredItemId?: string;
  readonly tradeRiskFlags?: readonly EpochMarketTradeRiskFlag[];
  readonly tradeRiskScore?: number;
  readonly filledAt: string;
}

export interface MarketOrderCancelledPayload {
  readonly orderId: string;
  readonly regionId: string;
  readonly sellerAgentId: string;
  readonly cancelledAt: string;
}

export interface MarketOrderExpiredPayload {
  readonly orderId: string;
  readonly regionId: string;
  readonly sellerAgentId: string;
  readonly expiredAt: string;
  readonly maxAgeSeconds: number;
}

export interface DirectTradeAssetPayload {
  readonly kind: "resource" | "item";
  readonly resourceId?: EpochResourceId;
  readonly amount?: number;
  readonly itemId?: string;
  readonly itemKey?: string;
  readonly itemDisplayName?: string;
  readonly itemRarity?: string;
}

export interface DirectTradeCreatedPayload {
  readonly tradeId: string;
  readonly regionId: string;
  readonly proposerAgentId: string;
  readonly proposerExplorerId: string;
  readonly counterpartyAgentId: string;
  readonly counterpartyExplorerId: string;
  readonly offeredAsset: DirectTradeAssetPayload;
  readonly requestedAsset: DirectTradeAssetPayload;
  readonly createdAt: string;
}

export interface DirectTradeAcceptedPayload {
  readonly tradeId: string;
  readonly regionId: string;
  readonly proposerAgentId: string;
  readonly proposerExplorerId: string;
  readonly counterpartyAgentId: string;
  readonly counterpartyExplorerId: string;
  readonly transferredOfferedItemId?: string;
  readonly transferredRequestedItemId?: string;
  readonly tradeRiskFlags?: readonly EpochMarketTradeRiskFlag[];
  readonly tradeRiskScore?: number;
  readonly acceptedAt: string;
}

export interface DirectTradeCancelledPayload {
  readonly tradeId: string;
  readonly regionId: string;
  readonly proposerAgentId: string;
  readonly cancelledAt: string;
}

export interface DirectTradeExpiredPayload {
  readonly tradeId: string;
  readonly regionId: string;
  readonly proposerAgentId: string;
  readonly expiredAt: string;
  readonly maxAgeSeconds: number;
}

export interface BountyCreatedPayload {
  readonly bountyId: string;
  readonly regionId: string;
  readonly sponsorAgentId: string;
  readonly sponsorExplorerId: string;
  readonly title: string;
  readonly description: string;
  readonly rewardResourceId: EpochResourceId;
  readonly rewardAmount: number;
  readonly requiredItemKey?: string;
  readonly createdAt: string;
}

export interface BountyClaimedPayload {
  readonly bountyId: string;
  readonly claimantAgentId: string;
  readonly claimantExplorerId: string;
  readonly transferredItemId?: string;
  readonly evidence: string;
  readonly claimedAt: string;
}

export interface PartyMemberPayload {
  readonly agentId: string;
  readonly explorerId: string;
  readonly participantRole: EpochPartyRole;
  readonly joinedAt: string;
}

export interface PartyRunCreatedPayload {
  readonly partyRunId: string;
  readonly regionId: string;
  readonly leaderAgentId: string;
  readonly leaderExplorerId: string;
  readonly title: string;
  readonly objective: string;
  readonly joinPolicy?: EpochPartyRunJoinPolicy;
  readonly inviteTokenHash?: string;
  readonly inviteTokenExpiresAt?: string;
  readonly inviteTokenUseLimit?: number;
  readonly inviteTokenUses?: number;
  readonly inviteRecipientAgentId?: string;
  readonly participantRole: EpochPartyRole;
  readonly createdAt: string;
}

export interface PartyInviteUpdatedPayload {
  readonly partyRunId: string;
  readonly regionId: string;
  readonly leaderAgentId: string;
  readonly leaderExplorerId: string;
  readonly updateKind: "rotated" | "revoked";
  readonly inviteTokenHash?: string;
  readonly inviteTokenExpiresAt?: string;
  readonly inviteTokenUseLimit?: number;
  readonly inviteTokenUses?: number;
  readonly inviteRecipientAgentId?: string;
  readonly inviteTokenRevokedAt?: string;
  readonly updatedAt: string;
}

export type PartyJoinRequestResolution = "approved" | "rejected";

export interface PartyJoinRequestedPayload {
  readonly requestId: string;
  readonly partyRunId: string;
  readonly regionId: string;
  readonly agentId: string;
  readonly explorerId: string;
  readonly participantRole: EpochPartyRole;
  readonly requestNote?: string;
  readonly requestedAt: string;
}

export interface PartyJoinRequestResolvedPayload {
  readonly requestId: string;
  readonly partyRunId: string;
  readonly regionId: string;
  readonly agentId: string;
  readonly explorerId: string;
  readonly participantRole: EpochPartyRole;
  readonly resolution: PartyJoinRequestResolution;
  readonly resolvedByAgentId: string;
  readonly resolvedByExplorerId: string;
  readonly resolutionNote?: string;
  readonly resolvedAt: string;
}

export interface PartyMemberJoinedPayload extends PartyMemberPayload {
  readonly partyRunId: string;
  readonly regionId: string;
  readonly inviteTokenUsed?: boolean;
}

export interface PartyMemberSettlementPayload {
  readonly agentId: string;
  readonly explorerId: string;
  readonly participantRole: EpochPartyRole;
  readonly score: number;
  readonly reward: EpochServerReward;
}

export interface PartyRunSettledPayload {
  readonly partyRunId: string;
  readonly regionId: string;
  readonly totalScore: number;
  readonly memberResults: readonly PartyMemberSettlementPayload[];
  readonly traceId: string;
  readonly newsId: string;
  readonly settledAt: string;
}

export type RaidOutcome = "attacker_won" | "defender_won";

export interface RaidResolvedPayload {
  readonly raidId: string;
  readonly regionId: string;
  readonly attackerAgentId: string;
  readonly attackerExplorerId: string;
  readonly defenderAgentId: string;
  readonly defenderExplorerId: string;
  readonly staminaSpent: number;
  readonly attackerPower: number;
  readonly defenderPower: number;
  readonly outcome: RaidOutcome;
  readonly reward: EpochServerReward;
  readonly resolvedAt: string;
}

export interface RetaliationOpportunityCreatedPayload {
  readonly retaliationId: string;
  readonly regionId: string;
  readonly sourceRaidId: string;
  readonly sourceTraceId: string;
  readonly opportunityAgentId: string;
  readonly opportunityExplorerId: string;
  readonly targetAgentId: string;
  readonly targetExplorerId: string;
  readonly status: "open";
  readonly reason: string;
  readonly sourceEventIds: readonly string[];
  readonly createdAt: string;
}

export type RetaliationOutcome = "retaliator_won" | "target_held";

export interface RetaliationResolvedPayload {
  readonly retaliationId: string;
  readonly regionId: string;
  readonly sourceRaidId: string;
  readonly sourceTraceId: string;
  readonly opportunityAgentId: string;
  readonly opportunityExplorerId: string;
  readonly targetAgentId: string;
  readonly targetExplorerId: string;
  readonly staminaSpent: number;
  readonly retaliatorPower: number;
  readonly targetPower: number;
  readonly outcome: RetaliationOutcome;
  readonly winnerAgentId: string;
  readonly winnerExplorerId: string;
  readonly reward: EpochServerReward;
  readonly resolvedAt: string;
}

export interface DiplomacyProposedPayload {
  readonly diplomacyId: string;
  readonly regionId: string;
  readonly sourceAgentId: string;
  readonly sourceExplorerId: string;
  readonly targetAgentId: string;
  readonly targetExplorerId: string;
  readonly kind: EpochRelationshipKind;
  readonly focusSpent: number;
  readonly terms: string;
  readonly status: "pending";
  readonly proposedAt: string;
}

export interface DiplomacyRespondedPayload {
  readonly diplomacyId: string;
  readonly regionId: string;
  readonly sourceAgentId: string;
  readonly sourceExplorerId: string;
  readonly targetAgentId: string;
  readonly targetExplorerId: string;
  readonly kind: EpochRelationshipKind;
  readonly response: EpochDiplomacyResponse;
  readonly status: "accepted" | "rejected";
  readonly focusSpent: number;
  readonly note: string;
  readonly relationshipId?: string;
  readonly respondedAt: string;
}

export interface RelationshipUpdatedPayload {
  readonly relationshipId: string;
  readonly sourceAgentId: string;
  readonly sourceExplorerId: string;
  readonly targetAgentId: string;
  readonly targetExplorerId: string;
  readonly kind: EpochRelationshipKind;
  readonly focusSpent: number;
  readonly previousScore: number;
  readonly scoreDelta: number;
  readonly scoreAfter: number;
  readonly reason: string;
  readonly updatedAt: string;
}

export type HostedActionRisk = "low" | "medium" | "high";

export interface EpochActionExplanation {
  readonly brief: string;
  readonly trigger: string;
  readonly choiceReason: string;
  readonly rejectedAlternatives: readonly string[];
  readonly risk: string;
  readonly expectedBenefit: string;
}

export interface HostedActionOptionPayload {
  readonly actionOptionId: string;
  readonly optionKey: string;
  readonly label: string;
  readonly risk: HostedActionRisk;
  readonly socialHookId?: string;
  readonly explanation: EpochActionExplanation;
  readonly outcomeSummary: string;
  readonly reward?: EpochServerReward;
  readonly lifetimeDelta?: number;
}

export interface TurnActionOptionPayload {
  readonly actionOptionId: string;
  readonly optionKey: string;
  readonly label: string;
  readonly risk: HostedActionRisk;
  readonly socialHookId?: string;
  readonly explanation: EpochActionExplanation;
}

export interface TurnCardSignedEnvelopePayload {
  readonly envelopeId: string;
  readonly protocolVersion: "obsidian-epoch.turn-card-envelope.v1";
  readonly signatureAlgorithm: "Ed25519";
  readonly serverPublicKey: string;
  readonly contentHash: `sha256:${string}`;
  readonly signature: string;
  readonly trustClass: EpochTrustClass;
  readonly runTicketId: string | null;
}

export interface TurnResolutionSignedEnvelopePayload {
  readonly envelopeId: string;
  readonly protocolVersion: "obsidian-epoch.turn-resolution-envelope.v1";
  readonly signatureAlgorithm: "Ed25519";
  readonly serverPublicKey: string;
  readonly contentHash: `sha256:${string}`;
  readonly signature: string;
  readonly trustClass: EpochTrustClass;
  readonly runTicketId: string | null;
}

export interface HostedActionSignedEnvelopePayload {
  readonly envelopeId: string;
  readonly protocolVersion: "obsidian-epoch.hosted-action-envelope.v1";
  readonly signatureAlgorithm: "Ed25519";
  readonly serverPublicKey: string;
  readonly contentHash: `sha256:${string}`;
  readonly signature: string;
  readonly trustClass: EpochTrustClass;
  readonly runTicketId: string | null;
}

export interface TurnCardCreatedPayload {
  readonly turnCardId: string;
  readonly agentId: string;
  readonly explorerId: string;
  readonly regionId: string;
  readonly sequence: number;
  readonly nonce: string;
  readonly prompt: string;
  readonly visibleContext: {
    readonly regionId: string;
    readonly prompt: string;
    readonly identityName: string;
  };
  readonly actionOptions: readonly TurnActionOptionPayload[];
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly signedEnvelope: TurnCardSignedEnvelopePayload;
}

export interface TurnResolvedPayload {
  readonly turnCardId: string;
  readonly agentId: string;
  readonly channelClass: EpochTrustClass;
  readonly envelopeId: string;
  readonly sequence: number;
  readonly nonce: string;
  readonly actionOptionId: string;
  readonly optionLabel: string;
  readonly risk?: HostedActionRisk;
  readonly explanation: EpochActionExplanation;
  readonly visibleText?: string;
  readonly outcomeSummary: string;
  readonly reward?: EpochServerReward;
  readonly lifetimeDelta?: number;
  readonly nonEvidence?: boolean;
  readonly resolvedAt: string;
  readonly signedEnvelope: TurnResolutionSignedEnvelopePayload;
}

export interface HostedSessionStartedPayload {
  readonly sessionId: string;
  readonly agentId: string;
  readonly explorerId: string;
  readonly regionId: string;
  readonly mandate: string;
  readonly channelClass: EpochChannelClass;
  readonly deliveryTrust: EpochTrustClass;
  readonly actionOptions: readonly HostedActionOptionPayload[];
  readonly sceneContract?: JourneySceneContract;
  readonly startedAt: string;
}

export interface HostedActionRecordedPayload {
  readonly actionId: string;
  readonly sessionId: string;
  readonly agentId: string;
  readonly channelClass: EpochChannelClass;
  readonly deliveryTrust: EpochTrustClass;
  readonly actionOptionId: string;
  readonly optionLabel: string;
  readonly risk?: HostedActionRisk;
  readonly socialHookId?: string;
  readonly attestationId?: string;
  readonly explanation: EpochActionExplanation;
  readonly visibleText?: string;
  readonly outcomeSummary: string;
  /** Server-authored generated-task result. Absent on legacy/non-journey hosted actions. */
  readonly journeyResolution?: JourneyActionResolution;
  readonly reward?: EpochServerReward;
  readonly lifetimeDelta?: number;
  readonly nonEvidence?: boolean;
  readonly recordedAt: string;
  readonly signedEnvelope: HostedActionSignedEnvelopePayload;
}

export interface ServerHostedJobQueuedPayload {
  readonly jobId: string;
  readonly agentId: string;
  readonly explorerId: string;
  readonly regionId: string;
  readonly mandate: string;
  readonly optionKey: "observe" | "assist" | "anomaly";
  readonly visibleText?: string;
  readonly deliveryTrust: "server_hosted_agent";
  readonly queuedBy: string;
  readonly queuedAt: string;
}

export interface ServerHostedJobCompletedPayload {
  readonly jobId: string;
  readonly agentId: string;
  readonly sessionId: string;
  readonly actionId: string;
  readonly completedAt: string;
}

export interface ServerHostedJobSkippedPayload {
  readonly jobId: string;
  readonly agentId: string;
  readonly reason: "action_option_unavailable";
  readonly skippedAt: string;
}

export interface AttestationRecordedPayload {
  readonly attestationId: string;
  readonly runnerId: string;
  readonly runnerKeyId?: string;
  readonly challengeId: string;
  readonly sessionId: string;
  readonly agentId: string;
  readonly actionOptionId: string;
  readonly transcriptHash: string;
  readonly signature: string;
  readonly signatureBase: string;
  readonly signatureBaseHash: string;
  readonly verifiedAt: string;
}

export type HighValueConfirmationAction = "world_message" | "turn_card" | "resolve_turn";

export interface HighValueConfirmationRequestedPayload {
  readonly confirmationId: string;
  readonly action: HighValueConfirmationAction;
  readonly agentId: string;
  readonly explorerId: string;
  readonly subjectHash: string;
  readonly summary: string;
  readonly createdAt: string;
  readonly expiresAt: string;
}

export interface HighValueConfirmationConfirmedPayload {
  readonly confirmationId: string;
  readonly confirmedAt: string;
  readonly tokenHash: string;
}

export interface HighValueConfirmationConsumedPayload {
  readonly confirmationId: string;
  readonly consumedAt: string;
  readonly consumedByIdempotencyKey: string;
  readonly consumedByAction: HighValueConfirmationAction;
}

export type CreatureBehaviorScope = "local" | "regional" | "cross_region" | "world";
export type CreatureBehaviorScopeReviewStatus = "within_limit" | "explained_exception";
export type CreatureBehaviorScopeExplanation = "external_pollution" | "group_event" | "higher_entity";

export interface CreatureBehaviorScopeReview {
  readonly subjectType: "creature_behavior";
  readonly threat: string;
  readonly rankRole: string;
  readonly claimedScope: CreatureBehaviorScope;
  readonly allowedScope: CreatureBehaviorScope;
  readonly status: CreatureBehaviorScopeReviewStatus;
  readonly explanation?: CreatureBehaviorScopeExplanation;
  readonly reason: string;
}

export type FuzzyTimeCongestionLevel = "low" | "medium" | "high";

export interface FuzzyTimeIntervalReview {
  readonly subjectType: "fuzzy_time";
  readonly expression: string;
  readonly intervalStartYear: number;
  readonly intervalEndYear: number;
  readonly occupancyWeight: number;
  readonly overlapCount: number;
  readonly congestionLevel: FuzzyTimeCongestionLevel;
  readonly reason: string;
}

export type CrossRegionMechanismTier = "basic" | "high";
export type CrossRegionMechanismKind = "dream_rift" | "rift" | "old_god_whisper" | "route" | "unknown";
export type CrossRegionMechanismSupport = "chapter_permission" | "route_support" | "explicit_explanation";

export interface CrossRegionMechanismReview {
  readonly subjectType: "cross_region_mechanism";
  readonly tier: CrossRegionMechanismTier;
  readonly mechanism: CrossRegionMechanismKind;
  readonly fromRegionId?: string;
  readonly toRegionId?: string;
  readonly support: CrossRegionMechanismSupport;
  readonly status: "supported";
  readonly reason: string;
}

export interface LoreContributionRecordedPayload {
  readonly contributionId: string;
  readonly claimId: string;
  readonly claimType: EpochLoreContributionCategory;
  readonly claimText: string;
  readonly claimHash: `sha256:${string}`;
  readonly category: EpochLoreContributionCategory;
  readonly agentId: string;
  readonly explorerId: string;
  readonly targetId: string;
  readonly summary: string;
  readonly revisionMode?: EpochLoreRevisionMode;
  readonly revisionPolicy?: EpochLoreRevisionPolicy;
  readonly revisedClaimText?: string;
  readonly originalClaimExplorerId?: string;
  readonly parentClaimId?: string;
  readonly mergeTargetIds?: readonly string[];
  readonly downgradeReason?: string;
  readonly sourceEventIds: readonly string[];
  readonly provenance: EpochLoreContributionProvenance;
  readonly creatureBehaviorScopeReview?: CreatureBehaviorScopeReview;
  readonly fuzzyTimeIntervalReview?: FuzzyTimeIntervalReview;
  readonly crossRegionMechanismReview?: CrossRegionMechanismReview;
  readonly cost?: {
    readonly resourceId: EpochResourceId;
    readonly amount: number;
    readonly reason: string;
  };
  readonly recordedAt: string;
}

export interface CanonAdoptionAttributionSourceContribution {
  readonly contributionEventId: string;
  readonly contributionId: string;
  readonly agentId: string;
  readonly explorerId: string;
  readonly targetId: string;
  readonly publicPages: {
    readonly audit: string;
  };
}

export interface CanonAdoptionAttributionSourceReport {
  readonly eventId: string;
  readonly eventType: EpochEventType;
  readonly agentId?: string;
  readonly explorerId?: string;
  readonly publicPages: {
    readonly audit: string;
  };
}

export interface CanonAdoptionAttribution {
  readonly sourceContributionEventIds: readonly string[];
  readonly sourceReportEventIds: readonly string[];
  readonly sourceAgentIds: readonly string[];
  readonly sourceExplorerIds: readonly string[];
  readonly sourceContributions: readonly CanonAdoptionAttributionSourceContribution[];
  readonly sourceReports: readonly CanonAdoptionAttributionSourceReport[];
}

export interface CanonCandidatePath {
  readonly requested: true;
  readonly status: "candidate";
  readonly chapterReviewId: string;
  readonly curatorApprovedBy: string;
  readonly migrationSummary: string;
  readonly adoptedText?: string;
  readonly boundaryNote?: string;
  readonly attribution: CanonAdoptionAttribution;
  readonly reason: string;
}

export interface LoreTargetAdjudicatedPayload {
  readonly adjudicationId: string;
  readonly previousAdjudicationId?: string;
  readonly newAdjudicationId?: string;
  readonly targetId: string;
  readonly status: EpochLoreAdjudicationStatus;
  readonly summary: string;
  readonly sourceContributionEventIds: readonly string[];
  readonly provenance: EpochLoreTargetAdjudicationProvenance;
  readonly canonCandidate?: CanonCandidatePath;
  readonly authorityReview?: EpochLoreAuthorityReview;
  readonly operatorId: string;
  readonly adjudicatedAt: string;
}

export interface EpochEventPayloadMap {
  readonly world_clock_initialized: WorldClockInitializedPayload;
  readonly world_clock_advanced: WorldClockAdvancedPayload;
  readonly world_simulation_initialized: WorldSimulationInitializedPayload;
  readonly world_simulation_advanced: WorldSimulationAdvancedPayload;
  readonly world_simulation_content_migrated: WorldSimulationContentMigratedPayload;
  readonly identity_issued: IdentityIssuedPayload;
  readonly explorer_recovery_rotated: ExplorerRecoveryRotatedPayload;
  readonly lifetime_adjusted: LifetimeAdjustedPayload;
  readonly identity_archived: IdentityArchivedPayload;
  readonly agent_custody_changed: AgentCustodyChangedPayload;
  readonly reincarnation_issued: ReincarnationIssuedPayload;
  readonly personality_drift_proposed: PersonalityDriftProposedPayload;
  readonly personality_drift_confirmed: PersonalityDriftConfirmedPayload;
  readonly attribute_gained: AttributeGainedPayload;
  readonly resource_granted: ResourceGrantedPayload;
  readonly resource_spent: ResourceSpentPayload;
  readonly downtime_set: DowntimeSetPayload;
  readonly downtime_tick_resolved: DowntimeTickResolvedPayload;
  readonly downtime_claimed: DowntimeClaimedPayload;
  readonly npc_candidate_submitted: NpcCandidateSubmittedPayload;
  readonly npc_candidate_reviewed: NpcCandidateReviewedPayload;
  readonly npc_canonicalized: NpcCanonicalizedPayload;
  readonly npc_lifecycle_recorded: NpcLifecycleRecordedPayload;
  readonly npc_relationship_recorded: NpcRelationshipRecordedPayload;
  readonly agent_npc_bond_updated: AgentNpcBondUpdatedPayload;
  readonly npc_memory_recorded: NpcMemoryRecordedPayload;
  readonly npc_household_recorded: NpcHouseholdRecordedPayload;
  readonly organization_created: OrganizationCreatedPayload;
  readonly organization_membership_changed: OrganizationMembershipChangedPayload;
  readonly organization_politics_recorded: OrganizationPoliticsRecordedPayload;
  readonly organization_prestige_changed: OrganizationPrestigeChangedPayload;
  readonly organization_treasury_changed: OrganizationTreasuryChangedPayload;
  readonly organization_budget_proposed: OrganizationBudgetProposedPayload;
  readonly organization_budget_vote_recorded: OrganizationBudgetVoteRecordedPayload;
  readonly organization_budget_resolved: OrganizationBudgetResolvedPayload;
  readonly organization_upgrade_purchased: OrganizationUpgradePurchasedPayload;
  readonly npc_career_changed: NpcCareerChangedPayload;
  readonly npc_location_changed: NpcLocationChangedPayload;
  readonly npc_asset_changed: NpcAssetChangedPayload;
  readonly npc_health_recorded: NpcHealthRecordedPayload;
  readonly item_created: ItemCreatedPayload;
  readonly item_bound: ItemBoundPayload;
  readonly item_transferred: ItemTransferredPayload;
  readonly social_hook_created: SocialHookCreatedPayload;
  readonly region_news_generated: RegionNewsGeneratedPayload;
  readonly contested_objective_created: ContestedObjectiveCreatedPayload;
  readonly contested_objective_contributed: ContestedObjectiveContributedPayload;
  readonly race_commission_completed: RaceCommissionCompletedPayload;
  readonly contested_objective_settled: ContestedObjectiveSettledPayload;
  readonly resource_node_spawned: ResourceNodeSpawnedPayload;
  readonly resource_node_contested: ResourceNodeContestedPayload;
  readonly resource_node_settled: ResourceNodeSettledPayload;
  readonly anomaly_event_spawned: AnomalyEventSpawnedPayload;
  readonly anomaly_event_contested: AnomalyEventContestedPayload;
  readonly anomaly_event_resolved: AnomalyEventResolvedPayload;
  readonly season_campaign_created: SeasonCampaignCreatedPayload;
  readonly season_started: SeasonStartedPayload;
  readonly season_objective_created: SeasonObjectiveCreatedPayload;
  readonly season_contribution_recorded: SeasonContributionRecordedPayload;
  readonly season_objective_completed: SeasonObjectiveCompletedPayload;
  readonly season_campaign_resolved: SeasonCampaignResolvedPayload;
  readonly season_resolved: SeasonResolvedPayload;
  readonly agent_faction_standing_changed: AgentFactionStandingChangedPayload;
  readonly journey_world_solidified: JourneyWorldSolidifiedPayload;
  readonly region_influence_changed: RegionInfluenceChangedPayload;
  readonly trace_created: TraceCreatedPayload;
  readonly trace_conflict_deployed: TraceConflictDeployedPayload;
  readonly trace_conflict_outcome: TraceConflictOutcomePayload;
  readonly trace_conflict_effect_applied: TraceConflictEffectAppliedPayload;
  readonly trace_conflict_memory_recorded: TraceConflictMemoryRecordedPayload;
  readonly region_control_changed: RegionControlChangedPayload;
  readonly region_control_decayed: RegionControlDecayedPayload;
  readonly region_control_released: RegionControlReleasedPayload;
  readonly region_revolt_resolved: RegionRevoltResolvedPayload;
  readonly region_monument_built: RegionMonumentBuiltPayload;
  readonly market_order_created: MarketOrderCreatedPayload;
  readonly market_order_filled: MarketOrderFilledPayload;
  readonly market_order_cancelled: MarketOrderCancelledPayload;
  readonly market_order_expired: MarketOrderExpiredPayload;
  readonly direct_trade_created: DirectTradeCreatedPayload;
  readonly direct_trade_accepted: DirectTradeAcceptedPayload;
  readonly direct_trade_cancelled: DirectTradeCancelledPayload;
  readonly direct_trade_expired: DirectTradeExpiredPayload;
  readonly bounty_created: BountyCreatedPayload;
  readonly bounty_claimed: BountyClaimedPayload;
  readonly party_run_created: PartyRunCreatedPayload;
  readonly party_invite_updated: PartyInviteUpdatedPayload;
  readonly party_join_requested: PartyJoinRequestedPayload;
  readonly party_join_request_resolved: PartyJoinRequestResolvedPayload;
  readonly party_member_joined: PartyMemberJoinedPayload;
  readonly party_run_settled: PartyRunSettledPayload;
  readonly raid_resolved: RaidResolvedPayload;
  readonly retaliation_opportunity_created: RetaliationOpportunityCreatedPayload;
  readonly retaliation_resolved: RetaliationResolvedPayload;
  readonly diplomacy_proposed: DiplomacyProposedPayload;
  readonly diplomacy_responded: DiplomacyRespondedPayload;
  readonly relationship_updated: RelationshipUpdatedPayload;
  readonly turn_card_created: TurnCardCreatedPayload;
  readonly turn_resolved: TurnResolvedPayload;
  readonly server_hosted_job_queued: ServerHostedJobQueuedPayload;
  readonly server_hosted_job_completed: ServerHostedJobCompletedPayload;
  readonly server_hosted_job_skipped: ServerHostedJobSkippedPayload;
  readonly attestation_recorded: AttestationRecordedPayload;
  readonly high_value_confirmation_requested: HighValueConfirmationRequestedPayload;
  readonly high_value_confirmation_confirmed: HighValueConfirmationConfirmedPayload;
  readonly high_value_confirmation_consumed: HighValueConfirmationConsumedPayload;
  readonly lore_contribution_recorded: LoreContributionRecordedPayload;
  readonly lore_target_adjudicated: LoreTargetAdjudicatedPayload;
  readonly hosted_session_started: HostedSessionStartedPayload;
  readonly hosted_action_recorded: HostedActionRecordedPayload;
  readonly message_posted: MessagePostedPayload;
  readonly legend_awarded: LegendAwardedPayload;
  readonly moderation_queued: ModerationQueuedPayload;
  readonly moderation_resolved: ModerationResolvedPayload;
  readonly risk_review_recorded: RiskReviewRecordedPayload;
  readonly market_risk_restriction_released: MarketRiskRestrictionReleasedPayload;
  readonly command_rejected: CommandRejectedPayload;
  readonly abuse_score_changed: AbuseScoreChangedPayload;
  readonly abuse_score_released: AbuseScoreReleasedPayload;
  readonly abuse_score_decayed: AbuseScoreDecayedPayload;
}

export type EpochEvent = {
  readonly [TType in EpochEventType]: EpochEventEnvelope<TType, EpochEventPayloadMap[TType]>;
}[EpochEventType];

export interface CreateEpochEventInput<TType extends EpochEventType> {
  readonly eventType: TType;
  readonly aggregateType: EpochAggregateType;
  readonly aggregateId: string;
  readonly context: EpochCommandContext;
  readonly createdAt: string;
  readonly idFactory: EpochIdFactory;
  readonly agentId?: string;
  readonly payload: EpochEventPayloadMap[TType];
}

export function createEpochEvent<TType extends EpochEventType>({
  eventType,
  aggregateType,
  aggregateId,
  context,
  createdAt,
  idFactory,
  agentId,
  payload,
}: CreateEpochEventInput<TType>): EpochEventEnvelope<TType, EpochEventPayloadMap[TType]> {
  const actorExplorerId = assertNonEmptyString(context.actorExplorerId, "actor_explorer_id");
  const eventAggregateId = assertNonEmptyString(aggregateId, "aggregate_id");
  return {
    eventId: idFactory("event"),
    eventType,
    aggregateType,
    aggregateId: eventAggregateId,
    actorExplorerId,
    agentId,
    trustClass: normalizeTrustClass(context.trustClass),
    causationId: context.causationId || idFactory("command", eventAggregateId),
    correlationId: context.correlationId || idFactory("correlation", eventAggregateId),
    idempotencyKey: context.idempotencyKey,
    createdAt,
    payload,
  };
}

export function assertEpochEvent(value: unknown): EpochEvent {
  if (!value || typeof value !== "object") {
    throw new Error("epoch_event_object_required");
  }
  const candidate = value as { eventType?: unknown; eventId?: unknown; payload?: unknown };
  if (!isEpochEventType(candidate.eventType)) {
    throw new Error("epoch_event_type_invalid");
  }
  if (typeof candidate.eventId !== "string" || candidate.eventId.length === 0) {
    throw new Error("epoch_event_id_required");
  }
  if (!candidate.payload || typeof candidate.payload !== "object") {
    throw new Error("epoch_event_payload_required");
  }
  return value as EpochEvent;
}
