import { attestedRunnerSecretFingerprint } from "../attestationSigner.ts";
import { auditRiskProfile, auditView, type EpochAuditInfo } from "./auditReadModel.ts";
import type {
  EpochAbuseScoreProfile,
  EpochMarketRiskRestriction,
  EpochModerationItem,
  EpochNpcCandidate,
  EpochProjection,
} from "./gameCore.ts";
import { marketRiskRestrictionsView } from "./marketReadModel.ts";
import {
  maintenanceView,
  type EpochMaintenanceHealthInfo,
  type EpochMaintenanceInfo,
  type EpochOperatorHealthStatus,
} from "./maintenanceReadModel.ts";
import { npcCandidatesView } from "./npcCandidateReadModel.ts";
import type { EpochLoreAdjudicationOverview } from "./loreReadModel.ts";

type AnyRecord = Record<string, unknown>;

export type EpochAbuseLevel = "clear" | "watch" | "restricted";

export interface EpochAbuseProfileView extends EpochAbuseScoreProfile {
  readonly abuseLevel: EpochAbuseLevel;
}

export interface EpochAbuseProfilesView {
  readonly total: number;
  readonly restricted: number;
  readonly watch: number;
  readonly clear: number;
  readonly profiles: readonly EpochAbuseProfileView[];
}

export interface EpochOperatorOverviewSummary {
  readonly openModeration: number;
  readonly restrictedAbuseProfiles: number;
  readonly watchAbuseProfiles: number;
  readonly marketRiskRestrictions: number;
  readonly attestedRunnersConfigured: number;
  readonly attestedRunnerRecentAttestations: number;
  readonly npcCandidateWatch: number;
  readonly npcCandidateBlocked: number;
  readonly serverHostedJobsQueued: number;
  readonly loreTargetsPendingAdjudication: number;
  readonly riskEvents: number;
  readonly recentAbuseReleases: number;
  readonly maintenanceEvents: number;
}

export type EpochGrowthQualityGuardrailKey =
  | "valid_setting_rate"
  | "return_rate"
  | "duplicate_rate"
  | "core_vibe_score"
  | "abuse_rate";

export type EpochGrowthMetricKey =
  | "active_identity_count"
  | "hosted_action_count"
  | "party_run_count"
  | "repeat_participation_rate";

export interface EpochGrowthQualityGuardrailMetric {
  readonly key: EpochGrowthQualityGuardrailKey;
  readonly label: string;
  readonly unit: "ratio" | "score";
  readonly value: number;
  readonly numerator?: number;
  readonly denominator?: number;
  readonly definition: string;
  readonly source: string;
}

export interface EpochGrowthMetric {
  readonly key: EpochGrowthMetricKey;
  readonly label: string;
  readonly unit: "count" | "ratio";
  readonly value: number;
  readonly numerator?: number;
  readonly denominator?: number;
  readonly definition: string;
  readonly source: string;
  readonly qualityGuardrails: readonly EpochGrowthQualityGuardrailKey[];
}

export interface EpochGrowthQualityOverview {
  readonly contract: "growth_metrics_must_ship_with_quality_guardrails";
  readonly requiredGuardrails: readonly EpochGrowthQualityGuardrailMetric[];
  readonly growthMetrics: readonly EpochGrowthMetric[];
}

export interface EpochNpcCandidateReviewOverview {
  readonly watch: number;
  readonly blocked: number;
  readonly moderationHold: number;
  readonly recent: readonly EpochNpcCandidate[];
}

export type EpochOperatorAttestedRunnerTrustClass = "host_attested" | "remote_attested_runner";

export interface EpochOperatorAttestedRunnerConfig {
  readonly runnerId: string;
  readonly label?: string;
  readonly secret: string;
  readonly keyId?: string;
  readonly secretFingerprint?: `sha256:${string}`;
  readonly trustClass?: EpochOperatorAttestedRunnerTrustClass;
  readonly challengeTtlMs?: number;
}

export interface EpochAttestedRunnerOverviewItem {
  readonly runnerId: string;
  readonly label?: string;
  readonly trustClass: EpochOperatorAttestedRunnerTrustClass;
  readonly keyId: string;
  readonly secretFingerprint: `sha256:${string}`;
  readonly challengeTtlMs?: number;
  readonly attestationCount: number;
  readonly latestAttestationId?: string;
  readonly latestVerifiedAt?: string;
}

export interface EpochAttestedRunnersOverview {
  readonly total: number;
  readonly configured: number;
  readonly recentAttestations: number;
  readonly runners: readonly EpochAttestedRunnerOverviewItem[];
}

export interface EpochOperatorHealthInfo {
  readonly checkedAt: string;
  readonly status: EpochOperatorHealthStatus;
  readonly attentionReasons: readonly string[];
  readonly maintenance: EpochMaintenanceHealthInfo;
  readonly queues: {
    readonly openModeration: number;
    readonly restrictedAbuseProfiles: number;
    readonly marketRiskRestrictions: number;
    readonly npcCandidateWatch: number;
    readonly npcCandidateBlocked: number;
    readonly serverHostedJobsQueued: number;
    readonly loreTargetsPendingAdjudication: number;
    readonly riskEvents: number;
  };
}

export interface EpochModerationInfo {
  readonly status?: string;
  readonly subjectType?: string;
  readonly open: readonly EpochModerationItem[];
  readonly resolved: readonly EpochModerationItem[];
  readonly total: number;
}

export interface EpochOperatorOverview {
  readonly summary: EpochOperatorOverviewSummary;
  readonly health: EpochOperatorHealthInfo;
  readonly growthQuality: EpochGrowthQualityOverview;
  readonly moderation: EpochModerationInfo;
  readonly abuse: EpochAbuseProfilesView;
  readonly marketRiskRestrictions: readonly EpochMarketRiskRestriction[];
  readonly attestedRunners: EpochAttestedRunnersOverview;
  readonly npcCandidateReview: EpochNpcCandidateReviewOverview;
  readonly loreAdjudication: EpochLoreAdjudicationOverview;
  readonly maintenance: EpochMaintenanceInfo;
  readonly riskAudit: EpochAuditInfo;
  readonly releaseAudit: EpochAuditInfo;
}

const GROWTH_QUALITY_GUARDRAIL_KEYS: readonly EpochGrowthQualityGuardrailKey[] = [
  "valid_setting_rate",
  "return_rate",
  "duplicate_rate",
  "core_vibe_score",
  "abuse_rate",
];

const GROWTH_PARTICIPATION_EVENT_TYPES = new Set<string>([
  "turn_resolved",
  "hosted_action_recorded",
  "party_run_settled",
  "downtime_claimed",
]);
const ABUSE_RESTRICTED_SCORE = 10;

function recordValue(value: unknown): AnyRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value) ? value as AnyRecord : {};
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function overviewLimit(value: unknown, fallback = 8): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(1, Math.min(100, Math.floor(value)))
    : fallback;
}

function ratioValue(numerator: number, denominator: number) {
  if (denominator <= 0) return 0;
  return Number((Math.max(0, numerator) / denominator).toFixed(4));
}

function scoreValue(value: number) {
  return Number(Math.max(0, Math.min(100, value)).toFixed(2));
}

function eventAgentIdForGrowth(event: EpochProjection["events"][number]) {
  const payload = recordValue(event.payload);
  return event.agentId
    || optionalString(payload.agentId)
    || optionalString(payload.leaderAgentId)
    || optionalString(payload.resolvedByAgentId);
}

function duplicateCount(values: readonly (string | undefined)[]) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    const normalized = value?.trim().toLowerCase();
    if (!normalized) continue;
    if (seen.has(normalized)) duplicates.add(normalized);
    seen.add(normalized);
  }
  return duplicates.size;
}

export function abuseLevelForScore(score: number): EpochAbuseLevel {
  if (score >= ABUSE_RESTRICTED_SCORE) return "restricted";
  if (score > 0) return "watch";
  return "clear";
}

export function abuseProfilesView(
  projection: EpochProjection,
  input: { level?: string; limit?: number } = {},
): EpochAbuseProfilesView {
  const profiles = Object.values(projection.abuseScores)
    .map((profile): EpochAbuseProfileView => ({
      ...profile,
      abuseLevel: abuseLevelForScore(profile.score),
    }))
    .filter((profile) => !input.level || profile.abuseLevel === input.level)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      const timeDelta = new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
      if (timeDelta !== 0) return timeDelta;
      return left.actorKey.localeCompare(right.actorKey);
    });
  return {
    total: profiles.length,
    restricted: profiles.filter((profile) => profile.abuseLevel === "restricted").length,
    watch: profiles.filter((profile) => profile.abuseLevel === "watch").length,
    clear: profiles.filter((profile) => profile.abuseLevel === "clear").length,
    profiles: profiles.slice(0, overviewLimit(input.limit, 20)),
  };
}

export function moderationView(
  projection: EpochProjection,
  input: { status?: string; subjectType?: string } = {},
): EpochModerationInfo {
  const all = Object.values(projection.moderationItems)
    .filter((item) => !input.subjectType || item.subjectType === input.subjectType)
    .sort((left, right) => right.queuedAt.localeCompare(left.queuedAt) || left.moderationId.localeCompare(right.moderationId));
  const open = all.filter((item) => item.status === "open");
  const resolved = all.filter((item) => item.status === "resolved");
  return {
    status: input.status,
    subjectType: input.subjectType,
    open: input.status === "resolved" ? [] : open,
    resolved: input.status === "open" ? [] : resolved,
    total: all.length,
  };
}

export function growthQualityOverview(
  projection: EpochProjection,
  abuseProfiles: EpochAbuseProfilesView,
): EpochGrowthQualityOverview {
  const loreContributionEvents = projection.events.filter((event) => event.eventType === "lore_contribution_recorded");
  const loreAdjudicationEvents = projection.events.filter((event) => event.eventType === "lore_target_adjudicated");
  const rejectedLoreTargetIds = new Set(loreAdjudicationEvents
    .map((event) => recordValue(event.payload))
    .filter((payload) => payload.status === "refuted" || payload.status === "contested")
    .map((payload) => optionalString(payload.targetId))
    .filter((targetId): targetId is string => Boolean(targetId)));
  const npcCandidates = Object.values(projection.npcCandidates);
  const returnedNpcCandidates = npcCandidates.filter((candidate) =>
    candidate.reviewLevel === "blocked"
    || candidate.reviewLevel === "moderation_hold"
    || candidate.status === "rejected_flavor");
  const moderationItems = Object.values(projection.moderationItems);
  const openModeration = moderationItems.filter((item) => item.status === "open").length;
  const settingDenominator = loreContributionEvents.length + npcCandidates.length;
  const invalidSettings = Math.min(settingDenominator, rejectedLoreTargetIds.size + returnedNpcCandidates.length);
  const validSettings = Math.max(0, settingDenominator - invalidSettings);
  const returnDenominator = settingDenominator + moderationItems.length;
  const returnedSettings = Math.min(returnDenominator, invalidSettings + openModeration);
  const settingKeys = [
    ...loreContributionEvents.map((event) => optionalString(recordValue(event.payload).targetId)),
    ...npcCandidates.map((candidate) => `${candidate.regionId}:${candidate.displayName}`),
  ];
  const duplicatedSettings = duplicateCount(settingKeys);
  const activeIdentityCount = Object.keys(projection.identities).length;
  const abuseActors = abuseProfiles.restricted + abuseProfiles.watch;
  const riskProfile = auditRiskProfile(projection.events);
  const validSettingRate = ratioValue(validSettings, settingDenominator);
  const returnRate = ratioValue(returnedSettings, returnDenominator);
  const duplicateRate = ratioValue(duplicatedSettings, Math.max(1, settingKeys.filter(Boolean).length));
  const abuseRate = ratioValue(abuseActors, activeIdentityCount);
  const riskReviewRate = ratioValue(riskProfile.eventCount, projection.events.length);
  const coreVibeScore = scoreValue(100
    - returnRate * 35
    - duplicateRate * 25
    - abuseRate * 30
    - riskReviewRate * 10);
  const participationCounts = new Map<string, number>();
  for (const event of projection.events) {
    if (!GROWTH_PARTICIPATION_EVENT_TYPES.has(event.eventType)) continue;
    const agentId = eventAgentIdForGrowth(event);
    if (!agentId) continue;
    participationCounts.set(agentId, (participationCounts.get(agentId) || 0) + 1);
  }
  const repeatParticipants = [...participationCounts.values()].filter((count) => count >= 2).length;
  const repeatParticipantDenominator = participationCounts.size;
  const guardrails = [...GROWTH_QUALITY_GUARDRAIL_KEYS];
  const growthMetric = (
    metric: Omit<EpochGrowthMetric, "qualityGuardrails">,
  ): EpochGrowthMetric => ({
    ...metric,
    qualityGuardrails: guardrails,
  });

  return {
    contract: "growth_metrics_must_ship_with_quality_guardrails",
    requiredGuardrails: [
      {
        key: "valid_setting_rate",
        label: "有效设定率",
        unit: "ratio",
        value: validSettingRate,
        numerator: validSettings,
        denominator: settingDenominator,
        definition: "服务器设定候选中未被裁为反证/争议且未进入 blocked 或 moderation_hold 的比例。",
        source: "lore_contribution_recorded, lore_target_adjudicated, npc_candidate_submitted projection",
      },
      {
        key: "return_rate",
        label: "退回率",
        unit: "ratio",
        value: returnRate,
        numerator: returnedSettings,
        denominator: returnDenominator,
        definition: "被反证/争议、blocked、moderation_hold 或仍在公开审核队列中的设定候选占比。",
        source: "lore adjudication, npc candidate review and moderation queue projection",
      },
      {
        key: "duplicate_rate",
        label: "重复率",
        unit: "ratio",
        value: duplicateRate,
        numerator: duplicatedSettings,
        denominator: Math.max(1, settingKeys.filter(Boolean).length),
        definition: "相同 lore target 或同地域同名 NPC 候选的重复键占比。",
        source: "lore target ids and npc candidate region/displayName keys",
      },
      {
        key: "core_vibe_score",
        label: "核心气质评分",
        unit: "score",
        value: coreVibeScore,
        definition: "从 100 分扣除退回、重复、滥用和风险审核压力后的运营护栏分。",
        source: "derived from quality guardrails and risk audit projection",
      },
      {
        key: "abuse_rate",
        label: "滥用率",
        unit: "ratio",
        value: abuseRate,
        numerator: abuseActors,
        denominator: activeIdentityCount,
        definition: "watch 或 restricted 滥用档案相对已创建身份的比例。",
        source: "abuse_score_changed projection and identity projection",
      },
    ],
    growthMetrics: [
      growthMetric({
        key: "active_identity_count",
        label: "活跃身份数",
        unit: "count",
        value: activeIdentityCount,
        definition: "服务器投影中已创建的身份总数。",
        source: "identity_issued projection",
      }),
      growthMetric({
        key: "hosted_action_count",
        label: "托管行动数",
        unit: "count",
        value: projection.events.filter((event) => event.eventType === "hosted_action_recorded").length,
        definition: "服务器记录的托管行动结算次数。",
        source: "hosted_action_recorded events",
      }),
      growthMetric({
        key: "party_run_count",
        label: "委托组队数",
        unit: "count",
        value: Object.keys(projection.partyRuns).length,
        definition: "服务器投影中的 party run 总数。",
        source: "party_run_created projection",
      }),
      growthMetric({
        key: "repeat_participation_rate",
        label: "二局率",
        unit: "ratio",
        value: ratioValue(repeatParticipants, repeatParticipantDenominator),
        numerator: repeatParticipants,
        denominator: repeatParticipantDenominator,
        definition: "拥有两次及以上服务器记录参与事件的身份占有参与记录身份的比例。",
        source: "turn_resolved, hosted_action_recorded, party_run_settled and downtime_claimed events",
      }),
    ],
  };
}

export function operatorHealth(
  summary: EpochOperatorOverviewSummary,
  maintenance: EpochMaintenanceHealthInfo,
  checkedAt: Date,
): EpochOperatorHealthInfo {
  const attentionReasons = [...maintenance.attentionReasons];
  if (summary.openModeration > 0) attentionReasons.push("moderation_backlog");
  if (summary.restrictedAbuseProfiles > 0) attentionReasons.push("restricted_abuse_profiles");
  if (summary.marketRiskRestrictions > 0) attentionReasons.push("market_risk_restrictions");
  if (summary.npcCandidateWatch > 0 || summary.npcCandidateBlocked > 0) attentionReasons.push("npc_candidate_lore_risk");
  if (summary.loreTargetsPendingAdjudication > 0) attentionReasons.push("lore_adjudication_pending");
  if (summary.riskEvents > 0) attentionReasons.push("risk_events_pending_review");
  const status: EpochOperatorHealthStatus = maintenance.status === "critical"
    ? "critical"
    : attentionReasons.length > 0
      ? "attention"
      : "ok";
  return {
    checkedAt: checkedAt.toISOString(),
    status,
    attentionReasons,
    maintenance,
    queues: {
      openModeration: summary.openModeration,
      restrictedAbuseProfiles: summary.restrictedAbuseProfiles,
      marketRiskRestrictions: summary.marketRiskRestrictions,
      npcCandidateWatch: summary.npcCandidateWatch,
      npcCandidateBlocked: summary.npcCandidateBlocked,
      serverHostedJobsQueued: summary.serverHostedJobsQueued,
      loreTargetsPendingAdjudication: summary.loreTargetsPendingAdjudication,
      riskEvents: summary.riskEvents,
    },
  };
}

export function npcCandidateReviewOverview(
  projection: EpochProjection,
  limit: number,
): EpochNpcCandidateReviewOverview {
  const riskyCandidates = npcCandidatesView(projection)
    .filter((candidate) => candidate.reviewLevel === "watch"
      || candidate.reviewLevel === "blocked"
      || candidate.reviewLevel === "moderation_hold");
  return {
    watch: riskyCandidates.filter((candidate) => candidate.reviewLevel === "watch").length,
    blocked: riskyCandidates.filter((candidate) => candidate.reviewLevel === "blocked").length,
    moderationHold: riskyCandidates.filter((candidate) => candidate.reviewLevel === "moderation_hold").length,
    recent: riskyCandidates.slice(0, limit),
  };
}

function operatorAttestedRunnerTrustClass(
  runner: EpochOperatorAttestedRunnerConfig,
): EpochOperatorAttestedRunnerTrustClass {
  return runner.trustClass === "host_attested" ? "host_attested" : "remote_attested_runner";
}

function operatorAttestedRunnerKeyId(runner: EpochOperatorAttestedRunnerConfig) {
  return runner.keyId || runner.secretFingerprint || attestedRunnerSecretFingerprint(runner.secret);
}

export function attestedRunnerOverview(
  projection: EpochProjection,
  input: { attestedRunners: readonly EpochOperatorAttestedRunnerConfig[]; limit: number },
): EpochAttestedRunnersOverview {
  const records = Object.values(projection.attestationRecords);
  const recordsByRunner = new Map<string, EpochProjection["attestationRecords"][string][]>();
  for (const record of records) {
    const current = recordsByRunner.get(record.runnerId) || [];
    current.push(record);
    recordsByRunner.set(record.runnerId, current);
  }
  const runners = [...input.attestedRunners]
    .sort((left, right) => left.runnerId.localeCompare(right.runnerId))
    .map((runner): EpochAttestedRunnerOverviewItem => {
      const runnerRecords = (recordsByRunner.get(runner.runnerId) || [])
        .sort((left, right) => right.verifiedAt.localeCompare(left.verifiedAt));
      const latest = runnerRecords[0];
      return {
        runnerId: runner.runnerId,
        label: runner.label,
        trustClass: operatorAttestedRunnerTrustClass(runner),
        keyId: operatorAttestedRunnerKeyId(runner),
        secretFingerprint: runner.secretFingerprint || attestedRunnerSecretFingerprint(runner.secret),
        challengeTtlMs: runner.challengeTtlMs,
        attestationCount: runnerRecords.length,
        latestAttestationId: latest?.attestationId,
        latestVerifiedAt: latest?.verifiedAt,
      };
    });
  return {
    total: runners.length,
    configured: runners.length,
    recentAttestations: records.length,
    runners: runners.slice(0, input.limit),
  };
}

export function operatorOverviewView(input: {
  readonly projection: EpochProjection;
  readonly request?: AnyRecord;
  readonly checkedAt: Date;
  readonly attestedRunners: readonly EpochOperatorAttestedRunnerConfig[];
  readonly loreAdjudication: EpochLoreAdjudicationOverview;
  readonly serverHostedJobsQueued: number;
}): EpochOperatorOverview {
  const limit = overviewLimit(input.request?.limit);
  const projection = input.projection;
  const moderation = moderationView(projection, { status: "open" });
  const abuse = abuseProfilesView(projection, { level: "restricted", limit });
  const allAbuseProfiles = abuseProfilesView(projection, { limit: 100 });
  const allMarketRiskRestrictions = marketRiskRestrictionsView(projection);
  const riskAudit = auditView(projection, {
    riskOnly: true,
    limit,
  });
  const releaseAudit = auditView(projection, {
    eventType: "abuse_score_released",
    limit,
  });
  const npcCandidateReview = npcCandidateReviewOverview(projection, limit);
  const maintenance = maintenanceView(projection, { limit, checkedAt: input.checkedAt });
  const attestedRunnerInfo = attestedRunnerOverview(projection, {
    attestedRunners: input.attestedRunners,
    limit,
  });
  const summary: EpochOperatorOverviewSummary = {
    openModeration: moderation.open.length,
    restrictedAbuseProfiles: allAbuseProfiles.restricted,
    watchAbuseProfiles: allAbuseProfiles.watch,
    marketRiskRestrictions: allMarketRiskRestrictions.length,
    attestedRunnersConfigured: attestedRunnerInfo.configured,
    attestedRunnerRecentAttestations: attestedRunnerInfo.recentAttestations,
    npcCandidateWatch: npcCandidateReview.watch,
    npcCandidateBlocked: npcCandidateReview.blocked,
    serverHostedJobsQueued: input.serverHostedJobsQueued,
    loreTargetsPendingAdjudication: input.loreAdjudication.pending,
    riskEvents: riskAudit.total,
    recentAbuseReleases: releaseAudit.total,
    maintenanceEvents: maintenance.total,
  };
  return {
    summary,
    health: operatorHealth(summary, maintenance.health, input.checkedAt),
    growthQuality: growthQualityOverview(projection, allAbuseProfiles),
    moderation,
    abuse,
    marketRiskRestrictions: allMarketRiskRestrictions.slice(0, limit),
    attestedRunners: attestedRunnerInfo,
    npcCandidateReview,
    loreAdjudication: input.loreAdjudication,
    maintenance,
    riskAudit,
    releaseAudit,
  };
}
