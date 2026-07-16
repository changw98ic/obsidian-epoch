import assert from "node:assert/strict";
import test from "node:test";

import type { EpochEvent } from "../lib/epoch/events.ts";
import { createEpochGameCore, type EpochCommandResult, type EpochPartyRun } from "../lib/epoch/gameCore.ts";
import {
  boundedEpochTransportValue,
  commandResult,
  EPOCH_TRANSPORT_RESULT_MAX_BYTES,
  publicCommandValue,
  publicEpochEvent,
  publicProjection,
  withInternalEvents,
} from "../lib/epoch/runtimePublicProjectionRules.ts";

const now = "2026-07-08T00:00:00.000Z";

function partyRunCreatedEvent(): EpochEvent {
  return {
    eventId: "event_party_run_created",
    eventType: "party_run_created",
    aggregateType: "party_run",
    aggregateId: "party_run_secret",
    actorExplorerId: "explorer_leader",
    agentId: "agent_leader",
    trustClass: "user_verified_web",
    causationId: "cause_party",
    correlationId: "corr_party",
    createdAt: now,
    payload: {
      partyRunId: "party_run_secret",
      regionId: "region_gray_harbor",
      leaderAgentId: "agent_leader",
      leaderExplorerId: "explorer_leader",
      title: "灰港协同行动",
      objective: "清理裂隙入口",
      joinPolicy: "invite_only",
      inviteTokenHash: "secret_invite_hash",
      inviteTokenExpiresAt: "2026-07-09T00:00:00.000Z",
      inviteTokenUseLimit: 2,
      inviteTokenUses: 0,
      participantRole: "leader",
      createdAt: now,
    },
  };
}

function partyInviteUpdatedEvent(): EpochEvent {
  return {
    eventId: "event_party_invite_updated",
    eventType: "party_invite_updated",
    aggregateType: "party_run",
    aggregateId: "party_run_secret",
    actorExplorerId: "explorer_leader",
    agentId: "agent_leader",
    trustClass: "user_verified_web",
    causationId: "cause_invite",
    correlationId: "corr_party",
    createdAt: now,
    payload: {
      partyRunId: "party_run_secret",
      regionId: "region_gray_harbor",
      leaderAgentId: "agent_leader",
      leaderExplorerId: "explorer_leader",
      updateKind: "rotated",
      inviteTokenHash: "rotated_secret_invite_hash",
      inviteTokenExpiresAt: "2026-07-09T00:00:00.000Z",
      inviteTokenUseLimit: 2,
      inviteTokenUses: 0,
      updatedAt: now,
    },
  };
}

function partyRun(): EpochPartyRun {
  return {
    partyRunId: "party_run_secret",
    regionId: "region_gray_harbor",
    leaderAgentId: "agent_leader",
    leaderExplorerId: "explorer_leader",
    title: "灰港协同行动",
    objective: "清理裂隙入口",
    joinPolicy: "invite_only",
    inviteTokenHash: "secret_invite_hash",
    inviteTokenExpiresAt: "2026-07-09T00:00:00.000Z",
    inviteTokenUseLimit: 2,
    inviteTokenUses: 0,
    status: "open",
    members: [{
      agentId: "agent_leader",
      explorerId: "explorer_leader",
      participantRole: "leader",
      joinedAt: now,
    }],
    createdAt: now,
    updatedAt: now,
  };
}

test("public epoch events strip invite token hashes from party payloads", () => {
  const created = publicEpochEvent(partyRunCreatedEvent());
  const updated = publicEpochEvent(partyInviteUpdatedEvent());

  assert.equal("inviteTokenHash" in created.payload, false);
  assert.equal("inviteTokenHash" in updated.payload, false);
  assert.equal(created.eventType, "party_run_created");
  assert.equal(updated.eventType, "party_invite_updated");
});

test("public projection strips invite token hashes from events and party runs", () => {
  const run = partyRun();
  const projection = {
    ...createEpochGameCore().project(),
    events: [partyRunCreatedEvent(), partyInviteUpdatedEvent()],
    partyRuns: {
      [run.partyRunId]: run,
    },
  };

  const publicView = publicProjection(projection);

  assert.equal("inviteTokenHash" in publicView.events[0].payload, false);
  assert.equal("inviteTokenHash" in publicView.events[1].payload, false);
  assert.equal("inviteTokenHash" in publicView.partyRuns[run.partyRunId], false);
});

test("command result exposes only public command value, events, and projection", () => {
  const run = partyRun();
  const projection = {
    ...createEpochGameCore().project(),
    events: [partyRunCreatedEvent()],
    partyRuns: {
      [run.partyRunId]: run,
    },
  };
  const result: EpochCommandResult<EpochPartyRun> = {
    value: run,
    events: [partyRunCreatedEvent()],
    projection,
  };

  const publicResult = commandResult(result);

  assert.equal("inviteTokenHash" in publicResult.value, false);
  assert.equal("inviteTokenHash" in publicResult.events[0].payload, false);
  assert.equal("inviteTokenHash" in publicResult.projection.partyRuns[run.partyRunId], false);
});

test("public command value leaves non-party values untouched", () => {
  const value = { status: "ok" };

  assert.equal(publicCommandValue(value), value);
});

test("withInternalEvents attaches internal events without making them enumerable", () => {
  const event = partyRunCreatedEvent();
  const result = withInternalEvents({ value: "ok" }, [event]);
  const descriptor = Object.getOwnPropertyDescriptor(result, "events");
  const resultWithEvents = result as typeof result & { readonly events: readonly EpochEvent[] };

  assert.deepEqual(Object.keys(result), ["value"]);
  assert.equal(descriptor?.enumerable, false);
  assert.deepEqual(resultWithEvents.events, [event]);
});

test("transport results omit an oversized world projection without losing the command delta", () => {
  const value = {
    value: { turnCardId: "turn_card_transport", status: "open" },
    events: [{ eventId: "event_transport", eventType: "turn_card_created" }],
    projection: { events: ["x".repeat(EPOCH_TRANSPORT_RESULT_MAX_BYTES)] },
  };

  const bounded = boundedEpochTransportValue(value) as Record<string, unknown>;
  const omission = bounded.projectionOmitted as Record<string, unknown>;

  assert.equal("projection" in bounded, false);
  assert.deepEqual(bounded.value, value.value);
  assert.deepEqual(bounded.events, value.events);
  assert.equal(omission.reason, "response_size_limit");
  assert.equal(omission.maxBytes, EPOCH_TRANSPORT_RESULT_MAX_BYTES);
  assert.ok(Number(omission.originalBytes) > EPOCH_TRANSPORT_RESULT_MAX_BYTES);
});

test("transport results preserve small projections for compatibility", () => {
  const value = {
    value: { status: "ok" },
    events: [],
    projection: { events: [] },
  };

  assert.equal(boundedEpochTransportValue(value), value);
});
