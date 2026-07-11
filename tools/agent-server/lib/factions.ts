import { createHash } from "node:crypto";

import { assessSharedNameIpSimilarity } from "./ipSimilarity.ts";

const RANK_ORDER = ["outsider", "field_agent", "operator", "high_clearance"];

interface FactionSource {
  readonly explorerId?: unknown;
  readonly runTicket?: unknown;
  readonly score?: unknown;
  readonly rank?: unknown;
}

interface FactionProposal {
  readonly name?: unknown;
  readonly setting?: unknown;
  readonly goal?: unknown;
  readonly conflictBoundary?: unknown;
  readonly evidenceRunTickets?: readonly unknown[];
  readonly originClaimIds?: readonly unknown[];
}

interface NormalizedFactionProposal {
  readonly name: string;
  readonly setting: string;
  readonly goal: string;
  readonly conflictBoundary: string;
  readonly evidenceRunTickets: readonly unknown[];
  readonly originClaimIds: readonly unknown[];
}

interface FactionRecord {
  readonly factionId: string;
  readonly name: string;
  readonly nameKey: string;
  status: string;
  readonly legitimacyScore: unknown;
  readonly setting: string;
  readonly goal: string;
  readonly conflictBoundary: string;
  readonly evidenceRunTickets: unknown[];
  readonly originClaimIds: unknown[];
  readonly sources: FactionSource[];
  readonly supporters: FactionSupporter[];
  readonly references: FactionReference[];
}

interface FactionSupporter {
  readonly explorerId?: unknown;
  readonly runTicket?: unknown;
}

interface FactionReference {
  readonly runTicket?: unknown;
  readonly explorerId?: unknown;
}

interface FactionLedgerState {
  readonly supporterThreshold: number;
  readonly factions: FactionRecord[];
}

function compactText(value: unknown) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function nameKey(name: unknown) {
  return compactText(name).toLocaleLowerCase("zh-CN");
}

function idForName(name: unknown) {
  return `faction_${createHash("sha256").update(nameKey(name)).digest("hex").slice(0, 16)}`;
}

function hasRankAtLeast(rank: string, required: string) {
  return RANK_ORDER.indexOf(rank) >= RANK_ORDER.indexOf(required);
}

function sourceRecord(source: FactionSource): FactionSource {
  return {
    explorerId: source.explorerId,
    runTicket: source.runTicket,
    score: source.score,
    rank: source.rank,
  };
}

function validateProposal(proposal: FactionProposal = {}) {
  const normalized = {
    name: compactText(proposal?.name),
    setting: compactText(proposal?.setting),
    goal: compactText(proposal?.goal),
    conflictBoundary: compactText(proposal?.conflictBoundary),
    evidenceRunTickets: Array.isArray(proposal?.evidenceRunTickets) ? proposal.evidenceRunTickets.filter(Boolean) : [],
    originClaimIds: Array.isArray(proposal?.originClaimIds) ? proposal.originClaimIds.filter(Boolean) : [],
  };
  const complete = normalized.name
    && normalized.setting
    && normalized.goal
    && normalized.conflictBoundary
    && normalized.evidenceRunTickets.length
    && normalized.originClaimIds.length;
  return { normalized, complete };
}

function legitimacyScore(source: FactionSource, proposal: NormalizedFactionProposal) {
  let score = 20;
  score += Math.min(35, Math.max(0, Number(source.score || 0) - 60));
  score += Math.min(12, proposal.evidenceRunTickets.length * 6);
  score += Math.min(12, proposal.originClaimIds.length * 6);
  if (proposal.setting.length >= 18) score += 8;
  if (proposal.goal.length >= 18) score += 8;
  if (proposal.conflictBoundary.length >= 18) score += 8;
  return Math.min(100, score);
}

export function createFactionLedger(options: {
  readonly supporterThreshold?: number;
  readonly factions?: readonly Partial<FactionRecord>[];
} = {}) {
  const supporterThreshold = options.supporterThreshold || 3;
  const factions: FactionRecord[] = (options.factions || []).map((faction) => ({
    factionId: faction.factionId || idForName(faction.name || ""),
    name: compactText(faction.name),
    nameKey: faction.nameKey || nameKey(faction.name),
    status: faction.status || "trial",
    legitimacyScore: faction.legitimacyScore || 0,
    setting: compactText(faction.setting),
    goal: compactText(faction.goal),
    conflictBoundary: compactText(faction.conflictBoundary),
    evidenceRunTickets: [...(faction.evidenceRunTickets || [])],
    originClaimIds: [...(faction.originClaimIds || [])],
    sources: [...(faction.sources || [])],
    supporters: [...(faction.supporters || [])],
    references: [...(faction.references || [])],
  }));

  function findByName(name: unknown) {
    const key = nameKey(name);
    return factions.find((faction) => faction.nameKey === key);
  }

  function proposeFaction({ source = {}, proposal = {} }: {
    readonly source?: FactionSource;
    readonly proposal?: FactionProposal;
  }) {
    if (!hasRankAtLeast(String(source?.rank || "outsider"), "operator")) {
      return { status: "rejected", reason: "rank_too_low" };
    }

    const { normalized, complete } = validateProposal(proposal);
    if (!complete) {
      return { status: "rejected", reason: "minimum_evidence_missing" };
    }

    const ipSimilarity = assessSharedNameIpSimilarity({
      surface: "faction",
      fields: {
        name: normalized.name,
        setting: normalized.setting,
        goal: normalized.goal,
        conflictBoundary: normalized.conflictBoundary,
      },
    });
    if (ipSimilarity.status === "suspected") {
      return { status: "moderation_hold", reason: "real_ip_similarity", ipSimilarity };
    }

    const existing = findByName(normalized.name);
    if (existing) {
      existing.sources.push(sourceRecord(source));
      return { status: "merged", mergedInto: existing.factionId, faction: { ...existing } };
    }

    const legitimacy = legitimacyScore(source, normalized);
    if (legitimacy < 70) {
      return { status: "rejected", reason: "legitimacy_too_low", legitimacyScore: legitimacy };
    }

    const faction = {
      factionId: idForName(normalized.name),
      name: normalized.name,
      nameKey: nameKey(normalized.name),
      status: "trial",
      legitimacyScore: legitimacy,
      setting: normalized.setting,
      goal: normalized.goal,
      conflictBoundary: normalized.conflictBoundary,
      evidenceRunTickets: [...normalized.evidenceRunTickets],
      originClaimIds: [...normalized.originClaimIds],
      sources: [sourceRecord(source)],
      supporters: [],
      references: [],
    };
    factions.push(faction);
    return { status: "trial", factionId: faction.factionId, legitimacyScore: legitimacy, supporterThreshold };
  }

  function supportFaction({ factionId, explorerId, runTicket }: {
    readonly factionId?: unknown;
    readonly explorerId?: unknown;
    readonly runTicket?: unknown;
  }) {
    const faction = factions.find((item) => item.factionId === factionId);
    if (!faction) return { status: "rejected", reason: "faction_not_found" };
    if (!faction.supporters.some((supporter) => supporter.explorerId === explorerId)) {
      faction.supporters.push({ explorerId, runTicket });
    }
    if (faction.status === "trial" && faction.supporters.length >= supporterThreshold) {
      faction.status = "accepted";
    }
    return { status: faction.status, factionId, supporterCount: faction.supporters.length };
  }

  function referenceFaction({ name, factionId = null, runTicket, explorerId }: {
    readonly name?: unknown;
    readonly factionId?: unknown;
    readonly runTicket?: unknown;
    readonly explorerId?: unknown;
  }) {
    const faction = factionId
      ? factions.find((item) => item.factionId === factionId)
      : findByName(name);
    if (!faction || faction.status !== "accepted") {
      return { status: "rejected", reason: "accepted_faction_not_found" };
    }
    faction.references.push({ runTicket, explorerId });
    return { status: "referenced", faction };
  }

  function state(): FactionLedgerState {
    return {
      supporterThreshold,
      factions: factions.map((faction) => ({
        ...faction,
        evidenceRunTickets: [...faction.evidenceRunTickets],
        originClaimIds: [...faction.originClaimIds],
        sources: faction.sources.map((source) => ({ ...source })),
        supporters: faction.supporters.map((supporter) => ({ ...supporter })),
        references: faction.references.map((reference) => ({ ...reference })),
      })),
    };
  }

  return {
    proposeFaction,
    supportFaction,
    referenceFaction,
    state,
  };
}
