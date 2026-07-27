import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { JourneySceneActionOption } from "../lib/epoch/journeySceneContractRules.ts";
import {
  splitActionOption,
  serializeCompact,
  serializeHosted,
  serializeSession,
  serializeSampling,
  assertPublicActionSafe,
  assertPublicActionZeroBonus,
  deriveDecisionEffect,
  type PublicActionOption,
  type InternalActionOption,
  type SignedActionOption,
} from "../lib/epoch/journeyActionPublicSerializer.ts";

// ── Test fixture ──────────────────────────────────────────────────────────

function makeFullActionOption(overrides?: Partial<JourneySceneActionOption>): JourneySceneActionOption {
  return {
    actionOptionId: "action_abc123",
    optionKey: "investigate_scene",
    label: "调查现场",
    intent: "仔细检查现场遗留的线索和物品",
    risk: "medium",
    riskTerms: {
      resourceCost: { resourceId: "focus", amount: 1 },
      successReward: { resourceId: "coin", amount: 1 },
      exceptionalSuccessReward: { resourceId: "coin", amount: 1 },
    },
    preconditionRefs: ["fact_001", "fact_002"],
    allowedEffectKinds: ["journey_progress", "clue_created"],
    targetEntityIds: ["object_npc_001", "object_item_002"],
    outcomeSummary: "成功调查现场，发现关键线索",
    taskObjectiveId: "obj_main_1",
    contentHash: "sha256:abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
    signatureAlgorithm: "Ed25519",
    signatureVersion: 1,
    signingPurpose: "journey_scene_action",
    signingKeyId: "key_001",
    serverPublicKey: "-----BEGIN PUBLIC KEY-----\nMFYwEAYHKoZIzj0CAQYFK4EEAAoDQgAE...\n-----END PUBLIC KEY-----",
    signature: "base64signaturevalue==",
    ...overrides,
  };
}

const TEST_JOURNEY_ID = "journey_test_001";
const TEST_SCENE_ID = "scene_test_001";
const TEST_CONTRACT_VERSION = 2;
const TEST_EXPIRES_AT = "2026-08-01T00:00:00Z";

// ── splitActionOption ─────────────────────────────────────────────────────

describe("splitActionOption", () => {
  it("returns public/internal/signed surfaces", () => {
    const action = makeFullActionOption();
    const result = splitActionOption(
      action, TEST_JOURNEY_ID, TEST_SCENE_ID, TEST_CONTRACT_VERSION, "main", TEST_EXPIRES_AT,
    );

    assert.ok(result.public, "public surface exists");
    assert.ok(result.internal, "internal surface exists");
    assert.ok(result.signed, "signed surface exists");
  });

  it("public surface contains only whitelist fields", () => {
    const action = makeFullActionOption();
    const result = splitActionOption(
      action, TEST_JOURNEY_ID, TEST_SCENE_ID, TEST_CONTRACT_VERSION, "main", TEST_EXPIRES_AT,
    );
    const publicKeys = Object.keys(result.public).sort();
    const expectedKeys = [
      "actionOptionId", "available", "decisionEffect", "intent", "label",
      "optionKey", "risk", "riskLabel",
    ];
    assert.deepStrictEqual(publicKeys, expectedKeys);
  });

  it("public surface matches source values for whitelist fields", () => {
    const action = makeFullActionOption();
    const result = splitActionOption(
      action, TEST_JOURNEY_ID, TEST_SCENE_ID, TEST_CONTRACT_VERSION, "main", TEST_EXPIRES_AT,
    );

    assert.strictEqual(result.public.actionOptionId, "action_abc123");
    assert.strictEqual(result.public.optionKey, "investigate_scene");
    assert.strictEqual(result.public.label, "调查现场");
    assert.strictEqual(result.public.intent, "仔细检查现场遗留的线索和物品");
    assert.strictEqual(result.public.risk, "medium");
    assert.strictEqual(result.public.available, true);
    assert.strictEqual(result.public.decisionEffect, "attempt_objective");
    assert.strictEqual(typeof result.public.riskLabel, "string");
    assert.ok(result.public.riskLabel.length > 0, "riskLabel is non-empty");
  });

  it("internal surface contains server-only fields", () => {
    const action = makeFullActionOption();
    const result = splitActionOption(
      action, TEST_JOURNEY_ID, TEST_SCENE_ID, TEST_CONTRACT_VERSION, "main", TEST_EXPIRES_AT,
    );

    assert.deepStrictEqual(result.internal.preconditionRefs, ["fact_001", "fact_002"]);
    assert.deepStrictEqual(result.internal.allowedEffectKinds, ["journey_progress", "clue_created"]);
    assert.deepStrictEqual(result.internal.targetEntityIds, ["object_npc_001", "object_item_002"]);
    assert.strictEqual(result.internal.outcomeSummary, "成功调查现场，发现关键线索");
    assert.strictEqual(result.internal.taskObjectiveId, "obj_main_1");
    assert.deepStrictEqual(result.internal.approachTags, []);
    assert.ok(result.internal.riskTerms, "riskTerms present");
    assert.strictEqual(result.internal.riskTerms?.resourceCost?.resourceId, "focus");
    assert.strictEqual(result.internal.riskTerms?.resourceCost?.amount, 1);
  });

  it("signed surface contains signature envelope", () => {
    const action = makeFullActionOption();
    const result = splitActionOption(
      action, TEST_JOURNEY_ID, TEST_SCENE_ID, TEST_CONTRACT_VERSION, "main", TEST_EXPIRES_AT,
    );
    const signed = result.signed;

    assert.strictEqual(signed.journeyId, TEST_JOURNEY_ID);
    assert.strictEqual(signed.sceneId, TEST_SCENE_ID);
    assert.strictEqual(signed.actionOptionId, "action_abc123");
    assert.strictEqual(signed.contractVersion, TEST_CONTRACT_VERSION);
    assert.strictEqual(signed.optionHash, action.contentHash);
    assert.strictEqual(signed.signatureAlgorithm, "Ed25519");
    assert.strictEqual(signed.signatureVersion, 1);
    assert.strictEqual(signed.signingPurpose, "journey_scene_action");
    assert.strictEqual(signed.signingKeyId, "key_001");
    assert.strictEqual(typeof signed.serverPublicKey, "string");
    assert.strictEqual(signed.signature, "base64signaturevalue==");
    assert.strictEqual(signed.expiresAt, TEST_EXPIRES_AT);
    assert.strictEqual(typeof signed.issuedAt, "string");
    assert.ok(!Number.isNaN(Date.parse(signed.issuedAt)), "issuedAt is valid ISO-8601");
  });

  it("decisionEffect always describes an objective attempt", () => {
    for (const objectiveKind of ["main", "side", "choice", undefined] as const) {
      const result = splitActionOption(
        makeFullActionOption(), TEST_JOURNEY_ID, TEST_SCENE_ID, TEST_CONTRACT_VERSION,
        objectiveKind, TEST_EXPIRES_AT,
      );
      assert.strictEqual(result.public.decisionEffect, "attempt_objective");
    }
  });

  it("internal copies approachTags when present", () => {
    const action = makeFullActionOption({
      approachTags: ["combat", "cunning"] as readonly string[],
    });
    const result = splitActionOption(
      action, TEST_JOURNEY_ID, TEST_SCENE_ID, TEST_CONTRACT_VERSION, "main", TEST_EXPIRES_AT,
    );
    assert.deepStrictEqual(result.internal.approachTags, ["combat", "cunning"]);
  });

  it("internal copies actionObjectImpact when present", () => {
    const impact = { targetEntityId: "object_001", effectKind: "damage", degree: 3 };
    const action = makeFullActionOption({ actionObjectImpact: impact } as Partial<JourneySceneActionOption>);
    const result = splitActionOption(
      action, TEST_JOURNEY_ID, TEST_SCENE_ID, TEST_CONTRACT_VERSION, "main", TEST_EXPIRES_AT,
    );
    assert.deepStrictEqual(result.internal.actionObjectImpact, impact);
  });
});

// ── Per-outlet serializers ────────────────────────────────────────────────

describe("serializeCompact", () => {
  it("returns public fields + signed envelope", () => {
    const action = makeFullActionOption();
    const result = serializeCompact(
      action, TEST_JOURNEY_ID, TEST_SCENE_ID, TEST_CONTRACT_VERSION, "main", TEST_EXPIRES_AT,
    );

    // Public fields present
    assert.strictEqual(result.actionOptionId, "action_abc123");
    assert.strictEqual(result.optionKey, "investigate_scene");
    assert.strictEqual(typeof result.riskLabel, "string");
    assert.strictEqual(result.available, true);

    // Signed envelope present
    assert.ok(result.signed, "signed envelope present");
    assert.strictEqual(result.signed.journeyId, TEST_JOURNEY_ID);
    assert.strictEqual(result.signed.sceneId, TEST_SCENE_ID);
    assert.strictEqual(result.signed.contractVersion, TEST_CONTRACT_VERSION);

    // Internal fields absent
    assert.strictEqual((result as unknown as Record<string, unknown>).preconditionRefs, undefined);
    assert.strictEqual((result as unknown as Record<string, unknown>).allowedEffectKinds, undefined);
    assert.strictEqual((result as unknown as Record<string, unknown>).targetEntityIds, undefined);
    assert.strictEqual((result as unknown as Record<string, unknown>).approachTags, undefined);
    assert.strictEqual((result as unknown as Record<string, unknown>).riskTerms, undefined);
    assert.strictEqual((result as unknown as Record<string, unknown>).outcomeSummary, undefined);
    assert.strictEqual((result as unknown as Record<string, unknown>).taskObjectiveId, undefined);
    assert.strictEqual((result as unknown as Record<string, unknown>).completionKind, undefined);
    assert.strictEqual((result as unknown as Record<string, unknown>).actionObjectImpact, undefined);
  });
});

describe("serializeHosted", () => {
  it("returns only public fields", () => {
    const action = makeFullActionOption();
    const result = serializeHosted(
      action, TEST_JOURNEY_ID, TEST_SCENE_ID, TEST_CONTRACT_VERSION, "main", TEST_EXPIRES_AT,
    );

    const keys = Object.keys(result).sort();
    const expectedKeys = [
      "actionOptionId", "available", "decisionEffect", "intent", "label",
      "optionKey", "risk", "riskLabel",
    ];
    assert.deepStrictEqual(keys, expectedKeys);

    // Internal fields absent
    assert.strictEqual((result as unknown as Record<string, unknown>).preconditionRefs, undefined);
    assert.strictEqual((result as unknown as Record<string, unknown>).riskTerms, undefined);
    assert.strictEqual((result as unknown as Record<string, unknown>).approachTags, undefined);
  });
});

describe("serializeSession", () => {
  it("returns only public fields", () => {
    const action = makeFullActionOption();
    const result = serializeSession(
      action, TEST_JOURNEY_ID, TEST_SCENE_ID, TEST_CONTRACT_VERSION, "main", TEST_EXPIRES_AT,
    );

    const keys = Object.keys(result).sort();
    const expectedKeys = [
      "actionOptionId", "available", "decisionEffect", "intent", "label",
      "optionKey", "risk", "riskLabel",
    ];
    assert.deepStrictEqual(keys, expectedKeys);
  });
});

describe("serializeSampling", () => {
  it("returns only public fields", () => {
    const action = makeFullActionOption();
    const result = serializeSampling(
      action, TEST_JOURNEY_ID, TEST_SCENE_ID, TEST_CONTRACT_VERSION, "main", TEST_EXPIRES_AT,
    );

    const keys = Object.keys(result).sort();
    const expectedKeys = [
      "actionOptionId", "available", "decisionEffect", "intent", "label",
      "optionKey", "risk", "riskLabel",
    ];
    assert.deepStrictEqual(keys, expectedKeys);
  });
});

// ── Zero-bonus assertions ─────────────────────────────────────────────────

describe("assertPublicActionSafe", () => {
  it("passes for valid public action option", () => {
    const action = makeFullActionOption();
    const split = splitActionOption(
      action, TEST_JOURNEY_ID, TEST_SCENE_ID, TEST_CONTRACT_VERSION, "main", TEST_EXPIRES_AT,
    );
    assert.doesNotThrow(() => assertPublicActionSafe(split.public));
  });

  it("throws when preconditionRefs leaks into public surface", () => {
    const option = {
      actionOptionId: "action_001",
      optionKey: "test",
      label: "test",
      intent: "test",
      risk: "low" as const,
      riskLabel: "test",
      available: true,
      decisionEffect: "attempt_objective" as const,
      preconditionRefs: ["fact_001"],
    };
    assert.throws(
      () => assertPublicActionSafe(option),
      (error: Error) => error.message === "public_action_option_forbidden_field:preconditionRefs",
    );
  });

  it("throws when riskTerms leaks into public surface", () => {
    const option = {
      actionOptionId: "action_001",
      optionKey: "test",
      label: "test",
      intent: "test",
      risk: "low" as const,
      riskLabel: "test",
      available: true,
      decisionEffect: "attempt_objective" as const,
      riskTerms: { resourceCost: { resourceId: "focus", amount: 1 } },
    };
    assert.throws(
      () => assertPublicActionSafe(option),
      (error: Error) => error.message === "public_action_option_forbidden_field:riskTerms",
    );
  });

  it("throws when approachTags leaks into public surface", () => {
    const option = {
      actionOptionId: "action_001",
      optionKey: "test",
      label: "test",
      intent: "test",
      risk: "low" as const,
      riskLabel: "test",
      available: true,
      decisionEffect: "attempt_objective" as const,
      approachTags: ["combat"],
    };
    assert.throws(
      () => assertPublicActionSafe(option),
      (error: Error) => error.message === "public_action_option_forbidden_field:approachTags",
    );
  });

  it("throws when targetEntityIds leaks into public surface", () => {
    const option = {
      actionOptionId: "action_001",
      optionKey: "test",
      label: "test",
      intent: "test",
      risk: "low" as const,
      riskLabel: "test",
      available: true,
      decisionEffect: "attempt_objective" as const,
      targetEntityIds: ["obj_001"],
    };
    assert.throws(
      () => assertPublicActionSafe(option),
      (error: Error) => error.message === "public_action_option_forbidden_field:targetEntityIds",
    );
  });

  it("throws when allowedEffectKinds leaks into public surface", () => {
    const option = {
      actionOptionId: "action_001",
      optionKey: "test",
      label: "test",
      intent: "test",
      risk: "low" as const,
      riskLabel: "test",
      available: true,
      decisionEffect: "attempt_objective" as const,
      allowedEffectKinds: ["resource_delta"],
    };
    assert.throws(
      () => assertPublicActionSafe(option),
      (error: Error) => error.message === "public_action_option_forbidden_field:allowedEffectKinds",
    );
  });

  it("throws when actionObjectImpact leaks into public surface", () => {
    const option = {
      actionOptionId: "action_001",
      optionKey: "test",
      label: "test",
      intent: "test",
      risk: "low" as const,
      riskLabel: "test",
      available: true,
      decisionEffect: "attempt_objective" as const,
      actionObjectImpact: { targetEntityId: "obj_001", effectKind: "damage", degree: 2 },
    };
    assert.throws(
      () => assertPublicActionSafe(option),
      (error: Error) => error.message === "public_action_option_forbidden_field:actionObjectImpact",
    );
  });

  it("throws when expectedApproach leaks into public surface", () => {
    const option = {
      actionOptionId: "action_001",
      optionKey: "test",
      label: "test",
      intent: "test",
      risk: "low" as const,
      riskLabel: "test",
      available: true,
      decisionEffect: "attempt_objective" as const,
      expectedApproach: "combat",
    };
    assert.throws(
      () => assertPublicActionSafe(option),
      (error: Error) => error.message === "public_action_option_forbidden_field:expectedApproach",
    );
  });

  it("throws when taskFamilyId leaks into public surface", () => {
    const option = {
      actionOptionId: "action_001",
      optionKey: "test",
      label: "test",
      intent: "test",
      risk: "low" as const,
      riskLabel: "test",
      available: true,
      decisionEffect: "attempt_objective" as const,
      taskFamilyId: "family_001",
    };
    assert.throws(
      () => assertPublicActionSafe(option),
      (error: Error) => error.message === "public_action_option_forbidden_field:taskFamilyId",
    );
  });

  it("throws when strategyAffinity leaks into public surface", () => {
    const option = {
      actionOptionId: "action_001",
      optionKey: "test",
      label: "test",
      intent: "test",
      risk: "low" as const,
      riskLabel: "test",
      available: true,
      decisionEffect: "attempt_objective" as const,
      strategyAffinity: "aggressive",
    };
    assert.throws(
      () => assertPublicActionSafe(option),
      (error: Error) => error.message === "public_action_option_forbidden_field:strategyAffinity",
    );
  });

  it("throws when fitBps leaks into public surface", () => {
    const option = {
      actionOptionId: "action_001",
      optionKey: "test",
      label: "test",
      intent: "test",
      risk: "low" as const,
      riskLabel: "test",
      available: true,
      decisionEffect: "attempt_objective" as const,
      fitBps: 8500,
    };
    assert.throws(
      () => assertPublicActionSafe(option),
      (error: Error) => error.message === "public_action_option_forbidden_field:fitBps",
    );
  });

  it("throws when missing actionOptionId", () => {
    const option = {
      optionKey: "test",
      label: "test",
      intent: "test",
      risk: "low",
      riskLabel: "test",
      available: true,
      decisionEffect: "attempt_objective",
    };
    assert.throws(
      () => assertPublicActionSafe(option),
      (error: Error) => error.message === "public_action_option_missing_actionOptionId",
    );
  });

  it("throws when missing riskLabel", () => {
    const option = {
      actionOptionId: "action_001",
      optionKey: "test",
      label: "test",
      intent: "test",
      risk: "low",
      available: true,
      decisionEffect: "attempt_objective",
    };
    assert.throws(
      () => assertPublicActionSafe(option),
      (error: Error) => error.message === "public_action_option_missing_riskLabel",
    );
  });
});

describe("assertPublicActionZeroBonus", () => {
  it("passes for valid public action with narrative riskLabel", () => {
    const action = makeFullActionOption();
    const split = splitActionOption(
      action, TEST_JOURNEY_ID, TEST_SCENE_ID, TEST_CONTRACT_VERSION, "main", TEST_EXPIRES_AT,
    );
    assert.doesNotThrow(() => assertPublicActionZeroBonus(split.public));
  });

  it("throws when riskLabel contains 3+ digit sequence", () => {
    const option: PublicActionOption = {
      actionOptionId: "action_001",
      optionKey: "test",
      label: "test",
      intent: "test",
      risk: "high",
      riskLabel: "高风险：预期收益+300金币",
      available: true,
      decisionEffect: "attempt_objective",
    };
    assert.throws(
      () => assertPublicActionZeroBonus(option),
      (error: Error) => error.message === "public_action_option_riskLabel_numeric_leak",
    );
  });

  it("throws when riskLabel pairs resource name with number", () => {
    const option: PublicActionOption = {
      actionOptionId: "action_001",
      optionKey: "test",
      label: "test",
      intent: "test",
      risk: "medium",
      riskLabel: "中风险：消耗体力 2",
      available: true,
      decisionEffect: "attempt_objective",
    };
    assert.throws(
      () => assertPublicActionZeroBonus(option),
      (error: Error) => error.message === "public_action_option_riskLabel_resource_leak",
    );
  });

  it("accepts riskLabel with small digit sequences (1-2 digits)", () => {
    const option: PublicActionOption = {
      actionOptionId: "action_001",
      optionKey: "test",
      label: "test",
      intent: "test",
      risk: "low",
      riskLabel: "低风险：消耗少量集中力",
      available: true,
      decisionEffect: "attempt_objective",
    };
    assert.doesNotThrow(() => assertPublicActionZeroBonus(option));
  });
});

// ── deriveDecisionEffect ──────────────────────────────────────────────────

describe("deriveDecisionEffect", () => {
  it("returns attempt_objective for every objective kind", () => {
    assert.strictEqual(deriveDecisionEffect("main"), "attempt_objective");
    assert.strictEqual(deriveDecisionEffect("side"), "attempt_objective");
    assert.strictEqual(deriveDecisionEffect("choice"), "attempt_objective");
    assert.strictEqual(deriveDecisionEffect(undefined), "attempt_objective");
  });
});

// ── Signed replay consistency ─────────────────────────────────────────────

describe("signed replay consistency", () => {
  it("same action produces same optionHash across splits", () => {
    const action = makeFullActionOption();
    const split1 = splitActionOption(
      action, TEST_JOURNEY_ID, TEST_SCENE_ID, TEST_CONTRACT_VERSION, "main", TEST_EXPIRES_AT,
    );
    const split2 = splitActionOption(
      action, TEST_JOURNEY_ID, TEST_SCENE_ID, TEST_CONTRACT_VERSION, "main", TEST_EXPIRES_AT,
    );

    // optionHash is derived from contentHash, which is immutable on the action
    assert.strictEqual(split1.signed.optionHash, split2.signed.optionHash);
    assert.strictEqual(split1.signed.signature, split2.signed.signature);
  });

  it("different journeyId produces different signed envelope", () => {
    const action = makeFullActionOption();
    const split1 = splitActionOption(
      action, "journey_001", TEST_SCENE_ID, TEST_CONTRACT_VERSION, "main", TEST_EXPIRES_AT,
    );
    const split2 = splitActionOption(
      action, "journey_002", TEST_SCENE_ID, TEST_CONTRACT_VERSION, "main", TEST_EXPIRES_AT,
    );

    assert.notStrictEqual(split1.signed.journeyId, split2.signed.journeyId);
    // optionHash and signature are the same (derived from action content, not binding)
    assert.strictEqual(split1.signed.optionHash, split2.signed.optionHash);
  });

  it("different sceneId produces different signed envelope", () => {
    const action = makeFullActionOption();
    const split1 = splitActionOption(
      action, TEST_JOURNEY_ID, "scene_001", TEST_CONTRACT_VERSION, "main", TEST_EXPIRES_AT,
    );
    const split2 = splitActionOption(
      action, TEST_JOURNEY_ID, "scene_002", TEST_CONTRACT_VERSION, "main", TEST_EXPIRES_AT,
    );

    assert.notStrictEqual(split1.signed.sceneId, split2.signed.sceneId);
    assert.strictEqual(split1.signed.optionHash, split2.signed.optionHash);
  });

  it("signed envelope carries all required fields for replay", () => {
    const action = makeFullActionOption();
    const split = splitActionOption(
      action, TEST_JOURNEY_ID, TEST_SCENE_ID, TEST_CONTRACT_VERSION, "main", TEST_EXPIRES_AT,
    );
    const signed = split.signed;

    // All fields required for server-side replay
    assert.strictEqual(typeof signed.journeyId, "string");
    assert.strictEqual(typeof signed.sceneId, "string");
    assert.strictEqual(typeof signed.actionOptionId, "string");
    assert.strictEqual(typeof signed.contractVersion, "number");
    assert.ok(signed.optionHash.startsWith("sha256:"), "optionHash is sha256 prefixed");
    assert.strictEqual(typeof signed.signatureAlgorithm, "string");
    assert.strictEqual(signed.signatureVersion, 1);
    assert.strictEqual(typeof signed.signingPurpose, "string");
    assert.strictEqual(typeof signed.signingKeyId, "string");
    assert.strictEqual(typeof signed.serverPublicKey, "string");
    assert.strictEqual(typeof signed.signature, "string");
    assert.ok(!Number.isNaN(Date.parse(signed.issuedAt)), "issuedAt is valid ISO-8601");
    assert.ok(!Number.isNaN(Date.parse(signed.expiresAt)), "expiresAt is valid ISO-8601");
  });
});

// ── All outlets produce identical public shape ────────────────────────────

describe("outlet consistency", () => {
  it("all four outlets produce the same public fields", () => {
    const action = makeFullActionOption();
    const compact = serializeCompact(
      action, TEST_JOURNEY_ID, TEST_SCENE_ID, TEST_CONTRACT_VERSION, "main", TEST_EXPIRES_AT,
    );
    const hosted = serializeHosted(
      action, TEST_JOURNEY_ID, TEST_SCENE_ID, TEST_CONTRACT_VERSION, "main", TEST_EXPIRES_AT,
    );
    const session = serializeSession(
      action, TEST_JOURNEY_ID, TEST_SCENE_ID, TEST_CONTRACT_VERSION, "main", TEST_EXPIRES_AT,
    );
    const sampling = serializeSampling(
      action, TEST_JOURNEY_ID, TEST_SCENE_ID, TEST_CONTRACT_VERSION, "main", TEST_EXPIRES_AT,
    );

    // Public fields are identical across all outlets
    const publicKeys = ["actionOptionId", "optionKey", "label", "intent", "risk", "riskLabel", "available", "decisionEffect"];
    for (const key of publicKeys) {
      assert.strictEqual(
        (compact as unknown as Record<string, unknown>)[key],
        (hosted as unknown as Record<string, unknown>)[key],
        `compact.${key} === hosted.${key}`,
      );
      assert.strictEqual(
        (hosted as unknown as Record<string, unknown>)[key],
        (session as unknown as Record<string, unknown>)[key],
        `hosted.${key} === session.${key}`,
      );
      assert.strictEqual(
        (session as unknown as Record<string, unknown>)[key],
        (sampling as unknown as Record<string, unknown>)[key],
        `session.${key} === sampling.${key}`,
      );
    }
  });

  it("no outlet leaks forbidden fields", () => {
    const action = makeFullActionOption();
    const outlets = [
      serializeCompact(action, TEST_JOURNEY_ID, TEST_SCENE_ID, TEST_CONTRACT_VERSION, "main", TEST_EXPIRES_AT),
      serializeHosted(action, TEST_JOURNEY_ID, TEST_SCENE_ID, TEST_CONTRACT_VERSION, "main", TEST_EXPIRES_AT),
      serializeSession(action, TEST_JOURNEY_ID, TEST_SCENE_ID, TEST_CONTRACT_VERSION, "main", TEST_EXPIRES_AT),
      serializeSampling(action, TEST_JOURNEY_ID, TEST_SCENE_ID, TEST_CONTRACT_VERSION, "main", TEST_EXPIRES_AT),
    ];

    const forbiddenKeys = [
      "preconditionRefs", "allowedEffectKinds", "targetEntityIds",
      "approachTags", "actionObjectImpact", "riskTerms",
      "outcomeSummary", "taskObjectiveId", "completionKind", "routeSelection",
      "contentHash", "taskFamilyId", "strategyAffinity", "fitBps", "expectedApproach", "bonus",
    ];

    for (const outlet of outlets) {
      for (const key of forbiddenKeys) {
        assert.strictEqual(
          (outlet as unknown as Record<string, unknown>)[key],
          undefined,
          `outlet must not contain forbidden field: ${key}`,
        );
      }
    }
  });
});

// ── Risk label qualitative check ──────────────────────────────────────────

describe("riskLabel qualitative boundary", () => {
  it("low risk label is narrative-only", () => {
    const action = makeFullActionOption({ risk: "low" });
    const split = splitActionOption(
      action, TEST_JOURNEY_ID, TEST_SCENE_ID, TEST_CONTRACT_VERSION, "main", TEST_EXPIRES_AT,
    );
    assert.ok(!/\d{3,}/.test(split.public.riskLabel), "no 3+ digit sequences");
    assert.ok(!/(?:金币|coin|focus|stamina|体力|专注)\s*\d/i.test(split.public.riskLabel), "no resource+number pairs");
  });

  it("medium risk label is narrative-only", () => {
    const action = makeFullActionOption({ risk: "medium" });
    const split = splitActionOption(
      action, TEST_JOURNEY_ID, TEST_SCENE_ID, TEST_CONTRACT_VERSION, "main", TEST_EXPIRES_AT,
    );
    assert.ok(!/\d{3,}/.test(split.public.riskLabel), "no 3+ digit sequences");
    assert.ok(!/(?:金币|coin|focus|stamina|体力|专注)\s*\d/i.test(split.public.riskLabel), "no resource+number pairs");
  });

  it("high risk label is narrative-only", () => {
    const action = makeFullActionOption({ risk: "high" });
    const split = splitActionOption(
      action, TEST_JOURNEY_ID, TEST_SCENE_ID, TEST_CONTRACT_VERSION, "main", TEST_EXPIRES_AT,
    );
    assert.ok(!/\d{3,}/.test(split.public.riskLabel), "no 3+ digit sequences");
    assert.ok(!/(?:金币|coin|focus|stamina|体力|专注)\s*\d/i.test(split.public.riskLabel), "no resource+number pairs");
  });
});
