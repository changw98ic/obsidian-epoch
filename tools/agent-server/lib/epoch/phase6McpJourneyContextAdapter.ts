import type { EpochEvent } from "./events.ts";
import type {
  JourneyRunRagGrounding,
  JourneyRunScore,
  JourneyRunStructuredDelta,
  JourneyRunSuitability,
} from "./journeyRunReceiptRules.ts";
import type {
  Phase6EconomyResourceFlow,
  Phase6EconomySnapshot,
} from "./phase6EconomyAuditRules.ts";
import type {
  Phase6PanelSnapshotAdapterInput,
  Phase6PanelSnapshotEconomyProjection,
  Phase6PanelSnapshotPlayerProjection,
} from "./phase6PanelSnapshotAdapter.ts";
import type { Phase6ProjectionForDelta } from "./phase6ProjectionDeltaRules.ts";
import type {
  Phase6JourneySettlementAuthoritativeInputs,
  Phase6JourneySettlementMetadata,
} from "./phase6JourneySettlementAdapter.ts";

type UnknownRecord = Readonly<Record<string, unknown>>;

export const PHASE6_MCP_JOURNEY_CONTEXT_ADAPTER_VERSION =
  "obsidian-epoch-phase6-mcp-journey-context-adapter-v0.1.0" as const;

export type Phase6McpJourneyContextAdapterErrorCode =
  | "PHASE6_MCP_JOURNEY_CONTEXT_FIELD_REQUIRED"
  | "PHASE6_MCP_JOURNEY_CONTEXT_ARRAY_REQUIRED"
  | "PHASE6_MCP_JOURNEY_CONTEXT_SECRET_FORBIDDEN";

export interface Phase6McpJourneyContextAdapterError {
  readonly code: Phase6McpJourneyContextAdapterErrorCode;
  readonly path: string;
  readonly message: string;
}

export type Phase6McpJourneyContextAdapterResult<T> =
  | {
    readonly ok: true;
    readonly adapterVersion: typeof PHASE6_MCP_JOURNEY_CONTEXT_ADAPTER_VERSION;
    readonly value: T;
    readonly errors: readonly [];
  }
  | {
    readonly ok: false;
    readonly adapterVersion: typeof PHASE6_MCP_JOURNEY_CONTEXT_ADAPTER_VERSION;
    readonly errors: readonly Phase6McpJourneyContextAdapterError[];
  };

export interface Phase6McpJourneyStartContextInput {
  readonly player: Phase6PanelSnapshotPlayerProjection;
  readonly progress: Phase6PanelSnapshotAdapterInput["progress"];
  readonly economy: Phase6PanelSnapshotEconomyProjection & {
    readonly snapshot: Phase6EconomySnapshot;
  };
  readonly ragPanel: Phase6PanelSnapshotAdapterInput["ragPanel"];
  readonly worldCursor: Phase6PanelSnapshotAdapterInput["worldCursor"];
  readonly experiment: {
    readonly experimentId: string;
    readonly runIndex: number;
    readonly seed: string;
  };
  readonly version: {
    readonly rulesetVersion: string;
    readonly catalogVersion: string;
    readonly codeVersion: string;
    readonly scenarioMatrixVersion: string;
  };
}

export interface Phase6McpJourneyStoredStartContext {
  readonly adapterVersion: typeof PHASE6_MCP_JOURNEY_CONTEXT_ADAPTER_VERSION;
  readonly beforePanel: Phase6PanelSnapshotAdapterInput;
  readonly beforeProjection: Phase6ProjectionForDelta;
  readonly economyBefore: Phase6EconomySnapshot;
  readonly experiment: Phase6McpJourneyStartContextInput["experiment"];
  readonly version: Phase6McpJourneyStartContextInput["version"];
}

export interface Phase6McpJourneyCompletionContextInput {
  readonly metadata: Omit<
    Phase6JourneySettlementMetadata,
    "experimentId" | "runIndex" | "seed" | "rulesetVersion" | "catalogVersion" | "codeVersion" | "scenarioMatrixVersion"
  >;
  readonly afterPanel: Phase6PanelSnapshotAdapterInput;
  readonly afterProjection: Phase6ProjectionForDelta;
  readonly canonicalEvents: readonly EpochEvent[];
  readonly economy: {
    readonly next: Phase6EconomySnapshot;
    readonly flows?: readonly Phase6EconomyResourceFlow[];
    readonly sourceEvents?: readonly unknown[];
  };
  readonly receipt: {
    readonly deltas: readonly JourneyRunStructuredDelta[];
    readonly score: JourneyRunScore;
    readonly suitability: JourneyRunSuitability;
    readonly rag: JourneyRunRagGrounding;
    readonly eventIds: Phase6JourneySettlementAuthoritativeInputs["receipt"]["eventIds"];
    readonly snapshots: Phase6JourneySettlementAuthoritativeInputs["receipt"]["snapshots"];
    readonly outcome: Phase6JourneySettlementAuthoritativeInputs["receipt"]["outcome"];
  };
  readonly resultPage: UnknownRecord;
  readonly now?: string;
  readonly journeyRuntime?: Phase6JourneySettlementAuthoritativeInputs["journeyRuntime"];
  readonly actionResolutions?: Phase6JourneySettlementAuthoritativeInputs["actionResolutions"];
  readonly storyReport?: Phase6JourneySettlementAuthoritativeInputs["storyReport"];
}

function failure<T>(errors: readonly Phase6McpJourneyContextAdapterError[]): Phase6McpJourneyContextAdapterResult<T> {
  return {
    ok: false,
    adapterVersion: PHASE6_MCP_JOURNEY_CONTEXT_ADAPTER_VERSION,
    errors,
  };
}

function success<T>(value: T): Phase6McpJourneyContextAdapterResult<T> {
  return {
    ok: true,
    adapterVersion: PHASE6_MCP_JOURNEY_CONTEXT_ADAPTER_VERSION,
    value,
    errors: [],
  };
}

function error(
  code: Phase6McpJourneyContextAdapterErrorCode,
  path: string,
  message: string,
): Phase6McpJourneyContextAdapterError {
  return { code, path, message };
}

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function requireRecord(
  value: unknown,
  path: string,
  errors: Phase6McpJourneyContextAdapterError[],
): void {
  if (isRecord(value)) return;
  errors.push(error(
    "PHASE6_MCP_JOURNEY_CONTEXT_FIELD_REQUIRED",
    path,
    `${path} must be supplied from an authoritative public MCP context source`,
  ));
}

function requireText(
  value: unknown,
  path: string,
  errors: Phase6McpJourneyContextAdapterError[],
): void {
  if (typeof value === "string" && value.trim().length > 0) return;
  errors.push(error(
    "PHASE6_MCP_JOURNEY_CONTEXT_FIELD_REQUIRED",
    path,
    `${path} must be a non-empty authoritative string`,
  ));
}

function requireInteger(
  value: unknown,
  path: string,
  errors: Phase6McpJourneyContextAdapterError[],
): void {
  if (Number.isInteger(value)) return;
  errors.push(error(
    "PHASE6_MCP_JOURNEY_CONTEXT_FIELD_REQUIRED",
    path,
    `${path} must be an authoritative integer`,
  ));
}

function requireArray(
  value: unknown,
  path: string,
  errors: Phase6McpJourneyContextAdapterError[],
): void {
  if (Array.isArray(value)) return;
  errors.push(error(
    "PHASE6_MCP_JOURNEY_CONTEXT_ARRAY_REQUIRED",
    path,
    `${path} must be an authoritative array`,
  ));
}

function detectForbiddenSecret(value: unknown, path: string, errors: Phase6McpJourneyContextAdapterError[]): void {
  if (!isRecord(value)) return;
  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    const normalizedKey = key.toLowerCase();
    if (
      normalizedKey.includes("secret")
      || normalizedKey.includes("recoverycode")
      || normalizedKey === "token"
      || normalizedKey.endsWith("token")
      || normalizedKey === "password"
    ) {
      errors.push(error(
        "PHASE6_MCP_JOURNEY_CONTEXT_SECRET_FORBIDDEN",
        childPath,
        `${childPath} must not be included in Phase 6 MCP journey context`,
      ));
      continue;
    }
    if (isRecord(child)) detectForbiddenSecret(child, childPath, errors);
    if (Array.isArray(child)) {
      child.forEach((entry, index) => detectForbiddenSecret(entry, `${childPath}[${index}]`, errors));
    }
  }
}

function publicProjectionFromPanel(input: Phase6PanelSnapshotAdapterInput): Phase6ProjectionForDelta {
  return {
    phase: input.phase,
    player: input.player,
    progress: input.progress,
    economy: input.economy,
    ragPanel: input.ragPanel,
    worldCursor: input.worldCursor,
  } as Phase6ProjectionForDelta;
}

export function capturePhase6JourneyStartContext(
  input: Phase6McpJourneyStartContextInput,
): Phase6McpJourneyContextAdapterResult<Phase6McpJourneyStoredStartContext> {
  const errors: Phase6McpJourneyContextAdapterError[] = [];
  detectForbiddenSecret(input, "$", errors);
  requireRecord(input.player, "$.player", errors);
  requireRecord(input.progress, "$.progress", errors);
  requireRecord(input.economy, "$.economy", errors);
  requireRecord(input.economy?.snapshot, "$.economy.snapshot", errors);
  requireRecord(input.ragPanel, "$.ragPanel", errors);
  requireRecord(input.worldCursor, "$.worldCursor", errors);
  requireRecord(input.experiment, "$.experiment", errors);
  requireText(input.experiment?.experimentId, "$.experiment.experimentId", errors);
  requireInteger(input.experiment?.runIndex, "$.experiment.runIndex", errors);
  requireText(input.experiment?.seed, "$.experiment.seed", errors);
  requireRecord(input.version, "$.version", errors);
  requireText(input.version?.rulesetVersion, "$.version.rulesetVersion", errors);
  requireText(input.version?.catalogVersion, "$.version.catalogVersion", errors);
  requireText(input.version?.codeVersion, "$.version.codeVersion", errors);
  requireText(input.version?.scenarioMatrixVersion, "$.version.scenarioMatrixVersion", errors);
  if (errors.length > 0) return failure(errors);

  const beforePanel: Phase6PanelSnapshotAdapterInput = {
    phase: "before",
    player: input.player,
    progress: input.progress,
    economy: input.economy,
    ragPanel: input.ragPanel,
    worldCursor: input.worldCursor,
  };

  return success({
    adapterVersion: PHASE6_MCP_JOURNEY_CONTEXT_ADAPTER_VERSION,
    beforePanel,
    beforeProjection: publicProjectionFromPanel(beforePanel),
    economyBefore: input.economy.snapshot,
    experiment: input.experiment,
    version: input.version,
  });
}

export function finalizePhase6JourneyContext(
  storedBefore: Phase6McpJourneyStoredStartContext,
  authoritativeCompletion: Phase6McpJourneyCompletionContextInput,
): Phase6McpJourneyContextAdapterResult<Phase6JourneySettlementAuthoritativeInputs> {
  const errors: Phase6McpJourneyContextAdapterError[] = [];
  detectForbiddenSecret(storedBefore, "$.storedBefore", errors);
  detectForbiddenSecret(authoritativeCompletion, "$.authoritativeCompletion", errors);
  requireRecord(storedBefore, "$.storedBefore", errors);
  requireRecord(storedBefore?.beforePanel, "$.storedBefore.beforePanel", errors);
  requireRecord(storedBefore?.beforeProjection, "$.storedBefore.beforeProjection", errors);
  requireRecord(storedBefore?.economyBefore, "$.storedBefore.economyBefore", errors);
  requireRecord(storedBefore?.experiment, "$.storedBefore.experiment", errors);
  requireRecord(storedBefore?.version, "$.storedBefore.version", errors);
  requireRecord(authoritativeCompletion, "$.authoritativeCompletion", errors);
  requireRecord(authoritativeCompletion?.metadata, "$.authoritativeCompletion.metadata", errors);
  requireRecord(authoritativeCompletion?.afterPanel, "$.authoritativeCompletion.afterPanel", errors);
  requireRecord(authoritativeCompletion?.afterProjection, "$.authoritativeCompletion.afterProjection", errors);
  requireArray(authoritativeCompletion?.canonicalEvents, "$.authoritativeCompletion.canonicalEvents", errors);
  requireRecord(authoritativeCompletion?.economy, "$.authoritativeCompletion.economy", errors);
  requireRecord(authoritativeCompletion?.economy?.next, "$.authoritativeCompletion.economy.next", errors);
  if (
    authoritativeCompletion?.economy?.flows === undefined
    && authoritativeCompletion?.economy?.sourceEvents === undefined
  ) {
    errors.push(error(
      "PHASE6_MCP_JOURNEY_CONTEXT_FIELD_REQUIRED",
      "$.authoritativeCompletion.economy.flows",
      "$.authoritativeCompletion.economy must include authoritative flows or sourceEvents",
    ));
  }
  if (authoritativeCompletion?.economy?.flows !== undefined) {
    requireArray(authoritativeCompletion.economy.flows, "$.authoritativeCompletion.economy.flows", errors);
  }
  if (authoritativeCompletion?.economy?.sourceEvents !== undefined) {
    requireArray(authoritativeCompletion.economy.sourceEvents, "$.authoritativeCompletion.economy.sourceEvents", errors);
  }
  requireRecord(authoritativeCompletion?.receipt, "$.authoritativeCompletion.receipt", errors);
  requireArray(authoritativeCompletion?.receipt?.deltas, "$.authoritativeCompletion.receipt.deltas", errors);
  requireRecord(authoritativeCompletion?.receipt?.score, "$.authoritativeCompletion.receipt.score", errors);
  requireRecord(authoritativeCompletion?.receipt?.suitability, "$.authoritativeCompletion.receipt.suitability", errors);
  requireRecord(authoritativeCompletion?.receipt?.rag, "$.authoritativeCompletion.receipt.rag", errors);
  requireRecord(authoritativeCompletion?.receipt?.eventIds, "$.authoritativeCompletion.receipt.eventIds", errors);
  requireRecord(authoritativeCompletion?.receipt?.snapshots, "$.authoritativeCompletion.receipt.snapshots", errors);
  if (authoritativeCompletion?.receipt?.outcome === undefined) {
    errors.push(error(
      "PHASE6_MCP_JOURNEY_CONTEXT_FIELD_REQUIRED",
      "$.authoritativeCompletion.receipt.outcome",
      "$.authoritativeCompletion.receipt.outcome must be supplied by authoritative completion",
    ));
  }
  requireRecord(authoritativeCompletion?.resultPage, "$.authoritativeCompletion.resultPage", errors);
  if (errors.length > 0) return failure(errors);

  return success({
    metadata: {
      ...authoritativeCompletion.metadata,
      experimentId: storedBefore.experiment.experimentId,
      runIndex: storedBefore.experiment.runIndex,
      seed: storedBefore.experiment.seed,
      rulesetVersion: storedBefore.version.rulesetVersion,
      catalogVersion: storedBefore.version.catalogVersion,
      codeVersion: storedBefore.version.codeVersion,
      scenarioMatrixVersion: storedBefore.version.scenarioMatrixVersion,
    },
    beforePanel: storedBefore.beforePanel,
    afterPanel: {
      ...authoritativeCompletion.afterPanel,
      phase: "after",
    },
    canonicalEvents: authoritativeCompletion.canonicalEvents,
    economy: {
      previous: storedBefore.economyBefore,
      next: authoritativeCompletion.economy.next,
      ...(authoritativeCompletion.economy.flows !== undefined
        ? { flows: authoritativeCompletion.economy.flows }
        : {}),
      ...(authoritativeCompletion.economy.sourceEvents !== undefined
        ? { sourceEvents: authoritativeCompletion.economy.sourceEvents }
        : {}),
    },
    projections: {
      before: storedBefore.beforeProjection,
      after: authoritativeCompletion.afterProjection,
      ...(authoritativeCompletion.now !== undefined ? { now: authoritativeCompletion.now } : {}),
    },
    receipt: authoritativeCompletion.receipt,
    resultPage: authoritativeCompletion.resultPage,
    ...(authoritativeCompletion.journeyRuntime !== undefined
      ? { journeyRuntime: authoritativeCompletion.journeyRuntime }
      : {}),
    ...(authoritativeCompletion.actionResolutions !== undefined
      ? { actionResolutions: authoritativeCompletion.actionResolutions }
      : {}),
    ...(authoritativeCompletion.storyReport !== undefined ? { storyReport: authoritativeCompletion.storyReport } : {}),
  } as unknown as Phase6JourneySettlementAuthoritativeInputs);
}
