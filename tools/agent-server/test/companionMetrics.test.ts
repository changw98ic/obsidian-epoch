import assert from "node:assert/strict";
import test from "node:test";
import { journeyMetricsView } from "../lib/epoch/journeyMetricsReadModel.ts";
import { createJourneyRuntime } from "../lib/epoch/journeyRuntime.ts";
import { createMcpSamplingLimiter } from "../lib/mcpSamplingLimiter.ts";
import { createMcpTransportMetrics } from "../lib/mcpTransportMetrics.ts";
import { createMcpHttpSessionRegistry } from "../lib/mcpHttpTransport.ts";
import { buildPersistedJourneyNarrative, buildServerJourneyEpisodeFacts } from "../lib/epoch/journeyNarrativeRules.ts";
import type { EpochEvent } from "../lib/epoch/events.ts";

test("Sampling limiter enforces concurrency, request rate, and token budget", () => {
  const concurrent = createMcpSamplingLimiter({ maxConcurrent: 1, maxRequestsPerMinute: 10, maxTokensPerMinute: 100 });
  const first = concurrent.acquire(20);
  assert.ok("release" in first);
  assert.deepEqual(concurrent.acquire(20), { denied: "concurrency" });
  if ("release" in first) first.release();

  const rate = createMcpSamplingLimiter({ maxConcurrent: 2, maxRequestsPerMinute: 1, maxTokensPerMinute: 100 });
  const rateFirst = rate.acquire(20);
  if ("release" in rateFirst) rateFirst.release();
  assert.deepEqual(rate.acquire(20), { denied: "request_rate" });

  const tokens = createMcpSamplingLimiter({ maxConcurrent: 2, maxRequestsPerMinute: 10, maxTokensPerMinute: 30 });
  const tokenFirst = tokens.acquire(20);
  if ("release" in tokenFirst) tokenFirst.release();
  assert.deepEqual(tokens.acquire(20), { denied: "token_budget" });
});

test("transport metrics expose bounded counters, percentiles, and error-budget alerts without secret labels", () => {
  const metrics = createMcpTransportMetrics();
  metrics.sessionCreated();
  metrics.sessionInitialized(true);
  metrics.streamOpened();
  for (let index = 0; index < 20; index += 1) {
    metrics.toolCall(index + 1, index !== 0);
    metrics.samplingTerminal(index === 0
      ? { fallback: "timeout", recoveryCode: "must-not-appear" }
      : { outcome: "success", prompt: "must-not-appear" });
  }
  const snapshot = metrics.snapshot();
  assert.equal(snapshot.transport.activeSessions, 1);
  assert.equal(snapshot.tools.latencyMs.p95, 19);
  assert.equal(snapshot.errorBudget.samplingTimeoutAlert, false);
  assert.equal(snapshot.errorBudget.toolFailureAlert, true);
  assert.doesNotMatch(JSON.stringify(snapshot), /must-not-appear|recoveryCode|prompt/);
});

test("journey metrics report interruption budget, template reuse, social episodes, and poll latency", () => {
  let sequence = 0;
  const runtime = createJourneyRuntime({
    idFactory: (kind) => `${kind}_metric_${++sequence}`,
    nowReal: () => "2026-01-01T00:00:00.000Z",
    nowWorld: () => "2026-01-01T08:00:00.000Z",
    pollIntervalMs: 60_000,
  });
  const prepared = runtime.prepare({
    agentId: "agent_metric",
    explorerId: "explorer_metric",
    originRegionId: "region_gray_harbor",
    destinationRegionId: "region_gray_harbor",
  });
  const started = runtime.start({ journeyId: prepared.journey.journeyId, expectedVersion: prepared.journey.version });
  const plan = runtime.composeEpisodes(started.journey.journeyId, started.journey.version, {
    identityHistory: { recentEpisodeFingerprints: [] },
    region: { id: "region_gray_harbor", type: "region", label: "灰港", sourceFactIds: ["world:region"] },
    season: "current",
    resources: {},
    unresolvedClues: [],
    availableWorldObjects: [{
      id: "agent_other",
      type: "agent",
      label: "同行者",
      regionId: "region_gray_harbor",
      sourceFactIds: ["event:other"],
      participantIds: ["agent_other"],
      tags: ["social"],
    }],
    episodeCount: 1,
  });
  const episode = plan.episodes[0];
  assert.ok(episode);
  const serverFacts = buildServerJourneyEpisodeFacts({
    journeyId: started.journey.journeyId,
    episodeId: episode.episodeId,
    phase: episode.phase || "main",
    title: episode.title,
    agent: { id: "agent_metric" },
    worldObjectRefs: episode.worldObjectRefs,
    action: { optionLabel: "服务器签发行动", outcomeSummary: "服务器完成结算。" },
    canonicalEventIds: ["event_metric_canonical"],
  });
  runtime.commitEpisodes(started.journey.journeyId, started.journey.version, [{
    ...episode,
    serverFacts,
    narrative: buildPersistedJourneyNarrative({ serverFacts }).value,
    settlement: { canonicalEventIds: serverFacts.sourceEventIds, outcomeSummary: "服务器完成结算。" },
  }]);
  const canonicalEvent = {
    eventId: "event_metric_canonical",
    eventType: "hosted_action_recorded",
    aggregateType: "hosted_session",
    aggregateId: "session_metric",
    actorExplorerId: "explorer_metric",
    agentId: "agent_metric",
    trustClass: "owner_verified",
    causationId: episode.episodeId,
    correlationId: started.journey.correlationId,
    createdAt: "2026-01-01T00:00:00.000Z",
    payload: {},
  } as unknown as EpochEvent;
  const metrics = journeyMetricsView(runtime.projection(), [canonicalEvent]);
  assert.equal(metrics.journeys.total, 1);
  assert.equal(metrics.episodes.total, 1);
  assert.equal(metrics.episodes.social, 1);
  assert.equal(metrics.interruptionsPerJourney.max, 0);
  assert.equal(metrics.briefing.maxExpandedInteractionItems, 1);
  assert.equal(metrics.pollIntervalMs.p95, 60_000);
  assert.equal(metrics.security.groundedEpisodeRate, 1);
  assert.equal(metrics.security.canonicalEventCoverage, 1);
  assert.equal(metrics.security.correlationCoverage, 1);
  assert.deepEqual(metrics.errorBudget, {
    groundedNarrativeAlert: false,
    canonicalEventMissingAlert: false,
    correlationBreakAlert: false,
  });
  const broken = journeyMetricsView(runtime.projection(), [{
    ...canonicalEvent,
    correlationId: "correlation_wrong",
  }]);
  assert.equal(broken.errorBudget.correlationBreakAlert, true);
});

test("idle HTTP MCP sessions expire and reject reuse", () => {
  let now = 1_000;
  const metrics = createMcpTransportMetrics();
  const sessions = createMcpHttpSessionRegistry(metrics, { sessionTtlMs: 100, now: () => now });
  const created = sessions.create("bootstrap");
  assert.equal(sessions.get(created.session.sessionId, "bootstrap"), created);
  now = 1_101;
  assert.equal(sessions.get(created.session.sessionId, "bootstrap"), undefined);
  assert.equal(created.session.state, "closed");
  assert.equal(metrics.snapshot().transport.sessionsClosed, 1);
});
