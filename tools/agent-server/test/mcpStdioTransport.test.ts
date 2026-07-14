import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyMcpStdioMessage,
  createMcpStdioTransport,
  type McpJsonRecord,
} from "../lib/mcpStdioTransport.ts";

class CapturingWriter {
  readonly lines: string[] = [];

  write(chunk: string, callback: (error?: Error | null) => void) {
    setImmediate(() => {
      this.lines.push(chunk);
      callback();
    });
    return true;
  }
}

async function flush() {
  await new Promise<void>((resolve) => setImmediate(resolve));
  await new Promise<void>((resolve) => setImmediate(resolve));
}

test("classifies request directions without assuming globally unique ids", () => {
  assert.equal(classifyMcpStdioMessage({ jsonrpc: "2.0", id: 1, method: "tools/list" }), "request");
  assert.equal(classifyMcpStdioMessage({ jsonrpc: "2.0", method: "notifications/initialized" }), "notification");
  assert.equal(classifyMcpStdioMessage({ jsonrpc: "2.0", id: 1, result: {} }), "response");
  assert.equal(classifyMcpStdioMessage({ jsonrpc: "2.0", id: 1, error: { code: -1 } }), "response");
});

test("routes responses immediately while concurrent client requests finish out of order", async () => {
  const writer = new CapturingWriter();
  const routed: McpJsonRecord[] = [];
  const resolvers = new Map<number, (value: McpJsonRecord) => void>();
  const transport = createMcpStdioTransport({
    writer,
    onResponse: (message) => routed.push(message),
    onMessage: (message) => new Promise((resolve) => {
      resolvers.set(Number(message.id), resolve);
    }),
  });

  transport.acceptLine(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call" }));
  transport.acceptLine(JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/call" }));
  transport.acceptLine(JSON.stringify({ jsonrpc: "2.0", id: 1, result: { selected: true } }));

  assert.equal(routed.length, 1);
  assert.deepEqual(routed[0]?.result, { selected: true });
  resolvers.get(2)?.({ jsonrpc: "2.0", id: 2, result: { order: 1 } });
  resolvers.get(1)?.({ jsonrpc: "2.0", id: 1, result: { order: 2 } });
  await flush();
  await transport.close();

  assert.equal(writer.lines.length, 2);
  assert.deepEqual(writer.lines.map((line) => JSON.parse(line).result.order), [1, 2]);
  assert.ok(writer.lines.every((line) => line.endsWith("\n") && line.trim().split("\n").length === 1));
});

test("returns parse and invalid request errors without stopping the reader", async () => {
  const writer = new CapturingWriter();
  const handled: McpJsonRecord[] = [];
  const transport = createMcpStdioTransport({
    writer,
    onResponse: () => undefined,
    onMessage: (message) => {
      handled.push(message);
      return { jsonrpc: "2.0", id: message.id, result: { ok: true } };
    },
  });

  transport.acceptLine("{broken");
  transport.acceptLine("[]");
  transport.acceptLine(JSON.stringify({ jsonrpc: "2.0", id: 3, method: "tools/list" }));
  await flush();
  await transport.close();

  assert.equal(handled.length, 1);
  assert.deepEqual(writer.lines.map((line) => JSON.parse(line).error?.code ?? 0), [-32700, -32600, 0]);
});
