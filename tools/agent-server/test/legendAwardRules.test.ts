import assert from "node:assert/strict";
import test from "node:test";

import {
  allRegionNews,
  legendAwardGrantPayload,
  legendAwardPayload,
  planLegendAwardClaimEvents,
  projectLegendAwardClaim,
  requireRegionNews,
  type RegionNewsProjectionForLegendRules,
} from "../lib/epoch/legendAwardRules.ts";
import { eventFactory } from "../lib/epoch/eventFactory.ts";
import { createSequentialEpochIdFactory } from "../lib/epoch/protocol.ts";

test("legend award rules read region news projection state", () => {
  const projection = {
    regionNews: {
      region_gray_harbor: [
        { newsId: "news_1", marker: "gray" },
      ],
      region_city_pipes: [
        { newsId: "news_2", marker: "pipes" },
      ],
    },
  } satisfies RegionNewsProjectionForLegendRules<{ readonly newsId: string; readonly marker: string }>;

  assert.deepEqual(allRegionNews(projection).map((news) => news.newsId), ["news_1", "news_2"]);
  assert.equal(requireRegionNews(projection, "news_2").marker, "pipes");
  assert.throws(() => requireRegionNews(projection, "news_missing"), /region_news_not_found/);
});

test("legend award rules build claim payloads with resource ledger fields", () => {
  assert.deepEqual(legendAwardPayload({
    awardId: "legend_award_news_1_agent_1",
    newsId: "news_1",
    regionId: "region_gray_harbor",
    agentId: "agent_1",
    explorerId: "explorer_1",
    amount: 3,
    awardedAt: "2026-07-07T02:00:00.000Z",
  }), {
    awardId: "legend_award_news_1_agent_1",
    newsId: "news_1",
    regionId: "region_gray_harbor",
    agentId: "agent_1",
    explorerId: "explorer_1",
    amount: 3,
    reason: "region_news:news_1",
    awardedAt: "2026-07-07T02:00:00.000Z",
  });
});

test("legend award rules clamp non-positive legend deltas", () => {
  assert.equal(legendAwardPayload({
    awardId: "legend_award_news_1_agent_1",
    newsId: "news_1",
    regionId: "region_gray_harbor",
    agentId: "agent_1",
    explorerId: "explorer_1",
    amount: 0,
    awardedAt: "2026-07-07T02:00:00.000Z",
  }).amount, 1);

  assert.equal(legendAwardPayload({
    awardId: "legend_award_news_2_agent_1",
    newsId: "news_2",
    regionId: "region_gray_harbor",
    agentId: "agent_1",
    explorerId: "explorer_1",
    amount: -4,
    awardedAt: "2026-07-07T02:01:00.000Z",
  }).amount, 1);
});

test("legend award rules build resource grant payloads", () => {
  const award = legendAwardPayload({
    awardId: "legend_award_news_1_agent_1",
    newsId: "news_1",
    regionId: "region_gray_harbor",
    agentId: "agent_1",
    explorerId: "explorer_1",
    amount: 3,
    awardedAt: "2026-07-07T02:00:00.000Z",
  });

  assert.deepEqual(legendAwardGrantPayload({
    award,
    currentLegend: 4,
  }), {
    resourceId: "legend",
    amount: 3,
    reason: "region_news:news_1",
    balanceAfter: 7,
  });
});

test("legend award rules plan claim event sequences and project awards", () => {
  const idFactory = createSequentialEpochIdFactory("legend_claim");
  const awardedAt = "2026-07-07T02:05:00.000Z";
  const context = {
    actorExplorerId: "explorer_1",
    trustClass: "user_verified_web" as const,
    causationId: "cmd_legend",
    correlationId: "corr_legend",
  };
  const events = planLegendAwardClaimEvents({
    news: {
      newsId: "news_1",
      regionId: "region_gray_harbor",
      legendDelta: 3,
    },
    agentId: "agent_1",
    explorerId: "explorer_1",
    currentLegend: 4,
    awardedAt,
    idFactory,
    makeEvent: eventFactory(() => new Date(awardedAt), idFactory, context),
  });

  assert.deepEqual(events.map((event) => event.eventType), [
    "legend_awarded",
    "resource_granted",
  ]);
  const awarded = events[0];
  assert.ok(awarded);
  assert.equal(awarded.eventType, "legend_awarded");
  if (awarded.eventType !== "legend_awarded") throw new Error("expected_legend_awarded_event");
  assert.equal(awarded.payload.amount, 3);
  assert.equal(awarded.payload.reason, "region_news:news_1");

  const granted = events[1];
  assert.ok(granted);
  assert.equal(granted.eventType, "resource_granted");
  if (granted.eventType !== "resource_granted") throw new Error("expected_resource_granted_event");
  assert.equal(granted.payload.resourceId, "legend");
  assert.equal(granted.payload.balanceAfter, 7);

  const projectedAward = {
    awardId: awarded.payload.awardId,
    amount: awarded.payload.amount,
  };
  assert.deepEqual(projectLegendAwardClaim({
    events,
    projection: {
      legendAwards: {
        [awarded.payload.awardId]: projectedAward,
      },
    },
  }), projectedAward);
});
