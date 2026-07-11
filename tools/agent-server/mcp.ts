import readline from "node:readline";
import { pathToFileURL } from "node:url";
import { createAgentWorldMcpRuntime, createAgentWorldRemoteMcpRuntime } from "./lib/mcpTools.ts";
import { handleMcpJsonRpcMessage, mcpJsonRpcErrorResponse } from "./lib/mcpJsonRpc.ts";

const mcp = process.env.AGENT_WORLD_SERVER
  ? createAgentWorldRemoteMcpRuntime({ serverBase: process.env.AGENT_WORLD_SERVER })
  : createAgentWorldMcpRuntime();

export async function handleJsonRpcMessage(message: Record<string, unknown>) {
  return handleMcpJsonRpcMessage(mcp, message);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const lines = readline.createInterface({
    input: process.stdin,
    crlfDelay: Infinity,
  });

  lines.on("line", async (line) => {
    if (!line.trim()) return;
    let parsed;
    try {
      parsed = JSON.parse(line);
    } catch {
      process.stdout.write(`${JSON.stringify(mcpJsonRpcErrorResponse(null, -32700, "Parse error"))}\n`);
      return;
    }

    const result = await handleJsonRpcMessage(parsed);
    if (result) process.stdout.write(`${JSON.stringify(result)}\n`);
  });
}
