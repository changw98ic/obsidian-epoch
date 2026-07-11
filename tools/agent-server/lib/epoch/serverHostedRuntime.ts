import { resolveEpochCanonicalRegionId } from "../regionAliases.ts";
import {
  assertNonEmptyString,
  type EpochCommandContext,
} from "./protocol.ts";
import type {
  CanRunServerHostedJobOptionInput,
  CompleteServerHostedJobInput,
  EpochHostedActionRecord,
  EpochHostedSession,
  EpochProjection,
  EpochServerHostedJob,
  QueueServerHostedJobInput,
  SkipServerHostedJobInput,
  StartHostedSessionInput,
  SubmitHostedActionInput,
} from "./gameCore.ts";
import type {
  EpochRuntimeResult,
  EpochServerHostedActionRun,
  EpochServerHostedJobRun,
  EpochServerHostedJobsInfo,
} from "./runtime.ts";
import {
  selectQueuedServerHostedJob,
  serverHostedContext,
  serverHostedJobsQuery,
  serverHostedJobsView,
  serverHostedOptionKey,
} from "./serverHostedRuntimeRules.ts";

type AnyRecord = Record<string, unknown>;

export interface ServerHostedRuntime {
  readonly runAction: (input?: AnyRecord) => EpochRuntimeResult<EpochServerHostedActionRun>;
  readonly queueAction: (input?: AnyRecord) => EpochRuntimeResult<EpochServerHostedJob>;
  readonly jobs: (input?: AnyRecord) => EpochServerHostedJobsInfo;
  readonly runJob: (input?: AnyRecord) => EpochRuntimeResult<EpochServerHostedJobRun>;
}

export interface ServerHostedRuntimeOptions {
  readonly assertOperatorKey: (input: AnyRecord) => void;
  readonly assertPublicTextSafe: (input: AnyRecord, value: unknown) => void;
  readonly idempotently: <TValue>(
    scope: string,
    input: AnyRecord,
    run: () => EpochRuntimeResult<TValue>,
    options?: { readonly allowRestrictedScore?: boolean },
  ) => EpochRuntimeResult<TValue>;
  readonly requireIdentity: (agentId: string) => void;
  readonly project: () => EpochProjection;
  readonly startHostedSession: (
    input: StartHostedSessionInput,
    context: EpochCommandContext,
  ) => EpochRuntimeResult<EpochHostedSession>;
  readonly submitHostedAction: (
    input: SubmitHostedActionInput,
    context: EpochCommandContext,
  ) => EpochRuntimeResult<EpochHostedActionRecord>;
  readonly queueServerHostedJob: (
    input: QueueServerHostedJobInput,
    context: EpochCommandContext,
  ) => EpochRuntimeResult<EpochServerHostedJob>;
  readonly canRunServerHostedJobOption: (
    input: CanRunServerHostedJobOptionInput,
    context: EpochCommandContext,
  ) => boolean;
  readonly completeServerHostedJob: (
    input: CompleteServerHostedJobInput,
    context: EpochCommandContext,
  ) => EpochRuntimeResult<EpochServerHostedJob>;
  readonly skipServerHostedJob: (
    input: SkipServerHostedJobInput,
    context: EpochCommandContext,
  ) => EpochRuntimeResult<EpochServerHostedJob>;
}

function optionalString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

export function createServerHostedRuntime(options: ServerHostedRuntimeOptions): ServerHostedRuntime {
  function executeAction(input: AnyRecord, baseKey: string): EpochRuntimeResult<EpochServerHostedActionRun> {
    const agentId = assertNonEmptyString(input.agentId, "agent_id");
    const regionId = resolveEpochCanonicalRegionId(assertNonEmptyString(input.regionId, "region_id"));
    const optionKey = serverHostedOptionKey(input);
    options.requireIdentity(agentId);
    const sessionResult = options.startHostedSession({
      agentId,
      regionId,
      mandate: optionalString(input.mandate),
    }, serverHostedContext(input, `${baseKey}:start`));
    const option = sessionResult.value.actionOptions.find((candidate) => candidate.optionKey === optionKey);
    if (!option) throw new Error("hosted_action_option_not_found");
    const actionResult = options.submitHostedAction({
      sessionId: sessionResult.value.sessionId,
      actionOptionId: option.actionOptionId,
      visibleText: optionalString(input.visibleText),
    }, serverHostedContext(input, `${baseKey}:action`));
    const session = actionResult.projection.hostedSessions[sessionResult.value.sessionId];
    if (!session) throw new Error("hosted_session_not_found");
    return {
      events: [...sessionResult.events, ...actionResult.events],
      value: {
        session,
        action: actionResult.value,
      },
      projection: actionResult.projection,
    };
  }

  function runAction(input: AnyRecord = {}): EpochRuntimeResult<EpochServerHostedActionRun> {
    options.assertOperatorKey(input);
    assertNonEmptyString(input.agentId, "agent_id");
    assertNonEmptyString(input.regionId, "region_id");
    serverHostedOptionKey(input);
    options.assertPublicTextSafe(input, input.mandate);
    options.assertPublicTextSafe(input, input.visibleText);
    return options.idempotently("run_server_hosted_action", input, () => {
      const baseKey = String(input.idempotencyKey).trim();
      return executeAction(input, `run_server_hosted_action:${baseKey}`);
    }, { allowRestrictedScore: true });
  }

  function queueAction(input: AnyRecord = {}): EpochRuntimeResult<EpochServerHostedJob> {
    options.assertOperatorKey(input);
    assertNonEmptyString(input.agentId, "agent_id");
    assertNonEmptyString(input.regionId, "region_id");
    const optionKey = serverHostedOptionKey(input);
    options.assertPublicTextSafe(input, input.mandate);
    options.assertPublicTextSafe(input, input.visibleText);
    return options.idempotently("queue_server_hosted_action", input, () => {
      const baseKey = String(input.idempotencyKey).trim();
      return options.queueServerHostedJob({
        agentId: assertNonEmptyString(input.agentId, "agent_id"),
        regionId: resolveEpochCanonicalRegionId(assertNonEmptyString(input.regionId, "region_id")),
        mandate: optionalString(input.mandate),
        optionKey,
        visibleText: optionalString(input.visibleText),
      }, serverHostedContext(input, `queue_server_hosted_action:${baseKey}`));
    }, { allowRestrictedScore: true });
  }

  function jobs(input: AnyRecord = {}): EpochServerHostedJobsInfo {
    options.assertOperatorKey(input);
    const { agentId, status } = serverHostedJobsQuery(input);
    return {
      agentId,
      status,
      jobs: serverHostedJobsView(options.project(), { agentId, status }),
    };
  }

  function runJob(input: AnyRecord = {}): EpochRuntimeResult<EpochServerHostedJobRun> {
    options.assertOperatorKey(input);
    return options.idempotently<EpochServerHostedJobRun>("run_server_hosted_job", input, () => {
      const projection = options.project();
      const job = selectQueuedServerHostedJob(projection, input);
      const baseKey = String(input.idempotencyKey).trim();
      if (!options.canRunServerHostedJobOption({
        agentId: job.agentId,
        optionKey: job.optionKey,
      }, serverHostedContext(input, `run_server_hosted_job:${baseKey}:preflight`))) {
        const skipped = options.skipServerHostedJob({
          jobId: job.jobId,
          reason: "action_option_unavailable",
        }, serverHostedContext(input, `run_server_hosted_job:${baseKey}:skip`));
        return {
          events: skipped.events,
          value: {
            job: skipped.value,
          },
          projection: skipped.projection,
        };
      }
      const run = executeAction({
        ...input,
        agentId: job.agentId,
        regionId: job.regionId,
        mandate: job.mandate,
        optionKey: job.optionKey,
        visibleText: optionalString(input.visibleText) ?? job.visibleText,
      }, `run_server_hosted_job:${baseKey}`);
      const completed = options.completeServerHostedJob({
        jobId: job.jobId,
        sessionId: run.value.session.sessionId,
        actionId: run.value.action.actionId,
      }, serverHostedContext(input, `run_server_hosted_job:${baseKey}:complete`));
      return {
        events: [...run.events, ...completed.events],
        value: {
          job: completed.value,
          run: run.value,
        },
        projection: completed.projection,
      };
    }, { allowRestrictedScore: true });
  }

  return {
    runAction,
    queueAction,
    jobs,
    runJob,
  };
}
