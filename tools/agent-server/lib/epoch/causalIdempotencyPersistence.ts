import { appendFile, mkdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import {
  assertCausalIdempotencyReplay,
  assertCausalReservationFinalization,
  causalIdempotencyLeaseExpired,
  causalIdempotencyScope,
  pendingCausalManifest,
  type CausalIdempotencyClaimResult,
  type CausalIdempotencyInput,
  type CausalIdempotencyManifest,
  type CausalIdempotencyManifestStore,
  type CausalIdempotencyReservation,
} from "./causalIdempotencyRules.ts";

type JsonRecord = Record<string, unknown>;

const IDEMPOTENCY_FILE = "causal-idempotency.jsonl";
const LOCK_RETRY_MS = 10;
const LOCK_TIMEOUT_MS = 5_000;

interface CausalIdempotencyRecord extends JsonRecord {
  readonly type: "causal_idempotency_manifest";
  readonly manifest: CausalIdempotencyManifest;
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function numberValue(value: unknown) {
  return Number.isSafeInteger(value) ? Number(value) : undefined;
}

function parseManifest(value: unknown): CausalIdempotencyManifest | undefined {
  if (!isRecord(value)) return undefined;
  const status = stringValue(value.status);
  if (status !== "pending" && status !== "committed" && status !== "rejected") return undefined;
  const scope = stringValue(value.scope);
  const worldId = stringValue(value.worldId);
  const commandType = stringValue(value.commandType);
  const actorRef = stringValue(value.actorRef);
  const idempotencyKey = stringValue(value.idempotencyKey);
  const inputHash = stringValue(value.inputHash);
  if (!scope || !worldId || !commandType || !actorRef || !idempotencyKey || !inputHash?.startsWith("sha256:")) {
    return undefined;
  }
  return {
    scope,
    worldId,
    commandType,
    actorRef,
    idempotencyKey,
    inputHash: inputHash as `sha256:${string}`,
    status,
    eventIds: Array.isArray(value.eventIds) ? value.eventIds.filter((entry): entry is string => typeof entry === "string") : [],
    ...(stringValue(value.rejectionCode) ? { rejectionCode: stringValue(value.rejectionCode) } : {}),
    ...(stringValue(value.scheduledKey) ? { scheduledKey: stringValue(value.scheduledKey) } : {}),
    ...(stringValue(value.createdAt) ? { createdAt: stringValue(value.createdAt) } : {}),
    ...(stringValue(value.ownerId) ? { ownerId: stringValue(value.ownerId) } : {}),
    ...(numberValue(value.fencingToken) !== undefined ? { fencingToken: numberValue(value.fencingToken) } : {}),
    ...(stringValue(value.leaseExpiresAt) ? { leaseExpiresAt: stringValue(value.leaseExpiresAt) } : {}),
    ...(stringValue(value.updatedAt) ? { updatedAt: stringValue(value.updatedAt) } : {}),
  };
}

function parseRecord(value: unknown): CausalIdempotencyRecord | undefined {
  if (!isRecord(value) || value.type !== "causal_idempotency_manifest") return undefined;
  const manifest = parseManifest(value.manifest);
  return manifest ? { type: "causal_idempotency_manifest", manifest } : undefined;
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function withJsonlLock<T>(targetDataDir: string, task: () => Promise<T>): Promise<T> {
  const lockDir = join(targetDataDir, `${IDEMPOTENCY_FILE}.lock`);
  await mkdir(targetDataDir, { recursive: true });
  const deadline = Date.now() + LOCK_TIMEOUT_MS;
  while (true) {
    try {
      await mkdir(lockDir);
      break;
    } catch (error) {
      if (!error || typeof error !== "object" || !("code" in error) || error.code !== "EEXIST" || Date.now() >= deadline) {
        throw error;
      }
      await sleep(LOCK_RETRY_MS);
    }
  }
  try {
    return await task();
  } finally {
    await rm(lockDir, { recursive: true, force: true });
  }
}

async function readManifestLog(targetDataDir: string) {
  try {
    const raw = await readFile(join(targetDataDir, IDEMPOTENCY_FILE), "utf8");
    return raw
      .split("\n")
      .filter(Boolean)
      .map((line) => parseRecord(JSON.parse(line) as unknown))
      .filter((record): record is CausalIdempotencyRecord => Boolean(record));
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return [];
    throw error;
  }
}

async function appendManifest(targetDataDir: string, manifest: CausalIdempotencyManifest) {
  await appendFile(
    join(targetDataDir, IDEMPOTENCY_FILE),
    `${JSON.stringify({ type: "causal_idempotency_manifest", manifest })}\n`,
    "utf8",
  );
}

async function recoverLatestManifest(targetDataDir: string, scope: string) {
  const records = await readManifestLog(targetDataDir);
  return records.filter((record) => record.manifest.scope === scope).at(-1)?.manifest;
}

function claimFromExisting(
  existing: CausalIdempotencyManifest,
  input: CausalIdempotencyInput,
  options: { readonly ownerId: string; readonly now: string; readonly leaseExpiresAt: string },
): CausalIdempotencyClaimResult {
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
    return { kind: "reserved", reservation: { manifest } };
  }
  if (existing.status === "pending") return { kind: "pending", manifest: existing };
  return { kind: existing.status, manifest: existing };
}

export function createJsonlCausalIdempotencyManifestStore(
  targetDataDir: string,
): CausalIdempotencyManifestStore {
  return {
    read(scope) {
      return recoverLatestManifest(targetDataDir, scope);
    },
    write(manifest) {
      return withJsonlLock(targetDataDir, async () => {
        const existing = await recoverLatestManifest(targetDataDir, manifest.scope);
        if (existing && existing.status === "pending" && manifest.status !== "pending") {
          assertCausalReservationFinalization({ manifest: existing as CausalIdempotencyReservation["manifest"] }, existing, manifest);
        } else if (existing) {
          if (existing.scope !== manifest.scope || existing.inputHash !== manifest.inputHash) {
            throw new Error("causal_idempotency_input_hash_conflict");
          }
        }
        await appendManifest(targetDataDir, manifest);
      });
    },
    putIfAbsent(manifest) {
      return withJsonlLock(targetDataDir, async () => {
        const existing = await recoverLatestManifest(targetDataDir, manifest.scope);
        if (existing) return existing;
        await appendManifest(targetDataDir, manifest);
        return undefined;
      });
    },
    claimReservation(input, options) {
      return withJsonlLock(targetDataDir, async () => {
        const scope = causalIdempotencyScope(input);
        const existing = await recoverLatestManifest(targetDataDir, scope);
        if (existing) {
          const claim = claimFromExisting(existing, input, options);
          if (claim.kind === "reserved") await appendManifest(targetDataDir, claim.reservation.manifest);
          return claim;
        }
        const manifest = pendingCausalManifest({
          ...input,
          ownerId: options.ownerId,
          fencingToken: 1,
          leaseExpiresAt: options.leaseExpiresAt,
          createdAt: options.now,
          updatedAt: options.now,
        });
        await appendManifest(targetDataDir, manifest);
        return { kind: "reserved", reservation: { manifest } };
      });
    },
    finalizeReservation(reservation, manifest) {
      return withJsonlLock(targetDataDir, async () => {
        const existing = await recoverLatestManifest(targetDataDir, reservation.manifest.scope);
        const finalized = assertCausalReservationFinalization(reservation, existing, manifest);
        await appendManifest(targetDataDir, finalized);
        return finalized;
      });
    },
    commitAtomically(reservation, manifest, commit) {
      return withJsonlLock(targetDataDir, async () => {
        const existing = await recoverLatestManifest(targetDataDir, reservation.manifest.scope);
        const finalized = assertCausalReservationFinalization(reservation, existing, manifest);
        await commit({});
        await appendManifest(targetDataDir, finalized);
        return finalized;
      });
    },
  };
}
