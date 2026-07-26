/**
 * hiddenPrerequisiteRules.ts — PR5c hidden prerequisite graph model.
 *
 * Pure data + pure functions. No gameCore / eventFactory imports. The module
 * reads PR1's {@link HiddenPrerequisiteLink} interface (frozen, lives in
 * journeyRoleplayRules.ts:174) and produces new link records + canonical
 * object-state intents that the solidify integration (separate PR) writes
 * into the canonical projection.
 *
 * Scope (spec §6.10 + §14):
 * - Immediate object destruction → hidden prerequisite status change.
 * - Future journey reads canonical object digest to gate hidden objective
 *   reachability.
 * - NO delayed consequences, NO timers, NO cross-journey callback queues
 *   (§14 out-of-scope). The only mechanism is "the next journey's planner
 *   refuses to ground on destroyed objects" (handled by the caller reading
 *   {@link HiddenPrerequisiteProjection.worldObjectStates} at plan-generation
 *   time).
 *
 * Zero-affinity (零加成):
 * - Module emits ONLY internal records (HiddenPrerequisiteLink + canonical
 *   intents). Every field this module produces is INTERNAL-only. Public
 *   serializers (PublicActionOption / PublicQuestOffer) are the integration
 *   layer's responsibility and MUST strip every field this module produces.
 *   The caller MUST route every public path through a single
 *   `stripInternalActionFields` helper (enforced structurally at the
 *   integration layer, not here).
 *
 * Irreversibility (spec §6.10 + §14):
 * - First version: once a canonical `world_object_state_changed` intent lands
 *   an object in status `destroyed`, no later intent may move it back. The
 *   {@link applyObjectMutation} helper throws
 *   `journey_world_object_state_transition_invalid` on any attempt to relax
 *   a destroyed state. `degraded → destroyed` is allowed; `degraded →
 *   degraded` (further degradation) is allowed but `degree` is monotonic
 *   non-decreasing. No repair action exists in v2.2 (§14 out-of-scope);
 *   adding one requires a schema-version bump of HiddenPrerequisiteLink
 *   (PR1-owned interface change — coordinated bump).
 *
 * Region namespacing (cross-region §14 out-of-scope):
 * - The hidden-prerequisite link key is `${regionId}:${objectiveId}:${prerequisiteObjectId}`
 *   from day one. v2.2 is single-agent + same-region, so cross-region
 *   propagation is out-of-scope, but the key shape MUST include regionId
 *   now so a future cross-region PR does not require migrating persisted
 *   canonical state.
 */

import type {
  HiddenPrerequisiteLink,
  HiddenPrerequisiteStatus,
} from "./journeyRoleplayRules.ts";

// ---------------------------------------------------------------------------
// Versioned constants — bumping ANY of these MUST bump HIDDEN_PREREQ_POLICY_VERSION.
// ---------------------------------------------------------------------------

/**
 * Degree threshold at which an object is considered destroyed rather than
 * merely degraded. Co-versioned with {@link HIDDEN_PREREQ_POLICY_VERSION};
 * changing this number requires migrating persisted canonical state and
 * recalibrating the §13 simulation harness against the collateral floor
 * (a destroyed object cascades into hidden_prerequisite_destroyed at
 * -1500 bps in journeyConsequenceScoring.ts:102, so a miscalibrated
 * threshold produces harsh penalties for marginal effects).
 *
 * Spec §6.10: degree 1-2 = degraded (still usable), degree 3+ = destroyed
 * (irreversible per spec §14 out-of-scope for repair).
 */
export const OBJECT_DESTROY_DEGREE_THRESHOLD = 3 as const;

/** Minimum integer value for `objectImpact.degree` (spec §6.10). */
export const HIDDEN_PREREQ_DEGREE_MIN = 1 as const;

/** Maximum integer value for `objectImpact.degree` (spec §6.10). */
export const HIDDEN_PREREQ_DEGREE_MAX = 5 as const;

/**
 * Cap on `|hiddenPrerequisiteObjectIds|` per objective. Bounds DAG-validation
 * cost to O(n²+e) worst case. Mirrors the existing prerequisiteObjectiveIds
 * cap of 8 (journeyGeneratedTaskRules.ts:726) at half the size since object
 * prereqs tend to be sparser than objective-to-objective prereqs.
 */
export const HIDDEN_PREREQ_OBJECT_MAX_PER_OBJECTIVE = 4 as const;

/**
 * Policy version for the hidden-prerequisite adjudication algorithm. Bumping
 * any constant above (or the link-key shape) MUST bump this version so
 * persisted canonical state can be migrated. Calibrated alongside
 * CONSEQUENCE_SCORE_POLICY_VERSION (journeyConsequenceScoring.ts) so a
 * threshold bump and a collateral-weight bump land together.
 */
export const HIDDEN_PREREQ_POLICY_VERSION = 1 as const;

// ---------------------------------------------------------------------------
// Data types
// ---------------------------------------------------------------------------

/**
 * Per-objective hidden prerequisite input — the shape plan-generation passes
 * to {@link buildHiddenPrerequisiteGraph}. Structurally compatible with
 * `JourneyGeneratedTaskObjective` once PR5c extends it with
 * `hiddenPrerequisiteObjectIds`. Kept as an explicit input type so this
 * module stays independent of the full JourneyGeneratedTaskObjective field
 * set (which is owned by journeyGeneratedTaskRules.ts and frozen by PR1).
 */
export interface HiddenPrerequisiteObjectiveInput {
  readonly objectiveId: string;
  /** World objects this objective references (its `worldObjectIds`). */
  readonly worldObjectIds: readonly string[];
  /**
   * World objects whose existence is required for this objective to remain
   * reachable as a hidden requirement. DISJOINT from
   * `prerequisiteObjectiveIds` (the existing objective-to-objective DAG at
   * journeyGeneratedTaskRules.ts:110) — the two graphs are validated
   * independently and may overlap without coupling.
   */
  readonly hiddenPrerequisiteObjectIds?: readonly string[];
}

/** Edge in the hidden-prerequisite graph: objective → prerequisite object. */
export interface HiddenPrerequisiteNode {
  readonly objectiveId: string;
  readonly prerequisiteObjectId: string;
}

/**
 * Hidden-prerequisite graph derived from a plan. Pure data; all indexes are
 * derived from {@link nodes} so the graph is stable across serialisation.
 */
export interface HiddenPrerequisiteGraph {
  /** Region this graph is namespaced under (cross-region §14 out-of-scope). */
  readonly regionId: string;
  /** Edge set: (objectiveId, prerequisiteObjectId). Insertion-stable order. */
  readonly nodes: readonly HiddenPrerequisiteNode[];
  /** Index: prerequisiteObjectId → list of objectiveIds depending on it. */
  readonly objectivesByPrereqObject: Readonly<Record<string, readonly string[]>>;
  /** Index: objectiveId → list of prerequisiteObjectIds it depends on. */
  readonly prereqObjectsByObjective: Readonly<Record<string, readonly string[]>>;
  /** Index: objectiveId → its declared `worldObjectIds`. */
  readonly worldObjectsByObjective: Readonly<Record<string, readonly string[]>>;
  /** Set of all object ids referenced by any objective's `worldObjectIds`. */
  readonly knownObjectIds: ReadonlySet<string>;
  /** Set of all objective ids referenced in the graph. */
  readonly knownObjectiveIds: ReadonlySet<string>;
}

/**
 * Canonical world-object state entry stored in the projection. Populated
 * ONLY by canonical intents (solidify path), never by mirror-ledger entries
 * directly. This is the 持久作用域 (canonical scope) mandated by spec §6.10.
 */
export interface CanonicalWorldObjectState {
  readonly status: HiddenPrerequisiteStatus;
  /** Integer in [1,5]. Monotonic non-decreasing under repeated mutations. */
  readonly degree: number;
  /** Action event that produced the most recent transition. */
  readonly sourceActionEventId?: string;
  /** ISO timestamp the most recent transition was recorded. */
  readonly changedAt?: string;
}

/**
 * Slice of the canonical projection owned by this module. Both indexes are
 * populated ONLY by canonical intents (solidify path). The mirror ledger
 * writes to these via the solidify integration, never directly.
 *
 * Projection-growth GC: in long-running regions, dead links (referenced
 * only by archived plans) accumulate. v2.2 ships without GC; the caller
 * is responsible for evicting entries whose owning plans are no longer
 * active. Documented here so the policy is obvious when state is dropped.
 */
export interface HiddenPrerequisiteProjection {
  readonly regionId: string;
  /**
   * Map: objectId → its canonical state. Keyed WITHOUT region prefix (the
   * projection itself is region-scoped, so prefixing would be redundant).
   */
  readonly worldObjectStates: Readonly<Record<string, CanonicalWorldObjectState>>;
  /**
   * Map: `${regionId}:${objectiveId}:${prerequisiteObjectId}` → link record.
   * The region prefix on the key is intentional: future cross-region work
   * (§14 out-of-scope in v2.2) can lift the projection-scope without
   * re-keying existing entries.
   */
  readonly hiddenPrerequisiteLinks: Readonly<Record<string, HiddenPrerequisiteLink>>;
}

/**
 * Discriminated union describing canonical events the solidify integration
 * MUST emit after {@link applyObjectMutation} returns. The integration layer
 * translates each intent into the matching EpochEvent shape; this module
 * does not construct EpochEvents (preserving the pure-function boundary).
 */
export type CanonicalObjectStateIntent =
  | {
      readonly kind: "world_object_state_changed";
      readonly regionId: string;
      readonly objectId: string;
      readonly statusAfter: HiddenPrerequisiteStatus;
      readonly degree: number;
      readonly sourceActionEventId: string;
      readonly changedAt: string;
    }
  | {
      readonly kind: "hidden_prerequisite_link_changed";
      readonly regionId: string;
      readonly objectiveId: string;
      readonly prerequisiteObjectId: string;
      readonly statusAfter: HiddenPrerequisiteStatus;
      readonly sourceActionEventId: string;
      readonly changedAt: string;
    };

/** Result of {@link applyObjectMutation}. */
export interface ApplyObjectMutationResult {
  readonly projectionAfter: HiddenPrerequisiteProjection;
  /** Hidden-prerequisite links mutated by this call. Empty when the object is not a hidden prereq for any objective. */
  readonly mutatedLinks: readonly HiddenPrerequisiteLink[];
  /** Canonical intents the caller MUST write to the event store. */
  readonly canonicalIntents: readonly CanonicalObjectStateIntent[];
  /**
   * `true` when the call resulted in at least one status transition
   * (object or any link). `false` for idempotent no-ops (e.g. re-applying
   * the same degree to an already-destroyed object with the same
   * actionEventId).
   */
  readonly changed: boolean;
}

/** Per-prereq adjudication result returned by {@link hiddenStatusForFutureJourney}. */
export interface HiddenPrerequisiteAdjudication {
  readonly objectiveId: string;
  readonly prerequisiteObjectId: string;
  /** `false` when the prereq object is destroyed in canonical state. */
  readonly reachable: boolean;
  readonly status: HiddenPrerequisiteStatus;
  readonly degree: number;
  readonly sourceActionEventId?: string;
  readonly changedAt?: string;
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/**
 * Validate that `degree` is an integer in [HIDDEN_PREREQ_DEGREE_MIN,
 * HIDDEN_PREREQ_DEGREE_MAX]. Throws `journey_task_object_impact_degree_invalid`
 * otherwise. `degree = 0` is explicitly forbidden — "no effect" is expressed
 * by the absence of `objectImpact`, not by a zero degree (defence-in-depth
 * against a caller that fabricates an impact record to look complete).
 */
export function assertValidObjectImpactDegree(degree: unknown): asserts degree is number {
  if (typeof degree !== "number" || !Number.isSafeInteger(degree)) {
    throw new Error("journey_task_object_impact_degree_invalid");
  }
  if (degree < HIDDEN_PREREQ_DEGREE_MIN || degree > HIDDEN_PREREQ_DEGREE_MAX) {
    throw new Error("journey_task_object_impact_degree_invalid");
  }
}

/**
 * Map an integer degree to a lifecycle status. Caller MUST have validated
 * `degree` via {@link assertValidObjectImpactDegree} first; this helper
 * performs no validation so it can be inlined in hot paths.
 *
 * - degree 1-2 → `degraded` (still usable).
 * - degree 3-5 → `destroyed` (irreversible per spec §14 out-of-scope for repair).
 */
export function degreeToStatus(degree: number): "degraded" | "destroyed" {
  return degree >= OBJECT_DESTROY_DEGREE_THRESHOLD ? "destroyed" : "degraded";
}

/**
 * Stable key for one hidden-prerequisite link. Shape:
 * `${regionId}:${objectiveId}:${prerequisiteObjectId}`. The region prefix is
 * intentional from day one — see the file header note on cross-region
 * namespacing.
 */
export function hiddenPrereqLinkKey(
  regionId: string,
  objectiveId: string,
  prerequisiteObjectId: string,
): string {
  if (!regionId || !objectiveId || !prerequisiteObjectId) {
    throw new Error("journey_hidden_prereq_link_key_empty_segment");
  }
  return `${regionId}:${objectiveId}:${prerequisiteObjectId}`;
}

/** Return an empty projection slice for one region. */
export function emptyHiddenPrerequisiteProjection(regionId: string): HiddenPrerequisiteProjection {
  if (!regionId) throw new Error("journey_hidden_prereq_region_empty");
  return {
    regionId,
    worldObjectStates: {},
    hiddenPrerequisiteLinks: {},
  };
}

/** Look up an object's canonical state; `undefined` when never recorded. */
export function lookupObjectStatus(
  projection: HiddenPrerequisiteProjection,
  objectId: string,
): CanonicalWorldObjectState | undefined {
  return projection.worldObjectStates[objectId];
}

/** Look up a link by (regionId, objectiveId, prereqObjectId). */
export function lookupHiddenPrerequisiteLink(
  projection: HiddenPrerequisiteProjection,
  objectiveId: string,
  prerequisiteObjectId: string,
): HiddenPrerequisiteLink | undefined {
  return projection.hiddenPrerequisiteLinks[
    hiddenPrereqLinkKey(projection.regionId, objectiveId, prerequisiteObjectId)
  ];
}

// ---------------------------------------------------------------------------
// Graph construction + validation
// ---------------------------------------------------------------------------

/**
 * Build the hidden-prerequisite graph from plan-shaped input. The graph is
 * a 1:1 mapping: each entry in `objective.hiddenPrerequisiteObjectIds`
 * produces one edge from that objective to the prerequisite object.
 *
 * Pure: same inputs → same outputs, including deterministic ordering of
 * {@link nodes} (insertion order: objective order, then prerequisite order).
 * All indexes are derived from {@link nodes} so the graph is stable across
 * serialisation.
 *
 * NOTE: this function does NOT validate the graph — it only constructs it.
 * Call {@link validateHiddenPrerequisiteDag} next to enforce the DAG
 * invariants (unknown-object, self-reference, cycle, overdetermined).
 */
export function buildHiddenPrerequisiteGraph(input: {
  readonly regionId: string;
  readonly objectives: readonly HiddenPrerequisiteObjectiveInput[];
}): HiddenPrerequisiteGraph {
  if (!input.regionId) throw new Error("journey_hidden_prereq_region_empty");
  if (!Array.isArray(input.objectives)) {
    throw new Error("journey_hidden_prereq_objectives_invalid");
  }

  const knownObjectIds = new Set<string>();
  const knownObjectiveIds = new Set<string>();
  const worldObjectsByObjective: Record<string, string[]> = {};
  for (const objective of input.objectives) {
    if (!objective || typeof objective !== "object") {
      throw new Error("journey_hidden_prereq_objective_invalid");
    }
    if (!objective.objectiveId) {
      throw new Error("journey_hidden_prereq_objective_id_empty");
    }
    if (knownObjectiveIds.has(objective.objectiveId)) {
      throw new Error(`journey_hidden_prereq_objective_id_duplicate:${objective.objectiveId}`);
    }
    knownObjectiveIds.add(objective.objectiveId);
    const worldObjectIds: string[] = [];
    for (const objectId of objective.worldObjectIds) {
      if (!objectId) throw new Error("journey_hidden_prereq_world_object_id_empty");
      knownObjectIds.add(objectId);
      worldObjectIds.push(objectId);
    }
    worldObjectsByObjective[objective.objectiveId] = worldObjectIds;
  }

  const nodes: HiddenPrerequisiteNode[] = [];
  const objectivesByPrereqObject: Record<string, string[]> = {};
  const prereqObjectsByObjective: Record<string, string[]> = {};
  for (const objective of input.objectives) {
    const prereqIds = objective.hiddenPrerequisiteObjectIds ?? [];
    if (prereqIds.length > HIDDEN_PREREQ_OBJECT_MAX_PER_OBJECTIVE) {
      throw new Error("journey_hidden_prereq_object_overflow");
    }
    const seenForThisObjective = new Set<string>();
    for (const prereqObjectId of prereqIds) {
      if (!prereqObjectId) {
        throw new Error("journey_hidden_prereq_prereq_object_id_empty");
      }
      if (seenForThisObjective.has(prereqObjectId)) {
        throw new Error(
          `journey_hidden_prereq_prereq_object_duplicate:${objective.objectiveId}:${prereqObjectId}`,
        );
      }
      seenForThisObjective.add(prereqObjectId);
      nodes.push({
        objectiveId: objective.objectiveId,
        prerequisiteObjectId: prereqObjectId,
      });
      (objectivesByPrereqObject[prereqObjectId] ??= []).push(objective.objectiveId);
      (prereqObjectsByObjective[objective.objectiveId] ??= []).push(prereqObjectId);
    }
  }

  return {
    regionId: input.regionId,
    nodes,
    objectivesByPrereqObject,
    prereqObjectsByObjective,
    worldObjectsByObjective,
    knownObjectIds,
    knownObjectiveIds,
  };
}

/**
 * Validate the hidden-prerequisite DAG. Throws on the first violation.
 *
 * Checks (in order):
 *  (a) Overflow: |hiddenPrerequisiteObjectIds| per objective already
 *      enforced at graph-build time; re-checked here for callers that
 *      hand-build a graph.
 *  (b) Unknown prereq object: every `prerequisiteObjectId` is present in
 *      `graph.knownObjectIds` (i.e. declared as a worldObject of some
 *      objective). Throws `journey_hidden_prereq_object_unknown` otherwise.
 *  (c) Self-reference: an objective does not list an entry from its OWN
 *      `worldObjectIds` as a hidden prerequisite. Throws
 *      `journey_hidden_prereq_self_reference`.
 *  (d) Overdetermined: no object is listed as a hidden prereq for more
 *      than one objective within the same plan (1:1 ownership in v1).
 *      Throws `journey_hidden_prereq_object_overdetermined`.
 *  (e) Cycle: in the combined objective+object prereq graph (an edge A→B
 *      exists when A's hidden prereq object is in B's worldObjects, for
 *      any two distinct objectives A and B that both declare hidden
 *      prereqs). Throws `journey_hidden_prereq_cycle`.
 *
 * This validator does NOT check the existing `prerequisiteObjectiveIds`
 * DAG — that is owned by `validateJourneyTaskProposal` in
 * journeyGeneratedTaskRules.ts:910-918 and operates on a disjoint edge set.
 */
export function validateHiddenPrerequisiteDag(graph: HiddenPrerequisiteGraph): void {
  // (a) overflow — re-checked for hand-built graphs.
  for (const [objectiveId, prereqIds] of Object.entries(graph.prereqObjectsByObjective)) {
    if (prereqIds.length > HIDDEN_PREREQ_OBJECT_MAX_PER_OBJECTIVE) {
      throw new Error(`journey_hidden_prereq_object_overflow:${objectiveId}`);
    }
  }

  // (b) unknown prereq objects.
  for (const node of graph.nodes) {
    if (!graph.knownObjectIds.has(node.prerequisiteObjectId)) {
      throw new Error(`journey_hidden_prereq_object_unknown:${node.prerequisiteObjectId}`);
    }
  }

  // (c) self-reference: an objective's hidden prereq is in its OWN worldObjectIds.
  for (const node of graph.nodes) {
    const ownWorldObjects = graph.worldObjectsByObjective[node.objectiveId] ?? [];
    if (ownWorldObjects.includes(node.prerequisiteObjectId)) {
      throw new Error(
        `journey_hidden_prereq_self_reference:${node.objectiveId}:${node.prerequisiteObjectId}`,
      );
    }
  }

  // (d) overdetermined: same prereq object for multiple objectives.
  for (const [prereqObjectId, objectiveIds] of Object.entries(graph.objectivesByPrereqObject)) {
    if (objectiveIds.length > 1) {
      throw new Error(`journey_hidden_prereq_object_overdetermined:${prereqObjectId}`);
    }
  }

  // (e) cycle in the combined objective+object prereq graph.
  // Build an adjacency list: objectiveA → [objectiveB,...] when A's hidden
  // prereq object is in B's worldObjects. Only objectives that themselves
  // declare hidden prereqs participate (a "leaf" objective with no prereqs
  // cannot start a cycle).
  const objectivesWithPrereqs = Object.keys(graph.prereqObjectsByObjective);
  const adjacency: Record<string, string[]> = {};
  for (const aId of objectivesWithPrereqs) {
    adjacency[aId] = [];
    const aPrereqs = graph.prereqObjectsByObjective[aId] ?? [];
    for (const bId of objectivesWithPrereqs) {
      if (bId === aId) continue;
      const bWorldObjects = graph.worldObjectsByObjective[bId] ?? [];
      if (aPrereqs.some((p) => bWorldObjects.includes(p))) {
        adjacency[aId].push(bId);
      }
    }
  }
  // DFS coloring: WHITE=unvisited, GRAY=on stack, BLACK=done.
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color: Record<string, number> = {};
  for (const id of objectivesWithPrereqs) color[id] = WHITE;
  const stack: string[] = [];
  for (const root of objectivesWithPrereqs) {
    if (color[root] !== WHITE) continue;
    stack.push(root);
    while (stack.length > 0) {
      const current = stack[stack.length - 1] as string;
      if (color[current] === WHITE) {
        color[current] = GRAY;
      }
      let advanced = false;
      for (const neighbour of adjacency[current] ?? []) {
        const neighbourColor = color[neighbour] ?? WHITE;
        if (neighbourColor === GRAY) {
          throw new Error(`journey_hidden_prereq_cycle:${current}:${neighbour}`);
        }
        if (neighbourColor === WHITE) {
          stack.push(neighbour);
          advanced = true;
          break;
        }
      }
      if (!advanced) {
        color[current] = BLACK;
        stack.pop();
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Mutation application (solidify path)
// ---------------------------------------------------------------------------

/**
 * Apply an object mutation to the projection. Returns the updated projection
 * slice plus the canonical intents the caller MUST write to the event store.
 *
 * Decision logic (evaluated in order):
 * 1. Validate `degree` via {@link assertValidObjectImpactDegree}.
 * 2. Validate `objectId` is known to the graph; fail-closed with
 *    `journey_hidden_prereq_object_unreferenced` when unknown. This is the
 *    "unknown target/object/effect degree fail closed" contract: an object
 *    id that the graph never saw declared as anyone's hidden prereq is
 *    never silently ignored — the caller has a bug.
 * 3. Compute `statusAfter = degreeToStatus(degree)`.
 * 4. Look up the object's current canonical state. Absent = `intact`
 *    (degree 0).
 * 5. Irreversibility / monotonicity guards:
 *    - If `current.status === 'destroyed'` and `statusAfter === 'degraded'`:
 *      throw `journey_world_object_state_transition_invalid` (destroyed is
 *      terminal).
 *    - If `current.status === 'destroyed'` and `statusAfter === 'destroyed'`:
 *      no-op on the object-state entry (destroyed is idempotent). Links
 *      that already record `status === 'destroyed'` are not re-emitted.
 *    - If `current.status === 'degraded'` and `statusAfter === 'degraded'`:
 *      require `degree >= current.degree`; throw on monotonicity violation.
 *      Equal degree → no-op. Higher degree → update degree.
 *    - If `current.status === 'degraded'` and `statusAfter === 'destroyed'`:
 *      allowed (degraded → destroyed is forward progress).
 *    - If `current.status === 'intact'` (or absent): apply `statusAfter`.
 * 6. Update `worldObjectStates[objectId]`.
 * 7. Scan the graph for every `(objectiveId, prereqObjectId)` edge whose
 *    `prerequisiteObjectId === objectId`. For each affected objective,
 *    refresh the link to the new status (preserving prior event ids when
 *    the new status is a refinement, e.g. degraded→destroyed keeps the
 *    prior `degradedAtActionEventId`).
 * 8. Emit canonical intents: one `world_object_state_changed`, plus one
 *    `hidden_prerequisite_link_changed` per link whose status changed.
 *
 * Pure: same inputs → same outputs. No IO, no gameCore/eventFactory dependency.
 */
export function applyObjectMutation(input: {
  readonly graph: HiddenPrerequisiteGraph;
  readonly projection: HiddenPrerequisiteProjection;
  readonly objectId: string;
  readonly degree: number;
  readonly actionEventId: string;
  readonly observedAt: string;
}): ApplyObjectMutationResult {
  assertValidObjectImpactDegree(input.degree);
  if (!input.objectId) {
    throw new Error("journey_hidden_prereq_object_id_empty");
  }
  if (!input.actionEventId) {
    throw new Error("journey_hidden_prereq_action_event_id_empty");
  }
  if (!input.observedAt) {
    throw new Error("journey_hidden_prereq_observed_at_empty");
  }
  if (input.projection.regionId !== input.graph.regionId) {
    throw new Error(
      `journey_hidden_prereq_region_mismatch:${input.projection.regionId}:${input.graph.regionId}`,
    );
  }

  // Fail-closed: unknown object id.
  if (!input.graph.knownObjectIds.has(input.objectId)) {
    throw new Error(`journey_hidden_prereq_object_unreferenced:${input.objectId}`);
  }

  const statusAfter = degreeToStatus(input.degree);
  const currentEntry = input.projection.worldObjectStates[input.objectId];
  const currentStatus: HiddenPrerequisiteStatus = currentEntry?.status ?? "intact";
  const currentDegree: number = currentEntry?.degree ?? 0;

  let objectChanged = false;
  let nextObjectEntry: CanonicalWorldObjectState;

  // Irreversibility + monotonicity guards.
  if (currentStatus === "destroyed" && statusAfter === "degraded") {
    throw new Error(`journey_world_object_state_transition_invalid:${input.objectId}`);
  }
  if (currentStatus === "degraded" && statusAfter === "degraded") {
    if (input.degree < currentDegree) {
      throw new Error(`journey_world_object_state_transition_invalid:${input.objectId}`);
    }
    if (input.degree === currentDegree) {
      // Idempotent replay — preserve current entry exactly.
      nextObjectEntry = currentEntry ?? {
        status: statusAfter,
        degree: input.degree,
        sourceActionEventId: input.actionEventId,
        changedAt: input.observedAt,
      };
    } else {
      nextObjectEntry = {
        status: statusAfter,
        degree: input.degree,
        sourceActionEventId: input.actionEventId,
        changedAt: input.observedAt,
      };
      objectChanged = true;
    }
  } else if (currentStatus === "destroyed" && statusAfter === "destroyed") {
    // Idempotent replay on an already-destroyed object. Do not advance
    // sourceActionEventId — the first destroyer wins the historical record.
    nextObjectEntry = currentEntry ?? {
      status: statusAfter,
      degree: input.degree,
      sourceActionEventId: input.actionEventId,
      changedAt: input.observedAt,
    };
  } else {
    // Forward transition: intact → degraded, intact → destroyed, degraded → destroyed.
    nextObjectEntry = {
      status: statusAfter,
      degree: input.degree,
      sourceActionEventId: input.actionEventId,
      changedAt: input.observedAt,
    };
    if (
      currentStatus !== statusAfter
      || currentDegree !== input.degree
    ) {
      objectChanged = true;
    }
  }

  // Update the object-state map.
  const nextWorldObjectStates: Record<string, CanonicalWorldObjectState> = {
    ...input.projection.worldObjectStates,
    [input.objectId]: nextObjectEntry,
  };

  // Scan the graph for affected hidden-prerequisite links.
  const affectedObjectiveIds = input.graph.objectivesByPrereqObject[input.objectId] ?? [];
  const nextHiddenPrerequisiteLinks: Record<string, HiddenPrerequisiteLink> = {
    ...input.projection.hiddenPrerequisiteLinks,
  };
  const mutatedLinks: HiddenPrerequisiteLink[] = [];
  const linkIntents: CanonicalObjectStateIntent[] = [];

  for (const objectiveId of affectedObjectiveIds) {
    const key = hiddenPrereqLinkKey(input.graph.regionId, objectiveId, input.objectId);
    const existing = nextHiddenPrerequisiteLinks[key];
    const newStatus: HiddenPrerequisiteStatus = statusAfter;

    // Link-level irreversibility guard — consistent with the object-level guard.
    if (existing?.status === "destroyed" && newStatus === "degraded") {
      // Object-level guard should have caught this; defensive double-check.
      throw new Error(`journey_world_object_state_transition_invalid:${input.objectId}`);
    }
    // Skip no-op link updates:
    //  - terminal no-op: existing already destroyed and the new intent is
    //    also destroyed — destroyed is terminal, so the FIRST destroyer's
    //    event id wins and subsequent destroy intents are not re-emitted
    //    (matches the object-state first-destroyer-wins rule above).
    //  - exact replay: same status AND same actionEventId already recorded
    //    on the link. This is the idempotent-replay path the mirror-ledger
    //    composite key relies on.
    const isTerminalNoOp = existing?.status === "destroyed" && newStatus === "destroyed";
    const isExactReplay = Boolean(existing)
      && existing?.status === newStatus
      && (existing?.destroyedAtActionEventId === input.actionEventId
        || existing?.degradedAtActionEventId === input.actionEventId);
    if (isTerminalNoOp || isExactReplay) {
      mutatedLinks.push(existing as HiddenPrerequisiteLink);
      continue;
    }

    const link: HiddenPrerequisiteLink = {
      objectiveId,
      prerequisiteObjectId: input.objectId,
      status: newStatus,
      ...(newStatus === "destroyed"
        ? { destroyedAtActionEventId: input.actionEventId }
        : {}),
      ...(newStatus === "degraded"
        ? { degradedAtActionEventId: input.actionEventId }
        : {}),
      // Preserve the opposite-direction event id when transitioning between
      // degraded and destroyed (e.g. degraded→destroyed keeps the prior
      // degradedAtActionEventId for audit).
      ...(newStatus === "destroyed" && existing?.degradedAtActionEventId
        ? { degradedAtActionEventId: existing.degradedAtActionEventId }
        : {}),
      ...(newStatus === "degraded" && existing?.destroyedAtActionEventId
        ? { destroyedAtActionEventId: existing.destroyedAtActionEventId }
        : {}),
      ...(existing?.sourceLedgerEntryId
        ? { sourceLedgerEntryId: existing.sourceLedgerEntryId }
        : {}),
      observedAt: input.observedAt,
    };
    nextHiddenPrerequisiteLinks[key] = link;
    mutatedLinks.push(link);
    linkIntents.push({
      kind: "hidden_prerequisite_link_changed",
      regionId: input.graph.regionId,
      objectiveId,
      prerequisiteObjectId: input.objectId,
      statusAfter: newStatus,
      sourceActionEventId: input.actionEventId,
      changedAt: input.observedAt,
    });
  }

  const canonicalIntents: CanonicalObjectStateIntent[] = [];
  if (objectChanged) {
    canonicalIntents.push({
      kind: "world_object_state_changed",
      regionId: input.graph.regionId,
      objectId: input.objectId,
      statusAfter: nextObjectEntry.status,
      degree: nextObjectEntry.degree,
      sourceActionEventId: input.actionEventId,
      changedAt: input.observedAt,
    });
  }
  canonicalIntents.push(...linkIntents);

  const changed = objectChanged || linkIntents.length > 0;

  return {
    projectionAfter: {
      regionId: input.projection.regionId,
      worldObjectStates: nextWorldObjectStates,
      hiddenPrerequisiteLinks: nextHiddenPrerequisiteLinks,
    },
    mutatedLinks,
    canonicalIntents,
    changed,
  };
}

// ---------------------------------------------------------------------------
// Future-journey adjudication
// ---------------------------------------------------------------------------

/**
 * Read the canonical projection to determine the reachability of every
 * hidden prerequisite of `objectiveId`. Returns one adjudication per
 * prerequisite object the objective declares.
 *
 * Spec §6.10: a destroyed prerequisite makes the hidden objective
 * unreachable for this journey. Degraded prerequisites remain reachable
 * (degree is informational for the narrative layer; no score impact).
 *
 * If the objectiveId is not in the graph, returns an empty array (the
 * objective has no hidden prerequisite contracts to adjudicate). An
 * unknown objectiveId is therefore NOT fail-closed — it is treated as
 * "has no hidden prereqs" (the caller is expected to validate the
 * objective id elsewhere). Object-level fail-closed lives in
 * {@link applyObjectMutation}.
 */
export function hiddenStatusForFutureJourney(input: {
  readonly graph: HiddenPrerequisiteGraph;
  readonly projection: HiddenPrerequisiteProjection;
  readonly objectiveId: string;
}): readonly HiddenPrerequisiteAdjudication[] {
  if (input.projection.regionId !== input.graph.regionId) {
    throw new Error(
      `journey_hidden_prereq_region_mismatch:${input.projection.regionId}:${input.graph.regionId}`,
    );
  }
  const prereqObjectIds = input.graph.prereqObjectsByObjective[input.objectiveId] ?? [];
  const out: HiddenPrerequisiteAdjudication[] = [];
  for (const prereqObjectId of prereqObjectIds) {
    const state = input.projection.worldObjectStates[prereqObjectId];
    const status: HiddenPrerequisiteStatus = state?.status ?? "intact";
    out.push({
      objectiveId: input.objectiveId,
      prerequisiteObjectId: prereqObjectId,
      reachable: status !== "destroyed",
      status,
      degree: state?.degree ?? 0,
      ...(state?.sourceActionEventId ? { sourceActionEventId: state.sourceActionEventId } : {}),
      ...(state?.changedAt ? { changedAt: state.changedAt } : {}),
    });
  }
  return out;
}

/**
 * Convenience: returns `true` iff every hidden prerequisite of `objectiveId`
 * is in a non-destroyed state. An objective with no hidden prereqs is
 * trivially reachable. An objective whose prerequisite is `degraded` is
 * reachable (degree is informational).
 */
export function isHiddenObjectiveReachable(input: {
  readonly graph: HiddenPrerequisiteGraph;
  readonly projection: HiddenPrerequisiteProjection;
  readonly objectiveId: string;
}): boolean {
  return hiddenStatusForFutureJourney(input).every((a) => a.reachable);
}

// ---------------------------------------------------------------------------
// Solidify / discard semantics
// ---------------------------------------------------------------------------

/**
 * Solidify path: apply a mutation to the projection. This is a thin wrapper
 * around {@link applyObjectMutation} that returns ONLY the next projection,
 * for callers that do not need the intent stream (e.g. test harnesses that
 * reconstruct the projection by replaying mutations).
 *
 * "Destroyed solidifies into canonical" — the canonical projection gains a
 * `world_object_state_changed` entry plus zero or more
 * `hidden_prerequisite_link_changed` entries (one per hidden objective that
 * depended on the destroyed object).
 */
export function solidifyObjectMutation(input: {
  readonly graph: HiddenPrerequisiteGraph;
  readonly projection: HiddenPrerequisiteProjection;
  readonly objectId: string;
  readonly degree: number;
  readonly actionEventId: string;
  readonly observedAt: string;
}): HiddenPrerequisiteProjection {
  return applyObjectMutation(input).projectionAfter;
}

/**
 * Discard path: identity on the projection. A discarded journey's object
 * mutations NEVER reach canonical state because they were never promoted.
 *
 * This helper exists to make the solidify/discard symmetry explicit in
 * caller code: the same planner loop can write
 *   `projection = path === 'solidify' ? solidifyObjectMutation(...) : discardObjectMutation(...)`
 * and the discard branch is a documented no-op rather than an implicit
 * missing case.
 *
 * Defence-in-depth regression hook: callers that want to assert discard
 * finality can wrap this in an audit check that the projection is bit-identical
 * before and after.
 */
export function discardObjectMutation(input: {
  readonly projection: HiddenPrerequisiteProjection;
}): HiddenPrerequisiteProjection {
  return input.projection;
}
