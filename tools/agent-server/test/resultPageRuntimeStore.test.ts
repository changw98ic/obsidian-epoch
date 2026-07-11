import assert from "node:assert/strict";
import test from "node:test";
import { createResultPageRuntimeStore } from "../lib/epoch/resultPageRuntimeStore.ts";
import { resultPageShareTokenHash } from "../lib/epoch/resultPageRuntimeRules.ts";
import type { EpochIdFactory } from "../lib/epoch/protocol.ts";
import type {
  EpochResultPagePayload,
  EpochResultPageReceipt,
  EpochSharedResultPage,
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
    explorerId: "explorer_1",
    focus: { kind: "turn_card", id: "turn_card_1" },
    trustClasses: ["T1_agent_private"],
    trustedExecution: [],
    canonicalEvents: [],
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
      explorerId: "explorer_1",
      identity: { agentId: "agent_1", explorerId: "explorer_1", identityName: "调查员" },
      identities: [{ agentId: "agent_1", explorerId: "explorer_1", identityName: "调查员" }],
      resources: {},
      latestEvents: [],
    },
    runSummary: {
      runId: "run_page_1",
      title: "完整探索历程",
      status: "settled",
      stepCount: 4,
      startedAt: "2026-07-06T00:00:00.000Z",
      settledAt: "2026-07-06T00:05:00.000Z",
      timeline: [],
      outcome: {
        title: "探索完成",
        summary: "调查员完成了灰港探索。",
      },
    },
    publicPages: { world: "/epoch/world", console: "/epoch/console" },
    nextActions: [],
    receipt: receipt(),
    ...overrides,
  } as EpochResultPagePayload;
}

function createHarness(input: {
  readonly initialPages?: readonly EpochSharedResultPage[];
  readonly nowIso?: string;
} = {}) {
  let nowMs = Date.parse(input.nowIso || "2026-07-06T00:00:00.000Z");
  let authCalls = 0;
  let operatorCalls = 0;
  let createAllowedCalls = 0;
  let idCounter = 0;
  const idFactory: EpochIdFactory = (kind) => `${kind}_${String(idCounter += 1).padStart(4, "0")}`;
  const store = createResultPageRuntimeStore({
    clock: () => new Date(nowMs),
    idFactory,
    initialPages: input.initialPages,
    assertExplorerAuth: (_request, explorerId) => {
      authCalls += 1;
      if (explorerId !== "explorer_1") throw new Error("unexpected_explorer_auth");
    },
    assertOperatorKey: (request) => {
      operatorCalls += 1;
      if (request.operatorKey !== "operator_secret") throw new Error("operator_key_invalid");
    },
    assertCreateAllowed: () => {
      createAllowedCalls += 1;
    },
  });
  return {
    store,
    authCalls: () => authCalls,
    operatorCalls: () => operatorCalls,
    createAllowedCalls: () => createAllowedCalls,
    advanceTo: (nextIso: string) => {
      nowMs = Date.parse(nextIso);
    },
  };
}

function shareQuery(page: EpochSharedResultPage) {
  const url = new URL(page.urlPath, "http://localhost");
  return {
    shareToken: url.searchParams.get("shareToken") || "",
    shareVersion: url.searchParams.get("shareVersion") || "",
  };
}

test("result page runtime store consumes publish tokens once while create remains idempotent", () => {
  const harness = createHarness();
  const draftInput = {
    agentId: "agent_1",
    explorerId: "explorer_1",
    regionId: "region_gray_harbor",
    idempotencyKey: "create_page",
  };
  const publishToken = harness.store.issuePublishToken(draftInput, payload());

  assert.match(publishToken, /^epoch_result_publish_/);
  assert.throws(() => harness.store.createFromPublishToken({
    ...draftInput,
    regionId: "region_salt_mirror",
    publishToken,
  }), /result_page_publish_token_mismatch/);

  const created = harness.store.createFromPublishToken({ ...draftInput, publishToken });
  assert.equal(created.page.status, "active");
  assert.equal(created.page.pageId, "page_0001");
  assert.equal(created.page.createdAt, "2026-07-06T00:00:00.000Z");
  assert.equal(created.page.createdBy, "explorer_1");
  assert.equal(harness.authCalls(), 1);
  assert.equal(harness.createAllowedCalls(), 2);

  const duplicate = harness.store.createFromPublishToken({ ...draftInput, publishToken });
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.page, created.page);
  assert.equal(harness.authCalls(), 1);
  assert.equal(harness.createAllowedCalls(), 2);

  const share = shareQuery(created.page);
  assert.equal(created.page.shareTokenHash, resultPageShareTokenHash(share.shareToken));
  assert.equal(harness.store.getPublic({
    pageId: created.page.pageId,
    shareToken: share.shareToken,
    shareVersion: share.shareVersion,
  }).status, "available");
  assert.equal(harness.store.getPublic({
    pageId: created.page.pageId,
    shareToken: "wrong",
    shareVersion: share.shareVersion,
  }).status, "share_token_mismatch");
});

test("result page runtime store revokes and deletes through authorization with stable replay", () => {
  const harness = createHarness();
  const created = harness.store.createFromPayload({
    idempotencyKey: "direct_create",
    actorExplorerId: "explorer_1",
  }, payload()).page;

  const revoked = harness.store.revoke({
    pageId: created.pageId,
    idempotencyKey: "revoke_page",
    operatorKey: "operator_secret",
    reason: "operator_review",
  });
  assert.equal(revoked.page.status, "revoked");
  assert.equal(revoked.page.revokedBy, "operator");
  assert.equal(revoked.page.shareTokenHash, undefined);
  assert.equal(harness.operatorCalls(), 1);
  assert.equal(harness.store.revoke({
    pageId: created.pageId,
    idempotencyKey: "revoke_page",
    operatorKey: "operator_secret",
  }).duplicate, true);

  harness.advanceTo("2026-07-06T00:10:00.000Z");
  const deleted = harness.store.delete({
    pageId: created.pageId,
    idempotencyKey: "delete_page",
    explorerId: "explorer_1",
    recoveryCode: "local-secret",
    reason: "owner_deleted_body",
  });
  assert.equal(deleted.page.status, "deleted");
  assert.equal(deleted.page.payload, undefined);
  assert.equal(deleted.page.deletionSummary?.ownerExplorerId, "explorer_1");
  assert.equal(deleted.page.deletionSummary?.deleteReason, "owner_deleted_body");
  assert.equal(harness.authCalls(), 1);
  assert.equal(harness.store.delete({
    pageId: created.pageId,
    idempotencyKey: "delete_page",
    explorerId: "explorer_1",
  }).duplicate, true);
});

test("result page runtime store hydrates initial pages for idempotency and recent-result reads", () => {
  const page = createHarness().store.createFromPayload({
    idempotencyKey: "initial_page",
    actorExplorerId: "explorer_1",
  }, payload()).page;
  const harness = createHarness({ initialPages: [page] });

  const duplicate = harness.store.createFromPayload({
    idempotencyKey: "initial_page",
    actorExplorerId: "explorer_1",
  }, payload());
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.page, page);
  assert.equal(harness.store.size(), 1);
  assert.equal(harness.store.values()[0], page);
  assert.deepEqual(harness.store.recentResults({ limit: 1 }).map((result) => result.pageId), [page.pageId]);

  harness.advanceTo("2026-07-08T00:00:00.000Z");
  assert.deepEqual(harness.store.recentResults({ limit: 1 }), []);
});
