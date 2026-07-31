/**
 * Phase 6 experiment-related MCP tool handlers, extracted from mcpTools.ts.
 *
 * `registerPhase6Handlers` adds all Phase 6 tool entries to the shared
 * handler Map.  Compact-transport wrappers for run receipts and results
 * are pre-bound in the parent scope and passed via the `helpers` parameter
 * so that the shared `compactTransportArray` / `preserveCompactTransportEvents`
 * utilities stay co-located with the Journey compact helpers in mcpTools.ts.
 */

import {
  PHASE6_MCP_TOOL_PHASE6_RESULT,
  PHASE6_MCP_TOOL_RUN_RECEIPT,
} from "./epoch/phase6McpContractRules.ts";
import {
  PHASE6_EXPERIMENT_MCP_TOOL_BEGIN_EXPERIMENT,
  PHASE6_EXPERIMENT_MCP_TOOL_BEGIN_RUN,
  PHASE6_EXPERIMENT_MCP_TOOL_STATUS,
} from "./epoch/phase6ExperimentMcpContractRules.ts";
import {
  recordValue,
  optionalString,
} from "./mcpToolsHelpers.ts";

type AnyRecord = Record<string, unknown>;

// ── Phase 6 tool names ─────────────────────────────────────────────

export const PHASE6_TOOL_NAMES: readonly string[] = [
  "obsidian_epoch.result_page",
  PHASE6_EXPERIMENT_MCP_TOOL_BEGIN_EXPERIMENT,
  PHASE6_EXPERIMENT_MCP_TOOL_BEGIN_RUN,
  PHASE6_EXPERIMENT_MCP_TOOL_STATUS,
  PHASE6_MCP_TOOL_RUN_RECEIPT,
  PHASE6_MCP_TOOL_PHASE6_RESULT,
  "obsidian_epoch.run_receipt_compact",
  "obsidian_epoch.phase6_result_compact",
  "obsidian_epoch.create_result_page",
  "obsidian_epoch.revoke_result_page",
  "obsidian_epoch.delete_result_page",
];

// ── Minimal runtime interface for the Phase 6 delegates ────────────

interface Phase6Runtime {
  epochResultPage(args: AnyRecord): unknown;
  epochBeginPhase6Experiment(args: AnyRecord): unknown;
  epochBeginPhase6Run(args: AnyRecord): unknown;
  epochPhase6ExperimentStatus(args: AnyRecord): unknown;
  epochPhase6RunReceipt(args: AnyRecord): unknown;
  epochPhase6Result(args: AnyRecord): unknown;
  epochCreateResultPage(args: AnyRecord): unknown;
  epochRevokeResultPage(args: AnyRecord): unknown;
  epochDeleteResultPage(args: AnyRecord): unknown;
}

// ── Helper interface ────────────────────────────────────────────────

/** Pre-bound compact-transport functions provided by the parent scope. */
export interface Phase6HandlerHelpers {
  readonly compactPhase6RunReceiptForTransport: (result: unknown) => unknown;
  readonly compactPhase6ResultForTransport: (result: unknown) => unknown;
  readonly compactTransportArray: (value: unknown) => readonly unknown[];
  readonly preserveCompactTransportEvents: <T extends AnyRecord>(compact: T, result: unknown) => T;
}

// ── Compact-transport helper functions ──────────────────────────────

function compactPhase6Value(value: unknown): unknown {
  if (value === null || value === undefined || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  let serialized = "";
  try {
    serialized = JSON.stringify(value);
  } catch {
    return { omitted: true, reason: "non_serializable" };
  }
  if (serialized.length <= 512) return value;
  return { omitted: true, byteLength: serialized.length };
}

function compactPhase6EventIds(compactTransportArray: Phase6HandlerHelpers["compactTransportArray"], value: unknown) {
  const ids = compactTransportArray(value).filter((entry): entry is string => typeof entry === "string");
  return { count: ids.length, values: ids.slice(0, 16) };
}

function compactPhase6MetricMap(compactTransportArray: Phase6HandlerHelpers["compactTransportArray"], value: unknown) {
  return Object.fromEntries(
    Object.entries(recordValue(value)).map(([dimension, metricValue]) => {
      const metric = recordValue(metricValue);
      return [dimension, {
        value: metric.value,
        evidence: compactPhase6EventIds(compactTransportArray, metric.evidence),
      }];
    }),
  );
}

function compactPhase6ChangeSet(
  compactTransportArray: Phase6HandlerHelpers["compactTransportArray"],
  value: unknown,
) {
  const changeSet = recordValue(value);
  const changes = compactTransportArray(changeSet.changes);
  return {
    mode: changeSet.mode,
    noChangeReason: changeSet.noChangeReason,
    changeCount: changes.length,
    changes: changes.slice(0, 8).map((entry) => {
      const change = recordValue(entry);
      return {
        id: change.id,
        label: change.label,
        before: compactPhase6Value(change.before),
        after: compactPhase6Value(change.after),
        eventIds: compactPhase6EventIds(compactTransportArray, change.eventIds),
      };
    }),
    eventIds: compactPhase6EventIds(compactTransportArray, changeSet.eventIds),
  };
}

export function buildCompactPhase6RunReceiptForTransport(
  helpers: Pick<Phase6HandlerHelpers, "compactTransportArray" | "preserveCompactTransportEvents">,
): (result: unknown) => unknown {
  const { compactTransportArray, preserveCompactTransportEvents } = helpers;
  return (result: unknown) => {
    const value = recordValue(result);
    const receipt = recordValue(value.receipt);
    const snapshots = recordValue(receipt.snapshots);
    const beforeSnapshot = recordValue(snapshots.before);
    const afterSnapshot = recordValue(snapshots.after);
    const deltas = compactTransportArray(receipt.deltas);
    const rag = recordValue(receipt.rag);
    const claims = compactTransportArray(rag.claims);
    const ragDelta = recordValue(rag.delta);
    const ragEntries = compactTransportArray(ragDelta.entries);
    const eventIds = recordValue(receipt.eventIds);
    const outcome = recordValue(receipt.outcome);
    const targetKinds: Record<string, number> = {};
    deltas.forEach((entry) => {
      const kind = optionalString(recordValue(recordValue(entry).target).kind) || "unknown";
      targetKinds[kind] = (targetKinds[kind] || 0) + 1;
    });
    return preserveCompactTransportEvents({
      authority: "server_phase6_run_receipt",
      transportVersion: "phase6_run_receipt.compact.v1",
      verified: true,
      rulesetVersion: value.rulesetVersion,
      receipt: {
        receiptType: receipt.receiptType,
        version: receipt.version,
        authority: receipt.authority,
        receiptId: receipt.receiptId,
        runId: receipt.runId,
        journeyId: receipt.journeyId,
        agentId: receipt.agentId,
        explorerId: receipt.explorerId,
        experimentId: receipt.experimentId,
        runIndex: receipt.runIndex,
        seed: receipt.seed,
        rulesetVersion: receipt.rulesetVersion,
        catalogVersion: receipt.catalogVersion,
        codeVersion: receipt.codeVersion,
        scenarioMatrixVersion: receipt.scenarioMatrixVersion,
        settlementPolicyVersion: receipt.settlementPolicyVersion,
        generatedAt: receipt.generatedAt,
        startedAt: receipt.startedAt,
        settledAt: receipt.settledAt,
        world: receipt.world,
        snapshots: {
          before: { hash: beforeSnapshot.hash },
          after: { hash: afterSnapshot.hash },
        },
        noChangeReasons: receipt.noChangeReasons,
        deltas: {
          count: deltas.length,
          byTargetKind: targetKinds,
          entries: deltas.slice(0, 10).map((entry) => {
            const delta = recordValue(entry);
            const target = recordValue(delta.target);
            return {
              op: delta.op,
              target: { kind: target.kind, id: target.id },
              path: compactTransportArray(delta.path).slice(0, 12),
              before: compactPhase6Value(delta.before),
              after: compactPhase6Value(delta.after),
              amount: delta.amount,
              reason: delta.reason,
              eventIds: compactPhase6EventIds(compactTransportArray, delta.eventIds),
            };
          }),
        },
        score: compactPhase6MetricMap(compactTransportArray, receipt.score),
        suitability: compactPhase6MetricMap(compactTransportArray, receipt.suitability),
        rag: {
          queryHash: rag.queryHash,
          corpusHash: rag.corpusHash,
          claimCount: claims.length,
          claims: claims.slice(0, 12),
          importantMemoryCount: rag.importantMemoryCount,
          ordinaryNodePersistenceExpansion: rag.ordinaryNodePersistenceExpansion,
          ...(rag.dedupedRoutes !== undefined ? { dedupedRoutes: rag.dedupedRoutes } : {}),
          ...(rag.duplicateRoutes !== undefined ? { duplicateRoutes: rag.duplicateRoutes } : {}),
          delta: {
            count: ragEntries.length,
            entries: ragEntries.slice(0, 3).map((entry) => {
              const memory = recordValue(entry);
              return {
                type: memory.type,
                memoryId: memory.memoryId,
                importance: memory.importance,
                sourceEventIds: compactPhase6EventIds(compactTransportArray, memory.sourceEventIds),
              };
            }),
          },
          ...(typeof rag.noChangeReason === "string" ? { noChangeReason: rag.noChangeReason } : {}),
        },
        eventIds: {
          source: compactPhase6EventIds(compactTransportArray, eventIds.source),
          settlement: compactPhase6EventIds(compactTransportArray, eventIds.settlement),
          derived: compactPhase6EventIds(compactTransportArray, eventIds.derived),
        },
        outcome: {
          status: outcome.status,
          grade: outcome.grade,
          scoreBps: outcome.scoreBps,
          summary: outcome.summary,
          keys: Object.keys(outcome).sort(),
        },
        integrity: receipt.integrity,
      },
    }, result);
  };
}

export function buildCompactPhase6ResultForTransport(
  helpers: Pick<Phase6HandlerHelpers, "compactTransportArray" | "preserveCompactTransportEvents">,
): (result: unknown) => unknown {
  const { compactTransportArray, preserveCompactTransportEvents } = helpers;
  return (result: unknown) => {
    const value = recordValue(result);
    const page = recordValue(value.result);
    const receipt = recordValue(page.receipt);
    const sections = recordValue(page.sections);
    const identityProgression = recordValue(sections.identityProgression);
    const settlement = recordValue(sections.settlement);
    const economyConservation = recordValue(settlement.economyConservation);
    const assets = compactTransportArray(economyConservation.assets);
    const scores = compactTransportArray(sections.scores);
    const rag = recordValue(sections.rag);
    const audit = recordValue(sections.audit);
    const integrity = recordValue(audit.integrity);
    return preserveCompactTransportEvents({
      authority: "server_phase6_result",
      transportVersion: "phase6_result.compact.v1",
      verified: value.verified === true,
      rulesetVersion: value.rulesetVersion,
      pageId: value.pageId,
      receiptId: value.receiptId,
      result: {
        rulesetVersion: page.rulesetVersion,
        deterministic: page.deterministic,
        receipt: {
          receiptId: receipt.receiptId,
          runId: receipt.runId,
          createdAt: receipt.createdAt,
          payloadHash: receipt.payloadHash,
          canonicalEventIds: compactPhase6EventIds(compactTransportArray, receipt.canonicalEventIds),
          canonicalEventCount: compactTransportArray(receipt.canonicalEvents).length,
        },
        sections: {
          world: compactPhase6ChangeSet(compactTransportArray, sections.world),
          identityProgression: {
            identity: compactPhase6ChangeSet(compactTransportArray, identityProgression.identity),
            progression: compactPhase6ChangeSet(compactTransportArray, identityProgression.progression),
          },
          settlement: {
            status: settlement.status,
            settlementId: settlement.settlementId,
            eventIds: compactPhase6EventIds(compactTransportArray, settlement.eventIds),
            economyConservation: {
              conserved: economyConservation.conserved,
              assetCount: assets.length,
              assets: assets.slice(0, 20),
              auditFindingIds: compactPhase6EventIds(compactTransportArray, economyConservation.auditFindingIds),
            },
          },
          scores: scores.map((entry) => {
            const score = recordValue(entry);
            return {
              dimension: score.dimension,
              score: score.score,
              basis: score.basis,
              source: score.source,
              fallback: score.fallback,
              eventIds: compactPhase6EventIds(compactTransportArray, score.eventIds),
            };
          }),
          rag: {
            ...compactPhase6ChangeSet(compactTransportArray, rag),
            evidenceIds: compactPhase6EventIds(compactTransportArray, rag.evidenceIds),
            retrievalSnapshotId: rag.retrievalSnapshotId,
          },
          audit: {
            auditId: audit.auditId,
            eventIds: compactPhase6EventIds(compactTransportArray, audit.eventIds),
            integrity: {
              ok: integrity.ok,
              receiptPayloadHash: integrity.receiptPayloadHash,
              resultPagePayloadHash: integrity.resultPagePayloadHash,
              canonicalEventIds: compactPhase6EventIds(compactTransportArray, integrity.canonicalEventIds),
              checkedAt: integrity.checkedAt,
            },
          },
        },
      },
    }, result);
  };
}

// ── Registration ────────────────────────────────────────────────────

export function registerPhase6Handlers(
  handlers: Map<string, (args: AnyRecord) => unknown>,
  runtime: Phase6Runtime,
  helpers: Phase6HandlerHelpers,
): void {
  // Simple delegates — just forward to runtime.
  handlers.set(
    "obsidian_epoch.result_page",
    (args) => runtime.epochResultPage(args),
  );
  handlers.set(
    PHASE6_EXPERIMENT_MCP_TOOL_BEGIN_EXPERIMENT,
    (args) => runtime.epochBeginPhase6Experiment(args),
  );
  handlers.set(
    PHASE6_EXPERIMENT_MCP_TOOL_BEGIN_RUN,
    (args) => runtime.epochBeginPhase6Run(args),
  );
  handlers.set(
    PHASE6_EXPERIMENT_MCP_TOOL_STATUS,
    (args) => runtime.epochPhase6ExperimentStatus(args),
  );
  handlers.set(
    PHASE6_MCP_TOOL_RUN_RECEIPT,
    (args) => runtime.epochPhase6RunReceipt(args),
  );
  handlers.set(
    PHASE6_MCP_TOOL_PHASE6_RESULT,
    (args) => runtime.epochPhase6Result(args),
  );
  handlers.set(
    "obsidian_epoch.create_result_page",
    (args) => runtime.epochCreateResultPage(args),
  );
  handlers.set(
    "obsidian_epoch.revoke_result_page",
    (args) => runtime.epochRevokeResultPage(args),
  );
  handlers.set(
    "obsidian_epoch.delete_result_page",
    (args) => runtime.epochDeleteResultPage(args),
  );

  // Compact variants — wrap with transport helpers.
  handlers.set(
    "obsidian_epoch.run_receipt_compact",
    (args) => helpers.compactPhase6RunReceiptForTransport(runtime.epochPhase6RunReceipt(args)),
  );
  handlers.set(
    "obsidian_epoch.phase6_result_compact",
    (args) => helpers.compactPhase6ResultForTransport(runtime.epochPhase6Result(args)),
  );
}
