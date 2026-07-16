import assert from "node:assert/strict";
import test from "node:test";

import type { EpochEvent } from "../lib/epoch/events.ts";
import {
  LOW_AUTHORITY_REFUTATION_AUTHORITIES,
  assertKnownSourceEvents,
  auditPageForEventId,
  loreSourceEventProvenance,
  normalizeSourceEventIds,
  riskReviewAnalysisForEvent,
  riskReviewFlagsForEvent,
  riskReviewScoreForEvent,
  riskReviewSourceEvent,
  riskReviewableEvent,
  sourceAuthorityForEvent,
  sourceEventExplorerId,
  sourceEventIsNonEvidence,
} from "../lib/epoch/sourceEventRules.ts";

interface EventFixtureOverrides {
  readonly eventId?: EpochEvent["eventId"];
  readonly eventType?: EpochEvent["eventType"];
  readonly aggregateType?: EpochEvent["aggregateType"];
  readonly aggregateId?: EpochEvent["aggregateId"];
  readonly actorExplorerId?: EpochEvent["actorExplorerId"];
  readonly agentId?: EpochEvent["agentId"];
  readonly trustClass?: EpochEvent["trustClass"];
  readonly causationId?: EpochEvent["causationId"];
  readonly correlationId?: EpochEvent["correlationId"];
  readonly idempotencyKey?: EpochEvent["idempotencyKey"];
  readonly createdAt?: EpochEvent["createdAt"];
  readonly payload?: unknown;
}

function eventFixture(overrides: EventFixtureOverrides = {}): EpochEvent {
  return {
    eventId: "epoch_event_001",
    eventType: "resource_granted",
    aggregateType: "resource_account",
    aggregateId: "agent_1",
    actorExplorerId: "explorer_1",
    agentId: "agent_1",
    trustClass: "user_verified_web",
    causationId: "cause_1",
    correlationId: "corr_1",
    createdAt: "2026-07-06T00:00:00.000Z",
    payload: {
      agentId: "agent_1",
      resourceId: "focus",
      amount: 1,
      reason: "test",
      grantedAt: "2026-07-06T00:00:00.000Z",
    },
    ...overrides,
  } as unknown as EpochEvent;
}

test("risk review rules collect trade flags and prefer positive risk scores", () => {
  const event = eventFixture({
    payload: {
      tradeRiskFlags: ["wash", " wash ", "", "velocity"],
      tradeRiskScore: 7,
    },
  });

  assert.deepEqual(riskReviewFlagsForEvent(event), ["wash", "velocity"]);
  assert.equal(riskReviewScoreForEvent(event), 7);
  assert.equal(riskReviewableEvent(event), true);
  assert.deepEqual(riskReviewAnalysisForEvent(event), {
    reviewFlags: ["wash", "velocity"],
    reviewScore: 7,
  });
});

test("moderation queue events are reviewable even without trade score", () => {
  const event = eventFixture({
    eventType: "moderation_queued",
    aggregateType: "moderation_item",
    aggregateId: "mod_1",
    payload: {
      moderationId: "mod_1",
      subjectType: "message",
      sourceEventId: "event_1",
      reason: "authority_claim",
      severity: "medium",
      queuedAt: "2026-07-06T00:00:00.000Z",
    },
  });

  assert.deepEqual(riskReviewFlagsForEvent(event), ["moderation:authority_claim"]);
  assert.equal(riskReviewScoreForEvent(event), 1);
  assert.equal(riskReviewableEvent(event), true);
});

test("risk review rules resolve source events and reject non-reviewable events", () => {
  const reviewable = eventFixture({
    eventId: "epoch_event_reviewable",
    payload: {
      tradeRiskFlags: ["velocity"],
    },
  });
  const nonReviewable = eventFixture({
    eventId: "epoch_event_safe",
    payload: {},
  });

  assert.equal(riskReviewSourceEvent({
    events: [nonReviewable, reviewable],
    sourceEventId: "epoch_event_reviewable",
  }), reviewable);
  assert.throws(() => riskReviewSourceEvent({
    events: [nonReviewable],
    sourceEventId: "epoch_event_missing",
  }), /risk_review_source_event_not_found/);
  assert.throws(() => riskReviewAnalysisForEvent(nonReviewable), /risk_review_source_event_not_reviewable/);
});

test("source event rules normalize required IDs and reject missing projection events", () => {
  const normalized = normalizeSourceEventIds([" event_a ", "event_a", "event_b"], "source_event_id");
  assert.deepEqual(normalized, ["event_a", "event_b"]);
  assert.throws(() => normalizeSourceEventIds([], "source_event_id"), /source_event_id_required/);
  assert.throws(() => normalizeSourceEventIds([""], "source_event_id"), /source_event_id_required/);

  assert.doesNotThrow(() => assertKnownSourceEvents({
    events: [
      eventFixture({ eventId: "event_a" }),
      eventFixture({ eventId: "event_b" }),
    ],
  }, normalized));
  assert.throws(() => assertKnownSourceEvents({
    events: [eventFixture({ eventId: "event_a" })],
  }, normalized), /source_event_not_found/);
});

test("source authority rules preserve official, derived, and low-confidence evidence boundaries", () => {
  assert.equal(sourceAuthorityForEvent(eventFixture({ eventType: "identity_issued" })), "official");
  assert.equal(sourceAuthorityForEvent(eventFixture({
    eventType: "lore_contribution_recorded",
    aggregateType: "audit_record",
    aggregateId: "target_1",
    payload: {
      category: "revision",
      revisionMode: "derived",
    },
  })), "derived");
  assert.equal(sourceAuthorityForEvent(eventFixture({
    trustClass: "system_worker",
    payload: { nonEvidence: true },
  })), "low-confidence");
  assert.equal(sourceAuthorityForEvent(eventFixture({ trustClass: "system_worker" })), "core");
  assert.equal(LOW_AUTHORITY_REFUTATION_AUTHORITIES.has("derived"), true);
  assert.equal(LOW_AUTHORITY_REFUTATION_AUTHORITIES.has("official"), false);
});

test("source event provenance normalizes trust and points to the public audit route", () => {
  const provenance = loreSourceEventProvenance(eventFixture({
    eventId: "event with spaces",
    trustClass: "invalid_trust" as unknown as EpochEvent["trustClass"],
  }));

  assert.equal(provenance.eventId, "event with spaces");
  assert.equal(provenance.trustClass, "untrusted_client");
  assert.equal(provenance.sourceAuthority, "low-confidence");
  assert.equal(provenance.publicPages.audit, "/epoch/audit/event%20with%20spaces");
  assert.equal(auditPageForEventId("event/1"), "/epoch/audit/event%2F1");
});

test("source event explorer lookup prefers identity ownership and ignores system actors", () => {
  const projection = {
    identities: {
      agent_1: { explorerId: "explorer_identity" },
      agent_2: { explorerId: "explorer_payload" },
    },
  };

  assert.equal(sourceEventExplorerId(projection, eventFixture()), "explorer_identity");
  assert.equal(sourceEventExplorerId(projection, eventFixture({
    agentId: undefined,
    payload: { agentId: "agent_2" },
  })), "explorer_payload");
  assert.equal(sourceEventExplorerId(projection, eventFixture({
    agentId: undefined,
    actorExplorerId: "system",
    payload: {},
  })), undefined);
  assert.equal(sourceEventIsNonEvidence(eventFixture({ payload: { nonEvidence: true } })), true);
});
