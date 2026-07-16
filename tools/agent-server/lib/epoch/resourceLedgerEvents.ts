import type {
  EpochEvent,
  ResourceGrantedPayload,
  ResourceSpentPayload,
} from "./events.ts";
import type { EpochEventFactory, EpochEventFactoryOptions } from "./eventFactory.ts";

type ResourceLedgerEventOptions = Pick<EpochEventFactoryOptions, "eventId">;

export function resourceGrantedEvent(
  makeEvent: EpochEventFactory,
  agentId: string,
  payload: ResourceGrantedPayload,
  options: ResourceLedgerEventOptions = {},
): EpochEvent {
  return makeEvent("resource_granted", agentId, payload, {
    aggregateType: "resource_account",
    agentId,
    ...options,
  });
}

export function resourceSpentEvent(
  makeEvent: EpochEventFactory,
  agentId: string,
  payload: ResourceSpentPayload,
  options: ResourceLedgerEventOptions = {},
): EpochEvent {
  return makeEvent("resource_spent", agentId, payload, {
    aggregateType: "resource_account",
    agentId,
    ...options,
  });
}

export function resourceSpentEvents(
  makeEvent: EpochEventFactory,
  agentId: string,
  payloads: readonly ResourceSpentPayload[],
): readonly EpochEvent[] {
  return payloads.map((payload) => resourceSpentEvent(makeEvent, agentId, payload));
}
