import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { projectEpochEvents } from "../lib/epoch/gameCore.ts";
import {
  buildFallbackJourneyTaskPlan,
  type JourneyGeneratedTaskPlan,
  type JourneyHiddenTaskSealResolver,
} from "../lib/epoch/journeyGeneratedTaskRules.ts";
import {
  generateTaskPlanJourneySceneEpisodes,
  type JourneyAvailableWorldObject,
  type JourneyRegionContext,
} from "../lib/epoch/journeySceneRules.ts";
import { resultPageReceipt } from "../lib/epoch/resultPageReceiptRules.ts";
import { createResultPageRuntimeStore } from "../lib/epoch/resultPageRuntimeStore.ts";
import { resultPageShareTokenHash, stableResultPageJson } from "../lib/epoch/resultPageRuntimeRules.ts";
import { sha256Hex } from "../lib/epoch/runtimeAuth.ts";
import { buildPersistedJourneyNarrative, buildServerJourneyEpisodeFacts } from "../lib/epoch/journeyNarrativeRules.ts";
import { buildGroundedJourneyStoryReport } from "../lib/epoch/journeyStoryReport.ts";
import {
  CANON_THRESHOLD_BPS,
  CONSEQUENCE_SCORE_POLICY_VERSION,
  SETTLEMENT_POLICY_VERSION,
} from "../lib/epoch/journeySettlementRules.ts";
import type { EpochEvent } from "../lib/epoch/events.ts";
import type { EpochIdFactory } from "../lib/epoch/protocol.ts";
import type {
  EpochResultPagePayload,
  EpochSharedResultPage,
} from "../lib/epoch/runtime.ts";
import { appendSqliteJsonl, loadAgentRuntimeOptionsFromSqlite } from "../lib/sqliteStore.ts";
import { hydrateAgentRuntimeOptions } from "../lib/store.ts";

function payload(overrides: Partial<EpochResultPagePayload> = {}): EpochResultPagePayload {
  const { receipt: receiptOverride, ...bodyOverrides } = overrides;
  const body = {
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
    ...bodyOverrides,
  } as Omit<EpochResultPagePayload, "receipt">;
  const generatedReceipt = resultPageReceipt(projectEpochEvents([]), body);
  return {
    ...body,
    receipt: {
      ...generatedReceipt,
      ...receiptOverride,
      generatedAt: body.generatedAt,
      payloadHash: `sha256:${sha256Hex(stableResultPageJson(body))}`,
    },
  };
}

function groundedJourneyFixture() {
  const journeyId = "journey_restore";
  const correlationId = `journey:${journeyId}`;
  const region: JourneyRegionContext = {
    id: "region_gray_harbor",
    type: "region",
    label: "灰港",
    sourceFactIds: ["world:region:region_gray_harbor"],
  };
  const availableWorldObjects: readonly JourneyAvailableWorldObject[] = [
    region,
    {
      id: "location_gray_harbor_civic_ledger",
      type: "workplace",
      label: "灰港民务账房",
      regionId: region.id,
      sourceFactIds: ["world:location:gray_harbor_civic_ledger"],
    },
    {
      id: "organization_gray_harbor_civic_office",
      type: "organization",
      label: "灰港民务所",
      regionId: region.id,
      sourceFactIds: ["world:organization:gray_harbor_civic_office"],
    },
    {
      id: "npc_night_clerk_kelan",
      type: "npc",
      label: "夜班书记珂岚",
      regionId: region.id,
      sourceFactIds: ["world:npc:night_clerk_kelan"],
    },
    {
      id: "document_gray_harbor_salt_ledger",
      type: "document",
      label: "灰港盐票账册",
      regionId: region.id,
      sourceFactIds: ["world:document:gray_harbor_salt_ledger"],
    },
  ];
  const installation = buildFallbackJourneyTaskPlan({
    taskType: "验证恢复",
    scenarioMapId: region.id,
    availableWorldObjects,
  });
  const scenePlan = generateTaskPlanJourneySceneEpisodes({
    plan: installation.plan,
    region,
    availableWorldObjects,
  });
  const failedObjectiveId = installation.plan.objectives.find((objective) => objective.kind === "main")?.objectiveId;
  const episodes = scenePlan.episodes.map((sceneEpisode, index) => {
    const objective = sceneEpisode.generatedTaskObjective;
    const failed = objective?.objectiveId === failedObjectiveId;
    const action = objective?.actions[0];
    const optionKey = action?.optionKey ?? `${sceneEpisode.phase ?? "scene"}_${index}`;
    const optionLabel = action?.label ?? `${sceneEpisode.title}行动`;
    const outcomeSummary = action?.outcomeSummary ?? `${sceneEpisode.title}已由服务器确认。`;
    const episodeId = `episode_${index + 1}`;
    const eventId = `event_${index + 1}`;
    const taskAction = objective
      ? {
          optionKey,
          optionLabel,
          outcomeSummary,
          taskObjectiveId: objective.objectiveId,
          completionKind: failed ? "failed" as const : "complete" as const,
        }
      : { optionKey, optionLabel, outcomeSummary };
    const serverFacts = buildServerJourneyEpisodeFacts({
      journeyId,
      episodeId,
      phase: sceneEpisode.phase ?? "main",
      title: sceneEpisode.title,
      agent: { id: "agent_1", displayName: "调查员" },
      worldObjectRefs: sceneEpisode.worldObjectRefs,
      action: taskAction,
      canonicalEventIds: [eventId],
    });
    return {
      ...sceneEpisode,
      episodeId,
      generatedTaskObjective: objective,
      sourceEventIds: [eventId],
      serverFacts,
      narrative: buildPersistedJourneyNarrative({ serverFacts }).value,
      settlement: {
        canonicalEventIds: [eventId],
        outcomeSummary,
        ...(objective ? {
          taskObjective: {
            objectiveId: objective.objectiveId,
            completionKind: failed ? "failed" as const : "complete" as const,
          },
        } : {}),
      },
    };
  });
  const canonicalEventIds = episodes.flatMap((episode) => episode.serverFacts.sourceEventIds);
  const canonicalEpochEvents = episodes.flatMap((episode, index) => {
    const eventId = canonicalEventIds[index]!;
    const sessionId = `session_${eventId}`;
    const actionOptionId = `action_${eventId}`;
    const journeyResolution = episode.generatedTaskObjective
      ? { completionKind: episode.settlement?.taskObjective?.completionKind }
      : undefined;
    const common = {
      aggregateType: "hosted_session",
      aggregateId: sessionId,
      actorExplorerId: "explorer_1",
      agentId: "agent_1",
      trustClass: "user_verified_web",
      causationId: episode.episodeId,
      correlationId,
      createdAt: "2026-07-06T00:00:00.000Z",
    };
    return [{
      ...common,
      eventId: `started_${eventId}`,
      eventType: "hosted_session_started",
      payload: {
        sessionId,
        sceneContract: {
          journeyId,
          episodeId: episode.episodeId,
          actionOptions: [{ actionOptionId }],
        },
      },
    }, {
      ...common,
      eventId,
      eventType: "hosted_action_recorded",
      payload: {
        sessionId,
        actionOptionId,
        ...(journeyResolution ? { journeyResolution } : {}),
      },
    }] as unknown as readonly EpochEvent[];
  });
  const worldCommit = {
    mode: "mirror" as const,
    status: "discarded" as const,
    completionTier: "未及格" as const,
    reason: "main_incomplete" as const,
    regionId: region.id,
    committedAtWorldTime: "2026-07-06T00:30:00.000Z",
    influenceDelta: 0,
    factionStandings: [],
    npcRelationships: [],
    sourceEventIds: [],
    completionScoreBps: 0,
    canonThresholdBps: CANON_THRESHOLD_BPS,
    settlementPolicyVersion: SETTLEMENT_POLICY_VERSION,
    consequenceScorePolicyVersion: CONSEQUENCE_SCORE_POLICY_VERSION,
    settlementId: "settlement_restore",
    consequenceScoreBreakdown: {
      resultScoreBps: 0,
      selfLossScoreBps: 0,
      collateralScoreBps: 0,
    },
  };
  const identity = {
    status: "active",
    lifetime: { max: 100, remaining: 80, startedAt: "2026-07-06T00:00:00.000Z" },
    personality: { traits: [], driftIds: [] },
  } as const;
  const storyReport = buildGroundedJourneyStoryReport({
    journeyId,
    status: "settled",
    objective: "验证恢复",
    regionId: region.id,
    startedAtWorldTime: "2026-07-06T00:00:00.000Z",
    dueAtWorldTime: "2026-07-06T00:30:00.000Z",
    episodes,
    taskPlan: installation.plan,
    hiddenTaskSeal: installation.hiddenTaskSeal,
    hiddenPrerequisiteLinks: [],
    worldCommit,
    identity,
  });
  assert.ok(storyReport);
  return {
    journey: {
      journeyId,
      correlationId,
      status: "settled",
      objective: "验证恢复",
      regionId: "region_gray_harbor",
      worldMode: "mirror",
      startedAtWorldTime: "2026-07-06T00:00:00.000Z",
      dueAtWorldTime: "2026-07-06T00:30:00.000Z",
      episodes,
      canonicalEventIds,
      taskPlan: installation.plan,
      worldCommit,
      storyReport,
    },
    canonicalEpochEvents,
    hiddenTaskSeal: installation.hiddenTaskSeal,
  };
}

function createHarness(input: {
  readonly initialPages?: readonly EpochSharedResultPage[];
  readonly nowIso?: string;
  readonly canonicalEpochEvents?: readonly EpochEvent[];
  readonly resolveJourneyHiddenTaskSeal?: JourneyHiddenTaskSealResolver;
  readonly strictAuth?: boolean;
  readonly recoveryCodes?: Readonly<Record<string, string>>;
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
    canonicalEpochEvents: () => input.canonicalEpochEvents || [],
    resolveJourneyHiddenTaskSeal: input.resolveJourneyHiddenTaskSeal,
    assertExplorerAuth: (request, explorerId) => {
      authCalls += 1;
      const recoveryCode = input.recoveryCodes?.[explorerId]
        ?? (explorerId === "explorer_1" ? "local-secret" : undefined);
      if (!recoveryCode) throw new Error("unexpected_explorer_auth");
      if (input.strictAuth && request.recoveryCode !== recoveryCode) {
        throw new Error("explorer_auth_required");
      }
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

function pageCommand(page: EpochSharedResultPage) {
  return {
    type: "agent_command_commit",
    version: 1,
    command: `result-page-${page.status || "active"}`,
    commandId: `result-page:${page.pageId}:${page.shareVersion || 1}`,
    journeyEvents: [],
    epochEvents: [],
    resultPages: [page],
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
  assert.equal(harness.authCalls(), 2);
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

test("duplicate create, revoke, and delete reauthenticate before returning historical revisions", () => {
  const harness = createHarness({ strictAuth: true });
  const createInput = {
    agentId: "agent_1",
    explorerId: "explorer_1",
    idempotencyKey: "reauth_create",
  };
  const publishToken = harness.store.issuePublishToken(createInput, payload());
  const active = harness.store.createFromPublishToken({
    ...createInput,
    publishToken,
    recoveryCode: "local-secret",
  }).page;

  assert.throws(() => harness.store.createFromPublishToken(createInput), /explorer_auth_required/);
  assert.deepEqual(harness.store.createFromPublishToken({
    ...createInput,
    recoveryCode: "local-secret",
  }), { page: active, duplicate: true });

  const revoked = harness.store.revoke({
    pageId: active.pageId,
    idempotencyKey: "reauth_revoke",
    recoveryCode: "local-secret",
  }).page;
  assert.throws(() => harness.store.revoke({
    pageId: active.pageId,
    idempotencyKey: "reauth_revoke",
  }), /explorer_auth_required/);
  assert.deepEqual(harness.store.revoke({
    pageId: active.pageId,
    idempotencyKey: "reauth_revoke",
    recoveryCode: "local-secret",
  }), { page: revoked, duplicate: true });

  const deleted = harness.store.delete({
    pageId: active.pageId,
    idempotencyKey: "reauth_delete",
    recoveryCode: "local-secret",
  }).page;
  assert.throws(() => harness.store.delete({
    pageId: active.pageId,
    idempotencyKey: "reauth_delete",
  }), /explorer_auth_required/);
  assert.deepEqual(harness.store.delete({
    pageId: active.pageId,
    idempotencyKey: "reauth_delete",
    recoveryCode: "local-secret",
  }), { page: deleted, duplicate: true });
});

test("result page runtime store hydrates initial pages for idempotency and recent-result reads", () => {
  const page = createHarness().store.createFromPayload({
    idempotencyKey: "initial_page",
    actorExplorerId: "explorer_1",
  }, payload()).page;
  const persistedPage = JSON.parse(JSON.stringify(page)) as EpochSharedResultPage;
  const harness = createHarness({ initialPages: [persistedPage] });

  const duplicate = harness.store.createFromPayload({
    idempotencyKey: "initial_page",
    actorExplorerId: "explorer_1",
  }, payload());
  assert.equal(duplicate.duplicate, true);
  assert.deepEqual(duplicate.page, persistedPage);
  assert.equal(harness.store.size(), 1);
  assert.equal(harness.store.values()[0], persistedPage);
  assert.deepEqual(harness.store.recentResults({ limit: 1 }).map((result) => result.pageId), [page.pageId]);

  harness.advanceTo("2026-07-08T00:00:00.000Z");
  assert.deepEqual(harness.store.recentResults({ limit: 1 }), []);
});

test("result page hydration revalidates Journey grounding, canonical provenance, receipts, and revisions", () => {
  const fixture = groundedJourneyFixture();
  const resolver: JourneyHiddenTaskSealResolver = (_journeyId: string, _plan: JourneyGeneratedTaskPlan) => fixture.hiddenTaskSeal;
  const canonicalOptions = {
    canonicalEpochEvents: fixture.canonicalEpochEvents,
    resolveJourneyHiddenTaskSeal: resolver,
  };
  const created = createHarness(canonicalOptions).store.createFromPayload({
    idempotencyKey: "journey_restore_page",
    actorExplorerId: "explorer_1",
  }, payload({ journey: fixture.journey })).page;

  const restored = createHarness({
    ...canonicalOptions,
    initialPages: [created],
  });
  assert.equal(restored.store.get(created.pageId)?.payload?.journey?.status, "settled");

  assert.throws(() => createHarness({
    ...canonicalOptions,
    initialPages: [created],
    canonicalEpochEvents: [],
  }), /result_page_journey_provenance_invalid/);

  const journey = created.payload?.journey;
  assert.ok(journey);
  const pollutedJourney = {
    ...journey,
    episodes: journey.episodes.map((episode, index) => index === 0
      ? { ...episode, narrative: {} as never }
      : episode),
  };
  assert.throws(() => createHarness({
    ...canonicalOptions,
    initialPages: [{ ...created, payload: payload({ ...created.payload, journey: pollutedJourney }) }],
  }), /result_page_journey_grounding_invalid/);

  assert.throws(() => createHarness({
    ...canonicalOptions,
    initialPages: [{
      ...created,
      payload: { ...created.payload!, receipt: { ...created.payload!.receipt, payloadHash: "sha256:forged" } },
    }],
    canonicalEpochEvents: fixture.canonicalEpochEvents,
  }), /result_page_receipt_invalid/);

  assert.throws(() => createHarness({
    ...canonicalOptions,
    initialPages: [{ ...created, shareVersion: (created.shareVersion || 1) + 1 }],
    canonicalEpochEvents: fixture.canonicalEpochEvents,
  }), /result_page_revision_invalid/);
  assert.throws(() => createHarness({
    ...canonicalOptions,
    initialPages: [{ ...created, shareVersion: 0 }],
    canonicalEpochEvents: fixture.canonicalEpochEvents,
  }), /result_page_revision_invalid/);
  assert.throws(() => createHarness({
    ...canonicalOptions,
    initialPages: [{ ...created, shareVersion: null } as unknown as EpochSharedResultPage],
    canonicalEpochEvents: fixture.canonicalEpochEvents,
  }), /result_page_revision_invalid/);
  assert.throws(() => createHarness({
    ...canonicalOptions,
    initialPages: [{ ...created, status: "" } as unknown as EpochSharedResultPage],
    canonicalEpochEvents: fixture.canonicalEpochEvents,
  }), /result_page_revision_invalid/);
  assert.throws(() => createHarness({
    ...canonicalOptions,
    initialPages: [{
      ...created,
      payload: {
        ...created.payload!,
        receipt: { ...created.payload!.receipt, explorerId: "explorer_attacker" },
      },
    }],
    canonicalEpochEvents: fixture.canonicalEpochEvents,
  }), /result_page_receipt_invalid/);
  assert.throws(() => createHarness({
    ...canonicalOptions,
    initialPages: [{
      ...created,
      payload: {
        ...created.payload!,
        receipt: {
          ...created.payload!.receipt,
          focus: { ...created.payload!.receipt.focus, id: "forged_focus" },
        },
      },
    }],
    canonicalEpochEvents: fixture.canonicalEpochEvents,
  }), /result_page_receipt_invalid/);
  assert.throws(() => createHarness({
    ...canonicalOptions,
    initialPages: [{
      ...created,
      payload: {
        ...created.payload!,
        receipt: {
          ...created.payload!.receipt,
          playMode: "verified",
          trustTier: "verified_autonomous",
          trustClasses: ["remote_attested_runner"],
        },
      },
    }],
    canonicalEpochEvents: fixture.canonicalEpochEvents,
  }), /result_page_receipt_invalid/);
  assert.throws(() => createHarness({
    ...canonicalOptions,
    initialPages: [{
      ...created,
      payload: {
        ...created.payload!,
        receipt: {
          ...created.payload!.receipt,
          canonicalEvents: [{
            eventId: "event_not_canonical",
            eventType: "hosted_action_recorded",
            aggregateType: "hosted_session",
            aggregateId: "session_forged",
            trustClass: "remote_attested_runner",
            createdAt: created.createdAt,
            auditUrl: "/epoch/audit/event_not_canonical",
          }],
        },
      },
    }],
    canonicalEpochEvents: fixture.canonicalEpochEvents,
  }), /result_page_receipt_invalid/);
});

test("result page lifecycle idempotency replays exact canonical revisions after command hydration", () => {
  const first = createHarness();
  const active = first.store.createFromPayload({
    idempotencyKey: "restart_create",
    actorExplorerId: "explorer_1",
  }, payload()).page;
  const revoked = first.store.revoke({
    pageId: active.pageId,
    idempotencyKey: "restart_revoke",
    operatorKey: "operator_secret",
  }).page;
  const deleted = first.store.delete({
    pageId: active.pageId,
    idempotencyKey: "restart_delete",
    operatorKey: "operator_secret",
  }).page;
  const other = first.store.createFromPayload({
    idempotencyKey: "restart_create_other",
    actorExplorerId: "explorer_1",
  }, payload()).page;

  const hydrated = hydrateAgentRuntimeOptions({
    commandEvents: [pageCommand(deleted), pageCommand(other), pageCommand(active), pageCommand(revoked)],
  });
  assert.deepEqual(hydrated.resultPages.map((page) => [page.pageId, page.shareVersion]), [
    [active.pageId, 1],
    [active.pageId, 2],
    [active.pageId, 3],
    [other.pageId, 1],
  ]);
  const restarted = createHarness({ initialPages: hydrated.resultPages as unknown as EpochSharedResultPage[] });

  const duplicateCreate = restarted.store.createFromPayload({
    idempotencyKey: "restart_create",
    actorExplorerId: "explorer_1",
  }, payload());
  const duplicateRevoke = restarted.store.revoke({
    pageId: active.pageId,
    idempotencyKey: "restart_revoke",
    operatorKey: "operator_secret",
  });
  const duplicateDelete = restarted.store.delete({
    pageId: active.pageId,
    idempotencyKey: "restart_delete",
    operatorKey: "operator_secret",
  });

  assert.deepEqual(duplicateCreate, { page: active, duplicate: true });
  assert.deepEqual(duplicateRevoke, { page: revoked, duplicate: true });
  assert.deepEqual(duplicateDelete, { page: deleted, duplicate: true });
  assert.equal(restarted.store.get(active.pageId)?.shareVersion, 3);
  assert.equal(restarted.operatorCalls(), 2);
  assert.throws(() => restarted.store.revoke({
    pageId: active.pageId,
    idempotencyKey: "changed_revoke",
    operatorKey: "operator_secret",
  }), /result_page_already_deleted/);
  assert.throws(() => restarted.store.revoke({
    pageId: other.pageId,
    idempotencyKey: "restart_revoke",
    operatorKey: "operator_secret",
  }), /result_page_idempotency_subject_conflict/);
  assert.throws(() => restarted.store.createFromPayload({
    agentId: "agent_changed_subject",
    idempotencyKey: "restart_create",
    actorExplorerId: "explorer_1",
  }, payload()), /result_page_idempotency_subject_conflict/);
});

test("result page lifecycle idempotency survives SQLite restart hydration", async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), "result-page-idempotency-"));
  const dbPath = path.join(tempDir, "agent-world.sqlite");
  try {
    const first = createHarness();
    const active = first.store.createFromPayload({
      idempotencyKey: "sqlite_create",
      actorExplorerId: "explorer_1",
    }, payload()).page;
    const revoked = first.store.revoke({
      pageId: active.pageId,
      idempotencyKey: "sqlite_revoke",
      operatorKey: "operator_secret",
    }).page;
    const deleted = first.store.delete({
      pageId: active.pageId,
      idempotencyKey: "sqlite_delete",
      operatorKey: "operator_secret",
    }).page;
    for (const page of [active, revoked, deleted]) {
      await appendSqliteJsonl(dbPath, "command-events.jsonl", pageCommand(page));
    }

    const hydrated = await loadAgentRuntimeOptionsFromSqlite(dbPath);
    const restarted = createHarness({ initialPages: hydrated.resultPages as unknown as EpochSharedResultPage[] });
    assert.deepEqual(restarted.store.revoke({
      pageId: active.pageId,
      idempotencyKey: "sqlite_revoke",
      operatorKey: "operator_secret",
    }), { page: revoked, duplicate: true });
    assert.deepEqual(restarted.store.delete({
      pageId: active.pageId,
      idempotencyKey: "sqlite_delete",
      operatorKey: "operator_secret",
    }), { page: deleted, duplicate: true });
    assert.equal(restarted.store.get(active.pageId)?.shareVersion, 3);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("result page lifecycle recovery rejects polluted keys and fails closed for incomplete legacy history", () => {
  const first = createHarness();
  const active = first.store.createFromPayload({
    idempotencyKey: "pollution_create",
    actorExplorerId: "explorer_1",
  }, payload()).page;
  const revoked = first.store.revoke({
    pageId: active.pageId,
    idempotencyKey: "pollution_revoke",
    operatorKey: "operator_secret",
  }).page;

  assert.throws(() => createHarness({
    initialPages: [{ ...active, lifecycleIdempotencyKey: "result_page_revoke:polluted" }],
  }), /result_page_lifecycle_idempotency_invalid/);
  assert.throws(() => createHarness({
    initialPages: [{ ...active, idempotencySubjectHash: "not-a-hash" }],
  }), /result_page_idempotency_subject_invalid/);
  assert.throws(() => createHarness({
    initialPages: [{ ...revoked, lifecycleIdempotencyKey: "result_page_delete:wrong-kind" }],
  }), /result_page_lifecycle_idempotency_invalid/);
  assert.throws(() => createHarness({
    initialPages: [active, { ...active, createdBy: "polluted_actor" }],
  }), /result_page_recovery_conflict/);

  const secondActive = { ...active, pageId: "page_other", urlPath: active.urlPath.replace(active.pageId, "page_other") };
  const secondRevoked = {
    ...revoked,
    pageId: secondActive.pageId,
    urlPath: revoked.urlPath.replace(revoked.pageId, secondActive.pageId),
  };
  assert.throws(() => createHarness({
    initialPages: [revoked, secondRevoked],
  }), /result_page_lifecycle_idempotency_recovery_conflict/);

  const legacyRevoked = { ...revoked, lifecycleIdempotencyKey: undefined };
  const legacy = createHarness({ initialPages: [active, legacyRevoked] });
  assert.throws(() => legacy.store.revoke({
    pageId: active.pageId,
    idempotencyKey: "pollution_revoke",
    operatorKey: "operator_secret",
  }), /result_page_idempotency_history_unavailable/);

  const unversionedLegacyRevoked = {
    ...legacyRevoked,
    shareVersion: undefined,
    urlPath: `/epoch/result/${encodeURIComponent(legacyRevoked.pageId)}?shareVersion=1`,
  };
  assert.throws(() => createHarness({ initialPages: [unversionedLegacyRevoked] }).store.revoke({
    pageId: active.pageId,
    idempotencyKey: "pollution_revoke",
    operatorKey: "operator_secret",
  }), /result_page_idempotency_history_unavailable/);

  const unversionedLegacyRevokedWithLifecycleKey = {
    ...revoked,
    shareVersion: undefined,
    urlPath: `/epoch/result/${encodeURIComponent(revoked.pageId)}?shareVersion=1`,
  };
  const unversionedLegacy = createHarness({ initialPages: [unversionedLegacyRevokedWithLifecycleKey] });
  assert.throws(() => unversionedLegacy.store.createFromPayload({
    idempotencyKey: "pollution_create",
    actorExplorerId: "explorer_1",
  }, payload()), /result_page_idempotency_history_unavailable/);
  assert.throws(() => unversionedLegacy.store.revoke({
    pageId: active.pageId,
    idempotencyKey: "pollution_revoke",
    operatorKey: "operator_secret",
  }), /result_page_idempotency_history_unavailable/);

  const revisionThree = {
    ...revoked,
    shareVersion: 3,
    urlPath: `/epoch/result/${encodeURIComponent(revoked.pageId)}?shareVersion=3`,
  };
  const revisionGap = createHarness({ initialPages: [active, revisionThree] });
  assert.throws(() => revisionGap.store.revoke({
    pageId: active.pageId,
    idempotencyKey: "revoke_after_gap",
    operatorKey: "operator_secret",
  }), /result_page_idempotency_history_unavailable/);

  const deleted = first.store.delete({
    pageId: active.pageId,
    idempotencyKey: "pollution_delete",
    operatorKey: "operator_secret",
  }).page;
  assert.ok(deleted.deletionSummary);
  const pollutedDeletedOwner = {
    ...deleted,
    deletionSummary: { ...deleted.deletionSummary, ownerExplorerId: "explorer_2" },
  };
  const ownerDrift = createHarness({
    initialPages: [active, revoked, pollutedDeletedOwner],
    strictAuth: true,
    recoveryCodes: { explorer_1: "owner-one", explorer_2: "owner-two" },
  });
  assert.throws(() => ownerDrift.store.revoke({
    pageId: active.pageId,
    idempotencyKey: "pollution_revoke",
    recoveryCode: "owner-two",
  }), /result_page_idempotency_history_unavailable|explorer_auth_required/);

  const tamperedPayloadBody = {
    ...revoked.payload!,
    publicSafeSummary: {
      ...revoked.payload!.publicSafeSummary,
      text: "tampered lifecycle payload",
    },
  };
  const { receipt: tamperedReceipt, ...tamperedBody } = tamperedPayloadBody;
  const payloadDrift = createHarness({
    initialPages: [active, {
      ...revoked,
      publicSafeSummary: tamperedBody.publicSafeSummary,
      payload: {
        ...tamperedBody,
        receipt: {
          ...tamperedReceipt,
          payloadHash: `sha256:${sha256Hex(stableResultPageJson(tamperedBody))}`,
        },
      },
    }],
  });
  assert.throws(() => payloadDrift.store.revoke({
    pageId: active.pageId,
    idempotencyKey: "pollution_revoke",
    operatorKey: "operator_secret",
  }), /result_page_idempotency_history_unavailable/);

  const missingSubjectHistory = createHarness({
    initialPages: [
      { ...active, idempotencySubjectHash: undefined },
      { ...revoked, idempotencySubjectHash: undefined },
    ],
  });
  assert.throws(() => missingSubjectHistory.store.revoke({
    pageId: active.pageId,
    idempotencyKey: "pollution_revoke",
    operatorKey: "operator_secret",
  }), /result_page_idempotency_history_unavailable/);

  const missingRevocationAudit = createHarness({
    initialPages: [active, { ...revoked, revokedAt: undefined }],
  });
  assert.throws(() => missingRevocationAudit.store.revoke({
    pageId: active.pageId,
    idempotencyKey: "pollution_revoke",
    operatorKey: "operator_secret",
  }), /result_page_idempotency_history_unavailable/);

  const missingDeletionAudit = createHarness({
    initialPages: [active, revoked, { ...deleted, deletedBy: undefined }],
  });
  assert.throws(() => missingDeletionAudit.store.delete({
    pageId: active.pageId,
    idempotencyKey: "pollution_delete",
    operatorKey: "operator_secret",
  }), /result_page_idempotency_history_unavailable/);

  const missingInheritedRevocationAudit = createHarness({
    initialPages: [active, revoked, {
      ...deleted,
      revokedAt: undefined,
      revokedBy: undefined,
      revokeReason: undefined,
    }],
  });
  assert.throws(() => missingInheritedRevocationAudit.store.delete({
    pageId: active.pageId,
    idempotencyKey: "pollution_delete",
    operatorKey: "operator_secret",
  }), /result_page_idempotency_history_unavailable/);

  const driftedInheritedRevocationAudit = createHarness({
    initialPages: [active, revoked, { ...deleted, revokedBy: "forged_operator" }],
  });
  assert.throws(() => driftedInheritedRevocationAudit.store.delete({
    pageId: active.pageId,
    idempotencyKey: "pollution_delete",
    operatorKey: "operator_secret",
  }), /result_page_idempotency_history_unavailable/);

  const chronologySource = createHarness();
  const chronologyActive = chronologySource.store.createFromPayload({
    idempotencyKey: "chronology_create",
    actorExplorerId: "explorer_1",
  }, payload()).page;
  chronologySource.advanceTo("2026-07-06T00:05:00.000Z");
  const chronologyFirstRevoke = chronologySource.store.revoke({
    pageId: chronologyActive.pageId,
    idempotencyKey: "chronology_revoke_1",
    operatorKey: "operator_secret",
  }).page;
  chronologySource.advanceTo("2026-07-06T00:10:00.000Z");
  const chronologySecondRevoke = chronologySource.store.revoke({
    pageId: chronologyActive.pageId,
    idempotencyKey: "chronology_revoke_2",
    operatorKey: "operator_secret",
  }).page;
  const reversedRevocationChronology = createHarness({
    initialPages: [chronologyActive, chronologyFirstRevoke, {
      ...chronologySecondRevoke,
      revokedAt: "2026-07-06T00:01:00.000Z",
    }],
  });
  assert.throws(() => reversedRevocationChronology.store.revoke({
    pageId: chronologyActive.pageId,
    idempotencyKey: "chronology_revoke_2",
    operatorKey: "operator_secret",
  }), /result_page_idempotency_history_unavailable/);

  const mismatchedDeletionSummary = createHarness({
    initialPages: [active, revoked, {
      ...deleted,
      deletionSummary: {
        ...deleted.deletionSummary!,
        deleteReason: "forged_summary_reason",
      },
    }],
  });
  assert.throws(() => mismatchedDeletionSummary.store.delete({
    pageId: active.pageId,
    idempotencyKey: "pollution_delete",
    operatorKey: "operator_secret",
  }), /result_page_idempotency_history_unavailable/);

  const legacyCreate = { ...active, idempotencySubjectHash: undefined };
  assert.throws(() => createHarness({ initialPages: [legacyCreate] }).store.createFromPayload({
    idempotencyKey: "pollution_create",
    actorExplorerId: "explorer_1",
  }, payload()), /result_page_idempotency_history_unavailable/);

  assert.throws(() => createHarness({ initialPages: [legacyRevoked] }).store.createFromPayload({
    idempotencyKey: "pollution_create",
    actorExplorerId: "explorer_1",
  }, payload()), /result_page_idempotency_history_unavailable/);
});
