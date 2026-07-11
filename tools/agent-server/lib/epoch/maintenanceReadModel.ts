import type { EpochProjection } from "./gameCore.ts";

type AnyRecord = Record<string, unknown>;

export type EpochMaintenanceEventType =
  | "npc_lifecycle_recorded"
  | "organization_politics_recorded"
  | "organization_prestige_changed"
  | "organization_treasury_changed"
  | "resource_node_spawned"
  | "resource_node_settled"
  | "anomaly_event_spawned"
  | "season_campaign_created"
  | "season_campaign_resolved"
  | "party_run_settled"
  | "region_control_decayed"
  | "region_control_released"
  | "market_order_expired"
  | "direct_trade_expired"
  | "server_hosted_job_completed"
  | "server_hosted_job_skipped"
  | "abuse_score_decayed";

export interface EpochMaintenanceEventSummary {
  readonly eventId: string;
  readonly eventType: EpochMaintenanceEventType;
  readonly aggregateId: string;
  readonly agentId?: string;
  readonly regionId?: string;
  readonly subjectId: string;
  readonly createdAt: string;
  readonly publicPages: {
    readonly audit: string;
  };
}

export interface EpochMaintenanceInfo {
  readonly total: number;
  readonly latestRanAt?: string;
  readonly counts: {
    readonly npcLifecycle: number;
    readonly organizationPolitics: number;
    readonly resourceNodeSpawned: number;
    readonly resourceNodeSettled: number;
    readonly anomalySpawned: number;
    readonly seasonStarted: number;
    readonly seasonSettled: number;
    readonly partyRunsSettled: number;
    readonly regionControlDecayed: number;
    readonly regionControlReleased: number;
    readonly marketExpired: number;
    readonly directTradeExpired: number;
    readonly serverHostedJobsCompleted: number;
    readonly serverHostedJobsSkipped: number;
    readonly abuseDecayed: number;
  };
  readonly health: EpochMaintenanceHealthInfo;
  readonly recentEvents: readonly EpochMaintenanceEventSummary[];
}

export type EpochOperatorHealthStatus = "ok" | "attention" | "critical";
export type EpochMaintenanceWorkerHealthStatus = "ok" | "stale" | "missing";
export type EpochMaintenanceWorkerKey =
  | "npcLifecycle"
  | "organizationPolitics"
  | "marketExpiry"
  | "resourceNodeSpawn"
  | "resourceNodeSettle"
  | "anomalySpawn"
  | "seasonStart"
  | "seasonSettle"
  | "partyRunSettle"
  | "regionControlDecay"
  | "serverHostedJob"
  | "abuseDecay";

export interface EpochMaintenanceWorkerHealth {
  readonly key: EpochMaintenanceWorkerKey;
  readonly eventType: EpochMaintenanceEventType;
  readonly status: EpochMaintenanceWorkerHealthStatus;
  readonly stale: boolean;
  readonly staleAfterHours: number;
  readonly eventCount: number;
  readonly latestRanAt?: string;
  readonly latestEventId?: string;
}

export interface EpochMaintenanceHealthInfo {
  readonly checkedAt: string;
  readonly latestRanAt?: string;
  readonly status: EpochOperatorHealthStatus;
  readonly stale: boolean;
  readonly staleAfterHours: number;
  readonly attentionReasons: readonly string[];
  readonly workers: Record<EpochMaintenanceWorkerKey, EpochMaintenanceWorkerHealth>;
}

const DEFAULT_MAINTENANCE_STALE_AFTER_HOURS = 24;
const DEFAULT_MAINTENANCE_STALE_AFTER_MS = DEFAULT_MAINTENANCE_STALE_AFTER_HOURS * 60 * 60 * 1000;

const MAINTENANCE_WORKERS: readonly {
  readonly key: EpochMaintenanceWorkerKey;
  readonly eventType: EpochMaintenanceEventType;
}[] = [
  { key: "npcLifecycle", eventType: "npc_lifecycle_recorded" },
  { key: "organizationPolitics", eventType: "organization_politics_recorded" },
  { key: "marketExpiry", eventType: "market_order_expired" },
  { key: "resourceNodeSpawn", eventType: "resource_node_spawned" },
  { key: "resourceNodeSettle", eventType: "resource_node_settled" },
  { key: "anomalySpawn", eventType: "anomaly_event_spawned" },
  { key: "seasonStart", eventType: "season_campaign_created" },
  { key: "seasonSettle", eventType: "season_campaign_resolved" },
  { key: "partyRunSettle", eventType: "party_run_settled" },
  { key: "regionControlDecay", eventType: "region_control_decayed" },
  { key: "serverHostedJob", eventType: "server_hosted_job_completed" },
  { key: "abuseDecay", eventType: "abuse_score_decayed" },
];

const MAINTENANCE_EVENT_TYPES = new Set<EpochMaintenanceEventType>([
  "npc_lifecycle_recorded",
  "organization_politics_recorded",
  "organization_prestige_changed",
  "organization_treasury_changed",
  "resource_node_spawned",
  "resource_node_settled",
  "anomaly_event_spawned",
  "season_campaign_created",
  "season_campaign_resolved",
  "party_run_settled",
  "region_control_decayed",
  "region_control_released",
  "market_order_expired",
  "direct_trade_expired",
  "server_hosted_job_completed",
  "server_hosted_job_skipped",
  "abuse_score_decayed",
]);

function isRecord(value: unknown): value is AnyRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function recordValue(value: unknown): AnyRecord {
  return isRecord(value) ? value : {};
}

function maintenanceEventSubjectId(event: EpochProjection["events"][number]) {
  const payload = recordValue(event.payload);
  if (typeof payload.jobId === "string") return payload.jobId;
  if (typeof payload.npcId === "string") return payload.npcId;
  if (typeof payload.nodeId === "string") return payload.nodeId;
  if (typeof payload.anomalyId === "string") return payload.anomalyId;
  if (typeof payload.orderId === "string") return payload.orderId;
  if (typeof payload.tradeId === "string") return payload.tradeId;
  if (typeof payload.partyRunId === "string") return payload.partyRunId;
  return event.aggregateId;
}

function maintenanceEventRegionId(projection: EpochProjection, event: EpochProjection["events"][number]) {
  const payload = recordValue(event.payload);
  if (typeof payload.regionId === "string") return payload.regionId;
  if (Array.isArray(payload.regionIds)) {
    return payload.regionIds.find((regionId): regionId is string => typeof regionId === "string");
  }
  if (typeof payload.nodeId === "string") return projection.resourceNodes[payload.nodeId]?.regionId;
  if (typeof payload.jobId === "string") return projection.serverHostedJobs[payload.jobId]?.regionId;
  if (event.eventType === "season_campaign_resolved") {
    return projection.seasonCampaigns[event.aggregateId]?.regionIds[0];
  }
  if (event.eventType === "party_run_settled") {
    return projection.partyRuns[event.aggregateId]?.regionId;
  }
  if (typeof payload.npcId === "string") return projection.npcs[payload.npcId]?.regionId;
  return undefined;
}

export function maintenanceEventSummary(
  projection: EpochProjection,
  event: EpochProjection["events"][number],
): EpochMaintenanceEventSummary {
  return {
    eventId: event.eventId,
    eventType: event.eventType as EpochMaintenanceEventType,
    aggregateId: event.aggregateId,
    agentId: event.agentId,
    regionId: maintenanceEventRegionId(projection, event),
    subjectId: maintenanceEventSubjectId(event),
    createdAt: event.createdAt,
    publicPages: {
      audit: `/epoch/audit/${encodeURIComponent(event.eventId)}`,
    },
  };
}

function latestEvent(events: readonly EpochProjection["events"][number][]) {
  return events.reduce<EpochProjection["events"][number] | undefined>((latest, event) => {
    if (!latest) return event;
    if (event.createdAt > latest.createdAt) return event;
    return latest;
  }, undefined);
}

function isOrganizationPoliticsMaintenanceEvent(eventType: string) {
  return eventType === "organization_politics_recorded"
    || eventType === "organization_prestige_changed"
    || eventType === "organization_treasury_changed";
}

export function maintenanceWorkerHealth(
  key: EpochMaintenanceWorkerKey,
  eventType: EpochMaintenanceEventType,
  events: readonly EpochProjection["events"][number][],
  checkedAtMs: number,
  missingOk = false,
): EpochMaintenanceWorkerHealth {
  const workerEvents = events.filter((event) => event.eventType === eventType
    || (key === "organizationPolitics" && isOrganizationPoliticsMaintenanceEvent(event.eventType))
    || (key === "marketExpiry" && event.eventType === "direct_trade_expired")
    || (key === "serverHostedJob" && event.eventType === "server_hosted_job_skipped"));
  const latest = latestEvent(workerEvents);
  if (!latest) {
    return {
      key,
      eventType,
      status: missingOk ? "ok" : "missing",
      stale: !missingOk,
      staleAfterHours: DEFAULT_MAINTENANCE_STALE_AFTER_HOURS,
      eventCount: 0,
    };
  }
  const latestMs = Date.parse(latest.createdAt);
  const ageMs = Number.isFinite(latestMs) ? Math.max(0, checkedAtMs - latestMs) : Number.POSITIVE_INFINITY;
  const stale = ageMs > DEFAULT_MAINTENANCE_STALE_AFTER_MS;
  return {
    key,
    eventType,
    status: stale ? "stale" : "ok",
    stale,
    staleAfterHours: DEFAULT_MAINTENANCE_STALE_AFTER_HOURS,
    eventCount: workerEvents.length,
    latestRanAt: latest.createdAt,
    latestEventId: latest.eventId,
  };
}

export function maintenanceHealth(
  events: readonly EpochProjection["events"][number][],
  checkedAt: Date,
): EpochMaintenanceHealthInfo {
  const checkedAtMs = checkedAt.getTime();
  const organizationPoliticsRequired = events.some((event) =>
    event.eventType === "organization_membership_changed" || isOrganizationPoliticsMaintenanceEvent(event.eventType));
  const resourceNodeSettleRequired = events.some((event) => event.eventType === "resource_node_settled");
  const anomalySpawnRequired = events.some((event) => event.eventType === "anomaly_event_spawned");
  const seasonStartRequired = events.some((event) => event.eventType === "season_campaign_created");
  const seasonSettleRequired = events.some((event) => event.eventType === "season_campaign_resolved");
  const partyRunSettleRequired = events.some((event) => event.eventType === "party_run_settled");
  const regionControlDecayRequired = events.some((event) => event.eventType === "region_control_decayed");
  const serverHostedJobRequired = events.some((event) =>
    event.eventType === "server_hosted_job_completed" || event.eventType === "server_hosted_job_skipped");
  const workers = Object.fromEntries(MAINTENANCE_WORKERS.map((worker) => [
    worker.key,
    maintenanceWorkerHealth(
      worker.key,
      worker.eventType,
      events,
      checkedAtMs,
      (worker.key === "organizationPolitics" && !organizationPoliticsRequired)
        || (worker.key === "resourceNodeSettle" && !resourceNodeSettleRequired)
        || (worker.key === "anomalySpawn" && !anomalySpawnRequired)
        || (worker.key === "seasonStart" && !seasonStartRequired)
        || (worker.key === "seasonSettle" && !seasonSettleRequired)
        || (worker.key === "partyRunSettle" && !partyRunSettleRequired)
        || (worker.key === "regionControlDecay" && !regionControlDecayRequired)
        || (worker.key === "serverHostedJob" && !serverHostedJobRequired),
    ),
  ])) as Record<EpochMaintenanceWorkerKey, EpochMaintenanceWorkerHealth>;
  const workerValues = Object.values(workers);
  const missingCount = workerValues.filter((worker) => worker.status === "missing").length;
  const staleCount = workerValues.filter((worker) => worker.status === "stale").length;
  const latest = latestEvent(events);
  const status: EpochOperatorHealthStatus = missingCount === workerValues.length
    ? "critical"
    : missingCount > 0 || staleCount > 0
      ? "attention"
      : "ok";
  return {
    checkedAt: checkedAt.toISOString(),
    latestRanAt: latest?.createdAt,
    status,
    stale: status !== "ok",
    staleAfterHours: DEFAULT_MAINTENANCE_STALE_AFTER_HOURS,
    attentionReasons: workerValues
      .filter((worker) => worker.status !== "ok")
      .map((worker) => `maintenance_${worker.key}_${worker.status}`),
    workers,
  };
}

export function maintenanceView(
  projection: EpochProjection,
  input: { limit?: number; checkedAt?: Date } = {},
): EpochMaintenanceInfo {
  const limit = Math.max(1, Math.min(Number(input.limit || 8), 100));
  const events = projection.events
    .filter((event) => MAINTENANCE_EVENT_TYPES.has(event.eventType as EpochMaintenanceEventType));
  const recentEvents = events
    .slice(-limit)
    .reverse()
    .map((event) => maintenanceEventSummary(projection, event));
  return {
    total: events.length,
    latestRanAt: recentEvents[0]?.createdAt,
    counts: {
      npcLifecycle: events.filter((event) => event.eventType === "npc_lifecycle_recorded").length,
      organizationPolitics: events.filter((event) => isOrganizationPoliticsMaintenanceEvent(event.eventType)).length,
      resourceNodeSpawned: events.filter((event) => event.eventType === "resource_node_spawned").length,
      resourceNodeSettled: events.filter((event) => event.eventType === "resource_node_settled").length,
      anomalySpawned: events.filter((event) => event.eventType === "anomaly_event_spawned").length,
      seasonStarted: events.filter((event) => event.eventType === "season_campaign_created").length,
      seasonSettled: events.filter((event) => event.eventType === "season_campaign_resolved").length,
      partyRunsSettled: events.filter((event) => event.eventType === "party_run_settled").length,
      regionControlDecayed: events.filter((event) => event.eventType === "region_control_decayed").length,
      regionControlReleased: events.filter((event) => event.eventType === "region_control_released").length,
      marketExpired: events.filter((event) => event.eventType === "market_order_expired").length,
      directTradeExpired: events.filter((event) => event.eventType === "direct_trade_expired").length,
      serverHostedJobsCompleted: events.filter((event) => event.eventType === "server_hosted_job_completed").length,
      serverHostedJobsSkipped: events.filter((event) => event.eventType === "server_hosted_job_skipped").length,
      abuseDecayed: events.filter((event) => event.eventType === "abuse_score_decayed").length,
    },
    health: maintenanceHealth(events, input.checkedAt || new Date()),
    recentEvents,
  };
}
