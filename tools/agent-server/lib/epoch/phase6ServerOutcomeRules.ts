import { createHash } from "node:crypto";

import type { EpochEvent } from "./events.ts";
import {
  JOURNEY_ACTION_RESOLUTION_RULE_VERSION,
  type JourneyActionResolution,
} from "./journeyActionResolutionRules.ts";
import { epochEventsForPersistence } from "./runtimePublicProjectionRules.ts";
import type { Phase6ServerScoringWorldCursor } from "./phase6ServerScoringRules.ts";

type UnknownRecord = Readonly<Record<string, unknown>>;

export const PHASE6_SERVER_OUTCOME_EVIDENCE_RULESET_VERSION =
  "obsidian-epoch-phase6-server-outcome-evidence-v0.1.0" as const;

export type Phase6ServerOutcomeEvidenceFindingCode =
  | "PHASE6_SERVER_OUTCOME_INPUT_INVALID"
  | "PHASE6_SERVER_OUTCOME_BINDING_MISSING"
  | "PHASE6_SERVER_OUTCOME_EVENT_EVIDENCE_MISSING"
  | "PHASE6_SERVER_OUTCOME_COMMAND_BINDING_MISSING"
  | "PHASE6_SERVER_OUTCOME_ACTION_BINDING_MISSING"
  | "PHASE6_SERVER_OUTCOME_END_STATE_MISSING"
  | "PHASE6_SERVER_OUTCOME_UNCOMMITTED_MODEL_OUTCOME_REJECTED";

export interface Phase6ServerOutcomeEvidenceFinding {
  readonly code: Phase6ServerOutcomeEvidenceFindingCode;
  readonly severity: "error";
  readonly message: string;
  readonly path: string;
  readonly details?: UnknownRecord;
}

export interface Phase6ServerOutcomeJourneyBinding {
  readonly journeyId: string;
  readonly agentId: string;
  readonly explorerId?: string;
  readonly runId?: string;
  readonly receiptId?: string;
  readonly status?: string;
  readonly settledAt?: string;
  readonly updatedAt?: string;
}

export interface Phase6ServerOutcomeEvidenceInput {
  readonly canonicalEvents: readonly EpochEvent[];
  readonly committedResults: readonly unknown[];
  readonly journeyBinding: Phase6ServerOutcomeJourneyBinding;
  readonly worldCursor: Phase6ServerScoringWorldCursor;
  readonly journeyEndState?: unknown;
}

export type Phase6ServerCommitAuthority = "server_commit";

export interface Phase6ServerOutcomeEvidenceBinding {
  readonly authority: Phase6ServerCommitAuthority;
  readonly eventIds: readonly string[];
  readonly commandId: string;
  readonly actionId: string;
  readonly worldCursor: Phase6ServerScoringWorldCursor;
}

export interface Phase6ServerActionResolutionEvidence
  extends Omit<JourneyActionResolution, "authority">, Phase6ServerOutcomeEvidenceBinding {
  readonly source: "hosted_action_recorded";
  readonly serverResolutionAuthority: JourneyActionResolution["authority"];
  /**
   * `safe_recall` is a server-signed withdrawal.  It deliberately resolves as
   * a failed objective without pretending that a normal task action occurred.
   */
  readonly resolutionKind: "journey_action" | "safe_recall";
  readonly recallMode?: "server_safe_return";
  readonly journeyId: string;
  readonly actionOptionId: string;
  readonly candidateText?: {
    readonly optionLabel?: string;
    readonly visibleText?: string;
  };
  readonly targetFacts: readonly Phase6ServerOutcomeFact[];
  readonly survivalFacts: readonly Phase6ServerOutcomeFact[];
  readonly difficultyFacts: readonly Phase6ServerOutcomeFact[];
  readonly resourceFacts: readonly Phase6ServerOutcomeFact[];
  readonly injuryFacts: readonly Phase6ServerOutcomeFact[];
  readonly worldImpactFacts: readonly Phase6ServerOutcomeFact[];
  readonly combatFacts: readonly Phase6ServerOutcomeFact[];
}

export interface Phase6ServerOutcomeFact {
  readonly eventId: string;
  readonly eventType: string;
  readonly target: {
    readonly kind: string;
    readonly id: string;
  };
  readonly summary: string;
  readonly amount?: number;
}

export interface Phase6ServerOutcomeResolutionEvidence extends Phase6ServerOutcomeEvidenceBinding {
  readonly source: "server_committed_canonical_events";
  readonly journeyId: string;
  readonly status: "settled";
  readonly settledAt?: string;
  readonly objective: number;
  readonly completion: number;
  readonly survival: number;
  readonly difficulty: number;
  readonly resourceCost: number;
  readonly injuryCost: number;
  readonly worldImpact: number;
  readonly performance: number;
  readonly targetFacts: readonly Phase6ServerOutcomeFact[];
  readonly survivalFacts: readonly Phase6ServerOutcomeFact[];
  readonly difficultyFacts: readonly Phase6ServerOutcomeFact[];
  readonly resourceFacts: readonly Phase6ServerOutcomeFact[];
  readonly injuryFacts: readonly Phase6ServerOutcomeFact[];
  readonly worldImpactFacts: readonly Phase6ServerOutcomeFact[];
  readonly combatFacts: readonly Phase6ServerOutcomeFact[];
}

export interface Phase6ServerOutcomeEvidenceSuccess {
  readonly ok: true;
  readonly rulesetVersion: typeof PHASE6_SERVER_OUTCOME_EVIDENCE_RULESET_VERSION;
  readonly deterministic: true;
  readonly value: {
    readonly serverOutcomeResolution: Phase6ServerOutcomeResolutionEvidence;
    readonly serverActionResolutions: readonly Phase6ServerActionResolutionEvidence[];
    readonly receiptBasisOutcome: Phase6ServerOutcomeResolutionEvidence;
  };
  readonly findings: readonly [];
}

export interface Phase6ServerOutcomeEvidenceFailure {
  readonly ok: false;
  readonly rulesetVersion: typeof PHASE6_SERVER_OUTCOME_EVIDENCE_RULESET_VERSION;
  readonly deterministic: true;
  readonly findings: readonly Phase6ServerOutcomeEvidenceFinding[];
}

export type Phase6ServerOutcomeEvidenceResult =
  | Phase6ServerOutcomeEvidenceSuccess
  | Phase6ServerOutcomeEvidenceFailure;

interface IndexedEvent {
  readonly event: EpochEvent;
  readonly index: number;
  readonly eventId: string;
  readonly eventType: string;
  readonly payload: UnknownRecord;
}

interface ActionEvidence {
  readonly event: IndexedEvent;
  readonly commandResult: UnknownRecord | undefined;
  readonly commandId: string;
  readonly actionId: string;
  readonly resolution: JourneyActionResolution;
  readonly resolutionKind: "journey_action" | "safe_recall";
}

function finding(
  code: Phase6ServerOutcomeEvidenceFindingCode,
  message: string,
  path: string,
  details?: UnknownRecord,
): Phase6ServerOutcomeEvidenceFinding {
  return { code, severity: "error", message, path, details };
}

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function text(value: unknown): string | undefined {
  return nonEmpty(value) ? value.trim() : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function record(value: unknown): UnknownRecord {
  return isRecord(value) ? value : {};
}

function eventId(event: EpochEvent, index: number): string {
  return text(record(event).eventId) || text(record(event).id) || `missing_event_id_${index}`;
}

function eventType(event: EpochEvent): string {
  return text(record(event).eventType) || text(record(event).type) || text(record(event).kind) || "unknown_event";
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
    .join(",")}}`;
}

function stableHash(value: unknown): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(stableJson(value)).digest("hex")}`;
}

function unique(values: readonly string[]): readonly string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function canonicalIndexedEvents(
  canonicalEvents: readonly EpochEvent[],
  committedResults: readonly unknown[],
): readonly IndexedEvent[] {
  const events = [
    ...canonicalEvents,
    ...committedResults.flatMap((result) => epochEventsForPersistence(result)),
  ];
  return [...new Map(events.map((event, index) => {
    const id = eventId(event, index);
    return [id, {
      event,
      index,
      eventId: id,
      eventType: eventType(event),
      payload: record(record(event).payload),
    } satisfies IndexedEvent];
  })).values()].sort((left, right) => left.eventId.localeCompare(right.eventId) || left.index - right.index);
}

function committedResultRecords(committedResults: readonly unknown[]): readonly UnknownRecord[] {
  return committedResults.filter(isRecord);
}

function commandIdFor(event: IndexedEvent, result: UnknownRecord | undefined): string | undefined {
  const command = record(result?.command);
  return text(result?.commandId)
    || text(command.commandId)
    || text(result?.idempotencyKey)
    || text(record(result?.input).idempotencyKey)
    || text(record(event.event).causationId)
    || text(record(event.event).idempotencyKey);
}

function resultActionId(result: UnknownRecord): string | undefined {
  return text(record(result.settledAction).actionId)
    || text(record(result.action).actionId)
    || text(result.actionId)
    || text(record(result.value).actionId);
}

function resultActionOptionId(result: UnknownRecord): string | undefined {
  return text(record(result.settledAction).actionOptionId)
    || text(record(result.action).actionOptionId)
    || text(result.actionOptionId)
    || text(record(result.input).actionOptionId);
}

function commandResultForAction(
  actionId: string,
  actionOptionId: string | undefined,
  results: readonly UnknownRecord[],
): UnknownRecord | undefined {
  return results.find((result) => resultActionId(result) === actionId)
    || (actionOptionId ? results.find((result) => resultActionOptionId(result) === actionOptionId) : undefined);
}

function isJourneyResolution(value: unknown): value is JourneyActionResolution {
  const resolution = record(value);
  return resolution.authority === "server"
    && typeof resolution.outcome === "string"
    && ["exceptional_success", "success", "partial_success", "failure"].includes(resolution.outcome)
    && (resolution.completionKind === "complete" || resolution.completionKind === "failed")
    && typeof resolution.score === "number"
    && typeof resolution.difficulty === "number";
}

function isServerSafeRecallResult(
  result: UnknownRecord | undefined,
  actionId: string,
  actionOptionId: string | undefined,
): boolean {
  if (!result
    || result.recalled !== true
    || result.recallMode !== "server_safe_return"
    || resultActionId(result) !== actionId
    || (actionOptionId !== undefined && resultActionOptionId(result) !== actionOptionId)) {
    return false;
  }
  return Array.isArray(result.episodes) && result.episodes.some((episode) => {
    const storyBeat = record(record(record(episode).serverFacts).storyBeat);
    return record(storyBeat.selectedAction).optionKey === "recall_without_objective";
  });
}

function safeRecallResolution(
  event: IndexedEvent,
  result: UnknownRecord | undefined,
  actionId: string,
  actionOptionId: string | undefined,
): JourneyActionResolution | undefined {
  if (!isServerSafeRecallResult(result, actionId, actionOptionId)) return undefined;
  return {
    ruleVersion: JOURNEY_ACTION_RESOLUTION_RULE_VERSION,
    authority: "server",
    decisionKeyId: "server_safe_recall",
    inputHash: stableHash({
      kind: "server_safe_recall",
      actionId,
      ...(actionOptionId ? { actionOptionId } : {}),
      eventId: event.eventId,
      recallMode: "server_safe_return",
    }),
    outcome: "failure",
    completionKind: "failed",
    score: 0,
    difficulty: 0,
    margin: 0,
    factors: {
      baseCompetence: 0,
      identity: 0,
      attributes: 0,
      resources: 0,
      equipment: 0,
      sceneSupport: 0,
      journeyPreparation: 0,
      condition: 0,
      goalAlignment: 0,
      deterministicVariance: 0,
    },
    summary: text(event.payload.outcomeSummary) || "server_safe_recall",
  };
}

function eventTarget(event: IndexedEvent): Phase6ServerOutcomeFact["target"] {
  const aggregateType = text(record(event.event).aggregateType) || "event";
  const aggregateId = text(record(event.event).aggregateId)
    || text(event.payload.agentId)
    || text(event.payload.regionId)
    || text(event.payload.actionId)
    || event.eventId;
  return { kind: aggregateType, id: aggregateId };
}

function fact(event: IndexedEvent, summary: string, amount?: number): Phase6ServerOutcomeFact {
  return {
    eventId: event.eventId,
    eventType: event.eventType,
    target: eventTarget(event),
    summary,
    ...(amount !== undefined ? { amount } : {}),
  };
}

function factsForEvents(events: readonly IndexedEvent[], predicate: (event: IndexedEvent) => boolean): readonly Phase6ServerOutcomeFact[] {
  return events.filter(predicate).map((event) => fact(event, factSummary(event), factAmount(event)));
}

function factSummary(event: IndexedEvent): string {
  return text(event.payload.summary)
    || text(event.payload.outcomeSummary)
    || text(event.payload.reason)
    || text(event.payload.title)
    || event.eventType;
}

function factAmount(event: IndexedEvent): number | undefined {
  return numberValue(event.payload.amount)
    ?? numberValue(event.payload.delta)
    ?? numberValue(event.payload.influenceDelta)
    ?? numberValue(event.payload.standingDelta)
    ?? numberValue(event.payload.lifetimeDelta);
}

function textContains(value: unknown, pattern: RegExp): boolean {
  return pattern.test(stableJson(value).toLocaleLowerCase("en-US"));
}

function isTargetFact(event: IndexedEvent): boolean {
  return event.eventType === "hosted_action_recorded"
    || event.eventType === "journey_world_solidified"
    || nonEmpty(event.payload.sourceEventId)
    || Array.isArray(event.payload.sourceEventIds);
}

function isSurvivalFact(event: IndexedEvent): boolean {
  return event.eventType === "hosted_action_recorded"
    || event.eventType === "lifetime_adjusted"
    || textContains(event, /survival|alive|death|dead|injury|wound|health|medical|safe_return/u);
}

function isDifficultyFact(event: IndexedEvent): boolean {
  return event.eventType === "hosted_action_recorded"
    || textContains(event, /difficulty|challenge|threat|risk|hazard|opposition|combat|battle/u);
}

function isResourceFact(event: IndexedEvent): boolean {
  return event.eventType === "resource_spent"
    || event.eventType === "resource_granted"
    || textContains(event, /resource|cost|spent|spend|consume|coin|focus|stamina|aether/u);
}

function isInjuryFact(event: IndexedEvent): boolean {
  return event.eventType === "lifetime_adjusted"
    || textContains(event, /injury|wound|damage|trauma|death|health|lasting_injury/u);
}

function isWorldImpactFact(event: IndexedEvent): boolean {
  return event.eventType === "region_influence_changed"
    || event.eventType === "trace_created"
    || event.eventType === "agent_faction_standing_changed"
    || event.eventType === "journey_world_solidified"
    || textContains(event, /world|region|influence|faction|standing|trace|impact|stability/u);
}

function isCombatFact(event: IndexedEvent): boolean {
  return textContains(event, /combat|attack|damage|enemy|hostile|threat|battle|power/u);
}

function linkedEventIds(action: IndexedEvent, events: readonly IndexedEvent[]): readonly string[] {
  const sourceId = action.eventId;
  return [...unique([
    sourceId,
    ...events
      .filter((event) =>
        text(event.payload.sourceEventId) === sourceId
        || (Array.isArray(event.payload.sourceEventIds) && event.payload.sourceEventIds.map(text).includes(sourceId)))
      .map((event) => event.eventId),
  ])].sort((left: string, right: string) => left.localeCompare(right));
}

function actionFacts(
  action: IndexedEvent,
  events: readonly IndexedEvent[],
  predicate: (event: IndexedEvent) => boolean,
): readonly Phase6ServerOutcomeFact[] {
  const ids = new Set(linkedEventIds(action, events));
  return factsForEvents(events, (event) => ids.has(event.eventId) && predicate(event));
}

function buildActionEvidence(
  events: readonly IndexedEvent[],
  results: readonly UnknownRecord[],
): readonly ActionEvidence[] {
  return events
    .filter((event) => event.eventType === "hosted_action_recorded")
    .map((event) => {
      const actionId = text(event.payload.actionId);
      const actionOptionId = text(event.payload.actionOptionId);
      if (!actionId) return undefined;
      const commandResult = commandResultForAction(actionId, actionOptionId, results);
      const commandId = commandIdFor(event, commandResult);
      const normalResolution = isJourneyResolution(event.payload.journeyResolution)
        ? event.payload.journeyResolution
        : undefined;
      const resolution = normalResolution
        || safeRecallResolution(event, commandResult, actionId, actionOptionId);
      if (!resolution) return undefined;
      if (!commandId) return undefined;
      return {
        event,
        commandResult,
        commandId,
        actionId,
        resolution,
        resolutionKind: normalResolution ? "journey_action" : "safe_recall",
      };
    })
    .filter((entry): entry is ActionEvidence => entry !== undefined)
    .sort((left, right) =>
      left.event.eventId.localeCompare(right.event.eventId)
      || left.actionId.localeCompare(right.actionId));
}

function isAutomaticJourneyLifecycleAction(event: IndexedEvent): boolean {
  const idempotencyKey = text(record(event.event).idempotencyKey) || "";
  const phase = text(event.payload.phase) || text(event.payload.journeyPhase) || "";
  return phase === "arrival"
    || phase === "return"
    || /:(?:arrival|return):hosted:/u.test(idempotencyKey);
}

function hasSettledEndState(input: Phase6ServerOutcomeEvidenceInput, events: readonly IndexedEvent[]): boolean {
  const endState = record(input.journeyEndState);
  return input.journeyBinding.status === "settled"
    || endState.status === "settled"
    || input.committedResults.some((result) => record(record(result).journey).status === "settled")
    || events.some((event) => event.eventType === "journey_world_solidified");
}

function buildActionResolution(
  input: Phase6ServerOutcomeEvidenceInput,
  evidence: ActionEvidence,
  events: readonly IndexedEvent[],
): Phase6ServerActionResolutionEvidence {
  const actionEvent = evidence.event;
  const result = evidence.commandResult;
  const actionOptionId = text(actionEvent.payload.actionOptionId) || resultActionOptionId(record(result)) || "unknown_action_option";
  const eventIds = linkedEventIds(actionEvent, events);
  return {
    ...evidence.resolution,
    authority: "server_commit",
    source: "hosted_action_recorded",
    serverResolutionAuthority: evidence.resolution.authority,
    resolutionKind: evidence.resolutionKind,
    ...(evidence.resolutionKind === "safe_recall" ? { recallMode: "server_safe_return" as const } : {}),
    eventIds,
    commandId: evidence.commandId,
    actionId: evidence.actionId,
    worldCursor: input.worldCursor,
    journeyId: input.journeyBinding.journeyId,
    actionOptionId,
    ...(text(actionEvent.payload.optionLabel) || text(actionEvent.payload.visibleText)
      ? { candidateText: {
        ...(text(actionEvent.payload.optionLabel) ? { optionLabel: text(actionEvent.payload.optionLabel) } : {}),
        ...(text(actionEvent.payload.visibleText) ? { visibleText: text(actionEvent.payload.visibleText) } : {}),
      } }
      : {}),
    inputHash: evidence.resolution.inputHash || stableHash({
      eventIds,
      commandId: evidence.commandId,
      actionId: evidence.actionId,
      actionOptionId,
      worldCursor: input.worldCursor,
    }),
    targetFacts: actionFacts(actionEvent, events, isTargetFact),
    survivalFacts: actionFacts(actionEvent, events, isSurvivalFact),
    difficultyFacts: actionFacts(actionEvent, events, isDifficultyFact),
    resourceFacts: actionFacts(actionEvent, events, isResourceFact),
    injuryFacts: actionFacts(actionEvent, events, isInjuryFact),
    worldImpactFacts: actionFacts(actionEvent, events, isWorldImpactFact),
    combatFacts: actionFacts(actionEvent, events, isCombatFact),
  };
}

function average(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function buildOutcomeResolution(
  input: Phase6ServerOutcomeEvidenceInput,
  actions: readonly Phase6ServerActionResolutionEvidence[],
  events: readonly IndexedEvent[],
): Phase6ServerOutcomeResolutionEvidence {
  const eventIds = [...unique(actions.flatMap((action) => action.eventIds))].sort((left: string, right: string) => left.localeCompare(right));
  const first = actions[0];
  const resourceCost = sum(actions.map((action) =>
    action.resourceCost?.paid === false ? 0 : action.resourceCost?.amount ?? 0));
  const injuryFacts = factsForEvents(events, isInjuryFact);
  const worldImpactFacts = factsForEvents(events, isWorldImpactFact);
  const failed = actions.some((action) => action.outcome === "failure");
  return {
    authority: "server_commit",
    source: "server_committed_canonical_events",
    eventIds,
    commandId: first.commandId,
    actionId: first.actionId,
    worldCursor: input.worldCursor,
    journeyId: input.journeyBinding.journeyId,
    status: "settled",
    ...(text(input.journeyBinding.settledAt) || text(input.journeyBinding.updatedAt)
      ? { settledAt: text(input.journeyBinding.settledAt) || text(input.journeyBinding.updatedAt) }
      : {}),
    objective: failed ? 0 : 1,
    completion: 1,
    survival: injuryFacts.length === 0 ? 1 : 0,
    difficulty: average(actions.map((action) => action.difficulty).filter(Number.isFinite)),
    resourceCost,
    injuryCost: injuryFacts.length,
    worldImpact: worldImpactFacts.length,
    performance: average(actions.map((action) => action.score).filter(Number.isFinite)),
    targetFacts: factsForEvents(events, isTargetFact),
    survivalFacts: factsForEvents(events, isSurvivalFact),
    difficultyFacts: factsForEvents(events, isDifficultyFact),
    resourceFacts: factsForEvents(events, isResourceFact),
    injuryFacts,
    worldImpactFacts,
    combatFacts: factsForEvents(events, isCombatFact),
  };
}

function validateInput(input: Phase6ServerOutcomeEvidenceInput): readonly Phase6ServerOutcomeEvidenceFinding[] {
  if (!isRecord(input)) {
    return [finding(
      "PHASE6_SERVER_OUTCOME_INPUT_INVALID",
      "server outcome evidence input must be an object",
      "$",
    )];
  }
  const findings: Phase6ServerOutcomeEvidenceFinding[] = [];
  if (!Array.isArray(input.canonicalEvents)) {
    findings.push(finding("PHASE6_SERVER_OUTCOME_INPUT_INVALID", "canonicalEvents must be an array", "$.canonicalEvents"));
  }
  if (!Array.isArray(input.committedResults)) {
    findings.push(finding("PHASE6_SERVER_OUTCOME_INPUT_INVALID", "committedResults must be an array", "$.committedResults"));
  }
  if (!nonEmpty(input.journeyBinding?.journeyId)) {
    findings.push(finding("PHASE6_SERVER_OUTCOME_BINDING_MISSING", "journey binding must include journeyId", "$.journeyBinding.journeyId"));
  }
  if (!nonEmpty(input.journeyBinding?.agentId)) {
    findings.push(finding("PHASE6_SERVER_OUTCOME_BINDING_MISSING", "journey binding must include agentId", "$.journeyBinding.agentId"));
  }
  if (!nonEmpty(input.worldCursor?.worldId)) {
    findings.push(finding("PHASE6_SERVER_OUTCOME_BINDING_MISSING", "world cursor must include worldId", "$.worldCursor.worldId"));
  }
  return findings;
}

export function buildPhase6ServerOutcomeEvidence(
  input: Phase6ServerOutcomeEvidenceInput,
): Phase6ServerOutcomeEvidenceResult {
  const inputFindings = validateInput(input);
  if (inputFindings.length > 0) {
    return {
      ok: false,
      rulesetVersion: PHASE6_SERVER_OUTCOME_EVIDENCE_RULESET_VERSION,
      deterministic: true,
      findings: inputFindings,
    };
  }

  const events = canonicalIndexedEvents(input.canonicalEvents, input.committedResults);
  const results = committedResultRecords(input.committedResults);
  const actionEvidence = buildActionEvidence(events, results);
  const findings: Phase6ServerOutcomeEvidenceFinding[] = [];

  if (events.length === 0 || events.some((event) => event.eventId.startsWith("missing_event_id_"))) {
    findings.push(finding(
      "PHASE6_SERVER_OUTCOME_EVENT_EVIDENCE_MISSING",
      "committed canonical events must carry stable event ids",
      "$.canonicalEvents",
    ));
  }
  if (actionEvidence.length === 0) {
    findings.push(finding(
      "PHASE6_SERVER_OUTCOME_ACTION_BINDING_MISSING",
      "at least one hosted_action_recorded event with a server journeyResolution is required",
      "$.canonicalEvents",
    ));
  }
  if (!hasSettledEndState(input, events)) {
    findings.push(finding(
      "PHASE6_SERVER_OUTCOME_END_STATE_MISSING",
      "server outcome evidence requires a settled journey end-state or journey_world_solidified event",
      "$.journeyEndState",
    ));
  }

  const hostedActionEvents = events.filter((event) =>
    event.eventType === "hosted_action_recorded"
    && !isAutomaticJourneyLifecycleAction(event));
  const boundActionIds = new Set(actionEvidence.map((entry) => entry.actionId));
  hostedActionEvents.forEach((event, index) => {
    const actionId = text(event.payload.actionId);
    if (!actionId) {
      findings.push(finding(
        "PHASE6_SERVER_OUTCOME_ACTION_BINDING_MISSING",
        "hosted_action_recorded event must bind an actionId",
        `$.canonicalEvents.hosted_action_recorded.${index}.payload.actionId`,
        { eventId: event.eventId },
      ));
      return;
    }
    if (!boundActionIds.has(actionId)) {
      findings.push(finding(
        "PHASE6_SERVER_OUTCOME_COMMAND_BINDING_MISSING",
        "hosted action must bind to a committed command result and server journeyResolution",
        `$.committedResults.${index}`,
        { eventId: event.eventId, actionId },
      ));
    }
  });

  if (input.committedResults.some((result) => {
    const sampling = record(result).sampling;
    const model = record(result).model;
    const decision = record(record(sampling).decision);
    return nonEmpty(record(sampling).outcome)
      || nonEmpty(record(sampling).completion)
      || nonEmpty(record(sampling).reward)
      || nonEmpty(decision.outcome)
      || nonEmpty(decision.completion)
      || nonEmpty(decision.reward)
      || nonEmpty(record(model).outcome)
      || nonEmpty(record(model).completion)
      || nonEmpty(record(model).reward);
  })) {
    findings.push(finding(
      "PHASE6_SERVER_OUTCOME_UNCOMMITTED_MODEL_OUTCOME_REJECTED",
      "model or sampling outcome text cannot be used as Phase 6 outcome evidence; only committed server events are accepted",
      "$.committedResults",
    ));
  }

  if (findings.length > 0) {
    return {
      ok: false,
      rulesetVersion: PHASE6_SERVER_OUTCOME_EVIDENCE_RULESET_VERSION,
      deterministic: true,
      findings,
    };
  }

  const actionResolutions = actionEvidence.map((entry) => buildActionResolution(input, entry, events));
  const outcomeResolution = buildOutcomeResolution(input, actionResolutions, events);
  return {
    ok: true,
    rulesetVersion: PHASE6_SERVER_OUTCOME_EVIDENCE_RULESET_VERSION,
    deterministic: true,
    value: {
      serverOutcomeResolution: outcomeResolution,
      serverActionResolutions: actionResolutions,
      receiptBasisOutcome: outcomeResolution,
    },
    findings: [],
  };
}
