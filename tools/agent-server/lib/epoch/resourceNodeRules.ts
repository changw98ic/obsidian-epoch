import {
  inventoryEquipmentBonus,
  type EpochInventoryEquipmentBonus,
  type EpochInventoryEquipmentItem,
} from "./inventoryRules.ts";
import {
  type EpochEvent,
  type RegionInfluenceChangedPayload,
  type ResourceGrantedPayload,
  type ResourceNodeContestedPayload,
  type ResourceNodeSettledPayload,
  type ResourceNodeSpawnedPayload,
  type ResourceSpentPayload,
  type TraceCreatedPayload,
} from "./events.ts";
import type { EpochEventFactory } from "./eventFactory.ts";
import { regionInfluenceChangedEvent, traceCreatedEvent } from "./regionEventLedgerEvents.ts";
import { resourceGrantedEvent, resourceSpentEvent } from "./resourceLedgerEvents.ts";
import {
  type EpochIdFactory,
  type EpochResourceId,
  type EpochServerReward,
} from "./protocol.ts";

export const RESOURCE_NODE_STAMINA_SCORE = 2;
export const RESOURCE_NODE_SPAWN_COOLDOWN_SECONDS = 60 * 60;

export interface ResourceNodeInventoryProjectionSlice {
  readonly inventoryItems: Readonly<Record<string, EpochInventoryEquipmentItem | undefined>>;
  readonly inventoryItemIdsByAgent: Readonly<Record<string, readonly string[]>>;
}

export interface ResourceNodeForRules {
  readonly status: string;
  readonly settledAt?: string;
}

export interface ResourceNodeProjectionForRules<TNode extends ResourceNodeForRules = ResourceNodeForRules> {
  readonly resourceNodes: Readonly<Record<string, TNode | undefined>>;
  readonly resourceNodeIdsByRegion: Readonly<Record<string, readonly string[]>>;
}

export interface ResourceNodeStandingLike {
  readonly agentId: string;
  readonly explorerId: string;
  readonly score: number;
}

export interface ResourceNodeSpawnedPayloadInput {
  readonly nodeId: string;
  readonly regionId: string;
  readonly title: string;
  readonly description?: string;
  readonly resourceId: EpochResourceId;
  readonly reward: EpochServerReward;
  readonly spawnedAt: string;
}

export interface ResourceNodeSpawnEventsInput extends ResourceNodeSpawnedPayloadInput {
  readonly makeEvent: EpochEventFactory;
}

export interface ResourceNodeSpawnProjectionInput<TNode extends ResourceNodeForRules> {
  readonly projection: Pick<ResourceNodeProjectionForRules<TNode>, "resourceNodes">;
  readonly events: readonly EpochEvent[];
}

export interface ResourceNodeContestPayloadInput {
  readonly nodeId: string;
  readonly agentId: string;
  readonly explorerId: string;
  readonly staminaSpent: number;
  readonly previousScore: number;
  readonly totalScore: number;
  readonly equipmentScoreBonus: number;
  readonly equipmentItemIds: readonly string[];
  readonly contestedAt: string;
}

export interface ResourceNodeContestStaminaSpendPayloadInput {
  readonly nodeId: string;
  readonly staminaSpent: number;
  readonly staminaBalanceBefore: number;
}

export interface ResourceNodeContestEventsInput {
  readonly nodeId: string;
  readonly agentId: string;
  readonly explorerId: string;
  readonly staminaSpent: number;
  readonly staminaBalanceBefore: number;
  readonly previousScore: number;
  readonly totalScore: number;
  readonly equipmentScoreBonus: number;
  readonly equipmentItemIds: readonly string[];
  readonly contestedAt: string;
  readonly makeEvent: EpochEventFactory;
}

export interface ResourceNodeContestProjectionInput<TNode extends ResourceNodeForRules> {
  readonly projection: Pick<ResourceNodeProjectionForRules<TNode>, "resourceNodes">;
  readonly events: readonly EpochEvent[];
}

export interface ResourceNodeSettlementPayloadInput {
  readonly nodeId: string;
  readonly settledAt: string;
  readonly winner?: ResourceNodeStandingLike;
  readonly reward?: EpochServerReward;
}

export interface ResourceNodeSettlementEventsInput {
  readonly nodeId: string;
  readonly regionId: string;
  readonly nodeTitle: string;
  readonly leaderboard: readonly ResourceNodeStandingLike[];
  readonly reward?: EpochServerReward;
  readonly settledAt: string;
  readonly winnerRewardBalanceBefore: number;
  readonly winnerInfluenceScoreBefore: number;
  readonly parentTraceId?: string;
  readonly idFactory: EpochIdFactory;
  readonly makeEvent: EpochEventFactory;
}

export interface ResourceNodeSettlementProjectionInput<TNode extends ResourceNodeForRules> {
  readonly projection: Pick<ResourceNodeProjectionForRules<TNode>, "resourceNodes">;
  readonly events: readonly EpochEvent[];
}

export interface ResourceNodeSettlementRewardGrantPayloadInput {
  readonly reward: EpochServerReward;
  readonly winnerRewardBalanceBefore: number;
}

export interface ResourceNodeSettlementInfluencePayloadInput {
  readonly influenceId: string;
  readonly regionId: string;
  readonly nodeId: string;
  readonly winner: ResourceNodeStandingLike;
  readonly currentInfluenceScore: number;
  readonly sourceEventId: string;
  readonly changedAt: string;
}

export interface ResourceNodeSettlementTracePayloadInput {
  readonly traceId: string;
  readonly regionId: string;
  readonly nodeId: string;
  readonly nodeTitle: string;
  readonly winner: ResourceNodeStandingLike;
  readonly leaderboard: readonly ResourceNodeStandingLike[];
  readonly settledEventId: string;
  readonly influenceEventId: string;
  readonly influenceId: string;
  readonly parentTraceId?: string;
  readonly createdAt: string;
}

export function resourceNodeBaseScoreDelta(staminaSpent: number): number {
  return staminaSpent * RESOURCE_NODE_STAMINA_SCORE;
}

export function resourceNodeSpawnCooldownRemainingSeconds(
  nextSpawnedAtIso: string,
  latestSettledAtIso: string | undefined,
): number {
  if (!latestSettledAtIso) return 0;
  const elapsedSeconds = Math.floor((Date.parse(nextSpawnedAtIso) - Date.parse(latestSettledAtIso)) / 1_000);
  return Math.max(0, RESOURCE_NODE_SPAWN_COOLDOWN_SECONDS - elapsedSeconds);
}

export function requireResourceNode<TNode extends ResourceNodeForRules>(
  projection: Pick<ResourceNodeProjectionForRules<TNode>, "resourceNodes">,
  nodeId: string,
): TNode {
  const node = projection.resourceNodes[nodeId];
  if (!node) throw new Error("resource_node_not_found");
  return node;
}

export function requireOpenResourceNode<TNode extends ResourceNodeForRules>(
  projection: Pick<ResourceNodeProjectionForRules<TNode>, "resourceNodes">,
  nodeId: string,
): TNode {
  const node = requireResourceNode(projection, nodeId);
  if (node.status !== "open") throw new Error("resource_node_not_open");
  return node;
}

export function openResourceNodeForRegion<TNode extends ResourceNodeForRules>(
  projection: ResourceNodeProjectionForRules<TNode>,
  regionId: string,
): TNode | undefined {
  return (projection.resourceNodeIdsByRegion[regionId] || [])
    .map((nodeId) => projection.resourceNodes[nodeId])
    .find((node): node is TNode => {
      if (!node) return false;
      return node.status === "open";
    });
}

export function latestResourceNodeSettlementAt(
  projection: ResourceNodeProjectionForRules,
  regionId: string,
): string | undefined {
  return (projection.resourceNodeIdsByRegion[regionId] || [])
    .map((nodeId) => projection.resourceNodes[nodeId]?.settledAt)
    .filter((settledAt): settledAt is string => Boolean(settledAt))
    .sort((left, right) => right.localeCompare(left))[0];
}

export function resourceNodeEquipmentBonus(
  projection: ResourceNodeInventoryProjectionSlice,
  agentId: string,
): EpochInventoryEquipmentBonus {
  const itemIds = projection.inventoryItemIdsByAgent[agentId] || [];
  const items = itemIds
    .map((itemId) => projection.inventoryItems[itemId])
    .filter((item): item is EpochInventoryEquipmentItem => Boolean(item));
  return inventoryEquipmentBonus(items);
}

export function resourceNodeSpawnedPayload(input: ResourceNodeSpawnedPayloadInput): ResourceNodeSpawnedPayload {
  return {
    nodeId: input.nodeId,
    regionId: input.regionId,
    title: input.title,
    description: input.description?.trim() || "区域资源点",
    resourceId: input.resourceId,
    reward: input.reward,
    spawnedAt: input.spawnedAt,
  };
}

export function planResourceNodeSpawnEvents(input: ResourceNodeSpawnEventsInput): readonly EpochEvent[] {
  const payload = resourceNodeSpawnedPayload({
    nodeId: input.nodeId,
    regionId: input.regionId,
    title: input.title,
    description: input.description,
    resourceId: input.resourceId,
    reward: input.reward,
    spawnedAt: input.spawnedAt,
  });
  return [input.makeEvent("resource_node_spawned", input.nodeId, payload, {
    aggregateType: "resource_node",
  })];
}

export function projectResourceNodeSpawn<TNode extends ResourceNodeForRules>(
  input: ResourceNodeSpawnProjectionInput<TNode>,
): TNode {
  const spawned = input.events.find((event) => event.eventType === "resource_node_spawned");
  if (!spawned || spawned.eventType !== "resource_node_spawned") {
    throw new Error("resource_node_spawned_event_missing");
  }
  const node = input.projection.resourceNodes[spawned.payload.nodeId];
  if (!node) throw new Error("resource_node_projection_failed");
  return node;
}

export function resourceNodeContestPayload(input: ResourceNodeContestPayloadInput): ResourceNodeContestedPayload {
  const baseScoreDelta = resourceNodeBaseScoreDelta(input.staminaSpent);
  const scoreDelta = baseScoreDelta + input.equipmentScoreBonus;
  return {
    nodeId: input.nodeId,
    agentId: input.agentId,
    explorerId: input.explorerId,
    staminaSpent: input.staminaSpent,
    baseScoreDelta,
    equipmentScoreBonus: input.equipmentScoreBonus,
    equipmentItemIds: input.equipmentItemIds,
    scoreDelta,
    agentScoreAfter: input.previousScore + scoreDelta,
    totalScoreAfter: input.totalScore + scoreDelta,
    contestedAt: input.contestedAt,
  };
}

export function resourceNodeContestStaminaSpendPayload(
  input: ResourceNodeContestStaminaSpendPayloadInput,
): ResourceSpentPayload {
  return {
    resourceId: "stamina",
    amount: input.staminaSpent,
    reason: `resource_node_contest:${input.nodeId}`,
    balanceAfter: input.staminaBalanceBefore - input.staminaSpent,
  };
}

export function planResourceNodeContestEvents(input: ResourceNodeContestEventsInput): readonly EpochEvent[] {
  const spent = resourceSpentEvent(input.makeEvent, input.agentId, resourceNodeContestStaminaSpendPayload({
    nodeId: input.nodeId,
    staminaSpent: input.staminaSpent,
    staminaBalanceBefore: input.staminaBalanceBefore,
  }));
  const contestedPayload = resourceNodeContestPayload({
    nodeId: input.nodeId,
    agentId: input.agentId,
    explorerId: input.explorerId,
    staminaSpent: input.staminaSpent,
    equipmentScoreBonus: input.equipmentScoreBonus,
    equipmentItemIds: input.equipmentItemIds,
    previousScore: input.previousScore,
    totalScore: input.totalScore,
    contestedAt: input.contestedAt,
  });
  const contested = input.makeEvent("resource_node_contested", input.nodeId, contestedPayload, {
    aggregateType: "resource_node",
    agentId: input.agentId,
  });
  return [spent, contested];
}

export function projectResourceNodeContest<TNode extends ResourceNodeForRules>(
  input: ResourceNodeContestProjectionInput<TNode>,
): TNode {
  const contested = input.events.find((event) => event.eventType === "resource_node_contested");
  if (!contested || contested.eventType !== "resource_node_contested") {
    throw new Error("resource_node_contested_event_missing");
  }
  const node = input.projection.resourceNodes[contested.payload.nodeId];
  if (!node) throw new Error("resource_node_projection_failed");
  return node;
}

export function resourceNodeSettlementPayload(
  input: ResourceNodeSettlementPayloadInput,
): ResourceNodeSettledPayload {
  return {
    nodeId: input.nodeId,
    settledAt: input.settledAt,
    winnerAgentId: input.winner?.agentId,
    winnerExplorerId: input.winner?.explorerId,
    winningScore: input.winner?.score || 0,
    reward: input.winner ? input.reward : undefined,
  };
}

export function planResourceNodeSettlementEvents(input: ResourceNodeSettlementEventsInput): readonly EpochEvent[] {
  const winner = input.leaderboard[0];
  const settledPayload = resourceNodeSettlementPayload({
    nodeId: input.nodeId,
    settledAt: input.settledAt,
    winner,
    reward: input.reward,
  });
  const settled = input.makeEvent("resource_node_settled", input.nodeId, settledPayload, {
    aggregateType: "resource_node",
  });
  const nextEvents: EpochEvent[] = [settled];
  const reward = settledPayload.reward;
  if (winner && reward) {
    nextEvents.push(resourceGrantedEvent(input.makeEvent, winner.agentId, resourceNodeSettlementRewardGrantPayload({
      reward,
      winnerRewardBalanceBefore: input.winnerRewardBalanceBefore,
    })));
    const influenceId = input.idFactory("region_influence", `${input.regionId}:${input.nodeId}:${winner.agentId}:resource_node`);
    const influencePayload = resourceNodeSettlementInfluencePayload({
      influenceId,
      regionId: input.regionId,
      nodeId: input.nodeId,
      winner,
      currentInfluenceScore: input.winnerInfluenceScoreBefore,
      sourceEventId: settled.eventId,
      changedAt: settledPayload.settledAt,
    });
    const influenceChanged = regionInfluenceChangedEvent(input.makeEvent, input.regionId, influencePayload, winner.agentId);
    nextEvents.push(influenceChanged);
    const traceId = input.idFactory("trace", `${input.regionId}:${input.nodeId}:resource_node`);
    const tracePayload = resourceNodeSettlementTracePayload({
      traceId,
      regionId: input.regionId,
      nodeId: input.nodeId,
      nodeTitle: input.nodeTitle,
      winner,
      leaderboard: input.leaderboard,
      settledEventId: settled.eventId,
      influenceEventId: influenceChanged.eventId,
      influenceId,
      parentTraceId: input.parentTraceId,
      createdAt: settledPayload.settledAt,
    });
    nextEvents.push(traceCreatedEvent(input.makeEvent, traceId, tracePayload, winner.agentId));
  }
  return nextEvents;
}

export function projectResourceNodeSettlement<TNode extends ResourceNodeForRules>(
  input: ResourceNodeSettlementProjectionInput<TNode>,
): TNode {
  const settled = input.events.find((event) => event.eventType === "resource_node_settled");
  if (!settled || settled.eventType !== "resource_node_settled") {
    throw new Error("resource_node_settled_event_missing");
  }
  const node = input.projection.resourceNodes[settled.payload.nodeId];
  if (!node) throw new Error("resource_node_projection_failed");
  return node;
}

export function resourceNodeSettlementRewardGrantPayload(
  input: ResourceNodeSettlementRewardGrantPayloadInput,
): ResourceGrantedPayload {
  return {
    resourceId: input.reward.resourceId,
    amount: input.reward.amount,
    reason: input.reward.reason,
    balanceAfter: input.winnerRewardBalanceBefore + input.reward.amount,
  };
}

export function resourceNodeSettlementInfluencePayload(
  input: ResourceNodeSettlementInfluencePayloadInput,
): RegionInfluenceChangedPayload {
  return {
    influenceId: input.influenceId,
    regionId: input.regionId,
    agentId: input.winner.agentId,
    explorerId: input.winner.explorerId,
    influenceDelta: input.winner.score,
    influenceScoreAfter: input.currentInfluenceScore + input.winner.score,
    reason: `resource_node_settlement:${input.nodeId}`,
    sourceEventId: input.sourceEventId,
    sourceEventType: "resource_node_settled",
    sourceAggregateId: input.nodeId,
    changedAt: input.changedAt,
  };
}

export function resourceNodeSettlementTracePayload(
  input: ResourceNodeSettlementTracePayloadInput,
): TraceCreatedPayload {
  return {
    traceId: input.traceId,
    regionId: input.regionId,
    title: `${input.nodeTitle}结算`,
    summary: `${input.winner.agentId} 在 ${input.nodeTitle} 中以 ${input.winner.score} 分取得资源点。`,
    sourceEventType: "resource_node_settled",
    sourceEventIds: [input.settledEventId, input.influenceEventId],
    sourceAggregateId: input.nodeId,
    relatedInfluenceIds: [input.influenceId],
    participantAgentIds: uniqueValues(input.leaderboard.map((standing) => standing.agentId)),
    participantExplorerIds: uniqueValues(input.leaderboard.map((standing) => standing.explorerId)),
    parentTraceId: input.parentTraceId,
    createdAt: input.createdAt,
  };
}

function uniqueValues(values: readonly string[]): string[] {
  return values.filter((value, index) => value && values.indexOf(value) === index);
}
