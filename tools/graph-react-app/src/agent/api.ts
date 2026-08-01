import { AGENT_SERVER_BASE } from "./agentTypes";
import type {
  AgentWorldContextPackage,
  AgentPublicWorld,
  EpochAbuseProfilesInfo,
  EpochAbuseScoreRelease,
  EpochAbuseStatus,
  EpochAnomalyEvent,
  EpochAttestationChallengeResponse,
  CreateEpochResultPageResponse,
  EpochAgentBriefingView,
  EpochAgentIdentity,
  EpochAgentMemoryInfo,
  EpochPersonalMigrationSummary,
  EpochAgentNpcBond,
  EpochAuditInfo,
  EpochContestedObjective,
  EpochDirectTrade,
  EpochDirectTradeExpiryTick,
  EpochDirectTradeInfo,
  EpochDiplomacyRecord,
  EpochDowntimeTick,
  EpochDowntimeState,
  EpochHousehold,
  EpochHighValueConfirmationAction,
  EpochHighValueConfirmationConfirmResult,
  EpochHighValueConfirmationListResult,
  EpochHighValueConfirmationRequestResult,
  EpochHighValueConfirmationStatus,
  EpochInstallManifest,
  EpochExplorerProfileInfo,
  EpochCompetitiveLadderMode,
  EpochCompetitiveLadderView,
  EpochPlayerDataExport,
  EpochExplorationRun,
  EpochHostedActionRecord,
  EpochHostedSession,
  EpochHostedSessionWatchInfo,
  EpochIntentActionResult,
  EpochInventoryItem,
  EpochBounty,
  EpochLoreContributionsInfo,
  EpochLoreContributionRecord,
  EpochLoreTargetAdjudicationRecord,
  EpochLoreTargetsInfo,
  EpochLoreTargetStatus,
  EpochMarketExpiryTick,
  EpochMarketOrder,
  EpochMarketRiskRestriction,
  EpochMarketRiskRestrictionRelease,
  EpochMaintenanceRunSummary,
  EpochLegendAward,
  EpochMessageRecord,
  EpochModerationInfo,
  EpochModerationItem,
  EpochModerationResolution,
  EpochModerationSubjectType,
  EpochNpcAssetState,
  EpochNpcCareerRecord,
  EpochNpcHealthState,
  EpochNpcLifecycleTick,
  EpochNpcLocationRecord,
  EpochNpcMemory,
  EpochNpcRelationship,
  EpochOrganization,
  EpochOrganizationBudget,
  EpochOrganizationMembership,
  EpochOrganizationTreasuryContribution,
  EpochOrganizationUpgrade,
  EpochOrganizationPoliticsRecord,
  EpochOrganizationPoliticsTick,
  EpochOperatorOverview,
  EpochPartyRun,
  EpochPersonalityDrift,
  EpochProgressView,
  EpochRaidResult,
  EpochRelationshipEdge,
  EpochRetaliationOpportunity,
  EpochRegionRevoltResult,
  EpochRegionInfo,
  EpochRegionNews,
  EpochResourceNode,
  EpochResultPage,
  EpochRecoveryRotation,
  EpochRiskReview,
  EpochRiskReviewResolution,
  EpochRuntimeResult,
  EpochSeasonCampaign,
  EpochServerHostedActionRun,
  EpochServerHostedJob,
  EpochServerHostedJobRun,
  EpochServerHostedJobsInfo,
  EpochShopOffer,
  EpochSocialHook,
  EpochTurnCard,
  EpochTurnResolution,
  EpochWebBridgeActionResult,
  EpochWebBridgeTurn,
  EpochWorldOverviewInfo,
} from "../types";
import { parseAgentPublicWorld } from "../validation";
import { assertNoKeyMaterialInUserTextPayload } from "./keyIsolation";

export const AGENT_SERVER_NOT_CONNECTED_CODE = "agent_server_not_connected";

export class AgentServerConnectionError extends Error {
  readonly code = AGENT_SERVER_NOT_CONNECTED_CODE;
  readonly path: string;

  constructor(path: string, detail: string, cause?: unknown) {
    super(`未连接 Agent Server（${AGENT_SERVER_BASE}）。${detail}`, { cause });
    this.name = "AgentServerConnectionError";
    this.path = path;
  }
}

function isJsonContentType(contentType: string): boolean {
  return /^application\/(?:[a-z0-9!#$&^_.+-]+\+)?json(?:\s*;|$)/i.test(contentType.trim());
}

function payloadError(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object" || !("error" in payload)) return undefined;
  const error = payload.error;
  return typeof error === "string" && error ? error : undefined;
}

async function fetchAgentServer(path: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(`${AGENT_SERVER_BASE}${path}`, init);
  } catch (error: unknown) {
    throw new AgentServerConnectionError(path, "服务器请求失败，请确认 Agent Server 已启动且当前页面能够访问它。", error);
  }
}

async function readJsonResponse<T>(response: Response, path: string): Promise<T> {
  const contentType = response.headers.get("content-type") || "";
  if (!isJsonContentType(contentType)) {
    const detail = contentType.toLowerCase().includes("text/html")
      ? "服务器返回了网页而不是 JSON；开发页面可能尚未代理到 Agent Server。"
      : `服务器返回了非 JSON 响应（Content-Type: ${contentType || "未提供"}）。`;
    throw new AgentServerConnectionError(path, detail);
  }

  const responseText = await response.text();
  let payload: unknown;
  try {
    payload = JSON.parse(responseText) as unknown;
  } catch (error: unknown) {
    throw new AgentServerConnectionError(path, "服务器返回了无法解析的 JSON 响应。", error);
  }

  if (!response.ok) {
    throw new Error(payloadError(payload) || `request_failed_${response.status}`);
  }
  return payload as T;
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetchAgentServer(path, init);
  return readJsonResponse<T>(response, path);
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  assertNoKeyMaterialInUserTextPayload(body);
  return requestJson<T>(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function startRun(body: unknown) {
  return postJson("/api/runs/start", body);
}

export function heartbeatRun(body: unknown) {
  return postJson("/api/runs/heartbeat", body);
}

export function submitRun(body: unknown) {
  return postJson("/api/runs/submit", body);
}

export function getContextPackage(body: unknown): Promise<AgentWorldContextPackage> {
  return postJson("/api/context/package", body);
}

export function getPublicWorldContext(body: unknown): Promise<AgentWorldContextPackage> {
  return postJson("/api/world/public-context", body);
}

export async function getPublicWorld(): Promise<AgentPublicWorld> {
  const payload = await requestJson<unknown>("/api/world/browser");
  return parseAgentPublicWorld(payload);
}

async function getJson<T>(path: string): Promise<T> {
  return requestJson<T>(path);
}

export interface EpochInstallStatus {
  readonly ok: boolean;
  readonly generatedAt: string;
  readonly serverBase: string;
  readonly truthLevel: "live_lightweight";
  readonly frontstageStatus: {
    readonly mode: "normal" | "read_only_maintenance";
    readonly configurationSource: "built_in_default" | "AGENT_WORLD_FRONTSTAGE_STATUS_JSON";
    readonly circuitBreakerActive: boolean;
    readonly worldAnnouncement: {
      readonly visible: boolean;
      readonly title: string;
      readonly body: string;
    };
    readonly allowedActions: {
      readonly localTrial: true;
      readonly archiveLocalReport: true;
      readonly readPublicWorld: true;
    };
    readonly blockedActions: readonly string[];
  };
  readonly manifest: {
    readonly endpoint: string;
    readonly name: string;
    readonly version: string;
    readonly packageUrl: string;
  };
  readonly package: {
    readonly fileName: string;
    readonly contentType: "application/gzip";
    readonly bytes: number;
    readonly sha256: string;
    readonly url: string;
    readonly signatureAlgorithm: string;
    readonly integrityManifest: string;
    readonly releasePublicKey: string;
    readonly releaseKeyId: string;
    readonly signingTrust: string;
    readonly signingKeySource: string;
  };
  readonly hostInstall: {
    readonly status: "generated";
    readonly hosts: readonly string[];
    readonly hostCount: number;
    readonly mcpHosts: readonly string[];
    readonly mcpHostCount: number;
    readonly bridgeHosts: readonly string[];
    readonly hostConfigFiles: readonly {
      readonly path: string;
      readonly url: string;
      readonly contentType: "application/json";
      readonly bytes: number;
      readonly sha256: string;
    }[];
  };
  readonly smoke: {
    readonly status: "not_run";
    readonly lightweightOnly: boolean;
    readonly installSmokeCommand: string;
    readonly remoteInstallSmokeCommand: string;
    readonly proofRequired: string;
  };
  readonly release: {
    readonly status: "commands_available";
    readonly rehearsalCommand: string;
    readonly productionRehearsalCommand: string;
    readonly recoveryDrillCommand: string;
    readonly backupCommand: string;
    readonly restoreBackupCommand: string;
    readonly signatureAlgorithm: string;
    readonly releaseKeyId: string;
    readonly signingTrust: string;
  };
}

async function getOperatorJson<T>(path: string, operatorKey: string): Promise<T> {
  return requestJson<T>(path, {
    headers: { "x-epoch-operator-key": operatorKey },
  });
}

export function issueEpochIdentity(body: unknown): Promise<EpochRuntimeResult<EpochAgentIdentity>> {
  return postJson("/api/epoch/identity/issue", body);
}

export interface EpochExplorerRegistration {
  readonly explorerId: string;
  readonly agentId: string;
  readonly identityName: string;
  readonly recoveryCode: string;
  readonly duplicate: boolean;
}

export function registerEpochExplorer(body: {
  readonly idempotencyKey: string;
}): Promise<EpochExplorerRegistration> {
  return postJson("/api/epoch/pairing/register", body);
}

export function archiveEpochIdentity(body: unknown): Promise<EpochRuntimeResult<EpochAgentIdentity>> {
  return postJson("/api/epoch/identity/archive", body);
}

export function reincarnateEpochIdentity(body: unknown): Promise<EpochRuntimeResult<EpochAgentIdentity>> {
  return postJson("/api/epoch/identity/reincarnate", body);
}

export function confirmEpochPersonalityDrift(body: unknown): Promise<EpochRuntimeResult<EpochPersonalityDrift>> {
  return postJson("/api/epoch/personality/confirm", body);
}

export function getEpochIdentity(agentId: string): Promise<EpochProgressView> {
  return getJson(`/api/epoch/identity/${encodeURIComponent(agentId)}`);
}

export function getEpochAgentBriefing(input: { agentId?: string; explorerId?: string; regionId?: string; limit?: number } = {}): Promise<EpochAgentBriefingView> {
  const params = new URLSearchParams();
  if (input.agentId) params.set("agentId", input.agentId);
  if (input.explorerId) params.set("explorerId", input.explorerId);
  if (input.regionId) params.set("regionId", input.regionId);
  if (input.limit) params.set("limit", String(input.limit));
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return getJson(`/api/epoch/agent-briefing${suffix}`);
}

export function getEpochAgentMemory(input: { agentId?: string; regionId?: string; limit?: number } = {}): Promise<EpochAgentMemoryInfo> {
  const params = new URLSearchParams();
  if (input.agentId) params.set("agentId", input.agentId);
  if (input.regionId) params.set("regionId", input.regionId);
  if (input.limit) params.set("limit", String(input.limit));
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return getJson(`/api/epoch/agent-memory${suffix}`);
}

export function getEpochPersonalMigrationSummary(
  input: { agentId?: string; explorerId?: string; limit?: number } = {},
): Promise<EpochPersonalMigrationSummary> {
  const params = new URLSearchParams();
  if (input.agentId) params.set("agentId", input.agentId);
  if (input.explorerId) params.set("explorerId", input.explorerId);
  if (input.limit) params.set("limit", String(input.limit));
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return getJson(`/api/epoch/personal-migration-summary${suffix}`);
}

export function getEpochExplorerProfile(explorerId: string): Promise<EpochExplorerProfileInfo> {
  return getJson(`/api/epoch/explorer/${encodeURIComponent(explorerId)}`);
}

export function getEpochCompetitiveLadder(input: {
  mode: EpochCompetitiveLadderMode;
  regionId?: string;
  seasonId?: string;
  tournamentId?: string;
  limit?: number;
}): Promise<EpochCompetitiveLadderView> {
  const params = new URLSearchParams({ mode: input.mode });
  if (input.regionId) params.set("regionId", input.regionId);
  if (input.seasonId) params.set("seasonId", input.seasonId);
  if (input.tournamentId) params.set("tournamentId", input.tournamentId);
  if (input.limit) params.set("limit", String(input.limit));
  return getJson(`/api/epoch/competitive-ladder?${params.toString()}`);
}

export function createEpochPlayerDataExport(body: unknown): Promise<EpochPlayerDataExport> {
  return postJson("/api/epoch/player-data-export", body);
}

export function getEpochWorldOverview(input: { limit?: number } = {}): Promise<EpochWorldOverviewInfo> {
  const params = new URLSearchParams();
  if (input.limit) params.set("limit", String(input.limit));
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return getJson(`/api/epoch/world-overview${suffix}`);
}

export function getEpochAbuseStatus(input: { explorerId?: string; agentId?: string; actorExplorerId?: string } = {}): Promise<EpochAbuseStatus> {
  const params = new URLSearchParams();
  if (input.explorerId) params.set("explorerId", input.explorerId);
  if (input.agentId) params.set("agentId", input.agentId);
  if (input.actorExplorerId) params.set("actorExplorerId", input.actorExplorerId);
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return getJson(`/api/epoch/abuse/status${suffix}`);
}

export function getEpochAbuseProfiles(input: {
  operatorKey: string;
  level?: EpochAbuseStatus["abuseLevel"];
  limit?: number;
}): Promise<EpochAbuseProfilesInfo> {
  const params = new URLSearchParams();
  if (input.level) params.set("level", input.level);
  if (input.limit) params.set("limit", String(input.limit));
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return getOperatorJson(`/api/epoch/abuse/profiles${suffix}`, input.operatorKey);
}

export function getEpochOperatorOverview(input: {
  operatorKey: string;
  limit?: number;
}): Promise<EpochOperatorOverview> {
  const params = new URLSearchParams();
  if (input.limit) params.set("limit", String(input.limit));
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return getOperatorJson(`/api/epoch/operator/overview${suffix}`, input.operatorKey);
}

export function runEpochMaintenance(body: unknown): Promise<EpochRuntimeResult<EpochMaintenanceRunSummary>> {
  return postJson("/api/epoch/maintenance/run", body);
}

export function releaseEpochAbuseRestriction(body: unknown): Promise<EpochRuntimeResult<EpochAbuseScoreRelease>> {
  return postJson("/api/epoch/abuse/release", body);
}

export function setEpochDowntime(body: unknown): Promise<EpochRuntimeResult<EpochDowntimeState>> {
  return postJson("/api/epoch/downtime/set", body);
}

export function claimEpochDowntime(body: unknown): Promise<EpochRuntimeResult<EpochDowntimeState>> {
  return postJson("/api/epoch/downtime/claim", body);
}

export function tickEpochDowntime(body: unknown): Promise<EpochRuntimeResult<EpochDowntimeTick>> {
  return postJson("/api/epoch/downtime/tick", body);
}

export function canonicalizeEpochNpc(body: unknown): Promise<EpochRuntimeResult<unknown>> {
  return postJson("/api/epoch/npc/canonicalize", body);
}

export function submitEpochNpcCandidate(body: unknown): Promise<EpochRuntimeResult<unknown>> {
  return postJson("/api/epoch/npc/candidates/submit", body);
}

export function reviewEpochNpcCandidate(body: unknown): Promise<EpochRuntimeResult<unknown>> {
  return postJson("/api/epoch/npc/candidates/review", body);
}

export function tickEpochNpcLifecycle(body: unknown): Promise<EpochRuntimeResult<EpochNpcLifecycleTick>> {
  return postJson("/api/epoch/npc/lifecycle/tick", body);
}

export function tickEpochOrganizationPolitics(body: unknown): Promise<EpochRuntimeResult<EpochOrganizationPoliticsTick>> {
  return postJson("/api/epoch/organization-politics/tick", body);
}

export function getEpochNpcRelationships(input: { regionId?: string; npcId?: string } = {}): Promise<{ regionId?: string; npcId?: string; relationships: readonly EpochNpcRelationship[] }> {
  const params = new URLSearchParams();
  if (input.regionId) params.set("regionId", input.regionId);
  if (input.npcId) params.set("npcId", input.npcId);
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return getJson(`/api/epoch/npc/relationships${suffix}`);
}

export function getEpochAgentNpcBonds(input: { agentId?: string; npcId?: string; regionId?: string; kind?: string } = {}): Promise<{ agentId?: string; npcId?: string; regionId?: string; bonds: readonly EpochAgentNpcBond[] }> {
  const params = new URLSearchParams();
  if (input.agentId) params.set("agentId", input.agentId);
  if (input.npcId) params.set("npcId", input.npcId);
  if (input.regionId) params.set("regionId", input.regionId);
  if (input.kind) params.set("kind", input.kind);
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return getJson(`/api/epoch/agent-npc-bonds${suffix}`);
}

export function updateEpochAgentNpcBond(body: unknown): Promise<EpochRuntimeResult<EpochAgentNpcBond>> {
  return postJson("/api/epoch/agent-npc-bonds/update", body);
}

export function getEpochNpcMemories(input: { regionId?: string; npcId?: string } = {}): Promise<{ regionId?: string; npcId?: string; memories: readonly EpochNpcMemory[] }> {
  const params = new URLSearchParams();
  if (input.regionId) params.set("regionId", input.regionId);
  if (input.npcId) params.set("npcId", input.npcId);
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return getJson(`/api/epoch/npc/memories${suffix}`);
}

export function getEpochHouseholds(input: { regionId?: string; npcId?: string } = {}): Promise<{ regionId?: string; npcId?: string; households: readonly EpochHousehold[] }> {
  const params = new URLSearchParams();
  if (input.regionId) params.set("regionId", input.regionId);
  if (input.npcId) params.set("npcId", input.npcId);
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return getJson(`/api/epoch/households${suffix}`);
}

export function getEpochOrganizations(input: { regionId?: string; npcId?: string; agentId?: string; organizationId?: string } = {}): Promise<{ regionId?: string; npcId?: string; agentId?: string; organizationId?: string; organizations: readonly EpochOrganization[]; memberships: readonly EpochOrganizationMembership[] }> {
  const params = new URLSearchParams();
  if (input.regionId) params.set("regionId", input.regionId);
  if (input.npcId) params.set("npcId", input.npcId);
  if (input.agentId) params.set("agentId", input.agentId);
  if (input.organizationId) params.set("organizationId", input.organizationId);
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return getJson(`/api/epoch/organizations${suffix}`);
}

export function createEpochOrganization(body: unknown): Promise<EpochRuntimeResult<EpochOrganization>> {
  return postJson("/api/epoch/organizations/create", body);
}

export function updateEpochOrganizationMembership(body: unknown): Promise<EpochRuntimeResult<EpochOrganizationMembership>> {
  return postJson("/api/epoch/organizations/membership", body);
}

export function purchaseEpochOrganizationUpgrade(body: unknown): Promise<EpochRuntimeResult<EpochOrganizationUpgrade>> {
  return postJson("/api/epoch/organizations/upgrades/purchase", body);
}

export function contributeEpochOrganizationTreasury(body: unknown): Promise<EpochRuntimeResult<EpochOrganizationTreasuryContribution>> {
  return postJson("/api/epoch/organizations/treasury/contribute", body);
}

export function proposeEpochOrganizationBudget(body: unknown): Promise<EpochRuntimeResult<EpochOrganizationBudget>> {
  return postJson("/api/epoch/organizations/budgets/propose", body);
}

export function resolveEpochOrganizationBudget(body: unknown): Promise<EpochRuntimeResult<EpochOrganizationBudget>> {
  return postJson("/api/epoch/organizations/budgets/resolve", body);
}

export function getEpochOrganizationPolitics(input: { regionId?: string; npcId?: string; organizationId?: string } = {}): Promise<{ regionId?: string; npcId?: string; organizationId?: string; politics: readonly EpochOrganizationPoliticsRecord[] }> {
  const params = new URLSearchParams();
  if (input.regionId) params.set("regionId", input.regionId);
  if (input.npcId) params.set("npcId", input.npcId);
  if (input.organizationId) params.set("organizationId", input.organizationId);
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return getJson(`/api/epoch/organization-politics${suffix}`);
}

export function getEpochNpcCareers(input: { regionId?: string; npcId?: string } = {}): Promise<{ regionId?: string; npcId?: string; careers: readonly EpochNpcCareerRecord[] }> {
  const params = new URLSearchParams();
  if (input.regionId) params.set("regionId", input.regionId);
  if (input.npcId) params.set("npcId", input.npcId);
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return getJson(`/api/epoch/npc/careers${suffix}`);
}

export function getEpochNpcLocations(input: { regionId?: string; npcId?: string } = {}): Promise<{ regionId?: string; npcId?: string; locations: readonly EpochNpcLocationRecord[] }> {
  const params = new URLSearchParams();
  if (input.regionId) params.set("regionId", input.regionId);
  if (input.npcId) params.set("npcId", input.npcId);
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return getJson(`/api/epoch/npc/locations${suffix}`);
}

export function getEpochNpcAssets(input: { regionId?: string; npcId?: string } = {}): Promise<{ regionId?: string; npcId?: string; assetStates: readonly EpochNpcAssetState[] }> {
  const params = new URLSearchParams();
  if (input.regionId) params.set("regionId", input.regionId);
  if (input.npcId) params.set("npcId", input.npcId);
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return getJson(`/api/epoch/npc/assets${suffix}`);
}

export function getEpochNpcHealth(input: { regionId?: string; npcId?: string } = {}): Promise<{ regionId?: string; npcId?: string; healthStates: readonly EpochNpcHealthState[] }> {
  const params = new URLSearchParams();
  if (input.regionId) params.set("regionId", input.regionId);
  if (input.npcId) params.set("npcId", input.npcId);
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return getJson(`/api/epoch/npc/health${suffix}`);
}

export function getEpochSocialHooks(input: { regionId?: string; npcId?: string } = {}): Promise<{ regionId?: string; npcId?: string; socialHooks: readonly EpochSocialHook[] }> {
  const params = new URLSearchParams();
  if (input.regionId) params.set("regionId", input.regionId);
  if (input.npcId) params.set("npcId", input.npcId);
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return getJson(`/api/epoch/social-hooks${suffix}`);
}

export function getEpochRegionInfo(regionId: string): Promise<EpochRegionInfo> {
  return getJson(`/api/epoch/region/${encodeURIComponent(regionId)}`);
}

export function getEpochMessages(regionId?: string): Promise<{ worldMessages: readonly EpochMessageRecord[]; regionMessages: readonly EpochMessageRecord[] }> {
  const suffix = regionId ? `?regionId=${encodeURIComponent(regionId)}` : "";
  return getJson(`/api/epoch/messages${suffix}`);
}

export function postEpochMessage(body: unknown): Promise<EpochRuntimeResult<EpochMessageRecord>> {
  return postJson("/api/epoch/messages/post", body);
}

export function getEpochModerationQueue(input: {
  operatorKey: string;
  status?: "open" | "resolved";
  subjectType?: EpochModerationSubjectType;
}): Promise<EpochModerationInfo> {
  const params = new URLSearchParams();
  if (input.status) params.set("status", input.status);
  if (input.subjectType) params.set("subjectType", input.subjectType);
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return getOperatorJson(`/api/epoch/moderation${suffix}`, input.operatorKey);
}

export function getEpochAudit(input: {
  agentId?: string;
  eventType?: string;
  eventId?: string;
  aggregateId?: string;
  highImpactOnly?: boolean;
  riskOnly?: boolean;
  limit?: number;
} = {}): Promise<EpochAuditInfo> {
  const params = new URLSearchParams();
  if (input.agentId) params.set("agentId", input.agentId);
  if (input.eventType) params.set("eventType", input.eventType);
  if (input.eventId) params.set("eventId", input.eventId);
  if (input.aggregateId) params.set("aggregateId", input.aggregateId);
  if (input.highImpactOnly) params.set("highImpactOnly", "true");
  if (input.riskOnly) params.set("riskOnly", "true");
  if (input.limit) params.set("limit", String(input.limit));
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return getJson(`/api/epoch/audit${suffix}`);
}

export function resolveEpochModeration(body: {
  operatorKey: string;
  moderationId: string;
  resolution: EpochModerationResolution;
  note?: string;
  idempotencyKey: string;
}): Promise<EpochRuntimeResult<EpochModerationItem>> {
  return postJson("/api/epoch/moderation/resolve", body);
}

export function recordEpochRiskReview(body: {
  operatorKey: string;
  sourceEventId: string;
  resolution: EpochRiskReviewResolution;
  note?: string;
  idempotencyKey: string;
}): Promise<EpochRuntimeResult<EpochRiskReview>> {
  return postJson("/api/epoch/audit/risk-review", body);
}

export function requestEpochConfirmation(body: {
  action: "world_message" | "turn_card" | "resolve_turn";
  agentId: string;
  body?: string;
  regionId?: string;
  prompt?: string;
  turnCardId?: string;
  sequence?: number;
  nonce?: string;
  actionOptionId?: string;
  visibleText?: string;
  summary?: string;
  idempotencyKey: string;
}): Promise<EpochHighValueConfirmationRequestResult> {
  return postJson("/api/epoch/confirmations/request", body);
}

export function confirmEpochAction(body: {
  confirmationId: string;
  explorerId?: string;
  recoveryCode?: string;
  idempotencyKey: string;
}): Promise<EpochHighValueConfirmationConfirmResult> {
  return postJson("/api/epoch/confirmations/confirm", body);
}

export function getEpochConfirmations(body: {
  explorerId: string;
  recoveryCode: string;
  status?: EpochHighValueConfirmationStatus;
  action?: EpochHighValueConfirmationAction;
  agentId?: string;
  limit?: number;
}): Promise<EpochHighValueConfirmationListResult> {
  return postJson("/api/epoch/confirmations/list", body);
}

export function rotateEpochRecovery(body: {
  explorerId: string;
  recoveryCode: string;
  newRecoveryCode: string;
  idempotencyKey: string;
}): Promise<EpochRuntimeResult<EpochRecoveryRotation>> {
  return postJson("/api/epoch/recovery/rotate", body);
}

export function generateEpochRegionNews(body: unknown): Promise<EpochRuntimeResult<EpochRegionNews>> {
  return postJson("/api/epoch/news/generate", body);
}

export function claimEpochNewsLegend(body: unknown): Promise<EpochRuntimeResult<EpochLegendAward>> {
  return postJson("/api/epoch/news/claim-legend", body);
}

export function recordEpochLoreContribution(body: unknown): Promise<EpochRuntimeResult<EpochLoreContributionRecord>> {
  return postJson("/api/epoch/lore/contribution", body);
}

export function adjudicateEpochLoreTarget(body: unknown): Promise<EpochRuntimeResult<EpochLoreTargetAdjudicationRecord>> {
  return postJson("/api/epoch/lore/adjudicate", body);
}

export function getEpochLoreContributions(input: {
  agentId?: string;
  category?: EpochLoreContributionRecord["category"];
  targetId?: string;
  limit?: number;
} = {}): Promise<EpochLoreContributionsInfo> {
  const params = new URLSearchParams();
  if (input.agentId) params.set("agentId", input.agentId);
  if (input.category) params.set("category", input.category);
  if (input.targetId) params.set("targetId", input.targetId);
  if (input.limit) params.set("limit", String(input.limit));
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return getJson(`/api/epoch/lore/contributions${suffix}`);
}

export function getEpochLoreTargets(input: {
  targetId?: string;
  status?: EpochLoreTargetStatus;
  limit?: number;
} = {}): Promise<EpochLoreTargetsInfo> {
  const params = new URLSearchParams();
  if (input.targetId) params.set("targetId", input.targetId);
  if (input.status) params.set("status", input.status);
  if (input.limit) params.set("limit", String(input.limit));
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return getJson(`/api/epoch/lore/targets${suffix}`);
}

export function getEpochObjectives(regionId?: string): Promise<{ regionId?: string; objectives: readonly EpochContestedObjective[] }> {
  const suffix = regionId ? `?regionId=${encodeURIComponent(regionId)}` : "";
  return getJson(`/api/epoch/objectives${suffix}`);
}

export function seedEpochObjective(body: unknown): Promise<EpochRuntimeResult<EpochContestedObjective>> {
  return postJson("/api/epoch/objectives/seed", body);
}

export function contributeEpochObjective(body: unknown): Promise<EpochRuntimeResult<EpochContestedObjective>> {
  return postJson("/api/epoch/objectives/contribute", body);
}

export function settleEpochObjective(body: unknown): Promise<EpochRuntimeResult<EpochContestedObjective>> {
  return postJson("/api/epoch/objectives/settle", body);
}

export function getEpochInventory(input: { agentId?: string; explorerId?: string; bound?: boolean; tradable?: boolean } = {}): Promise<{ agentId?: string; explorerId?: string; bound?: boolean; tradable?: boolean; items: readonly EpochInventoryItem[] }> {
  const params = new URLSearchParams();
  if (input.agentId) params.set("agentId", input.agentId);
  if (input.explorerId) params.set("explorerId", input.explorerId);
  if (input.bound !== undefined) params.set("bound", String(input.bound));
  if (input.tradable !== undefined) params.set("tradable", String(input.tradable));
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return getJson(`/api/epoch/inventory${suffix}`);
}

export function createEpochInventoryItem(body: unknown): Promise<EpochRuntimeResult<EpochInventoryItem>> {
  return postJson("/api/epoch/inventory/create", body);
}

export function craftEpochInventoryItem(body: unknown): Promise<EpochRuntimeResult<EpochInventoryItem>> {
  return postJson("/api/epoch/inventory/craft", body);
}

export function getEpochShop(regionId?: string): Promise<{ regionId?: string; offers: readonly EpochShopOffer[] }> {
  const suffix = regionId ? `?regionId=${encodeURIComponent(regionId)}` : "";
  return getJson(`/api/epoch/shop${suffix}`);
}

export function purchaseEpochShopOffer(body: unknown): Promise<EpochRuntimeResult<EpochInventoryItem>> {
  return postJson("/api/epoch/shop/purchase", body);
}

export function bindEpochInventoryItem(body: unknown): Promise<EpochRuntimeResult<EpochInventoryItem>> {
  return postJson("/api/epoch/inventory/bind", body);
}

export function getEpochResourceNodes(input: { regionId?: string; agentId?: string; status?: string } = {}): Promise<{ regionId?: string; agentId?: string; status?: string; nodes: readonly EpochResourceNode[] }> {
  const params = new URLSearchParams();
  if (input.regionId) params.set("regionId", input.regionId);
  if (input.agentId) params.set("agentId", input.agentId);
  if (input.status) params.set("status", input.status);
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return getJson(`/api/epoch/resource-nodes${suffix}`);
}

export function spawnEpochResourceNode(body: unknown): Promise<EpochRuntimeResult<EpochResourceNode>> {
  return postJson("/api/epoch/resource-nodes/spawn", body);
}

export function contestEpochResourceNode(body: unknown): Promise<EpochRuntimeResult<EpochResourceNode>> {
  return postJson("/api/epoch/resource-nodes/contest", body);
}

export function settleEpochResourceNode(body: unknown): Promise<EpochRuntimeResult<EpochResourceNode>> {
  return postJson("/api/epoch/resource-nodes/settle", body);
}

export function getEpochAnomalies(input: { regionId?: string; agentId?: string; status?: string } = {}): Promise<{ regionId?: string; agentId?: string; status?: string; anomalies: readonly EpochAnomalyEvent[] }> {
  const params = new URLSearchParams();
  if (input.regionId) params.set("regionId", input.regionId);
  if (input.agentId) params.set("agentId", input.agentId);
  if (input.status) params.set("status", input.status);
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return getJson(`/api/epoch/anomalies${suffix}`);
}

export function spawnEpochAnomaly(body: unknown): Promise<EpochRuntimeResult<EpochAnomalyEvent>> {
  return postJson("/api/epoch/anomalies/spawn", body);
}

export function contestEpochAnomaly(body: unknown): Promise<EpochRuntimeResult<EpochAnomalyEvent>> {
  return postJson("/api/epoch/anomalies/contest", body);
}

export function resolveEpochAnomaly(body: unknown): Promise<EpochRuntimeResult<EpochAnomalyEvent>> {
  return postJson("/api/epoch/anomalies/resolve", body);
}

export function getEpochSeasons(input: { regionId?: string; factionId?: string; status?: string } = {}): Promise<{ regionId?: string; factionId?: string; status?: string; seasons: readonly EpochSeasonCampaign[] }> {
  const params = new URLSearchParams();
  if (input.regionId) params.set("regionId", input.regionId);
  if (input.factionId) params.set("factionId", input.factionId);
  if (input.status) params.set("status", input.status);
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return getJson(`/api/epoch/seasons${suffix}`);
}

export function seedEpochSeason(body: unknown): Promise<EpochRuntimeResult<EpochSeasonCampaign>> {
  return postJson("/api/epoch/seasons/seed", body);
}

export function contributeEpochSeason(body: unknown): Promise<EpochRuntimeResult<EpochSeasonCampaign>> {
  return postJson("/api/epoch/seasons/contribute", body);
}

export function settleEpochSeason(body: unknown): Promise<EpochRuntimeResult<EpochSeasonCampaign>> {
  return postJson("/api/epoch/seasons/settle", body);
}

export function getEpochMarket(input: { agentId?: string; regionId?: string } = {}): Promise<{ orders: readonly EpochMarketOrder[]; riskRestrictions: readonly EpochMarketRiskRestriction[] }> {
  const params = new URLSearchParams();
  if (input.agentId) params.set("agentId", input.agentId);
  if (input.regionId) params.set("regionId", input.regionId);
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return getJson(`/api/epoch/market${suffix}`);
}

export function createEpochMarketOrder(body: unknown): Promise<EpochRuntimeResult<EpochMarketOrder>> {
  return postJson("/api/epoch/market/orders", body);
}

export function fillEpochMarketOrder(body: unknown): Promise<EpochRuntimeResult<EpochMarketOrder>> {
  return postJson("/api/epoch/market/fill", body);
}

export function cancelEpochMarketOrder(body: unknown): Promise<EpochRuntimeResult<EpochMarketOrder>> {
  return postJson("/api/epoch/market/cancel", body);
}

export function releaseEpochMarketRiskRestriction(body: unknown): Promise<EpochRuntimeResult<EpochMarketRiskRestrictionRelease>> {
  return postJson("/api/epoch/market/risk-restrictions/release", body);
}

export function tickEpochMarketExpiry(body: unknown): Promise<EpochRuntimeResult<EpochMarketExpiryTick>> {
  return postJson("/api/epoch/market/expiry/tick", body);
}

export function getEpochDirectTrades(input: { agentId?: string; regionId?: string; status?: string } = {}): Promise<EpochDirectTradeInfo> {
  const params = new URLSearchParams();
  if (input.agentId) params.set("agentId", input.agentId);
  if (input.regionId) params.set("regionId", input.regionId);
  if (input.status) params.set("status", input.status);
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return getJson(`/api/epoch/direct-trades${suffix}`);
}

export function createEpochDirectTrade(body: unknown): Promise<EpochRuntimeResult<EpochDirectTrade>> {
  return postJson("/api/epoch/direct-trades/create", body);
}

export function acceptEpochDirectTrade(body: unknown): Promise<EpochRuntimeResult<EpochDirectTrade>> {
  return postJson("/api/epoch/direct-trades/accept", body);
}

export function cancelEpochDirectTrade(body: unknown): Promise<EpochRuntimeResult<EpochDirectTrade>> {
  return postJson("/api/epoch/direct-trades/cancel", body);
}

export function tickEpochDirectTradeExpiry(body: unknown): Promise<EpochRuntimeResult<EpochDirectTradeExpiryTick>> {
  return postJson("/api/epoch/direct-trades/expiry/tick", body);
}

export function getEpochBounties(input: { regionId?: string; agentId?: string; status?: string } = {}): Promise<{ regionId?: string; agentId?: string; status?: string; bounties: readonly EpochBounty[] }> {
  const params = new URLSearchParams();
  if (input.regionId) params.set("regionId", input.regionId);
  if (input.agentId) params.set("agentId", input.agentId);
  if (input.status) params.set("status", input.status);
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return getJson(`/api/epoch/bounties${suffix}`);
}

export function createEpochBounty(body: unknown): Promise<EpochRuntimeResult<EpochBounty>> {
  return postJson("/api/epoch/bounties/create", body);
}

export function claimEpochBounty(body: unknown): Promise<EpochRuntimeResult<EpochBounty>> {
  return postJson("/api/epoch/bounties/claim", body);
}

export function getEpochPartyRuns(input: { regionId?: string; agentId?: string; status?: string } = {}): Promise<{ regionId?: string; agentId?: string; status?: string; partyRuns: readonly EpochPartyRun[] }> {
  const params = new URLSearchParams();
  if (input.regionId) params.set("regionId", input.regionId);
  if (input.agentId) params.set("agentId", input.agentId);
  if (input.status) params.set("status", input.status);
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return getJson(`/api/epoch/party-runs${suffix}`);
}

export function createEpochPartyRun(body: unknown): Promise<EpochRuntimeResult<EpochPartyRun>> {
  return postJson("/api/epoch/party-runs/create", body);
}

export function updateEpochPartyInvite(body: unknown): Promise<EpochRuntimeResult<EpochPartyRun>> {
  return postJson("/api/epoch/party-runs/invite", body);
}

export function joinEpochPartyRun(body: unknown): Promise<EpochRuntimeResult<EpochPartyRun>> {
  return postJson("/api/epoch/party-runs/join", body);
}

export function requestEpochPartyJoin(body: unknown): Promise<EpochRuntimeResult<EpochPartyRun>> {
  return postJson("/api/epoch/party-runs/request-join", body);
}

export function resolveEpochPartyJoinRequest(body: unknown): Promise<EpochRuntimeResult<EpochPartyRun>> {
  return postJson("/api/epoch/party-runs/resolve-join-request", body);
}

export function settleEpochPartyRun(body: unknown): Promise<EpochRuntimeResult<EpochPartyRun>> {
  return postJson("/api/epoch/party-runs/settle", body);
}

export function getEpochRaids(regionId?: string): Promise<{ regionId?: string; raids: readonly EpochRaidResult[] }> {
  const suffix = regionId ? `?regionId=${encodeURIComponent(regionId)}` : "";
  return getJson(`/api/epoch/raids${suffix}`);
}

export function resolveEpochRaid(body: unknown): Promise<EpochRuntimeResult<EpochRaidResult>> {
  return postJson("/api/epoch/raids/resolve", body);
}

export function resolveEpochRegionRevolt(body: unknown): Promise<EpochRuntimeResult<EpochRegionRevoltResult>> {
  return postJson("/api/epoch/region-control/revolt", body);
}

export function resolveEpochRetaliation(body: unknown): Promise<EpochRuntimeResult<EpochRetaliationOpportunity>> {
  return postJson("/api/epoch/retaliations/resolve", body);
}

export function getEpochRelationships(agentId?: string): Promise<{ agentId?: string; relationships: readonly EpochRelationshipEdge[] }> {
  const suffix = agentId ? `?agentId=${encodeURIComponent(agentId)}` : "";
  return getJson(`/api/epoch/relationships${suffix}`);
}

export function getEpochDiplomacy(input: { regionId?: string; agentId?: string; status?: string } = {}): Promise<{ regionId?: string; agentId?: string; status?: string; diplomacy: readonly EpochDiplomacyRecord[] }> {
  const params = new URLSearchParams();
  if (input.regionId) params.set("regionId", input.regionId);
  if (input.agentId) params.set("agentId", input.agentId);
  if (input.status) params.set("status", input.status);
  const suffix = params.toString() ? `?${params}` : "";
  return getJson(`/api/epoch/diplomacy${suffix}`);
}

export function proposeEpochDiplomacy(body: unknown): Promise<EpochRuntimeResult<EpochDiplomacyRecord>> {
  return postJson("/api/epoch/diplomacy/propose", body);
}

export function respondEpochDiplomacy(body: unknown): Promise<EpochRuntimeResult<EpochDiplomacyRecord>> {
  return postJson("/api/epoch/diplomacy/respond", body);
}

export function updateEpochRelationship(body: unknown): Promise<EpochRuntimeResult<EpochRelationshipEdge>> {
  return postJson("/api/epoch/relationships/update", body);
}

export function createEpochTurnCard(body: unknown): Promise<EpochRuntimeResult<EpochTurnCard>> {
  return postJson("/api/epoch/turns/create", body);
}

export function resolveEpochTurn(body: unknown): Promise<EpochRuntimeResult<EpochTurnResolution>> {
  return postJson("/api/epoch/turns/resolve", body);
}

export function resolveEpochTurnIntent(body: unknown): Promise<EpochRuntimeResult<EpochTurnResolution>> {
  return postJson("/api/epoch/turns/resolve-intent", body);
}

export function getEpochHostedSessions(agentId?: string): Promise<{ agentId?: string; sessions: readonly EpochHostedSession[] }> {
  const suffix = agentId ? `?agentId=${encodeURIComponent(agentId)}` : "";
  return getJson(`/api/epoch/hosted/sessions${suffix}`);
}

export function getEpochHostedSessionWatch(sessionId: string): Promise<EpochHostedSessionWatchInfo> {
  return getJson(`/api/epoch/hosted/watch?sessionId=${encodeURIComponent(sessionId)}`);
}

export function startEpochHostedSession(body: unknown): Promise<EpochRuntimeResult<EpochHostedSession>> {
  return postJson("/api/epoch/hosted/start", body);
}

export function submitEpochHostedAction(body: unknown): Promise<EpochRuntimeResult<EpochHostedActionRecord>> {
  return postJson("/api/epoch/hosted/action", body);
}

export function submitEpochHostedIntent(body: unknown): Promise<EpochRuntimeResult<EpochIntentActionResult>> {
  return postJson("/api/epoch/hosted/intent", body);
}

export function commitEpochJourneyIntent(body: unknown): Promise<EpochRuntimeResult<EpochIntentActionResult>> {
  return postJson("/api/epoch/journey/intent", body);
}

export function runEpochServerHostedAction(body: unknown): Promise<EpochRuntimeResult<EpochServerHostedActionRun>> {
  return postJson("/api/epoch/hosted/server-action", body);
}

export function runEpochExploration(body: unknown): Promise<EpochRuntimeResult<EpochExplorationRun>> {
  return postJson("/api/epoch/exploration/run", body);
}

export function queueEpochServerHostedAction(body: unknown): Promise<EpochRuntimeResult<EpochServerHostedJob>> {
  return postJson("/api/epoch/hosted/server-jobs", body);
}

export function getEpochServerHostedJobs(input: { operatorKey: string; agentId?: string; status?: string }): Promise<EpochServerHostedJobsInfo> {
  const params = new URLSearchParams();
  if (input.agentId) params.set("agentId", input.agentId);
  if (input.status) params.set("status", input.status);
  const suffix = params.toString() ? `?${params}` : "";
  return getOperatorJson(`/api/epoch/hosted/server-jobs${suffix}`, input.operatorKey);
}

export function runEpochServerHostedJob(body: unknown): Promise<EpochRuntimeResult<EpochServerHostedJobRun>> {
  return postJson("/api/epoch/hosted/server-jobs/run", body);
}

export function startEpochWebBridgeTurn(body: unknown): Promise<EpochRuntimeResult<EpochWebBridgeTurn>> {
  return postJson("/api/epoch/web-bridge/turn", body);
}

export function submitEpochWebBridgeAction(body: unknown): Promise<EpochRuntimeResult<EpochWebBridgeActionResult>> {
  return postJson("/api/epoch/web-bridge/action", body);
}

export function submitEpochWebBridgeIntent(body: unknown): Promise<EpochRuntimeResult<EpochIntentActionResult>> {
  return postJson("/api/epoch/web-bridge/intent", body);
}

export function createEpochAttestationChallenge(body: unknown): Promise<EpochAttestationChallengeResponse> {
  return postJson("/api/epoch/attestation/challenge", body);
}

export function submitEpochAttestedAction(body: unknown): Promise<EpochRuntimeResult<EpochHostedActionRecord>> {
  return postJson("/api/epoch/attestation/action", body);
}

export function getEpochEvents(agentId: string): Promise<{ events: EpochProgressView["latestEvents"] }> {
  return getJson(`/api/epoch/events?agentId=${encodeURIComponent(agentId)}&limit=20`);
}

export function getEpochResultPage(input: string | {
  readonly agentId?: string;
  readonly explorerId?: string;
  readonly turnCardId?: string;
  readonly hostedSessionId?: string;
  readonly limit?: number;
}): Promise<EpochResultPage> {
  if (typeof input === "string") {
    return getJson(`/api/epoch/result-page?agentId=${encodeURIComponent(input)}&limit=30`);
  }
  const params = new URLSearchParams();
  if (input.agentId) params.set("agentId", input.agentId);
  if (input.explorerId) params.set("explorerId", input.explorerId);
  if (input.turnCardId) params.set("turnCardId", input.turnCardId);
  if (input.hostedSessionId) params.set("hostedSessionId", input.hostedSessionId);
  params.set("limit", String(input.limit ?? 30));
  return getJson(`/api/epoch/result-page?${params}`);
}

export function createEpochResultPage(body: unknown): Promise<CreateEpochResultPageResponse> {
  return postJson("/api/epoch/result-page/create", body);
}

export function revokeEpochResultPage(body: unknown): Promise<CreateEpochResultPageResponse> {
  return postJson("/api/epoch/result-page/revoke", body);
}

export function getEpochInstallManifest(): Promise<EpochInstallManifest> {
  return getJson("/api/epoch/install-manifest");
}

export function getEpochInstallStatus(): Promise<EpochInstallStatus> {
  return getJson("/api/epoch/install-status");
}

export async function downloadEpochPackage(): Promise<Blob> {
  const manifest = await getEpochInstallManifest();
  const packageUrl = new URL(manifest.packageUrl);
  const response = await fetchAgentServer(packageUrl.pathname);
  if (!response.ok) {
    await readJsonResponse<unknown>(response, packageUrl.pathname);
    throw new Error(`request_failed_${response.status}`);
  }
  return response.blob();
}
