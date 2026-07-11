import { assessSharedNameIpSimilarity, type IpSimilarityAssessment } from "../ipSimilarity.ts";
import type {
  AbilityEffectCluster,
  EpochEvent,
  NpcCanonicalizedPayload,
  NpcCandidateDecision,
  NpcCandidateFlavorPublication,
  NpcCandidateReviewedPayload,
  NpcCandidateReviewFlag,
  NpcCandidateReviewLevel,
  NpcCandidateSubmittedPayload,
  RumorAdmissionReview,
} from "./events.ts";
import type { EpochEventFactory } from "./eventFactory.ts";
import { stableKey } from "./protocol.ts";

export interface NpcCandidateReviewResult {
  readonly reviewFlags: readonly NpcCandidateReviewFlag[];
  readonly reviewScore: number;
  readonly reviewLevel: NpcCandidateReviewLevel;
  readonly rejectionReason?: string;
  readonly ipSimilarity?: IpSimilarityAssessment;
  readonly flavorPublication: NpcCandidateFlavorPublication;
}

export type NpcCandidateSubmittedPayloadInput = Omit<NpcCandidateSubmittedPayload, "status">;
export type ReviewNpcCandidateResolution = "promote" | "reject";

export interface NpcCandidateReviewedPayloadInput {
  readonly candidateId: string;
  readonly decision: NpcCandidateDecision;
  readonly canonicalNpcId?: string;
  readonly candidateRejectionReason?: string;
  readonly reviewedBy: string;
  readonly reviewNote?: string;
}

export type NpcCanonicalizedPayloadInput = NpcCanonicalizedPayload;

export interface PlanNpcCanonicalizedEventsInput extends NpcCanonicalizedPayloadInput {
  readonly makeEvent: EpochEventFactory;
}

export interface PlanNpcCandidateSubmittedEventsInput extends NpcCandidateSubmittedPayloadInput {
  readonly makeEvent: EpochEventFactory;
}

export interface NpcCandidateReviewedEventsCandidate {
  readonly agentId: string;
  readonly npcKey: string;
  readonly displayName: string;
  readonly regionId: string;
  readonly traits: readonly string[];
  readonly rejectionReason?: string;
}

export interface PlanNpcCandidateReviewedEventsInput extends NpcCandidateReviewedPayloadInput {
  readonly makeEvent: EpochEventFactory;
  readonly candidate: NpcCandidateReviewedEventsCandidate;
  readonly shouldCanonicalize: boolean;
}

const RUMOR_ANCHOR_THRESHOLD = 2;
const RUMOR_CORE_VIBE_THRESHOLD = 2;

export function normalizeTraits(traits: readonly string[] | undefined): readonly string[] {
  return [...new Set((traits || []).map((trait) => trait.trim()).filter(Boolean))];
}

export function normalizeNpcCandidateReviewResolution(value: unknown): ReviewNpcCandidateResolution {
  if (value === "promote" || value === "reject") return value;
  throw new Error("npc_candidate_review_resolution_invalid");
}

export function npcCandidateRumorAdmission(input: {
  readonly displayName: string;
  readonly regionId: string;
  readonly traits: readonly string[];
  readonly storyEvidence: string;
}): RumorAdmissionReview {
  const surface = `${input.displayName} ${input.traits.join(" ")} ${input.storyEvidence}`.toLowerCase().normalize("NFKC");
  const storySurface = `${input.displayName} ${input.storyEvidence}`.toLowerCase().normalize("NFKC");
  let anchorCompleteness = 0;
  if (/灰港|腐林|废矿|管城|region_[a-z0-9_]+|gray[-_\s]?harbor|rot[-_\s]?forest|abandoned[-_\s]?mine/.test(storySurface)) {
    anchorCompleteness += 1;
  }
  if (/码头|灯塔|档案馆|树洞|矿井|市场|街区|港口|dock|lighthouse|archive|market/.test(storySurface)) {
    anchorCompleteness += 1;
  }
  if (input.traits.length > 0) anchorCompleteness += 1;
  if (/可复核|见证|记录|锚点|证据|witness|evidence|anchor/.test(storySurface)) anchorCompleteness += 1;

  let coreVibeScore = 0;
  if (/灰港|腐林|废矿|管城|gray[-_\s]?harbor|rot[-_\s]?forest/.test(surface)) coreVibeScore += 1;
  if (/档案|档案馆|archive|ledger/.test(surface)) coreVibeScore += 1;
  if (/灵质|异常|旧神|盐镜|雾灯|灯塔|aether|anomaly|old[-_\s]?god|lamp|lighthouse/.test(surface)) {
    coreVibeScore += 1;
  }
  if (/码头|港口|矿井|树洞|dock|harbor|mine/.test(surface)) coreVibeScore += 1;
  if (/可复核|见证|锚点|证据|witness|anchor|evidence/.test(surface)) coreVibeScore += 1;

  const admitted = anchorCompleteness >= RUMOR_ANCHOR_THRESHOLD && coreVibeScore >= RUMOR_CORE_VIBE_THRESHOLD;
  return {
    status: admitted ? "shared_candidate" : "personal_sealed",
    anchorCompleteness,
    anchorThreshold: RUMOR_ANCHOR_THRESHOLD,
    coreVibeScore,
    coreVibeThreshold: RUMOR_CORE_VIBE_THRESHOLD,
    reason: admitted
      ? "传闻锚点完整性和核心气质评分达到共享候选门槛。"
      : "传闻锚点完整性或核心气质评分低于门槛，只允许个人封存。",
  };
}

export function npcCandidateReview(displayName: string, storyEvidence: string): NpcCandidateReviewResult {
  const normalized = `${displayName} ${storyEvidence}`.toLowerCase().normalize("NFKC");
  const authorityClaim = /帝国统帅|统帅|皇帝|神王|服务器承认|全部军团|admin|root|server\s+owner/.test(normalized);
  const rewardClaim = /无限金币|金币|资源|奖励|寿命|传说|legend|grant|coin|aether|stamina|focus|lifetime/.test(normalized);
  const chosenOneClaim = /唯一救世主|命定主角|预言之子|天命|神选|chosen\s+one|protagonist/.test(normalized);
  const worldScaleClaim = /改写整个|全世界|诸天|所有区域|世界.*命运|统治灰港|统治世界/.test(normalized);
  const realWorldMapping = /现实|办公室|公司|学校|城市|综艺|明星|主播|直播|短视频|微博|抖音|知乎|b站|北京|上海|东京|纽约/.test(normalized);
  const internetMemeTrace = /网络梗|梗|破防|牛马|打工人|社畜|抽象|乐子|整活|yyds|绝绝子|栓q|蚌埠|meme/.test(normalized);
  const parodyTrace = /戏仿|恶搞|山寨|高仿|致敬|cosplay|综艺角色|parody|spoof/.test(normalized);
  const ipSimilarity = assessSharedNameIpSimilarity({
    surface: "character",
    fields: { displayName, storyEvidence },
  });
  const ipSimilarityClaim = ipSimilarity.status === "suspected";
  const flavorSealRequired = ipSimilarityClaim || realWorldMapping || internetMemeTrace || parodyTrace;
  const reviewFlags: NpcCandidateReviewFlag[] = [];
  if (authorityClaim) reviewFlags.push("authority_claim");
  if (rewardClaim) reviewFlags.push("reward_claim");
  if (chosenOneClaim) reviewFlags.push("chosen_one_claim");
  if (worldScaleClaim) reviewFlags.push("world_scale_claim");
  if (ipSimilarityClaim) reviewFlags.push("real_ip_similarity");
  if (realWorldMapping) reviewFlags.push("real_world_mapping");
  if (internetMemeTrace) reviewFlags.push("internet_meme_trace");
  if (parodyTrace) reviewFlags.push("parody_trace");
  const reviewScore = reviewFlags.reduce((score, flag) => {
    if (flag === "authority_claim") return score + 2;
    if (flag === "world_scale_claim") return score + 2;
    if (flag === "real_ip_similarity") return score + 3;
    if (flag === "real_world_mapping" || flag === "internet_meme_trace" || flag === "parody_trace") return score + 2;
    return score + 1;
  }, 0);
  const rejectionReason = authorityClaim && rewardClaim
    ? "authority_or_reward_claim"
    : authorityClaim
      ? "authority_claim"
      : undefined;
  const flavorPublication: NpcCandidateFlavorPublication = flavorSealRequired
    ? {
      mode: "personal_sealed",
      sharedWorldEligible: false,
      reason: "疑似现实映射、互联网梗、戏仿或 IP 相似，只允许个人封存，不进入共享设定。",
    }
    : {
      mode: "shared_lore",
      sharedWorldEligible: true,
      reason: "未触发现实映射、互联网梗或戏仿痕迹，可进入常规共享设定审核。",
    };
  return {
    reviewFlags,
    reviewScore,
    reviewLevel: flavorSealRequired ? "moderation_hold" : rejectionReason ? "blocked" : reviewScore > 0 ? "watch" : "clear",
    rejectionReason,
    ipSimilarity: ipSimilarityClaim ? ipSimilarity : undefined,
    flavorPublication,
  };
}

export function npcCandidateSubmittedPayload(input: NpcCandidateSubmittedPayloadInput): NpcCandidateSubmittedPayload {
  return {
    ...input,
    status: input.decision,
  };
}

export function npcCandidateReviewedPayload(input: NpcCandidateReviewedPayloadInput): NpcCandidateReviewedPayload {
  return {
    candidateId: input.candidateId,
    decision: input.decision,
    status: input.decision,
    canonicalNpcId: input.canonicalNpcId,
    rejectionReason: input.decision === "rejected_flavor"
      ? input.candidateRejectionReason || "operator_rejected"
      : undefined,
    reviewedBy: input.reviewedBy,
    reviewNote: input.reviewNote,
  };
}

export function npcCanonicalizedPayload(input: NpcCanonicalizedPayloadInput): NpcCanonicalizedPayload {
  return {
    npcId: input.npcId,
    npcKey: input.npcKey,
    displayName: input.displayName,
    regionId: input.regionId,
    traits: input.traits,
    sourceEventId: input.sourceEventId,
  };
}

export function planNpcCanonicalizedEvents(input: PlanNpcCanonicalizedEventsInput): readonly EpochEvent[] {
  const payload = npcCanonicalizedPayload(input);
  return [
    input.makeEvent("npc_canonicalized", input.npcId, payload, { aggregateType: "npc" }),
  ];
}

export function planNpcCandidateSubmittedEvents(input: PlanNpcCandidateSubmittedEventsInput): readonly EpochEvent[] {
  const payload = npcCandidateSubmittedPayload(input);
  const submitted = input.makeEvent("npc_candidate_submitted", input.candidateId, payload, {
    aggregateType: "npc_candidate",
    agentId: input.agentId,
  });
  const nextEvents: EpochEvent[] = [submitted];
  if (input.decision === "promoted" && input.canonicalNpcId) {
    nextEvents.push(...planNpcCanonicalizedEvents({
      makeEvent: input.makeEvent,
      npcId: input.canonicalNpcId,
      npcKey: input.npcKey,
      displayName: input.displayName,
      regionId: input.regionId,
      traits: input.traits,
      sourceEventId: submitted.eventId,
    }));
  }
  return nextEvents;
}

export function planNpcCandidateReviewedEvents(input: PlanNpcCandidateReviewedEventsInput): readonly EpochEvent[] {
  const payload = npcCandidateReviewedPayload({
    candidateId: input.candidateId,
    decision: input.decision,
    canonicalNpcId: input.canonicalNpcId,
    candidateRejectionReason: input.candidateRejectionReason || input.candidate.rejectionReason,
    reviewedBy: input.reviewedBy,
    reviewNote: input.reviewNote,
  });
  const reviewed = input.makeEvent("npc_candidate_reviewed", input.candidateId, payload, {
    aggregateType: "npc_candidate",
    agentId: input.candidate.agentId,
  });
  const nextEvents: EpochEvent[] = [reviewed];
  if (input.shouldCanonicalize && input.canonicalNpcId) {
    nextEvents.push(...planNpcCanonicalizedEvents({
      makeEvent: input.makeEvent,
      npcId: input.canonicalNpcId,
      npcKey: input.candidate.npcKey,
      displayName: input.candidate.displayName,
      regionId: input.candidate.regionId,
      traits: input.candidate.traits,
      sourceEventId: reviewed.eventId,
    }));
  }
  return nextEvents;
}

export function npcAbilityEffectCluster(input: {
  readonly displayName: string;
  readonly traits: readonly string[];
  readonly storyEvidence: string;
  readonly regionId: string;
}): AbilityEffectCluster | undefined {
  const normalized = `${input.displayName} ${input.traits.join(" ")} ${input.storyEvidence}`.toLowerCase().normalize("NFKC");
  const hasAbilityClaim = /能力|技能|术式|法术|咒|异能|ability|skill|spell|power/.test(normalized);
  if (!hasAbilityClaim) return undefined;

  const effect = /治愈|治疗|疗愈|修复|护盾|屏障|healing|heal|shield|barrier/.test(normalized)
    ? "healing_shield"
    : /侦测|探测|定位|追踪|scry|detect|scan|track/.test(normalized)
      ? "detection"
      : /传送|闪现|位移|teleport|blink|movement/.test(normalized)
        ? "movement"
        : /火|燃烧|焚|flame|fire|burn/.test(normalized)
          ? "fire_damage"
          : /攻击|伤害|爆发|damage|strike|burst/.test(normalized)
            ? "direct_damage"
            : "unspecified_effect";
  const cost = /灵质|以太|aether/.test(normalized)
    ? "aether"
    : /专注|focus/.test(normalized)
      ? "focus"
      : /体力|疲劳|stamina/.test(normalized)
        ? "stamina"
        : /金币|coin/.test(normalized)
          ? "coin"
          : /寿命|生命|lifetime|life/.test(normalized)
            ? "lifetime"
            : /血|blood/.test(normalized)
              ? "blood"
              : /无成本|免费|free/.test(normalized)
                ? "none"
                : "unspecified_cost";
  const medium = /雾灯|灯|提灯|lamp|lantern/.test(normalized)
    ? "lamp"
    : /符文|符|rune|sigil/.test(normalized)
      ? "rune"
      : /血|blood/.test(normalized)
        ? "blood"
        : /歌|声|song|voice/.test(normalized)
          ? "voice"
          : /器械|装置|device|tool/.test(normalized)
            ? "device"
            : /手势|gesture/.test(normalized)
              ? "gesture"
              : "unspecified_medium";
  const location = /码头|dock/.test(normalized)
    ? `${input.regionId}:dock`
    : /港口|港区|harbor/.test(normalized)
      ? `${input.regionId}:harbor`
      : /森林|林地|forest/.test(normalized)
        ? `${input.regionId}:forest`
        : /城镇|城市|街区|settlement|city|street/.test(normalized)
          ? `${input.regionId}:settlement`
          : input.regionId;
  const trigger = /受伤|濒死|injured|wounded/.test(normalized)
    ? "on_injury"
    : /夜晚|午夜|night|midnight/.test(normalized)
      ? "at_night"
      : /接触|触碰|contact|touch/.test(normalized)
        ? "on_contact"
        : /触发|trigger/.test(normalized)
          ? "on_triggered_contact"
          : "unspecified_trigger";
  const clusterKey = stableKey(["ability", effect, cost, medium, location, trigger].join(":"));
  return {
    clusterKey,
    effect,
    cost,
    medium,
    location,
    trigger,
    summary: `${effect} / ${cost} / ${medium} / ${location} / ${trigger}`,
  };
}
