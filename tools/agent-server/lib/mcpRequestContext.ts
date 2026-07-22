import { AsyncLocalStorage } from "node:async_hooks";
import type { McpSamplingClient } from "./mcpSampling.ts";

export type McpPartialPersistence = ((toolName: string, result: unknown) => Promise<void>) & {
  readonly runMutation?: <T>(operation: () => Promise<T> | T) => Promise<T>;
  readonly supportsPhase6CommittedResultAtomicWrite?: true;
};

export interface McpRequestContext {
  readonly activeClientRequest: true;
  readonly clientRequestId: unknown;
  readonly progressToken?: string | number;
  readonly notifyProgress?: (progress: number, message: string) => Promise<void>;
  readonly persistPartial?: McpPartialPersistence;
  readonly sampling?: McpSamplingClient;
}

const mcpRequestContextStorage = new AsyncLocalStorage<McpRequestContext>();
const MCP_RESULT_ALREADY_PERSISTED = Symbol("mcpResultAlreadyPersisted");

type McpPersistenceMarkedResult = {
  readonly [MCP_RESULT_ALREADY_PERSISTED]?: true;
};

export function markMcpResultAlreadyPersisted<TResult>(result: TResult): TResult {
  if (result && typeof result === "object") {
    Object.defineProperty(result, MCP_RESULT_ALREADY_PERSISTED, {
      value: true,
      enumerable: false,
    });
  }
  return result;
}

export function isMcpResultAlreadyPersisted(result: unknown): boolean {
  return Boolean(result)
    && typeof result === "object"
    && (result as McpPersistenceMarkedResult)[MCP_RESULT_ALREADY_PERSISTED] === true;
}

export function currentMcpRequestContext(): McpRequestContext | undefined {
  return mcpRequestContextStorage.getStore();
}

export function runWithMcpRequestContext<TResult>(
  context: McpRequestContext,
  run: () => TResult,
): TResult {
  return mcpRequestContextStorage.run(context, run);
}
