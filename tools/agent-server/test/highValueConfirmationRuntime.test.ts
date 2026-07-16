import assert from "node:assert/strict";
import test from "node:test";
import type { EpochEvent } from "../lib/epoch/events.ts";
import type { EpochProjection } from "../lib/epoch/gameCore.ts";
import type { EpochCommandContext, EpochIdFactory } from "../lib/epoch/protocol.ts";
import {
  createHighValueConfirmationRuntime,
} from "../lib/epoch/highValueConfirmationRuntime.ts";

function projection(): EpochProjection {
  return {
    identities: {
      agent_1: {
        agentId: "agent_1",
        explorerId: "explorer_1",
        identityName: "灰港调查员",
        status: "active",
      },
    },
    turnCards: {},
  } as unknown as EpochProjection;
}

function context(input: Readonly<Record<string, unknown>>, explorerId: string, trustClass: "untrusted_client" | "user_verified_web"): EpochCommandContext {
  return {
    actorExplorerId: explorerId,
    trustClass,
    idempotencyKey: typeof input.idempotencyKey === "string" ? input.idempotencyKey : undefined,
  };
}

function internalEvents(result: object): readonly EpochEvent[] {
  const descriptor = Object.getOwnPropertyDescriptor(result, "events");
  return Array.isArray(descriptor?.value) ? descriptor.value as readonly EpochEvent[] : [];
}

function createHarness(nowIso = "2026-07-06T00:00:00.000Z") {
  let counter = 0;
  let nowMs = Date.parse(nowIso);
  const abuseChecks: Array<{ readonly allowRestrictedScore?: boolean }> = [];
  const authChecks: string[] = [];
  const idFactory: EpochIdFactory = (kind) => `${kind}_${String(counter += 1).padStart(4, "0")}`;
  const runtime = createHighValueConfirmationRuntime({
    clock: () => new Date(nowMs),
    confirmationTtlMs: 10 * 60_000,
    idFactory,
    project: projection,
    assertAbuseAllowed: (_input, options = {}) => {
      abuseChecks.push(options);
    },
    assertExplorerAuth: (input, explorerId) => {
      authChecks.push(explorerId);
      if (input.recoveryCode !== "ok") throw new Error("explorer_auth_invalid");
    },
    untrustedClientContext: (input, fallbackExplorerId) => context(input, fallbackExplorerId, "untrusted_client"),
    ownerVerifiedContextFromInput: (input, explorerId) => context(input, explorerId, "user_verified_web"),
  });
  return {
    runtime,
    abuseChecks,
    authChecks,
    advanceTo: (nextIso: string) => {
      nowMs = Date.parse(nextIso);
    },
  };
}

test("high-value confirmation runtime requests confirms lists and consumes tokens", () => {
  const { runtime, abuseChecks, authChecks } = createHarness();

  const requested = runtime.request({
    idempotencyKey: "request_1",
    action: "world_message",
    agentId: "agent_1",
    body: "公开留言",
    recoveryCode: "ok",
  });
  const requestEvents = internalEvents(requested);
  assert.equal(requested.confirmation.status, "pending");
  assert.equal(requested.confirmation.summary, "公开留言");
  assert.equal(requestEvents.length, 1);
  assert.equal(requestEvents[0].eventType, "high_value_confirmation_requested");
  assert.equal(requestEvents[0].trustClass, "untrusted_client");
  assert.equal(requestEvents[0].idempotencyKey, "request_1");
  assert.equal(runtime.request({
    idempotencyKey: "request_1",
    action: "world_message",
    agentId: "agent_1",
    body: "公开留言",
    recoveryCode: "ok",
  }).duplicate, true);

  const confirmed = runtime.confirm({
    idempotencyKey: "confirm_1",
    confirmationId: requested.confirmation.confirmationId,
    explorerId: "explorer_1",
    recoveryCode: "ok",
  });
  const confirmEvents = internalEvents(confirmed);
  assert.equal(confirmed.confirmation.status, "confirmed");
  assert.match(confirmed.confirmationToken, /^confirm_token_/);
  assert.equal(confirmEvents.length, 1);
  assert.equal(confirmEvents[0].eventType, "high_value_confirmation_confirmed");
  assert.equal(confirmEvents[0].trustClass, "user_verified_web");
  assert.equal(runtime.confirm({
    idempotencyKey: "confirm_1",
    confirmationId: requested.confirmation.confirmationId,
    explorerId: "explorer_1",
    recoveryCode: "ok",
  }).duplicate, true);

  assert.deepEqual(runtime.list({
    explorerId: "explorer_1",
    recoveryCode: "ok",
    status: "confirmed",
  }).confirmations.map((confirmation) => confirmation.confirmationId), [requested.confirmation.confirmationId]);

  const consumedEvents = runtime.consume({
    idempotencyKey: "consume_1",
    confirmationToken: confirmed.confirmationToken,
    agentId: "agent_1",
  }, "world_message", requested.confirmation.subjectHash);
  assert.equal(consumedEvents.length, 1);
  assert.equal(consumedEvents[0].eventType, "high_value_confirmation_consumed");
  assert.equal(runtime.consume({
    idempotencyKey: "consume_1",
    confirmationToken: confirmed.confirmationToken,
    agentId: "agent_1",
  }, "world_message", requested.confirmation.subjectHash).length, 0);
  assert.throws(() => runtime.consume({
    idempotencyKey: "consume_2",
    confirmationToken: confirmed.confirmationToken,
    agentId: "agent_1",
  }, "world_message", requested.confirmation.subjectHash), /high_value_confirmation_already_used/);

  assert.deepEqual(abuseChecks, [{}, { allowRestrictedScore: true }]);
  assert.deepEqual(authChecks, ["explorer_1", "explorer_1", "explorer_1", "explorer_1", "explorer_1"]);
});

test("high-value confirmation runtime hydrates confirmed and consumed state from events", () => {
  const source = createHarness();
  const requested = source.runtime.request({
    idempotencyKey: "request_1",
    action: "world_message",
    agentId: "agent_1",
    body: "公开留言",
    recoveryCode: "ok",
  });
  const confirmed = source.runtime.confirm({
    idempotencyKey: "confirm_1",
    confirmationId: requested.confirmation.confirmationId,
    explorerId: "explorer_1",
    recoveryCode: "ok",
  });
  const consumedEvents = source.runtime.consume({
    idempotencyKey: "consume_1",
    confirmationToken: confirmed.confirmationToken,
    agentId: "agent_1",
  }, "world_message", requested.confirmation.subjectHash);
  const replayEvents = [
    ...internalEvents(requested),
    ...internalEvents(confirmed),
    ...consumedEvents,
  ];

  const restored = createHarness().runtime;
  replayEvents.forEach((event) => restored.hydrateEvent(event));

  assert.equal(restored.request({
    idempotencyKey: "request_1",
    action: "world_message",
    agentId: "agent_1",
    body: "公开留言",
    recoveryCode: "ok",
  }).duplicate, true);
  assert.equal(restored.list({
    explorerId: "explorer_1",
    recoveryCode: "ok",
  }).confirmations[0].status, "consumed");
  assert.equal(restored.consume({
    idempotencyKey: "consume_1",
    confirmationToken: confirmed.confirmationToken,
    agentId: "agent_1",
  }, "world_message", requested.confirmation.subjectHash).length, 0);
});

test("high-value confirmation runtime expires pending confirmations on read and consume", () => {
  const harness = createHarness();
  const requested = harness.runtime.request({
    idempotencyKey: "request_1",
    action: "world_message",
    agentId: "agent_1",
    body: "公开留言",
    recoveryCode: "ok",
  });

  harness.advanceTo("2026-07-06T00:11:00.000Z");

  assert.equal(harness.runtime.list({
    explorerId: "explorer_1",
    recoveryCode: "ok",
  }).confirmations[0].status, "expired");
  assert.throws(() => harness.runtime.confirm({
    idempotencyKey: "confirm_1",
    confirmationId: requested.confirmation.confirmationId,
    explorerId: "explorer_1",
    recoveryCode: "ok",
  }), /high_value_confirmation_expired/);
});
