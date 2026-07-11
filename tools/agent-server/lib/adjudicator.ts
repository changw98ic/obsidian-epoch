import { findApiKeyLeaks } from "./safety.ts";

type UnknownRecord = Record<string, unknown>;

const MAX_SERVER_CLAIM_SLOTS = 5;
const FAILURE_PUBLICATION_MODES = ["anonymous_public", "claim_only", "personal_sealed"] as const;
const HIGH_RISK_STRUCTURE_SCORE_CAP = 59;
type FailurePublicationMode = typeof FAILURE_PUBLICATION_MODES[number];

export function claimSlotsForScore(score: number, candidateClaimCount = 0) {
  const claimCount = Number.isFinite(candidateClaimCount) ? Math.max(0, candidateClaimCount) : 0;
  if (score >= 98) return Math.min(MAX_SERVER_CLAIM_SLOTS, claimCount);
  if (score >= 90) return Math.min(4, claimCount);
  if (score >= 80) return Math.min(3, claimCount);
  if (score >= 70) return Math.min(2, claimCount);
  if (score >= 60) return Math.min(1, claimCount);
  return 0;
}

function ratingForScore(score: number) {
  if (score >= 98) return "hang";
  if (score >= 90) return "major";
  if (score >= 80) return "strong";
  if (score >= 70) return "qualified";
  if (score >= 60) return "pass";
  return "repair";
}

function recordArray(value: unknown): UnknownRecord[] {
  return Array.isArray(value) ? value.filter((item): item is UnknownRecord => Boolean(item) && typeof item === "object" && !Array.isArray(item)) : [];
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function numberValue(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function recordValue(value: unknown): UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : {};
}

function hasRecordFields(value: unknown) {
  return Object.keys(recordValue(value)).length > 0;
}

function hasStructuredList(value: unknown) {
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) {
    return value.some((item) => (
      typeof item === "string"
        ? item.trim().length > 0
        : Boolean(item) && typeof item === "object" && Object.keys(item).length > 0
    ));
  }
  return hasRecordFields(value);
}

function failurePublicationMode(run: UnknownRecord): FailurePublicationMode {
  const publication = recordValue(run.failurePublication);
  const requested = stringValue(run.failurePublicationMode)
    || stringValue(publication.selectedMode)
    || stringValue(publication.mode)
    || stringValue(run.failurePublication);
  return FAILURE_PUBLICATION_MODES.includes(requested as FailurePublicationMode)
    ? requested as FailurePublicationMode
    : "personal_sealed";
}

function failurePublicationPolicy(run: UnknownRecord) {
  const selectedMode = failurePublicationMode(run);
  const policyByMode = {
    anonymous_public: {
      publicArchive: true,
      identityDisclosure: "anonymous",
      reportBodyVisibility: "public_redacted",
      claimVisibility: "count_only",
      reward: { repairCredit: 2, reason: "anonymous_public_failure_report" },
    },
    claim_only: {
      publicArchive: true,
      identityDisclosure: "none",
      reportBodyVisibility: "sealed",
      claimVisibility: "candidate_claims_only",
      reward: { repairCredit: 1, reason: "claim_only_failure_evidence" },
    },
    personal_sealed: {
      publicArchive: false,
      identityDisclosure: "none",
      reportBodyVisibility: "sealed",
      claimVisibility: "sealed",
      reward: { repairCredit: 0, reason: "personal_sealed_failure_report" },
    },
  } satisfies Record<FailurePublicationMode, UnknownRecord>;
  return {
    selectedMode,
    allowedModes: [...FAILURE_PUBLICATION_MODES],
    ...policyByMode[selectedMode],
  };
}

function hasEvidenceSignal(event: UnknownRecord) {
  return [
    event.evidence,
    event.evidenceText,
    event.outcome,
    event.claimedOutcome,
    event.visibleText,
  ].some((value) => stringValue(value).trim().length > 0);
}

function hasHighRiskAuthorizationRecord(event: UnknownRecord) {
  return event.authorized === true
    && (
      event.userConfirmed === true
      || stringValue(event.userConfirmationId).trim().length > 0
      || stringValue(event.authorizationId).trim().length > 0
      || hasRecordFields(event.authorizationRecord)
    );
}

function hasPaidHighRiskCost(event: UnknownRecord) {
  if (
    event.costPaid === true
    && stringValue(event.costResourceId).trim().length > 0
    && numberValue(event.costAmount) > 0
  ) {
    return true;
  }

  const costRecords = [
    ...recordArray(event.costs),
    recordValue(event.cost),
    recordValue(event.paidCost),
  ].filter((cost) => Object.keys(cost).length > 0);
  return costRecords.some((cost) => {
    const resourceId = stringValue(cost.resourceId) || stringValue(cost.resource);
    const paid = cost.paid === true || stringValue(cost.status) === "paid" || stringValue(cost.paidAt).trim().length > 0;
    return resourceId.trim().length > 0 && numberValue(cost.amount) > 0 && paid;
  });
}

function highRiskStructureReport(event: UnknownRecord) {
  const missing: string[] = [];
  if (!hasHighRiskAuthorizationRecord(event)) missing.push("authorization_record");
  if (!hasPaidHighRiskCost(event)) missing.push("cost_paid");
  if (!hasStructuredList(event.evidenceChain || event.evidenceRefs || event.evidenceEvents)) {
    missing.push("evidence_chain");
  }
  if (!hasStructuredList(event.limitations || event.limits || event.limitConditions || event.constraints)) {
    missing.push("limitations");
  }
  return {
    eventId: stringValue(event.id) || undefined,
    complete: missing.length === 0,
    missing,
  };
}

export function adjudicateRun(run: UnknownRecord = {}) {
  const leaks = findApiKeyLeaks(run);
  if (leaks.length) {
    return {
      score: 0,
      rating: "rejected",
      claimSlots: 0,
      nextAction: "remove_secret",
      worldImpact: "none",
      trustedClientScore: false,
      rejected: true,
      reasons: ["api_key_detected"],
    };
  }

  const events = recordArray(run.events);
  const anchors = Array.isArray(run.anchors) ? run.anchors : [];
  const candidateClaims = Array.isArray(run.candidateClaims) ? run.candidateClaims : [];
  const endingSummary = stringValue(recordValue(run.ending).summary);
  const unauthorizedHighRisk = events.some((event) => event.risk === "high" && event.authorized !== true);
  const highRiskStructure = events
    .filter((event) => stringValue(event.risk).toLocaleLowerCase("zh-CN") === "high")
    .map((event) => ({ event, report: highRiskStructureReport(event) }));
  const unstructuredHighRiskEvents = new Set(
    highRiskStructure.filter((entry) => !entry.report.complete).map((entry) => entry.event),
  );
  const scorableEvents = events.filter((event) => !unstructuredHighRiskEvents.has(event));
  const evidenceSignals = scorableEvents.filter(hasEvidenceSignal);

  let score = 20;
  if (stringValue(run.mandate).trim().length >= 6) score += 8;
  if (anchors.length) score += 5;
  score += Math.min(24, scorableEvents.length * 6);
  if (endingSummary.trim().length >= 18) score += 7;
  score += Math.min(9, evidenceSignals.length * 3);
  if (!events.length) score -= 15;
  if (unauthorizedHighRisk) score -= 15;
  if (unstructuredHighRiskEvents.size) score = Math.min(score, HIGH_RISK_STRUCTURE_SCORE_CAP);

  score = Math.max(0, Math.min(99, score));
  const claimSlots = claimSlotsForScore(score, candidateClaims.length);
  const isDemo = run.mode === "demo" || run.visibility === "private";
  const failurePublication = score < 60 ? failurePublicationPolicy(run) : null;
  const structuralReasons = highRiskStructure.flatMap((entry) =>
    entry.report.missing.map((missing) => `high_risk_structure_missing:${missing}`));

  return {
    score,
    rating: ratingForScore(score),
    claimSlots,
    nextAction: score < 60 ? "repair" : claimSlots > 0 ? "eligible_for_review" : "archive_only",
    worldImpact: isDemo ? "private_demo" : score >= 60 ? "review_candidate" : "none",
    trustedClientScore: false,
    discardedClientScore: run.clientScore ?? null,
    reasons: [
      ...(score < 60 ? ["insufficient_report_evidence"] : []),
      ...structuralReasons,
    ],
    ...(highRiskStructure.length
      ? { highRiskStructure: highRiskStructure.map((entry) => entry.report) }
      : {}),
    ...(failurePublication ? { failurePublication } : {}),
  };
}
