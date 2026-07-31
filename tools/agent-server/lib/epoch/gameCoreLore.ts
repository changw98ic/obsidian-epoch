import type {
  EpochClock,
  EpochCommandContext,
  EpochIdFactory,
  EpochLoreAdjudicationStatus,
  EpochLoreContributionCategory,
  EpochLoreContributionProvenance,
  EpochLoreRevisionMode,
  EpochLoreRevisionPolicy,
  EpochLoreTargetAdjudicationProvenance,
  EpochLoreAuthorityReview,
  EpochResourceId,
} from "./protocol.ts";
import { assertNonEmptyString, normalizeTrustClass, serverIsoTime } from "./protocol.ts";
import type { EpochEvent, ExperimentMainRuleReview } from "./events.ts";
import type { CanonCandidatePath, CreatureBehaviorScopeReview, CrossRegionMechanismReview, FuzzyTimeIntervalReview } from "./events.ts";
import type { ResourceBalanceProjection } from "./resourceRules.ts";
import { currentBalance } from "./resourceRules.ts";
import { requireActiveIdentity } from "./identityProjectionRules.ts";
import {
  assertIdentityOwner,
} from "./identityAuthorizationRules.ts";
import { eventFactory } from "./eventFactory.ts";
import {
  createLoreContributionProvenance,
  createLoreTargetAdjudicationProvenance,
  loreAuthorityReviewForSourceContributions,
  loreClaimHash,
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

export interface GameCoreLoreContext<TProjection> {
  readonly projection: () => TProjection;
  readonly commit: <T>(events: readonly EpochEvent[], value: T) => { readonly events: readonly EpochEvent[]; readonly value: T; readonly projection: TProjection };
  readonly applyEvents: (projection: TProjection, events: readonly EpochEvent[]) => TProjection;
  readonly clock: EpochClock;
  readonly idFactory: EpochIdFactory;
}

export function createLoreCommands<
  TProjection extends
    { readonly identities: Readonly<Record<string, { readonly status: string; readonly explorerId: string } | undefined>> } &
    ResourceBalanceProjection &
    { readonly events: readonly EpochEvent[] },
>(
  ctx: GameCoreLoreContext<TProjection>,
) {
  function recordLoreContribution(input: RecordLoreContributionInput, context: EpochCommandContext): { readonly events: readonly EpochEvent[]; readonly value: EpochLoreContributionRecord; readonly projection: TProjection } {
    const current = ctx.projection();
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
    const recordedAt = serverIsoTime(ctx.clock);
    assertLoreRefutationDailyQuota({ category, events: current.events, agentId, recordedAt });
    const makeEvent = eventFactory(ctx.clock, ctx.idFactory, context);
    const contributionId = ctx.idFactory("lore_contribution", `${category}:${agentId}:${targetId}:${summary}`);
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
    return ctx.commit(nextEvents, record);
  }

  function adjudicateLoreTarget(
    input: RecordLoreTargetAdjudicationInput,
    context: EpochCommandContext,
  ): { readonly events: readonly EpochEvent[]; readonly value: EpochLoreTargetAdjudication; readonly projection: TProjection } {
    requireServerTrust(context, "lore_adjudication_requires_server_trust");
    const current = ctx.projection();
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
    const adjudicationId = ctx.idFactory(
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
    const adjudicatedAt = serverIsoTime(ctx.clock);
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
      makeEvent: eventFactory(ctx.clock, ctx.idFactory, context),
      adjudicationId,
      adjudication: payload,
    });
    return ctx.commit(nextEvents, payload);
  }

  return {
    recordLoreContribution,
    adjudicateLoreTarget,
  };
}

function requireServerTrust(context: EpochCommandContext, errorCode: string) {
  const trustClass = normalizeTrustClass(context.trustClass);
  if (trustClass === "untrusted_client") throw new Error(errorCode);
  return trustClass;
}
