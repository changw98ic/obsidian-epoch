import test from "node:test";
import assert from "node:assert/strict";

import type { EpochEvent } from "../lib/epoch/events.ts";
import type { EpochProjection } from "../lib/epoch/gameCore.ts";
import { createRuntimeIdempotencyRuntime } from "../lib/epoch/runtimeIdempotencyRuntime.ts";
import type { EpochRuntimeResult } from "../lib/epoch/runtimePublicProjectionRules.ts";

function projection(label = "projection"): EpochProjection {
  return { label } as unknown as EpochProjection;
}

function event(eventId: string): EpochEvent {
  return {
    aggregateId: "aggregate",
    aggregateType: "agent_identity",
    eventId,
    eventType: "command_rejected",
    payload: {},
    occurredAt: "2026-06-25T00:00:00.000Z",
  } as unknown as EpochEvent;
}

function result<TValue>(value: TValue, eventId = "event_result"): EpochRuntimeResult<TValue> {
  return {
    duplicate: false,
    events: [event(eventId)],
    projection: projection("original"),
    value,
  };
}

test("runtime idempotency runtime replays plain cached results with fresh public projection", () => {
  let projectLabel = "first";
  let abuseCalls = 0;
  let runCalls = 0;
  const runtime = createRuntimeIdempotencyRuntime({
    project: () => projection(projectLabel),
    publicProjection: (value) => ({ ...value, public: true } as unknown as EpochProjection),
    assertAbuseAllowed: () => {
      abuseCalls += 1;
    },
    authorizeExplorerAction: () => [],
  });

  const first = runtime.idempotently("plain", { idempotencyKey: "key-1" }, () => {
    runCalls += 1;
    return result({ ok: true }, "event_first");
  });
  projectLabel = "second";
  const duplicate = runtime.idempotently("plain", { idempotencyKey: "key-1" }, () => {
    runCalls += 1;
    return result({ ok: false }, "event_second");
  });

  assert.equal(runCalls, 1);
  assert.equal(abuseCalls, 1);
  assert.deepEqual(first.value, { ok: true });
  assert.equal(duplicate.duplicate, true);
  assert.deepEqual(duplicate.events, []);
  assert.deepEqual(duplicate.value, { ok: true });
  assert.deepEqual(duplicate.projection, { label: "second", public: true });
});

test("runtime idempotency runtime rejects subject replay conflicts", () => {
  const runtime = createRuntimeIdempotencyRuntime({
    project: () => projection(),
    publicProjection: (value) => value,
    assertAbuseAllowed: () => {},
    authorizeExplorerAction: () => [],
  });

  runtime.idempotentlyWithSubject("subject", {
    agentId: "agent_a",
    idempotencyKey: "shared",
  }, "owner", () => result({ accepted: true }));

  assert.throws(
    () => runtime.idempotentlyWithSubject("subject", {
      agentId: "agent_b",
      idempotencyKey: "shared",
    }, "owner", () => result({ accepted: false })),
    /idempotency_key_conflict/,
  );
});

test("runtime idempotency runtime scopes explorer registration by explorer and ignores credentials in subject hash", () => {
  let runCalls = 0;
  const runtime = createRuntimeIdempotencyRuntime({
    project: () => projection(),
    publicProjection: (value) => value,
    assertAbuseAllowed: (_input, options) => {
      assert.deepEqual(options, { allowRestrictedScore: true });
    },
    authorizeExplorerAction: () => [],
  });

  const first = runtime.idempotentlyForExplorerRegistration("issue_identity", {
    idempotencyKey: "issue-1",
    identityName: "灰港守门人",
    recoveryCode: "old-secret",
  }, "explorer_a", () => {
    runCalls += 1;
    return result({ agentId: "agent_a" });
  });
  const duplicate = runtime.idempotentlyForExplorerRegistration("issue_identity", {
    idempotencyKey: "issue-1",
    identityName: "灰港守门人",
    recoveryCode: "rotated-secret",
  }, "explorer_a", () => {
    runCalls += 1;
    return result({ agentId: "agent_b" });
  });
  const otherExplorer = runtime.idempotentlyForExplorerRegistration("issue_identity", {
    idempotencyKey: "issue-1",
    identityName: "灰港守门人",
  }, "explorer_b", () => {
    runCalls += 1;
    return result({ agentId: "agent_c" });
  });

  assert.equal(runCalls, 2);
  assert.deepEqual(first.value, { agentId: "agent_a" });
  assert.equal(duplicate.duplicate, true);
  assert.deepEqual(duplicate.value, { agentId: "agent_a" });
  assert.deepEqual(otherExplorer.value, { agentId: "agent_c" });
});

test("runtime idempotency runtime authorizes explorer actions before replay and stores authorization events", () => {
  let runCalls = 0;
  const runtime = createRuntimeIdempotencyRuntime({
    project: () => projection(),
    publicProjection: (value) => value,
    assertAbuseAllowed: () => {},
    authorizeExplorerAction: (scope, input, explorerId) => {
      assert.equal(scope, "resolve_turn");
      assert.equal(input.idempotencyKey, "turn-1");
      assert.equal(explorerId, "explorer_owner");
      return [event("event_auth")];
    },
  });

  const first = runtime.idempotentlyAfterExplorerAuth("resolve_turn", {
    idempotencyKey: "turn-1",
    turnCardId: "turn_card_1",
  }, "explorer_owner", () => {
    runCalls += 1;
    return result({ settled: true }, "event_settled");
  });
  const duplicate = runtime.idempotentlyAfterExplorerAuth("resolve_turn", {
    idempotencyKey: "turn-1",
    turnCardId: "turn_card_1",
  }, "explorer_owner", () => {
    runCalls += 1;
    return result({ settled: false });
  });

  assert.equal(runCalls, 1);
  assert.deepEqual(first.events.map((entry) => entry.eventId), ["event_auth", "event_settled"]);
  assert.equal(duplicate.duplicate, true);
  assert.deepEqual(duplicate.events, []);
  assert.deepEqual(duplicate.value, { settled: true });
});

test("runtime idempotency runtime requires idempotency keys", () => {
  const runtime = createRuntimeIdempotencyRuntime({
    project: () => projection(),
    publicProjection: (value) => value,
    assertAbuseAllowed: () => {},
    authorizeExplorerAction: () => [],
  });

  assert.throws(
    () => runtime.idempotently("plain", {}, () => result({ ok: true })),
    /idempotency_key_required/,
  );
});
