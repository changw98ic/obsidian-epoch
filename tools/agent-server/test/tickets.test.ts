import test from "node:test";
import assert from "node:assert/strict";
import { createTicketRegistry } from "../lib/tickets.ts";
import { EPOCH_CONTEXT_PACK_VERSION } from "../lib/worldContextVersions.ts";

function mutableClock(initialIso: string) {
  let current = new Date(initialIso);
  return {
    now: () => new Date(current),
    set: (iso: string) => {
      current = new Date(iso);
    },
  };
}

test("createTicket issues a server-owned run ticket", () => {
  const registry = createTicketRegistry({ now: () => new Date("2026-06-24T00:00:00.000Z") });

  const ticket = registry.createTicket({
    explorerId: "explorer_local_001",
    agentId: "agent_grayfile_07",
    regionId: "region_gray_harbor",
    contextVersion: EPOCH_CONTEXT_PACK_VERSION,
    risk: "C",
  });

  assert.match(ticket.runTicket, /^rt_[a-f0-9]{24}$/);
  assert.equal(ticket.state, "issued");
  assert.equal(ticket.explorerId, "explorer_local_001");
  assert.equal(ticket.agentId, "agent_grayfile_07");
  assert.equal(ticket.risk, "C");
  assert.equal(ticket.createdAt, "2026-06-24T00:00:00.000Z");
  assert.equal(ticket.expiresAt, "2026-06-24T00:30:00.000Z");
  assert.equal(ticket.contextVersion, EPOCH_CONTEXT_PACK_VERSION);
  assert.equal(ticket.regionId, "region_gray_harbor");
  assert.deepEqual(ticket.actionBudget, {
    maxEvents: 6,
    maxHighRiskActions: 1,
  });
  assert.equal(ticket.sequence, 1);
  assert.equal(ticket.sequenceWindow?.first, 1);
  assert.equal(ticket.sequenceWindow?.last, 1);
});

test("submitTicket requires the server-issued context version", () => {
  const registry = createTicketRegistry({ now: () => new Date("2026-06-24T00:00:00.000Z") });
  const ticket = registry.createTicket({
    explorerId: "explorer_local_001",
    agentId: "agent_grayfile_07",
    contextVersion: EPOCH_CONTEXT_PACK_VERSION,
    risk: "C",
  });

  assert.throws(
    () => registry.submitTicket(ticket.runTicket, { sequence: ticket.sequence, events: [] }, { score: 60 }),
    /ticket_context_version_required/,
  );
  assert.throws(
    () => registry.submitTicket(
      ticket.runTicket,
      { sequence: ticket.sequence, contextVersion: "client-forged-context", events: [] },
      { score: 60 },
    ),
    /ticket_context_version_mismatch/,
  );

  const submitted = registry.submitTicket(
    ticket.runTicket,
    { sequence: ticket.sequence, contextVersion: EPOCH_CONTEXT_PACK_VERSION, events: [] },
    { score: 60 },
  );
  assert.equal(submitted.state, "submitted");
  assert.equal(submitted.contextVersion, EPOCH_CONTEXT_PACK_VERSION);
});

test("submitTicket requires the server-issued sequence window", () => {
  const registry = createTicketRegistry({ now: () => new Date("2026-06-24T00:00:00.000Z") });
  const ticket = registry.createTicket({
    explorerId: "explorer_local_001",
    agentId: "agent_grayfile_07",
    risk: "C",
  });

  assert.throws(
    () => registry.submitTicket(ticket.runTicket, { events: [] }, { score: 60 }),
    /ticket_sequence_required/,
  );
  assert.throws(
    () => registry.submitTicket(ticket.runTicket, { sequence: 2, events: [] }, { score: 60 }),
    /ticket_sequence_mismatch/,
  );

  const submitted = registry.submitTicket(ticket.runTicket, { sequence: 1, events: [] }, { score: 60 });
  assert.equal(submitted.state, "submitted");
  assert.equal(submitted.sequence, 1);
  assert.equal(submitted.sequenceWindow?.first, 1);
  assert.equal(submitted.sequenceWindow?.last, 1);
});

test("checkpointTicket activates tickets with a new sequence window", () => {
  const time = mutableClock("2026-06-24T00:00:00.000Z");
  const registry = createTicketRegistry({
    now: time.now,
    ttlMs: 60_000,
  });
  const ticket = registry.createTicket({
    explorerId: "explorer_local_001",
    agentId: "agent_grayfile_07",
    risk: "C",
  });
  assert.equal(ticket.sequence, 1);
  assert.equal(ticket.expiresAt, "2026-06-24T00:01:00.000Z");

  time.set("2026-06-24T00:00:30.000Z");

  const checkpoint = registry.checkpointTicket(ticket.runTicket, {
    explorerId: "explorer_local_001",
    agentId: "agent_grayfile_07",
  });

  assert.equal(checkpoint.state, "active");
  assert.equal(checkpoint.sequence, 2);
  assert.equal(checkpoint.sequenceWindow?.first, 2);
  assert.equal(checkpoint.sequenceWindow?.last, 2);
  assert.equal(checkpoint.heartbeatAt, "2026-06-24T00:00:30.000Z");
  assert.equal(checkpoint.expiresAt, "2026-06-24T00:01:30.000Z");

  assert.throws(
    () => registry.submitTicket(ticket.runTicket, { sequence: 1, events: [] }, { score: 60 }),
    /ticket_sequence_mismatch/,
  );

  const submitted = registry.submitTicket(ticket.runTicket, { sequence: 2, events: [] }, { score: 60 });
  assert.equal(submitted.state, "submitted");
});

test("submitTicket settles after submission and stays idempotent for an identical run payload", () => {
  const registry = createTicketRegistry({ now: () => new Date("2026-06-24T00:00:00.000Z") });
  const ticket = registry.createTicket({
    explorerId: "explorer_local_001",
    agentId: "agent_grayfile_07",
    risk: "C",
  });
  const run = {
    sequence: ticket.sequence,
    mandate: "调查腐林西缘的会回信树洞",
    events: [{ id: "event_01", outcome: "confirmed echo pattern" }],
    ending: { type: "archive", summary: "灰档-07 带回了可复核录音。" },
  };
  const adjudication = { score: 72, rating: "qualified", claimSlots: 2 };

  const first = registry.submitTicket(ticket.runTicket, run, adjudication);
  assert.equal(first.state, "submitted");

  const settled = registry.settleTicket(ticket.runTicket);
  const second = registry.submitTicket(ticket.runTicket, run, { score: 1, rating: "client_noise" });

  assert.equal(settled.state, "settled");
  assert.equal(settled.settledAt, "2026-06-24T00:00:00.000Z");
  assert.equal(second.state, "settled");
  assert.equal(second.duplicate, true);
  assert.deepEqual(second.adjudication, adjudication);
  assert.equal(second.runHash, first.runHash);
});

test("submitTicket rejects a changed payload for an already submitted ticket", () => {
  const registry = createTicketRegistry({ now: () => new Date("2026-06-24T00:00:00.000Z") });
  const ticket = registry.createTicket({
    explorerId: "explorer_local_001",
    agentId: "agent_grayfile_07",
    risk: "C",
  });

  registry.submitTicket(ticket.runTicket, { sequence: ticket.sequence, events: [{ id: "event_01" }] }, { score: 60 });

  assert.throws(
    () => registry.submitTicket(ticket.runTicket, { events: [{ id: "event_02" }] }, { score: 60 }),
    /ticket_payload_mismatch/,
  );
});

test("voidTicket records a terminal void state before settlement", () => {
  const registry = createTicketRegistry({ now: () => new Date("2026-06-24T00:00:00.000Z") });
  const ticket = registry.createTicket({
    explorerId: "explorer_local_001",
    agentId: "agent_grayfile_07",
    risk: "C",
  });

  const voided = registry.voidTicket(ticket.runTicket, { reason: "operator_cancelled" });

  assert.equal(voided.state, "void");
  assert.equal(voided.voidReason, "operator_cancelled");
  assert.equal(voided.voidedAt, "2026-06-24T00:00:00.000Z");
  assert.throws(
    () => registry.checkpointTicket(ticket.runTicket, {
      explorerId: "explorer_local_001",
      agentId: "agent_grayfile_07",
    }),
    /ticket_void/,
  );
  assert.throws(
    () => registry.submitTicket(ticket.runTicket, { sequence: ticket.sequence, events: [] }, { score: 60 }),
    /ticket_void/,
  );
});

test("submitTicket rejects unknown tickets", () => {
  const registry = createTicketRegistry();

  assert.throws(
    () => registry.submitTicket("rt_missing", { events: [] }, { score: 0 }),
    /ticket_not_found/,
  );
});

test("submitTicket expires stale issued tickets before settlement", () => {
  const time = mutableClock("2026-06-24T00:00:00.000Z");
  const registry = createTicketRegistry({
    now: time.now,
    ttlMs: 60_000,
  });
  const ticket = registry.createTicket({
    explorerId: "explorer_local_001",
    agentId: "agent_grayfile_07",
    risk: "C",
  });
  assert.equal(ticket.expiresAt, "2026-06-24T00:01:00.000Z");

  time.set("2026-06-24T00:01:01.000Z");

  assert.throws(
    () => registry.submitTicket(ticket.runTicket, { events: [{ id: "event_01" }] }, { score: 60 }),
    /ticket_expired/,
  );

  const expired = registry.getTicket(ticket.runTicket);
  assert.equal(expired?.state, "expired");
  assert.equal(expired?.expiredAt, "2026-06-24T00:01:01.000Z");
});
