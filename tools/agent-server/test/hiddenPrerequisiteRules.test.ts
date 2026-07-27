import assert from "node:assert/strict";
import test from "node:test";

import {
  HIDDEN_PREREQ_DEGREE_MAX,
  HIDDEN_PREREQ_DEGREE_MIN,
  HIDDEN_PREREQ_OBJECT_MAX_PER_OBJECTIVE,
  HIDDEN_PREREQ_POLICY_VERSION,
  OBJECT_DESTROY_DEGREE_THRESHOLD,
  applyObjectMutation,
  assertValidObjectImpactDegree,
  buildHiddenPrerequisiteGraph,
  degreeToStatus,
  discardObjectMutation,
  emptyHiddenPrerequisiteProjection,
  hiddenPrereqLinkKey,
  hiddenStatusForFutureJourney,
  isHiddenObjectiveReachable,
  lookupHiddenPrerequisiteLink,
  lookupObjectStatus,
  solidifyObjectMutation,
  validateHiddenPrerequisiteDag,
  type CanonicalObjectStateIntent,
  type HiddenPrerequisiteGraph,
  type HiddenPrerequisiteObjectiveInput,
  type HiddenPrerequisiteProjection,
} from "../lib/epoch/hiddenPrerequisiteRules.ts";

/**
 * PR5c unit tests for the pure hidden-prerequisite graph model.
 *
 * Coverage areas (spec §6.10 + §14):
 *  - Degree validation + degree→status mapping.
 *  - Link-key namespacing (region prefix from day one).
 *  - DAG construction + validation (unknown object / self-reference /
 *    cycle / overdetermined / overflow).
 *  - applyObjectMutation: degraded vs destroyed, monotonicity, irreversibility,
 *    fail-closed on unknown object, idempotent replay.
 *  - Solidify vs discard semantics (destroyed solidifies into canonical;
 *    discard leaves projection untouched).
 *  - Future-journey adjudication (destroyed → unreachable, degraded → reachable).
 */

const REGION_ID = "region_001";
const OTHER_REGION_ID = "region_002";
const ACTION_EVENT_ID = "evt_action_001";
const REPLAY_ACTION_EVENT_ID = "evt_action_001"; // intentional same id for replay tests
const OTHER_ACTION_EVENT_ID = "evt_action_002";
const OBSERVED_AT = "2026-07-25T12:00:00.000Z";
const LATER_OBSERVED_AT = "2026-07-25T13:00:00.000Z";

interface ObjectiveOverrides {
  readonly objectiveId: string;
  readonly worldObjectIds?: readonly string[];
  readonly hiddenPrerequisiteObjectIds?: readonly string[];
}

function objective(overrides: ObjectiveOverrides): HiddenPrerequisiteObjectiveInput {
  return {
    objectiveId: overrides.objectiveId,
    worldObjectIds: overrides.worldObjectIds ?? [],
    ...(overrides.hiddenPrerequisiteObjectIds
      ? { hiddenPrerequisiteObjectIds: overrides.hiddenPrerequisiteObjectIds }
      : {}),
  };
}

interface BuildGraphOverrides {
  readonly regionId?: string;
  readonly objectives: readonly HiddenPrerequisiteObjectiveInput[];
}

function buildGraph(overrides: BuildGraphOverrides): HiddenPrerequisiteGraph {
  return buildHiddenPrerequisiteGraph({
    regionId: overrides.regionId ?? REGION_ID,
    objectives: overrides.objectives,
  });
}

/**
 * Canonical two-objective fixture used by the cycle / reachability suites.
 * Objective A declares an object in B's worldObjects as a hidden prereq;
 * B does NOT reciprocate, so the DAG is acyclic.
 */
function acyclicTwoObjectiveSetup(): {
  readonly graph: HiddenPrerequisiteGraph;
  readonly objectiveAId: string;
  readonly objectiveBId: string;
  readonly sharedObjectId: string;
} {
  const objectiveAId = "main_1";
  const objectiveBId = "side_1";
  const sharedObjectId = "object_relic";
  const graph = buildGraph({
    objectives: [
      objective({
        objectiveId: objectiveAId,
        worldObjectIds: ["object_anchor"],
        hiddenPrerequisiteObjectIds: [sharedObjectId],
      }),
      objective({
        objectiveId: objectiveBId,
        worldObjectIds: [sharedObjectId, "object_altar"],
      }),
    ],
  });
  return { graph, objectiveAId, objectiveBId, sharedObjectId };
}

// ---------------------------------------------------------------------------
// Degree validation + degree→status mapping
// ---------------------------------------------------------------------------

test("HIDDEN_PREREQ_POLICY_VERSION and threshold constants are stable", () => {
  // Lock the constant values — bumping any of these requires migrating
  // persisted canonical state. Asserting here so a silent bump fails the suite.
  assert.equal(HIDDEN_PREREQ_POLICY_VERSION, 1);
  assert.equal(OBJECT_DESTROY_DEGREE_THRESHOLD, 3);
  assert.equal(HIDDEN_PREREQ_DEGREE_MIN, 1);
  assert.equal(HIDDEN_PREREQ_DEGREE_MAX, 5);
  assert.equal(HIDDEN_PREREQ_OBJECT_MAX_PER_OBJECTIVE, 4);
});

test("assertValidObjectImpactDegree accepts integers in [1,5]", () => {
  for (let degree = HIDDEN_PREREQ_DEGREE_MIN; degree <= HIDDEN_PREREQ_DEGREE_MAX; degree += 1) {
    assertValidObjectImpactDegree(degree);
    assertValidObjectImpactDegree(degree as number);
  }
});

test("assertValidObjectImpactDegree rejects degree = 0 (no-effect sentinel)", () => {
  assert.throws(() => assertValidObjectImpactDegree(0), {
    message: "journey_task_object_impact_degree_invalid",
  });
});

test("assertValidObjectImpactDegree rejects degree above the max", () => {
  assert.throws(() => assertValidObjectImpactDegree(HIDDEN_PREREQ_DEGREE_MAX + 1), {
    message: "journey_task_object_impact_degree_invalid",
  });
});

test("assertValidObjectImpactDegree rejects negative degree", () => {
  assert.throws(() => assertValidObjectImpactDegree(-1), {
    message: "journey_task_object_impact_degree_invalid",
  });
});

test("assertValidObjectImpactDegree rejects non-integer degree", () => {
  assert.throws(() => assertValidObjectImpactDegree(2.5), {
    message: "journey_task_object_impact_degree_invalid",
  });
});

test("assertValidObjectImpactDegree rejects non-number inputs and narrows type", () => {
  for (const invalid of ["3", null, undefined, true, {}, [], Number.NaN] as readonly unknown[]) {
    assert.throws(() => assertValidObjectImpactDegree(invalid), {
      message: "journey_task_object_impact_degree_invalid",
    });
  }
  // After a passing call, the value is narrowed to number — sanity check.
  const value: unknown = 3;
  assertValidObjectImpactDegree(value);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const narrowed: number = value;
  assert.equal(narrowed, 3);
});

test("degreeToStatus maps 1-2 to degraded and 3-5 to destroyed", () => {
  assert.equal(degreeToStatus(1), "degraded");
  assert.equal(degreeToStatus(2), "degraded");
  assert.equal(degreeToStatus(3), "destroyed");
  assert.equal(degreeToStatus(4), "destroyed");
  assert.equal(degreeToStatus(5), "destroyed");
  // Threshold boundary is the documented constant.
  assert.equal(degreeToStatus(OBJECT_DESTROY_DEGREE_THRESHOLD), "destroyed");
  assert.equal(degreeToStatus(OBJECT_DESTROY_DEGREE_THRESHOLD - 1), "degraded");
});

// ---------------------------------------------------------------------------
// Link-key namespacing
// ---------------------------------------------------------------------------

test("hiddenPrereqLinkKey includes the region prefix from day one", () => {
  // Cross-journey namespace collision is mitigated by embedding regionId
  // in the key even though v2.2 is single-region (§14 out-of-scope).
  const key = hiddenPrereqLinkKey(REGION_ID, "main_1", "object_relic");
  assert.equal(key, `${REGION_ID}:main_1:object_relic`);
});

test("hiddenPrereqLinkKey rejects empty segments", () => {
  assert.throws(
    () => hiddenPrereqLinkKey("", "main_1", "object_relic"),
    { message: "journey_hidden_prereq_link_key_empty_segment" },
  );
  assert.throws(
    () => hiddenPrereqLinkKey(REGION_ID, "", "object_relic"),
    { message: "journey_hidden_prereq_link_key_empty_segment" },
  );
  assert.throws(
    () => hiddenPrereqLinkKey(REGION_ID, "main_1", ""),
    { message: "journey_hidden_prereq_link_key_empty_segment" },
  );
});

// ---------------------------------------------------------------------------
// emptyHiddenPrerequisiteProjection / lookups
// ---------------------------------------------------------------------------

test("emptyHiddenPrerequisiteProjection yields an empty, region-scoped projection", () => {
  const projection = emptyHiddenPrerequisiteProjection(REGION_ID);
  assert.equal(projection.regionId, REGION_ID);
  assert.deepEqual(projection.worldObjectStates, {});
  assert.deepEqual(projection.hiddenPrerequisiteLinks, {});
});

test("emptyHiddenPrerequisiteProjection rejects an empty region id", () => {
  assert.throws(() => emptyHiddenPrerequisiteProjection(""), {
    message: "journey_hidden_prereq_region_empty",
  });
});

test("lookupObjectStatus and lookupHiddenPrerequisiteLink return undefined for never-recorded entries", () => {
  const projection = emptyHiddenPrerequisiteProjection(REGION_ID);
  assert.equal(lookupObjectStatus(projection, "object_relic"), undefined);
  assert.equal(
    lookupHiddenPrerequisiteLink(projection, "main_1", "object_relic"),
    undefined,
  );
});

// ---------------------------------------------------------------------------
// buildHiddenPrerequisiteGraph — construction
// ---------------------------------------------------------------------------

test("buildHiddenPrerequisiteGraph builds deterministic nodes + indexes for an acyclic plan", () => {
  const { graph, objectiveAId, sharedObjectId } = acyclicTwoObjectiveSetup();
  assert.deepEqual(graph.nodes, [
    { objectiveId: objectiveAId, prerequisiteObjectId: sharedObjectId },
  ]);
  assert.deepEqual(graph.objectivesByPrereqObject, {
    [sharedObjectId]: [objectiveAId],
  });
  assert.deepEqual(graph.prereqObjectsByObjective, {
    [objectiveAId]: [sharedObjectId],
  });
  // Indexes include all objectives' worldObjectIds, not only those that
  // declare hidden prereqs.
  assert.deepEqual(graph.worldObjectsByObjective, {
    main_1: ["object_anchor"],
    side_1: [sharedObjectId, "object_altar"],
  });
  assert.deepEqual(
    [...graph.knownObjectIds].sort(),
    ["object_altar", "object_anchor", "object_relic"].sort(),
  );
  assert.deepEqual([...graph.knownObjectiveIds].sort(), ["main_1", "side_1"].sort());
});

test("buildHiddenPrerequisiteGraph preserves insertion order across objectives and prereq objects", () => {
  const graph = buildGraph({
    objectives: [
      objective({
        objectiveId: "main_1",
        worldObjectIds: ["o_a", "o_b"],
        hiddenPrerequisiteObjectIds: ["o_a", "o_b"], // self-reference is allowed at build time
      }),
      objective({
        objectiveId: "main_2",
        worldObjectIds: ["o_c"],
        hiddenPrerequisiteObjectIds: ["o_c", "o_a"],
      }),
    ],
  });
  // Order is: main_1/o_a, main_1/o_b, main_2/o_c, main_2/o_a
  assert.deepEqual(graph.nodes, [
    { objectiveId: "main_1", prerequisiteObjectId: "o_a" },
    { objectiveId: "main_1", prerequisiteObjectId: "o_b" },
    { objectiveId: "main_2", prerequisiteObjectId: "o_c" },
    { objectiveId: "main_2", prerequisiteObjectId: "o_a" },
  ]);
});

test("buildHiddenPrerequisiteGraph rejects empty region id and empty objective id", () => {
  assert.throws(
    () => buildGraph({ regionId: "", objectives: [] }),
    { message: "journey_hidden_prereq_region_empty" },
  );
  assert.throws(
    () => buildGraph({ objectives: [objective({ objectiveId: "", worldObjectIds: ["o_a"] })] }),
    { message: "journey_hidden_prereq_objective_id_empty" },
  );
});

test("buildHiddenPrerequisiteGraph rejects empty worldObjectIds / hiddenPrerequisiteObjectIds entries", () => {
  assert.throws(
    () => buildGraph({ objectives: [objective({ objectiveId: "main_1", worldObjectIds: [""] })] }),
    { message: "journey_hidden_prereq_world_object_id_empty" },
  );
  assert.throws(
    () =>
      buildGraph({
        objectives: [
          objective({
            objectiveId: "main_1",
            worldObjectIds: ["o_a"],
            hiddenPrerequisiteObjectIds: [""],
          }),
        ],
      }),
    { message: "journey_hidden_prereq_prereq_object_id_empty" },
  );
});

test("buildHiddenPrerequisiteGraph rejects duplicate objective ids", () => {
  assert.throws(
    () =>
      buildGraph({
        objectives: [
          objective({ objectiveId: "main_1", worldObjectIds: ["o_a"] }),
          objective({ objectiveId: "main_1", worldObjectIds: ["o_b"] }),
        ],
      }),
    { message: "journey_hidden_prereq_objective_id_duplicate:main_1" },
  );
});

test("buildHiddenPrerequisiteGraph rejects duplicate hidden prereq ids within one objective", () => {
  assert.throws(
    () =>
      buildGraph({
        objectives: [
          objective({
            objectiveId: "main_1",
            worldObjectIds: ["o_a"],
            hiddenPrerequisiteObjectIds: ["o_a", "o_a"],
          }),
        ],
      }),
    { message: "journey_hidden_prereq_prereq_object_duplicate:main_1:o_a" },
  );
});

test("buildHiddenPrerequisiteGraph enforces the per-objective cap (defence-in-depth)", () => {
  const tooMany = Array.from(
    { length: HIDDEN_PREREQ_OBJECT_MAX_PER_OBJECTIVE + 1 },
    (_, index) => `o_${index}`,
  );
  assert.throws(
    () =>
      buildGraph({
        objectives: [
          objective({
            objectiveId: "main_1",
            worldObjectIds: tooMany,
            hiddenPrerequisiteObjectIds: tooMany,
          }),
        ],
      }),
    { message: "journey_hidden_prereq_object_overflow" },
  );
});

// ---------------------------------------------------------------------------
// validateHiddenPrerequisiteDag
// ---------------------------------------------------------------------------

test("validateHiddenPrerequisiteDag accepts an acyclic plan with disjoint objective+object edges", () => {
  const { graph } = acyclicTwoObjectiveSetup();
  validateHiddenPrerequisiteDag(graph); // no throw
});

test("validateHiddenPrerequisiteDag accepts a plan with zero hidden prereqs declared", () => {
  const graph = buildGraph({
    objectives: [
      objective({ objectiveId: "main_1", worldObjectIds: ["o_a"] }),
      objective({ objectiveId: "side_1", worldObjectIds: ["o_b"] }),
    ],
  });
  validateHiddenPrerequisiteDag(graph); // no throw
});

test("validateHiddenPrerequisiteDag rejects an unknown prereq object (object not in any worldObjectIds)", () => {
  const graph = buildGraph({
    objectives: [
      objective({
        objectiveId: "main_1",
        worldObjectIds: ["o_a"],
        hiddenPrerequisiteObjectIds: ["o_phantom"],
      }),
    ],
  });
  assert.throws(() => validateHiddenPrerequisiteDag(graph), {
    message: "journey_hidden_prereq_object_unknown:o_phantom",
  });
});

test("validateHiddenPrerequisiteDag rejects self-reference (objective lists its own worldObject as prereq)", () => {
  const graph = buildGraph({
    objectives: [
      objective({
        objectiveId: "main_1",
        worldObjectIds: ["o_own"],
        hiddenPrerequisiteObjectIds: ["o_own"],
      }),
    ],
  });
  assert.throws(() => validateHiddenPrerequisiteDag(graph), {
    message: "journey_hidden_prereq_self_reference:main_1:o_own",
  });
});

test("validateHiddenPrerequisiteDag rejects an overdetermined object (1:N ownership in v1)", () => {
  // Same prereq object is the hidden prereq for two distinct objectives.
  // Fixture discipline: o_relic must NOT appear in main_1 or side_1's
  // own worldObjectIds (that would trip the self-reference check first);
  // it must appear in some objective's worldObjectIds to avoid the
  // unknown-object check. The choice_1 objective supplies that grounding.
  const graph = buildGraph({
    objectives: [
      objective({
        objectiveId: "main_1",
        worldObjectIds: ["o_a"],
        hiddenPrerequisiteObjectIds: ["o_relic"],
      }),
      objective({
        objectiveId: "side_1",
        worldObjectIds: ["o_b"],
        hiddenPrerequisiteObjectIds: ["o_relic"],
      }),
      objective({
        objectiveId: "choice_1",
        worldObjectIds: ["o_relic", "o_c"],
      }),
    ],
  });
  assert.throws(() => validateHiddenPrerequisiteDag(graph), {
    message: "journey_hidden_prereq_object_overdetermined:o_relic",
  });
});

test("validateHiddenPrerequisiteDag rejects a 2-cycle (A's prereq in B's worldObjects AND B's prereq in A's worldObjects)", () => {
  const graph = buildGraph({
    objectives: [
      objective({
        objectiveId: "main_1",
        worldObjectIds: ["o_x"],
        hiddenPrerequisiteObjectIds: ["o_y"],
      }),
      objective({
        objectiveId: "main_2",
        worldObjectIds: ["o_y"],
        hiddenPrerequisiteObjectIds: ["o_x"],
      }),
    ],
  });
  assert.throws(() => validateHiddenPrerequisiteDag(graph), {
    message: /^journey_hidden_prereq_cycle:/u,
  });
});

test("validateHiddenPrerequisiteDag rejects a 3-cycle (A→B→C→A in the objective+object graph)", () => {
  // A's prereq object is in B's worldObjects, B's in C's, C's in A's.
  const graph = buildGraph({
    objectives: [
      objective({
        objectiveId: "main_1",
        worldObjectIds: ["o_c"],
        hiddenPrerequisiteObjectIds: ["o_a"],
      }),
      objective({
        objectiveId: "main_2",
        worldObjectIds: ["o_a"],
        hiddenPrerequisiteObjectIds: ["o_b"],
      }),
      objective({
        objectiveId: "main_3",
        worldObjectIds: ["o_b"],
        hiddenPrerequisiteObjectIds: ["o_c"],
      }),
    ],
  });
  assert.throws(() => validateHiddenPrerequisiteDag(graph), {
    message: /^journey_hidden_prereq_cycle:/u,
  });
});

test("validateHiddenPrerequisiteDag re-rejects overflow on a hand-built graph", () => {
  // Synthesize a graph whose prereqObjectsByObjective exceeds the cap by
  // bypassing buildHiddenPrerequisiteGraph (defence-in-depth for callers
  // that hand-construct the shape).
  const tooMany = Array.from(
    { length: HIDDEN_PREREQ_OBJECT_MAX_PER_OBJECTIVE + 1 },
    (_, index) => `o_${index}`,
  );
  const worldObjectIds = tooMany;
  const graph: HiddenPrerequisiteGraph = {
    regionId: REGION_ID,
    nodes: tooMany.map((prerequisiteObjectId) => ({
      objectiveId: "main_1",
      prerequisiteObjectId,
    })),
    objectivesByPrereqObject: Object.fromEntries(
      tooMany.map((id) => [id, ["main_1"]]),
    ),
    prereqObjectsByObjective: { main_1: tooMany },
    worldObjectsByObjective: { main_1: worldObjectIds },
    knownObjectIds: new Set(tooMany),
    knownObjectiveIds: new Set(["main_1"]),
  };
  assert.throws(() => validateHiddenPrerequisiteDag(graph), {
    message: "journey_hidden_prereq_object_overflow:main_1",
  });
});

// ---------------------------------------------------------------------------
// applyObjectMutation
// ---------------------------------------------------------------------------

test("applyObjectMutation throws on unknown object id (fail-closed)", () => {
  const { graph } = acyclicTwoObjectiveSetup();
  const projection = emptyHiddenPrerequisiteProjection(REGION_ID);
  assert.throws(
    () =>
      applyObjectMutation({
        graph,
        projection,
        objectId: "object_phantom",
        degree: 3,
        actionEventId: ACTION_EVENT_ID,
        observedAt: OBSERVED_AT,
      }),
    { message: "journey_hidden_prereq_object_unreferenced:object_phantom" },
  );
});

test("applyObjectMutation throws on invalid degree (fail-closed)", () => {
  const { graph } = acyclicTwoObjectiveSetup();
  const projection = emptyHiddenPrerequisiteProjection(REGION_ID);
  assert.throws(
    () =>
      applyObjectMutation({
        graph,
        projection,
        objectId: "object_relic",
        degree: 0,
        actionEventId: ACTION_EVENT_ID,
        observedAt: OBSERVED_AT,
      }),
    { message: "journey_task_object_impact_degree_invalid" },
  );
});

test("applyObjectMutation throws on region mismatch between graph and projection", () => {
  const { graph } = acyclicTwoObjectiveSetup();
  const projection = emptyHiddenPrerequisiteProjection(OTHER_REGION_ID);
  assert.throws(
    () =>
      applyObjectMutation({
        graph,
        projection,
        objectId: "object_relic",
        degree: 3,
        actionEventId: ACTION_EVENT_ID,
        observedAt: OBSERVED_AT,
      }),
    { message: `journey_hidden_prereq_region_mismatch:${OTHER_REGION_ID}:${REGION_ID}` },
  );
});

test("applyObjectMutation marks a hidden prereq as degraded (degree 2) without destroying it", () => {
  const { graph, objectiveAId, sharedObjectId } = acyclicTwoObjectiveSetup();
  const projection = emptyHiddenPrerequisiteProjection(REGION_ID);
  const result = applyObjectMutation({
    graph,
    projection,
    objectId: sharedObjectId,
    degree: 2,
    actionEventId: ACTION_EVENT_ID,
    observedAt: OBSERVED_AT,
  });

  assert.equal(result.changed, true);

  // Object-state entry.
  const updatedObject = lookupObjectStatus(result.projectionAfter, sharedObjectId);
  assert.deepEqual(updatedObject, {
    status: "degraded",
    degree: 2,
    sourceActionEventId: ACTION_EVENT_ID,
    changedAt: OBSERVED_AT,
  });

  // Exactly one link mutated (objectiveA depends on sharedObjectId).
  assert.equal(result.mutatedLinks.length, 1);
  const link = result.mutatedLinks[0];
  assert.equal(link?.objectiveId, objectiveAId);
  assert.equal(link?.prerequisiteObjectId, sharedObjectId);
  assert.equal(link?.status, "degraded");
  assert.equal(link?.degradedAtActionEventId, ACTION_EVENT_ID);
  assert.equal(link?.destroyedAtActionEventId, undefined);
  assert.equal(link?.observedAt, OBSERVED_AT);

  // Canonical intents: one object-state + one link-changed.
  assert.equal(result.canonicalIntents.length, 2);
  const objectIntent = result.canonicalIntents.find(
    (intent): intent is Extract<CanonicalObjectStateIntent, { kind: "world_object_state_changed" }> =>
      intent.kind === "world_object_state_changed",
  );
  const linkIntent = result.canonicalIntents.find(
    (intent): intent is Extract<CanonicalObjectStateIntent, { kind: "hidden_prerequisite_link_changed" }> =>
      intent.kind === "hidden_prerequisite_link_changed",
  );
  assert.deepEqual(objectIntent, {
    kind: "world_object_state_changed",
    regionId: REGION_ID,
    objectId: sharedObjectId,
    statusAfter: "degraded",
    degree: 2,
    sourceActionEventId: ACTION_EVENT_ID,
    changedAt: OBSERVED_AT,
  });
  assert.deepEqual(linkIntent, {
    kind: "hidden_prerequisite_link_changed",
    regionId: REGION_ID,
    objectiveId: objectiveAId,
    prerequisiteObjectId: sharedObjectId,
    statusAfter: "degraded",
    sourceActionEventId: ACTION_EVENT_ID,
    changedAt: OBSERVED_AT,
  });
});

test("applyObjectMutation marks a hidden prereq as destroyed (degree 3) and emits both intents", () => {
  const { graph, objectiveAId, sharedObjectId } = acyclicTwoObjectiveSetup();
  const projection = emptyHiddenPrerequisiteProjection(REGION_ID);
  const result = applyObjectMutation({
    graph,
    projection,
    objectId: sharedObjectId,
    degree: 3,
    actionEventId: ACTION_EVENT_ID,
    observedAt: OBSERVED_AT,
  });

  const updatedObject = lookupObjectStatus(result.projectionAfter, sharedObjectId);
  assert.equal(updatedObject?.status, "destroyed");
  assert.equal(updatedObject?.degree, 3);

  const link = result.mutatedLinks[0];
  assert.equal(link?.status, "destroyed");
  assert.equal(link?.destroyedAtActionEventId, ACTION_EVENT_ID);
  assert.equal(link?.degradedAtActionEventId, undefined);

  const linkIntent = result.canonicalIntents.find(
    (intent): intent is Extract<CanonicalObjectStateIntent, { kind: "hidden_prerequisite_link_changed" }> =>
      intent.kind === "hidden_prerequisite_link_changed",
  );
  assert.equal(linkIntent?.statusAfter, "destroyed");
  assert.equal(linkIntent?.objectiveId, objectiveAId);
});

test("applyObjectMutation allows the chain intact → degraded → destroyed", () => {
  const { graph, sharedObjectId } = acyclicTwoObjectiveSetup();
  let projection: HiddenPrerequisiteProjection = emptyHiddenPrerequisiteProjection(REGION_ID);

  projection = applyObjectMutation({
    graph,
    projection,
    objectId: sharedObjectId,
    degree: 2,
    actionEventId: ACTION_EVENT_ID,
    observedAt: OBSERVED_AT,
  }).projectionAfter;

  projection = applyObjectMutation({
    graph,
    projection,
    objectId: sharedObjectId,
    degree: 5,
    actionEventId: OTHER_ACTION_EVENT_ID,
    observedAt: LATER_OBSERVED_AT,
  }).projectionAfter;

  const finalObject = lookupObjectStatus(projection, sharedObjectId);
  assert.equal(finalObject?.status, "destroyed");
  assert.equal(finalObject?.degree, 5);
  assert.equal(finalObject?.sourceActionEventId, OTHER_ACTION_EVENT_ID);

  // The final link preserves the destroyed event id and observedAt.
  const link = lookupHiddenPrerequisiteLink(projection, "main_1", sharedObjectId);
  assert.equal(link?.status, "destroyed");
  assert.equal(link?.destroyedAtActionEventId, OTHER_ACTION_EVENT_ID);
  // Prior degraded event id is preserved on the destroyed record (audit trail).
  assert.equal(link?.degradedAtActionEventId, ACTION_EVENT_ID);
  assert.equal(link?.observedAt, LATER_OBSERVED_AT);
});

test("applyObjectMutation allows degraded → degraded with monotonic non-decreasing degree", () => {
  const { graph, sharedObjectId } = acyclicTwoObjectiveSetup();
  let projection: HiddenPrerequisiteProjection = emptyHiddenPrerequisiteProjection(REGION_ID);

  projection = applyObjectMutation({
    graph,
    projection,
    objectId: sharedObjectId,
    degree: 1,
    actionEventId: ACTION_EVENT_ID,
    observedAt: OBSERVED_AT,
  }).projectionAfter;

  const result = applyObjectMutation({
    graph,
    projection,
    objectId: sharedObjectId,
    degree: 2,
    actionEventId: OTHER_ACTION_EVENT_ID,
    observedAt: LATER_OBSERVED_AT,
  });

  assert.equal(result.changed, true);
  const finalObject = lookupObjectStatus(result.projectionAfter, sharedObjectId);
  assert.equal(finalObject?.status, "degraded");
  assert.equal(finalObject?.degree, 2);
});

test("applyObjectMutation rejects a non-monotonic degree on an already-degraded object", () => {
  const { graph, sharedObjectId } = acyclicTwoObjectiveSetup();
  let projection: HiddenPrerequisiteProjection = emptyHiddenPrerequisiteProjection(REGION_ID);
  projection = applyObjectMutation({
    graph,
    projection,
    objectId: sharedObjectId,
    degree: 2,
    actionEventId: ACTION_EVENT_ID,
    observedAt: OBSERVED_AT,
  }).projectionAfter;

  assert.throws(
    () =>
      applyObjectMutation({
        graph,
        projection,
        objectId: sharedObjectId,
        degree: 1, // less than current degree 2
        actionEventId: OTHER_ACTION_EVENT_ID,
        observedAt: LATER_OBSERVED_AT,
      }),
    { message: `journey_world_object_state_transition_invalid:${sharedObjectId}` },
  );
});

test("applyObjectMutation rejects any attempt to relax a destroyed object back to degraded", () => {
  const { graph, sharedObjectId } = acyclicTwoObjectiveSetup();
  let projection: HiddenPrerequisiteProjection = emptyHiddenPrerequisiteProjection(REGION_ID);
  projection = applyObjectMutation({
    graph,
    projection,
    objectId: sharedObjectId,
    degree: 3,
    actionEventId: ACTION_EVENT_ID,
    observedAt: OBSERVED_AT,
  }).projectionAfter;

  assert.throws(
    () =>
      applyObjectMutation({
        graph,
        projection,
        objectId: sharedObjectId,
        degree: 2,
        actionEventId: OTHER_ACTION_EVENT_ID,
        observedAt: LATER_OBSERVED_AT,
      }),
    { message: `journey_world_object_state_transition_invalid:${sharedObjectId}` },
  );
});

test("applyObjectMutation treats destroyed→destroyed as idempotent (no intents re-emitted, first destroyer wins)", () => {
  const { graph, sharedObjectId } = acyclicTwoObjectiveSetup();
  let projection: HiddenPrerequisiteProjection = emptyHiddenPrerequisiteProjection(REGION_ID);

  const firstResult = applyObjectMutation({
    graph,
    projection,
    objectId: sharedObjectId,
    degree: 3,
    actionEventId: ACTION_EVENT_ID,
    observedAt: OBSERVED_AT,
  });
  projection = firstResult.projectionAfter;

  const replayResult = applyObjectMutation({
    graph,
    projection,
    objectId: sharedObjectId,
    degree: 5, // higher degree but still destroyed
    actionEventId: OTHER_ACTION_EVENT_ID,
    observedAt: LATER_OBSERVED_AT,
  });

  // No new canonical intents — destroyed is idempotent.
  assert.equal(replayResult.changed, false);
  assert.equal(replayResult.canonicalIntents.length, 0);
  // First destroyer's event id wins.
  const finalObject = lookupObjectStatus(replayResult.projectionAfter, sharedObjectId);
  assert.equal(finalObject?.sourceActionEventId, ACTION_EVENT_ID);
  assert.equal(finalObject?.degree, 3);
});

test("applyObjectMutation handles an object that is in knownObjectIds but is no hidden prereq (no links mutated)", () => {
  // object_altar is in B's worldObjectIds but is NOT a hidden prereq for
  // anyone — destroying it should update the object-state entry without
  // mutating any link.
  const { graph } = acyclicTwoObjectiveSetup();
  const projection = emptyHiddenPrerequisiteProjection(REGION_ID);
  const result = applyObjectMutation({
    graph,
    projection,
    objectId: "object_altar",
    degree: 4,
    actionEventId: ACTION_EVENT_ID,
    observedAt: OBSERVED_AT,
  });

  assert.equal(result.mutatedLinks.length, 0);
  assert.equal(result.canonicalIntents.length, 1);
  assert.equal(result.canonicalIntents[0]?.kind, "world_object_state_changed");
  const updated = lookupObjectStatus(result.projectionAfter, "object_altar");
  assert.equal(updated?.status, "destroyed");
});

test("applyObjectMutation rejects empty actionEventId and observedAt", () => {
  const { graph, sharedObjectId } = acyclicTwoObjectiveSetup();
  const projection = emptyHiddenPrerequisiteProjection(REGION_ID);
  assert.throws(
    () =>
      applyObjectMutation({
        graph,
        projection,
        objectId: sharedObjectId,
        degree: 3,
        actionEventId: "",
        observedAt: OBSERVED_AT,
      }),
    { message: "journey_hidden_prereq_action_event_id_empty" },
  );
  assert.throws(
    () =>
      applyObjectMutation({
        graph,
        projection,
        objectId: sharedObjectId,
        degree: 3,
        actionEventId: ACTION_EVENT_ID,
        observedAt: "",
      }),
    { message: "journey_hidden_prereq_observed_at_empty" },
  );
});

// ---------------------------------------------------------------------------
// hiddenStatusForFutureJourney + isHiddenObjectiveReachable
// ---------------------------------------------------------------------------

test("hiddenStatusForFutureJourney returns reachable=true when the prereq is intact (default)", () => {
  const { graph, objectiveAId, sharedObjectId } = acyclicTwoObjectiveSetup();
  const projection = emptyHiddenPrerequisiteProjection(REGION_ID);
  const adjudications = hiddenStatusForFutureJourney({
    graph,
    projection,
    objectiveId: objectiveAId,
  });
  assert.equal(adjudications.length, 1);
  assert.equal(adjudications[0]?.prerequisiteObjectId, sharedObjectId);
  assert.equal(adjudications[0]?.status, "intact");
  assert.equal(adjudications[0]?.reachable, true);
  assert.equal(adjudications[0]?.degree, 0);
});

test("hiddenStatusForFutureJourney returns reachable=false after the prereq is destroyed", () => {
  const { graph, objectiveAId, sharedObjectId } = acyclicTwoObjectiveSetup();
  const projection = solidifyObjectMutation({
    graph,
    projection: emptyHiddenPrerequisiteProjection(REGION_ID),
    objectId: sharedObjectId,
    degree: 3,
    actionEventId: ACTION_EVENT_ID,
    observedAt: OBSERVED_AT,
  });

  const adjudications = hiddenStatusForFutureJourney({
    graph,
    projection,
    objectiveId: objectiveAId,
  });
  assert.equal(adjudications.length, 1);
  assert.equal(adjudications[0]?.status, "destroyed");
  assert.equal(adjudications[0]?.reachable, false);
  assert.equal(adjudications[0]?.sourceActionEventId, ACTION_EVENT_ID);
  assert.equal(adjudications[0]?.changedAt, OBSERVED_AT);
});

test("hiddenStatusForFutureJourney returns reachable=true when the prereq is merely degraded", () => {
  const { graph, objectiveAId, sharedObjectId } = acyclicTwoObjectiveSetup();
  const projection = solidifyObjectMutation({
    graph,
    projection: emptyHiddenPrerequisiteProjection(REGION_ID),
    objectId: sharedObjectId,
    degree: 2,
    actionEventId: ACTION_EVENT_ID,
    observedAt: OBSERVED_AT,
  });

  const adjudications = hiddenStatusForFutureJourney({
    graph,
    projection,
    objectiveId: objectiveAId,
  });
  assert.equal(adjudications[0]?.status, "degraded");
  assert.equal(adjudications[0]?.reachable, true);
  assert.equal(adjudications[0]?.degree, 2);
});

test("hiddenStatusForFutureJourney returns an empty array for an objective with no hidden prereqs", () => {
  const { graph, objectiveBId } = acyclicTwoObjectiveSetup();
  const projection = emptyHiddenPrerequisiteProjection(REGION_ID);
  const adjudications = hiddenStatusForFutureJourney({
    graph,
    projection,
    objectiveId: objectiveBId,
  });
  assert.deepEqual(adjudications, []);
});

test("hiddenStatusForFutureJourney rejects a region mismatch", () => {
  const { graph, objectiveAId } = acyclicTwoObjectiveSetup();
  const projection = emptyHiddenPrerequisiteProjection(OTHER_REGION_ID);
  assert.throws(
    () =>
      hiddenStatusForFutureJourney({
        graph,
        projection,
        objectiveId: objectiveAId,
      }),
    { message: `journey_hidden_prereq_region_mismatch:${OTHER_REGION_ID}:${REGION_ID}` },
  );
});

test("isHiddenObjectiveReachable is true when intact / degraded and false when destroyed", () => {
  const { graph, objectiveAId, sharedObjectId } = acyclicTwoObjectiveSetup();
  const intactProjection = emptyHiddenPrerequisiteProjection(REGION_ID);
  assert.equal(
    isHiddenObjectiveReachable({ graph, projection: intactProjection, objectiveId: objectiveAId }),
    true,
  );

  const degradedProjection = solidifyObjectMutation({
    graph,
    projection: intactProjection,
    objectId: sharedObjectId,
    degree: 1,
    actionEventId: ACTION_EVENT_ID,
    observedAt: OBSERVED_AT,
  });
  assert.equal(
    isHiddenObjectiveReachable({ graph, projection: degradedProjection, objectiveId: objectiveAId }),
    true,
  );

  const destroyedProjection = solidifyObjectMutation({
    graph,
    projection: degradedProjection,
    objectId: sharedObjectId,
    degree: 3,
    actionEventId: OTHER_ACTION_EVENT_ID,
    observedAt: LATER_OBSERVED_AT,
  });
  assert.equal(
    isHiddenObjectiveReachable({ graph, projection: destroyedProjection, objectiveId: objectiveAId }),
    false,
  );
});

test("isHiddenObjectiveReachable is trivially true for an objective with no hidden prereqs", () => {
  const { graph, objectiveBId } = acyclicTwoObjectiveSetup();
  const projection = emptyHiddenPrerequisiteProjection(REGION_ID);
  assert.equal(
    isHiddenObjectiveReachable({ graph, projection, objectiveId: objectiveBId }),
    true,
  );
});

// ---------------------------------------------------------------------------
// Solidify vs discard semantics (spec §6.10 + spec §14 discard-finality)
// ---------------------------------------------------------------------------

test("solidifyObjectMutation writes destroyed state into the canonical projection", () => {
  const { graph, sharedObjectId, objectiveAId } = acyclicTwoObjectiveSetup();
  const before = emptyHiddenPrerequisiteProjection(REGION_ID);
  const after = solidifyObjectMutation({
    graph,
    projection: before,
    objectId: sharedObjectId,
    degree: 3,
    actionEventId: ACTION_EVENT_ID,
    observedAt: OBSERVED_AT,
  });

  assert.notDeepEqual(before, after);
  assert.equal(lookupObjectStatus(after, sharedObjectId)?.status, "destroyed");
  assert.equal(
    lookupHiddenPrerequisiteLink(after, objectiveAId, sharedObjectId)?.status,
    "destroyed",
  );
});

test("discardObjectMutation is an identity on the projection (a discarded journey NEVER reaches canonical state)", () => {
  // PR5c regression assertion (spec §6.10 discard finality): a discard-only
  // path leaves the canonical projection's worldObjectState untouched. The
  // caller does not call applyObjectMutation at all on the discard path;
  // discardObjectMutation documents that no-op as an explicit return so
  // the solidify/discard branch is obvious in caller code.
  const { graph, sharedObjectId } = acyclicTwoObjectiveSetup();
  const projection = emptyHiddenPrerequisiteProjection(REGION_ID);
  const discarded = discardObjectMutation({ projection });
  assert.deepEqual(discarded, projection);
  // Discard must not have written any object state, even when the caller
  // had a pending mutation intent.
  assert.equal(lookupObjectStatus(discarded, sharedObjectId), undefined);

  // Belt-and-braces: applying a SOLIDIFY after the discard still works as
  // if the discard never happened (no side effects leaked).
  const solidified = solidifyObjectMutation({
    graph,
    projection: discarded,
    objectId: sharedObjectId,
    degree: 4,
    actionEventId: OTHER_ACTION_EVENT_ID,
    observedAt: LATER_OBSERVED_AT,
  });
  assert.equal(lookupObjectStatus(solidified, sharedObjectId)?.status, "destroyed");
  assert.equal(lookupObjectStatus(solidified, sharedObjectId)?.sourceActionEventId, OTHER_ACTION_EVENT_ID);
});

test("solidify/discard asymmetry: identical mutation intent, opposite canonical effects", () => {
  const { graph, sharedObjectId } = acyclicTwoObjectiveSetup();
  const baseline = emptyHiddenPrerequisiteProjection(REGION_ID);

  const solidified = solidifyObjectMutation({
    graph,
    projection: baseline,
    objectId: sharedObjectId,
    degree: 3,
    actionEventId: ACTION_EVENT_ID,
    observedAt: OBSERVED_AT,
  });
  const discarded = discardObjectMutation({ projection: baseline });

  assert.equal(lookupObjectStatus(solidified, sharedObjectId)?.status, "destroyed");
  assert.equal(lookupObjectStatus(discarded, sharedObjectId), undefined);
});

// ---------------------------------------------------------------------------
// Cross-region namespacing (§14 out-of-scope but key shape locked in)
// ---------------------------------------------------------------------------

test("cross-region projections do not collide on the same prerequisiteObjectId", () => {
  // Two regions each with their own graph + projection. Destroying the
  // prereq in region A MUST NOT surface in region B's projection — the
  // region-scoped projection + region-prefixed link key keep them disjoint.
  const regionAGraph = buildGraph({
    regionId: REGION_ID,
    objectives: [
      objective({
        objectiveId: "main_1",
        worldObjectIds: ["o_relic"],
        hiddenPrerequisiteObjectIds: ["o_relic"],
      }),
    ],
  });
  const regionBGraph = buildGraph({
    regionId: OTHER_REGION_ID,
    objectives: [
      objective({
        objectiveId: "main_1",
        worldObjectIds: ["o_relic"],
        hiddenPrerequisiteObjectIds: ["o_relic"],
      }),
    ],
  });

  const regionAProjection = solidifyObjectMutation({
    graph: regionAGraph,
    projection: emptyHiddenPrerequisiteProjection(REGION_ID),
    objectId: "o_relic",
    degree: 3,
    actionEventId: ACTION_EVENT_ID,
    observedAt: OBSERVED_AT,
  });

  // Region B's projection is untouched by region A's destruction.
  const regionBProjection = emptyHiddenPrerequisiteProjection(OTHER_REGION_ID);
  assert.equal(lookupObjectStatus(regionAProjection, "o_relic")?.status, "destroyed");
  assert.equal(lookupObjectStatus(regionBProjection, "o_relic"), undefined);

  // Region B's adjudication is still reachable.
  assert.equal(
    isHiddenObjectiveReachable({
      graph: regionBGraph,
      projection: regionBProjection,
      objectiveId: "main_1",
    }),
    true,
  );
  // Region A's adjudication is unreachable.
  assert.equal(
    isHiddenObjectiveReachable({
      graph: regionAGraph,
      projection: regionAProjection,
      objectiveId: "main_1",
    }),
    false,
  );

  // Link keys embed regionId so they cannot collide across projections.
  const regionAKey = hiddenPrereqLinkKey(REGION_ID, "main_1", "o_relic");
  const regionBKey = hiddenPrereqLinkKey(OTHER_REGION_ID, "main_1", "o_relic");
  assert.notEqual(regionAKey, regionBKey);
});

// ---------------------------------------------------------------------------
// End-to-end integration scenario
// ---------------------------------------------------------------------------

test("integration: destroy prereq in journey A → next journey reads digest and gates reachability", () => {
  // Journey A: agent destroys the shared prereq object.
  const { graph, objectiveAId, sharedObjectId } = acyclicTwoObjectiveSetup();
  const afterJourneyA = solidifyObjectMutation({
    graph,
    projection: emptyHiddenPrerequisiteProjection(REGION_ID),
    objectId: sharedObjectId,
    degree: 4,
    actionEventId: ACTION_EVENT_ID,
    observedAt: OBSERVED_AT,
  });

  // Journey B (same region): the next journey's planner reads
  // hiddenStatusForFutureJourney before offering the hidden objective.
  // The destroyed prereq surfaces as reachable=false, so the next journey's
  // planner refuses to ground on the destroyed object — spec §6.10's
  // 持久作用域 loop is closed without any delayed-event queue.
  const adjudication = hiddenStatusForFutureJourney({
    graph,
    projection: afterJourneyA,
    objectiveId: objectiveAId,
  });
  assert.equal(adjudication.length, 1);
  assert.equal(adjudication[0]?.reachable, false);
  assert.equal(adjudication[0]?.status, "destroyed");
  assert.equal(adjudication[0]?.sourceActionEventId, ACTION_EVENT_ID);

  // And the convenience wrapper agrees.
  assert.equal(
    isHiddenObjectiveReachable({
      graph,
      projection: afterJourneyA,
      objectiveId: objectiveAId,
    }),
    false,
  );
});

test("integration: replaying the same destruction is idempotent across solidify calls (single-derivation)", () => {
  // Replay determinism — calling solidifyObjectMutation twice with the
  // same arguments produces a projection that is bit-identical to a
  // single call. This is what the mirror-ledger's appendMirrorConsequence
  // composite-key idempotency guarantees downstream; this test asserts
  // the projection-side equivalent.
  const { graph, sharedObjectId } = acyclicTwoObjectiveSetup();
  const baseline = emptyHiddenPrerequisiteProjection(REGION_ID);

  const once = solidifyObjectMutation({
    graph,
    projection: baseline,
    objectId: sharedObjectId,
    degree: 3,
    actionEventId: ACTION_EVENT_ID,
    observedAt: OBSERVED_AT,
  });
  const twice = solidifyObjectMutation({
    graph,
    projection: once,
    objectId: sharedObjectId,
    degree: 3,
    actionEventId: REPLAY_ACTION_EVENT_ID,
    observedAt: OBSERVED_AT,
  });

  // First destroyer wins on sourceActionEventId / degree.
  assert.deepEqual(lookupObjectStatus(twice, sharedObjectId), {
    status: "destroyed",
    degree: 3,
    sourceActionEventId: ACTION_EVENT_ID,
    changedAt: OBSERVED_AT,
  });
});
