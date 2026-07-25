/**
 * journeyMirrorConsequenceBlueprints.ts — PR2 pure mirror-consequence planner.
 *
 * Mirrors the influence/trace/faction calculation of
 * {@link "./journeyWorldImpactRules.ts".planJourneyWorldImpactEvents} but
 * produces {@link MirrorConsequenceLedgerEntry} blueprints instead of canonical
 * epoch events. This is the single physical-effect planner call per
 * `actionEventId` required by Step 2 engineering task 3.
 *
 * Output invariants:
 * - Effect kinds are restricted to `region_influence_delta`, `trace_created`
 *   and `faction_standing_delta`. Self-loss (`resource_spent`,
 *   `lifetime_adjusted`) is NEVER produced here — those buckets remain
 *   canonical-event-only to avoid double counting.
 * - Every entry carries `consequenceType: 'collateral'` and the originating
 *   `actionEventId` in `sourceEventIds`, so downstream promotion can rebuild
 *   canonical world events with stable IDs.
 * - `dedupeKey` is derived exclusively through
 *   {@link deriveMirrorConsequenceDedupeKey}; free-text keys are forbidden by
 *   contract. Replay of the same `actionEventId + dedupeKey` composite is
 *   idempotent at the ledger layer ({@link appendMirrorConsequence}).
 *
 * This module imports only types and the dedupe-key derivation from PR1; it
 * does not depend on `gameCore` / `eventFactory`, preserving the pure-function
 * boundary required by the single-derivation invariant.
 */

import type { JourneyActionResolution } from "./journeyActionResolutionRules.ts";
import type { JourneyTaskObjectiveKind } from "./journeyGeneratedTaskRules.ts";
import type { JourneyTaskEffectKind } from "./journeyTaskCatalog.ts";
import type {
  ConsequenceEffectKind,
  ConsequenceType,
  MirrorConsequenceLedgerEntry,
} from "./journeySettlementRules.ts";
import { deriveMirrorConsequenceDedupeKey } from "./journeyMirrorLedger.ts";

/**
 * Input shape for {@link planJourneyMirrorConsequenceBlueprints}. Mirrors
 * {@link PlanJourneyWorldImpactEventsInput} with the event-factory surface
 * (`makeEvent`, `idFactory`) stripped and the originating `actionEventId`
 * promoted to a required field.
 */
export interface PlanJourneyMirrorConsequenceBlueprintsInput {
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
  /**
   * Canonical event id of the recorded hosted action. Becomes the
   * `sourceEventId` for every blueprinted region/trace/faction effect and the
   * `actionEventId` recorded on each {@link MirrorConsequenceLedgerEntry}.
   */
  readonly actionEventId: string;
  /**
   * Owning hosted-session id. Mirrors `sourceAggregateId` in
   * {@link planJourneyWorldImpactEvents} (session.sessionId on both submit
   * and solidify paths). Recorded in the blueprint so that promotion can
   * rebuild canonical region/trace events with byte-identical payloads.
   */
  readonly sourceAggregateId: string;
  readonly recordedAt: string;
}

const COLLATERAL: ConsequenceType = "collateral";

function boundedInfluenceDelta(input: PlanJourneyMirrorConsequenceBlueprintsInput) {
  const objectiveWeight = input.objectiveKind === "main" ? 2 : 1;
  const riskWeight = input.actionRisk === "high" ? 1 : 0;
  const exceptionalWeight = input.resolution.outcome === "exceptional_success" ? 1 : 0;
  const substantiveEffects = new Set(
    input.allowedEffectKinds.filter((kind) => kind !== "journey_progress"),
  ).size;
  return Math.max(
    1,
    Math.min(5, objectiveWeight + riskWeight + exceptionalWeight + Math.min(1, substantiveEffects)),
  );
}

function buildEntry(input: {
  readonly actionEventId: string;
  readonly effectKind: ConsequenceEffectKind;
  readonly targetEntityId: string;
  readonly scopeKey?: string;
  readonly delta: number;
  readonly effectBlueprint: Readonly<Record<string, unknown>>;
  readonly recordedAt: string;
}): MirrorConsequenceLedgerEntry {
  const dedupeKey = deriveMirrorConsequenceDedupeKey({
    effectKind: input.effectKind,
    targetEntityId: input.targetEntityId,
    actionEventId: input.actionEventId,
    ...(input.scopeKey !== undefined ? { scopeKey: input.scopeKey } : {}),
  });
  return {
    actionEventId: input.actionEventId,
    effectKind: input.effectKind,
    targetEntityId: input.targetEntityId,
    delta: input.delta,
    consequenceType: COLLATERAL,
    sourceEventIds: [input.actionEventId],
    effectBlueprint: input.effectBlueprint,
    recordedAt: input.recordedAt,
    dedupeKey,
  };
}

/**
 * Compute mirror-world consequence blueprints for one grounded journey action.
 *
 * Returns an empty array when the action did not complete the objective
 * (matching {@link planJourneyWorldImpactEvents} no-op behaviour). Otherwise
 * returns 2 entries (region influence + trace) plus an optional third
 * (faction standing) when the objective is a `choice` with a selected route.
 *
 * The output is order-stable: region influence first, trace second, faction
 * standing last. Promotion reads entries via {@link promoteMirrorConsequences}
 * which re-sorts by `recordedAt + entryId`, so order here is observational
 * only.
 */
export function planJourneyMirrorConsequenceBlueprints(
  input: PlanJourneyMirrorConsequenceBlueprintsInput,
): readonly MirrorConsequenceLedgerEntry[] {
  if (input.resolution.completionKind !== "complete") return [];
  const influenceDelta = boundedInfluenceDelta(input);
  const reason = `journey_objective:${input.journeyId}:${input.objectiveId}:${input.resolution.outcome}`;
  const title = `旅程留下影响：${input.objectiveTitle}`;
  const summary = `${input.identityName}完成了“${input.actionLabel}”；服务器将“${input.objectiveTitle}”记为已完成，并在当地留下 +${influenceDelta} 地区影响。`;
  const influenceScoreAfter = input.previousInfluenceScore + influenceDelta;

  const entries: MirrorConsequenceLedgerEntry[] = [];

  entries.push(
    buildEntry({
      actionEventId: input.actionEventId,
      effectKind: "region_influence_delta",
      targetEntityId: `region:${input.regionId}`,
      scopeKey: `agent:${input.agentId}`,
      delta: influenceDelta,
      effectBlueprint: {
        regionId: input.regionId,
        agentId: input.agentId,
        explorerId: input.explorerId,
        influenceDelta,
        influenceScoreAfter,
        reason,
        sourceEventType: "hosted_action_recorded",
        sourceAggregateId: input.sourceAggregateId,
      },
      recordedAt: input.recordedAt,
    }),
  );

  entries.push(
    buildEntry({
      actionEventId: input.actionEventId,
      effectKind: "trace_created",
      targetEntityId: `region:${input.regionId}`,
      scopeKey: `${input.journeyId}:${input.episodeId}`,
      delta: influenceDelta,
      effectBlueprint: {
        regionId: input.regionId,
        title,
        summary,
        sourceEventType: "hosted_action_recorded",
        sourceAggregateId: input.sourceAggregateId,
        relatedInfluenceScopeKey: `region:${input.regionId}`,
        participantAgentIds: [input.agentId],
        participantExplorerIds: [input.explorerId],
      },
      recordedAt: input.recordedAt,
    }),
  );

  const factionId = input.objectiveKind === "choice"
    ? input.routeSelection?.factionObjectId
    : undefined;
  if (!factionId || !input.routeSelection) return entries;

  const standingBefore = Math.max(
    -10_000,
    Math.min(10_000, Math.floor(input.previousFactionStandingScore ?? 0)),
  );
  const requestedDelta = input.resolution.outcome === "exceptional_success" ? 150 : 100;
  const standingAfter = Math.min(10_000, standingBefore + requestedDelta);
  const standingDelta = standingAfter - standingBefore;
  if (standingDelta <= 0) return entries;

  entries.push(
    buildEntry({
      actionEventId: input.actionEventId,
      effectKind: "faction_standing_delta",
      targetEntityId: `faction:${input.agentId}:${factionId}`,
      scopeKey: `route:${input.routeSelection.routeId}`,
      delta: standingDelta,
      effectBlueprint: {
        agentId: input.agentId,
        explorerId: input.explorerId,
        factionId,
        standingDelta,
        standingAfter,
        journeyId: input.journeyId,
        episodeId: input.episodeId,
        objectiveId: input.objectiveId,
        routeId: input.routeSelection.routeId,
        sourceEventType: "hosted_action_recorded",
      },
      recordedAt: input.recordedAt,
    }),
  );

  return entries;
}
