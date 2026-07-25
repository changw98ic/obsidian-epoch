/**
 * Journey offer market contracts.
 *
 * Pure type freeze PR1: defines the public/internal contract surface for the
 * quest-offer market and the parallel bounty market. No runtime logic lives
 * here; only schema versioning, lifecycle enumerations, and the offer/listing
 * interfaces consumed by the server-authoritative market runtime.
 *
 * Zero-bonus hard constraint: {@link PublicQuestOffer} MUST NOT carry any
 * strategy/bonus marker (`taskFamilyId`, `strategyAffinity`, `fitBps`,
 * `expectedApproach`, ...). Those fields are server-only and live on
 * {@link InternalQuestOffer}.
 *
 * Bounty market lifecycle is INDEPENDENT of {@link QuestOfferLifecycle}; the
 * two state machines never advance each other.
 */

import type { ApproachTag } from "./journeyStrategyRules.ts";

/**
 * Schema version gating the persisted shape of every public-facing offer
 * structure ({@link PublicQuestOffer}, {@link QuestOfferLifecycle},
 * {@link MarketSnapshot}). Bumped only on a breaking payload change; existing
 * rows must migrate forward before reading.
 */
export const OFFER_SCHEMA_VERSION = 1 as const;

/**
 * Canonical lifecycle statuses for a quest offer. The market advances offers
 * along exactly this sequence; unknown tags fail closed at the type level.
 */
export const QUEST_OFFER_LIFECYCLE_STATUSES = [
  "available",
  "reserved",
  "claimed",
  "completed",
  "expired",
  "released",
] as const;

/** Status of a quest offer in its server-side lifecycle. */
export type QuestOfferStatus = (typeof QUEST_OFFER_LIFECYCLE_STATUSES)[number];

/**
 * Origin of an offer. `server_ai` and `catalog_fallback` are server-authored;
 * `model_sampling` is produced via the rate-limited sampler; `legacy` covers
 * offers migrated from the pre-versioning journey planner.
 */
export type QuestOfferSource =
  | "server_ai"
  | "catalog_fallback"
  | "model_sampling"
  | "legacy";

/** Server-estimated difficulty band shown to explorers in the offer preview. */
export type EstimatedDifficulty = "low" | "medium" | "high";

/**
 * Region reference attached to an offer. `scenarioMapId` is duplicated at the
 * top level of {@link PublicQuestOffer} for forward-compatibility as the
 * scenario-map lookup surface evolves.
 */
export interface QuestOfferRegionRef {
  /** Stable region identifier matching the world map catalog. */
  readonly regionId: string;
  /** Scenario map the offer is anchored on. */
  readonly scenarioMapId: string;
}

/**
 * Completion tier label shown in the reward preview. Mirrors the canonical
 * journey completion tiers so the preview can be regenerated deterministically
 * from settlement output without a separate mapping.
 */
export type RewardPreviewTier =
  | "未及格"
  | "及格"
  | "良好"
  | "优秀"
  | "惊世";

/** Inclusive numeric range used in reward previews. */
export interface RewardRange {
  readonly min?: number;
  readonly max?: number;
}

/**
 * Non-binding reward preview attached to a public offer. Authority is always
 * `preview_only`: the server remains the sole source of settled reward grants.
 */
export interface RewardPreview {
  readonly authority: "preview_only";
  readonly tierRange?: readonly RewardPreviewTier[];
  readonly resourceRange?: Readonly<Record<string, RewardRange>>;
}

/**
 * ZERO-BONUS public offer payload.
 *
 * Hard constraint: this type MUST NOT carry `taskFamilyId`,
 * `strategyAffinity`, `fitBps`, `expectedApproach`, or any other bonus/strategy
 * marker. Those fields bind server-side state and live only on
 * {@link InternalQuestOffer}. The public type is what untrusted clients,
 * MCP consumers, and the React console see.
 */
export interface PublicQuestOffer {
  /** Server-assigned stable id for this offer. */
  readonly questOfferId: string;
  /** Snapshot version the offer was materialized under. */
  readonly marketSnapshotVersion: number;
  /** Human-readable task type label (e.g. "护送商队"). */
  readonly taskTypeText: string;
  /** Short scenario summary the explorer sees before reservation. */
  readonly scenarioSummary: string;
  /** Region + scenario map the offer is anchored on. */
  readonly region: QuestOfferRegionRef;
  /** Scenario map id; duplicated for forward-compat top-level lookup. */
  readonly scenarioMapId: string;
  /** Server-estimated difficulty band. */
  readonly estimatedDifficulty: EstimatedDifficulty;
  /** Non-binding reward preview; never an authoritative grant. */
  readonly rewardPreview: RewardPreview;
  /** ISO timestamp after which the offer is considered expired. */
  readonly expiresAt: string;
  /** Schema version of this payload. */
  readonly schemaVersion: typeof OFFER_SCHEMA_VERSION;
}

/**
 * Server-only offer record. Carries every internal/bonus-binding field the
 * public type is forbidden from holding. Never serialized to untrusted clients.
 */
export interface InternalQuestOffer {
  /** Server-assigned stable id; matches {@link PublicQuestOffer.questOfferId}. */
  readonly questOfferId: string;
  /** Snapshot version the offer was materialized under. */
  readonly marketSnapshotVersion: number;
  /**
   * Internal task-family binding used for strategy scoring and strategy
   * consistency. NEVER appears on the public type.
   */
  readonly taskFamilyId: string;
  /**
   * Strategy tags the server expects this offer to be approached with.
   * {@link ApproachTag} is imported from `journeyStrategyRules.ts`.
   */
  readonly expectedApproach: readonly ApproachTag[];
  /** Stable content hash over the offer payload, used for dedup and audit. */
  readonly offerHash: `sha256:${string}`;
  /** Schema version of this internal record. */
  readonly offerVersion: typeof OFFER_SCHEMA_VERSION;
  /** Origin of the offer. */
  readonly source: QuestOfferSource;
  /** World slice the offer was generated against. */
  readonly worldSliceHash: `sha256:${string}`;
  /** Optional source-context hash (e.g. prompt lineage) for audit. */
  readonly sourceContextHash?: `sha256:${string}`;
  /** Batch id when the offer was produced as part of a sampling batch. */
  readonly generationBatchId?: string;
  /** The zero-bonus public view shipped to untrusted consumers. */
  readonly publicView: PublicQuestOffer;
}

/**
 * Lifecycle record tracking an offer through reservation, claim, completion,
 * and terminal states. Independent of the bounty market state machine.
 */
export interface QuestOfferLifecycle {
  readonly questOfferId: string;
  readonly status: QuestOfferStatus;
  /** ISO timestamp of the most recent reservation, if any. */
  readonly reservedAt?: string;
  /** Explorer holding the active reservation, if any. */
  readonly reservedByExplorerId?: string;
  /** Opaque token proving reservation ownership. */
  readonly reservationToken?: string;
  /** ISO timestamp after which the reservation expires. */
  readonly reservationTtlExpiresAt?: string;
  /** ISO timestamp of the most recent claim, if any. */
  readonly claimedAt?: string;
  /** Explorer holding the active claim, if any. */
  readonly claimedByExplorerId?: string;
  /** Idempotency key bound to the most recent claim. */
  readonly claimIdempotencyKey?: string;
  /** ISO timestamp of completion, if any. */
  readonly completedAt?: string;
  /** ISO timestamp of expiry, if any. */
  readonly expiredAt?: string;
  /** ISO timestamp of release, if any. */
  readonly releasedAt?: string;
  /** Schema version of this lifecycle record. */
  readonly schemaVersion: typeof OFFER_SCHEMA_VERSION;
}

/** Active reservation on an offer; grants the right to claim within TTL. */
export interface OfferReservation {
  readonly questOfferId: string;
  /** Opaque ownership token; clients must echo this to claim. */
  readonly reservationToken: string;
  readonly explorerId: string;
  readonly marketSnapshotVersion: number;
  readonly reservedAt: string;
  /** ISO timestamp after which the reservation is invalid. */
  readonly expiresAt: string;
}

/** Idempotent claim binding an offer to an agent. */
export interface OfferClaim {
  readonly questOfferId: string;
  /** Stable claim id; unique per (questOfferId, idempotencyKey). */
  readonly claimId: string;
  readonly explorerId: string;
  /** Agent dispatched against the claimed offer. */
  readonly agentId: string;
  /** Idempotency key; replays with the same key return the same claim. */
  readonly idempotencyKey: string;
  readonly claimedAt: string;
  readonly marketSnapshotVersion: number;
}

/**
 * Immutable market snapshot: the set of offers visible in a region at a
 * given version. Clients resolve offers only through a published snapshot.
 */
export interface MarketSnapshot {
  readonly marketSnapshotVersion: number;
  readonly regionId: string;
  /** Offer ids materialized under this snapshot. */
  readonly questOfferIds: readonly string[];
  /** World slice hash the snapshot was generated against. */
  readonly worldSliceHash: `sha256:${string}`;
  /** ISO timestamp the snapshot was taken. */
  readonly takenAt: string;
  readonly schemaVersion: typeof OFFER_SCHEMA_VERSION;
}

/**
 * Canonical lifecycle statuses for a bounty listing. The bounty market state
 * machine is INDEPENDENT of {@link QUEST_OFFER_LIFECYCLE_STATUSES}; the two
 * never advance each other.
 */
export const BOUNTY_LISTING_STATUSES = [
  "open",
  "claimed",
  "completed",
  "expired",
  "cancelled",
] as const;

/** Status of a bounty listing. */
export type BountyListingStatus = (typeof BOUNTY_LISTING_STATUSES)[number];

/**
 * Public bounty listing. Lifecycle is independent of
 * {@link QuestOfferLifecycle}; a bounty may be open regardless of any
 * quest-offer status.
 */
export interface BountyListing {
  readonly bountyId: string;
  /** Explorer who posted the bounty. */
  readonly listingExplorerId: string;
  readonly status: BountyListingStatus;
  readonly scenarioSummary: string;
  readonly region: QuestOfferRegionRef;
  readonly expiresAt: string;
}
