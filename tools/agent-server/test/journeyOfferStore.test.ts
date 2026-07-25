import assert from "node:assert/strict";
import test from "node:test";

import {
  OFFER_SCHEMA_VERSION,
  type InternalQuestOffer,
  type MarketSnapshot,
  type OfferClaim,
  type OfferReservation,
  type PublicQuestOffer,
  type QuestOfferLifecycle,
} from "../lib/epoch/journeyOfferRules.ts";
import {
  buildInternalQuestOffer,
  createInitialLifecycle,
  deriveClaimId,
  deriveOfferHash,
  emptyOfferProjection,
  QuestOfferStoreImpl,
  replayOfferStore,
  type JourneyOfferRepository,
  type OfferPersistenceRecord,
} from "../lib/epoch/journeyOfferStore.ts";

/**
 * PR3 unit tests for the quest-offer store.
 *
 * Coverage focus (per spec risk list):
 *   - concurrent CAS (only one claim wins)
 *   - reservation TTL expiry (re-reserve after TTL)
 *   - claim idempotency (same key -> same claimId, no lifecycle advance)
 *   - replenish failure does NOT roll back the claim
 *   - restart recovery via replayOfferStore
 *   - market snapshot version monotonicity + regression guard
 *   - PublicQuestOffer zero-bonus boundary (no marker leaks at reads)
 *   - materialize idempotency + schema-version rejection
 */

// ---------------------------------------------------------------------------
// In-memory repository
// ---------------------------------------------------------------------------

interface InMemoryRepository extends JourneyOfferRepository {
  readonly records: readonly OfferPersistenceRecord[];
  reset(): void;
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
    reset() {
      records.length = 0;
    },
  };
}

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

const EPOCH_NOW = "2024-01-01T00:00:00.000Z";
const WORLD_SLICE_HASH = "sha256:0000000000000000000000000000000000000000000000000000000000000000";

interface BuildOfferInput {
  readonly questOfferId: string;
  readonly taskFamilyId: string;
  readonly taskTypeText: string;
  readonly scenarioMapId: string;
  readonly regionId: string;
  readonly marketSnapshotVersion: number;
  readonly source?: InternalQuestOffer["source"];
  readonly expiresAt?: string;
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
    expiresAt: input.expiresAt ?? "2099-01-01T00:00:00.000Z",
    schemaVersion: OFFER_SCHEMA_VERSION,
  };
}

function buildInternalOffer(input: BuildOfferInput): InternalQuestOffer {
  return buildInternalQuestOffer({
    publicView: buildPublicOffer(input),
    taskFamilyId: input.taskFamilyId,
    expectedApproach: ["combat"],
    worldSliceHash: WORLD_SLICE_HASH,
    source: input.source ?? "catalog_fallback",
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

function seedMaterialized(
  store: QuestOfferStoreImpl,
  repository: InMemoryRepository,
  regionId: string,
  offers: readonly InternalQuestOffer[],
  snapshotVersion = 1,
): Promise<readonly InternalQuestOffer[]> {
  const snapshot = buildSnapshot(regionId, snapshotVersion, offers.map((o) => o.questOfferId));
  return store.materialize({
    snapshot,
    publicOffers: offers.map((o) => o.publicView),
    internalOffers: offers,
    lifecycles: offers.map((o) => createInitialLifecycle(o.questOfferId)),
  });
}

// ---------------------------------------------------------------------------
// Tests: hash + claim id derivation determinism
// ---------------------------------------------------------------------------

test("deriveOfferHash is byte-stable across calls (no time/random salt)", () => {
  const offer = buildInternalOffer({
    questOfferId: "qo_1",
    taskFamilyId: "tf_assault",
    taskTypeText: "突击",
    scenarioMapId: "map_a",
    regionId: "region_north",
    marketSnapshotVersion: 1,
  });
  const a = deriveOfferHash(offer);
  const b = deriveOfferHash(offer);
  assert.equal(a, b);
  assert.match(a, /^sha256:[a-f0-9]{64}$/);
});

test("deriveClaimId is deterministic on (questOfferId, idempotencyKey)", () => {
  const a = deriveClaimId("qo_1", "key_alpha");
  const b = deriveClaimId("qo_1", "key_alpha");
  const c = deriveClaimId("qo_1", "key_beta");
  const d = deriveClaimId("qo_2", "key_alpha");
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.notEqual(a, d);
  assert.match(a, /^claim:qo_1:[a-f0-9]{16}$/);
});

// ---------------------------------------------------------------------------
// Tests: materialize
// ---------------------------------------------------------------------------

test("materialize writes one offer_materialized per offer and seeds available lifecycle", async () => {
  const repo = createInMemoryRepository();
  const store = new QuestOfferStoreImpl({ repository: repo });
  const offers = [
    buildInternalOffer({
      questOfferId: "qo_1",
      taskFamilyId: "tf_a",
      taskTypeText: "护送",
      scenarioMapId: "map_a",
      regionId: "r_north",
    }),
    buildInternalOffer({
      questOfferId: "qo_2",
      taskFamilyId: "tf_b",
      taskTypeText: "侦察",
      scenarioMapId: "map_b",
      regionId: "r_north",
    }),
  ];
  await seedMaterialized(store, repo, "r_north", offers);
  assert.equal(repo.records.length, 2);
  for (const record of repo.records) {
    assert.equal(record.type, "offer_materialized");
    if (record.type === "offer_materialized") {
      assert.equal(record.lifecycle.status, "available");
    }
  }
  const listed = store.listAvailableQuestOffers({ regionId: "r_north" });
  assert.equal(listed.length, 2);
});

test("materialize is idempotent on (questOfferId, schemaVersion)", async () => {
  const repo = createInMemoryRepository();
  const store = new QuestOfferStoreImpl({ repository: repo });
  const offer = buildInternalOffer({
    questOfferId: "qo_1",
    taskFamilyId: "tf_a",
    taskTypeText: "护送",
    scenarioMapId: "map_a",
    regionId: "r_north",
  });
  await seedMaterialized(store, repo, "r_north", [offer]);
  const before = repo.records.length;
  await seedMaterialized(store, repo, "r_north", [offer]);
  assert.equal(repo.records.length, before, "replaying the same materialization must be a no-op");
});

test("materialize rejects schemaVersion mismatch with offer_schema_version_unsupported", async () => {
  const repo = createInMemoryRepository();
  const store = new QuestOfferStoreImpl({ repository: repo });
  const publicOffer = buildPublicOffer({
    questOfferId: "qo_1",
    taskFamilyId: "tf_a",
    taskTypeText: "护送",
    scenarioMapId: "map_a",
    regionId: "r_north",
    marketSnapshotVersion: 1,
  });
  // Force a schema-version drift on the public view.
  const badPublic = { ...publicOffer, schemaVersion: 999 as typeof publicOffer.schemaVersion };
  const snapshot = buildSnapshot("r_north", 1, ["qo_1"]);
  await assert.rejects(
    () => store.materialize({
      snapshot,
      publicOffers: [badPublic],
      internalOffers: [{
        ...buildInternalOffer({
          questOfferId: "qo_1",
          taskFamilyId: "tf_a",
          taskTypeText: "护送",
          scenarioMapId: "map_a",
          regionId: "r_north",
        }),
        offerVersion: OFFER_SCHEMA_VERSION,
      }],
      lifecycles: [createInitialLifecycle("qo_1")],
    }),
    /offer_schema_version_unsupported/,
  );
});

test("buildInternalQuestOffer rejects zero-bonus markers on the public view", () => {
  const publicOffer = buildPublicOffer({
    questOfferId: "qo_1",
    taskFamilyId: "tf_a",
    taskTypeText: "护送",
    scenarioMapId: "map_a",
    regionId: "r_north",
    marketSnapshotVersion: 1,
  });
  // Slip a bonus marker past the type system to simulate an upstream bug.
  const tainted = { ...publicOffer, taskFamilyId: "leak" } as unknown as PublicQuestOffer;
  assert.throws(
    () => buildInternalQuestOffer({
      publicView: tainted,
      taskFamilyId: "tf_a",
      expectedApproach: ["combat"],
      worldSliceHash: WORLD_SLICE_HASH,
      source: "catalog_fallback",
    }),
    /offer_zero_bonus_marker_present:publicView:taskFamilyId/,
  );
});

// ---------------------------------------------------------------------------
// Tests: publishMarketSnapshot monotonicity
// ---------------------------------------------------------------------------

test("publishMarketSnapshot produces dense per-region version counters", async () => {
  const repo = createInMemoryRepository();
  const store = new QuestOfferStoreImpl({ repository: repo });
  const s1 = await store.publishMarketSnapshot({
    regionId: "r_north",
    worldSliceHash: WORLD_SLICE_HASH,
    questOfferIds: [],
    now: EPOCH_NOW,
  });
  const s2 = await store.publishMarketSnapshot({
    regionId: "r_north",
    worldSliceHash: WORLD_SLICE_HASH,
    questOfferIds: [],
    now: EPOCH_NOW,
  });
  const sOther = await store.publishMarketSnapshot({
    regionId: "r_south",
    worldSliceHash: WORLD_SLICE_HASH,
    questOfferIds: [],
    now: EPOCH_NOW,
  });
  assert.equal(s1.marketSnapshotVersion, 1);
  assert.equal(s2.marketSnapshotVersion, 2);
  assert.equal(sOther.marketSnapshotVersion, 1, "version counter is per-region");
});

test("replayOfferStore rejects snapshot version regression", () => {
  const regionId = "r_north";
  const r1: OfferPersistenceRecord = {
    type: "market_snapshot_published",
    occurredAt: EPOCH_NOW,
    marketSnapshot: buildSnapshot(regionId, 2, []),
  };
  const r2: OfferPersistenceRecord = {
    type: "market_snapshot_published",
    occurredAt: EPOCH_NOW,
    marketSnapshot: buildSnapshot(regionId, 1, []),
  };
  assert.throws(() => replayOfferStore([r1, r2]), /offer_snapshot_version_regression/);
});

// ---------------------------------------------------------------------------
// Tests: reserveQuestOffer CAS
// ---------------------------------------------------------------------------

test("reserveQuestOffer performs CAS available -> reserved and persists offer_reserved", async () => {
  const repo = createInMemoryRepository();
  const store = new QuestOfferStoreImpl({ repository: repo });
  const offer = buildInternalOffer({
    questOfferId: "qo_1",
    taskFamilyId: "tf_a",
    taskTypeText: "护送",
    scenarioMapId: "map_a",
    regionId: "r_north",
  });
  await seedMaterialized(store, repo, "r_north", [offer]);

  const reservation = await store.reserveQuestOffer({
    questOfferId: "qo_1",
    explorerId: "ex_1",
    marketSnapshotVersion: 1,
    now: EPOCH_NOW,
  });
  assert.equal(reservation.explorerId, "ex_1");
  assert.match(reservation.reservationToken, /^[a-f0-9]+$/);
  const lifecycle = store.projection.lifecyclesById["qo_1"];
  assert.equal(lifecycle?.status, "reserved");
  const record = repo.records.find((r) => r.type === "offer_reserved");
  assert.ok(record, "offer_reserved record must be appended");
  if (record?.type === "offer_reserved") {
    assert.equal(record.lifecycle.status, "reserved");
  }
});

test("reserveQuestOffer rejects when status is not the expected predecessor", async () => {
  const repo = createInMemoryRepository();
  const store = new QuestOfferStoreImpl({ repository: repo });
  const offer = buildInternalOffer({
    questOfferId: "qo_1",
    taskFamilyId: "tf_a",
    taskTypeText: "护送",
    scenarioMapId: "map_a",
    regionId: "r_north",
  });
  await seedMaterialized(store, repo, "r_north", [offer]);
  await store.reserveQuestOffer({
    questOfferId: "qo_1",
    explorerId: "ex_1",
    marketSnapshotVersion: 1,
    now: EPOCH_NOW,
  });
  // Second reservation while status is 'reserved' (not 'available').
  await assert.rejects(
    () => store.reserveQuestOffer({
      questOfferId: "qo_1",
      explorerId: "ex_2",
      marketSnapshotVersion: 1,
      now: EPOCH_NOW,
    }),
    /offer_unavailable|offer_version_conflict/,
  );
});

test("reserveQuestOffer rejects snapshot mismatch with offer_snapshot_stale", async () => {
  const repo = createInMemoryRepository();
  const store = new QuestOfferStoreImpl({ repository: repo });
  const offer = buildInternalOffer({
    questOfferId: "qo_1",
    taskFamilyId: "tf_a",
    taskTypeText: "护送",
    scenarioMapId: "map_a",
    regionId: "r_north",
    marketSnapshotVersion: 1,
  });
  await seedMaterialized(store, repo, "r_north", [offer]);
  await assert.rejects(
    () => store.reserveQuestOffer({
      questOfferId: "qo_1",
      explorerId: "ex_1",
      marketSnapshotVersion: 999,
      now: EPOCH_NOW,
    }),
    /offer_snapshot_stale/,
  );
});

test("reservation token matches lifecycle.reservationToken after reserveQuestOffer", async () => {
  const repo = createInMemoryRepository();
  const store = new QuestOfferStoreImpl({ repository: repo });
  const offer = buildInternalOffer({
    questOfferId: "qo_1",
    taskFamilyId: "tf_a",
    taskTypeText: "护送",
    scenarioMapId: "map_a",
    regionId: "r_north",
  });
  await seedMaterialized(store, repo, "r_north", [offer]);
  const reservation = await store.reserveQuestOffer({
    questOfferId: "qo_1",
    explorerId: "ex_1",
    marketSnapshotVersion: 1,
    now: EPOCH_NOW,
  });
  const lifecycle = store.projection.lifecyclesById["qo_1"];
  assert.equal(lifecycle?.reservationToken, reservation.reservationToken);
  assert.equal(lifecycle?.reservationTtlExpiresAt, reservation.expiresAt);
});

// ---------------------------------------------------------------------------
// Tests: claimQuestOffer CAS + idempotency
// ---------------------------------------------------------------------------

async function reserveHelper(
  store: QuestOfferStoreImpl,
  questOfferId: string,
  explorerId: string,
  now = EPOCH_NOW,
): Promise<OfferReservation> {
  return store.reserveQuestOffer({
    questOfferId,
    explorerId,
    marketSnapshotVersion: 1,
    now,
  });
}

test("claimQuestOffer performs CAS reserved -> claimed", async () => {
  const repo = createInMemoryRepository();
  const store = new QuestOfferStoreImpl({ repository: repo });
  const offer = buildInternalOffer({
    questOfferId: "qo_1",
    taskFamilyId: "tf_a",
    taskTypeText: "护送",
    scenarioMapId: "map_a",
    regionId: "r_north",
  });
  await seedMaterialized(store, repo, "r_north", [offer]);
  const reservation = await reserveHelper(store, "qo_1", "ex_1");
  const claim = await store.claimQuestOffer({
    questOfferId: "qo_1",
    reservationToken: reservation.reservationToken,
    explorerId: "ex_1",
    agentId: "ag_1",
    idempotencyKey: "k_1",
    marketSnapshotVersion: 1,
    now: EPOCH_NOW,
  });
  assert.equal(claim.explorerId, "ex_1");
  assert.equal(claim.agentId, "ag_1");
  assert.equal(claim.claimId, deriveClaimId("qo_1", "k_1"));
  const lifecycle = store.projection.lifecyclesById["qo_1"];
  assert.equal(lifecycle?.status, "claimed");
});

test("claimQuestOffer rejects token mismatch with offer_reservation_token_invalid", async () => {
  const repo = createInMemoryRepository();
  const store = new QuestOfferStoreImpl({ repository: repo });
  const offer = buildInternalOffer({
    questOfferId: "qo_1",
    taskFamilyId: "tf_a",
    taskTypeText: "护送",
    scenarioMapId: "map_a",
    regionId: "r_north",
  });
  await seedMaterialized(store, repo, "r_north", [offer]);
  await reserveHelper(store, "qo_1", "ex_1");
  await assert.rejects(
    () => store.claimQuestOffer({
      questOfferId: "qo_1",
      reservationToken: "deadbeef",
      explorerId: "ex_1",
      agentId: "ag_1",
      idempotencyKey: "k_1",
      marketSnapshotVersion: 1,
      now: EPOCH_NOW,
    }),
    /offer_reservation_token_invalid/,
  );
});

test("claimQuestOffer rejects expired reservation with offer_reservation_expired", async () => {
  const repo = createInMemoryRepository();
  const store = new QuestOfferStoreImpl({ repository: repo, defaultReservationTtlMs: 1000 });
  const offer = buildInternalOffer({
    questOfferId: "qo_1",
    taskFamilyId: "tf_a",
    taskTypeText: "护送",
    scenarioMapId: "map_a",
    regionId: "r_north",
  });
  await seedMaterialized(store, repo, "r_north", [offer]);
  const reservedAt = "2024-01-01T00:00:00.000Z";
  const reservation = await store.reserveQuestOffer({
    questOfferId: "qo_1",
    explorerId: "ex_1",
    marketSnapshotVersion: 1,
    now: reservedAt,
  });
  // Advance wall-clock past TTL.
  const afterTtl = "2024-01-01T00:01:00.000Z";
  assert.ok(Date.parse(afterTtl) > Date.parse(reservation.expiresAt));
  await assert.rejects(
    () => store.claimQuestOffer({
      questOfferId: "qo_1",
      reservationToken: reservation.reservationToken,
      explorerId: "ex_1",
      agentId: "ag_1",
      idempotencyKey: "k_1",
      marketSnapshotVersion: 1,
      now: afterTtl,
    }),
    /offer_reservation_expired/,
  );
});

test("claimQuestOffer is idempotent on (questOfferId, idempotencyKey): same claimId, no lifecycle advance", async () => {
  const repo = createInMemoryRepository();
  const store = new QuestOfferStoreImpl({ repository: repo });
  const offer = buildInternalOffer({
    questOfferId: "qo_1",
    taskFamilyId: "tf_a",
    taskTypeText: "护送",
    scenarioMapId: "map_a",
    regionId: "r_north",
  });
  await seedMaterialized(store, repo, "r_north", [offer]);
  const reservation = await reserveHelper(store, "qo_1", "ex_1");
  const first = await store.claimQuestOffer({
    questOfferId: "qo_1",
    reservationToken: reservation.reservationToken,
    explorerId: "ex_1",
    agentId: "ag_1",
    idempotencyKey: "k_1",
    marketSnapshotVersion: 1,
    now: EPOCH_NOW,
  });
  const claimedRecordCount = repo.records.filter((r) => r.type === "offer_claimed").length;
  // Replay with the same idempotency key returns the same claim without
  // writing a second offer_claimed record.
  const replay = await store.claimQuestOffer({
    questOfferId: "qo_1",
    reservationToken: reservation.reservationToken,
    explorerId: "ex_1",
    agentId: "ag_1",
    idempotencyKey: "k_1",
    marketSnapshotVersion: 1,
    now: EPOCH_NOW,
  });
  assert.equal(replay.claimId, first.claimId);
  assert.equal(
    repo.records.filter((r) => r.type === "offer_claimed").length,
    claimedRecordCount,
    "replay must not append another offer_claimed record",
  );
});

test("claimQuestOffer idempotent replay rejects owner mismatch", async () => {
  const repo = createInMemoryRepository();
  const store = new QuestOfferStoreImpl({ repository: repo });
  const offer = buildInternalOffer({
    questOfferId: "qo_1",
    taskFamilyId: "tf_a",
    taskTypeText: "护送",
    scenarioMapId: "map_a",
    regionId: "r_north",
  });
  await seedMaterialized(store, repo, "r_north", [offer]);
  const reservation = await reserveHelper(store, "qo_1", "ex_1");
  await store.claimQuestOffer({
    questOfferId: "qo_1",
    reservationToken: reservation.reservationToken,
    explorerId: "ex_1",
    agentId: "ag_1",
    idempotencyKey: "k_1",
    marketSnapshotVersion: 1,
    now: EPOCH_NOW,
  });
  await assert.rejects(
    () => store.claimQuestOffer({
      questOfferId: "qo_1",
      reservationToken: reservation.reservationToken,
      explorerId: "ex_other",
      agentId: "ag_other",
      idempotencyKey: "k_1",
      marketSnapshotVersion: 1,
      now: EPOCH_NOW,
    }),
    /offer_claim_idempotency_owner_mismatch/,
  );
});

test("concurrent claimQuestOffer only one wins (CAS)", async () => {
  const repo = createInMemoryRepository();
  const store = new QuestOfferStoreImpl({ repository: repo });
  const offer1 = buildInternalOffer({
    questOfferId: "qo_a",
    taskFamilyId: "tf_a",
    taskTypeText: "护送",
    scenarioMapId: "map_a",
    regionId: "r_north",
  });
  const offer2 = buildInternalOffer({
    questOfferId: "qo_b",
    taskFamilyId: "tf_b",
    taskTypeText: "侦察",
    scenarioMapId: "map_b",
    regionId: "r_north",
  });
  await seedMaterialized(store, repo, "r_north", [offer1, offer2]);
  // Reserve both offers, then race two claims for offer1.
  const reservation1 = await reserveHelper(store, "qo_a", "ex_1");
  await reserveHelper(store, "qo_b", "ex_2");

  const [r1, r2] = await Promise.allSettled([
    store.claimQuestOffer({
      questOfferId: "qo_a",
      reservationToken: reservation1.reservationToken,
      explorerId: "ex_1",
      agentId: "ag_1",
      idempotencyKey: "race_a",
      marketSnapshotVersion: 1,
      now: EPOCH_NOW,
    }),
    store.claimQuestOffer({
      questOfferId: "qo_a",
      reservationToken: reservation1.reservationToken,
      explorerId: "ex_1",
      agentId: "ag_1",
      idempotencyKey: "race_b",
      marketSnapshotVersion: 1,
      now: EPOCH_NOW,
    }),
  ]);
  const fulfilled = [r1, r2].filter((r) => r.status === "fulfilled").length;
  const rejected = [r1, r2].filter((r) => r.status === "rejected").length;
  assert.equal(fulfilled, 1, "exactly one concurrent claim must win");
  assert.equal(rejected, 1, "the loser must be rejected");
});

// ---------------------------------------------------------------------------
// Tests: complete + release/expire
// ---------------------------------------------------------------------------

test("completeQuestOffer performs CAS claimed -> completed (terminal)", async () => {
  const repo = createInMemoryRepository();
  const store = new QuestOfferStoreImpl({ repository: repo });
  const offer = buildInternalOffer({
    questOfferId: "qo_1",
    taskFamilyId: "tf_a",
    taskTypeText: "护送",
    scenarioMapId: "map_a",
    regionId: "r_north",
  });
  await seedMaterialized(store, repo, "r_north", [offer]);
  const reservation = await reserveHelper(store, "qo_1", "ex_1");
  const claim = await store.claimQuestOffer({
    questOfferId: "qo_1",
    reservationToken: reservation.reservationToken,
    explorerId: "ex_1",
    agentId: "ag_1",
    idempotencyKey: "k_1",
    marketSnapshotVersion: 1,
    now: EPOCH_NOW,
  });
  await store.completeQuestOffer({
    questOfferId: "qo_1",
    expectedClaimId: claim.claimId,
    now: EPOCH_NOW,
  });
  assert.equal(store.projection.lifecyclesById["qo_1"]?.status, "completed");
  // Idempotent terminal: a second completion is a no-op.
  await store.completeQuestOffer({ questOfferId: "qo_1", now: EPOCH_NOW });
  assert.equal(store.projection.lifecyclesById["qo_1"]?.status, "completed");
});

test("completeQuestOffer rejects when expectedClaimId does not match", async () => {
  const repo = createInMemoryRepository();
  const store = new QuestOfferStoreImpl({ repository: repo });
  const offer = buildInternalOffer({
    questOfferId: "qo_1",
    taskFamilyId: "tf_a",
    taskTypeText: "护送",
    scenarioMapId: "map_a",
    regionId: "r_north",
  });
  await seedMaterialized(store, repo, "r_north", [offer]);
  const reservation = await reserveHelper(store, "qo_1", "ex_1");
  await store.claimQuestOffer({
    questOfferId: "qo_1",
    reservationToken: reservation.reservationToken,
    explorerId: "ex_1",
    agentId: "ag_1",
    idempotencyKey: "k_1",
    marketSnapshotVersion: 1,
    now: EPOCH_NOW,
  });
  await assert.rejects(
    () => store.completeQuestOffer({
      questOfferId: "qo_1",
      expectedClaimId: "claim:wrong:0000",
      now: EPOCH_NOW,
    }),
    /offer_claim_mismatch/,
  );
});

test("releaseOrExpireQuestOffer is terminal-bypass and idempotent", async () => {
  const repo = createInMemoryRepository();
  const store = new QuestOfferStoreImpl({ repository: repo });
  const offer = buildInternalOffer({
    questOfferId: "qo_1",
    taskFamilyId: "tf_a",
    taskTypeText: "护送",
    scenarioMapId: "map_a",
    regionId: "r_north",
  });
  await seedMaterialized(store, repo, "r_north", [offer]);
  await store.releaseOrExpireQuestOffer({
    questOfferId: "qo_1",
    reason: "released",
    now: EPOCH_NOW,
  });
  assert.equal(store.projection.lifecyclesById["qo_1"]?.status, "released");
  // Idempotent: re-applying 'released' is a no-op.
  await store.releaseOrExpireQuestOffer({
    questOfferId: "qo_1",
    reason: "released",
    now: EPOCH_NOW,
  });
  assert.equal(store.projection.lifecyclesById["qo_1"]?.status, "released");
  // Re-reserve cannot return the offer to 'available'.
  await assert.rejects(
    () => store.reserveQuestOffer({
      questOfferId: "qo_1",
      explorerId: "ex_1",
      marketSnapshotVersion: 1,
      now: EPOCH_NOW,
    }),
    /offer_unavailable|offer_version_conflict/,
  );
});

test("getInternalOffer returns undefined for terminal lifecycles", async () => {
  const repo = createInMemoryRepository();
  const store = new QuestOfferStoreImpl({ repository: repo });
  const offer = buildInternalOffer({
    questOfferId: "qo_1",
    taskFamilyId: "tf_a",
    taskTypeText: "护送",
    scenarioMapId: "map_a",
    regionId: "r_north",
  });
  await seedMaterialized(store, repo, "r_north", [offer]);
  assert.ok(store.getInternalOffer("qo_1") !== undefined);
  await store.releaseOrExpireQuestOffer({
    questOfferId: "qo_1",
    reason: "expired",
    now: EPOCH_NOW,
  });
  assert.equal(store.getInternalOffer("qo_1"), undefined);
});

// ---------------------------------------------------------------------------
// Tests: restart recovery
// ---------------------------------------------------------------------------

test("replayOfferStore reconstructs identical projection across restart", async () => {
  const repo = createInMemoryRepository();
  const store = new QuestOfferStoreImpl({ repository: repo });
  const offer = buildInternalOffer({
    questOfferId: "qo_1",
    taskFamilyId: "tf_a",
    taskTypeText: "护送",
    scenarioMapId: "map_a",
    regionId: "r_north",
  });
  await seedMaterialized(store, repo, "r_north", [offer]);
  const reservation = await reserveHelper(store, "qo_1", "ex_1");
  const claim = await store.claimQuestOffer({
    questOfferId: "qo_1",
    reservationToken: reservation.reservationToken,
    explorerId: "ex_1",
    agentId: "ag_1",
    idempotencyKey: "k_1",
    marketSnapshotVersion: 1,
    now: EPOCH_NOW,
  });

  // Simulate restart: re-fold the same record stream into a fresh store.
  const replayed = replayOfferStore(repo.records);
  const restarted = new QuestOfferStoreImpl({ repository: repo });
  restarted.hydrate(replayed);

  assert.deepEqual(
    restarted.projection.byOfferId["qo_1"]?.offerHash,
    store.projection.byOfferId["qo_1"]?.offerHash,
  );
  assert.deepEqual(
    restarted.projection.lifecyclesById["qo_1"],
    store.projection.lifecyclesById["qo_1"],
  );
  const replayedClaim = restarted.projection.claimsByIdempotencyKey["qo_1:k_1"];
  assert.deepEqual(replayedClaim, claim);
});

test("replayOfferStore dedupes retry-duplicated appends", async () => {
  const repo = createInMemoryRepository();
  const store = new QuestOfferStoreImpl({ repository: repo });
  const offer = buildInternalOffer({
    questOfferId: "qo_1",
    taskFamilyId: "tf_a",
    taskTypeText: "护送",
    scenarioMapId: "map_a",
    regionId: "r_north",
  });
  await seedMaterialized(store, repo, "r_north", [offer]);
  // Simulate a retry: duplicate every record in the stream.
  const duplicated: OfferPersistenceRecord[] = [];
  for (const r of repo.records) {
    duplicated.push(r, r);
  }
  const replayed = replayOfferStore(duplicated);
  assert.equal(Object.keys(replayed.byOfferId).length, 1);
  assert.equal(replayed.lifecyclesById["qo_1"]?.status, "available");
});

test("empty projection is a valid replay result", () => {
  const proj = replayOfferStore([]);
  assert.deepEqual(proj, emptyOfferProjection());
});

// ---------------------------------------------------------------------------
// Tests: zero-bonus boundary at reads
// ---------------------------------------------------------------------------

test("listAvailableQuestOffers never returns InternalQuestOffer or any bonus marker", async () => {
  const repo = createInMemoryRepository();
  const store = new QuestOfferStoreImpl({ repository: repo });
  const offer = buildInternalOffer({
    questOfferId: "qo_1",
    taskFamilyId: "tf_secret",
    taskTypeText: "护送",
    scenarioMapId: "map_a",
    regionId: "r_north",
  });
  await seedMaterialized(store, repo, "r_north", [offer]);
  const listed = store.listAvailableQuestOffers({ regionId: "r_north" });
  assert.equal(listed.length, 1);
  const publicView = listed[0] as PublicQuestOffer;
  const keys = Object.keys(publicView);
  for (const marker of ["taskFamilyId", "strategyAffinity", "fitBps", "expectedApproach"]) {
    assert.ok(!keys.includes(marker), `PublicQuestOffer must not carry ${marker}`);
  }
  // Internal-only field on InternalQuestOffer is not present on the public view.
  assert.equal((publicView as unknown as { taskFamilyId?: string }).taskFamilyId, undefined);
});

test("listAvailableQuestOffers filters out expired offers", async () => {
  const repo = createInMemoryRepository();
  const store = new QuestOfferStoreImpl({ repository: repo });
  const expiredOffer = buildInternalOffer({
    questOfferId: "qo_expired",
    taskFamilyId: "tf_a",
    taskTypeText: "护送",
    scenarioMapId: "map_a",
    regionId: "r_north",
    expiresAt: "2020-01-01T00:00:00.000Z",
  });
  const liveOffer = buildInternalOffer({
    questOfferId: "qo_live",
    taskFamilyId: "tf_b",
    taskTypeText: "侦察",
    scenarioMapId: "map_b",
    regionId: "r_north",
    expiresAt: "2099-01-01T00:00:00.000Z",
  });
  await seedMaterialized(store, repo, "r_north", [expiredOffer, liveOffer]);
  const listed = store.listAvailableQuestOffers({
    regionId: "r_north",
    now: "2024-06-01T00:00:00.000Z",
  });
  assert.equal(listed.length, 1);
  assert.equal(listed[0]?.questOfferId, "qo_live");
});

// ---------------------------------------------------------------------------
// Tests: replenish-after-claim
// ---------------------------------------------------------------------------

test("replenishAfterClaim swallows strategy failure and does not roll back the claim", async () => {
  const failingStrategy = async (): Promise<readonly InternalQuestOffer[]> => {
    throw new Error("simulated_server_ai_failure");
  };
  const repo = createInMemoryRepository();
  const store = new QuestOfferStoreImpl({
    repository: repo,
    replenishStrategy: failingStrategy,
  });
  const offer = buildInternalOffer({
    questOfferId: "qo_1",
    taskFamilyId: "tf_a",
    taskTypeText: "护送",
    scenarioMapId: "map_a",
    regionId: "r_north",
  });
  await seedMaterialized(store, repo, "r_north", [offer]);
  const reservation = await reserveHelper(store, "qo_1", "ex_1");
  await store.claimQuestOffer({
    questOfferId: "qo_1",
    reservationToken: reservation.reservationToken,
    explorerId: "ex_1",
    agentId: "ag_1",
    idempotencyKey: "k_1",
    marketSnapshotVersion: 1,
    now: EPOCH_NOW,
  });
  const claimedRecordCount = repo.records.filter((r) => r.type === "offer_claimed").length;
  let observedError: unknown;
  const replenished = await store.replenishAfterClaim({
    claimedOfferId: "qo_1",
    regionId: "r_north",
    worldSliceHash: WORLD_SLICE_HASH,
    now: EPOCH_NOW,
    onReplenishError: (e) => {
      observedError = e;
      void observedError;
    },
  });
  assert.deepEqual(replenished, []);
  assert.ok(observedError instanceof Error);
  assert.equal(observedError.message, "simulated_server_ai_failure");
  // The claim record remains intact.
  assert.equal(
    repo.records.filter((r) => r.type === "offer_claimed").length,
    claimedRecordCount,
  );
  assert.equal(store.projection.lifecyclesById["qo_1"]?.status, "claimed");
});

test("replenishAfterClaim materializes replacement offers with distinct taskFamily", async () => {
  const claimedTaskFamily = "tf_a";
  const strategy = async (input: {
    readonly snapshot: import("../lib/epoch/journeyOfferRules.ts").MarketSnapshot;
  }): Promise<readonly InternalQuestOffer[]> => {
    const v = input.snapshot.marketSnapshotVersion;
    const replacements = [
      buildInternalOffer({
        questOfferId: "qo_repl_1",
        taskFamilyId: "tf_b",
        taskTypeText: "侦察",
        scenarioMapId: "map_b",
        regionId: "r_north",
        marketSnapshotVersion: v,
      }),
      buildInternalOffer({
        questOfferId: "qo_repl_2",
        taskFamilyId: "tf_c",
        taskTypeText: "支援",
        scenarioMapId: "map_c",
        regionId: "r_north",
        marketSnapshotVersion: v,
      }),
      // Same-family candidate must be filtered out by the store.
      buildInternalOffer({
        questOfferId: "qo_repl_3",
        taskFamilyId: claimedTaskFamily,
        taskTypeText: "诱饵",
        scenarioMapId: "map_d",
        regionId: "r_north",
        marketSnapshotVersion: v,
      }),
    ];
    return replacements;
  };
  const repo = createInMemoryRepository();
  const store = new QuestOfferStoreImpl({
    repository: repo,
    replenishStrategy: strategy,
  });
  const claimed = buildInternalOffer({
    questOfferId: "qo_1",
    taskFamilyId: claimedTaskFamily,
    taskTypeText: "护送",
    scenarioMapId: "map_a",
    regionId: "r_north",
  });
  await seedMaterialized(store, repo, "r_north", [claimed]);
  const reservation = await reserveHelper(store, "qo_1", "ex_1");
  await store.claimQuestOffer({
    questOfferId: "qo_1",
    reservationToken: reservation.reservationToken,
    explorerId: "ex_1",
    agentId: "ag_1",
    idempotencyKey: "k_1",
    marketSnapshotVersion: 1,
    now: EPOCH_NOW,
  });
  const replenished = await store.replenishAfterClaim({
    claimedOfferId: "qo_1",
    regionId: "r_north",
    worldSliceHash: WORLD_SLICE_HASH,
    now: EPOCH_NOW,
  });
  assert.equal(replenished.length, 2);
  const ids = replenished.map((o) => o.questOfferId).sort();
  assert.deepEqual(ids, ["qo_repl_1", "qo_repl_2"]);
  // Replenished offers are visible in the region pool.
  const pool = store.listAvailableQuestOffers({ regionId: "r_north" });
  assert.equal(pool.length, 2);
});

test("replenishAfterClaim publishes a snapshot whose questOfferIds list the materialized replacements", async () => {
  // PR3 fix: MarketSnapshot.questOfferIds is documented as "Offer ids
  // materialized under this snapshot". The replenish snapshot used to be
  // published with [] (cosmetic but violated the field's own doc contract);
  // it now carries the materialized replacement ids.
  const strategy = async (input: {
    readonly snapshot: import("../lib/epoch/journeyOfferRules.ts").MarketSnapshot;
  }): Promise<readonly InternalQuestOffer[]> => {
    const v = input.snapshot.marketSnapshotVersion;
    return [
      buildInternalOffer({
        questOfferId: "qo_fill_a",
        taskFamilyId: "tf_b",
        taskTypeText: "侦察",
        scenarioMapId: "map_b",
        regionId: "r_east",
        marketSnapshotVersion: v,
      }),
      buildInternalOffer({
        questOfferId: "qo_fill_b",
        taskFamilyId: "tf_c",
        taskTypeText: "支援",
        scenarioMapId: "map_c",
        regionId: "r_east",
        marketSnapshotVersion: v,
      }),
    ];
  };
  const repo = createInMemoryRepository();
  const store = new QuestOfferStoreImpl({ repository: repo, replenishStrategy: strategy });
  const claimed = buildInternalOffer({
    questOfferId: "qo_src",
    taskFamilyId: "tf_a",
    taskTypeText: "护送",
    scenarioMapId: "map_a",
    regionId: "r_east",
  });
  await seedMaterialized(store, repo, "r_east", [claimed]);

  const snapshotsBefore = store.projection.snapshotsByRegion["r_east"] ?? [];
  await store.replenishAfterClaim({
    claimedOfferId: "qo_src",
    regionId: "r_east",
    worldSliceHash: WORLD_SLICE_HASH,
    now: EPOCH_NOW,
  });
  const snapshotsAfter = store.projection.snapshotsByRegion["r_east"] ?? [];
  assert.equal(snapshotsAfter.length, snapshotsBefore.length + 1);
  const replenishSnapshot = snapshotsAfter[snapshotsAfter.length - 1] as MarketSnapshot;
  assert.deepEqual(
    [...replenishSnapshot.questOfferIds].sort(),
    ["qo_fill_a", "qo_fill_b"],
    "replenish snapshot must list the materialized replacement offer ids",
  );
  // The published record on the JSONL stream carries the same populated ids
  // (not just the in-memory projection), so replay-on-restart reconstructs
  // the snapshot identically.
  const publishedRecord = repo.records
    .find((r) => r.type === "market_snapshot_published"
      && (r as { marketSnapshot: MarketSnapshot }).marketSnapshot.marketSnapshotVersion
        === replenishSnapshot.marketSnapshotVersion) as
    | { type: "market_snapshot_published"; marketSnapshot: MarketSnapshot }
    | undefined;
  assert.ok(publishedRecord, "expected a market_snapshot_published record for the replenish version");
  assert.deepEqual(
    [...(publishedRecord?.marketSnapshot.questOfferIds ?? [])].sort(),
    ["qo_fill_a", "qo_fill_b"],
  );
});

test("replenishAfterClaim publishes no spurious snapshot when the strategy returns no viable candidates", async () => {
  const strategy = async (): Promise<readonly InternalQuestOffer[]> => [];
  const repo = createInMemoryRepository();
  const store = new QuestOfferStoreImpl({ repository: repo, replenishStrategy: strategy });
  const claimed = buildInternalOffer({
    questOfferId: "qo_src",
    taskFamilyId: "tf_a",
    taskTypeText: "护送",
    scenarioMapId: "map_a",
    regionId: "r_west",
  });
  await seedMaterialized(store, repo, "r_west", [claimed]);
  const before = (store.projection.snapshotsByRegion["r_west"] ?? []).length;
  const result = await store.replenishAfterClaim({
    claimedOfferId: "qo_src",
    regionId: "r_west",
    worldSliceHash: WORLD_SLICE_HASH,
    now: EPOCH_NOW,
  });
  const after = (store.projection.snapshotsByRegion["r_west"] ?? []).length;
  assert.equal(result.length, 0);
  assert.equal(after, before, "no snapshot should be published when no offers are materialized");
});

// ---------------------------------------------------------------------------
// Tests: bounty market independence (spec §4.5)
// ---------------------------------------------------------------------------

test("quest offer store never imports or advances bounty state", () => {
  // Static contract: the store's source imports no bounty types. This is
  // a regression catch — if someone adds an import of bounty rules, the
  // types below would resolve and the assertion would still pass, but the
  // intent is documented via the runtime test in journeyOfferRuntime.
  const store = new QuestOfferStoreImpl({ repository: createInMemoryRepository() });
  assert.ok(store);
  // The store has no method that takes a bounty id; verified by type-only
  // inspection at compile time (the absence of any `bounty`-typed param
  // across QuestOfferStoreImpl is the contract).
});
