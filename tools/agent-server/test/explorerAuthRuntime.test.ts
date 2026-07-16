import assert from "node:assert/strict";
import test from "node:test";
import type { EpochEvent } from "../lib/epoch/events.ts";
import type { EpochCommandContext } from "../lib/epoch/protocol.ts";
import type {
  EpochProjection,
  EpochRecoveryRotation,
  RotateExplorerRecoveryInput,
} from "../lib/epoch/gameCore.ts";
import { createExplorerAuthRuntime } from "../lib/epoch/explorerAuthRuntime.ts";
import {
  explorerSecretHash,
} from "../lib/epoch/runtimeAuth.ts";
import type { EpochRuntimeResult } from "../lib/epoch/runtimePublicProjectionRules.ts";

const createdAt = "2026-07-05T14:18:00.000Z";

type IdentityIssuedEvent = Extract<EpochEvent, { readonly eventType: "identity_issued" }>;

function recoveryCode(payload: unknown) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
}

function projection(): EpochProjection {
  return { events: [] } as unknown as EpochProjection;
}

function identityIssuedEvent(explorerId: string, localSecret: string): IdentityIssuedEvent {
  return {
    eventId: `event_identity_${explorerId}`,
    eventType: "identity_issued",
    aggregateType: "agent_identity",
    aggregateId: `agent_${explorerId}`,
    actorExplorerId: explorerId,
    agentId: `agent_${explorerId}`,
    trustClass: "user_verified_web",
    causationId: "root",
    correlationId: "corr",
    createdAt,
    payload: {
      agentId: `agent_${explorerId}`,
      explorerId,
      explorerSecretHash: explorerSecretHash(explorerId, localSecret),
      identityName: "测试身份",
      generation: 1,
      status: "active",
      lifetime: {
        max: 3,
        remaining: 3,
        startedAt: createdAt,
      },
    },
  };
}

test("explorer auth runtime hydrates and validates explorer credentials", () => {
  const auth = createExplorerAuthRuntime({
    initialEvents: [identityIssuedEvent("explorer_auth_runtime_1", "old_secret")],
    project: projection,
    publicProjection: (value) => value,
    assertAbuseAllowed: () => {},
    ownerVerifiedContextFromInput: (_input, explorerId) => ({ actorExplorerId: explorerId, trustClass: "user_verified_web" }),
    rotateExplorerRecovery: () => {
      throw new Error("should_not_rotate");
    },
  });

  assert.equal(auth.hasExplorerAuth("explorer_auth_runtime_1"), true);
  assert.doesNotThrow(() => auth.assertExplorerAuth({ localSecret: "old_secret" }, "explorer_auth_runtime_1"));
  assert.throws(
    () => auth.assertExplorerAuth({ localSecret: "wrong_secret" }, "explorer_auth_runtime_1"),
    /explorer_auth_invalid/,
  );
  assert.throws(
    () => auth.assertExplorerAuth({}, "explorer_auth_runtime_1"),
    /explorer_auth_required/,
  );
});

test("explorer auth runtime registers one stable local secret per explorer", () => {
  const auth = createExplorerAuthRuntime({
    project: projection,
    publicProjection: (value) => value,
    assertAbuseAllowed: () => {},
    ownerVerifiedContextFromInput: (_input, explorerId) => ({ actorExplorerId: explorerId, trustClass: "user_verified_web" }),
    rotateExplorerRecovery: () => {
      throw new Error("should_not_rotate");
    },
  });

  const hash = auth.registerExplorerAuth({ localSecret: "first_secret" }, "explorer_auth_runtime_2");
  assert.equal(hash, explorerSecretHash("explorer_auth_runtime_2", "first_secret"));
  assert.equal(auth.registerExplorerAuth({}, "explorer_auth_runtime_2"), hash);
  assert.throws(
    () => auth.registerExplorerAuth({ localSecret: "changed_secret" }, "explorer_auth_runtime_2"),
    /explorer_auth_invalid/,
  );
});

test("explorer auth runtime rotates recovery credentials and replays idempotently", () => {
  const newRecoveryCode = recoveryCode({ explorerId: "explorer_auth_runtime_3", localSecret: "new_secret" });
  const calls: {
    readonly input: RotateExplorerRecoveryInput;
    readonly context: EpochCommandContext;
  }[] = [];
  let abuseChecks = 0;
  const rotated: EpochRuntimeResult<EpochRecoveryRotation> = {
    value: {
      explorerId: "explorer_auth_runtime_3",
      rotated: true,
      newRecoveryRegistered: true,
      rotatedAt: createdAt,
    },
    events: [],
    projection: projection(),
  };
  const auth = createExplorerAuthRuntime({
    initialEvents: [identityIssuedEvent("explorer_auth_runtime_3", "old_secret")],
    project: projection,
    publicProjection: (value) => value,
    assertAbuseAllowed: () => {
      abuseChecks += 1;
    },
    ownerVerifiedContextFromInput: (input, explorerId) => ({
      actorExplorerId: explorerId,
      trustClass: "user_verified_web",
      idempotencyKey: typeof input.idempotencyKey === "string" ? input.idempotencyKey : undefined,
    }),
    rotateExplorerRecovery: (input, context) => {
      calls.push({ input, context });
      return rotated;
    },
  });

  const result = auth.rotateExplorerRecovery({
    explorerId: "explorer_auth_runtime_3",
    localSecret: "old_secret",
    newRecoveryCode,
    idempotencyKey: "rotate-1",
  });

  assert.equal(result.value.rotated, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.input.explorerSecretHash, explorerSecretHash("explorer_auth_runtime_3", "new_secret"));
  assert.equal(calls[0]?.context.actorExplorerId, "explorer_auth_runtime_3");
  assert.equal(abuseChecks, 1);
  assert.throws(
    () => auth.assertExplorerAuth({ localSecret: "old_secret" }, "explorer_auth_runtime_3"),
    /explorer_auth_invalid/,
  );
  assert.doesNotThrow(() => auth.assertExplorerAuth({ localSecret: "new_secret" }, "explorer_auth_runtime_3"));

  const replay = auth.rotateExplorerRecovery({
    explorerId: "explorer_auth_runtime_3",
    localSecret: "old_secret",
    newRecoveryCode,
    idempotencyKey: "rotate-1",
  });

  assert.equal(replay.duplicate, true);
  assert.deepEqual(replay.events, []);
  assert.equal(calls.length, 1);
  assert.equal(abuseChecks, 1);
});
