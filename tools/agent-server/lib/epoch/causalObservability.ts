import type { CausalValidationError } from "./causalContracts.ts";
import type { CausalSnapshotMigrationReport } from "./causalSnapshotMigration.ts";
import type { CausalReplayContinuityResult, CausalWorldSnapshotV1 } from "./causalWorldSnapshot.ts";

export type CausalMetricName =
  | "causal_commit_total"
  | "causal_reject_total"
  | "causal_replay_total"
  | "causal_projection_degraded_total"
  | "causal_conservation_error_total"
  | "causal_schema_error_total"
  | "causal_pressure_backlog_total"
  | "causal_knowledge_leakage_reject_total"
  | "causal_lod_subject_total"
  | "causal_migration_total"
  | "causal_migration_duration_ms";

export type CausalTraceKind =
  | "commit"
  | "reject"
  | "replay"
  | "projection_degraded"
  | "conservation_error"
  | "schema_error"
  | "pressure_backlog"
  | "knowledge_leakage_reject"
  | "lod_distribution"
  | "migration";

export type CausalHealthStatus = "ok" | "degraded" | "unready";

export type CausalMetricLabels = Readonly<Record<string, string | number | boolean>>;

export interface CausalMetricSample {
  readonly name: CausalMetricName;
  readonly value: number;
  readonly labels: CausalMetricLabels;
}

export interface CausalTraceEvent {
  readonly kind: CausalTraceKind;
  readonly at?: string;
  readonly outcome: string;
  readonly code?: string;
  readonly details: Readonly<Record<string, unknown>>;
}

export interface CausalObservabilitySnapshot {
  readonly metrics: readonly CausalMetricSample[];
  readonly traces: readonly CausalTraceEvent[];
  readonly health: CausalHealthSummary;
}

export interface CausalHealthSummary {
  readonly status: CausalHealthStatus;
  readonly ready: boolean;
  readonly reasons: readonly string[];
  readonly counters: Readonly<Record<string, number>>;
  readonly slo: CausalSloEvaluation;
}

export interface CausalSloThresholds {
  readonly maxRejectRate?: number;
  readonly maxProjectionDegradedTotal?: number;
  readonly maxSchemaErrors?: number;
  readonly maxConservationErrors?: number;
  readonly maxPressureBacklogDue?: number;
  readonly maxCriticalPressureBacklog?: number;
  readonly maxKnowledgeLeakageRejects?: number;
  readonly maxMigrationDurationMs?: number;
}

export interface CausalSloEvaluation {
  readonly ok: boolean;
  readonly violations: readonly CausalSloViolation[];
}

export interface CausalSloViolation {
  readonly threshold: keyof CausalSloThresholds;
  readonly actual: number;
  readonly limit: number;
}

export interface CausalObservabilityCollector {
  readonly recordCommit: (input?: CausalTraceInput) => void;
  readonly recordReject: (input: CausalTraceInput & { readonly code: string }) => void;
  readonly recordReplay: (input?: CausalTraceInput & { readonly continuity?: CausalReplayContinuityResult }) => void;
  readonly recordProjectionDegraded: (input?: CausalTraceInput & { readonly code?: string }) => void;
  readonly recordValidationErrors: (errors: readonly CausalValidationError[], input?: CausalTraceInput) => void;
  readonly recordPressureBacklog: (snapshot: CausalWorldSnapshotV1, input?: CausalTraceInput) => void;
  readonly recordKnowledgeLeakageReject: (input: CausalTraceInput & { readonly code?: string }) => void;
  readonly recordLodDistribution: (snapshot: CausalWorldSnapshotV1, input?: CausalTraceInput) => void;
  readonly recordMigration: (report: CausalSnapshotMigrationReport, input?: CausalTraceInput) => void;
  readonly snapshot: (thresholds?: CausalSloThresholds) => CausalObservabilitySnapshot;
}

export interface CausalTraceInput {
  readonly at?: string;
  readonly outcome?: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

const LOW_CARDINALITY_LABELS = new Set([
  "outcome",
  "code",
  "kind",
  "status",
  "dryRun",
  "lod",
]);

const CONSERVATION_CODES = new Set([
  "RESOURCE_UNBALANCED",
  "RESOURCE_SOURCE_DENIED",
  "RESOURCE_SINK_DENIED",
  "NEGATIVE_BALANCE",
  "OWNERSHIP_CONFLICT",
]);

const SCHEMA_CODES = new Set([
  "CAUSAL_SCHEMA_UNKNOWN",
  "CAUSAL_SCHEMA_INVALID",
  "REGISTRY_VERSION_UNAVAILABLE",
  "DETERMINISM_PROOF_FAILED",
]);

export function createCausalObservabilityCollector(): CausalObservabilityCollector {
  const counters = new Map<string, CausalMetricSample>();
  const traces: CausalTraceEvent[] = [];
  const increment = (name: CausalMetricName, value: number, labels: CausalMetricLabels = {}) => {
    const sanitizedLabels = sanitizeLabels(labels);
    const key = `${name}:${JSON.stringify(sanitizedLabels)}`;
    const existing = counters.get(key);
    counters.set(key, {
      name,
      labels: sanitizedLabels,
      value: (existing?.value || 0) + value,
    });
  };
  const trace = (kind: CausalTraceKind, input: CausalTraceInput & { readonly code?: string } = {}) => {
    traces.push({
      kind,
      ...(input.at ? { at: input.at } : {}),
      outcome: input.outcome || "observed",
      ...(input.code ? { code: input.code } : {}),
      details: input.details || {},
    });
  };

  return {
    recordCommit(input = {}) {
      increment("causal_commit_total", 1, { outcome: input.outcome || "committed" });
      trace("commit", { ...input, outcome: input.outcome || "committed" });
    },
    recordReject(input) {
      increment("causal_reject_total", 1, { code: input.code, outcome: input.outcome || "rejected" });
      trace("reject", { ...input, outcome: input.outcome || "rejected" });
    },
    recordReplay(input = {}) {
      const outcome = input.continuity?.ok === false ? "continuity_failed" : input.outcome || "replayed";
      increment("causal_replay_total", 1, { outcome });
      trace("replay", { ...input, outcome });
    },
    recordProjectionDegraded(input = {}) {
      increment("causal_projection_degraded_total", 1, { code: input.code || "PROJECTION_LAGGING" });
      trace("projection_degraded", { ...input, code: input.code || "PROJECTION_LAGGING", outcome: "degraded" });
    },
    recordValidationErrors(errors, input = {}) {
      for (const error of errors) {
        if (CONSERVATION_CODES.has(error.code)) {
          increment("causal_conservation_error_total", 1, { code: error.code });
          trace("conservation_error", { ...input, code: error.code, outcome: "error", details: error.details });
        }
        if (SCHEMA_CODES.has(error.code)) {
          increment("causal_schema_error_total", 1, { code: error.code });
          trace("schema_error", { ...input, code: error.code, outcome: "error", details: error.details });
        }
      }
    },
    recordPressureBacklog(snapshot, input = {}) {
      increment("causal_pressure_backlog_total", snapshot.pressure.backlog.dueCount, { kind: "due" });
      increment("causal_pressure_backlog_total", snapshot.pressure.backlog.criticalCount, { kind: "critical" });
      increment("causal_pressure_backlog_total", snapshot.pressure.backlog.overdueCriticalCount, { kind: "overdue_critical" });
      trace("pressure_backlog", {
        ...input,
        outcome: "observed",
        details: {
          ...input.details,
          backlog: snapshot.pressure.backlog,
        },
      });
    },
    recordKnowledgeLeakageReject(input) {
      const code = input.code || "KNOWLEDGE_LEAKAGE_REJECTED";
      increment("causal_knowledge_leakage_reject_total", 1, { code });
      trace("knowledge_leakage_reject", { ...input, code, outcome: input.outcome || "rejected" });
    },
    recordLodDistribution(snapshot, input = {}) {
      for (const [lod, count] of Object.entries(snapshot.actorMind.lodDistribution)) {
        increment("causal_lod_subject_total", count, { lod });
      }
      trace("lod_distribution", {
        ...input,
        outcome: "observed",
        details: {
          ...input.details,
          lodDistribution: snapshot.actorMind.lodDistribution,
        },
      });
    },
    recordMigration(report, input = {}) {
      increment("causal_migration_total", 1, {
        status: report.status,
        dryRun: report.dryRun,
      });
      increment("causal_migration_duration_ms", report.durationMs, {
        status: report.status,
        dryRun: report.dryRun,
      });
      trace("migration", {
        ...input,
        outcome: report.status,
        details: {
          ...input.details,
          fromVersion: report.fromVersion,
          toVersion: report.toVersion,
          dryRun: report.dryRun,
          migratedEventCount: report.migratedEventCount,
          durationMs: report.durationMs,
          issueCodes: report.issues.map((issue) => issue.code).sort(),
        },
      });
    },
    snapshot(thresholds = {}) {
      const metrics = [...counters.values()].sort((left, right) =>
        left.name.localeCompare(right.name) || JSON.stringify(left.labels).localeCompare(JSON.stringify(right.labels)));
      const health = causalHealthSummary(metrics, traces, thresholds);
      return {
        metrics,
        traces: [...traces],
        health,
      };
    },
  };
}

export function causalHealthSummary(
  metrics: readonly CausalMetricSample[],
  traces: readonly CausalTraceEvent[],
  thresholds: CausalSloThresholds = {},
): CausalHealthSummary {
  const counters = metricTotals(metrics);
  const slo = evaluateCausalSlo(counters, thresholds);
  const reasons = slo.violations.map((violation) => `${violation.threshold}:${violation.actual}>${violation.limit}`);
  const status: CausalHealthStatus = !slo.ok
    ? "unready"
    : traces.some((trace) => trace.kind === "projection_degraded")
      ? "degraded"
      : "ok";
  return {
    status,
    ready: status !== "unready",
    reasons,
    counters,
    slo,
  };
}

export function evaluateCausalSlo(
  counters: Readonly<Record<string, number>>,
  thresholds: CausalSloThresholds = {},
): CausalSloEvaluation {
  const commits = counters.causal_commit_total || 0;
  const rejects = counters.causal_reject_total || 0;
  const totalWrites = commits + rejects;
  const rejectRate = totalWrites > 0 ? rejects / totalWrites : 0;
  const checks: readonly [keyof CausalSloThresholds, number][] = [
    ["maxRejectRate", rejectRate],
    ["maxProjectionDegradedTotal", counters.causal_projection_degraded_total || 0],
    ["maxSchemaErrors", counters.causal_schema_error_total || 0],
    ["maxConservationErrors", counters.causal_conservation_error_total || 0],
    ["maxPressureBacklogDue", labeledTotal(counters, "causal_pressure_backlog_total", "kind", "due")],
    ["maxCriticalPressureBacklog", labeledTotal(counters, "causal_pressure_backlog_total", "kind", "critical")],
    ["maxKnowledgeLeakageRejects", counters.causal_knowledge_leakage_reject_total || 0],
    ["maxMigrationDurationMs", counters.causal_migration_duration_ms || 0],
  ];
  const violations = checks.flatMap(([threshold, actual]) => {
    const limit = thresholds[threshold];
    return typeof limit === "number" && actual > limit ? [{ threshold, actual, limit }] : [];
  });
  return {
    ok: violations.length === 0,
    violations,
  };
}

function sanitizeLabels(labels: CausalMetricLabels): CausalMetricLabels {
  return Object.keys(labels).sort().reduce((result, key) => {
    if (!LOW_CARDINALITY_LABELS.has(key)) return result;
    const value = labels[key];
    result[key] = typeof value === "string" && value.length > 80 ? value.slice(0, 80) : value;
    return result;
  }, {} as Record<string, string | number | boolean>);
}

function metricTotals(metrics: readonly CausalMetricSample[]): Readonly<Record<string, number>> {
  const totals: Record<string, number> = {};
  for (const metric of metrics) {
    totals[metric.name] = (totals[metric.name] || 0) + metric.value;
    for (const [label, value] of Object.entries(metric.labels)) {
      totals[`${metric.name}{${label}=${String(value)}}`] = (totals[`${metric.name}{${label}=${String(value)}}`] || 0) + metric.value;
    }
  }
  return Object.keys(totals).sort().reduce((result, key) => {
    result[key] = totals[key];
    return result;
  }, {} as Record<string, number>);
}

function labeledTotal(
  counters: Readonly<Record<string, number>>,
  name: CausalMetricName,
  label: string,
  value: string,
): number {
  return counters[`${name}{${label}=${value}}`] || 0;
}
