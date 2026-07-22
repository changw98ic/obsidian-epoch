import assert from "node:assert/strict";
import test from "node:test";

import {
  copyBalance,
  currentBalance,
  planResourceGrantEvents,
  planResourceSpendEvents,
  projectResourceGrantBalance,
  projectResourceSpendBalance,
  requireResourceBalance,
  resourceGrantPayload,
  resourceSpendPayload,
  resourceSpendPayloads,
} from "../lib/epoch/resourceRules.ts";
import { eventFactory } from "../lib/epoch/eventFactory.ts";
import { createSequentialEpochIdFactory } from "../lib/epoch/protocol.ts";

const projection = {
  resourceBalances: {
    agent_alpha: {
      coin: 5,
      focus: 3,
    },
  },
};

test("resource rules copy balances without sharing the source object", () => {
  assert.deepEqual(copyBalance(undefined), {});
  const source = { coin: 5, focus: 3 } as const;
  const copied = copyBalance(source);
  assert.deepEqual(copied, source);
  assert.notEqual(copied, source);
});

test("resource rules read and require balances", () => {
  assert.equal(currentBalance(projection, "agent_alpha", "coin"), 5);
  assert.equal(currentBalance(projection, "agent_missing", "coin"), 0);
  assert.equal(requireResourceBalance(projection, "agent_alpha", "focus", 2), 3);
  assert.throws(
    () => requireResourceBalance(projection, "agent_alpha", "coin", 8),
    /resource_insufficient/,
  );
});

test("resource rules plan grant and spend payloads", () => {
  assert.deepEqual(resourceGrantPayload(projection, "agent_alpha", {
    resourceId: "coin",
    amount: 2,
    reason: "test_grant",
  }), {
    resourceId: "coin",
    amount: 2,
    reason: "test_grant",
    balanceAfter: 7,
    accountRef: "agent:agent_alpha",
    assetKey: "resource:coin",
    unit: "unit",
    quantityMinor: "200",
  });

  assert.deepEqual(resourceSpendPayload(projection, "agent_alpha", {
    resourceId: "focus",
    amount: 2,
    reason: "test_spend",
  }), {
    resourceId: "focus",
    amount: 2,
    reason: "test_spend",
    balanceAfter: 1,
    accountRef: "agent:agent_alpha",
    assetKey: "resource:focus",
    unit: "unit",
    quantityMinor: "200",
  });
});

test("resource rules plan multi-cost spend payloads against running balances", () => {
  assert.deepEqual(resourceSpendPayloads(
    projection,
    "agent_alpha",
    [
      { resourceId: "coin", amount: 2 },
      { resourceId: "coin", amount: 3 },
      { resourceId: "focus", amount: 1 },
    ],
    (cost, index) => `test_spend:${cost.resourceId}:${index}`,
  ), [
    {
      resourceId: "coin",
      amount: 2,
      reason: "test_spend:coin:0",
      balanceAfter: 3,
      accountRef: "agent:agent_alpha",
      assetKey: "resource:coin",
      unit: "unit",
      quantityMinor: "200",
    },
    {
      resourceId: "coin",
      amount: 3,
      reason: "test_spend:coin:1",
      balanceAfter: 0,
      accountRef: "agent:agent_alpha",
      assetKey: "resource:coin",
      unit: "unit",
      quantityMinor: "300",
    },
    {
      resourceId: "focus",
      amount: 1,
      reason: "test_spend:focus:2",
      balanceAfter: 2,
      accountRef: "agent:agent_alpha",
      assetKey: "resource:focus",
      unit: "unit",
      quantityMinor: "100",
    },
  ]);

  assert.throws(
    () => resourceSpendPayloads(
      projection,
      "agent_alpha",
      [
        { resourceId: "coin", amount: 4 },
        { resourceId: "coin", amount: 2 },
      ],
      () => "overspend",
    ),
    /resource_insufficient/,
  );
});

test("resource rules plan grant and spend event sequences", () => {
  const grantedAt = "2026-07-07T08:00:00.000Z";
  const grantEvents = planResourceGrantEvents({
    projection,
    agentId: "agent_alpha",
    resource: {
      resourceId: "coin",
      amount: 2,
      reason: "test_grant",
    },
    makeEvent: eventFactory(() => new Date(grantedAt), createSequentialEpochIdFactory("resource_grant"), {
      actorExplorerId: "explorer_alpha",
      trustClass: "user_verified_web" as const,
      causationId: "resource_grant",
      correlationId: "corr_resource_grant",
    }),
  });

  assert.deepEqual(grantEvents.map((event) => event.eventType), ["resource_granted"]);
  const granted = grantEvents[0];
  assert.ok(granted);
  assert.equal(granted.eventType, "resource_granted");
  if (granted.eventType !== "resource_granted") throw new Error("expected_resource_granted_event");
  assert.equal(granted.aggregateType, "resource_account");
  assert.equal(granted.aggregateId, "agent_alpha");
  assert.equal(granted.agentId, "agent_alpha");
  assert.deepEqual(granted.payload, {
    resourceId: "coin",
    amount: 2,
    reason: "test_grant",
    balanceAfter: 7,
    accountRef: "agent:agent_alpha",
    assetKey: "resource:coin",
    unit: "unit",
    quantityMinor: "200",
  });
  assert.deepEqual(projectResourceGrantBalance({
    events: grantEvents,
    projection: {
      resourceBalances: {
        agent_alpha: { coin: 7 },
      },
    },
  }), { coin: 7 });
  assert.throws(() => projectResourceGrantBalance({
    events: [],
    projection,
  }), /resource_granted_event_missing/);

  const spentAt = "2026-07-07T08:01:00.000Z";
  const spendEvents = planResourceSpendEvents({
    projection,
    agentId: "agent_alpha",
    resource: {
      resourceId: "focus",
      amount: 2,
      reason: "test_spend",
    },
    makeEvent: eventFactory(() => new Date(spentAt), createSequentialEpochIdFactory("resource_spend"), {
      actorExplorerId: "explorer_alpha",
      trustClass: "user_verified_web" as const,
      causationId: "resource_spend",
      correlationId: "corr_resource_spend",
    }),
  });

  assert.deepEqual(spendEvents.map((event) => event.eventType), ["resource_spent"]);
  const spent = spendEvents[0];
  assert.ok(spent);
  assert.equal(spent.eventType, "resource_spent");
  if (spent.eventType !== "resource_spent") throw new Error("expected_resource_spent_event");
  assert.equal(spent.aggregateType, "resource_account");
  assert.equal(spent.aggregateId, "agent_alpha");
  assert.equal(spent.agentId, "agent_alpha");
  assert.deepEqual(spent.payload, {
    resourceId: "focus",
    amount: 2,
    reason: "test_spend",
    balanceAfter: 1,
    accountRef: "agent:agent_alpha",
    assetKey: "resource:focus",
    unit: "unit",
    quantityMinor: "200",
  });
  assert.deepEqual(projectResourceSpendBalance({
    events: spendEvents,
    projection: {
      resourceBalances: {
        agent_alpha: { focus: 1 },
      },
    },
  }), { focus: 1 });
  assert.throws(() => projectResourceSpendBalance({
    events: [],
    projection,
  }), /resource_spent_event_missing/);
});
