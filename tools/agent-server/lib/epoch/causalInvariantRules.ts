import type {
  CausalEffectV1,
  CausalWorldEventV1,
  CausalRootReason,
} from "./causalContracts.ts";
import { CausalValidationError } from "./causalContracts.ts";

export type CausalInvariantErrorCode =
  | "CAUSAL_SCHEMA_INVALID"
  | "CAUSAL_PARENT_MISSING"
  | "CAUSAL_CYCLE_DETECTED"
  | "ROOT_REASON_DENIED"
  | "ROOT_PRESSURE_REQUIRED"
  | "ORPHAN_EFFECT"
  | "STREAM_VERSION_CONFLICT";

export interface CausalEventReference {
  readonly eventId: string;
  readonly worldId: string;
  readonly occurredAtWorldMinute: number;
  readonly stream?: {
    readonly streamType: string;
    readonly streamId: string;
    readonly streamVersion: number;
  };
  readonly causality?: {
    readonly causalParentEventIds: readonly string[];
  };
  readonly legacyCausalStatus?: "legacy_attributed" | "legacy_unattributed" | "migration_root";
}

export interface CausalInvariantPolicy {
  readonly rootEventTypes?: readonly string[] | ReadonlySet<string>;
  readonly rootReasonsByEventType?: Readonly<Record<string, readonly CausalRootReason[] | readonly string[]>>;
  readonly requiresRootPressure?: (event: CausalWorldEventV1) => boolean;
  readonly eventTypeRequiresRootPressure?: readonly string[] | ReadonlySet<string>;
  readonly directEvidenceEventIds?: readonly string[] | ReadonlySet<string>;
  readonly allowEmptyEffectsForEventTypes?: readonly string[] | ReadonlySet<string>;
}

export interface CausalStreamExpectation {
  readonly streamType: string;
  readonly streamId: string;
  readonly expectedNextVersion: number;
  readonly latestWorldMinute?: number;
}

export interface CausalInvariantValidationInput {
  readonly event: CausalWorldEventV1;
  readonly knownEvents: Readonly<Record<string, CausalEventReference>>;
  readonly policy: CausalInvariantPolicy;
  readonly stream?: CausalStreamExpectation;
}

const RETRYABLE_INVARIANT_CODES: ReadonlySet<CausalInvariantErrorCode> = new Set([
  "CAUSAL_PARENT_MISSING",
  "STREAM_VERSION_CONFLICT",
]);

export function validateCausalInvariantRules(input: CausalInvariantValidationInput): readonly CausalValidationError[] {
  return [
    ...validateStreamAndWorldTime(input),
    ...validateParentAndRootRules(input),
    ...validateEffectSources(input),
  ];
}

export function causalParentGraphHasCycle(
  eventId: string,
  parentEventIds: readonly string[],
  knownEvents: Readonly<Record<string, CausalEventReference>>,
): boolean {
  const visited = new Set<string>();
  const active = new Set<string>([eventId]);

  const visit = (currentId: string): boolean => {
    if (active.has(currentId)) return true;
    if (visited.has(currentId)) return false;
    visited.add(currentId);
    const current = knownEvents[currentId];
    if (!current) return false;
    active.add(currentId);
    for (const parentId of current.causality?.causalParentEventIds || []) {
      if (visit(parentId)) return true;
    }
    active.delete(currentId);
    return false;
  };

  return parentEventIds.some((parentId) => visit(parentId));
}

function validateStreamAndWorldTime(input: CausalInvariantValidationInput): readonly CausalValidationError[] {
  const errors: CausalValidationError[] = [];
  const expected = input.stream;
  if (!expected) return errors;

  const stream = input.event.stream;
  if (
    stream.streamType !== expected.streamType ||
    stream.streamId !== expected.streamId ||
    stream.streamVersion !== expected.expectedNextVersion
  ) {
    errors.push(invariantError("STREAM_VERSION_CONFLICT", "event stream does not match expected next stream version", "stream", input.event));
  }
  if (
    typeof expected.latestWorldMinute === "number" &&
    input.event.occurredAtWorldMinute < expected.latestWorldMinute
  ) {
    errors.push(invariantError("STREAM_VERSION_CONFLICT", "event world time is earlier than current stream world time", "occurredAtWorldMinute", input.event));
  }
  return errors;
}

function validateParentAndRootRules(input: CausalInvariantValidationInput): readonly CausalValidationError[] {
  const event = input.event;
  const errors: CausalValidationError[] = [];
  const parentIds = uniqueStrings(event.causality.causalParentEventIds);
  const rootReason = event.causality.rootReason;

  if (!parentIds.length) {
    if (!rootEventAllowed(input.policy, event.eventType, rootReason)) {
      errors.push(invariantError("CAUSAL_PARENT_MISSING", "non-root event requires at least one causal parent", "causality.causalParentEventIds", event));
      if (rootReason) {
        errors.push(invariantError("ROOT_REASON_DENIED", "event type is not allowed to use this root reason", "causality.rootReason", event));
      }
    }
  } else {
    if (rootReason) {
      errors.push(invariantError("ROOT_REASON_DENIED", "root reason is only allowed on authorized root events", "causality.rootReason", event));
    }
    for (const parentId of parentIds) {
      const parent = input.knownEvents[parentId];
      if (!parent) {
        errors.push(invariantError("CAUSAL_PARENT_MISSING", "causal parent event does not exist", "causality.causalParentEventIds", event));
        continue;
      }
      if (parent.worldId !== event.worldId) {
        errors.push(invariantError("CAUSAL_PARENT_MISSING", "causal parent must belong to the same world", "causality.causalParentEventIds", event));
      }
      if (parent.occurredAtWorldMinute > event.occurredAtWorldMinute) {
        errors.push(invariantError("CAUSAL_PARENT_MISSING", "causal parent cannot be a future event", "causality.causalParentEventIds", event));
      }
    }
    if (parentIds.includes(event.eventId) || causalParentGraphHasCycle(event.eventId, parentIds, input.knownEvents)) {
      errors.push(invariantError("CAUSAL_CYCLE_DETECTED", "causal parent graph contains a cycle", "causality.causalParentEventIds", event));
    }
  }

  if (rootPressureRequired(input.policy, event) && !uniqueStrings(event.causality.rootPressureIds).length) {
    errors.push(invariantError("ROOT_PRESSURE_REQUIRED", "event requires at least one root pressure", "causality.rootPressureIds", event));
  }

  return errors;
}

function validateEffectSources(input: CausalInvariantValidationInput): readonly CausalValidationError[] {
  const event = input.event;
  if (!event.effects.length && !refSetHas(input.policy.allowEmptyEffectsForEventTypes, event.eventType)) {
    return [invariantError("ORPHAN_EFFECT", "event type does not allow empty effects", "effects", event)];
  }

  const allowedSourceIds = new Set<string>([
    ...uniqueStrings(event.causality.causalParentEventIds),
    ...uniqueStrings(event.evidenceRefs),
    ...refSetValues(input.policy.directEvidenceEventIds),
    event.command.commandId,
    event.eventId,
  ]);

  const errors: CausalValidationError[] = [];
  event.effects.forEach((effect, index) => {
    const sourceIds = uniqueStrings(effect.sourceEventIds);
    if (!sourceIds.length) {
      errors.push(invariantError("ORPHAN_EFFECT", "effect requires at least one source event", `effects.${index}.sourceEventIds`, event, effect));
      return;
    }
    if (!sourceIds.every((sourceId) => allowedSourceIds.has(sourceId))) {
      errors.push(invariantError("ORPHAN_EFFECT", "effect source is not a known or allowed direct source", `effects.${index}.sourceEventIds`, event, effect));
    }
  });
  return errors;
}

function rootEventAllowed(
  policy: CausalInvariantPolicy,
  eventType: string,
  rootReason: CausalRootReason | undefined,
): boolean {
  if (!rootReason || !refSetHas(policy.rootEventTypes, eventType)) return false;
  const allowedReasons = policy.rootReasonsByEventType?.[eventType];
  return !allowedReasons || allowedReasons.includes(rootReason);
}

function rootPressureRequired(policy: CausalInvariantPolicy, event: CausalWorldEventV1): boolean {
  if (policy.requiresRootPressure?.(event)) return true;
  return refSetHas(policy.eventTypeRequiresRootPressure, event.eventType);
}

function uniqueStrings(values: readonly string[] | undefined): readonly string[] {
  return [...new Set((values || []).filter((value) => typeof value === "string" && value))];
}

function refSetHas(refs: readonly string[] | ReadonlySet<string> | undefined, ref: string): boolean {
  if (!refs) return false;
  return Array.isArray(refs) ? refs.includes(ref) : (refs as ReadonlySet<string>).has(ref);
}

function refSetValues(refs: readonly string[] | ReadonlySet<string> | undefined): readonly string[] {
  if (!refs) return [];
  return Array.isArray(refs) ? uniqueStrings(refs) : [...(refs as ReadonlySet<string>)];
}

function invariantError(
  code: CausalInvariantErrorCode,
  message: string,
  path: string,
  event: CausalWorldEventV1,
  effect?: CausalEffectV1,
): CausalValidationError {
  return new CausalValidationError(code, {
    message,
    path,
    eventId: event.eventId,
    effectId: effect?.effectId,
    retryable: RETRYABLE_INVARIANT_CODES.has(code),
  });
}
