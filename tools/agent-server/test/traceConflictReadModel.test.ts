import assert from "node:assert/strict";
import test from "node:test";

import {
  traceConflictMemoryView,
  traceConflictOwnerView,
  traceConflictRegionView,
  type TraceConflictReadProjection,
} from "../lib/epoch/traceConflictReadModel.ts";
import type {
  TraceConflictDeployment,
  TraceConflictRumorMemory,
} from "../lib/epoch/traceConflictRules.ts";

function deployment(
  traceId: string,
  overrides: Partial<TraceConflictDeployment> = {},
): TraceConflictDeployment {
  return {
    traceId,
    templateKey: "shadow_snare",
    type: "trap",
    title: "影索陷阱",
    sourceAgentId: "agent_a",
    sourceExplorerId: "explorer_a",
    authorizationMode: "owner_authenticated",
    scope: { regionId: "region_gray_harbor" },
    costs: [{ resourceId: "focus", amount: 2 }],
    effect: {
      kind: "turn_pressure",
      effectKey: "shadow_snare_delay",
      potency: 2,
    },
    status: "active",
    deployedAt: "2026-07-10T10:00:00.000Z",
    expiresAt: "2026-07-10T10:30:00.000Z",
    cooldownUntil: "2026-07-10T10:10:00.000Z",
    deploymentEventId: `event_deploy_${traceId}`,
    resourceSpendEventIds: [`event_spend_${traceId}`],
    sourceEventIds: [`event_source_${traceId}`],
    auditIds: [`audit_deploy_${traceId}`],
    ...overrides,
  };
}

function memory(memoryId: string, overrides: Partial<TraceConflictRumorMemory> = {}): TraceConflictRumorMemory {
  return {
    memoryId,
    traceId: "trace_rumor",
    targetAgentId: "agent_b",
    targetExplorerId: "explorer_b",
    regionId: "region_gray_harbor",
    memoryTemplateKey: "uncorroborated_whisper",
    summary: "一条未经证实的区域耳语，只能作为低置信线索保留。",
    confidence: "low",
    authority: "low-confidence",
    nonEvidence: true,
    canMutateTruth: false,
    sourceEventIds: ["event_rumor", "event_outcome_rumor"],
    auditIds: ["audit_rumor"],
    recordedAt: "2026-07-10T10:05:00.000Z",
    ...overrides,
  };
}

test("owner view returns only owner-authenticated deployments for the requested explorer and agent", () => {
  const projection: TraceConflictReadProjection = {
    deployments: [
      deployment("own_old", { deployedAt: "2026-07-10T09:00:00.000Z" }),
      deployment("own_new", { sourceAgentId: "agent_a_alt", deployedAt: "2026-07-10T11:00:00.000Z" }),
      deployment("other", { sourceAgentId: "agent_b", sourceExplorerId: "explorer_b" }),
    ],
  };

  assert.deepEqual(
    traceConflictOwnerView(projection, { explorerId: "explorer_a" }).map((entry) => entry.traceId),
    ["own_new", "own_old"],
  );
  assert.deepEqual(
    traceConflictOwnerView(projection, { explorerId: "explorer_a", agentId: "agent_a" }).map((entry) => entry.traceId),
    ["own_old"],
  );
  assert.equal(traceConflictOwnerView(projection, { explorerId: "explorer_missing" }).length, 0);
});

test("owner view exposes bounded source and audit navigation without effect power", () => {
  const resolved = deployment("resolved", {
    status: "countered",
    resolvedAt: "2026-07-10T10:06:00.000Z",
    outcomeEventId: "event_outcome_resolved",
    resolutionAuditId: "audit_resolution_resolved",
    counteredByTraceId: "ward_1",
  });
  const [view] = traceConflictOwnerView({ deployments: [resolved] }, { explorerId: "explorer_a" });

  assert.ok(view);
  assert.deepEqual(view.sourceEvents, [
    { eventId: "event_source_resolved", href: "/epoch/audit/event_source_resolved" },
    { eventId: "event_deploy_resolved", href: "/epoch/audit/event_deploy_resolved" },
    { eventId: "event_outcome_resolved", href: "/epoch/audit/event_outcome_resolved" },
  ]);
  assert.deepEqual(view.audits, [
    { auditId: "audit_deploy_resolved", href: "/epoch/audit/audit_deploy_resolved" },
    { auditId: "audit_resolution_resolved", href: "/epoch/audit/audit_resolution_resolved" },
  ]);
  assert.equal("effect" in view, false);
  assert.equal("potency" in view, false);
});

test("region view hides active hostile deployments while showing owner and terminal state", () => {
  const projection: TraceConflictReadProjection = {
    deployments: [
      deployment("viewer_active"),
      deployment("other_active", {
        sourceAgentId: "agent_b",
        sourceExplorerId: "explorer_b",
      }),
      deployment("other_terminal", {
        sourceAgentId: "agent_b",
        sourceExplorerId: "explorer_b",
        status: "triggered",
        resolvedAt: "2026-07-10T10:05:00.000Z",
        outcomeEventId: "event_outcome_other",
      }),
      deployment("other_region", {
        scope: { regionId: "region_black_archive" },
        sourceAgentId: "agent_b",
        sourceExplorerId: "explorer_b",
      }),
      deployment("global_hidden", {
        scope: {},
        sourceAgentId: "agent_b",
        sourceExplorerId: "explorer_b",
      }),
    ],
  };
  const view = traceConflictRegionView(projection, {
    regionId: "region_gray_harbor",
    viewerExplorerId: "explorer_a",
  });

  assert.deepEqual(view.deployments.map((entry) => entry.traceId), ["viewer_active", "other_terminal"]);
  assert.equal(view.deployments.some((entry) => "costs" in entry || "effect" in entry), false);
  assert.equal(view.deployments.find((entry) => entry.traceId === "other_terminal")?.redacted, true);
  assert.deepEqual(view.deployments.find((entry) => entry.traceId === "other_terminal")?.audits, []);
});

test("anonymous region view reveals only resolved conflicts", () => {
  const view = traceConflictRegionView({
    deployments: [
      deployment("active"),
      deployment("expired", {
        status: "expired",
        resolvedAt: "2026-07-10T10:30:00.000Z",
        outcomeEventId: "event_outcome_expired",
      }),
    ],
  }, { regionId: "region_gray_harbor" });

  assert.deepEqual(view.deployments.map((entry) => entry.traceId), ["expired"]);
  assert.equal(view.deployments[0]?.redacted, true);
  assert.equal(view.deployments[0]?.sourceAgentId, undefined);
});

test("memory view is private to its target explorer and remains non-evidence", () => {
  const projection: TraceConflictReadProjection = {
    deployments: [],
    memories: [
      memory("memory_b"),
      memory("memory_c", {
        targetAgentId: "agent_c",
        targetExplorerId: "explorer_c",
        recordedAt: "2026-07-10T11:00:00.000Z",
      }),
    ],
  };

  assert.equal(traceConflictMemoryView(projection, { explorerId: "explorer_a" }).length, 0);
  assert.deepEqual(traceConflictMemoryView(projection, { explorerId: "explorer_b" }), [{
    memoryId: "memory_b",
    traceId: "trace_rumor",
    targetAgentId: "agent_b",
    regionId: "region_gray_harbor",
    memoryTemplateKey: "uncorroborated_whisper",
    summary: "一条未经证实的区域耳语，只能作为低置信线索保留。",
    confidence: "low",
    authority: "low-confidence",
    nonEvidence: true,
    canMutateTruth: false,
    recordedAt: "2026-07-10T10:05:00.000Z",
    sourceEvents: [
      { eventId: "event_rumor", href: "/epoch/audit/event_rumor" },
      { eventId: "event_outcome_rumor", href: "/epoch/audit/event_outcome_rumor" },
    ],
    audits: [{ auditId: "audit_rumor", href: "/epoch/audit/audit_rumor" }],
  }]);
});

test("read limits reject invalid values and cap oversized requests", () => {
  assert.throws(
    () => traceConflictOwnerView({ deployments: [] }, { explorerId: "explorer_a", limit: 0 }),
    /trace_conflict_read_limit_invalid/,
  );
  const deployments = Array.from({ length: 210 }, (_, index) => deployment(`trace_${index}`));
  assert.equal(
    traceConflictOwnerView({ deployments }, { explorerId: "explorer_a", limit: 1_000 }).length,
    200,
  );
});
