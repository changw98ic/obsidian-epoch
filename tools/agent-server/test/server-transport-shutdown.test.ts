import assert from "node:assert/strict";
import { once } from "node:events";
import { request, type IncomingMessage, type Server } from "node:http";
import test from "node:test";

import { createAgentHttpServer } from "../lib/httpServer.ts";
import { createAgentWorldRuntime } from "../lib/mcpTools.ts";

function listen(server: Server) {
  return new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
}

function closeWithTimeout(server: Server, timeoutMs = 1_000) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const closing = new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("server_close_timeout")), timeoutMs);
  });
  return Promise.race([closing, timeout]).catch(async (error: unknown) => {
    // A failed assertion must not leave the intentionally-open SSE request
    // holding the test process alive while the original close is still pending.
    server.closeAllConnections();
    await closing.catch(() => undefined);
    throw error;
  }).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

function serverPort(server: Server) {
  const address = server.address();
  assert.ok(address && typeof address === "object");
  return address.port;
}

async function initializeMcp(port: number) {
  const body = JSON.stringify({
    jsonrpc: "2.0",
    id: "direct-close-initialize",
    method: "initialize",
    params: {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "direct-close-test", version: "1" },
    },
  });
  return new Promise<{ readonly sessionId: string; readonly protocolVersion: string }>((resolve, reject) => {
    const client = request({
      hostname: "127.0.0.1",
      port,
      path: "/mcp",
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "content-length": Buffer.byteLength(body),
        connection: "close",
      },
    }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      response.once("error", reject);
      response.once("end", () => {
        try {
          assert.equal(response.statusCode, 200, Buffer.concat(chunks).toString("utf8"));
          const sessionId = response.headers["mcp-session-id"];
          const protocolVersion = response.headers["mcp-protocol-version"];
          if (typeof sessionId !== "string" || typeof protocolVersion !== "string") {
            throw new Error("mcp_initialize_headers_missing");
          }
          resolve({ sessionId, protocolVersion });
        } catch (error: unknown) {
          reject(error);
        }
      });
    });
    client.once("error", reject);
    client.end(body);
  });
}

function openMcpSse(port: number, sessionId: string, protocolVersion: string) {
  return new Promise<{ readonly client: ReturnType<typeof request>; readonly response: IncomingMessage }>((resolve, reject) => {
    const client = request({
      hostname: "127.0.0.1",
      port,
      path: "/mcp",
      method: "GET",
      headers: {
        accept: "text/event-stream",
        "mcp-session-id": sessionId,
        "mcp-protocol-version": protocolVersion,
        connection: "keep-alive",
      },
    }, (response) => {
      response.once("error", (error) => {
        if (!response.complete) reject(error);
      });
      response.once("data", () => {
        try {
          assert.equal(response.statusCode, 200);
          resolve({ client, response });
        } catch (error: unknown) {
          reject(error);
        }
      });
    });
    client.once("error", (error) => reject(error));
    client.end();
  });
}

test("direct http.Server.close disposes an active MCP SSE stream", async () => {
  const server = createAgentHttpServer({ runtime: createAgentWorldRuntime() });
  await listen(server);
  const { sessionId, protocolVersion } = await initializeMcp(serverPort(server));
  const stream = await openMcpSse(serverPort(server), sessionId, protocolVersion);
  const ended = once(stream.response, "end");

  try {
    await closeWithTimeout(server);
    await ended;
    assert.equal(stream.response.complete, true);
  } finally {
    stream.client.destroy();
    if (server.listening) {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  }
});
