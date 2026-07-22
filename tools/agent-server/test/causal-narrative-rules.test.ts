import assert from "node:assert/strict";
import test from "node:test";

import {
  actionProposalFromOpportunity,
  deriveCausalNarrative,
  opportunitySeedFromOpportunity,
  settleNarrativeCandidate,
  transitionNarrativeThread,
  worldPredicateEffectFromOpportunity,
  type NarrativeThread,
  type NarrativeThreadState,
} from "../lib/epoch/causalNarrativeRules.ts";
import type { ActorMind, GoalRef } from "../lib/epoch/actorMindRules.ts";
import type { CausalWorldEventV1 } from "../lib/epoch/causalContracts.ts";
import type { EpochKnowledgeRecord } from "../lib/epoch/knowledgeStateRules.ts";
import type { EpochWorldPressure } from "../lib/epoch/worldPressureRules.ts";

const WORLD_ID = "world_gray_harbor";
const WORLD_MINUTE = 2_000;

function event(eventId: string, overrides: Partial<CausalWorldEventV1> = {}): CausalWorldEventV1 {
  return {
    eventId,
    eventType: "legal.case.filed",
    schemaVersion: "1.0.0",
    registryVersion: "registry.v1",
    registryHash: "sha256:registry",
    worldId: WORLD_ID,
    namespace: "world",
    stream: { streamType: "region", streamId: "gray_harbor", streamVersion: 1 },
    occurredAtWorldMinute: WORLD_MINUTE - 10,
    recordedAt: "2026-07-20T00:00:00.000Z",
    actorRefs: [{ actorType: "npc", actorId: "warden" }],
    subjectRefs: [{ entityType: "actor", entityId: "warden" }],
    regionRefs: ["gray_harbor"],
    command: {
      commandId: `command_${eventId}`,
      commandType: "test",
      idempotencyKey: `idem_${eventId}`,
      inputHash: "sha256:input",
    },
    causality: { causalParentEventIds: [], rootPressureIds: ["pressure_legal"] },
    authorizationRefs: ["auth:test"],
    evidenceRefs: [eventId],
    visibilityPolicyRef: "public",
    versions: {
      rulesetVersion: "test",
      contentVersion: "test",
      adjudicatorVersion: "test",
    },
    determinism: { algorithmId: "test", algorithmVersion: "1" },
    payload: {},
    effects: [],
    proof: {
      payloadHash: "sha256:payload",
      effectsHash: "sha256:effects",
      eventHash: "sha256:event",
    },
    ...overrides,
  };
}

function pressure(overrides: Partial<EpochWorldPressure> = {}): EpochWorldPressure {
  return {
    pressureId: "pressure_legal",
    type: "legal",
    scopeRef: "region:gray_harbor",
    sourceFactEventIds: ["event_case"],
    affectedActorRefs: ["actor:warden", "actor:merchant"],
    affectedResourceRefs: ["resource:restitution_fund"],
    severity: 120,
    urgency: -10,
    growthRate: 40,
    uncertainty: 70,
    visibility: 80,
    state: "contested",
    counterPressureIds: ["pressure_counter_claim"],
    openedAtWorldMinute: 1_000,
    updatedAtWorldMinute: 1_500,
    reviewAtWorldMinute: 2_360,
    ...overrides,
  };
}

function goal(goalRef = "goal:resolve_case", score = 70): GoalRef {
  return {
    goalRef,
    label: goalRef,
    score,
    scoreBreakdown: {
      needRelief: 0,
      valueFit: 0,
      roleDuty: 0,
      relationshipDuty: 0,
      expectedGain: 0,
      identityFit: 0,
      urgency: 0,
      feasibility: 0,
      expectedRiskPenalty: 0,
      resourceCostPenalty: 0,
      legalCostPenalty: 0,
      commitmentConflictPenalty: 0,
      total: score,
    },
    supportingBeliefRefs: ["event_case"],
    conflictingCommitmentRefs: [],
  };
}

function actorMind(overrides: Partial<ActorMind> = {}): ActorMind {
  return {
    actorRef: "actor:warden",
    needs: [],
    values: [],
    roles: [],
    beliefs: ["event_case", "knowledge_case_fact", "knowledge_case_claim"],
    relationships: [{
      relationshipRef: "relationship:warden_merchant",
      targetActorRef: "actor:merchant",
      dutyRef: "duty:hear_petition",
      weight: -130,
      beliefRefs: ["event_case"],
    }],
    commitments: [
      {
        commitmentRef: "commitment:promise_hearing",
        kind: "player_promise",
        beneficiaryRef: "actor:merchant",
        contentRef: "content:hear_case",
        dueAtWorldMinute: 2_500,
        cost: 0,
        breachConditionRef: "breach:miss_hearing",
        transferable: false,
        evidenceRefs: ["event_case"],
        weight: 70,
        status: "active",
        beliefRefs: ["event_case"],
      },
      {
        commitmentRef: "commitment:debt_restitution",
        kind: "debt",
        beneficiaryRef: "actor:merchant",
        contentRef: "content:restore_goods",
        dueAtWorldMinute: 2_800,
        cost: 55,
        breachConditionRef: "breach:default_restitution",
        transferable: true,
        evidenceRefs: ["event_case"],
        weight: 80,
        status: "disputed",
        beliefRefs: ["event_case"],
      },
    ],
    activeGoals: [goal()],
    queuedGoals: [],
    constraints: [],
    riskTolerance: 35,
    planningHorizonWorldMinutes: 180,
    simulationLod: 2,
    ...overrides,
  };
}

function knowledgeRecord(
  id: string,
  overrides: Partial<EpochKnowledgeRecord> = {},
): EpochKnowledgeRecord {
  return {
    id,
    kind: "fact",
    subject: "case:merchant_claim",
    text: id,
    confidence: 0.8,
    status: "accepted",
    evidence: {
      evidenceIds: ["event_case"],
      sourceEventIds: ["event_case"],
      sourceChain: [{
        sourceId: "event_case",
        sourceType: "causal_event",
        trustClass: "system_worker",
        sourceAuthority: "core",
        channel: "canonical",
        hop: 0,
        evidenceIds: ["event_case"],
        confirmationBias: 0,
      }],
      trustClasses: ["system_worker"],
      sourceAuthorities: ["core"],
      channels: ["canonical"],
      hopCount: 0,
      confirmationBias: 0,
    },
    visibility: {
      scopes: ["public"],
      legalAccess: "public",
      regionIds: ["gray_harbor"],
      organizationIds: [],
      agentIds: [],
      explorerIds: [],
      evidenceIds: [],
    },
    supports: [],
    refutes: [],
    refutedBy: [],
    supersedes: [],
    ...overrides,
  };
}

function derive(overrides: Partial<Parameters<typeof deriveCausalNarrative>[0]> = {}) {
  return deriveCausalNarrative({
    worldId: WORLD_ID,
    worldMinute: WORLD_MINUTE,
    events: [event("event_case")],
    pressures: [pressure()],
    actorMinds: [actorMind()],
    knowledgeRecords: [
      knowledgeRecord("knowledge_case_fact"),
      knowledgeRecord("knowledge_case_claim", { kind: "claim", supports: ["knowledge_case_fact"], confidence: 0.72 }),
      knowledgeRecord("knowledge_refutation", {
        kind: "refutation",
        status: "accepted",
        refutes: ["knowledge_case_claim"],
        confidence: 0.65,
      }),
      knowledgeRecord("knowledge_hidden_secret", {
        visibility: {
          scopes: ["agent"],
          legalAccess: "owner",
          regionIds: [],
          organizationIds: [],
          agentIds: ["hidden_agent"],
          explorerIds: [],
          evidenceIds: [],
        },
      }),
    ],
    caller: { agentId: "warden", regionId: "gray_harbor", trustClass: "system_worker", legalAccess: ["public"] },
    ...overrides,
  });
}

function derivedThread(): NarrativeThread {
  const result = derive();
  assert.equal(result.threads.length, 1);
  return result.threads[0]!;
}

test("keeps every legal narrative thread transition and rejects illegal transitions", () => {
  const legalTransitions: Readonly<Record<NarrativeThreadState, readonly NarrativeThreadState[]>> = {
    proposed: ["proposed", "active", "dormant", "failed"],
    active: ["active", "escalating", "resolving", "resolved", "failed", "dormant", "transformed"],
    escalating: ["escalating", "active", "resolving", "failed", "transformed"],
    resolving: ["resolving", "active", "resolved", "failed", "dormant", "transformed"],
    resolved: ["resolved"],
    failed: ["failed", "dormant", "transformed"],
    dormant: ["dormant", "proposed", "active", "failed"],
    transformed: ["transformed"],
  };
  const states = Object.keys(legalTransitions) as NarrativeThreadState[];
  const base = derivedThread();

  for (const fromState of states) {
    for (const toState of states) {
      const input = {
        thread: { ...base, state: fromState },
        toState,
        worldMinute: WORLD_MINUTE + 1,
        sourceEventIds: ["event_transition"],
      };
      if (legalTransitions[fromState].includes(toState)) {
        assert.equal(transitionNarrativeThread(input).state, toState, `${fromState}->${toState}`);
      } else {
        assert.throws(() => transitionNarrativeThread(input), /illegal_narrative_thread_transition/, `${fromState}->${toState}`);
      }
    }
  }
});

test("derives narrative only from existing causal events, visible knowledge, root pressures, and actor goals", () => {
  const result = derive();
  const thread = result.threads[0]!;

  assert.deepEqual(result.rejected, []);
  assert.deepEqual(thread.rootPressureIds, ["pressure_legal"]);
  assert.deepEqual(thread.originEventIds, ["event_case"]);
  assert.deepEqual(thread.conflictingGoalRefs, ["goal:resolve_case"]);
  assert.deepEqual(thread.knownFactRefs, ["knowledge_case_claim", "knowledge_case_fact", "knowledge_refutation"]);
  assert.equal(thread.knownFactRefs.includes("knowledge_hidden_secret"), false);
  assert.deepEqual(thread.secretRefs, ["hidden:event_case"]);
  assert.equal(thread.explanation.includes("event_case"), true);
});

test("rejects narratives from missing sources or invisible evidence instead of accepting source-less facts", () => {
  const result = derive({
    events: [event("event_case")],
    pressures: [
      pressure({ pressureId: "pressure_missing_event", sourceFactEventIds: ["event_absent"] }),
      pressure({ pressureId: "pressure_source_less", sourceFactEventIds: [] }),
      pressure({ pressureId: "pressure_invisible", visibility: 10 }),
    ],
    actorMinds: [actorMind({ beliefs: [] })],
    knowledgeRecords: [knowledgeRecord("knowledge_hidden_secret", {
      visibility: {
        scopes: ["agent"],
        legalAccess: "owner",
        regionIds: [],
        organizationIds: [],
        agentIds: ["hidden_agent"],
        explorerIds: [],
        evidenceIds: [],
      },
    })],
  });

  assert.equal(result.threads.length, 0);
  assert.equal(result.opportunities.length, 0);
  assert.deepEqual(result.rejected.map((entry) => `${entry.code}:${entry.ref}`).sort(), [
    "NARRATIVE_CASE_EVIDENCE_REQUIRED:pressure_missing_event",
    "NARRATIVE_CASE_EVIDENCE_REQUIRED:pressure_source_less",
    "NARRATIVE_EVENT_SOURCE_REQUIRED:pressure_missing_event",
    "NARRATIVE_EVENT_SOURCE_REQUIRED:pressure_source_less",
    "NARRATIVE_OPPORTUNITY_NOT_QUALIFIED:pressure_missing_event",
    "NARRATIVE_ROOT_PRESSURE_REQUIRED:pressure_source_less",
  ]);
});

test("builds qualified opportunities with deadline, risk, competition, costs, refusal, and missed consequences", () => {
  const result = derive({
    actorMinds: [
      actorMind(),
      actorMind({
        actorRef: "actor:rival",
        activeGoals: [goal("goal:rival_bid", 50)],
        beliefs: [],
        commitments: [],
        relationships: [],
      }),
    ],
  });
  const opportunity = result.opportunities[0]!;

  assert.deepEqual(opportunity.eligibility.eligibleActorRefs, ["actor:warden"]);
  assert.deepEqual(opportunity.competitorRefs, ["actor:rival"]);
  assert.equal(opportunity.expiresAtWorldMinute, 2_360);
  assert.equal(opportunity.risk, 63);
  assert.equal(opportunity.cost, 1_100);
  assert.deepEqual(opportunity.legalConstraints, ["legal_basis:region:gray_harbor"]);
  assert.equal(opportunity.refusalConsequences[0]?.trigger, "rejected");
  assert.equal(opportunity.missedConsequences[0]?.trigger, "missed");
  assert.deepEqual(opportunity.refusalConsequences[0]?.knowledgeSeeds[0]?.sourceEventIds, ["event_case"]);
  assert.deepEqual(opportunity.missedConsequences[0]?.pressureSignalSeeds[0]?.sourceFactEventIds, ["event_case"]);
});

test("preserves case evidence graph, hypotheses, refutations, verdicts, and unresolved history", () => {
  const existing = {
    caseId: "case_prior",
    status: "verdict_issued" as const,
    jurisdictionRef: "jurisdiction:gray_harbor",
    subjectRefs: ["actor:warden"],
    rootPressureIds: ["pressure_prior"],
    sourceEventIds: ["event_prior"],
    evidenceGraph: [{
      evidenceRef: "knowledge_prior",
      sourceEventIds: ["event_prior"],
      supportsHypothesisRefs: ["hypothesis_prior"],
      refutesHypothesisRefs: [],
      submittedAtWorldMinute: 1_000,
      visibleToRefs: ["public"],
    }],
    hypotheses: [{
      hypothesisId: "hypothesis_prior",
      claimRef: "knowledge_prior",
      status: "accepted" as const,
      supportEvidenceRefs: ["knowledge_prior"],
      counterEvidenceRefs: [],
      confidenceBps: 9_000,
    }],
    refutationRefs: [],
    verdict: {
      verdictRef: "verdict_prior",
      hypothesisRef: "hypothesis_prior",
      outcome: "sustained" as const,
      issuedAtWorldMinute: 1_100,
      evidenceRefs: ["knowledge_prior"],
    },
    openedAtWorldMinute: 900,
    updatedAtWorldMinute: 1_100,
    explanation: "existing verdict",
  };
  const result = derive({
    existingCases: [existing],
    knowledgeRecords: [
      knowledgeRecord("knowledge_case_fact"),
      knowledgeRecord("knowledge_case_claim", {
        kind: "claim",
        supports: ["knowledge_case_fact"],
        confidence: 0.72,
        refutedBy: ["knowledge_refutation"],
      }),
      knowledgeRecord("knowledge_refutation", {
        kind: "refutation",
        status: "accepted",
        refutes: ["knowledge_case_claim"],
        confidence: 0.65,
      }),
    ],
  });
  const derivedCase = result.openCases.find((openCase) => openCase.caseId !== "case_prior")!;

  assert.equal(result.openCases.some((openCase) => openCase.verdict?.verdictRef === "verdict_prior"), true);
  assert.equal(derivedCase.status, "contested");
  assert.deepEqual(derivedCase.evidenceGraph.map((node) => node.evidenceRef), [
    "knowledge_case_fact",
    "knowledge_case_claim",
    "knowledge_refutation",
  ]);
  assert.equal(derivedCase.hypotheses.some((hypothesis) => hypothesis.claimRef === "knowledge_case_claim" && hypothesis.counterEvidenceRefs.includes("knowledge_refutation")), true);
  assert.deepEqual(derivedCase.refutationRefs, ["knowledge_refutation"]);
  assert.equal(derivedCase.unresolvedReason, "conflicting_evidence");
});

test("derives promise, debt, and relationship hooks from event-backed commitments and relationship beliefs", () => {
  const result = derive();

  assert.equal(result.promises.length, 1);
  assert.equal(result.promises[0]?.status, "open");
  assert.deepEqual(result.promises[0]?.sourceEventIds, ["event_case"]);
  assert.equal(result.debts.length, 1);
  assert.equal(result.debts[0]?.status, "disputed");
  assert.deepEqual(result.debts[0]?.pressureRefs, ["pressure_legal"]);
  assert.equal(result.relationshipBeats.length, 1);
  assert.equal(result.relationshipBeats[0]?.kind, "trust_loss");
  assert.equal(result.relationshipBeats[0]?.intensity, 100);
});

test("applies pacing budgets, de-duplication, region and actor filters, and anti-repeat blocking", () => {
  const visible = pressure({ pressureId: "pressure_visible", severity: 95, urgency: 90, sourceFactEventIds: ["event_case"] });
  const duplicate = pressure({ pressureId: "pressure_visible", severity: 95, urgency: 90, sourceFactEventIds: ["event_case"] });
  const otherRegion = pressure({ pressureId: "pressure_other_region", scopeRef: "region:far_port", sourceFactEventIds: ["event_far"], affectedActorRefs: ["actor:far"] });
  const otherActor = pressure({ pressureId: "pressure_other_actor", sourceFactEventIds: ["event_other_actor"], affectedActorRefs: ["actor:outsider"] });
  const result = derive({
    events: [event("event_case"), event("event_far"), event("event_other_actor")],
    pressures: [visible, duplicate, otherRegion, otherActor],
    visibleRegionIds: ["gray_harbor"],
    visibleActorRefs: ["actor:warden"],
    recentContent: [{
      contentKey: "pressure:legal",
      actorRefs: ["actor:warden"],
      regionRefs: ["gray_harbor"],
      usedAtWorldMinute: WORLD_MINUTE - 5,
    }],
    pacingBudget: {
      maxThreads: 0,
      maxOpportunities: 1,
      maxCases: 1,
      maxPromises: 0,
      maxDebts: 0,
      maxRelationshipBeats: 0,
      antiRepeatWindowWorldMinutes: 60,
    },
  });

  assert.equal(result.threads.length, 0);
  assert.equal(result.opportunities.length, 1);
  assert.deepEqual(result.opportunities[0]?.rootPressureIds, ["pressure_visible"]);
  assert.equal(result.openCases.length, 1);
  assert.equal(result.promises.length, 0);
  assert.equal(result.debts.length, 0);
  assert.equal(result.relationshipBeats.length, 0);
});

test("settles each candidate type into sourced effects and carries pressure and knowledge seeds", () => {
  const result = derive();
  const sourceEventIds = ["event_case", "event_case", "event_resolution"];
  const eventSources = ["event_case", "event_resolution"];
  const threadSettlement = settleNarrativeCandidate({
    worldId: WORLD_ID,
    worldMinute: WORLD_MINUTE,
    candidate: { kind: "thread", value: result.threads[0]!, fromState: "active" },
    sourceEventIds,
  });
  const opportunitySettlement = settleNarrativeCandidate({
    worldId: WORLD_ID,
    worldMinute: WORLD_MINUTE,
    candidate: { kind: "opportunity", value: result.opportunities[0]!, trigger: "missed" },
    sourceEventIds,
  });
  const caseSettlement = settleNarrativeCandidate({
    worldId: WORLD_ID,
    worldMinute: WORLD_MINUTE,
    candidate: { kind: "case", value: result.openCases[0]! },
    sourceEventIds,
  });
  const promiseSettlement = settleNarrativeCandidate({
    worldId: WORLD_ID,
    worldMinute: WORLD_MINUTE,
    candidate: { kind: "promise", value: result.promises[0]! },
    sourceEventIds,
  });
  const debtSettlement = settleNarrativeCandidate({
    worldId: WORLD_ID,
    worldMinute: WORLD_MINUTE,
    candidate: { kind: "debt", value: result.debts[0]! },
    sourceEventIds,
  });
  const relationshipSettlement = settleNarrativeCandidate({
    worldId: WORLD_ID,
    worldMinute: WORLD_MINUTE,
    candidate: { kind: "relationship", value: result.relationshipBeats[0]! },
    sourceEventIds,
  });
  const missingSources = settleNarrativeCandidate({
    worldId: WORLD_ID,
    worldMinute: WORLD_MINUTE,
    candidate: { kind: "thread", value: result.threads[0]! },
    sourceEventIds: [],
  });

  assert.deepEqual([
    threadSettlement.effects[0]?.effectType,
    opportunitySettlement.effects[0]?.effectType,
    caseSettlement.effects[0]?.effectType,
    promiseSettlement.effects[0]?.effectType,
    debtSettlement.effects[0]?.effectType,
    relationshipSettlement.effects[0]?.effectType,
  ], ["state_transition", "pressure_delta", "knowledge_delta", "knowledge_delta", "pressure_delta", "relationship_delta"]);
  assert.deepEqual(threadSettlement.effects[0]?.sourceEventIds, eventSources);
  assert.equal(opportunitySettlement.pressureSeeds.length, 1);
  assert.deepEqual(opportunitySettlement.pressureSeeds[0]?.sourceFactEventIds, ["event_case"]);
  assert.equal(opportunitySettlement.knowledgeSeeds.length, 1);
  assert.deepEqual(opportunitySettlement.knowledgeSeeds[0]?.sourceEventIds, ["event_case"]);
  assert.equal(missingSources.errors[0]?.code, "NARRATIVE_SETTLEMENT_SOURCE_REQUIRED");
  assert.equal(missingSources.effects.length, 0);
});

test("returns deterministic ids and sorted outputs across input order changes", () => {
  const left = derive({
    pressures: [
      pressure({ pressureId: "pressure_b", severity: 70, urgency: 50 }),
      pressure({ pressureId: "pressure_a", severity: 70, urgency: 50 }),
    ],
  });
  const right = derive({
    pressures: [
      pressure({ pressureId: "pressure_a", severity: 70, urgency: 50 }),
      pressure({ pressureId: "pressure_b", severity: 70, urgency: 50 }),
    ],
  });

  assert.deepEqual(left.threads, right.threads);
  assert.deepEqual(left.opportunities, right.opportunities);
  assert.deepEqual(left.openCases, right.openCases);
});

test("clamps derived tension, opportunity scores, action proposals, predicates, and relationship intensity at extremes", () => {
  const result = derive({
    pressures: [pressure({ severity: 200, urgency: 200, growthRate: 200, uncertainty: 200, visibility: 200 })],
  });
  const opportunity = result.opportunities[0]!;
  const action = actionProposalFromOpportunity({
    opportunity,
    actorMind: actorMind(),
    goal: goal(),
    submittedAtWorldMinute: 2_360,
  });
  const seed = opportunitySeedFromOpportunity(opportunity);
  const predicateEffect = worldPredicateEffectFromOpportunity(opportunity, opportunity.objectivePredicates[0]!, ["event_resolution", "event_case"]);

  assert.equal(result.threads[0]?.tensions[0]?.score, 100);
  assert.equal(opportunity.risk, 100);
  assert.equal(opportunity.worldIntensity, 100);
  assert.equal(opportunity.refusalConsequences[0]?.pressureSignalSeeds[0]?.severity, 100);
  assert.equal(action.requiredTimeWorldMinutes, 1);
  assert.equal(action.requiredCapabilities[0]?.minimumLevel, 5);
  assert.deepEqual(seed, {
    opportunityId: opportunity.opportunityId,
    rootPressureIds: opportunity.rootPressureIds,
    beneficiaryRefs: opportunity.beneficiaryRefs,
    oppositionRefs: opportunity.oppositionRefs,
    interventionType: opportunity.interventionType,
    availableEvidenceRefs: opportunity.availableEvidenceRefs,
    hiddenInformationRefs: opportunity.hiddenInformationRefs,
    worldIntensity: 100,
    expiresAtWorldMinute: opportunity.expiresAtWorldMinute,
  });
  assert.deepEqual(predicateEffect.sourceEventIds, ["event_case", "event_resolution"]);
  assert.equal(predicateEffect.after.evaluationStatus, "unknown");
});
