import assert from "node:assert/strict";
import test from "node:test";
import {
  confirmationActionForAuthScope,
  highValueConfirmationSubjectHash,
  highValueConfirmationSummary,
  turnCardResponseEnvelope,
} from "../lib/epoch/highValueConfirmationRules.ts";
import { type EpochTurnCard } from "../lib/epoch/gameCore.ts";

function turnCard(overrides: Partial<EpochTurnCard> = {}): EpochTurnCard {
  return {
    turnCardId: "turn_card_1",
    agentId: "agent_1",
    explorerId: "explorer_1",
    regionId: "region_gray_harbor",
    sequence: 7,
    nonce: "nonce_7",
    prompt: "处理裂隙",
    visibleContext: {},
    status: "open",
    actionOptions: [{ actionOptionId: "observe", label: "观察", risk: "low" }],
    createdAt: "2026-07-06T00:00:00.000Z",
    signedEnvelope: { sequence: 7, nonce: "nonce_7" },
    ...overrides,
  } as EpochTurnCard;
}

test("high-value confirmation rules hash world messages and turn card requests", () => {
  assert.match(highValueConfirmationSubjectHash({
    action: "world_message",
    request: { body: "公开发言" },
  }), /^sha256:[a-f0-9]{64}$/);

  const turnCardHash = highValueConfirmationSubjectHash({
    action: "turn_card",
    request: { agentId: "agent_1", regionId: "gray_harbor", prompt: "处理裂隙" },
  });
  assert.equal(turnCardHash, highValueConfirmationSubjectHash({
    action: "turn_card",
    request: { agentId: "agent_1", regionId: "gray_harbor", prompt: "处理裂隙" },
  }));
  assert.notEqual(turnCardHash, highValueConfirmationSubjectHash({
    action: "turn_card",
    request: { agentId: "agent_1", regionId: "gray_harbor", prompt: "改查港口" },
  }));
});

test("high-value confirmation rules validate resolve-turn envelope before hashing", () => {
  const card = turnCard();
  assert.deepEqual(turnCardResponseEnvelope({ sequence: "7", nonce: "nonce_7" }, card), {
    sequence: 7,
    nonce: "nonce_7",
  });
  assert.match(highValueConfirmationSubjectHash({
    action: "resolve_turn",
    request: {
      agentId: "agent_1",
      turnCardId: "turn_card_1",
      actionOptionId: "observe",
      sequence: 7,
      nonce: "nonce_7",
      visibleText: "先观察",
    },
    turnCard: card,
  }), /^sha256:[a-f0-9]{64}$/);
  assert.throws(() => turnCardResponseEnvelope({ sequence: 8, nonce: "nonce_7" }, card), /turn_card_sequence_mismatch/);
  assert.throws(() => highValueConfirmationSubjectHash({
    action: "resolve_turn",
    request: {
      agentId: "agent_2",
      turnCardId: "turn_card_1",
      actionOptionId: "observe",
      sequence: 7,
      nonce: "nonce_7",
    },
    turnCard: card,
  }), /turn_card_agent_mismatch/);
});

test("high-value confirmation rules produce compact summaries and scope mapping", () => {
  assert.equal(highValueConfirmationSummary("world_message", { body: "公开发言" }), "公开发言");
  assert.equal(
    highValueConfirmationSummary("turn_card", { agentId: "agent_1", regionId: "gray_harbor" }),
    "创建 gray_harbor 回合卡：执行一次区域行动",
  );
  assert.equal(
    highValueConfirmationSummary("resolve_turn", {
      turnCardId: "turn_card_1",
      actionOptionId: "observe",
      visibleText: "先观察",
    }),
    "结算 turn_card_1 选项 observe：先观察",
  );
  assert.equal(confirmationActionForAuthScope("turn_card"), "turn_card");
  assert.equal(confirmationActionForAuthScope("resolve_turn"), "resolve_turn");
  assert.equal(confirmationActionForAuthScope("post_message"), undefined);
});
