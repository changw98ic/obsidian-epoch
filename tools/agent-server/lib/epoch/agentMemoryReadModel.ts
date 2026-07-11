import { type EpochNpcCandidate, type EpochProjection } from "./gameCore.ts";
import { npcCandidateSourceEventIds, npcCandidatesView } from "./npcCandidateReadModel.ts";

export type EpochAgentMemoryLayer = "confirmed" | "rumor" | "privateRun";

export interface EpochAgentMemoryItem {
  readonly layer: EpochAgentMemoryLayer;
  readonly candidateId: string;
  readonly agentId: string;
  readonly regionId: string;
  readonly displayName: string;
  readonly title: string;
  readonly summary: string;
  readonly status: EpochNpcCandidate["status"];
  readonly reviewLevel: EpochNpcCandidate["reviewLevel"];
  readonly reviewFlags: readonly EpochNpcCandidate["reviewFlags"][number][];
  readonly submittedAt: string;
  readonly sourceEventIds: readonly string[];
  readonly canonicalNpcId?: string;
  readonly rejectionReason?: string;
  readonly reviewedAt?: string;
  readonly reviewNote?: string;
}

export interface EpochAgentMemoryInfo {
  readonly agentId?: string;
  readonly regionId?: string;
  readonly guidance: {
    readonly confirmed: string;
    readonly rumor: string;
    readonly privateRun: string;
  };
  readonly confirmedMemory: readonly EpochAgentMemoryItem[];
  readonly rumorMemory: readonly EpochAgentMemoryItem[];
  readonly privateRunMemory: readonly EpochAgentMemoryItem[];
}

function agentMemoryItem(
  projection: EpochProjection,
  candidate: EpochNpcCandidate,
  layer: EpochAgentMemoryLayer,
): EpochAgentMemoryItem {
  const sourceEventIds = npcCandidateSourceEventIds(projection, candidate);
  if (layer === "confirmed") {
    return {
      layer,
      candidateId: candidate.candidateId,
      agentId: candidate.agentId,
      regionId: candidate.regionId,
      displayName: candidate.displayName,
      title: `服务器确认 NPC: ${candidate.displayName}`,
      summary: `服务器已确认 ${candidate.displayName} 是 ${candidate.regionId} 的 NPC 身份；仅身份与存在可作为事实引用。`,
      status: candidate.status,
      reviewLevel: candidate.reviewLevel,
      reviewFlags: candidate.reviewFlags,
      submittedAt: candidate.submittedAt,
      sourceEventIds,
      canonicalNpcId: candidate.canonicalNpcId,
      reviewedAt: candidate.reviewedAt,
      reviewNote: candidate.reviewNote,
    };
  }
  if (layer === "rumor") {
    return {
      layer,
      candidateId: candidate.candidateId,
      agentId: candidate.agentId,
      regionId: candidate.regionId,
      displayName: candidate.displayName,
      title: `谨慎引用: ${candidate.displayName}`,
      summary: `${candidate.storyEvidence} 这是服务器标记为 ${candidate.reviewLevel} 的传闻/待审 claim，不可用于结算奖励、身份或权力。`,
      status: candidate.status,
      reviewLevel: candidate.reviewLevel,
      reviewFlags: candidate.reviewFlags,
      submittedAt: candidate.submittedAt,
      sourceEventIds,
      canonicalNpcId: candidate.canonicalNpcId,
      reviewedAt: candidate.reviewedAt,
      reviewNote: candidate.reviewNote,
    };
  }
  return {
    layer,
    candidateId: candidate.candidateId,
    agentId: candidate.agentId,
    regionId: candidate.regionId,
    displayName: candidate.displayName,
    title: `私有经历: ${candidate.displayName}`,
    summary: `${candidate.storyEvidence} 该内容只属于本 agent 的私有经历层，不进入共享世界真相。`,
    status: candidate.status,
    reviewLevel: candidate.reviewLevel,
    reviewFlags: candidate.reviewFlags,
    submittedAt: candidate.submittedAt,
    sourceEventIds,
    rejectionReason: candidate.rejectionReason,
    reviewedAt: candidate.reviewedAt,
    reviewNote: candidate.reviewNote,
  };
}

export function agentMemoryView(
  projection: EpochProjection,
  input: { agentId?: string; regionId?: string; limit?: number } = {},
): EpochAgentMemoryInfo {
  const limit = Math.max(1, Math.min(Number(input.limit || 8), 50));
  const candidates = npcCandidatesView(projection, {
    agentId: input.agentId,
    regionId: input.regionId,
  });
  const confirmedMemory: EpochAgentMemoryItem[] = [];
  const rumorMemory: EpochAgentMemoryItem[] = [];
  const privateRunMemory: EpochAgentMemoryItem[] = [];

  for (const candidate of candidates) {
    const isCanonical = (candidate.status === "promoted" || candidate.status === "merged") && Boolean(candidate.canonicalNpcId);
    const isOperatorReviewed = Boolean(candidate.reviewedAt);
    if (isCanonical) {
      confirmedMemory.push(agentMemoryItem(projection, candidate, "confirmed"));
      if (candidate.reviewLevel !== "clear" && isOperatorReviewed) {
        rumorMemory.push(agentMemoryItem(projection, candidate, "rumor"));
      }
      if (input.agentId && !isOperatorReviewed) {
        privateRunMemory.push(agentMemoryItem(projection, candidate, "privateRun"));
      }
      continue;
    }
    if (input.agentId && (candidate.status === "rejected_flavor" || candidate.status === "moderation_hold")) {
      privateRunMemory.push(agentMemoryItem(projection, candidate, "privateRun"));
    }
  }

  return {
    agentId: input.agentId,
    regionId: input.regionId,
    guidance: {
      confirmed: "可作为服务器确认事实引用。",
      rumor: "只能作为已审风险传闻引用，不可结算奖励/身份/权力。",
      privateRun: "未审档或被拒候选只属于该 agent 的本局/私有记忆，不进入共享世界真相。",
    },
    confirmedMemory: confirmedMemory.slice(0, limit),
    rumorMemory: rumorMemory.slice(0, limit),
    privateRunMemory: privateRunMemory.slice(0, limit),
  };
}
