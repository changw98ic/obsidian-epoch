import { createHash } from "node:crypto";

import type { EpochEvent, ExperimentMainRuleReview } from "./events.ts";
import {
  type EpochEventType,
  type EpochLoreAuthorityReview,
  type EpochLoreContributionCategory,
  type EpochLoreContributionEvidenceProvenance,
  type EpochLoreContributionProvenance,
  type EpochLoreRevisionMode,
  type EpochLoreRevisionPolicy,
  type EpochLoreTargetAdjudicationProvenance,
  type EpochSourceAuthority,
  type EpochTrustClass,
  normalizeTrustClass,
  sourceAuthorityForTrustClass,
} from "./protocol.ts";
import {
  LOW_AUTHORITY_REFUTATION_AUTHORITIES,
  auditPageForEventId,
  loreSourceEventProvenance,
  sourceAuthorityForEvent,
} from "./sourceEventRules.ts";

export interface LoreClaimHashInput {
  readonly agentId: string;
  readonly category: EpochLoreContributionCategory;
  readonly contributionId: string;
  readonly explorerId: string;
  readonly recordedAt: string;
  readonly revisionMode?: EpochLoreRevisionMode;
  readonly revisionPolicy?: EpochLoreRevisionPolicy;
  readonly sourceEventIds: readonly string[];
  readonly summary: string;
  readonly targetId: string;
  readonly experimentId?: string;
  readonly mainRuleReview?: ExperimentMainRuleReview;
}

export interface LoreContributionProvenanceRecord {
  readonly contributionId: string;
  readonly category: EpochLoreContributionCategory;
  readonly agentId: string;
  readonly targetId: string;
  readonly sourceEventIds: readonly string[];
  readonly recordedAt: string;
  readonly revisionMode?: EpochLoreRevisionMode;
  readonly provenance?: EpochLoreContributionProvenance;
}

export interface LoreTargetAdjudicationProvenanceRecord {
  readonly targetId: string;
  readonly sourceContributionEventIds: readonly string[];
  readonly adjudicatedAt: string;
  readonly previousAdjudicationId?: string;
  readonly newAdjudicationId?: string;
  readonly provenance?: EpochLoreTargetAdjudicationProvenance;
}

export interface LoreEventProjection {
  readonly events: readonly EpochEvent[];
}

export function stableLoreEvidenceJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((entry) => stableLoreEvidenceJson(entry)).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableLoreEvidenceJson(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function loreEvidenceHash(value: unknown): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(stableLoreEvidenceJson(value)).digest("hex")}`;
}

export function loreClaimHash(input: LoreClaimHashInput): `sha256:${string}` {
  return loreEvidenceHash({
    agentId: input.agentId,
    category: input.category,
    claimId: input.contributionId,
    explorerId: input.explorerId,
    recordedAt: input.recordedAt,
    revisionMode: input.revisionMode,
    revisionPolicy: input.revisionPolicy,
    sourceEventIds: input.sourceEventIds,
    summary: input.summary,
    targetId: input.targetId,
    experimentId: input.experimentId,
    mainRuleReview: input.mainRuleReview,
  });
}

export function uniqueSortedValues<TValue extends string>(values: readonly (TValue | undefined)[]): readonly TValue[] {
  return [...new Set(values.filter((value): value is TValue => Boolean(value)))].sort();
}

export function createLoreContributionProvenance(
  targetId: string,
  sourceEvents: readonly EpochEvent[],
  recordedAt: string,
): EpochLoreContributionProvenance {
  const sourceEventProvenance = sourceEvents.map((event) => loreSourceEventProvenance(event));
  const sourceEventIds = sourceEventProvenance.map((event) => event.eventId);
  return {
    receiptType: "lore_contribution_provenance",
    targetId,
    sourceEventIds,
    sourceEventCount: sourceEventProvenance.length,
    sourceEventTypes: uniqueSortedValues(sourceEventProvenance.map((event) => event.eventType)) as readonly EpochEventType[],
    sourceAgentIds: uniqueSortedValues(sourceEventProvenance.map((event) => event.agentId)),
    sourceAggregateIds: uniqueSortedValues(sourceEventProvenance.map((event) => event.aggregateId)),
    sourceTrustClasses: uniqueSortedValues(sourceEventProvenance.map((event) => event.trustClass)) as readonly EpochTrustClass[],
    sourceEvents: sourceEventProvenance,
    evidenceHash: loreEvidenceHash({
      recordedAt,
      sourceEvents: sourceEventProvenance,
      targetId,
    }),
    recordedAt,
  };
}

export function loreContributionProvenanceForEvent(
  projection: LoreEventProjection,
  event: EpochEvent,
  payload: LoreContributionProvenanceRecord,
): EpochLoreContributionProvenance {
  const sourceEvents = payload.sourceEventIds
    .map((sourceEventId) => projection.events.find((candidate) => candidate.eventId === sourceEventId))
    .filter((sourceEvent): sourceEvent is EpochEvent => Boolean(sourceEvent));
  const fallbackProvenance: EpochLoreContributionProvenance = {
    ...createLoreContributionProvenance(payload.targetId, sourceEvents, payload.recordedAt),
    sourceEventIds: payload.sourceEventIds,
  };
  const storedProvenance = payload.provenance;
  return {
    ...fallbackProvenance,
    ...storedProvenance,
    contributionEventId: event.eventId,
    sourceEvents: (storedProvenance?.sourceEvents || fallbackProvenance.sourceEvents).map((sourceEvent) => {
      const backingEvent = sourceEvents.find((candidate) => candidate.eventId === sourceEvent.eventId);
      return {
        ...sourceEvent,
        sourceAuthority: sourceEvent.sourceAuthority || (backingEvent
          ? sourceAuthorityForEvent(backingEvent)
          : sourceAuthorityForTrustClass(sourceEvent.trustClass)),
        publicPages: {
          audit: auditPageForEventId(sourceEvent.eventId),
        },
      };
    }),
  };
}

export function createLoreTargetAdjudicationProvenance(
  targetId: string,
  sourceContributionEvents: readonly EpochEvent[],
  adjudicatedAt: string,
  adjudicationIds: {
    readonly previousAdjudicationId?: string;
    readonly newAdjudicationId?: string;
  } = {},
): EpochLoreTargetAdjudicationProvenance {
  const sourceContributions = sourceContributionEvents.map((event) => loreContributionEvidenceProvenance(event));
  const sourceContributionEventIds = sourceContributions.map((contribution) => contribution.eventId);
  return {
    receiptType: "lore_target_adjudication_provenance",
    ...adjudicationIds,
    targetId,
    sourceContributionEventIds,
    sourceContributionEventCount: sourceContributions.length,
    sourceAgentIds: uniqueSortedValues(sourceContributions.map((contribution) => contribution.agentId)),
    sourceTrustClasses: uniqueSortedValues(sourceContributions.map((contribution) => contribution.trustClass)) as readonly EpochTrustClass[],
    sourceContributions,
    evidenceHash: loreEvidenceHash({
      adjudicatedAt,
      sourceContributions,
      targetId,
    }),
    adjudicatedAt,
  };
}

export function loreTargetAdjudicationProvenanceForEvent(
  projection: LoreEventProjection,
  event: EpochEvent,
  payload: LoreTargetAdjudicationProvenanceRecord,
): EpochLoreTargetAdjudicationProvenance {
  const sourceContributionEvents = payload.sourceContributionEventIds
    .map((sourceEventId) => projection.events.find((candidate) => candidate.eventId === sourceEventId))
    .filter((sourceEvent): sourceEvent is EpochEvent =>
      sourceEvent !== undefined && sourceEvent.eventType === "lore_contribution_recorded");
  const fallbackProvenance = createLoreTargetAdjudicationProvenance(
    payload.targetId,
    sourceContributionEvents,
    payload.adjudicatedAt,
    {
      previousAdjudicationId: payload.previousAdjudicationId,
      newAdjudicationId: payload.newAdjudicationId,
    },
  );
  const storedProvenance = payload.provenance;
  return {
    ...fallbackProvenance,
    ...storedProvenance,
    adjudicationEventId: event.eventId,
    sourceContributions: (storedProvenance?.sourceContributions || fallbackProvenance.sourceContributions).map((sourceContribution) => {
      const backingEvent = sourceContributionEvents.find((candidate) => candidate.eventId === sourceContribution.eventId);
      return {
        ...sourceContribution,
        sourceAuthority: sourceContribution.sourceAuthority || (backingEvent
          ? sourceAuthorityForEvent(backingEvent)
          : sourceAuthorityForTrustClass(sourceContribution.trustClass)),
        publicPages: {
          audit: auditPageForEventId(sourceContribution.eventId),
        },
      };
    }),
  };
}

export function loreAuthorityReviewForSourceContributions(
  sourceContributionEvents: readonly EpochEvent[],
): EpochLoreAuthorityReview {
  const sourceRecords = sourceContributionEvents.map((event) => {
    const payload = event.payload as LoreContributionProvenanceRecord;
    return {
      eventId: event.eventId,
      sourceAuthority: sourceAuthorityForEvent(event),
      recordedAt: payload.recordedAt,
    };
  });
  const highAuthoritySourceEventIds = sourceRecords
    .filter((record) => !LOW_AUTHORITY_REFUTATION_AUTHORITIES.has(record.sourceAuthority))
    .map((record) => record.eventId);
  const lowAuthoritySourceEventIds = sourceRecords
    .filter((record) => LOW_AUTHORITY_REFUTATION_AUTHORITIES.has(record.sourceAuthority))
    .map((record) => record.eventId);
  const sourceAuthorities = uniqueSortedValues(sourceRecords.map((record) => record.sourceAuthority)) as readonly EpochSourceAuthority[];
  const recordedAts = uniqueSortedValues(sourceRecords.map((record) => record.recordedAt));
  const evidenceQuality = highAuthoritySourceEventIds.length > 0
    ? lowAuthoritySourceEventIds.length > 0
      ? "mixed"
      : "strong"
    : "weak";
  const canHardRefute = highAuthoritySourceEventIds.length > 0;
  return {
    sourceAuthorities,
    highAuthoritySourceEventIds,
    lowAuthoritySourceEventIds,
    evidenceQuality,
    canHardRefute,
    refutationStatus: canHardRefute ? "hard_refutation_allowed" : "review_required",
    ...(recordedAts[0] ? { oldestSourceRecordedAt: recordedAts[0] } : {}),
    ...(recordedAts[recordedAts.length - 1] ? { latestSourceRecordedAt: recordedAts[recordedAts.length - 1] } : {}),
    reason: canHardRefute
      ? "来源包含 core/official 权威资料，可进入硬反驳裁定。"
      : "来源仅包含 derived/low-confidence 资料，只能触发复核，不能直接驳回用户主张。",
  };
}

function loreContributionEvidenceProvenance(event: EpochEvent): EpochLoreContributionEvidenceProvenance {
  const payload = event.payload as LoreContributionProvenanceRecord;
  return {
    eventId: event.eventId,
    contributionId: payload.contributionId,
    category: payload.category,
    ...(payload.revisionMode ? { revisionMode: payload.revisionMode } : {}),
    agentId: payload.agentId,
    targetId: payload.targetId,
    trustClass: normalizeTrustClass(event.trustClass),
    sourceAuthority: sourceAuthorityForEvent(event),
    recordedAt: payload.recordedAt,
    evidenceHash: payload.provenance?.evidenceHash || loreEvidenceHash({
      recordedAt: payload.recordedAt,
      sourceEventIds: payload.sourceEventIds,
      targetId: payload.targetId,
    }),
    publicPages: {
      audit: auditPageForEventId(event.eventId),
    },
  };
}
