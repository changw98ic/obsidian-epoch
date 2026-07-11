import {
  type EpochProjection,
} from "./gameCore.ts";
import { type EpochEventType } from "./protocol.ts";
import { canonicalRegionIdFromInput } from "./runtimeInputRules.ts";
import {
  latestEvents,
  progressView,
  type EpochClaimableLegendNewsInfo,
  type EpochEquipmentEffectInfo,
  type EpochInventoryItemInfo,
  type EpochPendingDowntimePreviewInfo,
  type EpochProgressView,
} from "./progressReadModel.ts";
import {
  messagesView,
  type EpochMessagesInfo,
  type EpochRegionActiveAgent,
} from "./regionActivityReadModel.ts";

export type {
  EpochClaimableLegendNewsInfo,
  EpochEquipmentEffectInfo,
  EpochInventoryItemInfo,
  EpochPendingDowntimePreviewInfo,
  EpochProgressView,
} from "./progressReadModel.ts";
export type { EpochMessagesInfo, EpochRegionActiveAgent } from "./regionActivityReadModel.ts";

type ReadInput = Record<string, unknown>;

export interface EpochEventsInfo {
  readonly events: readonly EpochProjection["events"][number][];
}

export interface EpochProgressRuntimeOptions {
  readonly now: string;
  readonly maxDowntimeSeconds?: number;
}

function inputString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function optionalNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

export function eventsInfoView(projection: EpochProjection, input: ReadInput = {}): EpochEventsInfo {
  return {
    events: latestEvents(projection, {
      agentId: inputString(input.agentId),
      eventType: inputString(input.eventType) as EpochEventType | undefined,
      limit: Number(input.limit || 50),
    }),
  };
}

export function progressInfoView(
  projection: EpochProjection,
  input: ReadInput = {},
  options: EpochProgressRuntimeOptions,
): EpochProgressView {
  return progressView(projection, {
    agentId: inputString(input.agentId),
    explorerId: inputString(input.explorerId),
    limit: Number(input.limit || 20),
    now: options.now,
    maxDowntimeSeconds: options.maxDowntimeSeconds,
  });
}

export function messagesInfoView(projection: EpochProjection, input: ReadInput = {}): EpochMessagesInfo {
  return {
    ...messagesView(projection, {
      regionId: canonicalRegionIdFromInput(input.regionId),
      agentId: inputString(input.agentId),
      limit: optionalNumber(input.limit),
    }),
    regionId: inputString(input.regionId),
  };
}
