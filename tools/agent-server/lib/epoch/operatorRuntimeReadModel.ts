import { auditView, type EpochAuditInfo } from "./auditReadModel.ts";
import { type EpochProjection } from "./gameCore.ts";
import { loreAdjudicationOverview } from "./loreReadModel.ts";
import {
  abuseProfilesView,
  moderationView,
  operatorOverviewView,
  type EpochAbuseProfilesView,
  type EpochModerationInfo,
  type EpochOperatorAttestedRunnerConfig,
  type EpochOperatorOverview,
} from "./operatorOverviewReadModel.ts";
import { serverHostedJobsView } from "./serverHostedRuntimeRules.ts";

export type {
  EpochAuditEventSummary,
  EpochAuditInfo,
  EpochAuditRiskAgentProfile,
  EpochAuditRiskProfile,
  EpochAuditRiskReviewSummary,
} from "./auditReadModel.ts";
export type {
  EpochAbuseProfileView,
  EpochAbuseProfilesView,
  EpochAttestedRunnerOverviewItem,
  EpochAttestedRunnersOverview,
  EpochGrowthMetric,
  EpochGrowthMetricKey,
  EpochGrowthQualityGuardrailKey,
  EpochGrowthQualityGuardrailMetric,
  EpochGrowthQualityOverview,
  EpochModerationInfo,
  EpochNpcCandidateReviewOverview,
  EpochOperatorAttestedRunnerConfig,
  EpochOperatorAttestedRunnerTrustClass,
  EpochOperatorHealthInfo,
  EpochOperatorOverview,
  EpochOperatorOverviewSummary,
} from "./operatorOverviewReadModel.ts";

type ReadInput = Record<string, unknown>;

function inputString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function optionalNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function booleanFlag(value: unknown) {
  return value === true || value === "true";
}

function operatorLoreLimit(input: ReadInput) {
  return typeof input.limit === "number" && Number.isFinite(input.limit)
    ? Math.max(1, Math.min(100, Math.floor(input.limit)))
    : 8;
}

export function auditInfoView(projection: EpochProjection, input: ReadInput = {}): EpochAuditInfo {
  return auditView(projection, {
    agentId: inputString(input.agentId),
    eventType: inputString(input.eventType),
    eventId: inputString(input.eventId),
    aggregateId: inputString(input.aggregateId),
    highImpactOnly: booleanFlag(input.highImpactOnly),
    riskOnly: booleanFlag(input.riskOnly),
    limit: Number(input.limit || 50),
  });
}

export function abuseProfilesInfoView(
  projection: EpochProjection,
  input: ReadInput = {},
): EpochAbuseProfilesView {
  return abuseProfilesView(projection, {
    level: inputString(input.level),
    limit: optionalNumber(input.limit),
  });
}

export function moderationInfoView(projection: EpochProjection, input: ReadInput = {}): EpochModerationInfo {
  return moderationView(projection, {
    status: inputString(input.status),
    subjectType: inputString(input.subjectType),
  });
}

export function operatorOverviewInfoView(input: {
  readonly projection: EpochProjection;
  readonly request?: ReadInput;
  readonly checkedAt: Date;
  readonly attestedRunners: readonly EpochOperatorAttestedRunnerConfig[];
}): EpochOperatorOverview {
  const request = input.request || {};
  return operatorOverviewView({
    projection: input.projection,
    request,
    checkedAt: input.checkedAt,
    attestedRunners: input.attestedRunners,
    loreAdjudication: loreAdjudicationOverview(input.projection, operatorLoreLimit(request)),
    serverHostedJobsQueued: serverHostedJobsView(input.projection, { status: "queued" }).length,
  });
}
