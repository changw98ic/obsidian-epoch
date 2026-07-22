import { createHash } from "node:crypto";

export type CausalIdempotencyManifestStatus = "pending" | "committed" | "rejected";

export interface CausalIdempotencyScopeInput {
  readonly worldId: string;
  readonly commandType: string;
  readonly actorRef: string;
  readonly idempotencyKey: string;
}

export interface CausalIdempotencyInput extends CausalIdempotencyScopeInput {
  readonly input: unknown;
}

export interface CausalIdempotencyManifest {
  readonly scope: string;
  readonly worldId: string;
  readonly commandType: string;
  readonly actorRef: string;
  readonly idempotencyKey: string;
  readonly inputHash: `sha256:${string}`;
  readonly status: CausalIdempotencyManifestStatus;
  readonly eventIds: readonly string[];
  readonly rejectionCode?: string;
  readonly scheduledKey?: string;
  readonly createdAt?: string;
  readonly ownerId?: string;
  readonly fencingToken?: number;
  readonly leaseExpiresAt?: string;
  readonly updatedAt?: string;
}

export interface CausalIdempotencyReservation {
  readonly manifest: CausalIdempotencyManifest & {
    readonly status: "pending";
    readonly ownerId: string;
    readonly fencingToken: number;
    readonly leaseExpiresAt: string;
  };
}

export type CausalIdempotencyClaimResult =
  | { readonly kind: "reserved"; readonly reservation: CausalIdempotencyReservation }
  | { readonly kind: "committed"; readonly manifest: CausalIdempotencyManifest }
  | { readonly kind: "rejected"; readonly manifest: CausalIdempotencyManifest }
  | { readonly kind: "pending"; readonly manifest: CausalIdempotencyManifest };

export interface CausalAtomicCommitContext {
  readonly appendJsonl?: (fileName: string, record: unknown) => void;
}

export interface CausalIdempotencyManifestStore {
  read(scope: string): CausalIdempotencyManifest | undefined | Promise<CausalIdempotencyManifest | undefined>;
  write(manifest: CausalIdempotencyManifest): void | Promise<void>;
  putIfAbsent?(
    manifest: CausalIdempotencyManifest,
  ): CausalIdempotencyManifest | undefined | Promise<CausalIdempotencyManifest | undefined>;
  claimReservation?(
    input: CausalIdempotencyInput,
    options: {
      readonly ownerId: string;
      readonly now: string;
      readonly leaseExpiresAt: string;
    },
  ): CausalIdempotencyClaimResult | Promise<CausalIdempotencyClaimResult>;
  finalizeReservation?(
    reservation: CausalIdempotencyReservation,
    manifest: CausalIdempotencyManifest,
  ): CausalIdempotencyManifest | Promise<CausalIdempotencyManifest>;
  commitAtomically?(
    reservation: CausalIdempotencyReservation,
    manifest: CausalIdempotencyManifest,
    commit: (context: CausalAtomicCommitContext) => void | Promise<void>,
  ): CausalIdempotencyManifest | Promise<CausalIdempotencyManifest>;
}

export interface CreateCausalIdempotencyManifestInput extends CausalIdempotencyInput {
  readonly status: CausalIdempotencyManifestStatus;
  readonly eventIds?: readonly string[];
  readonly rejectionCode?: string;
  readonly scheduledKey?: string;
  readonly createdAt?: string;
  readonly ownerId?: string;
  readonly fencingToken?: number;
  readonly leaseExpiresAt?: string;
  readonly updatedAt?: string;
}

export class CausalIdempotencyConflictError extends Error {
  readonly code = "causal_idempotency_conflict";
  readonly scope: string;
  readonly expectedInputHash: string;
  readonly actualInputHash: string;

  constructor(scope: string, expectedInputHash: string, actualInputHash: string) {
    super("causal_idempotency_conflict");
    this.name = "CausalIdempotencyConflictError";
    this.scope = scope;
    this.expectedInputHash = expectedInputHash;
    this.actualInputHash = actualInputHash;
  }
}

export class CausalIdempotencyPendingError extends Error {
  readonly code = "causal_idempotency_pending";
  readonly retryable = true;
  readonly scope: string;
  readonly leaseExpiresAt?: string;

  constructor(scope: string, leaseExpiresAt?: string) {
    super("causal_idempotency_pending");
    this.name = "CausalIdempotencyPendingError";
    this.scope = scope;
    this.leaseExpiresAt = leaseExpiresAt;
  }
}

export class CausalIdempotencyFenceError extends Error {
  readonly code = "causal_idempotency_fence_lost";
  readonly retryable = true;
  readonly scope: string;

  constructor(scope: string) {
    super("causal_idempotency_fence_lost");
    this.name = "CausalIdempotencyFenceError";
    this.scope = scope;
  }
}

function assertStablePart(value: string, fieldName: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${fieldName}_required`);
  }
  return encodeURIComponent(value);
}

export function causalIdempotencyScope(input: CausalIdempotencyScopeInput): string {
  return [
    assertStablePart(input.worldId, "world_id"),
    assertStablePart(input.commandType, "command_type"),
    assertStablePart(input.actorRef, "actor_ref"),
    assertStablePart(input.idempotencyKey, "idempotency_key"),
  ].join(":");
}

export function stableCausalJson(value: unknown): string {
  return JSON.stringify(normalizeStableValue(value));
}

export function causalInputHash(input: unknown): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(stableCausalJson(input)).digest("hex")}`;
}

export function scheduledCausalIdempotencyKey(input: CausalIdempotencyScopeInput): string {
  return `scheduled:${causalIdempotencyScope(input)}`;
}

export function createCausalIdempotencyManifest(
  input: CreateCausalIdempotencyManifestInput,
): CausalIdempotencyManifest {
  const manifest: CausalIdempotencyManifest = {
    scope: causalIdempotencyScope(input),
    worldId: input.worldId,
    commandType: input.commandType,
    actorRef: input.actorRef,
    idempotencyKey: input.idempotencyKey,
    inputHash: causalInputHash(input.input),
    status: input.status,
    eventIds: input.eventIds ?? [],
  };
  if (input.rejectionCode !== undefined) {
    return {
      ...manifest,
      rejectionCode: input.rejectionCode,
      ...(input.scheduledKey !== undefined ? { scheduledKey: input.scheduledKey } : {}),
      ...(input.createdAt !== undefined ? { createdAt: input.createdAt } : {}),
      ...(input.ownerId !== undefined ? { ownerId: input.ownerId } : {}),
      ...(input.fencingToken !== undefined ? { fencingToken: input.fencingToken } : {}),
      ...(input.leaseExpiresAt !== undefined ? { leaseExpiresAt: input.leaseExpiresAt } : {}),
      ...(input.updatedAt !== undefined ? { updatedAt: input.updatedAt } : {}),
    };
  }
  return {
    ...manifest,
    ...(input.scheduledKey !== undefined ? { scheduledKey: input.scheduledKey } : {}),
    ...(input.createdAt !== undefined ? { createdAt: input.createdAt } : {}),
    ...(input.ownerId !== undefined ? { ownerId: input.ownerId } : {}),
    ...(input.fencingToken !== undefined ? { fencingToken: input.fencingToken } : {}),
    ...(input.leaseExpiresAt !== undefined ? { leaseExpiresAt: input.leaseExpiresAt } : {}),
    ...(input.updatedAt !== undefined ? { updatedAt: input.updatedAt } : {}),
  };
}

export function committedCausalManifest(
  input: Omit<CreateCausalIdempotencyManifestInput, "status" | "rejectionCode">,
): CausalIdempotencyManifest {
  return createCausalIdempotencyManifest({ ...input, status: "committed" });
}

export function rejectedCausalManifest(
  input: Omit<CreateCausalIdempotencyManifestInput, "status" | "eventIds"> & { readonly rejectionCode: string },
): CausalIdempotencyManifest {
  return createCausalIdempotencyManifest({ ...input, status: "rejected", eventIds: [] });
}

export function pendingCausalManifest(
  input: Omit<CreateCausalIdempotencyManifestInput, "status" | "eventIds" | "rejectionCode"> & {
    readonly ownerId: string;
    readonly fencingToken: number;
    readonly leaseExpiresAt: string;
  },
): CausalIdempotencyManifest & {
  readonly status: "pending";
  readonly ownerId: string;
  readonly fencingToken: number;
  readonly leaseExpiresAt: string;
} {
  return createCausalIdempotencyManifest({
    ...input,
    status: "pending",
    eventIds: [],
  }) as CausalIdempotencyManifest & {
    readonly status: "pending";
    readonly ownerId: string;
    readonly fencingToken: number;
    readonly leaseExpiresAt: string;
  };
}

export function assertCausalIdempotencyReplay(
  existing: CausalIdempotencyManifest,
  input: CausalIdempotencyInput,
): CausalIdempotencyManifest {
  const actualScope = causalIdempotencyScope(input);
  const actualInputHash = causalInputHash(input.input);
  if (existing.scope !== actualScope || existing.inputHash !== actualInputHash) {
    throw new CausalIdempotencyConflictError(existing.scope, existing.inputHash, actualInputHash);
  }
  return existing;
}

export function assertCausalReservationFinalization(
  reservation: CausalIdempotencyReservation,
  existing: CausalIdempotencyManifest | undefined,
  manifest: CausalIdempotencyManifest,
): CausalIdempotencyManifest {
  if (!existing
    || existing.status !== "pending"
    || existing.ownerId !== reservation.manifest.ownerId
    || existing.fencingToken !== reservation.manifest.fencingToken) {
    throw new CausalIdempotencyFenceError(reservation.manifest.scope);
  }
  if (manifest.scope !== existing.scope || manifest.inputHash !== existing.inputHash) {
    throw new CausalIdempotencyConflictError(existing.scope, existing.inputHash, manifest.inputHash);
  }
  if (manifest.status === "pending") throw new Error("causal_idempotency_final_status_required");
  return manifest;
}

export function causalIdempotencyLeaseExpired(manifest: CausalIdempotencyManifest, now: string) {
  return manifest.status === "pending"
    && typeof manifest.leaseExpiresAt === "string"
    && manifest.leaseExpiresAt <= now;
}

export async function resolveCausalIdempotency(
  store: CausalIdempotencyManifestStore,
  input: CausalIdempotencyInput,
  createManifest: () => CausalIdempotencyManifest | Promise<CausalIdempotencyManifest>,
): Promise<CausalIdempotencyManifest> {
  const scope = causalIdempotencyScope(input);
  const existing = await store.read(scope);
  if (existing) return assertCausalIdempotencyReplay(existing, input);

  const manifest = assertCausalIdempotencyReplay(await createManifest(), input);
  const concurrent = store.putIfAbsent ? await store.putIfAbsent(manifest) : undefined;
  if (concurrent) return assertCausalIdempotencyReplay(concurrent, input);
  if (!store.putIfAbsent) await store.write(manifest);
  return manifest;
}

export function createInMemoryCausalIdempotencyManifestStore(
  initialManifests: readonly CausalIdempotencyManifest[] = [],
): CausalIdempotencyManifestStore {
  const manifests = new Map(initialManifests.map((manifest) => [manifest.scope, manifest]));
  return {
    read(scope: string) {
      return manifests.get(scope);
    },
    write(manifest: CausalIdempotencyManifest) {
      manifests.set(manifest.scope, manifest);
    },
    putIfAbsent(manifest: CausalIdempotencyManifest) {
      const existing = manifests.get(manifest.scope);
      if (existing) return existing;
      manifests.set(manifest.scope, manifest);
      return undefined;
    },
    claimReservation(input, options) {
      const scope = causalIdempotencyScope(input);
      const existing = manifests.get(scope);
      if (existing) {
        assertCausalIdempotencyReplay(existing, input);
        if (existing.status === "pending" && causalIdempotencyLeaseExpired(existing, options.now)) {
          const manifest = pendingCausalManifest({
            ...input,
            ownerId: options.ownerId,
            fencingToken: (existing.fencingToken || 0) + 1,
            leaseExpiresAt: options.leaseExpiresAt,
            createdAt: existing.createdAt || options.now,
            updatedAt: options.now,
          });
          manifests.set(scope, manifest);
          return { kind: "reserved", reservation: { manifest } };
        }
        if (existing.status === "pending") return { kind: "pending", manifest: existing };
        return { kind: existing.status, manifest: existing };
      }
      const manifest = pendingCausalManifest({
        ...input,
        ownerId: options.ownerId,
        fencingToken: 1,
        leaseExpiresAt: options.leaseExpiresAt,
        createdAt: options.now,
        updatedAt: options.now,
      });
      manifests.set(scope, manifest);
      return { kind: "reserved", reservation: { manifest } };
    },
    finalizeReservation(reservation, manifest) {
      const finalized = assertCausalReservationFinalization(
        reservation,
        manifests.get(reservation.manifest.scope),
        manifest,
      );
      manifests.set(finalized.scope, finalized);
      return finalized;
    },
    async commitAtomically(reservation, manifest, commit) {
      const finalized = assertCausalReservationFinalization(
        reservation,
        manifests.get(reservation.manifest.scope),
        manifest,
      );
      await commit({});
      manifests.set(finalized.scope, finalized);
      return finalized;
    },
  };
}

function normalizeStableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((entry) => normalizeStableValue(entry));
  if (!value || typeof value !== "object") return value;
  const output: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort()) {
    const entry = (value as Record<string, unknown>)[key];
    if (entry !== undefined) output[key] = normalizeStableValue(entry);
  }
  return output;
}
