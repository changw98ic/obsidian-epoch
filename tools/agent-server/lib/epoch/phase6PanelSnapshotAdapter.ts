import {
  buildPhase6PlayerSnapshotDocument,
  type Phase6PlayerSnapshotDocument,
  type Phase6PlayerSnapshotInput,
  type Phase6PlayerSnapshotPhase,
  type Phase6WorldCursorSnapshot,
} from "./phase6PlayerSnapshotRules.ts";
import type {
  CausalPlayerCombatReadiness,
  CausalPlayerProgressionReadModel,
  CausalPlayerRagPanel,
  CausalPlayerWalletReadModel,
} from "./causalPlayerReadModel.ts";
import type { EpochProgressView } from "./progressReadModel.ts";
import type { EpochInventoryInfo } from "./economyRuntimeReadModel.ts";
import {
  COMBAT_READINESS_DIMENSION_IDS,
  PROGRESSION_ATTRIBUTE_IDS,
  type CombatReadinessDimensionId,
  type ProgressionAttributeId,
} from "./progressionRules.ts";

type UnknownRecord = Readonly<Record<string, unknown>>;

export interface Phase6PanelSnapshotPlayerProjection {
  readonly playerId?: string;
  readonly agentId?: string;
  readonly explorerId?: string;
  readonly identityId?: string;
  readonly identity?: unknown;
  readonly progression: CausalPlayerProgressionReadModel;
  readonly combatReadiness: CausalPlayerCombatReadiness;
  readonly wallet: CausalPlayerWalletReadModel;
  readonly injuries?: unknown;
  readonly injuryStates?: unknown;
  readonly production?: unknown;
}

export interface Phase6PanelSnapshotEconomyProjection {
  readonly inventory?: EpochInventoryInfo;
  readonly inventoryInfo?: EpochInventoryInfo;
  readonly production: unknown;
}

export interface Phase6PanelSnapshotAdapterInput {
  readonly phase: Phase6PlayerSnapshotPhase;
  readonly player: Phase6PanelSnapshotPlayerProjection;
  readonly progress: EpochProgressView & UnknownRecord;
  readonly economy: Phase6PanelSnapshotEconomyProjection;
  readonly ragPanel: CausalPlayerRagPanel;
  readonly worldCursor: Phase6WorldCursorSnapshot;
}

export interface Phase6PanelSnapshotAdapterError {
  readonly code:
    | "missing_required_array"
    | "missing_required_domain"
    | "missing_required_number"
    | "missing_required_record"
    | "missing_required_value"
    | "invalid_phase"
    | "snapshot_build_failed";
  readonly path: string;
  readonly message: string;
}

export type Phase6PanelSnapshotAdapterResult<T> =
  | {
    readonly ok: true;
    readonly value: T;
  }
  | {
    readonly ok: false;
    readonly errors: readonly Phase6PanelSnapshotAdapterError[];
  };

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function error(
  code: Phase6PanelSnapshotAdapterError["code"],
  path: string,
  expected: string,
): Phase6PanelSnapshotAdapterError {
  return {
    code,
    path,
    message: `${path} must provide ${expected}`,
  };
}

function requireRecord(
  value: unknown,
  path: string,
  errors: Phase6PanelSnapshotAdapterError[],
): value is UnknownRecord {
  if (isRecord(value)) return true;
  errors.push(error("missing_required_record", path, "a record"));
  return false;
}

function requireArray(
  value: unknown,
  path: string,
  errors: Phase6PanelSnapshotAdapterError[],
): value is readonly unknown[] {
  if (Array.isArray(value)) return true;
  errors.push(error("missing_required_array", path, "an array"));
  return false;
}

function requireNumber(
  value: unknown,
  path: string,
  errors: Phase6PanelSnapshotAdapterError[],
): value is number {
  if (typeof value === "number" && Number.isFinite(value)) return true;
  errors.push(error("missing_required_number", path, "a finite number"));
  return false;
}

function requireValue(value: unknown, path: string, errors: Phase6PanelSnapshotAdapterError[]) {
  if (value !== undefined && value !== null) return;
  errors.push(error("missing_required_value", path, "a value"));
}

function validateStableIdentity(input: Phase6PanelSnapshotAdapterInput, errors: Phase6PanelSnapshotAdapterError[]) {
  const progression = input.player.progression;
  const hasStableIdentity = isNonEmptyString(input.player.playerId)
    || isNonEmptyString(input.player.agentId)
    || isNonEmptyString(input.progress.agentId)
    || isNonEmptyString(input.player.explorerId)
    || isNonEmptyString(input.progress.explorerId)
    || isNonEmptyString(input.player.identityId)
    || isNonEmptyString(progression.identityId)
    || isRecord(input.player.identity)
    || isRecord(input.progress.identity);
  if (!hasStableIdentity) {
    errors.push(error("missing_required_domain", "$.player.identity", "at least one stable identity key"));
  }
}

function validateProgression(input: Phase6PanelSnapshotAdapterInput, errors: Phase6PanelSnapshotAdapterError[]) {
  const progression = input.player.progression;
  requireRecord(progression, "$.player.progression", errors);
  if (requireRecord(progression.attributes, "$.player.progression.attributes", errors)) {
    for (const id of PROGRESSION_ATTRIBUTE_IDS) {
      requireNumber(progression.attributes[id], `$.player.progression.attributes.${id}`, errors);
    }
  }
  if (requireRecord(progression.skillTree, "$.player.progression.skillTree", errors)) {
    requireArray(progression.skillTree.learnedNodeIds, "$.player.progression.skillTree.learnedNodeIds", errors);
    requireArray(progression.skillTree.definitions, "$.player.progression.skillTree.definitions", errors);
    requireRecord(progression.skillTree.proficiency, "$.player.progression.skillTree.proficiency", errors);
    requireArray(progression.skillTree.advancement, "$.player.progression.skillTree.advancement", errors);
  }
  requireArray(progression.talents, "$.player.progression.talents", errors);
  requireRecord(progression.functionalStage, "$.player.progression.functionalStage", errors);
  requireValue(progression.loadout, "$.player.progression.loadout", errors);
  if (requireRecord(progression.loadout, "$.player.progression.loadout", errors)) {
    requireNumber(progression.loadout.carrySlots, "$.player.progression.loadout.carrySlots", errors);
    requireNumber(progression.loadout.deploymentCapacity, "$.player.progression.loadout.deploymentCapacity", errors);
    requireNumber(progression.loadout.quickUseSlots, "$.player.progression.loadout.quickUseSlots", errors);
    requireNumber(progression.loadout.echoSlots, "$.player.progression.loadout.echoSlots", errors);
    requireNumber(progression.loadout.insuranceLayers, "$.player.progression.loadout.insuranceLayers", errors);
    requireArray(progression.loadout.broughtItems, "$.player.progression.loadout.broughtItems", errors);
    requireNumber(progression.loadout.usedDeploymentCapacity, "$.player.progression.loadout.usedDeploymentCapacity", errors);
    requireNumber(progression.loadout.usedQuickUseSlots, "$.player.progression.loadout.usedQuickUseSlots", errors);
    requireValue(progression.loadout.usedWeightMinor, "$.player.progression.loadout.usedWeightMinor", errors);
  }
  if (
    !isRecord(input.progress.status)
    && !Array.isArray(input.progress.injuries)
    && !Array.isArray(input.progress.injuryStates)
    && !Array.isArray(input.player.injuries)
    && !Array.isArray(input.player.injuryStates)
  ) {
    errors.push(error("missing_required_domain", "$.progression.injuries", "status or injury state"));
  }
}

function validateReadiness(input: Phase6PanelSnapshotAdapterInput, errors: Phase6PanelSnapshotAdapterError[]) {
  const dimensions = input.player.combatReadiness.dimensions;
  if (!requireRecord(dimensions, "$.player.combatReadiness.dimensions", errors)) return;
  for (const id of COMBAT_READINESS_DIMENSION_IDS) {
    requireNumber(dimensions[id], `$.player.combatReadiness.dimensions.${id}`, errors);
  }
}

function validateWallet(input: Phase6PanelSnapshotAdapterInput, errors: Phase6PanelSnapshotAdapterError[]) {
  const wallet = input.player.wallet;
  if (!requireRecord(wallet, "$.player.wallet", errors)) return;
  requireArray(wallet.accounts, "$.player.wallet.accounts", errors);
  requireArray(wallet.currencies, "$.player.wallet.currencies", errors);
  requireArray(wallet.resources, "$.player.wallet.resources", errors);
  requireArray(wallet.materials, "$.player.wallet.materials", errors);
  requireArray(wallet.uniqueItems, "$.player.wallet.uniqueItems", errors);
  requireRecord(wallet.capacity, "$.player.wallet.capacity", errors);
}

function validateProgressView(input: Phase6PanelSnapshotAdapterInput, errors: Phase6PanelSnapshotAdapterError[]) {
  requireArray(input.progress.equipmentEffects, "$.progress.equipmentEffects", errors);
  requireArray(input.progress.inventoryItems, "$.progress.inventoryItems", errors);
}

function validateRagPanel(input: Phase6PanelSnapshotAdapterInput, errors: Phase6PanelSnapshotAdapterError[]) {
  const ragPanel = input.ragPanel;
  if (!requireRecord(ragPanel, "$.player.ragPanel", errors)) return;
  requireArray(ragPanel.hits, "$.player.ragPanel.hits", errors);
  requireRecord(ragPanel.countsByKind, "$.player.ragPanel.countsByKind", errors);
  requireRecord(ragPanel.page, "$.player.ragPanel.page", errors);
  requireRecord(ragPanel.retrieval, "$.player.ragPanel.retrieval", errors);
}

function validateEconomy(input: Phase6PanelSnapshotAdapterInput, errors: Phase6PanelSnapshotAdapterError[]) {
  if (!requireRecord(input.economy, "$.economy", errors)) return;
  requireValue(input.economy.production, "$.economy.production", errors);
}

function validateWorldCursor(input: Phase6PanelSnapshotAdapterInput, errors: Phase6PanelSnapshotAdapterError[]) {
  const cursor = input.worldCursor;
  if (!requireRecord(cursor, "$.worldCursor", errors)) return;
  if (
    cursor.eventId === undefined
    && cursor.sequence === undefined
    && cursor.worldMinute === undefined
    && cursor.worldTime === undefined
    && cursor.epochId === undefined
  ) {
    errors.push(error("missing_required_domain", "$.worldCursor", "at least one stable cursor key"));
  }
}

function collectAdapterErrors(input: Phase6PanelSnapshotAdapterInput): readonly Phase6PanelSnapshotAdapterError[] {
  const errors: Phase6PanelSnapshotAdapterError[] = [];
  if (input.phase !== "before" && input.phase !== "after") {
    errors.push(error("invalid_phase", "$.phase", '"before" or "after"'));
  }
  validateStableIdentity(input, errors);
  validateProgression(input, errors);
  validateReadiness(input, errors);
  validateWallet(input, errors);
  validateProgressView(input, errors);
  validateRagPanel(input, errors);
  validateEconomy(input, errors);
  validateWorldCursor(input, errors);
  return errors;
}

function toPhase6PlayerSnapshotInput(input: Phase6PanelSnapshotAdapterInput): Phase6PlayerSnapshotInput {
  const progress = input.player.progression;
  return {
    phase: input.phase,
    player: {
      playerId: input.player.playerId,
      agentId: input.player.agentId ?? input.progress.agentId,
      explorerId: input.player.explorerId ?? input.progress.explorerId,
      identityId: input.player.identityId ?? progress.identityId,
      identity: input.player.identity,
      progression: progress,
      combatReadiness: input.player.combatReadiness,
      wallet: input.player.wallet,
      ragPanel: input.ragPanel,
      injuries: input.player.injuries,
      injuryStates: input.player.injuryStates,
      production: input.player.production,
    },
    progress: input.progress,
    economy: {
      inventory: input.economy.inventory,
      inventoryInfo: input.economy.inventoryInfo,
      production: input.economy.production,
    },
    worldCursor: input.worldCursor,
  };
}

export function adaptPhase6PanelSnapshotInput(
  input: Phase6PanelSnapshotAdapterInput,
): Phase6PanelSnapshotAdapterResult<Phase6PlayerSnapshotInput> {
  const errors = collectAdapterErrors(input);
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: toPhase6PlayerSnapshotInput(input) };
}

export function buildPhase6PanelSnapshotDocument(
  input: Phase6PanelSnapshotAdapterInput,
): Phase6PanelSnapshotAdapterResult<Phase6PlayerSnapshotDocument> {
  const adapted = adaptPhase6PanelSnapshotInput(input);
  if (!adapted.ok) return adapted;
  try {
    return {
      ok: true,
      value: buildPhase6PlayerSnapshotDocument(adapted.value),
    };
  } catch (cause) {
    return {
      ok: false,
      errors: [{
        code: "snapshot_build_failed",
        path: "$",
        message: cause instanceof Error ? cause.message : String(cause),
      }],
    };
  }
}
