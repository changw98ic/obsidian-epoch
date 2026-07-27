import assert from "node:assert/strict";
import test from "node:test";

import { eventFactory } from "../lib/epoch/eventFactory.ts";
import { resolveJourneyAction } from "../lib/epoch/journeyActionResolutionRules.ts";
import {
  journeyWorldImpactPreview,
  planJourneyWorldImpactEvents,
  type PlanJourneyWorldImpactEventsInput,
} from "../lib/epoch/journeyWorldImpactRules.ts";
import { createSequentialEpochIdFactory } from "../lib/epoch/protocol.ts";

function input(): PlanJourneyWorldImpactEventsInput {
  const idFactory = createSequentialEpochIdFactory("journey_world_impact");
  const resolution = resolveJourneyAction({
    agentId: "agent_journey_impact",
    journeyId: "journey_impact",
    episodeId: "episode_impact",
    actionOptionId: "action_impact",
    actionLabel: "复核实验数据并提交记录",
    objectiveTitle: "完成实验复核",
    locationLabel: "量子实验室",
    successOutcomeSummary: "实验数据已复核并由现场人员签收。",
    risk: "low",
    identity: { lifetime: { max: 100, remaining: 100 }, traits: ["研究", "细致", "实验"] },
    resources: { focus: 4, stamina: 4, aether: 4 },
    inventoryItems: [{ itemId: "item_lab_tool", rarity: "rare", bound: true }],
    participantTargetCount: 1,
  });
  return {
    makeEvent: eventFactory(() => new Date("2026-07-15T12:00:00.000Z"), idFactory, {
      actorExplorerId: "explorer_journey_impact",
      trustClass: "server_hosted_agent",
      correlationId: "journey_impact",
    }),
    idFactory,
    regionId: "region_quantum_laboratory",
    agentId: "agent_journey_impact",
    explorerId: "explorer_journey_impact",
    identityName: "实验室见习研究员",
    journeyId: "journey_impact",
    episodeId: "episode_impact",
    objectiveId: "main_verify",
    objectiveKind: "main",
    objectiveTitle: "完成实验复核",
    actionLabel: "复核实验数据并提交记录",
    actionRisk: "low",
    allowedEffectKinds: ["journey_progress", "world_reference"],
    resolution,
    previousInfluenceScore: 7,
    sourceEventId: "event_hosted_action_impact",
    sourceAggregateId: "session_journey_impact",
    recordedAt: "2026-07-15T12:00:00.000Z",
    worldMinute: 720,
  };
}

test("solidification planning turns a server-completed objective into bounded influence and a trace", () => {
  const planInput = input();
  const preview = journeyWorldImpactPreview(planInput);
  assert.equal(preview?.influenceDelta, 3);
  const events = planJourneyWorldImpactEvents(planInput);
  assert.deepEqual(events.map((event) => event.eventType), ["region_influence_changed", "trace_created"]);
  const influence = events[0];
  if (influence?.eventType !== "region_influence_changed") throw new Error("expected_influence");
  assert.equal(influence.payload.influenceScoreAfter, 10);
  assert.equal(influence.payload.sourceEventId, "event_hosted_action_impact");
  assert.equal(influence.payload.worldMinute, 720);
  assert.match(influence.payload.reason, /^journey_objective:/u);
  const trace = events[1];
  if (trace?.eventType !== "trace_created") throw new Error("expected_trace");
  assert.deepEqual(trace.payload.relatedInfluenceIds, [influence.payload.influenceId]);
  assert.deepEqual(trace.payload.participantAgentIds, ["agent_journey_impact"]);
  assert.match(trace.payload.summary, /服务器/u);
});

test("failed Journey objectives cannot manufacture positive shared-world impact", () => {
  const base = input();
  for (const completionKind of ["failed"] as const) {
    const changed = {
      ...base,
      resolution: {
        ...base.resolution,
        completionKind,
        outcome: "failure" as const,
      },
    };
    assert.equal(journeyWorldImpactPreview(changed), undefined);
    assert.deepEqual(planJourneyWorldImpactEvents(changed), []);
  }
});

test("solidification planning adds faction standing for a completed signed choice only", () => {
  const choice = {
    ...input(),
    objectiveKind: "choice" as const,
    previousFactionStandingScore: 250,
    routeSelection: {
      routeId: "route_forest_hundred_forms",
      factionObjectId: "faction_hundred_forms",
    },
  };
  const events = planJourneyWorldImpactEvents(choice);
  assert.deepEqual(events.map((event) => event.eventType), [
    "region_influence_changed",
    "trace_created",
    "agent_faction_standing_changed",
  ]);
  const standing = events[2];
  if (standing?.eventType !== "agent_faction_standing_changed") throw new Error("expected_faction_standing");
  assert.equal(standing.payload.factionId, "faction_hundred_forms");
  assert.equal(standing.payload.routeId, "route_forest_hundred_forms");
  assert.equal(standing.payload.standingDelta, 100);
  assert.equal(standing.payload.standingAfter, 350);
  assert.equal(standing.payload.sourceEventId, "event_hosted_action_impact");

  assert.equal(planJourneyWorldImpactEvents({
    ...choice,
    objectiveKind: "main",
  }).some((event) => event.eventType === "agent_faction_standing_changed"), false);
});
