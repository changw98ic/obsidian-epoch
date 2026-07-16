import test from "node:test";
import assert from "node:assert/strict";
import { adjudicateRun, claimSlotsForScore } from "../lib/adjudicator.ts";
import { findApiKeyLeaks, redactApiKeys } from "../lib/safety.ts";

test("claimSlotsForScore follows shared-world admission thresholds", () => {
  assert.equal(claimSlotsForScore(59, 5), 0);
  assert.equal(claimSlotsForScore(60, 5), 1);
  assert.equal(claimSlotsForScore(70, 5), 2);
  assert.equal(claimSlotsForScore(80, 5), 3);
  assert.equal(claimSlotsForScore(90, 5), 4);
  assert.equal(claimSlotsForScore(98, 5), 5);
});

test("claimSlotsForScore caps highest-tier admissions server-side", () => {
  assert.equal(claimSlotsForScore(99, 50), 5);
});

test("adjudicateRun ignores client-provided score", () => {
  const result = adjudicateRun({
    mode: "demo",
    clientScore: 100,
    mandate: "占位故事",
    events: [],
    ending: { summary: "" },
    candidateClaims: [],
  });

  assert.equal(result.trustedClientScore, false);
  assert.ok(result.score < 60);
  assert.equal(result.claimSlots, 0);
  assert.equal(result.nextAction, "repair");
});

test("adjudicateRun does not score client-declared candidate claim quantity", () => {
  const run = {
    mandate: "调查腐林西缘的会回信树洞",
    anchors: [{ type: "place", id: "region:腐林" }],
    events: [
      { id: "event_01", risk: "low", outcome: "recorded first echo" },
      { id: "event_02", risk: "medium", outcome: "compared response timing" },
    ],
    ending: { type: "archive", summary: "灰档-07 证明树洞会复读死者录音，但没有触碰核心秘密。" },
  };
  const withoutClientClaims = adjudicateRun({ ...run, candidateClaims: [] });
  const withClientClaims = adjudicateRun({
    ...run,
    candidateClaims: Array.from({ length: 50 }, (_, index) => ({
      subject: `客户端候选 ${index}`,
      predicate: "claim",
      object: "should not raise score",
    })),
  });

  assert.equal(withClientClaims.score, withoutClientClaims.score);
});

test("adjudicateRun rewards complete, evidenced demo reports without world impact", () => {
  const result = adjudicateRun({
    mode: "demo",
    mandate: "调查腐林西缘的会回信树洞",
    anchors: [{ type: "place", id: "region:腐林" }],
    events: [
      { id: "event_01", risk: "low", outcome: "recorded first echo" },
      { id: "event_02", risk: "medium", outcome: "compared response timing" },
      {
        id: "event_03",
        risk: "high",
        authorized: true,
        userConfirmationId: "confirm_high_risk_demo_001",
        cost: { resourceId: "focus", amount: 1, paid: true },
        evidenceChain: ["event_01", "event_02"],
        limitations: ["sample remains sealed until operator review"],
        outcome: "sealed polluted sample",
      },
      { id: "event_04", risk: "low", outcome: "returned with archive evidence" },
    ],
    ending: { type: "archive", summary: "灰档-07 证明树洞会复读死者录音，但没有触碰核心秘密。" },
    candidateClaims: [
      { subject: "会回信树洞", predicate: "effect", object: "会复读死者录音" },
      { subject: "盐化录音笔", predicate: "limit", object: "只能保存三次污染回声" },
      { subject: "灰档-07", predicate: "status", object: "听觉污染轻度" },
    ],
    clientScore: 1,
  });

  assert.equal(result.trustedClientScore, false);
  assert.equal(result.worldImpact, "private_demo");
  assert.ok(result.score >= 70);
  assert.equal(result.claimSlots, 2);
  assert.equal(result.nextAction, "eligible_for_review");
});

test("adjudicateRun requires high-risk structure before scoring high-risk reports", () => {
  const run = {
    mandate: "封存腐林树洞核心污染样本",
    anchors: [{ type: "place", id: "region:腐林" }],
    events: [
      { id: "event_01", risk: "low", outcome: "recorded first echo" },
      {
        id: "event_02",
        risk: "high",
        authorized: true,
        userConfirmed: true,
        outcome: "sealed polluted sample",
        visibleText: "以极高代价完成华丽封印，污染在银火中退潮，世界因此记住灰档-07。",
      },
      { id: "event_03", risk: "low", outcome: "returned with archive evidence" },
    ],
    ending: { type: "archive", summary: "灰档-07 带回可复核录音，证明树洞核心污染样本已被封存。" },
    candidateClaims: [
      { subject: "会回信树洞", predicate: "core_sample", object: "sealed" },
    ],
  };

  const ornate = adjudicateRun(run);
  const structured = adjudicateRun({
    ...run,
    events: run.events.map((event) => event.id === "event_02"
      ? {
        ...event,
        userConfirmationId: "confirm_high_risk_structure_001",
        cost: { resourceId: "focus", amount: 1, paid: true },
        evidenceChain: ["event_01", "event_02"],
        limitations: ["sealed sample cannot be used as public proof until operator review"],
      }
      : event),
  });

  assert.equal(ornate.nextAction, "repair");
  assert.equal(ornate.claimSlots, 0);
  assert.match(ornate.reasons.join(","), /high_risk_structure_missing/);
  assert.equal(structured.nextAction, "eligible_for_review");
  assert.equal(structured.claimSlots, 1);
});

test("adjudicateRun does not reward dramatic high-risk conflict", () => {
  const grounded = adjudicateRun({
    mandate: "记录灰港灯塔维护",
    anchors: [{ type: "place", id: "region:gray-harbor" }],
    events: [
      { id: "event_01", risk: "low", outcome: "checked lantern seals" },
      { id: "event_02", risk: "medium", authorized: true, outcome: "logged corrosion evidence" },
      { id: "event_03", risk: "low", outcome: "returned with maintenance notes" },
    ],
    ending: { summary: "记录员完成灰港灯塔维护复核，保留可验证证据但不制造额外冲突。" },
  });
  const dramatic = adjudicateRun({
    mandate: "记录灰港灯塔维护",
    anchors: [{ type: "place", id: "region:gray-harbor" }],
    events: [
      { id: "event_01", risk: "low", outcome: "checked lantern seals" },
      {
        id: "event_02",
        risk: "high",
        authorized: true,
        outcome: "logged corrosion evidence",
        visibleText: "为了戏剧性主动制造牺牲、污染和死亡冲突。",
      },
      { id: "event_03", risk: "low", outcome: "returned with maintenance notes" },
    ],
    ending: { summary: "记录员完成灰港灯塔维护复核，保留可验证证据但不制造额外冲突。" },
  });

  assert.ok(dramatic.score <= grounded.score);
  assert.ok(dramatic.claimSlots <= grounded.claimSlots);
});

test("findApiKeyLeaks locates and redactApiKeys masks secret-looking text", () => {
  const unsafe = {
    transcript: "never send sk-proj-abcdefghijklmnopqrstuvwxyz1234567890 to the server",
    nested: ["Bearer sk-abcdefghijklmnopqrstuvwxyz1234567890"],
  };

  const leaks = findApiKeyLeaks(unsafe);
  const redacted = redactApiKeys(unsafe);

  assert.equal(leaks.length, 2);
  assert.match(JSON.stringify(redacted), /\[REDACTED_API_KEY\]/);
  assert.doesNotMatch(JSON.stringify(redacted), /sk-proj-abcdefghijklmnopqrstuvwxyz1234567890/);
});
