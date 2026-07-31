import type { CapturePhase6ServerRagEvaluationInput } from "./phase6ServerRagTraceRules.ts";

export const PHASE6_RAG_EVALUATION_POLICY_VERSION = "phase6-rag-evaluation-policy.v1" as const;

export interface Phase6RagEvaluationProfile {
  readonly runIndex: number;
  readonly query: string;
  readonly expectedFactIds: readonly string[];
  readonly expectedRouteEvidenceIds: readonly string[];
}

export interface Phase6RagEvaluationRetrievedChunk {
  readonly sourceId: string;
  readonly rank: number;
}

// The ten profiles are a server-owned, versioned retrieval benchmark.  They
// intentionally name canonical sources instead of accepting a client-supplied
// answer set, so a client cannot turn an arbitrary retrieval into a passing
// Phase 6 evaluation.
export const PHASE6_RAG_EVALUATION_PROFILES = [
  {
    runIndex: 1,
    query: "世界经济与资源规则 权威地理与区域规则 镜面城 棱镜水域 route_mirror_prism 水轨",
    expectedFactIds: [
      "world_knowledge:rules:rule_economy_resources",
      "world_knowledge:rules:rule_canonical_geography",
    ],
    expectedRouteEvidenceIds: ["world_knowledge:routes:route_mirror_prism"],
  },
  {
    runIndex: 2,
    query: "历史时间线与信息传播规则 权威地理与区域规则 镜面城 轨道城 route_mirror_orbit",
    expectedFactIds: [
      "world_knowledge:rules:rule_history_information",
      "world_knowledge:rules:rule_canonical_geography",
    ],
    expectedRouteEvidenceIds: ["world_knowledge:routes:route_mirror_orbit"],
  },
  {
    runIndex: 3,
    query: "任务机会与服务端裁定规则 权威地理与区域规则 镜面城 腐林 route_mirror_forest",
    expectedFactIds: [
      "world_knowledge:rules:rule_opportunity_server_adjudication",
      "world_knowledge:rules:rule_canonical_geography",
    ],
    expectedRouteEvidenceIds: ["world_knowledge:routes:route_mirror_forest"],
  },
  {
    runIndex: 4,
    query: "身份人生与需求规则 权威地理与区域规则 镜面城 盐门 route_mirror_saltgate",
    expectedFactIds: [
      "world_knowledge:rules:rule_identity_life_needs",
      "world_knowledge:rules:rule_canonical_geography",
    ],
    expectedRouteEvidenceIds: ["world_knowledge:routes:route_mirror_saltgate"],
  },
  {
    runIndex: 5,
    query: "世界经济与资源规则 生态人口与生命规则 腐林 湿谷 route_forest_wetvalley",
    expectedFactIds: [
      "world_knowledge:rules:rule_economy_resources",
      "world_knowledge:rules:rule_ecology_demography_life",
    ],
    expectedRouteEvidenceIds: ["world_knowledge:routes:route_forest_wetvalley"],
  },
  {
    runIndex: 6,
    query: "势力治理与战争规则 任务机会与服务端裁定规则 轨道城 轨道圣堂 route_orbit_cathedral",
    expectedFactIds: [
      "world_knowledge:rules:rule_faction_governance_war",
      "world_knowledge:rules:rule_opportunity_server_adjudication",
    ],
    expectedRouteEvidenceIds: ["world_knowledge:routes:route_orbit_cathedral"],
  },
  {
    runIndex: 7,
    query: "健康医疗与污染规则 权威地理与区域规则 灰烬哨站 灰烬荒原 route_outpost_ash",
    expectedFactIds: [
      "world_knowledge:rules:rule_health_medicine_contamination",
      "world_knowledge:rules:rule_canonical_geography",
    ],
    expectedRouteEvidenceIds: ["world_knowledge:routes:route_outpost_ash"],
  },
  {
    runIndex: 8,
    query: "东方修行者 权威地理与区域规则 腐林 山海森林 route_forest_shanhai",
    expectedFactIds: [
      "world_knowledge:systems:system_cultivation",
      "world_knowledge:rules:rule_canonical_geography",
    ],
    expectedRouteEvidenceIds: ["world_knowledge:routes:route_forest_shanhai"],
  },
  {
    runIndex: 9,
    query: "物品制造与技术研究规则 世界经济与资源规则 废弃矿区 神尸矿区 route_mine_divinecorpse",
    expectedFactIds: [
      "world_knowledge:rules:rule_items_crafting_research",
      "world_knowledge:rules:rule_economy_resources",
    ],
    expectedRouteEvidenceIds: ["world_knowledge:routes:route_mine_divinecorpse"],
  },
  {
    runIndex: 10,
    query: "世界时间与历法 权威地理与区域规则 镜面城 棱镜水域 route_mirror_prism",
    expectedFactIds: [
      "world_knowledge:rules:rule_world_time_calendar",
      "world_knowledge:rules:rule_canonical_geography",
    ],
    expectedRouteEvidenceIds: ["world_knowledge:routes:route_mirror_prism"],
  },
] as const satisfies readonly Phase6RagEvaluationProfile[];

function uniqueSorted(values: readonly string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right));
}

export function phase6RagEvaluationProfileForRun(runIndex: number): Phase6RagEvaluationProfile {
  const profile = PHASE6_RAG_EVALUATION_PROFILES.find((candidate) => candidate.runIndex === runIndex);
  if (!profile) throw new Error("phase6_rag_evaluation_profile_missing");
  return profile;
}

export function buildPhase6RagServerEvaluation(input: {
  readonly runIndex: number;
  readonly retrievedChunks: readonly Phase6RagEvaluationRetrievedChunk[];
  readonly sourceEventIds: readonly string[];
}): CapturePhase6ServerRagEvaluationInput {
  const profile = phase6RagEvaluationProfileForRun(input.runIndex);
  const sourceEventIds = uniqueSorted(input.sourceEventIds);
  if (sourceEventIds.length === 0) throw new Error("phase6_rag_evaluation_source_events_missing");
  const retrievedChunks = input.retrievedChunks
    .filter((chunk) => chunk.sourceId.trim() && Number.isInteger(chunk.rank) && chunk.rank > 0)
    .sort((left, right) => left.rank - right.rank || left.sourceId.localeCompare(right.sourceId));
  const summarizedRoute = retrievedChunks.find((chunk) =>
    chunk.sourceId.startsWith("world_knowledge:routes:"));
  return {
    expectedRecentKeyFacts: profile.expectedFactIds.map((factId) => ({ factId, sourceEventIds })),
    retrievedFactIds: uniqueSorted(retrievedChunks.map((chunk) => chunk.sourceId)),
    expectedRouteEvidence: profile.expectedRouteEvidenceIds.map((evidenceId) => ({ evidenceId, sourceEventIds })),
    returnedRouteEvidence: summarizedRoute
      ? [{ evidenceId: summarizedRoute.sourceId, sourceEventIds }]
      : [],
  };
}
