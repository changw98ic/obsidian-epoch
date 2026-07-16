import type {
  TraceConflictDeployment,
  TraceConflictRumorMemory,
  TraceConflictScope,
  TraceConflictStatus,
  TraceConflictTemplateKey,
  TraceConflictType,
} from "./traceConflictRules.ts";

export interface TraceConflictReadProjection {
  readonly deployments: readonly TraceConflictDeployment[];
  readonly memories?: readonly TraceConflictRumorMemory[];
}

export interface TraceConflictAuditLink {
  readonly auditId: string;
  readonly href: string;
}

export interface TraceConflictSourceEventLink {
  readonly eventId: string;
  readonly href: string;
}

export interface TraceConflictOwnerDeploymentView {
  readonly traceId: string;
  readonly templateKey: TraceConflictTemplateKey;
  readonly type: TraceConflictType;
  readonly title: string;
  readonly sourceAgentId: string;
  readonly authorizationMode: "owner_authenticated";
  readonly scope: TraceConflictScope;
  readonly costs: TraceConflictDeployment["costs"];
  readonly status: TraceConflictStatus;
  readonly deployedAt: string;
  readonly expiresAt: string;
  readonly cooldownUntil: string;
  readonly resolvedAt?: string;
  readonly triggeredByTurnCardId?: string;
  readonly counteredByTraceId?: string;
  readonly sourceEvents: readonly TraceConflictSourceEventLink[];
  readonly audits: readonly TraceConflictAuditLink[];
}

export interface TraceConflictRegionDeploymentView {
  readonly traceId: string;
  readonly templateKey: TraceConflictTemplateKey;
  readonly type: TraceConflictType;
  readonly title: string;
  readonly sourceAgentId?: string;
  readonly scope?: TraceConflictScope;
  readonly status: TraceConflictStatus;
  readonly deployedAt: string;
  readonly resolvedAt?: string;
  readonly triggeredByTurnCardId?: string;
  readonly counteredByTraceId?: string;
  readonly sourceEvents: readonly TraceConflictSourceEventLink[];
  readonly audits: readonly TraceConflictAuditLink[];
  readonly redacted: boolean;
}

export interface TraceConflictRegionView {
  readonly regionId: string;
  readonly deployments: readonly TraceConflictRegionDeploymentView[];
}

export interface TraceConflictMemoryView {
  readonly memoryId: string;
  readonly traceId: string;
  readonly targetAgentId: string;
  readonly regionId: string;
  readonly memoryTemplateKey: string;
  readonly summary: string;
  readonly confidence: "low";
  readonly authority: "low-confidence";
  readonly nonEvidence: true;
  readonly canMutateTruth: false;
  readonly recordedAt: string;
  readonly sourceEvents: readonly TraceConflictSourceEventLink[];
  readonly audits: readonly TraceConflictAuditLink[];
}

export interface TraceConflictOwnerViewInput {
  readonly explorerId: string;
  readonly agentId?: string;
  readonly status?: TraceConflictStatus;
  readonly limit?: number;
}

export interface TraceConflictRegionViewInput {
  readonly regionId: string;
  readonly viewerExplorerId?: string;
  readonly limit?: number;
}

function sourceEventLinks(eventIds: readonly string[]): readonly TraceConflictSourceEventLink[] {
  return [...new Set(eventIds)].map((eventId) => ({
    eventId,
    href: `/epoch/audit/${encodeURIComponent(eventId)}`,
  }));
}

function auditLinks(auditIds: readonly string[]): readonly TraceConflictAuditLink[] {
  return [...new Set(auditIds)].map((auditId) => ({
    auditId,
    href: `/epoch/audit/${encodeURIComponent(auditId)}`,
  }));
}

function terminalAuditIds(deployment: TraceConflictDeployment): readonly string[] {
  return deployment.resolutionAuditId
    ? [...deployment.auditIds, deployment.resolutionAuditId]
    : deployment.auditIds;
}

function terminalSourceEventIds(deployment: TraceConflictDeployment): readonly string[] {
  return deployment.outcomeEventId
    ? [...deployment.sourceEventIds, deployment.deploymentEventId, deployment.outcomeEventId]
    : [...deployment.sourceEventIds, deployment.deploymentEventId];
}

function statusOrder(status: TraceConflictStatus): number {
  return status === "active" ? 0 : 1;
}

function deploymentOrder(left: TraceConflictDeployment, right: TraceConflictDeployment): number {
  return statusOrder(left.status) - statusOrder(right.status)
    || right.deployedAt.localeCompare(left.deployedAt)
    || left.traceId.localeCompare(right.traceId);
}

function boundedLimit(limit: number | undefined): number {
  if (limit === undefined) return 50;
  if (!Number.isInteger(limit) || limit < 1) throw new Error("trace_conflict_read_limit_invalid");
  return Math.min(limit, 200);
}

export function traceConflictOwnerView(
  projection: TraceConflictReadProjection,
  input: TraceConflictOwnerViewInput,
): readonly TraceConflictOwnerDeploymentView[] {
  return projection.deployments
    .filter((deployment) => deployment.sourceExplorerId === input.explorerId)
    .filter((deployment) => !input.agentId || deployment.sourceAgentId === input.agentId)
    .filter((deployment) => !input.status || deployment.status === input.status)
    .sort(deploymentOrder)
    .slice(0, boundedLimit(input.limit))
    .map((deployment) => ({
      traceId: deployment.traceId,
      templateKey: deployment.templateKey,
      type: deployment.type,
      title: deployment.title,
      sourceAgentId: deployment.sourceAgentId,
      authorizationMode: deployment.authorizationMode,
      scope: deployment.scope,
      costs: deployment.costs,
      status: deployment.status,
      deployedAt: deployment.deployedAt,
      expiresAt: deployment.expiresAt,
      cooldownUntil: deployment.cooldownUntil,
      resolvedAt: deployment.resolvedAt,
      triggeredByTurnCardId: deployment.triggeredByTurnCardId,
      counteredByTraceId: deployment.counteredByTraceId,
      sourceEvents: sourceEventLinks(terminalSourceEventIds(deployment)),
      audits: auditLinks(terminalAuditIds(deployment)),
    }));
}

function belongsToRegion(deployment: TraceConflictDeployment, regionId: string): boolean {
  return deployment.scope.regionId === undefined || deployment.scope.regionId === regionId;
}

function visibleInRegion(
  deployment: TraceConflictDeployment,
  viewerExplorerId: string | undefined,
): boolean {
  if (deployment.status !== "active") return true;
  return deployment.sourceExplorerId === viewerExplorerId;
}

export function traceConflictRegionView(
  projection: TraceConflictReadProjection,
  input: TraceConflictRegionViewInput,
): TraceConflictRegionView {
  const matching = projection.deployments.filter((deployment) => belongsToRegion(deployment, input.regionId));
  const visible = matching.filter((deployment) => visibleInRegion(deployment, input.viewerExplorerId));
  return {
    regionId: input.regionId,
    deployments: visible
      .sort(deploymentOrder)
      .slice(0, boundedLimit(input.limit))
      .map((deployment) => {
        const ownerVisible = deployment.sourceExplorerId === input.viewerExplorerId;
        return {
          traceId: deployment.traceId,
          templateKey: deployment.templateKey,
          type: deployment.type,
          title: deployment.title,
          ...(ownerVisible ? {
            sourceAgentId: deployment.sourceAgentId,
            scope: deployment.scope,
            triggeredByTurnCardId: deployment.triggeredByTurnCardId,
            counteredByTraceId: deployment.counteredByTraceId,
          } : {}),
          status: deployment.status,
          deployedAt: deployment.deployedAt,
          resolvedAt: deployment.resolvedAt,
          sourceEvents: ownerVisible ? sourceEventLinks(terminalSourceEventIds(deployment)) : [],
          audits: ownerVisible ? auditLinks(terminalAuditIds(deployment)) : [],
          redacted: !ownerVisible,
        };
      }),
  };
}

export function traceConflictMemoryView(
  projection: TraceConflictReadProjection,
  input: { readonly explorerId: string; readonly agentId?: string; readonly limit?: number },
): readonly TraceConflictMemoryView[] {
  return (projection.memories || [])
    .filter((memory) => memory.targetExplorerId === input.explorerId)
    .filter((memory) => !input.agentId || memory.targetAgentId === input.agentId)
    .sort((left, right) => right.recordedAt.localeCompare(left.recordedAt) || left.memoryId.localeCompare(right.memoryId))
    .slice(0, boundedLimit(input.limit))
    .map((memory) => ({
      memoryId: memory.memoryId,
      traceId: memory.traceId,
      targetAgentId: memory.targetAgentId,
      regionId: memory.regionId,
      memoryTemplateKey: memory.memoryTemplateKey,
      summary: memory.summary,
      confidence: "low",
      authority: "low-confidence",
      nonEvidence: true,
      canMutateTruth: false,
      recordedAt: memory.recordedAt,
      sourceEvents: sourceEventLinks(memory.sourceEventIds),
      audits: auditLinks(memory.auditIds),
    }));
}
