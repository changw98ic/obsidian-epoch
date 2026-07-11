import type {
  EpochCommandContext,
  EpochEventType,
  EpochResourceId,
} from "./protocol.ts";
import type { EpochEvent } from "./events.ts";
import type {
  CreateAnomalyEventInput,
  CreateResourceNodeInput,
  CreateSeasonCampaignInput,
  DecayAbuseScoresInput,
  DecayRegionControlsInput,
  EpochAbuseScoreDecay,
  EpochAnomalyEvent,
  EpochCommandResult,
  EpochPartyRun,
  EpochProjection,
  EpochRegionControlDecay,
  EpochResourceNode,
  EpochSeasonCampaign,
  SettleResourceNodeInput,
  SettleSeasonCampaignInput,
  TickDirectTradeExpiryInput,
  TickDirectTradeExpiryResult,
  TickMarketExpiryInput,
  TickMarketExpiryResult,
  TickNpcLifecycleInput,
  TickNpcLifecycleResult,
  TickOrganizationPoliticsInput,
  TickOrganizationPoliticsResult,
} from "./gameCore.ts";
import type {
  EpochMaintenanceRunSummary,
  EpochRuntimeResult,
} from "./runtime.ts";
import { MAX_PARTY_RUN_MEMBERS } from "./combatSettlementRules.ts";
import { serverHostedJobsView } from "./serverHostedRuntimeRules.ts";

type AnyRecord = Record<string, unknown>;

export interface EpochMaintenancePartyRunSettlementSummary {
  readonly partyRuns: {
    readonly events: number;
    readonly settled: number;
    readonly skipped: number;
  };
}

type MaintenanceSeasonTemplate = Pick<
  CreateSeasonCampaignInput,
  "title" | "description" | "factionIds" | "resourceId" | "targetScore" | "reward" | "objectives"
>;

export interface MaintenanceRuntimeOptions {
  readonly assertOperatorKey: (input: AnyRecord) => void;
  readonly idempotentlyWithSubject: <TValue>(
    scope: string,
    input: AnyRecord,
    subject: string,
    run: () => EpochRuntimeResult<TValue>,
    options?: { readonly allowRestrictedScore?: boolean },
  ) => EpochRuntimeResult<TValue>;
  readonly clock: () => Date;
  readonly project: () => EpochProjection;
  readonly publicProjection: (projection: EpochProjection) => EpochProjection;
  readonly maintenanceContext: (input: AnyRecord, idempotencyKey: string) => EpochCommandContext;
  readonly appendRegionNewsForServerEvent: <TValue>(
    result: EpochRuntimeResult<TValue>,
    input: AnyRecord,
    eventType: EpochEventType,
    idempotencyKey: string,
  ) => EpochRuntimeResult<TValue>;
  readonly anomalyEventInputFromTemplate: (regionId: string, input: AnyRecord) => CreateAnomalyEventInput;
  readonly seasonTemplate: (input?: AnyRecord) => {
    readonly seasonKey: string;
    readonly template: MaintenanceSeasonTemplate;
  };
  readonly toRuntimeResult: <TValue>(result: EpochCommandResult<TValue>) => EpochRuntimeResult<TValue>;
  readonly tickNpcLifecycle: (
    input: TickNpcLifecycleInput,
    context: EpochCommandContext,
  ) => EpochCommandResult<TickNpcLifecycleResult>;
  readonly tickOrganizationPolitics: (
    input: TickOrganizationPoliticsInput,
    context: EpochCommandContext,
  ) => EpochCommandResult<TickOrganizationPoliticsResult>;
  readonly tickMarketExpiry: (
    input: TickMarketExpiryInput,
    context: EpochCommandContext,
  ) => EpochCommandResult<TickMarketExpiryResult>;
  readonly tickDirectTradeExpiry: (
    input: TickDirectTradeExpiryInput,
    context: EpochCommandContext,
  ) => EpochCommandResult<TickDirectTradeExpiryResult>;
  readonly createResourceNode: (
    input: CreateResourceNodeInput,
    context: EpochCommandContext,
  ) => EpochCommandResult<EpochResourceNode>;
  readonly settleResourceNode: (
    input: SettleResourceNodeInput,
    context: EpochCommandContext,
  ) => EpochCommandResult<EpochResourceNode>;
  readonly createAnomalyEvent: (
    input: CreateAnomalyEventInput,
    context: EpochCommandContext,
  ) => EpochCommandResult<EpochAnomalyEvent>;
  readonly createSeasonCampaign: (
    input: CreateSeasonCampaignInput,
    context: EpochCommandContext,
  ) => EpochCommandResult<EpochSeasonCampaign>;
  readonly settleSeasonCampaign: (
    input: SettleSeasonCampaignInput,
    context: EpochCommandContext,
  ) => EpochCommandResult<EpochSeasonCampaign>;
  readonly settlePartyRun?: (
    input: { readonly partyRunId: string },
    context: EpochCommandContext,
  ) => EpochCommandResult<EpochPartyRun>;
  readonly decayRegionControls: (
    input: DecayRegionControlsInput,
    context: EpochCommandContext,
  ) => EpochCommandResult<readonly EpochRegionControlDecay[]>;
  readonly decayAbuseScores: (
    input: DecayAbuseScoresInput,
    context: EpochCommandContext,
  ) => EpochCommandResult<readonly EpochAbuseScoreDecay[]>;
  readonly runServerHostedJob: (input?: AnyRecord) => EpochRuntimeResult<unknown>;
}

export interface MaintenanceRuntime {
  readonly run: (input?: AnyRecord) => EpochRuntimeResult<EpochMaintenanceRunSummary & EpochMaintenancePartyRunSettlementSummary>;
}

const DEFAULT_MAINTENANCE_NPC_LIMIT = 5;
const DEFAULT_MAINTENANCE_MARKET_MAX_AGE_SECONDS = 24 * 60 * 60;
const DEFAULT_MAINTENANCE_MARKET_LIMIT = 50;
const DEFAULT_MAINTENANCE_DIRECT_TRADE_MAX_AGE_SECONDS = DEFAULT_MAINTENANCE_MARKET_MAX_AGE_SECONDS;
const DEFAULT_MAINTENANCE_DIRECT_TRADE_LIMIT = DEFAULT_MAINTENANCE_MARKET_LIMIT;
const DEFAULT_MAINTENANCE_RESOURCE_NODE_LIMIT = 0;
const DEFAULT_MAINTENANCE_RESOURCE_NODE_SETTLEMENT_LIMIT = 0;
const DEFAULT_MAINTENANCE_ANOMALY_LIMIT = 0;
const DEFAULT_MAINTENANCE_SEASON_LIMIT = 0;
const DEFAULT_MAINTENANCE_SEASON_SETTLEMENT_LIMIT = 0;
const DEFAULT_MAINTENANCE_PARTY_RUN_SETTLEMENT_LIMIT = 0;
const DEFAULT_MAINTENANCE_SERVER_HOSTED_JOB_LIMIT = 5;
const DEFAULT_MAINTENANCE_REGION_CONTROL_DECAY_LIMIT = 0;
const DEFAULT_MAINTENANCE_REGION_CONTROL_DECAY_AMOUNT = 1;
const DEFAULT_MAINTENANCE_REGION_CONTROL_DECAY_MIN_AGE_SECONDS = 7 * 24 * 60 * 60;
const DEFAULT_MAINTENANCE_ABUSE_DECAY_LIMIT = 0;
const DEFAULT_MAINTENANCE_ABUSE_DECAY_AMOUNT = 1;

const RESOURCE_NODE_SKIP_ERRORS = new Set([
  "resource_node_region_open",
  "resource_node_spawn_cooldown_active",
]);
const ANOMALY_SKIP_ERRORS = new Set([
  "anomaly_event_region_open",
]);

function boundedInteger(value: unknown, fallback: number, min: number, max: number) {
  const parsed = typeof value === "number" || typeof value === "string" ? Number(value) : fallback;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(Math.floor(parsed), max));
}

export function maintenanceIdSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_.:-]/g, "_");
}

function listInputRegionIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value
    .filter((regionId): regionId is string => typeof regionId === "string" && regionId.trim().length > 0)
    .map((regionId) => regionId.trim()))];
}

function maintenanceResourceNodeSettlementCandidates(projection: EpochProjection) {
  return Object.values(projection.resourceNodes)
    .filter((node): node is EpochResourceNode =>
      node.status === "open" && Number(node.totalScore || 0) > 0)
    .sort((left, right) =>
      left.spawnedAt.localeCompare(right.spawnedAt) || left.nodeId.localeCompare(right.nodeId));
}

function activeSeasonCampaignForRegion(projection: EpochProjection, regionId: string): EpochSeasonCampaign | undefined {
  return Object.values(projection.seasonCampaigns).find((season) =>
    season.status === "active" && season.regionIds.includes(regionId));
}

function maintenanceSeasonSettlementCandidates(projection: EpochProjection) {
  return Object.values(projection.seasonCampaigns)
    .filter((season) => season.status === "active" && season.totalScore >= season.targetScore)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.seasonId.localeCompare(right.seasonId));
}

function maintenancePartyRunSettlementCandidates(projection: EpochProjection) {
  return Object.values(projection.partyRuns)
    .filter((partyRun) => partyRun.status === "open" && partyRun.members.length >= MAX_PARTY_RUN_MEMBERS)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.partyRunId.localeCompare(right.partyRunId));
}

export function createMaintenanceRuntime(options: MaintenanceRuntimeOptions): MaintenanceRuntime {
  function run(
    input: AnyRecord = {},
  ): EpochRuntimeResult<EpochMaintenanceRunSummary & EpochMaintenancePartyRunSettlementSummary> {
    options.assertOperatorKey(input);
    return options.idempotentlyWithSubject<EpochMaintenanceRunSummary & EpochMaintenancePartyRunSettlementSummary>(
      "run_maintenance",
      input,
      "operator",
      () => {
        const sourceKey = String(input.idempotencyKey || "manual");
        const tickId = `maintenance_${maintenanceIdSegment(sourceKey)}`;
        const ranAt = options.clock().toISOString();
        const events: EpochEvent[] = [];
        const npcRegionId = typeof input.npcRegionId === "string" && input.npcRegionId.trim()
          ? input.npcRegionId.trim()
          : undefined;
        const npcLimit = boundedInteger(input.npcLimit, DEFAULT_MAINTENANCE_NPC_LIMIT, 1, 100);
        const marketMaxAgeSeconds = boundedInteger(
          input.marketMaxAgeSeconds,
          DEFAULT_MAINTENANCE_MARKET_MAX_AGE_SECONDS,
          1,
          30 * 24 * 60 * 60,
        );
        const marketLimit = boundedInteger(input.marketLimit, DEFAULT_MAINTENANCE_MARKET_LIMIT, 1, 500);
        const directTradeMaxAgeSeconds = boundedInteger(
          input.directTradeMaxAgeSeconds,
          DEFAULT_MAINTENANCE_DIRECT_TRADE_MAX_AGE_SECONDS,
          1,
          30 * 24 * 60 * 60,
        );
        const directTradeLimit = boundedInteger(
          input.directTradeLimit,
          DEFAULT_MAINTENANCE_DIRECT_TRADE_LIMIT,
          1,
          500,
        );
        const resourceNodeLimit = boundedInteger(
          input.resourceNodeLimit,
          DEFAULT_MAINTENANCE_RESOURCE_NODE_LIMIT,
          0,
          100,
        );
        const resourceNodeSettlementLimit = boundedInteger(
          input.resourceNodeSettlementLimit,
          DEFAULT_MAINTENANCE_RESOURCE_NODE_SETTLEMENT_LIMIT,
          0,
          100,
        );
        const anomalyLimit = boundedInteger(
          input.anomalyLimit,
          DEFAULT_MAINTENANCE_ANOMALY_LIMIT,
          0,
          100,
        );
        const seasonLimit = boundedInteger(
          input.seasonLimit,
          DEFAULT_MAINTENANCE_SEASON_LIMIT,
          0,
          100,
        );
        const seasonSettlementLimit = boundedInteger(
          input.seasonSettlementLimit,
          DEFAULT_MAINTENANCE_SEASON_SETTLEMENT_LIMIT,
          0,
          100,
        );
        const partyRunSettlementLimit = boundedInteger(
          input.partyRunSettlementLimit,
          DEFAULT_MAINTENANCE_PARTY_RUN_SETTLEMENT_LIMIT,
          0,
          100,
        );
      const serverHostedJobLimit = boundedInteger(
        input.serverHostedJobLimit,
        DEFAULT_MAINTENANCE_SERVER_HOSTED_JOB_LIMIT,
        0,
        100,
      );
      const regionControlDecayLimit = boundedInteger(
        input.regionControlDecayLimit,
        DEFAULT_MAINTENANCE_REGION_CONTROL_DECAY_LIMIT,
        0,
        100,
      );
      const regionControlDecayAmount = boundedInteger(
        input.regionControlDecayAmount,
        DEFAULT_MAINTENANCE_REGION_CONTROL_DECAY_AMOUNT,
        1,
        100,
      );
      const regionControlDecayMinAgeSeconds = boundedInteger(
        input.regionControlDecayMinAgeSeconds,
        DEFAULT_MAINTENANCE_REGION_CONTROL_DECAY_MIN_AGE_SECONDS,
        0,
        365 * 24 * 60 * 60,
      );
      const abuseDecayLimit = boundedInteger(
        input.abuseDecayLimit,
        DEFAULT_MAINTENANCE_ABUSE_DECAY_LIMIT,
        0,
        100,
      );
      const abuseDecayAmount = boundedInteger(
        input.abuseDecayAmount,
        DEFAULT_MAINTENANCE_ABUSE_DECAY_AMOUNT,
        1,
        10,
      );

      const npc = options.tickNpcLifecycle({
        regionId: npcRegionId,
        limit: npcLimit,
      }, options.maintenanceContext(input, `maintenance:${tickId}:npc`));
      events.push(...npc.events);

      const organizationPolitics = options.tickOrganizationPolitics({
        regionId: npcRegionId,
        limit: npcLimit,
      }, options.maintenanceContext(input, `maintenance:${tickId}:organization-politics`));
      events.push(...organizationPolitics.events);

      const market = options.tickMarketExpiry({
        maxAgeSeconds: marketMaxAgeSeconds,
        limit: marketLimit,
      }, options.maintenanceContext(input, `maintenance:${tickId}:market`));
      events.push(...market.events);

      const directTradeExpiry = options.tickDirectTradeExpiry({
        maxAgeSeconds: directTradeMaxAgeSeconds,
        limit: directTradeLimit,
      }, options.maintenanceContext(input, `maintenance:${tickId}:direct-trade`));
      events.push(...directTradeExpiry.events);

      let resourceNodeEvents = 0;
      let resourceNodeSpawned = 0;
      let resourceNodeSettled = 0;
      let resourceNodeSkipped = 0;
      for (const node of maintenanceResourceNodeSettlementCandidates(options.project()).slice(0, resourceNodeSettlementLimit)) {
        const result = options.toRuntimeResult(options.settleResourceNode({
          nodeId: node.nodeId,
        }, options.maintenanceContext(input, `maintenance:${tickId}:resource-node-settle:${maintenanceIdSegment(node.nodeId)}`)));
        const resultWithNews = options.appendRegionNewsForServerEvent(
          result,
          input,
          "resource_node_settled",
          `maintenance:${tickId}:resource-node-settle-news:${maintenanceIdSegment(node.nodeId)}`,
        );
        events.push(...resultWithNews.events);
        resourceNodeEvents += resultWithNews.events.length;
        if (result.events.some((event) => event.eventType === "resource_node_settled")) {
          resourceNodeSettled += 1;
        }
      }
      for (const regionId of listInputRegionIds(input.resourceNodeRegionIds).slice(0, resourceNodeLimit)) {
        try {
          const result = options.createResourceNode({
            regionId,
            title: typeof input.resourceNodeTitle === "string" && input.resourceNodeTitle.trim()
              ? input.resourceNodeTitle.trim()
              : "区域灵质露点",
            description: typeof input.resourceNodeDescription === "string" && input.resourceNodeDescription.trim()
              ? input.resourceNodeDescription.trim()
              : "服务器维护巡检发现的短周期区域资源点，争夺和奖励都按服务器事件结算。",
            resourceId: typeof input.resourceNodeResourceId === "string" ? input.resourceNodeResourceId as EpochResourceId : "aether",
            rewardAmount: boundedInteger(input.resourceNodeRewardAmount, 2, 1, 100),
            rewardReason: `maintenance_resource_node:${regionId}`,
          }, options.maintenanceContext(input, `maintenance:${tickId}:resource-node:${maintenanceIdSegment(regionId)}`));
          events.push(...result.events);
          resourceNodeEvents += result.events.length;
          if (result.events.some((event) => event.eventType === "resource_node_spawned")) {
            resourceNodeSpawned += 1;
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (!RESOURCE_NODE_SKIP_ERRORS.has(message)) throw error;
          resourceNodeSkipped += 1;
        }
      }

      let anomalyEvents = 0;
      let anomalySpawned = 0;
      let anomalySkipped = 0;
      for (const regionId of listInputRegionIds(input.anomalyRegionIds).slice(0, anomalyLimit)) {
        try {
          const result = options.createAnomalyEvent(
            options.anomalyEventInputFromTemplate(regionId, {
              ...input,
              anomalyTemplateRotationSeed: `${tickId}:${regionId}`,
            }),
            options.maintenanceContext(input, `maintenance:${tickId}:anomaly:${maintenanceIdSegment(regionId)}`),
          );
          const resultWithNews = options.appendRegionNewsForServerEvent(
            options.toRuntimeResult(result),
            input,
            "anomaly_event_spawned",
            `maintenance:${tickId}:anomaly-news:${maintenanceIdSegment(regionId)}`,
          );
          events.push(...resultWithNews.events);
          anomalyEvents += resultWithNews.events.length;
          if (result.events.some((event) => event.eventType === "anomaly_event_spawned")) {
            anomalySpawned += 1;
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (!ANOMALY_SKIP_ERRORS.has(message)) throw error;
          anomalySkipped += 1;
        }
      }

      let seasonEvents = 0;
      let seasonStarted = 0;
      let seasonSettled = 0;
      let seasonSkipped = 0;
      for (const season of maintenanceSeasonSettlementCandidates(options.project()).slice(0, seasonSettlementLimit)) {
        const settleResult = options.toRuntimeResult(options.settleSeasonCampaign({
          seasonId: season.seasonId,
        }, options.maintenanceContext(input, `maintenance:${tickId}:season-settle:${maintenanceIdSegment(season.seasonId)}`)));
        events.push(...settleResult.events);
        seasonEvents += settleResult.events.length;
        if (settleResult.events.some((event) => event.eventType === "season_campaign_resolved")) {
          seasonSettled += 1;
        }
      }
      const { seasonKey, template } = options.seasonTemplate(input);
      for (const regionId of listInputRegionIds(input.seasonRegionIds).slice(0, seasonLimit)) {
        if (activeSeasonCampaignForRegion(options.project(), regionId)) {
          seasonSkipped += 1;
          continue;
        }
        const seasonResult = options.toRuntimeResult(options.createSeasonCampaign({
          seasonKey: `${seasonKey}:${regionId}:${tickId}`,
          title: template.title,
          description: template.description,
          regionIds: [regionId],
          factionIds: template.factionIds,
          resourceId: template.resourceId,
          targetScore: template.targetScore,
          reward: template.reward,
          objectives: template.objectives || [],
        }, options.maintenanceContext(input, `maintenance:${tickId}:season:${maintenanceIdSegment(regionId)}`)));
        events.push(...seasonResult.events);
        seasonEvents += seasonResult.events.length;
        const createdSeason = seasonResult.value;
        if (seasonResult.events.some((event) => event.eventType === "season_campaign_created")) {
          seasonStarted += 1;
          try {
            const encounterInput = options.anomalyEventInputFromTemplate(regionId, {
              ...input,
              anomalyTemplateKey: typeof input.encounterTemplateKey === "string"
                ? input.encounterTemplateKey
                : "obsidian_wyrm_boss",
              anomalyNarrativeVariantSeed: `${createdSeason.seasonId}:${regionId}:opening_encounter`,
            });
            const encounterResult = options.appendRegionNewsForServerEvent(
              options.toRuntimeResult(options.createAnomalyEvent({
                ...encounterInput,
                sourceSeasonId: createdSeason.seasonId,
              }, options.maintenanceContext(input, `maintenance:${tickId}:season-encounter:${maintenanceIdSegment(regionId)}`))),
              input,
              "anomaly_event_spawned",
              `maintenance:${tickId}:season-encounter-news:${maintenanceIdSegment(regionId)}`,
            );
            events.push(...encounterResult.events);
            seasonEvents += encounterResult.events.length;
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (!ANOMALY_SKIP_ERRORS.has(message)) throw error;
          }
        } else {
          seasonSkipped += 1;
        }
      }

      let partyRunEvents = 0;
      let partyRunsSettled = 0;
      let partyRunsSkipped = 0;
      if (options.settlePartyRun) {
        for (const partyRun of maintenancePartyRunSettlementCandidates(options.project()).slice(0, partyRunSettlementLimit)) {
          const settleResult = options.toRuntimeResult(options.settlePartyRun({
            partyRunId: partyRun.partyRunId,
          }, options.maintenanceContext(
            input,
            `maintenance:${tickId}:party-run-settle:${maintenanceIdSegment(partyRun.partyRunId)}`,
          )));
          events.push(...settleResult.events);
          partyRunEvents += settleResult.events.length;
          if (settleResult.events.some((event) => event.eventType === "party_run_settled")) {
            partyRunsSettled += 1;
          } else {
            partyRunsSkipped += 1;
          }
        }
      }

      const regionControlDecay = options.decayRegionControls({
        limit: regionControlDecayLimit,
        amount: regionControlDecayAmount,
        minAgeSeconds: regionControlDecayMinAgeSeconds,
      }, options.maintenanceContext(input, `maintenance:${tickId}:region-control-decay`));
      events.push(...regionControlDecay.events);

      let serverHostedJobEvents = 0;
      let serverHostedJobsCompleted = 0;
      let serverHostedJobsSkipped = 0;
      for (const job of serverHostedJobsView(options.project(), { status: "queued" }).slice(0, serverHostedJobLimit)) {
        const jobResult = options.runServerHostedJob({
          ...input,
          jobId: job.jobId,
          idempotencyKey: `maintenance:${tickId}:server-hosted-job:${maintenanceIdSegment(job.jobId)}`,
        });
        events.push(...jobResult.events);
        serverHostedJobEvents += jobResult.events.length;
        if (jobResult.events.some((event) => event.eventType === "server_hosted_job_completed")) {
          serverHostedJobsCompleted += 1;
        } else {
          serverHostedJobsSkipped += 1;
        }
      }

      const abuseDecay = options.decayAbuseScores({
        limit: abuseDecayLimit,
        amount: abuseDecayAmount,
      }, options.maintenanceContext(input, `maintenance:${tickId}:abuse-decay`));
      events.push(...abuseDecay.events);

      return {
        value: {
          tickId,
          ranAt,
          npc: {
            events: npc.events.length,
          },
          organizationPolitics: {
            events: organizationPolitics.events.length,
          },
          market: {
            events: market.events.length + directTradeExpiry.events.length,
          },
          resourceNodes: {
            events: resourceNodeEvents,
            spawned: resourceNodeSpawned,
            settled: resourceNodeSettled,
            skipped: resourceNodeSkipped,
          },
          anomalies: {
            events: anomalyEvents,
            spawned: anomalySpawned,
            skipped: anomalySkipped,
          },
          seasons: {
            events: seasonEvents,
            started: seasonStarted,
            settled: seasonSettled,
            skipped: seasonSkipped,
          },
          partyRuns: {
            events: partyRunEvents,
            settled: partyRunsSettled,
            skipped: partyRunsSkipped,
          },
          serverHostedJobs: {
            events: serverHostedJobEvents,
            completed: serverHostedJobsCompleted,
            skipped: serverHostedJobsSkipped,
          },
          abuse: {
            events: abuseDecay.events.length,
            decayed: abuseDecay.value.length,
          },
          regionControls: {
            events: regionControlDecay.events.length,
            decayed: regionControlDecay.value.length,
          },
          persistedEvents: 0,
        },
        events,
        projection: options.publicProjection(options.project()),
      };
      },
      { allowRestrictedScore: true },
    );
  }

  return {
    run,
  };
}
