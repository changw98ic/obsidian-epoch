import assert from "node:assert/strict";
import test from "node:test";
import type { EpochEvent } from "../lib/epoch/events.ts";
import type { EpochEventFactory } from "../lib/epoch/eventFactory.ts";
import {
  assertLoreAdjudicationStatus,
  assertLoreContributionCategory,
  assertLoreRevisionMode,
  canonCandidatePathFromInput,
  creatureBehaviorScopeReviewFor,
  crossRegionMechanismReviewFor,
  experimentalArtifactReview,
  fuzzyTimeIntervalReviewFor,
  assertLoreRefutationDailyQuota,
  loreContributionCost,
  loreContributionCostSpendPayload,
  loreContributionRecordPayload,
  loreContributionRevisionFields,
  loreContributionSourceEventIds,
  loreContributionSourceEvents,
  loreRefutationCountForRecordedDate,
  loreTargetAdjudicationHistory,
  loreTargetAdjudicationIds,
  loreTargetAdjudicationPayload,
  loreTargetAdjudicationStableKey,
  loreTargetSourceContributionEventIds,
  loreTargetSourceContributionEvents,
  optionalStringArray,
  planLoreContributionRecordEvents,
  planLoreTargetAdjudicationEvents,
  revisionPolicyFor,
} from "../lib/epoch/loreContributionRules.ts";

let eventSequence = 0;

const makeEvent = ((eventType, aggregateId, payload, options = {}) => ({
  eventId: `${eventType}_${++eventSequence}`,
  eventType,
  aggregateId,
  aggregateType: options.aggregateType || "agent_identity",
  agentId: options.agentId,
  payload,
  createdAt: "2026-07-07T00:00:00.000Z",
})) as EpochEventFactory;

function event(partial: {
  readonly eventId: string;
  readonly eventType: EpochEvent["eventType"];
  readonly payload: unknown;
} & Partial<Omit<EpochEvent, "eventId" | "eventType" | "payload">>): EpochEvent {
  return {
    aggregateType: "audit_record",
    aggregateId: partial.eventId,
    actorExplorerId: "system",
    trustClass: "system_worker",
    causationId: partial.eventId,
    correlationId: partial.eventId,
    createdAt: "2026-07-07T00:00:00.000Z",
    ...partial,
  } as EpochEvent;
}

test("lore contribution rules validate category revision and experiment review", () => {
  assert.equal(assertLoreContributionCategory("confirmation"), "confirmation");
  assert.throws(() => assertLoreContributionCategory("debug" as never), /lore_contribution_category_invalid/);
  assert.equal(assertLoreRevisionMode(undefined), "suggestion");
  assert.throws(() => assertLoreRevisionMode("direct_edit"), /lore_revision_direct_edit_forbidden/);
  assert.equal(assertLoreAdjudicationStatus("confirmed"), "confirmed");
  assert.throws(() => assertLoreAdjudicationStatus("accepted"), /lore_adjudication_status_invalid/);
  assert.deepEqual(optionalStringArray([" a ", "a", "", "b", 1], 4), ["a", "b"]);
  assert.deepEqual(revisionPolicyFor({
    mode: "derived",
    parentClaimId: "claim_1",
    mergeTargetIds: ["claim_2"],
  }), {
    mode: "derived",
    allowedRevisionModes: ["suggestion", "derived", "merge", "downgrade"],
    originalClaimMutable: false,
    claimTextEffect: "derived_version",
    requiresReview: true,
    parentClaimId: "claim_1",
    mergeTargetIds: ["claim_2"],
  });
  assert.throws(() => experimentalArtifactReview({
    experimentId: "exp_1",
  }), /experiment_main_rule_review_required/);
  assert.deepEqual(experimentalArtifactReview({
    experimentId: " exp_1 ",
    mainRuleReview: {
      status: "passed",
      rulesetVersion: "v1",
      reviewedBy: "curator",
      note: "ok",
    },
  }), {
    experimentId: "exp_1",
    mainRuleReview: {
      status: "passed",
      rulesetVersion: "v1",
      reviewedBy: "curator",
      note: "ok",
    },
  });
});

test("lore contribution rules describe contribution focus costs", () => {
  assert.deepEqual(loreContributionSourceEventIds([
    " epoch_event_report_1 ",
    "epoch_event_report_1",
    "",
    7,
    "epoch_event_report_2",
  ]), ["epoch_event_report_1", "epoch_event_report_2"]);
  assert.equal(loreContributionCost({ category: "confirmation" }), undefined);
  assert.deepEqual(loreContributionCost({ category: "refutation" }), {
    resourceId: "focus",
    amount: 1,
    reason: "lore_refutation_cost",
  });
  assert.deepEqual(loreContributionCost({ category: "revision" }), {
    resourceId: "focus",
    amount: 1,
    reason: "lore_revision_cost",
  });
  assert.deepEqual(loreContributionCostSpendPayload({
    category: "refutation",
    currentFocus: 3,
  }), {
    resourceId: "focus",
    amount: 1,
    reason: "lore_refutation_cost",
    balanceAfter: 2,
  });
});

test("lore contribution rules resolve source events and reject weak provenance", () => {
  const projection = {
    identities: {
      epoch_agent_owner: { explorerId: "explorer_owner" },
      epoch_agent_other: { explorerId: "explorer_other" },
    },
  };
  const officialSource = event({
    eventId: "epoch_event_identity_1",
    eventType: "identity_issued",
    agentId: "epoch_agent_owner",
    actorExplorerId: "explorer_owner",
    payload: {
      agentId: "epoch_agent_owner",
      explorerId: "explorer_owner",
    },
  });
  const ownNonEvidence = event({
    eventId: "epoch_event_own_private_1",
    eventType: "turn_resolved",
    agentId: "epoch_agent_owner",
    payload: {
      agentId: "epoch_agent_owner",
      nonEvidence: true,
    },
  });
  const otherNonEvidence = event({
    eventId: "epoch_event_other_private_1",
    eventType: "turn_resolved",
    agentId: "epoch_agent_other",
    payload: {
      agentId: "epoch_agent_other",
      nonEvidence: true,
    },
  });
  const derivedRevision = event({
    eventId: "epoch_event_derived_revision_1",
    eventType: "lore_contribution_recorded",
    agentId: "epoch_agent_owner",
    actorExplorerId: "explorer_owner",
    payload: {
      agentId: "epoch_agent_owner",
      category: "revision",
      revisionMode: "derived",
    },
  });
  const events = [officialSource, ownNonEvidence, otherNonEvidence, derivedRevision];

  const sourceEvents = loreContributionSourceEvents({
    category: "confirmation",
    events,
    explorerId: "explorer_owner",
    projection,
    sourceEventIds: ["epoch_event_own_private_1", "epoch_event_identity_1"],
  });
  assert.deepEqual(sourceEvents.map((sourceEvent) => sourceEvent.eventId), [
    "epoch_event_own_private_1",
    "epoch_event_identity_1",
  ]);

  assert.throws(() => loreContributionSourceEvents({
    category: "confirmation",
    events,
    explorerId: "explorer_owner",
    projection,
    sourceEventIds: [],
  }), /lore_contribution_source_event_required/);
  assert.throws(() => loreContributionSourceEvents({
    category: "confirmation",
    events,
    explorerId: "explorer_owner",
    projection,
    sourceEventIds: ["epoch_event_missing"],
  }), /lore_contribution_source_event_not_found/);
  assert.throws(() => loreContributionSourceEvents({
    category: "confirmation",
    events,
    explorerId: "explorer_owner",
    projection,
    sourceEventIds: ["epoch_event_other_private_1"],
  }), /lore_contribution_non_evidence_source/);
  assert.throws(() => loreContributionSourceEvents({
    category: "refutation",
    events,
    explorerId: "explorer_owner",
    projection,
    sourceEventIds: ["epoch_event_derived_revision_1"],
  }), /lore_refutation_low_authority_source/);
  assert.doesNotThrow(() => loreContributionSourceEvents({
    category: "refutation",
    events,
    explorerId: "explorer_owner",
    projection,
    sourceEventIds: ["epoch_event_identity_1"],
  }));
});

test("lore contribution rules normalize revision fields and enforce refutation quota", () => {
  assert.deepEqual(loreContributionRevisionFields({
    category: "confirmation",
    revisionMode: "direct_edit",
  }), {});
  assert.throws(() => loreContributionRevisionFields({
    category: "revision",
    revisionMode: "direct_edit",
  }), /lore_revision_direct_edit_forbidden/);

  const fields = loreContributionRevisionFields({
    category: "revision",
    revisionMode: "derived",
    revisedClaimText: "  新文本  ",
    originalClaimExplorerId: " explorer_original ",
    parentClaimId: " claim_parent ",
    mergeTargetIds: [" claim_a ", "claim_a", "claim_b"],
    downgradeReason: "  证据降级  ",
  });
  assert.equal(fields.revisionMode, "derived");
  assert.equal(fields.revisedClaimText, "新文本");
  assert.deepEqual(fields.mergeTargetIds, ["claim_a", "claim_b"]);
  assert.equal(fields.revisionPolicy?.claimTextEffect, "derived_version");

  const previousRefutations = [
    event({
      eventId: "epoch_event_refutation_1",
      eventType: "lore_contribution_recorded",
      payload: {
        agentId: "epoch_agent_1",
        category: "refutation",
        recordedAt: "2026-07-07T01:00:00.000Z",
      },
    }),
    event({
      eventId: "epoch_event_refutation_2",
      eventType: "lore_contribution_recorded",
      payload: {
        agentId: "epoch_agent_1",
        category: "refutation",
        recordedAt: "2026-07-07T02:00:00.000Z",
      },
    }),
  ];
  assert.equal(loreRefutationCountForRecordedDate({
    events: previousRefutations,
    agentId: "epoch_agent_1",
    recordedAt: "2026-07-07T03:00:00.000Z",
  }), 2);
  assert.doesNotThrow(() => assertLoreRefutationDailyQuota({
    category: "refutation",
    events: previousRefutations,
    agentId: "epoch_agent_1",
    recordedAt: "2026-07-07T03:00:00.000Z",
  }));
  assert.throws(() => assertLoreRefutationDailyQuota({
    category: "refutation",
    events: previousRefutations,
    agentId: "epoch_agent_1",
    recordedAt: "2026-07-07T03:00:00.000Z",
    quota: 2,
  }), /lore_refutation_daily_quota_exceeded/);
});

test("lore contribution rules build contribution records with aliases and optional reviews", () => {
  const sourceEventIds = ["epoch_event_report_1"];
  const revisionPolicy = revisionPolicyFor({
    mode: "derived",
    parentClaimId: "claim_parent",
    mergeTargetIds: ["claim_merge"],
  });
  const record = loreContributionRecordPayload({
    contributionId: "lore_contribution_1",
    claimHash: "sha256:aaaaaaaaaaaaaaaa" as `sha256:${string}`,
    category: "revision",
    agentId: "epoch_agent_1",
    explorerId: "explorer_1",
    targetId: "灰港纪年",
    summary: "修订后的灰港纪年条目。",
    revisionMode: "derived",
    revisionPolicy,
    revisedClaimText: "灰港纪年修订文本。",
    originalClaimExplorerId: "explorer_original",
    parentClaimId: "claim_parent",
    mergeTargetIds: ["claim_merge"],
    downgradeReason: "证据不足，降级为传闻。",
    sourceEventIds,
    provenance: {
      receiptType: "lore_contribution_provenance",
      targetId: "灰港纪年",
      sourceEventIds,
      sourceEventCount: 1,
      sourceEventTypes: ["turn_resolved"],
      sourceAgentIds: ["epoch_agent_1"],
      sourceAggregateIds: ["epoch_event_report_1"],
      sourceTrustClasses: ["system_worker"],
      sourceEvents: [],
      evidenceHash: "sha256:bbbbbbbbbbbbbbbb",
      recordedAt: "2026-07-07T02:00:00.000Z",
    },
    experimentReview: {
      experimentId: "exp_1",
      mainRuleReview: {
        status: "passed",
        rulesetVersion: "v1",
      },
    },
    fuzzyTimeIntervalReview: {
      subjectType: "fuzzy_time",
      expression: "大约 1024 年左右",
      intervalStartYear: 1023,
      intervalEndYear: 1025,
      occupancyWeight: 3,
      overlapCount: 0,
      congestionLevel: "low",
      reason: "模糊年份已映射为时间区间，并计入同目标时间线拥挤度。",
    },
    cost: {
      resourceId: "focus",
      amount: 1,
      reason: "lore_revision_cost",
    },
    recordedAt: "2026-07-07T02:00:00.000Z",
  });

  sourceEventIds.push("epoch_event_mutated");
  assert.equal(record.claimId, "lore_contribution_1");
  assert.equal(record.claimType, "revision");
  assert.equal(record.claimText, "修订后的灰港纪年条目。");
  assert.equal(record.mainRuleReview?.rulesetVersion, "v1");
  assert.deepEqual(record.mergeTargetIds, ["claim_merge"]);
  assert.deepEqual(record.sourceEventIds, ["epoch_event_report_1"]);
  assert.equal(record.cost?.reason, "lore_revision_cost");
  assert.equal(record.fuzzyTimeIntervalReview?.congestionLevel, "low");
});

test("lore contribution rules build target adjudication payloads", () => {
  assert.deepEqual(loreTargetSourceContributionEventIds([
    " epoch_event_contribution_1 ",
    "epoch_event_contribution_1",
    "",
    7,
    "epoch_event_contribution_2",
  ]), ["epoch_event_contribution_1", "epoch_event_contribution_2"]);

  assert.deepEqual(loreTargetAdjudicationIds({
    adjudicationId: "lore_adjudication_1",
    previousAdjudicationId: "lore_adjudication_0",
  }), {
    previousAdjudicationId: "lore_adjudication_0",
    newAdjudicationId: "lore_adjudication_1",
  });

  const sourceContributionEventIds = ["epoch_event_contribution_1"];
  const payload = loreTargetAdjudicationPayload({
    adjudicationId: "lore_adjudication_1",
    previousAdjudicationId: "lore_adjudication_0",
    targetId: "灰港纪年",
    status: "confirmed",
    summary: "采纳为章节候选。",
    sourceContributionEventIds,
    provenance: {
      receiptType: "lore_target_adjudication_provenance",
      previousAdjudicationId: "lore_adjudication_0",
      newAdjudicationId: "lore_adjudication_1",
      targetId: "灰港纪年",
      sourceContributionEventIds,
      sourceContributionEventCount: 1,
      sourceAgentIds: ["epoch_agent_1"],
      sourceTrustClasses: ["system_worker"],
      sourceContributions: [],
      evidenceHash: "sha256:cccccccccccccccc",
      adjudicatedAt: "2026-07-07T03:00:00.000Z",
    },
    canonCandidate: {
      requested: true,
      status: "candidate",
      chapterReviewId: "chapter_review_1",
      curatorApprovedBy: "curator_1",
      migrationSummary: "个人传闻以章节正史为准。",
      attribution: {
        sourceContributionEventIds,
        sourceReportEventIds: ["epoch_event_report_1"],
        sourceAgentIds: ["epoch_agent_1"],
        sourceExplorerIds: ["explorer_1"],
        sourceContributions: [],
        sourceReports: [],
      },
      reason: "章节复审已批准，可进入正史候选。",
    },
    authorityReview: {
      sourceAuthorities: ["core"],
      highAuthoritySourceEventIds: ["epoch_event_contribution_1"],
      lowAuthoritySourceEventIds: [],
      evidenceQuality: "strong",
      canHardRefute: true,
      recommendedStatus: "hard_refutation_allowed",
      reason: "来源包含 core/official 权威资料，可进入硬反驳裁定。",
    },
    operatorId: "operator_1",
    adjudicatedAt: "2026-07-07T03:00:00.000Z",
  });

  sourceContributionEventIds.push("epoch_event_mutated");
  assert.equal(payload.newAdjudicationId, "lore_adjudication_1");
  assert.equal(payload.previousAdjudicationId, "lore_adjudication_0");
  assert.deepEqual(payload.sourceContributionEventIds, ["epoch_event_contribution_1"]);
  assert.equal(payload.canonCandidate?.chapterReviewId, "chapter_review_1");
  assert.equal(payload.authorityReview?.evidenceQuality, "strong");
  assert.equal(loreTargetAdjudicationStableKey({
    targetId: "灰港纪年",
    status: "confirmed",
    sourceContributionEventIds: ["epoch_event_contribution_1"],
    adjudicationSequence: 2,
    summary: "采纳为章节候选。",
    canonCandidate: payload.canonCandidate,
  }), `灰港纪年:confirmed:epoch_event_contribution_1:review-2:采纳为章节候选。:${JSON.stringify(payload.canonCandidate)}`);
});

test("lore contribution rules plan record and adjudication event sequences", () => {
  const record = loreContributionRecordPayload({
    contributionId: "lore_contribution_1",
    claimHash: "sha256:aaaaaaaaaaaaaaaa" as `sha256:${string}`,
    category: "revision",
    agentId: "epoch_agent_1",
    explorerId: "explorer_1",
    targetId: "灰港纪年",
    summary: "修订后的灰港纪年条目。",
    sourceEventIds: ["epoch_event_report_1"],
    provenance: {
      receiptType: "lore_contribution_provenance",
      targetId: "灰港纪年",
      sourceEventIds: ["epoch_event_report_1"],
      sourceEventCount: 1,
      sourceEventTypes: ["turn_resolved"],
      sourceAgentIds: ["epoch_agent_1"],
      sourceAggregateIds: ["epoch_event_report_1"],
      sourceTrustClasses: ["system_worker"],
      sourceEvents: [],
      evidenceHash: "sha256:bbbbbbbbbbbbbbbb",
      recordedAt: "2026-07-07T02:00:00.000Z",
    },
    cost: {
      resourceId: "focus",
      amount: 1,
      reason: "lore_revision_cost",
    },
    recordedAt: "2026-07-07T02:00:00.000Z",
  });

  const recordEvents = planLoreContributionRecordEvents({
    makeEvent,
    contributionId: record.contributionId,
    agentId: record.agentId,
    record,
    costSpendPayload: {
      resourceId: "focus",
      amount: 1,
      reason: "lore_revision_cost",
      balanceAfter: 2,
    },
  });

  assert.deepEqual(recordEvents.map((item) => item.eventType), [
    "resource_spent",
    "lore_contribution_recorded",
  ]);
  assert.equal(recordEvents[0].aggregateType, "resource_account");
  assert.equal(recordEvents[1].aggregateType, "audit_record");
  assert.equal(recordEvents[1].agentId, "epoch_agent_1");
  const contributionPayload = recordEvents[1].payload as { readonly contributionId?: string };
  assert.equal(contributionPayload.contributionId, "lore_contribution_1");

  const adjudication = loreTargetAdjudicationPayload({
    adjudicationId: "lore_adjudication_1",
    targetId: "灰港纪年",
    status: "confirmed",
    summary: "采纳为章节候选。",
    sourceContributionEventIds: ["epoch_event_contribution_1"],
    provenance: {
      receiptType: "lore_target_adjudication_provenance",
      newAdjudicationId: "lore_adjudication_1",
      targetId: "灰港纪年",
      sourceContributionEventIds: ["epoch_event_contribution_1"],
      sourceContributionEventCount: 1,
      sourceAgentIds: ["epoch_agent_1"],
      sourceTrustClasses: ["system_worker"],
      sourceContributions: [],
      evidenceHash: "sha256:cccccccccccccccc",
      adjudicatedAt: "2026-07-07T03:00:00.000Z",
    },
    operatorId: "operator_1",
    adjudicatedAt: "2026-07-07T03:00:00.000Z",
  });
  const adjudicationEvents = planLoreTargetAdjudicationEvents({
    makeEvent,
    adjudicationId: adjudication.adjudicationId,
    adjudication,
  });
  assert.equal(adjudicationEvents.length, 1);
  assert.equal(adjudicationEvents[0].eventType, "lore_target_adjudicated");
  assert.equal(adjudicationEvents[0].aggregateType, "audit_record");
  const adjudicationPayload = adjudicationEvents[0].payload as { readonly adjudicationId?: string };
  assert.equal(adjudicationPayload.adjudicationId, "lore_adjudication_1");
});

test("lore contribution rules resolve target adjudication source contributions", () => {
  const contribution = event({
    eventId: "epoch_event_contribution_1",
    eventType: "lore_contribution_recorded",
    payload: {
      targetId: "灰港纪年",
    },
  });
  const secondContribution = event({
    eventId: "epoch_event_contribution_2",
    eventType: "lore_contribution_recorded",
    payload: {
      targetId: "灰港纪年",
    },
  });
  const otherTargetContribution = event({
    eventId: "epoch_event_contribution_other",
    eventType: "lore_contribution_recorded",
    payload: {
      targetId: "废矿传闻",
    },
  });
  const nonContribution = event({
    eventId: "epoch_event_turn_1",
    eventType: "turn_resolved",
    payload: {},
  });
  const events = [secondContribution, nonContribution, otherTargetContribution, contribution];

  const sourceContributionEvents = loreTargetSourceContributionEvents({
    events,
    sourceContributionEventIds: ["epoch_event_contribution_1", "epoch_event_contribution_2"],
    targetId: "灰港纪年",
  });
  assert.deepEqual(sourceContributionEvents.map((sourceEvent) => sourceEvent.eventId), [
    "epoch_event_contribution_1",
    "epoch_event_contribution_2",
  ]);

  assert.throws(() => loreTargetSourceContributionEvents({
    events,
    sourceContributionEventIds: [],
    targetId: "灰港纪年",
  }), /lore_adjudication_source_contribution_required/);
  assert.throws(() => loreTargetSourceContributionEvents({
    events,
    sourceContributionEventIds: ["epoch_event_missing"],
    targetId: "灰港纪年",
  }), /lore_adjudication_source_event_not_found/);
  assert.throws(() => loreTargetSourceContributionEvents({
    events,
    sourceContributionEventIds: ["epoch_event_turn_1"],
    targetId: "灰港纪年",
  }), /lore_adjudication_source_event_not_contribution/);
  assert.throws(() => loreTargetSourceContributionEvents({
    events,
    sourceContributionEventIds: ["epoch_event_contribution_other"],
    targetId: "灰港纪年",
  }), /lore_adjudication_source_target_mismatch/);
});

test("lore contribution rules fold target adjudication history", () => {
  const firstAdjudication = event({
    eventId: "epoch_event_adjudication_1",
    eventType: "lore_target_adjudicated",
    payload: {
      adjudicationId: "lore_adjudication_1",
      targetId: "灰港纪年",
    },
  });
  const otherTargetAdjudication = event({
    eventId: "epoch_event_adjudication_other",
    eventType: "lore_target_adjudicated",
    payload: {
      adjudicationId: "lore_adjudication_other",
      targetId: "废矿传闻",
    },
  });
  const secondAdjudication = event({
    eventId: "epoch_event_adjudication_2",
    eventType: "lore_target_adjudicated",
    payload: {
      adjudicationId: "lore_adjudication_2",
      targetId: "灰港纪年",
    },
  });

  assert.deepEqual(loreTargetAdjudicationHistory({
    events: [firstAdjudication, otherTargetAdjudication, secondAdjudication],
    targetId: "灰港纪年",
  }), {
    adjudicationSequence: 3,
    previousAdjudication: secondAdjudication.payload,
    previousAdjudicationId: "lore_adjudication_2",
  });
  assert.deepEqual(loreTargetAdjudicationHistory({
    events: [firstAdjudication, otherTargetAdjudication, secondAdjudication],
    targetId: "新条目",
  }), {
    adjudicationSequence: 1,
  });
});

test("lore contribution rules review creature behavior scope", () => {
  assert.equal(creatureBehaviorScopeReviewFor({
    targetId: "archive_note",
    summary: "普通地点记录",
  }), undefined);
  assert.throws(() => creatureBehaviorScopeReviewFor({
    targetId: "creature:灰港幼兽",
    summary: "E级 普通 行为影响整个世界",
  }), /creature_behavior_scope_explanation_required/);
  const review = creatureBehaviorScopeReviewFor({
    targetId: "creature:灰港幼兽",
    summary: "E级 普通 行为影响整个世界，因为外部污染放大",
  });
  assert.equal(review?.claimedScope, "world");
  assert.equal(review?.allowedScope, "local");
  assert.equal(review?.status, "explained_exception");
  assert.equal(review?.explanation, "external_pollution");
});

test("lore contribution rules map fuzzy time intervals and congestion", () => {
  const previous = event({
    eventId: "epoch_event_1",
    eventType: "lore_contribution_recorded",
    payload: {
      targetId: "灰港纪年",
      fuzzyTimeIntervalReview: {
        intervalStartYear: 1023,
        intervalEndYear: 1025,
      },
    },
  });
  const review = fuzzyTimeIntervalReviewFor({
    events: [previous],
    targetId: "灰港纪年",
    summary: "大约 1024 年左右，港口第一次出现黑潮。",
  });
  assert.equal(review?.expression, "大约 1024 年左右");
  assert.equal(review?.intervalStartYear, 1023);
  assert.equal(review?.intervalEndYear, 1025);
  assert.equal(review?.overlapCount, 1);
  assert.equal(review?.congestionLevel, "medium");
});

test("lore contribution rules require support for high-tier cross-region mechanisms", () => {
  assert.equal(crossRegionMechanismReviewFor({
    targetId: "local_note",
    summary: "普通港口记录",
  }), undefined);
  assert.throws(() => crossRegionMechanismReviewFor({
    targetId: "灰港到废矿",
    summary: "梦境裂隙连接灰港和废矿",
  }), /cross_region_mechanism_support_required/);
  const review = crossRegionMechanismReviewFor({
    targetId: "灰港到废矿",
    summary: "梦境裂隙连接灰港和废矿，已有路线支持。",
  });
  assert.equal(review?.tier, "high");
  assert.equal(review?.mechanism, "dream_rift");
  assert.equal(review?.fromRegionId, "region_gray_harbor");
  assert.equal(review?.toRegionId, "region_abandoned_mine");
  assert.equal(review?.support, "route_support");
});

test("lore contribution rules build canon candidate attribution", () => {
  const contribution = event({
    eventId: "epoch_event_contribution_1",
    eventType: "lore_contribution_recorded",
    payload: {
      contributionId: "lore_contribution_1",
      agentId: "epoch_agent_1",
      explorerId: "explorer_1",
      targetId: "灰港纪年",
      provenance: {
        sourceEvents: [{
          eventId: "epoch_event_report_1",
          eventType: "run_submitted",
          agentId: "epoch_agent_1",
          actorExplorerId: "explorer_1",
          publicPages: {
            audit: "/epoch/audit/epoch_event_report_1",
          },
        }],
      },
    },
  });
  assert.throws(() => canonCandidatePathFromInput({ requested: true }, [contribution]), /lore_canon_candidate_chapter_review_required/);
  const path = canonCandidatePathFromInput({
    requested: true,
    chapterReviewId: "chapter_review_1",
    curatorApprovedBy: "curator_1",
    migrationSummary: "个人版本以新正史为准。",
    adoptedText: "灰港纪年正史条目。",
  }, [contribution]);
  assert.equal(path?.status, "candidate");
  assert.equal(path?.chapterReviewId, "chapter_review_1");
  assert.deepEqual(path?.attribution.sourceContributionEventIds, ["epoch_event_contribution_1"]);
  assert.deepEqual(path?.attribution.sourceReportEventIds, ["epoch_event_report_1"]);
  assert.deepEqual(path?.attribution.sourceAgentIds, ["epoch_agent_1"]);
  assert.deepEqual(path?.attribution.sourceExplorerIds, ["explorer_1"]);
});
