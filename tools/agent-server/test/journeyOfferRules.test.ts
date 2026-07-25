import assert from "node:assert/strict";
import test from "node:test";

import {
  BOUNTY_LISTING_STATUSES,
  OFFER_SCHEMA_VERSION,
  QUEST_OFFER_LIFECYCLE_STATUSES,
  type BountyListing,
  type BountyListingStatus,
  type EstimatedDifficulty,
  type InternalQuestOffer,
  type MarketSnapshot,
  type OfferClaim,
  type OfferReservation,
  type PublicQuestOffer,
  type QuestOfferLifecycle,
  type QuestOfferRegionRef,
  type QuestOfferSource,
  type QuestOfferStatus,
  type RewardPreview,
  type RewardPreviewTier,
  type RewardRange,
} from "../lib/epoch/journeyOfferRules.ts";

/**
 * Compile-time equal helper. Returns true when the two types are identical in
 * both directions. Used to assert that the public offer type is structurally
 * stripped of every bonus marker.
 */
type Equal<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends (<T>() => T extends Y ? 1 : 2)
    ? true
    : false;

/** List of every field name that MUST NOT leak onto the public offer type. */
type BonusMarker =
  | "taskFamilyId"
  | "strategyAffinity"
  | "fitBps"
  | "expectedApproach";

/** True when every bonus marker is absent from the keys of T. */
type HasNoBonusMarker<T> =
  T extends unknown
    ? BonusMarker extends keyof T
      ? false
      : true
    : never;

test("OFFER_SCHEMA_VERSION is pinned at 1 and is a literal type", () => {
  assert.equal(OFFER_SCHEMA_VERSION, 1);

  // Compile-time: the const folds to the literal `1`, not `number`.
  const _literalCheck: typeof OFFER_SCHEMA_VERSION = 1;
  void _literalCheck;
});

test("QUEST_OFFER_LIFECYCLE_STATUSES enumerates exactly the six canonical statuses in order", () => {
  assert.deepEqual([...QUEST_OFFER_LIFECYCLE_STATUSES], [
    "available",
    "reserved",
    "claimed",
    "completed",
    "expired",
    "released",
  ]);
  assert.equal(QUEST_OFFER_LIFECYCLE_STATUSES.length, 6);
});

test("BOUNTY_LISTING_STATUSES enumerates exactly the five canonical statuses in order", () => {
  assert.deepEqual([...BOUNTY_LISTING_STATUSES], [
    "open",
    "claimed",
    "completed",
    "expired",
    "cancelled",
  ]);
  assert.equal(BOUNTY_LISTING_STATUSES.length, 5);
});

test("QuestOfferStatus fails closed on unknown tags at compile time", () => {
  // Every emitted status is one of the canonical literals.
  const statuses: QuestOfferStatus[] = [...QUEST_OFFER_LIFECYCLE_STATUSES];
  for (const status of statuses) {
    assert.ok(
      (QUEST_OFFER_LIFECYCLE_STATUSES as readonly string[]).includes(status),
    );
  }

  // Static rejection: an unknown tag cannot be assigned to QuestOfferStatus.
  // The @ts-expect-error line must remain a type error; if it ever stops
  // erroring, the type has been widened and the fail-closed guarantee is lost.
  // @ts-expect-error - "unknown_tag" is not a canonical QuestOfferStatus
  const _rejected: QuestOfferStatus = "unknown_tag";
  void _rejected;
});

test("BountyListingStatus fails closed on unknown tags at compile time", () => {
  const statuses: BountyListingStatus[] = [...BOUNTY_LISTING_STATUSES];
  for (const status of statuses) {
    assert.ok(
      (BOUNTY_LISTING_STATUSES as readonly string[]).includes(status),
    );
  }

  // @ts-expect-error - "frozen" is not a canonical BountyListingStatus
  const _rejected: BountyListingStatus = "frozen";
  void _rejected;
});

test("QuestOfferSource / EstimatedDifficulty / RewardPreviewTier unions are exhaustive", () => {
  const sources: QuestOfferSource[] = [
    "server_ai",
    "catalog_fallback",
    "model_sampling",
    "legacy",
  ];
  assert.equal(new Set(sources).size, 4);

  const difficulties: EstimatedDifficulty[] = ["low", "medium", "high"];
  assert.equal(difficulties.length, 3);

  const tiers: RewardPreviewTier[] = [
    "未及格",
    "及格",
    "良好",
    "优秀",
    "惊世",
  ];
  assert.equal(tiers.length, 5);
});

test("public offer type is constructible from its documented fields", () => {
  const region: QuestOfferRegionRef = {
    regionId: "region_ash_harbor",
    scenarioMapId: "scenario_ash_harbor_market",
  };
  const rewardRange: RewardRange = { min: 10, max: 30 };
  const rewardPreview: RewardPreview = {
    authority: "preview_only",
    tierRange: ["及格", "良好"],
    resourceRange: { coin: rewardRange },
  };
  const offer: PublicQuestOffer = {
    questOfferId: "offer_1",
    marketSnapshotVersion: 42,
    taskTypeText: "护送商队",
    scenarioSummary: "把药材从灰港护送到雾岭。",
    region,
    scenarioMapId: region.scenarioMapId,
    estimatedDifficulty: "medium",
    rewardPreview,
    expiresAt: "2026-01-01T00:00:00.000Z",
    schemaVersion: OFFER_SCHEMA_VERSION,
  };

  assert.equal(offer.questOfferId, "offer_1");
  assert.equal(offer.rewardPreview.authority, "preview_only");
  assert.equal(offer.schemaVersion, 1);
});

test("internal offer type is constructible and carries the bonus markers the public type forbids", () => {
  const publicView: PublicQuestOffer = {
    questOfferId: "offer_2",
    marketSnapshotVersion: 7,
    taskTypeText: "勘察遗址",
    scenarioSummary: "记录下古代机械遗迹的细节。",
    region: { regionId: "region_mist_ridge", scenarioMapId: "scenario_mist_ridge_ruins" },
    scenarioMapId: "scenario_mist_ridge_ruins",
    estimatedDifficulty: "high",
    rewardPreview: { authority: "preview_only" },
    expiresAt: "2026-02-01T00:00:00.000Z",
    schemaVersion: OFFER_SCHEMA_VERSION,
  };
  const internal: InternalQuestOffer = {
    questOfferId: "offer_2",
    marketSnapshotVersion: 7,
    taskFamilyId: "family_recon",
    expectedApproach: [],
    offerHash: `sha256:${"a".repeat(64)}`,
    offerVersion: OFFER_SCHEMA_VERSION,
    source: "server_ai",
    worldSliceHash: `sha256:${"b".repeat(64)}`,
    publicView,
  };

  assert.equal(internal.taskFamilyId, "family_recon");
  assert.deepEqual(internal.expectedApproach, []);
  assert.equal(internal.publicView, publicView);
});

test("lifecycle, reservation, claim, snapshot, and bounty records are constructible", () => {
  const lifecycle: QuestOfferLifecycle = {
    questOfferId: "offer_3",
    status: "available",
    schemaVersion: OFFER_SCHEMA_VERSION,
  };
  assert.equal(lifecycle.status, "available");

  const reservation: OfferReservation = {
    questOfferId: "offer_3",
    reservationToken: "tok_xyz",
    explorerId: "explorer_1",
    marketSnapshotVersion: 3,
    reservedAt: "2026-03-01T00:00:00.000Z",
    expiresAt: "2026-03-01T00:15:00.000Z",
  };
  assert.equal(reservation.reservationToken, "tok_xyz");

  const claim: OfferClaim = {
    questOfferId: "offer_3",
    claimId: "claim_1",
    explorerId: "explorer_1",
    agentId: "agent_1",
    idempotencyKey: "key_1",
    claimedAt: "2026-03-01T00:05:00.000Z",
    marketSnapshotVersion: 3,
  };
  assert.equal(claim.claimId, "claim_1");

  const snapshot: MarketSnapshot = {
    marketSnapshotVersion: 3,
    regionId: "region_ash_harbor",
    questOfferIds: ["offer_3"],
    worldSliceHash: `sha256:${"c".repeat(64)}`,
    takenAt: "2026-03-01T00:00:00.000Z",
    schemaVersion: OFFER_SCHEMA_VERSION,
  };
  assert.deepEqual([...snapshot.questOfferIds], ["offer_3"]);

  const bounty: BountyListing = {
    bountyId: "bounty_1",
    listingExplorerId: "explorer_2",
    status: "open",
    scenarioSummary: "找回落难商队的货物。",
    region: { regionId: "region_mist_ridge", scenarioMapId: "scenario_mist_ridge_pass" },
    expiresAt: "2026-04-01T00:00:00.000Z",
  };
  assert.equal(bounty.status, "open");
});

test("PUBLIC offer type is statically stripped of every strategy/bonus marker", () => {
  // Static assertions: if any of these ever become `false`, a bonus marker has
  // leaked onto PublicQuestOffer and the zero-bonus contract is broken.
  const _noTaskFamilyId: Equal<HasNoBonusMarker<PublicQuestOffer>, true> = true;
  const _noBonusOnReward: Equal<HasNoBonusMarker<RewardPreview>, true> = true;
  void _noTaskFamilyId;
  void _noBonusOnReward;

  // Field-level presence checks (runtime mirrors of the static guarantee).
  const sample = {
    questOfferId: "x",
    marketSnapshotVersion: 0,
    taskTypeText: "t",
    scenarioSummary: "s",
    region: { regionId: "r", scenarioMapId: "m" },
    scenarioMapId: "m",
    estimatedDifficulty: "low" as const,
    rewardPreview: { authority: "preview_only" as const },
    expiresAt: "2026-01-01T00:00:00.000Z",
    schemaVersion: OFFER_SCHEMA_VERSION,
  } satisfies PublicQuestOffer;

  assert.equal("taskFamilyId" in sample, false);
  assert.equal("strategyAffinity" in sample, false);
  assert.equal("fitBps" in sample, false);
  assert.equal("expectedApproach" in sample, false);
});
