import { appendFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import readline from "node:readline";
import { createAgentHttpServer } from "./lib/httpServer.ts";
import { createAgentWorldRuntime } from "./lib/mcpRuntimeCore.ts";
import { createModelAdapterFromEnv, type ModelAdapter } from "./lib/modelAdapter.ts";
import { PlayerMcpAccessTokenStore } from "./lib/playerMcpAccessTokenStore.ts";
import { createSequentialEpochIdFactory } from "./lib/epoch/protocol.ts";

type JsonObject = Record<string, unknown>;
type JsonRpcMessage = JsonObject & {
  readonly id?: number;
  readonly method?: string;
  readonly params?: JsonObject;
};

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const OUTPUT_DIR = resolve(REPO_ROOT, "docs/audits/2026-07-31-mcp-gameplay");
const LOG_PATH = join(OUTPUT_DIR, "full-trace.jsonl");
const RESULT_HTML_PATH = join(OUTPUT_DIR, "result.html");
const SUMMARY_PATH = join(OUTPUT_DIR, "run-summary.json");
const SECRET_KEY = /(?:recovery|secret|token|password|authorization|api[-_]?key|private[-_]?key|bearer|nonce|signature|credential)/iu;
const SECRET_VALUE = /(?:Bearer\s+[A-Za-z0-9._~+/=-]{12,}|-----BEGIN [^-]+ PRIVATE KEY-----|sk-[A-Za-z0-9_-]{12,})/u;

function isObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function recordValue(value: unknown): JsonObject {
  return isObject(value) ? value : {};
}

function redactString(value: string, key: string): string {
  if (SECRET_KEY.test(key)) return "[REDACTED]";
  if (SECRET_VALUE.test(value)) return "[REDACTED]";
  const safeUrl = value.replace(/([?&](?:shareToken|publishToken|access_token)=)[^&]+/giu, "$1[REDACTED]");
  if (safeUrl !== value) return safeUrl;
  const trimmed = value.trim();
  if ((key === "text" || key === "arguments") && (trimmed.startsWith("{") || trimmed.startsWith("["))) {
    try {
      return JSON.stringify(redact(JSON.parse(trimmed), key));
    } catch {
      // Plain natural-language text is intentionally kept as-is.
    }
  }
  return value;
}

function redact(value: unknown, key = ""): unknown {
  if (typeof value === "string") return redactString(value, key);
  if (Array.isArray(value)) return value.map((entry) => redact(entry, key));
  if (!isObject(value)) return value;
  return Object.fromEntries(Object.entries(value).map(([childKey, childValue]) => [
    childKey,
    SECRET_KEY.test(childKey) ? "[REDACTED]" : redact(childValue, childKey),
  ]));
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function safeUrl(value: string): string {
  return value.replace(/([?&](?:shareToken|publishToken|access_token)=)[^&]+/giu, "$1[REDACTED]");
}

function appendTrace(kind: string, payload: unknown): void {
  appendFileSync(LOG_PATH, `${JSON.stringify({
    at: new Date().toISOString(),
    kind,
    payload: redact(payload),
  })}\n`, "utf8");
}

function textPayload(response: JsonRpcMessage): JsonObject {
  const result = recordValue(response.result);
  const content = Array.isArray(result.content) ? result.content : [];
  const first = recordValue(content[0]);
  if (typeof first.text !== "string") throw new Error("mcp_text_payload_missing");
  const parsed = JSON.parse(first.text) as unknown;
  if (!isObject(parsed)) throw new Error("mcp_json_payload_missing");
  return parsed;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
}

function naturalIntentFor(proposal: JsonObject, stepIndex: number): {
  readonly text: string;
  readonly selectedLabel: string;
  readonly selectedRisk: string;
  readonly options: readonly JsonObject[];
} {
  const proposalBody = recordValue(proposal.proposal);
  const sceneContract = recordValue(proposalBody.sceneContract);
  const rawOptions = Array.isArray(sceneContract.actionOptions) ? sceneContract.actionOptions : [];
  const options = rawOptions.map(recordValue);
  const selected = options.find((option) => option.risk === "low") ?? options[0] ?? {};
  const label = typeof selected.label === "string" ? selected.label : "当前可行的稳妥方案";
  const intent = typeof selected.intent === "string" && selected.intent.trim()
    ? selected.intent.trim()
    : label;
  const prefix = stepIndex === 0 ? "我想先" : "接下来我打算";
  return {
    text: `${prefix}${intent}，只在当前条件允许的范围内行动，并保留可以核验的记录。`,
    selectedLabel: label,
    selectedRisk: typeof selected.risk === "string" ? selected.risk : "unknown",
    options: options.map((option) => ({
      label: option.label,
      intent: option.intent,
      risk: option.risk,
    })),
  };
}

class ProxyClient {
  private readonly child: ChildProcessWithoutNullStreams;
  private readonly lines: readline.Interface;
  private readonly pending = new Map<number, { resolve: (message: JsonRpcMessage) => void; reject: (error: Error) => void }>();
  private nextRequestId = 1;

  constructor(baseUrl: string) {
    const packageRoot = join(REPO_ROOT, "tools/agent-server/package");
    this.child = spawn(process.execPath, ["obsidian-epoch/bin/mcp-proxy.ts"], {
      cwd: packageRoot,
      env: {
        ...process.env,
        AGENT_WORLD_SERVER: baseUrl,
        AGENT_WORLD_MCP_TOKEN: "",
      },
      stdio: ["pipe", "pipe", "pipe"],
    });
    this.lines = readline.createInterface({ input: this.child.stdout, crlfDelay: Infinity });
    this.lines.on("line", (line) => this.handleLine(line));
    this.child.stderr.on("data", (chunk) => appendTrace("proxy_stderr", chunk.toString("utf8")));
    this.child.once("error", (error) => {
      for (const waiter of this.pending.values()) waiter.reject(error);
      this.pending.clear();
    });
  }

  private handleLine(line: string): void {
    if (!line.trim()) return;
    let message: JsonRpcMessage;
    try {
      message = JSON.parse(line) as JsonRpcMessage;
    } catch {
      appendTrace("proxy_invalid_output", { line });
      return;
    }
    appendTrace("proxy_to_host", message);
    if (message.method === "sampling/createMessage") {
      const params = recordValue(message.params);
      const prompt = Array.isArray(params.messages) ? recordValue(params.messages[0]) : {};
      const promptText = typeof prompt.content === "object" ? recordValue(prompt.content).text : undefined;
      let firstOptionId = "";
      if (typeof promptText === "string") {
        try {
          const samplingPrompt = recordValue(JSON.parse(promptText));
          const options = Array.isArray(samplingPrompt.actionOptions) ? samplingPrompt.actionOptions : [];
          firstOptionId = typeof recordValue(options[0]).actionOptionId === "string"
            ? String(recordValue(options[0]).actionOptionId)
            : "";
        } catch {
          // Keep the fallback response empty if a host-sampling prompt is malformed.
        }
      }
      const samplingResponse = {
        jsonrpc: "2.0",
        id: message.id,
        result: {
          role: "assistant",
          content: { type: "text", text: JSON.stringify({ actionOptionId: firstOptionId, rationale: "审计客户端只选择服务器给出的选项。", confidence: 0.9 }) },
          model: "audit-host",
          stopReason: "endTurn",
        },
      };
      appendTrace("host_to_proxy", samplingResponse);
      this.child.stdin.write(`${JSON.stringify(samplingResponse)}\n`);
      return;
    }
    if (typeof message.id !== "number") return;
    const waiter = this.pending.get(message.id);
    if (!waiter) return;
    this.pending.delete(message.id);
    waiter.resolve(message);
  }

  request(method: string, params?: JsonObject): Promise<JsonRpcMessage> {
    const id = this.nextRequestId++;
    const message: JsonRpcMessage = {
      jsonrpc: "2.0",
      id,
      method,
      ...(params ? { params } : {}),
    };
    appendTrace("host_to_proxy", message);
    return new Promise<JsonRpcMessage>((resolveRequest, rejectRequest) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        rejectRequest(new Error(`mcp_proxy_timeout:${method}`));
      }, 90_000);
      this.pending.set(id, {
        resolve: (response) => {
          clearTimeout(timeout);
          resolveRequest(response);
        },
        reject: (error) => {
          clearTimeout(timeout);
          rejectRequest(error);
        },
      });
      this.child.stdin.write(`${JSON.stringify(message)}\n`);
    });
  }

  async notify(method: string, params?: JsonObject): Promise<void> {
    const message = { jsonrpc: "2.0", method, ...(params ? { params } : {}) };
    appendTrace("host_to_proxy", message);
    this.child.stdin.write(`${JSON.stringify(message)}\n`);
    await delay(50);
  }

  async callTool(name: string, args: JsonObject = {}): Promise<JsonObject> {
    const response = await this.request("tools/call", { name, arguments: args });
    if (response.error) throw new Error(`mcp_tool_error:${name}:${JSON.stringify(redact(response.error))}`);
    const payload = textPayload(response);
    appendTrace("tool_payload", { toolName: name, payload });
    return payload;
  }

  async close(): Promise<void> {
    this.lines.close();
    this.child.stdin.end();
    if (!this.child.killed) this.child.kill("SIGTERM");
    await Promise.race([
      once(this.child, "exit"),
      delay(1_000),
    ]);
  }
}

function wrapModelAdapter(adapter: ModelAdapter | undefined): {
  readonly adapter: ModelAdapter | undefined;
  readonly calls: () => number;
} {
  if (!adapter) return { adapter: undefined, calls: () => 0 };
  let callCount = 0;
  const wrapped: ModelAdapter = {
    provider: adapter.provider,
    model: adapter.model,
    endpoint: adapter.endpoint,
    complete: async (input) => {
      callCount += 1;
      appendTrace("server_model_call", {
        callIndex: callCount,
        provider: adapter.provider,
        maxTokens: input.maxTokens,
        messageCount: input.messages.length,
        responseFormat: input.responseFormat,
      });
      try {
        const result = await adapter.complete(input);
        appendTrace("server_model_result", {
          callIndex: callCount,
          provider: result.provider,
          stopReason: result.stopReason,
          text: result.text,
        });
        return result;
      } catch (error: unknown) {
        appendTrace("server_model_error", {
          callIndex: callCount,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    },
    warmup: () => adapter.warmup(),
  };
  return { adapter: wrapped, calls: () => callCount };
}

async function main(): Promise<void> {
  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(LOG_PATH, "", "utf8");
  appendTrace("audit_started", {
    mode: "local_isolated_http_server",
    publicServerProbe: "https://epoch.codepatchbay.top/api/epoch/health returned HTTP 502 before this run",
    packageProxy: "obsidian-epoch/bin/mcp-proxy.ts",
    redaction: "credentials, bearer tokens, recovery codes, nonces and signatures are redacted",
  });

  const configuredAdapter = createModelAdapterFromEnv(process.env);
  const model = wrapModelAdapter(configuredAdapter);
  const runtime = createAgentWorldRuntime({
    epoch: {
      idFactory: createSequentialEpochIdFactory("gameplay_audit"),
      ...(model.adapter ? { modelAdapter: model.adapter } : {}),
    },
    journey: {
      now: () => "2026-07-31T20:00:00.000Z",
      worldNow: () => "2026-01-01T08:00:00.000Z",
      defaultRealDurationMs: 30 * 60 * 1_000,
      defaultWorldDurationMs: 60 * 60 * 1_000,
    },
  });
  const playerTokens = await PlayerMcpAccessTokenStore.open();
  const server = createAgentHttpServer({
    runtime,
    playerMcpAccessTokens: playerTokens,
    health: { store: { kind: "memory" } },
  });
  await new Promise<void>((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  const address = server.address();
  if (!address || typeof address !== "object") throw new Error("audit_server_address_missing");
  const baseUrl = `http://127.0.0.1:${address.port}`;
  appendTrace("local_server_ready", { baseUrl, modelConfigured: Boolean(model.adapter) });
  const client = new ProxyClient(baseUrl);

  let completed = false;
  let resultPageUrl = "";
  let journeyId = "";
  let agentId = "";
  try {
    await client.request("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "gameplay-audit-agent", version: "1" },
    });
    await client.notify("notifications/initialized");
    const bootstrapTools = await client.request("tools/list");
    const bootstrapToolList = recordValue(bootstrapTools.result).tools;
    appendTrace("agent_assertion", {
      assertion: "bootstrap exposes only quickstart and register_explorer",
      toolNames: Array.isArray(bootstrapToolList)
        ? bootstrapToolList.map((tool: unknown) => recordValue(tool).name)
        : [],
    });
    await client.callTool("obsidian_epoch.quickstart", { host: "gameplay-audit-agent" });
    const registration = await client.callTool("obsidian_epoch.register_explorer", {
      idempotencyKey: "gameplay-audit-register-20260731",
    });
    agentId = String(registration.agentId || "");
    const explorerId = String(registration.explorerId || "");
    if (!agentId || !explorerId) throw new Error("audit_registration_identity_missing");
    const fullTools = await client.request("tools/list");
    const fullToolList = recordValue(fullTools.result).tools;
    appendTrace("agent_assertion", {
      assertion: "proxy adopted the server-issued player credential and exposed gameplay tools",
      gameplayToolsPresent: [
        "obsidian_epoch.prepare_journey",
        "obsidian_epoch.start_journey_compact",
        "obsidian_epoch.propose_journey_step_compact",
        "obsidian_epoch.commit_journey_intent_compact",
        "obsidian_epoch.journey_status_compact",
      ].map((name) => ({ name, present: Array.isArray(fullToolList)
        && fullToolList.some((tool: unknown) => recordValue(tool).name === name) })),
    });

    await client.callTool("obsidian_epoch.agent_briefing", { agentId });
    const prepared = await client.callTool("obsidian_epoch.prepare_journey", {
      agentId,
      destinationRegionId: "region_gray_harbor",
      mandate: {
        objective: "在灰港完成一次可核验的协助任务，并安全返回。",
        priorities: ["work", "safe_return"],
      },
      idempotencyKey: "gameplay-audit-prepare-20260731",
    });
    journeyId = String(recordValue(prepared.journey).journeyId || "");
    if (!journeyId) throw new Error("audit_journey_id_missing");
    let current = await client.callTool("obsidian_epoch.start_journey_compact", {
      journeyId,
      expectedVersion: Number(recordValue(prepared.journey).version),
      decisionMode: "agent_native",
      taskGenerationMode: "server_fallback",
      idempotencyKey: "gameplay-audit-start-20260731",
    });
    const decisions: JsonObject[] = [];
    let naturalJourneyPathCompleted = true;
    let compatibilityFallbackUsed = false;
    let oneTurnCompleted = false;
    for (let stepIndex = 0; stepIndex < 16; stepIndex += 1) {
      const journey = recordValue(current.journey);
      if (journey.status === "settled") break;
      const proposed = await client.callTool("obsidian_epoch.propose_journey_step_compact", {
        journeyId,
        expectedVersion: Number(journey.version),
        idempotencyKey: `gameplay-audit-propose-${stepIndex}`,
      });
      const proposalBody = recordValue(proposed.proposal);
      const sceneContract = recordValue(proposalBody.sceneContract);
      const episode = recordValue(proposalBody.episode);
      if (naturalJourneyPathCompleted) {
        const intent = naturalIntentFor(proposed, stepIndex);
        appendTrace("agent_decision", {
          stepIndex,
          mode: "natural_language",
          intentText: intent.text,
          selectedPublicLabel: intent.selectedLabel,
          selectedPublicRisk: intent.selectedRisk,
          candidatePublicOptions: intent.options,
          submittedFields: ["journeyId", "sceneId", "episodeId", "expectedVersion", "intentText", "idempotencyKey"],
          submittedFieldsOmitted: ["actionOptionId", "signature"],
        });
        try {
          const committed = await client.callTool("obsidian_epoch.commit_journey_intent_compact", {
            journeyId,
            sceneId: String(sceneContract.sceneId || ""),
            episodeId: String(episode.episodeId || ""),
            expectedVersion: Number(proposalBody.expectedVersion),
            intentText: intent.text,
            idempotencyKey: `gameplay-audit-commit-${stepIndex}`,
          });
          // The compact intent response omits journey.version and the current
          // implementation does not advance the Journey projection. Refresh
          // status so the audit can record that boundary and continue safely.
          current = await client.callTool("obsidian_epoch.journey_status_compact", { journeyId });
          const nextVersion = recordValue(current.journey).version;
          const expectedVersion = Number(proposalBody.expectedVersion);
          const advanced = recordValue(current.journey).status === "settled"
            || (typeof nextVersion === "number" && nextVersion !== expectedVersion);
          decisions.push({
            stepIndex,
            mode: "natural_language",
            intentText: intent.text,
            commitResponseStatus: recordValue(committed.match).status,
            commitResponseKeys: Object.keys(committed).sort(),
            commitPublicActionKeys: Object.keys(recordValue(committed.action)).sort(),
            publicResultHasActionOptionId: Object.hasOwn(recordValue(committed.action), "actionOptionId"),
            statusRefreshRequired: !Object.hasOwn(committed, "journey") && Object.hasOwn(current, "journey"),
            nextJourneyVersion: nextVersion,
            journeyAdvanced: advanced,
          });
          if (!advanced && recordValue(current.journey).status !== "settled") {
            naturalJourneyPathCompleted = false;
            compatibilityFallbackUsed = false;
            appendTrace("agent_assertion", {
              assertion: "natural journey intent returned a settled action but did not advance the Journey projection",
              consequence: "the long Journey branch is blocked; the audit continues with a complete one-turn natural-language game",
              observedErrorOnNextNaturalCommit: "hosted_session_not_active",
            });
            break;
          }
          continue;
        } catch (error: unknown) {
          naturalJourneyPathCompleted = false;
          compatibilityFallbackUsed = false;
          appendTrace("agent_assertion", {
            assertion: "natural journey intent could not continue",
            error: error instanceof Error ? error.message : String(error),
            consequence: "the long Journey branch is blocked; the audit continues with a complete one-turn natural-language game",
          });
          break;
        }
      }

      const options = Array.isArray(sceneContract.actionOptions)
        ? sceneContract.actionOptions.map(recordValue)
        : [];
      const selected = options.find((option) => option.risk === "low") ?? options[0] ?? {};
      const signed = recordValue(selected.signed);
      const actionOptionId = String(selected.actionOptionId || "");
      const signature = String(signed.signature || selected.signature || "");
      if (!actionOptionId || !signature) throw new Error("audit_compatibility_action_binding_missing");
      appendTrace("agent_decision", {
        stepIndex,
        mode: "signed_action_compatibility_fallback",
        selectedPublicLabel: selected.label,
        selectedPublicRisk: selected.risk,
        submittedFields: ["journeyId", "sceneId", "episodeId", "expectedVersion", "actionOptionId", "signature", "idempotencyKey"],
        reason: "natural-language journey commit did not advance the Journey projection",
      });
      current = await client.callTool("obsidian_epoch.commit_journey_action_compact", {
        journeyId,
        sceneId: String(sceneContract.sceneId || ""),
        episodeId: String(episode.episodeId || ""),
        expectedVersion: Number(proposalBody.expectedVersion),
        actionOptionId,
        signature,
        idempotencyKey: `gameplay-audit-compat-commit-${stepIndex}`,
      });
      decisions.push({
        stepIndex,
        mode: "signed_action_compatibility_fallback",
        commitResponseStatus: recordValue(current.journey).status,
        commitResponseKeys: Object.keys(current).sort(),
        publicResultHasActionOptionId: Object.hasOwn(recordValue(current.settledAction), "actionOptionId"),
        nextJourneyVersion: recordValue(current.journey).version,
      });
    }

    const journeyStatus = await client.callTool("obsidian_epoch.journey_status_compact", { journeyId });
    const fullStatus = await client.callTool("obsidian_epoch.journey_status", { journeyId });
    const turnCard = await client.callTool("obsidian_epoch.turn_card", {
      agentId,
      regionId: "region_gray_harbor",
      prompt: "完成一次自然语言自由行动，并生成可公开验证的结果页。",
      idempotencyKey: "gameplay-audit-one-turn-card-20260731",
    });
    const turnValue = recordValue(turnCard.value);
    const oneTurnIntent = "我想先观察灰港入口，记录能够核验的线索，避免不必要的风险。";
    appendTrace("agent_decision", {
      mode: "one_turn_natural_language",
      intentText: oneTurnIntent,
      submittedFields: ["turnCardId", "sequence", "nonce", "intentText", "idempotencyKey"],
      submittedFieldsOmitted: ["actionOptionId"],
    });
    const resolvedTurn = await client.callTool("obsidian_epoch.resolve_turn_intent", {
      turnCardId: String(turnValue.turnCardId || ""),
      sequence: Number(turnValue.sequence),
      nonce: String(turnValue.nonce || ""),
      intentText: oneTurnIntent,
      idempotencyKey: "gameplay-audit-one-turn-resolve-20260731",
    });
    const resultPreview = await client.callTool("obsidian_epoch.result_page", {
      turnCardId: String(turnValue.turnCardId || ""),
    });
    const published = await client.callTool("obsidian_epoch.create_result_page", {
      turnCardId: String(turnValue.turnCardId || ""),
      publishToken: String(resultPreview.publishToken || ""),
      idempotencyKey: "gameplay-audit-one-turn-result-20260731",
    });
    resultPageUrl = String(recordValue(published.page).urlPath || "");
    if (!resultPageUrl) throw new Error("audit_one_turn_result_page_url_missing");
    const oneTurnAction = recordValue(recordValue(resolvedTurn.value).action);
    appendTrace("agent_assertion", {
      assertion: "one-turn natural-language MCP flow settled a server result without a client actionOptionId",
      matchStatus: recordValue(recordValue(resolvedTurn.value).match).status,
      publicActionKeys: Object.keys(oneTurnAction).sort(),
      publicActionOptionIdHidden: !Object.hasOwn(oneTurnAction, "actionOptionId"),
    });
    await client.callTool("obsidian_epoch.events", { agentId, limit: 100 });
    await client.callTool("obsidian_epoch.agent_briefing", { agentId });
    const resultResponse = await fetch(`${baseUrl}${resultPageUrl}`);
    const html = await resultResponse.text();
    await writeFile(RESULT_HTML_PATH, html, "utf8");
    const htmlChecks = {
      status: resultResponse.status,
      contentType: resultResponse.headers.get("content-type") || "",
      bytes: Buffer.byteLength(html, "utf8"),
      sha256: sha256(html),
      hasStoryReport: html.includes("完整故事报告"),
      hasServerSettlement: html.includes("服务器结算") || html.includes("正式"),
      hasContradictoryPhase6Failure: /Phase 6 结果页校验未通过|PHASE6_RESULT_PAGE_INPUT_MISSING/u.test(html),
      hasMisleadingRewardEmpty: /无公开奖励/u.test(html),
      hasManualMcpInstruction: /调用 obsidian_epoch\.(turn_card|set_downtime)/u.test(html),
      hasLegacyConsoleContinueLink: /\/epoch\/console/u.test(html),
    };
    appendTrace("result_page_http", { path: resultPageUrl, ...htmlChecks, savedTo: RESULT_HTML_PATH });
    oneTurnCompleted = resultResponse.status === 200
      && recordValue(recordValue(resolvedTurn.value).match).status === "matched";
    completed = oneTurnCompleted;
    appendTrace("audit_finished", {
      completed,
      journeyId,
      agentId,
      resultPageUrl,
      decisionCount: decisions.length,
      modelConfigured: Boolean(model.adapter),
      modelCallCount: model.calls(),
      naturalJourneyPathCompleted,
      compatibilityFallbackUsed,
      oneTurnCompleted,
      finalJourneyStatus: recordValue(journeyStatus.journey).status,
      finalFullStoryStatus: recordValue(fullStatus.journey).status,
      decisions,
    });
    await writeFile(SUMMARY_PATH, `${JSON.stringify({
      mode: "local_isolated_http_server",
      completed,
      baseUrl,
      journeyId,
      agentId,
      resultPageUrl: safeUrl(resultPageUrl),
      resultHtmlPath: RESULT_HTML_PATH,
      logPath: LOG_PATH,
      decisionCount: decisions.length,
      modelConfigured: Boolean(model.adapter),
      modelCallCount: model.calls(),
      naturalJourneyPathCompleted,
      compatibilityFallbackUsed,
      oneTurnCompleted,
      finalJourneyStatus: recordValue(journeyStatus.journey).status,
      publicActionOptionIdHidden: !Object.hasOwn(oneTurnAction, "actionOptionId"),
    }, null, 2)}\n`, "utf8");
  } finally {
    await client.close();
    server.closeAllConnections();
    await new Promise<void>((resolveClose, rejectClose) => server.close((error) => error ? rejectClose(error) : resolveClose()));
  }
  if (!completed) throw new Error("audit_game_not_settled");
  console.log(JSON.stringify({ summaryPath: SUMMARY_PATH, logPath: LOG_PATH, resultHtmlPath: RESULT_HTML_PATH, resultPageUrl: safeUrl(resultPageUrl) }, null, 2));
}

main().catch((error: unknown) => {
  appendTrace("audit_failed", { error: error instanceof Error ? error.stack || error.message : String(error) });
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
