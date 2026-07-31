/**
 * Journey-related MCP tool handlers, extracted from mcpTools.ts.
 *
 * `registerJourneyHandlers` adds all journey tool entries to the shared
 * handler Map.  Complex lifecycle helpers (start, commit, status, recall)
 * and compact-transport wrappers are pre-bound in the parent scope and
 * passed via the `helpers` parameter so that the closure-scoped Phase 6
 * / persistence logic stays co-located with the rest of
 * `createAgentWorldMcpRuntime`.
 */

type AnyRecord = Record<string, unknown>;

// ── Journey tool names ──────────────────────────────────────────────

export const JOURNEY_TOOL_NAMES: readonly string[] = [
  "obsidian_epoch.prepare_journey",
  "obsidian_epoch.start_journey",
  "obsidian_epoch.start_journey_compact",
  "obsidian_epoch.propose_journey_step",
  "obsidian_epoch.propose_journey_step_compact",
  "obsidian_epoch.commit_journey_action",
  "obsidian_epoch.commit_journey_action_compact",
  "obsidian_epoch.journey_status",
  "obsidian_epoch.journey_status_compact",
  "obsidian_epoch.recall_journey",
  "obsidian_epoch.journey_album",
  "obsidian_epoch.agent_memory",
  "obsidian_epoch.personal_migration_summary",
  "obsidian_epoch.confirm_personality_drift",
];

// ── Helper interface ────────────────────────────────────────────────

/** Pre-bound handler / transport functions provided by the parent scope. */
export interface JourneyHandlerHelpers {
  readonly startJourneyWithSampling: (args: AnyRecord) => Promise<unknown>;
  readonly compactJourneyStartForTransport: (result: unknown) => unknown;
  readonly compactJourneyProposalForTransport: (result: unknown) => unknown;
  readonly commitJourneyActionWithPersistence: (
    args: AnyRecord,
    options?: { readonly externalTransport?: boolean },
  ) => Promise<unknown>;
  readonly compactJourneyCommitForTransport: (result: unknown) => unknown;
  readonly journeyStatusWithFinalVerification: (args: AnyRecord) => Promise<unknown>;
  readonly compactJourneyStatusForTransport: (result: unknown) => unknown;
  readonly recallJourneyHandler: (args: AnyRecord) => Promise<unknown>;
}

// ── Minimal runtime interface for the simple delegates ──────────────

interface JourneyRuntime {
  epochPrepareJourney(args: AnyRecord): unknown;
  epochProposeJourneyStep(args: AnyRecord): unknown;
  epochJourneyAlbum(args: AnyRecord): unknown;
  epochAgentMemory(args: AnyRecord): unknown;
  epochPersonalMigrationSummary(args: AnyRecord): unknown;
  epochConfirmPersonalityDrift(args: AnyRecord): unknown;
}

// ── Registration ────────────────────────────────────────────────────

export function registerJourneyHandlers(
  handlers: Map<string, (args: AnyRecord) => unknown>,
  runtime: JourneyRuntime,
  helpers: JourneyHandlerHelpers,
): void {
  // Simple delegates — just forward to runtime.
  handlers.set(
    "obsidian_epoch.prepare_journey",
    (args) => runtime.epochPrepareJourney(args),
  );
  handlers.set(
    "obsidian_epoch.propose_journey_step",
    (args) => runtime.epochProposeJourneyStep(args),
  );
  handlers.set(
    "obsidian_epoch.journey_album",
    (args) => runtime.epochJourneyAlbum(args),
  );
  handlers.set(
    "obsidian_epoch.agent_memory",
    (args) => runtime.epochAgentMemory(args),
  );
  handlers.set(
    "obsidian_epoch.personal_migration_summary",
    (args) => runtime.epochPersonalMigrationSummary(args),
  );
  handlers.set(
    "obsidian_epoch.confirm_personality_drift",
    (args) => runtime.epochConfirmPersonalityDrift(args),
  );

  // Start journey (full + compact).
  handlers.set("obsidian_epoch.start_journey", helpers.startJourneyWithSampling);
  handlers.set(
    "obsidian_epoch.start_journey_compact",
    async (args) => helpers.compactJourneyStartForTransport(
      await helpers.startJourneyWithSampling(args),
    ),
  );

  // Propose journey step (compact variant wraps the runtime delegate).
  handlers.set(
    "obsidian_epoch.propose_journey_step_compact",
    (args) => helpers.compactJourneyProposalForTransport(
      runtime.epochProposeJourneyStep(args),
    ),
  );

  // Commit journey action (full + compact).
  handlers.set(
    "obsidian_epoch.commit_journey_action",
    (args) => helpers.commitJourneyActionWithPersistence(args, { externalTransport: true }),
  );
  handlers.set(
    "obsidian_epoch.commit_journey_action_compact",
    async (args) => helpers.compactJourneyCommitForTransport(
      await helpers.commitJourneyActionWithPersistence(args, { externalTransport: true }),
    ),
  );

  // Journey status (full + compact).
  handlers.set("obsidian_epoch.journey_status", helpers.journeyStatusWithFinalVerification);
  handlers.set(
    "obsidian_epoch.journey_status_compact",
    async (args) => helpers.compactJourneyStatusForTransport(
      await helpers.journeyStatusWithFinalVerification(args),
    ),
  );

  // Recall journey — Phase 6 persistence logic is pre-bound in the parent scope.
  handlers.set("obsidian_epoch.recall_journey", helpers.recallJourneyHandler);
}
