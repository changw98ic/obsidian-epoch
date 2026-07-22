import assert from "node:assert/strict";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import http from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import readline from "node:readline";
import test from "node:test";
import { fileURLToPath } from "node:url";

const workspaceRoot = fileURLToPath(new URL("../../..", import.meta.url));
const proxyPath = "tools/agent-server/package/obsidian-epoch/bin/mcp-proxy.ts";

function spawnProxy(serverBase: string, extraEnv: NodeJS.ProcessEnv = {}) {
  const child = spawn(process.execPath, [proxyPath], {
    cwd: workspaceRoot,
    stdio: ["pipe", "pipe", "pipe"],
    env: {
      ...process.env,
      AGENT_WORLD_SERVER: serverBase,
      AGENT_WORLD_MCP_TOKEN: "",
      ...extraEnv,
    },
  });
  const lines = readline.createInterface({ input: child.stdout, crlfDelay: Infinity });
  const stderr: Buffer[] = [];
  child.stderr.on("data", (chunk) => stderr.push(Buffer.from(chunk)));
  return { child, lines, stderr };
}

function request(
  child: ChildProcessWithoutNullStreams,
  lines: readline.Interface,
  stderr: readonly Buffer[],
  id: number,
  method: string,
  params?: Record<string, unknown>,
) {
  return new Promise<Record<string, any>>((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timeout);
      lines.off("line", onLine);
      child.off("exit", onExit);
    };
    const onLine = (line: string) => {
      cleanup();
      resolve(JSON.parse(line));
    };
    const onExit = (code: number | null, signal: NodeJS.Signals | null) => {
      cleanup();
      reject(new Error(`proxy_exited:${code ?? ""}:${signal ?? ""}:${Buffer.concat(stderr).toString("utf8")}`));
    };
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`proxy_timeout:${Buffer.concat(stderr).toString("utf8")}`));
    }, 10_000);
    lines.once("line", onLine);
    child.once("exit", onExit);
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, ...(params ? { params } : {}) })}\n`);
  });
}

async function stopProxy(child: ChildProcessWithoutNullStreams, lines: readline.Interface) {
  lines.close();
  child.stdin.destroy();
  if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
  if (child.exitCode === null && child.signalCode === null) {
    await Promise.race([once(child, "exit"), new Promise((resolve) => setTimeout(resolve, 1_000))]);
  }
}

function initializeResult() {
  return {
    jsonrpc: "2.0",
    id: 1,
    result: {
      protocolVersion: "2025-06-18",
      capabilities: {},
      serverInfo: { name: "transport-test", version: "1" },
    },
  };
}

test("package MCP proxy retries a dropped transport before receiving a response", async () => {
  let firstConnection = true;
  const server = http.createServer((incoming, response) => {
    incoming.resume();
    incoming.once("end", () => {
      response.writeHead(200, {
        "content-type": "application/json",
        "mcp-session-id": "transport-retry-session",
        "mcp-protocol-version": "2025-06-18",
      });
      response.end(JSON.stringify(initializeResult()));
    });
  });
  server.on("connection", (socket) => {
    if (!firstConnection) return;
    firstConnection = false;
    socket.destroy();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const proxy = spawnProxy(`http://127.0.0.1:${address.port}`);

  try {
    const initialized = await request(proxy.child, proxy.lines, proxy.stderr, 1, "initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "transport-retry-test", version: "1" },
    });
    assert.equal(initialized.error, undefined, initialized.error?.message);
    assert.equal(initialized.result.serverInfo.name, "transport-test");
  } finally {
    await stopProxy(proxy.child, proxy.lines);
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test("package MCP proxy bounds remote session cleanup on SIGTERM", async () => {
  const server = http.createServer((incoming, response) => {
    if (incoming.method === "DELETE") {
      incoming.resume();
      return;
    }
    incoming.resume();
    incoming.once("end", () => {
      response.writeHead(200, {
        "content-type": "application/json",
        "mcp-session-id": "transport-shutdown-session",
        "mcp-protocol-version": "2025-06-18",
      });
      response.end(JSON.stringify(initializeResult()));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const proxy = spawnProxy(`http://127.0.0.1:${address.port}`);

  try {
    const initialized = await request(proxy.child, proxy.lines, proxy.stderr, 1, "initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "transport-shutdown-test", version: "1" },
    });
    assert.equal(initialized.error, undefined, initialized.error?.message);

    const startedAt = Date.now();
    proxy.child.kill("SIGTERM");
    const exited = await Promise.race([
      once(proxy.child, "exit").then(() => true),
      new Promise<false>((resolve) => setTimeout(() => resolve(false), 2_500)),
    ]);
    assert.equal(exited, true, "proxy must exit when remote DELETE never responds");
    assert.ok(Date.now() - startedAt < 2_500);
  } finally {
    await stopProxy(proxy.child, proxy.lines);
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test("package MCP proxy injects a private recovery code only into owner-auth tools", async () => {
  const root = mkdtempSync(join(tmpdir(), "phase6-proxy-recovery-"));
  const recoveryCodePath = join(root, "recovery-code");
  const recoveryCode = "private-recovery-code-never-returned";
  writeFileSync(recoveryCodePath, recoveryCode, { mode: 0o600 });
  const received: Record<string, any>[] = [];
  const server = http.createServer((incoming, response) => {
    let text = "";
    incoming.setEncoding("utf8");
    incoming.on("data", (chunk: string) => { text += chunk; });
    incoming.once("end", () => {
      const body = JSON.parse(text) as Record<string, any>;
      received.push(body);
      response.writeHead(200, {
        "content-type": "application/json",
        "mcp-session-id": "private-recovery-session",
        "mcp-protocol-version": "2025-06-18",
      });
      response.end(JSON.stringify(body.method === "initialize"
        ? initializeResult()
        : { jsonrpc: "2.0", id: body.id, result: { ok: true } }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const proxy = spawnProxy(`http://127.0.0.1:${address.port}`, {
    PHASE6_MCP_RECOVERY_CODE_FILE: recoveryCodePath,
  });

  try {
    await request(proxy.child, proxy.lines, proxy.stderr, 1, "initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "private-recovery-test", version: "1" },
    });
    const panel = await request(proxy.child, proxy.lines, proxy.stderr, 2, "tools/call", {
      name: "obsidian_epoch.player_panel",
      arguments: { agentId: "agent-test" },
    });
    const status = await request(proxy.child, proxy.lines, proxy.stderr, 3, "tools/call", {
      name: "obsidian_epoch.phase6_experiment_status",
      arguments: { experimentId: "experiment-test" },
    });

    assert.equal(received[1].params.arguments.recoveryCode, recoveryCode);
    assert.equal(Object.hasOwn(received[2].params.arguments, "recoveryCode"), false);
    assert.equal(JSON.stringify(panel).includes(recoveryCode), false);
    assert.equal(JSON.stringify(status).includes(recoveryCode), false);
  } finally {
    await stopProxy(proxy.child, proxy.lines);
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    rmSync(root, { recursive: true, force: true });
  }
});
