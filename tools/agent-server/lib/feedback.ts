type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function recordValue(value: unknown): UnknownRecord {
  return isRecord(value) ? value : {};
}

function recordArray(value: unknown): UnknownRecord[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function numberValue(value: unknown) {
  return Number(value || 0);
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function repairActionsFor(adjudication: UnknownRecord) {
  const actions = [
    "补充至少 3 个可复核事件，每个事件需要 outcome 或 evidence。",
    "把候选设定写成 subject / predicate / object，并附上证据。",
    "补全结局摘要，说明 agent 带回了什么、付出了什么代价。",
  ];
  if (Number(adjudication.score || 0) >= 55) {
    actions.unshift("这是接近及格的战报，优先补一条证据链或一个清楚结局。");
  }
  return actions;
}

export function createRunFeedback({
  adjudication = {},
  lore = {},
  progression = {},
}: {
  readonly adjudication?: UnknownRecord;
  readonly lore?: UnknownRecord;
  readonly progression?: UnknownRecord;
}) {
  const score = Number(adjudication?.score || 0);
  const acceptedLoreCount = Array.isArray(lore?.accepted) ? lore.accepted.length : 0;
  const nearMiss = score >= 55 && score < 60;
  const failurePublication = isRecord(adjudication.failurePublication) ? adjudication.failurePublication : null;

  if (score < 60) {
    const diff = 60 - score;
    const repairCredit = numberValue(recordValue(failurePublication?.reward).repairCredit);
    return {
      tone: "repairable_failure",
      nearMiss,
      summary: nearMiss
        ? `差 ${diff} 分及格；补证或修正结局后可以重新提交。`
        : "本次战报证据不足，先进入修正台，不会让用户卡死。",
      rewards: repairCredit > 0 ? [`失败回流信用 +${repairCredit}`] : [],
      repairActions: repairActionsFor(adjudication),
      ...(failurePublication ? { failurePublication } : {}),
      resubmission: {
        allowed: true,
        mode: "new_run_ticket_required",
      },
    };
  }

  const rewards = [];
  const claimSlots = numberValue(adjudication.claimSlots);
  const progressionPoints = numberValue(progression.pointsAwarded);
  if (claimSlots > 0) rewards.push(`${claimSlots} 个设定槽位`);
  if (acceptedLoreCount > 0) rewards.push(`${acceptedLoreCount} 条设定进入公共审档`);
  if (progressionPoints > 0) rewards.push(`${progression.factionId} +${progressionPoints} 声望`);

  return {
    tone: "success",
    nearMiss: false,
    summary: rewards.length ? "本次探索已经结算奖励。" : "本次探索已归档，但没有产生公共奖励。",
    rewards,
    repairActions: [],
    resubmission: {
      allowed: false,
      mode: "not_needed",
    },
  };
}

export function createRepairTicket({
  runTicket,
  feedback = {},
}: {
  readonly runTicket?: unknown;
  readonly feedback?: UnknownRecord;
}) {
  return {
    status: "repair_open",
    originalRunTicket: runTicket,
    resubmissionMode: "new_run_ticket_required",
    actions: Array.isArray(feedback.repairActions) ? [...feedback.repairActions] : [],
  };
}

export function createFeedbackEvents({
  sourceRewards = [],
  factionResult = null,
}: {
  readonly sourceRewards?: readonly UnknownRecord[];
  readonly factionResult?: UnknownRecord | null;
}) {
  const events: UnknownRecord[] = [];
  for (const reward of sourceRewards) {
    events.push({
      type: "claim_reused",
      recipientExplorerId: reward.rewardedExplorerId,
      fromExplorerId: reward.fromExplorerId,
      claimId: reward.claimId,
      points: reward.points,
      pendingPoints: reward.pendingPoints,
      status: reward.status || "released",
      releaseReason: reward.releaseReason,
      reason: reward.reason,
    });
  }
  const factionStatus = factionResult ? stringValue(factionResult.status) : "";
  if (factionResult && ["trial", "accepted", "merged", "rejected"].includes(factionStatus)) {
    events.push({
      type: "faction_status_changed",
      factionId: factionResult.factionId || factionResult.mergedInto,
      status: factionStatus,
      supporterCount: factionResult.supporterCount || 0,
    });
  }
  return events;
}

export function createDigest({
  date,
  runs = [],
  loreState = { claims: [], conflicts: [] },
  factionState = { factions: [] },
}: {
  readonly date?: unknown;
  readonly runs?: readonly unknown[];
  readonly loreState?: UnknownRecord;
  readonly factionState?: UnknownRecord;
}) {
  const claims = recordArray(loreState.claims);
  const conflicts = recordArray(loreState.conflicts);
  const factions = recordArray(factionState.factions);
  return {
    date,
    runCount: runs.length,
    canonicalClaims: claims.filter((claim) => claim.status === "canonical").length,
    disputedClaims: claims.filter((claim) => claim.status === "disputed").length,
    openConflicts: conflicts.filter((conflict) => conflict.status === "open").length,
    trialFactions: factions.filter((faction) => faction.status === "trial").length,
    acceptedFactions: factions.filter((faction) => faction.status === "accepted").length,
  };
}
