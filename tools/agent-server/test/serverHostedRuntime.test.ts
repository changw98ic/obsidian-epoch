import assert from "node:assert/strict";
import test from "node:test";
import { createServerHostedRuntime } from "../lib/epoch/serverHostedRuntime.ts";
import type { EpochCommandContext } from "../lib/epoch/protocol.ts";
import type {
  EpochHostedActionRecord,
  EpochHostedSession,
  EpochProjection,
  EpochServerHostedJob,
} from "../lib/epoch/gameCore.ts";
import type { EpochRuntimeResult } from "../lib/epoch/runtime.ts";

type AnyRecord = Record<string, unknown>;

function session(input: Partial<EpochHostedSession> = {}): EpochHostedSession {
  return {
    sessionId: "session_1",
    agentId: "agent_1",
    explorerId: "explorer_1",
    regionId: "region_gray_harbor",
    mandate: "托管巡逻",
    channelClass: "server_hosted",
    deliveryTrust: "server_hosted_agent",
    status: "completed",
    actionOptions: [
      {
        actionOptionId: "option_observe",
        optionKey: "observe",
        label: "观察",
        risk: "low",
        explanation: { title: "观察", body: "整理线索。" },
      },
      {
        actionOptionId: "option_assist",
        optionKey: "assist",
        label: "协助",
        risk: "low",
        explanation: { title: "协助", body: "协助现场。" },
      },
    ],
    actions: [],
    startedAt: "2026-07-06T00:00:00.000Z",
    ...input,
  } as EpochHostedSession;
}

function action(input: Partial<EpochHostedActionRecord> = {}): EpochHostedActionRecord {
  return {
    actionId: "action_1",
    sessionId: "session_1",
    agentId: "agent_1",
    channelClass: "server_hosted",
    deliveryTrust: "server_hosted_agent",
    actionOptionId: "option_assist",
    optionLabel: "协助",
    explanation: { title: "协助", body: "协助现场。" },
    outcomeSummary: "托管行动完成。",
    recordedAt: "2026-07-06T00:00:01.000Z",
    signedEnvelope: {},
    ...input,
  } as EpochHostedActionRecord;
}

function job(input: Partial<EpochServerHostedJob> = {}): EpochServerHostedJob {
  return {
    jobId: "job_1",
    agentId: "agent_1",
    explorerId: "operator",
    regionId: "region_gray_harbor",
    mandate: "托管巡逻",
    optionKey: "assist",
    visibleText: "执行协助。",
    status: "queued",
    deliveryTrust: "server_hosted_agent",
    queuedBy: "operator",
    queuedAt: "2026-07-06T00:00:00.000Z",
    ...input,
  } as EpochServerHostedJob;
}

function runtimeResult<TValue>(value: TValue, projection: EpochProjection): EpochRuntimeResult<TValue> {
  return {
    value,
    events: [],
    projection,
  };
}

function createHarness(input: {
  readonly jobs?: readonly EpochServerHostedJob[];
  readonly canRun?: boolean;
} = {}) {
  const contexts: Array<{ readonly label: string; readonly context: EpochCommandContext }> = [];
  const textChecks: unknown[] = [];
  const idempotencyScopes: string[] = [];
  const identities: string[] = [];
  const startInputs: AnyRecord[] = [];
  const submitInputs: AnyRecord[] = [];
  const queueInputs: AnyRecord[] = [];
  const completeInputs: AnyRecord[] = [];
  const skipInputs: AnyRecord[] = [];
  const completedSession = session();
  const projection = (): EpochProjection => ({
    hostedSessions: { [completedSession.sessionId]: completedSession },
    serverHostedJobs: Object.fromEntries((input.jobs || []).map((item) => [item.jobId, item])),
  }) as unknown as EpochProjection;
  const runtime = createServerHostedRuntime({
    assertOperatorKey: (request) => {
      if (request.operatorKey !== "operator_secret") throw new Error("operator_key_invalid");
    },
    assertPublicTextSafe: (_request, value) => {
      textChecks.push(value);
    },
    idempotently: (scope, _request, run) => {
      idempotencyScopes.push(scope);
      return run();
    },
    requireIdentity: (agentId) => {
      identities.push(agentId);
    },
    project: projection,
    startHostedSession: (startInput, context) => {
      startInputs.push(startInput as unknown as AnyRecord);
      contexts.push({ label: "start", context });
      return runtimeResult(session({
        sessionId: "session_1",
        regionId: startInput.regionId,
        mandate: startInput.mandate || "托管巡逻",
        actionOptions: session().actionOptions,
      }), projection());
    },
    submitHostedAction: (submitInput, context) => {
      submitInputs.push(submitInput as unknown as AnyRecord);
      contexts.push({ label: "action", context });
      return runtimeResult(action({
        actionOptionId: submitInput.actionOptionId,
        sessionId: submitInput.sessionId,
      }), projection());
    },
    queueServerHostedJob: (queueInput, context) => {
      queueInputs.push(queueInput as unknown as AnyRecord);
      contexts.push({ label: "queue", context });
      return runtimeResult(job({
        jobId: "job_queued",
        agentId: queueInput.agentId,
        regionId: queueInput.regionId,
        mandate: queueInput.mandate,
        optionKey: queueInput.optionKey,
        visibleText: queueInput.visibleText,
      }), projection());
    },
    canRunServerHostedJobOption: (_canRunInput, context) => {
      contexts.push({ label: "preflight", context });
      return input.canRun !== false;
    },
    completeServerHostedJob: (completeInput, context) => {
      completeInputs.push(completeInput as unknown as AnyRecord);
      contexts.push({ label: "complete", context });
      return runtimeResult(job({
        jobId: completeInput.jobId,
        status: "completed",
      }), projection());
    },
    skipServerHostedJob: (skipInput, context) => {
      skipInputs.push(skipInput as unknown as AnyRecord);
      contexts.push({ label: "skip", context });
      return runtimeResult(job({
        jobId: skipInput.jobId,
        status: "skipped",
        skipReason: skipInput.reason,
      }), projection());
    },
  });
  return {
    runtime,
    contexts,
    textChecks,
    idempotencyScopes,
    identities,
    startInputs,
    submitInputs,
    queueInputs,
    completeInputs,
    skipInputs,
  };
}

test("server-hosted runtime runs immediate actions through server-hosted contexts", () => {
  const harness = createHarness();

  const result = harness.runtime.runAction({
    operatorKey: "operator_secret",
    agentId: "agent_1",
    regionId: "region_gray_harbor",
    optionKey: "assist",
    mandate: "托管巡逻",
    visibleText: "执行协助。",
    idempotencyKey: "run_1",
  });

  assert.equal(result.value.session.sessionId, "session_1");
  assert.equal(result.value.action.actionOptionId, "option_assist");
  assert.deepEqual(harness.idempotencyScopes, ["run_server_hosted_action"]);
  assert.deepEqual(harness.textChecks, ["托管巡逻", "执行协助。"]);
  assert.deepEqual(harness.identities, ["agent_1"]);
  assert.equal(harness.startInputs[0].regionId, "region_gray_harbor");
  assert.equal(harness.submitInputs[0].actionOptionId, "option_assist");
  assert.deepEqual(harness.contexts.map((item) => [item.label, item.context.idempotencyKey]), [
    ["start", "run_server_hosted_action:run_1:start"],
    ["action", "run_server_hosted_action:run_1:action"],
  ]);
});

test("server-hosted runtime queues and lists operator jobs", () => {
  const queued = job({
    jobId: "job_b",
    queuedAt: "2026-07-06T10:00:00.000Z",
  });
  const harness = createHarness({ jobs: [queued] });

  const queuedResult = harness.runtime.queueAction({
    operatorKey: "operator_secret",
    agentId: "agent_1",
    regionId: "region_gray_harbor",
    optionKey: "anomaly",
    mandate: "巡查异常",
    visibleText: "执行异常巡查。",
    idempotencyKey: "queue_1",
  });

  assert.equal(queuedResult.value.jobId, "job_queued");
  assert.equal(harness.queueInputs[0].optionKey, "anomaly");
  assert.equal(harness.contexts.at(-1)?.context.idempotencyKey, "queue_server_hosted_action:queue_1");
  assert.deepEqual(harness.runtime.jobs({
    operatorKey: "operator_secret",
    agentId: "agent_1",
    status: "queued",
  }).jobs.map((item) => item.jobId), ["job_b"]);
});

test("server-hosted runtime completes queued jobs when options remain legal", () => {
  const harness = createHarness({ jobs: [job({ jobId: "job_run" })] });

  const result = harness.runtime.runJob({
    operatorKey: "operator_secret",
    jobId: "job_run",
    idempotencyKey: "job_1",
  });

  assert.equal(result.value.job.status, "completed");
  assert.equal(result.value.run?.action.actionId, "action_1");
  assert.deepEqual(harness.completeInputs, [{
    jobId: "job_run",
    sessionId: "session_1",
    actionId: "action_1",
  }]);
  assert.deepEqual(harness.contexts.map((item) => [item.label, item.context.idempotencyKey]), [
    ["preflight", "run_server_hosted_job:job_1:preflight"],
    ["start", "run_server_hosted_job:job_1:start"],
    ["action", "run_server_hosted_job:job_1:action"],
    ["complete", "run_server_hosted_job:job_1:complete"],
  ]);
});

test("server-hosted runtime skips queued jobs when their option is no longer legal", () => {
  const harness = createHarness({
    jobs: [job({ jobId: "job_skip" })],
    canRun: false,
  });

  const result = harness.runtime.runJob({
    operatorKey: "operator_secret",
    jobId: "job_skip",
    idempotencyKey: "job_2",
  });

  assert.equal(result.value.job.status, "skipped");
  assert.equal(result.value.run, undefined);
  assert.deepEqual(harness.skipInputs, [{
    jobId: "job_skip",
    reason: "action_option_unavailable",
  }]);
  assert.deepEqual(harness.contexts.map((item) => [item.label, item.context.idempotencyKey]), [
    ["preflight", "run_server_hosted_job:job_2:preflight"],
    ["skip", "run_server_hosted_job:job_2:skip"],
  ]);
});
