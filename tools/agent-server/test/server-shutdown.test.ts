import assert from "node:assert/strict";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer, request } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

const graphAppRoot = path.resolve(import.meta.dirname, "../../graph-react-app");
const SERVER_START_TIMEOUT_MS = 15_000;
const SERVER_EXIT_TIMEOUT_MS = 8_000;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function reserveFreePort() {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const port = address.port;
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
  return port;
}

function childOutput(child: ChildProcessWithoutNullStreams) {
  const chunks: Buffer[] = [];
  child.stdout.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
  child.stderr.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
  return () => Buffer.concat(chunks).toString("utf8");
}

async function waitForHealthyServer(baseUrl: string, output: () => string) {
  const deadline = Date.now() + SERVER_START_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      const body = await response.json();
      if (response.status === 200 && body?.ok === true) return;
    } catch {
      // The child may still be loading TypeScript and persistence state.
    }
    await delay(50);
  }
  throw new Error(`agent server did not become healthy: ${output()}`);
}

function waitForExit(child: ChildProcessWithoutNullStreams) {
  return Promise.race([
    once(child, "exit").then(([code, signal]) => ({ code, signal })),
    new Promise<never>((_, reject) => setTimeout(
      () => reject(new Error("agent server did not exit before timeout")),
      SERVER_EXIT_TIMEOUT_MS,
    )),
  ]);
}

function startSlowRegistration(baseUrl: string, idempotencyKey: string) {
  const url = new URL("/api/epoch/pairing/register", baseUrl);
  const body = JSON.stringify({ idempotencyKey });
  const splitAt = Math.max(1, Math.floor(body.length / 2));
  let finishRequest: (() => void) | undefined;
  let abortRequest: (() => void) | undefined;
  const response = new Promise<{ readonly status: number; readonly body: string }>((resolve, reject) => {
    const client = request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": Buffer.byteLength(body),
      },
    }, (incoming) => {
      const chunks: Buffer[] = [];
      incoming.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      incoming.on("end", () => resolve({
        status: incoming.statusCode || 0,
        body: Buffer.concat(chunks).toString("utf8"),
      }));
    });
    client.on("error", reject);
    client.flushHeaders();
    client.write(body.slice(0, splitAt));
    finishRequest = () => {
      client.end(body.slice(splitAt));
    };
    abortRequest = () => client.destroy();
  });
  void response.catch(() => undefined);

  return {
    response,
    finish: () => {
      if (!finishRequest) throw new Error("slow registration request did not initialize");
      finishRequest();
      return response;
    },
    abort: () => abortRequest?.(),
  };
}

async function openMcpSseStream(baseUrl: string) {
  const initialized = await fetch(`${baseUrl}/mcp`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "shutdown-sse-initialize",
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "shutdown-sse-test", version: "1" },
      },
    }),
  });
  assert.equal(initialized.status, 200, await initialized.text());
  const sessionId = initialized.headers.get("mcp-session-id");
  const protocolVersion = initialized.headers.get("mcp-protocol-version");
  assert.ok(sessionId);
  assert.ok(protocolVersion);

  const url = new URL("/mcp", baseUrl);
  return new Promise<{ readonly close: () => void }>((resolve, reject) => {
    let opened = false;
    const stream = request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: "GET",
      headers: {
        accept: "text/event-stream",
        "mcp-session-id": sessionId,
        "mcp-protocol-version": protocolVersion,
      },
    }, (response) => {
      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`mcp_sse_status_${response.statusCode}`));
        return;
      }
      response.once("data", () => {
        opened = true;
        resolve({ close: () => stream.destroy() });
      });
      response.on("error", (error) => {
        if (!opened) reject(error);
      });
    });
    stream.once("error", (error) => {
      if (!opened) reject(error);
    });
    stream.end();
  });
}

async function startServer(shutdownTimeoutMs: number) {
  const dataDir = await mkdtemp(path.join(tmpdir(), "epoch-server-shutdown-"));
  const port = await reserveFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ["--import", "tsx", "../agent-server/server.ts"], {
    cwd: graphAppRoot,
    stdio: ["pipe", "pipe", "pipe"],
    env: {
      ...process.env,
      NODE_ENV: "development",
      AGENT_SERVER_HOST: "127.0.0.1",
      AGENT_SERVER_PORT: String(port),
      AGENT_SERVER_STORE: "sqlite",
      AGENT_SERVER_DATA_DIR: dataDir,
      AGENT_SERVER_SQLITE_PATH: path.join(dataDir, "agent-server.sqlite"),
      AGENT_SERVER_MAINTENANCE_ENABLED: "1",
      AGENT_SERVER_MAINTENANCE_INTERVAL_MS: "60000",
      AGENT_SERVER_MAINTENANCE_RUN_ON_START: "0",
      AGENT_SERVER_SHUTDOWN_TIMEOUT_MS: String(shutdownTimeoutMs),
    },
  });
  const output = childOutput(child);
  await waitForHealthyServer(baseUrl, output);
  return { baseUrl, child, dataDir, output };
}

async function forceStop(child: ChildProcessWithoutNullStreams) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill("SIGKILL");
  await once(child, "exit");
}

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  test(`agent server drains an active request and stops maintenance on ${signal}`, async () => {
    const running = await startServer(3_000);
    const slowRequest = startSlowRegistration(running.baseUrl, `shutdown-drain-${signal.toLowerCase()}`);
    const exit = waitForExit(running.child);
    try {
      await delay(100);
      assert.equal(running.child.kill(signal), true);
      await delay(100);
      const response = await slowRequest.finish();
      assert.equal(response.status, 201, response.body);

      const result = await exit;
      assert.equal(result.code, 0, running.output());
      assert.equal(result.signal, null, running.output());
      assert.match(running.output(), /epoch maintenance scheduler enabled/);
      assert.match(running.output(), new RegExp(`received ${signal}; draining connections for up to 3000ms`));
      assert.match(running.output(), new RegExp(`stopped after ${signal}`));
    } finally {
      slowRequest.abort();
      await forceStop(running.child);
      await rm(running.dataDir, { recursive: true, force: true });
    }
  });
}

test("agent server closes live MCP SSE sessions before graceful SIGTERM drain", async () => {
  const running = await startServer(1_000);
  let stream: Awaited<ReturnType<typeof openMcpSseStream>> | undefined;
  const exit = waitForExit(running.child);
  try {
    stream = await openMcpSseStream(running.baseUrl);
    assert.equal(running.child.kill("SIGTERM"), true);

    const result = await exit;
    assert.equal(result.code, 0, running.output());
    assert.equal(result.signal, null, running.output());
    assert.match(running.output(), /stopped after SIGTERM/);
    assert.doesNotMatch(running.output(), /graceful shutdown timed out/);
  } finally {
    stream?.close();
    await forceStop(running.child);
    await rm(running.dataDir, { recursive: true, force: true });
  }
});

test("agent server forces a non-zero exit after the graceful shutdown timeout", async () => {
  const running = await startServer(1_000);
  const slowRequest = startSlowRegistration(running.baseUrl, "shutdown-timeout");
  const exit = waitForExit(running.child);
  const startedAt = Date.now();
  try {
    await delay(100);
    assert.equal(running.child.kill("SIGTERM"), true);
    const result = await exit;
    const elapsedMs = Date.now() - startedAt;

    assert.equal(result.code, 1, running.output());
    assert.equal(result.signal, null, running.output());
    assert.ok(elapsedMs >= 800, `shutdown fallback fired too early after ${elapsedMs}ms`);
    assert.match(running.output(), /graceful shutdown timed out after 1000ms/);
  } finally {
    slowRequest.abort();
    await slowRequest.response.catch(() => undefined);
    await forceStop(running.child);
    await rm(running.dataDir, { recursive: true, force: true });
  }
});
