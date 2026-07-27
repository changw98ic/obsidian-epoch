import type { EpochEvent } from "./events.ts";
import type { EpochEventFactory } from "./eventFactory.ts";
import type { JourneyTaskEffectKind } from "./journeyTaskCatalog.ts";
import type { JourneyTaskObjectiveKind } from "./journeyGeneratedTaskRules.ts";
import type { JourneyActionResolution } from "./journeyActionResolutionRules.ts";
import type { EpochIdFactory } from "./protocol.ts";
import {
  regionInfluenceChangedEvent,
  traceCreatedEvent,
} from "./regionEventLedgerEvents.ts";
import type {
  ConsequenceEffectKind,
  ConsequenceType,
  MirrorConsequenceLedgerEntry,
} from "./journeySettlementRules.ts";
import { deriveMirrorConsequenceDedupeKey } from "./journeyMirrorLedger.ts";
import {
  assertValidObjectImpactDegree,
  HIDDEN_PREREQ_DEGREE_MIN,
  HIDDEN_PREREQ_DEGREE_MAX,
  OBJECT_DESTROY_DEGREE_THRESHOLD,
} from "./hiddenPrerequisiteRules.ts";

export interface PlanJourneyWorldImpactEventsInput {
  readonly makeEvent: EpochEventFactory;
  readonly idFactory: EpochIdFactory;
  readonly regionId: string;
  readonly agentId: string;
  readonly explorerId: string;
  readonly identityName: string;
  readonly journeyId: string;
  readonly episodeId: string;
  readonly objectiveId: string;
  readonly objectiveKind: JourneyTaskObjectiveKind;
  readonly objectiveTitle: string;
  readonly actionLabel: string;
  readonly actionRisk: "low" | "medium" | "high";
  readonly allowedEffectKinds: readonly JourneyTaskEffectKind[];
  readonly resolution: JourneyActionResolution;
  readonly previousInfluenceScore: number;
  readonly previousFactionStandingScore?: number;
  readonly routeSelection?: {
    readonly routeId: string;
    readonly factionObjectId?: string;
  };
  readonly sourceEventId: string;
  readonly sourceAggregateId: string;
  readonly recordedAt: string;
  readonly worldMinute: number;
}

export interface JourneyWorldImpactPreview {
  readonly influenceDelta: number;
  readonly reason: string;
  readonly title: string;
  readonly summary: string;
}

function boundedInfluenceDelta(input: PlanJourneyWorldImpactEventsInput) {
  const objectiveWeight = input.objectiveKind === "main" ? 2 : 1;
  const riskWeight = input.actionRisk === "high" ? 1 : 0;
  const exceptionalWeight = input.resolution.outcome === "exceptional_success" ? 1 : 0;
  const substantiveEffects = new Set(input.allowedEffectKinds.filter((kind) => kind !== "journey_progress")).size;
  return Math.max(1, Math.min(5, objectiveWeight + riskWeight + exceptionalWeight + Math.min(1, substantiveEffects)));
}

export function journeyWorldImpactPreview(
  input: PlanJourneyWorldImpactEventsInput,
): JourneyWorldImpactPreview | undefined {
  if (input.resolution.completionKind !== "complete") return undefined;
  const influenceDelta = boundedInfluenceDelta(input);
  return {
    influenceDelta,
    reason: `journey_objective:${input.journeyId}:${input.objectiveId}:${input.resolution.outcome}`,
    title: `旅程留下影响：${input.objectiveTitle}`,
    summary: `${input.identityName}完成了“${input.actionLabel}”；服务器将“${input.objectiveTitle}”记为已完成，并在当地留下 +${influenceDelta} 地区影响。`,
  };
}

/**
 * Converts only a server-settled successful objective into shared-world state.
 * Client/model effect prose is never interpreted as authority.
 */
export function planJourneyWorldImpactEvents(
  input: PlanJourneyWorldImpactEventsInput,
): readonly EpochEvent[] {
  const impact = journeyWorldImpactPreview(input);
  if (!impact) return [];
  const influenceId = input.idFactory(
    "region_influence",
    `${input.regionId}:${input.agentId}:${input.journeyId}:${input.objectiveId}:${input.sourceEventId}`,
  );
  const traceId = input.idFactory(
    "trace",
    `${input.regionId}:${input.journeyId}:${input.episodeId}:${input.sourceEventId}`,
  );
  const regionEvents: EpochEvent[] = [
    regionInfluenceChangedEvent(input.makeEvent, input.regionId, {
      influenceId,
      regionId: input.regionId,
      agentId: input.agentId,
      explorerId: input.explorerId,
      influenceDelta: impact.influenceDelta,
      influenceScoreAfter: input.previousInfluenceScore + impact.influenceDelta,
      reason: impact.reason,
      sourceEventId: input.sourceEventId,
      sourceEventType: "hosted_action_recorded",
      sourceAggregateId: input.sourceAggregateId,
      changedAt: input.recordedAt,
      worldMinute: Math.max(0, Math.floor(input.worldMinute)),
    }, input.agentId),
    traceCreatedEvent(input.makeEvent, traceId, {
      traceId,
      regionId: input.regionId,
      title: impact.title,
      summary: impact.summary,
      sourceEventType: "hosted_action_recorded",
      sourceEventIds: [input.sourceEventId],
      sourceAggregateId: input.sourceAggregateId,
      relatedInfluenceIds: [influenceId],
      participantAgentIds: [input.agentId],
      participantExplorerIds: [input.explorerId],
      createdAt: input.recordedAt,
    }, input.agentId),
  ];
  const factionId = input.objectiveKind === "choice"
    ? input.routeSelection?.factionObjectId
    : undefined;
  if (!factionId || !input.routeSelection) return regionEvents;
  const standingBefore = Math.max(-10_000, Math.min(10_000,
    Math.floor(input.previousFactionStandingScore ?? 0)));
  const requestedDelta = input.resolution.outcome === "exceptional_success" ? 150 : 100;
  const standingAfter = Math.min(10_000, standingBefore + requestedDelta);
  const standingDelta = standingAfter - standingBefore;
  if (standingDelta <= 0) return regionEvents;
  const standingId = input.idFactory(
    "faction_standing",
    `${input.agentId}:${factionId}`,
  );
  return [
    ...regionEvents,
    input.makeEvent("agent_faction_standing_changed", standingId, {
      standingId,
      agentId: input.agentId,
      explorerId: input.explorerId,
      factionId,
      standingDelta,
      standingAfter,
      journeyId: input.journeyId,
      episodeId: input.episodeId,
      objectiveId: input.objectiveId,
      routeId: input.routeSelection.routeId,
      sourceEventId: input.sourceEventId,
      changedAt: input.recordedAt,
      worldMinute: Math.max(0, Math.floor(input.worldMinute)),
    }, {
      aggregateType: "agent_identity",
      agentId: input.agentId,
    }),
  ];
}

// ---------------------------------------------------------------------------
// PR5c — object-impact mirror-consequence blueprint planner.
//
// Sibling planner to {@link planJourneyWorldImpactEvents} that produces
// mirror-ledger entries for physical object mutation/destruction. The planner
// is single-derivation per actionEventId: one completed action produces at
// most one object-impact entry (matching the single-derivation contract of
// {@link planJourneyMirrorConsequenceBlueprints}).
//
// The entry flows through the same mirror-ledger append → promote → solidify
// path as region/trace/faction blueprints. On solidify,
// {@link buildCanonicalEventFromMirrorEntry} dispatches the entry to the
// canonical `world_object_state_changed` event; on discard the entry never
// reaches canonical state (the projection's worldObjectStates stays intact).
//
// Zero-affinity (零加成): the blueprint carries objectId/degree/regionId only.
// No public-boundary field (PublicActionOption / PublicQuestOffer) references
// the object-impact payload; the field is INTERNAL-only and the public
// serializers strip it.
// ---------------------------------------------------------------------------

/**
 * Effect kinds the object-impact planner may emit. Restricted to the two
 * physical-mutation kinds defined in {@link ConsequenceEffectKind}.
 * `hidden_prerequisite_destroyed` is NEVER produced here — it is synthesised
 * by the solidify-time cascade ({@link cascadeObjectDestructionToHiddenPrereqs})
 * after the canonical object-state transition commits.
 */
export type ObjectImpactEffectKind = "object_mutation" | "object_destroy";

/**
 * Structured object-impact descriptor carried on the internal scene-contract
 * action (NOT on {@link PublicActionOption}). The field is the single input
 * to {@link planJourneyObjectImpactBlueprints}.
 *
 * - `targetEntityId` follows the ledger convention: `object:${objectId}`.
 * - `effectKind` is `object_mutation` (degree 1-2 → degraded) or
 *   `object_destroy` (degree 3+ → destroyed). The caller picks the bucket;
 *   the planner does not reclassify based on degree.
 * - `degree` is the integer magnitude in [1, 5]; validated by
 *   {@link assertValidObjectImpactDegree}.
 */
export interface JourneyActionObjectImpact {
  readonly targetEntityId: string;
  readonly effectKind: ObjectImpactEffectKind;
  readonly degree: number;
}

/**
 * Input shape for {@link planJourneyObjectImpactBlueprints}. Mirrors the
 * {@link PlanJourneyMirrorConsequenceBlueprintsInput} contract with the
 * event-factory surface stripped and `actionObjectImpact` promoted to the
 * primary driver.
 */
export interface PlanJourneyObjectImpactBlueprintsInput {
  readonly actionEventId: string;
  readonly agentId: string;
  readonly regionId: string;
  readonly actionObjectImpact?: JourneyActionObjectImpact;
  readonly resolution: JourneyActionResolution;
  readonly recordedAt: string;
  readonly sourceAggregateId: string;
}

/** Collateral bucket constant; the object-impact entry always lands here. */
const OBJECT_COLLATERAL: ConsequenceType = "collateral";

/**
 * Strip the `object:` prefix from a targetEntityId and return the bare
 * objectId. Returns `undefined` when the prefix is absent or the remainder is
 * empty. Used by the planner to gate on malformed target ids and by the
 * solidify dispatch arm to recover the canonical objectId.
 */
export function stripObjectTargetEntityId(targetEntityId: string): string | undefined {
  if (!targetEntityId.startsWith("object:")) return undefined;
  const objectId = targetEntityId.slice("object:".length);
  return objectId.length > 0 ? objectId : undefined;
}

/**
 * Compute the mirror-ledger blueprint for one grounded action's object impact.
 *
 * Returns an empty array when ANY of:
 * (a) `resolution.completionKind !== 'complete'` — failed actions never
 *     mutate canonical object state.
 * (b) `actionObjectImpact` is undefined — the action carries no object impact
 *     (the common case; most actions do not destroy objects).
 * (c) `targetEntityId` is malformed (not `object:${nonEmpty}`) — fail-closed
 *     against a fabricated impact record.
 *
 * Otherwise emits exactly one {@link MirrorConsequenceLedgerEntry} with:
 * - `effectKind` = `actionObjectImpact.effectKind`
 * - `targetEntityId` = `actionObjectImpact.targetEntityId`
 * - `delta` = `-degree` (negative — destruction is a penalty)
 * - `consequenceType` = `'collateral'`
 * - `effectBlueprint` carrying `{ objectId, degree, regionId, sourceAggregateId, sourceActionEventId }`
 * - `dedupeKey` via {@link deriveMirrorConsequenceDedupeKey} (replay-idempotent
 *   on the `actionEventId + targetEntityId` composite)
 *
 * Pure: same inputs → same outputs. No IO, no gameCore/eventFactory dependency.
 */
export function planJourneyObjectImpactBlueprints(
  input: PlanJourneyObjectImpactBlueprintsInput,
): readonly MirrorConsequenceLedgerEntry[] {
  // (a) only completed actions mutate objects.
  if (input.resolution.completionKind !== "complete") return [];
  // (b) no impact descriptor → no entry.
  const impact = input.actionObjectImpact;
  if (!impact) return [];
  // (c) fail-closed on malformed target id.
  const objectId = stripObjectTargetEntityId(impact.targetEntityId);
  if (objectId === undefined) return [];

  // Validate degree via the shared helper so the threshold table stays the
  // single source of truth.
  assertValidObjectImpactDegree(impact.degree);

  // PR5c ADVERSARIAL-6 fix: cross-check degree against effectKind. If the
  // degree meets or exceeds the destroy threshold but the caller labeled the
  // effect as `object_mutation`, reclassify to `object_destroy` so the
  // collateral weight bucket (-300 bps) applies instead of the lighter
  // mutation weight (50 bps). This prevents a caller footgun where a
  // degree-5 destruction labeled as 'object_mutation' would get the wrong
  // collateral penalty. The canonical status derivation (degreeToStatus) is
  // degree-driven and unaffected; only the collateral weight bucket changes.
  const effectKind: ConsequenceEffectKind =
    impact.effectKind === "object_mutation" && impact.degree >= OBJECT_DESTROY_DEGREE_THRESHOLD
      ? "object_destroy"
      : impact.effectKind;
  const delta = -impact.degree;
  const dedupeKey = deriveMirrorConsequenceDedupeKey({
    effectKind,
    targetEntityId: impact.targetEntityId,
    actionEventId: input.actionEventId,
  });

  const entry: MirrorConsequenceLedgerEntry = {
    actionEventId: input.actionEventId,
    effectKind,
    targetEntityId: impact.targetEntityId,
    delta,
    consequenceType: OBJECT_COLLATERAL,
    sourceEventIds: [input.actionEventId],
    effectBlueprint: {
      objectId,
      degree: impact.degree,
      regionId: input.regionId,
      sourceAggregateId: input.sourceAggregateId,
      sourceActionEventId: input.actionEventId,
    },
    recordedAt: input.recordedAt,
    dedupeKey,
  };
  return [entry];
}

/**
 * Convenience validator exposed for the scene-contract builder: returns
 * `true` iff `degree` is a valid object-impact magnitude. Wraps
 * {@link assertValidObjectImpactDegree} in a try/catch so the contract builder
 * can reject malformed proposals without raising.
 */
export function isValidObjectImpactDegree(degree: unknown): boolean {
  if (typeof degree !== "number" || !Number.isSafeInteger(degree)) return false;
  return degree >= HIDDEN_PREREQ_DEGREE_MIN && degree <= HIDDEN_PREREQ_DEGREE_MAX;
}
