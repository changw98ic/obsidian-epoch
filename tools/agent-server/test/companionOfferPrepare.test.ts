import assert from "node:assert/strict";
import test from "node:test";

import {
  OFFER_SCHEMA_VERSION,
  type InternalQuestOffer,
  type PublicQuestOffer,
} from "../lib/epoch/journeyOfferRules.ts";
import {
  buildInternalQuestOffer,
  createInitialLifecycle,
  type JourneyOfferRepository,
  type OfferPersistenceRecord,
} from "../lib/epoch/journeyOfferStore.ts";
import { createJourneyOfferRuntime } from "../lib/epoch/journeyOfferRuntime.ts";
import { createAgentCompanionRuntime } from "../lib/epoch/agentCompanionRuntime.ts";

/**
 * PR3 integration tests for offer-driven prepare_journey wiring.
 *
 * Coverage focus (Fix 1 + Fix 3):
 *   - prepareWithOffer performs claim + getInternalOffer + delegation
 *   - duplicate prepare requests reuse the same claim (idempotent on
 *     idempotencyKey) and the same prepared journey (idempotency cache)
 *   - destinationRegionId is derived from the resolved offer when the
 *     client omits it (schema/runtime reconciliation)
 *   - client-supplied destinationRegionId that disagrees with the offer
 *     region is rejected by the inner JourneyRuntime.prepare
 *   - offerRuntime absence fails loud (offer_runtime_unavailable)
 *   - resolved offer's internal fields never leak across the public
 *     boundary (zero-bonus invariant)
 */

const EPOCH_NOW = "2026-07-12T00:00:00.000Z";
const WORLD_NOW = "2026-01-01T08:00:00.000Z";
const WORLD_SLICE_HASH = "sha256:0000000000000000000000000000000000000000000000000000000000000000";
const AGENT_ID = "agent_offer_integration";
const EXPLORER_ID = "explorer_offer_integration";

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
// Fixture
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

function buildInternalOffer(input: BuildOfferInput): InternalQuestOffer {
  return buildInternalQuestOffer({
    publicView: buildPublicOffer(input),
    taskFamilyId: input.taskFamilyId,
    expectedApproach: ["combat"],
    worldSliceHash: WORLD_SLICE_HASH,
    source: "catalog_fallback",
  });
}

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
      idFactory: (kind) => `${kind}_offer_integration_${++sequence}`,
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

async function seedOneOffer(
  offerRuntime: ReturnType<typeof createJourneyOfferRuntime>,
  offer: InternalQuestOffer,
): Promise<void> {
  await offerRuntime.publishMarketSnapshot({
    regionId: offer.publicView.region.regionId,
    worldSliceHash: WORLD_SLICE_HASH,
    questOfferIds: [offer.questOfferId],
    now: EPOCH_NOW,
  });
  await offerRuntime.materialize({
    snapshot: {
      marketSnapshotVersion: offer.marketSnapshotVersion,
      regionId: offer.publicView.region.regionId,
      questOfferIds: [offer.questOfferId],
      worldSliceHash: WORLD_SLICE_HASH,
      takenAt: EPOCH_NOW,
      schemaVersion: OFFER_SCHEMA_VERSION,
    },
    publicOffers: [offer.publicView],
    internalOffers: [offer],
    lifecycles: [createInitialLifecycle(offer.questOfferId)],
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test("prepareWithOffer claims the offer, resolves the internal offer, and delegates to prepare", async () => {
  const { offerRuntime, companion } = buildFixture();
  const offer = buildInternalOffer({
    questOfferId: "qo_prepare_1",
    taskFamilyId: "tf_escort",
    taskTypeText: "护送商队",
    scenarioMapId: "map_north_pass",
    regionId: "region_gray_harbor",
  });
  await seedOneOffer(offerRuntime, offer);
  const reservation = await offerRuntime.reserveQuestOffer({
    questOfferId: "qo_prepare_1",
    explorerId: EXPLORER_ID,
    marketSnapshotVersion: 1,
    now: EPOCH_NOW,
  });

  const prepared = await companion.prepareWithOffer({
    agentId: AGENT_ID,
    questOfferId: "qo_prepare_1",
    reservationToken: reservation.reservationToken,
    marketSnapshotVersion: 1,
    idempotencyKey: "prepare-offer-1",
    recoveryCode: "owner-credential",
  });

  assert.equal(prepared.journey.destinationRegionId, "region_gray_harbor");
  // The lifecycle is now 'claimed' on the offer store.
  const lifecycle = offerRuntime.getStore().projection.lifecyclesById["qo_prepare_1"];
  assert.equal(lifecycle?.status, "claimed");
  // Source binding fields stamped on the journey are STRIPPED from the
  // public response (zero-bonus boundary); they remain server-only.
  assert.equal(
    (prepared.journey as unknown as { questOfferId?: string }).questOfferId,
    undefined,
  );
});

test("prepareWithOffer derives destinationRegionId from the offer when the client omits it (Fix 3)", async () => {
  const { offerRuntime, companion } = buildFixture();
  const offer = buildInternalOffer({
    questOfferId: "qo_derive_region",
    taskFamilyId: "tf_scout",
    taskTypeText: "侦察",
    scenarioMapId: "map_east_forest",
    regionId: "region_east_forest",
  });
  await seedOneOffer(offerRuntime, offer);
  const reservation = await offerRuntime.reserveQuestOffer({
    questOfferId: "qo_derive_region",
    explorerId: EXPLORER_ID,
    marketSnapshotVersion: 1,
    now: EPOCH_NOW,
  });

  // Client deliberately OMITS destinationRegionId; the schema makes it
  // optional for offer-driven journeys. The companion must derive it from
  // the resolved offer instead of throwing destination_region_id.
  const prepared = await companion.prepareWithOffer({
    agentId: AGENT_ID,
    questOfferId: "qo_derive_region",
    reservationToken: reservation.reservationToken,
    marketSnapshotVersion: 1,
    idempotencyKey: "prepare-offer-derive-region",
    recoveryCode: "owner-credential",
  });

  assert.equal(prepared.journey.destinationRegionId, "region_east_forest");
});

test("prepareWithOffer rejects when the client-supplied destinationRegionId disagrees with the offer region", async () => {
  const { offerRuntime, companion } = buildFixture();
  const offer = buildInternalOffer({
    questOfferId: "qo_region_mismatch",
    taskFamilyId: "tf_support",
    taskTypeText: "支援",
    scenarioMapId: "map_south_village",
    regionId: "region_south_village",
  });
  await seedOneOffer(offerRuntime, offer);
  const reservation = await offerRuntime.reserveQuestOffer({
    questOfferId: "qo_region_mismatch",
    explorerId: EXPLORER_ID,
    marketSnapshotVersion: 1,
    now: EPOCH_NOW,
  });

  await assert.rejects(
    () => companion.prepareWithOffer({
      agentId: AGENT_ID,
      destinationRegionId: "region_gray_harbor",
      questOfferId: "qo_region_mismatch",
      reservationToken: reservation.reservationToken,
      marketSnapshotVersion: 1,
      idempotencyKey: "prepare-region-mismatch",
      recoveryCode: "owner-credential",
    }),
    /offer_region_mismatch/,
  );
});

test("prepareWithOffer rejects on offer_hash_mismatch when the client echoes a stale offerHash", async () => {
  const { offerRuntime, companion } = buildFixture();
  const offer = buildInternalOffer({
    questOfferId: "qo_hash_mismatch",
    taskFamilyId: "tf_combat",
    taskTypeText: "清剿",
    scenarioMapId: "map_west_ruins",
    regionId: "region_west_ruins",
  });
  await seedOneOffer(offerRuntime, offer);
  const reservation = await offerRuntime.reserveQuestOffer({
    questOfferId: "qo_hash_mismatch",
    explorerId: EXPLORER_ID,
    marketSnapshotVersion: 1,
    now: EPOCH_NOW,
  });

  await assert.rejects(
    () => companion.prepareWithOffer({
      agentId: AGENT_ID,
      questOfferId: "qo_hash_mismatch",
      reservationToken: reservation.reservationToken,
      marketSnapshotVersion: 1,
      offerHash: "sha256:deadbeef",
      idempotencyKey: "prepare-hash-mismatch",
      recoveryCode: "owner-credential",
    }),
    /offer_hash_mismatch/,
  );
});

test("prepareWithOffer is idempotent on idempotencyKey: replay re-returns the same claim and journey", async () => {
  const { offerRuntime, companion } = buildFixture();
  const offer = buildInternalOffer({
    questOfferId: "qo_idempotent",
    taskFamilyId: "tf_escort",
    taskTypeText: "护送商队",
    scenarioMapId: "map_north_pass",
    regionId: "region_gray_harbor",
  });
  await seedOneOffer(offerRuntime, offer);
  const reservation = await offerRuntime.reserveQuestOffer({
    questOfferId: "qo_idempotent",
    explorerId: EXPLORER_ID,
    marketSnapshotVersion: 1,
    now: EPOCH_NOW,
  });

  const first = await companion.prepareWithOffer({
    agentId: AGENT_ID,
    questOfferId: "qo_idempotent",
    reservationToken: reservation.reservationToken,
    marketSnapshotVersion: 1,
    idempotencyKey: "prepare-idempotent",
    recoveryCode: "owner-credential",
  });

  // Network-retry simulation: same idempotencyKey. The offer claim is
  // idempotent on (questOfferId, idempotencyKey), so no double-claim; the
  // companion prepare idempotency cache returns the same prepared journey.
  const replay = await companion.prepareWithOffer({
    agentId: AGENT_ID,
    questOfferId: "qo_idempotent",
    reservationToken: reservation.reservationToken,
    marketSnapshotVersion: 1,
    idempotencyKey: "prepare-idempotent",
    recoveryCode: "owner-credential",
  });

  assert.equal(replay.journey.journeyId, first.journey.journeyId);
  assert.equal((replay as { duplicate?: boolean }).duplicate, true);
  // The offer lifecycle is 'claimed' (no double-claim on replay).
  const lifecycle = offerRuntime.getStore().projection.lifecyclesById["qo_idempotent"];
  assert.equal(lifecycle?.status, "claimed");
});

test("prepareWithOffer never leaks internal offer fields across the public boundary", async () => {
  const { offerRuntime, companion } = buildFixture();
  const offer = buildInternalOffer({
    questOfferId: "qo_no_leak",
    taskFamilyId: "tf_secret_family",
    taskTypeText: "护送商队",
    scenarioMapId: "map_north_pass",
    regionId: "region_gray_harbor",
  });
  await seedOneOffer(offerRuntime, offer);
  const reservation = await offerRuntime.reserveQuestOffer({
    questOfferId: "qo_no_leak",
    explorerId: EXPLORER_ID,
    marketSnapshotVersion: 1,
    now: EPOCH_NOW,
  });

  const prepared = await companion.prepareWithOffer({
    agentId: AGENT_ID,
    questOfferId: "qo_no_leak",
    reservationToken: reservation.reservationToken,
    marketSnapshotVersion: 1,
    idempotencyKey: "prepare-no-leak",
    recoveryCode: "owner-credential",
  });

  const serialized = JSON.stringify(prepared);
  // Zero-bonus invariant: the secret taskFamilyId never appears in the
  // public response, even though the server bound it on the journey.
  assert.doesNotMatch(serialized, /tf_secret_family/);
  assert.doesNotMatch(serialized, /taskFamilyId|expectedApproach|worldSliceHash|strategyAffinity|fitBps/);
});

test("prepare without an offerRuntime wired rejects offer-driven requests with offer_runtime_unavailable", async () => {
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
      idFactory: (kind) => `${kind}_no_offer_runtime_${++sequence}`,
      nowReal: () => EPOCH_NOW,
      nowWorld: () => WORLD_NOW,
    },
    // offerRuntime deliberately omitted.
  });

  await assert.rejects(
    () => companion.prepareWithOffer({
      agentId: AGENT_ID,
      questOfferId: "qo_unwired",
      reservationToken: "token",
      marketSnapshotVersion: 1,
      idempotencyKey: "prepare-unwired",
      recoveryCode: "owner-credential",
    }),
    /offer_runtime_unavailable/,
  );
});

test("prepare rejects when questOfferId is present in input but no pre-resolved questOffer is supplied", () => {
  const { companion } = buildFixture();
  // Direct call to the sync prepare with a questOfferId but no resolved offer:
  // the companion must fail loud rather than silently drop the offer intent.
  assert.throws(
    () => companion.prepare({
      agentId: AGENT_ID,
      questOfferId: "qo_orphan",
      destinationRegionId: "region_gray_harbor",
      idempotencyKey: "prepare-orphan",
      recoveryCode: "owner-credential",
    }),
    /journey_offer_resolution_required/,
  );
});
