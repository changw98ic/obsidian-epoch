/**
 * PR3 source-binding consistency lock + zero-bonus scrubber.
 *
 * Verifies:
 *   1. installJourneyTaskPlan treats offer-driven plans by the source-binding
 *      tuple (questOfferId/offerHash/taskFamilyId/marketSnapshotVersion/
 *      worldSliceHash) instead of strict taskType equality.
 *   2. installJourneyTaskPlan keeps the direct taskType/scenarioMapId equality
 *      check for non-offer journeys (no break to existing semantics).
 *   3. The fallback installation now carries every PR1 additive source-binding
 *      field, so the lock treats offer-driven and fallback plans uniformly.
 *   4. scrubJourneyForPublicView strips every internal field from both the
 *      top-level journey and its embedded taskRequest.
 *   5. Idempotent re-install of an offer-driven plan does not throw, but
 *      tuple drift throws journey_task_plan_source_binding_conflict.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  buildFallbackJourneyTaskPlan,
  type JourneyGeneratedTaskPlan,
  type JourneyHiddenTaskSeal,
  type JourneyTaskPlanInstallation,
} from "../lib/epoch/journeyGeneratedTaskRules.ts";
import {
  installJourneyTaskPlan,
  type EpochJourney,
  type JourneyGeneratedTaskObjective,
} from "../lib/epoch/journeyRules.ts";
import { scrubJourneyForPublicView } from "../lib/epoch/journeyReadModel.ts";

function fixtureJourney(overrides: Partial<EpochJourney> = {}): EpochJourney {
  return {
    journeyId: "journey_test",
    agentId: "agent_test",
    explorerId: "explorer_test",
    status: "prepared",
    originRegionId: "region_a",
    destinationRegionId: "region_b",
    taskRequest: { taskType: "type_a", scenarioMapId: "region_b" },
    mandate: { objective: "type_a", priorities: [], avoid: [] },
    policyVersion: 1,
    worldMode: "mirror",
    mirrorTimeRuleVersion: 2,
    episodeIds: [],
    interactionIds: [],
    sourceEventIds: [],
    synchronousQuestionCount: 0,
    version: 1,
    ...overrides,
  };
}

function fakePlan(taskType: string, scenarioMapId: string): JourneyGeneratedTaskPlan {
  return {
    version: 1,
    source: "server_fallback",
    adjudicationVersion: 2,
    taskType,
    scenarioMapId,
    title: "t",
    premise: "p",
    primaryObjective: "o",
    successResult: "s",
    completionResult: { kind: "item", returnMode: "carry", summary: "x" },
    objectives: [] as readonly JourneyGeneratedTaskObjective[],
    hiddenTaskCommitment: "sha256:fake",
  } as JourneyGeneratedTaskPlan;
}

function fakeSeal(): JourneyHiddenTaskSeal {
  return {
    version: 1,
    commitment: "sha256:fake",
    planHash: "sha256:fake",
    nonce: "n",
    hiddenTask: { description: "d", requiredActions: [] },
  };
}

test("installJourneyTaskPlan: offer-driven plan accepted by source-binding tuple even when taskType differs from raw client taskType", () => {
  // Offer-driven journey: questOfferId set. Raw client taskType was "type_a"
  // but the offer's taskTypeText is "护送商队" — the tuple must be the only
  // authority, not the taskType strings.
  const journey = fixtureJourney({
    questOfferId: "offer_1",
    offerHash: "sha256:abc",
    marketSnapshotVersion: 7,
    taskRequest: {
      taskType: "护送商队",
      scenarioMapId: "region_b",
      taskFamilyId: "family_x",
      questOfferId: "offer_1",
      offerHash: "sha256:abc",
      marketSnapshotVersion: 7,
    },
  });
  const installation: JourneyTaskPlanInstallation = {
    plan: fakePlan("护送商队", "region_b"),
    hiddenTaskSeal: fakeSeal(),
    taskFamilyId: "family_x",
    questOfferId: "offer_1",
    offerHash: "sha256:abc",
    marketSnapshotVersion: 7,
    worldSliceHash: "sha256:ws",
  };
  const installed = installJourneyTaskPlan({ journey, expectedVersion: 1, installation });
  assert.equal(installed.taskPlan?.taskType, "护送商队");
  assert.equal(installed.questOfferId, "offer_1");
  assert.equal(installed.offerHash, "sha256:abc");
  assert.equal(installed.marketSnapshotVersion, 7);
});

test("installJourneyTaskPlan: offer-driven tuple mismatch throws journey_task_plan_source_binding_mismatch", () => {
  const journey = fixtureJourney({
    questOfferId: "offer_1",
    offerHash: "sha256:abc",
    marketSnapshotVersion: 7,
    taskRequest: {
      taskType: "护送商队",
      scenarioMapId: "region_b",
      taskFamilyId: "family_x",
      questOfferId: "offer_1",
      offerHash: "sha256:abc",
      marketSnapshotVersion: 7,
    },
  });
  const installation: JourneyTaskPlanInstallation = {
    plan: fakePlan("护送商队", "region_b"),
    hiddenTaskSeal: fakeSeal(),
    taskFamilyId: "family_DIFFERENT",
    questOfferId: "offer_1",
    offerHash: "sha256:abc",
    marketSnapshotVersion: 7,
    worldSliceHash: "sha256:ws",
  };
  assert.throws(
    () => installJourneyTaskPlan({ journey, expectedVersion: 1, installation }),
    /journey_task_plan_source_binding_mismatch/,
  );
});

test("installJourneyTaskPlan: legacy non-offer journey still uses taskType/scenarioMapId equality backstop", () => {
  const journey = fixtureJourney();
  const installation: JourneyTaskPlanInstallation = {
    plan: fakePlan("WRONG_TYPE", "region_b"),
    hiddenTaskSeal: fakeSeal(),
  };
  assert.throws(
    () => installJourneyTaskPlan({ journey, expectedVersion: 1, installation }),
    /journey_task_plan_request_mismatch/,
  );
  // Same journey accepts a matching plan
  const ok = installJourneyTaskPlan({
    journey,
    expectedVersion: 1,
    installation: { plan: fakePlan("type_a", "region_b"), hiddenTaskSeal: fakeSeal() },
  });
  assert.equal(ok.taskPlan?.taskType, "type_a");
});

test("installJourneyTaskPlan: idempotent re-install of offer-driven plan is a no-op; tuple drift throws", () => {
  const journey = fixtureJourney({
    questOfferId: "offer_1",
    offerHash: "sha256:abc",
    marketSnapshotVersion: 7,
    taskRequest: {
      taskType: "护送商队",
      scenarioMapId: "region_b",
      taskFamilyId: "family_x",
      questOfferId: "offer_1",
      offerHash: "sha256:abc",
      marketSnapshotVersion: 7,
    },
  });
  const installation: JourneyTaskPlanInstallation = {
    plan: fakePlan("护送商队", "region_b"),
    hiddenTaskSeal: fakeSeal(),
    taskFamilyId: "family_x",
    questOfferId: "offer_1",
    offerHash: "sha256:abc",
    marketSnapshotVersion: 7,
    worldSliceHash: "sha256:ws",
  };
  const installed = installJourneyTaskPlan({ journey, expectedVersion: 1, installation });
  // Re-install identical: no-op
  const replayed = installJourneyTaskPlan({
    journey: installed,
    expectedVersion: 2,
    installation,
  });
  assert.equal(replayed, installed);
  // Drift on tuple throws
  assert.throws(
    () => installJourneyTaskPlan({
      journey: installed,
      expectedVersion: 2,
      installation: { ...installation, questOfferId: "offer_OTHER" },
    }),
    /journey_task_plan_source_binding_conflict/,
  );
});

test("buildFallbackJourneyTaskPlan populates every PR1 additive source-binding field with deterministic values", () => {
  const a = buildFallbackJourneyTaskPlan({
    taskType: "辅助完成一次实验",
    scenarioMapId: "region_gray_harbor",
    availableWorldObjects: [
      { id: "region_gray_harbor", type: "region", label: "灰港", regionId: "region_gray_harbor", sourceFactIds: [], tags: [] },
    ],
  });
  const b = buildFallbackJourneyTaskPlan({
    taskType: "辅助完成一次实验",
    scenarioMapId: "region_gray_harbor",
    availableWorldObjects: [
      { id: "region_gray_harbor", type: "region", label: "灰港", regionId: "region_gray_harbor", sourceFactIds: [], tags: [] },
    ],
  });
  assert.ok(a.taskFamilyId?.startsWith("catalog:") || a.taskFamilyId?.startsWith("map_"));
  assert.ok(a.offerHash?.startsWith("sha256:"));
  assert.ok(a.worldSliceHash?.startsWith("sha256:"));
  assert.equal(a.marketSnapshotVersion, 0);
  assert.ok(a.sourceContextHash?.startsWith("sha256:"));
  assert.ok(a.generationBatchId?.startsWith("fallback:"));
  assert.equal(a.questOfferId, undefined);
  assert.equal(a.plan.source, "server_fallback");
  // Determinism: the source-binding tuple (taskFamilyId / offerHash /
  // worldSliceHash / marketSnapshotVersion / sourceContextHash /
  // generationBatchId) and the unsigned plan hash are bit-identical across
  // restart replay. The hidden task seal nonce is intentionally random
  // (it's a sealed commitment) so it is excluded from the comparison.
  assert.equal(a.taskFamilyId, b.taskFamilyId);
  assert.equal(a.offerHash, b.offerHash);
  assert.equal(a.worldSliceHash, b.worldSliceHash);
  assert.equal(a.marketSnapshotVersion, b.marketSnapshotVersion);
  assert.equal(a.sourceContextHash, b.sourceContextHash);
  assert.equal(a.generationBatchId, b.generationBatchId);
  assert.equal(a.hiddenTaskSeal.planHash, b.hiddenTaskSeal.planHash);
});

test("scrubJourneyForPublicView strips every internal field from journey and taskRequest", () => {
  const internal: EpochJourney = fixtureJourney({
    questOfferId: "offer_1",
    offerHash: "sha256:abc",
    marketSnapshotVersion: 7,
    taskRequest: {
      taskType: "护送商队",
      scenarioMapId: "region_b",
      taskFamilyId: "family_x",
      questOfferId: "offer_1",
      offerHash: "sha256:abc",
      expectedApproach: "collaborative",
      marketSnapshotVersion: 7,
    } as EpochJourney["taskRequest"],
  });
  const scrubbed = scrubJourneyForPublicView(internal);
  const json = JSON.stringify(scrubbed);
  assert.equal(scrubbed.questOfferId, undefined);
  assert.equal(scrubbed.offerHash, undefined);
  assert.equal(scrubbed.marketSnapshotVersion, undefined);
  assert.equal(scrubbed.taskRequest?.taskFamilyId, undefined);
  assert.equal(scrubbed.taskRequest?.questOfferId, undefined);
  assert.equal(scrubbed.taskRequest?.offerHash, undefined);
  assert.equal(scrubbed.taskRequest?.expectedApproach, undefined);
  assert.equal(scrubbed.taskRequest?.marketSnapshotVersion, undefined);
  // No internal marker survives JSON serialization (the public MCP boundary)
  assert.doesNotMatch(json, /questOfferId|offerHash|marketSnapshotVersion|taskFamilyId|expectedApproach/);
  // Public fields are preserved
  assert.equal(scrubbed.taskRequest?.taskType, "护送商队");
  assert.equal(scrubbed.taskRequest?.scenarioMapId, "region_b");
  assert.equal(scrubbed.journeyId, "journey_test");
});

test("scrubJourneyForPublicView leaves non-offer journeys untouched on public fields", () => {
  const plain = fixtureJourney();
  const scrubbed = scrubJourneyForPublicView(plain);
  assert.equal(scrubbed.journeyId, plain.journeyId);
  assert.equal(scrubbed.taskRequest?.taskType, "type_a");
  assert.equal(scrubbed.taskRequest?.scenarioMapId, "region_b");
});
