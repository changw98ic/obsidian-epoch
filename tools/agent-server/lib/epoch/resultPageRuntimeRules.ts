import type {
  EpochDeletedResultPageMinimalReference,
  EpochDeletionRequestClassification,
  EpochPublicSafeSummary,
  EpochPublicSafeSummaryExcludedSourceClass,
  EpochResultPageAccessResult,
  EpochResultPageDeletionSummary,
  EpochResultPagePayload,
  EpochResultPageReceipt,
  EpochSharedResultPage,
} from "./runtime.ts";
import { resolveEpochCanonicalRegionId } from "../regionAliases.ts";
import { type EpochHostedSession, type EpochTurnCard } from "./gameCore.ts";
import { type EpochProgressView } from "./progressReadModel.ts";
import { hashValuesMatch, sha256Hex } from "./runtimeAuth.ts";

export const DEFAULT_RESULT_PAGE_TTL_MS = 24 * 60 * 60 * 1000;

export const DELETED_RESULT_PAGE_REMOVED_BODY_CLASSES = [
  "result_page_payload",
  "public_safe_summary_text",
  "progress_snapshot",
  "regional_context",
  "event_bodies",
  "long_summaries",
] as const;

export function stableResultPageJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => entry === undefined
      || typeof entry === "function"
      || typeof entry === "symbol"
      ? "null"
      : stableResultPageJson(entry)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined && typeof entry !== "function" && typeof entry !== "symbol")
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableResultPageJson(entry)}`)
      .join(",")}}`;
  }
  const serialized = JSON.stringify(value);
  return serialized === undefined ? "null" : serialized;
}

export function storedResultPageShareVersion(page: EpochSharedResultPage) {
  if (typeof page.shareVersion === "undefined") return 1;
  if (!Number.isSafeInteger(page.shareVersion) || page.shareVersion < 1) {
    throw new Error("result_page_revision_invalid");
  }
  return page.shareVersion;
}

export const RESULT_PAGE_PUBLIC_SAFE_EXCLUDED_SOURCE_CLASSES: readonly EpochPublicSafeSummaryExcludedSourceClass[] = [
  "adjudication_verdict",
  "review_reason",
  "hidden_constraint_prompt",
  "event_payload_body",
];

function optionalTrimmedString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function publicSafeSummaryLabel(value: string | undefined, fallback: string) {
  const cleaned = (value || fallback)
    .replace(/region_gray_harbor/g, "灰港")
    .replace(/region_salt_mirror/g, "盐镜")
    .replace(/region_ash_outpost/g, "灰烬哨站")
    .replace(/region_glass_archive/g, "玻璃档案馆")
    .replace(/region_moonwell_hollow/g, "月井空壳")
    .replace(/未公开约束冲突|修正台原因|隐藏约束提示|审档判词|hidden_constraint_prompt|hidden constraint prompt/g, "公开摘要")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.slice(0, 80) || fallback;
}

export function resultPagePublicSafeSummary(input: {
  readonly progress: EpochProgressView;
  readonly regionId?: string;
  readonly focusTurnCard?: EpochTurnCard;
  readonly focusHostedSession?: EpochHostedSession;
}): EpochPublicSafeSummary {
  const identity = input.progress.identity || input.progress.identities.at(-1);
  const identityLabel = publicSafeSummaryLabel(
    identity?.identityName || identity?.agentId || input.progress.agentId || input.progress.explorerId,
    "未命名探索者",
  );
  const focusLabel = input.focusTurnCard
    ? "探索节点"
    : input.focusHostedSession
      ? "托管历程"
      : "探索历程";
  const regionLabel = input.regionId
    ? publicSafeSummaryLabel(input.regionId, "未知区域")
    : "";
  const scopeLabel = regionLabel ? `${regionLabel}${focusLabel}` : focusLabel;
  return {
    summaryType: "public_safe_summary",
    source: "server_public_summary",
    text: `${identityLabel} · ${scopeLabel}已整理为可分享摘要。`,
    excludedSourceClasses: RESULT_PAGE_PUBLIC_SAFE_EXCLUDED_SOURCE_CLASSES,
  };
}

export function resultPagePublicPages(progress: EpochProgressView) {
  const identity = progress.identity || progress.identities.at(-1);
  const agentId = progress.agentId || identity?.agentId;
  const explorerId = progress.explorerId || identity?.explorerId;
  return {
    world: "/epoch/world",
    console: "/epoch/console",
    ...(agentId ? { agent: `/epoch/agent/${encodeURIComponent(agentId)}` } : {}),
    ...(explorerId ? { explorer: `/epoch/explorer/${encodeURIComponent(explorerId)}` } : {}),
  };
}

export function focusedResultPageProgress(
  progress: EpochProgressView,
  input: Readonly<Record<string, unknown>>,
): EpochProgressView {
  if (!Array.isArray(input.focusEventIds)) return progress;
  const focusEventIds = new Set(input.focusEventIds
    .filter((eventId): eventId is string => typeof eventId === "string" && eventId.trim().length > 0));
  if (!focusEventIds.size) return progress;
  return {
    ...progress,
    latestEvents: progress.latestEvents.filter((event) => focusEventIds.has(event.eventId)),
  };
}

export function resultPageRequestHash(input: Readonly<Record<string, unknown>> = {}) {
  const turnCardId = optionalTrimmedString(input.turnCardId) || optionalTrimmedString(input.focusTurnCardId);
  const hostedSessionId = optionalTrimmedString(input.hostedSessionId) || optionalTrimmedString(input.focusHostedSessionId);
  const regionId = optionalTrimmedString(input.regionId);
  return sha256Hex(stableResultPageJson({
    agentId: optionalTrimmedString(input.agentId),
    explorerId: optionalTrimmedString(input.explorerId),
    hostedSessionId,
    limit: Number(input.limit || 30),
    regionId: regionId ? resolveEpochCanonicalRegionId(regionId) : undefined,
    turnCardId,
  }));
}

export function resultPageShareTokenHash(token: string) {
  return `sha256:${sha256Hex(token)}`;
}

export function resultPageUrlPath(pageId: string, shareToken: string, shareVersion: number) {
  return `/epoch/result/${encodeURIComponent(pageId)}?shareToken=${encodeURIComponent(shareToken)}&shareVersion=${shareVersion}`;
}

export function resultPageStatusUrlPath(pageId: string, shareVersion: number) {
  return `/epoch/result/${encodeURIComponent(pageId)}?shareVersion=${shareVersion}`;
}

export function resultPageShareVersion(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return /^\d+$/.test(trimmed) ? Number(trimmed) : Number.NaN;
}

export function resultPageExpiresAt(createdAt: string) {
  return new Date(new Date(createdAt).getTime() + DEFAULT_RESULT_PAGE_TTL_MS).toISOString();
}

function requiredResultPageIdempotencyValue(input: Readonly<Record<string, unknown>>) {
  if (typeof input.idempotencyKey !== "string" || input.idempotencyKey.trim().length === 0) {
    throw new Error("idempotency_key_required");
  }
  return input.idempotencyKey.trim();
}

export function resultPageCreateIdempotencyKey(input: Readonly<Record<string, unknown>>) {
  return `result_page:${requiredResultPageIdempotencyValue(input)}`;
}

export function resultPageRevokeIdempotencyKey(input: Readonly<Record<string, unknown>>) {
  return `result_page_revoke:${requiredResultPageIdempotencyValue(input)}`;
}

export function resultPageDeleteIdempotencyKey(input: Readonly<Record<string, unknown>>) {
  return `result_page_delete:${requiredResultPageIdempotencyValue(input)}`;
}

export function resultPageCreateSeed(
  payload: EpochResultPagePayload,
  input: Readonly<Record<string, unknown>>,
) {
  const idempotencySeed = typeof input.idempotencyKey === "string"
    ? input.idempotencyKey
    : requiredResultPageIdempotencyValue(input);
  return `${payload.progress.agentId || payload.progress.explorerId}:${idempotencySeed}`;
}

export function resultPageCreatedBy(
  input: Readonly<Record<string, unknown>>,
  payload: EpochResultPagePayload,
) {
  return String(input.actorExplorerId || input.explorerId || payload.progress.explorerId || "system");
}

function resultPageMutationReason(input: Readonly<Record<string, unknown>>, fallback: string) {
  return typeof input.reason === "string" && input.reason.trim()
    ? input.reason.trim().slice(0, 160)
    : fallback;
}

export function resultPageActiveRecord(input: {
  readonly request: Readonly<Record<string, unknown>>;
  readonly payload: EpochResultPagePayload;
  readonly pageId: string;
  readonly shareToken: string;
  readonly createdAt: string;
}): EpochSharedResultPage {
  if (!input.payload.progress.identity && !input.payload.progress.identities.length) {
    throw new Error("result_page_identity_required");
  }
  const shareVersion = 1;
  const expiresAt = input.payload.journey?.status === "settled"
    ? undefined
    : resultPageExpiresAt(input.createdAt);
  return {
    pageId: input.pageId,
    createdAt: input.createdAt,
    ...(expiresAt ? { expiresAt } : {}),
    urlPath: resultPageUrlPath(input.pageId, input.shareToken, shareVersion),
    payload: input.payload,
    publicSafeSummary: input.payload.publicSafeSummary,
    createdBy: resultPageCreatedBy(input.request, input.payload),
    idempotencyKey: resultPageCreateIdempotencyKey(input.request),
    idempotencySubjectHash: resultPageRequestHash(input.request),
    status: "active",
    shareVersion,
    shareTokenHash: resultPageShareTokenHash(input.shareToken),
  };
}

export function resultPageRevokedRecord(input: {
  readonly page: EpochSharedResultPage;
  readonly request: Readonly<Record<string, unknown>>;
  readonly revokedAt: string;
  readonly revokedBy: string;
}): EpochSharedResultPage {
  const nextShareVersion = storedResultPageShareVersion(input.page) + 1;
  const {
    lifecycleIdempotencyKey: _previousLifecycleIdempotencyKey,
    shareTokenHash: _shareTokenHash,
    ...page
  } = input.page;
  return {
    ...page,
    urlPath: resultPageStatusUrlPath(input.page.pageId, nextShareVersion),
    lifecycleIdempotencyKey: resultPageRevokeIdempotencyKey(input.request),
    status: "revoked",
    shareVersion: nextShareVersion,
    revokedAt: input.revokedAt,
    revokedBy: input.revokedBy,
    revokeReason: resultPageMutationReason(input.request, "owner_revoked"),
  };
}

export function resultPageDeletedRecord(input: {
  readonly page: EpochSharedResultPage;
  readonly request: Readonly<Record<string, unknown>>;
  readonly deletedAt: string;
  readonly deletedBy: string;
  readonly deletionSummary: EpochResultPageDeletionSummary;
}): EpochSharedResultPage {
  const nextShareVersion = storedResultPageShareVersion(input.page) + 1;
  return {
    pageId: input.page.pageId,
    createdAt: input.page.createdAt,
    ...(input.page.expiresAt ? { expiresAt: input.page.expiresAt } : {}),
    urlPath: resultPageStatusUrlPath(input.page.pageId, nextShareVersion),
    createdBy: input.page.createdBy,
    idempotencyKey: input.page.idempotencyKey,
    ...(input.page.idempotencySubjectHash
      ? { idempotencySubjectHash: input.page.idempotencySubjectHash }
      : {}),
    lifecycleIdempotencyKey: resultPageDeleteIdempotencyKey(input.request),
    status: "deleted",
    shareVersion: nextShareVersion,
    ...(input.page.revokedAt ? { revokedAt: input.page.revokedAt } : {}),
    ...(input.page.revokedBy ? { revokedBy: input.page.revokedBy } : {}),
    ...(input.page.revokeReason ? { revokeReason: input.page.revokeReason } : {}),
    deletedAt: input.deletedAt,
    deletedBy: input.deletedBy,
    deleteReason: resultPageMutationReason(input.request, "owner_deleted"),
    deletionSummary: input.deletionSummary,
  };
}

export function resultPageIsExpired(page: EpochSharedResultPage, nowMs: number) {
  return Boolean(page.expiresAt && Date.parse(page.expiresAt) <= nowMs);
}

export function resultPageAccessResult(
  page: EpochSharedResultPage | undefined,
  input: Readonly<Record<string, unknown>> = {},
  nowMs: number,
): EpochResultPageAccessResult {
  if (!page) return { status: "missing", statusCode: 404 };
  const status = page.status ?? "active";
  if (status === "deleted") {
    return { status: "deleted", statusCode: 410, page };
  }
  if (status === "revoked") {
    return { status: "revoked", statusCode: 410, page };
  }
  if (!page.payload) return { status: "deleted", statusCode: 410, page };
  if (!page.shareTokenHash) {
    if (resultPageIsExpired(page, nowMs)) return { status: "expired", statusCode: 410, page };
    return { status: "available", statusCode: 200, page };
  }
  const shareToken = optionalTrimmedString(input.shareToken) || "";
  if (!shareToken) return { status: "share_token_required", statusCode: 403, page };
  if (!hashValuesMatch(page.shareTokenHash, resultPageShareTokenHash(shareToken))) {
    return { status: "share_token_mismatch", statusCode: 403, page };
  }
  const requestedShareVersion = resultPageShareVersion(input.shareVersion);
  if (typeof requestedShareVersion === "undefined") {
    return { status: "share_version_required", statusCode: 403, page };
  }
  const currentShareVersion = storedResultPageShareVersion(page);
  if (!Number.isSafeInteger(requestedShareVersion) || requestedShareVersion !== currentShareVersion) {
    return { status: "share_version_mismatch", statusCode: 403, page };
  }
  if (resultPageIsExpired(page, nowMs)) return { status: "expired", statusCode: 410, page };
  return { status: "available", statusCode: 200, page };
}

export function resultPagePayloadOwnerExplorerId(payload: EpochResultPagePayload) {
  return payload.progress.explorerId
    || payload.progress.identity?.explorerId
    || payload.progress.identities.find((identity) => identity.explorerId)?.explorerId
    || "";
}

export function resultPagePayloadAgentId(payload: EpochResultPagePayload) {
  return payload.progress.agentId
    || payload.progress.identity?.agentId
    || payload.progress.identities.find((identity) => identity.agentId)?.agentId
    || "";
}

export function resultPageOwnerExplorerId(page: EpochSharedResultPage) {
  return page.payload
    ? resultPagePayloadOwnerExplorerId(page.payload)
    : page.deletionSummary?.ownerExplorerId || "";
}

export function resultPageDeletionRequestClassification(): EpochDeletionRequestClassification {
  return {
    selectedCategory: "hide_body",
    selectedLabel: "隐藏正文",
    categories: [
      {
        category: "hide_body",
        label: "隐藏正文",
        status: "completed",
        summary: "已删除公开结果页正文，只保留哈希、所有者和最小审计事实。",
      },
      {
        category: "anonymize_source",
        label: "匿名化来源",
        status: "available",
        summary: "可单独申请隐藏或匿名化公开来源标识，但不删除已经入档的共享设定。",
      },
      {
        category: "withdraw_unadmitted_candidate",
        label: "撤回未入档候选",
        status: "not_applicable",
        summary: "本结果页删除不包含未入档候选；未入档候选可在入档前撤回。",
      },
      {
        category: "request_de_admission_review",
        label: "申请退档复审",
        status: "review_required",
        summary: "已被多人引用的共享设定只能申请退档复审，不能随公开正文删除一并删除。",
      },
    ],
    sharedSettingRule: {
      referencedByMultiple: "request_de_admission_review_only",
      summary: "已被多人引用的共享设定只能申请退档复审。",
    },
  };
}

export function resultPageDeletedMinimalReference(
  page: EpochSharedResultPage,
  receipt: EpochResultPageReceipt,
  ownerExplorerId: string,
): EpochDeletedResultPageMinimalReference {
  const focusId = String(receipt.focus.id || "");
  const anonymousSourceHash = `anon:sha256:${sha256Hex([
    ownerExplorerId,
    receipt.agentId || "",
    receipt.explorerId || "",
    page.pageId,
  ].join("\u001f"))}`;
  return {
    referenceType: "deleted_result_page_minimal_reference",
    anonymousSourceHash,
    claimFacts: [
      { key: "pageId", value: page.pageId },
      { key: "focusKind", value: receipt.focus.kind },
      { key: "focusIdHash", value: `sha256:${sha256Hex(focusId)}` },
      { key: "canonicalEventCount", value: receipt.canonicalEvents.length },
    ],
    removedBodyClasses: DELETED_RESULT_PAGE_REMOVED_BODY_CLASSES,
  };
}

export function resultPageDeletionSummary(
  page: EpochSharedResultPage,
  deletedAt: string,
  deletedBy: string,
  deleteReason: string,
): EpochResultPageDeletionSummary {
  if (!page.payload) {
    if (!page.deletionSummary) throw new Error("result_page_payload_missing");
    return {
      ...page.deletionSummary,
      deletionRequest: page.deletionSummary.deletionRequest || resultPageDeletionRequestClassification(),
    };
  }
  const receipt = page.payload.receipt;
  const ownerExplorerId = resultPagePayloadOwnerExplorerId(page.payload);
  return {
    pageId: page.pageId,
    createdAt: page.createdAt,
    expiresAt: page.expiresAt,
    createdBy: page.createdBy,
    ownerExplorerId,
    agentId: receipt.agentId,
    explorerId: receipt.explorerId,
    receiptFocus: receipt.focus,
    receiptPayloadHash: receipt.payloadHash,
    fullPayloadHash: `sha256:${sha256Hex(stableResultPageJson(page.payload))}`,
    canonicalEventIds: [],
    minimalReference: resultPageDeletedMinimalReference(page, receipt, ownerExplorerId),
    deletedAt,
    deletedBy,
    deleteReason,
    deletionRequest: resultPageDeletionRequestClassification(),
    retainedFacts: [
      "pageId",
      "createdAt",
      "anonymousSourceHash",
      "claimFacts",
      "receiptPayloadHash",
      "fullPayloadHash",
      "deletionRequest",
    ],
  };
}
