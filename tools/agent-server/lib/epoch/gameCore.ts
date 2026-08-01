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
import type { ExpectedLifePattern, HiddenPrerequisiteLink } from "./journeyRoleplayRules.ts";
import type { CanonicalWorldObjectState } from "./hiddenPrerequisiteRules.ts";
import {
  type IdentityViability,
  LIFETIME_REASON_IDENTITY_VIABILITY_ACCELERATION,
  LIFETIME_REASON_IDENTITY_VIABILITY_SOCIAL_DEATH,
  initialIdentityViability,
} from "./journeyViabilityRules.ts";
import { eventFactory } from "./eventFactory.ts";
import {
  createJourneyCommands,
} from "./gameCoreJourney.ts";
import {
  createCombatCommands,
} from "./gameCoreCombat.ts";
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
  assertModerationResolution,
  assertDowntimeMode,
  assertFiniteInteger,
  assertMessageScope,
  assertNonEmptyString,
  assertNpcMemoryImportance,
  assertPositiveInteger,
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

export {
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
import { planJourneyWorldImpactEvents, planJourneyObjectImpactBlueprints } from "./journeyWorldImpactRules.ts";
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
import {
  applyEvent,
  projectEpochEvents,
  uniqueValues,
  sourceEventsMentionAgent,
  requireServerTrust,
} from "./gameCoreReducers.ts";

import type {
  AcceptDirectTradeInput, AdjustLifetimeInput, ArchiveIdentityInput, AttributeInput, BindInventoryItemInput, CancelDirectTradeInput, CancelMarketOrderInput, CanonicalizeNpcInput, CanRunServerHostedJobOptionInput, ChangeAgentCustodyInput, ClaimBountyInput, ClaimDowntimeInput, ClaimNewsLegendInput, ClaimReleasedRegionControlInput, CompleteServerHostedJobInput, ConfirmPersonalityDriftInput, ContestAnomalyEventInput, ContestResourceNodeInput, ContributeContestedObjectiveInput, ContributeOrganizationTreasuryInput, ContributeSeasonCampaignInput, CraftInventoryItemInput, CreateAnomalyEventInput, CreateBountyInput, CreateContestedObjectiveInput, CreateDirectTradeInput, CreateInventoryItemInput, CreateMarketOrderInput, CreateOrganizationInput, CreatePartyRunInput, CreateResourceNodeInput, CreateSeasonCampaignInput, CreateTurnCardInput, DecayAbuseScoresInput, DecayRegionControlsInput, DeployTraceConflictInput, EpochAbilityEffectCluster, EpochAbuseScoreDecay, EpochAbuseScoreProfile, EpochAbuseScoreRelease, EpochAgentCustodyState, EpochAgentFactionStanding, EpochAgentIdentity, EpochAgentNpcBond, EpochAgentPersonality, EpochAnomalyEvent, EpochAnomalyEventStatus, EpochAnomalyStanding, EpochAttestationRecord, EpochBounty, EpochBountyStatus, EpochCommandResult, EpochConflictTrace, EpochContestedObjective, EpochContestedObjectiveStatus, EpochCreatureBehaviorScopeReview, EpochCrossRegionMechanismReview, EpochDiplomacyRecord, EpochDiplomacyStatus, EpochDirectTrade, EpochDirectTradeAsset, EpochDirectTradeAssetKind, EpochDirectTradeStatus, EpochFuzzyTimeIntervalReview, EpochGameCoreOptions, EpochHostedActionRecord, EpochHostedSession, EpochHostedSessionStatus, EpochHousehold, EpochInventoryItem, EpochLegendAward, EpochLoreContributionRecord, EpochLoreTargetAdjudication, EpochMarketOrder, EpochMarketOrderStatus, EpochMarketRiskRestriction, EpochMarketRiskRestrictionRelease, EpochMarketSellKind, EpochMessageRecord, EpochModerationItem, EpochModerationItemStatus, EpochNpcAssetState, EpochNpcCandidate, EpochNpcCandidateDecision, EpochNpcCandidateReviewFlag, EpochNpcCandidateReviewLevel, EpochNpcCandidateStatus, EpochNpcCareerRecord, EpochNpcHealthState, EpochNpcLocationRecord, EpochNpcMemory, EpochNpcRecord, EpochNpcRelationship, EpochObjectiveStanding, EpochOrganization, EpochOrganizationBudget, EpochOrganizationBudgetVote, EpochOrganizationMembership, EpochOrganizationMemberType, EpochOrganizationPoliticsRecord, EpochOrganizationUpgrade, EpochPartyJoinRequest, EpochPartyJoinRequestStatus, EpochPartyMember, EpochPartyMemberResult, EpochPartyRun, EpochPartyRunStatus, EpochPersonalityDrift, EpochPersonalityDriftStatus, EpochProjection, EpochRaceCompletion, EpochRaidResult, EpochRecoveryRotation, EpochRegionControl, EpochRegionControlDecay, EpochRegionInfluenceChange, EpochRegionMonument, EpochRegionNews, EpochRegionRevoltResult, EpochRelationshipEdge, EpochResourceNode, EpochResourceNodeStanding, EpochResourceNodeStatus, EpochRetaliationOpportunity, EpochRetaliationOpportunityStatus, EpochRiskReview, EpochRumorAdmissionReview, EpochSeasonAgentStanding, EpochSeasonCampaign, EpochSeasonCampaignStatus, EpochSeasonContribution, EpochSeasonFactionStanding, EpochSeasonObjective, EpochSeasonObjectiveStatus, EpochSeasonObjectiveTemplate, EpochSeasonPhase, EpochSeasonPhaseEvent, EpochSeasonPhaseEventType, EpochServerHostedJob, EpochServerHostedJobStatus, EpochSocialHook, EpochTurnCard, EpochTurnCardStatus, EpochTurnResolution, EpochTurnTraceEffect, FillMarketOrderInput, GenerateRegionNewsInput, IssueIdentityInput, JoinPartyRunInput, MutableProjection, PostMessageInput, ProposeDiplomacyInput, ProposeOrganizationBudgetInput, PurchaseOrganizationUpgradeInput, PurchaseShopOfferInput, QueueServerHostedJobInput, RecordCommandRejectedInput, RecordLoreContributionInput, RecordLoreTargetAdjudicationInput, RecordNpcLifecycleInput, RecordNpcMemoryInput, RecordRiskReviewInput, ReincarnateInput, ReleaseAbuseRestrictionInput, ReleaseMarketRiskRestrictionInput, RequestPartyJoinInput, ResolveAnomalyEventInput, ResolveModerationItemInput, ResolveOrganizationBudgetInput, ResolvePartyJoinRequestInput, ResolveRaidInput, ResolveRegionRevoltInput, ResolveRetaliationInput, ResolveTurnCardInput, ResourceInput, RespondDiplomacyInput, ReviewNpcCandidateInput, RotateExplorerRecoveryInput, SetDowntimeInput, SettleContestedObjectiveInput, SettlePartyRunInput, SettleResourceNodeInput, SettleSeasonCampaignInput, SkipServerHostedJobInput, SolidifyJourneyWorldInput, StartHostedSessionInput, SubmitHostedActionInput, SubmitNpcCandidateInput, SubmitNpcCandidateResult, TickDirectTradeExpiryInput, TickDirectTradeExpiryResult, TickDowntimeInput, TickDowntimeResult, TickMarketExpiryInput, TickMarketExpiryResult, TickNpcLifecycleInput, TickNpcLifecycleResult, TickOrganizationPoliticsInput, TickOrganizationPoliticsResult, TraceConflictOwnerViewInput, TraceConflictRegionViewInput, UpdateAgentNpcBondInput, UpdateOrganizationMembershipInput, UpdatePartyInviteInput, UpdateRelationshipInput,
} from "./gameCoreTypes.ts";

export type {
  AcceptDirectTradeInput, AdjustLifetimeInput, ArchiveIdentityInput, AttributeInput, BindInventoryItemInput, CancelDirectTradeInput, CancelMarketOrderInput, CanonicalizeNpcInput, CanRunServerHostedJobOptionInput, ChangeAgentCustodyInput, ClaimBountyInput, ClaimDowntimeInput, ClaimNewsLegendInput, ClaimReleasedRegionControlInput, CompleteServerHostedJobInput, ConfirmPersonalityDriftInput, ContestAnomalyEventInput, ContestResourceNodeInput, ContributeContestedObjectiveInput, ContributeOrganizationTreasuryInput, ContributeSeasonCampaignInput, CraftInventoryItemInput, CreateAnomalyEventInput, CreateBountyInput, CreateContestedObjectiveInput, CreateDirectTradeInput, CreateInventoryItemInput, CreateMarketOrderInput, CreateOrganizationInput, CreatePartyRunInput, CreateResourceNodeInput, CreateSeasonCampaignInput, CreateTurnCardInput, DecayAbuseScoresInput, DecayRegionControlsInput, DeployTraceConflictInput, EpochAbilityEffectCluster, EpochAbuseScoreDecay, EpochAbuseScoreProfile, EpochAbuseScoreRelease, EpochAgentCustodyState, EpochAgentFactionStanding, EpochAgentIdentity, EpochAgentNpcBond, EpochAgentPersonality, EpochAnomalyEvent, EpochAnomalyEventStatus, EpochAnomalyStanding, EpochAttestationRecord, EpochBounty, EpochBountyStatus, EpochCommandResult, EpochConflictTrace, EpochContestedObjective, EpochContestedObjectiveStatus, EpochCreatureBehaviorScopeReview, EpochCrossRegionMechanismReview, EpochDiplomacyRecord, EpochDiplomacyStatus, EpochDirectTrade, EpochDirectTradeAsset, EpochDirectTradeAssetKind, EpochDirectTradeStatus, EpochFuzzyTimeIntervalReview, EpochGameCoreOptions, EpochHostedActionRecord, EpochHostedSession, EpochHostedSessionStatus, EpochHousehold, EpochInventoryItem, EpochLegendAward, EpochLoreContributionRecord, EpochLoreTargetAdjudication, EpochMarketOrder, EpochMarketOrderStatus, EpochMarketRiskRestriction, EpochMarketRiskRestrictionRelease, EpochMarketSellKind, EpochMessageRecord, EpochModerationItem, EpochModerationItemStatus, EpochNpcAssetState, EpochNpcCandidate, EpochNpcCandidateDecision, EpochNpcCandidateReviewFlag, EpochNpcCandidateReviewLevel, EpochNpcCandidateStatus, EpochNpcCareerRecord, EpochNpcHealthState, EpochNpcLocationRecord, EpochNpcMemory, EpochNpcRecord, EpochNpcRelationship, EpochObjectiveStanding, EpochOrganization, EpochOrganizationBudget, EpochOrganizationBudgetVote, EpochOrganizationMembership, EpochOrganizationMemberType, EpochOrganizationPoliticsRecord, EpochOrganizationUpgrade, EpochPartyJoinRequest, EpochPartyJoinRequestStatus, EpochPartyMember, EpochPartyMemberResult, EpochPartyRun, EpochPartyRunStatus, EpochPersonalityDrift, EpochPersonalityDriftStatus, EpochProjection, EpochRaceCompletion, EpochRaidResult, EpochRecoveryRotation, EpochRegionControl, EpochRegionControlDecay, EpochRegionInfluenceChange, EpochRegionMonument, EpochRegionNews, EpochRegionRevoltResult, EpochRelationshipEdge, EpochResourceNode, EpochResourceNodeStanding, EpochResourceNodeStatus, EpochRetaliationOpportunity, EpochRetaliationOpportunityStatus, EpochRiskReview, EpochRumorAdmissionReview, EpochSeasonAgentStanding, EpochSeasonCampaign, EpochSeasonCampaignStatus, EpochSeasonContribution, EpochSeasonFactionStanding, EpochSeasonObjective, EpochSeasonObjectiveStatus, EpochSeasonObjectiveTemplate, EpochSeasonPhase, EpochSeasonPhaseEvent, EpochSeasonPhaseEventType, EpochServerHostedJob, EpochServerHostedJobStatus, EpochSocialHook, EpochTurnCard, EpochTurnCardStatus, EpochTurnResolution, EpochTurnTraceEffect, FillMarketOrderInput, GenerateRegionNewsInput, IssueIdentityInput, JoinPartyRunInput, MutableProjection, PostMessageInput, ProposeDiplomacyInput, ProposeOrganizationBudgetInput, PurchaseOrganizationUpgradeInput, PurchaseShopOfferInput, QueueServerHostedJobInput, RecordCommandRejectedInput, RecordLoreContributionInput, RecordLoreTargetAdjudicationInput, RecordNpcLifecycleInput, RecordNpcMemoryInput, RecordRiskReviewInput, ReincarnateInput, ReleaseAbuseRestrictionInput, ReleaseMarketRiskRestrictionInput, RequestPartyJoinInput, ResolveAnomalyEventInput, ResolveModerationItemInput, ResolveOrganizationBudgetInput, ResolvePartyJoinRequestInput, ResolveRaidInput, ResolveRegionRevoltInput, ResolveRetaliationInput, ResolveTurnCardInput, ResourceInput, RespondDiplomacyInput, ReviewNpcCandidateInput, RotateExplorerRecoveryInput, SetDowntimeInput, SettleContestedObjectiveInput, SettlePartyRunInput, SettleResourceNodeInput, SettleSeasonCampaignInput, SkipServerHostedJobInput, SolidifyJourneyWorldInput, StartHostedSessionInput, SubmitHostedActionInput, SubmitNpcCandidateInput, SubmitNpcCandidateResult, TickDirectTradeExpiryInput, TickDirectTradeExpiryResult, TickDowntimeInput, TickDowntimeResult, TickMarketExpiryInput, TickMarketExpiryResult, TickNpcLifecycleInput, TickNpcLifecycleResult, TickOrganizationPoliticsInput, TickOrganizationPoliticsResult, TraceConflictOwnerViewInput, TraceConflictRegionViewInput, UpdateAgentNpcBondInput, UpdateOrganizationMembershipInput, UpdatePartyInviteInput, UpdateRelationshipInput,
} from "./gameCoreTypes.ts";

export type { ReviewNpcCandidateResolution } from "./npcCandidateRules.ts";
export type {
  ActionIntentCommandResult,
  ResolveTurnCardIntentInput,
  SubmitHostedIntentInput,
} from "./gameCoreTypes.ts";




export { applyEvent, projectEpochEvents, uniqueValues, sourceEventsMentionAgent, requireServerTrust } from "./gameCoreReducers.ts";

import { createEpochGameCore } from "./gameCoreComposition.ts";
export { createEpochGameCore };
