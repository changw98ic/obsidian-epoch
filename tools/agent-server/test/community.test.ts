import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPublicWorldView,
  createCommunityLedger,
} from "../lib/community.ts";

const loreState = {
  claims: [
    {
      claimId: "claim_echo",
      status: "canonical",
      subject: "会回信树洞",
      predicate: "effect",
      object: "会复读死者录音",
      sources: [{ runTicket: "rt_public_1", explorerId: "explorer_a", evidence: "录音 A" }],
    },
    {
      claimId: "claim_conflict",
      status: "disputed",
      subject: "会回信树洞",
      predicate: "effect",
      object: "会诱导活人说出遗言",
      sources: [{ runTicket: "rt_public_2", explorerId: "explorer_b", evidence: "目击 B" }],
    },
  ],
  conflicts: [
    {
      conflictId: "conflict_echo",
      status: "open",
      claimIds: ["claim_echo", "claim_conflict"],
    },
  ],
  sourceRewards: [],
};

const factionState = {
  factions: [
    {
      factionId: "faction_echo",
      name: "回声树洞看守会",
      status: "accepted",
      sources: [{ runTicket: "rt_faction", explorerId: "explorer_a" }],
      supporters: [{ explorerId: "supporter_a" }],
      references: [{ runTicket: "rt_public_3", explorerId: "explorer_c" }],
    },
  ],
};

const runs = [
  { runTicket: "rt_public_1", explorerId: "explorer_a", score: 82, visibility: "public", worldImpact: "review_candidate" },
  { runTicket: "rt_private_1", explorerId: "explorer_a", score: 99, visibility: "private", worldImpact: "private_demo" },
];

test("buildPublicWorldView exposes browser summaries and filters private archive runs", () => {
  const view = buildPublicWorldView({ loreState, factionState, runs });

  assert.equal(view.summary.canonicalClaims, 1);
  assert.equal(view.summary.disputedClaims, 1);
  assert.equal(view.summary.acceptedFactions, 1);
  assert.deepEqual(view.archive.map((run) => run.runTicket), ["rt_public_1"]);
  assert.equal(view.claims[0].sourceCount, 1);
});

test("claim, conflict, and faction detail pages include traceable source data", () => {
  const view = buildPublicWorldView({ loreState, factionState, runs });

  assert.equal(view.claimDetails.claim_echo.sources[0].runTicket, "rt_public_1");
  assert.equal(view.conflictDetails.conflict_echo.claims.length, 2);
  assert.equal(view.factionDetails.faction_echo.references[0].runTicket, "rt_public_3");
});

test("source graph exposes nodes and edges instead of a flat text pile", () => {
  const view = buildPublicWorldView({ loreState, factionState, runs });

  assert.equal(view.sourceGraph.nodes.some((node) => node.id === "claim_echo"), true);
  assert.equal(view.sourceGraph.nodes.some((node) => node.id === "rt_public_1"), true);
  assert.equal(view.sourceGraph.edges.some((edge) => edge.from === "rt_public_1" && edge.to === "claim_echo"), true);
  assert.equal(view.sourceGraph.edges.some((edge) => edge.from === "claim_echo" && edge.to === "conflict_echo"), true);
});

test("community reactions update per explorer and target instead of duplicating votes", () => {
  const ledger = createCommunityLedger();

  ledger.react({ targetType: "claim", targetId: "claim_echo", explorerId: "explorer_a", reaction: "useful" });
  ledger.react({ targetType: "claim", targetId: "claim_echo", explorerId: "explorer_a", reaction: "needs_evidence" });
  ledger.react({ targetType: "claim", targetId: "claim_echo", explorerId: "explorer_b", reaction: "useful" });
  const thread = ledger.threadFor("claim_echo");

  assert.deepEqual(thread.reactionCounts, { needs_evidence: 1, useful: 1 });
  assert.equal(thread.reactions.length, 2);
});

test("community quick reactions only affect sorting and attention, never claim status", () => {
  const ledger = createCommunityLedger();

  const trustedVote = ledger.react({ targetType: "claim", targetId: "claim_echo", explorerId: "explorer_a", reaction: "可信" });
  ledger.react({ targetType: "claim", targetId: "claim_echo", explorerId: "explorer_b", reaction: "不可信" });
  ledger.react({ targetType: "claim", targetId: "claim_echo", explorerId: "explorer_c", reaction: "trusted" });
  const thread = ledger.threadFor("claim_echo");

  assert.equal(trustedVote.reactionPolicy.claimStatusEffect, "none");
  assert.deepEqual(trustedVote.reactionPolicy.allowedEffects, ["sorting", "attention"]);
  assert.deepEqual(trustedVote.reactionPolicy.forbiddenEffects, ["claim_status", "truth_adjudication"]);
  assert.deepEqual(trustedVote.reactionPolicy.claimStatusInputs, ["evidence", "review_record", "authorized_reassessment"]);
  assert.equal(thread.reactionPolicy.claimStatusEffect, "none");
  assert.deepEqual(thread.sortSignals.reactionCounts, { "可信": 1, "不可信": 1, trusted: 1 });
  assert.equal(thread.sortSignals.attentionScore, 3);
});

test("comments and moderation flags create reviewable discussion hooks", () => {
  const ledger = createCommunityLedger();

  const comment = ledger.comment({
    targetType: "conflict",
    targetId: "conflict_echo",
    explorerId: "explorer_a",
    body: "需要补一段录音证据。",
  });
  const flag = ledger.flag({
    targetType: "comment",
    targetId: comment.commentId,
    explorerId: "explorer_b",
    reason: "low_signal",
  });
  const queue = ledger.moderationQueue();

  assert.equal(comment.status, "visible");
  assert.equal(flag.status, "queued");
  assert.equal(queue.length, 1);
  assert.equal(queue[0].reason, "low_signal");
});

test("community dispute reactions hide retaliation, burst objections, and group pile-ons for review", () => {
  const ledger = createCommunityLedger();

  ledger.react({
    targetType: "claim",
    targetId: "claim_origin_a",
    explorerId: "explorer_b",
    againstExplorerId: "explorer_a",
    reaction: "refute",
    groupId: "circle_b",
  });
  const retaliation = ledger.react({
    targetType: "claim",
    targetId: "claim_origin_b",
    explorerId: "explorer_a",
    againstExplorerId: "explorer_b",
    reaction: "refute",
    groupId: "circle_a",
  });
  assert.equal(retaliation.visibility, "hidden_pending_review");
  assert.deepEqual(retaliation.disputeAbuseFlags, ["bidirectional_retaliation"]);

  ledger.react({ targetType: "claim", targetId: "claim_burst_1", explorerId: "explorer_c", againstExplorerId: "explorer_d", reaction: "refute" });
  ledger.react({ targetType: "claim", targetId: "claim_burst_2", explorerId: "explorer_c", againstExplorerId: "explorer_d", reaction: "refute" });
  const burst = ledger.react({ targetType: "claim", targetId: "claim_burst_3", explorerId: "explorer_c", againstExplorerId: "explorer_d", reaction: "refute" });
  assert.equal(burst.visibility, "hidden_pending_review");
  assert.equal(burst.disputeAbuseFlags.includes("short_burst_objections"), true);

  ledger.react({ targetType: "claim", targetId: "claim_pile_on", explorerId: "explorer_e", againstExplorerId: "explorer_h", reaction: "不可信", groupId: "circle_e" });
  ledger.react({ targetType: "claim", targetId: "claim_pile_on", explorerId: "explorer_f", againstExplorerId: "explorer_h", reaction: "refute", groupId: "circle_e" });
  const pileOn = ledger.react({ targetType: "claim", targetId: "claim_pile_on", explorerId: "explorer_g", againstExplorerId: "explorer_h", reaction: "needs_evidence", groupId: "circle_e" });
  assert.equal(pileOn.visibility, "hidden_pending_review");
  assert.equal(pileOn.disputeAbuseFlags.includes("group_pile_on"), true);

  const thread = ledger.threadFor("claim_pile_on");
  assert.equal(thread.disputeAbuseSummary.hiddenReactions, 1);
  assert.equal(thread.disputeAbuseSummary.queuedForReview, true);
  assert.equal(ledger.moderationQueue().filter((item) => String(item.reason).startsWith("dispute_abuse:")).length, 3);
});
