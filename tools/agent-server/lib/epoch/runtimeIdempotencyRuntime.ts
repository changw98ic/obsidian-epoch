import type { EpochEvent } from "./events.ts";
import type { EpochProjection } from "./gameCore.ts";
import {
  idempotencySubjectHash,
  ownerIdempotencyKey,
} from "./idempotencyRules.ts";
import type { EpochRuntimeResult } from "./runtimePublicProjectionRules.ts";

type AnyRecord = Record<string, unknown>;

interface EpochOwnerIdempotencyRecord {
  readonly subjectHash: string;
}

export interface RuntimeIdempotencyRuntimeOptions {
  readonly project: () => EpochProjection;
  readonly publicProjection: (projection: EpochProjection) => EpochProjection;
  readonly assertAbuseAllowed: (input: AnyRecord, options?: { readonly allowRestrictedScore?: boolean }) => void;
  readonly authorizeExplorerAction: (
    scope: string,
    input: AnyRecord,
    explorerId: string,
  ) => readonly EpochEvent[];
}

function requireIdempotencyKey(input: AnyRecord) {
  if (typeof input.idempotencyKey !== "string" || input.idempotencyKey.trim().length === 0) {
    throw new Error("idempotency_key_required");
  }
  return input.idempotencyKey.trim();
}

export function createRuntimeIdempotencyRuntime(options: RuntimeIdempotencyRuntimeOptions) {
  const idempotentResults = new Map<string, EpochRuntimeResult<unknown>>();
  const ownerIdempotencyRecords = new Map<string, EpochOwnerIdempotencyRecord>();
  const subjectIdempotencyRecords = new Map<string, EpochOwnerIdempotencyRecord>();
  const pendingAsyncResults = new Map<string, Promise<EpochRuntimeResult<unknown>>>();
  const pendingAsyncSubjectHashes = new Map<string, string>();

  function duplicateResult<TValue>(cached: EpochRuntimeResult<TValue>): EpochRuntimeResult<TValue> {
    return {
      ...cached,
      events: [],
      projection: options.publicProjection(options.project()),
      duplicate: true,
    };
  }

  function idempotently<TValue>(
    scope: string,
    input: AnyRecord,
    run: () => EpochRuntimeResult<TValue>,
    abuseOptions: { readonly allowRestrictedScore?: boolean } = {},
  ): EpochRuntimeResult<TValue> {
    const idempotencyKey = requireIdempotencyKey(input);
    const key = `${scope}:${idempotencyKey}`;
    const cached = idempotentResults.get(key) as EpochRuntimeResult<TValue> | undefined;
    if (cached) return duplicateResult(cached);
    options.assertAbuseAllowed(input, abuseOptions);
    const result = run();
    idempotentResults.set(key, result);
    return result;
  }

  function idempotentlyWithSubject<TValue>(
    scope: string,
    input: AnyRecord,
    subjectOwner: string,
    run: () => EpochRuntimeResult<TValue>,
    abuseOptions: { readonly allowRestrictedScore?: boolean } = {},
  ): EpochRuntimeResult<TValue> {
    const idempotencyKey = requireIdempotencyKey(input);
    const key = `${scope}:${idempotencyKey}`;
    const subjectHash = idempotencySubjectHash(scope, subjectOwner, input);
    const cached = idempotentResults.get(key) as EpochRuntimeResult<TValue> | undefined;
    if (cached) {
      const record = subjectIdempotencyRecords.get(key);
      if (!record || record.subjectHash !== subjectHash) {
        throw new Error("idempotency_key_conflict");
      }
      return duplicateResult(cached);
    }
    options.assertAbuseAllowed(input, abuseOptions);
    const result = run();
    idempotentResults.set(key, result);
    subjectIdempotencyRecords.set(key, { subjectHash });
    return result;
  }

  function idempotentlyForExplorerRegistration<TValue>(
    scope: string,
    input: AnyRecord,
    explorerId: string,
    run: () => EpochRuntimeResult<TValue>,
  ): EpochRuntimeResult<TValue> {
    const idempotencyKey = requireIdempotencyKey(input);
    const key = ownerIdempotencyKey(scope, explorerId, idempotencyKey);
    const subjectHash = idempotencySubjectHash(scope, explorerId, input);
    const cached = idempotentResults.get(key) as EpochRuntimeResult<TValue> | undefined;
    if (cached) {
      const record = ownerIdempotencyRecords.get(key);
      if (!record || record.subjectHash !== subjectHash) {
        throw new Error("idempotency_key_conflict");
      }
      return duplicateResult(cached);
    }
    options.assertAbuseAllowed(input, { allowRestrictedScore: true });
    const result = run();
    idempotentResults.set(key, result);
    ownerIdempotencyRecords.set(key, { subjectHash });
    return result;
  }

  function idempotentlyAfterExplorerAuth<TValue>(
    scope: string,
    input: AnyRecord,
    explorerId: string,
    run: () => EpochRuntimeResult<TValue>,
    authOptions: { readonly allowRestrictedScore?: boolean } = {},
  ): EpochRuntimeResult<TValue> {
    const idempotencyKey = requireIdempotencyKey(input);
    const authorizationEvents = options.authorizeExplorerAction(scope, input, explorerId);
    const key = ownerIdempotencyKey(scope, explorerId, idempotencyKey);
    const subjectHash = idempotencySubjectHash(scope, explorerId, input);
    const cached = idempotentResults.get(key) as EpochRuntimeResult<TValue> | undefined;
    if (cached) {
      const record = ownerIdempotencyRecords.get(key);
      if (!record || record.subjectHash !== subjectHash) {
        throw new Error("idempotency_key_conflict");
      }
      return duplicateResult(cached);
    }
    const allowRestrictedScore = authOptions.allowRestrictedScore ?? true;
    options.assertAbuseAllowed(input, { allowRestrictedScore });
    const result = run();
    const authorizedResult = authorizationEvents.length
      ? { ...result, events: [...authorizationEvents, ...result.events] }
      : result;
    idempotentResults.set(key, authorizedResult);
    ownerIdempotencyRecords.set(key, { subjectHash });
    return authorizedResult;
  }

  /**
   * Async equivalent for server-side model-backed commands. The in-flight
   * promise is keyed before the model call begins, so retries cannot invoke a
   * second completion for the same idempotency key while the first is pending.
   */
  async function idempotentlyAfterExplorerAuthAsync<TValue>(
    scope: string,
    input: AnyRecord,
    explorerId: string,
    run: () => Promise<EpochRuntimeResult<TValue>>,
    authOptions: { readonly allowRestrictedScore?: boolean } = {},
  ): Promise<EpochRuntimeResult<TValue>> {
    const idempotencyKey = requireIdempotencyKey(input);
    const authorizationEvents = options.authorizeExplorerAction(scope, input, explorerId);
    const key = ownerIdempotencyKey(scope, explorerId, idempotencyKey);
    const subjectHash = idempotencySubjectHash(scope, explorerId, input);
    const cached = idempotentResults.get(key) as EpochRuntimeResult<TValue> | undefined;
    if (cached) {
      const record = ownerIdempotencyRecords.get(key);
      if (!record || record.subjectHash !== subjectHash) {
        throw new Error("idempotency_key_conflict");
      }
      return duplicateResult(cached);
    }
    const pendingSubjectHash = pendingAsyncSubjectHashes.get(key);
    if (pendingSubjectHash && pendingSubjectHash !== subjectHash) {
      throw new Error("idempotency_key_conflict");
    }
    const pending = pendingAsyncResults.get(key);
    if (pending) {
      const result = await pending as EpochRuntimeResult<TValue>;
      return duplicateResult(result);
    }

    const allowRestrictedScore = authOptions.allowRestrictedScore ?? true;
    options.assertAbuseAllowed(input, { allowRestrictedScore });
    pendingAsyncSubjectHashes.set(key, subjectHash);
    const operation = (async () => {
      const result = await run();
      const authorizedResult = authorizationEvents.length
        ? { ...result, events: [...authorizationEvents, ...result.events] }
        : result;
      idempotentResults.set(key, authorizedResult);
      ownerIdempotencyRecords.set(key, { subjectHash });
      return authorizedResult;
    })();
    pendingAsyncResults.set(key, operation as Promise<EpochRuntimeResult<unknown>>);
    try {
      return await operation;
    } finally {
      if (pendingAsyncResults.get(key) === operation) pendingAsyncResults.delete(key);
      if (pendingAsyncSubjectHashes.get(key) === subjectHash) pendingAsyncSubjectHashes.delete(key);
    }
  }

  return {
    idempotently,
    idempotentlyWithSubject,
    idempotentlyForExplorerRegistration,
    idempotentlyAfterExplorerAuth,
    idempotentlyAfterExplorerAuthAsync,
  };
}
