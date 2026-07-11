import { randomBytes } from "node:crypto";
import { assertNonEmptyString, type EpochIdFactory } from "./protocol.ts";
import type {
  CreateEpochResultPageResult,
  EpochResultPagePayload,
  EpochSharedResultPage,
  EpochResultPageAccessResult,
} from "./runtime.ts";
import type { EpochWorldOverviewRecentResult } from "./publicWorldReadModel.ts";
import { createEpochResultPageReadModel } from "./resultPageReadModel.ts";
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
} from "./resultPageRuntimeRules.ts";

type AnyRecord = Readonly<Record<string, unknown>>;

interface StoredResultPagePublishToken {
  readonly token: string;
  readonly requestHash: string;
  readonly payload: EpochResultPagePayload;
  consumed: boolean;
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
}

function issueResultPagePublishTokenValue() {
  return `epoch_result_publish_${randomBytes(16).toString("hex")}`;
}

function issueResultPageShareToken() {
  return `epoch_result_share_${randomBytes(16).toString("hex")}`;
}

export function createResultPageRuntimeStore(options: ResultPageRuntimeStoreOptions): ResultPageRuntimeStore {
  const resultPages = createEpochResultPageReadModel(options.initialPages || []);
  const resultPageIdempotency = new Map<string, string>();
  const resultPageRevokeIdempotency = new Map<string, string>();
  const resultPageDeleteIdempotency = new Map<string, string>();
  const resultPagePublishTokens = new Map<string, StoredResultPagePublishToken>();

  for (const page of options.initialPages || []) {
    if (page?.pageId && page.idempotencyKey) {
      resultPageIdempotency.set(page.idempotencyKey, page.pageId);
    }
  }

  function existingResultPageForInput(input: AnyRecord): CreateEpochResultPageResult | null {
    const idempotencyKey = resultPageCreateIdempotencyKey(input);
    const existingPageId = resultPageIdempotency.get(idempotencyKey);
    if (!existingPageId) return null;
    const page = resultPages.get(existingPageId);
    if (!page) throw new Error("result_page_not_found");
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
    resultPageIdempotency.set(idempotencyKey, pageId);
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

  function authorizeRevocation(input: AnyRecord, page: EpochSharedResultPage) {
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
    const existingPageId = resultPageRevokeIdempotency.get(idempotencyKey);
    if (existingPageId) {
      const existing = resultPages.get(existingPageId);
      if (!existing) throw new Error("result_page_not_found");
      return { page: existing, duplicate: true };
    }
    const revokedBy = authorizeRevocation(input, page);
    const revoked = resultPageRevokedRecord({
      page,
      request: input,
      revokedAt: options.clock().toISOString(),
      revokedBy,
    });
    resultPages.set(pageId, revoked);
    resultPageRevokeIdempotency.set(idempotencyKey, pageId);
    return { page: revoked };
  }

  function deleteResultPage(input: AnyRecord = {}): CreateEpochResultPageResult {
    const idempotencyKey = resultPageDeleteIdempotencyKey(input);
    const pageId = assertNonEmptyString(input.pageId, "result_page_id");
    const page = resultPages.get(pageId);
    if (!page) throw new Error("result_page_not_found");
    const existingPageId = resultPageDeleteIdempotency.get(idempotencyKey);
    if (existingPageId) {
      const existing = resultPages.get(existingPageId);
      if (!existing) throw new Error("result_page_not_found");
      return { page: existing, duplicate: true };
    }
    const deletedBy = authorizeRevocation(input, page);
    if ((page.status || "active") === "deleted") {
      resultPageDeleteIdempotency.set(idempotencyKey, pageId);
      return { page, duplicate: true };
    }
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
    resultPageDeleteIdempotency.set(idempotencyKey, pageId);
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
      if (existingPage) return existingPage;
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
