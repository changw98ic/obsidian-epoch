/**
 * journeyOfferRuntime.ts — PR3 quest-offer market runtime.
 *
 * Thin command-layer wrapper around {@link QuestOfferStoreImpl}. Exposes
 * the high-level operations command handlers call:
 *   - {@link listAvailableQuestOffers}
 *   - {@link reserveQuestOffer}
 *   - {@link claimQuestOffer}
 *   - {@link completeQuestOffer}
 *   - {@link releaseOrExpireQuestOffer}
 *   - {@link replenishAfterClaim} (fire-and-forget)
 *
 * Boundary rules enforced here:
 *   - **Public reads return only {@link PublicQuestOffer}** —
 *     {@link JourneyOfferRuntime.getInternalOffer} is server-only and
 *     must never be exposed to untrusted callers.
 *   - **Claim success is the accounting entry** (spec §4.2): the runtime
 *     writes `offer_claimed` BEFORE kicking off replenish. Replenish is
 *     awaited only for logging/metrics; its failure never rolls back the
 *     claim or changes the response.
 *   - **Default reservation TTL** is sourced from
 *     {@link DEFAULT_RESERVATION_TTL_MS} unless overridden per-call.
 *
 * Bounty market lifecycle is INDEPENDENT of quest offers (spec §4.5);
 * this runtime never imports bounty types or advances bounty state.
 */

import type {
  InternalQuestOffer,
  MarketSnapshot,
  OfferClaim,
  OfferReservation,
  PublicQuestOffer,
  QuestOfferStatus,
} from "./journeyOfferRules.ts";
import {
  QuestOfferStoreImpl,
  type JourneyOfferRepository,
  type QuestOfferStoreOptions,
  type ReplenishStrategy,
} from "./journeyOfferStore.ts";

// ---------------------------------------------------------------------------
// Runtime options
// ---------------------------------------------------------------------------

export interface JourneyOfferRuntimeOptions {
  readonly repository: JourneyOfferRepository;
  readonly replenishStrategy?: ReplenishStrategy;
  readonly defaultReservationTtlMs?: number;
  readonly now?: () => string;
}

// ---------------------------------------------------------------------------
// Runtime
// ---------------------------------------------------------------------------

/**
 * High-level facade over {@link QuestOfferStoreImpl}. Construct one per
 * server process; the underlying store serializes mutations through its
 * own chain so multiple callers can share the runtime safely.
 */
export class JourneyOfferRuntime {
  private readonly store: QuestOfferStoreImpl;
  private readonly now: () => string;

  constructor(options: JourneyOfferRuntimeOptions) {
    this.store = new QuestOfferStoreImpl({
      repository: options.repository,
      replenishStrategy: options.replenishStrategy,
      defaultReservationTtlMs: options.defaultReservationTtlMs,
    });
    this.now = options.now ?? (() => new Date().toISOString());
  }

  /** Direct access for projection hydration at startup. */
  getStore(): QuestOfferStoreImpl {
    return this.store;
  }

  // ---- snapshot publication (warmup / replenish entry) ----

  publishMarketSnapshot(input: {
    readonly regionId: string;
    readonly worldSliceHash: `sha256:${string}`;
    readonly questOfferIds: readonly string[];
    readonly now?: string;
  }): Promise<MarketSnapshot> {
    return this.store.publishMarketSnapshot({
      regionId: input.regionId,
      worldSliceHash: input.worldSliceHash,
      questOfferIds: input.questOfferIds,
      now: input.now ?? this.now(),
    });
  }

  /** Bulk warmup/seed. Delegates to {@link QuestOfferStoreImpl.materialize}. */
  materialize(input: {
    readonly snapshot: MarketSnapshot;
    readonly publicOffers: readonly PublicQuestOffer[];
    readonly internalOffers: readonly InternalQuestOffer[];
    readonly lifecycles: readonly import("./journeyOfferRules.ts").QuestOfferLifecycle[];
  }): Promise<readonly InternalQuestOffer[]> {
    return this.store.materialize(input);
  }

  // ---- public reads (zero-bonus boundary) ----

  /**
   * List {@link PublicQuestOffer} views available for claim in a region.
   * Returns ONLY the public shape; never leaks {@link InternalQuestOffer}
   * or any bonus marker.
   */
  listAvailableQuestOffers(input: {
    readonly regionId: string;
    readonly limit?: number;
    readonly now?: string;
  }): readonly PublicQuestOffer[] {
    return this.store.listAvailableQuestOffers({
      regionId: input.regionId,
      limit: input.limit,
      now: input.now ?? this.now(),
    });
  }

  // ---- server-only reads ----

  /**
   * Server-only resolver for `prepare_journey`. Returns the full
   * {@link InternalQuestOffer} (with taskFamilyId, expectedApproach,
   * worldSliceHash, offerHash). INTERNAL-only; must NEVER be exposed to
   * untrusted clients.
   */
  getInternalOffer(questOfferId: string): InternalQuestOffer | undefined {
    return this.store.getInternalOffer(questOfferId);
  }

  // ---- lifecycle transitions ----

  /**
   * Reserve an offer for `explorerId`. CAS `available` -> `reserved`.
   * Returns the {@link OfferReservation} carrying the ownership token the
   * client must echo at claim time.
   */
  reserveQuestOffer(input: {
    readonly questOfferId: string;
    readonly explorerId: string;
    readonly marketSnapshotVersion: number;
    readonly reservationTtlMs?: number;
    readonly expectedStatus?: QuestOfferStatus;
    readonly now?: string;
  }): Promise<OfferReservation> {
    return this.store.reserveQuestOffer({
      questOfferId: input.questOfferId,
      explorerId: input.explorerId,
      marketSnapshotVersion: input.marketSnapshotVersion,
      reservationTtlMs: input.reservationTtlMs,
      expectedStatus: input.expectedStatus,
      now: input.now ?? this.now(),
    });
  }

  /**
   * Claim an offer against a reservation. CAS `reserved` -> `claimed`.
   * Idempotent on `(questOfferId, idempotencyKey)`.
   *
   * On a successful claim, this method kicks off async replenish-after-claim
   * (fire-and-forget). Per spec §4.2, replenish failure never rolls back
   * the claim and never changes the response to the caller.
   */
  async claimQuestOffer(input: {
    readonly questOfferId: string;
    readonly reservationToken: string;
    readonly explorerId: string;
    readonly agentId: string;
    readonly idempotencyKey: string;
    readonly marketSnapshotVersion: number;
    readonly expectedStatus?: QuestOfferStatus;
    readonly now?: string;
    readonly replenish?: {
      readonly regionId: string;
      readonly worldSliceHash: `sha256:${string}`;
      readonly onReplenishError?: (error: unknown) => void;
    };
  }): Promise<OfferClaim> {
    const now = input.now ?? this.now();
    const claim = await this.store.claimQuestOffer({
      questOfferId: input.questOfferId,
      reservationToken: input.reservationToken,
      explorerId: input.explorerId,
      agentId: input.agentId,
      idempotencyKey: input.idempotencyKey,
      marketSnapshotVersion: input.marketSnapshotVersion,
      expectedStatus: input.expectedStatus,
      now,
    });
    // Claim success is the accounting entry (spec §4.2). Replenish is
    // fire-and-forget; we DO NOT await it before returning the claim.
    if (input.replenish !== undefined) {
      void this.store
        .replenishAfterClaim({
          claimedOfferId: input.questOfferId,
          regionId: input.replenish.regionId,
          worldSliceHash: input.replenish.worldSliceHash,
          now,
          onReplenishError: input.replenish.onReplenishError,
        })
        .catch(() => undefined);
    }
    return claim;
  }

  /**
   * Mark a claimed offer as completed. CAS `claimed` -> `completed`.
   * Optional `expectedClaimId` binds completion to the exact claim.
   */
  completeQuestOffer(input: {
    readonly questOfferId: string;
    readonly expectedClaimId?: string;
    readonly now?: string;
  }): Promise<void> {
    return this.store.completeQuestOffer({
      questOfferId: input.questOfferId,
      expectedClaimId: input.expectedClaimId,
      now: input.now ?? this.now(),
    });
  }

  /**
   * Release (reservation abandoned / prepare failed) or expire (expiresAt
   * passed) an offer. Idempotent. Side transitions to `released` /
   * `expired`; these are terminal-bypass — the offer never returns to
   * `available`. Replenishment mints new offer ids instead.
   */
  releaseOrExpireQuestOffer(input: {
    readonly questOfferId: string;
    readonly reason: "expired" | "released";
    readonly now?: string;
  }): Promise<void> {
    return this.store.releaseOrExpireQuestOffer({
      questOfferId: input.questOfferId,
      reason: input.reason,
      now: input.now ?? this.now(),
    });
  }

  /**
   * Sweep `reserved` offers whose reservation TTL has elapsed and
   * transition them to `expired`. Returns the swept questOfferIds.
   *
   * Intended for periodic maintenance: callers wire this to a recurring
   * timer (or invoke inline at server boot / before
   * {@link listAvailableQuestOffers}) so that abandoned reservations do
   * not permanently leak market slot capacity. See
   * {@link QuestOfferStoreImpl.sweepExpiredReservations} for the
   * lifecycle-state contract.
   */
  sweepExpiredReservations(input: { readonly now?: string }): Promise<readonly string[]> {
    return this.store.sweepExpiredReservations({ now: input.now ?? this.now() });
  }

  /**
   * Explicit replenish entry (e.g. for scheduled top-up outside a claim).
   * Mirrors the fire-and-forget path used by {@link claimQuestOffer} but
   * returns the materialized public offers so callers can audit the fill.
   */
  replenishAfterClaim(input: {
    readonly claimedOfferId: string;
    readonly regionId: string;
    readonly worldSliceHash: `sha256:${string}`;
    readonly now?: string;
    readonly onReplenishError?: (error: unknown) => void;
  }): Promise<readonly PublicQuestOffer[]> {
    return this.store.replenishAfterClaim({
      claimedOfferId: input.claimedOfferId,
      regionId: input.regionId,
      worldSliceHash: input.worldSliceHash,
      now: input.now ?? this.now(),
      onReplenishError: input.onReplenishError,
    });
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Construct a {@link JourneyOfferRuntime}. Prefer this over direct
 * `new JourneyOfferRuntime(...)` so future constructor changes flow
 * through one call site.
 */
export function createJourneyOfferRuntime(
  options: JourneyOfferRuntimeOptions,
): JourneyOfferRuntime {
  return new JourneyOfferRuntime(options);
}

// Re-export store-level types callers of the runtime also need.
export type { QuestOfferStoreOptions };
