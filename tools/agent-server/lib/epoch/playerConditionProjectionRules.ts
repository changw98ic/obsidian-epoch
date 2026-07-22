import type { CausalWorldEventV1 } from "./causalContracts.ts";
import type { CausalWorldSnapshotV1 } from "./causalWorldSnapshot.ts";

export const PLAYER_CONDITION_PROJECTION_VERSION = "player-condition-projection.v1" as const;

export interface PlayerConditionUnavailableProjection {
  readonly status: "unavailable";
  readonly version: typeof PLAYER_CONDITION_PROJECTION_VERSION;
  readonly reason: string;
}

export interface PlayerConditionInjuryState {
  readonly injuryId: string;
  readonly state: string;
  readonly cursor: CausalWorldSnapshotV1["replayCursor"] | unknown;
  readonly reasonCode: string;
  readonly sourceEventId: string;
  readonly sourceEventIds: readonly string[];
  readonly occurredAtWorldMinute: number;
  readonly recordedAt: string;
  readonly provenance: {
    readonly kind: "causal_state_transition";
    readonly effectId: string;
    readonly operation: string;
    readonly targetRef: string;
    readonly transitionId: string;
  };
  readonly transitions: readonly PlayerConditionInjuryTransition[];
}

export interface PlayerConditionAvailableProjection {
  readonly status: "available";
  readonly version: typeof PLAYER_CONDITION_PROJECTION_VERSION;
  readonly identityId: string;
  readonly cursor: CausalWorldSnapshotV1["replayCursor"] | unknown;
  readonly sourceEventIds: readonly string[];
  readonly provenance: {
    readonly kind: "causal_replay";
    readonly worldId: string;
    readonly eventCount: number;
    readonly completeCursor: true;
    readonly emptyInjuriesProvenance?: "complete_cursor_no_identity_health_injury_transitions";
  };
  readonly condition: {
    readonly healthState: "healthy" | "injured" | "lasting_injury" | "unknown";
    readonly injurySeverity: number;
  };
  readonly injuries: readonly PlayerConditionInjuryState[];
}

export type PlayerConditionProjection =
  | PlayerConditionAvailableProjection
  | PlayerConditionUnavailableProjection;

export interface ProjectPlayerConditionInput {
  readonly snapshot?: CausalWorldSnapshotV1;
  readonly canonicalCursor?: unknown;
  readonly causalEvents: readonly CausalWorldEventV1[];
  readonly identityId?: string;
  readonly agentId?: string;
}

function targetRefKey(ref: { readonly entityType: string; readonly entityId: string }): string {
  return `${ref.entityType}:${ref.entityId}`;
}

function targetMatchesIdentity(
  ref: { readonly entityType: string; readonly entityId: string },
  input: ProjectPlayerConditionInput,
): boolean {
  const ids = [input.identityId, input.agentId].filter((value): value is string => Boolean(value));
  if (ids.length === 0) return false;
  return ids.some((id) =>
    ref.entityId === id
    || targetRefKey(ref) === id
    || targetRefKey(ref) === `identity:${id}`
    || targetRefKey(ref) === `agent:${id}`);
}

function injurySeverity(state: string): number {
  if (state === "lasting_injury") return 75;
  if (state === "injured") return 40;
  if (state === "healing" || state === "recovering") return 15;
  return 0;
}

type PlayerConditionInjuryTransitionKind = "new_injury" | "worsened" | "healing" | "recovered" | "cleared";

interface PlayerConditionInjuryTransition {
  readonly kind: PlayerConditionInjuryTransitionKind;
  readonly injuryId: string;
  readonly state: string;
  readonly cursor: CausalWorldSnapshotV1["replayCursor"] | unknown;
  readonly reasonCode: string;
  readonly sourceEventId: string;
  readonly sourceEventIds: readonly string[];
  readonly occurredAtWorldMinute: number;
  readonly recordedAt: string;
  readonly provenance: PlayerConditionInjuryState["provenance"];
}

const INJURY_ACTIVE_STATES = new Set(["injured", "lasting_injury"]);
const INJURY_HEALING_STATES = new Set(["healing", "recovering", "treated", "treatment", "under_treatment"]);
const INJURY_CLEARED_STATES = new Set(["healthy", "recovered", "cleared", "removed", "healed"]);

function uniqueInCanonicalOrder(values: readonly string[]): readonly string[] {
  return [...new Set(values)];
}

function injuryTransitionKind(state: string, previous?: PlayerConditionInjuryState): PlayerConditionInjuryTransitionKind | undefined {
  if (state === "lasting_injury" && previous && previous.state !== "lasting_injury") return "worsened";
  if (INJURY_ACTIVE_STATES.has(state)) return previous ? "worsened" : "new_injury";
  if (state === "healing" || state === "recovering" || INJURY_HEALING_STATES.has(state)) return "healing";
  if (INJURY_CLEARED_STATES.has(state)) return state === "removed" || state === "cleared" ? "cleared" : "recovered";
  return undefined;
}

export function projectPlayerCondition(input: ProjectPlayerConditionInput): PlayerConditionProjection {
  const identityId = input.identityId || input.agentId;
  if (!identityId) {
    return {
      status: "unavailable",
      version: PLAYER_CONDITION_PROJECTION_VERSION,
      reason: "identity id is required to project player condition",
    };
  }
  const cursor = input.snapshot?.replayCursor || input.canonicalCursor;
  if (!cursor) {
    return {
      status: "unavailable",
      version: PLAYER_CONDITION_PROJECTION_VERSION,
      reason: "complete causal replay cursor is required to prove player condition",
    };
  }

  const injuriesById = new Map<string, PlayerConditionInjuryState>();

  for (const event of input.causalEvents) {
    for (const effect of event.effects) {
      if (effect.effectType !== "state_transition") continue;
      if (effect.after.stateMachineId !== "identity_health") continue;
      if (!targetMatchesIdentity(effect.targetRef, input)) continue;

      const injuryId = effect.after.transitionId;
      const state = effect.after.toState;
      const previous = injuriesById.get(injuryId);
      const transitionKind = injuryTransitionKind(state, previous);
      if (!transitionKind) continue;

      const transitionSourceEventIds = uniqueInCanonicalOrder([event.eventId, ...effect.sourceEventIds]);
      const provenance = {
        kind: "causal_state_transition" as const,
        effectId: effect.effectId,
        operation: effect.operation,
        targetRef: targetRefKey(effect.targetRef),
        transitionId: effect.after.transitionId,
      };
      const transition: PlayerConditionInjuryTransition = {
        kind: transitionKind,
        injuryId,
        state,
        cursor,
        reasonCode: effect.after.reasonCode,
        sourceEventId: event.eventId,
        sourceEventIds: transitionSourceEventIds,
        occurredAtWorldMinute: event.occurredAtWorldMinute,
        recordedAt: event.recordedAt,
        provenance,
      };
      const sourceEventIds = uniqueInCanonicalOrder([
        ...(previous?.sourceEventIds || []),
        ...transitionSourceEventIds,
      ]);
      const transitions = [...(previous?.transitions || []), transition];

      if (transitionKind === "cleared" || transitionKind === "recovered") {
        injuriesById.delete(injuryId);
        continue;
      }

      injuriesById.set(injuryId, {
        injuryId,
        state,
        cursor,
        reasonCode: effect.after.reasonCode,
        sourceEventId: event.eventId,
        sourceEventIds,
        occurredAtWorldMinute: event.occurredAtWorldMinute,
        recordedAt: event.recordedAt,
        provenance,
        transitions,
      });
    }
  }

  const injuries = [...injuriesById.values()].sort((left, right) =>
    right.occurredAtWorldMinute - left.occurredAtWorldMinute
    || right.recordedAt.localeCompare(left.recordedAt)
    || left.injuryId.localeCompare(right.injuryId));

  const sourceEventIds = uniqueInCanonicalOrder(injuries.flatMap((injury) => injury.sourceEventIds));
  const active = injuries[0];
  return {
    status: "available",
    version: PLAYER_CONDITION_PROJECTION_VERSION,
    identityId,
    cursor,
    sourceEventIds,
    provenance: {
      kind: "causal_replay",
      worldId: input.snapshot?.worldId || "epoch:runtime",
      eventCount: typeof (cursor as { readonly eventCount?: unknown }).eventCount === "number"
        ? (cursor as { readonly eventCount: number }).eventCount
        : input.causalEvents.length,
      completeCursor: true,
      ...(injuries.length === 0 ? { emptyInjuriesProvenance: "complete_cursor_no_identity_health_injury_transitions" } : {}),
    },
    condition: {
      healthState: active?.state === "lasting_injury" ? "lasting_injury" : active?.state === "injured" ? "injured" : "healthy",
      injurySeverity: active ? injurySeverity(active.state) : 0,
    },
    injuries,
  };
}
