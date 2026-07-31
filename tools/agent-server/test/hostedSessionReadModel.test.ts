import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";
import type { EpochActionExplanation } from "../lib/epoch/events.ts";
import type {
  EpochHostedActionRecord,
  EpochHostedSession,
  EpochProjection,
} from "../lib/epoch/gameCore.ts";

const modulePath = new URL("../lib/epoch/hostedSessionReadModel.ts", import.meta.url);

const explanationFixture: EpochActionExplanation = {
  brief: "公开解释",
  trigger: "测试公开投影。",
  choiceReason: "确保公开列表只暴露服务器结算后的安全字段。",
  rejectedAlternatives: ["不公开未结算候选行动。"],
  risk: "中风险：用于类型正确的 fixture。",
  expectedBenefit: "验证脱敏行为。",
};

function hostedActionFixture(input: {
  actionId: string;
  sessionId: string;
  agentId: string;
  optionLabel: string;
  recordedAt: string;
}): EpochHostedActionRecord {
  return {
    actionId: input.actionId,
    sessionId: input.sessionId,
    agentId: input.agentId,
    channelClass: "browser_copy_paste",
    deliveryTrust: "untrusted_client",
    actionOptionId: `${input.actionId}_option`,
    optionLabel: input.optionLabel,
    risk: "medium",
    socialHookId: "hook_hidden",
    attestationId: "attestation_public",
    explanation: explanationFixture,
    visibleText: "客户端提交的完整可见文本只保留在内部记录。",
    outcomeSummary: "结算摘要",
    reward: { resourceId: "coin", amount: 1, reason: "hosted_action" },
    lifetimeDelta: 1,
    nonEvidence: true,
    recordedAt: input.recordedAt,
    signedEnvelope: {
      envelopeId: "hosted_action_envelope",
      protocolVersion: "obsidian-epoch.hosted-action-envelope.v1",
      signatureAlgorithm: "Ed25519",
      serverPublicKey: "hosted_action_public_key",
      contentHash: "sha256:hostedactionpayload",
      signature: "hosted_action_signature",
      trustClass: "untrusted_client",
      runTicketId: null,
    },
  };
}

function hostedSessionFixture(input: {
  sessionId: string;
  agentId: string;
  explorerId: string;
  status: "active" | "completed";
  startedAt: string;
}): EpochHostedSession {
  return {
    sessionId: input.sessionId,
    agentId: input.agentId,
    explorerId: input.explorerId,
    regionId: "region_gray_harbor",
    mandate: "公开会话投影测试",
    channelClass: "browser_copy_paste",
    deliveryTrust: "untrusted_client",
    status: input.status,
    sceneContract: {
      sceneId: `${input.sessionId}_secret_scene`,
      actionOptions: [{ signature: "secret_scene_signature" }],
    } as unknown as NonNullable<EpochHostedSession["sceneContract"]>,
    actionOptions: [{
      actionOptionId: `${input.sessionId}_secret_option`,
      optionKey: "observe",
      label: "内部候选行动",
      risk: "low",
      explanation: explanationFixture,
      outcomeSummary: "候选行动结算摘要",
      reward: { resourceId: "coin", amount: 2, reason: "hosted_option" },
    }],
    actions: [hostedActionFixture({
      actionId: `${input.sessionId}_action`,
      sessionId: input.sessionId,
      agentId: input.agentId,
      optionLabel: "已结算行动",
      recordedAt: "2026-07-07T05:00:00.000Z",
    })],
    startedAt: input.startedAt,
    ...(input.status === "completed" ? { completedAt: "2026-07-07T06:00:00.000Z" } : {}),
  };
}

function projectionFixture(): EpochProjection {
  return {
    hostedSessions: {
      session_old_active: hostedSessionFixture({
        sessionId: "session_old_active",
        agentId: "agent_a",
        explorerId: "explorer_a",
        status: "active",
        startedAt: "2026-07-07T01:00:00.000Z",
      }),
      session_new_completed: hostedSessionFixture({
        sessionId: "session_new_completed",
        agentId: "agent_a",
        explorerId: "explorer_a",
        status: "completed",
        startedAt: "2026-07-07T03:00:00.000Z",
      }),
      session_other_agent: hostedSessionFixture({
        sessionId: "session_other_agent",
        agentId: "agent_b",
        explorerId: "explorer_b",
        status: "completed",
        startedAt: "2026-07-07T02:00:00.000Z",
      }),
    },
  } as unknown as EpochProjection;
}

test("hosted session read model filters, sorts, and limits sessions", async () => {
  assert.ok(existsSync(modulePath), "hostedSessionReadModel.ts should own hosted session projections");
  const readModel = await import("../lib/epoch/hostedSessionReadModel.ts");
  const projection = projectionFixture();

  assert.deepEqual(
    readModel.hostedSessionsView(projection, { agentId: "agent_a" }).map((session) => session.sessionId),
    ["session_new_completed", "session_old_active"],
  );
  assert.deepEqual(
    readModel.hostedSessionsView(projection, { status: "completed" }).map((session) => session.sessionId),
    ["session_new_completed", "session_other_agent"],
  );
  assert.deepEqual(
    readModel.publicHostedSessionsView(projection, { limit: 1 }).map((session) => session.sessionId),
    ["session_new_completed"],
  );
});

test("hosted session read model redacts public session internals", async () => {
  assert.ok(existsSync(modulePath), "hostedSessionReadModel.ts should own hosted session redaction");
  const readModel = await import("../lib/epoch/hostedSessionReadModel.ts");
  const projection = projectionFixture();

  const activeSession = readModel.publicHostedSession(projection.hostedSessions.session_old_active);
  assert.deepEqual(activeSession.actionOptions, []);
  assert.deepEqual(activeSession.actions, []);
  assert.equal(activeSession.sceneContract, undefined);

  const completedSession = readModel.publicHostedSession(projection.hostedSessions.session_new_completed);
  assert.deepEqual(completedSession.actionOptions, []);
  assert.equal(completedSession.actions.length, 1);
  assert.equal("visibleText" in completedSession.actions[0], false);
  assert.equal("nonEvidence" in completedSession.actions[0], false);
  assert.equal(completedSession.actions[0].signedEnvelope.signature, "hosted_action_signature");

  const publicAction = readModel.publicHostedAction(projection.hostedSessions.session_new_completed.actions[0]);
  assert.equal("visibleText" in publicAction, false);
  assert.equal("nonEvidence" in publicAction, false);
  assert.equal(publicAction.outcomeSummary, "结算摘要");
});

test("hosted session read model contains only session facts and public redaction", async () => {
  assert.ok(existsSync(modulePath), "hostedSessionReadModel.ts should own hosted session facts");
  const readModel = await import("../lib/epoch/hostedSessionReadModel.ts");
  assert.equal("hostedSessionWatchActions" in readModel, false);
});
