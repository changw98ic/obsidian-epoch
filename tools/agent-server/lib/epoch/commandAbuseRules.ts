import type {
  AbuseScoreChangedPayload,
  CommandRejectedPayload,
  EpochEvent,
} from "./events.ts";
import type { EpochEventFactory } from "./eventFactory.ts";
import { assertNonEmptyString, type EpochIdFactory } from "./protocol.ts";

export interface CommandAbuseScoreDelta {
  readonly delta: number;
  readonly reason: string;
}

export interface CommandRejectedPayloadInput {
  readonly rejectionId: string;
  readonly surface?: string;
  readonly command: string;
  readonly errorCode: string;
  readonly statusCode?: unknown;
  readonly actorKey?: string;
  readonly agentId?: string;
  readonly explorerId?: string;
  readonly actorExplorerId?: string;
  readonly rejectedAt: string;
  readonly inputSummary?: Readonly<Record<string, unknown>>;
}

export interface AbuseScoreChangedPayloadInput {
  readonly scoreChangeId: string;
  readonly rejectedPayload: CommandRejectedPayload;
  readonly sourceEventId: string;
  readonly previousScore: number;
  readonly changedAt: string;
}

export interface CommandAbuseScoreLike {
  readonly score: number;
}

export interface CommandAbuseProjection {
  readonly abuseScores: Readonly<Record<string, CommandAbuseScoreLike | undefined>>;
}

export interface PlanCommandRejectedEventsInput {
  readonly projection: CommandAbuseProjection;
  readonly surface?: string;
  readonly command: string;
  readonly errorCode: string;
  readonly statusCode?: unknown;
  readonly actorKey?: string;
  readonly agentId?: string;
  readonly explorerId?: string;
  readonly actorExplorerId?: string;
  readonly rejectedAt: string;
  readonly inputSummary?: Readonly<Record<string, unknown>>;
  readonly idFactory: EpochIdFactory;
  readonly makeEvent: EpochEventFactory;
}

function optionalTrimmedString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

export function abuseScoreForRejectedCommand(errorCode: string): CommandAbuseScoreDelta {
  if (errorCode === "epoch_abuse_limit_exceeded") {
    return { delta: 3, reason: "rate_limit" };
  }
  if (errorCode === "epoch_abuse_score_restricted") {
    return { delta: 3, reason: "score_restricted" };
  }
  if (
    errorCode === "explorer_auth_invalid"
    || errorCode === "attestation_signature_invalid"
    || errorCode.endsWith("_mismatch")
    || errorCode.endsWith("_owner_mismatch")
    || errorCode.endsWith("_option_not_found")
  ) {
    return { delta: 2, reason: "invalid_authority" };
  }
  if (
    errorCode === "explorer_auth_required"
    || errorCode === "operator_key_required"
    || errorCode === "idempotency_key_required"
  ) {
    return { delta: 1, reason: "missing_auth" };
  }
  return { delta: 1, reason: "invalid_command" };
}

export function commandRejectedPayload(input: CommandRejectedPayloadInput): CommandRejectedPayload {
  const agentId = optionalTrimmedString(input.agentId);
  const explorerId = optionalTrimmedString(input.explorerId);
  return {
    rejectionId: input.rejectionId,
    surface: input.surface === "mcp" ? "mcp" : "http",
    command: assertNonEmptyString(input.command, "command"),
    errorCode: assertNonEmptyString(input.errorCode, "error_code"),
    statusCode: typeof input.statusCode === "number" ? input.statusCode : undefined,
    actorKey: assertNonEmptyString(
      input.actorKey || agentId || explorerId || input.actorExplorerId,
      "actor_key",
    ),
    agentId,
    explorerId,
    rejectedAt: input.rejectedAt,
    inputSummary: input.inputSummary || {},
  };
}

export function abuseScoreChangedPayload(input: AbuseScoreChangedPayloadInput): AbuseScoreChangedPayload {
  const abuseScore = abuseScoreForRejectedCommand(input.rejectedPayload.errorCode);
  return {
    scoreChangeId: input.scoreChangeId,
    actorKey: input.rejectedPayload.actorKey,
    agentId: input.rejectedPayload.agentId,
    explorerId: input.rejectedPayload.explorerId,
    sourceEventId: input.sourceEventId,
    sourceErrorCode: input.rejectedPayload.errorCode,
    delta: abuseScore.delta,
    scoreAfter: input.previousScore + abuseScore.delta,
    reason: abuseScore.reason,
    changedAt: input.changedAt,
  };
}

export function planCommandRejectedEvents(input: PlanCommandRejectedEventsInput): readonly EpochEvent[] {
  const rejectionId = input.idFactory("command");
  const payload = commandRejectedPayload({
    rejectionId,
    surface: input.surface === "mcp" ? "mcp" : "http",
    command: input.command,
    errorCode: input.errorCode,
    statusCode: input.statusCode,
    actorKey: input.actorKey,
    agentId: input.agentId,
    explorerId: input.explorerId,
    actorExplorerId: input.actorExplorerId,
    rejectedAt: input.rejectedAt,
    inputSummary: input.inputSummary,
  });
  const rejected = input.makeEvent("command_rejected", rejectionId, payload, {
    aggregateType: "audit_record",
    agentId: payload.agentId,
  });
  const scorePayload = abuseScoreChangedPayload({
    scoreChangeId: input.idFactory("command", `${payload.actorKey}:${rejectionId}:abuse_score`),
    rejectedPayload: payload,
    sourceEventId: rejected.eventId,
    previousScore: input.projection.abuseScores[payload.actorKey]?.score || 0,
    changedAt: input.rejectedAt,
  });
  const scoreChanged = input.makeEvent("abuse_score_changed", payload.actorKey, scorePayload, {
    aggregateType: "abuse_profile",
    agentId: payload.agentId,
  });
  return [rejected, scoreChanged];
}

export function projectCommandRejectedEvent(events: readonly EpochEvent[]): EpochEvent {
  const rejected = events.find((event) => event.eventType === "command_rejected");
  if (!rejected) throw new Error("command_rejected_projection_failed");
  return rejected;
}
