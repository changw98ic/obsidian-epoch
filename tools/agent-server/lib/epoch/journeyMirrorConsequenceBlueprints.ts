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
import {
  deriveMirrorConsequenceDedupeKey,
  deriveMirrorConsequenceEntryId,
} from "./journeyMirrorLedger.ts";
import type { ApproachTag } from "./journeyStrategyRules.ts";
import {
  buildNpcIdentityDoubtEvent,
  classifyRoleplayDeviation,
  compareApproachToLifePattern,
  deviationClassificationToDoubtStrength,
  type DoubtStrength,
  type ExpectedLifePattern,
} from "./journeyRoleplayRules.ts";
import { DOUBT_PENALTY_BPS } from "./journeyViabilityRules.ts";

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

// ---------------------------------------------------------------------------
// PR5b — roleplay-doubt mirror-ledger blueprint.
//
// Pure companion to {@link planJourneyMirrorConsequenceBlueprints} that
// classifies a hosted action's observed approach tags against the identity's
// frozen {@link ExpectedLifePattern} and emits 0 or 1 identity_doubt ledger
// entries. The hook is LLM-free: every classification decision is rule
// logic. The hook is read-only with respect to canonical world state — it
// produces a mirror-ledger entry that surfaces in collateral scoring and
// (after solidify) viability doubtedBy aggregation, but it does NOT write a
// canonical event at action time.
//
// Hook contract (spec §6.9):
//   - aligned actions emit zero entries (no doubt, no ledger write).
//   - forbidden_action / major_deviation / minor_deviation emit exactly one
//     identity_doubt entry per (actionEventId, identityId). Replay idempotency
//     is enforced by the ledger's composite-key dedupe (see
//     {@link deriveMirrorConsequenceDedupeKey} for the identity_doubt branch).
//   - the entry's effectBlueprint embeds the full NpcIdentityDoubtPayload
//     (events.ts:1293) so solidify-time promotion can rebuild the canonical
//     npc_identity_doubt event with byte-identical fields.
//   - the entry's consequenceType is 'collateral' so it flows through the
//     same solidify promotion path as region/trace/faction entries.
// ---------------------------------------------------------------------------

/**
 * Input shape for {@link planJourneyRoleplayDoubt}. The `observed` array is
 * the signed action's `approachTags` — server-derived at task-action build
 * time and re-verifiable via the action signature, NEVER client-supplied.
 */
export interface PlanJourneyRoleplayDoubtInput {
  /** Frozen pattern bound to the acting identity. */
  readonly pattern: ExpectedLifePattern;
  /** Approach tags observed on the signed action (server-derived). */
  readonly observed: readonly ApproachTag[];
  /** Acting identity id; also the targetEntityId of the ledger entry. */
  readonly agentId: string;
  readonly journeyId: string;
  readonly episodeId: string;
  readonly regionId: string;
  /** Faction bearing the route selection (when the action selected one). */
  readonly factionId?: string;
  /** Canonical event id of the recorded hosted action. */
  readonly actionEventId: string;
  readonly recordedAt: string;
  /**
   * PR5b fix: approach tags sanctioned by the current mission context. When
   * provided, the planner applies a mission-aligned override — if every
   * observed tag is a member of this set, the action is classified 'aligned'
   * and NO doubt entry is emitted. The override is principled per spec §6.9:
   * "the deviation should be measured against what the mission demands, not
   * against a static role bucket that cannot see the mission context". A
   * hunter on a support mission is not deviating when the mission itself
   * demands support/logistics approaches.
   *
   * The caller (gameCore submitHostedAction hook) derives this set as the
   * union of approachTags across the current scene contract's actionOptions
   * — i.e. the approaches the server is offering right now. By construction,
   * a server-offered action's tags are a subset of this union, so the
   * override fires for any normal chosen action. The roleplay hook therefore
   * classifies offered actions as mission-aligned; doubts only fire when the
   * action's tags are NOT a subset (e.g. a legacy action with tags outside
   * the offered palette, or a future extension where agents take non-offered
   * actions). This keeps the hook LLM-free and read-only.
   *
   * Optional: when omitted, the planner falls back to the static-pattern
   * comparison (preserving the legacy contract for unit tests and any caller
   * that has no scene context).
   */
  readonly missionSanctionedApproaches?: readonly ApproachTag[];
}

/**
 * Single deterministic system observer id per region. v1 does not model
 * individual NPC witnesses for roleplay doubt; the doubt is attributed to a
 * stable region-scoped observer so viability doubtedBy aggregation keys
 * cleanly per region. The id is intentionally namespaced (`npc:roleplay:*`)
 * so it cannot collide with catalog-NPC ids (`npc_*`).
 *
 * Changing this namespacing MUST bump {@link ROLEPLAY_PATTERN_VERSION} in
 * journeyRoleplayRules — doubtedBy is persisted onto IdentityViability and
 * a re-key would silently drop historical doubts on already-stored identities.
 */
function roleplayObserverNpcId(regionId: string): string {
  return `npc:roleplay:${regionId}`;
}

/**
 * Fixed server-template reason strings keyed by classification. Reasons are
 * NOT LLM text — they are a fixed enumeration persisted onto the canonical
 * npc_identity_doubt event for downstream audit/telemetry. Bumping this
 * table MUST bump {@link ROLEPLAY_PATTERN_VERSION}.
 */
const REASON_FOR_CLASSIFICATION: Readonly<Record<string, string>> = Object.freeze({
  minor_deviation: "roleplay_minor_deviation",
  major_deviation: "roleplay_major_deviation",
  forbidden_action: "roleplay_forbidden_action",
});

/**
 * Plan the roleplay-doubt mirror-ledger entry for one hosted action. Returns
 * an empty array when:
 *   - the action's observed tags classify as 'aligned' (no doubt)
 *   - the pattern's expected/forbidden sets are empty (fail-closed: the
 *     identity has no norm to deviate from, so no signal fires)
 *
 * Otherwise returns exactly one {@link MirrorConsequenceLedgerEntry} whose
 * `effectKind` is 'identity_doubt', whose `targetEntityId` is
 * `identity:${agentId}`, and whose `effectBlueprint` embeds the full
 * {@link NpcIdentityDoubtPayload}-shaped record (including the deterministically
 * derived `doubtEventId`). The entry's `dedupeKey` is derived through
 * {@link deriveMirrorConsequenceDedupeKey} so ledger append is idempotent on
 * the (actionEventId, identityId) composite.
 *
 * Pure: same inputs → same outputs, including deterministic entryId. No IO,
 * no gameCore/eventFactory dependency.
 */
export function planJourneyRoleplayDoubt(
  input: PlanJourneyRoleplayDoubtInput,
): readonly MirrorConsequenceLedgerEntry[] {
  // Fail-open when the pattern carries no norm (unknown role bucket at
  // issuance). An empty norm produces no forbidden/expected signal so the
  // comparator yields all-empty subsets → classification 'aligned'. We
  // short-circuit here to avoid emitting a doubt entry for an identity that
  // has no norm to deviate from.
  if (input.pattern.expectedApproaches.length === 0 && input.pattern.forbiddenApproaches.length === 0) {
    return [];
  }
  // Fail-open when the action carried no observable approach tags (legacy
  // action). The roleplay hook MUST NOT fabricate a doubt from an empty
  // observation — that would surface every legacy action as 'aligned but
  // missing all expected' and inflate doubt.
  if (input.observed.length === 0) return [];

  // PR5b fix: mission-aligned override. When the caller supplies
  // missionSanctionedApproaches (the union of approachTags across the
  // current scene contract's actionOptions), and EVERY observed tag is a
  // member of that set, the action is "mission-aligned" — the server
  // offered the action and the agent took it, so there is no roleplay
  // deviation to record against the identity's static pattern. This is the
  // principled fix for the regression where a combat-role identity on a
  // support mission fires a severe doubt on every action because the
  // pattern's static forbidden set cannot see the mission context (spec
  // §6.9: "the deviation should be measured against what the mission
  // demands, not against a static role bucket"). The override is LLM-free
  // and pure: same inputs → same output. It does NOT relax the pattern for
  // actions whose tags fall OUTSIDE the mission-sanctioned set — those
  // still flow through the normal classification below.
  if (input.missionSanctionedApproaches && input.missionSanctionedApproaches.length > 0) {
    const sanctionedSet = new Set<ApproachTag>(input.missionSanctionedApproaches);
    let allSanctioned = true;
    for (const tag of input.observed) {
      if (!sanctionedSet.has(tag)) {
        allSanctioned = false;
        break;
      }
    }
    if (allSanctioned) return [];
  }

  const comparison = compareApproachToLifePattern(input.observed, input.pattern);
  const classification = classifyRoleplayDeviation(comparison, input.pattern);
  if (classification === "aligned") return [];

  const doubtStrength = deviationClassificationToDoubtStrength(classification);
  const reason = REASON_FOR_CLASSIFICATION[classification] ?? "roleplay_deviation";
  const npcId = roleplayObserverNpcId(input.regionId);

  // Derive the entryId BEFORE building the embedded payload so the payload's
  // `mirrorLedgerEntryId` matches the ledger's composite-key derivation. This
  // is what the canonical npc_identity_doubt event's payload expects.
  const dedupeKey = deriveMirrorConsequenceDedupeKey({
    effectKind: "identity_doubt",
    targetEntityId: `identity:${input.agentId}`,
    actionEventId: input.actionEventId,
  });
  const ledgerEntryId = deriveMirrorConsequenceEntryId({
    journeyId: input.journeyId,
    actionEventId: input.actionEventId,
    dedupeKey,
  });

  // Build the canonical NpcDoubtEvent shape purely to derive doubtEventId
  // deterministically. The event itself is not emitted here — only its id
  // and shape are embedded into the ledger blueprint so solidify-time
  // promotion can reconstruct the canonical event with byte-identical fields.
  const doubtEvent = buildNpcIdentityDoubtEvent({
    journeyId: input.journeyId,
    identityId: input.agentId,
    npcId,
    regionId: input.regionId,
    doubtStrength,
    sourceActionEventId: input.actionEventId,
    reason,
    ...(input.factionId ? { factionId: input.factionId } : {}),
    mirrorLedgerEntryId: ledgerEntryId,
    recordedAt: input.recordedAt,
  });

  const effectBlueprint: Readonly<Record<string, unknown>> = {
    // NpcIdentityDoubtPayload (events.ts:1293) — full field set.
    journeyId: input.journeyId,
    agentId: input.agentId,
    identityId: input.agentId,
    npcId,
    ...(input.factionId ? { factionId: input.factionId } : {}),
    regionId: input.regionId,
    doubtStrength,
    reason,
    sourceActionEventId: input.actionEventId,
    approachTags: [...input.observed],
    mirrorLedgerEntryId: ledgerEntryId,
    doubtEventId: doubtEvent.doubtEventId,
    recordedAt: input.recordedAt,
  };

  const entry: MirrorConsequenceLedgerEntry = {
    actionEventId: input.actionEventId,
    effectKind: "identity_doubt",
    targetEntityId: `identity:${input.agentId}`,
    // delta is the doubtStrength's bps magnitude (negative — a doubt is a
    // penalty). The scoring pass reads doubtStrength from the blueprint
    // rather than delta, but we persist a signed magnitude for audit parity
    // with other effect kinds.
    delta: -DOUBT_PENALTY_BPS[doubtStrength],
    consequenceType: COLLATERAL,
    sourceEventIds: [input.actionEventId],
    effectBlueprint,
    recordedAt: input.recordedAt,
    dedupeKey,
  };
  return [entry];
}
