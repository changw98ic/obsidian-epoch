import assert from "node:assert/strict";
import test from "node:test";

import {
  JOURNEY_ACTION_TRAITS,
  JOURNEY_POLICY_PRESETS,
  JOURNEY_POLICY_PRESET_VERSION,
  JOURNEY_SYNCHRONOUS_QUESTION_BUDGET,
  buildJourneyPolicyPreview,
  evaluateJourneyActionPolicy,
  journeyPolicyPreset,
  normalizeJourneyActionOption,
  normalizeJourneyAutonomyPolicy,
  normalizeJourneyMandate,
  normalizeJourneyPolicySelection,
  type JourneyActionTrait,
} from "../lib/epoch/journeyPolicyRules.ts";

function actionOption(overrides: Record<string, unknown> = {}) {
  return {
    actionOptionId: "action_1",
    risk: "low",
    spend: 0,
    journeySpendBefore: 0,
    automaticLifetimeLoss: 0,
    traits: [],
    serverEligible: true,
    ...overrides,
  };
}

test("journey policy presets are versioned, distinct, and safe by default", () => {
  assert.equal(JOURNEY_POLICY_PRESET_VERSION, "1");
  assert.deepEqual(Object.keys(JOURNEY_POLICY_PRESETS), ["cautious", "balanced", "explorer"]);
  assert.equal(JOURNEY_POLICY_PRESETS.cautious.policy.maxRisk, "low");
  assert.equal(JOURNEY_POLICY_PRESETS.balanced.policy.maxRisk, "medium");
  assert.equal(JOURNEY_POLICY_PRESETS.explorer.policy.maxRisk, "medium");
  assert.ok(
    JOURNEY_POLICY_PRESETS.cautious.policy.maxJourneySpend
      < JOURNEY_POLICY_PRESETS.balanced.policy.maxJourneySpend,
  );
  assert.ok(
    JOURNEY_POLICY_PRESETS.balanced.policy.maxJourneySpend
      < JOURNEY_POLICY_PRESETS.explorer.policy.maxJourneySpend,
  );

  for (const preset of Object.values(JOURNEY_POLICY_PRESETS)) {
    assert.equal(preset.version, JOURNEY_POLICY_PRESET_VERSION);
    assert.equal(preset.policy.maxAutomaticLifetimeLoss, 0);
    assert.equal(preset.policy.allowPvP, false);
    assert.equal(preset.policy.allowOrganizationJoin, false);
    assert.equal(preset.policy.allowPermanentRelationshipChange, false);
  }

  const cloned = journeyPolicyPreset("cautious");
  assert.notEqual(cloned.policy, JOURNEY_POLICY_PRESETS.cautious.policy);
  assert.throws(() => journeyPolicyPreset("reckless"), /journey_policy_preset_invalid/);
});

test("mandate normalization applies zero-question safe defaults and trims bounded lists", () => {
  assert.deepEqual(normalizeJourneyMandate(), {
    objective: "安全地了解当地情况并按时返回",
    priorities: [],
    avoid: [],
    preferredActivities: [],
    socialPreference: "balanced",
    returnCondition: "time",
  });

  assert.deepEqual(normalizeJourneyMandate({
    objective: "  在灰港找稳定工作  ",
    priorities: ["  稳定收入 ", "认识可靠的人", "稳定收入"],
    avoid: ["异常", "  高风险区  "],
    preferredActivities: ["工作", "走访"],
    socialPreference: "reserved",
    returnCondition: "objective",
  }), {
    objective: "在灰港找稳定工作",
    priorities: ["稳定收入", "认识可靠的人"],
    avoid: ["异常", "高风险区"],
    preferredActivities: ["工作", "走访"],
    socialPreference: "reserved",
    returnCondition: "objective",
  });
});

test("mandate normalization rejects malformed and misspelled fields instead of widening policy", () => {
  assert.throws(() => normalizeJourneyMandate(null), /journey_mandate_invalid/);
  assert.throws(() => normalizeJourneyMandate({ objective: " " }), /journey_mandate_objective_invalid/);
  assert.throws(() => normalizeJourneyMandate({ priorities: "稳定" }), /journey_mandate_priorities_invalid/);
  assert.throws(() => normalizeJourneyMandate({ priorities: [""] }), /journey_mandate_priorities_invalid/);
  assert.throws(
    () => normalizeJourneyMandate({ socialPreference: "reckless" }),
    /journey_mandate_social_preference_invalid/,
  );
  assert.throws(
    () => normalizeJourneyMandate({ returnCondition: "forever" }),
    /journey_mandate_return_condition_invalid/,
  );
  assert.throws(
    () => normalizeJourneyMandate({ maxRisk: "high" }),
    /journey_mandate_unknown_field:maxRisk/,
  );
});

test("policy normalization starts from a selected preset and accepts only strict bounded overrides", () => {
  const selection = normalizeJourneyPolicySelection({
    presetId: "balanced",
    overrides: {
      maxSingleSpend: 3,
      maxJourneySpend: 9,
      allowPublicMessages: false,
    },
  });
  assert.equal(selection.presetId, "balanced");
  assert.equal(selection.presetVersion, JOURNEY_POLICY_PRESET_VERSION);
  assert.equal(selection.policy.maxRisk, "medium");
  assert.equal(selection.policy.maxSingleSpend, 3);
  assert.equal(selection.policy.maxJourneySpend, 9);
  assert.equal(selection.policy.allowPublicMessages, false);
  assert.equal(selection.policy.maxAutomaticLifetimeLoss, 0);

  assert.equal(normalizeJourneyPolicySelection().presetId, "cautious");
  assert.throws(
    () => normalizeJourneyPolicySelection({ preset: "balanced" }),
    /journey_policy_selection_unknown_field:preset/,
  );
  assert.throws(
    () => normalizeJourneyPolicySelection({ presetId: "reckless" }),
    /journey_policy_preset_invalid/,
  );
});

test("policy normalization rejects invalid numeric, boolean, enum, and lifetime boundaries", () => {
  assert.throws(
    () => normalizeJourneyAutonomyPolicy({ maxSingleSpend: -1 }),
    /journey_policy_max_single_spend_invalid/,
  );
  assert.throws(
    () => normalizeJourneyAutonomyPolicy({ maxSingleSpend: 1.5 }),
    /journey_policy_max_single_spend_invalid/,
  );
  assert.throws(
    () => normalizeJourneyAutonomyPolicy({ maxSingleSpend: 7, maxJourneySpend: 6 }),
    /journey_policy_spend_limits_invalid/,
  );
  assert.throws(
    () => normalizeJourneyAutonomyPolicy({ maxAutomaticLifetimeLoss: 1 }),
    /journey_policy_automatic_lifetime_loss_must_be_zero/,
  );
  assert.throws(
    () => normalizeJourneyAutonomyPolicy({ allowPvP: "yes" }),
    /journey_policy_allow_pvp_invalid/,
  );
  assert.throws(
    () => normalizeJourneyAutonomyPolicy({ maxRisk: "extreme" }),
    /journey_policy_max_risk_invalid/,
  );
  assert.throws(
    () => normalizeJourneyAutonomyPolicy({ timeoutPolicy: "continue" }),
    /journey_policy_timeout_policy_invalid/,
  );
  assert.throws(
    () => normalizeJourneyAutonomyPolicy({ allowPvp: true }),
    /journey_autonomy_policy_unknown_field:allowPvp/,
  );
});

test("action option normalization rejects ambiguous authority and malformed costs", () => {
  assert.deepEqual(normalizeJourneyActionOption(actionOption({
    traits: ["small_trade", "small_trade", "agent_meeting"],
    availableSpend: 4,
  })), {
    actionOptionId: "action_1",
    risk: "low",
    spend: 0,
    journeySpendBefore: 0,
    availableSpend: 4,
    automaticLifetimeLoss: 0,
    traits: ["small_trade", "agent_meeting"],
    serverEligible: true,
    serverDenialCode: undefined,
  });

  assert.throws(
    () => normalizeJourneyActionOption(actionOption({ spend: "1" })),
    /journey_action_option_spend_invalid/,
  );
  assert.throws(
    () => normalizeJourneyActionOption(actionOption({ traits: ["steal"] })),
    /journey_action_option_trait_invalid/,
  );
  assert.throws(
    () => normalizeJourneyActionOption(actionOption({ serverDenialCode: "blocked" })),
    /journey_action_option_server_denial_code_unexpected/,
  );
  assert.throws(
    () => normalizeJourneyActionOption(actionOption({ outcome: "success" })),
    /journey_action_option_unknown_field:outcome/,
  );
});

test("actions at exact risk and spend boundaries execute automatically", () => {
  const policy = normalizeJourneyAutonomyPolicy({
    maxRisk: "medium",
    maxSingleSpend: 5,
    maxJourneySpend: 10,
  }, "balanced");
  const decision = evaluateJourneyActionPolicy({
    policy,
    actionOption: actionOption({
      risk: "medium",
      spend: 5,
      journeySpendBefore: 5,
      availableSpend: 5,
      traits: ["routine_work", "small_trade", "agent_meeting"],
    }),
  });

  assert.deepEqual(decision, {
    outcome: "automatic",
    reason: "within_policy",
    boundaries: [],
    questionBudget: { maximum: 1, asked: 0, remaining: 1 },
  });
});

test("each disabled action trait requires the user while a question remains", () => {
  const policy = normalizeJourneyAutonomyPolicy({}, "cautious");
  const disabledTraits: readonly JourneyActionTrait[] = JOURNEY_ACTION_TRAITS.filter((trait) => ![
    "routine_work",
    "small_trade",
    "agent_meeting",
  ].includes(trait));

  for (const trait of disabledTraits) {
    const decision = evaluateJourneyActionPolicy({
      policy,
      actionOption: actionOption({ traits: [trait] }),
    });
    assert.equal(decision.outcome, "requires_user", trait);
    assert.equal(decision.questionBudget.remaining, 1, trait);
  }
});

test("risk, spend, lifetime, and disabled capabilities are batched into one user decision", () => {
  const decision = evaluateJourneyActionPolicy({
    policy: normalizeJourneyAutonomyPolicy({}, "cautious"),
    actionOption: actionOption({
      risk: "high",
      spend: 4,
      journeySpendBefore: 5,
      automaticLifetimeLoss: 1,
      traits: ["pvp", "organization_join", "permanent_relationship_change"],
    }),
  });

  assert.equal(decision.outcome, "requires_user");
  assert.deepEqual(decision.boundaries, [
    "risk_above_policy",
    "single_spend_above_policy",
    "journey_spend_above_policy",
    "automatic_lifetime_loss_above_policy",
    "pvp_not_allowed",
    "organization_join_not_allowed",
    "permanent_relationship_change_not_allowed",
  ]);
  assert.equal(decision.questionBudget.maximum, JOURNEY_SYNCHRONOUS_QUESTION_BUDGET);
});

test("ordinary journeys never ask a second synchronous question", () => {
  const decision = evaluateJourneyActionPolicy({
    policy: normalizeJourneyAutonomyPolicy({}, "balanced"),
    actionOption: actionOption({ risk: "high" }),
    synchronousQuestionsAsked: 1,
  });
  assert.deepEqual(decision, {
    outcome: "safe_reject",
    reason: "question_budget_exhausted",
    boundaries: ["risk_above_policy"],
    fallback: "safe_decline",
    questionBudget: { maximum: 1, asked: 1, remaining: 0 },
  });

  assert.throws(
    () => evaluateJourneyActionPolicy({
      policy: {},
      actionOption: actionOption(),
      synchronousQuestionsAsked: 2,
    }),
    /journey_question_budget_asked_invalid/,
  );
});

test("server denials and insufficient resources are safe rejects without consuming a question", () => {
  assert.deepEqual(evaluateJourneyActionPolicy({
    policy: {},
    actionOption: actionOption({ serverEligible: false, serverDenialCode: "option_expired" }),
  }), {
    outcome: "safe_reject",
    reason: "server_ineligible",
    boundaries: [],
    fallback: "server_denial",
    serverDenialCode: "option_expired",
    questionBudget: { maximum: 1, asked: 0, remaining: 1 },
  });

  const insufficient = evaluateJourneyActionPolicy({
    policy: {},
    actionOption: actionOption({ spend: 2, availableSpend: 1 }),
  });
  assert.equal(insufficient.outcome, "safe_reject");
  assert.equal(insufficient.reason, "resource_insufficient");
  assert.equal(insufficient.questionBudget.asked, 0);
});

test("preview is concise human-readable preparation rather than a policy schema", () => {
  const preview = buildJourneyPolicyPreview({
    mandate: {
      objective: "去灰港找稳定工作",
      priorities: ["稳定收入", "认识可靠的人"],
      avoid: ["异常"],
      preferredActivities: ["工作"],
      socialPreference: "balanced",
      returnCondition: "time",
    },
    policySelection: { presetId: "cautious" },
    expectedReturn: "现实时间约 30 分钟",
  });

  assert.equal(preview.presetId, "cautious");
  assert.equal(preview.presetVersion, JOURNEY_POLICY_PRESET_VERSION);
  assert.match(preview.text, /^计划：去灰港找稳定工作/m);
  assert.match(preview.text, /预计返程：现实时间约 30 分钟/);
  assert.match(preview.text, /自动花费：单次最多 2，全程最多 6/);
  assert.match(preview.text, /任何寿命损失/);
  assert.match(preview.text, /加入组织/);
  assert.match(preview.text, /与其他身份对抗/);
  assert.match(preview.text, /永久关系变化/);
  assert.doesNotMatch(preview.text, /maxRisk|maxSingleSpend|allowPvP|timeoutPolicy/);
});
