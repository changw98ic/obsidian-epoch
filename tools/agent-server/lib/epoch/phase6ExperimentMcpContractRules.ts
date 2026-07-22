import {
  PHASE6_RUN_INDEXES,
  type Phase6ExperimentState,
  type Phase6IdentityBinding,
  type Phase6RunIndex,
  type Phase6RunReceiptRef,
  type Phase6ScenarioMatrixVersion,
  type Phase6SeedBinding,
  type Phase6VersionBinding,
} from "./phase6ExperimentRules.ts";

export const PHASE6_EXPERIMENT_MCP_CONTRACT_RULESET_VERSION =
  "obsidian-epoch-phase6-experiment-mcp-contract-v0.2.0" as const;

export const PHASE6_EXPERIMENT_MCP_TOOL_BEGIN_EXPERIMENT =
  "obsidian_epoch.begin_phase6_experiment" as const;
export const PHASE6_EXPERIMENT_MCP_TOOL_BEGIN_RUN =
  "obsidian_epoch.begin_phase6_run" as const;
export const PHASE6_EXPERIMENT_MCP_TOOL_STATUS =
  "obsidian_epoch.phase6_experiment_status" as const;

export const PHASE6_EXPERIMENT_MCP_TOOL_NAMES = [
  PHASE6_EXPERIMENT_MCP_TOOL_BEGIN_EXPERIMENT,
  PHASE6_EXPERIMENT_MCP_TOOL_BEGIN_RUN,
  PHASE6_EXPERIMENT_MCP_TOOL_STATUS,
] as const;

export type Phase6ExperimentMcpToolName =
  typeof PHASE6_EXPERIMENT_MCP_TOOL_NAMES[number];

export type Phase6ExperimentMcpErrorCode =
  | "invalid_input"
  | "forbidden_client_override"
  | "not_found"
  | "conflict";

export interface Phase6ExperimentMcpError {
  readonly code: Phase6ExperimentMcpErrorCode;
  readonly message: string;
  readonly path?: string;
}

export interface Phase6ExplorerBinding {
  readonly explorerId: string;
  readonly displayName?: string;
}

export interface Phase6ExperimentServerContext {
  readonly scenarioMatrix: Phase6ScenarioMatrixVersion;
  readonly versions: Phase6VersionBinding;
}

export interface Phase6BeginExperimentInput {
  readonly commandId: string;
  readonly identity: Phase6IdentityBinding;
  readonly explorer: Phase6ExplorerBinding;
}

export interface Phase6BeginExperimentOutput {
  readonly experimentId: string;
  readonly state: Extract<Phase6ExperimentState, "planned">;
  readonly identity: Phase6IdentityBinding;
  readonly explorer: Phase6ExplorerBinding;
  readonly scenarioMatrix: Phase6ScenarioMatrixVersion;
  readonly versions: Phase6VersionBinding;
}

export interface Phase6BeginRunInput {
  readonly commandId: string;
  readonly experimentId: string;
  readonly runIndex: Phase6RunIndex;
  readonly scenarioTag: string;
  readonly journeyId: string;
}

export interface Phase6BeginRunOutput {
  readonly experimentId: string;
  readonly runIndex: Phase6RunIndex;
  readonly scenarioTag: string;
  readonly state: Extract<Phase6ExperimentState, "running">;
  readonly identity: Phase6IdentityBinding;
  readonly explorer: Phase6ExplorerBinding;
  readonly scenarioMatrix: Phase6ScenarioMatrixVersion;
  readonly versions: Phase6VersionBinding;
  readonly seed: Phase6SeedBinding;
  readonly runReceipt: Phase6RunReceiptRef;
  readonly journeyId: string;
  readonly runId: string;
  readonly expectedVersion: number;
  readonly startJourneyBinding: Readonly<Record<string, unknown>>;
}

export interface Phase6ExperimentStatusInput {
  readonly experimentId: string;
}

export interface Phase6RunStatusView {
  readonly runIndex: Phase6RunIndex;
  readonly scenarioTag?: string;
  readonly state: Phase6ExperimentState;
  readonly receipt?: Phase6RunReceiptRef;
}

export interface Phase6ExperimentStatusOutput {
  readonly experimentId: string;
  readonly state: Phase6ExperimentState;
  readonly identity: Phase6IdentityBinding;
  readonly explorer: Phase6ExplorerBinding;
  readonly scenarioMatrix: Phase6ScenarioMatrixVersion;
  readonly versions: Phase6VersionBinding;
  readonly runs: readonly Phase6RunStatusView[];
}

export type Phase6ExperimentMcpToolInput =
  | Phase6BeginExperimentInput
  | Phase6BeginRunInput
  | Phase6ExperimentStatusInput;

export type Phase6ExperimentMcpToolOutput =
  | Phase6BeginExperimentOutput
  | Phase6BeginRunOutput
  | Phase6ExperimentStatusOutput;

export type Phase6ExperimentMcpValidationResult<T> =
  | {
    readonly ok: true;
    readonly value: T;
  }
  | {
    readonly ok: false;
    readonly error: Phase6ExperimentMcpError;
  };

export interface Phase6ExperimentMcpToolSchemaLike {
  readonly name: Phase6ExperimentMcpToolName;
  readonly description: string;
  readonly inputSchema: Readonly<Record<string, unknown>>;
  readonly outputSchema: Readonly<Record<string, unknown>>;
  readonly errorCodes: readonly Phase6ExperimentMcpErrorCode[];
  readonly readonly: false | true;
}

const ERROR_CODES = [
  "invalid_input",
  "forbidden_client_override",
  "not_found",
  "conflict",
] as const satisfies readonly Phase6ExperimentMcpErrorCode[];

const FORBIDDEN_CLIENT_OVERRIDE_FIELDS = [
  "receipt",
  "runReceipt",
  "resultReceipt",
  "experimentId",
  "status",
  "state",
  "version",
  "versions",
  "rulesVersion",
  "catalogVersion",
  "codeVersion",
  "scenarioMatrix",
  "scenarioMatrixVersion",
  "seed",
  "seedBinding",
] as const;

export const PHASE6_EXPERIMENT_MCP_TOOL_SCHEMAS = [
  {
    name: PHASE6_EXPERIMENT_MCP_TOOL_BEGIN_EXPERIMENT,
    description: "Begin a Phase 6 experiment from client identity and explorer bindings; server binds catalog, rules, and code versions.",
    readonly: false,
    errorCodes: ERROR_CODES,
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["commandId", "identity", "explorer"],
      forbiddenProperties: FORBIDDEN_CLIENT_OVERRIDE_FIELDS,
      properties: {
        commandId: { type: "string", minLength: 1 },
        identity: {
          type: "object",
          additionalProperties: false,
          required: ["identityId"],
          properties: {
            identityId: { type: "string", minLength: 1 },
            cohortId: { type: "string", minLength: 1 },
          },
        },
        explorer: {
          type: "object",
          additionalProperties: false,
          required: ["explorerId"],
          properties: {
            explorerId: { type: "string", minLength: 1 },
            displayName: { type: "string", minLength: 1 },
          },
        },
      },
    },
    outputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["experimentId", "state", "identity", "explorer", "scenarioMatrix", "versions"],
      properties: {
        experimentId: { type: "string", minLength: 1 },
        state: { const: "planned" },
        identity: { $ref: "Phase6IdentityBinding" },
        explorer: { $ref: "Phase6ExplorerBinding" },
        scenarioMatrix: { $ref: "Phase6ScenarioMatrixVersion" },
        versions: { $ref: "Phase6VersionBinding" },
      },
    },
  },
  {
    name: PHASE6_EXPERIMENT_MCP_TOOL_BEGIN_RUN,
    description: "Begin a Phase 6 run for a server-bound experiment; server returns seed and run receipt binding.",
    readonly: false,
    errorCodes: ERROR_CODES,
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["commandId", "experimentId", "runIndex", "scenarioTag", "journeyId"],
      forbiddenProperties: FORBIDDEN_CLIENT_OVERRIDE_FIELDS.filter((field) => field !== "experimentId"),
      properties: {
        commandId: { type: "string", minLength: 1 },
        experimentId: { type: "string", minLength: 1 },
        runIndex: { type: "integer", enum: PHASE6_RUN_INDEXES },
        scenarioTag: { type: "string", minLength: 1 },
        journeyId: { type: "string", minLength: 1 },
      },
    },
    outputSchema: {
      type: "object",
      additionalProperties: false,
      required: [
        "experimentId",
        "runIndex",
        "scenarioTag",
        "state",
        "identity",
        "explorer",
        "scenarioMatrix",
        "versions",
        "seed",
        "runReceipt",
        "journeyId",
        "runId",
        "expectedVersion",
        "startJourneyBinding",
      ],
      properties: {
        experimentId: { type: "string", minLength: 1 },
        runIndex: { type: "integer", enum: PHASE6_RUN_INDEXES },
        scenarioTag: { type: "string", minLength: 1 },
        state: { const: "running" },
        identity: { $ref: "Phase6IdentityBinding" },
        explorer: { $ref: "Phase6ExplorerBinding" },
        scenarioMatrix: { $ref: "Phase6ScenarioMatrixVersion" },
        versions: { $ref: "Phase6VersionBinding" },
        seed: { $ref: "Phase6SeedBinding" },
        runReceipt: { $ref: "Phase6RunReceiptRef" },
        journeyId: { type: "string", minLength: 1 },
        runId: { type: "string", minLength: 1 },
        expectedVersion: { type: "integer", minimum: 0 },
        startJourneyBinding: { type: "object" },
      },
    },
  },
  {
    name: PHASE6_EXPERIMENT_MCP_TOOL_STATUS,
    description: "Read Phase 6 experiment status by experimentId.",
    readonly: true,
    errorCodes: ERROR_CODES,
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["experimentId"],
      forbiddenProperties: FORBIDDEN_CLIENT_OVERRIDE_FIELDS.filter((field) => field !== "experimentId"),
      properties: {
        experimentId: { type: "string", minLength: 1 },
      },
    },
    outputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["experimentId", "state", "identity", "explorer", "scenarioMatrix", "versions", "runs"],
      properties: {
        experimentId: { type: "string", minLength: 1 },
        state: { enum: ["planned", "running", "failed", "complete"] },
        identity: { $ref: "Phase6IdentityBinding" },
        explorer: { $ref: "Phase6ExplorerBinding" },
        scenarioMatrix: { $ref: "Phase6ScenarioMatrixVersion" },
        versions: { $ref: "Phase6VersionBinding" },
        runs: {
          type: "array",
          items: { $ref: "Phase6RunStatusView" },
        },
      },
    },
  },
] as const satisfies readonly Phase6ExperimentMcpToolSchemaLike[];

export function validatePhase6BeginExperimentInput(
  input: unknown,
): Phase6ExperimentMcpValidationResult<Phase6BeginExperimentInput> {
  const base = validateObjectInput(input);
  if (!base.ok) {
    return base;
  }

  const forbidden = firstForbiddenClientOverride(base.value, [
    "commandId",
    "identity",
    "explorer",
  ]);
  if (forbidden) {
    return forbiddenOverride(forbidden);
  }

  const commandId = requiredNonEmptyString(base.value.commandId, "commandId");
  if (!commandId.ok) {
    return commandId;
  }
  const identity = validateIdentityBinding(base.value.identity, "identity");
  if (!identity.ok) {
    return identity;
  }
  const explorer = validateExplorerBinding(base.value.explorer, "explorer");
  if (!explorer.ok) {
    return explorer;
  }

  return {
    ok: true,
    value: {
      commandId: commandId.value,
      identity: identity.value,
      explorer: explorer.value,
    },
  };
}

export function validatePhase6BeginRunInput(
  input: unknown,
): Phase6ExperimentMcpValidationResult<Phase6BeginRunInput> {
  const base = validateObjectInput(input);
  if (!base.ok) {
    return base;
  }

  const forbidden = firstForbiddenClientOverride(base.value, [
    "commandId",
    "experimentId",
    "runIndex",
    "scenarioTag",
    "journeyId",
  ]);
  if (forbidden) {
    return forbiddenOverride(forbidden);
  }

  const commandId = requiredNonEmptyString(base.value.commandId, "commandId");
  if (!commandId.ok) {
    return commandId;
  }
  const experimentId = requiredNonEmptyString(base.value.experimentId, "experimentId");
  if (!experimentId.ok) {
    return experimentId;
  }
  const runIndex = requiredRunIndex(base.value.runIndex, "runIndex");
  if (!runIndex.ok) {
    return runIndex;
  }
  const scenarioTag = requiredNonEmptyString(base.value.scenarioTag, "scenarioTag");
  if (!scenarioTag.ok) {
    return scenarioTag;
  }
  const journeyId = requiredNonEmptyString(base.value.journeyId, "journeyId");
  if (!journeyId.ok) {
    return journeyId;
  }

  return {
    ok: true,
    value: {
      commandId: commandId.value,
      experimentId: experimentId.value,
      runIndex: runIndex.value,
      scenarioTag: scenarioTag.value,
      journeyId: journeyId.value,
    },
  };
}

export function validatePhase6ExperimentStatusInput(
  input: unknown,
): Phase6ExperimentMcpValidationResult<Phase6ExperimentStatusInput> {
  const base = validateObjectInput(input);
  if (!base.ok) {
    return base;
  }

  const forbidden = firstForbiddenClientOverride(base.value, ["experimentId"]);
  if (forbidden) {
    return forbiddenOverride(forbidden);
  }

  const experimentId = requiredNonEmptyString(base.value.experimentId, "experimentId");
  if (!experimentId.ok) {
    return experimentId;
  }

  return {
    ok: true,
    value: { experimentId: experimentId.value },
  };
}

function validateObjectInput(
  input: unknown,
): Phase6ExperimentMcpValidationResult<Record<string, unknown>> {
  if (!isRecord(input)) {
    return fail("invalid_input", "input must be an object");
  }
  return { ok: true, value: input };
}

function validateIdentityBinding(
  input: unknown,
  path: string,
): Phase6ExperimentMcpValidationResult<Phase6IdentityBinding> {
  if (!isRecord(input)) {
    return fail("invalid_input", "identity must be an object", path);
  }
  const forbidden = firstUnexpectedField(input, ["identityId", "cohortId"]);
  if (forbidden) {
    return fail("invalid_input", "identity contains an unsupported field", `${path}.${forbidden}`);
  }
  const identityId = requiredNonEmptyString(input.identityId, `${path}.identityId`);
  if (!identityId.ok) {
    return identityId;
  }
  const cohortId = optionalNonEmptyString(input.cohortId, `${path}.cohortId`);
  if (!cohortId.ok) {
    return cohortId;
  }
  return {
    ok: true,
    value: {
      identityId: identityId.value,
      ...(cohortId.value ? { cohortId: cohortId.value } : {}),
    },
  };
}

function validateExplorerBinding(
  input: unknown,
  path: string,
): Phase6ExperimentMcpValidationResult<Phase6ExplorerBinding> {
  if (!isRecord(input)) {
    return fail("invalid_input", "explorer must be an object", path);
  }
  const forbidden = firstUnexpectedField(input, ["explorerId", "displayName"]);
  if (forbidden) {
    return fail("invalid_input", "explorer contains an unsupported field", `${path}.${forbidden}`);
  }
  const explorerId = requiredNonEmptyString(input.explorerId, `${path}.explorerId`);
  if (!explorerId.ok) {
    return explorerId;
  }
  const displayName = optionalNonEmptyString(input.displayName, `${path}.displayName`);
  if (!displayName.ok) {
    return displayName;
  }
  return {
    ok: true,
    value: {
      explorerId: explorerId.value,
      ...(displayName.value ? { displayName: displayName.value } : {}),
    },
  };
}

function requiredRunIndex(
  value: unknown,
  path: string,
): Phase6ExperimentMcpValidationResult<Phase6RunIndex> {
  if (
    typeof value !== "number"
    || !Number.isInteger(value)
    || !PHASE6_RUN_INDEXES.includes(value as Phase6RunIndex)
  ) {
    return fail("invalid_input", "runIndex must be an integer from 1 through 10", path);
  }
  return { ok: true, value: value as Phase6RunIndex };
}

function requiredNonEmptyString(
  value: unknown,
  path: string,
): Phase6ExperimentMcpValidationResult<string> {
  if (typeof value !== "string" || value.trim().length === 0) {
    return fail("invalid_input", `${path} must be a non-empty string`, path);
  }
  return { ok: true, value };
}

function optionalNonEmptyString(
  value: unknown,
  path: string,
): Phase6ExperimentMcpValidationResult<string | undefined> {
  if (value === undefined) {
    return { ok: true, value: undefined };
  }
  return requiredNonEmptyString(value, path);
}

function firstForbiddenClientOverride(
  input: Record<string, unknown>,
  allowedFields: readonly string[],
): string | undefined {
  for (const key of Object.keys(input)) {
    if (allowedFields.includes(key)) {
      continue;
    }
    if (FORBIDDEN_CLIENT_OVERRIDE_FIELDS.includes(key as typeof FORBIDDEN_CLIENT_OVERRIDE_FIELDS[number])) {
      return key;
    }
    return key;
  }
  return undefined;
}

function firstUnexpectedField(
  input: Record<string, unknown>,
  allowedFields: readonly string[],
): string | undefined {
  return Object.keys(input).find((key) => !allowedFields.includes(key));
}

function forbiddenOverride(
  path: string,
): Phase6ExperimentMcpValidationResult<never> {
  return fail(
    "forbidden_client_override",
    "clients may not override server-bound receipt, status, version, or seed fields",
    path,
  );
}

function fail(
  code: Phase6ExperimentMcpErrorCode,
  message: string,
  path?: string,
): Phase6ExperimentMcpValidationResult<never> {
  return {
    ok: false,
    error: {
      code,
      message,
      ...(path ? { path } : {}),
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
