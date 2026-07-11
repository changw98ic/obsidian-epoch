import assert from "node:assert/strict";
import test from "node:test";

import type { EpochEvent } from "../lib/epoch/events.ts";
import { createEpochGameCore, type EpochProjection } from "../lib/epoch/gameCore.ts";
import {
  regionNewsDraftForEvent,
  regionNewsEventRegionId,
} from "../lib/epoch/regionNewsDraftRules.ts";

const now = "2026-07-08T00:00:00.000Z";

function projection(overrides: Partial<EpochProjection> = {}): EpochProjection {
  return {
    ...createEpochGameCore().project(),
    ...overrides,
  };
}

function messagePostedEvent(body = "灰港出现新的潮汐线索。"): EpochEvent {
  return {
    eventId: "event_message",
    eventType: "message_posted",
    aggregateType: "message",
    aggregateId: "message_1",
    actorExplorerId: "explorer_1",
    agentId: "agent_1",
    trustClass: "user_verified_web",
    causationId: "cause_1",
    correlationId: "corr_1",
    createdAt: now,
    payload: {
      messageId: "message_1",
      scope: "region",
      agentId: "agent_1",
      explorerId: "explorer_1",
      regionId: "region_gray_harbor",
      body,
      postedAt: now,
      moderationStatus: "visible",
    },
  } as EpochEvent;
}

function anomalyResolvedEvent(): EpochEvent {
  return {
    eventId: "event_anomaly_resolved",
    eventType: "anomaly_event_resolved",
    aggregateType: "anomaly_event",
    aggregateId: "anomaly_1",
    actorExplorerId: "explorer_1",
    agentId: "agent_1",
    trustClass: "system_worker",
    causationId: "cause_1",
    correlationId: "corr_1",
    createdAt: now,
    payload: {
      anomalyId: "anomaly_1",
      resolvedAt: now,
      outcome: "contained",
      winnerAgentId: "agent_1",
      winnerExplorerId: "explorer_1",
      winningScore: 7,
      lifetimeRisk: 1,
    },
  } as EpochEvent;
}

function assertNoInternalIds(text: string) {
  assert.doesNotMatch(text, /region_/);
  assert.doesNotMatch(text, /agent_/);
  assert.doesNotMatch(text, /explorer_/);
}

test("region news event region id reads direct event regions and projection-backed anomaly regions", () => {
  const anomalyProjection = projection({
    anomalyEvents: {
      anomaly_1: {
        anomalyId: "anomaly_1",
        regionId: "region_gray_harbor",
        title: "黑曜裂隙兽",
      } as EpochProjection["anomalyEvents"][string],
    },
  });

  assert.equal(regionNewsEventRegionId(projection(), messagePostedEvent()), "region_gray_harbor");
  assert.equal(regionNewsEventRegionId(anomalyProjection, anomalyResolvedEvent()), "region_gray_harbor");
});

test("region news draft uses identity names for message headlines", () => {
  const longBody = "x".repeat(140);
  const draft = regionNewsDraftForEvent(projection({
    identities: {
      agent_1: {
        identityName: "灰港书记员",
      } as EpochProjection["identities"][string],
    },
  }), messagePostedEvent(longBody), "region_gray_harbor");

  assert.equal(draft.headline, "灰港书记员 登上灰港简报");
  assert.equal(draft.legendDelta, 1);
  assert.equal(draft.body, `服务器将一条区域发言整理为公开新闻：${"x".repeat(120)}`);
  assertNoInternalIds(draft.headline);
  assertNoInternalIds(draft.body);
});

test("region news draft describes contained anomalies from projection titles", () => {
  const draft = regionNewsDraftForEvent(projection({
    anomalyEvents: {
      anomaly_1: {
        anomalyId: "anomaly_1",
        regionId: "region_gray_harbor",
        title: "黑曜裂隙兽",
      } as EpochProjection["anomalyEvents"][string],
    },
    identities: {
      agent_1: {
        identityName: "灰港书记员",
      } as EpochProjection["identities"][string],
    },
  }), anomalyResolvedEvent(), "region_gray_harbor");

  assert.equal(draft.headline, "黑曜裂隙兽压制成功");
  assert.equal(draft.legendDelta, 2);
  assert.match(draft.body, /胜者 灰港书记员/);
  assert.match(draft.body, /有效分 7/);
  assertNoInternalIds(draft.headline);
  assertNoInternalIds(draft.body);
});

test("region news draft falls back to public labels instead of raw ids", () => {
  const draft = regionNewsDraftForEvent(projection(), messagePostedEvent("提到 region_gray_harbor 和 gray_agent_secret"), "region_gray_harbor");

  assert.equal(draft.headline, "相关探索者 登上灰港简报");
  assert.match(draft.body, /灰港/);
  assert.match(draft.body, /行动身份/);
  assertNoInternalIds(draft.headline);
  assertNoInternalIds(draft.body);
});
