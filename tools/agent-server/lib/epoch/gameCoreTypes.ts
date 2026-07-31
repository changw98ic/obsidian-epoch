import { type IpSimilarityAssessment } from "../ipSimilarity.ts";
import {
  type AbilityEffectCluster,
  type CanonCandidatePath,
  type CrossRegionMechanismReview,
  type CreatureBehaviorScopeReview,
  type EpochActionExplanation,
  type EpochEvent,
  type ExperimentMainRuleReview,
  type FuzzyTimeIntervalReview,
  type HostedActionOptionPayload,
  type HostedActionRisk,
  type HostedActionRecordedPayload,
  type NpcCandidateDecision,
  type NpcCandidateFlavorPublication,
  type NpcCandidateReviewFlag,
  type NpcCandidateReviewLevel,
  type NpcCandidateStatus,
  type NpcLifecycleValue,
  type PartyJoinRequestResolution,
  type RaidOutcome,
  type RetaliationOutcome,
  type RegionInfluenceSourceEventType,
  type RumorAdmissionReview,
  type SocialHookKind,
  type TraceSourceEventType,
  type TurnActionOptionPayload,
  type TurnCardCreatedPayload,
  type TurnResolvedPayload,
} from "./events.ts";
import {
  type IdentityStrategyDisposition,
  type StrategyProfile,
  AFFINITY_MATRIX_VERSION,
} from "./journeyStrategyRules.ts";
import type { ExpectedLifePattern, HiddenPrerequisiteLink } from "./journeyRoleplayRules.ts";
import type { CanonicalWorldObjectState } from "./hiddenPrerequisiteRules.ts";
import {
  type IdentityViability,
} from "./journeyViabilityRules.ts";
import {
  type EpochActorLifeGoal,
  type EpochActorNeedsState,
} from "./actorNeedsRules.ts";
import {
  type EpochAnomalyMedia,
  type EpochAnomalyOutcome,
  type EpochAnomalySeverity,
  type EpochChannelClass,
  type EpochClock,
  type EpochDiplomacyResponse,
  type EpochDowntimeMode,
  type EpochEventType,
  type EpochIdFactory,
  type EpochIdentityStatus,
  type EpochLineageInheritance,
  type EpochContentModerationStatus,
  type EpochMessageScope,
  type EpochLoreAdjudicationStatus,
  type EpochLoreAuthorityReview,
  type EpochLoreContributionCategory,
  type EpochLoreContributionProvenance,
  type EpochLoreRevisionMode,
  type EpochLoreRevisionPolicy,
  type EpochLoreTargetAdjudicationProvenance,
  type EpochMarketTradeRiskFlag,
  type EpochModerationResolution,
  type EpochModerationSubjectType,
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
  type EpochRiskReviewResolution,
  type EpochServerReward,
  type EpochTrustClass,
} from "./protocol.ts";
import {
  type AttributeGainInput,
  type AttributeScoreBalance,
} from "./attributeRules.ts";
import {
  type EpochOrganizationMembershipStatus,
  type EpochOrganizationUpgradeKey,
} from "./organizationTreasuryRules.ts";
import {
  type TraceConflictServerEffect,
  type TraceConflictScopeTarget,
  type TraceConflictStatus,
} from "./traceConflictRules.ts";
import {
  type TraceConflictMemoryView,
  type TraceConflictOwnerDeploymentView,
  type TraceConflictRegionView,
} from "./traceConflictReadModel.ts";
import {
  type JourneyActionResolution,
} from "./journeyActionResolutionRules.ts";
import {
  type JourneySceneContract,
  type JourneySceneContractSeed,
} from "./journeySceneContractRules.ts";
import type { MirrorConsequenceLedgerEntry } from "./journeySettlementRules.ts";
import {
  projectRegionControlDecays,
  regionRevoltResolvedPayload,
} from "./seasonCampaignRules.ts";
import {
  type ReviewNpcCandidateResolution,
} from "./npcCandidateRules.ts";
import {
  type EpochDowntimeDiaryEntry,
  type EpochDowntimeState,
} from "./downtimeRules.ts";
import {
  type EpochRegionActivity,
} from "./regionActivityRules.ts";

export interface EpochAgentIdentity {
  readonly agentId: string;
  readonly explorerId: string;
  readonly identityName: string;
  readonly generation: number;
  readonly status: EpochIdentityStatus;
  readonly previousAgentId?: string;
  readonly nextAgentId?: string;
  readonly inheritance?: EpochLineageInheritance;
  readonly lifetime: {
    readonly max: number;
    readonly remaining: number;
    readonly startedAt: string;
    readonly archivedAt?: string;
    readonly finalTitle?: string;
  };
  readonly personality: EpochAgentPersonality;
  readonly needs?: EpochActorNeedsState;
  readonly lifeGoal?: EpochActorLifeGoal;
  readonly createdAt: string;
  /**
   * PR1 additive (journeyStrategyRules). Strategy disposition frozen onto the
   * identity so the journey pipeline can ground offers/plans in a stable
   * primary posture across journeys. AUDIT-ONLY: never an input to any score,
   * reward, or viability computation (zero-bonus boundary).
   */
  readonly strategyDisposition?: IdentityStrategyDisposition;
  /**
   * PR1 additive (journeyRoleplayRules). Server-frozen roleplay norm bound to
   * this identity for its lifetime; read by every roleplay-scoring pass.
   */
  readonly expectedLifePattern?: ExpectedLifePattern;
  /**
   * PR1 additive (journeyViabilityRules). Server-authoritative snapshot of the
   * identity's viability (faction standing, exposure, doubt, status bucket).
   * Projected AFTER settlement completes; never re-feeds the current score.
   */
  readonly identityViability?: IdentityViability;
}

export interface EpochAgentPersonality {
  readonly traits: readonly string[];
  readonly driftIds: readonly string[];
  readonly updatedAt?: string;
  readonly latestSourceEventId?: string;
}

export interface EpochAgentCustodyState {
  readonly agentId: string;
  readonly custodyStatus: "free" | "imprisoned";
  readonly reason: string;
  readonly changedAt: string;
}

export type EpochPersonalityDriftStatus = "proposed" | "confirmed";

export interface EpochPersonalityDrift {
  readonly driftId: string;
  readonly agentId: string;
  readonly explorerId: string;
  readonly sourceEventId: string;
  readonly trigger: string;
  readonly suggestedTrait: string;
  readonly summary: string;
  readonly status: EpochPersonalityDriftStatus;
  readonly proposedAt: string;
  readonly confirmedAt?: string;
  readonly confirmedByExplorerId?: string;
}

export interface EpochNpcRecord {
  readonly npcId: string;
  readonly npcKey: string;
  readonly displayName: string;
  readonly regionId: string;
  readonly traits: readonly string[];
  readonly needs?: EpochActorNeedsState;
  readonly lifeGoal?: EpochActorLifeGoal;
  readonly createdAt: string;
  readonly lifecycle: readonly {
    readonly occurredAt: string;
    readonly changes: Readonly<Record<string, NpcLifecycleValue>>;
    readonly sourceEventIds: readonly string[];
  }[];
}

export type EpochNpcCandidateStatus = NpcCandidateStatus;
export type EpochNpcCandidateDecision = NpcCandidateDecision;
export type EpochNpcCandidateReviewLevel = NpcCandidateReviewLevel;
export type EpochNpcCandidateReviewFlag = NpcCandidateReviewFlag;
export type EpochAbilityEffectCluster = AbilityEffectCluster;
export type EpochRumorAdmissionReview = RumorAdmissionReview;

export interface EpochNpcCandidate {
  readonly candidateId: string;
  readonly agentId: string;
  readonly explorerId: string;
  readonly regionId: string;
  readonly displayName: string;
  readonly npcKey: string;
  readonly traits: readonly string[];
  readonly storyEvidence: string;
  readonly decision: EpochNpcCandidateDecision;
  readonly status: EpochNpcCandidateStatus;
  readonly reviewLevel: EpochNpcCandidateReviewLevel;
  readonly reviewScore: number;
  readonly reviewFlags: readonly EpochNpcCandidateReviewFlag[];
  readonly ipSimilarity?: IpSimilarityAssessment;
  readonly flavorPublication: NpcCandidateFlavorPublication;
  readonly rumorAdmissionReview: EpochRumorAdmissionReview;
  readonly abilityEffectCluster?: EpochAbilityEffectCluster;
  readonly submittedAt: string;
  readonly canonicalNpcId?: string;
  readonly rejectionReason?: string;
  readonly sourceEventId?: string;
  readonly experimentId?: string;
  readonly mainRuleReview?: ExperimentMainRuleReview;
  readonly reviewedBy?: string;
  readonly reviewedAt?: string;
  readonly reviewNote?: string;
}

export interface EpochNpcRelationship {
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

export interface EpochAgentNpcBond {
  readonly bondId: string;
  readonly agentId: string;
  readonly explorerId: string;
  readonly npcId: string;
  readonly npcRegionId: string;
  readonly kind: EpochNpcRelationshipKind;
  readonly score: number;
  readonly previousScore: number;
  readonly scoreDelta: number;
  readonly focusSpent: number;
  readonly reason: string;
  readonly updatedAt: string;
}

export interface EpochNpcMemory {
  readonly memoryId: string;
  readonly npcId: string;
  readonly regionId: string;
  readonly summary: string;
  readonly importance: EpochNpcMemoryImportance;
  readonly sourceEventIds: readonly string[];
  readonly recordedAt: string;
}

export interface EpochHousehold {
  readonly householdId: string;
  readonly regionId: string;
  readonly memberNpcIds: readonly string[];
  readonly reason: string;
  readonly sourceEventIds: readonly string[];
  readonly recordedAt: string;
}

export interface EpochOrganization {
  readonly organizationId: string;
  readonly organizationKey: string;
  readonly displayName: string;
  readonly regionId: string;
  readonly memberNpcIds: readonly string[];
  readonly memberAgentIds: readonly string[];
  readonly recordedAt: string;
}

export type EpochOrganizationMemberType = "npc" | "agent";
export interface EpochOrganizationMembership {
  readonly membershipId: string;
  readonly organizationId: string;
  readonly organizationName: string;
  readonly memberType: EpochOrganizationMemberType;
  readonly npcId?: string;
  readonly agentId?: string;
  readonly explorerId?: string;
  readonly regionId: string;
  readonly role: string;
  readonly status: EpochOrganizationMembershipStatus | string;
  readonly sourceEventIds: readonly string[];
  readonly recordedAt: string;
}

export interface EpochOrganizationPoliticsRecord {
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

export interface EpochOrganizationUpgrade {
  readonly upgradeId: string;
  readonly organizationId: string;
  readonly organizationName: string;
  readonly regionId: string;
  readonly upgradeKey: EpochOrganizationUpgradeKey;
  readonly title: string;
  readonly description: string;
  readonly purchasedByAgentId: string;
  readonly purchasedByExplorerId: string;
  readonly costResourceId: EpochResourceId;
  readonly costAmount: number;
  readonly sourceEventIds: readonly string[];
  readonly purchasedAt: string;
}

export interface EpochOrganizationBudget {
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
  readonly approvalCount: number;
  readonly rejectionCount: number;
  readonly votes: readonly EpochOrganizationBudgetVote[];
  readonly resolvedByAgentId?: string;
  readonly resolvedByExplorerId?: string;
  readonly resolution?: EpochOrganizationBudgetResolution;
  readonly note?: string;
  readonly treasuryEventId?: string;
  readonly sourceEventIds: readonly string[];
  readonly proposedAt: string;
  readonly resolvedAt?: string;
}

export interface EpochOrganizationBudgetVote {
  readonly voteId: string;
  readonly decision: EpochOrganizationBudgetResolution;
  readonly voterAgentId: string;
  readonly voterExplorerId: string;
  readonly voterRole: string;
  readonly note?: string;
  readonly sourceEventIds: readonly string[];
  readonly votedAt: string;
}

export interface EpochNpcCareerRecord {
  readonly careerId: string;
  readonly npcId: string;
  readonly regionId: string;
  readonly title: string;
  readonly status: string;
  readonly organizationId?: string;
  readonly sourceEventIds: readonly string[];
  readonly recordedAt: string;
}

export interface EpochNpcLocationRecord {
  readonly locationId: string;
  readonly npcId: string;
  readonly fromRegionId: string;
  readonly toRegionId: string;
  readonly reason: string;
  readonly sourceEventIds: readonly string[];
  readonly recordedAt: string;
}

export interface EpochNpcAssetState {
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

export interface EpochNpcHealthState {
  readonly healthId: string;
  readonly npcId: string;
  readonly regionId: string;
  readonly status: string;
  readonly severity: string;
  readonly reason: string;
  readonly sourceEventIds: readonly string[];
  readonly recordedAt: string;
}

export interface EpochInventoryItem {
  readonly itemId: string;
  readonly agentId: string;
  readonly explorerId: string;
  readonly itemKey: string;
  readonly displayName: string;
  readonly rarity: string;
  readonly sourceEventIds: readonly string[];
  readonly createdAt: string;
  readonly bound: boolean;
  readonly boundAt?: string;
  readonly boundReason?: string;
  readonly marketLockedByOrderId?: string;
  readonly transferredAt?: string;
  readonly transferSourceOrderId?: string;
}

export interface EpochSocialHook {
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

export interface EpochRegionNews {
  readonly newsId: string;
  readonly regionId: string;
  readonly headline: string;
  readonly body: string;
  readonly legendDelta: number;
  readonly sourceEventIds: readonly string[];
  readonly createdAt: string;
  readonly moderationStatus: EpochContentModerationStatus;
}

export interface EpochMessageRecord {
  readonly messageId: string;
  readonly scope: EpochMessageScope;
  readonly agentId: string;
  readonly explorerId: string;
  readonly regionId?: string;
  readonly body: string;
  readonly postedAt: string;
  readonly moderationStatus: EpochContentModerationStatus;
}

export type EpochModerationItemStatus = "open" | "resolved";

export interface EpochModerationItem {
  readonly moderationId: string;
  readonly subjectType: EpochModerationSubjectType;
  readonly subjectId: string;
  readonly sourceEventId: string;
  readonly agentId?: string;
  readonly explorerId?: string;
  readonly regionId?: string;
  readonly reason: string;
  readonly severity: "low" | "medium" | "high";
  readonly bodyPreview: string;
  readonly queuedAt: string;
  readonly status: EpochModerationItemStatus;
  readonly resolution?: EpochModerationResolution;
  readonly resolvedBy?: string;
  readonly resolvedAt?: string;
  readonly note?: string;
}

export interface EpochRiskReview {
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

export interface EpochLegendAward {
  readonly awardId: string;
  readonly newsId: string;
  readonly regionId: string;
  readonly agentId: string;
  readonly explorerId: string;
  readonly amount: number;
  readonly reason: string;
  readonly awardedAt: string;
}

export type EpochContestedObjectiveStatus = "active" | "settled";

export interface EpochObjectiveStanding {
  readonly agentId: string;
  readonly explorerId: string;
  readonly amount: number;
  readonly score: number;
}

export interface EpochRaceCompletion {
  readonly completionId: string;
  readonly agentId: string;
  readonly explorerId: string;
  readonly place: number;
  readonly score: number;
  readonly reward: EpochServerReward;
  readonly completedAt: string;
}

export interface EpochContestedObjective {
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
  readonly status: EpochContestedObjectiveStatus;
  readonly totalScore: number;
  readonly leaderboard: readonly EpochObjectiveStanding[];
  readonly raceCompletions: readonly EpochRaceCompletion[];
  readonly settledAt?: string;
  readonly winnerAgentId?: string;
  readonly winnerExplorerId?: string;
  readonly winningScore?: number;
}

export type EpochResourceNodeStatus = "open" | "settled";

export interface EpochResourceNodeStanding {
  readonly agentId: string;
  readonly explorerId: string;
  readonly staminaSpent: number;
  readonly score: number;
}

export interface EpochResourceNode {
  readonly nodeId: string;
  readonly regionId: string;
  readonly title: string;
  readonly description: string;
  readonly resourceId: EpochResourceId;
  readonly reward: EpochServerReward;
  readonly spawnedAt: string;
  readonly status: EpochResourceNodeStatus;
  readonly totalScore: number;
  readonly leaderboard: readonly EpochResourceNodeStanding[];
  readonly settledAt?: string;
  readonly winnerAgentId?: string;
  readonly winnerExplorerId?: string;
  readonly winningScore?: number;
}

export type EpochAnomalyEventStatus = "open" | "resolved";

export interface EpochAnomalyStanding {
  readonly agentId: string;
  readonly explorerId: string;
  readonly focusSpent: number;
  readonly score: number;
}

export interface EpochAnomalyEvent {
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
  readonly status: EpochAnomalyEventStatus;
  readonly totalScore: number;
  readonly leaderboard: readonly EpochAnomalyStanding[];
  readonly resolvedAt?: string;
  readonly outcome?: EpochAnomalyOutcome;
  readonly winnerAgentId?: string;
  readonly winnerExplorerId?: string;
  readonly winningScore?: number;
}

export type EpochSeasonCampaignStatus = "active" | "resolved";
export type EpochSeasonPhase = "active" | "resolved";
export type EpochSeasonPhaseEventType = "season_started" | "season_resolved";

export interface EpochSeasonPhaseEvent {
  readonly eventId: string;
  readonly eventType: EpochSeasonPhaseEventType;
  readonly phase: EpochSeasonPhase;
  readonly sourceEventId: string;
  readonly relatedEventIds: readonly string[];
  readonly at: string;
}

export type EpochSeasonObjectiveStatus = "open" | "completed";

export interface EpochSeasonObjectiveTemplate {
  readonly objectiveKey: string;
  readonly title: string;
  readonly description: string;
  readonly targetScore: number;
}

export interface EpochSeasonObjective {
  readonly objectiveId: string;
  readonly seasonId: string;
  readonly objectiveKey: string;
  readonly title: string;
  readonly description: string;
  readonly targetScore: number;
  readonly progressScore: number;
  readonly status: EpochSeasonObjectiveStatus;
  readonly createdAt: string;
  readonly sourceEventId?: string;
  readonly completedAt?: string;
  readonly completedByAgentId?: string;
  readonly completedByExplorerId?: string;
  readonly completedByFactionId?: string;
}

export interface EpochSeasonContribution {
  readonly eventId: string;
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
  readonly trustClass: EpochTrustClass;
  readonly recordedAt: string;
}

export interface EpochSeasonAgentStanding {
  readonly agentId: string;
  readonly explorerId: string;
  readonly factionId: string;
  readonly amount: number;
  readonly score: number;
  readonly trustedScore: number;
  readonly dominantTrustClass: EpochTrustClass;
  readonly trustBreakdown: Partial<Record<EpochTrustClass, number>>;
}

export interface EpochSeasonFactionStanding {
  readonly factionId: string;
  readonly score: number;
  readonly trustedScore: number;
  readonly dominantTrustClass: EpochTrustClass;
  readonly trustBreakdown: Partial<Record<EpochTrustClass, number>>;
}

export interface EpochSeasonCampaign {
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
  readonly status: EpochSeasonCampaignStatus;
  readonly phaseEvents: readonly EpochSeasonPhaseEvent[];
  readonly objectives: readonly EpochSeasonObjective[];
  readonly contributions: readonly EpochSeasonContribution[];
  readonly totalScore: number;
  readonly factionStandings: readonly EpochSeasonFactionStanding[];
  readonly agentStandings: readonly EpochSeasonAgentStanding[];
  readonly resolvedAt?: string;
  readonly winningFactionId?: string;
  readonly winnerAgentId?: string;
  readonly winnerExplorerId?: string;
  readonly winningScore?: number;
}

export interface EpochRegionControl {
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
  readonly updatedAt: string;
}

export interface EpochRegionInfluenceChange {
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
  readonly worldMinute?: number;
}

export interface EpochAgentFactionStanding {
  readonly standingId: string;
  readonly agentId: string;
  readonly explorerId: string;
  readonly factionId: string;
  readonly score: number;
  readonly routeIds: readonly string[];
  readonly journeyIds: readonly string[];
  readonly sourceEventIds: readonly string[];
  readonly updatedAt: string;
  readonly worldMinute: number;
}

export interface EpochConflictTrace {
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

export interface EpochRegionMonument {
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

export type EpochMarketOrderStatus = "open" | "filled" | "cancelled" | "expired";
export type EpochMarketSellKind = "resource" | "item";

export interface EpochMarketOrder {
  readonly orderId: string;
  readonly regionId: string;
  readonly sellerAgentId: string;
  readonly sellerExplorerId: string;
  readonly sellKind: EpochMarketSellKind;
  readonly sellResourceId?: EpochResourceId;
  readonly sellAmount: number;
  readonly sellItemId?: string;
  readonly sellItemKey?: string;
  readonly sellItemDisplayName?: string;
  readonly sellItemRarity?: string;
  readonly priceResourceId: EpochResourceId;
  readonly priceAmount: number;
  readonly status: EpochMarketOrderStatus;
  readonly createdAt: string;
  readonly buyerAgentId?: string;
  readonly buyerExplorerId?: string;
  readonly marketFeeResourceId?: EpochResourceId;
  readonly marketFeeAmount?: number;
  readonly sellerProceedsAmount?: number;
  readonly transferredItemId?: string;
  readonly tradeRiskFlags?: readonly EpochMarketTradeRiskFlag[];
  readonly tradeRiskScore?: number;
  readonly filledAt?: string;
  readonly cancelledAt?: string;
  readonly expiredAt?: string;
}

export interface EpochMarketRiskRestriction {
  readonly agentId: string;
  readonly explorerId?: string;
  readonly sourceEventId: string;
  readonly sourceReviewId: string;
  readonly reviewFlags: readonly string[];
  readonly reviewScore: number;
  readonly reason: "risk_review_escalated";
  readonly restrictedAt: string;
}

export interface EpochMarketRiskRestrictionRelease {
  readonly releaseId: string;
  readonly agentId: string;
  readonly explorerId?: string;
  readonly sourceEventId: string;
  readonly sourceReviewId: string;
  readonly releasedBy: string;
  readonly releasedAt: string;
  readonly note?: string;
}

export type EpochDirectTradeStatus = "open" | "accepted" | "cancelled" | "expired";
export type EpochDirectTradeAssetKind = "resource" | "item";

export interface EpochDirectTradeAsset {
  readonly kind: EpochDirectTradeAssetKind;
  readonly resourceId?: EpochResourceId;
  readonly amount?: number;
  readonly itemId?: string;
  readonly itemKey?: string;
  readonly itemDisplayName?: string;
  readonly itemRarity?: string;
}

export interface EpochDirectTrade {
  readonly tradeId: string;
  readonly regionId: string;
  readonly proposerAgentId: string;
  readonly proposerExplorerId: string;
  readonly counterpartyAgentId: string;
  readonly counterpartyExplorerId: string;
  readonly offeredAsset: EpochDirectTradeAsset;
  readonly requestedAsset: EpochDirectTradeAsset;
  readonly status: EpochDirectTradeStatus;
  readonly createdAt: string;
  readonly transferredOfferedItemId?: string;
  readonly transferredRequestedItemId?: string;
  readonly tradeRiskFlags?: readonly EpochMarketTradeRiskFlag[];
  readonly tradeRiskScore?: number;
  readonly acceptedAt?: string;
  readonly cancelledAt?: string;
  readonly expiredAt?: string;
}

export type EpochBountyStatus = "open" | "claimed";

export interface EpochBounty {
  readonly bountyId: string;
  readonly regionId: string;
  readonly sponsorAgentId: string;
  readonly sponsorExplorerId: string;
  readonly title: string;
  readonly description: string;
  readonly rewardResourceId: EpochResourceId;
  readonly rewardAmount: number;
  readonly requiredItemKey?: string;
  readonly status: EpochBountyStatus;
  readonly createdAt: string;
  readonly claimantAgentId?: string;
  readonly claimantExplorerId?: string;
  readonly transferredItemId?: string;
  readonly evidence?: string;
  readonly claimedAt?: string;
}

export type EpochPartyRunStatus = "open" | "settled";

export interface EpochPartyMember {
  readonly agentId: string;
  readonly explorerId: string;
  readonly participantRole: EpochPartyRole;
  readonly joinedAt: string;
}

export interface EpochPartyMemberResult {
  readonly agentId: string;
  readonly explorerId: string;
  readonly participantRole: EpochPartyRole;
  readonly score: number;
  readonly reward: EpochServerReward;
}

export type EpochPartyJoinRequestStatus = "pending" | "approved" | "rejected";

export interface EpochPartyJoinRequest {
  readonly requestId: string;
  readonly partyRunId: string;
  readonly agentId: string;
  readonly explorerId: string;
  readonly participantRole: EpochPartyRole;
  readonly status: EpochPartyJoinRequestStatus;
  readonly requestNote?: string;
  readonly requestedAt: string;
  readonly resolvedAt?: string;
  readonly resolvedByAgentId?: string;
  readonly resolvedByExplorerId?: string;
  readonly resolutionNote?: string;
}

export interface EpochPartyRun {
  readonly partyRunId: string;
  readonly regionId: string;
  readonly leaderAgentId: string;
  readonly leaderExplorerId: string;
  readonly title: string;
  readonly objective: string;
  readonly joinPolicy: EpochPartyRunJoinPolicy;
  readonly inviteTokenHash?: string;
  readonly inviteTokenExpiresAt?: string;
  readonly inviteTokenUseLimit?: number;
  readonly inviteTokenUses?: number;
  readonly inviteRecipientAgentId?: string;
  readonly inviteTokenRevokedAt?: string;
  readonly status: EpochPartyRunStatus;
  readonly members: readonly EpochPartyMember[];
  readonly joinRequests?: readonly EpochPartyJoinRequest[];
  readonly totalScore?: number;
  readonly memberResults?: readonly EpochPartyMemberResult[];
  readonly traceId?: string;
  readonly newsId?: string;
  readonly settledAt?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface EpochRaidResult {
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

export type EpochRetaliationOpportunityStatus = "open" | "resolved";

export interface EpochRetaliationOpportunity {
  readonly retaliationId: string;
  readonly regionId: string;
  readonly sourceRaidId: string;
  readonly sourceTraceId: string;
  readonly opportunityAgentId: string;
  readonly opportunityExplorerId: string;
  readonly targetAgentId: string;
  readonly targetExplorerId: string;
  readonly status: EpochRetaliationOpportunityStatus;
  readonly reason: string;
  readonly sourceEventIds: readonly string[];
  readonly createdAt: string;
  readonly staminaSpent?: number;
  readonly retaliatorPower?: number;
  readonly targetPower?: number;
  readonly outcome?: RetaliationOutcome;
  readonly winnerAgentId?: string;
  readonly winnerExplorerId?: string;
  readonly resolvedAt?: string;
}

export type EpochDiplomacyStatus = "pending" | "accepted" | "rejected";

export interface EpochDiplomacyRecord {
  readonly diplomacyId: string;
  readonly regionId: string;
  readonly sourceAgentId: string;
  readonly sourceExplorerId: string;
  readonly targetAgentId: string;
  readonly targetExplorerId: string;
  readonly kind: EpochRelationshipKind;
  readonly focusSpent: number;
  readonly terms: string;
  readonly status: EpochDiplomacyStatus;
  readonly proposedAt: string;
  readonly response?: EpochDiplomacyResponse;
  readonly responseFocusSpent?: number;
  readonly responseNote?: string;
  readonly relationshipId?: string;
  readonly respondedAt?: string;
}

export interface EpochRelationshipEdge {
  readonly relationshipId: string;
  readonly sourceAgentId: string;
  readonly sourceExplorerId: string;
  readonly targetAgentId: string;
  readonly targetExplorerId: string;
  readonly kind: EpochRelationshipKind;
  readonly score: number;
  readonly previousScore: number;
  readonly scoreDelta: number;
  readonly focusSpent: number;
  readonly reason: string;
  readonly updatedAt: string;
}

export type EpochTurnCardStatus = "open" | "resolved";

export interface EpochTurnTraceEffect {
  readonly traceId: string;
  readonly effect: TraceConflictServerEffect;
  readonly appliedAt: string;
}

export interface EpochTurnResolution {
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
  readonly signedEnvelope: TurnResolvedPayload["signedEnvelope"];
}

export interface EpochTurnCard {
  readonly turnCardId: string;
  readonly agentId: string;
  readonly explorerId: string;
  readonly regionId: string;
  readonly sequence: number;
  readonly nonce: string;
  readonly prompt: string;
  readonly visibleContext: TurnCardCreatedPayload["visibleContext"];
  readonly status: EpochTurnCardStatus;
  readonly actionOptions: readonly TurnActionOptionPayload[];
  readonly traceEffects: readonly EpochTurnTraceEffect[];
  readonly createdAt: string;
  readonly expiresAt?: string;
  readonly signedEnvelope: TurnCardCreatedPayload["signedEnvelope"];
  readonly resolvedAt?: string;
  readonly resolution?: EpochTurnResolution;
}

export type EpochHostedSessionStatus = "active" | "completed";

export interface EpochHostedActionRecord {
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
  readonly journeyResolution?: JourneyActionResolution;
  readonly reward?: EpochServerReward;
  readonly lifetimeDelta?: number;
  readonly nonEvidence?: boolean;
  readonly recordedAt: string;
  readonly signedEnvelope: HostedActionRecordedPayload["signedEnvelope"];
}

export interface EpochAttestationRecord {
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

export interface EpochAbuseScoreProfile {
  readonly actorKey: string;
  readonly agentId?: string;
  readonly explorerId?: string;
  readonly score: number;
  readonly updatedAt: string;
  readonly latestEventId: string;
  readonly sourceEventIds: readonly string[];
  readonly reasons: Readonly<Record<string, number>>;
}

export interface EpochAbuseScoreRelease {
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

export interface EpochAbuseScoreDecay {
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

export interface DecayAbuseScoresInput {
  readonly limit?: number;
  readonly amount?: number;
  readonly minScore?: number;
}

export type EpochRegionControlDecay = ReturnType<typeof projectRegionControlDecays>[number];

export interface DecayRegionControlsInput {
  readonly limit?: number;
  readonly amount?: number;
  readonly minAgeSeconds?: number;
  readonly minScore?: number;
}

export interface ClaimReleasedRegionControlInput {
  readonly regionId: string;
  readonly seasonId: string;
  readonly factionId: string;
  readonly agentId?: string;
}

export type EpochRegionRevoltResult = ReturnType<typeof regionRevoltResolvedPayload>;

export interface ResolveRegionRevoltInput {
  readonly regionId: string;
  readonly seasonId: string;
  readonly factionId: string;
  readonly agentId: string;
  readonly staminaSpent: number;
}

export interface EpochHostedSession {
  readonly sessionId: string;
  readonly agentId: string;
  readonly explorerId: string;
  readonly regionId: string;
  readonly mandate: string;
  readonly channelClass: EpochChannelClass;
  readonly deliveryTrust: EpochTrustClass;
  readonly status: EpochHostedSessionStatus;
  readonly actionOptions: readonly HostedActionOptionPayload[];
  readonly sceneContract?: JourneySceneContract;
  readonly actions: readonly EpochHostedActionRecord[];
  readonly startedAt: string;
  readonly completedAt?: string;
}

export type EpochServerHostedJobStatus = "queued" | "completed" | "skipped";

export interface EpochServerHostedJob {
  readonly jobId: string;
  readonly agentId: string;
  readonly explorerId: string;
  readonly regionId: string;
  readonly mandate: string;
  readonly optionKey: "observe" | "assist" | "anomaly";
  readonly visibleText?: string;
  readonly deliveryTrust: "server_hosted_agent";
  readonly status: EpochServerHostedJobStatus;
  readonly queuedBy: string;
  readonly queuedAt: string;
  readonly sessionId?: string;
  readonly actionId?: string;
  readonly completedAt?: string;
  readonly skipReason?: "action_option_unavailable";
  readonly skippedAt?: string;
}

export interface EpochProjection {
  readonly events: readonly EpochEvent[];
  readonly identities: Readonly<Record<string, EpochAgentIdentity>>;
  readonly lineage: Readonly<Record<string, readonly string[]>>;
  readonly personalityDrifts: Readonly<Record<string, EpochPersonalityDrift>>;
  readonly personalityDriftIdsByAgent: Readonly<Record<string, readonly string[]>>;
  readonly attributeScores: Readonly<Record<string, AttributeScoreBalance>>;
  readonly resourceBalances: Readonly<Record<string, Partial<Record<EpochResourceId, number>>>>;
  readonly downtime: Readonly<Record<string, EpochDowntimeState>>;
  readonly agentCustody: Readonly<Record<string, EpochAgentCustodyState>>;
  readonly downtimeDiaryEntries: Readonly<Record<string, EpochDowntimeDiaryEntry>>;
  readonly downtimeDiaryIdsByAgent: Readonly<Record<string, readonly string[]>>;
  readonly regionActivities: Readonly<Record<string, EpochRegionActivity>>;
  readonly regionActivityIdsByRegion: Readonly<Record<string, readonly string[]>>;
  readonly npcs: Readonly<Record<string, EpochNpcRecord>>;
  readonly npcIdsByKey: Readonly<Record<string, string>>;
  readonly npcCandidates: Readonly<Record<string, EpochNpcCandidate>>;
  readonly npcCandidateIdsByRegion: Readonly<Record<string, readonly string[]>>;
  readonly npcCandidateIdsByAgent: Readonly<Record<string, readonly string[]>>;
  readonly npcRelationships: Readonly<Record<string, EpochNpcRelationship>>;
  readonly npcRelationshipIdsByNpc: Readonly<Record<string, readonly string[]>>;
  readonly npcRelationshipIdsByRegion: Readonly<Record<string, readonly string[]>>;
  readonly agentNpcBonds: Readonly<Record<string, EpochAgentNpcBond>>;
  readonly agentNpcBondIdsByAgent: Readonly<Record<string, readonly string[]>>;
  readonly agentNpcBondIdsByNpc: Readonly<Record<string, readonly string[]>>;
  readonly agentNpcBondIdsByRegion: Readonly<Record<string, readonly string[]>>;
  readonly npcMemories: Readonly<Record<string, EpochNpcMemory>>;
  readonly npcMemoryIdsByNpc: Readonly<Record<string, readonly string[]>>;
  readonly npcMemoryIdsByRegion: Readonly<Record<string, readonly string[]>>;
  readonly households: Readonly<Record<string, EpochHousehold>>;
  readonly householdIdsByNpc: Readonly<Record<string, readonly string[]>>;
  readonly householdIdsByRegion: Readonly<Record<string, readonly string[]>>;
  readonly organizations: Readonly<Record<string, EpochOrganization>>;
  readonly organizationMemberships: Readonly<Record<string, EpochOrganizationMembership>>;
  readonly organizationMembershipIdsByNpc: Readonly<Record<string, readonly string[]>>;
  readonly organizationMembershipIdsByAgent: Readonly<Record<string, readonly string[]>>;
  readonly organizationMembershipIdsByRegion: Readonly<Record<string, readonly string[]>>;
  readonly organizationMembershipIdsByOrganization: Readonly<Record<string, readonly string[]>>;
  readonly organizationPolitics: Readonly<Record<string, EpochOrganizationPoliticsRecord>>;
  readonly organizationPoliticsIdsByRegion: Readonly<Record<string, readonly string[]>>;
  readonly organizationPoliticsIdsByOrganization: Readonly<Record<string, readonly string[]>>;
  readonly organizationPoliticsIdsByNpc: Readonly<Record<string, readonly string[]>>;
  readonly organizationPoliticalStandingByOrganization: Readonly<Record<string, number>>;
  readonly organizationTreasuryBalances: Readonly<Record<string, Partial<Record<EpochResourceId, number>>>>;
  readonly organizationUpgrades: Readonly<Record<string, EpochOrganizationUpgrade>>;
  readonly organizationUpgradeIdsByOrganization: Readonly<Record<string, readonly string[]>>;
  readonly organizationBudgets: Readonly<Record<string, EpochOrganizationBudget>>;
  readonly organizationBudgetIdsByOrganization: Readonly<Record<string, readonly string[]>>;
  readonly npcCareerRecords: Readonly<Record<string, EpochNpcCareerRecord>>;
  readonly npcCareerIdsByNpc: Readonly<Record<string, readonly string[]>>;
  readonly npcCareerIdsByRegion: Readonly<Record<string, readonly string[]>>;
  readonly npcLocationRecords: Readonly<Record<string, EpochNpcLocationRecord>>;
  readonly npcLocationIdsByNpc: Readonly<Record<string, readonly string[]>>;
  readonly npcLocationIdsByRegion: Readonly<Record<string, readonly string[]>>;
  readonly npcAssetStates: Readonly<Record<string, EpochNpcAssetState>>;
  readonly npcAssetIdsByNpc: Readonly<Record<string, readonly string[]>>;
  readonly npcAssetIdsByRegion: Readonly<Record<string, readonly string[]>>;
  readonly npcAssetBalancesByNpc: Readonly<Record<string, Readonly<Record<string, number>>>>;
  readonly npcHealthStates: Readonly<Record<string, EpochNpcHealthState>>;
  readonly npcHealthIdsByNpc: Readonly<Record<string, readonly string[]>>;
  readonly npcHealthIdsByRegion: Readonly<Record<string, readonly string[]>>;
  readonly inventoryItems: Readonly<Record<string, EpochInventoryItem>>;
  readonly inventoryItemIdsByAgent: Readonly<Record<string, readonly string[]>>;
  readonly inventoryItemIdsByExplorer: Readonly<Record<string, readonly string[]>>;
  readonly socialHooks: Readonly<Record<string, EpochSocialHook>>;
  readonly socialHookIdsByRegion: Readonly<Record<string, readonly string[]>>;
  readonly socialHookIdsByNpc: Readonly<Record<string, readonly string[]>>;
  readonly regionNews: Readonly<Record<string, readonly EpochRegionNews[]>>;
  readonly worldMessages: readonly EpochMessageRecord[];
  readonly regionMessages: Readonly<Record<string, readonly EpochMessageRecord[]>>;
  readonly moderationItems: Readonly<Record<string, EpochModerationItem>>;
  readonly riskReviews: Readonly<Record<string, EpochRiskReview>>;
  readonly riskReviewIdsBySourceEvent: Readonly<Record<string, readonly string[]>>;
  readonly riskReviewIdsByAgent: Readonly<Record<string, readonly string[]>>;
  readonly legendAwards: Readonly<Record<string, EpochLegendAward>>;
  readonly legendAwardIdsByNews: Readonly<Record<string, readonly string[]>>;
  readonly legendAwardIdsByAgent: Readonly<Record<string, readonly string[]>>;
  readonly contestedObjectives: Readonly<Record<string, EpochContestedObjective>>;
  readonly objectiveIdsByRegion: Readonly<Record<string, readonly string[]>>;
  readonly resourceNodes: Readonly<Record<string, EpochResourceNode>>;
  readonly resourceNodeIdsByRegion: Readonly<Record<string, readonly string[]>>;
  readonly anomalyEvents: Readonly<Record<string, EpochAnomalyEvent>>;
  readonly anomalyEventIdsByRegion: Readonly<Record<string, readonly string[]>>;
  readonly seasonCampaigns: Readonly<Record<string, EpochSeasonCampaign>>;
  readonly seasonObjectives: Readonly<Record<string, EpochSeasonObjective>>;
  readonly seasonObjectiveIdsBySeason: Readonly<Record<string, readonly string[]>>;
  readonly seasonCampaignIdsByRegion: Readonly<Record<string, readonly string[]>>;
  readonly seasonCampaignIdsByFaction: Readonly<Record<string, readonly string[]>>;
  readonly agentFactionStandings: Readonly<Record<string, EpochAgentFactionStanding>>;
  readonly factionStandingIdsByAgent: Readonly<Record<string, readonly string[]>>;
  readonly factionStandingIdsByFaction: Readonly<Record<string, readonly string[]>>;
  readonly regionInfluenceChanges: Readonly<Record<string, EpochRegionInfluenceChange>>;
  readonly regionInfluenceIdsByRegion: Readonly<Record<string, readonly string[]>>;
  readonly regionInfluenceIdsByAgent: Readonly<Record<string, readonly string[]>>;
  readonly conflictTraces: Readonly<Record<string, EpochConflictTrace>>;
  readonly traceIdsByRegion: Readonly<Record<string, readonly string[]>>;
  readonly traceIdsByAgent: Readonly<Record<string, readonly string[]>>;
  readonly regionControls: Readonly<Record<string, EpochRegionControl>>;
  readonly regionMonuments: Readonly<Record<string, EpochRegionMonument>>;
  readonly regionMonumentIdsByRegion: Readonly<Record<string, readonly string[]>>;
  readonly marketOrders: Readonly<Record<string, EpochMarketOrder>>;
  readonly directTrades: Readonly<Record<string, EpochDirectTrade>>;
  readonly marketRiskRestrictions: Readonly<Record<string, EpochMarketRiskRestriction>>;
  readonly marketRiskRestrictionReleases: Readonly<Record<string, EpochMarketRiskRestrictionRelease>>;
  readonly bounties: Readonly<Record<string, EpochBounty>>;
  readonly bountyIdsByRegion: Readonly<Record<string, readonly string[]>>;
  readonly bountyIdsByAgent: Readonly<Record<string, readonly string[]>>;
  readonly partyRuns: Readonly<Record<string, EpochPartyRun>>;
  readonly partyRunIdsByRegion: Readonly<Record<string, readonly string[]>>;
  readonly raidResults: Readonly<Record<string, EpochRaidResult>>;
  readonly raidIdsByRegion: Readonly<Record<string, readonly string[]>>;
  readonly retaliationOpportunities: Readonly<Record<string, EpochRetaliationOpportunity>>;
  readonly retaliationIdsByRegion: Readonly<Record<string, readonly string[]>>;
  readonly retaliationIdsByAgent: Readonly<Record<string, readonly string[]>>;
  readonly diplomacyRecords: Readonly<Record<string, EpochDiplomacyRecord>>;
  readonly diplomacyIdsByRegion: Readonly<Record<string, readonly string[]>>;
  readonly diplomacyIdsByAgent: Readonly<Record<string, readonly string[]>>;
  readonly relationshipEdges: Readonly<Record<string, EpochRelationshipEdge>>;
  readonly relationshipIdsByAgent: Readonly<Record<string, readonly string[]>>;
  readonly turnCards: Readonly<Record<string, EpochTurnCard>>;
  readonly hostedSessions: Readonly<Record<string, EpochHostedSession>>;
  readonly serverHostedJobs: Readonly<Record<string, EpochServerHostedJob>>;
  readonly serverHostedJobIdsByAgent: Readonly<Record<string, readonly string[]>>;
  readonly attestationRecords: Readonly<Record<string, EpochAttestationRecord>>;
  readonly abuseScores: Readonly<Record<string, EpochAbuseScoreProfile>>;
  /**
   * PR5c additive. Canonical world-object lifecycle states. Populated ONLY
   * by canonical intents (solidify path) via world_object_state_changed
   * events. Keyed by objectId (no region prefix — the projection is
   * region-scoped at the caller level).
   */
  readonly worldObjectStates: Readonly<Record<string, CanonicalWorldObjectState>>;
  /**
   * PR5c additive. Canonical hidden-prerequisite link states. Populated
   * ONLY by canonical intents (solidify path) via
   * hidden_prerequisite_link_changed events. Keyed by
   * `${regionId}:${objectiveId}:${prerequisiteObjectId}`.
   */
  readonly hiddenPrerequisiteLinks: Readonly<Record<string, HiddenPrerequisiteLink>>;
}

/**
 * Mutable shallow-clone of EpochProjection used internally by domain reducers.
 * Each field is a mutable copy of the corresponding readonly field on
 * EpochProjection, allowing in-place mutation during event application.
 */
type MutableArray<T> = T extends readonly (infer U)[] ? U[] : T;
type MutableInner<T> = T extends Readonly<Record<string, infer V>>
  ? Record<string, MutableArray<V>>
  : MutableArray<T>;

export type MutableProjection = {
  -readonly [K in keyof EpochProjection]: MutableInner<EpochProjection[K]>;
};

export interface EpochCommandResult<TValue> {
  readonly events: readonly EpochEvent[];
  readonly value: TValue;
  readonly projection: EpochProjection;
}

export interface EpochGameCoreOptions {
  readonly initialEvents?: readonly EpochEvent[];
  readonly clock?: EpochClock;
  readonly idFactory?: EpochIdFactory;
  readonly defaultLifetime?: number;
  readonly maxDowntimeSeconds?: number;
  readonly identityNameFactory?: (input: { explorerId: string; generation: number }) => string;
  /**
   * PR2 mirror-consequence ledger sink. When supplied, `submitHostedAction`
   * computes mirror-world consequence blueprints for every completed
   * objective and forwards them through this callback instead of emitting
   * canonical world events directly. The integrator (e.g. agent-companion
   * runtime) is responsible for translating the callback into a
   * `JourneyRuntime.recordMirrorConsequences` call so the ledger projection
   * remains the single in-memory truth. A mirror action that produces
   * consequence entries fails when no sink is configured; collateral is never
   * silently discarded.
   *
   * `expectedVersion` sentinel: gameCore always passes `-1` to signal
   * "no compare-and-set check". The submit-time caller does not own the
   * journey runtime's version counter and cannot perform CAS on its
   * behalf. Integrators MUST treat `-1` as an opt-out: either skip the
   * version check entirely, or fetch the current `journey.version` from
   * their own projection and forward the real value into
   * `JourneyRuntime.recordMirrorConsequences`. Any other negative value
   * is invalid. Integrations that blindly forward `expectedVersion` into
   * a CAS-enforcing runtime will throw `journey_version_conflict`.
   */
  readonly journeyMirrorLedgerSink?: (input: {
    readonly journeyId: string;
    readonly agentId: string;
    /**
     * Always `-1` from gameCore. See the sentinel note on
     * {@link EpochGameCoreOptions.journeyMirrorLedgerSink}.
     */
    readonly expectedVersion: number;
    readonly actionEventId: string;
    readonly entries: readonly MirrorConsequenceLedgerEntry[];
  }) => void;
}

export interface IssueIdentityInput {
  readonly explorerId: string;
  readonly explorerSecretHash?: string;
  readonly identityName?: string;
  readonly maxLifetime?: number;
  readonly previousAgentId?: string;
  /**
   * PR1 additive (journeyStrategyRules). Declared strategy pair persisted with
   * the issued identity. Persisted alongside {@link strategyDisposition} when
   * the identity layer freezes the primary posture.
   */
  readonly strategyProfile?: StrategyProfile;
  /**
   * PR1 additive (journeyStrategyRules). Version of the affinity matrix the
   * disposition was frozen against, carried for historical replay.
   */
  readonly affinityMatrixVersion?: typeof AFFINITY_MATRIX_VERSION;
  /**
   * PR1 additive (journeyRoleplayRules). sha256 of the deterministic input
   * bundle that produced the {@link ExpectedLifePattern} for this identity.
   */
  readonly expectedLifePatternInputHash?: `sha256:${string}`;
}

export interface RotateExplorerRecoveryInput {
  readonly explorerId: string;
  readonly explorerSecretHash: string;
}

export interface EpochRecoveryRotation {
  readonly explorerId: string;
  readonly rotated: boolean;
  readonly newRecoveryRegistered: boolean;
  readonly rotatedAt: string;
}

export interface AdjustLifetimeInput {
  readonly agentId: string;
  readonly delta: number;
  readonly reason: string;
  readonly finalTitle?: string;
}

export interface ConfirmPersonalityDriftInput {
  readonly driftId: string;
}

export interface ArchiveIdentityInput {
  readonly agentId: string;
  readonly archiveReason: string;
  readonly finalTitle?: string;
}

export interface ReincarnateInput {
  readonly previousAgentId: string;
  readonly identityName?: string;
  readonly maxLifetime?: number;
}

export interface ResourceInput {
  readonly agentId: string;
  readonly resourceId: EpochResourceId;
  readonly amount: number;
  readonly reason: string;
}

export interface AttributeInput extends AttributeGainInput {
  readonly agentId: string;
}

export interface RecordLoreContributionInput {
  readonly agentId: string;
  readonly category: EpochLoreContributionCategory;
  readonly targetId: string;
  readonly summary: string;
  readonly revisionMode?: EpochLoreRevisionMode | "direct_edit";
  readonly revisedClaimText?: string;
  readonly originalClaimExplorerId?: string;
  readonly parentClaimId?: string;
  readonly mergeTargetIds?: readonly string[];
  readonly downgradeReason?: string;
  readonly sourceEventIds?: readonly string[];
  readonly experimentId?: string;
  readonly mainRuleReview?: ExperimentMainRuleReview;
}

export type EpochCreatureBehaviorScopeReview = CreatureBehaviorScopeReview;
export type EpochFuzzyTimeIntervalReview = FuzzyTimeIntervalReview;
export type EpochCrossRegionMechanismReview = CrossRegionMechanismReview;

export interface EpochLoreContributionRecord {
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
  readonly experimentId?: string;
  readonly mainRuleReview?: ExperimentMainRuleReview;
  readonly creatureBehaviorScopeReview?: EpochCreatureBehaviorScopeReview;
  readonly fuzzyTimeIntervalReview?: EpochFuzzyTimeIntervalReview;
  readonly crossRegionMechanismReview?: EpochCrossRegionMechanismReview;
  readonly cost?: {
    readonly resourceId: EpochResourceId;
    readonly amount: number;
    readonly reason: string;
  };
  readonly recordedAt: string;
}

export interface RecordLoreTargetAdjudicationInput {
  readonly targetId: string;
  readonly status: EpochLoreAdjudicationStatus;
  readonly summary: string;
  readonly sourceContributionEventIds?: readonly string[];
  readonly canonCandidate?: {
    readonly requested?: boolean;
    readonly chapterReviewId?: string;
    readonly curatorApprovedBy?: string;
    readonly migrationSummary?: string;
    readonly adoptedText?: string;
    readonly boundaryNote?: string;
  };
}

export interface EpochLoreTargetAdjudication {
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

export interface SetDowntimeInput {
  readonly agentId: string;
  readonly mode: EpochDowntimeMode;
  readonly regionId?: string;
}

export interface ClaimDowntimeInput {
  readonly agentId: string;
}

export interface ChangeAgentCustodyInput {
  readonly agentId: string;
  readonly custodyStatus: "free" | "imprisoned";
  readonly reason?: string;
}

export interface TickDowntimeInput {
  readonly agentId?: string;
  readonly limit?: number;
}

export interface TickDowntimeResult {
  readonly tickedAt: string;
  readonly updated: readonly EpochDowntimeState[];
}

export interface CanonicalizeNpcInput {
  readonly displayName: string;
  readonly regionId: string;
  readonly traits?: readonly string[];
  readonly sourceEventId?: string;
}

export interface SubmitNpcCandidateInput {
  readonly agentId: string;
  readonly displayName: string;
  readonly regionId: string;
  readonly traits?: readonly string[];
  readonly storyEvidence: string;
  readonly sourceEventId?: string;
  readonly experimentId?: string;
  readonly mainRuleReview?: ExperimentMainRuleReview;
}

export interface SubmitNpcCandidateResult {
  readonly decision: EpochNpcCandidateDecision;
  readonly candidate: EpochNpcCandidate;
  readonly npc?: EpochNpcRecord;
}

export type { ReviewNpcCandidateResolution } from "./npcCandidateRules.ts";

export interface ReviewNpcCandidateInput {
  readonly candidateId: string;
  readonly resolution: ReviewNpcCandidateResolution;
  readonly note?: string;
}

export interface RecordNpcLifecycleInput {
  readonly npcId: string;
  readonly changes: Readonly<Record<string, NpcLifecycleValue>>;
  readonly sourceEventIds?: readonly string[];
}

export interface RecordNpcMemoryInput {
  readonly npcId: string;
  readonly summary: string;
  readonly importance?: EpochNpcMemoryImportance;
  readonly sourceEventIds?: readonly string[];
}

export interface TickNpcLifecycleInput {
  readonly regionId?: string;
  readonly limit?: number;
}

export interface TickNpcLifecycleResult {
  readonly tickedAt: string;
  readonly updated: readonly EpochNpcRecord[];
  readonly relationships: readonly EpochNpcRelationship[];
  readonly memories: readonly EpochNpcMemory[];
  readonly households: readonly EpochHousehold[];
  readonly organizationMemberships: readonly EpochOrganizationMembership[];
  readonly careers: readonly EpochNpcCareerRecord[];
  readonly locations: readonly EpochNpcLocationRecord[];
  readonly assetStates: readonly EpochNpcAssetState[];
  readonly healthStates: readonly EpochNpcHealthState[];
  readonly socialHooks: readonly EpochSocialHook[];
}

export interface TickOrganizationPoliticsInput {
  readonly regionId?: string;
  readonly limit?: number;
}

export interface TickOrganizationPoliticsResult {
  readonly tickedAt: string;
  readonly politics: readonly EpochOrganizationPoliticsRecord[];
}

export interface CreateOrganizationInput {
  readonly regionId: string;
  readonly displayName: string;
  readonly reason?: string;
  readonly sourceEventIds?: readonly string[];
}

export interface GenerateRegionNewsInput {
  readonly regionId: string;
  readonly headline: string;
  readonly body: string;
  readonly legendDelta?: number;
  readonly sourceEventIds: readonly string[];
}

export interface PostMessageInput {
  readonly agentId: string;
  readonly scope: EpochMessageScope;
  readonly regionId?: string;
  readonly body: string;
}

export interface ResolveModerationItemInput {
  readonly moderationId: string;
  readonly resolution: EpochModerationResolution;
  readonly note?: string;
}

export interface RecordRiskReviewInput {
  readonly sourceEventId: string;
  readonly resolution: EpochRiskReviewResolution;
  readonly note?: string;
}

export interface ReleaseMarketRiskRestrictionInput {
  readonly agentId: string;
  readonly note?: string;
}

export interface ReleaseAbuseRestrictionInput {
  readonly actorKey?: string;
  readonly agentId?: string;
  readonly explorerId?: string;
  readonly scoreAfter?: number;
  readonly note?: string;
}

export interface RecordCommandRejectedInput {
  readonly surface: "http" | "mcp";
  readonly command: string;
  readonly errorCode: string;
  readonly statusCode?: number;
  readonly actorKey?: string;
  readonly agentId?: string;
  readonly explorerId?: string;
  readonly inputSummary?: Readonly<Record<string, unknown>>;
}

export interface ClaimNewsLegendInput {
  readonly newsId: string;
  readonly agentId: string;
}

export interface CreateContestedObjectiveInput {
  readonly regionId: string;
  readonly title: string;
  readonly description?: string;
  readonly resourceId: EpochResourceId;
  readonly targetScore: number;
  readonly mode?: EpochObjectiveMode;
  readonly reward: EpochServerReward;
  readonly consolationReward?: EpochServerReward;
}

export interface ContributeContestedObjectiveInput {
  readonly objectiveId: string;
  readonly agentId: string;
  readonly amount: number;
}

export interface SettleContestedObjectiveInput {
  readonly objectiveId: string;
}

export interface CreateResourceNodeInput {
  readonly regionId: string;
  readonly title: string;
  readonly description?: string;
  readonly resourceId: EpochResourceId;
  readonly rewardAmount: number;
  readonly rewardReason?: string;
}

export interface ContestResourceNodeInput {
  readonly nodeId: string;
  readonly agentId: string;
  readonly staminaSpent: number;
}

export interface SettleResourceNodeInput {
  readonly nodeId: string;
}

export interface CreateAnomalyEventInput {
  readonly regionId: string;
  readonly sourceSeasonId?: string;
  readonly title: string;
  readonly description?: string;
  readonly media?: EpochAnomalyMedia;
  readonly severity?: EpochAnomalySeverity;
  readonly targetScore: number;
  readonly reward: EpochServerReward;
  readonly lifetimeRisk?: number;
}

export interface ContestAnomalyEventInput {
  readonly anomalyId: string;
  readonly agentId: string;
  readonly focusSpent: number;
}

export interface ResolveAnomalyEventInput {
  readonly anomalyId: string;
}

export interface CreateInventoryItemInput {
  readonly agentId: string;
  readonly itemKey: string;
  readonly displayName: string;
  readonly rarity?: string;
  readonly sourceEventIds: readonly string[];
}

export interface BindInventoryItemInput {
  readonly itemId: string;
  readonly agentId: string;
  readonly reason?: string;
}

export interface CraftInventoryItemInput {
  readonly agentId: string;
  readonly recipeId: string;
}

export interface PurchaseShopOfferInput {
  readonly agentId: string;
  readonly offerId: string;
  readonly regionId?: string;
}

export interface CreateSeasonCampaignInput {
  readonly seasonKey: string;
  readonly title: string;
  readonly description?: string;
  readonly regionIds: readonly string[];
  readonly factionIds: readonly string[];
  readonly resourceId: EpochResourceId;
  readonly targetScore: number;
  readonly reward: EpochServerReward;
  readonly objectives?: readonly EpochSeasonObjectiveTemplate[];
}

export interface ContributeSeasonCampaignInput {
  readonly seasonId: string;
  readonly agentId: string;
  readonly factionId: string;
  readonly amount: number;
}

export interface SettleSeasonCampaignInput {
  readonly seasonId: string;
}

export interface CreateMarketOrderInput {
  readonly sellerAgentId: string;
  readonly regionId?: string;
  readonly sellResourceId?: EpochResourceId;
  readonly sellAmount?: number;
  readonly sellItemId?: string;
  readonly priceResourceId: EpochResourceId;
  readonly priceAmount: number;
}

export interface FillMarketOrderInput {
  readonly orderId: string;
  readonly buyerAgentId: string;
}

export interface CancelMarketOrderInput {
  readonly orderId: string;
  readonly sellerAgentId: string;
}

export interface CreateDirectTradeInput {
  readonly proposerAgentId: string;
  readonly counterpartyAgentId: string;
  readonly regionId?: string;
  readonly offerResourceId?: EpochResourceId;
  readonly offerAmount?: number;
  readonly offerItemId?: string;
  readonly requestResourceId?: EpochResourceId;
  readonly requestAmount?: number;
  readonly requestItemId?: string;
}

export interface AcceptDirectTradeInput {
  readonly tradeId: string;
  readonly counterpartyAgentId: string;
}

export interface CancelDirectTradeInput {
  readonly tradeId: string;
  readonly proposerAgentId: string;
}

export interface TickDirectTradeExpiryInput {
  readonly maxAgeSeconds?: number;
  readonly limit?: number;
}

export interface TickDirectTradeExpiryResult {
  readonly tickedAt: string;
  readonly updated: readonly EpochDirectTrade[];
}

export interface TickMarketExpiryInput {
  readonly maxAgeSeconds?: number;
  readonly limit?: number;
}

export interface TickMarketExpiryResult {
  readonly tickedAt: string;
  readonly updated: readonly EpochMarketOrder[];
}

export interface CreateBountyInput {
  readonly sponsorAgentId: string;
  readonly regionId: string;
  readonly title: string;
  readonly description?: string;
  readonly rewardResourceId: EpochResourceId;
  readonly rewardAmount: number;
  readonly requiredItemKey?: string;
}

export interface ClaimBountyInput {
  readonly bountyId: string;
  readonly claimantAgentId: string;
  readonly fulfillmentItemId?: string;
  readonly evidence?: string;
}

export interface CreatePartyRunInput {
  readonly leaderAgentId: string;
  readonly regionId: string;
  readonly title: string;
  readonly objective: string;
  readonly participantRole?: EpochPartyRole;
  readonly joinPolicy?: EpochPartyRunJoinPolicy;
  readonly inviteToken?: string;
  readonly inviteTokenExpiresAt?: string;
  readonly inviteTokenUseLimit?: number;
  readonly inviteRecipientAgentId?: string;
}

export interface JoinPartyRunInput {
  readonly partyRunId: string;
  readonly agentId: string;
  readonly participantRole: EpochPartyRole;
  readonly inviteToken?: string;
}

export interface RequestPartyJoinInput {
  readonly partyRunId: string;
  readonly agentId: string;
  readonly participantRole: EpochPartyRole;
  readonly requestNote?: string;
}

export interface ResolvePartyJoinRequestInput {
  readonly partyRunId: string;
  readonly leaderAgentId: string;
  readonly requestId: string;
  readonly resolution: PartyJoinRequestResolution;
  readonly resolutionNote?: string;
}

export interface UpdatePartyInviteInput {
  readonly partyRunId: string;
  readonly leaderAgentId: string;
  readonly inviteToken?: string;
  readonly inviteTokenExpiresAt?: string;
  readonly inviteTokenUseLimit?: number;
  readonly inviteRecipientAgentId?: string;
  readonly revoke?: boolean;
}

export interface SettlePartyRunInput {
  readonly partyRunId: string;
}

export interface ResolveRaidInput {
  readonly regionId: string;
  readonly attackerAgentId: string;
  readonly defenderAgentId: string;
  readonly staminaSpent: number;
}

export interface ResolveRetaliationInput {
  readonly retaliationId: string;
  readonly opportunityAgentId: string;
  readonly staminaSpent: number;
}

export interface UpdateOrganizationMembershipInput {
  readonly agentId: string;
  readonly organizationId: string;
  readonly role?: string;
  readonly status?: EpochOrganizationMembershipStatus;
}

export interface PurchaseOrganizationUpgradeInput {
  readonly agentId: string;
  readonly organizationId: string;
  readonly upgradeKey: string;
}

export interface ContributeOrganizationTreasuryInput {
  readonly agentId: string;
  readonly organizationId: string;
  readonly resourceId: EpochResourceId;
  readonly amount: number;
}

export interface ProposeOrganizationBudgetInput {
  readonly agentId: string;
  readonly organizationId: string;
  readonly title: string;
  readonly description?: string;
  readonly resourceId: EpochResourceId;
  readonly amount: number;
}

export interface ResolveOrganizationBudgetInput {
  readonly agentId: string;
  readonly budgetId: string;
  readonly resolution: EpochOrganizationBudgetResolution | string;
  readonly note?: string;
}

export interface UpdateRelationshipInput {
  readonly sourceAgentId: string;
  readonly targetAgentId: string;
  readonly kind: EpochRelationshipKind;
  readonly focusSpent: number;
  readonly reason?: string;
}

export interface UpdateAgentNpcBondInput {
  readonly agentId: string;
  readonly npcId: string;
  readonly kind: EpochNpcRelationshipKind;
  readonly focusSpent: number;
  readonly reason?: string;
  readonly clientDeclaredScoreAfter?: number;
}

export interface ProposeDiplomacyInput {
  readonly regionId: string;
  readonly sourceAgentId: string;
  readonly targetAgentId: string;
  readonly kind: EpochRelationshipKind;
  readonly focusSpent: number;
  readonly terms?: string;
}

export interface RespondDiplomacyInput {
  readonly diplomacyId: string;
  readonly responderAgentId: string;
  readonly response: EpochDiplomacyResponse;
  readonly focusSpent?: number;
  readonly note?: string;
}

export interface CreateTurnCardInput {
  readonly agentId: string;
  readonly regionId: string;
  readonly prompt?: string;
  readonly target?: TraceConflictScopeTarget;
}

export interface DeployTraceConflictInput {
  readonly agentId: string;
  readonly templateKey: string;
  readonly regionId?: string;
  readonly target?: TraceConflictScopeTarget;
  readonly sourceEventIds?: readonly string[];
}

export interface TraceConflictOwnerViewInput {
  readonly agentId: string;
  readonly status?: TraceConflictStatus;
  readonly limit?: number;
}

export interface TraceConflictRegionViewInput {
  readonly regionId: string;
  readonly limit?: number;
}

export interface ResolveTurnCardInput {
  readonly turnCardId: string;
  readonly actionOptionId: string;
  readonly sequence: number;
  readonly nonce: string;
  readonly visibleText?: string;
}

export interface StartHostedSessionInput {
  readonly agentId: string;
  readonly regionId: string;
  readonly mandate?: string;
  readonly channelClass?: EpochChannelClass;
  readonly journeyScene?: JourneySceneContractSeed;
}

export interface SubmitHostedActionInput {
  readonly sessionId: string;
  readonly actionOptionId: string;
  readonly visibleText?: string;
  readonly journeyValidation?: {
    readonly journeyId: string;
    readonly episodeId: string;
    readonly expectedVersion: number;
  };
  readonly attestation?: {
    readonly attestationId: string;
    readonly runnerId: string;
    readonly runnerKeyId?: string;
    readonly challengeId: string;
    readonly transcriptHash: string;
    readonly signature: string;
    readonly signatureBase: string;
    readonly signatureBaseHash: string;
  };
}

export interface SolidifyJourneyWorldInput {
  readonly journeyId: string;
  readonly agentId: string;
  readonly regionId: string;
  readonly completedObjectiveIds: readonly string[];
  readonly requiredMainObjectiveIds: readonly string[];
  readonly mirrorStartedAtWorldTime: string;
  readonly mirrorEndedAtWorldTime: string;
  readonly committedAtWorldTime: string;
  readonly completionTier: "及格" | "良好" | "优秀" | "惊世";
  readonly completionScoreBps: number;
  readonly worldSliceHash?: `sha256:${string}`;
  /**
   * PR2 mirror-consequence ledger entries to promote at solidification. The
   * solidify path consumes the entries via {@link promoteMirrorConsequences}
   * and rebuilds canonical world events with stable event ids derived from
   * each entryId. An empty array is valid when the completed mirror journey
   * produced no collateral entries; the old direct-impact derivation is not
   * available on this path.
   *
   * Per-action `influenceScoreAfter` / `standingAfter` snapshots in the
   * entries reflect the region/faction score captured at submit time
   * (non-cumulative). The solidify path rebases these against the running
   * {@link workingProjection} so the promoted canonical events carry
   * cumulative baselines matching direct canonical planning; the submit-time
   * snapshots are observational only.
   *
   * Only `region_influence_delta`, `trace_created`, and
   * `faction_standing_delta` are supported. Every other effect kind
   * (including self-loss `resource_spent` / `lifetime_adjusted`) is
   * rejected up-front with `journey_mirror_ledger_kind_not_supported:*`
   * before any canonical events are constructed.
   */
  readonly mirrorLedgerEntries: readonly MirrorConsequenceLedgerEntry[];
  /** Canon threshold the score was compared against. */
  readonly canonThresholdBps: number;
  /** Settlement-policy version under which the solidify is adjudicated. */
  readonly settlementPolicyVersion: number;
  /** Consequence-score policy version used at solidify time. */
  readonly consequenceScorePolicyVersion: number;
  /** Settlement id linking this solidify to its SettlementDecision. */
  readonly settlementId: string;
  /** Per-bucket breakdown of the completion score, recorded on the marker. */
  readonly consequenceScoreBreakdown: {
    readonly resultScoreBps: number;
    readonly selfLossScoreBps: number;
    readonly collateralScoreBps: number;
  };
}

export interface QueueServerHostedJobInput {
  readonly agentId: string;
  readonly regionId: string;
  readonly mandate?: string;
  readonly optionKey: "observe" | "assist" | "anomaly";
  readonly visibleText?: string;
}

export interface CompleteServerHostedJobInput {
  readonly jobId: string;
  readonly sessionId: string;
  readonly actionId: string;
}

export interface SkipServerHostedJobInput {
  readonly jobId: string;
  readonly reason: "action_option_unavailable";
}

export interface CanRunServerHostedJobOptionInput {
  readonly agentId: string;
  readonly optionKey: "observe" | "assist" | "anomaly";
}
