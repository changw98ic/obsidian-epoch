import test from "node:test";
import assert from "node:assert/strict";
import { createFactionLedger } from "../lib/factions.ts";

function proposal(overrides = {}) {
  return {
    name: "回声树洞看守会",
    setting: "由腐林边缘记录者组成，专门封存会回信树洞的污染录音。",
    goal: "建立可复核的污染录音档案，阻止财团私卖样本。",
    conflictBoundary: "不接管腐林主权，不触碰深海尸骸核心秘密。",
    evidenceRunTickets: ["rt_faction_seed"],
    originClaimIds: ["claim_echo_tree"],
    ...overrides,
  };
}

test("low quality or low rank proposals are rejected before trial state", () => {
  const ledger = createFactionLedger();

  const result = ledger.proposeFaction({
    source: {
      explorerId: "explorer_low",
      runTicket: "rt_low",
      score: 59,
      rank: "field_agent",
    },
    proposal: proposal(),
  });

  assert.equal(result.status, "rejected");
  assert.equal(result.reason, "rank_too_low");
  assert.equal(ledger.state().factions.length, 0);
});

test("valid faction proposals enter trial with legitimacy score and source evidence", () => {
  const ledger = createFactionLedger();

  const result = ledger.proposeFaction({
    source: {
      explorerId: "explorer_operator",
      runTicket: "rt_faction_seed",
      score: 88,
      rank: "operator",
    },
    proposal: proposal(),
  });
  const state = ledger.state();

  assert.equal(result.status, "trial");
  assert.ok(typeof result.legitimacyScore === "number");
  assert.ok(result.legitimacyScore >= 70);
  assert.equal(state.factions.length, 1);
  assert.equal(state.factions[0].status, "trial");
  assert.equal(state.factions[0].sources[0].runTicket, "rt_faction_seed");
  assert.equal(state.factions[0].goal, proposal().goal);
  assert.equal(state.factions[0].conflictBoundary, proposal().conflictBoundary);
});

test("real IP-similar faction names enter moderation hold before shared trial state", () => {
  const ledger = createFactionLedger();

  const result = ledger.proposeFaction({
    source: {
      explorerId: "explorer_operator",
      runTicket: "rt_ip_faction",
      score: 91,
      rank: "operator",
    },
    proposal: proposal({
      name: "霍格沃茨守夜会",
      setting: "一群在灰港学校废墟巡夜的记录者，名称明显借用了现实作品。",
      goal: "建立可复核的夜巡档案，避免现实作品变体进入共享世界。",
      conflictBoundary: "不声称继承现实作品、角色或地点，只等待人工复核。",
      evidenceRunTickets: ["rt_ip_faction"],
      originClaimIds: ["claim_ip_faction"],
    }),
  });

  assert.equal(result.status, "moderation_hold");
  assert.equal(result.reason, "real_ip_similarity");
  assert.ok(result.ipSimilarity);
  assert.equal(result.ipSimilarity.reviewDefault, "moderation_hold");
  assert.equal(result.ipSimilarity.matches[0].canonicalName, "Hogwarts");
  assert.equal(ledger.state().factions.length, 0);
});

test("supporter threshold promotes trial faction to accepted", () => {
  const ledger = createFactionLedger({ supporterThreshold: 3 });
  const result = ledger.proposeFaction({
    source: {
      explorerId: "explorer_operator",
      runTicket: "rt_faction_seed",
      score: 88,
      rank: "operator",
    },
    proposal: proposal(),
  });

  ledger.supportFaction({ factionId: result.factionId, explorerId: "supporter_a", runTicket: "rt_support_a" });
  ledger.supportFaction({ factionId: result.factionId, explorerId: "supporter_b", runTicket: "rt_support_b" });
  const accepted = ledger.supportFaction({ factionId: result.factionId, explorerId: "supporter_c", runTicket: "rt_support_c" });

  assert.equal(accepted.status, "accepted");
  assert.equal(accepted.supporterCount, 3);
  assert.equal(ledger.state().factions[0].status, "accepted");
});

test("duplicate faction proposals merge into existing faction instead of creating another", () => {
  const ledger = createFactionLedger();
  const first = ledger.proposeFaction({
    source: { explorerId: "explorer_operator", runTicket: "rt_faction_seed", score: 88, rank: "operator" },
    proposal: proposal(),
  });
  const second = ledger.proposeFaction({
    source: { explorerId: "explorer_second", runTicket: "rt_faction_duplicate", score: 91, rank: "operator" },
    proposal: proposal({ setting: "同名组织的另一份说明。" }),
  });

  assert.equal(second.status, "merged");
  assert.equal(second.mergedInto, first.factionId);
  assert.equal(ledger.state().factions.length, 1);
  assert.equal(ledger.state().factions[0].sources.length, 2);
});

test("accepted factions can be referenced by later runs", () => {
  const ledger = createFactionLedger({ supporterThreshold: 1 });
  const proposed = ledger.proposeFaction({
    source: { explorerId: "explorer_operator", runTicket: "rt_faction_seed", score: 88, rank: "operator" },
    proposal: proposal(),
  });
  ledger.supportFaction({ factionId: proposed.factionId, explorerId: "supporter_a", runTicket: "rt_support_a" });

  const reference = ledger.referenceFaction({ name: "回声树洞看守会", runTicket: "rt_later", explorerId: "explorer_later" });

  assert.equal(reference.status, "referenced");
  assert.ok(reference.faction);
  assert.equal(reference.faction.status, "accepted");
  assert.equal(reference.faction.references.length, 1);
});

test("proposals missing source, goal, setting, or conflict boundary are rejected", () => {
  const ledger = createFactionLedger();
  const result = ledger.proposeFaction({
    source: { explorerId: "explorer_operator", runTicket: "rt_faction_seed", score: 88, rank: "operator" },
    proposal: proposal({ goal: "" }),
  });

  assert.equal(result.status, "rejected");
  assert.equal(result.reason, "minimum_evidence_missing");
});
