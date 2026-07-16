import readline from "node:readline";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { createAgentWorldMcpRuntime, createAgentWorldRemoteMcpRuntime } from "./lib/mcpTools.ts";
import { handleMcpJsonRpcMessage } from "./lib/mcpJsonRpc.ts";
import { createMcpServerRequestManager, type McpServerRequestManager } from "./lib/mcpServerRequestManager.ts";
import { createMcpSamplingClient, type McpSamplingClient } from "./lib/mcpSampling.ts";
import { createMcpSession } from "./lib/mcpSession.ts";
import { createMcpStdioTransport } from "./lib/mcpStdioTransport.ts";

const mcp = process.env.AGENT_WORLD_SERVER
  ? createAgentWorldRemoteMcpRuntime({ serverBase: process.env.AGENT_WORLD_SERVER })
  : createAgentWorldMcpRuntime();

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

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
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
