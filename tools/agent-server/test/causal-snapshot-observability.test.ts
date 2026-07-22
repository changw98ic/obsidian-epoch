import assert from "node:assert/strict";
import test from "node:test";

import type {
  CausalEffectV1,
  CausalValidationError,
  CausalWorldEventV1,
} from "../lib/epoch/causalContracts.ts";
import {
  CAUSAL_EVENT_SCHEMA_VERSION,
} from "../lib/epoch/causalContracts.ts";
import type { ActorMind } from "../lib/epoch/actorMindRules.ts";
import type { CausalSimulationLodSubjectState } from "../lib/epoch/causalSimulationLodRules.ts";
import type { EpochKnowledgeRecord } from "../lib/epoch/knowledgeStateRules.ts";
import type { EpochWorldPressure } from "../lib/epoch/worldPressureRules.ts";
import {
  applyCausalEventToSnapshot,
  assertCausalWorldSnapshotV1,
  causalCheckpointMetadata,
  causalWorldSnapshotHash,
  checkCausalReplayContinuity,
  createCausalWorldSnapshot,
  emptyCausalWorldSnapshot,
  type CausalWorldSnapshotV1,
} from "../lib/epoch/causalWorldSnapshot.ts";
import {
  migrateCausalSnapshot,
} from "../lib/epoch/causalSnapshotMigration.ts";
import {
  causalHealthSummary,
  createCausalObservabilityCollector,
} from "../lib/epoch/causalObservability.ts";
import {
  causalSchemaRegistryHash,
} from "../lib/epoch/causalSchemaRegistry.ts";
import {
  createLifeProfile,
} from "../lib/epoch/lifeProfileRules.ts";

const HASH_A = "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;
const HASH_B = "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as const;
const HASH_C = "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc" as const;
const HASH_D = "sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd" as const;
const HASH_E = "sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee" as const;

function eventFixture(overrides: Partial<CausalWorldEventV1> = {}): CausalWorldEventV1 {
  return {
    eventId: "event_1",
    eventType: "resource_granted",
    schemaVersion: CAUSAL_EVENT_SCHEMA_VERSION,
    registryVersion: "1",
    registryHash: HASH_A,
    worldId: "world_1",
    namespace: "world",
    stream: {
      streamType: "resource_account",
      streamId: "account_a",
      streamVersion: 1,
    },
    occurredAtWorldMinute: 10,
    recordedAt: "2026-07-20T00:00:00.000Z",
    actorRefs: [{ actorType: "system", actorId: "clock" }],
    subjectRefs: [{ entityType: "resource_account", entityId: "account_a" }],
    regionRefs: [],
    command: {
      commandId: "command_1",
      commandType: "world_clock.advance",
      idempotencyKey: "idem_1",
      inputHash: HASH_B,
    },
    causality: {
      causalParentEventIds: [],
      rootPressureIds: [],
      rootReason: "external_clock",
    },
    authorizationRefs: ["auth:system"],
    evidenceRefs: [],
    visibilityPolicyRef: "visibility:public",
    versions: {
      rulesetVersion: "ruleset_1",
      contentVersion: "content_1",
      adjudicatorVersion: "adjudicator_1",
    },
    determinism: {
      algorithmId: "deterministic",
      algorithmVersion: "1",
    },
    payload: {},
    effects: [
      resourceLedgerEffect("effect_resource_1", [
        { accountRef: "account_a", quantityMinor: "5" },
      ]),
    ],
    proof: {
      payloadHash: HASH_C,
      effectsHash: HASH_D,
      eventHash: HASH_A,
    },
    ...overrides,
  };
}

function resourceLedgerEffect(
  effectId: string,
  entries: readonly { readonly accountRef: string; readonly quantityMinor: string }[],
): CausalEffectV1 {
  return {
    effectId,
    effectType: "resource_ledger",
    targetRef: { entityType: "resource_account", entityId: "account_a" },
    operation: "transfer",
    after: {
      resourceKey: "coin",
      resourceClass: "currency",
      unit: "minor",
      entries,
    },
    sourceEventIds: [],
    authorizationRefs: ["auth:system"],
  };
}

function ownershipEffect(effectId = "effect_owner_1"): CausalEffectV1 {
  return {
    effectId,
    effectType: "ownership_interest",
    targetRef: { entityType: "artifact", entityId: "relic_1" },
    operation: "grant",
    after: {
      itemRef: "artifact:relic_1",
      interestType: "title",
      holderRef: "agent:keeper",
      validFromWorldMinute: 1,
      basisEventIds: ["event_basis"],
      priority: 1,
      transferable: true,
      status: "granted",
    },
    sourceEventIds: ["event_basis"],
    authorizationRefs: ["auth:system"],
  };
}

function lifecycleEffect(effectId = "effect_lifecycle_1"): CausalEffectV1 {
  return {
    effectId,
    effectType: "unique_item_lifecycle",
    targetRef: { entityType: "artifact", entityId: "relic_2" },
    operation: "activate",
    after: {
      itemId: "relic_2",
      itemType: "artifact",
      toState: "active",
      titleOwnerRef: "agent:warden",
    },
    sourceEventIds: [],
    authorizationRefs: ["auth:system"],
  };
}

function pressure(overrides: Partial<EpochWorldPressure> = {}): EpochWorldPressure {
  return {
    pressureId: "pressure_1",
    type: "survival",
    scopeRef: "region:gray_harbor",
    sourceFactEventIds: ["fact_1"],
    affectedActorRefs: ["agent:keeper"],
    affectedResourceRefs: ["resource:coin"],
    severity: 75,
    urgency: 60,
    growthRate: 5,
    uncertainty: 20,
    visibility: 80,
    state: "detected",
    counterPressureIds: [],
    openedAtWorldMinute: 1,
    updatedAtWorldMinute: 1,
    reviewAtWorldMinute: 5,
    ...overrides,
  };
}

function knowledgeRecord(overrides: Partial<EpochKnowledgeRecord> = {}): EpochKnowledgeRecord {
  return {
    id: "knowledge_1",
    kind: "fact",
    subject: "region:gray_harbor",
    text: "Gray Harbor has a civic ledger.",
    confidence: 0.9,
    status: "accepted",
    evidence: {
      evidenceIds: ["evidence_1"],
      sourceEventIds: ["event_1"],
      sourceChain: [],
      trustClasses: ["system_worker"],
      sourceAuthorities: ["core"],
      channels: ["canonical"],
      hopCount: 0,
      confirmationBias: 0,
    },
    visibility: {
      scopes: ["public"],
      legalAccess: "public",
      regionIds: ["gray_harbor"],
      organizationIds: [],
      agentIds: [],
      explorerIds: [],
      evidenceIds: ["evidence_1"],
    },
    supports: [],
    refutes: [],
    refutedBy: [],
    supersedes: [],
    ...overrides,
  };
}

function actorMind(overrides: Partial<ActorMind> = {}): ActorMind {
  return {
    actorRef: "agent:keeper",
    needs: [],
    values: [],
    roles: [],
    beliefs: ["knowledge_1"],
    relationships: [],
    commitments: [],
    activeGoals: [],
    queuedGoals: [],
    constraints: [],
    riskTolerance: 0.4,
    planningHorizonWorldMinutes: 120,
    simulationLod: 2,
    ...overrides,
  };
}

function lodSubject(overrides: Partial<CausalSimulationLodSubjectState> = {}): CausalSimulationLodSubjectState {
  return {
    subjectRef: "region:gray_harbor",
    simulationLod: 3,
    reason: "high_pressure",
    updatedAtWorldMinute: 10,
    ...overrides,
  } as CausalSimulationLodSubjectState;
}

function metricValue(
  snapshot: ReturnType<ReturnType<typeof createCausalObservabilityCollector>["snapshot"]>,
  name: string,
  labels: Readonly<Record<string, string | number | boolean>> = {},
): number {
  return snapshot.metrics.find((metric) =>
    metric.name === name
    && Object.entries(labels).every(([key, value]) => metric.labels[key] === value))?.value || 0;
}

test("empty snapshot has a stable v1 hash and checkpoint registry metadata", () => {
  const snapshot = emptyCausalWorldSnapshot("world_1");

  assert.equal(snapshot.snapshotSchemaVersion, 1);
  assert.match(causalWorldSnapshotHash(snapshot), /^sha256:[a-f0-9]{64}$/);
  assert.equal(snapshot.checkpoint?.snapshotHash, causalWorldSnapshotHash(snapshot));
  assert.equal(snapshot.checkpoint?.schemaRegistryHash, causalSchemaRegistryHash());
});

test("snapshot migration rejects cross-world v1 and legacy snapshots", () => {
  const v1 = migrateCausalSnapshot({
    snapshot: createCausalWorldSnapshot({ worldId: "foreign_world" }),
    worldId: "world_1",
  });
  const legacy = migrateCausalSnapshot({
    snapshot: {
      worldId: "foreign_world",
      legacyEvents: [],
    },
    worldId: "world_1",
  });
  const mixedLegacyEvent = migrateCausalSnapshot({
    snapshot: {
      legacyEvents: [{ eventId: "legacy_event_foreign", worldId: "foreign_world" }],
    },
    worldId: "world_1",
  });

  assert.equal(v1.report.status, "rejected");
  assert.equal(v1.report.issues[0]?.code, "CAUSAL_SNAPSHOT_MIGRATION_WORLD_MISMATCH");
  assert.equal(legacy.report.status, "rejected");
  assert.equal(legacy.report.issues[0]?.code, "CAUSAL_SNAPSHOT_MIGRATION_WORLD_MISMATCH");
  assert.equal(mixedLegacyEvent.report.status, "rejected");
  assert.equal(mixedLegacyEvent.report.issues[0]?.code, "CAUSAL_SNAPSHOT_MIGRATION_WORLD_MISMATCH");
});

test("v1 snapshot hash ignores checkpoint metadata", () => {
  const snapshot = createCausalWorldSnapshot({ worldId: "world_1" });
  const withCheckpoint = createCausalWorldSnapshot({
    ...snapshot,
    checkpoint: causalCheckpointMetadata(snapshot, {
      checkpointId: "checkpoint_custom",
      createdAt: "2026-07-20T00:00:01.000Z",
      migrationVersion: 1,
    }),
  });

  assert.equal(causalWorldSnapshotHash(withCheckpoint), causalWorldSnapshotHash(snapshot));
});

test("event replay advances cursor and keeps stream continuity", () => {
  const event = eventFixture();
  const next = applyCausalEventToSnapshot(emptyCausalWorldSnapshot("world_1"), event);

  assert.equal(next.replayCursor.eventCount, 1);
  assert.equal(next.replayCursor.lastEventId, "event_1");
  assert.equal(next.replayCursor.lastEventHash, HASH_A);
  assert.equal(next.replayCursor.lastWorldMinute, 10);
  assert.deepEqual(next.replayCursor.streams["resource_account:account_a"], {
    streamType: "resource_account",
    streamId: "account_a",
    latestVersion: 1,
    latestEventId: "event_1",
    latestEventHash: HASH_A,
    latestWorldMinute: 10,
  });
});

test("duplicate replay is idempotent only when duplicates are allowed", () => {
  const event = eventFixture();
  const snapshot = applyCausalEventToSnapshot(emptyCausalWorldSnapshot("world_1"), event);

  assert.throws(
    () => applyCausalEventToSnapshot(snapshot, event),
    (error: unknown) => error instanceof Error && "code" in error && error.code === "CAUSAL_REPLAY_EVENT_DUPLICATE",
  );
  assert.equal(applyCausalEventToSnapshot(snapshot, event, { allowDuplicate: true }), snapshot);
});

test("replay rejects stream gaps and event hash conflicts", () => {
  const first = applyCausalEventToSnapshot(emptyCausalWorldSnapshot("world_1"), eventFixture());
  const gap = eventFixture({
    eventId: "event_gap",
    stream: { streamType: "resource_account", streamId: "account_a", streamVersion: 3 },
    proof: { payloadHash: HASH_C, effectsHash: HASH_D, eventHash: HASH_B },
  });
  const conflict = eventFixture({
    proof: { payloadHash: HASH_C, effectsHash: HASH_D, eventHash: HASH_E },
  });

  assert.deepEqual(checkCausalReplayContinuity(first, gap).errors.map((error) => error.code), [
    "CAUSAL_REPLAY_STREAM_GAP",
  ]);
  assert.deepEqual(checkCausalReplayContinuity(first, conflict).errors.map((error) => error.code), [
    "CAUSAL_REPLAY_EVENT_HASH_CONFLICT",
    "CAUSAL_REPLAY_STREAM_GAP",
  ]);
});

test("snapshot applies balances and ownership effects from replayed events", () => {
  const event = eventFixture({
    effects: [
      resourceLedgerEffect("effect_resource_1", [
        { accountRef: "account_a", quantityMinor: "5" },
        { accountRef: "account_b", quantityMinor: "-2" },
      ]),
      ownershipEffect(),
      lifecycleEffect(),
    ],
  });

  const snapshot = applyCausalEventToSnapshot(emptyCausalWorldSnapshot("world_1"), event);

  assert.equal(snapshot.balances.byAccount.account_a["coin:minor"], "5");
  assert.equal(snapshot.balances.byAccount.account_b["coin:minor"], "-2");
  assert.equal(snapshot.ownership.titleOwners["artifact:relic_1"], "agent:keeper");
  assert.equal(snapshot.ownership.titleOwners["artifact:relic_2"], "agent:warden");
  assert.equal(snapshot.ownership.items.find((item) => item.itemRef === "artifact:relic_2")?.lifecycleState, "active");
});

test("snapshot normalizes pressure, knowledge, actor mind, LOD, and domain extensions", () => {
  const snapshot = createCausalWorldSnapshot({
    worldId: "world_1",
    replayCursor: { eventCount: 0, lastWorldMinute: 10 },
    pressure: {
      active: [
        pressure({ pressureId: "pressure_due", reviewAtWorldMinute: 5, severity: 75 }),
        pressure({ pressureId: "pressure_future", reviewAtWorldMinute: 20, severity: 20 }),
        pressure({ pressureId: "pressure_done", state: "resolved", reviewAtWorldMinute: 1, severity: 90 }),
      ],
    },
    knowledge: {
      records: [
        knowledgeRecord({ id: "knowledge_b", kind: "rumor" }),
        knowledgeRecord({ id: "knowledge_a", kind: "fact" }),
      ],
    },
    actorMind: {
      mindsByActor: { "agent:keeper": actorMind() },
      lodBySubject: { "region:gray_harbor": lodSubject() },
    },
    domainExtensions: [
      {
        slotId: "slot_b",
        schemaId: "domain.extra",
        schemaVersion: 1,
        owner: "test",
        hash: HASH_A,
        payload: { z: 1, a: 2 },
      },
      {
        slotId: "slot_a",
        schemaId: "domain.extra",
        schemaVersion: 1,
        owner: "test",
        hash: HASH_B,
        payload: { value: true },
      },
    ],
  });

  assert.deepEqual(Object.keys(snapshot.pressure.byId), ["pressure_done", "pressure_due", "pressure_future"]);
  assert.deepEqual(snapshot.pressure.backlog, { dueCount: 1, criticalCount: 1, overdueCriticalCount: 1 });
  assert.deepEqual(snapshot.knowledge.records.map((record) => record.id), ["knowledge_a", "knowledge_b"]);
  assert.deepEqual(snapshot.knowledge.countsByKind, { fact: 1, rumor: 1 });
  assert.equal(snapshot.actorMind.mindsByActor["agent:keeper"].simulationLod, 2);
  assert.equal(snapshot.actorMind.lodBySubject["region:gray_harbor"].simulationLod, 3);
  assert.deepEqual(snapshot.actorMind.lodDistribution, { 0: 0, 1: 0, 2: 1, 3: 1 });
  assert.deepEqual(snapshot.domainExtensions.map((slot) => slot.slotId), ["slot_a", "slot_b"]);
  assert.notEqual(snapshot.domainExtensions[0].hash, HASH_B);
});

test("checkpoint registry hash matches the snapshot registry hash", () => {
  const snapshot = createCausalWorldSnapshot({ worldId: "world_1" });
  const checkpoint = causalCheckpointMetadata(snapshot, { checkpointId: "checkpoint_1" });

  assert.equal(checkpoint.schemaRegistryHash, snapshot.schemaRegistryHash);
  assert.equal(checkpoint.snapshotHash, causalWorldSnapshotHash(snapshot));
});

test("v1 assertion rejects snapshot body tampering under a stale checkpoint", () => {
  const snapshot = applyCausalEventToSnapshot(emptyCausalWorldSnapshot("world_1"), eventFixture({
    effects: [
      resourceLedgerEffect("effect_resource_1", [
        { accountRef: "account_a", quantityMinor: "5" },
      ]),
      ownershipEffect(),
    ],
  }));
  const staleCheckpoint = snapshot.checkpoint;

  const tamperedSnapshots: readonly CausalWorldSnapshotV1[] = [
    {
      ...snapshot,
      balances: {
        ...snapshot.balances,
        byAccount: {
          ...snapshot.balances.byAccount,
          account_a: { "coin:minor": "6" },
        },
      },
      checkpoint: staleCheckpoint,
    },
    {
      ...snapshot,
      ownership: {
        ...snapshot.ownership,
        titleOwners: {
          ...snapshot.ownership.titleOwners,
          "artifact:relic_1": "agent:thief",
        },
      },
      checkpoint: staleCheckpoint,
    },
    {
      ...snapshot,
      eventHashes: { ...snapshot.eventHashes, event_1: HASH_B },
      checkpoint: staleCheckpoint,
    },
    {
      ...snapshot,
      replayCursor: { ...snapshot.replayCursor, eventCount: 2 },
      checkpoint: staleCheckpoint,
    },
  ];

  for (const tampered of tamperedSnapshots) {
    assert.throws(
      () => assertCausalWorldSnapshotV1(tampered),
      (error: unknown) => error instanceof Error && "code" in error,
    );
  }
});

test("checkpoint metadata and replay indexes must match recomputed v1 content", () => {
  const snapshot = applyCausalEventToSnapshot(emptyCausalWorldSnapshot("world_1"), eventFixture());
  const loaded = assertCausalWorldSnapshotV1(snapshot);
  assert.equal(loaded.checkpoint?.snapshotHash, causalWorldSnapshotHash(loaded));
  assert.equal(loaded.checkpoint?.schemaRegistryHash, causalSchemaRegistryHash());
  assert.deepEqual(loaded.checkpoint?.replayCursor, loaded.replayCursor);

  for (const checkpoint of [
    { ...snapshot.checkpoint!, snapshotHash: HASH_E },
    { ...snapshot.checkpoint!, schemaRegistryHash: HASH_E },
    { ...snapshot.checkpoint!, replayCursor: { ...snapshot.replayCursor, eventCount: 0 } },
  ]) {
    assert.throws(
      () => assertCausalWorldSnapshotV1({ ...snapshot, checkpoint }),
      (error: unknown) => error instanceof Error && "code" in error && error.code === "CAUSAL_SNAPSHOT_CHECKPOINT_MISMATCH",
    );
  }
});

test("v1 assertion rejects ghost hashes missing hashes and broken replay cursor continuity", () => {
  const snapshot = applyCausalEventToSnapshot(emptyCausalWorldSnapshot("world_1"), eventFixture());

  assert.throws(
    () => assertCausalWorldSnapshotV1({
      ...snapshot,
      eventHashes: {},
      checkpoint: causalCheckpointMetadata({ ...snapshot, eventHashes: {} }),
    }),
    (error: unknown) => error instanceof Error && "code" in error && error.code === "CAUSAL_REPLAY_EVENT_HASH_CONFLICT",
  );
  assert.throws(
    () => assertCausalWorldSnapshotV1({
      ...snapshot,
      eventHashes: { ...snapshot.eventHashes, ghost_event: HASH_B },
      checkpoint: causalCheckpointMetadata({ ...snapshot, eventHashes: { ...snapshot.eventHashes, ghost_event: HASH_B } }),
    }),
    (error: unknown) => error instanceof Error && "code" in error && error.code === "CAUSAL_REPLAY_EVENT_HASH_CONFLICT",
  );
  assert.throws(
    () => assertCausalWorldSnapshotV1({
      ...snapshot,
      replayCursor: {
        ...snapshot.replayCursor,
        streams: {
          ...snapshot.replayCursor.streams,
          "resource_account:account_a": {
            ...snapshot.replayCursor.streams["resource_account:account_a"],
            latestVersion: 2,
          },
        },
      },
      checkpoint: causalCheckpointMetadata({
        ...snapshot,
        replayCursor: {
          ...snapshot.replayCursor,
          streams: {
            ...snapshot.replayCursor.streams,
            "resource_account:account_a": {
              ...snapshot.replayCursor.streams["resource_account:account_a"],
              latestVersion: 2,
            },
          },
        },
      }),
    }),
    (error: unknown) => error instanceof Error && "code" in error && error.code === "CAUSAL_REPLAY_CURSOR_CONFLICT",
  );
});

test("v1 snapshot domains deep-validate resource production and life profiles", () => {
  const snapshot = createCausalWorldSnapshot({ worldId: "world_1" });
  const validNode = {
    nodeId: "node_1",
    resourceKey: "wood",
    resourceClass: "material",
    unit: "minor",
    capacity: "9007199254740993",
    remainingUnits: "9007199254740992",
    yieldPerWorkUnit: "1",
    workerSlots: 1,
    registeredAtWorldTime: 1,
  };
  const baseLifeProfile = createLifeProfile({
    actors: [{ actorRef: "actor:a", householdRef: "household:one" }],
  });
  const invalidLifeProfile = {
    ...baseLifeProfile,
    households: [{
      ...baseLifeProfile.households[0]!,
      resources: { ...baseLifeProfile.households[0]!.resources, food: -1 },
    }],
  };

  const badCapacity = {
    ...snapshot,
    domains: {
      ...snapshot.domains,
      resourceProductionNodes: [{ ...validNode, remainingUnits: "9007199254740994" }],
    },
  };
  const invalidResourceNodes = [
    { ...validNode, capacity: "-1" },
    { ...validNode, capacity: "01" },
    { ...validNode, capacity: 10 },
    { ...validNode, remainingUnits: "-1" },
    { ...validNode, remainingUnits: "1.5" },
    { ...validNode, yieldPerWorkUnit: "0" },
    (({ remainingUnits, ...node }) => ({ ...node, remaining: remainingUnits }))(validNode),
    (({ yieldPerWorkUnit, ...node }) => ({ ...node, yield: yieldPerWorkUnit }))(validNode),
  ];
  const badAssignment = {
    ...snapshot,
    domains: {
      ...snapshot.domains,
      resourceProductionNodes: [validNode],
      resourceProductionAssignments: [
        { assignmentId: "assignment_1", nodeId: "node_1", workerRef: "actor:a", slotIndex: 0 },
        { assignmentId: "assignment_2", nodeId: "node_1", workerRef: "actor:b", slotIndex: 0 },
      ],
    },
  };
  const badLifeProfile = {
    ...snapshot,
    domains: {
      ...snapshot.domains,
      lifeProfiles: [{ profileId: "profile_1", state: invalidLifeProfile }],
    },
  };

  assert.doesNotThrow(() => assertCausalWorldSnapshotV1({
    ...snapshot,
    domains: {
      ...snapshot.domains,
      resourceProductionNodes: [validNode],
    },
    checkpoint: undefined,
  }));

  for (const tampered of [
    badCapacity,
    ...invalidResourceNodes.map((node) => ({
      ...snapshot,
      domains: {
        ...snapshot.domains,
        resourceProductionNodes: [node],
      },
    })),
    badAssignment,
    badLifeProfile,
  ]) {
    const withoutCheckpoint = { ...tampered, checkpoint: undefined };
    assert.throws(
      () => assertCausalWorldSnapshotV1(withoutCheckpoint),
      (error: unknown) => error instanceof Error && "code" in error && error.code === "CAUSAL_SNAPSHOT_SCHEMA_INVALID",
    );
    assert.equal(migrateCausalSnapshot({ worldId: "world_1", snapshot: withoutCheckpoint }).report.status, "rejected");
  }
});

test("migration converts empty and legacy snapshots to v1 defaults", () => {
  const empty = migrateCausalSnapshot({ worldId: "world_1", nowMs: () => 10 });
  const legacy = migrateCausalSnapshot({
    worldId: "world_1",
    nowMs: () => 10,
    snapshot: {
      worldId: "world_1",
      events: [{ id: "legacy_event", type: "old_event", causalParentEventIds: ["parent_1"] }],
      balances: { account_a: { "coin:minor": "7" } },
      ownership: { "artifact:relic_1": "agent:keeper" },
    },
  });

  assert.equal(empty.report.fromVersion, "empty");
  assert.equal(empty.report.status, "migrated");
  assert.equal(empty.snapshot?.snapshotSchemaVersion, 1);
  assert.equal(legacy.report.status, "migrated");
  assert.equal(legacy.report.migratedEventCount, 1);
  assert.equal(legacy.snapshot?.events.legacy_event.legacyCausalStatus, "legacy_partially_attributed");
  assert.equal(legacy.snapshot?.replayCursor.eventCount, 1);
  assert.equal(legacy.snapshot?.eventHashes.legacy_event, legacy.snapshot?.replayCursor.lastEventHash);
  assert.deepEqual(legacy.snapshot?.domainExtensions, []);
  assert.deepEqual(legacy.snapshot?.pressure.backlog, { dueCount: 0, criticalCount: 0, overdueCriticalCount: 0 });
});

test("migration is idempotent for v1 snapshots and dry-run leaves output unchanged", () => {
  const snapshot = createCausalWorldSnapshot({ worldId: "world_1" });
  const unchanged = migrateCausalSnapshot({ worldId: "world_1", snapshot });
  const dryRun = migrateCausalSnapshot({ worldId: "world_1", snapshot: { events: [] }, dryRun: true });

  assert.equal(unchanged.report.status, "unchanged");
  assert.deepEqual(unchanged.snapshot, snapshot);
  assert.equal(dryRun.report.status, "migrated");
  assert.equal(dryRun.report.dryRun, true);
  assert.equal(dryRun.snapshot, undefined);
});

test("migration v1 passthrough and dry-run reject stale checkpoints", () => {
  const snapshot = applyCausalEventToSnapshot(emptyCausalWorldSnapshot("world_1"), eventFixture());
  const tampered = {
    ...snapshot,
    balances: {
      ...snapshot.balances,
      byAccount: {
        ...snapshot.balances.byAccount,
        account_a: { "coin:minor": "999" },
      },
    },
    checkpoint: snapshot.checkpoint,
  };

  const unchanged = migrateCausalSnapshot({ worldId: "world_1", snapshot });
  const rejected = migrateCausalSnapshot({ worldId: "world_1", snapshot: tampered });
  const dryRunRejected = migrateCausalSnapshot({ worldId: "world_1", snapshot: tampered, dryRun: true });

  assert.equal(unchanged.report.status, "unchanged");
  assert.equal(rejected.report.status, "rejected");
  assert.equal(rejected.snapshot, undefined);
  assert.equal(dryRunRejected.report.status, "rejected");
  assert.equal(dryRunRejected.snapshot, undefined);
});

test("migration rejects unknown future snapshots", () => {
  const output = migrateCausalSnapshot({
    worldId: "world_1",
    snapshot: { snapshotSchemaVersion: 999, worldId: "world_1" },
  });

  assert.equal(output.report.status, "rejected");
  assert.equal(output.snapshot, undefined);
  assert.equal(output.report.issues[0].code, "CAUSAL_SNAPSHOT_MIGRATION_UNSUPPORTED_FUTURE_VERSION");
});

test("v1 assertion rejects future snapshots and registry mismatches", () => {
  assert.throws(
    () => assertCausalWorldSnapshotV1({ snapshotSchemaVersion: 999, worldId: "world_1" }),
    (error: unknown) => error instanceof Error && "code" in error && error.code === "CAUSAL_SNAPSHOT_FUTURE_VERSION",
  );
  assert.throws(
    () => assertCausalWorldSnapshotV1({
      ...createCausalWorldSnapshot({ worldId: "world_1" }),
      schemaRegistryHash: HASH_A,
    }),
    (error: unknown) => error instanceof Error && "code" in error && error.code === "CAUSAL_SNAPSHOT_REGISTRY_HASH_MISMATCH",
  );
});

test("observability records commit reject replay degraded validation pressure LOD and migration metrics", () => {
  const collector = createCausalObservabilityCollector();
  const snapshot = createCausalWorldSnapshot({
    worldId: "world_1",
    replayCursor: { eventCount: 0, lastWorldMinute: 10 },
    pressure: { active: [pressure({ reviewAtWorldMinute: 5, severity: 80 })] },
    actorMind: { mindsByActor: { "agent:keeper": actorMind() }, lodBySubject: { "region:gray_harbor": lodSubject() } },
  });

  collector.recordCommit();
  collector.recordReject({ code: "COMMAND_REJECTED" });
  collector.recordReplay({ continuity: { ok: false, expectedStreamVersion: 2, actualStreamVersion: 4, errors: [] } });
  collector.recordProjectionDegraded({ code: "PROJECTION_STALE" });
  collector.recordValidationErrors([
    { code: "RESOURCE_UNBALANCED", message: "unbalanced", details: { amount: 1 } } as unknown as CausalValidationError,
    { code: "CAUSAL_SCHEMA_INVALID", message: "schema", details: { field: "event" } } as unknown as CausalValidationError,
  ]);
  collector.recordPressureBacklog(snapshot);
  collector.recordKnowledgeLeakageReject({ code: "PRIVATE_FACT_VISIBLE" });
  collector.recordLodDistribution(snapshot);
  collector.recordMigration({
    fromVersion: "legacy",
    toVersion: 1,
    dryRun: false,
    status: "migrated",
    changed: true,
    migratedEventCount: 2,
    issues: [],
    durationMs: 15,
  });

  const observed = collector.snapshot();

  assert.equal(metricValue(observed, "causal_commit_total", { outcome: "committed" }), 1);
  assert.equal(metricValue(observed, "causal_reject_total", { code: "COMMAND_REJECTED" }), 1);
  assert.equal(metricValue(observed, "causal_replay_total", { outcome: "continuity_failed" }), 1);
  assert.equal(metricValue(observed, "causal_projection_degraded_total", { code: "PROJECTION_STALE" }), 1);
  assert.equal(metricValue(observed, "causal_conservation_error_total", { code: "RESOURCE_UNBALANCED" }), 1);
  assert.equal(metricValue(observed, "causal_schema_error_total", { code: "CAUSAL_SCHEMA_INVALID" }), 1);
  assert.equal(metricValue(observed, "causal_pressure_backlog_total", { kind: "due" }), 1);
  assert.equal(metricValue(observed, "causal_knowledge_leakage_reject_total", { code: "PRIVATE_FACT_VISIBLE" }), 1);
  assert.equal(metricValue(observed, "causal_lod_subject_total", { lod: "2" }), 1);
  assert.equal(metricValue(observed, "causal_lod_subject_total", { lod: "3" }), 1);
  assert.equal(metricValue(observed, "causal_migration_total", { status: "migrated", dryRun: false }), 1);
  assert.equal(metricValue(observed, "causal_migration_duration_ms", { status: "migrated", dryRun: false }), 15);
});

test("observability filters high-cardinality metric labels", () => {
  const collector = createCausalObservabilityCollector();

  collector.recordReject({
    code: "COMMAND_REJECTED",
    details: {
      actorId: "agent_with_unbounded_cardinality",
      requestId: "request_123",
    },
  });

  const [metric] = collector.snapshot().metrics;
  assert.deepEqual(metric.labels, { code: "COMMAND_REJECTED", outcome: "rejected" });
});

test("observability traces preserve order and do not drop entries above small UI limits", () => {
  const collector = createCausalObservabilityCollector();

  for (let index = 0; index < 25; index += 1) {
    collector.recordCommit({ at: `2026-07-20T00:00:${String(index).padStart(2, "0")}.000Z`, details: { index } });
  }

  const traces = collector.snapshot().traces;
  assert.equal(traces.length, 25);
  assert.deepEqual(traces.map((trace) => trace.details.index), Array.from({ length: 25 }, (_value, index) => index));
});

test("health reports degraded readiness for projection issues and unready SLO violations", () => {
  const collector = createCausalObservabilityCollector();

  collector.recordCommit();
  collector.recordProjectionDegraded();
  assert.deepEqual(collector.snapshot({ maxProjectionDegradedTotal: 2 }).health, {
    status: "degraded",
    ready: true,
    reasons: [],
    counters: {
      causal_commit_total: 1,
      "causal_commit_total{outcome=committed}": 1,
      causal_projection_degraded_total: 1,
      "causal_projection_degraded_total{code=PROJECTION_LAGGING}": 1,
    },
    slo: { ok: true, violations: [] },
  });

  const unready = collector.snapshot({
    maxProjectionDegradedTotal: 0,
    maxRejectRate: 0,
  }).health;

  assert.equal(unready.status, "unready");
  assert.equal(unready.ready, false);
  assert.deepEqual(unready.reasons, ["maxProjectionDegradedTotal:1>0"]);
});

test("health summary evaluates reject-rate and pressure SLO thresholds", () => {
  const health = causalHealthSummary([
    { name: "causal_commit_total", value: 1, labels: {} },
    { name: "causal_reject_total", value: 1, labels: {} },
    { name: "causal_pressure_backlog_total", value: 3, labels: { kind: "due" } },
    { name: "causal_pressure_backlog_total", value: 2, labels: { kind: "critical" } },
  ], [], {
    maxRejectRate: 0.4,
    maxPressureBacklogDue: 2,
    maxCriticalPressureBacklog: 1,
  });

  assert.equal(health.status, "unready");
  assert.equal(health.ready, false);
  assert.deepEqual(health.slo.violations.map((violation) => violation.threshold), [
    "maxRejectRate",
    "maxPressureBacklogDue",
    "maxCriticalPressureBacklog",
  ]);
}
);
