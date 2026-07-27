import {
  JOURNEY_RUN_RECEIPT_AUTHORITY,
  JOURNEY_RUN_RECEIPT_VERSION,
  validateJourneyRunReceipt,
  type JourneyRunReceipt,
} from "./journeyRunReceiptRules.ts";
import type { Phase6MachineReadableResultPage } from "./phase6ResultPageRules.ts";

export const PHASE6_MCP_CONTRACT_RULESET_VERSION = "obsidian-epoch-phase6-mcp-contract-v0.1.0" as const;

export const PHASE6_MCP_TOOL_RUN_RECEIPT = "obsidian_epoch.run_receipt" as const;
export const PHASE6_MCP_TOOL_PHASE6_RESULT = "obsidian_epoch.phase6_result" as const;

export const PHASE6_MCP_TOOL_NAMES = [
  PHASE6_MCP_TOOL_RUN_RECEIPT,
  PHASE6_MCP_TOOL_PHASE6_RESULT,
] as const;

export type Phase6McpToolName = typeof PHASE6_MCP_TOOL_NAMES[number];

export type Phase6McpErrorCode =
  | "not_found"
  | "invalid_receipt"
  | "settlement_pending"
  | "forbidden";

export interface Phase6McpError {
  readonly code: Phase6McpErrorCode;
  readonly message: string;
  readonly path?: string;
}

export interface Phase6McpRunReceiptInput {
  readonly receiptId?: string;
  readonly journeyId?: string;
}

export interface Phase6McpPhase6ResultInput {
  readonly pageId: string;
}

export interface Phase6McpRunReceiptOutput {
  readonly receipt: JourneyRunReceipt;
}

export interface Phase6McpPhase6ResultOutput {
  readonly pageId: string;
  readonly receiptId: string;
  readonly result: Phase6MachineReadableResultPage;
}

export type Phase6McpToolInput =
  | Phase6McpRunReceiptInput
  | Phase6McpPhase6ResultInput;

export type Phase6McpToolOutput =
  | Phase6McpRunReceiptOutput
  | Phase6McpPhase6ResultOutput;

export interface Phase6McpToolSchemaLike {
  readonly name: Phase6McpToolName;
  readonly description: string;
  readonly inputSchema: Readonly<Record<string, unknown>>;
  readonly outputSchema: Readonly<Record<string, unknown>>;
  readonly errorCodes: readonly Phase6McpErrorCode[];
  readonly readonly: true;
}

export interface Phase6McpStoredReceiptLookup {
  readonly receipt?: JourneyRunReceipt;
}

export interface Phase6McpStoredResultSidecarLookup {
  readonly pageId: string;
  readonly receiptId: string;
  readonly receipt?: JourneyRunReceipt;
  readonly result?: Phase6MachineReadableResultPage;
  readonly verified: boolean;
}

export type Phase6McpValidationResult<T> =
  | {
    readonly ok: true;
    readonly value: T;
  }
  | {
    readonly ok: false;
    readonly error: Phase6McpError;
  };

const ERROR_CODES = [
  "not_found",
  "invalid_receipt",
  "settlement_pending",
  "forbidden",
] as const satisfies readonly Phase6McpErrorCode[];

const FORBIDDEN_CLIENT_FIELDS = [
  "receipt",
  "result",
  "page",
  "sidecar",
  "payload",
  "content",
  "authority",
  "version",
  "receiptType",
  "runId",
  "agentId",
  "explorerId",
  "experimentId",
  "runIndex",
  "seed",
  "rulesetVersion",
  "catalogVersion",
  "codeVersion",
  "scenarioMatrixVersion",
  "generatedAt",
  "startedAt",
  "settledAt",
  "world",
  "snapshots",
  "deltas",
  "score",
  "suitability",
  "rag",
  "eventIds",
  "outcome",
  "integrity",
] as const;

export const PHASE6_MCP_TOOL_SCHEMAS = [
  {
    name: PHASE6_MCP_TOOL_RUN_RECEIPT,
    description: "Read a server-settled journey run receipt by receiptId or journeyId.",
    readonly: true,
    errorCodes: ERROR_CODES,
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        receiptId: { type: "string", minLength: 1 },
        journeyId: { type: "string", minLength: 1 },
      },
      anyOf: [
        { required: ["receiptId"] },
        { required: ["journeyId"] },
      ],
      forbiddenProperties: FORBIDDEN_CLIENT_FIELDS,
    },
    outputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["receipt"],
      properties: {
        receipt: { $ref: "JourneyRunReceipt" },
      },
    },
  },
  {
    name: PHASE6_MCP_TOOL_PHASE6_RESULT,
    description: "Read a verified Phase 6 result sidecar for a server-settled receipt.",
    readonly: true,
    errorCodes: ERROR_CODES,
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["pageId"],
      properties: {
        pageId: { type: "string", minLength: 1 },
      },
      forbiddenProperties: FORBIDDEN_CLIENT_FIELDS,
    },
    outputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["pageId", "receiptId", "result"],
      properties: {
        pageId: { type: "string", minLength: 1 },
        receiptId: { type: "string", minLength: 1 },
        result: { $ref: "Phase6MachineReadableResultPage" },
      },
    },
  },
] as const satisfies readonly Phase6McpToolSchemaLike[];

export function validatePhase6McpRunReceiptInput(
  input: unknown,
): Phase6McpValidationResult<Phase6McpRunReceiptInput> {
  const base = validateObjectInput(input);
  if (!base.ok) {
    return base;
  }

  const forbidden = firstForbiddenClientField(base.value, ["receiptId", "journeyId"]);
  if (forbidden) {
    return fail("forbidden", "clients may only submit receiptId or journeyId for receipt reads", forbidden);
  }

  const receiptId = optionalNonEmptyString(base.value.receiptId, "receiptId");
  if (!receiptId.ok) {
    return receiptId;
  }
  const journeyId = optionalNonEmptyString(base.value.journeyId, "journeyId");
  if (!journeyId.ok) {
    return journeyId;
  }
  if (!receiptId.value && !journeyId.value) {
    return fail("not_found", "receiptId or journeyId is required");
  }

  return {
    ok: true,
    value: {
      ...(receiptId.value ? { receiptId: receiptId.value } : {}),
      ...(journeyId.value ? { journeyId: journeyId.value } : {}),
    },
  };
}

export function validatePhase6McpPhase6ResultInput(
  input: unknown,
): Phase6McpValidationResult<Phase6McpPhase6ResultInput> {
  const base = validateObjectInput(input);
  if (!base.ok) {
    return base;
  }

  const forbidden = firstForbiddenClientField(base.value, ["pageId"]);
  if (forbidden) {
    return fail("forbidden", "clients may only submit pageId for result sidecar reads", forbidden);
  }

  const pageId = requiredNonEmptyString(base.value.pageId, "pageId");
  if (!pageId.ok) {
    return pageId;
  }

  return {
    ok: true,
    value: { pageId: pageId.value },
  };
}

export function validatePhase6McpRunReceiptRead(
  lookup: Phase6McpStoredReceiptLookup,
): Phase6McpValidationResult<Phase6McpRunReceiptOutput> {
  const receipt = lookup.receipt;
  if (!receipt) {
    return fail("not_found", "server persisted receipt was not found");
  }

  const receiptValidation = validateServerSettledReceipt(receipt);
  if (!receiptValidation.ok) {
    return receiptValidation;
  }

  return { ok: true, value: { receipt } };
}

export function validatePhase6McpPhase6ResultRead(
  lookup: Phase6McpStoredResultSidecarLookup,
): Phase6McpValidationResult<Phase6McpPhase6ResultOutput> {
  if (!lookup.receipt) {
    return fail("not_found", "server persisted receipt was not found");
  }

  const receiptValidation = validateServerSettledReceipt(lookup.receipt);
  if (!receiptValidation.ok) {
    return receiptValidation;
  }

  if (!lookup.verified) {
    return fail("settlement_pending", "verified result sidecar is not available yet");
  }
  if (!lookup.result) {
    return fail("not_found", "verified result sidecar was not found");
  }
  if (lookup.result.receipt.receiptId !== lookup.receiptId || lookup.result.receipt.receiptId !== lookup.receipt.receiptId) {
    return fail("invalid_receipt", "result sidecar receiptId does not match the persisted receipt", "result.receipt.receiptId");
  }

  return {
    ok: true,
    value: {
      pageId: lookup.pageId,
      receiptId: lookup.receiptId,
      result: lookup.result,
    },
  };
}

function validateObjectInput(
  input: unknown,
): Phase6McpValidationResult<Readonly<Record<string, unknown>>> {
  if (!isRecord(input)) {
    return fail("forbidden", "tool input must be an object");
  }
  return { ok: true, value: input };
}

function validateServerSettledReceipt(
  receipt: JourneyRunReceipt,
): Phase6McpValidationResult<JourneyRunReceipt> {
  if (!isRecord(receipt)) {
    return fail("invalid_receipt", "stored receipt must be an object");
  }
  if (receipt.receiptType !== "journey_run_receipt") {
    return fail("invalid_receipt", "stored receipt has an invalid receiptType", "receipt.receiptType");
  }
  if (receipt.version !== JOURNEY_RUN_RECEIPT_VERSION) {
    return fail("invalid_receipt", "stored receipt has an invalid version", "receipt.version");
  }
  if (receipt.authority !== JOURNEY_RUN_RECEIPT_AUTHORITY) {
    return fail("settlement_pending", "receipt is not server settled", "receipt.authority");
  }
  const strictValidation = validateJourneyRunReceipt(receipt);
  if (!strictValidation.ok) {
    const firstIssue = strictValidation.issues[0];
    return fail(
      "invalid_receipt",
      firstIssue ? `stored receipt failed strict validation: ${firstIssue.code}` : "stored receipt failed strict validation",
      firstIssue?.path ? `receipt${firstIssue.path === "$" ? "" : firstIssue.path.slice(1)}` : undefined,
    );
  }
  if (!isNonEmptyString(receipt.receiptId)) {
    return fail("invalid_receipt", "stored receipt is missing receiptId", "receipt.receiptId");
  }
  if (!isNonEmptyString(receipt.journeyId)) {
    return fail("invalid_receipt", "stored receipt is missing journeyId", "receipt.journeyId");
  }
  if (!isRecord(receipt.integrity) || !isNonEmptyString(receipt.integrity.bodyHash)) {
    return fail("invalid_receipt", "stored receipt is missing integrity bodyHash", "receipt.integrity.bodyHash");
  }
  return { ok: true, value: receipt };
}

function optionalNonEmptyString(
  value: unknown,
  path: string,
): Phase6McpValidationResult<string | undefined> {
  if (value === undefined) {
    return { ok: true, value: undefined };
  }
  if (!isNonEmptyString(value)) {
    return fail("not_found", `${path} must be a non-empty string`, path);
  }
  return { ok: true, value };
}

function requiredNonEmptyString(
  value: unknown,
  path: string,
): Phase6McpValidationResult<string> {
  if (!isNonEmptyString(value)) {
    return fail("not_found", `${path} must be a non-empty string`, path);
  }
  return { ok: true, value };
}

function firstForbiddenClientField(
  input: Readonly<Record<string, unknown>>,
  allowedFields: readonly string[],
): string | undefined {
  const explicitForbidden = FORBIDDEN_CLIENT_FIELDS.find((field) => hasOwn(input, field));
  if (explicitForbidden) {
    return explicitForbidden;
  }
  return Object.keys(input).find((field) => !allowedFields.includes(field));
}

function hasOwn(input: Readonly<Record<string, unknown>>, field: string): boolean {
  return Object.prototype.hasOwnProperty.call(input, field);
}

function fail<T = never>(
  code: Phase6McpErrorCode,
  message: string,
  path?: string,
): Phase6McpValidationResult<T> {
  return {
    ok: false,
    error: { code, message, path },
  };
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
