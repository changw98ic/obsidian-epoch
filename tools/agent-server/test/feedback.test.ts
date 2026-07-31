import test from "node:test";
import assert from "node:assert/strict";
import {
  createDigest,
  createFeedbackEvents,
  createRepairTicket,
  createRunFeedback,
} from "../lib/feedback.ts";

test("failed runs produce repair guidance and resubmission path", () => {
  const feedback = createRunFeedback({
    adjudication: { score: 54, rating: "repair", claimSlots: 0, disposition: "repair" },
    lore: { decisions: [] },
    progression: { pointsAwarded: 0 },
  });

  assert.equal(feedback.tone, "repairable_failure");
  assert.equal(feedback.resubmission.allowed, true);
  assert.ok(feedback.repairActions.length >= 3);
  assert.match(feedback.summary, /补证|修正|证据/);
});

test("near miss runs explain the shortest path to passing", () => {
  const feedback = createRunFeedback({
    adjudication: { score: 59, rating: "repair", claimSlots: 0, disposition: "repair" },
    lore: { decisions: [] },
    progression: { pointsAwarded: 0 },
  });

  assert.equal(feedback.nearMiss, true);
  assert.match(feedback.summary, /差 1 分/);
});

test("successful runs surface concrete rewards", () => {
  const feedback = createRunFeedback({
    adjudication: { score: 82, rating: "strong", claimSlots: 3, disposition: "eligible_for_review" },
    lore: { decisions: [{ status: "canonical" }, { status: "shadow" }], accepted: [{ status: "canonical" }] },
    progression: { pointsAwarded: 12, factionId: "腐林档案会", rank: "field_agent" },
  });

  assert.equal(feedback.tone, "success");
  assert.deepEqual(feedback.rewards, [
    "3 个设定槽位",
    "1 条设定进入公共审档",
    "腐林档案会 +12 声望",
  ]);
});

test("repair tickets preserve run ticket and suggested actions", () => {
  const ticket = createRepairTicket({
    runTicket: "rt_repair",
    feedback: createRunFeedback({
      adjudication: { score: 51, rating: "repair", claimSlots: 0, disposition: "repair" },
      lore: { decisions: [] },
      progression: { pointsAwarded: 0 },
    }),
  });

  assert.equal(ticket.status, "repair_open");
  assert.equal(ticket.originalRunTicket, "rt_repair");
  assert.equal(ticket.resubmissionMode, "new_run_ticket_required");
  assert.ok(ticket.actions.length >= 3);
});

test("feedback events notify claim reuse and faction status changes", () => {
  const events = createFeedbackEvents({
    sourceRewards: [
      {
        claimId: "claim_echo",
        rewardedExplorerId: "explorer_original",
        fromExplorerId: "explorer_reuser",
        status: "pending",
        points: 0,
        pendingPoints: 1,
        reason: "claim_reused",
      },
    ],
    factionResult: {
      status: "accepted",
      factionId: "faction_echo",
      supporterCount: 3,
    },
  });

  assert.deepEqual(events.map((event) => event.type), ["claim_reused", "faction_status_changed"]);
  assert.equal(events[0].recipientExplorerId, "explorer_original");
  assert.equal(events[0].status, "pending");
  assert.equal(events[0].pendingPoints, 1);
  assert.equal(events[1].status, "accepted");
});

test("digest summarizes daily world movement", () => {
  const digest = createDigest({
    date: "2026-06-24",
    runs: [{ runTicket: "rt_1" }, { runTicket: "rt_2" }],
    loreState: { claims: [{ status: "canonical" }, { status: "disputed" }], conflicts: [{ status: "open" }] },
    factionState: { factions: [{ status: "trial" }, { status: "accepted" }] },
  });

  assert.deepEqual(digest, {
    date: "2026-06-24",
    runCount: 2,
    canonicalClaims: 1,
    disputedClaims: 1,
    openConflicts: 1,
    trialFactions: 1,
    acceptedFactions: 1,
  });
});
