import assert from "node:assert/strict";
import test from "node:test";
import { createAgentPlayerActionReadiness } from "./agentPlayerActionReadinessController";

function readiness(input: Partial<Parameters<typeof createAgentPlayerActionReadiness>[0]> = {}) {
  return createAgentPlayerActionReadiness({
    isBusy: false,
    busyReason: "正在执行上一项操作，完成后可继续。",
    currentAgentId: "agent_1",
    hasExplorer: true,
    identitySlotsAvailable: 1,
    canUseActiveIdentity: true,
    ...input,
  });
}

test("createAgentPlayerActionReadiness blocks every primary action while busy", () => {
  const result = readiness({ isBusy: true });

  assert.deepEqual(result, {
    identity: "正在执行上一项操作，完成后可继续。",
    downtime: "正在执行上一项操作，完成后可继续。",
    completeRun: "正在执行上一项操作，完成后可继续。",
    result: "正在执行上一项操作，完成后可继续。",
    installStatus: "正在执行上一项操作，完成后可继续。",
  });
});

test("createAgentPlayerActionReadiness explains identity start blockers", () => {
  assert.equal(
    readiness({ currentAgentId: "", hasExplorer: false }).identity,
    "",
  );
  assert.equal(
    readiness({ currentAgentId: "", identitySlotsAvailable: 0 }).identity,
    "身份槽已满，需先归档或轮回一个身份。",
  );
});

test("createAgentPlayerActionReadiness explains missing identity and explorer blockers", () => {
  const missingIdentity = readiness({ currentAgentId: "" });
  assert.equal(missingIdentity.downtime, "需要先开始/继续身份，托管行动才会解锁。");
  assert.equal(missingIdentity.completeRun, "需要先开始/继续身份，完整探索才会解锁。");

  const missingExplorer = readiness({ hasExplorer: false });
  assert.equal(missingExplorer.downtime, "正在载入玩家恢复凭据，载入后可选择托管行动。");
  assert.equal(missingExplorer.completeRun, "正在载入玩家恢复凭据，载入后可完整探索。");
});

test("createAgentPlayerActionReadiness prefers server action eligibility reasons", () => {
  const result = readiness({
    canUseActiveIdentity: false,
    actionEligibilityReason: "身份已归档，不能继续行动。",
  });

  assert.equal(result.downtime, "身份已归档，不能继续行动。");
  assert.equal(result.completeRun, "身份已归档，不能继续行动。");
});

test("createAgentPlayerActionReadiness allows actions when no blocker applies", () => {
  assert.deepEqual(readiness(), {
    identity: "",
    downtime: "",
    completeRun: "",
    result: "",
    installStatus: "",
  });
});
