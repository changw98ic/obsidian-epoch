import type {
  AttributeGainedPayload,
  EpochEvent,
} from "./events.ts";
import type { EpochEventFactory } from "./eventFactory.ts";
import {
  assertAttributeId,
  assertNonEmptyString,
  assertPositiveInteger,
  type EpochAttributeId,
} from "./protocol.ts";

export type AttributeScoreBalance = Partial<Record<EpochAttributeId, number>>;

export interface AttributeScoreProjection {
  readonly attributeScores: Readonly<Record<string, AttributeScoreBalance>>;
}

export interface AttributeGainInput {
  readonly attributeId: EpochAttributeId;
  readonly amount: number;
  readonly reason: string;
  readonly sourceEventIds?: readonly string[];
}

export interface AttributeGainEventPlanInput {
  readonly projection: AttributeScoreProjection;
  readonly agentId: string;
  readonly attribute: AttributeGainInput;
  readonly makeEvent: EpochEventFactory;
}

export interface AttributeGainEventProjectionInput {
  readonly projection: AttributeScoreProjection;
  readonly events: readonly EpochEvent[];
}

export function copyAttributeScores(
  balance: AttributeScoreBalance | undefined,
): AttributeScoreBalance {
  return balance ? { ...balance } : {};
}

export function currentAttributeScore(
  projection: AttributeScoreProjection,
  agentId: string,
  attributeId: EpochAttributeId,
): number {
  return projection.attributeScores[agentId]?.[attributeId] || 0;
}

function normalizedAttributeGain(input: AttributeGainInput) {
  return {
    attributeId: assertAttributeId(input.attributeId),
    amount: assertPositiveInteger(input.amount, "attribute_amount"),
    reason: assertNonEmptyString(input.reason, "attribute_reason"),
    sourceEventIds: [...new Set((input.sourceEventIds || [])
      .filter((value): value is string => typeof value === "string" && Boolean(value.trim())))],
  };
}

export function attributeGainPayload(
  projection: AttributeScoreProjection,
  agentId: string,
  input: AttributeGainInput,
): AttributeGainedPayload {
  const { attributeId, amount, reason, sourceEventIds } = normalizedAttributeGain(input);
  return {
    attributeId,
    amount,
    reason,
    balanceAfter: currentAttributeScore(projection, agentId, attributeId) + amount,
    sourceEventIds,
  };
}

export function attributeGainedEvent(
  makeEvent: EpochEventFactory,
  agentId: string,
  payload: AttributeGainedPayload,
): EpochEvent {
  return makeEvent("attribute_gained", agentId, payload, {
    aggregateType: "agent_identity",
    agentId,
  });
}

export function planAttributeGainEvents(input: AttributeGainEventPlanInput): readonly EpochEvent[] {
  return [attributeGainedEvent(
    input.makeEvent,
    input.agentId,
    attributeGainPayload(input.projection, input.agentId, input.attribute),
  )];
}

export function projectAttributeGainBalance(
  input: AttributeGainEventProjectionInput,
): AttributeScoreBalance {
  const gained = input.events.find((event) => event.eventType === "attribute_gained");
  if (!gained || gained.eventType !== "attribute_gained") throw new Error("attribute_gained_event_missing");
  return copyAttributeScores(input.projection.attributeScores[gained.agentId || gained.aggregateId]);
}
