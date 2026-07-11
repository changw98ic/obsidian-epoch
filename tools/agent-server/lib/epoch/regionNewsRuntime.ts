import { resolveEpochCanonicalRegionId } from "../regionAliases.ts";
import type { EpochEvent } from "./events.ts";
import type {
  EpochCommandContext,
  EpochEventType,
} from "./protocol.ts";
import { assertNonEmptyString } from "./protocol.ts";
import type {
  EpochCommandResult,
  EpochProjection,
  EpochRegionNews,
  GenerateRegionNewsInput,
} from "./gameCore.ts";
import { canonicalRegionIdFromInput } from "./runtimeInputRules.ts";
import type { EpochRuntimeResult } from "./runtimePublicProjectionRules.ts";
import { regionNewsDraftForEvent, regionNewsEventRegionId } from "./regionNewsDraftRules.ts";

type AnyRecord = Record<string, unknown>;

export interface RegionNewsRuntimeOptions {
  readonly project: () => EpochProjection;
  readonly generateRegionNews: (
    input: GenerateRegionNewsInput,
    context: EpochCommandContext,
  ) => EpochRuntimeResult<EpochRegionNews>;
}

export interface RegionNewsRuntime {
  readonly generateRegionNews: (input?: AnyRecord) => EpochRuntimeResult<EpochRegionNews>;
  readonly generateRegionNewsForServerEvent: (
    sourceEvent: EpochEvent,
    input: AnyRecord,
    idempotencyKey: string,
  ) => EpochRuntimeResult<EpochRegionNews> | null;
  readonly appendRegionNewsForServerEvent: <TValue>(
    result: EpochRuntimeResult<TValue>,
    input: AnyRecord,
    eventType: EpochEventType,
    idempotencyKey: string,
  ) => EpochRuntimeResult<TValue>;
}

function optionalString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function existingNewsForSource(
  projection: EpochProjection,
  regionId: string,
  sourceEventId: string,
): EpochCommandResult<EpochRegionNews> | undefined {
  const existing = (projection.regionNews[regionId] || []).find((news) => news.sourceEventIds.includes(sourceEventId));
  return existing ? { events: [], value: existing, projection } : undefined;
}

export function createRegionNewsRuntime(options: RegionNewsRuntimeOptions): RegionNewsRuntime {
  function generateFromEvent(
    projection: EpochProjection,
    sourceEvent: EpochEvent,
    regionId: string,
    context: Pick<EpochCommandContext, "idempotencyKey" | "causationId" | "correlationId">,
  ): EpochRuntimeResult<EpochRegionNews> {
    const existing = existingNewsForSource(projection, regionId, sourceEvent.eventId);
    if (existing) return existing;
    const draft = regionNewsDraftForEvent(projection, sourceEvent, regionId);
    return options.generateRegionNews({
      regionId,
      headline: draft.headline,
      body: draft.body,
      legendDelta: draft.legendDelta,
      sourceEventIds: [sourceEvent.eventId],
    }, {
      actorExplorerId: "system",
      trustClass: "system_worker",
      idempotencyKey: context.idempotencyKey,
      causationId: context.causationId,
      correlationId: context.correlationId,
    });
  }

  function generateRegionNewsForServerEvent(
    sourceEvent: EpochEvent,
    input: AnyRecord,
    idempotencyKey: string,
  ): EpochRuntimeResult<EpochRegionNews> | null {
    const projection = options.project();
    const regionId = regionNewsEventRegionId(projection, sourceEvent);
    if (!regionId) return null;
    return generateFromEvent(projection, sourceEvent, regionId, {
      idempotencyKey,
      causationId: sourceEvent.eventId,
      correlationId: optionalString(input.correlationId),
    });
  }

  function appendRegionNewsForServerEvent<TValue>(
    result: EpochRuntimeResult<TValue>,
    input: AnyRecord,
    eventType: EpochEventType,
    idempotencyKey: string,
  ): EpochRuntimeResult<TValue> {
    const sourceEvent = result.events.find((event) => event.eventType === eventType);
    if (!sourceEvent) return result;
    const news = generateRegionNewsForServerEvent(sourceEvent, input, idempotencyKey);
    if (!news) return result;
    return {
      value: result.value,
      events: [...result.events, ...news.events],
      projection: news.projection,
    };
  }

  function generateRegionNews(input: AnyRecord = {}): EpochRuntimeResult<EpochRegionNews> {
    const projection = options.project();
    const requestedRegionId = resolveEpochCanonicalRegionId(assertNonEmptyString(input.regionId, "region_id"));
    const sourceEventId = assertNonEmptyString(input.sourceEventId, "source_event_id");
    const sourceEvent = projection.events.find((event) => event.eventId === sourceEventId);
    if (!sourceEvent) throw new Error("source_event_not_found");
    const actualRegionId = canonicalRegionIdFromInput(regionNewsEventRegionId(projection, sourceEvent));
    if (actualRegionId !== requestedRegionId) throw new Error("region_news_source_region_mismatch");
    return generateFromEvent(projection, sourceEvent, requestedRegionId, {
      idempotencyKey: optionalString(input.idempotencyKey),
      causationId: optionalString(input.causationId),
      correlationId: optionalString(input.correlationId),
    });
  }

  return {
    generateRegionNews,
    generateRegionNewsForServerEvent,
    appendRegionNewsForServerEvent,
  };
}
