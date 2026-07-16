import test from "node:test";
import assert from "node:assert/strict";
import { conflictKey, createLoreLedger, exactClaimKey, extractCandidateClaims } from "../lib/lore.ts";

function source(overrides = {}) {
  return {
    runTicket: "rt_source_001",
    runId: "run_source_001",
    explorerId: "explorer_source",
    agentId: "agent_grayfile_07",
    score: 80,
    claimSlots: 3,
    ...overrides,
  };
}

test("extractCandidateClaims normalizes explicit and event-level claims", () => {
  const claims = extractCandidateClaims({
    candidateClaims: [
      { subject: " 会回信树洞 ", predicate: " effect ", object: " 会复读死者录音 " },
    ],
    events: [
      {
        id: "event_01",
        evidence: "盐化录音笔记录到三次回声",
        claim: { subject: "盐化录音笔", predicate: "limit", object: "只能保存三次污染回声" },
      },
    ],
  });

  assert.deepEqual(claims.map((claim) => [claim.subject, claim.predicate, claim.object]), [
    ["会回信树洞", "effect", "会复读死者录音"],
    ["盐化录音笔", "limit", "只能保存三次污染回声"],
  ]);
  assert.equal(claims[1].evidence, "盐化录音笔记录到三次回声");
});

test("admitRunClaims creates canonical claims with source attribution and slot limit", () => {
  const ledger = createLoreLedger();
  const result = ledger.admitRunClaims({
    source: source({ claimSlots: 2 }),
    run: {
      candidateClaims: [
        { subject: "会回信树洞", predicate: "effect", object: "会复读死者录音", evidence: "录音 A" },
        { subject: "盐化录音笔", predicate: "limit", object: "只能保存三次污染回声", evidence: "实验 B" },
        { subject: "灰档-07", predicate: "status", object: "听觉污染轻度", evidence: "体检 C" },
      ],
    },
  });

  assert.deepEqual(result.decisions.map((decision) => decision.status), ["canonical", "canonical", "shadow"]);
  assert.equal(ledger.state().claims.length, 2);
  assert.equal(ledger.state().claims[0].sources[0].runTicket, "rt_source_001");
  assert.equal(ledger.state().claims[0].sources[0].evidence, "录音 A");
});

test("low-risk rumor admissions enforce daily and weekly creation caps", () => {
  const ledger = createLoreLedger();

  function admitLowRisk(index: number, submittedAt: string) {
    return ledger.admitRunClaims({
      source: source({
        runTicket: `rt_low_rumor_${index}`,
        explorerId: "explorer_low_rumor",
        riskLevel: "low",
        submittedAt,
        claimSlots: 1,
      }),
      run: {
        candidateClaims: [
          { subject: `低风险传闻 ${index}`, predicate: "hint", object: "只作传闻收益", evidence: `记录 ${index}` },
        ],
      },
    });
  }

  const first = admitLowRisk(1, "2026-06-22T01:00:00.000Z");
  const sameDay = admitLowRisk(2, "2026-06-22T03:00:00.000Z");
  const secondDay = admitLowRisk(3, "2026-06-23T01:00:00.000Z");
  const thirdDay = admitLowRisk(4, "2026-06-24T01:00:00.000Z");
  const weeklyOverflow = admitLowRisk(5, "2026-06-25T01:00:00.000Z");
  const state = ledger.state();

  assert.equal(first.decisions[0].status, "rumor");
  assert.deepEqual(first.accepted.map((decision) => decision.status), ["rumor"]);
  assert.equal(sameDay.decisions[0].status, "personal_sealed");
  assert.equal(sameDay.decisions[0].reason, "low_risk_rumor_daily_cap");
  assert.equal(secondDay.decisions[0].status, "rumor");
  assert.equal(thirdDay.decisions[0].status, "rumor");
  assert.equal(weeklyOverflow.decisions[0].status, "personal_sealed");
  assert.equal(weeklyOverflow.decisions[0].reason, "low_risk_rumor_weekly_cap");
  assert.deepEqual(state.claims.map((claim) => claim.status), ["rumor", "rumor", "rumor"]);
  assert.equal(state.lowRiskRumorAdmissions.length, 3);
});

test("over-cap low-risk duplicate claims become evidence supplements without rewards", () => {
  const ledger = createLoreLedger();

  ledger.admitRunClaims({
    source: source({ runTicket: "rt_original", explorerId: "explorer_original", claimSlots: 1 }),
    run: {
      candidateClaims: [
        { subject: "会回信树洞", predicate: "effect", object: "会复读死者录音", evidence: "录音 A" },
      ],
    },
  });
  ledger.admitRunClaims({
    source: source({
      runTicket: "rt_low_rumor_seed",
      explorerId: "explorer_low_rumor_reuser",
      riskLevel: "low",
      submittedAt: "2026-06-22T01:00:00.000Z",
      claimSlots: 1,
    }),
    run: {
      candidateClaims: [
        { subject: "低风险传闻种子", predicate: "hint", object: "占用当日传闻收益", evidence: "种子记录" },
      ],
    },
  });

  const result = ledger.admitRunClaims({
    source: source({
      runTicket: "rt_low_rumor_duplicate",
      explorerId: "explorer_low_rumor_reuser",
      riskLevel: "low",
      submittedAt: "2026-06-22T03:00:00.000Z",
      claimSlots: 1,
    }),
    run: {
      candidateClaims: [
        { subject: "会回信树洞", predicate: "effect", object: "会复读死者录音", evidence: "复核 B" },
      ],
    },
  });
  const state = ledger.state();

  assert.equal(result.decisions[0].status, "evidence_supplement");
  assert.equal(result.decisions[0].reason, "low_risk_rumor_daily_cap");
  assert.equal(result.decisions[0].reward, null);
  assert.deepEqual(result.accepted, []);
  assert.equal(state.claims[0].sources.length, 2);
  assert.deepEqual(state.sourceRewards, []);
  assert.equal(state.lowRiskRumorAdmissions.length, 1);
});

test("exact duplicate claims merge and delay source reward for original source", () => {
  const ledger = createLoreLedger();
  ledger.admitRunClaims({
    source: source({ runTicket: "rt_original", explorerId: "explorer_original", claimSlots: 1 }),
    run: {
      candidateClaims: [
        { subject: "会回信树洞", predicate: "effect", object: "会复读死者录音", evidence: "录音 A" },
      ],
    },
  });

  const result = ledger.admitRunClaims({
    source: source({ runTicket: "rt_reuse", explorerId: "explorer_reuser", claimSlots: 1 }),
    run: {
      candidateClaims: [
        { subject: "会回信树洞", predicate: "effect", object: "会复读死者录音", evidence: "复核 B" },
      ],
    },
  });
  const state = ledger.state();

  assert.equal(result.decisions[0].status, "duplicate");
  assert.equal(state.claims.length, 1);
  assert.equal(state.claims[0].sources.length, 2);
  assert.deepEqual(state.sourceRewards, [
    {
      claimId: state.claims[0].claimId,
      rewardedExplorerId: "explorer_original",
      fromExplorerId: "explorer_reuser",
      reason: "claim_reused",
      status: "pending",
      points: 0,
      pendingPoints: 1,
      runTicket: "rt_reuse",
      supportingExplorerIds: ["explorer_reuser"],
    },
  ]);
});

test("source rewards release after a second independent reuse", () => {
  const ledger = createLoreLedger();
  ledger.admitRunClaims({
    source: source({ runTicket: "rt_original", explorerId: "explorer_original", claimSlots: 1 }),
    run: {
      candidateClaims: [
        { subject: "会回信树洞", predicate: "effect", object: "会复读死者录音", evidence: "录音 A" },
      ],
    },
  });
  ledger.admitRunClaims({
    source: source({ runTicket: "rt_reuse_1", explorerId: "explorer_reuser_1", claimSlots: 1 }),
    run: {
      candidateClaims: [
        { subject: "会回信树洞", predicate: "effect", object: "会复读死者录音", evidence: "复核 B" },
      ],
    },
  });

  const result = ledger.admitRunClaims({
    source: source({ runTicket: "rt_reuse_2", explorerId: "explorer_reuser_2", claimSlots: 1 }),
    run: {
      candidateClaims: [
        { subject: "会回信树洞", predicate: "effect", object: "会复读死者录音", evidence: "复核 C" },
      ],
    },
  });
  const state = ledger.state();

  assert.equal(result.decisions[0].status, "duplicate");
  assert.equal(result.decisions[0].reward?.status, "released");
  assert.deepEqual(state.sourceRewards, [
    {
      claimId: state.claims[0].claimId,
      rewardedExplorerId: "explorer_original",
      fromExplorerId: "explorer_reuser_1",
      reason: "claim_reused",
      status: "released",
      points: 1,
      pendingPoints: 1,
      runTicket: "rt_reuse_1",
      supportingExplorerIds: ["explorer_reuser_1", "explorer_reuser_2"],
      releasedByExplorerId: "explorer_reuser_2",
      releasedByRunTicket: "rt_reuse_2",
      releaseReason: "second_independent_reuse",
    },
  ]);
});

test("mutual source-reward loops stay delayed for review instead of releasing rewards", () => {
  const ledger = createLoreLedger();
  ledger.admitRunClaims({
    source: source({ runTicket: "rt_original_a", explorerId: "explorer_a", claimSlots: 1 }),
    run: {
      candidateClaims: [
        { subject: "会回信树洞", predicate: "effect", object: "会复读死者录音", evidence: "录音 A" },
      ],
    },
  });
  ledger.admitRunClaims({
    source: source({ runTicket: "rt_reuse_by_b", explorerId: "explorer_b", claimSlots: 1 }),
    run: {
      candidateClaims: [
        { subject: "会回信树洞", predicate: "effect", object: "会复读死者录音", evidence: "复核 B" },
      ],
    },
  });
  ledger.admitRunClaims({
    source: source({ runTicket: "rt_original_b", explorerId: "explorer_b", claimSlots: 1 }),
    run: {
      candidateClaims: [
        { subject: "盐化录音笔", predicate: "limit", object: "只能保存三次污染回声", evidence: "实验 B" },
      ],
    },
  });

  const reciprocal = ledger.admitRunClaims({
    source: source({ runTicket: "rt_reuse_by_a", explorerId: "explorer_a", claimSlots: 1 }),
    run: {
      candidateClaims: [
        { subject: "盐化录音笔", predicate: "limit", object: "只能保存三次污染回声", evidence: "复核 A" },
      ],
    },
  });
  const state = ledger.state();
  const sourceRewards = state.sourceRewards as Record<string, unknown>[];

  assert.equal(reciprocal.decisions[0].status, "duplicate");
  assert.equal(reciprocal.decisions[0].reward?.status, "delayed_review");
  assert.equal(reciprocal.decisions[0].reward?.delayReason, "mutual_source_reward_loop");
  assert.deepEqual(sourceRewards.map((reward) => reward.status), ["delayed_review", "delayed_review"]);
  assert.deepEqual(sourceRewards.map((reward) => reward.delayReason), [
    "mutual_source_reward_loop",
    "mutual_source_reward_loop",
  ]);
  assert.deepEqual(sourceRewards.map((reward) => reward.points), [0, 0]);
});

test("conflicting claims become disputed without replacing canonical claim", () => {
  const ledger = createLoreLedger();
  ledger.admitRunClaims({
    source: source({ runTicket: "rt_original", claimSlots: 1 }),
    run: {
      candidateClaims: [
        { subject: "会回信树洞", predicate: "effect", object: "会复读死者录音", evidence: "录音 A" },
      ],
    },
  });

  const result = ledger.admitRunClaims({
    source: source({ runTicket: "rt_conflict", claimSlots: 1 }),
    run: {
      candidateClaims: [
        { subject: "会回信树洞", predicate: "effect", object: "会诱导活人说出遗言", evidence: "目击 B" },
      ],
    },
  });
  const state = ledger.state();

  assert.equal(result.decisions[0].status, "disputed");
  assert.equal(state.claims.length, 2);
  assert.equal(state.claims[0].status, "canonical");
  assert.equal(state.claims[1].status, "disputed");
  assert.equal(state.conflicts.length, 1);
  assert.equal(state.conflicts[0].status, "open");
  assert.equal(state.conflicts[0].claimIds.includes(state.claims[0].claimId), true);
  assert.equal(state.conflicts[0].claimIds.includes(state.claims[1].claimId), true);
});

test("incomplete claims are rejected before they can consume slots", () => {
  const ledger = createLoreLedger();
  const result = ledger.admitRunClaims({
    source: source({ claimSlots: 1 }),
    run: {
      candidateClaims: [
        { subject: "会回信树洞", predicate: "", object: "会复读死者录音" },
        { subject: "盐化录音笔", predicate: "limit", object: "只能保存三次污染回声" },
      ],
    },
  });

  assert.deepEqual(result.decisions.map((decision) => decision.status), ["rejected", "canonical"]);
  assert.equal(ledger.state().claims.length, 1);
});

test("claim status transitions reject rumor to inscribed without approval", () => {
  const claim = {
    claimId: "claim_status_guard_001",
    subject: "会回信树洞",
    predicate: "effect",
    object: "会复读死者录音",
    evidence: "旧档案提及，但尚未复核。",
    status: "rumor",
    exactKey: exactClaimKey({
      subject: "会回信树洞",
      predicate: "effect",
      object: "会复读死者录音",
    }),
    conflictKey: conflictKey({
      subject: "会回信树洞",
      predicate: "effect",
    }),
    sources: [],
  };
  const ledger = createLoreLedger({ claims: [claim] });

  assert.throws(
    () => ledger.transitionClaimStatus({
      claimId: claim.claimId,
      status: "inscribed",
      reason: "buggy_direct_write",
    }),
    /claim_status_transition_invalid/,
  );

  const approved = ledger.transitionClaimStatus({
    claimId: claim.claimId,
    status: "inscribed",
    reason: "canon_adoption",
    canonAdoptionEventId: "canon_event_treehole_001",
  });
  assert.equal(approved.status, "inscribed");
  assert.equal(approved.statusHistory.at(-1)?.fromStatus, "rumor");
  assert.equal(approved.statusHistory.at(-1)?.toStatus, "inscribed");
  assert.equal(approved.statusHistory.at(-1)?.canonAdoptionEventId, "canon_event_treehole_001");
});
