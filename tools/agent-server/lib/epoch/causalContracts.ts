export const CAUSAL_COMMAND_SCHEMA_VERSION = "1.0.0" as const;
export const CAUSAL_EVENT_SCHEMA_VERSION = "1.0.0" as const;
export const CAUSAL_EFFECT_SCHEMA_VERSION = "1.0.0" as const;
export const CAUSAL_RESULT_MANIFEST_VERSION = "1.0.0" as const;

export type CausalNamespace = "world" | "lineage" | "identity" | "run";
export type CausalEnforcementMode = "observe" | "warn" | "block" | "retired";
export type CausalRootReason =
  | "world_genesis"
  | "external_clock"
  | "deterministic_schedule"
  | "content_migration"
  | "authorized_admin_correction"
  | "external_verified_input";

export type CausalActorType =
  | "player_identity"
  | "npc"
  | "household"
  | "organization"
  | "system";

export interface CausalActorRef {
  readonly actorType: CausalActorType;
  readonly actorId: string;
}

export interface CausalEntityRef {
  readonly entityType: string;
  readonly entityId: string;
}

export interface CausalStreamVersionExpectation {
  readonly streamType: string;
  readonly streamId: string;
  readonly expectedVersion: number;
}

export interface CommandIntentV1 {
  readonly commandId: string;
  readonly commandType: string;
  readonly commandSchemaVersion: typeof CAUSAL_COMMAND_SCHEMA_VERSION;
  readonly worldId: string;
  readonly namespace: CausalNamespace;
  readonly actor: CausalActorRef;
  readonly submittedAt: string;
  readonly requestedWorldMinute?: number;
  readonly idempotencyKey: string;
  readonly expectedStreamVersions: readonly CausalStreamVersionExpectation[];
  readonly authorizationRefs: readonly string[];
  readonly causalParentEventIds: readonly string[];
  readonly rootPressureIds: readonly string[];
  readonly rootReason?: CausalRootReason;
  readonly payload: Readonly<Record<string, unknown>>;
}

export type CausalEffectType =
  | "resource_ledger"
  | "unique_item_lifecycle"
  | "ownership_interest"
  | "state_transition"
  | "relationship_delta"
  | "knowledge_delta"
  | "pressure_delta"
  | "legal_delta"
  | "world_predicate";

export interface CausalEffectBaseV1<TType extends CausalEffectType, TAfter> {
  readonly effectId: string;
  readonly effectType: TType;
  readonly targetRef: CausalEntityRef;
  readonly operation: string;
  readonly beforeRef?: string;
  readonly after: TAfter;
  readonly sourceEventIds: readonly string[];
  readonly authorizationRefs: readonly string[];
}

export interface ResourceLedgerEntryV1 {
  readonly accountRef: string;
  readonly quantityMinor: string;
}

export interface ResourceLedgerAfterV1 {
  readonly resourceKey: string;
  readonly resourceClass: string;
  readonly unit: string;
  readonly entries: readonly ResourceLedgerEntryV1[];
  readonly creationSourceRef?: string;
  readonly destructionSinkRef?: string;
}

export type ResourceLedgerEffectV1 = CausalEffectBaseV1<"resource_ledger", ResourceLedgerAfterV1>;

export type UniqueItemLifecycleState =
  | "planned"
  | "created"
  | "active"
  | "damaged"
  | "repaired"
  | "consumed"
  | "destroyed"
  | "archived";

export interface UniqueItemLifecycleAfterV1 {
  readonly itemId: string;
  readonly itemType: string;
  readonly fromState?: UniqueItemLifecycleState;
  readonly toState: UniqueItemLifecycleState;
  readonly titleOwnerRef?: string;
  readonly sourceMechanismRef?: string;
}

export type UniqueItemLifecycleEffectV1 = CausalEffectBaseV1<
  "unique_item_lifecycle",
  UniqueItemLifecycleAfterV1
>;

export type OwnershipInterestType =
  | "title"
  | "possession"
  | "custody"
  | "lease"
  | "lien"
  | "mortgage"
  | "seizure"
  | "carry_permission";

export interface OwnershipInterestAfterV1 {
  readonly itemRef: string;
  readonly interestType: OwnershipInterestType;
  readonly holderRef: string;
  readonly validFromWorldMinute: number;
  readonly validUntilWorldMinute?: number;
  readonly basisEventIds: readonly string[];
  readonly priority: number;
  readonly transferable: boolean;
  readonly status: "granted" | "released" | "expired" | "disputed";
}

export type OwnershipInterestEffectV1 = CausalEffectBaseV1<
  "ownership_interest",
  OwnershipInterestAfterV1
>;

export interface StateTransitionAfterV1 {
  readonly stateMachineId: string;
  readonly fromState: string;
  readonly toState: string;
  readonly transitionId: string;
  readonly reasonCode: string;
}

export type StateTransitionEffectV1 = CausalEffectBaseV1<
  "state_transition",
  StateTransitionAfterV1
>;

export type RelationshipDeltaEffectV1 = CausalEffectBaseV1<
  "relationship_delta",
  Readonly<Record<string, unknown>>
>;
export type KnowledgeDeltaEffectV1 = CausalEffectBaseV1<
  "knowledge_delta",
  Readonly<Record<string, unknown>>
>;
export type PressureDeltaEffectV1 = CausalEffectBaseV1<
  "pressure_delta",
  Readonly<Record<string, unknown>>
>;
export type LegalDeltaEffectV1 = CausalEffectBaseV1<
  "legal_delta",
  Readonly<Record<string, unknown>>
>;

export interface WorldPredicateAfterV1 {
  readonly predicateId: string;
  readonly subjectRef: CausalEntityRef;
  readonly operator: "eq" | "neq" | "gte" | "lte" | "contains" | "exists" | "state_is";
  readonly expectedValue: unknown;
  readonly evaluationStatus: "true" | "false" | "unknown";
  readonly evaluatedAtWorldMinute: number;
}

export type WorldPredicateEffectV1 = CausalEffectBaseV1<
  "world_predicate",
  WorldPredicateAfterV1
>;

export type CausalEffectV1 =
  | ResourceLedgerEffectV1
  | UniqueItemLifecycleEffectV1
  | OwnershipInterestEffectV1
  | StateTransitionEffectV1
  | RelationshipDeltaEffectV1
  | KnowledgeDeltaEffectV1
  | PressureDeltaEffectV1
  | LegalDeltaEffectV1
  | WorldPredicateEffectV1;

export interface CausalWorldEventV1 {
  readonly eventId: string;
  readonly eventType: string;
  readonly schemaVersion: typeof CAUSAL_EVENT_SCHEMA_VERSION;
  readonly registryVersion: string;
  readonly registryHash: `sha256:${string}`;
  readonly worldId: string;
  readonly namespace: CausalNamespace;
  readonly stream: {
    readonly streamType: string;
    readonly streamId: string;
    readonly streamVersion: number;
  };
  readonly occurredAtWorldMinute: number;
  readonly recordedAt: string;
  readonly actorRefs: readonly CausalActorRef[];
  readonly subjectRefs: readonly CausalEntityRef[];
  readonly regionRefs: readonly string[];
  readonly command: {
    readonly commandId: string;
    readonly commandType: string;
    readonly idempotencyKey: string;
    readonly inputHash: `sha256:${string}`;
  };
  readonly causality: {
    readonly causalParentEventIds: readonly string[];
    readonly rootPressureIds: readonly string[];
    readonly rootReason?: CausalRootReason;
  };
  readonly authorizationRefs: readonly string[];
  readonly evidenceRefs: readonly string[];
  readonly visibilityPolicyRef: string;
  readonly versions: {
    readonly rulesetVersion: string;
    readonly contentVersion: string;
    readonly adjudicatorVersion: string;
    readonly adapterVersion?: string;
  };
  readonly determinism: {
    readonly seed?: string;
    readonly algorithmId: string;
    readonly algorithmVersion: string;
  };
  readonly payload: Readonly<Record<string, unknown>>;
  readonly effects: readonly CausalEffectV1[];
  readonly proof: {
    readonly payloadHash: `sha256:${string}`;
    readonly effectsHash: `sha256:${string}`;
    readonly eventHash: `sha256:${string}`;
  };
}

export type CausalWorldEventCandidateV1 = Omit<CausalWorldEventV1, "proof"> & {
  readonly proof?: Partial<CausalWorldEventV1["proof"]>;
};

export interface CommandResultManifestV1 {
  readonly manifestVersion: typeof CAUSAL_RESULT_MANIFEST_VERSION;
  readonly commandId: string;
  readonly idempotencyKey: string;
  readonly inputHash: `sha256:${string}`;
  readonly status: "committed" | "rejected";
  readonly eventIds: readonly string[];
  readonly eventHashes: readonly `sha256:${string}`[];
  readonly committedAt: string;
  readonly projectionStatus: "current" | "pending" | "degraded";
  readonly warnings: readonly string[];
}

export type LegacyCausalStatus =
  | "legacy_attributed"
  | "legacy_partially_attributed"
  | "legacy_unattributed";

export interface LegacyCausalViewV1 {
  readonly originalEventId: string;
  readonly originalEventType: string;
  readonly sourceLedger: string;
  readonly sourcePosition: string;
  readonly inferredWorldId?: string;
  readonly inferredActorRefs: readonly string[];
  readonly inferredSubjectRefs: readonly string[];
  readonly inferredWorldMinute?: number;
  readonly knownParentEventIds: readonly string[];
  readonly causalStatus: LegacyCausalStatus;
  readonly adapterVersion: string;
  readonly warnings: readonly string[];
}

export interface CausalEventPolicy {
  readonly eventType: string;
  readonly family: string;
  readonly schemaVersion: string;
  readonly payloadValidatorId: string;
  readonly allowedNamespaces: readonly CausalNamespace[];
  readonly allowedEffects: readonly CausalEffectType[];
  readonly allowEmptyEffects: boolean;
  readonly allowRootEvent: boolean;
  readonly allowedRootReasons: readonly CausalRootReason[];
  readonly requiresRootPressure: boolean;
  readonly authorizationPolicyId: string;
  readonly enforcement: CausalEnforcementMode;
  readonly status: string;
}

export interface CausalResourceSourcePolicy {
  readonly allowedResourceClasses: readonly string[];
  readonly requiresEvidence: boolean;
}

export interface CausalResourcePolicy {
  readonly allowFloatingPoint: false;
  readonly allowNegativeBalanceByDefault: boolean;
  readonly creationSources: Readonly<Record<string, CausalResourceSourcePolicy>>;
  readonly destructionSinks: Readonly<Record<string, CausalResourceSourcePolicy>>;
}

export interface CausalSchemaRegistryV1 {
  readonly registryId: string;
  readonly registryVersion: string;
  readonly eventPolicies: readonly CausalEventPolicy[];
  readonly resourcePolicy: CausalResourcePolicy;
}

export interface CausalEventLookup {
  readonly getEvent: (eventId: string) => CausalWorldEventV1 | LegacyCausalViewV1 | undefined;
  readonly streamVersion?: (streamType: string, streamId: string) => number | undefined;
  readonly streamWorldMinute?: (streamType: string, streamId: string) => number | undefined;
}

export interface CausalResourceAccountSnapshot {
  readonly accountRef: string;
  readonly resourceKey: string;
  readonly unit: string;
  readonly balanceMinor: string;
  readonly creditLimitMinor?: string;
}

export interface CausalOwnershipSnapshot {
  readonly itemRef: string;
  readonly titleOwnerRef?: string;
  readonly lifecycleState?: UniqueItemLifecycleState;
}

export type CausalErrorCode =
  | "CAUSAL_SCHEMA_UNKNOWN"
  | "CAUSAL_SCHEMA_INVALID"
  | "CAUSAL_PARENT_MISSING"
  | "CAUSAL_CYCLE_DETECTED"
  | "ROOT_REASON_DENIED"
  | "ROOT_PRESSURE_REQUIRED"
  | "ORPHAN_EFFECT"
  | "RESOURCE_UNBALANCED"
  | "RESOURCE_SOURCE_DENIED"
  | "RESOURCE_SINK_DENIED"
  | "NEGATIVE_BALANCE"
  | "OWNERSHIP_CONFLICT"
  | "AUTHORIZATION_DENIED"
  | "STREAM_VERSION_CONFLICT"
  | "IDEMPOTENCY_CONFLICT"
  | "DETERMINISM_PROOF_FAILED"
  | "REGISTRY_VERSION_UNAVAILABLE"
  | "CANONICAL_APPEND_FAILED"
  | "PROJECTION_LAGGING"
  | "LEGACY_ADAPTER_FAILED";

const RETRYABLE_CAUSAL_ERRORS = new Set<CausalErrorCode>([
  "CAUSAL_PARENT_MISSING",
  "NEGATIVE_BALANCE",
  "OWNERSHIP_CONFLICT",
  "STREAM_VERSION_CONFLICT",
  "REGISTRY_VERSION_UNAVAILABLE",
  "CANONICAL_APPEND_FAILED",
  "PROJECTION_LAGGING",
]);

export class CausalValidationError extends Error {
  readonly code: CausalErrorCode;
  readonly retryable: boolean;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(
    code: CausalErrorCode,
    details: Readonly<Record<string, unknown>> = {},
    cause?: unknown,
  ) {
    super(code, cause === undefined ? undefined : { cause });
    this.name = "CausalValidationError";
    this.code = code;
    this.retryable = RETRYABLE_CAUSAL_ERRORS.has(code);
    this.details = details;
  }
}

export function isCausalValidationError(value: unknown): value is CausalValidationError {
  return value instanceof CausalValidationError;
}

export function causalActorRefKey(actor: CausalActorRef) {
  return `${actor.actorType}:${actor.actorId}`;
}

export function isCausalRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function assertCausalText(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new CausalValidationError("CAUSAL_SCHEMA_INVALID", { field });
  }
  return value;
}

function assertCausalWorldMinute(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0) {
    throw new CausalValidationError("CAUSAL_SCHEMA_INVALID", { field });
  }
  return Number(value);
}

function assertCausalTimestamp(value: unknown, field: string): string {
  const text = assertCausalText(value, field);
  if (!Number.isFinite(Date.parse(text))) {
    throw new CausalValidationError("CAUSAL_SCHEMA_INVALID", { field });
  }
  return text;
}

function assertCausalStringArray(value: unknown, field: string): readonly string[] {
  if (!Array.isArray(value)) {
    throw new CausalValidationError("CAUSAL_SCHEMA_INVALID", { field });
  }
  return value.map((entry, index) => assertCausalText(entry, `${field}[${index}]`));
}

export function assertCausalActorRef(value: unknown, field = "actor"): CausalActorRef {
  if (!isCausalRecord(value)) {
    throw new CausalValidationError("CAUSAL_SCHEMA_INVALID", { field });
  }
  const actorType = assertCausalText(value.actorType, `${field}.actorType`);
  if (!["player_identity", "npc", "household", "organization", "system"].includes(actorType)) {
    throw new CausalValidationError("CAUSAL_SCHEMA_INVALID", { field: `${field}.actorType` });
  }
  return {
    actorType: actorType as CausalActorType,
    actorId: assertCausalText(value.actorId, `${field}.actorId`),
  };
}

export function assertCausalEntityRef(value: unknown, field = "entity"): CausalEntityRef {
  if (!isCausalRecord(value)) {
    throw new CausalValidationError("CAUSAL_SCHEMA_INVALID", { field });
  }
  return {
    entityType: assertCausalText(value.entityType, `${field}.entityType`),
    entityId: assertCausalText(value.entityId, `${field}.entityId`),
  };
}

export function assertCommandIntentV1(value: unknown): CommandIntentV1 {
  if (!isCausalRecord(value)) throw new CausalValidationError("CAUSAL_SCHEMA_INVALID", { field: "command" });
  const namespace = assertCausalText(value.namespace, "namespace");
  if (!["world", "lineage", "identity", "run"].includes(namespace)) {
    throw new CausalValidationError("CAUSAL_SCHEMA_INVALID", { field: "namespace" });
  }
  if (value.commandSchemaVersion !== CAUSAL_COMMAND_SCHEMA_VERSION) {
    throw new CausalValidationError("CAUSAL_SCHEMA_INVALID", { field: "commandSchemaVersion" });
  }
  if (!isCausalRecord(value.payload)) {
    throw new CausalValidationError("CAUSAL_SCHEMA_INVALID", { field: "payload" });
  }
  if (!Array.isArray(value.expectedStreamVersions)) {
    throw new CausalValidationError("CAUSAL_SCHEMA_INVALID", { field: "expectedStreamVersions" });
  }
  const expectedStreamVersions = value.expectedStreamVersions.map((entry, index) => {
    if (!isCausalRecord(entry) || !Number.isSafeInteger(entry.expectedVersion) || Number(entry.expectedVersion) < 0) {
      throw new CausalValidationError("CAUSAL_SCHEMA_INVALID", { field: `expectedStreamVersions[${index}]` });
    }
    return {
      streamType: assertCausalText(entry.streamType, `expectedStreamVersions[${index}].streamType`),
      streamId: assertCausalText(entry.streamId, `expectedStreamVersions[${index}].streamId`),
      expectedVersion: Number(entry.expectedVersion),
    };
  });
  if (value.requestedWorldMinute !== undefined) {
    assertCausalWorldMinute(value.requestedWorldMinute, "requestedWorldMinute");
  }
  return {
    commandId: assertCausalText(value.commandId, "commandId"),
    commandType: assertCausalText(value.commandType, "commandType"),
    commandSchemaVersion: CAUSAL_COMMAND_SCHEMA_VERSION,
    worldId: assertCausalText(value.worldId, "worldId"),
    namespace: namespace as CausalNamespace,
    actor: assertCausalActorRef(value.actor),
    submittedAt: assertCausalTimestamp(value.submittedAt, "submittedAt"),
    requestedWorldMinute: value.requestedWorldMinute === undefined
      ? undefined
      : Number(value.requestedWorldMinute),
    idempotencyKey: assertCausalText(value.idempotencyKey, "idempotencyKey"),
    expectedStreamVersions,
    authorizationRefs: assertCausalStringArray(value.authorizationRefs, "authorizationRefs"),
    causalParentEventIds: assertCausalStringArray(value.causalParentEventIds, "causalParentEventIds"),
    rootPressureIds: assertCausalStringArray(value.rootPressureIds, "rootPressureIds"),
    rootReason: value.rootReason as CausalRootReason | undefined,
    payload: value.payload,
  };
}

export function assertCausalEffectV1(value: unknown, index = 0): CausalEffectV1 {
  if (!isCausalRecord(value)) {
    throw new CausalValidationError("CAUSAL_SCHEMA_INVALID", { field: `effects[${index}]` });
  }
  const effectType = assertCausalText(value.effectType, `effects[${index}].effectType`);
  if (![
    "resource_ledger",
    "unique_item_lifecycle",
    "ownership_interest",
    "state_transition",
    "relationship_delta",
    "knowledge_delta",
    "pressure_delta",
    "legal_delta",
    "world_predicate",
  ].includes(effectType)) {
    throw new CausalValidationError("CAUSAL_SCHEMA_INVALID", { field: `effects[${index}].effectType` });
  }
  if (!isCausalRecord(value.after)) {
    throw new CausalValidationError("CAUSAL_SCHEMA_INVALID", { field: `effects[${index}].after` });
  }
  return {
    effectId: assertCausalText(value.effectId, `effects[${index}].effectId`),
    effectType,
    targetRef: assertCausalEntityRef(value.targetRef, `effects[${index}].targetRef`),
    operation: assertCausalText(value.operation, `effects[${index}].operation`),
    beforeRef: value.beforeRef === undefined
      ? undefined
      : assertCausalText(value.beforeRef, `effects[${index}].beforeRef`),
    after: value.after,
    sourceEventIds: assertCausalStringArray(value.sourceEventIds, `effects[${index}].sourceEventIds`),
    authorizationRefs: assertCausalStringArray(value.authorizationRefs, `effects[${index}].authorizationRefs`),
  } as CausalEffectV1;
}

export function assertCausalWorldEventV1(value: unknown): CausalWorldEventV1 {
  if (!isCausalRecord(value)) throw new CausalValidationError("CAUSAL_SCHEMA_INVALID", { field: "event" });
  if (value.schemaVersion !== CAUSAL_EVENT_SCHEMA_VERSION) {
    throw new CausalValidationError("CAUSAL_SCHEMA_INVALID", { field: "schemaVersion" });
  }
  if (!isCausalRecord(value.stream)
    || !Number.isSafeInteger(value.stream.streamVersion)
    || Number(value.stream.streamVersion) < 1) {
    throw new CausalValidationError("CAUSAL_SCHEMA_INVALID", { field: "stream" });
  }
  if (!isCausalRecord(value.command)
    || !isCausalRecord(value.causality)
    || !isCausalRecord(value.versions)
    || !isCausalRecord(value.determinism)
    || !isCausalRecord(value.payload)
    || !isCausalRecord(value.proof)
    || !Array.isArray(value.effects)
    || !Array.isArray(value.actorRefs)
    || !Array.isArray(value.subjectRefs)) {
    throw new CausalValidationError("CAUSAL_SCHEMA_INVALID", { field: "eventSections" });
  }
  const namespace = assertCausalText(value.namespace, "namespace");
  if (!["world", "lineage", "identity", "run"].includes(namespace)) {
    throw new CausalValidationError("CAUSAL_SCHEMA_INVALID", { field: "namespace" });
  }
  const hashFields = ["registryHash", "inputHash", "payloadHash", "effectsHash", "eventHash"] as const;
  const hashes = {
    registryHash: value.registryHash,
    inputHash: value.command.inputHash,
    payloadHash: value.proof.payloadHash,
    effectsHash: value.proof.effectsHash,
    eventHash: value.proof.eventHash,
  };
  for (const field of hashFields) {
    if (typeof hashes[field] !== "string" || !/^sha256:[a-f0-9]{64}$/.test(hashes[field] as string)) {
      throw new CausalValidationError("CAUSAL_SCHEMA_INVALID", { field });
    }
  }
  return value as unknown as CausalWorldEventV1;
}

export function assertCommandResultManifestV1(value: unknown): CommandResultManifestV1 {
  if (!isCausalRecord(value)
    || value.manifestVersion !== CAUSAL_RESULT_MANIFEST_VERSION
    || !Array.isArray(value.eventIds)
    || !Array.isArray(value.eventHashes)
    || !Array.isArray(value.warnings)) {
    throw new CausalValidationError("CAUSAL_SCHEMA_INVALID", { field: "resultManifest" });
  }
  if (value.status !== "committed" && value.status !== "rejected") {
    throw new CausalValidationError("CAUSAL_SCHEMA_INVALID", { field: "resultManifest.status" });
  }
  if (!["current", "pending", "degraded"].includes(String(value.projectionStatus))) {
    throw new CausalValidationError("CAUSAL_SCHEMA_INVALID", { field: "resultManifest.projectionStatus" });
  }
  return value as unknown as CommandResultManifestV1;
}
