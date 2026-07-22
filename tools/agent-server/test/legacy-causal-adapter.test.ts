import assert from "node:assert/strict";
import test from "node:test";

import type { EpochEvent } from "../lib/epoch/events.ts";
import {
  legacyCausalViewFromEpochEvent,
  legacyCausalViewFromRecord,
  legacyCausalViewsFromRecords,
} from "../lib/epoch/legacyCausalAdapter.ts";

function eventFixture(overrides: Partial<EpochEvent> = {}): EpochEvent {
  return {
    eventId: "epoch_event_001",
    eventType: "resource_granted",
    aggregateType: "resource_account",
    aggregateId: "agent_1",
    actorExplorerId: "explorer_1",
    agentId: "agent_1",
    trustClass: "user_verified_web",
    causationId: "cause_1",
    correlationId: "corr_1",
    idempotencyKey: "grant:explorer_1:focus",
    createdAt: "2026-07-20T00:00:00.000Z",
    payload: {
      agentId: "agent_1",
      resourceId: "focus",
      amount: 1,
      reason: "test",
      grantedAt: "2026-07-20T00:00:00.000Z",
    },
    ...overrides,
  } as unknown as EpochEvent;
}

function hasOwn(value: unknown, key: string): boolean {
  return !!value && typeof value === "object" && Object.prototype.hasOwnProperty.call(value, key);
}

test("legacy causal view returns attributed for a complete old epoch event", () => {
  const event = eventFixture();

  assert.deepEqual(legacyCausalViewFromEpochEvent(event), {
    attribution: "attributed",
    eventId: "epoch_event_001",
    eventType: "resource_granted",
    aggregateType: "resource_account",
    aggregateId: "agent_1",
    actorRef: "explorer_1",
    causationId: "cause_1",
    correlationId: "corr_1",
    idempotencyKey: "grant:explorer_1:focus",
    createdAt: "2026-07-20T00:00:00.000Z",
    source: {
      warnings: [],
    },
    raw: event,
  });
});

test("legacy causal view returns partial when only causal attribution fields are missing", () => {
  const view = legacyCausalViewFromRecord({
    record: {
      eventId: "epoch_event_partial",
      eventType: "resource_granted",
      actorExplorerId: "explorer_1",
    },
  });

  assert.equal(view.attribution, "partial");
  assert.deepEqual(view.source.warnings, [
    "legacy_causation_id_missing",
    "legacy_correlation_id_missing",
  ]);
});

test("legacy causal view returns unattributed when required event identity is missing", () => {
  const view = legacyCausalViewFromRecord({
    record: {
      actorRef: "explorer_1",
      causationId: "cause_1",
      correlationId: "corr_1",
    },
  });

  assert.equal(view.attribution, "unattributed");
  assert.deepEqual(view.source.warnings, [
    "legacy_event_id_missing",
    "legacy_event_type_missing",
  ]);
});

test("legacy causal view preserves explicit source ledger, position, and warnings", () => {
  const view = legacyCausalViewFromRecord({
    record: {
      eventId: "epoch_event_source",
      eventType: "resource_granted",
      actorRef: "explorer_1",
      causationId: "cause_1",
      correlationId: "corr_1",
      ledger: "record-ledger",
      position: 41,
      warnings: ["record_warning", 7],
      source: {
        ledger: "nested-ledger",
        position: "nested-position",
        warnings: ["nested_warning"],
      },
    },
    sourceLedger: "source-ledger",
    sourcePosition: "source-position",
    warnings: ["explicit_warning"],
  });

  assert.deepEqual(view.source, {
    ledger: "source-ledger",
    position: "source-position",
    warnings: ["record_warning", "nested_warning", "explicit_warning"],
  });
});

test("legacy causal view keeps the original raw record unchanged", () => {
  const record = {
    eventId: "epoch_event_raw",
    eventType: "resource_granted",
    aggregateType: "resource_account",
    aggregateId: "agent_1",
    actorExplorerId: "explorer_1",
    causationId: "cause_1",
    correlationId: "corr_1",
    payload: { amount: 1 },
  };
  const before = { ...record, payload: { ...record.payload } };

  const view = legacyCausalViewFromRecord({ record });

  assert.equal(view.raw, record);
  assert.deepEqual(record, before);
});

test("legacy causal batch mapping does not produce canonical write output", () => {
  const records = [
    eventFixture({ eventId: "epoch_event_batch_1" }),
    eventFixture({ eventId: "epoch_event_batch_2" }),
  ];

  const views = legacyCausalViewsFromRecords(records, {
    ledger: "legacy-ledger",
    warnings: ["compatibility_view_only"],
  });

  assert.deepEqual(views.map((view) => view.source), [
    { ledger: "legacy-ledger", position: 0, warnings: ["compatibility_view_only"] },
    { ledger: "legacy-ledger", position: 1, warnings: ["compatibility_view_only"] },
  ]);
  assert.deepEqual(views.map((view) => hasOwn(view, "manifest")), [false, false]);
  assert.deepEqual(views.map((view) => hasOwn(view, "event")), [false, false]);
  assert.deepEqual(views.map((view) => hasOwn(view, "proof")), [false, false]);
  assert.deepEqual(views.map((view) => hasOwn(view.raw, "schemaVersion")), [false, false]);
  assert.deepEqual(views.map((view) => hasOwn(view.raw, "effects")), [false, false]);
});
