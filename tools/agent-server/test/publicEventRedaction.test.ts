import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { publicEpochEvent } from "../lib/epoch/runtimePublicProjectionRules.ts";
import type { EpochEvent } from "../lib/epoch/events.ts";

function makeEvent(eventType: string, payload: Record<string, unknown>): EpochEvent {
  return {
    eventId: `evt-${Date.now()}`,
    eventType,
    aggregateId: "agg-1",
    aggregateType: "agent_identity",
    agentId: "agent-1",
    createdAt: new Date().toISOString(),
    payload,
  } as EpochEvent;
}

describe("public event redaction", () => {
  it("identity_issued strips explorerSecretHash", () => {
    const event = makeEvent("identity_issued", {
      agentId: "a-1",
      explorerId: "e-1",
      identityName: "Test",
      explorerSecretHash: "sha256:secret",
      generation: 1,
    });
    const result = publicEpochEvent(event);
    assert.equal((result.payload as Record<string, unknown>).explorerSecretHash, undefined);
    assert.equal((result.payload as Record<string, unknown>).agentId, "a-1");
    assert.equal((result.payload as Record<string, unknown>).identityName, "Test");
  });

  it("direct_trade_created strips explorer IDs", () => {
    const event = makeEvent("direct_trade_created", {
      tradeId: "t-1",
      status: "open",
      proposerExplorerId: "secret-1",
      counterpartyExplorerId: "secret-2",
      proposerAgentId: "a-1",
    });
    const result = publicEpochEvent(event);
    assert.equal((result.payload as Record<string, unknown>).proposerExplorerId, undefined);
    assert.equal((result.payload as Record<string, unknown>).counterpartyExplorerId, undefined);
    assert.equal((result.payload as Record<string, unknown>).tradeId, "t-1");
  });

  it("party_run_created strips inviteTokenHash", () => {
    const event = makeEvent("party_run_created", {
      partyRunId: "p-1",
      title: "Test Party",
      inviteTokenHash: "sha256:secret",
      joinPolicy: "open",
    });
    const result = publicEpochEvent(event);
    assert.equal((result.payload as Record<string, unknown>).inviteTokenHash, undefined);
    assert.equal((result.payload as Record<string, unknown>).partyRunId, "p-1");
    assert.equal((result.payload as Record<string, unknown>).title, "Test Party");
  });

  it("npc_identity_doubt returns envelope only", () => {
    const event = makeEvent("npc_identity_doubt", {
      npcId: "npc-1",
      doubtStrength: 0.8,
      reason: "suspicious behavior",
      approachTags: ["investigate"],
    });
    const result = publicEpochEvent(event);
    assert.deepEqual(result.payload, {});
    assert.equal(result.eventType, "npc_identity_doubt");
    assert.equal(result.eventId, event.eventId);
  });

  it("unregistered event type strips payload (default-deny)", () => {
    const event = makeEvent("some_new_event", {
      field1: "value1",
      field2: "value2",
    });
    const result = publicEpochEvent(event);
    assert.deepEqual(result.payload, {});
  });

  it("identity_issued preserves whitelisted fields", () => {
    const event = makeEvent("identity_issued", {
      agentId: "a-1",
      explorerId: "e-1",
      identityName: "Test",
      generation: 3,
      startedAt: "2025-01-01T00:00:00Z",
      maxLifetime: 1000,
      strategyProfile: "balanced",
      previousAgentId: "a-0",
      explorerSecretHash: "sha256:secret",
    });
    const result = publicEpochEvent(event);
    const p = result.payload as Record<string, unknown>;
    assert.equal(p.agentId, "a-1");
    assert.equal(p.explorerId, "e-1");
    assert.equal(p.identityName, "Test");
    assert.equal(p.generation, 3);
    assert.equal(p.startedAt, "2025-01-01T00:00:00Z");
    assert.equal(p.maxLifetime, 1000);
    assert.equal(p.strategyProfile, "balanced");
    assert.equal(p.previousAgentId, "a-0");
    assert.equal(p.explorerSecretHash, undefined);
  });

  it("envelope fields are preserved for all events", () => {
    const event = makeEvent("identity_issued", {
      agentId: "a-1",
      explorerSecretHash: "sha256:secret",
    });
    const result = publicEpochEvent(event);
    assert.equal(result.eventId, event.eventId);
    assert.equal(result.eventType, "identity_issued");
    assert.equal(result.aggregateId, "agg-1");
    assert.equal(result.agentId, "agent-1");
    assert.equal(result.createdAt, event.createdAt);
  });
});
