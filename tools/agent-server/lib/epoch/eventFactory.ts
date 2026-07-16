import {
  createEpochEvent,
  type EpochEvent,
  type EpochEventPayloadMap,
} from "./events.ts";
import {
  serverIsoTime,
  type EpochClock,
  type EpochCommandContext,
  type EpochEventType,
  type EpochIdFactory,
} from "./protocol.ts";

export interface EpochEventFactoryOptions {
  readonly aggregateType?: EpochEvent["aggregateType"];
  readonly agentId?: string;
  readonly eventId?: string;
}

export type EpochEventFactory = <TType extends EpochEventType>(
  eventType: TType,
  aggregateId: string,
  payload: EpochEventPayloadMap[TType],
  options?: EpochEventFactoryOptions,
) => EpochEvent;

export function eventFactory(
  clock: EpochClock,
  idFactory: EpochIdFactory,
  context: EpochCommandContext,
): EpochEventFactory {
  return <TType extends EpochEventType>(
    eventType: TType,
    aggregateId: string,
    payload: EpochEventPayloadMap[TType],
    options: EpochEventFactoryOptions = {},
  ): EpochEvent => createEpochEvent({
    eventType,
    aggregateType: options.aggregateType || "agent_identity",
    aggregateId,
    context,
    createdAt: serverIsoTime(clock),
    idFactory: options.eventId ? (() => options.eventId as string) : idFactory,
    agentId: options.agentId,
    payload,
  }) as EpochEvent;
}
