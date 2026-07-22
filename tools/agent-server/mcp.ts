import readline from "node:readline";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { isDirectEntrypoint } from "./lib/cliEntrypoint.ts";
import { createJourneyRunReceiptSqliteStore } from "./lib/epoch/journeyRunReceiptStore.ts";
import { createPhase6CommittedResultSqliteStore } from "./lib/epoch/phase6CommittedResultStore.ts";
import { createPhase6ExperimentSqliteStore } from "./lib/epoch/phase6ExperimentStore.ts";
import { createPhase6JourneyContextSqliteStore } from "./lib/epoch/phase6JourneyContextStore.ts";
import { createPhase6RagTraceStore } from "./lib/epoch/phase6RagTraceStore.ts";
import { createAgentWorldMcpRuntime, createAgentWorldRemoteMcpRuntime } from "./lib/mcpTools.ts";
import { handleMcpJsonRpcMessage } from "./lib/mcpJsonRpc.ts";
import { createMcpServerRequestManager, type McpServerRequestManager } from "./lib/mcpServerRequestManager.ts";
import { createMcpSamplingClient, type McpSamplingClient } from "./lib/mcpSampling.ts";
import { createMcpSession } from "./lib/mcpSession.ts";
import { createMcpStdioTransport } from "./lib/mcpStdioTransport.ts";
import { applyMcpToolAllowlist } from "./lib/mcpToolAllowlist.ts";

function createLocalMcpRuntime() {
  const sqlitePath = process.env.AGENT_SERVER_SQLITE_PATH
    || fileURLToPath(new URL("./data/agent-world.sqlite", import.meta.url));
  const db = new DatabaseSync(sqlitePath);
  const journeyInstanceId = randomUUID().replaceAll("-", "").slice(0, 16);
  let journeySequence = 0;

  return createAgentWorldMcpRuntime({
    sqlitePath,
    journey: {
      idFactory: (kind: "journey" | "event") =>
        `${kind}_${journeyInstanceId}_${String(++journeySequence).padStart(8, "0")}`,
    },
    epoch: {
      phase6RunAssemblyRepository: createJourneyRunReceiptSqliteStore(db),
      phase6JourneyContextStore: createPhase6JourneyContextSqliteStore(db),
      phase6ExperimentStore: createPhase6ExperimentSqliteStore(db),
      phase6CommittedResultStore: createPhase6CommittedResultSqliteStore(db),
      phase6RagTraceStore: createPhase6RagTraceStore(db),
    },
  });
}

const baseMcp = process.env.AGENT_WORLD_SERVER
  ? createAgentWorldRemoteMcpRuntime({ serverBase: process.env.AGENT_WORLD_SERVER })
  : createLocalMcpRuntime();
const mcp = applyMcpToolAllowlist(baseMcp, process.env.PHASE6_MCP_TOOL_ALLOWLIST);

export async function handleJsonRpcMessage(message: Record<string, unknown>) {
  return handleMcpJsonRpcMessage(mcp, message);
}

export function createStdioMcpConnection() {
  const session = createMcpSession({
    sessionId: `stdio_${randomUUID()}`,
    transport: "stdio",
  });
  let requestManager: McpServerRequestManager | undefined;
  let sampling: McpSamplingClient | undefined;
  const transport = createMcpStdioTransport({
    writer: process.stdout,
    onResponse: (message) => { requestManager?.handleResponse(message); },
    onMessage: (message) => handleMcpJsonRpcMessage(mcp, message, {
      session,
      sampling,
      notify: (notification) => transport.send(notification),
    }),
  });
  requestManager = createMcpServerRequestManager({
    send: (message) => transport.send(message),
  });
  sampling = createMcpSamplingClient({ session, requestManager });
  return { requestManager, sampling, session, transport };
}

if (isDirectEntrypoint(import.meta.url)) {
  const connection = createStdioMcpConnection();
  const lines = readline.createInterface({
    input: process.stdin,
    crlfDelay: Infinity,
  });

  lines.on("line", (line) => connection.transport.acceptLine(line));
  lines.on("close", () => {
    connection.requestManager.close();
    connection.session.close();
    void connection.transport.close();
  });
}
