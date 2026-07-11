import {
  getEpochAbuseStatus,
  getEpochAgentBriefing,
  getEpochAgentMemory,
  getEpochPersonalMigrationSummary,
} from "./api";
import type {
  EpochAbuseStatus,
  EpochAgentBriefingView,
  EpochAgentMemoryInfo,
  EpochPersonalMigrationSummary,
} from "../types";

export interface AgentProgressRefreshApi {
  readonly getAgentBriefing: typeof getEpochAgentBriefing;
  readonly getAgentMemory: typeof getEpochAgentMemory;
  readonly getPersonalMigrationSummary: typeof getEpochPersonalMigrationSummary;
  readonly getAbuseStatus: typeof getEpochAbuseStatus;
}

export interface AgentProgressRefreshBundle {
  readonly briefing: EpochAgentBriefingView;
  readonly memory: EpochAgentMemoryInfo;
  readonly personalMigrationSummary: EpochPersonalMigrationSummary;
  readonly abuseStatus: EpochAbuseStatus;
}

export interface AgentProgressRefreshSnapshot {
  readonly currentAgentId: string;
  readonly regionId: string;
}

export interface AgentProgressRefreshInput {
  readonly agentId: string;
  readonly regionId: string;
  readonly explorerId?: string;
  readonly quiet?: boolean;
  readonly nextRequestSeq: () => number;
  readonly currentRequestSeq: () => number;
  readonly getLatestSnapshot: () => AgentProgressRefreshSnapshot;
  readonly clearBriefingSyncedAt: () => void;
  readonly commit: (bundle: AgentProgressRefreshBundle) => void;
  readonly api?: AgentProgressRefreshApi;
}

export type AgentProgressRefreshResult =
  | { readonly status: "skipped" }
  | { readonly status: "stale"; readonly requestSeq: number }
  | { readonly status: "applied"; readonly requestSeq: number };

export const defaultAgentProgressRefreshApi: AgentProgressRefreshApi = {
  getAgentBriefing: getEpochAgentBriefing,
  getAgentMemory: getEpochAgentMemory,
  getPersonalMigrationSummary: getEpochPersonalMigrationSummary,
  getAbuseStatus: getEpochAbuseStatus,
};

export async function refreshAgentProgress(input: AgentProgressRefreshInput): Promise<AgentProgressRefreshResult> {
  if (!input.agentId) return { status: "skipped" };
  const api = input.api || defaultAgentProgressRefreshApi;
  const requestRegionId = input.regionId;
  const requestSeq = input.nextRequestSeq();
  if (!input.quiet) input.clearBriefingSyncedAt();

  const [briefing, memory, personalMigrationSummary, abuseStatus] = await Promise.all([
    api.getAgentBriefing({ agentId: input.agentId, regionId: requestRegionId, limit: 6 }),
    api.getAgentMemory({ agentId: input.agentId, regionId: requestRegionId, limit: 6 }),
    api.getPersonalMigrationSummary({ agentId: input.agentId, explorerId: input.explorerId, limit: 6 }),
    api.getAbuseStatus({ agentId: input.agentId }),
  ]);

  const latest = input.getLatestSnapshot();
  const latestAgentId = latest.currentAgentId || input.agentId;
  if (
    requestSeq !== input.currentRequestSeq()
    || input.agentId !== latestAgentId
    || requestRegionId !== latest.regionId
  ) {
    return { status: "stale", requestSeq };
  }

  input.commit({ briefing, memory, personalMigrationSummary, abuseStatus });
  return { status: "applied", requestSeq };
}
