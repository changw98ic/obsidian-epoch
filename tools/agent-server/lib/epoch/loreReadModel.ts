import type { EpochEvent } from "./events.ts";
import type {
  EpochLoreContributionRecord,
  EpochLoreTargetAdjudication,
  EpochProjection,
} from "./gameCore.ts";
import {
  EPOCH_LORE_ADJUDICATION_STATUSES,
  EPOCH_LORE_CONTRIBUTION_CATEGORIES,
  normalizeTrustClass,
  type EpochEventType,
  type EpochLoreAdjudicationStatus,
  type EpochTrustClass,
} from "./protocol.ts";
import { auditPageForEventId } from "./sourceEventRules.ts";
import {
  loreClaimHash,
  loreContributionProvenanceForEvent,
  loreTargetAdjudicationProvenanceForEvent,
  uniqueSortedValues,
} from "./loreProvenanceRules.ts";

type AnyRecord = Record<string, unknown>;

type EpochWorldviewSecretTier =
  | "T0_public"
  | "T1_low_rumor"
  | "T2_local_secret"
  | "T3_core_secret"
  | "T4_forbidden_core";

export type EpochWorldHonorCategory =
  | "exploration"
  | "confirmation"
  | "refutation"
  | "revision"
  | "high_risk_survival"
  | "low_risk_stability";

export interface EpochWorldHonorBoardEntry {
  readonly agentId: string;
  readonly explorerId?: string;
  readonly identityName?: string;
  readonly score: number;
  readonly latestEventId?: string;
  readonly latestEventType?: EpochEventType;
  readonly latestAt?: string;
  readonly publicPages: {
    readonly agent: string;
    readonly explorer?: string;
  };
}

export interface EpochWorldHonorBoard {
  readonly category: EpochWorldHonorCategory;
  readonly title: string;
  readonly description: string;
  readonly entries: readonly EpochWorldHonorBoardEntry[];
}

export interface EpochLoreContributionInfo extends EpochLoreContributionRecord {
  readonly eventId: string;
  readonly trustClass: EpochTrustClass;
  readonly identityName?: string;
  readonly publicPages: {
    readonly agent: string;
    readonly explorer?: string;
    readonly audit: string;
  };
}

export interface EpochLoreContributionsInfo {
  readonly agentId?: string;
  readonly category?: EpochLoreContributionRecord["category"];
  readonly targetId?: string;
  readonly total: number;
  readonly contributions: readonly EpochLoreContributionInfo[];
  readonly publicPages: {
    readonly world: string;
  };
}

export type EpochLoreTargetStatus = EpochLoreAdjudicationStatus;
export type EpochLoreTargetStatusSource = "contribution_evidence" | "system_adjudication";
export type EpochDisputeArchiveGateStatus =
  | "eligible"
  | "rejected_missing_bilateral_evidence"
  | "rejected_untestable"
  | "rejected_core_canon_hard_conflict";

export interface EpochDisputeArchiveGate {
  readonly status: EpochDisputeArchiveGateStatus;
  readonly bilateralEvidence: boolean;
  readonly futureTestable: boolean;
  readonly coreCanonHardConflict: boolean;
  readonly reason: string;
}

export type EpochWorldviewGateScope = "mvp_minimum";
export type EpochWorldviewGateDeferredRuleSet = "phase_two";
export type EpochWorldviewGateCheckKey =
  | "layer_label"
  | "secret_tier"
  | "anchor_integrity"
  | "core_vibe"
  | "duplicate_or_conflict"
  | "rumor_floor";
export type EpochWorldviewGateCheckStatus = "passed" | "flagged" | "needs_review";

export interface EpochWorldviewGateCheck {
  readonly key: EpochWorldviewGateCheckKey;
  readonly label: string;
  readonly status: EpochWorldviewGateCheckStatus;
  readonly enforced: true;
  readonly reason: string;
}

export interface EpochWorldviewGate {
  readonly scope: EpochWorldviewGateScope;
  readonly deferredRuleSet: EpochWorldviewGateDeferredRuleSet;
  readonly enforcedCheckKeys: readonly EpochWorldviewGateCheckKey[];
  readonly checks: readonly EpochWorldviewGateCheck[];
  readonly summary: string;
}

export interface EpochLoreTargetStatusCounts {
  readonly confirmation: number;
  readonly refutation: number;
  readonly revision: number;
  readonly total: number;
}

export interface EpochLoreTargetLineageDisplay {
  readonly originAgentId: string;
  readonly originExplorerId?: string;
  readonly originIdentityName?: string;
  readonly currentStatus: EpochLoreTargetStatus;
  readonly foldedContributionCounts: EpochLoreTargetStatusCounts;
  readonly foldedContributionCount: number;
  readonly expandedTool: "obsidian_epoch.lore_contributions";
}

export interface EpochLoreTargetAdjudicationInfo extends EpochLoreTargetAdjudication {
  readonly eventId: string;
  readonly trustClass: EpochTrustClass;
  readonly publicPages: {
    readonly audit: string;
  };
}

export interface EpochLoreTargetStatusInfo {
  readonly targetId: string;
  readonly status: EpochLoreTargetStatus;
  readonly statusSource: EpochLoreTargetStatusSource;
  readonly counts: EpochLoreTargetStatusCounts;
  readonly contributingAgentIds: readonly string[];
  readonly contributingExplorerIds: readonly string[];
  readonly sourceEventIds: readonly string[];
  readonly latestContribution: EpochLoreContributionInfo;
  readonly latestAdjudication?: EpochLoreTargetAdjudicationInfo;
  readonly disputeArchiveGate?: EpochDisputeArchiveGate;
  readonly worldviewGate: EpochWorldviewGate;
  readonly lineageDisplay: EpochLoreTargetLineageDisplay;
  readonly publicPages: {
    readonly audit: string;
  };
}

export interface EpochLoreTargetsInfo {
  readonly targetId?: string;
  readonly status?: EpochLoreTargetStatus;
  readonly total: number;
  readonly targets: readonly EpochLoreTargetStatusInfo[];
  readonly publicPages: {
    readonly world: string;
  };
}

export interface EpochLoreAdjudicationOverview {
  readonly pending: number;
  readonly adjudicated: number;
  readonly pendingTargets: readonly EpochLoreTargetStatusInfo[];
}

const WORLDVIEW_GATE_ENFORCED_CHECK_KEYS = [
  "layer_label",
  "secret_tier",
  "anchor_integrity",
  "core_vibe",
  "duplicate_or_conflict",
  "rumor_floor",
] as const satisfies readonly EpochWorldviewGateCheckKey[];

const WORLDVIEW_GATE_LABELS: Record<EpochWorldviewGateCheckKey, string> = {
  layer_label: "层级标签",
  secret_tier: "秘密等级",
  anchor_integrity: "锚点完整性",
  core_vibe: "气质守门",
  duplicate_or_conflict: "重复/冲突",
  rumor_floor: "传闻最低门槛",
};

const WORLD_HONOR_BOARD_SPECS: readonly {
  readonly category: EpochWorldHonorCategory;
  readonly title: string;
  readonly description: string;
}[] = [
  {
    category: "exploration",
    title: "探索",
    description: "服务器已结算的探索节点与托管历程。",
  },
  {
    category: "confirmation",
    title: "证实",
    description: "由服务器确认链路承认的发现与声明。",
  },
  {
    category: "refutation",
    title: "反证",
    description: "推翻错误传闻、异常叙事或失真战报的记录。",
  },
  {
    category: "revision",
    title: "修订",
    description: "修正旧结论并留下可审计依据的记录。",
  },
  {
    category: "high_risk_survival",
    title: "高危幸存",
    description: "经历高风险服务器结算且未在同一因果链定档。",
  },
  {
    category: "low_risk_stability",
    title: "低风险稳定",
    description: "持续完成低风险行动的稳态记录。",
  },
];

interface EpochWorldHonorAccumulatorEntry {
  readonly agentId: string;
  score: number;
  latestEventId?: string;
  latestEventType?: EpochEventType;
  latestAt?: string;
}

function recordValue(value: unknown): AnyRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value) ? value as AnyRecord : {};
}

export function loreContributionCategoryFromInput(
  input: unknown,
): EpochLoreContributionRecord["category"] | undefined {
  if (typeof input !== "string") return undefined;
  return EPOCH_LORE_CONTRIBUTION_CATEGORIES.includes(input as EpochLoreContributionRecord["category"])
    ? input as EpochLoreContributionRecord["category"]
    : undefined;
}

export function loreTargetStatusFromInput(input: unknown): EpochLoreTargetStatus | undefined {
  if (typeof input === "string" && EPOCH_LORE_ADJUDICATION_STATUSES.includes(input as EpochLoreTargetStatus)) {
    return input as EpochLoreTargetStatus;
  }
  return undefined;
}

export function loreContributionInfoFromEvent(
  projection: EpochProjection,
  event: EpochEvent,
): EpochLoreContributionInfo {
  const payload = event.payload as EpochLoreContributionRecord;
  const identity = projection.identities[payload.agentId];
  const explorerId = payload.explorerId || identity?.explorerId;
  const claimId = payload.claimId || payload.contributionId;
  const claimType = payload.claimType || payload.category;
  const claimText = payload.claimText || payload.summary;
  const claimHash = payload.claimHash || loreClaimHash({
    agentId: payload.agentId,
    category: payload.category,
    contributionId: payload.contributionId,
    explorerId,
    recordedAt: payload.recordedAt,
    revisionMode: payload.revisionMode,
    revisionPolicy: payload.revisionPolicy,
    sourceEventIds: payload.sourceEventIds,
    summary: payload.summary,
    targetId: payload.targetId,
  });
  return {
    ...payload,
    claimId,
    claimType,
    claimText,
    claimHash,
    provenance: loreContributionProvenanceForEvent(projection, event, payload),
    eventId: event.eventId,
    trustClass: normalizeTrustClass(event.trustClass),
    identityName: identity?.identityName,
    publicPages: {
      agent: `/epoch/agent/${encodeURIComponent(payload.agentId)}`,
      explorer: explorerId ? `/epoch/explorer/${encodeURIComponent(explorerId)}` : undefined,
      audit: auditPageForEventId(event.eventId),
    },
  };
}

export function allLoreContributionInfos(projection: EpochProjection): readonly EpochLoreContributionInfo[] {
  return projection.events
    .filter((event) => event.eventType === "lore_contribution_recorded")
    .map((event) => loreContributionInfoFromEvent(projection, event));
}

export function loreTargetAdjudicationInfoFromEvent(
  projection: EpochProjection,
  event: EpochEvent,
): EpochLoreTargetAdjudicationInfo {
  const payload = event.payload as EpochLoreTargetAdjudication;
  return {
    ...payload,
    provenance: loreTargetAdjudicationProvenanceForEvent(projection, event, payload),
    eventId: event.eventId,
    trustClass: normalizeTrustClass(event.trustClass),
    publicPages: {
      audit: auditPageForEventId(event.eventId),
    },
  };
}

export function allLoreTargetAdjudicationInfos(
  projection: EpochProjection,
): readonly EpochLoreTargetAdjudicationInfo[] {
  return projection.events
    .filter((event) => event.eventType === "lore_target_adjudicated")
    .map((event) => loreTargetAdjudicationInfoFromEvent(projection, event));
}

export function loreContributionsView(
  projection: EpochProjection,
  input: {
    readonly agentId?: string;
    readonly category?: EpochLoreContributionRecord["category"];
    readonly targetId?: string;
    readonly limit?: number;
  },
): readonly EpochLoreContributionInfo[] {
  const limit = Math.max(1, Math.min(Number(input.limit || 20), 100));
  return allLoreContributionInfos(projection)
    .filter((contribution) => !input.agentId || contribution.agentId === input.agentId)
    .filter((contribution) => !input.category || contribution.category === input.category)
    .filter((contribution) => !input.targetId || contribution.targetId === input.targetId)
    .slice(-limit)
    .reverse();
}

export function disputeArchiveGateFor(
  contributions: readonly EpochLoreContributionInfo[],
): EpochDisputeArchiveGate | undefined {
  const confirmations = contributions.filter((contribution) => contribution.category === "confirmation");
  const refutations = contributions.filter((contribution) => contribution.category === "refutation");
  if (confirmations.length === 0 || refutations.length === 0) return undefined;
  const bilateralEvidence = confirmations.some((contribution) =>
    contribution.sourceEventIds.length > 0 && contribution.provenance.sourceEventCount > 0)
    && refutations.some((contribution) =>
      contribution.sourceEventIds.length > 0 && contribution.provenance.sourceEventCount > 0);

  const normalizedText = contributions
    .map((contribution) => `${contribution.targetId} ${contribution.summary}`)
    .join(" ")
    .normalize("NFKC")
    .toLowerCase();
  const futureTestable =
    /可被后续探索检验|后续探索可复核|可复核|后续探索|检验|调查|证据|锚点|testable|verify|investigate/.test(normalizedText);
  const coreCanonHardConflict =
    /核心正史硬冲突|正史硬冲突|core[-_\s]?canon|hard\s+canon|inscribed\s+canon/.test(normalizedText);
  const status: EpochDisputeArchiveGateStatus = !bilateralEvidence
    ? "rejected_missing_bilateral_evidence"
    : coreCanonHardConflict
      ? "rejected_core_canon_hard_conflict"
      : !futureTestable
        ? "rejected_untestable"
        : "eligible";
  const reason = status === "eligible"
    ? "双方都有有效证据，冲突可被后续探索检验，且不触发核心正史硬冲突。"
    : status === "rejected_missing_bilateral_evidence"
      ? "双方都必须提供有效证据后才能进入争议档案。"
      : status === "rejected_core_canon_hard_conflict"
        ? "核心正史硬冲突不得进入争议档案。"
        : "争议必须可被后续探索检验。";
  return {
    status,
    bilateralEvidence,
    futureTestable,
    coreCanonHardConflict,
    reason,
  };
}

export function loreTargetStatusForCounts(
  counts: EpochLoreTargetStatusCounts,
  latest: EpochLoreContributionInfo,
  disputeArchiveGate?: EpochDisputeArchiveGate,
): EpochLoreTargetStatus {
  if (counts.confirmation > 0 && counts.refutation > 0 && disputeArchiveGate?.status === "eligible") {
    return "contested";
  }
  if (latest.category === "revision") return "revised";
  if (latest.category === "refutation") return "refuted";
  return "confirmed";
}

export function inferredWorldviewSecretTier(surface: string): EpochWorldviewSecretTier {
  if (/禁触核心|禁忌核心|forbidden\s+core/.test(surface)) return "T4_forbidden_core";
  if (/核心秘密|核心设定|core\s+secret/.test(surface)) return "T3_core_secret";
  if (/秘密|secret/.test(surface)) return "T2_local_secret";
  if (/传闻|rumor|低置信|low[-_\s]?confidence/.test(surface)) return "T1_low_rumor";
  return "T0_public";
}

export function worldviewCoreVibePass(surface: string): boolean {
  return /灰港|腐林|废矿|管城|黑曜|灵质|异常|盐镜|灯塔|档案|码头|矿井|gray[-_\s]?harbor|rot[-_\s]?forest|abandoned[-_\s]?mine|aether|anomaly|archive|lighthouse/.test(surface);
}

export function worldviewGateForLoreTarget(input: {
  readonly targetId: string;
  readonly status: EpochLoreTargetStatus;
  readonly statusSource: EpochLoreTargetStatusSource;
  readonly counts: EpochLoreTargetStatusCounts;
  readonly contributions: readonly EpochLoreContributionInfo[];
  readonly disputeArchiveGate?: EpochDisputeArchiveGate;
}): EpochWorldviewGate {
  const sourceEventIds = uniqueSortedValues(input.contributions.flatMap((contribution) => contribution.sourceEventIds));
  const surface = `${input.targetId} ${input.contributions.map((contribution) => contribution.summary).join(" ")}`
    .normalize("NFKC")
    .toLowerCase();
  const secretTier = inferredWorldviewSecretTier(surface);
  const anchorPass = input.targetId.trim().length > 0 && sourceEventIds.length > 0;
  const coreVibePass = worldviewCoreVibePass(surface);
  const duplicateOrConflict = input.counts.total > 1
    || (input.counts.confirmation > 0 && input.counts.refutation > 0)
    || Boolean(input.disputeArchiveGate);
  const rumorLike = secretTier === "T1_low_rumor" || /传闻|rumor|低置信|low[-_\s]?confidence/.test(surface);
  const rumorFloorPass = !rumorLike || (anchorPass && coreVibePass);
  const checks: readonly EpochWorldviewGateCheck[] = [
    {
      key: "layer_label",
      label: WORLDVIEW_GATE_LABELS.layer_label,
      status: "passed",
      enforced: true,
      reason: `设定层级已标记为 ${input.status}，来源为 ${input.statusSource}。`,
    },
    {
      key: "secret_tier",
      label: WORLDVIEW_GATE_LABELS.secret_tier,
      status: "passed",
      enforced: true,
      reason: `最小秘密等级推断为 ${secretTier}。`,
    },
    {
      key: "anchor_integrity",
      label: WORLDVIEW_GATE_LABELS.anchor_integrity,
      status: anchorPass ? "passed" : "needs_review",
      enforced: true,
      reason: anchorPass
        ? `存在 ${sourceEventIds.length} 个来源事件锚点。`
        : "缺少目标 ID 或来源事件锚点。",
    },
    {
      key: "core_vibe",
      label: WORLDVIEW_GATE_LABELS.core_vibe,
      status: coreVibePass ? "passed" : "needs_review",
      enforced: true,
      reason: coreVibePass ? "文本命中黑曜纪元核心气质锚点。" : "文本未命中核心气质锚点，需要复核。",
    },
    {
      key: "duplicate_or_conflict",
      label: WORLDVIEW_GATE_LABELS.duplicate_or_conflict,
      status: duplicateOrConflict ? "flagged" : "passed",
      enforced: true,
      reason: duplicateOrConflict
        ? "检测到多条贡献、重复修订或正反冲突，已折叠到同一目标。"
        : "未检测到重复贡献或正反冲突。",
    },
    {
      key: "rumor_floor",
      label: WORLDVIEW_GATE_LABELS.rumor_floor,
      status: rumorFloorPass ? "passed" : "needs_review",
      enforced: true,
      reason: rumorFloorPass
        ? "传闻或低置信内容满足最小锚点和气质门槛，或该目标不是传闻层。"
        : "传闻或低置信内容未满足最小锚点和气质门槛。",
    },
  ];
  return {
    scope: "mvp_minimum",
    deferredRuleSet: "phase_two",
    enforcedCheckKeys: WORLDVIEW_GATE_ENFORCED_CHECK_KEYS,
    checks,
    summary: "S040 MVP 世界观守门最小集：只强制层级标签、秘密等级、锚点完整性、气质守门、重复/冲突、传闻最低门槛；其他规则进入二阶段。",
  };
}

export function loreTargetStatusesView(
  projection: EpochProjection,
  input: {
    readonly targetId?: string;
    readonly status?: EpochLoreTargetStatus;
    readonly limit?: number;
  },
): readonly EpochLoreTargetStatusInfo[] {
  const limit = Math.max(1, Math.min(Number(input.limit || 20), 100));
  const latestAdjudications = new Map<string, EpochLoreTargetAdjudicationInfo>();
  for (const adjudication of allLoreTargetAdjudicationInfos(projection)) {
    if (input.targetId && adjudication.targetId !== input.targetId) continue;
    latestAdjudications.set(adjudication.targetId, adjudication);
  }
  const grouped = new Map<string, {
    counts: { confirmation: number; refutation: number; revision: number };
    contributions: EpochLoreContributionInfo[];
  }>();
  for (const contribution of allLoreContributionInfos(projection)) {
    if (input.targetId && contribution.targetId !== input.targetId) continue;
    const current = grouped.get(contribution.targetId) || {
      counts: { confirmation: 0, refutation: 0, revision: 0 },
      contributions: [],
    };
    current.counts[contribution.category] += 1;
    current.contributions.push(contribution);
    grouped.set(contribution.targetId, current);
  }
  return [...grouped.entries()]
    .map(([targetId, group]): EpochLoreTargetStatusInfo => {
      const latestContribution = group.contributions[group.contributions.length - 1];
      const latestAdjudication = latestAdjudications.get(targetId);
      const counts: EpochLoreTargetStatusCounts = {
        confirmation: group.counts.confirmation,
        refutation: group.counts.refutation,
        revision: group.counts.revision,
        total: group.contributions.length,
      };
      const statusSource: EpochLoreTargetStatusSource = latestAdjudication
        ? "system_adjudication"
        : "contribution_evidence";
      const disputeArchiveGate = disputeArchiveGateFor(group.contributions);
      const status = latestAdjudication?.status || loreTargetStatusForCounts(counts, latestContribution, disputeArchiveGate);
      const originContribution = group.contributions[0];
      const worldviewGate = worldviewGateForLoreTarget({
        targetId,
        status,
        statusSource,
        counts,
        contributions: group.contributions,
        disputeArchiveGate,
      });
      return {
        targetId,
        status,
        statusSource,
        counts,
        contributingAgentIds: [...new Set(group.contributions.map((contribution) => contribution.agentId))],
        contributingExplorerIds: uniqueSortedValues(group.contributions.map((contribution) => contribution.explorerId)),
        sourceEventIds: [...new Set(group.contributions.flatMap((contribution) => contribution.sourceEventIds))],
        latestContribution,
        latestAdjudication,
        disputeArchiveGate,
        worldviewGate,
        lineageDisplay: {
          originAgentId: originContribution.agentId,
          ...(originContribution.explorerId ? { originExplorerId: originContribution.explorerId } : {}),
          ...(originContribution.identityName ? { originIdentityName: originContribution.identityName } : {}),
          currentStatus: status,
          foldedContributionCounts: counts,
          foldedContributionCount: counts.total,
          expandedTool: "obsidian_epoch.lore_contributions",
        },
        publicPages: {
          audit: latestAdjudication?.publicPages.audit || latestContribution.publicPages.audit,
        },
      };
    })
    .filter((target) => !input.status || target.status === input.status)
    .sort((left, right) => {
      const rightAt = right.latestAdjudication?.adjudicatedAt || right.latestContribution.recordedAt;
      const leftAt = left.latestAdjudication?.adjudicatedAt || left.latestContribution.recordedAt;
      return rightAt.localeCompare(leftAt)
        || (right.latestAdjudication?.eventId || right.latestContribution.eventId)
          .localeCompare(left.latestAdjudication?.eventId || left.latestContribution.eventId);
    })
    .slice(0, limit);
}

export function loreAdjudicationOverview(projection: EpochProjection, limit: number): EpochLoreAdjudicationOverview {
  const contributionTargetIds = new Set(allLoreContributionInfos(projection).map((contribution) => contribution.targetId));
  const adjudicatedTargetIds = new Set(
    allLoreTargetAdjudicationInfos(projection)
      .filter((adjudication) => contributionTargetIds.has(adjudication.targetId))
      .map((adjudication) => adjudication.targetId),
  );
  const pending = [...contributionTargetIds].filter((targetId) => !adjudicatedTargetIds.has(targetId)).length;
  const targets = loreTargetStatusesView(projection, { limit: 100 });
  const pendingTargets = targets.filter((target) => target.statusSource === "contribution_evidence");
  return {
    pending,
    adjudicated: adjudicatedTargetIds.size,
    pendingTargets: pendingTargets.slice(0, limit),
  };
}

export function buildWorldHonorBoards(projection: EpochProjection, limit: number): readonly EpochWorldHonorBoard[] {
  const entriesByCategory = new Map<EpochWorldHonorCategory, Map<string, EpochWorldHonorAccumulatorEntry>>();
  for (const spec of WORLD_HONOR_BOARD_SPECS) entriesByCategory.set(spec.category, new Map());

  function addEntry(category: EpochWorldHonorCategory, event: EpochEvent) {
    const payload = recordValue(event.payload);
    const agentId = event.agentId || (typeof payload.agentId === "string" ? payload.agentId : "");
    if (!agentId) return;
    const categoryEntries = entriesByCategory.get(category);
    if (!categoryEntries) return;
    const existing = categoryEntries.get(agentId);
    if (!existing) {
      categoryEntries.set(agentId, {
        agentId,
        score: 1,
        latestEventId: event.eventId,
        latestEventType: event.eventType,
        latestAt: event.createdAt,
      });
      return;
    }
    existing.score += 1;
    if (!existing.latestAt || event.createdAt.localeCompare(existing.latestAt) >= 0) {
      existing.latestEventId = event.eventId;
      existing.latestEventType = event.eventType;
      existing.latestAt = event.createdAt;
    }
  }

  function hasSameCausationArchive(event: EpochEvent, agentId: string) {
    return projection.events.some((candidate) =>
      candidate.eventType === "identity_archived"
      && candidate.causationId === event.causationId
      && (candidate.agentId === agentId || candidate.aggregateId === agentId));
  }

  for (const event of projection.events) {
    if (event.eventType === "lore_contribution_recorded") {
      const payload = recordValue(event.payload);
      if (
        payload.category === "confirmation"
        || payload.category === "refutation"
        || payload.category === "revision"
      ) {
        addEntry(payload.category, event);
      }
      continue;
    }
    if (event.eventType !== "turn_resolved" && event.eventType !== "hosted_action_recorded") continue;
    const payload = recordValue(event.payload);
    const agentId = event.agentId || (typeof payload.agentId === "string" ? payload.agentId : "");
    if (!agentId) continue;
    addEntry("exploration", event);
    if (payload.risk === "low") addEntry("low_risk_stability", event);
    if (payload.risk === "high" && !hasSameCausationArchive(event, agentId)) {
      addEntry("high_risk_survival", event);
    }
  }

  return WORLD_HONOR_BOARD_SPECS.map((spec): EpochWorldHonorBoard => {
    const entries = [...(entriesByCategory.get(spec.category)?.values() || [])]
      .map((entry): EpochWorldHonorBoardEntry => {
        const identity = projection.identities[entry.agentId];
        return {
          agentId: entry.agentId,
          explorerId: identity?.explorerId,
          identityName: identity?.identityName,
          score: entry.score,
          latestEventId: entry.latestEventId,
          latestEventType: entry.latestEventType,
          latestAt: entry.latestAt,
          publicPages: {
            agent: `/epoch/agent/${encodeURIComponent(entry.agentId)}`,
            explorer: identity?.explorerId ? `/epoch/explorer/${encodeURIComponent(identity.explorerId)}` : undefined,
          },
        };
      })
      .sort((left, right) =>
        right.score - left.score
        || (right.latestAt || "").localeCompare(left.latestAt || "")
        || left.agentId.localeCompare(right.agentId))
      .slice(0, limit);
    return {
      ...spec,
      entries,
    };
  });
}
