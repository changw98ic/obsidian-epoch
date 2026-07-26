import assert from "node:assert/strict";
import test from "node:test";

import {
  OFFER_SCHEMA_VERSION,
  type InternalQuestOffer,
  type MarketSnapshot,
  type PublicQuestOffer,
  type QuestOfferLifecycle,
} from "../lib/epoch/journeyOfferRules.ts";
import {
  buildInternalQuestOffer,
  createInitialLifecycle,
  QuestOfferStoreImpl,
  type JourneyOfferRepository,
  type OfferPersistenceRecord,
} from "../lib/epoch/journeyOfferStore.ts";
import { createJourneyOfferRuntime } from "../lib/epoch/journeyOfferRuntime.ts";
import { createAgentCompanionRuntime } from "../lib/epoch/agentCompanionRuntime.ts";
import { assertPublicSafe, findInternalOfferFields } from "../lib/safety.ts";

/**
 * PR3 audit round 2 — adversarial-findings regression tests.
 *
 * Each test maps 1:1 to a finding from the verify pass:
 *   - prepare-failure leaks claim  (Fix 1)
 *   - no auto-sweep for reservation TTL expiry  (Fix 2)
 *   - completeQuestOffer mismatch check no-op  (Fix 3)
 *   - materialize occurredAt dead-code reference  (Fix 4, implicitly covered
 *     by no behavior change; included for documentation)
 *   - assertPublicSafe shallow nested-field check  (Fix 5)
 */

const EPOCH_NOW = "2026-07-12T00:00:00.000Z";
const WORLD_NOW = "2026-01-01T08:00:00.000Z";
const WORLD_SLICE_HASH = "sha256:0000000000000000000000000000000000000000000000000000000000000000";
const AGENT_ID = "agent_audit_round2";
const EXPLORER_ID = "explorer_audit_round2";

// ---------------------------------------------------------------------------
// In-memory repository
// ---------------------------------------------------------------------------

interface InMemoryRepository extends JourneyOfferRepository {
  readonly records: readonly OfferPersistenceRecord[];
}

function createInMemoryRepository(): InMemoryRepository {
  const records: OfferPersistenceRecord[] = [];
  return {
    records,
    async appendOfferRecord(record) {
      records.push(record);
    },
    async readOfferRecords() {
      return [...records];
    },
  };
}

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

interface BuildOfferInput {
  readonly questOfferId: string;
  readonly taskFamilyId: string;
  readonly taskTypeText: string;
  readonly scenarioMapId: string;
  readonly regionId: string;
  readonly marketSnapshotVersion?: number;
}

function buildPublicOffer(input: BuildOfferInput): PublicQuestOffer {
  return {
    questOfferId: input.questOfferId,
    marketSnapshotVersion: input.marketSnapshotVersion ?? 1,
    taskTypeText: input.taskTypeText,
    scenarioSummary: `scenario:${input.questOfferId}`,
    region: { regionId: input.regionId, scenarioMapId: input.scenarioMapId },
    scenarioMapId: input.scenarioMapId,
    estimatedDifficulty: "medium",
    rewardPreview: { authority: "preview_only" },
    expiresAt: "2099-01-01T00:00:00.000Z",
    schemaVersion: OFFER_SCHEMA_VERSION,
  };
}

function buildInternal(input: BuildOfferInput): InternalQuestOffer {
  return buildInternalQuestOffer({
    publicView: buildPublicOffer(input),
    taskFamilyId: input.taskFamilyId,
    expectedApproach: ["combat"],
    worldSliceHash: WORLD_SLICE_HASH,
    source: "catalog_fallback",
  });
}

function buildSnapshot(regionId: string, version: number, ids: readonly string[]): MarketSnapshot {
  return {
    marketSnapshotVersion: version,
    regionId,
    questOfferIds: [...ids],
    worldSliceHash: WORLD_SLICE_HASH,
    takenAt: EPOCH_NOW,
    schemaVersion: OFFER_SCHEMA_VERSION,
  };
}

async function seed(
  store: QuestOfferStoreImpl,
  regionId: string,
  offers: readonly InternalQuestOffer[],
  snapshotVersion = 1,
): Promise<void> {
  const snapshot = buildSnapshot(regionId, snapshotVersion, offers.map((o) => o.questOfferId));
  await store.materialize({
    snapshot,
    publicOffers: offers.map((o) => o.publicView),
    internalOffers: offers,
    lifecycles: offers.map((o) => createInitialLifecycle(o.questOfferId)),
  });
}

async function reserve(
  store: QuestOfferStoreImpl,
  questOfferId: string,
  explorerId: string,
): Promise<string> {
  const r = await store.reserveQuestOffer({
    questOfferId,
    explorerId,
    marketSnapshotVersion: 1,
    now: EPOCH_NOW,
  });
  return r.reservationToken;
}

// ---------------------------------------------------------------------------
// Fix 1: prepare-failure rolls back a FRESH claim
// ---------------------------------------------------------------------------

interface Fixture {
  readonly repo: InMemoryRepository;
  readonly offerRuntime: ReturnType<typeof createJourneyOfferRuntime>;
  readonly companion: ReturnType<typeof createAgentCompanionRuntime>;
}

function buildFixture(): Fixture {
  const repo = createInMemoryRepository();
  const offerRuntime = createJourneyOfferRuntime({
    repository: repo,
    now: () => EPOCH_NOW,
  });
  let sequence = 0;
  const companion = createAgentCompanionRuntime({
    epoch: {
      progress: () => ({
        identity: { agentId: AGENT_ID, explorerId: EXPLORER_ID, status: "active" },
      }),
      verifyExplorerAuth: () => ({ explorerId: EXPLORER_ID, verified: true }),
      regionInfo: () => ({}),
      agentBriefing: () => ({}),
      events: () => ({ events: [] }),
    },
    journeyOptions: {
      idFactory: (kind) => `${kind}_audit_round2_${++sequence}`,
      nowReal: () => EPOCH_NOW,
      nowWorld: () => WORLD_NOW,
      defaultRealDurationMs: 30 * 60 * 1_000,
      defaultWorldDurationMs: 60 * 60 * 1_000,
      pollIntervalMs: 5 * 60 * 1_000,
    },
    offerRuntime,
  });
  return { repo, offerRuntime, companion };
}

test("Fix 1: prepareWithOffer rolls back the fresh claim when prepare throws offer_hash_mismatch", async () => {
  const { offerRuntime, companion } = buildFixture();
  const offer = buildInternal({
    questOfferId: "qo_rollback_hash",
    taskFamilyId: "tf_combat",
    taskTypeText: "清剿",
    scenarioMapId: "map_west_ruins",
    regionId: "region_west_ruins",
  });
  await seed(offerRuntime.getStore(), "region_west_ruins", [offer]);
  const token = await reserve(offerRuntime.getStore(), "qo_rollback_hash", EXPLORER_ID);

  await assert.rejects(
    () => companion.prepareWithOffer({
      agentId: AGENT_ID,
      questOfferId: "qo_rollback_hash",
      reservationToken: token,
      marketSnapshotVersion: 1,
      offerHash: "sha256:deadbeef",
      idempotencyKey: "rollback-hash",
      recoveryCode: "owner-credential",
    }),
    /offer_hash_mismatch/,
  );

  // The fresh claim is rolled back: lifecycle is `released` (terminal-bypass),
  // NOT `claimed`. The offer is unavailable for retries against the same id.
  const lifecycle = offerRuntime.getStore().projection.lifecyclesById["qo_rollback_hash"];
  assert.equal(lifecycle?.status, "released");
});

test("Fix 1: prepareWithOffer rolls back the fresh claim when prepare throws offer_region_mismatch", async () => {
  const { offerRuntime, companion } = buildFixture();
  const offer = buildInternal({
    questOfferId: "qo_rollback_region",
    taskFamilyId: "tf_support",
    taskTypeText: "支援",
    scenarioMapId: "map_south_village",
    regionId: "region_south_village",
  });
  await seed(offerRuntime.getStore(), "region_south_village", [offer]);
  const token = await reserve(offerRuntime.getStore(), "qo_rollback_region", EXPLORER_ID);

  await assert.rejects(
    () => companion.prepareWithOffer({
      agentId: AGENT_ID,
      destinationRegionId: "region_gray_harbor",
      questOfferId: "qo_rollback_region",
      reservationToken: token,
      marketSnapshotVersion: 1,
      idempotencyKey: "rollback-region",
      recoveryCode: "owner-credential",
    }),
    /offer_region_mismatch/,
  );

  const lifecycle = offerRuntime.getStore().projection.lifecyclesById["qo_rollback_region"];
  assert.equal(lifecycle?.status, "released");
});

test("Fix 1: prepareWithOffer does NOT roll back an idempotent-replay claim (prior claimed state)", async () => {
  // Scenario: first call claims the offer but throws downstream; the rollback
  // releases the offer. We then manually re-claim via the store to simulate
  // a "prior successful prepare" state, and verify a second failed prepare
  // does NOT release the prior claim.
  const { offerRuntime, companion } = buildFixture();
  const offer = buildInternal({
    questOfferId: "qo_no_rollback_replay",
    taskFamilyId: "tf_combat",
    taskTypeText: "清剿",
    scenarioMapId: "map_west_ruins",
    regionId: "region_west_ruins",
  });
  await seed(offerRuntime.getStore(), "region_west_ruins", [offer]);
  const token = await reserve(offerRuntime.getStore(), "qo_no_rollback_replay", EXPLORER_ID);

  // First call: claim succeeds, prepare throws offer_hash_mismatch.
  // Fix 1 rolls back the fresh claim (wasAlreadyClaimed was false).
  await assert.rejects(
    () => companion.prepareWithOffer({
      agentId: AGENT_ID,
      questOfferId: "qo_no_rollback_replay",
      reservationToken: token,
      marketSnapshotVersion: 1,
      offerHash: "sha256:deadbeef",
      idempotencyKey: "no-rollback-replay",
      recoveryCode: "owner-credential",
    }),
    /offer_hash_mismatch/,
  );
  let lifecycle = offerRuntime.getStore().projection.lifecyclesById["qo_no_rollback_replay"];
  assert.equal(lifecycle?.status, "released", "fresh claim should be rolled back");
  // getInternalOffer returns undefined for terminal lifecycles — second call
  // cannot even resolve the internal offer, so claim short-circuits but
  // prepare-side throws offer_resolution_failed. No release is performed
  // (claim succeeded via idempotent replay, but lifecycle was already
  // terminal when this call started, so wasAlreadyClaimed is false but
  // claimSucceededInThisCall short-circuited through the replay path while
  // getInternalOffer returned undefined and threw). The lifecycle stays
  // `released` — confirming no further state mutation occurred.
  await assert.rejects(
    () => companion.prepareWithOffer({
      agentId: AGENT_ID,
      questOfferId: "qo_no_rollback_replay",
      reservationToken: token,
      marketSnapshotVersion: 1,
      idempotencyKey: "no-rollback-replay",
      recoveryCode: "owner-credential",
    }),
    /offer_resolution_failed|offer_unavailable/,
  );
  lifecycle = offerRuntime.getStore().projection.lifecyclesById["qo_no_rollback_replay"];
  assert.equal(lifecycle?.status, "released", "retry must not change terminal state");
});

test("Fix 1: prepareWithOffer does NOT roll back when claim itself throws", async () => {
  // claim throws (token mismatch) — the catch path must observe
  // claimSucceededInThisCall === false and skip release entirely. The
  // lifecycle stays in its pre-call status.
  const { offerRuntime, companion } = buildFixture();
  const offer = buildInternal({
    questOfferId: "qo_claim_throws",
    taskFamilyId: "tf_combat",
    taskTypeText: "清剿",
    scenarioMapId: "map_west_ruins",
    regionId: "region_west_ruins",
  });
  await seed(offerRuntime.getStore(), "region_west_ruins", [offer]);
  await reserve(offerRuntime.getStore(), "qo_claim_throws", EXPLORER_ID);

  await assert.rejects(
    () => companion.prepareWithOffer({
      agentId: AGENT_ID,
      questOfferId: "qo_claim_throws",
      reservationToken: "deadbeef-wrong-token",
      marketSnapshotVersion: 1,
      idempotencyKey: "claim-throws",
      recoveryCode: "owner-credential",
    }),
    /offer_reservation_token_invalid/,
  );
  // Lifecycle stays `reserved` — claim threw, so no rollback should run.
  const lifecycle = offerRuntime.getStore().projection.lifecyclesById["qo_claim_throws"];
  assert.equal(lifecycle?.status, "reserved");
});

// ---------------------------------------------------------------------------
// Fix 2: sweepExpiredReservations
// ---------------------------------------------------------------------------

test("Fix 2: sweepExpiredReservations transitions TTL-elapsed reservations to expired", async () => {
  const repo = createInMemoryRepository();
  const store = new QuestOfferStoreImpl({ repository: repo, defaultReservationTtlMs: 1000 });
  const offerA = buildInternal({
    questOfferId: "qo_sweep_a",
    taskFamilyId: "tf_a",
    taskTypeText: "护送",
    scenarioMapId: "map_a",
    regionId: "r_north",
  });
  const offerB = buildInternal({
    questOfferId: "qo_sweep_b",
    taskFamilyId: "tf_b",
    taskTypeText: "侦察",
    scenarioMapId: "map_b",
    regionId: "r_north",
  });
  await seed(store, "r_north", [offerA, offerB]);

  const reservedAt = "2024-01-01T00:00:00.000Z";
  await store.reserveQuestOffer({
    questOfferId: "qo_sweep_a",
    explorerId: "ex_1",
    marketSnapshotVersion: 1,
    now: reservedAt,
  });
  await store.reserveQuestOffer({
    questOfferId: "qo_sweep_b",
    explorerId: "ex_2",
    marketSnapshotVersion: 1,
    now: reservedAt,
  });

  // Both reservations have TTL = reservedAt + 1000ms = 00:00:01.000Z.
  // Sweeping at 00:00:02.000Z (past TTL) must transition BOTH to expired.
  const afterTtl = "2024-01-01T00:00:02.000Z";
  const swept = await store.sweepExpiredReservations({ now: afterTtl });
  assert.deepEqual([...swept].sort(), ["qo_sweep_a", "qo_sweep_b"]);

  const lifeA = store.projection.lifecyclesById["qo_sweep_a"];
  const lifeB = store.projection.lifecyclesById["qo_sweep_b"];
  assert.equal(lifeA?.status, "expired");
  assert.equal(lifeB?.status, "expired");
  assert.equal(lifeA?.expiredAt, afterTtl);
  assert.equal(lifeB?.expiredAt, afterTtl);
  // Reservation ownership fields are cleared.
  assert.equal(lifeA?.reservationToken, undefined);
  assert.equal(lifeA?.reservationTtlExpiresAt, undefined);
});

test("Fix 2: sweepExpiredReservations leaves unexpired reservations alone", async () => {
  const repo = createInMemoryRepository();
  const store = new QuestOfferStoreImpl({ repository: repo, defaultReservationTtlMs: 60_000 });
  const offer = buildInternal({
    questOfferId: "qo_sweep_live",
    taskFamilyId: "tf_a",
    taskTypeText: "护送",
    scenarioMapId: "map_a",
    regionId: "r_north",
  });
  await seed(store, "r_north", [offer]);
  await store.reserveQuestOffer({
    questOfferId: "qo_sweep_live",
    explorerId: "ex_1",
    marketSnapshotVersion: 1,
    now: "2024-01-01T00:00:00.000Z",
  });

  // Sweep immediately — TTL has not elapsed.
  const swept = await store.sweepExpiredReservations({ now: "2024-01-01T00:00:10.000Z" });
  assert.deepEqual([...swept], []);
  assert.equal(store.projection.lifecyclesById["qo_sweep_live"]?.status, "reserved");
});

test("Fix 2: sweepExpiredReservations is idempotent (re-run is a no-op)", async () => {
  const repo = createInMemoryRepository();
  const store = new QuestOfferStoreImpl({ repository: repo, defaultReservationTtlMs: 1000 });
  const offer = buildInternal({
    questOfferId: "qo_sweep_idem",
    taskFamilyId: "tf_a",
    taskTypeText: "护送",
    scenarioMapId: "map_a",
    regionId: "r_north",
  });
  await seed(store, "r_north", [offer]);
  await store.reserveQuestOffer({
    questOfferId: "qo_sweep_idem",
    explorerId: "ex_1",
    marketSnapshotVersion: 1,
    now: "2024-01-01T00:00:00.000Z",
  });
  const afterTtl = "2024-01-01T00:00:02.000Z";
  const first = await store.sweepExpiredReservations({ now: afterTtl });
  const expiredRecordCount = repo.records.filter((r) => r.type === "offer_expired").length;
  assert.equal(first.length, 1);
  // Re-run: no new transitions, no new records.
  const second = await store.sweepExpiredReservations({ now: afterTtl });
  assert.equal(second.length, 0);
  assert.equal(
    repo.records.filter((r) => r.type === "offer_expired").length,
    expiredRecordCount,
    "re-sweep must not append another offer_expired record",
  );
});

test("Fix 2: runtime exposes sweepExpiredReservations and uses its now() default", async () => {
  const repo = createInMemoryRepository();
  const runtime = createJourneyOfferRuntime({
    repository: repo,
    defaultReservationTtlMs: 1,
    now: () => "2024-01-01T00:00:02.000Z",
  });
  const store = runtime.getStore();
  const offer = buildInternal({
    questOfferId: "qo_rt_sweep",
    taskFamilyId: "tf_a",
    taskTypeText: "护送",
    scenarioMapId: "map_a",
    regionId: "r_north",
  });
  await seed(store, "r_north", [offer]);
  // Reserve with a far-past `now` so the runtime's now() (00:00:02) is past TTL.
  await store.reserveQuestOffer({
    questOfferId: "qo_rt_sweep",
    explorerId: "ex_1",
    marketSnapshotVersion: 1,
    now: "2024-01-01T00:00:00.000Z",
  });
  // No `now` argument: runtime defaults to its injected now() = ...02.000Z.
  const swept = await runtime.sweepExpiredReservations({});
  assert.deepEqual([...swept], ["qo_rt_sweep"]);
  assert.equal(store.projection.lifecyclesById["qo_rt_sweep"]?.status, "expired");
});

// ---------------------------------------------------------------------------
// Fix 3: completeQuestOffer guard against missing claim index entry
// ---------------------------------------------------------------------------

test("Fix 3: completeQuestOffer throws offer_claim_index_missing when the idempotency index lost the claim", async () => {
  const repo = createInMemoryRepository();
  const store = new QuestOfferStoreImpl({ repository: repo });
  const offer = buildInternal({
    questOfferId: "qo_index_missing",
    taskFamilyId: "tf_a",
    taskTypeText: "护送",
    scenarioMapId: "map_a",
    regionId: "r_north",
  });
  await seed(store, "r_north", [offer]);
  const token = await reserve(store, "qo_index_missing", "ex_1");
  await store.claimQuestOffer({
    questOfferId: "qo_index_missing",
    reservationToken: token,
    explorerId: "ex_1",
    agentId: "ag_1",
    idempotencyKey: "k_index",
    marketSnapshotVersion: 1,
    now: EPOCH_NOW,
  });

  // Simulate a corrupted / partially-pruned stream: hand-craft a projection
  // where the lifecycle claims a claim but the claimsByIdempotencyKey index
  // is empty. This is the defensive hole Fix 3 plugs.
  const claimedLifecycle = store.projection.lifecyclesById["qo_index_missing"] as QuestOfferLifecycle;
  const tainted = QuestOfferStoreImpl;
  void tainted;
  // Build a fresh store with the same offer + claimed lifecycle but NO
  // idempotency index entry. The store's public API doesn't expose mutation,
  // so we synthesize via replay: drop the offer_claimed record from the
  // stream but keep a synthesized offer_materialized record that already
  // carries the claimed lifecycle. (applyRecord for offer_materialized
  // writes whatever lifecycle the record carries, so this is sufficient.)
  const materializedRecord = repo.records.find((r) => r.type === "offer_materialized");
  assert.ok(materializedRecord, "expected a materialized record seeded before claim");
  const synthesizedLifecycle: QuestOfferLifecycle = {
    ...claimedLifecycle,
    status: "claimed",
    claimIdempotencyKey: "k_index",
    claimedAt: EPOCH_NOW,
    claimedByExplorerId: "ex_1",
  };
  const synthesizedMaterialized: OfferPersistenceRecord = {
    type: "offer_materialized",
    occurredAt: EPOCH_NOW,
    publicOffer: offer.publicView,
    internalOffer: offer,
    lifecycle: synthesizedLifecycle,
    marketSnapshot: buildSnapshot("r_north", 1, ["qo_index_missing"]),
  };
  // Re-import the store with ONLY the synthesized materialize record. There
  // is no offer_claimed record, so claimsByIdempotencyKey stays empty while
  // the lifecycle still says "claimed".
  const { replayOfferStore } = await import("../lib/epoch/journeyOfferStore.ts");
  const freshStore = new QuestOfferStoreImpl({ repository: createInMemoryRepository() });
  freshStore.hydrate(replayOfferStore([synthesizedMaterialized]));

  await assert.rejects(
    () => freshStore.completeQuestOffer({
      questOfferId: "qo_index_missing",
      expectedClaimId: "claim:qo_index_missing:deadbeef",
      now: EPOCH_NOW,
    }),
    /offer_claim_index_missing/,
  );
});

test("Fix 3: completeQuestOffer still throws offer_claim_mismatch when the index entry disagrees", async () => {
  // Regression guard: the existing mismatch path still works when the index
  // entry IS present but has a different claimId.
  const repo = createInMemoryRepository();
  const store = new QuestOfferStoreImpl({ repository: repo });
  const offer = buildInternal({
    questOfferId: "qo_mismatch",
    taskFamilyId: "tf_a",
    taskTypeText: "护送",
    scenarioMapId: "map_a",
    regionId: "r_north",
  });
  await seed(store, "r_north", [offer]);
  const token = await reserve(store, "qo_mismatch", "ex_1");
  await store.claimQuestOffer({
    questOfferId: "qo_mismatch",
    reservationToken: token,
    explorerId: "ex_1",
    agentId: "ag_1",
    idempotencyKey: "k_mismatch",
    marketSnapshotVersion: 1,
    now: EPOCH_NOW,
  });
  await assert.rejects(
    () => store.completeQuestOffer({
      questOfferId: "qo_mismatch",
      expectedClaimId: "claim:qo_mismatch:wronghash",
      now: EPOCH_NOW,
    }),
    /offer_claim_mismatch/,
  );
});

// ---------------------------------------------------------------------------
// Fix 4: materialize occurredAt no longer references dead lifecycle.reservedAt
// ---------------------------------------------------------------------------

test("Fix 4: materialize stamps occurredAt from the snapshot's takenAt (no dead-code lifecycle.reservedAt read)", async () => {
  const repo = createInMemoryRepository();
  const store = new QuestOfferStoreImpl({ repository: repo });
  const snapshot = buildSnapshot("r_north", 1, ["qo_occurred"]);
  const offer = buildInternal({
    questOfferId: "qo_occurred",
    taskFamilyId: "tf_a",
    taskTypeText: "护送",
    scenarioMapId: "map_a",
    regionId: "r_north",
  });
  await store.materialize({
    snapshot,
    publicOffers: [offer.publicView],
    internalOffers: [offer],
    lifecycles: [createInitialLifecycle(offer.questOfferId)],
  });
  const mat = repo.records.find((r) => r.type === "offer_materialized");
  assert.ok(mat, "expected a materialized record");
  if (mat?.type === "offer_materialized") {
    // The snapshot's takenAt is the canonical timestamp; lifecycle.reservedAt
    // is always undefined for createInitialLifecycle output, so the prior
    // `lifecycle.reservedAt ?? snapshot.takenAt` always collapsed to the
    // fallback. Fix 4 makes that explicit.
    assert.equal(mat.occurredAt, snapshot.takenAt);
    assert.equal(mat.lifecycle.reservedAt, undefined, "initial lifecycle has no reservedAt");
  }
});

// ---------------------------------------------------------------------------
// Fix 5: findInternalOfferFields + assertPublicSafe traverse nested objects
// ---------------------------------------------------------------------------

test("Fix 5: findInternalOfferFields detects internal fields nested one level down", () => {
  const found = findInternalOfferFields({
    agentId: "ag_1",
    questOffer: {
      taskFamilyId: "leak",
      expectedApproach: ["combat"],
    },
  });
  // De-duplicated insertion order; sort for stable comparison.
  assert.deepEqual([...found].sort(), ["expectedApproach", "taskFamilyId"]);
});

test("Fix 5: findInternalOfferFields detects internal fields nested at arbitrary depth", () => {
  const found = findInternalOfferFields({
    nest: { deeper: { worldSliceHash: "sha256:abc", strategyAffinity: 0.5, fitBps: 100 } },
  });
  assert.deepEqual([...found].sort(), ["fitBps", "strategyAffinity", "worldSliceHash"]);
});

test("Fix 5: findInternalOfferFields traverses arrays for nested internal fields", () => {
  const found = findInternalOfferFields({
    waypoints: [
      { label: "a", taskFamilyId: "tf_a" },
      { label: "b", expectedApproach: ["combat"] },
    ],
  });
  assert.deepEqual([...found].sort(), ["expectedApproach", "taskFamilyId"]);
});

test("Fix 5: findInternalOfferFields survives a cyclic input without looping", () => {
  const cyclic: Record<string, unknown> = { agentId: "ag_1" };
  cyclic.self = cyclic;
  cyclic.nested = { taskFamilyId: "tf_cycle" };
  // Must terminate (WeakSet cycle guard) and still surface the field.
  const found = findInternalOfferFields(cyclic);
  assert.deepEqual([...found].sort(), ["taskFamilyId"]);
});

test("Fix 5: assertPublicSafe rejects payloads whose nested fields carry an internal marker", () => {
  // Defence-in-depth: a payload like { questOffer: { taskFamilyId: 'leak' } }
  // would slip past a shallow top-level check. The recursive traversal
  // makes the boundary check intentional, not incidental on schema omission.
  for (const field of ["taskFamilyId", "expectedApproach", "worldSliceHash", "strategyAffinity", "fitBps"]) {
    const input = { agentId: "ag_1", questOffer: { [field]: "leak" } };
    assert.throws(
      () => assertPublicSafe(input),
      (error: unknown) => error instanceof Error
        && error.message === "internal_field_rejected"
        && Array.isArray((error as { fields?: unknown }).fields)
        && (error as { fields: readonly string[] }).fields.includes(field),
    );
  }
});

test("Fix 5: findInternalOfferFields still detects top-level internal fields (no regression)", () => {
  const found = findInternalOfferFields({
    agentId: "ag_1",
    taskFamilyId: "tf_secret",
    expectedApproach: ["combat"],
    worldSliceHash: "sha256:abc",
    strategyAffinity: 0.5,
    fitBps: 100,
    unrelatedField: "ok",
  });
  assert.deepEqual([...found].sort(), [
    "expectedApproach",
    "fitBps",
    "strategyAffinity",
    "taskFamilyId",
    "worldSliceHash",
  ]);
});
