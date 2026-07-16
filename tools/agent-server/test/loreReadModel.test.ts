import assert from "node:assert/strict";
import test from "node:test";

import type { EpochEvent } from "../lib/epoch/events.ts";
import type { EpochProjection } from "../lib/epoch/gameCore.ts";
import {
  buildWorldHonorBoards,
  loreAdjudicationOverview,
  loreContributionCategoryFromInput,
  loreContributionsView,
  loreTargetStatusFromInput,
  loreTargetStatusesView,
} from "../lib/epoch/loreReadModel.ts";

function eventFixture(overrides: {
  readonly eventId?: string;
  readonly eventType?: EpochEvent["eventType"];
  readonly aggregateType?: EpochEvent["aggregateType"];
  readonly aggregateId?: string;
  readonly actorExplorerId?: string;
  readonly agentId?: string;
  readonly trustClass?: EpochEvent["trustClass"];
  readonly causationId?: string;
  readonly createdAt?: string;
  readonly payload?: unknown;
} = {}): EpochEvent {
  return {
    eventId: overrides.eventId || "event_source_1",
    eventType: overrides.eventType || "resource_granted",
    aggregateType: overrides.aggregateType || "resource_account",
    aggregateId: overrides.aggregateId || "agent_lore_1",
    actorExplorerId: overrides.actorExplorerId || "explorer_lore_1",
    agentId: overrides.agentId || "agent_lore_1",
    trustClass: overrides.trustClass || "user_verified_web",
    causationId: overrides.causationId || "cause_lore_1",
    correlationId: "corr_lore_1",
    createdAt: overrides.createdAt || "2026-07-06T00:00:00.000Z",
    payload: overrides.payload || {
      agentId: "agent_lore_1",
      resourceId: "focus",
      amount: 1,
      reason: "test",
      grantedAt: "2026-07-06T00:00:00.000Z",
    },
  } as unknown as EpochEvent;
}

function loreContributionEvent(overrides: {
  readonly eventId: string;
  readonly category: "confirmation" | "refutation" | "revision";
  readonly summary: string;
  readonly recordedAt: string;
  readonly agentId?: string;
  readonly explorerId?: string;
  readonly sourceEventIds?: readonly string[];
  readonly targetId?: string;
}): EpochEvent {
  const agentId = overrides.agentId || "agent_lore_1";
  const explorerId = overrides.explorerId || "explorer_lore_1";
  const targetId = overrides.targetId || "target_gray_harbor_lighthouse";
  return eventFixture({
    eventId: overrides.eventId,
    eventType: "lore_contribution_recorded",
    aggregateType: "audit_record",
    aggregateId: targetId,
    actorExplorerId: explorerId,
    agentId,
    createdAt: overrides.recordedAt,
    payload: {
      contributionId: `contribution_${overrides.eventId}`,
      category: overrides.category,
      agentId,
      explorerId,
      targetId,
      summary: overrides.summary,
      sourceEventIds: overrides.sourceEventIds || ["event_source_1"],
      recordedAt: overrides.recordedAt,
    },
  });
}

function projectionFixture(events: readonly EpochEvent[]): EpochProjection {
  return {
    events,
    identities: {
      agent_lore_1: {
        agentId: "agent_lore_1",
        explorerId: "explorer_lore_1",
        identityName: "灰港书记员",
      },
    },
  } as unknown as EpochProjection;
}

test("lore read model normalizes inputs and projects contribution cards", () => {
  const source = eventFixture({ eventId: "event_source_1", trustClass: "system_worker" });
  const confirmation = loreContributionEvent({
    eventId: "event_lore_confirm",
    category: "confirmation",
    summary: "确认灰港灯塔异常可被后续探索检验。",
    recordedAt: "2026-07-06T00:01:00.000Z",
  });
  const projection = projectionFixture([source, confirmation]);

  assert.equal(loreContributionCategoryFromInput("confirmation"), "confirmation");
  assert.equal(loreContributionCategoryFromInput("invalid"), undefined);
  assert.equal(loreTargetStatusFromInput("contested"), "contested");
  assert.equal(loreTargetStatusFromInput("invalid"), undefined);

  const contributions = loreContributionsView(projection, { limit: 10 });
  assert.equal(contributions.length, 1);
  assert.equal(contributions[0]?.eventId, "event_lore_confirm");
  assert.equal(contributions[0]?.identityName, "灰港书记员");
  assert.equal(contributions[0]?.publicPages.audit, "/epoch/audit/event_lore_confirm");
  assert.equal(contributions[0]?.provenance.sourceEventCount, 1);
});

test("lore target read model folds contested evidence and worldview gates", () => {
  const source = eventFixture({ eventId: "event_source_1", trustClass: "system_worker" });
  const confirmation = loreContributionEvent({
    eventId: "event_lore_confirm",
    category: "confirmation",
    summary: "确认灰港灯塔异常可被后续探索检验。",
    recordedAt: "2026-07-06T00:01:00.000Z",
  });
  const refutation = loreContributionEvent({
    eventId: "event_lore_refute",
    category: "refutation",
    summary: "反证灰港灯塔异常记录存在偏差，但仍可复核。",
    recordedAt: "2026-07-06T00:02:00.000Z",
  });
  const projection = projectionFixture([source, confirmation, refutation]);

  const targets = loreTargetStatusesView(projection, { limit: 10 });
  assert.equal(targets.length, 1);
  assert.equal(targets[0]?.status, "contested");
  assert.equal(targets[0]?.statusSource, "contribution_evidence");
  assert.equal(targets[0]?.counts.total, 2);
  assert.equal(targets[0]?.disputeArchiveGate?.status, "eligible");
  assert.equal(
    targets[0]?.worldviewGate.checks.find((check) => check.key === "core_vibe")?.status,
    "passed",
  );

  const overview = loreAdjudicationOverview(projection, 5);
  assert.equal(overview.pending, 1);
  assert.equal(overview.adjudicated, 0);
  assert.equal(overview.pendingTargets[0]?.targetId, "target_gray_harbor_lighthouse");
});

test("lore read model honors system adjudication and builds world honor boards", () => {
  const source = eventFixture({ eventId: "event_source_1", trustClass: "system_worker" });
  const confirmation = loreContributionEvent({
    eventId: "event_lore_confirm",
    category: "confirmation",
    summary: "确认灰港灯塔异常可被后续探索检验。",
    recordedAt: "2026-07-06T00:01:00.000Z",
  });
  const adjudication = eventFixture({
    eventId: "event_lore_adjudicated",
    eventType: "lore_target_adjudicated",
    aggregateType: "audit_record",
    aggregateId: "target_gray_harbor_lighthouse",
    trustClass: "system_worker",
    createdAt: "2026-07-06T00:03:00.000Z",
    payload: {
      targetId: "target_gray_harbor_lighthouse",
      status: "confirmed",
      summary: "系统确认灰港灯塔异常记录进入共享设定。",
      sourceContributionEventIds: ["event_lore_confirm"],
      adjudicatedAt: "2026-07-06T00:03:00.000Z",
    },
  });
  const turn = eventFixture({
    eventId: "event_turn_low",
    eventType: "turn_resolved",
    aggregateType: "turn_card",
    aggregateId: "turn_1",
    createdAt: "2026-07-06T00:04:00.000Z",
    payload: {
      agentId: "agent_lore_1",
      risk: "low",
    },
  });
  const projection = projectionFixture([source, confirmation, adjudication, turn]);

  const targets = loreTargetStatusesView(projection, { limit: 10 });
  assert.equal(targets[0]?.status, "confirmed");
  assert.equal(targets[0]?.statusSource, "system_adjudication");
  assert.equal(targets[0]?.latestAdjudication?.publicPages.audit, "/epoch/audit/event_lore_adjudicated");

  const overview = loreAdjudicationOverview(projection, 5);
  assert.equal(overview.pending, 0);
  assert.equal(overview.adjudicated, 1);

  const boards = buildWorldHonorBoards(projection, 5);
  assert.equal(boards.find((board) => board.category === "confirmation")?.entries[0]?.score, 1);
  assert.equal(boards.find((board) => board.category === "exploration")?.entries[0]?.latestEventId, "event_turn_low");
  assert.equal(boards.find((board) => board.category === "low_risk_stability")?.entries[0]?.identityName, "灰港书记员");
});
