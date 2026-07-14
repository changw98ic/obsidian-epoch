import { randomBytes } from "node:crypto";
import { assertNonEmptyString, type EpochIdFactory } from "./protocol.ts";
import type {
  CreateEpochResultPageResult,
  EpochResultPagePayload,
  EpochSharedResultPage,
  EpochResultPageAccessResult,
} from "./runtime.ts";
import type { EpochWorldOverviewRecentResult } from "./publicWorldReadModel.ts";
import type { EpochEvent } from "./events.ts";
import { createEpochResultPageReadModel } from "./resultPageReadModel.ts";
import { assertEpochResultPagePayload } from "./resultPagePayloadRules.ts";
import {
  resultPageAccessResult,
  resultPageActiveRecord,
  resultPageCreateIdempotencyKey,
  resultPageCreateSeed,
  resultPageDeleteIdempotencyKey,
  resultPageDeletedRecord,
  resultPageDeletionSummary,
  resultPageIsExpired,
  resultPageOwnerExplorerId,
  resultPagePayloadOwnerExplorerId,
  resultPageRequestHash,
  resultPageRevokedRecord,
  resultPageRevokeIdempotencyKey,
  resultPageShareTokenHash,
  storedResultPageShareVersion,
  stableResultPageJson,
} from "./resultPageRuntimeRules.ts";

type AnyRecord = Readonly<Record<string, unknown>>;

interface StoredResultPagePublishToken {
  readonly token: string;
  readonly requestHash: string;
  readonly payload: EpochResultPagePayload;
  consumed: boolean;
}

interface RecoveredResultPageHistory {
  readonly revisions: Map<number, EpochSharedResultPage>;
  readonly idempotencyKeys: Set<string>;
}

export interface ResultPageRuntimeStore {
  readonly size: () => number;
  readonly values: () => readonly EpochSharedResultPage[];
  readonly get: (pageId: string) => EpochSharedResultPage | undefined;
  readonly createFromPayload: (
    input: AnyRecord,
    payload: EpochResultPagePayload,
  ) => CreateEpochResultPageResult;
  readonly issuePublishToken: (input: AnyRecord, payload: EpochResultPagePayload) => string;
  readonly createFromPublishToken: (input: AnyRecord) => CreateEpochResultPageResult;
  readonly getPublic: (input?: AnyRecord) => EpochResultPageAccessResult;
  readonly revoke: (input?: AnyRecord) => CreateEpochResultPageResult;
  readonly delete: (input?: AnyRecord) => CreateEpochResultPageResult;
  readonly recentResults: (input: { readonly limit: number }) => readonly EpochWorldOverviewRecentResult[];
}

export interface ResultPageRuntimeStoreOptions {
  readonly clock: () => Date;
  readonly idFactory?: EpochIdFactory;
  readonly initialPages?: readonly EpochSharedResultPage[];
  readonly assertExplorerAuth: (input: AnyRecord, explorerId: string) => void;
  readonly assertOperatorKey: (input: AnyRecord) => void;
  readonly assertCreateAllowed?: (input: AnyRecord) => void;
  readonly canonicalEpochEvents?: () => readonly EpochEvent[];
}

function issueResultPagePublishTokenValue() {
  return `epoch_result_publish_${randomBytes(16).toString("hex")}`;
}

function issueResultPageShareToken() {
  return `epoch_result_share_${randomBytes(16).toString("hex")}`;
}

function isCompleteAuditText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isCompleteAuditTime(value: unknown): value is string {
  return isCompleteAuditText(value) && Number.isFinite(Date.parse(value));
}

export function createResultPageRuntimeStore(options: ResultPageRuntimeStoreOptions): ResultPageRuntimeStore {
  const assertPage = (page: EpochSharedResultPage) => {
    if (!page || typeof page.pageId !== "string" || !page.pageId.trim()
      || typeof page.createdAt !== "string" || !Number.isFinite(Date.parse(page.createdAt))
      || typeof page.urlPath !== "string" || !page.urlPath.trim()
      || typeof page.createdBy !== "string" || !page.createdBy.trim()
      || typeof page.idempotencyKey !== "string" || !page.idempotencyKey.trim()) {
      throw new Error("result_page_record_invalid");
    }
    if (typeof page.idempotencySubjectHash !== "undefined"
      && !/^[a-f0-9]{64}$/.test(page.idempotencySubjectHash)) {
      throw new Error("result_page_idempotency_subject_invalid");
    }
    const status = typeof page.status === "undefined" ? "active" : page.status;
    if (status !== "active" && status !== "revoked" && status !== "deleted") {
      throw new Error("result_page_revision_invalid");
    }
    const shareVersion = storedResultPageShareVersion(page);
    const lifecycleIdempotencyKey = page.lifecycleIdempotencyKey;
    if (typeof lifecycleIdempotencyKey !== "undefined"
      && (!lifecycleIdempotencyKey.trim()
        || lifecycleIdempotencyKey !== lifecycleIdempotencyKey.trim()
        || (status === "revoked" && !lifecycleIdempotencyKey.startsWith("result_page_revoke:"))
        || (status === "deleted" && !lifecycleIdempotencyKey.startsWith("result_page_delete:"))
        || status === "active")) {
      throw new Error("result_page_lifecycle_idempotency_invalid");
    }
    const url = new URL(page.urlPath, "http://result-page.invalid");
    if (decodeURIComponent(url.pathname.split("/").at(-1) || "") !== page.pageId
      || Number(url.searchParams.get("shareVersion")) !== shareVersion) {
      throw new Error("result_page_revision_invalid");
    }
    if (status === "deleted") {
      if (page.payload || page.publicSafeSummary || page.shareTokenHash || url.searchParams.has("shareToken")
        || page.deletionSummary?.pageId !== page.pageId) throw new Error("result_page_revision_invalid");
      return;
    }
    if (!page.payload) throw new Error("result_page_payload_missing");
    assertEpochResultPagePayload(page.payload, options.canonicalEpochEvents?.() || []);
    if (stableResultPageJson(page.publicSafeSummary) !== stableResultPageJson(page.payload.publicSafeSummary)) {
      throw new Error("result_page_revision_invalid");
    }
    if (status === "active") {
      const shareToken = url.searchParams.get("shareToken");
      if (!shareToken || !page.shareTokenHash
        || resultPageShareTokenHash(shareToken) !== page.shareTokenHash) {
        throw new Error("result_page_revision_invalid");
      }
    } else if (status !== "revoked" || page.shareTokenHash || url.searchParams.has("shareToken")) {
      throw new Error("result_page_revision_invalid");
    }
  };
  const resultPages = createEpochResultPageReadModel(options.initialPages || [], assertPage);
  const resultPageIdempotency = new Map<string, EpochSharedResultPage>();
  const unavailableCreateHistory = new Set<string>();
  const recoveredNonCreateRevisionKeys = new Set<string>();
  const resultPageLifecycleIdempotency = new Map<string, EpochSharedResultPage>();
  const unavailableLifecycleHistory = new Set<string>();
  const canonicalRevisions = new Map<string, string>();
  const recoveredHistoryByPage = new Map<string, RecoveredResultPageHistory>();
  const resultPagePublishTokens = new Map<string, StoredResultPagePublishToken>();

  for (const page of options.initialPages || []) {
    if (!page?.pageId || !page.idempotencyKey) continue;
    const shareVersion = storedResultPageShareVersion(page);
    const revisionId = `${page.pageId}:${shareVersion}`;
    const canonicalRevision = stableResultPageJson(page);
    const existingCanonicalRevision = canonicalRevisions.get(revisionId);
    if (existingCanonicalRevision && existingCanonicalRevision !== canonicalRevision) {
      throw new Error("result_page_recovery_conflict");
    }
    canonicalRevisions.set(revisionId, canonicalRevision);
    const status = typeof page.status === "undefined" ? "active" : page.status;
    const recoveredHistory = recoveredHistoryByPage.get(page.pageId) ?? {
      revisions: new Map<number, EpochSharedResultPage>(),
      idempotencyKeys: new Set<string>(),
    };
    recoveredHistory.revisions.set(shareVersion, page);
    recoveredHistory.idempotencyKeys.add(page.idempotencyKey);
    recoveredHistoryByPage.set(page.pageId, recoveredHistory);
    if (shareVersion === 1) {
      if (!page.idempotencySubjectHash) {
        unavailableCreateHistory.add(page.idempotencyKey);
      } else {
        const existing = resultPageIdempotency.get(page.idempotencyKey);
        if (existing && existing.pageId !== page.pageId) throw new Error("result_page_idempotency_recovery_conflict");
        resultPageIdempotency.set(page.idempotencyKey, page);
      }
    } else {
      recoveredNonCreateRevisionKeys.add(page.idempotencyKey);
    }
    if ((shareVersion > 1 || status !== "active") && !page.lifecycleIdempotencyKey) {
      unavailableLifecycleHistory.add(page.pageId);
    }
    if (page.lifecycleIdempotencyKey) {
      const existing = resultPageLifecycleIdempotency.get(page.lifecycleIdempotencyKey);
      if (existing && (existing.pageId !== page.pageId
        || storedResultPageShareVersion(existing) !== storedResultPageShareVersion(page))) {
        throw new Error("result_page_lifecycle_idempotency_recovery_conflict");
      }
      resultPageLifecycleIdempotency.set(page.lifecycleIdempotencyKey, page);
    }
  }
  for (const [pageId, history] of recoveredHistoryByPage) {
    const revisions = [...history.revisions.entries()].sort(([left], [right]) => left - right);
    const createRevision = history.revisions.get(1);
    const expectedCreateKey = createRevision?.idempotencyKey;
    const expectedSubjectHash = createRevision?.idempotencySubjectHash;
    const expectedOwnerExplorerId = createRevision && resultPageOwnerExplorerId(createRevision);
    const expectedCreatedAt = createRevision?.createdAt;
    const expectedExpiresAt = createRevision?.expiresAt;
    const expectedCreatedBy = createRevision?.createdBy;
    const expectedPayload = createRevision?.payload;
    const expectedPayloadCanonical = stableResultPageJson(expectedPayload);
    const expectedPublicSafeSummaryCanonical = stableResultPageJson(createRevision?.publicSafeSummary);
    let lifecycleHistoryComplete = Boolean(createRevision
      && (createRevision.status || "active") === "active"
      && !createRevision.lifecycleIdempotencyKey
      && createRevision.idempotencySubjectHash);
    let deleted = false;
    let previousRevision: EpochSharedResultPage | undefined;
    for (let index = 0; index < revisions.length; index += 1) {
      const [shareVersion, page] = revisions[index]!;
      const status = typeof page.status === "undefined" ? "active" : page.status;
      const previousStatus = previousRevision?.status ?? "active";
      if (shareVersion !== index + 1
        || page.idempotencyKey !== expectedCreateKey
        || page.idempotencySubjectHash !== expectedSubjectHash
        || resultPageOwnerExplorerId(page) !== expectedOwnerExplorerId
        || page.createdAt !== expectedCreatedAt
        || page.expiresAt !== expectedExpiresAt
        || page.createdBy !== expectedCreatedBy) {
        lifecycleHistoryComplete = false;
      }
      if (shareVersion > 1) {
        if (!page.lifecycleIdempotencyKey || status === "active" || deleted) {
          lifecycleHistoryComplete = false;
        }
        if (status === "deleted") deleted = true;
      }
      if (status === "active" || status === "revoked") {
        if (stableResultPageJson(page.payload) !== expectedPayloadCanonical
          || stableResultPageJson(page.publicSafeSummary) !== expectedPublicSafeSummaryCanonical) {
          lifecycleHistoryComplete = false;
        }
      }
      const hasRevocationAudit = page.revokedAt !== undefined
        || page.revokedBy !== undefined
        || page.revokeReason !== undefined;
      const hasDeletionAudit = page.deletedAt !== undefined
        || page.deletedBy !== undefined
        || page.deleteReason !== undefined
        || page.deletionSummary !== undefined;
      const revokedAtMs = isCompleteAuditTime(page.revokedAt) ? Date.parse(page.revokedAt) : Number.NaN;
      const previousRevokedAtMs = isCompleteAuditTime(previousRevision?.revokedAt)
        ? Date.parse(previousRevision.revokedAt)
        : Number.NaN;
      const deletedAtMs = isCompleteAuditTime(page.deletedAt) ? Date.parse(page.deletedAt) : Number.NaN;
      const revocationAuditComplete = Number.isFinite(revokedAtMs)
        && isCompleteAuditText(page.revokedBy)
        && isCompleteAuditText(page.revokeReason)
        && revokedAtMs >= Date.parse(page.createdAt);
      if (status === "active") {
        if (hasRevocationAudit || hasDeletionAudit) lifecycleHistoryComplete = false;
      } else if (status === "revoked") {
        const revocationTimeIsMonotonic = previousStatus !== "revoked"
          || (Number.isFinite(previousRevokedAtMs) && revokedAtMs >= previousRevokedAtMs);
        if (!revocationAuditComplete || !revocationTimeIsMonotonic || hasDeletionAudit) {
          lifecycleHistoryComplete = false;
        }
      } else {
        const inheritedRevocationAuditMatches = previousStatus === "revoked"
          ? revocationAuditComplete
            && page.revokedAt === previousRevision?.revokedAt
            && page.revokedBy === previousRevision?.revokedBy
            && page.revokeReason === previousRevision?.revokeReason
          : !hasRevocationAudit;
        const deletionAuditComplete = Number.isFinite(deletedAtMs)
          && isCompleteAuditText(page.deletedBy)
          && isCompleteAuditText(page.deleteReason)
          && deletedAtMs >= Date.parse(page.createdAt)
          && inheritedRevocationAuditMatches
          && (!hasRevocationAudit || revokedAtMs <= deletedAtMs);
        const expectedDeletionSummary = createRevision
          && deletionAuditComplete
          && isCompleteAuditTime(page.deletedAt)
          && isCompleteAuditText(page.deletedBy)
          && isCompleteAuditText(page.deleteReason)
          ? resultPageDeletionSummary(createRevision, page.deletedAt, page.deletedBy, page.deleteReason)
          : undefined;
        if (!expectedPayload || !deletionAuditComplete || !expectedDeletionSummary
          || stableResultPageJson(page.deletionSummary) !== stableResultPageJson(expectedDeletionSummary)) {
          lifecycleHistoryComplete = false;
        }
      }
      previousRevision = page;
    }
    if (!lifecycleHistoryComplete) {
      unavailableLifecycleHistory.add(pageId);
      for (const idempotencyKey of history.idempotencyKeys) {
        unavailableCreateHistory.add(idempotencyKey);
      }
    }
  }
  for (const idempotencyKey of recoveredNonCreateRevisionKeys) {
    if (!resultPageIdempotency.has(idempotencyKey)) unavailableCreateHistory.add(idempotencyKey);
  }

  function existingResultPageForInput(input: AnyRecord): CreateEpochResultPageResult | null {
    const idempotencyKey = resultPageCreateIdempotencyKey(input);
    if (unavailableCreateHistory.has(idempotencyKey)) {
      throw new Error("result_page_idempotency_history_unavailable");
    }
    const page = resultPageIdempotency.get(idempotencyKey);
    if (page) {
      if (page.idempotencySubjectHash
        && page.idempotencySubjectHash !== resultPageRequestHash(input)) {
        throw new Error("result_page_idempotency_subject_conflict");
      }
      return { page, duplicate: true };
    }
    return null;
  }

  function existingLifecycleResult(
    idempotencyKey: string,
    pageId: string,
  ): CreateEpochResultPageResult | null {
    const page = resultPageLifecycleIdempotency.get(idempotencyKey);
    if (!page) return null;
    if (page.pageId !== pageId) throw new Error("result_page_idempotency_subject_conflict");
    return { page, duplicate: true };
  }

  function createFromPayload(input: AnyRecord, payload: EpochResultPagePayload): CreateEpochResultPageResult {
    const existingPage = existingResultPageForInput(input);
    if (existingPage) return existingPage;
    const idempotencyKey = resultPageCreateIdempotencyKey(input);
    const pageSeed = resultPageCreateSeed(payload, input);
    const pageId = options.idFactory
      ? options.idFactory("page", pageSeed)
      : `epoch_page_${Date.now()}`;
    const createdAt = options.clock().toISOString();
    const page = resultPageActiveRecord({
      request: input,
      payload,
      pageId,
      shareToken: issueResultPageShareToken(),
      createdAt,
    });
    resultPages.set(pageId, page);
    resultPageIdempotency.set(idempotencyKey, page);
    return { page };
  }

  function issuePublishToken(input: AnyRecord, payload: EpochResultPagePayload) {
    const token = issueResultPagePublishTokenValue();
    resultPagePublishTokens.set(token, {
      token,
      requestHash: resultPageRequestHash(input),
      payload,
      consumed: false,
    });
    return token;
  }

  function authorizeResultPageOwnerOrOperator(input: AnyRecord, page: EpochSharedResultPage) {
    if (typeof input.operatorKey === "string" && input.operatorKey.trim().length > 0) {
      options.assertOperatorKey(input);
      return "operator";
    }
    const ownerExplorerId = resultPageOwnerExplorerId(page);
    if (!ownerExplorerId) throw new Error("result_page_owner_not_found");
    options.assertExplorerAuth(input, ownerExplorerId);
    return ownerExplorerId;
  }

  function revoke(input: AnyRecord = {}): CreateEpochResultPageResult {
    const idempotencyKey = resultPageRevokeIdempotencyKey(input);
    const pageId = assertNonEmptyString(input.pageId, "result_page_id");
    const page = resultPages.get(pageId);
    if (!page) throw new Error("result_page_not_found");
    if (unavailableLifecycleHistory.has(pageId)) {
      authorizeResultPageOwnerOrOperator(input, page);
      throw new Error("result_page_idempotency_history_unavailable");
    }
    const existing = existingLifecycleResult(idempotencyKey, pageId);
    if (existing) {
      authorizeResultPageOwnerOrOperator(input, existing.page);
      return existing;
    }
    const revokedBy = authorizeResultPageOwnerOrOperator(input, page);
    if ((page.status ?? "active") === "deleted") throw new Error("result_page_already_deleted");
    const revoked = resultPageRevokedRecord({
      page,
      request: input,
      revokedAt: options.clock().toISOString(),
      revokedBy,
    });
    resultPages.set(pageId, revoked);
    resultPageLifecycleIdempotency.set(idempotencyKey, revoked);
    return { page: revoked };
  }

  function deleteResultPage(input: AnyRecord = {}): CreateEpochResultPageResult {
    const idempotencyKey = resultPageDeleteIdempotencyKey(input);
    const pageId = assertNonEmptyString(input.pageId, "result_page_id");
    const page = resultPages.get(pageId);
    if (!page) throw new Error("result_page_not_found");
    if (unavailableLifecycleHistory.has(pageId)) {
      authorizeResultPageOwnerOrOperator(input, page);
      throw new Error("result_page_idempotency_history_unavailable");
    }
    const existing = existingLifecycleResult(idempotencyKey, pageId);
    if (existing) {
      authorizeResultPageOwnerOrOperator(input, existing.page);
      return existing;
    }
    const deletedBy = authorizeResultPageOwnerOrOperator(input, page);
    if ((page.status ?? "active") === "deleted") throw new Error("result_page_already_deleted");
    const deletedAt = options.clock().toISOString();
    const deleteReason = typeof input.reason === "string" && input.reason.trim()
      ? input.reason.trim().slice(0, 160)
      : "owner_deleted";
    const deletionSummary = resultPageDeletionSummary(page, deletedAt, deletedBy, deleteReason);
    const deleted = resultPageDeletedRecord({
      page,
      request: input,
      deletedAt,
      deletedBy,
      deletionSummary,
    });
    resultPages.set(pageId, deleted);
    resultPageLifecycleIdempotency.set(idempotencyKey, deleted);
    return { page: deleted };
  }

  function consumePublishToken(input: AnyRecord): EpochResultPagePayload {
    const token = typeof input.publishToken === "string" ? input.publishToken.trim() : "";
    if (!token) throw new Error("result_page_publish_token_required");
    const stored = resultPagePublishTokens.get(token);
    if (!stored) throw new Error("result_page_publish_token_not_found");
    if (stored.consumed) throw new Error("result_page_publish_token_consumed");
    if (stored.requestHash !== resultPageRequestHash(input)) {
      throw new Error("result_page_publish_token_mismatch");
    }
    const ownerExplorerId = resultPagePayloadOwnerExplorerId(stored.payload);
    if (!ownerExplorerId) throw new Error("result_page_owner_not_found");
    options.assertExplorerAuth(input, ownerExplorerId);
    stored.consumed = true;
    return stored.payload;
  }

  return {
    size: () => resultPages.size,
    values: () => [...resultPages.values()],
    get: (pageId) => resultPages.get(pageId),
    createFromPayload,
    issuePublishToken,
    createFromPublishToken: (input) => {
      const existingPage = existingResultPageForInput(input);
      if (existingPage) {
        authorizeResultPageOwnerOrOperator(input, existingPage.page);
        return existingPage;
      }
      options.assertCreateAllowed?.(input);
      return createFromPayload(input, consumePublishToken(input));
    },
    getPublic: (input: AnyRecord = {}) => {
      const pageId = String(input.pageId || "");
      return resultPageAccessResult(resultPages.get(pageId), input, options.clock().getTime());
    },
    revoke,
    delete: deleteResultPage,
    recentResults: ({ limit }) =>
      resultPages.recentResults({
        limit,
        isExpired: (page) => resultPageIsExpired(page, options.clock().getTime()),
      }),
  };
}
