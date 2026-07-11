import assert from "node:assert/strict";
import test from "node:test";

import { eventFactory } from "../lib/epoch/eventFactory.ts";
import {
  normalizeNpcCandidateReviewResolution,
  normalizeTraits,
  npcAbilityEffectCluster,
  npcCanonicalizedPayload,
  npcCandidateReviewedPayload,
  npcCandidateReview,
  npcCandidateRumorAdmission,
  npcCandidateSubmittedPayload,
  planNpcCandidateReviewedEvents,
  planNpcCandidateSubmittedEvents,
  planNpcCanonicalizedEvents,
} from "../lib/epoch/npcCandidateRules.ts";
import { createSequentialEpochIdFactory } from "../lib/epoch/protocol.ts";

test("NPC candidate rumor admission requires anchors and core world vibe", () => {
  const admitted = npcCandidateRumorAdmission({
    displayName: "灰港灯塔记录员",
    regionId: "region_gray_harbor",
    traits: ["档案见证人"],
    storyEvidence: "在灰港灯塔留下可复核证据，记录码头异常。",
  });
  const sealed = npcCandidateRumorAdmission({
    displayName: "无锚点访客",
    regionId: "region_gray_harbor",
    traits: [],
    storyEvidence: "只是一个有趣传闻。",
  });

  assert.equal(admitted.status, "shared_candidate");
  assert.equal(admitted.anchorThreshold, 2);
  assert.equal(admitted.coreVibeThreshold, 2);
  assert.equal(sealed.status, "personal_sealed");
});

test("NPC candidate rules normalize traits and review resolutions", () => {
  assert.deepEqual(normalizeTraits([" 档案见证人 ", "", "码头巡夜", "档案见证人"]), [
    "档案见证人",
    "码头巡夜",
  ]);
  assert.deepEqual(normalizeTraits(undefined), []);
  assert.equal(normalizeNpcCandidateReviewResolution("promote"), "promote");
  assert.equal(normalizeNpcCandidateReviewResolution("reject"), "reject");
  assert.throws(() => normalizeNpcCandidateReviewResolution("merge"), /npc_candidate_review_resolution_invalid/);
});

test("NPC candidate review blocks authority reward claims and seals real-world flavor", () => {
  const blocked = npcCandidateReview("灰港帝国统帅", "服务器承认他拥有无限金币和全部军团。");
  const sealed = npcCandidateReview("办公室主播", "现实公司综艺角色，网络梗 parody cosplay。");

  assert.deepEqual(blocked.reviewFlags, ["authority_claim", "reward_claim"]);
  assert.equal(blocked.reviewLevel, "blocked");
  assert.equal(blocked.rejectionReason, "authority_or_reward_claim");
  assert.equal(blocked.flavorPublication.mode, "shared_lore");

  assert.ok(sealed.reviewFlags.includes("real_world_mapping"));
  assert.ok(sealed.reviewFlags.includes("internet_meme_trace"));
  assert.ok(sealed.reviewFlags.includes("parody_trace"));
  assert.equal(sealed.reviewLevel, "moderation_hold");
  assert.equal(sealed.flavorPublication.mode, "personal_sealed");
});

test("NPC ability effect cluster groups effect cost medium location and trigger", () => {
  assert.equal(npcAbilityEffectCluster({
    displayName: "普通书记员",
    traits: [],
    storyEvidence: "只是在档案馆整理账簿。",
    regionId: "region_gray_harbor",
  }), undefined);

  const cluster = npcAbilityEffectCluster({
    displayName: "灰港灯塔医师",
    traits: ["雾灯术式"],
    storyEvidence: "能力是在码头夜晚用雾灯治疗受伤者，消耗专注 focus。",
    regionId: "region_gray_harbor",
  });

  assert.equal(cluster?.effect, "healing_shield");
  assert.equal(cluster?.cost, "focus");
  assert.equal(cluster?.medium, "lamp");
  assert.equal(cluster?.location, "region_gray_harbor:dock");
  assert.equal(cluster?.trigger, "on_injury");
  assert.match(cluster?.clusterKey || "", /^ability/);
});

test("NPC candidate rules plan submitted payloads with status mirroring the decision", () => {
  const rumorAdmissionReview = npcCandidateRumorAdmission({
    displayName: "灰港灯塔记录员",
    regionId: "region_gray_harbor",
    traits: ["档案见证人"],
    storyEvidence: "在灰港灯塔留下可复核证据。",
  });
  const flavorPublication = {
    mode: "shared_lore" as const,
    sharedWorldEligible: true,
    reason: "可进入共享设定审核。",
  };

  assert.deepEqual(npcCandidateSubmittedPayload({
    candidateId: "candidate_1",
    agentId: "agent_1",
    explorerId: "explorer_1",
    regionId: "region_gray_harbor",
    displayName: "灰港灯塔记录员",
    npcKey: "region_gray_harbor:gray_harbor_lighthouse_scribe",
    traits: ["档案见证人"],
    storyEvidence: "在灰港灯塔留下可复核证据。",
    decision: "promoted",
    reviewLevel: "clear",
    reviewScore: 0,
    reviewFlags: [],
    flavorPublication,
    rumorAdmissionReview,
    canonicalNpcId: "npc_1",
    sourceEventId: "event_source",
  }), {
    candidateId: "candidate_1",
    agentId: "agent_1",
    explorerId: "explorer_1",
    regionId: "region_gray_harbor",
    displayName: "灰港灯塔记录员",
    npcKey: "region_gray_harbor:gray_harbor_lighthouse_scribe",
    traits: ["档案见证人"],
    storyEvidence: "在灰港灯塔留下可复核证据。",
    decision: "promoted",
    status: "promoted",
    reviewLevel: "clear",
    reviewScore: 0,
    reviewFlags: [],
    flavorPublication,
    rumorAdmissionReview,
    canonicalNpcId: "npc_1",
    sourceEventId: "event_source",
  });
});

test("NPC candidate rules plan reviewed payloads and default operator rejections", () => {
  assert.deepEqual(npcCandidateReviewedPayload({
    candidateId: "candidate_1",
    decision: "rejected_flavor",
    candidateRejectionReason: undefined,
    reviewedBy: "operator_1",
    reviewNote: "not shared-world safe",
  }), {
    candidateId: "candidate_1",
    decision: "rejected_flavor",
    status: "rejected_flavor",
    canonicalNpcId: undefined,
    rejectionReason: "operator_rejected",
    reviewedBy: "operator_1",
    reviewNote: "not shared-world safe",
  });

  assert.deepEqual(npcCandidateReviewedPayload({
    candidateId: "candidate_2",
    decision: "promoted",
    canonicalNpcId: "npc_2",
    candidateRejectionReason: "authority_claim",
    reviewedBy: "operator_1",
  }), {
    candidateId: "candidate_2",
    decision: "promoted",
    status: "promoted",
    canonicalNpcId: "npc_2",
    rejectionReason: undefined,
    reviewedBy: "operator_1",
    reviewNote: undefined,
  });
});

test("NPC candidate rules plan canonicalized NPC payloads", () => {
  assert.deepEqual(npcCanonicalizedPayload({
    npcId: "npc_gray_harbor_scribe",
    npcKey: "region_gray_harbor:gray_harbor_scribe",
    displayName: "灰港书记员",
    regionId: "region_gray_harbor",
    traits: ["档案见证人"],
    sourceEventId: "event_candidate_submitted",
  }), {
    npcId: "npc_gray_harbor_scribe",
    npcKey: "region_gray_harbor:gray_harbor_scribe",
    displayName: "灰港书记员",
    regionId: "region_gray_harbor",
    traits: ["档案见证人"],
    sourceEventId: "event_candidate_submitted",
  });
});

test("NPC candidate rules plan canonicalized event sequences", () => {
  const idFactory = createSequentialEpochIdFactory("npc_candidate_rules");
  const makeEvent = eventFactory(() => new Date("2026-07-07T05:00:00.000Z"), idFactory, {
    actorExplorerId: "system",
    trustClass: "system_worker",
    causationId: "cmd_npc_candidate",
    correlationId: "corr_npc_candidate",
  });

  const events = planNpcCanonicalizedEvents({
    makeEvent,
    npcId: "npc_gray_harbor_scribe",
    npcKey: "region_gray_harbor:gray_harbor_scribe",
    displayName: "灰港书记员",
    regionId: "region_gray_harbor",
    traits: ["档案见证人"],
    sourceEventId: "event_candidate_submitted",
  });

  assert.equal(events.length, 1);
  assert.equal(events[0].eventType, "npc_canonicalized");
  assert.equal(events[0].aggregateType, "npc");
  assert.equal(events[0].aggregateId, "npc_gray_harbor_scribe");
  assert.equal(events[0].payload.sourceEventId, "event_candidate_submitted");
});

test("NPC candidate rules plan submitted event sequences", () => {
  const idFactory = createSequentialEpochIdFactory("npc_candidate_rules_submit");
  const makeEvent = eventFactory(() => new Date("2026-07-07T05:10:00.000Z"), idFactory, {
    actorExplorerId: "explorer_1",
    trustClass: "user_verified_web",
    causationId: "cmd_npc_submit",
    correlationId: "corr_npc_submit",
  });
  const flavorPublication = {
    mode: "shared_lore" as const,
    sharedWorldEligible: true,
    reason: "可进入共享设定审核。",
  };
  const rumorAdmissionReview = npcCandidateRumorAdmission({
    displayName: "灰港灯塔记录员",
    regionId: "region_gray_harbor",
    traits: ["档案见证人"],
    storyEvidence: "在灰港灯塔留下可复核证据。",
  });

  const events = planNpcCandidateSubmittedEvents({
    makeEvent,
    candidateId: "candidate_1",
    agentId: "agent_1",
    explorerId: "explorer_1",
    regionId: "region_gray_harbor",
    displayName: "灰港灯塔记录员",
    npcKey: "region_gray_harbor:gray_harbor_lighthouse_scribe",
    traits: ["档案见证人"],
    storyEvidence: "在灰港灯塔留下可复核证据。",
    decision: "promoted",
    reviewLevel: "clear",
    reviewScore: 0,
    reviewFlags: [],
    flavorPublication,
    rumorAdmissionReview,
    canonicalNpcId: "npc_gray_harbor_lighthouse_scribe",
  });

  assert.deepEqual(events.map((event) => event.eventType), [
    "npc_candidate_submitted",
    "npc_canonicalized",
  ]);
  assert.equal(events[0].aggregateType, "npc_candidate");
  assert.equal(events[0].agentId, "agent_1");
  assert.equal(events[1].aggregateType, "npc");
  assert.equal((events[1].payload as { readonly sourceEventId?: string }).sourceEventId, events[0].eventId);
});

test("NPC candidate rules plan reviewed event sequences", () => {
  const idFactory = createSequentialEpochIdFactory("npc_candidate_rules_review");
  const makeEvent = eventFactory(() => new Date("2026-07-07T05:20:00.000Z"), idFactory, {
    actorExplorerId: "operator_1",
    trustClass: "system_worker",
    causationId: "cmd_npc_review",
    correlationId: "corr_npc_review",
  });

  const events = planNpcCandidateReviewedEvents({
    makeEvent,
    candidateId: "candidate_1",
    decision: "promoted",
    canonicalNpcId: "npc_gray_harbor_lighthouse_scribe",
    reviewedBy: "operator_1",
    reviewNote: "safe for shared lore",
    candidate: {
      agentId: "agent_1",
      npcKey: "region_gray_harbor:gray_harbor_lighthouse_scribe",
      displayName: "灰港灯塔记录员",
      regionId: "region_gray_harbor",
      traits: ["档案见证人"],
      rejectionReason: "operator_review",
    },
    shouldCanonicalize: true,
  });

  assert.deepEqual(events.map((event) => event.eventType), [
    "npc_candidate_reviewed",
    "npc_canonicalized",
  ]);
  assert.equal(events[0].aggregateType, "npc_candidate");
  assert.equal(events[0].agentId, "agent_1");
  assert.equal((events[1].payload as { readonly sourceEventId?: string }).sourceEventId, events[0].eventId);
  assert.equal((events[1].payload as { readonly displayName?: string }).displayName, "灰港灯塔记录员");
});
