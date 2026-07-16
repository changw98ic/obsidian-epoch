import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const runtimePath = new URL("../lib/epoch/runtime.ts", import.meta.url);
const actionEligibilityReadModelPath = new URL("../lib/epoch/actionEligibilityReadModel.ts", import.meta.url);
const activityRuntimeReadModelPath = new URL("../lib/epoch/activityRuntimeReadModel.ts", import.meta.url);
const agentMemoryReadModelPath = new URL("../lib/epoch/agentMemoryReadModel.ts", import.meta.url);
const anomalyEventTemplateRulesPath = new URL("../lib/epoch/anomalyEventTemplateRules.ts", import.meta.url);
const auditReadModelPath = new URL("../lib/epoch/auditReadModel.ts", import.meta.url);
const bountyPartyReadModelPath = new URL("../lib/epoch/bountyPartyReadModel.ts", import.meta.url);
const combatRuntimeReadModelPath = new URL("../lib/epoch/combatRuntimeReadModel.ts", import.meta.url);
const downtimeRuntimePath = new URL("../lib/epoch/downtimeRuntime.ts", import.meta.url);
const economyRuntimeReadModelPath = new URL("../lib/epoch/economyRuntimeReadModel.ts", import.meta.url);
const encounterReadModelPath = new URL("../lib/epoch/encounterReadModel.ts", import.meta.url);
const encounterRuntimeReadModelPath = new URL("../lib/epoch/encounterRuntimeReadModel.ts", import.meta.url);
const explorerProfileReadModelPath = new URL("../lib/epoch/explorerProfileReadModel.ts", import.meta.url);
const explorationRuntimePath = new URL("../lib/epoch/explorationRuntime.ts", import.meta.url);
const explorerAuthRuntimePath = new URL("../lib/epoch/explorerAuthRuntime.ts", import.meta.url);
const runtimeAbuseRuntimePath = new URL("../lib/epoch/runtimeAbuseRuntime.ts", import.meta.url);
const highValueConfirmationRulesPath = new URL("../lib/epoch/highValueConfirmationRules.ts", import.meta.url);
const highValueConfirmationRuntimePath = new URL("../lib/epoch/highValueConfirmationRuntime.ts", import.meta.url);
const attestationRuntimePath = new URL("../lib/epoch/attestationRuntime.ts", import.meta.url);
const hostedSessionReadModelPath = new URL("../lib/epoch/hostedSessionReadModel.ts", import.meta.url);
const hostedSessionRuntimeReadModelPath = new URL("../lib/epoch/hostedSessionRuntimeReadModel.ts", import.meta.url);
const identityRuntimeReadModelPath = new URL("../lib/epoch/identityRuntimeReadModel.ts", import.meta.url);
const identityArchiveReadModelPath = new URL("../lib/epoch/identityArchiveReadModel.ts", import.meta.url);
const idempotencyRulesPath = new URL("../lib/epoch/idempotencyRules.ts", import.meta.url);
const marketReadModelPath = new URL("../lib/epoch/marketReadModel.ts", import.meta.url);
const maintenanceReadModelPath = new URL("../lib/epoch/maintenanceReadModel.ts", import.meta.url);
const npcStateReadModelPath = new URL("../lib/epoch/npcStateReadModel.ts", import.meta.url);
const npcCandidateReadModelPath = new URL("../lib/epoch/npcCandidateReadModel.ts", import.meta.url);
const npcCandidateRuntimePath = new URL("../lib/epoch/npcCandidateRuntime.ts", import.meta.url);
const npcLifecycleRuntimePath = new URL("../lib/epoch/npcLifecycleRuntime.ts", import.meta.url);
const operatorOverviewReadModelPath = new URL("../lib/epoch/operatorOverviewReadModel.ts", import.meta.url);
const operatorRuntimeReadModelPath = new URL("../lib/epoch/operatorRuntimeReadModel.ts", import.meta.url);
const organizationReadModelPath = new URL("../lib/epoch/organizationReadModel.ts", import.meta.url);
const organizationNpcReadModelPath = new URL("../lib/epoch/organizationNpcReadModel.ts", import.meta.url);
const personalMigrationReadModelPath = new URL("../lib/epoch/personalMigrationReadModel.ts", import.meta.url);
const progressReadModelPath = new URL("../lib/epoch/progressReadModel.ts", import.meta.url);
const publicWorldReadModelPath = new URL("../lib/epoch/publicWorldReadModel.ts", import.meta.url);
const shopReadModelPath = new URL("../lib/epoch/shopReadModel.ts", import.meta.url);
const regionCommissionReadModelPath = new URL("../lib/epoch/regionCommissionReadModel.ts", import.meta.url);
const regionActivityReadModelPath = new URL("../lib/epoch/regionActivityReadModel.ts", import.meta.url);
const regionConflictReadModelPath = new URL("../lib/epoch/regionConflictReadModel.ts", import.meta.url);
const regionInfoReadModelPath = new URL("../lib/epoch/regionInfoReadModel.ts", import.meta.url);
const regionLeaderboardReadModelPath = new URL("../lib/epoch/regionLeaderboardReadModel.ts", import.meta.url);
const regionMediaReadModelPath = new URL("../lib/epoch/regionMediaReadModel.ts", import.meta.url);
const regionMonumentReadModelPath = new URL("../lib/epoch/regionMonumentReadModel.ts", import.meta.url);
const regionNewsDraftRulesPath = new URL("../lib/epoch/regionNewsDraftRules.ts", import.meta.url);
const regionNewsReadModelPath = new URL("../lib/epoch/regionNewsReadModel.ts", import.meta.url);
const regionNewsRuntimePath = new URL("../lib/epoch/regionNewsRuntime.ts", import.meta.url);
const relationshipReadModelPath = new URL("../lib/epoch/relationshipReadModel.ts", import.meta.url);
const resultPageContextRulesPath = new URL("../lib/epoch/resultPageContextRules.ts", import.meta.url);
const resultPagePayloadRulesPath = new URL("../lib/epoch/resultPagePayloadRules.ts", import.meta.url);
const resultPageReceiptRulesPath = new URL("../lib/epoch/resultPageReceiptRules.ts", import.meta.url);
const resultPageRuntimeRulesPath = new URL("../lib/epoch/resultPageRuntimeRules.ts", import.meta.url);
const resultPageRuntimeStorePath = new URL("../lib/epoch/resultPageRuntimeStore.ts", import.meta.url);
const resultPageNavigationRulesPath = new URL("../lib/epoch/resultPageNavigationRules.ts", import.meta.url);
const serverHostedRuntimeRulesPath = new URL("../lib/epoch/serverHostedRuntimeRules.ts", import.meta.url);
const serverHostedRuntimePath = new URL("../lib/epoch/serverHostedRuntime.ts", import.meta.url);
const maintenanceRuntimePath = new URL("../lib/epoch/maintenanceRuntime.ts", import.meta.url);
const seasonReadModelPath = new URL("../lib/epoch/seasonReadModel.ts", import.meta.url);
const seasonRuntimeReadModelPath = new URL("../lib/epoch/seasonRuntimeReadModel.ts", import.meta.url);
const socialRuntimeReadModelPath = new URL("../lib/epoch/socialRuntimeReadModel.ts", import.meta.url);
const runtimeAuthPath = new URL("../lib/epoch/runtimeAuth.ts", import.meta.url);
const runtimeCommandContextRulesPath = new URL("../lib/epoch/runtimeCommandContextRules.ts", import.meta.url);
const runtimeIdempotencyRuntimePath = new URL("../lib/epoch/runtimeIdempotencyRuntime.ts", import.meta.url);
const runtimeInputSafetyRulesPath = new URL("../lib/epoch/runtimeInputSafetyRules.ts", import.meta.url);
const runtimeInputRulesPath = new URL("../lib/epoch/runtimeInputRules.ts", import.meta.url);
const runtimePublicProjectionRulesPath = new URL("../lib/epoch/runtimePublicProjectionRules.ts", import.meta.url);
const sourceEventRulesPath = new URL("../lib/epoch/sourceEventRules.ts", import.meta.url);
const loreProvenanceRulesPath = new URL("../lib/epoch/loreProvenanceRules.ts", import.meta.url);
const loreReadModelPath = new URL("../lib/epoch/loreReadModel.ts", import.meta.url);
const webBridgeReadModelPath = new URL("../lib/epoch/webBridgeReadModel.ts", import.meta.url);

test("runtime delegates action eligibility read model to a focused module", () => {
  assert.ok(
    existsSync(actionEligibilityReadModelPath),
    "actionEligibilityReadModel.ts should own active identity tool eligibility projection",
  );
  const runtime = readFileSync(runtimePath, "utf8");
  const actionEligibilityReadModel = readFileSync(actionEligibilityReadModelPath, "utf8");

  assert.match(runtime, /from "\.\/actionEligibilityReadModel\.ts"/);
  assert.match(actionEligibilityReadModel, /export function actionEligibilityView/);
  assert.match(actionEligibilityReadModel, /export interface EpochActionEligibilityInfo/);
  assert.match(actionEligibilityReadModel, /export const EPOCH_ACTIVE_IDENTITY_TOOL_NAMES/);
  assert.match(actionEligibilityReadModel, /export const EPOCH_ACTIVE_IDENTITY_RECOMMENDED_TOOLS/);
  assert.match(actionEligibilityReadModel, /export const EPOCH_ARCHIVED_IDENTITY_RECOMMENDED_TOOLS/);

  assert.doesNotMatch(runtime, /function actionEligibilityView/);
  assert.doesNotMatch(runtime, /export interface EpochActionEligibilityInfo/);
  assert.doesNotMatch(runtime, /export const EPOCH_ACTIVE_IDENTITY_TOOL_NAMES/);
  assert.doesNotMatch(runtime, /export const EPOCH_ACTIVE_IDENTITY_RECOMMENDED_TOOLS/);
  assert.doesNotMatch(runtime, /export const EPOCH_ARCHIVED_IDENTITY_RECOMMENDED_TOOLS/);
});

test("runtime delegates agent memory and NPC candidate read models to focused modules", () => {
  assert.ok(existsSync(agentMemoryReadModelPath), "agentMemoryReadModel.ts should own agent memory projection");
  assert.ok(existsSync(identityRuntimeReadModelPath), "identityRuntimeReadModel.ts should own runtime identity/profile wrappers");
  assert.ok(existsSync(npcCandidateReadModelPath), "npcCandidateReadModel.ts should own NPC candidate projection helpers");
  const runtime = readFileSync(runtimePath, "utf8");
  const identityRuntimeReadModel = readFileSync(identityRuntimeReadModelPath, "utf8");
  const agentMemoryReadModel = readFileSync(agentMemoryReadModelPath, "utf8");
  const npcCandidateReadModel = readFileSync(npcCandidateReadModelPath, "utf8");

  assert.match(runtime, /from "\.\/identityRuntimeReadModel\.ts"/);
  assert.match(identityRuntimeReadModel, /from "\.\/agentMemoryReadModel\.ts"/);
  assert.match(identityRuntimeReadModel, /export function agentMemoryInfoView/);
  assert.match(runtime, /from "\.\/npcCandidateReadModel\.ts"/);
  assert.match(agentMemoryReadModel, /export function agentMemoryView/);
  assert.match(agentMemoryReadModel, /export interface EpochAgentMemoryInfo/);
  assert.match(npcCandidateReadModel, /export function npcCandidatesView/);
  assert.match(npcCandidateReadModel, /export function npcCandidateSourceEventIds/);

  assert.doesNotMatch(runtime, /function agentMemoryView/);
  assert.doesNotMatch(runtime, /function agentMemoryItem/);
  assert.doesNotMatch(runtime, /from "\.\/agentMemoryReadModel\.ts"/);
  assert.doesNotMatch(runtime, /agentMemoryView\(core\.project/);
  assert.doesNotMatch(runtime, /function npcCandidatesView/);
  assert.doesNotMatch(runtime, /function npcCandidateSourceEventIds/);
  assert.doesNotMatch(runtime, /export interface EpochAgentMemoryInfo/);
});

test("runtime delegates personal migration and explorer profile read models to focused modules", () => {
  assert.ok(existsSync(personalMigrationReadModelPath), "personalMigrationReadModel.ts should own personal migration projection");
  assert.ok(existsSync(explorerProfileReadModelPath), "explorerProfileReadModel.ts should own explorer profile projection");
  const runtime = readFileSync(runtimePath, "utf8");
  const identityRuntimeReadModel = readFileSync(identityRuntimeReadModelPath, "utf8");
  const personalMigrationReadModel = readFileSync(personalMigrationReadModelPath, "utf8");
  const explorerProfileReadModel = readFileSync(explorerProfileReadModelPath, "utf8");

  assert.match(runtime, /from "\.\/identityRuntimeReadModel\.ts"/);
  assert.match(identityRuntimeReadModel, /from "\.\/personalMigrationReadModel\.ts"/);
  assert.match(identityRuntimeReadModel, /from "\.\/explorerProfileReadModel\.ts"/);
  assert.match(identityRuntimeReadModel, /from "\.\/loreReadModel\.ts"/);
  assert.match(identityRuntimeReadModel, /export function personalMigrationInfoView/);
  assert.match(identityRuntimeReadModel, /export function explorerProfileInfoView/);
  assert.match(personalMigrationReadModel, /export function personalMigrationSummaryView/);
  assert.match(personalMigrationReadModel, /export interface EpochPersonalMigrationSummary/);
  assert.match(explorerProfileReadModel, /export function explorerProfileView/);
  assert.match(explorerProfileReadModel, /export interface EpochExplorerProfileInfo/);

  assert.doesNotMatch(runtime, /function personalMigrationSummaryView/);
  assert.doesNotMatch(runtime, /function personalMigrationDispositionFor/);
  assert.doesNotMatch(runtime, /function explorerProfileView/);
  assert.doesNotMatch(runtime, /from "\.\/personalMigrationReadModel\.ts"/);
  assert.doesNotMatch(runtime, /from "\.\/explorerProfileReadModel\.ts"/);
  assert.doesNotMatch(runtime, /personalMigrationSummaryView\(/);
  assert.doesNotMatch(runtime, /explorerProfileView\(core\.project/);
  assert.doesNotMatch(runtime, /export interface EpochPersonalMigrationSummary/);
  assert.doesNotMatch(runtime, /export interface EpochExplorerProfileInfo/);
});

test("runtime delegates audit and risk review read models to a focused module", () => {
  assert.ok(existsSync(auditReadModelPath), "auditReadModel.ts should own audit and risk review projections");
  assert.ok(existsSync(operatorRuntimeReadModelPath), "operatorRuntimeReadModel.ts should own runtime operator/audit read wrappers");
  const runtime = readFileSync(runtimePath, "utf8");
  const operatorRuntimeReadModel = readFileSync(operatorRuntimeReadModelPath, "utf8");
  const auditReadModel = readFileSync(auditReadModelPath, "utf8");

  assert.match(runtime, /from "\.\/operatorRuntimeReadModel\.ts"/);
  assert.match(operatorRuntimeReadModel, /from "\.\/auditReadModel\.ts"/);
  assert.match(operatorRuntimeReadModel, /export function auditInfoView/);
  assert.match(auditReadModel, /export function auditView/);
  assert.match(auditReadModel, /export function auditRiskProfile/);
  assert.match(auditReadModel, /export function eventNeedsRiskReview/);
  assert.match(auditReadModel, /export interface EpochAuditInfo/);
  assert.match(auditReadModel, /export interface EpochAuditRiskProfile/);

  assert.doesNotMatch(runtime, /function auditView/);
  assert.doesNotMatch(runtime, /function auditRiskProfile/);
  assert.doesNotMatch(runtime, /function auditEventSummary/);
  assert.doesNotMatch(runtime, /function latestRiskReviewSummary/);
  assert.doesNotMatch(runtime, /function eventNeedsRiskReview/);
  assert.doesNotMatch(runtime, /from "\.\/auditReadModel\.ts"/);
  assert.doesNotMatch(runtime, /auditView\(core\.project/);
  assert.doesNotMatch(runtime, /export interface EpochAuditInfo/);
  assert.doesNotMatch(runtime, /export interface EpochAuditRiskProfile/);
});

test("runtime delegates maintenance read model to a focused module", () => {
  assert.ok(existsSync(maintenanceReadModelPath), "maintenanceReadModel.ts should own maintenance event and health projections");
  const runtime = readFileSync(runtimePath, "utf8");
  const maintenanceReadModel = readFileSync(maintenanceReadModelPath, "utf8");

  assert.match(runtime, /from "\.\/maintenanceReadModel\.ts"/);
  assert.match(maintenanceReadModel, /export function maintenanceView/);
  assert.match(maintenanceReadModel, /export function maintenanceHealth/);
  assert.match(maintenanceReadModel, /export function maintenanceEventSummary/);
  assert.match(maintenanceReadModel, /export interface EpochMaintenanceInfo/);
  assert.match(maintenanceReadModel, /export interface EpochMaintenanceHealthInfo/);

  assert.doesNotMatch(runtime, /function maintenanceView/);
  assert.doesNotMatch(runtime, /function maintenanceHealth/);
  assert.doesNotMatch(runtime, /function maintenanceWorkerHealth/);
  assert.doesNotMatch(runtime, /function maintenanceEventSummary/);
  assert.doesNotMatch(runtime, /function maintenanceEventRegionId/);
  assert.doesNotMatch(runtime, /export interface EpochMaintenanceInfo/);
  assert.doesNotMatch(runtime, /export interface EpochMaintenanceHealthInfo/);
});

test("runtime delegates market read model to a focused module", () => {
  assert.ok(existsSync(marketReadModelPath), "marketReadModel.ts should own market order and region market projections");
  assert.ok(existsSync(economyRuntimeReadModelPath), "economyRuntimeReadModel.ts should own runtime economy read wrappers");
  const runtime = readFileSync(runtimePath, "utf8");
  const economyRuntimeReadModel = readFileSync(economyRuntimeReadModelPath, "utf8");
  const marketReadModel = readFileSync(marketReadModelPath, "utf8");

  assert.match(runtime, /from "\.\/marketReadModel\.ts"/);
  assert.match(runtime, /from "\.\/economyRuntimeReadModel\.ts"/);
  assert.match(economyRuntimeReadModel, /from "\.\/marketReadModel\.ts"/);
  assert.match(economyRuntimeReadModel, /export function marketInfoView/);
  assert.match(economyRuntimeReadModel, /export function directTradesInfoView/);
  assert.match(marketReadModel, /export function marketOrdersView/);
  assert.match(marketReadModel, /export function directTradesView/);
  assert.match(marketReadModel, /export function regionMarketSummaryView/);
  assert.match(marketReadModel, /export function marketRiskRestrictionsView/);
  assert.match(marketReadModel, /export interface EpochRegionMarketSummary/);
  assert.match(marketReadModel, /export interface EpochMarketInfo/);
  assert.match(marketReadModel, /export interface EpochDirectTradeInfo/);

  assert.doesNotMatch(runtime, /function marketOrdersView/);
  assert.doesNotMatch(runtime, /function directTradesView/);
  assert.doesNotMatch(runtime, /function regionMarketSummaryView/);
  assert.doesNotMatch(runtime, /function marketRiskRestrictionsView/);
  assert.doesNotMatch(runtime, /marketOrdersView\(core\.project/);
  assert.doesNotMatch(runtime, /directTradesView\(core\.project/);
  assert.doesNotMatch(runtime, /marketRiskRestrictionsView\(projection/);
  assert.doesNotMatch(runtime, /function marketOrderActivityAt/);
  assert.doesNotMatch(runtime, /export interface EpochRegionMarketSummary/);
  assert.doesNotMatch(runtime, /export interface EpochMarketInfo/);
  assert.doesNotMatch(runtime, /export interface EpochDirectTradeInfo/);
});

test("runtime delegates shop offer read model to a focused module", () => {
  assert.ok(existsSync(shopReadModelPath), "shopReadModel.ts should own public shop offer media projection");
  assert.ok(existsSync(economyRuntimeReadModelPath), "economyRuntimeReadModel.ts should own runtime shop read wrappers");
  const runtime = readFileSync(runtimePath, "utf8");
  const economyRuntimeReadModel = readFileSync(economyRuntimeReadModelPath, "utf8");
  const shopReadModel = readFileSync(shopReadModelPath, "utf8");

  assert.match(runtime, /from "\.\/economyRuntimeReadModel\.ts"/);
  assert.match(economyRuntimeReadModel, /from "\.\/shopReadModel\.ts"/);
  assert.match(economyRuntimeReadModel, /export function shopInfoView/);
  assert.match(economyRuntimeReadModel, /export interface EpochShopInfo/);
  assert.match(shopReadModel, /export interface EpochShopOfferInfo/);
  assert.match(shopReadModel, /export function shopOffersView/);

  assert.doesNotMatch(runtime, /from "\.\/shopReadModel\.ts"/);
  assert.doesNotMatch(runtime, /export interface EpochShopOfferInfo/);
  assert.doesNotMatch(runtime, /export interface EpochShopInfo/);
  assert.doesNotMatch(runtime, /function shopOffersView/);
  assert.doesNotMatch(runtime, /shopOffersView\(regionId\)/);
});

test("runtime delegates region leaderboard read model to a focused module", () => {
  assert.ok(
    existsSync(regionLeaderboardReadModelPath),
    "regionLeaderboardReadModel.ts should own region influence leaderboard projection",
  );
  const runtime = readFileSync(runtimePath, "utf8");
  const regionLeaderboardReadModel = readFileSync(regionLeaderboardReadModelPath, "utf8");

  assert.match(runtime, /from "\.\/regionLeaderboardReadModel\.ts"/);
  assert.match(regionLeaderboardReadModel, /export function regionLeaderboardView/);
  assert.match(regionLeaderboardReadModel, /export interface EpochRegionLeaderboardEntry/);

  assert.doesNotMatch(runtime, /function regionLeaderboardView/);
  assert.doesNotMatch(runtime, /function dominantLeaderboardTrustClass/);
  assert.doesNotMatch(runtime, /type MutableRegionLeaderboardEntry/);
  assert.doesNotMatch(runtime, /const TRUSTED_LEADERBOARD_TRUST_CLASSES/);
  assert.doesNotMatch(runtime, /export interface EpochRegionLeaderboardEntry/);
});

test("runtime delegates region activity read model to a focused module", () => {
  assert.ok(
    existsSync(regionActivityReadModelPath),
    "regionActivityReadModel.ts should own region activity, message, influence, and active-agent projections",
  );
  const runtime = readFileSync(runtimePath, "utf8");
  const activityRuntimeReadModel = readFileSync(activityRuntimeReadModelPath, "utf8");
  const regionActivityReadModel = readFileSync(regionActivityReadModelPath, "utf8");

  assert.match(runtime, /from "\.\/activityRuntimeReadModel\.ts"/);
  assert.match(activityRuntimeReadModel, /from "\.\/regionActivityReadModel\.ts"/);
  assert.match(activityRuntimeReadModel, /export function messagesInfoView/);
  assert.match(regionActivityReadModel, /export function regionActivitiesView/);
  assert.match(regionActivityReadModel, /export function activeAgentsView/);
  assert.match(regionActivityReadModel, /export function influenceChangesView/);
  assert.match(regionActivityReadModel, /export function messagesView/);
  assert.match(regionActivityReadModel, /export interface EpochRegionActiveAgent/);
  assert.match(regionActivityReadModel, /export interface EpochMessagesInfo/);

  assert.doesNotMatch(runtime, /function regionActivitiesView/);
  assert.doesNotMatch(runtime, /function activeAgentsView/);
  assert.doesNotMatch(runtime, /function influenceChangesView/);
  assert.doesNotMatch(runtime, /function messagesView/);
  assert.doesNotMatch(runtime, /from "\.\/regionActivityReadModel\.ts"/);
  assert.doesNotMatch(runtime, /messagesView\(core\.project/);
  assert.doesNotMatch(runtime, /export interface EpochRegionActiveAgent/);
  assert.doesNotMatch(runtime, /export interface EpochMessagesInfo/);
});

test("runtime delegates region conflict read model to a focused module", () => {
  assert.ok(
    existsSync(regionConflictReadModelPath),
    "regionConflictReadModel.ts should own raids, faction pressure, and frontline projections",
  );
  const runtime = readFileSync(runtimePath, "utf8");
  const regionConflictReadModel = readFileSync(regionConflictReadModelPath, "utf8");

  assert.match(runtime, /from "\.\/regionConflictReadModel\.ts"/);
  assert.match(regionConflictReadModel, /export function raidsView/);
  assert.match(regionConflictReadModel, /export function regionRaidHeatView/);
  assert.match(regionConflictReadModel, /export function regionRaidTargetsView/);
  assert.match(regionConflictReadModel, /export function regionFactionPressureView/);
  assert.match(regionConflictReadModel, /export function regionFrontlinesView/);
  assert.match(regionConflictReadModel, /export function tracesView/);
  assert.match(regionConflictReadModel, /export function retaliationsView/);
  assert.match(regionConflictReadModel, /export interface EpochRegionRaidHeat/);
  assert.match(regionConflictReadModel, /export interface EpochRegionFrontline/);

  assert.doesNotMatch(runtime, /function raidsView/);
  assert.doesNotMatch(runtime, /function regionRaidHeatView/);
  assert.doesNotMatch(runtime, /function regionRaidTargetsView/);
  assert.doesNotMatch(runtime, /function regionFactionPressureView/);
  assert.doesNotMatch(runtime, /function regionFrontlinesView/);
  assert.doesNotMatch(runtime, /function tracesView/);
  assert.doesNotMatch(runtime, /function retaliationsView/);
  assert.doesNotMatch(runtime, /export interface EpochRegionRaidHeat/);
  assert.doesNotMatch(runtime, /export interface EpochRegionFrontline/);
});

test("runtime delegates region media read model to a focused module", () => {
  assert.ok(existsSync(regionMediaReadModelPath), "regionMediaReadModel.ts should own public region media projection");
  const runtime = readFileSync(runtimePath, "utf8");
  const regionInfoReadModel = readFileSync(regionInfoReadModelPath, "utf8");
  const regionMediaReadModel = readFileSync(regionMediaReadModelPath, "utf8");

  assert.match(regionInfoReadModel, /from "\.\/regionMediaReadModel\.ts"/);
  assert.match(regionMediaReadModel, /export interface EpochRegionMedia/);
  assert.match(regionMediaReadModel, /export function regionMediaAsset/);

  assert.doesNotMatch(runtime, /from "\.\/regionMediaReadModel\.ts"/);
  assert.doesNotMatch(runtime, /export interface EpochRegionMedia/);
  assert.doesNotMatch(runtime, /function regionMediaAsset/);
});

test("runtime delegates region and NPC info aggregation to a focused module", () => {
  assert.ok(
    existsSync(regionInfoReadModelPath),
    "regionInfoReadModel.ts should own region and NPC public-info aggregation",
  );
  const runtime = readFileSync(runtimePath, "utf8");
  const regionInfoReadModel = readFileSync(regionInfoReadModelPath, "utf8");

  assert.match(runtime, /from "\.\/regionInfoReadModel\.ts"/);
  assert.match(regionInfoReadModel, /export function regionInfoView/);
  assert.match(regionInfoReadModel, /export function npcInfoView/);
  assert.match(regionInfoReadModel, /export function npcPublicRecord/);
  assert.match(regionInfoReadModel, /export interface EpochRegionInfo/);
  assert.match(regionInfoReadModel, /export interface EpochNpcInfo/);
  assert.match(regionInfoReadModel, /export interface EpochNpcPublicRecord/);

  assert.doesNotMatch(runtime, /function npcPublicRecord/);
  assert.doesNotMatch(runtime, /export interface EpochRegionInfo/);
  assert.doesNotMatch(runtime, /export interface EpochNpcInfo/);
  assert.doesNotMatch(runtime, /export interface EpochNpcPublicRecord/);
  assert.doesNotMatch(runtime, /regionMediaAsset\(regionId\)/);
  assert.doesNotMatch(runtime, /epochCampaignKeyArtForRegion\(regionId\)/);
  assert.doesNotMatch(runtime, /Object\.values\(projection\.npcs\).*npcPublicRecord/);
});

test("runtime delegates organization and NPC subview wrappers to a focused module", () => {
  assert.ok(
    existsSync(organizationNpcReadModelPath),
    "organizationNpcReadModel.ts should own organization and NPC subview runtime wrappers",
  );
  const runtime = readFileSync(runtimePath, "utf8");
  const organizationNpcReadModel = readFileSync(organizationNpcReadModelPath, "utf8");

  assert.match(runtime, /from "\.\/organizationNpcReadModel\.ts"/);
  assert.match(organizationNpcReadModel, /from "\.\/organizationReadModel\.ts"/);
  assert.match(organizationNpcReadModel, /from "\.\/npcStateReadModel\.ts"/);
  assert.match(organizationNpcReadModel, /from "\.\/relationshipReadModel\.ts"/);
  assert.match(organizationNpcReadModel, /export function organizationInfoView/);
  assert.match(organizationNpcReadModel, /export function organizationPoliticsInfoView/);
  assert.match(organizationNpcReadModel, /export function npcCareersInfoView/);
  assert.match(organizationNpcReadModel, /export function agentNpcBondsInfoView/);
  assert.match(organizationNpcReadModel, /export interface EpochOrganizationInfo/);
  assert.match(organizationNpcReadModel, /export interface EpochAgentNpcBondInfo/);

  assert.doesNotMatch(runtime, /export interface EpochOrganizationInfo/);
  assert.doesNotMatch(runtime, /export interface EpochNpcCareerInfo/);
  assert.doesNotMatch(runtime, /export interface EpochAgentNpcBondInfo/);
  assert.doesNotMatch(runtime, /organizationsView\(core\.project/);
  assert.doesNotMatch(runtime, /npcCareersView\(core\.project/);
  assert.doesNotMatch(runtime, /agentNpcBondsView\(core\.project/);
});

test("runtime delegates region news read model to a focused module", () => {
  assert.ok(existsSync(regionNewsReadModelPath), "regionNewsReadModel.ts should own public region news media projection");
  const runtime = readFileSync(runtimePath, "utf8");
  const progressReadModel = readFileSync(progressReadModelPath, "utf8");
  const publicWorldReadModel = readFileSync(publicWorldReadModelPath, "utf8");
  const regionInfoReadModel = readFileSync(regionInfoReadModelPath, "utf8");
  const resultPageContextRules = readFileSync(resultPageContextRulesPath, "utf8");
  const regionNewsReadModel = readFileSync(regionNewsReadModelPath, "utf8");

  assert.match(progressReadModel, /from "\.\/regionNewsReadModel\.ts"/);
  assert.match(publicWorldReadModel, /from "\.\/regionNewsReadModel\.ts"/);
  assert.match(regionInfoReadModel, /from "\.\/regionNewsReadModel\.ts"/);
  assert.match(resultPageContextRules, /from "\.\/regionNewsReadModel\.ts"/);
  assert.match(regionNewsReadModel, /export interface EpochRegionNewsView/);
  assert.match(regionNewsReadModel, /export function regionNewsView/);
  assert.match(regionNewsReadModel, /export function withRegionNewsMedia/);

  assert.doesNotMatch(runtime, /from "\.\/regionNewsReadModel\.ts"/);
  assert.doesNotMatch(runtime, /export interface EpochRegionNewsView/);
  assert.doesNotMatch(runtime, /function regionNewsView/);
  assert.doesNotMatch(runtime, /function withRegionNewsMedia/);
  assert.doesNotMatch(runtime, /function worldSurfaceMedia/);
});

test("runtime delegates region news draft rules to a focused module", () => {
  assert.ok(
    existsSync(regionNewsDraftRulesPath),
    "regionNewsDraftRules.ts should own server-event region lookup and news draft projection",
  );
  const runtime = readFileSync(runtimePath, "utf8");
  const regionNewsDraftRules = readFileSync(regionNewsDraftRulesPath, "utf8");

  assert.match(regionNewsDraftRules, /export function regionNewsEventRegionId/);
  assert.match(regionNewsDraftRules, /export function regionNewsDraftForEvent/);
  assert.match(regionNewsDraftRules, /export interface EpochRegionNewsDraft/);

  assert.doesNotMatch(runtime, /from "\.\/regionNewsDraftRules\.ts"/);
  assert.doesNotMatch(runtime, /function eventRegionId/);
  assert.doesNotMatch(runtime, /function newsDraftForEvent/);
});

test("runtime delegates region news write flow to a focused module", () => {
  assert.ok(
    existsSync(regionNewsRuntimePath),
    "regionNewsRuntime.ts should own source-event news generation, dedupe, and append-to-result flow",
  );
  const runtime = readFileSync(runtimePath, "utf8");
  const regionNewsRuntime = readFileSync(regionNewsRuntimePath, "utf8");

  assert.match(runtime, /from "\.\/regionNewsRuntime\.ts"/);
  assert.match(regionNewsRuntime, /from "\.\/regionNewsDraftRules\.ts"/);
  assert.match(regionNewsRuntime, /export function createRegionNewsRuntime/);
  assert.match(regionNewsRuntime, /function generateRegionNewsForServerEvent/);
  assert.match(regionNewsRuntime, /function appendRegionNewsForServerEvent/);
  assert.match(regionNewsRuntime, /regionNewsEventRegionId/);
  assert.match(regionNewsRuntime, /regionNewsDraftForEvent/);

  assert.doesNotMatch(runtime, /function generateRegionNewsForServerEvent/);
  assert.doesNotMatch(runtime, /function appendRegionNewsForServerEvent/);
  assert.doesNotMatch(runtime, /regionNewsDraftForEvent/);
  assert.doesNotMatch(runtime, /regionNewsEventRegionId/);
});

test("runtime delegates relationship read model to a focused module", () => {
  assert.ok(
    existsSync(relationshipReadModelPath),
    "relationshipReadModel.ts should own relationship, NPC bond, and household media projections",
  );
  assert.ok(
    existsSync(socialRuntimeReadModelPath),
    "socialRuntimeReadModel.ts should own runtime relationship and diplomacy wrappers",
  );
  const runtime = readFileSync(runtimePath, "utf8");
  const socialRuntimeReadModel = readFileSync(socialRuntimeReadModelPath, "utf8");
  const relationshipReadModel = readFileSync(relationshipReadModelPath, "utf8");

  assert.match(runtime, /from "\.\/socialRuntimeReadModel\.ts"/);
  assert.match(socialRuntimeReadModel, /from "\.\/relationshipReadModel\.ts"/);
  assert.match(socialRuntimeReadModel, /export interface EpochRelationshipGraphInfo/);
  assert.match(socialRuntimeReadModel, /export function relationshipsInfoView/);
  assert.match(relationshipReadModel, /export interface EpochNpcRelationshipView/);
  assert.match(relationshipReadModel, /export interface EpochAgentNpcBondView/);
  assert.match(relationshipReadModel, /export interface EpochHouseholdView/);
  assert.match(relationshipReadModel, /export function relationshipsView/);
  assert.match(relationshipReadModel, /export function npcRelationshipsView/);
  assert.match(relationshipReadModel, /export function agentNpcBondsView/);
  assert.match(relationshipReadModel, /export function householdsView/);
  assert.match(relationshipReadModel, /export function relationshipMedia/);
  assert.match(relationshipReadModel, /export function npcDisplayName/);

  assert.doesNotMatch(runtime, /from "\.\/relationshipReadModel\.ts"/);
  assert.doesNotMatch(runtime, /export interface EpochNpcRelationshipView/);
  assert.doesNotMatch(runtime, /export interface EpochAgentNpcBondView/);
  assert.doesNotMatch(runtime, /export interface EpochHouseholdView/);
  assert.doesNotMatch(runtime, /function relationshipsView/);
  assert.doesNotMatch(runtime, /relationshipsView\(core\.project/);
  assert.doesNotMatch(runtime, /export interface EpochRelationshipGraphInfo/);
  assert.doesNotMatch(runtime, /function relationshipMedia/);
  assert.doesNotMatch(runtime, /function withRelationshipEdgeMedia/);
  assert.doesNotMatch(runtime, /function npcRelationshipsView/);
  assert.doesNotMatch(runtime, /function withNpcRelationshipMedia/);
  assert.doesNotMatch(runtime, /function agentNpcBondsView/);
  assert.doesNotMatch(runtime, /function withAgentNpcBondMedia/);
  assert.doesNotMatch(runtime, /function householdsView/);
  assert.doesNotMatch(runtime, /function householdMemberNames/);
  assert.doesNotMatch(runtime, /function householdSummary/);
  assert.doesNotMatch(runtime, /function withHouseholdMedia/);
  assert.doesNotMatch(runtime, /function npcDisplayName/);
});

test("runtime delegates NPC state read model to a focused module", () => {
  assert.ok(
    existsSync(npcStateReadModelPath),
    "npcStateReadModel.ts should own NPC memory, career, location, asset, health, and social hook projections",
  );
  const runtime = readFileSync(runtimePath, "utf8");
  const organizationNpcReadModel = readFileSync(organizationNpcReadModelPath, "utf8");
  const npcStateReadModel = readFileSync(npcStateReadModelPath, "utf8");

  assert.match(organizationNpcReadModel, /from "\.\/npcStateReadModel\.ts"/);
  assert.match(npcStateReadModel, /export interface EpochNpcCareerView/);
  assert.match(npcStateReadModel, /export interface EpochNpcLocationView/);
  assert.match(npcStateReadModel, /export interface EpochNpcAssetStateView/);
  assert.match(npcStateReadModel, /export interface EpochNpcHealthStateView/);
  assert.match(npcStateReadModel, /export function npcMemoriesView/);
  assert.match(npcStateReadModel, /export function npcCareersView/);
  assert.match(npcStateReadModel, /export function npcLocationsView/);
  assert.match(npcStateReadModel, /export function npcAssetsView/);
  assert.match(npcStateReadModel, /export function npcHealthView/);
  assert.match(npcStateReadModel, /export function socialHooksView/);

  assert.doesNotMatch(runtime, /from "\.\/npcStateReadModel\.ts"/);
  assert.doesNotMatch(runtime, /export interface EpochNpcCareerView/);
  assert.doesNotMatch(runtime, /export interface EpochNpcLocationView/);
  assert.doesNotMatch(runtime, /export interface EpochNpcAssetStateView/);
  assert.doesNotMatch(runtime, /export interface EpochNpcHealthStateView/);
  assert.doesNotMatch(runtime, /function npcMemoriesView/);
  assert.doesNotMatch(runtime, /function withNpcCareerSummary/);
  assert.doesNotMatch(runtime, /function withNpcLocationSummary/);
  assert.doesNotMatch(runtime, /function withNpcAssetSummary/);
  assert.doesNotMatch(runtime, /function withNpcHealthSummary/);
  assert.doesNotMatch(runtime, /function npcCareersView/);
  assert.doesNotMatch(runtime, /function npcLocationsView/);
  assert.doesNotMatch(runtime, /function npcAssetsView/);
  assert.doesNotMatch(runtime, /function npcHealthView/);
  assert.doesNotMatch(runtime, /function socialHooksView/);
});

test("runtime delegates organization read model to a focused module", () => {
  assert.ok(
    existsSync(organizationReadModelPath),
    "organizationReadModel.ts should own diplomacy, membership, organization, politics, and influence projections",
  );
  const runtime = readFileSync(runtimePath, "utf8");
  const organizationNpcReadModel = readFileSync(organizationNpcReadModelPath, "utf8");
  const socialRuntimeReadModel = readFileSync(socialRuntimeReadModelPath, "utf8");
  const organizationReadModel = readFileSync(organizationReadModelPath, "utf8");

  assert.match(organizationNpcReadModel, /from "\.\/organizationReadModel\.ts"/);
  assert.match(socialRuntimeReadModel, /from "\.\/organizationReadModel\.ts"/);
  assert.match(socialRuntimeReadModel, /export interface EpochDiplomacyInfo/);
  assert.match(socialRuntimeReadModel, /export function diplomacyInfoView/);
  assert.match(organizationReadModel, /export interface EpochOrganizationTreasuryLedgerEntry/);
  assert.match(organizationReadModel, /export interface EpochOrganizationInfluenceScore/);
  assert.match(organizationReadModel, /export interface EpochOrganizationView/);
  assert.match(organizationReadModel, /export function diplomacyView/);
  assert.match(organizationReadModel, /export function organizationMembershipsView/);
  assert.match(organizationReadModel, /export function organizationsView/);
  assert.match(organizationReadModel, /export function organizationPoliticsView/);
  assert.match(organizationReadModel, /export function organizationInfluenceScore/);

  assert.doesNotMatch(runtime, /from "\.\/organizationReadModel\.ts"/);
  assert.doesNotMatch(runtime, /export interface EpochOrganizationTreasuryLedgerEntry/);
  assert.doesNotMatch(runtime, /export interface EpochOrganizationInfluenceScore/);
  assert.doesNotMatch(runtime, /export interface EpochOrganizationView/);
  assert.doesNotMatch(runtime, /function diplomacyView/);
  assert.doesNotMatch(runtime, /diplomacyView\(core\.project/);
  assert.doesNotMatch(runtime, /export interface EpochDiplomacyInfo/);
  assert.doesNotMatch(runtime, /function organizationMembershipsView/);
  assert.doesNotMatch(runtime, /function organizationsView/);
  assert.doesNotMatch(runtime, /function organizationPoliticsView/);
  assert.doesNotMatch(runtime, /function organizationInfluenceScore/);
  assert.doesNotMatch(runtime, /const ORGANIZATION_INFLUENCE_REVIEW_THRESHOLD/);
  assert.doesNotMatch(runtime, /function isOrganizationTreasuryChangedEvent/);
});

test("runtime delegates region commission display rules to a focused module", () => {
  assert.ok(
    existsSync(regionCommissionReadModelPath),
    "regionCommissionReadModel.ts should own commission exposure, budget, prefile, and motif rules",
  );
  const runtime = readFileSync(runtimePath, "utf8");
  const regionCommissionReadModel = readFileSync(regionCommissionReadModelPath, "utf8");

  assert.match(runtime, /from "\.\/regionCommissionReadModel\.ts"/);
  assert.match(regionCommissionReadModel, /export function commissionSecretExposureTier/);
  assert.match(regionCommissionReadModel, /export function secretExposureTierCost/);
  assert.match(regionCommissionReadModel, /export function addSecretRevealBudgets/);
  assert.match(regionCommissionReadModel, /export function prefileIsolationForCommission/);
  assert.match(regionCommissionReadModel, /export function locationMotifBiasForMotif/);
  assert.match(regionCommissionReadModel, /export function locationMotifQuota/);
  assert.match(regionCommissionReadModel, /export function regionCommissionsView/);
  assert.match(regionCommissionReadModel, /export function locationMotifQuotasView/);
  assert.match(regionCommissionReadModel, /export const LOCATION_MOTIFS/);
  assert.match(regionCommissionReadModel, /export interface EpochRegionCommission/);
  assert.match(regionCommissionReadModel, /export interface EpochLocationMotifQuota/);

  assert.doesNotMatch(runtime, /function commissionSecretExposureTier/);
  assert.doesNotMatch(runtime, /function secretExposureTierCost/);
  assert.doesNotMatch(runtime, /const SECRET_REVEAL_CHAPTER_THRESHOLD/);
  assert.doesNotMatch(runtime, /function secretRevealChapterKey/);
  assert.doesNotMatch(runtime, /function secretRevealBudgetKey/);
  assert.doesNotMatch(runtime, /function prefileIsolationForCommission/);
  assert.doesNotMatch(runtime, /function addSecretRevealBudgets/);
  assert.doesNotMatch(runtime, /const LOCATION_MOTIF_BIAS_COPY/);
  assert.doesNotMatch(runtime, /const LOCATION_MOTIF_TIE_BREAKER/);
  assert.doesNotMatch(runtime, /function locationMotifBiasForMotif/);
  assert.doesNotMatch(runtime, /const LOCATION_MOTIF_LABELS/);
  assert.doesNotMatch(runtime, /const LOCATION_MOTIF_QUOTAS/);
  assert.doesNotMatch(runtime, /const LOCATION_MOTIF_DENSE_DISPLAY/);
  assert.doesNotMatch(runtime, /function locationMotifQuota\(/);
  assert.doesNotMatch(runtime, /function regionCommissionsView/);
  assert.doesNotMatch(runtime, /function locationMotifQuotasView/);
  assert.doesNotMatch(runtime, /export interface EpochRegionCommission/);
  assert.doesNotMatch(runtime, /export interface EpochLocationMotifQuota/);
});

test("runtime and region commissions delegate encounter read models to focused modules", () => {
  assert.ok(
    existsSync(encounterReadModelPath),
    "encounterReadModel.ts should own objective, resource-node, and anomaly projection queries",
  );
  assert.ok(
    existsSync(encounterRuntimeReadModelPath),
    "encounterRuntimeReadModel.ts should own runtime encounter read wrappers",
  );
  const runtime = readFileSync(runtimePath, "utf8");
  const encounterRuntimeReadModel = readFileSync(encounterRuntimeReadModelPath, "utf8");
  const regionCommissionReadModel = readFileSync(regionCommissionReadModelPath, "utf8");
  const encounterReadModel = readFileSync(encounterReadModelPath, "utf8");

  assert.match(runtime, /from "\.\/encounterRuntimeReadModel\.ts"/);
  assert.match(encounterRuntimeReadModel, /from "\.\/encounterReadModel\.ts"/);
  assert.match(regionCommissionReadModel, /from "\.\/encounterReadModel\.ts"/);
  assert.match(encounterRuntimeReadModel, /export function objectivesInfoView/);
  assert.match(encounterRuntimeReadModel, /export function resourceNodesInfoView/);
  assert.match(encounterRuntimeReadModel, /export function anomaliesInfoView/);
  assert.match(encounterRuntimeReadModel, /export interface EpochObjectivesInfo/);
  assert.match(encounterRuntimeReadModel, /export interface EpochResourceNodeInfo/);
  assert.match(encounterRuntimeReadModel, /export interface EpochAnomalyInfo/);
  assert.match(encounterReadModel, /export function objectivesView/);
  assert.match(encounterReadModel, /export function resourceNodesView/);
  assert.match(encounterReadModel, /export function anomaliesView/);

  assert.doesNotMatch(runtime, /from "\.\/encounterReadModel\.ts"/);
  assert.doesNotMatch(runtime, /export interface EpochResourceNodeInfo/);
  assert.doesNotMatch(runtime, /export interface EpochAnomalyInfo/);
  assert.doesNotMatch(runtime, /function objectivesView/);
  assert.doesNotMatch(runtime, /function resourceNodesView/);
  assert.doesNotMatch(runtime, /function anomaliesView/);
  assert.doesNotMatch(regionCommissionReadModel, /function objectivesView/);
  assert.doesNotMatch(regionCommissionReadModel, /function resourceNodesView/);
  assert.doesNotMatch(regionCommissionReadModel, /function anomaliesView/);
});

test("runtime and region commissions delegate bounty and party read model to a focused module", () => {
  assert.ok(
    existsSync(bountyPartyReadModelPath),
    "bountyPartyReadModel.ts should own bounty, party run, and public party run projections",
  );
  assert.ok(
    existsSync(combatRuntimeReadModelPath),
    "combatRuntimeReadModel.ts should own runtime bounty, party, and raid wrappers",
  );
  const runtime = readFileSync(runtimePath, "utf8");
  const combatRuntimeReadModel = readFileSync(combatRuntimeReadModelPath, "utf8");
  const regionCommissionReadModel = readFileSync(regionCommissionReadModelPath, "utf8");
  const bountyPartyReadModel = readFileSync(bountyPartyReadModelPath, "utf8");

  assert.match(runtime, /from "\.\/combatRuntimeReadModel\.ts"/);
  assert.match(combatRuntimeReadModel, /from "\.\/bountyPartyReadModel\.ts"/);
  assert.match(combatRuntimeReadModel, /from "\.\/regionConflictReadModel\.ts"/);
  assert.match(combatRuntimeReadModel, /export interface EpochBountyInfo/);
  assert.match(combatRuntimeReadModel, /export interface EpochPartyRunInfo/);
  assert.match(combatRuntimeReadModel, /export function bountiesInfoView/);
  assert.match(combatRuntimeReadModel, /export function partyRunsInfoView/);
  assert.match(combatRuntimeReadModel, /export function raidsInfoView/);
  assert.match(regionCommissionReadModel, /from "\.\/bountyPartyReadModel\.ts"/);
  assert.match(bountyPartyReadModel, /export function publicPartyRun/);
  assert.match(bountyPartyReadModel, /export function bountiesView/);
  assert.match(bountyPartyReadModel, /export function partyRunsView/);

  assert.doesNotMatch(runtime, /from "\.\/bountyPartyReadModel\.ts"/);
  assert.doesNotMatch(runtime, /function publicPartyRun/);
  assert.doesNotMatch(runtime, /function bountiesView/);
  assert.doesNotMatch(runtime, /function partyRunsView/);
  assert.doesNotMatch(runtime, /bountiesView\(core\.project/);
  assert.doesNotMatch(runtime, /partyRunsView\(core\.project/);
  assert.doesNotMatch(runtime, /raidsView\(core\.project/);
  assert.doesNotMatch(runtime, /export interface EpochBountyInfo/);
  assert.doesNotMatch(runtime, /export interface EpochPartyRunInfo/);
  assert.doesNotMatch(regionCommissionReadModel, /function bountiesView/);
  assert.doesNotMatch(regionCommissionReadModel, /function partyRunsView/);
});

test("runtime and region commissions delegate region monument read model to a focused module", () => {
  assert.ok(
    existsSync(regionMonumentReadModelPath),
    "regionMonumentReadModel.ts should own monument projection queries",
  );
  const runtime = readFileSync(runtimePath, "utf8");
  const regionCommissionReadModel = readFileSync(regionCommissionReadModelPath, "utf8");
  const regionInfoReadModel = readFileSync(regionInfoReadModelPath, "utf8");
  const regionMonumentReadModel = readFileSync(regionMonumentReadModelPath, "utf8");

  assert.doesNotMatch(runtime, /from "\.\/regionMonumentReadModel\.ts"/);
  assert.match(regionCommissionReadModel, /from "\.\/regionMonumentReadModel\.ts"/);
  assert.match(regionInfoReadModel, /from "\.\/regionMonumentReadModel\.ts"/);
  assert.match(regionMonumentReadModel, /export function monumentsView/);

  assert.doesNotMatch(runtime, /function monumentsView/);
  assert.doesNotMatch(regionCommissionReadModel, /function monumentsView/);
});

test("runtime delegates season read model to a focused module", () => {
  assert.ok(
    existsSync(seasonReadModelPath),
    "seasonReadModel.ts should own season campaign and contribution audit projections",
  );
  assert.ok(
    existsSync(seasonRuntimeReadModelPath),
    "seasonRuntimeReadModel.ts should own runtime season list and archive wrappers",
  );
  const runtime = readFileSync(runtimePath, "utf8");
  const seasonRuntimeReadModel = readFileSync(seasonRuntimeReadModelPath, "utf8");
  const seasonReadModel = readFileSync(seasonReadModelPath, "utf8");

  assert.match(runtime, /from "\.\/seasonRuntimeReadModel\.ts"/);
  assert.match(seasonRuntimeReadModel, /from "\.\/seasonReadModel\.ts"/);
  assert.match(seasonRuntimeReadModel, /export interface EpochSeasonCampaignInfo/);
  assert.match(seasonRuntimeReadModel, /export interface EpochSeasonArchiveInfo/);
  assert.match(seasonRuntimeReadModel, /export function seasonsInfoView/);
  assert.match(seasonRuntimeReadModel, /export function seasonArchiveInfoView/);
  assert.match(seasonRuntimeReadModel, /export function seasonRuntimeResultView/);
  assert.match(seasonReadModel, /export function seasonsView/);
  assert.match(seasonReadModel, /export function seasonCampaignView/);
  assert.match(seasonReadModel, /export function seasonContributionAuditView/);
  assert.match(seasonReadModel, /export function seasonContributionAuditGroups/);
  assert.match(seasonReadModel, /export function seasonContributionDailyTotals/);
  assert.match(seasonReadModel, /export interface EpochSeasonCampaignView/);
  assert.match(seasonReadModel, /export interface EpochSeasonContributionAudit/);

  assert.doesNotMatch(runtime, /from "\.\/seasonReadModel\.ts"/);
  assert.doesNotMatch(runtime, /function seasonsView/);
  assert.doesNotMatch(runtime, /function seasonCampaignView/);
  assert.doesNotMatch(runtime, /function seasonContributionAuditView/);
  assert.doesNotMatch(runtime, /function seasonContributionAuditGroups/);
  assert.doesNotMatch(runtime, /function seasonContributionDailyTotals/);
  assert.doesNotMatch(runtime, /seasonCampaignView\(/);
  assert.doesNotMatch(runtime, /seasonContributionAuditView\(/);
  assert.doesNotMatch(runtime, /seasonContributionAuditGroups\(/);
  assert.doesNotMatch(runtime, /seasonContributionDailyTotals\(/);
  assert.doesNotMatch(runtime, /export interface EpochSeasonCampaignView/);
  assert.doesNotMatch(runtime, /export interface EpochSeasonContributionAudit/);
  assert.doesNotMatch(runtime, /export interface EpochSeasonCampaignInfo/);
  assert.doesNotMatch(runtime, /export interface EpochSeasonArchiveInfo/);
});

test("runtime delegates hosted session read model to a focused module", () => {
  assert.ok(
    existsSync(hostedSessionReadModelPath),
    "hostedSessionReadModel.ts should own hosted session list and public redaction projections",
  );
  assert.ok(
    existsSync(hostedSessionRuntimeReadModelPath),
    "hostedSessionRuntimeReadModel.ts should own runtime hosted-session list wrappers",
  );
  const runtime = readFileSync(runtimePath, "utf8");
  const hostedSessionReadModel = readFileSync(hostedSessionReadModelPath, "utf8");
  const hostedSessionRuntimeReadModel = readFileSync(hostedSessionRuntimeReadModelPath, "utf8");

  assert.match(runtime, /from "\.\/hostedSessionRuntimeReadModel\.ts"/);
  assert.match(hostedSessionRuntimeReadModel, /from "\.\/hostedSessionReadModel\.ts"/);
  assert.match(hostedSessionRuntimeReadModel, /from "\.\/publicWorldReadModel\.ts"/);
  assert.match(hostedSessionRuntimeReadModel, /from "\.\/runtimeInputRules\.ts"/);
  assert.match(hostedSessionRuntimeReadModel, /export function hostedSessionsInfoView/);
  assert.match(hostedSessionRuntimeReadModel, /export interface EpochHostedSessionInfo/);
  assert.match(hostedSessionReadModel, /export function hostedSessionsView/);
  assert.match(hostedSessionReadModel, /export function publicHostedAction/);
  assert.match(hostedSessionReadModel, /export function publicHostedSession/);
  assert.match(hostedSessionReadModel, /export function publicHostedSessionsView/);
  assert.match(hostedSessionReadModel, /export function hostedSessionWatchActions/);
  assert.match(hostedSessionReadModel, /export interface EpochHostedSessionWatchAction/);

  assert.doesNotMatch(runtime, /import \{[^}]*publicHostedSessionsView[^}]*\} from "\.\/hostedSessionReadModel\.ts"/s);
  assert.doesNotMatch(runtime, /function hostedSessionsView/);
  assert.doesNotMatch(runtime, /function publicHostedAction/);
  assert.doesNotMatch(runtime, /function publicHostedSession/);
  assert.doesNotMatch(runtime, /function publicHostedSessionsView/);
  assert.doesNotMatch(runtime, /function hostedSessionWatchActions/);
  assert.doesNotMatch(runtime, /publicHostedSessionsView\(core\.project/);
  assert.doesNotMatch(runtime, /export interface EpochHostedSessionInfo/);
  assert.doesNotMatch(runtime, /export interface EpochHostedSessionWatchAction/);
});

test("runtime delegates public world entry read models to a focused module", () => {
  assert.ok(
    existsSync(publicWorldReadModelPath),
    "publicWorldReadModel.ts should own world overview, agent briefing, hosted watch, and lore portal projections",
  );
  const runtime = readFileSync(runtimePath, "utf8");
  const publicWorldReadModel = readFileSync(publicWorldReadModelPath, "utf8");

  assert.match(runtime, /from "\.\/publicWorldReadModel\.ts"/);
  assert.match(runtime, /createPublicWorldReadModelRuntime\(/);
  assert.match(publicWorldReadModel, /export function createPublicWorldReadModelRuntime/);
  assert.match(publicWorldReadModel, /export function worldContextVersionsForProjection/);
  assert.match(publicWorldReadModel, /export function publicReadLimit/);
  assert.match(publicWorldReadModel, /function agentBriefing/);
  assert.match(publicWorldReadModel, /function hostedSessionWatch/);
  assert.match(publicWorldReadModel, /function worldOverview/);
  assert.match(publicWorldReadModel, /function loreContributions/);
  assert.match(publicWorldReadModel, /function loreTargets/);
  assert.match(publicWorldReadModel, /export interface EpochWorldOverviewInfo/);
  assert.match(publicWorldReadModel, /export interface EpochHostedSessionWatchInfo/);
  assert.match(publicWorldReadModel, /export interface EpochAgentBriefingView/);

  assert.doesNotMatch(runtime, /const SHARED_LORE_SNAPSHOT_EVENT_TYPES/);
  assert.doesNotMatch(runtime, /function publicLimit/);
  assert.doesNotMatch(runtime, /function publicReadLimit/);
  assert.doesNotMatch(runtime, /function worldContextVersionsForProjection/);
  assert.doesNotMatch(runtime, /resultPageRegionId\(\{ input, progress \}\)/);
  assert.doesNotMatch(runtime, /hostedSessionWatchActions\(session\)/);
  assert.doesNotMatch(runtime, /buildWorldHonorBoards\(projection/);
  assert.doesNotMatch(runtime, /loreContributionCategoryFromInput/);
  assert.doesNotMatch(runtime, /loreTargetStatusFromInput/);
  assert.doesNotMatch(runtime, /export interface EpochWorldOverviewInfo/);
  assert.doesNotMatch(runtime, /export interface EpochHostedSessionWatchInfo/);
  assert.doesNotMatch(runtime, /export interface EpochAgentBriefingView/);
});

test("runtime delegates identity archive read model to a focused module", () => {
  assert.ok(
    existsSync(identityArchiveReadModelPath),
    "identityArchiveReadModel.ts should own identity archive projection",
  );
  const runtime = readFileSync(runtimePath, "utf8");
  const identityRuntimeReadModel = readFileSync(identityRuntimeReadModelPath, "utf8");
  const identityArchiveReadModel = readFileSync(identityArchiveReadModelPath, "utf8");

  assert.match(runtime, /from "\.\/identityRuntimeReadModel\.ts"/);
  assert.match(identityRuntimeReadModel, /from "\.\/identityArchiveReadModel\.ts"/);
  assert.match(identityRuntimeReadModel, /export function identityArchiveInfoView/);
  assert.match(identityArchiveReadModel, /export function identityArchiveView/);
  assert.match(identityArchiveReadModel, /export interface EpochIdentityArchiveInfo/);

  assert.doesNotMatch(runtime, /from "\.\/identityArchiveReadModel\.ts"/);
  assert.doesNotMatch(runtime, /function identityArchiveView/);
  assert.doesNotMatch(runtime, /identityArchiveView\(core\.project/);
  assert.doesNotMatch(runtime, /export interface EpochIdentityArchiveInfo/);
});

test("runtime delegates web bridge read model to a focused module", () => {
  assert.ok(
    existsSync(webBridgeReadModelPath),
    "webBridgeReadModel.ts should own web bridge prompt and turn projections",
  );
  const runtime = readFileSync(runtimePath, "utf8");
  const webBridgeReadModel = readFileSync(webBridgeReadModelPath, "utf8");

  assert.match(runtime, /from "\.\/webBridgeReadModel\.ts"/);
  assert.match(webBridgeReadModel, /export function webBridgeActionOptions/);
  assert.match(webBridgeReadModel, /export function webBridgePromptLayers/);
  assert.match(webBridgeReadModel, /export function webBridgeCopyPrompt/);
  assert.match(webBridgeReadModel, /export function webBridgeTurnView/);
  assert.match(webBridgeReadModel, /export interface EpochWebBridgeActionOption/);
  assert.match(webBridgeReadModel, /export interface EpochWebBridgeTurn/);

  assert.doesNotMatch(runtime, /function webBridgeActionOptions/);
  assert.doesNotMatch(runtime, /function webBridgePromptLayers/);
  assert.doesNotMatch(runtime, /function webBridgeCopyPrompt/);
  assert.doesNotMatch(runtime, /function webBridgeTurnView/);
  assert.doesNotMatch(runtime, /export interface EpochWebBridgeActionOption/);
  assert.doesNotMatch(runtime, /export interface EpochWebBridgeTurn/);
});

test("runtime delegates operator overview read model to a focused module", () => {
  assert.ok(
    existsSync(operatorOverviewReadModelPath),
    "operatorOverviewReadModel.ts should own operator health, growth, and overview projection",
  );
  const runtime = readFileSync(runtimePath, "utf8");
  const operatorRuntimeReadModel = readFileSync(operatorRuntimeReadModelPath, "utf8");
  const operatorOverviewReadModel = readFileSync(operatorOverviewReadModelPath, "utf8");

  assert.match(runtime, /from "\.\/operatorRuntimeReadModel\.ts"/);
  assert.match(operatorRuntimeReadModel, /from "\.\/operatorOverviewReadModel\.ts"/);
  assert.match(operatorRuntimeReadModel, /from "\.\/serverHostedRuntimeRules\.ts"/);
  assert.match(operatorRuntimeReadModel, /from "\.\/loreReadModel\.ts"/);
  assert.match(operatorRuntimeReadModel, /export function abuseProfilesInfoView/);
  assert.match(operatorRuntimeReadModel, /export function moderationInfoView/);
  assert.match(operatorRuntimeReadModel, /export function operatorOverviewInfoView/);
  assert.match(operatorOverviewReadModel, /export function operatorOverviewView/);
  assert.match(operatorOverviewReadModel, /export function operatorHealth/);
  assert.match(operatorOverviewReadModel, /export function growthQualityOverview/);
  assert.match(operatorOverviewReadModel, /export interface EpochOperatorOverview/);
  assert.match(operatorOverviewReadModel, /export interface EpochOperatorOverviewSummary/);

  assert.doesNotMatch(runtime, /function operatorOverview/);
  assert.doesNotMatch(runtime, /function operatorHealth/);
  assert.doesNotMatch(runtime, /function growthQualityOverview/);
  assert.doesNotMatch(runtime, /from "\.\/operatorOverviewReadModel\.ts"/);
  assert.doesNotMatch(runtime, /operatorOverviewView\(/);
  assert.doesNotMatch(runtime, /abuseProfilesView\(core\.project/);
  assert.doesNotMatch(runtime, /moderationView\(core\.project/);
  assert.doesNotMatch(runtime, /serverHostedJobsView\(projection/);
  assert.doesNotMatch(runtime, /loreAdjudicationOverview\(projection/);
  assert.doesNotMatch(runtime, /export interface EpochOperatorOverview/);
  assert.doesNotMatch(runtime, /export interface EpochOperatorOverviewSummary/);
});

test("runtime delegates progress read model to a focused module", () => {
  assert.ok(
    existsSync(progressReadModelPath),
    "progressReadModel.ts should own identity progress, inventory, equipment, and latest-event projection",
  );
  const runtime = readFileSync(runtimePath, "utf8");
  const activityRuntimeReadModel = readFileSync(activityRuntimeReadModelPath, "utf8");
  const economyRuntimeReadModel = readFileSync(economyRuntimeReadModelPath, "utf8");
  const progressReadModel = readFileSync(progressReadModelPath, "utf8");

  assert.match(runtime, /from "\.\/activityRuntimeReadModel\.ts"/);
  assert.match(runtime, /from "\.\/economyRuntimeReadModel\.ts"/);
  assert.match(activityRuntimeReadModel, /from "\.\/progressReadModel\.ts"/);
  assert.match(activityRuntimeReadModel, /export function eventsInfoView/);
  assert.match(activityRuntimeReadModel, /export function progressInfoView/);
  assert.match(economyRuntimeReadModel, /from "\.\/progressReadModel\.ts"/);
  assert.match(economyRuntimeReadModel, /export function inventoryInfoView/);
  assert.match(economyRuntimeReadModel, /export interface EpochInventoryInfo/);
  assert.match(progressReadModel, /export function progressView/);
  assert.match(progressReadModel, /export function inventoryItemsView/);
  assert.match(progressReadModel, /export function equipmentEffectsView/);
  assert.match(progressReadModel, /export function latestEvents/);
  assert.match(progressReadModel, /export interface EpochProgressView/);
  assert.match(progressReadModel, /export interface EpochInventoryItemInfo/);

  assert.doesNotMatch(runtime, /function progressView/);
  assert.doesNotMatch(runtime, /function inventoryItemsView/);
  assert.doesNotMatch(runtime, /function equipmentEffectsView/);
  assert.doesNotMatch(runtime, /function latestEvents/);
  assert.doesNotMatch(runtime, /from "\.\/progressReadModel\.ts"/);
  assert.doesNotMatch(runtime, /latestEvents\(core\.project/);
  assert.doesNotMatch(runtime, /progressView\(core\.project/);
  assert.doesNotMatch(runtime, /export interface EpochInventoryInfo/);
  assert.doesNotMatch(runtime, /inventoryItemsView\(core\.project/);
  assert.doesNotMatch(runtime, /export interface EpochProgressView/);
  assert.doesNotMatch(runtime, /export interface EpochInventoryItemInfo/);
});

test("runtime delegates explorer auth credential helpers to a focused module", () => {
  assert.ok(
    existsSync(runtimeAuthPath),
    "runtimeAuth.ts should own explorer recovery credential parsing and hash comparison helpers",
  );
  const runtime = readFileSync(runtimePath, "utf8");
  const runtimeAuth = readFileSync(runtimeAuthPath, "utf8");
  const explorerAuthRuntime = readFileSync(explorerAuthRuntimePath, "utf8");

  assert.match(explorerAuthRuntime, /from "\.\/runtimeAuth\.ts"/);
  assert.match(runtimeAuth, /export function explorerAuthCredentialFromInput/);
  assert.match(runtimeAuth, /export function explorerSecretHash/);
  assert.match(runtimeAuth, /export function hashValuesMatch/);
  assert.match(runtimeAuth, /export function signaturesMatch/);

  assert.doesNotMatch(runtime, /function explorerAuthCredentialFromInput/);
  assert.doesNotMatch(runtime, /function decodeExplorerRecoveryCode/);
  assert.doesNotMatch(runtime, /function explorerSecretHash/);
  assert.doesNotMatch(runtime, /function hashValuesMatch/);
  assert.doesNotMatch(runtime, /function signaturesMatch/);
});

test("runtime delegates explorer auth state to a focused module", () => {
  assert.ok(
    existsSync(explorerAuthRuntimePath),
    "explorerAuthRuntime.ts should own explorer secret hash state, hydration, auth assertions, and recovery rotation",
  );
  const runtime = readFileSync(runtimePath, "utf8");
  const explorerAuthRuntime = readFileSync(explorerAuthRuntimePath, "utf8");

  assert.match(runtime, /from "\.\/explorerAuthRuntime\.ts"/);
  assert.match(explorerAuthRuntime, /export function createExplorerAuthRuntime/);
  assert.match(explorerAuthRuntime, /const explorerSecretHashes = new Map/);
  assert.match(explorerAuthRuntime, /function hydrateEvent/);
  assert.match(explorerAuthRuntime, /function registerExplorerAuth/);
  assert.match(explorerAuthRuntime, /function assertExplorerAuth/);
  assert.match(explorerAuthRuntime, /function rotateExplorerRecovery/);
  assert.match(explorerAuthRuntime, /explorerAuthCredentialFromInput/);
  assert.match(explorerAuthRuntime, /hashValuesMatch/);

  assert.doesNotMatch(runtime, /const explorerSecretHashes = new Map/);
  assert.doesNotMatch(runtime, /function registerExplorerAuth/);
  assert.doesNotMatch(runtime, /function assertExplorerAuth/);
  assert.doesNotMatch(runtime, /function rotateExplorerRecovery/);
  assert.doesNotMatch(runtime, /explorerAuthCredentialFromInput/);
});

test("runtime delegates abuse rate-limit state to a focused module", () => {
  assert.ok(
    existsSync(runtimeAbuseRuntimePath),
    "runtimeAbuseRuntime.ts should own abuse buckets, score gates, and status projection",
  );
  const runtime = readFileSync(runtimePath, "utf8");
  const runtimeAbuseRuntime = readFileSync(runtimeAbuseRuntimePath, "utf8");

  assert.match(runtime, /from "\.\/runtimeAbuseRuntime\.ts"/);
  assert.match(runtimeAbuseRuntime, /export function createRuntimeAbuseRuntime/);
  assert.match(runtimeAbuseRuntime, /const abuseBuckets = new Map/);
  assert.match(runtimeAbuseRuntime, /function assertAllowed/);
  assert.match(runtimeAbuseRuntime, /function status/);
  assert.match(runtimeAbuseRuntime, /runtimeAbuseActorKey/);
  assert.match(runtimeAbuseRuntime, /abuseLevelForScore/);

  assert.doesNotMatch(runtime, /const abuseBuckets = new Map/);
  assert.doesNotMatch(runtime, /function assertAbuseAllowed/);
  assert.doesNotMatch(runtime, /function abuseStatus/);
  assert.doesNotMatch(runtime, /DEFAULT_ABUSE_STATE_CHANGES_PER_WINDOW/);
});

test("runtime delegates anomaly event template rules to a focused module", () => {
  assert.ok(
    existsSync(anomalyEventTemplateRulesPath),
    "anomalyEventTemplateRules.ts should own anomaly templates, boss media, template rotation, and operator input mapping",
  );
  const runtime = readFileSync(runtimePath, "utf8");
  const anomalyEventTemplateRules = readFileSync(anomalyEventTemplateRulesPath, "utf8");

  assert.match(runtime, /from "\.\/anomalyEventTemplateRules\.ts"/);
  assert.match(anomalyEventTemplateRules, /export function anomalyEventTemplateCatalog/);
  assert.match(anomalyEventTemplateRules, /export function anomalyEventInputFromTemplate/);
  assert.match(anomalyEventTemplateRules, /export function anomalyEventInputFromOperatorInput/);
  assert.match(anomalyEventTemplateRules, /export function anomalyBossTemplateKeyForSeed/);

  assert.doesNotMatch(runtime, /const ANOMALY_EVENT_TEMPLATES/);
  assert.doesNotMatch(runtime, /const MAINTENANCE_BOSS_TEMPLATE_KEYS/);
  assert.doesNotMatch(runtime, /function bossMediaAsset/);
  assert.doesNotMatch(runtime, /function anomalyEventInputFromTemplate/);
  assert.doesNotMatch(runtime, /function anomalyEventInputFromOperatorInput/);
  assert.doesNotMatch(runtime, /function anomalyTemplateKeyFromInput/);
  assert.doesNotMatch(runtime, /function anomalyBossTemplateKeyForSeed/);
  assert.doesNotMatch(runtime, /function anomalyNarrativeVariantForSeed/);
});

test("runtime delegates command context construction rules to a focused module", () => {
  assert.ok(
    existsSync(runtimeCommandContextRulesPath),
    "runtimeCommandContextRules.ts should own user, client, generic, and maintenance command context builders",
  );
  const runtime = readFileSync(runtimePath, "utf8");
  const runtimeCommandContextRules = readFileSync(runtimeCommandContextRulesPath, "utf8");

  assert.match(runtime, /from "\.\/runtimeCommandContextRules\.ts"/);
  assert.match(runtimeCommandContextRules, /export function contextFromInput/);
  assert.match(runtimeCommandContextRules, /export function untrustedClientContext/);
  assert.match(runtimeCommandContextRules, /export function maintenanceContext/);
  assert.match(runtimeCommandContextRules, /export function ownerVerifiedContextFromInput/);

  assert.doesNotMatch(runtime, /function contextFromInput/);
  assert.doesNotMatch(runtime, /function untrustedClientContext/);
  assert.doesNotMatch(runtime, /function maintenanceContext/);
  assert.doesNotMatch(runtime, /function ownerVerifiedContextFromInput/);
});

test("runtime delegates input safety and rejection audit rules to a focused module", () => {
  assert.ok(
    existsSync(runtimeInputSafetyRulesPath),
    "runtimeInputSafetyRules.ts should own public text secret guards and rejected input summaries",
  );
  const runtime = readFileSync(runtimePath, "utf8");
  const runtimeInputSafetyRules = readFileSync(runtimeInputSafetyRulesPath, "utf8");

  assert.match(runtime, /from "\.\/runtimeInputSafetyRules\.ts"/);
  assert.match(runtimeInputSafetyRules, /export const PUBLIC_TEXT_SECRET_INPUT_KEYS/);
  assert.match(runtimeInputSafetyRules, /export function assertNoRequestSecretMaterialInPublicText/);
  assert.match(runtimeInputSafetyRules, /export function summarizeRejectedInput/);

  assert.doesNotMatch(runtime, /const PUBLIC_TEXT_SECRET_INPUT_KEYS/);
  assert.doesNotMatch(runtime, /const AUDIT_REDACTED_KEYS/);
  assert.doesNotMatch(runtime, /function assertNoRequestSecretMaterialInPublicText/);
  assert.doesNotMatch(runtime, /function summarizeRejectedInput/);
});

test("runtime delegates public projection and result wrapping to a focused module", () => {
  assert.ok(
    existsSync(runtimePublicProjectionRulesPath),
    "runtimePublicProjectionRules.ts should own public event/projection redaction and command result wrapping",
  );
  const runtime = readFileSync(runtimePath, "utf8");
  const runtimePublicProjectionRules = readFileSync(runtimePublicProjectionRulesPath, "utf8");

  assert.match(runtime, /from "\.\/runtimePublicProjectionRules\.ts"/);
  assert.match(runtimePublicProjectionRules, /export function publicEpochEvent/);
  assert.match(runtimePublicProjectionRules, /export function publicProjection/);
  assert.match(runtimePublicProjectionRules, /export function publicCommandValue/);
  assert.match(runtimePublicProjectionRules, /export function commandResult/);
  assert.match(runtimePublicProjectionRules, /export function withInternalEvents/);

  assert.doesNotMatch(runtime, /function publicEpochEvent/);
  assert.doesNotMatch(runtime, /function publicProjection/);
  assert.doesNotMatch(runtime, /function isEpochPartyRunValue/);
  assert.doesNotMatch(runtime, /function publicCommandValue/);
  assert.doesNotMatch(runtime, /function commandResult/);
  assert.doesNotMatch(runtime, /function withInternalEvents/);
});

test("runtime delegates pure input normalization and template choices to a focused module", () => {
  assert.ok(
    existsSync(runtimeInputRulesPath),
    "runtimeInputRules.ts should own runtime input normalization, template choices, and abuse actor keys",
  );
  const runtime = readFileSync(runtimePath, "utf8");
  const runtimeInputRules = readFileSync(runtimeInputRulesPath, "utf8");

  assert.match(runtime, /from "\.\/runtimeInputRules\.ts"/);
  assert.match(runtimeInputRules, /export function canonicalRegionIdFromInput/);
  assert.match(runtimeInputRules, /export function hostedSessionStatusFromInput/);
  assert.match(runtimeInputRules, /export function runtimeObjectiveTemplate/);
  assert.match(runtimeInputRules, /export function runtimeSeasonTemplate/);
  assert.match(runtimeInputRules, /export function runtimeAbuseActorKey/);
  assert.match(runtimeInputRules, /EPOCH_RUNTIME_OBJECTIVE_TEMPLATES/);
  assert.match(runtimeInputRules, /EPOCH_RUNTIME_SEASON_TEMPLATES/);

  assert.doesNotMatch(runtime, /function canonicalRegionIdFromInput/);
  assert.doesNotMatch(runtime, /function hostedSessionStatusFromInput/);
  assert.doesNotMatch(runtime, /function objectiveTemplate/);
  assert.doesNotMatch(runtime, /function seasonTemplate/);
  assert.doesNotMatch(runtime, /function abuseActorKey/);
  assert.doesNotMatch(runtime, /const OBJECTIVE_TEMPLATES/);
  assert.doesNotMatch(runtime, /const SEASON_TEMPLATES/);
});

test("runtime delegates high-value confirmation rules to a focused module", () => {
  assert.ok(
    existsSync(highValueConfirmationRulesPath),
    "highValueConfirmationRules.ts should own confirmation subject hashes, summaries, and turn-card envelopes",
  );
  const runtime = readFileSync(runtimePath, "utf8");
  const highValueConfirmationRules = readFileSync(highValueConfirmationRulesPath, "utf8");

  assert.match(runtime, /from "\.\/highValueConfirmationRules\.ts"/);
  assert.match(highValueConfirmationRules, /export function highValueConfirmationSubjectHash/);
  assert.match(highValueConfirmationRules, /export function highValueConfirmationSummary/);
  assert.match(highValueConfirmationRules, /export function turnCardResponseEnvelope/);
  assert.match(highValueConfirmationRules, /export function confirmationActionForAuthScope/);

  assert.doesNotMatch(runtime, /function confirmationSubjectHash/);
  assert.doesNotMatch(runtime, /function confirmationSummary/);
  assert.doesNotMatch(runtime, /function turnCardResponseEnvelope/);
  assert.doesNotMatch(runtime, /function confirmationActionForAuthScope/);
});

test("runtime delegates high-value confirmation state machine to a focused module", () => {
  assert.ok(
    existsSync(highValueConfirmationRuntimePath),
    "highValueConfirmationRuntime.ts should own confirmation request, confirm, list, consume, and event hydration state",
  );
  const runtime = readFileSync(runtimePath, "utf8");
  const highValueConfirmationRuntime = readFileSync(highValueConfirmationRuntimePath, "utf8");

  assert.match(runtime, /from "\.\/highValueConfirmationRuntime\.ts"/);
  assert.match(highValueConfirmationRuntime, /export function createHighValueConfirmationRuntime/);
  assert.match(highValueConfirmationRuntime, /export interface EpochHighValueConfirmation/);
  assert.match(highValueConfirmationRuntime, /readonly hydrateEvent/);

  assert.doesNotMatch(runtime, /function publicConfirmation/);
  assert.doesNotMatch(runtime, /function requestedConfirmationEvent/);
  assert.doesNotMatch(runtime, /function confirmedConfirmationEvent/);
  assert.doesNotMatch(runtime, /function consumedConfirmationEvent/);
  assert.doesNotMatch(runtime, /function assertConfirmationFresh/);
  assert.doesNotMatch(runtime, /function refreshConfirmationForRead/);
  assert.doesNotMatch(runtime, /function requestHighValueConfirmation/);
  assert.doesNotMatch(runtime, /function confirmHighValueAction/);
  assert.doesNotMatch(runtime, /function listHighValueConfirmations/);
  assert.doesNotMatch(runtime, /function consumeHighValueConfirmation/);
  assert.doesNotMatch(runtime, /const confirmationRequestIdempotency/);
  assert.doesNotMatch(runtime, /const confirmationConfirmIdempotency/);
  assert.doesNotMatch(runtime, /const highValueConfirmations/);
  assert.doesNotMatch(runtime, /const confirmationIdsByTokenHash/);
});

test("runtime delegates attested runner challenge state to a focused module", () => {
  assert.ok(
    existsSync(attestationRuntimePath),
    "attestationRuntime.ts should own attested runner config, challenge issue, signature validation, and challenge state",
  );
  const runtime = readFileSync(runtimePath, "utf8");
  const attestationRuntime = readFileSync(attestationRuntimePath, "utf8");

  assert.match(runtime, /from "\.\/attestationRuntime\.ts"/);
  assert.match(attestationRuntime, /export function createAttestationRuntime/);
  assert.match(attestationRuntime, /export function attestationSignatureBase/);
  assert.match(attestationRuntime, /export function attestedRunnerKeyId/);
  assert.match(attestationRuntime, /export interface EpochAttestationChallenge/);
  assert.match(attestationRuntime, /export interface EpochAttestedRunnerConfig/);
  assert.match(attestationRuntime, /const challengeIdempotency/);
  assert.match(attestationRuntime, /const challenges/);
  assert.match(attestationRuntime, /attestationSignatureHex/);
  assert.match(attestationRuntime, /attestedRunnerSecretFingerprint/);
  assert.match(attestationRuntime, /signaturesMatch/);

  assert.doesNotMatch(runtime, /function issueAttestationChallenge/);
  assert.doesNotMatch(runtime, /function attestationSignatureBase/);
  assert.doesNotMatch(runtime, /function attestedRunnerKeyId/);
  assert.doesNotMatch(runtime, /function attestedRunnerTrustClass/);
  assert.doesNotMatch(runtime, /const attestationChallengeIdempotency/);
  assert.doesNotMatch(runtime, /const attestationChallenges/);
  assert.doesNotMatch(runtime, /const attestedRunners/);
  assert.doesNotMatch(runtime, /attestationSignatureHex/);
  assert.doesNotMatch(runtime, /attestedRunnerSecretFingerprint/);
  assert.doesNotMatch(runtime, /signaturesMatch/);
});

test("runtime delegates idempotency subject rules to a focused module", () => {
  assert.ok(
    existsSync(idempotencyRulesPath),
    "idempotencyRules.ts should own owner idempotency keys and stable subject hashes",
  );
  const runtime = readFileSync(runtimePath, "utf8");
  const runtimeIdempotencyRuntime = readFileSync(runtimeIdempotencyRuntimePath, "utf8");
  const idempotencyRules = readFileSync(idempotencyRulesPath, "utf8");

  assert.match(runtimeIdempotencyRuntime, /from "\.\/idempotencyRules\.ts"/);
  assert.match(idempotencyRules, /export function stableIdempotencySubject/);
  assert.match(idempotencyRules, /export function idempotencySubjectHash/);
  assert.match(idempotencyRules, /export function ownerIdempotencyKey/);
  assert.match(idempotencyRules, /export const IDEMPOTENCY_SUBJECT_IGNORED_FIELDS/);

  assert.doesNotMatch(runtime, /function stableIdempotencySubject/);
  assert.doesNotMatch(runtime, /function idempotencySubjectHash/);
  assert.doesNotMatch(runtime, /function ownerIdempotencyKey/);
  assert.doesNotMatch(runtime, /const IDEMPOTENCY_SUBJECT_IGNORED_FIELDS/);
});

test("runtime delegates idempotency state to a focused module", () => {
  assert.ok(
    existsSync(runtimeIdempotencyRuntimePath),
    "runtimeIdempotencyRuntime.ts should own idempotency result maps, owner records, subject records, and replay rules",
  );
  const runtime = readFileSync(runtimePath, "utf8");
  const runtimeIdempotencyRuntime = readFileSync(runtimeIdempotencyRuntimePath, "utf8");

  assert.match(runtime, /from "\.\/runtimeIdempotencyRuntime\.ts"/);
  assert.match(runtimeIdempotencyRuntime, /export function createRuntimeIdempotencyRuntime/);
  assert.match(runtimeIdempotencyRuntime, /const idempotentResults = new Map/);
  assert.match(runtimeIdempotencyRuntime, /const ownerIdempotencyRecords = new Map/);
  assert.match(runtimeIdempotencyRuntime, /const subjectIdempotencyRecords = new Map/);
  assert.match(runtimeIdempotencyRuntime, /function idempotently/);
  assert.match(runtimeIdempotencyRuntime, /function idempotentlyWithSubject/);
  assert.match(runtimeIdempotencyRuntime, /function idempotentlyForExplorerRegistration/);
  assert.match(runtimeIdempotencyRuntime, /function idempotentlyAfterExplorerAuth/);

  assert.doesNotMatch(runtime, /const idempotentResults = new Map/);
  assert.doesNotMatch(runtime, /const ownerIdempotencyRecords = new Map/);
  assert.doesNotMatch(runtime, /const subjectIdempotencyRecords = new Map/);
  assert.doesNotMatch(runtime, /function idempotently/);
  assert.doesNotMatch(runtime, /function idempotentlyWithSubject/);
  assert.doesNotMatch(runtime, /function idempotentlyForExplorerRegistration/);
  assert.doesNotMatch(runtime, /function idempotentlyAfterExplorerAuth/);
});

test("runtime delegates result page runtime rules to a focused module", () => {
  assert.ok(
    existsSync(resultPageRuntimeRulesPath),
    "resultPageRuntimeRules.ts should own share URLs, owner lookup, ttl, stable hashing, and deletion summaries",
  );
  const runtime = readFileSync(runtimePath, "utf8");
  const resultPageRuntimeRules = readFileSync(resultPageRuntimeRulesPath, "utf8");
  const resultPagePayloadRules = readFileSync(resultPagePayloadRulesPath, "utf8");
  const resultPageRuntimeStore = readFileSync(resultPageRuntimeStorePath, "utf8");

  assert.match(resultPagePayloadRules, /from "\.\/resultPageRuntimeRules\.ts"/);
  assert.match(resultPageRuntimeStore, /from "\.\/resultPageRuntimeRules\.ts"/);
  assert.match(resultPageRuntimeRules, /export function stableResultPageJson/);
  assert.match(resultPageRuntimeRules, /export function resultPagePublicSafeSummary/);
  assert.match(resultPageRuntimeRules, /export function resultPagePublicPages/);
  assert.match(resultPageRuntimeRules, /export function focusedResultPageProgress/);
  assert.match(resultPageRuntimeRules, /export function resultPageRequestHash/);
  assert.match(resultPageRuntimeRules, /export function resultPageCreateIdempotencyKey/);
  assert.match(resultPageRuntimeRules, /export function resultPageRevokeIdempotencyKey/);
  assert.match(resultPageRuntimeRules, /export function resultPageDeleteIdempotencyKey/);
  assert.match(resultPageRuntimeRules, /export function resultPageActiveRecord/);
  assert.match(resultPageRuntimeRules, /export function resultPageRevokedRecord/);
  assert.match(resultPageRuntimeRules, /export function resultPageDeletedRecord/);
  assert.match(resultPageRuntimeRules, /export function resultPageIsExpired/);
  assert.match(resultPageRuntimeRules, /export function resultPageAccessResult/);
  assert.match(resultPageRuntimeRules, /export function resultPageShareTokenHash/);
  assert.match(resultPageRuntimeRules, /export function resultPagePayloadOwnerExplorerId/);
  assert.match(resultPageRuntimeRules, /export function resultPageDeletedMinimalReference/);
  assert.match(resultPageRuntimeRules, /export function resultPageDeletionSummary/);

  assert.doesNotMatch(runtime, /function stableJson/);
  assert.doesNotMatch(runtime, /function publicSafeSummaryLabel/);
  assert.doesNotMatch(runtime, /function resultPagePublicSafeSummary/);
  assert.doesNotMatch(runtime, /function resultPagePublicPages/);
  assert.doesNotMatch(runtime, /function focusedResultPageProgress/);
  assert.doesNotMatch(runtime, /function resultPageRequestHash/);
  assert.doesNotMatch(runtime, /function resultPageIdempotencyKey/);
  assert.doesNotMatch(runtime, /const revoked: EpochSharedResultPage/);
  assert.doesNotMatch(runtime, /const deleted: EpochSharedResultPage/);
  assert.doesNotMatch(runtime, /function isResultPageExpired/);
  assert.doesNotMatch(runtime, /const RESULT_PAGE_PUBLIC_SAFE_EXCLUDED_SOURCE_CLASSES/);
  assert.doesNotMatch(runtime, /function resultPageShareTokenHash/);
  assert.doesNotMatch(runtime, /function resultPageUrlPath/);
  assert.doesNotMatch(runtime, /function resultPageShareVersion/);
  assert.doesNotMatch(runtime, /function resultPagePayloadOwnerExplorerId/);
  assert.doesNotMatch(runtime, /function resultPageDeletionRequestClassification/);
  assert.doesNotMatch(runtime, /function resultPageDeletedMinimalReference/);
  assert.doesNotMatch(runtime, /function resultPageDeletionSummary/);
});

test("runtime delegates result page lifecycle state to a focused module", () => {
  assert.ok(
    existsSync(resultPageRuntimeStorePath),
    "resultPageRuntimeStore.ts should own result page publish tokens, idempotency maps, and revoke/delete state",
  );
  const runtime = readFileSync(runtimePath, "utf8");
  const resultPageRuntimeStore = readFileSync(resultPageRuntimeStorePath, "utf8");

  assert.match(runtime, /from "\.\/resultPageRuntimeStore\.ts"/);
  assert.match(resultPageRuntimeStore, /export function createResultPageRuntimeStore/);
  assert.match(resultPageRuntimeStore, /const resultPageIdempotency/);
  assert.match(resultPageRuntimeStore, /const resultPagePublishTokens/);
  assert.match(resultPageRuntimeStore, /createEpochResultPageReadModel/);
  assert.match(resultPageRuntimeStore, /randomBytes/);

  assert.doesNotMatch(runtime, /createEpochResultPageReadModel/);
  assert.doesNotMatch(runtime, /randomBytes/);
  assert.doesNotMatch(runtime, /const resultPageIdempotency/);
  assert.doesNotMatch(runtime, /const resultPageRevokeIdempotency/);
  assert.doesNotMatch(runtime, /const resultPageDeleteIdempotency/);
  assert.doesNotMatch(runtime, /const resultPagePublishTokens/);
  assert.doesNotMatch(runtime, /function existingResultPageForInput/);
  assert.doesNotMatch(runtime, /function createResultPageFromPayload/);
  assert.doesNotMatch(runtime, /function issueResultPagePublishToken/);
  assert.doesNotMatch(runtime, /function issueResultPageShareToken/);
  assert.doesNotMatch(runtime, /function authorizeResultPageRevocation/);
  assert.doesNotMatch(runtime, /function consumeResultPagePublishToken/);
  assert.doesNotMatch(runtime, /function revokeResultPage/);
  assert.doesNotMatch(runtime, /function deleteResultPage/);
  assert.doesNotMatch(runtime, /function getPublicResultPage/);
});

test("runtime delegates result page navigation rules to a focused module", () => {
  assert.ok(
    existsSync(resultPageNavigationRulesPath),
    "resultPageNavigationRules.ts should own result-page next actions, action media, commission tool mapping, and self statements",
  );
  const runtime = readFileSync(runtimePath, "utf8");
  const resultPageNavigationRules = readFileSync(resultPageNavigationRulesPath, "utf8");
  const resultPagePayloadRules = readFileSync(resultPagePayloadRulesPath, "utf8");
  const publicWorldReadModel = readFileSync(publicWorldReadModelPath, "utf8");

  assert.match(resultPagePayloadRules, /from "\.\/resultPageNavigationRules\.ts"/);
  assert.match(publicWorldReadModel, /from "\.\/resultPageNavigationRules\.ts"/);
  assert.match(resultPageNavigationRules, /export function commissionToolName/);
  assert.match(resultPageNavigationRules, /export function resultPageNextActionMedia/);
  assert.match(resultPageNavigationRules, /export function resultPageNextActions/);
  assert.match(resultPageNavigationRules, /export function agentSelfStatement/);

  assert.doesNotMatch(runtime, /from "\.\/resultPageNavigationRules\.ts"/);
  assert.doesNotMatch(runtime, /function commissionToolName/);
  assert.doesNotMatch(runtime, /function resultPageNextActionMedia/);
  assert.doesNotMatch(runtime, /function resultPageNextActions/);
  assert.doesNotMatch(runtime, /function agentSelfStatement/);
});

test("runtime delegates result page payload assembly to a focused module", () => {
  assert.ok(
    existsSync(resultPagePayloadRulesPath),
    "resultPagePayloadRules.ts should own result-page progress, focus, context, next-action, run-summary, and receipt assembly",
  );
  const runtime = readFileSync(runtimePath, "utf8");
  const resultPagePayloadRules = readFileSync(resultPagePayloadRulesPath, "utf8");

  assert.match(runtime, /from "\.\/resultPagePayloadRules\.ts"/);
  assert.match(resultPagePayloadRules, /export function buildEpochResultPagePayload/);
  assert.match(resultPagePayloadRules, /progressView/);
  assert.match(resultPagePayloadRules, /resultPageFocusTurnCard/);
  assert.match(resultPagePayloadRules, /resultPageFocusHostedSession/);
  assert.match(resultPagePayloadRules, /resultPageRegionalContext/);
  assert.match(resultPagePayloadRules, /resultPageNextActions/);
  assert.match(resultPagePayloadRules, /buildEpochResultPageRunSummary/);
  assert.match(resultPagePayloadRules, /resultPageReceipt/);

  assert.doesNotMatch(runtime, /function resultPagePayload/);
  assert.doesNotMatch(runtime, /function buildEpochResultPagePayload/);
  assert.doesNotMatch(runtime, /resultPagePublicSafeSummary/);
  assert.doesNotMatch(runtime, /focusedResultPageProgress/);
  assert.doesNotMatch(runtime, /resultPageReceipt\(/);
});

test("runtime delegates one-shot exploration write flow to a focused module", () => {
  assert.ok(
    existsSync(explorationRuntimePath),
    "explorationRuntime.ts should own one-shot multi-step exploration and result-page publication flow",
  );
  const runtime = readFileSync(runtimePath, "utf8");
  const explorationRuntime = readFileSync(explorationRuntimePath, "utf8");

  assert.match(runtime, /from "\.\/explorationRuntime\.ts"/);
  assert.match(explorationRuntime, /export function explorationStepCount/);
  assert.match(explorationRuntime, /export function explorationMandate/);
  assert.match(explorationRuntime, /export function createExplorationRuntime/);
  assert.match(explorationRuntime, /buildEpochResultPagePayload/);
  assert.match(explorationRuntime, /createResultPageFromPayload/);
  assert.match(explorationRuntime, /focusEventIds/);

  assert.doesNotMatch(runtime, /function explorationStepCount/);
  assert.doesNotMatch(runtime, /function explorationMandate/);
  assert.doesNotMatch(runtime, /function runExploration/);
  assert.doesNotMatch(runtime, /const safeOptions = .*actionOptions\.filter/);
  assert.doesNotMatch(runtime, /第 \$\{index \+ 1\} 段探索/);
});

test("runtime delegates result page receipt rules to a focused module", () => {
  assert.ok(
    existsSync(resultPageReceiptRulesPath),
    "resultPageReceiptRules.ts should own receipt focus, canonical event projection, trusted execution, and trust tier classification",
  );
  const runtime = readFileSync(runtimePath, "utf8");
  const resultPagePayloadRules = readFileSync(resultPagePayloadRulesPath, "utf8");
  const resultPageReceiptRules = readFileSync(resultPageReceiptRulesPath, "utf8");

  assert.match(resultPagePayloadRules, /from "\.\/resultPageReceiptRules\.ts"/);
  assert.match(resultPageReceiptRules, /export function resultPageReceiptFocus/);
  assert.match(resultPageReceiptRules, /export function resultPageReceipt/);

  assert.doesNotMatch(runtime, /function resultPageReceiptFocus/);
  assert.doesNotMatch(runtime, /function eventMatchesResultFocus/);
  assert.doesNotMatch(runtime, /function resultPageReceiptEvents/);
  assert.doesNotMatch(runtime, /function eventByPayloadField/);
  assert.doesNotMatch(runtime, /function resultPageTrustedExecutionReceipts/);
  assert.doesNotMatch(runtime, /const verifiedResultTrustClasses/);
  assert.doesNotMatch(runtime, /const resultDeliveryTrustPriority/);
  assert.doesNotMatch(runtime, /function strongestResultDeliveryTrust/);
  assert.doesNotMatch(runtime, /function resultReceiptMode/);
  assert.doesNotMatch(runtime, /function resultReceiptTrustLabels/);
  assert.doesNotMatch(runtime, /function resultPageReceipt\(/);
});

test("runtime delegates result page context selection rules to a focused module", () => {
  assert.ok(
    existsSync(resultPageContextRulesPath),
    "resultPageContextRules.ts should own result-page focus validation, region selection, and regional context projection",
  );
  const runtime = readFileSync(runtimePath, "utf8");
  const resultPageContextRules = readFileSync(resultPageContextRulesPath, "utf8");

  assert.match(runtime, /from "\.\/resultPageContextRules\.ts"/);
  assert.match(resultPageContextRules, /export function canonicalResultPageRegionIdFromInput/);
  assert.match(resultPageContextRules, /export function latestProgressRegionId/);
  assert.match(resultPageContextRules, /export function resultPageRegionId/);
  assert.match(resultPageContextRules, /export function resultPageFocusTurnCard/);
  assert.match(resultPageContextRules, /export function resultPageFocusHostedSession/);
  assert.match(resultPageContextRules, /export function resultPageRegionalContext/);
  assert.match(resultPageContextRules, /export interface EpochResultPageRegionalContext/);

  assert.doesNotMatch(runtime, /function resultPageRegionId/);
  assert.doesNotMatch(runtime, /function latestProgressRegionId/);
  assert.doesNotMatch(runtime, /function resultPageFocusTurnCard/);
  assert.doesNotMatch(runtime, /function resultPageFocusHostedSession/);
  assert.doesNotMatch(runtime, /function resultPageRegionalContext/);
  assert.doesNotMatch(runtime, /export interface EpochResultPageRegionalContext/);
});

test("runtime delegates server-hosted job helper rules to a focused module", () => {
  assert.ok(
    existsSync(serverHostedRuntimeRulesPath),
    "serverHostedRuntimeRules.ts should own option parsing, server-hosted context, job queries, and queued-job selection",
  );
  const runtime = readFileSync(runtimePath, "utf8");
  const serverHostedRuntimeRules = readFileSync(serverHostedRuntimeRulesPath, "utf8");

  assert.match(runtime, /from "\.\/serverHostedRuntimeRules\.ts"/);
  assert.match(serverHostedRuntimeRules, /export function serverHostedContext/);
  assert.match(serverHostedRuntimeRules, /export function serverHostedOptionKey/);
  assert.match(serverHostedRuntimeRules, /export function serverHostedJobsQuery/);
  assert.match(serverHostedRuntimeRules, /export function serverHostedJobsView/);
  assert.match(serverHostedRuntimeRules, /export function selectQueuedServerHostedJob/);

  assert.doesNotMatch(runtime, /function serverHostedContext/);
  assert.doesNotMatch(runtime, /function serverHostedOptionKey/);
  assert.doesNotMatch(runtime, /function serverHostedJobsView/);
});

test("runtime delegates server-hosted write flow to a focused module", () => {
  assert.ok(
    existsSync(serverHostedRuntimePath),
    "serverHostedRuntime.ts should own server-hosted run, queue, list, and queued-job execution flows",
  );
  const runtime = readFileSync(runtimePath, "utf8");
  const serverHostedRuntime = readFileSync(serverHostedRuntimePath, "utf8");

  assert.match(runtime, /from "\.\/serverHostedRuntime\.ts"/);
  assert.match(serverHostedRuntime, /export function createServerHostedRuntime/);
  assert.match(serverHostedRuntime, /function executeAction/);
  assert.match(serverHostedRuntime, /run_server_hosted_action/);
  assert.match(serverHostedRuntime, /queue_server_hosted_action/);
  assert.match(serverHostedRuntime, /run_server_hosted_job/);
  assert.match(serverHostedRuntime, /selectQueuedServerHostedJob/);

  assert.doesNotMatch(runtime, /function executeServerHostedAction/);
  assert.doesNotMatch(runtime, /function runServerHostedAction/);
  assert.doesNotMatch(runtime, /function queueServerHostedAction/);
  assert.doesNotMatch(runtime, /function serverHostedJobs/);
  assert.doesNotMatch(runtime, /function runServerHostedJob/);
  assert.doesNotMatch(runtime, /selectQueuedServerHostedJob/);
  assert.doesNotMatch(runtime, /serverHostedJobsQuery/);
  assert.doesNotMatch(runtime, /serverHostedOptionKey/);
});

test("runtime delegates maintenance write orchestration to a focused module", () => {
  assert.ok(
    existsSync(maintenanceRuntimePath),
    "maintenanceRuntime.ts should own operator maintenance run defaults, worker sequencing, and summary assembly",
  );
  const runtime = readFileSync(runtimePath, "utf8");
  const maintenanceRuntime = readFileSync(maintenanceRuntimePath, "utf8");

  assert.match(runtime, /from "\.\/maintenanceRuntime\.ts"/);
  assert.match(runtime, /return maintenanceRuntime\.run\(input\)/);
  assert.match(maintenanceRuntime, /export function createMaintenanceRuntime/);
  assert.match(maintenanceRuntime, /export function maintenanceIdSegment/);
  assert.match(maintenanceRuntime, /run_maintenance/);
  assert.match(maintenanceRuntime, /DEFAULT_MAINTENANCE_NPC_LIMIT/);
  assert.match(maintenanceRuntime, /function boundedInteger/);
  assert.match(maintenanceRuntime, /function maintenanceResourceNodeSettlementCandidates/);
  assert.match(maintenanceRuntime, /function activeSeasonCampaignForRegion/);
  assert.match(maintenanceRuntime, /serverHostedJobsView/);
  assert.match(maintenanceRuntime, /tickNpcLifecycle/);
  assert.match(maintenanceRuntime, /decayRegionControls/);

  assert.doesNotMatch(runtime, /DEFAULT_MAINTENANCE_NPC_LIMIT/);
  assert.doesNotMatch(runtime, /function boundedInteger/);
  assert.doesNotMatch(runtime, /function maintenanceResourceNodeSettlementCandidates/);
  assert.doesNotMatch(runtime, /function activeSeasonCampaignForRegion/);
  assert.doesNotMatch(runtime, /server_hosted_job_completed/);
});

test("runtime delegates downtime write orchestration to a focused module", () => {
  assert.ok(
    existsSync(downtimeRuntimePath),
    "downtimeRuntime.ts should own downtime set, claim, and tick runtime wrappers",
  );
  const runtime = readFileSync(runtimePath, "utf8");
  const downtimeRuntime = readFileSync(downtimeRuntimePath, "utf8");

  assert.match(runtime, /from "\.\/downtimeRuntime\.ts"/);
  assert.match(runtime, /createDowntimeRuntime\(/);
  assert.match(runtime, /setDowntime: downtimeRuntime\.setDowntime/);
  assert.match(runtime, /claimDowntime: downtimeRuntime\.claimDowntime/);
  assert.match(runtime, /tickDowntime: \(input: AnyRecord = \{\}\) => \{[\s\S]*assertOperatorKey\(input\);[\s\S]*downtimeRuntime\.tickDowntime\(input\)/);
  assert.match(downtimeRuntime, /export function createDowntimeRuntime/);
  assert.match(downtimeRuntime, /set_downtime/);
  assert.match(downtimeRuntime, /claim_downtime/);
  assert.match(downtimeRuntime, /tick_downtime/);
  assert.match(downtimeRuntime, /allowRestrictedScore: true/);
  assert.match(downtimeRuntime, /ownerVerifiedContext/);
  assert.match(downtimeRuntime, /canonicalRegionIdFromInput/);

  assert.doesNotMatch(runtime, /setDowntime: \(input: AnyRecord/);
  assert.doesNotMatch(runtime, /claimDowntime: \(input: AnyRecord/);
  assert.doesNotMatch(runtime, /mode: input\.mode as EpochDowntimeMode/);
  assert.doesNotMatch(runtime, /idempotentlyAfterExplorerAuth\("set_downtime"/);
  assert.doesNotMatch(runtime, /idempotently\("tick_downtime"/);
});

test("runtime delegates NPC candidate write orchestration to a focused module", () => {
  assert.ok(
    existsSync(npcCandidateRuntimePath),
    "npcCandidateRuntime.ts should own NPC note, candidate submission, and review runtime wrappers",
  );
  const runtime = readFileSync(runtimePath, "utf8");
  const npcCandidateRuntime = readFileSync(npcCandidateRuntimePath, "utf8");

  assert.match(runtime, /from "\.\/npcCandidateRuntime\.ts"/);
  assert.match(runtime, /createNpcCandidateRuntime\(/);
  assert.match(runtime, /npcNote: npcCandidateRuntime\.npcNote/);
  assert.match(runtime, /submitNpcCandidate: npcCandidateRuntime\.submitNpcCandidate/);
  assert.match(runtime, /reviewNpcCandidate: npcCandidateRuntime\.reviewNpcCandidate/);
  assert.match(npcCandidateRuntime, /export function createNpcCandidateRuntime/);
  assert.match(npcCandidateRuntime, /npc_note/);
  assert.match(npcCandidateRuntime, /submit_npc_candidate/);
  assert.match(npcCandidateRuntime, /review_npc_candidate/);
  assert.match(npcCandidateRuntime, /allowRestrictedScore: true/);
  assert.match(npcCandidateRuntime, /resolveEpochCanonicalRegionId/);
  assert.match(npcCandidateRuntime, /ExperimentMainRuleReview/);
  assert.match(npcCandidateRuntime, /ownerVerifiedContext/);
  assert.match(npcCandidateRuntime, /idempotentlyAfterExplorerAuth/);
  assert.doesNotMatch(npcCandidateRuntime, /untrustedClientContext/);

  assert.doesNotMatch(runtime, /npcNote: \(input: AnyRecord/);
  assert.doesNotMatch(runtime, /submitNpcCandidate: \(input: AnyRecord/);
  assert.doesNotMatch(runtime, /reviewNpcCandidate: \(input: AnyRecord/);
  assert.doesNotMatch(runtime, /idempotentlyWithSubject\("npc_note"/);
  assert.doesNotMatch(runtime, /idempotentlyAfterExplorerAuth\("submit_npc_candidate"/);
  assert.doesNotMatch(runtime, /idempotently\("review_npc_candidate"/);
});

test("runtime delegates NPC lifecycle write orchestration to a focused module", () => {
  assert.ok(
    existsSync(npcLifecycleRuntimePath),
    "npcLifecycleRuntime.ts should own NPC lifecycle record and tick runtime wrappers",
  );
  const runtime = readFileSync(runtimePath, "utf8");
  const npcLifecycleRuntime = readFileSync(npcLifecycleRuntimePath, "utf8");

  assert.match(runtime, /from "\.\/npcLifecycleRuntime\.ts"/);
  assert.match(runtime, /createNpcLifecycleRuntime\(/);
  assert.match(runtime, /recordNpcLifecycle: npcLifecycleRuntime\.recordNpcLifecycle/);
  assert.match(runtime, /tickNpcLifecycle: \(input: AnyRecord = \{\}\) => \{[\s\S]*assertOperatorKey\(input\);[\s\S]*npcLifecycleRuntime\.tickNpcLifecycle\(input\)/);
  assert.match(npcLifecycleRuntime, /export function createNpcLifecycleRuntime/);
  assert.match(npcLifecycleRuntime, /record_npc_lifecycle/);
  assert.match(npcLifecycleRuntime, /tick_npc_lifecycle/);
  assert.match(npcLifecycleRuntime, /npc_lifecycle_requires_server_trust/);
  assert.match(npcLifecycleRuntime, /allowRestrictedScore: true/);
  assert.match(npcLifecycleRuntime, /canonicalRegionIdFromInput/);
  assert.match(npcLifecycleRuntime, /contextFromInput/);

  assert.doesNotMatch(runtime, /recordNpcLifecycle: \(input: AnyRecord/);
  assert.doesNotMatch(runtime, /idempotentlyWithSubject\("record_npc_lifecycle"/);
  assert.doesNotMatch(runtime, /idempotentlyWithSubject\("tick_npc_lifecycle"/);
  assert.doesNotMatch(runtime, /npc_lifecycle_requires_server_trust/);
});

test("runtime delegates source event authority and provenance rules to a focused module", () => {
  assert.ok(
    existsSync(sourceEventRulesPath),
    "sourceEventRules.ts should own source event authority and provenance helpers",
  );
  const runtime = readFileSync(runtimePath, "utf8");
  const sourceEventRules = readFileSync(sourceEventRulesPath, "utf8");

  assert.match(runtime, /from "\.\/sourceEventRules\.ts"/);
  assert.match(sourceEventRules, /export function sourceAuthorityForEvent/);
  assert.match(sourceEventRules, /export function loreSourceEventProvenance/);
  assert.match(sourceEventRules, /export function auditPageForEventId/);
  assert.match(sourceEventRules, /export function sourceEventIsNonEvidence/);

  assert.doesNotMatch(runtime, /function sourceAuthorityForEvent/);
  assert.doesNotMatch(runtime, /function loreSourceEventProvenance/);
  assert.doesNotMatch(runtime, /function sourceEventIsNonEvidence/);
  assert.doesNotMatch(runtime, /function auditPageForEventId/);
});

test("runtime delegates lore provenance fallback and evidence hash rules to a focused module", () => {
  assert.ok(
    existsSync(loreProvenanceRulesPath),
    "loreProvenanceRules.ts should own runtime lore provenance fallback and evidence hashing",
  );
  const runtime = readFileSync(runtimePath, "utf8");
  const loreProvenanceRules = readFileSync(loreProvenanceRulesPath, "utf8");
  const loreReadModel = readFileSync(loreReadModelPath, "utf8");

  assert.match(`${runtime}\n${loreReadModel}`, /from "\.\/loreProvenanceRules\.ts"/);
  assert.match(loreProvenanceRules, /export function loreContributionProvenanceForEvent/);
  assert.match(loreProvenanceRules, /export function loreTargetAdjudicationProvenanceForEvent/);
  assert.match(loreProvenanceRules, /export function loreEvidenceHash/);
  assert.match(loreProvenanceRules, /export function uniqueSortedValues/);

  assert.doesNotMatch(runtime, /function stableLoreEvidenceJson/);
  assert.doesNotMatch(runtime, /function loreEvidenceHash/);
  assert.doesNotMatch(runtime, /function loreClaimHash/);
  assert.doesNotMatch(runtime, /function uniqueSortedValues/);
  assert.doesNotMatch(runtime, /function loreContributionProvenanceForEvent/);
  assert.doesNotMatch(runtime, /function loreTargetAdjudicationProvenanceForEvent/);
});

test("runtime delegates lore target status and honor board read models to a focused module", () => {
  assert.ok(
    existsSync(loreReadModelPath),
    "loreReadModel.ts should own lore contribution, target status, worldview gate, and honor board projections",
  );
  const runtime = readFileSync(runtimePath, "utf8");
  const loreReadModel = readFileSync(loreReadModelPath, "utf8");

  assert.match(runtime, /from "\.\/loreReadModel\.ts"/);
  assert.match(loreReadModel, /export function loreContributionsView/);
  assert.match(loreReadModel, /export function loreTargetStatusesView/);
  assert.match(loreReadModel, /export function loreAdjudicationOverview/);
  assert.match(loreReadModel, /export function buildWorldHonorBoards/);
  assert.match(loreReadModel, /export interface EpochLoreTargetStatusInfo/);

  assert.doesNotMatch(runtime, /function loreContributionsView/);
  assert.doesNotMatch(runtime, /function loreTargetStatusesView/);
  assert.doesNotMatch(runtime, /function loreAdjudicationOverview/);
  assert.doesNotMatch(runtime, /function buildWorldHonorBoards/);
  assert.doesNotMatch(runtime, /const WORLD_HONOR_BOARD_SPECS/);
  assert.doesNotMatch(runtime, /export interface EpochLoreTargetStatusInfo/);
});
