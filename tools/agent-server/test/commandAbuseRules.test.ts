import assert from "node:assert/strict";
import test from "node:test";

import {
  abuseScoreChangedPayload,
  abuseScoreForRejectedCommand,
  commandRejectedPayload,
  planCommandRejectedEvents,
  projectCommandRejectedEvent,
} from "../lib/epoch/commandAbuseRules.ts";
import { eventFactory } from "../lib/epoch/eventFactory.ts";
import { createSequentialEpochIdFactory } from "../lib/epoch/protocol.ts";

test("command abuse rules score repeated abuse restrictions as high severity", () => {
  assert.deepEqual(abuseScoreForRejectedCommand("epoch_abuse_limit_exceeded"), {
    delta: 3,
    reason: "rate_limit",
  });
  assert.deepEqual(abuseScoreForRejectedCommand("epoch_abuse_score_restricted"), {
    delta: 3,
    reason: "score_restricted",
  });
});

test("command abuse rules classify invalid authority errors as medium severity", () => {
  assert.deepEqual(abuseScoreForRejectedCommand("explorer_auth_invalid"), {
    delta: 2,
    reason: "invalid_authority",
  });
  assert.deepEqual(abuseScoreForRejectedCommand("agent_owner_mismatch"), {
    delta: 2,
    reason: "invalid_authority",
  });
  assert.deepEqual(abuseScoreForRejectedCommand("turn_option_not_found"), {
    delta: 2,
    reason: "invalid_authority",
  });
});

test("command abuse rules distinguish missing auth from generic invalid commands", () => {
  assert.deepEqual(abuseScoreForRejectedCommand("operator_key_required"), {
    delta: 1,
    reason: "missing_auth",
  });
  assert.deepEqual(abuseScoreForRejectedCommand("malformed_payload"), {
    delta: 1,
    reason: "invalid_command",
  });
});

test("command abuse rules plan command rejection payloads", () => {
  assert.deepEqual(commandRejectedPayload({
    rejectionId: "command_1",
    surface: "mcp",
    command: "  resolve_turn  ",
    errorCode: "  agent_owner_mismatch  ",
    statusCode: 403,
    actorKey: undefined,
    agentId: "  agent_1  ",
    explorerId: "  explorer_1  ",
    actorExplorerId: "explorer_context",
    rejectedAt: "2026-07-06T01:30:00.000Z",
    inputSummary: { turnCardId: "turn_1" },
  }), {
    rejectionId: "command_1",
    surface: "mcp",
    command: "resolve_turn",
    errorCode: "agent_owner_mismatch",
    statusCode: 403,
    actorKey: "agent_1",
    agentId: "agent_1",
    explorerId: "explorer_1",
    rejectedAt: "2026-07-06T01:30:00.000Z",
    inputSummary: { turnCardId: "turn_1" },
  });

  assert.equal(commandRejectedPayload({
    rejectionId: "command_2",
    surface: "cli",
    command: "submit",
    errorCode: "malformed_payload",
    statusCode: "400",
    actorExplorerId: "explorer_context",
    rejectedAt: "2026-07-06T01:31:00.000Z",
  }).surface, "http");

  assert.throws(() => commandRejectedPayload({
    rejectionId: "command_3",
    surface: "http",
    command: "",
    errorCode: "malformed_payload",
    actorExplorerId: "explorer_context",
    rejectedAt: "2026-07-06T01:31:00.000Z",
  }), /command_required/);
});

test("command abuse rules plan abuse score payloads from rejected commands", () => {
  assert.deepEqual(abuseScoreChangedPayload({
    scoreChangeId: "command_1_abuse_score",
    rejectedPayload: {
      rejectionId: "command_1",
      surface: "http",
      command: "resolve_turn",
      errorCode: "agent_owner_mismatch",
      actorKey: "agent_1",
      agentId: "agent_1",
      explorerId: "explorer_1",
      rejectedAt: "2026-07-06T01:30:00.000Z",
      inputSummary: {},
    },
    sourceEventId: "event_rejected_1",
    previousScore: 4,
    changedAt: "2026-07-06T01:30:00.000Z",
  }), {
    scoreChangeId: "command_1_abuse_score",
    actorKey: "agent_1",
    agentId: "agent_1",
    explorerId: "explorer_1",
    sourceEventId: "event_rejected_1",
    sourceErrorCode: "agent_owner_mismatch",
    delta: 2,
    scoreAfter: 6,
    reason: "invalid_authority",
    changedAt: "2026-07-06T01:30:00.000Z",
  });
});

test("command abuse rules plan rejected command event sequences", () => {
  const idFactory = createSequentialEpochIdFactory("command_abuse");
  const rejectedAt = "2026-07-06T01:32:00.000Z";
  const context = {
    actorExplorerId: "system",
    trustClass: "system_worker" as const,
    causationId: "cmd_rejected",
    correlationId: "corr_rejected",
  };
  const events = planCommandRejectedEvents({
    projection: {
      abuseScores: {
        agent_1: { score: 4 },
      },
    },
    surface: "mcp",
    command: "resolve_turn",
    errorCode: "agent_owner_mismatch",
    statusCode: 403,
    actorKey: "agent_1",
    agentId: "agent_1",
    explorerId: "explorer_1",
    actorExplorerId: "explorer_context",
    rejectedAt,
    inputSummary: { turnCardId: "turn_1" },
    idFactory,
    makeEvent: eventFactory(() => new Date(rejectedAt), idFactory, context),
  });

  assert.deepEqual(events.map((event) => event.eventType), [
    "command_rejected",
    "abuse_score_changed",
  ]);
  const rejected = events[0];
  assert.ok(rejected);
  assert.equal(rejected.eventType, "command_rejected");
  if (rejected.eventType !== "command_rejected") throw new Error("expected_command_rejected_event");
  assert.equal(rejected.payload.actorKey, "agent_1");

  const scoreChanged = events[1];
  assert.ok(scoreChanged);
  assert.equal(scoreChanged.eventType, "abuse_score_changed");
  if (scoreChanged.eventType !== "abuse_score_changed") throw new Error("expected_abuse_score_event");
  assert.equal(scoreChanged.payload.sourceEventId, rejected.eventId);
  assert.equal(scoreChanged.payload.scoreAfter, 6);
  assert.equal(scoreChanged.payload.reason, "invalid_authority");
  assert.deepEqual(projectCommandRejectedEvent(events), rejected);
});
