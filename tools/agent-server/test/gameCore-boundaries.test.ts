import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const gameCorePath = new URL("../lib/epoch/gameCoreComposition.ts", import.meta.url);
const gameCoreCombatPath = new URL("../lib/epoch/gameCoreCombat.ts", import.meta.url);
const gameCoreJourneyPath = new URL("../lib/epoch/gameCoreJourney.ts", import.meta.url);
const gameCoreOrganizationPath = new URL("../lib/epoch/gameCoreOrganization.ts", import.meta.url);
const gameCoreTradePath = new URL("../lib/epoch/gameCoreTrade.ts", import.meta.url);
const gameCoreTurnHostedPath = new URL("../lib/epoch/gameCoreTurnHosted.ts", import.meta.url);
const downtimeRulesPath = new URL("../lib/epoch/downtimeRules.ts", import.meta.url);
const identityProjectionRulesPath = new URL("../lib/epoch/identityProjectionRules.ts", import.meta.url);
const identityAuthorizationRulesPath = new URL("../lib/epoch/identityAuthorizationRules.ts", import.meta.url);
const identityLifecycleRulesPath = new URL("../lib/epoch/identityLifecycleRules.ts", import.meta.url);
const inventoryRulesPath = new URL("../lib/epoch/inventoryRules.ts", import.meta.url);
const resourceRulesPath = new URL("../lib/epoch/resourceRules.ts", import.meta.url);
const organizationTreasuryRulesPath = new URL("../lib/epoch/organizationTreasuryRules.ts", import.meta.url);
const combatSettlementRulesPath = new URL("../lib/epoch/combatSettlementRules.ts", import.meta.url);
const eventFactoryPath = new URL("../lib/epoch/eventFactory.ts", import.meta.url);
const resourceLedgerEventsPath = new URL("../lib/epoch/resourceLedgerEvents.ts", import.meta.url);
const regionEventLedgerEventsPath = new URL("../lib/epoch/regionEventLedgerEvents.ts", import.meta.url);
const regionProjectionRulesPath = new URL("../lib/epoch/regionProjectionRules.ts", import.meta.url);
const regionActivityRulesPath = new URL("../lib/epoch/regionActivityRules.ts", import.meta.url);
const inventoryItemLedgerEventsPath = new URL("../lib/epoch/inventoryItemLedgerEvents.ts", import.meta.url);
const turnActionEnvelopeRulesPath = new URL("../lib/epoch/turnActionEnvelopeRules.ts", import.meta.url);
const turnHostedActionRulesPath = new URL("../lib/epoch/turnHostedActionRules.ts", import.meta.url);
const sourceEventRulesPath = new URL("../lib/epoch/sourceEventRules.ts", import.meta.url);
const loreProvenanceRulesPath = new URL("../lib/epoch/loreProvenanceRules.ts", import.meta.url);
const loreContributionRulesPath = new URL("../lib/epoch/loreContributionRules.ts", import.meta.url);
const moderationRiskRulesPath = new URL("../lib/epoch/moderationRiskRules.ts", import.meta.url);
const legendAwardRulesPath = new URL("../lib/epoch/legendAwardRules.ts", import.meta.url);
const npcCandidateRulesPath = new URL("../lib/epoch/npcCandidateRules.ts", import.meta.url);
const npcLifecycleRulesPath = new URL("../lib/epoch/npcLifecycleRules.ts", import.meta.url);
const agentInteractionRulesPath = new URL("../lib/epoch/agentInteractionRules.ts", import.meta.url);
const commandAbuseRulesPath = new URL("../lib/epoch/commandAbuseRules.ts", import.meta.url);
const encounterRulesPath = new URL("../lib/epoch/encounterRules.ts", import.meta.url);
const resourceNodeRulesPath = new URL("../lib/epoch/resourceNodeRules.ts", import.meta.url);
const seasonCampaignRulesPath = new URL("../lib/epoch/seasonCampaignRules.ts", import.meta.url);
const marketTradeRulesPath = new URL("../lib/epoch/marketTradeRules.ts", import.meta.url);
const directTradeRulesPath = new URL("../lib/epoch/directTradeRules.ts", import.meta.url);
const bountyRulesPath = new URL("../lib/epoch/bountyRules.ts", import.meta.url);
const serverHostedRuntimeRulesPath = new URL("../lib/epoch/serverHostedRuntimeRules.ts", import.meta.url);

test("game core delegates downtime reward and preview rules to a focused module", () => {
  assert.ok(
    existsSync(downtimeRulesPath),
    "downtimeRules.ts should own downtime reward, diary, and preview rules",
  );
  const gameCore = readFileSync(gameCorePath, "utf8");
  const downtimeRules = readFileSync(downtimeRulesPath, "utf8");

  assert.match(gameCore, /from "\.\/downtimeRules\.ts"/);
  assert.match(downtimeRules, /export const DEFAULT_MAX_DOWNTIME_SECONDS/);
  assert.match(downtimeRules, /export const DOWNTIME_DIARY_TITLES/);
  assert.match(downtimeRules, /export function normalizeDowntimeRegionId/);
  assert.match(downtimeRules, /export function downtimeRewards/);
  assert.match(downtimeRules, /export function downtimeRewardGrantPayload/);
  assert.match(downtimeRules, /export function downtimeSetPayload/);
  assert.match(downtimeRules, /export function downtimeClaimedPayload/);
  assert.match(downtimeRules, /export function downtimeTickResolvedPayload/);
  assert.match(downtimeRules, /export function planDowntimeSetEvents/);
  assert.match(downtimeRules, /export function planDowntimeClaimEvents/);
  assert.match(downtimeRules, /export function planDowntimeTickEvents/);
  assert.match(downtimeRules, /export function projectDowntimeState/);
  assert.match(downtimeRules, /export function projectDowntimeTickResult/);
  assert.match(downtimeRules, /export function downtimeDiaryPayload/);
  assert.match(downtimeRules, /export function downtimeDiaryEntry/);
  assert.match(downtimeRules, /export function downtimeTickLimit/);
  assert.match(downtimeRules, /export function selectDowntimeTickAgentIds/);
  assert.match(downtimeRules, /export function previewEpochDowntime/);
  assert.match(downtimeRules, /export interface EpochPendingDowntimePreview/);
  assert.match(downtimeRules, /export interface PreviewEpochDowntimeInput/);

  const setDowntime = gameCore.match(/function setDowntime[\s\S]*?(?=\n  function claimDowntime)/)?.[0] || "";
  const claimDowntime = gameCore.match(/function claimDowntime[\s\S]*?(?=\n  function tickDowntime)/)?.[0] || "";
  const tickDowntime = gameCore.match(/function tickDowntime[\s\S]*?(?=\n  function canonicalizeNpc)/)?.[0] || "";
  assert.ok(setDowntime, "setDowntime should stay discoverable for boundary checks");
  assert.ok(claimDowntime, "claimDowntime should stay discoverable for boundary checks");
  assert.ok(tickDowntime, "tickDowntime should stay discoverable for boundary checks");

  assert.doesNotMatch(gameCore, /const DEFAULT_MAX_DOWNTIME_SECONDS/);
  assert.doesNotMatch(gameCore, /const DOWNTIME_REWARD/);
  assert.doesNotMatch(gameCore, /const DOWNTIME_DIARY_TITLES/);
  assert.doesNotMatch(gameCore, /const DEFAULT_DOWNTIME_REGION_ID/);
  assert.doesNotMatch(gameCore, /function normalizeDowntimeRegionId/);
  assert.doesNotMatch(gameCore, /function downtimeRewards/);
  assert.match(setDowntime, /planDowntimeSetEvents/);
  assert.match(setDowntime, /projectDowntimeState/);
  assert.doesNotMatch(setDowntime, /downtimeSetPayload/);
  assert.doesNotMatch(setDowntime, /makeEvent\("downtime_set"/);
  assert.doesNotMatch(gameCore, /const claimedPayload: DowntimeClaimedPayload/);
  assert.doesNotMatch(gameCore, /const payload: DowntimeTickResolvedPayload/);
  assert.doesNotMatch(gameCore, /function downtimeDiaryPayload/);
  assert.doesNotMatch(gameCore, /const diaryEntry: EpochDowntimeDiaryEntry = \{/);
  assert.doesNotMatch(gameCore, /DOWNTIME_DIARY_TITLES\[event\.payload\.mode\]/);
  assert.doesNotMatch(gameCore, /diaryEntry\?\.summary \|\| downtimeDiaryPayload\(event\.payload\.mode/);
  assert.doesNotMatch(gameCore, /function previewEpochDowntime/);
  assert.doesNotMatch(gameCore, /export interface EpochPendingDowntimePreview/);
  assert.doesNotMatch(gameCore, /export interface PreviewEpochDowntimeInput/);
  assert.match(claimDowntime, /planDowntimeClaimEvents/);
  assert.match(claimDowntime, /projectDowntimeState/);
  assert.doesNotMatch(claimDowntime, /downtimeClaimedPayload/);
  assert.doesNotMatch(claimDowntime, /downtimeRewardGrantPayload/);
  assert.doesNotMatch(claimDowntime, /makeEvent\("downtime_claimed"/);
  assert.doesNotMatch(claimDowntime, /resourceGrantedEvent/);
  assert.doesNotMatch(claimDowntime, /resourceId: reward\.resourceId/);
  assert.doesNotMatch(claimDowntime, /balanceAfter: currentBalance\(applyEvents\(current, nextEvents\.slice\(1\)\), agentId, reward\.resourceId\) \+ reward\.amount/);
  assert.match(tickDowntime, /planDowntimeTickEvents/);
  assert.match(tickDowntime, /projectDowntimeTickResult/);
  assert.doesNotMatch(tickDowntime, /downtimeTickResolvedPayload/);
  assert.doesNotMatch(tickDowntime, /downtimeRewardGrantPayload/);
  assert.doesNotMatch(tickDowntime, /makeEvent\("downtime_tick_resolved"/);
  assert.doesNotMatch(tickDowntime, /resourceGrantedEvent/);
  assert.doesNotMatch(tickDowntime, /resourceId: reward\.resourceId/);
  assert.doesNotMatch(tickDowntime, /balanceAfter: currentBalance\(applyEvents\(current, nextEvents\.filter\(\(event\) => event\.eventType === "resource_granted"\)\), agentId, reward\.resourceId\) \+ reward\.amount/);
  assert.doesNotMatch(tickDowntime, /Object\.keys\(current\.downtime\)\.sort\(\)\.slice\(0, Math\.max\(1, Math\.min\(Number\(input\.limit \|\| 25\), 100\)\)\)/);
});

test("game core delegates identity lifecycle payload rules to a focused module", () => {
  assert.ok(
    existsSync(identityLifecycleRulesPath),
    "identityLifecycleRules.ts should own identity lifecycle and personality drift payload rules",
  );
  const gameCore = readFileSync(gameCorePath, "utf8");
  const identityLifecycleRules = readFileSync(identityLifecycleRulesPath, "utf8");
  const issueIdentity = gameCore.match(/function issueIdentity[\s\S]*?(?=\n  function rotateExplorerRecovery)/)?.[0] || "";
  const rotateExplorerRecovery = gameCore.match(/function rotateExplorerRecovery[\s\S]*?(?=\n  function reincarnationEvents)/)?.[0] || "";
  const reincarnationEvents = gameCore.match(/function reincarnationEvents[\s\S]*?(?=\n  function lifetimeAdjustmentEvents)/)?.[0] || "";
  const lifetimeAdjustmentEvents = gameCore.match(/function lifetimeAdjustmentEvents[\s\S]*?(?=\n  function proposePersonalityDriftEvent)/)?.[0] || "";
  const confirmPersonalityDrift = gameCore.match(/function confirmPersonalityDrift[\s\S]*?(?=\n  function adjustLifetime)/)?.[0] || "";
  const archiveIdentity = gameCore.match(/function archiveIdentity[\s\S]*?(?=\n  function reincarnate)/)?.[0] || "";
  const reincarnate = gameCore.match(/function reincarnate[\s\S]*?(?=\n  function recordLoreContribution)/)?.[0] || "";
  assert.ok(issueIdentity, "issueIdentity should stay discoverable for boundary checks");
  assert.ok(rotateExplorerRecovery, "rotateExplorerRecovery should stay discoverable for boundary checks");
  assert.ok(reincarnationEvents, "reincarnationEvents should stay discoverable for boundary checks");
  assert.ok(lifetimeAdjustmentEvents, "lifetimeAdjustmentEvents should stay discoverable for boundary checks");
  assert.ok(confirmPersonalityDrift, "confirmPersonalityDrift should stay discoverable for boundary checks");
  assert.ok(archiveIdentity, "archiveIdentity should stay discoverable for boundary checks");
  assert.ok(reincarnate, "reincarnate should stay discoverable for boundary checks");

  assert.match(gameCore, /from "\.\/identityLifecycleRules\.ts"/);
  assert.match(identityLifecycleRules, /export function identityIssuedPayload/);
  assert.match(identityLifecycleRules, /export function planIdentityIssueEvents/);
  assert.match(identityLifecycleRules, /export function projectIdentityIssue/);
  assert.match(identityLifecycleRules, /export function explorerRecoveryRotatedPayload/);
  assert.match(identityLifecycleRules, /export function planExplorerRecoveryRotationEvents/);
  assert.match(identityLifecycleRules, /export function projectExplorerRecoveryRotation/);
  assert.match(identityLifecycleRules, /export function lifetimeAdjustedPayload/);
  assert.match(identityLifecycleRules, /export function planLifetimeAdjustmentEvents/);
  assert.match(identityLifecycleRules, /export function identityArchivedPayload/);
  assert.match(identityLifecycleRules, /export function planIdentityArchiveEvents/);
  assert.match(identityLifecycleRules, /export function projectIdentityArchive/);
  assert.match(identityLifecycleRules, /export function reincarnationIssuedPayload/);
  assert.match(identityLifecycleRules, /export function planIdentityReincarnationEvents/);
  assert.match(identityLifecycleRules, /export function projectIdentityReincarnation/);
  assert.match(identityLifecycleRules, /export function personalityDriftProposedPayload/);
  assert.match(identityLifecycleRules, /export function planPersonalityDriftProposalEvents/);
  assert.match(identityLifecycleRules, /export function personalityDriftConfirmedPayload/);
  assert.match(identityLifecycleRules, /export function planPersonalityDriftConfirmationEvents/);
  assert.match(identityLifecycleRules, /export function projectPersonalityDriftConfirmation/);
  assert.match(identityLifecycleRules, /export function personalityDriftSourceEvent/);
  assert.match(identityLifecycleRules, /export function openPersonalityDriftForAgent/);
  assert.match(identityLifecycleRules, /export function personalityDriftCooldownActive/);
  assert.match(identityLifecycleRules, /export function anomalyPersonalityDriftTrait/);
  assert.match(identityLifecycleRules, /export function relationshipPersonalityDriftTrait/);
  assert.match(identityLifecycleRules, /export const PERSONALITY_DRIFT_COOLDOWN_SECONDS/);
  assert.match(identityLifecycleRules, /export const RELATIONSHIP_PERSONALITY_DRIFT_HOSTILITY_THRESHOLD/);

  assert.doesNotMatch(gameCore, /type PersonalityDriftProposedPayload/);
  assert.doesNotMatch(gameCore, /type PersonalityDriftConfirmedPayload/);
  assert.doesNotMatch(gameCore, /const payload: PersonalityDriftProposedPayload/);
  assert.doesNotMatch(gameCore, /const payload: PersonalityDriftConfirmedPayload/);
  assert.doesNotMatch(gameCore, /PERSONALITY_DRIFT_SOURCE_EVENT_TYPES/);
  assert.doesNotMatch(gameCore, /const PERSONALITY_DRIFT_COOLDOWN_SECONDS/);
  assert.doesNotMatch(gameCore, /RELATIONSHIP_PERSONALITY_DRIFT_HOSTILITY_THRESHOLD/);
  assert.doesNotMatch(gameCore, /function openPersonalityDriftForAgent/);
  assert.doesNotMatch(gameCore, /function personalityDriftCooldownActive/);
  assert.doesNotMatch(gameCore, /function anomalyPersonalityTrait/);
  assert.doesNotMatch(gameCore, /function relationshipPersonalityTrait/);
  assert.match(issueIdentity, /planIdentityIssueEvents/);
  assert.match(issueIdentity, /projectIdentityIssue/);
  assert.doesNotMatch(issueIdentity, /identityIssuedPayload/);
  assert.doesNotMatch(issueIdentity, /makeEvent\("identity_issued"/);
  assert.doesNotMatch(issueIdentity, /personality: \{/);
  assert.match(rotateExplorerRecovery, /planExplorerRecoveryRotationEvents/);
  assert.match(rotateExplorerRecovery, /projectExplorerRecoveryRotation/);
  assert.doesNotMatch(rotateExplorerRecovery, /explorerRecoveryRotatedPayload/);
  assert.doesNotMatch(rotateExplorerRecovery, /makeEvent\("explorer_recovery_rotated"/);
  assert.match(reincarnationEvents, /planIdentityReincarnationEvents/);
  assert.doesNotMatch(reincarnationEvents, /identityIssuedPayload/);
  assert.doesNotMatch(reincarnationEvents, /reincarnationIssuedPayload/);
  assert.doesNotMatch(reincarnationEvents, /makeEvent\("identity_issued"/);
  assert.doesNotMatch(reincarnationEvents, /makeEvent\("reincarnation_issued"/);
  assert.match(reincarnate, /projectIdentityReincarnation/);
  assert.doesNotMatch(reincarnate, /requireIdentity\(nextProjection, nextAgentId\)/);
  assert.match(lifetimeAdjustmentEvents, /planLifetimeAdjustmentEvents/);
  assert.doesNotMatch(lifetimeAdjustmentEvents, /lifetimeAdjustedPayload/);
  assert.doesNotMatch(lifetimeAdjustmentEvents, /identityArchivedPayload/);
  assert.doesNotMatch(lifetimeAdjustmentEvents, /makeEvent\("lifetime_adjusted"/);
  assert.doesNotMatch(lifetimeAdjustmentEvents, /makeEvent\("identity_archived"/);
  assert.match(confirmPersonalityDrift, /planPersonalityDriftConfirmationEvents/);
  assert.match(confirmPersonalityDrift, /projectPersonalityDriftConfirmation/);
  assert.doesNotMatch(confirmPersonalityDrift, /personalityDriftConfirmedPayload/);
  assert.doesNotMatch(confirmPersonalityDrift, /makeEvent\("personality_drift_confirmed"/);
  assert.doesNotMatch(confirmPersonalityDrift, /nextProjection\.personalityDrifts\[driftId\]/);
  assert.match(archiveIdentity, /planIdentityArchiveEvents/);
  assert.match(archiveIdentity, /projectIdentityArchive/);
  assert.doesNotMatch(archiveIdentity, /identityArchivedPayload/);
  assert.doesNotMatch(archiveIdentity, /makeEvent\("identity_archived"/);
  assert.doesNotMatch(archiveIdentity, /requireIdentity\(nextProjection, agentId\)/);
  const proposePersonalityDriftEvent = gameCore.match(/function proposePersonalityDriftEvent[\s\S]*?(?=\n  function proposeRelationshipPersonalityDriftEvent)/)?.[0] || "";
  assert.ok(proposePersonalityDriftEvent, "proposePersonalityDriftEvent should remain findable for boundary checks");
  assert.match(proposePersonalityDriftEvent, /planPersonalityDriftProposalEvents/);
  assert.doesNotMatch(proposePersonalityDriftEvent, /personalityDriftProposedPayload/);
  assert.doesNotMatch(proposePersonalityDriftEvent, /makeEvent\("personality_drift_proposed"/);
  assert.doesNotMatch(proposePersonalityDriftEvent, /current\.events\.find/);
  assert.doesNotMatch(proposePersonalityDriftEvent, /sourceEvent\.eventType/);
  assert.doesNotMatch(proposePersonalityDriftEvent, /Date\.parse\(drift\.confirmedAt/);
});

test("game core delegates identity slot projection rules to a focused module", () => {
  assert.ok(
    existsSync(identityProjectionRulesPath),
    "identityProjectionRules.ts should own identity lineage, legend, and slot projection rules",
  );
  const gameCore = readFileSync(gameCorePath, "utf8");
  const identityProjectionRules = readFileSync(identityProjectionRulesPath, "utf8");

  assert.match(gameCore, /from "\.\/identityProjectionRules\.ts"/);
  assert.match(identityProjectionRules, /export const IDENTITY_LEGEND_PER_EXTRA_SLOT/);
  assert.match(identityProjectionRules, /export const MAX_ACTIVE_IDENTITY_SLOTS/);
  assert.match(identityProjectionRules, /export interface EpochIdentitySlotState/);
  assert.match(identityProjectionRules, /export function explorerIdentityIds/);
  assert.match(identityProjectionRules, /export function explorerLegend/);
  assert.match(identityProjectionRules, /export function identitySlotsForExplorer/);
  assert.match(identityProjectionRules, /export function requireIdentitySlot/);
  assert.match(identityProjectionRules, /export function requireIdentity/);
  assert.match(identityProjectionRules, /export function requireActiveIdentity/);

  assert.doesNotMatch(gameCore, /const IDENTITY_LEGEND_PER_EXTRA_SLOT/);
  assert.doesNotMatch(gameCore, /const MAX_ACTIVE_IDENTITY_SLOTS/);
  assert.doesNotMatch(gameCore, /export interface EpochIdentitySlotState/);
  assert.doesNotMatch(gameCore, /function explorerIdentityIds/);
  assert.doesNotMatch(gameCore, /function explorerLegend/);
  assert.doesNotMatch(gameCore, /function identitySlotsForExplorer/);
  assert.doesNotMatch(gameCore, /function requireIdentitySlot/);
  assert.doesNotMatch(gameCore, /function requireIdentity/);
  assert.doesNotMatch(gameCore, /function requireActiveIdentity/);
});

test("game core delegates identity authorization rules to a focused module", () => {
  assert.ok(
    existsSync(identityAuthorizationRulesPath),
    "identityAuthorizationRules.ts should own identity owner authorization guards",
  );
  const gameCore = readFileSync(gameCorePath, "utf8");
  const identityAuthorizationRules = readFileSync(identityAuthorizationRulesPath, "utf8");

  assert.match(gameCore, /from "\.\/identityAuthorizationRules\.ts"/);
  assert.match(identityAuthorizationRules, /export const SERVER_ACTOR_OWNER_BYPASS_TRUST_CLASSES/);
  assert.match(identityAuthorizationRules, /export function assertIdentityOwner/);
  assert.match(identityAuthorizationRules, /export function assertUserVerifiedIdentityOwner/);
  assert.match(identityAuthorizationRules, /export function assertClientIdentityOwner/);
  assert.match(identityAuthorizationRules, /export function assertIdentityOwnerOrSystemWorker/);

  assert.doesNotMatch(gameCore, /const SERVER_ACTOR_OWNER_BYPASS_TRUST_CLASSES/);
  assert.doesNotMatch(gameCore, /function assertIdentityOwner/);
  assert.doesNotMatch(gameCore, /function assertUserVerifiedIdentityOwner/);
  assert.doesNotMatch(gameCore, /function assertClientIdentityOwner/);
  assert.doesNotMatch(gameCore, /function assertIdentityOwnerOrSystemWorker/);
});

test("game core delegates inventory catalog and shop rules to a focused module", () => {
  assert.ok(
    existsSync(inventoryRulesPath),
    "inventoryRules.ts should own inventory recipe, shop, equipment catalog, and item payload rules",
  );
  const gameCore = readFileSync(gameCorePath, "utf8");
  const inventoryRules = readFileSync(inventoryRulesPath, "utf8");
  const createInventoryItem = gameCore.match(/function createInventoryItem[\s\S]*?(?=\n  function craftInventoryItem)/)?.[0] || "";
  const craftInventoryItem = gameCore.match(/function craftInventoryItem[\s\S]*?(?=\n  function purchaseShopOffer)/)?.[0] || "";
  const purchaseShopOffer = gameCore.match(/function purchaseShopOffer[\s\S]*?(?=\n  function bindInventoryItem)/)?.[0] || "";
  const bindInventoryItem = gameCore.match(/function bindInventoryItem[\s\S]*?(?=\n  function createSeasonCampaign)/)?.[0] || "";

  assert.match(gameCore, /from "\.\/inventoryRules\.ts"/);
  assert.match(inventoryRules, /export interface InventoryCraftRecipe/);
  assert.match(inventoryRules, /export interface EpochShopOffer/);
  assert.match(inventoryRules, /export const INVENTORY_CRAFT_RECIPES/);
  assert.match(inventoryRules, /export const EPOCH_SHOP_OFFERS/);
  assert.match(inventoryRules, /export const INVENTORY_ITEM_EFFECTS/);
  assert.match(inventoryRules, /export function normalizeItemRarity/);
  assert.match(inventoryRules, /export function normalizeShopRegionId/);
  assert.match(inventoryRules, /export function resolveEpochShopOfferForRegion/);
  assert.match(inventoryRules, /export function epochShopOffersForRegion/);
  assert.match(inventoryRules, /export function requireCraftRecipe/);
  assert.match(inventoryRules, /export function requireShopOffer/);
  assert.match(inventoryRules, /export function requireInventoryItem/);
  assert.match(inventoryRules, /export function inventoryEquipmentBonus/);
  assert.match(inventoryRules, /export function inventoryItemCreatedPayload/);
  assert.match(inventoryRules, /export function planInventoryItemCreationEvents/);
  assert.match(inventoryRules, /export function projectInventoryItemCreation/);
  assert.match(inventoryRules, /export function planCraftInventoryItemEvents/);
  assert.match(inventoryRules, /export function projectCraftInventoryItem/);
  assert.match(inventoryRules, /export function planShopPurchaseEvents/);
  assert.match(inventoryRules, /export function projectShopPurchaseItem/);
  assert.match(inventoryRules, /export function inventoryItemBoundPayload/);
  assert.match(inventoryRules, /export function planInventoryItemBindEvents/);
  assert.match(inventoryRules, /export function projectInventoryItemBind/);

  assert.doesNotMatch(gameCore, /interface InventoryCraftRecipe/);
  assert.doesNotMatch(gameCore, /type ItemCreatedPayload/);
  assert.doesNotMatch(gameCore, /type ItemBoundPayload/);
  assert.doesNotMatch(gameCore, /export const INVENTORY_CRAFT_RECIPES/);
  assert.doesNotMatch(gameCore, /const INVENTORY_CRAFT_RECIPE_BY_ID/);
  assert.doesNotMatch(gameCore, /export const EPOCH_SHOP_OFFERS/);
  assert.doesNotMatch(gameCore, /const EPOCH_SHOP_OFFER_BY_ID/);
  assert.doesNotMatch(gameCore, /function normalizeItemRarity/);
  assert.doesNotMatch(gameCore, /function normalizeShopRegionId/);
  assert.doesNotMatch(gameCore, /export function resolveEpochShopOfferForRegion/);
  assert.doesNotMatch(gameCore, /export function epochShopOffersForRegion/);
  assert.doesNotMatch(gameCore, /export const INVENTORY_ITEM_EFFECTS/);
  assert.doesNotMatch(gameCore, /function requireCraftRecipe/);
  assert.doesNotMatch(gameCore, /function requireShopOffer/);
  assert.doesNotMatch(gameCore, /function requireInventoryItem/);
  assert.doesNotMatch(gameCore, /const payload: ItemCreatedPayload/);
  assert.doesNotMatch(gameCore, /const payload: ItemBoundPayload/);
  assert.match(createInventoryItem, /planInventoryItemCreationEvents/);
  assert.match(createInventoryItem, /projectInventoryItemCreation/);
  assert.doesNotMatch(createInventoryItem, /inventoryItemCreatedPayload/);
  assert.doesNotMatch(createInventoryItem, /itemCreatedEvent/);
  assert.doesNotMatch(createInventoryItem, /nextProjection\.inventoryItems\[itemId\]/);
  assert.match(craftInventoryItem, /planCraftInventoryItemEvents/);
  assert.match(craftInventoryItem, /projectCraftInventoryItem/);
  assert.doesNotMatch(craftInventoryItem, /resourceSpentEvents/);
  assert.doesNotMatch(craftInventoryItem, /inventoryItemCreatedPayload/);
  assert.doesNotMatch(craftInventoryItem, /itemCreatedEvent/);
  assert.doesNotMatch(craftInventoryItem, /sourceEventIds = spentEvents/);
  assert.doesNotMatch(craftInventoryItem, /nextProjection\.inventoryItems\[itemId\]/);
  assert.match(purchaseShopOffer, /planShopPurchaseEvents/);
  assert.match(purchaseShopOffer, /projectShopPurchaseItem/);
  assert.doesNotMatch(purchaseShopOffer, /resourceSpentEvents/);
  assert.doesNotMatch(purchaseShopOffer, /inventoryItemCreatedPayload/);
  assert.doesNotMatch(purchaseShopOffer, /itemCreatedEvent/);
  assert.doesNotMatch(purchaseShopOffer, /sourceEventIds = spentEvents/);
  assert.doesNotMatch(purchaseShopOffer, /nextProjection\.inventoryItems\[itemId\]/);
  assert.match(bindInventoryItem, /planInventoryItemBindEvents/);
  assert.match(bindInventoryItem, /projectInventoryItemBind/);
  assert.doesNotMatch(bindInventoryItem, /inventoryItemBoundPayload/);
  assert.doesNotMatch(bindInventoryItem, /itemBoundEvent/);
  assert.doesNotMatch(bindInventoryItem, /nextProjection\.inventoryItems\[itemId\]/);
});

test("game core delegates moderation and risk payload rules to a focused module", () => {
  assert.ok(
    existsSync(moderationRiskRulesPath),
    "moderationRiskRules.ts should own communication moderation and risk payload rules",
  );
  const gameCore = readFileSync(gameCorePath, "utf8");
  const moderationRiskRules = readFileSync(moderationRiskRulesPath, "utf8");

  assert.match(gameCore, /from "\.\/moderationRiskRules\.ts"/);
  assert.match(moderationRiskRules, /export function regionNewsGeneratedPayload/);
  assert.match(moderationRiskRules, /export function messagePostedPayload/);
  assert.match(moderationRiskRules, /export const MAX_MESSAGE_BODY_LENGTH/);
  assert.match(moderationRiskRules, /export function normalizeMessageBody/);
  assert.match(moderationRiskRules, /export function bodyPreview/);
  assert.match(moderationRiskRules, /export function moderationAssessment/);
  assert.match(moderationRiskRules, /export function moderationAssessmentForNews/);
  assert.match(moderationRiskRules, /export function planRegionNewsGenerationEvents/);
  assert.match(moderationRiskRules, /export function projectGeneratedRegionNews/);
  assert.match(moderationRiskRules, /export function planMessagePostedEvents/);
  assert.match(moderationRiskRules, /export function projectPostedMessage/);
  assert.match(moderationRiskRules, /export function requireModerationItem/);
  assert.match(moderationRiskRules, /export function moderationQueuedPayload/);
  assert.match(moderationRiskRules, /export function moderationResolvedPayload/);
  assert.match(moderationRiskRules, /export function planModerationResolvedEvents/);
  assert.match(moderationRiskRules, /export function projectModerationResolved/);
  assert.match(moderationRiskRules, /export function contentStatusForResolution/);
  assert.match(moderationRiskRules, /export function updateMessageModerationStatus/);
  assert.match(moderationRiskRules, /export function updateNewsModerationStatus/);
  assert.match(moderationRiskRules, /export function riskReviewRecordedPayload/);
  assert.match(moderationRiskRules, /export function planRiskReviewRecordedEvents/);
  assert.match(moderationRiskRules, /export function projectRiskReviewRecorded/);
  assert.match(moderationRiskRules, /export function autoEscalatedRiskReviewPlan/);
  assert.match(moderationRiskRules, /export function marketRiskRestrictionReleasedPayload/);
  assert.match(moderationRiskRules, /export function planMarketRiskRestrictionReleaseEvents/);
  assert.match(moderationRiskRules, /export function projectMarketRiskRestrictionRelease/);
  assert.match(moderationRiskRules, /export function abuseScoreReleasedPayload/);
  assert.match(moderationRiskRules, /export function planAbuseScoreReleaseEvents/);
  assert.match(moderationRiskRules, /export function projectAbuseScoreRelease/);
  assert.match(moderationRiskRules, /export function abuseDecayLimit/);
  assert.match(moderationRiskRules, /export function abuseDecayAmount/);
  assert.match(moderationRiskRules, /export function abuseDecayMinScore/);
  assert.match(moderationRiskRules, /export function selectAbuseScoreDecayTargets/);
  assert.match(moderationRiskRules, /export function abuseScoreDecayedPayload/);
  assert.match(moderationRiskRules, /export function planAbuseScoreDecayEvents/);
  assert.match(moderationRiskRules, /export function projectAbuseScoreDecays/);

  const releaseAbuseRestriction = gameCore.match(/function releaseAbuseRestriction[\s\S]*?(?=\n  function decayAbuseScores)/)?.[0] || "";
  assert.ok(releaseAbuseRestriction, "releaseAbuseRestriction should stay discoverable for boundary checks");
  const decayAbuseScores = gameCore.match(/function decayAbuseScores[\s\S]*?(?=\n  function decayRegionControls)/)?.[0] || "";
  assert.ok(decayAbuseScores, "decayAbuseScores should stay discoverable for boundary checks");
  const generateRegionNews = gameCore.match(/function generateRegionNews[\s\S]*?(?=\n  function postMessage)/)?.[0] || "";
  assert.ok(generateRegionNews, "generateRegionNews should stay discoverable for moderation boundary checks");
  assert.match(generateRegionNews, /planRegionNewsGenerationEvents/);
  assert.match(generateRegionNews, /projectGeneratedRegionNews/);
  const postMessage = gameCore.match(/function postMessage[\s\S]*?(?=\n  function resolveModerationItem)/)?.[0] || "";
  assert.ok(postMessage, "postMessage should stay discoverable for moderation boundary checks");
  assert.match(postMessage, /planMessagePostedEvents/);
  assert.match(postMessage, /projectPostedMessage/);
  const resolveModerationItem = gameCore.match(/function resolveModerationItem[\s\S]*?(?=\n  function recordRiskReview)/)?.[0] || "";
  assert.ok(resolveModerationItem, "resolveModerationItem should stay discoverable for moderation boundary checks");
  const recordRiskReview = gameCore.match(/function recordRiskReview[\s\S]*?(?=\n  function releaseMarketRiskRestriction)/)?.[0] || "";
  assert.ok(recordRiskReview, "recordRiskReview should stay discoverable for moderation boundary checks");
  const releaseMarketRiskRestriction = gameCore.match(/function releaseMarketRiskRestriction[\s\S]*?(?=\n  function releaseAbuseRestriction)/)?.[0] || "";
  assert.ok(releaseMarketRiskRestriction, "releaseMarketRiskRestriction should stay discoverable for boundary checks");
  const acceptDirectTrade = gameCore.match(/function acceptDirectTrade[\s\S]*?(?=\n  function cancelDirectTrade)/)?.[0] || "";
  assert.ok(acceptDirectTrade, "acceptDirectTrade should stay discoverable for moderation boundary checks");

  assert.doesNotMatch(gameCore, /type RegionNewsGeneratedPayload/);
  assert.doesNotMatch(gameCore, /type MessagePostedPayload/);
  assert.doesNotMatch(gameCore, /type ModerationQueuedPayload/);
  assert.doesNotMatch(gameCore, /type ModerationResolvedPayload/);
  assert.doesNotMatch(gameCore, /const MAX_MESSAGE_BODY_LENGTH/);
  assert.doesNotMatch(gameCore, /function normalizeMessageBody/);
  assert.doesNotMatch(gameCore, /function bodyPreview/);
  assert.doesNotMatch(gameCore, /function moderationAssessment/);
  assert.doesNotMatch(gameCore, /function moderationAssessmentForNews/);
  assert.doesNotMatch(generateRegionNews, /moderationAssessmentForNews/);
  assert.doesNotMatch(generateRegionNews, /regionNewsGeneratedPayload/);
  assert.doesNotMatch(generateRegionNews, /makeEvent\("region_news_generated"/);
  assert.doesNotMatch(generateRegionNews, /makeEvent\("moderation_queued"/);
  assert.doesNotMatch(generateRegionNews, /bodyPreview\(`\$\{headline\} \$\{body\}`\)/);
  assert.doesNotMatch(generateRegionNews, /nextProjection\.regionNews/);
  assert.doesNotMatch(postMessage, /moderationAssessment/);
  assert.doesNotMatch(postMessage, /messagePostedPayload/);
  assert.doesNotMatch(postMessage, /moderationQueuedPayload/);
  assert.doesNotMatch(postMessage, /makeEvent\("message_posted"/);
  assert.doesNotMatch(postMessage, /makeEvent\("moderation_queued"/);
  assert.doesNotMatch(postMessage, /bodyPreview\(body\)/);
  assert.doesNotMatch(postMessage, /message_projection_failed/);
  assert.doesNotMatch(postMessage, /nextProjection\.worldMessages/);
  assert.doesNotMatch(postMessage, /nextProjection\.regionMessages/);
  assert.match(resolveModerationItem, /planModerationResolvedEvents/);
  assert.match(resolveModerationItem, /projectModerationResolved/);
  assert.doesNotMatch(resolveModerationItem, /moderationResolvedPayload/);
  assert.doesNotMatch(resolveModerationItem, /makeEvent\("moderation_resolved"/);
  assert.doesNotMatch(resolveModerationItem, /requireModerationItem\(nextProjection/);
  assert.match(recordRiskReview, /planRiskReviewRecordedEvents/);
  assert.match(recordRiskReview, /projectRiskReviewRecorded/);
  assert.doesNotMatch(recordRiskReview, /riskReviewRecordedPayload/);
  assert.doesNotMatch(recordRiskReview, /makeEvent\("risk_review_recorded"/);
  assert.doesNotMatch(recordRiskReview, /nextProjection\.riskReviews/);
  assert.doesNotMatch(gameCore, /function requireModerationItem/);
  assert.doesNotMatch(gameCore, /type RiskReviewRecordedPayload/);
  assert.doesNotMatch(gameCore, /type MarketRiskRestrictionReleasedPayload/);
  assert.doesNotMatch(gameCore, /type AbuseScoreReleasedPayload/);
  assert.doesNotMatch(gameCore, /type AbuseScoreDecayedPayload/);
  assert.doesNotMatch(gameCore, /function contentStatusForResolution/);
  assert.doesNotMatch(gameCore, /function updateMessageModerationStatus/);
  assert.doesNotMatch(gameCore, /function updateNewsModerationStatus/);
  assert.doesNotMatch(acceptDirectTrade, /actorExplorerId: "system"/);
  assert.doesNotMatch(acceptDirectTrade, /note: "auto_escalated_repeat_direct_trade"/);
  assert.doesNotMatch(acceptDirectTrade, /operatorId: "system"/);
  assert.match(releaseMarketRiskRestriction, /planMarketRiskRestrictionReleaseEvents/);
  assert.match(releaseMarketRiskRestriction, /projectMarketRiskRestrictionRelease/);
  assert.doesNotMatch(releaseMarketRiskRestriction, /marketRiskRestrictionReleasedPayload/);
  assert.doesNotMatch(releaseMarketRiskRestriction, /makeEvent\("market_risk_restriction_released"/);
  assert.match(releaseAbuseRestriction, /planAbuseScoreReleaseEvents/);
  assert.match(releaseAbuseRestriction, /projectAbuseScoreRelease/);
  assert.doesNotMatch(releaseAbuseRestriction, /abuseScoreReleasedPayload/);
  assert.doesNotMatch(releaseAbuseRestriction, /makeEvent\("abuse_score_released"/);
  assert.doesNotMatch(decayAbuseScores, /const limit = Math\.max\(0, Math\.min\(Math\.floor\(Number\(input\.limit \?\? 0\)\), 100\)\)/);
  assert.doesNotMatch(decayAbuseScores, /const amount = Math\.max\(1, Math\.min\(Math\.floor\(Number\(input\.amount \?\? 1\)\), 10\)\)/);
  assert.doesNotMatch(decayAbuseScores, /const minScore = Math\.max\(1, Math\.floor\(Number\(input\.minScore \?\? 1\)\)\)/);
  assert.doesNotMatch(decayAbuseScores, /const decayedEvents = Object\.values\(current\.abuseScores\)/);
  assert.match(decayAbuseScores, /planAbuseScoreDecayEvents/);
  assert.match(decayAbuseScores, /projectAbuseScoreDecays/);
  assert.doesNotMatch(decayAbuseScores, /abuseScoreDecayedPayload/);
  assert.doesNotMatch(decayAbuseScores, /makeEvent\("abuse_score_decayed"/);
  assert.doesNotMatch(
    decayAbuseScores,
    /sort\(\(left, right\) => right\.score - left\.score \|\| left\.updatedAt\.localeCompare\(right\.updatedAt\) \|\| left\.actorKey\.localeCompare\(right\.actorKey\)\)/,
  );
});

test("game core delegates resource balance and grant spend payload rules to a focused module", () => {
  assert.ok(
    existsSync(resourceRulesPath),
    "resourceRules.ts should own resource balance reads and grant/spend payload rules",
  );
  const gameCore = readFileSync(gameCorePath, "utf8");
  const resourceRules = readFileSync(resourceRulesPath, "utf8");
  const grantResource = gameCore.match(/function grantResource[\s\S]*?(?=\n  function spendResource)/)?.[0] || "";
  const spendResource = gameCore.match(/function spendResource[\s\S]*?(?=\n  function recordLoreContribution)/)?.[0] || "";
  assert.ok(grantResource, "grantResource should stay discoverable for focused boundary checks");
  assert.ok(spendResource, "spendResource should stay discoverable for focused boundary checks");

  assert.match(gameCore, /from "\.\/resourceRules\.ts"/);
  assert.match(resourceRules, /export interface ResourceBalanceProjection/);
  assert.match(resourceRules, /export function copyBalance/);
  assert.match(resourceRules, /export function currentBalance/);
  assert.match(resourceRules, /export function requireResourceBalance/);
  assert.match(resourceRules, /export function resourceGrantPayload/);
  assert.match(resourceRules, /export function resourceSpendPayload/);
  assert.match(resourceRules, /export function resourceSpendPayloads/);
  assert.match(resourceRules, /export function planResourceGrantEvents/);
  assert.match(resourceRules, /export function projectResourceGrantBalance/);
  assert.match(resourceRules, /export function planResourceSpendEvents/);
  assert.match(resourceRules, /export function projectResourceSpendBalance/);

  assert.doesNotMatch(gameCore, /function currentBalance/);
  assert.doesNotMatch(gameCore, /function copyBalance/);
  assert.doesNotMatch(gameCore, /function requireResourceBalance/);
  assert.doesNotMatch(gameCore, /function resourceGrantPayload/);
  assert.doesNotMatch(gameCore, /function resourceSpendPayload/);
  assert.doesNotMatch(gameCore, /runningBalances/);
  assert.match(grantResource, /planResourceGrantEvents/);
  assert.match(grantResource, /projectResourceGrantBalance/);
  assert.doesNotMatch(grantResource, /resourceGrantPayload/);
  assert.doesNotMatch(grantResource, /resourceGrantedEvent/);
  assert.doesNotMatch(grantResource, /copyBalance\(nextProjection\.resourceBalances\[agentId\]\)/);
  assert.match(spendResource, /planResourceSpendEvents/);
  assert.match(spendResource, /projectResourceSpendBalance/);
  assert.doesNotMatch(spendResource, /resourceSpendPayload/);
  assert.doesNotMatch(spendResource, /resourceSpentEvent/);
  assert.doesNotMatch(spendResource, /copyBalance\(nextProjection\.resourceBalances\[agentId\]\)/);
});

test("game core delegates legend award payload rules to a focused module", () => {
  assert.ok(
    existsSync(legendAwardRulesPath),
    "legendAwardRules.ts should own legend award payload and resource grant ledger rules",
  );
  const gameCore = readFileSync(gameCorePath, "utf8");
  const legendAwardRules = readFileSync(legendAwardRulesPath, "utf8");

  assert.match(gameCore, /from "\.\/legendAwardRules\.ts"/);
  assert.match(legendAwardRules, /export function allRegionNews/);
  assert.match(legendAwardRules, /export function requireRegionNews/);
  assert.match(legendAwardRules, /export function legendAwardPayload/);
  assert.match(legendAwardRules, /export function legendAwardGrantPayload/);
  assert.match(legendAwardRules, /export function planLegendAwardClaimEvents/);
  assert.match(legendAwardRules, /export function projectLegendAwardClaim/);

  const claimNewsLegend = gameCore.match(/function claimNewsLegend[\s\S]*?(?=\n  function createContestedObjective)/)?.[0] || "";
  assert.ok(claimNewsLegend, "claimNewsLegend should stay discoverable for boundary checks");
  assert.match(claimNewsLegend, /planLegendAwardClaimEvents/);
  assert.match(claimNewsLegend, /projectLegendAwardClaim/);

  assert.doesNotMatch(gameCore, /type LegendAwardedPayload/);
  assert.doesNotMatch(gameCore, /function allRegionNews/);
  assert.doesNotMatch(gameCore, /function requireRegionNews/);
  assert.doesNotMatch(gameCore, /const payload: LegendAwardedPayload/);
  assert.doesNotMatch(claimNewsLegend, /legendAwardPayload/);
  assert.doesNotMatch(claimNewsLegend, /legendAwardGrantPayload/);
  assert.doesNotMatch(claimNewsLegend, /makeEvent\("legend_awarded"/);
  assert.doesNotMatch(claimNewsLegend, /const reason = `region_news:\$\{newsId\}`/);
  assert.doesNotMatch(claimNewsLegend, /Math\.max\(1, news\.legendDelta \|\| 1\)/);
  assert.doesNotMatch(claimNewsLegend, /resourceId: "legend"/);
  assert.doesNotMatch(claimNewsLegend, /balanceAfter: currentBalance\(current, agentId, "legend"\) \+ payload\.amount/);
});

test("game core delegates organization treasury and budget governance rules to a focused module", () => {
  assert.ok(
    existsSync(organizationTreasuryRulesPath),
    "organizationTreasuryRules.ts should own organization treasury catalog and budget governance rules",
  );
  const gameCore = readFileSync(gameCorePath, "utf8");
  const organizationTreasuryRules = readFileSync(organizationTreasuryRulesPath, "utf8");

  assert.match(gameCore, /from "\.\/organizationTreasuryRules\.ts"/);
  assert.match(organizationTreasuryRules, /export type EpochOrganizationUpgradeKey/);
  assert.match(organizationTreasuryRules, /export interface EpochOrganizationUpgradeCatalogEntry/);
  assert.match(organizationTreasuryRules, /export const EPOCH_ORGANIZATION_UPGRADE_CATALOG/);
  assert.match(organizationTreasuryRules, /export function currentOrganizationTreasuryBalance/);
  assert.match(organizationTreasuryRules, /export function assertOrganizationBudgetResolution/);
  assert.match(organizationTreasuryRules, /export function assertOrganizationMembershipRole/);
  assert.match(organizationTreasuryRules, /export type EpochOrganizationMembershipStatus/);
  assert.match(organizationTreasuryRules, /export function assertOrganizationMembershipStatus/);
  assert.match(organizationTreasuryRules, /export function activeAgentOrganizationMembership/);
  assert.match(organizationTreasuryRules, /export function activeOrganizationMembershipForExplorer/);
  assert.match(organizationTreasuryRules, /export function activeOrganizationUpgradeIdsForAgentSeason/);
  assert.match(organizationTreasuryRules, /export function isOrganizationGovernanceRole/);
  assert.match(organizationTreasuryRules, /export function organizationCreatedPayload/);
  assert.match(organizationTreasuryRules, /export function organizationMembershipChangedPayload/);
  assert.match(organizationTreasuryRules, /export function planOrganizationCreatedEvents/);
  assert.match(organizationTreasuryRules, /export function planOrganizationMembershipChangedEvents/);
  assert.match(organizationTreasuryRules, /export function organizationTreasuryContributionSpendPayload/);
  assert.match(organizationTreasuryRules, /export function organizationTreasuryContributionPayload/);
  assert.match(organizationTreasuryRules, /export function planOrganizationTreasuryContributionEvents/);
  assert.match(organizationTreasuryRules, /export function organizationBudgetApprovalThreshold/);
  assert.match(organizationTreasuryRules, /export function organizationBudgetRejectionThreshold/);
  assert.match(organizationTreasuryRules, /export function organizationBudgetProposedPayload/);
  assert.match(organizationTreasuryRules, /export function planOrganizationBudgetProposedEvents/);
  assert.match(organizationTreasuryRules, /export function organizationBudgetVotePayload/);
  assert.match(organizationTreasuryRules, /export function organizationBudgetTreasurySpendPayload/);
  assert.match(organizationTreasuryRules, /export function organizationBudgetResolvedPayload/);
  assert.match(organizationTreasuryRules, /export function planOrganizationBudgetResolutionEvents/);
  assert.match(organizationTreasuryRules, /export function organizationBudgetRequiresVoteRecord/);
  assert.match(organizationTreasuryRules, /export function organizationBudgetDecisionStillPending/);
  assert.match(organizationTreasuryRules, /export function organizationPoliticsTickLimit/);
  assert.match(organizationTreasuryRules, /export function selectOrganizationPoliticsTickTargets/);
  assert.match(organizationTreasuryRules, /export function organizationPoliticsTickPlan/);
  assert.match(organizationTreasuryRules, /export function organizationPoliticsKindForIndex/);
  assert.match(organizationTreasuryRules, /export function organizationPoliticsRecordedPayload/);
  assert.match(organizationTreasuryRules, /export function planOrganizationPoliticsTickEvents/);
  assert.match(organizationTreasuryRules, /export function projectOrganizationPoliticsTickResult/);
  assert.match(organizationTreasuryRules, /export function organizationUpgradeTreasurySpendPayload/);
  assert.match(organizationTreasuryRules, /export function organizationUpgradePurchasedPayload/);
  assert.match(organizationTreasuryRules, /export function planOrganizationUpgradePurchaseEvents/);
  assert.match(organizationTreasuryRules, /export function requireOrganizationUpgradeCatalogEntry/);

  const createOrganization = gameCore.match(/function createOrganization[\s\S]*?(?=\n  function updateOrganizationMembership)/)?.[0] || "";
  const updateOrganizationMembership = gameCore.match(/function updateOrganizationMembership[\s\S]*?(?=\n  function contributeOrganizationTreasury)/)?.[0] || "";
  const tickOrganizationPolitics = gameCore.match(/function tickOrganizationPolitics[\s\S]*?(?=\n  function tickDirectTradeExpiry)/)?.[0] || "";
  const proposeOrganizationBudget = gameCore.match(/function proposeOrganizationBudget[\s\S]*?(?=\n  function resolveOrganizationBudget)/)?.[0] || "";
  const resolveOrganizationBudget = gameCore.match(/function resolveOrganizationBudget[\s\S]*?(?=\n  function purchaseOrganizationUpgrade)/)?.[0] || "";
  const gameCoreOrganization = readFileSync(gameCoreOrganizationPath, "utf8");
  const purchaseOrganizationUpgrade = gameCoreOrganization.match(/function purchaseOrganizationUpgrade[\s\S]*?(?=\n  return \{)/)?.[0] || "";
  assert.ok(createOrganization, "createOrganization should stay discoverable for boundary checks");
  assert.ok(updateOrganizationMembership, "updateOrganizationMembership should stay discoverable for boundary checks");
  assert.ok(tickOrganizationPolitics, "tickOrganizationPolitics should stay discoverable for boundary checks");
  assert.ok(proposeOrganizationBudget, "proposeOrganizationBudget should stay discoverable for boundary checks");
  assert.ok(resolveOrganizationBudget, "resolveOrganizationBudget should stay discoverable for boundary checks");
  assert.ok(purchaseOrganizationUpgrade, "purchaseOrganizationUpgrade should stay discoverable for boundary checks");
  assert.match(createOrganization, /planOrganizationCreatedEvents/);
  assert.match(updateOrganizationMembership, /planOrganizationMembershipChangedEvents/);
  assert.match(tickOrganizationPolitics, /planOrganizationPoliticsTickEvents/);
  assert.match(tickOrganizationPolitics, /projectOrganizationPoliticsTickResult/);
  assert.match(proposeOrganizationBudget, /planOrganizationBudgetProposedEvents/);
  assert.match(resolveOrganizationBudget, /planOrganizationBudgetResolutionEvents/);
  assert.match(purchaseOrganizationUpgrade, /planOrganizationUpgradePurchaseEvents/);
  const contributeOrganizationTreasury = gameCore.match(/function contributeOrganizationTreasury[\s\S]*?(?=\n  function proposeOrganizationBudget)/)?.[0] || "";
  assert.ok(contributeOrganizationTreasury, "contributeOrganizationTreasury should stay discoverable for boundary checks");
  assert.match(contributeOrganizationTreasury, /planOrganizationTreasuryContributionEvents/);

  assert.doesNotMatch(gameCore, /export type EpochOrganizationUpgradeKey/);
  assert.doesNotMatch(gameCore, /export interface EpochOrganizationUpgradeCatalogEntry/);
  assert.doesNotMatch(gameCore, /export const EPOCH_ORGANIZATION_UPGRADE_CATALOG/);
  assert.doesNotMatch(gameCore, /type OrganizationBudgetProposedPayload/);
  assert.doesNotMatch(gameCore, /type OrganizationBudgetVoteRecordedPayload/);
  assert.doesNotMatch(gameCore, /type OrganizationBudgetResolvedPayload/);
  assert.doesNotMatch(gameCore, /function currentOrganizationTreasuryBalance/);
  assert.doesNotMatch(gameCore, /function assertOrganizationBudgetResolution/);
  assert.doesNotMatch(gameCore, /export type EpochOrganizationMembershipStatus/);
  assert.doesNotMatch(gameCore, /const ORGANIZATION_MEMBERSHIP_ROLES/);
  assert.doesNotMatch(gameCore, /const ORGANIZATION_GOVERNANCE_ROLES/);
  assert.doesNotMatch(gameCore, /const ORGANIZATION_POLITICS_TEMPLATES/);
  assert.doesNotMatch(gameCore, /function organizationPoliticsTemplate/);
  assert.doesNotMatch(gameCore, /function assertOrganizationMembershipRole/);
  assert.doesNotMatch(gameCore, /function assertOrganizationMembershipStatus/);
  assert.doesNotMatch(gameCore, /function activeAgentOrganizationMembership/);
  assert.doesNotMatch(gameCore, /function activeOrganizationMembershipForExplorer/);
  assert.doesNotMatch(gameCore, /function activeOrganizationUpgradeIdsForAgentSeason/);
  assert.doesNotMatch(gameCore, /function isOrganizationGovernanceRole/);
  assert.doesNotMatch(gameCore, /function organizationBudgetApprovalThreshold/);
  assert.doesNotMatch(gameCore, /function organizationBudgetRejectionThreshold/);
  assert.doesNotMatch(gameCore, /function requireOrganizationUpgradeCatalogEntry/);
  assert.doesNotMatch(gameCore, /const payload: OrganizationCreatedPayload/);
  assert.doesNotMatch(gameCore, /type OrganizationMembershipChangedPayload/);
  assert.doesNotMatch(gameCore, /const payload: OrganizationMembershipChangedPayload/);
  assert.doesNotMatch(createOrganization, /organizationCreatedPayload/);
  assert.doesNotMatch(createOrganization, /makeEvent\("organization_created"/);
  assert.doesNotMatch(updateOrganizationMembership, /organizationMembershipChangedPayload/);
  assert.doesNotMatch(updateOrganizationMembership, /makeEvent\("organization_membership_changed"/);
  assert.doesNotMatch(contributeOrganizationTreasury, /organizationTreasuryContributionSpendPayload/);
  assert.doesNotMatch(contributeOrganizationTreasury, /organizationTreasuryContributionPayload/);
  assert.doesNotMatch(contributeOrganizationTreasury, /makeEvent\("organization_treasury_changed"/);
  assert.doesNotMatch(proposeOrganizationBudget, /organizationBudgetProposedPayload/);
  assert.doesNotMatch(proposeOrganizationBudget, /makeEvent\("organization_budget_proposed"/);
  assert.doesNotMatch(resolveOrganizationBudget, /organizationBudgetVotePayload/);
  assert.doesNotMatch(resolveOrganizationBudget, /organizationBudgetTreasurySpendPayload/);
  assert.doesNotMatch(resolveOrganizationBudget, /organizationBudgetResolvedPayload/);
  assert.doesNotMatch(resolveOrganizationBudget, /makeEvent\("organization_budget_vote_recorded"/);
  assert.doesNotMatch(resolveOrganizationBudget, /makeEvent\("organization_treasury_changed"/);
  assert.doesNotMatch(resolveOrganizationBudget, /makeEvent\("organization_budget_resolved"/);
  assert.doesNotMatch(purchaseOrganizationUpgrade, /organizationUpgradeTreasurySpendPayload/);
  assert.doesNotMatch(purchaseOrganizationUpgrade, /organizationUpgradePurchasedPayload/);
  assert.doesNotMatch(purchaseOrganizationUpgrade, /makeEvent\("organization_treasury_changed"/);
  assert.doesNotMatch(purchaseOrganizationUpgrade, /makeEvent\("organization_upgrade_purchased"/);
  assert.doesNotMatch(gameCore, /const payload: OrganizationBudgetProposedPayload/);
  assert.doesNotMatch(gameCore, /const votePayload: OrganizationBudgetVoteRecordedPayload/);
  assert.doesNotMatch(gameCore, /const resolvedPayload: OrganizationBudgetResolvedPayload/);
  assert.doesNotMatch(gameCore, /const payload: OrganizationPoliticsRecordedPayload/);
  assert.doesNotMatch(
    tickOrganizationPolitics,
    /const limit = Math\.max\(1, Math\.min\(Number\(input\.limit \|\| 10\), 100\)\)/,
  );
  assert.doesNotMatch(tickOrganizationPolitics, /const regionId = input\.regionId\?\.trim\(\)/);
  assert.doesNotMatch(tickOrganizationPolitics, /const selectedOrganizations = Object\.values\(current\.organizations\)/);
  assert.doesNotMatch(
    tickOrganizationPolitics,
    /sort\(\(left, right\) => left\.organizationId\.localeCompare\(right\.organizationId\)\)/,
  );
  assert.doesNotMatch(tickOrganizationPolitics, /const memberships =/);
  assert.doesNotMatch(tickOrganizationPolitics, /const career =/);
  assert.doesNotMatch(tickOrganizationPolitics, /const sourceEventIds = uniqueValues/);
  assert.doesNotMatch(tickOrganizationPolitics, /organizationPoliticsTickPlan/);
  assert.doesNotMatch(tickOrganizationPolitics, /organizationPoliticsRecordedPayload/);
  assert.doesNotMatch(tickOrganizationPolitics, /makeEvent\("organization_politics_recorded"/);
  assert.doesNotMatch(tickOrganizationPolitics, /event\.eventType === "organization_politics_recorded"/);
  assert.doesNotMatch(tickOrganizationPolitics, /nextProjection\.organizationPolitics/);
  assert.doesNotMatch(gameCore, /const upgradePayload: OrganizationUpgradePurchasedPayload/);
  assert.doesNotMatch(gameCore, /记录一次任命/);
  assert.doesNotMatch(gameCore, /建立庇护链/);
  assert.doesNotMatch(gameCore, /出现派系摩擦/);
  assert.doesNotMatch(gameCore, /传出账册风波/);
  assert.doesNotMatch(gameCore, /调整内部章程/);
  assert.doesNotMatch(gameCore, /reason: `organization_budget:\$\{budgetId\}`/);
  assert.doesNotMatch(contributeOrganizationTreasury, /reason: `organization_treasury_contribution:\$\{organizationId\}`/);
  assert.doesNotMatch(contributeOrganizationTreasury, /balanceAfter: memberBalanceBefore - amount/);
  assert.doesNotMatch(gameCore, /reason: `organization_contribution:/);
  assert.doesNotMatch(gameCore, /reason: `organization_upgrade:/);
});

test("game core delegates party and raid settlement rules to a focused module", () => {
  assert.ok(
    existsSync(combatSettlementRulesPath),
    "combatSettlementRules.ts should own party role, raid settlement math, and raid payload rules",
  );
  const gameCore = readFileSync(gameCorePath, "utf8");
  const gameCoreCombat = readFileSync(gameCoreCombatPath, "utf8");
  const combatSettlementRules = readFileSync(combatSettlementRulesPath, "utf8");
  const createPartyRun = gameCoreCombat.match(/function createPartyRun[\s\S]*?(?=\n  function updatePartyInvite)/)?.[0] || "";
  const updatePartyInvite = gameCoreCombat.match(/function updatePartyInvite[\s\S]*?(?=\n  function joinPartyRun)/)?.[0] || "";
  const joinPartyRun = gameCoreCombat.match(/function joinPartyRun[\s\S]*?(?=\n  function requestPartyJoin)/)?.[0] || "";
  const requestPartyJoin = gameCoreCombat.match(/function requestPartyJoin[\s\S]*?(?=\n  function resolvePartyJoinRequest)/)?.[0] || "";
  const resolvePartyJoinRequest = gameCoreCombat.match(/function resolvePartyJoinRequest[\s\S]*?(?=\n  function settlePartyRun)/)?.[0] || "";
  const settlePartyRun = gameCoreCombat.match(/function settlePartyRun[\s\S]*?(?=\n  function resolveRaid)/)?.[0] || "";
  const resolveRaid = gameCoreCombat.match(/function resolveRaid[\s\S]*?(?=\n  function resolveRetaliation)/)?.[0] || "";
  const resolveRetaliation = gameCoreCombat.match(/function resolveRetaliation[\s\S]*?(?=\n  function proposeDiplomacy)/)?.[0] || "";
  assert.ok(createPartyRun, "createPartyRun should stay discoverable for focused boundary checks");
  assert.ok(updatePartyInvite, "updatePartyInvite should stay discoverable for focused boundary checks");
  assert.ok(joinPartyRun, "joinPartyRun should stay discoverable for focused boundary checks");
  assert.ok(requestPartyJoin, "requestPartyJoin should stay discoverable for focused boundary checks");
  assert.ok(resolvePartyJoinRequest, "resolvePartyJoinRequest should stay discoverable for focused boundary checks");
  assert.ok(settlePartyRun, "settlePartyRun should stay discoverable for focused boundary checks");
  assert.ok(resolveRaid, "resolveRaid should stay discoverable for focused boundary checks");
  assert.ok(resolveRetaliation, "resolveRetaliation should stay discoverable for focused boundary checks");

  assert.match(gameCore, /from "\.\/combatSettlementRules\.ts"/);
  assert.match(combatSettlementRules, /export const PARTY_ROLE_SCORE/);
  assert.match(combatSettlementRules, /export const MAX_PARTY_RUN_MEMBERS/);
  assert.match(combatSettlementRules, /export const RAID_PAIR_COOLDOWN_SECONDS/);
  assert.match(combatSettlementRules, /export const RAID_PAIR_REWARD_DECAY_WINDOW_SECONDS/);
  assert.match(combatSettlementRules, /export const RAID_REGION_HEAT_REWARD_DECAY_WINDOW_SECONDS/);
  assert.match(combatSettlementRules, /export const RAID_REGION_HEAT_REWARD_DECAY_SCORE/);
  assert.match(combatSettlementRules, /export function partyRoleSynergyBonus/);
  assert.match(combatSettlementRules, /export function partyRunMemberSettlementResults/);
  assert.match(combatSettlementRules, /export function partyRunTotalScore/);
  assert.match(combatSettlementRules, /export function partyMemberInfluenceDelta/);
  assert.match(combatSettlementRules, /export function partyNewsLegendDelta/);
  assert.match(combatSettlementRules, /export function partyRunMemberRewardGrantPayload/);
  assert.match(combatSettlementRules, /export const PARTY_INVITE_TOKEN_TTL_SECONDS/);
  assert.match(combatSettlementRules, /export function assertPartyRole/);
  assert.match(combatSettlementRules, /export function assertPartyRunJoinPolicy/);
  assert.match(combatSettlementRules, /export function requirePartyRun/);
  assert.match(combatSettlementRules, /export function requireOpenPartyRun/);
  assert.match(combatSettlementRules, /export function assertPartyJoinRequestResolution/);
  assert.match(combatSettlementRules, /export function optionalInviteToken/);
  assert.match(combatSettlementRules, /export function partyInviteTokenHash/);
  assert.match(combatSettlementRules, /export function partyInviteTokenExpiresAt/);
  assert.match(combatSettlementRules, /export function partyInviteTokenUseLimit/);
  assert.match(combatSettlementRules, /export function partyRunCreatedPayload/);
  assert.match(combatSettlementRules, /export function planPartyRunCreationEvents/);
  assert.match(combatSettlementRules, /export function projectPartyRunCreation/);
  assert.match(combatSettlementRules, /export function partyInviteUpdatedPayload/);
  assert.match(combatSettlementRules, /export function planPartyInviteUpdateEvents/);
  assert.match(combatSettlementRules, /export function projectPartyInviteUpdate/);
  assert.match(combatSettlementRules, /export function partyMemberJoinedPayload/);
  assert.match(combatSettlementRules, /export function planPartyMemberJoinEvents/);
  assert.match(combatSettlementRules, /export function projectPartyMemberJoin/);
  assert.match(combatSettlementRules, /export function partyJoinRequestedPayload/);
  assert.match(combatSettlementRules, /export function planPartyJoinRequestEvents/);
  assert.match(combatSettlementRules, /export function projectPartyJoinRequest/);
  assert.match(combatSettlementRules, /export function partyJoinRequestResolvedPayload/);
  assert.match(combatSettlementRules, /export function planPartyJoinRequestResolutionEvents/);
  assert.match(combatSettlementRules, /export function projectPartyJoinRequestResolution/);
  assert.match(combatSettlementRules, /export function partyRunSettledPayload/);
  assert.match(combatSettlementRules, /export function partyRunMemberInfluencePayload/);
  assert.match(combatSettlementRules, /export function partyRunTracePayload/);
  assert.match(combatSettlementRules, /export function planPartyRunSettlementEvents/);
  assert.match(combatSettlementRules, /export function raidSeasonStandingPowerBonus/);
  assert.match(combatSettlementRules, /export function raidRegionalHeatScoreDelta/);
  assert.match(combatSettlementRules, /export function latestRaidPairResolvedAt/);
  assert.match(combatSettlementRules, /export function raidPairResolvedCountSince/);
  assert.match(combatSettlementRules, /export function regionRaidHeatScoreSince/);
  assert.match(combatSettlementRules, /export function raidBattleSettlement/);
  assert.match(combatSettlementRules, /export function raidAttackStaminaSpendPayload/);
  assert.match(combatSettlementRules, /export function raidRewardGrantPayload/);
  assert.match(combatSettlementRules, /export function raidResolvedPayload/);
  assert.match(combatSettlementRules, /export function raidSettlementInfluencePayload/);
  assert.match(combatSettlementRules, /export function raidSettlementTracePayload/);
  assert.match(combatSettlementRules, /export function planRaidResolutionEvents/);
  assert.match(combatSettlementRules, /export function projectRaidResolution/);
  assert.match(combatSettlementRules, /export function retaliationOpportunityCreatedPayload/);
  assert.match(combatSettlementRules, /export function requireRetaliationOpportunity/);
  assert.match(combatSettlementRules, /export function requireOpenRetaliationOpportunity/);
  assert.match(combatSettlementRules, /export function retaliationBattleSettlement/);
  assert.match(combatSettlementRules, /export function retaliationStaminaSpendPayload/);
  assert.match(combatSettlementRules, /export function retaliationRewardGrantPayload/);
  assert.match(combatSettlementRules, /export function retaliationResolvedPayload/);
  assert.match(combatSettlementRules, /export function retaliationSettlementInfluencePayload/);
  assert.match(combatSettlementRules, /export function retaliationSettlementTracePayload/);
  assert.match(combatSettlementRules, /export function planRetaliationResolutionEvents/);
  assert.match(combatSettlementRules, /export function projectRetaliationResolution/);

  assert.doesNotMatch(gameCore, /const PARTY_ROLE_SCORE/);
  assert.doesNotMatch(gameCore, /const PARTY_INVITE_TOKEN_TTL_SECONDS/);
  assert.doesNotMatch(gameCore, /type PartyRunCreatedPayload/);
  assert.doesNotMatch(gameCore, /type PartyInviteUpdatedPayload/);
  assert.doesNotMatch(gameCore, /type PartyMemberJoinedPayload/);
  assert.doesNotMatch(gameCore, /type PartyJoinRequestedPayload/);
  assert.doesNotMatch(gameCore, /type PartyJoinRequestResolvedPayload/);
  assert.doesNotMatch(gameCore, /type PartyMemberSettlementPayload/);
  assert.doesNotMatch(gameCore, /type RaidResolvedPayload/);
  assert.doesNotMatch(gameCore, /type RetaliationOpportunityCreatedPayload/);
  assert.doesNotMatch(gameCore, /type RetaliationResolvedPayload/);
  assert.doesNotMatch(gameCore, /const PARTY_VANGUARD_INFLUENCE_BONUS/);
  assert.doesNotMatch(gameCore, /const PARTY_SCRIBE_NEWS_BONUS/);
  assert.doesNotMatch(gameCore, /function partyRoleSynergyBonus/);
  assert.doesNotMatch(gameCore, /function partyMemberInfluenceDelta/);
  assert.doesNotMatch(gameCore, /function partyNewsLegendDelta/);
  assert.doesNotMatch(gameCore, /function assertPartyRole/);
  assert.doesNotMatch(gameCore, /function assertPartyRunJoinPolicy/);
  assert.doesNotMatch(gameCore, /function requirePartyRun/);
  assert.doesNotMatch(gameCore, /function requireOpenPartyRun/);
  assert.doesNotMatch(gameCore, /function requireRetaliationOpportunity/);
  assert.doesNotMatch(gameCore, /function requireOpenRetaliationOpportunity/);
  assert.doesNotMatch(gameCore, /function assertPartyJoinRequestResolution/);
  assert.doesNotMatch(gameCore, /function optionalInviteToken/);
  assert.doesNotMatch(gameCore, /function partyInviteTokenHash/);
  assert.doesNotMatch(gameCore, /function partyInviteTokenExpiresAt/);
  assert.doesNotMatch(gameCore, /function partyInviteTokenUseLimit/);
  assert.doesNotMatch(gameCore, /const payload: PartyRunCreatedPayload/);
  assert.doesNotMatch(gameCore, /const payload: PartyInviteUpdatedPayload/);
  assert.doesNotMatch(gameCore, /const payload: PartyMemberJoinedPayload/);
  assert.doesNotMatch(gameCore, /const payload: PartyJoinRequestedPayload/);
  assert.doesNotMatch(gameCore, /const payload: PartyJoinRequestResolvedPayload/);
  assert.doesNotMatch(gameCore, /const joinedPayload: PartyMemberJoinedPayload/);
  assert.doesNotMatch(createPartyRun, /makeEvent\("party_run_created"/);
  assert.doesNotMatch(updatePartyInvite, /makeEvent\("party_invite_updated"/);
  assert.doesNotMatch(joinPartyRun, /makeEvent\("party_member_joined"/);
  assert.doesNotMatch(requestPartyJoin, /makeEvent\("party_join_requested"/);
  assert.doesNotMatch(resolvePartyJoinRequest, /makeEvent\("party_join_request_resolved"/);
  assert.doesNotMatch(resolvePartyJoinRequest, /makeEvent\("party_member_joined"/);
  assert.doesNotMatch(gameCore, /PARTY_ROLE_SCORE\[member\.participantRole\]/);
  assert.doesNotMatch(gameCore, /reason: `party_run_settlement:\$\{partyRunId\}`/);
  assert.doesNotMatch(settlePartyRun, /resourceId: member\.reward\.resourceId/);
  assert.doesNotMatch(settlePartyRun, /balanceAfter: currentBalance\(current, member\.agentId, member\.reward\.resourceId\) \+ member\.reward\.amount/);
  assert.doesNotMatch(gameCore, /memberResults\.reduce\(\(sum, member\) => sum \+ member\.score, 0\)/);
  assert.match(settlePartyRun, /planPartyRunSettlementEvents/);
  assert.doesNotMatch(gameCore, /const payload: PartyRunSettledPayload/);
  assert.doesNotMatch(settlePartyRun, /makeEvent\("party_run_settled"/);
  assert.doesNotMatch(settlePartyRun, /makeEvent\("region_news_generated"/);
  assert.doesNotMatch(gameCore, /sourceAggregateId: partyRunId/);
  assert.doesNotMatch(gameCore, /title: `\$\{partyRun\.title\}结算`/);
  assert.doesNotMatch(gameCore, /完成小队行动，总分/);
  assert.doesNotMatch(gameCore, /scoutAgentIds: uniqueValues\(memberResults/);
  assert.doesNotMatch(gameCore, /const RAID_PAIR_REWARD_DECAY_WINDOW_SECONDS/);
  assert.doesNotMatch(gameCore, /const RAID_REGION_HEAT_REWARD_DECAY_WINDOW_SECONDS/);
  assert.doesNotMatch(gameCore, /const RAID_REGION_HEAT_REWARD_DECAY_SCORE/);
  assert.doesNotMatch(gameCore, /const RAID_SEASON_STANDING_POWER_BONUS_DIVISOR/);
  assert.doesNotMatch(gameCore, /function raidSeasonStandingPowerBonus/);
  assert.doesNotMatch(gameCore, /function latestRaidPairResolvedAt/);
  assert.doesNotMatch(gameCore, /function raidPairResolvedCountSince/);
  assert.doesNotMatch(gameCore, /function regionRaidHeatScoreSince/);
  assert.doesNotMatch(gameCore, /const attackerPower =/);
  assert.doesNotMatch(gameCore, /const defenderPower = \(currentBalance\(current, defenderAgentId, "focus"\) \* 3\)/);
  assert.doesNotMatch(gameCore, /const retaliatorPower =/);
  assert.doesNotMatch(gameCore, /const targetPower =/);
  assert.doesNotMatch(gameCore, /"raid_attack_success"/);
  assert.doesNotMatch(gameCore, /"raid_defense_success"/);
  assert.doesNotMatch(gameCore, /"raid_repeat_reward_decayed"/);
  assert.doesNotMatch(gameCore, /"raid_region_heat_reward_decayed"/);
  assert.doesNotMatch(gameCore, /"retaliation_success"/);
  assert.doesNotMatch(gameCore, /"retaliation_defended"/);
  assert.doesNotMatch(resolveRaid, /reason: `raid_attack:\$\{raidId\}`/);
  assert.doesNotMatch(resolveRaid, /balanceAfter: attackerStamina - staminaSpent/);
  assert.doesNotMatch(resolveRaid, /balanceAfter: currentBalance\(current, winnerAgentId, reward\.resourceId\) \+ reward\.amount/);
  assert.doesNotMatch(resolveRaid, /resourceSpentEvent\(makeEvent/);
  assert.doesNotMatch(resolveRaid, /resourceGrantedEvent\(makeEvent/);
  assert.doesNotMatch(resolveRaid, /regionInfluenceChangedEvent\(makeEvent/);
  assert.doesNotMatch(resolveRaid, /traceCreatedEvent\(makeEvent/);
  assert.doesNotMatch(resolveRaid, /makeEvent\("raid_resolved"/);
  assert.doesNotMatch(resolveRaid, /makeEvent\("retaliation_opportunity_created"/);
  assert.doesNotMatch(resolveRetaliation, /reason: `retaliation:\$\{retaliationId\}`/);
  assert.doesNotMatch(resolveRetaliation, /balanceAfter: staminaBalance - staminaSpent/);
  assert.doesNotMatch(resolveRetaliation, /balanceAfter: currentBalance\(current, winnerAgentId, reward\.resourceId\) \+ reward\.amount/);
  assert.doesNotMatch(resolveRetaliation, /resourceSpentEvent\(makeEvent/);
  assert.doesNotMatch(resolveRetaliation, /resourceGrantedEvent\(makeEvent/);
  assert.doesNotMatch(resolveRetaliation, /regionInfluenceChangedEvent\(makeEvent/);
  assert.doesNotMatch(resolveRetaliation, /traceCreatedEvent\(makeEvent/);
  assert.doesNotMatch(resolveRetaliation, /makeEvent\("retaliation_resolved"/);
  assert.doesNotMatch(gameCore, /const payload: RaidResolvedPayload/);
  assert.doesNotMatch(gameCore, /reason: `raid_settlement:/);
  assert.doesNotMatch(gameCore, /sourceAggregateId: raidId/);
  assert.doesNotMatch(gameCore, /title: `突袭结算 \$\{raidId\}`/);
  assert.doesNotMatch(gameCore, /在突袭中胜出/);
  assert.doesNotMatch(gameCore, /const retaliationPayload: RetaliationOpportunityCreatedPayload/);
  assert.doesNotMatch(gameCore, /const resolvedPayload: RetaliationResolvedPayload/);
  assert.doesNotMatch(gameCore, /reason: `retaliation_settlement:/);
  assert.doesNotMatch(gameCore, /sourceAggregateId: retaliationId/);
  assert.doesNotMatch(gameCore, /title: `复仇结算 \$\{retaliationId\}`/);
  assert.doesNotMatch(gameCore, /在复仇中胜出/);
});

test("game core delegates event envelope creation to a focused module", () => {
  assert.ok(
    existsSync(eventFactoryPath),
    "eventFactory.ts should own event envelope factory wiring",
  );
  const gameCore = readFileSync(gameCorePath, "utf8");
  const eventFactory = readFileSync(eventFactoryPath, "utf8");

  assert.match(gameCore, /from "\.\/eventFactory\.ts"/);
  assert.match(eventFactory, /export function eventFactory/);
  assert.match(eventFactory, /createEpochEvent/);
  assert.match(eventFactory, /serverIsoTime/);

  assert.doesNotMatch(gameCore, /function eventFactory/);
  assert.doesNotMatch(gameCore, /createEpochEvent/);
});

test("game core delegates common resource ledger event wrapping to a focused module", () => {
  assert.ok(
    existsSync(resourceLedgerEventsPath),
    "resourceLedgerEvents.ts should own common resource ledger event wrapping",
  );
  const gameCore = readFileSync(gameCorePath, "utf8");
  const resourceRules = readFileSync(resourceRulesPath, "utf8");
  const combatSettlementRules = readFileSync(combatSettlementRulesPath, "utf8");
  const resourceLedgerEvents = readFileSync(resourceLedgerEventsPath, "utf8");
  const deployTraceConflict = gameCore.match(
    /function deployTraceConflict[\s\S]*?(?=\n  function createTurnCard)/,
  )?.[0] || "";

  assert.match(resourceRules, /from "\.\/resourceLedgerEvents\.ts"/);
  assert.match(combatSettlementRules, /from "\.\/resourceLedgerEvents\.ts"/);
  assert.match(resourceLedgerEvents, /export function resourceGrantedEvent/);
  assert.match(resourceLedgerEvents, /export function resourceSpentEvent/);
  assert.match(resourceLedgerEvents, /export function resourceSpentEvents/);
  assert.match(resourceLedgerEvents, /aggregateType: "resource_account"/);

  assert.match(gameCore, /import \{ resourceSpentEvent \} from "\.\/resourceLedgerEvents\.ts"/);
  assert.doesNotMatch(gameCore, /makeEvent\("resource_granted", agentId, payload, \{ aggregateType: "resource_account", agentId \}\)/);
  assert.doesNotMatch(gameCore, /makeEvent\("resource_spent", agentId, payload, \{ aggregateType: "resource_account", agentId \}\)/);
  assert.doesNotMatch(gameCore, /makeEvent\("resource_(?:granted|spent)"/);
  assert.ok(deployTraceConflict, "deployTraceConflict should stay discoverable for boundary checks");
  assert.match(deployTraceConflict, /resourceSpentEvent\(makeEvent, agentId/);
});

test("game core delegates common region event wrapping to a focused module", () => {
  assert.ok(
    existsSync(regionEventLedgerEventsPath),
    "regionEventLedgerEvents.ts should own common region influence and trace event wrapping",
  );
  const gameCore = readFileSync(gameCorePath, "utf8");
  const combatSettlementRules = readFileSync(combatSettlementRulesPath, "utf8");
  const regionEventLedgerEvents = readFileSync(regionEventLedgerEventsPath, "utf8");

  assert.match(combatSettlementRules, /from "\.\/regionEventLedgerEvents\.ts"/);
  assert.match(regionEventLedgerEvents, /export function regionInfluenceChangedEvent/);
  assert.match(regionEventLedgerEvents, /export function traceCreatedEvent/);
  assert.match(regionEventLedgerEvents, /aggregateType: "region"/);
  assert.match(regionEventLedgerEvents, /aggregateType: "trace"/);

  assert.doesNotMatch(gameCore, /from "\.\/regionEventLedgerEvents\.ts"/);
  assert.doesNotMatch(gameCore, /makeEvent\("region_influence_changed"/);
  assert.doesNotMatch(gameCore, /makeEvent\("trace_created"/);
});

test("game core delegates region projection reads to a focused module", () => {
  assert.ok(
    existsSync(regionProjectionRulesPath),
    "regionProjectionRules.ts should own common region influence and trace projection reads",
  );
  const gameCore = readFileSync(gameCorePath, "utf8");
  const regionProjectionRules = readFileSync(regionProjectionRulesPath, "utf8");

  assert.match(gameCore, /from "\.\/regionProjectionRules\.ts"/);
  assert.match(regionProjectionRules, /export function currentRegionInfluenceScore/);
  assert.match(regionProjectionRules, /export function latestTraceIdForRegion/);

  assert.doesNotMatch(gameCore, /function currentRegionInfluenceScore/);
  assert.doesNotMatch(gameCore, /function latestTraceIdForRegion/);
});

test("game core delegates region activity projection writes to a focused module", () => {
  assert.ok(
    existsSync(regionActivityRulesPath),
    "regionActivityRules.ts should own region activity types and projection write helpers",
  );
  const gameCore = readFileSync(gameCorePath, "utf8");
  const regionActivityRules = readFileSync(regionActivityRulesPath, "utf8");

  assert.match(gameCore, /from "\.\/regionActivityRules\.ts"/);
  assert.match(regionActivityRules, /export type EpochRegionActivityKind/);
  assert.match(regionActivityRules, /export type EpochRegionActivitySourceEventType/);
  assert.match(regionActivityRules, /export interface EpochRegionActivity/);
  assert.match(regionActivityRules, /export function addRegionActivity/);
  assert.match(regionActivityRules, /export function addRegionActivityForEvent/);
  assert.match(regionActivityRules, /export function addRegionActivitiesForEventRegions/);

  assert.doesNotMatch(gameCore, /export type EpochRegionActivityKind/);
  assert.doesNotMatch(gameCore, /export type EpochRegionActivitySourceEventType/);
  assert.doesNotMatch(gameCore, /export interface EpochRegionActivity/);
  assert.doesNotMatch(gameCore, /function addRegionActivity/);
  assert.doesNotMatch(gameCore, /function addRegionActivityForEvent/);
  assert.doesNotMatch(gameCore, /function addRegionActivitiesForEventRegions/);
});

test("game core delegates common inventory item event wrapping to a focused module", () => {
  assert.ok(
    existsSync(inventoryItemLedgerEventsPath),
    "inventoryItemLedgerEvents.ts should own common inventory item event wrapping",
  );
  const gameCore = readFileSync(gameCorePath, "utf8");
  const inventoryItemLedgerEvents = readFileSync(inventoryItemLedgerEventsPath, "utf8");

  assert.match(gameCore, /from "\.\/inventoryItemLedgerEvents\.ts"/);
  assert.match(inventoryItemLedgerEvents, /export function itemCreatedEvent/);
  assert.match(inventoryItemLedgerEvents, /export function itemBoundEvent/);
  assert.match(inventoryItemLedgerEvents, /export function itemTransferredEvent/);
  assert.match(inventoryItemLedgerEvents, /aggregateType: "inventory_item"/);

  assert.doesNotMatch(gameCore, /makeEvent\("item_created"/);
  assert.doesNotMatch(gameCore, /makeEvent\("item_bound"/);
  assert.doesNotMatch(gameCore, /makeEvent\("item_transferred"/);
});

test("game core delegates turn and hosted action signed envelope rules to a focused module", () => {
  assert.ok(
    existsSync(turnActionEnvelopeRulesPath),
    "turnActionEnvelopeRules.ts should own turn-card, turn-resolution, and hosted-action signed envelope hashing",
  );
  const gameCore = readFileSync(gameCorePath, "utf8");
  const gameCoreTurnHosted = readFileSync(gameCoreTurnHostedPath, "utf8");
  const turnHostedActionRules = readFileSync(turnHostedActionRulesPath, "utf8");
  const turnActionEnvelopeRules = readFileSync(turnActionEnvelopeRulesPath, "utf8");

  assert.match(turnHostedActionRules, /from "\.\/turnActionEnvelopeRules\.ts"/);
  assert.match(turnActionEnvelopeRules, /export function buildSignedTurnCardEnvelope/);
  assert.match(turnActionEnvelopeRules, /export function buildSignedTurnResolutionEnvelope/);
  assert.match(turnActionEnvelopeRules, /export function buildSignedHostedActionEnvelope/);
  assert.match(turnActionEnvelopeRules, /export function signedEnvelopeContentHash/);

  assert.doesNotMatch(gameCore, /from "\.\/turnActionEnvelopeRules\.ts"/);
  assert.doesNotMatch(gameCore, /buildSignedTurnCardEnvelope/);
  assert.doesNotMatch(gameCore, /buildSignedTurnResolutionEnvelope/);
  assert.doesNotMatch(gameCore, /buildSignedHostedActionEnvelope/);
  assert.doesNotMatch(gameCore, /function buildSignedTurnCardEnvelope/);
  assert.doesNotMatch(gameCore, /function buildSignedTurnResolutionEnvelope/);
  assert.doesNotMatch(gameCore, /function buildSignedHostedActionEnvelope/);
  assert.doesNotMatch(gameCore, /function turnCardSignedEnvelopeContent/);
  assert.doesNotMatch(gameCore, /function turnResolutionSignedEnvelopeContent/);
  assert.doesNotMatch(gameCore, /function hostedActionSignedEnvelopeContent/);
  assert.doesNotMatch(gameCore, /const TURN_CARD_ENVELOPE_PROTOCOL_VERSION/);
  assert.doesNotMatch(gameCore, /const TURN_RESOLUTION_ENVELOPE_PROTOCOL_VERSION/);
  assert.doesNotMatch(gameCore, /const HOSTED_ACTION_ENVELOPE_PROTOCOL_VERSION/);
});

test("game core delegates turn and hosted action rules to a focused module", () => {
  assert.ok(
    existsSync(turnHostedActionRulesPath),
    "turnHostedActionRules.ts should own turn/hosted trust, option, high-risk, and settlement policies",
  );
  const gameCore = readFileSync(gameCorePath, "utf8");
  const gameCoreTurnHosted = readFileSync(gameCoreTurnHostedPath, "utf8");
  const turnHostedActionRules = readFileSync(turnHostedActionRulesPath, "utf8");

  assert.match(gameCore, /from "\.\/turnHostedActionRules\.ts"/);
  assert.match(turnHostedActionRules, /export function requireHostedTrust/);
  assert.match(turnHostedActionRules, /export function requireTurnTrust/);
  assert.match(turnHostedActionRules, /export function nextTurnCardSequence/);
  assert.match(turnHostedActionRules, /export function hasOpenTurnCardForAgent/);
  assert.match(turnHostedActionRules, /export function turnActionOptions/);
  assert.match(turnHostedActionRules, /export function hostedActionOptions/);
  assert.match(turnHostedActionRules, /export function settlementPolicy/);
  assert.match(turnHostedActionRules, /export function turnHostedActionRewardGrantPayload/);
  assert.match(turnHostedActionRules, /export function turnCardCreatedPayload/);
  assert.match(turnHostedActionRules, /export function turnResolvedPayload/);
  assert.match(turnHostedActionRules, /export function planTurnCardCreationEvents/);
  assert.match(turnHostedActionRules, /export function planTurnCardResolutionEvents/);
  assert.match(turnHostedActionRules, /export function hostedSessionStartedPayload/);
  assert.match(turnHostedActionRules, /export function hostedActionRecordedPayload/);
  assert.match(turnHostedActionRules, /export function attestationRecordedPayload/);
  assert.match(turnHostedActionRules, /export function planHostedSessionStartEvents/);
  assert.match(turnHostedActionRules, /export function planHostedActionSubmissionEvents/);
  assert.match(turnHostedActionRules, /export const TURN_OPTION_TEMPLATES/);

  const createTurnCard = gameCore.match(/function createTurnCard[\s\S]*?(?=\n  function startHostedSession)/)?.[0] || "";
  assert.ok(createTurnCard, "createTurnCard should stay discoverable for boundary checks");
  const resolveTurnCard = gameCore.match(/function resolveTurnCard[\s\S]*?(?=\n  function startHostedSession)/)?.[0] || "";
  const startHostedSession = gameCore.match(/function startHostedSession[\s\S]*?(?=\n  function submitHostedAction)/)?.[0] || "";
  const submitHostedAction = gameCoreTurnHosted.match(/function submitHostedAction[\s\S]*?(?=\n  return \{)/)?.[0] || "";
  assert.ok(resolveTurnCard, "resolveTurnCard should stay discoverable for boundary checks");
  assert.ok(startHostedSession, "startHostedSession should stay discoverable for boundary checks");
  assert.ok(submitHostedAction, "submitHostedAction should stay discoverable for boundary checks");

  assert.doesNotMatch(gameCore, /function requireHostedTrust/);
  assert.doesNotMatch(gameCore, /function deriveHostedDeliveryTrust/);
  assert.doesNotMatch(gameCore, /function deriveHostedEventTrust/);
  assert.doesNotMatch(gameCore, /function requireTurnTrust/);
  assert.doesNotMatch(gameCore, /const TURN_OPTION_TEMPLATES/);
  assert.doesNotMatch(gameCore, /function turnActionOptions/);
  assert.doesNotMatch(gameCore, /function turnOptionTemplate/);
  assert.doesNotMatch(gameCore, /function includeHighRiskOptions/);
  assert.doesNotMatch(gameCore, /function settlementPolicy/);
  assert.doesNotMatch(gameCore, /function hostedActionOptions/);
  assert.doesNotMatch(gameCore, /const payload: TurnCardCreatedPayload/);
  assert.doesNotMatch(gameCore, /const payload: TurnResolvedPayload/);
  assert.doesNotMatch(gameCore, /const payload: HostedSessionStartedPayload/);
  assert.doesNotMatch(gameCore, /const payload: HostedActionRecordedPayload/);
  assert.doesNotMatch(gameCore, /type AttestationRecordedPayload/);
  assert.doesNotMatch(gameCore, /const attestationPayload: AttestationRecordedPayload/);
  assert.match(createTurnCard, /planTurnCardCreationEvents/);
  assert.doesNotMatch(createTurnCard, /makeEvent\("turn_card_created"/);
  assert.match(resolveTurnCard, /planTurnCardResolutionEvents/);
  assert.doesNotMatch(resolveTurnCard, /makeEvent\("turn_resolved"/);
  assert.match(startHostedSession, /planHostedSessionStartEvents/);
  assert.doesNotMatch(startHostedSession, /makeEvent\("hosted_session_started"/);
  assert.match(submitHostedAction, /planHostedActionSubmissionEvents/);
  assert.doesNotMatch(submitHostedAction, /makeEvent\("attestation_recorded"/);
  assert.doesNotMatch(submitHostedAction, /makeEvent\("hosted_action_recorded"/);
  assert.doesNotMatch(createTurnCard, /Object\.values\(current\.turnCards\)/);
  assert.doesNotMatch(createTurnCard, /const hasOpenCard =/);
  assert.doesNotMatch(createTurnCard, /const sequence = Math\.max/);
  assert.doesNotMatch(resolveTurnCard, /resourceId: settlement\.reward\.resourceId/);
  assert.doesNotMatch(resolveTurnCard, /balanceAfter: currentBalance\(current, card\.agentId, settlement\.reward\.resourceId\) \+ settlement\.reward\.amount/);
  assert.doesNotMatch(submitHostedAction, /resourceId: settlement\.reward\.resourceId/);
  assert.doesNotMatch(submitHostedAction, /balanceAfter: currentBalance\(current, session\.agentId, settlement\.reward\.resourceId\) \+ settlement\.reward\.amount/);
  assert.doesNotMatch(submitHostedAction, /resourceGrantedEvent\(makeEvent/);
});

test("game core delegates server-hosted job payload rules to a focused module", () => {
  assert.ok(
    existsSync(serverHostedRuntimeRulesPath),
    "serverHostedRuntimeRules.ts should own server-hosted job lifecycle payload planning",
  );
  const gameCore = readFileSync(gameCorePath, "utf8");
  const gameCoreJourney = readFileSync(gameCoreJourneyPath, "utf8");
  const serverHostedRuntimeRules = readFileSync(serverHostedRuntimeRulesPath, "utf8");

  assert.match(gameCore, /from "\.\/serverHostedRuntimeRules\.ts"/);
  assert.match(serverHostedRuntimeRules, /export function serverHostedJobQueuedPayload/);
  assert.match(serverHostedRuntimeRules, /export function serverHostedJobCompletedPayload/);
  assert.match(serverHostedRuntimeRules, /export function serverHostedJobSkippedPayload/);
  assert.match(serverHostedRuntimeRules, /export function planServerHostedJobQueuedEvents/);
  assert.match(serverHostedRuntimeRules, /export function planServerHostedJobCompletedEvents/);
  assert.match(serverHostedRuntimeRules, /export function planServerHostedJobSkippedEvents/);

  const queueServerHostedJob = gameCoreJourney.match(/function queueServerHostedJob[\s\S]*?(?=\n  function canRunServerHostedJobOption)/)?.[0] || "";
  const completeServerHostedJob = gameCoreJourney.match(/function completeServerHostedJob[\s\S]*?(?=\n  function skipServerHostedJob)/)?.[0] || "";
  const skipServerHostedJob = gameCoreJourney.match(/function skipServerHostedJob[\s\S]*?(?=\n  return \{)/)?.[0] || "";
  assert.ok(queueServerHostedJob, "queueServerHostedJob should stay discoverable for boundary checks");
  assert.ok(completeServerHostedJob, "completeServerHostedJob should stay discoverable for boundary checks");
  assert.ok(skipServerHostedJob, "skipServerHostedJob should stay discoverable for boundary checks");
  assert.match(queueServerHostedJob, /planServerHostedJobQueuedEvents/);
  assert.match(completeServerHostedJob, /planServerHostedJobCompletedEvents/);
  assert.match(skipServerHostedJob, /planServerHostedJobSkippedEvents/);

  assert.doesNotMatch(gameCore, /type ServerHostedJobQueuedPayload/);
  assert.doesNotMatch(gameCore, /type ServerHostedJobCompletedPayload/);
  assert.doesNotMatch(gameCore, /type ServerHostedJobSkippedPayload/);
  assert.doesNotMatch(gameCore, /const payload: ServerHostedJobQueuedPayload/);
  assert.doesNotMatch(gameCore, /const payload: ServerHostedJobCompletedPayload/);
  assert.doesNotMatch(gameCore, /const payload: ServerHostedJobSkippedPayload/);
  assert.doesNotMatch(queueServerHostedJob, /makeEvent\("server_hosted_job_queued"/);
  assert.doesNotMatch(completeServerHostedJob, /makeEvent\("server_hosted_job_completed"/);
  assert.doesNotMatch(skipServerHostedJob, /makeEvent\("server_hosted_job_skipped"/);
});

test("game core delegates source event authority and risk review rules to a focused module", () => {
  assert.ok(
    existsSync(sourceEventRulesPath),
    "sourceEventRules.ts should own source event authority, provenance, and risk review rules",
  );
  const gameCore = readFileSync(gameCorePath, "utf8");
  const runtime = readFileSync(new URL("../lib/epoch/runtime.ts", import.meta.url), "utf8");
  const sourceEventRules = readFileSync(sourceEventRulesPath, "utf8");

  assert.match(gameCore, /from "\.\/sourceEventRules\.ts"/);
  assert.match(runtime, /from "\.\/sourceEventRules\.ts"/);
  assert.match(sourceEventRules, /export function riskReviewFlagsForEvent/);
  assert.match(sourceEventRules, /export function riskReviewScoreForEvent/);
  assert.match(sourceEventRules, /export function riskReviewableEvent/);
  assert.match(sourceEventRules, /export function riskReviewSourceEvent/);
  assert.match(sourceEventRules, /export function assertKnownSourceEvents/);
  assert.match(sourceEventRules, /export function normalizeSourceEventIds/);
  assert.match(sourceEventRules, /export function riskReviewAnalysisForEvent/);
  assert.match(sourceEventRules, /export function sourceAuthorityForEvent/);
  assert.match(sourceEventRules, /export function loreSourceEventProvenance/);
  assert.match(sourceEventRules, /export function sourceEventExplorerId/);
  assert.match(sourceEventRules, /export const LOW_AUTHORITY_REFUTATION_AUTHORITIES/);

  assert.doesNotMatch(gameCore, /function riskReviewFlagsForEvent/);
  assert.doesNotMatch(gameCore, /function riskReviewScoreForEvent/);
  assert.doesNotMatch(gameCore, /function riskReviewableEvent/);
  assert.doesNotMatch(gameCore, /function assertKnownSourceEvents/);
  assert.doesNotMatch(gameCore, /function normalizeSourceEventIds/);
  assert.doesNotMatch(gameCore, /function sourceAuthorityForEvent/);
  assert.doesNotMatch(gameCore, /function loreSourceEventProvenance/);
  assert.doesNotMatch(gameCore, /function sourceEventExplorerId/);
  assert.doesNotMatch(gameCore, /const LOW_AUTHORITY_REFUTATION_AUTHORITIES/);
  assert.doesNotMatch(runtime, /function sourceAuthorityForEvent/);
  assert.doesNotMatch(runtime, /function loreSourceEventProvenance/);

  const recordRiskReview = gameCore.match(/function recordRiskReview[\s\S]*?(?=\n  function releaseMarketRiskRestriction)/)?.[0] || "";
  assert.ok(recordRiskReview, "recordRiskReview should remain findable for boundary checks");
  assert.doesNotMatch(recordRiskReview, /current\.events\.find/);
  assert.doesNotMatch(recordRiskReview, /riskReviewableEvent/);
  assert.doesNotMatch(recordRiskReview, /riskReviewFlagsForEvent/);
  assert.doesNotMatch(recordRiskReview, /riskReviewScoreForEvent/);
  assert.doesNotMatch(recordRiskReview, /risk_review_source_event_not_found/);
  assert.doesNotMatch(recordRiskReview, /risk_review_source_event_not_reviewable/);
  assert.doesNotMatch(gameCore, /source_event_not_found/);
});

test("game core delegates lore provenance and evidence hash rules to a focused module", () => {
  assert.ok(
    existsSync(loreProvenanceRulesPath),
    "loreProvenanceRules.ts should own lore evidence hashes, provenance receipts, and authority review",
  );
  const gameCore = readFileSync(gameCorePath, "utf8");
  const loreProvenanceRules = readFileSync(loreProvenanceRulesPath, "utf8");

  assert.match(gameCore, /from "\.\/loreProvenanceRules\.ts"/);
  assert.match(loreProvenanceRules, /export function loreClaimHash/);
  assert.match(loreProvenanceRules, /export function loreEvidenceHash/);
  assert.match(loreProvenanceRules, /export function createLoreContributionProvenance/);
  assert.match(loreProvenanceRules, /export function createLoreTargetAdjudicationProvenance/);
  assert.match(loreProvenanceRules, /export function loreAuthorityReviewForSourceContributions/);

  assert.doesNotMatch(gameCore, /function stableEvidenceJson/);
  assert.doesNotMatch(gameCore, /function evidenceHash/);
  assert.doesNotMatch(gameCore, /function loreClaimHash/);
  assert.doesNotMatch(gameCore, /function createLoreContributionProvenance/);
  assert.doesNotMatch(gameCore, /function createLoreTargetAdjudicationProvenance/);
  assert.doesNotMatch(gameCore, /function loreAuthorityReviewForSourceContributions/);
});

test("game core delegates lore contribution validation rules to a focused module", () => {
  assert.ok(
    existsSync(loreContributionRulesPath),
    "loreContributionRules.ts should own lore contribution gates, scope reviews, fuzzy time, cross-region support, and canon candidate paths",
  );
  const gameCore = readFileSync(gameCorePath, "utf8");
  const loreContributionRules = readFileSync(loreContributionRulesPath, "utf8");

  assert.match(gameCore, /from "\.\/loreContributionRules\.ts"/);
  assert.match(loreContributionRules, /export function assertLoreAdjudicationStatus/);
  assert.match(loreContributionRules, /export function assertLoreRefutationDailyQuota/);
  assert.match(loreContributionRules, /export function assertLoreContributionCategory/);
  assert.match(loreContributionRules, /export function experimentalArtifactReview/);
  assert.match(loreContributionRules, /export function creatureBehaviorScopeReviewFor/);
  assert.match(loreContributionRules, /export function fuzzyTimeIntervalReviewFor/);
  assert.match(loreContributionRules, /export function crossRegionMechanismReviewFor/);
  assert.match(loreContributionRules, /export function loreContributionCost/);
  assert.match(loreContributionRules, /export function loreContributionCostSpendPayload/);
  assert.match(loreContributionRules, /export function loreContributionRecordPayload/);
  assert.match(loreContributionRules, /export function loreContributionRevisionFields/);
  assert.match(loreContributionRules, /export function loreContributionSourceEventIds/);
  assert.match(loreContributionRules, /export function loreContributionSourceEvents/);
  assert.match(loreContributionRules, /export function loreRefutationCountForRecordedDate/);
  assert.match(loreContributionRules, /export function loreTargetAdjudicationHistory/);
  assert.match(loreContributionRules, /export function loreTargetAdjudicationIds/);
  assert.match(loreContributionRules, /export function loreTargetAdjudicationPayload/);
  assert.match(loreContributionRules, /export function loreTargetAdjudicationStableKey/);
  assert.match(loreContributionRules, /export function loreTargetSourceContributionEventIds/);
  assert.match(loreContributionRules, /export function loreTargetSourceContributionEvents/);
  assert.match(loreContributionRules, /export function canonCandidatePathFromInput/);
  assert.match(loreContributionRules, /export function planLoreContributionRecordEvents/);
  assert.match(loreContributionRules, /export function planLoreTargetAdjudicationEvents/);

  const recordLoreContribution = gameCore.match(/function recordLoreContribution[\s\S]*?(?=\n  function adjudicateLoreTarget)/)?.[0] || "";
  assert.ok(recordLoreContribution, "recordLoreContribution should remain findable for boundary checks");
  const adjudicateLoreTarget = gameCore.match(/function adjudicateLoreTarget[\s\S]*?(?=\n  function setDowntime)/)?.[0] || "";
  assert.ok(adjudicateLoreTarget, "adjudicateLoreTarget should remain findable for boundary checks");
  assert.match(recordLoreContribution, /planLoreContributionRecordEvents/);
  assert.match(adjudicateLoreTarget, /planLoreTargetAdjudicationEvents/);
  assert.match(adjudicateLoreTarget, /requireServerTrust\(context, "lore_adjudication_requires_server_trust"\)/);

  assert.doesNotMatch(gameCore, /function assertLoreContributionCategory/);
  assert.doesNotMatch(gameCore, /function assertLoreAdjudicationStatus/);
  assert.doesNotMatch(gameCore, /function experimentalArtifactReview/);
  assert.doesNotMatch(gameCore, /function creatureBehaviorScopeReviewFor/);
  assert.doesNotMatch(gameCore, /function fuzzyTimeIntervalReviewFor/);
  assert.doesNotMatch(gameCore, /function crossRegionMechanismReviewFor/);
  assert.doesNotMatch(gameCore, /function canonCandidatePathFromInput/);
  assert.doesNotMatch(recordLoreContribution, /claimId: contributionId/);
  assert.doesNotMatch(recordLoreContribution, /claimType: category/);
  assert.doesNotMatch(recordLoreContribution, /claimText: summary/);
  assert.doesNotMatch(recordLoreContribution, /category === "revision" \? assertLoreRevisionMode/);
  assert.doesNotMatch(recordLoreContribution, /const sourceEventIds = \[\.\.\.new Set/);
  assert.doesNotMatch(recordLoreContribution, /sourceEventIsNonEvidence/);
  assert.doesNotMatch(recordLoreContribution, /sourceEventExplorerId/);
  assert.doesNotMatch(recordLoreContribution, /sourceAuthorityForEvent/);
  assert.doesNotMatch(recordLoreContribution, /LOW_AUTHORITY_REFUTATION_AUTHORITIES/);
  assert.doesNotMatch(recordLoreContribution, /lore_contribution_source_event_required/);
  assert.doesNotMatch(recordLoreContribution, /lore_contribution_source_event_not_found/);
  assert.doesNotMatch(recordLoreContribution, /lore_contribution_non_evidence_source/);
  assert.doesNotMatch(recordLoreContribution, /lore_refutation_low_authority_source/);
  assert.doesNotMatch(recordLoreContribution, /refutationsToday/);
  assert.doesNotMatch(recordLoreContribution, /lore_refutation_daily_quota_exceeded/);
  assert.doesNotMatch(recordLoreContribution, /reason: `lore_\$\{category\}_cost`/);
  assert.doesNotMatch(recordLoreContribution, /balanceAfter: currentFocus - cost\.amount/);
  assert.doesNotMatch(recordLoreContribution, /resourceSpentEvent\(makeEvent/);
  assert.doesNotMatch(recordLoreContribution, /makeEvent\("lore_contribution_recorded"/);
  assert.doesNotMatch(adjudicateLoreTarget, /const payload: EpochLoreTargetAdjudication = \{/);
  assert.doesNotMatch(adjudicateLoreTarget, /makeEvent\("lore_target_adjudicated"/);
  assert.doesNotMatch(adjudicateLoreTarget, /newAdjudicationId: adjudicationId/);
  assert.doesNotMatch(adjudicateLoreTarget, /\.filter\(\(eventId\): eventId is string => typeof eventId === "string"\)/);
  assert.doesNotMatch(adjudicateLoreTarget, /lore_adjudication_source_contribution_required/);
  assert.doesNotMatch(adjudicateLoreTarget, /lore_adjudication_source_event_not_found/);
  assert.doesNotMatch(adjudicateLoreTarget, /lore_adjudication_source_event_not_contribution/);
  assert.doesNotMatch(adjudicateLoreTarget, /lore_adjudication_source_target_mismatch/);
  assert.doesNotMatch(adjudicateLoreTarget, /sourceEvent\.eventType !== "lore_contribution_recorded"/);
  assert.doesNotMatch(adjudicateLoreTarget, /sourcePayload\.targetId !== targetId/);
  assert.doesNotMatch(adjudicateLoreTarget, /previousAdjudicationEvents/);
  assert.doesNotMatch(adjudicateLoreTarget, /event\.eventType !== "lore_target_adjudicated"/);
  assert.doesNotMatch(adjudicateLoreTarget, /previousAdjudication\?\.adjudicationId/);
  assert.doesNotMatch(adjudicateLoreTarget, /review-\$\{adjudicationSequence\}/);
  assert.doesNotMatch(adjudicateLoreTarget, /canonCandidate \? \{ canonCandidate \} : \{\}/);
  assert.doesNotMatch(adjudicateLoreTarget, /normalizeTrustClass\(context\.trustClass\) !== "system_worker"/);
});

test("game core delegates NPC candidate review and rumor admission rules to a focused module", () => {
  assert.ok(
    existsSync(npcCandidateRulesPath),
    "npcCandidateRules.ts should own NPC candidate review, rumor admission, and ability clustering",
  );
  const gameCore = readFileSync(gameCorePath, "utf8");
  const npcCandidateRules = readFileSync(npcCandidateRulesPath, "utf8");

  assert.match(gameCore, /from "\.\/npcCandidateRules\.ts"/);
  assert.match(npcCandidateRules, /export function normalizeTraits/);
  assert.match(npcCandidateRules, /export function normalizeNpcCandidateReviewResolution/);
  assert.match(npcCandidateRules, /export function npcCandidateReview/);
  assert.match(npcCandidateRules, /export function npcCandidateRumorAdmission/);
  assert.match(npcCandidateRules, /export function npcAbilityEffectCluster/);
  assert.match(npcCandidateRules, /export function npcCanonicalizedPayload/);
  assert.match(npcCandidateRules, /export function npcCandidateSubmittedPayload/);
  assert.match(npcCandidateRules, /export function npcCandidateReviewedPayload/);
  assert.match(npcCandidateRules, /export function planNpcCanonicalizedEvents/);
  assert.match(npcCandidateRules, /export function planNpcCandidateSubmittedEvents/);
  assert.match(npcCandidateRules, /export function planNpcCandidateReviewedEvents/);

  const canonicalizeNpc = gameCore.match(/function canonicalizeNpc[\s\S]*?(?=\n  function submitNpcCandidate)/)?.[0] || "";
  const submitNpcCandidate = gameCore.match(/function submitNpcCandidate[\s\S]*?(?=\n  function reviewNpcCandidate)/)?.[0] || "";
  const reviewNpcCandidate = gameCore.match(/function reviewNpcCandidate[\s\S]*?(?=\n  function recordNpcLifecycle)/)?.[0] || "";
  assert.ok(canonicalizeNpc, "canonicalizeNpc should stay discoverable for boundary checks");
  assert.ok(submitNpcCandidate, "submitNpcCandidate should stay discoverable for boundary checks");
  assert.ok(reviewNpcCandidate, "reviewNpcCandidate should stay discoverable for boundary checks");
  assert.match(canonicalizeNpc, /planNpcCanonicalizedEvents/);
  assert.match(submitNpcCandidate, /planNpcCandidateSubmittedEvents/);
  assert.match(reviewNpcCandidate, /planNpcCandidateReviewedEvents/);
  assert.match(reviewNpcCandidate, /requireServerTrust\(context, "npc_candidate_review_requires_server_trust"\)/);

  assert.doesNotMatch(gameCore, /function npcCandidateReview/);
  assert.doesNotMatch(gameCore, /function normalizeTraits/);
  assert.doesNotMatch(gameCore, /function normalizeNpcCandidateReviewResolution/);
  assert.doesNotMatch(gameCore, /function npcCandidateRumorAdmission/);
  assert.doesNotMatch(gameCore, /function npcAbilityEffectCluster/);
  assert.doesNotMatch(gameCore, /const RUMOR_ANCHOR_THRESHOLD/);
  assert.doesNotMatch(canonicalizeNpc, /makeEvent\("npc_canonicalized"/);
  assert.doesNotMatch(submitNpcCandidate, /makeEvent\("npc_candidate_submitted"/);
  assert.doesNotMatch(submitNpcCandidate, /makeEvent\("npc_canonicalized"/);
  assert.doesNotMatch(reviewNpcCandidate, /makeEvent\("npc_candidate_reviewed"/);
  assert.doesNotMatch(reviewNpcCandidate, /makeEvent\("npc_canonicalized"/);
  assert.doesNotMatch(reviewNpcCandidate, /context\.trustClass !== "system_worker"/);
  assert.doesNotMatch(gameCore, /makeEvent\("npc_canonicalized", [^,\n]+, \{\s*npcId,/);
  assert.doesNotMatch(gameCore, /const candidatePayload: NpcCandidateSubmittedPayload/);
  assert.doesNotMatch(gameCore, /const reviewPayload: NpcCandidateReviewedPayload/);
  assert.doesNotMatch(gameCore, /status: decision,/);
  assert.doesNotMatch(gameCore, /operator_rejected/);
});

test("game core delegates NPC lifecycle payload rules to a focused module", () => {
  assert.ok(
    existsSync(npcLifecycleRulesPath),
    "npcLifecycleRules.ts should own NPC lifecycle change, summary, and payload planning",
  );
  const gameCore = readFileSync(gameCorePath, "utf8");
  const npcLifecycleRules = readFileSync(npcLifecycleRulesPath, "utf8");

  assert.match(gameCore, /from "\.\/npcLifecycleRules\.ts"/);
  assert.match(npcLifecycleRules, /export function lifecycleTickChanges/);
  assert.match(npcLifecycleRules, /export function normalizeLifecycleChanges/);
  assert.match(npcLifecycleRules, /export function lifecycleTickLimit/);
  assert.match(npcLifecycleRules, /export function selectLifecycleTickNpcs/);
  assert.match(npcLifecycleRules, /export function npcLifecycleRecordedPayload/);
  assert.match(npcLifecycleRules, /export function lifecycleMemorySummary/);
  assert.match(npcLifecycleRules, /export function lifecycleOrganizationName/);
  assert.match(npcLifecycleRules, /export function lifecycleMigrationRegionId/);
  assert.match(npcLifecycleRules, /export function lifecycleHouseholdRecordPayload/);
  assert.match(npcLifecycleRules, /export function lifecycleOrganizationMembershipRecordPayload/);
  assert.match(npcLifecycleRules, /export function npcMemoryRecordedPayload/);
  assert.match(npcLifecycleRules, /export function npcRelationshipRecordedPayload/);
  assert.match(npcLifecycleRules, /export function npcHouseholdRecordedPayload/);
  assert.match(npcLifecycleRules, /export function npcCareerChangedPayload/);
  assert.match(npcLifecycleRules, /export function npcLocationChangedPayload/);
  assert.match(npcLifecycleRules, /export function npcAssetChangedPayload/);
  assert.match(npcLifecycleRules, /export function npcHealthRecordedPayload/);
  assert.match(npcLifecycleRules, /export function planNpcLifecycleRecordEvents/);
  assert.match(npcLifecycleRules, /export function planNpcMemoryRecordEvents/);
  assert.match(npcLifecycleRules, /export function planNpcLifecycleTickEvents/);
  assert.match(npcLifecycleRules, /export function projectNpcLifecycleTickResult/);

  const recordNpcLifecycle = gameCore.match(/function recordNpcLifecycle[\s\S]*?(?=\n  function recordNpcMemory)/)?.[0] || "";
  const recordNpcMemory = gameCore.match(/function recordNpcMemory[\s\S]*?(?=\n  function tickNpcLifecycle)/)?.[0] || "";
  const tickNpcLifecycle = gameCore.match(/function tickNpcLifecycle[\s\S]*?(?=\n  function tickOrganizationPolitics)/)?.[0] || "";
  assert.ok(recordNpcLifecycle, "recordNpcLifecycle should stay discoverable for boundary checks");
  assert.ok(recordNpcMemory, "recordNpcMemory should stay discoverable for boundary checks");
  assert.ok(tickNpcLifecycle, "tickNpcLifecycle should stay discoverable for boundary checks");
  assert.match(recordNpcLifecycle, /planNpcLifecycleRecordEvents/);
  assert.match(recordNpcMemory, /planNpcMemoryRecordEvents/);
  assert.match(tickNpcLifecycle, /planNpcLifecycleTickEvents/);
  assert.match(tickNpcLifecycle, /projectNpcLifecycleTickResult/);

  assert.doesNotMatch(gameCore, /function lifecycleTickChanges/);
  assert.doesNotMatch(gameCore, /function normalizeLifecycleChanges/);
  assert.doesNotMatch(gameCore, /function lifecycleMemorySummary/);
  assert.doesNotMatch(gameCore, /function lifecycleOrganizationName/);
  assert.doesNotMatch(gameCore, /function lifecycleMigrationRegionId/);
  assert.doesNotMatch(
    tickNpcLifecycle,
    /const limit = Math\.max\(1, Math\.min\(Number\(input\.limit \|\| 10\), 100\)\)/,
  );
  assert.doesNotMatch(tickNpcLifecycle, /const regionId = input\.regionId\?\.trim\(\)/);
  assert.doesNotMatch(tickNpcLifecycle, /const selectedNpcs = Object\.values\(current\.npcs\)/);
  assert.doesNotMatch(tickNpcLifecycle, /sort\(\(left, right\) => left\.npcId\.localeCompare\(right\.npcId\)\)/);
  assert.doesNotMatch(
    tickNpcLifecycle,
    /const lifecycle = makeEvent\("npc_lifecycle_recorded", npc\.npcId, \{/,
  );
  assert.doesNotMatch(recordNpcLifecycle, /makeEvent\("npc_lifecycle_recorded"/);
  assert.doesNotMatch(recordNpcMemory, /makeEvent\("npc_memory_recorded"/);
  assert.doesNotMatch(gameCore, /const lifecycle = makeEvent\("npc_lifecycle_recorded", npcId, \{/);
  assert.doesNotMatch(gameCore, /const existingHouseholdForMembers/);
  assert.doesNotMatch(gameCore, /const directMembers = memberNpcIds/);
  assert.doesNotMatch(gameCore, /const existingMemberNpcIds = existingHousehold/);
  assert.doesNotMatch(gameCore, /const sameMembers = existingHousehold/);
  assert.doesNotMatch(gameCore, /household_members_required/);
  assert.doesNotMatch(gameCore, /const organizationName = lifecycleOrganizationName/);
  assert.doesNotMatch(gameCore, /const organizationId = idFactory\("organization", `\$\{npc\.regionId\}:\$\{organizationName\}`\)/);
  assert.doesNotMatch(gameCore, /const existingMembership = \(interimProjection\.organizationMembershipIdsByNpc\[npcId\]/);
  assert.doesNotMatch(gameCore, /const membershipId = idFactory\("organization_membership", `\$\{organizationId\}:\$\{npcId\}:\$\{role\}`\)/);
  assert.doesNotMatch(tickNpcLifecycle, /makeEvent\("npc_canonicalized"/);
  assert.doesNotMatch(tickNpcLifecycle, /makeEvent\("npc_relationship_recorded"/);
  assert.doesNotMatch(tickNpcLifecycle, /makeEvent\("npc_memory_recorded"/);
  assert.doesNotMatch(tickNpcLifecycle, /makeEvent\("npc_asset_changed"/);
  assert.doesNotMatch(tickNpcLifecycle, /makeEvent\("social_hook_created"/);
  assert.doesNotMatch(tickNpcLifecycle, /event\.eventType === "npc_relationship_recorded"/);
  assert.doesNotMatch(tickNpcLifecycle, /event\.eventType === "npc_memory_recorded"/);
  assert.doesNotMatch(tickNpcLifecycle, /event\.eventType === "npc_household_recorded"/);
  assert.doesNotMatch(tickNpcLifecycle, /event\.eventType === "organization_membership_changed"/);
  assert.doesNotMatch(tickNpcLifecycle, /event\.eventType === "npc_career_changed"/);
  assert.doesNotMatch(tickNpcLifecycle, /event\.eventType === "npc_location_changed"/);
  assert.doesNotMatch(tickNpcLifecycle, /event\.eventType === "npc_asset_changed"/);
  assert.doesNotMatch(tickNpcLifecycle, /event\.eventType === "npc_health_recorded"/);
  assert.doesNotMatch(tickNpcLifecycle, /event\.eventType === "social_hook_created"/);
  assert.doesNotMatch(tickNpcLifecycle, /nextProjection\.npcRelationships/);
  assert.doesNotMatch(tickNpcLifecycle, /nextProjection\.npcMemories/);
  assert.doesNotMatch(tickNpcLifecycle, /nextProjection\.households/);
  assert.doesNotMatch(tickNpcLifecycle, /nextProjection\.organizationMemberships/);
  assert.doesNotMatch(tickNpcLifecycle, /nextProjection\.npcCareerRecords/);
  assert.doesNotMatch(tickNpcLifecycle, /nextProjection\.npcLocationRecords/);
  assert.doesNotMatch(tickNpcLifecycle, /nextProjection\.npcAssetStates/);
  assert.doesNotMatch(tickNpcLifecycle, /nextProjection\.npcHealthStates/);
  assert.doesNotMatch(tickNpcLifecycle, /nextProjection\.socialHooks/);
  assert.doesNotMatch(gameCore, /const payload: NpcMemoryRecordedPayload/);
  assert.doesNotMatch(gameCore, /const memoryPayload: NpcMemoryRecordedPayload/);
  assert.doesNotMatch(gameCore, /const payload: NpcRelationshipRecordedPayload/);
  assert.doesNotMatch(gameCore, /const payload: NpcHouseholdRecordedPayload/);
  assert.doesNotMatch(gameCore, /const payload: NpcCareerChangedPayload/);
  assert.doesNotMatch(gameCore, /const payload: NpcLocationChangedPayload/);
  assert.doesNotMatch(gameCore, /const payload: NpcAssetChangedPayload/);
  assert.doesNotMatch(gameCore, /const payload: NpcHealthRecordedPayload/);
  assert.doesNotMatch(gameCore, /记住了一次区域工作状态变化/);
  assert.doesNotMatch(gameCore, /记住了一次家庭关系变化/);
  assert.doesNotMatch(gameCore, /记住了新家庭成员/);
  assert.doesNotMatch(gameCore, /记住了一次健康状态变化/);
  assert.doesNotMatch(gameCore, /Civic Ledger/);
  assert.doesNotMatch(gameCore, /_waystation_/);
});

test("game core delegates relationship and hosted social interaction rules to a focused module", () => {
  assert.ok(
    existsSync(agentInteractionRulesPath),
    "agentInteractionRules.ts should own relationship scores, child NPC bond guards, and hosted social hook reads",
  );
  const gameCore = readFileSync(gameCorePath, "utf8");
  const gameCoreCombat = readFileSync(gameCoreCombatPath, "utf8");
  const gameCoreTurnHosted = readFileSync(gameCoreTurnHostedPath, "utf8");
  const agentInteractionRules = readFileSync(agentInteractionRulesPath, "utf8");

  assert.match(gameCore, /from "\.\/agentInteractionRules\.ts"/);
  assert.match(agentInteractionRules, /export function relationshipScoreDelta/);
  assert.match(agentInteractionRules, /export function diplomacySeed/);
  assert.match(agentInteractionRules, /export function diplomacyProposalFocusSpendPayload/);
  assert.match(agentInteractionRules, /export function diplomacyProposedPayload/);
  assert.match(agentInteractionRules, /export function planDiplomacyProposalEvents/);
  assert.match(agentInteractionRules, /export function diplomacyResponseFocusSpendPayload/);
  assert.match(agentInteractionRules, /export function diplomacyRespondedPayload/);
  assert.match(agentInteractionRules, /export function planDiplomacyResponseEvents/);
  assert.match(agentInteractionRules, /export function planDiplomacyAcceptedRelationshipTraceEvents/);
  assert.match(agentInteractionRules, /export function relationshipFocusSpendPayload/);
  assert.match(agentInteractionRules, /export function relationshipUpdatedPayload/);
  assert.match(agentInteractionRules, /export function planRelationshipUpdateEvents/);
  assert.match(agentInteractionRules, /export function diplomacyTracePayload/);
  assert.match(agentInteractionRules, /export const CHILD_NPC_PROTECTED_BOND_KINDS/);
  assert.match(agentInteractionRules, /export function isChildNpc/);
  assert.match(agentInteractionRules, /export function assertChildNpcBondAllowed/);
  assert.match(agentInteractionRules, /export function agentNpcBondScoreDelta/);
  assert.match(agentInteractionRules, /export function agentNpcBondFocusSpendPayload/);
  assert.match(agentInteractionRules, /export function agentNpcBondUpdatedPayload/);
  assert.match(agentInteractionRules, /export function planAgentNpcBondUpdateEvents/);
  assert.match(agentInteractionRules, /export function socialHookDraftForLifecycle/);
  assert.match(agentInteractionRules, /export function socialHookCreatedPayload/);
  assert.match(agentInteractionRules, /export function hostedSocialHookScoreDelta/);
  assert.match(agentInteractionRules, /export function hostedSocialHookBondPayload/);
  assert.match(agentInteractionRules, /export function hostedSocialHookMemoryPayload/);
  assert.match(agentInteractionRules, /export function hostedSocialHookInfluencePayload/);
  assert.match(agentInteractionRules, /export function planHostedSocialHookSideEffectEvents/);
  assert.match(agentInteractionRules, /export function consumedSocialHookIdsForAgentRegion/);

  const proposeDiplomacy = gameCoreCombat.match(/function proposeDiplomacy[\s\S]*?(?=\n  function respondDiplomacy)/)?.[0] || "";
  const respondDiplomacy = gameCoreCombat.match(/function respondDiplomacy[\s\S]*?(?=\n\n  function updateRelationship)/)?.[0] || "";
  const updateRelationship = gameCoreCombat.match(/function updateRelationship[\s\S]*?(?=\n  function updateAgentNpcBond)/)?.[0] || "";
  const updateAgentNpcBond = gameCoreCombat.match(/function updateAgentNpcBond[\s\S]*?(?=\n  return \{)/)?.[0] || "";
  const submitHostedAction = gameCoreTurnHosted.match(/function submitHostedAction[\s\S]*?(?=\n  return \{)/)?.[0] || "";
  assert.ok(proposeDiplomacy, "proposeDiplomacy should stay discoverable for boundary checks");
  assert.ok(respondDiplomacy, "respondDiplomacy should stay discoverable for boundary checks");
  assert.ok(updateRelationship, "updateRelationship should stay discoverable for boundary checks");
  assert.ok(updateAgentNpcBond, "updateAgentNpcBond should stay discoverable for boundary checks");
  assert.ok(submitHostedAction, "submitHostedAction should stay discoverable for boundary checks");
  assert.match(proposeDiplomacy, /planDiplomacyProposalEvents/);
  assert.match(respondDiplomacy, /planDiplomacyResponseEvents/);
  assert.match(respondDiplomacy, /planDiplomacyAcceptedRelationshipTraceEvents/);
  assert.match(updateRelationship, /planRelationshipUpdateEvents/);
  assert.match(updateAgentNpcBond, /planAgentNpcBondUpdateEvents/);
  assert.match(submitHostedAction, /planHostedSocialHookSideEffectEvents/);

  assert.doesNotMatch(gameCore, /function relationshipScoreDelta/);
  assert.doesNotMatch(gameCore, /function diplomacySeed/);
  assert.doesNotMatch(gameCore, /type DiplomacyProposedPayload/);
  assert.doesNotMatch(gameCore, /type DiplomacyRespondedPayload/);
  assert.doesNotMatch(gameCore, /type RelationshipUpdatedPayload/);
  assert.doesNotMatch(gameCore, /const payload: DiplomacyProposedPayload/);
  assert.doesNotMatch(gameCore, /const responsePayload: DiplomacyRespondedPayload/);
  assert.doesNotMatch(gameCore, /const relationshipPayload: RelationshipUpdatedPayload/);
  assert.doesNotMatch(gameCore, /const payload: RelationshipUpdatedPayload/);
  assert.doesNotMatch(gameCore, /const tracePayload: TraceCreatedPayload/);
  assert.doesNotMatch(gameCore, /title: `外交链 \$\{diplomacyId\}`/);
  assert.doesNotMatch(gameCore, /接受 \$\{diplomacy\.sourceAgentId\}/);
  assert.doesNotMatch(gameCore, /sourceAggregateId: diplomacyId/);
  assert.doesNotMatch(gameCore, /const CHILD_NPC_PROTECTED_BOND_KINDS/);
  assert.doesNotMatch(gameCore, /function isChildNpc/);
  assert.doesNotMatch(gameCore, /function assertChildNpcBondAllowed/);
  assert.doesNotMatch(gameCore, /function agentNpcBondScoreDelta/);
  assert.doesNotMatch(gameCore, /function hostedSocialHookScoreDelta/);
  assert.doesNotMatch(gameCore, /function socialHookDraftForLifecycle/);
  assert.doesNotMatch(gameCore, /const payload: SocialHookCreatedPayload/);
  assert.doesNotMatch(gameCore, /家庭来信/);
  assert.doesNotMatch(gameCore, /家庭义务/);
  assert.doesNotMatch(gameCore, /迁徙传闻/);
  assert.doesNotMatch(gameCore, /处理社交钩子“/);
  assert.doesNotMatch(gameCore, /const payload: AgentNpcBondUpdatedPayload/);
  assert.doesNotMatch(gameCore, /const bondPayload: AgentNpcBondUpdatedPayload/);
  assert.doesNotMatch(submitHostedAction, /hostedSocialHookBondPayload/);
  assert.doesNotMatch(submitHostedAction, /hostedSocialHookMemoryPayload/);
  assert.doesNotMatch(submitHostedAction, /hostedSocialHookInfluencePayload/);
  assert.doesNotMatch(submitHostedAction, /makeEvent\("agent_npc_bond_updated"/);
  assert.doesNotMatch(submitHostedAction, /makeEvent\("npc_memory_recorded"/);
  assert.doesNotMatch(submitHostedAction, /regionInfluenceChangedEvent\(makeEvent/);
  assert.doesNotMatch(gameCore, /function consumedSocialHookIdsForAgentRegion/);
  assert.doesNotMatch(proposeDiplomacy, /resourceSpentEvent\(makeEvent/);
  assert.doesNotMatch(proposeDiplomacy, /diplomacyProposalFocusSpendPayload/);
  assert.doesNotMatch(proposeDiplomacy, /diplomacyProposedPayload/);
  assert.doesNotMatch(proposeDiplomacy, /makeEvent\("diplomacy_proposed"/);
  assert.doesNotMatch(proposeDiplomacy, /reason: `diplomacy_propose:\$\{diplomacyId\}`/);
  assert.doesNotMatch(proposeDiplomacy, /balanceAfter: focusBalance - focusSpent/);
  assert.doesNotMatch(respondDiplomacy, /reason: `diplomacy_response:\$\{diplomacyId\}`/);
  assert.doesNotMatch(respondDiplomacy, /balanceAfter: focusBalance - focusSpent/);
  assert.doesNotMatch(respondDiplomacy, /resourceSpentEvent\(makeEvent/);
  assert.doesNotMatch(respondDiplomacy, /diplomacyResponseFocusSpendPayload/);
  assert.doesNotMatch(respondDiplomacy, /diplomacyRespondedPayload/);
  assert.doesNotMatch(respondDiplomacy, /makeEvent\("diplomacy_responded"/);
  assert.doesNotMatch(respondDiplomacy, /relationshipUpdatedPayload/);
  assert.doesNotMatch(respondDiplomacy, /makeEvent\("relationship_updated"/);
  assert.doesNotMatch(respondDiplomacy, /diplomacyTracePayload/);
  assert.doesNotMatch(respondDiplomacy, /traceCreatedEvent\(makeEvent/);
  assert.doesNotMatch(updateRelationship, /reason: `relationship_update:\$\{relationshipId\}`/);
  assert.doesNotMatch(updateRelationship, /balanceAfter: focusBalance - focusSpent/);
  assert.doesNotMatch(updateRelationship, /resourceSpentEvent\(makeEvent/);
  assert.doesNotMatch(updateRelationship, /relationshipUpdatedPayload/);
  assert.doesNotMatch(updateRelationship, /makeEvent\("relationship_updated"/);
  assert.doesNotMatch(updateAgentNpcBond, /reason: `agent_npc_bond:\$\{bondId\}`/);
  assert.doesNotMatch(updateAgentNpcBond, /balanceAfter: focusBalance - focusSpent/);
  assert.doesNotMatch(updateAgentNpcBond, /resourceSpentEvent\(makeEvent/);
  assert.doesNotMatch(updateAgentNpcBond, /agentNpcBondUpdatedPayload/);
  assert.doesNotMatch(updateAgentNpcBond, /makeEvent\("agent_npc_bond_updated"/);
});

test("game core delegates command rejection abuse scoring to a focused module", () => {
  assert.ok(
    existsSync(commandAbuseRulesPath),
    "commandAbuseRules.ts should own rejected-command abuse score classification",
  );
  const gameCore = readFileSync(gameCorePath, "utf8");
  const commandAbuseRules = readFileSync(commandAbuseRulesPath, "utf8");

  assert.match(gameCore, /from "\.\/commandAbuseRules\.ts"/);
  assert.match(commandAbuseRules, /export function abuseScoreForRejectedCommand/);
  assert.match(commandAbuseRules, /export function commandRejectedPayload/);
  assert.match(commandAbuseRules, /export function abuseScoreChangedPayload/);
  assert.match(commandAbuseRules, /export function planCommandRejectedEvents/);
  assert.match(commandAbuseRules, /export function projectCommandRejectedEvent/);
  const recordCommandRejected = gameCore.match(/function recordCommandRejected[\s\S]*?(?=\n  function claimNewsLegend)/)?.[0] || "";
  assert.ok(recordCommandRejected, "recordCommandRejected should stay discoverable for boundary checks");
  assert.match(recordCommandRejected, /planCommandRejectedEvents/);
  assert.match(recordCommandRejected, /projectCommandRejectedEvent/);

  assert.doesNotMatch(gameCore, /function abuseScoreForRejectedCommand/);
  assert.doesNotMatch(gameCore, /errorCode\.endsWith\("_owner_mismatch"\)/);
  assert.doesNotMatch(gameCore, /type CommandRejectedPayload/);
  assert.doesNotMatch(gameCore, /type AbuseScoreChangedPayload/);
  assert.doesNotMatch(gameCore, /const payload: CommandRejectedPayload/);
  assert.doesNotMatch(gameCore, /const scorePayload: AbuseScoreChangedPayload/);
  assert.doesNotMatch(recordCommandRejected, /commandRejectedPayload/);
  assert.doesNotMatch(recordCommandRejected, /abuseScoreChangedPayload/);
  assert.doesNotMatch(recordCommandRejected, /makeEvent\("command_rejected"/);
  assert.doesNotMatch(recordCommandRejected, /makeEvent\("abuse_score_changed"/);
  assert.doesNotMatch(recordCommandRejected, /current\.abuseScores/);
});

test("game core delegates objective and anomaly normalization rules to a focused module", () => {
  assert.ok(
    existsSync(encounterRulesPath),
    "encounterRules.ts should own objective reward and anomaly normalization",
  );
  const gameCore = readFileSync(gameCorePath, "utf8");
  const encounterRules = readFileSync(encounterRulesPath, "utf8");
  const createContestedObjective = gameCore.match(/function createContestedObjective[\s\S]*?(?=\n  function contributeContestedObjective)/)?.[0] || "";
  const contributeContestedObjective = gameCore.match(/function contributeContestedObjective[\s\S]*?(?=\n  function settleContestedObjective)/)?.[0] || "";
  const settleContestedObjective = gameCore.match(/function settleContestedObjective[\s\S]*?(?=\n  function createResourceNode)/)?.[0] || "";
  const createAnomalyEvent = gameCore.match(/function createAnomalyEvent[\s\S]*?(?=\n  function contestAnomalyEvent)/)?.[0] || "";
  const contestAnomalyEvent = gameCore.match(/function contestAnomalyEvent[\s\S]*?(?=\n  function resolveAnomalyEvent)/)?.[0] || "";
  const resolveAnomalyEvent = gameCore.match(/function resolveAnomalyEvent[\s\S]*?(?=\n  function createInventoryItem)/)?.[0] || "";
  assert.ok(createContestedObjective, "createContestedObjective should stay discoverable for focused boundary checks");
  assert.ok(contributeContestedObjective, "contributeContestedObjective should stay discoverable for focused boundary checks");
  assert.ok(settleContestedObjective, "settleContestedObjective should stay discoverable for focused boundary checks");
  assert.ok(createAnomalyEvent, "createAnomalyEvent should stay discoverable for focused boundary checks");
  assert.ok(contestAnomalyEvent, "contestAnomalyEvent should stay discoverable for focused boundary checks");
  assert.ok(resolveAnomalyEvent, "resolveAnomalyEvent should stay discoverable for focused boundary checks");

  assert.match(gameCore, /from "\.\/encounterRules\.ts"/);
  assert.match(encounterRules, /export const OBJECTIVE_SCORE_WEIGHT/);
  assert.match(encounterRules, /export function objectiveScoreDelta/);
  assert.match(encounterRules, /export function requireObjective/);
  assert.match(encounterRules, /export function requireActiveObjective/);
  assert.match(encounterRules, /export function normalizeObjectiveReward/);
  assert.match(encounterRules, /export function contestedObjectiveCreatedPayload/);
  assert.match(encounterRules, /export function planContestedObjectiveCreationEvents/);
  assert.match(encounterRules, /export function projectContestedObjectiveCreation/);
  assert.match(encounterRules, /export function contestedObjectiveContributionSpendPayload/);
  assert.match(encounterRules, /export function contestedObjectiveContributionPayload/);
  assert.match(encounterRules, /export function planContestedObjectiveContributionEvents/);
  assert.match(encounterRules, /export function projectContestedObjectiveContribution/);
  assert.match(encounterRules, /export function contestedObjectiveSettlementPayload/);
  assert.match(encounterRules, /export function planContestedObjectiveSettlementEvents/);
  assert.match(encounterRules, /export function projectContestedObjectiveSettlement/);
  assert.match(encounterRules, /export function contestedObjectiveSettlementRewardGrantPayload/);
  assert.match(encounterRules, /export function contestedObjectiveSettlementInfluencePayload/);
  assert.match(encounterRules, /export function contestedObjectiveSettlementTracePayload/);
  assert.match(encounterRules, /export function assertAnomalySeverity/);
  assert.match(encounterRules, /export function normalizeAnomalyReward/);
  assert.match(encounterRules, /export const ANOMALY_FOCUS_SCORE/);
  assert.match(encounterRules, /export function anomalyScoreDelta/);
  assert.match(encounterRules, /export function anomalyEventSpawnedPayload/);
  assert.match(encounterRules, /export function planAnomalyEventSpawnEvents/);
  assert.match(encounterRules, /export function projectAnomalyEventSpawn/);
  assert.match(encounterRules, /export function anomalyEventContestFocusSpendPayload/);
  assert.match(encounterRules, /export function anomalyEventContestPayload/);
  assert.match(encounterRules, /export function planAnomalyEventContestEvents/);
  assert.match(encounterRules, /export function projectAnomalyEventContest/);
  assert.match(encounterRules, /export function anomalyEventResolutionPayload/);
  assert.match(encounterRules, /export function planAnomalyEventResolutionEvents/);
  assert.match(encounterRules, /export function projectAnomalyEventResolution/);
  assert.match(encounterRules, /export function anomalyEventResolutionRewardGrantPayload/);
  assert.match(encounterRules, /export function anomalyEventResolutionInfluencePayload/);
  assert.match(encounterRules, /export function anomalyEventResolutionTracePayload/);
  assert.match(encounterRules, /export function normalizeAnomalyMedia/);
  assert.match(encounterRules, /export function requireAnomalyEvent/);
  assert.match(encounterRules, /export function requireOpenAnomalyEvent/);
  assert.match(encounterRules, /export function openAnomalyEventForRegion/);

  assert.doesNotMatch(gameCore, /const OBJECTIVE_SCORE_WEIGHT/);
  assert.doesNotMatch(gameCore, /type ContestedObjectiveCreatedPayload/);
  assert.doesNotMatch(gameCore, /type ContestedObjectiveContributedPayload/);
  assert.doesNotMatch(gameCore, /type ContestedObjectiveSettledPayload/);
  assert.doesNotMatch(gameCore, /const payload: ContestedObjectiveCreatedPayload/);
  assert.doesNotMatch(gameCore, /amount \* OBJECTIVE_SCORE_WEIGHT/);
  assert.doesNotMatch(gameCore, /objective_settlement:\$\{objectiveId\}/);
  assert.doesNotMatch(gameCore, /分胜出/);
  assert.match(createContestedObjective, /planContestedObjectiveCreationEvents/);
  assert.match(createContestedObjective, /projectContestedObjectiveCreation/);
  assert.doesNotMatch(createContestedObjective, /contestedObjectiveCreatedPayload/);
  assert.doesNotMatch(createContestedObjective, /makeEvent\("contested_objective_created"/);
  assert.doesNotMatch(createContestedObjective, /nextProjection\.contestedObjectives\[objectiveId\]/);
  assert.match(contributeContestedObjective, /planContestedObjectiveContributionEvents/);
  assert.match(contributeContestedObjective, /projectContestedObjectiveContribution/);
  assert.doesNotMatch(contributeContestedObjective, /resourceSpentEvent/);
  assert.doesNotMatch(contributeContestedObjective, /contestedObjectiveContributionSpendPayload/);
  assert.doesNotMatch(contributeContestedObjective, /contestedObjectiveContributionPayload/);
  assert.doesNotMatch(contributeContestedObjective, /makeEvent\("contested_objective_contributed"/);
  assert.doesNotMatch(contributeContestedObjective, /nextProjection\.contestedObjectives\[objectiveId\]/);
  assert.doesNotMatch(contributeContestedObjective, /reason: `objective_contribution:\$\{objectiveId\}`/);
  assert.doesNotMatch(contributeContestedObjective, /balanceAfter: balance - amount/);
  assert.match(settleContestedObjective, /planContestedObjectiveSettlementEvents/);
  assert.match(settleContestedObjective, /projectContestedObjectiveSettlement/);
  assert.doesNotMatch(settleContestedObjective, /contestedObjectiveSettlementPayload/);
  assert.doesNotMatch(settleContestedObjective, /contestedObjectiveSettlementRewardGrantPayload/);
  assert.doesNotMatch(settleContestedObjective, /contestedObjectiveSettlementInfluencePayload/);
  assert.doesNotMatch(settleContestedObjective, /contestedObjectiveSettlementTracePayload/);
  assert.doesNotMatch(settleContestedObjective, /makeEvent\("contested_objective_settled"/);
  assert.doesNotMatch(settleContestedObjective, /resourceGrantedEvent/);
  assert.doesNotMatch(settleContestedObjective, /regionInfluenceChangedEvent/);
  assert.doesNotMatch(settleContestedObjective, /traceCreatedEvent/);
  assert.doesNotMatch(settleContestedObjective, /nextProjection\.contestedObjectives\[objectiveId\]/);
  assert.doesNotMatch(settleContestedObjective, /balanceAfter: currentBalance\(current, winner\.agentId, reward\.resourceId\) \+ reward\.amount/);
  assert.doesNotMatch(gameCore, /function normalizeObjectiveReward/);
  assert.doesNotMatch(gameCore, /function requireObjective/);
  assert.doesNotMatch(gameCore, /function requireActiveObjective/);
  assert.doesNotMatch(gameCore, /function assertAnomalySeverity/);
  assert.doesNotMatch(gameCore, /function normalizeAnomalyReward/);
  assert.doesNotMatch(gameCore, /const ANOMALY_FOCUS_SCORE/);
  assert.doesNotMatch(gameCore, /type AnomalyEventSpawnedPayload/);
  assert.doesNotMatch(gameCore, /type AnomalyEventContestedPayload/);
  assert.doesNotMatch(gameCore, /type AnomalyEventResolvedPayload/);
  assert.doesNotMatch(gameCore, /const payload: AnomalyEventSpawnedPayload/);
  assert.doesNotMatch(gameCore, /focusSpent \* ANOMALY_FOCUS_SCORE/);
  assert.doesNotMatch(gameCore, /anomaly_event_resolution:\$\{anomalyId\}/);
  assert.doesNotMatch(gameCore, /完成异常压制/);
  assert.match(createAnomalyEvent, /planAnomalyEventSpawnEvents/);
  assert.match(createAnomalyEvent, /projectAnomalyEventSpawn/);
  assert.doesNotMatch(createAnomalyEvent, /anomalyEventSpawnedPayload/);
  assert.doesNotMatch(createAnomalyEvent, /makeEvent\("anomaly_event_spawned"/);
  assert.doesNotMatch(createAnomalyEvent, /nextProjection\.anomalyEvents\[anomalyId\]/);
  assert.match(contestAnomalyEvent, /planAnomalyEventContestEvents/);
  assert.match(contestAnomalyEvent, /projectAnomalyEventContest/);
  assert.doesNotMatch(contestAnomalyEvent, /resourceSpentEvent/);
  assert.doesNotMatch(contestAnomalyEvent, /anomalyEventContestFocusSpendPayload/);
  assert.doesNotMatch(contestAnomalyEvent, /anomalyEventContestPayload/);
  assert.doesNotMatch(contestAnomalyEvent, /makeEvent\("anomaly_event_contested"/);
  assert.doesNotMatch(contestAnomalyEvent, /nextProjection\.anomalyEvents\[anomalyId\]/);
  assert.doesNotMatch(contestAnomalyEvent, /reason: `anomaly_event_contest:\$\{anomalyId\}`/);
  assert.doesNotMatch(contestAnomalyEvent, /balanceAfter: focusBalance - focusSpent/);
  assert.match(resolveAnomalyEvent, /planAnomalyEventResolutionEvents/);
  assert.match(resolveAnomalyEvent, /projectAnomalyEventResolution/);
  assert.doesNotMatch(resolveAnomalyEvent, /anomalyEventResolutionPayload/);
  assert.doesNotMatch(resolveAnomalyEvent, /anomalyEventResolutionRewardGrantPayload/);
  assert.doesNotMatch(resolveAnomalyEvent, /anomalyEventResolutionInfluencePayload/);
  assert.doesNotMatch(resolveAnomalyEvent, /anomalyEventResolutionTracePayload/);
  assert.doesNotMatch(resolveAnomalyEvent, /makeEvent\("anomaly_event_resolved"/);
  assert.doesNotMatch(resolveAnomalyEvent, /resourceGrantedEvent/);
  assert.doesNotMatch(resolveAnomalyEvent, /regionInfluenceChangedEvent/);
  assert.doesNotMatch(resolveAnomalyEvent, /traceCreatedEvent/);
  assert.doesNotMatch(resolveAnomalyEvent, /nextProjection\.anomalyEvents\[anomalyId\]/);
  assert.doesNotMatch(resolveAnomalyEvent, /balanceAfter: currentBalance\(current, winner\.agentId, reward\.resourceId\) \+ reward\.amount/);
  assert.doesNotMatch(gameCore, /function normalizeAnomalyMedia/);
  assert.doesNotMatch(gameCore, /function requireAnomalyEvent/);
  assert.doesNotMatch(gameCore, /function requireOpenAnomalyEvent/);
  assert.doesNotMatch(gameCore, /function openAnomalyEventForRegion/);
  assert.doesNotMatch(gameCore, /anomaly_media_palette_too_small/);
});

test("game core delegates resource node scoring and cooldown rules to a focused module", () => {
  assert.ok(
    existsSync(resourceNodeRulesPath),
    "resourceNodeRules.ts should own resource-node scoring, cooldown, and equipment bonus rules",
  );
  const gameCore = readFileSync(gameCorePath, "utf8");
  const resourceNodeRules = readFileSync(resourceNodeRulesPath, "utf8");
  const contestResourceNode = gameCore.match(/function contestResourceNode[\s\S]*?(?=\n  function settleResourceNode)/)?.[0] || "";
  const settleResourceNode = gameCore.match(/function settleResourceNode[\s\S]*?(?=\n  function createAnomalyEvent)/)?.[0] || "";
  assert.ok(contestResourceNode, "contestResourceNode should stay discoverable for focused boundary checks");
  assert.ok(settleResourceNode, "settleResourceNode should stay discoverable for focused boundary checks");

  assert.match(gameCore, /from "\.\/resourceNodeRules\.ts"/);
  const createResourceNode = gameCore.match(/function createResourceNode[\s\S]*?(?=\n  function contestResourceNode)/)?.[0] || "";
  assert.match(resourceNodeRules, /export const RESOURCE_NODE_STAMINA_SCORE/);
  assert.match(resourceNodeRules, /export const RESOURCE_NODE_SPAWN_COOLDOWN_SECONDS/);
  assert.match(resourceNodeRules, /export function resourceNodeBaseScoreDelta/);
  assert.match(resourceNodeRules, /export function resourceNodeSpawnCooldownRemainingSeconds/);
  assert.match(resourceNodeRules, /export function requireResourceNode/);
  assert.match(resourceNodeRules, /export function requireOpenResourceNode/);
  assert.match(resourceNodeRules, /export function openResourceNodeForRegion/);
  assert.match(resourceNodeRules, /export function latestResourceNodeSettlementAt/);
  assert.match(resourceNodeRules, /export function resourceNodeEquipmentBonus/);
  assert.match(resourceNodeRules, /export function resourceNodeSpawnedPayload/);
  assert.match(resourceNodeRules, /export function planResourceNodeSpawnEvents/);
  assert.match(resourceNodeRules, /export function projectResourceNodeSpawn/);
  assert.match(resourceNodeRules, /export function resourceNodeContestStaminaSpendPayload/);
  assert.match(resourceNodeRules, /export function resourceNodeContestPayload/);
  assert.match(resourceNodeRules, /export function planResourceNodeContestEvents/);
  assert.match(resourceNodeRules, /export function projectResourceNodeContest/);
  assert.match(resourceNodeRules, /export function resourceNodeSettlementPayload/);
  assert.match(resourceNodeRules, /export function planResourceNodeSettlementEvents/);
  assert.match(resourceNodeRules, /export function projectResourceNodeSettlement/);
  assert.match(resourceNodeRules, /export function resourceNodeSettlementRewardGrantPayload/);
  assert.match(resourceNodeRules, /export function resourceNodeSettlementInfluencePayload/);
  assert.match(resourceNodeRules, /export function resourceNodeSettlementTracePayload/);

  assert.doesNotMatch(gameCore, /const RESOURCE_NODE_STAMINA_SCORE/);
  assert.doesNotMatch(gameCore, /const RESOURCE_NODE_SPAWN_COOLDOWN_SECONDS/);
  assert.doesNotMatch(gameCore, /function requireResourceNode/);
  assert.doesNotMatch(gameCore, /function requireOpenResourceNode/);
  assert.doesNotMatch(gameCore, /function openResourceNodeForRegion/);
  assert.doesNotMatch(gameCore, /function latestResourceNodeSettlementAt/);
  assert.doesNotMatch(gameCore, /function resourceNodeEquipmentBonus/);
  assert.doesNotMatch(gameCore, /type ResourceNodeSpawnedPayload/);
  assert.doesNotMatch(gameCore, /const baseScoreDelta = resourceNodeBaseScoreDelta/);
  assert.doesNotMatch(gameCore, /type ResourceNodeContestedPayload/);
  assert.doesNotMatch(gameCore, /type ResourceNodeSettledPayload/);
  assert.doesNotMatch(gameCore, /const payload: ResourceNodeSpawnedPayload/);
  assert.doesNotMatch(gameCore, /resource_node_settlement:\$\{nodeId\}/);
  assert.doesNotMatch(gameCore, /取得资源点/);
  assert.doesNotMatch(gameCore, /staminaSpent \* RESOURCE_NODE_STAMINA_SCORE/);
  assert.ok(createResourceNode, "createResourceNode should stay discoverable for focused boundary checks");
  assert.match(createResourceNode, /planResourceNodeSpawnEvents/);
  assert.match(createResourceNode, /projectResourceNodeSpawn/);
  assert.doesNotMatch(createResourceNode, /resourceNodeSpawnedPayload/);
  assert.doesNotMatch(createResourceNode, /makeEvent\("resource_node_spawned"/);
  assert.doesNotMatch(createResourceNode, /nextProjection\.resourceNodes\[nodeId\]/);
  assert.match(contestResourceNode, /planResourceNodeContestEvents/);
  assert.match(contestResourceNode, /projectResourceNodeContest/);
  assert.doesNotMatch(contestResourceNode, /resourceSpentEvent/);
  assert.doesNotMatch(contestResourceNode, /resourceNodeContestStaminaSpendPayload/);
  assert.doesNotMatch(contestResourceNode, /resourceNodeContestPayload/);
  assert.doesNotMatch(contestResourceNode, /makeEvent\("resource_node_contested"/);
  assert.doesNotMatch(contestResourceNode, /nextProjection\.resourceNodes\[nodeId\]/);
  assert.doesNotMatch(contestResourceNode, /reason: `resource_node_contest:\$\{nodeId\}`/);
  assert.doesNotMatch(contestResourceNode, /balanceAfter: staminaBalance - staminaSpent/);
  assert.match(settleResourceNode, /planResourceNodeSettlementEvents/);
  assert.match(settleResourceNode, /projectResourceNodeSettlement/);
  assert.doesNotMatch(settleResourceNode, /resourceNodeSettlementPayload/);
  assert.doesNotMatch(settleResourceNode, /resourceNodeSettlementRewardGrantPayload/);
  assert.doesNotMatch(settleResourceNode, /resourceNodeSettlementInfluencePayload/);
  assert.doesNotMatch(settleResourceNode, /resourceNodeSettlementTracePayload/);
  assert.doesNotMatch(settleResourceNode, /makeEvent\("resource_node_settled"/);
  assert.doesNotMatch(settleResourceNode, /resourceGrantedEvent/);
  assert.doesNotMatch(settleResourceNode, /regionInfluenceChangedEvent/);
  assert.doesNotMatch(settleResourceNode, /traceCreatedEvent/);
  assert.doesNotMatch(settleResourceNode, /nextProjection\.resourceNodes\[nodeId\]/);
  assert.doesNotMatch(settleResourceNode, /balanceAfter: currentBalance\(current, winner\.agentId, reward\.resourceId\) \+ reward\.amount/);
});

test("game core delegates season contribution scoring rules to a focused module", () => {
  assert.ok(
    existsSync(seasonCampaignRulesPath),
    "seasonCampaignRules.ts should own season contribution scoring and objective completion payload rules",
  );
  const gameCore = readFileSync(gameCorePath, "utf8");
  const seasonCampaignRules = readFileSync(seasonCampaignRulesPath, "utf8");
  const createSeasonCampaign = gameCore.match(/function createSeasonCampaign[\s\S]*?(?=\n  function contributeSeasonCampaign)/)?.[0] || "";
  const contributeSeasonCampaign = gameCore.match(/function contributeSeasonCampaign[\s\S]*?(?=\n  function settleSeasonCampaign)/)?.[0] || "";
  const settleSeasonCampaign = gameCore.match(/function settleSeasonCampaign[\s\S]*?(?=\n  function createMarketOrder)/)?.[0] || "";
  const claimReleasedRegionControl = gameCore.match(/function claimReleasedRegionControl[\s\S]*?(?=\n  function resolveRegionRevolt)/)?.[0] || "";
  const resolveRegionRevolt = gameCore.match(/function resolveRegionRevolt[\s\S]*?(?=\n  function recordCommandRejected)/)?.[0] || "";
  assert.ok(createSeasonCampaign, "createSeasonCampaign should stay discoverable for focused boundary checks");
  assert.ok(contributeSeasonCampaign, "contributeSeasonCampaign should stay discoverable for focused boundary checks");
  assert.ok(settleSeasonCampaign, "settleSeasonCampaign should stay discoverable for focused boundary checks");
  assert.ok(claimReleasedRegionControl, "claimReleasedRegionControl should stay discoverable for focused boundary checks");
  assert.ok(resolveRegionRevolt, "resolveRegionRevolt should stay discoverable for focused boundary checks");

  assert.match(gameCore, /from "\.\/seasonCampaignRules\.ts"/);
  assert.match(seasonCampaignRules, /export const TRAINING_HALL_SEASON_BONUS_SCORE/);
  assert.match(seasonCampaignRules, /export const REGION_CONTROL_SEASON_BONUS_SCORE/);
  assert.match(seasonCampaignRules, /export const REGION_CONTROL_SEASON_BONUS_MAX_SCORE/);
  assert.match(seasonCampaignRules, /export const REGION_REVOLT_DEFENDER_BASE_POWER/);
  assert.match(seasonCampaignRules, /export const TRUSTED_SEASON_TRUST_CLASSES/);
  assert.match(seasonCampaignRules, /export const SEASON_TRUST_CLASS_ORDER/);
  assert.match(seasonCampaignRules, /export function normalizeSeasonTrustBreakdown/);
  assert.match(seasonCampaignRules, /export function dominantSeasonTrustClass/);
  assert.match(seasonCampaignRules, /export function addSeasonTrustScore/);
  assert.match(seasonCampaignRules, /export function trustedSeasonScoreDelta/);
  assert.match(seasonCampaignRules, /export function regionControlBonusRegionIdsForSeasonContribution/);
  assert.match(seasonCampaignRules, /export function agentSeasonStandingForRegion/);
  assert.match(seasonCampaignRules, /export function requireSeasonCampaign/);
  assert.match(seasonCampaignRules, /export function requireActiveSeasonCampaign/);
  assert.match(seasonCampaignRules, /export function seasonCampaignCreatedPayload/);
  assert.match(seasonCampaignRules, /export function seasonStartedPayload/);
  assert.match(seasonCampaignRules, /export function seasonObjectiveCreatedPayload/);
  assert.match(seasonCampaignRules, /export function planSeasonCampaignCreationEvents/);
  assert.match(seasonCampaignRules, /export function projectSeasonCampaignCreation/);
  assert.match(seasonCampaignRules, /export function seasonContributionSpendPayload/);
  assert.match(seasonCampaignRules, /export function seasonContributionPayload/);
  assert.match(seasonCampaignRules, /export function seasonObjectiveCompletionPayloads/);
  assert.match(seasonCampaignRules, /export function planSeasonCampaignContributionEvents/);
  assert.match(seasonCampaignRules, /export function projectSeasonCampaignContribution/);
  assert.match(seasonCampaignRules, /export function seasonCampaignSettlementPlan/);
  assert.match(seasonCampaignRules, /export function seasonCampaignRewardGrantPayload/);
  assert.match(seasonCampaignRules, /export function seasonCampaignResolvedPayload/);
  assert.match(seasonCampaignRules, /export function planSeasonCampaignSettlementEvents/);
  assert.match(seasonCampaignRules, /export function projectSeasonCampaignSettlement/);
  assert.match(seasonCampaignRules, /export function seasonOrganizationDividendAmount/);
  assert.match(seasonCampaignRules, /export function seasonOrganizationDividendGrantPayload/);
  assert.match(seasonCampaignRules, /export function seasonOrganizationTreasuryPayload/);
  assert.match(seasonCampaignRules, /export function seasonOrganizationPrestigePayload/);
  assert.match(seasonCampaignRules, /export function seasonRegionControlPayload/);
  assert.match(seasonCampaignRules, /export function seasonRegionMonumentPayload/);
  assert.match(seasonCampaignRules, /export function regionControlScoreAfter/);
  assert.match(seasonCampaignRules, /export function regionControlDecayLimit/);
  assert.match(seasonCampaignRules, /export function regionControlDecayAmount/);
  assert.match(seasonCampaignRules, /export function regionControlDecayMinAgeSeconds/);
  assert.match(seasonCampaignRules, /export function regionControlDecayMinScore/);
  assert.match(seasonCampaignRules, /export function selectRegionControlDecayTargets/);
  assert.match(seasonCampaignRules, /export function regionControlDecayPayload/);
  assert.match(seasonCampaignRules, /export function regionControlReleasePayload/);
  assert.match(seasonCampaignRules, /export function planRegionControlDecayEvents/);
  assert.match(seasonCampaignRules, /export function projectRegionControlDecays/);
  assert.match(seasonCampaignRules, /export function latestRegionControlReleaseEvent/);
  assert.match(seasonCampaignRules, /export function releasedRegionClaimControlPayload/);
  assert.match(seasonCampaignRules, /export function planReleasedRegionControlClaimEvents/);
  assert.match(seasonCampaignRules, /export function projectReleasedRegionControlClaim/);
  assert.match(seasonCampaignRules, /export function regionRevoltSettlement/);
  assert.match(seasonCampaignRules, /export function regionRevoltStaminaSpendPayload/);
  assert.match(seasonCampaignRules, /export function regionRevoltResolvedPayload/);
  assert.match(seasonCampaignRules, /export function regionRevoltInfluenceDelta/);
  assert.match(seasonCampaignRules, /export function regionRevoltInfluencePayload/);
  assert.match(seasonCampaignRules, /export function regionRevoltTracePayload/);
  assert.match(seasonCampaignRules, /export function regionRevoltControlPayload/);
  assert.match(seasonCampaignRules, /export function planRegionRevoltResolutionEvents/);
  assert.match(seasonCampaignRules, /export function projectRegionRevoltResolution/);
  assert.match(seasonCampaignRules, /export function seasonResolvedPayload/);

  const decayRegionControls = gameCore.match(/function decayRegionControls[\s\S]*?(?=\n  function claimReleasedRegionControl)/)?.[0] || "";
  assert.ok(decayRegionControls, "decayRegionControls should stay discoverable for boundary checks");

  assert.doesNotMatch(gameCore, /const TRAINING_HALL_SEASON_BONUS_SCORE/);
  assert.doesNotMatch(gameCore, /const REGION_CONTROL_SEASON_BONUS_SCORE/);
  assert.doesNotMatch(gameCore, /const REGION_CONTROL_SEASON_BONUS_MAX_SCORE/);
  assert.doesNotMatch(gameCore, /const REGION_REVOLT_DEFENDER_BASE_POWER/);
  assert.doesNotMatch(gameCore, /const TRUSTED_SEASON_TRUST_CLASSES/);
  assert.doesNotMatch(gameCore, /const SEASON_TRUST_CLASS_ORDER/);
  assert.doesNotMatch(gameCore, /function normalizeSeasonTrustBreakdown/);
  assert.doesNotMatch(gameCore, /function dominantSeasonTrustClass/);
  assert.doesNotMatch(gameCore, /function addSeasonTrustScore/);
  assert.doesNotMatch(gameCore, /function trustedSeasonScoreDelta/);
  assert.doesNotMatch(gameCore, /function regionControlBonusRegionIdsForSeasonContribution/);
  assert.doesNotMatch(gameCore, /function agentSeasonStandingForRegion/);
  assert.doesNotMatch(gameCore, /function latestRegionControlReleaseEvent/);
  assert.doesNotMatch(gameCore, /function requireSeasonCampaign/);
  assert.doesNotMatch(gameCore, /function requireActiveSeasonCampaign/);
  assert.doesNotMatch(gameCore, /type SeasonContributionRecordedPayload/);
  assert.doesNotMatch(gameCore, /type SeasonCampaignCreatedPayload/);
  assert.doesNotMatch(gameCore, /type SeasonStartedPayload/);
  assert.doesNotMatch(gameCore, /type SeasonObjectiveCreatedPayload/);
  assert.doesNotMatch(gameCore, /type SeasonObjectiveCompletedPayload/);
  assert.doesNotMatch(gameCore, /type SeasonCampaignResolvedPayload/);
  assert.doesNotMatch(gameCore, /type SeasonResolvedPayload/);
  assert.doesNotMatch(gameCore, /type RegionControlChangedPayload/);
  assert.doesNotMatch(gameCore, /type RegionControlDecayedPayload/);
  assert.doesNotMatch(gameCore, /type RegionControlReleasedPayload/);
  assert.doesNotMatch(gameCore, /type RegionRevoltResolvedPayload/);
  assert.doesNotMatch(gameCore, /type RegionMonumentBuiltPayload/);
  assert.doesNotMatch(gameCore, /const payload: RegionControlDecayedPayload/);
  assert.doesNotMatch(gameCore, /const releasePayload: RegionControlReleasedPayload/);
  assert.doesNotMatch(gameCore, /const payload: RegionControlChangedPayload/);
  assert.doesNotMatch(gameCore, /const payload: RegionRevoltResolvedPayload/);
  assert.doesNotMatch(gameCore, /const controlPayload: RegionControlChangedPayload/);
  assert.doesNotMatch(gameCore, /const payload: SeasonCampaignCreatedPayload/);
  assert.doesNotMatch(gameCore, /const startedPayload: SeasonStartedPayload/);
  assert.doesNotMatch(gameCore, /const objectivePayload: SeasonObjectiveCreatedPayload/);
  assert.doesNotMatch(gameCore, /sourceAggregateId: revoltId/);
  assert.doesNotMatch(gameCore, /title: `区域起义 \$\{revoltId\}`/);
  assert.doesNotMatch(gameCore, /发起区域起义，结果/);
  assert.doesNotMatch(gameCore, /const defenderPower = releaseEvent\.payload\.previousScore \+ REGION_REVOLT_DEFENDER_BASE_POWER/);
  assert.doesNotMatch(gameCore, /sourceOrganizationUpgradeIds\.length > 0 \? TRAINING_HALL_SEASON_BONUS_SCORE/);
  assert.doesNotMatch(gameCore, /season_objective_completed", objective\.objectiveId/);
  assert.doesNotMatch(gameCore, /const winningFaction = campaign\.factionStandings\[0\]\?\.score > 0/);
  assert.doesNotMatch(gameCore, /const organizationDividendAmount = Math\.max/);
  assert.doesNotMatch(gameCore, /\$\{campaign\.title\}胜利纪念碑/);
  assert.doesNotMatch(gameCore, /description: `\$\{winningFaction\.factionId\} 在 \$\{campaign\.title\}/);
  assert.match(createSeasonCampaign, /planSeasonCampaignCreationEvents/);
  assert.match(createSeasonCampaign, /projectSeasonCampaignCreation/);
  assert.doesNotMatch(createSeasonCampaign, /seasonCampaignCreatedPayload/);
  assert.doesNotMatch(createSeasonCampaign, /seasonStartedPayload/);
  assert.doesNotMatch(createSeasonCampaign, /seasonObjectiveCreatedPayload/);
  assert.doesNotMatch(createSeasonCampaign, /makeEvent\("season_campaign_created"/);
  assert.doesNotMatch(createSeasonCampaign, /makeEvent\("season_started"/);
  assert.doesNotMatch(createSeasonCampaign, /makeEvent\("season_objective_created"/);
  assert.doesNotMatch(createSeasonCampaign, /nextProjection\.seasonCampaigns\[seasonId\]/);
  assert.match(contributeSeasonCampaign, /planSeasonCampaignContributionEvents/);
  assert.match(contributeSeasonCampaign, /projectSeasonCampaignContribution/);
  assert.doesNotMatch(contributeSeasonCampaign, /resourceSpentEvent/);
  assert.doesNotMatch(contributeSeasonCampaign, /seasonContributionSpendPayload/);
  assert.doesNotMatch(contributeSeasonCampaign, /seasonContributionPayload/);
  assert.doesNotMatch(contributeSeasonCampaign, /seasonObjectiveCompletionPayloads/);
  assert.doesNotMatch(contributeSeasonCampaign, /makeEvent\("season_contribution_recorded"/);
  assert.doesNotMatch(contributeSeasonCampaign, /makeEvent\("season_objective_completed"/);
  assert.doesNotMatch(contributeSeasonCampaign, /nextProjection\.seasonCampaigns\[seasonId\]/);
  assert.doesNotMatch(contributeSeasonCampaign, /reason: `season_contribution:\$\{seasonId\}:\$\{factionId\}`/);
  assert.doesNotMatch(contributeSeasonCampaign, /balanceAfter: balance - amount/);
  assert.match(settleSeasonCampaign, /planSeasonCampaignSettlementEvents/);
  assert.match(settleSeasonCampaign, /projectSeasonCampaignSettlement/);
  assert.doesNotMatch(settleSeasonCampaign, /seasonCampaignResolvedPayload/);
  assert.doesNotMatch(settleSeasonCampaign, /seasonCampaignRewardGrantPayload/);
  assert.doesNotMatch(settleSeasonCampaign, /seasonOrganizationDividendAmount/);
  assert.doesNotMatch(settleSeasonCampaign, /seasonOrganizationDividendGrantPayload/);
  assert.doesNotMatch(settleSeasonCampaign, /seasonOrganizationTreasuryPayload/);
  assert.doesNotMatch(settleSeasonCampaign, /seasonOrganizationPrestigePayload/);
  assert.doesNotMatch(settleSeasonCampaign, /seasonRegionControlPayload/);
  assert.doesNotMatch(settleSeasonCampaign, /seasonRegionMonumentPayload/);
  assert.doesNotMatch(settleSeasonCampaign, /seasonResolvedPayload/);
  assert.doesNotMatch(settleSeasonCampaign, /makeEvent\("season_campaign_resolved"/);
  assert.doesNotMatch(settleSeasonCampaign, /makeEvent\("organization_treasury_changed"/);
  assert.doesNotMatch(settleSeasonCampaign, /makeEvent\("organization_prestige_changed"/);
  assert.doesNotMatch(settleSeasonCampaign, /makeEvent\("region_control_changed"/);
  assert.doesNotMatch(settleSeasonCampaign, /makeEvent\("region_monument_built"/);
  assert.doesNotMatch(settleSeasonCampaign, /makeEvent\("season_resolved"/);
  assert.doesNotMatch(settleSeasonCampaign, /nextProjection\.seasonCampaigns\[seasonId\]/);
  assert.doesNotMatch(settleSeasonCampaign, /balanceAfter: currentBalance\(current, winner\.agentId, reward\.resourceId\) \+ reward\.amount/);
  assert.doesNotMatch(settleSeasonCampaign, /reason: `organization_season_dividend:\$\{seasonId\}:\$\{organizationId\}`/);
  assert.doesNotMatch(settleSeasonCampaign, /balanceAfter: currentBalance\(interimProjection, memberAgentId, reward\.resourceId\) \+ organizationDividendAmount/);
  assert.match(claimReleasedRegionControl, /planReleasedRegionControlClaimEvents/);
  assert.match(claimReleasedRegionControl, /projectReleasedRegionControlClaim/);
  assert.doesNotMatch(claimReleasedRegionControl, /releasedRegionClaimControlPayload/);
  assert.doesNotMatch(claimReleasedRegionControl, /makeEvent\("region_control_changed"/);
  assert.doesNotMatch(claimReleasedRegionControl, /nextProjection\.regionControls\[regionId\]/);
  assert.match(resolveRegionRevolt, /planRegionRevoltResolutionEvents/);
  assert.match(resolveRegionRevolt, /projectRegionRevoltResolution/);
  assert.doesNotMatch(resolveRegionRevolt, /reason: `region_revolt:\$\{revoltId\}`/);
  assert.doesNotMatch(resolveRegionRevolt, /balanceAfter: staminaBalance - staminaSpent/);
  assert.doesNotMatch(resolveRegionRevolt, /resourceSpentEvent\(makeEvent/);
  assert.doesNotMatch(resolveRegionRevolt, /regionInfluenceChangedEvent\(makeEvent/);
  assert.doesNotMatch(resolveRegionRevolt, /traceCreatedEvent\(makeEvent/);
  assert.doesNotMatch(resolveRegionRevolt, /makeEvent\("region_revolt_resolved"/);
  assert.doesNotMatch(resolveRegionRevolt, /makeEvent\("region_control_changed"/);
  assert.doesNotMatch(decayRegionControls, /const limit = Math\.max\(0, Math\.min\(Math\.floor\(Number\(input\.limit \?\? 25\)\), 100\)\)/);
  assert.doesNotMatch(decayRegionControls, /const amount = Math\.max\(1, Math\.min\(Math\.floor\(Number\(input\.amount \?\? 1\)\), 100\)\)/);
  assert.doesNotMatch(decayRegionControls, /const minAgeSeconds = Math\.max\(0, Math\.min\(Math\.floor\(Number\(input\.minAgeSeconds \?\? \(7 \* 24 \* 60 \* 60\)\)\), 365 \* 24 \* 60 \* 60\)\)/);
  assert.doesNotMatch(decayRegionControls, /const minScore = Math\.max\(1, Math\.floor\(Number\(input\.minScore \?\? 1\)\)\)/);
  assert.doesNotMatch(decayRegionControls, /const cutoff = new Date\(Date\.parse\(decayedAt\) - \(minAgeSeconds \* 1_000\)\)\.toISOString\(\)/);
  assert.doesNotMatch(decayRegionControls, /const decayedEvents = Object\.values\(current\.regionControls\)/);
  assert.match(decayRegionControls, /planRegionControlDecayEvents/);
  assert.match(decayRegionControls, /projectRegionControlDecays/);
  assert.doesNotMatch(decayRegionControls, /regionControlDecayPayload/);
  assert.doesNotMatch(decayRegionControls, /regionControlReleasePayload/);
  assert.doesNotMatch(decayRegionControls, /makeEvent\("region_control_decayed"/);
  assert.doesNotMatch(decayRegionControls, /makeEvent\("region_control_released"/);
  assert.doesNotMatch(
    decayRegionControls,
    /sort\(\(left, right\) => left\.updatedAt\.localeCompare\(right\.updatedAt\) \|\| left\.regionId\.localeCompare\(right\.regionId\)\)/,
  );
});

test("game core delegates market trade fee and risk rules to a focused module", () => {
  assert.ok(
    existsSync(marketTradeRulesPath),
    "marketTradeRules.ts should own market fee, price-risk, repeat-counterparty, terminal-payload, and refund rules",
  );
  const gameCore = readFileSync(gameCorePath, "utf8");
  const marketTradeRules = readFileSync(marketTradeRulesPath, "utf8");

  assert.match(gameCore, /from "\.\/marketTradeRules\.ts"/);
  assert.match(marketTradeRules, /export const MARKET_TRADE_FEE_BASIS_POINTS/);
  assert.match(marketTradeRules, /export function marketTradeFeeAmount/);
  assert.match(marketTradeRules, /export function marketSellerProceedsAmount/);
  assert.match(marketTradeRules, /export function marketCounterpartyKey/);
  assert.match(marketTradeRules, /export function marketUnitPrice/);
  assert.match(marketTradeRules, /export const DEFAULT_MARKET_REGION_ID/);
  assert.match(marketTradeRules, /export function normalizeMarketRegionId/);
  assert.match(marketTradeRules, /export function requireMarketOrder/);
  assert.match(marketTradeRules, /export function requireOpenMarketOrder/);
  assert.match(marketTradeRules, /export function assertMarketAgentNotRestricted/);
  assert.match(marketTradeRules, /export function marketPriceRiskFlags/);
  assert.match(marketTradeRules, /export function marketTradeRisk/);
  assert.match(marketTradeRules, /export function marketOrderCreatedPayload/);
  assert.match(marketTradeRules, /export function planMarketOrderCreationEvents/);
  assert.match(marketTradeRules, /export function projectMarketOrderCreation/);
  assert.match(marketTradeRules, /export function marketOrderFilledPayload/);
  assert.match(marketTradeRules, /export function planMarketOrderFillEvents/);
  assert.match(marketTradeRules, /export function projectMarketOrderFill/);
  assert.match(marketTradeRules, /export function planMarketOrderCancellationEvents/);
  assert.match(marketTradeRules, /export function projectMarketOrderCancellation/);
  assert.match(marketTradeRules, /export function planMarketOrderExpiryEvents/);
  assert.match(marketTradeRules, /export function projectMarketOrderExpiry/);
  assert.match(marketTradeRules, /export function marketOrderLockSpendPayload/);
  assert.match(marketTradeRules, /export function marketOrderPaymentPayloads/);
  assert.match(marketTradeRules, /export function marketOrderBuyerPaymentSpendPayload/);
  assert.match(marketTradeRules, /export function marketOrderSellerPaymentGrantPayload/);
  assert.match(marketTradeRules, /export function marketOrderGoodsGrantAsset/);
  assert.match(marketTradeRules, /export function marketOrderGoodsGrantPayload/);
  assert.match(marketTradeRules, /export function marketOrderItemTransferPayload/);
  assert.match(marketTradeRules, /export function marketOrderCancelledPayload/);
  assert.match(marketTradeRules, /export function marketExpiryLimit/);
  assert.match(marketTradeRules, /export function marketExpiryMaxAgeSeconds/);
  assert.match(marketTradeRules, /export function selectExpiredMarketOrders/);
  assert.match(marketTradeRules, /export function marketOrderExpiredPayload/);
  assert.match(marketTradeRules, /export function marketOrderRefundAsset/);
  assert.match(marketTradeRules, /export function marketOrderRefundPayload/);

  const tickMarketExpiry = gameCore.match(/function tickMarketExpiry[\s\S]*?(?=\n  function createBounty)/)?.[0] || "";
  assert.ok(tickMarketExpiry, "tickMarketExpiry should stay discoverable for boundary checks");
  const createMarketOrder = gameCore.match(/function createMarketOrder[\s\S]*?(?=\n  function fillMarketOrder)/)?.[0] || "";
  assert.ok(createMarketOrder, "createMarketOrder should stay discoverable for boundary checks");
  const fillMarketOrder = gameCore.match(/function fillMarketOrder[\s\S]*?(?=\n  function cancelMarketOrder)/)?.[0] || "";
  assert.ok(fillMarketOrder, "fillMarketOrder should stay discoverable for boundary checks");
  const cancelMarketOrder = gameCore.match(/function cancelMarketOrder[\s\S]*?(?=\n  function createDirectTrade)/)?.[0] || "";
  assert.ok(cancelMarketOrder, "cancelMarketOrder should stay discoverable for boundary checks");

  assert.doesNotMatch(gameCore, /const MARKET_TRADE_FEE_BASIS_POINTS/);
  assert.doesNotMatch(gameCore, /const DEFAULT_MARKET_REGION_ID/);
  assert.doesNotMatch(gameCore, /function normalizeMarketRegionId/);
  assert.doesNotMatch(gameCore, /function requireMarketOrder/);
  assert.doesNotMatch(gameCore, /function requireOpenMarketOrder/);
  assert.doesNotMatch(gameCore, /function assertMarketAgentNotRestricted/);
  assert.doesNotMatch(gameCore, /function marketTradeFeeAmount/);
  assert.doesNotMatch(gameCore, /function marketCounterpartyKey/);
  assert.doesNotMatch(gameCore, /function marketUnitPrice/);
  assert.doesNotMatch(gameCore, /function marketPriceRiskFlags/);
  assert.doesNotMatch(gameCore, /function marketTradeRisk/);
  assert.doesNotMatch(gameCore, /type MarketOrderCreatedPayload/);
  assert.doesNotMatch(gameCore, /type MarketOrderFilledPayload/);
  assert.doesNotMatch(gameCore, /type MarketOrderCancelledPayload/);
  assert.doesNotMatch(gameCore, /type MarketOrderExpiredPayload/);
  assert.doesNotMatch(gameCore, /const payload: MarketOrderCreatedPayload/);
  assert.doesNotMatch(gameCore, /const sellerProceedsAmount = order\.priceAmount - marketFeeAmount/);
  assert.doesNotMatch(gameCore, /tradeRiskFlags: tradeRisk\.flags/);
  assert.match(createMarketOrder, /planMarketOrderCreationEvents/);
  assert.match(createMarketOrder, /projectMarketOrderCreation/);
  assert.doesNotMatch(createMarketOrder, /marketOrderCreatedPayload/);
  assert.doesNotMatch(createMarketOrder, /marketOrderLockSpendPayload/);
  assert.doesNotMatch(createMarketOrder, /makeEvent\("market_order_created"/);
  assert.doesNotMatch(createMarketOrder, /nextProjection\.marketOrders\[orderId\]/);
  assert.match(fillMarketOrder, /planMarketOrderFillEvents/);
  assert.match(fillMarketOrder, /projectMarketOrderFill/);
  assert.doesNotMatch(fillMarketOrder, /marketOrderBuyerPaymentSpendPayload/);
  assert.doesNotMatch(fillMarketOrder, /marketOrderSellerPaymentGrantPayload/);
  assert.doesNotMatch(fillMarketOrder, /marketOrderPaymentPayloads/);
  assert.doesNotMatch(fillMarketOrder, /marketOrderGoodsGrantPayload/);
  assert.doesNotMatch(fillMarketOrder, /marketOrderItemTransferPayload/);
  assert.doesNotMatch(fillMarketOrder, /marketOrderFilledPayload/);
  assert.doesNotMatch(fillMarketOrder, /makeEvent\("market_order_filled"/);
  assert.doesNotMatch(fillMarketOrder, /itemTransferredEvent/);
  assert.doesNotMatch(fillMarketOrder, /nextProjection\.marketOrders\[orderId\]/);
  assert.doesNotMatch(fillMarketOrder, /const buyerSellBalance = order\.sellResourceId \? currentBalance/);
  assert.match(cancelMarketOrder, /planMarketOrderCancellationEvents/);
  assert.match(cancelMarketOrder, /projectMarketOrderCancellation/);
  assert.doesNotMatch(cancelMarketOrder, /marketOrderRefundAsset/);
  assert.doesNotMatch(cancelMarketOrder, /marketOrderRefundPayload/);
  assert.doesNotMatch(cancelMarketOrder, /marketOrderCancelledPayload/);
  assert.doesNotMatch(cancelMarketOrder, /makeEvent\("market_order_cancelled"/);
  assert.doesNotMatch(cancelMarketOrder, /nextProjection\.marketOrders\[orderId\]/);
  assert.match(tickMarketExpiry, /planMarketOrderExpiryEvents/);
  assert.match(tickMarketExpiry, /projectMarketOrderExpiry/);
  assert.doesNotMatch(tickMarketExpiry, /marketOrderRefundAsset/);
  assert.doesNotMatch(tickMarketExpiry, /marketOrderRefundPayload/);
  assert.doesNotMatch(tickMarketExpiry, /marketOrderExpiredPayload/);
  assert.doesNotMatch(tickMarketExpiry, /makeEvent\("market_order_expired"/);
  assert.doesNotMatch(gameCore, /reason: `market_order_lock:\$\{orderId\}`/);
  assert.doesNotMatch(gameCore, /reason: `market_order_fill:\$\{orderId\}`/);
  assert.doesNotMatch(gameCore, /reason: `market_order_payment:\$\{orderId\}`/);
  assert.doesNotMatch(gameCore, /reason: `market_order_goods:\$\{orderId\}`/);
  assert.doesNotMatch(gameCore, /const cancelledPayload: MarketOrderCancelledPayload/);
  assert.doesNotMatch(gameCore, /const expiredPayload: MarketOrderExpiredPayload/);
  assert.doesNotMatch(tickMarketExpiry, /const maxAgeSeconds = Math\.max\(1, Number\(input\.maxAgeSeconds \|\| 24 \* 60 \* 60\)\)/);
  assert.doesNotMatch(tickMarketExpiry, /const limit = Math\.max\(1, Math\.min\(Number\(input\.limit \|\| 25\), 100\)\)/);
  assert.doesNotMatch(tickMarketExpiry, /const expiredOrders = Object\.values\(current\.marketOrders\)/);
  assert.doesNotMatch(
    tickMarketExpiry,
    /sort\(\(left, right\) => left\.createdAt\.localeCompare\(right\.createdAt\) \|\| left\.orderId\.localeCompare\(right\.orderId\)\)/,
  );
  assert.doesNotMatch(gameCore, /reason: `market_order_cancel:\$\{orderId\}`/);
  assert.doesNotMatch(gameCore, /reason: `market_order_expired:\$\{order\.orderId\}`/);
});

test("game core delegates direct trade asset and risk rules to a focused module", () => {
  assert.ok(
    existsSync(directTradeRulesPath),
    "directTradeRules.ts should own direct-trade asset, repeat-risk, terminal-payload, and refund rules",
  );
  const gameCore = readFileSync(gameCorePath, "utf8");
  const directTradeRules = readFileSync(directTradeRulesPath, "utf8");

  assert.match(gameCore, /from "\.\/directTradeRules\.ts"/);
  assert.match(directTradeRules, /export const DIRECT_TRADE_REPEAT_COUNTERPARTY_WINDOW_SECONDS/);
  assert.match(directTradeRules, /export function directTradeResourceAsset/);
  assert.match(directTradeRules, /export function directTradeItemAsset/);
  assert.match(directTradeRules, /export function directTradeAssetFromPayload/);
  assert.match(directTradeRules, /export function directTradeAssetPayload/);
  assert.match(directTradeRules, /export function directTradeAssetLabel/);
  assert.match(directTradeRules, /export function requireDirectTrade/);
  assert.match(directTradeRules, /export function requireOpenDirectTrade/);
  assert.match(directTradeRules, /export function directTradeRisk/);
  assert.match(directTradeRules, /export function directTradeCreatedPayload/);
  assert.match(directTradeRules, /export function planDirectTradeCreationEvents/);
  assert.match(directTradeRules, /export function projectDirectTradeCreation/);
  assert.match(directTradeRules, /export function directTradeOfferedResourceLockSpendPayload/);
  assert.match(directTradeRules, /export function directTradeRequestedResourcePaymentAsset/);
  assert.match(directTradeRules, /export function directTradeRequestedResourcePaymentPayloads/);
  assert.match(directTradeRules, /export function directTradeRequestedResourcePaymentSpendPayload/);
  assert.match(directTradeRules, /export function directTradeRequestedResourcePaymentGrantPayload/);
  assert.match(directTradeRules, /export function directTradeOfferedResourceGoodsAsset/);
  assert.match(directTradeRules, /export function directTradeOfferedResourceGoodsGrantPayload/);
  assert.match(directTradeRules, /export function directTradeOfferedItemTransferPayload/);
  assert.match(directTradeRules, /export function directTradeRequestedItemTransferPayload/);
  assert.match(directTradeRules, /export function directTradeAcceptedPayload/);
  assert.match(directTradeRules, /export function planDirectTradeAcceptanceEvents/);
  assert.match(directTradeRules, /export function projectDirectTradeAcceptance/);
  assert.match(directTradeRules, /export function directTradeCancelledPayload/);
  assert.match(directTradeRules, /export function planDirectTradeCancellationEvents/);
  assert.match(directTradeRules, /export function projectDirectTradeCancellation/);
  assert.match(directTradeRules, /export function directTradeExpiryLimit/);
  assert.match(directTradeRules, /export function directTradeExpiryMaxAgeSeconds/);
  assert.match(directTradeRules, /export function selectExpiredDirectTradeTargets/);
  assert.match(directTradeRules, /export function directTradeExpiredPayload/);
  assert.match(directTradeRules, /export function planDirectTradeExpiryEvents/);
  assert.match(directTradeRules, /export function projectDirectTradeExpiry/);
  assert.match(directTradeRules, /export function directTradeOfferedResourceRefundAsset/);
  assert.match(directTradeRules, /export function directTradeOfferedResourceRefundPayload/);

  const createDirectTrade = gameCore.match(/function createDirectTrade[\s\S]*?(?=\n  function acceptDirectTrade)/)?.[0] || "";
  assert.ok(createDirectTrade, "createDirectTrade should stay discoverable for boundary checks");
  const tickDirectTradeExpiry = gameCore.match(/function tickDirectTradeExpiry[\s\S]*?(?=\n  function tickMarketExpiry)/)?.[0] || "";
  assert.ok(tickDirectTradeExpiry, "tickDirectTradeExpiry should stay discoverable for boundary checks");
  const acceptDirectTrade = gameCore.match(/function acceptDirectTrade[\s\S]*?(?=\n  function cancelDirectTrade)/)?.[0] || "";
  assert.ok(acceptDirectTrade, "acceptDirectTrade should stay discoverable for boundary checks");
  const cancelDirectTrade = gameCore.match(/function cancelDirectTrade[\s\S]*?(?=\n  function tickDirectTradeExpiry)/)?.[0] || "";
  assert.ok(cancelDirectTrade, "cancelDirectTrade should stay discoverable for boundary checks");

  assert.doesNotMatch(gameCore, /type DirectTradeAcceptedPayload/);
  assert.doesNotMatch(gameCore, /type DirectTradeCreatedPayload/);
  assert.doesNotMatch(gameCore, /type DirectTradeCancelledPayload/);
  assert.doesNotMatch(gameCore, /type DirectTradeExpiredPayload/);
  assert.doesNotMatch(gameCore, /type DirectTradeAssetPayload/);
  assert.doesNotMatch(gameCore, /function directTradeResourceAsset/);
  assert.doesNotMatch(gameCore, /function directTradeItemAsset/);
  assert.doesNotMatch(gameCore, /function directTradeAssetFromPayload/);
  assert.doesNotMatch(gameCore, /function directTradeAssetPayload/);
  assert.doesNotMatch(gameCore, /function directTradeAssetLabel/);
  assert.doesNotMatch(gameCore, /function requireDirectTrade/);
  assert.doesNotMatch(gameCore, /function requireOpenDirectTrade/);
  assert.doesNotMatch(gameCore, /const hasRecentDirectTrade = Object\.values\(current\.directTrades\)/);
  assert.doesNotMatch(gameCore, /const tradeRiskFlags: EpochMarketTradeRiskFlag\[\]/);
  assert.doesNotMatch(gameCore, /tradeRiskScore: tradeRiskFlags\.length/);
  assert.doesNotMatch(gameCore, /const payload: DirectTradeCreatedPayload/);
  assert.doesNotMatch(createDirectTrade, /makeEvent\("direct_trade_created"/);
  assert.doesNotMatch(acceptDirectTrade, /makeEvent\("direct_trade_accepted"/);
  assert.doesNotMatch(cancelDirectTrade, /makeEvent\("direct_trade_cancelled"/);
  assert.doesNotMatch(tickDirectTradeExpiry, /makeEvent\("direct_trade_expired"/);
  assert.doesNotMatch(gameCore, /reason: `direct_trade_lock:\$\{tradeId\}`/);
  assert.doesNotMatch(gameCore, /reason: `direct_trade_payment:\$\{tradeId\}`/);
  assert.doesNotMatch(gameCore, /reason: `direct_trade_goods:\$\{tradeId\}`/);
  assert.doesNotMatch(acceptDirectTrade, /trade\.requestedAsset\.kind === "resource"/);
  assert.doesNotMatch(acceptDirectTrade, /trade\.offeredAsset\.kind === "resource"/);
  assert.doesNotMatch(gameCore, /const cancelledPayload: DirectTradeCancelledPayload/);
  assert.doesNotMatch(gameCore, /const expiredPayload: DirectTradeExpiredPayload/);
  assert.doesNotMatch(tickDirectTradeExpiry, /const maxAgeSeconds = Math\.max\(1, Number\(input\.maxAgeSeconds \|\| 24 \* 60 \* 60\)\)/);
  assert.doesNotMatch(tickDirectTradeExpiry, /const limit = Math\.max\(1, Math\.min\(Number\(input\.limit \|\| 25\), 100\)\)/);
  assert.doesNotMatch(tickDirectTradeExpiry, /const expiredTrades = Object\.values\(current\.directTrades\)/);
  assert.doesNotMatch(
    tickDirectTradeExpiry,
    /sort\(\(left, right\) => left\.createdAt\.localeCompare\(right\.createdAt\) \|\| left\.tradeId\.localeCompare\(right\.tradeId\)\)/,
  );
  assert.doesNotMatch(gameCore, /reason: `direct_trade_cancel:\$\{tradeId\}`/);
  assert.doesNotMatch(gameCore, /reason: `direct_trade_expired:\$\{trade\.tradeId\}`/);
});

test("game core delegates bounty payload rules to a focused module", () => {
  assert.ok(
    existsSync(bountyRulesPath),
    "bountyRules.ts should own bounty escrow, claim, influence, and trace payload planning",
  );
  const gameCore = readFileSync(gameCorePath, "utf8");
  const gameCoreTrade = readFileSync(gameCoreTradePath, "utf8");
  const bountyRules = readFileSync(bountyRulesPath, "utf8");

  assert.match(gameCore, /from "\.\/bountyRules\.ts"/);
  assert.match(bountyRules, /export function requireBounty/);
  assert.match(bountyRules, /export function requireOpenBounty/);
  assert.match(bountyRules, /export function bountyEscrowSpendPayload/);
  assert.match(bountyRules, /export function bountyCreatedPayload/);
  assert.match(bountyRules, /export function planBountyCreationEvents/);
  assert.match(bountyRules, /export function projectBountyCreation/);
  assert.match(bountyRules, /export function bountyClaimRewardPayload/);
  assert.match(bountyRules, /export function bountyClaimedPayload/);
  assert.match(bountyRules, /export function bountyFulfillmentItemTransferPayload/);
  assert.match(bountyRules, /export function bountyClaimInfluenceDelta/);
  assert.match(bountyRules, /export function bountyClaimInfluencePayload/);
  assert.match(bountyRules, /export function bountyClaimTracePayload/);
  assert.match(bountyRules, /export function planBountyClaimEvents/);
  assert.match(bountyRules, /export function projectBountyClaim/);

  const createBounty = gameCoreTrade.match(/function createBounty[\s\S]*?(?=\n  function claimBounty)/)?.[0] || "";
  assert.ok(createBounty, "createBounty should stay discoverable for boundary checks");
  const claimBounty = gameCoreTrade.match(/function claimBounty[\s\S]*?(?=\n  return \{)/)?.[0] || "";
  assert.ok(claimBounty, "claimBounty should stay discoverable for boundary checks");

  assert.doesNotMatch(gameCore, /type BountyCreatedPayload/);
  assert.doesNotMatch(gameCore, /type BountyClaimedPayload/);
  assert.doesNotMatch(gameCore, /type ItemTransferredPayload/);
  assert.doesNotMatch(gameCore, /function requireBounty/);
  assert.doesNotMatch(gameCore, /function requireOpenBounty/);
  assert.doesNotMatch(gameCore, /const payload: BountyCreatedPayload/);
  assert.doesNotMatch(gameCore, /const payload: BountyClaimedPayload/);
  assert.doesNotMatch(createBounty, /makeEvent\("bounty_created"/);
  assert.doesNotMatch(claimBounty, /makeEvent\("bounty_claimed"/);
  assert.doesNotMatch(claimBounty, /regionInfluenceChangedEvent\(makeEvent, bounty\.regionId/);
  assert.doesNotMatch(claimBounty, /traceCreatedEvent\(makeEvent, traceId/);
  assert.doesNotMatch(gameCore, /satisfies ItemTransferredPayload/);
  assert.doesNotMatch(gameCore, /toAgentId: bounty\.sponsorAgentId/);
  assert.doesNotMatch(gameCore, /const influenceDelta = bounty\.rewardAmount/);
  assert.doesNotMatch(gameCore, /reason: `bounty_lock:\$\{bountyId\}`/);
  assert.doesNotMatch(gameCore, /reason: `bounty_claim:\$\{bountyId\}`/);
  assert.doesNotMatch(gameCore, /summary: `\$\{claimantAgentId\} 领取了 \$\{bounty\.title\} 的悬赏。`/);
});
