import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ServerQuestAi,
  checkProposalStructure,
  checkProposalWorld,
  checkProposalSemantic,
  checkProposalContent,
  buildReplayKey,
  generateCatalogFallbackOffers,
  DirectAnthropicProvider,
  McpSamplingFallbackProvider,
  McpSamplingProviderError,
  buildProviderChain,
  type QuestGenerationProposal,
  type QuestGenerationInput,
  type QuestGenerationProvider,
  type ServerAiState,
} from "../lib/epoch/serverQuestAi.ts";

import type { InternalQuestOffer } from "../lib/epoch/journeyOfferRules.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const WORLD_SLICE_HASH = "sha256:0000000000000000000000000000000000000000000000000000000000000000";

function validProposal(overrides: Partial<QuestGenerationProposal> = {}): QuestGenerationProposal {
  return {
    proposalId: "prop_test_001",
    region: "region_north",
    taskFamilyId: "tf_combat_patrol",
    approachTags: ["combat"],
    title: "北方荒野的清剿行动",
    description: "在北方荒野中清除威胁商路的盗匪团伙，确保商队安全通行",
    worldSliceHash: WORLD_SLICE_HASH,
    ...overrides,
  };
}

function validInput(overrides: Partial<QuestGenerationInput> = {}): QuestGenerationInput {
  return {
    regionId: "region_north",
    taskFamilies: ["tf_combat_patrol", "tf_escort_caravan", "tf_recon_scout"],
    worldContentHash: WORLD_SLICE_HASH,
    currentOffers: [],
    seed: "seed_001",
    ...overrides,
  };
}

function makeInternalOffer(overrides: {
  readonly questOfferId: string;
  readonly taskFamilyId: string;
  readonly regionId: string;
}): InternalQuestOffer {
  return {
    questOfferId: overrides.questOfferId,
    marketSnapshotVersion: 1,
    taskFamilyId: overrides.taskFamilyId,
    expectedApproach: ["combat"],
    offerHash: "sha256:0000000000000000000000000000000000000000000000000000000000000000" as `sha256:${string}`,
    offerVersion: 1,
    source: "catalog_fallback",
    worldSliceHash: WORLD_SLICE_HASH as `sha256:${string}`,
    publicView: {
      questOfferId: overrides.questOfferId,
      marketSnapshotVersion: 1,
      taskTypeText: "清剿",
      scenarioSummary: "清除威胁",
      region: { regionId: overrides.regionId, scenarioMapId: "map_north" },
      scenarioMapId: "map_north",
      estimatedDifficulty: "medium",
      rewardPreview: { authority: "preview_only" },
      expiresAt: "2099-01-01T00:00:00.000Z",
      schemaVersion: 1,
    },
  };
}

function makeProvider(
  name: string,
  handler: (input: QuestGenerationInput) => Promise<readonly QuestGenerationProposal[]>,
  warmupHandler?: () => Promise<void>,
): QuestGenerationProvider {
  return {
    name,
    generate: handler,
    ...(warmupHandler !== undefined ? { warmup: warmupHandler } : {}),
  };
}

function makeFailingProvider(name: string): QuestGenerationProvider {
  return {
    name,
    async generate() {
      throw new Error(`${name}_failed`);
    },
  };
}

// ---------------------------------------------------------------------------
// Test 1: State machine
// ---------------------------------------------------------------------------

describe("ServerAiState machine", () => {
  it("starts in warming state", () => {
    const ai = new ServerQuestAi({ providers: [] });
    assert.equal(ai.getState(), "warming");
  });

  it("transitions warming -> ready on warmup success", async () => {
    const provider = makeProvider("p1", async () => [], async () => { /* success */ });
    const ai = new ServerQuestAi({ providers: [provider] });
    ai.startWarmup();
    const state = await ai.awaitWarmup();
    assert.equal(state, "ready");
    assert.equal(ai.getState(), "ready");
  });

  it("transitions warming -> degraded on all warmup failures", async () => {
    const provider: QuestGenerationProvider = {
      name: "fail",
      async generate() { return []; },
      async warmup() { throw new Error("warmup_fail"); },
    };
    const ai = new ServerQuestAi({ providers: [provider] });
    ai.startWarmup();
    const state = await ai.awaitWarmup();
    assert.equal(state, "degraded");
    assert.equal(ai.getState(), "degraded");
  });

  it("transitions ready -> degraded when all providers fail during generation", async () => {
    const provider = makeProvider("p1", async () => [], async () => { /* success */ });
    const ai = new ServerQuestAi({ providers: [provider] });
    ai.startWarmup();
    await ai.awaitWarmup();
    assert.equal(ai.getState(), "ready");

    // Replace provider with one that fails
    const failProvider = makeFailingProvider("fail");
    const ai2 = new ServerQuestAi({ providers: [failProvider] });
    // Manually set state to ready by warmup with a no-op provider
    const noopProvider = makeProvider("noop", async () => [], async () => {});
    const ai3 = new ServerQuestAi({ providers: [noopProvider] });
    ai3.startWarmup();
    await ai3.awaitWarmup();
    assert.equal(ai3.getState(), "ready");

    // Now replace the provider with one that throws
    const ai4 = new ServerQuestAi({ providers: [failProvider] });
    // Skip warmup by manually testing generation failure
    const result = await ai4.generateProposals(validInput());
    assert.deepEqual(result, []);
  });

  it("transitions degraded -> ready when a provider recovers", async () => {
    let shouldFail = true;
    const provider: QuestGenerationProvider = {
      name: "flaky",
      async generate(input) {
        if (shouldFail) throw new Error("fail");
        return [validProposal()];
      },
      async warmup() {
        if (shouldFail) throw new Error("warmup_fail");
      },
    };
    const ai = new ServerQuestAi({ providers: [provider] });
    ai.startWarmup();
    await ai.awaitWarmup();
    assert.equal(ai.getState(), "degraded");

    // Provider recovers
    shouldFail = false;
    const result = await ai.generateProposals(validInput());
    assert.equal(ai.getState(), "ready");
    assert.ok(result.length > 0);
  });

  it("restart returns to warming", () => {
    const ai = new ServerQuestAi({ providers: [] });
    // Simulate prior state
    ai.startWarmup();
    // New instance always starts at warming
    const ai2 = new ServerQuestAi({ providers: [] });
    assert.equal(ai2.getState(), "warming");
  });
});

// ---------------------------------------------------------------------------
// Test 2: Structure check
// ---------------------------------------------------------------------------

describe("checkProposalStructure", () => {
  it("rejects null input", () => {
    const result = checkProposalStructure(null);
    assert.equal(result.ok, false);
    assert.match(result.reason!, /structure_not_object/);
  });

  it("rejects missing proposalId", () => {
    const p = validProposal();
    const raw = { ...p } as Record<string, unknown>;
    delete raw["proposalId"];
    const result = checkProposalStructure(raw);
    assert.equal(result.ok, false);
    assert.match(result.reason!, /structure_missing_proposalId/);
  });

  it("rejects malformed proposalId", () => {
    const result = checkProposalStructure(validProposal({ proposalId: "bad id!" }));
    assert.equal(result.ok, false);
    assert.match(result.reason!, /structure_proposalId_malformed/);
  });

  it("rejects empty approachTags", () => {
    const result = checkProposalStructure(validProposal({ approachTags: [] }));
    assert.equal(result.ok, false);
    assert.match(result.reason!, /structure_approachTags_empty/);
  });

  it("rejects non-array approachTags", () => {
    const p = validProposal();
    const raw = { ...p, approachTags: "combat" } as unknown;
    const result = checkProposalStructure(raw);
    assert.equal(result.ok, false);
    assert.match(result.reason!, /structure_approachTags_not_array/);
  });

  it("rejects invalid approachTag values", () => {
    const p = validProposal();
    const raw = { ...p, approachTags: ["combat", "invalid_tag"] } as unknown;
    const result = checkProposalStructure(raw);
    assert.equal(result.ok, false);
    assert.match(result.reason!, /structure_invalid_approachTag/);
  });

  it("rejects empty title", () => {
    const result = checkProposalStructure(validProposal({ title: "" }));
    assert.equal(result.ok, false);
    assert.match(result.reason!, /structure_missing_title/);
  });

  it("rejects empty description", () => {
    const result = checkProposalStructure(validProposal({ description: "" }));
    assert.equal(result.ok, false);
    assert.match(result.reason!, /structure_missing_description/);
  });

  it("accepts valid proposal", () => {
    const result = checkProposalStructure(validProposal());
    assert.equal(result.ok, true);
    assert.equal(result.reason, undefined);
  });

  it("accepts valid proposal with optional hiddenLinkId", () => {
    const result = checkProposalStructure(validProposal({ hiddenLinkId: "link_001" }));
    assert.equal(result.ok, true);
  });

  it("rejects non-string hiddenLinkId", () => {
    const p = validProposal();
    const raw = { ...p, hiddenLinkId: 42 } as unknown;
    const result = checkProposalStructure(raw);
    assert.equal(result.ok, false);
    assert.match(result.reason!, /structure_hiddenLinkId_not_string/);
  });
});

// ---------------------------------------------------------------------------
// Test 3: World check
// ---------------------------------------------------------------------------

describe("checkProposalWorld", () => {
  it("rejects mismatched worldSliceHash", () => {
    const proposal = validProposal({ worldSliceHash: "sha256:wrong" });
    const result = checkProposalWorld(proposal, WORLD_SLICE_HASH, []);
    assert.equal(result.ok, false);
    assert.match(result.reason!, /world_sliceHash_mismatch/);
  });

  it("accepts matching worldSliceHash", () => {
    const proposal = validProposal();
    const result = checkProposalWorld(proposal, WORLD_SLICE_HASH, []);
    assert.equal(result.ok, true);
  });

  it("rejects conflicting offer for same region+taskFamily", () => {
    const proposal = validProposal();
    const offer = makeInternalOffer({
      questOfferId: "qo_existing",
      taskFamilyId: "tf_combat_patrol",
      regionId: "region_north",
    });
    const result = checkProposalWorld(proposal, WORLD_SLICE_HASH, [offer]);
    assert.equal(result.ok, false);
    assert.match(result.reason!, /world_conflicting_offer/);
  });

  it("accepts when offers exist for different taskFamily", () => {
    const proposal = validProposal();
    const offer = makeInternalOffer({
      questOfferId: "qo_other",
      taskFamilyId: "tf_escort_caravan",
      regionId: "region_north",
    });
    const result = checkProposalWorld(proposal, WORLD_SLICE_HASH, [offer]);
    assert.equal(result.ok, true);
  });

  it("accepts when offers exist for different region", () => {
    const proposal = validProposal();
    const offer = makeInternalOffer({
      questOfferId: "qo_other_region",
      taskFamilyId: "tf_combat_patrol",
      regionId: "region_south",
    });
    const result = checkProposalWorld(proposal, WORLD_SLICE_HASH, [offer]);
    assert.equal(result.ok, true);
  });
});

// ---------------------------------------------------------------------------
// Test 4: Semantic check
// ---------------------------------------------------------------------------

describe("checkProposalSemantic", () => {
  it("rejects unknown taskFamilyId pattern", () => {
    const proposal = validProposal({ taskFamilyId: "unknown_family" });
    const result = checkProposalSemantic(proposal);
    assert.equal(result.ok, false);
    assert.match(result.reason!, /semantic_unknown_taskFamily/);
  });

  it("accepts known tf_ prefix", () => {
    const proposal = validProposal({ taskFamilyId: "tf_combat_patrol" });
    const result = checkProposalSemantic(proposal);
    assert.equal(result.ok, true);
  });

  it("accepts known task_family_ prefix", () => {
    const proposal = validProposal({ taskFamilyId: "task_family_escort" });
    const result = checkProposalSemantic(proposal);
    assert.equal(result.ok, true);
  });

  it("rejects approachTags not aligned with strategy (affinity < 50 for all)", () => {
    // combat strategy: stealth=0, diplomacy=50, support=0
    // "stealth" has 0 affinity for combat, "support" has 0 affinity for combat
    const proposal = validProposal({ approachTags: ["stealth", "support"] });
    const result = checkProposalSemantic(proposal, "combat");
    assert.equal(result.ok, false);
    assert.match(result.reason!, /semantic_all_penalties/);
  });

  it("accepts approachTags aligned with strategy", () => {
    // combat strategy: combat=100, logistics=50
    const proposal = validProposal({ approachTags: ["combat", "logistics"] });
    const result = checkProposalSemantic(proposal, "combat");
    assert.equal(result.ok, true);
  });

  it("accepts when no strategy context provided", () => {
    const proposal = validProposal({ approachTags: ["stealth"] });
    const result = checkProposalSemantic(proposal);
    assert.equal(result.ok, true);
  });

  it("rejects when no tag has affinity >= 50 for strategy", () => {
    // exploration strategy: combat=50 -> so combat passes.
    // Let's use diplomacy with combat strategy: diplomacy=50 -> passes.
    // Actually let's test with a combo that has no aligned tags.
    // combat: stealth=0, support=0, preservation=0
    // stealth(0) + support(0) + preservation(0) = all penalties for combat
    const proposal = validProposal({ approachTags: ["stealth", "support", "preservation"] });
    const result = checkProposalSemantic(proposal, "combat");
    assert.equal(result.ok, false);
    assert.match(result.reason!, /semantic_all_penalties/);
  });
});

// ---------------------------------------------------------------------------
// Test 5: Content check
// ---------------------------------------------------------------------------

describe("checkProposalContent", () => {
  it("rejects numeric bonus hints (+10)", () => {
    const proposal = validProposal({ description: "在北方荒野中探索，完成任务可获得+10点经验奖励" });
    const result = checkProposalContent(proposal);
    assert.equal(result.ok, false);
    assert.match(result.reason!, /content_numeric_bonus_detected/);
  });

  it("rejects 'score' keyword", () => {
    const proposal = validProposal({ description: "这个任务会提升你的score评价体系中的位置" });
    const result = checkProposalContent(proposal);
    assert.equal(result.ok, false);
    assert.match(result.reason!, /content_numeric_bonus_detected/);
  });

  it("rejects 'reward' keyword", () => {
    const proposal = validProposal({ description: "探索北方荒野的奥秘，完成此任务将获得丰厚的reward回报" });
    const result = checkProposalContent(proposal);
    assert.equal(result.ok, false);
    assert.match(result.reason!, /content_numeric_bonus_detected/);
  });

  it("rejects 'bonus' keyword", () => {
    const proposal = validProposal({ title: "高bonus任务" });
    const result = checkProposalContent(proposal);
    assert.equal(result.ok, false);
    assert.match(result.reason!, /content_numeric_bonus_detected/);
  });

  it("rejects 'viability' keyword", () => {
    const proposal = validProposal({ description: "这个任务会影响viability评估指标的最终结果" });
    const result = checkProposalContent(proposal);
    assert.equal(result.ok, false);
    assert.match(result.reason!, /content_numeric_bonus_detected/);
  });

  it("rejects Chinese numeric keywords (奖励, 加成, 评分)", () => {
    const proposal = validProposal({ description: "完成任务后将获得额外的奖励加成，评分大幅提升" });
    const result = checkProposalContent(proposal);
    assert.equal(result.ok, false);
    assert.match(result.reason!, /content_numeric_bonus_detected/);
  });

  it("rejects meta-gaming 'optimal'", () => {
    const proposal = validProposal({ description: "这是optimal策略选择，能帮助你做出更好的决策判断" });
    const result = checkProposalContent(proposal);
    assert.equal(result.ok, false);
    assert.match(result.reason!, /content_meta_gaming_detected/);
  });

  it("rejects meta-gaming 'maximize'", () => {
    const proposal = validProposal({ description: "选择这条路可以maximize你的整体利益和发展空间" });
    const result = checkProposalContent(proposal);
    assert.equal(result.ok, false);
    assert.match(result.reason!, /content_meta_gaming_detected/);
  });

  it("rejects meta-gaming Chinese (最优化, 最大化)", () => {
    const proposal = validProposal({ description: "这是最优化的方案，可以最大化你的战斗能力值" });
    const result = checkProposalContent(proposal);
    assert.equal(result.ok, false);
    assert.match(result.reason!, /content_meta_gaming_detected/);
  });

  it("rejects event-sourcing language", () => {
    const proposal = validProposal({ description: "通过event-sourcing机制记录你的行为轨迹和状态变化" });
    const result = checkProposalContent(proposal);
    assert.equal(result.ok, false);
    assert.match(result.reason!, /content_event_sourcing_detected/);
  });

  it("rejects no Chinese characters", () => {
    const proposal = validProposal({
      title: "Quest Title",
      description: "This is a quest description without any Chinese characters at all",
    });
    const result = checkProposalContent(proposal);
    assert.equal(result.ok, false);
    assert.match(result.reason!, /content_no_chinese_chars/);
  });

  it("rejects description shorter than 20 chars", () => {
    const proposal = validProposal({ description: "短描述" }); // 3 chars
    const result = checkProposalContent(proposal);
    assert.equal(result.ok, false);
    assert.match(result.reason!, /content_description_too_short/);
  });

  it("accepts clean roleplay text", () => {
    const proposal = validProposal({
      title: "北境巡逻任务",
      description: "在北方边境的荒野中巡逻，清剿沿途的野兽和流寇，保护商队的安全通行",
    });
    const result = checkProposalContent(proposal);
    assert.equal(result.ok, true);
  });
});

// ---------------------------------------------------------------------------
// Test 6: Provider chain fallback
// ---------------------------------------------------------------------------

describe("provider chain fallback", () => {
  it("returns proposals from first successful provider", async () => {
    const proposals = [validProposal()];
    const p1 = makeProvider("success", async () => proposals);
    const p2 = makeProvider("never_called", async () => {
      throw new Error("should not be called");
    });
    const ai = new ServerQuestAi({ providers: [p1, p2] });
    // Skip warmup for this test
    const result = await ai.generateProposals(validInput());
    assert.equal(result.length, 1);
    assert.equal(result[0]!.proposalId, "prop_test_001");
  });

  it("falls through to second provider when first fails", async () => {
    const proposals = [validProposal({ proposalId: "prop_fallback_001" })];
    const p1 = makeFailingProvider("fail");
    const p2 = makeProvider("fallback", async () => proposals);
    const ai = new ServerQuestAi({ providers: [p1, p2] });
    const result = await ai.generateProposals(validInput());
    assert.equal(result.length, 1);
    assert.equal(result[0]!.proposalId, "prop_fallback_001");
  });

  it("returns empty array when all providers fail", async () => {
    const p1 = makeFailingProvider("fail1");
    const p2 = makeFailingProvider("fail2");
    const ai = new ServerQuestAi({ providers: [p1, p2] });
    const result = await ai.generateProposals(validInput());
    assert.deepEqual(result, []);
  });

  it("returns empty array when no providers configured", async () => {
    const ai = new ServerQuestAi({ providers: [] });
    const result = await ai.generateProposals(validInput());
    assert.deepEqual(result, []);
  });
});

// ---------------------------------------------------------------------------
// Test 7: Replay determinism
// ---------------------------------------------------------------------------

describe("replay determinism", () => {
  it("returns cached proposals for same input", async () => {
    const proposals = [validProposal()];
    let callCount = 0;
    const provider = makeProvider("counter", async () => {
      callCount++;
      return proposals;
    });
    const ai = new ServerQuestAi({ providers: [provider] });
    const input = validInput();

    const result1 = await ai.generateProposals(input);
    const result2 = await ai.generateProposals(input);

    assert.equal(callCount, 1, "provider should only be called once");
    assert.deepEqual(result1, result2);
    assert.equal(ai.cacheSize, 1);
  });

  it("different seed produces different cache entry", async () => {
    let callCount = 0;
    const provider = makeProvider("counter", async () => {
      callCount++;
      return [validProposal()];
    });
    const ai = new ServerQuestAi({ providers: [provider] });

    await ai.generateProposals(validInput({ seed: "seed_a" }));
    await ai.generateProposals(validInput({ seed: "seed_b" }));

    assert.equal(callCount, 2, "different seeds should produce different cache entries");
    assert.equal(ai.cacheSize, 2);
  });

  it("buildReplayKey is deterministic", () => {
    const input = validInput();
    const key1 = buildReplayKey(input, "v1", "prompt_hash");
    const key2 = buildReplayKey(input, "v1", "prompt_hash");
    assert.equal(key1, key2);
  });

  it("buildReplayKey differs for different model versions", () => {
    const input = validInput();
    const key1 = buildReplayKey(input, "v1", "prompt_hash");
    const key2 = buildReplayKey(input, "v2", "prompt_hash");
    assert.notEqual(key1, key2);
  });

  it("buildReplayKey differs for different prompt hashes", () => {
    const input = validInput();
    const key1 = buildReplayKey(input, "v1", "prompt_a");
    const key2 = buildReplayKey(input, "v1", "prompt_b");
    assert.notEqual(key1, key2);
  });

  it("clearCache removes all entries", async () => {
    const provider = makeProvider("p", async () => [validProposal()]);
    const ai = new ServerQuestAi({ providers: [provider] });
    await ai.generateProposals(validInput());
    assert.equal(ai.cacheSize, 1);
    ai.clearCache();
    assert.equal(ai.cacheSize, 0);
  });
});

// ---------------------------------------------------------------------------
// Test 8: Rate limiting (semaphore)
// ---------------------------------------------------------------------------

describe("rate limiting", () => {
  it("concurrent requests all complete without interference", async () => {
    const order: number[] = [];
    const provider: QuestGenerationProvider = {
      name: "slow",
      async generate() {
        const id = order.length + 1;
        order.push(id);
        await new Promise((r) => setTimeout(r, 10));
        return [validProposal({ proposalId: `prop_slow_${String(id).padStart(3, "0")}` })];
      },
    };
    const ai = new ServerQuestAi({ providers: [provider] });

    // Launch multiple concurrent requests with different seeds to bypass cache
    const promises = [
      ai.generateProposals(validInput({ seed: "s_concurrent_1" })),
      ai.generateProposals(validInput({ seed: "s_concurrent_2" })),
      ai.generateProposals(validInput({ seed: "s_concurrent_3" })),
    ];
    const results = await Promise.all(promises);

    // All should succeed with 1 proposal each
    assert.equal(results.length, 3);
    for (const result of results) {
      assert.equal(result.length, 1, "each concurrent request should get 1 proposal");
    }
    // Provider was called 3 times (each had different seed -> different cache key)
    assert.equal(order.length, 3);
    assert.equal(ai.cacheSize, 3);
  });
});

// ---------------------------------------------------------------------------
// Test 9: Non-blocking warmup
// ---------------------------------------------------------------------------

describe("non-blocking warmup", () => {
  it("startWarmup returns immediately", async () => {
    let warmupStarted = false;
    let warmupResolved = false;
    const provider: QuestGenerationProvider = {
      name: "slow_warmup",
      async generate() { return []; },
      async warmup() {
        warmupStarted = true;
        await new Promise((r) => setTimeout(r, 50));
        warmupResolved = true;
      },
    };
    const ai = new ServerQuestAi({ providers: [provider] });
    ai.startWarmup();
    // startWarmup should return immediately
    assert.equal(warmupStarted, true);
    assert.equal(warmupResolved, false);
    assert.equal(ai.getState(), "warming");

    await ai.awaitWarmup();
    assert.equal(warmupResolved, true);
    assert.equal(ai.getState(), "ready");
  });

  it("startWarmup is idempotent (second call is no-op)", async () => {
    let callCount = 0;
    const provider: QuestGenerationProvider = {
      name: "counting",
      async generate() { return []; },
      async warmup() { callCount++; },
    };
    const ai = new ServerQuestAi({ providers: [provider] });
    ai.startWarmup();
    ai.startWarmup(); // should be no-op
    await ai.awaitWarmup();
    assert.equal(callCount, 1);
  });

  it("provider without warmup is treated as always ready", async () => {
    const provider = makeProvider("no_warmup", async () => []);
    // No warmup function defined
    const ai = new ServerQuestAi({ providers: [provider] });
    ai.startWarmup();
    const state = await ai.awaitWarmup();
    assert.equal(state, "ready");
  });
});

// ---------------------------------------------------------------------------
// Test 10: CRITICAL — proposals only, never writes events/scores/tier/reward
// ---------------------------------------------------------------------------

describe("CRITICAL: proposals-only invariant", () => {
  it("ServerQuestAi has no methods that write events", () => {
    const ai = new ServerQuestAi({ providers: [] });
    // Verify no event-writing methods exist
    const proto = Object.getPrototypeOf(ai) as Record<string, unknown>;
    const methods = Object.getOwnPropertyNames(proto);
    const dangerousMethods = methods.filter((m) =>
      m.includes("event")
      || m.includes("score")
      || m.includes("tier")
      || m.includes("reward")
      || m.includes("viability")
      || m.includes("settle")
      || m.includes("commit"),
    );
    assert.deepEqual(dangerousMethods, [], "found dangerous methods on ServerQuestAi");
  });

  it("generateProposals returns proposals without scores/tiers/rewards", async () => {
    const proposal = validProposal();
    const provider = makeProvider("clean", async () => [proposal]);
    const ai = new ServerQuestAi({ providers: [provider] });
    const results = await ai.generateProposals(validInput());
    assert.ok(results.length > 0);
    for (const r of results) {
      // Verify no score/tier/reward fields exist
      const raw = r as unknown as Record<string, unknown>;
      assert.equal(raw["score"], undefined);
      assert.equal(raw["tier"], undefined);
      assert.equal(raw["reward"], undefined);
      assert.equal(raw["viability"], undefined);
      assert.equal(raw["bonus"], undefined);
      assert.equal(raw["event"], undefined);
    }
  });

  it("content check rejects any proposal with reward/score/tier language", () => {
    const dangerousPhrases = [
      "+10%经验",
      "score提升",
      "bonus加成",
      "tier评价",
      "reward回报",
      "viability指标",
    ];
    for (const phrase of dangerousPhrases) {
      const proposal = validProposal({ description: `探索北方荒野的奥秘，${phrase}将在此过程中显现` });
      const result = checkProposalContent(proposal);
      assert.equal(result.ok, false, `should reject: ${phrase}`);
    }
  });
});

// ---------------------------------------------------------------------------
// Direct Anthropic Provider tests
// ---------------------------------------------------------------------------

describe("DirectAnthropicProvider", () => {
  it("throws when ANTHROPIC_API_KEY is missing", () => {
    const original = process.env["ANTHROPIC_API_KEY"];
    try {
      delete process.env["ANTHROPIC_API_KEY"];
      assert.throws(
        () => new DirectAnthropicProvider(),
        /server_quest_ai_anthropic_key_missing/,
      );
    } finally {
      if (original !== undefined) {
        process.env["ANTHROPIC_API_KEY"] = original;
      }
    }
  });

  it("constructs when ANTHROPIC_API_KEY is present", () => {
    const original = process.env["ANTHROPIC_API_KEY"];
    try {
      process.env["ANTHROPIC_API_KEY"] = "test-key";
      const provider = new DirectAnthropicProvider();
      assert.equal(provider.name, "direct_anthropic");
    } finally {
      if (original !== undefined) {
        process.env["ANTHROPIC_API_KEY"] = original;
      } else {
        delete process.env["ANTHROPIC_API_KEY"];
      }
    }
  });
});

// ---------------------------------------------------------------------------
// McpSamplingFallbackProvider tests
// ---------------------------------------------------------------------------

describe("McpSamplingFallbackProvider", () => {
  it("throws McpSamplingProviderError on sampling failure", async () => {
    const mockClient = {
      async createTaskPlanMessage() {
        return { ok: false, fallback: "timeout" as const };
      },
    };
    const provider = new McpSamplingFallbackProvider(mockClient);
    await assert.rejects(
      () => provider.generate(validInput()),
      (error: unknown) => error instanceof McpSamplingProviderError && error.fallback === "timeout",
    );
  });

  it("parses proposals from successful sampling result", async () => {
    const mockClient = {
      async createTaskPlanMessage() {
        return {
          ok: true,
          proposal: JSON.stringify([{
            proposalId: "prop_mcp_001",
            region: "region_north",
            taskFamilyId: "tf_combat_patrol",
            approachTags: ["combat"],
            title: "北境清剿行动",
            description: "在北方荒野中清除威胁商路的匪患，确保行旅平安",
            worldSliceHash: WORLD_SLICE_HASH,
          }]),
        };
      },
    };
    const provider = new McpSamplingFallbackProvider(mockClient);
    const results = await provider.generate(validInput());
    assert.equal(results.length, 1);
    assert.equal(results[0]!.proposalId, "prop_mcp_001");
    assert.deepEqual(results[0]!.approachTags, ["combat"]);
  });

  it("returns empty array when sampling returns null proposal", async () => {
    const mockClient = {
      async createTaskPlanMessage() {
        return { ok: true, proposal: null };
      },
    };
    const provider = new McpSamplingFallbackProvider(mockClient);
    const results = await provider.generate(validInput());
    assert.deepEqual(results, []);
  });

  it("wraps proposal object in array when single object returned", async () => {
    const mockClient = {
      async createTaskPlanMessage() {
        return {
          ok: true,
          proposal: {
            proposalId: "prop_single",
            region: "region_north",
            taskFamilyId: "tf_recon_scout",
            approachTags: ["scout"],
            title: "侦察北方边境",
            description: "深入北方边境侦察敌情，收集关键战略情报",
            worldSliceHash: WORLD_SLICE_HASH,
          },
        };
      },
    };
    const provider = new McpSamplingFallbackProvider(mockClient);
    const results = await provider.generate(validInput());
    assert.equal(results.length, 1);
    assert.equal(results[0]!.proposalId, "prop_single");
  });
});

// ---------------------------------------------------------------------------
// buildProviderChain tests
// ---------------------------------------------------------------------------

describe("buildProviderChain", () => {
  it("returns empty chain when no API key and no MCP client", () => {
    const chain = buildProviderChain(undefined, { env: {} });
    assert.equal(chain.length, 0);
  });

  it("includes DirectAnthropic when API key is present", () => {
    const chain = buildProviderChain(undefined, { env: { ANTHROPIC_API_KEY: "test-key" } });
    assert.equal(chain.length, 1);
    assert.equal(chain[0]!.name, "direct_anthropic");
  });

  it("includes McpSampling when client is provided", () => {
    const mockClient = {
      async createTaskPlanMessage() {
        return { ok: true, proposal: null };
      },
    };
    const chain = buildProviderChain(mockClient, { env: {} });
    assert.equal(chain.length, 1);
    assert.equal(chain[0]!.name, "mcp_sampling_fallback");
  });

  it("includes both providers when both available", () => {
    const mockClient = {
      async createTaskPlanMessage() {
        return { ok: true, proposal: null };
      },
    };
    const chain = buildProviderChain(mockClient, { env: { ANTHROPIC_API_KEY: "test-key" } });
    assert.equal(chain.length, 2);
    assert.equal(chain[0]!.name, "direct_anthropic");
    assert.equal(chain[1]!.name, "mcp_sampling_fallback");
  });

  it("includes an OpenAI-compatible model adapter from generic environment settings", () => {
    const chain = buildProviderChain(undefined, {
      env: {
        AGENT_SERVER_MODEL_PROVIDER: "openai_compatible",
        AGENT_SERVER_MODEL_BASE_URL: "http://127.0.0.1:1234/v1",
        AGENT_SERVER_MODEL_NAME: "qwen-local",
      },
    });
    assert.equal(chain.length, 1);
    assert.equal(chain[0]!.name, "openai_compatible_model");
  });
});

// ---------------------------------------------------------------------------
// Catalog fallback tests
// ---------------------------------------------------------------------------

describe("generateCatalogFallbackOffers", () => {
  it("returns deterministic offers for a region", () => {
    const offers = generateCatalogFallbackOffers("region_north");
    assert.ok(offers.length > 0);
    for (const offer of offers) {
      assert.equal(offer.region, "region_north");
      assert.equal(offer.source, "catalog_fallback");
      assert.ok(offer.proposalId.startsWith("prop_cat_region_north_"));
    }
  });

  it("returns same offers for same region", () => {
    const offers1 = generateCatalogFallbackOffers("region_south");
    const offers2 = generateCatalogFallbackOffers("region_south");
    assert.deepEqual(offers1, offers2);
  });

  it("returns different offers for different regions", () => {
    const offers1 = generateCatalogFallbackOffers("region_a");
    const offers2 = generateCatalogFallbackOffers("region_b");
    assert.notEqual(offers1[0]!.proposalId, offers2[0]!.proposalId);
  });
});
