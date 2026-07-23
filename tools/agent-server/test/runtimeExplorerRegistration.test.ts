import assert from "node:assert/strict";
import test from "node:test";
import { encodeExplorerRecoveryCode } from "../lib/epoch/runtimeAuth.ts";
import { epochEventsForPersistence } from "../lib/epoch/runtimePublicProjectionRules.ts";
import { createAgentWorldMcpRuntime, createAgentWorldRuntime } from "../lib/mcpTools.ts";

type RecoveryPayload = {
  readonly explorerId: string;
  readonly localSecret: string;
};

function decodeRecoveryCode(recoveryCode: string): RecoveryPayload {
  const parsed = JSON.parse(Buffer.from(recoveryCode, "base64").toString("utf8")) as unknown;
  assert.equal(typeof parsed, "object");
  assert.notEqual(parsed, null);
  assert.equal(Array.isArray(parsed), false);
  const record = parsed as Record<string, unknown>;
  const explorerId = record.explorerId;
  const localSecret = record.localSecret;
  if (typeof explorerId !== "string" || typeof localSecret !== "string") {
    throw new Error("invalid_recovery_payload");
  }
  return {
    explorerId,
    localSecret,
  };
}

test("runtime server-registers explorers without trusting caller supplied identity material", () => {
  const runtime = createAgentWorldRuntime();
  const result = runtime.epochRegisterExplorer({
    explorerId: "explorer_attacker_chosen",
    localSecret: "local_attacker_chosen",
    recoveryCode: Buffer.from(JSON.stringify({
      explorerId: "explorer_attacker_recovery",
      localSecret: "local_attacker_recovery",
    }), "utf8").toString("base64"),
    actorExplorerId: "explorer_attacker_actor",
    actor: "explorer_attacker_actor",
    identityName: "帝国统帅",
    maxLifetime: 3,
    idempotencyKey: "register-server-issued-explorer-1",
  });

  assert.match(result.explorerId, /^explorer_[a-f0-9]{32}$/);
  assert.notEqual(result.explorerId, "explorer_attacker_chosen");
  assert.equal(result.value.explorerId, result.explorerId);
  assert.notEqual(result.value.identityName, "帝国统帅");
  assert.match(result.value.identityName, /第1世$/);
  assert.match(result.value.identityName, /(?:组|队|班|所|站|营).+ · 第1世$/u);
  assert.doesNotMatch(result.value.identityName, /^(?:灰港档案学徒|余烬街临时信使|旧渠巡灯人|雾钟站见习记录员|黑石码头勤务员|北墙药圃助手) · 第1世$/u);
  assert.notEqual(result.value.lifetime.max, 3);
  assert.equal("localSecret" in result, false);

  const recovery = decodeRecoveryCode(result.recoveryCode);
  assert.equal(recovery.explorerId, result.explorerId);
  assert.match(recovery.localSecret, /^local_[a-f0-9]{64}$/);
  assert.notEqual(recovery.localSecret, "local_attacker_chosen");

  const identityEvent = result.events.find((event) => event.eventType === "identity_issued");
  assert.ok(identityEvent);
  assert.equal(identityEvent.actorExplorerId, "system-registration");
  assert.equal(identityEvent.trustClass, "system_worker");
  assert.equal(identityEvent.payload.explorerId, result.explorerId);
  assert.equal("explorerSecretHash" in identityEvent.payload, false);
  assert.equal(JSON.stringify(result.events).includes(recovery.localSecret), false);
  assert.equal(JSON.stringify(result.events).includes(result.recoveryCode), false);
  assert.doesNotMatch(JSON.stringify(result.events), /explorerSecretHash|sha256:/);
});

test("runtime explorer registration ignores client profile fields during idempotent replay", () => {
  const runtime = createAgentWorldRuntime();
  const first = runtime.epochRegisterExplorer({
    identityName: "重放身份",
    maxLifetime: 4,
    idempotencyKey: "register-server-issued-explorer-replay",
  });
  const replay = runtime.epochRegisterExplorer({
    explorerId: "explorer_ignored_on_replay",
    localSecret: "local_ignored_on_replay",
    recoveryCode: Buffer.from(JSON.stringify({
      explorerId: "explorer_ignored_on_replay",
      localSecret: "local_ignored_on_replay",
    }), "utf8").toString("base64"),
    actorExplorerId: "explorer_ignored_actor",
    identityName: "伪造帝国统帅",
    maxLifetime: 999_999,
    idempotencyKey: "register-server-issued-explorer-replay",
  });

  assert.equal(replay.duplicate, true);
  assert.equal(replay.explorerId, first.explorerId);
  assert.equal(replay.recoveryCode, first.recoveryCode);
  assert.deepEqual(replay.events, []);

  assert.equal(replay.value.identityName, first.value.identityName);
  assert.equal(replay.value.lifetime.max, first.value.lifetime.max);
});

test("production registration secret makes pairing replay-safe across runtime restarts", () => {
  const registrationSecret = "test-registration-secret-at-least-32-characters";
  const input = {
    identityName: "跨重启身份",
    maxLifetime: 5,
    idempotencyKey: "register-cross-restart",
  };
  const firstRuntime = createAgentWorldRuntime({ epoch: { registrationSecret } });
  const first = firstRuntime.epochRegisterExplorer(input);
  const restartedRuntime = createAgentWorldRuntime({
    epoch: {
      registrationSecret,
      initialEvents: first.projection.events,
    },
  });
  const replay = restartedRuntime.epochRegisterExplorer(input);

  assert.equal(replay.duplicate, true);
  assert.equal(replay.explorerId, first.explorerId);
  assert.equal(replay.recoveryCode, first.recoveryCode);
  assert.equal(replay.value.agentId, first.value.agentId);
  assert.deepEqual(replay.events, []);
  const callerMutatedReplay = restartedRuntime.epochRegisterExplorer({
    ...input,
    identityName: "冲突重放",
    maxLifetime: 999_999,
  });
  assert.equal(callerMutatedReplay.duplicate, true);
  assert.equal(callerMutatedReplay.value.identityName, first.value.identityName);
  assert.equal(callerMutatedReplay.value.lifetime.max, first.value.lifetime.max);
});

test("runtime verifies server-issued explorer auth and recovery authorizes owner action", () => {
  const runtime = createAgentWorldRuntime();
  const registered = runtime.epochRegisterExplorer({
    identityName: "恢复码行动身份",
    idempotencyKey: "register-server-issued-explorer-owner-action",
  });
  const recovery = decodeRecoveryCode(registered.recoveryCode);

  assert.deepEqual(runtime.epochVerifyExplorerAuth({
    explorerId: registered.explorerId,
    recoveryCode: registered.recoveryCode,
  }), {
    explorerId: registered.explorerId,
    verified: true,
  });
  assert.deepEqual(runtime.epochVerifyExplorerAuth({
    explorerId: registered.explorerId,
    localSecret: recovery.localSecret,
  }), {
    explorerId: registered.explorerId,
    verified: true,
  });
  assert.throws(
    () => runtime.epochVerifyExplorerAuth({
      explorerId: registered.explorerId,
      localSecret: "local_wrong_secret",
    }),
    /explorer_auth_invalid/,
  );

  const downtime = runtime.epochSetDowntime({
    agentId: registered.value.agentId,
    mode: "meditation",
    recoveryCode: registered.recoveryCode,
    idempotencyKey: "server-issued-recovery-set-downtime",
  });
  assert.equal(downtime.value.agentId, registered.value.agentId);
  assert.equal(downtime.value.mode, "meditation");

  const rotated = runtime.epochRotateRecovery({
    explorerId: registered.explorerId,
    recoveryCode: registered.recoveryCode,
    newRecoveryCode: encodeExplorerRecoveryCode(registered.explorerId, "local_rotated_recovery_secret_1234567890"),
    idempotencyKey: "server-issued-recovery-rotate",
  });
  assert.doesNotMatch(JSON.stringify(rotated), /explorerSecretHash|sha256:/);
  assert.match(JSON.stringify(epochEventsForPersistence(rotated)), /explorerSecretHash|sha256:/);
});

test("runtime auth verification is not exposed as MCP tools", () => {
  const mcp = createAgentWorldMcpRuntime();
  const toolNames = mcp.listTools().map((tool) => tool.name);
  assert.equal(toolNames.includes("obsidian_epoch.register_explorer"), true);
  assert.equal(toolNames.includes("obsidian_epoch.verify_explorer_auth"), false);
});
