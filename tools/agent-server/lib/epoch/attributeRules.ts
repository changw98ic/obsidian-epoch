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

export type AttributeEvidenceKind =
  | "attribute_evidence"
  | "cultivation_breakthrough"
  | "validated_conversion";

export type AttributeProgressionAuthority =
  | "attribute_evidence"
  | "cultivation_breakthrough"
  | "validated_conversion";

export interface AttributeScoreProjection {
  readonly attributeScores: Readonly<Record<string, AttributeScoreBalance>>;
}

export interface AttributeGainInput {
  readonly attributeId: EpochAttributeId;
  readonly amount: number;
  readonly reason: string;
  readonly sourceEventIds: readonly string[];
  readonly evidenceKind: AttributeEvidenceKind;
  readonly progressionAuthority: AttributeProgressionAuthority;
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
  if (!Array.isArray(input.sourceEventIds)) {
    throw new Error("attribute_gain_source_event_required");
  }
  const sourceEventIds = [...new Set(input.sourceEventIds
    .filter((value): value is string => typeof value === "string" && Boolean(value.trim())))];
  return {
    attributeId: assertAttributeId(input.attributeId),
    amount: assertPositiveInteger(input.amount, "attribute_amount"),
    reason: assertNonEmptyString(input.reason, "attribute_reason"),
    sourceEventIds,
    evidenceKind: assertAttributeEvidenceKind(input.evidenceKind),
    progressionAuthority: assertAttributeProgressionAuthority(input.progressionAuthority),
  };
}

function assertGroundedAttributeGain(input: ReturnType<typeof normalizedAttributeGain>) {
  if (!input.sourceEventIds.length) {
    throw new Error("attribute_gain_source_event_required");
  }
}

function assertAttributeEvidenceKind(input: unknown): AttributeEvidenceKind {
  if (
    input === "attribute_evidence"
    || input === "cultivation_breakthrough"
    || input === "validated_conversion"
  ) {
    return input;
  }
  throw new Error("attribute_gain_evidence_kind_invalid");
}

function assertAttributeProgressionAuthority(
  input: unknown,
): AttributeProgressionAuthority {
  if (
    input === "attribute_evidence"
    || input === "cultivation_breakthrough"
    || input === "validated_conversion"
  ) {
    return input;
  }
  throw new Error("attribute_gain_progression_authority_invalid");
}

export function attributeGainPayload(
  projection: AttributeScoreProjection,
  agentId: string,
  input: AttributeGainInput,
): AttributeGainedPayload {
  const {
    attributeId,
    amount,
    reason,
    sourceEventIds,
    evidenceKind,
    progressionAuthority,
  } = normalizedAttributeGain(input);
  assertGroundedAttributeGain({
    attributeId,
    amount,
    reason,
    sourceEventIds,
    evidenceKind,
    progressionAuthority,
  });
  const payload = {
    attributeId,
    amount,
    reason,
    balanceAfter: currentAttributeScore(projection, agentId, attributeId) + amount,
    sourceEventIds,
    evidenceKind,
    progressionAuthority,
  };
  return payload;
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
