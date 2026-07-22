import {
  causalCanonicalJsonHash,
  type CausalCanonicalJsonValue,
} from "./causalCanonicalJson.ts";
import {
  CAUSAL_ACTIVE_DOMAIN_EVENT_TYPES,
  CAUSAL_EVENT_POLICIES,
  CAUSAL_RETIRED_DOMAIN_EVENT_ALIASES,
  CAUSAL_SCHEMA_REGISTRY,
  CAUSAL_SCHEMA_REGISTRY_ENTRIES,
  CAUSAL_SCHEMA_REGISTRY_VERSION,
  type CausalEventPolicy,
  type CausalSchemaFamily,
  type CausalSchemaRegistryEntry,
  type CausalSchemaRegistrySnapshot,
} from "./causalSchemaCatalog.ts";

export {
  CAUSAL_ACTIVE_DOMAIN_EVENT_TYPES as CAUSAL_DOMAIN_EVENT_TYPES,
  CAUSAL_EVENT_POLICIES,
  CAUSAL_RETIRED_DOMAIN_EVENT_ALIASES,
  CAUSAL_SCHEMA_REGISTRY,
  CAUSAL_SCHEMA_REGISTRY_DOCUMENT_VERSION,
  CAUSAL_SCHEMA_REGISTRY_ENTRIES,
  CAUSAL_SCHEMA_REGISTRY_VERSION,
  INFINITE_WORLD_RUNTIME_COMMAND_TYPES,
  INFINITE_WORLD_RUNTIME_EVENT_TYPES,
  type CausalEventPolicy,
  type CausalSchemaFamily,
  type CausalSchemaRegistryEntry,
  type CausalSchemaRegistrySnapshot,
  type CausalSchemaStatus,
} from "./causalSchemaCatalog.ts";

export class CausalSchemaUnknownError extends Error {
  readonly code = "causal_schema_unknown";
  readonly schemaId: string;

  constructor(schemaId: string) {
    super(`causal_schema_unknown:${schemaId}`);
    this.name = "CausalSchemaUnknownError";
    this.schemaId = schemaId;
  }
}

export class CausalEventPolicyUnknownError extends Error {
  readonly code = "causal_event_policy_unknown";
  readonly eventType: string;

  constructor(eventType: string) {
    super(`causal_event_policy_unknown:${eventType}`);
    this.name = "CausalEventPolicyUnknownError";
    this.eventType = eventType;
  }
}

export class CausalSchemaRetiredError extends Error {
  readonly code = "causal_schema_retired";
  readonly schemaId: string;
  readonly replacedBy?: string;

  constructor(schemaId: string, replacedBy?: string) {
    super(replacedBy ? `causal_schema_retired:${schemaId}:${replacedBy}` : `causal_schema_retired:${schemaId}`);
    this.name = "CausalSchemaRetiredError";
    this.schemaId = schemaId;
    this.replacedBy = replacedBy;
  }
}

export class CausalEventPolicyRetiredError extends Error {
  readonly code = "causal_event_policy_retired";
  readonly eventType: string;
  readonly reason?: string;
  readonly replacementEventType?: string;

  constructor(
    eventType: string,
    reason?: string,
    replacementEventType?: string,
  ) {
    const replacement = replacementEventType ? `:${replacementEventType}` : "";
    super(reason ? `causal_event_policy_retired:${eventType}:${reason}${replacement}` : `causal_event_policy_retired:${eventType}${replacement}`);
    this.name = "CausalEventPolicyRetiredError";
    this.eventType = eventType;
    this.reason = reason;
    this.replacementEventType = replacementEventType;
  }
}

const ENTRY_BY_ID = new Map(CAUSAL_SCHEMA_REGISTRY_ENTRIES.map((entry) => [entry.schemaId, entry]));
const POLICIES_BY_EVENT_TYPE = new Map(CAUSAL_EVENT_POLICIES.map((policy) => [policy.eventType, policy]));

export function getCausalSchema(schemaId: string): CausalSchemaRegistryEntry {
  const entry = ENTRY_BY_ID.get(schemaId);
  if (!entry) throw new CausalSchemaUnknownError(schemaId);
  if (entry.status === "retired") throw new CausalSchemaRetiredError(schemaId, entry.replacedBy);
  return entry;
}

export function findCausalSchema(schemaId: string): CausalSchemaRegistryEntry | undefined {
  return ENTRY_BY_ID.get(schemaId);
}

export function listCausalSchemas(family?: CausalSchemaFamily): readonly CausalSchemaRegistryEntry[] {
  return family
    ? CAUSAL_SCHEMA_REGISTRY_ENTRIES.filter((entry) => entry.family === family)
    : CAUSAL_SCHEMA_REGISTRY_ENTRIES;
}

export function parseCausalEventPolicy(eventType: string): CausalEventPolicy {
  const policy = POLICIES_BY_EVENT_TYPE.get(eventType);
  if (!policy) throw new CausalEventPolicyUnknownError(eventType);
  if (policy.status === "retired") {
    throw new CausalEventPolicyRetiredError(eventType, policy.retiredReason, policy.replacementEventType);
  }
  getCausalSchema(policy.eventSchemaId);
  getCausalSchema(policy.rootReasonSchemaId);
  getCausalSchema(policy.sourceSchemaId);
  getCausalSchema(policy.sinkSchemaId);
  getCausalSchema(policy.enforcementSchemaId);
  return policy;
}

export function findCausalEventPolicy(eventType: string): CausalEventPolicy | undefined {
  return POLICIES_BY_EVENT_TYPE.get(eventType);
}

export function causalSchemaRegistrySnapshot(): CausalSchemaRegistrySnapshot {
  return CAUSAL_SCHEMA_REGISTRY;
}

export function causalSchemaRegistryHash(): `sha256:${string}` {
  return causalCanonicalJsonHash(CAUSAL_SCHEMA_REGISTRY as unknown as CausalCanonicalJsonValue);
}
