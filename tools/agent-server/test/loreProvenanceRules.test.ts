import assert from "node:assert/strict";
import test from "node:test";

import type { EpochEvent } from "../lib/epoch/events.ts";
import {
  createLoreContributionProvenance,
  createLoreTargetAdjudicationProvenance,
  loreAuthorityReviewForSourceContributions,
  loreClaimHash,
  loreContributionProvenanceForEvent,
  loreEvidenceHash,
  loreTargetAdjudicationProvenanceForEvent,
  stableLoreEvidenceJson,
  uniqueSortedValues,
} from "../lib/epoch/loreProvenanceRules.ts";

function eventFixture(overrides: {
  readonly eventId?: string;
  readonly eventType?: EpochEvent["eventType"];
  readonly aggregateType?: EpochEvent["aggregateType"];
  readonly aggregateId?: string;
  readonly actorExplorerId?: string;
  readonly agentId?: string;
  readonly trustClass?: EpochEvent["trustClass"];
  readonly createdAt?: string;
  readonly payload?: unknown;
} = {}): EpochEvent {
  return {
    eventId: overrides.eventId || "event_source_1",
    eventType: overrides.eventType || "resource_granted",
    aggregateType: overrides.aggregateType || "resource_account",
    aggregateId: overrides.aggregateId || "agent_1",
    actorExplorerId: overrides.actorExplorerId || "explorer_1",
    agentId: overrides.agentId || "agent_1",
    trustClass: overrides.trustClass || "user_verified_web",
    causationId: "cause_1",
    correlationId: "corr_1",
    createdAt: overrides.createdAt || "2026-07-06T00:00:00.000Z",
    payload: overrides.payload || {
      agentId: "agent_1",
      resourceId: "focus",
      amount: 1,
      reason: "test",
      grantedAt: "2026-07-06T00:00:00.000Z",
    },
  } as unknown as EpochEvent;
}

function loreContributionEvent(overrides: {
  readonly eventId?: string;
  readonly revisionMode?: "derived";
  readonly trustClass?: EpochEvent["trustClass"];
  readonly sourceEventIds?: readonly string[];
  readonly recordedAt?: string;
} = {}): EpochEvent {
  const eventId = overrides.eventId || "event_lore_1";
  return eventFixture({
    eventId,
    eventType: "lore_contribution_recorded",
    aggregateType: "audit_record",
    aggregateId: "target_1",
    trustClass: overrides.trustClass || "user_verified_web",
    createdAt: overrides.recordedAt || "2026-07-06T00:01:00.000Z",
    payload: {
      contributionId: `contribution_${eventId}`,
      claimId: `contribution_${eventId}`,
      claimType: "confirmation",
      claimText: "确认灰港有异常活动",
      claimHash: "sha256:stored",
      category: overrides.revisionMode ? "revision" : "confirmation",
      revisionMode: overrides.revisionMode,
      agentId: "agent_1",
      explorerId: "explorer_1",
      targetId: "target_1",
      summary: "确认灰港有异常活动",
      sourceEventIds: overrides.sourceEventIds || ["event_source_1"],
      provenance: undefined,
      recordedAt: overrides.recordedAt || "2026-07-06T00:01:00.000Z",
    },
  });
}

test("lore evidence hashes are stable across object key order", () => {
  assert.equal(stableLoreEvidenceJson({ b: 2, a: 1 }), "{\"a\":1,\"b\":2}");
  assert.equal(loreEvidenceHash({ b: 2, a: 1 }), loreEvidenceHash({ a: 1, b: 2 }));
  assert.deepEqual(uniqueSortedValues(["b", undefined, "a", "b"]), ["a", "b"]);
});

test("lore claim hash includes shared contribution identity fields", () => {
  const base = {
    agentId: "agent_1",
    category: "confirmation" as const,
    contributionId: "contribution_1",
    explorerId: "explorer_1",
    recordedAt: "2026-07-06T00:00:00.000Z",
    sourceEventIds: ["event_source_1"],
    summary: "确认灰港有异常活动",
    targetId: "target_1",
  };

  assert.equal(loreClaimHash(base), loreClaimHash({ ...base, sourceEventIds: ["event_source_1"] }));
  assert.notEqual(loreClaimHash(base), loreClaimHash({ ...base, summary: "另一条设定" }));
});

test("contribution provenance summarizes source events and audit pages", () => {
  const source = eventFixture({ eventId: "event source/1", trustClass: "system_worker" });
  const provenance = createLoreContributionProvenance("target_1", [source], "2026-07-06T00:02:00.000Z");

  assert.equal(provenance.receiptType, "lore_contribution_provenance");
  assert.deepEqual(provenance.sourceEventIds, ["event source/1"]);
  assert.deepEqual(provenance.sourceTrustClasses, ["system_worker"]);
  assert.equal(provenance.sourceEvents[0]?.sourceAuthority, "core");
  assert.equal(provenance.sourceEvents[0]?.publicPages.audit, "/epoch/audit/event%20source%2F1");
});

test("runtime contribution provenance falls back from event projection and preserves stored event ids", () => {
  const source = eventFixture({ eventId: "event_source_1", trustClass: "system_worker" });
  const contributionEvent = loreContributionEvent({ sourceEventIds: ["event_source_1", "missing_event"] });
  const payload = contributionEvent.payload as {
    readonly targetId: string;
    readonly sourceEventIds: readonly string[];
    readonly recordedAt: string;
  };
  const provenance = loreContributionProvenanceForEvent(
    { events: [source, contributionEvent] },
    contributionEvent,
    {
      contributionId: "contribution_event_lore_1",
      category: "confirmation",
      agentId: "agent_1",
      targetId: payload.targetId,
      sourceEventIds: payload.sourceEventIds,
      recordedAt: payload.recordedAt,
    },
  );

  assert.equal(provenance.contributionEventId, contributionEvent.eventId);
  assert.deepEqual(provenance.sourceEventIds, ["event_source_1", "missing_event"]);
  assert.equal(provenance.sourceEventCount, 1);
  assert.equal(provenance.sourceEvents[0]?.sourceAuthority, "core");
});

test("target adjudication provenance and authority review distinguish weak and strong evidence", () => {
  const official = loreContributionEvent({ eventId: "official_event", trustClass: "user_verified_web" });
  const derived = loreContributionEvent({
    eventId: "derived_event",
    revisionMode: "derived",
    trustClass: "user_verified_web",
    recordedAt: "2026-07-06T00:03:00.000Z",
  });
  const provenance = createLoreTargetAdjudicationProvenance(
    "target_1",
    [official, derived],
    "2026-07-06T00:04:00.000Z",
    { newAdjudicationId: "adj_2" },
  );
  const review = loreAuthorityReviewForSourceContributions([official, derived]);

  assert.equal(provenance.receiptType, "lore_target_adjudication_provenance");
  assert.equal(provenance.newAdjudicationId, "adj_2");
  assert.deepEqual(provenance.sourceContributionEventIds, ["official_event", "derived_event"]);
  assert.deepEqual(review.sourceAuthorities, ["derived", "official"]);
  assert.deepEqual(review.highAuthoritySourceEventIds, ["official_event"]);
  assert.deepEqual(review.lowAuthoritySourceEventIds, ["derived_event"]);
  assert.equal(review.evidenceQuality, "mixed");
  assert.equal(review.canHardRefute, true);
});

test("runtime target adjudication provenance restores stored contribution references", () => {
  const contribution = loreContributionEvent({ eventId: "contribution_event" });
  const adjudicationEvent = eventFixture({
    eventId: "adjudication_event",
    eventType: "lore_target_adjudicated",
    aggregateType: "audit_record",
    aggregateId: "target_1",
    payload: {
      targetId: "target_1",
      sourceContributionEventIds: ["contribution_event", "missing_contribution"],
      adjudicatedAt: "2026-07-06T00:05:00.000Z",
    },
  });
  const provenance = loreTargetAdjudicationProvenanceForEvent(
    { events: [contribution, adjudicationEvent] },
    adjudicationEvent,
    {
      targetId: "target_1",
      sourceContributionEventIds: ["contribution_event", "missing_contribution"],
      adjudicatedAt: "2026-07-06T00:05:00.000Z",
    },
  );

  assert.equal(provenance.adjudicationEventId, "adjudication_event");
  assert.deepEqual(provenance.sourceContributionEventIds, ["contribution_event"]);
  assert.equal(provenance.sourceContributionEventCount, 1);
  assert.equal(provenance.sourceContributions[0]?.publicPages.audit, "/epoch/audit/contribution_event");
});
