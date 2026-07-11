import type {
  EpochEvent,
  RegionInfluenceChangedPayload,
  TraceCreatedPayload,
} from "./events.ts";
import type { EpochEventFactory } from "./eventFactory.ts";

export function regionInfluenceChangedEvent(
  makeEvent: EpochEventFactory,
  regionId: string,
  payload: RegionInfluenceChangedPayload,
  agentId: string,
): EpochEvent {
  return makeEvent("region_influence_changed", regionId, payload, {
    aggregateType: "region",
    agentId,
  });
}

export function traceCreatedEvent(
  makeEvent: EpochEventFactory,
  traceId: string,
  payload: TraceCreatedPayload,
  agentId: string,
): EpochEvent {
  return makeEvent("trace_created", traceId, payload, {
    aggregateType: "trace",
    agentId,
  });
}
