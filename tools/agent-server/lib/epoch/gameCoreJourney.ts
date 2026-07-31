import type {
  EpochClock,
  EpochCommandContext,
  EpochIdFactory,
} from "./protocol.ts";
import {
  assertNonEmptyString,
  serverIsoTime,
  stableKey,
} from "./protocol.ts";
import type {
  EpochEvent,
  HostedActionRisk,
  JourneyWorldSolidifiedPayload,
} from "./events.ts";
import { eventFactory } from "./eventFactory.ts";
import {
  requireActiveIdentity,
  requireIdentity,
} from "./identityProjectionRules.ts";
import {
  currentRegionInfluenceScore,
} from "./regionProjectionRules.ts";
import {
  includeHighRiskOptions,
  requireServerHostedAgentTrust,
} from "./turnHostedActionRules.ts";
import type {
  JourneySceneContract,
} from "./journeySceneContractRules.ts";
import type { JourneyWorldCommit } from "./journeyRules.ts";
import {
  buildCanonicalEventFromMirrorEntry,
  npcDoubtEventFromMirrorEntry,
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
  applyFactionDoubtPropagation,
  deriveViabilityProjection,
  deriveViabilityTrigger,
  projectIdentityViability,
  type IdentityViabilityProjection,
  type ViabilityTriggerRef,
} from "./journeyViabilityRules.ts";
import type { DoubtStrength, NpcDoubtEvent } from "./journeyRoleplayRules.ts";
import {
  planServerHostedJobCompletedEvents,
  planServerHostedJobQueuedEvents,
  planServerHostedJobSkippedEvents,
} from "./serverHostedRuntimeRules.ts";
import {
  planNpcCanonicalizedEvents,
} from "./npcCandidateRules.ts";
import {
  assertChildNpcBondAllowed,
  planJourneyNpcRelationshipSolidificationEvents,
} from "./agentInteractionRules.ts";
import type {
  EpochCommandResult,
  EpochHostedActionRecord,
  EpochHostedSession,
  EpochProjection,
  EpochServerHostedJob,
  SolidifyJourneyWorldInput,
  QueueServerHostedJobInput,
  CompleteServerHostedJobInput,
  SkipServerHostedJobInput,
  CanRunServerHostedJobOptionInput,
} from "./gameCore.ts";
import {
  requireServerTrust,
  uniqueValues,
} from "./gameCore.ts";
import {
  currentProjectionWorldMinute,
  currentAgentFactionStandingScore,
} from "./gameCoreTurnHosted.ts";

// ---------------------------------------------------------------------------
// Constants & helpers
// ---------------------------------------------------------------------------

const SUPPORTED_MIRROR_EFFECT_KINDS: ReadonlySet<ConsequenceEffectKind> = new Set<ConsequenceEffectKind>([
  "region_influence_delta",
  "trace_created",
  "faction_standing_delta",
  // PR5c: physical object impact kinds. object_mutation (degree 1-2 → degraded)
  // and object_destroy (degree 3+ → destroyed) are promoted by
  // buildCanonicalEventFromMirrorEntry into world_object_state_changed events.
  // hidden_prerequisite_destroyed is synthesised by the solidify-time cascade
  // after the canonical object-state transition commits.
  "object_mutation",
  "object_destroy",
  "hidden_prerequisite_destroyed",
  "identity_doubt",
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
 * baselines matching canonical cumulative influence planning.
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
  return {
    mode: "mirror",
    status: "solidified",
    completionTier: payload.completionTier,
    reason: "main_completed_and_above_threshold",
    regionId: payload.regionId,
    committedAtWorldTime: payload.committedAtWorldTime ?? payload.mirrorEndedAtWorldTime,
    influenceDelta: payload.influenceDelta,
    factionStandings: payload.factionStandings,
    npcRelationships: payload.npcRelationships,
    commitEventId: event.eventId,
    sourceEventIds: [...payload.effectEventIds, event.eventId],
    completionScoreBps: payload.completionScoreBps,
    canonThresholdBps: payload.canonThresholdBps,
    settlementPolicyVersion: payload.settlementPolicyVersion,
    consequenceScorePolicyVersion: payload.consequenceScorePolicyVersion,
    ...(payload.strategyPolicyVersion !== undefined ? { strategyPolicyVersion: payload.strategyPolicyVersion } : {}),
    ...(payload.questOfferId !== undefined ? { questOfferId: payload.questOfferId } : {}),
    ...(payload.offerHash !== undefined ? { offerHash: payload.offerHash } : {}),
    settlementId: payload.settlementId,
    consequenceScoreBreakdown: payload.consequenceScoreBreakdown,
  };
}

// ---------------------------------------------------------------------------
// Context & factory
// ---------------------------------------------------------------------------

export interface GameCoreJourneyContext {
  readonly projection: () => EpochProjection;
  readonly commit: <T>(events: readonly EpochEvent[], value: T) => { readonly events: readonly EpochEvent[]; readonly value: T; readonly projection: EpochProjection };
  readonly applyEvents: (projection: EpochProjection, events: readonly EpochEvent[]) => EpochProjection;
  readonly clock: EpochClock;
  readonly idFactory: EpochIdFactory;
  readonly lifetimeAdjustmentEvents?: (
    current: EpochProjection,
    agentId: string,
    delta: number,
    reason: string,
    finalTitle: string,
    context: EpochCommandContext,
    viabilityTriggerRef?: ViabilityTriggerRef,
  ) => readonly EpochEvent[];
}

export function createJourneyCommands(ctx: GameCoreJourneyContext) {
  const { projection, commit, applyEvents, clock, idFactory } = ctx;

  function viabilityStandingForAgent(
    current: EpochProjection,
    agentId: string,
  ): Readonly<Record<string, number>> {
    return Object.fromEntries(
      (current.factionStandingIdsByAgent[agentId] ?? [])
        .map((standingId) => current.agentFactionStandings[standingId])
        .filter((standing): standing is NonNullable<typeof standing> => standing !== undefined)
        .map((standing) => [standing.factionId, standing.score]),
    );
  }

  const DOUBT_RANK: Readonly<Record<DoubtStrength, number>> = {
    low: 0,
    moderate: 1,
    high: 2,
    severe: 3,
  };

  function mergeDoubtedBy(
    previous: Readonly<Record<string, DoubtStrength>>,
    doubtEvents: readonly NpcDoubtEvent[],
  ): Readonly<Record<string, DoubtStrength>> {
    const next: Record<string, DoubtStrength> = { ...previous };
    for (const doubt of doubtEvents) {
      const prior = next[doubt.npcId];
      if (!prior || DOUBT_RANK[doubt.doubtStrength] > DOUBT_RANK[prior]) {
        next[doubt.npcId] = doubt.doubtStrength;
      }
    }
    return next;
  }

  function projectJourneyIdentityViability(
    current: EpochProjection,
    input: {
      readonly agentId: string;
      readonly journeyId: string;
      readonly settlementId: string;
      readonly doubtEvents: readonly NpcDoubtEvent[];
      readonly projectedAt: string;
    },
    context: EpochCommandContext,
  ): {
    readonly events: readonly EpochEvent[];
    readonly projection: EpochProjection;
    readonly viabilityProjection: IdentityViabilityProjection;
  } {
    const identity = requireIdentity(current, input.agentId);
    const before = identity.identityViability;
    if (!before) throw new Error("journey_identity_viability_required");
    const standingBefore = viabilityStandingForAgent(current, input.agentId);
    const propagation = applyFactionDoubtPropagation({
      identityId: input.agentId,
      journeyId: input.journeyId,
      doubtEvents: input.doubtEvents,
      factionStanding: standingBefore,
      doubtedBy: before.doubtedBy,
    });
    const makeEvent = eventFactory(clock, idFactory, {
      ...context,
      trustClass: "system_worker",
    });
    const standingEvents: EpochEvent[] = [];
    let workingProjection = current;
    for (const delta of propagation.standingDeltas) {
      const standingId = idFactory("faction_standing", `viability:${delta.dedupeKey}`);
      const standingEvent = makeEvent("agent_faction_standing_changed", standingId, {
        standingId,
        agentId: input.agentId,
        explorerId: identity.explorerId,
        factionId: delta.factionId,
        standingDelta: delta.standingDelta,
        standingAfter: delta.standingAfter,
        journeyId: input.journeyId,
        episodeId: "viability_projection",
        objectiveId: "identity_viability",
        routeId: delta.dedupeKey,
        sourceEventId: delta.doubtEventId,
        changedAt: input.projectedAt,
        worldMinute: currentProjectionWorldMinute(workingProjection),
        sourceKind: "viability_doubt_propagation",
        sourceDoubtEventId: delta.doubtEventId,
      }, {
        aggregateType: "agent_identity",
        agentId: input.agentId,
        eventId: idFactory("event", `viability:${delta.dedupeKey}`),
      });
      standingEvents.push(standingEvent);
      workingProjection = applyEvents(workingProjection, [standingEvent]);
    }
    const afterResult = projectIdentityViability({
      identityId: input.agentId,
      factionStanding: propagation.factionStanding,
      flaggedWanted: new Set(before.flaggedWanted),
      identityExposed: before.identityExposed || input.doubtEvents.some((event) => event.doubtStrength === "severe"),
      doubtedBy: mergeDoubtedBy(before.doubtedBy, input.doubtEvents),
      lifetime: identity.lifetime,
      projectedAt: input.projectedAt,
    });
    const viabilityProjection = deriveViabilityProjection(
      input.agentId,
      before,
      afterResult.viability,
      input.settlementId,
    );
    const viabilityEvent = makeEvent("identity_viability_projected", input.agentId, {
      identityId: input.agentId,
      before: viabilityProjection.before,
      after: viabilityProjection.after,
      deltaBps: viabilityProjection.deltaBps,
      lifetimeAccelerationBps: viabilityProjection.lifetimeAccelerationBps,
      socialDeathTriggered: viabilityProjection.socialDeathTriggered,
      sourceSettlementId: viabilityProjection.sourceSettlementId,
      policyVersion: viabilityProjection.policyVersion,
      projectedAt: input.projectedAt,
    }, {
      aggregateType: "agent_identity",
      agentId: input.agentId,
      eventId: idFactory("event", `viability:${input.agentId}:${input.settlementId}`),
    });
    const nextEvents: EpochEvent[] = [...standingEvents, viabilityEvent];
    workingProjection = applyEvents(workingProjection, [viabilityEvent]);
    const trigger = deriveViabilityTrigger(viabilityProjection, identity.lifetime);
    if (trigger) {
      if (!ctx.lifetimeAdjustmentEvents) {
        throw new Error("journey_viability_lifetime_callback_required");
      }
      const lifetimeEvents = ctx.lifetimeAdjustmentEvents(
        workingProjection,
        input.agentId,
        trigger.delta,
        trigger.reason,
        identity.identityName,
        context,
        trigger.viabilityTriggerRef,
      );
      nextEvents.push(...lifetimeEvents);
      workingProjection = applyEvents(workingProjection, lifetimeEvents);
    }
    return {
      events: nextEvents,
      projection: workingProjection,
      viabilityProjection,
    };
  }

  /**
   * Project the identity-facing aftermath of a settled mirror journey.
   *
   * This is deliberately a separate command from solidification: discarded
   * mirror worlds still leave social doubt and viability behind, while their
   * physical/world collateral is thrown away. The settlement id is the
   * idempotency boundary, so a retry after persistence recovery cannot emit a
   * second viability projection or a second lifetime adjustment.
   */
  function projectJourneySettlementViability(
    input: {
      readonly journeyId: string;
      readonly agentId: string;
      readonly settlementId: string;
      readonly doubtEvents: readonly NpcDoubtEvent[];
      readonly projectedAt: string;
    },
    context: EpochCommandContext,
  ): EpochCommandResult<IdentityViabilityProjection> {
    const trustClass = requireServerTrust(
      context,
      "journey_viability_projection_requires_server_trust",
    );
    const current = projection();
    const journeyId = assertNonEmptyString(input.journeyId, "journey_id");
    const agentId = assertNonEmptyString(input.agentId, "agent_id");
    const settlementId = assertNonEmptyString(input.settlementId, "journey_settlement_id");
    const projectedAt = assertNonEmptyString(input.projectedAt, "journey_viability_projected_at");
    if (!Number.isFinite(Date.parse(projectedAt))) {
      throw new Error("journey_viability_projected_at_invalid");
    }
    const doubtEvents = input.doubtEvents.map((doubtEvent) => {
      if (doubtEvent.journeyId !== journeyId || doubtEvent.identityId !== agentId) {
        throw new Error("journey_viability_doubt_scope_mismatch");
      }
      return doubtEvent;
    });
    const existingProjection = current.events.find((event): event is Extract<EpochEvent, {
      readonly eventType: "identity_viability_projected";
    }> => event.eventType === "identity_viability_projected"
      && event.payload.sourceSettlementId === settlementId);
    if (existingProjection) {
      if (existingProjection.payload.identityId !== agentId
        || existingProjection.payload.projectedAt !== projectedAt) {
        throw new Error("journey_viability_projection_conflict");
      }
      return {
        events: [],
        value: {
          identityId: existingProjection.payload.identityId,
          before: existingProjection.payload.before,
          after: existingProjection.payload.after,
          deltaBps: existingProjection.payload.deltaBps,
          lifetimeAccelerationBps: existingProjection.payload.lifetimeAccelerationBps,
          socialDeathTriggered: existingProjection.payload.socialDeathTriggered,
          sourceSettlementId: existingProjection.payload.sourceSettlementId,
          policyVersion: existingProjection.payload.policyVersion,
        },
        projection: current,
      };
    }
    const result = projectJourneyIdentityViability(current, {
      agentId,
      journeyId,
      settlementId,
      doubtEvents,
      projectedAt,
    }, {
      ...context,
      trustClass,
    });
    return commit(result.events, result.viabilityProjection);
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
      const existingSettlementId = (existingMarker.payload as { readonly settlementId?: string }).settlementId;
      if (existingSettlementId !== input.settlementId) {
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
    if (!input.settlementId.trim()) {
      throw new Error("journey_settlement_id_required");
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

    // PR2: promote the mirror-consequence ledger. Rebuild canonical events
    // from its entries so downstream region/trace/faction consumers remain
    // agnostic to the source. The ledger is the only source for mirror-world
    // collateral at solidification.
    //
    // Promotion persistence contract: the local ledger rebuilt here is for
    // invariant checking ({@link assertNoDuplicatePromotion}) only. This
    // function does NOT update the caller's persistent ledger projection
    // with promotion records because the journey runtime is a separate
    // aggregate. The caller records the promotion immediately after this
    // result, before recording journey.worldCommit; if a process stops after
    // the canonical marker, replay finds that marker and the idempotent
    // promotion command closes the remaining ledger transition.
    //
    // Crash recovery: the journey_world_solidified marker carries an explicit
    // entryId → canonicalEventId map. Promotion is never reconstructed from
    // array positions because a roleplay doubt and a later viability event
    // need not have a one-to-one positional relationship.
    const mirrorLedgerEntries = input.mirrorLedgerEntries;
    let mirrorLedger: MirrorConsequenceLedgerState | undefined;
    const mirrorLedgerPromotions: { entryId: string; canonicalEventId: string }[] = [];
    const promotedDoubtEvents: NpcDoubtEvent[] = [];
    if (mirrorLedgerEntries.length > 0) {
      // Fast-fail before any canonical events are constructed. Self-loss and
      // NPC-relationship entries are never mirror collateral; physical,
      // hidden-prerequisite, and roleplay entries have explicit promotion
      // paths below.
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
        // standingAfter that action-time capture cannot compute across
        // multiple objectives. Mirror-mode submitHostedAction captures these
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
        mirrorLedgerPromotions.push({ entryId, canonicalEventId: canonicalEvent.eventId });
        workingProjection = applyEvents(workingProjection, [canonicalEvent]);
        if (entry.effectKind === "identity_doubt") {
          promotedDoubtEvents.push(npcDoubtEventFromMirrorEntry({ entryId, entry, journeyId }));
        }
      }
      assertNoDuplicatePromotion(mirrorLedger);

      // PR5c cascade: after promoting object_mutation/object_destroy entries,
      // check if any destroyed object is a hidden prerequisite for an objective
      // in the current journey's plan. If so, emit hidden_prerequisite_link_changed
      // canonical events. The cascade is idempotent — the dedupe key
      // `hidden_prereq:${objectiveId}:${actionEventId}` prevents duplicates.
      const destroyedObjects = new Set<string>();
      for (const [objectId, state] of Object.entries(workingProjection.worldObjectStates)) {
        if (state.status === "destroyed") destroyedObjects.add(objectId);
      }
      if (destroyedObjects.size > 0) {
        for (const evidence of orderedEvidence) {
          const contract = evidence.session.sceneContract as JourneySceneContract;
          const taskObjective = contract.taskObjective;
          if (!taskObjective) continue;
          const hiddenPrereqObjectIds = taskObjective.hiddenPrerequisiteObjectIds ?? [];
          for (const prereqObjectId of hiddenPrereqObjectIds) {
            if (!destroyedObjects.has(prereqObjectId)) continue;
            const dedupeKey = `hidden_prereq:${taskObjective.objectiveId}:${evidence.actionEvent.eventId}`;
            const existingEntryId = deriveMirrorConsequenceEntryId({
              journeyId,
              actionEventId: evidence.actionEvent.eventId,
              dedupeKey,
            });
            // Check if this cascade entry was already promoted (idempotency).
            const alreadyPromoted = mirrorLedger
              ? existingEntryId in mirrorLedger.promotedCanonicalEventIds
              : false;
            if (alreadyPromoted) continue;
            const cascadeEntry: MirrorConsequenceLedgerEntry = {
              actionEventId: evidence.actionEvent.eventId,
              effectKind: "hidden_prerequisite_destroyed",
              targetEntityId: `hidden:${taskObjective.objectiveId}`,
              delta: 0,
              consequenceType: "collateral",
              sourceEventIds: [evidence.actionEvent.eventId],
              effectBlueprint: {
                prerequisiteObjectId: prereqObjectId,
                objectiveId: taskObjective.objectiveId,
                regionId,
              },
              recordedAt: solidifiedAt,
              dedupeKey,
            };
            mirrorLedger = appendMirrorConsequence(mirrorLedger, cascadeEntry);
          }
        }
        // Promote and apply the cascade entries.
        const { entriesToPromote: cascadeEntries } = promoteMirrorConsequences(mirrorLedger);
        for (const entry of cascadeEntries) {
          if (entry.effectKind !== "hidden_prerequisite_destroyed") continue;
          const entryId = deriveMirrorConsequenceEntryId({
            journeyId,
            actionEventId: entry.actionEventId,
            dedupeKey: entry.dedupeKey,
          });
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

    // Viability is projected only after the SettlementDecision has already
    // authorised this solidify and after the mirror effects above have been
    // applied. Its lifetime trigger is deliberately emitted through the
    // future-lifetime path and is never added to the current score inputs.
    const viabilityResult = projectJourneyIdentityViability(
      workingProjection,
      {
        agentId,
        journeyId,
        settlementId: input.settlementId,
        doubtEvents: promotedDoubtEvents,
        projectedAt: solidifiedAt,
      },
      context,
    );
    effectEvents.push(...viabilityResult.events);
    workingProjection = viabilityResult.projection;

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
    const routeIds = uniqueValues(orderedEvidence.flatMap((evidence) => {
      const routeId = evidence.signedAction.routeSelection?.routeId;
      return routeId ? [routeId] : [];
    }));
    const markerPayload: JourneyWorldSolidifiedPayload = {
      schemaVersion: 2,
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
      ...(routeIds.length > 0 ? { routeIds } : {}),
      factionStandings,
      npcRelationships,
      sourceEventIds,
      effectEventIds: effectEvents.map((event) => event.eventId),
      solidifiedAt,
      mirrorLedgerPromotions,
      settlementPolicyVersion: input.settlementPolicyVersion,
      consequenceScorePolicyVersion: input.consequenceScorePolicyVersion,
      canonThresholdBps: input.canonThresholdBps,
      settlementId: input.settlementId,
      consequenceScoreBreakdown: input.consequenceScoreBreakdown,
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
    solidifyJourneyWorld,
    projectJourneySettlementViability,
    queueServerHostedJob,
    canRunServerHostedJobOption,
    completeServerHostedJob,
    skipServerHostedJob,
  };
}
