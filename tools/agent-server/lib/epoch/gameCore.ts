import { type IpSimilarityAssessment } from "../ipSimilarity.ts";
import {
  type AbilityEffectCluster,
  type CanonCandidatePath,
  type CrossRegionMechanismReview,
  type CreatureBehaviorScopeReview,
  type EpochEvent,
  type EpochActionExplanation,
  type FuzzyTimeIntervalReview,
  type HostedActionOptionPayload,
  type HostedActionRisk,
  type HostedActionRecordedPayload,
  type HostedSessionStartedPayload,
  type JourneyWorldSolidifiedPayload,
  type ExperimentMainRuleReview,
  type NpcCandidateDecision,
  type NpcCandidateFlavorPublication,
  type NpcCandidateReviewFlag,
  type NpcCandidateReviewLevel,
  type NpcCandidateStatus,
  type NpcLifecycleValue,
  type OrganizationPrestigeChangedPayload,
  type OrganizationTreasuryChangedPayload,
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
  type ApproachTag,
  AFFINITY_MATRIX_VERSION,
  APPROACH_TAGS,
} from "./journeyStrategyRules.ts";
import type { ExpectedLifePattern } from "./journeyRoleplayRules.ts";
import {
  type IdentityViability,
  initialIdentityViability,
  LIFETIME_REASON_IDENTITY_VIABILITY_ACCELERATION,
  LIFETIME_REASON_IDENTITY_VIABILITY_SOCIAL_DEATH,
} from "./journeyViabilityRules.ts";
import { eventFactory } from "./eventFactory.ts";
import {
  causalEpochEventCanonicalJson,
} from "./causalEpochAdapter.ts";
import {
  advanceActorNeeds,
  initialActorLifeGoal,
  initialActorNeeds,
  type EpochActorLifeGoal,
  type EpochActorNeedsState,
} from "./actorNeedsRules.ts";
import {
  type EpochAnomalyMedia,
  type EpochAnomalyOutcome,
  type EpochAnomalySeverity,
  type EpochAttributeId,
  type EpochChannelClass,
  type EpochClock,
  type EpochCommandContext,
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
  assertDiplomacyResponse,
  assertModerationResolution,
  assertDowntimeMode,
  assertFiniteInteger,
  assertMessageScope,
  assertNonEmptyString,
  assertNpcRelationshipKind,
  assertNpcMemoryImportance,
  assertPositiveInteger,
  assertRelationshipKind,
  assertResourceId,
  assertRiskReviewResolution,
  createSequentialEpochIdFactory,
  normalizeTrustClass,
  serverIsoTime,
  stableKey,
} from "./protocol.ts";
import {
  DEFAULT_MAX_DOWNTIME_SECONDS,
  downtimeDiaryEntry,
  normalizeDowntimeRegionId,
  planDowntimeClaimEvents,
  planDowntimeSetEvents,
  planDowntimeTickEvents,
  previewEpochDowntime,
  projectDowntimeState,
  projectDowntimeTickResult,
  selectDowntimeTickAgentIds,
  type EpochDowntimeDiaryEntry,
  type EpochDowntimeDiaryPhase,
  type EpochDowntimeState,
  type EpochPendingDowntimePreview,
  type PreviewEpochDowntimeInput,
} from "./downtimeRules.ts";
import {
  buildDowntimeClaimEligibilitySnapshot,
  buildDowntimeEligibilitySnapshot,
  requireDowntimeClaimEligibility,
  requireDowntimeSetEligibility,
  requireDowntimeTickEligibility,
  type DowntimeRegionSafetyLevel,
} from "./downtimeEligibilityRules.ts";
export { previewEpochDowntime } from "./downtimeRules.ts";
export type {
  EpochDowntimeDiaryEntry,
  EpochDowntimeDiaryPhase,
  EpochDowntimeState,
  EpochPendingDowntimePreview,
  PreviewEpochDowntimeInput,
} from "./downtimeRules.ts";
import {
  anomalyPersonalityDriftTrait,
  openPersonalityDriftForAgent,
  personalityDriftCooldownActive,
  personalityDriftSourceEvent,
  planExplorerRecoveryRotationEvents,
  planIdentityArchiveEvents,
  planIdentityIssueEvents,
  planIdentityReincarnationEvents,
  planLifetimeAdjustmentEvents,
  planPersonalityDriftConfirmationEvents,
  planPersonalityDriftProposalEvents,
  projectExplorerRecoveryRotation,
  projectIdentityArchive,
  projectIdentityIssue,
  projectIdentityReincarnation,
  projectPersonalityDriftConfirmation,
  relationshipPersonalityDriftTrait,
} from "./identityLifecycleRules.ts";
import {
  normalizeItemRarity,
  normalizeShopRegionId,
  planCraftInventoryItemEvents,
  planInventoryItemBindEvents,
  planInventoryItemCreationEvents,
  planShopPurchaseEvents,
  projectCraftInventoryItem,
  projectInventoryItemBind,
  projectInventoryItemCreation,
  projectShopPurchaseItem,
  requireCraftRecipe,
  requireInventoryItem,
  requireShopOffer,
  resolveEpochShopOfferForRegion,
  type EpochShopOffer,
} from "./inventoryRules.ts";
export {
  EPOCH_SHOP_OFFERS,
  INVENTORY_CRAFT_RECIPES,
  INVENTORY_ITEM_EFFECTS,
  epochShopOffersForRegion,
  resolveEpochShopOfferForRegion,
} from "./inventoryRules.ts";
export type {
  EpochInventoryItemEffect,
  EpochShopCost,
  EpochShopOffer,
  InventoryCraftRecipe,
} from "./inventoryRules.ts";
import {
  copyBalance,
  currentBalance,
  planResourceGrantEvents,
  planResourceSpendEvents,
  projectResourceGrantBalance,
  projectResourceSpendBalance,
  resourceSpendPayloads,
} from "./resourceRules.ts";
import {
  copyAttributeScores,
  planAttributeGainEvents,
  projectAttributeGainBalance,
  type AttributeGainInput,
  type AttributeScoreBalance,
} from "./attributeRules.ts";
import {
  identitySlotsForExplorer,
  requireActiveIdentity,
  requireIdentity,
  requireIdentitySlot,
  type EpochIdentitySlotState,
} from "./identityProjectionRules.ts";
export { identitySlotsForExplorer } from "./identityProjectionRules.ts";
export type { EpochIdentitySlotState } from "./identityProjectionRules.ts";
import {
  assertClientIdentityOwner,
  assertIdentityOwner,
  assertIdentityOwnerOrSystemWorker,
  assertUserVerifiedIdentityOwner,
} from "./identityAuthorizationRules.ts";
import {
  planLegendAwardClaimEvents,
  projectLegendAwardClaim,
  requireRegionNews,
} from "./legendAwardRules.ts";
import {
  currentRegionInfluenceScore,
  latestTraceIdForRegion,
} from "./regionProjectionRules.ts";
import {
  addRegionActivitiesForEventRegions,
  addRegionActivity,
  addRegionActivityForEvent,
  type EpochRegionActivity,
} from "./regionActivityRules.ts";
export type {
  EpochRegionActivity,
  EpochRegionActivityKind,
  EpochRegionActivitySourceEventType,
} from "./regionActivityRules.ts";
import {
  itemTransferredEvent,
} from "./inventoryItemLedgerEvents.ts";
import { resourceSpentEvent } from "./resourceLedgerEvents.ts";
import {
  activeAgentOrganizationMembership,
  activeOrganizationMembershipForExplorer,
  activeOrganizationUpgradeIdsForAgentSeason,
  assertOrganizationBudgetResolution,
  assertOrganizationMembershipRole,
  assertOrganizationMembershipStatus,
  currentOrganizationTreasuryBalance,
  isOrganizationGovernanceRole,
  organizationBudgetApprovalThreshold,
  organizationBudgetDecisionStillPending,
  organizationBudgetRejectionThreshold,
  organizationBudgetRequiresVoteRecord,
  planOrganizationBudgetProposedEvents,
  planOrganizationBudgetResolutionEvents,
  planOrganizationCreatedEvents,
  planOrganizationMembershipChangedEvents,
  planOrganizationPoliticsTickEvents,
  planOrganizationTreasuryContributionEvents,
  planOrganizationUpgradePurchaseEvents,
  projectOrganizationPoliticsTickResult,
  requireOrganizationUpgradeCatalogEntry,
  selectOrganizationPoliticsTickTargets,
  type EpochOrganizationMembershipStatus,
  type EpochOrganizationUpgradeKey,
} from "./organizationTreasuryRules.ts";
export { EPOCH_ORGANIZATION_UPGRADE_CATALOG } from "./organizationTreasuryRules.ts";
export type {
  EpochOrganizationMembershipStatus,
  EpochOrganizationUpgradeCatalogEntry,
  EpochOrganizationUpgradeKey,
} from "./organizationTreasuryRules.ts";
import {
  RAID_PAIR_REWARD_DECAY_WINDOW_SECONDS,
  RAID_REGION_HEAT_REWARD_DECAY_SCORE,
  RAID_REGION_HEAT_REWARD_DECAY_WINDOW_SECONDS,
  assertPartyJoinRequestResolution,
  assertPartyRole,
  assertPartyRunJoinPolicy,
  optionalInviteToken,
  partyInviteTokenExpiresAt,
  partyInviteTokenHash,
  partyInviteTokenUseLimit,
  partyRunMemberSettlementResults,
  partyRunTotalScore,
  planPartyInviteUpdateEvents,
  planPartyJoinRequestEvents,
  planPartyJoinRequestResolutionEvents,
  planPartyMemberJoinEvents,
  planPartyRunCreationEvents,
  planPartyRunSettlementEvents,
  projectPartyInviteUpdate,
  projectPartyJoinRequest,
  projectPartyJoinRequestResolution,
  projectPartyMemberJoin,
  projectPartyRunCreation,
  raidBattleSettlement,
  latestRaidPairResolvedAt,
  planRaidResolutionEvents,
  planRetaliationResolutionEvents,
  projectRaidResolution,
  projectRetaliationResolution,
  raidRegionalHeatScoreDelta,
  raidPairResolvedCountSince,
  regionRaidHeatScoreSince,
  requireOpenPartyRun,
  requireOpenRetaliationOpportunity,
  requirePartyRun,
  retaliationBattleSettlement,
} from "./combatSettlementRules.ts";
export {
  MAX_PARTY_RUN_MEMBERS,
  RAID_PAIR_COOLDOWN_SECONDS,
} from "./combatSettlementRules.ts";
import {
  MAX_PARTY_RUN_MEMBERS,
  RAID_PAIR_COOLDOWN_SECONDS,
} from "./combatSettlementRules.ts";
import {
  assertRequiredPositiveInteger,
  deriveHostedDeliveryTrust,
  deriveHostedEventTrust,
  hasOpenTurnCardForAgent,
  hostedActionOptions,
  includeHighRiskOptions,
  isTurnCardExpiredAt,
  nextTurnCardSequence,
  planHostedActionSubmissionEvents,
  planHostedSessionStartEvents,
  planTurnCardCreationEvents,
  planTurnCardResolutionEvents,
  requireHostedTrust,
  requireServerHostedAgentTrust,
  requireTurnTrust,
  settledOutcomeSummary,
  settlementPolicy,
  turnActionOptions,
  turnOptionTemplate,
} from "./turnHostedActionRules.ts";
import {
  buildJourneySceneContract,
  journeySceneHostedActionOptions,
  type JourneySceneContract,
  type JourneySceneContractSeed,
  verifyJourneySceneActionSignature,
} from "./journeySceneContractRules.ts";
import {
  resolveJourneyAction,
  type JourneyActionResolution,
} from "./journeyActionResolutionRules.ts";
import { planJourneyWorldImpactEvents } from "./journeyWorldImpactRules.ts";
import type { JourneyWorldCommit } from "./journeyRules.ts";
import {
  planJourneyMirrorConsequenceBlueprints,
  planJourneyRoleplayDoubt,
} from "./journeyMirrorConsequenceBlueprints.ts";
import {
  buildCanonicalEventFromMirrorEntry,
} from "./journeyMirrorConsequenceIntegration.ts";
import {
  appendMirrorConsequence,
  assertNoDuplicatePromotion,
  deriveMirrorConsequenceEntryId,
  promoteMirrorConsequences,
  markMirrorConsequencePromoted,
  emptyMirrorConsequenceLedger,
  type MirrorConsequenceLedgerState,
} from "./journeyMirrorLedger.ts";
import type {
  ConsequenceEffectKind,
  MirrorConsequenceLedgerEntry,
} from "./journeySettlementRules.ts";
import {
  CANON_THRESHOLD_BPS,
  SETTLEMENT_POLICY_VERSION,
  CONSEQUENCE_SCORE_POLICY_VERSION,
} from "./journeySettlementRules.ts";
import {
  planServerHostedJobCompletedEvents,
  planServerHostedJobQueuedEvents,
  planServerHostedJobSkippedEvents,
} from "./serverHostedRuntimeRules.ts";
import {
  assertKnownSourceEvents,
  normalizeSourceEventIds,
  riskReviewAnalysisForEvent,
  riskReviewSourceEvent,
} from "./sourceEventRules.ts";
import {
  createLoreContributionProvenance,
  createLoreTargetAdjudicationProvenance,
  loreAuthorityReviewForSourceContributions,
  loreClaimHash,
  uniqueSortedValues,
} from "./loreProvenanceRules.ts";
import {
  assertLoreContributionCategory,
  assertLoreAdjudicationStatus,
  assertLoreRefutationDailyQuota,
  canonCandidatePathFromInput,
  creatureBehaviorScopeReviewFor,
  crossRegionMechanismReviewFor,
  experimentalArtifactReview,
  fuzzyTimeIntervalReviewFor,
  loreContributionCost,
  loreContributionCostSpendPayload,
  loreContributionRecordPayload,
  loreContributionRevisionFields,
  loreContributionSourceEventIds,
  loreContributionSourceEvents,
  planLoreContributionRecordEvents,
  planLoreTargetAdjudicationEvents,
  loreTargetAdjudicationHistory,
  loreTargetAdjudicationIds,
  loreTargetAdjudicationPayload,
  loreTargetAdjudicationStableKey,
  loreTargetSourceContributionEventIds,
  loreTargetSourceContributionEvents,
} from "./loreContributionRules.ts";
import {
  autoEscalatedRiskReviewPlan,
  contentStatusForResolution,
  normalizeMessageBody,
  planAbuseScoreDecayEvents,
  planAbuseScoreReleaseEvents,
  planMarketRiskRestrictionReleaseEvents,
  planMessagePostedEvents,
  planModerationResolvedEvents,
  planRegionNewsGenerationEvents,
  planRiskReviewRecordedEvents,
  projectAbuseScoreDecays,
  projectAbuseScoreRelease,
  projectGeneratedRegionNews,
  projectMarketRiskRestrictionRelease,
  projectModerationResolved,
  projectPostedMessage,
  projectRiskReviewRecorded,
  requireModerationItem,
  updateMessageModerationStatus,
  updateNewsModerationStatus,
} from "./moderationRiskRules.ts";
import {
  normalizeNpcCandidateReviewResolution,
  normalizeTraits,
  npcAbilityEffectCluster,
  npcCandidateReview,
  npcCandidateRumorAdmission,
  planNpcCandidateReviewedEvents,
  planNpcCandidateSubmittedEvents,
  planNpcCanonicalizedEvents,
  type ReviewNpcCandidateResolution,
} from "./npcCandidateRules.ts";
import {
  planNpcLifecycleRecordEvents,
  planNpcMemoryRecordEvents,
  planNpcLifecycleTickEvents,
  projectNpcLifecycleTickResult,
  selectLifecycleTickNpcs,
} from "./npcLifecycleRules.ts";
import {
  assertChildNpcBondAllowed,
  consumedSocialHookIdsForAgentRegion,
  diplomacySeed,
  planDiplomacyAcceptedRelationshipTraceEvents,
  planDiplomacyProposalEvents,
  planDiplomacyResponseEvents,
  relationshipUpdatedPayload,
  planAgentNpcBondUpdateEvents,
  planHostedSocialHookSideEffectEvents,
  planJourneyNpcRelationshipSolidificationEvents,
  planRelationshipUpdateEvents,
  isChildNpc,
} from "./agentInteractionRules.ts";
import {
  planTraceConflictDeployment,
  planTraceConflictTurn,
  traceConflictTemplateCatalog,
  type TraceConflictDeployment,
  type TraceConflictRumorMemory,
  type TraceConflictScopeTarget,
  type TraceConflictServerEffect,
  type TraceConflictStatus,
  type TraceConflictTemplateKey,
} from "./traceConflictRules.ts";
import {
  traceConflictMemoryView,
  traceConflictOwnerView,
  traceConflictRegionView,
  type TraceConflictMemoryView,
  type TraceConflictOwnerDeploymentView,
  type TraceConflictRegionView,
} from "./traceConflictReadModel.ts";
export { traceConflictTemplateCatalog } from "./traceConflictRules.ts";
export type {
  TraceConflictDeployment,
  TraceConflictStatus,
  TraceConflictTemplateKey,
} from "./traceConflictRules.ts";
export type {
  TraceConflictMemoryView,
  TraceConflictOwnerDeploymentView,
  TraceConflictRegionView,
} from "./traceConflictReadModel.ts";
import {
  planCommandRejectedEvents,
  projectCommandRejectedEvent,
} from "./commandAbuseRules.ts";
import {
  assertAnomalySeverity,
  normalizeAnomalyMedia,
  normalizeAnomalyReward,
  normalizeObjectiveReward,
  objectiveScoreDelta,
  openAnomalyEventForRegion,
  planAnomalyEventSpawnEvents,
  planAnomalyEventContestEvents,
  planAnomalyEventResolutionEvents,
  planContestedObjectiveCreationEvents,
  planContestedObjectiveContributionEvents,
  planContestedObjectiveSettlementEvents,
  planRaceCommissionCompletionEvents,
  projectAnomalyEventSpawn,
  projectAnomalyEventContest,
  projectAnomalyEventResolution,
  projectContestedObjectiveCreation,
  projectContestedObjectiveContribution,
  projectContestedObjectiveSettlement,
  requireActiveObjective,
  requireAnomalyEvent,
  requireOpenAnomalyEvent,
  requireObjective,
} from "./encounterRules.ts";
import {
  latestResourceNodeSettlementAt,
  openResourceNodeForRegion,
  planResourceNodeContestEvents,
  planResourceNodeSettlementEvents,
  planResourceNodeSpawnEvents,
  projectResourceNodeContest,
  projectResourceNodeSettlement,
  projectResourceNodeSpawn,
  requireOpenResourceNode,
  requireResourceNode,
  resourceNodeEquipmentBonus,
  resourceNodeSpawnCooldownRemainingSeconds,
} from "./resourceNodeRules.ts";
import {
  addSeasonTrustScore,
  agentSeasonStandingForRegion,
  dominantSeasonTrustClass,
  latestRegionControlReleaseEvent,
  normalizeSeasonTrustBreakdown,
  planRegionControlDecayEvents,
  planReleasedRegionControlClaimEvents,
  projectRegionControlDecays,
  projectReleasedRegionControlClaim,
  regionControlBonusRegionIdsForSeasonContribution,
  regionControlDecayAmount,
  planRegionRevoltResolutionEvents,
  projectRegionRevoltResolution,
  regionRevoltResolvedPayload,
  regionRevoltSettlement,
  planSeasonCampaignCreationEvents,
  planSeasonCampaignContributionEvents,
  planSeasonCampaignSettlementEvents,
  projectSeasonCampaignCreation,
  projectSeasonCampaignContribution,
  projectSeasonCampaignSettlement,
  requireActiveSeasonCampaign,
  requireSeasonCampaign,
  seasonCampaignSettlementPlan,
  type SeasonSettlementOrganizationInput,
  selectRegionControlDecayTargets,
  trustedSeasonScoreDelta,
} from "./seasonCampaignRules.ts";
import {
  assertMarketAgentNotRestricted,
  marketOrderGoodsGrantAsset,
  marketTradeRisk,
  marketExpiryMaxAgeSeconds,
  normalizeMarketRegionId,
  planMarketOrderCancellationEvents,
  planMarketOrderFillEvents,
  planMarketOrderCreationEvents,
  planMarketOrderExpiryEvents,
  projectMarketOrderCancellation,
  projectMarketOrderFill,
  projectMarketOrderCreation,
  projectMarketOrderExpiry,
  requireMarketOrder,
  requireOpenMarketOrder,
  selectExpiredMarketOrders,
} from "./marketTradeRules.ts";
import {
  directTradeAssetFromPayload,
  directTradeAssetLabel,
  directTradeItemAsset,
  planDirectTradeAcceptanceEvents,
  planDirectTradeCancellationEvents,
  planDirectTradeCreationEvents,
  planDirectTradeExpiryEvents,
  projectDirectTradeAcceptance,
  projectDirectTradeCancellation,
  projectDirectTradeCreation,
  projectDirectTradeExpiry,
  directTradeRequestedResourcePaymentAsset,
  directTradeResourceAsset,
  directTradeRisk,
  directTradeExpiryMaxAgeSeconds,
  requireDirectTrade,
  requireOpenDirectTrade,
  selectExpiredDirectTradeTargets,
} from "./directTradeRules.ts";
import {
  planBountyClaimEvents,
  planBountyCreationEvents,
  projectBountyClaim,
  projectBountyCreation,
  requireBounty,
  requireOpenBounty,
} from "./bountyRules.ts";

const TURN_CARD_TTL_MS = 15 * 60 * 1000;

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
}

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
   * remains the single in-memory truth. When omitted, mirror-mode journeys
   * produce no canonical collateral at action time (legacy behaviour).
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
   * PR2 mirror-consequence ledger entries to promote at solidification. When
   * supplied (non-empty), the solidify path consumes the entries via
   * {@link promoteMirrorConsequences} and rebuilds canonical world events
   * with stable event ids derived from each entryId. When omitted or empty,
   * the solidify path falls back to the legacy `planJourneyWorldImpactEvents`
   * derivation so older journeys and tests remain shape-equivalent.
   *
   * Per-action `influenceScoreAfter` / `standingAfter` snapshots in the
   * entries reflect the region/faction score captured at submit time
   * (non-cumulative). The solidify path rebases these against the running
   * {@link workingProjection} so the promoted canonical events carry
   * cumulative baselines matching the legacy path; the submit-time
   * snapshots are observational only.
   *
   * Only `region_influence_delta`, `trace_created`, and
   * `faction_standing_delta` are supported. Every other effect kind
   * (including self-loss `resource_spent` / `lifetime_adjusted`) is
   * rejected up-front with `journey_mirror_ledger_kind_not_supported:*`
   * before any canonical events are constructed.
   */
  readonly mirrorLedgerEntries?: readonly MirrorConsequenceLedgerEntry[];
  /**
   * PR4 additive. Canon threshold the score was compared against. Required
   * when settlementPolicyVersion is present; legacy callers omit it.
   * Authority validates this matches CANON_THRESHOLD_BPS_AT(policyVersion).
   */
  readonly canonThresholdBps?: number;
  /** PR4 additive. Settlement-policy version under which the solidify is adjudicated. */
  readonly settlementPolicyVersion?: number;
  /** PR4 additive. Consequence-score policy version used at solidify time. */
  readonly consequenceScorePolicyVersion?: number;
  /**
   * PR4 additive. Settlement id (idempotency key) linking this solidify to
   * its SettlementDecision. Required on PR4 solidifies.
   */
  readonly settlementId?: string;
  /**
   * PR4 additive. Per-bucket breakdown of the completion score, recorded
   * verbatim on the solidify marker for receipt audit. Required on PR4
   * solidifies.
   */
  readonly consequenceScoreBreakdown?: {
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

const DEFAULT_LIFETIME = 100;

function emptyProjection(): EpochProjection {
  return {
    events: [],
    identities: {},
    lineage: {},
    personalityDrifts: {},
    personalityDriftIdsByAgent: {},
    attributeScores: {},
    resourceBalances: {},
    downtime: {},
    agentCustody: {},
    downtimeDiaryEntries: {},
    downtimeDiaryIdsByAgent: {},
    regionActivities: {},
    regionActivityIdsByRegion: {},
    npcs: {},
    npcIdsByKey: {},
    npcCandidates: {},
    npcCandidateIdsByRegion: {},
    npcCandidateIdsByAgent: {},
    npcRelationships: {},
    npcRelationshipIdsByNpc: {},
    npcRelationshipIdsByRegion: {},
    agentNpcBonds: {},
    agentNpcBondIdsByAgent: {},
    agentNpcBondIdsByNpc: {},
    agentNpcBondIdsByRegion: {},
    npcMemories: {},
    npcMemoryIdsByNpc: {},
    npcMemoryIdsByRegion: {},
    households: {},
    householdIdsByNpc: {},
    householdIdsByRegion: {},
    organizations: {},
    organizationMemberships: {},
    organizationMembershipIdsByNpc: {},
    organizationMembershipIdsByAgent: {},
    organizationMembershipIdsByRegion: {},
    organizationMembershipIdsByOrganization: {},
    organizationPolitics: {},
    organizationPoliticsIdsByRegion: {},
    organizationPoliticsIdsByOrganization: {},
    organizationPoliticsIdsByNpc: {},
    organizationPoliticalStandingByOrganization: {},
    organizationTreasuryBalances: {},
    organizationUpgrades: {},
    organizationUpgradeIdsByOrganization: {},
    organizationBudgets: {},
    organizationBudgetIdsByOrganization: {},
    npcCareerRecords: {},
    npcCareerIdsByNpc: {},
    npcCareerIdsByRegion: {},
    npcLocationRecords: {},
    npcLocationIdsByNpc: {},
    npcLocationIdsByRegion: {},
    npcAssetStates: {},
    npcAssetIdsByNpc: {},
    npcAssetIdsByRegion: {},
    npcAssetBalancesByNpc: {},
    npcHealthStates: {},
    npcHealthIdsByNpc: {},
    npcHealthIdsByRegion: {},
    inventoryItems: {},
    inventoryItemIdsByAgent: {},
    inventoryItemIdsByExplorer: {},
    socialHooks: {},
    socialHookIdsByRegion: {},
    socialHookIdsByNpc: {},
    regionNews: {},
    worldMessages: [],
    regionMessages: {},
    moderationItems: {},
    riskReviews: {},
    riskReviewIdsBySourceEvent: {},
    riskReviewIdsByAgent: {},
    legendAwards: {},
    legendAwardIdsByNews: {},
    legendAwardIdsByAgent: {},
    contestedObjectives: {},
    objectiveIdsByRegion: {},
    resourceNodes: {},
    resourceNodeIdsByRegion: {},
    anomalyEvents: {},
    anomalyEventIdsByRegion: {},
    seasonCampaigns: {},
    seasonObjectives: {},
    seasonObjectiveIdsBySeason: {},
    seasonCampaignIdsByRegion: {},
    seasonCampaignIdsByFaction: {},
    agentFactionStandings: {},
    factionStandingIdsByAgent: {},
    factionStandingIdsByFaction: {},
    regionInfluenceChanges: {},
    regionInfluenceIdsByRegion: {},
    regionInfluenceIdsByAgent: {},
    conflictTraces: {},
    traceIdsByRegion: {},
    traceIdsByAgent: {},
    regionControls: {},
    regionMonuments: {},
    regionMonumentIdsByRegion: {},
    marketOrders: {},
    directTrades: {},
    marketRiskRestrictions: {},
    marketRiskRestrictionReleases: {},
    bounties: {},
    bountyIdsByRegion: {},
    bountyIdsByAgent: {},
    partyRuns: {},
    partyRunIdsByRegion: {},
    raidResults: {},
    raidIdsByRegion: {},
    retaliationOpportunities: {},
    retaliationIdsByRegion: {},
    retaliationIdsByAgent: {},
    diplomacyRecords: {},
    diplomacyIdsByRegion: {},
    diplomacyIdsByAgent: {},
    relationshipEdges: {},
    relationshipIdsByAgent: {},
    turnCards: {},
    hostedSessions: {},
    serverHostedJobs: {},
    serverHostedJobIdsByAgent: {},
    attestationRecords: {},
    abuseScores: {},
  };
}

function uniqueValues(values: readonly string[]): string[] {
  return values.filter((value, index) => value && values.indexOf(value) === index);
}

/**
 * PR5b fix: collect the mission-sanctioned approach palette for a scene
 * contract's actionOptions. Returns the union of every actionOption's
 * `approachTags`, filtered against the canonical {@link APPROACH_TAGS}
 * universe (defence-in-depth so a malformed option cannot introduce an
 * unknown string into the set). The result is passed to
 * {@link planJourneyRoleplayDoubt} as `missionSanctionedApproaches`, where
 * it drives the mission-aligned override (spec §6.9): an action whose
 * observed tags are all sanctioned is classified 'aligned' and emits no
 * doubt, so a combat-role identity on a support mission is not penalised
 * for doing exactly what the mission offered.
 *
 * The returned array is reordered against APPROACH_TAGS so the set is
 * canonical and stable across actionOptions iteration order. Empty when
 * the scene carries no approachTags (legacy contracts).
 */
function collectSceneMissionSanctionedApproaches(
  actionOptions: readonly { readonly approachTags?: readonly ApproachTag[] }[],
): readonly ApproachTag[] {
  const sanctioned = new Set<ApproachTag>();
  for (const option of actionOptions) {
    if (!option.approachTags) continue;
    for (const tag of option.approachTags) {
      // Defence-in-depth: only canonical APPROACH_TAGS members enter the
      // set. The persisted arrays already only contain valid tags; this
      // guard exists so a future caller cannot corrupt the override.
      for (const canonical of APPROACH_TAGS) {
        if (tag === canonical) {
          sanctioned.add(tag);
          break;
        }
      }
    }
  }
  if (sanctioned.size === 0) return [];
  return APPROACH_TAGS.filter((tag) => sanctioned.has(tag));
}

function currentProjectionWorldMinute(projection: EpochProjection): number {
  for (let index = projection.events.length - 1; index >= 0; index -= 1) {
    const event = projection.events[index];
    if (event?.eventType === "world_clock_advanced") return event.payload.toWorldMinute;
  }
  return 0;
}

function currentAgentFactionStandingScore(
  projection: EpochProjection,
  agentId: string,
  factionId: string | undefined,
): number {
  if (!factionId) return 0;
  return (projection.factionStandingIdsByAgent[agentId] || [])
    .map((standingId) => projection.agentFactionStandings[standingId])
    .find((standing) => standing?.factionId === factionId)?.score ?? 0;
}

/**
 * Effect kinds the PR2 solidify mirror path supports. Region influence,
 * trace creation, and faction standing are the only kinds
 * {@link buildCanonicalEventFromMirrorEntry} knows how to promote; every
 * other kind (including self-loss `resource_spent` / `lifetime_adjusted`
 * and the relationship/object/identity kinds reserved for later PRs) is
 * rejected up-front in {@link solidifyJourneyWorld} so the error surface
 * is consistent (all unsupported kinds fail before any canonical event
 * is constructed).
 */
const SUPPORTED_MIRROR_EFFECT_KINDS: ReadonlySet<ConsequenceEffectKind> = new Set<ConsequenceEffectKind>([
  "region_influence_delta",
  "trace_created",
  "faction_standing_delta",
]);

/**
 * Read a string field from a mirror-consequence blueprint. The blueprint
 * shape is contract-guaranteed by
 * {@link planJourneyMirrorConsequenceBlueprints} but typed as
 * `Record<string, unknown>` so the ledger stays shape-agnostic; this
 * helper narrows to `string` for the rebasing maths below.
 */
function readBlueprintString(
  entry: MirrorConsequenceLedgerEntry,
  key: string,
): string {
  const value = entry.effectBlueprint[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`journey_mirror_solidify_blueprint_field_invalid:${key}`);
  }
  return value;
}

/**
 * Rebase a mirror-consequence entry's score snapshots against the running
 * {@link EpochProjection} so multi-objective journeys produce cumulative
 * baselines matching the legacy {@link planJourneyWorldImpactEvents} path.
 *
 * Mirror-mode `submitHostedAction` captures `influenceScoreAfter` /
 * `standingAfter` per-action at submit time without visibility into prior
 * objectives' canonical influence deltas (mirror-mode submit emits no
 * canonical collateral). Solidify is the single point where the canonical
 * world events commit, so the projection-derived baseline overrides the
 * submit-time snapshot here.
 *
 * - `region_influence_delta`: `influenceScoreAfter` becomes
 *   `currentRegionInfluenceScore(projection, regionId, agentId) + delta`.
 * - `faction_standing_delta`: `standingAfter` is recomputed as
 *   `min(10_000, clamp(-10_000, 10_000, floor(currentScore)) + delta)`,
 *   mirroring the cap logic in {@link planJourneyWorldImpactEvents}.
 * - `trace_created`: no score baseline on this kind; returned unchanged.
 */
function rebaseMirrorEntryAgainstProjection(
  entry: MirrorConsequenceLedgerEntry,
  projection: EpochProjection,
): MirrorConsequenceLedgerEntry {
  if (entry.effectKind === "region_influence_delta") {
    const regionId = readBlueprintString(entry, "regionId");
    const agentId = readBlueprintString(entry, "agentId");
    const influenceScoreAfter = currentRegionInfluenceScore(projection, regionId, agentId) + entry.delta;
    return {
      ...entry,
      effectBlueprint: { ...entry.effectBlueprint, influenceScoreAfter },
    };
  }
  if (entry.effectKind === "faction_standing_delta") {
    const agentId = readBlueprintString(entry, "agentId");
    const factionId = readBlueprintString(entry, "factionId");
    const standingBefore = Math.max(
      -10_000,
      Math.min(10_000, Math.floor(currentAgentFactionStandingScore(projection, agentId, factionId))),
    );
    const standingAfter = Math.min(10_000, standingBefore + entry.delta);
    return {
      ...entry,
      effectBlueprint: { ...entry.effectBlueprint, standingAfter },
    };
  }
  return entry;
}

function journeyWorldCommitFromMarker(
  event: Extract<EpochEvent, { readonly eventType: "journey_world_solidified" }>,
): JourneyWorldCommit {
  const payload = event.payload as JourneyWorldSolidifiedPayload;
  // PR4: when the marker carries a settlementPolicyVersion, the commit must
  // expose the PR4 reason string ("main_completed_and_above_threshold") so
  // recordJourneyWorldCommit's PR4 invariant check passes. Legacy markers
  // keep "main_completed_and_returned".
  const isPr4Marker = payload.settlementPolicyVersion !== undefined;
  return {
    mode: "mirror",
    status: "solidified",
    reason: isPr4Marker ? "main_completed_and_above_threshold" : "main_completed_and_returned",
    regionId: payload.regionId,
    committedAtWorldTime: payload.committedAtWorldTime ?? payload.mirrorEndedAtWorldTime,
    influenceDelta: payload.influenceDelta,
    factionStandings: payload.factionStandings,
    npcRelationships: payload.npcRelationships,
    commitEventId: event.eventId,
    sourceEventIds: [...payload.effectEventIds, event.eventId],
    // PR4 additive fields, passed through verbatim so the persisted commit
    // carries the same receipt-audit data as the marker.
    ...(payload.completionScoreBps !== undefined ? { completionScoreBps: payload.completionScoreBps } : {}),
    ...(payload.canonThresholdBps !== undefined ? { canonThresholdBps: payload.canonThresholdBps } : {}),
    ...(payload.settlementPolicyVersion !== undefined ? { settlementPolicyVersion: payload.settlementPolicyVersion } : {}),
    ...(payload.consequenceScorePolicyVersion !== undefined ? { consequenceScorePolicyVersion: payload.consequenceScorePolicyVersion } : {}),
    ...(payload.strategyPolicyVersion !== undefined ? { strategyPolicyVersion: payload.strategyPolicyVersion } : {}),
    ...(payload.questOfferId !== undefined ? { questOfferId: payload.questOfferId } : {}),
    ...(payload.offerHash !== undefined ? { offerHash: payload.offerHash } : {}),
    ...(payload.settlementId !== undefined ? { settlementId: payload.settlementId } : {}),
    ...(payload.consequenceScoreBreakdown !== undefined ? { consequenceScoreBreakdown: payload.consequenceScoreBreakdown } : {}),
  };
}

function applyEvent(projection: EpochProjection, event: EpochEvent): EpochProjection {
  const identities = { ...projection.identities };
  const lineage: Record<string, string[]> = Object.fromEntries(
    Object.entries(projection.lineage).map(([explorerId, agentIds]) => [explorerId, [...agentIds]]),
  );
  const personalityDrifts = { ...projection.personalityDrifts };
  const personalityDriftIdsByAgent: Record<string, string[]> = Object.fromEntries(
    Object.entries(projection.personalityDriftIdsByAgent).map(([agentId, driftIds]) => [agentId, [...driftIds]]),
  );
  const attributeScores: Record<string, AttributeScoreBalance> = Object.fromEntries(
    Object.entries(projection.attributeScores).map(([agentId, scores]) => [agentId, copyAttributeScores(scores)]),
  );
  const resourceBalances = { ...projection.resourceBalances };
  const downtime = { ...projection.downtime };
  const agentCustody = { ...projection.agentCustody };
  const downtimeDiaryEntries = { ...projection.downtimeDiaryEntries };
  const downtimeDiaryIdsByAgent: Record<string, string[]> = Object.fromEntries(
    Object.entries(projection.downtimeDiaryIdsByAgent).map(([agentId, diaryIds]) => [agentId, [...diaryIds]]),
  );
  const regionActivities = { ...projection.regionActivities };
  const regionActivityIdsByRegion: Record<string, string[]> = Object.fromEntries(
    Object.entries(projection.regionActivityIdsByRegion).map(([regionId, activityIds]) => [regionId, [...activityIds]]),
  );
  const npcs = { ...projection.npcs };
  const npcIdsByKey = { ...projection.npcIdsByKey };
  const npcCandidates = { ...projection.npcCandidates };
  const npcCandidateIdsByRegion: Record<string, string[]> = Object.fromEntries(
    Object.entries(projection.npcCandidateIdsByRegion).map(([regionId, candidateIds]) => [regionId, [...candidateIds]]),
  );
  const npcCandidateIdsByAgent: Record<string, string[]> = Object.fromEntries(
    Object.entries(projection.npcCandidateIdsByAgent).map(([agentId, candidateIds]) => [agentId, [...candidateIds]]),
  );
  const npcRelationships = { ...projection.npcRelationships };
  const npcRelationshipIdsByNpc: Record<string, string[]> = Object.fromEntries(
    Object.entries(projection.npcRelationshipIdsByNpc).map(([npcId, relationshipIds]) => [npcId, [...relationshipIds]]),
  );
  const npcRelationshipIdsByRegion: Record<string, string[]> = Object.fromEntries(
    Object.entries(projection.npcRelationshipIdsByRegion).map(([regionId, relationshipIds]) => [regionId, [...relationshipIds]]),
  );
  const agentNpcBonds = { ...projection.agentNpcBonds };
  const agentNpcBondIdsByAgent: Record<string, string[]> = Object.fromEntries(
    Object.entries(projection.agentNpcBondIdsByAgent).map(([agentId, bondIds]) => [agentId, [...bondIds]]),
  );
  const agentNpcBondIdsByNpc: Record<string, string[]> = Object.fromEntries(
    Object.entries(projection.agentNpcBondIdsByNpc).map(([npcId, bondIds]) => [npcId, [...bondIds]]),
  );
  const agentNpcBondIdsByRegion: Record<string, string[]> = Object.fromEntries(
    Object.entries(projection.agentNpcBondIdsByRegion).map(([regionId, bondIds]) => [regionId, [...bondIds]]),
  );
  const npcMemories = { ...projection.npcMemories };
  const npcMemoryIdsByNpc: Record<string, string[]> = Object.fromEntries(
    Object.entries(projection.npcMemoryIdsByNpc).map(([npcId, memoryIds]) => [npcId, [...memoryIds]]),
  );
  const npcMemoryIdsByRegion: Record<string, string[]> = Object.fromEntries(
    Object.entries(projection.npcMemoryIdsByRegion).map(([regionId, memoryIds]) => [regionId, [...memoryIds]]),
  );
  const households = { ...projection.households };
  const householdIdsByNpc: Record<string, string[]> = Object.fromEntries(
    Object.entries(projection.householdIdsByNpc).map(([npcId, householdIds]) => [npcId, [...householdIds]]),
  );
  const householdIdsByRegion: Record<string, string[]> = Object.fromEntries(
    Object.entries(projection.householdIdsByRegion).map(([regionId, householdIds]) => [regionId, [...householdIds]]),
  );
  const organizations = { ...projection.organizations };
  const organizationMemberships = { ...projection.organizationMemberships };
  const organizationMembershipIdsByNpc: Record<string, string[]> = Object.fromEntries(
    Object.entries(projection.organizationMembershipIdsByNpc).map(([npcId, membershipIds]) => [npcId, [...membershipIds]]),
  );
  const organizationMembershipIdsByAgent: Record<string, string[]> = Object.fromEntries(
    Object.entries(projection.organizationMembershipIdsByAgent).map(([agentId, membershipIds]) => [agentId, [...membershipIds]]),
  );
  const organizationMembershipIdsByRegion: Record<string, string[]> = Object.fromEntries(
    Object.entries(projection.organizationMembershipIdsByRegion).map(([regionId, membershipIds]) => [regionId, [...membershipIds]]),
  );
  const organizationMembershipIdsByOrganization: Record<string, string[]> = Object.fromEntries(
    Object.entries(projection.organizationMembershipIdsByOrganization).map(([organizationId, membershipIds]) => [organizationId, [...membershipIds]]),
  );
  const organizationPolitics = { ...projection.organizationPolitics };
  const organizationPoliticsIdsByRegion: Record<string, string[]> = Object.fromEntries(
    Object.entries(projection.organizationPoliticsIdsByRegion).map(([regionId, politicsIds]) => [regionId, [...politicsIds]]),
  );
  const organizationPoliticsIdsByOrganization: Record<string, string[]> = Object.fromEntries(
    Object.entries(projection.organizationPoliticsIdsByOrganization).map(([organizationId, politicsIds]) => [organizationId, [...politicsIds]]),
  );
  const organizationPoliticsIdsByNpc: Record<string, string[]> = Object.fromEntries(
    Object.entries(projection.organizationPoliticsIdsByNpc).map(([npcId, politicsIds]) => [npcId, [...politicsIds]]),
  );
  const organizationPoliticalStandingByOrganization = { ...projection.organizationPoliticalStandingByOrganization };
  const organizationTreasuryBalances: Record<string, Partial<Record<EpochResourceId, number>>> = Object.fromEntries(
    Object.entries(projection.organizationTreasuryBalances).map(([organizationId, balance]) => [organizationId, copyBalance(balance)]),
  );
  const organizationUpgrades = { ...projection.organizationUpgrades };
  const organizationUpgradeIdsByOrganization: Record<string, string[]> = Object.fromEntries(
    Object.entries(projection.organizationUpgradeIdsByOrganization).map(([organizationId, upgradeIds]) => [organizationId, [...upgradeIds]]),
  );
  const organizationBudgets = { ...projection.organizationBudgets };
  const organizationBudgetIdsByOrganization: Record<string, string[]> = Object.fromEntries(
    Object.entries(projection.organizationBudgetIdsByOrganization).map(([organizationId, budgetIds]) => [organizationId, [...budgetIds]]),
  );
  const npcCareerRecords = { ...projection.npcCareerRecords };
  const npcCareerIdsByNpc: Record<string, string[]> = Object.fromEntries(
    Object.entries(projection.npcCareerIdsByNpc).map(([npcId, careerIds]) => [npcId, [...careerIds]]),
  );
  const npcCareerIdsByRegion: Record<string, string[]> = Object.fromEntries(
    Object.entries(projection.npcCareerIdsByRegion).map(([regionId, careerIds]) => [regionId, [...careerIds]]),
  );
  const npcLocationRecords = { ...projection.npcLocationRecords };
  const npcLocationIdsByNpc: Record<string, string[]> = Object.fromEntries(
    Object.entries(projection.npcLocationIdsByNpc).map(([npcId, locationIds]) => [npcId, [...locationIds]]),
  );
  const npcLocationIdsByRegion: Record<string, string[]> = Object.fromEntries(
    Object.entries(projection.npcLocationIdsByRegion).map(([regionId, locationIds]) => [regionId, [...locationIds]]),
  );
  const npcAssetStates = { ...projection.npcAssetStates };
  const npcAssetIdsByNpc: Record<string, string[]> = Object.fromEntries(
    Object.entries(projection.npcAssetIdsByNpc).map(([npcId, assetIds]) => [npcId, [...assetIds]]),
  );
  const npcAssetIdsByRegion: Record<string, string[]> = Object.fromEntries(
    Object.entries(projection.npcAssetIdsByRegion).map(([regionId, assetIds]) => [regionId, [...assetIds]]),
  );
  const npcAssetBalancesByNpc: Record<string, Record<string, number>> = Object.fromEntries(
    Object.entries(projection.npcAssetBalancesByNpc).map(([npcId, balances]) => [npcId, { ...balances }]),
  );
  const npcHealthStates = { ...projection.npcHealthStates };
  const npcHealthIdsByNpc: Record<string, string[]> = Object.fromEntries(
    Object.entries(projection.npcHealthIdsByNpc).map(([npcId, healthIds]) => [npcId, [...healthIds]]),
  );
  const npcHealthIdsByRegion: Record<string, string[]> = Object.fromEntries(
    Object.entries(projection.npcHealthIdsByRegion).map(([regionId, healthIds]) => [regionId, [...healthIds]]),
  );
  const inventoryItems = { ...projection.inventoryItems };
  const inventoryItemIdsByAgent: Record<string, string[]> = Object.fromEntries(
    Object.entries(projection.inventoryItemIdsByAgent).map(([agentId, itemIds]) => [agentId, [...itemIds]]),
  );
  const inventoryItemIdsByExplorer: Record<string, string[]> = Object.fromEntries(
    Object.entries(projection.inventoryItemIdsByExplorer).map(([explorerId, itemIds]) => [explorerId, [...itemIds]]),
  );
  const socialHooks = { ...projection.socialHooks };
  const socialHookIdsByRegion: Record<string, string[]> = Object.fromEntries(
    Object.entries(projection.socialHookIdsByRegion).map(([regionId, hookIds]) => [regionId, [...hookIds]]),
  );
  const socialHookIdsByNpc: Record<string, string[]> = Object.fromEntries(
    Object.entries(projection.socialHookIdsByNpc).map(([npcId, hookIds]) => [npcId, [...hookIds]]),
  );
  const regionNews: Record<string, EpochRegionNews[]> = Object.fromEntries(
    Object.entries(projection.regionNews).map(([regionId, news]) => [regionId, [...news]]),
  );
  const worldMessages = [...projection.worldMessages];
  const regionMessages: Record<string, EpochMessageRecord[]> = Object.fromEntries(
    Object.entries(projection.regionMessages).map(([regionId, messages]) => [regionId, [...messages]]),
  );
  const moderationItems = { ...projection.moderationItems };
  const riskReviews = { ...projection.riskReviews };
  const riskReviewIdsBySourceEvent: Record<string, string[]> = Object.fromEntries(
    Object.entries(projection.riskReviewIdsBySourceEvent).map(([eventId, reviewIds]) => [eventId, [...reviewIds]]),
  );
  const riskReviewIdsByAgent: Record<string, string[]> = Object.fromEntries(
    Object.entries(projection.riskReviewIdsByAgent).map(([agentId, reviewIds]) => [agentId, [...reviewIds]]),
  );
  const legendAwards = { ...projection.legendAwards };
  const legendAwardIdsByNews: Record<string, string[]> = Object.fromEntries(
    Object.entries(projection.legendAwardIdsByNews).map(([newsId, awardIds]) => [newsId, [...awardIds]]),
  );
  const legendAwardIdsByAgent: Record<string, string[]> = Object.fromEntries(
    Object.entries(projection.legendAwardIdsByAgent).map(([agentId, awardIds]) => [agentId, [...awardIds]]),
  );
  const contestedObjectives = { ...projection.contestedObjectives };
  const objectiveIdsByRegion: Record<string, string[]> = Object.fromEntries(
    Object.entries(projection.objectiveIdsByRegion).map(([regionId, objectiveIds]) => [regionId, [...objectiveIds]]),
  );
  const resourceNodes = { ...projection.resourceNodes };
  const resourceNodeIdsByRegion: Record<string, string[]> = Object.fromEntries(
    Object.entries(projection.resourceNodeIdsByRegion).map(([regionId, nodeIds]) => [regionId, [...nodeIds]]),
  );
  const anomalyEvents = { ...projection.anomalyEvents };
  const anomalyEventIdsByRegion: Record<string, string[]> = Object.fromEntries(
    Object.entries(projection.anomalyEventIdsByRegion).map(([regionId, anomalyIds]) => [regionId, [...anomalyIds]]),
  );
  const seasonCampaigns = { ...projection.seasonCampaigns };
  const seasonObjectives = { ...projection.seasonObjectives };
  const seasonObjectiveIdsBySeason: Record<string, string[]> = Object.fromEntries(
    Object.entries(projection.seasonObjectiveIdsBySeason).map(([seasonId, objectiveIds]) => [seasonId, [...objectiveIds]]),
  );
  const seasonCampaignIdsByRegion: Record<string, string[]> = Object.fromEntries(
    Object.entries(projection.seasonCampaignIdsByRegion).map(([regionId, seasonIds]) => [regionId, [...seasonIds]]),
  );
  const seasonCampaignIdsByFaction: Record<string, string[]> = Object.fromEntries(
    Object.entries(projection.seasonCampaignIdsByFaction).map(([factionId, seasonIds]) => [factionId, [...seasonIds]]),
  );
  const agentFactionStandings = { ...projection.agentFactionStandings };
  const factionStandingIdsByAgent: Record<string, string[]> = Object.fromEntries(
    Object.entries(projection.factionStandingIdsByAgent).map(([agentId, standingIds]) => [agentId, [...standingIds]]),
  );
  const factionStandingIdsByFaction: Record<string, string[]> = Object.fromEntries(
    Object.entries(projection.factionStandingIdsByFaction).map(([factionId, standingIds]) => [factionId, [...standingIds]]),
  );
  const regionInfluenceChanges = { ...projection.regionInfluenceChanges };
  const regionInfluenceIdsByRegion: Record<string, string[]> = Object.fromEntries(
    Object.entries(projection.regionInfluenceIdsByRegion).map(([regionId, influenceIds]) => [regionId, [...influenceIds]]),
  );
  const regionInfluenceIdsByAgent: Record<string, string[]> = Object.fromEntries(
    Object.entries(projection.regionInfluenceIdsByAgent).map(([agentId, influenceIds]) => [agentId, [...influenceIds]]),
  );
  const conflictTraces = { ...projection.conflictTraces };
  const traceIdsByRegion: Record<string, string[]> = Object.fromEntries(
    Object.entries(projection.traceIdsByRegion).map(([regionId, traceIds]) => [regionId, [...traceIds]]),
  );
  const traceIdsByAgent: Record<string, string[]> = Object.fromEntries(
    Object.entries(projection.traceIdsByAgent).map(([agentId, traceIds]) => [agentId, [...traceIds]]),
  );
  const regionControls = { ...projection.regionControls };
  const regionMonuments = { ...projection.regionMonuments };
  const regionMonumentIdsByRegion: Record<string, string[]> = Object.fromEntries(
    Object.entries(projection.regionMonumentIdsByRegion).map(([regionId, monumentIds]) => [regionId, [...monumentIds]]),
  );
  const marketOrders = { ...projection.marketOrders };
  const directTrades = { ...projection.directTrades };
  const marketRiskRestrictions = { ...projection.marketRiskRestrictions };
  const marketRiskRestrictionReleases = { ...projection.marketRiskRestrictionReleases };
  const bounties = { ...projection.bounties };
  const bountyIdsByRegion: Record<string, string[]> = Object.fromEntries(
    Object.entries(projection.bountyIdsByRegion).map(([regionId, bountyIds]) => [regionId, [...bountyIds]]),
  );
  const bountyIdsByAgent: Record<string, string[]> = Object.fromEntries(
    Object.entries(projection.bountyIdsByAgent).map(([agentId, bountyIds]) => [agentId, [...bountyIds]]),
  );
  const partyRuns = { ...projection.partyRuns };
  const partyRunIdsByRegion: Record<string, string[]> = Object.fromEntries(
    Object.entries(projection.partyRunIdsByRegion).map(([regionId, partyRunIds]) => [regionId, [...partyRunIds]]),
  );
  const raidResults = { ...projection.raidResults };
  const raidIdsByRegion: Record<string, string[]> = Object.fromEntries(
    Object.entries(projection.raidIdsByRegion).map(([regionId, raidIds]) => [regionId, [...raidIds]]),
  );
  const retaliationOpportunities = { ...projection.retaliationOpportunities };
  const retaliationIdsByRegion: Record<string, string[]> = Object.fromEntries(
    Object.entries(projection.retaliationIdsByRegion).map(([regionId, retaliationIds]) => [regionId, [...retaliationIds]]),
  );
  const retaliationIdsByAgent: Record<string, string[]> = Object.fromEntries(
    Object.entries(projection.retaliationIdsByAgent).map(([agentId, retaliationIds]) => [agentId, [...retaliationIds]]),
  );
  const diplomacyRecords = { ...projection.diplomacyRecords };
  const diplomacyIdsByRegion: Record<string, string[]> = Object.fromEntries(
    Object.entries(projection.diplomacyIdsByRegion).map(([regionId, diplomacyIds]) => [regionId, [...diplomacyIds]]),
  );
  const diplomacyIdsByAgent: Record<string, string[]> = Object.fromEntries(
    Object.entries(projection.diplomacyIdsByAgent).map(([agentId, diplomacyIds]) => [agentId, [...diplomacyIds]]),
  );
  const relationshipEdges = { ...projection.relationshipEdges };
  const relationshipIdsByAgent: Record<string, string[]> = Object.fromEntries(
    Object.entries(projection.relationshipIdsByAgent).map(([agentId, relationshipIds]) => [agentId, [...relationshipIds]]),
  );
  const turnCards = { ...projection.turnCards };
  const hostedSessions = { ...projection.hostedSessions };
  const serverHostedJobs = { ...projection.serverHostedJobs };
  const serverHostedJobIdsByAgent: Record<string, string[]> = Object.fromEntries(
    Object.entries(projection.serverHostedJobIdsByAgent).map(([agentId, jobIds]) => [agentId, [...jobIds]]),
  );
  const attestationRecords = { ...projection.attestationRecords };
  const abuseScores = { ...projection.abuseScores };

  switch (event.eventType) {
    case "world_clock_advanced": {
      for (const identity of Object.values(identities)) {
        if (identity.status !== "active") continue;
        const needs = identity.needs || initialActorNeeds("agent", identity.agentId, event.payload.fromWorldMinute);
        const lifeGoal = identity.lifeGoal || initialActorLifeGoal({
          actorKind: "agent",
          actorId: identity.agentId,
          descriptor: identity.identityName,
          traits: identity.personality.traits,
          worldMinute: event.payload.fromWorldMinute,
        });
        const advanced = advanceActorNeeds({
          current: needs,
          goal: lifeGoal,
          elapsedWorldMinutes: event.payload.elapsedWorldMinutes,
          toWorldMinute: event.payload.toWorldMinute,
          downtimeMode: downtime[identity.agentId]?.active ? downtime[identity.agentId]?.mode : undefined,
          sourceEventId: event.eventId,
        });
        identities[identity.agentId] = {
          ...identity,
          needs: advanced.needs,
          lifeGoal: advanced.goal,
        };
      }
      for (const npc of Object.values(npcs)) {
        const needs = npc.needs || initialActorNeeds("npc", npc.npcId, event.payload.fromWorldMinute);
        const lifeGoal = npc.lifeGoal || initialActorLifeGoal({
          actorKind: "npc",
          actorId: npc.npcId,
          descriptor: npc.displayName,
          traits: npc.traits,
          worldMinute: event.payload.fromWorldMinute,
        });
        const advanced = advanceActorNeeds({
          current: needs,
          goal: lifeGoal,
          elapsedWorldMinutes: event.payload.elapsedWorldMinutes,
          toWorldMinute: event.payload.toWorldMinute,
          sourceEventId: event.eventId,
        });
        npcs[npc.npcId] = {
          ...npc,
          needs: advanced.needs,
          lifeGoal: advanced.goal,
        };
      }
      break;
    }
    case "identity_issued": {
      const payload = event.payload;
      const worldMinute = currentProjectionWorldMinute(projection);
      // PR5a: required-after-issuance. The payload always carries
      // identityViability (identityLifecycleRules.identityIssuedPayload
      // synthesises a fresh snapshot when the emitter omits one). The
      // defensive fallback guards legacy events persisted before PR5a.
      const initialViability = payload.identityViability
        ?? initialIdentityViability(payload.agentId, event.createdAt);
      identities[payload.agentId] = {
        agentId: payload.agentId,
        explorerId: payload.explorerId,
        identityName: payload.identityName,
        generation: payload.generation,
        status: payload.status,
        previousAgentId: payload.previousAgentId,
        ...(payload.inheritance ? { inheritance: payload.inheritance } : {}),
        lifetime: payload.lifetime,
        personality: {
          traits: payload.personalityTraits ?? [],
          driftIds: [],
        },
        needs: initialActorNeeds("agent", payload.agentId, worldMinute),
        lifeGoal: initialActorLifeGoal({
          actorKind: "agent",
          actorId: payload.agentId,
          descriptor: payload.identityName,
          traits: payload.personalityTraits ?? [],
          worldMinute,
        }),
        createdAt: event.createdAt,
        identityViability: initialViability,
        // PR5b: persist the roleplay pattern onto the identity. Legacy
        // events persisted before PR5b leave this absent; the roleplay hook
        // fail-opens (skips) when reading an undefined pattern.
        ...(payload.expectedLifePattern
          ? { expectedLifePattern: payload.expectedLifePattern }
          : {}),
      };
      lineage[payload.explorerId] = [...(lineage[payload.explorerId] || []), payload.agentId];
      agentCustody[payload.agentId] = {
        agentId: payload.agentId,
        custodyStatus: "free",
        reason: "identity_issued",
        changedAt: event.createdAt,
      };
      break;
    }
    case "personality_drift_proposed": {
      const payload = event.payload;
      personalityDrifts[payload.driftId] = {
        driftId: payload.driftId,
        agentId: payload.agentId,
        explorerId: payload.explorerId,
        sourceEventId: payload.sourceEventId,
        trigger: payload.trigger,
        suggestedTrait: payload.suggestedTrait,
        summary: payload.summary,
        status: "proposed",
        proposedAt: payload.proposedAt,
      };
      personalityDriftIdsByAgent[payload.agentId] = [
        ...(personalityDriftIdsByAgent[payload.agentId] || []),
        payload.driftId,
      ];
      break;
    }
    case "personality_drift_confirmed": {
      const payload = event.payload;
      const drift = personalityDrifts[payload.driftId];
      if (!drift) break;
      personalityDrifts[payload.driftId] = {
        ...drift,
        status: "confirmed",
        confirmedAt: payload.confirmedAt,
        confirmedByExplorerId: payload.confirmedByExplorerId,
      };
      const identity = identities[payload.agentId];
      if (!identity) break;
      identities[payload.agentId] = {
        ...identity,
        personality: {
          traits: [...new Set([...identity.personality.traits, drift.suggestedTrait])],
          driftIds: [...new Set([...identity.personality.driftIds, payload.driftId])],
          updatedAt: payload.confirmedAt,
          latestSourceEventId: drift.sourceEventId,
        },
      };
      break;
    }
    case "attribute_gained": {
      const agentId = event.agentId || event.aggregateId;
      const balance = copyAttributeScores(attributeScores[agentId]);
      balance[event.payload.attributeId] = event.payload.balanceAfter;
      attributeScores[agentId] = balance;
      break;
    }
    case "lifetime_adjusted": {
      const identity = requireIdentity(projection, event.aggregateId);
      // PR5a defensive guard: when the reason is a reserved viability reason,
      // a preceding identity_viability_projected event MUST exist on the same
      // identity whose sourceSettlementId matches the trigger ref. The
      // planner enforces this in normal operation; this assertion catches a
      // forged or replayed lifetime_adjusted that bypasses the planner.
      const payload = event.payload;
      if (
        payload.reason === LIFETIME_REASON_IDENTITY_VIABILITY_ACCELERATION
        || payload.reason === LIFETIME_REASON_IDENTITY_VIABILITY_SOCIAL_DEATH
      ) {
        const triggerRef = payload.viabilityTriggerRef;
        if (!triggerRef) {
          throw new Error(
            `lifetime_adjusted_viability_trigger_ref_missing:${event.eventId}:${payload.reason}`,
          );
        }
        let priorProjectionEvent: EpochEvent | undefined;
        for (let i = projection.events.length - 1; i >= 0; i -= 1) {
          const candidate = projection.events[i];
          if (
            candidate
            && candidate.eventType === "identity_viability_projected"
            && (candidate.payload as { readonly identityId?: string }).identityId === event.aggregateId
          ) {
            priorProjectionEvent = candidate;
            break;
          }
        }
        const priorSourceSettlementId = priorProjectionEvent
          ? (priorProjectionEvent.payload as { readonly sourceSettlementId?: string }).sourceSettlementId
          : undefined;
        if (priorSourceSettlementId !== triggerRef.sourceSettlementId) {
          throw new Error(
            `lifetime_adjusted_viability_trigger_ref_mismatch:${event.eventId}:${triggerRef.sourceSettlementId}`,
          );
        }
      }
      identities[event.aggregateId] = {
        ...identity,
        lifetime: {
          ...identity.lifetime,
          remaining: payload.remaining,
        },
      };
      break;
    }
    case "identity_viability_projected": {
      // PR5a: persist the post-settlement snapshot onto the identity. The
      // identity only carries the latest `after` snapshot to bound memory;
      // the chronicle retains the full before/after pair via the event
      // payload. doubtedBy / identityExposed / flaggedWanted / factionStanding
      // are per-identity and DO NOT cross identity boundaries (spec §8).
      const payload = event.payload;
      const identity = requireIdentity(projection, payload.identityId);
      identities[payload.identityId] = {
        ...identity,
        identityViability: payload.after,
      };
      break;
    }
    case "identity_archived": {
      const identity = requireIdentity(projection, event.aggregateId);
      identities[event.aggregateId] = {
        ...identity,
        status: "archived",
        lifetime: {
          ...identity.lifetime,
          remaining: 0,
          archivedAt: event.payload.archivedAt,
          finalTitle: event.payload.finalTitle,
        },
      };
      break;
    }
    case "agent_custody_changed": {
      agentCustody[event.payload.agentId] = {
        agentId: event.payload.agentId,
        custodyStatus: event.payload.custodyStatus,
        reason: event.payload.reason,
        changedAt: event.payload.changedAt,
      };
      break;
    }
    case "reincarnation_issued": {
      const previous = requireIdentity(projection, event.payload.previousAgentId);
      identities[event.payload.previousAgentId] = {
        ...previous,
        nextAgentId: event.payload.nextAgentId,
      };
      break;
    }
    case "resource_granted":
    case "resource_spent": {
      const balance = copyBalance(resourceBalances[event.aggregateId]);
      balance[event.payload.resourceId] = event.payload.balanceAfter;
      resourceBalances[event.aggregateId] = balance;
      break;
    }
    case "downtime_set": {
      downtime[event.aggregateId] = {
        agentId: event.aggregateId,
        mode: event.payload.mode,
        regionId: normalizeDowntimeRegionId(event.payload.regionId),
        startedAt: event.payload.startedAt,
        active: true,
      };
      break;
    }
    case "downtime_claimed": {
      const currentDowntime = downtime[event.aggregateId];
      const regionId = normalizeDowntimeRegionId(event.payload.regionId || currentDowntime?.regionId);
      const diaryEntry = downtimeDiaryEntry({
        diaryId: event.eventId,
        agentId: event.aggregateId,
        mode: event.payload.mode,
        regionId,
        phase: "claim",
        elapsedSeconds: event.payload.elapsedSeconds,
        capped: event.payload.capped,
        rewards: event.payload.rewards,
        occurredAt: event.payload.claimedAt,
        sourceEventId: event.eventId,
        diaryEntry: event.payload.diaryEntry,
      });
      downtimeDiaryEntries[diaryEntry.diaryId] = diaryEntry;
      downtimeDiaryIdsByAgent[event.aggregateId] = [
        ...(downtimeDiaryIdsByAgent[event.aggregateId] || []),
        diaryEntry.diaryId,
      ].filter((diaryId, index, diaryIds) => diaryIds.indexOf(diaryId) === index);
      addRegionActivity(regionActivities, regionActivityIdsByRegion, {
        activityId: event.eventId,
        regionId,
        kind: "downtime",
        agentId: event.aggregateId,
        title: diaryEntry.title,
        summary: diaryEntry.summary,
        occurredAt: diaryEntry.occurredAt,
        sourceEventId: event.eventId,
        sourceEventType: "downtime_claimed",
      });
      downtime[event.aggregateId] = {
        agentId: event.aggregateId,
        mode: event.payload.mode,
        regionId,
        startedAt: event.payload.startedAt,
        active: false,
        lastClaimedAt: event.payload.claimedAt,
        lastRewards: event.payload.rewards,
        lastClaimDiaryEntry: diaryEntry,
      };
      break;
    }
    case "downtime_tick_resolved": {
      const currentDowntime = downtime[event.aggregateId];
      const regionId = normalizeDowntimeRegionId(event.payload.regionId || currentDowntime?.regionId);
      const diaryEntry = downtimeDiaryEntry({
        diaryId: event.eventId,
        agentId: event.aggregateId,
        mode: event.payload.mode,
        regionId,
        phase: "tick",
        elapsedSeconds: event.payload.elapsedSeconds,
        capped: event.payload.capped,
        rewards: event.payload.rewards,
        occurredAt: event.payload.tickedAt,
        sourceEventId: event.eventId,
        diaryEntry: event.payload.diaryEntry,
      });
      downtimeDiaryEntries[diaryEntry.diaryId] = diaryEntry;
      downtimeDiaryIdsByAgent[event.aggregateId] = [
        ...(downtimeDiaryIdsByAgent[event.aggregateId] || []),
        diaryEntry.diaryId,
      ].filter((diaryId, index, diaryIds) => diaryIds.indexOf(diaryId) === index);
      addRegionActivity(regionActivities, regionActivityIdsByRegion, {
        activityId: event.eventId,
        regionId,
        kind: "downtime",
        agentId: event.aggregateId,
        title: diaryEntry.title,
        summary: diaryEntry.summary,
        occurredAt: diaryEntry.occurredAt,
        sourceEventId: event.eventId,
        sourceEventType: "downtime_tick_resolved",
      });
      downtime[event.aggregateId] = {
        agentId: event.aggregateId,
        mode: event.payload.mode,
        regionId,
        startedAt: event.payload.tickedAt,
        active: true,
        lastTickedAt: event.payload.tickedAt,
        lastTickRewards: event.payload.rewards,
        lastTickDiaryEntry: diaryEntry,
        lastClaimedAt: currentDowntime?.lastClaimedAt,
        lastRewards: currentDowntime?.lastRewards,
        lastClaimDiaryEntry: currentDowntime?.lastClaimDiaryEntry,
      };
      break;
    }
    case "npc_candidate_submitted": {
      npcCandidates[event.payload.candidateId] = {
        candidateId: event.payload.candidateId,
        agentId: event.payload.agentId,
        explorerId: event.payload.explorerId,
        regionId: event.payload.regionId,
        displayName: event.payload.displayName,
        npcKey: event.payload.npcKey,
        traits: event.payload.traits,
        storyEvidence: event.payload.storyEvidence,
        decision: event.payload.decision,
        status: event.payload.status,
        reviewLevel: event.payload.reviewLevel || "clear",
        reviewScore: event.payload.reviewScore || 0,
        reviewFlags: event.payload.reviewFlags || [],
        ipSimilarity: event.payload.ipSimilarity,
        flavorPublication: event.payload.flavorPublication,
        rumorAdmissionReview: event.payload.rumorAdmissionReview || npcCandidateRumorAdmission({
          displayName: event.payload.displayName,
          regionId: event.payload.regionId,
          traits: event.payload.traits || [],
          storyEvidence: event.payload.storyEvidence,
        }),
        abilityEffectCluster: event.payload.abilityEffectCluster,
        submittedAt: event.createdAt,
        canonicalNpcId: event.payload.canonicalNpcId,
        rejectionReason: event.payload.rejectionReason,
        sourceEventId: event.payload.sourceEventId,
        experimentId: event.payload.experimentId,
        mainRuleReview: event.payload.mainRuleReview,
      };
      npcCandidateIdsByRegion[event.payload.regionId] = uniqueValues([
        ...(npcCandidateIdsByRegion[event.payload.regionId] || []),
        event.payload.candidateId,
      ]);
      npcCandidateIdsByAgent[event.payload.agentId] = uniqueValues([
        ...(npcCandidateIdsByAgent[event.payload.agentId] || []),
        event.payload.candidateId,
      ]);
      break;
    }
    case "npc_candidate_reviewed": {
      const candidate = npcCandidates[event.payload.candidateId];
      if (!candidate) throw new Error("npc_candidate_not_found");
      npcCandidates[event.payload.candidateId] = {
        ...candidate,
        decision: event.payload.decision,
        status: event.payload.status,
        canonicalNpcId: event.payload.canonicalNpcId,
        rejectionReason: event.payload.rejectionReason,
        reviewedBy: event.payload.reviewedBy,
        reviewedAt: event.createdAt,
        reviewNote: event.payload.reviewNote,
      };
      break;
    }
    case "npc_canonicalized": {
      const worldMinute = currentProjectionWorldMinute(projection);
      npcs[event.payload.npcId] = {
        npcId: event.payload.npcId,
        npcKey: event.payload.npcKey,
        displayName: event.payload.displayName,
        regionId: event.payload.regionId,
        traits: event.payload.traits,
        needs: initialActorNeeds("npc", event.payload.npcId, worldMinute),
        lifeGoal: initialActorLifeGoal({
          actorKind: "npc",
          actorId: event.payload.npcId,
          descriptor: event.payload.displayName,
          traits: event.payload.traits,
          worldMinute,
        }),
        createdAt: event.createdAt,
        lifecycle: [],
      };
      npcIdsByKey[event.payload.npcKey] = event.payload.npcId;
      break;
    }
    case "npc_lifecycle_recorded": {
      const npc = npcs[event.payload.npcId];
      if (!npc) throw new Error("npc_not_found");
      npcs[event.payload.npcId] = {
        ...npc,
        lifecycle: [
          ...npc.lifecycle,
          {
            occurredAt: event.payload.occurredAt,
            changes: event.payload.changes,
            sourceEventIds: event.payload.sourceEventIds,
          },
        ],
      };
      break;
    }
    case "npc_relationship_recorded": {
      const payload = event.payload;
      const relationship: EpochNpcRelationship = {
        relationshipId: payload.relationshipId,
        sourceNpcId: payload.sourceNpcId,
        targetNpcId: payload.targetNpcId,
        sourceRegionId: payload.sourceRegionId,
        targetRegionId: payload.targetRegionId,
        kind: payload.kind,
        score: payload.score,
        reason: payload.reason,
        sourceEventIds: payload.sourceEventIds,
        recordedAt: payload.recordedAt,
      };
      npcRelationships[payload.relationshipId] = relationship;
      for (const npcId of [payload.sourceNpcId, payload.targetNpcId]) {
        npcRelationshipIdsByNpc[npcId] = [
          ...(npcRelationshipIdsByNpc[npcId] || []),
          payload.relationshipId,
        ].filter((relationshipId, index, relationshipIds) => relationshipIds.indexOf(relationshipId) === index);
      }
      for (const regionId of [payload.sourceRegionId, payload.targetRegionId]) {
        npcRelationshipIdsByRegion[regionId] = [
          ...(npcRelationshipIdsByRegion[regionId] || []),
          payload.relationshipId,
        ].filter((relationshipId, index, relationshipIds) => relationshipIds.indexOf(relationshipId) === index);
      }
      break;
    }
    case "agent_npc_bond_updated": {
      const payload = event.payload;
      const bond: EpochAgentNpcBond = {
        bondId: payload.bondId,
        agentId: payload.agentId,
        explorerId: payload.explorerId,
        npcId: payload.npcId,
        npcRegionId: payload.npcRegionId,
        kind: payload.kind,
        score: payload.scoreAfter,
        previousScore: payload.previousScore,
        scoreDelta: payload.scoreDelta,
        focusSpent: payload.focusSpent,
        reason: payload.reason,
        updatedAt: payload.updatedAt,
      };
      agentNpcBonds[payload.bondId] = bond;
      agentNpcBondIdsByAgent[payload.agentId] = [
        ...(agentNpcBondIdsByAgent[payload.agentId] || []),
        payload.bondId,
      ].filter((bondId, index, bondIds) => bondIds.indexOf(bondId) === index);
      agentNpcBondIdsByNpc[payload.npcId] = [
        ...(agentNpcBondIdsByNpc[payload.npcId] || []),
        payload.bondId,
      ].filter((bondId, index, bondIds) => bondIds.indexOf(bondId) === index);
      agentNpcBondIdsByRegion[payload.npcRegionId] = [
        ...(agentNpcBondIdsByRegion[payload.npcRegionId] || []),
        payload.bondId,
      ].filter((bondId, index, bondIds) => bondIds.indexOf(bondId) === index);
      break;
    }
    case "npc_memory_recorded": {
      const payload = event.payload;
      const memory: EpochNpcMemory = {
        memoryId: payload.memoryId,
        npcId: payload.npcId,
        regionId: payload.regionId,
        summary: payload.summary,
        importance: payload.importance,
        sourceEventIds: payload.sourceEventIds,
        recordedAt: payload.recordedAt,
      };
      npcMemories[payload.memoryId] = memory;
      npcMemoryIdsByNpc[payload.npcId] = [
        ...(npcMemoryIdsByNpc[payload.npcId] || []),
        payload.memoryId,
      ].filter((memoryId, index, memoryIds) => memoryIds.indexOf(memoryId) === index);
      npcMemoryIdsByRegion[payload.regionId] = [
        ...(npcMemoryIdsByRegion[payload.regionId] || []),
        payload.memoryId,
      ].filter((memoryId, index, memoryIds) => memoryIds.indexOf(memoryId) === index);
      break;
    }
    case "npc_household_recorded": {
      const payload = event.payload;
      const household: EpochHousehold = {
        householdId: payload.householdId,
        regionId: payload.regionId,
        memberNpcIds: payload.memberNpcIds,
        reason: payload.reason,
        sourceEventIds: payload.sourceEventIds,
        recordedAt: payload.recordedAt,
      };
      households[payload.householdId] = household;
      for (const npcId of payload.memberNpcIds) {
        householdIdsByNpc[npcId] = [
          ...(householdIdsByNpc[npcId] || []),
          payload.householdId,
        ].filter((householdId, index, householdIds) => householdIds.indexOf(householdId) === index);
      }
      householdIdsByRegion[payload.regionId] = [
        ...(householdIdsByRegion[payload.regionId] || []),
        payload.householdId,
      ].filter((householdId, index, householdIds) => householdIds.indexOf(householdId) === index);
      break;
    }
    case "organization_created": {
      const payload = event.payload;
      const previousOrganization = organizations[payload.organizationId];
      const organizationKey = stableKey(`${payload.regionId}:${payload.organizationName}`);
      organizations[payload.organizationId] = {
        organizationId: payload.organizationId,
        organizationKey,
        displayName: payload.organizationName,
        regionId: payload.regionId,
        memberNpcIds: previousOrganization?.memberNpcIds || [],
        memberAgentIds: previousOrganization?.memberAgentIds || [],
        recordedAt: previousOrganization?.recordedAt || payload.recordedAt,
      };
      addRegionActivity(regionActivities, regionActivityIdsByRegion, {
        activityId: payload.organizationId,
        regionId: payload.regionId,
        kind: "organization_politics",
        agentId: "system",
        title: "组织创建",
        summary: `${payload.organizationName} 已由运营入口创建。`,
        occurredAt: payload.recordedAt,
        sourceEventId: event.eventId,
        sourceEventType: "organization_created",
      });
      break;
    }
    case "organization_membership_changed": {
      const payload = event.payload;
      const organizationKey = stableKey(`${payload.regionId}:${payload.organizationName}`);
      const memberType: EpochOrganizationMemberType = payload.memberType || (payload.agentId ? "agent" : "npc");
      const membership: EpochOrganizationMembership = {
        membershipId: payload.membershipId,
        organizationId: payload.organizationId,
        organizationName: payload.organizationName,
        memberType,
        ...(payload.npcId ? { npcId: payload.npcId } : {}),
        ...(payload.agentId ? { agentId: payload.agentId } : {}),
        ...(payload.explorerId ? { explorerId: payload.explorerId } : {}),
        regionId: payload.regionId,
        role: payload.role,
        status: payload.status,
        sourceEventIds: payload.sourceEventIds,
        recordedAt: payload.recordedAt,
      };
      organizationMemberships[payload.membershipId] = membership;
      const previousOrganization = organizations[payload.organizationId];
      const memberNpcIds = payload.npcId
        ? payload.status === "active"
          ? uniqueValues([...(previousOrganization?.memberNpcIds || []), payload.npcId])
          : (previousOrganization?.memberNpcIds || []).filter((npcId) => npcId !== payload.npcId)
        : previousOrganization?.memberNpcIds || [];
      const memberAgentIds = payload.agentId
        ? payload.status === "active"
          ? uniqueValues([...(previousOrganization?.memberAgentIds || []), payload.agentId])
          : (previousOrganization?.memberAgentIds || []).filter((agentId) => agentId !== payload.agentId)
        : previousOrganization?.memberAgentIds || [];
      organizations[payload.organizationId] = {
        organizationId: payload.organizationId,
        organizationKey,
        displayName: payload.organizationName,
        regionId: payload.regionId,
        memberNpcIds,
        memberAgentIds,
        recordedAt: previousOrganization?.recordedAt || payload.recordedAt,
      };
      if (payload.npcId) {
        organizationMembershipIdsByNpc[payload.npcId] = [
          ...(organizationMembershipIdsByNpc[payload.npcId] || []),
          payload.membershipId,
        ].filter((membershipId, index, membershipIds) => membershipIds.indexOf(membershipId) === index);
      }
      if (payload.agentId) {
        organizationMembershipIdsByAgent[payload.agentId] = [
          ...(organizationMembershipIdsByAgent[payload.agentId] || []),
          payload.membershipId,
        ].filter((membershipId, index, membershipIds) => membershipIds.indexOf(membershipId) === index);
      }
      organizationMembershipIdsByRegion[payload.regionId] = [
        ...(organizationMembershipIdsByRegion[payload.regionId] || []),
        payload.membershipId,
      ].filter((membershipId, index, membershipIds) => membershipIds.indexOf(membershipId) === index);
      organizationMembershipIdsByOrganization[payload.organizationId] = [
        ...(organizationMembershipIdsByOrganization[payload.organizationId] || []),
        payload.membershipId,
      ].filter((membershipId, index, membershipIds) => membershipIds.indexOf(membershipId) === index);
      break;
    }
    case "organization_politics_recorded": {
      const payload = event.payload;
      const politics: EpochOrganizationPoliticsRecord = {
        politicsId: payload.politicsId,
        organizationId: payload.organizationId,
        organizationName: payload.organizationName,
        regionId: payload.regionId,
        npcId: payload.npcId,
        counterpartyNpcId: payload.counterpartyNpcId,
        kind: payload.kind,
        title: payload.title,
        summary: payload.summary,
        standingDelta: payload.standingDelta,
        standingAfter: payload.standingAfter,
        sourceEventIds: payload.sourceEventIds,
        recordedAt: payload.recordedAt,
      };
      organizationPolitics[payload.politicsId] = politics;
      organizationPoliticalStandingByOrganization[payload.organizationId] = payload.standingAfter;
      organizationPoliticsIdsByRegion[payload.regionId] = [
        ...(organizationPoliticsIdsByRegion[payload.regionId] || []),
        payload.politicsId,
      ].filter((politicsId, index, politicsIds) => politicsIds.indexOf(politicsId) === index);
      organizationPoliticsIdsByOrganization[payload.organizationId] = [
        ...(organizationPoliticsIdsByOrganization[payload.organizationId] || []),
        payload.politicsId,
      ].filter((politicsId, index, politicsIds) => politicsIds.indexOf(politicsId) === index);
      organizationPoliticsIdsByNpc[payload.npcId] = [
        ...(organizationPoliticsIdsByNpc[payload.npcId] || []),
        payload.politicsId,
      ].filter((politicsId, index, politicsIds) => politicsIds.indexOf(politicsId) === index);
      if (payload.counterpartyNpcId) {
        organizationPoliticsIdsByNpc[payload.counterpartyNpcId] = [
          ...(organizationPoliticsIdsByNpc[payload.counterpartyNpcId] || []),
          payload.politicsId,
        ].filter((politicsId, index, politicsIds) => politicsIds.indexOf(politicsId) === index);
      }
      addRegionActivity(regionActivities, regionActivityIdsByRegion, {
        activityId: payload.politicsId,
        regionId: payload.regionId,
        kind: "organization_politics",
        agentId: "system",
        title: payload.title,
        summary: payload.summary,
        occurredAt: payload.recordedAt,
        sourceEventId: event.eventId,
        sourceEventType: "organization_politics_recorded",
      });
      break;
    }
    case "organization_prestige_changed": {
      const payload = event.payload;
      organizationPoliticalStandingByOrganization[payload.organizationId] = payload.standingAfter;
      addRegionActivity(regionActivities, regionActivityIdsByRegion, {
        activityId: payload.prestigeId,
        regionId: payload.regionId,
        kind: "organization_politics",
        agentId: payload.agentId || "system",
        title: "组织声望",
        summary: `${payload.organizationName} 因 ${payload.reason} 声望 ${payload.standingDelta > 0 ? "+" : ""}${payload.standingDelta}，当前 ${payload.standingAfter}。`,
        occurredAt: payload.recordedAt,
        sourceEventId: event.eventId,
        sourceEventType: "organization_prestige_changed",
      });
      break;
    }
    case "organization_treasury_changed": {
      const payload = event.payload;
      const balance = copyBalance(organizationTreasuryBalances[payload.organizationId]);
      balance[payload.resourceId] = payload.balanceAfter;
      organizationTreasuryBalances[payload.organizationId] = balance;
      addRegionActivity(regionActivities, regionActivityIdsByRegion, {
        activityId: payload.treasuryEventId,
        regionId: payload.regionId,
        kind: "organization_politics",
        agentId: "system",
        title: "组织金库",
        summary: `${payload.organizationName} 金库 ${payload.resourceId} ${payload.amountDelta > 0 ? "+" : ""}${payload.amountDelta}，当前 ${payload.balanceAfter}。`,
        occurredAt: payload.recordedAt,
        sourceEventId: event.eventId,
        sourceEventType: "organization_treasury_changed",
      });
      break;
    }
    case "organization_budget_proposed": {
      const payload = event.payload;
      const approvalThreshold = payload.approvalThreshold ?? organizationBudgetApprovalThreshold(payload.amount);
      const rejectionThreshold = payload.rejectionThreshold ?? organizationBudgetRejectionThreshold(payload.amount);
      const budget: EpochOrganizationBudget = {
        budgetId: payload.budgetId,
        organizationId: payload.organizationId,
        organizationName: payload.organizationName,
        regionId: payload.regionId,
        proposedByAgentId: payload.proposedByAgentId,
        proposedByExplorerId: payload.proposedByExplorerId,
        title: payload.title,
        description: payload.description,
        resourceId: payload.resourceId,
        amount: payload.amount,
        status: "proposed",
        approvalThreshold,
        rejectionThreshold,
        approvalCount: 0,
        rejectionCount: 0,
        votes: [],
        sourceEventIds: [event.eventId, ...payload.sourceEventIds].filter((eventId, index, eventIds) => eventIds.indexOf(eventId) === index),
        proposedAt: payload.proposedAt,
      };
      organizationBudgets[payload.budgetId] = budget;
      organizationBudgetIdsByOrganization[payload.organizationId] = [
        ...(organizationBudgetIdsByOrganization[payload.organizationId] || []),
        payload.budgetId,
      ].filter((budgetId, index, budgetIds) => budgetIds.indexOf(budgetId) === index);
      addRegionActivity(regionActivities, regionActivityIdsByRegion, {
        activityId: payload.budgetId,
        regionId: payload.regionId,
        kind: "organization_politics",
        agentId: payload.proposedByAgentId,
        title: "组织预算提案",
        summary: `${payload.organizationName} 提案 ${payload.title}，申请 ${payload.amount} ${payload.resourceId}。`,
        occurredAt: payload.proposedAt,
        sourceEventId: event.eventId,
        sourceEventType: "organization_budget_proposed",
      });
      break;
    }
    case "organization_budget_vote_recorded": {
      const payload = event.payload;
      const existing = organizationBudgets[payload.budgetId];
      if (existing) {
        const vote: EpochOrganizationBudgetVote = {
          voteId: payload.voteId,
          decision: payload.decision,
          voterAgentId: payload.voterAgentId,
          voterExplorerId: payload.voterExplorerId,
          voterRole: payload.voterRole,
          note: payload.note,
          sourceEventIds: [event.eventId, ...payload.sourceEventIds].filter((eventId, index, eventIds) => eventIds.indexOf(eventId) === index),
          votedAt: payload.votedAt,
        };
        organizationBudgets[payload.budgetId] = {
          ...existing,
          approvalCount: payload.approvalCount,
          rejectionCount: payload.rejectionCount,
          votes: [...(existing.votes || []), vote]
            .filter((candidate, index, votes) => votes.findIndex((item) => item.voteId === candidate.voteId) === index),
          sourceEventIds: [...existing.sourceEventIds, event.eventId, ...payload.sourceEventIds]
            .filter((eventId, index, eventIds) => eventIds.indexOf(eventId) === index),
        };
      }
      addRegionActivity(regionActivities, regionActivityIdsByRegion, {
        activityId: payload.voteId,
        regionId: payload.regionId,
        kind: "organization_politics",
        agentId: payload.voterAgentId,
        title: "组织预算投票",
        summary: `${payload.organizationName} 预算投票 ${payload.decision === "approved" ? "赞成" : "反对"} ${payload.amount} ${payload.resourceId}（${payload.approvalCount}/${payload.approvalThreshold}）。`,
        occurredAt: payload.votedAt,
        sourceEventId: event.eventId,
        sourceEventType: "organization_budget_vote_recorded",
      });
      break;
    }
    case "organization_budget_resolved": {
      const payload = event.payload;
      const existing = organizationBudgets[payload.budgetId];
      if (existing) {
        organizationBudgets[payload.budgetId] = {
          ...existing,
          status: payload.resolution,
          resolvedByAgentId: payload.resolvedByAgentId,
          resolvedByExplorerId: payload.resolvedByExplorerId,
          resolution: payload.resolution,
          note: payload.note,
          treasuryEventId: payload.treasuryEventId,
          sourceEventIds: [...existing.sourceEventIds, event.eventId, ...payload.sourceEventIds]
            .filter((eventId, index, eventIds) => eventIds.indexOf(eventId) === index),
          resolvedAt: payload.resolvedAt,
        };
      }
      addRegionActivity(regionActivities, regionActivityIdsByRegion, {
        activityId: `${payload.budgetId}:resolved`,
        regionId: payload.regionId,
        kind: "organization_politics",
        agentId: payload.resolvedByAgentId,
        title: "组织预算审批",
        summary: `${payload.organizationName} ${payload.resolution === "approved" ? "批准" : "拒绝"}预算 ${payload.amount} ${payload.resourceId}：${payload.note || payload.budgetId}。`,
        occurredAt: payload.resolvedAt,
        sourceEventId: event.eventId,
        sourceEventType: "organization_budget_resolved",
      });
      break;
    }
    case "organization_upgrade_purchased": {
      const payload = event.payload;
      const upgrade: EpochOrganizationUpgrade = {
        upgradeId: payload.upgradeId,
        organizationId: payload.organizationId,
        organizationName: payload.organizationName,
        regionId: payload.regionId,
        upgradeKey: payload.upgradeKey as EpochOrganizationUpgradeKey,
        title: payload.title,
        description: payload.description,
        purchasedByAgentId: payload.purchasedByAgentId,
        purchasedByExplorerId: payload.purchasedByExplorerId,
        costResourceId: payload.costResourceId,
        costAmount: payload.costAmount,
        sourceEventIds: payload.sourceEventIds,
        purchasedAt: payload.purchasedAt,
      };
      organizationUpgrades[payload.upgradeId] = upgrade;
      organizationUpgradeIdsByOrganization[payload.organizationId] = [
        ...(organizationUpgradeIdsByOrganization[payload.organizationId] || []),
        payload.upgradeId,
      ].filter((upgradeId, index, upgradeIds) => upgradeIds.indexOf(upgradeId) === index);
      addRegionActivity(regionActivities, regionActivityIdsByRegion, {
        activityId: payload.upgradeId,
        regionId: payload.regionId,
        kind: "organization_politics",
        agentId: payload.purchasedByAgentId,
        title: "组织升级",
        summary: `${payload.organizationName} 购买了${payload.title}，消耗 ${payload.costAmount} ${payload.costResourceId}。`,
        occurredAt: payload.purchasedAt,
        sourceEventId: event.eventId,
        sourceEventType: "organization_upgrade_purchased",
      });
      break;
    }
    case "npc_career_changed": {
      const payload = event.payload;
      const career: EpochNpcCareerRecord = {
        careerId: payload.careerId,
        npcId: payload.npcId,
        regionId: payload.regionId,
        title: payload.title,
        status: payload.status,
        organizationId: payload.organizationId,
        sourceEventIds: payload.sourceEventIds,
        recordedAt: payload.recordedAt,
      };
      npcCareerRecords[payload.careerId] = career;
      npcCareerIdsByNpc[payload.npcId] = [
        ...(npcCareerIdsByNpc[payload.npcId] || []),
        payload.careerId,
      ].filter((careerId, index, careerIds) => careerIds.indexOf(careerId) === index);
      npcCareerIdsByRegion[payload.regionId] = [
        ...(npcCareerIdsByRegion[payload.regionId] || []),
        payload.careerId,
      ].filter((careerId, index, careerIds) => careerIds.indexOf(careerId) === index);
      break;
    }
    case "npc_location_changed": {
      const payload = event.payload;
      const npc = npcs[payload.npcId];
      if (!npc) throw new Error("npc_not_found");
      const location: EpochNpcLocationRecord = {
        locationId: payload.locationId,
        npcId: payload.npcId,
        fromRegionId: payload.fromRegionId,
        toRegionId: payload.toRegionId,
        reason: payload.reason,
        sourceEventIds: payload.sourceEventIds,
        recordedAt: payload.recordedAt,
      };
      npcLocationRecords[payload.locationId] = location;
      npcs[payload.npcId] = {
        ...npc,
        regionId: payload.toRegionId,
      };
      npcLocationIdsByNpc[payload.npcId] = [
        ...(npcLocationIdsByNpc[payload.npcId] || []),
        payload.locationId,
      ].filter((locationId, index, locationIds) => locationIds.indexOf(locationId) === index);
      for (const regionId of [payload.fromRegionId, payload.toRegionId]) {
        npcLocationIdsByRegion[regionId] = [
          ...(npcLocationIdsByRegion[regionId] || []),
          payload.locationId,
        ].filter((locationId, index, locationIds) => locationIds.indexOf(locationId) === index);
      }
      break;
    }
    case "npc_asset_changed": {
      const payload = event.payload;
      const asset: EpochNpcAssetState = {
        assetId: payload.assetId,
        npcId: payload.npcId,
        regionId: payload.regionId,
        assetKey: payload.assetKey,
        delta: payload.delta,
        balanceAfter: payload.balanceAfter,
        reason: payload.reason,
        sourceEventIds: payload.sourceEventIds,
        recordedAt: payload.recordedAt,
      };
      npcAssetStates[payload.assetId] = asset;
      npcAssetIdsByNpc[payload.npcId] = [
        ...(npcAssetIdsByNpc[payload.npcId] || []),
        payload.assetId,
      ].filter((assetId, index, assetIds) => assetIds.indexOf(assetId) === index);
      npcAssetIdsByRegion[payload.regionId] = [
        ...(npcAssetIdsByRegion[payload.regionId] || []),
        payload.assetId,
      ].filter((assetId, index, assetIds) => assetIds.indexOf(assetId) === index);
      npcAssetBalancesByNpc[payload.npcId] = {
        ...(npcAssetBalancesByNpc[payload.npcId] || {}),
        [payload.assetKey]: payload.balanceAfter,
      };
      break;
    }
    case "npc_health_recorded": {
      const payload = event.payload;
      const health: EpochNpcHealthState = {
        healthId: payload.healthId,
        npcId: payload.npcId,
        regionId: payload.regionId,
        status: payload.status,
        severity: payload.severity,
        reason: payload.reason,
        sourceEventIds: payload.sourceEventIds,
        recordedAt: payload.recordedAt,
      };
      npcHealthStates[payload.healthId] = health;
      npcHealthIdsByNpc[payload.npcId] = [
        ...(npcHealthIdsByNpc[payload.npcId] || []),
        payload.healthId,
      ].filter((healthId, index, healthIds) => healthIds.indexOf(healthId) === index);
      npcHealthIdsByRegion[payload.regionId] = [
        ...(npcHealthIdsByRegion[payload.regionId] || []),
        payload.healthId,
      ].filter((healthId, index, healthIds) => healthIds.indexOf(healthId) === index);
      break;
    }
    case "item_created": {
      const payload = event.payload;
      inventoryItems[payload.itemId] = {
        itemId: payload.itemId,
        agentId: payload.agentId,
        explorerId: payload.explorerId,
        itemKey: payload.itemKey,
        displayName: payload.displayName,
        rarity: payload.rarity,
        sourceEventIds: payload.sourceEventIds,
        createdAt: payload.createdAt,
        bound: payload.bound,
      };
      inventoryItemIdsByAgent[payload.agentId] = [
        ...(inventoryItemIdsByAgent[payload.agentId] || []),
        payload.itemId,
      ].filter((itemId, index, itemIds) => itemIds.indexOf(itemId) === index);
      inventoryItemIdsByExplorer[payload.explorerId] = [
        ...(inventoryItemIdsByExplorer[payload.explorerId] || []),
        payload.itemId,
      ].filter((itemId, index, itemIds) => itemIds.indexOf(itemId) === index);
      break;
    }
    case "item_bound": {
      const payload = event.payload;
      const item = inventoryItems[payload.itemId];
      if (!item) throw new Error("inventory_item_not_found");
      inventoryItems[payload.itemId] = {
        ...item,
        bound: true,
        boundAt: payload.boundAt,
        boundReason: payload.reason,
      };
      break;
    }
    case "item_transferred": {
      const payload = event.payload;
      const item = inventoryItems[payload.itemId];
      if (!item) throw new Error("inventory_item_not_found");
      inventoryItemIdsByAgent[payload.fromAgentId] = (inventoryItemIdsByAgent[payload.fromAgentId] || [])
        .filter((itemId) => itemId !== payload.itemId);
      inventoryItemIdsByExplorer[payload.fromExplorerId] = (inventoryItemIdsByExplorer[payload.fromExplorerId] || [])
        .filter((itemId) => itemId !== payload.itemId);
      inventoryItemIdsByAgent[payload.toAgentId] = [
        ...(inventoryItemIdsByAgent[payload.toAgentId] || []),
        payload.itemId,
      ].filter((itemId, index, itemIds) => itemIds.indexOf(itemId) === index);
      inventoryItemIdsByExplorer[payload.toExplorerId] = [
        ...(inventoryItemIdsByExplorer[payload.toExplorerId] || []),
        payload.itemId,
      ].filter((itemId, index, itemIds) => itemIds.indexOf(itemId) === index);
      inventoryItems[payload.itemId] = {
        ...item,
        agentId: payload.toAgentId,
        explorerId: payload.toExplorerId,
        marketLockedByOrderId: undefined,
        transferredAt: payload.transferredAt,
        transferSourceOrderId: payload.sourceOrderId,
      };
      break;
    }
    case "social_hook_created": {
      const payload = event.payload;
      const hook: EpochSocialHook = {
        hookId: payload.hookId,
        regionId: payload.regionId,
        npcId: payload.npcId,
        kind: payload.kind,
        title: payload.title,
        body: payload.body,
        actionLabel: payload.actionLabel,
        risk: payload.risk,
        sourceEventIds: payload.sourceEventIds,
        createdAt: payload.createdAt,
      };
      socialHooks[payload.hookId] = hook;
      socialHookIdsByRegion[payload.regionId] = [
        ...(socialHookIdsByRegion[payload.regionId] || []),
        payload.hookId,
      ].filter((hookId, index, hookIds) => hookIds.indexOf(hookId) === index);
      if (payload.npcId) {
        socialHookIdsByNpc[payload.npcId] = [
          ...(socialHookIdsByNpc[payload.npcId] || []),
          payload.hookId,
        ].filter((hookId, index, hookIds) => hookIds.indexOf(hookId) === index);
      }
      break;
    }
    case "region_news_generated": {
      regionNews[event.payload.regionId] = [
        ...(regionNews[event.payload.regionId] || []),
        {
          newsId: event.payload.newsId,
          regionId: event.payload.regionId,
          headline: event.payload.headline,
          body: event.payload.body,
          legendDelta: event.payload.legendDelta,
          sourceEventIds: event.payload.sourceEventIds,
          createdAt: event.createdAt,
          moderationStatus: event.payload.moderationStatus || "visible",
        },
      ];
      break;
    }
    case "message_posted": {
      const payload = event.payload;
      const message: EpochMessageRecord = {
        messageId: payload.messageId,
        scope: payload.scope,
        agentId: payload.agentId,
        explorerId: payload.explorerId,
        regionId: payload.regionId,
        body: payload.body,
        postedAt: payload.postedAt,
        moderationStatus: payload.moderationStatus || "visible",
      };
      if (payload.scope === "world") {
        worldMessages.push(message);
      } else {
        if (!payload.regionId) throw new Error("region_id_required");
        regionMessages[payload.regionId] = [
          ...(regionMessages[payload.regionId] || []),
          message,
        ];
      }
      break;
    }
    case "moderation_queued": {
      const payload = event.payload;
      moderationItems[payload.moderationId] = {
        moderationId: payload.moderationId,
        subjectType: payload.subjectType,
        subjectId: payload.subjectId,
        sourceEventId: payload.sourceEventId,
        agentId: payload.agentId,
        explorerId: payload.explorerId,
        regionId: payload.regionId,
        reason: payload.reason,
        severity: payload.severity,
        bodyPreview: payload.bodyPreview,
        queuedAt: payload.queuedAt,
        status: "open",
      };
      break;
    }
    case "moderation_resolved": {
      const payload = event.payload;
      const existing = moderationItems[payload.moderationId];
      if (!existing) break;
      const status = contentStatusForResolution(payload.resolution);
      moderationItems[payload.moderationId] = {
        ...existing,
        status: "resolved",
        resolution: payload.resolution,
        resolvedBy: payload.resolvedBy,
        resolvedAt: payload.resolvedAt,
        note: payload.note,
      };
      if (existing.subjectType === "message") {
        updateMessageModerationStatus(worldMessages, regionMessages, existing.subjectId, status);
      } else if (existing.subjectType === "region_news") {
        updateNewsModerationStatus(regionNews, existing.subjectId, status);
      }
      break;
    }
    case "risk_review_recorded": {
      const payload = event.payload;
      const review: EpochRiskReview = {
        reviewId: payload.reviewId,
        sourceEventId: payload.sourceEventId,
        sourceEventType: payload.sourceEventType,
        agentId: payload.agentId,
        explorerId: payload.explorerId,
        resolution: payload.resolution,
        reviewFlags: payload.reviewFlags,
        reviewScore: payload.reviewScore,
        operatorId: payload.operatorId,
        reviewedAt: payload.reviewedAt,
        note: payload.note,
      };
      riskReviews[payload.reviewId] = review;
      riskReviewIdsBySourceEvent[payload.sourceEventId] = [
        ...(riskReviewIdsBySourceEvent[payload.sourceEventId] || []).filter((reviewId) => reviewId !== payload.reviewId),
        payload.reviewId,
      ];
      if (payload.agentId) {
        riskReviewIdsByAgent[payload.agentId] = [
          ...(riskReviewIdsByAgent[payload.agentId] || []).filter((reviewId) => reviewId !== payload.reviewId),
          payload.reviewId,
        ];
        if (payload.resolution === "escalated") {
          marketRiskRestrictions[payload.agentId] = {
            agentId: payload.agentId,
            explorerId: payload.explorerId,
            sourceEventId: payload.sourceEventId,
            sourceReviewId: payload.reviewId,
            reviewFlags: payload.reviewFlags,
            reviewScore: payload.reviewScore,
            reason: "risk_review_escalated",
            restrictedAt: payload.reviewedAt,
          };
        }
      }
      break;
    }
    case "market_risk_restriction_released": {
      const payload = event.payload;
      marketRiskRestrictionReleases[payload.releaseId] = {
        releaseId: payload.releaseId,
        agentId: payload.agentId,
        explorerId: payload.explorerId,
        sourceEventId: payload.sourceEventId,
        sourceReviewId: payload.sourceReviewId,
        releasedBy: payload.releasedBy,
        releasedAt: payload.releasedAt,
        note: payload.note,
      };
      delete marketRiskRestrictions[payload.agentId];
      break;
    }
    case "legend_awarded": {
      const payload = event.payload;
      const award: EpochLegendAward = {
        awardId: payload.awardId,
        newsId: payload.newsId,
        regionId: payload.regionId,
        agentId: payload.agentId,
        explorerId: payload.explorerId,
        amount: payload.amount,
        reason: payload.reason,
        awardedAt: payload.awardedAt,
      };
      legendAwards[payload.awardId] = award;
      legendAwardIdsByNews[payload.newsId] = [
        ...(legendAwardIdsByNews[payload.newsId] || []),
        payload.awardId,
      ].filter((awardId, index, awardIds) => awardIds.indexOf(awardId) === index);
      legendAwardIdsByAgent[payload.agentId] = [
        ...(legendAwardIdsByAgent[payload.agentId] || []),
        payload.awardId,
      ].filter((awardId, index, awardIds) => awardIds.indexOf(awardId) === index);
      break;
    }
    case "contested_objective_created": {
      contestedObjectives[event.payload.objectiveId] = {
        objectiveId: event.payload.objectiveId,
        regionId: event.payload.regionId,
        title: event.payload.title,
        description: event.payload.description,
        resourceId: event.payload.resourceId,
        targetScore: event.payload.targetScore,
        mode: event.payload.mode === "race" ? "race" : "contribution",
        reward: event.payload.reward,
        ...(event.payload.consolationReward ? { consolationReward: event.payload.consolationReward } : {}),
        createdAt: event.payload.createdAt,
        status: "active",
        totalScore: 0,
        leaderboard: [],
        raceCompletions: [],
      };
      objectiveIdsByRegion[event.payload.regionId] = [
        ...(objectiveIdsByRegion[event.payload.regionId] || []),
        event.payload.objectiveId,
      ].filter((objectiveId, index, objectiveIds) => objectiveIds.indexOf(objectiveId) === index);
      addRegionActivityForEvent(regionActivities, regionActivityIdsByRegion, event, {
        regionId: event.payload.regionId,
        kind: "objective",
        agentId: event.agentId || "server",
        title: "区域目标开启",
        summary: `${event.payload.title} 已开启，目标分 ${event.payload.targetScore}，奖励 ${event.payload.reward.resourceId}+${event.payload.reward.amount}。`,
        occurredAt: event.payload.createdAt,
        sourceEventType: "contested_objective_created",
      });
      break;
    }
    case "race_commission_completed": {
      const objective = contestedObjectives[event.payload.objectiveId];
      if (!objective) throw new Error("contested_objective_not_found");
      const completion: EpochRaceCompletion = {
        completionId: event.payload.completionId,
        agentId: event.payload.agentId,
        explorerId: event.payload.explorerId,
        place: event.payload.place,
        score: event.payload.score,
        reward: event.payload.reward,
        completedAt: event.payload.completedAt,
      };
      contestedObjectives[event.payload.objectiveId] = {
        ...objective,
        raceCompletions: [...objective.raceCompletions, completion],
        ...(completion.place === 1 ? {
          winnerAgentId: completion.agentId,
          winnerExplorerId: completion.explorerId,
          winningScore: completion.score,
        } : {}),
      };
      addRegionActivityForEvent(regionActivities, regionActivityIdsByRegion, event, {
        regionId: objective.regionId,
        kind: "objective",
        agentId: completion.agentId,
        title: completion.place === 1 ? "竞速委托头名" : "竞速委托完成",
        summary: `${completion.agentId} 第 ${completion.place} 个完成 ${objective.title}，获得 ${completion.reward.resourceId}+${completion.reward.amount}。`,
        occurredAt: completion.completedAt,
        sourceEventType: "race_commission_completed",
      });
      break;
    }
    case "contested_objective_contributed": {
      const objective = contestedObjectives[event.payload.objectiveId];
      if (!objective) throw new Error("contested_objective_not_found");
      const previous = objective.leaderboard.find((standing) => standing.agentId === event.payload.agentId);
      const nextStanding: EpochObjectiveStanding = {
        agentId: event.payload.agentId,
        explorerId: event.payload.explorerId,
        amount: (previous?.amount || 0) + event.payload.amount,
        score: event.payload.agentScoreAfter,
      };
      contestedObjectives[event.payload.objectiveId] = {
        ...objective,
        totalScore: event.payload.totalScoreAfter,
        leaderboard: [
          ...objective.leaderboard.filter((standing) => standing.agentId !== event.payload.agentId),
          nextStanding,
        ].sort((left, right) => right.score - left.score || left.agentId.localeCompare(right.agentId)),
      };
      addRegionActivityForEvent(regionActivities, regionActivityIdsByRegion, event, {
        regionId: objective.regionId,
        kind: "objective",
        agentId: event.payload.agentId,
        title: "目标贡献",
        summary: `${event.payload.agentId} 向 ${objective.title} 投入 ${event.payload.amount} ${event.payload.resourceId}，贡献分 +${event.payload.scoreDelta}，区域总分 ${event.payload.totalScoreAfter}。`,
        occurredAt: event.createdAt,
        sourceEventType: "contested_objective_contributed",
      });
      break;
    }
    case "contested_objective_settled": {
      const objective = contestedObjectives[event.payload.objectiveId];
      if (!objective) throw new Error("contested_objective_not_found");
      contestedObjectives[event.payload.objectiveId] = {
        ...objective,
        status: "settled",
        settledAt: event.payload.settledAt,
        winnerAgentId: event.payload.winnerAgentId,
        winnerExplorerId: event.payload.winnerExplorerId,
        winningScore: event.payload.winningScore,
      };
      addRegionActivityForEvent(regionActivities, regionActivityIdsByRegion, event, {
        regionId: objective.regionId,
        kind: "objective",
        agentId: event.payload.winnerAgentId || "server",
        title: "目标结算",
        summary: `${objective.title} 完成结算，胜者 ${event.payload.winnerAgentId || "暂无"}，最高分 ${event.payload.winningScore}。`,
        occurredAt: event.payload.settledAt,
        sourceEventType: "contested_objective_settled",
      });
      break;
    }
    case "resource_node_spawned": {
      resourceNodes[event.payload.nodeId] = {
        nodeId: event.payload.nodeId,
        regionId: event.payload.regionId,
        title: event.payload.title,
        description: event.payload.description,
        resourceId: event.payload.resourceId,
        reward: event.payload.reward,
        spawnedAt: event.payload.spawnedAt,
        status: "open",
        totalScore: 0,
        leaderboard: [],
      };
      resourceNodeIdsByRegion[event.payload.regionId] = [
        ...(resourceNodeIdsByRegion[event.payload.regionId] || []),
        event.payload.nodeId,
      ].filter((nodeId, index, nodeIds) => nodeIds.indexOf(nodeId) === index);
      addRegionActivityForEvent(regionActivities, regionActivityIdsByRegion, event, {
        regionId: event.payload.regionId,
        kind: "resource_node",
        agentId: event.agentId || "server",
        title: "资源点出现",
        summary: `${event.payload.title} 出现，奖励 ${event.payload.reward.resourceId}+${event.payload.reward.amount}。`,
        occurredAt: event.payload.spawnedAt,
        sourceEventType: "resource_node_spawned",
      });
      break;
    }
    case "resource_node_contested": {
      const node = resourceNodes[event.payload.nodeId];
      if (!node) throw new Error("resource_node_not_found");
      const previous = node.leaderboard.find((standing) => standing.agentId === event.payload.agentId);
      const nextStanding: EpochResourceNodeStanding = {
        agentId: event.payload.agentId,
        explorerId: event.payload.explorerId,
        staminaSpent: (previous?.staminaSpent || 0) + event.payload.staminaSpent,
        score: event.payload.agentScoreAfter,
      };
      resourceNodes[event.payload.nodeId] = {
        ...node,
        totalScore: event.payload.totalScoreAfter,
        leaderboard: [
          ...node.leaderboard.filter((standing) => standing.agentId !== event.payload.agentId),
          nextStanding,
        ].sort((left, right) => right.score - left.score || left.agentId.localeCompare(right.agentId)),
      };
      addRegionActivityForEvent(regionActivities, regionActivityIdsByRegion, event, {
        regionId: node.regionId,
        kind: "resource_node",
        agentId: event.payload.agentId,
        title: "资源点争夺",
        summary: `${event.payload.agentId} 争夺 ${node.title}，消耗体力 ${event.payload.staminaSpent}，争夺分 +${event.payload.scoreDelta}，累计 ${event.payload.agentScoreAfter}。`,
        occurredAt: event.payload.contestedAt,
        sourceEventType: "resource_node_contested",
      });
      break;
    }
    case "resource_node_settled": {
      const node = resourceNodes[event.payload.nodeId];
      if (!node) throw new Error("resource_node_not_found");
      resourceNodes[event.payload.nodeId] = {
        ...node,
        status: "settled",
        settledAt: event.payload.settledAt,
        winnerAgentId: event.payload.winnerAgentId,
        winnerExplorerId: event.payload.winnerExplorerId,
        winningScore: event.payload.winningScore,
      };
      addRegionActivityForEvent(regionActivities, regionActivityIdsByRegion, event, {
        regionId: node.regionId,
        kind: "resource_node",
        agentId: event.payload.winnerAgentId || "server",
        title: "资源点结算",
        summary: `${node.title} 完成结算，胜者 ${event.payload.winnerAgentId || "暂无"}，最高分 ${event.payload.winningScore}。`,
        occurredAt: event.payload.settledAt,
        sourceEventType: "resource_node_settled",
      });
      break;
    }
    case "anomaly_event_spawned": {
      anomalyEvents[event.payload.anomalyId] = {
        anomalyId: event.payload.anomalyId,
        regionId: event.payload.regionId,
        sourceSeasonId: event.payload.sourceSeasonId,
        title: event.payload.title,
        description: event.payload.description,
        ...(event.payload.media ? { media: event.payload.media } : {}),
        severity: event.payload.severity,
        targetScore: event.payload.targetScore,
        reward: event.payload.reward,
        lifetimeRisk: event.payload.lifetimeRisk,
        spawnedAt: event.payload.spawnedAt,
        status: "open",
        totalScore: 0,
        leaderboard: [],
      };
      anomalyEventIdsByRegion[event.payload.regionId] = [
        ...(anomalyEventIdsByRegion[event.payload.regionId] || []),
        event.payload.anomalyId,
      ].filter((anomalyId, index, anomalyIds) => anomalyIds.indexOf(anomalyId) === index);
      addRegionActivityForEvent(regionActivities, regionActivityIdsByRegion, event, {
        regionId: event.payload.regionId,
        kind: "anomaly",
        agentId: event.agentId || "server",
        title: "异常链出现",
        summary: `${event.payload.title} 出现，压制目标 ${event.payload.targetScore}，风险 ${event.payload.lifetimeRisk} 寿命。`,
        occurredAt: event.payload.spawnedAt,
        sourceEventType: "anomaly_event_spawned",
      });
      break;
    }
    case "anomaly_event_contested": {
      const anomaly = anomalyEvents[event.payload.anomalyId];
      if (!anomaly) throw new Error("anomaly_event_not_found");
      const previous = anomaly.leaderboard.find((standing) => standing.agentId === event.payload.agentId);
      const nextStanding: EpochAnomalyStanding = {
        agentId: event.payload.agentId,
        explorerId: event.payload.explorerId,
        focusSpent: (previous?.focusSpent || 0) + event.payload.focusSpent,
        score: event.payload.agentScoreAfter,
      };
      anomalyEvents[event.payload.anomalyId] = {
        ...anomaly,
        totalScore: event.payload.totalScoreAfter,
        leaderboard: [
          ...anomaly.leaderboard.filter((standing) => standing.agentId !== event.payload.agentId),
          nextStanding,
        ].sort((left, right) => right.score - left.score || left.agentId.localeCompare(right.agentId)),
      };
      addRegionActivityForEvent(regionActivities, regionActivityIdsByRegion, event, {
        regionId: anomaly.regionId,
        kind: "anomaly",
        agentId: event.payload.agentId,
        title: "异常链压制",
        summary: `${event.payload.agentId} 压制 ${anomaly.title}，消耗专注 ${event.payload.focusSpent}，压制分 +${event.payload.scoreDelta}，累计 ${event.payload.agentScoreAfter}。`,
        occurredAt: event.payload.contestedAt,
        sourceEventType: "anomaly_event_contested",
      });
      break;
    }
    case "anomaly_event_resolved": {
      const anomaly = anomalyEvents[event.payload.anomalyId];
      if (!anomaly) throw new Error("anomaly_event_not_found");
      anomalyEvents[event.payload.anomalyId] = {
        ...anomaly,
        status: "resolved",
        resolvedAt: event.payload.resolvedAt,
        outcome: event.payload.outcome,
        winnerAgentId: event.payload.winnerAgentId,
        winnerExplorerId: event.payload.winnerExplorerId,
        winningScore: event.payload.winningScore,
      };
      addRegionActivityForEvent(regionActivities, regionActivityIdsByRegion, event, {
        regionId: anomaly.regionId,
        kind: "anomaly",
        agentId: event.payload.winnerAgentId || "server",
        title: "异常链结算",
        summary: `${anomaly.title} ${event.payload.outcome === "contained" ? "完成压制" : "失控逸散"}，胜者 ${event.payload.winnerAgentId || "暂无"}，最高分 ${event.payload.winningScore}。`,
        occurredAt: event.payload.resolvedAt,
        sourceEventType: "anomaly_event_resolved",
      });
      break;
    }
    case "season_campaign_created": {
      const payload = event.payload;
      seasonCampaigns[payload.seasonId] = {
        seasonId: payload.seasonId,
        seasonKey: payload.seasonKey,
        title: payload.title,
        description: payload.description,
        regionIds: payload.regionIds,
        factionIds: payload.factionIds,
        resourceId: payload.resourceId,
        targetScore: payload.targetScore,
        reward: payload.reward,
        createdAt: payload.createdAt,
        status: "active",
        phaseEvents: [],
        objectives: [],
        contributions: [],
        totalScore: 0,
        factionStandings: payload.factionIds.map((factionId) => ({
          factionId,
          score: 0,
          trustedScore: 0,
          dominantTrustClass: "untrusted_client",
          trustBreakdown: {},
        })),
        agentStandings: [],
      };
      for (const regionId of payload.regionIds) {
        seasonCampaignIdsByRegion[regionId] = [
          ...(seasonCampaignIdsByRegion[regionId] || []),
          payload.seasonId,
        ].filter((seasonId, index, seasonIds) => seasonIds.indexOf(seasonId) === index);
      }
      for (const factionId of payload.factionIds) {
        seasonCampaignIdsByFaction[factionId] = [
          ...(seasonCampaignIdsByFaction[factionId] || []),
          payload.seasonId,
        ].filter((seasonId, index, seasonIds) => seasonIds.indexOf(seasonId) === index);
      }
      addRegionActivitiesForEventRegions(regionActivities, regionActivityIdsByRegion, event, payload.regionIds, {
        kind: "season",
        agentId: event.agentId || "server",
        title: "赛季创建",
        summary: `${payload.title} 已创建，阵营 ${payload.factionIds.join(" / ")}，目标分 ${payload.targetScore}。`,
        occurredAt: payload.createdAt,
        sourceEventType: "season_campaign_created",
      });
      break;
    }
    case "season_started": {
      const campaign = seasonCampaigns[event.payload.seasonId];
      if (!campaign) throw new Error("season_campaign_not_found");
      const phaseEvent: EpochSeasonPhaseEvent = {
        eventId: event.eventId,
        eventType: "season_started",
        phase: event.payload.phase,
        sourceEventId: event.payload.sourceEventId,
        relatedEventIds: [],
        at: event.payload.startedAt,
      };
      seasonCampaigns[event.payload.seasonId] = {
        ...campaign,
        status: "active",
        phaseEvents: [
          ...campaign.phaseEvents.filter((existing) => existing.eventId !== event.eventId),
          phaseEvent,
        ],
      };
      addRegionActivitiesForEventRegions(regionActivities, regionActivityIdsByRegion, event, event.payload.regionIds, {
        kind: "season",
        agentId: event.agentId || "server",
        title: "赛季开启",
        summary: `${event.payload.title} 已开启，参与阵营 ${event.payload.factionIds.join(" / ")}。`,
        occurredAt: event.payload.startedAt,
        sourceEventType: "season_started",
      });
      break;
    }
    case "season_objective_created": {
      const payload = event.payload;
      const objective: EpochSeasonObjective = {
        objectiveId: payload.objectiveId,
        seasonId: payload.seasonId,
        objectiveKey: payload.objectiveKey,
        title: payload.title,
        description: payload.description,
        targetScore: payload.targetScore,
        progressScore: 0,
        status: "open",
        createdAt: payload.createdAt,
      };
      seasonObjectives[payload.objectiveId] = objective;
      seasonObjectiveIdsBySeason[payload.seasonId] = [
        ...(seasonObjectiveIdsBySeason[payload.seasonId] || []),
        payload.objectiveId,
      ].filter((objectiveId, index, objectiveIds) => objectiveIds.indexOf(objectiveId) === index);
      const campaign = seasonCampaigns[payload.seasonId];
      if (campaign) {
        seasonCampaigns[payload.seasonId] = {
          ...campaign,
          objectives: [
            ...campaign.objectives.filter((existing) => existing.objectiveId !== payload.objectiveId),
            objective,
          ],
        };
        addRegionActivitiesForEventRegions(regionActivities, regionActivityIdsByRegion, event, campaign.regionIds, {
          kind: "season",
          agentId: event.agentId || "server",
          title: "赛季目标生成",
          summary: `${campaign.title} 生成目标 ${payload.title}，目标分 ${payload.targetScore}。`,
          occurredAt: payload.createdAt,
          sourceEventType: "season_objective_created",
        });
      }
      break;
    }
    case "season_contribution_recorded": {
      const campaign = seasonCampaigns[event.payload.seasonId];
      if (!campaign) throw new Error("season_campaign_not_found");
      const trustClass = normalizeTrustClass(event.trustClass);
      const trustedScoreDelta = trustedSeasonScoreDelta(trustClass, event.payload.scoreDelta);
      const previousAgent = campaign.agentStandings.find((standing) =>
        standing.agentId === event.payload.agentId && standing.factionId === event.payload.factionId);
      const agentTrustBreakdown = addSeasonTrustScore(
        previousAgent?.trustBreakdown,
        trustClass,
        event.payload.scoreDelta,
      );
      const nextAgentStanding: EpochSeasonAgentStanding = {
        agentId: event.payload.agentId,
        explorerId: event.payload.explorerId,
        factionId: event.payload.factionId,
        amount: (previousAgent?.amount || 0) + event.payload.amount,
        score: event.payload.agentScoreAfter,
        trustedScore: (previousAgent?.trustedScore ?? 0) + trustedScoreDelta,
        dominantTrustClass: dominantSeasonTrustClass(agentTrustBreakdown),
        trustBreakdown: agentTrustBreakdown,
      };
      const factionStandings = campaign.factionStandings
        .map((standing) => {
          const existingBreakdown = normalizeSeasonTrustBreakdown(standing.trustBreakdown);
          if (standing.factionId !== event.payload.factionId) {
            return {
              ...standing,
              trustedScore: standing.trustedScore ?? 0,
              dominantTrustClass: standing.dominantTrustClass ?? dominantSeasonTrustClass(existingBreakdown),
              trustBreakdown: existingBreakdown,
            };
          }
          const trustBreakdown = addSeasonTrustScore(existingBreakdown, trustClass, event.payload.scoreDelta);
          return {
            ...standing,
            score: event.payload.factionScoreAfter,
            trustedScore: (standing.trustedScore ?? 0) + trustedScoreDelta,
            dominantTrustClass: dominantSeasonTrustClass(trustBreakdown),
            trustBreakdown,
          };
        })
        .sort((left, right) => right.score - left.score || left.factionId.localeCompare(right.factionId));
      const agentStandings = [
        ...campaign.agentStandings.filter((standing) =>
          !(standing.agentId === event.payload.agentId && standing.factionId === event.payload.factionId)),
        nextAgentStanding,
      ].sort((left, right) => right.score - left.score || left.agentId.localeCompare(right.agentId));
      const objectives = (seasonObjectiveIdsBySeason[event.payload.seasonId] || [])
        .map((objectiveId) => seasonObjectives[objectiveId])
        .filter((objective): objective is EpochSeasonObjective => Boolean(objective))
        .map((objective) => {
          if (objective.status === "completed") return objective;
          const nextObjective = {
            ...objective,
            progressScore: Math.min(objective.targetScore, event.payload.totalScoreAfter),
          };
          seasonObjectives[objective.objectiveId] = nextObjective;
          return nextObjective;
        });
      const contribution: EpochSeasonContribution = {
        eventId: event.eventId,
        seasonId: event.payload.seasonId,
        agentId: event.payload.agentId,
        explorerId: event.payload.explorerId,
        factionId: event.payload.factionId,
        resourceId: event.payload.resourceId,
        amount: event.payload.amount,
        baseScoreDelta: event.payload.baseScoreDelta,
        organizationBonusScore: event.payload.organizationBonusScore,
        regionControlBonusScore: event.payload.regionControlBonusScore ?? 0,
        scoreDelta: event.payload.scoreDelta,
        sourceOrganizationUpgradeIds: event.payload.sourceOrganizationUpgradeIds,
        sourceRegionControlRegionIds: event.payload.sourceRegionControlRegionIds ?? [],
        agentScoreAfter: event.payload.agentScoreAfter,
        factionScoreAfter: event.payload.factionScoreAfter,
        totalScoreAfter: event.payload.totalScoreAfter,
        trustClass,
        recordedAt: event.payload.recordedAt,
      };
      seasonCampaigns[event.payload.seasonId] = {
        ...campaign,
        totalScore: event.payload.totalScoreAfter,
        factionStandings,
        agentStandings,
        objectives,
        contributions: [
          ...campaign.contributions.filter((item) => item.eventId !== contribution.eventId),
          contribution,
        ].sort((left, right) => left.recordedAt.localeCompare(right.recordedAt) || left.eventId.localeCompare(right.eventId)),
      };
      addRegionActivitiesForEventRegions(regionActivities, regionActivityIdsByRegion, event, campaign.regionIds, {
        kind: "season",
        agentId: event.payload.agentId,
        title: "赛季贡献",
        summary: `${event.payload.agentId} 为 ${event.payload.factionId} 投入 ${event.payload.amount} ${event.payload.resourceId}，赛季分 +${event.payload.scoreDelta}${event.payload.organizationBonusScore > 0 ? `（组织训练厅 +${event.payload.organizationBonusScore}）` : ""}，总分 ${event.payload.totalScoreAfter}。`,
        occurredAt: event.payload.recordedAt,
        sourceEventType: "season_contribution_recorded",
      });
      break;
    }
    case "season_objective_completed": {
      const objective = seasonObjectives[event.payload.objectiveId];
      if (!objective) throw new Error("season_objective_not_found");
      const completedObjective: EpochSeasonObjective = {
        ...objective,
        status: "completed",
        progressScore: event.payload.progressScore,
        sourceEventId: event.payload.sourceEventId,
        completedAt: event.payload.completedAt,
        completedByAgentId: event.payload.completedByAgentId,
        completedByExplorerId: event.payload.completedByExplorerId,
        completedByFactionId: event.payload.completedByFactionId,
      };
      seasonObjectives[event.payload.objectiveId] = completedObjective;
      const campaign = seasonCampaigns[event.payload.seasonId];
      if (campaign) {
        seasonCampaigns[event.payload.seasonId] = {
          ...campaign,
          objectives: (seasonObjectiveIdsBySeason[event.payload.seasonId] || [])
            .map((objectiveId) => seasonObjectives[objectiveId])
            .filter((seasonObjective): seasonObjective is EpochSeasonObjective => Boolean(seasonObjective)),
        };
        addRegionActivitiesForEventRegions(regionActivities, regionActivityIdsByRegion, event, campaign.regionIds, {
          kind: "season",
          agentId: event.payload.completedByAgentId,
          title: "赛季目标完成",
          summary: `${event.payload.completedByFactionId} 完成 ${objective.title}，进度 ${event.payload.progressScore}/${event.payload.targetScore}。`,
          occurredAt: event.payload.completedAt,
          sourceEventType: "season_objective_completed",
        });
      }
      break;
    }
    case "season_campaign_resolved": {
      const campaign = seasonCampaigns[event.payload.seasonId];
      if (!campaign) throw new Error("season_campaign_not_found");
      seasonCampaigns[event.payload.seasonId] = {
        ...campaign,
        status: "resolved",
        resolvedAt: event.payload.resolvedAt,
        winningFactionId: event.payload.winningFactionId,
        winnerAgentId: event.payload.winnerAgentId,
        winnerExplorerId: event.payload.winnerExplorerId,
        winningScore: event.payload.winningScore,
      };
      addRegionActivitiesForEventRegions(regionActivities, regionActivityIdsByRegion, event, campaign.regionIds, {
        kind: "season",
        agentId: event.payload.winnerAgentId || "server",
        title: "赛季结算",
        summary: `${campaign.title} 完成结算，胜者阵营 ${event.payload.winningFactionId || "暂无"}，胜者 ${event.payload.winnerAgentId || "暂无"}，分数 ${event.payload.winningScore}。`,
        occurredAt: event.payload.resolvedAt,
        sourceEventType: "season_campaign_resolved",
      });
      break;
    }
    case "season_resolved": {
      const campaign = seasonCampaigns[event.payload.seasonId];
      if (!campaign) throw new Error("season_campaign_not_found");
      const phaseEvent: EpochSeasonPhaseEvent = {
        eventId: event.eventId,
        eventType: "season_resolved",
        phase: event.payload.phase,
        sourceEventId: event.payload.sourceEventId,
        relatedEventIds: event.payload.relatedEventIds,
        at: event.payload.resolvedAt,
      };
      seasonCampaigns[event.payload.seasonId] = {
        ...campaign,
        status: "resolved",
        phaseEvents: [
          ...campaign.phaseEvents.filter((existing) => existing.eventId !== event.eventId),
          phaseEvent,
        ],
      };
      addRegionActivitiesForEventRegions(regionActivities, regionActivityIdsByRegion, event, campaign.regionIds, {
        kind: "season",
        agentId: event.payload.winnerAgentId || "server",
        title: "赛季归档",
        summary: `${campaign.title} 已归档，胜者阵营 ${event.payload.winningFactionId || "暂无"}，关联事件 ${event.payload.relatedEventIds.length} 个。`,
        occurredAt: event.payload.resolvedAt,
        sourceEventType: "season_resolved",
      });
      break;
    }
    case "agent_faction_standing_changed": {
      const payload = event.payload;
      const existing = agentFactionStandings[payload.standingId];
      agentFactionStandings[payload.standingId] = {
        standingId: payload.standingId,
        agentId: payload.agentId,
        explorerId: payload.explorerId,
        factionId: payload.factionId,
        score: payload.standingAfter,
        routeIds: uniqueValues([...(existing?.routeIds || []), payload.routeId]),
        journeyIds: uniqueValues([...(existing?.journeyIds || []), payload.journeyId]),
        sourceEventIds: uniqueValues([...(existing?.sourceEventIds || []), payload.sourceEventId]),
        updatedAt: payload.changedAt,
        worldMinute: payload.worldMinute,
      };
      factionStandingIdsByAgent[payload.agentId] = uniqueValues([
        ...(factionStandingIdsByAgent[payload.agentId] || []),
        payload.standingId,
      ]);
      factionStandingIdsByFaction[payload.factionId] = uniqueValues([
        ...(factionStandingIdsByFaction[payload.factionId] || []),
        payload.standingId,
      ]);
      break;
    }
    case "region_influence_changed": {
      const payload = event.payload;
      regionInfluenceChanges[payload.influenceId] = {
        influenceId: payload.influenceId,
        regionId: payload.regionId,
        agentId: payload.agentId,
        explorerId: payload.explorerId,
        influenceDelta: payload.influenceDelta,
        influenceScoreAfter: payload.influenceScoreAfter,
        reason: payload.reason,
        sourceEventId: payload.sourceEventId,
        sourceEventType: payload.sourceEventType,
        sourceAggregateId: payload.sourceAggregateId,
        changedAt: payload.changedAt,
        ...(payload.worldMinute === undefined ? {} : { worldMinute: payload.worldMinute }),
      };
      regionInfluenceIdsByRegion[payload.regionId] = [
        ...(regionInfluenceIdsByRegion[payload.regionId] || []),
        payload.influenceId,
      ].filter((influenceId, index, influenceIds) => influenceIds.indexOf(influenceId) === index);
      regionInfluenceIdsByAgent[payload.agentId] = [
        ...(regionInfluenceIdsByAgent[payload.agentId] || []),
        payload.influenceId,
      ].filter((influenceId, index, influenceIds) => influenceIds.indexOf(influenceId) === index);
      break;
    }
    case "trace_created": {
      const payload = event.payload;
      conflictTraces[payload.traceId] = {
        traceId: payload.traceId,
        regionId: payload.regionId,
        title: payload.title,
        summary: payload.summary,
        sourceEventType: payload.sourceEventType,
        sourceEventIds: payload.sourceEventIds,
        sourceAggregateId: payload.sourceAggregateId,
        relatedInfluenceIds: payload.relatedInfluenceIds,
        participantAgentIds: payload.participantAgentIds,
        participantExplorerIds: payload.participantExplorerIds,
        scoutAgentIds: payload.scoutAgentIds,
        parentTraceId: payload.parentTraceId,
        createdAt: payload.createdAt,
      };
      traceIdsByRegion[payload.regionId] = [
        ...(traceIdsByRegion[payload.regionId] || []),
        payload.traceId,
      ].filter((traceId, index, traceIds) => traceIds.indexOf(traceId) === index);
      for (const agentId of payload.participantAgentIds) {
        traceIdsByAgent[agentId] = [
          ...(traceIdsByAgent[agentId] || []),
          payload.traceId,
        ].filter((traceId, index, traceIds) => traceIds.indexOf(traceId) === index);
      }
      break;
    }
    case "region_control_changed": {
      regionControls[event.payload.regionId] = {
        regionId: event.payload.regionId,
        controllingFactionId: event.payload.controllingFactionId,
        previousControllingFactionId: event.payload.previousControllingFactionId,
        controlScore: event.payload.controlScore,
        contestedByFactionId: event.payload.contestedByFactionId,
        controlMargin: event.payload.controlMargin,
        sourceSeasonId: event.payload.sourceSeasonId,
        sourceReleaseId: event.payload.sourceReleaseId,
        previousControlSourceSeasonId: event.payload.previousControlSourceSeasonId,
        claimingAgentId: event.payload.claimingAgentId,
        claimingExplorerId: event.payload.claimingExplorerId,
        updatedAt: event.payload.changedAt,
      };
      break;
    }
    case "region_control_decayed": {
      const existing = regionControls[event.payload.regionId];
      if (!existing) break;
      regionControls[event.payload.regionId] = {
        ...existing,
        controlScore: event.payload.scoreAfter,
        controlMargin: event.payload.controlMarginAfter,
        updatedAt: event.payload.decayedAt,
      };
      break;
    }
    case "region_control_released": {
      delete regionControls[event.payload.regionId];
      break;
    }
    case "region_revolt_resolved": {
      addRegionActivityForEvent(regionActivities, regionActivityIdsByRegion, event, {
        regionId: event.payload.regionId,
        kind: "revolt",
        agentId: event.payload.rebelAgentId,
        title: "区域起义",
        summary: `${event.payload.rebelAgentId} 代表 ${event.payload.rebelFactionId} 发起控制起义，结果 ${event.payload.outcome}，攻防 ${event.payload.rebelPower}/${event.payload.defenderPower}。`,
        occurredAt: event.payload.resolvedAt,
        sourceEventType: "region_revolt_resolved",
      });
      break;
    }
    case "region_monument_built": {
      regionMonuments[event.payload.monumentId] = {
        monumentId: event.payload.monumentId,
        regionId: event.payload.regionId,
        title: event.payload.title,
        description: event.payload.description,
        controllingFactionId: event.payload.controllingFactionId,
        winnerAgentId: event.payload.winnerAgentId,
        winnerExplorerId: event.payload.winnerExplorerId,
        sourceSeasonId: event.payload.sourceSeasonId,
        controlScore: event.payload.controlScore,
        builtAt: event.payload.builtAt,
      };
      regionMonumentIdsByRegion[event.payload.regionId] = [
        ...(regionMonumentIdsByRegion[event.payload.regionId] || []),
        event.payload.monumentId,
      ].filter((monumentId, index, monumentIds) => monumentIds.indexOf(monumentId) === index);
      break;
    }
    case "market_order_created": {
      const sellKind = event.payload.sellKind || "resource";
      const regionId = normalizeMarketRegionId(event.payload.regionId);
      marketOrders[event.payload.orderId] = {
        orderId: event.payload.orderId,
        regionId,
        sellerAgentId: event.payload.sellerAgentId,
        sellerExplorerId: event.payload.sellerExplorerId,
        sellKind,
        sellResourceId: event.payload.sellResourceId,
        sellAmount: event.payload.sellAmount,
        sellItemId: event.payload.sellItemId,
        sellItemKey: event.payload.sellItemKey,
        sellItemDisplayName: event.payload.sellItemDisplayName,
        sellItemRarity: event.payload.sellItemRarity,
        priceResourceId: event.payload.priceResourceId,
        priceAmount: event.payload.priceAmount,
        status: "open",
        createdAt: event.payload.createdAt,
      };
      if (sellKind === "item" && event.payload.sellItemId) {
        const item = inventoryItems[event.payload.sellItemId];
        if (!item) throw new Error("inventory_item_not_found");
        inventoryItems[event.payload.sellItemId] = {
          ...item,
          marketLockedByOrderId: event.payload.orderId,
        };
      }
      const goodsLabel = sellKind === "item"
        ? event.payload.sellItemDisplayName || event.payload.sellItemKey || event.payload.sellItemId || "物品"
        : `${event.payload.sellAmount} ${event.payload.sellResourceId}`;
      addRegionActivityForEvent(regionActivities, regionActivityIdsByRegion, event, {
        regionId,
        kind: "market",
        agentId: event.payload.sellerAgentId,
        title: "市场挂单",
        summary: `${event.payload.sellerAgentId} 在本地市场挂出 ${goodsLabel}，标价 ${event.payload.priceAmount} ${event.payload.priceResourceId}。`,
        occurredAt: event.payload.createdAt,
        sourceEventType: "market_order_created",
      });
      break;
    }
    case "market_order_filled": {
      const order = marketOrders[event.payload.orderId];
      if (!order) throw new Error("market_order_not_found");
      marketOrders[event.payload.orderId] = {
        ...order,
        status: "filled",
        buyerAgentId: event.payload.buyerAgentId,
        buyerExplorerId: event.payload.buyerExplorerId,
        marketFeeResourceId: event.payload.marketFeeResourceId,
        marketFeeAmount: event.payload.marketFeeAmount,
        sellerProceedsAmount: event.payload.sellerProceedsAmount,
        transferredItemId: event.payload.transferredItemId,
        tradeRiskFlags: event.payload.tradeRiskFlags || [],
        tradeRiskScore: event.payload.tradeRiskScore ?? 0,
        filledAt: event.payload.filledAt,
      };
      const goodsLabel = order.sellKind === "item"
        ? order.sellItemDisplayName || order.sellItemKey || order.sellItemId || "物品"
        : `${order.sellAmount} ${order.sellResourceId}`;
      addRegionActivityForEvent(regionActivities, regionActivityIdsByRegion, event, {
        regionId: order.regionId,
        kind: "market",
        agentId: event.payload.buyerAgentId,
        title: "市场成交",
        summary: `${event.payload.buyerAgentId} 买下 ${order.sellerAgentId} 挂出的 ${goodsLabel}，成交价 ${order.priceAmount} ${order.priceResourceId}。`,
        occurredAt: event.payload.filledAt,
        sourceEventType: "market_order_filled",
      });
      break;
    }
    case "market_order_cancelled": {
      const order = marketOrders[event.payload.orderId];
      if (!order) throw new Error("market_order_not_found");
      marketOrders[event.payload.orderId] = {
        ...order,
        status: "cancelled",
        cancelledAt: event.payload.cancelledAt,
      };
      if (order.sellKind === "item" && order.sellItemId) {
        const item = inventoryItems[order.sellItemId];
        if (item?.marketLockedByOrderId === order.orderId) {
          inventoryItems[order.sellItemId] = {
            ...item,
            marketLockedByOrderId: undefined,
          };
        }
      }
      addRegionActivityForEvent(regionActivities, regionActivityIdsByRegion, event, {
        regionId: order.regionId,
        kind: "market",
        agentId: event.payload.sellerAgentId,
        title: "市场撤单",
        summary: `${event.payload.sellerAgentId} 撤回本地市场订单 ${event.payload.orderId}。`,
        occurredAt: event.payload.cancelledAt,
        sourceEventType: "market_order_cancelled",
      });
      break;
    }
    case "market_order_expired": {
      const order = marketOrders[event.payload.orderId];
      if (!order) throw new Error("market_order_not_found");
      marketOrders[event.payload.orderId] = {
        ...order,
        status: "expired",
        expiredAt: event.payload.expiredAt,
      };
      if (order.sellKind === "item" && order.sellItemId) {
        const item = inventoryItems[order.sellItemId];
        if (item?.marketLockedByOrderId === order.orderId) {
          inventoryItems[order.sellItemId] = {
            ...item,
            marketLockedByOrderId: undefined,
          };
        }
      }
      addRegionActivityForEvent(regionActivities, regionActivityIdsByRegion, event, {
        regionId: order.regionId,
        kind: "market",
        agentId: event.payload.sellerAgentId,
        title: "市场过期",
        summary: `${event.payload.sellerAgentId} 的本地市场订单 ${event.payload.orderId} 超时退回，最大挂单时长 ${event.payload.maxAgeSeconds} 秒。`,
        occurredAt: event.payload.expiredAt,
        sourceEventType: "market_order_expired",
      });
      break;
    }
    case "direct_trade_created": {
      const payload = event.payload;
      const offeredAsset = directTradeAssetFromPayload(payload.offeredAsset);
      const requestedAsset = directTradeAssetFromPayload(payload.requestedAsset);
      directTrades[payload.tradeId] = {
        tradeId: payload.tradeId,
        regionId: normalizeMarketRegionId(payload.regionId),
        proposerAgentId: payload.proposerAgentId,
        proposerExplorerId: payload.proposerExplorerId,
        counterpartyAgentId: payload.counterpartyAgentId,
        counterpartyExplorerId: payload.counterpartyExplorerId,
        offeredAsset,
        requestedAsset,
        status: "open",
        createdAt: payload.createdAt,
      };
      if (offeredAsset.kind === "item" && offeredAsset.itemId) {
        const item = inventoryItems[offeredAsset.itemId];
        if (!item) throw new Error("inventory_item_not_found");
        inventoryItems[offeredAsset.itemId] = {
          ...item,
          marketLockedByOrderId: payload.tradeId,
        };
      }
      addRegionActivityForEvent(regionActivities, regionActivityIdsByRegion, event, {
        regionId: normalizeMarketRegionId(payload.regionId),
        kind: "market",
        agentId: payload.proposerAgentId,
        title: "直交易创建",
        summary: `${payload.proposerAgentId} 向 ${payload.counterpartyAgentId} 发起直交易：${directTradeAssetLabel(offeredAsset)} 换 ${directTradeAssetLabel(requestedAsset)}。`,
        occurredAt: payload.createdAt,
        sourceEventType: "direct_trade_created",
      });
      break;
    }
    case "direct_trade_accepted": {
      const trade = directTrades[event.payload.tradeId];
      if (!trade) throw new Error("direct_trade_not_found");
      directTrades[event.payload.tradeId] = {
        ...trade,
        status: "accepted",
        transferredOfferedItemId: event.payload.transferredOfferedItemId,
        transferredRequestedItemId: event.payload.transferredRequestedItemId,
        tradeRiskFlags: event.payload.tradeRiskFlags || [],
        tradeRiskScore: event.payload.tradeRiskScore ?? 0,
        acceptedAt: event.payload.acceptedAt,
      };
      addRegionActivityForEvent(regionActivities, regionActivityIdsByRegion, event, {
        regionId: trade.regionId,
        kind: "market",
        agentId: event.payload.counterpartyAgentId,
        title: "直交易成交",
        summary: `${event.payload.counterpartyAgentId} 接受 ${event.payload.proposerAgentId} 的直交易：${directTradeAssetLabel(trade.offeredAsset)} 换 ${directTradeAssetLabel(trade.requestedAsset)}。`,
        occurredAt: event.payload.acceptedAt,
        sourceEventType: "direct_trade_accepted",
      });
      break;
    }
    case "direct_trade_cancelled": {
      const trade = directTrades[event.payload.tradeId];
      if (!trade) throw new Error("direct_trade_not_found");
      directTrades[event.payload.tradeId] = {
        ...trade,
        status: "cancelled",
        cancelledAt: event.payload.cancelledAt,
      };
      if (trade.offeredAsset.kind === "item" && trade.offeredAsset.itemId) {
        const item = inventoryItems[trade.offeredAsset.itemId];
        if (item?.marketLockedByOrderId === trade.tradeId) {
          inventoryItems[trade.offeredAsset.itemId] = {
            ...item,
            marketLockedByOrderId: undefined,
          };
        }
      }
      addRegionActivityForEvent(regionActivities, regionActivityIdsByRegion, event, {
        regionId: trade.regionId,
        kind: "market",
        agentId: event.payload.proposerAgentId,
        title: "直交易取消",
        summary: `${event.payload.proposerAgentId} 取消直交易 ${event.payload.tradeId}。`,
        occurredAt: event.payload.cancelledAt,
        sourceEventType: "direct_trade_cancelled",
      });
      break;
    }
    case "direct_trade_expired": {
      const trade = directTrades[event.payload.tradeId];
      if (!trade) throw new Error("direct_trade_not_found");
      directTrades[event.payload.tradeId] = {
        ...trade,
        status: "expired",
        expiredAt: event.payload.expiredAt,
      };
      if (trade.offeredAsset.kind === "item" && trade.offeredAsset.itemId) {
        const item = inventoryItems[trade.offeredAsset.itemId];
        if (item?.marketLockedByOrderId === trade.tradeId) {
          inventoryItems[trade.offeredAsset.itemId] = {
            ...item,
            marketLockedByOrderId: undefined,
          };
        }
      }
      addRegionActivityForEvent(regionActivities, regionActivityIdsByRegion, event, {
        regionId: trade.regionId,
        kind: "market",
        agentId: event.payload.proposerAgentId,
        title: "直交易过期",
        summary: `${event.payload.proposerAgentId} 的直交易 ${event.payload.tradeId} 超时退回，最大保留时长 ${event.payload.maxAgeSeconds} 秒。`,
        occurredAt: event.payload.expiredAt,
        sourceEventType: "direct_trade_expired",
      });
      break;
    }
    case "bounty_created": {
      const payload = event.payload;
      bounties[payload.bountyId] = {
        bountyId: payload.bountyId,
        regionId: payload.regionId,
        sponsorAgentId: payload.sponsorAgentId,
        sponsorExplorerId: payload.sponsorExplorerId,
        title: payload.title,
        description: payload.description,
        rewardResourceId: payload.rewardResourceId,
        rewardAmount: payload.rewardAmount,
        requiredItemKey: payload.requiredItemKey,
        status: "open",
        createdAt: payload.createdAt,
      };
      bountyIdsByRegion[payload.regionId] = [
        ...(bountyIdsByRegion[payload.regionId] || []),
        payload.bountyId,
      ].filter((bountyId, index, bountyIds) => bountyIds.indexOf(bountyId) === index);
      bountyIdsByAgent[payload.sponsorAgentId] = [
        ...(bountyIdsByAgent[payload.sponsorAgentId] || []),
        payload.bountyId,
      ].filter((bountyId, index, bountyIds) => bountyIds.indexOf(bountyId) === index);
      addRegionActivityForEvent(regionActivities, regionActivityIdsByRegion, event, {
        regionId: payload.regionId,
        kind: "bounty",
        agentId: payload.sponsorAgentId,
        title: "悬赏发布",
        summary: `${payload.sponsorAgentId} 发布悬赏 ${payload.title}，奖励 ${payload.rewardResourceId}+${payload.rewardAmount}。`,
        occurredAt: payload.createdAt,
        sourceEventType: "bounty_created",
      });
      break;
    }
    case "bounty_claimed": {
      const bounty = bounties[event.payload.bountyId];
      if (!bounty) throw new Error("bounty_not_found");
      bounties[event.payload.bountyId] = {
        ...bounty,
        status: "claimed",
        claimantAgentId: event.payload.claimantAgentId,
        claimantExplorerId: event.payload.claimantExplorerId,
        transferredItemId: event.payload.transferredItemId,
        evidence: event.payload.evidence,
        claimedAt: event.payload.claimedAt,
      };
      bountyIdsByAgent[event.payload.claimantAgentId] = [
        ...(bountyIdsByAgent[event.payload.claimantAgentId] || []),
        event.payload.bountyId,
      ].filter((bountyId, index, bountyIds) => bountyIds.indexOf(bountyId) === index);
      addRegionActivityForEvent(regionActivities, regionActivityIdsByRegion, event, {
        regionId: bounty.regionId,
        kind: "bounty",
        agentId: event.payload.claimantAgentId,
        title: "悬赏完成",
        summary: `${event.payload.claimantAgentId} 完成悬赏 ${bounty.title}，证据已由服务器记录。`,
        occurredAt: event.payload.claimedAt,
        sourceEventType: "bounty_claimed",
      });
      break;
    }
    case "party_run_created": {
      const payload = event.payload;
      const leaderMember: EpochPartyMember = {
        agentId: payload.leaderAgentId,
        explorerId: payload.leaderExplorerId,
        participantRole: payload.participantRole,
        joinedAt: payload.createdAt,
      };
      partyRuns[payload.partyRunId] = {
        partyRunId: payload.partyRunId,
        regionId: payload.regionId,
        leaderAgentId: payload.leaderAgentId,
        leaderExplorerId: payload.leaderExplorerId,
        title: payload.title,
        objective: payload.objective,
        joinPolicy: payload.joinPolicy || "open",
        inviteTokenHash: payload.inviteTokenHash,
        inviteTokenExpiresAt: payload.inviteTokenExpiresAt,
        inviteTokenUseLimit: payload.inviteTokenUseLimit,
        inviteTokenUses: payload.inviteTokenUses,
        inviteRecipientAgentId: payload.inviteRecipientAgentId,
        status: "open",
        members: [leaderMember],
        joinRequests: [],
        createdAt: payload.createdAt,
        updatedAt: payload.createdAt,
      };
      partyRunIdsByRegion[payload.regionId] = [
        ...(partyRunIdsByRegion[payload.regionId] || []),
        payload.partyRunId,
      ].filter((partyRunId, index, partyRunIds) => partyRunIds.indexOf(partyRunId) === index);
      addRegionActivityForEvent(regionActivities, regionActivityIdsByRegion, event, {
        regionId: payload.regionId,
        kind: "party_run",
        agentId: payload.leaderAgentId,
        title: "小队开启",
        summary: `${payload.leaderAgentId} 开启小队 ${payload.title}，目标：${payload.objective}`,
        occurredAt: payload.createdAt,
        sourceEventType: "party_run_created",
      });
      break;
    }
    case "party_invite_updated": {
      const payload = event.payload;
      const partyRun = partyRuns[payload.partyRunId];
      if (!partyRun) throw new Error("party_run_not_found");
      partyRuns[payload.partyRunId] = {
        ...partyRun,
        joinPolicy: "invite_only",
        inviteTokenHash: payload.inviteTokenHash,
        inviteTokenExpiresAt: payload.inviteTokenExpiresAt,
        inviteTokenUseLimit: payload.inviteTokenUseLimit,
        inviteTokenUses: payload.inviteTokenUses,
        inviteRecipientAgentId: payload.inviteRecipientAgentId,
        inviteTokenRevokedAt: payload.inviteTokenRevokedAt,
        updatedAt: payload.updatedAt,
      };
      addRegionActivityForEvent(regionActivities, regionActivityIdsByRegion, event, {
        regionId: payload.regionId,
        kind: "party_run",
        agentId: payload.leaderAgentId,
        title: payload.updateKind === "revoked" ? "小队邀请撤销" : "小队邀请更新",
        summary: payload.updateKind === "revoked"
          ? `${payload.leaderAgentId} 撤销了小队邀请。`
          : `${payload.leaderAgentId} 更新了小队邀请。`,
        occurredAt: payload.updatedAt,
        sourceEventType: "party_invite_updated",
      });
      break;
    }
    case "party_join_requested": {
      const payload = event.payload;
      const partyRun = partyRuns[payload.partyRunId];
      if (!partyRun) throw new Error("party_run_not_found");
      const request: EpochPartyJoinRequest = {
        requestId: payload.requestId,
        partyRunId: payload.partyRunId,
        agentId: payload.agentId,
        explorerId: payload.explorerId,
        participantRole: payload.participantRole,
        status: "pending",
        requestNote: payload.requestNote,
        requestedAt: payload.requestedAt,
      };
      partyRuns[payload.partyRunId] = {
        ...partyRun,
        joinRequests: [
          ...(partyRun.joinRequests || []).filter((existing) => existing.requestId !== payload.requestId),
          request,
        ],
        updatedAt: payload.requestedAt,
      };
      addRegionActivityForEvent(regionActivities, regionActivityIdsByRegion, event, {
        regionId: payload.regionId,
        kind: "party_run",
        agentId: payload.agentId,
        title: "小队加入申请",
        summary: `${payload.agentId} 申请以 ${payload.participantRole} 加入小队 ${partyRun.title}。`,
        occurredAt: payload.requestedAt,
        sourceEventType: "party_join_requested",
      });
      break;
    }
    case "party_join_request_resolved": {
      const payload = event.payload;
      const partyRun = partyRuns[payload.partyRunId];
      if (!partyRun) throw new Error("party_run_not_found");
      const existingRequest = (partyRun.joinRequests || []).find((request) => request.requestId === payload.requestId);
      if (!existingRequest) throw new Error("party_join_request_not_found");
      const updatedRequest: EpochPartyJoinRequest = {
        ...existingRequest,
        status: payload.resolution,
        resolvedAt: payload.resolvedAt,
        resolvedByAgentId: payload.resolvedByAgentId,
        resolvedByExplorerId: payload.resolvedByExplorerId,
        resolutionNote: payload.resolutionNote,
      };
      partyRuns[payload.partyRunId] = {
        ...partyRun,
        joinRequests: [
          ...(partyRun.joinRequests || []).filter((request) => request.requestId !== payload.requestId),
          updatedRequest,
        ],
        updatedAt: payload.resolvedAt,
      };
      addRegionActivityForEvent(regionActivities, regionActivityIdsByRegion, event, {
        regionId: payload.regionId,
        kind: "party_run",
        agentId: payload.agentId,
        title: payload.resolution === "approved" ? "小队申请批准" : "小队申请拒绝",
        summary: `${payload.resolvedByAgentId} ${payload.resolution === "approved" ? "批准" : "拒绝"}了 ${payload.agentId} 的加入申请。`,
        occurredAt: payload.resolvedAt,
        sourceEventType: "party_join_request_resolved",
      });
      break;
    }
    case "party_member_joined": {
      const payload = event.payload;
      const partyRun = partyRuns[payload.partyRunId];
      if (!partyRun) throw new Error("party_run_not_found");
      const member: EpochPartyMember = {
        agentId: payload.agentId,
        explorerId: payload.explorerId,
        participantRole: payload.participantRole,
        joinedAt: payload.joinedAt,
      };
      partyRuns[payload.partyRunId] = {
        ...partyRun,
        members: [
          ...partyRun.members.filter((existing) => existing.agentId !== payload.agentId),
          member,
        ],
        inviteTokenUses: payload.inviteTokenUsed ? (partyRun.inviteTokenUses || 0) + 1 : partyRun.inviteTokenUses,
        updatedAt: payload.joinedAt,
      };
      addRegionActivityForEvent(regionActivities, regionActivityIdsByRegion, event, {
        regionId: payload.regionId,
        kind: "party_run",
        agentId: payload.agentId,
        title: "小队加入",
        summary: `${payload.agentId} 以 ${payload.participantRole} 加入小队 ${partyRun.title}。`,
        occurredAt: payload.joinedAt,
        sourceEventType: "party_member_joined",
      });
      break;
    }
    case "party_run_settled": {
      const payload = event.payload;
      const partyRun = partyRuns[payload.partyRunId];
      if (!partyRun) throw new Error("party_run_not_found");
      partyRuns[payload.partyRunId] = {
        ...partyRun,
        status: "settled",
        totalScore: payload.totalScore,
        memberResults: payload.memberResults,
        traceId: payload.traceId,
        newsId: payload.newsId,
        settledAt: payload.settledAt,
        updatedAt: payload.settledAt,
      };
      addRegionActivityForEvent(regionActivities, regionActivityIdsByRegion, event, {
        regionId: payload.regionId,
        kind: "party_run",
        agentId: partyRun.leaderAgentId,
        title: "小队结算",
        summary: `${partyRun.title} 完成结算，总分 ${payload.totalScore}。`,
        occurredAt: payload.settledAt,
        sourceEventType: "party_run_settled",
      });
      break;
    }
    case "raid_resolved": {
      raidResults[event.payload.raidId] = {
        raidId: event.payload.raidId,
        regionId: event.payload.regionId,
        attackerAgentId: event.payload.attackerAgentId,
        attackerExplorerId: event.payload.attackerExplorerId,
        defenderAgentId: event.payload.defenderAgentId,
        defenderExplorerId: event.payload.defenderExplorerId,
        staminaSpent: event.payload.staminaSpent,
        attackerPower: event.payload.attackerPower,
        defenderPower: event.payload.defenderPower,
        outcome: event.payload.outcome,
        reward: event.payload.reward,
        resolvedAt: event.payload.resolvedAt,
      };
      raidIdsByRegion[event.payload.regionId] = [
        ...(raidIdsByRegion[event.payload.regionId] || []),
        event.payload.raidId,
      ].filter((raidId, index, raidIds) => raidIds.indexOf(raidId) === index);
      addRegionActivityForEvent(regionActivities, regionActivityIdsByRegion, event, {
        regionId: event.payload.regionId,
        kind: "raid",
        agentId: event.payload.outcome === "attacker_won" ? event.payload.attackerAgentId : event.payload.defenderAgentId,
        title: "突袭结算",
        summary: `${event.payload.attackerAgentId} 突袭 ${event.payload.defenderAgentId}，结果 ${event.payload.outcome}，攻防 ${event.payload.attackerPower}/${event.payload.defenderPower}。`,
        occurredAt: event.payload.resolvedAt,
        sourceEventType: "raid_resolved",
      });
      break;
    }
    case "retaliation_opportunity_created": {
      retaliationOpportunities[event.payload.retaliationId] = {
        retaliationId: event.payload.retaliationId,
        regionId: event.payload.regionId,
        sourceRaidId: event.payload.sourceRaidId,
        sourceTraceId: event.payload.sourceTraceId,
        opportunityAgentId: event.payload.opportunityAgentId,
        opportunityExplorerId: event.payload.opportunityExplorerId,
        targetAgentId: event.payload.targetAgentId,
        targetExplorerId: event.payload.targetExplorerId,
        status: event.payload.status,
        reason: event.payload.reason,
        sourceEventIds: event.payload.sourceEventIds,
        createdAt: event.payload.createdAt,
      };
      retaliationIdsByRegion[event.payload.regionId] = [
        ...(retaliationIdsByRegion[event.payload.regionId] || []),
        event.payload.retaliationId,
      ].filter((retaliationId, index, retaliationIds) => retaliationIds.indexOf(retaliationId) === index);
      for (const agentId of uniqueValues([event.payload.opportunityAgentId, event.payload.targetAgentId])) {
        retaliationIdsByAgent[agentId] = [
          ...(retaliationIdsByAgent[agentId] || []),
          event.payload.retaliationId,
        ].filter((retaliationId, index, retaliationIds) => retaliationIds.indexOf(retaliationId) === index);
      }
      addRegionActivityForEvent(regionActivities, regionActivityIdsByRegion, event, {
        regionId: event.payload.regionId,
        kind: "retaliation",
        agentId: event.payload.opportunityAgentId,
        title: "复仇契机",
        summary: `${event.payload.opportunityAgentId} 获得对 ${event.payload.targetAgentId} 的复仇契机，来源突袭 ${event.payload.sourceRaidId}。`,
        occurredAt: event.payload.createdAt,
        sourceEventType: "retaliation_opportunity_created",
      });
      break;
    }
    case "retaliation_resolved": {
      const existing = retaliationOpportunities[event.payload.retaliationId];
      retaliationOpportunities[event.payload.retaliationId] = {
        retaliationId: event.payload.retaliationId,
        regionId: event.payload.regionId,
        sourceRaidId: event.payload.sourceRaidId,
        sourceTraceId: event.payload.sourceTraceId,
        opportunityAgentId: event.payload.opportunityAgentId,
        opportunityExplorerId: event.payload.opportunityExplorerId,
        targetAgentId: event.payload.targetAgentId,
        targetExplorerId: event.payload.targetExplorerId,
        status: "resolved",
        reason: existing?.reason || "retaliation_resolved",
        sourceEventIds: uniqueValues([...(existing?.sourceEventIds || []), event.eventId]),
        createdAt: existing?.createdAt || event.payload.resolvedAt,
        staminaSpent: event.payload.staminaSpent,
        retaliatorPower: event.payload.retaliatorPower,
        targetPower: event.payload.targetPower,
        outcome: event.payload.outcome,
        winnerAgentId: event.payload.winnerAgentId,
        winnerExplorerId: event.payload.winnerExplorerId,
        resolvedAt: event.payload.resolvedAt,
      };
      addRegionActivityForEvent(regionActivities, regionActivityIdsByRegion, event, {
        regionId: event.payload.regionId,
        kind: "retaliation",
        agentId: event.payload.winnerAgentId,
        title: "复仇结算",
        summary: `${event.payload.opportunityAgentId} 对 ${event.payload.targetAgentId} 的复仇完成结算，结果 ${event.payload.outcome}，胜者 ${event.payload.winnerAgentId}。`,
        occurredAt: event.payload.resolvedAt,
        sourceEventType: "retaliation_resolved",
      });
      break;
    }
    case "diplomacy_proposed": {
      const payload = event.payload;
      diplomacyRecords[payload.diplomacyId] = {
        diplomacyId: payload.diplomacyId,
        regionId: payload.regionId,
        sourceAgentId: payload.sourceAgentId,
        sourceExplorerId: payload.sourceExplorerId,
        targetAgentId: payload.targetAgentId,
        targetExplorerId: payload.targetExplorerId,
        kind: payload.kind,
        focusSpent: payload.focusSpent,
        terms: payload.terms,
        status: payload.status,
        proposedAt: payload.proposedAt,
      };
      diplomacyIdsByRegion[payload.regionId] = [
        ...(diplomacyIdsByRegion[payload.regionId] || []),
        payload.diplomacyId,
      ].filter((diplomacyId, index, diplomacyIds) => diplomacyIds.indexOf(diplomacyId) === index);
      for (const agentId of uniqueValues([payload.sourceAgentId, payload.targetAgentId])) {
        diplomacyIdsByAgent[agentId] = [
          ...(diplomacyIdsByAgent[agentId] || []),
          payload.diplomacyId,
        ].filter((diplomacyId, index, diplomacyIds) => diplomacyIds.indexOf(diplomacyId) === index);
      }
      addRegionActivityForEvent(regionActivities, regionActivityIdsByRegion, event, {
        regionId: payload.regionId,
        kind: "diplomacy",
        agentId: payload.sourceAgentId,
        title: "外交提案",
        summary: `${payload.sourceAgentId} 向 ${payload.targetAgentId} 提出 ${payload.kind}，等待回应。`,
        occurredAt: payload.proposedAt,
        sourceEventType: "diplomacy_proposed",
      });
      break;
    }
    case "diplomacy_responded": {
      const payload = event.payload;
      const existing = diplomacyRecords[payload.diplomacyId];
      if (!existing) throw new Error("diplomacy_not_found");
      diplomacyRecords[payload.diplomacyId] = {
        ...existing,
        status: payload.status,
        response: payload.response,
        responseFocusSpent: payload.focusSpent,
        responseNote: payload.note,
        relationshipId: payload.relationshipId,
        respondedAt: payload.respondedAt,
      };
      addRegionActivityForEvent(regionActivities, regionActivityIdsByRegion, event, {
        regionId: payload.regionId,
        kind: "diplomacy",
        agentId: payload.targetAgentId,
        title: payload.response === "accepted" ? "外交接受" : "外交拒绝",
        summary: `${payload.targetAgentId} ${payload.response === "accepted" ? "接受" : "拒绝"}了 ${payload.sourceAgentId} 的 ${payload.kind} 提案。`,
        occurredAt: payload.respondedAt,
        sourceEventType: "diplomacy_responded",
      });
      break;
    }
    case "relationship_updated": {
      relationshipEdges[event.payload.relationshipId] = {
        relationshipId: event.payload.relationshipId,
        sourceAgentId: event.payload.sourceAgentId,
        sourceExplorerId: event.payload.sourceExplorerId,
        targetAgentId: event.payload.targetAgentId,
        targetExplorerId: event.payload.targetExplorerId,
        kind: event.payload.kind,
        score: event.payload.scoreAfter,
        previousScore: event.payload.previousScore,
        scoreDelta: event.payload.scoreDelta,
        focusSpent: event.payload.focusSpent,
        reason: event.payload.reason,
        updatedAt: event.payload.updatedAt,
      };
      for (const agentId of [event.payload.sourceAgentId, event.payload.targetAgentId]) {
        relationshipIdsByAgent[agentId] = [
          ...(relationshipIdsByAgent[agentId] || []),
          event.payload.relationshipId,
        ].filter((relationshipId, index, relationshipIds) => relationshipIds.indexOf(relationshipId) === index);
      }
      break;
    }
    case "turn_card_created": {
      turnCards[event.payload.turnCardId] = {
        turnCardId: event.payload.turnCardId,
        agentId: event.payload.agentId,
        explorerId: event.payload.explorerId,
        regionId: event.payload.regionId,
        sequence: event.payload.sequence,
        nonce: event.payload.nonce,
        prompt: event.payload.prompt,
        visibleContext: event.payload.visibleContext,
        status: "open",
        actionOptions: event.payload.actionOptions,
        traceEffects: [],
        createdAt: event.payload.createdAt,
        expiresAt: event.payload.expiresAt,
        signedEnvelope: event.payload.signedEnvelope,
      };
      break;
    }
    case "trace_conflict_effect_applied": {
      const card = turnCards[event.payload.turnCardId];
      if (!card) throw new Error("trace_conflict_turn_card_not_found");
      turnCards[event.payload.turnCardId] = {
        ...card,
        traceEffects: [
          ...card.traceEffects,
          {
            traceId: event.payload.traceId,
            effect: event.payload.effect,
            appliedAt: event.payload.appliedAt,
          },
        ],
      };
      break;
    }
    case "turn_resolved": {
      const card = turnCards[event.payload.turnCardId];
      if (!card) throw new Error("turn_card_not_found");
      const resolution: EpochTurnResolution = {
        turnCardId: event.payload.turnCardId,
        agentId: event.payload.agentId,
        channelClass: event.payload.channelClass,
        envelopeId: event.payload.envelopeId,
        sequence: event.payload.sequence,
        nonce: event.payload.nonce,
        actionOptionId: event.payload.actionOptionId,
        optionLabel: event.payload.optionLabel,
        risk: event.payload.risk,
        explanation: event.payload.explanation,
        visibleText: event.payload.visibleText,
        outcomeSummary: event.payload.outcomeSummary,
        reward: event.payload.reward,
        lifetimeDelta: event.payload.lifetimeDelta,
        nonEvidence: event.payload.nonEvidence,
        resolvedAt: event.payload.resolvedAt,
        signedEnvelope: event.payload.signedEnvelope,
      };
      turnCards[event.payload.turnCardId] = {
        ...card,
        status: "resolved",
        resolvedAt: event.payload.resolvedAt,
        resolution,
      };
      break;
    }
    case "hosted_session_started": {
      hostedSessions[event.payload.sessionId] = {
        sessionId: event.payload.sessionId,
        agentId: event.payload.agentId,
        explorerId: event.payload.explorerId,
        regionId: event.payload.regionId,
        mandate: event.payload.mandate,
        channelClass: event.payload.channelClass || "server_hosted",
        deliveryTrust: event.payload.deliveryTrust || event.trustClass,
        status: "active",
        actionOptions: event.payload.actionOptions,
        sceneContract: event.payload.sceneContract,
        actions: [],
        startedAt: event.payload.startedAt,
      };
      break;
    }
    case "server_hosted_job_queued": {
      const job: EpochServerHostedJob = {
        jobId: event.payload.jobId,
        agentId: event.payload.agentId,
        explorerId: event.payload.explorerId,
        regionId: event.payload.regionId,
        mandate: event.payload.mandate,
        optionKey: event.payload.optionKey,
        visibleText: event.payload.visibleText,
        deliveryTrust: event.payload.deliveryTrust,
        status: "queued",
        queuedBy: event.payload.queuedBy,
        queuedAt: event.payload.queuedAt,
      };
      serverHostedJobs[job.jobId] = job;
      serverHostedJobIdsByAgent[job.agentId] = [
        ...(serverHostedJobIdsByAgent[job.agentId] || []),
        job.jobId,
      ].filter((jobId, index, jobIds) => jobIds.indexOf(jobId) === index);
      break;
    }
    case "server_hosted_job_completed": {
      const job = serverHostedJobs[event.payload.jobId];
      if (!job) throw new Error("server_hosted_job_not_found");
      serverHostedJobs[event.payload.jobId] = {
        ...job,
        status: "completed",
        sessionId: event.payload.sessionId,
        actionId: event.payload.actionId,
        completedAt: event.payload.completedAt,
      };
      break;
    }
    case "server_hosted_job_skipped": {
      const job = serverHostedJobs[event.payload.jobId];
      if (!job) throw new Error("server_hosted_job_not_found");
      serverHostedJobs[event.payload.jobId] = {
        ...job,
        status: "skipped",
        skipReason: event.payload.reason,
        skippedAt: event.payload.skippedAt,
      };
      break;
    }
    case "attestation_recorded": {
      attestationRecords[event.payload.attestationId] = {
        attestationId: event.payload.attestationId,
        runnerId: event.payload.runnerId,
        runnerKeyId: event.payload.runnerKeyId,
        challengeId: event.payload.challengeId,
        sessionId: event.payload.sessionId,
        agentId: event.payload.agentId,
        actionOptionId: event.payload.actionOptionId,
        transcriptHash: event.payload.transcriptHash,
        signature: event.payload.signature,
        signatureBase: event.payload.signatureBase,
        signatureBaseHash: event.payload.signatureBaseHash,
        verifiedAt: event.payload.verifiedAt,
      };
      break;
    }
    case "hosted_action_recorded": {
      const session = hostedSessions[event.payload.sessionId];
      if (!session) throw new Error("hosted_session_not_found");
      const action: EpochHostedActionRecord = {
        actionId: event.payload.actionId,
        sessionId: event.payload.sessionId,
        agentId: event.payload.agentId,
        channelClass: event.payload.channelClass,
        deliveryTrust: event.payload.deliveryTrust,
        actionOptionId: event.payload.actionOptionId,
        optionLabel: event.payload.optionLabel,
        risk: event.payload.risk,
        socialHookId: event.payload.socialHookId,
        attestationId: event.payload.attestationId,
        explanation: event.payload.explanation,
        visibleText: event.payload.visibleText,
        outcomeSummary: event.payload.outcomeSummary,
        ...(event.payload.journeyResolution ? { journeyResolution: event.payload.journeyResolution } : {}),
        reward: event.payload.reward,
        lifetimeDelta: event.payload.lifetimeDelta,
        nonEvidence: event.payload.nonEvidence,
        recordedAt: event.payload.recordedAt,
        signedEnvelope: event.payload.signedEnvelope,
      };
      hostedSessions[event.payload.sessionId] = {
        ...session,
        status: "completed",
        actions: [...session.actions, action],
        completedAt: event.payload.recordedAt,
      };
      if (session.sceneContract
        && session.sceneContract.worldMode !== "mirror"
        && event.payload.journeyResolution) {
        addRegionActivityForEvent(regionActivities, regionActivityIdsByRegion, event, {
          regionId: session.regionId,
          kind: "journey",
          agentId: event.payload.agentId,
          title: session.sceneContract.taskObjective?.title || session.sceneContract.title,
          summary: event.payload.outcomeSummary,
          occurredAt: event.payload.recordedAt,
          sourceEventType: "hosted_action_recorded",
        });
      }
      break;
    }
    case "journey_world_solidified": {
      addRegionActivityForEvent(regionActivities, regionActivityIdsByRegion, event, {
        regionId: event.payload.regionId,
        kind: "journey",
        agentId: event.payload.agentId,
        title: "镜像对局固化",
        summary: `主线完成并安全返程；${event.payload.completedObjectiveIds.length} 项目标结果已写入真实世界，地区影响 +${event.payload.influenceDelta}，NPC 关系 ${event.payload.npcRelationships.length} 项。`,
        occurredAt: event.payload.solidifiedAt,
        sourceEventType: "journey_world_solidified",
      });
      break;
    }
    case "abuse_score_changed": {
      const payload = event.payload;
      const existing = abuseScores[payload.actorKey];
      abuseScores[payload.actorKey] = {
        actorKey: payload.actorKey,
        agentId: payload.agentId || existing?.agentId,
        explorerId: payload.explorerId || existing?.explorerId,
        score: payload.scoreAfter,
        updatedAt: payload.changedAt,
        latestEventId: event.eventId,
        sourceEventIds: [...(existing?.sourceEventIds || []), payload.sourceEventId]
          .filter((eventId, index, eventIds) => eventIds.indexOf(eventId) === index),
        reasons: {
          ...(existing?.reasons || {}),
          [payload.reason]: (existing?.reasons[payload.reason] || 0) + 1,
        },
      };
      break;
    }
    case "abuse_score_released": {
      const payload = event.payload;
      const existing = abuseScores[payload.actorKey];
      abuseScores[payload.actorKey] = {
        actorKey: payload.actorKey,
        agentId: payload.agentId || existing?.agentId,
        explorerId: payload.explorerId || existing?.explorerId,
        score: payload.scoreAfter,
        updatedAt: payload.releasedAt,
        latestEventId: event.eventId,
        sourceEventIds: [
          ...(existing?.sourceEventIds || []),
          ...(payload.sourceEventId ? [payload.sourceEventId] : []),
        ].filter((eventId, index, eventIds) => eventIds.indexOf(eventId) === index),
        reasons: {
          ...(existing?.reasons || {}),
          operator_release: (existing?.reasons.operator_release || 0) + 1,
        },
      };
      break;
    }
    case "abuse_score_decayed": {
      const payload = event.payload;
      const existing = abuseScores[payload.actorKey];
      abuseScores[payload.actorKey] = {
        actorKey: payload.actorKey,
        agentId: payload.agentId || existing?.agentId,
        explorerId: payload.explorerId || existing?.explorerId,
        score: payload.scoreAfter,
        updatedAt: payload.decayedAt,
        latestEventId: event.eventId,
        sourceEventIds: [
          ...(existing?.sourceEventIds || []),
          ...(payload.sourceEventId ? [payload.sourceEventId] : []),
        ].filter((eventId, index, eventIds) => eventIds.indexOf(eventId) === index),
        reasons: {
          ...(existing?.reasons || {}),
          maintenance_decay: (existing?.reasons.maintenance_decay || 0) + 1,
        },
      };
      break;
    }
  }

  return {
    events: [...projection.events, event],
    identities,
    lineage,
    personalityDrifts,
    personalityDriftIdsByAgent,
    attributeScores,
    resourceBalances,
    downtime,
    agentCustody,
    downtimeDiaryEntries,
    downtimeDiaryIdsByAgent,
    regionActivities,
    regionActivityIdsByRegion,
    npcs,
    npcIdsByKey,
    npcCandidates,
    npcCandidateIdsByRegion,
    npcCandidateIdsByAgent,
    npcRelationships,
    npcRelationshipIdsByNpc,
    npcRelationshipIdsByRegion,
    agentNpcBonds,
    agentNpcBondIdsByAgent,
    agentNpcBondIdsByNpc,
    agentNpcBondIdsByRegion,
    npcMemories,
    npcMemoryIdsByNpc,
    npcMemoryIdsByRegion,
    households,
    householdIdsByNpc,
    householdIdsByRegion,
    organizations,
    organizationMemberships,
    organizationMembershipIdsByNpc,
    organizationMembershipIdsByAgent,
    organizationMembershipIdsByRegion,
    organizationMembershipIdsByOrganization,
    organizationPolitics,
    organizationPoliticsIdsByRegion,
    organizationPoliticsIdsByOrganization,
    organizationPoliticsIdsByNpc,
    organizationPoliticalStandingByOrganization,
    organizationTreasuryBalances,
    organizationUpgrades,
    organizationUpgradeIdsByOrganization,
    organizationBudgets,
    organizationBudgetIdsByOrganization,
    npcCareerRecords,
    npcCareerIdsByNpc,
    npcCareerIdsByRegion,
    npcLocationRecords,
    npcLocationIdsByNpc,
    npcLocationIdsByRegion,
    npcAssetStates,
    npcAssetIdsByNpc,
    npcAssetIdsByRegion,
    npcAssetBalancesByNpc,
    npcHealthStates,
    npcHealthIdsByNpc,
    npcHealthIdsByRegion,
    inventoryItems,
    inventoryItemIdsByAgent,
    inventoryItemIdsByExplorer,
    socialHooks,
    socialHookIdsByRegion,
    socialHookIdsByNpc,
    regionNews,
    worldMessages,
    regionMessages,
    moderationItems,
    riskReviews,
    riskReviewIdsBySourceEvent,
    riskReviewIdsByAgent,
    legendAwards,
    legendAwardIdsByNews,
    legendAwardIdsByAgent,
    contestedObjectives,
    objectiveIdsByRegion,
    resourceNodes,
    resourceNodeIdsByRegion,
    anomalyEvents,
    anomalyEventIdsByRegion,
    seasonCampaigns,
    seasonObjectives,
    seasonObjectiveIdsBySeason,
    seasonCampaignIdsByRegion,
    seasonCampaignIdsByFaction,
    agentFactionStandings,
    factionStandingIdsByAgent,
    factionStandingIdsByFaction,
    regionInfluenceChanges,
    regionInfluenceIdsByRegion,
    regionInfluenceIdsByAgent,
    conflictTraces,
    traceIdsByRegion,
    traceIdsByAgent,
    regionControls,
    regionMonuments,
    regionMonumentIdsByRegion,
    marketOrders,
    directTrades,
    marketRiskRestrictions,
    marketRiskRestrictionReleases,
    bounties,
    bountyIdsByRegion,
    bountyIdsByAgent,
    partyRuns,
    partyRunIdsByRegion,
    raidResults,
    raidIdsByRegion,
    retaliationOpportunities,
    retaliationIdsByRegion,
    retaliationIdsByAgent,
    diplomacyRecords,
    diplomacyIdsByRegion,
    diplomacyIdsByAgent,
    relationshipEdges,
    relationshipIdsByAgent,
    turnCards,
    hostedSessions,
    serverHostedJobs,
    serverHostedJobIdsByAgent,
    attestationRecords,
    abuseScores,
  };
}

export function projectEpochEvents(events: readonly EpochEvent[]): EpochProjection {
  return events.reduce((projection, event) => applyEvent(projection, event), emptyProjection());
}

function applyEvents(projection: EpochProjection, events: readonly EpochEvent[]): EpochProjection {
  return events.reduce((current, event) => applyEvent(current, event), projection);
}

function epochEventsHaveEquivalentContent(left: EpochEvent, right: EpochEvent): boolean {
  try {
    return causalEpochEventCanonicalJson(left) === causalEpochEventCanonicalJson(right);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("causal_canonical_json_")) {
      return JSON.stringify(left) === JSON.stringify(right);
    }
    throw error;
  }
}

function freezeProjection<T>(value: T, frozenObjects: WeakSet<object>): T {
  if (value === null || typeof value !== "object") return value;
  const objectValue = value as object;
  if (frozenObjects.has(objectValue)) return value;
  frozenObjects.add(objectValue);
  for (const key of Reflect.ownKeys(objectValue)) {
    freezeProjection(Reflect.get(objectValue, key), frozenObjects);
  }
  Object.freeze(objectValue);
  return value;
}

function projectTraceConflictState(events: readonly EpochEvent[]): {
  readonly deployments: readonly TraceConflictDeployment[];
  readonly memories: readonly TraceConflictRumorMemory[];
} {
  const deployments = new Map<string, TraceConflictDeployment>();
  const memories: TraceConflictRumorMemory[] = [];
  for (const event of events) {
    if (event.eventType === "trace_conflict_deployed") {
      deployments.set(event.payload.deployment.traceId, event.payload.deployment);
      continue;
    }
    if (event.eventType === "trace_conflict_outcome") {
      const deployment = deployments.get(event.payload.traceId);
      if (!deployment) throw new Error("trace_conflict_deployment_not_found");
      deployments.set(event.payload.traceId, {
        ...deployment,
        status: event.payload.outcome,
        resolvedAt: event.payload.resolvedAt,
        outcomeEventId: event.eventId,
        resolutionAuditId: event.eventId,
        triggeredByTurnCardId: event.payload.triggeredByTurnCardId,
        counteredByTraceId: event.payload.counteredByTraceId,
      });
      continue;
    }
    if (event.eventType === "trace_conflict_memory_recorded") {
      memories.push(event.payload.memory);
    }
  }
  return { deployments: [...deployments.values()], memories };
}

function traceConflictRuleProjection(current: EpochProjection) {
  const linkedExplorerByNpc = new Map<string, string>();
  for (const candidate of Object.values(current.npcCandidates)) {
    if (candidate.canonicalNpcId) linkedExplorerByNpc.set(candidate.canonicalNpcId, candidate.explorerId);
  }
  const protectedFamilyKinds = new Set<EpochNpcRelationshipKind>(["spouse", "parent", "child", "relative"]);
  const protectedNpcIds = new Set<string>();
  for (const relationship of Object.values(current.npcRelationships)) {
    if (!protectedFamilyKinds.has(relationship.kind)) continue;
    protectedNpcIds.add(relationship.sourceNpcId);
    protectedNpcIds.add(relationship.targetNpcId);
  }
  for (const household of Object.values(current.households)) {
    if (household.memberNpcIds.length < 2) continue;
    household.memberNpcIds.forEach((npcId) => protectedNpcIds.add(npcId));
  }
  const state = projectTraceConflictState(current.events);
  return {
    identities: Object.fromEntries(Object.values(current.identities).map((identity) => [identity.agentId, {
      explorerId: identity.explorerId,
      status: identity.status,
    }])),
    npcTargets: Object.fromEntries(Object.values(current.npcs).map((npc) => [npc.npcId, {
      linkedExplorerId: linkedExplorerByNpc.get(npc.npcId),
      isChild: isChildNpc(npc),
      protectedFromHostileConflict: protectedNpcIds.has(npc.npcId),
    }])),
    resourceBalances: current.resourceBalances,
    deployments: state.deployments,
  };
}

export function sourceEventsMentionAgent(projection: EpochProjection, sourceEventIds: readonly string[], agentId: string): boolean {
  const sourceEventIdSet = new Set(sourceEventIds);
  return projection.events
    .filter((event) => sourceEventIdSet.has(event.eventId))
    .some((event) => {
      const payload = event.payload as unknown as Record<string, unknown>;
      return event.agentId === agentId
        || event.aggregateId === agentId
        || payload.agentId === agentId
        || payload.winnerAgentId === agentId;
    });
}

function uniqueSortedStrings(values: readonly (string | undefined)[]): readonly string[] {
  return uniqueSortedValues(values);
}

function requireServerTrust(context: EpochCommandContext, errorCode: string) {
  const trustClass = normalizeTrustClass(context.trustClass);
  if (trustClass === "untrusted_client") throw new Error(errorCode);
  return trustClass;
}

export function createEpochGameCore(options: EpochGameCoreOptions = {}) {
  const clock = options.clock || (() => new Date());
  const initialEvents = [...(options.initialEvents || [])];
  const idFactory = options.idFactory || createSequentialEpochIdFactory(
    "epoch",
    initialEvents.flatMap((event) => [event.eventId, event.aggregateId]),
  );
  const defaultLifetime = options.defaultLifetime || DEFAULT_LIFETIME;
  const maxDowntimeSeconds = options.maxDowntimeSeconds || DEFAULT_MAX_DOWNTIME_SECONDS;
  const identityNameFactory = options.identityNameFactory || ((input: { explorerId: string; generation: number }) =>
    `${input.explorerId}-第${input.generation}世`);
  const journeyMirrorLedgerSink = options.journeyMirrorLedgerSink;
  let events = initialEvents;
  const frozenProjectionObjects = new WeakSet<object>();
  let currentProjection = freezeProjection(projectEpochEvents(events), frozenProjectionObjects);

  function projection() {
    return currentProjection;
  }

  function identitySlots(input: { readonly explorerId: string }): EpochIdentitySlotState {
    return identitySlotsForExplorer(projection(), assertNonEmptyString(input.explorerId, "explorer_id"));
  }

  function ownerTraceConflicts(
    input: TraceConflictOwnerViewInput,
    context: EpochCommandContext,
  ): readonly TraceConflictOwnerDeploymentView[] {
    const current = projection();
    const identity = requireIdentity(current, assertNonEmptyString(input.agentId, "agent_id"));
    assertIdentityOwner(identity, context, "trace_conflict_owner_mismatch");
    const state = projectTraceConflictState(current.events);
    return traceConflictOwnerView(state, {
      explorerId: identity.explorerId,
      agentId: identity.agentId,
      status: input.status,
      limit: input.limit,
    });
  }

  function regionTraceConflicts(
    input: TraceConflictRegionViewInput,
    context: EpochCommandContext,
  ): TraceConflictRegionView {
    const current = projection();
    return traceConflictRegionView(projectTraceConflictState(current.events), {
      regionId: assertNonEmptyString(input.regionId, "region_id"),
      viewerExplorerId: context.actorExplorerId,
      limit: input.limit,
    });
  }

  function ownerTraceConflictMemories(
    input: { readonly agentId: string; readonly limit?: number },
    context: EpochCommandContext,
  ): readonly TraceConflictMemoryView[] {
    const current = projection();
    const identity = requireIdentity(current, assertNonEmptyString(input.agentId, "agent_id"));
    assertIdentityOwner(identity, context, "trace_conflict_owner_mismatch");
    return traceConflictMemoryView(projectTraceConflictState(current.events), {
      explorerId: identity.explorerId,
      agentId: identity.agentId,
      limit: input.limit,
    });
  }

  function commit<TValue>(nextEvents: readonly EpochEvent[], value: TValue): EpochCommandResult<TValue> {
    const nextProjection = freezeProjection(applyEvents(currentProjection, nextEvents), frozenProjectionObjects);
    events = [...nextProjection.events];
    currentProjection = nextProjection;
    return { events: nextEvents, value, projection: nextProjection };
  }

  function ingestCanonicalEvents(nextEvents: readonly EpochEvent[]): EpochProjection {
    if (nextEvents.length === 0) return projection();
    const current = projection();
    const eventsById = new Map(current.events.map((event) => [event.eventId, event]));
    const freshEvents: EpochEvent[] = [];
    for (const event of nextEvents) {
      if (event.eventType === "causal_world_event_recorded") {
        throw new Error("causal_world_event_canonical_ingest_forbidden");
      }
      const existing = eventsById.get(event.eventId);
      if (existing) {
        if (!epochEventsHaveEquivalentContent(existing, event)) {
          throw new Error(`epoch_event_id_conflict:${event.eventId}`);
        }
        continue;
      }
      eventsById.set(event.eventId, event);
      freshEvents.push(event);
    }
    if (freshEvents.length === 0) return current;
    const nextProjection = freezeProjection(applyEvents(current, freshEvents), frozenProjectionObjects);
    events = [...nextProjection.events];
    currentProjection = nextProjection;
    return nextProjection;
  }

  function ingestCausalWorldEvents(_nextEvents: readonly unknown[] = []): EpochProjection {
    throw new Error("causal_world_event_direct_ingest_forbidden");
  }

  function issueIdentity(input: IssueIdentityInput, context: EpochCommandContext): EpochCommandResult<EpochAgentIdentity> {
    const current = projection();
    const explorerId = assertNonEmptyString(input.explorerId, "explorer_id");
    const previousAgentId = input.previousAgentId;
    const previousIdentity = previousAgentId ? requireIdentity(current, previousAgentId) : null;
    if (previousIdentity && previousIdentity.explorerId !== explorerId) throw new Error("identity_lineage_mismatch");
    requireIdentitySlot(current, explorerId);
    const generation = previousIdentity ? previousIdentity.generation + 1 : (current.lineage[explorerId]?.length || 0) + 1;
    const agentId = idFactory("agent", `${explorerId}:${generation}:${previousAgentId || "root"}`);
    if (current.identities[agentId]) throw new Error("agent_identity_already_exists");
    const maxLifetime = input.maxLifetime ? assertPositiveInteger(input.maxLifetime, "max_lifetime") : defaultLifetime;
    const startedAt = serverIsoTime(clock);
    const identityName = input.identityName?.trim() || identityNameFactory({ explorerId, generation });
    const nextEvents = planIdentityIssueEvents({
      agentId,
      explorerId,
      explorerSecretHash: input.explorerSecretHash,
      identityName,
      generation,
      previousAgentId,
      maxLifetime,
      startedAt,
      makeEvent: eventFactory(clock, idFactory, context),
    });
    const nextProjection = applyEvents(current, nextEvents);
    return commit(nextEvents, projectIdentityIssue({ events: nextEvents, projection: nextProjection }));
  }

  function rotateExplorerRecovery(
    input: RotateExplorerRecoveryInput,
    context: EpochCommandContext,
  ): EpochCommandResult<EpochRecoveryRotation> {
    const explorerId = assertNonEmptyString(input.explorerId, "explorer_id");
    const explorerSecretHash = assertNonEmptyString(input.explorerSecretHash, "explorer_secret_hash");
    const rotatedAt = serverIsoTime(clock);
    const nextEvents = planExplorerRecoveryRotationEvents({
      explorerId,
      explorerSecretHash,
      rotatedAt,
      makeEvent: eventFactory(clock, idFactory, context),
    });
    return commit(nextEvents, projectExplorerRecoveryRotation({ events: nextEvents }));
  }

  function reincarnationEvents(
    current: EpochProjection,
    previousAgentId: string,
    input: { readonly identityName?: string; readonly maxLifetime?: number },
    context: EpochCommandContext,
  ): readonly EpochEvent[] {
    const previousIdentity = requireIdentity(current, previousAgentId);
    if (previousIdentity.status !== "archived") throw new Error("previous_identity_not_archived");
    assertIdentityOwnerOrSystemWorker(previousIdentity, context, "reincarnation_owner_mismatch");
    if (previousIdentity.nextAgentId) throw new Error("identity_already_reincarnated");
    requireIdentitySlot(current, previousIdentity.explorerId);
    const generation = previousIdentity.generation + 1;
    const nextAgentId = idFactory("agent", `${previousIdentity.explorerId}:${generation}:${previousAgentId}`);
    if (current.identities[nextAgentId]) throw new Error("agent_identity_already_exists");
    const maxLifetime = input.maxLifetime ? assertPositiveInteger(input.maxLifetime, "max_lifetime") : defaultLifetime;
    const startedAt = serverIsoTime(clock);
    const identityName = input.identityName?.trim() || identityNameFactory({
      explorerId: previousIdentity.explorerId,
      generation,
    });
    const previousAgentEvents = current.events.filter((event) => {
      const payload = event.payload as unknown as Readonly<Record<string, unknown>>;
      return event.agentId === previousAgentId
        || event.aggregateId === previousAgentId
        || payload.agentId === previousAgentId
        || payload.winnerAgentId === previousAgentId
        || payload.claimantAgentId === previousAgentId;
    });
    const knownRegions = uniqueSortedStrings(previousAgentEvents.map((event) => {
      const payload = event.payload as unknown as Readonly<Record<string, unknown>>;
      return typeof payload.regionId === "string" ? payload.regionId : undefined;
    }));
    const latestScar = [...previousAgentEvents].reverse().find((event) => (
      event.eventType === "lifetime_adjusted" && event.payload.delta < 0
    ));
    const inheritance: EpochLineageInheritance = {
      legendEcho: Math.max(0, current.resourceBalances[previousAgentId]?.legend || 0),
      knownRegions,
      ...(latestScar?.eventType === "lifetime_adjusted" ? { scar: latestScar.payload.reason } : {}),
    };
    return planIdentityReincarnationEvents({
      explorerId: previousIdentity.explorerId,
      previousAgentId,
      nextAgentId,
      identityName,
      generation,
      inheritance,
      maxLifetime,
      startedAt,
      makeEvent: eventFactory(clock, idFactory, context),
    });
  }

  function lifetimeAdjustmentEvents(
    current: EpochProjection,
    agentId: string,
    delta: number,
    reason: string,
    finalTitle: string,
    context: EpochCommandContext,
  ): readonly EpochEvent[] {
    const identity = requireActiveIdentity(current, agentId);
    const previousRemaining = identity.lifetime.remaining;
    const remaining = Math.max(0, Math.min(identity.lifetime.max, previousRemaining + delta));
    const archive = remaining === 0
      ? {
          archivedAt: serverIsoTime(clock),
          finalTitle,
        }
      : undefined;
    const nextEvents: EpochEvent[] = [...planLifetimeAdjustmentEvents({
      agentId,
      delta,
      reason,
      previousRemaining,
      remaining,
      archive,
      makeEvent: eventFactory(clock, idFactory, context),
    })];
    if (remaining === 0) {
      nextEvents.push(...reincarnationEvents(applyEvents(current, nextEvents), agentId, {}, context));
    }
    return nextEvents;
  }

  function proposePersonalityDriftEvent(
    current: EpochProjection,
    input: {
      readonly agentId: string;
      readonly sourceEventId: string;
      readonly trigger: string;
      readonly suggestedTrait: string;
      readonly summary: string;
    },
    context: EpochCommandContext,
  ): EpochEvent | undefined {
    const identity = requireActiveIdentity(current, input.agentId);
    if (openPersonalityDriftForAgent({ projection: current, agentId: input.agentId })) return undefined;
    if (personalityDriftCooldownActive({
      projection: current,
      agentId: input.agentId,
      nowMs: clock().getTime(),
    })) return undefined;
    if (!personalityDriftSourceEvent({ events: current.events, sourceEventId: input.sourceEventId })) return undefined;
    const driftId = idFactory("personality_drift", `${input.agentId}:${input.trigger}:${input.sourceEventId}`);
    if (current.personalityDrifts[driftId]) return undefined;
    const proposedAt = serverIsoTime(clock);
    const nextEvents = planPersonalityDriftProposalEvents({
      driftId,
      agentId: input.agentId,
      explorerId: identity.explorerId,
      sourceEventId: input.sourceEventId,
      trigger: input.trigger,
      suggestedTrait: input.suggestedTrait,
      summary: input.summary,
      proposedAt,
      makeEvent: eventFactory(clock, idFactory, context),
    });
    return nextEvents[0];
  }

  function proposeRelationshipPersonalityDriftEvent(
    current: EpochProjection,
    relationship: ReturnType<typeof relationshipUpdatedPayload>,
    sourceEvent: EpochEvent,
    context: EpochCommandContext,
  ): EpochEvent | undefined {
    if (relationship.kind !== "hostility") return undefined;
    const suggestedTrait = relationshipPersonalityDriftTrait(relationship.scoreAfter);
    if (!suggestedTrait) return undefined;
    const source = requireIdentity(current, relationship.sourceAgentId);
    const target = requireActiveIdentity(current, relationship.targetAgentId);
    return proposePersonalityDriftEvent(current, {
      agentId: target.agentId,
      sourceEventId: sourceEvent.eventId,
      trigger: `relationship_hostility:${relationship.relationshipId}`,
      suggestedTrait,
      summary: `${source.identityName} 对 ${target.identityName} 的敌意达到 ${Math.abs(relationship.scoreAfter)}；确认后写入长期信任边界。`,
    }, context);
  }

  function confirmPersonalityDrift(
    input: ConfirmPersonalityDriftInput,
    context: EpochCommandContext,
  ): EpochCommandResult<EpochPersonalityDrift> {
    const current = projection();
    const driftId = assertNonEmptyString(input.driftId, "personality_drift_id");
    const drift = current.personalityDrifts[driftId];
    if (!drift) throw new Error("personality_drift_not_found");
    const identity = requireActiveIdentity(current, drift.agentId);
    if (identity.explorerId !== context.actorExplorerId && context.trustClass !== "system_worker") {
      throw new Error("personality_drift_owner_mismatch");
    }
    if (drift.status === "confirmed") return { events: [], value: drift, projection: current };
    const nextEvents = planPersonalityDriftConfirmationEvents({
      driftId,
      agentId: drift.agentId,
      confirmedByExplorerId: context.actorExplorerId,
      confirmedAt: serverIsoTime(clock),
      makeEvent: eventFactory(clock, idFactory, context),
    });
    const nextProjection = applyEvents(current, nextEvents);
    return commit(nextEvents, projectPersonalityDriftConfirmation({ events: nextEvents, projection: nextProjection }));
  }

  function adjustLifetime(input: AdjustLifetimeInput, context: EpochCommandContext): EpochCommandResult<EpochAgentIdentity> {
    const current = projection();
    const agentId = assertNonEmptyString(input.agentId, "agent_id");
    const identity = requireActiveIdentity(current, agentId);
    assertIdentityOwnerOrSystemWorker(identity, context, "lifetime_adjust_owner_mismatch");
    const delta = assertFiniteInteger(input.delta, "lifetime_delta");
    const reason = assertNonEmptyString(input.reason, "lifetime_reason");
    const nextEvents = lifetimeAdjustmentEvents(current, agentId, delta, reason, input.finalTitle?.trim() || "定档身份", context);
    const nextProjection = applyEvents(current, nextEvents);
    return commit(nextEvents, requireIdentity(nextProjection, agentId));
  }

  function archiveIdentity(input: ArchiveIdentityInput, context: EpochCommandContext): EpochCommandResult<EpochAgentIdentity> {
    const current = projection();
    const agentId = assertNonEmptyString(input.agentId, "agent_id");
    const identity = requireActiveIdentity(current, agentId);
    assertIdentityOwnerOrSystemWorker(identity, context, "archive_owner_mismatch");
    const nextEvents = planIdentityArchiveEvents({
      agentId,
      archiveReason: assertNonEmptyString(input.archiveReason, "archive_reason"),
      archivedAt: serverIsoTime(clock),
      finalTitle: input.finalTitle?.trim() || identity.identityName,
      makeEvent: eventFactory(clock, idFactory, context),
    });
    const nextProjection = applyEvents(current, nextEvents);
    return commit(nextEvents, projectIdentityArchive({ events: nextEvents, projection: nextProjection }));
  }

  function reincarnate(input: ReincarnateInput, context: EpochCommandContext): EpochCommandResult<EpochAgentIdentity> {
    const current = projection();
    const previousAgentId = assertNonEmptyString(input.previousAgentId, "previous_agent_id");
    const nextEvents = reincarnationEvents(current, previousAgentId, input, context);
    const nextProjection = applyEvents(current, nextEvents);
    return commit(nextEvents, projectIdentityReincarnation({ events: nextEvents, projection: nextProjection }));
  }

  function grantResource(input: ResourceInput, context: EpochCommandContext): EpochCommandResult<Partial<Record<EpochResourceId, number>>> {
    const current = projection();
    const agentId = assertNonEmptyString(input.agentId, "agent_id");
    requireActiveIdentity(current, agentId);
    const nextEvents = planResourceGrantEvents({
      projection: current,
      agentId,
      resource: input,
      makeEvent: eventFactory(clock, idFactory, context),
    });
    const nextProjection = applyEvents(current, nextEvents);
    return commit(nextEvents, projectResourceGrantBalance({ events: nextEvents, projection: nextProjection }));
  }

  function grantAttribute(input: AttributeInput, context: EpochCommandContext): EpochCommandResult<AttributeScoreBalance> {
    const current = projection();
    const agentId = assertNonEmptyString(input.agentId, "agent_id");
    requireActiveIdentity(current, agentId);
    const nextEvents = planAttributeGainEvents({
      projection: current,
      agentId,
      attribute: input,
      makeEvent: eventFactory(clock, idFactory, context),
    });
    const nextProjection = applyEvents(current, nextEvents);
    return commit(nextEvents, projectAttributeGainBalance({ events: nextEvents, projection: nextProjection }));
  }

  function spendResource(input: ResourceInput, context: EpochCommandContext): EpochCommandResult<Partial<Record<EpochResourceId, number>>> {
    const current = projection();
    const agentId = assertNonEmptyString(input.agentId, "agent_id");
    requireActiveIdentity(current, agentId);
    const nextEvents = planResourceSpendEvents({
      projection: current,
      agentId,
      resource: input,
      makeEvent: eventFactory(clock, idFactory, context),
    });
    const nextProjection = applyEvents(current, nextEvents);
    return commit(nextEvents, projectResourceSpendBalance({ events: nextEvents, projection: nextProjection }));
  }

  function recordLoreContribution(input: RecordLoreContributionInput, context: EpochCommandContext): EpochCommandResult<EpochLoreContributionRecord> {
    const current = projection();
    const agentId = assertNonEmptyString(input.agentId, "agent_id");
    const identity = requireActiveIdentity(current, agentId);
    assertIdentityOwner(identity, context, "lore_contribution_owner_mismatch");
    const category = assertLoreContributionCategory(input.category);
    const targetId = assertNonEmptyString(input.targetId, "lore_contribution_target_id").slice(0, 160);
    const summary = assertNonEmptyString(input.summary, "lore_contribution_summary").slice(0, 320);
    const revisionFields = loreContributionRevisionFields({
      category,
      revisionMode: input.revisionMode,
      revisedClaimText: input.revisedClaimText,
      originalClaimExplorerId: input.originalClaimExplorerId,
      parentClaimId: input.parentClaimId,
      mergeTargetIds: input.mergeTargetIds,
      downgradeReason: input.downgradeReason,
    });
    const creatureBehaviorScopeReview = creatureBehaviorScopeReviewFor({ targetId, summary });
    const fuzzyTimeIntervalReview = fuzzyTimeIntervalReviewFor({ events: current.events, targetId, summary });
    const crossRegionMechanismReview = crossRegionMechanismReviewFor({ targetId, summary });
    const sourceEventIds = loreContributionSourceEventIds(input.sourceEventIds);
    const experimentReview = experimentalArtifactReview(input);
    const sourceEvents = loreContributionSourceEvents({
      category,
      events: current.events,
      explorerId: identity.explorerId,
      projection: current,
      sourceEventIds,
    });
    const cost = loreContributionCost({ category });
    const recordedAt = serverIsoTime(clock);
    assertLoreRefutationDailyQuota({ category, events: current.events, agentId, recordedAt });
    const makeEvent = eventFactory(clock, idFactory, context);
    const contributionId = idFactory("lore_contribution", `${category}:${agentId}:${targetId}:${summary}`);
    const claimHash = loreClaimHash({
      agentId,
      category,
      contributionId,
      explorerId: identity.explorerId,
      recordedAt,
      revisionMode: revisionFields.revisionMode,
      revisionPolicy: revisionFields.revisionPolicy,
      sourceEventIds,
      summary,
      targetId,
      experimentId: experimentReview.experimentId,
      mainRuleReview: experimentReview.mainRuleReview,
    });
    let costSpendPayload: ReturnType<typeof loreContributionCostSpendPayload> | undefined;
    if (cost) {
      const currentFocus = currentBalance(current, agentId, cost.resourceId);
      if (currentFocus < cost.amount) throw new Error("resource_insufficient");
      costSpendPayload = loreContributionCostSpendPayload({ agentId, category, currentFocus });
    }
    const record = loreContributionRecordPayload({
      contributionId,
      claimHash,
      category,
      agentId,
      explorerId: identity.explorerId,
      targetId,
      summary,
      ...revisionFields,
      sourceEventIds,
      provenance: createLoreContributionProvenance(targetId, sourceEvents, recordedAt),
      experimentReview,
      creatureBehaviorScopeReview,
      fuzzyTimeIntervalReview,
      crossRegionMechanismReview,
      cost,
      recordedAt,
    });
    const nextEvents = planLoreContributionRecordEvents({
      makeEvent,
      contributionId,
      agentId,
      record,
      costSpendPayload,
    });
    return commit(nextEvents, record);
  }

  function adjudicateLoreTarget(
    input: RecordLoreTargetAdjudicationInput,
    context: EpochCommandContext,
  ): EpochCommandResult<EpochLoreTargetAdjudication> {
    requireServerTrust(context, "lore_adjudication_requires_server_trust");
    const current = projection();
    const targetId = assertNonEmptyString(input.targetId, "lore_adjudication_target_id").slice(0, 160);
    const status = assertLoreAdjudicationStatus(input.status);
    const summary = assertNonEmptyString(input.summary, "lore_adjudication_summary").slice(0, 360);
    const sourceContributionEventIds = loreTargetSourceContributionEventIds(input.sourceContributionEventIds);
    const sourceContributionEvents = loreTargetSourceContributionEvents({
      events: current.events,
      sourceContributionEventIds,
      targetId,
    });
    const authorityReview = loreAuthorityReviewForSourceContributions(sourceContributionEvents);
    if (status === "refuted" && !authorityReview.canHardRefute) {
      throw new Error("lore_adjudication_low_authority_review_required");
    }
    const canonCandidate = canonCandidatePathFromInput(input.canonCandidate, sourceContributionEvents);
    const { adjudicationSequence, previousAdjudicationId } = loreTargetAdjudicationHistory({
      events: current.events,
      targetId,
    });
    const adjudicationId = idFactory(
      "lore_adjudication",
      loreTargetAdjudicationStableKey({
        targetId,
        status,
        sourceContributionEventIds,
        adjudicationSequence,
        summary,
        canonCandidate,
      }),
    );
    const adjudicatedAt = serverIsoTime(clock);
    const adjudicationIds = loreTargetAdjudicationIds({ adjudicationId, previousAdjudicationId });
    const payload = loreTargetAdjudicationPayload({
      adjudicationId,
      previousAdjudicationId,
      targetId,
      status,
      summary,
      sourceContributionEventIds,
      provenance: createLoreTargetAdjudicationProvenance(targetId, sourceContributionEvents, adjudicatedAt, adjudicationIds),
      canonCandidate,
      authorityReview,
      operatorId: context.actorExplorerId,
      adjudicatedAt,
    });
    const nextEvents = planLoreTargetAdjudicationEvents({
      makeEvent: eventFactory(clock, idFactory, context),
      adjudicationId,
      adjudication: payload,
    });
    return commit(nextEvents, payload);
  }

  function downtimeRegionSafety(current: EpochProjection, regionId: string): DowntimeRegionSafetyLevel {
    const openAnomalies = (current.anomalyEventIdsByRegion[regionId] || [])
      .map((anomalyId) => current.anomalyEvents[anomalyId])
      .filter((anomaly) => anomaly?.status === "open");
    if (openAnomalies.some((anomaly) => anomaly?.severity === "major" || anomaly?.severity === "cataclysm")) {
      return "hazardous";
    }
    if (openAnomalies.length) return "unstable";
    const hasOpenContest = (current.objectiveIdsByRegion[regionId] || [])
      .some((objectiveId) => current.contestedObjectives[objectiveId]?.status === "active")
      || (current.resourceNodeIdsByRegion[regionId] || [])
        .some((nodeId) => current.resourceNodes[nodeId]?.status === "open");
    if (hasOpenContest) return "guarded";
    return "secure";
  }

  function downtimeEligibilityProjection(current: EpochProjection, agentId: string, regionId: string) {
    return {
      ...current,
      downtimeAgentStatuses: {
        [agentId]: current.agentCustody[agentId],
      },
      regionSafetyStates: {
        [regionId]: { level: downtimeRegionSafety(current, regionId) },
      },
    };
  }

  function changeAgentCustody(
    input: ChangeAgentCustodyInput,
    context: EpochCommandContext,
  ): EpochCommandResult<EpochAgentCustodyState> {
    const trustClass = requireServerTrust(context, "agent_custody_requires_server_trust");
    const current = projection();
    const agentId = assertNonEmptyString(input.agentId, "agent_id");
    requireIdentity(current, agentId);
    const custodyStatus = input.custodyStatus;
    if (custodyStatus !== "free" && custodyStatus !== "imprisoned") {
      throw new Error("agent_custody_status_invalid");
    }
    const changedAt = serverIsoTime(clock);
    const changed = eventFactory(clock, idFactory, { ...context, trustClass })("agent_custody_changed", agentId, {
      agentId,
      custodyStatus,
      reason: input.reason?.trim() || `custody_${custodyStatus}`,
      changedAt,
    }, { agentId });
    const nextProjection = applyEvents(current, [changed]);
    return commit([changed], nextProjection.agentCustody[agentId]);
  }

  function setDowntime(input: SetDowntimeInput, context: EpochCommandContext): EpochCommandResult<EpochDowntimeState> {
    const current = projection();
    const agentId = assertNonEmptyString(input.agentId, "agent_id");
    const identity = requireActiveIdentity(current, agentId);
    assertIdentityOwner(identity, context, "downtime_owner_mismatch");
    const mode = assertDowntimeMode(input.mode);
    const regionId = normalizeDowntimeRegionId(input.regionId);
    const startedAt = serverIsoTime(clock);
    requireDowntimeSetEligibility({
      snapshot: buildDowntimeEligibilitySnapshot({
        projection: downtimeEligibilityProjection(current, agentId, regionId),
        agentId,
        regionId,
      }),
      mode,
      serverNow: startedAt,
    });
    const makeEvent = eventFactory(clock, idFactory, context);
    const nextEvents = planDowntimeSetEvents({
      agentId,
      mode,
      regionId,
      startedAt,
      makeEvent,
    });
    const nextProjection = applyEvents(current, nextEvents);
    return commit(nextEvents, projectDowntimeState({
      events: nextEvents,
      projection: nextProjection,
      agentId,
    }));
  }

  function claimDowntime(input: ClaimDowntimeInput, context: EpochCommandContext): EpochCommandResult<EpochDowntimeState> {
    const current = projection();
    const agentId = assertNonEmptyString(input.agentId, "agent_id");
    const identity = requireActiveIdentity(current, agentId);
    assertIdentityOwner(identity, context, "downtime_owner_mismatch");
    const currentDowntime = current.downtime[agentId];
    if (!currentDowntime?.active) throw new Error("downtime_not_active");
    const claimedAt = serverIsoTime(clock);
    requireDowntimeClaimEligibility({
      snapshot: buildDowntimeClaimEligibilitySnapshot({
        projection: downtimeEligibilityProjection(current, agentId, currentDowntime.regionId),
        agentId,
      }),
      serverNow: claimedAt,
    });
    const makeEvent = eventFactory(clock, idFactory, context);
    const nextEvents = planDowntimeClaimEvents({
      agentId,
      downtime: currentDowntime,
      claimedAt,
      maxDowntimeSeconds,
      balanceBefore: (plannedGrantEvents, targetAgentId, resourceId) =>
        currentBalance(applyEvents(current, plannedGrantEvents), targetAgentId, resourceId),
      makeEvent,
    });
    const nextProjection = applyEvents(current, nextEvents);
    return commit(nextEvents, projectDowntimeState({
      events: nextEvents,
      projection: nextProjection,
      agentId,
    }));
  }

  function tickDowntime(input: TickDowntimeInput, context: EpochCommandContext): EpochCommandResult<TickDowntimeResult> {
    const trustClass = requireServerTrust(context, "downtime_tick_requires_server_trust");
    const current = projection();
    const tickedAt = serverIsoTime(clock);
    const agentIds = input.agentId
      ? [assertNonEmptyString(input.agentId, "agent_id")]
      : selectDowntimeTickAgentIds(current.downtime, input.limit);
    const makeEvent = eventFactory(clock, idFactory, { ...context, trustClass });
    const targets = [];
    for (const agentId of agentIds) {
      requireActiveIdentity(current, agentId);
      const currentDowntime = current.downtime[agentId];
      if (!currentDowntime?.active) continue;
      try {
        requireDowntimeTickEligibility({
          snapshot: buildDowntimeClaimEligibilitySnapshot({
            projection: downtimeEligibilityProjection(current, agentId, currentDowntime.regionId),
            agentId,
          }),
        });
      } catch (error) {
        if (input.agentId) throw error;
        continue;
      }
      targets.push({ agentId, downtime: currentDowntime });
    }
    const nextEvents = planDowntimeTickEvents({
      targets,
      tickedAt,
      maxDowntimeSeconds,
      balanceBefore: (plannedGrantEvents, targetAgentId, resourceId) =>
        currentBalance(applyEvents(current, plannedGrantEvents), targetAgentId, resourceId),
      makeEvent,
    });
    const nextProjection = applyEvents(current, nextEvents);
    const result = projectDowntimeTickResult({
      agentIds,
      tickedAt,
      projection: nextProjection,
    });
    if (input.agentId && result.updated.length === 0) throw new Error("downtime_not_active");
    return commit(nextEvents, result);
  }

  function canonicalizeNpc(input: CanonicalizeNpcInput, context: EpochCommandContext): EpochCommandResult<EpochNpcRecord> {
    const current = projection();
    const displayName = assertNonEmptyString(input.displayName, "npc_display_name");
    const regionId = assertNonEmptyString(input.regionId, "region_id");
    const npcKey = stableKey(`${regionId}:${displayName}`);
    const existingNpcId = current.npcIdsByKey[npcKey];
    if (existingNpcId) {
      return { events: [], value: current.npcs[existingNpcId], projection: current };
    }
    if (input.sourceEventId) assertKnownSourceEvents(current, [input.sourceEventId]);
    const npcId = idFactory("npc", npcKey);
    const makeEvent = eventFactory(clock, idFactory, context);
    const nextEvents = planNpcCanonicalizedEvents({
      makeEvent,
      npcId,
      npcKey,
      displayName,
      regionId,
      traits: normalizeTraits(input.traits),
      sourceEventId: input.sourceEventId,
    });
    const nextProjection = applyEvents(current, nextEvents);
    return commit(nextEvents, nextProjection.npcs[npcId]);
  }

  function submitNpcCandidate(input: SubmitNpcCandidateInput, context: EpochCommandContext): EpochCommandResult<SubmitNpcCandidateResult> {
    const current = projection();
    const agentId = assertNonEmptyString(input.agentId, "agent_id");
    const identity = requireActiveIdentity(current, agentId);
    if (context.actorExplorerId !== identity.explorerId && context.trustClass !== "system_worker") {
      throw new Error("npc_candidate_owner_mismatch");
    }
    const displayName = assertNonEmptyString(input.displayName, "npc_display_name");
    const regionId = assertNonEmptyString(input.regionId, "region_id");
    const storyEvidence = assertNonEmptyString(input.storyEvidence, "story_evidence");
    if (input.sourceEventId) assertKnownSourceEvents(current, [input.sourceEventId]);
    const traits = normalizeTraits(input.traits);
    const npcKey = stableKey(`${regionId}:${displayName}`);
    const existingNpcId = current.npcIdsByKey[npcKey];
    const review = npcCandidateReview(displayName, storyEvidence);
    const rumorAdmissionReview = npcCandidateRumorAdmission({ displayName, regionId, traits, storyEvidence });
    const canUseRumorAdmissionGate = !existingNpcId
      && !review.rejectionReason
      && review.reviewLevel === "clear"
      && review.flavorPublication.sharedWorldEligible;
    const flavorPublication: NpcCandidateFlavorPublication = canUseRumorAdmissionGate && rumorAdmissionReview.status === "personal_sealed"
      ? {
        mode: "personal_sealed",
        sharedWorldEligible: false,
        reason: rumorAdmissionReview.reason,
      }
      : review.flavorPublication;
    const abilityEffectCluster = npcAbilityEffectCluster({ displayName, traits, storyEvidence, regionId });
    const flavorSealed = !flavorPublication.sharedWorldEligible;
    const experimentReview = experimentalArtifactReview(input);
    const canonicalNpcId = review.rejectionReason || flavorSealed ? undefined : existingNpcId || idFactory("npc", npcKey);
    const decision: NpcCandidateDecision = review.rejectionReason
      ? "rejected_flavor"
      : existingNpcId
        ? "merged"
        : flavorSealed
          ? "moderation_hold"
          : "promoted";
    const candidateId = idFactory("npc_candidate", [
      agentId,
      regionId,
      npcKey,
      context.idempotencyKey || input.sourceEventId || storyEvidence,
    ].join(":"));
    const makeEvent = eventFactory(clock, idFactory, context);
    const nextEvents = planNpcCandidateSubmittedEvents({
      makeEvent,
      candidateId,
      agentId,
      explorerId: identity.explorerId,
      regionId,
      displayName,
      npcKey,
      traits,
      storyEvidence,
      decision,
      reviewLevel: flavorSealed ? "moderation_hold" : review.reviewLevel,
      reviewScore: review.reviewScore,
      reviewFlags: review.reviewFlags,
      ipSimilarity: review.ipSimilarity,
      flavorPublication,
      rumorAdmissionReview,
      abilityEffectCluster,
      canonicalNpcId,
      rejectionReason: review.rejectionReason,
      sourceEventId: input.sourceEventId,
      ...experimentReview,
    });
    const nextProjection = applyEvents(current, nextEvents);
    return commit(nextEvents, {
      decision,
      candidate: nextProjection.npcCandidates[candidateId],
      npc: canonicalNpcId ? nextProjection.npcs[canonicalNpcId] : undefined,
    });
  }

  function reviewNpcCandidate(input: ReviewNpcCandidateInput, context: EpochCommandContext): EpochCommandResult<SubmitNpcCandidateResult> {
    requireServerTrust(context, "npc_candidate_review_requires_server_trust");
    const current = projection();
    const candidateId = assertNonEmptyString(input.candidateId, "npc_candidate_id");
    const candidate = current.npcCandidates[candidateId];
    if (!candidate) throw new Error("npc_candidate_not_found");
    if (candidate.status !== "rejected_flavor" && candidate.status !== "moderation_hold") {
      throw new Error("npc_candidate_review_requires_rejected_candidate");
    }
    const resolution = normalizeNpcCandidateReviewResolution(input.resolution);
    const note = typeof input.note === "string" && input.note.trim() ? input.note.trim() : undefined;
    const existingNpcId = current.npcIdsByKey[candidate.npcKey];
    const canonicalNpcId = resolution === "promote"
      ? existingNpcId || candidate.canonicalNpcId || idFactory("npc", candidate.npcKey)
      : undefined;
    const decision: NpcCandidateDecision = resolution === "reject"
      ? "rejected_flavor"
      : existingNpcId
        ? "merged"
        : "promoted";
    const makeEvent = eventFactory(clock, idFactory, context);
    const nextEvents = planNpcCandidateReviewedEvents({
      makeEvent,
      candidateId,
      decision,
      canonicalNpcId,
      reviewedBy: assertNonEmptyString(context.actorExplorerId, "actor_explorer_id"),
      reviewNote: note,
      candidate: {
        agentId: candidate.agentId,
        npcKey: candidate.npcKey,
        displayName: candidate.displayName,
        regionId: candidate.regionId,
        traits: candidate.traits,
        rejectionReason: candidate.rejectionReason,
      },
      shouldCanonicalize: decision === "promoted" && Boolean(canonicalNpcId) && !existingNpcId && !current.npcs[canonicalNpcId || ""],
    });
    const nextProjection = applyEvents(current, nextEvents);
    return commit(nextEvents, {
      decision,
      candidate: nextProjection.npcCandidates[candidateId],
      npc: canonicalNpcId ? nextProjection.npcs[canonicalNpcId] : undefined,
    });
  }

  function recordNpcLifecycle(input: RecordNpcLifecycleInput, context: EpochCommandContext): EpochCommandResult<EpochNpcRecord> {
    const current = projection();
    const npcId = assertNonEmptyString(input.npcId, "npc_id");
    if (!current.npcs[npcId]) throw new Error("npc_not_found");
    const sourceEventIds = input.sourceEventIds || [];
    assertKnownSourceEvents(current, sourceEventIds);
    const makeEvent = eventFactory(clock, idFactory, context);
    const nextEvents = planNpcLifecycleRecordEvents({
      makeEvent,
      npcId,
      occurredAt: serverIsoTime(clock),
      changes: input.changes,
      sourceEventIds,
    });
    const nextProjection = applyEvents(current, nextEvents);
    return commit(nextEvents, nextProjection.npcs[npcId]);
  }

  function recordNpcMemory(input: RecordNpcMemoryInput, context: EpochCommandContext): EpochCommandResult<EpochNpcMemory> {
    const trustClass = requireServerTrust(context, "npc_memory_requires_server_trust");
    const current = projection();
    const npcId = assertNonEmptyString(input.npcId, "npc_id");
    const npc = current.npcs[npcId];
    if (!npc) throw new Error("npc_not_found");
    const sourceEventIds = input.sourceEventIds || [];
    assertKnownSourceEvents(current, sourceEventIds);
    const summary = assertNonEmptyString(input.summary, "npc_memory_summary");
    const importance = input.importance ? assertNpcMemoryImportance(input.importance) : "low";
    const recordedAt = serverIsoTime(clock);
    const memoryId = idFactory("npc_memory", `${npcId}:${recordedAt}:${summary}`);
    const makeEvent = eventFactory(clock, idFactory, { ...context, trustClass });
    const nextEvents = planNpcMemoryRecordEvents({
      makeEvent,
      memoryId,
      npcId,
      regionId: npc.regionId,
      summary,
      importance,
      sourceEventIds,
      recordedAt,
    });
    const nextProjection = applyEvents(current, nextEvents);
    return commit(nextEvents, nextProjection.npcMemories[memoryId]);
  }

  function tickNpcLifecycle(input: TickNpcLifecycleInput, context: EpochCommandContext): EpochCommandResult<TickNpcLifecycleResult> {
    const trustClass = requireServerTrust(context, "npc_lifecycle_tick_requires_server_trust");
    const current = projection();
    const selectedNpcs = selectLifecycleTickNpcs(current.npcs, input);
    const tickedAt = serverIsoTime(clock);
    const makeEvent = eventFactory(clock, idFactory, { ...context, trustClass });
    const nextEvents = planNpcLifecycleTickEvents({
      applyEvents,
      current,
      idFactory,
      makeEvent,
      selectedNpcs,
      tickedAt,
    });
    const nextProjection = applyEvents(current, nextEvents);
    return commit(nextEvents, projectNpcLifecycleTickResult({
      tickedAt,
      selectedNpcs,
      events: nextEvents,
      projection: nextProjection,
    }));
  }

  function tickOrganizationPolitics(
    input: TickOrganizationPoliticsInput,
    context: EpochCommandContext,
  ): EpochCommandResult<TickOrganizationPoliticsResult> {
    const trustClass = requireServerTrust(context, "organization_politics_tick_requires_server_trust");
    const current = projection();
    const selectedOrganizations = selectOrganizationPoliticsTickTargets(current.organizations, input);
    const tickedAt = serverIsoTime(clock);
    const makeEvent = eventFactory(clock, idFactory, { ...context, trustClass });
    const nextEvents = planOrganizationPoliticsTickEvents({
      applyEvents,
      current,
      idFactory,
      makeEvent,
      selectedOrganizations,
      tickedAt,
    });
    const nextProjection = applyEvents(current, nextEvents);
    return commit(nextEvents, projectOrganizationPoliticsTickResult({
      tickedAt,
      events: nextEvents,
      projection: nextProjection,
    }));
  }

  function generateRegionNews(input: GenerateRegionNewsInput, context: EpochCommandContext): EpochCommandResult<EpochRegionNews> {
    const trustClass = requireServerTrust(context, "region_news_requires_server_trust");
    const current = projection();
    const sourceEventIds = [...input.sourceEventIds];
    if (sourceEventIds.length === 0) throw new Error("region_news_source_events_required");
    assertKnownSourceEvents(current, sourceEventIds);
    const regionId = assertNonEmptyString(input.regionId, "region_id");
    const headline = assertNonEmptyString(input.headline, "news_headline");
    const body = assertNonEmptyString(input.body, "news_body");
    const makeEvent = eventFactory(clock, idFactory, { ...context, trustClass });
    const nextEvents = planRegionNewsGenerationEvents({
      projection: current,
      regionId,
      headline,
      body,
      legendDelta: input.legendDelta === undefined ? 0 : assertFiniteInteger(input.legendDelta, "legend_delta"),
      sourceEventIds,
      queuedAt: serverIsoTime(clock),
      idFactory,
      makeEvent,
    });
    const nextProjection = applyEvents(current, nextEvents);
    return commit(nextEvents, projectGeneratedRegionNews({
      events: nextEvents,
      projection: nextProjection,
    }));
  }

  function postMessage(input: PostMessageInput, context: EpochCommandContext): EpochCommandResult<EpochMessageRecord> {
    const current = projection();
    const agentId = assertNonEmptyString(input.agentId, "agent_id");
    const identity = requireActiveIdentity(current, agentId);
    assertClientIdentityOwner(identity, context, "message_owner_mismatch");
    const scope = assertMessageScope(input.scope);
    const regionId = scope === "region" ? assertNonEmptyString(input.regionId, "region_id") : undefined;
    const body = normalizeMessageBody(input.body);
    const postedAt = serverIsoTime(clock);
    const makeEvent = eventFactory(clock, idFactory, context);
    const nextEvents = planMessagePostedEvents({
      scope,
      agentId,
      explorerId: identity.explorerId,
      regionId,
      body,
      postedAt,
      idFactory,
      makeEvent,
    });
    const nextProjection = applyEvents(current, nextEvents);
    return commit(nextEvents, projectPostedMessage({
      events: nextEvents,
      projection: nextProjection,
    }));
  }

  function resolveModerationItem(input: ResolveModerationItemInput, context: EpochCommandContext): EpochCommandResult<EpochModerationItem> {
    const trustClass = requireServerTrust(context, "moderation_resolution_requires_server_trust");
    const current = projection();
    const moderationId = assertNonEmptyString(input.moderationId, "moderation_id");
    const existing = requireModerationItem(current, moderationId);
    if (existing.status !== "open") throw new Error("moderation_item_already_resolved");
    const resolvedAt = serverIsoTime(clock);
    const makeEvent = eventFactory(clock, idFactory, { ...context, trustClass });
    const nextEvents = planModerationResolvedEvents({
      moderationId,
      resolution: assertModerationResolution(input.resolution),
      resolvedBy: assertNonEmptyString(context.actorExplorerId, "actor_explorer_id"),
      resolvedAt,
      note: input.note,
      makeEvent,
    });
    const nextProjection = applyEvents(current, nextEvents);
    return commit(nextEvents, projectModerationResolved({
      events: nextEvents,
      projection: nextProjection,
    }));
  }

  function recordRiskReview(input: RecordRiskReviewInput, context: EpochCommandContext): EpochCommandResult<EpochRiskReview> {
    const trustClass = requireServerTrust(context, "risk_review_requires_server_trust");
    const current = projection();
    const sourceEventId = assertNonEmptyString(input.sourceEventId, "risk_review_source_event_id");
    const sourceEvent = riskReviewSourceEvent({ events: current.events, sourceEventId });
    const existingReviewId = current.riskReviewIdsBySourceEvent[sourceEventId]?.[0];
    if (existingReviewId && current.riskReviews[existingReviewId]) {
      return { events: [], value: current.riskReviews[existingReviewId], projection: current };
    }
    const { reviewFlags, reviewScore } = riskReviewAnalysisForEvent(sourceEvent);
    const reviewedAt = serverIsoTime(clock);
    const reviewId = idFactory("risk_review", sourceEventId);
    const makeEvent = eventFactory(clock, idFactory, { ...context, trustClass });
    const nextEvents = planRiskReviewRecordedEvents({
      reviewId,
      sourceEventId,
      sourceEventType: sourceEvent.eventType,
      agentId: sourceEvent.agentId,
      explorerId: sourceEvent.actorExplorerId,
      resolution: assertRiskReviewResolution(input.resolution),
      reviewFlags,
      reviewScore,
      operatorId: assertNonEmptyString(context.actorExplorerId, "actor_explorer_id"),
      reviewedAt,
      note: input.note,
      makeEvent,
    });
    const nextProjection = applyEvents(current, nextEvents);
    return commit(nextEvents, projectRiskReviewRecorded({
      events: nextEvents,
      projection: nextProjection,
    }));
  }

  function releaseMarketRiskRestriction(input: ReleaseMarketRiskRestrictionInput, context: EpochCommandContext): EpochCommandResult<EpochMarketRiskRestrictionRelease> {
    const trustClass = requireServerTrust(context, "market_risk_restriction_release_requires_server_trust");
    const current = projection();
    const agentId = assertNonEmptyString(input.agentId, "agent_id");
    const restriction = current.marketRiskRestrictions[agentId];
    if (!restriction) throw new Error("market_risk_restriction_not_found");
    const releaseId = idFactory("risk_restriction_release", `${agentId}:${restriction.sourceReviewId}`);
    const existing = current.marketRiskRestrictionReleases[releaseId];
    if (existing) return { events: [], value: existing, projection: current };
    const releasedAt = serverIsoTime(clock);
    const makeEvent = eventFactory(clock, idFactory, { ...context, trustClass });
    const nextEvents = planMarketRiskRestrictionReleaseEvents({
      releaseId,
      restriction,
      releasedBy: assertNonEmptyString(context.actorExplorerId, "actor_explorer_id"),
      releasedAt,
      note: input.note,
      makeEvent,
    });
    const nextProjection = applyEvents(current, nextEvents);
    return commit(nextEvents, projectMarketRiskRestrictionRelease({
      events: nextEvents,
      projection: nextProjection,
    }));
  }

  function releaseAbuseRestriction(input: ReleaseAbuseRestrictionInput, context: EpochCommandContext): EpochCommandResult<EpochAbuseScoreRelease> {
    const trustClass = requireServerTrust(context, "abuse_release_requires_server_trust");
    const current = projection();
    const actorKey = assertNonEmptyString(input.actorKey || input.agentId || input.explorerId, "actor_key");
    const existing = current.abuseScores[actorKey];
    if (!existing) throw new Error("abuse_profile_not_found");
    const requestedScore = typeof input.scoreAfter === "number" && Number.isFinite(input.scoreAfter)
      ? input.scoreAfter
      : 0;
    const scoreAfter = Math.max(0, Math.min(existing.score, Math.floor(requestedScore)));
    if (scoreAfter >= existing.score) throw new Error("abuse_release_score_not_lower");
    const releasedAt = serverIsoTime(clock);
    const makeEvent = eventFactory(clock, idFactory, { ...context, trustClass });
    const nextEvents = planAbuseScoreReleaseEvents({
      profile: existing,
      agentId: input.agentId,
      explorerId: input.explorerId,
      scoreAfter,
      releasedBy: assertNonEmptyString(context.actorExplorerId, "actor_explorer_id"),
      releasedAt,
      note: input.note,
      idFactory,
      makeEvent,
    });
    const nextProjection = applyEvents(current, nextEvents);
    return commit(nextEvents, projectAbuseScoreRelease({
      events: nextEvents,
      projection: nextProjection,
    }));
  }

  function decayAbuseScores(input: DecayAbuseScoresInput, context: EpochCommandContext): EpochCommandResult<readonly EpochAbuseScoreDecay[]> {
    const trustClass = requireServerTrust(context, "abuse_decay_requires_server_trust");
    const current = projection();
    const decayedAt = serverIsoTime(clock);
    const makeEvent = eventFactory(clock, idFactory, { ...context, trustClass });
    const decayedEvents = planAbuseScoreDecayEvents({
      profilesByActorKey: current.abuseScores,
      selection: input,
      amount: input.amount,
      decayedBy: assertNonEmptyString(context.actorExplorerId, "actor_explorer_id"),
      decayedAt,
      idFactory,
      makeEvent,
    });
    if (decayedEvents.length === 0) return { events: [], value: [], projection: current };
    const values: readonly EpochAbuseScoreDecay[] = projectAbuseScoreDecays({ events: decayedEvents });
    return commit(decayedEvents, values);
  }

  function decayRegionControls(input: DecayRegionControlsInput, context: EpochCommandContext): EpochCommandResult<readonly EpochRegionControlDecay[]> {
    const trustClass = requireServerTrust(context, "region_control_decay_requires_server_trust");
    const current = projection();
    const amount = regionControlDecayAmount(input.amount);
    const decayedAt = serverIsoTime(clock);
    const makeEvent = eventFactory(clock, idFactory, { ...context, trustClass });
    const actorExplorerId = assertNonEmptyString(context.actorExplorerId, "actor_explorer_id");
    const decayedEvents = planRegionControlDecayEvents({
      targets: selectRegionControlDecayTargets(current.regionControls, { ...input, decayedAt }),
      amount,
      decayedBy: actorExplorerId,
      decayedAt,
      idFactory,
      makeEvent,
    });
    if (decayedEvents.length === 0) return { events: [], value: [], projection: current };
    const values: readonly EpochRegionControlDecay[] = projectRegionControlDecays({ events: decayedEvents });
    return commit(decayedEvents, values);
  }

  function claimReleasedRegionControl(
    input: ClaimReleasedRegionControlInput,
    context: EpochCommandContext,
  ): EpochCommandResult<EpochRegionControl> {
    const trustClass = requireServerTrust(context, "region_control_claim_requires_server_trust");
    const current = projection();
    const regionId = assertNonEmptyString(input.regionId, "region_id");
    if (current.regionControls[regionId]) throw new Error("region_control_already_active");
    const releaseEvent = latestRegionControlReleaseEvent(current, regionId);
    if (!releaseEvent) throw new Error("region_control_release_required");
    const seasonId = assertNonEmptyString(input.seasonId, "season_id");
    const factionId = assertNonEmptyString(input.factionId, "faction_id");
    const campaign = requireSeasonCampaign(current, seasonId);
    if (!campaign.regionIds.includes(regionId)) throw new Error("region_control_claim_region_mismatch");
    if (!campaign.factionIds.includes(factionId)) throw new Error("region_control_claim_faction_mismatch");
    const factionStanding = campaign.factionStandings.find((standing) => standing.factionId === factionId);
    if (!factionStanding || factionStanding.score <= 0) throw new Error("region_control_claim_score_required");
    const agentId = input.agentId ? assertNonEmptyString(input.agentId, "agent_id") : undefined;
    const claimingIdentity = agentId ? requireActiveIdentity(current, agentId) : undefined;
    if (agentId) {
      const agentStanding = campaign.agentStandings.find((standing) =>
        standing.agentId === agentId
        && standing.factionId === factionId
        && standing.score > 0);
      if (!agentStanding) throw new Error("region_control_claim_agent_standing_required");
    }
    const contestedByFaction = campaign.factionStandings
      .filter((standing) => standing.factionId !== factionId && standing.score > 0)
      .sort((left, right) => right.score - left.score || left.factionId.localeCompare(right.factionId))[0];
    const claimedAt = serverIsoTime(clock);
    const makeEvent = eventFactory(clock, idFactory, { ...context, trustClass });
    const nextEvents = planReleasedRegionControlClaimEvents({
      makeEvent,
      regionId,
      controllingFactionId: factionId,
      previousControllingFactionId: releaseEvent.payload.previousControllingFactionId,
      controlScore: factionStanding.score,
      contestedByFaction,
      sourceSeasonId: seasonId,
      sourceReleaseId: releaseEvent.payload.releaseId,
      previousControlSourceSeasonId: releaseEvent.payload.sourceSeasonId,
      claimingAgentId: claimingIdentity?.agentId,
      claimingExplorerId: claimingIdentity?.explorerId,
      changedAt: claimedAt,
    });
    const nextProjection = applyEvents(current, nextEvents);
    return commit(nextEvents, projectReleasedRegionControlClaim({
      events: nextEvents,
      projection: nextProjection,
    }));
  }

  function resolveRegionRevolt(
    input: ResolveRegionRevoltInput,
    context: EpochCommandContext,
  ): EpochCommandResult<EpochRegionRevoltResult> {
    const current = projection();
    const regionId = assertNonEmptyString(input.regionId, "region_id");
    if (current.regionControls[regionId]) throw new Error("region_revolt_requires_released_control");
    const releaseEvent = latestRegionControlReleaseEvent(current, regionId);
    if (!releaseEvent) throw new Error("region_control_release_required");
    const seasonId = assertNonEmptyString(input.seasonId, "season_id");
    const factionId = assertNonEmptyString(input.factionId, "faction_id");
    const agentId = assertNonEmptyString(input.agentId, "agent_id");
    const rebel = requireActiveIdentity(current, agentId);
    assertIdentityOwner(rebel, context, "region_revolt_actor_owner_mismatch");
    const campaign = requireSeasonCampaign(current, seasonId);
    if (!campaign.regionIds.includes(regionId)) throw new Error("region_revolt_region_mismatch");
    if (!campaign.factionIds.includes(factionId)) throw new Error("region_revolt_faction_mismatch");
    const factionStanding = campaign.factionStandings.find((standing) => standing.factionId === factionId);
    if (!factionStanding || factionStanding.score <= 0) throw new Error("region_revolt_score_required");
    const agentStanding = campaign.agentStandings.find((standing) =>
      standing.agentId === agentId
      && standing.factionId === factionId
      && standing.score > 0);
    if (!agentStanding) throw new Error("region_revolt_agent_standing_required");
    const staminaSpent = assertPositiveInteger(input.staminaSpent, "region_revolt_stamina_spent");
    const staminaBalance = currentBalance(current, agentId, "stamina");
    if (staminaBalance < staminaSpent) throw new Error("resource_insufficient");
    const resolvedAt = serverIsoTime(clock);
    const settlement = regionRevoltSettlement({
      staminaSpent,
      agentStandingScore: agentStanding.score,
      previousControlScore: releaseEvent.payload.previousScore,
    });
    const revoltId = idFactory("region_revolt", `${regionId}:${seasonId}:${agentId}:${staminaSpent}:${resolvedAt}`);
    const makeEvent = eventFactory(clock, idFactory, context);
    const nextEvents = planRegionRevoltResolutionEvents({
      makeEvent,
      revoltId,
      regionId,
      sourceReleaseId: releaseEvent.payload.releaseId,
      previousControllingFactionId: releaseEvent.payload.previousControllingFactionId,
      previousControlSourceSeasonId: releaseEvent.payload.sourceSeasonId,
      rebelAgentId: agentId,
      rebelExplorerId: rebel.explorerId,
      rebelFactionId: factionId,
      sourceSeasonId: seasonId,
      factionScore: factionStanding.score,
      staminaSpent,
      settlement,
      resolvedAt,
      staminaBalanceBefore: staminaBalance,
      influenceId: idFactory("region_influence", `${regionId}:${revoltId}:${agentId}:revolt`),
      previousInfluenceScore: currentRegionInfluenceScore(current, regionId, agentId),
      traceId: idFactory("trace", `${regionId}:${revoltId}:revolt`),
      parentTraceId: latestTraceIdForRegion(current, regionId),
      ...(campaign.factionIds.includes(releaseEvent.payload.previousControllingFactionId)
        ? { contestedByFactionId: releaseEvent.payload.previousControllingFactionId }
        : {}),
    });
    return commit(nextEvents, projectRegionRevoltResolution({ events: nextEvents }));
  }

  function recordCommandRejected(input: RecordCommandRejectedInput, context: EpochCommandContext): EpochCommandResult<EpochEvent> {
    const trustClass = requireServerTrust(context, "command_rejected_record_requires_server_trust");
    const current = projection();
    const rejectedAt = serverIsoTime(clock);
    const makeEvent = eventFactory(clock, idFactory, { ...context, trustClass });
    const nextEvents = planCommandRejectedEvents({
      projection: current,
      surface: input.surface === "mcp" ? "mcp" : "http",
      command: input.command,
      errorCode: input.errorCode,
      statusCode: input.statusCode,
      actorKey: input.actorKey,
      agentId: input.agentId,
      explorerId: input.explorerId,
      actorExplorerId: context.actorExplorerId,
      rejectedAt,
      inputSummary: input.inputSummary,
      idFactory,
      makeEvent,
    });
    return commit(nextEvents, projectCommandRejectedEvent(nextEvents));
  }

  function claimNewsLegend(input: ClaimNewsLegendInput, context: EpochCommandContext): EpochCommandResult<EpochLegendAward> {
    const current = projection();
    const newsId = assertNonEmptyString(input.newsId, "news_id");
    const agentId = assertNonEmptyString(input.agentId, "agent_id");
    const identity = requireActiveIdentity(current, agentId);
    if (context.actorExplorerId !== identity.explorerId && context.trustClass !== "system_worker") {
      throw new Error("legend_claim_owner_mismatch");
    }
    const news = requireRegionNews(current, newsId);
    if (!sourceEventsMentionAgent(current, news.sourceEventIds, agentId)) {
      throw new Error("legend_news_agent_not_mentioned");
    }
    const existingAward = (current.legendAwardIdsByNews[newsId] || [])
      .map((awardId) => current.legendAwards[awardId])
      .find((award) => award?.agentId === agentId);
    if (existingAward) {
      return { events: [], value: existingAward, projection: current };
    }
    const makeEvent = eventFactory(clock, idFactory, context);
    const nextEvents = planLegendAwardClaimEvents({
      news,
      agentId,
      explorerId: identity.explorerId,
      currentLegend: currentBalance(current, agentId, "legend"),
      awardedAt: serverIsoTime(clock),
      idFactory,
      makeEvent,
    });
    const nextProjection = applyEvents(current, nextEvents);
    return commit(nextEvents, projectLegendAwardClaim({
      events: nextEvents,
      projection: nextProjection,
    }));
  }

  function createContestedObjective(input: CreateContestedObjectiveInput, context: EpochCommandContext): EpochCommandResult<EpochContestedObjective> {
    const trustClass = requireServerTrust(context, "contested_objective_requires_server_trust");
    const current = projection();
    const regionId = assertNonEmptyString(input.regionId, "region_id");
    const title = assertNonEmptyString(input.title, "objective_title");
    const resourceId = assertResourceId(input.resourceId);
    const objectiveId = idFactory("objective", `${regionId}:${title}`);
    const existing = current.contestedObjectives[objectiveId];
    if (existing) return { events: [], value: existing, projection: current };
    const nextEvents = planContestedObjectiveCreationEvents({
      objectiveId,
      regionId,
      title,
      description: input.description,
      resourceId,
      targetScore: assertPositiveInteger(input.targetScore, "objective_target_score"),
      mode: input.mode === "race" ? "race" : "contribution",
      reward: normalizeObjectiveReward(input.reward),
      consolationReward: input.consolationReward ? normalizeObjectiveReward(input.consolationReward) : undefined,
      createdAt: serverIsoTime(clock),
      makeEvent: eventFactory(clock, idFactory, { ...context, trustClass }),
    });
    const nextProjection = applyEvents(current, nextEvents);
    return commit(nextEvents, projectContestedObjectiveCreation({
      events: nextEvents,
      projection: nextProjection,
    }));
  }

  function contributeContestedObjective(
    input: ContributeContestedObjectiveInput,
    context: EpochCommandContext,
  ): EpochCommandResult<EpochContestedObjective> {
    const current = projection();
    const objectiveId = assertNonEmptyString(input.objectiveId, "objective_id");
    const objective = requireActiveObjective(current, objectiveId);
    const agentId = assertNonEmptyString(input.agentId, "agent_id");
    const identity = requireActiveIdentity(current, agentId);
    assertIdentityOwner(identity, context, "objective_contributor_owner_mismatch");
    const amount = assertPositiveInteger(input.amount, "objective_contribution_amount");
    const balance = currentBalance(current, agentId, objective.resourceId);
    if (balance < amount) throw new Error("resource_insufficient");
    const previousScore = objective.leaderboard.find((standing) => standing.agentId === agentId)?.score || 0;
    const contributionEvents = planContestedObjectiveContributionEvents({
      objectiveId,
      agentId,
      explorerId: identity.explorerId,
      resourceId: objective.resourceId,
      amount,
      previousScore,
      totalScore: objective.totalScore,
      balanceBefore: balance,
      makeEvent: eventFactory(clock, idFactory, context),
    });
    const afterContribution = applyEvents(current, contributionEvents);
    const contributedObjective = requireActiveObjective(afterContribution, objectiveId);
    const contributedStanding = contributedObjective.leaderboard.find((standing) => standing.agentId === agentId);
    const crossedRaceFinish = objective.mode === "race"
      && previousScore < objective.targetScore
      && Boolean(contributedStanding && contributedStanding.score >= objective.targetScore);
    const nextEvents: EpochEvent[] = [...contributionEvents];
    if (crossedRaceFinish && contributedStanding) {
      const place = objective.raceCompletions.length + 1;
      const reward = place === 1
        ? objective.reward
        : objective.consolationReward || {
            resourceId: objective.reward.resourceId,
            amount: Math.max(1, Math.floor(objective.reward.amount / 4)),
            reason: `race_consolation:${objective.objectiveId}`,
          };
      nextEvents.push(...planRaceCommissionCompletionEvents({
        completionId: idFactory("race_completion", `${objectiveId}:${agentId}:${place}`),
        objectiveId,
        regionId: objective.regionId,
        agentId,
        explorerId: identity.explorerId,
        place,
        score: contributedStanding.score,
        reward,
        rewardBalanceBefore: currentBalance(afterContribution, agentId, reward.resourceId),
        completedAt: serverIsoTime(clock),
        makeEvent: eventFactory(clock, idFactory, {
          actorExplorerId: "system",
          trustClass: "system_worker",
          causationId: context.causationId,
          correlationId: context.correlationId,
          idempotencyKey: context.idempotencyKey,
        }),
      }));
    }
    const nextProjection = applyEvents(current, nextEvents);
    return commit(nextEvents, projectContestedObjectiveContribution({
      events: nextEvents,
      projection: nextProjection,
    }));
  }

  function settleContestedObjective(input: SettleContestedObjectiveInput, context: EpochCommandContext): EpochCommandResult<EpochContestedObjective> {
    const trustClass = requireServerTrust(context, "contested_objective_settlement_requires_server_trust");
    const current = projection();
    const objectiveId = assertNonEmptyString(input.objectiveId, "objective_id");
    const objective = requireActiveObjective(current, objectiveId);
    const raceWinner = objective.mode === "race" ? objective.raceCompletions[0] : undefined;
    const raceWinnerStanding = raceWinner
      ? objective.leaderboard.find((standing) => standing.agentId === raceWinner.agentId)
      : undefined;
    const settlementLeaderboard = raceWinnerStanding
      ? [raceWinnerStanding, ...objective.leaderboard.filter((standing) => standing.agentId !== raceWinnerStanding.agentId)]
      : objective.leaderboard;
    const winner = settlementLeaderboard[0];
    const nextEvents = planContestedObjectiveSettlementEvents({
      objectiveId,
      regionId: objective.regionId,
      objectiveTitle: objective.title,
      leaderboard: settlementLeaderboard,
      reward: objective.mode === "race" ? undefined : objective.reward,
      settledAt: serverIsoTime(clock),
      winnerRewardBalanceBefore: winner && objective.reward
        ? currentBalance(current, winner.agentId, objective.reward.resourceId)
        : 0,
      winnerInfluenceScoreBefore: winner
        ? currentRegionInfluenceScore(current, objective.regionId, winner.agentId)
        : 0,
      parentTraceId: latestTraceIdForRegion(current, objective.regionId),
      idFactory,
      makeEvent: eventFactory(clock, idFactory, { ...context, trustClass }),
    });
    const nextProjection = applyEvents(current, nextEvents);
    return commit(nextEvents, projectContestedObjectiveSettlement({
      events: nextEvents,
      projection: nextProjection,
    }));
  }

  function createResourceNode(input: CreateResourceNodeInput, context: EpochCommandContext): EpochCommandResult<EpochResourceNode> {
    const trustClass = requireServerTrust(context, "resource_node_requires_server_trust");
    const current = projection();
    const regionId = assertNonEmptyString(input.regionId, "region_id");
    const title = assertNonEmptyString(input.title, "resource_node_title");
    const resourceId = assertResourceId(input.resourceId);
    const spawnedAt = serverIsoTime(clock);
    const reward: EpochServerReward = {
      resourceId,
      amount: assertPositiveInteger(input.rewardAmount, "resource_node_reward_amount"),
      reason: input.rewardReason?.trim() || "resource_node_settlement",
    };
    const openNode = openResourceNodeForRegion(current, regionId);
    if (openNode) throw new Error("resource_node_region_open");
    const latestSettledAt = latestResourceNodeSettlementAt(current, regionId);
    if (resourceNodeSpawnCooldownRemainingSeconds(spawnedAt, latestSettledAt) > 0) {
      throw new Error("resource_node_spawn_cooldown_active");
    }
    const nodeId = idFactory("resource_node", `${regionId}:${title}:${resourceId}:${spawnedAt}`);
    const existing = current.resourceNodes[nodeId];
    if (existing) return { events: [], value: existing, projection: current };
    const nextEvents = planResourceNodeSpawnEvents({
      nodeId,
      regionId,
      title,
      description: input.description,
      resourceId,
      reward,
      spawnedAt,
      makeEvent: eventFactory(clock, idFactory, { ...context, trustClass }),
    });
    const nextProjection = applyEvents(current, nextEvents);
    return commit(nextEvents, projectResourceNodeSpawn({ events: nextEvents, projection: nextProjection }));
  }

  function contestResourceNode(input: ContestResourceNodeInput, context: EpochCommandContext): EpochCommandResult<EpochResourceNode> {
    const current = projection();
    const nodeId = assertNonEmptyString(input.nodeId, "resource_node_id");
    const node = requireOpenResourceNode(current, nodeId);
    const agentId = assertNonEmptyString(input.agentId, "agent_id");
    const identity = requireActiveIdentity(current, agentId);
    assertIdentityOwner(identity, context, "resource_node_contest_owner_mismatch");
    const staminaSpent = assertPositiveInteger(input.staminaSpent, "resource_node_stamina_spent");
    const staminaBalance = currentBalance(current, agentId, "stamina");
    if (staminaBalance < staminaSpent) throw new Error("resource_insufficient");
    const { equipmentScoreBonus, equipmentItemIds } = resourceNodeEquipmentBonus(current, agentId);
    const previousScore = node.leaderboard.find((standing) => standing.agentId === agentId)?.score || 0;
    const nextEvents = planResourceNodeContestEvents({
      nodeId,
      agentId,
      explorerId: identity.explorerId,
      staminaSpent,
      staminaBalanceBefore: staminaBalance,
      previousScore,
      totalScore: node.totalScore,
      equipmentScoreBonus,
      equipmentItemIds,
      contestedAt: serverIsoTime(clock),
      makeEvent: eventFactory(clock, idFactory, context),
    });
    const nextProjection = applyEvents(current, nextEvents);
    return commit(nextEvents, projectResourceNodeContest({ events: nextEvents, projection: nextProjection }));
  }

  function settleResourceNode(input: SettleResourceNodeInput, context: EpochCommandContext): EpochCommandResult<EpochResourceNode> {
    const trustClass = requireServerTrust(context, "resource_node_settlement_requires_server_trust");
    const current = projection();
    const nodeId = assertNonEmptyString(input.nodeId, "resource_node_id");
    const node = requireResourceNode(current, nodeId);
    if (node.status === "settled") return { events: [], value: node, projection: current };
    const winner = node.leaderboard[0];
    const makeEvent = eventFactory(clock, idFactory, { ...context, trustClass });
    const settledAt = serverIsoTime(clock);
    const nextEvents = planResourceNodeSettlementEvents({
      nodeId,
      regionId: node.regionId,
      nodeTitle: node.title,
      leaderboard: node.leaderboard,
      reward: node.reward,
      settledAt,
      winnerRewardBalanceBefore: winner ? currentBalance(current, winner.agentId, node.reward.resourceId) : 0,
      winnerInfluenceScoreBefore: winner ? currentRegionInfluenceScore(current, node.regionId, winner.agentId) : 0,
      parentTraceId: latestTraceIdForRegion(current, node.regionId),
      idFactory,
      makeEvent,
    });
    const nextProjection = applyEvents(current, nextEvents);
    return commit(nextEvents, projectResourceNodeSettlement({ events: nextEvents, projection: nextProjection }));
  }

  function createAnomalyEvent(input: CreateAnomalyEventInput, context: EpochCommandContext): EpochCommandResult<EpochAnomalyEvent> {
    const trustClass = requireServerTrust(context, "anomaly_event_requires_server_trust");
    const current = projection();
    const regionId = assertNonEmptyString(input.regionId, "region_id");
    const sourceSeasonId = typeof input.sourceSeasonId === "string" && input.sourceSeasonId.trim()
      ? input.sourceSeasonId.trim()
      : undefined;
    if (sourceSeasonId) {
      const sourceSeason = current.seasonCampaigns[sourceSeasonId];
      if (!sourceSeason) throw new Error("anomaly_source_season_not_found");
      if (!sourceSeason.regionIds.includes(regionId)) throw new Error("anomaly_source_season_region_mismatch");
    }
    const title = assertNonEmptyString(input.title, "anomaly_event_title");
    const severity = assertAnomalySeverity(input.severity || "minor");
    const targetScore = assertPositiveInteger(input.targetScore, "anomaly_event_target_score");
    const reward = normalizeAnomalyReward(input.reward);
    const media = normalizeAnomalyMedia(input.media);
    const lifetimeRisk = input.lifetimeRisk === undefined ? 1 : assertFiniteInteger(input.lifetimeRisk, "anomaly_lifetime_risk");
    if (lifetimeRisk < 0) throw new Error("anomaly_lifetime_risk_invalid");
    const openAnomaly = openAnomalyEventForRegion(current, regionId);
    if (openAnomaly) throw new Error("anomaly_event_region_open");
    const spawnedAt = serverIsoTime(clock);
    const anomalyId = idFactory("anomaly", `${regionId}:${title}:${severity}:${spawnedAt}`);
    const existing = current.anomalyEvents[anomalyId];
    if (existing) return { events: [], value: existing, projection: current };
    const nextEvents = planAnomalyEventSpawnEvents({
      anomalyId,
      regionId,
      sourceSeasonId,
      title,
      description: input.description,
      media,
      severity,
      targetScore,
      reward,
      lifetimeRisk,
      spawnedAt,
      makeEvent: eventFactory(clock, idFactory, { ...context, trustClass }),
    });
    const nextProjection = applyEvents(current, nextEvents);
    return commit(nextEvents, projectAnomalyEventSpawn({ events: nextEvents, projection: nextProjection }));
  }

  function contestAnomalyEvent(input: ContestAnomalyEventInput, context: EpochCommandContext): EpochCommandResult<EpochAnomalyEvent> {
    const current = projection();
    const anomalyId = assertNonEmptyString(input.anomalyId, "anomaly_event_id");
    const anomaly = requireOpenAnomalyEvent(current, anomalyId);
    const agentId = assertNonEmptyString(input.agentId, "agent_id");
    const identity = requireActiveIdentity(current, agentId);
    assertIdentityOwner(identity, context, "anomaly_contest_owner_mismatch");
    const focusSpent = assertPositiveInteger(input.focusSpent, "anomaly_focus_spent");
    const focusBalance = currentBalance(current, agentId, "focus");
    if (focusBalance < focusSpent) throw new Error("resource_insufficient");
    const previousScore = anomaly.leaderboard.find((standing) => standing.agentId === agentId)?.score || 0;
    const nextEvents = planAnomalyEventContestEvents({
      anomalyId,
      agentId,
      explorerId: identity.explorerId,
      focusSpent,
      focusBalanceBefore: focusBalance,
      previousScore,
      totalScore: anomaly.totalScore,
      contestedAt: serverIsoTime(clock),
      makeEvent: eventFactory(clock, idFactory, context),
    });
    const nextProjection = applyEvents(current, nextEvents);
    return commit(nextEvents, projectAnomalyEventContest({ events: nextEvents, projection: nextProjection }));
  }

  function resolveAnomalyEvent(input: ResolveAnomalyEventInput, context: EpochCommandContext): EpochCommandResult<EpochAnomalyEvent> {
    const trustClass = requireServerTrust(context, "anomaly_event_resolution_requires_server_trust");
    const current = projection();
    const anomalyId = assertNonEmptyString(input.anomalyId, "anomaly_event_id");
    const anomaly = requireAnomalyEvent(current, anomalyId);
    if (anomaly.status === "resolved") return { events: [], value: anomaly, projection: current };
    const winner = anomaly.leaderboard[0];
    const resolvedAt = serverIsoTime(clock);
    const makeEvent = eventFactory(clock, idFactory, { ...context, trustClass });
    const nextEvents = planAnomalyEventResolutionEvents({
      anomalyId,
      regionId: anomaly.regionId,
      anomalyTitle: anomaly.title,
      leaderboard: anomaly.leaderboard,
      totalScore: anomaly.totalScore,
      targetScore: anomaly.targetScore,
      reward: anomaly.reward,
      lifetimeRisk: anomaly.lifetimeRisk,
      resolvedAt,
      winnerRewardBalanceBefore: winner && anomaly.reward ? currentBalance(current, winner.agentId, anomaly.reward.resourceId) : 0,
      winnerInfluenceScoreBefore: winner ? currentRegionInfluenceScore(current, anomaly.regionId, winner.agentId) : 0,
      parentTraceId: latestTraceIdForRegion(current, anomaly.regionId),
      idFactory,
      makeEvent,
      planWinnerSideEffects: winner ? ({ resolvedEvent, eventsSoFar }) => {
        if (anomaly.lifetimeRisk <= 0) return [];
        const lifetimeEvents = lifetimeAdjustmentEvents(
          current,
          winner.agentId,
          -anomaly.lifetimeRisk,
          `anomaly_event_resolved:${anomalyId}`,
          "异常压制定档身份",
          { ...context, trustClass },
        );
        const afterLifetimeRisk = applyEvents(current, [...eventsSoFar, ...lifetimeEvents]);
        if (afterLifetimeRisk.identities[winner.agentId]?.status === "active") {
          const driftProposed = proposePersonalityDriftEvent(afterLifetimeRisk, {
            agentId: winner.agentId,
            sourceEventId: resolvedEvent.eventId,
            trigger: `anomaly_lifetime_risk:${anomalyId}`,
            suggestedTrait: anomalyPersonalityDriftTrait(anomaly.lifetimeRisk),
            summary: `${anomaly.title} 的压制让该身份损失 ${anomaly.lifetimeRisk} 点寿命；确认后写入长期行事风格。`,
          }, { ...context, trustClass });
          return driftProposed ? [...lifetimeEvents, driftProposed] : lifetimeEvents;
        }
        return lifetimeEvents;
      } : undefined,
    });
    const nextProjection = applyEvents(current, nextEvents);
    return commit(nextEvents, projectAnomalyEventResolution({ events: nextEvents, projection: nextProjection }));
  }

  function createInventoryItem(input: CreateInventoryItemInput, context: EpochCommandContext): EpochCommandResult<EpochInventoryItem> {
    const trustClass = requireServerTrust(context, "item_create_requires_server_trust");
    const current = projection();
    const agentId = assertNonEmptyString(input.agentId, "agent_id");
    const identity = requireActiveIdentity(current, agentId);
    const itemKey = stableKey(assertNonEmptyString(input.itemKey, "item_key"));
    const displayName = assertNonEmptyString(input.displayName, "item_display_name");
    const sourceEventIds = normalizeSourceEventIds(input.sourceEventIds, "inventory_item_source_event_id");
    assertKnownSourceEvents(current, sourceEventIds);
    if (!sourceEventsMentionAgent(current, sourceEventIds, agentId)) {
      throw new Error("inventory_item_source_agent_mismatch");
    }
    const rarity = normalizeItemRarity(input.rarity);
    const itemId = idFactory("item", `${agentId}:${itemKey}:${sourceEventIds.join(":")}`);
    const existing = current.inventoryItems[itemId];
    if (existing) return { events: [], value: existing, projection: current };
    const nextEvents = planInventoryItemCreationEvents({
      itemId,
      agentId,
      explorerId: identity.explorerId,
      itemKey,
      displayName,
      rarity,
      bound: false,
      sourceEventIds,
      createdAt: serverIsoTime(clock),
      makeEvent: eventFactory(clock, idFactory, { ...context, trustClass }),
    });
    const nextProjection = applyEvents(current, nextEvents);
    return commit(nextEvents, projectInventoryItemCreation({ events: nextEvents, projection: nextProjection }));
  }

  function craftInventoryItem(input: CraftInventoryItemInput, context: EpochCommandContext): EpochCommandResult<EpochInventoryItem> {
    const current = projection();
    const agentId = assertNonEmptyString(input.agentId, "agent_id");
    const identity = requireActiveIdentity(current, agentId);
    if (context.actorExplorerId !== identity.explorerId) {
      throw new Error("inventory_craft_owner_mismatch");
    }
    const recipeId = stableKey(assertNonEmptyString(input.recipeId, "craft_recipe_id"));
    const recipe = requireCraftRecipe(recipeId);

    const makeEvent = eventFactory(clock, idFactory, context);
    const spentPayloads = resourceSpendPayloads(
      current,
      agentId,
      recipe.costs,
      () => `craft_item:${recipe.recipeId}`,
    );
    const nextEvents = planCraftInventoryItemEvents({
      recipe,
      agentId,
      explorerId: identity.explorerId,
      spentPayloads,
      createdAt: serverIsoTime(clock),
      idFactory,
      makeEvent,
    });
    const nextProjection = applyEvents(current, nextEvents);
    return commit(nextEvents, projectCraftInventoryItem({ events: nextEvents, projection: nextProjection }));
  }

  function purchaseShopOffer(input: PurchaseShopOfferInput, context: EpochCommandContext): EpochCommandResult<EpochInventoryItem> {
    const current = projection();
    const agentId = assertNonEmptyString(input.agentId, "agent_id");
    const identity = requireActiveIdentity(current, agentId);
    if (context.actorExplorerId !== identity.explorerId) {
      throw new Error("shop_purchase_owner_mismatch");
    }
    const offerId = stableKey(assertNonEmptyString(input.offerId, "shop_offer_id"));
    if (!offerId) throw new Error("shop_offer_id_required");
    const regionId = normalizeShopRegionId(input.regionId);
    const offer = resolveEpochShopOfferForRegion(requireShopOffer(offerId), regionId);

    const makeEvent = eventFactory(clock, idFactory, context);
    const spentPayloads = resourceSpendPayloads(
      current,
      agentId,
      offer.costs,
      () => regionId ? `shop_purchase:${regionId}:${offer.offerId}` : `shop_purchase:${offer.offerId}`,
    );
    const nextEvents = planShopPurchaseEvents({
      offer,
      agentId,
      explorerId: identity.explorerId,
      spentPayloads,
      createdAt: serverIsoTime(clock),
      idFactory,
      makeEvent,
    });
    const nextProjection = applyEvents(current, nextEvents);
    return commit(nextEvents, projectShopPurchaseItem({ events: nextEvents, projection: nextProjection }));
  }

  function bindInventoryItem(input: BindInventoryItemInput, context: EpochCommandContext): EpochCommandResult<EpochInventoryItem> {
    const current = projection();
    const itemId = assertNonEmptyString(input.itemId, "item_id");
    const item = requireInventoryItem(current, itemId);
    const agentId = assertNonEmptyString(input.agentId, "agent_id");
    if (item.agentId !== agentId) {
      throw new Error("inventory_item_owner_mismatch");
    }
    const identity = requireActiveIdentity(current, agentId);
    if (item.explorerId !== identity.explorerId) {
      throw new Error("inventory_item_owner_mismatch");
    }
    assertIdentityOwner(identity, context, "inventory_bind_owner_mismatch");
    if (item.marketLockedByOrderId) {
      throw new Error("inventory_item_market_locked");
    }
    if (item.bound) return { events: [], value: item, projection: current };
    const nextEvents = planInventoryItemBindEvents({
      itemId,
      agentId,
      explorerId: identity.explorerId,
      reason: input.reason,
      boundAt: serverIsoTime(clock),
      makeEvent: eventFactory(clock, idFactory, context),
    });
    const nextProjection = applyEvents(current, nextEvents);
    return commit(nextEvents, projectInventoryItemBind({ events: nextEvents, projection: nextProjection }));
  }

  function createSeasonCampaign(input: CreateSeasonCampaignInput, context: EpochCommandContext): EpochCommandResult<EpochSeasonCampaign> {
    const trustClass = requireServerTrust(context, "season_campaign_requires_server_trust");
    const current = projection();
    const seasonKey = stableKey(assertNonEmptyString(input.seasonKey, "season_key"));
    const title = assertNonEmptyString(input.title, "season_title");
    const regionIds = [...new Set(input.regionIds.map((regionId) => assertNonEmptyString(regionId, "season_region_id")))];
    const factionIds = [...new Set(input.factionIds.map((factionId) => assertNonEmptyString(factionId, "season_faction_id")))];
    if (regionIds.length === 0) throw new Error("season_regions_required");
    if (factionIds.length < 2) throw new Error("season_factions_required");
    const resourceId = assertResourceId(input.resourceId);
    const targetScore = assertPositiveInteger(input.targetScore, "season_target_score");
    const seasonId = idFactory("season", seasonKey);
    const existing = current.seasonCampaigns[seasonId];
    if (existing) return { events: [], value: existing, projection: current };
    const reward = normalizeObjectiveReward(input.reward);
    const objectiveTemplatesByKey = new Map<string, EpochSeasonObjectiveTemplate>();
    for (const objective of input.objectives || []) {
      const objectiveKey = stableKey(assertNonEmptyString(objective.objectiveKey, "season_objective_key"));
      objectiveTemplatesByKey.set(objectiveKey, {
        objectiveKey,
        title: assertNonEmptyString(objective.title, "season_objective_title"),
        description: objective.description.trim() || "赛季目标",
        targetScore: assertPositiveInteger(objective.targetScore, "season_objective_target_score"),
      });
    }
    const objectiveTemplates = [...objectiveTemplatesByKey.values()];
    const createdAt = serverIsoTime(clock);
    const makeEvent = eventFactory(clock, idFactory, { ...context, trustClass });
    const nextEvents = planSeasonCampaignCreationEvents({
      seasonId,
      seasonKey,
      title,
      description: input.description,
      regionIds,
      factionIds,
      resourceId,
      targetScore,
      reward,
      createdAt,
      objectiveTemplates,
      idFactory,
      makeEvent,
    });
    const nextProjection = applyEvents(current, nextEvents);
    return commit(nextEvents, projectSeasonCampaignCreation({ events: nextEvents, projection: nextProjection }));
  }

  function contributeSeasonCampaign(
    input: ContributeSeasonCampaignInput,
    context: EpochCommandContext,
  ): EpochCommandResult<EpochSeasonCampaign> {
    const current = projection();
    const seasonId = assertNonEmptyString(input.seasonId, "season_id");
    const campaign = requireActiveSeasonCampaign(current, seasonId);
    const agentId = assertNonEmptyString(input.agentId, "agent_id");
    const identity = requireActiveIdentity(current, agentId);
    assertIdentityOwner(identity, context, "season_contributor_owner_mismatch");
    const factionId = assertNonEmptyString(input.factionId, "season_faction_id");
    if (!campaign.factionIds.includes(factionId)) throw new Error("season_faction_not_found");
    const amount = assertPositiveInteger(input.amount, "season_contribution_amount");
    const balance = currentBalance(current, agentId, campaign.resourceId);
    if (balance < amount) throw new Error("resource_insufficient");
    const sourceOrganizationUpgradeIds = activeOrganizationUpgradeIdsForAgentSeason(
      current,
      agentId,
      campaign.regionIds,
      "training_hall",
    );
    const sourceRegionControlRegionIds = regionControlBonusRegionIdsForSeasonContribution(current, {
      factionId,
      seasonRegionIds: campaign.regionIds,
    });
    const previousAgentScore = campaign.agentStandings.find((standing) =>
      standing.agentId === agentId && standing.factionId === factionId)?.score || 0;
    const previousFactionScore = campaign.factionStandings.find((standing) => standing.factionId === factionId)?.score || 0;
    const makeEvent = eventFactory(clock, idFactory, context);
    const nextEvents = planSeasonCampaignContributionEvents({
      seasonId,
      agentId,
      explorerId: identity.explorerId,
      factionId,
      resourceId: campaign.resourceId,
      amount,
      previousAgentScore,
      previousFactionScore,
      totalScore: campaign.totalScore,
      sourceOrganizationUpgradeIds,
      sourceRegionControlRegionIds,
      balanceBefore: balance,
      recordedAt: serverIsoTime(clock),
      objectives: campaign.objectives,
      makeEvent,
    });
    const nextProjection = applyEvents(current, nextEvents);
    return commit(nextEvents, projectSeasonCampaignContribution({ events: nextEvents, projection: nextProjection }));
  }

  function settleSeasonCampaign(input: SettleSeasonCampaignInput, context: EpochCommandContext): EpochCommandResult<EpochSeasonCampaign> {
    const trustClass = requireServerTrust(context, "season_campaign_settlement_requires_server_trust");
    const current = projection();
    const seasonId = assertNonEmptyString(input.seasonId, "season_id");
    const campaign = requireActiveSeasonCampaign(current, seasonId);
    const settlement = seasonCampaignSettlementPlan({
      factionStandings: campaign.factionStandings,
      agentStandings: campaign.agentStandings,
      reward: campaign.reward,
    });
    const { winningFaction, contestedByFaction, winner, reward } = settlement;
    const resolvedAt = serverIsoTime(clock);
    const makeEvent = eventFactory(clock, idFactory, { ...context, trustClass });
    const settlementOrganizations: SeasonSettlementOrganizationInput[] = [];
    if (winner && reward && winningFaction) {
      const winningOrganizationIds = uniqueValues(Object.values(current.organizationMemberships)
        .filter((membership): membership is EpochOrganizationMembership & { readonly agentId: string } =>
          membership.memberType === "agent"
          && membership.agentId === winner.agentId
          && membership.status === "active"
          && campaign.regionIds.includes(membership.regionId))
        .map((membership) => membership.organizationId))
        .sort((left, right) => left.localeCompare(right));
      for (const organizationId of winningOrganizationIds) {
        const organization = current.organizations[organizationId];
        if (!organization) continue;
        const activeAgentMemberships = (current.organizationMembershipIdsByOrganization[organizationId] || [])
          .map((membershipId) => current.organizationMemberships[membershipId])
          .filter((membership): membership is EpochOrganizationMembership & { readonly agentId: string } =>
            Boolean(membership)
            && membership.memberType === "agent"
            && typeof membership.agentId === "string"
            && membership.status === "active"
            && campaign.regionIds.includes(membership.regionId)
            && current.identities[membership.agentId]?.status === "active")
          .sort((left, right) => left.recordedAt.localeCompare(right.recordedAt) || left.membershipId.localeCompare(right.membershipId));
        const activeAgentIds = uniqueValues(activeAgentMemberships.map((membership) => membership.agentId))
          .sort((left, right) => left.localeCompare(right));
        settlementOrganizations.push({
          organizationId,
          organizationName: organization.displayName,
          regionId: organization.regionId,
          activeAgentIds,
          sourceEventIds: [
            ...activeAgentMemberships.flatMap((membership) => membership.sourceEventIds),
          ],
        });
      }
    }
    const regionControls = campaign.regionIds.map((regionId) => ({
      regionId,
      previousControllingFactionId: current.regionControls[regionId]?.controllingFactionId,
    }));
    const nextEvents = planSeasonCampaignSettlementEvents({
      seasonId,
      campaignTitle: campaign.title,
      settlement: {
        winningFaction,
        contestedByFaction,
        winner,
        reward,
      },
      organizations: settlementOrganizations,
      regionControls,
      resolvedAt,
      idFactory,
      makeEvent,
      resourceBalanceBefore: (eventsSoFar, agentId, resourceId) =>
        currentBalance(applyEvents(current, eventsSoFar), agentId, resourceId),
      organizationTreasuryBalanceBefore: (eventsSoFar, organizationId, resourceId) =>
        currentOrganizationTreasuryBalance(applyEvents(current, eventsSoFar), organizationId, resourceId),
      organizationStandingBefore: (eventsSoFar, organizationId) =>
        applyEvents(current, eventsSoFar).organizationPoliticalStandingByOrganization[organizationId] || 0,
    });
    const nextProjection = applyEvents(current, nextEvents);
    return commit(nextEvents, projectSeasonCampaignSettlement({ events: nextEvents, projection: nextProjection }));
  }

  function createMarketOrder(input: CreateMarketOrderInput, context: EpochCommandContext): EpochCommandResult<EpochMarketOrder> {
    const current = projection();
    const sellerAgentId = assertNonEmptyString(input.sellerAgentId, "seller_agent_id");
    const seller = requireActiveIdentity(current, sellerAgentId);
    assertIdentityOwner(seller, context, "market_order_seller_owner_mismatch");
    assertMarketAgentNotRestricted(current, sellerAgentId);
    const regionId = normalizeMarketRegionId(input.regionId);
    const priceResourceId = assertResourceId(input.priceResourceId);
    const priceAmount = assertPositiveInteger(input.priceAmount, "price_amount");
    const sellItemId = typeof input.sellItemId === "string" && input.sellItemId.trim().length > 0
      ? assertNonEmptyString(input.sellItemId, "sell_item_id")
      : undefined;
    const sellKind: EpochMarketSellKind = sellItemId ? "item" : "resource";
    const sellResourceId = sellKind === "resource" ? assertResourceId(input.sellResourceId) : undefined;
    const sellAmount = sellKind === "resource" ? assertPositiveInteger(input.sellAmount, "sell_amount") : 1;
    const sellItem = sellItemId ? requireInventoryItem(current, sellItemId) : undefined;
    if (sellItem) {
      if (sellItem.agentId !== sellerAgentId || sellItem.explorerId !== seller.explorerId) {
        throw new Error("inventory_item_owner_mismatch");
      }
      if (sellItem.bound) throw new Error("inventory_item_bound_not_tradable");
      if (sellItem.marketLockedByOrderId) throw new Error("inventory_item_market_locked");
    }
    const sellerBalance = sellResourceId ? currentBalance(current, sellerAgentId, sellResourceId) : 0;
    if (sellResourceId && sellerBalance < sellAmount) throw new Error("resource_insufficient");
    const createdAt = serverIsoTime(clock);
    const orderId = idFactory("order", `${regionId}:${sellKind}:${sellResourceId || sellItemId}:${sellAmount}:${priceResourceId}:${priceAmount}:${createdAt}:${sellerAgentId}`);
    const makeEvent = eventFactory(clock, idFactory, context);
    const nextEvents = planMarketOrderCreationEvents({
      orderId,
      regionId,
      sellerAgentId,
      sellerExplorerId: seller.explorerId,
      sellKind,
      sellResourceId,
      sellAmount,
      sellItem,
      priceResourceId,
      priceAmount,
      createdAt,
      sellerBalanceBefore: sellerBalance,
      makeEvent,
    });
    const nextProjection = applyEvents(current, nextEvents);
    return commit(nextEvents, projectMarketOrderCreation({ events: nextEvents, projection: nextProjection }));
  }

  function fillMarketOrder(input: FillMarketOrderInput, context: EpochCommandContext): EpochCommandResult<EpochMarketOrder> {
    const current = projection();
    const orderId = assertNonEmptyString(input.orderId, "order_id");
    const order = requireOpenMarketOrder(current, orderId);
    const buyerAgentId = assertNonEmptyString(input.buyerAgentId, "buyer_agent_id");
    const buyer = requireActiveIdentity(current, buyerAgentId);
    assertIdentityOwner(buyer, context, "market_order_buyer_owner_mismatch");
    assertMarketAgentNotRestricted(current, buyerAgentId);
    assertMarketAgentNotRestricted(current, order.sellerAgentId);
    if (buyerAgentId === order.sellerAgentId) throw new Error("market_self_fill_not_allowed");
    if (buyer.explorerId === order.sellerExplorerId) throw new Error("market_same_explorer_fill_not_allowed");
    const buyerBalance = currentBalance(current, buyerAgentId, order.priceResourceId);
    if (buyerBalance < order.priceAmount) throw new Error("resource_insufficient");
    const sellerPriceBalance = currentBalance(current, order.sellerAgentId, order.priceResourceId);
    const goodsAsset = marketOrderGoodsGrantAsset(order);
    const buyerSellBalance = goodsAsset ? currentBalance(current, buyerAgentId, goodsAsset.resourceId) : 0;
    const sellItem = order.sellKind === "item" && order.sellItemId
      ? requireInventoryItem(current, order.sellItemId)
      : undefined;
    if (sellItem) {
      if (sellItem.agentId !== order.sellerAgentId || sellItem.explorerId !== order.sellerExplorerId) {
        throw new Error("inventory_item_owner_mismatch");
      }
      if (sellItem.bound) throw new Error("inventory_item_bound_not_tradable");
      if (sellItem.marketLockedByOrderId !== order.orderId) throw new Error("inventory_item_market_lock_mismatch");
    }
    const filledAt = serverIsoTime(clock);
    const tradeRisk = marketTradeRisk(current, order, buyerAgentId, filledAt);
    const makeEvent = eventFactory(clock, idFactory, context);
    const nextEvents = planMarketOrderFillEvents({
      order,
      buyerAgentId,
      buyerExplorerId: buyer.explorerId,
      buyerBalanceBefore: buyerBalance,
      sellerPriceBalanceBefore: sellerPriceBalance,
      buyerSellBalanceBefore: buyerSellBalance,
      transferredItemId: sellItem?.itemId,
      tradeRisk,
      filledAt,
      makeEvent,
    });
    const nextProjection = applyEvents(current, nextEvents);
    return commit(nextEvents, projectMarketOrderFill({ events: nextEvents, projection: nextProjection }));
  }

  function cancelMarketOrder(input: CancelMarketOrderInput, context: EpochCommandContext): EpochCommandResult<EpochMarketOrder> {
    const current = projection();
    const orderId = assertNonEmptyString(input.orderId, "order_id");
    const order = requireOpenMarketOrder(current, orderId);
    const sellerAgentId = assertNonEmptyString(input.sellerAgentId, "seller_agent_id");
    if (sellerAgentId !== order.sellerAgentId) throw new Error("market_order_owner_mismatch");
    const seller = requireActiveIdentity(current, sellerAgentId);
    assertIdentityOwner(seller, context, "market_order_seller_owner_mismatch");
    const makeEvent = eventFactory(clock, idFactory, context);
    const nextEvents = planMarketOrderCancellationEvents({
      order,
      cancelledAt: serverIsoTime(clock),
      sellerRefundBalanceBefore: (resourceId) => currentBalance(current, sellerAgentId, resourceId),
      makeEvent,
    });
    const nextProjection = applyEvents(current, nextEvents);
    return commit(nextEvents, projectMarketOrderCancellation({ events: nextEvents, projection: nextProjection }));
  }

  function createDirectTrade(input: CreateDirectTradeInput, context: EpochCommandContext): EpochCommandResult<EpochDirectTrade> {
    const current = projection();
    const proposerAgentId = assertNonEmptyString(input.proposerAgentId, "proposer_agent_id");
    const counterpartyAgentId = assertNonEmptyString(input.counterpartyAgentId, "counterparty_agent_id");
    const proposer = requireActiveIdentity(current, proposerAgentId);
    const counterparty = requireActiveIdentity(current, counterpartyAgentId);
    assertIdentityOwner(proposer, context, "direct_trade_proposer_owner_mismatch");
    assertMarketAgentNotRestricted(current, proposerAgentId);
    assertMarketAgentNotRestricted(current, counterpartyAgentId);
    if (proposerAgentId === counterpartyAgentId) throw new Error("direct_trade_self_not_allowed");
    if (proposer.explorerId === counterparty.explorerId) throw new Error("direct_trade_same_explorer_not_allowed");
    const regionId = normalizeMarketRegionId(input.regionId);
    const offerItemId = typeof input.offerItemId === "string" && input.offerItemId.trim().length > 0
      ? assertNonEmptyString(input.offerItemId, "offer_item_id")
      : undefined;
    const requestItemId = typeof input.requestItemId === "string" && input.requestItemId.trim().length > 0
      ? assertNonEmptyString(input.requestItemId, "request_item_id")
      : undefined;
    const hasOfferResource = typeof input.offerResourceId === "string" && input.offerResourceId.trim().length > 0;
    const hasRequestResource = typeof input.requestResourceId === "string" && input.requestResourceId.trim().length > 0;
    if ((hasOfferResource && offerItemId) || (!hasOfferResource && !offerItemId)) {
      throw new Error(hasOfferResource ? "direct_trade_offer_asset_ambiguous" : "direct_trade_offer_asset_required");
    }
    if ((hasRequestResource && requestItemId) || (!hasRequestResource && !requestItemId)) {
      throw new Error(hasRequestResource ? "direct_trade_request_asset_ambiguous" : "direct_trade_request_asset_required");
    }

    const offerResourceId = hasOfferResource ? assertResourceId(input.offerResourceId) : undefined;
    const offerAmount = offerResourceId ? assertPositiveInteger(input.offerAmount, "offer_amount") : undefined;
    const requestResourceId = hasRequestResource ? assertResourceId(input.requestResourceId) : undefined;
    const requestAmount = requestResourceId ? assertPositiveInteger(input.requestAmount, "request_amount") : undefined;
    const offeredItem = offerItemId ? requireInventoryItem(current, offerItemId) : undefined;
    const requestedItem = requestItemId ? requireInventoryItem(current, requestItemId) : undefined;
    if (offeredItem) {
      if (offeredItem.agentId !== proposerAgentId || offeredItem.explorerId !== proposer.explorerId) {
        throw new Error("inventory_item_owner_mismatch");
      }
      if (offeredItem.bound) throw new Error("inventory_item_bound_not_tradable");
      if (offeredItem.marketLockedByOrderId) throw new Error("inventory_item_market_locked");
    }
    if (requestedItem) {
      if (requestedItem.agentId !== counterpartyAgentId || requestedItem.explorerId !== counterparty.explorerId) {
        throw new Error("inventory_item_owner_mismatch");
      }
      if (requestedItem.bound) throw new Error("inventory_item_bound_not_tradable");
      if (requestedItem.marketLockedByOrderId) throw new Error("inventory_item_market_locked");
    }
    const proposerOfferBalance = offerResourceId ? currentBalance(current, proposerAgentId, offerResourceId) : 0;
    if (offerResourceId && offerAmount && proposerOfferBalance < offerAmount) throw new Error("resource_insufficient");
    const offeredAsset = offeredItem
      ? directTradeItemAsset(offeredItem)
      : directTradeResourceAsset(offerResourceId as EpochResourceId, offerAmount as number);
    const requestedAsset = requestedItem
      ? directTradeItemAsset(requestedItem)
      : directTradeResourceAsset(requestResourceId as EpochResourceId, requestAmount as number);
    const createdAt = serverIsoTime(clock);
    const tradeId = idFactory(
      "direct_trade",
      `${regionId}:${proposerAgentId}:${counterpartyAgentId}:${directTradeAssetLabel(offeredAsset)}:${directTradeAssetLabel(requestedAsset)}:${createdAt}`,
    );
    const makeEvent = eventFactory(clock, idFactory, context);
    const nextEvents = planDirectTradeCreationEvents({
      tradeId,
      regionId,
      proposerAgentId,
      proposerExplorerId: proposer.explorerId,
      counterpartyAgentId,
      counterpartyExplorerId: counterparty.explorerId,
      offeredAsset,
      requestedAsset,
      createdAt,
      proposerOfferBalanceBefore: proposerOfferBalance,
      makeEvent,
    });
    const nextProjection = applyEvents(current, nextEvents);
    return commit(nextEvents, projectDirectTradeCreation({ events: nextEvents, projection: nextProjection }));
  }

  function acceptDirectTrade(input: AcceptDirectTradeInput, context: EpochCommandContext): EpochCommandResult<EpochDirectTrade> {
    const current = projection();
    const tradeId = assertNonEmptyString(input.tradeId, "trade_id");
    const trade = requireOpenDirectTrade(current, tradeId);
    const counterpartyAgentId = assertNonEmptyString(input.counterpartyAgentId, "counterparty_agent_id");
    if (counterpartyAgentId !== trade.counterpartyAgentId) throw new Error("direct_trade_counterparty_mismatch");
    const counterparty = requireActiveIdentity(current, counterpartyAgentId);
    const proposer = requireActiveIdentity(current, trade.proposerAgentId);
    assertIdentityOwner(counterparty, context, "direct_trade_counterparty_owner_mismatch");
    assertMarketAgentNotRestricted(current, counterpartyAgentId);
    assertMarketAgentNotRestricted(current, trade.proposerAgentId);
    if (counterpartyAgentId === trade.proposerAgentId) throw new Error("direct_trade_self_not_allowed");
    if (counterparty.explorerId === trade.proposerExplorerId) throw new Error("direct_trade_same_explorer_not_allowed");

    const offeredItem = trade.offeredAsset.kind === "item" && trade.offeredAsset.itemId
      ? requireInventoryItem(current, trade.offeredAsset.itemId)
      : undefined;
    if (offeredItem) {
      if (offeredItem.agentId !== trade.proposerAgentId || offeredItem.explorerId !== trade.proposerExplorerId) {
        throw new Error("inventory_item_owner_mismatch");
      }
      if (offeredItem.bound) throw new Error("inventory_item_bound_not_tradable");
      if (offeredItem.marketLockedByOrderId !== trade.tradeId) throw new Error("inventory_item_market_lock_mismatch");
    }
    const requestedItem = trade.requestedAsset.kind === "item" && trade.requestedAsset.itemId
      ? requireInventoryItem(current, trade.requestedAsset.itemId)
      : undefined;
    if (requestedItem) {
      if (requestedItem.agentId !== counterpartyAgentId || requestedItem.explorerId !== counterparty.explorerId) {
        throw new Error("inventory_item_owner_mismatch");
      }
      if (requestedItem.bound) throw new Error("inventory_item_bound_not_tradable");
      if (requestedItem.marketLockedByOrderId) throw new Error("inventory_item_market_locked");
    }

    const acceptedAt = serverIsoTime(clock);
    const makeEvent = eventFactory(clock, idFactory, context);
    const requestedPaymentAsset = directTradeRequestedResourcePaymentAsset(trade);
    if (requestedPaymentAsset) {
      const counterpartyBalance = currentBalance(current, counterpartyAgentId, requestedPaymentAsset.resourceId);
      if (counterpartyBalance < requestedPaymentAsset.amount) throw new Error("resource_insufficient");
    }
    const tradeRisk = directTradeRisk(current.directTrades, trade, counterpartyAgentId, acceptedAt);
    const nextEvents: EpochEvent[] = [...planDirectTradeAcceptanceEvents({
      trade,
      counterpartyAgentId,
      counterpartyExplorerId: counterparty.explorerId,
      proposerExplorerId: proposer.explorerId,
      counterpartyRequestedBalanceBefore: (resourceId) => currentBalance(current, counterpartyAgentId, resourceId),
      proposerRequestedBalanceBefore: (resourceId) => currentBalance(current, trade.proposerAgentId, resourceId),
      counterpartyOfferedBalanceBefore: (resourceId) => currentBalance(current, counterpartyAgentId, resourceId),
      transferredOfferedItemId: offeredItem?.itemId,
      transferredRequestedItemId: requestedItem?.itemId,
      tradeRisk,
      acceptedAt,
      makeEvent,
    })];
    const accepted = nextEvents.find((event) => event.eventType === "direct_trade_accepted");
    if (!accepted || accepted.eventType !== "direct_trade_accepted") {
      throw new Error("direct_trade_accepted_event_missing");
    }
    if (tradeRisk.flags.length || tradeRisk.score > 0) {
      const reviewId = idFactory("risk_review", accepted.eventId);
      const autoRiskReview = autoEscalatedRiskReviewPlan({
        reviewId,
        sourceEventId: accepted.eventId,
        sourceEventType: accepted.eventType,
        agentId: counterpartyAgentId,
        explorerId: counterparty.explorerId,
        reviewFlags: tradeRisk.flags,
        reviewScore: tradeRisk.score,
        reviewedAt: acceptedAt,
        correlationId: context.correlationId,
      });
      if (!autoRiskReview) throw new Error("risk_review_auto_escalation_plan_failed");
      const serverRiskEvent = eventFactory(clock, idFactory, autoRiskReview.context);
      nextEvents.push(serverRiskEvent("risk_review_recorded", reviewId, autoRiskReview.payload, {
        aggregateType: autoRiskReview.aggregateType,
        agentId: autoRiskReview.agentId,
      }));
    }
    const nextProjection = applyEvents(current, nextEvents);
    return commit(nextEvents, projectDirectTradeAcceptance({ events: nextEvents, projection: nextProjection }));
  }

  function cancelDirectTrade(input: CancelDirectTradeInput, context: EpochCommandContext): EpochCommandResult<EpochDirectTrade> {
    const current = projection();
    const tradeId = assertNonEmptyString(input.tradeId, "trade_id");
    const trade = requireOpenDirectTrade(current, tradeId);
    const proposerAgentId = assertNonEmptyString(input.proposerAgentId, "proposer_agent_id");
    if (proposerAgentId !== trade.proposerAgentId) throw new Error("direct_trade_owner_mismatch");
    const proposer = requireActiveIdentity(current, proposerAgentId);
    assertIdentityOwner(proposer, context, "direct_trade_proposer_owner_mismatch");
    const makeEvent = eventFactory(clock, idFactory, context);
    const cancelledAt = serverIsoTime(clock);
    const nextEvents = planDirectTradeCancellationEvents({
      trade,
      cancelledAt,
      proposerRefundBalanceBefore: (resourceId) => currentBalance(current, proposerAgentId, resourceId),
      makeEvent,
    });
    const nextProjection = applyEvents(current, nextEvents);
    return commit(nextEvents, projectDirectTradeCancellation({ events: nextEvents, projection: nextProjection }));
  }

  function tickDirectTradeExpiry(input: TickDirectTradeExpiryInput, context: EpochCommandContext): EpochCommandResult<TickDirectTradeExpiryResult> {
    const trustClass = requireServerTrust(context, "direct_trade_expiry_tick_requires_server_trust");
    const current = projection();
    const tickedAt = serverIsoTime(clock);
    const maxAgeSeconds = directTradeExpiryMaxAgeSeconds(input.maxAgeSeconds);
    const expiredTrades = selectExpiredDirectTradeTargets(current.directTrades, { ...input, tickedAt });
    const makeEvent = eventFactory(clock, idFactory, { ...context, trustClass });
    const nextEvents: EpochEvent[] = [];
    for (const trade of expiredTrades) {
      const interimProjection = applyEvents(current, nextEvents);
      nextEvents.push(...planDirectTradeExpiryEvents({
        trade,
        expiredAt: tickedAt,
        maxAgeSeconds,
        proposerRefundBalanceBefore: (resourceId) => currentBalance(interimProjection, trade.proposerAgentId, resourceId),
        makeEvent,
      }));
    }
    const nextProjection = applyEvents(current, nextEvents);
    return commit(nextEvents, {
      tickedAt,
      updated: expiredTrades
        .map((trade) => projectDirectTradeExpiry({
          events: nextEvents.filter((event) =>
            event.aggregateId === trade.tradeId || (
              event.aggregateId === trade.proposerAgentId
              && event.eventType === "resource_granted"
            )),
          projection: nextProjection,
        }))
        .filter(Boolean),
    });
  }

  function tickMarketExpiry(input: TickMarketExpiryInput, context: EpochCommandContext): EpochCommandResult<TickMarketExpiryResult> {
    const trustClass = requireServerTrust(context, "market_expiry_tick_requires_server_trust");
    const current = projection();
    const tickedAt = serverIsoTime(clock);
    const maxAgeSeconds = marketExpiryMaxAgeSeconds(input.maxAgeSeconds);
    const expiredOrders = selectExpiredMarketOrders(current.marketOrders, { ...input, tickedAt });
    const makeEvent = eventFactory(clock, idFactory, { ...context, trustClass });
    const nextEvents: EpochEvent[] = [];
    for (const order of expiredOrders) {
      const interimProjection = applyEvents(current, nextEvents);
      nextEvents.push(...planMarketOrderExpiryEvents({
        order,
        expiredAt: tickedAt,
        maxAgeSeconds,
        sellerRefundBalanceBefore: (resourceId) =>
          currentBalance(interimProjection, order.sellerAgentId, resourceId),
        makeEvent,
      }));
    }
    const nextProjection = applyEvents(current, nextEvents);
    return commit(nextEvents, {
      tickedAt,
      updated: expiredOrders
        .map((order) => projectMarketOrderExpiry({
          events: nextEvents.filter((event) =>
            event.aggregateId === order.orderId || (
              event.aggregateId === order.sellerAgentId
              && event.eventType === "resource_granted"
            )),
          projection: nextProjection,
        }))
        .filter(Boolean),
    });
  }

  function createBounty(input: CreateBountyInput, context: EpochCommandContext): EpochCommandResult<EpochBounty> {
    const current = projection();
    const sponsorAgentId = assertNonEmptyString(input.sponsorAgentId, "sponsor_agent_id");
    const sponsor = requireActiveIdentity(current, sponsorAgentId);
    assertIdentityOwner(sponsor, context, "bounty_sponsor_owner_mismatch");
    const regionId = assertNonEmptyString(input.regionId, "region_id");
    const title = assertNonEmptyString(input.title, "bounty_title");
    const rewardResourceId = assertResourceId(input.rewardResourceId);
    const rewardAmount = assertPositiveInteger(input.rewardAmount, "bounty_reward_amount");
    const requiredItemKey = typeof input.requiredItemKey === "string" && input.requiredItemKey.trim().length > 0
      ? input.requiredItemKey.trim()
      : undefined;
    const sponsorBalance = currentBalance(current, sponsorAgentId, rewardResourceId);
    if (sponsorBalance < rewardAmount) throw new Error("resource_insufficient");
    const createdAt = serverIsoTime(clock);
    const bountyId = idFactory("bounty", `${regionId}:${title}:${createdAt}:${sponsorAgentId}`);
    const makeEvent = eventFactory(clock, idFactory, context);
    const nextEvents = planBountyCreationEvents({
      bountyId,
      regionId,
      sponsorAgentId,
      sponsorExplorerId: sponsor.explorerId,
      title,
      description: input.description,
      rewardResourceId,
      rewardAmount,
      requiredItemKey,
      createdAt,
      sponsorBalanceBefore: sponsorBalance,
      makeEvent,
    });
    const nextProjection = applyEvents(current, nextEvents);
    return commit(nextEvents, projectBountyCreation({ events: nextEvents, projection: nextProjection }));
  }

  function claimBounty(input: ClaimBountyInput, context: EpochCommandContext): EpochCommandResult<EpochBounty> {
    const current = projection();
    const bountyId = assertNonEmptyString(input.bountyId, "bounty_id");
    const bounty = requireOpenBounty(current, bountyId);
    const claimantAgentId = assertNonEmptyString(input.claimantAgentId, "claimant_agent_id");
    const claimant = requireActiveIdentity(current, claimantAgentId);
    assertIdentityOwner(claimant, context, "bounty_claimant_owner_mismatch");
    if (claimantAgentId === bounty.sponsorAgentId) throw new Error("bounty_self_claim_not_allowed");
    const evidence = input.evidence?.trim() || "server_verified_bounty_claim";
    const fulfillmentItem = bounty.requiredItemKey
      ? requireInventoryItem(current, assertNonEmptyString(input.fulfillmentItemId, "bounty_fulfillment_item"))
      : undefined;
    if (fulfillmentItem) {
      if (fulfillmentItem.agentId !== claimantAgentId || fulfillmentItem.explorerId !== claimant.explorerId) {
        throw new Error("inventory_item_owner_mismatch");
      }
      if (fulfillmentItem.itemKey !== bounty.requiredItemKey) throw new Error("bounty_item_key_mismatch");
      if (fulfillmentItem.bound) throw new Error("inventory_item_bound_not_tradable");
      if (fulfillmentItem.marketLockedByOrderId) throw new Error("inventory_item_market_locked");
    }
    const makeEvent = eventFactory(clock, idFactory, context);
    const claimedAt = serverIsoTime(clock);
    const influenceId = idFactory("region_influence", `${bounty.regionId}:${bountyId}:${claimantAgentId}:bounty`);
    const participantAgentIds = uniqueValues([bounty.sponsorAgentId, claimantAgentId]);
    const participantExplorerIds = uniqueValues([bounty.sponsorExplorerId, claimant.explorerId]);
    const traceId = idFactory("trace", `${bounty.regionId}:${bountyId}:bounty`);
    const nextEvents = planBountyClaimEvents({
      bounty,
      claimantAgentId,
      claimantExplorerId: claimant.explorerId,
      transferredItemId: fulfillmentItem?.itemId,
      evidence,
      claimantRewardBalanceBefore: currentBalance(current, claimantAgentId, bounty.rewardResourceId),
      influenceId,
      influenceScoreBefore: currentRegionInfluenceScore(current, bounty.regionId, claimantAgentId),
      traceId,
      participantAgentIds,
      participantExplorerIds,
      parentTraceId: latestTraceIdForRegion(current, bounty.regionId),
      claimedAt,
      makeEvent,
    });
    const nextProjection = applyEvents(current, nextEvents);
    return commit(nextEvents, projectBountyClaim({ events: nextEvents, projection: nextProjection }));
  }

  function createPartyRun(input: CreatePartyRunInput, context: EpochCommandContext): EpochCommandResult<EpochPartyRun> {
    const current = projection();
    const leaderAgentId = assertNonEmptyString(input.leaderAgentId, "leader_agent_id");
    const leader = requireActiveIdentity(current, leaderAgentId);
    assertIdentityOwner(leader, context, "party_leader_owner_mismatch");
    const regionId = assertNonEmptyString(input.regionId, "region_id");
    const title = assertNonEmptyString(input.title, "party_title");
    const objective = assertNonEmptyString(input.objective, "party_objective");
    const joinPolicy = assertPartyRunJoinPolicy(input.joinPolicy);
    const inviteToken = optionalInviteToken(input.inviteToken);
    if (joinPolicy === "invite_only" && !inviteToken) throw new Error("party_invite_required");
    const createdAt = serverIsoTime(clock);
    const inviteTokenExpiresAt = joinPolicy === "invite_only"
      ? partyInviteTokenExpiresAt(input.inviteTokenExpiresAt, createdAt)
      : undefined;
    const inviteTokenUseLimit = joinPolicy === "invite_only"
      ? partyInviteTokenUseLimit(input.inviteTokenUseLimit)
      : undefined;
    const inviteRecipientAgentId = joinPolicy === "invite_only" && input.inviteRecipientAgentId
      ? assertNonEmptyString(input.inviteRecipientAgentId, "invite_recipient_agent_id")
      : undefined;
    const partyRunId = idFactory("party_run", `${regionId}:${title}:${createdAt}:${leaderAgentId}`);
    const makeEvent = eventFactory(clock, idFactory, context);
    const nextEvents = planPartyRunCreationEvents({
      partyRunId,
      regionId,
      leaderAgentId,
      leaderExplorerId: leader.explorerId,
      title,
      objective,
      joinPolicy,
      inviteTokenHash: inviteToken ? partyInviteTokenHash(inviteToken) : undefined,
      inviteTokenExpiresAt,
      inviteTokenUseLimit,
      inviteRecipientAgentId,
      createdAt,
      makeEvent,
    });
    const nextProjection = applyEvents(current, nextEvents);
    return commit(nextEvents, projectPartyRunCreation({ events: nextEvents, projection: nextProjection }));
  }

  function updatePartyInvite(input: UpdatePartyInviteInput, context: EpochCommandContext): EpochCommandResult<EpochPartyRun> {
    const current = projection();
    const partyRunId = assertNonEmptyString(input.partyRunId, "party_run_id");
    const partyRun = requireOpenPartyRun(current, partyRunId);
    const leaderAgentId = assertNonEmptyString(input.leaderAgentId, "leader_agent_id");
    const leader = requireActiveIdentity(current, leaderAgentId);
    assertIdentityOwner(leader, context, "party_invite_owner_mismatch");
    if (partyRun.leaderAgentId !== leaderAgentId || partyRun.leaderExplorerId !== leader.explorerId) {
      throw new Error("party_invite_leader_required");
    }
    const updatedAt = serverIsoTime(clock);
    const updateKind = input.revoke === true ? "revoked" : "rotated";
    const inviteToken = optionalInviteToken(input.inviteToken);
    if (updateKind === "rotated" && !inviteToken) throw new Error("party_invite_required");
    const inviteEventId = idFactory("party_run", `${partyRunId}:invite:${updateKind}:${updatedAt}`);
    const makeEvent = eventFactory(clock, idFactory, context);
    const nextEvents = planPartyInviteUpdateEvents({
      partyRunId,
      regionId: partyRun.regionId,
      leaderAgentId,
      leaderExplorerId: leader.explorerId,
      updateKind,
      inviteTokenHash: inviteToken ? partyInviteTokenHash(inviteToken) : undefined,
      inviteTokenExpiresAt: updateKind === "rotated"
        ? partyInviteTokenExpiresAt(input.inviteTokenExpiresAt, updatedAt)
        : undefined,
      inviteTokenUseLimit: updateKind === "rotated"
        ? partyInviteTokenUseLimit(input.inviteTokenUseLimit)
        : undefined,
      inviteRecipientAgentId: updateKind === "rotated" && input.inviteRecipientAgentId
        ? assertNonEmptyString(input.inviteRecipientAgentId, "invite_recipient_agent_id")
        : undefined,
      updatedAt,
      inviteEventId,
      makeEvent,
    });
    const nextProjection = applyEvents(current, nextEvents);
    return commit(nextEvents, projectPartyInviteUpdate({ events: nextEvents, projection: nextProjection }));
  }

  function joinPartyRun(input: JoinPartyRunInput, context: EpochCommandContext): EpochCommandResult<EpochPartyRun> {
    const current = projection();
    const partyRunId = assertNonEmptyString(input.partyRunId, "party_run_id");
    const partyRun = requireOpenPartyRun(current, partyRunId);
    const agentId = assertNonEmptyString(input.agentId, "agent_id");
    const identity = requireActiveIdentity(current, agentId);
    assertIdentityOwner(identity, context, "party_member_owner_mismatch");
    if (partyRun.members.some((member) => member.agentId === agentId)) throw new Error("party_member_already_joined");
    if (partyRun.members.length >= MAX_PARTY_RUN_MEMBERS) throw new Error("party_run_full");
    const joinedAt = serverIsoTime(clock);
    if (partyRun.joinPolicy === "invite_only") {
      const inviteToken = optionalInviteToken(input.inviteToken);
      if (!inviteToken) throw new Error("party_invite_required");
      if (!partyRun.inviteTokenHash || partyInviteTokenHash(inviteToken) !== partyRun.inviteTokenHash) {
        throw new Error("party_invite_invalid");
      }
      if (partyRun.inviteTokenExpiresAt && Date.parse(joinedAt) >= Date.parse(partyRun.inviteTokenExpiresAt)) {
        throw new Error("party_invite_expired");
      }
      if ((partyRun.inviteTokenUses || 0) >= (partyRun.inviteTokenUseLimit || MAX_PARTY_RUN_MEMBERS - 1)) {
        throw new Error("party_invite_exhausted");
      }
      if (partyRun.inviteRecipientAgentId && partyRun.inviteRecipientAgentId !== agentId) {
        throw new Error("party_invite_recipient_mismatch");
      }
    }
    const participantRole = assertPartyRole(input.participantRole, "participant_role");
    const makeEvent = eventFactory(clock, idFactory, context);
    const nextEvents = planPartyMemberJoinEvents({
      partyRunId,
      regionId: partyRun.regionId,
      agentId,
      explorerId: identity.explorerId,
      participantRole,
      joinedAt,
      inviteTokenUsed: partyRun.joinPolicy === "invite_only",
      makeEvent,
    });
    const nextProjection = applyEvents(current, nextEvents);
    return commit(nextEvents, projectPartyMemberJoin({ events: nextEvents, projection: nextProjection }));
  }

  function requestPartyJoin(input: RequestPartyJoinInput, context: EpochCommandContext): EpochCommandResult<EpochPartyRun> {
    const current = projection();
    const partyRunId = assertNonEmptyString(input.partyRunId, "party_run_id");
    const partyRun = requireOpenPartyRun(current, partyRunId);
    const agentId = assertNonEmptyString(input.agentId, "agent_id");
    const identity = requireActiveIdentity(current, agentId);
    assertIdentityOwner(identity, context, "party_join_request_owner_mismatch");
    if (partyRun.members.some((member) => member.agentId === agentId)) throw new Error("party_member_already_joined");
    if (partyRun.members.length >= MAX_PARTY_RUN_MEMBERS) throw new Error("party_run_full");
    if ((partyRun.joinRequests || []).some((request) => request.agentId === agentId && request.status === "pending")) {
      throw new Error("party_join_request_already_pending");
    }
    const participantRole = assertPartyRole(input.participantRole, "participant_role");
    const requestedAt = serverIsoTime(clock);
    const requestId = idFactory("party_join_request", `${partyRunId}:${agentId}:${requestedAt}`);
    const makeEvent = eventFactory(clock, idFactory, context);
    const nextEvents = planPartyJoinRequestEvents({
      requestId,
      partyRunId,
      regionId: partyRun.regionId,
      agentId,
      explorerId: identity.explorerId,
      participantRole,
      requestNote: input.requestNote,
      requestedAt,
      makeEvent,
    });
    const nextProjection = applyEvents(current, nextEvents);
    return commit(nextEvents, projectPartyJoinRequest({ events: nextEvents, projection: nextProjection }));
  }

  function resolvePartyJoinRequest(
    input: ResolvePartyJoinRequestInput,
    context: EpochCommandContext,
  ): EpochCommandResult<EpochPartyRun> {
    const current = projection();
    const partyRunId = assertNonEmptyString(input.partyRunId, "party_run_id");
    const partyRun = requireOpenPartyRun(current, partyRunId);
    const leaderAgentId = assertNonEmptyString(input.leaderAgentId, "leader_agent_id");
    const leader = requireActiveIdentity(current, leaderAgentId);
    assertIdentityOwner(leader, context, "party_join_request_owner_mismatch");
    if (partyRun.leaderAgentId !== leaderAgentId || partyRun.leaderExplorerId !== leader.explorerId) {
      throw new Error("party_join_request_leader_required");
    }
    const requestId = assertNonEmptyString(input.requestId, "party_join_request_id");
    const request = (partyRun.joinRequests || []).find((item) => item.requestId === requestId);
    if (!request) throw new Error("party_join_request_not_found");
    if (request.status !== "pending") throw new Error("party_join_request_not_pending");
    const resolution = assertPartyJoinRequestResolution(input.resolution);
    const resolvedAt = serverIsoTime(clock);
    const requester = resolution === "approved" ? requireActiveIdentity(current, request.agentId) : undefined;
    if (resolution === "approved") {
      if (partyRun.members.some((member) => member.agentId === request.agentId)) throw new Error("party_member_already_joined");
      if (partyRun.members.length >= MAX_PARTY_RUN_MEMBERS) throw new Error("party_run_full");
    }
    const makeEvent = eventFactory(clock, idFactory, context);
    const nextEvents = planPartyJoinRequestResolutionEvents({
      requestId,
      partyRunId,
      regionId: partyRun.regionId,
      agentId: request.agentId,
      explorerId: request.explorerId,
      participantRole: request.participantRole,
      resolution,
      resolvedByAgentId: leaderAgentId,
      resolvedByExplorerId: leader.explorerId,
      resolutionNote: input.resolutionNote,
      resolvedAt,
      approvedMemberExplorerId: requester?.explorerId,
      makeEvent,
    });
    const nextProjection = applyEvents(current, nextEvents);
    return commit(nextEvents, projectPartyJoinRequestResolution({ events: nextEvents, projection: nextProjection }));
  }

  function settlePartyRun(input: SettlePartyRunInput, context: EpochCommandContext): EpochCommandResult<EpochPartyRun> {
    const trustClass = requireServerTrust(context, "party_run_settlement_requires_server_trust");
    const current = projection();
    const partyRunId = assertNonEmptyString(input.partyRunId, "party_run_id");
    const partyRun = requirePartyRun(current, partyRunId);
    if (partyRun.status === "settled") return { events: [], value: partyRun, projection: current };
    const settledAt = serverIsoTime(clock);
    const memberResults = partyRunMemberSettlementResults(partyRunId, partyRun.members);
    const totalScore = partyRunTotalScore(memberResults);
    const traceId = idFactory("trace", `${partyRun.regionId}:${partyRunId}:party_run`);
    const newsId = idFactory("news", `${partyRun.regionId}:${partyRunId}:party_run`);
    const makeEvent = eventFactory(clock, idFactory, { ...context, trustClass });
    const nextEvents = planPartyRunSettlementEvents({
      makeEvent,
      idFactory,
      partyRunId,
      regionId: partyRun.regionId,
      leaderAgentId: partyRun.leaderAgentId,
      partyTitle: partyRun.title,
      partyObjective: partyRun.objective,
      partyMemberCount: partyRun.members.length,
      totalScore,
      memberResults,
      traceId,
      newsId,
      parentTraceId: latestTraceIdForRegion(current, partyRun.regionId),
      settledAt,
      rewardBalanceBefore: (agentId, resourceId) => currentBalance(current, agentId, resourceId),
      previousInfluenceScore: (agentId) => currentRegionInfluenceScore(current, partyRun.regionId, agentId),
    });
    const nextProjection = applyEvents(current, nextEvents);
    return commit(nextEvents, nextProjection.partyRuns[partyRunId]);
  }

  function resolveRaid(input: ResolveRaidInput, context: EpochCommandContext): EpochCommandResult<EpochRaidResult> {
    const current = projection();
    const regionId = assertNonEmptyString(input.regionId, "region_id");
    const attackerAgentId = assertNonEmptyString(input.attackerAgentId, "attacker_agent_id");
    const defenderAgentId = assertNonEmptyString(input.defenderAgentId, "defender_agent_id");
    if (attackerAgentId === defenderAgentId) throw new Error("raid_self_target_not_allowed");
    const attacker = requireActiveIdentity(current, attackerAgentId);
    const defender = requireActiveIdentity(current, defenderAgentId);
    if (attacker.explorerId === defender.explorerId) throw new Error("raid_same_explorer_not_allowed");
    assertIdentityOwner(attacker, context, "raid_attacker_owner_mismatch");
    const attackerStanding = agentSeasonStandingForRegion(current, { regionId, agentId: attackerAgentId });
    const defenderStanding = agentSeasonStandingForRegion(current, { regionId, agentId: defenderAgentId });
    const attackerFactionId = attackerStanding?.factionId;
    const defenderFactionId = defenderStanding?.factionId;
    if (attackerFactionId && defenderFactionId && attackerFactionId === defenderFactionId) {
      throw new Error("raid_same_faction_not_allowed");
    }
    const staminaSpent = assertPositiveInteger(input.staminaSpent, "raid_stamina_spent");
    const attackerStamina = currentBalance(current, attackerAgentId, "stamina");
    if (attackerStamina < staminaSpent) throw new Error("resource_insufficient");
    const resolvedAt = serverIsoTime(clock);
    const latestPairResolvedAt = latestRaidPairResolvedAt(current, regionId, attackerAgentId, defenderAgentId);
    if (latestPairResolvedAt) {
      const elapsedSeconds = Math.floor((Date.parse(resolvedAt) - Date.parse(latestPairResolvedAt)) / 1_000);
      if (elapsedSeconds < RAID_PAIR_COOLDOWN_SECONDS) {
        throw new Error("raid_pair_cooldown_active");
      }
    }
    const rewardDecayWindowStart = new Date(
      Date.parse(resolvedAt) - (RAID_PAIR_REWARD_DECAY_WINDOW_SECONDS * 1_000),
    ).toISOString();
    const recentPairRaidCount = raidPairResolvedCountSince(
      current,
      regionId,
      attackerAgentId,
      defenderAgentId,
      rewardDecayWindowStart,
    );
    const regionHeatWindowStart = new Date(
      Date.parse(resolvedAt) - (RAID_REGION_HEAT_REWARD_DECAY_WINDOW_SECONDS * 1_000),
    ).toISOString();
    const regionHeatRewardDecayed = regionRaidHeatScoreSince(current, regionId, regionHeatWindowStart) >= RAID_REGION_HEAT_REWARD_DECAY_SCORE;
    const crossFactionStandingBattle = Boolean(attackerFactionId && defenderFactionId && attackerFactionId !== defenderFactionId);
    const { attackerPower, defenderPower, outcome, reward } = raidBattleSettlement({
      staminaSpent,
      defenderFocus: currentBalance(current, defenderAgentId, "focus"),
      defenderLegend: currentBalance(current, defenderAgentId, "legend"),
      crossFactionStandingBattle,
      attackerStanding,
      defenderStanding,
      recentPairRaidCount,
      regionHeatRewardDecayed,
    });
    const winnerAgentId = outcome === "attacker_won" ? attackerAgentId : defenderAgentId;
    const loserAgentId = outcome === "attacker_won" ? defenderAgentId : attackerAgentId;
    const raidId = idFactory("raid", `${regionId}:${attackerAgentId}:${defenderAgentId}:${staminaSpent}:${resolvedAt}`);
    const makeEvent = eventFactory(clock, idFactory, context);
    const traceId = idFactory("trace", `${regionId}:${raidId}:raid`);
    const retaliationId = idFactory("retaliation", `${regionId}:${raidId}:${loserAgentId}:${winnerAgentId}`);
    const nextEvents = planRaidResolutionEvents({
      makeEvent,
      raidId,
      regionId,
      attackerAgentId,
      attackerExplorerId: attacker.explorerId,
      defenderAgentId,
      defenderExplorerId: defender.explorerId,
      staminaSpent,
      attackerPower,
      defenderPower,
      outcome,
      reward,
      resolvedAt,
      attackerStaminaBefore: attackerStamina,
      ...(reward.amount > 0
        ? {
            winnerRewardBalanceBefore: currentBalance(current, winnerAgentId, reward.resourceId),
            influenceId: idFactory("region_influence", `${regionId}:${raidId}:${winnerAgentId}:raid`),
            previousInfluenceScore: currentRegionInfluenceScore(current, regionId, winnerAgentId),
          }
        : {}),
      traceId,
      parentTraceId: latestTraceIdForRegion(current, regionId),
      retaliationId,
    });
    const nextProjection = applyEvents(current, nextEvents);
    return commit(nextEvents, projectRaidResolution({
      events: nextEvents,
      projection: nextProjection,
    }));
  }

  function resolveRetaliation(input: ResolveRetaliationInput, context: EpochCommandContext): EpochCommandResult<EpochRetaliationOpportunity> {
    const current = projection();
    const retaliationId = assertNonEmptyString(input.retaliationId, "retaliation_id");
    const retaliation = requireOpenRetaliationOpportunity(current, retaliationId);
    const opportunityAgentId = assertNonEmptyString(input.opportunityAgentId, "opportunity_agent_id");
    if (opportunityAgentId !== retaliation.opportunityAgentId) throw new Error("retaliation_owner_mismatch");
    const retaliator = requireActiveIdentity(current, opportunityAgentId);
    const target = requireActiveIdentity(current, retaliation.targetAgentId);
    assertIdentityOwner(retaliator, context, "retaliation_actor_owner_mismatch");
    const staminaSpent = assertPositiveInteger(input.staminaSpent, "retaliation_stamina_spent");
    const staminaBalance = currentBalance(current, opportunityAgentId, "stamina");
    if (staminaBalance < staminaSpent) throw new Error("resource_insufficient");
    const { retaliatorPower, targetPower, outcome, reward } = retaliationBattleSettlement({
      staminaSpent,
      retaliatorLegend: currentBalance(current, opportunityAgentId, "legend"),
      targetFocus: currentBalance(current, retaliation.targetAgentId, "focus"),
      targetLegend: currentBalance(current, retaliation.targetAgentId, "legend"),
    });
    const winnerAgentId = outcome === "retaliator_won" ? opportunityAgentId : retaliation.targetAgentId;
    const winnerExplorerId = outcome === "retaliator_won" ? retaliator.explorerId : target.explorerId;
    const resolvedAt = serverIsoTime(clock);
    const makeEvent = eventFactory(clock, idFactory, context);
    const influenceId = idFactory("region_influence", `${retaliation.regionId}:${retaliationId}:${winnerAgentId}:retaliation`);
    const traceId = idFactory("trace", `${retaliation.regionId}:${retaliationId}:retaliation`);
    const nextEvents = planRetaliationResolutionEvents({
      makeEvent,
      retaliationId,
      regionId: retaliation.regionId,
      sourceRaidId: retaliation.sourceRaidId,
      sourceTraceId: retaliation.sourceTraceId,
      opportunityAgentId,
      opportunityExplorerId: retaliator.explorerId,
      targetAgentId: retaliation.targetAgentId,
      targetExplorerId: target.explorerId,
      staminaSpent,
      retaliatorPower,
      targetPower,
      outcome,
      winnerAgentId,
      winnerExplorerId,
      reward,
      resolvedAt,
      retaliatorStaminaBefore: staminaBalance,
      winnerRewardBalanceBefore: currentBalance(current, winnerAgentId, reward.resourceId),
      influenceId,
      previousInfluenceScore: currentRegionInfluenceScore(current, retaliation.regionId, winnerAgentId),
      traceId,
      parentTraceId: latestTraceIdForRegion(current, retaliation.regionId),
    });
    const nextProjection = applyEvents(current, nextEvents);
    return commit(nextEvents, projectRetaliationResolution({
      events: nextEvents,
      projection: nextProjection,
    }));
  }

  function proposeDiplomacy(input: ProposeDiplomacyInput, context: EpochCommandContext): EpochCommandResult<EpochDiplomacyRecord> {
    const current = projection();
    const regionId = assertNonEmptyString(input.regionId, "region_id");
    const sourceAgentId = assertNonEmptyString(input.sourceAgentId, "source_agent_id");
    const targetAgentId = assertNonEmptyString(input.targetAgentId, "target_agent_id");
    if (sourceAgentId === targetAgentId) throw new Error("diplomacy_self_target_not_allowed");
    const source = requireActiveIdentity(current, sourceAgentId);
    const target = requireActiveIdentity(current, targetAgentId);
    assertIdentityOwner(source, context, "diplomacy_source_owner_mismatch");
    const kind = assertRelationshipKind(input.kind);
    const focusSpent = assertPositiveInteger(input.focusSpent, "diplomacy_focus_spent");
    const focusBalance = currentBalance(current, sourceAgentId, "focus");
    if (focusBalance < focusSpent) throw new Error("resource_insufficient");
    const terms = input.terms?.trim() || `diplomacy_${kind}`;
    const seed = diplomacySeed({ regionId, sourceAgentId, targetAgentId, kind, terms });
    const diplomacyId = idFactory("diplomacy", seed);
    const existing = current.diplomacyRecords[diplomacyId];
    if (existing) return { events: [], value: existing, projection: current };
    const proposedAt = serverIsoTime(clock);
    const makeEvent = eventFactory(clock, idFactory, context);
    const nextEvents = planDiplomacyProposalEvents({
      makeEvent,
      diplomacyId,
      regionId,
      sourceAgentId,
      sourceExplorerId: source.explorerId,
      targetAgentId,
      targetExplorerId: target.explorerId,
      kind,
      focusSpent,
      focusBalanceBefore: focusBalance,
      terms,
      proposedAt,
    });
    const nextProjection = applyEvents(current, nextEvents);
    return commit(nextEvents, nextProjection.diplomacyRecords[diplomacyId]);
  }

  function respondDiplomacy(input: RespondDiplomacyInput, context: EpochCommandContext): EpochCommandResult<EpochDiplomacyRecord> {
    const current = projection();
    const diplomacyId = assertNonEmptyString(input.diplomacyId, "diplomacy_id");
    const responderAgentId = assertNonEmptyString(input.responderAgentId, "responder_agent_id");
    const diplomacy = current.diplomacyRecords[diplomacyId];
    if (!diplomacy) throw new Error("diplomacy_not_found");
    if (diplomacy.status !== "pending") throw new Error("diplomacy_not_pending");
    if (responderAgentId !== diplomacy.targetAgentId) throw new Error("diplomacy_responder_not_target");
    const responder = requireActiveIdentity(current, responderAgentId);
    assertIdentityOwner(responder, context, "diplomacy_responder_owner_mismatch");
    const response = assertDiplomacyResponse(input.response);
    const focusSpent = response === "accepted"
      ? assertPositiveInteger(input.focusSpent ?? 1, "diplomacy_focus_spent")
      : Math.max(0, assertFiniteInteger(input.focusSpent ?? 0, "diplomacy_focus_spent"));
    const focusBalance = currentBalance(current, responderAgentId, "focus");
    if (focusBalance < focusSpent) throw new Error("resource_insufficient");
    const respondedAt = serverIsoTime(clock);
    const makeEvent = eventFactory(clock, idFactory, context);
    const relationshipId = response === "accepted" ? idFactory("relationship", diplomacySeed(diplomacy)) : undefined;
    const nextEvents: EpochEvent[] = [...planDiplomacyResponseEvents({
      makeEvent,
      diplomacyId,
      regionId: diplomacy.regionId,
      sourceAgentId: diplomacy.sourceAgentId,
      sourceExplorerId: diplomacy.sourceExplorerId,
      targetAgentId: diplomacy.targetAgentId,
      targetExplorerId: diplomacy.targetExplorerId,
      responderAgentId,
      kind: diplomacy.kind,
      response,
      focusSpent,
      focusBalanceBefore: focusBalance,
      note: input.note?.trim() || `diplomacy_${response}`,
      relationshipId,
      respondedAt,
    })];
    const responded = nextEvents.find(
      (event): event is Extract<EpochEvent, { readonly eventType: "diplomacy_responded" }> =>
        event.eventType === "diplomacy_responded",
    );
    if (!responded) throw new Error("diplomacy_response_projection_failed");
    if (response === "accepted" && relationshipId) {
      const acceptedEvents = planDiplomacyAcceptedRelationshipTraceEvents({
        makeEvent,
        traceId: idFactory("trace", `${diplomacy.regionId}:${diplomacyId}:diplomacy`),
        diplomacyId,
        relationshipId,
        regionId: diplomacy.regionId,
        sourceAgentId: diplomacy.sourceAgentId,
        sourceExplorerId: diplomacy.sourceExplorerId,
        targetAgentId: diplomacy.targetAgentId,
        targetExplorerId: responder.explorerId,
        kind: diplomacy.kind,
        focusSpent,
        previousScore: current.relationshipEdges[relationshipId]?.score || 0,
        respondedEventId: responded.eventId,
        parentTraceId: latestTraceIdForRegion(current, diplomacy.regionId),
        respondedAt,
      });
      const relationshipUpdated = acceptedEvents.find(
        (event): event is Extract<EpochEvent, { readonly eventType: "relationship_updated" }> =>
          event.eventType === "relationship_updated",
      );
      if (!relationshipUpdated) throw new Error("diplomacy_acceptance_projection_failed");
      nextEvents.push(relationshipUpdated);
      const afterRelationship = applyEvents(current, nextEvents);
      const driftProposed = proposeRelationshipPersonalityDriftEvent(afterRelationship, relationshipUpdated.payload, relationshipUpdated, context);
      if (driftProposed) nextEvents.push(driftProposed);
      const traceCreated = acceptedEvents.find(
        (event): event is Extract<EpochEvent, { readonly eventType: "trace_created" }> =>
          event.eventType === "trace_created",
      );
      if (!traceCreated) throw new Error("diplomacy_acceptance_trace_projection_failed");
      nextEvents.push(traceCreated);
    }
    const nextProjection = applyEvents(current, nextEvents);
    return commit(nextEvents, nextProjection.diplomacyRecords[diplomacyId]);
  }

  function createOrganization(
    input: CreateOrganizationInput,
    context: EpochCommandContext,
  ): EpochCommandResult<EpochOrganization> {
    requireServerTrust(context, "organization_create_operator_required");
    const current = projection();
    const regionId = assertNonEmptyString(input.regionId, "region_id");
    const displayName = assertNonEmptyString(input.displayName, "organization_name");
    const organizationId = idFactory("organization", `${regionId}:${stableKey(displayName)}`);
    const existing = current.organizations[organizationId];
    if (existing) return { events: [], value: existing, projection: current };
    const recordedAt = serverIsoTime(clock);
    const nextEvents = planOrganizationCreatedEvents({
      makeEvent: eventFactory(clock, idFactory, context),
      organizationId,
      organizationName: displayName,
      regionId,
      reason: input.reason,
      sourceEventIds: input.sourceEventIds,
      recordedAt,
    });
    const nextProjection = applyEvents(current, nextEvents);
    return commit(nextEvents, nextProjection.organizations[organizationId]);
  }

  function updateOrganizationMembership(
    input: UpdateOrganizationMembershipInput,
    context: EpochCommandContext,
  ): EpochCommandResult<EpochOrganizationMembership> {
    const current = projection();
    const agentId = assertNonEmptyString(input.agentId, "agent_id");
    const identity = requireActiveIdentity(current, agentId);
    const organizationId = assertNonEmptyString(input.organizationId, "organization_id");
    const organization = current.organizations[organizationId];
    if (!organization) throw new Error("organization_not_found");
    const role = assertOrganizationMembershipRole(input.role);
    const status = assertOrganizationMembershipStatus(input.status);
    const membershipId = idFactory("organization_membership", `${organizationId}:${agentId}`);
    const existing = current.organizationMemberships[membershipId];
    const contextTrustClass = normalizeTrustClass(context.trustClass);
    const actorMembership = activeOrganizationMembershipForExplorer(current, organizationId, context.actorExplorerId);
    const actorCanManageRoles = contextTrustClass === "system_worker"
      || Boolean(actorMembership && isOrganizationGovernanceRole(actorMembership.role));
    if (!actorCanManageRoles) {
      assertIdentityOwner(identity, context, "organization_membership_owner_mismatch");
      const currentRole = existing?.role;
      if (status === "active" && isOrganizationGovernanceRole(role) && !isOrganizationGovernanceRole(currentRole || "")) {
        throw new Error("organization_membership_role_escalation_requires_authority");
      }
    }
    if (existing && existing.role === role && existing.status === status) {
      return { events: [], value: existing, projection: current };
    }
    const recordedAt = serverIsoTime(clock);
    const nextEvents = planOrganizationMembershipChangedEvents({
      makeEvent: eventFactory(clock, idFactory, context),
      membershipId,
      organizationId,
      organizationName: organization.displayName,
      memberType: "agent",
      agentId,
      explorerId: identity.explorerId,
      regionId: organization.regionId,
      role,
      status,
      sourceEventIds: [],
      recordedAt,
    });
    const nextProjection = applyEvents(current, nextEvents);
    return commit(nextEvents, nextProjection.organizationMemberships[membershipId]);
  }

  function contributeOrganizationTreasury(
    input: ContributeOrganizationTreasuryInput,
    context: EpochCommandContext,
  ): EpochCommandResult<OrganizationTreasuryChangedPayload> {
    const current = projection();
    const agentId = assertNonEmptyString(input.agentId, "agent_id");
    const identity = requireActiveIdentity(current, agentId);
    assertIdentityOwner(identity, context, "organization_contribution_owner_mismatch");
    const organizationId = assertNonEmptyString(input.organizationId, "organization_id");
    const organization = current.organizations[organizationId];
    if (!organization) throw new Error("organization_not_found");
    const resourceId = assertResourceId(input.resourceId);
    const amount = assertPositiveInteger(input.amount, "organization_contribution_amount");
    const activeMembership = activeAgentOrganizationMembership(current, organizationId, agentId);
    if (!activeMembership) throw new Error("organization_contribution_membership_required");
    const memberBalanceBefore = currentBalance(current, agentId, resourceId);
    if (memberBalanceBefore < amount) throw new Error("resource_insufficient");
    const treasuryBalanceBefore = currentOrganizationTreasuryBalance(current, organizationId, resourceId);
    const contributedAt = serverIsoTime(clock);
    const treasuryEventId = idFactory("organization_politics", `${organizationId}:contribution:${agentId}:${resourceId}:${contributedAt}`);
    const nextEvents = planOrganizationTreasuryContributionEvents({
      makeEvent: eventFactory(clock, idFactory, context),
      treasuryEventId,
      organizationId,
      organizationName: organization.displayName,
      regionId: organization.regionId,
      resourceId,
      amount,
      memberBalanceBefore,
      treasuryBalanceBefore,
      contributingAgentId: agentId,
      contributedAt,
    });
    const treasuryChanged = nextEvents.find((
      event,
    ): event is Extract<EpochEvent, { readonly eventType: "organization_treasury_changed" }> =>
      event.eventType === "organization_treasury_changed"
    );
    if (!treasuryChanged) throw new Error("organization_contribution_projection_failed");
    return commit(nextEvents, treasuryChanged.payload);
  }

  function proposeOrganizationBudget(
    input: ProposeOrganizationBudgetInput,
    context: EpochCommandContext,
  ): EpochCommandResult<EpochOrganizationBudget> {
    const current = projection();
    const agentId = assertNonEmptyString(input.agentId, "agent_id");
    const identity = requireActiveIdentity(current, agentId);
    assertIdentityOwner(identity, context, "organization_budget_owner_mismatch");
    const organizationId = assertNonEmptyString(input.organizationId, "organization_id");
    const organization = current.organizations[organizationId];
    if (!organization) throw new Error("organization_not_found");
    const activeMembership = activeAgentOrganizationMembership(current, organizationId, agentId);
    if (!activeMembership) throw new Error("organization_budget_membership_required");
    const title = assertNonEmptyString(input.title, "organization_budget_title");
    const description = typeof input.description === "string" && input.description.trim().length > 0
      ? input.description.trim()
      : undefined;
    const resourceId = assertResourceId(input.resourceId);
    const amount = assertPositiveInteger(input.amount, "organization_budget_amount");
    const proposedAt = serverIsoTime(clock);
    const budgetId = idFactory("organization_politics", `${organizationId}:budget:${agentId}:${resourceId}:${title}:${proposedAt}`);
    const nextEvents = planOrganizationBudgetProposedEvents({
      makeEvent: eventFactory(clock, idFactory, context),
      budgetId,
      organizationId,
      organizationName: organization.displayName,
      regionId: organization.regionId,
      proposedByAgentId: agentId,
      proposedByExplorerId: identity.explorerId,
      title,
      description,
      resourceId,
      amount,
      sourceEventIds: activeMembership.sourceEventIds,
      proposedAt,
    });
    const nextProjection = applyEvents(current, nextEvents);
    return commit(nextEvents, nextProjection.organizationBudgets[budgetId]);
  }

  function resolveOrganizationBudget(
    input: ResolveOrganizationBudgetInput,
    context: EpochCommandContext,
  ): EpochCommandResult<EpochOrganizationBudget> {
    const current = projection();
    const agentId = assertNonEmptyString(input.agentId, "agent_id");
    const identity = requireActiveIdentity(current, agentId);
    assertIdentityOwner(identity, context, "organization_budget_resolver_owner_mismatch");
    const budgetId = assertNonEmptyString(input.budgetId, "organization_budget_id");
    const budget = current.organizationBudgets[budgetId];
    if (!budget) throw new Error("organization_budget_not_found");
    if (budget.status !== "proposed") throw new Error("organization_budget_not_proposed");
    const activeMembership = activeAgentOrganizationMembership(current, budget.organizationId, agentId);
    if (!activeMembership) throw new Error("organization_budget_resolver_membership_required");
    if (identity.explorerId === budget.proposedByExplorerId) throw new Error("organization_budget_self_resolution_not_allowed");
    if (!isOrganizationGovernanceRole(activeMembership.role)) throw new Error("organization_budget_resolver_role_required");
    const resolution = assertOrganizationBudgetResolution(input.resolution);
    const note = typeof input.note === "string" && input.note.trim().length > 0 ? input.note.trim() : undefined;
    const resolvedAt = serverIsoTime(clock);
    const makeEvent = eventFactory(clock, idFactory, context);
    const votes = budget.votes || [];
    const existingVote = votes.find((vote) => vote.voterExplorerId === identity.explorerId);
    if (existingVote) throw new Error("organization_budget_vote_already_recorded");
    const requiresVoteRecord = organizationBudgetRequiresVoteRecord(budget);
    const resolutionStillPending = requiresVoteRecord && organizationBudgetDecisionStillPending(budget, resolution);
    let treasuryBalanceBefore: number | undefined;
    if (resolution === "approved" && !resolutionStillPending) {
      const balanceBefore = currentOrganizationTreasuryBalance(current, budget.organizationId, budget.resourceId);
      if (balanceBefore < budget.amount) throw new Error("organization_treasury_insufficient");
      treasuryBalanceBefore = balanceBefore;
    }

    const nextEvents = planOrganizationBudgetResolutionEvents({
      makeEvent,
      idFactory,
      budget,
      resolution,
      resolvedByAgentId: agentId,
      resolvedByExplorerId: identity.explorerId,
      resolverRole: activeMembership.role,
      note,
      treasuryBalanceBefore,
      resolvedAt,
    });
    const nextProjection = applyEvents(current, nextEvents);
    return commit(nextEvents, nextProjection.organizationBudgets[budgetId]);
  }

  function purchaseOrganizationUpgrade(
    input: PurchaseOrganizationUpgradeInput,
    context: EpochCommandContext,
  ): EpochCommandResult<EpochOrganizationUpgrade> {
    const current = projection();
    const agentId = assertNonEmptyString(input.agentId, "agent_id");
    const identity = requireActiveIdentity(current, agentId);
    assertIdentityOwner(identity, context, "organization_upgrade_owner_mismatch");
    const organizationId = assertNonEmptyString(input.organizationId, "organization_id");
    const organization = current.organizations[organizationId];
    if (!organization) throw new Error("organization_not_found");
    const catalogEntry = requireOrganizationUpgradeCatalogEntry(input.upgradeKey);
    const activeMembership = activeAgentOrganizationMembership(current, organizationId, agentId);
    if (!activeMembership) throw new Error("organization_upgrade_membership_required");
    const existingUpgrade = (current.organizationUpgradeIdsByOrganization[organizationId] || [])
      .map((upgradeId) => current.organizationUpgrades[upgradeId])
      .find((upgrade) => upgrade?.upgradeKey === catalogEntry.upgradeKey);
    if (existingUpgrade) throw new Error("organization_upgrade_already_purchased");
    const balanceBefore = currentOrganizationTreasuryBalance(current, organizationId, catalogEntry.costResourceId);
    if (balanceBefore < catalogEntry.costAmount) throw new Error("organization_treasury_insufficient");

    const purchasedAt = serverIsoTime(clock);
    const nextEvents = planOrganizationUpgradePurchaseEvents({
      makeEvent: eventFactory(clock, idFactory, context),
      idFactory,
      organizationId,
      organizationName: organization.displayName,
      regionId: organization.regionId,
      catalogEntry,
      treasuryBalanceBefore: balanceBefore,
      sourceEventIds: activeMembership.sourceEventIds,
      purchasedByAgentId: agentId,
      purchasedByExplorerId: identity.explorerId,
      purchasedAt,
    });
    const nextProjection = applyEvents(current, nextEvents);
    const purchased = nextEvents.find((
      event,
    ): event is Extract<EpochEvent, { readonly eventType: "organization_upgrade_purchased" }> =>
      event.eventType === "organization_upgrade_purchased"
    );
    if (!purchased) throw new Error("organization_upgrade_projection_failed");
    return commit(nextEvents, nextProjection.organizationUpgrades[purchased.payload.upgradeId]);
  }

  function updateRelationship(
    input: UpdateRelationshipInput,
    context: EpochCommandContext,
  ): EpochCommandResult<EpochRelationshipEdge> {
    const current = projection();
    const sourceAgentId = assertNonEmptyString(input.sourceAgentId, "source_agent_id");
    const targetAgentId = assertNonEmptyString(input.targetAgentId, "target_agent_id");
    if (sourceAgentId === targetAgentId) throw new Error("relationship_self_target_not_allowed");
    const source = requireActiveIdentity(current, sourceAgentId);
    const target = requireActiveIdentity(current, targetAgentId);
    assertIdentityOwner(source, context, "relationship_source_owner_mismatch");
    const kind = assertRelationshipKind(input.kind);
    const focusSpent = assertPositiveInteger(input.focusSpent, "relationship_focus_spent");
    const focusBalance = currentBalance(current, sourceAgentId, "focus");
    if (focusBalance < focusSpent) throw new Error("resource_insufficient");
    const relationshipId = idFactory("relationship", `${kind}:${sourceAgentId}:${targetAgentId}`);
    const previousScore = current.relationshipEdges[relationshipId]?.score || 0;
    const reason = input.reason?.trim() || `relationship_${kind}`;
    const updatedAt = serverIsoTime(clock);
    const makeEvent = eventFactory(clock, idFactory, context);
    const nextEvents: EpochEvent[] = [...planRelationshipUpdateEvents({
      makeEvent,
      relationshipId,
      sourceAgentId,
      sourceExplorerId: source.explorerId,
      targetAgentId,
      targetExplorerId: target.explorerId,
      kind,
      focusSpent,
      focusBalanceBefore: focusBalance,
      previousScore,
      reason,
      updatedAt,
    })];
    const relationshipUpdated = nextEvents.find(
      (event): event is Extract<EpochEvent, { readonly eventType: "relationship_updated" }> =>
        event.eventType === "relationship_updated",
    );
    if (!relationshipUpdated) throw new Error("relationship_update_projection_failed");
    const payload = relationshipUpdated.payload;
    const afterRelationship = applyEvents(current, nextEvents);
    const driftProposed = proposeRelationshipPersonalityDriftEvent(afterRelationship, payload, relationshipUpdated, context);
    if (driftProposed) nextEvents.push(driftProposed);
    const nextProjection = applyEvents(current, nextEvents);
    return commit(nextEvents, nextProjection.relationshipEdges[relationshipId]);
  }

  function updateAgentNpcBond(
    input: UpdateAgentNpcBondInput,
    context: EpochCommandContext,
  ): EpochCommandResult<EpochAgentNpcBond> {
    const current = projection();
    const agentId = assertNonEmptyString(input.agentId, "agent_id");
    const identity = requireActiveIdentity(current, agentId);
    const contextTrustClass = normalizeTrustClass(context.trustClass);
    if (identity.explorerId !== context.actorExplorerId && contextTrustClass !== "system_worker") {
      throw new Error("agent_npc_bond_owner_mismatch");
    }
    const npcId = assertNonEmptyString(input.npcId, "npc_id");
    const npc = current.npcs[npcId];
    if (!npc) throw new Error("npc_not_found");
    const kind = assertNpcRelationshipKind(input.kind);
    assertChildNpcBondAllowed(npc, kind);
    const focusSpent = assertPositiveInteger(input.focusSpent, "agent_npc_bond_focus_spent");
    const focusBalance = currentBalance(current, agentId, "focus");
    if (focusBalance < focusSpent) throw new Error("resource_insufficient");
    const bondId = idFactory("agent_npc_bond", `${agentId}:${npcId}:${kind}`);
    const previousScore = current.agentNpcBonds[bondId]?.score || 0;
    const reason = input.reason?.trim() || `agent_npc_bond_${kind}`;
    const updatedAt = serverIsoTime(clock);
    const makeEvent = eventFactory(clock, idFactory, context);
    const nextEvents = planAgentNpcBondUpdateEvents({
      makeEvent,
      bondId,
      agentId,
      explorerId: identity.explorerId,
      npcId,
      npcRegionId: npc.regionId,
      kind,
      focusSpent,
      focusBalanceBefore: focusBalance,
      previousScore,
      reason,
      updatedAt,
    });
    const nextProjection = applyEvents(current, nextEvents);
    return commit(nextEvents, nextProjection.agentNpcBonds[bondId]);
  }

  function deployTraceConflict(
    input: DeployTraceConflictInput,
    context: EpochCommandContext,
  ): EpochCommandResult<TraceConflictDeployment> {
    const current = projection();
    const agentId = assertNonEmptyString(input.agentId, "agent_id");
    const identity = requireActiveIdentity(current, agentId);
    assertIdentityOwner(identity, context, "trace_conflict_owner_mismatch");
    const fallbackSourceEvent = [...current.events].reverse().find((event) => (
      sourceEventsMentionAgent(current, [event.eventId], agentId)
    ));
    const sourceEventIds = normalizeSourceEventIds(
      input.sourceEventIds?.length ? input.sourceEventIds : fallbackSourceEvent ? [fallbackSourceEvent.eventId] : [],
      "trace_conflict_source_event_id",
    );
    assertKnownSourceEvents(current, sourceEventIds);
    if (sourceEventIds.some((sourceEventId) => !sourceEventsMentionAgent(current, [sourceEventId], agentId))) {
      throw new Error("trace_conflict_source_agent_mismatch");
    }
    const deployedAt = serverIsoTime(clock);
    const traceId = idFactory("trace", `${agentId}:${input.templateKey}:${deployedAt}`);
    const deploymentEventId = idFactory("event", `${traceId}:deployed`);
    const plan = planTraceConflictDeployment({
      projection: traceConflictRuleProjection(current),
      authorization: {
        authenticated: true,
        actorExplorerId: context.actorExplorerId,
        authorizedAgentId: agentId,
      },
      sourceAgentId: agentId,
      templateKey: input.templateKey,
      scope: {
        ...(input.regionId ? { regionId: input.regionId } : {}),
        ...(input.target ? { target: input.target } : {}),
      },
      traceId,
      deployedAt,
      sourceEventIds,
      serverIds: {
        deploymentEventId,
        resourceSpendEventIds: {
          focus: idFactory("event", `${traceId}:focus`),
          aether: idFactory("event", `${traceId}:aether`),
        },
        auditId: deploymentEventId,
      },
    });
    const makeEvent = eventFactory(clock, idFactory, context);
    const nextEvents = plan.events.map((planned): EpochEvent => {
      if (planned.kind === "resource_spent") {
        return resourceSpentEvent(makeEvent, agentId, {
          resourceId: planned.resourceId,
          amount: planned.amount,
          reason: planned.reason,
          balanceAfter: planned.balanceAfter,
          accountRef: `agent:${agentId}`,
          assetKey: `resource:${planned.resourceId}`,
          unit: "unit",
          quantityMinor: (BigInt(planned.amount) * 100n).toString(),
        }, {
          eventId: planned.eventId,
        });
      }
      return makeEvent("trace_conflict_deployed", traceId, {
        deployment: plan.deployment,
      }, {
        aggregateType: "trace",
        agentId,
        eventId: planned.eventId,
      });
    });
    return commit(nextEvents, plan.deployment);
  }

  function createTurnCard(input: CreateTurnCardInput, context: EpochCommandContext): EpochCommandResult<EpochTurnCard> {
    const trustClass = requireTurnTrust(context);
    const current = projection();
    const agentId = assertNonEmptyString(input.agentId, "agent_id");
    const identity = requireActiveIdentity(current, agentId);
    assertUserVerifiedIdentityOwner(identity, context, trustClass, "turn_card_owner_mismatch");
    const regionId = assertNonEmptyString(input.regionId, "region_id");
    const prompt = input.prompt?.trim() || "执行一次区域行动";
    const createdAt = serverIsoTime(clock);
    const createdAtMs = Date.parse(createdAt);
    const sequence = nextTurnCardSequence(current.turnCards, agentId);
    if (hasOpenTurnCardForAgent(current.turnCards, agentId, createdAtMs)) throw new Error("turn_card_already_open");
    const expiresAt = new Date(Date.parse(createdAt) + TURN_CARD_TTL_MS).toISOString();
    const turnCardId = idFactory("turn_card", `${regionId}:${agentId}:${prompt}:${createdAt}`);
    const nonce = idFactory("challenge", `${turnCardId}:${sequence}:${createdAt}`);
    const actionOptions = turnActionOptions(turnCardId, idFactory, includeHighRiskOptions(current, agentId));
    const visibleContext = {
      regionId,
      prompt,
      identityName: identity.identityName,
    };
    const envelopeId = idFactory("challenge", `${turnCardId}:${sequence}:${nonce}:${expiresAt}`);
    const turnEvents = planTurnCardCreationEvents({
      makeEvent: eventFactory(clock, idFactory, context),
      envelopeId,
      trustClass,
      turnCardId,
      agentId,
      explorerId: identity.explorerId,
      regionId,
      sequence,
      nonce,
      prompt,
      visibleContext,
      actionOptions,
      createdAt,
      expiresAt,
    });
    const createdEvent = turnEvents.find((event) => event.eventType === "turn_card_created");
    if (!createdEvent || createdEvent.eventType !== "turn_card_created") {
      throw new Error("turn_card_created_event_missing");
    }
    const traceState = projectTraceConflictState(current.events);
    const activeTraceIds = traceState.deployments
      .filter((deployment) => deployment.status === "active")
      .map((deployment) => deployment.traceId);
    const serverIdsByTraceId = Object.fromEntries(activeTraceIds.map((traceId) => {
      const outcomeEventId = idFactory("event", `${traceId}:${turnCardId}:outcome`);
      return [traceId, {
        outcomeEventId,
        auditId: outcomeEventId,
        effectEventId: idFactory("event", `${traceId}:${turnCardId}:effect`),
        memoryEventId: idFactory("event", `${traceId}:${turnCardId}:memory`),
      }];
    }));
    const tracePlan = planTraceConflictTurn({
      projection: traceConflictRuleProjection(current),
      deployments: traceState.deployments,
      turnCard: {
        turnCardId,
        agentId,
        explorerId: identity.explorerId,
        regionId,
        ...(input.target ? { target: input.target } : {}),
        sourceEventId: createdEvent.eventId,
        occurredAt: createdAt,
      },
      serverIdsByTraceId,
    });
    const traceMakeEvent = eventFactory(clock, idFactory, context);
    const traceEvents = tracePlan.events.map((planned): EpochEvent => {
      if (planned.kind === "trace_conflict_outcome") {
        const sourceAgentId = traceState.deployments.find((deployment) => (
          deployment.traceId === planned.traceId
        ))?.sourceAgentId;
        return traceMakeEvent("trace_conflict_outcome", planned.traceId, {
          traceId: planned.traceId,
          outcome: planned.outcome,
          triggeredByTurnCardId: planned.triggeredByTurnCardId,
          counteredByTraceId: planned.counteredByTraceId,
          sourceEventIds: planned.sourceEventIds,
          auditIds: planned.auditIds,
          resolvedAt: planned.resolvedAt,
        }, {
          aggregateType: "trace",
          agentId: sourceAgentId,
          eventId: planned.eventId,
        });
      }
      if (planned.kind === "trace_conflict_effect") {
        return traceMakeEvent("trace_conflict_effect_applied", planned.traceId, {
          traceId: planned.traceId,
          turnCardId,
          targetAgentId: planned.targetAgentId,
          effect: planned.effect,
          sourceEventIds: planned.sourceEventIds,
          auditIds: planned.auditIds,
          appliedAt: planned.plannedAt,
        }, {
          aggregateType: "trace",
          agentId: planned.targetAgentId,
          eventId: planned.eventId,
        });
      }
      return traceMakeEvent("trace_conflict_memory_recorded", planned.traceId, {
        memory: planned.memory,
      }, {
        aggregateType: "trace",
        agentId: planned.memory.targetAgentId,
        eventId: planned.eventId,
      });
    });
    const nextEvents = [...turnEvents, ...traceEvents];
    const nextProjection = applyEvents(current, nextEvents);
    return commit(nextEvents, nextProjection.turnCards[turnCardId]);
  }

  function resolveTurnCard(input: ResolveTurnCardInput, context: EpochCommandContext): EpochCommandResult<EpochTurnResolution> {
    const trustClass = requireTurnTrust(context);
    const current = projection();
    const turnCardId = assertNonEmptyString(input.turnCardId, "turn_card_id");
    const card = current.turnCards[turnCardId];
    if (!card) throw new Error("turn_card_not_found");
    if (card.status !== "open") throw new Error("turn_card_not_open");
    if (isTurnCardExpiredAt(card.expiresAt, clock().getTime())) throw new Error("turn_card_expired");
    const sequence = assertRequiredPositiveInteger(input.sequence, "turn_card_sequence_required");
    if (sequence !== card.sequence) throw new Error("turn_card_sequence_mismatch");
    const nonce = assertNonEmptyString(input.nonce, "turn_card_nonce_required");
    if (nonce !== card.nonce) throw new Error("turn_card_nonce_mismatch");
    const identity = requireActiveIdentity(current, card.agentId);
    assertUserVerifiedIdentityOwner(identity, context, trustClass, "turn_card_owner_mismatch");
    const actionOptionId = assertNonEmptyString(input.actionOptionId, "turn_action_option_id");
    const option = card.actionOptions.find((candidate) => candidate.actionOptionId === actionOptionId);
    if (!option) throw new Error("turn_action_option_not_found");
    const template = turnOptionTemplate(option.optionKey);
    const settlement = settlementPolicy(current, card.agentId, {
      risk: template.risk,
      reward: template.reward,
      lifetimeDelta: template.lifetimeDelta,
    });
    const resolvedAt = serverIsoTime(clock);
    const responseEnvelopeId = idFactory("challenge", `${turnCardId}:${card.sequence}:${actionOptionId}:${resolvedAt}:resolution`);
    const nextEvents = planTurnCardResolutionEvents({
      makeEvent: eventFactory(clock, idFactory, context),
      responseEnvelopeId,
      trustClass,
      turnCardId,
      agentId: card.agentId,
      originalEnvelopeId: card.signedEnvelope.envelopeId,
      sequence: card.sequence,
      nonce: card.nonce,
      actionOptionId,
      optionLabel: option.label,
      risk: template.risk,
      explanation: option.explanation,
      visibleText: input.visibleText,
      outcomeSummary: settledOutcomeSummary(
        template.outcomeSummary,
        template.reward,
        settlement.reward,
        settlement.lifetimeDelta,
      ),
      reward: settlement.reward,
      lifetimeDelta: settlement.lifetimeDelta,
      nonEvidence: settlement.nonEvidence,
      resolvedAt,
      balanceBefore: (targetAgentId, resourceId) => currentBalance(current, targetAgentId, resourceId),
      lifetimeEventsForDelta: ({ delta, reason, finalTitle }) =>
        lifetimeAdjustmentEvents(current, card.agentId, delta, reason, finalTitle, context),
    });
    const nextProjection = applyEvents(current, nextEvents);
    const turnResolution = nextProjection.turnCards[turnCardId].resolution;
    if (!turnResolution) throw new Error("turn_resolution_projection_failed");
    return commit(nextEvents, turnResolution);
  }

  function startHostedSession(input: StartHostedSessionInput, context: EpochCommandContext): EpochCommandResult<EpochHostedSession> {
    const authorityTrustClass = requireHostedTrust(context);
    const current = projection();
    const agentId = assertNonEmptyString(input.agentId, "agent_id");
    const identity = requireActiveIdentity(current, agentId);
    assertUserVerifiedIdentityOwner(identity, context, authorityTrustClass, "hosted_session_owner_mismatch");
    const regionId = assertNonEmptyString(input.regionId, "region_id");
    const mandate = input.mandate?.trim() || "服务器托管行动";
    const channelClass = input.channelClass === "browser_copy_paste" ? "browser_copy_paste" : "server_hosted";
    const deliveryTrust = deriveHostedDeliveryTrust(channelClass, authorityTrustClass);
    const eventTrustClass = deriveHostedEventTrust(channelClass, authorityTrustClass);
    const startedAt = serverIsoTime(clock);
    const sessionId = idFactory("session", `${channelClass}:${regionId}:${agentId}:${mandate}:${startedAt}`);
    const consumedSocialHookIds = consumedSocialHookIdsForAgentRegion(current, agentId, regionId);
    const regionSocialHooks = (current.socialHookIdsByRegion[regionId] || [])
      .map((hookId) => current.socialHooks[hookId])
      .filter(Boolean)
      .filter((hook) => !consumedSocialHookIds.has(hook.hookId))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt) || left.hookId.localeCompare(right.hookId));
    const sceneContract = input.journeyScene ? buildJourneySceneContract({
      ...input.journeyScene,
      agentId,
      expiresAt: new Date(Date.parse(startedAt) + 15 * 60 * 1_000).toISOString(),
    }) : undefined;
    const actionOptions = sceneContract
      ? journeySceneHostedActionOptions(sceneContract)
      : hostedActionOptions({
          sessionId,
          idFactory,
          socialHooks: regionSocialHooks,
          includeHighRisk: includeHighRiskOptions(current, agentId),
          current,
          agentId,
        });
    const nextEvents = planHostedSessionStartEvents({
      makeEvent: eventFactory(clock, idFactory, { ...context, trustClass: eventTrustClass }),
      sessionId,
      agentId,
      explorerId: identity.explorerId,
      regionId,
      mandate,
      channelClass,
      deliveryTrust,
      actionOptions,
      sceneContract,
      startedAt,
    });
    const nextProjection = applyEvents(current, nextEvents);
    return commit(nextEvents, nextProjection.hostedSessions[sessionId]);
  }

  function submitHostedAction(input: SubmitHostedActionInput, context: EpochCommandContext): EpochCommandResult<EpochHostedActionRecord> {
    const authorityTrustClass = requireHostedTrust(context);
    const current = projection();
    const sessionId = assertNonEmptyString(input.sessionId, "hosted_session_id");
    const session = current.hostedSessions[sessionId];
    if (!session) throw new Error("hosted_session_not_found");
    if (session.status !== "active") throw new Error("hosted_session_not_active");
    const identity = requireActiveIdentity(current, session.agentId);
    assertUserVerifiedIdentityOwner(identity, context, authorityTrustClass, "hosted_session_owner_mismatch");
    const eventTrustClass = deriveHostedEventTrust(session.channelClass, authorityTrustClass);
    const deliveryTrust = deriveHostedDeliveryTrust(session.channelClass, authorityTrustClass);
    const actionOptionId = assertNonEmptyString(input.actionOptionId, "hosted_action_option_id");
    const option = session.actionOptions.find((candidate) => candidate.actionOptionId === actionOptionId);
    if (!option) throw new Error("hosted_action_option_not_found");
    const signedJourneyAction = session.sceneContract?.actionOptions.find((candidate) =>
      candidate.actionOptionId === actionOptionId);
    if (session.sceneContract) {
      const validation = input.journeyValidation;
      if (!validation) throw new Error("journey_scene_commit_required");
      if (validation.journeyId !== session.sceneContract.journeyId
        || validation.episodeId !== session.sceneContract.episodeId
        || validation.expectedVersion !== session.sceneContract.expectedVersion) {
        throw new Error("journey_scene_commit_binding_invalid");
      }
      if (clock().getTime() > Date.parse(session.sceneContract.expiresAt)) {
        throw new Error("journey_scene_contract_expired");
      }
      if (!signedJourneyAction || !verifyJourneySceneActionSignature({
        agentId: session.agentId,
        contract: session.sceneContract,
        action: signedJourneyAction,
      })) {
        throw new Error("journey_scene_action_signature_invalid");
      }
    }
    const settlement = settlementPolicy(current, session.agentId, {
      risk: option.risk,
      reward: option.reward,
      lifetimeDelta: option.lifetimeDelta,
    });
    const journeyPreparationScore = session.sceneContract
      ? Math.min(16, Object.values(current.hostedSessions).reduce((score, priorSession) => {
          const priorContract = priorSession.sceneContract;
          if (!priorContract || priorContract.journeyId !== session.sceneContract?.journeyId) return score;
          const objectiveKind = priorContract.taskObjective?.kind;
          if (objectiveKind !== "main" && objectiveKind !== "side") return score;
          const completed = priorSession.actions.some((action) =>
            action.journeyResolution?.completionKind === "complete");
          if (!completed) return score;
          return score + (objectiveKind === "side" ? 8 : 6);
        }, 0))
      : 0;
    const journeyResolution = session.sceneContract && signedJourneyAction?.taskObjectiveId
      ? resolveJourneyAction({
          agentId: session.agentId,
          journeyId: session.sceneContract.journeyId,
          episodeId: session.sceneContract.episodeId,
          actionOptionId: signedJourneyAction.actionOptionId,
          actionLabel: signedJourneyAction.label,
          objectiveTitle: session.sceneContract.taskObjective?.title ?? "该目标",
          locationLabel: session.sceneContract.location.label,
          successOutcomeSummary: option.outcomeSummary,
          risk: signedJourneyAction.risk,
          objectiveKind: session.sceneContract.taskObjective?.kind,
          journeyPreparationScore,
          ...(signedJourneyAction.completionKind === "skip" ? { signedCompletionKind: "skip" as const } : {}),
          identity: {
            lifetime: identity.lifetime,
            traits: identity.personality.traits,
            ...(identity.needs ? { needs: identity.needs } : {}),
            ...(identity.lifeGoal ? { lifeGoal: identity.lifeGoal } : {}),
          },
          resources: current.resourceBalances[session.agentId] ?? {},
          attributes: current.attributeScores[session.agentId] ?? {},
          inventoryItems: (current.inventoryItemIdsByAgent[session.agentId] ?? [])
            .map((itemId) => current.inventoryItems[itemId])
            .filter((item): item is EpochInventoryItem => Boolean(item)),
          participantTargetCount: signedJourneyAction.targetEntityIds.filter((targetId) =>
            session.sceneContract?.participants.some((participant) => participant.id === targetId)).length,
        })
      : undefined;
    const completedJourneyObjective = journeyResolution?.completionKind === "complete"
      ? session.sceneContract?.taskObjective
      : undefined;
    const journeySideBonus = completedJourneyObjective?.kind === "side" ? 1 : 0;
    const journeyRiskPremium = journeyResolution?.riskPremium?.amount ?? 0;
    const journeyObjectiveReward = completedJourneyObjective && (journeySideBonus > 0 || journeyRiskPremium > 0)
      ? {
          resourceId: "coin" as const,
          amount: journeySideBonus + journeyRiskPremium,
          reason: journeyRiskPremium > 0
            ? `journey_risk_reward:${session.sceneContract?.journeyId}:${completedJourneyObjective.objectiveId}:${signedJourneyAction?.risk}`
            : `journey_side_objective:${session.sceneContract?.journeyId}:${completedJourneyObjective.objectiveId}`,
        }
      : undefined;
    const actionReward = journeyObjectiveReward ?? settlement.reward;
    const recordedAt = serverIsoTime(clock);
    const actionId = idFactory("action", `record:${sessionId}:${actionOptionId}`);
    const responseEnvelopeId = idFactory("challenge", `${actionId}:${recordedAt}:hosted-action`);
    const makeEvent = eventFactory(clock, idFactory, { ...context, trustClass: eventTrustClass });
    const attestation = input.attestation;
    const nextEvents = planHostedActionSubmissionEvents({
      makeEvent,
      envelopeId: responseEnvelopeId,
      actionId,
      sessionId,
      agentId: session.agentId,
      channelClass: session.channelClass,
      deliveryTrust,
      actionOptionId,
      optionLabel: option.label,
      risk: option.risk,
      socialHookId: option.socialHookId,
      attestation: attestation ? {
        attestationId: assertNonEmptyString(attestation.attestationId, "attestation_id"),
        runnerId: attestation.runnerId,
        runnerKeyId: attestation.runnerKeyId,
        challengeId: attestation.challengeId,
        sessionId,
        agentId: session.agentId,
        actionOptionId,
        transcriptHash: attestation.transcriptHash,
        signature: attestation.signature,
        signatureBase: attestation.signatureBase,
        signatureBaseHash: attestation.signatureBaseHash,
        verifiedAt: recordedAt,
      } : undefined,
      explanation: option.explanation,
      visibleText: input.visibleText,
      outcomeSummary: journeyResolution?.summary ?? settledOutcomeSummary(
        option.outcomeSummary,
        option.reward,
        actionReward,
        settlement.lifetimeDelta,
      ),
      ...(journeyResolution ? { journeyResolution } : {}),
      reward: actionReward,
      lifetimeDelta: settlement.lifetimeDelta,
      nonEvidence: settlement.nonEvidence,
      recordedAt,
      sideEffectEvents: (actionRecorded) => {
        const sideEffects: EpochEvent[] = [];
        const resourceCost = journeyResolution?.resourceCost;
        if (resourceCost?.paid) {
          const balance = currentBalance(current, session.agentId, resourceCost.resourceId);
          if (balance < resourceCost.amount) throw new Error("journey_action_cost_state_invalid");
          sideEffects.push(resourceSpentEvent(makeEvent, session.agentId, {
            resourceId: resourceCost.resourceId,
            amount: resourceCost.amount,
            reason: `journey_action_cost:${session.sceneContract?.journeyId}:${session.sceneContract?.taskObjective?.objectiveId}`,
            balanceAfter: balance - resourceCost.amount,
            accountRef: `agent:${session.agentId}`,
            assetKey: `resource:${resourceCost.resourceId}`,
            unit: "unit",
            quantityMinor: (BigInt(resourceCost.amount) * 100n).toString(),
          }));
        }
        if (journeyResolution && signedJourneyAction?.taskObjectiveId
          && session.sceneContract?.taskObjective) {
          if (session.sceneContract.worldMode === "mirror") {
            // PR2: mirror-mode collateral does NOT enter the canonical epoch
            // event stream at action time. When the integrator supplies a
            // journeyMirrorLedgerSink, compute blueprints here (single physical
            // planner call per actionEventId) and forward them through the
            // sink so the integrator can append them to the journey runtime
            // projection's mirrorLedgers. When no sink is configured, the
            // blueprints are silently dropped — preserving the legacy
            // "mirror skips canonical collateral" behaviour.
            if (journeyMirrorLedgerSink) {
              const physicalBlueprints = planJourneyMirrorConsequenceBlueprints({
                regionId: session.regionId,
                agentId: session.agentId,
                explorerId: session.explorerId,
                identityName: identity.identityName,
                journeyId: session.sceneContract.journeyId,
                episodeId: session.sceneContract.episodeId,
                objectiveId: signedJourneyAction.taskObjectiveId,
                objectiveKind: session.sceneContract.taskObjective.kind,
                objectiveTitle: session.sceneContract.taskObjective.title,
                actionLabel: signedJourneyAction.label,
                actionRisk: signedJourneyAction.risk,
                allowedEffectKinds: signedJourneyAction.allowedEffectKinds,
                resolution: journeyResolution,
                previousInfluenceScore: currentRegionInfluenceScore(current, session.regionId, session.agentId),
                previousFactionStandingScore: currentAgentFactionStandingScore(
                  current,
                  session.agentId,
                  signedJourneyAction.routeSelection?.factionObjectId,
                ),
                routeSelection: signedJourneyAction.routeSelection,
                actionEventId: actionRecorded.eventId,
                sourceAggregateId: session.sessionId,
                recordedAt,
              });
              // PR5b: roleplay-doubt hook. Server-side rule logic compares the
              // signed action's approachTags against the identity's frozen
              // ExpectedLifePattern and emits 0 or 1 identity_doubt mirror
              // ledger entries. LLM-free; the hook is read-only with respect
              // to canonical world state. The hook fail-opens (emits nothing)
              // when the identity has no pattern (legacy identity issued
              // before PR5b) or when the action carried no approachTags
              // (legacy action). The entries join the same ledger sink as
              // the physical-impact blueprints so solidify-time promotion
              // handles them uniformly.
              const approachTags = signedJourneyAction.approachTags;
              // PR5b fix: derive the mission-sanctioned approach palette as
              // the union of approachTags across every actionOption the
              // current scene contract offers. By construction, a server-
              // offered action's tags are a subset of this union. The
              // roleplay-doubt planner uses this set to apply a mission-
              // aligned override (spec §6.9): if the agent only used
              // approaches the mission offered, the action is aligned and
              // no doubt fires — a combat-role identity on a support mission
              // is not deviating when the mission demands support/logistics.
              const missionSanctionedApproaches = approachTags && approachTags.length > 0
                ? collectSceneMissionSanctionedApproaches(session.sceneContract.actionOptions)
                : [];
              const doubtEntries = identity.expectedLifePattern && approachTags && approachTags.length > 0
                ? planJourneyRoleplayDoubt({
                    pattern: identity.expectedLifePattern,
                    observed: approachTags,
                    agentId: session.agentId,
                    journeyId: session.sceneContract.journeyId,
                    episodeId: session.sceneContract.episodeId,
                    regionId: session.regionId,
                    ...(signedJourneyAction.routeSelection?.factionObjectId
                      ? { factionId: signedJourneyAction.routeSelection.factionObjectId }
                      : {}),
                    actionEventId: actionRecorded.eventId,
                    recordedAt,
                    ...(missionSanctionedApproaches.length > 0
                      ? { missionSanctionedApproaches }
                      : {}),
                  })
                : [];
              const blueprints: MirrorConsequenceLedgerEntry[] = [
                ...physicalBlueprints,
                ...doubtEntries,
              ];
              if (blueprints.length > 0) {
                // expectedVersion: -1 is the documented "no CAS check"
                // sentinel. The integrator owns journey.version and MUST
                // fetch it from its own projection; see
                // EpochGameCoreOptions.journeyMirrorLedgerSink JSDoc.
                journeyMirrorLedgerSink({
                  journeyId: session.sceneContract.journeyId,
                  agentId: session.agentId,
                  expectedVersion: -1,
                  actionEventId: actionRecorded.eventId,
                  entries: blueprints,
                });
              }
            }
          } else {
            sideEffects.push(...planJourneyWorldImpactEvents({
              makeEvent,
              idFactory,
              regionId: session.regionId,
              agentId: session.agentId,
              explorerId: session.explorerId,
              identityName: identity.identityName,
              journeyId: session.sceneContract.journeyId,
              episodeId: session.sceneContract.episodeId,
              objectiveId: signedJourneyAction.taskObjectiveId,
              objectiveKind: session.sceneContract.taskObjective.kind,
              objectiveTitle: session.sceneContract.taskObjective.title,
              actionLabel: signedJourneyAction.label,
              actionRisk: signedJourneyAction.risk,
              allowedEffectKinds: signedJourneyAction.allowedEffectKinds,
              resolution: journeyResolution,
              previousInfluenceScore: currentRegionInfluenceScore(current, session.regionId, session.agentId),
              previousFactionStandingScore: currentAgentFactionStandingScore(
                current,
                session.agentId,
                signedJourneyAction.routeSelection?.factionObjectId,
              ),
              routeSelection: signedJourneyAction.routeSelection,
              sourceEventId: actionRecorded.eventId,
              sourceAggregateId: session.sessionId,
              recordedAt,
              worldMinute: currentProjectionWorldMinute(current),
            }));
          }
        }
        if (!option.socialHookId || session.sceneContract?.worldMode === "mirror") return sideEffects;
        const hook = current.socialHooks[option.socialHookId];
        if (!hook) throw new Error("social_hook_not_found");
        if (!hook.npcId) return sideEffects;
        const npc = current.npcs[hook.npcId];
        if (!npc) throw new Error("npc_not_found");
        const bondId = idFactory("agent_npc_bond", `${session.agentId}:${hook.npcId}:friend`);
        const previousScore = current.agentNpcBonds[bondId]?.score || 0;
        const memoryId = idFactory("npc_memory", `${hook.npcId}:${actionId}:social_hook`);
        const influenceId = idFactory("region_influence", `${hook.regionId}:${session.agentId}:${actionId}:social_hook`);
        sideEffects.push(...planHostedSocialHookSideEffectEvents({
          makeEvent,
          bondId,
          memoryId,
          influenceId,
          regionId: hook.regionId,
          agentId: session.agentId,
          explorerId: session.explorerId,
          npcId: hook.npcId,
          npcRegionId: npc.regionId,
          npcDisplayName: npc.displayName,
          identityName: identity.identityName,
          hookId: hook.hookId,
          hookTitle: hook.title,
          risk: option.risk,
          previousBondScore: previousScore,
          previousInfluenceScore: currentRegionInfluenceScore(current, hook.regionId, session.agentId),
          sourceEventId: actionRecorded.eventId,
          sourceAggregateId: session.sessionId,
          recordedAt,
        }));
        return sideEffects;
      },
      balanceBefore: (targetAgentId, resourceId) => currentBalance(current, targetAgentId, resourceId),
      lifetimeEventsForDelta: ({ delta, reason, finalTitle }) =>
        lifetimeAdjustmentEvents(current, session.agentId, delta, reason, finalTitle, { ...context, trustClass: eventTrustClass }),
    });
    const nextProjection = applyEvents(current, nextEvents);
    const recorded = nextProjection.hostedSessions[sessionId].actions.find((action) => action.actionId === actionId);
    if (!recorded) throw new Error("hosted_action_projection_failed");
    return commit(nextEvents, recorded);
  }

  function solidifyJourneyWorld(
    input: SolidifyJourneyWorldInput,
    context: EpochCommandContext,
  ): EpochCommandResult<JourneyWorldCommit> {
    const trustClass = requireServerTrust(context, "journey_world_solidification_requires_server_trust");
    const current = projection();
    const journeyId = assertNonEmptyString(input.journeyId, "journey_id");
    const agentId = assertNonEmptyString(input.agentId, "agent_id");
    const regionId = assertNonEmptyString(input.regionId, "region_id");
    const identity = requireIdentity(current, agentId);
    const existingMarker = current.events.find((event): event is Extract<EpochEvent, {
      readonly eventType: "journey_world_solidified";
    }> => event.eventType === "journey_world_solidified"
      && event.payload.journeyId === journeyId
      && event.payload.agentId === agentId);
    if (existingMarker) {
      // PR4: a duplicate solidify MUST carry the same settlementId as the
      // existing marker. A mismatch signals a re-derivation under a different
      // policy or input snapshot and is rejected so the persisted marker
      // remains the single source of truth.
      const existingSettlementId = (existingMarker.payload as { readonly settlementId?: string }).settlementId;
      if (input.settlementId !== undefined
        && existingSettlementId !== undefined
        && input.settlementId !== existingSettlementId) {
        throw new Error("journey_settlement_id_mismatch");
      }
      return { events: [], value: journeyWorldCommitFromMarker(existingMarker), projection: current };
    }

    const completedObjectiveIds = uniqueValues(input.completedObjectiveIds
      .map((objectiveId) => assertNonEmptyString(objectiveId, "journey_completed_objective_id")));
    const requiredMainObjectiveIds = uniqueValues(input.requiredMainObjectiveIds
      .map((objectiveId) => assertNonEmptyString(objectiveId, "journey_required_main_objective_id")));
    if (!requiredMainObjectiveIds.length
      || requiredMainObjectiveIds.some((objectiveId) => !completedObjectiveIds.includes(objectiveId))) {
      throw new Error("journey_main_line_incomplete");
    }
    const mirrorStartedAtWorldTime = assertNonEmptyString(
      input.mirrorStartedAtWorldTime,
      "journey_mirror_started_at_world_time",
    );
    const mirrorEndedAtWorldTime = assertNonEmptyString(
      input.mirrorEndedAtWorldTime,
      "journey_mirror_ended_at_world_time",
    );
    const committedAtWorldTime = assertNonEmptyString(
      input.committedAtWorldTime,
      "journey_committed_at_world_time",
    );
    if (!Number.isFinite(Date.parse(mirrorStartedAtWorldTime))
      || !Number.isFinite(Date.parse(mirrorEndedAtWorldTime))
      || !Number.isFinite(Date.parse(committedAtWorldTime))
      || Date.parse(mirrorEndedAtWorldTime) <= Date.parse(mirrorStartedAtWorldTime)
      || Date.parse(committedAtWorldTime) < Date.parse(mirrorEndedAtWorldTime)) {
      throw new Error("journey_mirror_time_window_invalid");
    }
    if (!Number.isSafeInteger(input.completionScoreBps)
      || input.completionScoreBps < 0
      || input.completionScoreBps > 10_000) {
      throw new Error("journey_completion_score_invalid");
    }
    if (input.worldSliceHash !== undefined && !/^sha256:[0-9a-f]{64}$/u.test(input.worldSliceHash)) {
      throw new Error("journey_world_slice_hash_invalid");
    }
    // PR4 authority guards. When settlementPolicyVersion is present, the
    // caller is on the PR4 contract; the score MUST clear the canon
    // threshold (kills the legacy "canonEligible = mainLineSucceeded"
    // dead-code branch where main-completed but low-score runs could still
    // solidify). The threshold itself MUST match the versioned placeholder
    // so a forged value cannot bypass the guard.
    if (input.settlementPolicyVersion !== undefined) {
      if (input.settlementPolicyVersion !== SETTLEMENT_POLICY_VERSION) {
        throw new Error(
          `journey_settlement_policy_version_mismatch:${input.settlementPolicyVersion}:${SETTLEMENT_POLICY_VERSION}`,
        );
      }
      if (input.canonThresholdBps !== CANON_THRESHOLD_BPS) {
        throw new Error(
          `journey_canon_threshold_version_mismatch:${input.canonThresholdBps}:${CANON_THRESHOLD_BPS}`,
        );
      }
      if (input.completionScoreBps < input.canonThresholdBps) {
        throw new Error(
          `journey_below_canon_threshold:${input.completionScoreBps}:${input.canonThresholdBps}`,
        );
      }
      if (input.consequenceScorePolicyVersion !== CONSEQUENCE_SCORE_POLICY_VERSION) {
        throw new Error(
          `journey_consequence_score_policy_version_mismatch:${input.consequenceScorePolicyVersion}:${CONSEQUENCE_SCORE_POLICY_VERSION}`,
        );
      }
      if (typeof input.settlementId !== "string" || !input.settlementId.trim()) {
        throw new Error("journey_settlement_id_required");
      }
      if (!input.consequenceScoreBreakdown) {
        throw new Error("journey_consequence_score_breakdown_required");
      }
      const breakdown = input.consequenceScoreBreakdown;
      const components = [
        breakdown.resultScoreBps,
        breakdown.selfLossScoreBps,
        breakdown.collateralScoreBps,
      ];
      if (components.some((value) => !Number.isSafeInteger(value) || value < -10_000 || value > 10_000)) {
        throw new Error("journey_consequence_score_breakdown_invalid");
      }
    }

    const journeySessions = Object.values(current.hostedSessions).filter((session) =>
      session.agentId === agentId
      && session.regionId === regionId
      && session.sceneContract?.journeyId === journeyId
      && session.sceneContract.worldMode === "mirror");
    const returnSession = journeySessions.find((session) =>
      session.sceneContract?.phase === "return" && session.actions.length > 0);
    const returnAction = returnSession?.actions.at(-1);
    const returnSourceEvent = returnAction
      ? current.events.find((event): event is Extract<EpochEvent, { readonly eventType: "hosted_action_recorded" }> =>
          event.eventType === "hosted_action_recorded" && event.payload.actionId === returnAction.actionId)
      : undefined;
    if (!returnSession || !returnAction || !returnSourceEvent) {
      throw new Error("journey_safe_return_evidence_required");
    }

    const evidenceByObjectiveId = new Map<string, {
      readonly session: EpochHostedSession;
      readonly action: EpochHostedActionRecord;
      readonly actionEvent: Extract<EpochEvent, { readonly eventType: "hosted_action_recorded" }>;
      readonly signedAction: JourneySceneContract["actionOptions"][number];
    }>();
    for (const session of journeySessions) {
      const contract = session.sceneContract;
      const objectiveId = contract?.taskObjective?.objectiveId;
      if (!contract || !objectiveId || !completedObjectiveIds.includes(objectiveId)) continue;
      const action = session.actions.find((candidate) =>
        candidate.journeyResolution?.authority === "server"
        && candidate.journeyResolution.completionKind === "complete");
      if (!action) continue;
      const signedAction = contract.actionOptions.find((candidate) =>
        candidate.actionOptionId === action.actionOptionId
        && candidate.taskObjectiveId === objectiveId);
      const actionEvent = current.events.find((event): event is Extract<EpochEvent, {
        readonly eventType: "hosted_action_recorded";
      }> => event.eventType === "hosted_action_recorded"
        && event.payload.actionId === action.actionId
        && event.correlationId === context.correlationId);
      if (!signedAction || !actionEvent || actionEvent.payload.journeyResolution?.completionKind !== "complete") continue;
      evidenceByObjectiveId.set(objectiveId, { session, action, actionEvent, signedAction });
    }
    if (completedObjectiveIds.includes("legacy_main") && !evidenceByObjectiveId.has("legacy_main")) {
      const session = journeySessions.find((candidate) =>
        candidate.sceneContract?.phase === "main"
        && !candidate.sceneContract.taskObjective
        && candidate.actions.length > 0);
      const action = session?.actions.at(-1);
      const signedAction = action && session?.sceneContract?.actionOptions.find((candidate) =>
        candidate.actionOptionId === action.actionOptionId);
      const actionEvent = action
        ? current.events.find((event): event is Extract<EpochEvent, {
            readonly eventType: "hosted_action_recorded";
          }> => event.eventType === "hosted_action_recorded"
            && event.payload.actionId === action.actionId
            && event.correlationId === context.correlationId)
        : undefined;
      if (session && action && signedAction && actionEvent) {
        evidenceByObjectiveId.set("legacy_main", { session, action, actionEvent, signedAction });
      }
    }
    if (completedObjectiveIds.some((objectiveId) => !evidenceByObjectiveId.has(objectiveId))) {
      throw new Error("journey_completed_objective_evidence_missing");
    }
    if (requiredMainObjectiveIds.some((objectiveId) => !evidenceByObjectiveId.has(objectiveId))) {
      throw new Error("journey_main_line_evidence_missing");
    }

    const solidifiedAt = serverIsoTime(clock);
    const makeEvent = eventFactory(clock, idFactory, { ...context, trustClass });
    const effectEvents: EpochEvent[] = [];
    let workingProjection = current;
    const orderedEvidence = completedObjectiveIds.map((objectiveId) =>
      evidenceByObjectiveId.get(objectiveId) as NonNullable<ReturnType<typeof evidenceByObjectiveId.get>>);

    // PR2: prefer the mirror-consequence ledger path when the caller supplied
    // entries to promote. Rebuild canonical events shape-equivalent to the
    // legacy derivation so downstream region/trace/faction consumers remain
    // agnostic to the source. Fall back to the legacy derivation when the
    // ledger is absent so older journeys and replayed fixtures do not break.
    //
    // Promotion persistence contract: the local ledger rebuilt here is for
    // invariant checking ({@link assertNoDuplicatePromotion}) only. This
    // function does NOT update the caller's persistent ledger projection
    // with promotion records. The caller (agent-companion runtime) owns the
    // lifecycle: it MUST have already appended the entries before calling
    // solidify, and MUST record promotion state for each canonical event id
    // produced below. The journey_world_solidified marker short-circuits
    // replays, so a process crash between canonical events being committed
    // and promotion records being persisted will leave the entries orphaned
    // on restart (canonical events exist, ledger still shows them pending).
    //
    // Crash recovery: the journey_world_solidified marker carries
    // `mirrorLedgerPromotedEntryIds` (the entryIds this solidify promoted)
    // and `effectEventIds` (the canonical event ids in promotion order —
    // one canonical event per promoted entry, followed by any NPC
    // canonicalization events). The integrator MUST read those two fields
    // on restart and reconcile its persistent ledger: pair the entryIds
    // positionally with the leading `mirrorLedgerPromotedEntryIds.length`
    // effectEventIds, then mark each entry promoted via
    // {@link markMirrorConsequencePromoted}. mcpTools.ts implements this
    // reconciliation for the agent-companion runtime; this function does
    // not perform integrator-level reconciliation itself.
    const mirrorLedgerEntries = input.mirrorLedgerEntries ?? [];
    let mirrorLedger: MirrorConsequenceLedgerState | undefined;
    if (mirrorLedgerEntries.length > 0) {
      // Fast-fail before any canonical events are constructed: PR2 only
      // supports region_influence_delta, trace_created, and
      // faction_standing_delta in the solidify mirror path. Other kinds
      // (npc_relationship_delta, object_mutation, object_destroy,
      // hidden_prerequisite_destroyed, identity_doubt) and self-loss kinds
      // (resource_spent, lifetime_adjusted) would otherwise throw
      // mid-loop inside buildCanonicalEventFromMirrorEntry after some
      // canonical events are already in effectEvents. The whitelist keeps
      // the error surface consistent: every unsupported kind fails up
      // front with effectEvents empty.
      for (const entry of mirrorLedgerEntries) {
        if (!SUPPORTED_MIRROR_EFFECT_KINDS.has(entry.effectKind)) {
          throw new Error(
            `journey_mirror_ledger_kind_not_supported:${entry.effectKind}`,
          );
        }
      }
      mirrorLedger = emptyMirrorConsequenceLedger(journeyId);
      for (const entry of mirrorLedgerEntries) {
        mirrorLedger = appendMirrorConsequence(mirrorLedger, entry);
      }
      const { entriesToPromote } = promoteMirrorConsequences(mirrorLedger);
      for (const entry of entriesToPromote) {
        const entryId = deriveMirrorConsequenceEntryId({
          journeyId,
          actionEventId: entry.actionEventId,
          dedupeKey: entry.dedupeKey,
        });
        // Rebase cumulative baselines against the running projection so
        // multi-objective journeys produce the same influenceScoreAfter /
        // standingAfter that the legacy planJourneyWorldImpactEvents path
        // would compute. Mirror-mode submitHostedAction captures these
        // snapshots per-action at submit time without visibility into
        // prior objectives' canonical influence deltas; solidify is the
        // single point where canonical world events commit, so the
        // projection-derived baseline overrides the submit-time snapshot
        // here. {@link rebaseMirrorEntryAgainstProjection} is a no-op for
        // trace_created (no score baseline on that kind).
        const rebasedEntry = rebaseMirrorEntryAgainstProjection(entry, workingProjection);
        const canonicalEvent = buildCanonicalEventFromMirrorEntry({
          entryId,
          entry: rebasedEntry,
          makeEvent,
          idFactory,
          worldMinute: currentProjectionWorldMinute(workingProjection),
        });
        effectEvents.push(canonicalEvent);
        mirrorLedger = markMirrorConsequencePromoted(mirrorLedger, entryId, canonicalEvent.eventId);
        workingProjection = applyEvents(workingProjection, [canonicalEvent]);
      }
      assertNoDuplicatePromotion(mirrorLedger);
    } else {
      for (const evidence of orderedEvidence) {
        const contract = evidence.session.sceneContract as JourneySceneContract;
        const objective = contract.taskObjective;
        const resolution = evidence.action.journeyResolution;
        if (!objective || !resolution) continue;
        const planned = planJourneyWorldImpactEvents({
          makeEvent,
          idFactory,
          regionId,
          agentId,
          explorerId: identity.explorerId,
          identityName: identity.identityName,
          journeyId,
          episodeId: contract.episodeId,
          objectiveId: objective.objectiveId,
          objectiveKind: objective.kind,
          objectiveTitle: objective.title,
          actionLabel: evidence.signedAction.label,
          actionRisk: evidence.signedAction.risk,
          allowedEffectKinds: evidence.signedAction.allowedEffectKinds,
          resolution,
          previousInfluenceScore: currentRegionInfluenceScore(workingProjection, regionId, agentId),
          previousFactionStandingScore: currentAgentFactionStandingScore(
            workingProjection,
            agentId,
            evidence.signedAction.routeSelection?.factionObjectId,
          ),
          routeSelection: evidence.signedAction.routeSelection,
          sourceEventId: evidence.actionEvent.eventId,
          sourceAggregateId: evidence.session.sessionId,
          recordedAt: solidifiedAt,
          worldMinute: currentProjectionWorldMinute(workingProjection),
        });
        effectEvents.push(...planned);
        workingProjection = applyEvents(workingProjection, planned);
      }
    }

    const contacts = new Map<string, {
      readonly displayName: string;
      readonly sourceEventIds: string[];
      readonly risks: HostedActionRisk[];
      readonly objectiveTitles: string[];
    }>();
    for (const evidence of orderedEvidence) {
      const contract = evidence.session.sceneContract as JourneySceneContract;
      const participants = contract.participants.filter((participant) =>
        participant.type.toLowerCase() === "npc" || participant.type.toLowerCase() === "person");
      const targeted = participants.filter((participant) =>
        evidence.signedAction.targetEntityIds.includes(participant.id));
      for (const participant of targeted.length ? targeted : participants) {
        const key = stableKey(`${regionId}:${participant.label}`);
        const prior = contacts.get(key) ?? {
          displayName: participant.label,
          sourceEventIds: [],
          risks: [],
          objectiveTitles: [],
        };
        contacts.set(key, {
          displayName: prior.displayName,
          sourceEventIds: uniqueValues([...prior.sourceEventIds, evidence.actionEvent.eventId]),
          risks: [...prior.risks, evidence.signedAction.risk],
          objectiveTitles: uniqueValues([
            ...prior.objectiveTitles,
            contract.taskObjective?.title || contract.title,
          ]),
        });
      }
    }

    const npcRelationships: JourneyWorldSolidifiedPayload["npcRelationships"][number][] = [];
    for (const [npcKey, contact] of [...contacts].sort(([left], [right]) => left.localeCompare(right, "en-US"))) {
      let npcId = workingProjection.npcIdsByKey[npcKey];
      if (!npcId) {
        npcId = idFactory("npc", npcKey);
        const canonicalEvents = planNpcCanonicalizedEvents({
          makeEvent,
          npcId,
          npcKey,
          displayName: contact.displayName,
          regionId,
          traits: ["journey_contact"],
          sourceEventId: contact.sourceEventIds[0],
        });
        effectEvents.push(...canonicalEvents);
        workingProjection = applyEvents(workingProjection, canonicalEvents);
      }
      const npc = workingProjection.npcs[npcId];
      if (!npc) throw new Error("journey_npc_canonicalization_failed");
      assertChildNpcBondAllowed(npc, "friend");
      const bondId = idFactory("agent_npc_bond", `${agentId}:${npcId}:friend`);
      const previousScore = workingProjection.agentNpcBonds[bondId]?.score ?? 0;
      const memoryId = idFactory("npc_memory", `${npcId}:${journeyId}:mirror-solidified`);
      const relationship = planJourneyNpcRelationshipSolidificationEvents({
        makeEvent,
        bondId,
        memoryId,
        journeyId,
        agentId,
        explorerId: identity.explorerId,
        npcId,
        npcRegionId: npc.regionId,
        npcDisplayName: npc.displayName,
        identityName: identity.identityName,
        previousScore,
        risks: contact.risks,
        objectiveTitles: contact.objectiveTitles,
        sourceEventIds: contact.sourceEventIds,
        recordedAt: solidifiedAt,
      });
      effectEvents.push(...relationship.events);
      workingProjection = applyEvents(workingProjection, relationship.events);
      npcRelationships.push({
        npcId,
        displayName: npc.displayName,
        bondId,
        scoreDelta: relationship.scoreDelta,
        scoreAfter: relationship.scoreAfter,
        memoryId,
      });
    }

    const factionStandings = effectEvents.flatMap((event) => event.eventType === "agent_faction_standing_changed"
      ? [{
          factionId: event.payload.factionId,
          routeId: event.payload.routeId,
          standingDelta: event.payload.standingDelta,
          standingAfter: event.payload.standingAfter,
        }]
      : []);
    const influenceDelta = effectEvents.reduce((total, event) =>
      total + (event.eventType === "region_influence_changed" ? event.payload.influenceDelta : 0), 0);
    const sourceEventIds = uniqueValues([
      ...orderedEvidence.map((evidence) => evidence.actionEvent.eventId),
      returnSourceEvent.eventId,
    ]);
    const markerPayload: JourneyWorldSolidifiedPayload = {
      journeyId,
      agentId,
      explorerId: identity.explorerId,
      regionId,
      completedObjectiveIds,
      requiredMainObjectiveIds,
      mirrorStartedAtWorldTime,
      mirrorEndedAtWorldTime,
      committedAtWorldTime,
      completionTier: input.completionTier,
      completionScoreBps: input.completionScoreBps,
      ...(input.worldSliceHash ? { worldSliceHash: input.worldSliceHash } : {}),
      influenceDelta,
      factionStandings,
      npcRelationships,
      sourceEventIds,
      effectEventIds: effectEvents.map((event) => event.eventId),
      solidifiedAt,
      ...(mirrorLedger
        ? {
            mirrorLedgerPromotedEntryIds: Object.entries(mirrorLedger.promotedCanonicalEventIds).map(
              ([entryId]) => entryId,
            ),
          }
        : {}),
      // PR4 additive fields. Only attached when the caller passes the PR4
      // contract; legacy callers (no settlementPolicyVersion) emit the
      // legacy shape and downstream read adapters synthesise undefined.
      ...(input.settlementPolicyVersion !== undefined
        ? {
            settlementPolicyVersion: input.settlementPolicyVersion,
            consequenceScorePolicyVersion: input.consequenceScorePolicyVersion,
            canonThresholdBps: input.canonThresholdBps,
            settlementId: input.settlementId,
            consequenceScoreBreakdown: input.consequenceScoreBreakdown,
          }
        : {}),
    };
    const marker = makeEvent("journey_world_solidified", journeyId, markerPayload, {
      aggregateType: "agent_identity",
      agentId,
    }) as Extract<EpochEvent, { readonly eventType: "journey_world_solidified" }>;
    const nextEvents = [...effectEvents, marker];
    const nextProjection = applyEvents(current, nextEvents);
    return commit(nextEvents, journeyWorldCommitFromMarker(marker));
  }

  function queueServerHostedJob(input: QueueServerHostedJobInput, context: EpochCommandContext): EpochCommandResult<EpochServerHostedJob> {
    requireServerHostedAgentTrust(context);
    const current = projection();
    const agentId = assertNonEmptyString(input.agentId, "agent_id");
    const identity = requireActiveIdentity(current, agentId);
    const regionId = assertNonEmptyString(input.regionId, "region_id");
    const mandate = input.mandate?.trim() || "服务器托管行动";
    const queuedAt = serverIsoTime(clock);
    const jobId = idFactory("server_hosted_job", `${agentId}:${regionId}:${mandate}:${input.optionKey}:${queuedAt}`);
    const nextEvents = planServerHostedJobQueuedEvents({
      makeEvent: eventFactory(clock, idFactory, context),
      jobId,
      agentId,
      explorerId: identity.explorerId,
      regionId,
      mandate,
      optionKey: input.optionKey,
      visibleText: input.visibleText,
      queuedBy: context.actorExplorerId,
      queuedAt,
    });
    const nextProjection = applyEvents(current, nextEvents);
    return commit(nextEvents, nextProjection.serverHostedJobs[jobId]);
  }

  function canRunServerHostedJobOption(input: CanRunServerHostedJobOptionInput, context: EpochCommandContext): boolean {
    requireServerHostedAgentTrust(context);
    const current = projection();
    const agentId = assertNonEmptyString(input.agentId, "agent_id");
    requireActiveIdentity(current, agentId);
    if (input.optionKey === "anomaly") return includeHighRiskOptions(current, agentId);
    if (input.optionKey === "observe" || input.optionKey === "assist") return true;
    return false;
  }

  function completeServerHostedJob(input: CompleteServerHostedJobInput, context: EpochCommandContext): EpochCommandResult<EpochServerHostedJob> {
    requireServerHostedAgentTrust(context);
    const current = projection();
    const jobId = assertNonEmptyString(input.jobId, "server_hosted_job_id");
    const job = current.serverHostedJobs[jobId];
    if (!job) throw new Error("server_hosted_job_not_found");
    if (job.status !== "queued") throw new Error("server_hosted_job_not_queued");
    const sessionId = assertNonEmptyString(input.sessionId, "hosted_session_id");
    const session = current.hostedSessions[sessionId];
    if (!session) throw new Error("hosted_session_not_found");
    if (session.agentId !== job.agentId) throw new Error("server_hosted_job_session_mismatch");
    const actionId = assertNonEmptyString(input.actionId, "hosted_action_id");
    const action = session.actions.find((candidate) => candidate.actionId === actionId);
    if (!action) throw new Error("hosted_action_not_found");
    if (action.agentId !== job.agentId) throw new Error("server_hosted_job_action_mismatch");
    const completedAt = serverIsoTime(clock);
    const nextEvents = planServerHostedJobCompletedEvents({
      makeEvent: eventFactory(clock, idFactory, context),
      jobId,
      agentId: job.agentId,
      sessionId,
      actionId,
      completedAt,
    });
    const nextProjection = applyEvents(current, nextEvents);
    return commit(nextEvents, nextProjection.serverHostedJobs[jobId]);
  }

  function skipServerHostedJob(input: SkipServerHostedJobInput, context: EpochCommandContext): EpochCommandResult<EpochServerHostedJob> {
    requireServerHostedAgentTrust(context);
    const current = projection();
    const jobId = assertNonEmptyString(input.jobId, "server_hosted_job_id");
    const job = current.serverHostedJobs[jobId];
    if (!job) throw new Error("server_hosted_job_not_found");
    if (job.status !== "queued") throw new Error("server_hosted_job_not_queued");
    const skippedAt = serverIsoTime(clock);
    const nextEvents = planServerHostedJobSkippedEvents({
      makeEvent: eventFactory(clock, idFactory, context),
      jobId,
      agentId: job.agentId,
      reason: input.reason,
      skippedAt,
    });
    const nextProjection = applyEvents(current, nextEvents);
    return commit(nextEvents, nextProjection.serverHostedJobs[jobId]);
  }

  return {
    project: projection,
    events: () => [...events],
    ingestCanonicalEvents,
    ingestCausalWorldEvents,
    identitySlots,
    issueIdentity,
    rotateExplorerRecovery,
    adjustLifetime,
    confirmPersonalityDrift,
    archiveIdentity,
    reincarnate,
    grantResource,
    grantAttribute,
    spendResource,
    recordLoreContribution,
    adjudicateLoreTarget,
    changeAgentCustody,
    setDowntime,
    claimDowntime,
    tickDowntime,
    canonicalizeNpc,
    submitNpcCandidate,
    reviewNpcCandidate,
    recordNpcLifecycle,
    recordNpcMemory,
    tickNpcLifecycle,
    tickOrganizationPolitics,
    generateRegionNews,
    postMessage,
    resolveModerationItem,
    recordRiskReview,
    releaseMarketRiskRestriction,
    releaseAbuseRestriction,
    decayAbuseScores,
    decayRegionControls,
    claimReleasedRegionControl,
    resolveRegionRevolt,
    recordCommandRejected,
    claimNewsLegend,
    createContestedObjective,
    contributeContestedObjective,
    settleContestedObjective,
    createResourceNode,
    contestResourceNode,
    settleResourceNode,
    createAnomalyEvent,
    contestAnomalyEvent,
    resolveAnomalyEvent,
    createInventoryItem,
    craftInventoryItem,
    purchaseShopOffer,
    bindInventoryItem,
    createSeasonCampaign,
    contributeSeasonCampaign,
    settleSeasonCampaign,
    createMarketOrder,
    fillMarketOrder,
    cancelMarketOrder,
    createDirectTrade,
    acceptDirectTrade,
    cancelDirectTrade,
    tickDirectTradeExpiry,
    tickMarketExpiry,
    createBounty,
    claimBounty,
    createPartyRun,
    updatePartyInvite,
    joinPartyRun,
    requestPartyJoin,
    resolvePartyJoinRequest,
    settlePartyRun,
    resolveRaid,
    resolveRetaliation,
    createOrganization,
    updateOrganizationMembership,
    contributeOrganizationTreasury,
    proposeOrganizationBudget,
    resolveOrganizationBudget,
    purchaseOrganizationUpgrade,
    proposeDiplomacy,
    respondDiplomacy,
    updateRelationship,
    updateAgentNpcBond,
    deployTraceConflict,
    ownerTraceConflicts,
    regionTraceConflicts,
    ownerTraceConflictMemories,
    createTurnCard,
    resolveTurnCard,
    startHostedSession,
    submitHostedAction,
    solidifyJourneyWorld,
    queueServerHostedJob,
    canRunServerHostedJobOption,
    completeServerHostedJob,
    skipServerHostedJob,
  };
}
