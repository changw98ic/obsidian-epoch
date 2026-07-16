import type {
  EpochEvent,
  ItemBoundPayload,
  ItemCreatedPayload,
  ItemTransferredPayload,
} from "./events.ts";
import type { EpochEventFactory } from "./eventFactory.ts";

export function itemCreatedEvent(
  makeEvent: EpochEventFactory,
  itemId: string,
  payload: ItemCreatedPayload,
  agentId: string,
): EpochEvent {
  return makeEvent("item_created", itemId, payload, {
    aggregateType: "inventory_item",
    agentId,
  });
}

export function itemBoundEvent(
  makeEvent: EpochEventFactory,
  itemId: string,
  payload: ItemBoundPayload,
  agentId: string,
): EpochEvent {
  return makeEvent("item_bound", itemId, payload, {
    aggregateType: "inventory_item",
    agentId,
  });
}

export function itemTransferredEvent(
  makeEvent: EpochEventFactory,
  itemId: string,
  payload: ItemTransferredPayload,
  agentId: string,
): EpochEvent {
  return makeEvent("item_transferred", itemId, payload, {
    aggregateType: "inventory_item",
    agentId,
  });
}
