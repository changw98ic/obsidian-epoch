import { type EpochLoreTargetStatusInfo } from "./loreReadModel.ts";

export type EpochPersonalMigrationDisposition =
  | "retained"
  | "downgraded"
  | "needs_evidence"
  | "adopted"
  | "sealed";

export interface EpochPersonalMigrationSummaryItem {
  readonly disposition: EpochPersonalMigrationDisposition;
  readonly targetId: string;
  readonly status: EpochLoreTargetStatusInfo["status"];
  readonly summary: string;
  readonly reason: string;
  readonly contributingAgentIds: readonly string[];
  readonly contributingExplorerIds: readonly string[];
  readonly sourceEventIds: readonly string[];
  readonly latestContribution: EpochLoreTargetStatusInfo["latestContribution"];
  readonly latestAdjudication?: EpochLoreTargetStatusInfo["latestAdjudication"];
  readonly canonCandidate?: NonNullable<EpochLoreTargetStatusInfo["latestAdjudication"]>["canonCandidate"];
  readonly publicPages: EpochLoreTargetStatusInfo["publicPages"];
}

export interface EpochPersonalMigrationSummary {
  readonly agentId?: string;
  readonly explorerId?: string;
  readonly totals: Record<EpochPersonalMigrationDisposition, number>;
  readonly retained: readonly EpochPersonalMigrationSummaryItem[];
  readonly downgraded: readonly EpochPersonalMigrationSummaryItem[];
  readonly needsEvidence: readonly EpochPersonalMigrationSummaryItem[];
  readonly adopted: readonly EpochPersonalMigrationSummaryItem[];
  readonly sealed: readonly EpochPersonalMigrationSummaryItem[];
}

function personalMigrationDispositionFor(target: EpochLoreTargetStatusInfo): {
  readonly disposition: EpochPersonalMigrationDisposition;
  readonly reason: string;
} {
  if (target.latestAdjudication?.canonCandidate) {
    return {
      disposition: "adopted",
      reason: "设定已进入正史候选采纳路径。",
    };
  }
  if (target.status === "refuted") {
    return {
      disposition: "sealed",
      reason: "世界版本迁移已封存或反证该设定。",
    };
  }
  const adjudicationSummary = target.latestAdjudication?.summary || "";
  const adjudicationHasDowngradeEvidence = target.latestAdjudication?.provenance.sourceContributions
    .some((contribution) => contribution.revisionMode === "downgrade") || false;
  const contributionHasDowngradeEvidence = target.latestContribution.revisionMode === "downgrade";
  if (
    target.status === "revised"
    && (adjudicationHasDowngradeEvidence || contributionHasDowngradeEvidence || /降级|downgrade|低置信|局部传闻/.test(adjudicationSummary))
  ) {
    return {
      disposition: "downgraded",
      reason: "世界版本迁移保留来源但降低了边界或权威等级。",
    };
  }
  if (target.statusSource !== "system_adjudication" || target.status === "contested") {
    return {
      disposition: "needs_evidence",
      reason: "该设定需要补证或等待系统裁决。",
    };
  }
  return {
    disposition: "retained",
    reason: "世界版本迁移保留该设定。",
  };
}

export function personalMigrationSummaryView(
  targets: readonly EpochLoreTargetStatusInfo[],
  input: { readonly agentId?: string; readonly explorerId?: string; readonly limit?: number } = {},
): EpochPersonalMigrationSummary {
  const limit = Math.max(1, Math.min(Number(input.limit || 8), 50));
  const totals: Record<EpochPersonalMigrationDisposition, number> = {
    retained: 0,
    downgraded: 0,
    needs_evidence: 0,
    adopted: 0,
    sealed: 0,
  };
  const retained: EpochPersonalMigrationSummaryItem[] = [];
  const downgraded: EpochPersonalMigrationSummaryItem[] = [];
  const needsEvidence: EpochPersonalMigrationSummaryItem[] = [];
  const adopted: EpochPersonalMigrationSummaryItem[] = [];
  const sealed: EpochPersonalMigrationSummaryItem[] = [];
  const buckets: Record<EpochPersonalMigrationDisposition, EpochPersonalMigrationSummaryItem[]> = {
    retained,
    downgraded,
    needs_evidence: needsEvidence,
    adopted,
    sealed,
  };

  for (const target of targets) {
    if (input.agentId && !target.contributingAgentIds.includes(input.agentId)) continue;
    if (input.explorerId && !target.contributingExplorerIds.includes(input.explorerId)) continue;
    const classification = personalMigrationDispositionFor(target);
    totals[classification.disposition] += 1;
    const bucket = buckets[classification.disposition];
    if (bucket.length >= limit) continue;
    bucket.push({
      disposition: classification.disposition,
      targetId: target.targetId,
      status: target.status,
      summary: target.latestAdjudication?.summary || target.latestContribution.summary,
      reason: classification.reason,
      contributingAgentIds: target.contributingAgentIds,
      contributingExplorerIds: target.contributingExplorerIds,
      sourceEventIds: target.sourceEventIds,
      latestContribution: target.latestContribution,
      ...(target.latestAdjudication ? { latestAdjudication: target.latestAdjudication } : {}),
      ...(target.latestAdjudication?.canonCandidate ? { canonCandidate: target.latestAdjudication.canonCandidate } : {}),
      publicPages: target.publicPages,
    });
  }

  return {
    ...(input.agentId ? { agentId: input.agentId } : {}),
    ...(input.explorerId ? { explorerId: input.explorerId } : {}),
    totals,
    retained,
    downgraded,
    needsEvidence,
    adopted,
    sealed,
  };
}
