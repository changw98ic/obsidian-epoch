import assert from "node:assert/strict";
import test from "node:test";
import { buildFallbackJourneyTaskPlan, validateJourneyTaskProposal } from "../lib/epoch/journeyGeneratedTaskRules.ts";
import { journeyTaskRouteForRegion } from "../lib/epoch/journeyTaskCatalog.ts";
import { createMcpSamplingLimiter } from "../lib/mcpSamplingLimiter.ts";

const regionId = "region_quantum_laboratory";

type MutableProposal = {
  readonly objectives: Array<{ readonly worldObjectIds: string[]; readonly locationId: string }>;
};

function fixtureProposal(): { proposal: MutableProposal; availableWorldObjects: readonly { readonly id: string }[] } {
  const route = journeyTaskRouteForRegion(regionId);
  assert.ok(route, "fixture route missing");
  const region = { id: regionId, type: "region" as const, label: "量子实验室", regionId, sourceFactIds: [`world:region:${regionId}`] };
  const availableWorldObjects = [region, ...route.worldObjects];
  const { plan } = buildFallbackJourneyTaskPlan({ taskType: "辅助完成一次实验", scenarioMapId: regionId, availableWorldObjects });
  const proposal = {
    title: plan.title,
    premise: plan.premise,
    primaryObjective: plan.primaryObjective,
    successResult: plan.successResult,
    completionResult: plan.completionResult,
    objectives: structuredClone(plan.objectives) as Array<{ worldObjectIds: string[]; locationId: string }>,
    routes: plan.routes,
  };
  return { proposal, availableWorldObjects };
}

function validate(proposal: unknown, availableWorldObjects: readonly { readonly id: string }[]) {
  return validateJourneyTaskProposal({
    proposal,
    taskType: "辅助完成一次实验",
    scenarioMapId: regionId,
    availableWorldObjects,
    source: "task_plan_sampling",
  });
}

// Spec 4 — class 1: location id missing from worldObjectIds
test("grounding: objective locationId missing from worldObjectIds → error message includes locationId", () => {
  const { proposal, availableWorldObjects } = fixtureProposal();
  const objective = proposal.objectives[0];
  objective.worldObjectIds = objective.worldObjectIds.filter((id) => id !== objective.locationId);
  assert.throws(
    () => validate(proposal, availableWorldObjects),
    /journey_task_world_object_not_grounded:locationId:/,
    "locationId-missing case must surface the locationId in the error so resample feedback can name it",
  );
});

// Spec 4 — class 2: invalid object id feedback
test("grounding: worldObjectIds contains invalid id → error message includes objects:<id>", () => {
  const { proposal, availableWorldObjects } = fixtureProposal();
  proposal.objectives[0].worldObjectIds.push("fake_object_id_not_in_map");
  assert.throws(
    () => validate(proposal, availableWorldObjects),
    /journey_task_world_object_not_grounded:objects:fake_object_id_not_in_map/,
    "invalid object id must appear in error so resample feedback can name the offending id",
  );
});

// Spec 1 — limiter records specific limitReason
test("limiter: concurrency deny returns reason 'concurrency'", () => {
  const limiter = createMcpSamplingLimiter({ maxConcurrent: 1, maxRequestsPerMinute: 100, maxTokensPerMinute: 100_000 });
  const first = limiter.acquire(100);
  assert.ok(!("denied" in first), "first acquire should be permitted");
  const second = limiter.acquire(100);
  assert.equal("denied" in second ? second.denied : undefined, "concurrency");
  if ("release" in first) first.release();
});

test("limiter: request_rate deny returns reason 'request_rate'", () => {
  const limiter = createMcpSamplingLimiter({ maxConcurrent: 10, maxRequestsPerMinute: 1, maxTokensPerMinute: 100_000 });
  const first = limiter.acquire(10);
  assert.ok(!("denied" in first));
  if ("release" in first) first.release();
  const second = limiter.acquire(10);
  assert.equal("denied" in second ? second.denied : undefined, "request_rate");
});

// Spec 4 — class 3: task-plan resample budget exhausted
test("limiter: task-plan resample (large token cost) denied by token_budget when budget exhausted", () => {
  const limiter = createMcpSamplingLimiter({ maxConcurrent: 10, maxRequestsPerMinute: 100, maxTokensPerMinute: 5_000 });
  // A single task-plan sampling costs ~6000 tokens (matches createTaskPlanMessage maxTokens).
  // Budget 5000 < 6000 → denied token_budget (simulates resample after budget nearly exhausted).
  const result = limiter.acquire(6_000);
  assert.equal("denied" in result ? result.denied : undefined, "token_budget");
});

test("limiter: token_budget accumulates across requests and denies once exceeded", () => {
  const limiter = createMcpSamplingLimiter({ maxConcurrent: 10, maxRequestsPerMinute: 100, maxTokensPerMinute: 10_000 });
  // First two 4000-token requests consume 8000; third 4000 would push to 12000 > 10000.
  const a = limiter.acquire(4_000); assert.ok(!("denied" in a)); if ("release" in a) a.release();
  const b = limiter.acquire(4_000); assert.ok(!("denied" in b)); if ("release" in b) b.release();
  const c = limiter.acquire(4_000);
  assert.equal("denied" in c ? c.denied : undefined, "token_budget");
});
