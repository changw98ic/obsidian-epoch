#!/usr/bin/env node
// Execute the Phase 6 ten-run flow through the live MCP HTTP endpoint and
// write sanitized canonical CDE records to stdout or a caller-specified file.
// The caller owns attestation; this runner only emits the actual tool trace.

import fs from "node:fs";
import { phase6RagEvaluationProfileForRun } from "./lib/epoch/phase6RagEvaluationPolicy.ts";
import {
  phase6RunnerActionStrategyForRun,
  selectPhase6RunnerAction,
} from "./lib/epoch/phase6RunActionPolicy.ts";

type JsonRecord = Record<string, unknown>;

interface Scenario {
  readonly taskType: string;
  readonly regionId: string;
  readonly objective: string;
}

interface TraceRecord {
  readonly schemaVersion: "phase6.cde_tool_record.v1";
  readonly sequence: number;
  readonly timestamp: string;
  readonly toolUseId: string;
  readonly sourceToolName: string;
  readonly originalToolName: string;
  readonly toolName: string;
  readonly isError: false;
  readonly ok: true;
  readonly input: JsonRecord;
  readonly output: JsonRecord;
  metadata: JsonRecord;
  formalJourney?: true;
  formalResultPage?: true;
  playerPanelBefore?: true;
  playerPanelAfter?: true;
  runSettled?: true;
}

interface ToolCall {
  readonly result: JsonRecord;
  readonly trace: TraceRecord;
}

interface RunBinding {
  readonly experimentId: string;
  readonly runIndex: number;
  readonly identityId: string;
  readonly explorerId: string;
  readonly journeyId?: string;
  readonly receiptId?: string;
}

interface Phase6TenRunRealOptions {
  readonly outputPath?: string;
  readonly serverBase?: string;
  readonly help: boolean;
}

const SCENARIOS: readonly Scenario[] = [
  { taskType: "resource_acquisition", regionId: "region_gray_harbor", objective: "采集区域资源并留下可核验记录" },
  { taskType: "information_acquisition", regionId: "region_gray_harbor", objective: "收集情报并验证来源" },
  { taskType: "structured_challenge", regionId: "region_gray_harbor", objective: "完成结构化挑战" },
  { taskType: "companion_support", regionId: "region_gray_harbor", objective: "支援同伴并完成协作目标" },
  { taskType: "resource_preservation", regionId: "region_gray_harbor", objective: "保护关键资源" },
  { taskType: "priority_commission", regionId: "region_gray_harbor", objective: "完成优先委托" },
  { taskType: "crisis_retreat", regionId: "region_gray_harbor", objective: "在危机中安全撤退" },
  { taskType: "cultivation_material", regionId: "region_gray_harbor", objective: "取得修行材料" },
  { taskType: "crafting_material", regionId: "region_gray_harbor", objective: "取得制作材料" },
  { taskType: "repeated_route_audit", regionId: "region_gray_harbor", objective: "审计重复路线的世界变化" },
];

const EXPECTED_SCENARIO_TAGS = [
  "low-prepared-resource",
  "low-underprepared-information",
  "medium-prepared-structured",
  "medium-borderline-companion",
  "medium-mismatched-preserve",
  "high-prepared-priority",
  "high-underprepared-crisis",
  "medium-prepared-cultivation",
  "medium-specialist-crafting",
  "dynamic-mixed-repeat",
] as const;

const SECRET_VALUE = /\b(?:sk-[A-Za-z0-9_-]{12,}|Bearer\s+[A-Za-z0-9._-]{12,}|xox[baprs]-[A-Za-z0-9-]{12,}|AKIA[0-9A-Z]{16})\b/i;
const SENSITIVE_FIELD = /(?:secret|token|authorization|password|credential|api[-_]?key|private[-_]?key|access[-_]?key|session[-_]?key|operator[-_]?key|recovery[-_]?code|signature)/i;
const SENSITIVE_URL_VALUE = /(?:[?&](?:share[-_]?token|publish[-_]?token|token|authorization|access[-_]?token|refresh[-_]?token|signature|recovery[-_]?code)(?:=|%3d)|\/(?:share[-_]?token|publish[-_]?token)(?:\/|$))/i;
const SENSITIVE_FIELD_NAMES = new Set([
  "apikey",
  "accesskey",
  "authorization",
  "credential",
  "localsecret",
  "operatorkey",
  "password",
  "privatekey",
  "recoverycode",
  "refreshtoken",
  "secret",
  "sessionkey",
  "signature",
  "token",
]);
const MCP_HTTP_TOOL_PATH = "/api/epoch/mcp/tools/call";

const traceRecords: TraceRecord[] = [];
let nextSequence = 0;
let emitted = false;

function usage(): string {
  return [
    "Usage: node --import tsx ../agent-server/phase6-ten-run-real.ts [--server-base <http(s)-origin>] [--output <path>]",
    "",
    "Runs the ten-run acceptance journey through the live MCP HTTP endpoint.",
    "When --server-base is provided, it overrides AGENT_WORLD_SERVER and pins the target origin.",
    "When --output is provided, writes the sanitized CDE trace with exclusive creation.",
  ].join("\n");
}

function parseArguments(argv: readonly string[]): Phase6TenRunRealOptions {
  let outputPath: string | undefined;
  let serverBase: string | undefined;
  let help = false;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") {
      help = true;
      continue;
    }
    if (argument === "--output") {
      const value = argv[index + 1];
      if (!value || value.startsWith("-")) throw new Error("phase6_runner_output_path_required");
      outputPath = value;
      index += 1;
      continue;
    }
    if (argument === "--server-base") {
      const value = argv[index + 1];
      if (!value || value.startsWith("-")) throw new Error("phase6_runner_server_base_required");
      serverBase = mcpHttpEndpoint(value).baseUrl;
      index += 1;
      continue;
    }
    throw new Error("phase6_runner_argument_invalid");
  }
  return { outputPath, serverBase, help };
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function recordValue(value: unknown, label: string): JsonRecord {
  if (!isRecord(value)) {
    throw new Error(`expected_record:${label}`);
  }
  return value;
}

function stringValue(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`expected_string:${label}`);
  }
  return value;
}

function numberValue(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`expected_number:${label}`);
  }
  return value;
}

function fieldRecord(value: JsonRecord, field: string, label: string): JsonRecord {
  return recordValue(value[field], `${label}.${field}`);
}

function fieldString(value: JsonRecord, field: string, label: string): string {
  return stringValue(value[field], `${label}.${field}`);
}

function normalizedFieldName(key: string): string {
  return key.replace(/[^a-z0-9]/giu, "").toLowerCase();
}

function isSensitiveField(key: string): boolean {
  const normalized = normalizedFieldName(key);
  return SENSITIVE_FIELD.test(key)
    || SENSITIVE_FIELD_NAMES.has(normalized)
    || [...SENSITIVE_FIELD_NAMES].some((suffix) => normalized.endsWith(suffix));
}

function sanitize(value: unknown): unknown {
  if (typeof value === "string") {
    if (SENSITIVE_URL_VALUE.test(value)) {
      return "[REDACTED_SENSITIVE_URL]";
    }
    return SECRET_VALUE.test(value) ? "[REDACTED_SECRET]" : value;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => sanitize(entry));
  }
  if (!isRecord(value)) {
    return value;
  }
  const result: JsonRecord = {};
  for (const [key, entry] of Object.entries(value)) {
    if (isSensitiveField(key)) {
      continue;
    }
    result[key] = sanitize(entry);
  }
  return result;
}

function sanitizeRecord(value: JsonRecord): JsonRecord {
  return recordValue(sanitize(value), "sanitized_record");
}

function sourceToolName(name: string): string {
  return `mcp__obsidian_epoch__${name.replace(".", "_")}`;
}

function mcpHttpEndpoint(baseUrl: string): { readonly baseUrl: string; readonly transport: JsonRecord } {
  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new Error("mcp_server_url_invalid");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("mcp_server_url_invalid");
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== "/") {
    throw new Error("mcp_server_url_invalid");
  }
  return {
    baseUrl: parsed.origin,
    transport: {
      kind: "mcp_http",
      origin: parsed.origin,
      path: MCP_HTTP_TOOL_PATH,
    },
  };
}

function canonicalToolName(name: string): string {
  return name.replace(/_compact$/u, "");
}

function annotateRun(trace: TraceRecord, binding: RunBinding): void {
  trace.metadata = {
    ...trace.metadata,
    experimentId: binding.experimentId,
    runIndex: binding.runIndex,
    identityId: binding.identityId,
    explorerId: binding.explorerId,
    ...(binding.journeyId ? { journeyId: binding.journeyId } : {}),
    ...(binding.receiptId ? { receiptId: binding.receiptId } : {}),
  };
}

function annotateRunCalls(calls: readonly ToolCall[], binding: RunBinding): void {
  calls.forEach((call) => annotateRun(call.trace, binding));
}

function readMcpResult(envelope: unknown, toolName: string): JsonRecord {
  const response = recordValue(envelope, `${toolName}.response`);
  if (response.isError === true) {
    throw new Error(`mcp_error:${toolName}`);
  }
  if (!Array.isArray(response.content) || response.content.length < 1) {
    throw new Error(`mcp_content_missing:${toolName}`);
  }
  const first = recordValue(response.content[0], `${toolName}.content[0]`);
  const text = stringValue(first.text, `${toolName}.content[0].text`);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`mcp_content_invalid_json:${toolName}`);
  }
  return recordValue(parsed, `${toolName}.content.value`);
}

async function callTool(baseUrl: string, name: string, input: JsonRecord): Promise<ToolCall> {
  const endpoint = mcpHttpEndpoint(baseUrl);
  const timestamp = new Date().toISOString();
  let response: Response;
  try {
    response = await fetch(`${endpoint.baseUrl}${MCP_HTTP_TOOL_PATH}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, arguments: input }),
    });
  } catch {
    throw new Error(`mcp_transport_error:${name}`);
  }
  let envelope: unknown;
  try {
    envelope = await response.json();
  } catch {
    throw new Error(`mcp_response_invalid_json:${name}`);
  }
  if (!response.ok) {
    throw new Error(`mcp_http_${response.status}:${name}`);
  }
  const result = readMcpResult(envelope, name);
  const sequence = ++nextSequence;
  const trace: TraceRecord = {
    schemaVersion: "phase6.cde_tool_record.v1",
    sequence,
    timestamp,
    toolUseId: `local_mcp_${sequence}`,
    sourceToolName: sourceToolName(name),
    originalToolName: sourceToolName(name),
    toolName: canonicalToolName(name),
    isError: false,
    ok: true,
    input: sanitizeRecord(input),
    output: sanitizeRecord(result),
    metadata: { transport: endpoint.transport },
  };
  traceRecords.push(trace);
  return { result, trace };
}

function resultIdentityId(result: JsonRecord, label: string): string {
  const identity = fieldRecord(result, "identity", label);
  return fieldString(identity, "identityId", `${label}.identity`);
}

function resultExplorerId(result: JsonRecord, label: string): string {
  const explorer = fieldRecord(result, "explorer", label);
  return fieldString(explorer, "explorerId", `${label}.explorer`);
}

function issuedAgentId(result: JsonRecord, label: string): string {
  if (typeof result.agentId === "string" && result.agentId.trim()) {
    return result.agentId;
  }
  const value = fieldRecord(result, "value", label);
  return fieldString(value, "agentId", `${label}.value`);
}

function registeredExplorerId(result: JsonRecord): string {
  return typeof result.explorerId === "string" && result.explorerId.trim()
    ? result.explorerId
    : fieldString(fieldRecord(result, "value", "register_explorer"), "explorerId", "register_explorer.value");
}

function recoveryCode(result: JsonRecord, label: string): string {
  return fieldString(result, "recoveryCode", label);
}

function journeyStatus(result: JsonRecord, label: string): JsonRecord {
  return fieldRecord(result, "journey", label);
}

function selectedAction(runIndex: number, sceneContract: JsonRecord): JsonRecord {
  const rawOptions = sceneContract.actionOptions;
  if (!Array.isArray(rawOptions) || rawOptions.length === 0) {
    throw new Error("journey_action_options_missing");
  }
  const options = rawOptions.filter(isRecord);
  if (options.length === 0) {
    throw new Error("journey_action_options_invalid");
  }
  const selected = selectPhase6RunnerAction(
    runIndex,
    options.map((option) => ({
      actionOptionId: fieldString(option, "actionOptionId", "actionOption"),
      ...(typeof option.optionKey === "string" ? { optionKey: option.optionKey } : {}),
      ...(option.risk === "low" || option.risk === "medium" || option.risk === "high" ? { risk: option.risk } : {}),
      ...(typeof option.decisionEffect === "string" ? { decisionEffect: option.decisionEffect } : {}),
    })),
    typeof sceneContract.safeFallbackActionOptionId === "string"
      ? sceneContract.safeFallbackActionOptionId
      : undefined,
  );
  const preferred = options.find((option) => option.actionOptionId === selected.action.actionOptionId);
  if (!preferred) throw new Error("journey_action_options_invalid");
  return preferred;
}

function selectedSignature(option: JsonRecord): string {
  return fieldString(fieldRecord(option, "signed", "actionOption"), "signature", "actionOption.signed");
}

function statusSettlement(result: JsonRecord): JsonRecord {
  const settlement = fieldRecord(result, "phase6Settlement", "journey_status");
  if (settlement.ok !== true || settlement.status !== "settled") {
    throw new Error("phase6_settlement_not_settled");
  }
  return settlement;
}

async function compactJourneyStatusWithDiagnostic(
  baseUrl: string,
  journeyId: string,
  recovery: string,
  binding: RunBinding,
): Promise<ToolCall> {
  try {
    const compact = await callTool(baseUrl, "obsidian_epoch.journey_status_compact", {
      journeyId,
      recoveryCode: recovery,
    });
    annotateRun(compact.trace, binding);
    return compact;
  } catch {
    const diagnostic = await callTool(baseUrl, "obsidian_epoch.journey_status", {
      journeyId,
      recoveryCode: recovery,
    });
    annotateRun(diagnostic.trace, binding);
    diagnostic.trace.metadata.compactStatusFailureDiagnostic = true;
    throw new Error("phase6_compact_status_failed");
  }
}

function expectedExperimentRun(status: JsonRecord, runIndex: number, receiptId: string): void {
  if (!Array.isArray(status.runs)) {
    throw new Error("phase6_experiment_status_runs_missing");
  }
  const run = status.runs.filter(isRecord).find((entry) => entry.runIndex === runIndex);
  if (!run || (run.state !== "complete" && run.status !== "complete")) {
    throw new Error("phase6_experiment_run_not_complete");
  }
  const receipt = recordValue(run.receipt, "phase6_experiment_status.run.receipt");
  if (receipt.receiptId !== receiptId) {
    throw new Error("phase6_experiment_receipt_mismatch");
  }
}

function emitTrace(outputPath?: string): void {
  if (emitted) {
    return;
  }
  emitted = true;
  const serialized = traceRecords.map((trace) => JSON.stringify(trace)).join("\n");
  const text = serialized ? `${serialized}\n` : "";
  if (outputPath) {
    fs.writeFileSync(outputPath, text, { encoding: "utf8", flag: "wx", mode: 0o600 });
    fs.chmodSync(outputPath, 0o600);
    return;
  }
  process.stdout.write(text);
}

const SAFE_RUNNER_ERROR_CODES = new Set([
  "expected_record",
  "expected_string",
  "expected_number",
  "journey_action_options_missing",
  "journey_action_options_invalid",
  "phase6_settlement_not_settled",
  "phase6_experiment_status_runs_missing",
  "phase6_experiment_run_not_complete",
  "phase6_experiment_receipt_mismatch",
  "phase6_compact_status_failed",
  "phase6_run_index_out_of_order",
  "phase6_scenario_tag_mismatch",
  "phase6_journey_binding_mismatch",
  "phase6_result_binding_mismatch",
  "phase6_runner_output_path_required",
  "phase6_runner_argument_invalid",
  "mcp_server_url_invalid",
]);

function safeErrorCode(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  const mcpMatch = /^(mcp_(?:error|content_missing|content_invalid_json|transport_error|response_invalid_json)|mcp_http_\d+):obsidian_epoch\.([a-z_]+)$/u.exec(message);
  if (mcpMatch) {
    return `${mcpMatch[1]}:${mcpMatch[2]}`;
  }
  const code = /^([a-z][a-z0-9_]*)(?::|$)/iu.exec(message)?.[1];
  return code && SAFE_RUNNER_ERROR_CODES.has(code) ? code : "unknown";
}

async function maybeReincarnate(baseUrl: string, agentId: string, recovery: string, nonce: string, runOffset: number): Promise<{ agentId: string; recovery: string }> {
  const progress = await callTool(baseUrl, "obsidian_epoch.progress", { agentId });
  const identity = fieldRecord(progress.result, "identity", "progress");
  if (identity.status !== "archived") {
    return { agentId, recovery };
  }
  const reincarnated = await callTool(baseUrl, "obsidian_epoch.reincarnate", {
    previousAgentId: agentId,
    idempotencyKey: `phase6-real-${nonce}-reincarnate-${runOffset}`,
  });
  return {
    agentId: issuedAgentId(reincarnated.result, "reincarnate"),
    recovery: recoveryCode(reincarnated.result, "reincarnate"),
  };
}

async function runScenario(
  baseUrl: string,
  scenario: Scenario,
  expectedRunIndex: number,
  experimentId: string,
  agentId: string,
  explorerId: string,
  recovery: string,
  nonce: string,
): Promise<RunBinding> {
  const prepared = await callTool(baseUrl, "obsidian_epoch.prepare_journey", {
    agentId,
    destinationRegionId: scenario.regionId,
    taskType: scenario.taskType,
    mandate: { objective: scenario.objective, priorities: ["phase6_acceptance"] },
    recoveryCode: recovery,
    idempotencyKey: `phase6-real-${nonce}-prepare-${expectedRunIndex}`,
  });
  const preparedJourney = journeyStatus(prepared.result, "prepare_journey");
  const journeyId = fieldString(preparedJourney, "journeyId", "prepare_journey.journey");

  // The public run command intentionally carries only the experiment id.
  // The service chooses the next run, scenario tag, and prepared journey binding.
  const begun = await callTool(baseUrl, "obsidian_epoch.begin_phase6_run", { experimentId });
  const runIndex = numberValue(begun.result.runIndex, "begin_phase6_run.runIndex");
  if (runIndex !== expectedRunIndex) {
    throw new Error("phase6_run_index_out_of_order");
  }
  if (begun.result.scenarioTag !== EXPECTED_SCENARIO_TAGS[expectedRunIndex - 1]) {
    throw new Error("phase6_scenario_tag_mismatch");
  }
  if (begun.result.journeyId !== journeyId) {
    throw new Error("phase6_journey_binding_mismatch");
  }
  const binding: RunBinding = {
    experimentId,
    runIndex,
    identityId: resultIdentityId(begun.result, "begin_phase6_run"),
    explorerId: resultExplorerId(begun.result, "begin_phase6_run"),
  };
  annotateRunCalls([prepared, begun], binding);

  const panelBefore = await callTool(baseUrl, "obsidian_epoch.player_panel", {
    agentId,
    recoveryCode: recovery,
  });
  annotateRun(panelBefore.trace, binding);
  panelBefore.trace.playerPanelBefore = true;

  const startJourneyBinding = fieldRecord(begun.result, "startJourneyBinding", "begin_phase6_run");
  const ragProfile = phase6RagEvaluationProfileForRun(runIndex);
  const started = await callTool(baseUrl, "obsidian_epoch.start_journey_compact", {
    journeyId,
    expectedVersion: numberValue(begun.result.expectedVersion, "begin_phase6_run.expectedVersion"),
    decisionMode: "agent_native",
    taskGenerationMode: "server_fallback",
    recoveryCode: recovery,
    idempotencyKey: `phase6-real-${nonce}-start-${runIndex}`,
    startJourneyBinding,
  });
  annotateRun(started.trace, binding);
  started.trace.formalJourney = true;

  // A retrieval trace must cite an event from this journey.  Starting first
  // gives the retriever a canonical, run-scoped anchor instead of borrowing
  // a prior run's identity history.
  const knowledge = await callTool(baseUrl, "obsidian_epoch.world_knowledge", {
    query: ragProfile.query,
    limit: 30,
    startJourneyBinding,
  });
  annotateRun(knowledge.trace, binding);

  let settledStatus: ToolCall | undefined;
  const actionStrategy = phase6RunnerActionStrategyForRun(runIndex);
  if (actionStrategy === "safe_fallback") {
    // The product's real safe path is recall_journey, not the per-objective
    // `safeFallbackActionOptionId` marker.  Calling it here produces an
    // auditable conservative withdrawal without spending an unrelated task
    // action or forcing a client-side outcome.
    const status = await compactJourneyStatusWithDiagnostic(baseUrl, journeyId, recovery, binding);
    const journey = journeyStatus(status.result, "journey_status");
    const recalled = await callTool(baseUrl, "obsidian_epoch.recall_journey", {
      journeyId,
      expectedVersion: numberValue(journey.version, "journey_status.journey.version"),
      recoveryCode: recovery,
      idempotencyKey: `phase6-real-${nonce}-recall-${runIndex}`,
    });
    annotateRun(recalled.trace, binding);
    settledStatus = await compactJourneyStatusWithDiagnostic(baseUrl, journeyId, recovery, binding);
  } else for (let step = 0; step < 32; step += 1) {
    const status = await compactJourneyStatusWithDiagnostic(baseUrl, journeyId, recovery, binding);
    const journey = journeyStatus(status.result, "journey_status");
    if (journey.status === "settled") {
      settledStatus = status;
      break;
    }
    const proposed = await callTool(baseUrl, "obsidian_epoch.propose_journey_step_compact", {
      journeyId,
      expectedVersion: numberValue(journey.version, "journey_status.journey.version"),
      recoveryCode: recovery,
      idempotencyKey: `phase6-real-${nonce}-propose-${runIndex}-${step}`,
    });
    annotateRun(proposed.trace, binding);
    const proposal = fieldRecord(proposed.result, "proposal", "propose_journey_step");
    const sceneContract = fieldRecord(proposal, "sceneContract", "propose_journey_step.proposal");
    const action = selectedAction(runIndex, sceneContract);
    const episode = fieldRecord(proposal, "episode", "propose_journey_step.proposal");
    const committed = await callTool(baseUrl, "obsidian_epoch.commit_journey_action_compact", {
      journeyId,
      sceneId: fieldString(sceneContract, "sceneId", "sceneContract"),
      episodeId: fieldString(episode, "episodeId", "proposal.episode"),
      expectedVersion: numberValue(proposal.expectedVersion, "proposal.expectedVersion"),
      actionOptionId: fieldString(action, "actionOptionId", "actionOption"),
      signature: selectedSignature(action),
      recoveryCode: recovery,
      idempotencyKey: `phase6-real-${nonce}-commit-${runIndex}-${step}`,
    });
    annotateRun(committed.trace, binding);
  }

  if (!settledStatus) {
    settledStatus = await compactJourneyStatusWithDiagnostic(baseUrl, journeyId, recovery, binding);
  }
  settledStatus.trace.runSettled = true;
  const settlement = statusSettlement(settledStatus.result);
  const receiptId = fieldString(settlement, "receiptId", "phase6Settlement");
  const pageId = fieldString(settlement, "pageId", "phase6Settlement");
  const completedBinding: RunBinding = { ...binding, journeyId, receiptId };

  const experimentStatus = await callTool(baseUrl, "obsidian_epoch.phase6_experiment_status", { experimentId });
  annotateRun(experimentStatus.trace, completedBinding);
  expectedExperimentRun(experimentStatus.result, runIndex, receiptId);

  const runReceipt = await callTool(baseUrl, "obsidian_epoch.run_receipt_compact", { receiptId, journeyId });
  annotateRun(runReceipt.trace, completedBinding);

  const result = await callTool(baseUrl, "obsidian_epoch.phase6_result_compact", { pageId });
  annotateRun(result.trace, completedBinding);
  if (result.result.verified !== true || result.result.receiptId !== receiptId || result.result.pageId !== pageId) {
    throw new Error("phase6_result_binding_mismatch");
  }
  result.trace.formalResultPage = true;

  const panelAfter = await callTool(baseUrl, "obsidian_epoch.player_panel", {
    agentId,
    recoveryCode: recovery,
  });
  annotateRun(panelAfter.trace, completedBinding);
  panelAfter.trace.playerPanelAfter = true;
  return completedBinding;
}

async function runPhase6CommerceAndCraft(
  baseUrl: string,
  agentId: string,
  recovery: string,
  binding: RunBinding,
  nonce: string,
): Promise<void> {
  const shop = await callTool(baseUrl, "obsidian_epoch.shop", {
    regionId: "region_gray_harbor",
  });
  annotateRun(shop.trace, binding);

  const purchase = await callTool(baseUrl, "obsidian_epoch.purchase_shop_offer", {
    agentId,
    offerId: "gray-ration-pack",
    regionId: "region_gray_harbor",
    recoveryCode: recovery,
    idempotencyKey: `phase6-real-${nonce}-shop-run-${binding.runIndex}`,
  });
  annotateRun(purchase.trace, binding);

  const crafted = await callTool(baseUrl, "obsidian_epoch.craft_item", {
    agentId,
    recipeId: "phase6-field-blade",
    recoveryCode: recovery,
    idempotencyKey: `phase6-real-${nonce}-craft-run-${binding.runIndex}`,
  });
  annotateRun(crafted.trace, binding);
}

async function main(options: Phase6TenRunRealOptions): Promise<void> {
  const baseUrl = options.serverBase
    || mcpHttpEndpoint(process.env.AGENT_WORLD_SERVER || "http://127.0.0.1:8787").baseUrl;
  const nonce = Date.now().toString(36);
  const registered = await callTool(baseUrl, "obsidian_epoch.register_explorer", {
    idempotencyKey: `phase6-real-${nonce}-register`,
  });
  let agentId = issuedAgentId(registered.result, "register_explorer");
  const explorerId = registeredExplorerId(registered.result);
  let recovery = recoveryCode(registered.result, "register_explorer");

  const experiment = await callTool(baseUrl, "obsidian_epoch.begin_phase6_experiment", {
    commandId: `phase6-real-${nonce}-experiment`,
    identity: { identityId: agentId },
    explorer: { explorerId, displayName: "phase6-real-acceptance" },
  });
  const experimentId = fieldString(experiment.result, "experimentId", "begin_phase6_experiment");

  for (let index = 0; index < SCENARIOS.length; index += 1) {
    const current = await maybeReincarnate(baseUrl, agentId, recovery, nonce, index + 1);
    agentId = current.agentId;
    recovery = current.recovery;
    const completedBinding = await runScenario(
      baseUrl,
      SCENARIOS[index],
      index + 1,
      experimentId,
      agentId,
      explorerId,
      recovery,
      nonce,
    );
    if (index === 8) {
      await runPhase6CommerceAndCraft(baseUrl, agentId, recovery, completedBinding, nonce);
    }
  }
}

async function bootstrap(): Promise<void> {
  let options: Phase6TenRunRealOptions | undefined;
  try {
    options = parseArguments(process.argv.slice(2));
    if (options.help) {
      process.stdout.write(`${usage()}\n`);
      return;
    }
    await main(options);
    emitTrace(options.outputPath);
  } catch (error: unknown) {
    if (options) {
      try {
        emitTrace(options.outputPath);
      } catch {
        // The primary failure code remains the only public diagnostic.
      }
    }
    process.stderr.write(`phase6-ten-run-real: execution failed (${safeErrorCode(error)})\n`);
    process.exitCode = 1;
  }
}

void bootstrap();
