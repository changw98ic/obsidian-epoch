import assert from "node:assert/strict";
import test from "node:test";
import {
  DELETED_RESULT_PAGE_REMOVED_BODY_CLASSES,
  focusedResultPageProgress,
  publicSafeSummaryLabel,
  resultPageDeletedMinimalReference,
  resultPageDeletedRecord,
  resultPageActiveRecord,
  resultPageCreateIdempotencyKey,
  resultPageCreateSeed,
  resultPageDeleteIdempotencyKey,
  resultPageDeletionRequestClassification,
  resultPageDeletionSummary,
  resultPageAccessResult,
  resultPageExpiresAt,
  resultPageIsExpired,
  resultPageOwnerExplorerId,
  resultPagePayloadOwnerExplorerId,
  resultPagePublicPages,
  resultPagePublicSafeSummary,
  resultPageRequestHash,
  resultPageRevokedRecord,
  resultPageRevokeIdempotencyKey,
  resultPageShareTokenHash,
  resultPageShareVersion,
  resultPageStatusUrlPath,
  resultPageUrlPath,
  stableResultPageJson,
} from "../lib/epoch/resultPageRuntimeRules.ts";
import { sha256Hex } from "../lib/epoch/runtimeAuth.ts";
import {
  type EpochResultPageDeletionSummary,
  type EpochResultPagePayload,
  type EpochResultPageReceipt,
  type EpochSharedResultPage,
} from "../lib/epoch/runtime.ts";

function receipt(overrides: Partial<EpochResultPageReceipt> = {}): EpochResultPageReceipt {
  return {
    receiptType: "server_result_receipt",
    payloadHash: "sha256:payload_hash",
    generatedAt: "2026-07-06T00:00:00.000Z",
    channelClass: "T1_agent_private",
    deliveryTrust: "trusted_server",
    playMode: "ranked",
    trustTier: "server_settled",
    agentId: "agent_1",
    explorerId: "explorer_receipt",
    focus: { kind: "turn_card", id: "turn_card_1" },
    trustClasses: ["T1_agent_private"],
    trustedExecution: [],
    canonicalEvents: [
      {
        eventId: "epoch_event_1",
        eventType: "turn_resolved",
        aggregateType: "agent",
        aggregateId: "agent_1",
        trustClass: "T1_agent_private",
        createdAt: "2026-07-06T00:01:00.000Z",
        auditUrl: "/epoch/audit/epoch_event_1",
      },
    ],
    ...overrides,
  } as EpochResultPageReceipt;
}

function payload(overrides: Partial<EpochResultPagePayload> = {}): EpochResultPagePayload {
  return {
    pageType: "agent_result",
    generatedAt: "2026-07-06T00:00:00.000Z",
    publicSafeSummary: {
      summaryType: "public_safe_summary",
      source: "server_public_summary",
      text: "灰港探索完成。",
      excludedSourceClasses: [],
    },
    progress: {
      agentId: "agent_1",
      explorerId: "explorer_progress",
      identity: { agentId: "agent_1", explorerId: "explorer_identity", identityName: "调查员" },
      identities: [{ agentId: "agent_1", explorerId: "explorer_list", identityName: "调查员" }],
      resources: {},
      latestEvents: [],
    },
    nextActions: [],
    receipt: receipt(),
    ...overrides,
  } as EpochResultPagePayload;
}

function page(overrides: Partial<EpochSharedResultPage> = {}): EpochSharedResultPage {
  return {
    pageId: "epoch_page_1",
    createdAt: "2026-07-06T00:00:00.000Z",
    expiresAt: "2026-07-07T00:00:00.000Z",
    urlPath: "/epoch/result/epoch_page_1",
    payload: payload(),
    publicSafeSummary: {
      summaryType: "public_safe_summary",
      source: "server_public_summary",
      text: "灰港探索完成。",
      excludedSourceClasses: [],
    },
    createdBy: "explorer_receipt",
    idempotencyKey: "result_page:test",
    status: "active",
    shareVersion: 1,
    shareTokenHash: resultPageShareTokenHash("share_token"),
    ...overrides,
  };
}

test("result page runtime rules keep share tokens opaque while URLs stay deterministic", () => {
  assert.equal(resultPageShareTokenHash("secret"), `sha256:${sha256Hex("secret")}`);
  assert.equal(
    resultPageUrlPath("page/1", "token with space", 3),
    "/epoch/result/page%2F1?shareToken=token%20with%20space&shareVersion=3",
  );
  assert.equal(resultPageStatusUrlPath("page/1", 4), "/epoch/result/page%2F1?shareVersion=4");
});

test("result page runtime rules parse share versions and ttl conservatively", () => {
  assert.equal(resultPageShareVersion(2), 2);
  assert.equal(resultPageShareVersion("02"), 2);
  assert.equal(resultPageShareVersion(""), undefined);
  assert.equal(resultPageShareVersion({}), undefined);
  assert.equal(Number.isNaN(resultPageShareVersion("2.5")), true);
  assert.equal(resultPageExpiresAt("2026-07-06T00:00:00.000Z"), "2026-07-07T00:00:00.000Z");
});

test("result page runtime rules build create revoke and delete page records", () => {
  const resultPayload = payload();

  assert.equal(resultPageCreateIdempotencyKey({ idempotencyKey: " make-page " }), "result_page:make-page");
  assert.equal(resultPageRevokeIdempotencyKey({ idempotencyKey: " revoke-page " }), "result_page_revoke:revoke-page");
  assert.equal(resultPageDeleteIdempotencyKey({ idempotencyKey: " delete-page " }), "result_page_delete:delete-page");
  assert.throws(() => resultPageCreateIdempotencyKey({}), /idempotency_key_required/);
  assert.equal(resultPageCreateSeed(resultPayload, { idempotencyKey: "make-page" }), "agent_1:make-page");

  const active = resultPageActiveRecord({
    request: { idempotencyKey: " make-page ", actorExplorerId: "actor_explorer" },
    payload: resultPayload,
    pageId: "epoch_page_1",
    shareToken: "share_token",
    createdAt: "2026-07-06T00:00:00.000Z",
  });
  assert.equal(active.status, "active");
  assert.equal(active.createdBy, "actor_explorer");
  assert.equal(active.idempotencyKey, "result_page:make-page");
  assert.equal(active.expiresAt, "2026-07-07T00:00:00.000Z");
  assert.equal(active.urlPath, "/epoch/result/epoch_page_1?shareToken=share_token&shareVersion=1");
  assert.equal(active.shareTokenHash, resultPageShareTokenHash("share_token"));

  const revoked = resultPageRevokedRecord({
    page: active,
    request: { reason: ` ${"用户撤回".repeat(80)} ` },
    revokedAt: "2026-07-06T01:00:00.000Z",
    revokedBy: "operator",
  });
  assert.equal(revoked.status, "revoked");
  assert.equal(revoked.shareVersion, 2);
  assert.equal(revoked.urlPath, "/epoch/result/epoch_page_1?shareVersion=2");
  assert.equal(revoked.shareTokenHash, undefined);
  assert.equal(revoked.revokedAt, "2026-07-06T01:00:00.000Z");
  assert.equal(revoked.revokedBy, "operator");
  assert.equal(revoked.revokeReason?.length, 160);

  const deletionSummary = resultPageDeletionSummary(
    revoked,
    "2026-07-06T02:00:00.000Z",
    "explorer_receipt",
    "owner_deleted",
  );
  const deleted = resultPageDeletedRecord({
    page: revoked,
    request: { reason: " 清理公开正文 " },
    deletedAt: "2026-07-06T02:00:00.000Z",
    deletedBy: "explorer_receipt",
    deletionSummary,
  });
  assert.equal(deleted.status, "deleted");
  assert.equal(deleted.shareVersion, 3);
  assert.equal(deleted.urlPath, "/epoch/result/epoch_page_1?shareVersion=3");
  assert.equal(deleted.payload, undefined);
  assert.equal(deleted.publicSafeSummary, undefined);
  assert.equal(deleted.deleteReason, "清理公开正文");
  assert.equal(deleted.deletionSummary, deletionSummary);
});

test("result page runtime rules classify public access without leaking share tokens", () => {
  const nowMs = Date.parse("2026-07-06T12:00:00.000Z");
  const active = page();

  assert.deepEqual(resultPageAccessResult(undefined, {}, nowMs), {
    status: "missing",
    statusCode: 404,
  });
  assert.equal(resultPageIsExpired(active, nowMs), false);
  assert.deepEqual(resultPageAccessResult(active, {
    shareToken: "share_token",
    shareVersion: "1",
  }, nowMs), {
    status: "available",
    statusCode: 200,
    page: active,
  });
  assert.equal(resultPageAccessResult(active, {}, nowMs).status, "share_token_required");
  assert.equal(resultPageAccessResult(active, { shareToken: "wrong" }, nowMs).status, "share_token_mismatch");
  assert.equal(resultPageAccessResult(active, { shareToken: "share_token" }, nowMs).status, "share_version_required");
  assert.equal(resultPageAccessResult(active, {
    shareToken: "share_token",
    shareVersion: "2",
  }, nowMs).status, "share_version_mismatch");
  assert.equal(resultPageAccessResult(page({ status: "revoked" }), {}, nowMs).status, "revoked");
  assert.equal(resultPageAccessResult(page({ status: "deleted", payload: undefined }), {}, nowMs).status, "deleted");
  assert.equal(resultPageAccessResult(page({ payload: undefined }), {}, nowMs).status, "deleted");

  const legacyPublicPage = page({ shareTokenHash: undefined });
  assert.equal(resultPageAccessResult(legacyPublicPage, {}, nowMs).status, "available");
  assert.equal(
    resultPageAccessResult(page({ expiresAt: "2026-07-06T11:59:59.000Z" }), {
      shareToken: "share_token",
      shareVersion: 1,
    }, nowMs).status,
    "expired",
  );
});

test("result page runtime rules use stable json for hashes", () => {
  assert.equal(
    stableResultPageJson({ b: 1, a: { d: 2, c: [3, { b: true, a: false }] } }),
    '{"a":{"c":[3,{"a":false,"b":true}],"d":2},"b":1}',
  );
});

test("result page runtime rules build public-safe summary and public pages", () => {
  const baseProgress = payload().progress;
  const baseIdentity = baseProgress.identities[0];
  const progress = payload({
    progress: {
      ...baseProgress,
      agentId: "agent/one",
      explorerId: "explorer one",
      identity: undefined,
      identities: [{
        ...baseIdentity,
        agentId: "agent/one",
        explorerId: "explorer one",
        identityName: "region_gray_harbor_hidden_constraint_prompt",
      }],
    },
  }).progress;

  assert.equal(publicSafeSummaryLabel("region_gray_harbor_hidden_constraint_prompt", "fallback"), "灰港 公开摘要");
  assert.deepEqual(resultPagePublicPages(progress), {
    world: "/epoch/world",
    console: "/epoch/console",
    agent: "/epoch/agent/agent%2Fone",
    explorer: "/epoch/explorer/explorer%20one",
  });
  assert.deepEqual(resultPagePublicSafeSummary({
    progress,
    regionId: "region_salt_mirror",
  }), {
    summaryType: "public_safe_summary",
    source: "server_public_summary",
    text: "灰港 公开摘要 · 盐镜探索历程已整理为可分享摘要。",
    excludedSourceClasses: [
      "adjudication_verdict",
      "review_reason",
      "hidden_constraint_prompt",
      "event_payload_body",
    ],
  });
});

test("result page runtime rules focus progress events and hash publish requests", () => {
  const baseProgress = payload().progress;
  const keepEvent = {
    eventId: "keep",
    eventType: "turn_resolved",
    aggregateType: "agent",
    aggregateId: "agent_1",
    trustClass: "T1_agent_private",
    createdAt: "2026-07-06T00:00:00.000Z",
    payload: {},
  } as unknown as typeof baseProgress.latestEvents[number];
  const dropEvent = {
    eventId: "drop",
    eventType: "resource_granted",
    aggregateType: "agent",
    aggregateId: "agent_1",
    trustClass: "T1_agent_private",
    createdAt: "2026-07-06T00:01:00.000Z",
    payload: {},
  } as unknown as typeof baseProgress.latestEvents[number];
  const progress = payload({
    progress: {
      ...baseProgress,
      latestEvents: [keepEvent, dropEvent],
    },
  }).progress;

  const focused = focusedResultPageProgress(progress, { focusEventIds: ["keep", "", 42] });
  assert.deepEqual(focused.latestEvents.map((event) => event.eventId), ["keep"]);
  assert.equal(focusedResultPageProgress(progress, { focusEventIds: [] }), progress);

  assert.equal(
    resultPageRequestHash({
      agentId: " agent_1 ",
      explorerId: " explorer_1 ",
      focusHostedSessionId: " hosted_1 ",
      focusTurnCardId: " turn_1 ",
      limit: "7",
      regionId: "灰港",
    }),
    sha256Hex(stableResultPageJson({
      agentId: "agent_1",
      explorerId: "explorer_1",
      hostedSessionId: "hosted_1",
      limit: 7,
      regionId: "region_gray_harbor",
      turnCardId: "turn_1",
    })),
  );
});

test("result page runtime rules identify page owners from payloads or deleted summaries", () => {
  assert.equal(resultPagePayloadOwnerExplorerId(payload()), "explorer_receipt");
  assert.equal(resultPagePayloadOwnerExplorerId(payload({ receipt: receipt({ explorerId: undefined }) })), "explorer_progress");
  assert.equal(resultPageOwnerExplorerId(page()), "explorer_receipt");
  assert.equal(resultPageOwnerExplorerId(page({
    payload: undefined,
    deletionSummary: { ownerExplorerId: "explorer_deleted" } as EpochResultPageDeletionSummary,
  })), "explorer_deleted");
});

test("result page runtime rules build deletion classifications and minimal references", () => {
  const classification = resultPageDeletionRequestClassification();
  assert.equal(classification.selectedCategory, "hide_body");
  assert.equal(classification.sharedSettingRule.referencedByMultiple, "request_de_admission_review_only");

  const reference = resultPageDeletedMinimalReference(page(), receipt(), "explorer_receipt");
  assert.match(reference.anonymousSourceHash, /^anon:sha256:[a-f0-9]{64}$/);
  assert.deepEqual(reference.removedBodyClasses, DELETED_RESULT_PAGE_REMOVED_BODY_CLASSES);
  assert.deepEqual(reference.claimFacts.map((fact) => fact.key), [
    "pageId",
    "focusKind",
    "focusIdHash",
    "canonicalEventCount",
  ]);
});

test("result page runtime rules summarize deletion without carrying the page body forward", () => {
  const sourcePage = page();
  const summary = resultPageDeletionSummary(
    sourcePage,
    "2026-07-06T01:00:00.000Z",
    "explorer_receipt",
    "owner_deleted",
  );

  assert.equal(summary.pageId, "epoch_page_1");
  assert.equal(summary.ownerExplorerId, "explorer_receipt");
  assert.equal(summary.receiptPayloadHash, "sha256:payload_hash");
  assert.equal(summary.fullPayloadHash, `sha256:${sha256Hex(stableResultPageJson(sourcePage.payload))}`);
  assert.deepEqual(summary.canonicalEventIds, []);
  assert.equal(summary.deletedBy, "explorer_receipt");
  assert.equal(summary.deletionRequest?.selectedCategory, "hide_body");
  assert.equal(summary.minimalReference.referenceType, "deleted_result_page_minimal_reference");
  assert.ok(summary.retainedFacts.includes("fullPayloadHash"));
});

test("result page runtime rules preserve existing deletion summaries when the body is already gone", () => {
  const existing = resultPageDeletionSummary(
    page(),
    "2026-07-06T01:00:00.000Z",
    "explorer_receipt",
    "owner_deleted",
  );
  const summarizedAgain = resultPageDeletionSummary(
    page({ payload: undefined, deletionSummary: { ...existing, deletionRequest: undefined } }),
    "2026-07-06T02:00:00.000Z",
    "operator",
    "duplicate_delete",
  );

  assert.equal(summarizedAgain.deletedAt, existing.deletedAt);
  assert.equal(summarizedAgain.deletedBy, existing.deletedBy);
  assert.equal(summarizedAgain.deletionRequest?.selectedCategory, "hide_body");
  assert.throws(
    () => resultPageDeletionSummary(page({ payload: undefined, deletionSummary: undefined }), "now", "actor", "reason"),
    /result_page_payload_missing/,
  );
});
