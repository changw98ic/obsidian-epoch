export const EPOCH_CONTENT_POLICY_CONFIG_ENV_VAR = "AGENT_WORLD_CONTENT_POLICY_JSON" as const;
export const EPOCH_CONTENT_POLICY_REGION_ENV_VAR = "AGENT_WORLD_CONTENT_POLICY_REGION" as const;

export type EpochContentPolicyConfigurationSource =
  | "built_in_default"
  | typeof EPOCH_CONTENT_POLICY_CONFIG_ENV_VAR
  | "inline_config";
export type EpochContentPolicyRegionSource = "configured_region" | "default_region";
export type EpochResultPagePublicSharingPolicy = "allowed" | "review_required" | "disabled";
export type EpochWorldMessagePublicSharingPolicy = "moderation_queue" | "review_required" | "disabled";
export type EpochLegacyReportPublicationPolicy = "personal_sealed" | "claim_only" | "review_required";
export type EpochCustomTtsPublicSharingPolicy = "system_voice_allowed" | "requires_voice_rights_confirmation";
export type EpochModerationQueuePolicy = "moderation_queue" | "review_required" | "disabled";
export type EpochIpSimilarityPolicy = "moderation_hold" | "review_required";
export type EpochDeletedResultBodyPolicy = "hide_body" | "review_required";

export interface EpochContentAgeRatingPolicy {
  readonly label: string;
  readonly minAge: number;
}

export interface EpochPublicSharingPolicy {
  readonly resultPages: EpochResultPagePublicSharingPolicy;
  readonly worldMessages: EpochWorldMessagePublicSharingPolicy;
  readonly legacyReports: EpochLegacyReportPublicationPolicy;
  readonly customTts: EpochCustomTtsPublicSharingPolicy;
}

export interface EpochContentModerationPolicy {
  readonly suspiciousPublicMessages: EpochModerationQueuePolicy;
  readonly realIpSimilarity: EpochIpSimilarityPolicy;
  readonly deletedResultPageBody: EpochDeletedResultBodyPolicy;
}

export interface EpochContentSafetyBoundary {
  readonly allowedFictionalContent: readonly string[];
  readonly disallowedRealWorldContent: readonly string[];
  readonly falsePositiveAppeal: {
    readonly available: boolean;
    readonly route: "operator_moderation_appeal";
    readonly summary: string;
    readonly acceptedSignals: readonly string[];
  };
}

export interface EpochContentPolicyRegionConfig {
  readonly ageRating: EpochContentAgeRatingPolicy;
  readonly contentWarnings: readonly string[];
  readonly publicSharing: EpochPublicSharingPolicy;
  readonly moderation: EpochContentModerationPolicy;
  readonly safetyBoundary: EpochContentSafetyBoundary;
}

export interface EpochContentPolicyConfig {
  readonly defaultRegion: string;
  readonly regions: Readonly<Record<string, EpochContentPolicyRegionConfig>>;
}

export interface EpochLoadedContentPolicyConfig {
  readonly config: EpochContentPolicyConfig;
  readonly configurationSource: EpochContentPolicyConfigurationSource;
}

export interface EpochResolvedContentPolicy extends EpochContentPolicyRegionConfig {
  readonly policyVersion: "epoch_content_policy.v1";
  readonly configurable: true;
  readonly configurationSource: EpochContentPolicyConfigurationSource;
  readonly requestedRegion: string;
  readonly regionCode: string;
  readonly defaultRegion: string;
  readonly source: EpochContentPolicyRegionSource;
}

type MutableRecord = Record<string, unknown>;

const DEFAULT_REGION = "global";

const defaultRegionPolicy: EpochContentPolicyRegionConfig = {
  ageRating: {
    label: "teen",
    minAge: 13,
  },
  contentWarnings: [
    "fictional_dark_fantasy",
    "user_generated_content",
  ],
  publicSharing: {
    resultPages: "allowed",
    worldMessages: "moderation_queue",
    legacyReports: "personal_sealed",
    customTts: "requires_voice_rights_confirmation",
  },
  moderation: {
    suspiciousPublicMessages: "moderation_queue",
    realIpSimilarity: "moderation_hold",
    deletedResultPageBody: "hide_body",
  },
  safetyBoundary: {
    allowedFictionalContent: [
      "fictional_dark_fantasy",
      "biomorphic_body_horror",
      "non_graphic_monstrous_transformation",
      "world_lore_violence_without_real_instructions",
    ],
    disallowedRealWorldContent: [
      "real_world_harm_instructions",
      "explicit_sexual_content",
      "hate_or_harassment",
      "illegal_activity_instructions",
    ],
    falsePositiveAppeal: {
      available: true,
      route: "operator_moderation_appeal",
      summary: "Fictional dark-fantasy or body-horror worldbuilding can be appealed when it is non-instructional and has no real-person target.",
      acceptedSignals: ["fictional_context", "non_instructional", "no_real_person_target"],
    },
  },
};

function isRecord(value: unknown): value is MutableRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function recordValue(value: unknown): MutableRecord {
  return isRecord(value) ? value : {};
}

function stringValue(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function nonNegativeIntegerValue(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : fallback;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && allowed.includes(value as T) ? value as T : fallback;
}

function stringArrayValue(value: unknown, fallback: readonly string[]) {
  if (!Array.isArray(value)) return [...fallback];
  const strings = value
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim());
  return strings.length > 0 ? strings : [...fallback];
}

function parseAgeRating(value: unknown, fallback: EpochContentAgeRatingPolicy): EpochContentAgeRatingPolicy {
  const input = recordValue(value);
  return {
    label: stringValue(input.label, fallback.label),
    minAge: nonNegativeIntegerValue(input.minAge, fallback.minAge),
  };
}

function parsePublicSharing(value: unknown, fallback: EpochPublicSharingPolicy): EpochPublicSharingPolicy {
  const input = recordValue(value);
  return {
    resultPages: oneOf(input.resultPages, ["allowed", "review_required", "disabled"], fallback.resultPages),
    worldMessages: oneOf(input.worldMessages, ["moderation_queue", "review_required", "disabled"], fallback.worldMessages),
    legacyReports: oneOf(input.legacyReports, ["personal_sealed", "claim_only", "review_required"], fallback.legacyReports),
    customTts: oneOf(
      input.customTts,
      ["system_voice_allowed", "requires_voice_rights_confirmation"],
      fallback.customTts,
    ),
  };
}

function parseModeration(value: unknown, fallback: EpochContentModerationPolicy): EpochContentModerationPolicy {
  const input = recordValue(value);
  return {
    suspiciousPublicMessages: oneOf(
      input.suspiciousPublicMessages,
      ["moderation_queue", "review_required", "disabled"],
      fallback.suspiciousPublicMessages,
    ),
    realIpSimilarity: oneOf(input.realIpSimilarity, ["moderation_hold", "review_required"], fallback.realIpSimilarity),
    deletedResultPageBody: oneOf(input.deletedResultPageBody, ["hide_body", "review_required"], fallback.deletedResultPageBody),
  };
}

function parseSafetyBoundary(value: unknown, fallback: EpochContentSafetyBoundary): EpochContentSafetyBoundary {
  const input = recordValue(value);
  const appeal = recordValue(input.falsePositiveAppeal);
  return {
    allowedFictionalContent: stringArrayValue(input.allowedFictionalContent, fallback.allowedFictionalContent),
    disallowedRealWorldContent: stringArrayValue(input.disallowedRealWorldContent, fallback.disallowedRealWorldContent),
    falsePositiveAppeal: {
      available: input.falsePositiveAppeal === undefined
        ? fallback.falsePositiveAppeal.available
        : appeal.available !== false,
      route: "operator_moderation_appeal",
      summary: stringValue(appeal.summary, fallback.falsePositiveAppeal.summary),
      acceptedSignals: stringArrayValue(appeal.acceptedSignals, fallback.falsePositiveAppeal.acceptedSignals),
    },
  };
}

function mergeRegionPolicy(value: unknown, fallback: EpochContentPolicyRegionConfig): EpochContentPolicyRegionConfig {
  const input = recordValue(value);
  return {
    ageRating: parseAgeRating(input.ageRating, fallback.ageRating),
    contentWarnings: stringArrayValue(input.contentWarnings, fallback.contentWarnings),
    publicSharing: parsePublicSharing(input.publicSharing, fallback.publicSharing),
    moderation: parseModeration(input.moderation, fallback.moderation),
    safetyBoundary: parseSafetyBoundary(input.safetyBoundary, fallback.safetyBoundary),
  };
}

export function defaultEpochContentPolicyConfig(): EpochContentPolicyConfig {
  return {
    defaultRegion: DEFAULT_REGION,
    regions: {
      [DEFAULT_REGION]: {
        ageRating: { ...defaultRegionPolicy.ageRating },
        contentWarnings: [...defaultRegionPolicy.contentWarnings],
        publicSharing: { ...defaultRegionPolicy.publicSharing },
        moderation: { ...defaultRegionPolicy.moderation },
        safetyBoundary: {
          allowedFictionalContent: [...defaultRegionPolicy.safetyBoundary.allowedFictionalContent],
          disallowedRealWorldContent: [...defaultRegionPolicy.safetyBoundary.disallowedRealWorldContent],
          falsePositiveAppeal: {
            ...defaultRegionPolicy.safetyBoundary.falsePositiveAppeal,
            acceptedSignals: [...defaultRegionPolicy.safetyBoundary.falsePositiveAppeal.acceptedSignals],
          },
        },
      },
    },
  };
}

export function normalizeEpochContentPolicyConfig(value: unknown): EpochContentPolicyConfig {
  const defaults = defaultEpochContentPolicyConfig();
  const input = recordValue(value);
  const requestedDefaultRegion = stringValue(input.defaultRegion, defaults.defaultRegion);
  const regionInputs = recordValue(input.regions);
  const regions: Record<string, EpochContentPolicyRegionConfig> = {
    [DEFAULT_REGION]: mergeRegionPolicy(regionInputs[DEFAULT_REGION], defaultRegionPolicy),
  };
  for (const [regionCode, regionInput] of Object.entries(regionInputs)) {
    if (!regionCode.trim()) continue;
    regions[regionCode.trim()] = mergeRegionPolicy(regionInput, regions[DEFAULT_REGION]);
  }
  if (!regions[requestedDefaultRegion]) {
    regions[requestedDefaultRegion] = { ...regions[DEFAULT_REGION] };
  }
  return {
    defaultRegion: requestedDefaultRegion,
    regions,
  };
}

export function epochContentPolicyConfigFromEnv(
  env: Readonly<Record<string, string | undefined>> = process.env,
): EpochLoadedContentPolicyConfig {
  const rawConfig = env[EPOCH_CONTENT_POLICY_CONFIG_ENV_VAR];
  if (!rawConfig?.trim()) {
    return {
      config: defaultEpochContentPolicyConfig(),
      configurationSource: "built_in_default",
    };
  }
  return {
    config: normalizeEpochContentPolicyConfig(JSON.parse(rawConfig)),
    configurationSource: EPOCH_CONTENT_POLICY_CONFIG_ENV_VAR,
  };
}

export function resolveEpochContentPolicy({
  config,
  env = process.env,
  requestedRegion,
}: {
  readonly config?: unknown;
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly requestedRegion?: unknown;
} = {}): EpochResolvedContentPolicy {
  const loaded = typeof config === "undefined"
    ? epochContentPolicyConfigFromEnv(env)
    : {
        config: normalizeEpochContentPolicyConfig(config),
        configurationSource: "inline_config" as const,
      };
  const requested = stringValue(requestedRegion, stringValue(env[EPOCH_CONTENT_POLICY_REGION_ENV_VAR], loaded.config.defaultRegion));
  const configuredPolicy = loaded.config.regions[requested];
  const fallbackPolicy = loaded.config.regions[loaded.config.defaultRegion]
    || loaded.config.regions[DEFAULT_REGION]
    || defaultRegionPolicy;
  const source: EpochContentPolicyRegionSource = configuredPolicy ? "configured_region" : "default_region";
  const regionCode = configuredPolicy ? requested : loaded.config.defaultRegion;
  const policy = configuredPolicy || fallbackPolicy;
  return {
    policyVersion: "epoch_content_policy.v1",
    configurable: true,
    configurationSource: loaded.configurationSource,
    requestedRegion: requested,
    regionCode,
    defaultRegion: loaded.config.defaultRegion,
    source,
    ageRating: { ...policy.ageRating },
    contentWarnings: [...policy.contentWarnings],
    publicSharing: { ...policy.publicSharing },
    moderation: { ...policy.moderation },
    safetyBoundary: {
      allowedFictionalContent: [...policy.safetyBoundary.allowedFictionalContent],
      disallowedRealWorldContent: [...policy.safetyBoundary.disallowedRealWorldContent],
      falsePositiveAppeal: {
        ...policy.safetyBoundary.falsePositiveAppeal,
        acceptedSignals: [...policy.safetyBoundary.falsePositiveAppeal.acceptedSignals],
      },
    },
  };
}
