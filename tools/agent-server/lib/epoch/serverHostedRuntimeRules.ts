import type {
  EpochEvent,
  ServerHostedJobCompletedPayload,
  ServerHostedJobQueuedPayload,
  ServerHostedJobSkippedPayload,
} from "./events.ts";
import type { EpochEventFactory } from "./eventFactory.ts";
import type {
  EpochProjection,
  EpochServerHostedJob,
} from "./gameCore.ts";
import type { EpochCommandContext } from "./protocol.ts";

type AnyRecord = Readonly<Record<string, unknown>>;

export type ServerHostedOptionKey = "observe" | "assist" | "anomaly";

export interface ServerHostedJobsQuery {
  readonly agentId?: string;
  readonly status?: string;
}

export interface ServerHostedJobQueuedPayloadInput {
  readonly jobId: string;
  readonly agentId: string;
  readonly explorerId: string;
  readonly regionId: string;
  readonly mandate: string;
  readonly optionKey: ServerHostedOptionKey;
  readonly visibleText?: string;
  readonly queuedBy: string;
  readonly queuedAt: string;
}

export interface ServerHostedJobCompletedPayloadInput {
  readonly jobId: string;
  readonly agentId: string;
  readonly sessionId: string;
  readonly actionId: string;
  readonly completedAt: string;
}

export interface ServerHostedJobSkippedPayloadInput {
  readonly jobId: string;
  readonly agentId: string;
  readonly reason: ServerHostedJobSkippedPayload["reason"];
  readonly skippedAt: string;
}

export interface PlanServerHostedJobQueuedEventsInput extends ServerHostedJobQueuedPayloadInput {
  readonly makeEvent: EpochEventFactory;
}

export interface PlanServerHostedJobCompletedEventsInput extends ServerHostedJobCompletedPayloadInput {
  readonly makeEvent: EpochEventFactory;
}

export interface PlanServerHostedJobSkippedEventsInput extends ServerHostedJobSkippedPayloadInput {
  readonly makeEvent: EpochEventFactory;
}

function optionalTrimmedString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function serverHostedContext(input: AnyRecord, idempotencyKey: string): EpochCommandContext {
  return {
    actorExplorerId: "server_hosted_agent",
    trustClass: "server_hosted_agent",
    idempotencyKey,
    causationId: typeof input.causationId === "string" ? input.causationId : undefined,
    correlationId: typeof input.correlationId === "string" ? input.correlationId : undefined,
  };
}

export function serverHostedOptionKey(input: AnyRecord): ServerHostedOptionKey {
  const optionKey = optionalTrimmedString(input.optionKey) ?? "observe";
  if (optionKey !== "observe" && optionKey !== "assist" && optionKey !== "anomaly") {
    throw new Error("server_hosted_option_key_invalid");
  }
  return optionKey;
}

export function serverHostedJobsQuery(input: AnyRecord = {}): ServerHostedJobsQuery {
  return {
    agentId: optionalTrimmedString(input.agentId),
    status: optionalTrimmedString(input.status),
  };
}

export function serverHostedJobQueuedPayload(
  input: ServerHostedJobQueuedPayloadInput,
): ServerHostedJobQueuedPayload {
  return {
    jobId: input.jobId,
    agentId: input.agentId,
    explorerId: input.explorerId,
    regionId: input.regionId,
    mandate: input.mandate,
    optionKey: input.optionKey,
    visibleText: optionalTrimmedString(input.visibleText),
    deliveryTrust: "server_hosted_agent",
    queuedBy: input.queuedBy,
    queuedAt: input.queuedAt,
  };
}

export function serverHostedJobCompletedPayload(
  input: ServerHostedJobCompletedPayloadInput,
): ServerHostedJobCompletedPayload {
  return {
    jobId: input.jobId,
    agentId: input.agentId,
    sessionId: input.sessionId,
    actionId: input.actionId,
    completedAt: input.completedAt,
  };
}

export function serverHostedJobSkippedPayload(
  input: ServerHostedJobSkippedPayloadInput,
): ServerHostedJobSkippedPayload {
  return {
    jobId: input.jobId,
    agentId: input.agentId,
    reason: input.reason,
    skippedAt: input.skippedAt,
  };
}

export function planServerHostedJobQueuedEvents(input: PlanServerHostedJobQueuedEventsInput): readonly EpochEvent[] {
  const payload = serverHostedJobQueuedPayload(input);
  return [input.makeEvent("server_hosted_job_queued", input.jobId, payload, {
    aggregateType: "server_hosted_job",
    agentId: input.agentId,
  })];
}

export function planServerHostedJobCompletedEvents(input: PlanServerHostedJobCompletedEventsInput): readonly EpochEvent[] {
  const payload = serverHostedJobCompletedPayload(input);
  return [input.makeEvent("server_hosted_job_completed", input.jobId, payload, {
    aggregateType: "server_hosted_job",
    agentId: input.agentId,
  })];
}

export function planServerHostedJobSkippedEvents(input: PlanServerHostedJobSkippedEventsInput): readonly EpochEvent[] {
  const payload = serverHostedJobSkippedPayload(input);
  return [input.makeEvent("server_hosted_job_skipped", input.jobId, payload, {
    aggregateType: "server_hosted_job",
    agentId: input.agentId,
  })];
}

export function serverHostedJobsView(
  projection: Pick<EpochProjection, "serverHostedJobs">,
  input: ServerHostedJobsQuery = {},
): readonly EpochServerHostedJob[] {
  return Object.values(projection.serverHostedJobs)
    .filter((job) => !input.agentId || job.agentId === input.agentId)
    .filter((job) => !input.status || job.status === input.status)
    .sort((left, right) => right.queuedAt.localeCompare(left.queuedAt) || left.jobId.localeCompare(right.jobId));
}

export function selectQueuedServerHostedJob(
  projection: Pick<EpochProjection, "serverHostedJobs">,
  input: AnyRecord = {},
): EpochServerHostedJob {
  const requestedJobId = optionalTrimmedString(input.jobId);
  const { agentId } = serverHostedJobsQuery(input);
  const job = requestedJobId
    ? projection.serverHostedJobs[requestedJobId]
    : serverHostedJobsView(projection, { agentId, status: "queued" })[0];
  if (!job) throw new Error("server_hosted_job_not_found");
  if (agentId && job.agentId !== agentId) throw new Error("server_hosted_job_agent_mismatch");
  if (job.status !== "queued") throw new Error("server_hosted_job_not_queued");
  return job;
}
