import type { JourneyMandate } from "./journeyPolicyRules.ts";
import type { EpochResourceId } from "./protocol.ts";
import type { PersistedJourneyNarrative, ServerJourneyEpisodeFacts } from "./journeyNarrativeRules.ts";
import type {
  JourneyGeneratedTaskObjective,
  JourneyGeneratedTaskPlan,
} from "./journeyGeneratedTaskRules.ts";
import {
  JOURNEY_SCENE_CATALOG,
  JOURNEY_SCENE_TYPES,
  type JourneySceneCatalogEntry,
  type JourneySceneType,
} from "./journeySceneCatalog.ts";

export interface JourneyWorldObjectRef {
  readonly id: string;
  readonly type: string;
  readonly label: string;
}

export interface JourneyAvailableWorldObject extends JourneyWorldObjectRef {
  readonly sourceFactIds: readonly string[];
  readonly regionId?: string;
  readonly tags?: readonly string[];
  readonly participantIds?: readonly string[];
  readonly sceneTypes?: readonly JourneySceneType[];
  /**
   * PR5c: canonical object-state digest stamped by the agent-companion runtime
   * when assembling the task-generation context. Read from
   * `projection.worldObjectStates[objectId]` at plan-generation time.
   *
   * The digest is INTERNAL-only — it is NOT carried into the public QuestOffer
   * or any client-facing schema. It is read by the server planner only, exactly
   * like the existing marketSnapshotVersion / worldSliceHash source-binding
   * fields on JourneyTaskPlanInstallation.
   *
   * Effect on downstream planners:
   * - fallbackRouteFromMap filters OUT objects with status==='destroyed' from
   *   the location/supporting-candidate pool.
   * - The offer-driven planner applies the same exclusion.
   * - Degraded objects remain eligible (informational; no score impact).
   * - The plan-validator rejects any proposal referencing a destroyed object.
   */
  readonly canonicalStatusDigest?: {
    readonly status: "intact" | "degraded" | "destroyed";
    readonly degree: number;
    readonly sourceActionEventId?: string;
    readonly changedAt?: string;
  };
}

export interface JourneyEpisodeFingerprint {
  readonly locationId: string;
  readonly participantIds: readonly string[];
  readonly optionIds: readonly string[];
  readonly outcomeKey: string;
}

export interface JourneyIdentityHistory {
  readonly roles?: readonly string[];
  readonly traits?: readonly string[];
  readonly visitedWorldObjectIds?: readonly string[];
  readonly completedSceneTypes?: readonly JourneySceneType[];
  readonly recentEpisodeFingerprints?: readonly JourneyEpisodeFingerprint[];
}

export interface JourneyRegionContext extends JourneyWorldObjectRef {
  readonly sourceFactIds: readonly string[];
}

export interface JourneyUnresolvedClue {
  readonly clueId: string;
  readonly label: string;
  readonly sourceFactIds: readonly string[];
  readonly relatedWorldObjectIds: readonly string[];
  readonly tags?: readonly string[];
}

export interface JourneySceneGenerationInput {
  readonly mandate: JourneyMandate;
  readonly identityHistory: JourneyIdentityHistory;
  readonly region: JourneyRegionContext;
  readonly season: string;
  readonly resources: Readonly<Record<string, number>>;
  readonly unresolvedClues: readonly JourneyUnresolvedClue[];
  readonly availableWorldObjects: readonly JourneyAvailableWorldObject[];
  readonly episodeCount?: number;
}

export interface JourneySceneCandidate {
  readonly candidateId: string;
  readonly type: JourneySceneType;
  readonly title: string;
  readonly worldObjectRefs: readonly JourneyWorldObjectRef[];
  readonly sourceFactIds: readonly string[];
  readonly optionIds: readonly string[];
  readonly outcomeKey: string;
  readonly fingerprint: JourneyEpisodeFingerprint;
  readonly score: number;
  readonly scoreReasons: readonly string[];
  readonly routine: boolean;
}

export type JourneyEpisodePhase = "arrival" | "main" | "side" | "return";

export interface JourneySceneEpisode extends Omit<JourneySceneCandidate, "candidateId" | "score" | "scoreReasons"> {
  readonly episodeId: string;
  readonly candidateId: string;
  readonly phase?: JourneyEpisodePhase;
  readonly generatedTaskObjective?: JourneyGeneratedTaskObjective;
  readonly settlement?: {
    readonly canonicalEventIds: readonly string[];
    readonly outcomeSummary?: string;
    readonly taskObjective?: {
      readonly objectiveId: string;
      readonly completionKind: "complete" | "failed" | "skip";
    };
    readonly reward?: {
      readonly resourceId?: EpochResourceId;
      readonly amount?: number;
    };
  };
  readonly serverFacts?: ServerJourneyEpisodeFacts;
  readonly narrative?: PersistedJourneyNarrative;
}

export interface JourneyScenePlan {
  readonly status: "ready" | "no_verifiable_world_object";
  readonly candidates: readonly JourneySceneCandidate[];
  readonly episodes: readonly JourneySceneEpisode[];
  readonly usedRoutineFallback: boolean;
}

function cleaned(values: readonly string[]): readonly string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort();
}

function validObject(object: JourneyAvailableWorldObject | JourneyRegionContext): boolean {
  return Boolean(object.id.trim() && object.type.trim() && object.label.trim() && cleaned(object.sourceFactIds).length);
}

function ref(object: JourneyWorldObjectRef): JourneyWorldObjectRef {
  return { id: object.id.trim(), type: object.type.trim(), label: object.label.trim() };
}

function matches(entry: JourneySceneCatalogEntry, value: string): boolean {
  const normalized = value.toLocaleLowerCase("en-US");
  return entry.signals.some((signal) => normalized.includes(signal));
}

function enabledForObject(entry: JourneySceneCatalogEntry, object: JourneyAvailableWorldObject): boolean {
  if (object.sceneTypes) return object.sceneTypes.includes(entry.type);
  if (entry.objectTypes.includes(object.type.toLocaleLowerCase("en-US"))) return true;
  return matches(entry, `${object.type} ${object.label} ${(object.tags ?? []).join(" ")}`);
}

function scoreCandidate(
  entry: JourneySceneCatalogEntry,
  object: JourneyAvailableWorldObject,
  input: JourneySceneGenerationInput,
): { readonly score: number; readonly reasons: readonly string[] } {
  let score = entry.baseScore;
  const reasons = [`base:${entry.baseScore}`];
  const add = (amount: number, reason: string) => {
    score += amount;
    reasons.push(`${reason}:${amount}`);
  };
  for (const priority of input.mandate.priorities) if (matches(entry, priority)) add(80, "mandate_priority");
  for (const preferred of input.mandate.preferredActivities) if (matches(entry, preferred)) add(60, "mandate_preferred");
  const objectType = object.type.toLocaleLowerCase("en-US");
  const explicitlyRequestedObjectType = [
    ...input.mandate.priorities,
    ...input.mandate.preferredActivities,
  ].some((term) => term.trim().toLocaleLowerCase("en-US") === objectType);
  if (explicitlyRequestedObjectType) add(30, "mandate_object_type");
  for (const avoided of input.mandate.avoid) if (matches(entry, avoided)) add(-160, "mandate_avoid");
  if (matches(entry, input.mandate.objective)) add(35, "mandate_objective");
  if (object.regionId === input.region.id || object.id === input.region.id) add(12, "current_region");
  const objectContext = `${object.label} ${(object.tags ?? []).join(" ")}`;
  if (matches(entry, input.season) || matches(entry, objectContext)) add(6, "world_context");
  if (matches(entry, `${(input.identityHistory.roles ?? []).join(" ")} ${(input.identityHistory.traits ?? []).join(" ")}`)) {
    add(4, "identity_history");
  }
  if (input.identityHistory.completedSceneTypes?.includes(entry.type)) add(-8, "recent_activity_variety");
  if (input.identityHistory.visitedWorldObjectIds?.includes(object.id)) add(-4, "visited_object_variety");
  if (entry.type === "relationship") {
    if (input.mandate.socialPreference === "outgoing") add(18, "social_preference");
    if (input.mandate.socialPreference === "reserved") add(-18, "social_preference");
  }
  const resourceText = Object.entries(input.resources)
    .filter(([, amount]) => Number.isFinite(amount) && amount > 0)
    .map(([resourceId]) => resourceId)
    .join(" ");
  if (resourceText && (matches(entry, resourceText) || objectContext.toLocaleLowerCase("en-US").includes(resourceText))) {
    add(5, "available_resource");
  }
  if (input.unresolvedClues.some((clue) => clue.relatedWorldObjectIds.includes(object.id))) {
    add(entry.type === "discovery" ? 55 : 8, "unresolved_clue");
  }
  return { score, reasons };
}

function fingerprintFor(
  entry: JourneySceneCatalogEntry,
  object: JourneyAvailableWorldObject,
  region: JourneyRegionContext,
  supportingParticipants: readonly JourneyAvailableWorldObject[] = [],
): JourneyEpisodeFingerprint {
  const participantIds = cleaned([
    ...(object.participantIds ?? []),
    ...(["npc", "agent"].includes(object.type) ? [object.id] : []),
    ...supportingParticipants.flatMap((participant) => [
      participant.id,
      ...(participant.participantIds ?? []),
    ]),
  ]);
  return {
    locationId: object.type === "location" || object.type === "region" ? object.id : (object.regionId ?? region.id),
    participantIds,
    optionIds: cleaned(entry.optionIds),
    outcomeKey: entry.routineOutcome,
  };
}

export function episodeFingerprintKey(fingerprint: JourneyEpisodeFingerprint): string {
  return [
    fingerprint.locationId,
    cleaned(fingerprint.participantIds).join(","),
    cleaned(fingerprint.optionIds).join(","),
    fingerprint.outcomeKey,
  ].join("|");
}

export function wouldRepeatEpisodeThreeTimes(
  history: readonly JourneyEpisodeFingerprint[],
  next: JourneyEpisodeFingerprint,
): boolean {
  if (history.length < 2) return false;
  const nextKey = episodeFingerprintKey(next);
  return history.slice(-2).every((item) => episodeFingerprintKey(item) === nextKey);
}

function candidateFor(
  entry: JourneySceneCatalogEntry,
  object: JourneyAvailableWorldObject,
  input: JourneySceneGenerationInput,
  routine: boolean,
): JourneySceneCandidate {
  const scored = scoreCandidate(entry, object, input);
  const routeTag = object.tags?.find((tag) => tag.startsWith("journey_route:"));
  const supportingObjects = routeTag
    ? input.availableWorldObjects.filter((candidate) =>
        candidate.id !== object.id
        && candidate.regionId === object.regionId
        && candidate.tags?.includes(routeTag))
    : entry.type === "livelihood"
      ? [
        input.availableWorldObjects.find((candidate) =>
          candidate.type.toLocaleLowerCase("en-US") === "organization"
          && (candidate.regionId ?? input.region.id) === input.region.id
          && candidate.id !== object.id),
        input.availableWorldObjects.find((candidate) =>
          candidate.type.toLocaleLowerCase("en-US") === "npc"
          && (candidate.regionId ?? input.region.id) === input.region.id
          && candidate.id !== object.id),
        ...input.availableWorldObjects.filter((candidate) =>
          candidate.type.toLocaleLowerCase("en-US") === "document"
          && (candidate.regionId ?? input.region.id) === input.region.id
          && candidate.id !== object.id),
        ].filter((candidate): candidate is JourneyAvailableWorldObject => Boolean(candidate))
      : [];
  const supportingParticipants = supportingObjects.filter((candidate) =>
    ["npc", "agent"].includes(candidate.type.toLocaleLowerCase("en-US")));
  const sources = cleaned([
    ...object.sourceFactIds,
    ...input.region.sourceFactIds,
    ...supportingObjects.flatMap((supportingObject) => supportingObject.sourceFactIds),
    ...input.unresolvedClues
      .filter((clue) => clue.relatedWorldObjectIds.includes(object.id))
      .flatMap((clue) => clue.sourceFactIds),
  ]);
  const refs = [
    ref(object),
    ...(object.id === input.region.id ? [] : [ref(input.region)]),
    ...supportingObjects.map(ref),
  ];
  return {
    candidateId: `scene:${entry.type}:${object.id}`,
    type: entry.type,
    title: `${entry.label}：${object.label}`,
    worldObjectRefs: refs,
    sourceFactIds: sources,
    optionIds: entry.optionIds,
    outcomeKey: entry.routineOutcome,
    fingerprint: fingerprintFor(entry, object, input.region, supportingParticipants),
    score: scored.score,
    scoreReasons: scored.reasons,
    routine,
  };
}

export function rankJourneySceneCandidates(input: JourneySceneGenerationInput): readonly JourneySceneCandidate[] {
  const regionIsValid = validObject(input.region);
  const objects = input.availableWorldObjects.filter(validObject);
  const candidates: JourneySceneCandidate[] = [];
  for (const object of objects) {
    for (const type of JOURNEY_SCENE_TYPES) {
      const entry = JOURNEY_SCENE_CATALOG[type];
      if (enabledForObject(entry, object)) candidates.push(candidateFor(entry, object, input, false));
    }
  }
  if (!candidates.length && regionIsValid) {
    const regionObject: JourneyAvailableWorldObject = { ...input.region, regionId: input.region.id };
    candidates.push(candidateFor(JOURNEY_SCENE_CATALOG.travel, regionObject, input, true));
  }
  return candidates.sort((left, right) => right.score - left.score
    || (left.candidateId < right.candidateId ? -1 : left.candidateId > right.candidateId ? 1 : 0));
}

export const buildJourneySceneCandidates = rankJourneySceneCandidates;

export function generateJourneySceneEpisodes(input: JourneySceneGenerationInput): JourneyScenePlan {
  const candidates = rankJourneySceneCandidates(input);
  if (!candidates.length) {
    return { status: "no_verifiable_world_object", candidates, episodes: [], usedRoutineFallback: false };
  }
  const requested = input.episodeCount ?? 3;
  const count = Math.max(1, Math.min(3, Number.isSafeInteger(requested) ? requested : 3));
  const history = [...(input.identityHistory.recentEpisodeFingerprints ?? [])];
  const episodes: JourneySceneEpisode[] = [];
  for (const candidate of candidates) {
    if (episodes.length >= count) break;
    if (wouldRepeatEpisodeThreeTimes(history, candidate.fingerprint)) continue;
    episodes.push({
      episodeId: `episode:${episodes.length + 1}:${candidate.candidateId}`,
      candidateId: candidate.candidateId,
      type: candidate.type,
      title: candidate.title,
      worldObjectRefs: candidate.worldObjectRefs,
      sourceFactIds: candidate.sourceFactIds,
      optionIds: candidate.optionIds,
      outcomeKey: candidate.outcomeKey,
      fingerprint: candidate.fingerprint,
      routine: candidate.routine,
    });
    history.push(candidate.fingerprint);
  }
  return {
    status: "ready",
    candidates,
    episodes,
    usedRoutineFallback: episodes.some((episode) => episode.routine),
  };
}

function journeyPhaseEpisode(input: {
  readonly phase: "arrival" | "return";
  readonly index: number;
  readonly region: JourneyRegionContext;
}): JourneySceneEpisode {
  const arrival = input.phase === "arrival";
  const optionIds = arrival
    ? [
        input.region.id === "region_gray_harbor" ? "enter_gray_harbor" : "enter_destination",
        "review_arrival_route",
        "turn_back_before_entry",
      ]
    : ["return_by_known_route", "record_verified_facts", "wait_for_safe_departure"];
  const outcomeKey = arrival ? "arrival_recorded" : "return_recorded";
  const candidateId = `scene:${input.phase}:${input.region.id}`;
  return {
    episodeId: `episode:${input.index}:${candidateId}`,
    candidateId,
    phase: input.phase,
    type: "travel",
    title: `${arrival ? "到达" : "返程"}：${input.region.label}`,
    worldObjectRefs: [ref(input.region)],
    sourceFactIds: cleaned(input.region.sourceFactIds),
    optionIds,
    outcomeKey,
    fingerprint: {
      locationId: input.region.id,
      participantIds: [],
      optionIds: cleaned(optionIds),
      outcomeKey,
    },
    routine: false,
  };
}

export function generateThreePhaseJourneySceneEpisodes(input: JourneySceneGenerationInput): JourneyScenePlan {
  const candidates = rankJourneySceneCandidates(input);
  if (!validObject(input.region) || !candidates.length) {
    return { status: "no_verifiable_world_object", candidates, episodes: [], usedRoutineFallback: false };
  }
  const main = candidates.find((candidate) => candidate.type !== "travel") ?? candidates[0];
  const episodes: readonly JourneySceneEpisode[] = [
    journeyPhaseEpisode({ phase: "arrival", index: 1, region: input.region }),
    {
      episodeId: `episode:2:${main.candidateId}`,
      candidateId: main.candidateId,
      phase: "main",
      type: main.type,
      title: main.title,
      worldObjectRefs: main.worldObjectRefs,
      sourceFactIds: main.sourceFactIds,
      optionIds: main.optionIds,
      outcomeKey: main.outcomeKey,
      fingerprint: main.fingerprint,
      routine: main.routine,
    },
    journeyPhaseEpisode({ phase: "return", index: 3, region: input.region }),
  ];
  return {
    status: "ready",
    candidates,
    episodes,
    usedRoutineFallback: episodes.some((episode) => episode.routine),
  };
}

export function generateTaskPlanJourneySceneEpisodes(input: {
  readonly plan: JourneyGeneratedTaskPlan;
  readonly region: JourneyRegionContext;
  readonly availableWorldObjects: readonly JourneyAvailableWorldObject[];
}): JourneyScenePlan {
  if (!validObject(input.region)) {
    return { status: "no_verifiable_world_object", candidates: [], episodes: [], usedRoutineFallback: false };
  }
  const objectsById = new Map([
    [input.region.id, input.region as JourneyAvailableWorldObject],
    ...input.availableWorldObjects.map((object) => [object.id, object] as const),
  ]);
  const objectiveEpisodes = input.plan.objectives.map((objective, objectiveIndex): JourneySceneEpisode => {
    const objects = objective.worldObjectIds.map((objectId) => objectsById.get(objectId));
    if (objects.some((object) => !object)) throw new Error("journey_task_episode_object_missing");
    const groundedObjects = objects.filter((object): object is JourneyAvailableWorldObject => Boolean(object));
    const refs = [...new Map([
      [input.region.id, ref(input.region)],
      ...groundedObjects.map((object) => [object.id, ref(object)] as const),
    ]).values()];
    const sourceFactIds = cleaned([
      ...input.region.sourceFactIds,
      ...groundedObjects.flatMap((object) => object.sourceFactIds),
    ]);
    const optionIds = cleaned([
      ...objective.actions.map((action) => action.optionKey),
      `skip_${objective.objectiveId}`,
    ]);
    const phase = objective.kind === "side" ? "side" : "main";
    const candidateId = `scene:task:${objective.objectiveId}`;
    return {
      episodeId: `episode:${objectiveIndex + 2}:${candidateId}`,
      candidateId,
      phase,
      type: objective.sceneType,
      title: objective.title,
      worldObjectRefs: refs,
      sourceFactIds,
      optionIds,
      outcomeKey: `task_objective:${objective.objectiveId}`,
      fingerprint: {
        locationId: objective.locationId,
        participantIds: cleaned(groundedObjects.flatMap((object) => object.participantIds ?? [])),
        optionIds,
        outcomeKey: `task_objective:${objective.objectiveId}`,
      },
      routine: false,
      generatedTaskObjective: objective,
    };
  });
  const episodes: readonly JourneySceneEpisode[] = [
    journeyPhaseEpisode({ phase: "arrival", index: 1, region: input.region }),
    ...objectiveEpisodes,
    journeyPhaseEpisode({ phase: "return", index: objectiveEpisodes.length + 2, region: input.region }),
  ];
  return {
    status: "ready",
    candidates: [],
    episodes,
    usedRoutineFallback: false,
  };
}
