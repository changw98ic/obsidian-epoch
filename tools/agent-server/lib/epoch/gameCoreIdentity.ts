import type {
  EpochClock,
  EpochCommandContext,
  EpochIdFactory,
  EpochLineageInheritance,
} from "./protocol.ts";
import type { EpochEvent } from "./events.ts";
import type { MutableProjection, EpochProjection } from "./gameCore.ts";
import {
  assertFiniteInteger,
  assertNonEmptyString,
  assertPositiveInteger,
  serverIsoTime,
} from "./protocol.ts";
import { eventFactory } from "./eventFactory.ts";
import {
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
  identitySlotsForExplorer,
  requireActiveIdentity,
  requireIdentity,
  requireIdentitySlot,
  type EpochIdentitySlotState,
} from "./identityProjectionRules.ts";
import {
  assertIdentityOwnerOrSystemWorker,
} from "./identityAuthorizationRules.ts";
import {
  relationshipUpdatedPayload,
} from "./agentInteractionRules.ts";
import {
  uniqueSortedValues,
} from "./loreProvenanceRules.ts";
import {
  initialIdentityViability,
  LIFETIME_REASON_IDENTITY_VIABILITY_ACCELERATION,
  LIFETIME_REASON_IDENTITY_VIABILITY_SOCIAL_DEATH,
} from "./journeyViabilityRules.ts";
import {
  type StrategyProfile,
  AFFINITY_MATRIX_VERSION,
} from "./journeyStrategyRules.ts";
import type { ExpectedLifePattern } from "./journeyRoleplayRules.ts";
import type { IdentityViability } from "./journeyViabilityRules.ts";
import type { IdentityStrategyDisposition } from "./journeyStrategyRules.ts";
import { copyAttributeScores } from "./attributeRules.ts";
import { copyBalance } from "./resourceRules.ts";
import {
  initialActorNeeds,
  initialActorLifeGoal,
  type EpochActorNeedsState,
  type EpochActorLifeGoal,
} from "./actorNeedsRules.ts";

// ---------------------------------------------------------------------------
// Identity types
// ---------------------------------------------------------------------------

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
  readonly strategyDisposition?: IdentityStrategyDisposition;
  readonly expectedLifePattern?: ExpectedLifePattern;
  readonly identityViability?: IdentityViability;
}

export interface EpochAgentPersonality {
  readonly traits: readonly string[];
  readonly driftIds: readonly string[];
  readonly updatedAt?: string;
  readonly latestSourceEventId?: string;
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

export interface IssueIdentityInput {
  readonly explorerId: string;
  readonly explorerSecretHash?: string;
  readonly identityName?: string;
  readonly maxLifetime?: number;
  readonly previousAgentId?: string;
  readonly strategyProfile?: StrategyProfile;
  readonly affinityMatrixVersion?: typeof AFFINITY_MATRIX_VERSION;
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

// ---------------------------------------------------------------------------
// Context interface
// ---------------------------------------------------------------------------

export interface GameCoreIdentityContext {
  readonly projection: () => EpochProjection;
  readonly commit: <T>(events: readonly EpochEvent[], value: T) => { readonly events: readonly EpochEvent[]; readonly value: T; readonly projection: EpochProjection };
  readonly applyEvents: (projection: EpochProjection, events: readonly EpochEvent[]) => EpochProjection;
  readonly clock: EpochClock;
  readonly idFactory: EpochIdFactory;
  readonly defaultLifetime: number;
  readonly identityNameFactory: (input: { explorerId: string; generation: number }) => string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type EpochIdentityStatus = "active" | "archived";

function uniqueSortedStrings(values: readonly (string | undefined)[]): readonly string[] {
  return uniqueSortedValues(values);
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createIdentityCommands(ctx: GameCoreIdentityContext) {
  function identitySlots(input: { readonly explorerId: string }): EpochIdentitySlotState {
    return identitySlotsForExplorer(ctx.projection(), assertNonEmptyString(input.explorerId, "explorer_id"));
  }

  function issueIdentity(input: IssueIdentityInput, context: EpochCommandContext) {
    const current = ctx.projection();
    const explorerId = assertNonEmptyString(input.explorerId, "explorer_id");
    const previousAgentId = input.previousAgentId;
    const previousIdentity = previousAgentId ? requireIdentity(current, previousAgentId) : null;
    if (previousIdentity && previousIdentity.explorerId !== explorerId) throw new Error("identity_lineage_mismatch");
    requireIdentitySlot(current, explorerId);
    const generation = previousIdentity ? previousIdentity.generation + 1 : (current.lineage[explorerId]?.length || 0) + 1;
    const agentId = ctx.idFactory("agent", `${explorerId}:${generation}:${previousAgentId || "root"}`);
    if (current.identities[agentId]) throw new Error("agent_identity_already_exists");
    const maxLifetime = input.maxLifetime ? assertPositiveInteger(input.maxLifetime, "max_lifetime") : ctx.defaultLifetime;
    const startedAt = serverIsoTime(ctx.clock);
    const identityName = input.identityName?.trim() || ctx.identityNameFactory({ explorerId, generation });
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
      makeEvent: eventFactory(ctx.clock, ctx.idFactory, context),
      ...(input.strategyProfile ? { strategyProfile: input.strategyProfile } : {}),
    });
    const nextProjection = ctx.applyEvents(current, nextEvents);
    return ctx.commit(nextEvents, projectIdentityIssue({ events: nextEvents, projection: nextProjection }));
  }

  function rotateExplorerRecovery(
    input: RotateExplorerRecoveryInput,
    context: EpochCommandContext,
  ) {
    const explorerId = assertNonEmptyString(input.explorerId, "explorer_id");
    const explorerSecretHash = assertNonEmptyString(input.explorerSecretHash, "explorer_secret_hash");
    const rotatedAt = serverIsoTime(ctx.clock);
    const nextEvents = planExplorerRecoveryRotationEvents({
      explorerId,
      explorerSecretHash,
      rotatedAt,
      makeEvent: eventFactory(ctx.clock, ctx.idFactory, context),
    });
    return ctx.commit(nextEvents, projectExplorerRecoveryRotation({ events: nextEvents }));
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
    const nextAgentId = ctx.idFactory("agent", `${previousIdentity.explorerId}:${generation}:${previousAgentId}`);
    if (current.identities[nextAgentId]) throw new Error("agent_identity_already_exists");
    const maxLifetime = input.maxLifetime ? assertPositiveInteger(input.maxLifetime, "max_lifetime") : ctx.defaultLifetime;
    const startedAt = serverIsoTime(ctx.clock);
    const identityName = input.identityName?.trim() || ctx.identityNameFactory({
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
      makeEvent: eventFactory(ctx.clock, ctx.idFactory, context),
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
          archivedAt: serverIsoTime(ctx.clock),
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
      makeEvent: eventFactory(ctx.clock, ctx.idFactory, context),
    })];
    if (remaining === 0) {
      nextEvents.push(...reincarnationEvents(ctx.applyEvents(current, nextEvents), agentId, {}, context));
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
      nowMs: ctx.clock().getTime(),
    })) return undefined;
    if (!personalityDriftSourceEvent({ events: current.events, sourceEventId: input.sourceEventId })) return undefined;
    const driftId = ctx.idFactory("personality_drift", `${input.agentId}:${input.trigger}:${input.sourceEventId}`);
    if (current.personalityDrifts[driftId]) return undefined;
    const proposedAt = serverIsoTime(ctx.clock);
    const nextEvents = planPersonalityDriftProposalEvents({
      driftId,
      agentId: input.agentId,
      explorerId: identity.explorerId,
      sourceEventId: input.sourceEventId,
      trigger: input.trigger,
      suggestedTrait: input.suggestedTrait,
      summary: input.summary,
      proposedAt,
      makeEvent: eventFactory(ctx.clock, ctx.idFactory, context),
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
  ) {
    const current = ctx.projection();
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
      confirmedAt: serverIsoTime(ctx.clock),
      makeEvent: eventFactory(ctx.clock, ctx.idFactory, context),
    });
    const nextProjection = ctx.applyEvents(current, nextEvents);
    return ctx.commit(nextEvents, projectPersonalityDriftConfirmation({ events: nextEvents, projection: nextProjection }));
  }

  function adjustLifetime(input: AdjustLifetimeInput, context: EpochCommandContext) {
    const current = ctx.projection();
    const agentId = assertNonEmptyString(input.agentId, "agent_id");
    const identity = requireActiveIdentity(current, agentId);
    assertIdentityOwnerOrSystemWorker(identity, context, "lifetime_adjust_owner_mismatch");
    const delta = assertFiniteInteger(input.delta, "lifetime_delta");
    const reason = assertNonEmptyString(input.reason, "lifetime_reason");
    const nextEvents = lifetimeAdjustmentEvents(current, agentId, delta, reason, input.finalTitle?.trim() || "定档身份", context);
    const nextProjection = ctx.applyEvents(current, nextEvents);
    return ctx.commit(nextEvents, requireIdentity(nextProjection, agentId));
  }

  function archiveIdentity(input: ArchiveIdentityInput, context: EpochCommandContext) {
    const current = ctx.projection();
    const agentId = assertNonEmptyString(input.agentId, "agent_id");
    const identity = requireActiveIdentity(current, agentId);
    assertIdentityOwnerOrSystemWorker(identity, context, "archive_owner_mismatch");
    const nextEvents = planIdentityArchiveEvents({
      agentId,
      archiveReason: assertNonEmptyString(input.archiveReason, "archive_reason"),
      archivedAt: serverIsoTime(ctx.clock),
      finalTitle: input.finalTitle?.trim() || identity.identityName,
      makeEvent: eventFactory(ctx.clock, ctx.idFactory, context),
    });
    const nextProjection = ctx.applyEvents(current, nextEvents);
    return ctx.commit(nextEvents, projectIdentityArchive({ events: nextEvents, projection: nextProjection }));
  }

  function reincarnate(input: ReincarnateInput, context: EpochCommandContext) {
    const current = ctx.projection();
    const previousAgentId = assertNonEmptyString(input.previousAgentId, "previous_agent_id");
    const nextEvents = reincarnationEvents(current, previousAgentId, input, context);
    const nextProjection = ctx.applyEvents(current, nextEvents);
    return ctx.commit(nextEvents, projectIdentityReincarnation({ events: nextEvents, projection: nextProjection }));
  }

  return {
    identitySlots,
    issueIdentity,
    rotateExplorerRecovery,
    reincarnationEvents,
    lifetimeAdjustmentEvents,
    proposePersonalityDriftEvent,
    proposeRelationshipPersonalityDriftEvent,
    confirmPersonalityDrift,
    adjustLifetime,
    archiveIdentity,
    reincarnate,
  };
}

// ---------------------------------------------------------------------------
// Identity domain reducer
// ---------------------------------------------------------------------------

function currentProjectionWorldMinute(projection: EpochProjection): number {
  for (let index = projection.events.length - 1; index >= 0; index -= 1) {
    const event = projection.events[index];
    if (event?.eventType === "world_clock_advanced") return event.payload.toWorldMinute;
  }
  return 0;
}

export function applyIdentityEvent(
  mutable: MutableProjection,
  event: EpochEvent,
  projection: EpochProjection,
): void {
  switch (event.eventType) {
    case "identity_issued": {
      const payload = event.payload;
      const worldMinute = currentProjectionWorldMinute(projection);
      const initialViability = payload.identityViability;
      if (!initialViability) throw new Error("identity_issued_viability_required");
      if (!payload.expectedLifePattern) throw new Error("identity_issued_expected_life_pattern_required");
      mutable.identities[payload.agentId] = {
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
        expectedLifePattern: payload.expectedLifePattern,
        ...(payload.strategyDisposition
          ? { strategyDisposition: payload.strategyDisposition }
          : {}),
      };
      mutable.lineage[payload.explorerId] = [...(mutable.lineage[payload.explorerId] || []), payload.agentId];
      mutable.agentCustody[payload.agentId] = {
        agentId: payload.agentId,
        custodyStatus: "free",
        reason: "identity_issued",
        changedAt: event.createdAt,
      };
      break;
    }
    case "personality_drift_proposed": {
      const payload = event.payload;
      mutable.personalityDrifts[payload.driftId] = {
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
      mutable.personalityDriftIdsByAgent[payload.agentId] = [
        ...(mutable.personalityDriftIdsByAgent[payload.agentId] || []),
        payload.driftId,
      ];
      break;
    }
    case "personality_drift_confirmed": {
      const payload = event.payload;
      const drift = mutable.personalityDrifts[payload.driftId];
      if (!drift) break;
      mutable.personalityDrifts[payload.driftId] = {
        ...drift,
        status: "confirmed",
        confirmedAt: payload.confirmedAt,
        confirmedByExplorerId: payload.confirmedByExplorerId,
      };
      const identity = mutable.identities[payload.agentId];
      if (!identity) break;
      mutable.identities[payload.agentId] = {
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
      const balance = copyAttributeScores(mutable.attributeScores[agentId]);
      balance[event.payload.attributeId] = event.payload.balanceAfter;
      mutable.attributeScores[agentId] = balance;
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
      mutable.identities[event.aggregateId] = {
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
      mutable.identities[payload.identityId] = {
        ...identity,
        identityViability: payload.after,
      };
      break;
    }
    case "identity_archived": {
      const identity = requireIdentity(projection, event.aggregateId);
      mutable.identities[event.aggregateId] = {
        ...identity,
        status: "archived",
        lifetime: {
          ...identity.lifetime,
          remaining: 0,
          archivedAt: event.payload.archivedAt,
          finalTitle: event.payload.finalTitle,
        },
        // PR7: zero viability on archive so stale snapshots do not leak
        // across the identity boundary. The archived identity carries a
        // terminal social-death snapshot — all transient fields
        // (factionStanding, flaggedWanted, doubtedBy, identityExposed) are
        // reset to empty; viabilityScoreBps drops to 0 and status becomes
        // 'social_death'. This mirrors what initialIdentityViability does
        // for fresh identities but with a zero score to reflect terminality.
        identityViability: identity.identityViability
          ? {
              identityId: identity.agentId,
              factionStanding: {},
              flaggedWanted: new Set<string>(),
              identityExposed: false,
              doubtedBy: {},
              viabilityScoreBps: 0,
              status: "social_death",
              policyVersion: identity.identityViability.policyVersion,
              projectedAt: event.payload.archivedAt,
            }
          : undefined,
      };
      break;
    }
    case "agent_custody_changed": {
      mutable.agentCustody[event.payload.agentId] = {
        agentId: event.payload.agentId,
        custodyStatus: event.payload.custodyStatus,
        reason: event.payload.reason,
        changedAt: event.payload.changedAt,
      };
      break;
    }
    case "reincarnation_issued": {
      const previous = requireIdentity(projection, event.payload.previousAgentId);
      mutable.identities[event.payload.previousAgentId] = {
        ...previous,
        nextAgentId: event.payload.nextAgentId,
      };
      break;
    }
    case "resource_granted":
    case "resource_spent": {
      const balance = copyBalance(mutable.resourceBalances[event.aggregateId]);
      balance[event.payload.resourceId] = event.payload.balanceAfter;
      mutable.resourceBalances[event.aggregateId] = balance;
      break;
    }
  }
}
