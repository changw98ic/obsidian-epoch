import assert from "node:assert/strict";
import test from "node:test";

import {
  contextFromInput,
  maintenanceContext,
  ownerVerifiedContextFromInput,
  untrustedClientContext,
} from "../lib/epoch/runtimeCommandContextRules.ts";

test("runtime command context rules normalize generic context metadata", () => {
  assert.deepEqual(contextFromInput({
    actorExplorerId: "actor_a",
    explorerId: "ignored_explorer",
    trustClass: "system_worker",
    causationId: "cause_1",
    correlationId: "corr_1",
    idempotencyKey: "idem_1",
  }, "fallback"), {
    actorExplorerId: "actor_a",
    trustClass: "system_worker",
    causationId: "cause_1",
    correlationId: "corr_1",
    idempotencyKey: "idem_1",
  });

  assert.deepEqual(contextFromInput({
    explorerId: "explorer_a",
    trustClass: "not-a-trust-class",
  }, "fallback"), {
    actorExplorerId: "explorer_a",
    trustClass: "untrusted_client",
    causationId: undefined,
    correlationId: undefined,
    idempotencyKey: undefined,
  });
});

test("runtime command context rules build untrusted client context with fallback owner", () => {
  assert.deepEqual(untrustedClientContext({
    explorerId: "explorer_a",
    actorExplorerId: "actor_spoof",
    trustClass: "system_worker",
    idempotencyKey: "client_idem",
  }, "fallback"), {
    actorExplorerId: "fallback",
    trustClass: "untrusted_client",
    causationId: undefined,
    correlationId: undefined,
    idempotencyKey: "client_idem",
  });

  assert.equal(untrustedClientContext({}, "fallback_owner").actorExplorerId, "fallback_owner");
});

test("runtime command context rules build owner verified web context", () => {
  assert.deepEqual(ownerVerifiedContextFromInput({
    actorExplorerId: "spoofed_actor",
    causationId: "cause_owner",
    correlationId: "corr_owner",
    idempotencyKey: "idem_owner",
  }, "real_owner"), {
    actorExplorerId: "real_owner",
    trustClass: "user_verified_web",
    causationId: "cause_owner",
    correlationId: "corr_owner",
    idempotencyKey: "idem_owner",
  });
});

test("runtime command context rules build system maintenance context", () => {
  assert.deepEqual(maintenanceContext({
    actorExplorerId: "spoofed_actor",
    explorerId: "spoofed_explorer",
    idempotencyKey: "ignored_idem",
    causationId: "cause_maintenance",
    correlationId: "corr_maintenance",
  }, "system_idem"), {
    actorExplorerId: "system",
    trustClass: "system_worker",
    idempotencyKey: "system_idem",
    causationId: "cause_maintenance",
    correlationId: "corr_maintenance",
  });
});
