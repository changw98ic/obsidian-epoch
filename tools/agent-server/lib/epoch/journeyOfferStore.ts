/**
 * journeyOfferStore.ts — PR3 quest-offer market store.
 *
 * Single authority for quest-offer lifecycle, persistence, and projection.
 * Combines three concerns:
 *   - {@link JourneyOfferRepository}: append-only JSONL persistence
 *     (`offers.jsonl`) mirroring the `journey-events.jsonl` pattern.
 *   - {@link QuestOfferProjection}: in-memory state replayed from the JSONL
 *     stream via {@link replayOfferStore} (pure reducer, mirrors
 *     `journeyMirrorLedger.ts`).
 *   - {@link QuestOfferStore}: lifecycle state machine
 *     (`available` -> `reserved` -> `claimed` -> `completed`; side transitions
 *     to `expired` / `released`) with CAS, reservation TTL, claim idempotency,
 *     and async replenish-after-claim.
 *
 * Hard constraints enforced here:
 *   - **Zero-bonus boundary** — {@link PublicQuestOffer} is the only shape
 *     that crosses the public read boundary; {@link InternalQuestOffer}
 *     never leaves the server. `assertNoBonusMarker` is invoked at every
 *     factory and read site that could leak strategy state.
 *   - **Append-only persistence** — every lifecycle transition writes one
 *     record; no in-place edits. Replays are idempotent via composite keys.
 *   - **Terminal-bypass** — `released` / `expired` are terminal-bypass;
 *     returning to `available` is FORBIDDEN. Replenishment mints new ids.
 *   - **Claim idempotency** — `(questOfferId, idempotencyKey)` -> single
 *     deterministic `claimId`; replays do not advance lifecycle.
 *
 * Integration boundary: the store is self-contained. Persistence goes through
 * the injected repository; the runtime layer (`journeyOfferRuntime.ts`) wraps
 * the store with default TTL/replenish policy for command handlers.
 */

import { createHash, randomBytes } from "node:crypto";

import { appendJsonl, readJsonl } from "../store.ts";
import {
  OFFER_SCHEMA_VERSION,
  type InternalQuestOffer,
  type MarketSnapshot,
  type OfferClaim,
  type OfferReservation,
  type PublicQuestOffer,
  type QuestOfferLifecycle,
  type QuestOfferSource,
  type QuestOfferStatus,
} from "./journeyOfferRules.ts";
import type { ApproachTag } from "./journeyStrategyRules.ts";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default reservation TTL: 5 minutes (spec §4.1). */
export const DEFAULT_RESERVATION_TTL_MS = 5 * 60 * 1000;

/** Length of the sha256 digest embedded in {@link OfferClaim.claimId}. */
const CLAIM_ID_HASH_LENGTH = 16;

/** Byte length of the cryptographically-random {@link OfferReservation.reservationToken}. */
const RESERVATION_TOKEN_BYTES = 32;

/**
 * Field names that MUST NOT appear on a {@link PublicQuestOffer}. Carrying
 * any of these across the public boundary breaks the zero-bonus contract.
 */
const BONUS_MARKERS = [
  "taskFamilyId",
  "strategyAffinity",
  "fitBps",
  "expectedApproach",
] as const;

// ---------------------------------------------------------------------------
// Persistence records (one per lifecycle transition)
// ---------------------------------------------------------------------------

export interface OfferMaterializedRecord {
  readonly type: "offer_materialized";
  readonly occurredAt: string;
  readonly publicOffer: PublicQuestOffer;
  readonly internalOffer: InternalQuestOffer;
  readonly lifecycle: QuestOfferLifecycle;
  readonly marketSnapshot: MarketSnapshot;
}

export interface OfferReservedRecord {
  readonly type: "offer_reserved";
  readonly occurredAt: string;
  readonly questOfferId: string;
  readonly reservation: OfferReservation;
  readonly lifecycle: QuestOfferLifecycle;
}

export interface OfferClaimedRecord {
  readonly type: "offer_claimed";
  readonly occurredAt: string;
  readonly claim: OfferClaim;
  readonly lifecycle: QuestOfferLifecycle;
}

export interface OfferCompletedRecord {
  readonly type: "offer_completed";
  readonly occurredAt: string;
  readonly questOfferId: string;
  readonly claimId: string;
  readonly lifecycle: QuestOfferLifecycle;
}

export interface OfferReleasedRecord {
  readonly type: "offer_released";
  readonly occurredAt: string;
  readonly questOfferId: string;
  readonly reason: "released";
  readonly lifecycle: QuestOfferLifecycle;
}

export interface OfferExpiredRecord {
  readonly type: "offer_expired";
  readonly occurredAt: string;
  readonly questOfferId: string;
  readonly reason: "expired";
  readonly lifecycle: QuestOfferLifecycle;
}

export interface MarketSnapshotPublishedRecord {
  readonly type: "market_snapshot_published";
  readonly occurredAt: string;
  readonly marketSnapshot: MarketSnapshot;
}

/**
 * Canonical record shape persisted to `offers.jsonl`. The discriminated union
 * is what makes replay deterministic: each tag carries exactly the fields
 * the projection needs to re-derive state.
 */
export type OfferPersistenceRecord =
  | OfferMaterializedRecord
  | OfferReservedRecord
  | OfferClaimedRecord
  | OfferCompletedRecord
  | OfferReleasedRecord
  | OfferExpiredRecord
  | MarketSnapshotPublishedRecord;

// ---------------------------------------------------------------------------
// Canonical JSON + hash derivation
// ---------------------------------------------------------------------------

/**
 * Deterministic JSON serialization for hash stability. Sorts object keys,
 * drops `undefined`, recurses into arrays/objects. Mirrors the private
 * `canonicalJson` in `store.ts`; duplicated here so the offer module's
 * hash stability does not depend on another module's private helper.
 */
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const rec = value as Record<string, unknown>;
    return `{${Object.keys(rec)
      .filter((key) => rec[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(rec[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

/**
 * Single derivation point for the offer content hash. Replays MUST produce
 * identical bytes — non-determinism here would break the consistency-lock
 * binding between prepare and install.
 *
 * sha256 over canonicalJson of stable fields only (no timestamps, no salts).
 * `scenarioMapId` and `taskTypeText` come from the public view because
 * {@link InternalQuestOffer} forwards them via `publicView`.
 */
export function deriveOfferHash(internalOffer: InternalQuestOffer): `sha256:${string}` {
  const canonical = canonicalJson({
    questOfferId: internalOffer.questOfferId,
    taskFamilyId: internalOffer.taskFamilyId,
    scenarioMapId: internalOffer.publicView.scenarioMapId,
    taskTypeText: internalOffer.publicView.taskTypeText,
    worldSliceHash: internalOffer.worldSliceHash,
    marketSnapshotVersion: internalOffer.marketSnapshotVersion,
    source: internalOffer.source,
  });
  return `sha256:${createHash("sha256").update(canonical, "utf8").digest("hex")}`;
}

/**
 * Deterministic claim id derivation. Replays of the same
 * `(questOfferId, idempotencyKey)` pair produce identical ids so
 * restart-replay reconstructs the same claim binding.
 */
export function deriveClaimId(questOfferId: string, idempotencyKey: string): string {
  if (!questOfferId) throw new Error("offer_claim_id_empty_quest_offer_id");
  if (!idempotencyKey) throw new Error("offer_claim_id_empty_idempotency_key");
  const digest = createHash("sha256")
    .update(`${questOfferId}${idempotencyKey}`, "utf8")
    .digest("hex")
    .slice(0, CLAIM_ID_HASH_LENGTH);
  return `claim:${questOfferId}:${digest}`;
}

/**
 * Mint a cryptographically-random reservation token. 32 bytes (256 bits) is
 * overkill for a per-offer ownership proof but matches the server-side
 * token convention used elsewhere.
 */
export function generateReservationToken(): string {
  return randomBytes(RESERVATION_TOKEN_BYTES).toString("hex");
}

// ---------------------------------------------------------------------------
// Zero-bonus invariant assertion
// ---------------------------------------------------------------------------

/**
 * Throw if `value` carries any field forbidden on a {@link PublicQuestOffer}.
 * Called at every public-offer factory and at the read boundary so a leak
 * anywhere upstream cannot propagate to untrusted clients.
 */
function assertNoBonusMarker(value: unknown, label: string): void {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return;
  const rec = value as Record<string, unknown>;
  for (const marker of BONUS_MARKERS) {
    if (Object.prototype.hasOwnProperty.call(rec, marker)) {
      throw new Error(`offer_zero_bonus_marker_present:${label}:${marker}`);
    }
  }
}

/**
 * Build an {@link InternalQuestOffer} from a public view + server-only
 * binding fields. Computes {@link InternalQuestOffer.offerHash} via
 * {@link deriveOfferHash} and stamps {@link InternalQuestOffer.offerVersion}
 * to {@link OFFER_SCHEMA_VERSION}.
 *
 * Asserts the zero-bonus invariant on the public view: any forbidden marker
 * on the input rejects the build at the factory.
 */
export function buildInternalQuestOffer(input: {
  readonly publicView: PublicQuestOffer;
  readonly taskFamilyId: string;
  readonly expectedApproach: readonly ApproachTag[];
  readonly worldSliceHash: `sha256:${string}`;
  readonly source: QuestOfferSource;
  readonly sourceContextHash?: `sha256:${string}`;
  readonly generationBatchId?: string;
}): InternalQuestOffer {
  assertNoBonusMarker(input.publicView, "publicView");
  if (input.publicView.schemaVersion !== OFFER_SCHEMA_VERSION) {
    throw new Error("offer_schema_version_unsupported");
  }
  const internal: InternalQuestOffer = {
    questOfferId: input.publicView.questOfferId,
    marketSnapshotVersion: input.publicView.marketSnapshotVersion,
    taskFamilyId: input.taskFamilyId,
    expectedApproach: [...input.expectedApproach],
    offerHash: "" as `sha256:${string}`, // placeholder; replaced below
    offerVersion: OFFER_SCHEMA_VERSION,
    source: input.source,
    worldSliceHash: input.worldSliceHash,
    sourceContextHash: input.sourceContextHash,
    generationBatchId: input.generationBatchId,
    publicView: input.publicView,
  };
  const offerHash = deriveOfferHash(internal);
  return { ...internal, offerHash };
}

// ---------------------------------------------------------------------------
// Projection
// ---------------------------------------------------------------------------

/**
 * In-memory projection folded from the `offers.jsonl` stream. Treat as
 * opaque outside this module; mutate only through {@link applyRecord} and
 * {@link replayOfferStore}.
 */
export interface QuestOfferProjection {
  /** questOfferId -> InternalQuestOffer (server-only). */
  readonly byOfferId: Readonly<Record<string, InternalQuestOffer>>;
  /** questOfferId -> latest QuestOfferLifecycle. */
  readonly lifecyclesById: Readonly<Record<string, QuestOfferLifecycle>>;
  /** regionId -> ascending list of published MarketSnapshots. */
  readonly snapshotsByRegion: Readonly<Record<string, readonly MarketSnapshot[]>>;
  /** (questOfferId, idempotencyKey) -> OfferClaim (idempotent replay index). */
  readonly claimsByIdempotencyKey: Readonly<Record<string, OfferClaim>>;
  /** reservationToken -> OfferReservation (ownership lookup). */
  readonly reservationsByToken: Readonly<Record<string, OfferReservation>>;
}

export function emptyOfferProjection(): QuestOfferProjection {
  return {
    byOfferId: {},
    lifecyclesById: {},
    snapshotsByRegion: {},
    claimsByIdempotencyKey: {},
    reservationsByToken: {},
  };
}

/**
 * Composite dedupe key per record type. Replays of the same composite key
 * are no-ops; this is what makes the JSONL stream idempotent under retry.
 */
function dedupeKeyFor(record: OfferPersistenceRecord): string {
  switch (record.type) {
    case "offer_materialized":
      return `mat:${record.internalOffer.questOfferId}`;
    case "offer_reserved":
      return `rsv:${record.reservation.questOfferId}:${record.reservation.reservationToken}`;
    case "offer_claimed":
      return `clm:${record.claim.questOfferId}:${record.claim.idempotencyKey}`;
    case "offer_completed":
      return `cmp:${record.questOfferId}:${record.claimId}`;
    case "offer_released":
      return `rel:${record.questOfferId}:${record.occurredAt}`;
    case "offer_expired":
      return `exp:${record.questOfferId}:${record.occurredAt}`;
    case "market_snapshot_published":
      return `snp:${record.marketSnapshot.regionId}:${record.marketSnapshot.marketSnapshotVersion}`;
    default: {
      const _exhaustive: never = record;
      void _exhaustive;
      throw new Error(`offer_persistence_record_unhandled:${String((record as { type: string }).type)}`);
    }
  }
}

/**
 * Apply a single record to the projection. Pure: returns a new projection,
 * never mutates the input.
 */
function applyRecord(
  projection: QuestOfferProjection,
  record: OfferPersistenceRecord,
): QuestOfferProjection {
  switch (record.type) {
    case "offer_materialized":
      return {
        ...projection,
        byOfferId: {
          ...projection.byOfferId,
          [record.internalOffer.questOfferId]: record.internalOffer,
        },
        lifecyclesById: {
          ...projection.lifecyclesById,
          [record.lifecycle.questOfferId]: record.lifecycle,
        },
      };
    case "offer_reserved":
      return {
        ...projection,
        lifecyclesById: {
          ...projection.lifecyclesById,
          [record.lifecycle.questOfferId]: record.lifecycle,
        },
        reservationsByToken: {
          ...projection.reservationsByToken,
          [record.reservation.reservationToken]: record.reservation,
        },
      };
    case "offer_claimed": {
      const idemKey = `${record.claim.questOfferId}:${record.claim.idempotencyKey}`;
      return {
        ...projection,
        lifecyclesById: {
          ...projection.lifecyclesById,
          [record.lifecycle.questOfferId]: record.lifecycle,
        },
        claimsByIdempotencyKey: {
          ...projection.claimsByIdempotencyKey,
          [idemKey]: record.claim,
        },
      };
    }
    case "offer_completed":
    case "offer_released":
    case "offer_expired":
      return {
        ...projection,
        lifecyclesById: {
          ...projection.lifecyclesById,
          [record.lifecycle.questOfferId]: record.lifecycle,
        },
      };
    case "market_snapshot_published": {
      const regionId = record.marketSnapshot.regionId;
      const existing = projection.snapshotsByRegion[regionId] ?? [];
      // Monotonicity guard: corrupted streams that go backwards throw rather
      // than silently accept. Per the spec risk note, this is the only
      // place we enforce it on the read path.
      const maxVersion = existing.length > 0
        ? Math.max(...existing.map((s) => s.marketSnapshotVersion))
        : 0;
      if (record.marketSnapshot.marketSnapshotVersion <= maxVersion) {
        throw new Error("offer_snapshot_version_regression");
      }
      return {
        ...projection,
        snapshotsByRegion: {
          ...projection.snapshotsByRegion,
          [regionId]: [...existing, record.marketSnapshot],
        },
      };
    }
    default: {
      const _exhaustive: never = record;
      void _exhaustive;
      throw new Error(`offer_persistence_record_unhandled:${String((record as { type: string }).type)}`);
    }
  }
}

/**
 * Pure projection reducer. Folds the `offers.jsonl` stream into an in-memory
 * {@link QuestOfferProjection}. Dedupes on record-type-specific composite
 * keys so retry-duplicated appends are no-ops. Deterministic regardless of
 * record chunking.
 *
 * Used at startup by the runtime; also used internally by {@link QuestOfferStoreImpl}
 * to fold single records after persistence.
 */
export function replayOfferStore(
  records: readonly OfferPersistenceRecord[],
): QuestOfferProjection {
  let projection = emptyOfferProjection();
  const seen = new Set<string>();
  for (const record of records) {
    const dedupeKey = dedupeKeyFor(record);
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    projection = applyRecord(projection, record);
  }
  return projection;
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

/**
 * Append-only JSONL repository for offer persistence records. The default
 * implementation routes through `store.ts` `appendJsonl` / `readJsonl`,
 * which serializes appends per file and treats absence as `[]`.
 */
export interface JourneyOfferRepository {
  appendOfferRecord(record: OfferPersistenceRecord): Promise<void>;
  readOfferRecords(): Promise<readonly OfferPersistenceRecord[]>;
}

/**
 * Default file-backed repository. Writes to `dataDir/offers.jsonl` via the
 * shared `appendJsonl` queue (per-file serial).
 */
export function createJourneyOfferRepository(): JourneyOfferRepository {
  return {
    async appendOfferRecord(record: OfferPersistenceRecord): Promise<void> {
      await appendJsonl("offers.jsonl", record);
    },
    async readOfferRecords(): Promise<readonly OfferPersistenceRecord[]> {
      const raw = await readJsonl("offers.jsonl");
      return raw as unknown as readonly OfferPersistenceRecord[];
    },
  };
}

// ---------------------------------------------------------------------------
// Replenish strategy
// ---------------------------------------------------------------------------

/**
 * Strategy that produces replacement offers after a claim. The store
 * publishes a fresh snapshot, invokes the strategy, then materializes the
 * returned offers. The strategy is the seam where server-AI vs.
 * catalog-fallback lives; the store itself is strategy-agnostic.
 *
 * Returned offers MUST carry the provided snapshot's version and a
 * taskFamilyId distinct from the claimed offer's family (spec §4.3).
 */
export type ReplenishStrategy = (input: {
  readonly claimedOfferId: string;
  readonly regionId: string;
  readonly snapshot: MarketSnapshot;
  readonly count: number;
}) => Promise<readonly InternalQuestOffer[]>;

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export interface QuestOfferStoreOptions {
  readonly repository: JourneyOfferRepository;
  readonly replenishStrategy?: ReplenishStrategy;
  readonly defaultReservationTtlMs?: number;
}

/**
 * Lifecycle state machine + persistence boundary for quest offers.
 *
 * Each mutating operation:
 *   1. Validates precondition against the current projection.
 *   2. Computes the new lifecycle + persistence record.
 *   3. Awaits persistence through the repository.
 *   4. Folds the record into the projection synchronously.
 *
 * Mutating operations are serialized through a per-store promise chain so
 * concurrent callers cannot interleave CAS checks. Reads are synchronous
 * against the latest committed projection.
 */
export class QuestOfferStoreImpl {
  private proj: QuestOfferProjection = emptyOfferProjection();
  private readonly repository: JourneyOfferRepository;
  private readonly replenishStrategy: ReplenishStrategy | undefined;
  private readonly defaultReservationTtlMs: number;
  private chain: Promise<unknown> = Promise.resolve();

  constructor(options: QuestOfferStoreOptions) {
    this.repository = options.repository;
    this.replenishStrategy = options.replenishStrategy;
    this.defaultReservationTtlMs = options.defaultReservationTtlMs ?? DEFAULT_RESERVATION_TTL_MS;
  }

  /** Current committed projection. Read-only view; do not mutate externally. */
  get projection(): QuestOfferProjection {
    return this.proj;
  }

  /**
   * Replace the in-memory projection. Used at startup to seed state from
   * {@link replayOfferStore}; not for runtime mutation.
   */
  hydrate(projection: QuestOfferProjection): void {
    this.proj = projection;
  }

  /**
   * Serialize a mutating operation through the per-store chain. Concurrent
   * callers see the chain's tail and attach their work to it; this is what
   * makes CAS safe across awaits.
   */
  private serialize<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.chain.then(fn, fn);
    this.chain = next.then(
      () => undefined,
      () => undefined,
    );
    return next as Promise<T>;
  }

  // ---- snapshot publication ----

  /**
   * Mint a new monotonic {@link MarketSnapshot} for `regionId` and persist
   * a `market_snapshot_published` record. Version is a per-region dense
   * counter reconstructed from the snapshot records on replay.
   */
  publishMarketSnapshot(input: {
    readonly regionId: string;
    readonly worldSliceHash: `sha256:${string}`;
    readonly questOfferIds: readonly string[];
    readonly now: string;
  }): Promise<MarketSnapshot> {
    return this.serialize(() => this.#publishMarketSnapshotInline(input));
  }

  /**
   * Inline (non-serialized) core of {@link publishMarketSnapshot}. Callers
   * MUST already hold the per-store chain (via {@link serialize}) before
   * invoking; concurrent callers must never reach this path directly.
   */
  async #publishMarketSnapshotInline(input: {
    readonly regionId: string;
    readonly worldSliceHash: `sha256:${string}`;
    readonly questOfferIds: readonly string[];
    readonly now: string;
  }): Promise<MarketSnapshot> {
    const existing = this.proj.snapshotsByRegion[input.regionId] ?? [];
    const maxVersion = existing.length > 0
      ? Math.max(...existing.map((s) => s.marketSnapshotVersion))
      : 0;
    const nextVersion = maxVersion + 1;
    const snapshot: MarketSnapshot = {
      marketSnapshotVersion: nextVersion,
      regionId: input.regionId,
      questOfferIds: [...input.questOfferIds],
      worldSliceHash: input.worldSliceHash,
      takenAt: input.now,
      schemaVersion: OFFER_SCHEMA_VERSION,
    };
    const record: MarketSnapshotPublishedRecord = {
      type: "market_snapshot_published",
      occurredAt: input.now,
      marketSnapshot: snapshot,
    };
    await this.repository.appendOfferRecord(record);
    this.proj = applyRecord(this.proj, record);
    return snapshot;
  }

  // ---- materialization (warmup / replenish seed) ----

  /**
   * Bulk warmup/seed. Idempotent on `(questOfferId, schemaVersion)`:
   * replaying the same materialization is a no-op. Each offer starts in
   * status `available`. Writes one `offer_materialized` record per offer
   * through the repository.
   *
   * Rejects offers whose `schemaVersion` != {@link OFFER_SCHEMA_VERSION}
   * with `offer_schema_version_unsupported`. Rejects lifecycle status
   * other than `available` with `offer_materialize_status_invalid`.
   */
  materialize(input: {
    readonly snapshot: MarketSnapshot;
    readonly publicOffers: readonly PublicQuestOffer[];
    readonly internalOffers: readonly InternalQuestOffer[];
    readonly lifecycles: readonly QuestOfferLifecycle[];
  }): Promise<readonly InternalQuestOffer[]> {
    return this.serialize(() => this.#materializeInline(input));
  }

  /**
   * Inline (non-serialized) core of {@link materialize}. Callers MUST
   * already hold the per-store chain (via {@link serialize}) before
   * invoking; concurrent callers must never reach this path directly.
   */
  async #materializeInline(input: {
    readonly snapshot: MarketSnapshot;
    readonly publicOffers: readonly PublicQuestOffer[];
    readonly internalOffers: readonly InternalQuestOffer[];
    readonly lifecycles: readonly QuestOfferLifecycle[];
  }): Promise<readonly InternalQuestOffer[]> {
    if (input.publicOffers.length !== input.internalOffers.length) {
      throw new Error("offer_materialize_array_length_mismatch");
    }
    if (input.publicOffers.length !== input.lifecycles.length) {
      throw new Error("offer_materialize_lifecycle_length_mismatch");
    }
    const materialized: InternalQuestOffer[] = [];
    for (let i = 0; i < input.publicOffers.length; i++) {
      const publicOffer = input.publicOffers[i] as PublicQuestOffer;
      const internalOffer = input.internalOffers[i] as InternalQuestOffer;
      const lifecycle = input.lifecycles[i] as QuestOfferLifecycle;
      assertNoBonusMarker(publicOffer, "publicOffer");
      if (publicOffer.schemaVersion !== OFFER_SCHEMA_VERSION) {
        throw new Error("offer_schema_version_unsupported");
      }
      if (internalOffer.offerVersion !== OFFER_SCHEMA_VERSION) {
        throw new Error("offer_schema_version_unsupported");
      }
      if (lifecycle.schemaVersion !== OFFER_SCHEMA_VERSION) {
        throw new Error("offer_schema_version_unsupported");
      }
      if (lifecycle.status !== "available") {
        throw new Error("offer_materialize_status_invalid");
      }
      if (internalOffer.questOfferId !== publicOffer.questOfferId) {
        throw new Error("offer_materialize_id_mismatch");
      }
      if (internalOffer.questOfferId !== lifecycle.questOfferId) {
        throw new Error("offer_materialize_lifecycle_id_mismatch");
      }
      // Idempotency: an existing materialization with the same offerHash
      // is a no-op. A conflicting materialization (same id, different
      // hash) is rejected to surface the inconsistency loudly.
      const existing = this.proj.byOfferId[internalOffer.questOfferId];
      if (existing !== undefined) {
        if (existing.offerHash === internalOffer.offerHash) {
          materialized.push(existing);
          continue;
        }
        throw new Error("offer_materialize_conflict");
      }
      const record: OfferMaterializedRecord = {
        type: "offer_materialized",
        // PR3 (audit round 2): initial lifecycles never carry `reservedAt`
        // (createInitialLifecycle omits it), so the prior
        // `lifecycle.reservedAt ?? input.snapshot.takenAt` read was dead
        // code — the fallback always won. Reference the snapshot's takenAt
        // directly; it is the canonical "when this offer entered the
        // market" timestamp.
        occurredAt: input.snapshot.takenAt,
        publicOffer: publicOffer,
        internalOffer: internalOffer,
        lifecycle,
        marketSnapshot: input.snapshot,
      };
      await this.repository.appendOfferRecord(record);
      this.proj = applyRecord(this.proj, record);
      materialized.push(internalOffer);
    }
    return materialized;
  }

  // ---- reads ----

  /**
   * Read-only list of {@link PublicQuestOffer} views for every offer in
   * the region whose lifecycle.status === `available` and whose
   * `expiresAt` is still in the future. NEVER exposes
   * {@link InternalQuestOffer} or any bonus marker to the caller.
   */
  listAvailableQuestOffers(input: {
    readonly regionId: string;
    readonly limit?: number;
    readonly now?: string;
  }): readonly PublicQuestOffer[] {
    const now = input.now ?? new Date().toISOString();
    const nowMs = Date.parse(now);
    const collected: PublicQuestOffer[] = [];
    for (const internal of Object.values(this.proj.byOfferId)) {
      if (internal.publicView.region.regionId !== input.regionId) continue;
      const lifecycle = this.proj.lifecyclesById[internal.questOfferId];
      if (lifecycle === undefined) continue;
      if (lifecycle.status !== "available") continue;
      const expiresMs = Date.parse(internal.publicView.expiresAt);
      if (!(expiresMs > nowMs)) continue;
      // Defensive: scrub at the read boundary in case an upstream bug
      // slipped a marker through. The type system already forbids it but
      // the cost is trivial and the contract is critical.
      assertNoBonusMarker(internal.publicView, "publicView");
      collected.push(internal.publicView);
      if (input.limit !== undefined && collected.length >= input.limit) break;
    }
    return collected;
  }

  /**
   * Server-only resolver used by `prepare_journey` to recover
   * taskFamilyId / scenarioMapId / expectedApproach / worldSliceHash /
   * offerHash after a claim. INTERNAL-only — must never be called from a
   * path that returns to untrusted clients.
   *
   * Returns `undefined` if the offer id is unknown or its lifecycle is
   * terminal.
   */
  getInternalOffer(questOfferId: string): InternalQuestOffer | undefined {
    const internal = this.proj.byOfferId[questOfferId];
    if (internal === undefined) return undefined;
    const lifecycle = this.proj.lifecyclesById[questOfferId];
    if (lifecycle === undefined) return undefined;
    if (
      lifecycle.status === "completed"
      || lifecycle.status === "expired"
      || lifecycle.status === "released"
    ) {
      return undefined;
    }
    return internal;
  }

  // ---- lifecycle transitions ----

  /**
   * CAS `available` -> `reserved`. Verifies current status matches
   * `expectedStatus ?? 'available'` (throws `offer_unavailable` /
   * `offer_version_conflict`) and that the offer's snapshot version matches
   * `marketSnapshotVersion` (throws `offer_snapshot_stale`).
   *
   * Mints a cryptographically-random `reservationToken`, computes
   * `reservationTtlExpiresAt = now + reservationTtlMs`. Default TTL is 5
   * minutes ({@link DEFAULT_RESERVATION_TTL_MS}).
   */
  reserveQuestOffer(input: {
    readonly questOfferId: string;
    readonly explorerId: string;
    readonly marketSnapshotVersion: number;
    readonly reservationTtlMs?: number;
    readonly expectedStatus?: QuestOfferStatus;
    readonly now: string;
  }): Promise<OfferReservation> {
    return this.serialize(async () => {
      const internal = this.proj.byOfferId[input.questOfferId];
      if (internal === undefined) throw new Error("offer_not_found");
      const lifecycle = this.proj.lifecyclesById[input.questOfferId];
      if (lifecycle === undefined) throw new Error("offer_not_found");
      const expected = input.expectedStatus ?? "available";
      if (lifecycle.status !== expected) {
        if (lifecycle.status === "available") throw new Error("offer_version_conflict");
        throw new Error("offer_unavailable");
      }
      if (internal.marketSnapshotVersion !== input.marketSnapshotVersion) {
        throw new Error("offer_snapshot_stale");
      }
      const ttlMs = input.reservationTtlMs ?? this.defaultReservationTtlMs;
      const expiresAtIso = new Date(Date.parse(input.now) + ttlMs).toISOString();
      const reservation: OfferReservation = {
        questOfferId: input.questOfferId,
        reservationToken: generateReservationToken(),
        explorerId: input.explorerId,
        marketSnapshotVersion: input.marketSnapshotVersion,
        reservedAt: input.now,
        expiresAt: expiresAtIso,
      };
      const nextLifecycle: QuestOfferLifecycle = {
        ...lifecycle,
        status: "reserved",
        reservedAt: input.now,
        reservedByExplorerId: input.explorerId,
        reservationToken: reservation.reservationToken,
        reservationTtlExpiresAt: expiresAtIso,
      };
      const record: OfferReservedRecord = {
        type: "offer_reserved",
        occurredAt: input.now,
        questOfferId: input.questOfferId,
        reservation,
        lifecycle: nextLifecycle,
      };
      await this.repository.appendOfferRecord(record);
      this.proj = applyRecord(this.proj, record);
      return reservation;
    });
  }

  /**
   * CAS `reserved` -> `claimed`. Rejects:
   *   - `offer_reservation_token_invalid` when token mismatch.
   *   - `offer_reservation_expired` when TTL has elapsed.
   *   - `offer_version_conflict` on expectedStatus/snapshot mismatch.
   *   - `offer_claim_idempotency_owner_mismatch` when an idempotent replay
   *     hits a claim owned by a different explorer/agent.
   *
   * Idempotent on `(questOfferId, idempotencyKey)`: a replay returns the
   * SAME claimId and does NOT advance lifecycle. `claimId` is derived
   * deterministically so restart-replay reconstructs identical ids.
   */
  claimQuestOffer(input: {
    readonly questOfferId: string;
    readonly reservationToken: string;
    readonly explorerId: string;
    readonly agentId: string;
    readonly idempotencyKey: string;
    readonly marketSnapshotVersion: number;
    readonly expectedStatus?: QuestOfferStatus;
    readonly now: string;
  }): Promise<OfferClaim> {
    return this.serialize(async () => {
      const internal = this.proj.byOfferId[input.questOfferId];
      if (internal === undefined) throw new Error("offer_not_found");
      const lifecycle = this.proj.lifecyclesById[input.questOfferId];
      if (lifecycle === undefined) throw new Error("offer_not_found");

      // Idempotent replay short-circuit: same (questOfferId, idempotencyKey)
      // returns the same claim without re-advancing the lifecycle.
      const idemKey = `${input.questOfferId}:${input.idempotencyKey}`;
      const existing = this.proj.claimsByIdempotencyKey[idemKey];
      if (existing !== undefined) {
        if (
          existing.explorerId !== input.explorerId
          || existing.agentId !== input.agentId
        ) {
          throw new Error("offer_claim_idempotency_owner_mismatch");
        }
        return existing;
      }

      const expected = input.expectedStatus ?? "reserved";
      if (lifecycle.status !== expected) {
        if (lifecycle.status === "claimed" || lifecycle.status === "completed") {
          throw new Error("offer_version_conflict");
        }
        throw new Error("offer_unavailable");
      }
      if (internal.marketSnapshotVersion !== input.marketSnapshotVersion) {
        throw new Error("offer_snapshot_stale");
      }
      if (lifecycle.reservationToken !== input.reservationToken) {
        throw new Error("offer_reservation_token_invalid");
      }
      const ttlExpires = lifecycle.reservationTtlExpiresAt;
      if (ttlExpires !== undefined && Date.parse(ttlExpires) <= Date.parse(input.now)) {
        throw new Error("offer_reservation_expired");
      }
      const claimId = deriveClaimId(input.questOfferId, input.idempotencyKey);
      const claim: OfferClaim = {
        questOfferId: input.questOfferId,
        claimId,
        explorerId: input.explorerId,
        agentId: input.agentId,
        idempotencyKey: input.idempotencyKey,
        claimedAt: input.now,
        marketSnapshotVersion: input.marketSnapshotVersion,
      };
      const nextLifecycle: QuestOfferLifecycle = {
        ...lifecycle,
        status: "claimed",
        claimedAt: input.now,
        claimedByExplorerId: input.explorerId,
        claimIdempotencyKey: input.idempotencyKey,
        reservationToken: undefined,
        reservationTtlExpiresAt: undefined,
      };
      const record: OfferClaimedRecord = {
        type: "offer_claimed",
        occurredAt: input.now,
        claim,
        lifecycle: nextLifecycle,
      };
      await this.repository.appendOfferRecord(record);
      this.proj = applyRecord(this.proj, record);
      return claim;
    });
  }

  /**
   * CAS `claimed` -> `completed`. Optional `expectedClaimId` binds
   * completion to the exact claim that originated the journey. Terminal
   * for the offer; cannot transition out.
   */
  completeQuestOffer(input: {
    readonly questOfferId: string;
    readonly expectedClaimId?: string;
    readonly now: string;
  }): Promise<void> {
    return this.serialize(async () => {
      const lifecycle = this.proj.lifecyclesById[input.questOfferId];
      if (lifecycle === undefined) throw new Error("offer_not_found");
      if (lifecycle.status === "completed") return; // idempotent terminal
      if (lifecycle.status !== "claimed") {
        throw new Error("offer_version_conflict");
      }
      const claimId = input.expectedClaimId ?? lifecycle.claimIdempotencyKey ?? "";
      if (input.expectedClaimId !== undefined) {
        // Resolve the actual claim id via the idempotency index when possible.
        const idemKey = lifecycle.claimIdempotencyKey !== undefined
          ? `${input.questOfferId}:${lifecycle.claimIdempotencyKey}`
          : undefined;
        const storedClaim = idemKey !== undefined
          ? this.proj.claimsByIdempotencyKey[idemKey]
          : undefined;
        // PR3 (audit round 2): defensive guard. The lifecycle records a
        // claim (claimIdempotencyKey is set) but the idempotency index is
        // missing the entry. Without this guard, `actualClaimId` collapses
        // to `input.expectedClaimId` and the equality check below becomes
        // a trivially-true no-op. Correct usage (claimQuestOffer writes
        // lifecycle + claimsByIdempotencyKey atomically; replayOfferStore
        // preserves both) never reaches this branch; fail loud rather
        // than silently passing a corrupted / partially-pruned stream.
        if (storedClaim === undefined && idemKey !== undefined) {
          throw new Error("offer_claim_index_missing");
        }
        const actualClaimId = storedClaim?.claimId ?? claimId;
        if (actualClaimId !== input.expectedClaimId) {
          throw new Error("offer_claim_mismatch");
        }
      }
      const nextLifecycle: QuestOfferLifecycle = {
        ...lifecycle,
        status: "completed",
        completedAt: input.now,
      };
      const record: OfferCompletedRecord = {
        type: "offer_completed",
        occurredAt: input.now,
        questOfferId: input.questOfferId,
        claimId,
        lifecycle: nextLifecycle,
      };
      await this.repository.appendOfferRecord(record);
      this.proj = applyRecord(this.proj, record);
    });
  }

  /**
   * Side transitions to `released` (reservation abandoned / prepare failed)
   * or `expired` (expiresAt passed). Idempotent. Returning to `available`
   * is FORBIDDEN — `released` / `expired` are terminal-bypass;
   * replenishment mints NEW offers with new ids instead (prevents offer
   * identity reuse).
   */
  releaseOrExpireQuestOffer(input: {
    readonly questOfferId: string;
    readonly reason: "expired" | "released";
    readonly now: string;
  }): Promise<void> {
    return this.serialize(async () => {
      const lifecycle = this.proj.lifecyclesById[input.questOfferId];
      if (lifecycle === undefined) throw new Error("offer_not_found");
      // Idempotent: re-applying the same terminal-bypass is a no-op.
      if (lifecycle.status === input.reason) return;
      if (lifecycle.status === "completed") {
        throw new Error("offer_release_terminal_completed");
      }
      if (lifecycle.status === "released" || lifecycle.status === "expired") {
        // Already terminal-bypass under the other reason; no-op rather than
        // throw to keep replenishment cleanup idempotent.
        return;
      }
      const nextLifecycle: QuestOfferLifecycle = {
        ...lifecycle,
        status: input.reason,
        releasedAt: input.reason === "released" ? input.now : lifecycle.releasedAt,
        expiredAt: input.reason === "expired" ? input.now : lifecycle.expiredAt,
      };
      const record =
        input.reason === "released"
          ? ({
              type: "offer_released",
              occurredAt: input.now,
              questOfferId: input.questOfferId,
              reason: "released",
              lifecycle: nextLifecycle,
            } as const satisfies OfferReleasedRecord)
          : ({
              type: "offer_expired",
              occurredAt: input.now,
              questOfferId: input.questOfferId,
              reason: "expired",
              lifecycle: nextLifecycle,
            } as const satisfies OfferExpiredRecord);
      await this.repository.appendOfferRecord(record);
      this.proj = applyRecord(this.proj, record);
    });
  }

  // ---- replenishment ----

  /**
   * Fire-and-forget `fill-2`: after a successful claim, asynchronously
   * produce up to 2 replacement offers for the region via the configured
   * {@link ReplenishStrategy}. NEVER throws to the caller; failures are
   * logged via `onReplenishError` (if provided) and swallowed. Per spec
   * §4.2, replenish failure must NOT roll back a successful claim.
   *
   * Materialized offers go back through {@link materialize} after a fresh
   * snapshot is published for the region. If no strategy is configured,
   * returns an empty array.
   *
   * PR3 fix: the snapshot is now published AFTER the strategy returns, with
   * the materialized replacement ids populated in `questOfferIds`, so the
   * published snapshot matches its documented contract. The whole flow runs
   * under the per-store chain so the version handed to the strategy cannot
   * be invalidated by a concurrent publish.
   */
  replenishAfterClaim(input: {
    readonly claimedOfferId: string;
    readonly regionId: string;
    readonly worldSliceHash: `sha256:${string}`;
    readonly now: string;
    readonly onReplenishError?: (error: unknown) => void;
  }): Promise<readonly PublicQuestOffer[]> {
    if (this.replenishStrategy === undefined) return Promise.resolve([]);
    return this.serialize(() => this.#replenishAfterClaimInline(input));
  }

  // ---- reservation TTL sweep ----

  /**
   * Sweep every `reserved` offer whose `reservationTtlExpiresAt` has
   * elapsed and transition it to `expired`. Returns the list of swept
   * questOfferIds (in iteration order; deterministic per call given a
   * stable projection).
   *
   * PR3 (audit round 2): without this sweeper, a client that reserves
   * then drops the connection (without claiming or calling
   * releaseOrExpire) leaves the offer stuck in `reserved` indefinitely.
   * `reservationTtlExpiresAt` is enforced only inside
   * {@link claimQuestOffer} (rejects with `offer_reservation_expired`),
   * so without an external sweep the slot is permanently leaked capacity
   * — `listAvailableQuestOffers` correctly hides it, but the world never
   * recovers the slot. The terminal-bypass design forbids returning to
   * `available`; this sweeper is the authoritative cleanup path that
   * callers (server boot, periodic maintenance timer, list-time sweep)
   * invoke with the current wall-clock `now`.
   *
   * Idempotent: re-running with the same `now` is a no-op. Sweeping is
   * NOT a state a client can race — a concurrent `claimQuestOffer` whose
   * reservation has expired still throws `offer_reservation_expired`
   * inside its own CAS check, and the sweeper's serialized pass takes
   * precedence on lifecycle writes.
   */
  sweepExpiredReservations(input: { readonly now: string }): Promise<readonly string[]> {
    return this.serialize(() => this.#sweepExpiredReservationsInline(input));
  }

  async #sweepExpiredReservationsInline(input: {
    readonly now: string;
  }): Promise<readonly string[]> {
    const nowMs = Date.parse(input.now);
    const swept: string[] = [];
    // Iterate in stable key order so the persisted record sequence is
    // deterministic for a given projection state.
    for (const questOfferId of Object.keys(this.proj.lifecyclesById)) {
      const lifecycle = this.proj.lifecyclesById[questOfferId] as QuestOfferLifecycle | undefined;
      if (lifecycle === undefined) continue;
      if (lifecycle.status !== "reserved") continue;
      const ttlExpires = lifecycle.reservationTtlExpiresAt;
      if (ttlExpires === undefined) continue;
      if (Date.parse(ttlExpires) > nowMs) continue;
      const nextLifecycle: QuestOfferLifecycle = {
        ...lifecycle,
        status: "expired",
        expiredAt: input.now,
        // Clear reservation ownership fields: no one holds an active
        // reservation on this offer any longer.
        reservationToken: undefined,
        reservationTtlExpiresAt: undefined,
      };
      const record: OfferExpiredRecord = {
        type: "offer_expired",
        occurredAt: input.now,
        questOfferId,
        reason: "expired",
        lifecycle: nextLifecycle,
      };
      await this.repository.appendOfferRecord(record);
      this.proj = applyRecord(this.proj, record);
      swept.push(questOfferId);
    }
    return swept;
  }

  async #replenishAfterClaimInline(input: {
    readonly claimedOfferId: string;
    readonly regionId: string;
    readonly worldSliceHash: `sha256:${string}`;
    readonly now: string;
    readonly onReplenishError?: (error: unknown) => void;
  }): Promise<readonly PublicQuestOffer[]> {
    if (this.replenishStrategy === undefined) return [];
    try {
      const claimed = this.proj.byOfferId[input.claimedOfferId];
      const claimedTaskFamilyId = claimed?.taskFamilyId;
      // Compute the next snapshot version inline. Because we hold the chain,
      // no concurrent publish can advance the version between this read and
      // the publishMarketSnapshot call below; the version we hand to the
      // strategy is guaranteed to match the one we publish.
      const existing = this.proj.snapshotsByRegion[input.regionId] ?? [];
      const maxVersion = existing.length > 0
        ? Math.max(...existing.map((s) => s.marketSnapshotVersion))
        : 0;
      const nextVersion = maxVersion + 1;
      const draftSnapshot: MarketSnapshot = {
        marketSnapshotVersion: nextVersion,
        regionId: input.regionId,
        questOfferIds: [],
        worldSliceHash: input.worldSliceHash,
        takenAt: input.now,
        schemaVersion: OFFER_SCHEMA_VERSION,
      };
      const candidates = await this.replenishStrategy({
        claimedOfferId: input.claimedOfferId,
        regionId: input.regionId,
        snapshot: draftSnapshot,
        count: 2,
      });
      // Filter out same-family candidates (spec §4.3: distinct taskFamily).
      const filtered = candidates.filter((offer) => {
        if (offer.publicView.schemaVersion !== OFFER_SCHEMA_VERSION) return false;
        if (offer.marketSnapshotVersion !== nextVersion) return false;
        if (offer.publicView.region.regionId !== input.regionId) return false;
        if (claimedTaskFamilyId !== undefined && offer.taskFamilyId === claimedTaskFamilyId) {
          return false;
        }
        return true;
      });
      if (filtered.length === 0) return [];
      // Publish the real snapshot with the materialized ids populated. Inside
      // the serialized flow, the recomputed version equals nextVersion.
      const snapshot = await this.#publishMarketSnapshotInline({
        regionId: input.regionId,
        worldSliceHash: input.worldSliceHash,
        questOfferIds: filtered.map((o) => o.questOfferId),
        now: input.now,
      });
      await this.#materializeInline({
        snapshot,
        publicOffers: filtered.map((o) => o.publicView),
        internalOffers: filtered,
        lifecycles: filtered.map((o) => createInitialLifecycle(o.questOfferId)),
      });
      return filtered.map((o) => o.publicView);
    } catch (error) {
      // Per spec §4.2: replenish failure must NOT roll back the claim.
      // Swallow and surface only via the optional error sink.
      if (input.onReplenishError !== undefined) {
        try {
          input.onReplenishError(error);
        } catch {
          // Even the error sink is best-effort.
        }
      }
      return [];
    }
  }
}

/**
 * Build a fresh `available` lifecycle for a newly-materialized offer.
 * Centralized here so warmup and replenish produce identical shapes.
 *
 * Note: the offer's expiry deadline lives on
 * {@link PublicQuestOffer.expiresAt}; the lifecycle only records the
 * timestamp at which it transitions to `expired`.
 */
export function createInitialLifecycle(questOfferId: string): QuestOfferLifecycle {
  return {
    questOfferId,
    status: "available",
    schemaVersion: OFFER_SCHEMA_VERSION,
  };
}
