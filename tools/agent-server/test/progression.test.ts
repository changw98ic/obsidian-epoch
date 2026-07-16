import test from "node:test";
import assert from "node:assert/strict";
import {
  createProgressionLedger,
  externalItemLimitForRank,
  rankForReputation,
} from "../lib/progression.ts";

test("rankForReputation and externalItemLimitForRank gate carrying power", () => {
  assert.equal(rankForReputation(0).rank, "outsider");
  assert.equal(rankForReputation(10).rank, "field_agent");
  assert.equal(rankForReputation(30).rank, "operator");
  assert.equal(rankForReputation(60).rank, "high_clearance");

  assert.equal(externalItemLimitForRank("outsider"), 1);
  assert.equal(externalItemLimitForRank("field_agent"), 2);
  assert.equal(externalItemLimitForRank("operator"), 3);
  assert.equal(externalItemLimitForRank("high_clearance"), 5);
});

test("low reputation cannot perform high-rank operations", () => {
  const ledger = createProgressionLedger({ now: () => new Date("2026-06-24T01:00:00.000Z") });

  const createFaction = ledger.canPerformOperation({
    explorerId: "explorer_low",
    factionId: "腐林档案会",
    operation: "create_faction",
  });
  const carryThreeItems = ledger.canCarryExternalItems({
    explorerId: "explorer_low",
    factionId: "腐林档案会",
    itemCount: 3,
  });

  assert.equal(createFaction.allowed, false);
  assert.equal(createFaction.reason, "rank_too_low");
  assert.equal(carryThreeItems.allowed, false);
  assert.equal(carryThreeItems.limit, 1);
});

test("high quality public runs grant capped faction reputation and traits", () => {
  const ledger = createProgressionLedger({ now: () => new Date("2026-06-24T01:00:00.000Z") });
  const first = ledger.applyRunProgression({
    source: { explorerId: "explorer_good", runTicket: "rt_good_1" },
    run: {
      factionId: "腐林档案会",
      mandate: "调查腐林西缘的会回信树洞",
      externalItems: ["盐化录音笔"],
    },
    adjudication: { score: 92, rating: "major", worldImpact: "review_candidate" },
    lore: { accepted: [{ status: "canonical" }, { status: "disputed" }] },
  });
  const second = ledger.applyRunProgression({
    source: { explorerId: "explorer_good", runTicket: "rt_good_2" },
    run: {
      factionId: "腐林档案会",
      mandate: "调查腐林西缘的会回信树洞",
      externalItems: ["盐化录音笔"],
    },
    adjudication: { score: 98, rating: "hang", worldImpact: "review_candidate" },
    lore: { accepted: [{ status: "canonical" }, { status: "canonical" }, { status: "canonical" }] },
  });
  const state = ledger.getExplorerProgression("explorer_good");

  assert.equal(first.pointsAwarded, 18);
  assert.equal(second.pointsAwarded, 7);
  assert.equal(state.factions["腐林档案会"].reputation, 25);
  assert.equal(state.factions["腐林档案会"].rank, "field_agent");
  assert.deepEqual(state.factions["腐林档案会"].traits, ["腐林追踪 I"]);
  assert.equal(state.dailyCaps["2026-06-24|腐林档案会"].awarded, 25);
});

test("different factions unlock different specialties", () => {
  const ledger = createProgressionLedger({ now: () => new Date("2026-06-24T01:00:00.000Z") });
  ledger.applyRunProgression({
    source: { explorerId: "explorer_multi", runTicket: "rt_multi_1" },
    run: { factionId: "云脑族", mandate: "整理云脑族梦频档案" },
    adjudication: { score: 88, worldImpact: "review_candidate" },
    lore: { accepted: [] },
  });
  ledger.applyRunProgression({
    source: { explorerId: "explorer_multi", runTicket: "rt_multi_2" },
    run: { factionId: "赛博工业财团", mandate: "复核财团样本匣" },
    adjudication: { score: 88, worldImpact: "review_candidate" },
    lore: { accepted: [] },
  });
  const state = ledger.getExplorerProgression("explorer_multi");

  assert.deepEqual(state.factions["云脑族"].traits, ["梦频索引 I"]);
  assert.deepEqual(state.factions["赛博工业财团"].traits, ["样本调度 I"]);
});

test("private or failed runs do not advance public progression", () => {
  const ledger = createProgressionLedger({ now: () => new Date("2026-06-24T01:00:00.000Z") });
  const privateRun = ledger.applyRunProgression({
    source: { explorerId: "explorer_private", runTicket: "rt_private" },
    run: { factionId: "腐林档案会" },
    adjudication: { score: 99, worldImpact: "private_demo" },
    lore: { accepted: [] },
  });
  const failedRun = ledger.applyRunProgression({
    source: { explorerId: "explorer_private", runTicket: "rt_failed" },
    run: { factionId: "腐林档案会" },
    adjudication: { score: 59, worldImpact: "none" },
    lore: { accepted: [] },
  });

  assert.equal(privateRun.pointsAwarded, 0);
  assert.equal(failedRun.pointsAwarded, 0);
  assert.deepEqual(ledger.getExplorerProgression("explorer_private").factions, {});
});
