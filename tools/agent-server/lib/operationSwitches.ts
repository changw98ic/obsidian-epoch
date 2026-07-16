export const EPOCH_OPERATION_SWITCHES_ENV_VAR = "AGENT_WORLD_OPERATION_SWITCHES_JSON" as const;

export type EpochOperationSwitchAction = "settlement" | "public_sharing" | "source_reward";

export interface EpochOperationGateInput {
  readonly action: EpochOperationSwitchAction;
  readonly rewardType?: string;
  readonly commissionType?: string;
  readonly chapterId?: string;
  readonly locationId?: string;
  readonly factionId?: string;
  readonly riskLevel?: string;
}

export interface EpochOperationSwitch extends EpochOperationGateInput {
  readonly paused: boolean;
  readonly reason: string;
  readonly rewardTypes: readonly string[];
  readonly commissionTypes: readonly string[];
  readonly chapterIds: readonly string[];
  readonly locationIds: readonly string[];
  readonly factionIds: readonly string[];
  readonly riskLevels: readonly string[];
}

export interface EpochOperationGateResult {
  readonly action: EpochOperationSwitchAction;
  readonly paused: boolean;
  readonly reason: string | null;
  readonly dimensions: EpochOperationGateInput;
  readonly matchedSwitches: readonly EpochOperationSwitch[];
}

export interface EpochOperationSwitchConfig {
  readonly switches: readonly EpochOperationSwitch[];
}

export interface EpochOperationSwitchRegistry {
  readonly gate: (input: EpochOperationGateInput) => EpochOperationGateResult;
  readonly state: () => EpochOperationSwitchConfig;
}

type MutableRecord = Record<string, unknown>;

const OPERATION_ACTIONS: readonly EpochOperationSwitchAction[] = [
  "settlement",
  "public_sharing",
  "source_reward",
];

function isRecord(value: unknown): value is MutableRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function recordValue(value: unknown): MutableRecord {
  return isRecord(value) ? value : {};
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function stringArrayValue(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim());
}

function stringSelector(input: MutableRecord, singular: string, plural: string) {
  const values = stringArrayValue(input[plural]);
  const scalar = stringValue(input[singular]);
  return [...new Set([...(scalar ? [scalar] : []), ...values])];
}

function normalizeAction(value: unknown): EpochOperationSwitchAction | null {
  return typeof value === "string" && OPERATION_ACTIONS.includes(value as EpochOperationSwitchAction)
    ? value as EpochOperationSwitchAction
    : null;
}

function normalizeOperationSwitch(value: unknown): EpochOperationSwitch | null {
  const input = recordValue(value);
  const action = normalizeAction(input.action);
  if (!action) return null;
  return {
    action,
    paused: input.paused !== false,
    reason: stringValue(input.reason, `operation_${action}_paused`),
    rewardType: stringValue(input.rewardType) || undefined,
    commissionType: stringValue(input.commissionType) || undefined,
    chapterId: stringValue(input.chapterId) || undefined,
    locationId: stringValue(input.locationId) || undefined,
    factionId: stringValue(input.factionId) || undefined,
    riskLevel: stringValue(input.riskLevel) || undefined,
    rewardTypes: stringSelector(input, "rewardType", "rewardTypes"),
    commissionTypes: stringSelector(input, "commissionType", "commissionTypes"),
    chapterIds: stringSelector(input, "chapterId", "chapterIds"),
    locationIds: stringSelector(input, "locationId", "locationIds"),
    factionIds: stringSelector(input, "factionId", "factionIds"),
    riskLevels: stringSelector(input, "riskLevel", "riskLevels"),
  };
}

export function normalizeEpochOperationSwitchConfig(value: unknown): EpochOperationSwitchConfig {
  const input = recordValue(value);
  const switches = Array.isArray(input.switches)
    ? input.switches.map(normalizeOperationSwitch).filter((item): item is EpochOperationSwitch => Boolean(item))
    : [];
  return { switches };
}

export function epochOperationSwitchConfigFromEnv(
  env: Readonly<Record<string, string | undefined>> = process.env,
): EpochOperationSwitchConfig {
  const rawConfig = env[EPOCH_OPERATION_SWITCHES_ENV_VAR];
  if (!rawConfig?.trim()) return { switches: [] };
  return normalizeEpochOperationSwitchConfig(JSON.parse(rawConfig));
}

function matchesDimension(selector: readonly string[], value: string | undefined) {
  return selector.length === 0 || (typeof value === "string" && selector.includes(value));
}

function matchesSwitch(operationSwitch: EpochOperationSwitch, input: EpochOperationGateInput) {
  return operationSwitch.action === input.action
    && operationSwitch.paused
    && matchesDimension(operationSwitch.rewardTypes, input.rewardType)
    && matchesDimension(operationSwitch.commissionTypes, input.commissionType)
    && matchesDimension(operationSwitch.chapterIds, input.chapterId)
    && matchesDimension(operationSwitch.locationIds, input.locationId)
    && matchesDimension(operationSwitch.factionIds, input.factionId)
    && matchesDimension(operationSwitch.riskLevels, input.riskLevel);
}

export function createEpochOperationSwitchRegistry(config?: unknown): EpochOperationSwitchRegistry {
  const normalized = typeof config === "undefined"
    ? epochOperationSwitchConfigFromEnv()
    : normalizeEpochOperationSwitchConfig(config);
  const switches = normalized.switches.map((operationSwitch) => ({ ...operationSwitch }));
  return {
    gate: (input) => {
      const matchedSwitches = switches.filter((operationSwitch) => matchesSwitch(operationSwitch, input));
      return {
        action: input.action,
        paused: matchedSwitches.length > 0,
        reason: matchedSwitches[0]?.reason || null,
        dimensions: { ...input },
        matchedSwitches: matchedSwitches.map((operationSwitch) => ({ ...operationSwitch })),
      };
    },
    state: () => ({
      switches: switches.map((operationSwitch) => ({ ...operationSwitch })),
    }),
  };
}
