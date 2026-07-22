import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  CAUSAL_COMMAND_SCHEMA_VERSION,
  CAUSAL_EVENT_SCHEMA_VERSION,
  CausalValidationError,
  type CausalActorRef,
  type CausalWorldEventCandidateV1,
  type CausalWorldEventV1,
  type CommandIntentV1,
} from "../lib/epoch/causalContracts.ts";
import {
  causalCanonicalJsonHash,
  type CausalCanonicalJsonValue,
} from "../lib/epoch/causalCanonicalJson.ts";
import {
  CAUSAL_DOMAIN_EVENT_TYPES,
  CAUSAL_EVENT_POLICIES,
  CAUSAL_RETIRED_DOMAIN_EVENT_ALIASES,
  CAUSAL_SCHEMA_REGISTRY,
  CAUSAL_SCHEMA_REGISTRY_DOCUMENT_VERSION,
  CAUSAL_SCHEMA_REGISTRY_ENTRIES,
  CausalEventPolicyUnknownError,
  CausalEventPolicyRetiredError,
  CausalSchemaRetiredError,
  CausalSchemaUnknownError,
  INFINITE_WORLD_RUNTIME_COMMAND_TYPES,
  INFINITE_WORLD_RUNTIME_EVENT_TYPES,
  causalSchemaRegistryHash,
  causalSchemaRegistrySnapshot,
  getCausalSchema,
  parseCausalEventPolicy,
} from "../lib/epoch/causalSchemaRegistry.ts";
import {
  createCausalWriteCoordinator,
  type CausalCommitBundle,
  type CausalWriteSnapshot,
} from "../lib/epoch/causalWriteCoordinator.ts";
import type {
  CausalIdempotencyManifest,
  CausalIdempotencyManifestStore,
} from "../lib/epoch/causalIdempotencyRules.ts";
import {
  type EpochWorldPressure,
  projectEpochWorldPressureEvent,
} from "../lib/epoch/worldPressureRules.ts";

const RECORDED_AT = "2026-07-20T00:00:00.000Z";
const SUBMITTED_AT = "2026-07-20T00:00:00.000Z";
const WORLD_ID = "world_domain_registry";
const ACTOR: CausalActorRef = { actorType: "system", actorId: "domain_registry" };
const FAKE_HASH = `sha256:${"0".repeat(64)}` as const;
const SPEC_PATH = fileURLToPath(new URL(
  "../../../docs/superpowers/specs/2026-07-20-obsidian-epoch-causal-schema-registry-v1.json",
  import.meta.url,
));
const RUNTIME_PATH = fileURLToPath(new URL("../lib/epoch/infiniteWorldRuntime.ts", import.meta.url));

const DOMAIN_EVENT_EXAMPLES = [
  ["world pressure", "world_pressure_opened"],
  ["world pressure update", "world_pressure_updated"],
  ["world pressure close", "world_pressure_closed"],
  ["observation", "observation_acquired"],
  ["market", "market_order_placed"],
  ["economy", "economy_transaction_committed"],
  ["craft", "crafting_job_resolved"],
  ["progression", "progression_change_committed"],
  ["mission", "mission_outcome_settled"],
  ["governance", "governance_action_resolved"],
  ["ecology", "ecology_tick_resolved"],
  ["supernatural", "supernatural_action_resolved"],
  ["legacy", "legacy_cycle_changed"],
  ["project", "enterprise_tick_resolved"],
] as const;

type RegistrySpec = {
  readonly registryVersion: string;
  readonly schemaVersion: number;
  readonly registryHash: `sha256:${string}`;
  readonly schemaEntries: readonly unknown[];
  readonly activeDomainEventTypes: readonly string[];
  readonly runtimeCommandPolicy: {
    readonly commandTypes: readonly string[];
    readonly eventTypes: readonly string[];
  };
  readonly retiredEventAliases: readonly {
    readonly eventType: string;
    readonly replacementEventType: string;
    readonly deprecatedSince: string;
    readonly retiredReason: string;
  }[];
};

function registrySpec(): RegistrySpec {
  return JSON.parse(fs.readFileSync(SPEC_PATH, "utf8")) as RegistrySpec;
}

function assertSameMembers(actual: readonly string[], expected: readonly string[], label: string) {
  assert.deepEqual([...actual].sort(), [...expected].sort(), label);
}

function runtimeSourceEventTypes(): readonly string[] {
  const source = fs.readFileSync(RUNTIME_PATH, "utf8");
  return [...new Set([...source.matchAll(/"([^"]+)"/g)]
    .map((match) => match[1])
    .filter((eventType): eventType is string =>
      Boolean(eventType) && (INFINITE_WORLD_RUNTIME_EVENT_TYPES as readonly string[]).includes(eventType),
    ))];
}

function createStore() {
  const manifests = new Map<string, CausalIdempotencyManifest>();
  const writes: CausalIdempotencyManifest[] = [];
  const store: CausalIdempotencyManifestStore = {
    read(scope) {
      return manifests.get(scope);
    },
    write(manifest) {
      writes.push(manifest);
      manifests.set(manifest.scope, manifest);
    },
  };
  return { store, writes };
}

function makeCommand(eventType: string): CommandIntentV1 {
  return {
    commandId: `cmd_${eventType}`,
    commandType: `test.${eventType}`,
    commandSchemaVersion: CAUSAL_COMMAND_SCHEMA_VERSION,
    worldId: WORLD_ID,
    namespace: "world",
    actor: ACTOR,
    submittedAt: SUBMITTED_AT,
    requestedWorldMinute: 10,
    idempotencyKey: `idem_${eventType}`,
    expectedStreamVersions: [],
    authorizationRefs: ["auth:system"],
    causalParentEventIds: [],
    rootPressureIds: [],
    rootReason: "world_genesis",
    payload: { eventType },
  };
}

function makeCandidate(
  command: CommandIntentV1,
  eventType: string,
  context: { readonly recordedAt: string; readonly registryVersion: string; readonly registryHash: `sha256:${string}` },
): CausalWorldEventCandidateV1 {
  const eventId = `evt_${eventType}`;
  return {
    eventId,
    eventType,
    schemaVersion: CAUSAL_EVENT_SCHEMA_VERSION,
    registryVersion: context.registryVersion,
    registryHash: context.registryHash,
    worldId: command.worldId,
    namespace: command.namespace,
    stream: {
      streamType: "domain_event",
      streamId: eventType,
      streamVersion: 1,
    },
    occurredAtWorldMinute: command.requestedWorldMinute ?? 10,
    recordedAt: context.recordedAt,
    actorRefs: [command.actor],
    subjectRefs: [{ entityType: "domain_event", entityId: eventType }],
    regionRefs: [],
    command: {
      commandId: "candidate_spoof",
      commandType: "candidate_spoof",
      idempotencyKey: "candidate_spoof",
      inputHash: FAKE_HASH,
    },
    causality: {
      causalParentEventIds: ["candidate_spoof"],
      rootPressureIds: ["candidate_spoof"],
      ...(command.rootReason ? { rootReason: command.rootReason } : {}),
    },
    authorizationRefs: ["candidate_spoof"],
    evidenceRefs: [],
    visibilityPolicyRef: "visibility:public",
    versions: {
      rulesetVersion: "ruleset_domain_test",
      contentVersion: "content_domain_test",
      adjudicatorVersion: "adjudicator_domain_test",
    },
    determinism: {
      algorithmId: "deterministic",
      algorithmVersion: "1",
    },
    payload: { eventType },
    effects: [{
      effectId: `effect_${eventType}`,
      effectType: "world_predicate",
      targetRef: { entityType: "domain_event", entityId: eventType },
      operation: "record",
      after: {
        predicateId: `domain:${eventType}`,
        subjectRef: { entityType: "domain_event", entityId: eventType },
        operator: "exists",
        expectedValue: true,
        evaluationStatus: "true",
        evaluatedAtWorldMinute: command.requestedWorldMinute ?? 10,
      },
      sourceEventIds: [eventId],
      authorizationRefs: command.authorizationRefs,
    }],
    proof: {
      payloadHash: FAKE_HASH,
      effectsHash: FAKE_HASH,
      eventHash: FAKE_HASH,
    },
  };
}

function snapshot(knownEvents: CausalWriteSnapshot["knownEvents"] = {}): CausalWriteSnapshot {
  return {
    knownEvents,
  };
}

function createHarness(
  eventType: string,
  options: { readonly knownEvents?: CausalWriteSnapshot["knownEvents"] } = {},
) {
  const store = createStore();
  const commits: CausalCommitBundle[] = [];
  const committedEvents = new Map<string, CausalWorldEventV1>();
  let buildCalls = 0;
  const coordinator = createCausalWriteCoordinator({
    idempotencyStore: store.store,
    now: () => RECORDED_AT,
    loadSnapshot: () => snapshot(options.knownEvents),
    buildEvent: (command, _snapshot, context) => {
      buildCalls += 1;
      return makeCandidate(command, eventType, context);
    },
    commit: (bundle) => {
      commits.push(bundle);
      committedEvents.set(bundle.event.eventId, bundle.event);
    },
    loadCommittedEvent: (eventId) => committedEvents.get(eventId),
    invariantPolicy: {
      rootEventTypes: [eventType],
      rootReasonsByEventType: {
        [eventType]: ["world_genesis"],
      },
    },
  });
  return {
    command: makeCommand(eventType),
    coordinator,
    commits,
    storeWrites: store.writes,
    buildCalls: () => buildCalls,
  };
}

test("registers every causal domain event type as a unique active domain schema policy", () => {
  const uniqueTypes = new Set(CAUSAL_DOMAIN_EVENT_TYPES);

  assert.equal(uniqueTypes.size, CAUSAL_DOMAIN_EVENT_TYPES.length);
  for (const eventType of CAUSAL_DOMAIN_EVENT_TYPES) {
    const policy = parseCausalEventPolicy(eventType);
    assert.equal(policy.status, "active");
    assert.equal(policy.eventSchemaId, "causal.event.domain.v1");
  }
});

test("keeps JSON registry spec, TypeScript catalog, and runtime policy in bidirectional sync", () => {
  const spec = registrySpec();

  assert.equal(spec.registryVersion, CAUSAL_SCHEMA_REGISTRY_DOCUMENT_VERSION);
  assert.equal(spec.schemaVersion, CAUSAL_SCHEMA_REGISTRY.schemaVersion);
  assert.equal(spec.registryHash, causalSchemaRegistryHash());
  assert.deepEqual(spec.schemaEntries, CAUSAL_SCHEMA_REGISTRY_ENTRIES);
  assertSameMembers(spec.activeDomainEventTypes, CAUSAL_DOMAIN_EVENT_TYPES, "JSON active domain event types drifted");
  assertSameMembers(spec.runtimeCommandPolicy.commandTypes, INFINITE_WORLD_RUNTIME_COMMAND_TYPES, "JSON runtime command types drifted");
  assertSameMembers(spec.runtimeCommandPolicy.eventTypes, INFINITE_WORLD_RUNTIME_EVENT_TYPES, "JSON runtime event types drifted");
  assertSameMembers(runtimeSourceEventTypes(), INFINITE_WORLD_RUNTIME_EVENT_TYPES, "runtime event type source drifted");
});

test("registry event policies have no duplicate event types and only reference legal schema ids", () => {
  const eventTypes = CAUSAL_EVENT_POLICIES.map((policy) => policy.eventType);
  assert.equal(new Set(eventTypes).size, eventTypes.length);

  const schemaIds = new Set(CAUSAL_SCHEMA_REGISTRY_ENTRIES.map((entry) => entry.schemaId));
  for (const policy of CAUSAL_EVENT_POLICIES) {
    assert.ok(schemaIds.has(policy.eventSchemaId), `${policy.eventType}: event schema missing`);
    assert.ok(schemaIds.has(policy.rootReasonSchemaId), `${policy.eventType}: root reason schema missing`);
    assert.ok(schemaIds.has(policy.sourceSchemaId), `${policy.eventType}: source schema missing`);
    assert.ok(schemaIds.has(policy.sinkSchemaId), `${policy.eventType}: sink schema missing`);
    assert.ok(schemaIds.has(policy.enforcementSchemaId), `${policy.eventType}: enforcement schema missing`);
    if (policy.status === "retired") {
      assert.ok(policy.replacementEventType, `${policy.eventType}: retired policy replacement missing`);
      assert.ok(policy.deprecatedSince, `${policy.eventType}: retired policy deprecation missing`);
      assert.ok(policy.retiredReason, `${policy.eventType}: retired policy reason missing`);
    }
  }
});

test("schema ids are unique and retired schemas point at active replacements", () => {
  const entriesById = new Map(CAUSAL_SCHEMA_REGISTRY_ENTRIES.map((entry) => [entry.schemaId, entry]));
  assert.equal(entriesById.size, CAUSAL_SCHEMA_REGISTRY_ENTRIES.length);

  for (const entry of CAUSAL_SCHEMA_REGISTRY_ENTRIES) {
    assert.ok(entry.status === "active" || entry.status === "retired");
    if (entry.status === "retired") {
      assert.ok(entry.replacedBy, `${entry.schemaId}: retired schema replacement missing`);
      assert.equal(entriesById.get(entry.replacedBy)?.status, "active");
    }
  }
});

test("keeps published event aliases as retired policies with explicit replacements", () => {
  const spec = registrySpec();
  assert.deepEqual(spec.retiredEventAliases, CAUSAL_RETIRED_DOMAIN_EVENT_ALIASES.map((alias) => ({
    eventType: alias.eventType,
    replacementEventType: alias.replacementEventType,
    deprecatedSince: CAUSAL_SCHEMA_REGISTRY_DOCUMENT_VERSION,
    retiredReason: alias.retiredReason,
  })));

  for (const alias of CAUSAL_RETIRED_DOMAIN_EVENT_ALIASES) {
    const policy = CAUSAL_EVENT_POLICIES.find((candidate) => candidate.eventType === alias.eventType);
    assert.equal(policy?.status, "retired");
    assert.equal(policy?.replacementEventType, alias.replacementEventType);
    assert.throws(
      () => parseCausalEventPolicy(alias.eventType),
      (error: unknown) => {
        assert.ok(error instanceof CausalEventPolicyRetiredError);
        assert.equal(error.replacementEventType, alias.replacementEventType);
        return true;
      },
    );
  }
});

test("keeps causal_world_event_recorded on the epoch event schema", () => {
  const policy = parseCausalEventPolicy("causal_world_event_recorded");

  assert.equal(policy.status, "active");
  assert.equal(policy.eventSchemaId, "causal.event.epoch.v1");
});

test("computes a stable registry hash from snapshot content that includes domain event policies", () => {
  const hash = causalSchemaRegistryHash();
  const snapshotWithDomainPolicies = causalSchemaRegistrySnapshot();
  const clonedSnapshot = {
    ...snapshotWithDomainPolicies,
    entries: snapshotWithDomainPolicies.entries.map((entry) => ({ ...entry })),
    eventPolicies: snapshotWithDomainPolicies.eventPolicies.map((policy) => ({ ...policy })),
  };
  const withoutDomainPolicies = {
    ...snapshotWithDomainPolicies,
    eventPolicies: snapshotWithDomainPolicies.eventPolicies.filter(
      (policy) => !(CAUSAL_DOMAIN_EVENT_TYPES as readonly string[]).includes(policy.eventType),
    ),
  };

  assert.match(hash, /^sha256:[a-f0-9]{64}$/);
  assert.equal(hash, registrySpec().registryHash);
  assert.equal(hash, causalSchemaRegistryHash());
  assert.equal(hash, causalCanonicalJsonHash(clonedSnapshot as unknown as CausalCanonicalJsonValue));
  assert.notEqual(
    hash,
    causalCanonicalJsonHash(withoutDomainPolicies as unknown as CausalCanonicalJsonValue),
  );
  for (const eventType of CAUSAL_DOMAIN_EVENT_TYPES) {
    assert.ok(CAUSAL_SCHEMA_REGISTRY.eventPolicies.some((policy) => policy.eventType === eventType));
  }
});

test("world pressure projected events use registry-supported event types for writer candidates", async (t) => {
  const pressure: EpochWorldPressure = {
    pressureId: "pressure_registry_1",
    type: "economic",
    scopeRef: "region:market_district",
    sourceFactEventIds: ["fact_price_spike"],
    affectedActorRefs: ["actor:merchant"],
    affectedResourceRefs: ["resource:grain"],
    severity: 44,
    urgency: 52,
    growthRate: 5,
    uncertainty: 20,
    visibility: 80,
    state: "detected",
    counterPressureIds: [],
    openedAtWorldMinute: 10,
    updatedAtWorldMinute: 12,
    reviewAtWorldMinute: 72,
  };

  for (const eventType of [
    "world_pressure_opened",
    "world_pressure_updated",
    "world_pressure_transformed",
    "world_pressure_closed",
  ] as const) {
    await t.test(`${eventType} is accepted by writer validation`, async () => {
      const projected = projectEpochWorldPressureEvent({
        eventType,
        worldId: WORLD_ID,
        pressure,
        recordedAt: RECORDED_AT,
        causalParentEventIds: ["fact_price_spike"],
        actorRefs: ["system:pressure"],
      });
      const harness = createHarness(eventType);
      const result = await harness.coordinator.execute(harness.command);

      assert.equal(projected.eventType, eventType);
      assert.equal(parseCausalEventPolicy(projected.eventType).status, "active");
      assert.equal(result.event.eventType, eventType);
      assert.equal(result.manifest.status, "committed");
    });
  }
});

test("rejects unknown policies and retired schemas with explicit registry errors", () => {
  assert.throws(
    () => parseCausalEventPolicy("unknown_domain_event"),
    CausalEventPolicyUnknownError,
  );
  assert.throws(
    () => getCausalSchema("causal.unknown.v1"),
    CausalSchemaUnknownError,
  );
  assert.throws(
    () => getCausalSchema("causal.enforcement.legacy.v0"),
    CausalSchemaRetiredError,
  );
});

test("passes representative causal domain category events through registry and coordinator validation", async (t) => {
  for (const [category, eventType] of DOMAIN_EVENT_EXAMPLES) {
    await t.test(`${category} event enters the coordinator build and validate flow`, async () => {
      const harness = createHarness(eventType);

      const result = await harness.coordinator.execute(harness.command);

      assert.equal(parseCausalEventPolicy(eventType).eventSchemaId, "causal.event.domain.v1");
      assert.equal(harness.buildCalls(), 1);
      assert.equal(harness.commits.length, 1);
      assert.equal(result.event.eventType, eventType);
      assert.equal(result.event.registryHash, causalSchemaRegistryHash());
      assert.equal(result.event.command.commandId, harness.command.commandId);
      assert.deepEqual(result.violations, []);
      assert.equal(result.manifest.status, "committed");
    });
  }
});

test("does not commit an unknown event type returned by the coordinator builder", async () => {
  const harness = createHarness("unknown_domain_event");

  await assert.rejects(
    harness.coordinator.execute(harness.command),
    (error: unknown) => {
      assert.ok(error instanceof CausalValidationError);
      assert.equal(error.code, "CAUSAL_SCHEMA_UNKNOWN");
      return true;
    },
  );

  assert.equal(harness.buildCalls(), 1);
  assert.equal(harness.commits.length, 0);
  assert.equal(harness.storeWrites.length, 1);
  assert.equal(harness.storeWrites[0]?.status, "rejected");
});
