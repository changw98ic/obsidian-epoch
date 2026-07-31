import type {
  EpochChannelClass,
  EpochClock,
  EpochCommandContext,
  EpochIdFactory,
  EpochNpcRelationshipKind,
  EpochTrustClass,
} from "./protocol.ts";
import {
  assertNonEmptyString,
  serverIsoTime,
} from "./protocol.ts";
import type {
  EpochEvent,
  HostedActionRisk,
  HostedActionRecordedPayload,
  HostedSessionStartedPayload,
  TurnActionOptionPayload,
  TurnCardCreatedPayload,
  TurnResolvedPayload,
} from "./events.ts";
import { eventFactory } from "./eventFactory.ts";
import {
  requireActiveIdentity,
  requireIdentity,
} from "./identityProjectionRules.ts";
import {
  assertIdentityOwner,
  assertUserVerifiedIdentityOwner,
} from "./identityAuthorizationRules.ts";
import {
  currentRegionInfluenceScore,
} from "./regionProjectionRules.ts";
import {
  assertKnownSourceEvents,
  normalizeSourceEventIds,
} from "./sourceEventRules.ts";
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
  requireTurnTrust,
  settledOutcomeSummary,
  settlementPolicy,
  turnActionOptions,
  turnOptionTemplate,
} from "./turnHostedActionRules.ts";
import {
  planTraceConflictDeployment,
  planTraceConflictTurn,
  type TraceConflictDeployment,
  type TraceConflictRumorMemory,
  type TraceConflictScopeTarget,
} from "./traceConflictRules.ts";
import {
  traceConflictMemoryView,
  traceConflictOwnerView,
  traceConflictRegionView,
  type TraceConflictMemoryView,
  type TraceConflictOwnerDeploymentView,
  type TraceConflictRegionView,
} from "./traceConflictReadModel.ts";
import { currentBalance } from "./resourceRules.ts";
import { resourceSpentEvent } from "./resourceLedgerEvents.ts";
import {
  consumedSocialHookIdsForAgentRegion,
  isChildNpc,
  planHostedSocialHookSideEffectEvents,
} from "./agentInteractionRules.ts";
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
import type {
  ConsequenceEffectKind,
  MirrorConsequenceLedgerEntry,
} from "./journeySettlementRules.ts";
import {
  type ApproachTag,
  APPROACH_TAGS,
} from "./journeyStrategyRules.ts";
import type {
  EpochCommandResult,
  EpochHostedActionRecord,
  EpochHostedSession,
  EpochHostedSessionStatus,
  EpochInventoryItem,
  EpochProjection,
  EpochTurnCard,
  EpochTurnCardStatus,
  EpochTurnResolution,
  EpochTurnTraceEffect,
  CreateTurnCardInput,
  DeployTraceConflictInput,
  TraceConflictOwnerViewInput,
  TraceConflictRegionViewInput,
  ResolveTurnCardInput,
  StartHostedSessionInput,
  SubmitHostedActionInput,
} from "./gameCore.ts";
import {
  sourceEventsMentionAgent,
} from "./gameCore.ts";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TURN_CARD_TTL_MS = 15 * 60 * 1000;

// ---------------------------------------------------------------------------
// Module-level helpers (moved from gameCore.ts)
// ---------------------------------------------------------------------------

export function currentProjectionWorldMinute(projection: EpochProjection): number {
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

export function projectTraceConflictState(events: readonly EpochEvent[]): {
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

export function traceConflictRuleProjection(current: EpochProjection) {
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

function collectSceneMissionSanctionedApproaches(
  actionOptions: readonly { readonly approachTags?: readonly ApproachTag[] }[],
): readonly ApproachTag[] {
  const sanctioned = new Set<ApproachTag>();
  for (const option of actionOptions) {
    if (!option.approachTags) continue;
    for (const tag of option.approachTags) {
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

// ---------------------------------------------------------------------------
// Context interface
// ---------------------------------------------------------------------------

export interface GameCoreTurnHostedContext {
  readonly projection: () => EpochProjection;
  readonly commit: <T>(events: readonly EpochEvent[], value: T) => EpochCommandResult<T>;
  readonly applyEvents: (projection: EpochProjection, events: readonly EpochEvent[]) => EpochProjection;
  readonly clock: EpochClock;
  readonly idFactory: EpochIdFactory;
  readonly lifetimeAdjustmentEvents: (
    current: EpochProjection,
    agentId: string,
    delta: number,
    reason: string,
    finalTitle: string,
    context: EpochCommandContext,
    sourceEventId?: string,
  ) => readonly EpochEvent[];
  readonly currentAgentFactionStandingScore: (
    projection: EpochProjection,
    agentId: string,
    factionId: string | undefined,
  ) => number;
  readonly journeyMirrorLedgerSink?: (input: {
    readonly journeyId: string;
    readonly agentId: string;
    readonly expectedVersion: number;
    readonly actionEventId: string;
    readonly entries: readonly MirrorConsequenceLedgerEntry[];
  }) => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createTurnHostedCommands(ctx: GameCoreTurnHostedContext) {

  function ownerTraceConflicts(
    input: TraceConflictOwnerViewInput,
    context: EpochCommandContext,
  ): readonly TraceConflictOwnerDeploymentView[] {
    const current = ctx.projection();
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
    const current = ctx.projection();
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
    const current = ctx.projection();
    const identity = requireIdentity(current, assertNonEmptyString(input.agentId, "agent_id"));
    assertIdentityOwner(identity, context, "trace_conflict_owner_mismatch");
    return traceConflictMemoryView(projectTraceConflictState(current.events), {
      explorerId: identity.explorerId,
      agentId: identity.agentId,
      limit: input.limit,
    });
  }

  function deployTraceConflict(
    input: DeployTraceConflictInput,
    context: EpochCommandContext,
  ): EpochCommandResult<TraceConflictDeployment> {
    const current = ctx.projection();
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
    const deployedAt = serverIsoTime(ctx.clock);
    const traceId = ctx.idFactory("trace", `${agentId}:${input.templateKey}:${deployedAt}`);
    const deploymentEventId = ctx.idFactory("event", `${traceId}:deployed`);
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
          focus: ctx.idFactory("event", `${traceId}:focus`),
          aether: ctx.idFactory("event", `${traceId}:aether`),
        },
        auditId: deploymentEventId,
      },
    });
    const makeEvent = eventFactory(ctx.clock, ctx.idFactory, context);
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
    return ctx.commit(nextEvents, plan.deployment);
  }

  function createTurnCard(input: CreateTurnCardInput, context: EpochCommandContext): EpochCommandResult<EpochTurnCard> {
    const trustClass = requireTurnTrust(context);
    const current = ctx.projection();
    const agentId = assertNonEmptyString(input.agentId, "agent_id");
    const identity = requireActiveIdentity(current, agentId);
    assertUserVerifiedIdentityOwner(identity, context, trustClass, "turn_card_owner_mismatch");
    const regionId = assertNonEmptyString(input.regionId, "region_id");
    const prompt = input.prompt?.trim() || "执行一次区域行动";
    const createdAt = serverIsoTime(ctx.clock);
    const createdAtMs = Date.parse(createdAt);
    const sequence = nextTurnCardSequence(current.turnCards, agentId);
    if (hasOpenTurnCardForAgent(current.turnCards, agentId, createdAtMs)) throw new Error("turn_card_already_open");
    const expiresAt = new Date(Date.parse(createdAt) + TURN_CARD_TTL_MS).toISOString();
    const turnCardId = ctx.idFactory("turn_card", `${regionId}:${agentId}:${prompt}:${createdAt}`);
    const nonce = ctx.idFactory("challenge", `${turnCardId}:${sequence}:${createdAt}`);
    const actionOptions = turnActionOptions(turnCardId, ctx.idFactory, includeHighRiskOptions(current, agentId));
    const visibleContext = {
      regionId,
      prompt,
      identityName: identity.identityName,
    };
    const envelopeId = ctx.idFactory("challenge", `${turnCardId}:${sequence}:${nonce}:${expiresAt}`);
    const turnEvents = planTurnCardCreationEvents({
      makeEvent: eventFactory(ctx.clock, ctx.idFactory, context),
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
      const outcomeEventId = ctx.idFactory("event", `${traceId}:${turnCardId}:outcome`);
      return [traceId, {
        outcomeEventId,
        auditId: outcomeEventId,
        effectEventId: ctx.idFactory("event", `${traceId}:${turnCardId}:effect`),
        memoryEventId: ctx.idFactory("event", `${traceId}:${turnCardId}:memory`),
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
    const traceMakeEvent = eventFactory(ctx.clock, ctx.idFactory, context);
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
    const nextProjection = ctx.applyEvents(current, nextEvents);
    return ctx.commit(nextEvents, nextProjection.turnCards[turnCardId]);
  }

  function resolveTurnCard(input: ResolveTurnCardInput, context: EpochCommandContext): EpochCommandResult<EpochTurnResolution> {
    const trustClass = requireTurnTrust(context);
    const current = ctx.projection();
    const turnCardId = assertNonEmptyString(input.turnCardId, "turn_card_id");
    const card = current.turnCards[turnCardId];
    if (!card) throw new Error("turn_card_not_found");
    if (card.status !== "open") throw new Error("turn_card_not_open");
    if (isTurnCardExpiredAt(card.expiresAt, ctx.clock().getTime())) throw new Error("turn_card_expired");
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
    const resolvedAt = serverIsoTime(ctx.clock);
    const responseEnvelopeId = ctx.idFactory("challenge", `${turnCardId}:${card.sequence}:${actionOptionId}:${resolvedAt}:resolution`);
    const nextEvents = planTurnCardResolutionEvents({
      makeEvent: eventFactory(ctx.clock, ctx.idFactory, context),
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
      lifetimeEventsForDelta: ({ delta, reason, finalTitle, sourceEventId }) =>
        ctx.lifetimeAdjustmentEvents(current, card.agentId, delta, reason, finalTitle, context, sourceEventId),
    });
    const nextProjection = ctx.applyEvents(current, nextEvents);
    const turnResolution = nextProjection.turnCards[turnCardId].resolution;
    if (!turnResolution) throw new Error("turn_resolution_projection_failed");
    return ctx.commit(nextEvents, turnResolution);
  }

  function startHostedSession(input: StartHostedSessionInput, context: EpochCommandContext): EpochCommandResult<EpochHostedSession> {
    const authorityTrustClass = requireHostedTrust(context);
    const current = ctx.projection();
    const agentId = assertNonEmptyString(input.agentId, "agent_id");
    const identity = requireActiveIdentity(current, agentId);
    assertUserVerifiedIdentityOwner(identity, context, authorityTrustClass, "hosted_session_owner_mismatch");
    const regionId = assertNonEmptyString(input.regionId, "region_id");
    const mandate = input.mandate?.trim() || "服务器托管行动";
    const channelClass = input.channelClass === "browser_copy_paste" ? "browser_copy_paste" : "server_hosted";
    const deliveryTrust = deriveHostedDeliveryTrust(channelClass, authorityTrustClass);
    const eventTrustClass = deriveHostedEventTrust(channelClass, authorityTrustClass);
    const startedAt = serverIsoTime(ctx.clock);
    const sessionId = ctx.idFactory("session", `${channelClass}:${regionId}:${agentId}:${mandate}:${startedAt}`);
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
          idFactory: ctx.idFactory,
          socialHooks: regionSocialHooks,
          includeHighRisk: includeHighRiskOptions(current, agentId),
          current,
          agentId,
        });
    const nextEvents = planHostedSessionStartEvents({
      makeEvent: eventFactory(ctx.clock, ctx.idFactory, { ...context, trustClass: eventTrustClass }),
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
    const nextProjection = ctx.applyEvents(current, nextEvents);
    return ctx.commit(nextEvents, nextProjection.hostedSessions[sessionId]);
  }

  function submitHostedAction(input: SubmitHostedActionInput, context: EpochCommandContext): EpochCommandResult<EpochHostedActionRecord> {
    const authorityTrustClass = requireHostedTrust(context);
    const current = ctx.projection();
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
      if (ctx.clock().getTime() > Date.parse(session.sceneContract.expiresAt)) {
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
    const recordedAt = serverIsoTime(ctx.clock);
    const actionId = ctx.idFactory("action", `record:${sessionId}:${actionOptionId}`);
    const responseEnvelopeId = ctx.idFactory("challenge", `${actionId}:${recordedAt}:hosted-action`);
    const makeEvent = eventFactory(ctx.clock, ctx.idFactory, { ...context, trustClass: eventTrustClass });
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
                previousFactionStandingScore: ctx.currentAgentFactionStandingScore(
                  current,
                  session.agentId,
                  signedJourneyAction.routeSelection?.factionObjectId,
                ),
                routeSelection: signedJourneyAction.routeSelection,
                actionEventId: actionRecorded.eventId,
                sourceAggregateId: session.sessionId,
                recordedAt,
            });
              const approachTags = signedJourneyAction.approachTags;
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
                if (!ctx.journeyMirrorLedgerSink) {
                  throw new Error("journey_mirror_ledger_sink_required");
                }
                ctx.journeyMirrorLedgerSink({
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
              idFactory: ctx.idFactory,
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
              previousFactionStandingScore: ctx.currentAgentFactionStandingScore(
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
        const bondId = ctx.idFactory("agent_npc_bond", `${session.agentId}:${hook.npcId}:friend`);
        const previousScore = current.agentNpcBonds[bondId]?.score || 0;
        const memoryId = ctx.idFactory("npc_memory", `${hook.npcId}:${actionId}:social_hook`);
        const influenceId = ctx.idFactory("region_influence", `${hook.regionId}:${session.agentId}:${actionId}:social_hook`);
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
        ctx.lifetimeAdjustmentEvents(current, session.agentId, delta, reason, finalTitle, { ...context, trustClass: eventTrustClass }),
    });
    const nextProjection = ctx.applyEvents(current, nextEvents);
    const recorded = nextProjection.hostedSessions[sessionId].actions.find((action) => action.actionId === actionId);
    if (!recorded) throw new Error("hosted_action_projection_failed");
    return ctx.commit(nextEvents, recorded);
  }

  return {
    ownerTraceConflicts,
    regionTraceConflicts,
    ownerTraceConflictMemories,
    deployTraceConflict,
    createTurnCard,
    resolveTurnCard,
    startHostedSession,
    submitHostedAction,
  };
}
