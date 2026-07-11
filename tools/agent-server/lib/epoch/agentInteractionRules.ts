import type {
  AgentNpcBondUpdatedPayload,
  DiplomacyProposedPayload,
  DiplomacyRespondedPayload,
  EpochEvent,
  HostedActionRisk,
  NpcLifecycleValue,
  NpcMemoryRecordedPayload,
  RegionInfluenceChangedPayload,
  ResourceSpentPayload,
  RelationshipUpdatedPayload,
  SocialHookCreatedPayload,
  TraceCreatedPayload,
} from "./events.ts";
import type { EpochEventFactory } from "./eventFactory.ts";
import {
  type EpochDiplomacyResponse,
  type EpochNpcRelationshipKind,
  type EpochRelationshipKind,
  stableKey,
} from "./protocol.ts";
import { resourceSpentEvent } from "./resourceLedgerEvents.ts";
import { regionInfluenceChangedEvent, traceCreatedEvent } from "./regionEventLedgerEvents.ts";

export interface EpochNpcTraitSnapshot {
  readonly traits: readonly string[];
}

export interface EpochHostedSessionActionSnapshot {
  readonly socialHookId?: string;
}

export interface EpochHostedSessionSnapshot {
  readonly agentId: string;
  readonly regionId: string;
  readonly actions: readonly EpochHostedSessionActionSnapshot[];
}

export interface EpochHostedSessionProjectionSlice {
  readonly hostedSessions: Readonly<Record<string, EpochHostedSessionSnapshot>>;
}

export interface EpochSocialHookNpcSnapshot {
  readonly displayName: string;
  readonly regionId: string;
}

export interface DiplomacySeedInput {
  readonly regionId: string;
  readonly sourceAgentId: string;
  readonly targetAgentId: string;
  readonly kind: EpochRelationshipKind;
  readonly terms: string;
}

export interface DiplomacyProposedPayloadInput extends DiplomacySeedInput {
  readonly diplomacyId: string;
  readonly sourceExplorerId: string;
  readonly targetExplorerId: string;
  readonly focusSpent: number;
  readonly proposedAt: string;
}

export interface DiplomacyFocusSpendPayloadInput {
  readonly diplomacyId: string;
  readonly focusSpent: number;
  readonly focusBalanceBefore: number;
}

export interface DiplomacyProposalEventsInput extends DiplomacyProposedPayloadInput {
  readonly makeEvent: EpochEventFactory;
  readonly focusBalanceBefore: number;
}

export interface DiplomacyRespondedPayloadInput {
  readonly diplomacyId: string;
  readonly regionId: string;
  readonly sourceAgentId: string;
  readonly sourceExplorerId: string;
  readonly targetAgentId: string;
  readonly targetExplorerId: string;
  readonly kind: EpochRelationshipKind;
  readonly response: EpochDiplomacyResponse;
  readonly focusSpent: number;
  readonly note: string;
  readonly relationshipId?: string;
  readonly respondedAt: string;
}

export interface DiplomacyResponseEventsInput extends DiplomacyRespondedPayloadInput {
  readonly makeEvent: EpochEventFactory;
  readonly responderAgentId: string;
  readonly focusBalanceBefore: number;
}

export interface RelationshipUpdatedPayloadInput {
  readonly relationshipId: string;
  readonly sourceAgentId: string;
  readonly sourceExplorerId: string;
  readonly targetAgentId: string;
  readonly targetExplorerId: string;
  readonly kind: EpochRelationshipKind;
  readonly focusSpent: number;
  readonly previousScore: number;
  readonly reason: string;
  readonly updatedAt: string;
}

export interface RelationshipFocusSpendPayloadInput {
  readonly relationshipId: string;
  readonly focusSpent: number;
  readonly focusBalanceBefore: number;
}

export interface RelationshipUpdateEventsInput extends RelationshipUpdatedPayloadInput {
  readonly makeEvent: EpochEventFactory;
  readonly focusBalanceBefore: number;
}

export interface DiplomacyAcceptedRelationshipTraceEventsInput
  extends Omit<RelationshipUpdatedPayloadInput, "reason" | "updatedAt"> {
  readonly makeEvent: EpochEventFactory;
  readonly traceId: string;
  readonly diplomacyId: string;
  readonly regionId: string;
  readonly respondedEventId: string;
  readonly parentTraceId?: string;
  readonly respondedAt: string;
}

export interface DiplomacyTracePayloadInput {
  readonly traceId: string;
  readonly diplomacyId: string;
  readonly regionId: string;
  readonly sourceAgentId: string;
  readonly sourceExplorerId: string;
  readonly targetAgentId: string;
  readonly targetExplorerId: string;
  readonly kind: EpochRelationshipKind;
  readonly sourceEventIds: readonly string[];
  readonly parentTraceId?: string;
  readonly createdAt: string;
}

export interface AgentNpcBondUpdatedPayloadInput {
  readonly bondId: string;
  readonly agentId: string;
  readonly explorerId: string;
  readonly npcId: string;
  readonly npcRegionId: string;
  readonly kind: EpochNpcRelationshipKind;
  readonly focusSpent: number;
  readonly previousScore: number;
  readonly reason: string;
  readonly updatedAt: string;
}

export interface AgentNpcBondFocusSpendPayloadInput {
  readonly bondId: string;
  readonly focusSpent: number;
  readonly focusBalanceBefore: number;
}

export interface AgentNpcBondUpdateEventsInput extends AgentNpcBondUpdatedPayloadInput {
  readonly makeEvent: EpochEventFactory;
  readonly focusBalanceBefore: number;
}

export interface HostedSocialHookBondPayloadInput {
  readonly bondId: string;
  readonly agentId: string;
  readonly explorerId: string;
  readonly npcId: string;
  readonly npcRegionId: string;
  readonly previousScore: number;
  readonly risk: HostedActionRisk;
  readonly hookId: string;
  readonly updatedAt: string;
}

export interface HostedSocialHookMemoryPayloadInput {
  readonly memoryId: string;
  readonly npcId: string;
  readonly regionId: string;
  readonly npcDisplayName: string;
  readonly identityName: string;
  readonly hookTitle: string;
  readonly risk: HostedActionRisk;
  readonly sourceEventId: string;
  readonly recordedAt: string;
}

export interface HostedSocialHookInfluencePayloadInput {
  readonly influenceId: string;
  readonly regionId: string;
  readonly agentId: string;
  readonly explorerId: string;
  readonly previousInfluenceScore: number;
  readonly risk: HostedActionRisk;
  readonly hookId: string;
  readonly sourceEventId: string;
  readonly sourceAggregateId: string;
  readonly changedAt: string;
}

export type SocialHookDraft = Omit<SocialHookCreatedPayload, "hookId" | "regionId" | "npcId" | "sourceEventIds" | "createdAt">;

export interface SocialHookCreatedPayloadInput {
  readonly hookId: string;
  readonly regionId: string;
  readonly npcId: string;
  readonly draft: SocialHookDraft;
  readonly sourceEventIds: readonly string[];
  readonly createdAt: string;
}

export interface HostedSocialHookSideEffectEventsInput {
  readonly makeEvent: EpochEventFactory;
  readonly bondId: string;
  readonly memoryId: string;
  readonly influenceId: string;
  readonly regionId: string;
  readonly agentId: string;
  readonly explorerId: string;
  readonly npcId: string;
  readonly npcRegionId: string;
  readonly npcDisplayName: string;
  readonly identityName: string;
  readonly hookId: string;
  readonly hookTitle: string;
  readonly risk: HostedActionRisk;
  readonly previousBondScore: number;
  readonly previousInfluenceScore: number;
  readonly sourceEventId: string;
  readonly sourceAggregateId: string;
  readonly recordedAt: string;
}

export function relationshipScoreDelta(kind: EpochRelationshipKind, focusSpent: number): number {
  if (kind === "hostility") return focusSpent * -2;
  if (kind === "alliance") return focusSpent * 2;
  return focusSpent;
}

export function diplomacySeed(input: DiplomacySeedInput): string {
  return `${input.regionId}:${input.kind}:${input.sourceAgentId}:${input.targetAgentId}:${input.terms}`;
}

export function diplomacyProposedPayload(input: DiplomacyProposedPayloadInput): DiplomacyProposedPayload {
  return {
    diplomacyId: input.diplomacyId,
    regionId: input.regionId,
    sourceAgentId: input.sourceAgentId,
    sourceExplorerId: input.sourceExplorerId,
    targetAgentId: input.targetAgentId,
    targetExplorerId: input.targetExplorerId,
    kind: input.kind,
    focusSpent: input.focusSpent,
    terms: input.terms,
    status: "pending",
    proposedAt: input.proposedAt,
  };
}

export function diplomacyProposalFocusSpendPayload(input: DiplomacyFocusSpendPayloadInput): ResourceSpentPayload {
  return {
    resourceId: "focus",
    amount: input.focusSpent,
    reason: `diplomacy_propose:${input.diplomacyId}`,
    balanceAfter: input.focusBalanceBefore - input.focusSpent,
  };
}

export function planDiplomacyProposalEvents(input: DiplomacyProposalEventsInput): readonly EpochEvent[] {
  const focusSpent = resourceSpentEvent(input.makeEvent, input.sourceAgentId, diplomacyProposalFocusSpendPayload({
    diplomacyId: input.diplomacyId,
    focusSpent: input.focusSpent,
    focusBalanceBefore: input.focusBalanceBefore,
  }));
  const proposed = input.makeEvent("diplomacy_proposed", input.diplomacyId, diplomacyProposedPayload(input), {
    aggregateType: "diplomacy",
    agentId: input.sourceAgentId,
  });
  return [focusSpent, proposed];
}

export function diplomacyRespondedPayload(input: DiplomacyRespondedPayloadInput): DiplomacyRespondedPayload {
  return {
    diplomacyId: input.diplomacyId,
    regionId: input.regionId,
    sourceAgentId: input.sourceAgentId,
    sourceExplorerId: input.sourceExplorerId,
    targetAgentId: input.targetAgentId,
    targetExplorerId: input.targetExplorerId,
    kind: input.kind,
    response: input.response,
    status: input.response,
    focusSpent: input.focusSpent,
    note: input.note,
    relationshipId: input.relationshipId,
    respondedAt: input.respondedAt,
  };
}

export function diplomacyResponseFocusSpendPayload(input: DiplomacyFocusSpendPayloadInput): ResourceSpentPayload {
  return {
    resourceId: "focus",
    amount: input.focusSpent,
    reason: `diplomacy_response:${input.diplomacyId}`,
    balanceAfter: input.focusBalanceBefore - input.focusSpent,
  };
}

export function planDiplomacyResponseEvents(input: DiplomacyResponseEventsInput): readonly EpochEvent[] {
  const events: EpochEvent[] = [];
  if (input.focusSpent > 0) {
    events.push(resourceSpentEvent(input.makeEvent, input.responderAgentId, diplomacyResponseFocusSpendPayload({
      diplomacyId: input.diplomacyId,
      focusSpent: input.focusSpent,
      focusBalanceBefore: input.focusBalanceBefore,
    })));
  }
  events.push(input.makeEvent("diplomacy_responded", input.diplomacyId, diplomacyRespondedPayload(input), {
    aggregateType: "diplomacy",
    agentId: input.responderAgentId,
  }));
  return events;
}

export function relationshipUpdatedPayload(input: RelationshipUpdatedPayloadInput): RelationshipUpdatedPayload {
  const scoreDelta = relationshipScoreDelta(input.kind, input.focusSpent);
  return {
    relationshipId: input.relationshipId,
    sourceAgentId: input.sourceAgentId,
    sourceExplorerId: input.sourceExplorerId,
    targetAgentId: input.targetAgentId,
    targetExplorerId: input.targetExplorerId,
    kind: input.kind,
    focusSpent: input.focusSpent,
    previousScore: input.previousScore,
    scoreDelta,
    scoreAfter: input.previousScore + scoreDelta,
    reason: input.reason,
    updatedAt: input.updatedAt,
  };
}

export function relationshipFocusSpendPayload(input: RelationshipFocusSpendPayloadInput): ResourceSpentPayload {
  return {
    resourceId: "focus",
    amount: input.focusSpent,
    reason: `relationship_update:${input.relationshipId}`,
    balanceAfter: input.focusBalanceBefore - input.focusSpent,
  };
}

export function planRelationshipUpdateEvents(input: RelationshipUpdateEventsInput): readonly EpochEvent[] {
  const focusSpent = resourceSpentEvent(input.makeEvent, input.sourceAgentId, relationshipFocusSpendPayload({
    relationshipId: input.relationshipId,
    focusSpent: input.focusSpent,
    focusBalanceBefore: input.focusBalanceBefore,
  }));
  const relationshipUpdated = input.makeEvent("relationship_updated", input.relationshipId, relationshipUpdatedPayload(input), {
    aggregateType: "relationship",
    agentId: input.sourceAgentId,
  });
  return [focusSpent, relationshipUpdated];
}

export function diplomacyTracePayload(input: DiplomacyTracePayloadInput): TraceCreatedPayload {
  return {
    traceId: input.traceId,
    regionId: input.regionId,
    title: `外交链 ${input.diplomacyId}`,
    summary: `${input.targetAgentId} 接受 ${input.sourceAgentId} 的 ${input.kind} 提案。`,
    sourceEventType: "diplomacy_responded",
    sourceEventIds: input.sourceEventIds,
    sourceAggregateId: input.diplomacyId,
    relatedInfluenceIds: [],
    participantAgentIds: uniqueValues([input.sourceAgentId, input.targetAgentId]),
    participantExplorerIds: uniqueValues([input.sourceExplorerId, input.targetExplorerId]),
    parentTraceId: input.parentTraceId,
    createdAt: input.createdAt,
  };
}

export function planDiplomacyAcceptedRelationshipTraceEvents(
  input: DiplomacyAcceptedRelationshipTraceEventsInput,
): readonly EpochEvent[] {
  const relationshipUpdated = input.makeEvent("relationship_updated", input.relationshipId, relationshipUpdatedPayload({
    relationshipId: input.relationshipId,
    sourceAgentId: input.sourceAgentId,
    sourceExplorerId: input.sourceExplorerId,
    targetAgentId: input.targetAgentId,
    targetExplorerId: input.targetExplorerId,
    kind: input.kind,
    focusSpent: input.focusSpent,
    previousScore: input.previousScore,
    reason: `diplomacy_accept:${input.diplomacyId}`,
    updatedAt: input.respondedAt,
  }), {
    aggregateType: "relationship",
    agentId: input.sourceAgentId,
  });
  const tracePayload = diplomacyTracePayload({
    traceId: input.traceId,
    diplomacyId: input.diplomacyId,
    regionId: input.regionId,
    sourceAgentId: input.sourceAgentId,
    sourceExplorerId: input.sourceExplorerId,
    targetAgentId: input.targetAgentId,
    targetExplorerId: input.targetExplorerId,
    kind: input.kind,
    sourceEventIds: [input.respondedEventId, relationshipUpdated.eventId],
    parentTraceId: input.parentTraceId,
    createdAt: input.respondedAt,
  });
  return [relationshipUpdated, traceCreatedEvent(input.makeEvent, input.traceId, tracePayload, input.sourceAgentId)];
}

export const CHILD_NPC_PROTECTED_BOND_KINDS = new Set<EpochNpcRelationshipKind>([
  "enemy",
  "spouse",
  "superior",
  "subordinate",
  "mentor",
  "apprentice",
  "creditor",
  "debtor",
]);

export function isChildNpc(npc: EpochNpcTraitSnapshot): boolean {
  return npc.traits.some((trait) => stableKey(trait) === "child");
}

export function assertChildNpcBondAllowed(npc: EpochNpcTraitSnapshot, kind: EpochNpcRelationshipKind) {
  if (isChildNpc(npc) && CHILD_NPC_PROTECTED_BOND_KINDS.has(kind)) {
    throw new Error("child_npc_protected_relationship_kind");
  }
}

export function agentNpcBondScoreDelta(kind: EpochNpcRelationshipKind, focusSpent: number): number {
  return kind === "enemy" ? focusSpent * -2 : focusSpent * 2;
}

export function agentNpcBondUpdatedPayload(input: AgentNpcBondUpdatedPayloadInput): AgentNpcBondUpdatedPayload {
  const scoreDelta = agentNpcBondScoreDelta(input.kind, input.focusSpent);
  return {
    bondId: input.bondId,
    agentId: input.agentId,
    explorerId: input.explorerId,
    npcId: input.npcId,
    npcRegionId: input.npcRegionId,
    kind: input.kind,
    focusSpent: input.focusSpent,
    previousScore: input.previousScore,
    scoreDelta,
    scoreAfter: input.previousScore + scoreDelta,
    reason: input.reason,
    updatedAt: input.updatedAt,
  };
}

export function agentNpcBondFocusSpendPayload(input: AgentNpcBondFocusSpendPayloadInput): ResourceSpentPayload {
  return {
    resourceId: "focus",
    amount: input.focusSpent,
    reason: `agent_npc_bond:${input.bondId}`,
    balanceAfter: input.focusBalanceBefore - input.focusSpent,
  };
}

export function planAgentNpcBondUpdateEvents(input: AgentNpcBondUpdateEventsInput): readonly EpochEvent[] {
  const focusSpent = resourceSpentEvent(input.makeEvent, input.agentId, agentNpcBondFocusSpendPayload({
    bondId: input.bondId,
    focusSpent: input.focusSpent,
    focusBalanceBefore: input.focusBalanceBefore,
  }));
  const bondUpdated = input.makeEvent("agent_npc_bond_updated", input.bondId, agentNpcBondUpdatedPayload(input), {
    aggregateType: "agent_npc_bond",
    agentId: input.agentId,
  });
  return [focusSpent, bondUpdated];
}

export function hostedSocialHookScoreDelta(risk: HostedActionRisk): number {
  if (risk === "high") return 3;
  if (risk === "medium") return 2;
  return 1;
}

export function socialHookDraftForLifecycle(
  npc: EpochSocialHookNpcSnapshot,
  changes: Readonly<Record<string, NpcLifecycleValue>>,
): SocialHookDraft | null {
  if (typeof changes.relationship_status === "string") {
    return {
      kind: "letter",
      title: `${npc.displayName} 的家庭来信`,
      body: `${npc.displayName} 的伴侣关系刚被服务器记入世界账本，一封私人来信正在等待回应。`,
      actionLabel: "回应家庭来信",
      risk: "medium",
    };
  }
  if (typeof changes.child_id === "string") {
    return {
      kind: "obligation",
      title: `${npc.displayName} 的家庭义务`,
      body: `${npc.displayName} 的家庭新增成员，区域账簿生成了一项需要处理的亲属义务。`,
      actionLabel: "处理家庭义务",
      risk: "medium",
    };
  }
  if (typeof changes.health_status === "string") {
    return {
      kind: "gossip",
      title: `${npc.displayName} 的迁徙传闻`,
      body: `${npc.displayName} 的健康和行踪变化被区域居民议论，可能牵动下一次区域局势。`,
      actionLabel: "追查迁徙传闻",
      risk: "low",
    };
  }
  return null;
}

export function socialHookCreatedPayload(input: SocialHookCreatedPayloadInput): SocialHookCreatedPayload {
  return {
    ...input.draft,
    hookId: input.hookId,
    regionId: input.regionId,
    npcId: input.npcId,
    sourceEventIds: input.sourceEventIds,
    createdAt: input.createdAt,
  };
}

export function hostedSocialHookBondPayload(input: HostedSocialHookBondPayloadInput): AgentNpcBondUpdatedPayload {
  const scoreDelta = hostedSocialHookScoreDelta(input.risk);
  return {
    bondId: input.bondId,
    agentId: input.agentId,
    explorerId: input.explorerId,
    npcId: input.npcId,
    npcRegionId: input.npcRegionId,
    kind: "friend",
    focusSpent: 0,
    previousScore: input.previousScore,
    scoreDelta,
    scoreAfter: input.previousScore + scoreDelta,
    reason: `social_hook:${input.hookId}`,
    updatedAt: input.updatedAt,
  };
}

export function hostedSocialHookMemoryPayload(input: HostedSocialHookMemoryPayloadInput): NpcMemoryRecordedPayload {
  return {
    memoryId: input.memoryId,
    npcId: input.npcId,
    regionId: input.regionId,
    summary: `${input.npcDisplayName} 记住了 ${input.identityName} 处理人物事件“${input.hookTitle}”。`,
    importance: input.risk === "high" ? "high" : "medium",
    sourceEventIds: [input.sourceEventId],
    recordedAt: input.recordedAt,
  };
}

export function hostedSocialHookInfluencePayload(input: HostedSocialHookInfluencePayloadInput): RegionInfluenceChangedPayload {
  const influenceDelta = hostedSocialHookScoreDelta(input.risk);
  return {
    influenceId: input.influenceId,
    regionId: input.regionId,
    agentId: input.agentId,
    explorerId: input.explorerId,
    influenceDelta,
    influenceScoreAfter: input.previousInfluenceScore + influenceDelta,
    reason: `social_hook:${input.hookId}`,
    sourceEventId: input.sourceEventId,
    sourceEventType: "hosted_action_recorded",
    sourceAggregateId: input.sourceAggregateId,
    changedAt: input.changedAt,
  };
}

export function planHostedSocialHookSideEffectEvents(input: HostedSocialHookSideEffectEventsInput): readonly EpochEvent[] {
  const bondPayload = hostedSocialHookBondPayload({
    bondId: input.bondId,
    agentId: input.agentId,
    explorerId: input.explorerId,
    npcId: input.npcId,
    npcRegionId: input.npcRegionId,
    previousScore: input.previousBondScore,
    risk: input.risk,
    hookId: input.hookId,
    updatedAt: input.recordedAt,
  });
  const memoryPayload = hostedSocialHookMemoryPayload({
    memoryId: input.memoryId,
    npcId: input.npcId,
    regionId: input.regionId,
    npcDisplayName: input.npcDisplayName,
    identityName: input.identityName,
    hookTitle: input.hookTitle,
    risk: input.risk,
    sourceEventId: input.sourceEventId,
    recordedAt: input.recordedAt,
  });
  const influencePayload = hostedSocialHookInfluencePayload({
    influenceId: input.influenceId,
    regionId: input.regionId,
    agentId: input.agentId,
    explorerId: input.explorerId,
    previousInfluenceScore: input.previousInfluenceScore,
    risk: input.risk,
    hookId: input.hookId,
    sourceEventId: input.sourceEventId,
    sourceAggregateId: input.sourceAggregateId,
    changedAt: input.recordedAt,
  });

  return [
    input.makeEvent("agent_npc_bond_updated", input.bondId, bondPayload, {
      aggregateType: "agent_npc_bond",
      agentId: input.agentId,
    }),
    input.makeEvent("npc_memory_recorded", input.memoryId, memoryPayload, {
      aggregateType: "npc",
    }),
    regionInfluenceChangedEvent(input.makeEvent, input.regionId, influencePayload, input.agentId),
  ];
}

export function consumedSocialHookIdsForAgentRegion(
  projection: EpochHostedSessionProjectionSlice,
  agentId: string,
  regionId: string,
): ReadonlySet<string> {
  const consumed = new Set<string>();
  for (const session of Object.values(projection.hostedSessions)) {
    if (session.agentId !== agentId || session.regionId !== regionId) continue;
    for (const action of session.actions) {
      if (action.socialHookId) consumed.add(action.socialHookId);
    }
  }
  return consumed;
}

function uniqueValues(values: readonly string[]): string[] {
  return values.filter((value, index) => value && values.indexOf(value) === index);
}
