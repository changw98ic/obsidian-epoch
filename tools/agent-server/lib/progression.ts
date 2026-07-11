const DAILY_REPUTATION_CAP = 25;

const FACTION_TRAITS: Record<string, Record<string, string[]>> = {
  "腐林档案会": {
    field_agent: ["腐林追踪 I"],
    operator: ["污染证据链 II"],
    high_clearance: ["禁区撤离许可"],
  },
  "云脑族": {
    field_agent: ["梦频索引 I"],
    operator: ["群梦转译 II"],
    high_clearance: ["云端密议席位"],
  },
  "赛博工业财团": {
    field_agent: ["样本调度 I"],
    operator: ["工业渠道 II"],
    high_clearance: ["财团黑箱通行"],
  },
};

const OPERATION_REQUIREMENTS: Record<string, string> = {
  carry_external_items: "outsider",
  high_risk_mandate: "field_agent",
  create_faction: "operator",
  core_lore_claim: "high_clearance",
};

const RANK_ORDER = ["outsider", "field_agent", "operator", "high_clearance"];

export function rankForReputation(reputation: number) {
  if (reputation >= 60) return { rank: "high_clearance", title: "高密级代理" };
  if (reputation >= 30) return { rank: "operator", title: "阵营执行人" };
  if (reputation >= 10) return { rank: "field_agent", title: "外勤代理" };
  return { rank: "outsider", title: "外围记录员" };
}

export function externalItemLimitForRank(rank: string) {
  if (rank === "high_clearance") return 5;
  if (rank === "operator") return 3;
  if (rank === "field_agent") return 2;
  return 1;
}

function dateKey(now: () => Date) {
  return now().toISOString().slice(0, 10);
}

type UnknownRecord = Record<string, unknown>;

interface FactionProgressionState {
  readonly factionId: string;
  reputation: number;
  rank: string;
  title: string;
  traits: string[];
  informationStage: string;
  externalItemLimit: number;
}

interface ExplorerProgression {
  readonly explorerId: string;
  readonly factions: Record<string, FactionProgressionState>;
  readonly dailyCaps: Record<string, { awarded: number; cap: number }>;
  readonly progressionEvents: UnknownRecord[];
}

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function recordArray(value: unknown): UnknownRecord[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" && value ? value : fallback;
}

function factionIdFromRun(run: UnknownRecord = {}) {
  if (typeof run.factionId === "string" && run.factionId) return run.factionId;
  const factionAnchor = recordArray(run.anchors).find((anchor) => anchor.type === "faction");
  return stringValue(factionAnchor?.id, "腐林档案会");
}

function basePointsForScore(score: number) {
  if (score >= 98) return 24;
  if (score >= 90) return 16;
  if (score >= 80) return 12;
  if (score >= 70) return 8;
  if (score >= 60) return 4;
  return 0;
}

function rankTraits(factionId: string, rank: string) {
  const table = FACTION_TRAITS[factionId] || FACTION_TRAITS["腐林档案会"];
  const traits: string[] = [];
  for (const currentRank of RANK_ORDER) {
    if (RANK_ORDER.indexOf(currentRank) <= RANK_ORDER.indexOf(rank)) {
      traits.push(...(table[currentRank] || []));
    }
  }
  return traits;
}

function emptyProgression(explorerId: string): ExplorerProgression {
  return {
    explorerId,
    factions: {},
    dailyCaps: {},
    progressionEvents: [],
  };
}

export function createProgressionLedger(options: {
  readonly now?: () => Date;
  readonly initialExplorers?: readonly Partial<ExplorerProgression>[];
} = {}) {
  const now = options.now || (() => new Date());
  const explorers = new Map<string, ExplorerProgression>();
  for (const explorer of options.initialExplorers || []) {
    if (explorer?.explorerId) {
      explorers.set(explorer.explorerId, {
        explorerId: explorer.explorerId,
        factions: Object.fromEntries(Object.entries(explorer.factions || {}).map(([key, value]) => [key, {
          ...value,
          traits: [...(value.traits || [])],
        }])),
        dailyCaps: Object.fromEntries(Object.entries(explorer.dailyCaps || {}).map(([key, value]) => [key, { ...value }])),
        progressionEvents: Array.isArray(explorer.progressionEvents) ? [...explorer.progressionEvents] : [],
      });
    }
  }

  function getMutable(explorerId: string) {
    if (!explorers.has(explorerId)) explorers.set(explorerId, emptyProgression(explorerId));
    return explorers.get(explorerId) as ExplorerProgression;
  }

  function getFactionState(explorerId: string, factionId: string) {
    const explorer = getMutable(explorerId);
    const current = explorer.factions[factionId] || {
      factionId,
      reputation: 0,
      rank: "outsider",
      title: "外围记录员",
      traits: [],
      informationStage: "public",
      externalItemLimit: 1,
    };
    explorer.factions[factionId] = current;
    return current;
  }

  function refreshFactionState(factionState: FactionProgressionState) {
    const rank = rankForReputation(factionState.reputation);
    factionState.rank = rank.rank;
    factionState.title = rank.title;
    factionState.traits = rankTraits(factionState.factionId, rank.rank);
    factionState.externalItemLimit = externalItemLimitForRank(rank.rank);
    factionState.informationStage = rank.rank === "high_clearance"
      ? "restricted"
      : rank.rank === "operator"
        ? "contested"
        : rank.rank === "field_agent"
          ? "rumors"
          : "public";
  }

  function getExplorerProgression(explorerId: string) {
    const explorer = getMutable(explorerId);
    return {
      explorerId: explorer.explorerId,
      factions: Object.fromEntries(Object.entries(explorer.factions).map(([key, value]) => [key, { ...value, traits: [...value.traits] }])),
      dailyCaps: Object.fromEntries(Object.entries(explorer.dailyCaps).map(([key, value]) => [key, { ...value }])),
      progressionEvents: explorer.progressionEvents.map((event) => ({ ...event })),
    };
  }

  function applyRunProgression({
    source = {},
    run = {},
    adjudication = {},
    lore = {},
  }: {
    readonly source?: UnknownRecord;
    readonly run?: UnknownRecord;
    readonly adjudication?: UnknownRecord;
    readonly lore?: UnknownRecord;
  }) {
    const explorerId = stringValue(source.explorerId, stringValue(run.explorerId));
    if (!explorerId || adjudication?.worldImpact !== "review_candidate" || Number(adjudication.score || 0) < 60) {
      return { pointsAwarded: 0, reason: "not_public_progression" };
    }

    const factionId = factionIdFromRun(run);
    const acceptedLoreCount = Array.isArray(lore?.accepted) ? lore.accepted.length : 0;
    const requestedPoints = basePointsForScore(Number(adjudication.score || 0)) + Math.min(3, acceptedLoreCount);
    const explorer = getMutable(explorerId);
    const capKey = `${dateKey(now)}|${factionId}`;
    const daily = explorer.dailyCaps[capKey] || { awarded: 0, cap: DAILY_REPUTATION_CAP };
    const remaining = Math.max(0, daily.cap - daily.awarded);
    const pointsAwarded = Math.min(requestedPoints, remaining);

    explorer.dailyCaps[capKey] = { ...daily, awarded: daily.awarded + pointsAwarded };
    if (pointsAwarded <= 0) {
      return { pointsAwarded: 0, reason: "daily_cap_reached", factionId };
    }

    const factionState = getFactionState(explorerId, factionId);
    factionState.reputation += pointsAwarded;
    refreshFactionState(factionState);

    const event = {
      type: "faction_reputation_awarded",
      explorerId,
      factionId,
      runTicket: source.runTicket,
      score: adjudication.score,
      pointsAwarded,
      reputation: factionState.reputation,
      rank: factionState.rank,
    };
    explorer.progressionEvents.push(event);
    return { ...event, traits: [...factionState.traits], dailyCap: explorer.dailyCaps[capKey] };
  }

  function canPerformOperation({ explorerId, factionId, operation }: UnknownRecord) {
    const resolvedExplorerId = stringValue(explorerId, "explorer_local");
    const resolvedFactionId = stringValue(factionId, "腐林档案会");
    const resolvedOperation = stringValue(operation, "high_risk_mandate");
    const factionState = getFactionState(resolvedExplorerId, resolvedFactionId);
    const requiredRank = OPERATION_REQUIREMENTS[resolvedOperation] || "outsider";
    const allowed = RANK_ORDER.indexOf(factionState.rank) >= RANK_ORDER.indexOf(requiredRank);
    return {
      allowed,
      operation: resolvedOperation,
      factionId: resolvedFactionId,
      rank: factionState.rank,
      requiredRank,
      reason: allowed ? "allowed" : "rank_too_low",
    };
  }

  function canCarryExternalItems({ explorerId, factionId, itemCount }: UnknownRecord) {
    const resolvedExplorerId = stringValue(explorerId, "explorer_local");
    const resolvedFactionId = stringValue(factionId, "腐林档案会");
    const resolvedItemCount = Number(itemCount || 0);
    const factionState = getFactionState(resolvedExplorerId, resolvedFactionId);
    const limit = externalItemLimitForRank(factionState.rank);
    return {
      allowed: resolvedItemCount <= limit,
      factionId: resolvedFactionId,
      rank: factionState.rank,
      itemCount: resolvedItemCount,
      limit,
      reason: resolvedItemCount <= limit ? "allowed" : "external_item_limit_exceeded",
    };
  }

  return {
    applyRunProgression,
    canPerformOperation,
    canCarryExternalItems,
    getExplorerProgression,
  };
}
