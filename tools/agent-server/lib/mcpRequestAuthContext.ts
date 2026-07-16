import { AsyncLocalStorage } from "node:async_hooks";

export type McpRequestAuthContext =
  | { readonly kind: "bootstrap" }
  | {
    readonly kind: "player";
    readonly explorerId: string;
    readonly tokenId: string;
  };

const mcpRequestAuthStorage = new AsyncLocalStorage<McpRequestAuthContext>();

export function currentMcpRequestAuthContext(): McpRequestAuthContext | undefined {
  return mcpRequestAuthStorage.getStore();
}

export function runWithMcpRequestAuthContext<TResult>(
  context: McpRequestAuthContext,
  run: () => TResult,
): TResult {
  return mcpRequestAuthStorage.run(context, run);
}
