import { AsyncLocalStorage } from "node:async_hooks";
import type { McpSamplingClient } from "./mcpSampling.ts";

export interface McpRequestContext {
  readonly activeClientRequest: true;
  readonly clientRequestId: unknown;
  readonly progressToken?: string | number;
  readonly notifyProgress?: (progress: number, message: string) => Promise<void>;
  readonly persistPartial?: (toolName: string, result: unknown) => Promise<void>;
  readonly sampling?: McpSamplingClient;
}

const mcpRequestContextStorage = new AsyncLocalStorage<McpRequestContext>();

export function currentMcpRequestContext(): McpRequestContext | undefined {
  return mcpRequestContextStorage.getStore();
}

export function runWithMcpRequestContext<TResult>(
  context: McpRequestContext,
  run: () => TResult,
): TResult {
  return mcpRequestContextStorage.run(context, run);
}
