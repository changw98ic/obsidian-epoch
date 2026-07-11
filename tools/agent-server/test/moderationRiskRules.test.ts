import assert from "node:assert/strict";
import test from "node:test";

import { eventFactory } from "../lib/epoch/eventFactory.ts";
import {
  AUTO_ESCALATED_RISK_REVIEW_OPERATOR_ID,
  AUTO_ESCALATED_RISK_REVIEW_NOTE,
  MAX_MESSAGE_BODY_LENGTH,
  abuseDecayAmount,
  abuseDecayLimit,
  abuseDecayMinScore,
  abuseScoreDecayedPayload,
  autoEscalatedRiskReviewPlan,
  abuseScoreReleasedPayload,
  bodyPreview,
  contentStatusForResolution,
  marketRiskRestrictionReleasedPayload,
  messagePostedPayload,
  moderationAssessment,
  moderationAssessmentForNews,
  moderationQueuedPayload,
  moderationResolvedPayload,
  normalizeMessageBody,
  planAbuseScoreDecayEvents,
  planAbuseScoreReleaseEvents,
  planMarketRiskRestrictionReleaseEvents,
  planMessagePostedEvents,
  planModerationResolvedEvents,
  planRegionNewsGenerationEvents,
  planRiskReviewRecordedEvents,
  projectAbuseScoreDecays,
  projectAbuseScoreRelease,
  projectGeneratedRegionNews,
  projectMarketRiskRestrictionRelease,
  projectModerationResolved,
  projectPostedMessage,
  projectRiskReviewRecorded,
  regionNewsGeneratedPayload,
  requireModerationItem,
  riskReviewRecordedPayload,
  selectAbuseScoreDecayTargets,
  updateMessageModerationStatus,
  updateNewsModerationStatus,
} from "../lib/epoch/moderationRiskRules.ts";
import { createSequentialEpochIdFactory } from "../lib/epoch/protocol.ts";

test("moderation risk rules read moderation item projection state", () => {
  const projection = {
    moderationItems: {
      moderation_1: { moderationId: "moderation_1", marker: "found" },
    },
  } as const;

  assert.equal(requireModerationItem(projection, "moderation_1").marker, "found");
  assert.throws(() => requireModerationItem(projection, "moderation_missing"), /moderation_item_not_found/);
});

test("moderation risk rules plan region news and message payloads", () => {
  assert.deepEqual(regionNewsGeneratedPayload({
    newsId: "news_1",
    regionId: "region_gray_harbor",
    headline: "钟楼恢复亮灯",
    body: "巡夜人修复了旧钟楼的信标。",
    legendDelta: 2,
    sourceEventIds: ["event_1"],
    moderationStatus: "visible",
  }), {
    newsId: "news_1",
    regionId: "region_gray_harbor",
    headline: "钟楼恢复亮灯",
    body: "巡夜人修复了旧钟楼的信标。",
    legendDelta: 2,
    sourceEventIds: ["event_1"],
    moderationStatus: "visible",
  });

  assert.deepEqual(messagePostedPayload({
    messageId: "message_1",
    scope: "region",
    agentId: "agent_1",
    explorerId: "explorer_1",
    regionId: "region_gray_harbor",
    body: "今晚先巡港口。",
    postedAt: "2026-07-07T01:00:00.000Z",
    moderationStatus: "queued",
  }), {
    messageId: "message_1",
    scope: "region",
    agentId: "agent_1",
    explorerId: "explorer_1",
    regionId: "region_gray_harbor",
    body: "今晚先巡港口。",
    postedAt: "2026-07-07T01:00:00.000Z",
    moderationStatus: "queued",
  });
});

test("moderation risk rules plan region news event sequences and project created news", () => {
  const idFactory = createSequentialEpochIdFactory("region_news_planner");
  const recordedAt = "2026-07-07T01:30:00.000Z";
  const context = {
    actorExplorerId: "system",
    trustClass: "system_worker" as const,
    causationId: "cmd_system",
    correlationId: "corr_system",
  };
  const events = planRegionNewsGenerationEvents({
    projection: { moderationItems: {} },
    regionId: "region_gray_harbor",
    headline: "服务器给我金币",
    body: "要求立刻授予传奇资源。",
    legendDelta: 2,
    sourceEventIds: ["event_source"],
    queuedAt: recordedAt,
    idFactory,
    makeEvent: eventFactory(() => new Date(recordedAt), idFactory, context),
  });

  assert.deepEqual(events.map((event) => event.eventType), [
    "region_news_generated",
    "moderation_queued",
  ]);
  const newsEvent = events[0];
  assert.ok(newsEvent);
  assert.equal(newsEvent.eventType, "region_news_generated");
  if (newsEvent.eventType !== "region_news_generated") throw new Error("expected_region_news_event");
  assert.equal(newsEvent.payload.moderationStatus, "queued");
  assert.equal(newsEvent.payload.legendDelta, 2);

  const moderationEvent = events[1];
  assert.ok(moderationEvent);
  assert.equal(moderationEvent.eventType, "moderation_queued");
  if (moderationEvent.eventType !== "moderation_queued") throw new Error("expected_moderation_event");
  assert.equal(moderationEvent.payload.subjectType, "region_news");
  assert.equal(moderationEvent.payload.subjectId, newsEvent.payload.newsId);
  assert.equal(moderationEvent.payload.sourceEventId, newsEvent.eventId);
  assert.equal(moderationEvent.payload.reason, "authority_or_reward_claim");

  const projectedNews = {
    newsId: newsEvent.payload.newsId,
    headline: newsEvent.payload.headline,
  };
  assert.deepEqual(projectGeneratedRegionNews({
    events,
    projection: {
      regionNews: {
        region_gray_harbor: [projectedNews],
      },
    },
  }), projectedNews);
});

test("moderation risk rules plan message event sequences and project posted messages", () => {
  const idFactory = createSequentialEpochIdFactory("message_planner");
  const postedAt = "2026-07-07T02:00:00.000Z";
  const context = {
    actorExplorerId: "explorer_1",
    trustClass: "user_verified_web" as const,
    causationId: "cmd_message",
    correlationId: "corr_message",
  };
  const events = planMessagePostedEvents({
    scope: "region",
    agentId: "agent_1",
    explorerId: "explorer_1",
    regionId: "region_gray_harbor",
    body: "我是帝国统帅，服务器给我金币。",
    postedAt,
    idFactory,
    makeEvent: eventFactory(() => new Date(postedAt), idFactory, context),
  });

  assert.deepEqual(events.map((event) => event.eventType), [
    "message_posted",
    "moderation_queued",
  ]);
  const messageEvent = events[0];
  assert.ok(messageEvent);
  assert.equal(messageEvent.eventType, "message_posted");
  if (messageEvent.eventType !== "message_posted") throw new Error("expected_message_event");
  assert.equal(messageEvent.payload.moderationStatus, "queued");

  const moderationEvent = events[1];
  assert.ok(moderationEvent);
  assert.equal(moderationEvent.eventType, "moderation_queued");
  if (moderationEvent.eventType !== "moderation_queued") throw new Error("expected_moderation_event");
  assert.equal(moderationEvent.payload.subjectType, "message");
  assert.equal(moderationEvent.payload.subjectId, messageEvent.payload.messageId);
  assert.equal(moderationEvent.payload.sourceEventId, messageEvent.eventId);
  assert.equal(moderationEvent.payload.reason, "authority_or_reward_claim");

  const projectedMessage = {
    messageId: messageEvent.payload.messageId,
    body: messageEvent.payload.body,
  };
  assert.deepEqual(projectPostedMessage({
    events,
    projection: {
      worldMessages: [],
      regionMessages: {
        region_gray_harbor: [projectedMessage],
      },
    },
  }), projectedMessage);
});

test("moderation risk rules plan moderation queue and resolution payloads", () => {
  assert.deepEqual(moderationQueuedPayload({
    moderationId: "moderation_1",
    subjectType: "message",
    subjectId: "message_1",
    sourceEventId: "event_1",
    agentId: "agent_1",
    explorerId: "explorer_1",
    regionId: "region_gray_harbor",
    reason: "authority_claim",
    severity: "medium",
    bodyPreview: "preview",
    queuedAt: "2026-07-07T01:00:00.000Z",
  }), {
    moderationId: "moderation_1",
    subjectType: "message",
    subjectId: "message_1",
    sourceEventId: "event_1",
    agentId: "agent_1",
    explorerId: "explorer_1",
    regionId: "region_gray_harbor",
    reason: "authority_claim",
    severity: "medium",
    bodyPreview: "preview",
    queuedAt: "2026-07-07T01:00:00.000Z",
  });

  assert.deepEqual(moderationResolvedPayload({
    moderationId: "moderation_1",
    resolution: "approved",
    resolvedBy: "operator_1",
    resolvedAt: "2026-07-07T02:00:00.000Z",
    note: ` ${"x".repeat(300)} `,
  }), {
    moderationId: "moderation_1",
    resolution: "approved",
    resolvedBy: "operator_1",
    resolvedAt: "2026-07-07T02:00:00.000Z",
    note: "x".repeat(240),
  });

  assert.equal(moderationResolvedPayload({
    moderationId: "moderation_2",
    resolution: "rejected",
    resolvedBy: "operator_1",
    resolvedAt: "2026-07-07T02:00:00.000Z",
    note: "   ",
  }).note, undefined);
});

test("moderation risk rules plan moderation resolution event sequence", () => {
  const resolvedAt = "2026-07-07T03:15:00.000Z";
  const idFactory = createSequentialEpochIdFactory("test");
  const makeEvent = eventFactory(() => new Date(resolvedAt), idFactory, {
    actorExplorerId: "operator_1",
    trustClass: "system_worker",
  });

  const events = planModerationResolvedEvents({
    moderationId: "moderation_1",
    resolution: "approved",
    resolvedBy: "operator_1",
    resolvedAt,
    note: " reviewed ",
    makeEvent,
  });

  assert.deepEqual(events.map((event) => event.eventType), ["moderation_resolved"]);
  const resolvedEvent = events[0];
  assert.ok(resolvedEvent);
  assert.equal(resolvedEvent.aggregateId, "moderation_1");
  assert.equal(resolvedEvent.eventType, "moderation_resolved");
  if (resolvedEvent.eventType !== "moderation_resolved") throw new Error("expected_moderation_resolved_event");
  assert.equal(resolvedEvent.payload.note, "reviewed");
  const projected = { moderationId: "moderation_1", status: "approved" };
  assert.deepEqual(projectModerationResolved({
    events,
    projection: {
      moderationItems: {
        moderation_1: projected,
      },
    },
  }), projected);
  assert.throws(() => projectModerationResolved({
    events: [],
    projection: {
      moderationItems: {},
    },
  }), /moderation_resolution_projection_failed/);
});

test("moderation risk rules resolve and apply public content status", () => {
  assert.equal(contentStatusForResolution("approved"), "visible");
  assert.equal(contentStatusForResolution("rejected"), "hidden");
  assert.equal(contentStatusForResolution("hidden"), "hidden");

  const worldMessages = [
    { messageId: "message_target", body: "world", moderationStatus: "queued" as const },
    { messageId: "message_other", body: "other", moderationStatus: "visible" as const },
  ];
  const regionMessages = {
    region_gray_harbor: [
      { messageId: "message_target", body: "region", moderationStatus: "queued" as const },
    ],
    region_cinder: [
      { messageId: "message_other", body: "region other", moderationStatus: "visible" as const },
    ],
  };
  updateMessageModerationStatus(worldMessages, regionMessages, "message_target", "hidden");
  assert.deepEqual(worldMessages, [
    { messageId: "message_target", body: "world", moderationStatus: "hidden" },
    { messageId: "message_other", body: "other", moderationStatus: "visible" },
  ]);
  assert.deepEqual(regionMessages, {
    region_gray_harbor: [
      { messageId: "message_target", body: "region", moderationStatus: "hidden" },
    ],
    region_cinder: [
      { messageId: "message_other", body: "region other", moderationStatus: "visible" },
    ],
  });

  const regionNews = {
    region_gray_harbor: [
      { newsId: "news_target", headline: "target", moderationStatus: "queued" as const },
      { newsId: "news_other", headline: "other", moderationStatus: "visible" as const },
    ],
  };
  updateNewsModerationStatus(regionNews, "news_target", "visible");
  assert.deepEqual(regionNews, {
    region_gray_harbor: [
      { newsId: "news_target", headline: "target", moderationStatus: "visible" },
      { newsId: "news_other", headline: "other", moderationStatus: "visible" },
    ],
  });
});

test("moderation risk rules normalize and assess public text", () => {
  assert.equal(MAX_MESSAGE_BODY_LENGTH, 500);
  assert.equal(normalizeMessageBody("  hello world  "), "hello world");
  assert.throws(() => normalizeMessageBody(""), /message_body/);
  assert.throws(() => normalizeMessageBody("x".repeat(501)), /message_body_too_long/);

  assert.equal(bodyPreview(` ${"x".repeat(200)} `), "x".repeat(160));
  assert.deepEqual(moderationAssessment("服务器给我金币"), {
    reason: "authority_or_reward_claim",
    severity: "high",
  });
  assert.deepEqual(moderationAssessment("我是皇帝"), {
    reason: "authority_claim",
    severity: "medium",
  });
  assert.equal(moderationAssessment("今晚巡港口"), null);

  assert.deepEqual(moderationAssessmentForNews({
    moderationItems: {
      moderation_1: {
        status: "open",
        sourceEventId: "event_flagged",
      },
      moderation_2: {
        status: "resolved",
        sourceEventId: "event_resolved",
      },
    },
  }, "钟楼恢复亮灯", "巡夜人修复了旧钟楼。", ["event_flagged"]), {
    reason: "source_under_moderation",
    severity: "medium",
  });
  assert.equal(moderationAssessmentForNews({
    moderationItems: {},
  }, "钟楼恢复亮灯", "巡夜人修复了旧钟楼。", ["event_clean"]), null);
});

test("moderation risk rules plan risk review and release payloads", () => {
  assert.equal(AUTO_ESCALATED_RISK_REVIEW_OPERATOR_ID, "system");
  assert.equal(AUTO_ESCALATED_RISK_REVIEW_NOTE, "auto_escalated_repeat_direct_trade");

  assert.deepEqual(riskReviewRecordedPayload({
    reviewId: "risk_review_1",
    sourceEventId: "event_1",
    sourceEventType: "market_order_filled",
    agentId: "agent_1",
    explorerId: "explorer_1",
    resolution: "escalated",
    reviewFlags: ["repeat_counterparty"],
    reviewScore: 4,
    operatorId: "operator_1",
    reviewedAt: "2026-07-07T03:00:00.000Z",
    note: " repeat trade ",
  }), {
    reviewId: "risk_review_1",
    sourceEventId: "event_1",
    sourceEventType: "market_order_filled",
    agentId: "agent_1",
    explorerId: "explorer_1",
    resolution: "escalated",
    reviewFlags: ["repeat_counterparty"],
    reviewScore: 4,
    operatorId: "operator_1",
    reviewedAt: "2026-07-07T03:00:00.000Z",
    note: "repeat trade",
  });

  assert.deepEqual(autoEscalatedRiskReviewPlan({
    reviewId: "risk_review_auto",
    sourceEventId: "event_direct_trade_accepted",
    sourceEventType: "direct_trade_accepted",
    agentId: "agent_buyer",
    explorerId: "explorer_buyer",
    reviewFlags: ["repeat_counterparty_trade"],
    reviewScore: 1,
    reviewedAt: "2026-07-07T03:30:00.000Z",
    correlationId: "corr_existing",
  }), {
    context: {
      actorExplorerId: "system",
      trustClass: "system_worker",
      causationId: "event_direct_trade_accepted",
      correlationId: "corr_existing",
    },
    payload: {
      reviewId: "risk_review_auto",
      sourceEventId: "event_direct_trade_accepted",
      sourceEventType: "direct_trade_accepted",
      agentId: "agent_buyer",
      explorerId: "explorer_buyer",
      resolution: "escalated",
      reviewFlags: ["repeat_counterparty_trade"],
      reviewScore: 1,
      operatorId: "system",
      reviewedAt: "2026-07-07T03:30:00.000Z",
      note: "auto_escalated_repeat_direct_trade",
    },
    aggregateType: "moderation_item",
    agentId: "agent_buyer",
  });

  assert.equal(autoEscalatedRiskReviewPlan({
    reviewId: "risk_review_clean",
    sourceEventId: "event_clean",
    sourceEventType: "direct_trade_accepted",
    reviewFlags: [],
    reviewScore: 0,
    reviewedAt: "2026-07-07T03:30:00.000Z",
  }), undefined);

  assert.deepEqual(marketRiskRestrictionReleasedPayload({
    releaseId: "release_1",
    agentId: "agent_1",
    explorerId: "explorer_1",
    sourceEventId: "event_1",
    sourceReviewId: "risk_review_1",
    releasedBy: "operator_1",
    releasedAt: "2026-07-07T04:00:00.000Z",
    note: " cleared ",
  }), {
    releaseId: "release_1",
    agentId: "agent_1",
    explorerId: "explorer_1",
    sourceEventId: "event_1",
    sourceReviewId: "risk_review_1",
    releasedBy: "operator_1",
    releasedAt: "2026-07-07T04:00:00.000Z",
    note: "cleared",
  });
});

test("moderation risk rules plan risk review event sequence", () => {
  const reviewedAt = "2026-07-07T03:45:00.000Z";
  const idFactory = createSequentialEpochIdFactory("test");
  const makeEvent = eventFactory(() => new Date(reviewedAt), idFactory, {
    actorExplorerId: "operator_1",
    trustClass: "system_worker",
  });

  const events = planRiskReviewRecordedEvents({
    reviewId: "risk_review_1",
    sourceEventId: "event_1",
    sourceEventType: "market_order_filled",
    agentId: "agent_1",
    explorerId: "explorer_1",
    resolution: "escalated",
    reviewFlags: ["repeat_counterparty"],
    reviewScore: 5,
    operatorId: "operator_1",
    reviewedAt,
    note: " suspicious ",
    makeEvent,
  });

  assert.deepEqual(events.map((event) => event.eventType), ["risk_review_recorded"]);
  const reviewEvent = events[0];
  assert.ok(reviewEvent);
  assert.equal(reviewEvent.aggregateId, "risk_review_1");
  assert.equal(reviewEvent.agentId, "agent_1");
  assert.equal(reviewEvent.eventType, "risk_review_recorded");
  if (reviewEvent.eventType !== "risk_review_recorded") throw new Error("expected_risk_review_event");
  assert.equal(reviewEvent.payload.note, "suspicious");
  assert.deepEqual(reviewEvent.payload.reviewFlags, ["repeat_counterparty"]);
  const projected = { reviewId: "risk_review_1", marker: "projected" };
  assert.deepEqual(projectRiskReviewRecorded({
    events,
    projection: {
      riskReviews: {
        risk_review_1: projected,
      },
    },
  }), projected);
  assert.throws(() => projectRiskReviewRecorded({
    events: [],
    projection: {
      riskReviews: {},
    },
  }), /risk_review_projection_failed/);
});

test("moderation risk rules plan market risk release event sequence", () => {
  const releasedAt = "2026-07-07T04:30:00.000Z";
  const idFactory = createSequentialEpochIdFactory("test");
  const makeEvent = eventFactory(() => new Date(releasedAt), idFactory, {
    actorExplorerId: "operator_1",
    trustClass: "system_worker",
  });

  const events = planMarketRiskRestrictionReleaseEvents({
    releaseId: "release_1",
    restriction: {
      agentId: "agent_1",
      explorerId: "explorer_1",
      sourceEventId: "event_1",
      sourceReviewId: "risk_review_1",
    },
    releasedBy: "operator_1",
    releasedAt,
    note: " cleared ",
    makeEvent,
  });

  assert.deepEqual(events.map((event) => event.eventType), ["market_risk_restriction_released"]);
  const releaseEvent = events[0];
  assert.ok(releaseEvent);
  assert.equal(releaseEvent.aggregateId, "release_1");
  assert.equal(releaseEvent.agentId, "agent_1");
  assert.equal(releaseEvent.eventType, "market_risk_restriction_released");
  if (releaseEvent.eventType !== "market_risk_restriction_released") {
    throw new Error("expected_market_risk_release_event");
  }
  assert.equal(releaseEvent.payload.agentId, "agent_1");
  assert.equal(releaseEvent.payload.sourceReviewId, "risk_review_1");
  assert.equal(releaseEvent.payload.note, "cleared");

  const projected = {
    releaseId: "release_1",
    marker: "projected",
  };
  assert.deepEqual(projectMarketRiskRestrictionRelease({
    events,
    projection: {
      marketRiskRestrictionReleases: {
        release_1: projected,
      },
    },
  }), projected);
  assert.throws(() => projectMarketRiskRestrictionRelease({
    events: [],
    projection: {
      marketRiskRestrictionReleases: {},
    },
  }), /market_risk_restriction_release_projection_failed/);
});

test("moderation risk rules plan abuse release and decay payloads", () => {
  assert.deepEqual(abuseScoreReleasedPayload({
    releaseId: "abuse_release_1",
    actorKey: "agent_1",
    agentId: "agent_1",
    explorerId: "explorer_1",
    previousScore: 7,
    scoreAfter: 2,
    sourceEventId: "event_1",
    releasedBy: "operator_1",
    releasedAt: "2026-07-07T05:00:00.000Z",
    note: " lowered ",
  }), {
    releaseId: "abuse_release_1",
    actorKey: "agent_1",
    agentId: "agent_1",
    explorerId: "explorer_1",
    previousScore: 7,
    scoreAfter: 2,
    sourceEventId: "event_1",
    releasedBy: "operator_1",
    releasedAt: "2026-07-07T05:00:00.000Z",
    note: "lowered",
  });

  assert.deepEqual(abuseScoreDecayedPayload({
    decayId: "abuse_decay_1",
    actorKey: "agent_1",
    agentId: "agent_1",
    explorerId: "explorer_1",
    previousScore: 7,
    scoreAfter: 5,
    decayAmount: 2,
    sourceEventId: "event_1",
    decayedBy: "system",
    decayedAt: "2026-07-07T06:00:00.000Z",
  }), {
    decayId: "abuse_decay_1",
    actorKey: "agent_1",
    agentId: "agent_1",
    explorerId: "explorer_1",
    previousScore: 7,
    scoreAfter: 5,
    decayAmount: 2,
    sourceEventId: "event_1",
    decayedBy: "system",
    decayedAt: "2026-07-07T06:00:00.000Z",
    reason: "maintenance_decay",
  });
});

test("moderation risk rules plan abuse release event sequence", () => {
  const releasedAt = "2026-07-07T05:30:00.000Z";
  const idFactory = createSequentialEpochIdFactory("test");
  const makeEvent = eventFactory(() => new Date(releasedAt), idFactory, {
    actorExplorerId: "operator_1",
    trustClass: "system_worker",
  });

  const events = planAbuseScoreReleaseEvents({
    profile: {
      actorKey: "agent_1",
      agentId: "agent_1",
      explorerId: "explorer_1",
      score: 7,
      latestEventId: "event_previous",
    },
    scoreAfter: 2,
    releasedBy: "operator_1",
    releasedAt,
    note: " lowered ",
    idFactory,
    makeEvent,
  });

  assert.deepEqual(events.map((event) => event.eventType), ["abuse_score_released"]);
  const releaseEvent = events[0];
  assert.ok(releaseEvent);
  assert.equal(releaseEvent.aggregateId, "agent_1");
  assert.equal(releaseEvent.agentId, "agent_1");
  assert.equal(releaseEvent.eventType, "abuse_score_released");
  if (releaseEvent.eventType !== "abuse_score_released") throw new Error("expected_abuse_release_event");
  assert.equal(releaseEvent.payload.previousScore, 7);
  assert.equal(releaseEvent.payload.scoreAfter, 2);
  assert.equal(releaseEvent.payload.sourceEventId, "event_previous");
  assert.equal(releaseEvent.payload.note, "lowered");

  assert.deepEqual(projectAbuseScoreRelease({
    events,
    projection: {
      abuseScores: {
        agent_1: {
          latestEventId: releaseEvent.eventId,
        },
      },
    },
  }), releaseEvent.payload);
  assert.throws(() => projectAbuseScoreRelease({
    events: [],
    projection: {
      abuseScores: {},
    },
  }), /abuse_release_projection_failed/);
});

test("moderation risk rules select abuse score decay targets", () => {
  const profile = (actorKey: string, score: number, updatedAt: string) => ({
    actorKey,
    score,
    updatedAt,
  });

  assert.equal(abuseDecayLimit(undefined), 0);
  assert.equal(abuseDecayLimit(0), 0);
  assert.equal(abuseDecayLimit(-5), 0);
  assert.equal(abuseDecayLimit(200), 100);
  assert.equal(abuseDecayAmount(undefined), 1);
  assert.equal(abuseDecayAmount(0), 1);
  assert.equal(abuseDecayAmount(20), 10);
  assert.equal(abuseDecayMinScore(undefined), 1);
  assert.equal(abuseDecayMinScore(0), 1);
  assert.deepEqual(
    selectAbuseScoreDecayTargets({
      low: profile("low", 1, "2026-07-07T01:00:00.000Z"),
      high_late: profile("high_late", 5, "2026-07-07T02:00:00.000Z"),
      high_early_b: profile("high_early_b", 5, "2026-07-07T01:00:00.000Z"),
      high_early_a: profile("high_early_a", 5, "2026-07-07T01:00:00.000Z"),
      below: profile("below", 0, "2026-07-07T00:00:00.000Z"),
    }, {
      limit: 3,
      minScore: 2,
    }).map((item) => item.actorKey),
    ["high_early_a", "high_early_b", "high_late"],
  );
  assert.deepEqual(
    selectAbuseScoreDecayTargets({
      high: profile("high", 5, "2026-07-07T01:00:00.000Z"),
    }, {}).map((item) => item.actorKey),
    [],
  );
});

test("moderation risk rules plan abuse score decay event sequence", () => {
  const decayedAt = "2026-07-07T06:30:00.000Z";
  const idFactory = createSequentialEpochIdFactory("test");
  const makeEvent = eventFactory(() => new Date(decayedAt), idFactory, {
    actorExplorerId: "operator_1",
    trustClass: "system_worker",
  });

  const events = planAbuseScoreDecayEvents({
    profilesByActorKey: {
      low: {
        actorKey: "low",
        score: 1,
        updatedAt: "2026-07-07T00:00:00.000Z",
        latestEventId: "event_low",
      },
      agent_high_a: {
        actorKey: "agent_high_a",
        agentId: "agent_high_a",
        explorerId: "explorer_a",
        score: 7,
        updatedAt: "2026-07-07T01:00:00.000Z",
        latestEventId: "event_high_a",
      },
      agent_high_b: {
        actorKey: "agent_high_b",
        agentId: "agent_high_b",
        explorerId: "explorer_b",
        score: 4,
        updatedAt: "2026-07-07T02:00:00.000Z",
        latestEventId: "event_high_b",
      },
    },
    selection: {
      limit: 2,
      minScore: 2,
    },
    amount: 3,
    decayedBy: "operator_1",
    decayedAt,
    idFactory,
    makeEvent,
  });

  assert.deepEqual(events.map((event) => event.eventType), [
    "abuse_score_decayed",
    "abuse_score_decayed",
  ]);
  assert.deepEqual(projectAbuseScoreDecays({ events }).map((decay) => ({
    actorKey: decay.actorKey,
    previousScore: decay.previousScore,
    scoreAfter: decay.scoreAfter,
    decayAmount: decay.decayAmount,
    sourceEventId: decay.sourceEventId,
    decayedBy: decay.decayedBy,
    reason: decay.reason,
  })), [
    {
      actorKey: "agent_high_a",
      previousScore: 7,
      scoreAfter: 4,
      decayAmount: 3,
      sourceEventId: "event_high_a",
      decayedBy: "operator_1",
      reason: "maintenance_decay",
    },
    {
      actorKey: "agent_high_b",
      previousScore: 4,
      scoreAfter: 1,
      decayAmount: 3,
      sourceEventId: "event_high_b",
      decayedBy: "operator_1",
      reason: "maintenance_decay",
    },
  ]);
  const firstEvent = events[0];
  assert.ok(firstEvent);
  assert.equal(firstEvent.aggregateId, "agent_high_a");
  assert.equal(firstEvent.agentId, "agent_high_a");
  assert.deepEqual(projectAbuseScoreDecays({ events: [] }), []);
});
