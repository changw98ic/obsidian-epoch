/**
 * journeyMirrorConsequenceIntegration.ts — PR2 integration helper that builds
 * canonical epoch events from promoted {@link MirrorConsequenceLedgerEntry}
 * blueprints.
 *
 * Boundary contract:
 * - Pure function. Only dependencies are {@link EpochEventFactory},
 *   {@link EpochIdFactory}, the entry payload, and the region/trace event
 *   factories. No access to gameCore projection or journeyRuntime state.
 * - Output events are SHAPE-equivalent (same field layout, same dispatch
 *   table) to what {@link planJourneyWorldImpactEvents} produces, but are
 *   NOT byte-equivalent for multi-objective journeys. The ledger path
 *   captures `influenceScoreAfter` per-action at `submitHostedAction` time
 *   using the region score at that instant, without visibility into
 *   concurrent or prior objective influence deltas (mirror-mode
 *   `submitHostedAction` emits no canonical collateral). The current
 *   solidify path instead recomputes `previousInfluenceScore` against a
 *   running projection that already includes prior objectives' canonical
 *   influence events, yielding cumulative baselines. Integrators that
 *   require cumulative semantics must re-derive `influenceScoreAfter`
 *   against their own projection at promote time before calling this
 *   helper; the helper itself reads the stored snapshot verbatim.
 * - The `eventId` for each canonical event is derived from the blueprint's
 *   stable `entryId` (passed in via {@link BuildCanonicalEventFromMirrorEntryInput.entryId})
 *   so replay of the same ledger entry cannot produce duplicate canonical
 *   events.
 *
 * Step 2 engineering task 5: the solidify integration calls
 * {@link promoteMirrorConsequences} to read the entries, then for each entry
 * calls this helper to construct the canonical event, then writes the
 * promotion back through {@link markMirrorConsequencePromoted}.
 */

import type {
  EpochEvent,
  NpcIdentityDoubtPayload,
} from "./events.ts";
import type { EpochEventFactory } from "./eventFactory.ts";
import type { EpochIdFactory } from "./protocol.ts";
import type { MirrorConsequenceLedgerEntry } from "./journeySettlementRules.ts";
import {
  APPROACH_TAGS,
  type ApproachTag,
} from "./journeyStrategyRules.ts";
import {
  buildNpcIdentityDoubtEvent,
  roleplayScoreFromLedger,
  type DoubtStrength,
  type NpcDoubtEvent,
  type RoleplayScore,
} from "./journeyRoleplayRules.ts";
import {
  regionInfluenceChangedEvent,
  traceCreatedEvent,
} from "./regionEventLedgerEvents.ts";
import { degreeToStatus } from "./hiddenPrerequisiteRules.ts";
import { stripObjectTargetEntityId } from "./journeyWorldImpactRules.ts";

/**
 * Input for {@link buildCanonicalEventFromMirrorEntry}. The `entryId` is the
 * ledger primary key ({@link deriveMirrorConsequenceEntryId} output) and
 * seeds the canonical event id so promotion is replay-safe.
 */
export interface BuildCanonicalEventFromMirrorEntryInput {
  readonly entryId: string;
  readonly entry: MirrorConsequenceLedgerEntry;
  readonly makeEvent: EpochEventFactory;
  readonly idFactory: EpochIdFactory;
  /**
   * World minute at solidification time. Mirrors the
   * `Math.max(0, Math.floor(worldMinute))` clamp used by
   * {@link planJourneyWorldImpactEvents}.
   */
  readonly worldMinute: number;
}

function requireField<T>(blueprint: Readonly<Record<string, unknown>>, key: string): T {
  const value = blueprint[key];
  if (value === undefined || value === null) {
    throw new Error(`journey_mirror_consequence_blueprint_missing_field:${key}`);
  }
  return value as T;
}

const DOUBT_STRENGTHS: readonly DoubtStrength[] = ["low", "moderate", "high", "severe"];

function readApproachTags(
  blueprint: Readonly<Record<string, unknown>>,
): readonly ApproachTag[] {
  const value = blueprint.approachTags;
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("journey_mirror_consequence_blueprint_approach_tags_invalid");
  }
  const tags: ApproachTag[] = [];
  for (const candidate of value) {
    if (typeof candidate !== "string" || !APPROACH_TAGS.includes(candidate as ApproachTag)) {
      throw new Error(`journey_mirror_consequence_blueprint_approach_tag_invalid:${String(candidate)}`);
    }
    tags.push(candidate as ApproachTag);
  }
  return tags;
}

/**
 * Reconstruct the server-authored doubt observation carried by one mirror
 * entry. This is deliberately strict: a malformed blueprint cannot invent an
 * NPC, identity, source action, or approach observation during promotion.
 */
export function npcDoubtEventFromMirrorEntry(input: {
  readonly entryId: string;
  readonly entry: MirrorConsequenceLedgerEntry;
  /** Optional settlement scope asserted by the caller that owns the ledger. */
  readonly journeyId?: string;
}): NpcDoubtEvent {
  if (input.entry.effectKind !== "identity_doubt") {
    throw new Error(`journey_mirror_consequence_not_identity_doubt:${input.entry.effectKind}`);
  }
  const blueprint = input.entry.effectBlueprint;
  const agentId = requireField<string>(blueprint, "agentId");
  const identityId = requireField<string>(blueprint, "identityId");
  const journeyId = requireField<string>(blueprint, "journeyId");
  const npcId = requireField<string>(blueprint, "npcId");
  const regionId = requireField<string>(blueprint, "regionId");
  const doubtStrength = requireField<DoubtStrength>(blueprint, "doubtStrength");
  const reason = requireField<string>(blueprint, "reason");
  const sourceActionEventId = requireField<string>(blueprint, "sourceActionEventId");
  const mirrorLedgerEntryId = requireField<string>(blueprint, "mirrorLedgerEntryId");
  const recordedAt = requireField<string>(blueprint, "recordedAt");
  const factionId = blueprint.factionId;
  const approachTags = readApproachTags(blueprint);
  if (!DOUBT_STRENGTHS.includes(doubtStrength)) {
    throw new Error(`journey_mirror_consequence_blueprint_doubt_strength_invalid:${String(doubtStrength)}`);
  }
  if (doubtStrength === "low") {
    throw new Error("journey_mirror_consequence_blueprint_aligned_doubt_forbidden");
  }
  if (input.entry.targetEntityId !== `identity:${agentId}`) {
    throw new Error("journey_mirror_consequence_identity_target_mismatch");
  }
  if (agentId !== identityId || (input.journeyId !== undefined && journeyId !== input.journeyId)) {
    throw new Error("journey_mirror_consequence_identity_scope_mismatch");
  }
  if (sourceActionEventId !== input.entry.actionEventId) {
    throw new Error("journey_mirror_consequence_identity_source_action_mismatch");
  }
  if (mirrorLedgerEntryId !== input.entryId) {
    throw new Error("journey_mirror_consequence_identity_entry_mismatch");
  }
  if (recordedAt !== input.entry.recordedAt) {
    throw new Error("journey_mirror_consequence_identity_recorded_at_mismatch");
  }
  if (!npcId.startsWith("npc:roleplay:") || npcId !== `npc:roleplay:${regionId}`) {
    throw new Error(`journey_mirror_consequence_identity_npc_invalid:${npcId}`);
  }
  if (factionId !== undefined && (typeof factionId !== "string" || factionId.length === 0)) {
    throw new Error("journey_mirror_consequence_identity_faction_invalid");
  }
  const doubtEvent = buildNpcIdentityDoubtEvent({
    journeyId,
    identityId,
    npcId,
    regionId,
    doubtStrength,
    sourceActionEventId,
    reason,
    ...(typeof factionId === "string" ? { factionId } : {}),
    mirrorLedgerEntryId,
    recordedAt,
  });
  const blueprintDoubtEventId = requireField<string>(blueprint, "doubtEventId");
  if (blueprintDoubtEventId !== doubtEvent.doubtEventId) {
    throw new Error("journey_mirror_consequence_identity_doubt_id_mismatch");
  }
  // Keep the approach validation in the promotion boundary even though the
  // compact NpcDoubtEvent does not carry those tags; the canonical event does.
  void approachTags;
  return doubtEvent;
}

/**
 * Build the one roleplay projection from the final mirror-ledger snapshot.
 * The same helper is used by settlement and the result page so the page
 * cannot silently count a different set of doubt entries.
 */
export function roleplayScoreFromMirrorLedger(input: {
  readonly entries: readonly MirrorConsequenceLedgerEntry[];
  readonly journeyId: string;
  readonly recordedAt: string;
}): RoleplayScore {
  const doubtEvents = input.entries
    .filter((entry) => entry.effectKind === "identity_doubt")
    .map((entry) => {
      const entryId = entry.effectBlueprint.mirrorLedgerEntryId;
      if (typeof entryId !== "string" || !entryId.trim()) {
        throw new Error("journey_mirror_consequence_identity_entry_id_missing");
      }
      return npcDoubtEventFromMirrorEntry({
        entryId,
        entry,
        journeyId: input.journeyId,
      });
    });
  return roleplayScoreFromLedger(doubtEvents, input.recordedAt);
}

/**
 * Construct the canonical epoch event for one promoted ledger entry.
 *
 * Dispatch table:
 * - `region_influence_delta` → `region_influence_changed` (region aggregate)
 * - `trace_created` → `trace_created` (trace aggregate)
 * - `faction_standing_delta` → `agent_faction_standing_changed`
 *   (agent_identity aggregate)
 * - `object_mutation` / `object_destroy` → `world_object_state_changed`
 *   (world_object_state aggregate). PR5c additive.
 * - `hidden_prerequisite_destroyed` → `hidden_prerequisite_link_changed`
 *   (hidden_prerequisite_graph aggregate). PR5c additive.
 * - `identity_doubt` → `npc_identity_doubt` (agent_identity aggregate).
 *
 * Other effect kind (`npc_relationship_delta`) is out of scope and rejected.
 * Self-loss kinds (`resource_spent`,
 * `lifetime_adjusted`) are unreachable by ledger construction and also
 * rejected here as a defensive guard.
 */
export function buildCanonicalEventFromMirrorEntry(
  input: BuildCanonicalEventFromMirrorEntryInput,
): EpochEvent {
  const { entryId, entry, makeEvent, idFactory } = input;
  const blueprint = entry.effectBlueprint;
  const worldMinute = Math.max(0, Math.floor(input.worldMinute));
  switch (entry.effectKind) {
    case "region_influence_delta": {
      const regionId = requireField<string>(blueprint, "regionId");
      const agentId = requireField<string>(blueprint, "agentId");
      const explorerId = requireField<string>(blueprint, "explorerId");
      const influenceDelta = requireField<number>(blueprint, "influenceDelta");
      const influenceScoreAfter = requireField<number>(blueprint, "influenceScoreAfter");
      const reason = requireField<string>(blueprint, "reason");
      const sourceAggregateId = requireField<string>(blueprint, "sourceAggregateId");
      const influenceId = idFactory(
        "region_influence",
        `promote:${entryId}`,
      );
      return regionInfluenceChangedEvent(makeEvent, regionId, {
        influenceId,
        regionId,
        agentId,
        explorerId,
        influenceDelta,
        influenceScoreAfter,
        reason,
        sourceEventId: entry.actionEventId,
        sourceEventType: "hosted_action_recorded",
        sourceAggregateId,
        changedAt: entry.recordedAt,
        worldMinute,
      }, agentId);
    }
    case "trace_created": {
      const regionId = requireField<string>(blueprint, "regionId");
      const title = requireField<string>(blueprint, "title");
      const summary = requireField<string>(blueprint, "summary");
      const sourceAggregateId = requireField<string>(blueprint, "sourceAggregateId");
      const participantAgentIds = requireField<string[]>(blueprint, "participantAgentIds");
      const participantExplorerIds = requireField<string[]>(blueprint, "participantExplorerIds");
      const agentId = participantAgentIds[0];
      if (!agentId) throw new Error("journey_mirror_consequence_blueprint_missing_agent");
      const influenceId = idFactory(
        "region_influence",
        `promote-trace:${entryId}`,
      );
      const traceId = idFactory("trace", `promote:${entryId}`);
      return traceCreatedEvent(makeEvent, traceId, {
        traceId,
        regionId,
        title,
        summary,
        sourceEventType: "hosted_action_recorded",
        sourceEventIds: [entry.actionEventId],
        sourceAggregateId,
        relatedInfluenceIds: [influenceId],
        participantAgentIds,
        participantExplorerIds,
        createdAt: entry.recordedAt,
      }, agentId);
    }
    case "faction_standing_delta": {
      const agentId = requireField<string>(blueprint, "agentId");
      const explorerId = requireField<string>(blueprint, "explorerId");
      const factionId = requireField<string>(blueprint, "factionId");
      const standingDelta = requireField<number>(blueprint, "standingDelta");
      const standingAfter = requireField<number>(blueprint, "standingAfter");
      const journeyId = requireField<string>(blueprint, "journeyId");
      const episodeId = requireField<string>(blueprint, "episodeId");
      const objectiveId = requireField<string>(blueprint, "objectiveId");
      const routeId = requireField<string>(blueprint, "routeId");
      const standingId = idFactory("faction_standing", `promote:${entryId}`);
      return makeEvent("agent_faction_standing_changed", standingId, {
        standingId,
        agentId,
        explorerId,
        factionId,
        standingDelta,
        standingAfter,
        journeyId,
        episodeId,
        objectiveId,
        routeId,
        sourceEventId: entry.actionEventId,
        changedAt: entry.recordedAt,
        worldMinute,
      }, {
        aggregateType: "agent_identity",
        agentId,
      });
    }
    case "object_mutation":
    case "object_destroy": {
      // PR5c: physical object lifecycle transition. The objectId is recovered
      // from the `object:${objectId}` targetEntityId convention. The status
      // is derived from degree via the shared threshold table. The
      // world_object_state_changed event is append-only to the projection;
      // irreversibility is enforced by applyEvent (destroyed is terminal).
      const objectId = stripObjectTargetEntityId(entry.targetEntityId);
      if (!objectId) throw new Error(`journey_mirror_consequence_object_target_invalid:${entry.targetEntityId}`);
      const regionId = requireField<string>(blueprint, "regionId");
      const degree = requireField<number>(blueprint, "degree");
      const sourceAggregateId = requireField<string>(blueprint, "sourceAggregateId");
      const statusAfter = degreeToStatus(degree);
      const aggregateId = `world_object:${objectId}`;
      const worldObjectEventId = idFactory("event", `promote:${entryId}`);
      return makeEvent("world_object_state_changed", aggregateId, {
        objectId,
        regionId,
        statusAfter,
        degree,
        sourceActionEventId: entry.actionEventId,
        sourceAggregateId,
        changedAt: entry.recordedAt,
        worldMinute,
      }, {
        aggregateType: "world_object_state",
        eventId: worldObjectEventId,
      });
    }
    case "hidden_prerequisite_destroyed": {
      // PR5c: hidden-prerequisite link status change. The objectiveId is
      // recovered from the `hidden:${objectiveId}` targetEntityId convention.
      // The prerequisiteObjectId and regionId come from the blueprint.
      const targetId = entry.targetEntityId;
      if (!targetId.startsWith("hidden:")) {
        throw new Error(`journey_mirror_consequence_hidden_target_invalid:${targetId}`);
      }
      const objectiveId = targetId.slice("hidden:".length);
      if (!objectiveId) throw new Error(`journey_mirror_consequence_hidden_objective_empty:${targetId}`);
      const prerequisiteObjectId = requireField<string>(blueprint, "prerequisiteObjectId");
      const regionId = requireField<string>(blueprint, "regionId");
      const changedAt = entry.recordedAt;
      const aggregateId = `hidden_prereq:${regionId}:${objectiveId}`;
      const linkEventId = idFactory("event", `promote:${entryId}`);
      return makeEvent("hidden_prerequisite_link_changed", aggregateId, {
        regionId,
        objectiveId,
        prerequisiteObjectId,
        statusAfter: "destroyed",
        sourceActionEventId: entry.actionEventId,
        sourceLedgerEntryId: entryId,
        changedAt,
      }, {
        aggregateType: "hidden_prerequisite_graph",
        eventId: linkEventId,
      });
    }
    case "identity_doubt": {
      const doubtEvent = npcDoubtEventFromMirrorEntry({ entryId, entry });
      const blueprint = entry.effectBlueprint;
      const approachTags = readApproachTags(blueprint);
      const payload: NpcIdentityDoubtPayload = {
        journeyId: doubtEvent.journeyId,
        agentId: doubtEvent.identityId,
        identityId: doubtEvent.identityId,
        npcId: doubtEvent.npcId,
        ...(doubtEvent.factionId ? { factionId: doubtEvent.factionId } : {}),
        regionId: doubtEvent.regionId,
        doubtStrength: doubtEvent.doubtStrength,
        reason: doubtEvent.reason,
        sourceActionEventId: doubtEvent.sourceActionEventId,
        approachTags,
        mirrorLedgerEntryId: doubtEvent.mirrorLedgerEntryId,
        recordedAt: doubtEvent.recordedAt,
      };
      return makeEvent("npc_identity_doubt", doubtEvent.identityId, payload, {
        aggregateType: "agent_identity",
        agentId: doubtEvent.identityId,
        eventId: idFactory("event", `promote:${entryId}`),
      });
    }
    case "resource_spent":
    case "lifetime_adjusted":
      throw new Error(
        `journey_mirror_consequence_promote_self_loss_forbidden:${entry.effectKind}`,
      );
    case "npc_relationship_delta":
      throw new Error(
        `journey_mirror_consequence_promote_kind_not_supported:${entry.effectKind}`,
      );
    default: {
      const _exhaustive: never = entry.effectKind;
      throw new Error(
        `journey_mirror_consequence_promote_unhandled_kind:${String(_exhaustive)}`,
      );
    }
  }
}
