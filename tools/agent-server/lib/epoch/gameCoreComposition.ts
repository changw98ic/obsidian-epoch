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
  type ViabilityTriggerRef,
} from "./journeyViabilityRules.ts";
import { eventFactory } from "./eventFactory.ts";
import { upcastEvent } from "./eventUpcasters.ts";
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
import {
  createIntentAgent,
  type IntentActionOptionCandidate,
} from "./intentAgent.ts";
import type {
  ResolveTurnCardStructuredIntentInput,
  SubmitHostedStructuredIntentInput,
} from "./gameCoreTypes.ts";
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
  applyIdentityEvent,
  applyWorldEvent,
  applyDowntimeEvent,
  applyNpcEvent,
  applyOrganizationEvent,
  applyModerationEvent,
  applyEncounterEvent,
  applySeasonEvent,
  applyTradeEvent,
  applyCombatEvent,
  applyDiplomacyEvent,
  applyTurnHostedEvent,
  applyAbuseScoreEvent,
} from "./gameCoreReducers.ts";

import { applyEvent, projectEpochEvents, uniqueValues, sourceEventsMentionAgent, requireServerTrust, freezeProjection } from "./gameCoreReducers.ts";

const TURN_CARD_TTL_MS = 15 * 60 * 1000;

import type {
  AcceptDirectTradeInput, AdjustLifetimeInput, ArchiveIdentityInput, AttributeInput, BindInventoryItemInput, CancelDirectTradeInput, CancelMarketOrderInput, CanonicalizeNpcInput, CanRunServerHostedJobOptionInput, ChangeAgentCustodyInput, ClaimBountyInput, ClaimDowntimeInput, ClaimNewsLegendInput, ClaimReleasedRegionControlInput, CompleteServerHostedJobInput, ConfirmPersonalityDriftInput, ContestAnomalyEventInput, ContestResourceNodeInput, ContributeContestedObjectiveInput, ContributeOrganizationTreasuryInput, ContributeSeasonCampaignInput, CraftInventoryItemInput, CreateAnomalyEventInput, CreateBountyInput, CreateContestedObjectiveInput, CreateDirectTradeInput, CreateInventoryItemInput, CreateMarketOrderInput, CreateOrganizationInput, CreatePartyRunInput, CreateResourceNodeInput, CreateSeasonCampaignInput, CreateTurnCardInput, DecayAbuseScoresInput, DecayRegionControlsInput, DeployTraceConflictInput, EpochAbilityEffectCluster, EpochAbuseScoreDecay, EpochAbuseScoreProfile, EpochAbuseScoreRelease, EpochAgentCustodyState, EpochAgentFactionStanding, EpochAgentIdentity, EpochAgentNpcBond, EpochAgentPersonality, EpochAnomalyEvent, EpochAnomalyEventStatus, EpochAnomalyStanding, EpochAttestationRecord, EpochBounty, EpochBountyStatus, EpochCommandResult, EpochConflictTrace, EpochContestedObjective, EpochContestedObjectiveStatus, EpochCreatureBehaviorScopeReview, EpochCrossRegionMechanismReview, EpochDiplomacyRecord, EpochDiplomacyStatus, EpochDirectTrade, EpochDirectTradeAsset, EpochDirectTradeAssetKind, EpochDirectTradeStatus, EpochFuzzyTimeIntervalReview, EpochGameCoreOptions, EpochHostedActionRecord, EpochHostedSession, EpochHostedSessionStatus, EpochHousehold, EpochInventoryItem, EpochLegendAward, EpochLoreContributionRecord, EpochLoreTargetAdjudication, EpochMarketOrder, EpochMarketOrderStatus, EpochMarketRiskRestriction, EpochMarketRiskRestrictionRelease, EpochMarketSellKind, EpochMessageRecord, EpochModerationItem, EpochModerationItemStatus, EpochNpcAssetState, EpochNpcCandidate, EpochNpcCandidateDecision, EpochNpcCandidateReviewFlag, EpochNpcCandidateReviewLevel, EpochNpcCandidateStatus, EpochNpcCareerRecord, EpochNpcHealthState, EpochNpcLocationRecord, EpochNpcMemory, EpochNpcRecord, EpochNpcRelationship, EpochObjectiveStanding, EpochOrganization, EpochOrganizationBudget, EpochOrganizationBudgetVote, EpochOrganizationMembership, EpochOrganizationMemberType, EpochOrganizationPoliticsRecord, EpochOrganizationUpgrade, EpochPartyJoinRequest, EpochPartyJoinRequestStatus, EpochPartyMember, EpochPartyMemberResult, EpochPartyRun, EpochPartyRunStatus, EpochPersonalityDrift, EpochPersonalityDriftStatus, EpochProjection, EpochRaceCompletion, EpochRaidResult, EpochRecoveryRotation, EpochRegionControl, EpochRegionControlDecay, EpochRegionInfluenceChange, EpochRegionMonument, EpochRegionNews, EpochRegionRevoltResult, EpochRelationshipEdge, EpochResourceNode, EpochResourceNodeStanding, EpochResourceNodeStatus, EpochRetaliationOpportunity, EpochRetaliationOpportunityStatus, EpochRiskReview, EpochRumorAdmissionReview, EpochSeasonAgentStanding, EpochSeasonCampaign, EpochSeasonCampaignStatus, EpochSeasonContribution, EpochSeasonFactionStanding, EpochSeasonObjective, EpochSeasonObjectiveStatus, EpochSeasonObjectiveTemplate, EpochSeasonPhase, EpochSeasonPhaseEvent, EpochSeasonPhaseEventType, EpochServerHostedJob, EpochServerHostedJobStatus, EpochSocialHook, EpochTurnCard, EpochTurnCardStatus, EpochTurnResolution, EpochTurnTraceEffect, FillMarketOrderInput, GenerateRegionNewsInput, IssueIdentityInput, JoinPartyRunInput, MutableProjection, PostMessageInput, ProposeDiplomacyInput, ProposeOrganizationBudgetInput, PurchaseOrganizationUpgradeInput, PurchaseShopOfferInput, QueueServerHostedJobInput, RecordCommandRejectedInput, RecordLoreContributionInput, RecordLoreTargetAdjudicationInput, RecordNpcLifecycleInput, RecordNpcMemoryInput, RecordRiskReviewInput, ReincarnateInput, ReleaseAbuseRestrictionInput, ReleaseMarketRiskRestrictionInput, RequestPartyJoinInput, ResolveAnomalyEventInput, ResolveModerationItemInput, ResolveOrganizationBudgetInput, ResolvePartyJoinRequestInput, ResolveRaidInput, ResolveRegionRevoltInput, ResolveRetaliationInput, ResolveTurnCardInput, ResourceInput, RespondDiplomacyInput, ReviewNpcCandidateInput, RotateExplorerRecoveryInput, SetDowntimeInput, SettleContestedObjectiveInput, SettlePartyRunInput, SettleResourceNodeInput, SettleSeasonCampaignInput, SkipServerHostedJobInput, SolidifyJourneyWorldInput, StartHostedSessionInput, SubmitHostedActionInput, SubmitNpcCandidateInput, SubmitNpcCandidateResult, TickDirectTradeExpiryInput, TickDirectTradeExpiryResult, TickDowntimeInput, TickDowntimeResult, TickMarketExpiryInput, TickMarketExpiryResult, TickNpcLifecycleInput, TickNpcLifecycleResult, TickOrganizationPoliticsInput, TickOrganizationPoliticsResult, TraceConflictOwnerViewInput, TraceConflictRegionViewInput, UpdateAgentNpcBondInput, UpdateOrganizationMembershipInput, UpdatePartyInviteInput, UpdateRelationshipInput,
} from "./gameCoreTypes.ts";
import type {
  ResolveTurnCardIntentInput,
  SubmitHostedIntentInput,
} from "./gameCoreTypes.ts";

const DEFAULT_LIFETIME = 100;

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
 * the scene carries no approachTags.
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

export function currentAgentFactionStandingScore(
  projection: EpochProjection,
  agentId: string,
  factionId: string | undefined,
): number {
  if (!factionId) return 0;
  return (projection.factionStandingIdsByAgent[agentId] || [])
    .map((standingId) => projection.agentFactionStandings[standingId])
    .find((standing) => standing?.factionId === factionId)?.score ?? 0;
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

// freezeProjection is now imported from gameCoreReducers.ts

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

function uniqueSortedStrings(values: readonly (string | undefined)[]): readonly string[] {
  return uniqueSortedValues(values);
}

export function createEpochGameCore(options: EpochGameCoreOptions = {}) {
  const clock = options.clock || (() => new Date());
  const initialEvents = (options.initialEvents || []).map((event) => upcastEvent(event));
  const idFactory = options.idFactory || createSequentialEpochIdFactory(
    "epoch",
    initialEvents.flatMap((event) => [event.eventId, event.aggregateId]),
  );
  const defaultLifetime = options.defaultLifetime || DEFAULT_LIFETIME;
  const maxDowntimeSeconds = options.maxDowntimeSeconds || DEFAULT_MAX_DOWNTIME_SECONDS;
  const identityNameFactory = options.identityNameFactory || ((input: { explorerId: string; generation: number }) =>
    `${input.explorerId}-第${input.generation}世`);
  const journeyMirrorLedgerSink = options.journeyMirrorLedgerSink;
  const intentAgent = createIntentAgent();
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
      initialViability: initialIdentityViability(agentId, startedAt),
      makeEvent: eventFactory(clock, idFactory, context),
      ...(input.strategyProfile ? { strategyProfile: input.strategyProfile } : {}),
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
    viabilityTriggerRef?: ViabilityTriggerRef,
    sourceEventId?: string,
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
      ...(sourceEventId ? { sourceEventId } : {}),
      ...(viabilityTriggerRef ? { viabilityTriggerRef } : {}),
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
    if (!Number.isSafeInteger(offer.stock) || offer.stock <= 0
      || !Number.isSafeInteger(offer.perExplorerLimit) || offer.perExplorerLimit <= 0) {
      throw new Error("shop_offer_limit_invalid");
    }
    const priorPurchaseRefs = new Set<string>();
    for (const event of current.events) {
      if (event.eventType !== "resource_spent" || event.agentId !== agentId) continue;
      const reason = event.payload.reason;
      if (reason !== `shop_purchase:${offer.offerId}` && !reason.endsWith(`:${offer.offerId}`)) continue;
      priorPurchaseRefs.add(event.idempotencyKey || event.correlationId || event.causationId || event.eventId);
    }
    const explorerPurchaseCap = Math.min(offer.stock, offer.perExplorerLimit);
    if (priorPurchaseRefs.size >= explorerPurchaseCap) {
      throw new Error("shop_offer_purchase_limit_reached");
    }

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


  const combatCommands = createCombatCommands({
    projection,
    commit,
    applyEvents,
    clock,
    idFactory,
    proposeRelationshipPersonalityDriftEvent,
  });

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
    const intentRejected = input.intentAudit?.status === "unmatched";
    const template = turnOptionTemplate(option.optionKey);
    const settlement = intentRejected
      ? { reward: undefined, lifetimeDelta: undefined, nonEvidence: true }
      : settlementPolicy(current, card.agentId, {
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
      outcomeSummary: intentRejected
        ? `服务器未将这段自然语言匹配到当前行动卡；本次只记录失败尝试，未执行“${option.label}”。`
        : settledOutcomeSummary(
        template.outcomeSummary,
        template.reward,
        settlement.reward,
        settlement.lifetimeDelta,
        ),
      intentAudit: input.intentAudit,
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

  function resolveTurnCardIntent(
    input: ResolveTurnCardIntentInput,
    context: EpochCommandContext,
  ): EpochCommandResult<EpochTurnResolution> {
    const intent = intentAgent.interpret(input.intentText);
    return resolveTurnCardStructuredIntent({
      turnCardId: input.turnCardId,
      sequence: input.sequence,
      nonce: input.nonce,
      visibleText: input.visibleText,
      intent,
    }, context);
  }

  function resolveTurnCardStructuredIntent(
    input: ResolveTurnCardStructuredIntentInput,
    context: EpochCommandContext,
  ): EpochCommandResult<EpochTurnResolution> {
    const turnCardId = assertNonEmptyString(input.turnCardId, "turn_card_id");
    const card = projection().turnCards[turnCardId];
    if (!card) throw new Error("turn_card_not_found");
    const intent = input.intent;
    const candidates: readonly IntentActionOptionCandidate[] = card.actionOptions.map((option) => ({
      actionOptionId: option.actionOptionId,
      optionKey: option.optionKey,
      label: option.label,
      explanation: option.explanation.brief,
      risk: option.risk,
    }));
    const intentAudit = intentAgent.match(intent, candidates);
    return resolveTurnCard({
      turnCardId,
      actionOptionId: intentAudit.actionOptionId,
      sequence: input.sequence,
      nonce: input.nonce,
      visibleText: input.visibleText || intent.rawText,
      intentAudit,
    }, context);
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
    const intentRejected = input.intentAudit?.status === "unmatched";
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
    const settlement = intentRejected
      ? { reward: undefined, lifetimeDelta: undefined, nonEvidence: true }
      : settlementPolicy(current, session.agentId, {
          risk: option.risk,
          reward: option.reward,
          lifetimeDelta: option.lifetimeDelta,
        });
    const phase6PreparationScore = session.sceneContract?.phase6Readiness?.journeyPreparationScore ?? 0;
    const journeyPreparationScore = session.sceneContract
      ? Math.min(16, phase6PreparationScore + Object.values(current.hostedSessions).reduce((score, priorSession) => {
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
          ...(intentRejected ? {
            forcedFailure: {
              reason: "intent_not_supported" as const,
              preparationSteps: input.intentAudit?.preparationSteps || [],
            },
          } : {}),
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
    const actionReward = intentRejected ? undefined : journeyObjectiveReward ?? settlement.reward;
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
      outcomeSummary: journeyResolution?.summary ?? (intentRejected
        ? `服务器未将这段自然语言匹配到当前行动；本次只记录失败尝试，未执行“${option.label}”。`
        : settledOutcomeSummary(
            option.outcomeSummary,
            option.reward,
            actionReward,
            settlement.lifetimeDelta,
          )),
      intentAudit: input.intentAudit,
      ...(journeyResolution ? { journeyResolution } : {}),
      reward: actionReward,
      lifetimeDelta: settlement.lifetimeDelta,
      nonEvidence: intentRejected ? true : settlement.nonEvidence,
      recordedAt,
      sideEffectEvents: (actionRecorded) => {
        const sideEffects: EpochEvent[] = [];
        if (intentRejected) return sideEffects;
        const resourceCost = journeyResolution?.resourceCost;
        if (resourceCost?.paid) {
          const balance = currentBalance(current, session.agentId, resourceCost.resourceId);
          if (balance < resourceCost.amount) throw new Error("journey_action_cost_state_invalid");
          sideEffects.push(resourceSpentEvent(makeEvent, session.agentId, {
            resourceId: resourceCost.resourceId,
            amount: resourceCost.amount,
            reason: `journey_action_cost:${session.sceneContract?.journeyId}:${session.sceneContract?.taskObjective?.objectiveId}`,
            balanceAfter: balance - resourceCost.amount,
            sourceEventId: actionRecorded.eventId,
            accountRef: `agent:${session.agentId}`,
            assetKey: `resource:${resourceCost.resourceId}`,
            unit: "unit",
            quantityMinor: (BigInt(resourceCost.amount) * 100n).toString(),
          }));
        }
        if (journeyResolution && signedJourneyAction?.taskObjectiveId
          && session.sceneContract?.taskObjective) {
          if (session.sceneContract.worldMode === "mirror") {
            // Mirror-mode collateral does not enter the canonical epoch event
            // stream at action time. The ledger sink is mandatory whenever an
            // action produces entries; collateral must remain available for
            // settlement and solidification.
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
              // to canonical world state. Actions without observable approach
              // tags, or identities without a comparison norm, produce no
              // doubt entry. The entries join the same ledger sink as the
              // physical-impact blueprints so solidify-time promotion handles
              // them uniformly.
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
              // PR5c: object-impact planner. When the signed action carries
              // an internal actionObjectImpact descriptor, emit a mirror-ledger
              // entry for the physical object mutation/destruction. The entry
              // flows through the same mirror-ledger append → promote → solidify
              // path as region/trace/faction blueprints. On solidify,
              // buildCanonicalEventFromMirrorEntry dispatches it to a canonical
              // world_object_state_changed event; on discard the entry never
              // reaches canonical state.
              const objectImpactEntries = planJourneyObjectImpactBlueprints({
                actionEventId: actionRecorded.eventId,
                agentId: session.agentId,
                regionId: session.regionId,
                actionObjectImpact: signedJourneyAction.actionObjectImpact,
                resolution: journeyResolution,
                recordedAt,
                sourceAggregateId: session.sessionId,
              });
              const blueprints: MirrorConsequenceLedgerEntry[] = [
                ...physicalBlueprints,
                ...doubtEntries,
                ...objectImpactEntries,
              ];
              if (blueprints.length > 0) {
                if (!journeyMirrorLedgerSink) {
                  throw new Error("journey_mirror_ledger_sink_required");
                }
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
      lifetimeEventsForDelta: ({ delta, reason, finalTitle, sourceEventId }) =>
        lifetimeAdjustmentEvents(
          current,
          session.agentId,
          delta,
          reason,
          finalTitle,
          { ...context, trustClass: eventTrustClass },
          undefined,
          sourceEventId,
        ),
    });
    const nextProjection = applyEvents(current, nextEvents);
    const recorded = nextProjection.hostedSessions[sessionId].actions.find((action) => action.actionId === actionId);
    if (!recorded) throw new Error("hosted_action_projection_failed");
    return commit(nextEvents, recorded);
  }

  function submitHostedIntent(
    input: SubmitHostedIntentInput,
    context: EpochCommandContext,
  ): EpochCommandResult<EpochHostedActionRecord> {
    const intent = intentAgent.interpret(input.intentText);
    return submitHostedStructuredIntent({
      sessionId: input.sessionId,
      visibleText: input.visibleText,
      journeyValidation: input.journeyValidation,
      attestation: input.attestation,
      intent,
    }, context);
  }

  function submitHostedStructuredIntent(
    input: SubmitHostedStructuredIntentInput,
    context: EpochCommandContext,
  ): EpochCommandResult<EpochHostedActionRecord> {
    const sessionId = assertNonEmptyString(input.sessionId, "hosted_session_id");
    const session = projection().hostedSessions[sessionId];
    if (!session) throw new Error("hosted_session_not_found");
    const intent = input.intent;
    const sceneOptions = session.sceneContract?.actionOptions;
    const candidates: readonly IntentActionOptionCandidate[] = (sceneOptions || session.actionOptions).map((option) => ({
      actionOptionId: option.actionOptionId,
      optionKey: option.optionKey,
      label: option.label,
      ...(("intent" in option && typeof option.intent === "string") ? { intent: option.intent } : {}),
      explanation: "explanation" in option && option.explanation
        ? option.explanation.brief
        : undefined,
      risk: option.risk,
    }));
    const intentAudit = intentAgent.match(intent, candidates);
    return submitHostedAction({
      sessionId,
      actionOptionId: intentAudit.actionOptionId,
      visibleText: input.visibleText,
      intentAudit,
      ...(input.journeyValidation ? { journeyValidation: input.journeyValidation } : {}),
      ...(input.attestation ? { attestation: input.attestation } : {}),
    }, context);
  }

  const journeyCommands = createJourneyCommands({
    projection,
    commit,
    applyEvents,
    clock,
    idFactory,
    lifetimeAdjustmentEvents,
  });



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
    ...combatCommands,
    createOrganization,
    updateOrganizationMembership,
    contributeOrganizationTreasury,
    proposeOrganizationBudget,
    resolveOrganizationBudget,
    purchaseOrganizationUpgrade,
    deployTraceConflict,
    ownerTraceConflicts,
    regionTraceConflicts,
    ownerTraceConflictMemories,
    createTurnCard,
    resolveTurnCard,
    resolveTurnCardIntent,
    resolveTurnCardStructuredIntent,
    startHostedSession,
    submitHostedAction,
    submitHostedIntent,
    submitHostedStructuredIntent,
    ...journeyCommands,
  };
}
