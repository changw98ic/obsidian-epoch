export const EPOCH_FRONTSTAGE_STATUS_ENV_VAR = "AGENT_WORLD_FRONTSTAGE_STATUS_JSON" as const;

export type EpochFrontstageStatusMode = "normal" | "read_only_maintenance";
export type EpochFrontstageStatusSource = "built_in_default" | typeof EPOCH_FRONTSTAGE_STATUS_ENV_VAR;

export interface EpochFrontstageWorldAnnouncement {
  readonly visible: boolean;
  readonly title: string;
  readonly body: string;
}

export interface EpochFrontstageAllowedActions {
  readonly localTrial: true;
  readonly archiveLocalReport: true;
  readonly readPublicWorld: true;
}

export interface EpochFrontstageStatus {
  readonly mode: EpochFrontstageStatusMode;
  readonly configurationSource: EpochFrontstageStatusSource;
  readonly circuitBreakerActive: boolean;
  readonly worldAnnouncement: EpochFrontstageWorldAnnouncement;
  readonly allowedActions: EpochFrontstageAllowedActions;
  readonly blockedActions: readonly string[];
}

type MutableRecord = Record<string, unknown>;

const READ_ONLY_TITLE = "档案馆审档暂停/只读维护";
const READ_ONLY_BODY = "共享设定暂时只读；本地试玩和本地封存仍可用，数据没有丢失。";

function isRecord(value: unknown): value is MutableRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function recordValue(value: unknown): MutableRecord {
  return isRecord(value) ? value : {};
}

function stringValue(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function statusMode(value: unknown): EpochFrontstageStatusMode {
  return value === "read_only_maintenance" ? "read_only_maintenance" : "normal";
}

function requiredReadOnlyBody(body: string) {
  const missing: string[] = [];
  if (!/本地试玩|local trial/i.test(body)) missing.push("本地试玩仍可用。");
  if (!/本地封存|封存|archive/i.test(body)) missing.push("本地封存仍可用。");
  if (!/数据没有丢失|not lost/i.test(body)) missing.push("数据没有丢失。");
  return missing.length ? `${body} ${missing.join(" ")}`.trim() : body;
}

function frontstageAllowedActions(): EpochFrontstageAllowedActions {
  return {
    localTrial: true,
    archiveLocalReport: true,
    readPublicWorld: true,
  };
}

export function normalizeEpochFrontstageStatus(
  value: unknown,
  configurationSource: EpochFrontstageStatusSource = "built_in_default",
): EpochFrontstageStatus {
  const input = recordValue(value);
  const mode = statusMode(input.mode);
  const announcement = recordValue(input.worldAnnouncement);
  if (mode === "read_only_maintenance") {
    return {
      mode,
      configurationSource,
      circuitBreakerActive: true,
      worldAnnouncement: {
        visible: true,
        title: stringValue(announcement.title, READ_ONLY_TITLE),
        body: requiredReadOnlyBody(stringValue(announcement.body, READ_ONLY_BODY)),
      },
      allowedActions: frontstageAllowedActions(),
      blockedActions: [
        "shared_setting_writes",
        "canonical_settlement",
        "public_sharing_writes",
      ],
    };
  }
  return {
    mode: "normal",
    configurationSource,
    circuitBreakerActive: false,
    worldAnnouncement: {
      visible: false,
      title: "世界运行正常",
      body: "世界运行正常；本地试玩和本地封存仍可用，数据没有丢失。",
    },
    allowedActions: frontstageAllowedActions(),
    blockedActions: [],
  };
}

export function resolveEpochFrontstageStatus(
  env: Readonly<Record<string, string | undefined>> = process.env,
): EpochFrontstageStatus {
  const rawConfig = env[EPOCH_FRONTSTAGE_STATUS_ENV_VAR];
  if (!rawConfig?.trim()) return normalizeEpochFrontstageStatus(undefined);
  return normalizeEpochFrontstageStatus(JSON.parse(rawConfig), EPOCH_FRONTSTAGE_STATUS_ENV_VAR);
}
