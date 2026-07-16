import type {
  EpochEvent,
  ResourceGrantedPayload,
  ResourceSpentPayload,
} from "./events.ts";
import type { EpochEventFactory } from "./eventFactory.ts";
import { resourceGrantedEvent, resourceSpentEvent } from "./resourceLedgerEvents.ts";
import {
  assertNonEmptyString,
  assertPositiveInteger,
  assertResourceId,
  type EpochResourceId,
} from "./protocol.ts";

export interface ResourceBalanceProjection {
  readonly resourceBalances: Readonly<Record<string, Partial<Record<EpochResourceId, number>>>>;
}

export interface ResourceRuleInput {
  readonly resourceId: EpochResourceId;
  readonly amount: number;
  readonly reason: string;
}

export interface ResourceEventPlanInput {
  readonly projection: ResourceBalanceProjection;
  readonly agentId: string;
  readonly resource: ResourceRuleInput;
  readonly makeEvent: EpochEventFactory;
}

export interface ResourceEventProjectionInput {
  readonly projection: ResourceBalanceProjection;
  readonly events: readonly EpochEvent[];
}

export interface ResourceSpendCostInput {
  readonly resourceId: EpochResourceId;
  readonly amount: number;
}

export type ResourceSpendReasonFactory = (cost: ResourceSpendCostInput, index: number) => string;

export function copyBalance(
  balance: Partial<Record<EpochResourceId, number>> | undefined,
): Partial<Record<EpochResourceId, number>> {
  return balance ? { ...balance } : {};
}

export function currentBalance(
  projection: ResourceBalanceProjection,
  agentId: string,
  resourceId: EpochResourceId,
): number {
  return projection.resourceBalances[agentId]?.[resourceId] || 0;
}

export function requireResourceBalance(
  projection: ResourceBalanceProjection,
  agentId: string,
  resourceId: EpochResourceId,
  amount: number,
): number {
  const currentAmount = currentBalance(projection, agentId, resourceId);
  if (currentAmount < amount) throw new Error("resource_insufficient");
  return currentAmount;
}

function normalizedResourceRuleInput(input: ResourceRuleInput) {
  return {
    resourceId: assertResourceId(input.resourceId),
    amount: assertPositiveInteger(input.amount, "resource_amount"),
    reason: assertNonEmptyString(input.reason, "resource_reason"),
  };
}

export function resourceGrantPayload(
  projection: ResourceBalanceProjection,
  agentId: string,
  input: ResourceRuleInput,
): ResourceGrantedPayload {
  const { resourceId, amount, reason } = normalizedResourceRuleInput(input);
  return {
    resourceId,
    amount,
    reason,
    balanceAfter: currentBalance(projection, agentId, resourceId) + amount,
  };
}

export function resourceSpendPayload(
  projection: ResourceBalanceProjection,
  agentId: string,
  input: ResourceRuleInput,
): ResourceSpentPayload {
  const { resourceId, amount, reason } = normalizedResourceRuleInput(input);
  const currentAmount = requireResourceBalance(projection, agentId, resourceId, amount);
  return {
    resourceId,
    amount,
    reason,
    balanceAfter: currentAmount - amount,
  };
}

export function planResourceGrantEvents(input: ResourceEventPlanInput): readonly EpochEvent[] {
  return [resourceGrantedEvent(
    input.makeEvent,
    input.agentId,
    resourceGrantPayload(input.projection, input.agentId, input.resource),
  )];
}

export function planResourceSpendEvents(input: ResourceEventPlanInput): readonly EpochEvent[] {
  return [resourceSpentEvent(
    input.makeEvent,
    input.agentId,
    resourceSpendPayload(input.projection, input.agentId, input.resource),
  )];
}

export function projectResourceGrantBalance(
  input: ResourceEventProjectionInput,
): Partial<Record<EpochResourceId, number>> {
  const granted = input.events.find((event) => event.eventType === "resource_granted");
  if (!granted || granted.eventType !== "resource_granted") throw new Error("resource_granted_event_missing");
  return copyBalance(input.projection.resourceBalances[granted.agentId || granted.aggregateId]);
}

export function projectResourceSpendBalance(
  input: ResourceEventProjectionInput,
): Partial<Record<EpochResourceId, number>> {
  const spent = input.events.find((event) => event.eventType === "resource_spent");
  if (!spent || spent.eventType !== "resource_spent") throw new Error("resource_spent_event_missing");
  return copyBalance(input.projection.resourceBalances[spent.agentId || spent.aggregateId]);
}

export function resourceSpendPayloads(
  projection: ResourceBalanceProjection,
  agentId: string,
  costs: readonly ResourceSpendCostInput[],
  reasonForCost: ResourceSpendReasonFactory,
): readonly ResourceSpentPayload[] {
  const balancesAfterSpend = new Map<EpochResourceId, number>();
  return costs.map((cost, index) => {
    const resourceId = assertResourceId(cost.resourceId);
    const amount = assertPositiveInteger(cost.amount, "resource_amount");
    const reason = assertNonEmptyString(
      reasonForCost({ resourceId, amount }, index),
      "resource_reason",
    );
    const currentAmount =
      balancesAfterSpend.get(resourceId) ?? currentBalance(projection, agentId, resourceId);
    if (currentAmount < amount) throw new Error("resource_insufficient");
    const balanceAfter = currentAmount - amount;
    balancesAfterSpend.set(resourceId, balanceAfter);
    return {
      resourceId,
      amount,
      reason,
      balanceAfter,
    };
  });
}
