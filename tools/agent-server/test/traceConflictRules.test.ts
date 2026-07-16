import assert from "node:assert/strict";
import test from "node:test";

import {
  planTraceConflictDeployment,
  planTraceConflictTurn,
  traceConflictTemplateCatalog,
  type PlanTraceConflictDeploymentInput,
  type TraceConflictDeployment,
  type TraceConflictProjection,
  type TraceConflictResolutionServerIds,
} from "../lib/epoch/traceConflictRules.ts";

const DEPLOYED_AT = "2026-07-10T10:00:00.000Z";

function projection(overrides: Partial<TraceConflictProjection> = {}): TraceConflictProjection {
  return {
    identities: {
      agent_a: { explorerId: "explorer_a", status: "active" },
      agent_a_alt: { explorerId: "explorer_a", status: "active" },
      agent_b: { explorerId: "explorer_b", status: "active" },
      agent_archived: { explorerId: "explorer_archived", status: "archived" },
    },
    npcTargets: {
      npc_adult: { linkedExplorerId: "explorer_b", isChild: false },
      npc_own: { linkedExplorerId: "explorer_a", isChild: false },
      npc_child: { linkedExplorerId: "explorer_b", isChild: true },
    },
    resourceBalances: {
      agent_a: { focus: 20, aether: 20 },
      agent_a_alt: { focus: 20, aether: 20 },
      agent_b: { focus: 20, aether: 20 },
      agent_archived: { focus: 20, aether: 20 },
    },
    deployments: [],
    ...overrides,
  };
}

function serverIds(suffix: string) {
  return {
    deploymentEventId: `event_deploy_${suffix}`,
    resourceSpendEventIds: {
      focus: `event_focus_${suffix}`,
      aether: `event_aether_${suffix}`,
    },
    auditId: `audit_deploy_${suffix}`,
  };
}

function deploymentInput(
  overrides: Partial<PlanTraceConflictDeploymentInput> = {},
): PlanTraceConflictDeploymentInput {
  return {
    projection: projection(),
    authorization: {
      authenticated: true,
      actorExplorerId: "explorer_a",
      authorizedAgentId: "agent_a",
    },
    sourceAgentId: "agent_a",
    templateKey: "shadow_snare",
    scope: {
      regionId: "region_gray_harbor",
      target: { kind: "agent", id: "agent_b" },
    },
    traceId: "trace_1",
    deployedAt: DEPLOYED_AT,
    sourceEventIds: ["event_turn_source", "event_owner_auth"],
    serverIds: serverIds("1"),
    ...overrides,
  };
}

function deploy(
  templateKey: string,
  sourceAgentId: string,
  sourceExplorerId: string,
  traceId: string,
  scope: PlanTraceConflictDeploymentInput["scope"],
  deployedAt = DEPLOYED_AT,
): TraceConflictDeployment {
  return planTraceConflictDeployment(deploymentInput({
    projection: projection(),
    authorization: {
      authenticated: true,
      actorExplorerId: sourceExplorerId,
      authorizedAgentId: sourceAgentId,
    },
    sourceAgentId,
    templateKey,
    traceId,
    scope,
    deployedAt,
    sourceEventIds: [`source_${traceId}`],
    serverIds: serverIds(traceId),
  })).deployment;
}

function resolutionIds(
  traceId: string,
  extras: Partial<TraceConflictResolutionServerIds> = {},
): TraceConflictResolutionServerIds {
  return {
    outcomeEventId: `event_outcome_${traceId}`,
    auditId: `audit_outcome_${traceId}`,
    effectEventId: `event_effect_${traceId}`,
    memoryEventId: `event_memory_${traceId}`,
    ...extras,
  };
}

test("catalog exposes client-selectable keys without server hazard power or rewards", () => {
  const catalog = traceConflictTemplateCatalog();
  assert.deepEqual(catalog.map((entry) => entry.type), ["trap", "rumor", "false_lead", "ward"]);
  assert.equal(catalog.every((entry) => entry.costs.length > 0), true);
  assert.equal(catalog.every((entry) => entry.costs.every((cost) => (
    cost.resourceId === "focus" || cost.resourceId === "aether"
  ))), true);
  assert.equal(catalog.some((entry) => "potency" in entry || "reward" in entry), false);
  assert.throws(
    () => planTraceConflictDeployment(deploymentInput({ templateKey: "client_super_trap" })),
    /trace_conflict_template_unknown/,
  );
});

test("deployment ignores arbitrary client power and reward fields and uses the server template", () => {
  const input: PlanTraceConflictDeploymentInput & {
    readonly hazardPower: number;
    readonly reward: { readonly resourceId: string; readonly amount: number };
  } = {
    ...deploymentInput(),
    hazardPower: 999_999,
    reward: { resourceId: "legend", amount: 999_999 },
  };

  const result = planTraceConflictDeployment(input);
  assert.deepEqual(result.deployment.effect, {
    kind: "turn_pressure",
    effectKey: "shadow_snare_delay",
    potency: 2,
  });
  assert.equal("reward" in result.deployment, false);
  assert.equal("hazardPower" in result.deployment, false);
});

test("deployment requires authenticated ownership of the source agent", () => {
  assert.throws(() => planTraceConflictDeployment(deploymentInput({
    authorization: {
      authenticated: false,
      actorExplorerId: "explorer_a",
      authorizedAgentId: "agent_a",
    },
  })), /trace_conflict_owner_auth_required/);
  assert.throws(() => planTraceConflictDeployment(deploymentInput({
    authorization: {
      authenticated: true,
      actorExplorerId: "explorer_b",
      authorizedAgentId: "agent_a",
    },
  })), /trace_conflict_owner_mismatch/);
  assert.throws(() => planTraceConflictDeployment(deploymentInput({
    authorization: {
      authenticated: true,
      actorExplorerId: "explorer_a",
      authorizedAgentId: "agent_b",
    },
  })), /trace_conflict_authorized_agent_mismatch/);
  assert.throws(() => planTraceConflictDeployment(deploymentInput({
    sourceAgentId: "agent_archived",
    authorization: {
      authenticated: true,
      actorExplorerId: "explorer_archived",
      authorizedAgentId: "agent_archived",
    },
  })), /trace_conflict_source_identity_inactive/);
});

test("deployment plans authoritative focus and aether ledger spends with exact balances", () => {
  const result = planTraceConflictDeployment(deploymentInput({
    templateKey: "mirrored_tracks",
  }));

  assert.deepEqual(result.events.map((event) => event.kind), [
    "resource_spent",
    "resource_spent",
    "trace_conflict_deployed",
  ]);
  assert.deepEqual(result.events.slice(0, 2).map((event) => ({
    eventId: event.eventId,
    resourceId: event.kind === "resource_spent" ? event.resourceId : undefined,
    amount: event.kind === "resource_spent" ? event.amount : undefined,
    balanceAfter: event.kind === "resource_spent" ? event.balanceAfter : undefined,
  })), [
    { eventId: "event_focus_1", resourceId: "focus", amount: 1, balanceAfter: 19 },
    { eventId: "event_aether_1", resourceId: "aether", amount: 2, balanceAfter: 18 },
  ]);
  assert.deepEqual(result.balancesAfter, { focus: 19, aether: 18 });
  assert.equal(result.deployment.authorizationMode, "owner_authenticated");
  assert.deepEqual(result.deployment.sourceEventIds, ["event_turn_source", "event_owner_auth"]);
  assert.deepEqual(result.deployment.auditIds, ["audit_deploy_1"]);
});

test("deployment rejects insufficient server-ledger resources", () => {
  assert.throws(() => planTraceConflictDeployment(deploymentInput({
    projection: projection({
      resourceBalances: {
        agent_a: { focus: 20, aether: 1 },
      },
    }),
    templateKey: "mirrored_tracks",
  })), /trace_conflict_resource_insufficient:aether/);
});

test("hostile targeting blocks self, same explorer, own NPC, and child NPC", () => {
  assert.throws(() => planTraceConflictDeployment(deploymentInput({
    scope: { target: { kind: "agent", id: "agent_a" } },
  })), /trace_conflict_self_target_forbidden/);
  assert.throws(() => planTraceConflictDeployment(deploymentInput({
    scope: { target: { kind: "agent", id: "agent_a_alt" } },
  })), /trace_conflict_same_explorer_target_forbidden/);
  assert.throws(() => planTraceConflictDeployment(deploymentInput({
    scope: { target: { kind: "npc", id: "npc_own" } },
  })), /trace_conflict_same_explorer_target_forbidden/);
  assert.throws(() => planTraceConflictDeployment(deploymentInput({
    scope: { target: { kind: "npc", id: "npc_child" } },
  })), /trace_conflict_child_npc_target_forbidden/);
});

test("scope is optional and wards may protect the owner's own agent", () => {
  const global = planTraceConflictDeployment(deploymentInput({ scope: undefined }));
  assert.deepEqual(global.deployment.scope, {});

  const ward = planTraceConflictDeployment(deploymentInput({
    templateKey: "aether_sentinel",
    scope: {
      regionId: "region_gray_harbor",
      target: { kind: "agent", id: "agent_a" },
    },
  }));
  assert.equal(ward.deployment.type, "ward");
  assert.equal(ward.deployment.scope.target?.id, "agent_a");
});

test("same-type cooldown is server-time based and opens exactly at its boundary", () => {
  const first = deploy(
    "shadow_snare",
    "agent_a",
    "explorer_a",
    "trace_first",
    { target: { kind: "agent", id: "agent_b" } },
  );
  const nextProjection = projection({ deployments: [first] });

  assert.throws(() => planTraceConflictDeployment(deploymentInput({
    projection: nextProjection,
    traceId: "trace_early",
    deployedAt: "2026-07-10T10:09:59.999Z",
    serverIds: serverIds("early"),
  })), /trace_conflict_deploy_rate_limited:2026-07-10T10:10:00.000Z/);
  assert.doesNotThrow(() => planTraceConflictDeployment(deploymentInput({
    projection: nextProjection,
    traceId: "trace_boundary",
    deployedAt: "2026-07-10T10:10:00.000Z",
    serverIds: serverIds("boundary"),
  })));
});

test("turn activation requires authoritative turn ownership and exact scope match", () => {
  const trap = deploy(
    "shadow_snare",
    "agent_a",
    "explorer_a",
    "trace_scope",
    {
      regionId: "region_gray_harbor",
      target: { kind: "agent", id: "agent_b" },
    },
  );
  const base = {
    projection: projection(),
    deployments: [trap],
    serverIdsByTraceId: { trace_scope: resolutionIds("trace_scope") },
  };

  assert.throws(() => planTraceConflictTurn({
    ...base,
    turnCard: {
      turnCardId: "turn_forged",
      agentId: "agent_b",
      explorerId: "explorer_a",
      regionId: "region_gray_harbor",
      sourceEventId: "event_turn_forged",
      occurredAt: "2026-07-10T10:05:00.000Z",
    },
  }), /trace_conflict_turn_actor_mismatch/);

  const mismatched = planTraceConflictTurn({
    ...base,
    turnCard: {
      turnCardId: "turn_other_region",
      agentId: "agent_b",
      explorerId: "explorer_b",
      regionId: "region_black_archive",
      sourceEventId: "event_turn_other_region",
      occurredAt: "2026-07-10T10:05:00.000Z",
    },
  });
  assert.equal(mismatched.events.length, 0);
  assert.equal(mismatched.deployments[0]?.status, "active");
});

test("only a turn strictly after deployment can activate a trace", () => {
  const trap = deploy(
    "shadow_snare",
    "agent_a",
    "explorer_a",
    "trace_future_only",
    { regionId: "region_gray_harbor", target: { kind: "agent", id: "agent_b" } },
  );

  for (const occurredAt of ["2026-07-10T09:59:59.999Z", DEPLOYED_AT]) {
    const result = planTraceConflictTurn({
      projection: projection(),
      deployments: [trap],
      turnCard: {
        turnCardId: `turn_${occurredAt}`,
        agentId: "agent_b",
        explorerId: "explorer_b",
        regionId: "region_gray_harbor",
        sourceEventId: `event_${occurredAt}`,
        occurredAt,
      },
      serverIdsByTraceId: {},
    });
    assert.equal(result.events.length, 0);
    assert.equal(result.deployments[0]?.status, "active");
  }
});

test("global hazards cannot trigger on the source agent or another identity of the same explorer", () => {
  const trap = deploy("shadow_snare", "agent_a", "explorer_a", "trace_global", undefined);

  for (const [agentId, turnCardId] of [["agent_a", "turn_self"], ["agent_a_alt", "turn_alt"]] as const) {
    const result = planTraceConflictTurn({
      projection: projection(),
      deployments: [trap],
      turnCard: {
        turnCardId,
        agentId,
        explorerId: "explorer_a",
        regionId: "region_gray_harbor",
        sourceEventId: `event_${turnCardId}`,
        occurredAt: "2026-07-10T10:05:00.000Z",
      },
      serverIdsByTraceId: {},
    });
    assert.equal(result.events.length, 0);
    assert.equal(result.deployments[0]?.status, "active");
  }
});

test("global hazards cannot use a later turn to target a child NPC", () => {
  const trap = deploy("shadow_snare", "agent_a", "explorer_a", "trace_child_global", undefined);
  const result = planTraceConflictTurn({
    projection: projection(),
    deployments: [trap],
    turnCard: {
      turnCardId: "turn_child_npc",
      agentId: "agent_b",
      explorerId: "explorer_b",
      regionId: "region_gray_harbor",
      target: { kind: "npc", id: "npc_child" },
      sourceEventId: "event_turn_child_npc",
      occurredAt: "2026-07-10T10:05:00.000Z",
    },
    serverIdsByTraceId: {},
  });

  assert.equal(result.events.length, 0);
  assert.equal(result.deployments[0]?.status, "active");
});

test("matching trap activation uses only the server-authored effect and closes the state", () => {
  const trap = deploy(
    "shadow_snare",
    "agent_a",
    "explorer_a",
    "trace_trigger",
    { regionId: "region_gray_harbor", target: { kind: "agent", id: "agent_b" } },
  );
  const result = planTraceConflictTurn({
    projection: projection(),
    deployments: [trap],
    turnCard: {
      turnCardId: "turn_b",
      agentId: "agent_b",
      explorerId: "explorer_b",
      regionId: "region_gray_harbor",
      sourceEventId: "event_turn_b",
      occurredAt: "2026-07-10T10:05:00.000Z",
    },
    serverIdsByTraceId: { trace_trigger: resolutionIds("trace_trigger") },
  });

  assert.equal(result.deployments[0]?.status, "triggered");
  assert.equal(result.outcomes[0]?.outcome, "triggered");
  assert.deepEqual(result.effects[0]?.effect, {
    kind: "turn_pressure",
    effectKey: "shadow_snare_delay",
    potency: 2,
  });
  assert.deepEqual(result.outcomes[0]?.sourceEventIds, [
    trap.deploymentEventId,
    `source_${trap.traceId}`,
    "event_turn_b",
  ]);
  assert.deepEqual(result.outcomes[0]?.auditIds, [
    `audit_deploy_${trap.traceId}`,
    "audit_outcome_trace_trigger",
  ]);
});

test("one ward counters one trap or false lead and is consumed as triggered", () => {
  for (const [templateKey, suffix] of [["shadow_snare", "trap"], ["mirrored_tracks", "lead"]] as const) {
    const hazard = deploy(
      templateKey,
      "agent_a",
      "explorer_a",
      `trace_${suffix}`,
      { regionId: "region_gray_harbor", target: { kind: "agent", id: "agent_b" } },
    );
    const ward = deploy(
      "aether_sentinel",
      "agent_b",
      "explorer_b",
      `ward_${suffix}`,
      { regionId: "region_gray_harbor", target: { kind: "agent", id: "agent_b" } },
    );
    const result = planTraceConflictTurn({
      projection: projection(),
      deployments: [hazard, ward],
      turnCard: {
        turnCardId: `turn_${suffix}`,
        agentId: "agent_b",
        explorerId: "explorer_b",
        regionId: "region_gray_harbor",
        sourceEventId: `event_turn_${suffix}`,
        occurredAt: "2026-07-10T10:05:00.000Z",
      },
      serverIdsByTraceId: {
        [hazard.traceId]: resolutionIds(hazard.traceId),
        [ward.traceId]: resolutionIds(ward.traceId),
      },
    });
    assert.equal(result.deployments.find((entry) => entry.traceId === hazard.traceId)?.status, "countered");
    assert.equal(result.deployments.find((entry) => entry.traceId === ward.traceId)?.status, "triggered");
    assert.equal(result.effects.length, 0);
    assert.equal(result.memories.length, 0);
  }
});

test("rumors bypass wards but can only plan low-confidence non-truth memory", () => {
  const rumor = deploy(
    "whisper_seed",
    "agent_a",
    "explorer_a",
    "trace_rumor",
    { regionId: "region_gray_harbor", target: { kind: "agent", id: "agent_b" } },
  );
  const ward = deploy(
    "aether_sentinel",
    "agent_b",
    "explorer_b",
    "ward_rumor",
    { regionId: "region_gray_harbor", target: { kind: "agent", id: "agent_b" } },
  );
  const result = planTraceConflictTurn({
    projection: projection(),
    deployments: [rumor, ward],
    turnCard: {
      turnCardId: "turn_rumor",
      agentId: "agent_b",
      explorerId: "explorer_b",
      regionId: "region_gray_harbor",
      sourceEventId: "event_turn_rumor",
      occurredAt: "2026-07-10T10:05:00.000Z",
    },
    serverIdsByTraceId: {
      trace_rumor: resolutionIds("trace_rumor"),
    },
  });

  assert.equal(result.deployments.find((entry) => entry.traceId === "trace_rumor")?.status, "triggered");
  assert.equal(result.deployments.find((entry) => entry.traceId === "ward_rumor")?.status, "active");
  assert.deepEqual(result.memories[0], {
    memoryId: "event_memory_trace_rumor",
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
    sourceEventIds: [
      rumor.deploymentEventId,
      "source_trace_rumor",
      "event_turn_rumor",
      "event_outcome_trace_rumor",
    ],
    auditIds: ["audit_deploy_trace_rumor", "audit_outcome_trace_rumor"],
    recordedAt: "2026-07-10T10:05:00.000Z",
  });
  assert.equal("truth" in result.memories[0]!, false);
});

test("active deployments expire before matching at the exact server deadline", () => {
  const trap = deploy(
    "shadow_snare",
    "agent_a",
    "explorer_a",
    "trace_expired",
    { regionId: "region_gray_harbor", target: { kind: "agent", id: "agent_b" } },
  );
  const result = planTraceConflictTurn({
    projection: projection(),
    deployments: [trap],
    turnCard: {
      turnCardId: "turn_expiry",
      agentId: "agent_b",
      explorerId: "explorer_b",
      regionId: "region_gray_harbor",
      sourceEventId: "event_turn_expiry",
      occurredAt: trap.expiresAt,
    },
    serverIdsByTraceId: { trace_expired: resolutionIds("trace_expired") },
  });

  assert.equal(result.deployments[0]?.status, "expired");
  assert.equal(result.outcomes[0]?.outcome, "expired");
  assert.equal(result.outcomes[0]?.triggeredByTurnCardId, undefined);
  assert.equal(result.outcomes[0]?.sourceEventIds.includes("event_turn_expiry"), true);
  assert.equal(result.effects.length, 0);
  assert.equal(result.memories.length, 0);
});
