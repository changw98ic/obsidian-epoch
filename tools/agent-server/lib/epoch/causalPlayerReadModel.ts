import type { CausalOwnershipSnapshot, UniqueItemLifecycleState } from "./causalContracts.ts";
import type { CausalWorldSnapshotV1 } from "./causalWorldSnapshot.ts";
import {
  canAccessKnowledgeRecord,
  type EpochKnowledgeCaller,
  type EpochKnowledgeKind,
  type EpochKnowledgeRecord,
  type EpochKnowledgeSourceHop,
} from "./knowledgeStateRules.ts";
import {
  COMBAT_READINESS_DIMENSION_IDS,
  FUNCTIONAL_STAGES,
  PROGRESSION_ATTRIBUTE_IDS,
  combatReadinessVector,
  estimateEncounterSuitability,
  type CarryItemRarity,
  type CombatReadinessDimensionId,
  type ProgressionAttributeId,
  type ProgressionDomainId,
  type ProgressionPowerSystemId,
  type ProgressionResources,
  type ProgressionState,
  type SkillNodeDefinition,
  type TalentNode,
} from "./progressionRules.ts";
import type {
  EconomyInventoryBucket,
  EconomyProvenanceChannel,
  EconomyResourceClass,
} from "./unifiedEconomyRules.ts";
import type {
  MissionIntensityBreakdown,
  MissionOutcome,
  MissionScoreBreakdown,
} from "./missionConsequenceRules.ts";

export const CAUSAL_PLAYER_READ_MODEL_SCHEMA_VERSION = "causal-player-read-model.v2" as const;

const RAG_KINDS: readonly EpochKnowledgeKind[] = [
  "fact",
  "observation",
  "claim",
  "belief",
  "rumor",
  "deception",
  "refutation",
  "memory",
] as const;

const REDACTED_KEYS = /api.?key|secret|token|signature|private|hidden|password|credential|seed/i;
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

export interface CausalPlayerReadCaller extends EpochKnowledgeCaller {
  readonly playerId?: string;
  readonly identityId?: string;
  readonly accountRefs?: readonly string[];
  readonly itemRefs?: readonly string[];
}

export interface CausalPlayerReadPageInput {
  readonly cursor?: string;
  readonly limit?: number;
}

export interface CausalPlayerReadPageInfo {
  readonly cursor?: string;
  readonly limit: number;
  readonly nextCursor?: string;
  readonly total: number;
}

export interface CausalPlayerMaterialProvenance {
  readonly materialRef: string;
  readonly resourceKey: string;
  readonly quantityMinor: string;
  readonly provenanceChannel?: EconomyProvenanceChannel | string;
  readonly sourceRefs: readonly string[];
  readonly evidenceIds: readonly string[];
  readonly accountRef?: string;
}

export interface CausalPlayerUniqueItemDetail {
  readonly itemRef: string;
  readonly itemKey?: string;
  readonly titleOwnerRef?: string;
  readonly possessionAccountRef?: string;
  readonly bucket?: EconomyInventoryBucket | string;
  readonly lifecycleState?: UniqueItemLifecycleState;
  readonly durability?: {
    readonly current: number;
    readonly max: number;
    readonly ratioBps: number;
  };
  readonly capacityMinor?: string;
  readonly quality?: number;
  readonly provenanceRefs: readonly string[];
  readonly materialRefs: readonly string[];
}

export interface CausalPlayerResourceRow {
  readonly accountRef: string;
  readonly resourceKey: string;
  readonly resourceClass?: EconomyResourceClass | string;
  readonly unit: string;
  readonly balanceMinor: string;
  readonly creditLimitMinor?: string;
  readonly materialProvenance: readonly CausalPlayerMaterialProvenance[];
}

export interface CausalPlayerWalletReadModel {
  readonly accounts: readonly string[];
  readonly currencies: readonly CausalPlayerResourceRow[];
  readonly resources: readonly CausalPlayerResourceRow[];
  readonly materials: readonly CausalPlayerResourceRow[];
  readonly uniqueItems: readonly CausalPlayerUniqueItemDetail[];
  readonly capacity: {
    readonly usedMinor: string;
    readonly limitMinor?: string;
    readonly remainingMinor?: string;
  };
}

export interface CausalPlayerSkillReadModel {
  readonly learnedNodeIds: readonly string[];
  readonly definitions: readonly SkillNodeDefinition[];
  readonly proficiency: Readonly<Record<string, number>>;
  readonly advancement: readonly {
    readonly methodId: string;
    readonly currentProficiency: number;
    readonly nextTechniqueTier?: number;
    readonly requirements: readonly string[];
  }[];
}

export interface CausalPlayerProgressionReadModel {
  readonly identityId?: string;
  readonly lineageId?: string;
  readonly powerSystemId?: ProgressionPowerSystemId;
  readonly functionalStage: {
    readonly stage: number;
    readonly id: string;
    readonly label: string;
    readonly nextStage?: number;
    readonly bottlenecks: readonly string[];
  };
  readonly attributes: Readonly<Record<ProgressionAttributeId, number>>;
  readonly resources: ProgressionResources;
  readonly talents: readonly TalentNode[];
  readonly skillTree: CausalPlayerSkillReadModel;
  readonly loadout: {
    readonly carrySlots: number;
    readonly deploymentCapacity: number;
    readonly quickUseSlots: number;
    readonly echoSlots: number;
    readonly insuranceLayers: number;
    readonly broughtItems: readonly CausalPlayerLoadoutItem[];
    readonly usedDeploymentCapacity: number;
    readonly usedQuickUseSlots: number;
    readonly usedWeightMinor: string;
  };
}

export interface CausalPlayerLoadoutItem {
  readonly itemId: string;
  readonly rarity: CarryItemRarity;
  readonly category: string;
  readonly quickUse?: boolean;
  readonly deploymentCost?: number;
  readonly weightMinor?: string;
}

export interface CausalPlayerRagHit {
  readonly id: string;
  readonly kind: EpochKnowledgeKind;
  readonly subject?: string;
  readonly text: string;
  readonly confidence: number;
  readonly trust: {
    readonly classes: readonly string[];
    readonly authorities: readonly string[];
    readonly channels: readonly string[];
  };
  readonly sourceChain: readonly CausalPlayerSourceHopSummary[];
  readonly evidence: {
    readonly evidenceIds: readonly string[];
    readonly sourceEventIds: readonly string[];
    readonly status: EpochKnowledgeRecord["status"];
    readonly refutedBy: readonly string[];
  };
  readonly retrieval: {
    readonly score: number;
    readonly rank: number;
    readonly matchedQuery: boolean;
  };
}

export interface CausalPlayerSourceHopSummary {
  readonly sourceId: string;
  readonly sourceType?: string;
  readonly trustClass: string;
  readonly sourceAuthority: string;
  readonly channel: string;
  readonly hop: number;
  readonly observedAt?: string;
  readonly evidenceIds: readonly string[];
}

export interface CausalPlayerRagPanel {
  readonly hits: readonly CausalPlayerRagHit[];
  readonly countsByKind: Readonly<Record<EpochKnowledgeKind, number>>;
  readonly page: CausalPlayerReadPageInfo;
  readonly retrieval: {
    readonly query?: string;
    readonly visibleTotal: number;
    readonly hiddenRecordsExcluded: number;
    readonly note: string;
  };
}

export interface CausalPlayerCombatReadiness {
  readonly dimensions: Readonly<Record<CombatReadinessDimensionId, number>>;
  readonly aggregatePower: {
    readonly low: number;
    readonly mid: number;
    readonly high: number;
    readonly label: string;
  };
  readonly encounterFit?: {
    readonly threatPoints: number;
    readonly pressure: number;
    readonly suitability: number;
    readonly victoryProbabilityBps: number;
    readonly band: string;
    readonly weights: Readonly<Record<CombatReadinessDimensionId, number>>;
  };
}

export interface CausalPlayerUnavailableInfo {
  readonly status: "unavailable";
  readonly reason: string;
}

export interface CausalPlayerProgressionStatusReadModel {
  readonly status: ProgressionState["status"] | CausalPlayerUnavailableInfo;
  readonly injuries: {
    readonly status: "available" | "unavailable";
    readonly injurySeverity?: number;
    readonly error?: CausalPlayerUnavailableInfo;
  };
}

export interface CausalPlayerReadinessReadModel {
  readonly dimensions: Readonly<Record<CombatReadinessDimensionId, number>>;
  readonly aggregatePower: CausalPlayerCombatReadiness["aggregatePower"];
  readonly encounterFit?: CausalPlayerCombatReadiness["encounterFit"];
  readonly attributes: Readonly<Record<ProgressionAttributeId, number>>;
}

export interface CausalPlayerWorldCursorReadModel {
  readonly status: "available";
  readonly worldId: string;
  readonly regionId?: string;
  readonly worldTime?: string;
  readonly worldMinute?: number;
  readonly canonicalCursor: CausalWorldSnapshotV1["replayCursor"];
  readonly lastEventId?: string;
  readonly checkpointHash?: `sha256:${string}`;
}

export interface CausalPlayerRunAuditEntry {
  readonly runId: string;
  readonly occurredAtWorldMinute?: number;
  readonly recordedAt?: string;
  readonly outcome: MissionOutcome | string;
  readonly combatPowerMid: number;
  readonly intensity: {
    readonly worldIntensity: number;
    readonly encounterIntensity: number;
    readonly band: MissionIntensityBreakdown["band"] | string;
    readonly playerCombatRatio: number;
  };
  readonly score: {
    readonly finalScore: number;
    readonly rawScore: number;
    readonly grade: MissionScoreBreakdown["grade"] | string;
  };
  readonly breakdown: Readonly<Record<string, number>>;
}

export interface CausalPlayerRecentRunsPanel {
  readonly runs: readonly CausalPlayerRunAuditEntry[];
  readonly page: CausalPlayerReadPageInfo;
}

export interface CausalPlayerIdentityReadModel {
  readonly identityId?: string;
  readonly agentId?: string;
  readonly explorerId?: string;
  readonly status: "active" | "archived" | "unavailable";
  readonly generation?: number;
  readonly previousAgentId?: string;
  readonly nextAgentId?: string;
  readonly lineage: readonly string[];
  readonly lineageRootAgentId?: string;
  readonly canStartJourney: boolean;
  readonly reincarnationRequired: boolean;
  readonly source: "epoch_identity_archive" | "caller_fallback";
}

export interface CausalPlayerPanel {
  readonly schemaVersion: typeof CAUSAL_PLAYER_READ_MODEL_SCHEMA_VERSION;
  readonly worldId: string;
  readonly checkpointHash?: `sha256:${string}`;
  readonly caller: CausalPlayerReadCaller;
  readonly identity: CausalPlayerIdentityReadModel;
  readonly worldCursor: CausalPlayerWorldCursorReadModel;
  readonly wallet: CausalPlayerWalletReadModel;
  readonly progression: CausalPlayerProgressionReadModel;
  readonly status: CausalPlayerProgressionStatusReadModel;
  readonly injuries: CausalPlayerProgressionStatusReadModel["injuries"];
  readonly readiness: CausalPlayerReadinessReadModel;
  readonly rag: CausalPlayerRagPanel;
  readonly combat: CausalPlayerCombatReadiness;
  readonly recentRuns: CausalPlayerRecentRunsPanel;
}

export interface CausalPlayerReadModelInput {
  readonly snapshot: CausalWorldSnapshotV1;
  readonly caller: CausalPlayerReadCaller;
  readonly identity?: CausalPlayerIdentityReadModel;
  readonly progressionState?: ProgressionState;
  readonly skillDefinitions?: readonly SkillNodeDefinition[];
  readonly materialProvenance?: readonly CausalPlayerMaterialProvenance[];
  readonly uniqueItems?: readonly CausalPlayerUniqueItemDetail[];
  readonly loadoutItems?: readonly CausalPlayerLoadoutItem[];
  readonly methodVector?: Partial<Record<CombatReadinessDimensionId, number>>;
  readonly equipmentVector?: Partial<Record<CombatReadinessDimensionId, number>>;
  readonly preparationVector?: Partial<Record<CombatReadinessDimensionId, number>>;
  readonly matchupMultiplierByDimension?: Partial<Record<CombatReadinessDimensionId, number>>;
  readonly stateMultiplierBps?: number;
  readonly environmentMultiplierBps?: number;
  readonly encounter?: {
    readonly threatPoints: number;
    readonly weights?: Partial<Record<CombatReadinessDimensionId, number>>;
  };
  readonly runAudits?: readonly CausalPlayerRunAuditEntry[];
  readonly ragQuery?: string;
  readonly ragPage?: CausalPlayerReadPageInput;
  readonly runPage?: CausalPlayerReadPageInput;
}

export interface CausalPlayerPanelDelta {
  readonly fromCheckpointHash?: `sha256:${string}`;
  readonly toCheckpointHash?: `sha256:${string}`;
  readonly resources: readonly CausalPlayerNumericDelta[];
  readonly skills: {
    readonly addedNodeIds: readonly string[];
    readonly removedNodeIds: readonly string[];
    readonly proficiency: readonly CausalPlayerNumericDelta[];
  };
  readonly rag: {
    readonly addedIds: readonly string[];
    readonly removedIds: readonly string[];
    readonly confidence: readonly CausalPlayerNumericDelta[];
  };
  readonly combatPower: CausalPlayerRangeDelta;
  readonly intensity: CausalPlayerRangeDelta;
  readonly score: CausalPlayerRangeDelta;
}

export interface CausalPlayerTenRunAudit {
  readonly runs: readonly CausalPlayerRunAuditEntry[];
  readonly changes: readonly {
    readonly fromRunId: string;
    readonly toRunId: string;
    readonly combatPowerDelta: number;
    readonly intensityDelta: number;
    readonly scoreDelta: number;
    readonly outcomeChanged: boolean;
  }[];
  readonly descriptiveCorrelation: {
    readonly sampleSize: number;
    readonly combatPowerVsScorePearson: number | null;
    readonly label: string;
    readonly caveat: "descriptive_non_causal";
  };
}

export interface CausalPlayerNumericDelta {
  readonly key: string;
  readonly before: number;
  readonly after: number;
  readonly delta: number;
}

export interface CausalPlayerRangeDelta {
  readonly before: number;
  readonly after: number;
  readonly delta: number;
}

type JsonRecord = Readonly<Record<string, unknown>>;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function numberValue(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function integerValue(value: unknown, fallback = 0): number {
  return Math.trunc(numberValue(value, fallback));
}

function minorNumber(value: string | undefined): number {
  if (!value || !/^-?(0|[1-9]\d*)$/.test(value)) return 0;
  const numeric = Number(value);
  return Number.isSafeInteger(numeric) ? numeric : 0;
}

function minorString(value: number): string {
  return String(Math.trunc(Number.isFinite(value) ? value : 0));
}

function uniqueSorted(values: readonly (string | undefined)[]): readonly string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value?.trim())).map((value) => value.trim()))].sort((a, b) => a.localeCompare(b));
}

function pageBounds(input: CausalPlayerReadPageInput | undefined, total: number): { readonly start: number; readonly limit: number } {
  const parsedStart = Number(input?.cursor ?? 0);
  const parsedLimit = Number(input?.limit ?? DEFAULT_PAGE_SIZE);
  return {
    start: Math.max(0, Math.min(Number.isFinite(parsedStart) ? Math.trunc(parsedStart) : 0, total)),
    limit: Math.max(1, Math.min(Number.isFinite(parsedLimit) ? Math.trunc(parsedLimit) : DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE)),
  };
}

function pageInfo(input: CausalPlayerReadPageInput | undefined, total: number): CausalPlayerReadPageInfo {
  const { start, limit } = pageBounds(input, total);
  const next = start + limit < total ? String(start + limit) : undefined;
  return {
    ...(start > 0 ? { cursor: String(start) } : {}),
    limit,
    ...(next ? { nextCursor: next } : {}),
    total,
  };
}

function pageSlice<T>(values: readonly T[], input: CausalPlayerReadPageInput | undefined): readonly T[] {
  const { start, limit } = pageBounds(input, values.length);
  return values.slice(start, start + limit);
}

function callerRefCandidates(caller: CausalPlayerReadCaller): readonly string[] {
  return uniqueSorted([
    ...(caller.accountRefs || []),
    ...(caller.itemRefs || []),
    caller.identityId,
    caller.identityId ? `identity:${caller.identityId}` : undefined,
    caller.identityId ? `identity:${caller.identityId}:inventory` : undefined,
    caller.identityId ? `identity:${caller.identityId}:progression` : undefined,
    caller.identityId ? `identity:${caller.identityId}:skill_tree` : undefined,
    caller.playerId,
    caller.playerId ? `player:${caller.playerId}` : undefined,
    caller.explorerId,
    caller.explorerId ? `explorer:${caller.explorerId}` : undefined,
    caller.agentId,
    caller.agentId ? `agent:${caller.agentId}` : undefined,
  ]);
}

function callerIsOperator(caller: CausalPlayerReadCaller): boolean {
  return Boolean(caller.legalAccess?.includes("operator"));
}

function refVisible(ref: string | undefined, caller: CausalPlayerReadCaller): boolean {
  if (!ref) return false;
  if (callerIsOperator(caller)) return true;
  const candidates = callerRefCandidates(caller);
  return candidates.some((candidate) => ref === candidate || ref.startsWith(`${candidate}:`) || ref.includes(`:${candidate}:`));
}

function accountVisible(accountRef: string, caller: CausalPlayerReadCaller): boolean {
  return refVisible(accountRef, caller);
}

function classifyResource(resourceKey: string): EconomyResourceClass | undefined {
  if (resourceKey.includes("currency") || resourceKey === "gold" || resourceKey.endsWith("_coin")) return "currency";
  if (resourceKey.startsWith("material.") || resourceKey.startsWith("material_")) return "material";
  if (resourceKey.startsWith("item.") || resourceKey.startsWith("unique_item.")) return "unique_item";
  if (resourceKey.includes("energy")) return "energy";
  return undefined;
}

function materialKey(resourceKey: string): string {
  return resourceKey.startsWith("material.") ? resourceKey.slice("material.".length) : resourceKey;
}

function readExtensions(snapshot: CausalWorldSnapshotV1, ownerVisible: (owner: string) => boolean): readonly JsonRecord[] {
  return snapshot.domainExtensions
    .filter((slot) => ownerVisible(slot.owner))
    .map((slot) => slot.payload)
    .filter(isRecord);
}

function arrayFromRecordField(records: readonly JsonRecord[], field: string): readonly JsonRecord[] {
  return records.flatMap((record) => {
    const value = record[field];
    return Array.isArray(value) ? value.filter(isRecord) : [];
  });
}

function progressionFromExtensions(records: readonly JsonRecord[], caller: CausalPlayerReadCaller): ProgressionState | undefined {
  for (const record of records) {
    const candidate = record.progressionState;
    if (!isRecord(candidate)) continue;
    const identityId = stringValue(candidate.identityId);
    if (identityId && caller.identityId && identityId !== caller.identityId) continue;
    return candidate as unknown as ProgressionState;
  }
  return undefined;
}

function skillDefinitionsFromExtensions(records: readonly JsonRecord[]): readonly SkillNodeDefinition[] {
  return arrayFromRecordField(records, "skillDefinitions") as readonly unknown[] as readonly SkillNodeDefinition[];
}

function provenanceFromRecord(record: JsonRecord): CausalPlayerMaterialProvenance | undefined {
  const materialRef = stringValue(record.materialRef) || stringValue(record.resourceKey);
  const resourceKey = stringValue(record.resourceKey);
  const quantityMinor = stringValue(record.quantityMinor) || "0";
  if (!materialRef || !resourceKey) return undefined;
  return {
    materialRef,
    resourceKey,
    quantityMinor,
    ...(stringValue(record.provenanceChannel) ? { provenanceChannel: stringValue(record.provenanceChannel) } : {}),
    sourceRefs: Array.isArray(record.sourceRefs) ? uniqueSorted(record.sourceRefs.map(stringValue)) : [],
    evidenceIds: Array.isArray(record.evidenceIds) ? uniqueSorted(record.evidenceIds.map(stringValue)) : [],
    ...(stringValue(record.accountRef) ? { accountRef: stringValue(record.accountRef) } : {}),
  };
}

function uniqueItemFromRecord(record: JsonRecord): CausalPlayerUniqueItemDetail | undefined {
  const itemRef = stringValue(record.itemRef);
  if (!itemRef) return undefined;
  const durability = isRecord(record.durability)
    ? durabilityView(numberValue(record.durability.current), numberValue(record.durability.max))
    : undefined;
  return {
    itemRef,
    ...(stringValue(record.itemKey) ? { itemKey: stringValue(record.itemKey) } : {}),
    ...(stringValue(record.titleOwnerRef) ? { titleOwnerRef: stringValue(record.titleOwnerRef) } : {}),
    ...(stringValue(record.possessionAccountRef) ? { possessionAccountRef: stringValue(record.possessionAccountRef) } : {}),
    ...(stringValue(record.bucket) ? { bucket: stringValue(record.bucket) } : {}),
    ...(stringValue(record.lifecycleState) ? { lifecycleState: stringValue(record.lifecycleState) as UniqueItemLifecycleState } : {}),
    ...(durability ? { durability } : {}),
    ...(stringValue(record.capacityMinor) ? { capacityMinor: stringValue(record.capacityMinor) } : {}),
    ...(typeof record.quality === "number" ? { quality: record.quality } : {}),
    provenanceRefs: Array.isArray(record.provenanceRefs) ? uniqueSorted(record.provenanceRefs.map(stringValue)) : [],
    materialRefs: Array.isArray(record.materialRefs) ? uniqueSorted(record.materialRefs.map(stringValue)) : [],
  };
}

function durabilityView(current: number, max: number): CausalPlayerUniqueItemDetail["durability"] {
  const safeMax = Math.max(0, Math.trunc(max));
  const safeCurrent = Math.max(0, Math.min(Math.trunc(current), safeMax));
  return {
    current: safeCurrent,
    max: safeMax,
    ratioBps: safeMax > 0 ? Math.round((safeCurrent * 10_000) / safeMax) : 0,
  };
}

function loadoutFromRecord(record: JsonRecord): CausalPlayerLoadoutItem | undefined {
  const itemId = stringValue(record.itemId);
  const rarity = stringValue(record.rarity);
  const category = stringValue(record.category);
  if (!itemId || !rarity || !category) return undefined;
  return {
    itemId,
    rarity: rarity as CarryItemRarity,
    category,
    ...(record.quickUse === true ? { quickUse: true } : {}),
    ...(typeof record.deploymentCost === "number" ? { deploymentCost: record.deploymentCost } : {}),
    ...(stringValue(record.weightMinor) ? { weightMinor: stringValue(record.weightMinor) } : {}),
  };
}

function runAuditFromRecord(record: JsonRecord): CausalPlayerRunAuditEntry | undefined {
  const runId = stringValue(record.runId);
  if (!runId || !isRecord(record.intensity) || !isRecord(record.score)) return undefined;
  return {
    runId,
    ...(typeof record.occurredAtWorldMinute === "number" ? { occurredAtWorldMinute: record.occurredAtWorldMinute } : {}),
    ...(stringValue(record.recordedAt) ? { recordedAt: stringValue(record.recordedAt) } : {}),
    outcome: stringValue(record.outcome) || "unknown",
    combatPowerMid: integerValue(record.combatPowerMid),
    intensity: {
      worldIntensity: integerValue(record.intensity.worldIntensity),
      encounterIntensity: integerValue(record.intensity.encounterIntensity),
      band: stringValue(record.intensity.band) || "low",
      playerCombatRatio: numberValue(record.intensity.playerCombatRatio),
    },
    score: {
      finalScore: integerValue(record.score.finalScore),
      rawScore: integerValue(record.score.rawScore),
      grade: stringValue(record.score.grade) || "D",
    },
    breakdown: numericRecord(record.breakdown),
  };
}

function numericRecord(value: unknown): Readonly<Record<string, number>> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(Object.entries(value)
    .filter(([, nested]) => typeof nested === "number" && Number.isFinite(nested))
    .sort(([left], [right]) => left.localeCompare(right))) as Readonly<Record<string, number>>;
}

function materialProvenanceRows(
  input: CausalPlayerReadModelInput,
  extensionRecords: readonly JsonRecord[],
): readonly CausalPlayerMaterialProvenance[] {
  return [
    ...(input.materialProvenance || []),
    ...arrayFromRecordField(extensionRecords, "materialProvenance").map(provenanceFromRecord).filter((row): row is CausalPlayerMaterialProvenance => Boolean(row)),
  ].sort((left, right) =>
    left.resourceKey.localeCompare(right.resourceKey)
    || left.materialRef.localeCompare(right.materialRef)
    || (left.accountRef || "").localeCompare(right.accountRef || ""));
}

function uniqueItemDetails(
  input: CausalPlayerReadModelInput,
  extensionRecords: readonly JsonRecord[],
): readonly CausalPlayerUniqueItemDetail[] {
  const details = new Map<string, CausalPlayerUniqueItemDetail>();
  for (const item of input.snapshot.ownership.items) {
    if (ownershipVisible(item, input.caller)) {
      details.set(item.itemRef, {
        itemRef: item.itemRef,
        ...(item.titleOwnerRef ? { titleOwnerRef: item.titleOwnerRef } : {}),
        ...(item.lifecycleState ? { lifecycleState: item.lifecycleState } : {}),
        provenanceRefs: [],
        materialRefs: [],
      });
    }
  }
  for (const item of [
    ...(input.uniqueItems || []),
    ...arrayFromRecordField(extensionRecords, "uniqueItems").map(uniqueItemFromRecord).filter((row): row is CausalPlayerUniqueItemDetail => Boolean(row)),
  ]) {
    if (!refVisible(item.titleOwnerRef || item.possessionAccountRef || item.itemRef, input.caller)) continue;
    const existing = details.get(item.itemRef);
    details.set(item.itemRef, existing ? {
      ...existing,
      ...item,
      provenanceRefs: uniqueSorted([...existing.provenanceRefs, ...item.provenanceRefs]),
      materialRefs: uniqueSorted([...existing.materialRefs, ...item.materialRefs]),
    } : item);
  }
  return [...details.values()].sort((left, right) => left.itemRef.localeCompare(right.itemRef));
}

function ownershipVisible(item: CausalOwnershipSnapshot, caller: CausalPlayerReadCaller): boolean {
  return refVisible(item.titleOwnerRef || item.itemRef, caller);
}

function walletView(input: CausalPlayerReadModelInput, extensionRecords: readonly JsonRecord[]): CausalPlayerWalletReadModel {
  const provenance = materialProvenanceRows(input, extensionRecords).filter((row) => !row.accountRef || accountVisible(row.accountRef, input.caller));
  const rows = input.snapshot.balances.accounts
    .filter((account) => accountVisible(account.accountRef, input.caller))
    .map((account): CausalPlayerResourceRow => {
      const resourceClass = classifyResource(account.resourceKey);
      return {
        accountRef: account.accountRef,
        resourceKey: account.resourceKey,
        ...(resourceClass ? { resourceClass } : {}),
        unit: account.unit,
        balanceMinor: account.balanceMinor,
        ...(account.creditLimitMinor !== undefined ? { creditLimitMinor: account.creditLimitMinor } : {}),
        materialProvenance: provenance.filter((row) =>
          row.resourceKey === account.resourceKey
          || materialKey(account.resourceKey) === materialKey(row.resourceKey)),
      };
    })
    .sort((left, right) =>
      left.accountRef.localeCompare(right.accountRef)
      || left.resourceKey.localeCompare(right.resourceKey)
      || left.unit.localeCompare(right.unit));
  const uniqueItems = uniqueItemDetails(input, extensionRecords);
  const limitMinor = rows.map((row) => row.creditLimitMinor).filter((value): value is string => Boolean(value))
    .reduce((total, value) => total + minorNumber(value), 0);
  const usedMinor = rows.reduce((total, row) => total + Math.max(0, minorNumber(row.balanceMinor)), 0);
  return {
    accounts: uniqueSorted(rows.map((row) => row.accountRef)),
    currencies: rows.filter((row) => row.resourceClass === "currency"),
    resources: rows.filter((row) => row.resourceClass !== "currency" && row.resourceClass !== "material"),
    materials: rows.filter((row) => row.resourceClass === "material"),
    uniqueItems,
    capacity: {
      usedMinor: minorString(usedMinor),
      ...(limitMinor > 0 ? { limitMinor: minorString(limitMinor), remainingMinor: minorString(limitMinor - usedMinor) } : {}),
    },
  };
}

function emptyAttributes(): Readonly<Record<ProgressionAttributeId, number>> {
  return Object.fromEntries(PROGRESSION_ATTRIBUTE_IDS.map((id) => [id, 0])) as Readonly<Record<ProgressionAttributeId, number>>;
}

function normalizeResources(resources: ProgressionResources | undefined): ProgressionResources {
  return {
    functionalXp: Math.max(0, integerValue(resources?.functionalXp)),
    insightPoints: Math.max(0, integerValue(resources?.insightPoints)),
    skillPointsSpent: Math.max(0, integerValue(resources?.skillPointsSpent)),
    lineageMarks: Math.max(0, integerValue(resources?.lineageMarks)),
    attributeEvidenceXp: Object.fromEntries(PROGRESSION_ATTRIBUTE_IDS.map((id) => [id, Math.max(0, integerValue(resources?.attributeEvidenceXp?.[id]))])) as Partial<Record<ProgressionAttributeId, number>>,
    methodProficiency: Object.fromEntries(Object.entries(resources?.methodProficiency || {}).sort(([left], [right]) => left.localeCompare(right))),
    domainInsight: Object.fromEntries(Object.entries(resources?.domainInsight || {}).sort(([left], [right]) => left.localeCompare(right))) as Partial<Record<ProgressionDomainId, number>>,
    materials: [...(resources?.materials || [])].sort((left, right) => left.materialId.localeCompare(right.materialId)),
  };
}

function bottlenecks(state: ProgressionState | undefined): readonly string[] {
  if (!state) return [];
  const next = FUNCTIONAL_STAGES.find((stage) => stage.stage === state.functionalStage + 1);
  if (!next) return [];
  const resources = normalizeResources(state.resources);
  const primaryMethod = Math.max(0, ...Object.values(resources.methodProficiency || {}).map((value) => integerValue(value)));
  const domainInsight = Math.max(0, ...Object.values(resources.domainInsight || {}).map((value) => integerValue(value)));
  return [
    (resources.functionalXp || 0) < next.xp ? `functional_xp:${resources.functionalXp || 0}/${next.xp}` : undefined,
    primaryMethod < next.primaryMethod ? `primary_method:${primaryMethod}/${next.primaryMethod}` : undefined,
    domainInsight < next.insight ? `domain_insight:${domainInsight}/${next.insight}` : undefined,
    state.qualificationRefs?.length ? undefined : "qualification_refs:missing",
    (state.status?.injurySeverity || 0) > 60 ? "injury:blocking" : undefined,
    (state.status?.pollution || 0) > 70 ? "pollution:blocking" : undefined,
    (state.status?.debtSeverity || 0) > 80 ? "debt:blocking" : undefined,
    (state.status?.stability ?? 100) < 50 ? "stability:blocking" : undefined,
  ].filter((value): value is string => Boolean(value));
}

function skillReadModel(state: ProgressionState | undefined, definitions: readonly SkillNodeDefinition[]): CausalPlayerSkillReadModel {
  const learnedNodeIds = uniqueSorted(state?.learnedSkillNodeIds || []);
  const proficiency = Object.fromEntries(Object.entries(state?.resources?.methodProficiency || {}).sort(([left], [right]) => left.localeCompare(right)));
  const advancement = Object.entries(proficiency).map(([methodId, currentProficiency]) => {
    const nextTechniqueTier = [1, 2, 3, 4, 5, 6].find((tier) => currentProficiency < tier * 150);
    return {
      methodId,
      currentProficiency,
      ...(nextTechniqueTier ? { nextTechniqueTier } : {}),
      requirements: nextTechniqueTier ? [`proficiency:${currentProficiency}/${nextTechniqueTier * 150}`] : [],
    };
  });
  return {
    learnedNodeIds,
    definitions: definitions
      .filter((definition) => learnedNodeIds.includes(definition.nodeId) || (definition.requiredStage || 1) <= (state?.functionalStage || 1))
      .sort((left, right) => left.nodeId.localeCompare(right.nodeId)),
    proficiency,
    advancement,
  };
}

function deploymentCost(item: CausalPlayerLoadoutItem): number {
  if (typeof item.deploymentCost === "number" && Number.isFinite(item.deploymentCost)) return Math.max(0, Math.trunc(item.deploymentCost));
  const byRarity: Readonly<Record<CarryItemRarity, number>> = { common: 1, uncommon: 2, rare: 3, epic: 4, mythic: 5 };
  return byRarity[item.rarity] || 0;
}

function progressionView(
  input: CausalPlayerReadModelInput,
  extensionRecords: readonly JsonRecord[],
  state = progressionStateForInput(input, extensionRecords),
): CausalPlayerProgressionReadModel {
  const definitions = [...(input.skillDefinitions || []), ...skillDefinitionsFromExtensions(extensionRecords)];
  const loadout = [
    ...(input.loadoutItems || []),
    ...arrayFromRecordField(extensionRecords, "loadoutItems").map(loadoutFromRecord).filter((row): row is CausalPlayerLoadoutItem => Boolean(row)),
  ].sort((left, right) => left.itemId.localeCompare(right.itemId));
  const stage = FUNCTIONAL_STAGES.find((item) => item.stage === state?.functionalStage)
    || FUNCTIONAL_STAGES[0];
  if (!stage) throw new Error("progression_functional_stage_catalog_empty");
  return {
    ...(state?.identityId ? { identityId: state.identityId } : {}),
    ...(state?.lineageId ? { lineageId: state.lineageId } : {}),
    ...(state?.powerSystemId ? { powerSystemId: state.powerSystemId } : {}),
      functionalStage: {
        stage: stage.stage,
        id: stage.id,
        label: stage.label,
        ...(FUNCTIONAL_STAGES.some((item) => item.stage === stage.stage + 1) ? { nextStage: stage.stage + 1 } : {}),
        bottlenecks: bottlenecks(state),
      },
    attributes: { ...emptyAttributes(), ...(state?.attributes || {}) },
    resources: normalizeResources(state?.resources),
    talents: [...(state?.talents || [])].sort((left, right) => left.talentId.localeCompare(right.talentId)),
    skillTree: skillReadModel(state, definitions),
    loadout: {
      carrySlots: state?.carrySlots || 3,
      deploymentCapacity: state?.deploymentCapacity || 6,
      quickUseSlots: state?.quickUseSlots || 2,
      echoSlots: state?.echoSlots || 1,
      insuranceLayers: state?.insuranceLayers || 0,
      broughtItems: loadout,
      usedDeploymentCapacity: loadout.reduce((total, item) => total + deploymentCost(item), 0),
      usedQuickUseSlots: loadout.filter((item) => item.quickUse).length,
      usedWeightMinor: minorString(loadout.reduce((total, item) => total + minorNumber(item.weightMinor), 0)),
    },
  };
}

function progressionStateForInput(
  input: CausalPlayerReadModelInput,
  extensionRecords: readonly JsonRecord[],
): ProgressionState | undefined {
  return input.progressionState || progressionFromExtensions(extensionRecords, input.caller);
}

function progressionStatusView(state: ProgressionState | undefined): CausalPlayerProgressionStatusReadModel {
  if (!state?.status) {
    const unavailable: CausalPlayerUnavailableInfo = {
      status: "unavailable",
      reason: "progression status is not present in the supplied causal progression state",
    };
    return {
      status: unavailable,
      injuries: {
        status: "unavailable",
        error: unavailable,
      },
    };
  }
  return {
    status: state.status,
    injuries: {
      status: "available",
      injurySeverity: state.status.injurySeverity || 0,
    },
  };
}

function readinessView(
  progression: CausalPlayerProgressionReadModel,
  combat: CausalPlayerCombatReadiness,
): CausalPlayerReadinessReadModel {
  return {
    dimensions: combat.dimensions,
    aggregatePower: combat.aggregatePower,
    ...(combat.encounterFit ? { encounterFit: combat.encounterFit } : {}),
    attributes: progression.attributes,
  };
}

function worldCursorView(
  snapshot: CausalWorldSnapshotV1,
  caller: CausalPlayerReadCaller,
): CausalPlayerWorldCursorReadModel {
  return {
    status: "available",
    worldId: snapshot.worldId,
    ...(caller.regionId ? { regionId: caller.regionId } : {}),
    ...(snapshot.replayCursor.lastRecordedAt ? { worldTime: snapshot.replayCursor.lastRecordedAt } : {}),
    ...(snapshot.replayCursor.lastWorldMinute !== undefined ? { worldMinute: snapshot.replayCursor.lastWorldMinute } : {}),
    canonicalCursor: snapshot.replayCursor,
    ...(snapshot.replayCursor.lastEventId ? { lastEventId: snapshot.replayCursor.lastEventId } : {}),
    ...(snapshot.checkpoint?.snapshotHash ? { checkpointHash: snapshot.checkpoint.snapshotHash } : {}),
  };
}

function sanitizeText(value: string): string {
  if (REDACTED_KEYS.test(value)) return "[redacted]";
  return value.replace(/\s+/g, " ").trim();
}

function sourceHopSummary(hop: EpochKnowledgeSourceHop): CausalPlayerSourceHopSummary {
  return {
    sourceId: REDACTED_KEYS.test(hop.sourceId) ? "[redacted]" : hop.sourceId,
    ...(hop.sourceType ? { sourceType: hop.sourceType } : {}),
    trustClass: hop.trustClass,
    sourceAuthority: hop.sourceAuthority,
    channel: hop.channel,
    hop: hop.hop,
    ...(hop.observedAt ? { observedAt: hop.observedAt } : {}),
    evidenceIds: hop.evidenceIds.map((id) => REDACTED_KEYS.test(id) ? "[redacted]" : id).sort((left, right) => left.localeCompare(right)),
  };
}

function ragScore(record: EpochKnowledgeRecord, query: string | undefined): number {
  const queryText = query?.toLocaleLowerCase("zh-CN").trim();
  const lexical = queryText && `${record.subject || ""} ${record.text}`.toLocaleLowerCase("zh-CN").includes(queryText) ? 0.15 : 0;
  const refutationPenalty = record.status === "refuted" ? 0.25 : record.status === "contested" ? 0.1 : 0;
  return Math.max(0, Math.min(1, record.confidence + lexical - refutationPenalty));
}

function ragPanel(snapshot: CausalWorldSnapshotV1, caller: CausalPlayerReadCaller, query: string | undefined, page: CausalPlayerReadPageInput | undefined): CausalPlayerRagPanel {
  const visible = snapshot.knowledge.records
    .filter((record) => RAG_KINDS.includes(record.kind))
    .filter((record) => canAccessKnowledgeRecord(record, caller));
  const queryText = query?.toLocaleLowerCase("zh-CN").trim();
  const matched = visible
    .filter((record) => !queryText || `${record.id} ${record.subject || ""} ${record.text}`.toLocaleLowerCase("zh-CN").includes(queryText))
    .sort((left, right) =>
      ragScore(right, query) - ragScore(left, query)
      || (right.observedAt || right.createdAt || "").localeCompare(left.observedAt || left.createdAt || "")
      || left.id.localeCompare(right.id));
  const hits = pageSlice(matched, page).map((record, index): CausalPlayerRagHit => ({
    id: record.id,
    kind: record.kind,
    ...(record.subject ? { subject: sanitizeText(record.subject) } : {}),
    text: sanitizeText(record.text),
    confidence: record.confidence,
    trust: {
      classes: record.evidence.trustClasses,
      authorities: record.evidence.sourceAuthorities,
      channels: record.evidence.channels,
    },
    sourceChain: record.evidence.sourceChain.map(sourceHopSummary),
    evidence: {
      evidenceIds: record.evidence.evidenceIds.map((id) => REDACTED_KEYS.test(id) ? "[redacted]" : id).sort((left, right) => left.localeCompare(right)),
      sourceEventIds: record.evidence.sourceEventIds.map((id) => REDACTED_KEYS.test(id) ? "[redacted]" : id).sort((left, right) => left.localeCompare(right)),
      status: record.status,
      refutedBy: record.refutedBy,
    },
    retrieval: {
      score: ragScore(record, query),
      rank: pageBounds(page, matched.length).start + index + 1,
      matchedQuery: Boolean(queryText),
    },
  }));
  return {
    hits,
    countsByKind: Object.fromEntries(RAG_KINDS.map((kind) => [kind, visible.filter((record) => record.kind === kind).length])) as Readonly<Record<EpochKnowledgeKind, number>>,
    page: pageInfo(page, matched.length),
    retrieval: {
      ...(query ? { query } : {}),
      visibleTotal: visible.length,
      hiddenRecordsExcluded: snapshot.knowledge.records.length - visible.length,
      note: "Caller-scoped RAG panel; hidden records are counted only as exclusions and never summarized.",
    },
  };
}

function completeWeights(input: Partial<Record<CombatReadinessDimensionId, number>> | undefined): Readonly<Record<CombatReadinessDimensionId, number>> {
  const explicit = Object.fromEntries(COMBAT_READINESS_DIMENSION_IDS.map((dimension) => [dimension, Math.max(0, integerValue(input?.[dimension]))])) as Record<CombatReadinessDimensionId, number>;
  const total = COMBAT_READINESS_DIMENSION_IDS.reduce((sum, dimension) => sum + explicit[dimension], 0);
  if (total === 10_000) return explicit;
  return Object.fromEntries(COMBAT_READINESS_DIMENSION_IDS.map((dimension) => [dimension, 1_000])) as Readonly<Record<CombatReadinessDimensionId, number>>;
}

function combatView(input: CausalPlayerReadModelInput, progression: CausalPlayerProgressionReadModel): CausalPlayerCombatReadiness {
  const dimensions = combatReadinessVector({
    attributes: progression.attributes,
    methodVector: input.methodVector,
    equipmentVector: input.equipmentVector,
    preparationVector: input.preparationVector,
    matchupMultiplierByDimension: input.matchupMultiplierByDimension,
    stateMultiplierBps: input.stateMultiplierBps,
    environmentMultiplierBps: input.environmentMultiplierBps,
  });
  const values = COMBAT_READINESS_DIMENSION_IDS.map((dimension) => dimensions[dimension]);
  const mid = Math.round(values.reduce((total, value) => total + value, 0) / values.length);
  const low = Math.max(0, Math.min(...values, mid) - 5);
  const high = Math.min(100, Math.max(...values, mid) + 5);
  const weights = completeWeights(input.encounter?.weights);
  const suitability = input.encounter ? estimateEncounterSuitability({
    attributes: progression.attributes,
    methodVector: input.methodVector,
    equipmentVector: input.equipmentVector,
    preparationVector: input.preparationVector,
    matchupMultiplierByDimension: input.matchupMultiplierByDimension,
    stateMultiplierBps: input.stateMultiplierBps,
    environmentMultiplierBps: input.environmentMultiplierBps,
    threatPoints: input.encounter.threatPoints,
    encounterWeights: weights,
  }) : undefined;
  return {
    dimensions,
    aggregatePower: {
      low,
      mid,
      high,
      label: mid >= 75 ? "dominant" : mid >= 56 ? "favored" : mid >= 45 ? "contested" : mid >= 25 ? "disadvantaged" : "critical",
    },
    ...(suitability ? {
      encounterFit: {
        threatPoints: input.encounter?.threatPoints || 0,
        pressure: suitability.pressure,
        suitability: suitability.suitability,
        victoryProbabilityBps: suitability.victoryProbabilityBps,
        band: suitability.band,
        weights,
      },
    } : {}),
  };
}

function runAudits(input: CausalPlayerReadModelInput, extensionRecords: readonly JsonRecord[]): readonly CausalPlayerRunAuditEntry[] {
  return [
    ...(input.runAudits || []),
    ...arrayFromRecordField(extensionRecords, "runAudits").map(runAuditFromRecord).filter((row): row is CausalPlayerRunAuditEntry => Boolean(row)),
  ]
    .sort((left, right) =>
      (right.occurredAtWorldMinute || 0) - (left.occurredAtWorldMinute || 0)
      || (right.recordedAt || "").localeCompare(left.recordedAt || "")
      || left.runId.localeCompare(right.runId));
}

export function causalPlayerPanel(input: CausalPlayerReadModelInput): CausalPlayerPanel {
  const extensionRecords = readExtensions(input.snapshot, (owner) => refVisible(owner, input.caller));
  const progressionState = progressionStateForInput(input, extensionRecords);
  const wallet = walletView(input, extensionRecords);
  const progression = progressionView(input, extensionRecords, progressionState);
  const combat = combatView(input, progression);
  const status = progressionStatusView(progressionState);
  const runs = runAudits(input, extensionRecords);
  return {
    schemaVersion: CAUSAL_PLAYER_READ_MODEL_SCHEMA_VERSION,
    worldId: input.snapshot.worldId,
    ...(input.snapshot.checkpoint?.snapshotHash ? { checkpointHash: input.snapshot.checkpoint.snapshotHash } : {}),
    caller: input.caller,
    identity: input.identity || {
      identityId: input.caller.identityId,
      agentId: input.caller.agentId,
      explorerId: input.caller.explorerId,
      status: "unavailable",
      lineage: [],
      canStartJourney: false,
      reincarnationRequired: false,
      source: "caller_fallback",
    },
    worldCursor: worldCursorView(input.snapshot, input.caller),
    wallet,
    progression,
    status,
    injuries: status.injuries,
    readiness: readinessView(progression, combat),
    rag: ragPanel(input.snapshot, input.caller, input.ragQuery, input.ragPage),
    combat,
    recentRuns: {
      runs: pageSlice(runs, input.runPage),
      page: pageInfo(input.runPage, runs.length),
    },
  };
}

export function causalPlayerSnapshot(input: CausalPlayerReadModelInput): CausalPlayerPanel {
  return causalPlayerPanel(input);
}

function keyedNumbers(values: Readonly<Record<string, number>>, prefix = ""): Readonly<Record<string, number>> {
  return Object.fromEntries(
    Object.entries(values)
      .map(([key, value]) => [`${prefix}${key}`, value] as const)
      .sort(([left], [right]) => left.localeCompare(right)),
  );
}

function numericDeltas(before: Readonly<Record<string, number>>, after: Readonly<Record<string, number>>): readonly CausalPlayerNumericDelta[] {
  return uniqueSorted([...Object.keys(before), ...Object.keys(after)])
    .map((key) => ({ key, before: before[key] || 0, after: after[key] || 0, delta: (after[key] || 0) - (before[key] || 0) }))
    .filter((delta) => delta.delta !== 0);
}

function resourceNumbers(panel: CausalPlayerPanel): Readonly<Record<string, number>> {
  const rows = [...panel.wallet.currencies, ...panel.wallet.resources, ...panel.wallet.materials];
  return Object.fromEntries(rows.map((row) => [
    `${row.accountRef}:${row.resourceKey}:${row.unit}`,
    minorNumber(row.balanceMinor),
  ] as const).sort(([left], [right]) => left.localeCompare(right)));
}

function ragConfidence(panel: CausalPlayerPanel): Readonly<Record<string, number>> {
  return Object.fromEntries(panel.rag.hits.map((hit) => [hit.id, hit.confidence] as const).sort(([left], [right]) => left.localeCompare(right)));
}

export function causalPlayerPanelDelta(before: CausalPlayerPanel, after: CausalPlayerPanel): CausalPlayerPanelDelta {
  const beforeSkills = before.progression.skillTree.learnedNodeIds;
  const afterSkills = after.progression.skillTree.learnedNodeIds;
  const beforeRagIds = before.rag.hits.map((hit) => hit.id);
  const afterRagIds = after.rag.hits.map((hit) => hit.id);
  const beforeIntensity = before.recentRuns.runs[0]?.intensity.encounterIntensity || 0;
  const afterIntensity = after.recentRuns.runs[0]?.intensity.encounterIntensity || 0;
  const beforeScore = before.recentRuns.runs[0]?.score.finalScore || 0;
  const afterScore = after.recentRuns.runs[0]?.score.finalScore || 0;
  return {
    ...(before.checkpointHash ? { fromCheckpointHash: before.checkpointHash } : {}),
    ...(after.checkpointHash ? { toCheckpointHash: after.checkpointHash } : {}),
    resources: numericDeltas(resourceNumbers(before), resourceNumbers(after)),
    skills: {
      addedNodeIds: afterSkills.filter((id) => !beforeSkills.includes(id)),
      removedNodeIds: beforeSkills.filter((id) => !afterSkills.includes(id)),
      proficiency: numericDeltas(
        keyedNumbers(before.progression.skillTree.proficiency),
        keyedNumbers(after.progression.skillTree.proficiency),
      ),
    },
    rag: {
      addedIds: afterRagIds.filter((id) => !beforeRagIds.includes(id)),
      removedIds: beforeRagIds.filter((id) => !afterRagIds.includes(id)),
      confidence: numericDeltas(ragConfidence(before), ragConfidence(after)),
    },
    combatPower: {
      before: before.combat.aggregatePower.mid,
      after: after.combat.aggregatePower.mid,
      delta: after.combat.aggregatePower.mid - before.combat.aggregatePower.mid,
    },
    intensity: {
      before: beforeIntensity,
      after: afterIntensity,
      delta: afterIntensity - beforeIntensity,
    },
    score: {
      before: beforeScore,
      after: afterScore,
      delta: afterScore - beforeScore,
    },
  };
}

function pearson(xs: readonly number[], ys: readonly number[]): number | null {
  if (xs.length !== ys.length || xs.length < 2) return null;
  const meanX = xs.reduce((total, value) => total + value, 0) / xs.length;
  const meanY = ys.reduce((total, value) => total + value, 0) / ys.length;
  let numerator = 0;
  let xDenominator = 0;
  let yDenominator = 0;
  for (let index = 0; index < xs.length; index += 1) {
    const x = xs[index] - meanX;
    const y = ys[index] - meanY;
    numerator += x * y;
    xDenominator += x * x;
    yDenominator += y * y;
  }
  const denominator = Math.sqrt(xDenominator * yDenominator);
  if (denominator === 0) return null;
  return Math.round((numerator / denominator) * 1_000) / 1_000;
}

function correlationLabel(value: number | null): string {
  if (value === null) return "insufficient_variance";
  const magnitude = Math.abs(value);
  if (magnitude >= 0.7) return value > 0 ? "strong_positive" : "strong_negative";
  if (magnitude >= 0.35) return value > 0 ? "moderate_positive" : "moderate_negative";
  if (magnitude >= 0.15) return value > 0 ? "weak_positive" : "weak_negative";
  return "little_linear_relationship";
}

export function causalPlayerTenRunAudit(panel: CausalPlayerPanel): CausalPlayerTenRunAudit {
  const runs = panel.recentRuns.runs.slice(0, 10);
  const chronological = [...runs].reverse();
  const changes = chronological.slice(1).map((run, index) => {
    const previous = chronological[index];
    return {
      fromRunId: previous.runId,
      toRunId: run.runId,
      combatPowerDelta: run.combatPowerMid - previous.combatPowerMid,
      intensityDelta: run.intensity.encounterIntensity - previous.intensity.encounterIntensity,
      scoreDelta: run.score.finalScore - previous.score.finalScore,
      outcomeChanged: run.outcome !== previous.outcome,
    };
  });
  const correlation = pearson(runs.map((run) => run.combatPowerMid), runs.map((run) => run.score.finalScore));
  return {
    runs,
    changes,
    descriptiveCorrelation: {
      sampleSize: runs.length,
      combatPowerVsScorePearson: correlation,
      label: correlationLabel(correlation),
      caveat: "descriptive_non_causal",
    },
  };
}
