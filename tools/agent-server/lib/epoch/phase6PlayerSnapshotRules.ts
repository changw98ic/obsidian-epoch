import {
  causalCanonicalJson,
  causalCanonicalJsonHash,
  type CausalCanonicalJsonValue,
} from "./causalCanonicalJson.ts";
import {
  COMBAT_READINESS_DIMENSION_IDS,
  PROGRESSION_ATTRIBUTE_IDS,
  type CombatReadinessDimensionId,
  type ProgressionAttributeId,
} from "./progressionRules.ts";

export const PHASE6_PLAYER_SNAPSHOT_RULESET_VERSION = "phase6-player-authoritative-snapshot.v2" as const;
export const PHASE6_PLAYER_SNAPSHOT_SCHEMA_VERSION = "phase6-player-snapshot.v2" as const;

export type Phase6PlayerSnapshotPhase = "before" | "after";
export type Phase6PlayerSnapshotNoChangeReason =
  | "hash_equal"
  | "canonical_json_equal"
  | "no_paths_changed";

export const PHASE6_PLAYER_PANEL_DOMAIN_KEYS = [
  "identity",
  "attribute.strength",
  "attribute.agility",
  "attribute.physique",
  "attribute.intellect",
  "attribute.willpower",
  "attribute.spirituality",
  "readiness.adaptation",
  "readiness.control",
  "readiness.corruptionResistance",
  "readiness.mobility",
  "readiness.offense",
  "readiness.perception",
  "readiness.protection",
  "readiness.reserve",
  "readiness.sustain",
  "readiness.synergy",
  "skills",
  "talents",
  "methods",
  "cultivation",
  "injuries",
  "warehouse",
  "currency",
  "materials",
  "equipment",
  "carrySlots",
  "insurance",
  "production",
  "rag",
  "worldCursor",
] as const;

export type Phase6PlayerPanelDomainKey = typeof PHASE6_PLAYER_PANEL_DOMAIN_KEYS[number];
export type Phase6PlayerPanelNoChangeReasons = Readonly<Partial<Record<Phase6PlayerPanelDomainKey, string>>>;

export interface Phase6WorldCursorSnapshot {
  readonly eventId?: string;
  readonly sequence?: number;
  readonly worldMinute?: number;
  readonly worldTime?: string;
  readonly regionId?: string;
  readonly epochId?: string;
}

export interface Phase6PlayerSnapshotInput {
  readonly phase: Phase6PlayerSnapshotPhase;
  readonly player: UnknownRecord;
  readonly progress: UnknownRecord;
  readonly economy: UnknownRecord;
  readonly worldCursor: Phase6WorldCursorSnapshot;
}

export interface Phase6PlayerSnapshotEnvelope {
  readonly schemaVersion: typeof PHASE6_PLAYER_SNAPSHOT_SCHEMA_VERSION;
  readonly rulesetVersion: typeof PHASE6_PLAYER_SNAPSHOT_RULESET_VERSION;
  readonly phase: Phase6PlayerSnapshotPhase;
  readonly identity: CausalCanonicalJsonValue;
  readonly attributes: Readonly<Record<ProgressionAttributeId, number>>;
  readonly readiness: Readonly<Record<CombatReadinessDimensionId, number>>;
  readonly progression: {
    readonly skills: CausalCanonicalJsonValue;
    readonly talents: CausalCanonicalJsonValue;
    readonly methods: CausalCanonicalJsonValue;
    readonly cultivation: CausalCanonicalJsonValue;
    readonly practice: CausalCanonicalJsonValue;
    readonly injuries: CausalCanonicalJsonValue;
  };
  readonly economy: {
    readonly warehouse: CausalCanonicalJsonValue;
    readonly currencies: CausalCanonicalJsonValue;
    readonly materials: CausalCanonicalJsonValue;
    readonly equipment: CausalCanonicalJsonValue;
    readonly carry: CausalCanonicalJsonValue;
    readonly insurance: CausalCanonicalJsonValue;
    readonly production: CausalCanonicalJsonValue;
  };
  readonly ragPanel: CausalCanonicalJsonValue;
  readonly worldCursor: Phase6WorldCursorSnapshot;
}

export interface Phase6PlayerSnapshotDocument {
  readonly snapshot: Phase6PlayerSnapshotEnvelope;
  readonly canonicalJson: string;
  readonly hash: `sha256:${string}`;
}

export interface Phase6SnapshotPathChange {
  readonly path: string;
  readonly before?: CausalCanonicalJsonValue;
  readonly after?: CausalCanonicalJsonValue;
}

export interface Phase6PlayerSnapshotDiff {
  readonly beforeHash: `sha256:${string}`;
  readonly afterHash: `sha256:${string}`;
  readonly changed: boolean;
  readonly added: readonly Phase6SnapshotPathChange[];
  readonly removed: readonly Phase6SnapshotPathChange[];
  readonly changedValues: readonly Phase6SnapshotPathChange[];
  readonly noChangeReason?: Phase6PlayerSnapshotNoChangeReason;
}

type UnknownRecord = Readonly<Record<string, unknown>>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredRecord(value: unknown, path: string): UnknownRecord {
  if (!isRecord(value)) throw new Error(`phase6_snapshot_missing_required_record:${path}`);
  return value;
}

function requiredArray(value: unknown, path: string): readonly unknown[] {
  if (!Array.isArray(value)) throw new Error(`phase6_snapshot_missing_required_array:${path}`);
  return value;
}

function requiredNumber(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`phase6_snapshot_missing_required_number:${path}`);
  }
  return value;
}

function optionalRecord(value: unknown): UnknownRecord | undefined {
  return isRecord(value) ? value : undefined;
}

function optionalArray(value: unknown): readonly unknown[] | undefined {
  return Array.isArray(value) ? value : undefined;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function asJson(value: unknown, path: string): CausalCanonicalJsonValue {
  if (value === null) return null;
  if (typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(`phase6_snapshot_non_finite_number:${path}`);
    return value;
  }
  if (Array.isArray(value)) return value.map((item, index) => asJson(item, `${path}[${index}]`));
  if (!isRecord(value)) throw new Error(`phase6_snapshot_non_canonical_value:${path}`);

  const normalized: Record<string, CausalCanonicalJsonValue> = {};
  for (const key of Object.keys(value).sort()) {
    const nextValue = value[key];
    if (nextValue === undefined) throw new Error(`phase6_snapshot_undefined_value:${path}.${key}`);
    normalized[key] = asJson(nextValue, `${path}.${key}`);
  }
  return normalized;
}

function jsonSortKey(value: unknown): string {
  return causalCanonicalJson(asJson(value, "$sort"));
}

function sortedJsonArray(items: readonly unknown[], path: string, keyOf?: (item: UnknownRecord) => string): CausalCanonicalJsonValue {
  return items
    .map((item, index) => {
      const jsonValue = asJson(item, `${path}[${index}]`);
      const key = keyOf && isRecord(item) ? keyOf(item) : jsonSortKey(jsonValue);
      return { key, jsonValue };
    })
    .sort((left, right) => left.key.localeCompare(right.key) || jsonSortKey(left.jsonValue).localeCompare(jsonSortKey(right.jsonValue)))
    .map((entry) => entry.jsonValue);
}

function pickRecord(source: UnknownRecord, keys: readonly string[]): UnknownRecord {
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    if (source[key] !== undefined) out[key] = source[key];
  }
  return out;
}

function definedRecord(source: UnknownRecord): UnknownRecord {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(source)) {
    if (source[key] !== undefined) out[key] = source[key];
  }
  return out;
}

function firstRecord(source: UnknownRecord, keys: readonly string[], path: string): UnknownRecord {
  for (const key of keys) {
    const value = optionalRecord(source[key]);
    if (value) return value;
  }
  throw new Error(`phase6_snapshot_missing_required_record:${path}`);
}

function extractIdentity(input: Phase6PlayerSnapshotInput): CausalCanonicalJsonValue {
  const playerIdentity = optionalRecord(input.player.identity);
  const progressIdentity = optionalRecord(input.progress.identity);
  const base = definedRecord({
    playerId: optionalString(input.player.playerId),
    agentId: optionalString(input.player.agentId) || optionalString(input.progress.agentId),
    explorerId: optionalString(input.player.explorerId) || optionalString(input.progress.explorerId),
    identityId: optionalString(input.player.identityId) || optionalString(optionalRecord(input.player.progression)?.identityId),
    lineageId: optionalString(optionalRecord(input.player.progression)?.lineageId),
    playerIdentity,
    progressIdentity,
    lineage: optionalArray(input.progress.lineage),
    identities: optionalArray(input.progress.identities),
    identitySlots: input.progress.identitySlots,
    custody: input.progress.custody,
    factionStandings: optionalArray(input.progress.factionStandings),
  });
  if (!base.playerId && !base.agentId && !base.explorerId && !base.identityId && !playerIdentity && !progressIdentity) {
    throw new Error("phase6_snapshot_identity_missing_stable_key");
  }
  return asJson(base, "$.identity");
}

function extractAttributes(input: Phase6PlayerSnapshotInput): Readonly<Record<ProgressionAttributeId, number>> {
  const attributes = firstRecord(
    firstRecord(input.player, ["progression"], "$.player.progression"),
    ["attributes"],
    "$.player.progression.attributes",
  );
  const out = {} as Record<ProgressionAttributeId, number>;
  for (const id of PROGRESSION_ATTRIBUTE_IDS) {
    out[id] = requiredNumber(attributes[id], `$.player.progression.attributes.${id}`);
  }
  return out;
}

function extractReadiness(input: Phase6PlayerSnapshotInput): Readonly<Record<CombatReadinessDimensionId, number>> {
  const combatReadiness = firstRecord(input.player, ["combatReadiness", "readiness"], "$.player.combatReadiness");
  const dimensions = firstRecord(combatReadiness, ["dimensions"], "$.player.combatReadiness.dimensions");
  const out = {} as Record<CombatReadinessDimensionId, number>;
  for (const id of COMBAT_READINESS_DIMENSION_IDS) {
    out[id] = requiredNumber(dimensions[id], `$.player.combatReadiness.dimensions.${id}`);
  }
  return out;
}

function extractProgression(input: Phase6PlayerSnapshotInput): Phase6PlayerSnapshotEnvelope["progression"] {
  const playerProgression = firstRecord(input.player, ["progression"], "$.player.progression");
  const skillTree = firstRecord(playerProgression, ["skillTree"], "$.player.progression.skillTree");
  const resources = optionalRecord(playerProgression.resources);
  const status = optionalRecord(playerProgression.status) || optionalRecord(input.progress.status);
  const injuries = optionalArray(input.progress.injuries)
    || optionalArray(input.progress.injuryStates)
    || optionalArray(input.player.injuries)
    || optionalArray(input.player.injuryStates);
  if (!status && !injuries) throw new Error("phase6_snapshot_missing_required_injury_state");

  return {
    skills: asJson({
      learnedNodeIds: sortedJsonArray(requiredArray(skillTree.learnedNodeIds, "$.player.progression.skillTree.learnedNodeIds"), "$.skills.learnedNodeIds"),
      definitions: sortedJsonArray(requiredArray(skillTree.definitions, "$.player.progression.skillTree.definitions"), "$.skills.definitions", (item) => optionalString(item.nodeId) || jsonSortKey(item)),
      proficiency: requiredRecord(skillTree.proficiency, "$.player.progression.skillTree.proficiency"),
      advancement: sortedJsonArray(requiredArray(skillTree.advancement, "$.player.progression.skillTree.advancement"), "$.skills.advancement", (item) => optionalString(item.methodId) || jsonSortKey(item)),
    }, "$.progression.skills"),
    talents: sortedJsonArray(requiredArray(playerProgression.talents, "$.player.progression.talents"), "$.progression.talents", (item) => optionalString(item.talentId) || jsonSortKey(item)),
    methods: sortedJsonArray(requiredArray(skillTree.advancement, "$.player.progression.skillTree.advancement"), "$.progression.methods", (item) => optionalString(item.methodId) || jsonSortKey(item)),
    cultivation: asJson(definedRecord({
      powerSystemId: playerProgression.powerSystemId,
      lineageId: playerProgression.lineageId,
      functionalStage: requiredRecord(playerProgression.functionalStage, "$.player.progression.functionalStage"),
      resources,
    }), "$.progression.cultivation"),
    practice: asJson(definedRecord({
      downtime: input.progress.downtime,
      pendingDowntime: input.progress.pendingDowntime,
      downtimeDiaryEntries: optionalArray(input.progress.downtimeDiaryEntries),
      personalityDrifts: optionalArray(input.progress.personalityDrifts),
      actionEligibility: input.progress.actionEligibility,
      latestEvents: optionalArray(input.progress.latestEvents),
    }), "$.progression.practice"),
    injuries: asJson(definedRecord({
      status,
      injuries,
    }), "$.progression.injuries"),
  };
}

function extractEconomy(input: Phase6PlayerSnapshotInput): Phase6PlayerSnapshotEnvelope["economy"] {
  const wallet = firstRecord(input.player, ["wallet"], "$.player.wallet");
  const loadout = firstRecord(firstRecord(input.player, ["progression"], "$.player.progression"), ["loadout"], "$.player.progression.loadout");
  const inventory = optionalRecord(input.economy.inventory) || optionalRecord(input.economy.inventoryInfo);
  const production = optionalRecord(input.economy.production)
    || optionalRecord(input.economy.productionInfo)
    || optionalRecord(input.player.production);
  if (!production) throw new Error("phase6_snapshot_missing_required_record:$.economy.production");

  return {
    warehouse: asJson(definedRecord({
      accounts: sortedJsonArray(requiredArray(wallet.accounts, "$.player.wallet.accounts"), "$.economy.accounts"),
      resources: sortedJsonArray([
        ...requiredArray(wallet.resources, "$.player.wallet.resources"),
        ...requiredArray(wallet.materials, "$.player.wallet.materials"),
      ], "$.economy.resources", resourceRowKey),
      uniqueItems: sortedJsonArray(requiredArray(wallet.uniqueItems, "$.player.wallet.uniqueItems"), "$.economy.uniqueItems", itemKey),
      inventory,
    }), "$.economy.warehouse"),
    currencies: sortedJsonArray(requiredArray(wallet.currencies, "$.player.wallet.currencies"), "$.economy.currencies", resourceRowKey),
    materials: sortedJsonArray(requiredArray(wallet.materials, "$.player.wallet.materials"), "$.economy.materials", resourceRowKey),
    equipment: asJson({
      equipmentEffects: sortedJsonArray(requiredArray(input.progress.equipmentEffects, "$.progress.equipmentEffects"), "$.economy.equipmentEffects", (item) => optionalString(item.itemId) || jsonSortKey(item)),
      inventoryItems: sortedJsonArray(requiredArray(input.progress.inventoryItems, "$.progress.inventoryItems"), "$.economy.inventoryItems", (item) => optionalString(item.itemId) || jsonSortKey(item)),
    }, "$.economy.equipment"),
    carry: asJson({
      carrySlots: requiredNumber(loadout.carrySlots, "$.player.progression.loadout.carrySlots"),
      deploymentCapacity: requiredNumber(loadout.deploymentCapacity, "$.player.progression.loadout.deploymentCapacity"),
      quickUseSlots: requiredNumber(loadout.quickUseSlots, "$.player.progression.loadout.quickUseSlots"),
      echoSlots: requiredNumber(loadout.echoSlots, "$.player.progression.loadout.echoSlots"),
      broughtItems: sortedJsonArray(requiredArray(loadout.broughtItems, "$.player.progression.loadout.broughtItems"), "$.economy.carry.broughtItems", (item) => optionalString(item.itemId) || jsonSortKey(item)),
      usedDeploymentCapacity: requiredNumber(loadout.usedDeploymentCapacity, "$.player.progression.loadout.usedDeploymentCapacity"),
      usedQuickUseSlots: requiredNumber(loadout.usedQuickUseSlots, "$.player.progression.loadout.usedQuickUseSlots"),
      usedWeightMinor: loadout.usedWeightMinor,
      capacity: requiredRecord(wallet.capacity, "$.player.wallet.capacity"),
    }, "$.economy.carry"),
    insurance: asJson(definedRecord({
      insuranceLayers: requiredNumber(loadout.insuranceLayers, "$.player.progression.loadout.insuranceLayers"),
      custody: input.progress.custody,
    }), "$.economy.insurance"),
    production: asJson(production, "$.economy.production"),
  };
}

function resourceRowKey(item: UnknownRecord): string {
  return [
    optionalString(item.accountRef) || "",
    optionalString(item.resourceClass) || "",
    optionalString(item.resourceKey) || "",
    optionalString(item.unit) || "",
  ].join("\u0000");
}

function itemKey(item: UnknownRecord): string {
  return optionalString(item.itemRef)
    || optionalString(item.itemId)
    || optionalString(item.itemKey)
    || jsonSortKey(item);
}

function extractRagPanel(input: Phase6PlayerSnapshotInput): CausalCanonicalJsonValue {
  const ragPanel = firstRecord(input.player, ["ragPanel", "rag"], "$.player.ragPanel");
  return asJson({
    hits: sortedJsonArray(requiredArray(ragPanel.hits, "$.player.ragPanel.hits"), "$.ragPanel.hits", (item) => {
      const retrieval = optionalRecord(item.retrieval);
      const rank = typeof retrieval?.rank === "number" ? String(retrieval.rank).padStart(12, "0") : "999999999999";
      return `${rank}\u0000${optionalString(item.id) || jsonSortKey(item)}`;
    }),
    countsByKind: requiredRecord(ragPanel.countsByKind, "$.player.ragPanel.countsByKind"),
    page: requiredRecord(ragPanel.page, "$.player.ragPanel.page"),
    retrieval: requiredRecord(ragPanel.retrieval, "$.player.ragPanel.retrieval"),
  }, "$.ragPanel");
}

function normalizeWorldCursor(cursor: Phase6WorldCursorSnapshot): Phase6WorldCursorSnapshot {
  if (!isRecord(cursor)) throw new Error("phase6_snapshot_missing_required_record:$.worldCursor");
  if (
    cursor.eventId === undefined
    && cursor.sequence === undefined
    && cursor.worldMinute === undefined
    && cursor.worldTime === undefined
    && cursor.epochId === undefined
  ) {
    throw new Error("phase6_snapshot_world_cursor_missing_stable_key");
  }
  return asJson(pickRecord(cursor, ["eventId", "sequence", "worldMinute", "worldTime", "regionId", "epochId"]), "$.worldCursor") as unknown as Phase6WorldCursorSnapshot;
}

export function createPhase6PlayerSnapshot(input: Phase6PlayerSnapshotInput): Phase6PlayerSnapshotEnvelope {
  const snapshot: Phase6PlayerSnapshotEnvelope = {
    schemaVersion: PHASE6_PLAYER_SNAPSHOT_SCHEMA_VERSION,
    rulesetVersion: PHASE6_PLAYER_SNAPSHOT_RULESET_VERSION,
    phase: input.phase,
    identity: extractIdentity(input),
    attributes: extractAttributes(input),
    readiness: extractReadiness(input),
    progression: extractProgression(input),
    economy: extractEconomy(input),
    ragPanel: extractRagPanel(input),
    worldCursor: normalizeWorldCursor(input.worldCursor),
  };
  return normalizePhase6PlayerSnapshot(snapshot);
}

export function normalizePhase6PlayerSnapshot(snapshot: Phase6PlayerSnapshotEnvelope): Phase6PlayerSnapshotEnvelope {
  const normalized = asJson(snapshot, "$.snapshot") as unknown as Phase6PlayerSnapshotEnvelope;
  if (normalized.schemaVersion !== PHASE6_PLAYER_SNAPSHOT_SCHEMA_VERSION) {
    throw new Error("phase6_snapshot_schema_version_mismatch");
  }
  if (normalized.rulesetVersion !== PHASE6_PLAYER_SNAPSHOT_RULESET_VERSION) {
    throw new Error("phase6_snapshot_ruleset_version_mismatch");
  }
  return normalized;
}

export function canonicalizePhase6PlayerSnapshot(snapshot: Phase6PlayerSnapshotEnvelope): string {
  return causalCanonicalJson(normalizePhase6PlayerSnapshot(snapshot));
}

export function hashPhase6PlayerSnapshot(snapshot: Phase6PlayerSnapshotEnvelope): `sha256:${string}` {
  return causalCanonicalJsonHash(normalizePhase6PlayerSnapshot(snapshot));
}

export function buildPhase6PlayerSnapshotDocument(input: Phase6PlayerSnapshotInput): Phase6PlayerSnapshotDocument {
  const snapshot = createPhase6PlayerSnapshot(input);
  const canonicalJson = canonicalizePhase6PlayerSnapshot(snapshot);
  return {
    snapshot,
    canonicalJson,
    hash: causalCanonicalJsonHash(snapshot),
  };
}

function panelReasonSnapshot(value: unknown): Phase6PlayerSnapshotEnvelope | undefined {
  if (!isRecord(value)
    || value.schemaVersion !== PHASE6_PLAYER_SNAPSHOT_SCHEMA_VERSION
    || value.rulesetVersion !== PHASE6_PLAYER_SNAPSHOT_RULESET_VERSION
    || !isRecord(value.attributes)
    || !isRecord(value.readiness)
    || !isRecord(value.progression)
    || !isRecord(value.economy)) return undefined;
  const snapshot = value as unknown as Phase6PlayerSnapshotEnvelope;
  const values = panelDomainValues(snapshot);
  return PHASE6_PLAYER_PANEL_DOMAIN_KEYS.every((key) => values[key] !== undefined) ? snapshot : undefined;
}

function panelDomainValues(snapshot: Phase6PlayerSnapshotEnvelope): Readonly<Record<Phase6PlayerPanelDomainKey, CausalCanonicalJsonValue>> {
  return {
    identity: snapshot.identity,
    "attribute.strength": snapshot.attributes.strength,
    "attribute.agility": snapshot.attributes.agility,
    "attribute.physique": snapshot.attributes.physique,
    "attribute.intellect": snapshot.attributes.intellect,
    "attribute.willpower": snapshot.attributes.willpower,
    "attribute.spirituality": snapshot.attributes.spirituality,
    "readiness.adaptation": snapshot.readiness.adaptation,
    "readiness.control": snapshot.readiness.control,
    "readiness.corruptionResistance": snapshot.readiness.corruptionResistance,
    "readiness.mobility": snapshot.readiness.mobility,
    "readiness.offense": snapshot.readiness.offense,
    "readiness.perception": snapshot.readiness.perception,
    "readiness.protection": snapshot.readiness.protection,
    "readiness.reserve": snapshot.readiness.reserve,
    "readiness.sustain": snapshot.readiness.sustain,
    "readiness.synergy": snapshot.readiness.synergy,
    skills: snapshot.progression.skills,
    talents: snapshot.progression.talents,
    methods: snapshot.progression.methods,
    cultivation: snapshot.progression.cultivation,
    injuries: snapshot.progression.injuries,
    warehouse: snapshot.economy.warehouse,
    currency: snapshot.economy.currencies,
    materials: snapshot.economy.materials,
    equipment: snapshot.economy.equipment,
    carrySlots: snapshot.economy.carry,
    insurance: snapshot.economy.insurance,
    production: snapshot.economy.production,
    rag: snapshot.ragPanel,
    worldCursor: snapshot.worldCursor as unknown as CausalCanonicalJsonValue,
  };
}

function panelDomainNoChangeReason(domain: Phase6PlayerPanelDomainKey): string {
  if (domain === "identity") return "no_canonical_identity_change";
  if (domain.startsWith("attribute.")) return "no_canonical_attribute_growth_event";
  if (domain.startsWith("readiness.")) return "no_canonical_readiness_change";
  if (["skills", "talents", "methods", "cultivation"].includes(domain)) return "no_eligible_progression_change";
  if (domain === "injuries") return "no_injury_state_change";
  if (["warehouse", "currency", "materials", "equipment", "carrySlots", "insurance", "production"].includes(domain)) {
    return "no_canonical_economy_change";
  }
  if (domain === "rag") return "no_persistent_rag_change";
  return "no_world_cursor_change";
}

export function phase6PlayerPanelNoChangeReasons(
  before: unknown,
  after: unknown,
): Phase6PlayerPanelNoChangeReasons | undefined {
  const beforeSnapshot = panelReasonSnapshot(before);
  const afterSnapshot = panelReasonSnapshot(after);
  if (!beforeSnapshot || !afterSnapshot) return undefined;
  const beforeValues = panelDomainValues(beforeSnapshot);
  const afterValues = panelDomainValues(afterSnapshot);
  const reasons: Partial<Record<Phase6PlayerPanelDomainKey, string>> = {};
  for (const domain of PHASE6_PLAYER_PANEL_DOMAIN_KEYS) {
    if (causalCanonicalJson(beforeValues[domain]) === causalCanonicalJson(afterValues[domain])) {
      reasons[domain] = panelDomainNoChangeReason(domain);
    }
  }
  return reasons;
}

export function diffPhase6PlayerSnapshots(
  before: Phase6PlayerSnapshotEnvelope,
  after: Phase6PlayerSnapshotEnvelope,
): Phase6PlayerSnapshotDiff {
  const normalizedBefore = normalizePhase6PlayerSnapshot(before);
  const normalizedAfter = normalizePhase6PlayerSnapshot(after);
  const beforeHash = hashPhase6PlayerSnapshot(normalizedBefore);
  const afterHash = hashPhase6PlayerSnapshot(normalizedAfter);
  const added: Phase6SnapshotPathChange[] = [];
  const removed: Phase6SnapshotPathChange[] = [];
  const changedValues: Phase6SnapshotPathChange[] = [];

  collectDiffs(
    comparableSnapshotJson(normalizedBefore),
    comparableSnapshotJson(normalizedAfter),
    "$",
    added,
    removed,
    changedValues,
  );

  const changed = added.length > 0 || removed.length > 0 || changedValues.length > 0;
  return {
    beforeHash,
    afterHash,
    changed,
    added,
    removed,
    changedValues,
    noChangeReason: changed
      ? undefined
      : beforeHash === afterHash
        ? "hash_equal"
        : causalCanonicalJson(comparableSnapshotJson(normalizedBefore)) === causalCanonicalJson(comparableSnapshotJson(normalizedAfter))
          ? "canonical_json_equal"
          : "no_paths_changed",
  };
}

function comparableSnapshotJson(snapshot: Phase6PlayerSnapshotEnvelope): CausalCanonicalJsonValue {
  const { phase: _phase, ...content } = normalizePhase6PlayerSnapshot(snapshot);
  return asJson(content, "$.snapshotContent");
}

function collectDiffs(
  before: CausalCanonicalJsonValue | undefined,
  after: CausalCanonicalJsonValue | undefined,
  path: string,
  added: Phase6SnapshotPathChange[],
  removed: Phase6SnapshotPathChange[],
  changedValues: Phase6SnapshotPathChange[],
) {
  if (before === undefined) {
    added.push({ path, after });
    return;
  }
  if (after === undefined) {
    removed.push({ path, before });
    return;
  }
  if (causalCanonicalJson(before) === causalCanonicalJson(after)) return;

  if (Array.isArray(before) || Array.isArray(after)) {
    changedValues.push({ path, before, after });
    return;
  }
  if (isRecord(before) && isRecord(after)) {
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    for (const key of [...keys].sort()) {
      collectDiffs(
        before[key] as CausalCanonicalJsonValue | undefined,
        after[key] as CausalCanonicalJsonValue | undefined,
        `${path}.${key}`,
        added,
        removed,
        changedValues,
      );
    }
    return;
  }

  changedValues.push({ path, before, after });
}
