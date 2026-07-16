import assert from "node:assert/strict";
import test from "node:test";

import {
  planServerHostedJobCompletedEvents,
  planServerHostedJobQueuedEvents,
  planServerHostedJobSkippedEvents,
  selectQueuedServerHostedJob,
  serverHostedContext,
  serverHostedJobCompletedPayload,
  serverHostedJobQueuedPayload,
  serverHostedJobSkippedPayload,
  serverHostedJobsQuery,
  serverHostedJobsView,
  serverHostedOptionKey,
} from "../lib/epoch/serverHostedRuntimeRules.ts";
import type { EpochEventFactory } from "../lib/epoch/eventFactory.ts";
import type {
  EpochProjection,
  EpochServerHostedJob,
} from "../lib/epoch/gameCore.ts";

let eventSequence = 0;

const makeEvent = ((eventType, aggregateId, payload, options = {}) => ({
  eventId: `${eventType}_${++eventSequence}`,
  eventType,
  aggregateId,
  aggregateType: options.aggregateType || "agent_identity",
  agentId: options.agentId,
  payload,
  createdAt: "2026-07-07T01:00:00.000Z",
})) as EpochEventFactory;

function job(input: Partial<EpochServerHostedJob> & Pick<EpochServerHostedJob, "jobId" | "agentId" | "status" | "queuedAt">): EpochServerHostedJob {
  return {
    explorerId: "operator",
    regionId: "gray_harbor",
    mandate: "托管巡逻",
    optionKey: "observe",
    deliveryTrust: "server_hosted_agent",
    queuedBy: "operator",
    ...input,
  };
}

function projection(jobs: readonly EpochServerHostedJob[]): EpochProjection {
  return {
    serverHostedJobs: Object.fromEntries(jobs.map((item) => [item.jobId, item])),
  } as unknown as EpochProjection;
}

test("server-hosted runtime rules normalize option keys and command context", () => {
  assert.equal(serverHostedOptionKey({}), "observe");
  assert.equal(serverHostedOptionKey({ optionKey: " assist " }), "assist");
  assert.equal(serverHostedOptionKey({ optionKey: "anomaly" }), "anomaly");
  assert.throws(
    () => serverHostedOptionKey({ optionKey: "high_risk" }),
    /server_hosted_option_key_invalid/,
  );

  assert.deepEqual(serverHostedContext({
    causationId: "cause-1",
    correlationId: "corr-1",
  }, "job-key-1"), {
    actorExplorerId: "server_hosted_agent",
    trustClass: "server_hosted_agent",
    idempotencyKey: "job-key-1",
    causationId: "cause-1",
    correlationId: "corr-1",
  });
});

test("server-hosted runtime rules plan job lifecycle payloads", () => {
  assert.deepEqual(serverHostedJobQueuedPayload({
    jobId: "server_hosted_job_1",
    agentId: "agent-1",
    explorerId: "explorer-1",
    regionId: "region_gray_harbor",
    mandate: "托管巡逻",
    optionKey: "assist",
    visibleText: "  公开行动说明  ",
    queuedBy: "operator-1",
    queuedAt: "2026-07-07T01:00:00.000Z",
  }), {
    jobId: "server_hosted_job_1",
    agentId: "agent-1",
    explorerId: "explorer-1",
    regionId: "region_gray_harbor",
    mandate: "托管巡逻",
    optionKey: "assist",
    visibleText: "公开行动说明",
    deliveryTrust: "server_hosted_agent",
    queuedBy: "operator-1",
    queuedAt: "2026-07-07T01:00:00.000Z",
  });
  assert.equal(serverHostedJobQueuedPayload({
    jobId: "server_hosted_job_2",
    agentId: "agent-1",
    explorerId: "explorer-1",
    regionId: "region_gray_harbor",
    mandate: "托管巡逻",
    optionKey: "observe",
    visibleText: "   ",
    queuedBy: "operator-1",
    queuedAt: "2026-07-07T01:00:00.000Z",
  }).visibleText, undefined);

  assert.deepEqual(serverHostedJobCompletedPayload({
    jobId: "server_hosted_job_1",
    agentId: "agent-1",
    sessionId: "session-1",
    actionId: "action-1",
    completedAt: "2026-07-07T01:01:00.000Z",
  }), {
    jobId: "server_hosted_job_1",
    agentId: "agent-1",
    sessionId: "session-1",
    actionId: "action-1",
    completedAt: "2026-07-07T01:01:00.000Z",
  });
  assert.deepEqual(serverHostedJobSkippedPayload({
    jobId: "server_hosted_job_1",
    agentId: "agent-1",
    reason: "action_option_unavailable",
    skippedAt: "2026-07-07T01:02:00.000Z",
  }), {
    jobId: "server_hosted_job_1",
    agentId: "agent-1",
    reason: "action_option_unavailable",
    skippedAt: "2026-07-07T01:02:00.000Z",
  });
});

test("server-hosted runtime rules plan job lifecycle event sequences", () => {
  const queuedEvents = planServerHostedJobQueuedEvents({
    makeEvent,
    jobId: "server_hosted_job_1",
    agentId: "agent-1",
    explorerId: "explorer-1",
    regionId: "region_gray_harbor",
    mandate: "托管巡逻",
    optionKey: "assist",
    visibleText: "  公开行动说明  ",
    queuedBy: "operator-1",
    queuedAt: "2026-07-07T01:00:00.000Z",
  });
  assert.equal(queuedEvents.length, 1);
  assert.equal(queuedEvents[0].eventType, "server_hosted_job_queued");
  assert.equal(queuedEvents[0].aggregateType, "server_hosted_job");
  assert.equal(queuedEvents[0].agentId, "agent-1");
  assert.equal(queuedEvents[0].payload.visibleText, "公开行动说明");

  const completedEvents = planServerHostedJobCompletedEvents({
    makeEvent,
    jobId: "server_hosted_job_1",
    agentId: "agent-1",
    sessionId: "session-1",
    actionId: "action-1",
    completedAt: "2026-07-07T01:01:00.000Z",
  });
  assert.equal(completedEvents.length, 1);
  assert.equal(completedEvents[0].eventType, "server_hosted_job_completed");
  assert.equal(completedEvents[0].aggregateType, "server_hosted_job");
  assert.equal(completedEvents[0].payload.sessionId, "session-1");

  const skippedEvents = planServerHostedJobSkippedEvents({
    makeEvent,
    jobId: "server_hosted_job_1",
    agentId: "agent-1",
    reason: "action_option_unavailable",
    skippedAt: "2026-07-07T01:02:00.000Z",
  });
  assert.equal(skippedEvents.length, 1);
  assert.equal(skippedEvents[0].eventType, "server_hosted_job_skipped");
  assert.equal(skippedEvents[0].aggregateType, "server_hosted_job");
  assert.equal(skippedEvents[0].payload.reason, "action_option_unavailable");
});

test("server-hosted runtime rules filter and sort queued jobs", () => {
  const queuedLater = job({
    jobId: "job-b",
    agentId: "agent-1",
    status: "queued",
    queuedAt: "2026-07-06T10:00:00.000Z",
  });
  const queuedTie = job({
    jobId: "job-a",
    agentId: "agent-1",
    status: "queued",
    queuedAt: "2026-07-06T10:00:00.000Z",
  });
  const queuedEarlier = job({
    jobId: "job-c",
    agentId: "agent-2",
    status: "queued",
    queuedAt: "2026-07-06T09:00:00.000Z",
  });
  const completed = job({
    jobId: "job-d",
    agentId: "agent-1",
    status: "completed",
    queuedAt: "2026-07-06T11:00:00.000Z",
  });
  const state = projection([queuedEarlier, queuedLater, queuedTie, completed]);

  assert.deepEqual(serverHostedJobsQuery({
    agentId: " agent-1 ",
    status: " queued ",
  }), {
    agentId: "agent-1",
    status: "queued",
  });
  assert.deepEqual(
    serverHostedJobsView(state, { status: "queued" }).map((item) => item.jobId),
    ["job-a", "job-b", "job-c"],
  );
  assert.deepEqual(
    serverHostedJobsView(state, { agentId: "agent-1", status: "queued" }).map((item) => item.jobId),
    ["job-a", "job-b"],
  );
});

test("server-hosted runtime rules select a legal queued job before execution", () => {
  const state = projection([
    job({
      jobId: "job-old",
      agentId: "agent-1",
      status: "queued",
      queuedAt: "2026-07-06T09:00:00.000Z",
    }),
    job({
      jobId: "job-new",
      agentId: "agent-1",
      status: "queued",
      queuedAt: "2026-07-06T10:00:00.000Z",
    }),
    job({
      jobId: "job-done",
      agentId: "agent-2",
      status: "completed",
      queuedAt: "2026-07-06T11:00:00.000Z",
    }),
  ]);

  assert.equal(selectQueuedServerHostedJob(state, { agentId: "agent-1" }).jobId, "job-new");
  assert.equal(selectQueuedServerHostedJob(state, { jobId: "job-old" }).jobId, "job-old");
  assert.throws(
    () => selectQueuedServerHostedJob(state, { jobId: "job-old", agentId: "agent-2" }),
    /server_hosted_job_agent_mismatch/,
  );
  assert.throws(
    () => selectQueuedServerHostedJob(state, { jobId: "job-done" }),
    /server_hosted_job_not_queued/,
  );
  assert.throws(
    () => selectQueuedServerHostedJob(state, { agentId: "agent-missing" }),
    /server_hosted_job_not_found/,
  );
});
