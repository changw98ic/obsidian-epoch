import assert from "node:assert/strict";
import test from "node:test";

import { adaptPhase6EconomyEvents } from "../lib/epoch/phase6EconomyEventAdapter.ts";

test("Phase 6 economy adapter ignores canonical non-economy events", () => {
  const result = adaptPhase6EconomyEvents([{
    eventId: "event_world_clock_1",
    eventType: "world_clock_advanced",
    payload: { worldMinute: 42 },
  }]);

  assert.equal(result.report.ok, true);
  assert.equal(result.report.sourceEventCount, 1);
  assert.equal(result.report.unsupportedEventCount, 0);
  assert.deepEqual(result.flows, []);
});

test("Phase 6 economy adapter normalizes an explicit resource ledger event", () => {
  const result = adaptPhase6EconomyEvents([{
    eventId: "epoch_event_000001",
    eventType: "resource_granted",
    agentId: "agent_alpha",
    payload: {
      resourceId: "focus",
      amount: 2,
      balanceAfter: 2,
      reason: "journey_entry_reserve",
      accountRef: "agent:agent_alpha",
      assetKey: "resource:focus",
      unit: "unit",
      quantityMinor: "200",
    },
  }]);

  assert.equal(result.report.ok, true);
  assert.equal(result.report.normalizedFlowCount, 1);
  assert.deepEqual(result.flows[0], {
    flowId: result.flows[0]?.flowId,
    assetKey: "resource:focus",
    unit: "unit",
    quantityMinor: "200",
    reasonCode: "reward_mint",
    source: { kind: "system", ref: "resource_granted" },
    sink: { kind: "account", ref: "agent:agent_alpha", bucket: "available" },
    sourceRef: "epoch_event_000001",
    sinkRef: undefined,
    sourceEventIds: ["epoch_event_000001"],
  });
});

test("Phase 6 economy adapter rejects a declared economy event with incomplete ledger fields", () => {
  const result = adaptPhase6EconomyEvents([{
    eventId: "epoch_event_000002",
    eventType: "resource_spent",
    payload: { resourceId: "focus", amount: 1 },
  }]);

  assert.equal(result.report.ok, false);
  assert.ok(result.report.findings.some((finding) => finding.code === "PHASE6_ECONOMY_EVENT_MISSING_UNIT"));
});

test("Phase 6 economy adapter records item creation as an authoritative system mint", () => {
  const result = adaptPhase6EconomyEvents([{
    eventId: "epoch_event_item_000001",
    eventType: "item_created",
    aggregateId: "journey_reward_1",
    agentId: "agent_alpha",
    payload: {
      itemId: "journey_reward_1",
      agentId: "agent_alpha",
      explorerId: "explorer_alpha",
      itemKey: "reward:forest_cache",
      displayName: "林地遗物",
      rarity: "common",
      bound: false,
      sourceEventIds: ["epoch_event_reward_source"],
      createdAt: "2026-01-01T00:00:00.000Z",
    },
  }]);

  assert.equal(result.report.ok, true);
  assert.equal(result.report.normalizedFlowCount, 1);
  assert.deepEqual(result.flows[0], {
    flowId: result.flows[0]?.flowId,
    assetKey: "item:reward:forest_cache",
    unit: "item",
    quantityMinor: "1",
    reasonCode: "system_mint",
    source: { kind: "system", ref: "item_created" },
    sink: { kind: "account", ref: "agent:agent_alpha", bucket: "available" },
    sourceRef: "epoch_event_item_000001",
    sinkRef: undefined,
    sourceEventIds: ["epoch_event_item_000001"],
  });
});
