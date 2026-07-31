/**
 * World / simulation-related MCP tool handlers, extracted from mcpTools.ts.
 *
 * `registerWorldHandlers` adds all world/simulation tool entries to the
 * shared handler Map.  The RAG search helpers and Phase 6 trace capturer
 * are pre-bound in the parent scope and passed via the `helpers` parameter
 * so that the closure-scoped Phase 6 / persistence logic stays co-located
 * with the rest of `createAgentWorldMcpRuntime`.
 */

import { recordValue } from "./mcpToolsHelpers.ts";

type AnyRecord = Record<string, unknown>;

// ── World tool names ─────────────────────────────────────────────

export const WORLD_TOOL_NAMES: readonly string[] = [
  "obsidian_epoch.command",
  "obsidian_epoch.world_snapshot",
  "obsidian_epoch.player_panel",
  "obsidian_epoch.ten_run_audit",
  "obsidian_epoch.world_health",
  "obsidian_epoch.world_migrate",
  "obsidian_epoch.world_overview",
  "obsidian_epoch.world_clock",
  "obsidian_epoch.world_state",
  "obsidian_epoch.world_content",
  "obsidian_epoch.world_knowledge",
  "obsidian_epoch.world_memory",
  "obsidian_epoch.advance_world_clock",
  "obsidian_epoch.migrate_world_content",
];

// ── Minimal runtime interface for the world delegates ────────────

interface WorldRuntime {
  infiniteWorldCommand(args: AnyRecord): unknown;
  infiniteWorldSnapshot(args: AnyRecord): unknown;
  infiniteWorldPlayerPanel(args: AnyRecord): unknown;
  infiniteWorldTenRunAudit(args: AnyRecord): unknown;
  infiniteWorldHealth(args: AnyRecord): unknown;
  infiniteWorldMigrate(args: AnyRecord): unknown;
  epochWorldOverview(args: AnyRecord): unknown;
  epochWorldClock(args: AnyRecord): unknown;
  epochWorldState(args: AnyRecord): unknown;
  epochWorldContent(args: AnyRecord): unknown;
  epochAdvanceWorldClock(args: AnyRecord): unknown;
  epochMigrateWorldContent(args: AnyRecord): unknown;
}

// ── Helper interface ────────────────────────────────────────────

/** Pre-bound RAG search and Phase 6 trace functions provided by the parent scope. */
export interface WorldHandlerHelpers {
  readonly worldKnowledgeSearch?: (input: AnyRecord) => Promise<unknown>;
  readonly worldMemorySearch?: (input: AnyRecord) => Promise<unknown>;
  readonly capturePhase6RagTraceForResult: (
    source: "world_knowledge" | "world_memory",
    args: AnyRecord,
    resultValue: unknown,
  ) => Promise<unknown>;
}

// ── Registration ────────────────────────────────────────────────

export function registerWorldHandlers(
  handlers: Map<string, (args: AnyRecord) => unknown>,
  runtime: WorldRuntime,
  helpers: WorldHandlerHelpers,
): void {
  // Infinite world simulation tools.
  handlers.set("obsidian_epoch.command", (args) => runtime.infiniteWorldCommand(args));
  handlers.set("obsidian_epoch.world_snapshot", (args) => runtime.infiniteWorldSnapshot(args));
  handlers.set("obsidian_epoch.player_panel", (args) => runtime.infiniteWorldPlayerPanel(args));
  handlers.set("obsidian_epoch.ten_run_audit", (args) => runtime.infiniteWorldTenRunAudit(args));
  handlers.set("obsidian_epoch.world_health", (args) => runtime.infiniteWorldHealth(args));
  handlers.set("obsidian_epoch.world_migrate", (args) => runtime.infiniteWorldMigrate(args));

  // World simulation / clock / content tools.
  handlers.set("obsidian_epoch.world_overview", (args) => runtime.epochWorldOverview(args));
  handlers.set("obsidian_epoch.world_clock", (args) => runtime.epochWorldClock(args));
  handlers.set("obsidian_epoch.world_state", (args) => runtime.epochWorldState(args));
  handlers.set("obsidian_epoch.world_content", (args) => runtime.epochWorldContent(args));

  // RAG knowledge/memory tools with Phase 6 trace capture.
  handlers.set("obsidian_epoch.world_knowledge", async (args) => {
    if (!helpers.worldKnowledgeSearch) throw new Error("world_knowledge_unavailable");
    const result = await helpers.worldKnowledgeSearch(args);
    const phase6RagTrace = await helpers.capturePhase6RagTraceForResult("world_knowledge", args, result);
    return phase6RagTrace ? { ...recordValue(result), phase6RagTrace } : result;
  });
  handlers.set("obsidian_epoch.world_memory", async (args) => {
    if (!helpers.worldMemorySearch) throw new Error("world_memory_unavailable");
    const result = await helpers.worldMemorySearch(args);
    const phase6RagTrace = await helpers.capturePhase6RagTraceForResult("world_memory", args, result);
    return phase6RagTrace ? { ...recordValue(result), phase6RagTrace } : result;
  });

  // Clock advance and content migration.
  handlers.set("obsidian_epoch.advance_world_clock", (args) => runtime.epochAdvanceWorldClock(args));
  handlers.set("obsidian_epoch.migrate_world_content", (args) => runtime.epochMigrateWorldContent(args));
}
