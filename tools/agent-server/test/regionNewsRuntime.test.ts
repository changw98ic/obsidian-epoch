import assert from "node:assert/strict";
import test from "node:test";
import type { EpochEvent } from "../lib/epoch/events.ts";
import type {
  EpochCommandContext,
} from "../lib/epoch/protocol.ts";
import type {
  EpochProjection,
  EpochRegionNews,
  GenerateRegionNewsInput,
} from "../lib/epoch/gameCore.ts";
import { createRegionNewsRuntime } from "../lib/epoch/regionNewsRuntime.ts";
import type { EpochRuntimeResult } from "../lib/epoch/runtimePublicProjectionRules.ts";

const createdAt = "2026-07-05T14:18:00.000Z";

type AnomalyEventSpawnedEvent = Extract<EpochEvent, { readonly eventType: "anomaly_event_spawned" }>;
type RegionNewsGeneratedEvent = Extract<EpochEvent, { readonly eventType: "region_news_generated" }>;

function anomalySpawnedEvent(): EpochEvent {
  const event: AnomalyEventSpawnedEvent = {
    eventId: "event_anomaly_spawned",
    eventType: "anomaly_event_spawned",
    aggregateType: "region",
    aggregateId: "region_gray_harbor",
    actorExplorerId: "system",
    trustClass: "system_worker",
    causationId: "root",
    correlationId: "corr",
    createdAt,
    payload: {
      anomalyId: "anomaly_1",
      regionId: "region_gray_harbor",
      title: "黑曜裂隙兽",
      description: "黑曜裂隙正在灰港外缘扩大。",
      severity: "major",
      targetScore: 12,
      reward: { resourceId: "legend", amount: 1, reason: "anomaly_test_reward" },
      lifetimeRisk: 1,
      spawnedAt: createdAt,
    },
  };
  return event;
}

function regionNews(newsId: string, sourceEventIds: readonly string[]): EpochRegionNews {
  return {
    newsId,
    regionId: "region_gray_harbor",
    headline: "灰港异常警报",
    body: "服务器记录了一条灰港异常。",
    legendDelta: 0,
    sourceEventIds,
    createdAt,
    moderationStatus: "visible",
  };
}

function projectionFor(sourceEvent: EpochEvent, news: readonly EpochRegionNews[] = []): EpochProjection {
  return {
    events: [sourceEvent],
    identities: {},
    regionNews: { region_gray_harbor: news },
  } as unknown as EpochProjection;
}

test("region news runtime reuses existing source news without regenerating", () => {
  const sourceEvent = anomalySpawnedEvent();
  const existingNews = regionNews("news_existing", [sourceEvent.eventId]);
  const projection = projectionFor(sourceEvent, [existingNews]);
  const calls: GenerateRegionNewsInput[] = [];
  const runtime = createRegionNewsRuntime({
    project: () => projection,
    generateRegionNews: (input) => {
      calls.push(input);
      throw new Error("should_not_generate_duplicate_news");
    },
  });

  const result = runtime.generateRegionNews({
    regionId: "region_gray_harbor",
    sourceEventId: sourceEvent.eventId,
  });

  assert.equal(result.value.newsId, "news_existing");
  assert.deepEqual(result.events, []);
  assert.equal(result.projection, projection);
  assert.deepEqual(calls, []);
});

test("region news runtime appends generated news events to server results", () => {
  const sourceEvent = anomalySpawnedEvent();
  const projection = projectionFor(sourceEvent);
  const generatedNews = regionNews("news_generated", [sourceEvent.eventId]);
  const newsEvent: RegionNewsGeneratedEvent = {
    eventId: "event_region_news_generated",
    eventType: "region_news_generated",
    aggregateType: "region",
    aggregateId: "region_gray_harbor",
    actorExplorerId: "system",
    trustClass: "system_worker",
    causationId: sourceEvent.eventId,
    correlationId: "corr_from_request",
    createdAt,
    payload: {
      newsId: generatedNews.newsId,
      regionId: generatedNews.regionId,
      headline: generatedNews.headline,
      body: generatedNews.body,
      legendDelta: generatedNews.legendDelta,
      sourceEventIds: generatedNews.sourceEventIds,
      moderationStatus: generatedNews.moderationStatus,
    },
  };
  const generatedProjection = projectionFor(sourceEvent, [generatedNews]);
  const calls: {
    readonly input: GenerateRegionNewsInput;
    readonly context: EpochCommandContext;
  }[] = [];
  const runtime = createRegionNewsRuntime({
    project: () => projection,
    generateRegionNews: (input, context) => {
      calls.push({ input, context });
      return {
        value: generatedNews,
        events: [newsEvent],
        projection: generatedProjection,
      };
    },
  });
  const baseResult: EpochRuntimeResult<{ readonly ok: true }> = {
    value: { ok: true },
    events: [sourceEvent],
    projection,
  };

  const result = runtime.appendRegionNewsForServerEvent(
    baseResult,
    { correlationId: "corr_from_request" },
    "anomaly_event_spawned",
    "spawn_anomaly_news:idem",
  );

  assert.equal(result.value, baseResult.value);
  assert.deepEqual(result.events, [sourceEvent, newsEvent]);
  assert.equal(result.projection, generatedProjection);
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.input.regionId, "region_gray_harbor");
  assert.match(calls[0]?.input.headline || "", /异常警报/);
  assert.deepEqual(calls[0]?.input.sourceEventIds, [sourceEvent.eventId]);
  assert.equal(calls[0]?.context.idempotencyKey, "spawn_anomaly_news:idem");
  assert.equal(calls[0]?.context.causationId, sourceEvent.eventId);
  assert.equal(calls[0]?.context.correlationId, "corr_from_request");
});
