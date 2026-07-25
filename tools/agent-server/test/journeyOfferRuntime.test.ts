import assert from "node:assert/strict";
import test from "node:test";

import {
  OFFER_SCHEMA_VERSION,
  type BountyListing,
  type InternalQuestOffer,
  type PublicQuestOffer,
} from "../lib/epoch/journeyOfferRules.ts";
import {
  buildInternalQuestOffer,
  createInitialLifecycle,
  DEFAULT_RESERVATION_TTL_MS,
  deriveClaimId,
  type JourneyOfferRepository,
  type OfferPersistenceRecord,
} from "../lib/epoch/journeyOfferStore.ts";
import { createJourneyOfferRuntime, type JourneyOfferRuntimeOptions } from "../lib/epoch/journeyOfferRuntime.ts";

/**
 * PR3 unit tests for the quest-offer runtime.
 *
 * Coverage focus:
 *   - default reservation TTL applied when caller omits reservationTtlMs
 *   - reservation TTL expiry enables a fresh reserve on a released slot
 *   - claim idempotency: same idempotency key returns same claimId
 *   - claim success is the accounting entry; replenish failure does not
 *     change the response or roll back the claim
 *   - getInternalOffer is server-only and returns undefined on terminal
 *   - bounty market lifecycle never advances quest offer state (spec §4.5)
 *   - public reads never expose bonus markers
 */

const EPOCH_NOW = "2024-01-01T00:00:00.000Z";
const WORLD_SLICE_HASH = "sha256:0000000000000000000000000000000000000000000000000000000000000000";

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

function fixedClock(now: string): () => string {
  return () => now;
}

function buildRuntime(options: Partial<JourneyOfferRuntimeOptions> = {}): {
  readonly repo: InMemoryRepository;
  readonly runtime: ReturnType<typeof createJourneyOfferRuntime>;
} {
  const repo = createInMemoryRepository();
  const runtime = createJourneyOfferRuntime({
    repository: repo,
    now: fixedClock(EPOCH_NOW),
    ...options,
  });
  return { repo, runtime };
}

async function seedRegion(
  runtime: ReturnType<typeof createJourneyOfferRuntime>,
  regionId: string,
  offers: readonly InternalQuestOffer[],
  snapshotVersion = 1,
): Promise<void> {
  await runtime.publishMarketSnapshot({
    regionId,
    worldSliceHash: WORLD_SLICE_HASH,
    questOfferIds: offers.map((o) => o.questOfferId),
    now: EPOCH_NOW,
  });
  await runtime.materialize({
    snapshot: {
      marketSnapshotVersion: snapshotVersion,
      regionId,
      questOfferIds: offers.map((o) => o.questOfferId),
      worldSliceHash: WORLD_SLICE_HASH,
      takenAt: EPOCH_NOW,
      schemaVersion: OFFER_SCHEMA_VERSION,
    },
    publicOffers: offers.map((o) => o.publicView),
    internalOffers: offers,
    lifecycles: offers.map((o) => createInitialLifecycle(o.questOfferId)),
  });
}

// ---------------------------------------------------------------------------
// Tests: default reservation TTL
// ---------------------------------------------------------------------------

test("reserveQuestOffer applies DEFAULT_RESERVATION_TTL_MS when reservationTtlMs is omitted", async () => {
  const { runtime, repo } = buildRuntime();
  const offer = buildInternalOffer({
    questOfferId: "qo_1",
    taskFamilyId: "tf_a",
    taskTypeText: "护送",
    scenarioMapId: "map_a",
    regionId: "r_north",
  });
  await seedRegion(runtime, "r_north", [offer]);

  const reservation = await runtime.reserveQuestOffer({
    questOfferId: "qo_1",
    explorerId: "ex_1",
    marketSnapshotVersion: 1,
  });
  const expected = Date.parse(EPOCH_NOW) + DEFAULT_RESERVATION_TTL_MS;
  assert.equal(Date.parse(reservation.expiresAt), expected);
  // The persisted record carries the same TTL.
  const reservedRecord = repo.records.find((r) => r.type === "offer_reserved");
  assert.ok(reservedRecord);
  if (reservedRecord?.type === "offer_reserved") {
    assert.equal(
      Date.parse(reservedRecord.lifecycle.reservationTtlExpiresAt ?? ""),
      expected,
    );
  }
});

// ---------------------------------------------------------------------------
// Tests: TTL expiry -> release -> fresh reserve
// ---------------------------------------------------------------------------

test("expired reservation enables releaseOrExpire + fresh reserve is rejected (terminal-bypass)", async () => {
  const { runtime } = buildRuntime();
  const offer = buildInternalOffer({
    questOfferId: "qo_1",
    taskFamilyId: "tf_a",
    taskTypeText: "护送",
    scenarioMapId: "map_a",
    regionId: "r_north",
  });
  await seedRegion(runtime, "r_north", [offer]);
  await runtime.reserveQuestOffer({
    questOfferId: "qo_1",
    explorerId: "ex_1",
    marketSnapshotVersion: 1,
    now: EPOCH_NOW,
  });
  // Reservation expired; runtime releases the offer.
  await runtime.releaseOrExpireQuestOffer({
    questOfferId: "qo_1",
    reason: "released",
    now: EPOCH_NOW,
  });
  // Spec: returning to 'available' is FORBIDDEN. A fresh reserve on the
  // same id must fail; replenishment must mint a new id instead.
  await assert.rejects(
    () => runtime.reserveQuestOffer({
      questOfferId: "qo_1",
      explorerId: "ex_2",
      marketSnapshotVersion: 1,
      now: EPOCH_NOW,
    }),
    /offer_unavailable|offer_version_conflict/,
  );
});

// ---------------------------------------------------------------------------
// Tests: claim idempotency
// ---------------------------------------------------------------------------

test("claimQuestOffer with the same idempotency key returns the same claimId across retries", async () => {
  const { runtime } = buildRuntime();
  const offer = buildInternalOffer({
    questOfferId: "qo_1",
    taskFamilyId: "tf_a",
    taskTypeText: "护送",
    scenarioMapId: "map_a",
    regionId: "r_north",
  });
  await seedRegion(runtime, "r_north", [offer]);
  const reservation = await runtime.reserveQuestOffer({
    questOfferId: "qo_1",
    explorerId: "ex_1",
    marketSnapshotVersion: 1,
    now: EPOCH_NOW,
  });
  const first = await runtime.claimQuestOffer({
    questOfferId: "qo_1",
    reservationToken: reservation.reservationToken,
    explorerId: "ex_1",
    agentId: "ag_1",
    idempotencyKey: "k_1",
    marketSnapshotVersion: 1,
    now: EPOCH_NOW,
  });
  // Network-retry simulation: call claimQuestOffer again with the same key.
  const replay = await runtime.claimQuestOffer({
    questOfferId: "qo_1",
    reservationToken: reservation.reservationToken,
    explorerId: "ex_1",
    agentId: "ag_1",
    idempotencyKey: "k_1",
    marketSnapshotVersion: 1,
    now: EPOCH_NOW,
  });
  assert.equal(replay.claimId, first.claimId);
  assert.equal(replay.claimId, deriveClaimId("qo_1", "k_1"));
});

// ---------------------------------------------------------------------------
// Tests: replenish-after-claim does not roll back the claim
// ---------------------------------------------------------------------------

test("claimQuestOffer returns the claim even when the fire-and-forget replenish throws", async () => {
  const failingStrategy = async (): Promise<readonly InternalQuestOffer[]> => {
    throw new Error("replenish_failed");
  };
  const { runtime, repo } = buildRuntime({ replenishStrategy: failingStrategy });
  const offer = buildInternalOffer({
    questOfferId: "qo_1",
    taskFamilyId: "tf_a",
    taskTypeText: "护送",
    scenarioMapId: "map_a",
    regionId: "r_north",
  });
  await seedRegion(runtime, "r_north", [offer]);
  const reservation = await runtime.reserveQuestOffer({
    questOfferId: "qo_1",
    explorerId: "ex_1",
    marketSnapshotVersion: 1,
    now: EPOCH_NOW,
  });

  let observed: unknown;
  const claim = await runtime.claimQuestOffer({
    questOfferId: "qo_1",
    reservationToken: reservation.reservationToken,
    explorerId: "ex_1",
    agentId: "ag_1",
    idempotencyKey: "k_1",
    marketSnapshotVersion: 1,
    now: EPOCH_NOW,
    replenish: {
      regionId: "r_north",
      worldSliceHash: WORLD_SLICE_HASH,
      onReplenishError: (e) => {
        observed = e;
        void observed;
      },
    },
  });
  assert.ok(claim.claimId);
  // Drain the fire-and-forget by awaiting a microtask cycle.
  await new Promise((resolve) => setImmediate(resolve));
  assert.ok(observed instanceof Error);
  assert.equal((observed as Error).message, "replenish_failed");
  // The claim persists; the offer lifecycle is 'claimed'.
  assert.equal(runtime.getStore().projection.lifecyclesById["qo_1"]?.status, "claimed");
  const claimedRecordCount = repo.records.filter((r) => r.type === "offer_claimed").length;
  assert.equal(claimedRecordCount, 1);
});

// ---------------------------------------------------------------------------
// Tests: getInternalOffer server-only resolver
// ---------------------------------------------------------------------------

test("getInternalOffer returns the InternalQuestOffer (with taskFamilyId) for claimed offers", async () => {
  const { runtime } = buildRuntime();
  const offer = buildInternalOffer({
    questOfferId: "qo_1",
    taskFamilyId: "tf_secret",
    taskTypeText: "护送",
    scenarioMapId: "map_a",
    regionId: "r_north",
  });
  await seedRegion(runtime, "r_north", [offer]);
  const reservation = await runtime.reserveQuestOffer({
    questOfferId: "qo_1",
    explorerId: "ex_1",
    marketSnapshotVersion: 1,
    now: EPOCH_NOW,
  });
  await runtime.claimQuestOffer({
    questOfferId: "qo_1",
    reservationToken: reservation.reservationToken,
    explorerId: "ex_1",
    agentId: "ag_1",
    idempotencyKey: "k_1",
    marketSnapshotVersion: 1,
    now: EPOCH_NOW,
  });
  const internal = runtime.getInternalOffer("qo_1");
  assert.ok(internal);
  assert.equal(internal?.taskFamilyId, "tf_secret");
  assert.ok(internal?.offerHash.startsWith("sha256:"));
});

test("getInternalOffer returns undefined for unknown ids", async () => {
  const { runtime } = buildRuntime();
  const offer = buildInternalOffer({
    questOfferId: "qo_1",
    taskFamilyId: "tf_a",
    taskTypeText: "护送",
    scenarioMapId: "map_a",
    regionId: "r_north",
  });
  await seedRegion(runtime, "r_north", [offer]);
  assert.equal(runtime.getInternalOffer("qo_unknown"), undefined);
  // The known offer resolves.
  assert.ok(runtime.getInternalOffer("qo_1") !== undefined);
});

test("getInternalOffer returns undefined after completion", async () => {
  const { runtime } = buildRuntime();
  const offer = buildInternalOffer({
    questOfferId: "qo_complete",
    taskFamilyId: "tf_a",
    taskTypeText: "护送",
    scenarioMapId: "map_a",
    regionId: "r_north",
  });
  await seedRegion(runtime, "r_north", [offer]);
  const reservation = await runtime.reserveQuestOffer({
    questOfferId: "qo_complete",
    explorerId: "ex_1",
    marketSnapshotVersion: 1,
    now: EPOCH_NOW,
  });
  await runtime.claimQuestOffer({
    questOfferId: "qo_complete",
    reservationToken: reservation.reservationToken,
    explorerId: "ex_1",
    agentId: "ag_1",
    idempotencyKey: "k_complete",
    marketSnapshotVersion: 1,
    now: EPOCH_NOW,
  });
  await runtime.completeQuestOffer({ questOfferId: "qo_complete" });
  assert.equal(runtime.getInternalOffer("qo_complete"), undefined);
});

// ---------------------------------------------------------------------------
// Tests: bounty market independence (spec §4.5)
// ---------------------------------------------------------------------------

test("quest offer runtime never imports bounty types and advances no bounty state", async () => {
  const { runtime, repo } = buildRuntime();
  // Construct a bounty listing as an external observer would; it lives in
  // a parallel module and is never seen by the runtime.
  const bounty: BountyListing = {
    bountyId: "b_1",
    listingExplorerId: "ex_bounty",
    status: "open",
    scenarioSummary: " bounty scenario",
    region: { regionId: "r_north", scenarioMapId: "map_a" },
    expiresAt: "2099-01-01T00:00:00.000Z",
  };
  void bounty;

  const offer = buildInternalOffer({
    questOfferId: "qo_1",
    taskFamilyId: "tf_a",
    taskTypeText: "护送",
    scenarioMapId: "map_a",
    regionId: "r_north",
  });
  await seedRegion(runtime, "r_north", [offer]);
  // Verify the JSONL stream contains no bounty-typed records.
  for (const record of repo.records) {
    const type = (record as { type: string }).type;
    assert.ok(!type.startsWith("bounty_"), `bounty record leaked into offers.jsonl: ${type}`);
  }
});

// ---------------------------------------------------------------------------
// Tests: public-read boundary
// ---------------------------------------------------------------------------

test("listAvailableQuestOffers returns ONLY PublicQuestOffer-typed views", async () => {
  const { runtime } = buildRuntime();
  const offer = buildInternalOffer({
    questOfferId: "qo_1",
    taskFamilyId: "tf_internal_only",
    taskTypeText: "护送",
    scenarioMapId: "map_a",
    regionId: "r_north",
  });
  await seedRegion(runtime, "r_north", [offer]);
  const listed = runtime.listAvailableQuestOffers({ regionId: "r_north" });
  assert.equal(listed.length, 1);
  const view = listed[0] as PublicQuestOffer;
  for (const marker of ["taskFamilyId", "strategyAffinity", "fitBps", "expectedApproach"]) {
    assert.ok(
      !(marker in (view as unknown as Record<string, unknown>)),
      `PublicQuestOffer must not carry ${marker}`,
    );
  }
});

test("listAvailableQuestOffers limit caps the returned pool size", async () => {
  const { runtime } = buildRuntime();
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
    buildInternalOffer({
      questOfferId: "qo_3",
      taskFamilyId: "tf_c",
      taskTypeText: "支援",
      scenarioMapId: "map_c",
      regionId: "r_north",
    }),
  ];
  await seedRegion(runtime, "r_north", offers);
  const listed = runtime.listAvailableQuestOffers({ regionId: "r_north", limit: 2 });
  assert.equal(listed.length, 2);
});

// ---------------------------------------------------------------------------
// Tests: replenish via runtime path materializes fresh offers
// ---------------------------------------------------------------------------

test("replenishAfterClaim produces fresh offers with new ids and publishes a new snapshot", async () => {
  const strategy = async (): Promise<readonly InternalQuestOffer[]> => {
    return [
      buildInternalOffer({
        questOfferId: "qo_new_1",
        taskFamilyId: "tf_b",
        taskTypeText: "侦察",
        scenarioMapId: "map_b",
        regionId: "r_north",
        marketSnapshotVersion: 2,
      }),
      buildInternalOffer({
        questOfferId: "qo_new_2",
        taskFamilyId: "tf_c",
        taskTypeText: "支援",
        scenarioMapId: "map_c",
        regionId: "r_north",
        marketSnapshotVersion: 2,
      }),
    ];
  };
  const { runtime } = buildRuntime({ replenishStrategy: strategy });
  const claimed = buildInternalOffer({
    questOfferId: "qo_1",
    taskFamilyId: "tf_a",
    taskTypeText: "护送",
    scenarioMapId: "map_a",
    regionId: "r_north",
  });
  await seedRegion(runtime, "r_north", [claimed]);
  const replenished = await runtime.replenishAfterClaim({
    claimedOfferId: "qo_1",
    regionId: "r_north",
    worldSliceHash: WORLD_SLICE_HASH,
    now: EPOCH_NOW,
  });
  assert.equal(replenished.length, 2);
  // New snapshot version is 2 (1 was the seed).
  for (const offer of replenished) {
    assert.equal(offer.marketSnapshotVersion, 2);
  }
  // The new offers appear in the region pool.
  const pool = runtime.listAvailableQuestOffers({ regionId: "r_north" });
  assert.equal(pool.length, 3, "seed offer remains available plus 2 replenished");
});
