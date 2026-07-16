export const TRACE_CONFLICT_TYPES = [
  "trap",
  "rumor",
  "false_lead",
  "ward",
] as const;

export type TraceConflictType = typeof TRACE_CONFLICT_TYPES[number];
export type TraceConflictOutcome = "triggered" | "countered" | "expired";
export type TraceConflictStatus = "active" | TraceConflictOutcome;
export type TraceConflictResourceId = "focus" | "aether";

export const TRACE_CONFLICT_TEMPLATE_KEYS = [
  "shadow_snare",
  "whisper_seed",
  "mirrored_tracks",
  "aether_sentinel",
] as const;

export type TraceConflictTemplateKey = typeof TRACE_CONFLICT_TEMPLATE_KEYS[number];

export interface TraceConflictLedgerCost {
  readonly resourceId: TraceConflictResourceId;
  readonly amount: number;
}

export interface TraceConflictServerEffect {
  readonly kind: "turn_pressure" | "misdirection";
  readonly effectKey: string;
  readonly potency: number;
}

export interface TraceConflictRumorMemoryTemplate {
  readonly memoryTemplateKey: string;
  readonly summary: string;
}

interface TraceConflictServerTemplate {
  readonly type: TraceConflictType;
  readonly title: string;
  readonly costs: readonly TraceConflictLedgerCost[];
  readonly cooldownSeconds: number;
  readonly expiresAfterSeconds: number;
  readonly effect?: TraceConflictServerEffect;
  readonly rumorMemory?: TraceConflictRumorMemoryTemplate;
}

const TRACE_CONFLICT_SERVER_TEMPLATES: Readonly<Record<TraceConflictTemplateKey, TraceConflictServerTemplate>> = {
  shadow_snare: {
    type: "trap",
    title: "影索陷阱",
    costs: [{ resourceId: "focus", amount: 2 }],
    cooldownSeconds: 10 * 60,
    expiresAfterSeconds: 30 * 60,
    effect: {
      kind: "turn_pressure",
      effectKey: "shadow_snare_delay",
      potency: 2,
    },
  },
  whisper_seed: {
    type: "rumor",
    title: "耳语种子",
    costs: [
      { resourceId: "focus", amount: 1 },
      { resourceId: "aether", amount: 1 },
    ],
    cooldownSeconds: 5 * 60,
    expiresAfterSeconds: 60 * 60,
    rumorMemory: {
      memoryTemplateKey: "uncorroborated_whisper",
      summary: "一条未经证实的区域耳语，只能作为低置信线索保留。",
    },
  },
  mirrored_tracks: {
    type: "false_lead",
    title: "镜像足迹",
    costs: [
      { resourceId: "focus", amount: 1 },
      { resourceId: "aether", amount: 2 },
    ],
    cooldownSeconds: 10 * 60,
    expiresAfterSeconds: 45 * 60,
    effect: {
      kind: "misdirection",
      effectKey: "mirrored_tracks_detour",
      potency: 2,
    },
  },
  aether_sentinel: {
    type: "ward",
    title: "以太守印",
    costs: [
      { resourceId: "focus", amount: 1 },
      { resourceId: "aether", amount: 2 },
    ],
    cooldownSeconds: 5 * 60,
    expiresAfterSeconds: 60 * 60,
  },
};

export interface TraceConflictTemplateCatalogEntry {
  readonly templateKey: TraceConflictTemplateKey;
  readonly type: TraceConflictType;
  readonly title: string;
  readonly costs: readonly TraceConflictLedgerCost[];
  readonly cooldownSeconds: number;
  readonly expiresAfterSeconds: number;
}

export function traceConflictTemplateCatalog(): readonly TraceConflictTemplateCatalogEntry[] {
  return TRACE_CONFLICT_TEMPLATE_KEYS.map((templateKey) => {
    const template = TRACE_CONFLICT_SERVER_TEMPLATES[templateKey];
    return {
      templateKey,
      type: template.type,
      title: template.title,
      costs: template.costs.map((cost) => ({ ...cost })),
      cooldownSeconds: template.cooldownSeconds,
      expiresAfterSeconds: template.expiresAfterSeconds,
    };
  });
}

export interface TraceConflictAgentIdentity {
  readonly explorerId: string;
  readonly status: "active" | "archived";
}

export interface TraceConflictNpcTarget {
  readonly linkedExplorerId?: string;
  readonly isChild: boolean;
  readonly protectedFromHostileConflict?: boolean;
}

export interface TraceConflictScopeTarget {
  readonly kind: "agent" | "npc";
  readonly id: string;
}

export interface TraceConflictScope {
  readonly regionId?: string;
  readonly target?: TraceConflictScopeTarget;
}

export interface TraceConflictOwnerAuthorization {
  readonly authenticated: boolean;
  readonly actorExplorerId: string;
  readonly authorizedAgentId: string;
}

export interface TraceConflictDeployment {
  readonly traceId: string;
  readonly templateKey: TraceConflictTemplateKey;
  readonly type: TraceConflictType;
  readonly title: string;
  readonly sourceAgentId: string;
  readonly sourceExplorerId: string;
  readonly authorizationMode: "owner_authenticated";
  readonly scope: TraceConflictScope;
  readonly costs: readonly TraceConflictLedgerCost[];
  readonly effect?: TraceConflictServerEffect;
  readonly rumorMemory?: TraceConflictRumorMemoryTemplate;
  readonly status: TraceConflictStatus;
  readonly deployedAt: string;
  readonly expiresAt: string;
  readonly cooldownUntil: string;
  readonly deploymentEventId: string;
  readonly resourceSpendEventIds: readonly string[];
  readonly sourceEventIds: readonly string[];
  readonly auditIds: readonly string[];
  readonly resolvedAt?: string;
  readonly outcomeEventId?: string;
  readonly resolutionAuditId?: string;
  readonly triggeredByTurnCardId?: string;
  readonly counteredByTraceId?: string;
}

export interface TraceConflictProjection {
  readonly identities: Readonly<Record<string, TraceConflictAgentIdentity | undefined>>;
  readonly npcTargets: Readonly<Record<string, TraceConflictNpcTarget | undefined>>;
  readonly resourceBalances: Readonly<
    Record<string, Partial<Record<TraceConflictResourceId, number>> | undefined>
  >;
  readonly deployments: readonly TraceConflictDeployment[];
}

export interface TraceConflictDeploymentServerIds {
  readonly deploymentEventId: string;
  readonly resourceSpendEventIds: Readonly<Partial<Record<TraceConflictResourceId, string>>>;
  readonly auditId: string;
}

export interface PlanTraceConflictDeploymentInput {
  readonly projection: TraceConflictProjection;
  readonly authorization: TraceConflictOwnerAuthorization;
  readonly sourceAgentId: string;
  readonly templateKey: string;
  readonly scope?: TraceConflictScope;
  readonly traceId: string;
  readonly deployedAt: string;
  readonly sourceEventIds: readonly string[];
  readonly serverIds: TraceConflictDeploymentServerIds;
}

export interface TraceConflictResourceSpendPlannedEvent {
  readonly kind: "resource_spent";
  readonly eventId: string;
  readonly traceId: string;
  readonly agentId: string;
  readonly resourceId: TraceConflictResourceId;
  readonly amount: number;
  readonly balanceBefore: number;
  readonly balanceAfter: number;
  readonly reason: string;
  readonly sourceEventIds: readonly string[];
  readonly auditIds: readonly string[];
  readonly plannedAt: string;
}

export interface TraceConflictDeployedPlannedEvent {
  readonly kind: "trace_conflict_deployed";
  readonly eventId: string;
  readonly traceId: string;
  readonly templateKey: TraceConflictTemplateKey;
  readonly type: TraceConflictType;
  readonly sourceAgentId: string;
  readonly sourceExplorerId: string;
  readonly authorizationMode: "owner_authenticated";
  readonly scope: TraceConflictScope;
  readonly costs: readonly TraceConflictLedgerCost[];
  readonly deployedAt: string;
  readonly expiresAt: string;
  readonly cooldownUntil: string;
  readonly sourceEventIds: readonly string[];
  readonly auditIds: readonly string[];
}

export type TraceConflictDeploymentPlannedEvent =
  | TraceConflictResourceSpendPlannedEvent
  | TraceConflictDeployedPlannedEvent;

export interface TraceConflictDeploymentPlan {
  readonly deployment: TraceConflictDeployment;
  readonly events: readonly TraceConflictDeploymentPlannedEvent[];
  readonly balancesAfter: Readonly<Partial<Record<TraceConflictResourceId, number>>>;
}

export interface TraceConflictTurnCardSignal {
  readonly turnCardId: string;
  readonly agentId: string;
  readonly explorerId: string;
  readonly regionId: string;
  readonly target?: TraceConflictScopeTarget;
  readonly sourceEventId: string;
  readonly occurredAt: string;
}

export interface TraceConflictResolutionServerIds {
  readonly outcomeEventId: string;
  readonly auditId: string;
  readonly effectEventId?: string;
  readonly memoryEventId?: string;
}

export interface TraceConflictOutcomePlannedEvent {
  readonly kind: "trace_conflict_outcome";
  readonly eventId: string;
  readonly traceId: string;
  readonly outcome: TraceConflictOutcome;
  readonly triggeredByTurnCardId?: string;
  readonly counteredByTraceId?: string;
  readonly sourceEventIds: readonly string[];
  readonly auditIds: readonly string[];
  readonly resolvedAt: string;
}

export interface TraceConflictEffectPlannedEvent {
  readonly kind: "trace_conflict_effect";
  readonly eventId: string;
  readonly traceId: string;
  readonly targetAgentId: string;
  readonly effect: TraceConflictServerEffect;
  readonly sourceEventIds: readonly string[];
  readonly auditIds: readonly string[];
  readonly plannedAt: string;
}

export interface TraceConflictRumorMemory {
  readonly memoryId: string;
  readonly traceId: string;
  readonly targetAgentId: string;
  readonly targetExplorerId: string;
  readonly regionId: string;
  readonly memoryTemplateKey: string;
  readonly summary: string;
  readonly confidence: "low";
  readonly authority: "low-confidence";
  readonly nonEvidence: true;
  readonly canMutateTruth: false;
  readonly sourceEventIds: readonly string[];
  readonly auditIds: readonly string[];
  readonly recordedAt: string;
}

export interface TraceConflictMemoryPlannedEvent {
  readonly kind: "trace_conflict_memory";
  readonly eventId: string;
  readonly traceId: string;
  readonly memory: TraceConflictRumorMemory;
  readonly sourceEventIds: readonly string[];
  readonly auditIds: readonly string[];
  readonly plannedAt: string;
}

export type TraceConflictResolutionPlannedEvent =
  | TraceConflictOutcomePlannedEvent
  | TraceConflictEffectPlannedEvent
  | TraceConflictMemoryPlannedEvent;

export interface PlanTraceConflictTurnInput {
  readonly projection: Pick<TraceConflictProjection, "identities" | "npcTargets">;
  readonly deployments: readonly TraceConflictDeployment[];
  readonly turnCard: TraceConflictTurnCardSignal;
  readonly serverIdsByTraceId: Readonly<Record<string, TraceConflictResolutionServerIds | undefined>>;
}

export interface TraceConflictTurnPlan {
  readonly deployments: readonly TraceConflictDeployment[];
  readonly events: readonly TraceConflictResolutionPlannedEvent[];
  readonly outcomes: readonly TraceConflictOutcomePlannedEvent[];
  readonly effects: readonly TraceConflictEffectPlannedEvent[];
  readonly memories: readonly TraceConflictRumorMemory[];
}

function requiredString(value: string | undefined, code: string): string {
  const normalized = value?.trim();
  if (!normalized) throw new Error(code);
  return normalized;
}

function requiredDate(value: string, code: string): number {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) throw new Error(code);
  return timestamp;
}

function uniqueRequiredIds(values: readonly string[], code: string): readonly string[] {
  const normalized = [...new Set(values.map((value) => requiredString(value, code)))];
  if (!normalized.length) throw new Error(code);
  return normalized;
}

function copyScope(scope: TraceConflictScope | undefined): TraceConflictScope {
  const regionId = scope?.regionId === undefined
    ? undefined
    : requiredString(scope.regionId, "trace_conflict_region_id_required");
  const target = scope?.target
    ? {
        kind: scope.target.kind,
        id: requiredString(scope.target.id, "trace_conflict_target_id_required"),
      }
    : undefined;
  if (target && target.kind !== "agent" && target.kind !== "npc") {
    throw new Error("trace_conflict_target_kind_invalid");
  }
  return {
    ...(regionId ? { regionId } : {}),
    ...(target ? { target } : {}),
  };
}

function templateForKey(templateKey: string): {
  readonly templateKey: TraceConflictTemplateKey;
  readonly template: TraceConflictServerTemplate;
} {
  const normalized = requiredString(templateKey, "trace_conflict_template_key_required");
  if (!TRACE_CONFLICT_TEMPLATE_KEYS.some((candidate) => candidate === normalized)) {
    throw new Error("trace_conflict_template_unknown");
  }
  const knownKey = normalized as TraceConflictTemplateKey;
  return { templateKey: knownKey, template: TRACE_CONFLICT_SERVER_TEMPLATES[knownKey] };
}

function validateAuthorization(
  projection: TraceConflictProjection,
  authorization: TraceConflictOwnerAuthorization,
  sourceAgentId: string,
): TraceConflictAgentIdentity {
  if (!authorization.authenticated) throw new Error("trace_conflict_owner_auth_required");
  if (authorization.authorizedAgentId !== sourceAgentId) {
    throw new Error("trace_conflict_authorized_agent_mismatch");
  }
  const identity = projection.identities[sourceAgentId];
  if (!identity) throw new Error("trace_conflict_source_identity_not_found");
  if (identity.status !== "active") throw new Error("trace_conflict_source_identity_inactive");
  if (authorization.actorExplorerId !== identity.explorerId) {
    throw new Error("trace_conflict_owner_mismatch");
  }
  return identity;
}

function validateScopeTarget(
  projection: TraceConflictProjection,
  template: TraceConflictServerTemplate,
  scope: TraceConflictScope,
  sourceAgentId: string,
  sourceExplorerId: string,
): void {
  const target = scope.target;
  if (!target) return;
  if (target.kind === "agent") {
    const targetIdentity = projection.identities[target.id];
    if (!targetIdentity) throw new Error("trace_conflict_target_agent_not_found");
    if (template.type !== "ward" && target.id === sourceAgentId) {
      throw new Error("trace_conflict_self_target_forbidden");
    }
    if (template.type !== "ward" && targetIdentity.explorerId === sourceExplorerId) {
      throw new Error("trace_conflict_same_explorer_target_forbidden");
    }
    return;
  }
  const npc = projection.npcTargets[target.id];
  if (!npc) throw new Error("trace_conflict_target_npc_not_found");
  if (npc.isChild) throw new Error("trace_conflict_child_npc_target_forbidden");
  if (template.type !== "ward" && npc.protectedFromHostileConflict) {
    throw new Error("trace_conflict_protected_npc_target_forbidden");
  }
  if (template.type !== "ward" && npc.linkedExplorerId === sourceExplorerId) {
    throw new Error("trace_conflict_same_explorer_target_forbidden");
  }
}

function cooldownRetryAt(
  deployments: readonly TraceConflictDeployment[],
  sourceAgentId: string,
  type: TraceConflictType,
  deployedAtMs: number,
): string | undefined {
  return deployments
    .filter((deployment) => deployment.sourceAgentId === sourceAgentId && deployment.type === type)
    .map((deployment) => deployment.cooldownUntil)
    .filter((cooldownUntil) => requiredDate(
      cooldownUntil,
      "trace_conflict_projection_cooldown_invalid",
    ) > deployedAtMs)
    .sort()
    .at(-1);
}

function isoAfter(timestamp: number, seconds: number): string {
  return new Date(timestamp + seconds * 1_000).toISOString();
}

export function planTraceConflictDeployment(
  input: PlanTraceConflictDeploymentInput,
): TraceConflictDeploymentPlan {
  const sourceAgentId = requiredString(input.sourceAgentId, "trace_conflict_source_agent_id_required");
  const identity = validateAuthorization(input.projection, input.authorization, sourceAgentId);
  const { templateKey, template } = templateForKey(input.templateKey);
  const traceId = requiredString(input.traceId, "trace_conflict_trace_id_required");
  const deployedAtMs = requiredDate(input.deployedAt, "trace_conflict_deployed_at_invalid");
  const deployedAt = new Date(deployedAtMs).toISOString();
  const sourceEventIds = uniqueRequiredIds(
    input.sourceEventIds,
    "trace_conflict_source_event_id_required",
  );
  const deploymentEventId = requiredString(
    input.serverIds.deploymentEventId,
    "trace_conflict_deployment_event_id_required",
  );
  const auditId = requiredString(input.serverIds.auditId, "trace_conflict_audit_id_required");
  if (input.projection.deployments.some((deployment) => deployment.traceId === traceId)) {
    throw new Error("trace_conflict_trace_id_exists");
  }
  const retryAt = cooldownRetryAt(
    input.projection.deployments,
    sourceAgentId,
    template.type,
    deployedAtMs,
  );
  if (retryAt) throw new Error(`trace_conflict_deploy_rate_limited:${retryAt}`);

  const scope = copyScope(input.scope);
  validateScopeTarget(input.projection, template, scope, sourceAgentId, identity.explorerId);

  const balancesBefore = input.projection.resourceBalances[sourceAgentId] || {};
  const balancesAfter: Partial<Record<TraceConflictResourceId, number>> = { ...balancesBefore };
  const spendEvents: TraceConflictResourceSpendPlannedEvent[] = template.costs.map((cost) => {
    const balanceBefore = balancesAfter[cost.resourceId] || 0;
    if (!Number.isFinite(balanceBefore) || balanceBefore < cost.amount) {
      throw new Error(`trace_conflict_resource_insufficient:${cost.resourceId}`);
    }
    const eventId = requiredString(
      input.serverIds.resourceSpendEventIds[cost.resourceId],
      `trace_conflict_${cost.resourceId}_spend_event_id_required`,
    );
    const balanceAfter = balanceBefore - cost.amount;
    balancesAfter[cost.resourceId] = balanceAfter;
    return {
      kind: "resource_spent",
      eventId,
      traceId,
      agentId: sourceAgentId,
      resourceId: cost.resourceId,
      amount: cost.amount,
      balanceBefore,
      balanceAfter,
      reason: `trace_conflict_deploy:${templateKey}:${traceId}`,
      sourceEventIds,
      auditIds: [auditId],
      plannedAt: deployedAt,
    };
  });
  const resourceSpendEventIds = spendEvents.map((event) => event.eventId);
  if (new Set([deploymentEventId, ...resourceSpendEventIds]).size !== resourceSpendEventIds.length + 1) {
    throw new Error("trace_conflict_planned_event_id_duplicate");
  }

  const expiresAt = isoAfter(deployedAtMs, template.expiresAfterSeconds);
  const cooldownUntil = isoAfter(deployedAtMs, template.cooldownSeconds);
  const deployment: TraceConflictDeployment = {
    traceId,
    templateKey,
    type: template.type,
    title: template.title,
    sourceAgentId,
    sourceExplorerId: identity.explorerId,
    authorizationMode: "owner_authenticated",
    scope,
    costs: template.costs.map((cost) => ({ ...cost })),
    ...(template.effect ? { effect: { ...template.effect } } : {}),
    ...(template.rumorMemory ? { rumorMemory: { ...template.rumorMemory } } : {}),
    status: "active",
    deployedAt,
    expiresAt,
    cooldownUntil,
    deploymentEventId,
    resourceSpendEventIds,
    sourceEventIds,
    auditIds: [auditId],
  };
  const deployedEvent: TraceConflictDeployedPlannedEvent = {
    kind: "trace_conflict_deployed",
    eventId: deploymentEventId,
    traceId,
    templateKey,
    type: template.type,
    sourceAgentId,
    sourceExplorerId: identity.explorerId,
    authorizationMode: "owner_authenticated",
    scope,
    costs: deployment.costs,
    deployedAt,
    expiresAt,
    cooldownUntil,
    sourceEventIds: [...sourceEventIds, ...resourceSpendEventIds],
    auditIds: [auditId],
  };
  return {
    deployment,
    events: [...spendEvents, deployedEvent],
    balancesAfter,
  };
}

function scopeMatchesTurn(scope: TraceConflictScope, turnCard: TraceConflictTurnCardSignal): boolean {
  if (scope.regionId && scope.regionId !== turnCard.regionId) return false;
  const target = scope.target;
  if (!target) return true;
  if (target.kind === "agent") {
    return target.id === turnCard.agentId
      || (turnCard.target?.kind === "agent" && target.id === turnCard.target.id);
  }
  return turnCard.target?.kind === "npc" && target.id === turnCard.target.id;
}

function canTriggerForTurn(
  deployment: TraceConflictDeployment,
  turnCard: TraceConflictTurnCardSignal,
  targetsProtectedNpc: boolean,
  occurredAtMs: number,
): boolean {
  return deployment.status === "active"
    && requiredDate(deployment.deployedAt, "trace_conflict_projection_deployed_at_invalid") < occurredAtMs
    && (deployment.type === "ward" || !targetsProtectedNpc)
    && (deployment.type === "ward" || (
      deployment.sourceAgentId !== turnCard.agentId
      && deployment.sourceExplorerId !== turnCard.explorerId
    ))
    && scopeMatchesTurn(deployment.scope, turnCard);
}

function resolutionIds(
  idsByTraceId: Readonly<Record<string, TraceConflictResolutionServerIds | undefined>>,
  traceId: string,
): TraceConflictResolutionServerIds {
  const ids = idsByTraceId[traceId];
  if (!ids) throw new Error(`trace_conflict_resolution_ids_required:${traceId}`);
  requiredString(ids.outcomeEventId, "trace_conflict_outcome_event_id_required");
  requiredString(ids.auditId, "trace_conflict_resolution_audit_id_required");
  return ids;
}

function mergedIds(...groups: readonly (readonly string[])[]): readonly string[] {
  return [...new Set(groups.flat().map((id) => requiredString(id, "trace_conflict_source_id_required")))];
}

function terminalDeployment(
  deployment: TraceConflictDeployment,
  outcome: TraceConflictOutcome,
  ids: TraceConflictResolutionServerIds,
  resolvedAt: string,
  turnCardId?: string,
  counteredByTraceId?: string,
): TraceConflictDeployment {
  return {
    ...deployment,
    status: outcome,
    resolvedAt,
    outcomeEventId: ids.outcomeEventId,
    resolutionAuditId: ids.auditId,
    ...(turnCardId ? { triggeredByTurnCardId: turnCardId } : {}),
    ...(counteredByTraceId ? { counteredByTraceId } : {}),
  };
}

function outcomeEvent(input: {
  readonly deployment: TraceConflictDeployment;
  readonly outcome: TraceConflictOutcome;
  readonly ids: TraceConflictResolutionServerIds;
  readonly resolvedAt: string;
  readonly turnCard?: TraceConflictTurnCardSignal;
  readonly triggeredByTurn: boolean;
  readonly counterparty?: TraceConflictDeployment;
}): TraceConflictOutcomePlannedEvent {
  const counterpartySources = input.counterparty
    ? [input.counterparty.deploymentEventId, ...input.counterparty.sourceEventIds]
    : [];
  return {
    kind: "trace_conflict_outcome",
    eventId: input.ids.outcomeEventId,
    traceId: input.deployment.traceId,
    outcome: input.outcome,
    ...(input.triggeredByTurn && input.turnCard
      ? { triggeredByTurnCardId: input.turnCard.turnCardId }
      : {}),
    ...(input.counterparty ? { counteredByTraceId: input.counterparty.traceId } : {}),
    sourceEventIds: mergedIds(
      [input.deployment.deploymentEventId],
      input.deployment.sourceEventIds,
      input.turnCard ? [input.turnCard.sourceEventId] : [],
      counterpartySources,
    ),
    auditIds: mergedIds(
      input.deployment.auditIds,
      input.counterparty?.auditIds || [],
      [input.ids.auditId],
    ),
    resolvedAt: input.resolvedAt,
  };
}

function wardSpecificity(deployment: TraceConflictDeployment): number {
  return Number(Boolean(deployment.scope.regionId)) + Number(Boolean(deployment.scope.target)) * 2;
}

function byDeploymentOrder(left: TraceConflictDeployment, right: TraceConflictDeployment): number {
  return left.deployedAt.localeCompare(right.deployedAt) || left.traceId.localeCompare(right.traceId);
}

function byWardPriority(left: TraceConflictDeployment, right: TraceConflictDeployment): number {
  return wardSpecificity(right) - wardSpecificity(left) || byDeploymentOrder(left, right);
}

export function planTraceConflictTurn(input: PlanTraceConflictTurnInput): TraceConflictTurnPlan {
  const turnCardId = requiredString(input.turnCard.turnCardId, "trace_conflict_turn_card_id_required");
  const turnAgentId = requiredString(input.turnCard.agentId, "trace_conflict_turn_agent_id_required");
  const turnExplorerId = requiredString(
    input.turnCard.explorerId,
    "trace_conflict_turn_explorer_id_required",
  );
  requiredString(input.turnCard.regionId, "trace_conflict_turn_region_id_required");
  requiredString(input.turnCard.sourceEventId, "trace_conflict_turn_source_event_id_required");
  const occurredAtMs = requiredDate(input.turnCard.occurredAt, "trace_conflict_turn_occurred_at_invalid");
  const occurredAt = new Date(occurredAtMs).toISOString();
  const turnIdentity = input.projection.identities[turnAgentId];
  if (!turnIdentity || turnIdentity.explorerId !== turnExplorerId) {
    throw new Error("trace_conflict_turn_actor_mismatch");
  }
  const turnNpcTarget = input.turnCard.target?.kind === "npc"
    ? input.projection.npcTargets[input.turnCard.target.id]
    : undefined;
  if (input.turnCard.target?.kind === "npc" && !turnNpcTarget) {
    throw new Error("trace_conflict_turn_target_npc_not_found");
  }

  const state = new Map(input.deployments.map((deployment) => [deployment.traceId, deployment]));
  if (state.size !== input.deployments.length) throw new Error("trace_conflict_duplicate_trace_id");
  const events: TraceConflictResolutionPlannedEvent[] = [];
  const outcomes: TraceConflictOutcomePlannedEvent[] = [];
  const effects: TraceConflictEffectPlannedEvent[] = [];
  const memories: TraceConflictRumorMemory[] = [];

  const recordOutcome = (
    deployment: TraceConflictDeployment,
    outcome: TraceConflictOutcome,
    counterparty?: TraceConflictDeployment,
    includeTurn = true,
  ) => {
    const ids = resolutionIds(input.serverIdsByTraceId, deployment.traceId);
    const planned = outcomeEvent({
      deployment,
      outcome,
      ids,
      resolvedAt: occurredAt,
      turnCard: { ...input.turnCard, turnCardId },
      triggeredByTurn: includeTurn,
      ...(counterparty ? { counterparty } : {}),
    });
    state.set(deployment.traceId, terminalDeployment(
      deployment,
      outcome,
      ids,
      occurredAt,
      includeTurn ? turnCardId : undefined,
      counterparty?.traceId,
    ));
    events.push(planned);
    outcomes.push(planned);
    return { ids, planned };
  };

  for (const deployment of [...input.deployments].sort(byDeploymentOrder)) {
    if (deployment.status !== "active") continue;
    if (requiredDate(deployment.expiresAt, "trace_conflict_projection_expiry_invalid") <= occurredAtMs) {
      recordOutcome(deployment, "expired", undefined, false);
    }
  }

  const activeMatching = [...state.values()]
    .filter((deployment) => canTriggerForTurn(
      deployment,
      input.turnCard,
      turnNpcTarget?.isChild === true || turnNpcTarget?.protectedFromHostileConflict === true,
      occurredAtMs,
    ))
    .sort(byDeploymentOrder);
  const wards = activeMatching
    .filter((deployment) => deployment.type === "ward")
    .sort(byWardPriority);
  const consumedWardIds = new Set<string>();

  for (const deployment of activeMatching) {
    if (deployment.type === "ward" || state.get(deployment.traceId)?.status !== "active") continue;
    if (deployment.type === "trap" || deployment.type === "false_lead") {
      const ward = wards.find((candidate) => (
        !consumedWardIds.has(candidate.traceId)
        && state.get(candidate.traceId)?.status === "active"
        && candidate.sourceExplorerId !== deployment.sourceExplorerId
      ));
      if (ward) {
        consumedWardIds.add(ward.traceId);
        recordOutcome(deployment, "countered", ward);
        recordOutcome(ward, "triggered", deployment);
        continue;
      }
    }

    const { ids, planned } = recordOutcome(deployment, "triggered");
    if (deployment.type === "rumor") {
      const rumorMemory = deployment.rumorMemory;
      if (!rumorMemory) throw new Error("trace_conflict_rumor_template_missing");
      const memoryEventId = requiredString(
        ids.memoryEventId,
        "trace_conflict_memory_event_id_required",
      );
      const memory: TraceConflictRumorMemory = {
        memoryId: memoryEventId,
        traceId: deployment.traceId,
        targetAgentId: turnAgentId,
        targetExplorerId: turnExplorerId,
        regionId: input.turnCard.regionId,
        memoryTemplateKey: rumorMemory.memoryTemplateKey,
        summary: rumorMemory.summary,
        confidence: "low",
        authority: "low-confidence",
        nonEvidence: true,
        canMutateTruth: false,
        sourceEventIds: mergedIds(planned.sourceEventIds, [planned.eventId]),
        auditIds: planned.auditIds,
        recordedAt: occurredAt,
      };
      const memoryEvent: TraceConflictMemoryPlannedEvent = {
        kind: "trace_conflict_memory",
        eventId: memoryEventId,
        traceId: deployment.traceId,
        memory,
        sourceEventIds: memory.sourceEventIds,
        auditIds: memory.auditIds,
        plannedAt: occurredAt,
      };
      memories.push(memory);
      events.push(memoryEvent);
      continue;
    }

    const effect = deployment.effect;
    if (!effect) throw new Error("trace_conflict_effect_template_missing");
    const effectEventId = requiredString(
      ids.effectEventId,
      "trace_conflict_effect_event_id_required",
    );
    const effectEvent: TraceConflictEffectPlannedEvent = {
      kind: "trace_conflict_effect",
      eventId: effectEventId,
      traceId: deployment.traceId,
      targetAgentId: turnAgentId,
      effect,
      sourceEventIds: mergedIds(planned.sourceEventIds, [planned.eventId]),
      auditIds: planned.auditIds,
      plannedAt: occurredAt,
    };
    effects.push(effectEvent);
    events.push(effectEvent);
  }

  const plannedEventIds = events.map((event) => event.eventId);
  if (new Set(plannedEventIds).size !== plannedEventIds.length) {
    throw new Error("trace_conflict_planned_event_id_duplicate");
  }

  return {
    deployments: input.deployments.map((deployment) => state.get(deployment.traceId) || deployment),
    events,
    outcomes,
    effects,
    memories,
  };
}
