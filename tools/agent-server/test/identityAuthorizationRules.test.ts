import assert from "node:assert/strict";
import test from "node:test";

import type { EpochCommandContext } from "../lib/epoch/protocol.ts";
import {
  SERVER_ACTOR_OWNER_BYPASS_TRUST_CLASSES,
  assertClientIdentityOwner,
  assertIdentityOwner,
  assertIdentityOwnerOrSystemWorker,
  assertUserVerifiedIdentityOwner,
} from "../lib/epoch/identityAuthorizationRules.ts";

const identity = { explorerId: "explorer_owner" };

function context(overrides: Partial<EpochCommandContext> = {}): EpochCommandContext {
  return {
    actorExplorerId: "explorer_owner",
    trustClass: "user_verified_web",
    ...overrides,
  };
}

test("identity authorization rules enforce direct owner checks with caller error codes", () => {
  assert.doesNotThrow(() => assertIdentityOwner(identity, context(), "owner_mismatch"));
  assert.throws(() => assertIdentityOwner(
    identity,
    context({ actorExplorerId: "explorer_other" }),
    "owner_mismatch",
  ), /owner_mismatch/);
});

test("identity authorization rules gate user-verified owner checks only for user web trust", () => {
  assert.throws(() => assertUserVerifiedIdentityOwner(
    identity,
    context({ actorExplorerId: "explorer_other", trustClass: "user_verified_web" }),
    "user_verified_web",
    "turn_owner_mismatch",
  ), /turn_owner_mismatch/);
  assert.doesNotThrow(() => assertUserVerifiedIdentityOwner(
    identity,
    context({ actorExplorerId: "explorer_other", trustClass: "server_hosted_agent" }),
    "server_hosted_agent",
    "turn_owner_mismatch",
  ));
});

test("identity authorization rules let server actor classes bypass client owner checks", () => {
  assert.equal(SERVER_ACTOR_OWNER_BYPASS_TRUST_CLASSES.has("server_hosted_agent"), true);
  assert.equal(SERVER_ACTOR_OWNER_BYPASS_TRUST_CLASSES.has("user_verified_web"), false);

  assert.throws(() => assertClientIdentityOwner(
    identity,
    context({ actorExplorerId: "explorer_other", trustClass: "user_verified_web" }),
    "client_owner_mismatch",
  ), /client_owner_mismatch/);

  for (const trustClass of SERVER_ACTOR_OWNER_BYPASS_TRUST_CLASSES) {
    assert.doesNotThrow(() => assertClientIdentityOwner(
      identity,
      context({ actorExplorerId: "explorer_other", trustClass }),
      "client_owner_mismatch",
    ));
  }
});

test("identity authorization rules reserve owner bypass for system workers where required", () => {
  assert.doesNotThrow(() => assertIdentityOwnerOrSystemWorker(
    identity,
    context({ actorExplorerId: "explorer_other", trustClass: "system_worker" }),
    "system_owner_mismatch",
  ));
  assert.throws(() => assertIdentityOwnerOrSystemWorker(
    identity,
    context({ actorExplorerId: "explorer_other", trustClass: "server_hosted_agent" }),
    "system_owner_mismatch",
  ), /system_owner_mismatch/);
});
